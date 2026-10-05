import { $, submitBlock } from './ui.js';
import { localBest, saveLocalBest } from './api.js';

const LIGHT_INTERVAL = 900;
const MIN_HUMAN_MS = 100; // faster than this is anticipation, not reaction (as in F1)

// Every start is its own game: lights → reaction → result. The best one is the record.
export function mount(root) {
  root.innerHTML = `
    <div class="page-head">
      <div>
        <div class="eyebrow">Start Işıkları</div>
        <h1>Işıklar sönünce kalk</h1>
      </div>
      <p class="muted" style="max-width:38ch;margin:0">Beş kırmızı ışık tek tek yanar. Hepsi söndüğü an tıkla. En iyi tepki süren sıralamaya girer.</p>
    </div>
    <section class="lights-stage" tabindex="0" aria-label="Start ışıkları — ışıklar sönünce tıkla">
      <div class="gantry">
        ${Array.from({ length: 5 }, () => `<div class="light-pod"><div class="bulb"></div><div class="bulb lit"></div></div>`).join('')}
      </div>
      <div class="stage-msg" aria-live="polite"></div>
      <div class="record"></div>
    </section>
    <div class="submit-status" style="text-align:center"></div>`;

  const stage = $('.lights-stage', root);
  const pods = [...root.querySelectorAll('.light-pod')];
  const msg = $('.stage-msg', root);
  const recordEl = $('.record', root);
  const status = $('.submit-status', root);
  let phase = 'idle'; // idle | arming | go | result
  let timers = [];
  let goAt = 0;

  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const setMsg = (big, cls = '', sub = '') => {
    msg.innerHTML = `<div class="big ${cls}">${big}</div>${sub ? `<div class="muted">${sub}</div>` : ''}`;
  };
  const renderRecord = () => {
    const pb = localBest('reflex');
    recordEl.innerHTML = pb ? `Rekorun <b>${pb} ms</b>` : '';
  };

  function idle() {
    phase = 'idle';
    pods.forEach((p) => p.classList.remove('on'));
    stage.classList.remove('go');
    setMsg('Hazır mısın?', '', 'Başlamak için tıkla');
    renderRecord();
  }

  function arm() {
    clearTimers();
    phase = 'arming';
    status.textContent = '';
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

  function tooEarly(detail) {
    clearTimers();
    phase = 'result';
    stage.classList.remove('go');
    pods.forEach((p) => p.classList.add('on'));
    setMsg('Erken kalktın', 'red', `${detail} Tekrar denemek için tıkla.`);
  }

  function press() {
    if (phase === 'idle' || phase === 'result') return arm();
    if (phase === 'arming') return tooEarly('Işıklar sönmeden bastın.');
    if (phase !== 'go') return;
    const rt = Math.round(performance.now() - goAt);
    if (rt < MIN_HUMAN_MS) return tooEarly(`${rt} ms — ışığı görmeden basmışsın.`);
    phase = 'result';
    const { improved, prev } = saveLocalBest('reflex', rt, 'low');
    setMsg(`${rt} ms`, 'green', `${improved && prev != null ? 'Yeni rekor! · ' : ''}Tekrar denemek için tıkla`);
    renderRecord();
    submitBlock(status, 'reflex', rt, {});
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
