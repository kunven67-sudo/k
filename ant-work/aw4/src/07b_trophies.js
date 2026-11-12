/* ================================================================
   TROPHIES (ANT WORK 4) — saved in this browser, shown with the kit's
   look, and told to Game System 3 when the game runs inside it.
   ================================================================ */
const TROPHY_DEFS=[
  ['firstReturn','Oh.','Die for the first time on Dustreach','bronze'],
  ['tenLoops','Groundhog Gulch','Come back 10 times','silver'],
  ['shipReady','Sky-Metal','Get the buried ship ready','gold'],
  ['bob','Old Friend','Bob saved you','gold'],
  ['duel','High Noon (At Sundown)','Win the duel','gold'],
  ['alone','Not How It Happened','Leave Jay 2 behind','bronze',1],
  ['aw4end','Off Dustreach','Finish Ant Work 4','platinum']
];
const TROPHY=Object.assign({},loadJSON('aw4_ach')||{});
const TSTAT=Object.assign({},loadJSON('aw4_ach_stats')||{});
let trophyQ=[], trophyShowing=false;
/* tell Game System 3 about them (does nothing outside it) */
if(window.GameSystem&&GameSystem.trophies){ try{ GameSystem.trophies(TROPHY_DEFS.map(d=>({id:d[0],name:d[1],desc:d[2],grade:d[3]||'bronze',hidden:!!d[4]}))); }catch(e){} }
function unlock(id){
  if(TROPHY[id]) return; const def=TROPHY_DEFS.find(d=>d[0]===id); if(!def) return;
  TROPHY[id]=Date.now(); saveJSON('aw4_ach',TROPHY); renderTrophies();
  if(window.GameSystem&&GameSystem.unlock){ try{ GameSystem.unlock(id); return; }catch(e){} }   // the console shows its own pop-up
  trophyQ.push(def); showNextTrophy();
}
function trophyStat(k,add=1){ TSTAT[k]=(TSTAT[k]||0)+add; saveJSON('aw4_ach_stats',TSTAT); return TSTAT[k]; }
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
