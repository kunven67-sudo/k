/* ================================================================
   THE PIG'S TABLE (Part 2) — you are ant size now, so his dining
   table is a whole world: a row of tiny prisoner cages, the arena (a
   wooden bowl full of sand), his plate with bones, a potted rose with
   fallen thorns, a napkin with loose threads, a candle. He sits at the
   end of it, giant (x40). Day: he eats and watches. Night: he sleeps
   in his chair and snores. Everything metal makes noise.
   ================================================================ */
const TK=40;   // 1 meter for the pig = 40 of yours
const TABLE={W:100,D:52,
  cages:[{id:'orrin',x:-40,z:18},{id:'you',x:-31,z:18},{id:'bram',x:-22,z:18},{id:'teo',x:-13,z:18}],
  arena:V3(8,0,-4), arenaR:12,
  plate:V3(-22,0,-12), napkin:V3(-40,0,-8), pot:V3(36,0,-14), pebbles:V3(28,0,-5), candle:V3(42,0,16), cup:V3(-4,0,20)};
const CAGE={w:6,d:6,h:4.6,bar:.5};
function cageOf(id){ return TABLE.cages.find(c=>c.id===id); }
function makeTinyCage(scene,lv,c,iron,wood){
  const g=new THREE.Group(); g.position.set(c.x,0,c.z); scene.add(g); c.g=g;
  const w=CAGE.w, d=CAGE.d, h=CAGE.h, n=Math.round(w/CAGE.bar);
  g.add(box(w+.3,.18,d+.3,wood,0,.09,0));   // the wooden base
  g.add(box(w+.2,.16,d+.2,iron,0,h,0));   // the lid frame
  for(let i=0;i<=n;i++){ const t=-w/2+i*w/n; g.add(box(.08,.08,d,iron,t,h+.05,0)); }
  c.bars=[];
  const bar=(x,z,bent)=>{ const b=cyl(.055,.055,h,iron,x,h/2,z,8); g.add(b); c.bars.push(b); return b; };
  for(let i=0;i<=n;i++){ const t=-w/2+i*w/n;
    bar(t,-d/2); // front (faces the arena)
    if(c.id==='you'&&(i===n/2||i===n/2+1)){ // the bent bar at the back: two bars bowed apart = a gap you can squeeze through
      const b=new THREE.Group(); b.position.set(t,0,d/2); g.add(b);
      const curve=new THREE.CatmullRomCurve3([V3(0,0,0),V3((i===n/2?-1:1)*.38,h*.35,.15),V3((i===n/2?-1:1)*.3,h*.65,.1),V3(0,h,0)]);
      b.add(mesh(new THREE.TubeGeometry(curve,16,.055,8),iron)); continue; }
    bar(t,d/2); }
  for(let i=1;i<n;i++){ const t=-d/2+i*d/n; bar(-w/2,t); bar(w/2,t); }
  // the door (front, middle) with its lock box
  g.add(box(.6,.5,.25,iron,0,h*.5,-d/2-.05));
  // straw/cloth bedding on the floor
  const rag=mesh(GC('ragGeo',()=>{ const p=new THREE.PlaneGeometry(4.2,3.4,16,12); const a=p.attributes.position; for(let k=0;k<a.count;k++) a.setZ(k,Math.abs(noise2(a.getX(k)*.9,a.getY(k)*.9))*.25); p.rotateX(-Math.PI/2); p.computeVertexNormals(); return p; }),lv.ragM,rand(-.3,.3),.19,rand(.2,.8)); rag.rotation.y=rand(-.3,.3); g.add(rag);
  // collision: 4 walls (the back wall of YOUR cage has a gap where the bar is bent; only open when you know about it)
  const x0=c.x-w/2,x1=c.x+w/2,z0=c.z-d/2,z1=c.z+d/2,t=.25;
  colBox(lv.col,x0,x1,z0-t,z0+t); colBox(lv.col,x0-t,x0+t,z0,z1); colBox(lv.col,x1-t,x1+t,z0,z1);
  if(c.id==='you'){ colBox(lv.col,x0,c.x-.55,z1-t,z1+t); colBox(lv.col,c.x+.55,x1,z1-t,z1+t); colBox(lv.col,c.x-.55,c.x+.55,z1-t,z1+t,()=>!F.bentBar); }
  else colBox(lv.col,x0,x1,z1-t,z1+t);
  return g;
}
defineLevel('table',{
  title:'???',
  env:{fx:{exposure:1.05,saturation:1.05,contrast:1.1,temp:.08,bloomStrength:.35,bloomThreshold:1.1,aoRadius:1.2,vignette:.5,grain:.04},music:null,reverb:.55,surface:'wood',far:900,speed:3.6},
  async build(scene,lv){
    scene.background=col(0x0a0604); scene.fog=new THREE.FogExp2(col(0x0e0806),.006); lv.fogDay=.006;
    lv.rig=makeRig(scene,{sun:1.6,sunColor:0xffb070,hemi:.35,sky:0x6a5a50,ground:0x1a100a,dir:V3(-.35,1,.45),span:46,dist:120,far:260,bias:-.0006,normalBias:.05});
    const iron=pbrMat('rusty_metal_04',.4,{opts:{metalness:.85,roughness:.6}}); iron.color=col(0x9a8a7a);
    const wood=pbrMat('rough_wood',1.2,{opts:{roughness:.85}}); wood.color=col(0x8a6a4a);
    lv.ragM=new THREE.MeshStandardMaterial({color:col(0x8a7a5a),roughness:1,map:charTex().cloth.map});
    // the tabletop: giant wood grain (one plank is a meter wide for the pig = 40 of yours)
    const top=texPlane(TABLE.W,TABLE.D,'rough_wood',2.2,0,0,0,{opts:{roughness:.8}}); top.material.color=col(0x9a7452); scene.add(top);
    for(let i=1;i<4;i++){ const gap=box(TABLE.W,.05,.18,new THREE.MeshStandardMaterial({color:col(0x1a0f08),roughness:1}),0,.01,-TABLE.D/2+i*TABLE.D/4,false); scene.add(gap); }
    const edge=box(TABLE.W,3,TABLE.D,new THREE.MeshStandardMaterial({color:col(0x4a3220),roughness:.9}),0,-1.52,0,false); scene.add(edge);
    const floor=texPlane(900,900,'stone_tiles_02',22,0,-36,0,{opts:{roughness:.9}}); floor.material.color=col(0x5a5048); scene.add(floor);
    // the pig, giant, in his chair at the end of the table
    const pig=makePigMan(); pig.scale.setScalar(TK); pig.position.set(0,-36,-TABLE.D/2-34); scene.add(pig); lv.pig=pig;
    const P=pig.userData.pig; P.onBite=()=>{ pigBiteMeat(P); SND.play('pig_eat_'+randi(1,4),{vol:1,pos:V3(0,44,-34),ref:60}); };
    P.onChew=()=>SND.play('chew_'+randi(1,3),{vol:.8,pos:V3(0,44,-34),ref:60,rate:.6});
    P.onGrunt=()=>{ if(Math.random()<.6) SND.play('pig_'+randi(1,6),{vol:1,pos:V3(0,44,-34),ref:70,rate:rand(.6,.72)}); };
    const chairM=pbrMat('rough_wood',.8,{opts:{roughness:.85}}); chairM.color=col(0x4a2e1a);
    const chair=new THREE.Group(); chair.scale.setScalar(TK); chair.position.copy(pig.position); scene.add(chair);
    chair.add(box(1.5,.6,1.15,chairM,0,.3,.05)); chair.add(box(1.6,2.6,.22,chairM,0,1.3,-.55));
    // the arena: a wooden bowl filled with sand, in the middle of the table
    const A=TABLE.arena, R=TABLE.arenaR;
    const bowl=mesh(GC('bowlGeo',()=>{ const pts=[[R,.0],[R+1.6,.1],[R+1.9,1.6],[R+1.7,4.2],[R+1.2,4.6],[R+.9,4.4],[R+.4,1.0],[R,.35]].map(p=>new THREE.Vector2(p[0],p[1])); const g=new THREE.LatheGeometry(pts,96); g.computeVertexNormals(); return g; }),pbrMat('rough_wood',3,{opts:{roughness:.75}}),A.x,0,A.z); bowl.material.color=col(0x7a5434); bowl.material.side=THREE.DoubleSide; scene.add(bowl);
    const sand=mesh(new THREE.CircleGeometry(R+.3,96),pbrMat('dense_sand',3.2,{opts:{roughness:1}}),A.x,.35,A.z); sand.rotation.x=-Math.PI/2; sand.receiveShadow=true; scene.add(sand); lv.sand=sand;
    colCircle(lv.col,A.x,A.z,R+1.9,()=>!ARENA.active);
    // things lying in the sand (you can grab them in a fight): old bones + rocks, and the scratches of old fights
    lv.arenaLoot=[];
    // the pig's plate: white china, a gnawed meat bone, bone splinters
    const china=new THREE.MeshPhysicalMaterial({color:col(0xe9e4da),roughness:.18,clearcoat:.8});
    const plate=mesh(GC('plateGeo',()=>{ const pts=[[0,.05],[5.2,.08],[6.2,.35],[7.2,.75],[7.5,.8],[7.4,.6],[6.2,.15],[5,0],[0,0]].map(p=>new THREE.Vector2(p[0],p[1])); const g=new THREE.LatheGeometry(pts,64); g.computeVertexNormals(); return g; }),china,TABLE.plate.x,0,TABLE.plate.z); scene.add(plate);
    const meat=makeMeatLeg(); meat.scale.setScalar(TK*.6); meat.position.set(TABLE.plate.x+1,.9,TABLE.plate.z-1); meat.rotation.set(Math.PI/2,0,.6); scene.add(meat);
    // the spoon on the rim: metal = noise
    const steel=new THREE.MeshPhysicalMaterial({color:col(0xc8ccd0),metalness:1,roughness:.22});
    const spoon=new THREE.Group(); spoon.position.set(TABLE.plate.x+5.8,.85,TABLE.plate.z+3.6); spoon.rotation.y=-.7; scene.add(spoon);
    spoon.add(ell(1.1,.2,1.6,steel,0,0,0,24)); spoon.add(box(.35,.1,5.4,steel,0,.05,-3.4)); lv.spoon=spoon;
    colFromObj(lv.col,meat,{k:.75}); colFromObj(lv.col,spoon,{k:.9});
    // the potted rose: a clay pot, a thorny stem going up out of sight, thorns fallen on the table
    const clay=pbrMat('clay_plaster',1.5,{opts:{roughness:.9}}); clay.color=col(0xb0603a);
    const pot=mesh(GC('potGeo',()=>{ const pts=[[0,0],[4.6,0],[5.2,.3],[6.2,7.2],[6.8,7.4],[6.8,8.2],[6.0,8.2],[5.6,7.4],[0,7.4]].map(p=>new THREE.Vector2(p[0],p[1])); const g=new THREE.LatheGeometry(pts,48); g.computeVertexNormals(); return g; }),clay,TABLE.pot.x,0,TABLE.pot.z); scene.add(pot);
    colCircle(lv.col,TABLE.pot.x,TABLE.pot.z,6.6);
    const stemM=new THREE.MeshStandardMaterial({color:col(0x3a5a22),roughness:.7,normalMap:charTex().skinN.normalMap});
    const stem=cyl(.7,.9,60,stemM,TABLE.pot.x+.8,37,TABLE.pot.z+.4,12); scene.add(stem);
    const thornM=new THREE.MeshPhysicalMaterial({color:col(0x8a4a2a),roughness:.4,clearcoat:.5});
    for(let i=0;i<10;i++){ const th=mesh(GC('thornGeo',()=>{ const c=new THREE.ConeGeometry(.35,1.4,8); c.translate(0,.7,0); return c; }),thornM,0,0,0); const a=rand(0,6.28); th.position.set(TABLE.pot.x+.8+Math.cos(a)*.75,10+i*4.5,TABLE.pot.z+.4+Math.sin(a)*.75); th.rotation.set(Math.sin(a)*1.2,0,-Math.cos(a)*1.2); scene.add(th); }
    // the napkin: soft cloth with a frayed edge, one corner folded up like a little tent (you can hide under it)
    const cloth=new THREE.MeshPhysicalMaterial({color:col(0xd8cdb8),roughness:.95,map:charTex().cloth.map,sheen:col(0x8a8070)});
    const nap=mesh(GC('napGeo',()=>{ const p=new THREE.PlaneGeometry(16,12,48,36); const a=p.attributes.position; for(let k=0;k<a.count;k++){ const x=a.getX(k), y=a.getY(k); let z=.15+Math.abs(noise2(x*.25,y*.25))*.35; const cx=x-5.5, cy=y+3.5; const dd=Math.hypot(cx,cy); if(dd<4.5) z+=Math.cos(dd/4.5*Math.PI/2)*2.6; a.setZ(k,z); } p.rotateX(-Math.PI/2); p.computeVertexNormals(); return p; }),cloth,TABLE.napkin.x,0,TABLE.napkin.z); nap.material.side=THREE.DoubleSide; scene.add(nap);
    const threadM=new THREE.MeshStandardMaterial({color:col(0xe0d4bc),roughness:1});
    lv.threads=[]; for(let i=0;i<7;i++){ const x0=TABLE.napkin.x-7+i*2.1, z0=TABLE.napkin.z-6; const pts=[V3(x0,.15,z0),V3(x0+rand(-.6,.6),.12,z0-1.2),V3(x0+rand(-.8,.8),.1,z0-2.4),V3(x0+rand(-.6,.6),.1,z0-3.4)];
      const th=mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),16,.06,6),threadM); scene.add(th); lv.threads.push(th); }
    const thimble=new THREE.Group(); thimble.position.set(TABLE.napkin.x-2,0,TABLE.napkin.z-10.5); scene.add(thimble); lv.thimble=thimble; colCircle(lv.col,thimble.position.x,thimble.position.z,1.55);
    thimble.add(mesh(GC('thimGeo',()=>{ const pts=[[0,0],[1.5,0],[1.5,.2],[1.35,2.6],[1.0,3.0],[0,3.1]].map(p=>new THREE.Vector2(p[0],p[1])); const g=new THREE.LatheGeometry(pts,32); g.computeVertexNormals(); return g; }),new THREE.MeshPhysicalMaterial({color:col(0xc0b090),metalness:1,roughness:.35,normalMap:scorpionSkin('thim','#888',2500).nm,normalScale:new THREE.Vector2(.6,.6)}),0,0,0));
    // pebbles spilled from the pot, and a bottle cap next to them (metal = noise)
    const stoneM=pbrMat('sandy_gravel_02',.4,{opts:{roughness:.9}}); stoneM.color=col(0x9a9088);
    lv.pebbles=[]; for(let i=0;i<6;i++){ const pb=ell(rand(.3,.45),rand(.22,.32),rand(.3,.42),stoneM,TABLE.pebbles.x+rand(-2.5,2.5),.24,TABLE.pebbles.z+rand(-2,2),16); pb.rotation.y=rand(0,6); scene.add(pb); lv.pebbles.push(pb); }
    const cap=new THREE.Group(); cap.position.set(TABLE.pebbles.x+3.6,0,TABLE.pebbles.z+2.4); cap.rotation.z=.08; scene.add(cap); lv.cap=cap; colCircle(lv.col,cap.position.x,cap.position.z,2.75);
    colCircle(lv.col,TABLE.napkin.x+5.5,TABLE.napkin.z+3.5,2.6);   // the folded-up corner of the napkin
    cap.add(mesh(GC('capGeo',()=>{ const g=new THREE.CylinderGeometry(2.6,2.7,.9,24,1,true); return g; }),new THREE.MeshPhysicalMaterial({color:col(0xb8302a),metalness:.9,roughness:.3,side:THREE.DoubleSide}),0,.45,0)); cap.add(cyl(2.6,2.6,.08,new THREE.MeshPhysicalMaterial({color:col(0xc8c0b0),metalness:1,roughness:.3}),0,.88,0,24));
    // the candle: the light at night
    const wax=new THREE.MeshPhysicalMaterial({color:col(0xf0e6d0),roughness:.5,transmission:.15});
    scene.add(cyl(2.6,2.8,12,wax,TABLE.candle.x,6,TABLE.candle.z,28)); colCircle(lv.col,TABLE.candle.x,TABLE.candle.z,3.1);
    const flame=mesh(GC('flameGeo',()=>{ const g=new THREE.SphereGeometry(.6,12,10); g.scale(1,2.2,1); return g; }),new THREE.MeshBasicMaterial({color:col(0xffc070).multiplyScalar(2.5)}),TABLE.candle.x,13.6,TABLE.candle.z,false); scene.add(flame); lv.flame=flame;
    lv.candleL=new THREE.PointLight(col(0xffa860),3.2,95,1.6); lv.candleL.position.set(TABLE.candle.x,15,TABLE.candle.z); scene.add(lv.candleL);
    // a cup (good cover at night)
    scene.add(cyl(4,3.6,9,china,TABLE.cup.x,4.5,TABLE.cup.z,32)); colCircle(lv.col,TABLE.cup.x,TABLE.cup.z,4.1);
    // the row of prisoner cages
    for(const c of TABLE.cages) makeTinyCage(scene,lv,c,iron,wood);
    // your stash in the back corner of your cage (what you collected shows up here)
    const yc=cageOf('you'); lv.stash={x:yc.x+1.9,z:yc.z+1.9,items:{}};
    const plateH=r=>r<5.2?.08:r<6.2?lerp(.08,.35,(r-5.2)):r<7.2?lerp(.35,.75,(r-6.2)):r<7.5?.8:r<8.6?lerp(.8,0,(r-7.5)/1.1):0;
    const napH=(x,z)=>{ const lx=x-TABLE.napkin.x, ly=-(z-TABLE.napkin.z); if(Math.abs(lx)>8||Math.abs(ly)>6) return 0; let h=.15+Math.abs(noise2(lx*.25,ly*.25))*.35; const dd=Math.hypot(lx-5.5,ly+3.5); if(dd<4.5) h+=Math.cos(dd/4.5*Math.PI/2)*2.6; return h; };
    lv.ground=(x,z)=>{ const a=Math.hypot(x-A.x,z-A.z); if(a<R) return .35; for(const c of TABLE.cages) if(Math.abs(x-c.x)<CAGE.w/2+.15&&Math.abs(z-c.z)<CAGE.d/2+.15) return .18;
      const pr=Math.hypot(x-TABLE.plate.x,z-TABLE.plate.z); if(pr<8.6) return plateH(pr); return napH(x,z); };
    lv.surfaceAt=(x,z)=>Math.hypot(x-A.x,z-A.z)<R?'sand':'wood';
    lv.col.bounds=[-TABLE.W/2+.6,TABLE.W/2-.6,-TABLE.D/2+.6,TABLE.D/2-.6];
    lv.time='day';
  },
  enter(){ FX.sunWorld=null; this.setTime(this.time||'day'); },
  exit(){ setAmbience([]); },
  setTime(t){ const lv=this; lv.time=t; const night=t==='night';
    lv.rig.sun.intensity=night?.45:2.5; lv.rig.sun.color=col(night?0x8a9ad0:0xffc890); lv.rig.hemi.intensity=night?.22:.65;
    lv.candleL.intensity=night?4:1.6; lv.scene.fog.density=night?.009:.006;
    const P=lv.pig.userData.pig; P.sleep=night?1:0; P.stop=night; },
  update(dt,t){
    const lv=this, P=lv.pig.userData.pig;
    animatePigMan(lv.pig,dt,t);
    lv.flame.scale.set(1+noise1(t*9)*.08,1+noise1(t*7+3)*.12,1); lv.candleL.intensity*=1+noise1(t*11)*.02;
    if(lv.time==='night'&&P.sleep>.5){ lv.snoreT=(lv.snoreT||0)-dt; if(lv.snoreT<=0){ lv.snoreT=rand(3.4,4.6); SND.play('snore',{vol:.9,pos:V3(0,40,-40),ref:80,rate:rand(.5,.6)}); } }
    if(typeof tableTick==='function') tableTick(lv,dt,t);
  }
});
