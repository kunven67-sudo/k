/* ================================================================
   THE ARENA (Part 2) — fighting giant bugs in the pig's sand bowl.
   Click = hit with what's in your hand, Space = dodge (a quick dash,
   you can't be hit during it), 1-4 / Q = switch, E = pick up bones and
   rocks from the sand. Every attack is shown before it lands: the bug
   rears up / opens its claws, and a red mark shows where a jump or a
   sting will come down. No timing bars. Lose = that fight starts over.
   Also: your stuff (what you sneak out at night) and crafting.
   ================================================================ */
const WEAPONS={
  fists:{name:'Fists',reach:1.35,dmg:3,cd:.42,kind:'melee'},
  bone:{name:'Sharp bone',reach:1.8,dmg:7,cd:.36,kind:'melee',swing:true},
  spear:{name:'Thorn spear',reach:3.0,dmg:9,cd:.6,kind:'melee'},
  bspear:{name:'Bone spear',reach:3.1,dmg:13,cd:.6,kind:'melee'},
  rocks:{name:'Rocks',dmg:6,cd:.5,kind:'throw'}
};
const BUGDEF={
  mantis:{name:'PRAYING MANTIS',hp:150,speed:3.4,keep:2.4,turn:3.8,atks:[
    {n:'slash',w:.58,reach:3.5,arc:.9,dmg:1,rec:.75,weight:3},
    {n:'double',w:.52,reach:3.3,arc:.9,dmg:1,rec:.9,weight:3,hits:2},
    {n:'lunge',w:.66,reach:2.9,arc:.95,dmg:2,rec:1.0,weight:2,dash:7,min:4.2}]},
  spider:{name:'TARANTULA',hp:180,speed:4.1,keep:2.6,turn:4.2,atks:[
    {n:'bite',w:.45,reach:3.0,arc:.8,dmg:1,rec:.75,weight:3},
    {n:'leap',w:.68,aoe:2.8,dmg:2,rec:1.0,weight:3,leap:true,min:3.5},
    {n:'web',w:.5,proj:true,rec:.65,weight:2,min:4.5}]},
  scorpion:{name:'EMPEROR SCORPION',hp:230,speed:2.8,keep:2.8,turn:3.0,atks:[
    {n:'pincer',w:.55,reach:3.5,arc:.95,dmg:1,rec:.85,weight:3},
    {n:'sting',w:.85,aoe:1.9,dmg:2,rec:1.1,weight:3,target:true},
    {n:'sweep',w:.75,aoe:4.8,ring:true,dmg:1,rec:.95,weight:2,max:4.6}]}
};
const ARENA={active:false,paused:false,hp:5,maxHp:5,inv:{},cur:'fists',atkCd:0,dodgeT:0,dodgeCd:0,iframe:0,slowT:0,bug:null,st:null,projs:[],marks:[],loot:[],res:null,jay:null};
/* ---------- your stuff (kept in F so checkpoints save it) ---------- */
function inv(){ return F.inv||(F.inv={bone:0,thorn:0,thread:0,pebbles:0,bspear:0}); }
const ITEM_NAMES={bone:'Sharp bone',thorn:'Thorn',thread:'Thread',pebbles:'Pebbles',bspear:'Bone spear'};
function invHUD(){ let el=$('invHud'); if(!el){ el=document.createElement('div'); el.id='invHud'; el.style.cssText='position:fixed;left:22px;bottom:22px;z-index:40;font:700 13px Nunito,system-ui,sans-serif;color:#f4e6cc;text-shadow:0 1px 3px #000;pointer-events:none;display:flex;flex-direction:column;gap:3px'; document.body.appendChild(el); }
  const I=inv(); const rows=Object.keys(ITEM_NAMES).filter(k=>I[k]>0).map(k=>ITEM_NAMES[k]+(k==='pebbles'?' x'+I[k]:''));
  el.innerHTML=rows.length?'<div style="opacity:.6;font-size:11px;letter-spacing:.12em">YOUR STUFF</div>'+rows.map(r=>'<div>'+r+'</div>').join(''):''; el.style.display=rows.length&&!ARENA.active?'flex':'none'; }
function canCraft(){ const I=inv(); return I.thorn>0&&I.bone>0&&I.thread>0&&!I.bspear; }
function craftSpear(){ const I=inv(); if(!canCraft()) return false; I.thorn--; I.bone--; I.thread--; I.bspear=1; SND.play('craft',{vol:.9}); later(.35,()=>SND.play('craft',{vol:.7,rate:1.2})); invHUD(); toast('Made a Bone spear: the thorn tied to a bone with thread','#e0c08a'); return true; }
/* ---------- the HUD ---------- */
function arenaHUD(on){
  let el=$('arenaHud'); if(!el){ el=document.createElement('div'); el.id='arenaHud';
    el.innerHTML='<div id="ahHearts" style="position:fixed;left:22px;top:20px;font-size:26px;letter-spacing:3px;color:#ff5a4a;text-shadow:0 2px 6px #000"></div>'+
      '<div style="position:fixed;left:50%;top:20px;transform:translateX(-50%);width:min(520px,70vw);text-align:center"><div id="ahName" style="font:800 13px Nunito,system-ui;letter-spacing:.25em;color:#f4e6cc;text-shadow:0 1px 4px #000;margin-bottom:6px"></div><div style="height:10px;background:rgba(0,0,0,.55);border-radius:6px;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.15)"><div id="ahBar" style="height:100%;width:100%;background:linear-gradient(90deg,#b8261a,#ff6a3a);transition:width .15s"></div></div></div>'+
      '<div id="ahWpn" style="position:fixed;left:50%;bottom:22px;transform:translateX(-50%);display:flex;gap:8px;font:700 13px Nunito,system-ui"></div>'+
      '<div id="ahHint" style="position:fixed;right:22px;bottom:22px;font:600 12px Nunito,system-ui;color:#cfc2aa;text-align:right;line-height:1.6;text-shadow:0 1px 3px #000">Click = hit<br>Space = dodge<br>1-4 / Q = switch<br>E = pick up</div>';
    el.style.cssText='pointer-events:none;z-index:40'; document.body.appendChild(el); }
  el.style.display=on?'block':'none'; if(on) arenaHUDUpdate(); invHUD(); }
function ownedWeapons(){ const I=ARENA.inv; const l=['fists']; if(I.bone>0) l.push('bone'); if(I.thorn>0) l.push('spear'); if(I.bspear>0) l.push('bspear'); if(I.pebbles>0) l.push('rocks'); return l; }
function arenaHUDUpdate(){ if(!$('ahHearts')) return;
  $('ahHearts').textContent='♥'.repeat(Math.max(0,ARENA.hp))+'♡'.repeat(Math.max(0,ARENA.maxHp-ARENA.hp));
  const st=ARENA.st; if(st){ $('ahName').textContent=st.def.name; $('ahBar').style.width=Math.max(0,st.hp/st.def.hp*100)+'%'; }
  $('ahWpn').innerHTML=ownedWeapons().map((k,i)=>'<div style="padding:7px 12px;border-radius:9px;background:'+(k===ARENA.cur?'rgba(255,204,51,.9);color:#1a1208':'rgba(0,0,0,.5);color:#f4e6cc')+';box-shadow:0 0 0 1px rgba(255,255,255,.15)">'+(i+1)+'  '+WEAPONS[k].name+(k==='rocks'?' x'+ARENA.inv.pebbles:'')+'</div>').join(''); }
/* ---------- weapon in your hand ---------- */
function weaponMesh(k){
  const g=new THREE.Group();
  const boneM=new THREE.MeshStandardMaterial({color:col(0xe6dcc6),roughness:.6}), thornM=new THREE.MeshPhysicalMaterial({color:col(0x8a4a2a),roughness:.4,clearcoat:.5}), thr=new THREE.MeshStandardMaterial({color:col(0xe0d4bc),roughness:1});
  if(k==='bone'){ const b=makeLongBone(.34,.022); b.rotation.x=-Math.PI/2; b.position.z=.1; g.add(b); const tip=mesh(new THREE.ConeGeometry(.02,.1,6),boneM,0,0,-.33); tip.rotation.x=-Math.PI/2; g.add(tip); }
  else if(k==='spear'){ const t=mesh(new THREE.ConeGeometry(.045,1.1,10),thornM,0,0,-.45); t.rotation.x=-Math.PI/2; g.add(t); }
  else if(k==='bspear'){ const sh=makeLongBone(.8,.024); sh.rotation.x=-Math.PI/2; sh.position.z=.05; g.add(sh); const t=mesh(new THREE.ConeGeometry(.04,.42,10),thornM,0,0,-.9); t.rotation.x=-Math.PI/2; g.add(t);
    for(let i=0;i<6;i++){ const w=mesh(new THREE.TorusGeometry(.03,.006,5,12),thr,0,0,-.66-i*.012); g.add(w); } }
  else if(k==='rocks'){ g.add(ell(.06,.045,.055,pbrMat('sandy_gravel_02',.2),0,.01,-.02,12)); }
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.renderOrder=10; } }); return g;
}
function setWeapon(k){ if(!ownedWeapons().includes(k)) return; ARENA.cur=k; if(VM.wpn){ VM.grp.remove(VM.wpn); VM.wpn=null; }
  if(k!=='fists'){ VM.wpn=weaponMesh(k); VM.grp.add(VM.wpn); } VM.wpnK=0; VM.wpnSwing=0; arenaHUDUpdate(); SND.play('pickup',{vol:.35,rate:1.3}); }
/* ---------- floor marks: where a jump / sting / tail sweep will land ---------- */
function arenaMark(pos,r,dur){ const lv=LEVELS.table; const m=mesh(new THREE.RingGeometry(r*.15,r,40),new THREE.MeshBasicMaterial({color:col(0xff3020),transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}),pos.x,.4,pos.z,false); m.rotation.x=-Math.PI/2; lv.scene.add(m);
  const o={m,t:0,dur}; ARENA.marks.push(o); return o; }
/* ---------- the fight ---------- */
async function arenaFight(kind,opts={}){
  const lv=LEVELS.table, A=TABLE.arena;
  ARENA.inv=JSON.parse(JSON.stringify(inv())); ARENA.opts=opts;
  const bug=makeBug(kind); lv.scene.add(bug); ARENA.bug=bug;
  const def=BUGDEF[kind];
  const reset=()=>{
    ARENA.inv=JSON.parse(JSON.stringify(inv())); ARENA.hp=ARENA.maxHp; ARENA.iframe=0; ARENA.slowT=0; ARENA.dodgeT=0; ARENA.dodgeCd=0; ARENA.atkCd=0;
    for(const p of ARENA.projs) p.m.parent&&p.m.parent.remove(p.m); ARENA.projs=[]; for(const m of ARENA.marks) m.m.parent&&m.m.parent.remove(m.m); ARENA.marks=[];
    for(const l of ARENA.loot) l.m.parent&&l.m.parent.remove(l.m); ARENA.loot=[];
    // old bones + rocks lying in the sand (from fights before yours)
    for(let i=0;i<2;i++) arenaLoot('bone',V3(A.x+Math.cos(i*3.1+.6)*7.5,0,A.z+Math.sin(i*3.1+.6)*7.5));
    for(let i=0;i<4;i++) arenaLoot('rock',V3(A.x+Math.cos(i*1.7+2)*rand(4,9),0,A.z+Math.sin(i*1.7+2)*rand(4,9)));
    const B=bug.userData.bug; B.dead=0; B.atk=null; B.atkK=0; B.strikeK=0; B.air=0; bug.position.set(A.x,.35,A.z-7); bug.rotation.y=0;
    ARENA.st={def,hp:def.hp,phase:'idle',t:0,cd:1.6,atk:null,half:false};
    if(!opts.keepPos){ setPlayer(V3(A.x,0,A.z+7),0); PLAYER.y=.35; } opts.keepPos=false; PLAYER.speed=lv.env.speed;
    setWeapon(ownedWeapons().includes('bspear')?'bspear':ownedWeapons().includes('spear')?'spear':ownedWeapons().includes('bone')?'bone':'fists');
    arenaHUDUpdate(); };
  reset();
  ARENA.active=true; ARENA.paused=false; lv.col.radius=TABLE.arenaR-.5; lv.col.cx=A.x; lv.col.cz=A.z;
  arenaHUD(true); freeWalk(); PLAYER.ctl.jump=false; crosshair(true);
  const P=lv.pig.userData.pig; P.stop=false; P.look=V3(A.x,0,A.z);
  playMusic(kind==='scorpion'?'boss':'arena',1.2);
  const r=await new Promise(res=>{ ARENA.res=res; });
  if(r!=='win'){ // you went down: no second try here — the scene sends you back to the first fight (Day 3)
    ARENA.paused=true; PLAYER.lock(); SND.play('body_fall',{vol:.9}); tweenVal(v=>{ PLAYER.roll=v; },0,.5,.6); stopMusic(1);
    await wait(1); ARENA.active=false; arenaHUD(false); lv.col.radius=null; if(VM.wpn){ VM.grp.remove(VM.wpn); VM.wpn=null; }
    for(const p of ARENA.projs) p.m.parent&&p.m.parent.remove(p.m); ARENA.projs=[]; for(const m of ARENA.marks) m.m.parent&&m.m.parent.remove(m.m); ARENA.marks=[];
    for(const l of ARENA.loot) l.m.parent&&l.m.parent.remove(l.m); ARENA.loot=[];
    return {won:false,bug}; }
  // won
  ARENA.paused=true; PLAYER.lock();
  await wait(2.2);
  ARENA.active=false; arenaHUD(false); lv.col.radius=null;
  if(VM.wpn){ VM.grp.remove(VM.wpn); VM.wpn=null; }
  for(const p of ARENA.projs) p.m.parent&&p.m.parent.remove(p.m); ARENA.projs=[]; for(const m of ARENA.marks) m.m.parent&&m.m.parent.remove(m.m); ARENA.marks=[];
  for(const l of ARENA.loot) l.m.parent&&l.m.parent.remove(l.m); ARENA.loot=[];
  // what you carried in keeps being yours (rocks you threw stay in the sand)
  const I=inv(); I.pebbles=Math.min(I.pebbles,ARENA.inv.pebbles);
  return {won:true,bug};
}
function arenaLoot(kind,pos){ const lv=LEVELS.table;
  const m=kind==='bone'?makeLongBone(1.2,.08):ell(.32,.24,.3,pbrMat('sandy_gravel_02',.4),0,0,0,14);
  if(kind==='bone'){ m.rotation.set(Math.PI/2,0,rand(0,6)); m.position.set(pos.x,.42,pos.z); } else m.position.set(pos.x,.55,pos.z);
  lv.scene.add(m); const o={kind,m,pos:pos.clone()}; ARENA.loot.push(o); return o; }
/* ---------- input (the table level forwards keys and clicks here while fighting) ---------- */
function arenaKey(code){
  if(!ARENA.active||ARENA.paused) return false;
  const m=/^Digit([1-5])$/.exec(code); if(m){ const k=ownedWeapons()[+m[1]-1]; if(k) setWeapon(k); return true; }
  if(code==='KeyQ'){ const l=ownedWeapons(); setWeapon(l[(l.indexOf(ARENA.cur)+1)%l.length]); return true; }
  if(code==='Space'){ arenaDodge(); return true; }
  if(code==='KeyE'){ arenaPickup(); return true; }
  return false;
}
function arenaDodge(){ if(ARENA.dodgeCd>0) return; const fw=V3(-Math.sin(PLAYER.yaw),0,-Math.cos(PLAYER.yaw)), rt=V3(Math.cos(PLAYER.yaw),0,-Math.sin(PLAYER.yaw));
  const d=V3(); if(keys.KeyW||keys.ArrowUp) d.add(fw); if(keys.KeyS||keys.ArrowDown) d.sub(fw); if(keys.KeyD||keys.ArrowRight) d.add(rt); if(keys.KeyA||keys.ArrowLeft) d.sub(rt);
  if(d.lengthSq()<.01) d.copy(fw).negate(); d.normalize();
  ARENA.dodgeDir=d; ARENA.dodgeT=.22; ARENA.iframe=.42; ARENA.dodgeCd=.75; SND.play('swing_'+randi(1,2),{vol:.6,rate:.8}); PLAYER.fovKick=(PLAYER.fovKick||0)+4; }
function arenaPickup(){ let best=null, bd=2.2; for(const l of ARENA.loot){ const d=Math.hypot(l.m.position.x-PLAYER.pos.x,l.m.position.z-PLAYER.pos.z); if(d<bd){ bd=d; best=l; } }
  if(!best) return; best.m.parent&&best.m.parent.remove(best.m); ARENA.loot.splice(ARENA.loot.indexOf(best),1);
  if(best.kind==='bone'){ ARENA.inv.bone=(ARENA.inv.bone||0)+1; toast('Sharp bone','#e0c08a'); if(ARENA.cur==='fists') setWeapon('bone'); }
  else { ARENA.inv.pebbles=(ARENA.inv.pebbles||0)+1; toast('Rock','#e0c08a'); }
  SND.play('pickup',{vol:.6}); arenaHUDUpdate(); }
function arenaAttack(){
  if(!ARENA.active||ARENA.paused||ARENA.atkCd>0) return true;
  const W=WEAPONS[ARENA.cur]; ARENA.atkCd=W.cd;
  if(W.kind==='throw'){ if(ARENA.inv.pebbles<=0){ setWeapon('fists'); return true; } ARENA.inv.pebbles--; arenaHUDUpdate();
    const dir=camera.getWorldDirection(V3()); const p=camera.position.clone().addScaledVector(dir,.6).add(V3(0,-.15,0));
    const m=ell(.32,.24,.3,pbrMat('sandy_gravel_02',.4),p.x,p.y,p.z,12); LEVELS.table.scene.add(m);
    ARENA.projs.push({m,v:dir.multiplyScalar(26).add(V3(0,2.5,0)),mine:true,dmg:W.dmg,life:3}); SND.play('swing_1',{vol:.5,rate:1.3}); VM.wpnK=1;
    if(ARENA.inv.pebbles<=0) later(.3,()=>{ if(ARENA.cur==='rocks') setWeapon('fists'); });
    return true; }
  // melee: what's in front of you within reach
  if(ARENA.cur==='fists') VM.punchT=.28; else { VM.wpnK=1; if(W.swing) VM.wpnSwing=1; }
  SND.play('swing_'+randi(1,2),{vol:.55,rate:W.swing?1.2:.9});
  const st=ARENA.st, bug=ARENA.bug, B=bug.userData.bug; if(!st||B.dead) return true;
  const c=bugCenter(), d=Math.hypot(c.x-PLAYER.pos.x,c.z-PLAYER.pos.z)-B.r;
  const fw=V3(-Math.sin(PLAYER.yaw),0,-Math.cos(PLAYER.yaw)), to=V3(c.x-PLAYER.pos.x,0,c.z-PLAYER.pos.z).normalize();
  if(d<=W.reach && fw.dot(to)>Math.cos(.75)){ later(.08,()=>bugTakeHit(W.dmg)); }
  return true;
}
function bugCenter(){ const bug=ARENA.bug, B=bug.userData.bug; const off=B.kind==='scorpion'?-.6:B.kind==='spider'?-.2:.2; return bug.position.clone().add(V3(Math.sin(bug.rotation.y)*off,0,Math.cos(bug.rotation.y)*off)); }
function bugTakeHit(dmg){ const st=ARENA.st, bug=ARENA.bug, B=bug.userData.bug; if(!ARENA.active||B.dead) return;
  st.hp-=dmg; bugHurt(bug); SND.play('blade_'+randi(1,3),{vol:.8,pos:bug.position.clone().add(V3(0,1,0)),ref:6}); if(Math.random()<.5) SND.play('bug_hurt',{vol:.7,pos:bug.position,ref:6,rate:rand(.7,.9)});
  shake(.12); arenaHUDUpdate();
  if(!st.half&&!F.key&&st.hp<=st.def.hp*.55&&ARENA.opts.onHalf){ st.half=true; ARENA.paused=true; st.phase='idle'; B.atk=null; B.atkK=0; B.strikeK=0;
    Promise.resolve(ARENA.opts.onHalf()).then(()=>{ ARENA.paused=false; freeWalk(); PLAYER.ctl.jump=false; }); return; }
  if(st.hp<=0){ B.dead=.01; B.atk=null; B.walkK=0; SND.play('bug_die',{vol:1,pos:bug.position,ref:8,rate:.7}); stopMusic(1.5);
    const P=LEVELS.table.pig.userData.pig; later(.8,()=>SND.play('pig_squeal',{vol:1,pos:V3(0,44,-40),ref:80,rate:.75}));
    later(.1,()=>ARENA.res&&ARENA.res('win')); } }
function youGetHitArena(dmg,from){ if(ARENA.iframe>0||!ARENA.active||ARENA.paused) return;
  ARENA.hp-=dmg; ARENA.iframe=.6; dmgFlash(); shake(.55); SND.play('oof_'+randi(1,2),{vol:.9}); SND.play('punch_'+randi(1,3),{vol:.6,rate:.7});
  if(from){ const k=V3(PLAYER.pos.x-from.x,0,PLAYER.pos.z-from.z).normalize(); PLAYER.pos.addScaledVector(k,1.4); }
  arenaHUDUpdate(); if(ARENA.hp<=0) ARENA.res&&ARENA.res('lose'); }
/* ---------- every frame ---------- */
function arenaTick(dt,t){
  if(!ARENA.active) return;
  const lv=LEVELS.table, A=TABLE.arena;
  ARENA.atkCd-=dt; ARENA.dodgeCd-=dt; ARENA.iframe-=dt; ARENA.slowT-=dt;
  VM.wpnK=damp(VM.wpnK||0,0,9,dt); VM.wpnSwing=damp(VM.wpnSwing||0,0,7,dt);
  PLAYER.speed=lv.env.speed*(ARENA.slowT>0?.45:1);
  if(ARENA.dodgeT>0){ ARENA.dodgeT-=dt; PLAYER.pos.addScaledVector(ARENA.dodgeDir,11*dt); resolveCol(lv.col,PLAYER.pos,PLAYER.radius); }
  // projectiles (your rocks, its web)
  for(let i=ARENA.projs.length-1;i>=0;i--){ const p=ARENA.projs[i]; p.life-=dt; p.v.y-=(p.mine?14:3)*dt; p.m.position.addScaledVector(p.v,dt);
    let gone=p.life<=0||p.m.position.y<.4;
    if(p.mine&&!gone){ const c=bugCenter(); const B=ARENA.bug.userData.bug; if(!B.dead&&p.m.position.distanceTo(c.clone().add(V3(0,B.h*.45,0)))<B.r+.6){ bugTakeHit(p.dmg); gone=true; } }
    if(!p.mine&&!gone&&p.m.position.distanceTo(PLAYER.pos.clone().add(V3(0,1.1,0)))<.9){ gone=true; if(ARENA.iframe<=0){ ARENA.slowT=2.6; SND.play('spit',{vol:.9}); toast('Webbed! You are slow','#cfc2aa'); } }
    if(gone){ if(p.mine&&p.m.position.y<.6&&Math.hypot(p.m.position.x-A.x,p.m.position.z-A.z)<TABLE.arenaR-.6){ ARENA.loot.push({kind:'rock',m:p.m,pos:p.m.position.clone()}); p.m.position.y=.55; SND.play('stone_'+randi(1,2),{vol:.5,pos:p.m.position,ref:5}); } else p.m.parent&&p.m.parent.remove(p.m); ARENA.projs.splice(i,1); } }
  for(let i=ARENA.marks.length-1;i>=0;i--){ const m=ARENA.marks[i]; m.t+=dt; m.m.material.opacity=Math.min(.55,m.t/m.dur*.7)*(.75+Math.sin(t*18)*.25); if(m.t>m.dur+.25){ m.m.parent&&m.m.parent.remove(m.m); ARENA.marks.splice(i,1); } }
  const bug=ARENA.bug; if(!bug) return; const B=bug.userData.bug; animateBug(bug,dt,t); if(B.dead||ARENA.paused){ B.walkK=damp(B.walkK,0,6,dt); return; }
  bugAI(dt,t);
  if(ARENA.jay) arenaJayTick(dt,t);
}
function bugAI(dt,t){
  const st=ARENA.st, bug=ARENA.bug, B=bug.userData.bug, def=st.def, A=TABLE.arena;
  const c=bugCenter(), toP=V3(PLAYER.pos.x-c.x,0,PLAYER.pos.z-c.z), dist=toP.length(), want=Math.atan2(toP.x,toP.z);
  const face=(rate)=>{ bug.rotation.y+=clamp(angDiff(bug.rotation.y,want),-rate*dt,rate*dt); };
  const fw=V3(Math.sin(bug.rotation.y),0,Math.cos(bug.rotation.y));
  const inArc=(arc)=>fw.dot(toP.clone().normalize())>Math.cos(arc);
  st.t+=dt;
  if(st.phase==='idle'){
    face(def.turn); st.cd-=dt;
    const mv=dist-B.r>def.keep; B.walkK=damp(B.walkK,mv?1:.15,5,dt);
    if(mv){ bug.position.addScaledVector(fw,def.speed*B.walkK*dt); }
    else if(Math.random()<dt*.6){ st.side=(st.side||1)*-1; }
    if(!mv) bug.position.addScaledVector(V3(fw.z,0,-fw.x),(st.side||1)*.9*dt);   // circling a little
    if(st.cd<=0){ const ok=def.atks.filter(a=>(a.reach?dist-B.r<a.reach+.6:true)&&(a.min?dist>a.min:true)&&(a.max?dist<a.max:true));
      if(ok.length){ let tot=ok.reduce((s,a)=>s+a.weight,0), r=Math.random()*tot; let atk=ok[0]; for(const a of ok){ r-=a.weight; if(r<=0){ atk=a; break; } }
        st.atk=atk; st.phase='wind'; st.t=0; B.atk=atk.n; B.walkK=0;
        SND.play('bug_'+randi(1,4),{vol:.9,pos:bug.position.clone().add(V3(0,1,0)),ref:8,rate:B.kind==='mantis'?1.1:B.kind==='spider'?.85:.7});
        if(atk.leap){ st.tgt=PLAYER.pos.clone(); st.mark=arenaMark(st.tgt,atk.aoe,atk.w); }
        if(atk.target){ st.tgt=PLAYER.pos.clone(); st.mark=arenaMark(st.tgt,atk.aoe,atk.w); }
        if(atk.ring) st.mark=arenaMark(bug.position,atk.aoe,atk.w); } } }
  else if(st.phase==='wind'){
    const a=st.atk; B.atkK=Math.min(1,st.t/a.w); if(!a.leap&&!a.target) face(def.turn*.5);
    if(a.target&&st.mark){ st.tgt.lerp(PLAYER.pos,Math.min(1,dt*1.2)); st.mark.m.position.set(st.tgt.x,.4,st.tgt.z); }   // the sting follows you a bit, then commits
    if(st.t>=a.w){ st.phase='strike'; st.t=0; st.hits=0; st.from=bug.position.clone(); } }
  else if(st.phase==='strike'){
    const a=st.atk; B.strikeK=Math.min(1,st.t/.16);
    if(a.dash){ if(st.t<.3){ bug.position.addScaledVector(fw,a.dash/.3*dt); } }
    if(a.leap){ const k=Math.min(1,st.t/.55); B.air=Math.sin(k*Math.PI); bug.position.lerpVectors(st.from,V3(st.tgt.x,.35,st.tgt.z),k); bug.position.y=.35+Math.sin(k*Math.PI)*3.2;
      if(k>=1&&!st.hits){ st.hits=1; B.air=0; shake(.4); SND.play('body_fall',{vol:1,pos:bug.position,ref:8,rate:.6}); SND.play('sand_fall',{vol:.6,pos:bug.position,ref:8});
        if(Math.hypot(PLAYER.pos.x-st.tgt.x,PLAYER.pos.z-st.tgt.z)<a.aoe) youGetHitArena(a.dmg,st.tgt); } }
    else if(a.proj){ if(!st.hits){ st.hits=1; const from=bug.position.clone().add(V3(0,1.3,0)).addScaledVector(fw,1.4); const to=PLAYER.pos.clone().add(V3(0,1.1,0)); const v=to.sub(from).normalize().multiplyScalar(16);
        const m=mesh(new THREE.SphereGeometry(.28,10,8),new THREE.MeshStandardMaterial({color:col(0xf0f0e8),roughness:.6,transparent:true,opacity:.85}),from.x,from.y,from.z,false); LEVELS.table.scene.add(m); ARENA.projs.push({m,v,mine:false,life:2}); SND.play('spit',{vol:.8,pos:from,ref:6}); } }
    else if(a.target){ if(!st.hits&&st.t>.12){ st.hits=1; shake(.35); SND.play('blade_3',{vol:1,pos:st.tgt,ref:8,rate:.6}); SND.play('sand_fall',{vol:.5,pos:st.tgt,ref:8}); if(Math.hypot(PLAYER.pos.x-st.tgt.x,PLAYER.pos.z-st.tgt.z)<a.aoe) youGetHitArena(a.dmg,st.tgt); } }
    else if(a.ring){ if(!st.hits&&st.t>.1){ st.hits=1; SND.play('swing_2',{vol:1,pos:bug.position,ref:8,rate:.5}); bug.rotation.y+=.01; if(dist<a.aoe) youGetHitArena(a.dmg,bug.position); }
      bug.rotation.y+=dt*14*(st.t<.45?1:0); }
    else { const need=a.hits||1; const at=[.0,.32];
      for(let h=st.hits;h<need;h++){ if(st.t>=at[h]+.06){ st.hits=h+1; SND.play('swing_1',{vol:.9,pos:bug.position,ref:8,rate:.7}); if(dist-B.r<a.reach&&inArc(a.arc)) youGetHitArena(a.dmg,c); } } }
    const dur=a.leap?.6:a.dash?.4:(a.hits===2?.55:.3);
    if(st.t>=dur){ st.phase='rec'; st.t=0; B.air=0; } }
  else if(st.phase==='rec'){ B.atkK=damp(B.atkK,0,6,dt); B.strikeK=damp(B.strikeK,0,6,dt);
    if(st.t>=st.atk.rec){ st.phase='idle'; st.cd=rand(.25,.7); B.atk=null; } }
  // stay in the bowl, never inside you
  const r=Math.hypot(bug.position.x-A.x,bug.position.z-A.z), lim=TABLE.arenaR-B.r-.3; if(r>lim){ bug.position.x=A.x+(bug.position.x-A.x)/r*lim; bug.position.z=A.z+(bug.position.z-A.z)/r*lim; }
  bug.position.y=st.phase==='strike'&&st.atk.leap?bug.position.y:.35;
  const c2=bugCenter(), dx=PLAYER.pos.x-c2.x, dz=PLAYER.pos.z-c2.z, dd=Math.hypot(dx,dz), minD=B.r+PLAYER.radius;
  if(dd<minD&&dd>1e-3){ PLAYER.pos.x=c2.x+dx/dd*minD; PLAYER.pos.z=c2.z+dz/dd*minD; }
}
/* Jay 2 in the arena (day 3): keeps his distance, throws rocks now and then */
function arenaJayTick(dt,t){ const J=ARENA.jay, bug=ARENA.bug, A=TABLE.arena; if(!J||J.userData.arenaHold) return;
  const away=V3(J.position.x-bug.position.x,0,J.position.z-bug.position.z); if(away.lengthSq()<.01) away.set(1,0,0); away.normalize();
  const goal=V3(A.x,0,A.z).addScaledVector(away,8.5);
  ARENA.jayMove=(ARENA.jayMove||0)-dt; if(ARENA.jayMove<=0){ ARENA.jayMove=1.2; if(Math.hypot(goal.x-J.position.x,goal.z-J.position.z)>1.2) walkTo(J,[goal],2.8); }
  if(!J.userData.A.path) facePoint(J,bug.position);
  ARENA.jayT=(ARENA.jayT||rand(4,6))-dt; if(ARENA.jayT<=0&&!bug.userData.bug.dead){ ARENA.jayT=rand(5,8); setPose(J,'point',.2); later(.4,()=>clearPose(J,.3));
    const from=J.position.clone().add(V3(0,1.6,0)), to=bugCenter().add(V3(0,1,0)); const m=ell(.25,.2,.24,pbrMat('sandy_gravel_02',.4),from.x,from.y,from.z,10); LEVELS.table.scene.add(m);
    ARENA.projs.push({m,v:to.sub(from).normalize().multiplyScalar(20).add(V3(0,3,0)),mine:true,dmg:3,life:2.5}); } }
on('tick',dt=>{ arenaTick(dt,G.time); });
