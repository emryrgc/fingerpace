import { $, submitBlock } from './ui.js';
import { localBest, saveLocalBest } from './api.js';

const ATTEMPTS = 5;
const LIGHT_INTERVAL = 900;

export function mount(root) {
  root.innerHTML = `
    <div class="page-head">
      <div>
        <div class="eyebrow">Start Işıkları</div>
        <h1>Işıklar sönünce kalk</h1>
      </div>
      <p class="muted" style="max-width:38ch;margin:0">Beş kırmızı ışık tek tek yanar. Hepsi söndüğü an tıkla ya da <kbd>Boşluk</kbd>'a bas. Erken kalkış = ceza. ${ATTEMPTS} start, ortalaman yazılır.</p>
    </div>
    <section class="lights-stage" tabindex="0" aria-label="Start ışıkları — tıkla veya boşluk tuşuna bas">
      <div class="gantry">
        ${Array.from({ length: 5 }, () => `<div class="light-pod"><div class="bulb"></div><div class="bulb lit"></div></div>`).join('')}
      </div>
      <div class="stage-msg" aria-live="polite"></div>
      <div class="attempts"></div>
    </section>
    <div class="submit-status" style="text-align:center"></div>`;

  const stage = $('.lights-stage', root);
  const pods = [...root.querySelectorAll('.light-pod')];
  const msg = $('.stage-msg', root);
  const attemptsEl = $('.attempts', root);
  const status = $('.submit-status', root);
  let phase = 'idle'; // idle | arming | go | result | done
  let results = [];
  let timers = [];
  let goAt = 0;

  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const setMsg = (big, cls = '', sub = '') => {
    msg.innerHTML = `<div class="big ${cls}">${big}</div>${sub ? `<div class="muted">${sub}</div>` : ''}`;
  };

  function renderAttempts() {
    const best = results.length ? Math.min(...results) : null;
    attemptsEl.innerHTML = Array.from({ length: ATTEMPTS }, (_, i) => {
      const r = results[i];
      return `<div class="attempt ${r != null ? 'done' : ''} ${r === best ? 'best' : ''}">${r != null ? `${r} ms` : `#${i + 1}`}</div>`;
    }).join('');
  }

  function idle() {
    phase = 'idle';
    pods.forEach((p) => p.classList.remove('on'));
    stage.classList.remove('go');
    const pb = localBest('reflex');
    setMsg('Hazır mısın?', '', `Başlamak için tıkla${pb ? ` · Rekorun: ${pb} ms` : ''}`);
    renderAttempts();
  }

  function arm() {
    phase = 'arming';
    stage.classList.remove('go');
    pods.forEach((p) => p.classList.remove('on'));
    setMsg('Bekle…', '', 'Işıklar yanıyor');
    pods.forEach((p, i) => timers.push(setTimeout(() => p.classList.add('on'), LIGHT_INTERVAL * (i + 1))));
    const hold = 200 + Math.random() * 2800; // F1-style random hold after the fifth light
    timers.push(setTimeout(() => {
      pods.forEach((p) => p.classList.remove('on'));
      stage.classList.add('go');
      goAt = performance.now();
      phase = 'go';
      setMsg('GAZ!', 'green');
    }, LIGHT_INTERVAL * 5 + hold));
  }

  function press() {
    if (phase === 'idle' || phase === 'result') return arm();
    if (phase === 'arming') {
      clearTimers();
      phase = 'result';
      pods.forEach((p) => p.classList.add('on'));
      setMsg('Erken kalkış!', 'red', 'Bu start sayılmadı. Tekrar denemek için tıkla.');
      return;
    }
    if (phase === 'go') {
      const rt = Math.round(performance.now() - goAt);
      results.push(rt);
      renderAttempts();
      if (results.length < ATTEMPTS) {
        phase = 'result';
        setMsg(`${rt} ms`, '', `Start ${results.length}/${ATTEMPTS} · devam etmek için tıkla`);
      } else complete();
      return;
    }
    if (phase === 'done') { results = []; status.textContent = ''; idle(); }
  }

  function complete() {
    phase = 'done';
    const avg = Math.round(results.reduce((a, b) => a + b, 0) / results.length);
    const best = Math.min(...results);
    const { improved, prev } = saveLocalBest('reflex', avg, 'low');
    setMsg(`${avg} ms`, 'green', `Ortalama · en iyi start ${best} ms${improved && prev != null ? ' · YENİ REKOR 🏆' : ''} · yeni seri için tıkla`);
    submitBlock(status, 'reflex', avg, { best, attempts: results.length, runs: results });
  }

  const onPointer = (e) => { if (e.button === 0 || e.pointerType !== 'mouse') { e.preventDefault(); press(); } };
  const onKey = (e) => {
    if (e.target.closest?.('input, textarea, dialog, a, button')) return;
    if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) press(); }
  };
  stage.addEventListener('pointerdown', onPointer);
  window.addEventListener('keydown', onKey);
  idle();
  stage.focus();

  return () => {
    clearTimers();
    window.removeEventListener('keydown', onKey);
  };
}
