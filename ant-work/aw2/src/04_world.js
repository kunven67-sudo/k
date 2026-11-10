/* ================================================================
   WORLD TOOLKIT — sky, stars, light rigs, particles, collision,
   interactables, triggers and the level manager
   ================================================================ */
/* ---------- sky dome (gradient + sun + procedural clouds) ---------- */
const SKY_VS=`varying vec3 vDir; void main(){ vDir=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position=p.xyww; }`;
function makeSky(o={}){
  const u={
    top:{value:col(o.top||0x2a5fb0)}, mid:{value:col(o.mid||0x8fb8e8)}, hor:{value:col(o.horizon||0xffd6a0)}, bot:{value:col(o.bottom||0x6a5a50)},
    sunDir:{value:(o.sunDir||V3(.3,.2,-1)).clone().normalize()}, sunCol:{value:col(o.sunColor||0xfff2d0)}, sunSize:{value:o.sunSize||.9994}, sunGlow:{value:o.sunGlow||1},
    cloud:{value:o.clouds||0}, cloudCol:{value:col(o.cloudColor||0xffffff)}, cloudShade:{value:col(o.cloudShade||0x8a7a90)}, time:{value:0}, k:{value:o.intensity||1},
    stars:{value:o.stars||0}, horizonLift:{value:o.horizonLift||0}
  };
  const m=new THREE.ShaderMaterial({uniforms:u,vertexShader:SKY_VS,side:THREE.BackSide,depthWrite:false,fog:false,
    fragmentShader:`
    uniform vec3 top,mid,hor,bot,sunDir,sunCol,cloudCol,cloudShade; uniform float sunSize,sunGlow,cloud,time,k,stars,horizonLift; varying vec3 vDir;
    float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
    float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
    void main(){
      vec3 d=normalize(vDir); float y=d.y+horizonLift;
      vec3 c= y>0.0 ? mix(mix(hor,mid,smoothstep(0.0,0.18,y)),top,smoothstep(0.12,0.85,y)) : mix(hor,bot,smoothstep(0.0,0.2,-y));
      float sd=max(dot(d,normalize(sunDir)),0.0);
      c+=sunCol*(pow(sd,8.0)*0.35+pow(sd,64.0)*0.8)*sunGlow;
      c+=sunCol*smoothstep(sunSize,sunSize+0.0004,sd)*20.0;
      if(cloud>0.0 && d.y>0.0){
        vec2 cp=d.xz/(d.y+0.12)*1.6+vec2(time*0.004,time*0.0015);
        float cl=smoothstep(0.52-cloud*0.25,0.85,fbm(cp)) * smoothstep(0.0,0.12,d.y);
        float lit=pow(sd,3.0);
        vec3 cc=mix(cloudShade,cloudCol,0.55+0.45*fbm(cp*2.0+3.0))+sunCol*lit*0.6;
        c=mix(c,cc,cl*0.9);
      }
      if(stars>0.0){ vec3 q=d*300.0; vec3 i=floor(q); float s=h(i.xy+i.z*7.1); float tw=0.6+0.4*sin(time*2.0+s*50.0); c+=vec3(step(0.9985,s))*stars*tw*2.0*smoothstep(-0.05,0.2,d.y); }
      gl_FragColor=vec4(c*k,1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }`});
  const sky=new THREE.Mesh(new THREE.SphereGeometry(900,48,24),m); sky.renderOrder=-10; sky.frustumCulled=false;
  sky.userData.u=u;
  return sky;
}
/* big starfield sphere (points) + optional milky-way band */
function makeStars(n=4000,r=800,o={}){
  const g=new THREE.BufferGeometry(), p=new Float32Array(n*3), c=new Float32Array(n*3), s=new Float32Array(n);
  const rr=RNG(o.seed||7);
  for(let i=0;i<n;i++){
    let x,y,z; if(o.band && rr()<.55){ const a=rr()*Math.PI*2, b=(rr()-.5)*.35*(rr()); x=Math.cos(a); y=b; z=Math.sin(a); const t=o.bandTilt||.6; const yy=y*Math.cos(t)-z*Math.sin(t)*.3; y=yy; }
    else { const u=rr()*2-1, a=rr()*Math.PI*2, q=Math.sqrt(1-u*u); x=q*Math.cos(a); y=u; z=q*Math.sin(a); }
    const L=Math.hypot(x,y,z); p[i*3]=x/L*r; p[i*3+1]=y/L*r; p[i*3+2]=z/L*r;
    const temp=rr(); const cc=temp<.2?[1,.75,.6]:temp<.5?[1,.95,.85]:temp<.85?[.9,.95,1]:[.7,.8,1];
    const b=Math.pow(rr(),3)*2.5+.3; c[i*3]=cc[0]*b; c[i*3+1]=cc[1]*b; c[i*3+2]=cc[2]*b; s[i]=rr()*1.8+.6;
  }
  g.setAttribute('position',new THREE.BufferAttribute(p,3)); g.setAttribute('color',new THREE.BufferAttribute(c,3)); g.setAttribute('size',new THREE.BufferAttribute(s,1));
  const m=new THREE.ShaderMaterial({uniforms:{time:{value:0},px:{value:1},k:{value:o.k||1}},depthWrite:false,transparent:true,blending:THREE.AdditiveBlending,fog:false,
    vertexShader:`attribute float size; attribute vec3 color; varying vec3 vC; uniform float time,px; void main(){ vC=color*(0.75+0.25*sin(time*1.5+position.x*0.13+position.y*0.07)); vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*px; gl_Position=projectionMatrix*mv; gl_Position.z=gl_Position.w*0.9999; }`,
    fragmentShader:`varying vec3 vC; uniform float k; void main(){ vec2 d=gl_PointCoord-0.5; float a=smoothstep(0.5,0.0,length(d)); gl_FragColor=vec4(vC*a*k,a);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }`});
  const pts=new THREE.Points(g,m); pts.frustumCulled=false; pts.renderOrder=-9; pts.userData.isStars=true; return pts;
}

/* ---------- light rig with camera-following, texel-snapped shadows ---------- */
function makeRig(scene,o={}){
  const hemi=new THREE.HemisphereLight(col(o.sky||0xbfd8ff),col(o.ground||0x5a4a3a),o.hemi!=null?o.hemi:.5); scene.add(hemi);
  const sun=new THREE.DirectionalLight(col(o.sunColor||0xfff0d8),o.sun!=null?o.sun:2.2);
  sun.castShadow=o.shadow!==false; sun.shadow.bias=o.bias!=null?o.bias:-.0004; sun.shadow.normalBias=o.normalBias!=null?o.normalBias:.025;
  const span=o.span||14; const sc=sun.shadow.camera; sc.left=-span; sc.right=span; sc.top=span; sc.bottom=-span; sc.near=.5; sc.far=o.far||120;
  scene.add(sun); scene.add(sun.target);
  const rig={hemi,sun,dir:(o.dir||V3(.5,1,.3)).clone().normalize(),span,dist:o.dist||50};
  scene.userData.rig=rig; return rig;
}
function applyShadowRes(){
  if(!LV||!LV.scene.userData.rig) return;
  const sun=LV.scene.userData.rig.sun, n=SHADOW_SIZES[clamp(SETTINGS.shadow,0,4)]||1024;
  if(sun.shadow.mapSize.x!==n){ sun.shadow.mapSize.set(n,n); if(sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map=null; } }
  sun.castShadow=SETTINGS.shadow>0 && !LV.scene.userData.noShadow;
}
const _snap=new THREE.Vector3();
function updateRig(rig,focus){
  if(!rig) return;
  const texel=rig.span*2/Math.max(256,rig.sun.shadow.mapSize.x);
  _snap.copy(focus); _snap.x=Math.round(_snap.x/texel)*texel; _snap.z=Math.round(_snap.z/texel)*texel; _snap.y=Math.round(_snap.y/texel)*texel;
  rig.sun.target.position.copy(_snap);
  rig.sun.position.copy(_snap).addScaledVector(rig.dir,rig.dist);
  rig.sun.target.updateMatrixWorld();
}
function setRigSpan(rig,s){ rig.span=s; const c=rig.sun.shadow.camera; c.left=-s; c.right=s; c.top=s; c.bottom=-s; c.updateProjectionMatrix(); }

/* ---------- particles: one Points draw call per blend mode ---------- */
class Particles{
  constructor(scene,max=3000,additive=false){
    this.max=max; this.n=0; this.add=additive;
    const g=new THREE.BufferGeometry();
    this.pos=new Float32Array(max*3); this.col=new Float32Array(max*4); this.size=new Float32Array(max);
    this.vel=new Float32Array(max*3); this.life=new Float32Array(max); this.maxLife=new Float32Array(max); this.grav=new Float32Array(max); this.drag=new Float32Array(max); this.grow=new Float32Array(max); this.s0=new Float32Array(max); this.a0=new Float32Array(max); this.spin=new Float32Array(max);
    g.setAttribute('position',new THREE.BufferAttribute(this.pos,3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('rgba',new THREE.BufferAttribute(this.col,4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size',new THREE.BufferAttribute(this.size,1).setUsage(THREE.DynamicDrawUsage));
    this.mat=new THREE.ShaderMaterial({uniforms:{px:{value:innerHeight*renderer.getPixelRatio()*.5}},transparent:true,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,
      vertexShader:`attribute vec4 rgba; attribute float size; varying vec4 vC; uniform float px; void main(){ vC=rgba; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*px/max(0.05,-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader:`varying vec4 vC; void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d); float a=smoothstep(0.5,0.1,r); gl_FragColor=vec4(vC.rgb,vC.a*a);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`});
    this.pts=new THREE.Points(g,this.mat); this.pts.frustumCulled=false; this.pts.renderOrder=5; scene.add(this.pts);
    g.setDrawRange(0,0);
  }
  spawn(x,y,z,vx,vy,vz,life,size,r,gg,b,a,grav=0,drag=0,grow=0){
    if(this.n>=this.max){ // overwrite the oldest-ish slot
      let k=0,min=1e9; for(let i=0;i<this.n;i+=7){ if(this.life[i]<min){ min=this.life[i]; k=i; } } this._set(k,x,y,z,vx,vy,vz,life,size,r,gg,b,a,grav,drag,grow); return; }
    this._set(this.n++,x,y,z,vx,vy,vz,life,size,r,gg,b,a,grav,drag,grow);
  }
  _set(i,x,y,z,vx,vy,vz,life,size,r,g,b,a,grav,drag,grow){ const P=this.pos,C=this.col,Vv=this.vel; P[i*3]=x;P[i*3+1]=y;P[i*3+2]=z; Vv[i*3]=vx;Vv[i*3+1]=vy;Vv[i*3+2]=vz; this.life[i]=this.maxLife[i]=life; this.size[i]=this.s0[i]=size; C[i*4]=r;C[i*4+1]=g;C[i*4+2]=b;C[i*4+3]=this.a0[i]=a; this.grav[i]=grav; this.drag[i]=drag; this.grow[i]=grow; }
  burst(pos,o={}){
    const c=col(o.color||0xffffff), n=Math.round((o.count||12)*[.3,.6,1,1,1.4][clamp(SETTINGS.detail,0,4)]), sp=o.speed||1;
    for(let i=0;i<n;i++){
      let dx=Math.random()*2-1, dy=Math.random()*2-1, dz=Math.random()*2-1; const L=Math.hypot(dx,dy,dz)||1; dx/=L; dy/=L; dz/=L;
      if(o.up) dy=Math.abs(dy)*o.up+(1-o.up)*dy;
      const s=sp*(.35+Math.random()*.9), k=(o.bright||1)*(.7+Math.random()*.6);
      this.spawn(pos.x+(o.spread||0)*(Math.random()-.5),pos.y+(o.spread||0)*(Math.random()-.5),pos.z+(o.spread||0)*(Math.random()-.5),dx*s,dy*s+(o.lift||0),dz*s,(o.life||.8)*(.6+Math.random()*.7),(o.size||.05)*(.6+Math.random()*.8),c.r*k,c.g*k,c.b*k,o.alpha||1,o.grav!=null?o.grav:-4,o.drag||0,o.grow||0);
    }
  }
  update(dt){
    let n=this.n; const P=this.pos,C=this.col,Vv=this.vel;
    for(let i=0;i<n;i++){
      this.life[i]-=dt;
      if(this.life[i]<=0){ n--; if(i!==n){ this._copy(n,i); } i--; continue; }
      const dr=Math.max(0,1-this.drag[i]*dt);
      Vv[i*3]*=dr; Vv[i*3+1]=Vv[i*3+1]*dr+this.grav[i]*dt; Vv[i*3+2]*=dr;
      P[i*3]+=Vv[i*3]*dt; P[i*3+1]+=Vv[i*3+1]*dt; P[i*3+2]+=Vv[i*3+2]*dt;
      const k=this.life[i]/this.maxLife[i];
      this.size[i]=this.s0[i]*(1+this.grow[i]*(1-k));
      C[i*4+3]=this.a0[i]*Math.min(1,k*2.5)*Math.min(1,(1-k)*12+.2);
    }
    this.n=n; const g=this.pts.geometry;
    g.setDrawRange(0,n); g.attributes.position.needsUpdate=true; g.attributes.rgba.needsUpdate=true; g.attributes.size.needsUpdate=true;
    this.mat.uniforms.px.value=renderer.domElement.height*.5/Math.tan(camera.fov*Math.PI/360);
  }
  _copy(a,b){ const P=this.pos,C=this.col,Vv=this.vel; for(let k=0;k<3;k++){ P[b*3+k]=P[a*3+k]; Vv[b*3+k]=Vv[a*3+k]; } for(let k=0;k<4;k++) C[b*4+k]=C[a*4+k]; for(const arr of [this.life,this.maxLife,this.size,this.grav,this.drag,this.grow,this.s0,this.a0]) arr[b]=arr[a]; }
  clear(){ this.n=0; this.pts.geometry.setDrawRange(0,0); }
}
/* each level gets two systems: soft (normal blend: dust, smoke) and glow (additive: sparks, fire) */
function fxBurst(pos,o){ if(!LV) return; (o.add?LV.glow:LV.soft).burst(pos,o); }

/* ---------- collision (2D footprint + height fn) ---------- */
function makeCol(){ return {boxes:[],circles:[],obbs:[],bounds:null,radius:null,ground:null}; }
let BUILDING_LV=null;
function colBox(c,x0,x1,z0,z1,cond){ const b={x0:Math.min(x0,x1),x1:Math.max(x0,x1),z0:Math.min(z0,z1),z1:Math.max(z0,z1),cond}; c.boxes.push(b); return b; }
function colBoxC(c,cx,cz,w,d,cond){ return colBox(c,cx-w/2,cx+w/2,cz-d/2,cz+d/2,cond); }
function colCircle(c,x,z,r,cond){ const o={x,z,r,cond}; c.circles.push(o); return o; }
/* a real rotated box footprint: w along the object's local x, d along local z, rotated by ang (= rotation.y) */
function colOBox(c,cx,cz,w,d,ang,cond){ const o={cx,cz,hx:w/2,hz:d/2,c:Math.cos(ang),s:Math.sin(ang),cond}; (c.obbs||(c.obbs=[])).push(o); return o; }
/* footprint of an object (its own rotation.y is respected), as a rotated box or a circle */
function colFromObj(c,obj,o={}){
  const ry=obj.rotation.y; obj.rotation.y=0; obj.updateMatrixWorld(true); const b=new THREE.Box3().setFromObject(obj); obj.rotation.y=ry; obj.updateMatrixWorld(true);
  if(b.isEmpty()) return null; const pad=o.pad||0, k=o.k||1;
  const cxl=(b.min.x+b.max.x)/2-obj.position.x, czl=(b.min.z+b.max.z)/2-obj.position.z; const w=(b.max.x-b.min.x)*k+pad*2, d=(b.max.z-b.min.z)*k+pad*2;
  const wx=obj.position.x+Math.cos(ry)*cxl+Math.sin(ry)*czl, wz=obj.position.z-Math.sin(ry)*cxl+Math.cos(ry)*czl;
  if(o.circle) return colCircle(c,wx,wz,Math.max(w,d)/2,o.cond);
  return colOBox(c,wx,wz,w,d,ry,o.cond);
}
/* rotated box footprint -> approximated by a few circles along its long axis */
function colOBB(c,cx,cz,w,d,ang,cond){ const L=Math.max(w,d), S=Math.min(w,d), n=Math.max(1,Math.ceil(L/S)); const ax=w>=d?[Math.cos(ang),-Math.sin(ang)]:[Math.sin(ang),Math.cos(ang)]; for(let i=0;i<n;i++){ const t=(i+.5)/n-.5; colCircle(c,cx+ax[0]*t*L,cz+ax[1]*t*L,S/2*1.05,cond); } }
function resolveCol(c,pos,r){
  if(!c) return;
  if(c.bounds){ const b=c.bounds; pos.x=clamp(pos.x,b[0]+r,b[1]-r); pos.z=clamp(pos.z,b[2]+r,b[3]-r); }
  if(c.radius){ const d=Math.hypot(pos.x-(c.cx||0),pos.z-(c.cz||0)); if(d>c.radius-r){ const k=(c.radius-r)/d; pos.x=(c.cx||0)+(pos.x-(c.cx||0))*k; pos.z=(c.cz||0)+(pos.z-(c.cz||0))*k; } }
  for(let it=0;it<2;it++){
    for(const b of c.boxes){
      if(b.cond && !b.cond()) continue;
      const cx=clamp(pos.x,b.x0,b.x1), cz=clamp(pos.z,b.z0,b.z1); const dx=pos.x-cx, dz=pos.z-cz, d2=dx*dx+dz*dz;
      if(d2>=r*r) continue;
      if(d2>1e-10){ const d=Math.sqrt(d2); pos.x=cx+dx/d*r; pos.z=cz+dz/d*r; }
      else { const l=pos.x-b.x0, rr=b.x1-pos.x, t=pos.z-b.z0, bb=b.z1-pos.z, m=Math.min(l,rr,t,bb); if(m===l) pos.x=b.x0-r; else if(m===rr) pos.x=b.x1+r; else if(m===t) pos.z=b.z0-r; else pos.z=b.z1+r; }
    }
    if(c.obbs) for(const o of c.obbs){ if(o.cond && !o.cond()) continue;
      const dx=pos.x-o.cx, dz=pos.z-o.cz; let lx=dx*o.c-dz*o.s, lz=dx*o.s+dz*o.c;
      const qx=clamp(lx,-o.hx,o.hx), qz=clamp(lz,-o.hz,o.hz); const ex=lx-qx, ez=lz-qz, e2=ex*ex+ez*ez; if(e2>=r*r) continue;
      if(e2>1e-10){ const e=Math.sqrt(e2); lx=qx+ex/e*r; lz=qz+ez/e*r; }
      else { const px=o.hx-Math.abs(lx), pz=o.hz-Math.abs(lz); if(px<pz) lx=(lx<0?-1:1)*(o.hx+r); else lz=(lz<0?-1:1)*(o.hz+r); }
      pos.x=o.cx+o.c*lx+o.s*lz; pos.z=o.cz-o.s*lx+o.c*lz; }
    for(const o of c.circles){ if(o.cond && !o.cond()) continue; const dx=pos.x-o.x, dz=pos.z-o.z, d=Math.hypot(dx,dz), m=r+o.r; if(d<m){ if(d<1e-6){ pos.x=o.x+m; continue; } pos.x=o.x+dx/d*m; pos.z=o.z+dz/d*m; } }
  }
}

/* ---------- interactables + triggers ---------- */
/* {obj|pos, label, reach, when(), act(), key:'E', aim:true} — nearest in front of the camera wins */
/* sample a PlaneGeometry(size,size,S,S) heightfield exactly the way the GPU draws it (same two triangles per cell),
   so things standing on the ground sit ON the drawn surface instead of floating or sinking */
function heightField(size,S,fn){
  const N=S+1, h=new Float32Array(N*N), seg=size/S, half=size/2;
  for(let j=0;j<N;j++) for(let i=0;i<N;i++) h[j*N+i]=fn(i*seg-half,j*seg-half);
  const at=(x,z)=>{ const gx=clamp((x+half)/seg,0,S-1e-4), gz=clamp((z+half)/seg,0,S-1e-4); const i=Math.floor(gx), j=Math.floor(gz), fx=gx-i, fz=gz-j;
    const ha=h[j*N+i], hb=h[(j+1)*N+i], hc=h[(j+1)*N+i+1], hd=h[j*N+i+1];
    return fx+fz<=1 ? ha+(hd-ha)*fx+(hb-ha)*fz : hc+(hb-hc)*(1-fx)+(hd-hc)*(1-fz); };
  return {h,at,N,seg};
}
function addInteract(lv,o){ const it=Object.assign({reach:2,key:'E',aim:true,height:1},o); lv.inter.push(it); return it; }
function addTrigger(lv,o){ const t=Object.assign({r:1.5,once:true,done:false,inside:false},o); lv.triggers.push(t); return t; }
const _ip=new THREE.Vector3(), _cf=new THREE.Vector3(), _to=new THREE.Vector3();
function findInteract(){
  if(!LV||!PLAYER.canInteract()) return null;
  camera.getWorldDirection(_cf);
  let best=null, bestS=-1e9;
  for(const it of LV.inter){
    if(it.when && !it.when()) continue;
    if(it.obj){ if(!it.obj.visible && !it.hiddenOk) continue; it.obj.getWorldPosition(_ip); if(it.offset) _ip.add(it.offset); } else _ip.copy(it.pos);
    const dx=_ip.x-PLAYER.pos.x, dz=_ip.z-PLAYER.pos.z;
    if(it.d3){ // full 3D distance + aim (for the zero-g tinyverse)
      _to.copy(_ip).sub(camera.position); const d3=_to.length(); if(d3>it.reach) continue; _to.normalize(); const dot=_to.dot(_cf); if(it.aim && dot<.55) continue; const s3=-d3/it.reach+dot*1.5; if(s3>bestS){ bestS=s3; best=it; } continue; }
    const d=Math.hypot(dx,dz)*(PLAYER.scale<1?1/PLAYER.scale:1);
    const reach=it.reach*(IS_TOUCH?1.25:1);
    if(d>reach) continue;
    let s=-d;
    if(it.aim){ _to.set(dx,0,dz).normalize(); const f=Math.hypot(_cf.x,_cf.z)||1; const dot=(_to.x*_cf.x+_to.z*_cf.z)/f; if(d>.8 && dot<.35) continue; s+=dot*2; }
    if(s>bestS){ bestS=s; best=it; }
  }
  return best;
}
function updateTriggers(){
  if(!LV) return;
  for(const t of LV.triggers){
    if(t.done || (t.when && !t.when())) { t.inside=false; continue; }
    const d=Math.hypot(PLAYER.pos.x-t.pos.x,PLAYER.pos.z-t.pos.z);
    const inside=t.box? (Math.abs(PLAYER.pos.x-t.pos.x)<t.box[0]&&Math.abs(PLAYER.pos.z-t.pos.z)<t.box[1]) : d<t.r;
    if(inside && !t.inside){ t.inside=true; if(t.once) t.done=true; try{ t.fn(); }catch(e){ console.error(e); } }
    else if(!inside) t.inside=false;
  }
}

/* ---------- level manager ---------- */
const LEVELS={};
let LV=null;
function defineLevel(name,def){ LEVELS[name]=def; def.name=name; }
async function buildLevel(name){
  const def=LEVELS[name]; if(def.built) return def;
  const scene=new THREE.Scene(); def.scene=scene; def.col=makeCol(); def.inter=[]; def.triggers=[]; def.updaters=[];
  def.soft=new Particles(scene,dq(600,1200,2500,3500,5000),false); def.glow=new Particles(scene,dq(400,800,1500,2500,3500),true);
  BUILDING_LV=def; try{ await def.build(scene,def); } finally{ BUILDING_LV=null; }
  scene.traverse(o=>{ if(o.isMesh && o.material && o.material.map && o.material.map.anisotropy<MAX_ANISO){ o.material.map.anisotropy=MAX_ANISO; } });
  LEVEL_SCENES.push(scene);
  def.built=true;
  // pre-compile shaders so the first frame in the level doesn't hitch
  try{ renderer.compile(scene,camera); }catch(e){}
  return def;
}
async function enterLevel(name,spawn={},opts={}){
  const def=LEVELS[name]; if(!def) throw new Error('no level '+name); const tok=STORY.token;
  if(!def.built){ $('loading').classList.add('show'); $('loadTxt').textContent='Loading…';   /* no place names: they spoiled what was coming ('a bad dream', "Steve's ship"...) */ await nextFrame(); await nextFrame();
    try{ await buildLevel(name); }
    catch(e){ console.error(e); showFatal('The area "'+(def.title||name)+'" could not be built on this computer.',e); throw e; }
    finally{ $('loading').classList.remove('show'); } }
  // the story was restarted while this level was loading: the OLD story must not jump into it (it used to pop up over the new scene)
  if(tok!==STORY.token && !opts.anyStory) return new Promise(()=>{});
  if(LV && LV!==def && LV.exit) try{ LV.exit(); }catch(e){ console.error(e); }
  LV=def;
  const E=def.env||{};
  camera.near=E.near||.05; camera.far=E.far||1500; camera.updateProjectionMatrix();
  resetFX(E.fx);
  if(E.fog) def.scene.fog=new THREE.FogExp2(col(E.fog[0]),E.fog[1]);
  if(def.envMap) def.scene.environment=def.envMap;
  if(E.bg!=null) def.scene.background=col(E.bg);
  setReverb(E.reverb!=null?E.reverb:.2);
  applyShadowRes();
  if(E.music!==undefined && !opts.keepMusic) (E.music?playMusic(E.music):stopMusic());
  if(E.amb) setAmbience(E.amb); if(E.ambEvents) setAmbEvents(E.ambEvents); else setAmbEvents([]);
  PLAYER.enterLevel(def,spawn);
  def.soft.clear(); def.glow.clear();
  for(const t of def.triggers) t.inside=false;
  if(def.enter) def.enter(spawn,opts);
  invalidateMotion();
  return def;
}
function onLevelUpdate(fn){ LV_UPDATERS_PENDING.push(fn); }
const LV_UPDATERS_PENDING=[];


/* a big, clear error card (instead of "Loading..." forever) */
function showFatal(msg,e){
  let c=document.getElementById('fatalCard'); if(!c){ c=document.createElement('div'); c.id='fatalCard';
    c.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(10,6,4,.94);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;font:600 16px/1.5 system-ui,sans-serif';
    document.body.appendChild(c); }
  c.innerHTML='<div style="font-size:26px;font-weight:900">Something broke</div><div></div><pre style="max-width:90vw;max-height:30vh;overflow:auto;font-size:12px;opacity:.7;white-space:pre-wrap"></pre><button style="font:800 16px system-ui;padding:12px 26px;border-radius:12px;border:0;cursor:pointer">Reload the game</button>';
  c.children[1].textContent=msg; c.children[2].textContent=(e&&e.stack)||String(e||''); c.children[3].onclick=()=>location.reload();
  try{ document.exitPointerLock(); }catch(_){}
}
