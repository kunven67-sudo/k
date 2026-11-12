/* ================================================================
   GUNS + WHAT YOU CARRY — 6 slots (pick what matters), gold + ammo in
   your pouch, keys on a ring (every key fits ONE door). 1-6 / wheel =
   pick, click = shoot / throw / use, right mouse = aim, R = load ONE
   round (hold it to keep loading), Q = put it away. 1-2 shots kill.
   ================================================================ */
const ITEMS={
  revolver:{name:'Revolver',gun:'revolver',mag:6,ammo:'bullets',dmg:70,spread:.012,snd:'gun_revolver',rate:.42},
  shotgun:{name:'Shotgun',gun:'shotgun',mag:2,ammo:'shells',dmg:45,pellets:7,spread:.06,snd:'gun_shotgun',rate:.8},
  rifle:{name:'Rifle',gun:'rifle',mag:5,ammo:'rounds',dmg:110,spread:.003,snd:'gun_rifle',rate:1.2},
  dynamite:{name:'Dynamite',stack:true}, bandage:{name:'Bandages',stack:true}, whiskey:{name:'Whiskey',stack:true},
  lantern:{name:'Lantern'}, shovel:{name:'Shovel'}, map:{name:"Rook's map"}, mask:{name:'Rider mask (from the cellar)'}, ledger:{name:"Moe's ledger"},
  core:{name:'Power core'}, fuel:{name:'Fuel cell'}, nav:{name:'Nav brain'}, crate:{name:'Whiskey crate'}, photo:{name:'Old photo'} };
const KEYNAMES={cellar:'Cellar key (behind the bar)',backroom:'Back room key (the store)',cell:'Jail cell key',caboose:'Caboose safe key',hangar:'Hangar key',mine:'Mine gate key'};
const INV={slots:[null,null,null,null,null,null],sel:-1,hp:100,ammo:{bullets:0,shells:0,rounds:0},gold:0,keys:{},aim:0,cool:0,loadT:0};
function invReset(){ INV.slots=[null,null,null,null,null,null]; INV.sel=-1; INV.hp=100; INV.ammo={bullets:0,shells:0,rounds:0}; INV.gold=0; INV.keys={}; holster(); invHud(); }
function hasItem(id){ return INV.slots.some(s=>s&&s.id===id); }
function itemCount(id){ const s=INV.slots.find(s=>s&&s.id===id); return s?(s.n||1):0; }
function giveItem(id,n=1,quiet){ const I=ITEMS[id]; let s=I.stack?INV.slots.find(s=>s&&s.id===id):null;
  if(s){ s.n+=n; } else { const i=INV.slots.indexOf(null); if(i<0){ toast('Your hands are full (6 things). Drop something first: hold Q','#ff9a7a'); return false; } s=INV.slots[i]={id,n,loaded:0}; }
  if(!quiet){ SND.play('pickup',{vol:.6}); toast('+ '+I.name+(n>1?' x'+n:''),'#e8d0a0'); } invHud(); return true; }
function takeItem(id,n=1){ const i=INV.slots.findIndex(s=>s&&s.id===id); if(i<0) return false; const s=INV.slots[i]; if(ITEMS[id].stack&&s.n>n){ s.n-=n; } else { INV.slots[i]=null; if(INV.sel===i) holster(); } invHud(); return true; }
function giveKey(k){ INV.keys[k]=1; SND.play('key_open_01',{vol:.5}); toast('+ '+KEYNAMES[k],'#ffe08a'); invHud(); }
function giveGold(n){ INV.gold+=n; SND.play('pickup',{vol:.5,rate:1.3}); toast((n>0?'+':'')+n+' gold','#ffd040'); invHud(); }
function giveAmmo(k,n){ INV.ammo[k]+=n; SND.play('metal_04',{vol:.3,rate:1.6}); toast('+ '+n+' '+k,'#d8d0c0'); invHud(); }
/* ---------- HUD: the 6 slots + health + gold/ammo ---------- */
(function invDom(){ const d=document.createElement('div'); d.id='inv'; d.style.cssText='position:fixed;left:50%;bottom:14px;transform:translateX(-50%);display:none;gap:6px;z-index:7;pointer-events:none;font:600 11px system-ui,sans-serif;color:#f0e2c4';
  for(let i=0;i<6;i++){ const s=document.createElement('div'); s.className='invS'; s.style.cssText='width:86px;height:44px;border:1px solid rgba(240,220,180,.35);background:rgba(20,14,8,.55);border-radius:6px;padding:4px 6px;box-sizing:border-box;text-shadow:0 1px 2px #000;overflow:hidden'; d.appendChild(s); }
  document.body.appendChild(d);
  const p=document.createElement('div'); p.id='pouch'; p.style.cssText='position:fixed;left:18px;bottom:16px;z-index:7;pointer-events:none;font:600 13px/1.5 system-ui,sans-serif;color:#f0e2c4;text-shadow:0 1px 3px #000;display:none'; document.body.appendChild(p); })();
function invShow(on){ $('inv').style.display=on?'flex':'none'; $('pouch').style.display=on?'':'none'; }
function invHud(){ const els=document.querySelectorAll('#inv .invS');
  INV.slots.forEach((s,i)=>{ const e=els[i]; if(!e) return; e.style.borderColor=i===INV.sel?'#ffd27a':'rgba(240,220,180,.35)'; e.style.background=i===INV.sel?'rgba(70,46,18,.75)':'rgba(20,14,8,.55)';
    if(!s){ e.innerHTML='<span style="opacity:.4">'+(i+1)+'</span>'; return; } const I=ITEMS[s.id];
    e.innerHTML='<span style="opacity:.6">'+(i+1)+'</span> '+I.name+'<br><span style="opacity:.8">'+(I.gun?s.loaded+' / '+I.mag+' · '+INV.ammo[I.ammo]:I.stack?'x'+s.n:'')+'</span>'; });
  const hp=Math.max(0,Math.round(INV.hp)); $('pouch').innerHTML='<span style="color:'+(hp<50?'#ff8a7a':'#bfe8a8')+'">♥ '+hp+'</span> &nbsp; <span style="color:#ffd040">● '+INV.gold+' gold</span>'+(Object.keys(INV.keys).length?'<br><span style="opacity:.8">Keys: '+Object.keys(INV.keys).map(k=>KEYNAMES[k].split(' (')[0]).join(', ')+'</span>':''); }
/* ---------- holding a gun (first person) ---------- */
function curItem(){ return INV.sel>=0?INV.slots[INV.sel]:null; }
function holster(){ if(VM.gun){ VM.gun.parent&&VM.gun.parent.remove(VM.gun); VM.gun=null; } INV.sel=-1; invHud(); }
function selectSlot(i){ if(INV.sel===i){ holster(); return; } holster(); const s=INV.slots[i]; if(!s) return; INV.sel=i; const I=ITEMS[s.id];
  if(I.gun||s.id==='dynamite'){ const g=gunMesh(I.gun||'dynamite'); VM.grp.add(g); VM.gun=g; SND.play('metal_04',{vol:.25,rate:1.4}); }
  invHud(); }
on('tick',dt=>{ INV.cool=Math.max(0,INV.cool-dt); const it=curItem(); if(!it||!VM.gun) { INV.aim=damp(INV.aim,0,10,dt); CAM.fovAim=0; return; }
  INV.aim=damp(INV.aim,INPUT.rmb&&INPUT.locked?1:0,10,dt); CAM.fovAim=lerp(0,it.id==='rifle'?32:18,INV.aim);
  // load one round at a time while R is held
  if(keys.KeyR&&ITEMS[it.id].gun){ INV.loadT-=dt; if(INV.loadT<=0){ INV.loadT=.5; loadOne(it); } } else INV.loadT=0;
  VM.wpnK=damp(VM.wpnK||0,0,14,dt); });
function loadOne(it){ const I=ITEMS[it.id]; if(it.loaded>=I.mag) return; if(INV.ammo[I.ammo]<=0){ toast('No '+I.ammo+' left','#ff9a7a'); INV.loadT=1.5; return; }
  INV.ammo[I.ammo]--; it.loaded++; SND.play(it.id==='revolver'?'switch_01':'gun_reload',{vol:.5,rate:it.id==='revolver'?1.4:1.1}); if(VM.gun&&VM.gun.userData.cyl) VM.gun.userData.cyl.rotation.y+=Math.PI/3; invHud(); }
/* ---------- shooting ---------- */
const _rc=new THREE.Raycaster();
function shootTargets(){ const L=[]; for(const h of HUMANS) if(h.visible&&h.userData.level===LV.name&&h.userData.hp>0) L.push(h); return L; }
function fireGun(){
  const it=curItem(); if(!it||INV.cool>0) return; const I=ITEMS[it.id];
  if(it.id==='dynamite'){ throwDynamite(); return; }
  if(!I.gun) return;
  if(it.loaded<=0){ SND.play('switch_01',{vol:.6,rate:.8}); toast('Empty. Hold R to load.','#ff9a7a'); INV.cool=.3; return; }
  it.loaded--; INV.cool=I.rate; VM.wpnK=1; invHud();
  const pos=camera.getWorldPosition(V3()); SND.play(I.snd,{vol:1}); shake(I.gun==='rifle'?.25:.18); PLAYER.pitch+=I.gun==='shotgun'?.05:.03; muzzleFlash(VM.gun.localToWorld(VM.gun.userData.muzzle.clone()));
  gunNoise(pos,90);
  const dir0=camera.getWorldDirection(V3()); const n=I.pellets||1, spread=I.spread*(1-INV.aim*.7)*(PLAYER.vel&&PLAYER.vel.length()>1?1.8:1);
  for(let p=0;p<n;p++){ const d=dir0.clone().add(V3(rand(-spread,spread),rand(-spread,spread),rand(-spread,spread))).normalize();
    const hit=castShot(pos,d,250,null); if(hit) applyHit(hit,I.dmg,'you'); }
}
/* what a bullet hits first: a wall or a person */
function castShot(from,dir,range,ignore){ _rc.set(from,dir); _rc.far=range;
  const objs=(LV.occluders||[]).concat(shootTargets().filter(h=>h!==ignore));
  const hits=_rc.intersectObjects(objs,true); for(const h of hits){ let o=h.object, person=null, head=false; while(o){ if(o.userData&&o.userData.J){ person=o; break; } if(o.userData&&o.userData.isHead) head=true; o=o.parent; }
    if(person&&person===ignore) continue; if(person){ const J=person.userData.J; head=head||isUnder(h.object,J.head); return {person,head,point:h.point}; }
    if(h.object.visible!==false) return {wall:true,point:h.point}; } return null; }
function isUnder(o,p){ while(o){ if(o===p) return true; o=o.parent; } return false; }
function applyHit(hit,dmg,by){
  if(hit.wall){ LV.soft.spawn(hit.point.x,hit.point.y,hit.point.z,rand(-.5,.5),rand(.5,1.5),rand(-.5,.5),rand(.4,.8),.25,.7,.62,.5,.6,0,.4,1.2); SND.play('hit_01',{vol:.25,pos:hit.point,ref:8,rate:rand(1.2,1.6)}); return; }
  const h=hit.person, U=h.userData; const d=hit.head?999:dmg; U.hp-=d; for(let i=0;i<8;i++) LV.soft.spawn(hit.point.x,hit.point.y,hit.point.z,rand(-1,1),rand(0,1.5),rand(-1,1),rand(.3,.6),.12,.45,.05,.04,.9,0,.3,1.4);
  SND.play('oof_'+randi(1,2),{vol:.7,pos:hit.point,ref:10,rate:rand(.8,1.1)});
  if(U.onHit) try{ U.onHit(by,d); }catch(e){ console.error(e); }
  if(U.hp<=0) killPerson(h,by);
}
function killPerson(h,by){ const U=h.userData; if(U.dead) return; U.dead=true; U.hp=0; U.A.path=null; setPose(h,'dead',.25); h.userData.A.look=null; SND.play('body_fall',{vol:.8,pos:h.position,ref:12});
  if(U.loot) addInteract(LV,{obj:h,offset:V3(0,.3,0),reach:2.2,label:'Search '+(U.who||'the body'),when:()=>!U.searched,act:()=>{ U.searched=true; lootBody(U.loot); }});
  if(U.onDie) try{ U.onDie(by); }catch(e){ console.error(e); } }
function lootBody(L){ let got=false; for(const k in L){ const v=L[k]; if(k==='gold'){ giveGold(v); got=true; } else if(k==='bullets'||k==='shells'||k==='rounds'){ giveAmmo(k,v); got=true; } else if(k.startsWith('key_')){ giveKey(k.slice(4)); got=true; } else if(ITEMS[k]){ if(giveItem(k,v)) got=true; } } if(!got) toast('Nothing useful','#cfc2aa'); }
function muzzleFlash(at){ const L=new THREE.PointLight(col(0xffc070),6,9,2); L.position.copy(at); LV.scene.add(L); later(.06,()=>LV.scene.remove(L)); for(let i=0;i<6;i++) LV.soft.spawn(at.x,at.y,at.z,rand(-.4,.4),rand(.1,.6),rand(-.4,.4),rand(.4,.9),.06,.75,.7,.65,.5,0,.3,1); }
/* shots are loud: people (and the Riders) hear them */
function gunNoise(at,r){ emit('gunshot',{at:at.clone(),r}); }
/* you get hit */
function hurtPlayer(dmg,by){ if(LOOP.dying) return; INV.hp-=dmg; dmgFlash(); shake(.35); SND.play('oof_'+randi(1,2),{vol:.9}); VM.hurtT=.3; invHud(); if(INV.hp<=0) loopDie(by||'shot'); }
/* ---------- dynamite ---------- */
function throwDynamite(){ if(!takeItem('dynamite')) return; INV.cool=1; const from=camera.getWorldPosition(V3()), d=camera.getWorldDirection(V3());
  const g=gunMesh('dynamite'); g.position.copy(from).addScaledVector(d,.5); LV.scene.add(g); const v=d.clone().multiplyScalar(13).add(V3(0,4,0)); let t=0; SND.play('swing_1',{vol:.6});
  const fl=new THREE.PointLight(col(0xffa040),1.5,4,2); g.add(fl);
  const tk=dt=>{ t+=dt; if(t<3){ v.y-=13*dt; g.position.addScaledVector(v,dt); const gy=LV.ground(g.position.x,g.position.z)+.05; if(g.position.y<gy){ g.position.y=gy; v.multiplyScalar(.35); v.y=Math.abs(v.y)*.3; } g.rotation.x+=dt*6; fl.intensity=1+Math.random(); return; }
    SCENE_TICKS.splice(SCENE_TICKS.indexOf(tk),1); LV.scene.remove(g); explode(g.position.clone()); };
  SCENE_TICKS.push(tk); invHud(); }
function explode(at,r=6){ SND.play('explode',{vol:1,pos:at,ref:40}); flashWhite(.4,.1); const dd=Math.hypot(PLAYER.pos.x-at.x,PLAYER.pos.z-at.z); shake(clamp(1.4-dd/30,.1,1.4));
  const L=new THREE.PointLight(col(0xffa040),12,30,2); L.position.copy(at).add(V3(0,1,0)); LV.scene.add(L); later(.15,()=>LV.scene.remove(L));
  for(let i=0;i<60;i++) LV.soft.spawn(at.x,at.y+.5,at.z,rand(-4,4),rand(1,7),rand(-4,4),rand(1.2,2.6),rand(.5,1.4),.5,.42,.32,.7,0,.6,2.5);
  for(const h of shootTargets()){ const d=h.position.distanceTo(at); if(d<r) applyHit({person:h,head:d<r*.5,point:h.position.clone().add(V3(0,1,0))},120*(1-d/r)+20,'you'); }
  if(dd<r*.6) loopDie('blast'); else if(dd<r) hurtPlayer(60,'blast');
  gunNoise(at,200); emit('boom',at); }
/* ---------- using things ---------- */
function useItem(){ const it=curItem(); if(!it) return false;
  if(it.id==='bandage'){ if(INV.hp>=100){ toast('You\'re not hurt','#cfc2aa'); return true; } takeItem('bandage'); INV.hp=Math.min(100,INV.hp+55); SND.play('craft',{vol:.6}); toast('Patched up','#bfe8a8'); invHud(); return true; }
  if(it.id==='whiskey'){ takeItem('whiskey'); INV.hp=Math.min(100,INV.hp+20); SND.play('chew_1',{vol:.5,rate:.6}); blurScreen(.4); later(4,()=>blurScreen(0)); invHud(); return true; }
  if(it.id==='map'){ toast('The X is south of town, past the giant bones','#e8c27a'); return true; }
  if(it.id==='ledger'){ toast('"G. — Riders paid in gold. Hangar key: on me. Always." — Moe\'s handwriting','#e8c27a'); learn('ledger','You read Moe\'s ledger'); return true; }
  return false; }
/* keys + mouse while playing in Dustreach */
function gunKey(code){ const m=/^Digit([1-6])$/.exec(code); if(m){ selectSlot(+m[1]-1); return true; }
  if(code==='KeyQ'){ if(keys.ShiftLeft&&INV.sel>=0){ const s=INV.slots[INV.sel]; if(s&&!['core','fuel','nav'].includes(s.id)||s){ toast('Dropped '+ITEMS[s.id].name,'#cfc2aa'); INV.slots[INV.sel]=null; holster(); } } else holster(); return true; }
  return false; }
function gunPrimary(){ const it=curItem(); if(!it) return false; if(ITEMS[it.id].gun||it.id==='dynamite'){ fireGun(); return true; } return useItem(); }
window.addEventListener('wheel',e=>{ if(G.mode!=='play'||G.paused||!INPUT.locked||DLG.active) return; const filled=INV.slots.map((s,i)=>s?i:-1).filter(i=>i>=0); if(!filled.length) return;
  const cur=filled.indexOf(INV.sel); const nx=filled[(cur+(e.deltaY>0?1:-1)+filled.length)%filled.length]; if(nx!==INV.sel){ holster(); selectSlot(nx); } },{passive:true});
