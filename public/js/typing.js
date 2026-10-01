import { generateWords, dailyWords, dailyKey } from './words.js';
import { $, gauge, carSvg, submitBlock, toast } from './ui.js';
import { createTyper } from './engine.js';
import { localBest, saveLocalBest } from './api.js';

const PREF_KEY = 'fmq.typing';
const DURATIONS = [15, 30, 60];
const LANG_LABELS = { tr: 'Türkçe', en: 'English' };

function loadPrefs() {
  try { return { seconds: 30, lang: 'tr', ...JSON.parse(localStorage.getItem(PREF_KEY)) }; } catch { return { seconds: 30, lang: 'tr' }; }
}

export function mount(root, { daily = false } = {}) {
  const prefs = loadPrefs();
  const day = dailyKey();

  root.innerHTML = `
    <div class="page-head">
      <div>
        <div class="eyebrow">${daily ? `Günlük Grand Prix · ${day}` : 'Klavye GP'}</div>
        <h1>${daily ? 'Bugünün pisti' : 'Tuşlara bas, gaza bas'}</h1>
      </div>
      <div class="controls">
        ${daily ? '' : `<div class="segmented" data-group="seconds">
          ${DURATIONS.map((s) => `<button type="button" data-value="${s}">${s} sn</button>`).join('')}
        </div>`}
        <div class="segmented" data-group="lang">
          ${Object.entries(LANG_LABELS).map(([k, v]) => `<button type="button" data-value="${k}">${v}</button>`).join('')}
        </div>
      </div>
    </div>
    <div class="race-strip" aria-hidden="true">
      <div class="finish"></div>
      <span class="lane-label top">HAYALET</span><span class="lane-label bottom">SEN</span>
      <div class="car ghost">${carSvg('#9aa3b5')}</div>
      <div class="car me">${carSvg()}</div>
    </div>
    <section class="panel" id="arena">
      <div class="typing-layout">
        <div>
          <div class="typing-box blurred" tabindex="0" aria-label="Yazma alanı">
            <div class="focus-msg">Odaklanmak için tıkla veya herhangi bir tuşa bas</div>
            <div class="words" style="position:relative"></div>
          </div>
          <p class="hint"><kbd>Tab</kbd> yeniden başlat · ${daily ? 'Metni hatasız bitir, bayrağı gör.' : 'İlk tuşla saat başlar.'}</p>
        </div>
        <div class="side-stats">
          <div class="timer-big">0</div>
          <div class="wpm-gauge"></div>
        </div>
      </div>
    </section>
    <section class="panel" id="result" hidden></section>`;

  const box = $('.typing-box', root);
  const timerEl = $('.timer-big', root);
  const meCar = $('.car.me', root), ghostCar = $('.car.ghost', root), strip = $('.race-strip', root);
  const arena = $('#arena', root), resultEl = $('#result', root);
  const wpmGauge = gauge($('.wpm-gauge', root), { max: 160, unit: 'WPM' });

  let tick, startAt = 0, ended = false, ghostWpm = 45;
  const typer = createTyper(box, {
    onStart: begin,
    onComplete: finish,
    more: daily ? null : () => generateWords(prefs.lang, 100)
  });

  const testKey = () => (daily ? `typing-daily-${prefs.lang}` : `typing-${prefs.seconds}-${prefs.lang}`);

  function syncControls() {
    root.querySelectorAll('.segmented').forEach((seg) => {
      const val = String(prefs[seg.dataset.group]);
      seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === val)));
    });
  }

  function reset() {
    clearInterval(tick);
    startAt = 0;
    ended = false;
    ghostWpm = localBest(testKey()) || 45;
    typer.load(daily ? dailyWords(day, prefs.lang) : generateWords(prefs.lang, 250));
    timerEl.textContent = daily ? '0.0' : prefs.seconds;
    wpmGauge.set(0);
    moveCars(0, 0);
    arena.hidden = false;
    resultEl.hidden = true;
  }

  const elapsed = () => (startAt ? (performance.now() - startAt) / 1000 : 0);

  function moveCars(meChars, secs) {
    const track = strip.clientWidth - 64 - 70;
    const ghostChars = (ghostWpm * 5 * secs) / 60;
    const total = daily ? typer.totalChars() : (ghostWpm * 5 * prefs.seconds) / 60;
    const pos = (c) => Math.min(1, c / total) * track;
    meCar.style.transform = `translateX(${pos(meChars)}px)`;
    ghostCar.style.transform = `translateX(${pos(ghostChars)}px)`;
  }

  function begin() {
    startAt = performance.now();
    tick = setInterval(update, 100);
  }

  function update() {
    const t = elapsed();
    const chars = typer.correctChars();
    if (daily) timerEl.textContent = t.toFixed(1);
    else timerEl.textContent = Math.max(0, Math.ceil(prefs.seconds - t));
    if (t > 0.5) wpmGauge.set(chars / 5 / (t / 60));
    moveCars(chars, t);
    if (!daily && t >= prefs.seconds) finish();
  }

  function onKey(e) {
    if (e.key === 'Tab') { e.preventDefault(); reset(); return; }
    if (!ended) typer.handleKey(e);
  }

  function finish() {
    if (ended) return;
    ended = true;
    clearInterval(tick);
    typer.lock();
    const secs = daily ? elapsed() : prefs.seconds;
    moveCars(typer.correctChars(), secs);
    showResult({ ...typer.stats(secs), secs });
  }

  function showResult({ wpm, raw, accuracy, errors, secs }) {
    const test = testKey();
    const eligible = accuracy >= 75 && wpm >= 1;
    const { improved, prev } = eligible ? saveLocalBest(test, wpm) : { improved: false, prev: localBest(test) };
    arena.hidden = true;
    resultEl.hidden = false;
    resultEl.innerHTML = `
      <div class="result">
        <div class="result-big">${Math.round(wpm)}<small>WPM${improved && prev != null ? ' · YENİ REKOR 🏆' : ''}</small></div>
        <div>
          <div class="stat-grid">
            <div class="stat"><span>Doğruluk</span><b>%${accuracy}</b></div>
            <div class="stat"><span>Ham hız</span><b>${Math.round(raw)}</b></div>
            <div class="stat"><span>Hata</span><b>${errors}</b></div>
            <div class="stat"><span>Süre</span><b>${secs.toFixed(daily ? 2 : 0)} sn</b></div>
            <div class="stat"><span>Kişisel rekor</span><b>${Math.round(Math.max(wpm, prev || 0))}</b></div>
          </div>
          <div class="submit-status"></div>
          <div class="result-actions">
            <button class="btn primary" data-action="again">${daily ? 'Tekrar dene' : 'Yeni tur'} <kbd>Tab</kbd></button>
            <a class="btn ghost" href="#/leaderboard/${test}">Sıralama</a>
          </div>
        </div>
      </div>`;
    $('[data-action=again]', resultEl).onclick = reset;
    const status = $('.submit-status', resultEl);
    if (!eligible) status.textContent = 'Sıralama için en az %75 doğruluk gerekiyor. Hız güzel ama pist dışına çıktın!';
    else submitBlock(status, test, wpm, daily ? { accuracy, time: Math.round(secs * 100) / 100, day } : { accuracy, raw });
  }

  root.querySelectorAll('.segmented').forEach((seg) => {
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const g = seg.dataset.group;
      prefs[g] = g === 'seconds' ? Number(b.dataset.value) : b.dataset.value;
      try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch {}
      syncControls();
      reset();
      box.focus();
    });
  });

  box.addEventListener('keydown', onKey);
  box.addEventListener('focus', () => box.classList.remove('blurred'));
  box.addEventListener('blur', () => box.classList.add('blurred'));
  box.addEventListener('click', () => box.focus());

  const globalKey = (e) => {
    if (document.activeElement === box || e.target.closest?.('input, textarea, dialog')) return;
    if (e.key === 'Tab' && !resultEl.hidden) { e.preventDefault(); reset(); box.focus(); return; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && resultEl.hidden) {
      box.focus();
      onKey(e);
    }
  };
  window.addEventListener('keydown', globalKey);
  const onResize = () => !ended && typer.placeCaret();
  window.addEventListener('resize', onResize);

  syncControls();
  reset();
  box.focus();
  if (matchMedia('(pointer: coarse)').matches) toast('Klavye GP fiziksel klavyeyle en iyi sonucu verir.');

  return () => {
    clearInterval(tick);
    window.removeEventListener('keydown', globalKey);
    window.removeEventListener('resize', onResize);
  };
}
