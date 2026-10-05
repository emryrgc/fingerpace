import { $, gauge, submitBlock } from './ui.js';
import { localBest, saveLocalBest } from './api.js';

const DURATIONS = [5, 10];

export function mount(root) {
  let seconds = Number(localStorage.getItem('fmq.cpm.seconds')) || 5;
  if (!DURATIONS.includes(seconds)) seconds = 5;

  root.innerHTML = `
    <div class="page-head">
      <div>
        <div class="eyebrow" lang="en">Pit Stop</div>
        <h1>Lastikleri değiştir</h1>
      </div>
      <div class="segmented" data-group="seconds">
        ${DURATIONS.map((s) => `<button type="button" data-value="${s}">${s} sn</button>`).join('')}
      </div>
    </div>
    <section class="panel">
      <div class="pit-layout">
        <div class="pit-pad" tabindex="0" aria-label="Tıklama alanı">
          <div class="wheel"></div>
          <div class="count">0</div>
          <div class="sub"></div>
        </div>
        <div class="side-stats">
          <div class="timer-big">0.0</div>
          <div class="rpm-gauge"></div>
        </div>
      </div>
      <div class="submit-status" style="text-align:center"></div>
      <p class="hint">Tıklamaya başladığın an saat başlar. Devir saati son 1 saniyedeki tıklama hızını gösterir.</p>
    </section>`;

  const pad = $('.pit-pad', root), wheel = $('.wheel', pad);
  const countEl = $('.count', pad), sub = $('.sub', pad);
  const timerEl = $('.timer-big', root), status = $('.submit-status', root);
  const rpm = gauge($('.rpm-gauge', root), { max: 20, unit: 'TIK/SN', redline: 0.65 });
  const seg = $('.segmented', root);

  let phase, clicks, start, stamps, tick, cooldownUntil = 0;

  function syncSeg() {
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.value) === seconds)));
  }

  function reset() {
    clearInterval(tick);
    phase = 'ready';
    clicks = 0; start = 0; stamps = [];
    pad.classList.remove('running', 'done');
    countEl.textContent = '0';
    const pb = localBest(`cpm-${seconds}`);
    sub.textContent = `Başlamak için tıkla${pb ? ` · Rekorun: ${pb} CPM` : ''}`;
    timerEl.textContent = seconds.toFixed(1);
    wheel.style.transform = '';
    rpm.set(0);
  }

  function update() {
    const t = (performance.now() - start) / 1000;
    timerEl.textContent = Math.max(0, seconds - t).toFixed(1);
    const now = performance.now();
    stamps = stamps.filter((x) => now - x < 1000);
    rpm.set(stamps.length);
    if (t >= seconds) finish();
  }

  function finish() {
    clearInterval(tick);
    phase = 'done';
    cooldownUntil = performance.now() + 800; // swallow the clicks still in flight
    pad.classList.remove('running');
    pad.classList.add('done');
    timerEl.textContent = '0.0';
    const cpm = clicks * (60 / seconds);
    const cps = (clicks / seconds).toFixed(2);
    const { improved, prev } = saveLocalBest(`cpm-${seconds}`, cpm);
    countEl.textContent = `${cpm} CPM`;
    sub.textContent = `${clicks} tık · ${cps} tık/sn${improved && prev != null ? ' · YENİ REKOR' : ''} · tekrar için tıkla`;
    submitBlock(status, `cpm-${seconds}`, cpm, { clicks });
  }

  function ripple(e) {
    const r = pad.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.left = `${e.clientX - r.left}px`;
    dot.style.top = `${e.clientY - r.top}px`;
    pad.append(dot);
    dot.addEventListener('animationend', () => dot.remove());
  }

  pad.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    if (phase === 'done') {
      if (performance.now() > cooldownUntil) { status.textContent = ''; reset(); }
      return;
    }
    if (phase === 'ready') {
      phase = 'running';
      start = performance.now();
      pad.classList.add('running');
      sub.textContent = '';
      tick = setInterval(update, 50);
    }
    clicks++;
    stamps.push(performance.now());
    countEl.textContent = clicks;
    wheel.style.transform = `rotate(${clicks * 36}deg)`;
    ripple(e);
  });
  pad.addEventListener('contextmenu', (e) => e.preventDefault());

  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || phase === 'running') return;
    seconds = Number(b.dataset.value);
    try { localStorage.setItem('fmq.cpm.seconds', String(seconds)); } catch {}
    status.textContent = '';
    syncSeg();
    reset();
  });

  syncSeg();
  reset();
  return () => clearInterval(tick);
}
