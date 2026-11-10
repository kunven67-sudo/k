/* ================================================================
   CORE — helpers, settings, presets, save, game clock, input
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
const DEFAULT_SETTINGS=Object.assign({preset:'medium',fov:75,bright:1.18,showFps:false,autoLower:true,
  master:.9,music:.55,sfx:.9,voice:true,textSpeed:1,sens:1,invertY:false,bob:true,shake:true,hud:true,presetLocked:false,funny:false,funnyLevel:3},PRESETS.medium);
const SETTINGS=Object.assign({},DEFAULT_SETTINGS,loadJSON('aw2_settings')||{});
if(!PRESETS[SETTINGS.preset] && SETTINGS.preset!=='custom') SETTINGS.preset='high';
function saveSettings(){ saveJSON('aw2_settings',SETTINGS); }
function detail(){ return SETTINGS.detail; }          // 0..4, used by world builders
function dq(a,b,c,d,e){ return [a,b,c,d,e][clamp(SETTINGS.detail,0,4)]; }   // pick a value per detail level

/* ---------------- save / checkpoints ---------------- */
const SAVE_KEY='aw2_save';
function getSave(){ return loadJSON(SAVE_KEY); }
function writeSave(obj){ saveJSON(SAVE_KEY,Object.assign({t:Date.now()},obj)); }

/* ---------------- game clock, timers, async story helpers ---------------- */
const G={time:0,dt:0,real:0,paused:false,mode:'boot',frame:0};
const STORY={token:1};
const TIMERS=[];
function later(sec,fn){ const tok=STORY.token; TIMERS.push({t:G.time+sec,fn,tok}); }
/* gTimeout: like setTimeout but on the game clock, so it freezes while paused.
   Not tied to the story (a checkpoint reset doesn't drop it) -- for voices, fades and safety timers. */
const PTIMERS=[];
function gTimeout(sec,fn){ const e={t:G.time+Math.max(0,sec),fn}; PTIMERS.push(e); return e; }
function gClear(e){ if(e) e.dead=true; }
function runTimers(){
  if(PTIMERS.length){ const due=[]; for(let i=PTIMERS.length-1;i>=0;i--){ if(PTIMERS[i].dead){ PTIMERS.splice(i,1); continue; } if(PTIMERS[i].t<=G.time){ due.push(PTIMERS[i]); PTIMERS.splice(i,1); } } for(const d of due){ try{ d.fn(); }catch(e){ console.error(e); } } }
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
  emit('mouse',e.button);
});
/* any click while playing (game, dialog box, HUD) grabs the mouse again -- not just clicks on the 3D view */
window.addEventListener('mousedown',e=>{
  if(IS_TOUCH || G.mode!=='play' || G.paused || INPUT.locked) return;
  if(typeof MODAL!=='undefined' && MODAL.open) return;
  const t=e.target; if(t && t.closest && t.closest('button,input,select,label,.modal,#settings,#pause')) return;
  lockPointer();
},true);
window.addEventListener('mouseup',e=>{ if(e.button===0) INPUT.mouseDown=false; if(e.button===2) INPUT.rmb=false; });
window.addEventListener('mousemove',e=>{
  if(IS_TOUCH) return;
  if(INPUT.locked || (INPUT.dragLook && INPUT.mouseDown)){ INPUT.lookDX+=e.movementX||0; INPUT.lookDY+=e.movementY||0; }
});
/* Mouse lock. Old bug: two failed grabs in a row (easy: Chrome refuses a grab for ~1 s after Esc)
   switched the game to drag-look FOREVER and it never grabbed the mouse again.
   Now: every click tries again, drag-look is only a stand-in while the mouse is free,
   and the first real grab turns drag-look back off. */
let lockFailCount=0, lockEverWorked=false, lastUnlockAt=-1e9, lockRetryT=0;
function lockPointer(){
  if(IS_TOUCH) return;
  if(document.pointerLockElement===canvasEl) return;
  if(!canvasEl.requestPointerLock){ enableDragLook(); return; }
  try{
    const p=canvasEl.requestPointerLock();
    if(p && p.catch) p.catch(()=>{});            // failures are counted once, in 'pointerlockerror'
  }catch(e){ lockFailed(); }
}
function lockFailed(){
  lockFailCount++;
  if(!lockEverWorked && lockFailCount>=3) enableDragLook();
  /* refused because it was too soon after Esc: try once more when the wait is over (works in GS3; browsers may still want a click) */
  const since=performance.now()-lastUnlockAt;
  if(since<1600){ clearTimeout(lockRetryT); lockRetryT=setTimeout(()=>{ if(G.mode==='play' && !G.paused && !INPUT.locked && !(typeof MODAL!=='undefined' && MODAL.open)) lockPointer(); },1650-since); }
}
function enableDragLook(){ if(INPUT.dragLook) return; INPUT.dragLook=true; if(typeof toast==='function') toast('Click the game to grab the mouse (or hold the button and drag to look)','#9fe8ff'); }
function unlockPointer(){ try{ if(document.pointerLockElement) document.exitPointerLock(); }catch(e){} }
document.addEventListener('pointerlockchange',()=>{
  const was=INPUT.locked; INPUT.locked=document.pointerLockElement===canvasEl;
  if(INPUT.locked){ lockFailCount=0; lockEverWorked=true; INPUT.dragLook=false; clearTimeout(lockRetryT); }
  if(was && !INPUT.locked){ lastUnlockAt=performance.now(); emit('unlocked'); }
});
document.addEventListener('pointerlockerror',lockFailed);
function consumeLook(){ const dx=INPUT.lookDX, dy=INPUT.lookDY; INPUT.lookDX=0; INPUT.lookDY=0; return [dx,dy]; }

