/* ================================================================
   CORE — helpers, settings, presets, save, game clock, input, asset loader (ANT WORK 3)
   ================================================================ */
'use strict';
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const invLerp=(a,b,v)=>clamp((v-a)/(b-a),0,1);
const smooth=t=>{ t=clamp(t,0,1); return t*t*(3-2*t); };
const smoother=t=>{ t=clamp(t,0,1); return t*t*t*(t*(t*6-15)+10); };
const easeOut=t=>1-Math.pow(1-clamp(t,0,1),3);
const easeIn=t=>Math.pow(clamp(t,0,1),3);
const easeInOut=t=>{ t=clamp(t,0,1); return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; };
const easeBack=t=>{ t=clamp(t,0,1); const c=1.9; return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2); };
function angLerp(a,b,t){ let d=((b-a+Math.PI*3)%(Math.PI*2))-Math.PI; return a+d*t; }
function angDiff(a,b){ return ((b-a+Math.PI*3)%(Math.PI*2))-Math.PI; }
function damp(a,b,lambda,dt){ return lerp(a,b,1-Math.exp(-lambda*dt)); }
const rand=(a=0,b=1)=>a+Math.random()*(b-a);
const randi=(a,b)=>Math.floor(rand(a,b+1));
const pick=arr=>arr[Math.floor(Math.random()*arr.length)];
function RNG(seed){ let s=seed>>>0||1; return function(){ s|=0; s=s+0x6D2B79F5|0; let t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const V3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
/* colours: author in sRGB hex, the renderer works in linear */
function col(hex){ return new THREE.Color(hex).convertSRGBToLinear(); }
/* value noise (for terrain + animation) */
const _perm=(()=>{ const r=RNG(1337), p=new Uint8Array(512), b=[]; for(let i=0;i<256;i++) b.push(i); for(let i=255;i>0;i--){ const j=Math.floor(r()*(i+1)); [b[i],b[j]]=[b[j],b[i]]; } for(let i=0;i<512;i++) p[i]=b[i&255]; return p; })();
function _grad(h,x,y){ const u=(h&1)?x:-x, v=(h&2)?y:-y; return ((h&4)?u+v:u*.5+v*.5); }
function noise2(x,y){
  const X=Math.floor(x)&255, Y=Math.floor(y)&255; x-=Math.floor(x); y-=Math.floor(y);
  const u=x*x*(3-2*x), v=y*y*(3-2*y);
  const a=_perm[X]+Y, b=_perm[X+1]+Y;
  return lerp(lerp(_grad(_perm[a],x,y),_grad(_perm[b],x-1,y),u),lerp(_grad(_perm[a+1],x,y-1),_grad(_perm[b+1],x-1,y-1),u),v);
}
function fbm2(x,y,oct=4){ let s=0,a=.5,f=1; for(let i=0;i<oct;i++){ s+=a*noise2(x*f,y*f); f*=2.03; a*=.5; } return s; }
function noise1(x){ return noise2(x,.37); }

const IS_TOUCH=(('ontouchstart' in window)||navigator.maxTouchPoints>0)&&window.matchMedia&&matchMedia('(pointer: coarse)').matches;
if(IS_TOUCH) document.body.classList.add('touch');
function loadJSON(k){ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } }
function saveJSON(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }

/* ---------------- graphics presets ---------------- */
const PRESETS={
  toaster:{name:'Toaster',sub:'bare minimum',res:.5, shadow:0,post:false,ao:0,bloom:false,rays:false,dof:false,mblur:false,aa:false,grain:false,lens:false,detail:0},
  potato: {name:'Potato', sub:'very laggy PCs',res:.7, shadow:0,post:false,ao:0,bloom:false,rays:false,dof:false,mblur:false,aa:false,grain:false,lens:false,detail:1},
  low:    {name:'Low',    sub:'older laptops',res:.85,shadow:1,post:false,ao:0,bloom:false,rays:false,dof:false,mblur:false,aa:false,grain:false,lens:false,detail:1},
  medium: {name:'Medium', sub:'balanced',     res:1,  shadow:2,post:true, ao:0,bloom:true, rays:false,dof:false,mblur:false,aa:true, grain:true, lens:true, detail:2},
  high:   {name:'High',   sub:'good PCs',     res:1,  shadow:3,post:true, ao:1,bloom:true, rays:true, dof:true, mblur:false,aa:true, grain:true, lens:true, detail:3},
  ultra:  {name:'Ultra',  sub:'gaming PCs',   res:1.25,shadow:3,post:true,ao:2,bloom:true, rays:true, dof:true, mblur:true, aa:true, grain:true, lens:true, detail:3},
  insane: {name:'INSANE', sub:'melt your GPU',res:1.6,shadow:4,post:true, ao:2,bloom:true, rays:true, dof:true, mblur:true, aa:true, grain:true, lens:true, detail:4}
};
const PRESET_ORDER=['toaster','potato','low','medium','high','ultra','insane'];
const GFX_KEYS=['res','shadow','post','ao','bloom','rays','dof','mblur','aa','grain','lens','detail'];
const DEFAULT_SETTINGS=Object.assign({preset:IS_TOUCH?'medium':'high',fov:75,showFps:false,autoLower:true,
  master:.9,music:.5,sfx:.9,voice:1,subs:true,textSpeed:1,sens:1,invertY:false,bob:true,shake:true,hud:true},PRESETS[IS_TOUCH?'medium':'high']);
const SETTINGS=Object.assign({},DEFAULT_SETTINGS,loadJSON('aw3_settings')||{});
if(!PRESETS[SETTINGS.preset] && SETTINGS.preset!=='custom') SETTINGS.preset='high';
function saveSettings(){ saveJSON('aw3_settings',SETTINGS); }
function detail(){ return SETTINGS.detail; }          // 0..4, used by world builders
function dq(a,b,c,d,e){ return [a,b,c,d,e][clamp(SETTINGS.detail,0,4)]; }   // pick a value per detail level

/* ---------------- save / checkpoints ---------------- */
const SAVE_KEY='aw3_save';
function getSave(){ return loadJSON(SAVE_KEY); }
function writeSave(obj){ saveJSON(SAVE_KEY,Object.assign({t:Date.now()},obj)); }

/* ---------------- game clock, timers, async story helpers ---------------- */
const G={time:0,dt:0,real:0,paused:false,mode:'boot',frame:0};
const STORY={token:1};
const TIMERS=[];
function later(sec,fn){ const tok=STORY.token; TIMERS.push({t:G.time+sec,fn,tok}); }
function runTimers(){
  if(!TIMERS.length) return;
  const due=[];
  for(let i=TIMERS.length-1;i>=0;i--){ if(TIMERS[i].t<=G.time){ due.push(TIMERS[i]); TIMERS.splice(i,1); } }
  due.sort((a,b)=>a.t-b.t);
  for(const d of due){ if(d.tok!==STORY.token) continue; try{ d.fn(); }catch(e){ console.error(e); window.__showErr&&__showErr('Error: '+e.message); } }
}
/* wait(sec): resolves after `sec` of game time (freezes while paused). If the story is
   reset (new game / checkpoint / quit) the promise simply never resolves, which cleanly
   halts any cutscene that was running -- no stray callbacks into a dead scene. */
function wait(sec){ const tok=STORY.token; return new Promise(res=>{ TIMERS.push({t:G.time+Math.max(0,sec),fn:res,tok}); }); }
function waitUntil(cond,maxSec=1e9){ const tok=STORY.token, t0=G.time; return new Promise(res=>{ (function chk(){ if(tok!==STORY.token) return; if(cond()||G.time-t0>maxSec){ res(); return; } TIMERS.push({t:G.time+.05,fn:chk,tok}); })(); }); }
function nextFrame(){ return new Promise(r=>requestAnimationFrame(()=>r())); }
function resetStory(){ STORY.token++; TIMERS.length=0; }
/* run an async story function; errors are reported on screen instead of silently freezing */
function runStory(fn){ const tok=STORY.token; Promise.resolve().then(fn).catch(e=>{ if(tok!==STORY.token) return; console.error(e); window.__showErr&&__showErr('Story error: '+(e&&e.message)); }); }

/* ---------------- tiny event bus ---------------- */
const BUS={}; function on(ev,fn){ (BUS[ev]=BUS[ev]||[]).push(fn); } function emit(ev,a){ (BUS[ev]||[]).forEach(f=>{ try{ f(a); }catch(e){ console.error(e); } }); }

/* ---------------- input ---------------- */
const keys={};
const INPUT={lookDX:0,lookDY:0,mouseDown:false,rmb:false,locked:false,dragLook:false,lastMove:0};
const canvasEl=$('c');
function uiIsOpen(){ return !!document.querySelector('.modal.show') || G.mode!=='play'; }
window.addEventListener('keydown',e=>{
  if(e.target && (e.target.tagName==='INPUT'||e.target.tagName==='SELECT')){ if(e.code==='Escape') e.target.blur(); if(e.target.type==='number'||e.target.type==='text') return; }
  if(['Space','ArrowUp','ArrowDown','Tab'].includes(e.code) && G.mode==='play') e.preventDefault();
  keys[e.code]=true;
  if(e.repeat) return;
  emit('key',e.code);
});
window.addEventListener('keyup',e=>{ keys[e.code]=false; emit('keyup',e.code); });
window.addEventListener('blur',()=>{ for(const k in keys) keys[k]=false; INPUT.mouseDown=false; });
canvasEl.addEventListener('contextmenu',e=>e.preventDefault());
canvasEl.addEventListener('mousedown',e=>{
  if(IS_TOUCH) return;
  if(e.button===0) INPUT.mouseDown=true;
  if(e.button===2) INPUT.rmb=true;
  if(G.mode==='play' && !INPUT.locked && !INPUT.dragLook) lockPointer();
  emit('mouse',e.button);
});
window.addEventListener('mouseup',e=>{ if(e.button===0) INPUT.mouseDown=false; if(e.button===2) INPUT.rmb=false; });
window.addEventListener('mousemove',e=>{
  if(IS_TOUCH) return;
  if(INPUT.locked || (INPUT.dragLook && INPUT.mouseDown)){ INPUT.lookDX+=e.movementX||0; INPUT.lookDY+=e.movementY||0; }
});
let lockFailCount=0;
function lockPointer(){
  if(IS_TOUCH || INPUT.dragLook) return;
  if(document.pointerLockElement===canvasEl) return;
  try{
    const p=canvasEl.requestPointerLock();
    if(p && p.catch) p.catch(()=>{ lockFailCount++; if(lockFailCount>=2) enableDragLook(); });
  }catch(e){ enableDragLook(); }
}
function enableDragLook(){ if(INPUT.dragLook) return; INPUT.dragLook=true; if(typeof toast==='function') toast('Hold the mouse button and drag to look','#9fe8ff'); }
function unlockPointer(){ try{ if(document.pointerLockElement) document.exitPointerLock(); }catch(e){} }
document.addEventListener('pointerlockchange',()=>{
  const was=INPUT.locked; INPUT.locked=document.pointerLockElement===canvasEl;
  if(was && !INPUT.locked) emit('unlocked');
});
document.addEventListener('pointerlockerror',()=>{ lockFailCount++; if(lockFailCount>=2) enableDragLook(); });
function consumeLook(){ const dx=INPUT.lookDX, dy=INPUT.lookDY; INPUT.lookDX=0; INPUT.lookDY=0; return [dx,dy]; }


/* ---------------- assets: real textures + sounds, loaded up front with a progress bar ---------------- */
const ASSETS={tex:{},snd:{},done:0,total:0,onProgress:null};
const _texLoader=new THREE.TextureLoader();
/* ---------- loading the game's own files ----------
   Opened straight from the unzipped folder (file://), Edge won't let a page fetch() its own files, and
   pictures loaded from files can't be used by WebGL. So every sound + texture also ships as a small
   script (assets/js/<path>.js) that hands its bytes to __awBytes(); scripts DO load from a folder.
   (Before this, AW3 played fake fallback sounds and no real textures when opened from the folder.) */
const BYTES={wait:{}};
window.__awBytes=function(path,b64){ const w=BYTES.wait[path]; if(!w) return; delete BYTES.wait[path];
  const s=atob(b64), u=new Uint8Array(s.length); for(let i=0;i<s.length;i++) u[i]=s.charCodeAt(i); for(const f of w.res) f(u.buffer); };
function loadBytesScript(path){ return new Promise((res,rej)=>{
  if(BYTES.wait[path]){ BYTES.wait[path].res.push(res); BYTES.wait[path].rej.push(rej); return; }
  BYTES.wait[path]={res:[res],rej:[rej]};
  const el=document.createElement('script'); el.src='assets/js/'+path.replace(/^assets\//,'')+'.js'; el.async=true;
  el.onload=()=>{ el.remove(); const w=BYTES.wait[path]; if(w){ delete BYTES.wait[path]; for(const f of w.rej) f(new Error('empty '+path)); } };
  el.onerror=()=>{ el.remove(); const w=BYTES.wait[path]; delete BYTES.wait[path]; if(w) for(const f of w.rej) f(new Error('missing '+path)); };
  document.head.appendChild(el); }); }
function loadBytes(path){
  if(location.protocol==='file:') return loadBytesScript(path);
  return fetch(path).then(r=>{ if(!r.ok) throw new Error(r.status+' '+path); return r.arrayBuffer(); }).catch(()=>loadBytesScript(path));
}
function assetTick(what){ ASSETS.done++; if(ASSETS.onProgress) ASSETS.onProgress(ASSETS.done/Math.max(1,ASSETS.total),what); }
function loadTexture(name,url,o={}){
  if(ASSETS.tex[name]) return Promise.resolve(ASSETS.tex[name]);
  ASSETS.total++;
  return new Promise(res=>{ loadBytes(url).then(ab=>URL.createObjectURL(new Blob([ab],{type:/\.png$/i.test(url)?'image/png':'image/jpeg'}))).catch(()=>url).then(src=>_texLoader.load(src,t=>{ t.encoding=o.linear?THREE.LinearEncoding:THREE.sRGBEncoding; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=o.aniso||4; t.flipY=o.flipY!==false; ASSETS.tex[name]=t; assetTick(name); res(t); },undefined,()=>{ console.warn('texture missing',url); ASSETS.tex[name]=null; assetTick(name); res(null); })); });
}
/* a Poly Haven style set: <base>_diff / _nor / _rough / _ao (1K jpg) */
function loadPBR(base,o={}){
  const dir=o.dir||'assets/tex/';
  return Promise.all([loadTexture(base+'_diff',dir+base+'_diff.jpg'),loadTexture(base+'_nor',dir+base+'_nor.jpg',{linear:true}),o.rough===false?null:loadTexture(base+'_rough',dir+base+'_rough.jpg',{linear:true}),o.ao===false?null:loadTexture(base+'_ao',dir+base+'_ao.jpg',{linear:true})]);
}
/* material maps for one surface: repeat in metres (tile = size of one texture tile in the world) */
function pbrMaps(base,tile=2,o={}){
  const T=ASSETS.tex, out={};
  const rep=(t,k)=>{ if(!t) return null; const c=t.clone(); c.needsUpdate=true; c.repeat.set((o.w||tile)/tile,(o.h||tile)/tile); if(o.repeat) c.repeat.set(o.repeat[0],o.repeat[1]); out[k]=c; return c; };
  rep(T[base+'_diff'],'map'); rep(T[base+'_nor'],'normalMap'); rep(T[base+'_rough'],'roughnessMap'); rep(T[base+'_ao'],'aoMap');
  return out;
}
/* a MeshStandardMaterial from a set; opts override (color tints, roughness scale...) */
function pbrMat(base,tile,o={}){
  const maps=pbrMaps(base,tile,o); const m=new (o.physical?THREE.MeshPhysicalMaterial:THREE.MeshStandardMaterial)(Object.assign({roughness:1,metalness:0},maps,o.opts||{}));
  if(maps.normalMap) m.normalScale=new THREE.Vector2(o.normal||1,o.normal||1);
  if(o.color!=null) m.color=col(o.color);
  if(!o.w&&!o.h&&!o.repeat) m.userData.tile=tile;   // box() sizes the repeat to the box
  return m;
}
/* geometry needs uv2 for aoMap */
function withAO(geo){ if(geo.attributes.uv&&!geo.attributes.uv2) geo.setAttribute('uv2',geo.attributes.uv); return geo; }
