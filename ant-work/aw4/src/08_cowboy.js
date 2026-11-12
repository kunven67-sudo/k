/* ================================================================
   COWBOY KIT (ANT WORK 4) — real 3D props (Poly Haven, CC0, .glb),
   hats / masks / coats / mustaches / gold teeth / a metal hand,
   the guns (revolver, shotgun, rifle, dynamite) and new poses.
   ================================================================ */
const MODELS={};
const MODEL_LIST=['Barrel_01','wooden_crate_01','WoodenTable_01','WoodenChair_01','Lantern_01','wooden_bucket_01','painted_wooden_bench','bolt_action_rifle_7_62','dead_tree_trunk','wooden_barrels_01','Rockingchair_01','vintage_oil_lamp','metal_jerrycan','rock_boulder_dry'];
let _gltfL=null;
function loadModel(name){
  ASSETS.total++; if(!_gltfL) _gltfL=new THREE.GLTFLoader();
  return loadBytes('assets/models/'+name+'.glb').then(ab=>new Promise(res=>{
    _gltfL.parse(ab,'',g=>{ const s=g.scene; s.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; const m=o.material; if(m&&m.map) m.map.anisotropy=4; } }); MODELS[name]=s; assetTick(name); res(s); },
      e=>{ console.warn('model',name,e); assetTick(name); res(null); }); })).catch(e=>{ console.warn('model',name,e); assetTick(name); return null; });
}
/* a copy of a real model (shares geometry + materials) */
function prop(name,x=0,y=0,z=0,ry=0,s=1){ const src=MODELS[name]; const m=src?src.clone(true):new THREE.Group(); m.position.set(x,y,z); m.rotation.y=ry; m.scale.setScalar(s); m.userData.prop=name; return m; }
/* size of a model in metres (for collision) */
function propSize(name){ const src=MODELS[name]; if(!src) return V3(1,1,1); const b=new THREE.Box3().setFromObject(src); return b.getSize(V3()); }

/* ---------- cowboy pieces on a makeHuman() person ---------- */
const COWM={};
function cowMat(k,hex,o={}){ return COWM[k]||(COWM[k]=new THREE.MeshPhysicalMaterial(Object.assign({color:col(hex),roughness:.85,map:charTex().cloth.map,normalMap:charTex().cloth.normalMap,normalScale:new THREE.Vector2(.7,.7),sheen:col(0x222222)},o))); }
function hatMesh(hex=0x5a3a22,wide=1){ const g=new THREE.Group(); const m=cowMat('hat'+hex,hex,{roughness:.95});
  const brim=mesh(lathe('hatBrim'+wide,[[0,0],[.1,0],[.16*wide,-.004],[.175*wide,.012],[.168*wide,.016],[.1,.006],[0,.008]],28),m,0,0,0); brim.scale.z=1.12; g.add(brim);
  const crown=mesh(lathe('hatCrown',[[0,.13],[.05,.128],[.085,.11],[.095,.06],[.098,.0],[0,0]],24),m,0,0,0); crown.scale.z=1.15; g.add(crown);
  const dent=mesh(GC('hatDent',()=>new THREE.BoxGeometry(.012,.03,.13)),cowMat('hatD'+hex,shadeHex(hex,.7)),0,.122,0); g.add(dent);
  const band=mesh(GC('hatBand',()=>new THREE.CylinderGeometry(.099,.1,.022,24,1,true)),mat(0x1a1410,{roughness:.6}),0,.022,0); band.scale.z=1.15; g.add(band);
  return g; }
function cowboy(h,o={}){
  const J=h.userData.J, U=h.userData; U.cow=o;
  if(o.hat!==false){ const hat=hatMesh(o.hatCol||0x5a3a22,o.wide||1); hat.position.set(0,.17,-.005); hat.rotation.x=-.08; J.head.add(hat); U.hat=hat; }
  if(o.mask){ const m=mesh(lathe('bandana',[[0,-.06],[.075,-.05],[.092,.0],[.094,.04],[0,.05]],20,1.1),cowMat('mask'+o.mask,o.mask,{side:THREE.DoubleSide}),0,.0,.03); m.scale.set(1,1,1.05); J.head.add(m); U.mask=m;
    const tri=mesh(GC('bandTri',()=>{ const s=new THREE.Shape(); s.moveTo(-.07,0); s.lineTo(.07,0); s.lineTo(0,-.09); s.lineTo(-.07,0); return new THREE.ShapeGeometry(s); }),cowMat('mask'+o.mask,o.mask),0,-.05,.088); J.head.add(tri); }
  if(o.coat){ const m=cowMat('coat'+o.coat,o.coat,{roughness:.95}); const c=mesh(lathe('duster',[[.0,.0],[.2,0],[.23,-.35],[.27,-.8],[.3,-1.05],[0,-1.05]],20,.75),m,0,.25,0); c.material.side=THREE.DoubleSide; J.chest.add(c); U.coat=c; }
  if(o.vest){ const v=mesh(lathe('vest',[[0,.18],[.17,.16],[.19,.0],[.18,-.2],[0,-.22]],18,.72),cowMat('vest'+o.vest,o.vest),0,.12,.004); v.scale.set(1.04,1,1.06); J.chest.add(v); }
  if(o.star){ const s=mesh(GC('badge',()=>new THREE.CylinderGeometry(.022,.022,.006,5)),mat(0xd8b850,{metalness:1,roughness:.25}),-.09,.2,.15); s.rotation.x=Math.PI/2; J.chest.add(s); }
  if(o.mustache){ const m=mat(o.mustache,{roughness:.8}); for(const sd of [-1,1]){ const p=mesh(GC('stache',()=>new THREE.CylinderGeometry(.008,.004,.05,6)),m,sd*.022,-.035,.092); p.rotation.z=sd*1.25; J.head.add(p); } }
  if(o.goldTooth){ const t=mesh(GC('gtooth',()=>new THREE.BoxGeometry(.012,.012,.006)),new THREE.MeshPhysicalMaterial({color:col(0xffd040),metalness:1,roughness:.15,emissive:col(0x3a2a00)}),.012,-.052,.088); (J.jaw||J.head).add(t); U.goldTooth=t; }
  if(o.eyepatch){ const p=mesh(GC('patch',()=>new THREE.CircleGeometry(.022,14)),mat(0x111111,{roughness:.7}),.035,.025,.093); J.head.add(p); const s=mesh(GC('patchS',()=>new THREE.TorusGeometry(.098,.003,4,30)),mat(0x111111),0,.03,0); s.rotation.set(Math.PI/2,0,.35); J.head.add(s); }
  if(o.metalHand&&J.hdR){ J.hdR.traverse(c=>{ if(c.isMesh) c.material=new THREE.MeshPhysicalMaterial({color:col(0x8a8a90),metalness:1,roughness:.35}); }); }
  if(o.gun&&J.hips){ const hol=mesh(GC('holster',()=>new THREE.BoxGeometry(.05,.17,.09)),mat(0x4a2a16,{roughness:.6}),.17,-.08,.0); J.hips.add(hol); const r=gunMesh('revolver'); r.scale.setScalar(.9); r.rotation.set(Math.PI/2,0,0); r.position.set(.17,-.02,.0); J.hips.add(r); }
  return h; }

/* ---------- the guns (first person + in hands) ---------- */
const GUNM={};
function gunMats(){ if(GUNM.steel) return GUNM;
  GUNM.steel=new THREE.MeshPhysicalMaterial({color:col(0x3a3c40),metalness:1,roughness:.32,clearcoat:.4});
  GUNM.dark=new THREE.MeshPhysicalMaterial({color:col(0x1c1d20),metalness:1,roughness:.42});
  GUNM.brass=new THREE.MeshPhysicalMaterial({color:col(0xb8903a),metalness:1,roughness:.3});
  const w=pbrMat('rough_wood',.2,{opts:{roughness:.55}}); w.color=col(0x7a4a26); GUNM.wood=w; return GUNM; }
function gunMesh(kind){ const M=gunMats(), g=new THREE.Group(); g.userData.kind=kind;
  if(kind==='revolver'){
    const barrel=mesh(GC('rvB',()=>new THREE.CylinderGeometry(.009,.009,.16,12)),M.steel,0,.012,-.1); barrel.rotation.x=Math.PI/2; g.add(barrel);
    g.add(mesh(GC('rvRib',()=>new THREE.BoxGeometry(.008,.006,.15)),M.steel,0,.023,-.095));
    const cyl_=mesh(GC('rvC',()=>new THREE.CylinderGeometry(.021,.021,.042,6)),M.steel,0,.006,-.006); cyl_.rotation.x=Math.PI/2; g.add(cyl_); g.userData.cyl=cyl_;
    g.add(mesh(GC('rvF',()=>new THREE.BoxGeometry(.022,.04,.07)),M.dark,0,.002,.0));
    const grip=mesh(GC('rvG',()=>new THREE.BoxGeometry(.024,.085,.034)),M.wood,0,-.045,.04); grip.rotation.x=-.32; g.add(grip);
    const ham=mesh(GC('rvH',()=>new THREE.BoxGeometry(.008,.02,.014)),M.steel,0,.026,.035); ham.rotation.x=-.4; g.add(ham); g.userData.hammer=ham;
    const tg=mesh(GC('rvT',()=>new THREE.TorusGeometry(.014,.0025,6,14,Math.PI)),M.brass,0,-.022,.012); tg.rotation.set(0,Math.PI/2,Math.PI); g.add(tg);
    g.userData.muzzle=V3(0,.012,-.18); }
  else if(kind==='shotgun'){
    for(const x of [-.011,.011]){ const b=mesh(GC('sgB',()=>new THREE.CylinderGeometry(.011,.011,.5,12)),M.steel,x,.012,-.28); b.rotation.x=Math.PI/2; g.add(b); }
    g.add(mesh(GC('sgR',()=>new THREE.BoxGeometry(.05,.04,.1)),M.dark,0,.0,-.0));
    const fore=mesh(GC('sgFo',()=>new THREE.BoxGeometry(.04,.03,.18)),M.wood,0,-.012,-.14); g.add(fore);
    const stock=mesh(GC('sgS',()=>new THREE.BoxGeometry(.042,.07,.3)),M.wood,0,-.04,.18); stock.rotation.x=.18; g.add(stock);
    g.userData.muzzle=V3(0,.012,-.54); }
  else if(kind==='rifle'){
    const src=MODELS['bolt_action_rifle_7_62']; if(src){ const r=src.clone(true); const b=new THREE.Box3().setFromObject(r), s=b.getSize(V3()); const L=Math.max(s.x,s.z); r.scale.setScalar(1.05/L); if(s.x>s.z) r.rotation.y=Math.PI/2; g.add(r); }
    else { const b=mesh(GC('rfB',()=>new THREE.CylinderGeometry(.008,.009,.7,10)),M.steel,0,.02,-.3); b.rotation.x=Math.PI/2; g.add(b); g.add(mesh(GC('rfS',()=>new THREE.BoxGeometry(.04,.06,.6)),M.wood,0,-.01,.1)); }
    g.userData.muzzle=V3(0,.03,-.55); }
  else if(kind==='dynamite'){
    const m=new THREE.MeshPhysicalMaterial({color:col(0xb0281c),roughness:.7}); for(let i=0;i<3;i++){ const s=mesh(GC('dyn',()=>new THREE.CylinderGeometry(.014,.014,.16,12)),m,(i-1)*.03,0,0); g.add(s); }
    const tape=mesh(GC('dynT',()=>new THREE.BoxGeometry(.1,.02,.034)),mat(0x2a2620,{roughness:.9}),0,0,0); g.add(tape);
    const fuse=mesh(GC('dynF',()=>new THREE.CylinderGeometry(.002,.002,.06,4)),mat(0xd8d0b0),0,.1,0); fuse.rotation.z=.4; g.add(fuse); g.userData.fuse=fuse; }
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; } }); return g; }

/* ---------- poses ---------- */
POSES.aim=(t)=>({shR:[-1.45,0,-.05],elR:[-.12,0,0],hdR:[.0,0,0],shL:[-1.25,.45,.35],elL:[-.55,.3,0],head:[.05,0,0],spine:[.05,0,0]});
POSES.aimRifle=(t)=>({shR:[-1.25,-.1,-.2],elR:[-1.3,0,0],shL:[-1.35,.35,.1],elL:[-.3,0,0],head:[.12,.1,0],spine:[.08,0,0]});
POSES.handsUp=(t)=>{ const s=Math.sin(t*2.2)*.03; return {shL:[-2.9+s,.15,.25],elL:[-.35,0,0],shR:[-2.9-s,-.15,-.25],elR:[-.35,0,0],head:[-.05,0,0]}; };
POSES.ride=(t)=>({thL:[-1.3,0,-.5],knL:[1.4,0,0],thR:[-1.3,0,.5],knR:[1.4,0,0],shL:[-.6,.2,.2],elL:[-1.0,0,0],shR:[-.6,-.2,-.2],elR:[-1.0,0,0],spine:[.12,0,0]});
POSES.dig=(t)=>{ const s=Math.sin(t*3.2); return {shL:[-.9+s*.4,.3,.2],elL:[-.9,0,0],shR:[-.8+s*.4,-.3,-.2],elR:[-1.1,0,0],spine:[.35+s*.15,0,0],head:[.2,0,0]}; };
POSES.drink=(t)=>({shR:[-1.6,-.2,-.3],elR:[-2.1,0,0],head:[-.35,0,0]});
POSES.cards=(t)=>({shL:[-.9,.3,.3],elL:[-1.6,.2,0],shR:[-.9,-.3,-.3],elR:[-1.6,-.2,0],head:[.35,0,0],spine:[.15,0,0]});
POSES.piano=(t)=>{ const s=Math.sin(t*9)*.08, c=Math.cos(t*7)*.08; return {shL:[-.85+s,.3,.25],elL:[-1.2,0,0],shR:[-.85+c,-.3,-.25],elR:[-1.2,0,0],head:[.15,Math.sin(t*1.3)*.15,0],spine:[.1,0,0]}; };
if(!POSES.lieBack) POSES.lieBack=POSES.lieDown||POSES.dead;
