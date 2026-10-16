// Conversations with the player: picks the brain (built-in / local AI / your Claude key),
// applies what the person decides, and speaks it (babble or real voice) with subtitles.
// Also: microphone input (hold B) using the browser's speech recognition.
import { settings } from '../core/settings.js';
import { babble, audioCtx } from '../core/audio.js';
import { Brain } from './brain.js';
import { claudeReply, localReply, replyToOrder } from './llm.js';
import { clamp, rand } from '../core/util.js';

export class Talk {
  constructor(game) {
    this.game = game;
    this.brain = new Brain(game);
    this.history = new Map(); // person id -> messages for the AI brains
    this.busy = new Set();
    this.mic = null;
    this.micText = '';
  }

  // the player said something to a person (or everyone nearby)
  async tell(p, text) {
    const g = this.game;
    if (!p || !text.trim()) return;
    if (!p.alive) { g.toast(`${p.name} is dead.`); return; }
    if (p.objectForm) { p.lastHeard = text; }
    if (p.age === 'baby') { p.say(rand.pick(['Gaa!', 'Ba ba!', '*giggles*', '*stares at you*', 'Waaah!']), { kind: 'chat' }); return; }
    if (p.ko > 0 || p.asleep) {
      if (p.asleep && /\b(wake|hey|yo|get up)\b/i.test(text)) { p.asleep = false; p.anim.lying = false; p.say('Huh? What? I\'m up...', { kind: 'chat' }); }
      else g.toast(`${p.name} is ${p.ko > 0 ? 'knocked out' : 'asleep'}.`);
      return;
    }
    g.ui.playerSaid(text, p);
    // the built-in brain always runs (instant), the AI brains replace its answer when they reply
    const local = this.brain.respond(p, text);
    const useAI = settings.brain === 'claude' && settings.claudeKey ? 'claude' : settings.brain === 'local' ? 'local' : null;
    if (!useAI) { this.apply(p, local, text); return; }
    if (this.busy.has(p.id)) { g.toast(`${p.name} is still thinking...`); return; }
    this.busy.add(p.id);
    p.thinkingBubble = true;
    g.ui.thinking(p, true);
    const hist = this.history.get(p.id) || [];
    try {
      const fn = useAI === 'claude' ? claudeReply : localReply;
      const { reply } = await fn(p, text, g, hist);
      const order = replyToOrder(reply, p, g);
      const out = { say: reply.say, kind: { angry: 'angry', scared: 'scared', sad: 'sad', love: 'love' }[reply.mood] || 'chat', order, opinion: clamp(reply.opinion_change | 0, -10, 10) };
      if (reply.action === 'take_item') out.order = g.player.offerItemTo(p) ? { type: 'acceptItem' } : null;
      this.apply(p, out, text);
      hist.push({ role: 'user', content: text }, { role: 'assistant', content: JSON.stringify(reply) });
      while (hist.length > 16) hist.shift();
      this.history.set(p.id, hist);
    } catch (e) {
      if (e && e.message && e.message !== 'refused' && e.message !== 'bad reply') g.toast(e.message);
      this.apply(p, local, text);
    } finally {
      this.busy.delete(p.id);
      p.thinkingBubble = false;
      g.ui.thinking(p, false);
    }
  }

  apply(p, out, text) {
    const g = this.game;
    if (out.opinion) p.op = clamp(p.op + out.opinion, -100, 100);
    p.remember('talk', `The giant said "${text.slice(0, 60)}"`, 0, 'player');
    p.say(out.say, { kind: out.kind || 'chat', long: true });
    // face the giant while talking
    p.lookAtPlayerT = 3;
    if (out.order) {
      const o = out.order;
      if (o.type === 'acceptItem') { g.player.giveItemTo(p); return; }
      p.order = o;
      p.task = null;
      p.asleep = false;
      p.thinkT = 0;
      if (o.type === 'fight' && o.target && o.target.name) g.feed(`${p.name} agreed to ${o.lethal ? 'kill' : 'attack'} ${o.target.name}`, 'bad', p);
    }
  }

  // ------------------------------------------------------------- speaking
  speak(p, text, opts = {}) {
    const g = this.game;
    const vol = g.audibleVol(p.pos, 1) * (opts.scream ? 1.4 : 1);
    const kind = opts.kind || 'chat';
    const dur = Math.max(2.2, Math.min(9, text.length * 0.065 + 1.4));
    g.ui.bubble(p, text, kind, dur);
    if (vol < 0.03) return;
    const tiny = p.sc < 0.2;
    if (settings.voice === 'spoken' && 'speechSynthesis' in window && !opts.scream && (opts.long || g.ui.focusPerson === p || p.held)) {
      try {
        const u = new SpeechSynthesisUtterance(text.replace(/\*[^*]+\*/g, ''));
        const voices = speechSynthesis.getVoices();
        const want = p.sex === 'f' ? /female|zira|samantha|victoria|karen|moira|fiona|aria|jenny/i : /male|david|daniel|alex|fred|guy|mark/i;
        const v = voices.find((x) => /en/i.test(x.lang) && want.test(x.name)) || voices.find((x) => /en/i.test(x.lang));
        if (v) u.voice = v;
        u.pitch = clamp((p.sex === 'f' ? 1.3 : 0.9) * (tiny ? 1.45 : 1) * (p.kid ? 1.3 : 1), 0.1, 2);
        u.rate = clamp(p.voice.rate * (opts.kind === 'scared' ? 1.25 : 1), 0.6, 1.6);
        u.volume = clamp(vol * settings.voices * settings.master, 0, 1);
        speechSynthesis.speak(u);
        return;
      } catch (e) { /* fall back to babble */ }
    }
    if (!audioCtx()) return;
    babble(text, p.voice, { vol, pitchMul: (tiny ? 1.7 : 1) * (opts.scream ? 1.3 : 1), angry: kind === 'angry', scared: kind === 'scared' });
  }

  // ------------------------------------------------------------- microphone
  micSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }

  startMic(onText) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { this.game.toast('Your browser has no speech recognition. Use Chrome or Edge, or type with T.'); return false; }
    if (this.mic) return true;
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    this.micText = '';
    rec.onresult = (e) => {
      let s = '';
      for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript;
      this.micText = s;
      if (onText) onText(s, false);
    };
    rec.onerror = (e) => { if (e.error === 'not-allowed') this.game.toast('Microphone blocked. Allow it in the browser to talk with your voice.'); };
    rec.onend = () => { this.mic = null; };
    try { rec.start(); } catch (e) { return false; }
    this.mic = rec;
    return true;
  }

  stopMic() {
    const text = this.micText;
    if (this.mic) { try { this.mic.stop(); } catch (e) { /* ignore */ } }
    this.mic = null;
    this.micText = '';
    return text;
  }
}
