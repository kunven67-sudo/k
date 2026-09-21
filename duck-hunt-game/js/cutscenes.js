// Dialogue box, choice prompts, banners and fade/glitch transitions.
// Pure DOM overlay logic - the 3D scenes call into this, never the other way around.
import { playDialogueBlip, playUIClick, playUIHover, playGlitchWhoosh } from './audio.js';
import { triggerDomGlitch } from './utils.js';

// The opening "TV ad" - a stylized, entirely original parody commercial. Deliberately not a
// recreation of any real hunting-game's box art or ad copy; the $19.99 price gag is the only
// nod to that trope and it only ever appears as spoken/subtitle text here, never as rendered
// packaging.
const COMMERCIAL_LINES = [
  "IT'S DUCK SEASON, KID.",
  'GRAB A SHOTGUN. GRAB YOUR COURAGE. GRAB THE COUCH CUSHIONS, JUST IN CASE.',
  'FIVE ROUNDS OF FOWL-BLASTING ACTION, AND ONE VERY JUDGMENTAL DOG.',
  "ONLY $19.99! CALL NOW! OR, Y'KNOW, JUST WALK TO THE STORE.",
];

export function playCommercial() {
  return new Promise(resolve => {
    const overlay = document.getElementById('commercial-overlay');
    const textEl = document.getElementById('commercial-text');
    const skipEl = document.getElementById('commercial-skip');
    overlay.classList.remove('hidden', 'fading');
    skipEl.classList.remove('show');
    textEl.textContent = '';

    let idx = 0, done = false, lineTimer = null;
    function showLine() {
      if (idx >= COMMERCIAL_LINES.length) { finish(); return; }
      textEl.textContent = COMMERCIAL_LINES[idx];
      textEl.classList.remove('pop');
      void textEl.offsetWidth;
      textEl.classList.add('pop');
      playDialogueBlip();
      idx++;
      lineTimer = setTimeout(showLine, 2200);
    }
    lineTimer = setTimeout(showLine, 500);
    const skipRevealTimer = setTimeout(() => skipEl.classList.add('show'), 1200);

    function finish() {
      if (done) return;
      done = true;
      clearTimeout(lineTimer);
      clearTimeout(skipRevealTimer);
      overlay.removeEventListener('click', onClick);
      playGlitchWhoosh();
      overlay.classList.add('fading');
      setTimeout(() => { overlay.classList.add('hidden'); overlay.classList.remove('fading'); resolve(); }, 500);
    }
    function onClick() {
      if (idx < COMMERCIAL_LINES.length) { clearTimeout(lineTimer); showLine(); }
      else finish();
    }
    overlay.addEventListener('click', onClick);
  });
}

let dialogueActive = false;
export function isDialogueOpen() { return dialogueActive; }

export function showDialogue(speaker, text) {
  return new Promise(resolve => {
    dialogueActive = true;
    const box = document.getElementById('dialogue-box');
    const nameEl = document.getElementById('dialogue-name');
    const textEl = document.getElementById('dialogue-text');
    const hintEl = document.getElementById('dialogue-hint');
    nameEl.textContent = speaker || '';
    textEl.textContent = '';
    hintEl.style.opacity = '0';
    box.classList.remove('hidden');
    requestAnimationFrame(() => box.classList.add('show'));

    const chars = Array.from(text);
    let i = 0, finished = false, skip = false;

    function typeStep() {
      if (skip) {
        textEl.textContent = text;
        finished = true;
        hintEl.style.opacity = '1';
        return;
      }
      if (i < chars.length) {
        textEl.textContent += chars[i];
        if (i % 2 === 0) playDialogueBlip();
        i++;
        setTimeout(typeStep, 16);
      } else {
        finished = true;
        hintEl.style.opacity = '1';
      }
    }
    typeStep();

    function advance(e) {
      if (e && e.type === 'keydown' && e.code !== 'KeyE' && e.code !== 'Space' && e.code !== 'Enter') return;
      if (e && e.type === 'keydown') e.preventDefault();
      if (!finished) { skip = true; return; }
      window.removeEventListener('keydown', advance);
      box.removeEventListener('click', advance);
      box.classList.remove('show');
      setTimeout(() => box.classList.add('hidden'), 220);
      dialogueActive = false;
      resolve();
    }
    window.addEventListener('keydown', advance);
    box.addEventListener('click', advance);
  });
}

export async function showDialogueSequence(lines) {
  for (const line of lines) await showDialogue(line.speaker, line.text);
}

// Choices work both by clicking (mouse is free when pointer lock isn't engaged) and by
// pressing the matching number key (works even while pointer lock owns the cursor, which is
// the common case - this fires mid-gameplay in a first-person scene).
export function showChoice(prompt, options) {
  return new Promise(resolve => {
    dialogueActive = true;
    const box = document.getElementById('choice-box');
    const promptEl = document.getElementById('choice-prompt');
    const optsEl = document.getElementById('choice-options');
    promptEl.textContent = prompt;
    optsEl.innerHTML = '';
    let settled = false;

    function pick(value) {
      if (settled) return;
      settled = true;
      playUIClick();
      window.removeEventListener('keydown', onKeyDown);
      box.classList.remove('show');
      setTimeout(() => box.classList.add('hidden'), 220);
      dialogueActive = false;
      resolve(value);
    }

    options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = `${i + 1}. ${opt.label}`;
      btn.addEventListener('mouseenter', () => playUIHover());
      btn.addEventListener('click', () => pick(opt.value));
      optsEl.appendChild(btn);
    });

    function onKeyDown(e) {
      const n = parseInt(e.code.replace('Digit', '').replace('Numpad', ''), 10);
      if (!isNaN(n) && n >= 1 && n <= options.length) pick(options[n - 1].value);
    }
    window.addEventListener('keydown', onKeyDown);

    box.classList.remove('hidden');
    requestAnimationFrame(() => box.classList.add('show'));
  });
}

export function hideDialogue() {
  const box = document.getElementById('dialogue-box');
  box.classList.remove('show');
  box.classList.add('hidden');
  dialogueActive = false;
}

export function fadeToBlack(duration = 600) {
  return new Promise(resolve => {
    const el = document.getElementById('fade-overlay');
    el.style.transitionDuration = `${duration}ms`;
    el.style.pointerEvents = 'auto';
    requestAnimationFrame(() => { el.style.opacity = '1'; });
    setTimeout(resolve, duration);
  });
}

export function fadeFromBlack(duration = 600) {
  return new Promise(resolve => {
    const el = document.getElementById('fade-overlay');
    el.style.transitionDuration = `${duration}ms`;
    requestAnimationFrame(() => { el.style.opacity = '0'; });
    setTimeout(() => { el.style.pointerEvents = 'none'; resolve(); }, duration);
  });
}

export function glitchTransition(duration = 500) {
  playGlitchWhoosh();
  triggerDomGlitch(duration);
  return new Promise(resolve => setTimeout(resolve, duration));
}

export function showBanner(text, duration = 1600) {
  const el = document.getElementById('banner');
  el.textContent = text;
  el.classList.remove('show');
  void el.offsetWidth; // restart CSS animation
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

// Non-blocking flavor text (dog commentary, ambient unease) - gameplay keeps running under it.
export function showFlavorText(text, duration = 2400) {
  const el = document.getElementById('flavor-text');
  el.textContent = text;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => el.classList.remove('show'), duration);
}
