/* ================================================================
   AUDIO (ANT WORK 3) — buses, reverb, 3D sound, synth SFX, scheduled music,
   ambience beds, REAL recorded sounds (SND) and baked voice clips (VOICE)
   ================================================================ */
const AU={ctx:null,ok:false};
let ACtx=null, master, comp, sfxBus, ambBus, musicBus, voiceBus, revIn, revSend, reverb, echoIn, NOISE_BUF, BROWN_BUF, PINK_BUF;
function initAudio(){
  if(AU.ok) { if(ACtx.state==='suspended') ACtx.resume(); return; }
  try{
    ACtx=new (window.AudioContext||window.webkitAudioContext)();
    master=ACtx.createGain(); master.gain.value=SETTINGS.master;
    comp=ACtx.createDynamicsCompressor(); comp.threshold.value=-16; comp.knee.value=12; comp.ratio.value=3.5; comp.attack.value=.004; comp.release.value=.22;
    master.connect(comp); comp.connect(ACtx.destination);
    reverb=ACtx.createConvolver(); reverb.buffer=makeImpulse(3.2,2.6);
    revIn=ACtx.createGain(); revIn.gain.value=.22; revIn.connect(reverb); reverb.connect(master);
    sfxBus=ACtx.createGain(); sfxBus.connect(master); sfxBus.connect(revIn);
    ambBus=ACtx.createGain(); ambBus.connect(master); ambBus.connect(revIn);
    musicBus=ACtx.createGain(); musicBus.connect(master);
    const mRev=ACtx.createGain(); mRev.gain.value=.35; musicBus.connect(mRev); mRev.connect(reverb);
    voiceBus=ACtx.createGain(); voiceBus.connect(master); voiceBus.connect(revIn);
    // echo send (the dream): a long feedback delay everything can bleed into
    echoIn=ACtx.createGain(); echoIn.gain.value=0;
    // a big dark hall: a soft, darkened slap-back that fades fast, then lots of reverb (no ping-pong robot repeats)
    const eDl=ACtx.createDelay(2); eDl.delayTime.value=.27; const eFb=ACtx.createGain(); eFb.gain.value=.28; const eLp=ACtx.createBiquadFilter(); eLp.type='lowpass'; eLp.frequency.value=1500; const eHp=ACtx.createBiquadFilter(); eHp.type='highpass'; eHp.frequency.value=180;
    const eOut=ACtx.createGain(); eOut.gain.value=.45;
    echoIn.connect(eDl); eDl.connect(eLp); eLp.connect(eHp); eHp.connect(eFb); eFb.connect(eDl); eHp.connect(eOut); eOut.connect(revIn); eOut.connect(master);
    for(const b of [sfxBus,ambBus]) b.connect(echoIn);
    const sr=ACtx.sampleRate;
    NOISE_BUF=(()=>{ const b=ACtx.createBuffer(1,sr*3,sr), d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; return b; })();
    BROWN_BUF=(()=>{ const b=ACtx.createBuffer(1,sr*3,sr), d=b.getChannelData(0); let l=0; for(let i=0;i<d.length;i++){ l=(l+.02*(Math.random()*2-1))/1.02; d[i]=l*3.5; } return b; })();
    PINK_BUF=(()=>{ const b=ACtx.createBuffer(1,sr*3,sr), d=b.getChannelData(0); let b0=0,b1=0,b2=0; for(let i=0;i<d.length;i++){ const w=Math.random()*2-1; b0=.99765*b0+w*.099046; b1=.963*b1+w*.2965164; b2=.57*b2+w*1.0526913; d[i]=(b0+b1+b2+w*.1848)*.18; } return b; })();
    AU.ok=true; AU.ctx=ACtx;
    applyVolumes();
    if(ACtx.state==='suspended') ACtx.resume();
  }catch(e){ console.warn('audio unavailable',e); AU.ok=false; }
}
function makeImpulse(sec,decay){
  const sr=ACtx.sampleRate, len=Math.floor(sr*sec), b=ACtx.createBuffer(2,len,sr);
  for(let c=0;c<2;c++){ const d=b.getChannelData(c); let lp=0; for(let i=0;i<len;i++){ lp=lp*.55+(Math.random()*2-1)*.45; const e=Math.pow(1-i/len,decay); d[i]=lp*e*(i<sr*.012?i/(sr*.012):1)*(1+.15*Math.sin(i*.0007*(c+1))); } }
  return b;
}
function applyVolumes(){
  if(!AU.ok) return;
  master.gain.setTargetAtTime(SETTINGS.master,ACtx.currentTime,.05);
  sfxBus.gain.setTargetAtTime(SETTINGS.sfx,ACtx.currentTime,.05);
  ambBus.gain.setTargetAtTime(SETTINGS.sfx*.8,ACtx.currentTime,.05);
  voiceBus.gain.setTargetAtTime(SETTINGS.voice==null?SETTINGS.sfx:SETTINGS.voice,ACtx.currentTime,.05);
  musicBus.gain.setTargetAtTime(SETTINGS.music*(MUS.duck||1)*.8,ACtx.currentTime,.3);
}
function setEcho(v){ VOICE.echo=v>0; if(AU.ok) echoIn.gain.setTargetAtTime(v,ACtx.currentTime,.3); }
function setReverb(amount){ if(AU.ok) revIn.gain.setTargetAtTime(amount,ACtx.currentTime,.4); }
const now=()=>AU.ok?ACtx.currentTime:0;

/* ---------- primitive voices ---------- */
function tone(freq,dur,type='sine',vol=.2,delay=0,slideTo=null,dest,attack=.006,filt=null){
  if(!AU.ok) return; dest=dest||sfxBus;
  const t0=ACtx.currentTime+delay, o=ACtx.createOscillator(), g=ACtx.createGain();
  o.type=type; o.frequency.setValueAtTime(Math.max(1,freq),t0);
  if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1,slideTo),t0+dur);
  const a=Math.min(attack,dur*.5);
  g.gain.setValueAtTime(.0001,t0); g.gain.linearRampToValueAtTime(vol,t0+a); g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
  if(filt){ const f=ACtx.createBiquadFilter(); f.type=filt[0]; f.frequency.value=filt[1]; f.Q.value=filt[2]||.7; o.connect(f); f.connect(g); } else o.connect(g);
  g.connect(dest); o.start(t0); o.stop(t0+dur+.05);
}
function noise(dur=.15,vol=.25,delay=0,freq=1000,ftype='lowpass',dest,q=.7,buf,slideTo=null,attack=.004){
  if(!AU.ok) return; dest=dest||sfxBus; buf=buf||NOISE_BUF;
  const t0=ACtx.currentTime+delay, s=ACtx.createBufferSource(); s.buffer=buf;
  const f=ACtx.createBiquadFilter(); f.type=ftype; f.frequency.setValueAtTime(freq,t0); f.Q.value=q;
  if(slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(20,slideTo),t0+dur);
  const g=ACtx.createGain(); g.gain.setValueAtTime(.0001,t0); g.gain.linearRampToValueAtTime(vol,t0+Math.min(attack,dur*.3)); g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t0,Math.random()*2,dur+.05);
}
function fm(freq,dur,ratio=2,index=2,vol=.15,delay=0,dest,attack=.004){
  if(!AU.ok) return; dest=dest||sfxBus;
  const t0=ACtx.currentTime+delay, c=ACtx.createOscillator(), m=ACtx.createOscillator(), mg=ACtx.createGain(), g=ACtx.createGain();
  c.frequency.value=freq; m.frequency.value=freq*ratio;
  mg.gain.setValueAtTime(freq*index,t0); mg.gain.exponentialRampToValueAtTime(Math.max(1,freq*.05),t0+dur);
  m.connect(mg); mg.connect(c.frequency);
  g.gain.setValueAtTime(.0001,t0); g.gain.linearRampToValueAtTime(vol,t0+attack); g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
  c.connect(g); g.connect(dest); c.start(t0); m.start(t0); c.stop(t0+dur+.05); m.stop(t0+dur+.05);
}

/* ---------- 3D audio ---------- */
function makePanner(ref=2,dest){
  const pn=ACtx.createPanner(); pn.panningModel='HRTF'; pn.distanceModel='inverse'; pn.refDistance=ref; pn.maxDistance=300; pn.rolloffFactor=1.2;
  pn.connect(dest||sfxBus); return pn;
}
function setPannerPos(pn,x,y,z){ if(pn.positionX){ pn.positionX.value=x; pn.positionY.value=y; pn.positionZ.value=z; } else pn.setPosition(x,y,z); }
/* play `fn(dest)` from a world position; fn must route into the given dest node */
function sfxAt(pos,fn,ref=2){ if(!AU.ok) return; const pn=makePanner(ref); setPannerPos(pn,pos.x,pos.y,pos.z); const d=pn; SFXDEST=d; try{ fn(); }finally{ SFXDEST=null; } setTimeout(()=>{ try{ pn.disconnect(); }catch(e){} },6000); }
let SFXDEST=null; const D=()=>SFXDEST||sfxBus;
const _lf=new THREE.Vector3(), _lu=new THREE.Vector3();
function updateListener(cam){
  if(!AU.ok) return; const L=ACtx.listener, p=cam.getWorldPosition(_lu); cam.getWorldDirection(_lf);
  if(L.positionX){ L.positionX.value=p.x; L.positionY.value=p.y; L.positionZ.value=p.z; L.forwardX.value=_lf.x; L.forwardY.value=_lf.y; L.forwardZ.value=_lf.z; L.upX.value=0; L.upY.value=1; L.upZ.value=0; }
  else if(L.setPosition){ L.setPosition(p.x,p.y,p.z); L.setOrientation(_lf.x,_lf.y,_lf.z,0,1,0); }
}

/* ---------- sound effects ---------- */
const SFX={
  // UI
  uiHover:()=>tone(1800,.04,'sine',.03,0,null,sfxBus),
  uiClick:()=>{ tone(900,.05,'triangle',.08); tone(1350,.06,'sine',.05,.03); },
  uiBack:()=>{ tone(700,.06,'triangle',.07); tone(470,.08,'sine',.05,.04); },
  uiOpen:()=>{ noise(.18,.05,0,2400,'bandpass',sfxBus,1.2,null,6000); tone(520,.1,'sine',.05); tone(780,.12,'sine',.05,.05); },
  toastUp:()=>{ tone(1046,.1,'sine',.06); tone(1568,.14,'sine',.05,.06); },
  objective:()=>{ fm(784,.5,2,1.2,.06); fm(1175,.6,2,1.2,.05,.1); },
  titleSlam:()=>{ tone(55,1.4,'sine',.5,0,32); noise(.9,.35,0,300,'lowpass',sfxBus,.7,BROWN_BUF); noise(.5,.08,0,6000,'highpass'); fm(220,1.8,1.5,3,.09,0); fm(330,1.8,1.5,3,.06,.02); },
  whoosh:(v=1)=>noise(.35,.12*v,0,600,'bandpass',D(),1.4,null,3000,.12),
  // footsteps by surface
  step:(surf='wood',v=1)=>{ if((surf==='sand'||surf==='stone')&&SND.has('step_'+surf+'_1')){ SND.play('step_'+surf+'_'+randi(1,6),{vol:(surf==='sand'?.5:.42)*v,dest:D(),rate:rand(.9,1.08)}); return; }
    const r=.85+Math.random()*.3, d=D();
    switch(surf){
      case 'grass': noise(.13,.08*v,0,2600*r,'bandpass',d,.8); noise(.08,.07*v,.02,600*r,'lowpass',d,.7,BROWN_BUF); break;
      case 'carpet': noise(.1,.09*v,0,420*r,'lowpass',d,.7,BROWN_BUF); break;
      case 'wood': noise(.06,.18*v,0,480*r,'lowpass',d,1,BROWN_BUF); tone(105*r,.07,'sine',.07*v,0,null,d); noise(.03,.04*v,.04,2600,'bandpass',d); if(Math.random()<.12) tone(300+Math.random()*200,.12,'triangle',.012,.02,200,d); break;
      case 'concrete': noise(.05,.14*v,0,1800*r,'bandpass',d,1.3); noise(.07,.08*v,0,300*r,'lowpass',d,.7,BROWN_BUF); break;
      case 'metal': noise(.04,.12*v,0,3000*r,'bandpass',d,2); tone(420*r,.12,'triangle',.03*v,0,380,d); tone(1260*r,.08,'sine',.012*v,0,null,d); noise(.06,.08*v,0,260,'lowpass',d,.7,BROWN_BUF); break;
      case 'tile': noise(.035,.14*v,0,4200*r,'bandpass',d,1.8); noise(.06,.06*v,.02,1500*r,'bandpass',d,1.2); break;
      case 'moon': noise(.22,.11*v,0,380*r,'lowpass',d,.7,BROWN_BUF); noise(.18,.04*v,.03,1800*r,'bandpass',d,.6); break;
      case 'mars': noise(.16,.1*v,0,900*r,'lowpass',d,.8,BROWN_BUF); noise(.12,.06*v,.02,3200*r,'bandpass',d,.9); break;
      case 'tiny': noise(.05,.05*v,0,5000*r,'bandpass',d,2); break;
      case 'gravel': for(let i=0;i<3;i++) noise(.03,.07*v,i*.02,3000+Math.random()*2500,'bandpass',d,2); noise(.08,.07*v,0,500,'lowpass',d,.7,BROWN_BUF); break;
      default: noise(.08,.1*v,0,500*r,'lowpass',d,.7,BROWN_BUF);
    }
  },
  land:(surf,v=1)=>{ noise(.14,.25*v,0,280,'lowpass',D(),.7,BROWN_BUF); SFX.step(surf,1.3*v); },
  jump:()=>noise(.08,.05,0,1600,'bandpass',D(),1),
  // house
  knock:()=>{ const d=D(); for(let i=0;i<3;i++){ noise(.07,.5,i*.26,420,'lowpass',d,1.2,BROWN_BUF); tone(140,.1,'sine',.18,i*.26,95,d); noise(.02,.12,i*.26,2200,'bandpass',d,2); } },
  doorOpen:()=>{ const d=D(); noise(.08,.18,0,2600,'bandpass',d,3); tone(1400,.05,'square',.03,0,null,d); noise(.7,.05,.08,900,'bandpass',d,4,null,500); tone(210,.6,'sawtooth',.012,.12,160,d,.2); },
  doorClose:()=>{ const d=D(); noise(.12,.45,0,240,'lowpass',d,.7,BROWN_BUF); tone(90,.18,'sine',.25,0,55,d); noise(.05,.12,.02,2800,'bandpass',d,3); },
  latch:()=>{ noise(.03,.2,0,3200,'bandpass',D(),4); tone(2100,.03,'square',.03,.01,null,D()); },
  // car
  carDoor:()=>{ const d=D(); noise(.1,.4,0,500,'lowpass',d,.7,BROWN_BUF); tone(120,.15,'sine',.2,0,70,d); noise(.04,.1,0,3500,'bandpass',d,3); },
  engineStart:()=>{ const d=D(); for(let i=0;i<5;i++) noise(.09,.18,i*.11,300+i*40,'lowpass',d,2,BROWN_BUF); tone(45,1.2,'sawtooth',.15,.55,70,d,.1,['lowpass',400]); noise(1,.12,.55,600,'lowpass',d,1,BROWN_BUF); },
  // keypad + hatch
  keyBeep:(n=0)=>{ tone(880+n*110,.09,'square',.06,0,null,D(),.002,['lowpass',3000]); noise(.02,.08,0,4000,'bandpass',D(),3); },
  keyOK:()=>{ tone(1320,.12,'square',.06,0,null,D(),.002,['lowpass',3000]); tone(1760,.2,'square',.06,.12,null,D(),.002,['lowpass',3000]); },
  bigButton:()=>{ noise(.05,.4,0,900,'lowpass',D(),1,BROWN_BUF); tone(300,.06,'square',.05,0,null,D()); },
  hydraulic:()=>{ const d=D(); noise(1.4,.14,0,3400,'highpass',d,.7); tone(70,1.4,'sawtooth',.1,0,48,d,.2,['lowpass',300]); noise(.3,.4,1.3,180,'lowpass',d,.7,BROWN_BUF); tone(55,.4,'sine',.3,1.3,40,d); },
  unlockClunk:()=>{ const d=D(); for(let i=0;i<4;i++){ noise(.05,.25,i*.09,1800,'bandpass',d,2); tone(160-i*10,.08,'square',.05,i*.09,null,d); } },
  ladder:()=>{ const d=D(); tone(640+Math.random()*80,.25,'triangle',.05,0,600,d); tone(1900,.15,'sine',.015,0,null,d); noise(.04,.15,0,2600,'bandpass',d,3); },
  // memories / flashback
  heartbeat:(v=1)=>{ tone(60,.16,'sine',.5*v,0,40); tone(52,.18,'sine',.38*v,.22,36); },
  tinnitus:(dur=3)=>{ tone(6200,dur,'sine',.018,0,null,sfxBus,.8); },
  memHit:()=>{ noise(.5,.25,0,300,'lowpass',sfxBus,.7,BROWN_BUF); noise(.35,.12,0,5000,'highpass',sfxBus,.7,null,800); tone(110,.9,'sawtooth',.08,0,55,sfxBus,.01,['lowpass',900]); fm(660,1.4,1.41,4,.05,.02); },
  revSwell:()=>{ noise(1.1,.14,0,400,'bandpass',sfxBus,1.2,null,6000,1.0); tone(220,1.1,'sine',.06,0,440,sfxBus,1); },
  bolt:()=>{ const d=D(); tone(1800,.35,'sawtooth',.14,0,90,d,.002); noise(.3,.3,0,4500,'bandpass',d,2,null,800); tone(90,.4,'square',.1,0,40,d); fm(440,.5,3.2,8,.06,0,d); },
  bodyFall:()=>{ const d=D(); noise(.25,.5,0,200,'lowpass',d,.7,BROWN_BUF); tone(58,.35,'sine',.4,0,34,d); noise(.1,.1,.05,1800,'bandpass',d,1.5); },
  drip:()=>{ const f=900+Math.random()*700; tone(f,.08,'sine',.05,0,f*2.2,D(),.002); },
  headShake:()=>{ noise(.25,.1,0,900,'bandpass',sfxBus,1.4,null,2400,.08); noise(.25,.09,.22,700,'bandpass',sfxBus,1.4,null,2000,.08); },
  sigh:()=>{ noise(1.1,.06,0,700,'bandpass',sfxBus,1.2,PINK_BUF,450,.3); },
  // radio / camera / suit
  radioOn:()=>{ noise(.25,.1,0,2400,'bandpass',sfxBus,1.5); tone(1200,.06,'square',.04,.22); tone(1600,.06,'square',.04,.29); },
  radioOff:()=>{ tone(1600,.05,'square',.04); tone(1000,.07,'square',.04,.06); noise(.15,.08,.1,2400,'bandpass',sfxBus,1.5); },
  static:(dur=.4,v=1)=>noise(dur,.06*v,0,2800,'bandpass',sfxBus,.8),
  shutter:()=>{ noise(.03,.35,0,5000,'highpass'); noise(.05,.25,.07,3000,'bandpass',sfxBus,2); tone(2400,.03,'square',.04,.02); noise(.5,.04,.14,1600,'bandpass',sfxBus,3,null,3000); tone(700,.35,'triangle',.02,.15,1200); },
  flashCharge:()=>tone(1200,.6,'sine',.02,0,5200,sfxBus,.2),
  suitUp:()=>{ noise(.4,.12,0,1200,'bandpass',sfxBus,1.2); for(let i=0;i<3;i++) noise(.04,.2,.4+i*.12,2400,'bandpass',sfxBus,3); noise(.8,.1,.8,3800,'highpass'); tone(420,.3,'sine',.05,1.4,880); },
  helmetSeal:()=>{ noise(.1,.3,0,700,'lowpass',sfxBus,1,BROWN_BUF); noise(1.1,.1,.1,4200,'highpass',sfxBus,.7,null,1400); fm(880,.6,2,1,.04,.4); },
  rayCharge:(dur=3)=>{ tone(80,dur,'sawtooth',.12,0,900,sfxBus,.4,['lowpass',1600]); tone(120,dur,'square',.04,0,1400,sfxBus,.4,['lowpass',2400]); for(let i=0;i<14;i++) noise(.04,.07,i*dur/14*(1-i/30),5000,'highpass'); },
  rayFire:()=>{ tone(2400,1.4,'sawtooth',.12,0,40,sfxBus,.002); noise(1.4,.35,0,6000,'bandpass',sfxBus,.8,null,200); tone(40,1.8,'sine',.5,0,20); fm(990,2,1.5,6,.08); },
  shrinkWarp:()=>{ tone(1600,2.2,'sine',.1,0,40,sfxBus,.1); tone(2400,2.2,'triangle',.04,0,60,sfxBus,.1); noise(2.2,.14,0,6000,'bandpass',sfxBus,1,null,200,.2); },
  zap:()=>{ tone(900,.18,'sawtooth',.1,0,80,D()); noise(.12,.18,0,2500,'bandpass',D(),3); },
  // tinyverse
  giantRumble:(dur=6)=>{ tone(28,dur,'sine',.6,0,22,sfxBus,1.5); tone(41,dur,'sawtooth',.08,0,30,sfxBus,2,['lowpass',120]); noise(dur,.3,0,90,'lowpass',sfxBus,.7,BROWN_BUF,60,2); },
  giantCall:()=>{ tone(90,4,'sawtooth',.12,0,60,sfxBus,.8,['lowpass',500]); tone(135,4,'sawtooth',.07,.2,85,sfxBus,.8,['lowpass',700]); fm(180,4,1.01,6,.05,.3); noise(4,.1,0,300,'bandpass',sfxBus,2,null,120,1); },
  microChirp:()=>{ const f=1200+Math.random()*1600; tone(f,.25,'sine',.025,0,f*1.4,D(),.03); tone(f*1.5,.2,'sine',.012,.08,f*.9,D(),.03); },
  whale:()=>{ const f=180+Math.random()*120; tone(f,2.6,'sine',.05,0,f*1.6,sfxBus,1); tone(f*2.01,2.6,'sine',.018,.1,f*3,sfxBus,1); },
  bubble:()=>{ const f=300+Math.random()*500; tone(f,.12,'sine',.07,0,f*2.6,D(),.004); },
  // moon / rocket
  pickup:()=>{ noise(.06,.2,0,1200,'bandpass',D(),2); tone(520,.12,'triangle',.07,0,780,D()); fm(1046,.3,2,1,.05,.06,D()); },
  cantCarry:()=>{ tone(220,.15,'square',.05,0,null,sfxBus,.004,['lowpass',1200]); tone(180,.2,'square',.05,.13,null,sfxBus,.004,['lowpass',1200]); },
  attach:()=>{ const d=D(); noise(.15,.35,0,900,'lowpass',d,1,BROWN_BUF); tone(180,.12,'square',.07,0,null,d); for(let i=0;i<10;i++) noise(.05,.12,.2+i*.07,5000+Math.random()*3000,'highpass',d); tone(3200,.7,'sawtooth',.012,.2,2400,d); fm(784,.5,2,1,.05,.95,d); fm(1175,.6,2,1,.05,1.05,d); },
  weld:()=>{ for(let i=0;i<6;i++) noise(.04,.1,i*.05,6000,'highpass',D()); },
  countBeep:(hi)=>{ tone(hi?1760:880,hi?.6:.25,'sine',.14,0,null,sfxBus,.004); },
  ignite:()=>{ noise(2.5,.6,0,500,'lowpass',sfxBus,.7,BROWN_BUF,200,.3); noise(2,.2,0,3000,'bandpass',sfxBus,.6); tone(38,3,'sawtooth',.25,0,30,sfxBus,.3,['lowpass',200]); },
  boom:()=>{ tone(45,1.6,'sine',.7,0,24); noise(1.6,.5,0,220,'lowpass',sfxBus,.7,BROWN_BUF); noise(.6,.2,0,3000,'bandpass'); },
  reentry:(dur=4)=>{ noise(dur,.35,0,700,'bandpass',sfxBus,.8,null,2600,1.2); tone(60,dur,'sawtooth',.12,0,90,sfxBus,1,['lowpass',300]); },
  moonThud:()=>{ noise(.35,.28,0,220,'lowpass',D(),.7,BROWN_BUF); noise(.5,.06,.02,900,'bandpass',D(),1); tone(60,.3,'sine',.2,0,35,D()); },
  // mars / work
  watchNew:()=>{ [1318,1568,1976,2637].forEach((f,i)=>fm(f,.6,3.5,.8,.05,i*.07)); noise(.6,.04,0,8000,'highpass'); tone(330,.8,'sine',.06,.3,660); },
  shrink:()=>{ [2637,1976,1568,1318,988,784].forEach((f,i)=>fm(f,.25,2,1.4,.05,i*.05)); tone(1400,.8,'sine',.12,0,90); noise(.8,.08,0,5000,'bandpass',sfxBus,1.2,null,400,.1); },
  grow:()=>{ [784,988,1318,1568,1976,2637].forEach((f,i)=>fm(f,.25,2,1.4,.05,i*.05)); tone(90,.8,'sine',.14,0,1400); noise(.8,.08,0,400,'bandpass',sfxBus,1.2,null,5000,.1); },
  punch:()=>{ noise(.12,.1,0,1400,'bandpass',sfxBus,1.2,null,500,.02); },
  hit:()=>{ const d=D(); noise(.07,.35,0,900,'lowpass',d,.7,BROWN_BUF); noise(.05,.15,0,3500,'bandpass',d,2); tone(170,.08,'sine',.14,0,70,d); },
  squish:()=>{ const d=D(); noise(.25,.25,0,700,'lowpass',d,1.5,null,200); tone(260,.2,'sine',.1,0,90,d); for(let i=0;i<3;i++) tone(500+Math.random()*400,.06,'sine',.03,.05+i*.05,900,d); },
  chop:()=>{ const d=D(); noise(.05,.35,0,4200,'highpass',d); noise(.14,.2,.03,800,'lowpass',d,.7,BROWN_BUF); for(let i=0;i<5;i++) noise(.03,.16,.03+i*.025,2000+Math.random()*3000,'bandpass',d,3); },
  bite:()=>{ noise(.08,.3,0,700,'lowpass',sfxBus,1,BROWN_BUF); tone(200,.1,'square',.08,.02,null,sfxBus,.004,['lowpass',1200]); },
  chitter:()=>{ const d=D(); for(let i=0;i<5;i++) noise(.02,.05,i*.03,5000+Math.random()*2000,'bandpass',d,6); },
  alarm:()=>{ for(let i=0;i<3;i++){ tone(1320,.14,'square',.08,i*.3,null,sfxBus,.003,['lowpass',3000]); tone(990,.14,'square',.08,i*.3+.15,null,sfxBus,.003,['lowpass',3000]); } },
  cash:()=>{ tone(1318,.09,'square',.06,0,null,sfxBus,.003,['lowpass',4000]); tone(1760,.18,'square',.06,.08,null,sfxBus,.003,['lowpass',4000]); tone(2637,.12,'sine',.05,.14); noise(.05,.05,0,6000,'highpass'); noise(.3,.08,.2,5500,'highpass'); },
  coin:()=>{ fm(1976,.35,3.01,1.5,.07); fm(2637,.5,3.01,1.5,.06,.06); },
  coins:()=>{ for(let i=0;i<9;i++) fm(1800+Math.random()*1200,.3,3.01,1.4,.04,i*.06); },
  converter:()=>{ tone(100,1.6,'sawtooth',.06,0,420,sfxBus,.2,['lowpass',900]); for(let i=0;i<12;i++) tone(400+i*120,.06,'square',.025,.1+i*.11,null,sfxBus,.003,['lowpass',2500]); noise(1.4,.06,0,3000,'bandpass',sfxBus,2); },
  paper:()=>{ noise(.15,.15,0,3200,'highpass'); noise(.25,.1,.1,2000,'bandpass'); },
  bubbleLoop:()=>{ for(let i=0;i<4;i++){ const f=160+Math.random()*260; tone(f,.14,'sine',.06,i*.08+Math.random()*.05,f*2.2,D(),.004); } },
  splash:()=>{ noise(.4,.3,0,1500,'bandpass',D(),.8,null,400); for(let i=0;i<5;i++) SFX.bubble(); },
  stir:()=>{ noise(.5,.1,0,600,'bandpass',D(),1.5,null,1200,.1); for(let i=0;i<3;i++) tone(200+i*40,.12,'sine',.04,i*.14,400,D()); },
  sizzle:(dur=1.2)=>{ noise(dur,.1,0,5000,'highpass'); for(let i=0;i<10;i++) noise(.02,.1,Math.random()*dur,6500,'highpass'); },
  burnt:()=>{ tone(220,.3,'sawtooth',.05,0,110,sfxBus,.003,['lowpass',900]); noise(.8,.12,0,2000,'highpass',sfxBus,.7,null,600); },
  ding:()=>{ fm(1568,1.2,3.5,1,.08); fm(2093,1.2,3.5,1,.05,.02); },
  // houses
  holoSign:()=>{ fm(660,.4,1.5,2,.03); tone(1320,.1,'sine',.02,.1); },
  keys:()=>{ for(let i=0;i<6;i++) fm(2600+Math.random()*1800,.12,2.7,1,.03,i*.05+Math.random()*.03); },
  alienDoor:()=>{ tone(180,.8,'sine',.1,0,520); noise(.9,.1,0,1600,'bandpass',sfxBus,2,null,3600); fm(523,.6,1.5,2,.04,.5); },
  pcBoot:()=>{ for(let i=0;i<8;i++) tone(300+Math.random()*1600,.05,'square',.02,i*.07,null,sfxBus,.002,['lowpass',3000]); fm(440,.9,1.5,2,.05,.6); fm(660,.9,1.5,2,.04,.75); },
  pcKey:()=>{ noise(.02,.07,0,3500,'bandpass',sfxBus,2); },
  yawn:()=>{ noise(1.4,.06,0,500,'bandpass',sfxBus,2,PINK_BUF,300,.4); },
  // intro
  crumb:()=>{ for(let i=0;i<4;i++) noise(.025,.12,i*.03,3500+Math.random()*3500,'bandpass',sfxBus,4); },
  munch:()=>{ for(let i=0;i<3;i++){ noise(.04,.1,i*.07,2400+Math.random()*2400,'bandpass',sfxBus,5); } tone(400,.05,'sine',.02,0,300); },
  antStep:()=>noise(.01,.02,0,7000,'highpass'),
  gulp:()=>{ tone(300,.12,'sine',.06,0,140); tone(180,.14,'sine',.05,.1,120); },
  sparkle:()=>{ [2093,2637,3136,4186].forEach((f,i)=>tone(f,.25,'sine',.03,i*.05)); }
};

/* ---------- sound effects added for the Tinyverse creatures + Mars days 2-3 ---------- */
Object.assign(SFX,{
  swimStroke:()=>{ const d=D(); noise(.55,.09,0,380,'bandpass',d,1.1,PINK_BUF,1500,.12); noise(.4,.05,.12,900,'bandpass',d,.8,null,300,.1); for(let i=0;i<3;i++){ const f=320+Math.random()*420; tone(f,.09,'sine',.035,.18+i*.07,f*2.4,d); } },
  swimScull:()=>noise(.8,.035,0,300,'lowpass',D(),.7,PINK_BUF,500,.3),
  netSwing:()=>{ noise(.28,.14,0,1800,'bandpass',sfxBus,1.1,null,500,.03); noise(.2,.06,.05,4200,'highpass',sfxBus); },
  netCatch:()=>{ const d=D(); noise(.12,.18,0,700,'lowpass',d,1.2); tone(520,.12,'sine',.08,.02,1040,d); fm(1568,.4,3.01,1.4,.05,.08,d); fm(2093,.45,3.01,1.4,.04,.14,d); },
  chomp:()=>{ tone(70,.9,'sine',.6,0,32); noise(.5,.55,0,260,'lowpass',sfxBus,.8,BROWN_BUF); noise(.08,.4,.05,1200,'bandpass',sfxBus,2); noise(.08,.35,.32,900,'bandpass',sfxBus,2); tone(140,.25,'square',.08,.3,60,sfxBus,.003,['lowpass',600]); },
  slurp:()=>{ noise(1.1,.22,0,250,'bandpass',sfxBus,3,PINK_BUF,2200,.2); tone(180,1,'sine',.1,0,520,sfxBus,.1); },
  suitHit:()=>{ const d=D(); noise(.12,.5,0,600,'lowpass',d,.7,BROWN_BUF); tone(880,.5,'triangle',.08,0,860,d); tone(1320,.4,'sine',.05,.02,1300,d); noise(.3,.15,.05,3000,'highpass',d); },
  suitAlarm:()=>{ for(let i=0;i<4;i++) tone(i%2?1000:1500,.14,'square',.05,i*.17,null,sfxBus,.003,['lowpass',3500]); },
  suitShield:()=>{ fm(660,.9,1.5,2.5,.06); fm(990,.9,1.5,2.5,.04,.08); noise(.8,.05,0,5000,'highpass',sfxBus,.7,null,2000,.2); },
  gurgle:()=>{ const d=D(); for(let i=0;i<6;i++){ const f=90+Math.random()*80; tone(f,.3,'sawtooth',.05,i*.1,f*.6,d,.02,['lowpass',400]); } noise(.9,.12,0,300,'lowpass',d,4,BROWN_BUF,120,.2); },
  squirm:()=>{ const d=D(); noise(.5,.08,0,800,'bandpass',d,3,null,1600,.1); tone(600,.3,'sine',.03,0,900,d); },
  snore:()=>{ noise(1.3,.14,0,260,'lowpass',sfxBus,3,PINK_BUF,160,.5); tone(85,1.2,'sawtooth',.03,.05,70,sfxBus,.4,['lowpass',300]); noise(.9,.05,1.5,1400,'bandpass',sfxBus,1.2,PINK_BUF,500,.3); },
  alarmClock:()=>{ for(let i=0;i<4;i++){ fm(2093,.09,2,1.2,.08,i*.12); fm(2637,.09,2,1.2,.05,i*.12+.02); } },
  slap:()=>{ noise(.06,.55,0,1400,'lowpass',sfxBus,.7); noise(.04,.3,0,5000,'highpass'); tone(160,.1,'sine',.15,0,90); },
  heartRace:(n=10)=>{ let t=0; for(let i=0;i<n;i++){ const g=Math.max(.32,.9-i*.07); tone(60,.14,'sine',.55,t,40); tone(52,.16,'sine',.4,t+.14,36); t+=g; } },
  tap:()=>{ noise(.035,.3,0,1800,'bandpass',sfxBus,1.5); noise(.035,.3,.16,1800,'bandpass',sfxBus,1.5); },
  disintegrate:()=>{ noise(3.5,.2,0,6000,'highpass',sfxBus,.7,null,1200,.3); for(let i=0;i<40;i++) noise(.02,.08,Math.random()*3,3000+Math.random()*5000,'bandpass',sfxBus,3); tone(220,3,'sine',.05,0,55,sfxBus,.3); },
  dreamSwell:()=>{ noise(2.2,.12,0,300,'bandpass',sfxBus,1.2,PINK_BUF,3000,2); tone(110,2.4,'sine',.08,0,220,sfxBus,1.8); },
  blink:()=>noise(.12,.04,0,1200,'bandpass',sfxBus,1),
  gasp:()=>{ noise(.5,.12,0,1200,'bandpass',sfxBus,1.4,PINK_BUF,2400,.05); },
  pizzaBite:()=>{ for(let i=0;i<3;i++) noise(.05,.14,i*.09,2200+Math.random()*1500,'bandpass',sfxBus,1.4); noise(.25,.08,.1,500,'lowpass',sfxBus,.7,BROWN_BUF); }
});

/* ---------- ambience beds (looping, crossfaded per level) ---------- */
const AMB={beds:{},events:[],evtT:0};
function ambBed(name,o){
  if(!AU.ok) return null;
  if(AMB.beds[name]) return AMB.beds[name];
  const L=Object.assign({kind:'noise',freq:400,ftype:'lowpass',q:.7,vol:.1,osc:'sine',oscFreq:60,lfo:0,lfoRate:.2,buf:BROWN_BUF},o);
  L.out=ACtx.createGain(); L.out.gain.value=0;
  if(L.kind==='noise'){ L.src=ACtx.createBufferSource(); L.src.buffer=L.buf; L.src.loop=true; L.f=ACtx.createBiquadFilter(); L.f.type=L.ftype; L.f.frequency.value=L.freq; L.f.Q.value=L.q; L.src.connect(L.f); L.f.connect(L.out);
    if(L.lfo){ const l=ACtx.createOscillator(); l.frequency.value=L.lfoRate; const lg=ACtx.createGain(); lg.gain.value=L.lfo; l.connect(lg); lg.connect(L.f.frequency); l.start(); } }
  else { L.src=ACtx.createOscillator(); L.src.type=L.osc; L.src.frequency.value=L.oscFreq; L.f=ACtx.createBiquadFilter(); L.f.type='lowpass'; L.f.frequency.value=L.freq; L.src.connect(L.f); L.f.connect(L.out);
    if(L.lfo){ const l=ACtx.createOscillator(); l.frequency.value=L.lfoRate; const lg=ACtx.createGain(); lg.gain.value=L.lfo; l.connect(lg); lg.connect(L.src.frequency); l.start(); } }
  L.out.connect(ambBus); L.src.start(); L.on=false; AMB.beds[name]=L; return L;
}
const AMB_DEFS={
  room:{freq:180,vol:.05}, fridge:{kind:'osc',osc:'sawtooth',oscFreq:58,freq:160,vol:.012},
  wind:{freq:500,ftype:'bandpass',q:.5,vol:.07,lfo:250,lfoRate:.07,buf:null},
  breeze:{freq:1200,ftype:'bandpass',q:.4,vol:.035,lfo:500,lfoRate:.11,buf:null},
  road:{freq:260,vol:.14,lfo:40,lfoRate:.5}, engine:{kind:'osc',osc:'sawtooth',oscFreq:48,freq:240,vol:.05,lfo:3,lfoRate:7},
  labHum:{kind:'osc',osc:'sawtooth',oscFreq:60,freq:220,vol:.03}, labAir:{freq:2400,ftype:'bandpass',q:.4,vol:.03,buf:null},
  tiny:{freq:220,ftype:'lowpass',vol:.12,lfo:120,lfoRate:.05}, tinyHi:{freq:3200,ftype:'bandpass',q:2,vol:.012,lfo:1500,lfoRate:.13,buf:null},
  spaceDrone:{kind:'osc',osc:'sine',oscFreq:44,freq:300,vol:.08,lfo:1.5,lfoRate:.1}, moonHum:{freq:140,vol:.05},
  rocket:{freq:320,vol:.5,lfo:80,lfoRate:9}, marsWind:{freq:700,ftype:'bandpass',q:.6,vol:.08,lfo:400,lfoRate:.05,buf:null},
  crowd:{freq:900,ftype:'bandpass',q:1.2,vol:.02,lfo:300,lfoRate:.3,buf:null}, pot:{freq:260,vol:.0,lfo:120,lfoRate:4},
  alienHome:{kind:'osc',osc:'sine',oscFreq:110,freq:400,vol:.02,lfo:2,lfoRate:.2}
};
function setAmbience(list,fade=1.2){
  if(!AU.ok) return;
  const want=new Set(list.map(x=>typeof x==='string'?x:x[0]));
  for(const n in AMB.beds){ if(!want.has(n)){ const L=AMB.beds[n]; L.out.gain.setTargetAtTime(0,ACtx.currentTime,fade/3); L.on=false; } }
  for(const x of list){ const n=typeof x==='string'?x:x[0], v=typeof x==='string'?null:x[1]; const def=AMB_DEFS[n]; if(!def) continue; const L=ambBed(n,Object.assign({},def,{buf:def.buf===null?NOISE_BUF:def.buf===undefined?BROWN_BUF:def.buf})); L.out.gain.setTargetAtTime(v!=null?v:def.vol,ACtx.currentTime,fade/3); L.on=true; }
}
function ambVol(name,v,tc=.3){ const L=AMB.beds[name]; if(L&&AU.ok) L.out.gain.setTargetAtTime(v,ACtx.currentTime,tc); }
function ambFreq(name,f,tc=.3){ const L=AMB.beds[name]; if(L&&AU.ok){ if(L.kind==='osc') L.src.frequency.setTargetAtTime(f,ACtx.currentTime,tc); else L.f.frequency.setTargetAtTime(f,ACtx.currentTime,tc); } }
/* random one-shot ambience events (birds, beeps, distant cars...) chosen per level */
const AMB_EVENTS={
  birds:()=>{ const base=2400+Math.random()*1600, n=2+(Math.random()*4|0), pn=makePanner(4,ambBus); setPannerPos(pn,camera.position.x+rand(-25,25),camera.position.y+rand(3,10),camera.position.z+rand(-25,25)); for(let i=0;i<n;i++){ const f=base*(1+Math.random()*.15); tone(f,.08,'sine',.04,i*.1,f*(Math.random()<.5?1.35:.7),pn,.01); } },
  dog:()=>{ const pn=makePanner(6,ambBus); setPannerPos(pn,camera.position.x+rand(-40,40),1,camera.position.z+rand(-40,40)); for(let i=0;i<2;i++){ noise(.12,.12,i*.25,700,'bandpass',pn,3); tone(420,.1,'sawtooth',.02,i*.25,300,pn,.01,['lowpass',900]); } },
  car:()=>{ noise(3.5,.03,0,300,'lowpass',ambBus,.7,BROWN_BUF,500,1.4); },
  labBeep:()=>{ const pn=makePanner(2,ambBus); setPannerPos(pn,camera.position.x+rand(-6,6),1.5,camera.position.z+rand(-6,6)); tone(pick([880,1320,1760,2093]),.07,'square',.02,0,null,pn,.002,['lowpass',3000]); },
  microChirp:()=>SFX.microChirp(), whale:()=>SFX.whale(),
  robotBeep:()=>{ const pn=makePanner(3,ambBus); setPannerPos(pn,camera.position.x+rand(-15,15),1.5,camera.position.z+rand(-15,15)); for(let i=0;i<3;i++) tone(rand(600,1800),.06,'square',.02,i*.08,null,pn,.002,['lowpass',2500]); },
  moonRadio:()=>{ noise(.4,.02,0,2400,'bandpass',ambBus,1); tone(1200,.05,'sine',.01,.3); },
  alienHum:()=>fm(rand(200,400),2,1.5,2,.012,0,ambBus,.6)
};
function setAmbEvents(list){ AMB.events=list||[]; AMB.evtT=rand(1,4); }
function updateAmbEvents(dt){ if(!AU.ok||!AMB.events.length||G.mode!=='play') return; AMB.evtT-=dt; if(AMB.evtT<=0){ const e=pick(AMB.events); AMB.evtT=e[1]*(.5+Math.random()); try{ AMB_EVENTS[e[0]](); }catch(err){} } }

/* ---------- music: note helpers + instruments + lookahead scheduler ---------- */
function hz(s){ if(!s||s==='-'||s==='.') return 0; const m=s.match(/^([A-G])(#|b)?(-?\d)$/); if(!m) return 0; const base={C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0); return 440*Math.pow(2,((+m[3]+1)*12+base-69)/12); }
const notes=s=>s.trim().split(/\s+/).map(hz);
const INST={
  epiano:(f,t,d,v,out)=>{ const c=ACtx.createOscillator(), m=ACtx.createOscillator(), mg=ACtx.createGain(), g=ACtx.createGain(); c.frequency.value=f; m.frequency.value=f*1.0; mg.gain.setValueAtTime(f*1.6,t); mg.gain.exponentialRampToValueAtTime(f*.08,t+Math.min(1.2,d)); m.connect(mg); mg.connect(c.frequency); g.gain.setValueAtTime(.0001,t); g.gain.linearRampToValueAtTime(v,t+.008); g.gain.exponentialRampToValueAtTime(v*.35,t+.25); g.gain.exponentialRampToValueAtTime(.0001,t+d+.35); c.connect(g); g.connect(out); c.start(t); m.start(t); c.stop(t+d+.4); m.stop(t+d+.4); },
  pad:(f,t,d,v,out,cut=1400)=>{ const g=ACtx.createGain(), fl=ACtx.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=cut; fl.Q.value=.4; g.gain.setValueAtTime(.0001,t); g.gain.linearRampToValueAtTime(v,t+Math.min(1.2,d*.4)); g.gain.setValueAtTime(v,t+d*.8); g.gain.linearRampToValueAtTime(.0001,t+d+.9); fl.connect(g); g.connect(out); for(const dt of [-7,0,7]){ const o=ACtx.createOscillator(); o.type='sawtooth'; o.frequency.value=f; o.detune.value=dt; o.connect(fl); o.start(t); o.stop(t+d+1); } },
  glass:(f,t,d,v,out)=>{ const g=ACtx.createGain(); g.gain.setValueAtTime(.0001,t); g.gain.linearRampToValueAtTime(v,t+Math.min(.8,d*.4)); g.gain.linearRampToValueAtTime(.0001,t+d+1.2); g.connect(out); for(const [r,a] of [[1,1],[2.01,.3],[3.02,.12]]){ const o=ACtx.createOscillator(); o.type='sine'; o.frequency.value=f*r; const og=ACtx.createGain(); og.gain.value=a; o.connect(og); og.connect(g); o.start(t); o.stop(t+d+1.3); } },
  pluck:(f,t,d,v,out)=>{ const o=ACtx.createOscillator(), fl=ACtx.createBiquadFilter(), g=ACtx.createGain(); o.type='sawtooth'; o.frequency.value=f; fl.type='lowpass'; fl.frequency.setValueAtTime(f*8,t); fl.frequency.exponentialRampToValueAtTime(f*1.2,t+.25); g.gain.setValueAtTime(.0001,t); g.gain.linearRampToValueAtTime(v,t+.004); g.gain.exponentialRampToValueAtTime(.0001,t+Math.min(.5,d+.2)); o.connect(fl); fl.connect(g); g.connect(out); o.start(t); o.stop(t+.6); },
  bell:(f,t,d,v,out)=>{ const c=ACtx.createOscillator(), m=ACtx.createOscillator(), mg=ACtx.createGain(), g=ACtx.createGain(); c.frequency.value=f; m.frequency.value=f*3.5; mg.gain.setValueAtTime(f*2.2,t); mg.gain.exponentialRampToValueAtTime(f*.02,t+1.5); m.connect(mg); mg.connect(c.frequency); g.gain.setValueAtTime(.0001,t); g.gain.linearRampToValueAtTime(v,t+.004); g.gain.exponentialRampToValueAtTime(.0001,t+1.8); c.connect(g); g.connect(out); c.start(t); m.start(t); c.stop(t+1.9); m.stop(t+1.9); },
  bass:(f,t,d,v,out)=>{ const o=ACtx.createOscillator(), o2=ACtx.createOscillator(), fl=ACtx.createBiquadFilter(), g=ACtx.createGain(); o.type='sine'; o2.type='triangle'; o.frequency.value=f; o2.frequency.value=f*2; fl.type='lowpass'; fl.frequency.value=700; const g2=ACtx.createGain(); g2.gain.value=.25; g.gain.setValueAtTime(.0001,t); g.gain.linearRampToValueAtTime(v,t+.01); g.gain.exponentialRampToValueAtTime(v*.6,t+d*.6); g.gain.exponentialRampToValueAtTime(.0001,t+d+.08); o.connect(g); o2.connect(g2); g2.connect(fl); fl.connect(g); g.connect(out); o.start(t); o2.start(t); o.stop(t+d+.1); o2.stop(t+d+.1); },
  synbass:(f,t,d,v,out)=>{ const o=ACtx.createOscillator(), fl=ACtx.createBiquadFilter(), g=ACtx.createGain(); o.type='sawtooth'; o.frequency.value=f; fl.type='lowpass'; fl.Q.value=6; fl.frequency.setValueAtTime(f*10,t); fl.frequency.exponentialRampToValueAtTime(f*1.5,t+.18); g.gain.setValueAtTime(.0001,t); g.gain.linearRampToValueAtTime(v,t+.005); g.gain.exponentialRampToValueAtTime(.0001,t+d+.05); o.connect(fl); fl.connect(g); g.connect(out); o.start(t); o.stop(t+d+.1); },
  lead:(f,t,d,v,out)=>{ const o=ACtx.createOscillator(), vib=ACtx.createOscillator(), vg=ACtx.createGain(), fl=ACtx.createBiquadFilter(), g=ACtx.createGain(); o.type='triangle'; o.frequency.value=f; vib.frequency.value=5.5; vg.gain.setValueAtTime(0,t); vg.gain.linearRampToValueAtTime(f*.012,t+.25); vib.connect(vg); vg.connect(o.frequency); fl.type='lowpass'; fl.frequency.value=f*6; g.gain.setValueAtTime(.0001,t); g.gain.linearRampToValueAtTime(v,t+.03); g.gain.setValueAtTime(v*.8,t+d*.7); g.gain.exponentialRampToValueAtTime(.0001,t+d+.12); o.connect(fl); fl.connect(g); g.connect(out); o.start(t); vib.start(t); o.stop(t+d+.15); vib.stop(t+d+.15); },
  square:(f,t,d,v,out)=>{ const o=ACtx.createOscillator(), fl=ACtx.createBiquadFilter(), g=ACtx.createGain(); o.type='square'; o.frequency.value=f; fl.type='lowpass'; fl.frequency.value=f*4; g.gain.setValueAtTime(.0001,t); g.gain.linearRampToValueAtTime(v,t+.005); g.gain.exponentialRampToValueAtTime(.0001,t+d+.05); o.connect(fl); fl.connect(g); g.connect(out); o.start(t); o.stop(t+d+.1); },
  brass:(f,t,d,v,out)=>{ const g=ACtx.createGain(), fl=ACtx.createBiquadFilter(); fl.type='lowpass'; fl.frequency.setValueAtTime(f*1.5,t); fl.frequency.linearRampToValueAtTime(f*5,t+.3); fl.frequency.linearRampToValueAtTime(f*2.5,t+d); g.gain.setValueAtTime(.0001,t); g.gain.linearRampToValueAtTime(v,t+.12); g.gain.setValueAtTime(v,t+d*.8); g.gain.linearRampToValueAtTime(.0001,t+d+.3); fl.connect(g); g.connect(out); for(const dt of [-5,5]){ const o=ACtx.createOscillator(); o.type='sawtooth'; o.frequency.value=f; o.detune.value=dt; o.connect(fl); o.start(t); o.stop(t+d+.4); } },
  kick:(t,v,out)=>{ const o=ACtx.createOscillator(), g=ACtx.createGain(); o.frequency.setValueAtTime(150,t); o.frequency.exponentialRampToValueAtTime(42,t+.12); g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.0001,t+.3); o.connect(g); g.connect(out); o.start(t); o.stop(t+.32); },
  snare:(t,v,out)=>{ const s=ACtx.createBufferSource(); s.buffer=NOISE_BUF; const f=ACtx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1900; f.Q.value=.8; const g=ACtx.createGain(); g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.0001,t+.18); s.connect(f); f.connect(g); g.connect(out); s.start(t,Math.random()*2,.2); const o=ACtx.createOscillator(), og=ACtx.createGain(); o.frequency.setValueAtTime(220,t); o.frequency.exponentialRampToValueAtTime(140,t+.08); og.gain.setValueAtTime(v*.5,t); og.gain.exponentialRampToValueAtTime(.0001,t+.1); o.connect(og); og.connect(out); o.start(t); o.stop(t+.12); },
  hat:(t,v,out,open)=>{ const s=ACtx.createBufferSource(); s.buffer=NOISE_BUF; const f=ACtx.createBiquadFilter(); f.type='highpass'; f.frequency.value=7500; const g=ACtx.createGain(); const d=open?.22:.045; g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.0001,t+d); s.connect(f); f.connect(g); g.connect(out); s.start(t,Math.random()*2,d+.02); },
  clap:(t,v,out)=>{ for(let i=0;i<3;i++){ const s=ACtx.createBufferSource(); s.buffer=NOISE_BUF; const f=ACtx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1200; f.Q.value=1.2; const g=ACtx.createGain(); const tt=t+i*.012; g.gain.setValueAtTime(v,tt); g.gain.exponentialRampToValueAtTime(.0001,tt+.12); s.connect(f); f.connect(g); g.connect(out); s.start(tt,Math.random()*2,.14); } },
  shaker:(t,v,out)=>{ const s=ACtx.createBufferSource(); s.buffer=NOISE_BUF; const f=ACtx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=6000; f.Q.value=1; const g=ACtx.createGain(); g.gain.setValueAtTime(.0001,t); g.gain.linearRampToValueAtTime(v,t+.02); g.gain.exponentialRampToValueAtTime(.0001,t+.08); s.connect(f); f.connect(g); g.connect(out); s.start(t,Math.random()*2,.1); }
};
/* A song: bpm, chords (list of note-strings, one per bar), and optional parts.
   Parts are 16-step patterns; numbers index into the current chord (0,1,2..), with
   +12 style octave shifts written as e.g. 'x1' (index 1, up an octave). */
const SONGS={
  title:{bpm:92,swing:.12,chords:['F3 A3 C4 E4','D3 F3 A3 C4','Bb2 D3 F3 A3','C3 E3 G3 Bb3'],pad:{inst:'pad',vol:.035,cut:1100},keys:{inst:'epiano',vol:.06,pat:'0.2.1.3.0.2.1.3.'},bass:{inst:'bass',vol:.16,pat:'0...0.0.....0...'},drums:{k:'x.....x...x.....',s:'....x.......x...',h:'..x...x...x...x.',vol:.5},lead:{inst:'lead',vol:.045,mel:'A4 - C5 - E5 - D5 C5 A4 - F4 - G4 - - - F4 - A4 - D5 - C5 A4 G4 - E4 - F4 - - - E4 - G4 - Bb4 - A4 G4 E4 - C4 - D4 - E4 - C5 - A4 - G4 - E4 - F4 - - -'}},
  home:{bpm:78,swing:.18,chords:['C3 E3 G3 B3','A2 C3 E3 G3','F2 A2 C3 E3','G2 B2 D3 F3'],pad:{inst:'pad',vol:.028,cut:900},keys:{inst:'epiano',vol:.07,pat:'0...2.1...3...2.'},bass:{inst:'bass',vol:.14,pat:'0.......0...0...'},drums:{k:'x.......x.x.....',s:'....x.......x...',h:'x.x.x.x.x.x.x.x.',vol:.28}},
  flash:{bpm:60,chords:['C2 G2 C#3','C2 G2 D3','C2 F#2 C#3','C2 G2 C3'],pad:{inst:'pad',vol:.05,cut:500},keys:{inst:'glass',vol:.04,pat:'2.......1.......'}},
  jim:{bpm:118,swing:.1,chords:['G3 B3 D4','E3 G3 B3','C3 E3 G3','D3 F#3 A3'],keys:{inst:'pluck',vol:.06,pat:'0.1.2.1.0.1.2.x0.'},bass:{inst:'bass',vol:.17,pat:'0...0.0.0...0.0.'},drums:{k:'x...x...x...x...',s:'....x.......x..x',h:'.x.x.x.x.x.x.x.x',vol:.4},lead:{inst:'lead',vol:.04,mel:'D5 B4 G4 B4 D5 - E5 D5 B4 - G4 - A4 - - - E5 C5 G4 C5 E5 - G5 E5 D5 - C5 - B4 - A4 -'}},
  drive:{bpm:104,swing:.05,chords:['A2 C3 E3 G3','F2 A2 C3 E3','C3 E3 G3 B3','G2 B2 D3 F#3'],pad:{inst:'pad',vol:.03,cut:1600},keys:{inst:'epiano',vol:.055,pat:'0.2.3.2.0.2.3.2.'},bass:{inst:'synbass',vol:.12,pat:'0.0.0.0.0.0.0.x0.'},drums:{k:'x.....x.x.....x.',s:'....x.......x...',h:'x.x.x.x.x.x.x.x.',vol:.4}},
  lab:{bpm:96,chords:['D3 F3 A3','Bb2 D3 F3','G2 Bb2 D3','A2 C#3 E3'],pad:{inst:'pad',vol:.035,cut:700},keys:{inst:'square',vol:.035,pat:'0120x0210120x021'},bass:{inst:'synbass',vol:.1,pat:'0.......0.......'},drums:{k:'x.......x.......',h:'..x...x...x...x.',vol:.3}},
  tiny:{bpm:64,chords:['D3 A3 E4 F#4','B2 F#3 D4 A4','G2 D3 B3 F#4','A2 E3 C#4 G4'],pad:{inst:'pad',vol:.04,cut:1800},keys:{inst:'bell',vol:.035,pat:'3...2...1...x0...'},bass:{inst:'bass',vol:.1,pat:'0...............'},lead:{inst:'glass',vol:.03,mel:'F#5 - - - A5 - - - E5 - - - - - - - D5 - - - F#5 - - - C#5 - - - - - - -'}},
  giant:{bpm:50,chords:['C2 G2 Db3','C2 Gb2 C3'],pad:{inst:'brass',vol:.07,cut:600},bass:{inst:'bass',vol:.2,pat:'0...............'},drums:{k:'x...............',vol:.9}},
  moon:{bpm:70,chords:['E3 B3 F#4 G#4','C#3 G#3 D#4 E4','A2 E3 B3 C#4','B2 F#3 C#4 D#4'],pad:{inst:'pad',vol:.035,cut:1300},keys:{inst:'glass',vol:.04,pat:'0.1.2.3.x0.3.2.1.'},bass:{inst:'bass',vol:.12,pat:'0.......0.......'},drums:{k:'x.........x.....',h:'....x.......x...',vol:.2}},
  launch:{bpm:120,chords:['D3 F#3 A3','G3 B3 D4','E3 G3 B3','A3 C#4 E4'],pad:{inst:'brass',vol:.06,cut:2000},bass:{inst:'bass',vol:.18,pat:'0.0.0.0.0.0.0.0.'},drums:{k:'x...x...x...x...',s:'....x.......x...',h:'xxxxxxxxxxxxxxxx',vol:.5},lead:{inst:'brass',vol:.05,mel:'D4 - F#4 - A4 - - - B4 - A4 - F#4 - - - G4 - B4 - D5 - - - C#5 - - - E5 - - -'}},
  mars:{bpm:112,swing:.16,chords:['E3 G3 B3 D4','A2 C3 E3 G3','C3 E3 G3 B3','B2 D#3 F#3 A3'],keys:{inst:'epiano',vol:.055,pat:'.0.2.1.3.0.2.1.3'},bass:{inst:'synbass',vol:.13,pat:'0..0..0.0..0.x0..'},drums:{k:'x..x....x.x.....',s:'....x.......x...',h:'x.x.x.x.x.x.x.x.',c:'............x...',vol:.45},lead:{inst:'square',vol:.028,mel:'E5 - G5 - B5 A5 G5 - E5 - D5 - E5 - - - A4 - C5 - E5 D5 C5 - A4 - G4 - A4 - - -'}},
  cook:{bpm:132,swing:.2,chords:['C3 E3 G3','F3 A3 C4','G3 B3 D4','C3 E3 G3'],keys:{inst:'pluck',vol:.06,pat:'0.1.2.1.x0.2.1.2.'},bass:{inst:'bass',vol:.16,pat:'0.0...0.0.0...0.'},drums:{k:'x...x...x...x...',s:'....x.......x...',h:'.x.x.x.x.x.x.x.x',sh:'xxxxxxxxxxxxxxxx',vol:.4}},
  houses:{bpm:88,swing:.14,chords:['Bb2 D3 F3 A3','G2 Bb2 D3 F3','Eb3 G3 Bb3 D4','F3 A3 C4 Eb4'],pad:{inst:'pad',vol:.028,cut:1200},keys:{inst:'epiano',vol:.06,pat:'0.2...1.3...2.1.'},bass:{inst:'bass',vol:.14,pat:'0.....0.0.......'},drums:{k:'x.......x.x.....',s:'....x.......x...',h:'x.x.x.x.x.x.x.x.',vol:.3}},
  alienHome:{bpm:66,chords:['F3 A3 C4 E4','D3 F3 A3 C4','Bb2 D3 F3 A3','C3 E3 G3 B3'],pad:{inst:'pad',vol:.03,cut:1000},keys:{inst:'bell',vol:.03,pat:'0...2...1...3...'},bass:{inst:'bass',vol:.1,pat:'0...............'}},
  hunt:{bpm:72,chords:['E3 B3 D4 G4','C3 G3 B3 E4','A2 E3 G3 C4','B2 F#3 A3 D4'],pad:{inst:'pad',vol:.035,cut:1500},keys:{inst:'bell',vol:.032,pat:'0.2.1...3.1.2...'},bass:{inst:'bass',vol:.1,pat:'0.......0.......'},drums:{k:'x.........x.....',h:'....x.......x...',vol:.18},lead:{inst:'glass',vol:.028,mel:'B4 - D5 - E5 - - - G5 - F#5 - E5 - D5 - B4 - - - A4 - B4 - - - - - - -'}},
  larry:{bpm:108,swing:.22,chords:['G3 B3 D4','C3 E3 G3','A3 C4 E4','D3 F#3 A3'],keys:{inst:'pluck',vol:.055,pat:'0.1.2.1.0.2.1.2.'},bass:{inst:'bass',vol:.13,pat:'0...0.0.0...0...'},drums:{k:'x.....x.x.......',s:'....x.......x...',sh:'x.x.x.x.x.x.x.x.',vol:.3}},
  dream:{bpm:46,chords:['C3 Eb3 G3 D4','Ab2 C3 Eb3 G3','F2 Ab2 C3 Eb3','G2 B2 D3 F3'],pad:{inst:'pad',vol:.05,cut:700},keys:{inst:'glass',vol:.03,pat:'2.......0...1...'},lead:{inst:'bell',vol:.02,mel:'G4 - - - - - - - Eb5 - - - - - - - D5 - - - - - - - B4 - - - - - - -'}},
  pizza:{bpm:96,swing:.18,chords:['F3 A3 C4 E4','D3 F3 A3 C4','G3 Bb3 D4 F4','C3 E3 G3 Bb3'],keys:{inst:'epiano',vol:.06,pat:'0.2...1.3...2.1.'},bass:{inst:'bass',vol:.13,pat:'0.....0.0...0...'},drums:{k:'x.......x.x.....',s:'....x.......x...',h:'x.x.x.x.x.x.x.x.',vol:.28}},
  intro:{bpm:84,chords:['F3 A3 C4 E4','Bb2 D3 F3 A3'],keys:{inst:'pluck',vol:.035,pat:'0.......2.......'},pad:{inst:'pad',vol:.02,cut:800}}
};
const MUS={cur:null,name:null,gain:null,step:0,nextT:0,timer:null,duck:1};
/* real recorded tracks (OpenGameArt, CC0 / OGA-BY): intro once, then a seamless loop */
const MUSIC_TRACKS={
  title:{loop:'mus_title',vol:.85},
  desert:{intro:'mus_desert_intro',loop:'mus_desert',vol:.5},
  fight:{intro:'mus_fight_intro',loop:'mus_fight',vol:.55},
  pyramid:{loop:'mus_pyramid',vol:.75},
  pig:{loop:'mus_pig',vol:.5}
};
function playMusic(name,fade=1.5){
  if(!AU.ok) return; if(MUS.name===name) return;
  stopMusic(fade);
  const tr=MUSIC_TRACKS[name];
  if(tr&&SND.has(tr.loop)){
    const g=ACtx.createGain(); g.gain.setValueAtTime(.0001,ACtx.currentTime); g.gain.linearRampToValueAtTime(tr.vol||1,ACtx.currentTime+fade); g.connect(musicBus);
    MUS.name=name; MUS.gain=g; MUS.cur=null; MUS.handles=[];
    let delay=0; if(tr.intro&&SND.has(tr.intro)){ MUS.handles.push(SND.play(tr.intro,{dest:g})); delay=SND.dur(tr.intro); }
    MUS.handles.push(SND.play(tr.loop,{dest:g,loop:true,delay}));
    return;
  }
  const song=SONGS[name]; if(!song){ MUS.name=null; return; }
  const g=ACtx.createGain(); g.gain.setValueAtTime(.0001,ACtx.currentTime); g.gain.linearRampToValueAtTime(1,ACtx.currentTime+fade); g.connect(musicBus);
  MUS.cur=song; MUS.name=name; MUS.gain=g; MUS.step=0; MUS.nextT=ACtx.currentTime+.08;
  MUS.timer=setInterval(musicTick,40);
}
function stopMusic(fade=1){
  if(!AU.ok) return;
  if(MUS.timer){ clearInterval(MUS.timer); MUS.timer=null; }
  const hs=MUS.handles||[]; MUS.handles=null;
  if(MUS.gain){ const g=MUS.gain; g.gain.cancelScheduledValues(ACtx.currentTime); g.gain.setValueAtTime(g.gain.value,ACtx.currentTime); g.gain.linearRampToValueAtTime(.0001,ACtx.currentTime+Math.max(.02,fade)); setTimeout(()=>{ for(const h of hs) h&&h.stop(.01); try{ g.disconnect(); }catch(e){} },Math.max(.02,fade)*1000+80); }
  MUS.cur=null; MUS.name=null; MUS.gain=null;
}
function duckMusic(k){ MUS.duck=k; applyVolumes(); }
function musicTick(){
  const s=MUS.cur; if(!s||!AU.ok) return;
  const stepDur=60/s.bpm/4;
  while(MUS.nextT<ACtx.currentTime+.2){
    const i=MUS.step, t=MUS.nextT+((i%2===1)?(s.swing||0)*stepDur:0), out=MUS.gain;
    const bar=Math.floor(i/16), pos=i%16;
    const chord=notes(s.chords[bar%s.chords.length]);
    const tone_=(idx)=>{ const up=typeof idx==='string'&&idx[0]==='x'; const n=parseInt(up?idx.slice(1):idx); const f=chord[n%chord.length]*Math.pow(2,Math.floor(n/chord.length)); return up?f*2:f; };
    if(s.pad && pos===0) chord.forEach(f=>INST[s.pad.inst](f,t,stepDur*16,s.pad.vol,out,s.pad.cut));
    const partAt=(pat)=>{ if(!pat) return null; const toks=pat.match(/x\d|\d|\./g)||[]; const tok=toks[pos%toks.length]; return tok==='.'?null:tok; };
    if(s.keys){ const k=partAt(s.keys.pat); if(k!=null) INST[s.keys.inst](tone_(k)*2,t,stepDur*2,s.keys.vol,out); }
    if(s.bass){ const k=partAt(s.bass.pat); if(k!=null) INST[s.bass.inst](chord[0]/2*(k.startsWith('x')?2:1),t,stepDur*1.8,s.bass.vol,out); }
    if(s.drums){ const d=s.drums, v=d.vol||.4;
      if(d.k&&d.k[pos]==='x') INST.kick(t,.5*v,out); if(d.s&&d.s[pos]==='x') INST.snare(t,.18*v,out); if(d.h&&d.h[pos]==='x') INST.hat(t,.06*v,out,pos%8===6);
      if(d.c&&d.c[pos]==='x') INST.clap(t,.18*v,out); if(d.sh&&d.sh[pos]==='x') INST.shaker(t,.05*v,out); }
    if(s.lead && i%2===0){ const mel=s.lead.mel.split(/\s+/); const n=mel[(i/2)%mel.length]; if(n&&n!=='-'){ let len=1; for(let j=1;j<8;j++){ if(mel[((i/2)+j)%mel.length]==='-') len++; else break; } INST[s.lead.inst](hz(n),t,stepDur*2*len*.95,s.lead.vol,out); } }
    MUS.step++; MUS.nextT+=stepDur;
  }
}

/* ---------- voice acting: baked clips (assets/voice/<id>.mp3), computer voice as a fallback ---------- */
const HAS_TTS=('speechSynthesis' in window)&&('SpeechSynthesisUtterance' in window);
let VOICES={all:[],male:[],female:[]};
const FEMALE_RE=/female|samantha|victoria|karen|zira|susan|allison|ava|serena|tessa|moira|fiona|kate|jenny|aria|libby|sonia|hazel|google us english|nicky|joanna|salli|kimberly|michelle|emma|amy/i;
const MALE_RE=/\bmale|daniel|david|alex\b|fred|mark|george|guy|ryan|aaron|arthur|oliver|james|google uk english male|rishi|thomas|christopher|eric|roger|steffan|brian|matthew|joey|justin/i;
function loadVoices(){ if(!HAS_TTS) return; try{ const vs=speechSynthesis.getVoices().filter(v=>/^en/i.test(v.lang)); VOICES.all=vs; VOICES.female=vs.filter(v=>FEMALE_RE.test(v.name)&&!/\bmale/i.test(v.name.replace(/female/i,''))); VOICES.male=vs.filter(v=>MALE_RE.test(v.name)&&!FEMALE_RE.test(v.name)); }catch(e){} }
if(HAS_TTS){ loadVoices(); try{ speechSynthesis.onvoiceschanged=loadVoices; }catch(e){} }
/* who -> fallback computer voice + babble pitch. The real voices are the clips. */
const VOICE_PROFILES={
  Jay:{g:'m',i:4,pitch:1.0,rate:1.08,babble:150,prefer:/James Online/i},
  Jay2:{g:'m',i:4,pitch:.94,rate:1.02,babble:140,prefer:/James Online/i},
  Jim:{g:'m',i:0,pitch:1.1,rate:1.04,babble:190},
  Pig:{g:'m',i:0,pitch:.5,rate:.8,babble:80,sfx:()=>SND.play('pig_grunt',{vol:.9})}
};
function voiceFor(p){ if(p.prefer){ const v=VOICES.all.find(q=>p.prefer.test(q.name)); if(v) return v; } const pool=p.g==='f'?VOICES.female:VOICES.male, list=pool.length?pool:VOICES.all; return list.length?list[p.i%list.length]:null; }
const VOICE={speaking:false,token:0,lastEnd:0,cur:null};
/* speak a line: clip by id when we have it, else the computer voice. onEnd fires when it's over. returns true if a voice played */
function speakLine(who,text,onEnd,id,at){
  const prof=VOICE_PROFILES[who]||null;
  const vol=SETTINGS.voice==null?1:SETTINGS.voice;
  if(prof&&prof.sfx&&!id){ if(vol>0) prof.sfx(); if(onEnd) setTimeout(onEnd,700); return true; }
  const tok=++VOICE.token; let done=false;
  const fin=()=>{ if(done) return; done=true; if(tok===VOICE.token){ VOICE.speaking=false; VOICE.cur=null; VOICE.lastEnd=performance.now(); } if(onEnd) onEnd(); };
  // 1) the baked clip
  if(id&&AU.ok&&SND.has('voice/'+id)&&vol>0){
    VOICE.speaking=true;
    const h=SND.play('voice/'+id,{dest:voiceBus,vol:1,pos:at,ref:at?1.6:0,onEnd:fin});
    VOICE.cur=h;
    setTimeout(fin,(SND.dur('voice/'+id)+.6)*1000);   // safety
    return true;
  }
  // 2) the computer voice
  const clean=(text||'').replace(/<[^>]+>/g,'').replace(/\*[^*]*\*/g,'').replace(/[^\x20-\x7E’'—–…]/g,'').replace(/\s+/g,' ').trim();
  if(vol<=0||!HAS_TTS||!prof||!clean){ if(onEnd) onEnd(); return false; }
  try{
    const u=new SpeechSynthesisUtterance(clean), v=voiceFor(prof); if(v) u.voice=v;
    u.rate=prof.rate; u.pitch=prof.pitch; u.volume=Math.min(1,.35+vol*.65*SETTINGS.master);
    u.onend=fin; u.onerror=fin;
    speechSynthesis.cancel(); VOICE.speaking=true; speechSynthesis.speak(u);
    setTimeout(fin,Math.max(2500,clean.length*95)+1500);
    return true;
  }catch(e){ if(onEnd) onEnd(); return false; }
}
function stopSpeech(){ VOICE.token++; VOICE.speaking=false; if(VOICE.cur){ try{ VOICE.cur.stop(.08); }catch(e){} VOICE.cur=null; } if(HAS_TTS){ try{ speechSynthesis.cancel(); }catch(e){} } }
function babble(pitch,dest){
  if(!AU.ok) return; dest=dest||voiceBus;
  const t0=ACtx.currentTime, dur=.08+Math.random()*.06;
  const o=ACtx.createOscillator(); o.type='sawtooth'; o.frequency.setValueAtTime(pitch*(.88+Math.random()*.3),t0); o.frequency.linearRampToValueAtTime(pitch*(.9+Math.random()*.2),t0+dur);
  const vow=[[730,1090],[270,2290],[300,870],[530,1840],[660,1720],[390,1990]][(Math.random()*6)|0];
  const g=ACtx.createGain(); g.gain.setValueAtTime(.0001,t0); g.gain.linearRampToValueAtTime(.05,t0+.015); g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
  const f1=ACtx.createBiquadFilter(); f1.type='bandpass'; f1.frequency.value=vow[0]; f1.Q.value=6;
  const f2=ACtx.createBiquadFilter(); f2.type='bandpass'; f2.frequency.value=vow[1]; f2.Q.value=8;
  o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(dest); o.start(t0); o.stop(t0+dur+.02);
}


/* ---------- REAL recorded sounds: assets/sfx/<name>.(ogg|mp3) decoded once, played anywhere ---------- */
const SND={buf:{},loading:{},
  has(n){ return !!SND.buf[n]; },
  dur(n){ const b=SND.buf[n]; return b?b.duration:0; },
  /* load one file into a named buffer (counts toward the asset bar) */
  load(name,url){
    if(SND.buf[name]||SND.loading[name]) return SND.loading[name]||Promise.resolve(SND.buf[name]);
    ASSETS.total++;
    const p=fetch(url).then(r=>{ if(!r.ok) throw new Error(r.status+' '+url); return r.arrayBuffer(); }).then(ab=>{ if(!AU.ok) initAudioSilent(); return new Promise((res,rej)=>ACtx.decodeAudioData(ab,res,rej)); })
      .then(b=>{ SND.buf[name]=b; assetTick(name); return b; }).catch(e=>{ console.warn('sound missing',url,e.message); assetTick(name); return null; });
    SND.loading[name]=p; return p;
  },
  /* play: {vol, dest, pos (Vector3 -> 3D), ref, loop, rate, fadeIn, offset, onEnd} -> handle {stop(fade), gain, src} */
  play(name,o={}){
    const b=SND.buf[name]; if(!b||!AU.ok) return null;
    const t0=ACtx.currentTime+(o.delay||0), src=ACtx.createBufferSource(); src.buffer=b; src.loop=!!o.loop; if(o.rate) src.playbackRate.value=o.rate;
    if(o.loopStart!=null){ src.loopStart=o.loopStart; src.loopEnd=o.loopEnd||b.duration; }
    const g=ACtx.createGain(); const v=o.vol==null?1:o.vol;
    if(o.fadeIn){ g.gain.setValueAtTime(.0001,t0); g.gain.linearRampToValueAtTime(v,t0+o.fadeIn); } else g.gain.value=v;
    src.connect(g);
    let pn=null;
    if(o.pos){ pn=makePanner(o.ref||2,o.dest||sfxBus); setPannerPos(pn,o.pos.x,o.pos.y,o.pos.z); g.connect(pn); } else g.connect(o.dest||sfxBus);
    src.start(t0,o.offset||0);
    const h={src,gain:g,pan:pn,name,done:false,
      stop(fade=.1){ if(h.done) return; h.done=true; try{ const t=ACtx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value,t); g.gain.linearRampToValueAtTime(.0001,t+fade); src.stop(t+fade+.02); }catch(e){} },
      vol(v,tc=.1){ g.gain.setTargetAtTime(v,ACtx.currentTime,tc); },
      at(p){ if(pn) setPannerPos(pn,p.x,p.y,p.z); }};
    src.onended=()=>{ h.done=true; try{ g.disconnect(); if(pn) pn.disconnect(); }catch(e){} if(o.onEnd) o.onEnd(); };
    return h;
  }
};
/* decoding needs a context before the first click: a silent one is fine (it resumes on the first click) */
function initAudioSilent(){ if(!AU.ok) initAudio(); }
