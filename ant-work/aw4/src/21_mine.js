/* ================================================================
   THE OLD MINE — Bob (he KNOWS you), gold, a tripwire, a pit, the
   cave-in (dynamite), the glowing power core... and something alive
   down there. You never see it. You hear it.
   ================================================================ */
const MINE={gallery:V3(-18,0,-48), rockfall:V3(0,0,-72), core:V3(0,0,-104), wire:V3(0,0,-30), pit:{x0:-12,x1:-7,z0:-44,z1:-40}};
defineLevel('mine',{
  title:'The old mine',
  env:{fx:{exposure:1.15,saturation:.85,contrast:1.12,temp:.15,bloomStrength:.6,bloomThreshold:.85,aoRadius:.8,vignette:.6,grain:.06},music:null,reverb:.75,surface:'stone',far:160,speed:3.2},
  async build(scene,lv){ lv.occluders=[];
    scene.background=col(0x020202); scene.fog=new THREE.FogExp2(col(0x050403),.055);
    scene.add(new THREE.HemisphereLight(col(0x3a3028),col(0x050403),.18));
    const rock=pbrMat('cliff_side',3,{w:6,h:6,opts:{roughness:.95}}); rock.color=col(0x8a7058); const tw=pbrMat('rough_wood',1,{opts:{roughness:.9}}); tw.color=col(0x6a4a30);
    const floorM=pbrMat('dry_ground_rocks',3,{w:4,h:4,opts:{roughness:1}}); floorM.color=col(0x7a6a58);
    const tunnel=(x0,z0,x1,z1,w=4,h=3.4)=>{ const L=Math.hypot(x1-x0,z1-z0), a=Math.atan2(x1-x0,z1-z0), cx=(x0+x1)/2, cz=(z0+z1)/2; const g=new THREE.Group(); g.position.set(cx,0,cz); g.rotation.y=a; scene.add(g);
      const fl=mesh(new THREE.PlaneGeometry(w,L),pbrMat('dry_ground_rocks',3,{w,h:L,opts:{roughness:1}}),0,0,0,false); fl.rotation.x=-Math.PI/2; fl.receiveShadow=true; fl.material.color=col(0x7a6a58); g.add(fl);
      for(const sd of [-1,1]){ const wl=mesh(new THREE.PlaneGeometry(L,h,Math.ceil(L/1.5),3),pbrMat('cliff_side',3,{w:L,h,opts:{roughness:.95}}),sd*w/2,h/2,0); wl.rotation.y=-sd*Math.PI/2; const p=wl.geometry.attributes.position; for(let i=0;i<p.count;i++) p.setZ(i,rand(-.25,.25)); wl.geometry.computeVertexNormals(); wl.material.color=col(0x8a7058); g.add(wl); lv.occluders.push(wl); }
      const cl=mesh(new THREE.PlaneGeometry(w,L),rock,0,h,0,false); cl.rotation.x=Math.PI/2; g.add(cl);
      for(let z=-L/2+1;z<L/2;z+=4){ g.add(box(.25,h,.25,tw,-w/2+.2,h/2,z)); g.add(box(.25,h,.25,tw,w/2-.2,h/2,z)); g.add(box(w,.28,.28,tw,0,h-.15,z)); }
      // collision: two side walls
      const ca=Math.cos(a), sa=Math.sin(a); for(let s=-L/2;s<=L/2;s+=.8) for(const sd of [-1,1]){ const lx=sd*(w/2+.2), lz=s; colCircle(lv.col,cx+ca*lx+sa*lz,cz-sa*lx+ca*lz,.45); } };
    tunnel(0,4,0,-70); tunnel(0,-48,MINE.gallery.x,MINE.gallery.z,3.6); tunnel(0,-70,0,-100,4.4,4); tunnel(MINE.gallery.x,-40,MINE.gallery.x,-58,6,4);
    // the deep chamber + the core
    const ch=mesh(new THREE.SphereGeometry(9,24,16,0,Math.PI*2,0,Math.PI/2),rock,0,0,MINE.core.z,false); ch.material=rock.clone(); ch.material.side=THREE.BackSide; ch.scale.y=.6; scene.add(ch);
    for(let a=0;a<Math.PI*2;a+=.25) colCircle(lv.col,Math.cos(a)*9,MINE.core.z+Math.sin(a)*9,.6);
    lv.core=new THREE.Group(); lv.core.position.copy(MINE.core).add(V3(0,1,0)); const cm=new THREE.MeshPhysicalMaterial({color:col(0x4ac8ff),emissive:col(0x2a8aff),emissiveIntensity:2.2,roughness:.2,transmission:.3,thickness:.5});
    lv.core.add(mesh(new THREE.OctahedronGeometry(.55,1),cm,0,0,0)); for(let i=0;i<6;i++){ const s=mesh(new THREE.OctahedronGeometry(.18,0),cm,Math.cos(i)*.7,rand(-.3,.4),Math.sin(i)*.7); lv.core.add(s); } scene.add(lv.core);
    lv.coreL=new THREE.PointLight(col(0x4aa8ff),3,14,1.6); lv.coreL.position.copy(lv.core.position); scene.add(lv.coreL);
    // the cave-in
    lv.rocks=new THREE.Group(); for(let i=0;i<22;i++) lv.rocks.add(prop('rock_boulder_dry',rand(-1.8,1.8),rand(0,2.4),MINE.rockfall.z+rand(-1.5,1.5),rand(0,6),rand(.35,.7))); scene.add(lv.rocks);
    lv.rockCol=colBox(lv.col,-2.2,2.2,MINE.rockfall.z-1.8,MINE.rockfall.z+1.8,()=>!F.rocksBlown);
    // gold veins in the gallery, Bob's lantern, carts, rails
    lv.veins=[]; const gm=new THREE.MeshPhysicalMaterial({color:col(0xffc84a),metalness:1,roughness:.35,emissive:col(0x3a2a00)});
    for(let i=0;i<3;i++){ const v=new THREE.Group(); v.position.set(MINE.gallery.x+(i-1)*2.6,1.2+i*.3,MINE.gallery.z-8.5); for(let k=0;k<7;k++) v.add(mesh(new THREE.DodecahedronGeometry(rand(.04,.09),0),gm,rand(-.4,.4),rand(-.3,.3),rand(0,.1))); scene.add(v); lv.veins.push(v); }
    const rm=new THREE.MeshPhysicalMaterial({color:col(0x4a3a30),metalness:1,roughness:.5}); for(const dx of [-.55,.55]) scene.add(box(.07,.1,72,rm,dx,.05,-34));
    for(const z of [-12,-56]){ const cart=new THREE.Group(); cart.position.set(0,0,z); cart.add(box(1.2,.8,1.8,rm,0,.75,0)); for(const [x,zz] of [[-.5,-.6],[.5,-.6],[-.5,.6],[.5,.6]]){ const w=cyl(.22,.22,.1,rm,x,.25,zz,12); w.rotation.z=Math.PI/2; cart.add(w); } scene.add(cart); colCircle(lv.col,0,z,1); }
    lv.lamps=[]; for(const p of [V3(0,2.8,-6),V3(0,2.8,-40),MINE.gallery.clone().add(V3(0,2.6,-4))]){ const L=new THREE.PointLight(col(0xffa860),1.6,16,1.6); L.position.copy(p); scene.add(L); lv.lamps.push(L); scene.add(prop('Lantern_01',p.x,p.y-.4,p.z,0,1)); }
    // the tripwire (glints in lantern light) + the pit
    lv.wire=mesh(new THREE.CylinderGeometry(.006,.006,4,4),new THREE.MeshPhysicalMaterial({color:col(0xc8c0b0),metalness:1,roughness:.2}),0,.25,MINE.wire.z); lv.wire.rotation.z=Math.PI/2; scene.add(lv.wire);
    const P=MINE.pit; const pit=mesh(new THREE.PlaneGeometry(P.x1-P.x0,P.z1-P.z0),mat(0x000000),(P.x0+P.x1)/2,.02,(P.z0+P.z1)/2,false); pit.rotation.x=-Math.PI/2; scene.add(pit);
    // daylight at the entrance
    const sun=new THREE.SpotLight(col(0xffe0b0),3,30,.6,.6,1); sun.position.set(0,3,8); sun.target.position.set(0,0,-6); scene.add(sun,sun.target);
    lv.ground=(x,z)=>0; lv.surfaceAt=()=>'stone'; lv.col.bounds=[-30,12,-116,8];
  },
  enter(){ setAmbience([['tiny',.06]]); setAmbEvents([]); },
  update(dt,t){ const lv=this; lv.core.rotation.y+=dt*.6; lv.core.position.y=1+Math.sin(t*1.4)*.08; lv.coreL.intensity=2.6+Math.sin(t*3)*.6; if(typeof mineTick==='function') mineTick(lv,dt,t); }
});
/* the dark: the thing down there (heard, never seen) */
const MTHING={dark:0,t:0,chase:0};
function mineTick(lv,dt,t){ if(G.mode!=='play'||LOOP.dying) return; const z=PLAYER.pos.z, deep=z<-62;
  const lit=hasItem('lantern')||lv.lamps.some(L=>L.position.distanceTo(PLAYER.pos)<7)||PLAYER.pos.distanceTo(lv.core.position)<6&&!F.coreTaken;
  if(deep&&!lit) MTHING.dark+=dt; else MTHING.dark=Math.max(0,MTHING.dark-dt*.5);
  MTHING.t-=dt; if(deep&&MTHING.t<=0){ MTHING.t=rand(3,7)*(lit?1.6:.7); SND.play(pick(['skitter_1','skitter_2','breath_heavy','stomach']),{vol:lit?.35:.7,pos:PLAYER.pos.clone().add(V3(rand(-12,12),0,rand(-14,-4))),ref:6,rate:rand(.5,.75)}); }
  if(MTHING.dark>3&&!MTHING.warned){ MTHING.warned=1; toast('It\'s too dark down here. Something is close.','#ff9a7a'); SND.play('heartbeat',{vol:.7}); }
  if(MTHING.dark>9) loopDie('mine');
  if(MTHING.chase>0){ MTHING.chase-=dt; if(Math.random()<dt*2.5) SND.play(pick(['breath_heavy','skitter_1','skitter_2']),{vol:.9,pos:PLAYER.pos.clone().add(V3(rand(-3,3),0,-6+MTHING.chase*.05)),ref:5,rate:rand(.45,.6)}); if(Math.random()<dt*1.5) shake(.25);
    if(MTHING.chase<=0&&z<-4) loopDie('mine'); }
  // the tripwire
  if(!F.wireDone&&Math.abs(z-MINE.wire.z)<.35&&Math.abs(PLAYER.pos.x)<2&&PLAYER.y<.4){ F.wireDone=1; SND.play('stone_1',{vol:1,rate:.6}); shake(.6); later(.5,()=>{ if(PLAYER.pos.z<MINE.wire.z+2&&PLAYER.pos.z>MINE.wire.z-2.5) loopDie('mine'); }); toast('A tripwire! RUN!','#ff9a7a'); }
  const P=MINE.pit; if(PLAYER.pos.x>P.x0&&PLAYER.pos.x<P.x1&&PLAYER.pos.z>P.z0&&PLAYER.pos.z<P.z1) loopDie('fell');
}
on('boom',at=>{ const lv=LEVELS.mine; if(LV!==lv||F.rocksBlown) return; if(at.distanceTo(MINE.rockfall)<8){ F.rocksBlown=1; lv.rocks.visible=false; SND.play('stone_2',{vol:1,rate:.5}); toast('The cave-in is open','#e8c27a'); } });
