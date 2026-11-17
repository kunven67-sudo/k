"use strict";
/* OVERDRIVE Piece 4: looks + feel. Moving backgrounds (WebGL, runs at low resolution and low frame rate so a
   GT 1030 stays cool), real recorded sounds for every kind of click, and the startup animation.
   Everything here can be turned down or off: Settings > Looks (Animations: full / calm / off, Sounds). */

const FX = {
  s: {}, ctx: null, buf: new Map(), loading: new Map(), lastHover: 0, lastKey: 0,
  bg: { gl: null, prog: null, scene: "", raf: 0, t0: performance.now(), last: 0, frames: 0, slow: 0, scale: 0.5, mouse: [0.5, 0.5], still: false, img: null },
};

/* ================================================================ sounds */
const SOUND_FILES = {
  click: "click", click_up: "click_up", hover: "hover", toggle_on: "toggle_on", toggle_off: "toggle_off", knob: "knob",
  mic_on: "mic_on", mic_off: "mic_off", relay: "relay", boot: "boot", done: "done", needs_you: "needs_you", pop: "pop",
  send: "send", error: "error", idea: "idea", success: "success", mouse: "mouse", whoosh: "whoosh", whoosh2: "whoosh2",
  save: "save", bell: "bell", ring: "ring", bike: "bike", key1: "key1", key2: "key2", key3: "key3", key4: "key4",
};
// what each moment sounds like in each sound style (studio = the real recordings)
const SOUND_MAP = {
  click: "click", tab: "whoosh", open: "whoosh", close: "click_up", toggle_on: "toggle_on", toggle_off: "toggle_off",
  mic_on: "mic_on", mic_off: "mic_off", send: "send", done: "done", needs_you: "needs_you", error: "error", toast: "pop",
  success: "success", idea: "idea", save: "save", big_done: "bell", limit: "ring", boot: "boot", copy: "mouse",
  type: "key", slider: "knob", hover: "hover", voice_start: "relay",
};
FX.apply = function (s) {
  const old = FX.s;
  FX.s = s || {};
  const motion = FX.s.motion || "full";
  document.documentElement.dataset.motion = motion;
  if (old.background !== FX.s.background || old.bg_custom !== FX.s.bg_custom || old.motion !== motion || !FX.bg.started) FX.startBg();
  FX.dim();
};
FX.dim = function () {
  const d = Number(FX.s.bg_dim == null ? 55 : FX.s.bg_dim);
  document.documentElement.style.setProperty("--bg-dim", String(Math.max(0, Math.min(90, d)) / 100));
};
FX.audio = function () {
  if (!FX.ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    FX.ctx = new C();
    FX.master = FX.ctx.createGain();
    FX.master.connect(FX.ctx.destination);
  }
  if (FX.ctx.state === "suspended") FX.ctx.resume().catch(() => {});
  return FX.ctx;
};
FX.load = function (file) {
  if (FX.buf.has(file)) return Promise.resolve(FX.buf.get(file));
  if (FX.loading.has(file)) return FX.loading.get(file);
  const ctx = FX.audio();
  if (!ctx) return Promise.resolve(null);
  const p = fetch(`/static/snd/${file}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
    .then((a) => ctx.decodeAudioData(a)).then((b) => { FX.buf.set(file, b); return b; }).catch(() => null);
  FX.loading.set(file, p);
  return p;
};
FX.preload = function () { ["click", "click_up", "whoosh", "send", "done", "pop", "toggle_on", "toggle_off", "mic_on", "mic_off", "key1", "key2"].forEach(FX.load); };
FX.synth = function (kind, vol) {
  // "soft" and "arcade" styles: made right here (no files)
  const ctx = FX.audio();
  if (!ctx) return;
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  const arcade = (FX.s.sound_pack || "studio") === "arcade";
  const tune = { click: [660, 0.05], tab: [520, 0.09], open: [440, 0.12], close: [380, 0.08], toggle_on: [880, 0.08], toggle_off: [440, 0.08],
    mic_on: [990, 0.12], mic_off: [495, 0.12], send: [740, 0.1], done: [1046, 0.22], needs_you: [1318, 0.3], error: [196, 0.25],
    toast: [784, 0.08], success: [1174, 0.35], idea: [1568, 0.3], save: [587, 0.12], big_done: [1318, 0.5], limit: [262, 0.45],
    boot: [330, 0.4], copy: [1046, 0.05], type: [1800, 0.02], slider: [900, 0.02], hover: [1400, 0.015], voice_start: [700, 0.08] }[kind] || [600, 0.05];
  o.type = arcade ? "square" : "sine";
  o.frequency.setValueAtTime(tune[0], t);
  if (["done", "success", "big_done", "idea", "toggle_on", "mic_on"].includes(kind)) o.frequency.exponentialRampToValueAtTime(tune[0] * 1.5, t + tune[1]);
  if (["error", "limit", "toggle_off", "mic_off"].includes(kind)) o.frequency.exponentialRampToValueAtTime(tune[0] * 0.66, t + tune[1]);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol * (arcade ? 0.18 : 0.3), t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + tune[1]);
  o.connect(g); g.connect(FX.master);
  o.start(t); o.stop(t + tune[1] + 0.02);
};
FX.play = function (kind, opts) {
  const s = FX.s;
  if (s.sounds === false) return;
  const vol = Math.max(0, Math.min(1, Number(s.sound_volume == null ? 60 : s.sound_volume) / 100)) * ((opts && opts.vol) || 1);
  if (vol <= 0) return;
  const now = performance.now();
  if (kind === "hover") { if (now - FX.lastHover < 70) return; FX.lastHover = now; }
  if (kind === "type") { if (now - FX.lastKey < 35) return; FX.lastKey = now; }
  if ((s.sound_pack || "studio") !== "studio") { FX.synth(kind, vol); return; }
  let file = SOUND_MAP[kind] || kind;
  if (file === "key") file = "key" + (1 + Math.floor(Math.random() * 4));
  if (!SOUND_FILES[file]) return;
  const ctx = FX.audio();
  if (!ctx) return;
  FX.load(file).then((b) => {
    if (!b) return;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = b;
    src.playbackRate.value = kind === "type" || kind === "hover" ? 0.94 + Math.random() * 0.12 : 1;
    g.gain.value = vol * ({ hover: 0.25, type: 0.45, slider: 0.5, copy: 0.6 }[kind] || 0.85);
    src.connect(g); g.connect(FX.master);
    src.start();
  });
};

/* which sound goes with which click: decided by what was clicked (one listener for the whole window) */
FX.soundFor = function (el) {
  if (!el) return null;
  if (el.matches("#send, [data-send]")) return null;                 // send has its own sound when it really sends
  if (el.matches("#nav button, [data-tab]")) return "tab";
  if (el.matches("input[type=checkbox]")) return el.checked ? "toggle_on" : "toggle_off";
  if (el.matches("[data-copy], [data-copyall], [data-copyreq], .copy-btn, .pc-copy")) return "copy";
  if (el.matches(".danger, [data-acct-del], [data-del]")) return "click";
  if (el.matches("#drawer-x, .x, .bn-x, .lb-x, #live-x, #btw-x")) return "close";
  if (el.matches("#live-toggle, #btw-toggle, #mind-chip, #acct-chip, #net-light, [data-open]")) return "open";
  if (el.matches("button, .chat-item, select, summary, .sw, [role=button]")) return "click";
  return null;
};
document.addEventListener("click", (e) => {
  const el = e.target.closest && e.target.closest("button, input[type=checkbox], .chat-item, summary, [role=button], a");
  const k = FX.soundFor(el);
  if (k) FX.play(k);
  if (el && el.matches("button") && FX.s.motion !== "off") FX.ripple(el, e);
}, true);
document.addEventListener("pointerover", (e) => {
  const el = e.target.closest && e.target.closest("#nav button, .chat-item, .ex, button.primary, .icon-btn");
  if (el && !el.contains(e.relatedTarget)) FX.play("hover");
}, true);
document.addEventListener("input", (e) => {
  if (e.target.matches("textarea, input[type=text], input[type=search], input:not([type]), input[type=password]")) FX.play("type");
  else if (e.target.matches("input[type=range]")) FX.play("slider");
}, true);
document.addEventListener("pointerdown", () => { FX.audio(); if (!FX.preloaded) { FX.preloaded = true; FX.preload(); } }, { once: false, capture: true });

/* a soft light ripple where you clicked */
FX.ripple = function (btn, e) {
  const r = btn.getBoundingClientRect();
  if (r.width < 18 || r.height < 14) return;
  const d = document.createElement("span");
  d.className = "rip";
  const size = Math.max(r.width, r.height) * 2.2;
  d.style.cssText = `width:${size}px;height:${size}px;left:${(e.clientX || r.left + r.width / 2) - r.left - size / 2}px;top:${(e.clientY || r.top + r.height / 2) - r.top - size / 2}px`;
  btn.appendChild(d);
  setTimeout(() => d.remove(), 600);
};

/* ================================================================ moving backgrounds (WebGL) */
const GL_HEAD = `precision mediump float;
uniform vec2 R; uniform float T; uniform vec3 A; uniform vec2 M;
float h1(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h1(i),h1(i+vec2(1,0)),f.x), mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*n2(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return v; }
float stars(vec2 uv, float d, float t){ vec2 g=uv*d; vec2 id=floor(g); vec2 f=fract(g)-.5; float r=h1(id);
  if(r<.86) return 0.; vec2 o=vec2(h1(id+3.1),h1(id+7.7))-.5; float s=smoothstep(.06,0.,length(f-o*.7));
  return s*(.55+.45*sin(t*(1.+r*3.)+r*40.)); }
`;
const SCENES = {
  aurora: `void main(){ vec2 uv=gl_FragCoord.xy/R; vec2 p=uv; p.x*=R.x/R.y; float t=T*.6;
    vec3 col=mix(vec3(.01,.02,.05),vec3(.02,.07,.14),uv.y);
    col+=vec3(.8,.9,1.)*stars(p+M*.02,90.,T)*smoothstep(.3,.9,uv.y);
    for(int i=0;i<3;i++){ float fi=float(i);
      float y=.6+fi*.07+.15*(fbm(vec2(p.x*.8+t*.05*(fi+1.),t*.04+fi))-.5);
      float d=uv.y-y; float band=exp(-abs(d)*(7.-fi*1.5))*(d>0.?1.:exp(d*18.));
      float streak=.45+.75*fbm(vec2(p.x*9.+t*.3,uv.y*1.2+fi));
      vec3 c=mix(vec3(.15,1.,.55),vec3(.45,.35,1.),fi/2.); c=mix(c,A,.2);
      col+=c*band*streak*.9; col+=c*.08*exp(-abs(d)*2.); }
    float ridge=.17+.09*fbm(vec2(p.x*2.2,1.3))+.03*sin(p.x*9.);
    float ridge2=.1+.06*fbm(vec2(p.x*3.5+5.,2.));
    col=mix(col,vec3(.02,.03,.05)+col*.15,smoothstep(ridge+.003,ridge,uv.y));
    col=mix(col,vec3(.006,.01,.018),smoothstep(ridge2+.003,ridge2,uv.y));
    gl_FragColor=vec4(col,1.); }`,
  nebula: `void main(){ vec2 uv=gl_FragCoord.xy/R; vec2 p=(gl_FragCoord.xy-.5*R)/R.y; float t=T*.02;
    vec2 q=vec2(fbm(p*1.6+t),fbm(p*1.6-t+3.));
    float f=fbm(p*1.8+q*1.8+vec2(t*2.,0.));
    vec3 col=mix(vec3(.01,.01,.04),vec3(.32,.08,.5),smoothstep(.3,.8,f));
    col=mix(col,vec3(.08,.3,.65),smoothstep(.45,.95,q.x)*.75);
    col=mix(col,A,smoothstep(.55,.95,f*q.y*1.6)*.6);
    col+=vec3(1.,.8,.9)*pow(max(f-.55,0.),2.)*2.;
    col+=vec3(1.)*stars(p+M*.03,55.,T)*.9+vec3(.7,.8,1.)*stars(p*1.7+M*.06+11.,70.,T*1.3)*.6;
    col*=1.1-.4*length(uv-.5);
    gl_FragColor=vec4(col,1.); }`,
  rain: `void main(){ vec2 uv=gl_FragCoord.xy/R; vec2 p=uv; p.x*=R.x/R.y;
    vec3 col=mix(vec3(.03,.03,.07),vec3(.08,.05,.13),uv.y);
    for(int i=0;i<3;i++){ float fi=float(i); vec2 g=p*(3.+fi*2.)+vec2(fi*3.1,0.); vec2 id=floor(g); vec2 f=fract(g)-.5;
      float r=h1(id+fi); vec2 o=vec2(h1(id+1.3),h1(id+2.9))-.5;
      vec3 lc=mix(mix(vec3(1.,.55,.2),vec3(.3,.6,1.),step(.5,r)),A,step(.85,r));
      float d=length(f-o*.6); col+=lc*smoothstep(.32,.0,d)*(.25-.06*fi)*(.6+.4*sin(T*.5+r*20.))*step(.25,uv.y+r*.4); }
    vec2 g=vec2(p.x*16.,p.y*1.1); float id=floor(g.x); float on=step(.45,h1(vec2(id,9.))); float sp=.06+.12*h1(vec2(id,4.));
    float y=fract(g.y+T*sp+h1(vec2(id,1.))); float x=fract(g.x)-.5-.15*sin(g.y*3.+id);
    float trail=smoothstep(.02,0.,abs(x))*smoothstep(1.,.7,y)*smoothstep(.35,.7,y)*.18*on;
    float head=smoothstep(.07,0.,length(vec2(x,(y-.7)*2.5)))*on;
    vec2 sg=p*vec2(32.,20.); vec2 sid=floor(sg); vec2 sf=fract(sg)-.5; float sr=h1(sid);
    float drop=step(.82,sr)*smoothstep(.12,.05,length(sf-(vec2(h1(sid+.4),h1(sid+.8))-.5)*.5));
    col+=vec3(.75,.85,1.)*(trail*.5+head*.8+drop*.35)*(.4+.6*h1(vec2(id,7.)));
    gl_FragColor=vec4(col,1.); }`,
  waves: `void main(){ vec2 uv=gl_FragCoord.xy/R; vec2 p=(gl_FragCoord.xy-.5*R)/R.y; float hz=-.05;
    vec3 sky=mix(vec3(.98,.45,.25),vec3(.17,.06,.3),smoothstep(hz,.55,p.y)); sky=mix(sky,vec3(.05,.02,.12),smoothstep(.3,.6,p.y));
    vec3 col=sky; vec2 sc=p-vec2(0.,.12+M.y*.02); float sun=smoothstep(.27,.26,length(sc));
    float gap=step(.5,fract((sc.y+T*.03)*22.))+step(.06,sc.y); sun*=mix(1.,gap,smoothstep(.06,-.2,sc.y)*1.);
    col=mix(col,mix(vec3(1.,.85,.35),mix(vec3(1.,.3,.45),A,.3),smoothstep(.2,-.2,sc.y)),sun);
    col+=vec3(1.,.5,.4)*.25*exp(-length(sc)*3.5);
    if(p.y<hz){ float d=hz-p.y; float w=sin(d*140./(1.+d*4.)-T*1.2+5.*n2(vec2(p.x*6.,d*25.)))*.5+.5;
      vec3 sea=mix(vec3(.12,.05,.22),vec3(.02,.01,.06),smoothstep(0.,.4,d));
      float refl=smoothstep(.22,0.,abs(p.x))*smoothstep(.45,0.,d)*step(.55,w);
      col=sea+vec3(1.,.55,.4)*refl*.7+vec3(.4,.2,.6)*step(.92,w)*smoothstep(.4,0.,d)*.3; }
    col+=stars(p+M*.02,60.,T)*smoothstep(.25,.5,p.y);
    gl_FragColor=vec4(col,1.); }`,
  grid: `void main(){ vec2 uv=gl_FragCoord.xy/R; vec2 p=(gl_FragCoord.xy-.5*R)/R.y; float hz=.02;
    vec3 col=mix(vec3(.02,0.,.05),vec3(.12,0.,.2),smoothstep(.6,hz,p.y));
    col+=A*.35*exp(-abs(p.y-hz)*14.);
    float m=.06+.05*abs(sin(p.x*3.1))+.04*fbm(vec2(p.x*4.,1.));
    if(p.y>hz && p.y<hz+m){ col=mix(vec3(.05,0.,.1),A*.5,smoothstep(hz,hz+m,p.y)*.3); col+=A*smoothstep(.006,0.,abs(p.y-(hz+m)))*.9; }
    col+=stars(p+M*.02,70.,T)*smoothstep(.15,.5,p.y);
    if(p.y<hz){ float z=1./(hz-p.y+.001); vec2 g=vec2(p.x*z*.6,z+T*1.2);
      vec2 l=abs(fract(g)-.5)/fwidth(g); float line=1.-min(min(l.x,l.y),1.);
      col=mix(vec3(.03,0.,.07),vec3(.0),smoothstep(0.,.5,hz-p.y));
      col+=mix(A,vec3(1.,.3,.9),.35)*line*smoothstep(30.,2.,z)*1.2; col+=A*.25*exp(-(hz-p.y)*10.); }
    gl_FragColor=vec4(col,1.); }`,
  city: `float bld(float x,float s,float h){ float id=floor(x*s); return h*(.3+.7*h1(vec2(id,s))); }
  void main(){ vec2 uv=gl_FragCoord.xy/R; vec2 p=uv; p.x*=R.x/R.y; float t=T;
    vec3 col=mix(vec3(.25,.12,.35),vec3(.03,.03,.1),smoothstep(.05,.9,uv.y));
    col+=stars(p,80.,T)*smoothstep(.5,.95,uv.y)*.8;
    vec2 mc=vec2(R.x/R.y*.78,.78); col+=vec3(1.,.95,.85)*smoothstep(.065,.06,length(p-mc))+vec3(.5,.4,.6)*.15*exp(-length(p-mc)*6.);
    float cl=fbm(vec2(p.x*1.5-t*.01,uv.y*3.)); col=mix(col,vec3(.35,.25,.45),smoothstep(.55,.85,cl)*smoothstep(.45,.75,uv.y)*.35);
    for(int i=0;i<3;i++){ float fi=float(i); float s=6.+fi*5.; float x=p.x+M.x*.03*(fi+1.)+fi*7.3;
      float h=bld(x,s,.55-fi*.13)+.05; float edge=step(uv.y,h);
      vec3 bc=mix(vec3(.08,.06,.15),vec3(.01,.01,.03),fi/2.);
      float dens=.55+.4*h1(vec2(floor(x*s),fi+2.));
      vec2 w=vec2(x*s*5.,uv.y*48.); vec2 wid=floor(w); float lit=step(dens+.25,h1(wid+fi*9.))*step(.35,fract(w.x))*step(.4,fract(w.y));
      lit*=step(.15,fract(h1(wid+3.)+t*.004*h1(wid+4.)));
      vec3 wc=mix(vec3(1.,.72,.38),A,step(.93,h1(wid+5.)))*(.32+.12*(2.-fi));
      col=mix(col,bc+wc*lit*step(uv.y,h-.01),edge); }
    gl_FragColor=vec4(col,1.); }`,
  forest: `void main(){ vec2 uv=gl_FragCoord.xy/R; vec2 p=uv; p.x*=R.x/R.y; float t=T;
    vec3 col=mix(vec3(.04,.09,.08),vec3(.16,.27,.26),uv.y);
    col+=vec3(.6,.75,.6)*.18*exp(-length(p-vec2(R.x/R.y*.5,1.1))*1.5);
    float ray=pow(max(0.,fbm(vec2(p.x*3.-uv.y*1.2+t*.02,1.))-.35),2.)*smoothstep(.2,1.,uv.y); col+=vec3(.6,.8,.55)*ray*.7;
    for(int i=3;i>=0;i--){ float fi=float(i); float x=p.x*(1.2+fi*.9)+fi*3.7+M.x*.04*(4.-fi);
      float tid=floor(x); float trunk=abs(fract(x)-.5+.1*(h1(vec2(tid,fi+8.))-.5)); float w=(.012+.022*h1(vec2(tid,fi)))*(1.+.5*(1.-uv.y));
      float crown=step(uv.y,.32+.45*h1(vec2(tid,fi+5.))+(.1*fbm(vec2(x*3.,uv.y*4.))))*step(abs(fract(x)-.5),.18+.25*(1.-uv.y));
      float ground=step(uv.y,.08+.14*fbm(vec2(x*1.5,fi))-fi*.02);
      float tree=clamp(step(trunk,w)+crown*.0+ground,0.,1.);
      vec3 tc=mix(vec3(.01,.03,.025),vec3(.07,.14,.13),fi/3.);
      float leaves=smoothstep(.5,.62,fbm(vec2(x*1.3,uv.y*2.5+fi)))*smoothstep(.55+fi*.05,.85,uv.y);
      col=mix(col,tc,max(tree,leaves*.92)); col=mix(col,vec3(.2,.32,.3),.1*fi*smoothstep(.5,0.,uv.y)); }
    col+=vec3(.25,.35,.33)*.25*smoothstep(.35,0.,uv.y)*fbm(vec2(p.x*2.+t*.03,uv.y*3.));
    for(int i=0;i<26;i++){ float fi=float(i); vec2 fp=vec2(h1(vec2(fi,1.)),h1(vec2(fi,2.)));
      fp+=.05*vec2(sin(t*.3+fi),cos(t*.23+fi*1.7)); fp.x*=R.x/R.y; fp.y=fp.y*.7+.05;
      float gl=.5+.5*sin(t*1.7+fi*3.); float d=length(p-fp);
      col+=mix(vec3(.95,1.,.45),A,.12)*(smoothstep(.012,0.,d)*1.5+.012/(d*d*900.+.6))*gl; }
    gl_FragColor=vec4(col,1.); }`,
  ocean: `void main(){ vec2 uv=gl_FragCoord.xy/R; vec2 p=(gl_FragCoord.xy-.5*R)/R.y*3.; float t=T*.35;
    vec3 col=mix(vec3(0.,.05,.12),vec3(.02,.24,.38),uv.y);
    vec2 q=p*1.3; for(int n=0;n<3;n++){ float fn=float(n); q+=.55*vec2(sin(q.y*1.6+t*1.3+fn),cos(q.x*1.4-t*1.1+fn*2.)); }
    float v=abs(sin(q.x*1.8)+sin(q.y*1.8))*.5; float caus=pow(max(1.-v,0.),6.);
    col+=vec3(.35,.8,.9)*caus*(.15+.55*uv.y);
    float rays=pow(max(0.,fbm(vec2(p.x*.7+uv.y*.5,t*.25))-.42),2.)*2.5; col+=vec3(.35,.7,.8)*rays*uv.y*.7;
    for(int k=0;k<16;k++){ float fk=float(k); vec2 b=vec2(h1(vec2(fk,3.)),fract(h1(vec2(fk,4.))+T*.025*(.5+h1(vec2(fk,5.))))); b.x+=.015*sin(T+fk);
      col+=vec3(.7,.95,1.)*smoothstep(.005,0.,length((uv-b)*vec2(R.x/R.y,1.)))*.7; }
    col=mix(col,A*.5,.05);
    gl_FragColor=vec4(col,1.); }`,
  sakura: `void main(){ vec2 uv=gl_FragCoord.xy/R; vec2 p=uv; p.x*=R.x/R.y; float t=T;
    vec3 col=mix(vec3(.98,.72,.78),vec3(.35,.4,.75),smoothstep(.0,1.,uv.y)); col=mix(col,vec3(.12,.12,.3),smoothstep(.6,1.2,uv.y));
    col+=vec3(1.,.9,.9)*.18*exp(-length(p-vec2(R.x/R.y*.2,.25))*3.);
    float hill=.12+.06*sin(p.x*2.+1.)+.04*fbm(vec2(p.x*3.,0.)); col=mix(col,vec3(.25,.18,.35),smoothstep(hill+.004,hill,uv.y));
    float far=.2+.1*fbm(vec2(p.x*1.2+3.,0.)); col=mix(col,mix(col,vec3(.55,.45,.7),.5),smoothstep(far+.004,far,uv.y));
    for(int l=0;l<3;l++){ float fl=float(l); vec2 g=p*(5.+fl*3.)+vec2(t*(.25+fl*.08),t*(.45+fl*.1)); vec2 id=floor(g); vec2 f=fract(g)-.5;
      float r=h1(id+fl*7.); if(r>.55){ float a=t*(1.+r*2.)+r*6.; vec2 q=f-(vec2(h1(id+1.),h1(id+2.))-.5)*.5;
        q=mat2(cos(a),-sin(a),sin(a),cos(a))*q; float petal=smoothstep(.07,.04,length(q*vec2(1.,2.2+sin(a*2.)*.8)));
        col=mix(col,mix(vec3(1.,.8,.88),vec3(1.,.62,.75),r),petal*(.9-fl*.2)); } }
    gl_FragColor=vec4(col,1.); }`,
};
const VERT = "attribute vec2 v; void main(){ gl_Position=vec4(v,0.,1.); }";

FX.startBg = function () {
  const bg = FX.bg, s = FX.s;
  bg.started = true;
  cancelAnimationFrame(bg.raf);
  bg.raf = 0;
  let scene = s.background || "aurora";
  const cv = document.getElementById("bg-canvas"), media = document.getElementById("bg-media");
  if (!cv || !media) return;
  document.body.classList.toggle("has-bg", scene !== "none");
  media.innerHTML = "";
  if (scene === "custom" && s.bg_custom) {
    cv.classList.add("hidden");
    const url = `/bgfile/${encodeURIComponent(s.bg_custom)}?k=${encodeURIComponent(S.token || "")}`;
    if (/\.(mp4|webm|mov)$/i.test(s.bg_custom)) media.innerHTML = `<video src="${url}" autoplay muted loop playsinline ${s.motion === "off" ? "" : ""}></video>`;
    else media.innerHTML = `<img src="${url}" alt="" class="${s.motion === "off" ? "" : "kb"}">`;
    const v = media.querySelector("video");
    if (v && s.motion === "off") v.addEventListener("loadeddata", () => v.pause(), { once: true });
    return;
  }
  if (scene === "none" || scene === "custom") { cv.classList.add("hidden"); return; }
  cv.classList.remove("hidden");
  if (!bg.gl) {
    bg.gl = cv.getContext("webgl", { antialias: false, depth: false, stencil: false, alpha: false, powerPreference: "low-power", preserveDrawingBuffer: false });
    if (!bg.gl) { cv.classList.add("hidden"); document.body.classList.add("no-webgl"); return; }
    const gl = bg.gl;
    gl.getExtension("OES_standard_derivatives");
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    cv.addEventListener("webglcontextlost", (e) => { e.preventDefault(); cancelAnimationFrame(bg.raf); bg.lost = true; });
    cv.addEventListener("webglcontextrestored", () => { bg.gl = null; bg.prog = null; bg.lost = false; FX.startBg(); });
  }
  if (bg.scene !== scene || !bg.prog) {
    const prog = FX.compile(scene);
    if (!prog) { scene = "aurora"; bg.prog = FX.compile("aurora"); } else bg.prog = prog;
    bg.scene = scene;
  }
  bg.still = s.motion === "off";
  bg.slow = 0; bg.frames = 0;
  FX.resizeBg();
  const loop = (now) => {
    bg.raf = 0;
    const fps = s.motion === "calm" ? 20 : 30;
    if (now - bg.last >= 1000 / fps - 2) {
      const dt = now - bg.last;
      bg.last = now;
      FX.drawBg(now);
      // auto quality: if frames come slow (an old graphics card), draw fewer pixels; still slow = stop moving
      if (dt < 400) {
        bg.frames++;
        if (dt > 1000 / fps * 1.8) bg.slow++;
        if (bg.frames >= 90) {
          if (bg.slow > 45) {
            if (bg.scale > 0.3) { bg.scale = Math.max(0.3, bg.scale - 0.1); FX.resizeBg(); }
            else { bg.still = true; }
          }
          bg.frames = 0; bg.slow = 0;
        }
      }
    }
    if (!bg.still && !bg.lost) bg.raf = requestAnimationFrame(loop);
  };
  FX.drawBg(performance.now());
  if (!bg.still) bg.raf = requestAnimationFrame(loop);
};
FX.compile = function (scene) {
  const gl = FX.bg.gl, src = SCENES[scene];
  if (!src) return null;
  const sh = (type, code) => { const x = gl.createShader(type); gl.shaderSource(x, code); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) { console.warn(scene, gl.getShaderInfoLog(x)); return null; } return x; };
  const fs = sh(gl.FRAGMENT_SHADER, "#extension GL_OES_standard_derivatives : enable\n" + GL_HEAD + src);
  const vs = sh(gl.VERTEX_SHADER, VERT);
  if (!fs || !vs) return null;
  const p = gl.createProgram();
  gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
  p.u = { R: gl.getUniformLocation(p, "R"), T: gl.getUniformLocation(p, "T"), A: gl.getUniformLocation(p, "A"), M: gl.getUniformLocation(p, "M") };
  p.v = gl.getAttribLocation(p, "v");
  return p;
};
FX.resizeBg = function () {
  const cv = document.getElementById("bg-canvas");
  if (!cv || !FX.bg.gl) return;
  const sc = FX.bg.scale * Math.min(window.devicePixelRatio || 1, 1.5);
  cv.width = Math.max(64, Math.round(innerWidth * sc));
  cv.height = Math.max(64, Math.round(innerHeight * sc));
  FX.bg.gl.viewport(0, 0, cv.width, cv.height);
  if (FX.bg.still || !FX.bg.raf) FX.drawBg(performance.now());
};
FX.accentRGB = function () {
  const a = /^#[0-9a-f]{6}$/i.test(FX.s.accent || "") ? FX.s.accent : "#ff6a2b";
  const n = parseInt(a.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
FX.drawBg = function (now) {
  const bg = FX.bg, gl = bg.gl, p = bg.prog;
  if (!gl || !p || bg.lost) return;
  const cv = gl.canvas;
  gl.useProgram(p);
  gl.enableVertexAttribArray(p.v);
  gl.vertexAttribPointer(p.v, 2, gl.FLOAT, false, 0, 0);
  const speed = FX.s.motion === "calm" ? 0.45 : 1;
  const t = bg.still ? 42 : ((now - bg.t0) / 1000) * speed + 42;
  gl.uniform2f(p.u.R, cv.width, cv.height);
  gl.uniform1f(p.u.T, t);
  const a = FX.accentRGB();
  gl.uniform3f(p.u.A, a[0], a[1], a[2]);
  gl.uniform2f(p.u.M, bg.mouse[0], bg.mouse[1]);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
};
window.addEventListener("resize", () => { clearTimeout(FX._rz); FX._rz = setTimeout(FX.resizeBg, 150); });
window.addEventListener("pointermove", (e) => {
  if (FX.s.motion !== "full") return;
  FX.bg.mouse[0] = FX.bg.mouse[0] * 0.9 + (e.clientX / innerWidth) * 0.1;
  FX.bg.mouse[1] = FX.bg.mouse[1] * 0.9 + (1 - e.clientY / innerHeight) * 0.1;
}, { passive: true });
document.addEventListener("visibilitychange", () => {
  // hidden window: nothing is drawn (requestAnimationFrame stops by itself); coming back: one fresh frame
  if (!document.hidden && FX.bg.gl && !FX.bg.raf && !FX.bg.still) FX.startBg();
});

/* a small preview of each scene for the picker (draws one frame into a picture) */
FX.preview = function (scene, w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const gl = c.getContext("webgl", { preserveDrawingBuffer: true, antialias: false });
  if (!gl) return "";
  gl.getExtension("OES_standard_derivatives");
  const old = FX.bg.gl; FX.bg.gl = gl;
  const p = FX.compile(scene);
  FX.bg.gl = old;
  if (!p) return "";
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.viewport(0, 0, w, h);
  gl.useProgram(p);
  gl.enableVertexAttribArray(p.v);
  gl.vertexAttribPointer(p.v, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(p.u.R, w, h); gl.uniform1f(p.u.T, 47);
  const a = FX.accentRGB(); gl.uniform3f(p.u.A, a[0], a[1], a[2]); gl.uniform2f(p.u.M, 0.5, 0.5);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const url = c.toDataURL("image/jpeg", 0.82);
  const lose = gl.getExtension("WEBGL_lose_context");
  if (lose) lose.loseContext();
  return url;
};
FX.SCENE_NAMES = { aurora: "Northern lights", nebula: "Space nebula", rain: "Rainy night window", waves: "Sunset sea",
  grid: "Neon grid", city: "Night city", forest: "Firefly forest", ocean: "Under the sea", sakura: "Cherry blossoms" };

/* ================================================================ the startup animation (once per start) */
FX.boot = function () {
  let seen = false;
  try { seen = sessionStorage.getItem("od_booted") === "1"; sessionStorage.setItem("od_booted", "1"); } catch (e) { /* private */ }
  if (seen || document.documentElement.dataset.motion === "off") return;
  const el = document.createElement("div");
  el.id = "boot";
  el.innerHTML = `<div class="boot-lines">${Array.from({ length: 14 }, (_, i) => `<i style="--i:${i};--y:${(i * 37) % 100}%"></i>`).join("")}</div>
    <div class="boot-core"><svg class="boot-mark" viewBox="0 0 64 64" aria-hidden="true"><path class="bm-arc" d="M12 44 A22 22 0 1 1 52 44"/><path class="bm-needle" d="M32 40 L46 24"/><circle cx="32" cy="40" r="4.5"/></svg>
    <div class="boot-word">${"OVERDRIVE".split("").map((c, i) => `<span style="--i:${i}">${c}</span>`).join("")}</div>
    <div class="boot-bar"><i></i></div></div>`;
  document.body.appendChild(el);
  const end = () => { if (!el.isConnected) return; el.classList.add("out"); setTimeout(() => el.remove(), 450); };
  el.addEventListener("click", end);
  document.addEventListener("keydown", end, { once: true });
  setTimeout(() => FX.play("boot"), 120);
  setTimeout(() => FX.play("whoosh2", { vol: 0.7 }), 900);
  setTimeout(end, 2100);
};
