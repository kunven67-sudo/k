/* ================================================================
   JIM'S STAND (Path A) — upgraded: stainless steel, neon, bigger.
   Behind it: the secret square hatch + keypad (code 5684).
   ================================================================ */
function neonSignTex(lines,o={}){
  return canvasTex(o.w||1024,o.h||256,(x,w,h)=>{ x.fillStyle=o.bg||'#0a0604'; x.fillRect(0,0,w,h);
    x.textAlign='center'; x.textBaseline='middle';
    lines.forEach((L,i)=>{ x.font=L.font; x.shadowColor=L.glow||L.color; x.shadowBlur=L.blur||24; x.fillStyle=L.color; for(let k=0;k<3;k++) x.fillText(L.text,w/2,L.y*h); x.shadowBlur=0; x.fillStyle='rgba(255,255,255,.75)'; x.fillText(L.text,w/2,L.y*h); });
    if(o.border){ x.strokeStyle=o.border; x.lineWidth=8; x.shadowColor=o.border; x.shadowBlur=20; x.strokeRect(10,10,w-20,h-20); }
  },null,{linear:false});
}
function keypadScreenTex(){
  const c=document.createElement('canvas'); c.width=256; c.height=128; const x=c.getContext('2d'); const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding;
  const draw=(code,state)=>{ x.fillStyle=state==='ok'?'#021a0a':'#050a08'; x.fillRect(0,0,256,128); x.fillStyle=state==='ok'?'#39ff8a':'#7dffc8'; x.font='bold 18px monospace'; x.textAlign='center';
    x.fillText(state==='ok'?'ACCESS GRANTED':'ENTER CODE',128,32); x.font='bold 44px monospace'; const s=(code+'____').slice(0,4).split('').join(' '); x.fillText(s,128,92); t.needsUpdate=true; };
  draw('',''); return {tex:t,draw};
}
defineLevel('stand',{
  title:"Jim's stand",
  env:{fx:{exposure:1.05,temp:.15,saturation:1.12,contrast:1.08,bloomStrength:.22,bloomThreshold:1.4,aoRadius:.6,vignette:.35},music:'jim',reverb:.08,amb:[['breeze',.04],['crowd',.0]],ambEvents:[['birds',7],['car',16]],surface:'gravel',far:900},
  async build(scene,lv){
    const sunDir=V3(-.5,.1,-.86).normalize();
    const sky=makeSky({top:0x24306a,mid:0x6a70b0,horizon:0xff8a50,bottom:0x3a3040,sunDir,sunColor:0xffa060,sunSize:.9992,sunGlow:1.5,clouds:.5,cloudColor:0xffb898,cloudShade:0x4a3a6a});
    scene.add(sky); lv.skyU=sky.userData.u; lv.envMap=envFromSky(sky);
    makeRig(scene,{sun:2.3,sunColor:0xffa868,hemi:.45,sky:0x8a90c8,ground:0x4a3a2a,dir:sunDir,span:16,dist:70,far:160});
    lv.sunWorld=sunDir.clone().multiplyScalar(900);
    await nextFrame();
    scene.add(tiledPlane(300,300,texMat(TX.grass(),1,1,{opts:{roughness:1,color:col(0x9ab870)}}),4,0,0,0));
    const lot=tiledPlane(26,14,texMat(TX.asphalt(),1,1,{opts:{roughness:1}}),6,-2,.01,11); scene.add(lot);
    const lineM=mat(0xf0f0f0,{roughness:.6}); for(let i=0;i<8;i++) scene.add(box(.12,.01,4.6,lineM,-13+i*3.2,.02,11.5,false));
    const pad=tiledPlane(16,12,texMat(TX.concrete(),1,1,{opts:{roughness:1}}),3,0,.012,-1); scene.add(pad);
    const path=tiledPlane(2,6,texMat(TX.concrete(),1,1,{opts:{roughness:1}}),2,0,.013,6.5); scene.add(path);
    // ---------------- the stand ----------------
    const S=new THREE.Group(); S.position.set(0,0,0); scene.add(S); lv.standG=S;
    const bm=repeatSet(TX.metalBrushed(),3,2);
    const steel=new THREE.MeshPhysicalMaterial({color:col(0xd8dce0),metalness:.95,roughness:.28,map:bm.map,roughnessMap:bm.roughnessMap,clearcoat:.3});
    const steelDark=mat(0x5a6068,{metalness:.9,roughness:.35});
    const dp=repeatSet(TX.diamondPlate(),4,1); const diamond=new THREE.MeshStandardMaterial({color:col(0xd0d4d8),metalness:.95,roughness:.35,map:dp.map,normalMap:dp.normalMap});
    const W=7, D=3, H=3.1;
    S.add(rbox(W,.25,D,.05,steelDark,0,.35,0));
    S.add(rbox(W,H,.1,.03,steel,0,.45+H/2,-D/2));                       // back wall
    for(const sd of [-1,1]) S.add(rbox(.1,H,D,.03,steel,sd*W/2,.45+H/2,0));  // sides
    S.add(rbox(W+.3,.12,D+.4,.04,steel,0,.45+H+.06,0));                   // roof
    S.add(rbox(W,1.1,.1,.03,diamond,0,1.0,D/2));                           // lower front (diamond plate)
    S.add(rbox(W,.5,.1,.03,steel,0,.45+H-.25,D/2));                        // header
    for(const sd of [-1,1]) S.add(rbox(.6,H-.5,.1,.03,steel,sd*(W/2-.3),.45+(H-.5)/2+1.05-.5,D/2));
    S.add(rbox(W-.8,.08,.6,.02,steel,0,1.58,D/2+.2));                       // counter
    // awning flap (raised)
    const aw=new THREE.Group(); aw.position.set(0,.45+H-.5,D/2+.05); S.add(aw);
    const awM=new THREE.MeshPhysicalMaterial({color:col(0xe8b020),metalness:.3,roughness:.4,clearcoat:.8});
    aw.add(rbox(W-.6,.06,1.4,.02,awM,0,0,.7)); aw.rotation.x=-.28;
    for(let i=0;i<7;i++) aw.add(box(.8,.062,1.4,mat(i%2?0xe8b020:0xc02a1a,{roughness:.5}),-2.4+i*.8,.005,.7,false));
    for(const sd of [-1,1]){ const st=cyl(.025,.025,1.6,steelDark,sd*3,.55,.6,8); st.rotation.x=-.9; aw.add(st); }
    // interior: fryers, grill, fridge, shelves with jars of bugs, lights
    const inner=new THREE.Group(); S.add(inner);
    inner.add(rbox(W-.4,.9,.8,.03,steel,0,.9,-D/2+.5));
    const oilM=new THREE.MeshPhysicalMaterial({color:col(0xc8901a),roughness:.1,clearcoat:1,emissive:col(0x3a2000),emissiveIntensity:.5});
    for(let i=0;i<3;i++){ inner.add(rbox(.6,.3,.5,.03,steelDark,-2.2+i*.8,1.45,-D/2+.5)); const oil=mesh(new THREE.PlaneGeometry(.5,.4),oilM,-2.2+i*.8,1.61,-D/2+.5,false); oil.rotation.x=-Math.PI/2; inner.add(oil); }
    inner.add(rbox(1.2,.1,.8,.02,mat(0x1a1a1a,{metalness:.8,roughness:.5}),.7,1.4,-D/2+.5));
    inner.add(rbox(.9,2.2,.7,.05,new THREE.MeshPhysicalMaterial({color:col(0xf0f2f4),metalness:.6,roughness:.2,clearcoat:1}),2.7,1.55,-D/2+.45));
    inner.add(box(.03,1.4,.02,steelDark,2.3,1.7,-D/2+.82));
    const jarM=new THREE.MeshPhysicalMaterial({color:col(0xffffff),roughness:.05,transparent:true,opacity:.3,clearcoat:1});
    for(let i=0;i<6;i++){ const j=cyl(.09,.09,.24,jarM,-2.6+i*.55,2.62,-D/2+.25,16,false); inner.add(j); inner.add(cyl(.07,.07,.16,mat(pick([0x6a3a1a,0x3a5a1a,0x8a6a2a,0x2a1a10]),{roughness:.9}),-2.6+i*.55,2.58,-D/2+.25,12,false)); }
    inner.add(box(W-.4,.03,.35,steel,0,2.48,-D/2+.25,false));
    const innerL=new THREE.PointLight(col(0xfff0d8),1.6,6,2); innerL.position.set(0,2.9,.2); S.add(innerL);
    // menu board (LED)
    const menuT=canvasTex(512,256,(x,w,h)=>{ x.fillStyle='#050505'; x.fillRect(0,0,w,h); x.font='bold 30px monospace'; x.fillStyle='#ffcc33'; x.textAlign='center'; x.fillText('~ MENU ~',w/2,40); x.textAlign='left'; x.font='bold 24px monospace';
      [['BUG NUGGETS','$4'],['ANT FRIES','$3'],['CRICKET CRUNCH','$5'],['BEETLE BURGER','$7'],['GRUB SMOOTHIE','$4']].forEach(([n,p],i)=>{ x.fillStyle='#7dffe8'; x.fillText(n,30,86+i*34); x.fillStyle='#ff7ab0'; x.fillText(p,420,86+i*34); }); });
    const menu=mesh(new THREE.PlaneGeometry(2.2,1.1),new THREE.MeshBasicMaterial({map:menuT}),-2.2,3.1,D/2+.07,false); menu.material.color.setScalar(1.6); S.add(menu);
    // big neon sign on the roof
    const signT=neonSignTex([{text:"JIM'S BUG BITES",font:'bold 132px Impact, Arial Black, sans-serif',color:'#ffcc33',glow:'#ff8a00',y:.42,blur:30},{text:'★ NOW MADE OF METAL ★',font:'bold 54px Arial Black, sans-serif',color:'#ff4aa8',glow:'#ff2a88',y:.82}],{border:'#39d8ff'});
    const sign=mesh(new THREE.PlaneGeometry(5.6,1.4),new THREE.MeshBasicMaterial({map:signT,transparent:false}),0,4.55,D/2-.3,false); sign.material.color.setScalar(2.6); S.add(sign);
    S.add(rbox(5.8,1.55,.1,.04,steelDark,0,4.55,D/2-.37));
    for(const sd of [-1,1]) S.add(box(.08,.9,.08,steelDark,sd*2.6,3.8,D/2-.35));
    lv.signLight=new THREE.PointLight(col(0xffa040),2,10,2); lv.signLight.position.set(0,4.4,D/2+1.2); S.add(lv.signLight);
    // chrome ant on the roof (a giant version of the intro ant)
    const chromeAnt=makeAnt({seed:2,hairs:false,shine:1});
    chromeAnt.traverse(o=>{ if(o.isMesh) o.material=new THREE.MeshPhysicalMaterial({color:col(0xd8dce2),metalness:1,roughness:.12,clearcoat:1}); });
    chromeAnt.scale.setScalar(2.2); chromeAnt.position.set(-2.4,3.66,-.6); chromeAnt.rotation.y=.9; S.add(chromeAnt); lv.chromeAnt=chromeAnt;
    // string lights to poles
    lv.bulbs=[];
    const poleM=mat(0x4a3a2a,{roughness:.9});
    const poles=[V3(-8,0,7),V3(8,0,7)];
    for(const p of poles){ scene.add(cyl(.08,.1,4.2,poleM,p.x,2.1,p.z,10)); lv.col&&0; }
    const addString=(a,b)=>{ const n=14; for(let i=0;i<=n;i++){ const k=i/n; const p=a.clone().lerp(b,k); p.y-=Math.sin(k*Math.PI)*.6; const bl=mesh(GC('sbulb',()=>new THREE.SphereGeometry(.07,10,8)),basicGlow(pick([0xffd08a,0xffb060,0xfff0c0]),5),p.x,p.y,p.z,false); scene.add(bl); lv.bulbs.push(bl); } };
    addString(V3(-3.4,3.9,1.6),V3(-8,4.1,7)); addString(V3(3.4,3.9,1.6),V3(8,4.1,7));
    // picnic tables with umbrellas
    const tableWoodM=texMat(woodTex('picnic',512,{planks:4,base:[140,100,70]}),1,1,{opts:{roughness:1}});
    for(const [x,z,c] of [[-5,5.5,0xc02a1a],[5,5.5,0x2a6ac0],[-6.5,1,0xe8b020]]){ const t=new THREE.Group(); t.position.set(x,0,z); scene.add(t);
      t.add(box(1.8,.06,.8,tableWoodM,0,.75,0)); for(const sd of [-1,1]) t.add(box(1.8,.05,.28,tableWoodM,0,.45,sd*.6)); for(const [lx,lz] of [[-.7,-.3],[.7,-.3],[-.7,.3],[.7,.3]]) t.add(box(.06,.75,.06,tableWoodM,lx,.375,lz));
      t.add(cyl(.025,.025,2.4,mat(0xdddddd,{metalness:.8,roughness:.3}),0,1.2,0,8)); t.add(mesh(new THREE.ConeGeometry(1.3,.5,12,1,true),new THREE.MeshStandardMaterial({color:col(c),roughness:.8,side:THREE.DoubleSide}),0,2.3,0));
      colBoxC(lv.col,x,z,1.9,1.5); }
    // trash can + a few decorative barrels
    scene.add(cyl(.3,.28,.9,mat(0x2a5a3a,{metalness:.5,roughness:.5}),4.2,.45,2.4,16)); colCircle(lv.col,4.2,2.4,.35);
    // ---------------- the secret hatch behind the stand ----------------
    const HZ=-5.2;
    const hatchBase=rbox(2.2,.08,2.2,.03,mat(0x4a4e52,{metalness:.8,roughness:.5}),0,.04,HZ); scene.add(hatchBase);
    const hp=new THREE.Group(); hp.position.set(0,.09,HZ-.8); scene.add(hp);   // hinge at the back edge
    const lid=rbox(1.6,.08,1.6,.02,diamond,0,0,.8); hp.add(lid);
    for(const sd of [-1,1]) hp.add(box(.2,.1,.12,steelDark,sd*.5,0,0));
    hp.add(box(.3,.05,.1,mat(0xe8b020),0,.05,1.4));
    lv.hatch={pivot:hp,open:0,target:0};
    const hole=mesh(new THREE.PlaneGeometry(1.5,1.5),new THREE.MeshBasicMaterial({color:0x000000}),0,.083,HZ,false); hole.rotation.x=-Math.PI/2; scene.add(hole);
    lv.hatchLight=new THREE.PointLight(col(0x7ad8ff),0,5,2); lv.hatchLight.position.set(0,.4,HZ); scene.add(lv.hatchLight);
    // ladder top rails
    for(const sd of [-1,1]){ const r=cyl(.025,.025,1.2,steelDark,sd*.35,.5,HZ-.65,8); scene.add(r); }
    lv.ladderTop=V3(0,0,HZ-.5);
    // keypad post
    const kp=new THREE.Group(); kp.position.set(1.5,0,HZ+.8); kp.rotation.y=-.6; scene.add(kp); lv.keypad=kp;
    kp.add(cyl(.06,.08,1.1,steelDark,0,.55,0,12));
    kp.add(rbox(.36,.5,.1,.03,mat(0x1a1c20,{metalness:.7,roughness:.3}),0,1.25,0));
    lv.kpScreen=keypadScreenTex();
    const scr=mesh(new THREE.PlaneGeometry(.28,.14),new THREE.MeshBasicMaterial({map:lv.kpScreen.tex}),0,1.4,.051,false); scr.material.color.setScalar(1.8); kp.add(scr);
    lv.keys=[];
    for(let r=0;r<4;r++) for(let c=0;c<3;c++){ const n=r*3+c+1; const label=n<=9?String(n):(n===10?'*':n===11?'0':'#'); const kt=canvasTex(64,64,(x)=>{ x.fillStyle='#2a2e34'; x.fillRect(0,0,64,64); x.fillStyle='#e8ecf0'; x.font='bold 40px sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(label,32,34); });
      const k=mesh(roundedBoxGeo(.06,.045,.02,.006),new THREE.MeshStandardMaterial({map:kt,roughness:.5,metalness:.3}),-.075+c*.075,1.3-r*.055,.055,false); kp.add(k); lv.keys[label]=k; }
    const green=mesh(GC('greenBtn',()=>{ const c=new THREE.CylinderGeometry(.03,.03,.02,20); c.rotateX(Math.PI/2); return c; }),emissiveMat(0x39ff6a,1.2),0,1.07,.06,false); kp.add(green); lv.greenBtn=green;
    colCircle(lv.col,kp.position.x,kp.position.z,.2);
    lv.hatchCol=colBox(lv.col,-.8,.8,HZ-.8,HZ+.8,()=>!lv.hatchPassable);
    // ---------------- collision + surroundings ----------------
    colBox(lv.col,-W/2-.1,W/2+.1,-D/2-.1,D/2+.35);
    colCircle(lv.col,-8,7,.2); colCircle(lv.col,8,7,.2);
    const trees=[{x:-14,z:-8},{x:12,z:-10},{x:-18,z:6},{x:17,z:4},{x:-10,z:-18},{x:4,z:-20},{x:22,z:-18},{x:-26,z:-2},{x:26,z:16},{x:-24,z:22}];
    makeTrees(scene,trees.map(t=>({x:t.x,z:t.z,h:rand(7,10)})),{seed:21});
    for(const t of trees) colCircle(lv.col,t.x,t.z,.45);
    makeBushes(scene,[{x:-4.5,z:-2.2,h:1.1},{x:4.6,z:-2.4,h:1.2},{x:-9,z:-4},{x:9,z:-3}],{seed:6});
    makeGrass(scene,{x0:-30,x1:30,z0:-28,z1:24,skip:(x,z)=>(x>-15&&x<11&&z>3.8&&z<18.2)||(Math.abs(x)<8.2&&z>-7.2&&z<5.2)},dq(0,3500,10000,18000,30000),{h:.24});
    for(const p of [[-16,20],[12,20]]){ const sl=makeStreetlight(1,SETTINGS.detail>=2); sl.position.set(p[0],0,p[1]); scene.add(sl); }
    lv.col.bounds=[-30,30,-26,24];
    lv.surfaceAt=(x,z)=>{ if(x>-15&&x<11&&z>4&&z<18) return 'concrete'; if(Math.abs(x)<8&&z>-7&&z<5) return 'concrete'; return 'grass'; };
    // car (arrives), Jim
    lv.car=makeCar({night:true}); lv.car.position.set(-9,0,11.5); lv.car.rotation.y=0; scene.add(lv.car);
    lv.carCol=colOBB(lv.col,-9,11.5,4.7,1.95,0);
    lv.jim=makeJim(); lv.jim.userData.level='stand'; scene.add(lv.jim);
  },
  enter(){ FX.sunWorld=this.sunWorld; FX.rays=.3; FX.raysColor.set(1,.65,.4); },
  update(dt,t){
    const lv=this;
    const H=lv.hatch; H.open=damp(H.open,H.target,1.6,dt); H.pivot.rotation.x=-H.open*1.9;
    lv.signLight.intensity=1.8+Math.sin(t*23)*.05+(Math.random()<.004?-1.2:0);
    lv.chromeAnt.userData.A.antT+=0; animateAnt(lv.chromeAnt,0,t);
    WIND.time.value=t;
  }
});

