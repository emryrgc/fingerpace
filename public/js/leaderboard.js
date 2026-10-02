import { $, esc } from './ui.js';
import { leaderboard, getPilot, profile, logout } from './api.js';

const GROUPS = { typing: 'Klavye GP', daily: 'Günlük GP', reflex: 'Start Işıkları', cpm: 'Pit Stop' };
const PERIODS = { day: 'Bugün', week: 'Bu hafta', all: 'Tüm zamanlar' };

// test key <-> filter state
function parse(test = 'typing-30-tr') {
  let m;
  if ((m = /^typing-(\d+)-(\w+)$/.exec(test))) return { group: 'typing', seconds: +m[1], lang: m[2] };
  if ((m = /^typing-daily-(\w+)$/.exec(test))) return { group: 'daily', lang: m[1] };
  if ((m = /^cpm-(\d+)$/.exec(test))) return { group: 'cpm', seconds: +m[1] };
  if (test === 'reflex') return { group: 'reflex' };
  return parse();
}
function build(f) {
  if (f.group === 'typing') return `typing-${f.seconds || 30}-${f.lang || 'tr'}`;
  if (f.group === 'daily') return `typing-daily-${f.lang || 'tr'}`;
  if (f.group === 'cpm') return `cpm-${[5, 10].includes(f.seconds) ? f.seconds : 5}`;
  return 'reflex';
}

export function unitOf(test) {
  return test === 'reflex' ? 'ms' : test.startsWith('cpm') ? 'CPM' : 'WPM';
}
export function labelOf(test) {
  const f = parse(test);
  if (f.group === 'typing') return `Klavye GP · ${f.seconds} sn · ${f.lang.toUpperCase()}`;
  if (f.group === 'daily') return `Günlük GP · ${f.lang.toUpperCase()}`;
  if (f.group === 'cpm') return `Pit Stop · ${f.seconds} sn`;
  return 'Start Işıkları';
}
const fmt = (v) => (Number.isInteger(v) ? v : v.toFixed(1));

function extraOf(test, d) {
  if (test === 'reflex') return d.avg ? `ort. ${d.avg} ms` : '';
  if (test.startsWith('cpm')) return d.clicks ? `${d.clicks} tık` : '';
  return d.accuracy != null ? `%${d.accuracy}${d.time ? ` · ${d.time} sn` : ''}` : '';
}

const seg = (group, options, current) => `
  <div class="segmented" data-group="${group}">
    ${Object.entries(options).map(([v, l]) => `<button type="button" data-value="${v}" aria-pressed="${String(v) === String(current)}">${l}</button>`).join('')}
  </div>`;

export function mount(root, { test } = {}) {
  const f = parse(test);
  let period = sessionStorage.getItem('fmq.period') || 'week';
  let alive = true;

  function render() {
    const key = build(f);
    if (location.hash !== `#/leaderboard/${key}`) history.replaceState(null, '', `#/leaderboard/${key}`);
    root.innerHTML = `
      <div class="page-head">
        <div><div class="eyebrow">Sıralama</div><h1 lang="en">Starting grid</h1></div>
      </div>
      <div class="board-filters">
        ${seg('group', GROUPS, f.group)}
        ${f.group === 'typing' ? seg('seconds', { 15: '15 sn', 30: '30 sn', 60: '60 sn' }, f.seconds || 30) : ''}
        ${f.group === 'cpm' ? seg('seconds', { 5: '5 sn', 10: '10 sn' }, f.seconds || 5) : ''}
        ${['typing', 'daily'].includes(f.group) ? seg('lang', { tr: 'TR', en: 'EN' }, f.lang || 'tr') : ''}
        ${f.group === 'daily' ? '' : seg('period', PERIODS, period)}
      </div>
      <div class="board"><p class="empty-state">Pist yükleniyor…</p></div>`;
    root.querySelectorAll('.segmented').forEach((s) => s.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const g = s.dataset.group, v = b.dataset.value;
      if (g === 'period') { period = v; sessionStorage.setItem('fmq.period', v); }
      else f[g] = g === 'seconds' ? Number(v) : v;
      if (g === 'group') delete f.seconds;
      render();
    }));
    load(key);
  }

  async function load(key) {
    const board = $('.board', root);
    try {
      const data = await leaderboard(key, period);
      if (!alive || build(f) !== key) return;
      board.innerHTML = boardHtml(key, data);
    } catch (e) {
      board.innerHTML = `<p class="empty-state">⚠️ ${esc(e.message)}</p>`;
    }
  }

  render();
  return () => { alive = false; };
}

function boardHtml(test, { rows, me }) {
  const unit = unitOf(test);
  const myName = getPilot()?.name;
  if (!rows.length) {
    return `<div class="empty-state"><p>Bu pistte henüz kimse yok. Pole position seni bekliyor.</p>
      <a class="btn primary" href="${testHref(test)}">İlk sen ol</a></div>`;
  }
  const step = (r, p) => r
    ? `<div class="step p${p}"><div class="who"><a href="#/pilot/${encodeURIComponent(r.name)}">${esc(r.name)}</a></div>
        <div class="score">${fmt(r.score)} <small class="muted">${unit}</small></div><div class="block">P${p}</div></div>`
    : `<div class="step p${p} empty"><div class="who">—</div><div class="score">&nbsp;</div><div class="block">P${p}</div></div>`;
  const rest = rows.slice(3);
  const meInList = rows.some((r) => r.name === myName);
  return `
    <div class="podium">${step(rows[1], 2)}${step(rows[0], 1)}${step(rows[2], 3)}</div>
    ${rest.length ? `<ol class="grid-list">${rest.map((r) => `
      <li class="${r.name === myName ? 'me' : ''}">
        <span class="pos">P${r.rank}</span>
        <span class="name"><a href="#/pilot/${encodeURIComponent(r.name)}">${esc(r.name)}</a></span>
        <span class="extra">${esc(extraOf(test, r.details))}</span>
        <span class="sc">${fmt(r.score)} ${unit}</span>
      </li>`).join('')}</ol>` : ''}
    ${me && !meInList ? `<div class="my-rank">Senin yerin: <b>P${me.rank}</b> · ${fmt(me.score)} ${unit}</div>` : ''}`;
}

export function testHref(test) {
  const f = parse(test);
  return { typing: '#/typing', daily: '#/daily', reflex: '#/reflex', cpm: '#/clicks' }[f.group];
}

export async function mountProfile(root, { name }) {
  root.innerHTML = `<p class="empty-state">Pilot dosyası açılıyor…</p>`;
  try {
    const p = await profile(name);
    const bests = Object.entries(p.bests);
    root.innerHTML = `
      <div class="page-head">
        <div><div class="eyebrow">Pilot · lisans ${new Date(p.since).toLocaleDateString('tr-TR')}</div><h1>${esc(p.name)}</h1></div>
        ${getPilot()?.name === p.name ? '<button class="btn ghost" data-action="logout">Bu tarayıcıdan çıkış yap</button>' : ''}
      </div>
      ${p.races?.races ? `<h2 style="font-size:28px;margin-bottom:14px">Canlı yarışlar</h2>
      <div class="bests">
        <div class="stat"><span>Yarış</span><b>${p.races.races}</b></div>
        <div class="stat"><span>Galibiyet</span><b>${p.races.wins}</b></div>
        <div class="stat"><span>Podyum</span><b>${p.races.podiums}</b></div>
        <div class="stat"><span>En iyi yarış hızı</span><b>${p.races.best ? Math.round(p.races.best) + ' WPM' : '—'}</b></div>
      </div>` : ''}
      <h2 style="font-size:28px;margin-bottom:14px">Kişisel rekorlar</h2>
      ${bests.length ? `<div class="bests">${bests.map(([t, b]) => `
        <a class="stat" style="text-decoration:none" href="#/leaderboard/${t}">
          <span>${esc(labelOf(t))}</span><b>${fmt(b.score)} ${unitOf(t)}</b>
          <div class="muted" style="font-size:13px">Tüm zamanlar P${b.rank} · ${b.runs} tur</div>
        </a>`).join('')}</div>` : '<p class="muted">Henüz tur atılmamış.</p>'}
      <h2 style="font-size:28px;margin:8px 0 14px">Son turlar</h2>
      ${p.recent.length ? `<ol class="grid-list">${p.recent.map((r) => `
        <li><span class="pos" style="font-size:14px">${new Date(r.at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}</span>
          <span class="name">${esc(labelOf(r.test))}</span><span class="extra">${esc(extraOf(r.test, r.details))}</span>
          <span class="sc">${fmt(r.score)} ${unitOf(r.test)}</span></li>`).join('')}</ol>` : '<p class="muted">—</p>'}`;
    const out = root.querySelector('[data-action=logout]');
    if (out) out.onclick = () => {
      if (!confirm('Lisans anahtarın yalnızca bu tarayıcıda. Çıkış yaparsan bu pilot adına bir daha giriş yapamazsın. Emin misin?')) return;
      logout();
      location.hash = '#/';
    };
  } catch (e) {
    root.innerHTML = `<p class="empty-state">⚠️ ${esc(e.message)}</p>`;
  }
}
