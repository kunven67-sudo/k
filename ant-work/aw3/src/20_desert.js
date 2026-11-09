/* ================================================================
   THE DESERT — blazing noon, dunes to the horizon, one pyramid.
   Real sand (Poly Haven), heat shimmer, sand blowing over the dunes,
   footprints that stay, sun glare when you look up.
   ================================================================ */
const DESERT={size:2400,pyr:V3(0,0,-178),base:150,height:96};
DESERT.door=V3(0,0,DESERT.pyr.z+DESERT.base/2);          // the entrance, ~103 m from where you land
/* real dunes: long ridges across the wind, a gentle side and a steep slip face, smaller dunes on top */
function duneRaw(x,z){
  const warp=fbm2(x*.0032+11,z*.0032-4,3)*1.6;
  const u=z*.0058+x*.0011+warp; const f=u-Math.floor(u);
  const ridge=f<.72?f/.72:(1-f)/.28;                     // windward slope 72%, slip face 28%
  const A=9+fbm2(x*.0021-7,z*.0021+3,2)*9;                 // dune height 0..~18 m
  let h=smooth(ridge)*A;
  h+=fbm2(x*.016+5,z*.016,3)*1.7+fbm2(x*.05,z*.05,2)*.35; // small dunes + lumps
  return h;
}
function duneHeight(x,z){
  let h=duneRaw(x,z);
  const P=DESERT.pyr;
  const dp=Math.max(Math.abs(x-P.x),Math.abs(z-P.z));    // flat, packed ground round the pyramid
  const kp=smooth(invLerp(DESERT.base*.5+10,DESERT.base*.5+80,dp));
  const kl=.3+.7*smooth(invLerp(6,26,Math.hypot(x,z)));   // calmer where you land
  // the way you walk: lower dunes, still up and down
  const kc=(z<14&&z>DESERT.door.z-12)?.38+.62*smooth(invLerp(8,46,Math.abs(x))):1;
  // wind piles sand up against the pyramid's foot (kept clear in front of the door)
  const e=dp-DESERT.base*.5; let drift=e>-2&&e<14?2.4*Math.pow(1-clamp(e/14,0,1),1.6):0;
  if(Math.abs(x)<10&&z>P.z) drift*=smooth(invLerp(5,10,Math.abs(x)));
  drift*=.7+.3*fbm2(x*.05,z*.05,2);
  return h*kp*Math.min(kl,kc)+drift;
}
/* a pyramid built the real way: courses of stone stepping in, each a little worn and different */
function steppedPyramidGeo(base,height,n,tile){
  const pos=[],nor=[],uv=[],cl=[], rr=RNG(5), h=height/n;
  const quad=(a,b,c,d,nn,uvs,k)=>{ pos.push(...a,...b,...c,...a,...c,...d); for(let i=0;i<6;i++){ nor.push(...nn); cl.push(k,k*.982,k*.94); }
    uv.push(...uvs[0],...uvs[1],...uvs[2],...uvs[0],...uvs[2],...uvs[3]); };
  let prev=base/2+.6;
  for(let i=0;i<n;i++){
    const s=Math.min(prev-.35,base/2*(1-i/n)+(rr()-.5)*.24), y0=i*h, y1=y0+h; prev=s;
    const k=.8+rr()*.16+Math.min(1,i/n*1.6)*.1-(i<3?.1*(3-i)/3:0);
    const T=v=>v/tile, side=(u0,u1)=>[[T(u0),T(y0)],[T(u1),T(y0)],[T(u1),T(y1)],[T(u0),T(y1)]];
    quad([-s,y0,s],[s,y0,s],[s,y1,s],[-s,y1,s],[0,0,1],side(-s,s),k);
    quad([s,y0,-s],[-s,y0,-s],[-s,y1,-s],[s,y1,-s],[0,0,-1],side(-s,s),k*.97);
    quad([s,y0,s],[s,y0,-s],[s,y1,-s],[s,y1,s],[1,0,0],side(-s,s),k*.99);
    quad([-s,y0,-s],[-s,y0,s],[-s,y1,s],[-s,y1,-s],[-1,0,0],side(-s,s),k*.96);
    quad([-s,y1,s],[s,y1,s],[s,y1,-s],[-s,y1,-s],[0,1,0],[[T(-s),T(s)],[T(s),T(s)],[T(s),T(-s)],[T(-s),T(-s)]],k*1.04);
  }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setAttribute('uv2',new THREE.Float32BufferAttribute(uv,2)); g.setAttribute('color',new THREE.Float32BufferAttribute(cl,3));
  return g;
}
/* a lumpy weathered rock (radius ~0.5) */
function rockGeo(seed){ const g=new THREE.IcosahedronGeometry(.5,2), p=g.attributes.position, rr=RNG(seed), ox=rr()*50, oz=rr()*50;
  for(let i=0;i<p.count;i++){ const v=new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i)); const k=1+fbm2(v.x*2.2+ox,v.z*2.2+v.y*1.7+oz,3)*.35; v.multiplyScalar(k); if(v.y<-.15) v.y=-.15+(v.y+.15)*.3; p.setXYZ(i,v.x,v.y,v.z); }
  g.computeVertexNormals(); return withAO(g); }
/* desert sand: real ripple texture, sampled twice at different sizes so it never looks tiled */
function sandMaterial(SZ){
  const m=pbrMat('desert_ripple',2.6,{w:SZ,h:SZ,opts:{vertexColors:true,roughness:1},normal:1.25}); m.color=col(0xf6c890);
  m.onBeforeCompile=sh=>{
    sh.fragmentShader=sh.fragmentShader
      .replace('#include <map_fragment>',`
        vec4 texelColor = texture2D( map, vUv );
        vec4 texelBig = texture2D( map, vUv*0.137 + vec2(0.31,0.73) );
        texelColor.rgb = mix( texelColor.rgb, texelBig.rgb, 0.5 );
        texelColor = mapTexelToLinear( texelColor );
        diffuseColor *= texelColor;`)
      .replace('vec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;',
        'vec3 mapN = mix( texture2D( normalMap, vUv ).xyz, texture2D( normalMap, vUv*0.137 + vec2(0.31,0.73) ).xyz, 0.42 ) * 2.0 - 1.0;');
  };
  return m;
}
defineLevel('desert',{
  title:'The Desert',
  env:{fx:{exposure:.9,temp:.12,saturation:1.12,contrast:1.14,bloomStrength:.22,bloomThreshold:1.5,aoRadius:.7,vignette:.3,heat:.4,grain:.025},music:null,reverb:.02,surface:'sand',far:2600,speed:2.9},
  async build(scene,lv){
    const sunDir=V3(.36,.76,.44).normalize(); lv.sunDir=sunDir;
    const sky=makeSky({top:0x1648b8,mid:0x5f97e0,horizon:0xe6d6bc,bottom:0xc09a68,sunDir,sunColor:0xfff6e4,sunSize:.99955,sunGlow:1.4,clouds:0,horizonLift:.01});
    scene.add(sky); lv.skyU=sky.userData.u;
    const ex=()=>{}; ex.ground=0xc8a870; lv.envMap=envFromSky(sky,ex);
    lv.rig=makeRig(scene,{sun:2.9,sunColor:0xfff0d6,hemi:.3,sky:0x9cbcff,ground:0xc89458,dir:sunDir,span:26,dist:120,far:300,bias:-.0005,normalBias:.03});
    lv.sunWorld=sunDir.clone().multiplyScalar(2400);
    scene.fog=new THREE.FogExp2(col(0xe2cfae),.00085); lv.fogBase=.00085;
    await nextFrame();
    // ---- the dunes ----
    const S=dq(150,200,260,320,380), SZ=DESERT.size;
    const tg=new THREE.PlaneGeometry(SZ,SZ,S,S); tg.rotateX(-Math.PI/2); const tp=tg.attributes.position, cc=new Float32Array(tp.count*3);
    for(let i=0;i<tp.count;i++){ const x=tp.getX(i), z=tp.getZ(i); tp.setY(i,duneHeight(x,z)); }
    tg.computeVertexNormals(); const tn=tg.attributes.normal;
    for(let i=0;i<tp.count;i++){ const x=tp.getX(i), z=tp.getZ(i), y=tp.getY(i);
      const slope=1-tn.getY(i), lit=Math.max(0,tn.getX(i)*.22+tn.getY(i)*.9+tn.getZ(i)*.3);
      let k=.8+fbm2(x*.03+9,z*.03,3)*.16+fbm2(x*.004,z*.06,2)*.08+clamp(y/18,0,1)*.12-slope*.35+lit*.06;
      cc[i*3]=k; cc[i*3+1]=k*.94; cc[i*3+2]=k*.84; }
    tg.setAttribute('color',new THREE.BufferAttribute(cc,3)); tg.computeVertexNormals(); withAO(tg);
    const sandM=sandMaterial(SZ);
    const ground=mesh(tg,sandM,0,0,0,false); ground.receiveShadow=true; scene.add(ground);
    lv.hf=heightField(SZ,S,duneHeight); lv.ground=(x,z)=>lv.hf.at(x,z);
    lv.surfaceAt=()=>'sand';
    // packed, trampled sand round the pyramid
    const P=DESERT.pyr, BASE=DESERT.base, HGT=DESERT.height;
    // (packed ground round the pyramid comes from the flatter dunes there)
    // ---- the pyramid ----
    const pyrM=pbrMat('large_sandstone_blocks_01',6.8,{opts:{roughness:1,vertexColors:true},normal:1.4}); pyrM.color=col(0xf2dcb4);
    const pyr=mesh(steppedPyramidGeo(BASE,HGT,56,6.8),pyrM,P.x,-.3,P.z); pyr.castShadow=true; pyr.receiveShadow=true; scene.add(pyr); lv.pyramid=pyr;
    // the cap stone, worn and darker
    // the entrance: a stone porch sticking out of the face toward you, with a black doorway
    const D=DESERT.door, porch=new THREE.Group(); porch.position.set(D.x,0,D.z); scene.add(porch); lv.porch=porch;
    const stoneM=pbrMat('large_sandstone_blocks_01',3,{opts:{roughness:1},normal:1.2}); stoneM.color=col(0xe2cba4);
    const sideM=pbrMat('sandstone_blocks_05',2.4,{opts:{roughness:1}}); sideM.color=col(0xe2caa0);
    const blk=(w,h,d,m,x,y,z)=>{ const b=mesh(withAO(new THREE.BoxGeometry(w,h,d)),m,x,y,z); b.castShadow=b.receiveShadow=true; porch.add(b); return b; };
    blk(2.6,7.2,9,sideM,-3.5,3.6,-1.5); blk(2.6,7.2,9,sideM,3.5,3.6,-1.5);        // the two side walls
    blk(9.6,2.2,9,stoneM,0,8.3,-1.5);                                             // the lintel block on top
    blk(10.6,.5,10,stoneM,0,9.6,-1.5);                                            // a cap
    const dark=new THREE.MeshBasicMaterial({color:0x000000}); const hole=mesh(new THREE.BoxGeometry(4.45,7.2,9.6),dark,0,3.6,-2.2,false); porch.add(hole);
    // a few fallen blocks and half-buried stones around the porch
    const rockM=pbrMat('sandstone_cracks',1.2,{opts:{roughness:1},normal:1.4}); rockM.color=col(0xe8c89a);
    for(const [x,z,sc,r] of [[-7.5,4,1.1,.4],[6.8,6.5,.8,1.2],[9,1,1.4,.2],[-10,9,.7,.9],[4,11,.5,2.1],[-14,-2,1.6,1.7],[13,-1,1.2,2.6]]){ const b=mesh(rockGeo(randi(1,999)),rockM,D.x+x,0,D.z+z); b.scale.set(1.5*sc,.8*sc,1.2*sc); b.position.y=lv.ground(D.x+x,D.z+z)+.12*sc; b.rotation.set(rand(-.2,.2),r,rand(-.15,.15)); b.castShadow=b.receiveShadow=true; scene.add(b); colCircle(lv.col,D.x+x,D.z+z,.9*sc); }
    // walls you can't walk through: the pyramid (except the door) and the porch walls
    colBox(lv.col,P.x-BASE/2,P.x+BASE/2,P.z-BASE/2,D.z-6);
    colBox(lv.col,D.x-4.8,D.x-2.2,D.z-6,D.z+3); colBox(lv.col,D.x+2.2,D.x+4.8,D.z-6,D.z+3);
    lv.col.radius=1000; lv.col.cx=0; lv.col.cz=-60;
    // ---- Jay 2 (normal now, green hoodie) ----
    lv.jay2=makeJay2(); lv.jay2.userData.level='desert'; lv.jay2.visible=false; scene.add(lv.jay2);
    // ---- footprints ----
    lv.prints=[]; lv.printMax=dq(40,80,140,200,260);
    const fpT=canvasTex(64,96,(x,w,h)=>{ x.clearRect(0,0,w,h);
      const foot=(cy,rx,ry,a)=>{ const g=x.createRadialGradient(32,cy,1,32,cy,ry); g.addColorStop(0,'rgba(70,46,22,'+a+')'); g.addColorStop(.7,'rgba(70,46,22,'+(a*.55)+')'); g.addColorStop(1,'rgba(70,46,22,0)'); x.fillStyle=g; x.beginPath(); x.ellipse(32,cy,rx,ry,0,0,7); x.fill(); };
      foot(36,15,26,.5); foot(76,12,13,.45);
      x.globalCompositeOperation='lighter'; const r=x.createLinearGradient(0,10,0,30); r.addColorStop(0,'rgba(255,240,210,.25)'); r.addColorStop(1,'rgba(255,240,210,0)'); x.fillStyle=r; x.fillRect(14,8,36,20); });
    fpT.wrapS=fpT.wrapT=THREE.ClampToEdgeWrapping;
    lv.printM=new THREE.MeshBasicMaterial({map:fpT,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-8});
    lv.printGeo=new THREE.PlaneGeometry(.3,.46);
    lv.lastStep=new THREE.Vector3(1e9,0,0); lv.stepSide=1;
    lv.glareOn=true; lv.sweatOn=false; lv.gust=.7; lv.gustT=3; lv.sandT=0;
  },
  enter(){ FX.sunWorld=this.sunWorld; FX.rays=.5; FX.raysColor.set(1,.95,.82); FX.raysDecay=.96; this.scene.fog.density=this.fogBase;
    if(this.windH) this.windH.stop(.2); this.windH=SND.play('wind_loop',{loop:true,vol:.32,dest:ambBus,fadeIn:2}); setAmbience([]); },
  exit(){ if(this.windH){ this.windH.stop(1.5); this.windH=null; } FX.heat=0; FX.whiteout=0; blurScreen(0); },
  /* a footprint where a foot just landed (yaw = the way the walker faces, player convention) */
  footprint(pos,yaw,side){
    const lv=this; const y=lv.ground(pos.x,pos.z)+.015;
    const m=new THREE.Mesh(lv.printGeo,lv.printM); m.rotation.order='YXZ'; m.rotation.set(-Math.PI/2,yaw,0);
    m.position.set(pos.x+Math.cos(yaw)*side*.13,y,pos.z-Math.sin(yaw)*side*.13); m.renderOrder=3; lv.scene.add(m); lv.prints.push(m);
    if(lv.prints.length>lv.printMax) lv.scene.remove(lv.prints.shift());
  },
  clearPrints(){ for(const m of this.prints) this.scene.remove(m); this.prints.length=0; },
  update(dt,t){
    const lv=this;
    // your footprints (one per step, also while the walk cutscene moves you)
    if(PLAYER.onGround&&PLAYER.moving&&G.mode==='play'){ if(PLAYER.pos.distanceTo(lv.lastStep)>.7){ lv.lastStep.copy(PLAYER.pos); lv.stepSide=-lv.stepSide; lv.footprint(PLAYER.pos,PLAYER.yaw,lv.stepSide); } }
    const J=lv.jay2; if(J.visible){ J.position.y=lv.ground(J.position.x,J.position.z); const A=J.userData.A; if(A.speed>.3){ lv.j2step=(lv.j2step||0)+A.speed*dt; if(lv.j2step>.7){ lv.j2step=0; lv.j2side=-(lv.j2side||1); lv.footprint(J.position,J.rotation.y+Math.PI,lv.j2side); } } }
    // gusts: the wind swells, sand lifts off the dunes
    lv.gustT-=dt; if(lv.gustT<=0){ lv.gustT=rand(5,11); lv.gustK=rand(.7,1.4); SND.play(Math.random()<.5?'wind_gust_1':'wind_gust_2',{vol:.28*lv.gustK,dest:ambBus,rate:rand(.85,1.1)}); }
    lv.gust=damp(lv.gust,lv.gustT>3?(lv.gustK||1):.6,.8,dt);
    lv.sandT-=dt; const g=lv.gust;
    while(lv.sandT<=0){ lv.sandT+=.016/g; const a=rand(0,Math.PI*2), r=rand(2,22), p=camera.position; const x=p.x+Math.cos(a)*r, z=p.z+Math.sin(a)*r; const y=lv.ground(x,z)+rand(.01,.35);
      lv.soft.spawn(x,y,z,rand(2.5,5.5)*g,rand(-.05,.25),rand(-.6,.6)*g,rand(.8,1.8),rand(.025,.07),.93,.82,.62,.32,-.15,.4,1.2); }
    // heat shimmer (stronger toward the horizon), sun glare when you look up at it
    const fw=camera.getWorldDirection(_dfw);
    FX.heat=.32+(1-Math.abs(fw.y))*.4;
    if(lv.glareOn){ const sd=fw.dot(lv.sunDir); const gl=clamp((sd-.75)/.25,0,1); FX.whiteout=gl*gl*.5; FX.exposure=.9+gl*.45; }
    // sweat: now and then the view goes soft for a second
    if(lv.sweatOn){ lv.sweatT=(lv.sweatT||0)+dt; const sw=Math.max(0,Math.sin(lv.sweatT*.55))**6*Math.max(0,Math.sin(lv.sweatT*.13)); blurScreen(sw*.32); }
  }
});
const _dfw=new THREE.Vector3();
