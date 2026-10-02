import express from 'express';
import { randomBytes } from 'node:crypto';
import { sha256 } from './db.js';
import { fileURLToPath } from 'node:url';
import { CATALOG, publicCatalog, validateScore } from './catalog.js';
import { dailyKey } from '../public/js/words.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));
const NAME_RE = /^[\p{L}\p{N}_-]{3,16}$/u;
const PERIODS = ['day', 'week', 'all'];

const nameKey = (name) => name.toLocaleLowerCase('tr');

export function periodStart(period, now = new Date()) {
  if (period === 'all') return 0;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === 'week') d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // Monday
  return d.getTime();
}

// Small in-memory sliding-window limiter; good enough for a single instance.
function rateLimit(limit, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) return res.status(429).json({ error: 'Çok hızlısın! Biraz bekle ve tekrar dene.' });
    recent.push(now);
    hits.set(req.ip, recent);
    next();
  };
}

export function createApp(db, { now = () => Date.now() } = {}) {
  const app = express();
  // Behind a hosting proxy (Railway, Render, …) set TRUST_PROXY=1 so rate limits
  // see each visitor's real IP instead of the proxy's.
  const hops = Number(process.env.TRUST_PROXY);
  app.set('trust proxy', Number.isInteger(hops) && hops > 0 ? hops : 'loopback');
  // CANONICAL_HOST=www.fingergp.com sends the other spelling (bare / www) there, so
  // links and pilot licenses (stored per origin) live on one address. Unset: no redirect.
  const canonical = process.env.CANONICAL_HOST;
  app.use((req, res, next) => {
    const host = req.get('host') || '';
    if (canonical && host !== canonical && (host === `www.${canonical}` || `www.${host}` === canonical)) {
      return res.redirect(301, `https://${canonical}${req.originalUrl}`);
    }
    next();
  });
  app.use(express.json({ limit: '4kb' }));

  const q = {
    playerByKey: db.prepare('SELECT id, name, created_at FROM players WHERE name_key = ?'),
    playerByToken: db.prepare('SELECT id, name FROM players WHERE token_hash = ?'),
    insertPlayer: db.prepare('INSERT INTO players (name, name_key, token_hash, created_at) VALUES (?, ?, ?, ?)'),
    insertScore: db.prepare('INSERT INTO scores (player_id, test, score, details, created_at) VALUES (?, ?, ?, ?, ?)'),
    board: {
      high: db.prepare(`
        SELECT p.name, MAX(s.score) AS score, s.details, s.created_at AS at
        FROM scores s JOIN players p ON p.id = s.player_id
        WHERE s.test = ? AND s.created_at >= ?
        GROUP BY s.player_id ORDER BY score DESC, at ASC LIMIT ?`),
      low: db.prepare(`
        SELECT p.name, MIN(s.score) AS score, s.details, s.created_at AS at
        FROM scores s JOIN players p ON p.id = s.player_id
        WHERE s.test = ? AND s.created_at >= ?
        GROUP BY s.player_id ORDER BY score ASC, at ASC LIMIT ?`)
    },
    myBest: {
      high: db.prepare('SELECT MAX(score) AS score FROM scores WHERE test = ? AND created_at >= ? AND player_id = ?'),
      low: db.prepare('SELECT MIN(score) AS score FROM scores WHERE test = ? AND created_at >= ? AND player_id = ?')
    },
    ahead: {
      high: db.prepare(`SELECT COUNT(*) AS n FROM (SELECT MAX(score) AS b FROM scores
        WHERE test = ? AND created_at >= ? GROUP BY player_id) WHERE b > ?`),
      low: db.prepare(`SELECT COUNT(*) AS n FROM (SELECT MIN(score) AS b FROM scores
        WHERE test = ? AND created_at >= ? GROUP BY player_id) WHERE b < ?`)
    },
    playerBests: db.prepare(`
      SELECT test, MAX(score) AS high, MIN(score) AS low, COUNT(*) AS runs
      FROM scores WHERE player_id = ? GROUP BY test`),
    playerRecent: db.prepare(`
      SELECT test, score, details, created_at AS at FROM scores
      WHERE player_id = ? ORDER BY created_at DESC LIMIT 15`),
    playerRaces: db.prepare(`
      SELECT COUNT(*) AS races, COUNT(CASE WHEN place = 1 THEN 1 END) AS wins,
             COUNT(CASE WHEN place <= 3 THEN 1 END) AS podiums, MAX(wpm) AS best
      FROM race_results WHERE player_id = ?`)
  };

  function auth(req) {
    const m = /^Bearer ([a-f0-9]{64})$/.exec(req.get('authorization') || '');
    return m ? q.playerByToken.get(sha256(m[1])) : undefined;
  }

  function rankOf(test, since, playerId) {
    const { better } = CATALOG[test];
    const best = q.myBest[better].get(test, since, playerId)?.score;
    if (best == null) return null;
    return { score: best, rank: q.ahead[better].get(test, since, best).n + 1 };
  }

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.get('/api/catalog', (req, res) => res.json(publicCatalog()));

  app.get('/api/daily', (req, res) => {
    const start = periodStart('day', new Date(now()));
    res.json({ day: dailyKey(new Date(now())), resetsAt: start + 86_400_000 });
  });

  app.post('/api/players', rateLimit(5, 60 * 60 * 1000), (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!NAME_RE.test(name)) {
      return res.status(400).json({ error: 'Pilot adı 3-16 karakter olmalı; harf, rakam, _ ve - kullanabilirsin.' });
    }
    if (q.playerByKey.get(nameKey(name))) return res.status(409).json({ error: 'Bu pilot adı alınmış.' });
    const token = randomBytes(32).toString('hex');
    q.insertPlayer.run(name, nameKey(name), sha256(token), now());
    res.status(201).json({ name, token });
  });

  app.get('/api/me', (req, res) => {
    const player = auth(req);
    if (!player) return res.status(401).json({ error: 'Pilot bulunamadı.' });
    res.json({ name: player.name });
  });

  app.get('/api/players/:name', (req, res) => {
    const player = q.playerByKey.get(nameKey(req.params.name));
    if (!player) return res.status(404).json({ error: 'Pilot bulunamadı.' });
    const bests = {};
    for (const row of q.playerBests.all(player.id)) {
      if (!CATALOG[row.test]) continue;
      const score = CATALOG[row.test].better === 'high' ? row.high : row.low;
      bests[row.test] = { score, runs: row.runs, rank: rankOf(row.test, 0, player.id)?.rank };
    }
    const recent = q.playerRecent.all(player.id).map((r) => ({ ...r, details: JSON.parse(r.details) }));
    res.json({ name: player.name, since: player.created_at, bests, recent, races: q.playerRaces.get(player.id) });
  });

  app.post('/api/scores', rateLimit(30, 60 * 1000), (req, res) => {
    const player = auth(req);
    if (!player) return res.status(401).json({ error: 'Skor göndermek için pilot kaydı gerekli.' });
    const { test, score, details } = req.body || {};
    const error = validateScore(test, score, details);
    if (error) return res.status(400).json({ error });

    const at = now();
    const rounded = Math.round(score * 100) / 100;
    q.insertScore.run(player.id, test, rounded, JSON.stringify(details), at);

    const result = { saved: true };
    for (const period of PERIODS) result[period] = rankOf(test, periodStart(period, new Date(at)), player.id);
    res.status(201).json(result);
  });

  app.get('/api/leaderboard/:test', (req, res) => {
    const entry = CATALOG[req.params.test];
    if (!entry) return res.status(404).json({ error: 'Bilinmeyen test.' });
    const period = entry.period || (PERIODS.includes(req.query.period) ? req.query.period : 'all');
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const since = periodStart(period, new Date(now()));
    const rows = q.board[entry.better].all(req.params.test, since, limit).map((r, i) => ({
      rank: i + 1, name: r.name, score: r.score, at: r.at, details: JSON.parse(r.details)
    }));
    const player = auth(req);
    res.json({ test: req.params.test, period, rows, me: player ? rankOf(req.params.test, since, player.id) : null });
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Bulunamadı.' }));
  app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
  app.get('/{*splat}', (req, res) => res.sendFile('index.html', { root: PUBLIC_DIR }));
  return app;
}
