/* ================================================================
   STORY MANAGER — checkpoints, save/continue, restart, quit to title
   ================================================================ */
const CHECKPOINT_NAMES={A1:'Tinyverse · Home',A2:"Tinyverse · Jim's stand",A3:'Tinyverse · The lab',A4:'Tinyverse · Tiny',A5:'Tinyverse · The creatures',B1:'Mars Shift · The moon',B2:'Mars Shift · Mars',B3:'Mars Shift · House hunting',B4:'Mars Shift · Your house',B5:'Mars Shift · Day 2',B6:'Mars Shift · The dream',B7:'Mars Shift · Day 3',B8:'Mars Shift · A bigger house',B9:"Mars Shift · Steve's ship",B10:'Mars Shift · Blocky Earth',B11:'Mars Shift · Pluto',B12:'Mars Shift · XXX5',A6:'Tinyverse · Stuck tiny',A7:'Tinyverse · Mite Town',A8:'Tinyverse · The deep'};
const CHECKPOINTS={};
const WORLD={path:null,cp:null,photos:[],flags:{}};
function resetPlayerState(){
  closeDialogNow(); hideSay(); hidePrompt(); objective(null); cardHide(); letterbox(false);
  camRelease(0); resetFX(); FX.whiteout=0; FX.blackout=0;
  PLAYER.item=null; PLAYER.carry=null; PLAYER.eye=1.64; PLAYER.y=0; PLAYER.vel.set(0,0,0); PLAYER.hasWatch=false; PLAYER.watchGlow=0; PLAYER.watchLook=0; PLAYER.scale=PLAYER.targetScale=1; PLAYER.hp=100; PLAYER.fly=false; PLAYER.swim=false; PLAYER.stitched=false; PLAYER.lookTo=null; VM.netT=0; VM.slapT=0; VM.forceShow=false; setVMSuit(false); setEcho(0);
  vmCarry(null); setVM(false); crosshair(true); setMarker(null); FX.pixel=0; if(typeof setVMBlocky==='function') setVMBlocky(false); if(typeof jetHUD==='function') jetHUD(false); if(typeof countHUD==='function') countHUD(null);
  showCash(false); showCoins(false); setBugFood(0,false); setHP(100,false); showClock(false); itemHints(null);
  $('visor').classList.remove('show'); $('radio').classList.remove('show'); $('photos').innerHTML=''; $('cook').classList.remove('show');
  for(const id of ['payOverlay','convOverlay','buyOverlay','pcOverlay']) $(id).classList.remove('show'); MODAL.open=null;
  $('tbc').classList.remove('show');
  PLAYER.lock();
  WORLD.flags={};
}
async function startFromCheckpoint(cp){
  if(!CHECKPOINTS[cp]){ __showErr&&__showErr('Missing checkpoint '+cp); return; }
  resetStory(); stopSpeech(); cardHide(); hideSay();
  await fade(1,.6);
  $('title').classList.add('hide'); $('story').classList.add('hide');
  resetPlayerState();
  if(cp[0]!==(WORLD.path||'')[0]) WORLD.photos=[];
  WORLD.path=cp[0]; WORLD.cp=cp; writeSave({cp});
  G.mode='play'; G.paused=false; hudVisible(true); TOUCH_UI.on(true);
  runStory(()=>CHECKPOINTS[cp]());
}
function setCheckpoint(cp){ WORLD.cp=cp; writeSave({cp}); }
function restartCheckpoint(){ const s=getSave(); startFromCheckpoint((s&&s.cp)||WORLD.cp||'A1'); }
async function quitToTitle(){
  resetStory(); stopSpeech(); cardHide(); hideSay(); letterbox(false); await fade(1,.5);
  resetPlayerState(); G.mode='menu'; hudVisible(false); TOUCH_UI.on(false);
  await enterLevel('intro',{pos:V3(0,0,6)});
  const lv=LEVELS.intro; for(const c of lv.chunks){ c.visible=false; } lv.ant.position.set(-.72,0,.18);
  INTRO.done=true; INTRO.titleCam(); TITLE.show(); playMusic('title');
  fade(0,.8);
}
/* end-of-chapter screen */
function showTBC(chapter,other,opts={}){
  resetStory(); G.mode='menu'; unlockPointer(); hudVisible(false); TOUCH_UI.on(false); letterbox(false); $('visor').classList.remove('show'); setMarker(null); countHUD(null); spamHUD(false);
  $('tbcChap').textContent=(opts.secret?'SECRET ENDING · ':'')+chapter;
  const nSec=SECRET_ENDINGS.filter(id=>TROPHY[id]).length; $('tbcSecret').textContent='Secret endings found: '+nSec+' / '+SECRET_ENDINGS.length;
  const tz=!opts.secret&&TEASERS[WORLD.path]; $('tbcTeaser').style.display=tz?'':'none'; $('tbcTeaser').onclick=()=>{ $('tbc').classList.remove('show'); playTeaser(chapter,other); };
  clearTimeout(showTBC.auto); if(tz&&!opts.noTeaser) showTBC.auto=setTimeout(()=>{ if($('tbc').classList.contains('show')&&G.mode==='menu'){ $('tbc').classList.remove('show'); playTeaser(chapter,other); } },4500);
  const gal=$('tbcGal'); gal.innerHTML='';
  if(WORLD.path==='A') WORLD.photos.slice(-4).forEach((p,i)=>{ const d=document.createElement('div'); d.className='polaroid'; d.style.transform=`rotate(${[-4,3,-2,5][i]}deg)`; d.innerHTML='<img src="'+p+'"><span>for Jim</span>'; gal.appendChild(d); });
  $('tbc').classList.add('show'); playMusic(null); SFX.titleSlam();
  $('tbcOther').onclick=()=>{ clearTimeout(showTBC.auto); $('tbc').classList.remove('show'); startFromCheckpoint(other); };
  $('tbcTitle').onclick=()=>{ clearTimeout(showTBC.auto); $('tbc').classList.remove('show'); quitToTitle(); };
  writeSave({cp:WORLD.cp,finished:(getSave()||{}).finished?Array.from(new Set([...(getSave().finished),WORLD.path])):[WORLD.path]});
}

