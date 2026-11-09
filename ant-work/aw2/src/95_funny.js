/* ================================================================
   FUNNY MODE — a setting that breaks the game on purpose.
   Party hats on everybody, voices that glitch out, bleeped swearing,
   lines nobody says in the normal game, and a steady stream of
   harmless glitches (T-poses, giant heads, launches, screen tears...).
   The story still works start to finish.
   ================================================================ */
const FUNNY={t:3,active:[],hatScan:0};
const funnyOn=()=>!!SETTINGS.funny;
const FLVL=()=>clamp(SETTINGS.funnyLevel||3,1,3);

/* ---------- words: bleeped swears + lines that only exist in Funny mode ---------- */
const FUNNY_LINES={
  Jim:["Hold on, my voice is buffering.","I put bugs in the pizza. Don't tell anyone.","Why is there a hat on my head? When did I put on a hat?","Oh [bleep], I left the stove on. On Earth.","Is the floor supposed to be doing that?","I can see my own polygons, man.","Who keeps T-posing?! Stop T-posing!","My legs are just for decoration.","This is fine. Everything is fine. [bleep].","I'm not glitching, YOU'RE glitching.","I sold a bug nugget to a lamp once.","Party hats are mandatory. It's the law."],
  JimTired:["Zzz... five more minutes... zzz... [bleep]...","I'm so tired I can hear colors."],
  You:["Why is everyone wearing party hats?","What the [bleep] was that?","I think the game is broken.","My head feels... bigger.","Did anyone else just see the floor blink?","I'm gonna [bleep]ing scream.","Why do I sound like this?!"],
  Steve:["Hello Jay. Nice hat.","[bleep] you, Jay. I mean... hello.","I have your watch. And also your socks.","The world will be mine. After my nap."],
  Larry:["I have eight legs and zero regrets.","Get me some [bleep]ing snacks, then we'll talk.","I'm not a spider. Please stop calling me a spider.","I ate a whole skin flake once. Best day of my life."],
  Seller:["This house comes with free ghosts.","Fifty coins? Are you [bleep]ing kidding me? ...Deal."],
  Converter:["Exchange rate today: one dollar equals one sandwich.","BEEP BOOP. I mean, I'm not a robot. [bleep]."],
  Robot:["ERROR. [BLEEP] NOT FOUND.","BEEP. I AM ALSO A TOASTER.","NOM NOM. WHY IS MY HAT ON.","DOES NOT COMPUTE. [BLEEP]."],
  Alien:["We come in peace. And party hats.","Earthling, your face is glitching."]
};
const BLEEP_PRE=["Oh [bleep], ","What the [bleep]? ","Holy [bleep], ","[bleep] it, ","Son of a [bleep], "];
const BLEEP_POST=[" [bleep]!",", you [bleep].",". Holy [bleep]."," ...[bleep]."];
function funnyText(text){
  if(!funnyOn()||!text||/\[bleep\]/i.test(text)) return text;
  const r=Math.random(), p=.14*FLVL();
  if(r<p*.5) return pick(BLEEP_PRE)+text.charAt(0).toLowerCase()+text.slice(1);
  if(r<p) return text.replace(/[.!?]*$/,'')+pick(BLEEP_POST);
  if(r<p*1.3){ const w=text.split(' '); if(w.length>3){ const i=1+Math.floor(Math.random()*(w.length-2)); const core=w[i].replace(/[^a-z']/gi,''); if(core.length>2){ const c=core.slice(0,2); w[i]=c+'-'+c+'-'+w[i]; return w.join(' '); } } }
  return text;
}
function funnyLines(lines){
  if(!funnyOn()) return lines;
  const out=[];
  for(const L0 of lines){ const L=typeof L0==='string'?{text:L0}:Object.assign({},L0); L.text=funnyText(L.text); out.push(L);
    const who=L.voice||L.who; const pool=FUNNY_LINES[who];
    if(pool && Math.random()<.12*FLVL()) out.push(Object.assign({},L,{text:pick(pool),fx:null,pose:undefined,auto:L.auto!=null?1.2:undefined})); }
  return out;
}
function bleepHTML(t){ return String(t).replace(/\[bleep\]/gi,'<span class="bleep">#$@%!</span>'); }

/* ---------- glitchy voices: every line gets chopped into pieces with random pitch + speed ---------- */
SFX.bleep=()=>{ if(!AU.ok) return; tone(1000,.42,'sine',.14,0,null,voiceBus,.004); };
SFX.boing=()=>{ tone(180,.45,'sine',.22,0,720); tone(360,.3,'triangle',.06,.05,1200); };
SFX.glitchNoise=()=>{ for(let i=0;i<5;i++) tone(200+Math.random()*2400,.05,'square',.05,i*.05,null,sfxBus,.002,['lowpass',4000]); noise(.25,.1,0,3000,'bandpass',sfxBus,.6); };
function speakFunny(who,text,onEnd){
  const prof=VOICE_PROFILES[who]||VOICE_PROFILES.Jim;
  const raw=text.replace(/<[^>]+>/g,'').replace(/\*[^*]*\*/g,'');
  // split around bleeps, then into small word chunks
  const parts=raw.split(/(\[bleep\])/i).filter(s=>s.trim());
  const chunks=[]; for(const p of parts){ if(/\[bleep\]/i.test(p)){ chunks.push({bleep:true}); continue; } const w=p.replace(/[^\x20-\x7E’'—–…]/g,'').split(/\s+/).filter(Boolean); for(let i=0;i<w.length;){ const n=1+Math.floor(Math.random()*3); chunks.push({t:w.slice(i,i+n).join(' ')}); i+=n; } }
  const tok=++VOICE.token; VOICE.speaking=true; let i=0, done=false;
  const fin=()=>{ if(done) return; done=true; if(tok===VOICE.token){ VOICE.speaking=false; } if(onEnd) onEnd(); };
  const v=voiceFor(prof);
  const next=()=>{
    if(tok!==VOICE.token) return fin();
    if(i>=chunks.length) return fin();
    const c=chunks[i++];
    if(c.bleep){ SFX.bleep(); setTimeout(next,440); return; }
    if(Math.random()<.18) SFX.glitchNoise();
    const u=new SpeechSynthesisUtterance(Math.random()<.12?c.t+' '+c.t.split(' ').pop():c.t); if(v) u.voice=v;
    u.pitch=clamp(prof.pitch*rand(.25,2.2),.1,2); u.rate=clamp(prof.rate*rand(.55,1.9),.4,2.4); u.volume=Math.min(1,.35+SETTINGS.sfx*.65*SETTINGS.master);
    u.onend=()=>setTimeout(next,Math.random()<.2?rand(80,260):0); u.onerror=()=>next();
    speechSynthesis.speak(u);
  };
  try{ speechSynthesis.cancel(); }catch(e){}
  next();
  setTimeout(fin,Math.max(3000,raw.length*140)+2500);
  return true;
}
function babbleFunny(pitch,dest){ babble(pitch*rand(.3,3),dest); if(Math.random()<.15) SFX.bleep(); }

/* ---------- party hats ---------- */
let HAT_TEX=null;
function makePartyHat(){
  if(!HAT_TEX) HAT_TEX=canvasTex(128,128,(x,w,h)=>{ const cols=['#ff4a8a','#ffd23a','#3ad8ff','#9aff5a','#b87aff']; for(let i=0;i<10;i++){ x.fillStyle=cols[i%cols.length]; x.beginPath(); x.moveTo(i*w/5-w,h); x.lineTo(i*w/5-w+w/10,h); x.lineTo(i*w/5+w*.1,0); x.lineTo(i*w/5,0); x.fill(); } for(let i=0;i<40;i++){ x.fillStyle='rgba(255,255,255,.8)'; x.beginPath(); x.arc(Math.random()*w,Math.random()*h,2,0,7); x.fill(); } });
  const g=new THREE.Group();
  const cone=mesh(GC('hatCone',()=>{ const c=new THREE.ConeGeometry(.5,1.35,24,1,true); c.translate(0,.675,0); return c; }),new THREE.MeshStandardMaterial({map:HAT_TEX,roughness:.5,side:THREE.DoubleSide}),0,0,0,false); g.add(cone);
  g.add(mesh(GC('hatPom',()=>new THREE.SphereGeometry(.16,12,10)),new THREE.MeshStandardMaterial({color:col(0xfff4a0),emissive:col(0x6a5a10),roughness:.9}),0,1.38,0,false));
  g.add(mesh(GC('hatRim',()=>new THREE.TorusGeometry(.5,.05,6,24)),new THREE.MeshStandardMaterial({color:col(0xffffff),roughness:.8}),0,0,0,false)); g.children[2].rotation.x=Math.PI/2;
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=false; } });
  return g;
}
const _hb=new THREE.Box3(), _hv=new THREE.Vector3(), _hs=new THREE.Vector3();
/* sit a hat on top of `headObj` (whatever mesh group is the head), sized to it */
function hatOn(owner,headObj,sizeK=1,tilt=.25){
  if(!headObj||owner.userData.partyHat) { if(owner.userData.partyHat) owner.userData.partyHat.visible=funnyOn(); return; }
  owner.updateMatrixWorld(true); _hb.setFromObject(headObj); if(_hb.isEmpty()) return;
  const w=Math.max(_hb.max.x-_hb.min.x,_hb.max.z-_hb.min.z);
  _hv.set((_hb.min.x+_hb.max.x)/2,_hb.max.y-w*.08,(_hb.min.z+_hb.max.z)/2); headObj.worldToLocal(_hv);
  headObj.getWorldScale(_hs);
  const hat=makePartyHat(); hat.position.copy(_hv); const s=w*.55*sizeK/_hs.y; hat.scale.setScalar(s); hat.rotation.z=tilt; hat.rotation.x=-.12;
  headObj.add(hat); owner.userData.partyHat=hat; hat.visible=funnyOn();
}
function scanHats(){
  const on=funnyOn(); if(!LV) return;
  for(const h of HUMANS){ if(!h.parent) continue; const U=h.userData; if(on) hatOn(h,U.head||U.headJ,1.25,.22); else if(U.partyHat) U.partyHat.visible=false; }
  for(const r of ROBOTS){ if(!r.parent) continue; const U=r.userData; if(on) hatOn(r,U.head,1.1,-.2); else if(U.partyHat) U.partyHat.visible=false; }
  const critters=[]; if(LV.ant) critters.push(LV.ant); if(LV.bugs) critters.push(...LV.bugs); if(LV.larry) critters.push(LV.larry); if(LV.giant) critters.push(LV.giant); if(LV.tards) critters.push(...LV.tards); if(typeof FOLK!=='undefined') critters.push(...FOLK.filter(f=>f.parent&&f.userData.level===LV.name)); if(LV.mites) critters.push(...LV.mites); if(LV.rat) critters.push(LV.rat); if(LV.jeff) critters.push(LV.jeff); for(const k of ['xxx','xFly','xBig','x3']) if(LV[k]) critters.push(LV[k]);
  for(const c of critters){ const hd=c.userData.head; if(!hd) continue; if(on) hatOn(c,hd,c.userData.heads?1.6:c.userData.folk?1.3:c===LV.larry||c===LV.giant?.9:.5,c.userData.folk?.46:.3); else if(c.userData.partyHat) c.userData.partyHat.visible=false; }
}

/* ---------- the glitch events ---------- */
function randHuman(){ const hs=HUMANS.filter(h=>h.parent&&h.visible&&(!h.userData.level||!LV||h.userData.level===LV.name)&&h.getWorldPosition(_hv).distanceTo(camera.position)<40); return hs.length?pick(hs):null; }
function tempRestore(sec,restore){ FUNNY.active.push({t:sec,restore}); }
const GLITCHES=[
  // characters
  {w:3,go(){ const h=randHuman(); if(!h) return false; h.userData.A.funny={k:'tpose',until:G.time+rand(2,4)}; }},
  {w:2,go(){ const h=randHuman(); if(!h) return false; h.userData.A.funny={k:'headspin',until:G.time+rand(1.5,3)}; SFX.boing(); }},
  {w:2,go(){ const h=randHuman(); if(!h) return false; h.userData.A.funny={k:'flail',until:G.time+rand(2,3.5)}; }},
  {w:2,go(){ const h=randHuman(); if(!h) return false; const hj=h.userData.J.head; hj.scale.setScalar(2.4); SFX.boing(); tempRestore(rand(2,4),()=>hj.scale.setScalar(1)); }},
  {w:1,go(){ const h=randHuman(); if(!h) return false; const s0=h.scale.clone(); h.scale.set(s0.x*.7,s0.y*1.8,s0.z*.7); tempRestore(rand(1.5,3),()=>h.scale.copy(s0)); }},
  {w:1,go(){ const h=randHuman(); if(!h) return false; const s0=h.scale.clone(); h.scale.set(s0.x*1.6,s0.y*.5,s0.z*1.6); SFX.boing(); tempRestore(rand(1.5,3),()=>h.scale.copy(s0)); }},
  {w:1,go(){ const h=randHuman(); if(!h) return false; const pool=FUNNY_LINES[h.userData.voice]||FUNNY_LINES.Jim; if(DLG.active) return false; bark(h.userData.name==='You'?'You':h.userData.name,pick(pool),h,3.2); }},
  // you
  {w:2,go(){ const P=PLAYER; if(P.fly||!P.onGround||!P.ctl.move||CAM.active) return false; P.vy=rand(9,14); P.onGround=false; SFX.boing(); if(Math.random()<.4) toast(pick(['Whoops','Gravity.exe stopped working','YEET']),'#ff9af0'); }},
  {w:1,go(){ const P=PLAYER; if(P.fly||!P.ctl.move) return false; const g0=P.gravity; P.gravity=1.6; toast('Low gravity for no reason','#9af0ff'); tempRestore(5,()=>P.gravity=g0); }},
  {w:2,go(){ PLAYER.fovKick=pick([-30,35]); SFX.glitchNoise(); }},
  {w:1,go(){ const g=VM.grp; g.scale.setScalar(.7); tempRestore(1.6,()=>g.scale.setScalar(.25)); }},
  {w:1,go(){ if(CAM.active) return false; PLAYER.roll=pick([-.9,.9]); }},
  // screen + sound
  {w:3,go(){ FX.glitch=1; SFX.glitchNoise(); tempRestore(rand(.25,.6),()=>FX.glitch=0); }},
  {w:2,go(){ const k=['temp','saturation','contrast']; const save=k.map(x=>FX[x]); FX.temp=rand(-2,2); FX.saturation=rand(0,3); FX.contrast=rand(.6,1.6); tempRestore(rand(1,2),()=>k.forEach((x,i)=>FX[x]=save[i])); }},
  {w:1,go(){ const o=$('objText'); if(!o||!o.textContent) return false; const h0=o.innerHTML; o.textContent=o.textContent.split('').map(c=>Math.random()<.4?pick('#$%&@!?*01'.split('')):c).join(''); tempRestore(1.2,()=>{ if(o.textContent.length) o.innerHTML=h0; }); }},
  {w:2,go(){ toast(pick(['ERROR 404: GRAVITY NOT FOUND','Warning: too many hats','ant_work_2.exe has stopped... just kidding','Loading... floor','NaN% complete','Jim.voice has crashed','PHYSICS: optional']),'#ff6a6a'); }},
  {w:1,go(){ if(!LV||!LV.glow) return false; const p=camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(3)); for(const c of [0xff4a8a,0xffd23a,0x3ad8ff,0x9aff5a]) LV.glow.burst(p,{color:c,count:14,speed:3,size:.05*Math.max(.1,PLAYER.scale),life:1.2,grav:3}); SFX.sparkle(); }},
  // creatures
  {w:1,go(){ if(!LV||!LV.bugs||!LV.bugs.length) return false; const b=pick(LV.bugs); const s0=b.scale.x; b.scale.setScalar(s0*3); SFX.boing(); tempRestore(3,()=>b.scale.setScalar(s0)); }},
  {w:1,go(){ if(!LV||LV.name!=='tiny') return false; const L=LV.larry; if(!L||!L.visible) return false; const s0=L.scale.x; L.scale.setScalar(s0*2); tempRestore(2.5,()=>L.scale.setScalar(s0)); }}
];
function runGlitch(){ if(trophyStat('glitches')>=25) unlock('partyAnimal'); let tries=6; while(tries-->0){ const tot=GLITCHES.reduce((a,g)=>a+g.w,0); let r=Math.random()*tot, g=GLITCHES[0]; for(const x of GLITCHES){ r-=x.w; if(r<=0){ g=x; break; } } try{ if(g.go()!==false) return; }catch(e){ console.warn('glitch failed',e); } } }
function clearFunny(){ for(const a of FUNNY.active){ try{ a.restore(); }catch(e){} } FUNNY.active.length=0; for(const h of HUMANS){ if(h.userData.A) h.userData.A.funny=null; if(h.userData.J&&h.userData.J.head) h.userData.J.head.scale.setScalar(1); } }
/* per-human glitch poses (called from animateHuman) */
function funnyHumanHook(h,R,t,A){
  const F=A.funny; if(!F) return; if(!funnyOn()||G.time>F.until){ A.funny=null; return; }
  if(F.k==='tpose'){ for(const j in R){ R[j][0]=0; R[j][1]=0; R[j][2]=0; } R.shL[2]=Math.PI/2; R.shR[2]=-Math.PI/2; }
  else if(F.k==='headspin'){ R.head[1]+=t*25; }
  else if(F.k==='flail'){ R.shL[2]=1.5+Math.sin(t*30)*1.2; R.shR[2]=-1.5-Math.cos(t*29)*1.2; R.elL[0]=Math.sin(t*25); R.elR[0]=Math.cos(t*27); R.head[0]=Math.sin(t*20)*.4; }
}
function funnyFrame(dt){
  const on=funnyOn(); document.body.classList.toggle('funny',on);
  FUNNY.hatScan-=dt; if(FUNNY.hatScan<=0){ FUNNY.hatScan=1; try{ scanHats(); }catch(e){ console.warn(e); } }
  for(let i=FUNNY.active.length-1;i>=0;i--){ const a=FUNNY.active[i]; a.t-=dt; if(a.t<=0 || !on){ try{ a.restore(); }catch(e){} FUNNY.active.splice(i,1); } }
  if(!on) return;
  if(G.mode!=='play'||G.paused||MODAL.open) return;
  FUNNY.t-=dt; if(FUNNY.t<=0){ FUNNY.t=rand(1.2,4)*(4-FLVL())/1.6+rand(0,1.2); runGlitch(); }
  // the Mars shift clock sometimes runs backwards
  const F=WORLD.flags; if(F&&F.shiftOn&&F.clock&&Math.random()<dt*.05) F.clock=Math.max(12*60,F.clock-rand(2,6));
}

