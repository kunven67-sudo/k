// Voice control: listens through voice-host.ps1, turns phrases into clicks and
// key presses, asks "did you say ...?" when needed, and waits the chosen delay.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { pathToFileURL } = require('url');

let cmds = null;
async function commands() {
  if (!cmds) cmds = await import(pathToFileURL(path.join(__dirname, '..', 'shared', 'voice-commands.mjs')).href);
  return cmds;
}

const WAKE_WINDOW_MS = 6000;

function spawnPowerShellHost() {
  const script = fs.readFileSync(path.join(__dirname, 'voice-host.ps1'), 'utf8');
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

class VoiceController extends EventEmitter {
  // deps: { win32, spawnHost, allowedNow(), hud: { show(state), hide() }, now() }
  constructor(deps) {
    super();
    this.deps = deps;
    this.settings = null;
    this.proc = null;
    this.map = new Map();
    this.pending = null;       // { action, phrase, timer }
    this.paused = false;
    this.wokeUntil = 0;
    this.pttDown = false;
    this.status = { state: 'off', message: '' };
    this.history = [];
    this.restartTimer = null;
    this.restartDelay = 1000;
    this.generation = 0;
    this.heldButton = null;
    this.micApps = [];         // other apps using the microphone right now
  }

  now() { return this.deps.now ? this.deps.now() : Date.now(); }

  setStatus(state, message = '', extra = {}) {
    this.status = { state, message, ...extra };
    this.emit('status', this.status);
  }

  async configure(settings) {
    const prev = this.settings;
    this.settings = settings;
    const c = await commands();
    this.map = c.buildCommandMap({ letters: settings.letters, custom: settings.custom, groups: settings.groups, customNeedsClick: settings.customNeedsClick });
    if (!settings.enabled) { this.stop(); this.setStatus('off'); return; }
    // The phrase list is baked into the host, so a change means a restart.
    const phrases = c.grammarPhrases(this.map, settings.mode);
    const key = JSON.stringify([phrases, settings.mode, settings.endSilenceMs, settings.ignoreTalk, settings.talkWeight]);
    if (this.proc && this.hostKey === key && prev?.enabled) return;
    this.hostKey = key;
    this.stop();
    this.start(phrases);
  }

  start(phrases) {
    const gen = ++this.generation;
    let proc;
    try {
      proc = (this.deps.spawnHost || spawnPowerShellHost)();
    } catch (err) {
      this.setStatus('error', `Could not start the speech engine: ${err.message}`);
      return;
    }
    this.proc = proc;
    this.setStatus('starting', 'Starting the speech engine...');
    let buf = '';
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        try { this.onHostMessage(JSON.parse(line)); } catch { /* ignore stray output */ }
      }
    });
    proc.stderr?.on('data', (d) => console.error('[voice-host]', String(d).trim()));
    proc.on('error', (err) => { if (gen === this.generation) this.setStatus('error', `Speech engine error: ${err.message}`); });
    proc.on('exit', (code) => {
      if (gen !== this.generation) return;
      this.proc = null;
      if (this.status.state === 'error') return; // host told us why; don't loop
      if (this.settings?.enabled) {
        this.setStatus('starting', 'Speech engine stopped, restarting...');
        clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(() => { if (this.settings?.enabled && !this.proc) this.start(phrases); }, this.restartDelay);
        this.restartDelay = Math.min(this.restartDelay * 2, 30000);
      }
      void code;
    });
    const autostart = this.settings.mode !== 'ptt';
    proc.stdin.write(`${JSON.stringify({
      phrases,
      autostart,
      endSilenceMs: this.settings.endSilenceMs ?? 150,
      ignoreTalk: this.settings.ignoreTalk !== false,
      talkWeight: this.settings.talkWeight ?? 0.5,
    })}\n`);
  }

  stop() {
    this.generation++;
    clearTimeout(this.restartTimer);
    this.cancelPending();
    if (this.proc) {
      try { this.proc.stdin.write('quit\n'); } catch { /* already gone */ }
      const p = this.proc;
      setTimeout(() => { try { p.kill(); } catch { /* gone */ } }, 1500);
      this.proc = null;
    }
    if (this.heldButton) { this.deps.win32.mouseButton(this.heldButton, false); this.heldButton = null; }
    this.deps.hud?.hide();
  }

  // Push-to-talk key handling (called from the global input hook).
  pushToTalk(down) {
    if (!this.proc || this.settings?.mode !== 'ptt' || down === this.pttDown) return;
    this.pttDown = down;
    try { this.proc.stdin.write(down ? 'start\n' : 'stop\n'); } catch { /* gone */ }
    if (down) this.deps.hud?.show({ kind: 'listening', text: 'Listening...' });
    else if (!this.pending) setTimeout(() => { if (!this.pending) this.deps.hud?.hide(); }, 900);
  }

  onHostMessage(msg) {
    switch (msg.type) {
      case 'ready':
        this.restartDelay = 1000;
        this.talkFilter = !!msg.talkFilter;
        this.setStatus(this.settings.mode === 'ptt' ? 'ready' : 'listening', `Using ${msg.recognizer || 'Windows speech'} (${msg.culture})`, { culture: msg.culture, talkFilter: this.talkFilter });
        this.refreshMicStatus();
        break;
      case 'mic':
        this.micApps = Array.isArray(msg.apps) ? msg.apps : [];
        this.refreshMicStatus();
        break;
      case 'state':
        if (this.settings.mode === 'ptt') this.setStatus(msg.listening ? 'listening' : 'ready', this.status.message);
        break;
      case 'level':
        this.emit('level', msg.level);
        break;
      case 'error': {
        const help = {
          'no-recognizer': 'Windows has no speech recognizer installed. Open Settings > Time & language > Speech and add English speech.',
          'no-mic': 'No microphone found. Plug one in or check Settings > Privacy > Microphone.',
          'no-speech': 'Windows speech is missing on this PC.',
        }[msg.code] || msg.message;
        this.setStatus('error', help, { code: msg.code });
        break;
      }
      case 'result':
        this.handleResult(msg.text, Number(msg.confidence) || 0, msg.grammar || '');
        break;
      default:
        break;
    }
  }

  // Holding the talk key means "I'm talking to CursorVerse", so never block that.
  micBlocked() {
    return this.settings?.pauseWhenMicBusy !== false && this.settings?.mode !== 'ptt' && this.micApps.length > 0;
  }

  // Shows "paused while Discord uses the mic" (or clears it) on the Voice page.
  refreshMicStatus() {
    if (!this.proc || !['listening', 'ready', 'mic-busy'].includes(this.status.state)) return;
    if (this.micBlocked()) {
      this.setStatus('mic-busy', `Paused while ${this.micApps.join(', ')} ${this.micApps.length > 1 ? 'are' : 'is'} using your mic`, { micApps: this.micApps });
    } else if (this.status.state === 'mic-busy') {
      this.setStatus(this.settings.mode === 'ptt' ? 'ready' : 'listening', '', { talkFilter: this.talkFilter });
    }
  }

  // outcome says what happened, so the Voice page can explain why nothing ran.
  report(text, confidence, outcome, detail = '') {
    this.emit('heard', { text, confidence, outcome, detail, matched: !['talk', 'not-command'].includes(outcome) });
  }

  async handleResult(text, confidence, grammar = '') {
    const c = await commands();
    if (grammar === 'talk') { this.report(text, confidence, 'talk'); return; }
    const parsed = c.parseUtterance(text, this.map);
    const minConf = this.settings.minConfidence ?? 0.6;
    if (!parsed) { this.report(text, confidence, 'not-command'); return; }
    if (this.micBlocked()) { this.report(text, confidence, 'mic-busy', this.micApps.join(', ')); return; }
    if (confidence < minConf) {
      this.report(text, confidence, 'unsure', `${Math.round(minConf * 100)}%`);
      this.deps.hud?.flash({ kind: 'unsure', text: `Didn't catch that (${Math.round(confidence * 100)}%)` });
      return;
    }
    const { action } = parsed;

    // yes / no / pause / resume
    if (action?.kind === 'control') {
      if (action.op === 'pause') { this.paused = true; this.cancelPending(); this.setStatus('paused', 'Say "start listening" to wake me up.'); this.deps.hud?.flash({ kind: 'info', text: 'Voice paused 😴' }); this.report(text, confidence, 'paused'); return; }
      if (action.op === 'resume') { this.paused = false; this.setStatus('listening', ''); this.deps.hud?.flash({ kind: 'info', text: 'Voice on 🎤' }); this.report(text, confidence, 'resumed'); return; }
      if (this.paused) { this.report(text, confidence, 'paused'); return; }
      if (!this.pending) { this.report(text, confidence, 'no-question'); return; }
      const p = this.pending;
      this.cancelPending(false);
      if (action.op === 'yes') { this.report(text, confidence, 'yes', c.describeAction(p.action)); this.schedule(p.action, p.phrase); }
      else { this.report(text, confidence, 'no', c.describeAction(p.action)); this.deps.hud?.flash({ kind: 'cancel', text: `OK, not pressing ${c.describeAction(p.action)} ❌` }); }
      return;
    }
    if (this.paused) { this.report(text, confidence, 'paused'); return; }

    if (this.settings.mode === 'wake') {
      if (parsed.woke && !action) {
        this.wokeUntil = this.now() + WAKE_WINDOW_MS;
        this.deps.hud?.show({ kind: 'listening', text: 'Yeah? 👂' });
        this.report(text, confidence, 'woke');
        return;
      }
      if (!parsed.woke && this.now() > this.wokeUntil) { this.report(text, confidence, 'need-wake'); return; }
      this.wokeUntil = 0;
    }
    if (!action) return;
    if (!this.deps.allowedNow()) {
      this.report(text, confidence, 'other-app');
      this.deps.hud?.flash({ kind: 'info', text: 'Voice is off for this app' });
      return;
    }

    if (c.needsConfirm(action, this.settings.confirm)) {
      this.cancelPending(false);
      const timeoutMs = Math.max(2, Number(this.settings.confirmTimeoutSec) || 8) * 1000;
      this.pending = {
        action,
        phrase: parsed.phrase,
        timer: setTimeout(() => {
          this.pending = null;
          this.deps.hud?.flash({ kind: 'cancel', text: 'No answer, skipped it' });
        }, timeoutMs),
      };
      this.report(text, confidence, 'asked', c.describeAction(action));
      this.deps.hud?.show({ kind: 'confirm', text: `Did you say ${c.describeAction(action)}?`, hint: 'say "yes" or "no"' });
      return;
    }
    this.report(text, confidence, 'run', c.describeAction(action));
    this.schedule(action, parsed.phrase);
  }

  cancelPending(hide = true) {
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending = null;
      if (hide) this.deps.hud?.hide();
    }
  }

  async schedule(action, phrase) {
    const c = await commands();
    const delay = c.delayToMs(this.settings.delayValue, this.settings.delayUnit);
    const label = c.describeAction(action);
    const run = () => {
      const ok = this.execute(action);
      this.history.unshift({ at: Date.now(), phrase, label, ok });
      this.history.length = Math.min(this.history.length, 30);
      this.emit('command', { phrase, label, ok });
      this.deps.hud?.flash({ kind: ok ? 'done' : 'error', text: ok ? label : `couldn't do ${label}` });
    };
    if (delay < 1) setImmediate(run);
    else {
      if (delay >= 1000) this.deps.hud?.flash({ kind: 'info', text: `${label} in ${formatDelay(delay)}...` }, Math.min(delay, 4000));
      setTimeout(run, delay);
    }
  }

  execute(action) {
    const w = this.deps.win32;
    switch (action.kind) {
      case 'mouse':
        if (action.op === 'click') return w.click(action.button, 1);
        if (action.op === 'double') return w.click(action.button, 2);
        if (action.op === 'triple') return w.click(action.button, 3);
        if (action.op === 'down') { this.heldButton = action.button; return w.mouseButton(action.button, true); }
        if (action.op === 'up') { const b = this.heldButton || action.button; this.heldButton = null; return w.mouseButton(b, false); }
        return false;
      case 'scroll':
        return w.scroll(action.notches, action.horizontal);
      case 'keys':
        return w.pressKeys(action.vks);
      case 'text': {
        const ok = w.typeText(action.text);
        return action.enter ? ok && w.pressKeys([0x0d]) : ok;
      }
      default:
        return false;
    }
  }
}

function formatDelay(ms) {
  if (ms >= 60000) return `${+(ms / 60000).toFixed(2)} min`;
  if (ms >= 1000) return `${+(ms / 1000).toFixed(2)} s`;
  return `${+ms.toFixed(1)} ms`;
}

module.exports = { VoiceController, formatDelay, spawnPowerShellHost };
