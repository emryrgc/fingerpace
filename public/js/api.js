const STORE_KEY = 'fmq.pilot';

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || null; } catch { return null; }
}

let pilot = load();
const listeners = new Set();

export const getPilot = () => pilot;
export const onPilotChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));

function setPilot(p) {
  pilot = p;
  try { p ? localStorage.setItem(STORE_KEY, JSON.stringify(p)) : localStorage.removeItem(STORE_KEY); } catch {}
  listeners.forEach((fn) => fn(pilot));
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (pilot?.token) headers.authorization = `Bearer ${pilot.token}`;
  const res = await fetch(path, { method, headers, body: body && JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `İstek başarısız (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function register(name) {
  const data = await request('/api/players', { method: 'POST', body: { name } });
  setPilot(data);
  return data;
}

export async function verifyPilot() {
  if (!pilot) return;
  try { await request('/api/me'); } catch (e) { if (e.status === 401) setPilot(null); }
}

export const logout = () => setPilot(null);
export const submitScore = (test, score, details) => request('/api/scores', { method: 'POST', body: { test, score, details } });
export const leaderboard = (test, period = 'all', limit = 50) =>
  request(`/api/leaderboard/${encodeURIComponent(test)}?period=${period}&limit=${limit}`);
export const daily = () => request('/api/daily');
export const catalog = () => request('/api/catalog');
export const profile = (name) => request(`/api/players/${encodeURIComponent(name)}`);

// Personal bests are also kept locally so guests get a ghost car to race.
export function localBest(test) {
  try { return JSON.parse(localStorage.getItem(`fmq.pb.${test}`)); } catch { return null; }
}
export function saveLocalBest(test, score, better = 'high') {
  const prev = localBest(test);
  const improved = prev == null || (better === 'high' ? score > prev : score < prev);
  if (improved) try { localStorage.setItem(`fmq.pb.${test}`, JSON.stringify(score)); } catch {}
  return { improved, prev };
}
