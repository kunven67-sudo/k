/* ================================================================
   HOME (Path A) — your house at golden hour: living room with sun
   shafts, a working TV, the front door, porch, yard, driveway + car,
   the street and the neighbours.
   ================================================================ */
/* soft volumetric light shaft: a box from the window along the sun, additive, dusty */
function lightShaft(w,h,len,colr,k=.25){
  const g=new THREE.BoxGeometry(w,h,len,1,1,1); g.translate(0,0,-len/2);
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{c:{value:col(colr)},k:{value:k},t:{value:0},len:{value:len}},
    vertexShader:`varying vec3 vP; varying vec3 vW; void main(){ vP=position; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader:`uniform vec3 c; uniform float k,t,len; varying vec3 vP; varying vec3 vW;
      float h(vec3 p){ return fract(sin(dot(p,vec3(12.9,78.2,37.7)))*43758.5); }
      float n(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){ float along=clamp(-vP.z/len,0.0,1.0); float fade=smoothstep(0.0,0.15,along)*(1.0-along); float dust=0.6+0.4*n(vW*3.0+vec3(0.0,t*0.2,0.0)); gl_FragColor=vec4(c*k*fade*dust,1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
      }`});
  const me=new THREE.Mesh(g,m); me.renderOrder=6; me.userData.u=m.uniforms; return me;
}
function tvCanvas(){
  const c=document.createElement('canvas'); c.width=320; c.height=180; const x=c.getContext('2d'); const tex=new THREE.CanvasTexture(c); tex.encoding=THREE.sRGBEncoding;
  const ticker='  WBUG 7 NEWS · Judgment Hall finally rebuilt, five years after "the incident" · Local bug stand now "made of metal" · Weather: sunny, 0% chance of aliens ·';
  let tick=0;
  function draw(t){
    // a cartoon: an ant strolling across a sunny field
    let g=x.createLinearGradient(0,0,0,180); g.addColorStop(0,'#6ab8ff'); g.addColorStop(1,'#cfeaff'); x.fillStyle=g; x.fillRect(0,0,320,180);
    x.fillStyle='#fff'; for(let i=0;i<4;i++){ const cx=((i*110+t*12)%420)-50; x.beginPath(); x.arc(cx,30+i%2*14,14,0,7); x.arc(cx+16,26+i%2*14,18,0,7); x.arc(cx+34,32+i%2*14,12,0,7); x.fill(); }
    x.fillStyle='#5cc04a'; x.fillRect(0,120,320,60); x.fillStyle='#3c9a36'; for(let i=0;i<40;i++) x.fillRect((i*23+t*40)%330-10,118,3,8);
    const ax=((t*50)%420)-50, ay=112+Math.abs(Math.sin(t*8))*-4;
    x.fillStyle='#2a1208'; x.beginPath(); x.ellipse(ax,ay,14,10,0,0,7); x.ellipse(ax+18,ay-4,10,8,0,0,7); x.ellipse(ax+33,ay-8,11,10,0,0,7); x.fill();
    x.fillStyle='#fff'; x.beginPath(); x.arc(ax+37,ay-11,4,0,7); x.fill(); x.fillStyle='#000'; x.beginPath(); x.arc(ax+38,ay-11,2,0,7); x.fill();
    x.strokeStyle='#2a1208'; x.lineWidth=2; for(let i=0;i<3;i++){ const lx=ax+4+i*12, s=Math.sin(t*16+i*2)*5; x.beginPath(); x.moveTo(lx,ay+4); x.lineTo(lx+s,ay+14); x.stroke(); }
    x.beginPath(); x.moveTo(ax+36,ay-17); x.quadraticCurveTo(ax+44,ay-32,ax+52,ay-28); x.stroke();
    x.fillStyle='#b02020'; x.fillRect(0,156,320,24); x.fillStyle='#fff'; x.font='bold 13px sans-serif'; tick=(tick+1.4)%2000; x.fillText(ticker+ticker,-tick,173);
    x.fillStyle='rgba(255,255,255,.9)'; x.font='bold 11px sans-serif'; x.fillText('WBUG 7',8,16);
    x.fillStyle='rgba(0,0,0,.06)'; for(let i=0;i<180;i+=3) x.fillRect(0,i,320,1);
    tex.needsUpdate=true;
  }
  draw(0); return {tex,draw};
}
function framePic(draw,w=.6,h=.45){ const g=new THREE.Group(); const t=canvasTex(256,Math.round(256*h/w),draw); g.add(box(w+.08,h+.08,.04,mat(0x3a2a1c,{roughness:.5}),0,0,0)); g.add(mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,roughness:.35}),0,0,.022,false)); return g; }

defineLevel('home',{
  title:'home',
  env:{fx:{exposure:1.0,temp:.12,saturation:1.08,contrast:1.06,bloomStrength:.16,bloomThreshold:1.8,aoRadius:.5,vignette:.35},music:'home',reverb:.12,amb:[['room',.04],['fridge',.012]],ambEvents:[['birds',5],['car',14],['dog',25]],surface:'wood',far:900},
  async build(scene,lv){
    const sunDir=V3(-.78,.26,.38).normalize();
    const sky=makeSky({top:0x3a5ea8,mid:0x87a9d8,horizon:0xffb16a,bottom:0x5a4a40,sunDir,sunColor:0xffd49a,sunSize:.9993,sunGlow:1.3,clouds:.55,cloudColor:0xffd8c0,cloudShade:0x7a6a8a});
    scene.add(sky); lv.skyU=sky.userData.u;
    lv.envMap=envFromSky(sky);
    const rig=makeRig(scene,{sun:3.2,sunColor:0xffc890,hemi:.35,sky:0xa8c0e8,ground:0x6a5a40,dir:sunDir,span:16,dist:60,far:140,bias:-.0005,normalBias:.03});
    lv.sunWorld=sunDir.clone().multiplyScalar(800);
    await nextFrame();
    // ---------------- ground, yard, driveway, street ----------------
    scene.add(tiledPlane(260,260,texMat(TX.grass(),1,1,{opts:{roughness:1,color:col(0x9ab87a)}}),4,0,0,0));
    const conc=TX.concrete();
    const walk=tiledPlane(1.8,13,texMat(conc,1,1,{opts:{roughness:1}}),1.8,0,.012,11.5); scene.add(walk);
    const drive=tiledPlane(3.6,24,texMat(conc,1,1,{opts:{roughness:1}}),3,7,.013,8); scene.add(drive);
    scene.add(tiledPlane(200,2.4,texMat(conc,1,1,{opts:{roughness:1}}),2.4,0,.02,19.2));
    scene.add(tiledPlane(200,2.4,texMat(conc,1,1,{opts:{roughness:1}}),2.4,0,.02,29.8));
    const road=tiledPlane(200,8.2,texMat(TX.asphalt(),1,1,{opts:{roughness:1}}),6,0,.01,24.5); scene.add(road);
    const lineM=mat(0xe8c040,{roughness:.6}); for(let i=-24;i<24;i++) scene.add(box(2.2,.01,.14,lineM,i*4,.02,24.5,false));
    for(const z of [20.35,28.65]) scene.add(box(200,.14,.22,mat(0xb8b4ac,{roughness:.9}),0,.07,z));
    // ---------------- the house shell (walls cast shadows so the sun comes in through windows) ----------------
    const pw=TX.plaster(), wood=woodTex('floorWood',1024,{planks:8,base:[150,104,66],strength:2});
    const wallIn=texMat(pw,3,1.2,{opts:{color:col(0xe8d8c0),roughness:.95}}); wallIn.envMapIntensity=.35;
    const sid=TX.siding(); const wallOut=texMat(sid,4,1.6,{opts:{color:col(0xa8c0d0),roughness:.85}});
    const floorM=texMat(wood,2.5,2,{physical:true,opts:{roughness:1,clearcoat:.4,clearcoatRoughness:.3}}); floorM.envMapIntensity=.4;
    const trimM=mat(0xf5f0e6,{roughness:.55});
    const X0=-5,X1=5,Z0=-6,Z1=3,H=2.9,T=.2;
    lv.floorBounds=[X0,X1,Z0,Z1];
    const fl=mesh(new THREE.PlaneGeometry(X1-X0,Z1-Z0),floorM,0,.012,(Z0+Z1)/2,false); fl.rotation.x=-Math.PI/2; fl.receiveShadow=true; scene.add(fl);
    const ceil=mesh(new THREE.BoxGeometry(X1-X0+.4,.2,Z1-Z0+.4),mat(0xf2ece2,{roughness:.95}),0,H+.1,(Z0+Z1)/2); scene.add(ceil);
    // wall builder with rectangular openings (windows/doors): segments along one wall
    const wallSeg=(axis,fixed,from,to,holes,outside)=>{ // axis 'x' => wall runs along x at z=fixed
      const pieces=[]; let cur=from; const hs=holes.slice().sort((a,b)=>a.c-b.c);
      for(const h of hs){ const a=h.c-h.w/2, b=h.c+h.w/2; if(a>cur) pieces.push([cur,a,0,H]); if(h.y0>0) pieces.push([a,b,0,h.y0]); if(h.y1<H) pieces.push([a,b,h.y1,H]); cur=b; }
      if(cur<to) pieces.push([cur,to,0,H]);
      for(const [a,b,y0,y1] of pieces){ const len=b-a, cx=(a+b)/2, cy=(y0+y1)/2, hh=y1-y0;
        const inW=axis==='x'?box(len,hh,.02,wallIn,cx,cy,fixed+(outside?-.11:.11)):box(.02,hh,len,wallIn,fixed+(outside?-.11:.11),cy,cx);
        const outW=axis==='x'?box(len,hh,T,wallOut,cx,cy,fixed):box(T,hh,len,wallOut,fixed,cy,cx);
        scene.add(outW); scene.add(inW); }
    };
    // back wall (TV), left wall (big sunset window), right wall (kitchen doorway), front wall (door + windows)
    wallSeg('x',Z0,X0-T/2,X1+T/2,[],false);
    wallSeg('z',X0,Z0,Z1,[{c:-2.2,w:2.8,y0:.8,y1:2.35}],false);
    wallSeg('z',X1,Z0,Z1,[{c:-3,w:1.3,y0:0,y1:2.2}],true);
    wallSeg('x',Z1,X0-T/2,X1+T/2,[{c:0,w:1.1,y0:0,y1:2.2},{c:-3,w:1.5,y0:.9,y1:2.2},{c:3,w:1.5,y0:.9,y1:2.2}],true);
    const col_=lv.col; lv.col.bounds=null;
    colBox(col_,X0-.3,X0+.1,Z0,Z1); colBox(col_,X1-.1,X1+.3,Z0,-3.65); colBox(col_,X1-.1,X1+.3,-2.35,Z1); colBox(col_,X0,X1,Z0-.3,Z0+.1);
    colBox(col_,X0,-.55,Z1-.1,Z1+.25); colBox(col_,.55,X1,Z1-.1,Z1+.25);
    colBox(col_,X1+.1,X1+2,-3.8,-2.2);   // kitchen: not part of this story
    // window glass + frames + curtains
    const glassM=new THREE.MeshPhysicalMaterial({color:col(0xdde8f0),roughness:.02,transparent:true,opacity:.12,clearcoat:1,depthWrite:false});
    const addWindow=(x,y,z,w,h,rotY)=>{ const g=new THREE.Group(); g.position.set(x,y,z); g.rotation.y=rotY; scene.add(g);
      g.add(mesh(new THREE.PlaneGeometry(w,h),glassM,0,0,0,false));
      for(const [px,py,sw,sh] of [[0,h/2,w+.1,.08],[0,-h/2,w+.12,.1],[-w/2,0,.08,h],[w/2,0,.08,h],[0,0,.05,h],[0,0,w,.05]]) g.add(box(sw,sh,.1,trimM,px,py,0));
      g.add(box(w+.3,.05,.28,trimM,0,-h/2-.04,.1));
      const curtM=new THREE.MeshStandardMaterial({color:col(0xc8a070),roughness:.9,map:charTex().cloth.map,side:THREE.DoubleSide});
      for(const sd of [-1,1]){ const cg=new THREE.PlaneGeometry(.45,h+.5,8,1); const p=cg.attributes.position; for(let i=0;i<p.count;i++) p.setZ(i,Math.sin(p.getX(i)*28)*.03); cg.computeVertexNormals(); g.add(mesh(cg,curtM,sd*(w/2+.18),.1,.14,false)); }
      g.add(cyl(.02,.02,w+1.1,mat(0x3a2a1c),0,h/2+.22,.16,8)).children; g.children[g.children.length-1].rotation.z=Math.PI/2;
    };
    addWindow(X0+.001,1.575,-2.2,2.8,1.55,Math.PI/2);
    addWindow(-3,1.55,Z1-.001,1.5,1.3,Math.PI); addWindow(3,1.55,Z1-.001,1.5,1.3,Math.PI);
    // sunlight shafts through the big window + dust
    lv.shafts=[];
    const sh1=lightShaft(2.6,1.4,7,0xffc890,.09); sh1.position.set(X0+.05,1.58,-2.2); sh1.lookAt(V3(X0+.05,1.58,-2.2).sub(sunDir)); scene.add(sh1); lv.shafts.push(sh1);
    // baseboards + crown
    for(const [x,z,w,d] of [[0,Z0+.12,X1-X0,.03],[X0+.12,(Z0+Z1)/2,.03,Z1-Z0],[X1-.12,(Z0+Z1)/2,.03,Z1-Z0],[-2.8,Z1-.12,4.4,.03],[2.8,Z1-.12,4.4,.03]]){ scene.add(box(w||.03,.12,d||.03,trimM,x,.06,z,false)); scene.add(box(w||.03,.08,d||.03,trimM,x,H-.04,z,false)); }
    // front door (hinged)
    const doorPivot=new THREE.Group(); doorPivot.position.set(-.52,0,Z1); scene.add(doorPivot);
    const doorM=mat(0x7a3a24,{roughness:.55});
    const door=box(1.04,2.18,.06,doorM,.52,1.09,0); doorPivot.add(door);
    for(const [px,py] of [[.52,1.6],[.52,.6]]) doorPivot.add(box(.8,.8,.08,mat(0x6a3020,{roughness:.6}),px,py,0,false));
    const knob=sph(.035,mat(0xd4af37,{metalness:1,roughness:.2}),.95,1.0,-.07,12,10); doorPivot.add(knob); doorPivot.add(sph(.035,knob.material,.95,1.0,.07,12,10));
    lv.door={pivot:doorPivot,open:0,target:0};
    lv.doorCol=colBox(col_,-.55,.55,Z1-.08,Z1+.08,()=>lv.door.open<.6);
    lv.doorBlock=colBox(col_,-.6,.6,Z1-.15,Z1+.15,()=>!!lv.blockDoor);
    // ---------------- furniture ----------------
    const fab=charTex().cloth; const couchM=new THREE.MeshPhysicalMaterial({color:col(0x5a6e7a),roughness:.95,map:repeatSet(fab,3,3).map,normalMap:repeatSet(fab,3,3).normalMap,sheen:col(0x2a3a44)});
    const couch=new THREE.Group(); couch.position.set(0,0,-1.8); scene.add(couch);
    couch.add(rbox(2.6,.42,1,.1,couchM,0,.3,0)); couch.add(rbox(2.6,.72,.26,.12,couchM,0,.7,.4)); for(const sx of [-1.3,1.3]) couch.add(rbox(.26,.62,1,.1,couchM,sx,.46,0));
    for(const sx of [-.64,.64]){ couch.add(rbox(1.22,.2,.86,.09,couchM,sx,.58,-.05)); couch.add(rbox(1.16,.5,.2,.09,couchM,sx,.88,.24)); }
    couch.add(rbox(.5,.4,.14,.08,new THREE.MeshPhysicalMaterial({color:col(0xd8a040),roughness:.9,sheen:col(0x553311)}),-.95,.85,.14)); couch.children[couch.children.length-1].rotation.z=.25;
    for(const [lx,lz] of [[-1.2,-.4],[1.2,-.4],[-1.2,.4],[1.2,.4]]) couch.add(cyl(.03,.02,.12,mat(0x2a1a10),lx,.06,lz,8));
    colBox(col_,-1.45,1.45,-2.35,-1.25);
    const rug=mesh(new THREE.PlaneGeometry(3.4,2.4),new THREE.MeshStandardMaterial({map:canvasTex(256,256,(x,w,h)=>{ x.fillStyle='#8a3a2a'; x.fillRect(0,0,w,h); x.strokeStyle='#e8c890'; x.lineWidth=6; x.strokeRect(10,10,w-20,h-20); x.lineWidth=2; x.strokeRect(24,24,w-48,h-48); for(let i=0;i<6;i++){ x.fillStyle=i%2?'#c8783a':'#3a5a6a'; x.beginPath(); x.arc(w/2,h/2,90-i*14,0,7); x.fill(); } for(let i=0;i<9000;i++){ x.fillStyle=`rgba(0,0,0,${Math.random()*.08})`; x.fillRect(Math.random()*w,Math.random()*h,1,1); } }),roughness:1}),0,.024,-3.3,false); rug.rotation.x=-Math.PI/2; rug.receiveShadow=true; scene.add(rug);
    const woodM=texMat(woodTex('furnWood',512,{planks:3,base:[110,70,42]}),1,1,{physical:true,opts:{roughness:1,clearcoat:.5,clearcoatRoughness:.2}});
    const ct=new THREE.Group(); ct.position.set(0,0,-3.3); scene.add(ct);
    ct.add(rbox(1.3,.06,.65,.02,woodM,0,.44,0)); for(const [lx,lz] of [[-.58,-.26],[.58,-.26],[-.58,.26],[.58,.26]]) ct.add(box(.05,.42,.05,woodM,lx,.21,lz));
    ct.add(box(1.2,.03,.55,woodM,0,.12,0));
    const mug=mesh(new THREE.CylinderGeometry(.045,.04,.1,20),new THREE.MeshPhysicalMaterial({color:col(0xe8e2d8),roughness:.2,clearcoat:1}),.3,.52,.05); ct.add(mug);
    ct.add(box(.05,.02,.16,mat(0x1a1a1a,{roughness:.4}),-.2,.48,0));
    const bowl=mesh(new THREE.SphereGeometry(.12,20,10,0,Math.PI*2,Math.PI/2,Math.PI/2),new THREE.MeshPhysicalMaterial({color:col(0x3a6a8a),roughness:.3,clearcoat:.8,side:THREE.DoubleSide}),-.35,.6,-.1); ct.add(bowl);
    for(let i=0;i<5;i++) ct.add(mesh(new THREE.CylinderGeometry(.045,.045,.012,16),new THREE.MeshStandardMaterial({map:cookieTex().map,roughness:.9}),-.35+rand(-.05,.05),.52+i*.012,-.1+rand(-.05,.05),false));
    colBox(col_,-.68,.68,-3.65,-2.95);
    // TV + media console
    const tvc=new THREE.Group(); tvc.position.set(0,0,Z0+.35); scene.add(tvc);
    tvc.add(rbox(2.4,.5,.45,.03,woodM,0,.25,0));
    tvc.add(rbox(1.62,.94,.06,.02,mat(0x0e0e10,{roughness:.3,metalness:.4}),0,1.35,-.1));
    lv.tv=tvCanvas(); lv.tvScreen=mesh(new THREE.PlaneGeometry(1.52,.855),new THREE.MeshBasicMaterial({map:lv.tv.tex}),0,1.35,-.065,false); lv.tvScreen.material.color.setScalar(1.3); tvc.add(lv.tvScreen);
    lv.tvLight=new THREE.PointLight(col(0x8ab8ff),.5,6,2); lv.tvLight.position.set(0,1.3,Z0+1.1); scene.add(lv.tvLight);
    colBox(col_,-1.25,1.25,Z0,Z0+.62);
    for(const sx of [-1.7,1.7]){ const sp=new THREE.Group(); sp.position.set(sx,0,Z0+.4); scene.add(sp); sp.add(rbox(.26,1.05,.26,.04,mat(0x1c1c1e,{roughness:.5}),0,.53,0)); sp.add(cyl(.08,.08,.02,mat(0x2a2a2a),0,.8,.131,20)); sp.children[1].rotation.x=Math.PI/2; }
    // bookshelf, floor lamp, plant, pictures
    const shelf=new THREE.Group(); shelf.position.set(X1-.22,0,.4); shelf.rotation.y=-Math.PI/2; scene.add(shelf);
    shelf.add(box(1.4,2.1,.35,woodM,0,1.05,0)); for(let i=0;i<5;i++) shelf.add(box(1.3,.03,.32,woodM,0,.1+i*.47,.02));
    for(let i=0;i<4;i++) for(let b=0;b<9;b++){ if(Math.random()<.2) continue; const bh=rand(.25,.38); shelf.add(box(.08,bh,.22,mat(pick([0x8a2a2a,0x2a4a7a,0x3a6a3a,0xc89a3a,0x5a3a6a,0xe8e0d0]),{roughness:.8}),-.55+b*.13,.13+i*.47+bh/2,.04)); }
    colBox(col_,X1-.45,X1,-.35,1.15);
    const lamp=new THREE.Group(); lamp.position.set(-2.2,0,-1.6); scene.add(lamp);
    lamp.add(cyl(.18,.2,.04,mat(0x2a2a2a,{metalness:.6,roughness:.4}),0,.02,0,20)); lamp.add(cyl(.015,.015,1.55,mat(0x2a2a2a,{metalness:.6,roughness:.4}),0,.8,0,8));
    lamp.add(mesh(new THREE.CylinderGeometry(.2,.28,.32,24,1,true),new THREE.MeshStandardMaterial({color:col(0xf4e4c4),emissive:col(0xffc070),emissiveIntensity:1.2,side:THREE.DoubleSide,roughness:.9}),0,1.62,0,false));
    const lampL=new THREE.PointLight(col(0xffb866),1.3,9,2); lampL.position.set(-2.2,1.5,-1.6); scene.add(lampL);
    colCircle(col_,-2.2,-1.6,.25);
    const plant=new THREE.Group(); plant.position.set(X0+.5,0,Z0+.6); scene.add(plant); plant.add(cyl(.22,.17,.45,new THREE.MeshPhysicalMaterial({color:col(0xc05a3a),roughness:.6}),0,.22,0,20));
    colCircle(col_,X0+.5,Z0+.6,.3);
    makeBushes(plant,[{x:0,z:0,h:1.5,r:.5}],{seed:9});
    const pics=[
      [framePic((x,w,h)=>{ let g=x.createLinearGradient(0,0,0,h); g.addColorStop(0,'#ffb870'); g.addColorStop(1,'#6a3a5a'); x.fillStyle=g; x.fillRect(0,0,w,h); x.fillStyle='#3a2a1a'; x.fillRect(40,h*.5,110,h*.4); x.fillStyle='#ffcc33'; x.font='bold 18px sans-serif'; x.fillText("JIM'S BUG BITES",42,h*.48); x.fillStyle='#d9a441'; x.fillRect(170,h*.45,20,h*.45); x.beginPath(); x.arc(180,h*.4,12,0,7); x.fill(); x.fillStyle='#fff'; x.font='11px sans-serif'; x.fillText('grand opening!',150,h-10); },.62,.46),-2.3,1.75,Z0+.12,0],
      [framePic((x,w,h)=>{ x.fillStyle='#f8f4e8'; x.fillRect(0,0,w,h); x.strokeStyle='#2a1208'; x.lineWidth=4; x.beginPath(); x.ellipse(90,110,26,18,0,0,7); x.ellipse(130,100,18,14,0,0,7); x.ellipse(160,90,20,16,0,0,7); x.stroke(); for(let i=0;i<3;i++){ x.beginPath(); x.moveTo(100+i*20,120); x.lineTo(92+i*20,150); x.stroke(); } x.fillStyle='#e04a3a'; x.font='bold 20px Comic Sans MS,sans-serif'; x.fillText('ANT!',150,170); },.45,.55),2.3,1.7,Z0+.12,0],
      [framePic((x,w,h)=>{ let g=x.createLinearGradient(0,0,0,h); g.addColorStop(0,'#0a0a2a'); g.addColorStop(1,'#2a2a5a'); x.fillStyle=g; x.fillRect(0,0,w,h); for(let i=0;i<80;i++){ x.fillStyle='#fff'; x.fillRect(Math.random()*w,Math.random()*h,1.5,1.5); } x.fillStyle='#d8d8d8'; x.beginPath(); x.arc(w*.7,h*.35,34,0,7); x.fill(); x.fillStyle='rgba(0,0,0,.2)'; x.beginPath(); x.arc(w*.66,h*.3,8,0,7); x.arc(w*.75,h*.42,6,0,7); x.fill(); },.7,.5),X0+.12,1.7,.6,Math.PI/2]
    ];
    for(const [p,x,y,z,ry] of pics){ p.position.set(x,y,z); p.rotation.y=ry; scene.add(p); }
    // kitchen glimpse through the doorway (dim, warm)
    const kit=new THREE.Group(); kit.position.set(X1+1.8,0,-3); scene.add(kit);
    kit.add(mesh(new THREE.PlaneGeometry(3.6,3.6),mat(0xd8d4cc,{roughness:.9}),0,.02,0,false)); kit.children[0].rotation.x=-Math.PI/2;
    kit.add(box(.1,H,3.6,wallIn,1.8,H/2,0)); kit.add(rbox(.7,1.9,.8,.04,new THREE.MeshPhysicalMaterial({color:col(0xe8e8ec),roughness:.25,clearcoat:.8}),1.3,.95,.8)); kit.add(box(.6,.9,2,woodM,1.4,.45,-.8));
    const kl=new THREE.PointLight(col(0xffd8a0),.5,5,2); kl.position.set(X1+1.8,2.4,-3); scene.add(kl);
    // ---------------- porch, exterior details ----------------
    const porchM=texMat(woodTex('porchWood',512,{planks:6,base:[130,100,80]}),3,2,{opts:{roughness:1}});
    const porch=mesh(new THREE.BoxGeometry(5.4,.16,2.2),porchM,0,.08,Z1+1.2); scene.add(porch);
    for(const x of [-2.5,2.5]) scene.add(box(.18,2.6,.18,trimM,x,1.4,Z1+2.15));
    scene.add(box(5.8,.14,2.5,trimM,0,2.75,Z1+1.25));
    const step=box(1.6,.08,.4,porchM,0,.04,Z1+2.5); scene.add(step);
    // roof over the house
    const rs=new THREE.Shape(); rs.moveTo(X0-.6,0); rs.lineTo(0,2.6); rs.lineTo(X1+.6,0); rs.closePath();
    const rg=new THREE.ExtrudeGeometry(rs,{depth:Z1-Z0+1.2,bevelEnabled:false}); rg.translate(0,H+.2,Z0-.6);
    const shg=TX.shingles(); scene.add(mesh(rg,texMat(shg,5,4,{opts:{roughness:.9,color:col(0x5a4a44)}})));
    scene.add(box(X1-X0+1.3,.2,Z1-Z0+1.3,trimM,0,H+.2,(Z0+Z1)/2));
    lv.ground=(x,z)=>{ if(Math.abs(x)<2.7 && z>Z1+.05 && z<Z1+2.3) return .16; if(Math.abs(x)<.8 && z>=Z1+2.3 && z<Z1+2.7) return .08; return 0; };
    lv.surfaceAt=(x,z)=>{ if(x>X0&&x<X1&&z>Z0&&z<Z1) return Math.abs(x)<1.7&&z>-4.5&&z<-2.1?'carpet':'wood'; if(Math.abs(x)<2.7&&z>Z1&&z<Z1+2.7) return 'wood'; if(Math.abs(x)<.9&&z<18) return 'concrete'; if(x>5.2&&x<8.8) return 'concrete'; if(z>18) return 'concrete'; return 'grass'; };
    // mailbox, fence, bushes, flowers
    const mb=makeMailbox(); mb.position.set(1.4,0,18.2); scene.add(mb);
    const fenceM=mat(0xf0ece2,{roughness:.8});
    for(const [x,z,len,ry] of [[-10,4,26,Math.PI/2],[11,4,26,Math.PI/2],[.5,-9,21,0]]){ const f=makeFence(len,fenceM); f.position.set(x,0,z); f.rotation.y=ry; scene.add(f); }
    colBox(col_,-10.2,-9.8,-9,17); colBox(col_,10.8,11.2,-9,17); colBox(col_,-10,11,-9.2,-8.8);
    makeBushes(scene,[{x:-3.8,z:Z1+.7},{x:3.8,z:Z1+.7},{x:-5.6,z:Z1+.4,h:1},{x:-8.5,z:10},{x:9.5,z:12}],{seed:4});
    // the car in the driveway
    lv.car=makeCar(); lv.car.position.set(7,0,10.5); lv.car.rotation.y=-Math.PI/2; scene.add(lv.car);
    colOBB(col_,7,10.5,1.95,4.7,0);
    // streetlights, neighbour houses, trees
    for(let i=-3;i<=3;i++){ const sl=makeStreetlight(.15); sl.position.set(i*22+4,0,19); sl.rotation.y=Math.PI/2; scene.add(sl); colCircle(col_,i*22+4,19,.15); }
    const hp=[[-22,-1,0,0xd8c8a8,0x5a3a2a],[22,-1,0,0xc8d8c0,0x3a3a44],[-16,40,Math.PI,0xe8d0c0,0x4a4a4a],[0,40,Math.PI,0xb8c8d8,0x5a4040],[16,40,Math.PI,0xf0e8d0,0x3a4a3a],[-34,40,Math.PI,0xd0c0d8,0x4a3a3a],[34,40,Math.PI,0xe0d8b8,0x44403a],[-38,-1,0,0xe8e0d0,0x4a4a4a],[38,-1,0,0xd8b8a0,0x3a3030]];
    hp.forEach(([x,z,ry,c,r],i)=>{ const h=makeHouse({color:c,roof:r,seed:i+3,w:rand(8,10),d:8,floors:i%3===1?2:1}); h.position.set(x,0,z); h.rotation.y=ry; scene.add(bake(h)); colBoxC(col_,x,z,10,9); });
    const trees=[{x:-8,z:14},{x:-14,z:8},{x:14,z:-4},{x:-15,z:-6},{x:6,z:33},{x:-8,z:34},{x:25,z:33},{x:-26,z:12},{x:28,z:12},{x:-3,z:-13},{x:9,z:-15},{x:-40,z:18},{x:44,z:20},{x:-50,z:34},{x:52,z:-6}];
    makeTrees(scene,trees.map(t=>({x:t.x,z:t.z,h:rand(6,9)})),{seed:12});
    for(const t of trees) colCircle(col_,t.x,t.z,.4);
    makeGrass(scene,{x0:-10,x1:11,z0:-9,z1:18,skip:(x,z)=>(x>X0-.5&&x<X1+.5&&z>Z0-.5&&z<Z1+2.8)||(Math.abs(x)<1.1)||(x>5&&x<9)},dq(0,3000,9000,16000,26000),{h:.22});
    lv.col.bounds=[-30,30,-12,31];
    // ---------------- Jim (arrives later) ----------------
    lv.jim=makeJim(); lv.jim.visible=false; lv.jim.userData.level='home'; scene.add(lv.jim);
    lv.you=makeYou(); lv.you.visible=false; lv.you.userData.level='home'; scene.add(lv.you);
    // dust in the sun beam
    lv.motes=[]; for(let i=0;i<dq(8,15,30,45,70);i++) lv.motes.push({p:V3(rand(X0+.2,-1),rand(.4,2.4),rand(-4,-.4)),v:V3(rand(-.02,.02),rand(-.01,.015),rand(-.02,.02))});
  },
  enter(){ FX.sunWorld=this.sunWorld; FX.rays=.25; FX.raysColor.set(1,.8,.55); },
  update(dt,t){
    const lv=this;
    // TV animation + light flicker
    lv.tvT=(lv.tvT||0)+dt; if(lv.tvT>1/15){ lv.tvT=0; lv.tv.draw(t); }
    lv.tvLight.intensity=.45+Math.sin(t*7)*.08+Math.sin(t*13.3)*.06;
    for(const s of lv.shafts) s.userData.u.t.value=t;
    const D=lv.door; D.open=damp(D.open,D.target,3.2,dt); D.pivot.rotation.y=-D.open*1.75;
    for(const m of lv.motes){ m.p.addScaledVector(m.v,dt); if(m.p.y<.3||m.p.y>2.6) m.v.y*=-1; if(Math.random()<dt*2.5) lv.glow.spawn(m.p.x,m.p.y,m.p.z,m.v.x,m.v.y,m.v.z,1.2,.012,1,.85,.6,.5,0,0,0); }
    WIND.time.value=t;
  },
  shadowFocus(f){ if(f.z<4) f.set(0,1,-1.5); }
});

