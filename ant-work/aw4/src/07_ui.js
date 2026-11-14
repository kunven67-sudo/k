/* ================================================================
   UI (ANT WORK 4) — movie-style subtitles, things to say (choices that
   gray out), HUD, fades, eyelids, menus on the Game System 3 kit
   (PS5 / Xbox / Switch looks), settings, pause, touch controls
   ================================================================ */
const WHO_CLASS={Jay:'you',Jay2:'jay2',Jim:'jim',Pig:'pig'};
const WHO_NAME={Jay:'JAY',Jay2:'JAY 2',Jim:'JIM',Pig:'???'};
/* ---------- subtitles + voice: one line after another, like a film ---------- */
const DLG={active:false,lines:[],i:0,resolve:null,cur:null,speaking:false,readyAt:0,token:0,autoT:null};
function talk(lines,o={}){
  if(!lines||!lines.length) return Promise.resolve();
  const tok=STORY.token;
  return new Promise(res=>{
    DLG.active=true; DLG.lines=lines.map(l=>typeof l==='string'?{text:l}:l); DLG.i=0; DLG.skipAll=!!o.skipAll;
    DLG.resolve=()=>{ if(tok===STORY.token) res(); };
    showLine();
  });
}
function lineSpeaker(L){ return L.name||WHO_NAME[L.who]||L.who||''; }
function showLine(){
  const L=DLG.lines[DLG.i]; DLG.cur=L; DLG.token++; const myTok=DLG.token;
  if(L.fx) try{ L.fx(); }catch(e){ console.error(e); }
  const who=lineSpeaker(L);
  const sub=$('sub'); sub.classList.remove('ready');
  if(SETTINGS.subs!==false && L.text){ $('subWho').textContent=who; $('subWho').className='who '+(WHO_CLASS[L.voice||L.who]||''); $('subWho').style.display=who?'':'none'; $('subTxt').innerHTML=L.text; sub.classList.add('show'); }
  else sub.classList.remove('show');
  DLG.readyAt=performance.now()+220;
  // the speaker moves their mouth
  for(const h of HUMANS) if(h.userData.A) h.userData.A.talk=false;
  if(typeof FOLK!=='undefined') for(const f of FOLK) f.userData.A.talk=false;
  if(L.h){ const A=L.h.userData.A; A.talk=true; if(L.mood&&L.h.userData.J) setMood(L.h,L.mood); if(L.pose!==undefined&&L.h.userData.J){ if(L.pose) setPose(L.h,L.pose); else clearPose(L.h); } if(L.pose!==undefined&&L.h.userData.folk) A.pose=L.pose; }
  DLG.speaking=true;
  const onEnd=()=>{ if(DLG.cur!==L||myTok!==DLG.token) return; DLG.speaking=false; if(L.h) L.h.userData.A.talk=false;
    const pause=L.auto!=null?L.auto:(L.hold?null:.45);
    if(pause!=null) DLG.autoT=later(pause,()=>{ if(DLG.cur===L&&DLG.active&&myTok===DLG.token) advanceDialog(true); }); };
  if(L.silent){ DLG.speaking=false; later(L.auto!=null?L.auto:Math.max(1.2,(L.text||'').length*.055),()=>{ if(DLG.cur===L&&DLG.active&&myTok===DLG.token) advanceDialog(true); }); return; }
  const at=L.at||(L.h?L.h.getWorldPosition(new THREE.Vector3()).add(V3(0,1.55*(L.h.scale.y||1),0)):null);
  const used=speakLine(L.voice||L.who,L.text,onEnd,L.id,at);
  if(!used){ DLG.speaking=false; later(Math.max(1.4,(L.text||'').replace(/<[^>]+>/g,'').length*.06),()=>{ if(DLG.cur===L&&DLG.active&&myTok===DLG.token) advanceDialog(true); }); }
}
function updateDialog(dt){
  if(!DLG.active) return;
  const L=DLG.cur; if(!L) return;
  if(L.h) L.h.userData.A.talk=DLG.speaking;
  if(!DLG.speaking && performance.now()>DLG.readyAt && L.hold) $('sub').classList.add('ready');
}
function advanceDialog(auto){
  if(!DLG.active) return;
  if(!auto && performance.now()<DLG.readyAt) return;
  const L=DLG.cur; if(L&&L.h) L.h.userData.A.talk=false;
  if(!auto){ stopSpeech(); if(DLG.skipAll){ DLG.i=DLG.lines.length-1; } }
  DLG.speaking=false; DLG.token++;
  DLG.i++;
  if(DLG.i>=DLG.lines.length){ DLG.active=false; DLG.cur=null; interactCd=.5; $('sub').classList.remove('show'); const r=DLG.resolve; DLG.resolve=null; if(r) r(); return; }
  showLine();
}
function closeDialogNow(){ DLG.active=false; DLG.cur=null; DLG.token++; $('sub').classList.remove('show'); stopSpeech(); hideChoices(); }
$('sub').addEventListener('click',()=>advanceDialog());
/* a one-off line that doesn't stop the game (reactions, mutters) */
function bark(who,text,h,id){ const sub=$('sub'); if(SETTINGS.subs!==false&&text){ $('subWho').textContent=lineSpeaker({who}); $('subWho').className='who '+(WHO_CLASS[who]||''); $('subTxt').innerHTML=text; sub.classList.remove('show'); void sub.offsetWidth; sub.classList.add('show'); sub.classList.remove('ready'); }
  if(h){ h.userData.A.talk=true; }
  const at=h?h.getWorldPosition(new THREE.Vector3()).add(V3(0,1.55,0)):null;
  const done=()=>{ if(h) h.userData.A.talk=false; if(!DLG.active) later(.5,()=>{ if(!DLG.active) sub.classList.remove('show'); }); };
  if(!speakLine(who,text,done,id,at)) later(Math.max(1.4,(text||'').length*.06),done); }
/* ---------- things to say: a list you pick from; what you already said turns gray ---------- */
const CHOICE={active:false,nav:null,resolve:null,opts:[]};
function choose(opts,o={}){
  return new Promise(res=>{
    const box=$('choices'); for(const el of [...box.querySelectorAll('.choice')]) el.remove();
    $('choiceLead').textContent=o.lead||'SAY SOMETHING';
    CHOICE.active=true; CHOICE.opts=opts; CHOICE.resolve=res;
    opts.forEach((op,i)=>{ const b=document.createElement('button'); b.className='choice'+(op.used?' used':'')+(op.kind==='fight'?' fight':''); b.setAttribute('data-gs3-nav',''); b.dataset.n=String(i+1); b.innerHTML=op.text; b.onclick=()=>pickChoice(i); box.appendChild(b); });
    box.classList.add('show'); unlockPointer(); document.body.classList.add('indlg');
    const first=box.querySelector('.choice:not(.used)')||box.querySelector('.choice');
    CHOICE.nav=GS3Console.nav(box,{first});
  });
}
function pickChoice(i){
  if(!CHOICE.active) return; const op=CHOICE.opts[i], b=$('choices').querySelectorAll('.choice')[i];
  if(!op) return;
  if(op.used){ b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); SFX.uiBack(); return; }
  SFX.uiClick(); const r=CHOICE.resolve; hideChoices(); if(r) r(op);
}
function hideChoices(){ CHOICE.active=false; CHOICE.resolve=null; if(CHOICE.nav){ CHOICE.nav.stop(); CHOICE.nav=null; } $('choices').classList.remove('show'); if(G.mode==='play'&&!G.paused&&!MODAL.open) lockPointer(); }

/* ---------- HUD ---------- */
let objCur='';
function objective(text,quiet=false){ const o=$('objective'); if(!text){ o.classList.remove('show'); objCur=''; $('objText').innerHTML=''; return; } if(text===objCur) return; objCur=text; $('objText').innerHTML=text; o.classList.remove('show'); void o.offsetWidth; o.classList.add('show'); if(!quiet) SFX.objective(); }
function toast(text,color='#e0c08a'){ const el=document.createElement('div'); el.className='toast'; el.textContent=text; el.style.color=color; $('toasts').appendChild(el); setTimeout(()=>el.remove(),1700); }
let promptCur='';
function showPrompt(key,label){ const html=(IS_TOUCH?'<kbd>USE</kbd>':'<kbd>'+key+'</kbd>')+label; if(html!==promptCur){ $('prompt').innerHTML=html; promptCur=html; } $('prompt').classList.add('show'); }
function hidePrompt(){ $('prompt').classList.remove('show'); promptCur=''; }
function itemHints(list){ const el=$('itemHint'); if(!list||!list.length){ el.classList.remove('show'); el.innerHTML=''; return; } el.innerHTML=list.map(s=>'<div>'+s+'</div>').join(''); el.classList.add('show'); }
function crosshair(on){ $('crosshair').classList.toggle('off',!on); }
function hudVisible(on){ $('hud').style.display=on?'':'none'; }
/* ---------- screen effects ---------- */
function fade(to,dur=.6){ const f=$('fade'); f.style.transition='opacity '+dur+'s'; f.style.opacity=to; return new Promise(r=>setTimeout(r,dur*1000+30)); }
function flashWhite(peak=1,dur=.6){ const f=$('flash'); f.style.transition='none'; f.style.opacity=peak; void f.offsetWidth; f.style.transition='opacity '+dur+'s ease-out'; f.style.opacity=0; }
function letterbox(on){ $('letterbox').classList.toggle('on',on); }
async function card(t,s='',sec=3){ $('cardT').textContent=t; $('cardS').textContent=s; const c=$('card'); c.classList.add('show'); await wait(sec); c.classList.remove('show'); await wait(1); }
function cardShow(t,s){ $('cardT').textContent=t; $('cardS').textContent=s; $('card').classList.add('show'); }
function cardHide(){ $('card').classList.remove('show'); }
function dmgFlash(){ const d=$('dmg'); d.style.opacity=1; setTimeout(()=>d.style.opacity=0,200); }
/* eyelids: 0 = open, 1 = shut */
function lids(k){ const el=$('lids'); el.classList.toggle('on',k>.001); el.style.setProperty('--lid',clamp(k,0,1)); }
/* whole screen blur (the weird fruit) */
function blurScreen(k){ const b=$('blur'); b.style.opacity=k>.01?1:0; b.style.backdropFilter=b.style.webkitBackdropFilter='blur('+(k*9).toFixed(1)+'px)'; }

/* ---------- menus: the Game System 3 kit panels ---------- */
const MODAL={open:null,nav:null,prevCtl:null};
function openModal(id,o={}){
  if(MODAL.open) closeModal(MODAL.open,false);
  MODAL.open=id; const el=$(id); el.hidden=false; unlockPointer();
  if(G.mode==='play'){ MODAL.prevCtl=Object.assign({},PLAYER.ctl); PLAYER.lock(); }
  hidePrompt(); SFX.uiOpen();
  MODAL.nav=GS3Console.nav(el,{back:o.back||(()=>closeModal(id)),first:o.first});
  return el;
}
function closeModal(id,restore=true){
  const el=$(id); el.hidden=true; if(MODAL.nav){ MODAL.nav.stop(); MODAL.nav=null; }
  if(MODAL.open===id) MODAL.open=null;
  if(restore&&MODAL.prevCtl&&G.mode==='play'){ Object.assign(PLAYER.ctl,MODAL.prevCtl); MODAL.prevCtl=null; }
  if(G.mode==='play'&&!G.paused&&!MODAL.open&&!CHOICE.active) lockPointer();
  if(G.mode==='menu'&&!MODAL.open&&TITLE.nav) TITLE.nav.focus(TITLE.nav.current()||$('btnNew'));
}
function askConfirm(text,yes='Yes',no='Cancel'){ return new Promise(res=>{ $('askText').textContent=text; $('askYes').textContent=yes; $('askNo').textContent=no;
  const prev=MODAL.open, prevNav=MODAL.nav; MODAL.nav=null; MODAL.open=null;
  const el=$('askOverlay'); el.hidden=false; SFX.uiOpen();
  const nav=GS3Console.nav(el,{back:()=>done(false),first:$('askNo')});
  const done=v=>{ el.hidden=true; nav.stop(); $('askYes').onclick=$('askNo').onclick=null; v?SFX.uiClick():SFX.uiBack(); MODAL.open=prev; MODAL.nav=prevNav; res(v); };
  $('askYes').onclick=()=>done(true); $('askNo').onclick=()=>done(false); }); }

/* ---------- pause ---------- */
function pauseGame(){
  if(G.mode!=='play'||G.paused||MODAL.open) return;
  G.paused=true; unlockPointer(); duckMusic(.35);
  $('pauseSub').textContent=(LV&&LV.title)?('Ant Work 3 · '+LV.title):'Ant Work 3';
  openModal('pause',{back:resumeGame,first:$('pResume')});
  if(HAS_TTS){ try{ speechSynthesis.pause(); }catch(e){} }
  if(VOICE.cur&&VOICE.cur.src){ try{ VOICE.cur.src.playbackRate.value=0; }catch(e){} }
  if(AU.ok) ambBus.gain.setTargetAtTime(SETTINGS.sfx*.25,ACtx.currentTime,.2);
}
function resumeGame(){
  closeModal('pause'); G.paused=false; duckMusic(1); applyVolumes();
  if(HAS_TTS){ try{ speechSynthesis.resume(); }catch(e){} }
  if(VOICE.cur&&VOICE.cur.src){ try{ VOICE.cur.src.playbackRate.value=1; }catch(e){} }
  if(!CHOICE.active) lockPointer(); SFX.uiClick();
}
on('unlocked',()=>{ if(G.mode==='play' && !G.paused && !MODAL.open && !CHOICE.active) pauseGame(); });
$('pResume').onclick=resumeGame;
$('pSettings').onclick=()=>openSettings('pause');
$('pCheckpoint').onclick=async()=>{ if(!await askConfirm('Restart this part from its checkpoint?','Restart')) return; closeModal('pause',false); G.paused=false; duckMusic(1); restartCheckpoint(); };
$('pTitle').onclick=async()=>{ if(!await askConfirm('Quit to the title? Your checkpoint stays saved.','Quit')) return; closeModal('pause',false); G.paused=false; duckMusic(1); quitToTitle(); };

/* ---------- settings ---------- */
let settingsFrom=null;
const CYCLES={
  preset:{get:()=>PRESETS[SETTINGS.preset]?PRESETS[SETTINGS.preset].name:'Custom',next:()=>{ const i=PRESET_ORDER.indexOf(SETTINGS.preset); applyPreset(PRESET_ORDER[(i+1)%PRESET_ORDER.length]); }},
  shadow:{get:()=>['Off','Low','Medium','High','Insane'][SETTINGS.shadow],next:()=>{ SETTINGS.shadow=(SETTINGS.shadow+1)%5; custom(); }},
  ao:{get:()=>['Off','On','High'][SETTINGS.ao],next:()=>{ SETTINGS.ao=(SETTINGS.ao+1)%3; custom(); }},
  detail:{get:()=>['Minimal','Low','Medium','High','Insane'][SETTINGS.detail],next:()=>{ SETTINGS.detail=(SETTINGS.detail+1)%5; custom(); }},
  textSpeed:{get:()=>['Small','Normal','Big'][SETTINGS.textSpeed==null?1:SETTINGS.textSpeed],next:()=>{ SETTINGS.textSpeed=((SETTINGS.textSpeed==null?1:SETTINGS.textSpeed)+1)%3; saveSettings(); applySubSize(); }}
};
function applySubSize(){ const k=[.85,1,1.25][SETTINGS.textSpeed==null?1:SETTINGS.textSpeed]; $('sub').style.fontSize='clamp('+(17*k)+'px,'+(2*k)+'vw,'+(24*k)+'px)'; }
function openSettings(from){ settingsFrom=from; syncSettingsUI(); openModal('settings',{back:closeSettings,first:document.querySelector('#settings .gs3-item')}); }
function closeSettings(){ closeModal('settings'); SFX.uiBack(); if(settingsFrom==='pause'){ openModal('pause',{back:resumeGame,first:$('pResume')}); } }
$('setDone').onclick=closeSettings;
document.querySelectorAll('#setTabs .tab').forEach(b=>b.onclick=()=>{ document.querySelectorAll('#setTabs .tab').forEach(x=>x.classList.toggle('on',x===b)); document.querySelectorAll('#setBody .pane').forEach(p=>p.classList.toggle('on',p.dataset.p===b.dataset.p)); SFX.uiClick(); if(MODAL.nav){ const f=document.querySelector('#setBody .pane.on .gs3-item'); if(f) MODAL.nav.focus(f); } });
document.querySelectorAll('[data-cycle]').forEach(b=>b.onclick=()=>{ const c=CYCLES[b.dataset.cycle]; if(!c) return; c.next(); SFX.uiClick(); syncSettingsUI(); });
function applyPreset(k){ Object.assign(SETTINGS,PRESETS[k]); SETTINGS.preset=k; saveSettings(); applyGfx(); syncSettingsUI(); }
const PRESET_NOTES={toaster:'Everything off, very low resolution. For when the game is a slideshow.',potato:'For laggy computers. No shadows, no effects.',low:'Basic shadows, no effects. Older laptops.',medium:'Soft shadows, bloom and color grading.',high:'Ambient occlusion, god rays, cinematic depth of field.',ultra:'Everything on, plus motion blur and supersampling.',insane:'Maximum everything and 1.6x supersampling. Melts graphics cards.',custom:'Your own mix from the Advanced tab.'};
const custom=()=>{ SETTINGS.preset='custom'; saveSettings(); applyGfx(); };
function tog(id,on){ const t=$(id); if(t) t.setAttribute('aria-pressed',on?'true':'false'); }
function syncSettingsUI(){
  const S=SETTINGS;
  for(const k in CYCLES){ const el=document.querySelector('[data-cycle="'+k+'"] .gs3-value'); if(el) el.textContent=CYCLES[k].get(); }
  $('presetNote').textContent=PRESET_NOTES[S.preset]||'';
  tog('sFps',S.showFps); tog('sAuto',S.autoLower); $('sFov').value=S.fov; $('sFovV').textContent=S.fov+'°';
  $('aRes').value=S.res; $('aResV').textContent=Math.round(S.res*100)+'%'; tog('aPost',S.post);
  tog('aBloom',S.bloom); tog('aRays',S.rays); tog('aDof',S.dof); tog('aMblur',S.mblur); tog('aAA',S.aa); tog('aGrain',S.grain); tog('aLens',S.lens);
  for(const id of ['aBloom','aRays','aDof','aMblur','aAA','aGrain','aLens']) $(id).style.opacity=S.post?1:.4;
  $('sMaster').value=S.master; $('sMasterV').textContent=Math.round(S.master*100)+'%'; $('sMusic').value=S.music; $('sMusicV').textContent=Math.round(S.music*100)+'%'; $('sSfx').value=S.sfx; $('sSfxV').textContent=Math.round(S.sfx*100)+'%';
  $('sVoice').value=S.voice==null?1:S.voice; $('sVoiceV').textContent=Math.round((S.voice==null?1:S.voice)*100)+'%'; tog('sSubs',S.subs!==false);
  $('sSens').value=S.sens; $('sSensV').textContent=S.sens.toFixed(2); tog('sInv',S.invertY); tog('sBob',S.bob); tog('sShake',S.shake); tog('sHud',S.hud);
}
function bindSlider(id,key,after){ $(id).addEventListener('input',()=>{ SETTINGS[key]=+$(id).value; saveSettings(); if(after) after(); syncSettingsUI(); }); }
function bindToggle(id,key,after){ $(id).addEventListener('click',()=>{ SETTINGS[key]=$(id).getAttribute('aria-pressed')==='true'; saveSettings(); if(after) after(); syncSettingsUI(); }); }
bindToggle('sFps','showFps',applyGfx); bindToggle('sAuto','autoLower'); bindSlider('sFov','fov');
bindSlider('aRes','res',custom); bindToggle('aPost','post',custom);
bindToggle('aBloom','bloom',custom); bindToggle('aRays','rays',custom); bindToggle('aDof','dof',custom); bindToggle('aMblur','mblur',custom);
bindToggle('aAA','aa',custom); bindToggle('aGrain','grain',custom); bindToggle('aLens','lens',custom);
bindSlider('sMaster','master',applyVolumes); bindSlider('sMusic','music',applyVolumes); bindSlider('sSfx','sfx',()=>{ applyVolumes(); SFX.uiClick(); });
bindSlider('sVoice','voice',applyVolumes); bindToggle('sSubs','subs');
bindSlider('sSens','sens'); bindToggle('sInv','invertY'); bindToggle('sBob','bob'); bindToggle('sShake','shake'); bindToggle('sHud','hud',()=>document.body.classList.toggle('nohud',!SETTINGS.hud));
$('setReset').onclick=async()=>{ if(!await askConfirm('Reset every setting?','Reset')) return; Object.assign(SETTINGS,DEFAULT_SETTINGS); saveSettings(); applyGfx(); applyVolumes(); applySubSize(); syncSettingsUI(); document.body.classList.toggle('nohud',!SETTINGS.hud); };
document.body.classList.toggle('nohud',!SETTINGS.hud); applySubSize();
const KEYS_HELP=IS_TOUCH?[['Left side','Drag to walk'],['Right side','Drag to look'],['USE','Talk / interact / skip a line'],['PUNCH','Punch (in the fight)'],['RUN','Toggle sprint'],['❚❚','Pause & settings']]:
  [['W A S D','Move'],['Mouse','Look'],['Shift','Sprint'],['E','Talk / interact / skip a line'],['1 - 9','Pick something to say'],['Left click','Punch (in the fight)'],['Esc / P','Pause & settings']];
(function fillKeys(){ const h=KEYS_HELP.map(([k,d])=>'<kbd style="justify-self:start">'+k+'</kbd><span>'+d+'</span>').join(''); $('keysList').innerHTML=h; $('helpKeys').innerHTML=h; })();
$('btnControls').onclick=()=>openModal('helpOverlay',{first:$('helpDone')});
$('helpDone').onclick=()=>{ closeModal('helpOverlay'); SFX.uiBack(); };
document.querySelectorAll('.gs3-item,.gs3-btn,.ecard,.tab').forEach(b=>b.addEventListener('mouseenter',()=>SFX.uiHover()));

/* ---------- key routing ---------- */
let interactCd=0;
const TITLE={nav:null,onBack:null};
on('key',code=>{
  if(G.mode==='boot') return;
  if(code==='Escape'||code==='KeyP'){
    if(MODAL.open) return;   // the kit's nav handles Esc inside menus
    if(G.mode==='play'){ if(G.paused) resumeGame(); else if(!CHOICE.active) pauseGame(); }
    return;
  }
  if(G.mode!=='play'||G.paused||MODAL.open) return;
  if(CHOICE.active){ const m=/^(Digit|Numpad)([1-9])$/.exec(code); if(m) pickChoice(+m[2]-1); return; }
  if(DLG.active){ if(code==='KeyE'||code==='Space'||code==='Enter') advanceDialog(); return; }
  if(typeof FIGHT!=='undefined'&&FIGHT.active){ FIGHT.onKey(code); return; }
  if(LV && LV.onKey && LV.onKey(code)===true) return;
  if(code==='KeyE') doInteract();
  else if(code==='Space') jump();
});
on('mouse',b=>{
  if(G.mode!=='play'||G.paused||MODAL.open||CHOICE.active) return;
  if(DLG.active){ if(b===0) advanceDialog(); return; }
  if(!INPUT.locked && !INPUT.dragLook) return;
  if(b===0){ if(typeof FIGHT!=='undefined'&&FIGHT.active){ FIGHT.onPunch(); return; } if(LV&&LV.onPrimary&&LV.onPrimary()===true) return; emit('primary'); }
});
function doInteract(){ if(interactCd>0) return; const it=findInteract(); if(it){ interactCd=it.cd!=null?it.cd:.25; hidePrompt(); if(it.once){ const i=LV.inter.indexOf(it); if(i>=0) LV.inter.splice(i,1); } try{ it.act(it); }catch(e){ console.error(e); __showErr&&__showErr('Error: '+e.message); } } else if(LV&&LV.onUse) LV.onUse(); }
function updatePrompt(dt){
  document.body.classList.toggle('indlg',DLG.active||CHOICE.active); document.body.classList.toggle('cine',!!(CAM.active||$('letterbox').classList.contains('on')));
  interactCd-=dt;
  if(G.mode!=='play'||G.paused||DLG.active||CHOICE.active||MODAL.open||CAM.active||!PLAYER.ctl.interact){ hidePrompt(); $('crosshair').classList.remove('hot'); TOUCH_UI.ready(false); return; }
  const it=findInteract();
  if(it){ showPrompt(it.key||'E',typeof it.label==='function'?it.label():it.label); $('crosshair').classList.add('hot'); TOUCH_UI.ready(true); }
  else { hidePrompt(); $('crosshair').classList.remove('hot'); TOUCH_UI.ready(false); }
}

/* ---------- touch controls ---------- */
const TOUCH={moveX:0,moveZ:0,lookDX:0,lookDY:0,run:false,up:false,down:false,actHeld:false};
const TOUCH_UI={
  ready(on){ if(IS_TOUCH) $('tUse').classList.toggle('ready',on); },
  show(o){ if(!IS_TOUCH) return; $('tAct').style.display=o.act?'':'none'; },
  on(v){ if(IS_TOUCH) $('touch').classList.toggle('off',!v); }
};
if(IS_TOUCH){
  let joyId=null, jo={x:0,y:0}, lookId=null, ll={x:0,y:0};
  const isUI=t=>t&&t.closest&&t.closest('button,.gs3-screen,#sub,#choices,#title,input,select,label');
  document.addEventListener('touchstart',e=>{
    if(G.mode!=='play') return;
    for(const t of e.changedTouches){
      if(isUI(t.target)) continue;
      if(t.clientX<innerWidth*.42 && joyId===null){ joyId=t.identifier; jo={x:t.clientX,y:t.clientY}; const j=$('joy'); j.style.left=(t.clientX-60)+'px'; j.style.top=(t.clientY-60)+'px'; j.classList.add('on'); }
      else if(lookId===null){ lookId=t.identifier; ll={x:t.clientX,y:t.clientY,x0:t.clientX,y0:t.clientY}; }
    }
    if(e.cancelable && !isUI(e.target)) e.preventDefault();
  },{passive:false});
  document.addEventListener('touchmove',e=>{
    if(G.mode!=='play') return;
    for(const t of e.changedTouches){
      if(t.identifier===joyId){ let dx=t.clientX-jo.x, dy=t.clientY-jo.y; const L=Math.hypot(dx,dy),R=55; if(L>R){ dx*=R/L; dy*=R/L; } $('joy').firstElementChild.style.transform=`translate(${dx}px,${dy}px)`; TOUCH.moveX=dx/R; TOUCH.moveZ=dy/R; }
      else if(t.identifier===lookId){ TOUCH.lookDX+=(t.clientX-ll.x); TOUCH.lookDY+=(t.clientY-ll.y); ll.x=t.clientX; ll.y=t.clientY; }
    }
    if(e.cancelable && !isUI(e.target)) e.preventDefault();
  },{passive:false});
  const end=e=>{ for(const t of e.changedTouches){ if(t.identifier===joyId){ joyId=null; TOUCH.moveX=0; TOUCH.moveZ=0; $('joy').classList.remove('on'); $('joy').firstElementChild.style.transform=''; } if(t.identifier===lookId){ lookId=null; if(DLG.active && Math.hypot(t.clientX-ll.x0,t.clientY-ll.y0)<12) advanceDialog(); } } };
  document.addEventListener('touchend',end); document.addEventListener('touchcancel',end);
  document.addEventListener('gesturestart',e=>e.preventDefault(),{passive:false}); document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});
  const tb=(id,down,up)=>{ const b=$(id); b.addEventListener('touchstart',e=>{ e.preventDefault(); e.stopPropagation(); b.classList.add('down'); down&&down(); },{passive:false}); b.addEventListener('touchend',e=>{ e.preventDefault(); b.classList.remove('down'); up&&up(); },{passive:false}); };
  tb('tUse',()=>{ if(DLG.active) advanceDialog(); else if(MODAL.open||CHOICE.active) return; else doInteract(); });
  tb('tAct',()=>{ TOUCH.actHeld=true; if(DLG.active){ advanceDialog(); return; } if(typeof FIGHT!=='undefined'&&FIGHT.active){ FIGHT.onPunch(); return; } if(LV&&LV.onPrimary&&LV.onPrimary()===true) return; emit('primary'); },()=>{ TOUCH.actHeld=false; });
  tb('tRun',()=>{ TOUCH.run=!TOUCH.run; $('tRun').classList.toggle('lit',TOUCH.run); });
  tb('tPause',()=>{ if(G.paused) resumeGame(); else pauseGame(); });
  const chk=()=>{ $('rotate').style.display=(innerHeight>innerWidth && G.mode==='play')?'flex':'none'; };
  addEventListener('resize',chk); $('rotate').onclick=()=>$('rotate').style.display='none';
  TOUCH_UI.show({});
}
