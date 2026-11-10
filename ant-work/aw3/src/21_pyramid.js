/* ================================================================
   INSIDE THE PYRAMID — almost pitch black. A long passage going down,
   bones, a gallery of old paintings lit by thin beams of sun through
   cracks, steps down, and the round room where the purple glow lives.
   Everything runs along -z from the doorway (z = 0).
   ================================================================ */
const PYR={roomC:V3(0,-3.6,-96),roomR:6,tableR:1.05};
function pyrFloor(x,z){
  if(z>-4) return 0;
  if(z>-34) return lerp(0,-2.4,(-4-z)/30);
  if(z>-78) return -2.4;
  if(z>-86){ const k=Math.floor((-78-z)/(8/6)); return -2.4-Math.min(6,k+1)*.2; }
  return -3.6;
}
/* the walkable space: three passages + the round room */
function pyrClamp(p,r){
  const regions=[[-1.6,1.6,-44,.4],[-3.5,3.5,-76,-44],[-1.3,1.3,-91,-76]];
  const C=PYR.roomC, R=PYR.roomR;
  const inside=(b)=>p.x>=b[0]+r&&p.x<=b[1]-r&&p.z>=b[2]&&p.z<=b[3];
  for(const b of regions) if(inside(b)) return;
  const dC=Math.hypot(p.x-C.x,p.z-C.z); if(dC<=R-r) return;
  // not inside anything: snap to the closest legal spot
  let best=null, bd=1e9;
  for(const b of regions){ const x=clamp(p.x,b[0]+r,b[1]-r), z=clamp(p.z,b[2],b[3]); const d=(x-p.x)**2+(z-p.z)**2; if(d<bd){ bd=d; best=[x,z]; } }
  { const k=(R-r)/Math.max(dC,1e-6); const x=C.x+(p.x-C.x)*k, z=C.z+(p.z-C.z)*k; const d=(x-p.x)**2+(z-p.z)**2; if(d<bd){ bd=d; best=[x,z]; } }
  p.x=best[0]; p.z=best[1];
}
/* a soft beam of dusty sunlight (additive, fades at its ends and edges) */
function lightShaft(top,bottom,r0,r1,color,k){
  const len=top.distanceTo(bottom), geo=new THREE.CylinderGeometry(r0,r1,len,20,1,true);
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    uniforms:{c:{value:col(color)},k:{value:k},time:{value:0}},
    vertexShader:`varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=normalize(-mv.xyz); vY=uv.y; gl_Position=projectionMatrix*mv; }`,
    fragmentShader:`uniform vec3 c; uniform float k,time; varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ float edge=pow(abs(dot(normalize(vN),normalize(vV))),2.2); float ends=smoothstep(0.0,0.25,vY)*smoothstep(1.0,0.82,vY);
        float flick=0.9+0.1*sin(time*0.7+vY*6.0); gl_FragColor=vec4(c*edge*ends*k*flick,1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`});
  const s=new THREE.Mesh(geo,m); s.position.copy(top).add(bottom).multiplyScalar(.5);
  s.quaternion.setFromUnitVectors(V3(0,1,0),top.clone().sub(bottom).normalize()); s.renderOrder=6; s.userData.u=m.uniforms; return s;
}
/* a pear-shaped fruit that glows purple from inside, with veins */
function veinTex(seed){
  return canvasTex(256,256,(c,w,h)=>{ const rr=RNG(seed); c.fillStyle='#14051f'; c.fillRect(0,0,w,h);
    const g=c.createRadialGradient(w*.5,h*.6,4,w*.5,h*.6,w*.7); g.addColorStop(0,'rgba(190,110,255,.65)'); g.addColorStop(1,'rgba(60,10,90,0)'); c.fillStyle=g; c.fillRect(0,0,w,h);
    c.lineCap='round';
    const vein=(x,y,a,len,wd,d)=>{ if(d>5||len<6) return; const x2=x+Math.cos(a)*len, y2=y+Math.sin(a)*len; c.strokeStyle='rgba(235,190,255,'+(.95-d*.12)+')'; c.lineWidth=wd; c.beginPath(); c.moveTo(x,y); c.quadraticCurveTo((x+x2)/2+(rr()-.5)*len*.5,(y+y2)/2+(rr()-.5)*len*.5,x2,y2); c.stroke();
      vein(x2,y2,a+(rr()-.5)*.9,len*.72,wd*.68,d+1); if(rr()<.6) vein(x2,y2,a+(rr()<.5?-1:1)*(.5+rr()*.6),len*.6,wd*.6,d+1); };
    for(let i=0;i<7;i++) vein(w*(i+.5)/7,h,-Math.PI/2+(rr()-.5)*.4,60+rr()*30,5,0);
    for(let i=0;i<5;i++) vein(w*(i+.5)/5,0,Math.PI/2+(rr()-.5)*.4,40+rr()*20,3.5,1);
  });
}
function makeFruit(seed){
  const g=new THREE.Group();
  const vt=veinTex(seed);
  const m=new THREE.MeshPhysicalMaterial({color:col(0x2a0d3e),emissive:col(0xd8a0ff),emissiveMap:vt,emissiveIntensity:2.2,roughness:.28,clearcoat:.8,clearcoatRoughness:.2,sheen:col(0x8a40c0)});
  const body=mesh(lathe('fruitPear2',[[0,0],[.036,.004],[.058,.022],[.065,.05],[.06,.078],[.047,.1],[.036,.117],[.031,.132],[.023,.147],[.01,.155],[0,.157]],26),m,0,0,0); g.add(body);
  const stem=mesh(GC('fruitStem',()=>{ const c=new THREE.CylinderGeometry(.004,.006,.035,6); c.translate(0,.0175,0); return c; }),mat(0x2a1a10,{roughness:.9}),0,.148,0); stem.rotation.z=.3; g.add(stem);
  const leaf=mesh(GC('fruitLeaf',()=>{ const s=new THREE.SphereGeometry(.03,10,6); s.scale(1,.12,.45); s.translate(.03,0,0); return s; }),mat(0x2e1a3a,{roughness:.7}),.004,.172,0); leaf.rotation.z=-.4; g.add(leaf);
  g.userData={m,body};
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=true; } });
  return g;
}
/* a real bite out of the fruit: the glowing inside shows, with teeth marks round the edge, on the side that bit it */
function biteFruit(f,mouthWorld){
  f.updateMatrixWorld(true);
  const loc=f.worldToLocal(mouthWorld.clone()); loc.y=0; if(loc.lengthSq()<1e-6) loc.set(0,0,1); loc.normalize();
  const g=new THREE.Group(); g.position.set(loc.x*.054,.064,loc.z*.054); g.rotation.y=Math.atan2(loc.x,loc.z);
  const flesh=new THREE.MeshPhysicalMaterial({color:col(0xf6ecff),emissive:col(0xc89aff),emissiveIntensity:1.1,roughness:.6});
  const p=mesh(new THREE.SphereGeometry(.03,18,12),flesh,0,0,0,false); p.scale.set(1,1.15,.4); g.add(p);
  const skin=f.userData.m; for(let i=0;i<8;i++){ const a=i/8*Math.PI*2; g.add(mesh(new THREE.SphereGeometry(.0078,8,6),skin,Math.cos(a)*.031,Math.sin(a)*.036,.003,false)); }   // teeth marks
  g.traverse(o=>{ if(o.isMesh){ o.renderOrder=f.children[0]&&f.children[0].renderOrder||0; } });
  f.add(g); return g;
}
defineLevel('pyramid',{
  title:'The Pyramid',
  env:{fx:{exposure:1.28,saturation:1.0,contrast:1.12,bloomStrength:.55,bloomThreshold:.9,aoRadius:.5,vignette:.5,temp:.02,grain:.05},music:null,reverb:.65,surface:'stone',far:220,speed:2.6},
  async build(scene,lv){
    scene.background=col(0x000000); scene.fog=new THREE.FogExp2(col(0x05030a),.0075);
    scene.add(new THREE.HemisphereLight(col(0x6a5a80),col(0x1a120a),.06));
    const T=(base,tile,o={})=>{ const m=pbrMat(base,tile,o); return m; };
    const wallM=(w,h)=>{ const m=pbrMat('large_sandstone_blocks_01',2.6,{w,h,opts:{roughness:1},normal:1.3}); m.color=col(0xc8ae88); return m; };
    // ---------- A: the passage going down ----------
    { const L=44, seg=44;
      const fg=new THREE.PlaneGeometry(3.2,L,2,seg); fg.rotateX(-Math.PI/2); fg.translate(0,0,-L/2); const fp=fg.attributes.position; for(let i=0;i<fp.count;i++) fp.setY(i,pyrFloor(0,fp.getZ(i))); fg.computeVertexNormals(); withAO(fg);
      const floor=mesh(fg,T('sandstone_cracks',2,{w:3.2,h:L,opts:{roughness:1}}),0,0,0,false); floor.receiveShadow=true; scene.add(floor);
      const cg=new THREE.PlaneGeometry(3.2,L,2,seg); cg.rotateX(Math.PI/2); cg.translate(0,0,-L/2); const cp=cg.attributes.position; for(let i=0;i<cp.count;i++) cp.setY(i,pyrFloor(0,cp.getZ(i))+3.6); cg.computeVertexNormals(); withAO(cg);
      scene.add(mesh(cg,wallM(3.2,L),0,0,0,false));
      for(const sd of [-1,1]){ const wg=new THREE.PlaneGeometry(L,7,seg,1); wg.translate(-L/2,0,0); const wp=wg.attributes.position; for(let i=0;i<wp.count;i++){ const z=wp.getX(i); wp.setY(i,wp.getY(i)+pyrFloor(0,z)+.5); } wg.computeVertexNormals(); withAO(wg);
        const w=mesh(wg,wallM(L,7),sd*1.6,0,0,false); if(sd>0) w.rotation.y=-Math.PI/2; else { w.rotation.y=Math.PI/2; w.scale.x=-1; } w.receiveShadow=true; scene.add(w); }
    }
    // the doorway: blinding daylight outside
    { const outM=new THREE.MeshBasicMaterial({color:col(0xfff4dc).multiplyScalar(5)}); const out=mesh(new THREE.PlaneGeometry(3.2,3.6),outM,0,1.8,.6,false); out.rotation.y=Math.PI; scene.add(out);
      const glowSand=mesh(new THREE.PlaneGeometry(3.2,4),new THREE.MeshBasicMaterial({color:col(0xffe2b0).multiplyScalar(2.2)}),0,.01,1.9,false); glowSand.rotation.x=-Math.PI/2; scene.add(glowSand);
      const sp=new THREE.SpotLight(col(0xffe6c0),3.2,34,.62,.8,1.4); sp.position.set(0,2.6,1.2); sp.target.position.set(0,-1.5,-14); scene.add(sp); scene.add(sp.target);
      lv.doorLight=sp; }
    // ---------- B: the gallery ----------
    { const z0=-44, z1=-76, L=32, y=-2.4, H=5.5;
      scene.add(Object.assign(texPlane(7,L,'red_sandstone_pavement',2.2,0,y,(z0+z1)/2),{receiveShadow:true}));
      const ceil=mesh(withAO(new THREE.PlaneGeometry(7,L)),wallM(7,L),0,y+H,(z0+z1)/2,false); ceil.rotation.x=Math.PI/2; scene.add(ceil);
      for(const sd of [-1,1]){
        const up=mesh(withAO(new THREE.PlaneGeometry(L,H-3.1)),wallM(L,H-3.1),sd*3.5,y+3.1+(H-3.1)/2,(z0+z1)/2,false); up.rotation.y=-sd*Math.PI/2; scene.add(up);
        const low=mesh(withAO(new THREE.PlaneGeometry(L,3.1)),(()=>{ const m=pbrMat('clay_plaster',2,{w:L,h:3.1,opts:{roughness:1}}); m.color=col(0xd8c09a); return m; })(),sd*3.5,y+1.55,(z0+z1)/2,false); low.rotation.y=-sd*Math.PI/2; low.receiveShadow=true; scene.add(low);
        const band=mesh(new THREE.BoxGeometry(.12,.18,L),pbrMat('old_sandstone_02',1.5,{w:L,h:.2}),sd*3.46,y+3.1,(z0+z1)/2); scene.add(band); }
      // end walls with the openings
      for(const [z,half,openH] of [[z0,1.6,3.6],[z1,1.3,3.0]]){ for(const sd of [-1,1]){ const w=3.5-half; const p=mesh(withAO(new THREE.PlaneGeometry(w,H)),wallM(w,H),sd*(half+w/2),y+H/2,z,false); p.rotation.y=z===z0?Math.PI:0; scene.add(p); }
        const topH=H-openH; const top=mesh(withAO(new THREE.PlaneGeometry(half*2,topH)),wallM(half*2,topH),0,y+openH+topH/2,z,false); top.rotation.y=z===z0?Math.PI:0; scene.add(top); }
      // the paintings: bugs (right, first), the pig king (left), the fruit (right), the chains (left)
      lv.paintings=[];
      const P=[['bugs',3.48,-50.5],['king',-3.48,-53],['fruit',3.48,-65],['chains',-3.48,-68]];
      for(const [name,x,z] of P){ const pm=new THREE.MeshStandardMaterial({map:paintingTexture(name),transparent:true,roughness:.95,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
        const p=mesh(new THREE.PlaneGeometry(6,2.62),pm,x,y+1.65,z,false); p.rotation.y=x>0?-Math.PI/2:Math.PI/2; p.receiveShadow=true; p.renderOrder=2; scene.add(p);
        lv.paintings.push({name,obj:p,pos:V3(x,y+1.65,z),seen:false}); }
      // thin beams of sun through cracks in the ceiling
      lv.shafts=[];
      // each crack's beam falls on a painting
      for(const pt of lv.paintings){ const sd=pt.pos.x>0?1:-1;
        const top=V3(-sd*.6,y+H-.02,pt.pos.z+.8), bot=V3(pt.pos.x-sd*.15,pt.pos.y-.2,pt.pos.z);
        const sh=lightShaft(top,bot,.1,.55,0xffd9a0,.07); scene.add(sh); lv.shafts.push(sh);
        const sp=new THREE.SpotLight(col(0xffd2a0),1.5,14,.42,.9,1.4); sp.position.copy(top); sp.target.position.copy(bot); scene.add(sp); scene.add(sp.target);
        const crack=mesh(new THREE.PlaneGeometry(.45,.12),new THREE.MeshBasicMaterial({color:col(0xfff0d0).multiplyScalar(2)}),top.x,y+H-.03,top.z,false); crack.rotation.x=Math.PI/2; crack.rotation.z=rand(0,3); scene.add(crack);
        lv.shaftSpots=(lv.shaftSpots||[]).concat([{top,bot}]); }
      const fill=new THREE.PointLight(col(0xc8a070),.55,26,1.6); fill.position.set(0,y+4.2,(z0+z1)/2); scene.add(fill);
    }
    // ---------- C: steps down ----------
    { const y0=-2.4;
      for(let k=0;k<6;k++){ const zA=-78-k*(8/6), zB=zA-8/6, h=y0-(k+1)*.2; const st=mesh(withAO(new THREE.BoxGeometry(2.6,.3,8/6+.02)),T('old_sandstone_02',1.2,{opts:{roughness:1}}),0,h-.15,(zA+zB)/2); st.receiveShadow=true; st.castShadow=false; scene.add(st); }
      scene.add(Object.assign(texPlane(2.6,2,'old_sandstone_02',1.2,0,y0,-77),{}));
      scene.add(texPlane(2.6,5,'old_sandstone_02',1.2,0,-3.6,-88.5));
      for(const sd of [-1,1]){ const w=mesh(withAO(new THREE.PlaneGeometry(15,7)),wallM(15,7),sd*1.3,-2.6,-83.5,false); w.rotation.y=-sd*Math.PI/2; scene.add(w); }
      const cg=mesh(withAO(new THREE.PlaneGeometry(2.6,15)),wallM(2.6,15),0,.6,-83.5,false); cg.rotation.x=Math.PI/2; scene.add(cg);
      scene.add(mesh(withAO(new THREE.BoxGeometry(2.9,.6,.5)),wallM(2.9,.6),0,.9,-90.1,false));
    }
    // ---------- D: the round room ----------
    { const C=PYR.roomC, R=PYR.roomR, HW=4.6, gap=2*Math.asin(1.35/R);
      const wm=pbrMat('large_sandstone_blocks_01',3.2,{w:2*Math.PI*R,h:HW,opts:{roughness:1,side:THREE.BackSide},normal:1.4}); wm.color=col(0xa8907a);
      const wall=mesh(withAO(new THREE.CylinderGeometry(R,R,HW,48,1,true,gap/2,Math.PI*2-gap)),wm,C.x,C.y+HW/2,C.z,false); wall.receiveShadow=true; scene.add(wall);
      const dm=pbrMat('large_sandstone_blocks_01',3.2,{w:2*Math.PI*R,h:8,opts:{roughness:1,side:THREE.BackSide}}); dm.color=col(0x8a7866);
      const dome=mesh(withAO(new THREE.SphereGeometry(R,40,14,0,Math.PI*2,0,Math.PI/2)),dm,C.x,C.y+HW,C.z,false); dome.scale.y=.55; scene.add(dome);
      const fl=mesh(withAO(new THREE.CircleGeometry(R,48)),pbrMat('stone_tiles_02',1.6,{w:R*2,h:R*2,opts:{roughness:.9}}),C.x,C.y+.002,C.z,false); fl.rotation.x=-Math.PI/2; fl.receiveShadow=true; scene.add(fl);
      // the glow from below: a ring of cracks in the floor round the table, and purple light rising
      const ringT=canvasTex(512,512,(c,w,h)=>{ c.clearRect(0,0,w,h); const rr=RNG(77); c.translate(w/2,h/2);
        const g=c.createRadialGradient(0,0,40,0,0,250); g.addColorStop(0,'rgba(200,120,255,.55)'); g.addColorStop(.45,'rgba(150,70,230,.22)'); g.addColorStop(1,'rgba(90,30,160,0)'); c.fillStyle=g; c.beginPath(); c.arc(0,0,250,0,7); c.fill();
        c.lineCap='round'; c.lineJoin='round';
        for(let i=0;i<34;i++){ let a=rr()*Math.PI*2, r=62+rr()*26; const w0=1.2+rr()*2.4; c.beginPath(); c.moveTo(Math.cos(a)*r,Math.sin(a)*r);
          for(let j=0;j<7;j++){ a+=(rr()-.5)*.35; r+=8+rr()*20; c.lineTo(Math.cos(a)*r,Math.sin(a)*r); }
          c.strokeStyle='rgba(130,60,210,.22)'; c.lineWidth=w0*3.2; c.stroke(); c.strokeStyle='rgba(200,150,255,.5)'; c.lineWidth=w0*.7; c.stroke(); } });
      const ring=mesh(new THREE.PlaneGeometry(5.2,5.2),new THREE.MeshBasicMaterial({map:ringT,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,color:col(0xffffff).multiplyScalar(.85)}),C.x,C.y+.012,C.z,false); ring.rotation.x=-Math.PI/2; ring.renderOrder=3; scene.add(ring); lv.ring=ring;
      const under=new THREE.PointLight(col(0xa868ff),2.6,30,1.4); under.position.set(C.x,C.y+.35,C.z); scene.add(under); lv.under=under;
      const far=new THREE.PointLight(col(0x9a5aff),1.3,95,1.0); far.position.set(C.x,C.y+1.6,C.z+3); scene.add(far); lv.farGlow=far;
      // the stone table
      const tm=pbrMat('sandstone_cracks',1.1,{opts:{roughness:1},normal:1.6}); tm.color=col(0xd9c4a2);
      const tbl=new THREE.Group(); tbl.position.copy(C); scene.add(tbl); lv.table=tbl;
      tbl.add(mesh(withAO(new THREE.CylinderGeometry(.34,.46,.8,16)),tm,0,.4,0));
      const top=mesh(withAO(new THREE.BoxGeometry(1.5,.14,.95)),tm,0,.87,0); tbl.add(top);
      tbl.add(mesh(withAO(new THREE.BoxGeometry(1.1,.08,.7)),tm,0,.04,0));
      colCircle(lv.col,C.x,C.z,PYR.tableR);
      // the two fruits
      lv.fruits=[]; for(const [x,s] of [[-.22,3],[.24,9]]){ const f=makeFruit(s); f.position.set(C.x+x,C.y+.94,C.z+.05); f.rotation.y=rand(0,6); scene.add(f); lv.fruits.push(f); }
      lv.fruitLight=new THREE.PointLight(col(0xc890ff),1.1,4.5,2); lv.fruitLight.position.set(C.x,C.y+1.2,C.z); scene.add(lv.fruitLight);
      // the ones who came before
      for(const [a,s] of [[.9,3],[2.1,5],[3.6,8],[4.9,11]]){ const sk=makeSkeleton(s); sk.position.set(C.x+Math.sin(a)*(R-.9),C.y+.03,C.z+Math.cos(a)*(R-.9)); sk.rotation.y=a+Math.PI; scene.add(sk); }
    }
    // ---------- bones in the passage ----------
    { const s1=makeSkeleton(21); s1.position.set(-1.05,pyrFloor(0,-26)+.03,-26); s1.rotation.y=.7; s1.rotation.x=.08; scene.add(s1);
      const s2=makeSkeleton(33); s2.position.set(1.0,pyrFloor(0,-31)+.03,-31.5); s2.rotation.y=-2.2; s2.rotation.x=.08; scene.add(s2);
      for(let i=0;i<9;i++){ const z=rand(-36,-22), b=makeLongBone(rand(.22,.44)); b.rotation.set(Math.PI/2,0,rand(0,6)); b.position.set(rand(-1.2,1.2),pyrFloor(0,z)+.03,z); b.rotation.x=Math.PI/2-.08; scene.add(b); }
      const sk=makeSkull(); sk.position.set(-2.9,-2.4,-58); sk.rotation.y=1.2; scene.add(sk);
      lv.bonesAt=V3(0,0,-26); }
    // ---------- something that moves, far away (a giant bug, seen once) ----------
    { const bug=new THREE.Group(); const bm=new THREE.MeshStandardMaterial({color:col(0x0a0806),roughness:.5,metalness:.2});
      const seg=(r,x,y)=>{ const s=sph(r,bm,x,y,0,14,10); s.scale.multiply(V3(1.3,.75,.85)); bug.add(s); return s; };
      seg(.32,-.55,.42); seg(.12,-.12,.4); seg(.2,.18,.45); seg(.17,.5,.52);
      lv.bugLegs=[]; for(let i=0;i<3;i++) for(const sd of [-1,1]){ const l=new THREE.Group(); l.position.set(-.05+i*.22,.42,sd*.12); bug.add(l); const a=mesh(new THREE.CylinderGeometry(.018,.014,.5,6),bm,0,0,0); a.position.y=-.2; a.rotation.z=.4; l.add(a); l.rotation.x=sd*.9; lv.bugLegs.push(l); }
      bug.scale.setScalar(1.25); bug.visible=false; scene.add(bug); lv.bug=bug; }
    // the floor height + walls
    lv.ground=(x,z)=>pyrFloor(x,z); lv.surfaceAt=()=>'stone';
    lv.onMove=p=>pyrClamp(p,PLAYER.radius);
    lv.jay2=makeJay2(); lv.jay2.userData.level='pyramid'; lv.jay2.visible=false; scene.add(lv.jay2);
    lv.trail=[];
  },
  enter(){
    FX.sunWorld=null;
    for(const h of this.snd||[]) h&&h.stop(.2);
    const C=PYR.roomC;
    this.snd=[SND.play('wind_loop',{loop:true,vol:.5,pos:V3(0,1.6,1),ref:3}),
      SND.play('drips',{loop:true,vol:.55,pos:V3(-2,-1,-60),ref:5}),
      SND.play('drips',{loop:true,vol:.45,pos:V3(2,-3,-94),ref:4,offset:7}),
      SND.play('hum_purple',{loop:true,vol:.5,pos:V3(C.x,C.y+.6,C.z),ref:2.5})];
    setAmbience([]);
  },
  exit(){ for(const h of this.snd||[]) h&&h.stop(1); this.snd=null; },
  update(dt,t){
    const lv=this;
    // the glow breathes
    const pulse=.85+Math.sin(t*1.7)*.1+Math.sin(t*4.3)*.04;
    lv.under.intensity=2.6*pulse; lv.farGlow.intensity=1.3*pulse; lv.ring.material.opacity=.85+.15*Math.sin(t*1.7);
    for(const f of lv.fruits){ if(f.parent===lv.scene) f.userData.m.emissiveIntensity=(lv.fruitGlow||2.2)*pulse; }
    for(const s of lv.shafts) s.userData.u.time.value=t;
    // dust drifting in the sun beams
    lv.dustT=(lv.dustT||0)-dt; if(lv.dustT<=0){ lv.dustT=.05; const sp=pick(lv.shaftSpots); const k=Math.random(); const p=sp.top.clone().lerp(sp.bot,k); p.x+=rand(-.25,.25)*(.4+k); p.z+=rand(-.25,.25)*(.4+k);
      lv.glow.spawn(p.x,p.y,p.z,rand(-.05,.05),rand(-.03,.02),rand(-.05,.05),rand(3,6),rand(.006,.014),1,.85,.6,.55,0,.2,0); }
    // the bug, when it runs
    if(lv.bugRun){ const B=lv.bugRun; B.t+=dt; const k=B.t/B.dur; lv.bug.position.lerpVectors(B.a,B.b,k); lv.bug.position.y=pyrFloor(lv.bug.position.x,lv.bug.position.z); lv.bugLegs.forEach((l,i)=>{ l.rotation.y=Math.sin(t*40+i*2)*.5; }); if(k>=1){ lv.bug.visible=false; lv.bugRun=null; } }
    // the trail Jay 2 follows (your footsteps)
    const tr=lv.trail, last=tr[tr.length-1]; if(!last||Math.hypot(last.x-PLAYER.pos.x,last.z-PLAYER.pos.z)>.5){ tr.push(PLAYER.pos.clone()); if(tr.length>400) tr.shift(); }
    const J=lv.jay2; if(J.visible) J.position.y=pyrFloor(J.position.x,J.position.z);
    if(lv.follow&&J.visible) pyrFollow(lv,dt);
    // dark down here: your eyes slowly get used to it
    FX.exposure=damp(FX.exposure,lv.expTarget||1.28,.5,dt);
  }
});
/* Jay 2 walks your trail, a couple of steps behind */
function pyrFollow(lv,dt){
  const J=lv.jay2, A=J.userData.A, tr=lv.trail; if(!tr.length) return;
  const d=Math.hypot(J.position.x-PLAYER.pos.x,J.position.z-PLAYER.pos.z);
  if(d<2.1){ if(A.path) A.path=null; A.look=A.look||'player'; return; }
  if(A.path) return;
  // the trail point about 1.8 m behind you
  let i=tr.length-1, acc=0; while(i>0&&acc<1.8){ acc+=tr[i].distanceTo(tr[i-1]); i--; }
  // walk from the trail point nearest to him up to that point
  let near=0, nd=1e9; for(let k=0;k<=i;k++){ const dd=(tr[k].x-J.position.x)**2+(tr[k].z-J.position.z)**2; if(dd<nd){ nd=dd; near=k; } }
  const pts=[]; for(let k=near;k<=i;k++) if(k===i||(k-near)%2===0) pts.push(V3(tr[k].x,0,tr[k].z));
  if(!pts.length) return;
  const speed=d>5?2.9:2.1;
  walkTo(J,pts,speed); A.look=null;
}
