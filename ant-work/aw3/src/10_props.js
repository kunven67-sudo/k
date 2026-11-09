/* ================================================================
   PROPS (ANT WORK 3) — sky-lit environments, real-texture planes,
   small shared helpers. The big stuff lives in the level files.
   ================================================================ */
/* environment map from a sky mesh (so outdoor PBR picks up the real sky colours) */
function envFromSky(sky,extra){
  const s=new THREE.Scene(); const sk=sky.clone(); sk.material=sky.material; s.add(sk);
  if(extra) extra(s);
  const g=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),new THREE.MeshBasicMaterial({color:col(extra&&extra.ground||0x8a6a40)})); g.rotation.x=-Math.PI/2; g.position.y=-2; s.add(g);
  const rt=pmrem.fromScene(s,.03); return rt.texture;
}
/* a flat plane with a real texture tiling every `tile` metres; receives shadows */
function texPlane(w,d,base,tile,x=0,y=0,z=0,o={}){
  const geo=withAO(new THREE.PlaneGeometry(w,d,o.segs||1,o.segs||1));
  const m=pbrMat(base,tile,Object.assign({w,h:d},o)); m.polygonOffset=true; m.polygonOffsetFactor=2; m.polygonOffsetUnits=6;
  const p=mesh(geo,m,x,y,z,false); p.rotation.x=-Math.PI/2; p.receiveShadow=true; return p;
}
/* a box with a real texture on every face, tiling every `tile` metres */
function texBox(w,h,d,base,tile,x=0,y=0,z=0,o={}){
  const geo=withAO(new THREE.BoxGeometry(w,h,d));
  const maps=pbrMaps(base,tile,Object.assign({w:Math.max(w,d),h},o));
  const m=new THREE.MeshStandardMaterial(Object.assign({roughness:1,metalness:0},maps,o.opts||{})); if(maps.normalMap) m.normalScale=new THREE.Vector2(o.normal||1,o.normal||1); if(o.color!=null) m.color=col(o.color);
  return mesh(geo,m,x,y,z,o.shadow!==false);
}
/* a wall: a plane standing up, textured, with collision */
function texWall(lv,w,h,base,tile,x,y,z,ry=0,o={}){
  const geo=withAO(new THREE.PlaneGeometry(w,h));
  const m=pbrMat(base,tile,Object.assign({w,h},o)); if(o.double) m.side=THREE.DoubleSide;
  const p=mesh(geo,m,x,y,z,false); p.rotation.y=ry; p.receiveShadow=true;
  if(lv&&o.col!==false){ const c=Math.cos(ry), s=Math.sin(ry); colOBox(lv.col,x,z,w,.3,ry); }
  return p;
}
/* point the camera-following sun at the player (big outdoor levels) */
function sunFollow(lv){ lv.shadowFocus=f=>{ f.copy(PLAYER.pos); }; }
