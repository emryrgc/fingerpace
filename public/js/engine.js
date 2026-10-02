import { esc } from './ui.js';

const wpmFor = (chars, secs) => (secs > 0 ? chars / 5 / (secs / 60) : 0);

// The typing surface shared by Klavye GP, the Daily GP and multiplayer races.
// It owns rendering, caret, key handling and stats; callers own the clock.
//   box:   the .typing-box element (must contain a .words element)
//   opts:  onStart()     first accepted keystroke
//          onComplete()  fixed text typed to the end
//          more()        returns extra words when an endless text runs low
export function createTyper(box, { onStart, onComplete, more } = {}) {
  const wordsEl = box.querySelector('.words');
  let s;

  function load(words) {
    s = { words, typed: [''], cur: 0, keys: 0, goodKeys: 0, started: false, locked: false, done: false };
    wordsEl.innerHTML = words.map(() => '<span class="word"></span>').join('') + '<span class="caret"></span>';
    s.els = [...wordsEl.querySelectorAll('.word')];
    s.caret = wordsEl.querySelector('.caret');
    s.els.forEach((_, i) => renderWord(i));
    wordsEl.style.transform = '';
    box.classList.remove('running');
    requestAnimationFrame(placeCaret);
  }

  function renderWord(i) {
    const word = s.words[i], typed = s.typed[i] || '';
    let html = '';
    for (let j = 0; j < Math.max(word.length, typed.length); j++) {
      if (j >= word.length) html += `<span class="letter extra">${esc(typed[j])}</span>`;
      else {
        const cls = j < typed.length ? (typed[j] === word[j] ? 'correct' : 'incorrect') : '';
        html += `<span class="letter ${cls}">${esc(word[j])}</span>`;
      }
    }
    s.els[i].innerHTML = html;
    s.els[i].classList.toggle('error', i < s.cur && typed !== word);
  }

  function placeCaret() {
    if (!s) return;
    const wordEl = s.els[s.cur];
    const letters = wordEl.children;
    if (!letters.length) return;
    const n = s.typed[s.cur].length;
    const ref = letters[Math.min(n, letters.length - 1)];
    const left = n < letters.length ? ref.offsetLeft : ref.offsetLeft + ref.offsetWidth;
    // centre the caret on the glyph box itself, not on the (taller) line box
    const top = ref.offsetTop + (ref.offsetHeight - s.caret.offsetHeight) / 2;
    const lineH = wordEl.offsetHeight;
    s.caret.style.left = `${left - 1}px`;
    s.caret.style.top = `${top}px`;
    // keep the active word on the second visible line
    wordsEl.style.transform = `translateY(${-Math.max(0, wordEl.offsetTop - lineH)}px)`;
  }

  // Characters typed correctly, counting the space after each correct word.
  function correctChars() {
    let n = 0;
    for (let i = 0; i < s.cur; i++) if (s.typed[i] === s.words[i]) n += s.words[i].length + 1;
    const t = s.typed[s.cur], w = s.words[s.cur];
    if (w.startsWith(t)) n += t.length;
    return n;
  }

  function stats(secs) {
    const typedChars = s.typed.reduce((n, t) => n + t.length, 0) + s.cur;
    return {
      wpm: Math.round(wpmFor(correctChars(), secs) * 100) / 100,
      raw: Math.round(wpmFor(typedChars, secs) * 100) / 100,
      accuracy: s.keys ? Math.round((s.goodKeys / s.keys) * 1000) / 10 : 0,
      errors: s.keys - s.goodKeys
    };
  }

  function complete() {
    s.done = true;
    onComplete?.();
  }

  function appendWords() {
    const extra = more();
    const start = s.words.length;
    s.words.push(...extra);
    s.caret.insertAdjacentHTML('beforebegin', extra.map(() => '<span class="word"></span>').join(''));
    s.els = [...wordsEl.querySelectorAll('.word')];
    for (let i = start; i < s.words.length; i++) renderWord(i);
  }

  // Returns true when the key was consumed.
  function handleKey(e) {
    if (!s || s.locked || s.done) return false;
    if ((e.ctrlKey || e.metaKey || e.altKey) && e.key !== 'Backspace') return false;
    const word = s.words[s.cur];
    let typed = s.typed[s.cur];

    if (e.key === 'Backspace') {
      e.preventDefault();
      if (typed.length === 0) {
        // allow stepping back only into a mistyped word
        if (s.cur > 0 && s.typed[s.cur - 1] !== s.words[s.cur - 1]) {
          s.typed.pop();
          s.cur--;
          renderWord(s.cur);
        }
      } else {
        s.typed[s.cur] = e.ctrlKey || e.altKey ? '' : typed.slice(0, -1);
        renderWord(s.cur);
      }
      placeCaret();
      return true;
    }
    if (e.key.length !== 1) return false;
    e.preventDefault();
    if (!s.started) {
      s.started = true;
      box.classList.add('running');
      onStart?.();
    }

    if (e.key === ' ') {
      if (!typed) return true;
      s.keys++;
      if (typed === word) s.goodKeys++;
      if (s.cur === s.words.length - 1) {
        if (!more) { renderWord(s.cur); complete(); }
        return true;
      }
      s.cur++;
      s.typed.push('');
      renderWord(s.cur - 1);
      if (more && s.cur > s.words.length - 40) appendWords();
      placeCaret();
      return true;
    }

    if (typed.length >= word.length + 8) return true;
    s.keys++;
    if (e.key === word[typed.length]) s.goodKeys++;
    typed += e.key;
    s.typed[s.cur] = typed;
    renderWord(s.cur);
    placeCaret();
    if (!more && s.cur === s.words.length - 1 && typed === word) complete();
    return true;
  }

  return {
    load,
    handleKey,
    correctChars,
    stats,
    placeCaret,
    totalChars: () => s.words.join(' ').length,
    lock: () => { if (s) s.locked = true; },
    unlock: () => { if (s) s.locked = false; },
    get started() { return !!s?.started; },
    get done() { return !!s?.done; }
  };
}
