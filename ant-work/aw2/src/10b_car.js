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
  // ---- inside: a real car interior (see carInterior) ----
  const IN=opt.simple?carInteriorSimple(g):carInterior(g,opt);   // parked + traffic cars get a cheap inside (no lag)
  const steer=IN.steer, wheelOnly=IN.wheelOnly;
  const lights=[]; if(opt.night){ for(const z of [-.56,.56]){ const sl=new THREE.SpotLight(col(0xfff2d6),4,40,.45,.5,1.4); sl.position.set(2.3,.74,z); sl.target.position.set(12,-.5,z*3); g.add(sl); g.add(sl.target); lights.push(sl); } }
  g.userData={wheels,paint,lights,headM,tailM,steer,wheelOnly,speedo:IN.speedo,tacho:IN.tacho};
  g.traverse(m=>{ if(m.isMesh && m.material===glass) m.castShadow=false; });
  return g;
}
function spinWheels(car,dist){ for(const w of car.userData.wheels) w.rotation.z-=dist/.36; }

/* real photo-scan textures (leather, seat fabric, carpet), loaded from data: URLs baked into the page */
const _AWTEX={};
function awTex(name,rx=1,ry=1,srgb=true){ const k=name+rx+'_'+ry; if(_AWTEX[k]) return _AWTEX[k]; if(typeof AW_TEX==='undefined'||!AW_TEX[name]) return null;
  const t=new THREE.TextureLoader().load(AW_TEX[name]); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx,ry); if(srgb) t.encoding=THREE.sRGBEncoding; t.anisotropy=4; return _AWTEX[k]=t; }
function carTexMat(name,o={}){ return new THREE.MeshStandardMaterial(Object.assign({map:awTex(name,o.rx||1,o.ry||1),normalMap:awTex(name+'N',o.rx||1,o.ry||1,false),roughness:.8,color:0xffffff},o.m||{})); }
/* a car seat: cushion + backrest with side bolsters, a fabric center, a headrest on two posts, a seat belt */
function carSeat(leather,fab,chrome,belt){
  const s=new THREE.Group();
  s.add(rbox(.52,.12,.5,.05,leather,0,0,0)); s.add(rbox(.38,.03,.36,.02,fab,.0,.07,0,false));
  for(const z of [-.22,.22]) s.add(rbox(.5,.1,.08,.04,leather,0,.06,z));                       // cushion bolsters
  const bk=new THREE.Group(); bk.position.set(-.24,.06,0); bk.rotation.z=.2; s.add(bk);
  bk.add(rbox(.12,.66,.5,.05,leather,0,.33,0)); bk.add(rbox(.03,.5,.34,.02,fab,.06,.32,0,false));
  for(const z of [-.22,.22]){ const bo=rbox(.14,.56,.08,.04,leather,.03,.3,z); bo.rotation.y=z>0?.25:-.25; bk.add(bo); }   // back bolsters
  for(const z of [-.07,.07]) bk.add(cyl(.008,.008,.12,chrome,0,.72,z,8));                   // headrest posts
  bk.add(rbox(.1,.18,.28,.05,leather,0,.83,0));                                              // headrest
  return s;
}
function carInterior(g,opt){
  const leather=carTexMat('leather',{rx:2,ry:2,m:{roughness:.55}}), fab=carTexMat('seatfab',{rx:3,ry:3,m:{roughness:.95}}), carpet=carTexMat('carpet',{rx:3,ry:2,m:{roughness:1}});
  const dashM=mat(0x1b1c20,{roughness:.62}), dashSoft=mat(0x2a2b30,{roughness:.85}), trim=mat(0x3a3b40,{roughness:.4,metalness:.5}), chrome=mat(0xc8ccd0,{metalness:1,roughness:.18}), black=mat(0x0e0e10,{roughness:.5});
  const belt=mat(0x1a1a1c,{roughness:.9});
  // floor
  g.add(box(2.3,.04,1.5,carpet,-.15,.5,0,false));
  // front seats + rear bench
  for(const z of [-.38,.38]){ const st=carSeat(leather,fab,chrome,belt); st.position.set(-.12,.6,z); g.add(st);
    // seat belt: from the pillar behind your shoulder, across, to the buckle by the seat
    const sx=z<0?-1:1, a=V3(-.5,1.22,z+sx*.3), bpt=V3(.02,.72,z-sx*.24), d=bpt.clone().sub(a), Lb=d.length();
    const bl=box(.005,Lb,.05,belt,(a.x+bpt.x)/2+.1,(a.y+bpt.y)/2,(a.z+bpt.z)/2,false); bl.quaternion.setFromUnitVectors(V3(0,1,0),d.normalize()); g.add(bl);
    g.add(rbox(.05,.04,.03,.01,chrome,.0,.73,z-sx*.25,false)); g.add(rbox(.06,.08,.04,.02,black,-.02,.66,z-sx*.27,false)); }
  const rb=new THREE.Group(); rb.position.set(-.8,.6,0); g.add(rb); rb.add(rbox(.48,.12,1.42,.05,leather,0,0,0)); rb.add(rbox(.34,.03,1.2,.02,fab,0,.07,0,false));
  const rbk=rbox(.12,.5,1.42,.05,leather,-.22,.3,0); rbk.rotation.z=.18; rb.add(rbk); for(const z of [-.45,0,.45]) rb.add(rbox(.08,.16,.26,.04,leather,-.3,.62,z));
  // center console: shifter (P R N D), cup holders, armrest, handbrake
  g.add(rbox(.62,.22,.22,.04,dashSoft,.12,.62,0)); g.add(rbox(.3,.1,.22,.04,leather,-.12,.76,0));
  const gate=box(.14,.005,.06,black,.28,.735,0,false); g.add(gate);
  const sh=new THREE.Group(); sh.position.set(.27,.74,0); sh.rotation.z=.25; g.add(sh); sh.add(cyl(.01,.012,.1,chrome,0,.05,0,8)); sh.add(rbox(.06,.08,.045,.02,leather,0,.12,0));
  const prndT=canvasTex(128,32,(x,w,h)=>{ x.fillStyle='#0c0c0e'; x.fillRect(0,0,w,h); x.fillStyle='#d8dde4'; x.font='bold 22px Arial'; x.textAlign='center'; x.fillText('P  R  N  D',w/2,23); });
  const prnd=mesh(new THREE.PlaneGeometry(.12,.03),new THREE.MeshBasicMaterial({map:prndT}),.34,.737,0,false); prnd.rotation.x=-Math.PI/2; prnd.rotation.z=Math.PI/2; g.add(prnd);
  for(const x of [.08,.15]) g.add(mesh(GC('cupHole',()=>new THREE.CylinderGeometry(.035,.035,.02,18)),black,x,.735,0,false));
  const hb=new THREE.Group(); hb.position.set(.0,.74,.0); hb.rotation.z=-.3; g.add(hb); hb.add(rbox(.2,.03,.04,.012,black,-.08,0,0));
  // dashboard: soft top, a hood over the gauges, glovebox, vents, radio + climate knobs, a center screen
  g.add(rbox(.5,.2,1.62,.08,dashSoft,.86,.98,0)); g.add(rbox(.26,.2,1.56,.06,dashM,.68,.84,0));
  g.add(rbox(.2,.08,.46,.04,dashSoft,.68,1.1,-.38));                                            // gauge hood
  g.add(rbox(.02,.12,.42,.015,trim,.585,.84,.38,false)); g.add(box(.01,.012,.06,chrome,.58,.86,.24,false));   // glovebox + handle
  // instrument cluster: real dials with moving needles (speedo + rpm)
  const dialT=(label,max,step)=>canvasTex(256,256,(x,w,h)=>{ x.fillStyle='#050608'; x.fillRect(0,0,w,h); x.translate(128,128); x.strokeStyle='#8ad8ff'; x.lineWidth=4; x.beginPath(); x.arc(0,0,110,Math.PI*.75,Math.PI*2.25); x.stroke();
    x.fillStyle='#e8eef4'; x.font='bold 20px Arial'; x.textAlign='center'; x.textBaseline='middle';
    for(let v=0;v<=max;v+=step){ const a=Math.PI*.75+v/max*Math.PI*1.5; x.save(); x.rotate(a); x.fillRect(84,-2,22,4); x.restore(); x.fillText(String(v),Math.cos(a)*64,Math.sin(a)*64); }
    x.font='bold 16px Arial'; x.fillStyle='#8ad8ff'; x.fillText(label,0,58); });
  const mkDial=(z,label,max,step)=>{ const d=new THREE.Group(); d.position.set(.588,1.02,-.38+z); d.rotation.y=-Math.PI/2; d.rotation.x=-.25; g.add(d);
    d.add(mesh(GC('dialFace',()=>new THREE.CircleGeometry(.055,32)),new THREE.MeshBasicMaterial({map:dialT(label,max,step)}),0,0,0,false));
    d.add(mesh(GC('dialRim',()=>new THREE.TorusGeometry(.056,.004,6,32)),chrome,0,0,.001,false));
    const nd=new THREE.Group(); nd.position.z=.003; d.add(nd); nd.add(box(.042,.0035,.002,emissiveMat(0xff5a2a,2.5),.02,0,0,false)); nd.rotation.z=-Math.PI*.75; return nd; };
  const speedo=mkDial(.065,'MPH',120,20), tacho=mkDial(-.065,'x1000',8,1);
  // center screen (map), vents with slats, radio knobs, hazard button
  const mapT=canvasTex(256,160,(x,w,h)=>{ x.fillStyle='#1c2430'; x.fillRect(0,0,w,h); x.strokeStyle='#3a4a5c'; x.lineWidth=10; for(let i=0;i<6;i++){ x.beginPath(); x.moveTo(rand(0,w),0); x.lineTo(rand(0,w),h); x.stroke(); } x.strokeStyle='#58a8ff'; x.lineWidth=7; x.beginPath(); x.moveTo(w*.5,h); x.lineTo(w*.5,h*.35); x.lineTo(w*.8,h*.1); x.stroke(); x.fillStyle='#ffffff'; x.beginPath(); x.moveTo(w*.5,h*.62); x.lineTo(w*.46,h*.72); x.lineTo(w*.54,h*.72); x.fill(); x.fillStyle='#c8d8e8'; x.font='bold 16px Arial'; x.fillText("Jim's Stand  0.4 mi",10,22); });
  const scr=mesh(GC('carScreen2',()=>new THREE.PlaneGeometry(.24,.15)),new THREE.MeshBasicMaterial({map:mapT}),.6,.99,0,false); scr.rotation.y=-Math.PI/2; scr.material.color.setScalar(opt.night?1.1:.8); g.add(scr);
  g.add(rbox(.02,.17,.27,.012,black,.605,.99,0,false));
  for(const z of [-.66,-.13,.13,.66]){ const v=new THREE.Group(); v.position.set(.6,.9,z); g.add(v); v.add(rbox(.02,.06,.13,.01,black,0,0,0,false)); for(let i=0;i<4;i++) v.add(box(.022,.006,.12,trim,0,-.022+i*.015,0,false)); }
  for(const z of [-.08,.08]) g.add(mesh(GC('knob',()=>{ const c=new THREE.CylinderGeometry(.018,.02,.025,20); c.rotateZ(Math.PI/2); return c; }),trim,.59,.86,z,false));
  g.add(rbox(.015,.025,.04,.006,emissiveMat(0xff2a1a,.8),.595,.9,0,false));
  // steering column + wheel (your side), turn-signal stalks, an airbag hub with a badge
  const steer=new THREE.Group(); steer.position.set(.5,1.06,-.38); steer.rotation.z=.42; g.add(steer);
  const wheelOnly=new THREE.Group(); steer.add(wheelOnly);
  wheelOnly.add(mesh(GC('steer3',()=>{ const t=new THREE.TorusGeometry(.18,.022,12,40); t.rotateY(Math.PI/2); return t; }),leather,0,0,0,false));
  wheelOnly.add(mesh(GC('steerHub2',()=>{ const c=new THREE.CylinderGeometry(.07,.075,.06,24); c.rotateZ(Math.PI/2); return c; }),dashM,0,0,0,false));
  wheelOnly.add(mesh(GC('steerBadge',()=>{ const c=new THREE.CylinderGeometry(.018,.018,.005,16); c.rotateZ(Math.PI/2); return c; }),chrome,-.032,0,0,false));
  for(const a of [Math.PI/2,-Math.PI/2,Math.PI]){ const sp=box(.03,.025,.16,dashM,0,Math.sin(a)*.09,Math.cos(a)*.09,false); sp.rotation.x=a; wheelOnly.add(sp); }
  steer.add(cyl(.035,.045,.32,dashM,.17,0,0,12)).children; steer.children[steer.children.length-1].rotation.z=Math.PI/2;
  for(const z of [-.06,.06]){ const st=box(.012,.012,.11,trim,.1,0,z+(z>0?.05:-.05),false); st.rotation.y=z>0?-.3:.3; steer.add(st); }
  // pedals
  for(const [z,w] of [[-.48,.07],[-.36,.1]]){ g.add(box(.012,.16,.012,trim,.62,.66,z,false)); const pd=rbox(.015,.08,w,.006,black,.6,.58,z,false); pd.rotation.z=-.4; g.add(pd); }
  // sun visors + rear-view mirror + dome light
  for(const z of [-.38,.38]){ const sv=rbox(.2,.02,.36,.01,mat(0x8e8a84,{roughness:.95}),.32,1.44,z,false); sv.rotation.z=-.15; g.add(sv); }
  g.add(box(.02,.06,.02,black,.42,1.45,0,false)); g.add(rbox(.03,.07,.24,.02,black,.42,1.4,0,false)); g.add(box(.005,.055,.22,mat(0x9ab0c0,{metalness:1,roughness:.05}),.405,1.4,0,false));
  g.add(rbox(.08,.015,.14,.006,emissiveMat(0xfff0d0,opt.night?.6:.2),-.3,1.49,0,false));
  // doors from the inside: armrest, handle, window buttons, speaker
  for(const z of [-.75,.75]){ const sd=z<0?1:-1;
    g.add(rbox(1.0,.36,.05,.03,dashSoft,.05,.82,z*.99,false)); g.add(rbox(.32,.05,.1,.02,leather,-.05,.78,z*.96,false));
    g.add(box(.08,.025,.02,chrome,.28,.92,z*.955,false));
    for(let i=0;i<2;i++) g.add(box(.025,.01,.03,black,-.1+i*.04,.807,z*.945,false));
    g.add(mesh(GC('speaker',()=>new THREE.CircleGeometry(.06,20)),mat(0x111114,{roughness:.9}),.1,.66,z*.97,false)).children; g.children[g.children.length-1].rotation.y=sd>0?0:Math.PI; }
  return {steer,wheelOnly,speedo,tacho};
}
function carInteriorSimple(g){
  const seatM=mat(0x26262a,{roughness:.85}); for(const z of [-.38,.38]){ g.add(rbox(.5,.12,.48,.05,seatM,-.12,.62,z)); const bk=rbox(.12,.66,.46,.05,seatM,-.38,1.0,z); bk.rotation.z=.2; g.add(bk); }
  g.add(rbox(.5,.2,1.6,.08,mat(0x1b1c20,{roughness:.6}),.86,.98,0));
  const steer=new THREE.Group(); steer.position.set(.5,1.06,-.38); steer.rotation.z=.42; g.add(steer); const wheelOnly=new THREE.Group(); steer.add(wheelOnly);
  wheelOnly.add(mesh(GC('steer3s',()=>{ const t=new THREE.TorusGeometry(.18,.022,8,24); t.rotateY(Math.PI/2); return t; }),mat(0x151515,{roughness:.5}),0,0,0,false));
  return {steer,wheelOnly,speedo:null,tacho:null};
}
