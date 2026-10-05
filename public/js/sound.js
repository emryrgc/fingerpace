// Synthesised mechanical-keyboard sounds (Web Audio, no audio files).
// Each press = a short filtered noise "click" (switch) + a low decaying "thock" (case),
// with a little random pitch so fast typing doesn't sound like a machine gun.

const PREF_KEY = 'fmq.sound';
let enabled = (() => { try { return localStorage.getItem(PREF_KEY) !== 'off'; } catch { return true; } })();
let ctx, noise;
const listeners = new Set();

export const soundEnabled = () => enabled;

export function setSound(on) {
  enabled = on;
  try { localStorage.setItem(PREF_KEY, on ? 'on' : 'off'); } catch {}
  listeners.forEach((fn) => fn(on));
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

const PROFILES = {
  //        click band (Hz)  click gain  thock (Hz)  thock gain  thock length (s)
  key:   { band: 3200, q: 0.9, click: 0.32, thock: 190, body: 0.22, len: 0.05 },
  space: { band: 1500, q: 0.7, click: 0.30, thock: 120, body: 0.32, len: 0.09 },
  back:  { band: 2600, q: 0.9, click: 0.24, thock: 170, body: 0.16, len: 0.045 },
  error: { band: 900,  q: 1.2, click: 0.26, thock: 140, body: 0.22, len: 0.06 }
};

export function keySound(kind = 'key') {
  if (!enabled) return;
  try {
    const ac = audio();
    if (!ac) return;
    const p = PROFILES[kind] || PROFILES.key;
    const t = ac.currentTime;
    const jitter = 0.88 + Math.random() * 0.24;
    const master = ac.createGain();
    master.gain.value = 0.55;
    master.connect(ac.destination);

    // switch click
    const src = ac.createBufferSource();
    src.buffer = noise;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = p.band * jitter;
    bp.Q.value = p.q;
    const cg = ac.createGain();
    cg.gain.setValueAtTime(p.click, t);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    src.connect(bp).connect(cg).connect(master);
    src.start(t);
    src.stop(t + 0.04);

    // case thock
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(p.thock * jitter, t);
    osc.frequency.exponentialRampToValueAtTime(p.thock * 0.6, t + p.len);
    const og = ac.createGain();
    og.gain.setValueAtTime(p.body, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + p.len);
    osc.connect(og).connect(master);
    osc.start(t);
    osc.stop(t + p.len + 0.01);
  } catch {
    // audio is a nicety; never let it break typing
  }
}

// A small on/off pill; keeps every instance on the page in sync.
export function soundToggle() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sound-toggle';
  const render = (on) => {
    if (btn.dataset.mounted && !btn.isConnected) return listeners.delete(render); // page left
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? 'Klavye sesi: Açık' : 'Klavye sesi: Kapalı';
  };
  render(enabled);
  btn.dataset.mounted = '1';
  btn.addEventListener('click', () => { setSound(!enabled); if (enabled) keySound('key'); });
  listeners.add(render);
  return btn;
}
