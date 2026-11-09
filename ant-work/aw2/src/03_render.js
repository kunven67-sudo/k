/* ================================================================
   RENDERER + POST PIPELINE
   scene -> HDR target (+depth) -> SSAO / bloom mip-chain / god rays /
   depth of field -> composite (motion blur, AO, ACES, grade, lens,
   flashback) -> FXAA -> screen.  Every stage can be switched off.
   ================================================================ */
let renderer;
try{
  renderer=new THREE.WebGLRenderer({canvas:canvasEl,antialias:false,powerPreference:'high-performance',stencil:false,alpha:false});
}catch(e){
  document.body.insertAdjacentHTML('beforeend','<div style="position:fixed;inset:0;z-index:99998;background:#1a0808;color:#ffdede;display:flex;align-items:center;justify-content:center;text-align:center;font:16px/1.6 sans-serif;padding:30px;">Your browser could not start WebGL, which this game needs.<br>Try Chrome or Edge, update your graphics drivers, or turn on hardware acceleration.</div>');
  throw e;
}
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate=true;
const camera=new THREE.PerspectiveCamera(SETTINGS.fov,innerWidth/innerHeight,.05,1500);
camera.rotation.order='YXZ';
const MAX_ANISO=Math.min(8,renderer.capabilities.getMaxAnisotropy());

/* per-frame effect parameters, driven by levels and cutscenes */
const FX={
  exposure:1, saturation:1.06, contrast:1.06, temp:0, tint:new THREE.Vector3(1,1,1), lift:new THREE.Vector3(0,0,0),
  vignette:.32, aberr:.0015, grain:.035, sharpen:0,
  bloomStrength:.14, bloomThreshold:1.6, bloomRadius:.8,
  aoStrength:.85, aoRadius:.55,
  rays:0, raysColor:new THREE.Vector3(1,.85,.6), sunWorld:null, raysDecay:.965, raysDensity:.9,
  dof:0, dofFocus:4, dofRange:2.5, dofMax:10,
  flashback:0, flashT:0, glitch:0, blackout:0, whiteout:0, desat:0, blurAll:0, heat:0, pixel:0,
  mblurStrength:1
};
const FX_BASE={}; for(const k in FX){ const v=FX[k]; FX_BASE[k]=(v&&v.clone)?v.clone():v; }
function resetFX(o){ for(const k in FX_BASE){ const v=FX_BASE[k]; if(v&&v.clone) FX[k].copy(v); else FX[k]=v; } if(o) Object.assign(FX,o); }

/* ---------- post pipeline ---------- */
const PP={ok:false,enabled:false,tried:false,w:2,h:2};
const quadCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const quadScene=new THREE.Scene();
const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),null); quad.frustumCulled=false; quadScene.add(quad);
const VS=`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
function pmat(frag,uniforms,defines){ return new THREE.ShaderMaterial({vertexShader:VS,fragmentShader:frag,uniforms,defines:defines||{},depthTest:false,depthWrite:false,extensions:{derivatives:true}}); }
function runPass(mat,target){ quad.material=mat; renderer.setRenderTarget(target); renderer.render(quadScene,quadCam); }
function mkRT(w,h,o){ return new THREE.WebGLRenderTarget(Math.max(1,w|0),Math.max(1,h|0),Object.assign({minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,type:THREE.HalfFloatType,depthBuffer:false,stencilBuffer:false},o||{})); }

const DEPTH_FN=`
uniform float cNear; uniform float cFar;
float linZ(float d){ float z=d*2.0-1.0; return (2.0*cNear*cFar)/(cFar+cNear-z*(cFar-cNear)); }`;
const SH={};
SH.ao=pmat(`
uniform sampler2D tDepth; uniform vec2 res; uniform mat4 projInv; uniform mat4 proj; uniform float radius; uniform float intensity; uniform float samples; varying vec2 vUv;
vec3 P(vec2 uv){ float d=texture2D(tDepth,uv).x; vec4 c=vec4(uv*2.0-1.0,d*2.0-1.0,1.0); vec4 v=projInv*c; return v.xyz/v.w; }
float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void main(){
  float d=texture2D(tDepth,vUv).x; if(d>=0.99999){ gl_FragColor=vec4(1.0); return; }
  vec3 p=P(vUv); vec2 px=1.0/res;
  vec3 r=P(vUv+vec2(px.x,0.)), l=P(vUv-vec2(px.x,0.)), u=P(vUv+vec2(0.,px.y)), b=P(vUv-vec2(0.,px.y));
  vec3 dx=abs(r.z-p.z)<abs(l.z-p.z)?r-p:p-l; vec3 dy=abs(u.z-p.z)<abs(b.z-p.z)?u-p:p-b;
  vec3 n=normalize(cross(dx,dy));
  vec2 ssR=vec2(proj[0][0],proj[1][1])*radius/(-p.z)*0.5;
  float rot=hash(vUv*res)*6.2831853, occ=0.0;
  for(int i=0;i<24;i++){
    if(float(i)>=samples) break;
    float t=(float(i)+0.5)/samples; float a=t*37.699+rot;
    vec2 off=vec2(cos(a),sin(a))*ssR*t;
    vec3 q=P(vUv+off); vec3 v=q-p; float vv=dot(v,v);
    float f=max(0.0,1.0-vv/(radius*radius));
    occ+=f*max(0.0,dot(v,n)/sqrt(vv+1e-4)-0.08);
  }
  float ao=clamp(1.0-occ/samples*intensity*2.2,0.0,1.0);
  gl_FragColor=vec4(ao,ao,ao,1.0);
}`,{tDepth:{value:null},res:{value:new THREE.Vector2()},projInv:{value:new THREE.Matrix4()},proj:{value:new THREE.Matrix4()},radius:{value:.5},intensity:{value:1},samples:{value:12}});
SH.aoBlur=pmat(DEPTH_FN+`
uniform sampler2D tAO; uniform sampler2D tDepth; uniform vec2 dir; varying vec2 vUv;
void main(){
  float z0=linZ(texture2D(tDepth,vUv).x); float s=0.0, w=0.0;
  for(int i=-4;i<=4;i++){ vec2 uv=vUv+dir*float(i); float z=linZ(texture2D(tDepth,uv).x); float wt=exp(-float(i*i)*0.08)*max(0.0,1.0-abs(z-z0)/(0.05*z0+0.02)); s+=texture2D(tAO,uv).r*wt; w+=wt; }
  float a=s/max(w,1e-4); gl_FragColor=vec4(a,a,a,1.0);
}`,{tAO:{value:null},tDepth:{value:null},dir:{value:new THREE.Vector2()},cNear:{value:.1},cFar:{value:100}});
SH.bloomPre=pmat(`
uniform sampler2D tSrc; uniform vec2 px; uniform float threshold; varying vec2 vUv;
vec3 s(vec2 o){ return min(texture2D(tSrc,vUv+o*px).rgb,vec3(30.0)); }
float kw(vec3 c){ return 1.0/(1.0+max(c.r,max(c.g,c.b))); }
void main(){
  vec3 a=s(vec2(-1.,-1.)),b=s(vec2(1.,-1.)),d=s(vec2(-1.,1.)),e=s(vec2(1.,1.));
  float wa=kw(a),wb=kw(b),wd=kw(d),we=kw(e);
  vec3 c=(a*wa+b*wb+d*wd+e*we)/(wa+wb+wd+we);
  float l=max(c.r,max(c.g,c.b)); float knee=threshold*0.5;
  float soft=clamp(l-threshold+knee,0.0,2.0*knee); soft=soft*soft/(4.0*knee+1e-4);
  float contrib=max(soft,l-threshold)/max(l,1e-4);
  gl_FragColor=vec4(c*contrib,1.0);
}`,{tSrc:{value:null},px:{value:new THREE.Vector2()},threshold:{value:1}});
SH.down=pmat(`
uniform sampler2D tSrc; uniform vec2 px; varying vec2 vUv;
vec3 s(float x,float y){ return texture2D(tSrc,vUv+vec2(x,y)*px).rgb; }
void main(){
  vec3 a=s(-2.,2.),b=s(0.,2.),c=s(2.,2.),d=s(-2.,0.),e=s(0.,0.),f=s(2.,0.),g=s(-2.,-2.),h=s(0.,-2.),i=s(2.,-2.),j=s(-1.,1.),k=s(1.,1.),l=s(-1.,-1.),m=s(1.,-1.);
  vec3 o=e*0.125+(a+c+g+i)*0.03125+(b+d+f+h)*0.0625+(j+k+l+m)*0.125;
  gl_FragColor=vec4(o,1.0);
}`,{tSrc:{value:null},px:{value:new THREE.Vector2()}});
SH.up=pmat(`
uniform sampler2D tLow; uniform sampler2D tHigh; uniform vec2 px; uniform float radius; varying vec2 vUv;
vec3 s(float x,float y){ return texture2D(tLow,vUv+vec2(x,y)*px*radius).rgb; }
void main(){
  vec3 t=s(-1.,1.)+s(0.,1.)*2.+s(1.,1.)+s(-1.,0.)*2.+s(0.,0.)*4.+s(1.,0.)*2.+s(-1.,-1.)+s(0.,-1.)*2.+s(1.,-1.);
  gl_FragColor=vec4(texture2D(tHigh,vUv).rgb+t/16.0,1.0);
}`,{tLow:{value:null},tHigh:{value:null},px:{value:new THREE.Vector2()},radius:{value:1}});
SH.raysMask=pmat(`
uniform sampler2D tSrc; uniform sampler2D tDepth; uniform vec2 sun; uniform float aspect; varying vec2 vUv;
void main(){
  float d=texture2D(tDepth,vUv).x; float sky=step(0.99995,d);
  vec3 c=texture2D(tSrc,vUv).rgb; vec2 dv=(vUv-sun)*vec2(aspect,1.0); float fall=exp(-dot(dv,dv)*6.0);
  gl_FragColor=vec4(min(c,vec3(8.0))*sky*(0.25+fall*1.5),1.0);
}`,{tSrc:{value:null},tDepth:{value:null},sun:{value:new THREE.Vector2(.5,.5)},aspect:{value:1}});
SH.raysBlur=pmat(`
uniform sampler2D tSrc; uniform vec2 sun; uniform float density; uniform float decay; uniform float stepMul; varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec2 delta=(vUv-sun)*density/40.0*stepMul; vec2 uv=vUv - delta*hash(vUv*977.0); vec3 acc=vec3(0.0); float w=1.0, tw=0.0;
  for(int i=0;i<40;i++){ acc+=texture2D(tSrc,uv).rgb*w; tw+=w; w*=decay; uv-=delta; }
  gl_FragColor=vec4(acc/tw*1.6,1.0);
}`,{tSrc:{value:null},sun:{value:new THREE.Vector2()},density:{value:.9},decay:{value:.96},stepMul:{value:1}});
SH.dof=pmat(DEPTH_FN+`
uniform sampler2D tSrc; uniform sampler2D tDepth; uniform vec2 px; uniform float focus; uniform float range; uniform float maxR; varying vec2 vUv;
float coc(float z){ return clamp((z-focus)/range,-1.0,1.0); }
float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void main(){
  float z0=linZ(texture2D(tDepth,vUv).x); float c0=coc(z0);
  vec3 acc=texture2D(tSrc,vUv).rgb; float tw=1.0;
  float R=maxR*abs(c0); float rot=hash(vUv*997.0)*6.2831;
  for(int i=1;i<48;i++){
    float t=float(i)/48.0; float r=sqrt(t)*maxR; float a=float(i)*2.39996+rot;
    vec2 uv=vUv+vec2(cos(a),sin(a))*r*px;
    float z=linZ(texture2D(tDepth,uv).x); float c=coc(z);
    float reach=(z<z0)? abs(c)*maxR : min(abs(c)*maxR,R);
    float wgt=smoothstep(r-1.5,r+.5,reach);
    vec3 sc=texture2D(tSrc,uv).rgb; float l=max(sc.r,max(sc.g,sc.b));
    wgt*=1.0+smoothstep(1.5,6.0,l)*1.5;
    acc+=sc*wgt; tw+=wgt;
  }
  gl_FragColor=vec4(acc/tw,abs(c0));
}`,{tSrc:{value:null},tDepth:{value:null},px:{value:new THREE.Vector2()},focus:{value:4},range:{value:2},maxR:{value:8},cNear:{value:.1},cFar:{value:100}});
SH.comp=pmat(DEPTH_FN+`
uniform sampler2D tScene; uniform sampler2D tDepth; uniform sampler2D tAO; uniform sampler2D tBloom; uniform sampler2D tRays; uniform sampler2D tDof;
uniform float useAO, useBloom, useRays, useDof, useMB;
uniform float aoStrength, bloomStrength, raysStrength; uniform vec3 raysColor;
uniform mat4 invVP; uniform mat4 prevVP; uniform float mbStrength;
uniform float exposure, saturation, contrast, temp, vignette, aberr, grain, time, flashback, glitch, desat, whiteout, blackout, heat, pixel;
uniform vec3 tint; uniform vec3 lift; uniform vec2 res; varying vec2 vUv;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
vec3 toSRGB(vec3 c){ vec3 lo=c*12.92; vec3 hi=1.055*pow(max(c,vec3(0.0)),vec3(1.0/2.4))-0.055; return mix(lo,hi,step(vec3(0.0031308),c)); }
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec3 sceneAt(vec2 uv){
  vec3 c=texture2D(tScene,uv).rgb;
  if(useDof>0.5){ vec4 d=texture2D(tDof,uv); c=mix(c,d.rgb,smoothstep(0.05,0.45,d.a)); }
  return c;
}
void main(){
  vec2 uv=vUv;
  if(pixel>1.0){ vec2 cell=vec2(pixel)/res; uv=(floor(uv/cell)+0.5)*cell; }
  if(glitch>0.001){ float band=floor(uv.y*28.0+time*9.0); float g=step(0.82,hash12(vec2(band,floor(time*14.0)))); uv.x+=(hash12(vec2(band,time))-0.5)*0.09*glitch*g; }
  if(heat>0.001){ uv+=vec2(sin(uv.y*40.0+time*6.0),cos(uv.x*36.0+time*5.0))*0.0025*heat; }
  vec3 c;
  float ab=aberr+flashback*0.006+glitch*0.01;
  vec2 dc=(uv-0.5);
  if(ab>0.00001){ vec2 o=dc*ab*2.0; c=vec3(sceneAt(uv+o).r,sceneAt(uv).g,sceneAt(uv-o).b); } else c=sceneAt(uv);
  if(useMB>0.5){
    float d=texture2D(tDepth,uv).x; vec4 wp=invVP*vec4(uv*2.0-1.0,d*2.0-1.0,1.0); wp/=wp.w; vec4 pp=prevVP*wp; vec2 puv=pp.xy/pp.w*0.5+0.5;
    vec2 vel=(uv-puv)*mbStrength; float L=length(vel); if(L>0.04) vel*=0.04/L;
    if(L>0.0008){ vec3 a=c; for(int i=1;i<8;i++){ a+=sceneAt(uv-vel*(float(i)/8.0)); } c=a/8.0; }
  }
  if(useAO>0.5){ float ao=texture2D(tAO,uv).r; c*=mix(1.0,ao,aoStrength); }
  if(useBloom>0.5) c+=texture2D(tBloom,uv).rgb*bloomStrength;
  if(useRays>0.5) c+=texture2D(tRays,uv).rgb*raysColor*raysStrength;
  if(flashback>0.001){ vec3 blur=texture2D(tBloom,uv).rgb; c=mix(c,c*0.7+blur*1.2,flashback*0.6); }
  c*=exposure;
  c*=vec3(1.0+temp*0.1,1.0,1.0-temp*0.1)*tint;
  c=aces(c);
  float l=dot(c,vec3(0.2126,0.7152,0.0722));
  float sat=saturation*(1.0-desat)*(1.0-flashback*0.3);
  c=mix(vec3(l),c,sat);
  c=clamp((c-0.5)*contrast+0.5,0.0,1.0);
  c=c+lift*(1.0-c);
  if(flashback>0.001){ c=mix(c,vec3(l)*vec3(1.08,0.95,0.86)+vec3(0.03,0.0,0.0),flashback*0.28); float e=length(dc*vec2(1.0,0.8)); c=mix(c,vec3(1.0,0.97,0.94),smoothstep(0.35,0.75,e)*flashback*0.85); }
  c=toSRGB(c);
  float vd=length(dc*vec2(1.0,0.82)); c*=mix(1.0,smoothstep(0.95,0.22,vd),vignette);
  c+=(hash12(uv*res+fract(time)*437.0)-0.5)*(grain+flashback*0.08);
  c=mix(c,vec3(1.0),whiteout); c*=1.0-blackout;
  gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);
}`,{tScene:{value:null},tDepth:{value:null},tAO:{value:null},tBloom:{value:null},tRays:{value:null},tDof:{value:null},
  useAO:{value:0},useBloom:{value:0},useRays:{value:0},useDof:{value:0},useMB:{value:0},aoStrength:{value:.8},bloomStrength:{value:.5},raysStrength:{value:0},raysColor:{value:new THREE.Vector3(1,.9,.7)},
  invVP:{value:new THREE.Matrix4()},prevVP:{value:new THREE.Matrix4()},mbStrength:{value:1},
  exposure:{value:1},saturation:{value:1},contrast:{value:1},temp:{value:0},vignette:{value:.3},aberr:{value:0},grain:{value:.03},time:{value:0},flashback:{value:0},glitch:{value:0},desat:{value:0},whiteout:{value:0},blackout:{value:0},heat:{value:0},pixel:{value:0},
  tint:{value:new THREE.Vector3(1,1,1)},lift:{value:new THREE.Vector3()},res:{value:new THREE.Vector2()},cNear:{value:.1},cFar:{value:100}});
SH.fxaa=pmat(`
uniform sampler2D tSrc; uniform vec2 res; varying vec2 vUv;
void main(){
  vec2 px=1.0/res; vec3 L=vec3(0.299,0.587,0.114);
  vec3 nw=texture2D(tSrc,vUv+vec2(-1.,-1.)*px).rgb, ne=texture2D(tSrc,vUv+vec2(1.,-1.)*px).rgb, sw=texture2D(tSrc,vUv+vec2(-1.,1.)*px).rgb, se=texture2D(tSrc,vUv+vec2(1.,1.)*px).rgb, m=texture2D(tSrc,vUv).rgb;
  float lnw=dot(nw,L), lne=dot(ne,L), lsw=dot(sw,L), lse=dot(se,L), lm=dot(m,L);
  float mn=min(lm,min(min(lnw,lne),min(lsw,lse))), mx=max(lm,max(max(lnw,lne),max(lsw,lse)));
  vec2 dir=vec2(-((lnw+lne)-(lsw+lse)),((lnw+lsw)-(lne+lse)));
  float red=max((lnw+lne+lsw+lse)*0.03125,1.0/128.0); float rc=1.0/(min(abs(dir.x),abs(dir.y))+red);
  dir=clamp(dir*rc,vec2(-8.0),vec2(8.0))*px;
  vec3 a=0.5*(texture2D(tSrc,vUv+dir*(1.0/3.0-0.5)).rgb+texture2D(tSrc,vUv+dir*(2.0/3.0-0.5)).rgb);
  vec3 b=a*0.5+0.25*(texture2D(tSrc,vUv-dir*0.5).rgb+texture2D(tSrc,vUv+dir*0.5).rgb);
  float lb=dot(b,L);
  gl_FragColor=vec4((lb<mn||lb>mx)?a:b,1.0);
}`,{tSrc:{value:null},res:{value:new THREE.Vector2()}});

const RT={};
function initPost(){
  if(PP.tried) return PP.ok; PP.tried=true;
  try{
    const gl=renderer.getContext();
    if(!renderer.capabilities.isWebGL2 && !renderer.extensions.get('WEBGL_depth_texture')) throw new Error('no depth texture');
    RT.scene=mkRT(4,4,{depthBuffer:true});
    RT.scene.depthTexture=new THREE.DepthTexture(4,4); RT.scene.depthTexture.type=renderer.capabilities.isWebGL2?THREE.UnsignedIntType:THREE.UnsignedShortType;
    renderer.setRenderTarget(RT.scene);
    const ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE; renderer.setRenderTarget(null);
    if(!ok) throw new Error('HDR target incomplete');
    RT.ao=mkRT(4,4,{type:THREE.UnsignedByteType}); RT.ao2=mkRT(4,4,{type:THREE.UnsignedByteType});
    RT.down=[]; RT.up=[]; for(let i=0;i<6;i++){ RT.down.push(mkRT(4,4)); RT.up.push(mkRT(4,4)); }
    RT.rays=mkRT(4,4); RT.rays2=mkRT(4,4);
    RT.dof=mkRT(4,4);
    RT.ldr=mkRT(4,4,{type:THREE.UnsignedByteType});
    const black=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1); black.needsUpdate=true; RT.black=black;
    const white=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1); white.needsUpdate=true; RT.white=white;
    PP.ok=true; resizePost();
  }catch(e){ console.warn('post-processing unavailable:',e.message); PP.ok=false; }
  return PP.ok;
}
function resizePost(){
  if(!PP.ok) return;
  const s=renderer.getDrawingBufferSize(new THREE.Vector2()); const w=Math.max(2,s.x), h=Math.max(2,s.y);
  PP.w=w; PP.h=h;
  RT.scene.setSize(w,h); RT.scene.depthTexture.image.width=w; RT.scene.depthTexture.image.height=h;
  RT.ao.setSize(w/2,h/2); RT.ao2.setSize(w/2,h/2);
  let dw=w/2, dh=h/2; for(let i=0;i<6;i++){ RT.down[i].setSize(dw,dh); RT.up[i].setSize(dw,dh); dw=Math.max(1,dw/2); dh=Math.max(1,dh/2); }
  RT.rays.setSize(w/4,h/4); RT.rays2.setSize(w/4,h/4);
  RT.dof.setSize(w/2,h/2); RT.ldr.setSize(w,h);
}
const _vp=new THREE.Matrix4(), _prevVP=new THREE.Matrix4(), _ivp=new THREE.Matrix4(), _sunNDC=new THREE.Vector3();
let prevVPValid=false;
function renderScene(scene,cam){
  const post=PP.enabled&&PP.ok;
  // post-off fallback for the screen-wide fades the post shader normally does
  const wo=post?0:FX.whiteout, bo=post?0:FX.blackout;
  if(wo!==renderScene.wo){ renderScene.wo=wo; $('fxWhite').style.opacity=wo; }
  if(bo!==renderScene.bo){ renderScene.bo=bo; $('fxBlack').style.opacity=bo; }
  if(!post){
    if(FX.pixel>1){ const px=FX.pixel*Math.max(1,renderer.domElement.height/720); const w=Math.max(8,Math.floor(renderer.domElement.width/px)), h=Math.max(8,Math.floor(renderer.domElement.height/px)); let L=renderScene.lo;
      if(!L||L.rt.width!==w||L.rt.height!==h){ if(L) L.rt.dispose(); const rt=new THREE.WebGLRenderTarget(w,h,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter}); const sc=new THREE.Scene(), oc=new THREE.OrthographicCamera(-1,1,1,-1,0,1); sc.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({map:rt.texture,depthTest:false}))); L=renderScene.lo={rt,sc,oc}; }
      renderer.setRenderTarget(L.rt); renderer.render(scene,cam); renderer.setRenderTarget(null); renderer.render(L.sc,L.oc); prevVPValid=false; return; }
    renderer.setRenderTarget(null); renderer.render(scene,cam); prevVPValid=false; return; }
  const u=SH.comp.uniforms, S=SETTINGS;
  renderer.setRenderTarget(RT.scene); renderer.render(scene,cam);
  const depth=RT.scene.depthTexture, w=PP.w, h=PP.h;
  // --- SSAO
  const useAO=S.ao>0 && FX.aoStrength>0.01 && !scene.userData.noAO;
  if(useAO){
    const a=SH.ao.uniforms; a.tDepth.value=depth; a.res.value.set(w/2,h/2); a.proj.value.copy(cam.projectionMatrix); a.projInv.value.copy(cam.projectionMatrixInverse);
    a.radius.value=FX.aoRadius; a.intensity.value=1; a.samples.value=S.ao>=2?20:10;
    runPass(SH.ao,RT.ao);
    const b=SH.aoBlur.uniforms; b.tDepth.value=depth; b.cNear.value=cam.near; b.cFar.value=cam.far;
    b.tAO.value=RT.ao.texture; b.dir.value.set(2/w,0); runPass(SH.aoBlur,RT.ao2);
    b.tAO.value=RT.ao2.texture; b.dir.value.set(0,2/h); runPass(SH.aoBlur,RT.ao);
  }
  // --- bloom (always computed when bloom or flashback is on)
  const useBloom=S.bloom || FX.flashback>0.01;
  if(useBloom){
    const p=SH.bloomPre.uniforms; p.tSrc.value=RT.scene.texture; p.px.value.set(1/w,1/h); p.threshold.value=FX.flashback>0.01?Math.min(FX.bloomThreshold,.6):FX.bloomThreshold;
    runPass(SH.bloomPre,RT.down[0]);
    for(let i=1;i<6;i++){ const d=SH.down.uniforms; d.tSrc.value=RT.down[i-1].texture; d.px.value.set(1/RT.down[i-1].width,1/RT.down[i-1].height); runPass(SH.down,RT.down[i]); }
    let low=RT.down[5];
    for(let i=4;i>=0;i--){ const up=SH.up.uniforms; up.tLow.value=low.texture; up.tHigh.value=RT.down[i].texture; up.px.value.set(1/low.width,1/low.height); up.radius.value=FX.bloomRadius; runPass(SH.up,RT.up[i]); low=RT.up[i]; }
  }
  // --- god rays
  let useRays=false;
  if(S.rays && FX.rays>0.01 && FX.sunWorld){
    _sunNDC.copy(FX.sunWorld).project(cam);
    const behind=_sunNDC.z>1;
    const sx=_sunNDC.x*.5+.5, sy=_sunNDC.y*.5+.5;
    const onScreen=behind?0:clamp(1.4-Math.max(Math.abs(sx-.5),Math.abs(sy-.5))*1.6,0,1);
    if(onScreen>0.01){
      useRays=true;
      const m=SH.raysMask.uniforms; m.tSrc.value=RT.scene.texture; m.tDepth.value=depth; m.sun.value.set(sx,sy); m.aspect.value=w/h; runPass(SH.raysMask,RT.rays);
      const r=SH.raysBlur.uniforms; r.sun.value.set(sx,sy); r.density.value=FX.raysDensity; r.decay.value=FX.raysDecay;
      r.tSrc.value=RT.rays.texture; r.stepMul.value=1; runPass(SH.raysBlur,RT.rays2);
      r.tSrc.value=RT.rays2.texture; r.stepMul.value=.35; runPass(SH.raysBlur,RT.rays);
      u.raysStrength.value=FX.rays*onScreen;
    }
  }
  // --- depth of field
  const useDof=S.dof && FX.dof>0.01;
  if(useDof){ const d=SH.dof.uniforms; d.tSrc.value=RT.scene.texture; d.tDepth.value=depth; d.px.value.set(2/w,2/h); d.focus.value=FX.dofFocus; d.range.value=FX.dofRange/Math.max(.05,FX.dof); d.maxR.value=FX.dofMax*FX.dof; d.cNear.value=cam.near; d.cFar.value=cam.far; runPass(SH.dof,RT.dof); }
  // --- composite
  _vp.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse);
  const useMB=S.mblur && prevVPValid && FX.mblurStrength>0;
  u.tScene.value=RT.scene.texture; u.tDepth.value=depth;
  u.tAO.value=useAO?RT.ao.texture:RT.white; u.useAO.value=useAO?1:0; u.aoStrength.value=FX.aoStrength;
  u.tBloom.value=useBloom?RT.up[0].texture:RT.black; u.useBloom.value=S.bloom?1:0; u.bloomStrength.value=FX.bloomStrength;
  u.tRays.value=useRays?RT.rays.texture:RT.black; u.useRays.value=useRays?1:0; u.raysColor.value.copy(FX.raysColor);
  u.tDof.value=useDof?RT.dof.texture:RT.black; u.useDof.value=useDof?1:0;
  u.useMB.value=useMB?1:0; u.invVP.value.copy(_ivp.copy(_vp).invert()); u.prevVP.value.copy(_prevVP); u.mbStrength.value=FX.mblurStrength*.6;
  u.exposure.value=FX.exposure*(SETTINGS.bright||1); u.saturation.value=FX.saturation; u.contrast.value=FX.contrast; u.temp.value=FX.temp; u.tint.value.copy(FX.tint); u.lift.value.copy(FX.lift);
  u.vignette.value=S.lens?FX.vignette:FX.vignette*.4; u.aberr.value=S.lens?FX.aberr:0; u.grain.value=S.grain?FX.grain:0;
  u.time.value=G.real; u.flashback.value=FX.flashback; u.glitch.value=FX.glitch; u.desat.value=FX.desat; u.whiteout.value=FX.whiteout; u.blackout.value=FX.blackout; u.heat.value=FX.heat; u.pixel.value=FX.pixel*Math.max(1,PP.h/720);
  u.res.value.set(w,h); u.cNear.value=cam.near; u.cFar.value=cam.far;
  if(S.aa){ runPass(SH.comp,RT.ldr); SH.fxaa.uniforms.tSrc.value=RT.ldr.texture; SH.fxaa.uniforms.res.value.set(w,h); runPass(SH.fxaa,null); }
  else runPass(SH.comp,null);
  _prevVP.copy(_vp); prevVPValid=true;
}
function invalidateMotion(){ prevVPValid=false; }

/* ---------- quality application ---------- */
const SHADOW_SIZES=[0,1024,2048,2048,4096];
let LEVEL_SCENES=[];   // every built scene, so material recompiles reach all of them
function recompileAll(){ for(const s of LEVEL_SCENES) s.traverse(o=>{ if(o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.needsUpdate=true); } }); }
function baseDPR(){ return Math.min(window.devicePixelRatio||1,1.5); }
function applyGfx(){
  const S=SETTINGS;
  const pr=clamp(S.res*baseDPR(),.3,3);
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth,innerHeight,false);
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  const wantPost=S.post && initPost();
  const shadowsOn=S.shadow>0;
  const needRecompile=(wantPost!==PP.enabled)||(shadowsOn!==renderer.shadowMap.enabled)||((S.shadow>=2?THREE.PCFSoftShadowMap:THREE.PCFShadowMap)!==renderer.shadowMap.type);
  PP.enabled=wantPost;
  renderer.toneMapping=PP.enabled?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=PP.enabled?1:1.05*(SETTINGS.bright||1);
  renderer.shadowMap.enabled=shadowsOn;
  renderer.shadowMap.type=S.shadow>=2?THREE.PCFSoftShadowMap:THREE.PCFShadowMap;
  if(typeof applyShadowRes==='function') applyShadowRes();
  if(needRecompile) recompileAll();
  resizePost(); invalidateMotion();
  const fpsEl=$('fps'); if(fpsEl) fpsEl.style.display=S.showFps?'block':'none';
}
window.addEventListener('resize',()=>{ applyGfx(); });

/* ---------- procedural textures ---------- */
function canvasTex(w,h,draw,repeat,opts={}){
  const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d'); draw(x,w,h);
  const t=new THREE.CanvasTexture(c); t.encoding=opts.linear?THREE.LinearEncoding:THREE.sRGBEncoding;
  t.wrapS=t.wrapT=THREE.RepeatWrapping; if(repeat) t.repeat.set(repeat[0],repeat[1]);
  t.anisotropy=MAX_ANISO; if(opts.nearest){ t.magFilter=t.minFilter=THREE.NearestFilter; t.generateMipmaps=false; }
  return t;
}
/* height canvas -> tangent-space normal map */
function normalFromHeight(src,strength=2,wrap=true){
  const w=src.width,h=src.height, d=src.getContext('2d').getImageData(0,0,w,h).data;
  const out=document.createElement('canvas'); out.width=w; out.height=h; const o=out.getContext('2d'), img=o.createImageData(w,h), od=img.data;
  const H=new Float32Array(w*h); for(let i=0;i<w*h;i++) H[i]=(d[i*4]*.3+d[i*4+1]*.59+d[i*4+2]*.11)/255;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const xl=wrap?(x-1+w)%w:Math.max(0,x-1), xr=wrap?(x+1)%w:Math.min(w-1,x+1), yu=wrap?(y-1+h)%h:Math.max(0,y-1), yd=wrap?(y+1)%h:Math.min(h-1,y+1);
    const dx=(H[y*w+xr]-H[y*w+xl])*strength, dy=(H[yd*w+x]-H[yu*w+x])*strength;
    let nx=-dx, ny=dy, nz=1; const l=Math.hypot(nx,ny,nz); const i=(y*w+x)*4;
    od[i]=(nx/l*.5+.5)*255; od[i+1]=(ny/l*.5+.5)*255; od[i+2]=(nz/l*.5+.5)*255; od[i+3]=255;
  }
  o.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(out); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=MAX_ANISO; return t;
}
/* texture set: colour map + optional separate height (for normals) + roughness from a draw fn */
const TEXCACHE={};
function texSet(key,size,drawColor,o={}){
  if(TEXCACHE[key]) return TEXCACHE[key];
  const S=typeof size==='number'?[size,size]:size;
  const map=canvasTex(S[0],S[1],drawColor);
  let hsrc=map.image;
  if(o.height){ const hc=document.createElement('canvas'); hc.width=S[0]; hc.height=S[1]; o.height(hc.getContext('2d'),S[0],S[1]); hsrc=hc; }
  const normalMap=o.noNormal?null:normalFromHeight(hsrc,o.strength||2);
  let roughnessMap=null;
  if(o.rough){ roughnessMap=canvasTex(S[0],S[1],o.rough,null,{linear:true}); }
  const set={map,normalMap,roughnessMap};
  TEXCACHE[key]=set; return set;
}
function repeatSet(set,rx,ry){ const out={}; for(const k of ['map','normalMap','roughnessMap']){ if(set[k]){ const t=set[k].clone(); t.needsUpdate=true; t.repeat.set(rx,ry); out[k]=t; } } return out; }
/* drawing helpers */
function speckle(x,w,h,base,vars,count,size=1){ x.fillStyle=base; x.fillRect(0,0,w,h); for(let i=0;i<count;i++){ x.fillStyle=vars[(Math.random()*vars.length)|0]; x.fillRect(Math.random()*w,Math.random()*h,size,size); } }
function blotches(x,w,h,colA,n,rmin,rmax,alpha){ for(let i=0;i<n;i++){ const px=Math.random()*w,py=Math.random()*h,r=rmin+Math.random()*(rmax-rmin); for(const [ox,oy] of [[0,0],[w,0],[-w,0],[0,h],[0,-h]]){ const g=x.createRadialGradient(px+ox,py+oy,0,px+ox,py+oy,r); g.addColorStop(0,colA.replace('A',alpha)); g.addColorStop(1,colA.replace('A',0)); x.fillStyle=g; x.fillRect(px+ox-r,py+oy-r,r*2,r*2); } } }
function noiseFill(x,w,h,fn,scale=8,oct=4){ const img=x.createImageData(w,h), d=img.data; for(let j=0;j<h;j++) for(let i=0;i<w;i++){ const u=i/w, v=j/h; const n=tileFbm(u*scale,v*scale,scale,oct); const c=fn(n,u,v); const k=(j*w+i)*4; d[k]=c[0]; d[k+1]=c[1]; d[k+2]=c[2]; d[k+3]=c[3]==null?255:c[3]; } x.putImageData(img,0,0); }
/* tileable fbm: blends noise across the period so textures repeat seamlessly */
function tileFbm(x,y,period,oct=4){ let s=0,a=.5,f=1; for(let o=0;o<oct;o++){ const P=period*f; const xx=x*f, yy=y*f; const n=noise2(xx,yy), nx=noise2(xx-P,yy), ny=noise2(xx,yy-P), nxy=noise2(xx-P,yy-P); const bx=(xx%P)/P, by=(yy%P)/P; s+=a*lerp(lerp(n,nx,bx),lerp(ny,nxy,bx),by); f*=2; a*=.5; } return s; }

/* ---------- materials ---------- */
const MATCACHE={};
function mat(hex,o={},key){
  const k=key||(hex+'|'+JSON.stringify(o,(kk,v)=>(v&&v.isTexture)?v.uuid:(v&&v.isColor)?v.getHex():v));
  if(MATCACHE[k]) return MATCACHE[k];
  const opts=Object.assign({roughness:.75,metalness:0},o);
  if(hex!=null) opts.color=col(hex);
  if(opts.emissive!=null && typeof opts.emissive==='number') opts.emissive=col(opts.emissive);
  const Ctor=(opts.clearcoat!=null||opts.transmission!=null||opts.sheen!=null)?THREE.MeshPhysicalMaterial:THREE.MeshStandardMaterial;
  if(opts.sheen!=null && typeof opts.sheen==='number'){ opts.sheen=col(opts.sheen); }
  const m=new Ctor(opts); MATCACHE[k]=m; return m;
}
function emissiveMat(hex,k=2,o={}){ return mat(hex,Object.assign({emissive:hex,emissiveIntensity:k,roughness:.4},o)); }
function basicGlow(hex,k=1,o={}){ const m=new THREE.MeshBasicMaterial(Object.assign({color:col(hex)},o)); m.color.multiplyScalar(k); m.toneMapped=true; return m; }

/* ---------- geometry helpers ---------- */
const GEOCACHE={};
function GC(key,fn){ if(!GEOCACHE[key]) GEOCACHE[key]=fn(); return GEOCACHE[key]; }
function mesh(geo,m,x=0,y=0,z=0,shadow=true){ const o=new THREE.Mesh(geo,m); o.position.set(x,y,z); if(shadow){ o.castShadow=true; o.receiveShadow=true; } return o; }
const UBOX=new THREE.BoxGeometry(1,1,1), UCYL=new THREE.CylinderGeometry(.5,.5,1,24), USPH=new THREE.SphereGeometry(.5,24,16);
function box(w,h,d,m,x=0,y=0,z=0,shadow=true){ const o=mesh(UBOX,m,x,y,z,shadow); o.scale.set(w,h,d); return o; }
function cyl(rt,rb,h,m,x=0,y=0,z=0,seg=24,shadow=true){ return mesh(GC('cyl'+rt+'_'+rb+'_'+h+'_'+seg,()=>new THREE.CylinderGeometry(rt,rb,h,seg)),m,x,y,z,shadow); }
function sph(r,m,x=0,y=0,z=0,ws=24,hs=16,shadow=true){ const o=mesh(GC('sph'+ws+'_'+hs,()=>new THREE.SphereGeometry(1,ws,hs)),m,x,y,z,shadow); o.scale.setScalar(r); return o; }
/* rounded box: a subdivided box whose corners are pushed onto spheres */
function roundedBoxGeo(w,h,d,r,seg=3){
  return GC('rbox'+[w,h,d,r,seg].join('_'),()=>{
    const g=new THREE.BoxGeometry(w,h,d,seg*2+2,seg*2+2,seg*2+2), p=g.attributes.position, v=new THREE.Vector3(), c=new THREE.Vector3();
    const hx=w/2-r, hy=h/2-r, hz=d/2-r;
    for(let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i); c.set(clamp(v.x,-hx,hx),clamp(v.y,-hy,hy),clamp(v.z,-hz,hz)); const dlt=v.clone().sub(c); if(dlt.lengthSq()>1e-9){ dlt.normalize().multiplyScalar(r); v.copy(c).add(dlt); } p.setXYZ(i,v.x,v.y,v.z); }
    g.computeVertexNormals(); return g;
  });
}
function rbox(w,h,d,r,m,x=0,y=0,z=0,shadow=true){ return mesh(roundedBoxGeo(w,h,d,r),m,x,y,z,shadow); }
/* merge many (geometry,matrix) parts into one geometry (keeps normals + uvs) */
function mergeGeos(list){
  let count=0; const parts=list.map(g=>g.index?g.toNonIndexed():g);
  for(const g of parts) count+=g.attributes.position.count;
  const pos=new Float32Array(count*3), nor=new Float32Array(count*3), uv=new Float32Array(count*2); let hasCol=parts.some(g=>g.attributes.color); const colA=hasCol?new Float32Array(count*3):null;
  let o=0;
  for(const g of parts){ const p=g.attributes.position, n=g.attributes.normal, u=g.attributes.uv, c=g.attributes.color;
    pos.set(p.array,o*3); if(n) nor.set(n.array,o*3); if(u) uv.set(u.array,o*2); if(colA){ if(c) colA.set(c.array,o*3); else colA.fill(1,o*3,(o+p.count)*3); } o+=p.count; }
  const out=new THREE.BufferGeometry(); out.setAttribute('position',new THREE.BufferAttribute(pos,3)); out.setAttribute('normal',new THREE.BufferAttribute(nor,3)); out.setAttribute('uv',new THREE.BufferAttribute(uv,2)); if(colA) out.setAttribute('color',new THREE.BufferAttribute(colA,3));
  out.computeBoundingSphere(); out.computeBoundingBox(); return out;
}
class Builder{
  constructor(){ this.parts=new Map(); this.dm=new THREE.Object3D(); }
  add(geo,m,x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1){ this.dm.position.set(x,y,z); this.dm.rotation.set(rx,ry,rz); this.dm.scale.set(sx,sy,sz); this.dm.updateMatrix(); const g=geo.clone(); g.applyMatrix4(this.dm.matrix); if(!this.parts.has(m)) this.parts.set(m,[]); this.parts.get(m).push(g); return this; }
  addMesh(o){ o.updateMatrixWorld(true); const g=o.geometry.clone(); g.applyMatrix4(o.matrixWorld); if(!this.parts.has(o.material)) this.parts.set(o.material,[]); this.parts.get(o.material).push(g); return this; }
  box(w,h,d,m,x,y,z,ry=0){ return this.add(UBOX,m,x,y,z,0,ry,0,w,h,d); }
  build(shadow=true,receive=true){ const grp=new THREE.Group(); for(const [m,list] of this.parts){ const me=new THREE.Mesh(mergeGeos(list),m); me.castShadow=shadow; me.receiveShadow=receive; grp.add(me); } return grp; }
}

/* merge a static group into one mesh per material (huge draw-call saver) */
function bake(group,shadow=true){
  group.updateMatrixWorld(true); const inv=new THREE.Matrix4().copy(group.matrixWorld).invert();
  const byMat=new Map(); const keep=[];
  group.traverse(o=>{ if(o.isMesh && !o.isInstancedMesh && !o.userData.noBake && !(o.morphTargetInfluences)){ const g=o.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld)); if(!g.attributes.normal) g.computeVertexNormals(); if(!byMat.has(o.material)) byMat.set(o.material,[]); byMat.get(o.material).push(g); } else if(o!==group && (o.isLight||o.isInstancedMesh||o.userData.noBake)) keep.push(o); });
  const out=new THREE.Group(); out.position.copy(group.position); out.rotation.copy(group.rotation); out.scale.copy(group.scale); out.userData=group.userData;
  for(const [m,list] of byMat){ const me=new THREE.Mesh(mergeGeos(list),m); me.castShadow=shadow; me.receiveShadow=true; out.add(me); }
  for(const k of keep){ const wm=new THREE.Matrix4().multiplyMatrices(inv,k.matrixWorld); k.parent.remove(k); wm.decompose(k.position,k.quaternion,k.scale); out.add(k); }
  return out;
}
/* ---------- image based lighting ---------- */
const pmrem=new THREE.PMREMGenerator(renderer);
/* build an environment map from a gradient sky + glowing panels (cheap, looks great for PBR) */
function makeEnv(o){
  const s=new THREE.Scene();
  const top=col(o.top||0x88aaff), hor=col(o.horizon||0xffffff), bot=col(o.bottom||0x444444);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(50,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,uniforms:{top:{value:top},hor:{value:hor},bot:{value:bot},k:{value:o.intensity||1}},
    vertexShader:`varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`uniform vec3 top,hor,bot; uniform float k; varying vec3 vP; void main(){ float y=vP.y; vec3 c=y>0.0?mix(hor,top,pow(y,0.6)):mix(hor,bot,pow(-y,0.5)); gl_FragColor=vec4(c*k,1.0);
      #include <encodings_fragment>
    }`}));
  s.add(sky);
  for(const L of (o.lights||[])){ const m=new THREE.Mesh(new THREE.PlaneGeometry(L.w||8,L.h||8),new THREE.MeshBasicMaterial({color:col(L.c||0xffffff).multiplyScalar(L.k||4),side:THREE.DoubleSide})); m.position.set(L.x||0,L.y||20,L.z||0); m.lookAt(0,0,0); s.add(m); }
  const rt=pmrem.fromScene(s,o.blur||.02);
  s.traverse(x=>{ if(x.geometry) x.geometry.dispose(); if(x.material) x.material.dispose(); });
  return rt.texture;
}

