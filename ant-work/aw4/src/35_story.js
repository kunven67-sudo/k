/* ================================================================
   ANT WORK 4 — the story. Every loop starts in the sky over Dry Gulch.
   ================================================================ */
CHECKPOINTS.length=0; CHECKPOINTS.push({id:'landing',name:'Dry Gulch',level:'dust'},{id:'mineDebug',name:'The old mine',level:'dust'},{id:'finalDebug',name:'The ship',level:'dust'});
Object.assign(WHO_CLASS,{OldJay:'you'});
/* ---------- a fresh loop: the world goes back to 8:00 AM ---------- */
let AW4_SETUP=false;
function worldReset(){ const lv=LEVELS.dust; for(const k in F) delete F[k]; F.dead={};
  invReset(); DAY.hour=8; DAY.day=1; DAY.running=false; DAY.sundownDone=0; DAY.dawnDone=0; NIGHT4.on=false; NIGHT4.hidden=null; clearRiders(); if(RIDE.on) dismount();
  lv.inCellar=false; lv.cellarL.intensity=0; lv.bship.position.y=lv.bshipY; lv.sandMound.visible=true; lv.sandMound.scale.y=3.4;
  const m=LEVELS.mine; if(m.built){ m.rocks.visible=true; m.core.visible=true; }
  MTHING.dark=0; MTHING.chase=0; MTHING.warned=0;
  if(!AW4_SETUP){ AW4_SETUP=true; for(const id in NPC_DEF) makeNPC(id); makeExtras(); setupHorses(); makeTrain(); setupDoors(); setupShip(); }
  for(const h of TRAIN.guards){ h.userData.dead=false; h.userData.hp=100; clearPose(h,0); h.visible=true; if(!NIGHT4.riders.includes(h)) NIGHT4.riders.push(h); h.userData.rider.state='hunt'; }
  TRAIN.z=320; TRAIN.g.position.z=320; TRAIN.dir=-1; TRAIN.speed=0; TRAIN.stopT=0; TRAIN.stopped=0; TRAIN.safe.rotation.y=0;
  placeNPCs(); for(const h of lv.horses){ h.userData.taken=0; } }
/* two drifters playing cards in the saloon */
function makeExtras(){ const lv=LEVELS.dust; lv.drifters=[]; for(let i=0;i<2;i++){ const h=makeHuman({name:'Drifter',voice:'Rider',skin:[0xc89070,0xe0b090][i],shirt:[0x6a4a3a,0x3a4a5a][i],pants:0x2a2420,hair:0x3a2a1a,beard:!!i,seed:70+i}); cowboy(h,{hatCol:[0x5a4a3a,0x2a2a2a][i],gun:true}); h.userData.level='dust'; h.userData.hp=100; h.userData.who='the drifter'; h.userData.loot={bullets:4,gold:2}; lv.scene.add(h); lv.drifters.push(h); } }
function placeDrifters(){ const lv=LEVELS.dust, t=lv.tables[1].position; lv.drifters.forEach((h,i)=>{ resetActor(h); h.userData.hp=100; h.userData.dead=false; h.position.set(t.x+(i?1:-1)*1.2,.15,t.z+(i?.3:-.3)); faceTo(h,t); setPose(h,'cards',0); h.visible=true; }); }
/* Jay 2 (he does NOT look like you anymore: hat, vest, his green shirt) */
function jay2(){ const lv=LEVELS.dust; if(!lv.jay2){ const J=makeJay2({shirt:0x2e8b57}); cowboy(J,{hatCol:0x6a4a2a,vest:0x4a3424}); J.userData.level='dust'; J.userData.hp=160; lv.scene.add(J); lv.jay2=J; } CUR.j2=lv.jay2; return lv.jay2; }
on('tick',dt=>{ const J=CUR.j2; if(!J||!J.visible||J.userData.dead||J.userData.riding||J.userData.hold||G.mode!=='play'||!LV||J.userData.level!==LV.name) return;
  const d=Math.hypot(J.position.x-PLAYER.pos.x,J.position.z-PLAYER.pos.z); if(d>12&&!LV.inCellar){ const b=PLAYER.pos.clone().add(V3(Math.sin(PLAYER.yaw)*2,0,Math.cos(PLAYER.yaw)*2)); J.position.set(b.x,LV.ground(b.x,b.z),b.z); }
  else if(d>3.2&&(!J.userData.A.path||J.userData.fT<=0)){ J.userData.fT=.6; const b=PLAYER.pos.clone().add(V3(Math.sin(PLAYER.yaw+.7)*1.8,0,Math.cos(PLAYER.yaw+.7)*1.8)); walkTo(J,[b],d>7?3.8:1.7); }
  J.userData.fT=(J.userData.fT||0)-dt; if(d<2.6&&J.userData.A.path) J.userData.A.path=null; if(!J.userData.A.path) J.userData.A.look=d<6?'player':null; });
/* ---------- the landing: through the saloon roof ---------- */
SCENES.landing=async function(){ const lv=LEVELS.dust, fd=$('fade');
  if(LV!==lv) await enterLevel('dust',{pos:V3(0,0,0)}); worldReset(); placeDrifters(); saveCheckpoint('landing');
  const J=jay2(); resetActor(J); J.visible=true; J.userData.hp=160; J.userData.dead=false; J.userData.hold=0;
  clockShow(false); invShow(false); hudVisible(true); setVM(true); dayLight(lv); playMusic('piano',.5); setPose(NPC.moe,'hips',0);
  const hole=lv.roofHole, tbl=lv.crashTable.position; PLAYER.lock();
  fd.style.transition='none'; fd.style.opacity=0; SND.play('wind_gust_1',{vol:.9});
  camFollow(t=>{ const k=Math.min(1,t/2.3); return {pos:V3(hole.x+(1-k)*5,lerp(70,2.6,k*k*k),hole.z+(1-k)*4),look:V3(hole.x,0,hole.z+.01),fov:80}; },80); CAM.fnT=0;
  await wait(2.25); SND.play('wood_crash',{vol:1}); SND.play('glass_break',{vol:.8}); SND.play('body_fall',{vol:1}); stopMusic(.05); shake(1.2); flashWhite(.6,.15);
  for(let i=0;i<40;i++) lv.soft.spawn(hole.x+rand(-1,1),rand(1,7),hole.z+rand(-1,1),rand(-2,2),rand(-3,1),rand(-2,2),rand(1,2.5),rand(.08,.2),.5,.36,.22,.9,0,.6,1.5);
  camRelease(0); setPlayer(V3(tbl.x,0,tbl.z),Math.PI/2*B_('saloon').s); PLAYER.y=1.05; PLAYER.eye=.9; lids(.6); blurScreen(.7);
  J.position.set(tbl.x+1.6,.15,tbl.z-1); setPose(J,'lieBack',0);
  await wait(.8); await tweenVal(lids,.6,0,.8); tweenVal(blurScreen,.7,0,1.5);
  // everybody aims at you
  setPose(NPC.moe,'aim',.25); setPose(NPC.lucky,'aim',.25); for(const h of lv.drifters) setPose(h,'aim',.25);
  for(const h of [NPC.moe,NPC.lucky,...lv.drifters]){ faceTo(h,PLAYER.pos); h.userData.A.look='player'; }
  PLAYER.ctl.look=true; lookAtPoint(headOf(NPC.moe),.5); SND.play('switch_01',{vol:.8}); later(.3,()=>SND.play('switch_01',{vol:.6,rate:1.2}));
  await say([LOOP.n?'g_again':'g_1']);
  const opts=['Raise your hands','Talk','Grab the gun on the table','Run for the door']; if(LOOP.n>0) opts.push('"Moe. Put it down. We\'ll pay for your roof."');
  const r=await timedChoice(opts.map(t=>({text:t})),6,2);
  if(r===2){ await say(['j_grab']); SND.play('gun_shotgun',{vol:1}); SND.play('gun_revolver',{vol:1}); return loopDie('shot'); }
  if(r===3){ PLAYER.eye=1.64; PLAYER.y=0; SND.play('gun_revolver',{vol:1}); return loopDie('shot'); }
  PLAYER.y=.15; PLAYER.eye=1.64; clearPose(J,.6); J.position.set(tbl.x+1.4,.15,tbl.z-1.4);
  if(r===4){ learn('moeName'); await say(['j_moeName','m_howknow','m_job1b']); }
  else if(r===1){ await say(['j_talk','m_laugh']); laughGlint(); await say(['m_job1']); F.moeLikes=1; }
  else { setPose(J,'handsUp',.2); await say(['j_hands','m_smart','m_job1']); clearPose(J,.5); }
  for(const h of [NPC.lucky,...lv.drifters]) setPose(h,'cards',.5); setPose(NPC.moe,'hips',.5);
  await say(['m_job2','j2_job']); if(LOOP.n===0) await say(['j2_where','j_where']);
  F.job=1; giveItem('crate',1,true); DAY.running=true; clockShow(true); invShow(true); playMusic('town',3);
  objective('Work off the roof: whiskey to Doc Bishop · collect Lucky\'s debt · warn Sheriff Abe'); freeWalk(); PLAYER.ctl.jump=true;
  if(LOOP.n===0){ later(3,()=>toast('Talk to EVERYONE. Be inside or hidden by sundown (7 PM).','#e8c27a')); later(8,()=>toast('Controls: 1-6 pick · click shoot/use · right mouse aim · hold R load · Q put away','#cfc2aa')); }
};
function laughGlint(){ const t=NPC.moe.userData.goldTooth; if(!t) return; const L=new THREE.PointLight(col(0xffd040),2,1.5,2); t.add(L); later(.8,()=>t.remove(L)); learn('moeTooth','Moe has a GOLD TOOTH'); }
on('key',code=>{ if(code==='KeyE'&&LV&&LV.name==='dust') {} });
LEVELS.dust.onKey=code=>gunKey(code); LEVELS.dust.onPrimary=()=>gunPrimary();
/* ---------- sundown + the night ---------- */
on('sundown',()=>{ if(LV!==LEVELS.dust||LOOP.dying) return; if(F.shipReady){ runStory(()=>SCENES.final()); return; } nightStart(); });
on('dawn',()=>{ if(LV===LEVELS.dust) nightEnd(); });
function nightStart(){ const lv=LEVELS.dust; NIGHT4.on=true; F.moeAway=1; playMusic('night',2); setAmbience([['wind',.04]]);
  for(const id of ['hank','mort','lucky','amos','ned','doc','tobias','surv']) if(NPC[id]) NPC[id].visible=false;
  NPC.moe.visible=false; if(NPC.rook&&!F.rookDig) NPC.rook.visible=false;
  // the Riders + Gideon ride in from both ends of the street
  SND.play('horse_gallop',{vol:.9}); later(1,()=>SND.play('horse_gallop',{vol:.8,rate:.9}));
  for(let i=0;i<7;i++){ const h=makeRider({acc:.62+i*.02}); const z=i%2?-115:125; h.position.set(rand(-8,8),0,z+rand(-6,6)); h.userData.rider.state='hunt'; }
  const G_=makeRider({acc:.75}); G_.userData.who='Gideon'; G_.userData.hp=220; NIGHT4.gideon=G_; cowboy(G_,{hat:false,goldTooth:true}); G_.position.set(0,0,-100); G_.userData.loot={gold:8,key_hangar:1};
  G_.userData.onDie=()=>{ learn('moeGideon','The dead Gideon... is MOE.'); toast('Under the mask: MOE.','#ffd27a'); };
  later(3,()=>{ SND.play('voice/g_laugh',{vol:1,pos:G_.position,ref:40}); }); chat(['j2_here']);
  objective('THE HOLLOW RIDERS. Hide, fight back, or get out of town.');
  if(F.betrayer) later(35,()=>{ if(NIGHT4.on&&NIGHT4.hidden){ for(const h of NIGHT4.riders){ if(!h.userData.dead){ h.userData.rider.state='search'; walkTo(h,[outdoors(PLAYER.pos)],3); } } toast('They know where you\'re hiding. Someone told them.','#ff8a7a'); learn('betray_'+F.betrayer,'Someone you told sold you out'); later(8,()=>{ if(NIGHT4.on&&NIGHT4.hidden) loopDie('shot'); }); } });
  // the night's victims (2) + Bob (if he's still down in the mine)
  const pool=['hank','mort','lucky','ned','amos'].filter(id=>!F.dead[id]); for(let i=0;i<2&&pool.length;i++){ const id=pool.splice(randi(0,pool.length-1),1)[0]; F.dead[id]=1; F.lastDead=(F.lastDead||[]).concat(id); }
  if(!F.bobHelps&&!F.bobDead){ F.bobDead=1; F.bobKiller=pick(['a cave-in','the Hollow Riders','something in the dark','one bullet from Gideon']); }
}
on('tick',dt=>{ if(NIGHT4.on&&DAY.hour>=23&&NIGHT4.riders.length&&!NIGHT4.leaving){ NIGHT4.leaving=1; SND.play('horse_gallop',{vol:.6}); objective('They\'re riding out. Survive till dawn.'); for(const h of NIGHT4.riders) if(!h.userData.dead&&!TRAIN.guards.includes(h)) walkTo(h,[V3(0,0,h.position.z<0?-160:170)],3.5); later(20,()=>{ for(const h of NIGHT4.riders.slice()) if(!TRAIN.guards.includes(h)){ h.visible=false; h.userData.dead=true; } NIGHT4.riders=NIGHT4.riders.filter(h=>TRAIN.guards.includes(h)); }); setAmbience([['wind',.03]]); SND.play('crickets',{vol:.35,loop:true}); } });
function nightEnd(){ NIGHT4.on=false; NIGHT4.leaving=0; NIGHT4.hidden=null; F.moeAway=0; for(const h of NIGHT4.riders.slice()) if(!TRAIN.guards.includes(h)){ h.parent&&h.parent.remove(h); } NIGHT4.riders=NIGHT4.riders.filter(h=>TRAIN.guards.includes(h));
  placeNPCs(); playMusic('town',3); stopLoops(1);
  const names=(F.lastDead||[]).map(id=>WHO_NAME[NPC_DEF[id].who].split(' (')[0]); if(names.length) toast('Last night the Riders killed: '+names.join(' and '),'#ff9a7a'); F.lastDead=[];
  if(F.bobDead&&!F.bobNews){ F.bobNews=1; later(5,()=>toast('Word from the mine: a miner called Bob is dead ('+F.bobKiller+').','#ff9a7a')); later(7,()=>chat(['j_bobnews'])); }
  objective('Day '+DAY.day+'. Find a way off Dustreach.'); }
async function sleepNight(){ const fd=$('fade'); PLAYER.lock(); fd.style.transition='opacity 1.2s'; fd.style.opacity=1; await wait(1.5);
  if(F.betrayer){ SND.play('door_creak',{vol:.7}); await wait(1); SND.play('gun_revolver',{vol:1}); learn('betray_'+F.betrayer,'Someone you told sold you out'); fd.style.opacity=0; return loopDie('sleep'); }
  clearRiders(); for(const h of TRAIN.guards) NIGHT4.riders.push(h); DAY.hour=6; DAY.day++; DAY.sundownDone=DAY.day-1; DAY.dawnDone=DAY.day; nightEnd(); await wait(.8); fd.style.opacity=0; freeWalk(); toast('Morning. Day '+DAY.day,'#e8d0a0'); }
/* ---------- the old mine (and Bob) ---------- */
SCENES.mine=async function(){ const lv=LEVELS.mine, fd=$('fade'); fd.style.transition='opacity .5s'; fd.style.opacity=1; await wait(.6);
  if(RIDE.on) dismount(); const wasNight=NIGHT4.on; await enterLevel('mine',{pos:V3(0,0,2)},{keepMusic:false}); stopMusic(1); setPlayer(V3(0,0,2),0); fd.style.opacity=0;
  const J=CUR.j2; if(J){ J.userData.level='mine'; lv.scene.add(J); J.position.set(1,0,3); }
  if(!lv.bob){ const b=makeHuman({name:'Bob',voice:'Bob',skin:0xe0b090,shirt:0x7a6a50,pants:0x3a3a40,hair:0x6a4a2a,beard:true,build:1.05,mood:'tired',seed:60}); cowboy(b,{hatCol:0x5a4a38}); b.userData.level='mine'; b.userData.hp=100; lv.scene.add(b); lv.bob=b;
    addInteract(lv,{obj:b,offset:V3(0,1.5,0),reach:2.6,label:'Talk to Bob',when:()=>b.visible&&!F.bobDead&&!F.bobHelps,act:()=>bobTalk()});
    lv.veins.forEach(v=>addInteract(lv,{obj:v,reach:2.4,label:'Take the gold',when:()=>v.visible,act:()=>{ v.visible=false; giveGold(4); }}));
    addInteract(lv,{obj:lv.core,reach:2.6,label:'Take the power core',when:()=>lv.core.visible,act:()=>{ if(!giveItem('core')) return; lv.core.visible=false; F.coreTaken=1; learn('core','The POWER CORE: deep in the mine'); SND.play('hum_purple',{vol:.8}); later(1,()=>{ SND.play('stone_2',{vol:1,rate:.4}); shake(.8); toast('Something woke up. GET OUT!','#ff7a6a'); objective('RUN. Get out of the mine!'); MTHING.chase=40; }); }});
    addInteract(lv,{pos:V3(0,1.5,5),reach:3,label:'Leave the mine',act:()=>leaveMine()}); }
  const b=lv.bob; resetActor(b); b.visible=!F.bobHelps; b.position.copy(MINE.gallery).add(V3(1,0,-6)); faceTo(b,MINE.gallery.clone().add(V3(1,0,-9))); if(F.bobDead){ setPose(b,'dead',0); } else setPose(b,'dig',0);
  lv.veins.forEach(v=>v.visible=!F['vein']); lv.rocks.visible=!F.rocksBlown; lv.core.visible=!F.coreTaken;
  if(wasNight) objective('The mine. (It\'s night outside.)');
  freeWalk(); PLAYER.ctl.jump=true; };
LEVELS.mine.onKey=code=>gunKey(code); LEVELS.mine.onPrimary=()=>gunPrimary();
async function leaveMine(){ const fd=$('fade'); fd.style.transition='opacity .5s'; fd.style.opacity=1; await wait(.6); MTHING.chase=0; if(F.coreTaken) objective('');
  await enterLevel('dust',{pos:DUST.mine.clone().add(V3(0,0,8))},{keepMusic:false}); const p=DUST.mine.clone().add(V3(0,0,8)); setPlayer(p,0); PLAYER.y=LEVELS.dust.ground(p.x,p.z);
  const J=CUR.j2; if(J){ J.userData.level='dust'; LEVELS.dust.scene.add(J); J.position.copy(p).add(V3(1.2,0,1)); }
  fd.style.opacity=0; playMusic(NIGHT4.on?'night':'wastes',2); freeWalk(); PLAYER.ctl.jump=true; }
async function bobTalk(){ const lv=LEVELS.mine, b=lv.bob; PLAYER.lock(); PLAYER.ctl.look=true; clearPose(b,.3); faceTo(b,PLAYER.pos); b.userData.A.look='player'; lookAtPoint(headOf(b),.4);
  if(!F.bobMet){ F.bobMet=1; await say(knows('bob')?['b_again']:['b_1','b_2','j_bob','b_3','j2_bob','b_4']); learn('bob','Bob is on Dustreach (he works in the old mine)'); }
  for(;;){ const o=await choose([{text:'The glowing rock?'},{text:'Come with us. (Tell him about the ship)',hide:!knows('ship')},{text:'Bye'}].filter(x=>!x.hide)); const t=o.text;
    if(t.startsWith('The glowing')){ await say(['j_glow','b_core','b_core2']); learn('rockfall','The core is past the cave-in: you need DYNAMITE'); }
    else if(t.startsWith('Come')){ await say(['j_bobship','b_ship']); tell('bob','ship'); F.bobHelps=1; b.visible=false; toast('Bob will hide with Grandpa Rook at the bones','#e8d0a0'); break; }
    else break; }
  if(!F.bobHelps) setPose(b,'dig',.4); freeWalk(); }
/* ---------- the buried ship (south, past the bones) ---------- */
function setupShip(){ const lv=LEVELS.dust, S=DUST.ship;
  addInteract(lv,{pos:S.clone().add(V3(-8,1,-6)),reach:4,label:()=>hasItem('shovel')?'Dig the ship out (3 hours)':'Dig (you need a shovel... or Rook)',when:()=>knows('ship')&&!F.shipDug,act:async()=>{ if(!hasItem('shovel')){ toast('No shovel. Hank sells one. Or ask Rook.','#ff9a7a'); return; } PLAYER.lock(); await timeSkip(3); digOut(); freeWalk(); }});
  const hatchAt=()=>lv.bship.localToWorld(V3(3.4,3,0));
  for(const [id,flag,lab] of [['core','coreIn','Put in the power core'],['fuel','fuelIn','Put in the fuel cell'],['nav','navIn','Put in the nav brain']])
    addInteract(lv,{pos:S.clone().add(V3(4,2,3)),reach:5,label:lab,when:()=>F.shipDug&&hasItem(id)&&!F[flag],act:()=>{ takeItem(id); F[flag]=1; SND.play('metal_3',{vol:.8}); SND.play('hum_build',{vol:.5}); shipCheck(); }});
  addInteract(lv,{pos:S.clone().add(V3(4,2,3)),reach:5,label:'The ship (what does it need?)',when:()=>F.shipDug&&!F.shipReady,act:()=>{ const need=[!F.coreIn&&'a power core',!F.fuelIn&&'a fuel cell',!F.navIn&&'a nav brain'].filter(Boolean); toast('It still needs: '+need.join(', '),'#e8c27a'); }});
  addInteract(lv,{obj:lv.hangarDoor,offset:V3(0,-4,1),reach:6,label:()=>INV.keys.hangar?'Open the hangar (hangar key)':'Hangar door (locked)',when:()=>!F.hangarOpen,act:()=>{ if(!INV.keys.hangar){ toast('Locked. Moe\'s ledger: the key is ON HIM.','#ff9a7a'); return; } F.hangarOpen=1; tweenVal(v=>lv.hangarDoor.position.y=v,lv.hangarDoor.position.y,11,3); SND.play('metal_2',{vol:.8,rate:.5}); }});
  addInteract(lv,{obj:lv.portShip,offset:V3(3,3,0),reach:7,label:'Fuel the old ship + take off (fuel cell)',when:()=>F.hangarOpen&&hasItem('fuel'),act:()=>{ takeItem('fuel'); F.place='port'; F.shipReady=1; runStory(()=>SCENES.final()); }});
  // Rook digging (if you asked him)
  on('tick',()=>{ if(F.rookDig&&!F.shipDug&&DAY.hour+(DAY.day-1)*24>=F.rookDig) digOut(); }); }
function digOut(){ const lv=LEVELS.dust; F.shipDug=1; tweenVal(v=>{ lv.bship.position.y=v; lv.sandMound.scale.y=lerp(3.4,.6,(v-lv.bshipY)/(lv.bshipY*-1+.3)); },lv.bshipY,-.3,3); SND.play('sand_fall',{vol:.8}); toast('The ship is dug out!','#e8c27a'); learn('shipDug'); }
function shipCheck(){ if(F.coreIn&&F.fuelIn&&F.navIn&&!F.shipReady){ F.shipReady=1; F.place='bones'; toast('The ship hums. It needs till SUNDOWN to warm up.','#ffd27a'); objective('Stay alive till sundown. Be at the ship.'); unlock('shipReady');
  if(DAY.hour>=18.5){ DAY.hour=18.99; } } }
/* ---------- debug starts ---------- */
SCENES.mineDebug=async function(){ await SCENES.landingQuick(); giveItem('lantern'); giveItem('dynamite',2); giveItem('revolver'); INV.slots.find(s=>s&&s.id==='revolver').loaded=6; runStory(()=>SCENES.mine()); };
SCENES.landingQuick=async function(){ const lv=LEVELS.dust; if(LV!==lv) await enterLevel('dust',{pos:V3(0,0,0)}); worldReset(); placeDrifters(); const J=jay2(); resetActor(J); J.visible=true; J.position.set(-6,0,0); setPlayer(V3(-4,0,0),0); DAY.running=true; clockShow(true); invShow(true); F.job=1; freeWalk(); };
SCENES.finalDebug=async function(){ await SCENES.landingQuick(); learn('ship'); giveItem('revolver'); INV.slots.find(s=>s&&s.id==='revolver').loaded=6; giveAmmo('bullets',12); F.shipDug=1; LEVELS.dust.bship.position.y=-.3; F.bobHelps=1; F.place='bones'; F.shipReady=1; runStory(()=>SCENES.final()); };
/* ---------- the title: Dry Gulch at sundown ---------- */
TITLE.show=async function(first){
  resetStory(); cleanUI(); G.mode='menu'; G.paused=false; unlockPointer(); clockShow(false); invShow(false); DAY.running=false;
  const lv=LEVELS.dust; await enterLevel('dust',{pos:V3(0,0,140),yaw:0},{keepMusic:true}); if(!AW4_SETUP) worldReset(); DAY.hour=18.3; dayLight(lv);
  PLAYER.lock(); setVM(false); crosshair(false); hudVisible(false);
  camFollow(t=>{ const a=.4+t*.01; return {pos:V3(Math.sin(a)*30,5+Math.sin(t*.07)*.5,60+Math.cos(a)*30),look:V3(0,3,-10),fov:50}; },50);
  playMusic('title',first?3:1.5);
  $('title').classList.remove('hide'); $('title').style.opacity=1;
  const s=getSave(); const has=!!(s&&s.cp);
  $('btnContinue').classList.toggle('hide',!has); $('contWhere').textContent=has?(LOOP.n?'Loop '+(LOOP.n+1):'Dry Gulch'):'';
  $('trophyCount').textContent=Object.keys(TROPHY).length+' / '+TROPHY_DEFS.length;
  if(TITLE.nav) TITLE.nav.stop(); TITLE.nav=GS3Console.nav($('titleMenu'),{first:has?$('btnContinue'):$('btnNew')});
};
$('btnContinue').onclick=()=>{ SFX.uiClick(); startAt('landing',{}); };
$('btnNew').onclick=async()=>{ SFX.uiClick(); if(LOOP.n>0&&!await askConfirm('Start over? You and Jay 2 will forget everything you learned.','Start over')) return; for(const k of Object.keys(LOOP)) delete LOOP[k]; Object.assign(LOOP,{n:0,know:{},deaths:0,told:{},betrayed:{}}); saveLoop(); startAt('landing',{}); };
$('btnChapters').onclick=()=>{ SFX.uiClick(); toast('Dustreach has no chapters: every death sends you back to the saloon roof.','#e8c27a'); };
CHECKPOINTS.push({id:'town',name:'(test) Dry Gulch, no landing',level:'dust'}); SCENES.town=()=>SCENES.landingQuick();
