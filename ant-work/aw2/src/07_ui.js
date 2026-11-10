/* ================================================================
   UI — dialogue, captions, HUD, objectives, fades, cards, menus,
   settings (works from the title screen AND the pause menu), touch
   ================================================================ */
/* ---------- dialogue ---------- */
const DLG={active:false,lines:[],i:0,resolve:null,typing:false,full:'',shown:0,readyAt:0,cur:null,speaking:false};
const WHO_CLASS={You:'you',Alien:'alien',Seller:'alien',Converter:'alien',Robot:'robot',Radio:'radio',Larry:'larry',Steve:'steve'};
function talk(lines){
  if(!lines||!lines.length) return Promise.resolve();
  const tok=STORY.token;
  return new Promise(res=>{
    DLG.active=true; DLG.lines=funnyLines(lines.map(l=>typeof l==='string'?{text:l}:l)); DLG.i=0; for(const l of DLG.lines) if(l&&l.text) prefetchVoice(l.text); DLG.resolve=()=>{ if(tok===STORY.token) res(); };
    hideSay(); $('dialog').classList.add('show'); showLine();
  });
}
function lineSpeaker(L){ return L.name||L.who||''; }
function showLine(){
  const L=DLG.lines[DLG.i]; DLG.cur=L;
  if(L.fx) try{ L.fx(); }catch(e){ console.error(e); }
  const who=lineSpeaker(L);
  const w=$('dlgWho'); w.textContent=L.radio?who+' (radio)':who; w.className='who '+(L.radio?'radio':(WHO_CLASS[L.voice||L.who]||'')); w.style.display=who?'':'none';
  DLG.full=bleepHTML(L.text); DLG.shown=0; DLG.typing=true; $('dlgTxt').innerHTML='';
  $('dialog').classList.remove('ready');
  DLG.readyAt=performance.now()+250;
  // speaker animation
  for(const h of HUMANS) if(h.userData.A) h.userData.A.talk=false;
  for(const r of ROBOTS) r.userData.A.talk=false;
  if(L.h){ const A=L.h.userData.A; A.talk=true; if(L.mood) (L.h.userData.robot?(A.happy=L.mood==='happy'):setMood(L.h,L.mood)); if(L.pose!==undefined){ if(L.h.userData.robot) A.pose=L.pose; else if(L.pose) setPose(L.h,L.pose); else clearPose(L.h); } }
  if(L.radio){ $('radio').classList.add('show'); SFX.radioOn(); }
  DLG.speaking=true;
  const voiceName=L.voice||L.who;
  if(L.silent){ DLG.tts=true; DLG.speaking=false; DLG.babblePitch=0; return; }
  const used=speakLine(voiceName,L.text,()=>{ DLG.speaking=false; if(DLG.cur===L && L.h && !DLG.typing) L.h.userData.A.talk=false; if(DLG.cur===L && L.auto!=null) later(L.auto,()=>{ if(DLG.cur===L && DLG.active) advanceDialog(true); }); });
  DLG.tts=used;
  DLG.babbleT=0; DLG.babblePitch=(VOICE_PROFILES[voiceName]||{babble:170}).babble;
}
function updateDialog(dt){
  if(!DLG.active) return;
  const L=DLG.cur;
  if(DLG.typing){
    const cps=[28,48,85,9999][clamp(SETTINGS.textSpeed,0,3)];
    DLG.shown+=cps*dt;
    const plain=DLG.full.replace(/<[^>]+>/g,'');
    if(DLG.shown>=plain.length){ DLG.typing=false; $('dlgTxt').innerHTML=DLG.full; }
    else $('dlgTxt').innerHTML=typeSlice(DLG.full,Math.floor(DLG.shown));
    if(!DLG.tts && AU.ok){ DLG.babbleT-=dt; if(DLG.babbleT<=0 && DLG.typing){ DLG.babbleT=.1; let dest=voiceBus; if(L.h){ const p=L.h.getWorldPosition(new THREE.Vector3()); const pn=makePanner(1.5,voiceBus); setPannerPos(pn,p.x,p.y+1.6*L.h.scale.y,p.z); dest=pn; setTimeout(()=>{ try{pn.disconnect();}catch(e){} },500); } (funnyOn()?babbleFunny:babble)(DLG.babblePitch*(L.radio?1.05:1),dest); if(L.radio) noise(.08,.02,0,2600,'bandpass',sfxBus,1); } }
  }
  if(L.h) L.h.userData.A.talk=DLG.typing||DLG.speaking;
  if(!DLG.typing && performance.now()>DLG.readyAt) $('dialog').classList.add('ready');
  if(!DLG.typing && L.auto!=null && !DLG.speaking && !DLG.autoArmed){ DLG.autoArmed=true; later(L.auto,()=>{ DLG.autoArmed=false; if(DLG.cur===L && DLG.active) advanceDialog(true); }); }
}
function typeSlice(html,n){ let out='',c=0,i=0; while(i<html.length&&c<n){ if(html[i]==='<'){ const j=html.indexOf('>',i); out+=html.slice(i,j+1); i=j+1; continue; } out+=html[i]; i++; c++; } const open=(out.match(/<(b|i|span)[^>]*>/g)||[]).length-(out.match(/<\/(b|i|span)>/g)||[]).length; for(let k=0;k<open;k++) out+='</span>'; return out; }
function advanceDialog(auto){
  if(!DLG.active) return;
  if(DLG.typing){ if(auto) return; DLG.typing=false; DLG.shown=1e9; $('dlgTxt').innerHTML=DLG.full; DLG.readyAt=performance.now()+120; return; }
  if(!auto && performance.now()<DLG.readyAt) return;
  const L=DLG.cur; if(L && L.h){ L.h.userData.A.talk=false; }
  if(L && L.radio){ $('radio').classList.remove('show'); SFX.radioOff(); }
  stopSpeech(); DLG.speaking=false; DLG.autoArmed=false;
  if(!auto) SFX.uiClick();
  DLG.i++;
  if(DLG.i>=DLG.lines.length){ DLG.active=false; DLG.cur=null; interactCd=.6; $('dialog').classList.remove('show'); const r=DLG.resolve; DLG.resolve=null; if(r) r(); return; }
  showLine();
}
function closeDialogNow(){ DLG.active=false; DLG.cur=null; $('dialog').classList.remove('show'); stopSpeech(); $('radio').classList.remove('show'); }
$('dialog').addEventListener('click',()=>advanceDialog());
/* short non-blocking line (radio chatter, barks, nags) */
let barkTimer=null;
function bark(who,text,h,sec=3,radio=false){
  text=funnyText(text);
  const c=$('caption'); c.innerHTML=(who?'<b>'+who+(radio?' (radio)':'')+':</b> ':'')+bleepHTML(text); c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
  clearTimeout(barkTimer); barkTimer=setTimeout(()=>{ c.classList.remove('show'); if(radio) $('radio').classList.remove('show'); },sec*1000);
  if(radio){ $('radio').classList.add('show'); SFX.radioOn(); }
  if(h){ h.userData.A.talk=true; setTimeout(()=>{ if(!DLG.cur||DLG.cur.h!==h) h.userData.A.talk=false; },Math.min(sec,3.5)*1000); }
  if(!speakLine(who,text,null) && AU.ok){ const p=(VOICE_PROFILES[who]||{babble:170}).babble; let n=Math.min(22,Math.round(text.length/4)); const iv=setInterval(()=>{ (funnyOn()?babbleFunny:babble)(p); if(--n<=0) clearInterval(iv); },100); }
}
/* narration caption */
function say(html,sec=3){ const c=$('caption'); c.innerHTML=html; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); clearTimeout(barkTimer); if(sec>0) barkTimer=setTimeout(()=>c.classList.remove('show'),sec*1000); }
function hideSay(){ clearTimeout(barkTimer); $('caption').classList.remove('show'); }
async function sayWait(html,sec=3){ say(html,sec); await wait(sec); }

/* ---------- HUD ---------- */
const HUD={cash:0,coins:0};
function showCash(on){ $('cashPill').classList.toggle('show',on); }
function showCoins(on){ $('coinPill').classList.toggle('show',on); }
function setCash(v,bump=true){ HUD.cash=v; $('cashV').textContent=Math.round(v); if(bump){ const p=$('cashPill'); p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); } }
function setCoins(v,bump=true){ HUD.coins=v; $('coinV').textContent=Math.round(v); if(bump){ const p=$('coinPill'); p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); } }
function setBugFood(v,show=true){ $('bugRow').classList.toggle('show',show); $('bugV').textContent=v; }
function setHP(v,show=true){ $('hpRow').classList.toggle('show',show); $('hpFill').style.width=clamp(v,0,100)+'%'; }
function showClock(on,txt){ $('clock').classList.toggle('show',on); if(txt) $('clockV').textContent=txt; }
let objCur='';
function objective(text,quiet=false){ const o=$('objective'); if(!text){ o.classList.remove('show'); objCur=''; $('objText').innerHTML=''; return; } if(text===objCur) return; objCur=text; $('objText').innerHTML=text; o.classList.remove('show'); void o.offsetWidth; o.classList.add('show'); if(!quiet) SFX.objective(); }
function toast(text,color='#ffcc33'){ const el=document.createElement('div'); el.className='toast'; el.textContent=text; el.style.color=color; $('toasts').appendChild(el); setTimeout(()=>el.remove(),1700); }
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
function coinBurst(n=12){ const b=$('coinBurst'); for(let i=0;i<n;i++){ const c=document.createElement('span'); c.className='acoin'; c.style.setProperty('--dx',(rand(-260,260))+'px'); c.style.setProperty('--dy',(rand(-240,60))+'px'); c.style.animationDelay=(i*.05)+'s'; b.appendChild(c); setTimeout(()=>c.remove(),1600); } }

/* ---------- modals ---------- */
const MODAL={open:null,prev:null};
function openModal(id){
  MODAL.open=id; $(id).classList.add('show'); unlockPointer();
  MODAL.prevCtl=Object.assign({},PLAYER.ctl); PLAYER.lock(); hidePrompt(); SFX.uiOpen();
}
function closeModal(id,restore=true){
  $(id).classList.remove('show'); if(MODAL.open===id) MODAL.open=null;
  if(restore && MODAL.prevCtl) Object.assign(PLAYER.ctl,MODAL.prevCtl);
  if(G.mode==='play') lockPointer();
}

/* ---------- pause ---------- */
function pauseGame(){
  if(G.mode!=='play'||G.paused||MODAL.open) return;
  G.paused=true; unlockPointer(); $('pause').classList.add('show'); duckMusic(.35);
  if(HAS_TTS){ try{ speechSynthesis.pause(); }catch(e){} }
  if(AU.ok) ambBus.gain.setTargetAtTime(SETTINGS.sfx*.25,ACtx.currentTime,.2);
}
function resumeGame(){
  $('pause').classList.remove('show'); G.paused=false; duckMusic(1); applyVolumes();
  if(HAS_TTS){ try{ speechSynthesis.resume(); }catch(e){} }
  lockPointer(); SFX.uiClick();
}
on('unlocked',()=>{ if(G.mode==='play' && !G.paused && !MODAL.open && !$('settings').classList.contains('show')) pauseGame(); });
$('pResume').onclick=resumeGame;
$('pSettings').onclick=()=>openSettings('pause');
$('pCheckpoint').onclick=()=>{ $('pause').classList.remove('show'); G.paused=false; duckMusic(1); restartCheckpoint(); };
$('pTitle').onclick=()=>{ $('pause').classList.remove('show'); G.paused=false; duckMusic(1); quitToTitle(); };

/* ---------- settings ---------- */
let settingsFrom=null;
function openSettings(from){ settingsFrom=from; syncSettingsUI(); $('settings').classList.add('show'); SFX.uiOpen(); unlockPointer(); }
function closeSettings(){ $('settings').classList.remove('show'); SFX.uiBack(); if(settingsFrom==='title') $('btnSettings').focus(); }
$('setDone').onclick=closeSettings;
document.querySelectorAll('#setTabs .tab').forEach(b=>b.onclick=()=>{ document.querySelectorAll('#setTabs .tab').forEach(x=>x.classList.toggle('on',x===b)); document.querySelectorAll('#setBody .pane').forEach(p=>p.classList.toggle('on',p.dataset.p===b.dataset.p)); SFX.uiClick(); });
(function buildPresetGrid(){ const g=$('presetGrid'); for(const k of PRESET_ORDER){ const p=PRESETS[k]; const b=document.createElement('button'); b.className='preset'+(k==='insane'?' insane':''); b.dataset.k=k; b.innerHTML=p.name+'<small>'+p.sub+'</small>'; b.onclick=()=>{ applyPreset(k); SFX.uiClick(); }; g.appendChild(b); } })();
function applyPreset(k){ Object.assign(SETTINGS,PRESETS[k]); SETTINGS.preset=k; saveSettings(); applyGfx(); syncSettingsUI(); }
const PRESET_NOTES={toaster:'Everything off, super low resolution. Use this if the game is basically a slideshow.',potato:'For really laggy computers. No shadows, no effects.',low:'Basic shadows, no effects. Good for older laptops and Chromebooks.',medium:'Soft shadows, bloom and color grading.',high:'Ambient occlusion, god rays, cinematic depth of field.',ultra:'Everything on, plus motion blur and supersampling.',insane:'Maximum everything and 1.6x supersampling. The graphics are insane. So is what it does to your computer.',custom:'Custom mix from the Advanced tab.'};
function syncSettingsUI(){
  const S=SETTINGS;
  document.querySelectorAll('.preset').forEach(b=>b.classList.toggle('on',b.dataset.k===S.preset));
  $('presetNote').textContent=PRESET_NOTES[S.preset]||'';
  $('sFps').checked=S.showFps; $('sAuto').checked=S.autoLower; $('sFov').value=S.fov; $('sFovV').textContent=S.fov+'°'; $('sBright').value=S.bright||1; $('sBrightV').textContent=Math.round((S.bright||1)*100)+'%';
  $('aRes').value=S.res; $('aResV').textContent=Math.round(S.res*100)+'%'; $('aShadow').value=S.shadow; $('aPost').checked=S.post; $('aAO').value=S.ao;
  $('aBloom').checked=S.bloom; $('aRays').checked=S.rays; $('aDof').checked=S.dof; $('aMblur').checked=S.mblur; $('aAA').checked=S.aa; $('aGrain').checked=S.grain; $('aLens').checked=S.lens; $('aDetail').value=S.detail;
  for(const id of ['aAO','aBloom','aRays','aDof','aMblur','aAA','aGrain','aLens']) $(id).disabled=!S.post;
  $('sMaster').value=S.master; $('sMasterV').textContent=Math.round(S.master*100)+'%'; $('sMusic').value=S.music; $('sMusicV').textContent=Math.round(S.music*100)+'%'; $('sSfx').value=S.sfx; $('sSfxV').textContent=Math.round(S.sfx*100)+'%';
  $('sVoice').checked=S.voice; $('sVoice').disabled=!HAS_TTS; $('sText').value=S.textSpeed;
  $('sFunny').checked=!!S.funny; $('sFunnyLvl').value=S.funnyLevel||3; $('sFunnyLvlV').textContent=['','A little','Pretty weird','Total chaos'][S.funnyLevel||3];
  $('sSens').value=S.sens; $('sSensV').textContent=S.sens.toFixed(2); $('sInv').checked=S.invertY; $('sBob').checked=S.bob; $('sShake').checked=S.shake; $('sHud').checked=S.hud;
}
function bindS(id,key,ev,parse,after){ $(id).addEventListener(ev,()=>{ SETTINGS[key]=parse($(id)); saveSettings(); if(after) after(); syncSettingsUI(); }); }
const num=e=>+e.value, chk=e=>e.checked;
const custom=()=>{ SETTINGS.preset='custom'; saveSettings(); applyGfx(); };
bindS('sFps','showFps','change',chk,applyGfx); bindS('sAuto','autoLower','change',chk); bindS('sFov','fov','input',num); bindS('sBright','bright','input',num,()=>{ applyGfx(); });
bindS('aRes','res','input',num,custom); bindS('aShadow','shadow','change',num,custom); bindS('aPost','post','change',chk,custom); bindS('aAO','ao','change',num,custom);
bindS('aBloom','bloom','change',chk,custom); bindS('aRays','rays','change',chk,custom); bindS('aDof','dof','change',chk,custom); bindS('aMblur','mblur','change',chk,custom);
bindS('aAA','aa','change',chk,custom); bindS('aGrain','grain','change',chk,custom); bindS('aLens','lens','change',chk,custom); bindS('aDetail','detail','change',num,custom);
bindS('sMaster','master','input',num,applyVolumes); bindS('sMusic','music','input',num,applyVolumes); bindS('sSfx','sfx','input',num,()=>{ applyVolumes(); SFX.uiClick(); });
bindS('sVoice','voice','change',chk,()=>{ if(!SETTINGS.voice) stopSpeech(); });
$('sJayTest').onclick=()=>{ loadVoices(); const v=voiceFor(VOICE_PROFILES.You); $('jayVoiceName').textContent=v?v.name:'No computer voice found on this device'; if(v&&HAS_TTS){ const u=new SpeechSynthesisUtterance('Are you... me?'); u.voice=v; u.rate=VOICE_PROFILES.You.rate; u.pitch=VOICE_PROFILES.You.pitch; u.volume=Math.min(1,.35+SETTINGS.sfx*.65*SETTINGS.master); speechSynthesis.cancel(); speechSynthesis.speak(u); } }; bindS('sText','textSpeed','change',num);
bindS('sFunny','funny','change',chk,()=>{ if(SETTINGS.funny){ unlock('funny'); SFX.boing(); toast('Funny mode ON 🎉','#ff9af0'); } else { clearFunny(); stopSpeech(); } }); bindS('sFunnyLvl','funnyLevel','input',num);
bindS('sSens','sens','input',num); bindS('sInv','invertY','change',chk); bindS('sBob','bob','change',chk); bindS('sShake','shake','change',chk); bindS('sHud','hud','change',chk,()=>document.body.classList.toggle('nohud',!SETTINGS.hud));
/* in-game yes/no box (window.confirm is blocked inside sandboxed iframes) */
function askConfirm(text,yes='Yes',no='Cancel'){ return new Promise(res=>{ const o=$('askOverlay'); $('askText').textContent=text; $('askYes').textContent=yes; $('askNo').textContent=no; o.classList.add('show'); SFX.uiOpen();
  const done=v=>{ o.classList.remove('show'); $('askYes').onclick=$('askNo').onclick=null; removeEventListener('keydown',kd,true); v?SFX.uiClick():SFX.uiBack(); res(v); };
  const kd=e=>{ if(e.code==='Escape'){ e.stopPropagation(); e.preventDefault(); done(false); } else if(e.code==='Enter'){ e.stopPropagation(); e.preventDefault(); done(true); } };
  addEventListener('keydown',kd,true); $('askYes').onclick=()=>done(true); $('askNo').onclick=()=>done(false); setTimeout(()=>$('askYes').focus(),30); }); }
$('setReset').onclick=async()=>{ if(!await askConfirm('Reset all settings to default?','Reset')) return; Object.assign(SETTINGS,DEFAULT_SETTINGS); saveSettings(); applyGfx(); applyVolumes(); syncSettingsUI(); document.body.classList.toggle('nohud',!SETTINGS.hud); };
document.body.classList.toggle('nohud',!SETTINGS.hud);
const KEYS_HELP=IS_TOUCH?[['Left side','Drag to walk'],['Right side','Drag to look'],['USE','Talk / interact / next line'],['👊','Punch / take photo'],['⤒ ⤓','Jump · fly up / down'],['RUN','Toggle sprint'],['⌚','Shrink / grow'],['❚❚','Pause & settings']]:
  [['W A S D','Move'],['Mouse','Look'],['Shift','Sprint'],['Space','Jump · fly up'],['C / Ctrl','Fly down'],['E','Talk / interact / next line'],['Left click','Punch · take photo'],['Q / Right click','Use camera'],['F','Shrink / grow (with the watch)'],['Esc / P','Pause & settings']];
(function fillKeys(){ const h=KEYS_HELP.map(([k,d])=>'<kbd style="justify-self:start">'+k+'</kbd><span>'+d+'</span>').join(''); $('keysList').innerHTML=h; $('helpKeys').innerHTML=h; })();
$('btnControls').onclick=()=>{ $('helpOverlay').classList.add('show'); SFX.uiOpen(); };
$('helpDone').onclick=()=>{ $('helpOverlay').classList.remove('show'); SFX.uiBack(); };
document.querySelectorAll('.mbtn,.gbtn,.lbtn,.scard,.preset,.tab').forEach(b=>b.addEventListener('mouseenter',()=>SFX.uiHover()));

/* ---------- key routing ---------- */
let interactCd=0;
on('key',code=>{
  if(G.mode==='boot') return;
  if(code==='Escape'||code==='KeyP'){
    if($('settings').classList.contains('show')){ closeSettings(); return; }
    if($('helpOverlay').classList.contains('show')){ $('helpOverlay').classList.remove('show'); return; }
    if($('trophies').classList.contains('show')){ closeTrophies(); return; }
    if(MODAL.open){ if(MODAL.onEsc) MODAL.onEsc(); return; }
    if(G.mode==='play'){ if(G.paused) resumeGame(); else pauseGame(); }
    else if(G.mode==='menu' && TITLE.onBack) TITLE.onBack();
    return;
  }
  if(G.mode!=='play'||G.paused) return;
  if(MODAL.open){ if(MODAL.onKey) MODAL.onKey(code); return; }
  if(DLG.active){ if(code==='KeyE'||code==='Space'||code==='Enter') advanceDialog(); return; }
  if(LV_KEY_HOOK && LV_KEY_HOOK(code)===true) return;
  if(LV && LV.onKey && LV.onKey(code)===true) return;
  if(code==='KeyE') doInteract();
  else if(code==='Space') jump();
  else if(code==='KeyF') emit('shrink');
  else if(code==='KeyQ') emit('item');
});
on('mouse',b=>{
  if(G.mode!=='play'||G.paused||MODAL.open) return;
  if(DLG.active){ if(b===0) advanceDialog(); return; }
  if(!INPUT.locked && !INPUT.dragLook) return;
  if(b===0){ if(LV&&LV.onPrimary&&LV.onPrimary()===true) return; emit('primary'); }
  if(b===2) emit('item');
});
function doInteract(){ if(interactCd>0) return; const it=findInteract(); if(it){ interactCd=it.cd!=null?it.cd:.25; hidePrompt(); try{ it.act(it); }catch(e){ console.error(e); __showErr&&__showErr('Error: '+e.message); } } else if(LV&&LV.onUse) LV.onUse(); }
function updatePrompt(dt){
  document.body.classList.toggle('indlg',DLG.active); document.body.classList.toggle('cine',!!(CAM.active||$('letterbox').classList.contains('on')));
  interactCd-=dt;
  if(G.mode!=='play'||G.paused||DLG.active||MODAL.open||CAM.active||!PLAYER.ctl.interact){ hidePrompt(); $('crosshair').classList.remove('hot'); TOUCH_UI.ready(false); return; }
  const it=findInteract();
  if(it){ showPrompt(it.key||'E',typeof it.label==='function'?it.label():it.label); $('crosshair').classList.add('hot'); TOUCH_UI.ready(true); }
  else { hidePrompt(); $('crosshair').classList.remove('hot'); TOUCH_UI.ready(false); }
}

/* ---------- touch controls ---------- */
const TOUCH={moveX:0,moveZ:0,lookDX:0,lookDY:0,run:false,up:false,down:false};
const TOUCH_UI={
  ready(on){ if(IS_TOUCH) $('tUse').classList.toggle('ready',on); },
  show(o){ if(!IS_TOUCH) return; $('tAct').style.display=o.act?'':'none'; $('tShrink').style.display=o.shrink?'':'none'; $('tDown').style.display=o.down?'':'none'; $('tJump').style.display=o.jump===false?'none':''; },
  on(v){ if(IS_TOUCH) $('touch').classList.toggle('off',!v); }
};
if(IS_TOUCH){
  let joyId=null, jo={x:0,y:0}, lookId=null, ll={x:0,y:0};
  const isUI=t=>t&&t.closest&&t.closest('button,.modal,#dialog,#title,#story,#tbc,input,select,label');
  document.addEventListener('touchstart',e=>{
    if(G.mode!=='play') return;
    for(const t of e.changedTouches){
      if(isUI(t.target)) continue;
      if(t.clientX<innerWidth*.42 && joyId===null){ joyId=t.identifier; jo={x:t.clientX,y:t.clientY}; const j=$('joy'); j.style.left=(t.clientX-60)+'px'; j.style.top=(t.clientY-60)+'px'; j.classList.add('on'); }
      else if(lookId===null){ lookId=t.identifier; ll={x:t.clientX,y:t.clientY,t0:performance.now(),x0:t.clientX,y0:t.clientY}; }
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
  // stop iOS pinch / double-tap zoom from zooming the whole page (the view ends up 'too close')
  document.addEventListener('gesturestart',e=>e.preventDefault(),{passive:false}); document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});
  let lastTap=0; document.addEventListener('touchend',e=>{ const n=Date.now(); if(n-lastTap<320 && !(e.target.closest&&e.target.closest('input,select,textarea'))) e.preventDefault(); lastTap=n; },{passive:false});
  const tb=(id,down,up)=>{ const b=$(id); b.addEventListener('touchstart',e=>{ e.preventDefault(); e.stopPropagation(); b.classList.add('down'); down&&down(); },{passive:false}); b.addEventListener('touchend',e=>{ e.preventDefault(); b.classList.remove('down'); up&&up(); },{passive:false}); };
  tb('tUse',()=>{ if(DLG.active) advanceDialog(); else if(MODAL.open) return; else doInteract(); });
  tb('tAct',()=>{ TOUCH.actHeld=true; if(DLG.active){ advanceDialog(); return; } if(LV&&LV.onPrimary&&LV.onPrimary()===true) return; emit('primary'); },()=>{ TOUCH.actHeld=false; });
  tb('tJump',()=>{ TOUCH.up=true; jump(); },()=>{ TOUCH.up=false; });
  tb('tDown',()=>{ TOUCH.down=true; },()=>{ TOUCH.down=false; });
  tb('tRun',()=>{ TOUCH.run=!TOUCH.run; $('tRun').classList.toggle('lit',TOUCH.run); });
  tb('tShrink',()=>emit('shrink'));
  tb('tPause',()=>{ if(G.paused) resumeGame(); else pauseGame(); });
  const chk=()=>{ $('rotate').style.display=(innerHeight>innerWidth && G.mode==='play')?'flex':'none'; };
  addEventListener('resize',chk); $('rotate').onclick=()=>$('rotate').style.display='none';
  TOUCH_UI.show({});
}

