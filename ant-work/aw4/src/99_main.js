/* ================================================================
   MAIN LOOP + BOOT (ANT WORK 4) — load the real assets with a progress
   bar, then the title on top of the desert.
   ================================================================ */
const TIMESCALE=+(new URLSearchParams(location.search).get('speed')||1);
const SLOWTEST=+(new URLSearchParams(location.search).get('slow')||1);   // testing only: ?slow=0.2 runs the game clock slower
let lastT=performance.now(), fpsAcc=0, fpsN=0, fpsShown=0, slowChecks=0, autoLowered=0;
const _focus=new THREE.Vector3();
function frame(){
  requestAnimationFrame(frame);
  const nowT=performance.now(); const raw=Math.min(.25,(nowT-lastT)/1000); lastT=nowT;
  if(!G.paused) SLOWMO.k=damp(SLOWMO.k,SLOWMO.target,SLOWMO.target<1?9:4,raw);
  const slow=SLOWMO.k;   // slow motion (the fight, the blast)
  const dt=(TIMESCALE>1?Math.min(raw*TIMESCALE,.2):Math.min(raw,1/20))*slow*SLOWTEST;
  G.real+=raw; G.frame++;
  try{
    if(!G.paused){ G.time+=dt; G.dt=dt; runTimers(); updateTweens(dt); }
    const t=G.time;
    if(LV){
      if(!G.paused){
        if(G.mode==='play') updatePlayer(dt,t);
        if(LV.update) LV.update(dt,t);
        updateHumans(dt,t);
        LV.soft.update(dt); LV.glow.update(dt);
        updateDialog(dt);
        if(G.mode==='play'){ updateTriggers(); emit('tick',dt); }
        updateAmbEvents(dt);
        if(typeof FIGHT!=='undefined'&&FIGHT.active) FIGHT.update(raw,dt);
      }
      updateCamera(dt,t); updateViewModel(dt,t);
      const rig=LV.scene.userData.rig; if(rig){ _focus.copy(camera.position); if(LV.shadowFocus) LV.shadowFocus(_focus); updateRig(rig,_focus); }
      if(LV.skyU) LV.skyU.time.value=G.real;
      updatePrompt(dt);
      updateListener(camera);
      renderScene(LV.scene,camera);
    }
  }catch(e){ console.error(e); if(!frame.errShown){ frame.errShown=true; window.__showErr&&__showErr('Frame error: '+e.message+'\n'+(e.stack||'').split('\n').slice(0,3).join('\n')); } }
  fpsAcc+=raw; fpsN++;
  if(fpsAcc>=.5){ const fps=fpsN/fpsAcc; fpsShown=fps; fpsAcc=0; fpsN=0; if(SETTINGS.showFps) $('fps').textContent=fps.toFixed(0)+' FPS · '+(PRESETS[SETTINGS.preset]?PRESETS[SETTINGS.preset].name:'Custom'); const sf=$('setFpsNow'); if(sf) sf.textContent=fps.toFixed(0)+' FPS';
    if(G.mode==='play' && !G.paused && SETTINGS.autoLower && document.hasFocus()){ if(fps<24) slowChecks++; else slowChecks=Math.max(0,slowChecks-1);
      if(slowChecks>=12 && autoLowered<3){ slowChecks=0; const i=PRESET_ORDER.indexOf(SETTINGS.preset); const idx=i<0?PRESET_ORDER.indexOf('medium'):i; if(idx>0){ autoLowered++; applyPreset(PRESET_ORDER[idx-1]); toast('Graphics lowered to '+PRESETS[SETTINGS.preset].name+' so it runs smooth','#9fe8ff'); } } } }
}
/* ---------- everything the game needs, loaded once ---------- */
const TEX_LIST=['brown_planks_03','cliff_side','desert_sand','dry_ground_01','dry_ground_rocks','mud_cracked_dry_03','old_wooden_floor_02','red_sandstone_wall','roof_planks','rough_wood','rusty_corrugated_iron','rusty_metal_02','rusty_metal_04','stone_tiles_02','wood_planks_dirt'];
const SFX_LIST=['bell_01','bite','blade_1','blade_2','blade_3','blast','block_1','block_2','body_fall','breath_heavy','cage_lock','chain_1','chain_2','chain_3','chew_1','chew_2','chew_3','craft','crickets','door_close_01','door_creak','door_open','drips','explode','gasp','glass_break','gun_reload','gun_revolver','gun_revolver2','gun_rifle','gun_shotgun','heartbeat','hit_01','horse_gallop','horse_trot','hum_build','hum_purple','key_open_01','metal_04','metal_1','metal_2','metal_3','oof_1','oof_2','pickup','punch_1','punch_2','punch_3','return','ringing','sand_fall','scream','sigh_1','sigh_2','skitter_1','skitter_2','slam_03','snore','spit','static','step_sand_1','step_sand_2','step_sand_3','step_sand_4','step_sand_5','step_sand_6','step_stone_1','step_stone_2','step_stone_3','step_stone_4','step_stone_5','step_stone_6','stomach','stone_1','stone_2','swing_1','swing_2','switch_01','watch_beep','wind_gust_1','wind_gust_2','wind_loop','wood_crash','wooded_box_open'];
const MUSIC_LIST=['mus_dead','mus_fight','mus_night','mus_piano','mus_saloon','mus_sting','mus_title','mus_town','mus_wastes'];
async function preload(progress){
  ASSETS.onProgress=progress;
  const jobs=[];
  for(const t of TEX_LIST) jobs.push(loadPBR(t));
  for(const s of SFX_LIST) jobs.push(SND.load(s,'assets/sfx/'+s+'.ogg'));
  for(const m of MUSIC_LIST) jobs.push(SND.load(m,'assets/music/'+m+'.ogg'));
  for(const n of MODEL_LIST) jobs.push(loadModel(n));
  for(const id in LINES) if(id[0]!=='_') jobs.push(SND.load('voice/'+id,'assets/voice/'+id+'.mp3'));
  await Promise.all(jobs);
}
/* ---------- boot ---------- */
window.AW4={G,PLAYER,SETTINGS,LEVELS,get LV(){ return LV; },HUMANS,CAM,FX,enterLevel,runStory,camShot,talk,advanceDialog,applyPreset,applyGfx,STORY,DLG,SND,ASSETS};
async function boot(){
  applyGfx();
  buildViewModel(); watchSetup();
  const bar=$('splashBar'), what=$('splashWhat');
  const q=new URLSearchParams(location.search);
  initAudioSilent();
  await preload((k,name)=>{ bar.style.width=(k*88)+'%'; what.textContent=name.replace(/_/g,' ').replace(/^voice\//,'voice: '); });
  // build every place now, so the game never stops on a loading screen later
  const order=[['dust','Dry Gulch'],['mine','the old mine']];
  for(let i=0;i<order.length;i++){ what.textContent='building '+order[i][1]; bar.style.width=(88+i*3)+'%'; await nextFrame(); await buildLevel(order[i][0]); }
  bar.style.width='100%'; what.textContent='';
  if(q.get('debug')){ await DEBUG.run(q.get('debug')); return; }
  $('splashTap').textContent=IS_TOUCH?'TAP TO START':'CLICK TO START';
  const go=()=>{ $('splash').removeEventListener('pointerdown',go); window.removeEventListener('keydown',goKey); initAudio(); $('splash').style.transition='opacity .6s'; $('splash').style.opacity=0; setTimeout(()=>$('splash').classList.add('hide'),650); TITLE.show(true); };
  const goKey=e=>{ if(e.code==='Enter'||e.code==='Space') go(); };
  $('splash').addEventListener('pointerdown',go); window.addEventListener('keydown',goKey);
}
requestAnimationFrame(frame);
boot().catch(e=>{ console.error(e); window.__fatal&&__fatal('The game could not start.',(e&&e.stack)||String(e)); });
