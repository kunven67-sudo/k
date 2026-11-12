/* ================================================================
   DUSTREACH — Dry Gulch (one street, both sides), the wastes around it,
   the old mine (north), the rail line + trestle over the canyon (west),
   the rusty spaceport (east), the bones + the buried ship (south).
   Real textures (Poly Haven), real props (.glb), a full day: sunrise ->
   noon -> sundown (the Hollow Riders) -> night -> dawn.
   ================================================================ */
const DUST={street:11, walk:14, mine:V3(-200,0,-540), rail:{x:-220,z0:-560,z1:470}, canyon:{z:-290,half:26,depth:42},
  station:V3(-220,0,10), spaceport:V3(470,0,30), hangar:V3(470,0,-20), ship:V3(90,0,440), bones:V3(60,0,400), camp:V3(-170,0,270)};
/* the buildings: side -1 = west of the street (door faces +x), +1 = east */
const BLD=[
  {id:'saloon',  name:'SALOON',        s:-1,z:-6, w:26,d:22,h:9},
  {id:'sheriff', name:'SHERIFF',       s:-1,z:28, w:14,d:12,h:5.5},
  {id:'undertaker',name:'UNDERTAKER',  s:-1,z:50, w:12,d:11,h:5},
  {id:'church',  name:'',              s:-1,z:84, w:16,d:22,h:8},
  {id:'hotel',   name:'HOTEL',         s:1, z:-46,w:18,d:14,h:8.5},
  {id:'store',   name:'GENERAL STORE · GUNS',s:1,z:-16,w:18,d:15,h:6},
  {id:'doc',     name:'DOC BISHOP',    s:1, z:10, w:13,d:12,h:5.5},
  {id:'tobias',  name:'TOBIAS · REPAIRS',s:1,z:34,w:16,d:16,h:6},
  {id:'stable',  name:'STABLE',        s:1, z:62, w:22,d:18,h:6.5}];
const B_=id=>BLD.find(b=>b.id===id);
/* a point inside a building: u = 0 (front wall) .. 1 (back wall), v = -1 .. 1 along the street */
function inB(id,u,v,y=0){ const b=B_(id); return V3(b.s*(DUST.walk+.4+u*(b.d-.8)),y,b.z+v*(b.w/2-.6)); }
function bRect(b){ const xa=b.s*DUST.walk, xb=b.s*(DUST.walk+b.d); return {x0:Math.min(xa,xb),x1:Math.max(xa,xb),z0:b.z-b.w/2,z1:b.z+b.w/2}; }
function insideB(x,z,pad=0){ for(const b of BLD){ const r=bRect(b); if(x>r.x0+pad&&x<r.x1-pad&&z>r.z0+pad&&z<r.z1-pad) return b; } return null; }
function signTex(txt,w=512,h=96){ return canvasTex(w,h,(c,W,H)=>{ c.fillStyle='#d9c49a'; c.fillRect(0,0,W,H); for(let i=0;i<40;i++){ c.fillStyle='rgba(90,60,30,'+(Math.random()*.12)+')'; c.fillRect(0,Math.random()*H,W,1+Math.random()*2); }
  c.strokeStyle='#4a2e18'; c.lineWidth=6; c.strokeRect(5,5,W-10,H-10); c.fillStyle='#3a1e0e'; c.font='bold '+Math.min(64,Math.floor(W*1.5/Math.max(6,txt.length)))+'px Georgia'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(txt,W/2,H/2+3); }); }
defineLevel('dust',{
  title:'Dry Gulch',
  env:{fx:{exposure:1.08,saturation:1.0,contrast:1.08,temp:.12,bloomStrength:.3,bloomThreshold:1.1,aoRadius:.6,vignette:.35,grain:.035},music:null,reverb:.15,surface:'sand',far:1700,speed:3.4},
  async build(scene,lv){
    lv.occluders=[]; lv.doors=[]; lv.hide=[]; lv.lamps=[];
    const sunDir=V3(.4,.7,.3); const sky=makeSky({top:0x2a64b8,mid:0x8ab8e8,horizon:0xf0dcb0,bottom:0x8a7050,sunDir,sunColor:0xfff0d0}); scene.add(sky); lv.sky=sky;
    lv.stars=makeStars(3000,1400); lv.stars.visible=false; scene.add(lv.stars);
    lv.rig=makeRig(scene,{sun:2.6,sunColor:0xfff0d8,hemi:.55,sky:0xa8c8f0,ground:0x8a6a48,dir:sunDir,span:70,dist:200,far:420});
    scene.fog=new THREE.FogExp2(col(0xd8c8a8),.0016);
    /* ---- the ground: flat town, dunes, mesas, the canyon ---- */
    const C=DUST.canyon, R=DUST.rail;
    const H=(x,z)=>{ const town=Math.hypot(x*.9,z*.55); let h=fbm2(x*.004,z*.004)*26+fbm2(x*.02,z*.02)*3;
      h*=smooth(clamp((town-150)/220,0,1));
      for(const [mx,mz,mr,mh] of [[-120,-560,110,46],[300,-420,90,38],[-520,120,120,52],[560,420,100,40],[-420,-420,80,34]]){ const d=Math.hypot(x-mx,z-mz); h+=mh*smooth(clamp((mr-d)/22,0,1)); }
      if(x<-60){ const d=Math.abs(z-C.z); const w=C.half+fbm2(x*.02,3)*8; const cut=smooth(clamp((w-d)/10,0,1)); h=lerp(h,-C.depth+fbm2(x*.05,z*.05)*4,cut*smooth(clamp((-60-x)/30,0,1))); }
      const rd=Math.abs(x-R.x); if(rd<14&&z>R.z0&&z<R.z1&&Math.abs(z-C.z)>C.half+8) h=lerp(0,h,smooth(clamp((rd-5)/9,0,1)));
      return h; };
    const hf=heightField(1800,180,H); lv.hf=hf;
    const gtex=pbrMat('dry_ground_01',7,{w:1800,h:1800,opts:{roughness:1}}); gtex.color=col(0xd8b890);
    const g=new THREE.PlaneGeometry(1800,1800,180,180); g.rotateX(-Math.PI/2); const pa=g.attributes.position; for(let i=0;i<pa.count;i++) pa.setY(i,hf.at(pa.getX(i),pa.getZ(i))); g.computeVertexNormals(); withAO(g);
    const ground=mesh(g,gtex,0,0,0,false); ground.receiveShadow=true; scene.add(ground);
    const street=texPlane(26,250,'mud_cracked_dry_03',6,0,.03,10,{opts:{roughness:1}}); street.material.color=col(0xc8a880); scene.add(street);
    /* ---- the buildings ---- */
    const plank=(w,h,tint)=>{ const m=pbrMat('brown_planks_03',3,{w,h,opts:{roughness:.9}}); m.color=col(tint||0xc8a078); return m; };
    const floorM=pbrMat('old_wooden_floor_02',3,{w:30,h:30,opts:{roughness:.8}}); floorM.color=col(0xb89070);
    const roofM=pbrMat('roof_planks',4,{w:30,h:30,opts:{roughness:.95}}); roofM.color=col(0x9a7a5a);
    const walkM=pbrMat('wood_planks_dirt',3,{w:3,h:30,opts:{roughness:.9}}); walkM.color=col(0xb08a62);
    const glassM=new THREE.MeshPhysicalMaterial({color:col(0x6a7a80),roughness:.15,metalness:.1,transparent:true,opacity:.55});
    const dark=mat(0x2a1c12,{roughness:.9});
    const wall=(x0,z0,x1,z1,y0,y1,m,occ=true)=>{ const w=Math.max(.3,Math.abs(x1-x0)), d=Math.max(.3,Math.abs(z1-z0)); const o=box(w,y1-y0,d,m,(x0+x1)/2,(y0+y1)/2,(z0+z1)/2); scene.add(o); if(occ) lv.occluders.push(o); colBox(lv.col,Math.min(x0,x1)-.15,Math.max(x0,x1)+.15,Math.min(z0,z1)-.15,Math.max(z0,z1)+.15); return o; };
    for(const b of BLD){
      const s=b.s, xf=s*DUST.walk, xb=s*(DUST.walk+b.d), z0=b.z-b.w/2, z1=b.z+b.w/2, D=2.6, DH=3.2, tint=b.id==='church'?0xe0d8c8:b.id==='hotel'?0xb8907a:null;
      const wm=plank(b.w,b.h,tint), sm=plank(b.d,b.h,tint);
      // front wall with the door (and the windows' frames)
      wall(xf,z0,xf,b.z-D/2,0,b.h,wm); wall(xf,b.z+D/2,xf,z1,0,b.h,wm); const lint=box(.3,b.h-DH,D,wm,xf,(b.h+DH)/2,b.z); scene.add(lint); lv.occluders.push(lint);
      wall(xb,z0,xb,z1,0,b.h,wm); wall(xf,z0,xb,z0,0,b.h,sm); wall(xf,z1,xb,z1,0,b.h,sm);
      for(const v of [-.55,.55]){ const wz=b.z+v*(b.w/2); const gl=box(.06,1.5,2,glassM,xf+s*.0,1.9,wz,false); scene.add(gl); for(const yy of [1.12,2.68]) scene.add(box(.4,.12,2.3,dark,xf,yy,wz)); for(const dz of [-1.08,1.08]) scene.add(box(.4,1.7,.12,dark,xf,1.9,wz+dz)); }
      // false front (taller facade) + sign
      const ff=box(.35,2.6,b.w,wm,xf,b.h+1.3,b.z); scene.add(ff); lv.occluders.push(ff);
      if(b.name){ const sg=mesh(new THREE.PlaneGeometry(Math.min(b.w-2,b.name.length*.8+2),1.6),new THREE.MeshStandardMaterial({map:signTex(b.name),roughness:.85}),xf-s*.2,b.h+1.2,b.z,false); sg.rotation.y=-s*Math.PI/2; scene.add(sg); }
      // roof + ceiling (the saloon's has a hole over the card table)
      if(b.id==='saloon'){ const hx=s*(DUST.walk+8), hz=b.z, hr=1.8; const xa=Math.min(xf,xb), xbb=Math.max(xf,xb);
        for(const [x0,x1,zz0,zz1] of [[xa,hx-hr,z0,z1],[hx+hr,xbb,z0,z1],[hx-hr,hx+hr,z0,hz-hr],[hx-hr,hx+hr,hz+hr,z1]]){ const r=box(x1-x0,.35,zz1-zz0,roofM,(x0+x1)/2,b.h+.18,(zz0+zz1)/2); scene.add(r); }
        lv.roofHole=V3(hx,b.h,hz); const splint=mat(0x6a4a2a,{roughness:.9}); for(let i=0;i<8;i++){ const a=i/8*Math.PI*2; const p=box(.12,.08,rand(.5,1.1),splint,hx+Math.cos(a)*hr,b.h-.05,hz+Math.sin(a)*hr); p.rotation.set(rand(-.4,.4),a,rand(-.5,.5)); scene.add(p); } }
      else scene.add(box(Math.abs(xb-xf),.35,b.w,roofM,(xf+xb)/2,b.h+.18,b.z));
      scene.add(texPlane(Math.abs(xb-xf)-.2,b.w-.2,'old_wooden_floor_02',3,(xf+xb)/2,.12,b.z,{opts:{roughness:.8}}));
      // the porch (boardwalk, posts, a little roof)
      const px=s*(DUST.street+1.5); scene.add(box(3,.25,b.w+.6,walkM,px,.12,b.z)); for(const pz of [z0+.3,b.z-D/2-.6,b.z+D/2+.6,z1-.3]) scene.add(cyl(.09,.1,3.3,dark,s*(DUST.street+.2),1.75,pz,8));
      const pr=box(3.4,.15,b.w+.8,roofM,px,3.45,b.z); pr.rotation.z=-s*.12; scene.add(pr);
      // a lamp by the door (lights up at night)
      const lamp=prop('Lantern_01',s*(DUST.walk-.3),2.6,b.z+D/2+.5,0,1); scene.add(lamp); lv.lamps.push({o:lamp,b});
    }
    lv.lampL=[]; for(const id of ['saloon','hotel','sheriff','church','store']){ const b=B_(id); const L=new THREE.PointLight(col(0xffa850),0,22,1.7); L.position.set(b.s*(DUST.walk-1.2),3,b.z); lv.scene.add(L); lv.lampL.push(L); }
    // the church steeple + cross + bell, the hotel's second floor windows, the stable's open front
    { const b=B_('church'), x=b.s*(DUST.walk+3); const st=box(4,7,4,plank(4,7,0xe0d8c8),x,b.h+3.5,b.z); scene.add(st); const cm=mat(0x3a2a1a); scene.add(box(.25,2.4,.25,cm,x,b.h+8.2,b.z)); scene.add(box(.25,.25,1.4,cm,x,b.h+8.6,b.z));
      lv.bell=cyl(.35,.6,.8,new THREE.MeshPhysicalMaterial({color:col(0xa08040),metalness:1,roughness:.35}),x,b.h+5.5,b.z,16); scene.add(lv.bell); }
    /* ---- inside: the saloon ---- */
    { const b=B_('saloon'), s=b.s;
      const bar=box(1.2,1.15,14,mat(0x4a2a16,{roughness:.5}),s*(DUST.walk+b.d-3.2),.58,b.z); scene.add(bar); colBoxC(lv.col,bar.position.x,bar.position.z,1.2,14); lv.occluders.push(bar);
      scene.add(box(1.4,.08,14.4,mat(0x2a160a,{roughness:.3}),bar.position.x,1.2,b.z));
      for(let i=0;i<3;i++) scene.add(shelfUnit(s*(DUST.walk+b.d-.45),b.z-5+i*5,true));
      lv.tables=[]; for(const [u,v] of [[.36,0],[.25,-.6],[.25,.6],[.62,-.65]]){ const p=inB('saloon',u,v); const t=prop('WoodenTable_01',p.x,0,p.z,0,1.3); scene.add(t); lv.tables.push(t); colCircle(lv.col,p.x,p.z,.9);
        for(let k=0;k<4;k++){ const a=k*Math.PI/2+.4; scene.add(prop('WoodenChair_01',p.x+Math.cos(a)*1.2,0,p.z+Math.sin(a)*1.2,-a+Math.PI/2,1.1)); } }
      lv.crashTable=lv.tables[0];
      // the piano
      const pm=mat(0x2a1408,{roughness:.35,metalness:.05}); const pp=inB('saloon',.55,.9); const pi=new THREE.Group(); pi.position.copy(pp); pi.rotation.y=Math.PI; pi.add(box(2.2,1.4,.8,pm,0,.7,0)); pi.add(box(2.1,.06,.3,mat(0xf0ece0,{roughness:.4}),0,1.0,.48)); for(let k=0;k<20;k++) pi.add(box(.05,.03,.18,mat(0x111111),-1+k*.105,1.04,.52)); scene.add(pi); lv.piano=pi; colCircle(lv.col,pp.x,pp.z,1.2);
      // swinging doors
      lv.swing=[]; for(const sd of [-1,1]){ const d=new THREE.Group(); d.position.set(s*DUST.walk,1.1,b.z+sd*1.25); const pnl=box(.06,1.3,1.15,mat(0x6a4426,{roughness:.7}),0,0,-sd*.58); d.add(pnl); scene.add(d); lv.swing.push(d); }
      // the trapdoor behind the bar (Moe's cellar) — locked
      const tp=inB('saloon',.94,-.75); lv.trap=box(1.4,.08,1.4,mat(0x3a2412,{roughness:.8}),tp.x,.17,tp.z); scene.add(lv.trap); lv.trapPos=tp;
      // the cellar (under the saloon): the masks, the ledger, gold
      const cy=-4; lv.cellar={x0:Math.min(tp.x-3,tp.x+3),x1:Math.max(tp.x-3,tp.x+3),z0:tp.z-3,z1:tp.z+3,y:cy};
      const cm=pbrMat('red_sandstone_wall',3,{w:6,h:6}); for(const [w,h,d,x,y,z] of [[6,.2,6,tp.x,cy,tp.z],[6,.2,6,tp.x,cy+3.4,tp.z],[.2,3.4,6,tp.x-3,cy+1.7,tp.z],[.2,3.4,6,tp.x+3,cy+1.7,tp.z],[6,3.4,.2,tp.x,cy+1.7,tp.z-3],[6,3.4,.2,tp.x,cy+1.7,tp.z+3]]) scene.add(box(w,h,d,cm,x,y,z));
      lv.masks=new THREE.Group(); lv.masks.position.set(tp.x-s*2.3,cy+1.6,tp.z); for(let k=0;k<4;k++){ const m=mesh(GC('maskHang',()=>new THREE.PlaneGeometry(.35,.3)),new THREE.MeshStandardMaterial({color:col(0x1a1a1a),roughness:.9,side:THREE.DoubleSide}),0,0,-1.2+k*.8,false); m.rotation.y=Math.PI/2; lv.masks.add(m); } scene.add(lv.masks);
      lv.ledger=box(.35,.06,.5,mat(0x5a1a14),tp.x+s*1.8,cy+.95,tp.z+1.6); scene.add(lv.ledger); scene.add(prop('wooden_crate_01',tp.x+s*1.8,cy+.1,tp.z+1.6,0,1));
      lv.cellarL=new THREE.PointLight(col(0xffb060),0,9,2); lv.cellarL.position.set(tp.x,cy+2.6,tp.z); scene.add(lv.cellarL);
      lv.saloonL=new THREE.PointLight(col(0xffc080),1.2,26,1.6); lv.saloonL.position.copy(inB('saloon',.5,0,6)); scene.add(lv.saloonL); }
    /* ---- inside: the others ---- */
    { // sheriff: desk, the jail cell (locked)
      scene.add(prop('WoodenTable_01',inB('sheriff',.3,-.4).x,0,inB('sheriff',.3,-.4).z,Math.PI/2,1.2)); scene.add(prop('WoodenChair_01',inB('sheriff',.45,-.4).x,0,inB('sheriff',.45,-.4).z,0,1.1));
      const c0=inB('sheriff',.62,.1), bars=new THREE.Group(); const bm=new THREE.MeshPhysicalMaterial({color:col(0x2a2a2a),metalness:1,roughness:.5}); for(let i=0;i<10;i++) bars.add(cyl(.03,.03,3,bm,0,1.5,-2.6+i*.58,6)); bars.position.set(c0.x,0,c0.z); scene.add(bars); colBox(lv.col,c0.x-.1,c0.x+.1,c0.z-2.8,c0.z+.4); lv.cell=c0; }
    { const p=inB('doc',.7,.4); scene.add(box(2.2,.6,1,mat(0xe8e4d8,{roughness:.9}),p.x,.5,p.z)); scene.add(shelfUnit(inB('doc',.97,-.5).x,inB('doc',.97,-.5).z,true)); }
    { const p=inB('store',.6,0); const ct=box(1,1.1,10,mat(0x5a3a1e,{roughness:.6}),p.x-B_('store').s*1.5,.55,p.z); scene.add(ct); colBoxC(lv.col,ct.position.x,ct.position.z,1,10);
      for(let i=0;i<3;i++) scene.add(shelfUnit(inB('store',.97,-.6+i*.6).x,inB('store',.97,-.6+i*.6).z,false));
      for(let i=0;i<4;i++) scene.add(prop('Barrel_01',inB('store',.15,-.85+i*.12).x,0,inB('store',.15,-.85+i*.12).z,i,1)); }
    { for(let i=0;i<3;i++) scene.add(prop('metal_jerrycan',inB('tobias',.9,-.5+i*.3).x,0,inB('tobias',.9,-.5+i*.3).z,i,1)); const wb=inB('tobias',.6,.5); scene.add(box(3,1,1.2,mat(0x4a3a2a,{roughness:.7}),wb.x,.5,wb.z)); colBoxC(lv.col,wb.x,wb.z,3,1.2); }
    { for(let i=0;i<5;i++) for(const v of [-.45,.45]){ const p=inB('church',.15+i*.15,v); scene.add(prop('painted_wooden_bench',p.x,0,p.z,Math.PI/2,1.3)); } }
    { lv.coffins=[]; for(let i=0;i<4;i++){ const p=inB('undertaker',.35+i*.16,.3); const c=box(.7,.45,2,mat(0x3a2414,{roughness:.8}),p.x,.25,p.z); c.rotation.y=Math.PI/2; scene.add(c); lv.coffins.push(c); } }
    { for(let i=0;i<3;i++){ const p=inB('hotel',.5,-.6+i*.6); scene.add(box(1.2,.5,2.1,mat(0xd8d0c0,{roughness:.95}),p.x,.4,p.z)); } }
    { lv.stalls=[]; for(let i=0;i<3;i++){ const p=inB('stable',.55,-.6+i*.6); scene.add(box(.15,1.4,3,mat(0x5a3a1e),p.x,.7,p.z-1.8)); lv.stalls.push(p); scene.add(prop('wooden_bucket_01',p.x+1,0,p.z+.6,0,1)); } }
    /* ---- the street dressing ---- */
    for(const [x,z,n,r] of [[9,-30,'Barrel_01',0],[9.5,-28.8,'Barrel_01',1],[-9.4,12,'wooden_crate_01',.3],[-9,40,'wooden_barrels_01',1.2],[9,46,'wooden_crate_01',.8],[9.4,72,'Barrel_01',2],[-9,-34,'wooden_bucket_01',0],[-9.2,64,'wooden_crate_01',2]]){ const o=prop(n,x,0,z,r,1); scene.add(o); colCircle(lv.col,x,z,.6); lv.hide.push({x,z,r:1.2,low:true}); }
    { const t=new THREE.Group(); t.position.set(18,0,-70); const wm=pbrMat('rough_wood',.5,{opts:{roughness:.85}}); wm.color=col(0x8a6a4a); for(const [dx,dz] of [[-2,-2],[2,-2],[-2,2],[2,2]]) t.add(cyl(.18,.22,8,wm,dx,4,dz,8)); t.add(cyl(3,3,3.5,wm,0,9.6,0,20)); t.add(mesh(new THREE.ConeGeometry(3.3,1.4,20),pbrMat('roof_planks',2,{}),0,12,0)); scene.add(t); colCircle(lv.col,18,-70,3); }
    /* ---- the rail line, the station, the trestle over the canyon ---- */
    { const tieM=pbrMat('rough_wood',.6,{opts:{roughness:.9}}); tieM.color=col(0x6a4a30); const railM=new THREE.MeshPhysicalMaterial({color:col(0x5a4a40),metalness:1,roughness:.45});
      const n=Math.floor((R.z1-R.z0)/1.2), ties=new THREE.InstancedMesh(UBOX,tieM,n); const m4=new THREE.Matrix4();
      const ry=z=>Math.abs(z-C.z)<C.half+10?0:Math.max(0,hf.at(R.x,z));
      for(let i=0;i<n;i++){ const z=R.z0+i*1.2; m4.makeScale(2.6,.18,.28); m4.setPosition(R.x,ry(z)+.09,z); ties.setMatrixAt(i,m4); } ties.receiveShadow=true; scene.add(ties);
      for(const dx of [-.72,.72]){ const r=box(.08,.14,R.z1-R.z0,railM,R.x+dx,.25,(R.z0+R.z1)/2); scene.add(r); }
      lv.railY=ry;
      // the trestle
      const tw=pbrMat('rough_wood',1,{opts:{roughness:.9}}); tw.color=col(0x7a5a3a); const tr=new THREE.Group(); scene.add(tr);
      for(let z=C.z-C.half-6;z<=C.z+C.half+6;z+=5){ const gy=hf.at(R.x,z); for(const dx of [-2,2]){ const L=Math.max(.5,-gy+.1); tr.add(cyl(.18,.22,L,tw,R.x+dx,-L/2,z,8)); } const L2=Math.max(.5,-gy); const x1=box(.15,.15,Math.hypot(L2,4)+.4,tw,R.x,-L2/2,z); x1.rotation.x=Math.atan2(L2,4)-Math.PI/2; if(L2>2) tr.add(x1); }
      tr.add(box(3.4,.3,C.half*2+16,tw,R.x,-.05,C.z));
      // the station + its water tower + the switch lever
      const st=DUST.station; scene.add(box(5,.6,18,walkM,st.x+4,.3,st.z)); const shed=box(4,3.2,7,plank(7,3.2),st.x+6.5,1.9,st.z); scene.add(shed); lv.occluders.push(shed); colBoxC(lv.col,st.x+6.5,st.z,4,7);
      lv.lever=new THREE.Group(); lv.lever.position.set(st.x+3,0,st.z-12); lv.lever.add(box(.3,.4,.3,dark,0,.2,0)); const hd=cyl(.04,.04,1.3,mat(0x8a2a1a,{roughness:.5}),0,.75,0,6); lv.lever.add(hd); lv.leverHandle=hd; scene.add(lv.lever); }
    /* ---- the mine entrance (in the mesa, north-west) ---- */
    { const M=DUST.mine, y=hf.at(M.x,M.z+6); lv.mineY=y; const tw=pbrMat('rough_wood',1,{opts:{roughness:.9}}); tw.color=col(0x6a4a30);
      const fr=new THREE.Group(); fr.position.set(M.x,y,M.z); fr.add(box(.4,4.2,.4,tw,-2.2,2.1,0)); fr.add(box(.4,4.2,.4,tw,2.2,2.1,0)); fr.add(box(5.2,.5,.5,tw,0,4.3,0)); fr.add(box(4,4,.2,mat(0x050403),0,2,-.6));
      const sgn=mesh(new THREE.PlaneGeometry(3,.7),new THREE.MeshStandardMaterial({map:signTex('OLD MINE · KEEP OUT',512,110)}),0,5,.3,false); fr.add(sgn); scene.add(fr); lv.mineDoor=fr; }
    /* ---- the spaceport (east): rusty, half broken, Rider guards ---- */
    { const S=DUST.spaceport, rm=pbrMat('rusty_metal_02',4,{w:40,h:40,opts:{roughness:.7,metalness:.6}}), cor=pbrMat('rusty_corrugated_iron',3,{w:30,h:10,opts:{roughness:.75,metalness:.5}});
      for(const [dx,dz] of [[0,0],[50,-40],[50,40]]){ const pad=texPlane(30,30,'stone_tiles_02',4,S.x+dx,.05,S.z+dz,{opts:{roughness:.95}}); pad.material.color=col(0x8a8070); scene.add(pad); }
      const tw=new THREE.Group(); tw.position.set(S.x-30,0,S.z+30); tw.add(box(5,22,5,rm,0,11,0)); tw.add(box(9,4,9,rm,0,23,0)); const twg=box(9.2,2,9.2,glassM,0,23.5,0,false); tw.add(twg); tw.rotation.z=.06; scene.add(tw); colCircle(lv.col,S.x-30,S.z+30,4);
      // the hangar (locked door)
      const Hg=DUST.hangar; const hw=26, hd=22, hh=12;
      for(const [x0,z0,x1,z1] of [[Hg.x-hw/2,Hg.z-hd/2,Hg.x+hw/2,Hg.z-hd/2],[Hg.x-hw/2,Hg.z-hd/2,Hg.x-hw/2,Hg.z+hd/2],[Hg.x+hw/2,Hg.z-hd/2,Hg.x+hw/2,Hg.z+hd/2]]) wall(x0,z0,x1,z1,0,hh,cor);
      scene.add(box(hw,.4,hd,cor,Hg.x,hh,Hg.z));
      lv.hangarDoor=box(hw-1,hh-.5,.4,cor,Hg.x,hh/2,Hg.z+hd/2); scene.add(lv.hangarDoor); lv.occluders.push(lv.hangarDoor); lv.hangarCol=colBox(lv.col,Hg.x-hw/2,Hg.x+hw/2,Hg.z+hd/2-.3,Hg.z+hd/2+.3,()=>!F.hangarOpen);
      lv.portShip=makeOldShip(.9); lv.portShip.position.set(Hg.x,0,Hg.z); scene.add(lv.portShip);
      // broken stuff
      for(let i=0;i<8;i++){ const o=box(rand(2,6),rand(.5,3),rand(2,6),rm,S.x+rand(-40,60),.5,S.z+rand(-60,60)); o.rotation.set(rand(-.3,.3),rand(0,6),rand(-.3,.3)); scene.add(o); colFromObj(lv.col,o,{circle:true}); }
      const fence=new THREE.Group(); for(let a=0;a<64;a++){ const ang=a/64*Math.PI*2; if(a%9===0) continue; fence.add(cyl(.08,.08,3,rm,S.x+20+Math.cos(ang)*80,1.5,S.z+Math.sin(ang)*80,6)); } scene.add(fence); }
    /* ---- the bones + the buried ship (south) ---- */
    { const B=DUST.bones, bm=new THREE.MeshPhysicalMaterial({color:col(0xe8dcc0),roughness:.8,sheen:col(0x554433)});
      for(let i=0;i<9;i++){ const rib=mesh(new THREE.TorusGeometry(9-Math.abs(i-4)*1.1,.45,8,26,Math.PI*.95),bm,B.x+(i-4)*3,0,B.z); rib.rotation.set(0,Math.PI/2,rand(-.05,.05)); scene.add(rib); }
      { const sp=mesh(new THREE.CylinderGeometry(.7,.6,30,10),bm,B.x,.7,B.z); sp.rotation.z=Math.PI/2; scene.add(sp); }
      const skull=new THREE.Group(); skull.position.set(B.x+18,0,B.z+4); skull.add(ell(4,3,5,bm,0,2.4,0)); skull.add(ell(1.2,1,1.2,mat(0x1a1410),1.6,3,3.6)); skull.add(ell(1.2,1,1.2,mat(0x1a1410),-1.6,3,3.6)); scene.add(skull); colCircle(lv.col,B.x+18,B.z+4,4.5);
      const S=DUST.ship; lv.bship=makeOldShip(1.1); lv.bship.position.set(S.x,-4.2,S.z); lv.bship.rotation.set(.12,-.6,.08); scene.add(lv.bship); lv.bshipY=-4.2;
      lv.sandMound=mesh(new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2),pbrMat('desert_sand',4,{w:30,h:30}),S.x,-.4,S.z); lv.sandMound.scale.set(16,3.4,12); scene.add(lv.sandMound);
      colCircle(lv.col,S.x,S.z,9,()=>!F.shipDug); }
    /* ---- the survivors' camp ---- */
    { const P=DUST.camp; const tent=mesh(new THREE.ConeGeometry(3,3.2,4,1,true),new THREE.MeshStandardMaterial({color:col(0xc8b898),roughness:1,side:THREE.DoubleSide}),P.x,1.6,P.z); tent.rotation.y=Math.PI/4; scene.add(tent);
      lv.campFire=new THREE.PointLight(col(0xff9040),0,18,1.6); lv.campFire.position.set(P.x+4,1,P.z+2); scene.add(lv.campFire); for(let i=0;i<8;i++) scene.add(box(.15,.15,.9,dark,P.x+4+Math.cos(i)*.5,.1,P.z+2+Math.sin(i)*.5)); }
    /* ---- rocks + dead trees out in the wastes ---- */
    { const rs={s:42,next(){ this.s=(this.s*16807)%2147483647; return (this.s-1)/2147483646; }}; for(let i=0;i<34;i++){ const a=rs.next()*Math.PI*2, r=170+rs.next()*520, x=Math.cos(a)*r, z=Math.sin(a)*r; if(Math.abs(x-R.x)<12||Math.abs(z-C.z)<C.half+6&&x<-60) continue; const s=1.5+rs.next()*3; const y=hf.at(x,z);
        if(i%3===0){ const t=prop('dead_tree_trunk',x,y-.2,z,rs.next()*6,1.4+rs.next()); scene.add(t); colCircle(lv.col,x,z,.8); }
        else { const o=prop('rock_boulder_dry',x,y-.3,z,rs.next()*6,s); scene.add(o); colCircle(lv.col,x,z,s*.7); lv.hide.push({x,z,r:s+.6,low:true}); } } }
    /* ---- ground, surfaces, bounds ---- */
    lv.ground=(x,z)=>{ if(lv.inCellar){ const c=lv.cellar; if(x>c.x0&&x<c.x1&&z>c.z0&&z<c.z1) return c.y+.1; }
      const b=insideB(x,z); if(b) return .15; if(Math.abs(Math.abs(x)-(DUST.street+1.5))<1.5&&z>-60&&z<100&&insideBZ(z)) return .25;
      if(Math.abs(x-R.x)<2.2&&Math.abs(z-C.z)<C.half+10) return 0;
      return hf.at(x,z); };
    lv.surfaceAt=(x,z)=>insideB(x,z)||(Math.abs(Math.abs(x)-(DUST.street+1.5))<1.5&&insideBZ(z))?'wood':'sand';
    lv.col.bounds=[-860,860,-860,860];
    lv.ambT=0;
  },
  enter(){ setAmbience([['wind',.05]]); },
  update(dt,t){ const lv=this; if(typeof dayTick==='function') dayTick(lv,dt,t);
    for(const d of lv.swing||[]){ const near=Math.hypot(PLAYER.pos.x-d.position.x,PLAYER.pos.z-d.position.z)<1.6; d.userData.k=damp(d.userData.k||0,near?1:0,6,dt); d.rotation.y=Math.sin(t*3)*.03*(1-d.userData.k)+d.userData.k*1.2*Math.sign(d.position.z-B_('saloon').z); }
    if(PLAYER.y<-14&&G.mode==='play'&&!lv.inCellar&&typeof loopDie==='function') loopDie('fell'); }
});
function insideBZ(z){ for(const b of BLD) if(z>b.z-b.w/2-.3&&z<b.z+b.w/2+.3) return true; return false; }
/* an old ship: long hull, stubby wings, round cockpit, rust */
function makeOldShip(s=1){ const g=new THREE.Group(); const rm=pbrMat('rusty_metal_02',2,{w:8,h:8,opts:{roughness:.65,metalness:.7}}); rm.color=col(0xb8a090);
  const hull=mesh(lathe('shipHull',[[0,-9],[1.6,-8],[2.8,-5],[3.2,-1],[3,3],[2.2,6],[1.2,8],[0,8.6]],26),rm,0,3,0); hull.rotation.x=Math.PI/2; g.add(hull);
  for(const sd of [-1,1]){ const w=box(7,.35,4,rm,sd*5.5,2.6,-2.5); w.rotation.z=sd*-.12; g.add(w); const e=cyl(.9,1.1,3,rm,sd*3.2,3,-7.5,14); e.rotation.x=Math.PI/2; g.add(e); }
  const cp=mesh(new THREE.SphereGeometry(1.6,20,12,0,Math.PI*2,0,Math.PI/2),new THREE.MeshPhysicalMaterial({color:col(0x5a7080),roughness:.1,metalness:.2,transparent:true,opacity:.7}),0,5.2,4); g.add(cp);
  const hatch=box(1.6,2,.2,mat(0x3a3430,{roughness:.6,metalness:.6}),3.05,3,0); hatch.rotation.y=Math.PI/2; g.add(hatch); g.userData.hatch=hatch;
  g.scale.setScalar(s); g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } }); return g; }
/* a wooden wall shelf with bottles (saloon, doc) or tins + boxes (the store) */
function shelfUnit(x,z,bottles){ const g=new THREE.Group(); g.position.set(x,0,z); if(x<0) g.rotation.y=Math.PI; const w=pbrMat('rough_wood',.6,{opts:{roughness:.8}}); w.color=col(0x5a3418);
  g.add(box(.45,2.6,.08,w,0,1.3,-1.6)); g.add(box(.45,2.6,.08,w,0,1.3,1.6)); g.add(box(.08,2.6,3.3,w,.2,1.3,0));
  for(const y of [1.1,1.65,2.2]) g.add(box(.45,.06,3.3,w,0,y,0));
  const glass=[0x2a5a2a,0x5a3a14,0x8a6a2a,0x2a3a2a,0x6a1a14];
  for(const y of [1.1,1.65,2.2]) for(let i=0;i<9;i++){ const zz=-1.4+i*.35+rand(-.05,.05);
    if(bottles){ const m=new THREE.MeshPhysicalMaterial({color:col(pick(glass)),roughness:.08,metalness:0,clearcoat:1,transparent:true,opacity:.85}); const b=cyl(.045,.05,.26,m,0,y+.16,zz,10); g.add(b); g.add(cyl(.016,.02,.1,m,0,y+.34,zz,8)); }
    else { if(i%2) g.add(box(.3,.22,.28,mat(pick([0x8a6a4a,0x6a4a2a,0xa08060]),{roughness:.9}),0,y+.14,zz)); else g.add(cyl(.06,.06,.14,new THREE.MeshPhysicalMaterial({color:col(0x9a9a9a),metalness:1,roughness:.35}),0,y+.1,zz,12)); } }
  return g; }
