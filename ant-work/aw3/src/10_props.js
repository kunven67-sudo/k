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

/* ---------- a real campfire: rough stones, a teepee of logs on an ash bed, layered flickering flame sprites,
   a soft glow, rising embers and a flickering light. makeCampfire(rockMat) -> {g, flame, light, update(dt,t)} ---------- */
let _flameTex=null, _glowTex=null;
function flameTex(){ if(_flameTex) return _flameTex; _flameTex=canvasTex(128,256,(c,w,h)=>{ c.clearRect(0,0,w,h); c.filter='blur(7px)';
    const g=c.createRadialGradient(w/2,h*.8,2,w/2,h*.6,h*.55); g.addColorStop(0,'rgba(255,252,230,1)'); g.addColorStop(.22,'rgba(255,200,90,.95)'); g.addColorStop(.55,'rgba(255,110,25,.55)'); g.addColorStop(1,'rgba(140,25,0,0)');
    c.fillStyle=g; c.beginPath(); c.moveTo(w/2,h*.05); c.bezierCurveTo(w*.74,h*.38,w*.92,h*.72,w/2,h*.94); c.bezierCurveTo(w*.08,h*.72,w*.26,h*.38,w/2,h*.05); c.fill(); }); return _flameTex; }
function glowTex(){ if(_glowTex) return _glowTex; _glowTex=canvasTex(128,128,(c,w,h)=>{ const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2); g.addColorStop(0,'rgba(255,170,80,.9)'); g.addColorStop(.4,'rgba(255,110,30,.35)'); g.addColorStop(1,'rgba(255,80,0,0)'); c.fillStyle=g; c.fillRect(0,0,w,h); }); return _glowTex; }
function makeCampfire(rockM){
  const g=new THREE.Group(), flame=new THREE.Group(); g.add(flame); flame.visible=false;
  for(let i=0;i<10;i++){ const a=i/10*Math.PI*2+rand(-.12,.12), r=rand(1.02,1.18);
    const s=mesh(GC('cfStone'+(i%4),()=>{ const gg=new THREE.DodecahedronGeometry(.3,1); const p=gg.attributes.position; for(let k=0;k<p.count;k++){ const f=1+Math.sin(p.getX(k)*11+i)*.09+Math.cos(p.getZ(k)*8+i)*.09; p.setXYZ(k,p.getX(k)*f,p.getY(k)*f*.68,p.getZ(k)*f); } gg.computeVertexNormals(); return gg; }),rockM,Math.cos(a)*r,.1,Math.sin(a)*r);
    s.rotation.set(rand(0,3),rand(0,3),rand(0,3)); s.scale.setScalar(rand(.8,1.15)); s.castShadow=true; g.add(s); }
  const ash=mesh(new THREE.CircleGeometry(.98,24),new THREE.MeshStandardMaterial({color:col(0x262220),roughness:1}),0,.03,0,false); ash.rotation.x=-Math.PI/2; g.add(ash);
  const wood=pbrMat('rough_wood',1,{opts:{roughness:.95}}); wood.color=col(0x5a4230); const charM=new THREE.MeshStandardMaterial({color:col(0x1a1412),roughness:1,emissive:col(0xff4a10),emissiveIntensity:0});
  const logG=GC('cfLog',()=>{ const lg=new THREE.CylinderGeometry(.065,.085,1.1,8); lg.rotateX(Math.PI/2); lg.translate(0,0,.55); return lg; });
  for(let i=0;i<5;i++){ const a=i/5*Math.PI*2+.3, lg=new THREE.Mesh(logG,i%2?wood:charM); lg.position.set(Math.cos(a)*.66,.07,Math.sin(a)*.66); lg.lookAt(V3(Math.cos(a+.5)*.05,.78,Math.sin(a+.5)*.05)); lg.castShadow=true; g.add(lg); }
  const sprites=[]; const add=(sx,sy,y,c,o)=>{ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:flameTex(),color:col(c),transparent:true,opacity:o,blending:THREE.AdditiveBlending,depthWrite:false})); s.scale.set(sx,sy,1); s.position.y=y; s.userData.b=[sx,sy,y]; flame.add(s); sprites.push(s); return s; };
  add(1.0,1.7,.85,0xff7a30,.75); add(.8,1.35,.72,0xffa850,.85); add(.55,1.0,.6,0xffe0a0,.95); add(.34,.62,.45,0xffffff,.9);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false})); glow.scale.set(3.2,2.4,1); glow.position.y=.5; flame.add(glow);
  const N=36, ep=new Float32Array(N*3), life=new Float32Array(N); for(let i=0;i<N;i++){ life[i]=Math.random(); }
  const eg=new THREE.BufferGeometry(); eg.setAttribute('position',new THREE.BufferAttribute(ep,3));
  const embers=new THREE.Points(eg,new THREE.PointsMaterial({color:col(0xffa040),size:.045,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false})); flame.add(embers);
  const light=new THREE.PointLight(col(0xff9040),0,22,1.6); light.position.y=1.0; g.add(light);
  const seeds=[rand(0,9),rand(0,9),rand(0,9),rand(0,9)];
  return {g,flame,light,update(dt,t){ if(!flame.visible){ light.intensity=0; charM.emissiveIntensity=0; return; }
    sprites.forEach((s,i)=>{ const b=s.userData.b, n=noise1(t*(7+i*2.3)+seeds[i]), m=noise1(t*(5+i)+seeds[i]+3); s.scale.set(b[0]*(1+m*.18),b[1]*(1+n*.28),1); s.position.set(m*.05,b[2]+n*.08,0); s.material.rotation=m*.12; });
    light.intensity=3.2*(1+noise1(t*11)*.18+noise1(t*23)*.08); charM.emissiveIntensity=.55+noise1(t*3)*.25; glow.material.opacity=.45+noise1(t*6)*.12;
    for(let i=0;i<N;i++){ life[i]+=dt*(.35+(i%5)*.07); if(life[i]>1){ life[i]=0; ep[i*3]=rand(-.25,.25); ep[i*3+2]=rand(-.25,.25); ep[i*3+1]=.4; } ep[i*3]+=Math.sin(t*3+i)*dt*.12; ep[i*3+2]+=Math.cos(t*2.6+i)*dt*.12; ep[i*3+1]+=dt*(1.1+(i%3)*.3); }
    eg.attributes.position.needsUpdate=true; }};
}
