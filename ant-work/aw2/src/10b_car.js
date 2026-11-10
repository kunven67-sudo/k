/* ================================================================
   YOUR CAR — a real sedan shape (not a flat slab): the body is lofted
   from rounded cross-sections (hood slopes down, sides lean in at the
   top, round nose and tail, real wheel arches), a glass cabin, and a
   full inside: dashboard with lit gauges, a screen, vents, a rear-view
   mirror, and the steering wheel on the DRIVER's side (yours: left).
   Faces +x. Driver sits at z=-.38, passenger at z=+.38.
   ================================================================ */
/* a grid surface: fn(u,v) -> [x,y,z], u along the car, v around the section */
function carLoft(nu,nv,fn){
  const P=[], idx=[];
  for(let i=0;i<=nu;i++) for(let j=0;j<=nv;j++){ const p=fn(i/nu,j/nv); P.push(p[0],p[1],p[2]); }
  for(let i=0;i<nu;i++) for(let j=0;j<nv;j++){ const a=i*(nv+1)+j, b=a+nv+1; idx.push(a,b,a+1, b,b+1,a+1); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(P,3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const CAR_WHEELS=[[1.38,.8],[1.38,-.8],[-1.42,.8],[-1.42,-.8]];
function carBodyGeo(){ return GC('carBody2',()=>{
  const L0=-2.32, L1=2.34, n=5;
  const se=(c,e)=>Math.sign(c)*Math.pow(Math.abs(c),2/e);
  return carLoft(64,40,(u,v)=>{
    const x=lerp(L0,L1,u);
    // side view: trunk deck, beltline, hood sloping down to the nose
    let yt = x<-1.3 ? lerp(.96,1.02,smooth(clamp((x-L0)/1.0,0,1))) : x<1.05 ? 1.02 : lerp(1.0,.84,smooth(clamp((x-1.05)/1.29,0,1)));
    let yb=.3, W=.9;
    // round nose + tail (plan and side)
    const ex=Math.max(0,Math.abs(x)-(x>0?2.0:1.98))/(x>0?L1-2.0:-L0-1.98), r=Math.sqrt(Math.max(0,1-ex*ex));
    const yc=x>0?.58:.62; yt=yc+(yt-yc)*lerp(.35,1,r); yb=yc+(yb-yc)*lerp(.55,1,r); W*=lerp(.35,1,r);
    const th=v*Math.PI*2-Math.PI/2;               // seam at the bottom
    const cs=Math.cos(th), sn=Math.sin(th);
    const H=(yt-yb)/2; let y=(yt+yb)/2+se(sn,n)*H;
    const up=Math.max(0,se(sn,n));                 // sides lean in toward the top
    let z=se(cs,n)*W*(1-.07*up);
    // open the cabin: between the doors the top sinks to the floor (it was a solid lid = red paint where the seats + dash should be)
    const cab=smooth(clamp((x+1.3)/.12,0,1))*(1-smooth(clamp((x-.98)/.12,0,1)));
    if(cab>0 && sn>0){ const keep=smooth(clamp((Math.abs(cs)-.5)/.22,0,1)); y=lerp(y,lerp(.44,y,keep),cab); z*=lerp(1,lerp(.9,1,keep),cab); }
    // wheel arches: the lower sides lift over each wheel
    if(Math.abs(cs)>.35){ for(const [wx] of CAR_WHEELS){ const d=x-wx; if(Math.abs(d)<.5){ const ay=.37+Math.sqrt(.25-d*d)*1.02; if(y<ay) y=ay; } } }
    if(sn<-.6){ for(const [wx] of CAR_WHEELS){ const d=x-wx; if(Math.abs(d)<.5){ const ay=.37+Math.sqrt(.25-d*d)*1.02; if(y<ay) y=ay; } } }
    return [x,y,z];
  });
}); }
/* the glass cabin: windshield, side windows, rear window (and the roof on top of it) */
function carCabinGeo(top){ return GC('carCabin2'+(top?'R':''),()=>carLoft(40,24,(u,v)=>{
  const x=lerp(-1.3,1.12,u);
  const roof=x<-.8 ? lerp(1.0,1.5,smooth(clamp((x+1.3)/.5,0,1))) : x<.38 ? 1.5+Math.sin((x+.8)/1.18*Math.PI)*.025 : lerp(1.5,1.0,smooth(clamp((x-.38)/.74,0,1)));
  const th=v*Math.PI;                              // half-section: left side -> roof -> right side
  const s=Math.cos(th), c=Math.sin(th);            // s: -1..1 across, c: 0..1 up
  const W=.86, Wt=.66, h=Math.max(.001,roof-1.0);
  let k=Math.pow(c,.35);                           // flat-ish sides, rounded roof edge
  let y=1.0+k*h, z=s*lerp(W,Wt,k);
  if(top){ y+=.012; if(y<roof-.03) y=roof-.03; }   // the roof skin sits on top
  return [x,y,z];
})); }
function makeCar(o={}){
  const opt=Object.assign({paint:0xa8231c,night:false},o);
  const g=new THREE.Group();
  const paint=new THREE.MeshPhysicalMaterial({color:col(opt.paint),metalness:.55,roughness:.32,clearcoat:1,clearcoatRoughness:.04,side:THREE.DoubleSide});
  const paintOut=paint.clone(); paintOut.side=THREE.FrontSide;
  const chrome=mat(0xdddddd,{metalness:1,roughness:.12});
  const black=mat(0x151515,{roughness:.6}), trimBlack=mat(0x0c0c0e,{roughness:.35,metalness:.3});
  const glass=new THREE.MeshPhysicalMaterial({color:col(0x6a8494),side:THREE.DoubleSide,metalness:.1,roughness:.03,transparent:true,opacity:.3,clearcoat:1,envMapIntensity:1.2,depthWrite:false});
  const rubber=mat(0x1a1a1a,{roughness:.85});
  // body + cabin
  g.add(mesh(carBodyGeo(),paint));
  g.add(mesh(carCabinGeo(false),glass,0,0,0,false));
  // roof skin (only the flat middle, the glass shows at the ends)
  const roofG=GC('carRoof2',()=>carLoft(20,16,(u,v)=>{ const x=lerp(-.74,.32,u), th=v*Math.PI, s=Math.cos(th), c=Math.sin(th); const k=Math.pow(c,.35); const y=1.0+k*.515+Math.sin((x+.8)/1.18*Math.PI)*.025*k; return [x,Math.max(1.47,y),s*lerp(.84,.66,k)*(k>.92?1:1.0)]; }));
  g.add(mesh(roofG,paintOut)); g.add(mesh(roofG,mat(0x8e8a84,{roughness:.95,side:THREE.BackSide}),0,0,0,false));   // roof + grey headliner inside
  // pillars + door seams + window line
  for(const z of [-.79,.79]){ for(const [x0,y0,x1,y1] of [[-1.28,1.02,-.8,1.48],[1.1,1.02,.4,1.48],[-.22,1.02,-.22,1.49]]){ const len=Math.hypot(x1-x0,y1-y0); const b=box(.06,len,.04,trimBlack,(x0+x1)/2,(y0+y1)/2,z*(1-.12*((y0+y1)/2-1.0)/.5)); b.rotation.z=-Math.atan2(x1-x0,y1-y0); g.add(b); }
    g.add(box(2.4,.025,.02,chrome,-.08,1.02,z*1.1)); for(const x of [-.24,.9]) g.add(box(.012,.62,.02,trimBlack,x,.7,z*1.135,false)); }
  // wheels (dark wells behind them)
  const wheels=[];
  for(const [x,z] of CAR_WHEELS){
    g.add(mesh(GC('carWell',()=>{ const c=new THREE.CylinderGeometry(.47,.47,.5,24,1,true,0,Math.PI); c.rotateX(Math.PI/2); c.rotateZ(Math.PI/2); return c; }),mat(0x070707,{roughness:1,side:THREE.DoubleSide}),x,.37,z*.92,false));
    const w=new THREE.Group(); w.position.set(x,.36,z); g.add(w);
    const tire=mesh(GC('tire',()=>new THREE.TorusGeometry(.26,.1,14,32)),rubber); w.add(tire);
    const tireCore=mesh(GC('tireCore',()=>{ const c=new THREE.CylinderGeometry(.33,.33,.2,32,1,true); c.rotateX(Math.PI/2); return c; }),rubber); w.add(tireCore);
    const rim=mesh(GC('rim',()=>{ const c=new THREE.CylinderGeometry(.22,.22,.05,24); c.rotateX(Math.PI/2); return c; }),chrome,0,0,z>0?.07:-.07); w.add(rim);
    for(let i=0;i<5;i++){ const sp=box(.035,.2,.03,chrome,0,0,z>0?.1:-.1); sp.rotation.z=i/5*Math.PI*2; sp.position.set(Math.sin(i/5*Math.PI*2)*.1,Math.cos(i/5*Math.PI*2)*.1,z>0?.1:-.1); w.add(sp); }
    w.add(mesh(GC('hub',()=>{ const c=new THREE.CylinderGeometry(.05,.05,.06,12); c.rotateX(Math.PI/2); return c; }),chrome,0,0,z>0?.12:-.12));
    wheels.push(w);
  }
  // lights, grille, bumpers, mirrors, handles, plates, exhaust
  const headM=emissiveMat(0xfff6dd,opt.night?6:.6,{roughness:.1}), tailM=emissiveMat(0xff2010,opt.night?4:.8,{roughness:.2});
  for(const z of [-.56,.56]){ const hl=rbox(.1,.12,.36,.04,headM,2.24,.74,z,false); hl.rotation.y=z>0?-.25:.25; g.add(hl); g.add(rbox(.1,.13,.38,.04,tailM,-2.27,.82,z,false)); }
  g.add(rbox(.08,.16,.74,.04,black,2.31,.56,0,false)); for(let i=0;i<4;i++) g.add(box(.02,.02,.7,chrome,2.35,.5+i*.04,0,false));
  g.add(rbox(.16,.16,1.84,.06,black,2.26,.4,0)); g.add(rbox(.16,.16,1.84,.06,black,-2.27,.42,0));
  g.add(box(.02,.12,.38,mat(0xf0f0e8,{roughness:.5}),-2.36,.6,0,false));
  g.add(cyl(.035,.035,.14,chrome,-2.3,.33,.5,10)).children; g.children[g.children.length-1].rotation.z=Math.PI/2;
  for(const z of [-1,1]){ const mr=new THREE.Group(); mr.position.set(.98,1.1,z*.86); g.add(mr); mr.add(rbox(.16,.11,.16,.03,paint,0,0,z*.08)); mr.add(box(.01,.08,.12,mat(0x8aa0b0,{metalness:1,roughness:.05}),-.08,0,z*.08,false));
    for(const x of [-.55,.45]) g.add(box(.14,.025,.02,chrome,x,.9,z*.93,false)); }
  // ---- inside ----
  g.add(box(2.3,.04,1.56,mat(0x1c1c1e,{roughness:1}),-.15,.5,0,false));   // carpet
  for(const z of [-.74,.74]) g.add(rbox(1.9,.36,.06,.03,mat(0x2a2a2e,{roughness:.8}),-.2,.8,z,false));   // door panels
  const seatM=mat(0x2a2a2e,{roughness:.85}), dashM=mat(0x1a1b1f,{roughness:.55}), softM=mat(0x26272c,{roughness:.9});
  for(const z of [-.38,.38]){ g.add(rbox(.52,.14,.5,.06,seatM,-.12,.6,z)); const bk=rbox(.14,.72,.48,.06,seatM,-.42,1.0,z); bk.rotation.z=.18; g.add(bk); g.add(rbox(.1,.2,.26,.05,seatM,-.5,1.42,z)); }
  g.add(rbox(.46,.14,1.5,.06,seatM,-.78,.6,0)); g.add(rbox(.14,.46,1.5,.06,seatM,-1.0,.9,0));
  g.add(rbox(.36,.42,.2,.05,softM,.1,.62,0));   // center console
  // dashboard: a long rounded shelf under the windshield, a hood over the gauges, a screen, vents
  g.add(rbox(.5,.22,1.6,.08,dashM,.86,.96,0)); g.add(rbox(.3,.14,1.56,.06,dashM,.72,.84,0));
  const hood=rbox(.2,.08,.44,.04,dashM,.68,1.1,-.38); g.add(hood);
  const gaugeM=emissiveMat(0x8ad8ff,opt.night?1.6:.8);
  for(const dz of [-.1,.1]){ const gg=mesh(GC('carGauge',()=>new THREE.RingGeometry(.045,.055,24)),gaugeM,.585,1.02,-.38+dz,false); gg.rotation.y=-Math.PI/2; g.add(gg);
    const nd=box(.004,.004,.045,emissiveMat(0xff6a3a,2),.582,1.02,-.38+dz,false); nd.rotation.x=.7; g.add(nd); }
  const scr=mesh(GC('carScreen',()=>new THREE.PlaneGeometry(.26,.15)),emissiveMat(0x2a6aa8,opt.night?1.2:.6),.62,.98,0,false); scr.rotation.y=-Math.PI/2; scr.rotation.x=0; g.add(scr);
  for(const z of [-.62,-.16,.16,.62]) g.add(rbox(.02,.05,.12,.01,mat(0x333338,{roughness:.4,metalness:.6}),.61,.9,z,false));
  // rear-view mirror
  g.add(box(.02,.06,.02,black,.5,1.45,0,false)); g.add(rbox(.03,.06,.22,.02,black,.5,1.4,0,false)); g.add(box(.005,.045,.2,mat(0x9ab0c0,{metalness:1,roughness:.05}),.485,1.4,0,false));
  // steering wheel: on YOUR side (left, z=-.38), tilted toward you
  const steer=new THREE.Group(); steer.position.set(.5,1.08,-.38); steer.rotation.z=.42; g.add(steer);
  const wheelOnly=new THREE.Group(); steer.add(wheelOnly);   // this one turns
  const sw=mesh(GC('steer2',()=>{ const t=new THREE.TorusGeometry(.18,.022,10,36); t.rotateY(Math.PI/2); return t; }),mat(0x161616,{roughness:.5}),0,0,0,false); wheelOnly.add(sw);
  wheelOnly.add(mesh(GC('steerHub',()=>{ const c=new THREE.CylinderGeometry(.055,.06,.05,18); c.rotateZ(Math.PI/2); return c; }),mat(0x202024,{roughness:.4}),0,0,0,false));
  for(const a of [Math.PI/2,-Math.PI/2,Math.PI]){ const sp=box(.02,.02,.16,mat(0x202024,{roughness:.4}),0,Math.sin(a)*.08,Math.cos(a)*.08,false); sp.rotation.x=a; wheelOnly.add(sp); }
  steer.add(cyl(.03,.035,.3,dashM,.15,0,0,10)).children; steer.children[steer.children.length-1].rotation.z=Math.PI/2;
  const lights=[]; if(opt.night){ for(const z of [-.56,.56]){ const sl=new THREE.SpotLight(col(0xfff2d6),4,40,.45,.5,1.4); sl.position.set(2.3,.74,z); sl.target.position.set(12,-.5,z*3); g.add(sl); g.add(sl.target); lights.push(sl); } }
  g.userData={wheels,paint,lights,headM,tailM,steer,wheelOnly};
  g.traverse(m=>{ if(m.isMesh && m.material===glass) m.castShadow=false; });
  return g;
}
function spinWheels(car,dist){ for(const w of car.userData.wheels) w.rotation.z-=dist/.36; }
