/* ================================================================
   THE DESERT — blazing noon, dunes to the horizon, one pyramid.
   Real sand (Poly Haven), heat shimmer, sand blowing over the dunes,
   footprints that stay, sun glare when you look up.
   ================================================================ */
const DESERT={size:1400,pyr:V3(0,0,-178),base:150,height:96};
DESERT.door=V3(0,0,DESERT.pyr.z+DESERT.base/2);          // the entrance, ~103 m from where you land
function duneHeight(x,z){
  // long dunes across the wind, ridges + small ripples
  let h=fbm2(x*.0042+3,z*.0021,4)*9+fbm2(x*.013,z*.011,3)*2.2+Math.sin(x*.9+z*.35+fbm2(x*.05,z*.05,2)*4)*.045;
  const P=DESERT.pyr;
  const dp=Math.max(Math.abs(x-P.x),Math.abs(z-P.z));    // square around the pyramid
  h*=smooth(invLerp(DESERT.base*.5+12,DESERT.base*.5+70,dp));
  h*=smooth(invLerp(5,22,Math.hypot(x,z)));               // flat where you land
  // the way you walk: low, gentle dunes so nobody climbs a wall of sand
  if(z<12&&z>DESERT.door.z-10) h*=.25+.75*smooth(invLerp(6,34,Math.abs(x)));
  return h;
}
/* a 4-sided pyramid; every face gets its own flat UVs so the stone blocks don't smear */
function pyramidGeo(base,height,tile){
  const h2=base/2, pos=[], uv=[], nor=[];
  const C=[[-h2,-h2],[h2,-h2],[h2,h2],[-h2,h2]];
  const slant=Math.hypot(height,h2), n=new THREE.Vector3();
  for(let i=0;i<4;i++){
    const a=C[i], b=C[(i+1)%4];
    const mx=(a[0]+b[0])/2, mz=(a[1]+b[1])/2;              // middle of the base edge = the face's outward direction
    n.set(mx,0,mz).normalize().multiplyScalar(height).setY(h2).normalize();
    // wind the triangle so its front side faces outward
    let v0=V3(a[0],0,a[1]), v1=V3(b[0],0,b[1]); const v2=V3(0,height,0);
    const gn=new THREE.Vector3().crossVectors(v1.clone().sub(v0),v2.clone().sub(v0)); if(gn.x*mx+gn.z*mz<0){ const tmp=v0; v0=v1; v1=tmp; }
    pos.push(v0.x,0,v0.z, v1.x,0,v1.z, 0,height,0);
    uv.push(0,0, base/tile,0, base/tile/2,slant/tile);
    for(let k=0;k<3;k++) nor.push(n.x,n.y,n.z);
  }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setAttribute('uv2',new THREE.Float32BufferAttribute(uv,2));
  return g;
}
defineLevel('desert',{
  title:'The Desert',
  env:{fx:{exposure:.96,temp:.1,saturation:1.1,contrast:1.12,bloomStrength:.22,bloomThreshold:1.5,aoRadius:.7,vignette:.3,heat:.4,grain:.025},music:null,reverb:.02,surface:'sand',far:2600,speed:2.9},
  async build(scene,lv){
    const sunDir=V3(.22,.9,.3).normalize(); lv.sunDir=sunDir;
    const sky=makeSky({top:0x1d55c8,mid:0x6fa4e8,horizon:0xe8dcc8,bottom:0xb89a70,sunDir,sunColor:0xfff6e4,sunSize:.99955,sunGlow:1.4,clouds:0,horizonLift:.01});
    scene.add(sky); lv.skyU=sky.userData.u;
    const ex=()=>{}; ex.ground=0xc8a870; lv.envMap=envFromSky(sky,ex);
    lv.rig=makeRig(scene,{sun:2.75,sunColor:0xfff2dc,hemi:.48,sky:0xa8c8ff,ground:0xb89060,dir:sunDir,span:26,dist:120,far:300,bias:-.0005,normalBias:.03});
    lv.sunWorld=sunDir.clone().multiplyScalar(2400);
    scene.fog=new THREE.FogExp2(col(0xe8d8bc),.0011); lv.fogBase=.0011;
    await nextFrame();
    // ---- the dunes ----
    const S=dq(120,160,220,260,320), SZ=DESERT.size;
    const tg=new THREE.PlaneGeometry(SZ,SZ,S,S); tg.rotateX(-Math.PI/2); const tp=tg.attributes.position, cc=new Float32Array(tp.count*3);
    for(let i=0;i<tp.count;i++){ const x=tp.getX(i), z=tp.getZ(i); tp.setY(i,duneHeight(x,z));
      // colour variation kills the tiling: light crests, darker hollows, streaks along the wind
      const k=.86+fbm2(x*.03+9,z*.03,3)*.22+fbm2(x*.004,z*.08,2)*.1; cc[i*3]=k; cc[i*3+1]=k*.985; cc[i*3+2]=k*.95; }
    tg.setAttribute('color',new THREE.BufferAttribute(cc,3)); tg.computeVertexNormals(); withAO(tg);
    const sandM=pbrMat('dense_sand',3.2,{w:SZ,h:SZ,opts:{vertexColors:true,roughness:1},normal:.9});
    const ground=mesh(tg,sandM,0,0,0,false); ground.receiveShadow=true; scene.add(ground);
    lv.hf=heightField(SZ,S,duneHeight); lv.ground=(x,z)=>lv.hf.at(x,z);
    lv.surfaceAt=()=>'sand';
    // packed, trampled sand round the pyramid
    const P=DESERT.pyr, BASE=DESERT.base, HGT=DESERT.height;
    const padR=BASE*.5+40; const padG=withAO(new THREE.PlaneGeometry(padR*2,padR*2)); const pad=mesh(padG,pbrMat('sandy_gravel_02',3,{w:padR*2,h:padR*2,opts:{roughness:1,transparent:true,opacity:.85}}),P.x,.05,P.z,false); pad.rotation.x=-Math.PI/2; pad.receiveShadow=true; scene.add(pad);
    // ---- the pyramid ----
    const pyrM=pbrMat('large_sandstone_blocks_01',5,{opts:{roughness:1},normal:1.2}); pyrM.color=col(0xe6cfa6);
    const pyr=mesh(pyramidGeo(BASE,HGT,5),pyrM,P.x,-.4,P.z); pyr.castShadow=true; pyr.receiveShadow=true; scene.add(pyr); lv.pyramid=pyr;
    // the cap stone, worn and darker
    // the entrance: a stone porch sticking out of the face toward you, with a black doorway
    const D=DESERT.door, porch=new THREE.Group(); porch.position.set(D.x,0,D.z); scene.add(porch); lv.porch=porch;
    const stoneM=pbrMat('old_sandstone_02',2.2,{opts:{roughness:1},normal:1.1}); stoneM.color=col(0xe8d2ac);
    const sideM=pbrMat('sandstone_blocks_05',2.4,{opts:{roughness:1}}); sideM.color=col(0xe2caa0);
    const blk=(w,h,d,m,x,y,z)=>{ const b=mesh(withAO(new THREE.BoxGeometry(w,h,d)),m,x,y,z); b.castShadow=b.receiveShadow=true; porch.add(b); return b; };
    blk(2.6,7.2,9,sideM,-3.5,3.6,-1.5); blk(2.6,7.2,9,sideM,3.5,3.6,-1.5);        // the two side walls
    blk(9.6,2.2,9,stoneM,0,8.3,-1.5);                                             // the lintel block on top
    blk(10.6,.5,10,stoneM,0,9.6,-1.5);                                            // a cap
    const dark=new THREE.MeshBasicMaterial({color:0x000000}); const hole=mesh(new THREE.BoxGeometry(4.45,7.2,9.6),dark,0,3.6,-2.2,false); porch.add(hole);
    // a few fallen blocks and half-buried stones around the porch
    for(const [x,z,s,r] of [[-7.5,4,1.1,.4],[6.8,6.5,.8,1.2],[9,1,1.4,.2],[-10,9,.7,.9],[4,11,.5,2.1]]){ const b=mesh(withAO(new THREE.BoxGeometry(1.6*s,1*s,1.2*s)),stoneM,D.x+x,.25*s,D.z+z); b.rotation.set(rand(-.2,.2),r,rand(-.15,.15)); b.castShadow=b.receiveShadow=true; scene.add(b); colCircle(lv.col,D.x+x,D.z+z,.9*s); }
    // walls you can't walk through: the pyramid (except the door) and the porch walls
    colBox(lv.col,P.x-BASE/2,P.x+BASE/2,P.z-BASE/2,D.z-6);
    colBox(lv.col,D.x-4.8,D.x-2.2,D.z-6,D.z+3); colBox(lv.col,D.x+2.2,D.x+4.8,D.z-6,D.z+3);
    lv.col.radius=600; lv.col.cx=0; lv.col.cz=-60;
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
    if(lv.glareOn){ const sd=fw.dot(lv.sunDir); const gl=clamp((sd-.75)/.25,0,1); FX.whiteout=gl*gl*.5; FX.exposure=.96+gl*.45; }
    // sweat: now and then the view goes soft for a second
    if(lv.sweatOn){ lv.sweatT=(lv.sweatT||0)+dt; const sw=Math.max(0,Math.sin(lv.sweatT*.55))**6*Math.max(0,Math.sin(lv.sweatT*.13)); blurScreen(sw*.32); }
  }
});
const _dfw=new THREE.Vector3();
