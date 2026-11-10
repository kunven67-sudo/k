/* ================================================================
   THE LAB (Path A) — Jim's secret underground lab and the shrink ray
   ================================================================ */
function concreteWallTex(){ return texSet('concWall',512,(x,w,h)=>{ speckle(x,w,h,'#8a8a86',['#80807c','#94948f','#76766f','#9a9a95'],50000,1.5); blotches(x,w,h,'rgba(60,60,55,A)',16,20,70,.18); x.strokeStyle='rgba(40,40,38,.55)'; x.lineWidth=2; x.strokeRect(0,0,w,h); x.beginPath(); x.moveTo(0,h/2); x.lineTo(w,h/2); x.stroke(); for(const [a,b] of [[.25,.25],[.75,.25],[.25,.75],[.75,.75]]){ x.fillStyle='rgba(30,30,30,.6)'; x.beginPath(); x.arc(a*w,b*h,4,0,7); x.fill(); } },{strength:1.8,rough:(x,w,h)=>{ x.fillStyle='#c8c8c8'; x.fillRect(0,0,w,h); blotches(x,w,h,'rgba(90,90,90,A)',20,20,60,.4); }}); }
function screenCanvas(kind){
  const c=document.createElement('canvas'); c.width=256; c.height=160; const x=c.getContext('2d'); const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding;
  const draw=(tt,state)=>{ x.fillStyle='#020a0c'; x.fillRect(0,0,256,160); x.strokeStyle='rgba(60,200,220,.25)'; for(let i=0;i<256;i+=32){ x.beginPath(); x.moveTo(i,0); x.lineTo(i,160); x.stroke(); } for(let j=0;j<160;j+=32){ x.beginPath(); x.moveTo(0,j); x.lineTo(256,j); x.stroke(); }
    x.font='bold 13px monospace'; x.fillStyle='#7dffe8';
    if(kind==='wave'){ x.fillText('SHRINK RAY v3.1',8,16); x.strokeStyle='#39ffb0'; x.lineWidth=2; x.beginPath(); for(let i=0;i<256;i++){ const y=80+Math.sin(i*.08+tt*4)*30*Math.sin(tt*.7+i*.01)+Math.sin(i*.3+tt*9)*6*(state||0); i?x.lineTo(i,y):x.moveTo(i,y); } x.stroke(); x.fillStyle=state>0.5?'#ff5a5a':'#7dffe8'; x.fillText(state>0.5?'CHARGING '+Math.round(state*100)+'%':'STANDBY',8,150); }
    else if(kind==='scale'){ x.fillText('TARGET SCALE',8,16); x.font='bold 30px monospace'; x.fillStyle='#ffcc33'; x.fillText('1 : '+(state>0.5?'10,000,000':'1'),8,70); x.font='12px monospace'; x.fillStyle='#7dffe8'; x.fillText('SUBJECT: YOU',8,100); x.fillText('CAGE: SEALED ✓',8,118); x.fillText('SUIT RADIO: '+(state>0?'ON':'OFF'),8,136); }
    else { x.fillText('MICRO-CAM FEED',8,16); for(let i=0;i<14;i++){ const px=(i*47+tt*14)%256, py=40+(i*31)%110; x.fillStyle=`rgba(120,255,200,${.25+.2*Math.sin(tt*2+i)})`; x.beginPath(); x.ellipse(px,py,6+i%4*3,3+i%3,tt*.3+i,0,7); x.fill(); } x.fillStyle='#ff7ab0'; x.fillText('?? UNKNOWN LIFEFORMS: '+(12+Math.floor(tt)%5),8,150); }
    t.needsUpdate=true; };
  draw(0,0); return {tex:t,draw};
}
defineLevel('lab',{
  title:"Jim's secret lab",
  env:{fx:{exposure:1.05,temp:-.12,saturation:1.05,contrast:1.1,bloomStrength:.25,bloomThreshold:1.3,aoRadius:.5,vignette:.4},music:'lab',reverb:.4,amb:[['labHum',.03],['labAir',.025]],ambEvents:[['labBeep',3]],surface:'concrete',far:120},
  async build(scene,lv){
    scene.background=col(0x0a0e10);
    lv.envMap=makeEnv({top:0x3a4a50,horizon:0x2a3438,bottom:0x1a1e20,intensity:.9,lights:[{x:0,y:20,z:0,w:30,h:4,c:0xe8f4ff,k:3},{x:0,y:6,z:-18,w:10,h:6,c:0x39ffd0,k:2}]});
    const rig=makeRig(scene,{sun:.9,sunColor:0xe8f4ff,hemi:.25,sky:0x9ab8c8,ground:0x2a2a2a,dir:V3(.3,1,.2),span:10,dist:20,far:40});
    const X0=-7,X1=7,Z0=-6,Z1=6,H=3.6;
    const cw=concreteWallTex();
    const floorM=texMat(TX.concrete(),3,3,{physical:true,opts:{roughness:.9,color:col(0x9a9a98),clearcoat:.6,clearcoatRoughness:.15}});
    scene.add(tiledPlane(X1-X0,Z1-Z0,floorM,3,0,0,0));
    const wallM=texMat(cw,1,1,{opts:{roughness:1,color:col(0xb8b8b2)}});
    for(const [x,z,w,ry] of [[0,Z0,X1-X0,0],[0,Z1,X1-X0,Math.PI],[X0,0,Z1-Z0,Math.PI/2],[X1,0,Z1-Z0,-Math.PI/2]]){ const m=wallM.clone(); m.map=wallM.map.clone(); m.map.repeat.set(w/3,H/3); m.map.needsUpdate=true; m.normalMap=wallM.normalMap.clone(); m.normalMap.repeat.set(w/3,H/3); m.normalMap.needsUpdate=true; const wl=mesh(new THREE.PlaneGeometry(w,H),m,x,H/2,z,false); wl.rotation.y=ry; wl.receiveShadow=true; scene.add(wl); }
    const ceil=mesh(new THREE.PlaneGeometry(X1-X0,Z1-Z0),mat(0x2a2e30,{roughness:.8}),0,H,0,false); ceil.rotation.x=Math.PI/2; scene.add(ceil);
    lv.col.bounds=[X0+.3,X1-.3,Z0+.3,Z1-.3];
    lv.ground=(x,z)=>Math.hypot(x,z+1.8)<.92?.24:0; // you step up onto the shrink-ray platform
    // ceiling: LED strips, pipes, cable trays
    const pipeM=mat(0x6a7278,{metalness:.8,roughness:.35}), redPipe=mat(0x9a2a1a,{metalness:.4,roughness:.5});
    for(let i=0;i<4;i++){ const z=-4.5+i*3; scene.add(box(8,.06,.18,emissiveMat(0xeef6ff,5),0,H-.04,z,false)); scene.add(box(8.2,.1,.3,mat(0x3a3e40,{metalness:.7}),0,H-.08,z)); const pl=new THREE.PointLight(col(0xe8f2ff),1.1,9,2); pl.position.set(0,H-.4,z); scene.add(pl); }
    for(const [z,r,m] of [[-5.5,.1,pipeM],[-5.2,.07,redPipe],[5.6,.12,pipeM]]){ const p=cyl(r,r,X1-X0,m,0,H-.3,z,14); p.rotation.z=Math.PI/2; scene.add(p); }
    scene.add(box(X1-X0,.06,.4,mat(0x4a4e50,{metalness:.8,roughness:.4}),0,H-.5,-3));
    // ladder shaft in the corner (you arrive here)
    const LX=-5.6, LZ=4.8;
    lv.ladderBottom=V3(LX,0,LZ);
    const shaft=box(1.6,.3,1.6,mat(0x1a1c1e),LX,H-.15,LZ); scene.add(shaft);
    const ladM=mat(0x8a9298,{metalness:.8,roughness:.35});
    for(const sd of [-1,1]) scene.add(cyl(.03,.03,H+2,ladM,LX+sd*.28,H/2+.8,LZ+.6,8));
    for(let i=0;i<12;i++) { const r=cyl(.018,.018,.56,ladM,LX,.25+i*.35,LZ+.6,6); r.rotation.z=Math.PI/2; scene.add(r); }
    colBox(lv.col,LX-.4,LX+.4,LZ+.45,LZ+.8);
    // ---------------- the shrink ray ----------------
    const R=new THREE.Group(); R.position.set(0,0,-1.8); scene.add(R); lv.ray=R;
    const steel=new THREE.MeshPhysicalMaterial({color:col(0xc8ccd0),metalness:.95,roughness:.22,clearcoat:.5});
    R.add(cyl(1,1.1,.22,steel,0,.11,0,48)); R.add(cyl(.85,.85,.03,mat(0x1a1e22,{metalness:.8,roughness:.4}),0,.235,0,48));
    lv.platRing=mesh(new THREE.TorusGeometry(.9,.035,10,64),emissiveMat(0x39ffe0,2.5),0,.24,0,false); lv.platRing.rotation.x=Math.PI/2; R.add(lv.platRing);
    for(let i=0;i<8;i++){ const a=i/8*Math.PI*2; R.add(box(.08,.02,.25,emissiveMat(0x39ffe0,1.5),Math.cos(a)*.62,.25,Math.sin(a)*.62,false)).children; R.children[R.children.length-1].rotation.y=-a; }
    for(const sd of [-1,1]){ R.add(rbox(.3,H-.2,.3,.06,steel,sd*1.35,(H-.2)/2,0)); R.add(cyl(.18,.18,.2,mat(0x39ffe0,{emissive:0x39ffe0,emissiveIntensity:1.5}),sd*1.35,1.4,0,20)); }
    R.add(rbox(3,.3,.5,.06,steel,0,H-.35,0));
    const emitter=new THREE.Group(); emitter.position.set(0,H-.6,0); R.add(emitter);
    emitter.add(mesh(new THREE.ConeGeometry(.45,.7,32,1,true),steel,0,-.2,0)); emitter.add(sph(.18,emissiveMat(0x7dffff,4),0,-.5,0,20,14,false));
    lv.rings=[];
    for(let i=0;i<3;i++){ const r=mesh(new THREE.TorusGeometry(1.05-i*.12,.04,10,64),new THREE.MeshPhysicalMaterial({color:col(0xd8dce0),metalness:1,roughness:.15,emissive:col(0x39ffe0),emissiveIntensity:.3}),0,1.2+i*.55,0); r.rotation.x=Math.PI/2; R.add(r); lv.rings.push(r); }
    lv.beam=mesh(new THREE.CylinderGeometry(.9,.9,H-.9,40,1,true),new THREE.MeshBasicMaterial({color:col(0x7dffff),transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}),0,(H-.9)/2+.25,0,false); R.add(lv.beam);
    lv.rayLight=new THREE.PointLight(col(0x39ffe0),.8,7,2); lv.rayLight.position.set(0,1.2,0); R.add(lv.rayLight);
    colCircle(lv.col,-1.35,-1.8,.25); colCircle(lv.col,1.35,-1.8,.25);
    lv.platform=R;
    // containment cage (the tiny-verse is in here)
    const cage=new THREE.Group(); cage.position.set(3.8,0,-3.4); scene.add(cage); lv.cage=cage;
    cage.add(cyl(.95,1.05,.4,steel,0,.2,0,40)); cage.add(cyl(.95,.95,.25,steel,0,2.35,0,40));
    const glass=new THREE.MeshPhysicalMaterial({color:col(0xd8f8ff),roughness:.03,transparent:true,opacity:.18,clearcoat:1,side:THREE.DoubleSide,depthWrite:false});
    cage.add(mesh(new THREE.CylinderGeometry(.88,.88,1.8,40,1,true),glass,0,1.3,0,false));
    for(let i=0;i<6;i++){ const a=i/6*Math.PI*2; cage.add(cyl(.03,.03,1.8,steel,Math.cos(a)*.9,1.3,Math.sin(a)*.9,8)); }
    const cl=new THREE.PointLight(col(0x9affc8),.9,4,2); cl.position.set(0,1.2,0); cage.add(cl);
    const tube=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(.9,.2,-1.8),V3(2,.15,-2.4),V3(3,.2,-3),V3(3.3,.6,-3.2)]),30,.1,12,false),new THREE.MeshPhysicalMaterial({color:col(0x9affc8),transparent:true,opacity:.35,roughness:.05,clearcoat:1,depthWrite:false}));
    scene.add(tube);
    colCircle(lv.col,3.8,-3.4,1.1);
    lv.cageSparks=[];
    // console
    const C=new THREE.Group(); C.position.set(-2.6,0,-.6); C.rotation.y=.55; scene.add(C); lv.console=C;
    C.add(rbox(1.9,.9,.8,.05,mat(0x3a4044,{metalness:.7,roughness:.35}),0,.45,0));
    const top=rbox(1.9,.06,.9,.03,mat(0x22262a,{metalness:.6,roughness:.4}),0,.93,.05); top.rotation.x=-.25; C.add(top);
    lv.screens=[screenCanvas('wave'),screenCanvas('scale'),screenCanvas('feed')];
    lv.screens.forEach((s,i)=>{ const f=rbox(.62,.42,.05,.02,mat(0x111316,{roughness:.4}),-.64+i*.64,1.36,-.28); C.add(f); const sm=mesh(new THREE.PlaneGeometry(.56,.35),new THREE.MeshBasicMaterial({map:s.tex}),-.64+i*.64,1.36,-.252,false); sm.material.color.setScalar(1.5); C.add(sm); });
    lv.bigRed=mesh(GC('bigBtn',()=>new THREE.CylinderGeometry(.08,.09,.06,24)),emissiveMat(0xff2a1a,1.2),.45,.99,.12,false); lv.bigRed.rotation.x=-.25; C.add(lv.bigRed);
    lv.bigGreen=mesh(GC('bigBtn',()=>new THREE.CylinderGeometry(.08,.09,.06,24)),emissiveMat(0x2aff5a,1.2),.18,.99,.12,false); lv.bigGreen.rotation.x=-.25; C.add(lv.bigGreen);
    const lev=new THREE.Group(); lev.position.set(-.6,.99,.1); C.add(lev); lev.add(cyl(.015,.015,.3,mat(0xcccccc,{metalness:1,roughness:.2}),0,.15,0,8)); lev.add(sph(.04,mat(0x1a1a1a),0,.3,0,12,10)); lev.rotation.x=.4; lv.lever=lev;
    colOBB(lv.col,-2.6,-.6,1.9,.9,.55);
    // workbench + microscope + whiteboard + shelves of jars + server rack + suit rack
    const wb=new THREE.Group(); wb.position.set(-5.2,0,-3.8); scene.add(wb);
    const bwood=texMat(woodTex('bench',512,{planks:3,base:[120,90,60]}),1,1,{opts:{roughness:1}});
    wb.add(box(2.6,.08,1,bwood,0,.9,0)); for(const [x,z] of [[-1.2,-.4],[1.2,-.4],[-1.2,.4],[1.2,.4]]) wb.add(box(.06,.9,.06,mat(0x3a3e40,{metalness:.7}),x,.45,z));
    const mic=new THREE.Group(); mic.position.set(-.6,.94,0); wb.add(mic); mic.add(rbox(.25,.04,.3,.02,mat(0x1a1a1e),0,.02,0)); mic.add(cyl(.02,.02,.4,mat(0xd8d8d8,{metalness:.8}),0,.22,-.08,8)); const tubeM=cyl(.035,.03,.25,mat(0x1a1a1e),0,.36,.02,12); tubeM.rotation.x=.5; mic.add(tubeM);
    for(let i=0;i<7;i++) wb.add(box(rand(.1,.3),.01,rand(.15,.3),mat(0xf4f0e6,{roughness:.9}),rand(-.2,1.1),.945,rand(-.3,.3),false));
    colBoxC(lv.col,-5.2,-3.8,2.7,1.1);
    const wbT=canvasTex(512,320,(x,w,h)=>{ x.fillStyle='#f4f6f4'; x.fillRect(0,0,w,h); x.strokeStyle='#1a3aaa'; x.fillStyle='#1a3aaa'; x.lineWidth=3; x.font='bold 30px Comic Sans MS,cursive'; x.fillText('TINYVERSE???',30,50); x.font='22px Comic Sans MS,cursive'; x.fillText('smaller than germs → ??',30,95); x.fillStyle='#c02020'; x.fillText("DON'T WRITE DOWN THE CODE",30,140); x.fillStyle='#1a3aaa'; x.fillText('suit + radio ✓   camera ✓',30,185); x.fillText('ask friend (the one w/ couch)',30,230); x.beginPath(); x.ellipse(400,240,50,30,.3,0,7); x.stroke(); x.beginPath(); for(let i=0;i<9;i++){ x.moveTo(360+i*10,215); x.lineTo(356+i*10,200); } x.stroke(); x.fillText('?!',450,190); });
    const board=mesh(new THREE.PlaneGeometry(2.4,1.5),new THREE.MeshStandardMaterial({map:wbT,roughness:.3}),-3,1.8,Z0+.05,false); scene.add(board); scene.add(box(2.5,1.6,.04,mat(0xb8bcc0,{metalness:.8,roughness:.3}),-3,1.8,Z0+.02));
    const jarM=new THREE.MeshPhysicalMaterial({color:col(0xc8ffe8),roughness:.05,transparent:true,opacity:.28,clearcoat:1,depthWrite:false});
    const shelves=new THREE.Group(); shelves.position.set(X0+.3,0,.2); shelves.rotation.y=Math.PI/2; scene.add(shelves);
    for(let s=0;s<3;s++){ shelves.add(box(2.6,.04,.4,mat(0x5a6064,{metalness:.7}),0,.8+s*.6,0)); for(let j=0;j<5;j++){ const jx=-1.05+j*.52; shelves.add(cyl(.1,.1,.3,jarM,jx,.97+s*.6,0,16,false)); shelves.add(sph(.05,mat(pick([0x3a5a1a,0x6a3a1a,0x2a2a1a,0x5a2a5a]),{roughness:.5}),jx,.92+s*.6,0,8,6,false)); shelves.add(cyl(.105,.105,.03,mat(0x2a2a2a),jx,1.13+s*.6,0,16)); } }
    colBox(lv.col,X0,X0+.6,-1.2,1.6);
    const rack=new THREE.Group(); rack.position.set(X1-.5,0,-4.2); scene.add(rack);
    rack.add(rbox(.8,2.2,1,.03,mat(0x16181a,{metalness:.6,roughness:.4}),0,1.1,0));
    lv.leds=[]; for(let i=0;i<40;i++){ const led=box(.02,.012,.012,emissiveMat(pick([0x39ff6a,0x39d8ff,0xffb040]),3),-.41,.3+Math.floor(i/5)*.22,-.35+(i%5)*.16,false); rack.add(led); lv.leds.push(led); }
    colBox(lv.col,X1-.95,X1,-4.75,-3.65);
    // the suit on a stand
    const suit=new THREE.Group(); suit.position.set(5.5,0,2.2); suit.rotation.y=-Math.PI/2+.3; scene.add(suit); lv.suit=suit;
    const suitM=new THREE.MeshPhysicalMaterial({color:col(0xf2f0ea),roughness:.6,sheen:col(0x444444)}), orange=mat(0xff7a2a,{roughness:.5});
    suit.add(cyl(.03,.03,1.6,mat(0x444),0,.8,-.1,8));
    suit.add(rbox(.5,.62,.3,.12,suitM,0,1.25,0)); suit.add(rbox(.42,.2,.28,.08,orange,0,.92,0)); for(const sd of [-1,1]){ suit.add(rbox(.13,.55,.13,.06,suitM,sd*.33,1.2,0)); suit.add(rbox(.15,.6,.15,.06,suitM,sd*.12,.5,0)); }
    const helm=mesh(new THREE.SphereGeometry(.2,24,18),new THREE.MeshPhysicalMaterial({color:col(0xf2f0ea),roughness:.3,clearcoat:1}),0,1.78,0); suit.add(helm);
    const visorM=new THREE.MeshPhysicalMaterial({color:col(0x2a4a5a),metalness:.8,roughness:.05,clearcoat:1}); const vis=mesh(new THREE.SphereGeometry(.19,24,16,-Math.PI/2.6,Math.PI/1.3,Math.PI/3.2,Math.PI/2.6),visorM,0,1.78,.02); suit.add(vis);
    suit.add(box(.08,.12,.05,emissiveMat(0x39ffb0,2),.12,1.4,.16,false));
    colCircle(lv.col,5.5,2.2,.4);
    // the camera Jim hands you
    lv.camProp=new THREE.Group(); lv.camProp.add(rbox(.16,.1,.07,.015,mat(0x1c1c20,{roughness:.45,metalness:.3}))); const cl2=cyl(.034,.038,.06,mat(0x0c0c0e,{metalness:.8,roughness:.2}),.02,0,.06,20); cl2.rotation.x=Math.PI/2; lv.camProp.add(cl2);
    lv.camProp.position.set(-1.8,.97,-.25); scene.add(lv.camProp);
    // Jim
    lv.jim=makeJim(); lv.jim.userData.level='lab'; scene.add(lv.jim);
    lv.chargeT=0;
  },
  enter(){ FX.sunWorld=null; },
  update(dt,t){
    const lv=this; const ch=lv.charge||0;
    lv.rings.forEach((r,i)=>{ r.rotation.z+=dt*(.3+ch*8)*(i%2?-1:1); r.position.y=1.2+i*.55+Math.sin(t*1.2+i)*.03; r.material.emissiveIntensity=.3+ch*4; });
    lv.platRing.material.emissiveIntensity=2.5+ch*6+Math.sin(t*3)*.4;
    lv.rayLight.intensity=.8+ch*6;
    lv.scrT=(lv.scrT||0)+dt; if(lv.scrT>.08){ lv.scrT=0; lv.screens[0].draw(t,ch); lv.screens[1].draw(t,lv.suited?(ch>0?1:.2):0); lv.screens[2].draw(t,0); }
    if(Math.random()<dt*12){ const l=pick(lv.leds); l.visible=!l.visible; }
    if(Math.random()<dt*6){ const cp=lv.cage.position; lv.glow.spawn(cp.x+rand(-.6,.6),rand(.6,2.1),cp.z+rand(-.6,.6),rand(-.05,.05),rand(-.02,.05),rand(-.05,.05),2,.02,.6,1,.8,.8,0,0,0); }
    if(ch>.05 && Math.random()<dt*30*ch){ const a=rand(0,6.28); const p=V3(Math.cos(a)*1.3,rand(.3,3),-1.8+Math.sin(a)*.3); lv.glow.burst(p,{color:0x7dffff,count:3,speed:1.5,size:.02,life:.25,grav:0}); }
  }
});

