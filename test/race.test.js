import { test } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { openDb } from '../server/db.js';
import { createApp } from '../server/app.js';
import { attachRaces } from '../server/race.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TIMING = { countdown: 120, quickWait: 150, timeout: 15000 };

async function setup(t) {
  const db = openDb(':memory:');
  const server = createApp(db).listen(0);
  await new Promise((r) => server.once('listening', r));
  const { wss } = attachRaces(server, db, { timing: TIMING });
  const base = `127.0.0.1:${server.address().port}`;
  const clients = [];
  t.after(() => { clients.forEach((c) => c.ws.terminate()); wss.close(); server.close(); });

  async function pilot(name) {
    const res = await fetch(`http://${base}/api/players`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name })
    });
    const { token } = await res.json();
    const c = { name, msgs: [], room: null, ws: new WebSocket(`ws://${base}/ws`) };
    clients.push(c);
    c.ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      c.msgs.push(m);
      if (m.type === 'room') c.room = m.room;
    });
    c.send = (m) => c.ws.send(JSON.stringify(m));
    // wait until a message (already received or upcoming) matches, consuming up to it
    c.until = async (pred, ms = 3000) => {
      const start = Date.now();
      while (Date.now() - start < ms) {
        const i = c.msgs.findIndex(pred);
        if (i >= 0) return c.msgs.splice(0, i + 1)[i];
        await sleep(5);
      }
      throw new Error(`${name}: timed out`);
    };
    await new Promise((r) => c.ws.once('open', r));
    c.send({ type: 'hello', token });
    await c.until((m) => m.type === 'welcome');
    return c;
  }
  return { pilot, db, base };
}

const roomIn = (state) => (m) => m.type === 'room' && m.room.state === state;

test('private room: host starts, places follow finish order, results are saved', async (t) => {
  const { pilot, db } = await setup(t);
  const a = await pilot('Alfa');
  const b = await pilot('Bravo');

  a.send({ type: 'create' });
  const { room } = await a.until(roomIn('lobby'));
  assert.equal(room.isPublic, false);
  assert.equal(room.host, 'Alfa');

  b.send({ type: 'join', code: room.code.toLowerCase() });
  await a.until((m) => m.type === 'room' && m.room.players.length === 2);

  b.send({ type: 'start' }); // not the host: ignored
  await sleep(50);
  assert.equal(a.room.state, 'lobby');

  a.send({ type: 'start' });
  const cd = await b.until(roomIn('countdown'));
  assert.equal(cd.room.words.length, 25);
  assert.ok(cd.room.startsIn > 0);
  const total = cd.room.total;

  // progress before the lights go out is ignored
  b.send({ type: 'progress', chars: 10 });
  await a.until(roomIn('racing'));
  assert.equal(a.room.players.find((p) => p.name === 'Bravo').chars, 0);

  await sleep(Math.ceil((total / 20) * 1000)); // let the plausibility ceiling allow a full text
  b.send({ type: 'progress', chars: total });
  b.send({ type: 'finish', accuracy: 98.5 });
  a.send({ type: 'progress', chars: total });
  a.send({ type: 'finish', accuracy: 91 });

  const res = await a.until(roomIn('results'));
  const byName = Object.fromEntries(res.room.players.map((p) => [p.name, p]));
  assert.equal(byName.Bravo.place, 1);
  assert.equal(byName.Alfa.place, 2);
  assert.ok(byName.Bravo.wpm > 0 && byName.Bravo.wpm <= 300);
  assert.equal(byName.Bravo.accuracy, 98.5);

  const rows = db.prepare('SELECT p.name, r.place, r.field FROM race_results r JOIN players p ON p.id = r.player_id ORDER BY r.place').all();
  assert.deepEqual(rows.map((r) => ({ ...r })), [{ name: 'Bravo', place: 1, field: 2 }, { name: 'Alfa', place: 2, field: 2 }]);

  // rematch from results
  a.send({ type: 'start' });
  const again = await b.until(roomIn('countdown'));
  assert.equal(again.room.raceNo, 2);
});

test('finishing without typing the text, or impossibly fast, is a DNF', async (t) => {
  const { pilot } = await setup(t);
  const a = await pilot('Hızlı');
  const b = await pilot('Sahtekar');
  a.send({ type: 'create' });
  const { room } = await a.until(roomIn('lobby'));
  b.send({ type: 'join', code: room.code });
  await a.until((m) => m.type === 'room' && m.room.players.length === 2);
  a.send({ type: 'start' });
  await b.until(roomIn('racing'));

  // instantly claims the whole text: clamped by the per-second ceiling, so the finish is rejected
  b.send({ type: 'progress', chars: 99999 });
  b.send({ type: 'finish', accuracy: 100 });
  await a.until((m) => m.type === 'room' && m.room.players.some((p) => p.name === 'Sahtekar' && p.dnf));
  a.ws.terminate(); // last racer quits → race ends
  const res = await b.until(roomIn('results'));
  assert.equal(res.room.players.find((p) => p.name === 'Sahtekar').place, null);
});

test('quick match pairs pilots and auto-starts; unauthenticated sockets are refused', async (t) => {
  const { pilot, base } = await setup(t);
  const a = await pilot('Charlie');
  const b = await pilot('Delta');
  a.send({ type: 'quick' });
  await a.until(roomIn('lobby'));
  b.send({ type: 'quick' });
  const lobby = await b.until((m) => m.type === 'room' && m.room.players.length === 2);
  assert.equal(lobby.room.isPublic, true);
  assert.ok(lobby.room.autoStartIn > 0);
  await a.until(roomIn('countdown'));

  const anon = new WebSocket(`ws://${base}/ws`);
  t.after(() => anon.terminate());
  await new Promise((r) => anon.once('open', r));
  anon.send(JSON.stringify({ type: 'hello', token: 'nope' }));
  const [raw] = await new Promise((r) => anon.once('message', (...x) => r(x)));
  assert.equal(JSON.parse(raw).fatal, true);
});
