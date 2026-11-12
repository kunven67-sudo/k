/* ================================================================
   TROPHIES (ANT WORK 3) — saved in this browser, shown with the kit's
   look, and told to Game System 3 when the game runs inside it.
   ================================================================ */
const TROPHY_DEFS=[
  ['meet','Are You... Me?','Meet the other you','bronze'],
  ['talker','Say Everything','Say every line you could say to Jay 2','silver'],
  ['fighter','Who Hits Harder','Fight the other you','bronze'],
  ['perfect','Clean Hands','Win the fight without getting hit','gold',true,'Time every punch and every block.'],
  ['light','Into the Light','Get blown into the wall','bronze'],
  ['static','No Signal','Try to call Jim from the desert','bronze'],
  ['pyramid','Dusty','Walk into the pyramid','bronze'],
  ['paintings','Art Critic','Look at every painting in the pyramid','silver',true,'The paintings on the walls. All of them.'],
  ['fruit','Bad Idea','Eat the glowing fruit','bronze'],
  ['chained','Oink','Wake up in the pig room','silver'],
  ['part1','Part One','Finish Part One of Ant Work 3','gold'],
  ['mantis','Praying For You','Beat the mantis','silver'],
  ['spiderWin','For Orrin','Beat the tarantula','silver'],
  ['scorpionWin','Sting Operation','Beat the scorpion','gold'],
  ['part2','The Key','Get the key out of the bowl','gold'],
  ['escape','Off The Table','Escape the pig king','gold']
];
const TROPHY=Object.assign({},loadJSON('aw3_ach')||{});
const TSTAT=Object.assign({},loadJSON('aw3_ach_stats')||{});
let trophyQ=[], trophyShowing=false;
/* tell Game System 3 about them (does nothing outside it) */
if(window.GameSystem&&GameSystem.trophies){ try{ GameSystem.trophies(TROPHY_DEFS.map(d=>({id:d[0],name:d[1],desc:d[2],grade:d[3]||'bronze',hidden:!!d[4]}))); }catch(e){} }
function unlock(id){
  if(TROPHY[id]) return; const def=TROPHY_DEFS.find(d=>d[0]===id); if(!def) return;
  TROPHY[id]=Date.now(); saveJSON('aw3_ach',TROPHY); renderTrophies();
  if(window.GameSystem&&GameSystem.unlock){ try{ GameSystem.unlock(id); return; }catch(e){} }   // the console shows its own pop-up
  trophyQ.push(def); showNextTrophy();
}
function trophyStat(k,add=1){ TSTAT[k]=(TSTAT[k]||0)+add; saveJSON('aw3_ach_stats',TSTAT); return TSTAT[k]; }
function showNextTrophy(){
  if(trophyShowing||!trophyQ.length) return; trophyShowing=true;
  const [,title,desc]=trophyQ.shift();
  toast('TROPHY · '+title,'#e0c08a');
  if(AU.ok){ fm(784,.25,2,1,.08); fm(988,.25,2,1,.08,.12); fm(1319,.6,2,1,.09,.24); }
  setTimeout(()=>{ trophyShowing=false; showNextTrophy(); },2200);
}
function renderTrophies(){
  const got=TROPHY_DEFS.filter(d=>TROPHY[d[0]]).length;
  $('trophyCount').textContent=got?(got+'/'+TROPHY_DEFS.length):''; $('trophySum').textContent=got+' / '+TROPHY_DEFS.length;
  const box=$('trophyList'); box.innerHTML='';
  for(const [id,title,desc,grade,secret,hint] of TROPHY_DEFS){ const g=!!TROPHY[id];
    const row=document.createElement('div'); row.className='trow'+(g?' got':'');
    row.innerHTML='<span class="ic"></span><span><b></b><small></small></span>';
    row.querySelector('b').textContent=(!g&&secret)?'???':title; row.querySelector('small').textContent=(!g&&secret)?('Secret. Hint: '+(hint||'Keep playing.')):desc;
    box.appendChild(row); }
}
function openTrophies(from){ renderTrophies(); openModal('trophies',{back:()=>closeTrophies(from),first:$('trophyClose')}); TROPHY.from=from; }
function closeTrophies(from){ closeModal('trophies'); SFX.uiBack(); if((from||TROPHY.from)==='pause') openModal('pause',{back:resumeGame,first:$('pResume')}); }
$('btnTrophies').onclick=()=>openTrophies('title'); $('pTrophies').onclick=()=>openTrophies('pause'); $('trophyClose').onclick=()=>closeTrophies();
renderTrophies();
