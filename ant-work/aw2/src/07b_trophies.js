/* ================================================================
   TROPHIES — achievements, like Ant Work 1 had. Saved in this
   browser; a popup slides in when you earn one.
   ================================================================ */
const TROPHY_DEFS=[
  ['crumb','Crumb Watcher','Watch the ant eat the whole cookie crumb'],
  ['door',"Who's There?",'Open the door for Jim'],
  ['nag','Are You Coming or Not?','Make Jim ask you three times',true,"Don't open the door for Jim right away."],
  ['hatch','5-6-8-4','See Jim open the secret hatch'],
  ['shrunk','Honey, I Shrunk Me','Get shrunk by the shrink ray'],
  ['paparazzi','Paparazzi','Take 25 photos in the Tinyverse'],
  ['giant',"It's Massive",'Hide from the giant tardigrade'],
  ['naeg','Suit Up','Survive a Naegleria fowleri attack'],
  ['larry','Snack Delivery','Bring Larry 5 Paramecium snacks'],
  ['allSix','Full Album','Take pictures of all six creatures'],
  ['roommate','Roommates','Move into Mite Town with Larry'],
  ['miteHero','Mite Hero','Lead the giant tardigrade away from Mite Town'],
  ['deep','Deep Diver','Reach the dark zone of the Tinyverse'],
  ['ride','Hitchhiker',"Ride on Larry's Paramecium"],
  ['speedy','Speed Demon','Swim through 15 boost rings in the deep'],
  ['shopper','Window Shopper','Look at the snack market 5 times',true,'The snack market in Mite Town.'],
  ['chatter','Chatterbox','Talk to Larry 5 times in Mite Town',true,'Larry likes to talk.'],
  ['tinyEnd','The Tinyverse','Find the shrink-ray crystal shard'],
  ['secretLarry','Big Larry','Find the secret ending where Larry gets big',true,'NOHINT'],
  ['rocket','Liftoff!','Build the rocket on the moon'],
  ['firstAnt','Exterminator 2','Knock out your first alien bug'],
  ['chef','Master Chef','Cook a perfect batch of bug food'],
  ['burnt','Well Done. Too Well.','Burn a batch of bug food',true,'Too much heat in the Bug Cooker 3000.'],
  ['house','Homeowner','Buy a house on Mars'],
  ['computer','Alien Tech','Read your messages on the alien computer',true,'Check the computer in your first Mars house.'],
  ['ants10','Ant Stomper','Knock out 10 alien ants in one shift'],
  ['untouchable','Untouchable','Finish a shift without getting bitten'],
  ['dream','Bad Dream','Face Steve in the dream'],
  ['bigHouse','Upgrade','Buy the Dome Sweet Dome'],
  ['ratFriend','Rat Friend','Get the rat to bite you free'],
  ['eavesdrop','Eavesdropper','Listen at the locked door on Steve\'s ship',true,'A locked door in the hallway of the ship.'],
  ['idiot','YOU IDIOT','Knock over XXX5',true,"It says DON'T TOUCH."],
  ['miner','Block Puncher','Punch 20 blocks on blocky Earth',true,'Everything is blocks now. Try punching them.'],
  ['couch','Couch Potato','Watch every channel on the holo-TV',true,'The TV in the Dome Sweet Dome has 3 channels.'],
  ['emptyTank','Running on Empty','Use up all your jetpack fuel in the air',true,'Keep flying on Pluto until the fuel bar is empty.'],
  ['skyHigh','Sky High','Fly higher than 40 meters on Pluto',true,'How high can the jetpack go?'],
  ['goodBoy','Best Boy','Pet Jeff 10 times',true,'Jeff REALLY likes pets.'],
  ['rings','Rocket Person','Fly through every ring on Pluto'],
  ['jeff','Good Boy','Pet Jeff'],
  ['marsEnd','Mars Shift','Finish Mars Shift'],
  ['secretSteve','Steve Wins','Find the secret ending where Steve wins',true,'NOHINT'],
  ['secretJeff','Good Boy Forever','Find the secret ending where you save Jeff',true,'NOHINT'],
  ['both','Two Stories','Finish both stories'],
  ['funny','Is This the Same Game?','Turn on Funny mode',true,'Look in the Settings.'],
  ['dizzy','Dizzy','Spin around 5 times really fast',true,'Spin! Spin! Spin!'],
  ['partyAnimal','Party Animal','See 25 things go wrong in Funny mode',true,'Turn on Funny mode and just keep playing.'],
  ['bouncy','Bounce House','Jump 30 times in Funny mode',true,'Funny mode + the jump button.']
];
const TROPHY=Object.assign({},loadJSON('aw2_ach')||{});
const TSTAT=Object.assign({photos:0},loadJSON('aw2_ach_stats')||{});
let trophyQ=[], trophyShowing=false;
function unlock(id){
  if(TROPHY[id]) return; const def=TROPHY_DEFS.find(d=>d[0]===id); if(!def) return;
  TROPHY[id]=Date.now(); saveJSON('aw2_ach',TROPHY); trophyQ.push(def); showNextTrophy(); renderTrophies();
  if(id==='tinyEnd'||id==='marsEnd'){ if(TROPHY.tinyEnd&&TROPHY.marsEnd) later(4,()=>unlock('both')); }
}
function trophyStat(k,add=1){ TSTAT[k]=(TSTAT[k]||0)+add; saveJSON('aw2_ach_stats',TSTAT); return TSTAT[k]; }
function showNextTrophy(){
  if(trophyShowing||!trophyQ.length) return; trophyShowing=true;
  const [,title,desc]=trophyQ.shift(); $('achTitle').textContent=title; $('achDesc').textContent=desc;
  const el=$('achPop'); el.classList.add('show');
  if(AU.ok){ fm(784,.25,2,1,.08); fm(988,.25,2,1,.08,.12); fm(1319,.6,2,1,.09,.24); fm(1976,.7,3,1,.04,.36); }
  setTimeout(()=>{ el.classList.remove('show'); setTimeout(()=>{ trophyShowing=false; showNextTrophy(); },500); },3400);
}
function renderTrophies(){
  const got=TROPHY_DEFS.filter(d=>TROPHY[d[0]]).length;
  $('trophyCount').textContent=got?'('+got+'/'+TROPHY_DEFS.length+')':''; $('trophySum').textContent=got+' / '+TROPHY_DEFS.length;
  const box=$('trophyList'); box.innerHTML='';
  for(const [id,title,desc,secret,hint] of TROPHY_DEFS){ const g=!!TROPHY[id];
    const row=document.createElement('div'); row.className='trow'+(g?' got':'');
    row.innerHTML='<span class="ic">'+(g?'🏆':'🔒')+'</span><span><b></b><small></small></span>';
    row.querySelector('b').textContent=(!g&&secret)?'???':title; row.querySelector('small').textContent=(!g&&secret)?(hint==='NOHINT'?'Secret ending. No hints.':'Secret trophy. Hint: '+(hint||'Keep playing to find it.')):desc;
    box.appendChild(row); }
}
function openTrophies(){ renderTrophies(); $('trophies').classList.add('show'); SFX.uiOpen(); setTimeout(()=>$('trophyClose').focus(),30); }
function closeTrophies(){ $('trophies').classList.remove('show'); SFX.uiBack(); }
$('btnTrophies').onclick=openTrophies; $('pTrophies').onclick=openTrophies; $('trophyClose').onclick=closeTrophies;
renderTrophies();

/* secret trophy watchers */
const SPIN={acc:0,t:0,last:null};
on('tick',()=>{ if(G.mode!=='play'||!LV) return; const y=PLAYER.yaw; if(SPIN.last!=null){ let d=y-SPIN.last; SPIN.acc+=d; } SPIN.last=y; SPIN.t+=G.dt||.016; if(SPIN.t>6){ SPIN.t=0; SPIN.acc=0; } if(Math.abs(SPIN.acc)>Math.PI*10) unlock('dizzy'); });

