/* ================================================================
   DRY GULCH — the people (talk to everyone: every choice matters, and
   what you tell WHO matters most), the shop, the locked doors (each key
   fits one door), the Hollow Riders (sundown), hiding, sleeping.
   ================================================================ */
Object.assign(WHO_CLASS,{Moe:'jim',Abe:'jim',Doc:'jim',Tobias:'jim',Rook:'jim',Hank:'jim',Mort:'jim',Lucky:'jim',Amos:'jim',Ned:'jim',Bob:'jim',Rider:'pig',Gideon:'pig',Surv:'jim'});
Object.assign(WHO_NAME,{Moe:'MOE',Abe:'SHERIFF ABE WALKER',Doc:'DOC BISHOP',Tobias:'OLD TOBIAS',Rook:'GRANDPA ROOK',Hank:'HANK (GUNS)',Mort:'MORTIMER (UNDERTAKER)',Lucky:'LUCKY',Amos:'BROTHER AMOS',Ned:'NED (HOTEL)',Bob:'BOB',Rider:'HOLLOW RIDER',Gideon:'GOLD TOOTH GIDEON',Surv:'SURVIVOR'});
const NPC_DEF={
  moe:  {who:'Moe', hum:{skin:0xd8a080,shirt:0xe0d8c8,pants:0x3a3028,hair:0x2a1a10,beard:true,build:1.38,apron:0xe8e0d0,mood:'happy',seed:41},cow:{hat:false,goldTooth:true,mustache:0x2a1a10},at:()=>inB('saloon',.84,.1),face:()=>inB('saloon',.3,.1),hp:300,trust:false},
  abe:  {who:'Abe', hum:{skin:0xd8a888,shirt:0x6a5a48,pants:0x3a3028,hair:0xe8e8e0,beard:false,build:1.05,mood:'tired',seed:42},cow:{hatCol:0x3a2a1a,coat:0x6a5644,star:true,mustache:0xf0f0e8,gun:true},at:()=>inB('sheriff',.42,-.4),hp:140,trust:true},
  doc:  {who:'Doc', hum:{skin:0xe0b090,shirt:0xe8e0d0,pants:0x2a2a30,hair:0x6a6a6a,build:.92,mood:'tired',seed:43},cow:{hatCol:0x1a1a1a,vest:0x2a2a3a},at:()=>inB('doc',.45,.1),hp:100,trust:true},
  tobias:{who:'Tobias',hum:{skin:0xb88060,shirt:0x5a4a3a,pants:0x2a2420,hairStyle:'bald',beard:true,hair:0x9a9a90,build:1.1,seed:44,apron:0x4a3020},cow:{hat:false,eyepatch:true,metalHand:true},at:()=>inB('tobias',.55,.25),hp:120,trust:true},
  rook: {who:'Rook', hum:{skin:0xc89070,shirt:0x9a4a3a,pants:0x5a4a3a,hair:0xf0ece0,beard:true,build:.9,mood:'happy',seed:45},cow:{hatCol:0x7a6a50},at:()=>V3(-12.6,.25,-30),hp:80,trust:true},
  hank: {who:'Hank', hum:{skin:0xe0b090,shirt:0xc8b898,pants:0x3a3028,hair:0x6a4a2a,build:1.1,seed:46},cow:{hatCol:0x4a3a2a,vest:0x3a2a1a,mustache:0x5a3a20},at:()=>inB('store',.42,0),hp:100,trust:false},
  mort: {who:'Mort', hum:{skin:0xd8c0b0,shirt:0x1a1a1a,pants:0x111111,hair:0x2a2a2a,build:.86,height:1.08,mood:'tired',seed:47},cow:{hatCol:0x0e0e0e,coat:0x141414},at:()=>inB('undertaker',.3,-.3),hp:100,trust:true},
  lucky:{who:'Lucky', hum:{skin:0xe0b898,shirt:0xe8e0d8,pants:0x2a1a1a,hair:0x1a1410,build:.95,mood:'happy',seed:48},cow:{hatCol:0x111111,vest:0x8a1a1a,mustache:0x1a1410,gun:true},at:()=>inB('saloon',.25,-.6).add(V3(0,0,1.2)),hp:100,trust:false},
  amos: {who:'Amos', hum:{skin:0x8a5a3a,shirt:0x1a1a1a,pants:0x111111,hair:0x2a1a10,build:1.0,mood:'happy',seed:49,collar:true},cow:{hatCol:0x111111,wide:1.15,coat:0x161616},at:()=>inB('church',.85,0),hp:100,trust:false},
  ned:  {who:'Ned', hum:{skin:0xe8c0a0,shirt:0x6a7a5a,pants:0x3a3a30,hair:0xa0a0a0,hairStyle:'bald',build:1.2,seed:50},cow:{hat:false,vest:0x4a5a3a},at:()=>inB('hotel',.25,.6),hp:90,trust:true},
  surv: {who:'Surv', hum:{skin:0xb08060,shirt:0x7a6a50,pants:0x4a3a2a,hair:0x3a2a1a,beard:true,build:.9,mood:'tired',seed:51},cow:{hatCol:0x8a7a60},at:()=>DUST.camp.clone().add(V3(3,0,4)),hp:90,trust:true}};
const NPC={};       // id -> human (this loop)
function makeNPC(id){ const D=NPC_DEF[id]; const h=makeHuman(Object.assign({name:WHO_NAME[D.who],voice:D.who},D.hum)); cowboy(h,D.cow||{});
  h.userData.level='dust'; h.userData.hp=D.hp; h.userData.who=WHO_NAME[D.who]; h.userData.npc=id; h.userData.loot={gold:randi(1,4)};
  h.userData.onDie=by=>{ F.dead=F.dead||{}; F.dead[id]=1; if(by==='you'&&id!=='moe'){ F.townHates=(F.townHates||0)+1; toast('The town saw that.','#ff8a7a'); } };
  LEVELS.dust.scene.add(h); NPC[id]=h; return h; }
function placeNPCs(){ for(const id in NPC_DEF){ let h=NPC[id]; if(!h) h=makeNPC(id); resetActor(h); h.userData.hp=NPC_DEF[id].hp; h.userData.dead=false; h.userData.searched=false; clearPose(h,0);
    const p=NPC_DEF[id].at(); h.position.set(p.x,LEVELS.dust.ground(p.x,p.z),p.z); faceTo(h,NPC_DEF[id].face?NPC_DEF[id].face():V3(0,0,p.z)); h.visible=!(F.dead&&F.dead[id]); }
  setPose(NPC.lucky,'cards',0); if(NPC.hank) setPose(NPC.hank,'hips',0); }
/* they look at you when you're close */
on('tick',dt=>{ if(!LV||LV.name!=='dust') return; for(const id in NPC){ const h=NPC[id]; if(!h.visible||h.userData.dead) continue; const d=Math.hypot(h.position.x-PLAYER.pos.x,h.position.z-PLAYER.pos.z); if(!h.userData.A.path) h.userData.A.look=d<5?'player':null; } });
function talkable(id,topicsFn){ const h=NPC[id]; addInteract(LEVELS.dust,{obj:h,offset:V3(0,1.5,0),reach:2.6,label:'Talk to '+WHO_NAME[NPC_DEF[id].who].split(' (')[0].replace('SHERIFF ','Sheriff ').toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase()),when:()=>h.visible&&!h.userData.dead&&!NIGHT4.on,act:()=>talkTo(id,topicsFn)}); }
async function talkTo(id,topicsFn){ const h=NPC[id]; PLAYER.lock(); PLAYER.ctl.look=true; h.userData.A.look='player'; faceTo(h,PLAYER.pos); lookAtPoint(headOf(h),.4);
  for(;;){ const opts=topicsFn().filter(o=>!o.when||o.when()); opts.push({text:'Bye',bye:true}); const o=await choose(opts.map(x=>({text:x.text,x}))); const x=o.x||o; if(x.bye) break;
    if(x.say) await say(x.say); if(x.act){ const r=await x.act(); if(r==='end') break; } if(x.once) F['t_'+x.once]=1; }
  freeWalk(); PLAYER.ctl.jump=true; }
function said(k){ return !!F['t_'+k]; }
/* telling a secret: who you tell decides who betrays you */
function tell(id,what){ LOOP.told[id]=what; saveLoop(); F.told=F.told||{}; F.told[id]=what; if(!NPC_DEF[id].trust) F.betrayer=F.betrayer||id; }
/* ---------- the topics ---------- */
const TOPICS={
  moe:()=>[
    {text:'About the roof...',when:()=>!F.roofPaid,say:['m_job'],act:()=>{ if(F.errCrate&&F.errLucky&&F.errAbe){ F.roofPaid=1; return say(['m_paid']).then(()=>{ giveGold(5); giveAmmo('bullets',6); objective(''); }); } }},
    {text:'Who are the Hollow Riders?',when:()=>!said('mr'),once:'mr',say:['j_riders','m_riders','m_riders2']},
    {text:"What's under that trapdoor?",when:()=>!said('mc'),once:'mc',say:['j_trap','m_trap'],act:()=>{ F.moeSus=(F.moeSus||0)+1; }},
    {text:'Tell him about the buried ship',when:()=>knows('ship')&&!F.told?.moe,say:['j_tellship','m_tellship'],act:()=>{ tell('moe','ship'); F.moeKnowsShip=1; }},
    {text:'"I know who you are... Gideon."',when:()=>knows('moeGideon'),say:['j_gideon','m_gideon'],act:async()=>{ setPose(NPC.moe,'aim',.2); await wait(.6); SND.play('gun_shotgun',{vol:1}); learn('dontSayIt','Don\'t say that to his face. Not alone.'); loopDie('shot'); return 'end'; }}],
  abe:()=>[
    {text:'Moe says: the Riders are coming tonight',when:()=>!F.errAbe&&F.job,say:['j_warn','a_warn'],act:()=>{ F.errAbe=1; errandCheck(); }},
    {text:'Who is Gideon?',when:()=>!said('ag'),once:'ag',say:['j_gid','a_gid','a_gid2'],act:()=>learn('goldTeeth','Gideon has GOLD TEETH')},
    {text:'What about the spaceport?',when:()=>!said('ap'),once:'ap',say:['j_port','a_port']},
    {text:'"Moe is Gideon." (show the proof)',when:()=>knows('moeGideon')&&(hasItem('mask')||hasItem('ledger'))&&!F.abeAlly,say:['j_moe','a_believe'],act:()=>{ F.abeAlly=1; learn('abeAlly','Sheriff Abe believes you (with proof)'); }},
    {text:'"Moe is Gideon." (no proof)',when:()=>knows('moeGideon')&&!hasItem('mask')&&!hasItem('ledger')&&!F.abeAlly,say:['j_moe','a_doubt'],act:()=>{ tell('abe','moe'); F.abeTold=1; }},
    {text:'Tell him about the buried ship',when:()=>knows('ship')&&!F.told?.abe,say:['j_tellship','a_ship'],act:()=>tell('abe','ship')}],
  doc:()=>[
    {text:'Here\'s the whiskey from Moe',when:()=>hasItem('crate'),say:['j_crate','d_crate'],act:()=>{ takeItem('crate'); F.errCrate=1; F.docDrunk=1; giveItem('bandage',2); errandCheck(); }},
    {text:'Anything strange about Moe?',when:()=>F.docDrunk&&!said('dm'),once:'dm',say:['j_moeq','d_moe','d_moe2'],act:()=>learn('cellarKey','The cellar key: on a nail behind the saloon mirror')},
    {text:'Patch me up (2 gold)',when:()=>INV.hp<100&&INV.gold>=2,act:()=>{ giveGold(-2); INV.hp=100; invHud(); return say(['d_heal']); }},
    {text:'Tell him about the ship',when:()=>knows('ship')&&!F.told?.doc,say:['j_tellship','d_trust'],act:()=>tell('doc','ship')}],
  tobias:()=>[
    {text:'Can you fix a ship?',when:()=>knows('ship')&&!said('ts'),once:'ts',say:['j_fix','t_ship','t_ship2'],act:()=>learn('parts','The ship needs: a POWER CORE (mine), FUEL (train/spaceport), a NAV BRAIN (Tobias, 10 gold)')},
    {text:'Build the nav brain (10 gold)',when:()=>knows('parts')&&!F.navAt&&!hasItem('nav')&&!F.navIn,act:()=>{ if(INV.gold<10) return say(['t_broke']); giveGold(-10); F.navAt=DAY.hour+2+(DAY.day-1)*24; return say(['t_build']); }},
    {text:'Take the nav brain',when:()=>F.navAt&&DAY.hour+(DAY.day-1)*24>=F.navAt&&!hasItem('nav')&&!F.navIn,act:()=>{ if(giveItem('nav')){ F.navAt=0; return say(['t_done']); } }},
    {text:'Your hand...?',when:()=>!said('th'),once:'th',say:['j_hand','t_hand'],act:()=>learn('mineThing','Something LIVES in the mine. Bring light.')},
    {text:'Where do I get dynamite?',when:()=>!said('td'),once:'td',say:['j_dyn','t_dyn'],act:()=>learn('backroomKey','The back room key is with the undertaker (Hank\'s dead brother had it)')},
    {text:'Tell him about the ship',when:()=>knows('ship')&&!F.told?.tobias,say:['j_tellship','t_trust'],act:()=>tell('tobias','ship')}],
  rook:()=>[
    {text:'You okay, old timer?',when:()=>!said('rk'),once:'rk',say:['r_1','r_2']},
    {text:'"I believe you. Where\'s the ship?"',when:()=>said('rk')&&!hasItem('map')&&!F.rookMap,say:['j_believe','r_map'],act:()=>{ F.rookMap=1; giveItem('map'); learn('ship','There IS a ship: buried south of town, past the giant bones'); }},
    {text:'Help us dig it out',when:()=>knows('ship')&&!F.rookDig&&!F.shipDug,say:['j_dig','r_dig'],act:()=>{ F.rookDig=DAY.hour+3+(DAY.day-1)*24; rookGoDig(); }},
    {text:'Tell him about Moe',when:()=>knows('moeGideon')&&!F.told?.rook,say:['j_moe','r_moe'],act:()=>tell('rook','moe')}],
  hank:()=>[
    {text:'Buy a revolver (8 gold)',when:()=>!hasItem('revolver'),act:()=>buy('revolver',8)},
    {text:'Buy a shotgun (12 gold)',when:()=>!hasItem('shotgun'),act:()=>buy('shotgun',12)},
    {text:'Buy a rifle (15 gold)',when:()=>!hasItem('rifle'),act:()=>buy('rifle',15)},
    {text:'Bullets x6 (2 gold)',act:()=>buyAmmo('bullets',6,2)},{text:'Shells x4 (2 gold)',act:()=>buyAmmo('shells',4,2)},{text:'Rifle rounds x5 (3 gold)',act:()=>buyAmmo('rounds',5,3)},
    {text:'Bandages x2 (2 gold)',act:()=>buy('bandage',2,2)},{text:'A shovel (3 gold)',when:()=>!hasItem('shovel'),act:()=>buy('shovel',3)},{text:'A lantern (2 gold)',when:()=>!hasItem('lantern'),act:()=>buy('lantern',2)},
    {text:"What's in the back room?",when:()=>!said('hb'),once:'hb',say:['j_back','h_back']},
    {text:'Tell him about the ship',when:()=>knows('ship')&&!F.told?.hank,say:['j_tellship','h_ship'],act:()=>tell('hank','ship')}],
  mort:()=>[
    {text:'Are you... measuring us?',when:()=>!said('mm'),once:'mm',say:['o_1']},
    {text:'"Hank\'s brother had a key..."',when:()=>knows('backroomKey')&&!INV.keys.backroom,say:['j_key','o_key'],act:async()=>{ const r=await choose([{text:'Help him carry the coffin (1 hour)'},{text:'Not now'}]); if(r.text.startsWith('Help')){ await timeSkip(1); giveKey('backroom'); await say(['o_thanks']); } }},
    {text:'Tell him about the ship',when:()=>knows('ship')&&!F.told?.mort,say:['j_tellship','o_ship'],act:()=>tell('mort','ship')}],
  lucky:()=>[
    {text:'Moe wants his money',when:()=>F.job&&!F.errLucky,say:['j_debt','l_debt'],act:async()=>{ const r=await choose([{text:'Threaten him'},{text:'Call his cheat (the ace up his sleeve)'},{text:'Let it go'}]);
      if(r.text.startsWith('Threaten')){ await say(['j_threat','l_scared']); giveGold(5); F.luckyHates=1; }
      else if(r.text.startsWith('Call')){ await say(['j_ace','l_ace']); giveKey('caboose'); learn('caboose','The caboose safe key came from Lucky'); }
      else { await say(['j_letgo','l_thanks']); learn('train','The train carries something for Moe in the caboose safe'); }
      F.errLucky=1; errandCheck(); }},
    {text:'Tell him about the ship',when:()=>knows('ship')&&!F.told?.lucky,say:['j_tellship','l_ship'],act:()=>tell('lucky','ship')},
    {text:'Tell him about Moe',when:()=>knows('moeGideon')&&!F.told?.lucky,say:['j_moe','l_moe'],act:()=>tell('lucky','moe')}],
  amos:()=>[
    {text:'Is anywhere safe at night?',when:()=>!said('as'),once:'as',say:['j_safe','p_safe'],act:()=>learn('tower','Hide in the church bell tower at night')},
    {text:'Tell him about the ship',when:()=>knows('ship')&&!F.told?.amos,say:['j_tellship','p_ship'],act:()=>tell('amos','ship')},
    {text:'Tell him about Moe',when:()=>knows('moeGideon')&&!F.told?.amos,say:['j_moe','p_moe'],act:()=>tell('amos','moe')}],
  ned:()=>[
    {text:'Rent a room (1 gold)',when:()=>!F.room&&INV.gold>=1,act:()=>{ giveGold(-1); F.room=1; return say(['n_room']); }},
    {text:'Sleep till morning',when:()=>F.room&&(DAY.hour>=19||DAY.hour<5),act:()=>{ sleepNight(); return 'end'; }}],
  surv:()=>[
    {text:'Who are you?',when:()=>!said('sv'),once:'sv',say:['s_1','s_2']},
    {text:'The giant bones?',when:()=>!said('sb'),once:'sb',say:['s_bones']},
    {text:'Trade: 2 bandages for 2 gold',when:()=>INV.gold>=2,act:()=>{ giveGold(-2); giveItem('bandage',2); }}]};
function buy(id,cost,n=1){ if(INV.gold<cost) return say(['h_broke']); if(giveItem(id,n)){ giveGold(-cost); if(ITEMS[id].gun){ const s=INV.slots.find(s=>s&&s.id===id); s.loaded=ITEMS[id].mag; invHud(); } } }
function buyAmmo(k,n,cost){ if(INV.gold<cost) return say(['h_broke']); giveGold(-cost); giveAmmo(k,n); }
function errandCheck(){ if(F.errCrate&&F.errLucky&&F.errAbe&&!F.roofPaid) objective('Go back to Moe (the roof is paid)'); }
async function timeSkip(h){ const fd=$('fade'); fd.style.transition='opacity .6s'; fd.style.opacity=1; await wait(.7); DAY.hour+=h; await wait(.4); fd.style.opacity=0; }
function rookGoDig(){ const h=NPC.rook; walkTo(h,[V3(0,0,-20),V3(0,0,120),DUST.ship.clone().add(V3(-10,0,-8))],1.6); later(30,()=>{ if(!h.userData.dead){ h.position.copy(DUST.ship.clone().add(V3(-10,0,-8))); setPose(h,'dig',.4); } }); }
/* ---------- locked doors: every key fits ONE door ---------- */
function setupDoors(){ const lv=LEVELS.dust;
  addInteract(lv,{pos:lv.trapPos.clone().add(V3(0,.2,0)),reach:2,label:()=>INV.keys.cellar?'Open the trapdoor (cellar key)':'Trapdoor (locked)',act:()=>{ if(!INV.keys.cellar){ SND.play('metal_04',{vol:.4,rate:.8}); toast('Locked. It needs its own key.','#ff9a7a'); return; } enterCellar(); }});
  addInteract(lv,{pos:inB('saloon',.97,.55,1.6),reach:2.2,label:'Look behind the mirror',when:()=>knows('cellarKey')&&!INV.keys.cellar,act:()=>{ if(NPC.moe.visible&&!NPC.moe.userData.dead&&Math.hypot(NPC.moe.position.x-PLAYER.pos.x,NPC.moe.position.z-PLAYER.pos.z)<6&&!F.moeAway){ say(['m_caught']); F.moeSus=(F.moeSus||0)+2; if(F.moeSus>=3){ later(2,()=>{ SND.play('gun_shotgun',{vol:1}); loopDie('shot'); }); } return; } giveKey('cellar'); }});
  addInteract(lv,{pos:inB('store',.92,.85,1),reach:2.2,label:()=>INV.keys.backroom?'Open the back room (back room key)':'Back room (locked)',when:()=>!F.backOpen,act:()=>{ if(!INV.keys.backroom){ toast('Locked. It needs its own key.','#ff9a7a'); return; } F.backOpen=1; SND.play('door_creak',{vol:.6}); giveItem('dynamite',3); giveAmmo('shells',4); }});
  addInteract(lv,{pos:lv.cell.clone().add(V3(0,1,-1)),reach:2.2,label:'Hide in the jail cell',when:()=>NIGHT4.on,act:()=>hideIn('cell')});
  addInteract(lv,{pos:inB('church',.15,0,1),reach:2.5,label:'Climb up to the bell tower (hide)',when:()=>NIGHT4.on||knows('tower'),act:()=>hideIn('tower')});
  addInteract(lv,{pos:inB('hotel',.5,.6,1),reach:2.5,label:'Go to your room (hide)',when:()=>F.room&&NIGHT4.on,act:()=>hideIn('room')});
  addInteract(lv,{obj:lv.mineDoor,offset:V3(0,2,1),reach:5,label:'Go into the old mine',act:()=>runStory(()=>SCENES.mine())});
  for(const id in TOPICS) if(NPC[id]) talkable(id,TOPICS[id]);
}
async function enterCellar(){ const lv=LEVELS.dust; PLAYER.lock(); SND.play('door_creak',{vol:.7,rate:.8}); const fd=$('fade'); fd.style.transition='opacity .4s'; fd.style.opacity=1; await wait(.5);
  lv.inCellar=true; lv.cellarL.intensity=2.2; setPlayer(lv.trapPos.clone().add(V3(-B_('saloon').s*1,lv.cellar.y+.1,0)),0); PLAYER.y=lv.cellar.y+.1; fd.style.opacity=0; freeWalk();
  if(!F.cellarSeen){ F.cellarSeen=1; await wait(.6); PLAYER.lock(); PLAYER.ctl.look=true; lookAtPoint(lv.masks.position,.7); SND.play('heartbeat',{vol:.6}); await say(['j_masks','j2_masks']); learn('moeGideon','MOE IS GIDEON. The Hollow Rider masks are in his cellar.'); freeWalk(); }
  const take=(o,id,label)=>addInteract(lv,{obj:o,reach:2.2,label,when:()=>lv.inCellar&&!hasItem(id),act:()=>giveItem(id)});
  take(lv.masks,'mask','Take a mask (proof)'); take(lv.ledger,'ledger','Take the ledger');
  addInteract(lv,{pos:lv.trapPos.clone().add(V3(0,lv.cellar.y+1.5,0)),reach:2.5,label:'Climb back up',when:()=>lv.inCellar,act:async()=>{ fd.style.opacity=1; await wait(.4); lv.inCellar=false; lv.cellarL.intensity=0; setPlayer(lv.trapPos.clone().add(V3(-B_('saloon').s*1.2,.2,0)),0); fd.style.opacity=0; }}); }
/* ---------- the night: the Hollow Riders ---------- */
const NIGHT4={on:false,hidden:null,riders:[],gideon:null};
function hideIn(where){ NIGHT4.hidden=where; const lv=LEVELS.dust; PLAYER.lock(); const fd=$('fade'); fd.style.transition='opacity .5s'; fd.style.opacity=1;
  later(.6,()=>{ const p=where==='tower'?inB('church',.15,0):where==='cell'?lv.cell.clone().add(V3(0,0,-1.4)):inB('hotel',.5,.6); setPlayer(p,0); if(where==='tower'){ PLAYER.y=B_('church').h+3; } fd.style.opacity=0; freeWalk(); toast('Hidden. Stay still and quiet... (move = leave)','#cfc2aa'); NIGHT4.hidePos=PLAYER.pos.clone(); }); }
function makeRider(o={}){ const h=makeHuman({name:'Hollow Rider',voice:'Rider',skin:pick([0xd8a888,0xb88060,0xe0b898,0x8a5a3a]),shirt:pick([0x2a2420,0x3a3028,0x1e1a16]),pants:0x1e1a16,hair:0x1a1410,build:rand(1,1.2),seed:randi(1,9999)});
  cowboy(h,{hatCol:0x15120e,mask:0x101010,coat:pick([0x2a2420,0x1a1612]),gun:true});
  Object.assign(h.userData,{level:'dust',hp:100,who:'the Rider',loot:{bullets:randi(2,6),gold:randi(0,2)},rider:Object.assign({state:'hunt',t:0,shootT:rand(1.2,2.2),last:null,seeT:0,acc:.7},o)}); LV.scene.add(h); NIGHT4.riders.push(h); return h; }
const _eye=new THREE.Vector3(), _toR=new THREE.Vector3(), _rcN=new THREE.Raycaster();
function canSee(h,target,maxD=75){ const d=Math.hypot(h.position.x-target.x,h.position.z-target.z); if(d>maxD) return false; _eye.copy(h.position).add(V3(0,1.6,0)); _toR.copy(target).sub(_eye); const L=_toR.length(); _rcN.set(_eye,_toR.normalize()); _rcN.far=L-.3; return _rcN.intersectObjects(LV.occluders||[],false).length===0; }
function riderTick(dt){ if(!LV) return; const camP=camera.getWorldPosition(V3());
  const J2=CUR.j2;
  for(const h of NIGHT4.riders){ const U=h.userData, R=U.rider; if(U.dead||!h.visible||U.level!==LV.name) continue; R.t+=dt;
    const hidden=NIGHT4.hidden&&PLAYER.pos.distanceTo(NIGHT4.hidePos||PLAYER.pos)<.6;
    const sees=!hidden&&canSee(h,camP,R.range||75);
    if(sees){ R.seeT+=dt; R.state='attack'; R.last=PLAYER.pos.clone(); U.A.path=null; faceTo(h,PLAYER.pos); setPose(h,'aim',.2); U.A.look='player';
      R.shootT-=dt; if(R.shootT<=0&&R.seeT>.6){ R.shootT=rand(1.2,2.1); riderShoot(h,'player'); } }
    else { R.seeT=0; if(J2&&J2.visible&&!J2.userData.dead&&R.state!=='attack'&&canSee(h,J2.position.clone().add(V3(0,1.4,0)),45)&&Math.random()<dt*.5){ faceTo(h,J2.position); setPose(h,'aim',.2); riderShoot(h,'jay2'); }
      if(R.state==='attack'){ R.state='search'; R.t=0; clearPose(h,.3); if(R.last) walkTo(h,[outdoors(R.last)],2.8); }
      else if(R.state==='search'&&R.t>9){ R.state='hunt'; R.t=0; }
      else if(R.state==='hunt'&&!U.A.path&&!R.guard){ R.t=0; const tgt=hidden?V3(rand(-10,10),0,rand(-60,90)):PLAYER.pos.clone().add(V3(rand(-14,14),0,rand(-14,14))); walkTo(h,[outdoors(tgt)],rand(1.6,2.6)); }
      else if(R.guard&&!U.A.path&&R.t>6){ R.t=0; walkTo(h,[R.guard.clone().add(V3(rand(-8,8),0,rand(-8,8)))],1.2); } } } }
function outdoors(p){ const b=insideB(p.x,p.z); if(!b) return p.clone(); return V3(b.s*(DUST.street-1),0,b.z); }
function riderShoot(h,who){ const U=h.userData, R=U.rider; const hand=U.J.hdR.getWorldPosition(V3()); SND.play('gun_revolver2',{vol:.9,pos:hand,ref:25,rate:rand(.9,1.08)}); muzzleFlash(hand);
  if(who==='jay2'){ const J2=CUR.j2; J2.userData.hp=(J2.userData.hp==null?160:J2.userData.hp)-(Math.random()<.35?55:0); if(J2.userData.hp<=0){ killPerson(J2,'rider'); loopDie('jay2'); } return; }
  const d=Math.hypot(h.position.x-PLAYER.pos.x,h.position.z-PLAYER.pos.z), moving=PLAYER.vel&&Math.hypot(PLAYER.vel.x,PLAYER.vel.z)>2;
  const p=clamp(R.acc-d/95-(moving?.22:0)-(PLAYER.crouch?.1:0),.08,.8);
  if(Math.random()<p) hurtPlayer(rand(48,62),'shot'); else { SND.play('hit_01',{vol:.4,rate:rand(1.6,2.2)}); LV.soft.spawn(PLAYER.pos.x+rand(-1,1),.2,PLAYER.pos.z+rand(-1,1),0,1,0,.5,.2,.7,.6,.5,.6,0,.3,1.2); } }
on('tick',dt=>{ if(NIGHT4.riders.length) riderTick(dt); if(NIGHT4.hidden&&NIGHT4.hidePos&&PLAYER.pos.distanceTo(NIGHT4.hidePos)>1.2){ NIGHT4.hidden=null; toast('You left your hiding spot','#ff9a7a'); } });
on('gunshot',e=>{ for(const h of NIGHT4.riders){ const R=h.userData.rider; if(h.userData.dead) continue; if(h.position.distanceTo(e.at)<e.r&&R.state!=='attack'){ R.state='search'; R.t=0; walkTo(h,[outdoors(e.at)],2.8); } } });
function clearRiders(){ for(const h of NIGHT4.riders){ h.parent&&h.parent.remove(h); const i=HUMANS.indexOf(h); if(i>=0) HUMANS.splice(i,1); } NIGHT4.riders=[]; }
