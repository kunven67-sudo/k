/* ================================================================
   MAIN LOOP + BOOT
   ================================================================ */
const TIMESCALE=+(new URLSearchParams(location.search).get('speed')||1);
let lastT=performance.now(), fpsAcc=0, fpsN=0, fpsShown=0, slowChecks=0, autoLowered=0;
const _focus=new THREE.Vector3();
function frame(){
  requestAnimationFrame(frame);
  const nowT=performance.now(); const raw=Math.min(.25,(nowT-lastT)/1000); lastT=nowT; const dt=TIMESCALE>1?Math.min(raw*TIMESCALE,.2):Math.min(raw,1/20);
  G.real+=raw; G.frame++;
  try{
    if(!G.paused){ G.time+=dt; G.dt=dt; runTimers(); }
    const t=G.time;
    if(RENDER.override){
      const F=LEVELS.flash; FLASH.t+=dt; const k=clamp(FLASH.t/FLASH.dur,0,1); const c=FLASH.shot.cam(k);
      camera.position.copy(c.pos); camera.up.set(0,1,0); camera.lookAt(c.look); camera.updateMatrixWorld();
      if(!G.paused){ F.update(dt,t); updateNPCPath(F.steve,dt); animateHuman(F.steve,dt,t); F.soft.update(dt); F.glow.update(dt); updateDialog(dt); }
      if(F.gun.visible){ F.gun.position.set(.14,-.17,-.42).applyMatrix4(camera.matrixWorld); F.gun.quaternion.copy(camera.quaternion); if(!F.gun.parent||F.gun.parent!==F.scene) F.scene.add(F.gun); }
      const rig=F.scene.userData.rig; if(rig) updateRig(rig,camera.position);
      renderScene(F.scene,camera);
    } else if(LV){
      if(!G.paused){
        if(G.mode==='play') updatePlayer(dt,t);
        if(LV.update) LV.update(dt,t);
        updateHumans(dt,t); updateRobots(dt,t);
        LV.soft.update(dt); LV.glow.update(dt);
        updateDialog(dt);
        if(G.mode==='play'){ updateTriggers(); emit('tick',dt); }
        funnyFrame(dt);
        photoCd-=dt;
        updateAmbEvents(dt);
      }
      updateCamera(dt,t); updateViewModel(dt,t);
      const rig=LV.scene.userData.rig; if(rig){ _focus.copy(camera.position); if(LV.shadowFocus) LV.shadowFocus(_focus); updateRig(rig,_focus); }
      LV.scene.traverseVisible && LV.skyU && (LV.skyU.time.value=G.real);
      updatePrompt(dt);
      updateListener(camera);
      renderScene(LV.scene,camera);
    }
  }catch(e){ console.error(e); if(!frame.errShown){ frame.errShown=true; window.__showErr&&__showErr('Frame error: '+e.message+'\n'+(e.stack||'').split('\n').slice(0,3).join('\n')); } }
  // fps + auto-lower
  fpsAcc+=raw; fpsN++;
  if(fpsAcc>=.5){ const fps=fpsN/fpsAcc; fpsShown=fps; fpsAcc=0; fpsN=0; if(SETTINGS.showFps) $('fps').textContent=fps.toFixed(0)+' FPS · '+(PRESETS[SETTINGS.preset]?PRESETS[SETTINGS.preset].name:'Custom'); const sf=$('setFpsNow'); if(sf) sf.textContent=fps.toFixed(0)+' FPS';
    if(G.mode==='play' && !G.paused && SETTINGS.autoLower && document.hasFocus()){ if(fps<24) slowChecks++; else slowChecks=Math.max(0,slowChecks-1);
      if(slowChecks>=12 && autoLowered<3){ slowChecks=0; const i=PRESET_ORDER.indexOf(SETTINGS.preset); const idx=i<0?PRESET_ORDER.indexOf('medium'):i; if(idx>0){ autoLowered++; applyPreset(PRESET_ORDER[idx-1]); toast('Graphics lowered to '+PRESETS[SETTINGS.preset].name+' for smoother play','#9fe8ff'); } } } }
}
/* ---------- boot ---------- */
window.AW2={G,PLAYER,SETTINGS,LEVELS,get LV(){ return LV; },HUMANS,ROBOTS,CAM,FX,enterLevel,runStory,camShot,talk,advanceDialog,applyPreset,applyGfx,STORY,DLG};
async function boot(){
  applyGfx();
  buildViewModel();
  const bar=$('splashBar');
  bar.style.width='20%';
  await nextFrame();
  const q=new URLSearchParams(location.search);
  if(q.get('debug')){ await DEBUG.run(q.get('debug')); return; }
  bar.style.width='45%';
  if(typeof INTRO!=='undefined') await INTRO.prepare(p=>bar.style.width=(45+p*50)+'%');
  bar.style.width='100%';
  $('splashTap').textContent=IS_TOUCH?'TAP TO START':'CLICK TO START';
  const go=()=>{ $('splash').removeEventListener('pointerdown',go); window.removeEventListener('keydown',goKey); initAudio(); loadSfxFiles(); loadMusicFiles(); $('splash').style.transition='opacity .6s'; $('splash').style.opacity=0; setTimeout(()=>$('splash').classList.add('hide'),650); INTRO.start(); };
  const goKey=e=>{ if(e.code==='Enter'||e.code==='Space') go(); };
  $('splash').addEventListener('pointerdown',go); window.addEventListener('keydown',goKey);
}
requestAnimationFrame(frame);
boot().catch(e=>{ console.error(e); window.__showErr&&__showErr('Boot error: '+e.message+'\n'+(e.stack||'')); });

