/* ================================================================
   3D SOLIDS for the swimming levels (the Tinyverse, Mite Town, the deep).
   Each solid is attached to an object and lives in that object's LOCAL
   space, so moving / spinning / scaled creatures stay solid too.
   shapes: 'ell' (ellipsoid), 'sphere', 'box', 'cyl' (long cylinder along y),
           'sheet' (a curved skin flake), 'fn' (custom world-space test)
   ================================================================ */
const _sm=new THREE.Matrix4(), _sq=new THREE.Vector3(), _sp=new THREE.Vector3(), _sq0=new THREE.Vector3();
/* bounding box of an object in its own local space */
function localBounds(obj,filter){
  obj.updateMatrixWorld(true); const inv=new THREE.Matrix4().copy(obj.matrixWorld).invert(); const box=new THREE.Box3(), tmp=new THREE.Box3(), m=new THREE.Matrix4();
  obj.traverse(o=>{ if(!o.isMesh||(filter&&!filter(o))) return; const m0=Array.isArray(o.material)?o.material[0]:o.material; if(m0&&m0.blending===THREE.AdditiveBlending) return;
    const g=o.geometry; if(!g.boundingBox) g.computeBoundingBox(); m.multiplyMatrices(inv,o.matrixWorld); tmp.copy(g.boundingBox).applyMatrix4(m); box.union(tmp); });
  return box;
}
function addSolid(lv,obj,shape,o={}){
  const S=Object.assign({obj,shape},o);
  if(shape==='ell'||shape==='sphere'||shape==='box'){ if(!S.c) S.c=V3(); }
  // radius (local units) for a quick distance reject
  S.rad=S.rad||(shape==='sphere'?S.r:shape==='ell'?Math.max(S.a.x,S.a.y,S.a.z):shape==='box'?S.max.clone().sub(S.min).length()/2:shape==='cyl'?Math.hypot(S.r,S.h):shape==='sheet'?1.2:1e9);
  if(shape==='box'&&!o.c) S.c=S.min.clone().add(S.max).multiplyScalar(.5);
  (lv.solids||(lv.solids=[])).push(S); return S;
}
/* fit an ellipsoid / sphere / box to an object's own geometry */
function solidAuto(lv,obj,o={}){
  const b=localBounds(obj,o.filter); if(b.isEmpty()) return null; const k=o.k||.85; const c=b.getCenter(new THREE.Vector3()), hs=b.getSize(new THREE.Vector3()).multiplyScalar(.5);
  if(o.shape==='box') return addSolid(lv,obj,'box',{min:c.clone().sub(hs.clone().multiplyScalar(k)),max:c.clone().add(hs.clone().multiplyScalar(k)),cond:o.cond});
  if(o.shape==='sphere') return addSolid(lv,obj,'sphere',{c,r:Math.max(hs.x,hs.y,hs.z)*k,cond:o.cond});
  return addSolid(lv,obj,'ell',{c,a:hs.multiplyScalar(k),cond:o.cond});
}
function worldVisible(o){ while(o){ if(!o.visible) return false; o=o.parent; } return true; }
/* push the swimmer out of every solid; slide along surfaces */
function resolveSolids3(lv,pos,vel,R){
  if(!lv.solids) return;
  for(const S of lv.solids){
    if(S.cond&&!S.cond()) continue;
    if(S.shape==='fn'){ S.fn(pos,vel,R); continue; }
    const o=S.obj; if(!worldVisible(o)) continue;
    const me=o.matrixWorld.elements; const sc=Math.hypot(me[0],me[1],me[2])||1;
    _sp.copy(S.c||_sp.set(0,0,0)).applyMatrix4(o.matrixWorld);
    if(S.shape!=='cyl'&&pos.distanceTo(_sp)>S.rad*sc+R+1) continue;
    _sm.copy(o.matrixWorld).invert(); _sq.copy(pos).applyMatrix4(_sm); _sq0.copy(_sq); const rl=R/sc; let hit=false;
    if(S.shape==='sphere'){ const d=_sq.distanceTo(S.c), m=S.r+rl; if(d<m){ hit=true; if(d<1e-6) _sq.y+=m; else _sq.sub(S.c).multiplyScalar(m/d).add(S.c); } }
    else if(S.shape==='ell'){ const ax=S.a.x+rl, ay=S.a.y+rl, az=S.a.z+rl; const x=(_sq.x-S.c.x)/ax, y=(_sq.y-S.c.y)/ay, z=(_sq.z-S.c.z)/az; const d=Math.hypot(x,y,z); if(d<1){ hit=true; if(d<1e-6) _sq.y=S.c.y+ay; else _sq.set(S.c.x+x/d*ax,S.c.y+y/d*ay,S.c.z+z/d*az); } }
    else if(S.shape==='box'){ const x0=S.min.x-rl,x1=S.max.x+rl,y0=S.min.y-rl,y1=S.max.y+rl,z0=S.min.z-rl,z1=S.max.z+rl; const q=_sq;
      if(q.x>x0&&q.x<x1&&q.y>y0&&q.y<y1&&q.z>z0&&q.z<z1){ hit=true; const pen=[q.x-x0,x1-q.x,q.y-y0,y1-q.y,q.z-z0,z1-q.z]; let mi=0; for(let i=1;i<6;i++) if(pen[i]<pen[mi]) mi=i; [()=>q.x=x0,()=>q.x=x1,()=>q.y=y0,()=>q.y=y1,()=>q.z=z0,()=>q.z=z1][mi](); } }
    else if(S.shape==='cyl'){ const dy=_sq.y-(S.cy||0); if(Math.abs(dy)<S.h){ const dx=_sq.x, dz=_sq.z, d=Math.hypot(dx,dz), m=S.r+rl; if(d<m){ hit=true; if(d<1e-6) _sq.x=m; else { _sq.x=dx/d*m; _sq.z=dz/d*m; } } } }
    else if(S.shape==='sheet'){ const x=_sq.x, y=_sq.y; if((x/S.rx)*(x/S.rx)+(y/S.ry)*(y/S.ry)<1){ const f=S.f(x,y), dz=_sq.z-f, m=S.h+rl; if(Math.abs(dz)<m){ hit=true; _sq.z=f+(dz>=0?m:-m); } } }
    if(hit){ _sq.applyMatrix4(o.matrixWorld); const nx=_sq.x-pos.x, ny=_sq.y-pos.y, nz=_sq.z-pos.z, L=Math.hypot(nx,ny,nz); pos.copy(_sq);
      if(L>1e-6&&vel){ const vn=(vel.x*nx+vel.y*ny+vel.z*nz)/L; if(vn<0){ vel.x-=nx/L*vn*1.2; vel.y-=ny/L*vn*1.2; vel.z-=nz/L*vn*1.2; } }
      if(S.onHit) S.onHit(); }
  }
}
/* a skin flake: a curved sheet; f() matches makeSkinFlake's shape */
function flakeSolid(lv,flake,cond){ const sh=flake.userData.sheet, sd=flake.userData.seed||1; return addSolid(lv,sh,'sheet',{rx:.86,ry:.73,h:.022,f:(x,y)=>.28*x*x-.12*y*y+noise2(x*2+sd,y*2)*.08,cond}); }

