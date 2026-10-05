import { $, $$, esc, fmtTime, toast } from './ui.js';
import { getPilot, onPilotChange, register, verifyPilot, leaderboard, daily as fetchDaily } from './api.js';
import * as typing from './typing.js';
import * as reflex from './reflex.js';
import * as clicks from './clicks.js';
import * as board from './leaderboard.js';
import * as race from './race.js';
import { navigate } from './nav.js';
import { PAGES, PATHS, LEGACY } from './pages.js';

const view = $('#view');
let cleanup = null;

const P = PATHS;
const routes = [
  [/^\/$/, home, null, 'home'],
  [new RegExp(`^${P.typing}$`), (r) => typing.mount(r), 'typing', 'typing'],
  [new RegExp(`^${P.daily}$`), (r) => typing.mount(r, { daily: true }), 'typing', 'daily'],
  [new RegExp(`^${P.reflex}$`), (r) => reflex.mount(r), 'reflex', 'reflex'],
  [new RegExp(`^${P.clicks}$`), (r) => clicks.mount(r), 'clicks', 'clicks'],
  [new RegExp(`^${P.race}(?:/([A-Za-z0-9]{5}))?$`), (r, m) => race.mount(r, { code: m[1]?.toUpperCase() }), 'race', 'race'],
  [new RegExp(`^${P.leaderboard}(?:/([\\w-]+))?$`), (r, m) => board.mount(r, { test: m[1] }), 'leaderboard', 'leaderboard'],
  [/^\/pilot\/(.+)$/, (r, m) => board.mountProfile(r, { name: decodeURIComponent(m[1]) }), 'leaderboard', null]
];

// Links shared before the move to real paths looked like /#/typing or /#/race/AB12C.
function upgradeLegacyHash() {
  const m = /^#\/([a-z]*)(\/.*)?$/.exec(location.hash);
  if (!m) return;
  const base = m[1] ? LEGACY[m[1]] : '/';
  if (base) history.replaceState(null, '', base + (m[2] || ''));
}

function aboutHtml(page) {
  if (!page?.about) return '';
  return `<section class="seo-copy">${page.about.map(([q, a]) => `<div><h2>${esc(q)}</h2><p>${esc(a)}</p></div>`).join('')}</section>`;
}

function route() {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  const [re, fn, nav, pageKey] = routes.find(([re]) => re.test(path)) || routes[0];
  $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === nav));
  const page = PAGES[pageKey];
  document.title = page ? page.title : `${decodeURIComponent(path.split('/').pop())} — Pilot profili | FingerGP`;
  const result = fn(view, path.match(re) || []);
  if (typeof result === 'function') cleanup = result;
  view.insertAdjacentHTML('beforeend', aboutHtml(page));
  window.scrollTo(0, 0);
}

// Same-origin links navigate without a full page load.
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[href]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const href = a.getAttribute('href');
  if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/api') || a.target) return;
  e.preventDefault();
  navigate(href);
});

// ---------- home ----------
function home(root) {
  root.innerHTML = `
    <section class="hero">
      <div>
        <div class="eyebrow">Parmak motorsporları</div>
        <h1>Parmakların <em>pistte.</em></h1>
        <p>Klavyede hız, ışıklarda refleks, farede devir. Pilot lisansını al, rakiplerinle aynı anda aynı pistte yarış; her gün sıfırlanan Grand Prix'de podyuma çık.</p>
        <div class="hero-actions">
          <a class="btn primary" href="/canli-yaris">Canlı yarışa katıl</a>
          <a class="btn ghost" href="/gunluk-grand-prix">Günün Grand Prix'si</a>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">${heroArt()}</div>
    </section>

    <section class="cards">
      <a class="card" href="/klavye-hiz-testi">
        <span class="num">01</span>
        <svg class="card-icon" viewBox="0 0 44 44"><rect x="3" y="10" width="38" height="24" rx="4" fill="none" stroke="#3fb489" stroke-width="3"/><path d="M10 18h4M18 18h4M26 18h4M10 25h24" stroke="#f1efe8" stroke-width="3" stroke-linecap="round"/></svg>
        <h3>Klavye GP</h3>
        <p>15, 30 veya 60 saniye. Hayalet arabanla — yani kendi rekorunla — kafa kafaya yazarsın.</p>
        <span class="go">Piste çık →</span>
      </a>
      <a class="card" href="/refleks-testi">
        <span class="num">02</span>
        <svg class="card-icon" viewBox="0 0 44 44">${[6, 16, 26, 36].map((x) => `<circle cx="${x + 1}" cy="22" r="4.5" fill="#ff3b2f"/>`).join('')}</svg>
        <h3>Start Işıkları</h3>
        <p>F1 tarzı beş ışık. Söndükleri an tepki ver. Erken kalkarsan ceza yersin.</p>
        <span class="go">Gride geç →</span>
      </a>
      <a class="card" href="/cpm-testi">
        <span class="num">03</span>
        <svg class="card-icon" viewBox="0 0 44 44"><circle cx="22" cy="22" r="17" fill="none" stroke="#d6a85c" stroke-width="3"/><circle cx="22" cy="22" r="5" fill="#f1efe8"/><path d="M22 5v8M22 31v8M5 22h8M31 22h8" stroke="#d6a85c" stroke-width="3"/></svg>
        <h3 lang="en">Pit Stop</h3>
        <p>Mouse CPM testi. 5 ya da 10 saniyede kaç kez tıklayabilirsin? Devir saati kırmızıya dayansın.</p>
        <span class="go">Pite gir →</span>
      </a>
    </section>

    <section class="daily-banner">
      <div>
        <div class="eyebrow">Günlük Grand Prix · sıfırlanmaya <span class="countdown" id="countdown">--:--:--</span></div>
        <h2>Herkese aynı pist</h2>
        <p>Her gün yeni bir metin. Herkes aynı kelimeleri yazar; en hızlı bitiren podyuma çıkar. İstediğin kadar tur at, en iyi zamanın sayılır.</p>
        <a class="btn primary" href="/gunluk-grand-prix">Yarışa katıl</a>
      </div>
      <div class="mini-podium" id="daily-top"><div class="row muted">Yükleniyor…</div></div>
    </section>`;

  let resetsAt = 0, alive = true;
  const cd = $('#countdown', root);
  const timer = setInterval(() => { if (resetsAt) cd.textContent = fmtTime(resetsAt - Date.now()); }, 1000);
  fetchDaily().then((d) => { resetsAt = d.resetsAt; cd.textContent = fmtTime(resetsAt - Date.now()); }).catch(() => {});
  leaderboard('typing-daily-tr', 'day', 3).then(({ rows }) => {
    if (!alive) return;
    $('#daily-top', root).innerHTML = rows.length
      ? rows.map((r) => `<div class="row"><span>P${r.rank} · ${esc(r.name)}</span><b>${Math.round(r.score)} WPM</b></div>`).join('')
      : `<div class="row muted">Bugün henüz bayrak inmedi. İlk sen ol!</div>`;
  }).catch(() => { $('#daily-top', root).innerHTML = '<div class="row muted">Sıralama şu an yüklenemedi.</div>'; });

  return () => { alive = false; clearInterval(timer); };
}

function heroArt() {
  return `
    <div class="hero-logo">
      <img src="/img/logo.png" alt="" width="640" height="296">
      <div class="track"></div>
      <div class="tagline">WPM · MS · CPM</div>
    </div>`;
}

// ---------- pilot license ----------
const dialog = $('#pilot-dialog');
const form = $('#pilot-form');
const nameInput = $('#pilot-name');
const errEl = $('#pilot-error');
const chip = $('#pilot-chip');
let afterRegister = null;

function openRegister(after) {
  afterRegister = after || null;
  errEl.textContent = '';
  form.reset();
  dialog.showModal();
  nameInput.focus();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errEl.textContent = '';
  try {
    const p = await register(nameInput.value.trim());
    dialog.close();
    toast(`Hoş geldin, ${p.name}! Lisansın hazır.`);
    afterRegister?.();
  } catch (err) {
    errEl.textContent = err.message;
  }
});
$('#pilot-cancel').onclick = () => dialog.close();
window.addEventListener('fmq:register', (e) => openRegister(e.detail?.after));

function renderChip(p) {
  chip.textContent = p ? p.name : 'Pilot ol';
  chip.classList.toggle('registered', !!p);
  chip.title = p ? 'Profilin' : 'Sıralamaya girmek için pilot lisansı al';
}
chip.addEventListener('click', () => {
  const p = getPilot();
  if (!p) return openRegister();
  navigate(`/pilot/${encodeURIComponent(p.name)}`);
});
onPilotChange(renderChip);
renderChip(getPilot());
verifyPilot();

window.addEventListener('popstate', route);
window.addEventListener('fmq:navigate', route);
upgradeLegacyHash();
route();
