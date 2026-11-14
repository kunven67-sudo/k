/* ================================================================
   THE TWISTED THOUSE (Part 3) — your Earth house, but from a different
   reality, and the blast WARPED it. You're still ant size (x40).
   Living room (rug, couch, TV stand, the answering machine, the fallen
   family photo, the front door with the locked cat flap) -> a hallway
   stretched way too long (drips, a fan, a toy car, a sparking outlet,
   an ant line, a spider web in the corner, a bathroom tub sticking out
   of the wall) -> the kitchen that ended up INSIDE the bedroom (the bed,
   the fridge, the counter with the cookie jar, floating stuff that
   drifts up and down like elevators). Shadow the cat lives here.
   ================================================================ */
const HK=40;
const THOUSE={x0:-70,x1:330,z0:-50,z1:50, hall:{x0:70,x1:210,z:15}, door:{x:-70,flapZ:0},
  machine:V3(26,0,34), photo:V3(-18,0,38), rug:{w:70,d:44},
  couch:{x:0,z:-38,w:90,d:24,legH:4.5}, bed:{x0:212,x1:292,z0:-22,z1:20,h:22,legH:6}, counter:{x0:250,x1:330,z0:24,z1:50,h:36},
  fridge:{x:312,z:-36,w:32,d:28,h:84}, jar:V3(300,36,36),
  drips:[105,142,176], fan:V3(128,0,-9), toy:V3(158,0,6), outlet:{x:188,z:-15}, web:{x0:72,x1:96,z0:9,z1:15}, tub:{x:118,z:15}};
/* a photo, rendered from real 3D people (the strangers who live here / the older you) */
function renderPhoto(people,bg,w=256,h=192){
  const rt=new THREE.WebGLRenderTarget(w,h); const sc=new THREE.Scene(); sc.background=col(bg);
  sc.add(new THREE.HemisphereLight(0xffffff,0x554433,1.1)); const dl=new THREE.DirectionalLight(0xffeedd,1.2); dl.position.set(1,2,3); sc.add(dl);
  const cam=new THREE.PerspectiveCamera(32,w/h,.1,20); cam.position.set(0,1.35,3.4); cam.lookAt(0,1.2,0);
  people.forEach((o,i)=>{ const p=makeHuman(o); p.position.set((i-(people.length-1)/2)*.62,0,0); p.rotation.y=(i-(people.length-1)/2)*-.15; p.scale.setScalar(o.s||1); sc.add(p); });
  renderer.setRenderTarget(rt); renderer.render(sc,cam); renderer.setRenderTarget(null);
  // copy the pixels into a normal canvas texture (render-target textures break when quality settings re-upload textures)
  const px=new Uint8Array(w*h*4); renderer.readRenderTargetPixels(rt,0,0,w,h,px); rt.dispose();
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h; const cx=cv.getContext('2d'), id=cx.createImageData(w,h);
  for(let y=0;y<h;y++) id.data.set(px.subarray((h-1-y)*w*4,(h-y)*w*4),y*w*4);
  cx.putImageData(id,0,0); const tex=new THREE.CanvasTexture(cv); tex.encoding=THREE.sRGBEncoding; return tex; }
function picFrame(texture,w,h,woodM){ const g=new THREE.Group(); g.add(box(w+1.2,h+1.2,.6,woodM,0,0,0)); const pic=mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:texture,roughness:.35}),0,0,.32,false); g.add(pic); return g; }
/* floating, spinning platforms (some drift up and down like elevators) */
function floater(lv,o){ const g=new THREE.Group(); g.position.copy(o.at); lv.scene.add(g); g.add(o.mesh); const f=Object.assign({g,y0:o.at.y,ph:o.ph||0},o); lv.floaters.push(f); return f; }
defineLevel('twisted',{
  title:'???',
  env:{fx:{exposure:1.25,saturation:.82,contrast:1.12,temp:-.08,bloomStrength:.3,bloomThreshold:1.1,aoRadius:1.2,vignette:.55,grain:.05,aberr:.0025},music:null,reverb:.6,surface:'wood',far:900,speed:3.6},
  async build(scene,lv){
    lv.occluders=[]; lv.floaters=[]; lv.solids=[];
    scene.background=col(0x0c0d10); scene.fog=new THREE.FogExp2(col(0x3a3a40),.0035);
    lv.rig=makeRig(scene,{sun:2.3,sunColor:0xffe8c8,hemi:.85,sky:0xb8c0d8,ground:0x6a5440,dir:V3(.35,1,.25),span:90,dist:200,far:420,bias:-.0006,normalBias:.06});
    const H=THOUSE;
    // ceiling lamps (a house has lights on): living room, hallway, kitchen/bedroom
    for(const [x,z,i] of [[0,0,2.2],[140,0,1.4],[270,0,2.0]]){ const L=new THREE.PointLight(col(0xffe2b8),i,420,1.1); L.position.set(x,150,z); scene.add(L); const bulb=mesh(new THREE.SphereGeometry(4,16,10),new THREE.MeshBasicMaterial({color:col(0xfff0d0)}),x,156,z,false); scene.add(bulb); }
    // the floor: giant floorboards; the walls: a sickly wrong green (this isn't your paint)
    const fl=texPlane(H.x1-H.x0+200,H.z1-H.z0+200,'rough_wood',48,(H.x0+H.x1)/2,0,0,{opts:{roughness:.75}}); fl.material.color=col(0xd8b890); scene.add(fl);
    const wallM=new THREE.MeshStandardMaterial({color:col(0xa8b896),roughness:.95,map:charTex().cloth.map});
    const wall=(x,z,w,ry,h=160,warp=0)=>{ const g=new THREE.PlaneGeometry(w,h,warp?40:1,warp?12:1); if(warp){ const a=g.attributes.position; for(let k=0;k<a.count;k++) a.setZ(k,Math.sin(a.getX(k)*.05+a.getY(k)*.02)*warp); g.computeVertexNormals(); } const m=mesh(g,wallM,x,h/2,z,false); m.rotation.y=ry; m.material.side=THREE.DoubleSide; scene.add(m); if(Math.abs(Math.sin(ry))<.5) colBox(lv.col,x-w/2,x+w/2,z-.6,z+.6); else colBox(lv.col,x-.6,x+.6,z-w/2,z+w/2); return m; };
    wall(0,H.z0-2,140,0); wall(0,H.z1+2,140,Math.PI); wall(H.x0,0,104,Math.PI/2);
    wall((H.hall.x0+H.hall.x1)/2,-H.hall.z,H.hall.x1-H.hall.x0,0,120,4); wall((H.hall.x0+H.hall.x1)/2,H.hall.z,H.hall.x1-H.hall.x0,Math.PI,120,4);   // the stretched, bent hallway
    wall(H.x1,0,104,-Math.PI/2); wall(270,H.z0-2,120,0); wall(270,H.z1+2,120,Math.PI);
    for(const [x0,x1,z0,z1] of [[70,70,-50,-15],[70,70,15,50],[210,210,-50,-15],[210,210,15,50]]) colBox(lv.col,x0-1,x1+1,z0,z1);
    colBox(lv.col,H.hall.x0,H.hall.x1,-H.hall.z-1,-H.hall.z+.2); colBox(lv.col,H.hall.x0,H.hall.x1,H.hall.z-.2,H.hall.z+1);
    // ---- the living room ----
    const rugM=new THREE.MeshStandardMaterial({roughness:1,map:canvasTex(512,320,(c,w,h)=>{ c.fillStyle='#5a2a26'; c.fillRect(0,0,w,h); c.strokeStyle='#c8a46a'; c.lineWidth=10; c.strokeRect(18,18,w-36,h-36); c.lineWidth=3; c.strokeRect(40,40,w-80,h-80);
      for(let i=0;i<6;i++){ c.beginPath(); c.ellipse(w/2,h/2,60+i*30,30+i*16,0,0,7); c.stroke(); } for(let i=0;i<4000;i++){ c.fillStyle='rgba(0,0,0,'+rand(.03,.12)+')'; c.fillRect(Math.random()*w,Math.random()*h,2,2); } })});
    const rug=mesh(new THREE.BoxGeometry(H.rug.w,.25,H.rug.d),rugM,0,.12,0); scene.add(rug);
    const sofaM=new THREE.MeshPhysicalMaterial({color:col(0x3a4a5a),roughness:.95,map:charTex().cloth.map,sheen:col(0x506070)});
    const woodM=pbrMat('rough_wood',30,{opts:{roughness:.7}}); woodM.color=col(0xa8784e);
    const C=H.couch; const couch=new THREE.Group(); couch.position.set(C.x,0,C.z); scene.add(couch);
    couch.add(box(C.w,10,C.d,sofaM,0,C.legH+5,0)); couch.add(box(C.w,22,8,sofaM,0,C.legH+16,-C.d/2+4)); for(const sd of [-1,1]) couch.add(box(10,16,C.d,sofaM,sd*(C.w/2-5),C.legH+13,0));
    for(const [x,z] of [[-C.w/2+4,-C.d/2+3],[C.w/2-4,-C.d/2+3],[-C.w/2+4,C.d/2-3],[C.w/2-4,C.d/2-3]]) couch.add(cyl(1.2,1,C.legH,woodM,x,C.legH/2,z,10));
    lv.occluders.push(couch);
    for(const [x,z] of [[-C.w/2+4,C.z-C.d/2+3],[C.w/2-4,C.z-C.d/2+3],[-C.w/2+4,C.z+C.d/2-3],[C.w/2-4,C.z+C.d/2-3]]) colCircle(lv.col,x,z,1.3);
    const tv=new THREE.Group(); tv.position.set(0,0,40); scene.add(tv); tv.add(box(60,20,14,woodM,0,10,0)); tv.add(box(52,30,2,new THREE.MeshPhysicalMaterial({color:col(0x0a0a0c),roughness:.15,clearcoat:1}),0,36,-2)); lv.occluders.push(tv); colBox(lv.col,-30,30,33,47);
    // the answering machine on the floor (fell off the stand), its big red light blinking
    const am=new THREE.Group(); am.position.copy(H.machine); am.rotation.y=.25; scene.add(am); lv.machine=am;
    am.add(box(9,3,6,new THREE.MeshPhysicalMaterial({color:col(0x1a1a1c),roughness:.4,clearcoat:.4}),0,1.5,0)); am.add(box(4,.3,2.5,new THREE.MeshStandardMaterial({color:col(0x2a2a2e),roughness:.6}),-1.6,3.1,.4));
    const btn=cyl(.9,.9,.4,new THREE.MeshStandardMaterial({color:col(0x8a1010),emissive:col(0xff2020),emissiveIntensity:1.5}),2.6,3.1,.8,16); am.add(btn); lv.amLight=btn; colCircle(lv.col,H.machine.x,H.machine.z,5);
    // the photos: strangers on the walls, and a fallen frame: the older you + his family
    const frameM=pbrMat('rough_wood',.5,{opts:{roughness:.6}}); frameM.color=col(0x6a4a2a);
    const strangers=[[{skin:0xd8a888,shirt:0x7a3030,hairStyle:'short',hair:0x3a2a1a},{skin:0xc89070,shirt:0x30507a,hairStyle:'bald',beard:true}],[{skin:0xe0b090,shirt:0x406a40,hairStyle:'spiky',hair:0x8a6a3a,s:.7},{skin:0xa87050,shirt:0x6a5a3a,hairStyle:'short'}]];
    strangers.forEach((ps,i)=>{ const f=picFrame(renderPhoto(ps,0x8a8070),26,19,frameM); f.position.set(i?-30:30,70,H.z0-1); f.rotation.z=(i?1:-1)*.08; scene.add(f); });
    const older={skin:0xe2b08c,shirt:0x3a4a3a,hair:0x9a9a96,hairStyle:'short',beard:true,stubble:.4,head:{rx:.074,ry:.104,rz:.094,jaw:.31,nose:.98}};
    const fam=picFrame(renderPhoto([older,{skin:0xd8a888,shirt:0x8a4a6a,hairStyle:'short',hair:0x5a3a20},{skin:0xe2b08c,shirt:0x4a6a9a,hairStyle:'short',hair:0x2a1c12,s:.62}],0x9a8a74),16,12,frameM);
    fam.position.set(H.photo.x,6.6,H.photo.z); fam.rotation.set(-.32,.3,0); scene.add(fam); lv.famPhoto=fam;
    // the front door (west wall) with the cat flap at the bottom, locked
    const door=new THREE.Group(); door.position.set(H.x0+.6,0,0); scene.add(door);
    door.add(box(1.2,82,38,woodM,0,41,0)); door.add(box(1.4,2,40,woodM,0,82,0));
    const flap=new THREE.Group(); flap.position.set(.9,9,0); door.add(flap); lv.flap=flap;
    flap.add(box(.4,8.5,9,new THREE.MeshPhysicalMaterial({color:col(0xdad6cc),roughness:.3,transparent:true,opacity:.85}),0,-4.25,0));
    door.add(box(1.6,1.2,11,new THREE.MeshStandardMaterial({color:col(0xcac6bc),roughness:.4}),.2,9.4,0)); door.add(box(1.6,1,11,new THREE.MeshStandardMaterial({color:col(0xcac6bc),roughness:.4}),.2,.5,0));
    const lock=box(1.4,1.6,1.6,new THREE.MeshStandardMaterial({color:col(0xb8963a),metalness:.9,roughness:.35}),1.2,1.6,3.6); door.add(lock); lv.flapLock=lock;
    // ---- the hallway: way too long, the walls bend ----
    // a bathroom tub coming out of the wall (rooms in the wrong place), a centipede on its edge
    const tubM=new THREE.MeshPhysicalMaterial({color:col(0xe8e8e2),roughness:.15,clearcoat:1});
    const tub=mesh(GC('tubGeo',()=>{ const g=new THREE.CylinderGeometry(14,14,40,24,1,true,Math.PI,Math.PI); g.rotateZ(Math.PI/2); return g; }),tubM,H.tub.x,10,H.tub.z-1); tub.material.side=THREE.DoubleSide; scene.add(tub);
    // the floor fan: blades spinning, it blows you sideways
    const fan=new THREE.Group(); fan.position.copy(H.fan); fan.rotation.y=Math.PI/2; scene.add(fan); lv.fan=fan;
    const fanM=new THREE.MeshPhysicalMaterial({color:col(0xd8d8d0),roughness:.4,clearcoat:.5});
    fan.add(cyl(6,7,2,fanM,0,1,0,24)); fan.add(cyl(.8,.8,18,fanM,0,10,0,10)); const head=new THREE.Group(); head.position.set(0,20,0); fan.add(head);
    head.add(sph(3,fanM,0,0,-1.5,16,12)); const blades=new THREE.Group(); blades.position.z=1.5; head.add(blades); lv.fanBlades=blades;
    for(let i=0;i<3;i++){ const b=mesh(GC('blade',()=>{ const g=new THREE.SphereGeometry(1,12,8); g.scale(3,7.5,.3); g.translate(0,7,0); return g; }),new THREE.MeshPhysicalMaterial({color:col(0x9ab0c8),roughness:.3,transparent:true,opacity:.85}),0,0,0); b.rotation.z=i/3*Math.PI*2; blades.add(b); }
    const cage=mesh(new THREE.TorusGeometry(10,.25,6,40),fanM,0,0,1.5); head.add(cage);
    colCircle(lv.col,H.fan.x,H.fan.z,7.5);
    // the toy car (bump it = it rolls and clatters)
    const toy=new THREE.Group(); toy.position.copy(H.toy); scene.add(toy); lv.toy=toy;
    const red=new THREE.MeshPhysicalMaterial({color:col(0xc01818),roughness:.3,clearcoat:1});
    toy.add(box(16,5,8,red,0,4.5,0)); toy.add(box(8,4,7,red,-1,8.5,0)); for(const [x,z] of [[-5.5,-4],[5.5,-4],[-5.5,4],[5.5,4]]){ const w=cyl(2.4,2.4,1.4,new THREE.MeshStandardMaterial({color:col(0x151515),roughness:.8}),x,2.4,z,16); w.rotation.x=Math.PI/2; toy.add(w); }
    lv.toyCol=colCircle(lv.col,H.toy.x,H.toy.z,8.5); lv.occluders.push(toy);
    // the sparking outlet on the wall
    const outM=new THREE.MeshStandardMaterial({color:col(0xe8e4d8),roughness:.5});
    const out=box(6,9,1,outM,H.outlet.x,6,-H.hall.z+.6); scene.add(out); lv.sparkL=new THREE.PointLight(col(0x9ad0ff),0,20,2); lv.sparkL.position.set(H.outlet.x,5,-H.hall.z+3); scene.add(lv.sparkL);
    // the spider web in the corner (the shortcut): sticky threads + its spider
    const webM=new THREE.LineBasicMaterial({color:0xdcdcdc,transparent:true,opacity:.55}); const wg=new THREE.BufferGeometry(); const pts=[];
    const W=H.web; for(let i=0;i<26;i++){ const a=i/26*Math.PI; pts.push(W.x0,0,W.z1, W.x0+Math.cos(a)*24,Math.sin(a)*16,W.z1-Math.sin(a)*6); } for(let r=4;r<24;r+=3) for(let i=0;i<20;i++){ const a0=i/20*Math.PI, a1=(i+1)/20*Math.PI; pts.push(W.x0+Math.cos(a0)*r,Math.sin(a0)*r*.66,W.z1-Math.sin(a0)*r*.25, W.x0+Math.cos(a1)*r,Math.sin(a1)*r*.66,W.z1-Math.sin(a1)*r*.25); }
    wg.setAttribute('position',new THREE.Float32BufferAttribute(pts,3)); const web=new THREE.LineSegments(wg,webM); scene.add(web); lv.web=web;
    lv.webSpider=makeBug('spider'); lv.webSpider.scale.setScalar(.75); lv.webSpider.position.set(W.x0+6,11,W.z1-1); lv.webSpider.rotation.set(-1.2,0,0); scene.add(lv.webSpider);
    // the ant line crossing the hall (normal ants, about your size now)
    lv.ants=[]; for(let i=0;i<9;i++){ const a=makeAnt(); a.position.set(165+i*3.1,0,-13+((i*7)%26)); scene.add(a); lv.ants.push({o:a,t:i/9}); }
    // ---- the kitchen inside the bedroom ----
    const B=H.bed; const bed=new THREE.Group(); scene.add(bed); const sheet=new THREE.MeshPhysicalMaterial({color:col(0xc8c0d8),roughness:.95,map:charTex().cloth.map,sheen:col(0x8a80a0)});
    bed.add(box(B.x1-B.x0,B.h-B.legH,B.z1-B.z0,sheet,(B.x0+B.x1)/2,B.legH+(B.h-B.legH)/2,(B.z0+B.z1)/2)); bed.add(box(8,46,B.z1-B.z0+4,woodM,B.x1+3,23,(B.z0+B.z1)/2));
    for(const [x,z] of [[B.x0+3,B.z0+3],[B.x0+3,B.z1-3],[B.x1-3,B.z0+3],[B.x1-3,B.z1-3]]){ scene.add(cyl(1.5,1.5,B.legH,woodM,x,B.legH/2,z,10)); colCircle(lv.col,x,z,1.6); }
    const blanket=mesh(GC('blanketDrape',()=>{ const p=new THREE.PlaneGeometry(B.z1-B.z0,B.h,24,24); const a=p.attributes.position; for(let k=0;k<a.count;k++){ a.setZ(k,Math.sin(a.getX(k)*.4)*.5+((B.h/2-a.getY(k))/B.h)*2.5); } p.computeVertexNormals(); return p; }),sheet,B.x0-.5,B.h/2,(B.z0+B.z1)/2,false); blanket.rotation.y=-Math.PI/2; blanket.material.side=THREE.DoubleSide; scene.add(blanket);
    lv.occluders.push(bed);
    const fr=H.fridge; const fridge=new THREE.Group(); fridge.position.set(fr.x,0,fr.z); scene.add(fridge);
    fridge.add(box(fr.w,fr.h,fr.d,new THREE.MeshPhysicalMaterial({color:col(0xe8e8e4),roughness:.25,clearcoat:.8}),0,fr.h/2+3,0)); fridge.add(box(1,30,1.5,new THREE.MeshStandardMaterial({color:col(0xa0a0a0),metalness:.8,roughness:.3}),-fr.w/2+2,55,fr.d/2+.8));
    colBox(lv.col,fr.x-fr.w/2,fr.x+fr.w/2,fr.z-fr.d/2,fr.z+fr.d/2); lv.occluders.push(fridge);
    const ct=H.counter; const counter=new THREE.Group(); scene.add(counter);
    counter.add(box(ct.x1-ct.x0,ct.h-2,ct.z1-ct.z0,woodM,(ct.x0+ct.x1)/2,(ct.h-2)/2,(ct.z0+ct.z1)/2)); counter.add(box(ct.x1-ct.x0+2,2,ct.z1-ct.z0+2,pbrMat('large_sandstone_blocks_01',40,{opts:{roughness:.4}}),(ct.x0+ct.x1)/2,ct.h-1,(ct.z0+ct.z1)/2));
    colBox(lv.col,ct.x0,ct.x1,ct.z0,ct.z1,()=>PLAYER.y<ct.h-1.5); lv.occluders.push(counter);
    // the cookie jar on the counter, its heavy lid
    const jarM=new THREE.MeshPhysicalMaterial({color:col(0xd8c8a8),roughness:.3,clearcoat:.8}); const jar=new THREE.Group(); jar.position.copy(H.jar); scene.add(jar); lv.jar=jar;
    jar.add(mesh(GC('jarGeo',()=>{ const pts=[[0,0],[6,0],[7,2],[7.2,9],[6,11],[5,11.4]].map(p=>new THREE.Vector2(p[0],p[1])); const g=new THREE.LatheGeometry(pts,32); g.computeVertexNormals(); return g; }),jarM));
    const lid=new THREE.Group(); lid.position.y=11.4; jar.add(lid); lid.add(cyl(5.6,5.6,1.2,jarM,0,.6,0,32)); lid.add(sph(1.6,jarM,0,1.8,0,14,10)); lv.jarLid=lid;
    colCircle(lv.col,H.jar.x,H.jar.z,7.3,()=>PLAYER.y>ct.h-2&&!lv.jarTipped); colBox(lv.col,H.jar.x-1,H.jar.x+11.6,H.jar.z-7.3,H.jar.z+7.3,()=>PLAYER.y>ct.h-2&&lv.jarTipped);
    lv.key=new THREE.Group(); const kM=new THREE.MeshPhysicalMaterial({color:col(0xc8a850),metalness:1,roughness:.3}); lv.key.add(mesh(new THREE.TorusGeometry(.5,.15,8,16),kM)); lv.key.add(box(.25,.25,2.4,kM,0,0,1.6)); lv.key.add(box(.25,.6,.25,kM,0,-.3,2.6)); lv.key.position.set(H.jar.x,ct.h+2,H.jar.z); lv.key.rotation.x=Math.PI/2; lv.key.visible=false; scene.add(lv.key);
    // floating things, slowly spinning: three of them drift up and down by the counter = the way up
    const bookM=new THREE.MeshStandardMaterial({color:col(0x4a2a5a),roughness:.8}), chairM=woodM, plateM=new THREE.MeshPhysicalMaterial({color:col(0xe9e4da),roughness:.2,clearcoat:.8});
    floater(lv,{mesh:box(9,1.6,7,bookM,0,0,0),at:V3(226,0,45),r:3.6,top:.8,lift:[0,13],period:8});
    floater(lv,{mesh:box(9,1.4,9,chairM,0,0,0),at:V3(235,12,40),r:4,top:.7,lift:[12,25],period:8,ph:.5});
    floater(lv,{mesh:cyl(5,4.6,.8,plateM,0,0,0,24),at:V3(245,24,44),r:4.6,top:.4,lift:[24,36.4],period:8,ph:0});
    // just floating around (no way up): spinning in the living room + hall
    for(const [x,y,z,m] of [[-40,30,-10,box(14,2,10,bookM,0,0,0)],[40,24,10,cyl(5,5,1,plateM,0,0,0,24)],[100,40,0,box(10,10,10,chairM,0,0,0)],[190,28,-4,box(12,2,9,bookM,0,0,0)]]) floater(lv,{mesh:m,at:V3(x,y,z),r:0,decor:true});
    // cockroaches under the fridge
    lv.roaches=[]; for(let i=0;i<4;i++){ const r=makeAnt(0x3a1a0a); r.scale.set(1.3,.7,1.8); r.position.set(fr.x+rand(-10,10),0,fr.z+fr.d/2+rand(-2,2)); r.visible=false; scene.add(r); lv.roaches.push(r); }
    // the cat
    lv.cat=makeCat(); scene.add(lv.cat);
    lv.ground=(x,z)=>{ let g=(Math.abs(x)<H.rug.w/2&&Math.abs(z)<H.rug.d/2)?.25:0;
      const ct=H.counter; if(x>ct.x0&&x<ct.x1&&z>ct.z0&&z<ct.z1&&PLAYER.y>ct.h-3) g=ct.h;
      const B=H.bed; if(x>B.x0&&x<B.x1&&z>B.z0&&z<B.z1&&PLAYER.y>B.h-4) g=B.h;
      for(const f of lv.floaters){ if(f.decor) continue; const top=f.g.position.y+f.top; if(Math.hypot(x-f.g.position.x,z-f.g.position.z)<f.r&&PLAYER.y>top-2.5) g=Math.max(g,top); }
      return g; };
    lv.surfaceAt=()=>'wood';
    lv.col.bounds=[H.x0+1.5,H.x1-1.5,H.z0+1.5,H.z1-1.5];
  },
  enter(){ FX.sunWorld=null; },
  exit(){ setAmbience([]); },
  update(dt,t){ const lv=this;
    for(const f of lv.floaters){ f.g.rotation.y+=dt*(f.decor?.15:.08); if(f.lift){ const k=clamp((.5-.5*Math.cos((t/f.period+f.ph)*Math.PI*2))*1.4-.2,0,1); /* rests ~2 s at the top + bottom */ f.g.position.y=lerp(f.lift[0],f.lift[1],k); } else if(f.decor){ f.g.position.y=f.y0+Math.sin(t*.4+f.at.x)*1.5; f.g.rotation.x+=dt*.05; } }
    if(lv.fanBlades) lv.fanBlades.rotation.z+=dt*14;
    if(lv.amLight) lv.amLight.material.emissiveIntensity=Math.sin(t*4)>0?1.8:.1;
    for(const a of lv.ants){ a.t=(a.t+dt*.02)%1; const x=165+a.t*40, z=Math.sin(a.t*12)*10-2; a.o.position.set(x,0,z); a.o.rotation.y=Math.PI/2+Math.cos(a.t*12)*.6; animateBug(a.o,dt,t); a.o.userData.bug.walkK=1; }
    if(typeof houseTick==='function') houseTick(lv,dt,t);
  }
});
/* a normal ant, about your size now (and dark roaches from the same parts) */
function makeAnt(color=0x2a1408){
  const root=new THREE.Group(), body=new THREE.Group(); root.add(body);
  const sk=scorpionSkin('ant',"#2a1408",500); const m=chitinMat(sk,{rough:.3,coat:.9,tint:color===0x2a1408?0xffffff:0xc08060});
  const B={kind:'ant',root,body,legs:[],atk:null,atkK:0,strikeK:0,walkK:0,ph:0,dead:0,hurtT:0,mats:[m],baseY:0}; root.userData.bug=B;
  body.add(ell(.32,.26,.38,m,0,.55,.55,16)); body.add(ell(.22,.2,.4,m,0,.6,0,14)); body.add(ell(.42,.34,.58,m,0,.62,-.75,18));
  for(const sd of [-1,1]){ const a=mesh(segGeo(.5,.02,.012,0,5),m,sd*.1,.75,.85); a.rotation.set(0,sd>0?-1.0:Math.PI+1.0,.6); body.add(a); }
  for(const sd of [-1,1]) for(let i=0;i<3;i++) B.legs.push(bugLeg(body,{m,at:V3(sd*.14,.5,.15-i*.15),yaw:legYaw(sd,[.7,0,-.7][i]),side:sd,ph:((i%2?.5:0)+(sd>0?.5:0))%1,segs:[{len:.35,r0:.035,r1:.03,a:.7},{len:.5,r0:.028,r1:.018,a:-1.9},{len:.25,r0:.016,r1:.01,a:.4}]}));
  root.updateMatrixWorld(true); let minY=1e9; const tip=new THREE.Vector3(); for(const L of B.legs){ const last=L.J[L.J.length-1]; tip.set(last.userData.len,0,0); last.localToWorld(tip); minY=Math.min(minY,tip.y); } B.baseY=-minY; body.position.y=B.baseY;
  root.traverse(o=>{ if(o.isMesh){ o.castShadow=true; } }); return root;
}
/* SHADOW: a big black house cat, yellow eyes (x40 = she's huge to you) */
function makeCat(){
  const root=new THREE.Group(); root.name='Shadow'; const body=new THREE.Group(); root.add(body);
  const T=charTex(); const furT=tarantulaSkin('#0a0a0c','rgba(70,70,80,.6)');
  const fur=new THREE.MeshPhysicalMaterial({color:col(0x141416),map:furT.map,normalMap:furT.nm,normalScale:new THREE.Vector2(1.4,1.4),roughness:.85,sheen:col(0x4a4a58),sheenRoughness:.5});
  const hairM=new THREE.MeshStandardMaterial({color:col(0x1a1a1e),roughness:.8});
  const S=20;   // scale: she stands ~20 m tall at the shoulder... for you
  const torso=ell(.55*S,.42*S,1.0*S,fur,0,.95*S,0,30); body.add(torso); hairEll(body,0,.95*S,0,.55*S,.42*S,1.0*S,1600,.07*S,hairM,V3(0,0,-.6));
  const neck=new THREE.Group(); neck.position.set(0,1.15*S,.85*S); body.add(neck);
  const head=new THREE.Group(); head.position.set(0,.35*S,.25*S); neck.add(head); head.add(ell(.36*S,.32*S,.34*S,fur,0,0,0,26)); head.add(ell(.2*S,.15*S,.2*S,fur,0,-.1*S,.26*S,18));
  hairEll(head,0,0,0,.36*S,.32*S,.34*S,500,.05*S,hairM,V3(0,0,-.4));
  for(const sd of [-1,1]){ const ear=mesh(new THREE.ConeGeometry(.13*S,.32*S,4),fur,sd*.2*S,.3*S,-.02*S); ear.rotation.z=-sd*.25; head.add(ear);
    const eye=ell(.075*S,.07*S,.04*S,new THREE.MeshStandardMaterial({color:col(0xffd020),emissive:col(0xffb000),emissiveIntensity:.9,roughness:.1}),sd*.14*S,.06*S,.29*S,16); head.add(eye);
    head.add(ell(.018*S,.06*S,.02*S,new THREE.MeshBasicMaterial({color:0x000000}),sd*.14*S,.06*S,.315*S,8)); }
  head.add(ell(.04*S,.03*S,.03*S,new THREE.MeshStandardMaterial({color:col(0x2a1a1e),roughness:.5}),0,-.05*S,.45*S,10));
  const legs=[]; for(const [x,z,f] of [[-.3,.6,1],[.3,.6,1],[-.3,-.7,-1],[.3,-.7,-1]]){ const L=new THREE.Group(); L.position.set(x*S,.85*S,z*S); body.add(L); L.add(mesh(new THREE.CylinderGeometry(.12*S,.09*S,.85*S,12),fur,0,-.42*S,0)); L.add(ell(.13*S,.07*S,.17*S,fur,0,-.85*S,.06*S,12)); legs.push(L); }
  const tail=new THREE.Group(); tail.position.set(0,1.05*S,-.95*S); body.add(tail); const tsegs=[]; let par=tail; for(let i=0;i<8;i++){ const j=new THREE.Group(); j.position.y=i?.17*S:0; par.add(j); j.add(mesh(new THREE.CylinderGeometry(.065*S,.075*S,.18*S,10),fur,0,.09*S,0)); tsegs.push(j); par=j; }
  root.userData.cat={body,neck,head,legs,tail:tsegs,S,walk:0,ph:0,crouch:0};
  root.traverse(o=>{ if(o.isMesh&&!o.isInstancedMesh){ o.castShadow=true; o.receiveShadow=true; } });
  return root;
}
function animateCat(root,dt,t){ const C=root.userData.cat; C.ph+=dt*C.walk*3.2;
  C.legs.forEach((L,i)=>{ L.rotation.x=Math.sin(C.ph+(i===0||i===3?0:Math.PI))*.45*C.walk; });
  C.body.position.y=-C.crouch*.35*C.S+Math.abs(Math.sin(C.ph))*.02*C.S*C.walk; C.body.rotation.x=C.crouch*.08;
  C.tail.forEach((j,i)=>{ j.rotation.x=-.35+Math.sin(t*1.5+i*.5)*.12*(1+C.crouch*2); j.rotation.z=Math.sin(t*2.2+i*.6)*.1; });
  C.head.rotation.x=C.crouch*.2; }
