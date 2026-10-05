import { getPilot, submitScore } from './api.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer;
export function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

export const carSvg = (color = '#3fb489') => `
  <svg viewBox="0 0 64 28" aria-hidden="true">
    <rect x="2" y="2" width="8" height="24" rx="2" fill="#111"/>
    <rect x="6" y="11" width="44" height="7" rx="3" fill="${color}"/>
    <path d="M18 8 h18 l8 6 v1 h-34z" fill="${color}"/>
    <path d="M24 9 h8 l4 4 h-12z" fill="#0d0e11"/>
    <rect x="50" y="4" width="10" height="20" rx="2" fill="${color}"/>
    <rect x="12" y="0" width="10" height="7" rx="2" fill="#111"/><rect x="12" y="21" width="10" height="7" rx="2" fill="#111"/>
    <rect x="38" y="0" width="10" height="7" rx="2" fill="#111"/><rect x="38" y="21" width="10" height="7" rx="2" fill="#111"/>
  </svg>`;

// A 240° dial. Arc and ticks are drawn once; only the needle moves.
export function gauge(el, { max, unit, redline = 0.8 }) {
  const cx = 100, cy = 100, r = 84, start = -210, sweep = 240;
  const pt = (deg, rad) => {
    const a = (deg * Math.PI) / 180;
    return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  };
  const arc = (from, to, rad) => {
    const [x1, y1] = pt(from, rad), [x2, y2] = pt(to, rad);
    return `M${x1} ${y1} A${rad} ${rad} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  };
  let ticks = '';
  for (let i = 0; i <= 10; i++) {
    const d = start + (sweep * i) / 10;
    const [x1, y1] = pt(d, r - 2), [x2, y2] = pt(d, r - (i % 5 ? 10 : 16));
    ticks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${i / 10 >= redline ? '#e2654f' : '#8e959c'}" stroke-width="${i % 5 ? 2 : 3}"/>`;
  }
  el.classList.add('gauge');
  el.innerHTML = `
    <svg viewBox="0 0 200 170">
      <path d="${arc(start, start + sweep, r)}" fill="none" stroke="#22262e" stroke-width="10" stroke-linecap="round"/>
      <path d="${arc(start + sweep * redline, start + sweep, r)}" fill="none" stroke="#5a2a22" stroke-width="10" stroke-linecap="round"/>
      <path class="fill" d="" fill="none" stroke="#d6a85c" stroke-width="10" stroke-linecap="round"/>
      ${ticks}
      <g class="needle"><line x1="100" y1="100" x2="100" y2="34" stroke="#f1efe8" stroke-width="3" stroke-linecap="round"/></g>
      <circle cx="100" cy="100" r="7" fill="#f1efe8"/>
    </svg>
    <div class="value"><span class="v">0</span><span class="unit">${unit}</span></div>`;
  const needle = el.querySelector('.needle'), fill = el.querySelector('.fill'), v = el.querySelector('.v');
  const set = (value) => {
    const f = Math.max(0, Math.min(1, value / max));
    needle.style.transform = `rotate(${-120 + 240 * f}deg)`;
    fill.setAttribute('d', f > 0.005 ? arc(start, start + sweep * f, r) : '');
    v.textContent = Math.round(value);
  };
  set(0);
  return { set };
}

// Shared result footer: auto-submits for registered pilots, nudges guests.
export async function submitBlock(el, test, score, details) {
  const pilot = getPilot();
  if (!pilot) {
    el.innerHTML = `Sıralamaya girmek için <button class="btn ghost" data-action="register">Pilot lisansı al</button>`;
    el.querySelector('[data-action=register]').onclick = () =>
      window.dispatchEvent(new CustomEvent('fmq:register', { detail: { after: () => submitBlock(el, test, score, details) } }));
    return;
  }
  el.textContent = 'Sonuç yarış kontrolüne gönderiliyor…';
  try {
    const r = await submitScore(test, score, details);
    const parts = [];
    if (r.day) parts.push(`bugün <span class="rank">P${r.day.rank}</span>`);
    if (r.week) parts.push(`bu hafta <span class="rank">P${r.week.rank}</span>`);
    if (r.all) parts.push(`tüm zamanlar <span class="rank">P${r.all.rank}</span>`);
    el.innerHTML = `Kaydedildi — ${parts.join(' · ')} <a href="/siralama/${test}">Sıralamayı gör →</a>`;
  } catch (e) {
    el.textContent = e.message;
  }
}

export function fmtTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
