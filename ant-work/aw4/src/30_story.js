/* ================================================================
   STORY FRAME — flags, checkpoints + saving, the title screen,
   chapters, and the little helpers every scene uses.
   ================================================================ */
const F={};                    // this run: ending ('tiny' | 'mars'), fought, ...
function F_(){ return F; }
const SCENES={};               // checkpoint id -> async scene (31_.. 34_ files)
const CHECKPOINTS=[
  {id:'house',  name:'Dome Sweet Dome', level:'bighouse'},
  {id:'desert', name:'The Desert',      level:'desert'},
  {id:'pyramid',name:'The Pyramid',     level:'pyramid'},
  {id:'fruit',  name:'The Glow',        level:'pyramid'},
  {id:'pig',    name:'???',             level:'pigroom'}
];
const CP=id=>CHECKPOINTS.find(c=>c.id===id)||CHECKPOINTS[0];
const CUR={j2:null};           // who's who in the scene that's running
const SCENE_SND=[];                // looping sounds the running scene started (stopped on reset)
function loopSnd(name,o={}){ const h=SND.play(name,Object.assign({loop:true},o)); if(h) SCENE_SND.push(h); return h; }
function stopLoops(f=.3){ while(SCENE_SND.length){ const h=SCENE_SND.pop(); h&&h.stop(f); } }

/* ---------- lines from the voice script ---------- */
function L(id,o={}){
  const d=LINES[id]; if(!d) return Object.assign({text:'',silent:true,auto:.1},o);
  const ln={who:d.who,text:d.text.replace(/^\[[^\]]*\]\s*/,''),id};
  if(d.who==='Jay2'&&CUR.j2) ln.h=CUR.j2;
  return Object.assign(ln,o);
}
function say(ids,o){ return talk(ids.map(x=>typeof x==='string'?L(x):x),o); }
/* talking while you keep walking / looking (no stopping): one line after another */
let CHATQ=Promise.resolve();
function chat(ids,gap=.3){ const p=CHATQ.then(()=>chatRun(ids,gap)); CHATQ=p.catch(()=>{}); return p; }
async function chatRun(ids,gap){
  for(const x of ids){ const ln=typeof x==='string'?L(x):x; await chatLine(ln); await wait(ln.after!=null?ln.after:gap); }
  later(.4,()=>{ if(!DLG.active) $('sub').classList.remove('show'); });
}
function chatLine(ln){
  const tok=STORY.token;
  return new Promise(res=>{
    const sub=$('sub');
    if(SETTINGS.subs!==false&&ln.text){ $('subWho').textContent=lineSpeaker(ln); $('subWho').className='who '+(WHO_CLASS[ln.who]||''); $('subWho').style.display=''; $('subTxt').innerHTML=ln.text; sub.classList.remove('ready'); sub.classList.add('show'); }
    if(ln.fx) try{ ln.fx(); }catch(e){ console.error(e); }
    const h=ln.h; if(h){ h.userData.A.talk=true; if(ln.mood&&h.userData.J) setMood(h,ln.mood); }
    const at=ln.at||(h?h.getWorldPosition(new THREE.Vector3()).add(V3(0,1.55*(h.scale.y||1),0)):null);
    let done=false; const end=()=>{ if(done) return; done=true; if(h) h.userData.A.talk=false; if(tok===STORY.token) res(); };
    if(!speakLine(ln.who,ln.text,end,ln.id,at)) later(Math.max(1.3,ln.text.length*.06),end);
  });
}

/* per-frame jobs of the running scene (cleared on every restart) */
const SCENE_TICKS=[];
on('tick',dt=>{ for(const f of SCENE_TICKS.slice()) try{ f(dt); }catch(e){ console.error(e); } });
/* ---------- scene helpers ---------- */
function cine(on){ letterbox(on); crosshair(!on); if(on){ PLAYER.lock(); } }
function lookOnly(){ PLAYER.ctl.move=false; PLAYER.ctl.look=true; PLAYER.ctl.interact=false; PLAYER.ctl.jump=false; }
function freeWalk(){ PLAYER.free(); PLAYER.ctl.jump=true; letterbox(false); crosshair(true); }
function setPlayer(pos,yaw,pitch=0){ PLAYER.pos.copy(pos); PLAYER.yaw=yaw; PLAYER.pitch=pitch; PLAYER.vel.set(0,0,0); PLAYER.lookTo=null; PLAYER.y=LV&&LV.ground?LV.ground(pos.x,pos.z):0; PLAYER.onGround=true; invalidateMotion(); }
function yawTo(from,to){ return Math.atan2(-(to.x-from.x),-(to.z-from.z)); }
function faceTo(h,p){ h.rotation.y=Math.atan2(p.x-h.position.x,p.z-h.position.z); }
function headOf(h){ const J=h.userData.J; return (J?J.head:h.userData.parts.headJ).getWorldPosition(new THREE.Vector3()).add(V3(0,J?.1:.2,0)); }
/* a person or the blocky Jay, reset to standing, alive, no pose */
function resetActor(h){
  const A=h.userData.A; A.dead=false; A.custom=null; A.path=null; A.look=null; A.talk=false; A.seated=false; A.idleOff=false; A.faceYaw=null;
  h.rotation.set(0,h.rotation.y,0); h.visible=true;
  if(h.userData.J){ clearPose(h,0); A.pose=null; A.poseW=0; setMood(h,'neutral'); }
  else A.pose=null;
  if(h.userData.nose) h.userData.nose.visible=!!F.fought;
  else if(F.fought) addNoseBlood(h);
}
/* falling down (the fruit): tip over backwards around the feet */
async function collapse(h,dir=1){
  const A=h.userData.A; if(h.userData.J) setPose(h,'flinch',.3);
  await wait(.45);
  const r0=h.rotation.x; await tweenVal(v=>{ h.rotation.x=v; },r0,-1.45*dir,.75,easeIn);
  SND.play('body_fall',{vol:.9,pos:h.position.clone().add(V3(0,.3,0)),ref:2.5});
  tweenVal(v=>{ h.rotation.x=v; },-1.45*dir,-1.36*dir,.12,easeOut).then(()=>tweenVal(v=>{ h.rotation.x=v; },-1.36*dir,-1.42*dir,.25));
  if(h.userData.J) setPose(h,'lieBack',.3); A.dead=false; A.idleOff=true;
}
/* the cleanup every start / restart / quit goes through */
function cleanUI(){
  closeDialogNow(); hideChoices(); if(FIGHT.active||FIGHT.h) endFight(); FIGHT.h=null;
  SLOWMO.k=SLOWMO.target=1; stopLoops(.2);
  letterbox(false); lids(0); blurScreen(0); fightUI(false); cardHide(); hidePrompt(); itemHints(null);
  for(const id of ['fade','flash','fxWhite','fxBlack']){ const e=$(id); e.style.transition='none'; e.style.opacity=0; }
  camRelease(0); PLAYER.auto=null; PLAYER.lookTo=null; PLAYER.eye=1.64; PLAYER.roll=0; PLAYER.free(); PLAYER.ctl.jump=true;
  PLAYER.hasWatch=true; PLAYER.watchLook=0; PLAYER.watchGlow=0; PLAYER.item=null; PLAYER.stitched=true;
  VM.forceShow=false; VM.handsLook=0; VM.reach=0; VM.punchT=0; if(VM.holdItem){ VM.holdItem.parent&&VM.holdItem.parent.remove(VM.holdItem); VM.holdItem=null; } VM.eatK=0; setVM(true); redKnuckles(false); setVMBlocky(false); vmCarry(null); watchMode('time');
  objective(''); hudVisible(true); crosshair(true);
  if(typeof AMB!=='undefined') setAmbience([]);
  SCENE_TICKS.length=0; CHATQ=Promise.resolve(); for(const k of ['buildH','orb']) STORY[k]=null;
}
/* ---------- checkpoints + saving ---------- */
function saveCheckpoint(id){
  const s=getSave()||{}; s.cp=id; s.flags=JSON.parse(JSON.stringify(F)); s.reached=Object.assign({},s.reached||{},{[id]:1}); s.ending=F.ending||s.ending;
  writeSave(s); toast('Checkpoint','#cfa8ff');
}
async function startAt(id,flags){
  const fl=JSON.parse(JSON.stringify(flags||{}));
  resetStory(); cleanUI(); TITLE.hide();
  for(const k in F) delete F[k]; Object.assign(F,fl);
  if(!F.ending) F.ending='tiny';
  G.mode='play'; G.paused=false;
  const cp=CP(id);
  await enterLevel(cp.level,{pos:V3(0,0,0)},{keepMusic:false});
  stopMusic(.3);
  lockPointer();
  runStory(()=>SCENES[cp.id]());
}
function restartCheckpoint(){ const s=getSave(); startAt(s&&s.cp||'house',s&&s.flags||F); }
function quitToTitle(){ TITLE.show(false); }

/* ---------- the title: the desert at noon, the pyramid far away ---------- */
TITLE.show=async function(first){
  resetStory(); cleanUI(); G.mode='menu'; G.paused=false; unlockPointer();
  const lv=LEVELS.desert;
  await enterLevel('desert',{pos:V3(40,0,30),yaw:0},{keepMusic:true});
  lv.jay2.visible=false; lv.glareOn=false; lv.sweatOn=false; lv.clearPrints();
  PLAYER.lock(); setVM(false); crosshair(false); hudVisible(false);
  const P=DESERT.pyr;
  camFollow((t)=>{ const a=-.55+t*.006; const r=230; const x=P.x+Math.sin(a)*r, z=P.z+Math.cos(a)*r; return {pos:V3(x,lv.ground(x,z)+4.2+Math.sin(t*.05)*.6,z),look:V3(P.x+40,26,P.z),fov:46}; },46);
  FX.dof=0;
  playMusic('title',first?3:1.5);
  $('title').classList.remove('hide'); $('title').style.opacity=1;
  const s=getSave(); const has=!!(s&&s.cp);
  $('btnContinue').classList.toggle('hide',!has); $('contWhere').textContent=has?CP(s.cp).name:'';
  $('trophyCount').textContent=Object.keys(TROPHY).length+' / '+TROPHY_DEFS.length;
  if(TITLE.nav) TITLE.nav.stop();
  TITLE.nav=GS3Console.nav($('titleMenu'),{first:has?$('btnContinue'):$('btnNew')});
};
TITLE.hide=function(){ $('title').classList.add('hide'); if(TITLE.nav){ TITLE.nav.stop(); TITLE.nav=null; } setVM(true); hudVisible(true); };
$('btnContinue').onclick=()=>{ const s=getSave(); if(!s||!s.cp) return; SFX.uiClick(); startAt(s.cp,s.flags||{ending:s.ending||'tiny'}); };
$('btnNew').onclick=()=>{ SFX.uiClick(); openModal('endingPick',{back:()=>{ closeModal('endingPick'); SFX.uiBack(); },first:$('pickA')}); };
$('pickA').onclick=()=>{ closeModal('endingPick',false); SFX.uiClick(); startAt('house',{ending:'tiny'}); };
$('pickB').onclick=()=>{ closeModal('endingPick',false); SFX.uiClick(); startAt('house',{ending:'mars'}); };
$('endingBack').onclick=()=>{ closeModal('endingPick'); SFX.uiBack(); };
$('btnChapters').onclick=()=>{
  SFX.uiClick(); const s=getSave()||{}; const reached=s.reached||{}; const list=$('chapterList'); list.innerHTML='';
  CHECKPOINTS.forEach((c,i)=>{ const b=document.createElement('button'); b.className='gs3-item'; const open=i===0||reached[c.id];
    b.innerHTML=(open?c.name:'Locked')+' <span class="gs3-value">'+(i+1)+'</span>'; if(!open){ b.disabled=true; b.style.opacity=.45; }
    b.onclick=()=>{ if(!open) return; closeModal('chapters',false); SFX.uiClick(); if(c.id==='house'){ openModal('endingPick',{back:()=>{ closeModal('endingPick'); SFX.uiBack(); },first:$('pickA')}); return; } startAt(c.id,Object.assign({ending:s.ending||'tiny'},c.id===s.cp?s.flags:{})); };
    list.appendChild(b); });
  openModal('chapters',{back:()=>{ closeModal('chapters'); SFX.uiBack(); },first:list.querySelector('.gs3-item:not([disabled])')});
};
$('chaptersBack').onclick=()=>{ closeModal('chapters'); SFX.uiBack(); };
$('btnSettings').onclick=()=>openSettings('title');
/* the little pictures on the ending cards */
(function endingPics(){
  const pic=(id,blockyOther)=>{ const c=document.createElement('canvas'); c.width=300; c.height=120; const x=c.getContext('2d');
    const g=x.createLinearGradient(0,0,0,120); g.addColorStop(0,blockyOther?'#1a0f2e':'#2a1208'); g.addColorStop(1,'#000'); x.fillStyle=g; x.fillRect(0,0,300,120);
    x.fillStyle='rgba(255,255,255,.06)'; x.beginPath(); x.arc(150,140,120,Math.PI,0); x.fill();
    const person=(cx,blocky,col_)=>{ if(blocky){ x.fillStyle='#e2b08c'; x.fillRect(cx-14,30,28,28); x.fillStyle=col_; x.fillRect(cx-16,58,32,40); x.fillStyle='#2e3440'; x.fillRect(cx-14,98,12,22); x.fillRect(cx+2,98,12,22); x.fillStyle='#2a1c12'; x.fillRect(cx-14,30,28,8); }
      else { x.fillStyle='#e2b08c'; x.beginPath(); x.ellipse(cx,44,13,16,0,0,7); x.fill(); x.fillStyle='#2a1c12'; x.beginPath(); x.ellipse(cx,34,14,9,0,Math.PI,0); x.fill(); x.fillStyle=col_; x.beginPath(); x.roundRect?x.roundRect(cx-17,60,34,44,8):x.rect(cx-17,60,34,44); x.fill(); x.fillStyle='#2e3440'; x.fillRect(cx-13,104,11,16); x.fillRect(cx+2,104,11,16); } };
    person(105,!blockyOther,'#2f4d6e'); person(195,blockyOther,'#2f4d6e');
    x.fillStyle='rgba(255,255,255,.75)'; x.font='bold 12px sans-serif'; x.textAlign='center'; x.fillText('YOU',105,16); x.fillText('JAY 2',195,16);
    $(id).style.backgroundImage='url('+c.toDataURL()+')'; };
  pic('picA',true); pic('picB',false);
})();

/* ---------- testing: ?debug=house|desert|pyramid|fruit|pig[&ending=mars] ---------- */
const DEBUG={async run(name){ const q=new URLSearchParams(location.search); initAudio();
  $('splash').classList.add('hide');
  if(name==='title'){ TITLE.show(true); return; }
  const flags={ending:q.get('ending')||'tiny',fought:q.get('fought')==='1'};
  await startAt(name,flags); }};
