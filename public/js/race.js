import { $, esc, carSvg, gauge, toast } from './ui.js';
import { getPilot } from './api.js';
import { createTyper } from './engine.js';
import { soundToggle } from './sound.js';
import { setPath } from './nav.js';
import { PATHS } from './pages.js';

const CAR_COLORS = ['#3fb489', '#d6a85c', '#6fa8dc', '#e2654f', '#b7a3e0'];
const COUNTDOWN_LIGHTS = 5;

export function mount(root, { code } = {}) {
  const pilot = getPilot();
  if (!pilot) {
    root.innerHTML = `
      <div class="page-head"><div><div class="eyebrow">Canlı yarış</div><h1>Yarış odası</h1></div></div>
      <div class="panel empty-state">
        <p>Diğer pilotlarla kafa kafaya yarışmak için önce bir pilot lisansı al. Şifre yok, 5 saniye sürer.</p>
        <button class="btn primary" data-action="register">Pilot lisansı al</button>
      </div>`;
    $('[data-action=register]', root).onclick = () => window.dispatchEvent(new CustomEvent('fmq:register', {
      detail: { after: () => window.dispatchEvent(new Event('fmq:navigate')) }
    }));
    return;
  }

  root.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Canlı yarış · en fazla 5 pilot</div><h1>Yarış odası</h1></div>
      <div class="room-code" hidden>
        <span class="muted">Oda kodu</span><b class="code"></b>
        <button class="btn ghost" data-action="copy">Davet linkini kopyala</button>
      </div>
    </div>

    <section class="race-menu" hidden>
      <div class="cards">
        <div class="card">
          <h3>Hızlı yarış</h3>
          <p>Bekleyen pilotlarla eşleş. İki pilot olunca 8 saniye içinde ışıklar yanar.</p>
          <button class="btn primary go-btn" data-action="quick">Eşleş</button>
        </div>
        <div class="card">
          <h3>Özel oda</h3>
          <p>Bir oda kur, kodu ya da linki arkadaşlarına gönder. Yarışı sen başlatırsın.</p>
          <button class="btn primary go-btn" data-action="create">Oda kur</button>
        </div>
        <form class="card join-form">
          <h3>Koda katıl</h3>
          <p>Arkadaşının verdiği 5 haneli kodu gir.</p>
          <div class="join-row">
            <input name="code" maxlength="5" autocomplete="off" spellcheck="false" placeholder="ABC12" aria-label="Oda kodu">
            <button class="btn primary">Katıl</button>
          </div>
        </form>
      </div>
    </section>

    <section class="race-room" hidden>
      <div class="room-bar">
        <div class="room-status" aria-live="polite"></div>
        <div class="controls">
          <button class="btn primary" data-action="start" hidden>Yarışı başlat</button>
          <button class="btn primary" data-action="requeue" hidden>Yeni hızlı yarış</button>
          <button class="btn ghost" data-action="leave">Odadan çık</button>
        </div>
      </div>
      <div class="race-lanes"></div>
      <section class="panel race-panel">
        <div class="race-lights" hidden>
          <div class="gantry">${'<div class="light-pod"><div class="bulb"></div><div class="bulb lit"></div></div>'.repeat(COUNTDOWN_LIGHTS)}</div>
        </div>
        <div class="race-results" hidden></div>
        <div class="typing-layout race-typing">
          <div>
            <div class="typing-box blurred" tabindex="0" aria-label="Yarış metni">
              <div class="focus-msg">Odaklanmak için tıkla</div>
              <div class="words" style="position:relative"></div>
            </div>
            <p class="hint race-hint"></p>
          </div>
          <div class="side-stats">
            <div class="timer-big">0.0</div>
            <div class="wpm-gauge"></div>
          </div>
        </div>
      </section>
    </section>

    <div class="panel empty-state race-msg" hidden></div>`;

  const menu = $('.race-menu', root), roomEl = $('.race-room', root), msgEl = $('.race-msg', root);
  const codeBox = $('.room-code', root), statusEl = $('.room-status', root), lanesEl = $('.race-lanes', root);
  const lightsEl = $('.race-lights', root), resultsEl = $('.race-results', root), typingEl = $('.race-typing', root);
  const box = $('.typing-box', root), timerEl = $('.timer-big', root), hintEl = $('.race-hint', root);
  const focusMsg = $('.focus-msg', box);
  $('.room-bar .controls', root).prepend(soundToggle());
  const btn = (a) => $(`[data-action=${a}]`, root);
  const wpmGauge = gauge($('.wpm-gauge', root), { max: 160, unit: 'WPM' });

  let ws, room = null, alive = true;
  let loadedRace = 0, goLocal = 0, racing = false, finished = false, lastSent = -1;
  let laneKey = '', autoDeadline = 0;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };

  const typer = createTyper(box, {
    onComplete() {
      finished = true;
      typer.lock();
      sendProgress(true);
      send({ type: 'finish', accuracy: typer.stats(1).accuracy });
    }
  });

  // ---------- connection ----------
  function connect() {
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    ws.onopen = () => send({ type: 'hello', token: pilot.token });
    ws.onmessage = (e) => onMessage(JSON.parse(e.data));
    ws.onclose = () => {
      if (!alive) return;
      showMessage('Bağlantı koptu.', 'Yeniden bağlan', () => { msgEl.hidden = true; connect(); });
    };
  }
  const send = (msg) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg));

  function onMessage(msg) {
    if (msg.type === 'welcome') {
      if (code) send({ type: 'join', code });
      else showMenu();
    } else if (msg.type === 'room') onRoom(msg.room);
    else if (msg.type === 'error') {
      if (msg.fatal) return showMessage(msg.message);
      toast(msg.message);
      if (!room) showMenu();
    } else if (msg.type === 'left' || msg.type === 'closed') {
      room = null;
      showMenu();
    }
  }

  // ---------- screens ----------
  function showMenu() {
    room = null;
    code = null;
    stopRace();
    setPath(PATHS.race);
    menu.hidden = false;
    roomEl.hidden = true;
    codeBox.hidden = true;
  }

  function showMessage(text, action, onAction) {
    menu.hidden = true;
    roomEl.hidden = true;
    msgEl.hidden = false;
    msgEl.innerHTML = `<p>${esc(text)}</p>${action ? `<button class="btn primary">${esc(action)}</button>` : ''}`;
    if (action) msgEl.querySelector('button').onclick = onAction;
  }

  function onRoom(r) {
    room = r;
    code = r.code;
    setPath(`${PATHS.race}/${r.code}`);
    menu.hidden = true;
    msgEl.hidden = true;
    roomEl.hidden = false;
    codeBox.hidden = r.isPublic;
    $('.code', codeBox).textContent = r.code;

    const me = r.players.find((p) => p.name === pilot.name);
    const amHost = r.host === pilot.name;

    if ((r.state === 'countdown' || r.state === 'racing') && r.raceNo !== loadedRace && me?.racing) {
      prepareRace(r);
    }
    if (r.state === 'lobby' || r.state === 'results') stopRace();

    autoDeadline = r.autoStartIn != null ? performance.now() + r.autoStartIn : 0;
    renderLanes(r);
    renderStatus(r, me, amHost);

    btn('start').hidden = r.isPublic || !amHost || !['lobby', 'results'].includes(r.state);
    btn('start').textContent = r.state === 'results' ? 'Rövanş!' : 'Yarışı başlat';
    btn('requeue').hidden = !r.isPublic || r.state !== 'results';
    resultsEl.hidden = r.state !== 'results';
    const participant = me && (me.racing || me.place || me.dnf);
    typingEl.hidden = r.state === 'results' || r.state === 'lobby' || !participant;
    lightsEl.hidden = r.state !== 'countdown';
    if (r.state === 'results') renderResults(r);
  }

  function renderStatus(r, me, amHost) {
    const n = r.players.length;
    const spectating = r.state === 'racing' && !me?.racing && !me?.place && !me?.dnf;
    let text;
    if (r.state === 'lobby') {
      if (r.isPublic) text = autoDeadline ? `Işıklar <b class="auto-left"></b> sn içinde yanıyor` : 'Rakip bekleniyor… <span class="muted">(en az 2 pilot)</span>';
      else if (amHost) text = n < 2 ? 'Kodu paylaş ve rakiplerini bekle — istersen tek başına da başlatabilirsin.' : `${n} pilot hazır. Başlatmak sende!`;
      else text = `Oda sahibi <b>${esc(r.host)}</b> yarışı başlatacak.`;
    } else if (r.state === 'countdown') text = 'Işıklara dikkat! Söndüğü an yaz.';
    else if (r.state === 'racing') text = spectating ? 'Bu yarışı izliyorsun — bir sonrakine katılacaksın.' : finished ? 'Bayrağı gördün! Diğerleri bekleniyor…' : 'GAZ!';
    else text = 'Yarış bitti!';
    statusEl.innerHTML = text;
    hintEl.textContent = spectating ? '' : 'Metnin tamamını doğru yazınca bitirirsin. Yanlış kelimeler seni durdurur.';
    updateAuto();
  }

  function updateAuto() {
    const el = $('.auto-left', statusEl);
    if (el && autoDeadline) el.textContent = Math.max(0, Math.ceil((autoDeadline - performance.now()) / 1000));
  }

  function renderLanes(r) {
    const key = r.players.map((p) => p.name).join('|');
    if (key !== laneKey) {
      laneKey = key;
      lanesEl.innerHTML = r.players.map((p, i) => `
        <div class="lane ${p.name === pilot.name ? 'me' : ''}" data-name="${esc(p.name)}">
          <span class="lane-name">${esc(p.name)}${p.name === r.host && !r.isPublic ? ' <small class="muted">· oda sahibi</small>' : ''}</span>
          <div class="car">${carSvg(CAR_COLORS[i % CAR_COLORS.length])}</div>
          <span class="lane-tag"></span>
        </div>`).join('') + '<div class="finish"></div>';
    }
    const total = r.total || 1;
    r.players.forEach((p) => {
      const lane = lanesEl.querySelector(`.lane[data-name="${CSS.escape(p.name)}"]`);
      if (!lane) return;
      const track = lane.clientWidth - 64 - 70;
      const progress = r.state === 'lobby' ? 0 : p.chars / total;
      lane.querySelector('.car').style.transform = `translateX(${progress * track}px)`;
      const tag = lane.querySelector('.lane-tag');
      tag.textContent = p.place ? `P${p.place} · ${Math.round(p.wpm)} WPM` : p.dnf ? 'DNF' : r.state === 'racing' && !p.racing ? 'izliyor' : '';
      tag.className = `lane-tag ${p.place === 1 ? 'gold' : ''}`;
    });
  }

  function renderResults(r) {
    const ordered = [...r.players].filter((p) => p.place || p.dnf).sort((a, b) => (a.place || 99) - (b.place || 99));
    const counted = ordered.length >= 2;
    resultsEl.innerHTML = `
      <h2 class="results-title">Damalı bayrak</h2>
      <ol class="grid-list">${ordered.map((p) => `
        <li class="${p.name === pilot.name ? 'me' : ''}">
          <span class="pos">${p.place ? `P${p.place}` : 'DNF'}</span>
          <span class="name"><a href="/pilot/${encodeURIComponent(p.name)}">${esc(p.name)}</a></span>
          <span class="extra">${p.accuracy != null ? `%${p.accuracy}` : ''}</span>
          <span class="sc">${p.wpm ? `${Math.round(p.wpm)} WPM` : '—'}</span>
        </li>`).join('')}</ol>
      <p class="hint">${counted ? 'Sonuçlar pilot profillerine işlendi.' : 'Tek başına yarışlar profile işlenmez — bir rakip bul!'}</p>`;
  }

  // ---------- the race itself ----------
  function prepareRace(r) {
    stopRace();
    loadedRace = r.raceNo;
    finished = false;
    lastSent = -1;
    typer.load(r.words);
    typer.lock();
    focusMsg.textContent = 'Işıklar sönünce yazmaya başla';
    wpmGauge.set(0);
    timerEl.textContent = '0.0';
    goLocal = performance.now() + (r.startsIn ?? -r.elapsed);
    racing = true;
    for (let i = 0; i < COUNTDOWN_LIGHTS; i++) {
      const at = goLocal - (COUNTDOWN_LIGHTS - i) * 1000 - performance.now();
      later(() => lightsEl.querySelectorAll('.light-pod')[i].classList.add('on'), Math.max(0, at));
    }
    later(go, Math.max(0, goLocal - performance.now()));
  }

  function go() {
    lightsEl.querySelectorAll('.light-pod').forEach((p) => p.classList.remove('on'));
    lightsEl.hidden = true;
    focusMsg.textContent = 'Odaklanmak için tıkla';
    typer.unlock();
    box.focus();
    const tick = setInterval(() => {
      if (!racing) return clearInterval(tick);
      const secs = (performance.now() - goLocal) / 1000;
      if (!finished) {
        timerEl.textContent = secs.toFixed(1);
        if (secs > 0.5) wpmGauge.set(typer.correctChars() / 5 / (secs / 60));
        sendProgress();
      }
    }, 200);
  }

  function sendProgress(force) {
    const chars = typer.correctChars();
    if (chars !== lastSent || force) {
      lastSent = chars;
      send({ type: 'progress', chars });
    }
  }

  function stopRace() {
    racing = false;
    timers.forEach(clearTimeout);
    timers.clear();
    typer.lock();
    lightsEl.querySelectorAll('.light-pod').forEach((p) => p.classList.remove('on'));
  }

  // ---------- wiring ----------
  btn('quick').onclick = () => send({ type: 'quick' });
  btn('requeue').onclick = () => { send({ type: 'leave' }); send({ type: 'quick' }); };
  btn('create').onclick = () => send({ type: 'create' });
  btn('start').onclick = () => send({ type: 'start' });
  btn('leave').onclick = () => send({ type: 'leave' });
  btn('copy').onclick = async () => {
    const link = `${location.origin}${PATHS.race}/${room?.code}`;
    try { await navigator.clipboard.writeText(link); toast('Davet linki kopyalandı!'); } catch { prompt('Davet linki:', link); }
  };
  $('.join-form', root).addEventListener('submit', (e) => {
    e.preventDefault();
    const c = e.target.code.value.trim().toUpperCase();
    if (c.length === 5) send({ type: 'join', code: c });
  });

  box.addEventListener('keydown', (e) => typer.handleKey(e));
  box.addEventListener('focus', () => box.classList.remove('blurred'));
  box.addEventListener('blur', () => box.classList.add('blurred'));
  box.addEventListener('click', () => box.focus());
  const globalKey = (e) => {
    if (!racing || document.activeElement === box || e.target.closest?.('input, textarea, dialog')) return;
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { box.focus(); typer.handleKey(e); }
  };
  window.addEventListener('keydown', globalKey);
  const autoTimer = setInterval(updateAuto, 250);
  const onResize = () => { laneKey = ''; if (room) renderLanes(room); typer.placeCaret(); };
  window.addEventListener('resize', onResize);

  connect();

  return () => {
    alive = false;
    stopRace();
    clearInterval(autoTimer);
    window.removeEventListener('keydown', globalKey);
    window.removeEventListener('resize', onResize);
    ws?.close();
  };
}
