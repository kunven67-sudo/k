/* ================================================================
   THE FIGHT — you and Jay 2 swing at the same time. Everything slows
   down and a ring shrinks on him: press when it meets the circle.
   An orange ring on his face = PUNCH. A blue ring on his fist = BLOCK.
   Left click / E / Space (touch: PUNCH).
   ================================================================ */
const SLOWMO={k:1,target:1};
const FIGHT={active:false,h:null,t:0,phase:'idle',ring:null,hpYou:100,hpHim:100,landed:0,blocked:0,hit:0,swings:0,perfects:0,stopReq:false,
  onKey(code){ if(code==='KeyE'||code==='Space'||code==='Enter'||code==='KeyF') FIGHT.press(); },
  onPunch(){ FIGHT.press(); }
};
const _fp=new THREE.Vector3();
function fightUI(on){ $('fight').classList.toggle('show',on); if(!on){ $('fightRing').style.opacity=0; $('fightWord').textContent=''; } }
function fightWord(t,cls){ const w=$('fightWord'); w.textContent=t; w.className='word '+(cls||''); w.style.opacity=1; clearTimeout(fightWord.tm); fightWord.tm=setTimeout(()=>{ w.style.opacity=0; },650); }
function fightHP(){ $('hpYou').style.width=Math.max(4,FIGHT.hpYou)+'%'; $('hpHim').style.width=Math.max(4,FIGHT.hpHim)+'%'; }
/* where on screen a world point is (px) */
function screenOf(p){ _fp.copy(p).project(camera); return [(_fp.x*.5+.5)*innerWidth,(-_fp.y*.5+.5)*innerHeight,_fp.z<1]; }
/* the other Jay's fight moves: works for the person and for the blocky Jay */
function fightAnim(h){
  const U=h.userData, A=U.A;
  if(U.folk){ A.custom=(J,t,dt)=>{ const F=FIGHT.anim; const g=Math.sin(t*3)*.08;
      J.armL.rotation.x=-1.6+g; J.armR.rotation.x=-1.6-g; J.armL.rotation.z=.25; J.armR.rotation.z=-.25;
      if(F.wind>0){ J.armR.rotation.x=lerp(-1.6,-.5,F.wind); J.hips.rotation.y=-.35*F.wind; }
      if(F.ext>0){ J.armR.rotation.x=lerp(-1.6,-1.75,F.ext); J.armR.rotation.z=lerp(-.25,.15,F.ext); J.hips.rotation.y=.35*F.ext; }
      if(F.snap>0){ J.headJ.rotation.x=-.5*F.snap; J.hips.rotation.x=-.15*F.snap; } else J.hips.rotation.x=0;
      if(F.blockK>0){ J.armL.rotation.x=-2.2; J.armR.rotation.x=-2.2; J.armL.rotation.z=.6; J.armR.rotation.z=-.6; } };
    return; }
  setPose(h,'guard',.2);
  A.custom=(R,t,dt)=>{ const F=FIGHT.anim;
    if(F.wind>0){ R.shR[0]=lerp(R.shR[0],-.8,F.wind); R.shR[2]=lerp(R.shR[2],-.55,F.wind); R.elR[0]=lerp(R.elR[0],-2.4,F.wind); R.spine[1]+=.32*F.wind; }
    if(F.ext>0){ R.shR[0]=lerp(R.shR[0],-1.58,F.ext); R.shR[1]=lerp(R.shR[1],.15,F.ext); R.shR[2]=lerp(R.shR[2],-.05,F.ext); R.elR[0]=lerp(R.elR[0],-.12,F.ext); R.spine[1]-=.38*F.ext; R.chest[1]-=.12*F.ext; }
    if(F.snap>0){ R.head[0]-=.55*F.snap; R.head[2]+=.2*F.snap*F.side; R.spine[0]-=.22*F.snap; }
    if(F.blockK>0){ R.shL[0]=lerp(R.shL[0],-1.6,F.blockK); R.elL[0]=lerp(R.elL[0],-2.5,F.blockK); R.shR[0]=lerp(R.shR[0],-1.6,F.blockK); R.elR[0]=lerp(R.elR[0],-2.5,F.blockK); R.head[0]+=.25*F.blockK; }
  };
}
FIGHT.anim={wind:0,ext:0,snap:0,blockK:0,side:1};
/* run the fight until FIGHT.stopReq (the story pulls the plug when the light comes) */
async function runFight(h){
  const F=FIGHT; Object.assign(F,{active:true,h,t:0,phase:'idle',ring:null,hpYou:100,hpHim:100,landed:0,blocked:0,hit:0,swings:0,perfects:0,stopReq:false,gotHit:false});
  fightAnim(h); fightUI(true); fightHP(); $('fightHint').textContent=IS_TOUCH?'Tap PUNCH when the ring hits the circle':'Click (or E) when the ring hits the circle';
  F.hintLeft=2;
  PLAYER.lock(); PLAYER.ctl.look=true; VM.forceShow=true;
  playMusic('fight',.6);
  let n=0;
  while(!F.stopReq){
    // circle each other for a moment
    F.phase='idle'; await wait(rand(.9,1.4)); if(F.stopReq) break;
    // both wind up... slow motion
    const kind=(n===0||n===2||n===3||n===5)?'punch':'block'; n++;
    F.phase='wind'; SND.play('swing_'+randi(1,2),{vol:.35,rate:.55}); PLAYER.lookTo=null; lookAtPoint(headOf(h).add(V3(0,-.05,0)),.25);
    tweenVal(v=>{ F.anim.wind=v; },0,1,.35); VM.punchT=0;
    SLOWMO.target=.22; FX.desat=.35; await wait(.12); if(F.stopReq) break;
    await fightRing(kind);
    SLOWMO.target=1; FX.desat=0;
    await wait(.55);
  }
  F.phase='done'; F.ring=null; $('fightRing').style.opacity=0; SLOWMO.target=1; FX.desat=0;
  F.anim.wind=F.anim.ext=F.anim.blockK=0;
}
function endFight(){ const F=FIGHT; F.active=false; F.stopReq=true; fightUI(false); VM.forceShow=false; SLOWMO.target=1; SLOWMO.k=1; FX.desat=0;
  if(F.h){ const A=F.h.userData.A; A.custom=null; if(F.h.userData.J) clearPose(F.h,.3); }
  F.anim={wind:0,ext:0,snap:0,blockK:0,side:1}; }
/* one ring: resolves after the hit / block / miss plays out */
function fightRing(kind){
  return new Promise(res=>{
    const F=FIGHT, tok=STORY.token;
    F.ring={kind,t:0,dur:1.05,done:false,res:()=>{ if(tok===STORY.token) res(); }};
    const r=$('fightRing'); r.classList.remove('hit','miss'); r.style.opacity=1; r.dataset.kind=kind;
    $('fightZone').setAttribute('r',16); $('fightZone').setAttribute('stroke-dasharray','none');
    $('fightZone').style.stroke=kind==='punch'?'rgba(255,170,90,.55)':'rgba(120,200,255,.55)';
    $('fightArc').style.stroke=kind==='punch'?'#ffb060':'#8ad0ff';
    fightWord(kind==='punch'?'PUNCH':'BLOCK',kind==='punch'?'':'block');
  });
}
FIGHT.press=function(){
  const F=FIGHT, R=F.ring; if(!F.active||!R||R.done) return;
  const r=fightArcR(R.t/R.dur); const off=Math.abs(r-16);
  fightResolve(off<=2.6?'perfect':off<=6.5?'good':'miss');
};
function fightArcR(k){ return lerp(46,4,clamp(k,0,1)); }
async function fightResolve(res){
  const F=FIGHT, R=F.ring; if(!R||R.done) return; R.done=true; F.swings++;
  const h=F.h, A=F.anim, ok=res!=='miss', ringEl=$('fightRing'); ringEl.classList.add(ok?'hit':'miss');
  setTimeout(()=>{ ringEl.style.opacity=0; },220);
  tweenVal(v=>{ A.wind=v; },A.wind,0,.12);
  const head=h.userData.J?h.userData.J.head:h.userData.parts.headJ, hp=head.getWorldPosition(new THREE.Vector3());
  if(R.kind==='punch'){
    VM.punchT=.28;
    if(ok){ F.landed++; if(res==='perfect') F.perfects++;
      SND.play('punch_'+randi(1,3),{vol:.95}); SND.play('oof_'+randi(1,2),{vol:.7,pos:hp,ref:2});
      A.side=Math.random()<.5?-1:1; tweenVal(v=>{ A.snap=v; },1,0,.9,easeOut); F.hpHim-=res==='perfect'?22:16; shake(.25);
      fxBurst(hp.clone().add(V3(0,-.05,0)),{color:0x8a0d0d,count:res==='perfect'?10:6,speed:1.4,size:.012,life:.6,grav:-6,alpha:.9});
      if(F.landed>=1) addNoseBlood(h); if(F.landed>=2) redKnuckles(true);
      fightWord(res==='perfect'?'PERFECT':'HIT','good'); trophyStat('punches');
    } else {
      SND.play('swing_'+randi(1,2),{vol:.5}); fightWord('TOO '+(R.t/R.dur<.7?'EARLY':'LATE'),'bad');
      await wait(.05); youGetHit(h,A);
    }
  } else {
    if(ok){ F.blocked++; if(res==='perfect') F.perfects++;
      VM.handsLook=1; setTimeout(()=>{ VM.handsLook=0; },500);
      tweenVal(v=>{ A.ext=v; },0,1,.12,easeOut); await wait(.08); SND.play('block_'+randi(1,2),{vol:.9}); shake(.18); tweenVal(v=>{ A.ext=v; },1,0,.4);
      fightWord(res==='perfect'?'PERFECT BLOCK':'BLOCKED','block');
    } else { fightWord('TOO '+(R.t/R.dur<.7?'EARLY':'LATE'),'bad'); youGetHit(h,A); }
  }
  fightHP();
  if(F.hintLeft>0){ F.hintLeft--; if(!F.hintLeft) $('fightHint').textContent=''; }
  await wait(.32); R.res();
}
function youGetHit(h,A){
  const F=FIGHT; F.hit++; F.gotHit=true;
  tweenVal(v=>{ A.ext=v; },0,1,.1,easeOut);
  later(.06,()=>{ SND.play('punch_'+randi(1,3),{vol:1,rate:.9}); SND.play('oof_'+randi(1,2),{vol:.8,rate:1.05}); dmgFlash(); shake(.6); PLAYER.fovKick=-6; F.hpYou-=15; fightHP();
    flashWhite(.25,.25); });
  later(.55,()=>{ PLAYER.lookTo=null; lookAtPoint(headOf(h).add(V3(0,-.05,0)),.35); });
  later(.45,()=>tweenVal(v=>{ A.ext=v; },1,0,.35));
}
/* your knuckles go red after a couple of hits */
function redKnuckles(on){
  if(!VM.arms) return; const H=VM.arms.R.userData.H; if(!H) return;
  if(on&&!VM.knuckles){ const bm=new THREE.MeshStandardMaterial({color:col(0x8a1414),roughness:.35,transparent:true,opacity:.75});
    VM.knuckles=new THREE.Group(); for(let i=0;i<4;i++){ const k=new THREE.Mesh(new THREE.SphereGeometry(.0075,8,6),bm); k.position.set(-.024+i*.016,.004,-.005); k.scale.set(1,.5,.8); k.renderOrder=11; VM.knuckles.add(k); }
    H.grp.add(VM.knuckles); }
  if(VM.knuckles) VM.knuckles.visible=on;
}
/* per frame: slow motion easing, the ring shrinking over its target */
FIGHT.update=function(raw,dt){
  const F=FIGHT, R=F.ring; if(!F.active||!R) return;
  if(!R.done){ R.t+=raw; const k=R.t/R.dur; const r=fightArcR(k);
    $('fightArc').setAttribute('r',r.toFixed(1)); $('fightArc').setAttribute('stroke-dasharray','none');
    // on his face for a punch, on his fist for a block
    const h=F.h; let p;
    if(R.kind==='punch'){ const hd=h.userData.J?h.userData.J.head:h.userData.parts.headJ; p=hd.getWorldPosition(new THREE.Vector3()); p.y+=h.userData.J?.1:.2; }
    else { const hd=h.userData.J?h.userData.J.hdR:h.userData.parts.armR; p=hd.getWorldPosition(new THREE.Vector3()); if(!h.userData.J) p.y-=.5; }
    const [sx,sy,vis]=screenOf(p); const el=$('fightRing'); el.style.left=clamp(sx,90,innerWidth-90)+'px'; el.style.top=clamp(sy,90,innerHeight-90)+'px';
    if(k>=1.08) fightResolve('miss');
  }
};
/* one-shot numeric tweens (cutscenes): fn(value) every frame */
const TWEENS=[];
function tweenVal(fn,a,b,dur,ease=smooth){ const tok=STORY.token; return new Promise(res=>{ TWEENS.push({fn,a,b,dur:Math.max(.0001,dur),t:0,ease,res,tok}); fn(a); }); }
function updateTweens(dt){ for(let i=TWEENS.length-1;i>=0;i--){ const T=TWEENS[i]; if(T.tok!==STORY.token){ TWEENS.splice(i,1); continue; } T.t+=dt; const k=clamp(T.t/T.dur,0,1); try{ T.fn(lerp(T.a,T.b,T.ease(k))); }catch(e){ console.error(e); } if(k>=1){ TWEENS.splice(i,1); T.res(); } } }
