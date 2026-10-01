import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { createApp, periodStart } from '../server/app.js';
import { dailyKey, dailyWords } from '../public/js/words.js';

async function startServer(opts) {
  const app = createApp(openDb(':memory:'), opts);
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, { method = 'GET', body, token } = {}) => {
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(base + path, { method, headers, body: body && JSON.stringify(body) });
    return { status: res.status, data: await res.json().catch(() => null) };
  };
  return { server, call };
}

test('pilot registration, score submission and leaderboard ordering', async (t) => {
  const { server, call } = await startServer();
  t.after(() => server.close());

  const a = await call('/api/players', { method: 'POST', body: { name: 'Şimşek_1' } });
  assert.equal(a.status, 201);
  assert.match(a.data.token, /^[a-f0-9]{64}$/);
  const b = await call('/api/players', { method: 'POST', body: { name: 'Hızlı' } });

  assert.equal((await call('/api/players', { method: 'POST', body: { name: 'şimşek_1' } })).status, 409, 'names are case-insensitive');
  assert.equal((await call('/api/players', { method: 'POST', body: { name: 'a' } })).status, 400);

  const post = (token, test, score, details) => call('/api/scores', { method: 'POST', token, body: { test, score, details } });
  assert.equal((await post(null, 'typing-30-tr', 80, { accuracy: 97, raw: 85 })).status, 401);
  assert.equal((await post(a.data.token, 'typing-30-tr', 80, { accuracy: 97, raw: 85 })).status, 201);
  assert.equal((await post(a.data.token, 'typing-30-tr', 95, { accuracy: 96, raw: 99 })).status, 201);
  const r = await post(b.data.token, 'typing-30-tr', 90, { accuracy: 99, raw: 92 });
  assert.equal(r.data.all.rank, 2);

  const board = await call('/api/leaderboard/typing-30-tr?period=all', { token: b.data.token });
  assert.deepEqual(board.data.rows.map((x) => [x.name, x.score]), [['Şimşek_1', 95], ['Hızlı', 90]]);
  assert.equal(board.data.rows[0].details.accuracy, 96, 'details come from the best run');
  assert.equal(board.data.me.rank, 2);

  // lower is better for reflex
  await post(a.data.token, 'reflex', 240, { best: 210, attempts: 5 });
  await post(b.data.token, 'reflex', 190, { best: 170, attempts: 5 });
  const reflex = await call('/api/leaderboard/reflex');
  assert.deepEqual(reflex.data.rows.map((x) => x.name), ['Hızlı', 'Şimşek_1']);

  const prof = await call('/api/players/%C5%9Fim%C5%9Fek_1');
  assert.equal(prof.data.bests['typing-30-tr'].score, 95);
  assert.equal(prof.data.bests.reflex.rank, 2);
});

test('impossible or malformed results are rejected', async (t) => {
  const { server, call } = await startServer();
  t.after(() => server.close());
  const { data } = await call('/api/players', { method: 'POST', body: { name: 'Robot' } });
  const post = (test, score, details) => call('/api/scores', { method: 'POST', token: data.token, body: { test, score, details } });

  assert.equal((await post('typing-30-tr', 400, { accuracy: 99, raw: 400 })).status, 400);
  assert.equal((await post('typing-30-tr', 90, { accuracy: 50, raw: 120 })).status, 400);
  assert.equal((await post('reflex', 40, { best: 30, attempts: 5 })).status, 400);
  assert.equal((await post('cpm-5', 1800, { clicks: 150 })).status, 400);
  assert.equal((await post('cpm-5', 600, { clicks: 40 })).status, 400, 'cpm must match clicks');
  assert.equal((await post('cpm-5', 480, { clicks: 40 })).status, 201);
  assert.equal((await post('typing-daily-tr', 70, { accuracy: 98, day: '2001-01-01' })).status, 400);
  assert.equal((await post('typing-daily-tr', 70, { accuracy: 98, day: dailyKey() })).status, 201);
  assert.equal((await post('nope', 1, {})).status, 400);
});

test('period windows and daily text are deterministic', () => {
  const wed = new Date('2026-09-30T15:00:00Z');
  assert.equal(new Date(periodStart('day', wed)).toISOString(), '2026-09-30T00:00:00.000Z');
  assert.equal(new Date(periodStart('week', wed)).toISOString(), '2026-09-28T00:00:00.000Z');
  assert.equal(periodStart('all', wed), 0);
  assert.deepEqual(dailyWords('2026-10-01'), dailyWords('2026-10-01'));
  assert.notDeepEqual(dailyWords('2026-10-01'), dailyWords('2026-10-02'));
});
