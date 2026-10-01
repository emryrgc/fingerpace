// Real-time race rooms over WebSocket.
//
// Lifecycle of a room:  lobby → countdown → racing → results → (rematch) countdown …
// The server owns the clock: it announces when the lights go out, and computes
// every finisher's WPM from its own timestamps, so a tampered client can only
// lie about how far it got, never about how fast.
import { WebSocketServer } from 'ws';
import { sha256 } from './db.js';
import { generateWords } from '../public/js/words.js';

export const MAX_PLAYERS = 5;
export const RACE_WORDS = 25;
export const COUNTDOWN_MS = 6000;      // five lights, one per second, then lights out
export const QUICK_WAIT_MS = 8000;     // quick-match lobby wait once two pilots are in
export const RACE_TIMEOUT_MS = 120000;
const MAX_CPS = 25;                    // 300 WPM — same ceiling as the solo tests
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function attachRaces(server, db, { now = () => Date.now(), timing = {} } = {}) {
  const T = { countdown: COUNTDOWN_MS, quickWait: QUICK_WAIT_MS, timeout: RACE_TIMEOUT_MS, ...timing };
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 2048 });
  const rooms = new Map();
  const playerByToken = db.prepare('SELECT id, name FROM players WHERE token_hash = ?');
  const insertResult = db.prepare(
    'INSERT INTO race_results (player_id, place, field, wpm, accuracy, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const send = (ws, msg) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(msg));

  function newCode() {
    let code;
    do code = Array.from({ length: 5 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
    while (rooms.has(code));
    return code;
  }

  function createRoom(isPublic) {
    const room = {
      code: newCode(), isPublic, hostId: null, state: 'lobby', raceNo: 0,
      words: [], total: 0, goAt: 0, autoStartAt: 0, players: new Map(), timers: {},
      finishers: 0, field: 0, leavers: []
    };
    rooms.set(room.code, room);
    return room;
  }

  function snapshot(room) {
    const t = now();
    return {
      type: 'room',
      room: {
        code: room.code,
        isPublic: room.isPublic,
        host: room.players.get(room.hostId)?.name || null,
        state: room.state,
        raceNo: room.raceNo,
        words: room.state === 'lobby' ? null : room.words,
        total: room.total,
        startsIn: room.state === 'countdown' ? room.goAt - t : null,
        elapsed: room.state === 'racing' ? t - room.goAt : null,
        autoStartIn: room.autoStartAt ? room.autoStartAt - t : null,
        players: [...room.players.values()].map((p) => ({
          name: p.name, chars: p.chars, wpm: p.wpm, accuracy: p.accuracy,
          place: p.place, dnf: p.dnf, racing: p.racing, connected: true
        }))
      }
    };
  }

  function broadcast(room) {
    const msg = snapshot(room);
    for (const p of room.players.values()) send(p.ws, msg);
    room.dirty = false;
  }

  function clearTimer(room, name) {
    clearTimeout(room.timers[name]);
    clearInterval(room.timers[name]);
    delete room.timers[name];
  }

  function scheduleQuickStart(room) {
    if (!room.isPublic || room.state !== 'lobby') return;
    const n = room.players.size;
    if (n >= MAX_PLAYERS) return startCountdown(room);
    if (n >= 2 && !room.autoStartAt) {
      room.autoStartAt = now() + T.quickWait;
      room.timers.auto = setTimeout(() => startCountdown(room), T.quickWait);
    } else if (n < 2 && room.autoStartAt) {
      room.autoStartAt = 0;
      clearTimer(room, 'auto');
    }
  }

  function startCountdown(room) {
    if (!['lobby', 'results'].includes(room.state) || room.players.size === 0) return;
    clearTimer(room, 'auto');
    room.autoStartAt = 0;
    room.state = 'countdown';
    room.raceNo++;
    room.words = generateWords('tr', RACE_WORDS);
    room.total = room.words.join(' ').length;
    room.goAt = now() + T.countdown;
    room.finishers = 0;
    room.field = room.players.size; // starters, including any who later quit
    room.leavers = [];
    for (const p of room.players.values()) Object.assign(p, { chars: 0, wpm: null, accuracy: null, place: null, dnf: false, racing: true });
    room.timers.go = setTimeout(() => {
      room.state = 'racing';
      broadcast(room);
      // progress is fanned out on a fixed tick rather than per keystroke
      room.timers.tick = setInterval(() => room.dirty && broadcast(room), 150);
      room.timers.timeout = setTimeout(() => endRace(room), T.timeout);
    }, T.countdown);
    broadcast(room);
  }

  function maybeEnd(room) {
    if (room.state === 'racing' && [...room.players.values()].every((p) => !p.racing)) endRace(room);
  }

  function endRace(room) {
    if (room.state !== 'racing') return;
    ['tick', 'timeout'].forEach((t) => clearTimer(room, t));
    room.state = 'results';
    for (const p of room.players.values()) if (p.racing) Object.assign(p, { racing: false, dnf: true });
    const starters = [...room.players.values()].filter((p) => p.place || p.dnf);
    // results only count when there was someone to beat
    const field = room.field;
    if (field >= 2) {
      const at = now();
      for (const p of starters) insertResult.run(p.id, p.place, field, p.wpm, p.accuracy, at);
      for (const r of room.leavers) insertResult.run(r.id, null, field, null, null, at);
    }
    room.leavers = [];
    broadcast(room);
    if (room.isPublic) room.timers.close = setTimeout(() => closeRoom(room), 60000);
  }

  function closeRoom(room) {
    Object.keys(room.timers).forEach((t) => clearTimer(room, t));
    for (const p of room.players.values()) { p.ws.room = null; send(p.ws, { type: 'closed' }); }
    rooms.delete(room.code);
  }

  function join(ws, room) {
    if (ws.room === room) return broadcast(room);
    leave(ws);
    if (room.players.has(ws.player.id)) {
      // same pilot from another tab: the new connection takes over the seat
      const old = room.players.get(ws.player.id).ws;
      send(old, { type: 'error', message: 'Bu odaya başka bir sekmeden bağlandın.' });
      old.room = null;
      room.players.get(ws.player.id).ws = ws;
      ws.room = room;
      return broadcast(room);
    }
    if (room.players.size >= MAX_PLAYERS) return send(ws, { type: 'error', message: 'Oda dolu (en fazla 5 pilot).' });
    if (room.isPublic && room.state !== 'lobby') return send(ws, { type: 'error', message: 'Bu yarış çoktan başladı.' });
    room.players.set(ws.player.id, {
      id: ws.player.id, name: ws.player.name, ws,
      chars: 0, wpm: null, accuracy: null, place: null, dnf: false,
      racing: false // joined mid-race → spectates until the next start
    });
    if (!room.hostId) room.hostId = ws.player.id;
    ws.room = room;
    scheduleQuickStart(room);
    broadcast(room);
  }

  function leave(ws) {
    const room = ws.room;
    if (!room) return;
    ws.room = null;
    const p = room.players.get(ws.player.id);
    if (!p || p.ws !== ws) return;
    if (p.racing && room.state === 'racing') room.leavers.push({ id: p.id });
    room.players.delete(p.id);
    if (room.players.size === 0) return closeRoom(room);
    if (room.hostId === p.id) room.hostId = room.players.keys().next().value;
    if (room.state === 'countdown') {
      room.field--;
      if (![...room.players.values()].some((x) => x.racing)) {
        clearTimer(room, 'go');
        room.state = 'lobby';
      }
    }
    scheduleQuickStart(room);
    maybeEnd(room);
    broadcast(room);
  }

  const handlers = {
    quick(ws) {
      const open = [...rooms.values()].find((r) => r.isPublic && r.state === 'lobby' && r.players.size < MAX_PLAYERS);
      join(ws, open || createRoom(true));
    },
    create(ws) {
      join(ws, createRoom(false));
    },
    join(ws, { code }) {
      const room = rooms.get(String(code || '').toUpperCase());
      if (!room) return send(ws, { type: 'error', message: 'Bu kodla bir oda bulunamadı.' });
      join(ws, room);
    },
    leave(ws) {
      leave(ws);
      send(ws, { type: 'left' });
    },
    start(ws) {
      const room = ws.room;
      if (!room || room.isPublic || room.hostId !== ws.player.id) return;
      startCountdown(room);
    },
    progress(ws, { chars }) {
      const room = ws.room;
      const p = room?.players.get(ws.player.id);
      if (!p || room.state !== 'racing' || !p.racing || !Number.isInteger(chars)) return;
      const ceiling = Math.floor((MAX_CPS * (now() - room.goAt)) / 1000) + 5;
      p.chars = Math.max(p.chars, Math.min(chars, room.total, ceiling));
      room.dirty = true;
    },
    finish(ws, { accuracy }) {
      const room = ws.room;
      const p = room?.players.get(ws.player.id);
      if (!p || room.state !== 'racing' || !p.racing) return;
      const elapsed = now() - room.goAt;
      const wpm = room.total / 5 / (elapsed / 60000);
      p.racing = false;
      if (p.chars < room.total || wpm > MAX_CPS * 12) {
        p.dnf = true; // claimed the flag without having typed the whole text
      } else {
        p.place = ++room.finishers;
        p.wpm = Math.round(wpm * 100) / 100;
        p.accuracy = typeof accuracy === 'number' && accuracy >= 0 && accuracy <= 100 ? accuracy : null;
        p.chars = room.total;
      }
      broadcast(room);
      maybeEnd(room);
    }
  };

  wss.on('connection', (ws) => {
    ws.alive = true;
    ws.on('pong', () => (ws.alive = true));
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      if (!msg || typeof msg.type !== 'string') return;
      if (msg.type === 'hello') {
        const player = typeof msg.token === 'string' ? playerByToken.get(sha256(msg.token)) : null;
        if (!player) return send(ws, { type: 'error', fatal: true, message: 'Yarışmak için pilot lisansı gerekli.' });
        ws.player = player;
        return send(ws, { type: 'welcome', name: player.name });
      }
      if (!ws.player || !Object.hasOwn(handlers, msg.type)) return;
      handlers[msg.type](ws, msg);
    });
    ws.on('close', () => ws.player && leave(ws));
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) { ws.terminate(); continue; }
      ws.alive = false;
      ws.ping();
    }
  }, 30000);
  wss.on('close', () => clearInterval(heartbeat));

  return { wss, rooms };
}
