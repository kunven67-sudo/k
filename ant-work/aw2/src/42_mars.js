/* ================================================================
   MARS (Path B) — robot town, Jim's new stand, the Bug Cooker 3000,
   the alien bug patch, and Crater Lane (houses for sale).
   ================================================================ */
function marsHeight(x,z){
  let h=Math.sin(x*.05+z*.02)*1.2+Math.sin(x*.013-z*.021)*2.4+fbm2(x*.02,z*.02,4)*2.2+fbm2(x*.08,z*.08,2)*.25;
  const d=Math.hypot(x-4,z-12); h*=smooth(invLerp(46,80,d));
  const bp=Math.hypot(x+15,z-2)/8; if(bp<1.4) h-=bp<1?.9*(1-bp*bp):0;
  return h;
}
function marsGroundTex(){ return texSet('marsGround',512,(x,w,h)=>{ noiseFill(x,w,h,n=>{ const k=.8+n*.5; return [190*k,98*k,58*k]; },7,5); for(let i=0;i<1400;i++){ const r=rand(.5,3.5); x.fillStyle=`rgba(${rand(90,200)},${rand(40,90)},${rand(20,50)},${rand(.2,.6)})`; x.beginPath(); x.arc(rand(0,w),rand(0,h),r,0,7); x.fill(); } for(let i=0;i<30;i++){ x.strokeStyle='rgba(255,200,160,.08)'; x.lineWidth=rand(4,12); x.beginPath(); const y=rand(0,h); x.moveTo(0,y); x.bezierCurveTo(w*.3,y+rand(-20,20),w*.6,y+rand(-20,20),w,y); x.stroke(); } },{strength:3}); }
function strataTex(){ return texSet('strata',[256,512],(x,w,h)=>{ for(let j=0;j<h;j++){ const n=noise2(0,j*.05)*.5+noise2(3,j*.2)*.25; const k=.7+n*.4; x.fillStyle=`rgb(${170*k|0},${82*k|0},${50*k|0})`; x.fillRect(0,j,w,1); } for(let i=0;i<300;i++){ x.fillStyle=`rgba(40,20,10,${rand(.1,.3)})`; x.fillRect(rand(0,w),rand(0,h),rand(2,20),1); } },{strength:2.5}); }
function holoSignTex(lines,colr='#6dffd8'){ return canvasTex(512,256,(x,w,h)=>{ x.clearRect(0,0,w,h); x.fillStyle='rgba(10,40,40,.35)'; x.fillRect(0,0,w,h); x.strokeStyle=colr; x.lineWidth=6; x.shadowColor=colr; x.shadowBlur=16; x.strokeRect(8,8,w-16,h-16); x.textAlign='center'; x.fillStyle=colr;
  lines.forEach(L=>{ x.font=L.font; x.fillText(L.text,w/2,L.y*h); }); for(let j=0;j<h;j+=4){ x.fillStyle='rgba(0,0,0,.15)'; x.fillRect(0,j,w,1); } },null); }
function alienHouse(kind){
  const g=new THREE.Group();
  const shell=new THREE.MeshPhysicalMaterial({color:col({big:0xe8e2dc,mid:0xd8c8b8,tiny:0xa89080,extra:0xc8d8e0}[kind]),roughness:.5,clearcoat:.4});
  const trim=emissiveMat({big:0x7af0ff,mid:0xff9ae8,tiny:0xffc060,extra:0x9aff7a}[kind],1.6);
  const win=emissiveMat(0xffd89a,1.4);
  if(kind==='big'){ g.add(mesh(new THREE.SphereGeometry(6,40,20,0,Math.PI*2,0,Math.PI/2),shell,0,0,0)); g.add(mesh(new THREE.SphereGeometry(3.6,32,16,0,Math.PI*2,0,Math.PI/2),shell,6.5,0,1)); g.add(cyl(1.2,1.6,11,shell,-4,5.5,-2,24)); g.add(mesh(new THREE.SphereGeometry(2,24,16),new THREE.MeshPhysicalMaterial({color:col(0x9ae8ff),roughness:.05,transparent:true,opacity:.5,clearcoat:1}),-4,11.4,-2)); g.add(mesh(new THREE.TorusGeometry(6.05,.12,8,64),trim,0,.3,0,false)).children; g.children[g.children.length-1].rotation.x=Math.PI/2; for(let i=0;i<6;i++){ const a=i/6*Math.PI*2; g.add(box(.9,.7,.1,win,Math.cos(a)*5.1,2.4,Math.sin(a)*5.1,false)).children; g.children[g.children.length-1].lookAt(0,2.4,0); } g.userData.door=V3(0,0,6.2); g.userData.w=16; g.userData.d=13; }
  else if(kind==='mid'){ g.add(mesh(new THREE.SphereGeometry(4,36,18,0,Math.PI*2,0,Math.PI/2),shell,0,0,0)); g.add(cyl(.8,1,6,shell,2.6,3,-1.5,20)); g.add(mesh(new THREE.ConeGeometry(1.1,1.4,20),trim,2.6,6.7,-1.5)); g.add(mesh(new THREE.TorusGeometry(4.05,.1,8,48),trim,0,.25,0,false)).children; g.children[g.children.length-1].rotation.x=Math.PI/2; for(let i=0;i<4;i++){ const a=i/4*Math.PI*2+.4; g.add(box(.8,.6,.1,win,Math.cos(a)*3.4,1.8,Math.sin(a)*3.4,false)).children; g.children[g.children.length-1].lookAt(0,1.8,0); } g.userData.door=V3(0,0,4.1); g.userData.w=9; g.userData.d=9; }
  else if(kind==='tiny'){ g.add(mesh(new THREE.SphereGeometry(2.2,28,14,0,Math.PI*2,0,Math.PI/2),shell,0,0,0)); const p=box(1,.8,.05,mat(0x7a6a5a,{roughness:.9}),1.2,1.1,1.5); p.rotation.set(.3,.6,.1); g.add(p); g.add(cyl(.12,.12,1.2,mat(0x6a6a6a,{metalness:.7}),-1.1,2.1,.3,8)); g.add(mesh(new THREE.TorusGeometry(2.25,.08,8,40),trim,0,.2,0,false)).children; g.children[g.children.length-1].rotation.x=Math.PI/2; g.add(box(.6,.5,.08,win,-.9,1.2,1.85,false)); g.userData.door=V3(0,0,2.3); g.userData.w=5; g.userData.d=5; }
  else { // hex house (Jim's): a flat wall faces the door side, so the door sits ON the wall
    const hx=mesh(new THREE.CylinderGeometry(3.4,3.8,3.4,6),shell,0,1.7,0); hx.rotation.y=Math.PI/6; g.add(hx); const cn=mesh(new THREE.ConeGeometry(4,2.4,6),trim,0,4.6,0); cn.rotation.y=Math.PI/6; g.add(cn);
    for(const sd of [-1,1]){ const a=sd*Math.PI/3, r=3.14; const w=box(.9,.7,.06,win,Math.sin(a)*r,2.05,Math.cos(a)*r,false); w.rotation.y=a; g.add(w); }
    g.userData.door=V3(0,0,3.45); g.userData.w=8; g.userData.d=8; }
  const doorM=new THREE.MeshPhysicalMaterial({color:col(0x3a2a4a),roughness:.3,clearcoat:1,emissive:col(0x1a0a2a)});
  const dp=g.userData.door; const door=mesh(new THREE.CircleGeometry(kind==='tiny'?.7:1.1,32,0,Math.PI),doorM,dp.x,0,dp.z-.15,false); g.add(door); g.add(mesh(new THREE.RingGeometry(kind==='tiny'?.7:1.1,kind==='tiny'?.8:1.22,32,1,0,Math.PI),trim,dp.x,0,dp.z-.14,false));
  g.userData.doorMesh=door; return g;
}
defineLevel('mars',{
  title:'Mars',
  env:{fx:{exposure:.86,temp:.1,saturation:1.12,contrast:1.12,bloomStrength:.2,bloomThreshold:1.6,aoRadius:.7,vignette:.35},music:'mars',reverb:.06,amb:[['marsWind',.07],['crowd',.012]],ambEvents:[['robotBeep',4]],gravity:9,jump:4.6,surface:'mars',far:1600},
  async build(scene,lv){
    const sunDir=V3(.25,.88,.38).normalize();
    const sky=makeSky({top:0x7a5240,mid:0xc88a60,horizon:0xe8c098,bottom:0x8a5a3a,sunDir,sunColor:0xe8f0ff,sunSize:.9996,sunGlow:.9,clouds:.25,cloudColor:0xf0d8c0,cloudShade:0xa06a50,horizonLift:.02});
    scene.add(sky); lv.skyU=sky.userData.u; lv.envMap=envFromSky(sky);
    makeRig(scene,{sun:2.7,sunColor:0xfff0e0,hemi:.45,sky:0xe8b890,ground:0x7a3a20,dir:sunDir,span:22,dist:90,far:220});
    lv.sunWorld=sunDir.clone().multiplyScalar(900);
    scene.fog=new THREE.FogExp2(col(0xd8a880),.0045); lv.fogBase=.0045;
    await nextFrame();
    // terrain
    const S=dq(140,180,240,280,320);
    const tg=new THREE.PlaneGeometry(600,600,S,S); tg.rotateX(-Math.PI/2); const tp=tg.attributes.position;
    for(let i=0;i<tp.count;i++) tp.setY(i,marsHeight(tp.getX(i),tp.getZ(i))); tg.computeVertexNormals();
    const mg=repeatSet(marsGroundTex(),100,100);
    scene.add(mesh(tg,new THREE.MeshStandardMaterial({map:mg.map,normalMap:mg.normalMap,roughness:1,color:col(0xe0b8a0)}),0,0,0,false)); scene.children[scene.children.length-1].receiveShadow=true;
    lv.hf=heightField(600,S,marsHeight);
    lv.ground=(x,z)=>lv.hf.at(x,z)+(lv.plazaAt(x,z)?.05:0);
    // mesas on the horizon
    const st=strataTex();
    for(let i=0;i<9;i++){ const a=i/9*Math.PI*2+.3, d=rand(260,380); const w=rand(40,110), hh=rand(25,60); const m=mesh(new THREE.CylinderGeometry(w*.8,w,hh,9,4),new THREE.MeshStandardMaterial({map:repeatSet(st,3,1).map,normalMap:repeatSet(st,3,1).normalMap,roughness:1,color:col(0xe0a888)}),Math.cos(a)*d,hh/2-4,Math.sin(a)*d,false); const mp=m.geometry.attributes.position; for(let k=0;k<mp.count;k++){ mp.setX(k,mp.getX(k)*(1+noise2(mp.getY(k)*.1+i,k*.01)*.12)); } m.geometry.computeVertexNormals(); scene.add(m); }
    // rocks
    const rockM=new THREE.MeshStandardMaterial({color:col(0x9a5a3a),roughness:.95,normalMap:marsGroundTex().normalMap});
    const RB=new Builder(); const rg=RNG(5);
    for(let i=0;i<dq(50,90,140,180,240);i++){ const x=rg()*420-210, z=rg()*420-210; if(Math.hypot(x-4,z-12)<48) continue; const s=rg()*2.2+.3; RB.add(crumbGeo(400+i%24,1),rockM,x,marsHeight(x,z)+s*.2,z,rg()*3,rg()*3,rg()*3,s,s*.75,s); }
    scene.add(RB.build(true,true));
    // ---------------- plaza + robot town ----------------
    const plazaT=texSet('hexTiles',512,(x,w,h)=>{ x.fillStyle='#8a5a48'; x.fillRect(0,0,w,h); const r=32; for(let j=-1;j<h/(r*1.5)+1;j++) for(let i=-1;i<w/(r*1.73)+1;i++){ const cx=i*r*1.73+(j%2)*r*.86, cy=j*r*1.5; const k=rand(.85,1.05); x.fillStyle=`rgb(${196*k|0},${150*k|0},${126*k|0})`; x.beginPath(); for(let q=0;q<6;q++){ const a=q/6*Math.PI*2+Math.PI/6; x.lineTo(cx+Math.cos(a)*r*.94,cy+Math.sin(a)*r*.94); } x.fill(); } },{strength:2.5});
    // the plaza has a hole where the bug pit is (it used to float over the pit, so you walked under the floor)
    const pzPts=[]; { const C=[-19,2], R=9, cc=C[0]*C[0]+C[1]*C[1]-R*R; for(let i=0;i<180;i++){ const a=i/180*Math.PI*2, ux=Math.cos(a), uy=Math.sin(a); const b=ux*C[0]+uy*C[1], disc=b*b-cc; let t=26; if(disc>=0){ const t1=b-Math.sqrt(disc); if(t1>0&&t1<26) t=t1; } pzPts.push(new THREE.Vector2(ux*t,uy*t)); } }
    const pzShape=new THREE.Shape(pzPts);
    const plaza=mesh(new THREE.ShapeGeometry(pzShape,64),texMat(plazaT,8/52,8/52,{opts:{roughness:.85}}),4,.05,4,false); plaza.rotation.x=-Math.PI/2; plaza.receiveShadow=true; scene.add(plaza);
    lv.plazaAt=(x,z)=>Math.hypot(x-4,z-4)<26&&Math.hypot(x+15,z-2)>9;
    const lane=tiledPlane(60,8,texMat(plazaT,1,1,{opts:{roughness:.85}}),6,14,.06,30); scene.add(lane);
    lv.surfaceAt=(x,z)=>(lv.plazaAt(x,z)||(z>26&&z<34&&x>-16&&x<44))?'tile':'mars';
    const bldM=new THREE.MeshPhysicalMaterial({color:col(0xe2d4c6),roughness:.45,clearcoat:.5}), orangeM=mat(0xe86a2a,{roughness:.5}), glassB=new THREE.MeshPhysicalMaterial({color:col(0x6ac8e8),roughness:.05,metalness:.3,clearcoat:1,transparent:true,opacity:.7});
    const signs=[['ROBO-MART','#6dffd8'],['OIL BAR','#ff7ab0'],['BOLTS & NUTS','#ffcc33'],['SPARE PARTS','#9aff7a'],['RECHARGE','#7ab0ff']];
    const blds=[[-18,-10,0],[-22,8,1],[26,-8,2],[24,-20,3],[-6,-22,4],[10,-26,0]];
    blds.forEach(([x,z,k],i)=>{ const g=new THREE.Group(); g.position.set(x,marsHeight(x,z),z); g.lookAt(4,g.position.y,4); scene.add(g);
      const H=rand(7,16), R=rand(3.5,5.5);
      g.add(cyl(R,R*1.1,H,bldM,0,H/2,0,32)); g.add(mesh(new THREE.SphereGeometry(R,32,16,0,Math.PI*2,0,Math.PI/2),glassB,0,H,0)); g.add(cyl(R+.1,R+.1,.4,orangeM,0,H*.3,0,32)); g.add(cyl(R+.1,R+.1,.25,emissiveMat(pick([0x6dffd8,0xff7ab0,0xffcc33]),2),0,H*.62,0,32,false));
      for(let w=0;w<8;w++){ const a=w/8*Math.PI*2; const wi=box(.9,1.2,.1,emissiveMat(0xffe0b0,1.2),Math.sin(a)*R*1.01,H*.45,Math.cos(a)*R*1.01,false); wi.rotation.y=a; g.add(wi); }
      const [txt,c]=signs[k]; const sgn=mesh(new THREE.PlaneGeometry(4,1.2),new THREE.MeshBasicMaterial({map:neonSignTex([{text:txt,font:'bold 110px Arial Black, sans-serif',color:c,glow:c,y:.55}],{bg:'#080404',w:1024,h:256})}),0,3.4,R+.15,false); sgn.material.color.setScalar(2); g.add(sgn);
      colCircle(lv.col,x,z,R+.4); });
    // street lamps
    for(let i=0;i<8;i++){ const a=i/8*Math.PI*2; const x=4+Math.cos(a)*24, z=4+Math.sin(a)*24; const l=new THREE.Group(); l.position.set(x,marsHeight(x,z),z); scene.add(l); l.add(cyl(.08,.12,4.5,mat(0x3a3e44,{metalness:.8}),0,2.25,0,8)); l.add(sph(.35,emissiveMat(0x9af0ff,3),0,4.7,0,16,12,false)); colCircle(lv.col,x,z,.2); }
    // ---------------- Jim's Mars stand ----------------
    const S2=new THREE.Group(); S2.position.set(0,.05,-4); scene.add(S2); lv.stand=S2;
    const white=new THREE.MeshPhysicalMaterial({color:col(0xf4f2ee),roughness:.3,clearcoat:.8}), ora=new THREE.MeshPhysicalMaterial({color:col(0xf07a2a),roughness:.35,clearcoat:.8});
    S2.add(rbox(6,1.1,2.4,.2,white,0,.55,0)); S2.add(rbox(6.2,.12,2.6,.05,ora,0,1.14,0)); S2.add(rbox(6,.4,2.6,.15,white,0,3.4,-.1)); for(const sd of [-1,1]) S2.add(rbox(.3,2.3,.3,.1,ora,sd*2.8,2.25,-.9));
    S2.add(rbox(6.4,.18,3.4,.08,ora,0,3.7,.1));
    const marsSign=neonSignTex([{text:"JIM'S BUG BITES",font:'bold 128px Impact, Arial Black, sans-serif',color:'#ffcc33',glow:'#ff6a00',y:.42,blur:30},{text:'MARS BRANCH · ALIEN BUG FOOD',font:'bold 50px Arial Black, sans-serif',color:'#6dffd8',glow:'#00c8a0',y:.83}],{border:'#ff7ab0'});
    const msg=mesh(new THREE.PlaneGeometry(5,1.25),new THREE.MeshBasicMaterial({map:marsSign}),0,4.55,.35,false); msg.material.color.setScalar(2.4); S2.add(msg); S2.add(rbox(5.2,1.4,.1,.04,mat(0x2a2a30,{metalness:.8}),0,4.55,.28));
    const menuM=holoSignTex([{text:'ALIEN BUG FOOD',font:'bold 44px monospace',y:.25},{text:'NUGGETS ...... 3',font:'bold 30px monospace',y:.48},{text:'CRUNCH BOWL ... 5',font:'bold 30px monospace',y:.64},{text:'GLOW STEW ..... 7',font:'bold 30px monospace',y:.8}]);
    const menu=mesh(new THREE.PlaneGeometry(1.8,.9),new THREE.MeshBasicMaterial({map:menuM,transparent:true,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}),-2.1,2.5,1.3,false); S2.add(menu);
    lv.marsJimSpot=V3(0,0,-2.6);
    colBoxC(lv.col,0,-4,6.3,2.8);
    // ---------------- the Bug Cooker 3000 ----------------
    const C=new THREE.Group(); C.position.set(5.2,.05,-3.4); scene.add(C); lv.cooker=C;
    const copper=new THREE.MeshPhysicalMaterial({color:col(0xc87a4a),metalness:1,roughness:.28,clearcoat:.4});
    const steel=mat(0x8a9098,{metalness:.9,roughness:.3});
    for(let i=0;i<3;i++){ const a=i/3*Math.PI*2; const lg=cyl(.06,.08,1.1,steel,Math.cos(a)*.75,.55,Math.sin(a)*.75,10); lg.rotation.set(Math.sin(a)*.2,0,-Math.cos(a)*.2); C.add(lg); }
    C.add(cyl(.9,.9,.08,steel,0,.6,0,40));
    const flameRing=mesh(new THREE.TorusGeometry(.5,.06,8,32),emissiveMat(0x4aa8ff,3),0,.66,0,false); flameRing.rotation.x=Math.PI/2; C.add(flameRing); lv.flameRing=flameRing;
    const pot=mesh(new THREE.LatheGeometry([[0,0],[.55,0],[.85,.12],[1,.45],[1.02,.9],[1.08,.98],[1.02,1.0],[.96,.92]].map(p=>new THREE.Vector2(p[0],p[1])),48),copper,0,.7,0); pot.material.side=THREE.DoubleSide; C.add(pot);
    C.add(mesh(new THREE.TorusGeometry(1.05,.04,8,48),steel,0,1.68,0)).children; C.children[C.children.length-1].rotation.x=Math.PI/2;
    // stew surface (animated shader) + floating bugs + stirring arm
    lv.stewU={t:WIND.time,heat:{value:0},burn:{value:0}};
    const stew=mesh(new THREE.CircleGeometry(.95,48),new THREE.ShaderMaterial({uniforms:lv.stewU,
      vertexShader:`varying vec2 vUv; uniform float t; void main(){ vUv=uv; vec3 p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
      fragmentShader:`varying vec2 vUv; uniform float t,heat,burn;
        float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
        void main(){ vec2 p=vUv*6.0; float sw=n(p+vec2(t*0.4,t*0.3))*0.6+n(p*2.3-vec2(t*0.5,0.0))*0.4;
          vec3 base=mix(vec3(0.55,0.22,0.05),vec3(0.95,0.55,0.12),sw); base=mix(base,vec3(0.25,0.9,0.5),smoothstep(0.55,0.75,n(p*1.2+t*0.2))*0.5);
          float bub=0.0; for(int i=0;i<6;i++){ vec2 c=vec2(h(vec2(float(i),1.0)),h(vec2(float(i),2.0)))*6.0; float ph=fract(t*(0.4+heat)+h(vec2(float(i),3.0))); float r=ph*0.35; bub+=smoothstep(0.04,0.0,abs(length(p-c)-r))*(1.0-ph); }
          vec3 c=base*(1.2+heat*1.6)+vec3(1.0,0.9,0.6)*bub*(0.5+heat);
          c=mix(c,vec3(0.08,0.05,0.04),burn*0.8);
          gl_FragColor=vec4(c,1.0);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`}),0,1.45,0,false); stew.rotation.x=-Math.PI/2; C.add(stew); lv.stew=stew;
    lv.potBugs=[]; for(let i=0;i<8;i++){ const b=makeMarsBug(false,i+50); b.scale.setScalar(.35); b.visible=false; b.position.set(rand(-.5,.5),1.46,rand(-.5,.5)); b.rotation.set(Math.PI*.4,rand(0,6),0); C.add(b); lv.potBugs.push(b); }
    const armP=new THREE.Group(); armP.position.set(-1.2,.6,0); C.add(armP);
    armP.add(cyl(.1,.12,1.8,steel,0,.9,0,12)); const arm1=new THREE.Group(); arm1.position.y=1.8; armP.add(arm1);
    arm1.add(sph(.14,ora,0,0,0,12,10)); const a1=box(1.1,.12,.12,steel,.55,0,0); arm1.add(a1);
    const arm2=new THREE.Group(); arm2.position.x=1.1; arm1.add(arm2); arm2.add(sph(.11,ora,0,0,0,12,10));
    const spoon=new THREE.Group(); arm2.add(spoon); spoon.add(cyl(.03,.03,.9,mat(0x5a3a1a),0,-.45,0,8)); spoon.add(mesh(new THREE.SphereGeometry(.14,16,10,0,Math.PI*2,Math.PI/2,Math.PI/2),steel,0,-.9,0));
    lv.stirArm={arm1,arm2,spoon};
    const panel=new THREE.Group(); panel.position.set(1.3,.9,.6); panel.rotation.y=-.8; C.add(panel);
    panel.add(rbox(.6,.8,.3,.05,white,0,.4,0)); panel.add(box(.44,.3,.02,emissiveMat(0x39ffb0,1.5),0,.55,.16,false));
    const cName=neonSignTex([{text:'BUG COOKER 3000',font:'bold 88px Arial Black, sans-serif',color:'#ff7a45',glow:'#ff4a00',y:.6}],{w:1024,h:180});
    const cn=mesh(new THREE.PlaneGeometry(2,.36),new THREE.MeshBasicMaterial({map:cName}),0,2.5,0,false); cn.material.color.setScalar(2); C.add(cn); lv.cookerSign=cn;
    lv.potLight=new THREE.PointLight(col(0xff8a3a),.6,5,2); lv.potLight.position.set(0,2,0); C.add(lv.potLight);
    colCircle(lv.col,5.2,-3.4,1.3); colCircle(lv.col,4,-3.4,.2);
    // ---------------- the alien bug patch (crater with glowing flora) ----------------
    const BP=V3(-15,0,2); lv.bugPatch=BP;
    const floraM=[emissiveMat(0x6dffd8,1.8),emissiveMat(0xff7af0,1.8),emissiveMat(0xffe066,1.6)];
    const stalkM=mat(0x5a3a4a,{roughness:.7});
    for(let i=0;i<22;i++){ const a=rand(0,6.28), r=rand(2,9); const x=BP.x+Math.cos(a)*r, z=BP.z+Math.sin(a)*r; const y=marsHeight(x,z); const hh=rand(.2,1.3);
      const st=cyl(.02,.04,hh,stalkM,x,y+hh/2,z,6,false); scene.add(st); scene.add(sph(rand(.06,.16),pick(floraM),x,y+hh,z,10,8,false)); }
    const cryM=new THREE.MeshPhysicalMaterial({color:col(0x9af0ff),roughness:.05,clearcoat:1,emissive:col(0x2a8aa0),emissiveIntensity:.8,transparent:true,opacity:.85});
    for(let i=0;i<10;i++){ const a=rand(0,6.28), r=rand(3,10); const x=BP.x+Math.cos(a)*r, z=BP.z+Math.sin(a)*r; const c=mesh(new THREE.ConeGeometry(rand(.1,.3),rand(.5,1.6),5),cryM,x,marsHeight(x,z)+.3,z,false); c.rotation.set(rand(-.4,.4),0,rand(-.4,.4)); scene.add(c); }
    const bpLight=new THREE.PointLight(col(0x6dffd8),.8,14,2); bpLight.position.set(BP.x,2,BP.z); scene.add(bpLight);
    lv.bugs=[];
    // ---------------- the landed rocket ----------------
    lv.rocket=makeRocket(); lv.rocket.position.set(22,marsHeight(22,12)+1.1,12); lv.rocket.rotation.y=2; scene.add(lv.rocket);
    colCircle(lv.col,22,12,2.4);
    // ---------------- Crater Lane: houses for sale + the converter ----------------
    const lanes=[['mid',V3(-8,0,38),100,'Dome Sweet Dome'],['big',V3(12,0,42),2000,'The Mega-Dome'],['tiny',V3(30,0,37),50,'Tiny Shack']];
    lv.houses=lanes.map(([kind,p,price,name],i)=>{
      const g=alienHouse(kind); g.position.set(p.x,marsHeight(p.x,p.z),p.z); g.rotation.y=Math.PI; scene.add(g);
      const w=g.userData.w, d=g.userData.d; for(const [cx,cz,r] of ({big:[[0,0,6.05],[6.5,1,3.65]],mid:[[0,0,4.05]],tiny:[[0,0,2.25]]}[kind]||[[0,0,3.8]])) colCircle(lv.col,p.x-cx,p.z-cz,r);
      const signT=holoSignTex([{text:'FOR SALE',font:'bold 58px Arial Black, sans-serif',y:.3},{text:'Ѫ '+price.toLocaleString(),font:'bold 80px monospace',y:.63},{text:'ALIEN COINS',font:'bold 30px monospace',y:.85}]);
      const sign=mesh(new THREE.PlaneGeometry(2.4,1.2),new THREE.MeshBasicMaterial({map:signT,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}),p.x+(i%2?2.5:-2.5),marsHeight(p.x,p.z-d/2-1)+2.2,p.z-d/2-1.2,false); scene.add(sign);
      const post=cyl(.05,.05,1.6,mat(0x3a3e44,{metalness:.8}),sign.position.x,sign.position.y-1.4,sign.position.z,8); scene.add(post);
      const seller=makeAlien({skin:[0x6ae0b0,0xe08a6a,0xb08ae0,0x5fb8e8][i],shirt:[0x1c4a7a,0x3a1a5a,0x2a5a4a,0x5a2fa0][i],accent:[0xffe066,0x7dffb0,0x7dffe8,0xff7af0][i]}); seller.userData.level='mars';
      const sp=V3(p.x+(i%2?-1.6:1.6),0,p.z-d/2-1.6); seller.userData.home=sp.clone(); seller.userData.snapGround=true; seller.position.set(sp.x,marsHeight(sp.x,sp.z),sp.z); seller.rotation.y=Math.PI; seller.userData.A.faceYaw=Math.PI; scene.add(seller);   // faces the street, not its own house
      g.updateMatrixWorld(true); const doorW=g.localToWorld(g.userData.door.clone());
      return {kind,g,price,name,seller,sign,door:doorW,sold:false};
    });
    // the converter kiosk "right by" the 100-coin house
    const K=new THREE.Group(); K.position.set(-1.5,marsHeight(-1.5,32.5),32.5); K.rotation.y=Math.PI*.9; scene.add(K); lv.converter=K;
    K.add(rbox(1.6,2.2,1.1,.2,new THREE.MeshPhysicalMaterial({color:col(0x2a3a44),metalness:.6,roughness:.3,clearcoat:1}),0,1.1,0));
    K.add(mesh(new THREE.TorusGeometry(.45,.08,12,32),emissiveMat(0x6dffd8,2.5),0,1.5,.56,false));
    const coinFace=mesh(new THREE.CircleGeometry(.36,32),new THREE.MeshBasicMaterial({map:canvasTex(128,128,(x)=>{ const g=x.createRadialGradient(50,40,0,64,64,64); g.addColorStop(0,'#d8fff4'); g.addColorStop(.5,'#35e0b6'); g.addColorStop(1,'#0f7a60'); x.fillStyle=g; x.beginPath(); x.arc(64,64,62,0,7); x.fill(); x.fillStyle='#043b2e'; x.font='bold 70px serif'; x.textAlign='center'; x.fillText('Ѫ',64,88); })}),0,1.5,.57,false); coinFace.material.color.setScalar(1.6); K.add(coinFace); lv.coinFace=coinFace;
    const kSign=holoSignTex([{text:'ALIEN CURRENCY',font:'bold 50px Arial Black, sans-serif',y:.4},{text:'CONVERTER',font:'bold 64px Arial Black, sans-serif',y:.72}]);
    const ks=mesh(new THREE.PlaneGeometry(1.8,.9),new THREE.MeshBasicMaterial({map:kSign,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}),0,2.8,.2,false); K.add(ks);
    lv.convAlien=makeAlien({skin:0x9aa0ff,shirt:0x1a2a4a,accent:0x6dffd8,height:1.08}); lv.convAlien.userData.level='mars'; K.updateMatrixWorld(true); const cp=K.localToWorld(V3(-1.1,0,.6)); lv.convAlien.position.set(cp.x,marsHeight(cp.x,cp.z),cp.z); lv.convAlien.rotation.y=Math.PI; scene.add(lv.convAlien);
    colCircle(lv.col,-1.5,32.5,1.1);
    // ---------------- robots ----------------
    lv.queue=[];
    for(let i=0;i<3;i++){ const r=makeRobot({body:pick([0xe8ecf0,0xd8e0ea,0xf0e0d0]),trim:pick([0xff7a45,0x6dffd8,0xffcc33,0xff7af0]),face:pick([0x6dffd8,0xffcc33,0x9ab0ff]),height:rand(.95,1.1)}); r.userData.level='mars'; r.position.set(-1.5+i*1.5,.05,-1); r.rotation.y=Math.PI; r.userData.A.pose='eat'; r.userData.A.happy=true; scene.add(r); lv.queue.push(r);
      const bowl=mesh(new THREE.SphereGeometry(.1,14,8,0,Math.PI*2,Math.PI/2,Math.PI/2),mat(0x6dffd8,{roughness:.3,side:THREE.DoubleSide}),0,0,0,false); r.userData.arms.L.hold.add(bowl); }
    lv.walkers=[];
    const wp=[[V3(-8,0,12),V3(14,0,18),V3(20,0,-4),V3(-4,0,-14)],[V3(18,0,8),V3(-10,0,16),V3(-14,0,-6)],[V3(2,0,20),V3(22,0,2),V3(8,0,-16),V3(-12,0,4)]];
    for(let i=0;i<3;i++){ const r=makeRobot({kind:i===1?'hover':'legs',body:pick([0xe8ecf0,0xc8d0d8]),trim:pick([0xff7a45,0x6dffd8]),face:pick([0x6dffd8,0xffcc33])}); r.userData.level='mars'; r.position.copy(wp[i][0]); scene.add(r); lv.walkers.push({r,loop:wp[i],i:0}); }
    lv.jim=makeJim(); lv.jim.userData.level='mars'; lv.jim.userData.snapGround=true; scene.add(lv.jim);
    lv.convAlien.userData.home=lv.convAlien.position.clone(); lv.convAlien.userData.snapGround=true;
    // ---------------- Jim's house: he really lives somewhere now (behind the shops) ----------------
    { const JP=V3(-15,0,-30); const g=alienHouse('extra'); g.position.set(JP.x,marsHeight(JP.x,JP.z),JP.z); scene.add(g); colCircle(lv.col,JP.x,JP.z,3.9);
      g.updateMatrixWorld(true); lv.jimHouse=g; lv.jimDoor=g.localToWorld(g.userData.door.clone());
      const signT=holoSignTex([{text:"JIM'S",font:'bold 76px Arial Black, sans-serif',y:.36},{text:'HOUSE',font:'bold 76px Arial Black, sans-serif',y:.74}],'#ffcc33');
      const sign=mesh(new THREE.PlaneGeometry(1.7,.85),new THREE.MeshBasicMaterial({map:signT,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}),lv.jimDoor.x+2.1,lv.jimDoor.y+2.4,lv.jimDoor.z+.1,false); scene.add(sign);
    }
    /* night on Mars (aliens go home, Jim works late): the sky, sun and fog slide to night */
    { const U=lv.skyU, rig=scene.userData.rig;
      lv.dayCols={top:U.top.value.clone(),mid:U.mid.value.clone(),hor:U.hor.value.clone(),bot:U.bot.value.clone(),fog:scene.fog.color.clone(),sun:rig.sun.color.clone()};
      lv.nightCols={top:col(0x04050d),mid:col(0x121226),hor:col(0x46302e),bot:col(0x180d0b),fog:col(0x261a1c),sun:col(0x8a9cff)};
      lv.sunDay=rig.sun.intensity; lv.hemiDay=rig.hemi.intensity; lv.starsDay=U.stars.value;
      lv.setNight=function(k){ this.night=k; const U=this.skyU, D=this.dayCols, N=this.nightCols, r=this.scene.userData.rig;
        for(const key of ['top','mid','hor','bot']) U[key].value.copy(D[key]).lerp(N[key],k);
        U.stars.value=lerp(this.starsDay,1,k); this.scene.fog.color.copy(D.fog).lerp(N.fog,k);
        r.sun.intensity=lerp(this.sunDay,.42,k); r.sun.color.copy(D.sun).lerp(N.sun,k); r.hemi.intensity=lerp(this.hemiDay,.2,k);
        FX.dim=lerp(1,.42,k); };   // the sky light (environment map) stays daytime, so darken the whole picture
    }
    lv.col.radius=190; lv.col.cx=0; lv.col.cz=0;
    // blowing dust
    lv.dustT=0;
  },
  enter(){ FX.sunWorld=this.sunWorld; FX.rays=.18; FX.raysColor.set(1,.9,.8);
    // every visit starts in the daytime with everybody home; scenes change it after
    this.setNight(0);
    for(const h of this.houses){ const s=h.seller, hm=s.userData.home; s.userData.A.path=null; s.visible=true; s.position.set(hm.x,marsHeight(hm.x,hm.z),hm.z); s.rotation.y=Math.PI; s.userData.A.faceYaw=Math.PI; s.userData.A.look=null; }
    const c=this.convAlien, ch=c.userData.home; c.userData.A.path=null; c.visible=true; c.position.copy(ch);
    for(const w of this.walkers) w.r.visible=true; for(const r of this.queue) r.visible=true;
  },
  update(dt,t){
    const lv=this; WIND.time.value=t;
    for(const w of lv.walkers){ const A=w.r.userData.A; if(!A.path && !w.pause){ w.i=(w.i+1)%w.loop.length; walkTo(w.r,[w.loop[w.i]],1.2).then(()=>{ w.pause=true; later(rand(1,3),()=>w.pause=false); }); } w.r.position.y=lv.ground(w.r.position.x,w.r.position.z); }
    for(const h of lv.houses) h.sign.material.opacity=.85+Math.sin(t*3+h.price)*.1;
    lv.coinFace.rotation.z+=dt*.8;
    // cooker idle animation
    const S=lv.stirArm, heat=lv.stewU.heat.value;
    S.arm1.rotation.y=t*(.8+heat*2); S.arm1.rotation.z=-.35; S.arm2.rotation.z=.35+Math.sin(t*2)*.05;
    lv.flameRing.material.emissiveIntensity=1+heat*6+Math.sin(t*20)*.3; lv.potLight.intensity=.5+heat*2.5;
    for(const b of lv.potBugs){ if(b.visible){ b.position.y=1.47+Math.sin(t*3+b.position.x*9)*.02; b.rotation.y+=dt*(.4+heat); } }
    if(Math.random()<dt*(2+heat*14)){ const p=lv.cooker.localToWorld(V3(rand(-.6,.6),1.6,rand(-.6,.6))); lv.soft.spawn(p.x,p.y,p.z,rand(-.1,.1),rand(.5,1.1),rand(-.1,.1),rand(1.5,2.5),rand(.25,.5),.95,.93,.9,.25,.1,.3,2.2); }
    // dust drifting across the plain
    lv.dustT-=dt; if(lv.dustT<=0){ lv.dustT=.06/Math.max(.3,SETTINGS.detail); const p=camera.position; lv.soft.spawn(p.x+rand(-30,30),p.y+rand(-1,4),p.z+rand(-30,30),rand(1,3),rand(-.1,.2),rand(-.5,.5),rand(3,6),rand(.8,2),.85,.6,.45,.12,0,.1,1.5); }
    updateMarsBugs(dt,t);
  }
});

