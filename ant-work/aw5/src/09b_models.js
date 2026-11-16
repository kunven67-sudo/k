/* real props (Poly Haven CC0 models, shrunk) for AW5 */
const MODELS={};
const MODEL_LIST=['old_military_crate','metal_tool_chest','portable_generator','industrial_storage_cart','worn_metal_rack','barrel_03','metal_office_desk','hanging_industrial_lamp','portable_searchlight','rock_07','moon_rock_01','wooden_crate_02','dining_chair_02'];
let _gltfL=null;
function loadModel(name){
  ASSETS.total++; if(!_gltfL) _gltfL=new THREE.GLTFLoader();
  return loadBytes('assets/models/'+name+'.glb').then(ab=>new Promise(res=>{
    _gltfL.parse(ab,'',g=>{ const s=g.scene; s.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; const m=o.material; if(m&&m.map) m.map.anisotropy=4; } }); MODELS[name]=s; assetTick(name); res(s); },
      e=>{ console.warn('model',name,e); assetTick(name); res(null); }); })).catch(e=>{ console.warn('model',name,e); assetTick(name); return null; });
}
/* a copy of a real model (shares geometry + materials) */
function prop(name,x=0,y=0,z=0,ry=0,s=1){ const src=MODELS[name]; const m=src?src.clone(true):new THREE.Group(); m.position.set(x,y,z); m.rotation.y=ry; m.scale.setScalar(s); m.userData.prop=name; return m; }
/* a real model scaled to fit a size (biggest side = size, or height = h), sitting on y=0 */
function fitProp(name,size,h){ if(!MODELS[name]){ const g=new THREE.Group(); g.add(box(size*.6,(h||size)*.6,size*.6,mat(0x6a6a6a),0,(h||size)*.3,0)); return g; } const m=prop(name); const b=new THREE.Box3().setFromObject(m), sz=b.getSize(new THREE.Vector3()); const k=h?Math.min(size/Math.max(sz.x,sz.z),h/sz.y):size/Math.max(sz.x,sz.y,sz.z);
  m.scale.setScalar(k); const b2=new THREE.Box3().setFromObject(m), c=b2.getCenter(new THREE.Vector3()); const g=new THREE.Group(); m.position.set(-c.x,-b2.min.y,-c.z); g.add(m); return g; }
