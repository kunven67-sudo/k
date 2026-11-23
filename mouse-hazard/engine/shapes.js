// Shaders for each effect's own looks: force field box, ice, bubble, black hole disk, lightning, rubber band, cracks,
// frost, oil film, snow bank, scorch marks, target laser, storm clouds, thumbtack.
'use strict';
const Shapes = (() => {
  const P = {}; let segGlow, segRope, segCrack, scorch, shards, oilFbo, oilStamp, snowTex, snowW = 0;
  function init(w, h) {
    oilFbo = GLX.fbo(w * 0.5, h * 0.5);
    if (P.field) return;
    P.field = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uScreen; uniform vec4 uBox; uniform float uDepth, uPower, uCollapse, uHasScreen, uHot; uniform vec4 uHits[8];
      float sdBox(vec2 p, vec2 b){ vec2 d=abs(p)-b; return length(max(d,0.))+min(max(d.x,d.y),0.); }
      float hexd(vec2 p){ p=abs(p); return max(dot(p,vec2(0.866,0.5)),p.y); }
      float hexEdge(vec2 p, float s){ p/=s; vec2 r=vec2(1.,1.732); vec2 h=r*0.5; vec2 a=mod(p,r)-h, b=mod(p-h,r)-h; vec2 g=dot(a,a)<dot(b,b)?a:b; return 0.5-hexd(g); }
      void main(){ vec2 px=vec2(vUV.x,1.-vUV.y)*uRes; vec2 c=uBox.xy+uBox.zw*0.5; vec2 hb=uBox.zw*0.5*(1.-uCollapse);
        vec2 q=px-c; float dO=sdBox(q,hb); if(dO>40.) { o=vec4(0); return; }
        float dI=sdBox(q,max(hb-uDepth,vec2(2.)));
        float flick=0.82+0.18*sin(uTime*37.)*sin(uTime*23.1);
        float pw=uPower*flick;
        // which wall of the cube is this pixel on (front wall = whole square, side walls = ring between outer and inner square)
        float ring=step(dI,0.)<0.5 && dO<0. ? 1. : 0.;
        vec2 ap=abs(q); float diag=abs(ap.x-hb.x - (ap.y-hb.y)); // corner edge lines of the cube
        float diagLine = ring>0.5 ? exp(-diag*diag*0.08) : 0.;
        float edgeO=exp(-dO*dO*0.05), edgeI=exp(-dI*dI*0.08)*0.55;
        float hx=hexEdge(q+vec2(0,uTime*6.),9.); float cells=smoothstep(0.06,0.0,hx);
        float n=fbm(q*0.02+vec2(uTime*0.4,-uTime*0.3));
        float rip=0.;
        for(int i=0;i<8;i++){ vec4 h=uHits[i]; if(h.w<=0.) continue; float d=length(px-h.xy); float age=h.z;
          rip+=h.w*exp(-age*2.5)*(0.5+0.5*sin(d*0.12-age*22.))*exp(-d*0.012)*smoothstep(age*420.+40.,age*420.-20.,d); }
        float inside=step(dO,0.);
        float wall=inside*(0.06+0.10*n + cells*(0.12+rip*1.4) + ring*0.06);
        float lines=(edgeO*1.6+edgeI+diagLine*0.7)*(1.+rip*0.6);
        float glowOut=(1.-inside)*exp(-max(dO,0.)*0.08)*0.35;
        vec3 col=vec3(0.25,0.62,1.45);
        float hot=uHot;
        vec3 e=col*(wall+glowOut)*pw + vec3(0.55,0.85,2.4)*lines*pw*(1.+hot);
        vec3 bg=vec3(0);
        float a=clamp(wall*1.6+lines*0.5+glowOut,0.,1.)*pw;
        if(uHasScreen>0.5 && inside>0.5){ vec2 off=vec2(fbm(q*0.03+uTime),fbm(q*0.03-uTime))-.5; bg=texture(uScreen,toUV(px+off*10.*pw)).rgb*vec3(0.85,0.95,1.1);
          o=vec4(bg*0.35*pw + e, max(a,0.35*pw)); return; }
        o=vec4(e,a); }`);
    P.ice = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uScreen; uniform vec4 uBox; uniform float uGrow, uCrack, uLayer, uHasScreen, uSeed;
      vec2 vor(vec2 p){ vec2 i=floor(p), f=fract(p); float md=9.; vec2 mc=vec2(0); for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y); vec2 r=g+hash22(i+g)-f; float d=dot(r,r); if(d<md){ md=d; mc=i+g; } } return mc; }
      void main(){ vec2 px=vec2(vUV.x,1.-vUV.y)*uRes; vec2 c=uBox.xy; vec2 hb=uBox.zw*0.5;
        vec2 q=px-c; if(abs(q.x)>hb.x*1.4+20.||abs(q.y)>hb.y*1.4+20.) { o=vec4(0); return; }
        float edgeN=(fbm(q*0.035+uSeed)-.5)*hb.x*0.5;
        vec2 d2=abs(q)-hb*uGrow+hb.x*0.25; float sd=length(max(d2,0.))+min(max(d2.x,d2.y),0.)-hb.x*0.25+edgeN;
        // growth front: crystals reach out from the middle
        float ang=atan(q.y,q.x); float front=length(q/(hb+1.)) - uGrow*1.3 + (ridged(vec2(ang*3.,uSeed))-0.5)*0.5;
        float inside=smoothstep(1.5,-1.5,sd)*smoothstep(0.1,-0.05,front);
        if(inside<0.01){ o=vec4(0); return; }
        vec2 cell=vor(q*0.045+uSeed); vec2 fn=(hash22(cell)-.5)*2.; float facet=hash12(cell*1.7);
        float cellEdge=0.; { vec2 e=vec2(1.5,0); cellEdge = (vor((q+e.xy)*0.045+uSeed)!=cell || vor((q+e.yx)*0.045+uSeed)!=cell) ? 1. : 0.; }
        float rim=smoothstep(-14.,0.,sd);
        vec3 n=normalize(vec3(fn*0.35 + vec2(dFdx(sd),dFdy(sd))*rim*1.5, 1.));
        float bub=smoothstep(0.93,0.98,vnoise(q*0.25+uSeed))*0.6;
        float frost=smoothstep(0.35,0.9,fbm(q*0.06+uSeed*2.))*0.55 + rim*0.45;
        float crk=smoothstep(0.9,0.97,ridged(q*0.03+uSeed*3.))*smoothstep(0.,1.,uCrack*1.3 - length(q)/hb.x*0.6);
        vec3 L=normalize(vec3(-0.5,0.6,0.65)); float spec=pow(max(dot(n,normalize(L+vec3(0,0,1))),0.),60.)*1.6;
        if(uLayer<0.5){ // body (behind the cursor)
          vec3 bg=uHasScreen>0.5?texture(uScreen,toUV(px+n.xy*26.)).rgb:vec3(0.3);
          vec3 col=bg*vec3(0.72,0.88,1.)*0.9+vec3(0.05,0.09,0.14);
          col=mix(col,vec3(0.86,0.93,1.),frost*0.65+facet*0.06);
          col+=vec3(0.7,0.85,1.)*cellEdge*0.25 + bub;
          float a=inside*0.94; o=vec4(col*a,a); return; }
        // surface (in front of the cursor): frost, shine, cracks
        float a=inside*clamp(frost*0.45+spec*0.6+crk*0.9+cellEdge*0.12,0.,1.);
        vec3 col=vec3(0.9,0.95,1.)*(frost*0.45+cellEdge*0.12)+vec3(1.)*spec+vec3(0.95,0.98,1.)*crk*1.2;
        o=vec4(col*inside, a); }`);
    P.bubble = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uScreen; uniform vec3 uB; uniform float uWob, uHasScreen, uPop, uSeed;
      void main(){ vec2 px=vec2(vUV.x,1.-vUV.y)*uRes; vec2 q=px-uB.xy; float R=uB.z; if(length(q)>R*1.3) { o=vec4(0); return; }
        float ang=atan(q.y,q.x); float rr=R*(1.+uWob*0.05*sin(ang*3.+uTime*5.)+uWob*0.03*sin(ang*5.-uTime*7.));
        float r=length(q)/rr; if(r>1.02) { o=vec4(0); return; }
        float z=sqrt(max(1.-r*r,0.)); vec3 n=normalize(vec3(q/rr, z));
        float edge=smoothstep(1.02,0.985,r);
        float hole=uPop>0. ? smoothstep(uPop*1.1-0.1,uPop*1.1,1.-dot(normalize(q),vec2(0.6,-0.8))*0.5-0.5+fbm(q*0.05)*0.3) : 1.;
        float fres=pow(1.-z,3.);
        float th=fbm(vec2(ang*1.5, r*2.)+vec2(uTime*0.15,-uTime*0.25)+uSeed)*2.2 + (1.-n.y)*0.8 + uTime*0.05;
        vec3 film=0.55+0.45*cos(6.2831*(th+vec3(0.,0.33,0.67)));
        vec3 bg=uHasScreen>0.5?texture(uScreen,toUV(px - q*0.05*z)).rgb:vec3(0.3);
        vec3 env=mix(vec3(0.95,0.97,1.), vec3(0.16,0.17,0.19), smoothstep(-0.5,0.7,n.y));
        float Rf=mix(0.05,0.95,fres);
        vec3 L=normalize(vec3(-0.45,-0.6,0.66)); float spec=pow(max(dot(n,normalize(L+vec3(0,0,1))),0.),90.)*2.5;
        vec2 win=(q/rr-vec2(-0.38,-0.42))*vec2(5.,6.); float window=smoothstep(1.,0.8,max(abs(win.x),abs(win.y)))*0.6*step(0.08,abs(win.x))*step(0.08,abs(win.y));
        vec3 refl=mix(film*0.85, env*film*1.3, 0.5);
        float outline=smoothstep(0.95,0.985,r)*smoothstep(1.015,0.988,r);
        vec3 col=refl*Rf+vec3(1.)*(spec+window)+bg*0.05*z;
        col=mix(col,col*0.5,outline*0.6);
        float a=clamp(Rf*0.92+outline*0.4+spec+window*0.7,0.,1.)*edge;
        o=vec4(col*edge,a); }`);
    P.blackhole = GLX.program(`in vec2 vUV; out vec4 o; uniform vec4 uBH; uniform float uSpin;
      void main(){ vec2 px=vec2(vUV.x,1.-vUV.y)*uRes; vec2 q=px-uBH.xy; float rs=uBH.z; if(rs<=0.5||length(q)>rs*8.) { o=vec4(0); return; }
        float rr=length(q)/rs; float shadow=smoothstep(1.0,0.96,rr);
        vec2 dq=vec2(q.x,q.y/0.17)/rs; float rd=length(dq);
        float band=smoothstep(2.3,2.7,rd)*smoothstep(6.8,3.6,rd);
        float an=atan(dq.y,dq.x);
        float tex=0.45+0.55*fbm(vec2(an*3.+uSpin*3./rd, rd*2.6))*1.2;
        float dop=clamp(1.-0.65*dq.x/max(rd,0.01),0.3,1.9);
        vec3 disk=mix(vec3(1.,0.5,0.2),vec3(1.,0.88,0.72),smoothstep(5.,2.6,rd))*band*tex*dop*1.5;
        float front=step(0.,q.y);
        disk*=mix(1.-shadow,1.,front);
        float ring=smoothstep(1.04,1.12,rr)*smoothstep(1.55,1.18,rr);
        float ang=atan(q.y,q.x); float arcT=0.45+0.55*fbm(vec2(ang*4.+uSpin,rr*5.));
        vec3 arc=vec3(1.,0.68,0.38)*ring*arcT*(q.y<0.?1.25:0.55);
        float photon=exp(-pow((rr-1.03)*28.,2.))*1.5;
        vec3 col=disk+arc+vec3(1.,0.86,0.7)*photon;
        float a=max(shadow,clamp(max(col.r,max(col.g,col.b))*0.9,0.,1.));
        o=vec4(col,a); }`);
    P.frost = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uScreen; uniform float uAmt, uHasScreen, uSeed;
      void main(){ vec2 px=vec2(vUV.x,1.-vUV.y)*uRes; vec2 e=min(px,uRes-px); float d=min(e.x,e.y)/min(uRes.x,uRes.y);
        if(uAmt<=0.||d>uAmt*0.16) { o=vec4(0); return; }
        float n=fbm(px*0.006+uSeed); float reach=uAmt*0.12;
        float m=smoothstep(reach, reach*0.3, d+(n-0.5)*0.07);
        if(m<0.01) { o=vec4(0); return; }
        float v1=ridged(px*0.028+uSeed), v2=ridged(px*0.085+uSeed*2.);
        float cry=smoothstep(0.62,0.95,v1)*0.65+smoothstep(0.66,0.95,v2)*0.45;
        vec2 off=vec2(vnoise(px*0.08),vnoise(px*0.08+9.))-.5;
        vec3 bg=uHasScreen>0.5?(texture(uScreen,toUV(px+off*9.)).rgb+texture(uScreen,toUV(px-off*9.)).rgb)*0.5:vec3(0.3);
        vec3 col=mix(bg*vec3(0.86,0.93,1.)+0.07, vec3(0.93,0.97,1.), clamp(cry+m*0.25,0.,1.)*0.85);
        float a=m*(0.5+cry*0.5); o=vec4(col*a,a); }`);
    P.oil = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uOil, uScreen; uniform vec2 uTx; uniform float uHasScreen, uFade;
      void main(){ float t=texture(uOil,vUV).r*uFade; if(t<0.02) { o=vec4(0); return; }
        float l=texture(uOil,vUV-vec2(uTx.x,0)).r, r=texture(uOil,vUV+vec2(uTx.x,0)).r, b=texture(uOil,vUV-vec2(0,uTx.y)).r, tt=texture(uOil,vUV+vec2(0,uTx.y)).r;
        vec2 g=vec2(l-r,b-tt); vec2 px=vUV*uRes;
        float th=t*1.6+fbm(px*0.01+uTime*0.04)*0.7;
        vec3 film=0.5+0.5*cos(6.2831*(th*1.2+vec3(0.,0.33,0.67)));
        vec3 bg=uHasScreen>0.5?texture(uScreen,vUV+g*0.015).rgb:vec3(0.3);
        float a=smoothstep(0.02,0.2,t);
        float thick=smoothstep(0.3,0.95,t);
        vec2 rip=vec2(vnoise(px*0.05+uTime*0.3),vnoise(px*0.05+7.-uTime*0.3))-.5; vec3 n=normalize(vec3(g*10.+rip*0.5*thick,1.)); float sp=pow(max(dot(n,normalize(vec3(-0.4,0.6,0.7))),0.),60.)*1.4;
        vec3 thin=bg*0.7+film*0.24*(1.-thick*0.6);
        vec3 deep=vec3(0.035,0.028,0.02)+film*0.05;
        vec3 col=mix(thin,deep,thick*0.85)+vec3(1.)*sp*0.9;
        o=vec4(col*a,a*0.92); }`);
    P.oilSpread = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uSrc; uniform vec2 uTx; uniform float uK;
      void main(){ vec4 c=texture(uSrc,vUV); vec4 s=(texture(uSrc,vUV+vec2(uTx.x,0))+texture(uSrc,vUV-vec2(uTx.x,0))+texture(uSrc,vUV+vec2(0,uTx.y))+texture(uSrc,vUV-vec2(0,uTx.y)))*0.25;
        o=mix(c,max(c,s*0.995),uK); }`);
    P.snowbank = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uH; uniform float uFloor, uFade;
      void main(){ vec2 px=vec2(vUV.x,1.-vUV.y)*uRes; float h=texture(uH,vec2(vUV.x,0.5)).r*255.*uFade; float top=uFloor-h;
        if(px.y<top-2.||px.y>uFloor+1.||h<0.5) { o=vec4(0); return; }
        float hl=texture(uH,vec2(vUV.x-2./uRes.x,0.5)).r, hr=texture(uH,vec2(vUV.x+2./uRes.x,0.5)).r;
        vec3 n=normalize(vec3((hl-hr)*0.5,1.,0.4)); float depth=(px.y-top);
        float a=smoothstep(top-1.5,top+0.5,px.y);
        float sh=0.75+0.25*dot(n,normalize(vec3(-0.4,0.9,0.3)));
        vec3 col=mix(vec3(1.,1.,1.),vec3(0.72,0.8,0.92),smoothstep(0.,40.,depth)*0.6)*sh;
        float sp=step(0.996,hash12(floor(px*0.5)))*(0.5+0.5*sin(uTime*6.+px.x));
        col+=sp*1.4*smoothstep(10.,0.,depth); o=vec4(col*a,a); }`);
    P.laser = GLX.program(`in vec2 vUV; out vec4 o; uniform vec2 uA, uB; uniform float uOn, uRet, uLock, uPulse;
      float seg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }
      void main(){ vec2 px=vec2(vUV.x,1.-vUV.y)*uRes; vec3 col=vec3(0); float a=0.;
        if(uOn>0.){ float d=seg(px,uA,uB); float beam=exp(-d*d*0.9)*0.9+exp(-d*0.25)*0.06; float dust=smoothstep(0.75,1.,vnoise(px*0.6+uTime*3.))*exp(-d*d*0.05);
          col+=vec3(2.2,0.08,0.05)*(beam+dust*0.8)*uOn; float dd=length(px-uB); col+=vec3(3.,0.2,0.1)*exp(-dd*dd*0.06)*uOn; col+=vec3(1.,0.,0.)*exp(-dd*0.08)*0.5*uOn; }
        if(uRet>0.){ float dd=length(px-uB); float R=mix(140.,26.,uLock); float ring=exp(-pow(dd-R,2.)*0.35)*(0.6+0.4*uPulse);
          float tick=0.; vec2 q=abs(px-uB); if(q.x<1.4&&q.y>R*0.55&&q.y<R*1.25) tick=1.; if(q.y<1.4&&q.x>R*0.55&&q.x<R*1.25) tick=1.;
          col+=vec3(1.6,0.12,0.08)*(ring+tick*0.8)*uRet; }
        a=clamp(max(col.r,max(col.g,col.b))*0.5,0.,1.); o=vec4(col,a); }`);
    P.clouds = GLX.program(`in vec2 vUV; out vec4 o; uniform float uAmt, uFlash, uH; uniform vec2 uFlashAt;
      void main(){ vec2 px=vec2(vUV.x,1.-vUV.y)*uRes; float band=uH*uAmt; if(px.y>band+120.) { o=vec4(0); return; }
        vec2 p=px*0.0035+vec2(uTime*0.03,0.); float n=fbm(p)*0.6+fbm(p*2.7+vec2(uTime*0.05,0.))*0.4;
        float edge=band - n*160.; float m=smoothstep(edge+10.,edge-60.,px.y)*uAmt;
        float lit=exp(-length(px-uFlashAt)*0.004)*uFlash;
        vec3 col=mix(vec3(0.05,0.055,0.065),vec3(0.22,0.23,0.27),n)*(1.-smoothstep(0.,band,px.y)*0.3)+vec3(0.75,0.8,1.)*lit*n*2.;
        o=vec4(col*m,m*0.96); }`);
    P.pin = GLX.program(`in vec2 vUV; out vec4 o; uniform vec3 uP; uniform float uA;
      void main(){ vec2 px=vec2(vUV.x,1.-vUV.y)*uRes; vec2 q=(px-uP.xy)/uP.z; if(length(q)>2.4||uA<=0.) { o=vec4(0); return; }
        float sh=exp(-dot(q-vec2(0.45,0.55),q-vec2(0.45,0.55))*1.6)*0.45; // shadow on the screen
        float r=length(q); vec3 col=vec3(0); float a=sh*0.6;
        if(r<1.){ float z=sqrt(1.-r*r); vec3 n=normalize(vec3(q,z)); vec3 L=normalize(vec3(-0.5,-0.6,0.7));
          float dif=max(dot(n,L),0.); float sp=pow(max(dot(n,normalize(L+vec3(0,0,1))),0.),70.);
          col=vec3(0.75,0.06,0.05)*(0.15+dif*0.9)+vec3(1.)*sp*1.3+vec3(0.3,0.02,0.02)*pow(1.-z,2.)*0.6; a=smoothstep(1.,0.96,r); }
        o=vec4(col*a + vec3(0)*(1.-a), max(a,sh*0.6)*uA); o.rgb*=uA; }`);
    segGlow = GLX.batch(`in vec2 vUV; in vec4 vCol; in vec4 vPar; out vec4 o;
      void main(){ vec2 q=vUV*2.-1.; float w=vPar.y; float core=exp(-q.y*q.y*w*w*0.5*10.); float halo=exp(-q.y*q.y*2.)*0.35;
        float l=smoothstep(1.,0.85,abs(q.x)); vec3 c=vCol.rgb*(core*3.+halo)*vCol.a*l; o=vec4(c, (core*0.5+halo*0.2)*vCol.a*l); }`, 6000);
    segRope = GLX.batch(`in vec2 vUV; in vec4 vCol; in vec4 vPar; out vec4 o;
      void main(){ vec2 q=vUV*2.-1.; float l=smoothstep(1.,0.9,abs(q.x)); float th=vPar.y; float r=abs(q.y)/th; if(r>1.) discard;
        float z=sqrt(1.-r*r); float lit=0.35+0.65*max(dot(vec3(0,q.y/th,z),normalize(vec3(0,-0.6,0.8))),0.); float sp=pow(max(1.-abs(q.y/th+0.45)*3.,0.),3.)*0.6;
        vec3 c=vCol.rgb*lit+sp; float a=vCol.a*l*smoothstep(1.,0.8,r); o=vec4(c*a,a); }`, 400);
    segCrack = GLX.batch(`in vec2 vUV; in vec4 vCol; in vec4 vPar; out vec4 o;
      void main(){ vec2 q=vUV*2.-1.; float l=smoothstep(1.,0.8,abs(q.x)); float d=q.y; float dark=exp(-d*d*14.)*0.75; float lite=exp(-(d+0.42)*(d+0.42)*26.)*2.2;
        float a=(dark+lite*0.5)*vCol.a*l; vec3 c=vec3(0.95,0.97,1.)*lite*vCol.a*l; o=vec4(c,a); }`, 8000);
    scorch = GLX.batch(`in vec2 vUV; in vec4 vCol; in vec4 vPar; in vec2 vPx; out vec4 o;
      void main(){ vec2 q=vUV*2.-1.; float n=fbm(q*2.5+vPar.z); float r=length(q)+(n-.5)*0.6; float a=smoothstep(1.,0.2,r)*vCol.a;
        vec3 c=vec3(0.02,0.015,0.01)*(0.6+n*0.8); float emb=smoothstep(0.75,0.95,ridged(q*3.+vPar.z))*smoothstep(1.,0.4,r)*vPar.w;
        c+=blackbody(0.6)*emb*3.; o=vec4(c*a,a*0.9); }`, 64);
    shards = GLX.batch(`in vec2 vUV; in vec4 vCol; in vec4 vPar; in vec4 vEx; in vec2 vPx; out vec4 o; uniform sampler2D uScreen; uniform float uHasScreen;
      void main(){ vec2 q=vUV*2.-1.; float s=vPar.z; vec2 p=q; float ang=atan(p.y,p.x); float k=floor((ang+3.1416)/6.2832*5.+s);
        float rad=0.55+0.4*hash12(vec2(k,s)); vec2 dir=vec2(cos(ang),sin(ang)); float d=length(p)/rad; if(d>1.) discard;
        float edge=smoothstep(0.8,1.,d); vec3 n=normalize(vec3(dir*edge*0.8+(hash22(vec2(k,s))-.5)*0.4,1.));
        vec3 bg=uHasScreen>0.5?texture(uScreen,toUV(vPx+n.xy*20.)).rgb:vec3(0.3);
        vec3 col=bg*vec3(0.75,0.88,1.)+vec3(0.06,0.1,0.15)+vec3(0.9,0.95,1.)*edge*0.5 + pow(max(dot(n,normalize(vec3(-0.4,0.5,0.8))),0.),30.)*1.2;
        float a=vCol.a*(0.82+edge*0.18); o=vec4(col*a,a); }`, 200);
    snowTex = GLX.texture(4, 1, { float: false });
  }
  const box = (x, y, w, h) => [x, y, w, h];
  return {
    init,
    field(o) { GLX.pass(P.field, { uScreen: Render.screenTex, uHasScreen: Render.hasScreen ? 1 : 0, uBox: o.box, uDepth: o.depth, uPower: o.power, uCollapse: o.collapse || 0, uHot: o.hot || 0, uHits: o.hits }, Render.scene, 'pm'); },
    ice(o) { GLX.pass(P.ice, { uScreen: Render.screenTex, uHasScreen: Render.hasScreen ? 1 : 0, uBox: o.box, uGrow: o.grow, uCrack: o.crack, uLayer: o.layer, uSeed: o.seed }, Render.scene, 'pm'); },
    bubble(o) { GLX.pass(P.bubble, { uScreen: Render.screenTex, uHasScreen: Render.hasScreen ? 1 : 0, uB: o.b, uWob: o.wob, uPop: o.pop || 0, uSeed: o.seed || 0 }, Render.scene, 'pm'); },
    blackhole(o) { GLX.pass(P.blackhole, { uBH: o.bh, uSpin: o.spin }, Render.scene, 'pm'); },
    frost(amt, seed) { if (amt > 0) GLX.pass(P.frost, { uScreen: Render.screenTex, uHasScreen: Render.hasScreen ? 1 : 0, uAmt: amt, uSeed: seed || 0 }, Render.scene, 'pm'); },
    laser(o) { GLX.pass(P.laser, { uA: o.a, uB: o.b, uOn: o.on, uRet: o.ret, uLock: o.lock, uPulse: o.pulse }, Render.scene, 'pm'); },
    clouds(o) { GLX.pass(P.clouds, { uAmt: o.amt, uFlash: o.flash, uFlashAt: o.at, uH: o.h }, Render.scene, 'pm'); },
    pin(x, y, r, a) { GLX.pass(P.pin, { uP: [x, y, r], uA: a }, Render.scene, 'pm'); },
    // polylines as glowing segments: pts [[x,y],...], width px, color [r,g,b], alpha
    glowLine(pts, width, col, alpha, reset) {
      if (reset !== false) segGlow.reset();
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; const dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy);
        const w = (pts[i][2] || 1) * width; segGlow.push((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, L + w, w * 6, col[0], col[1], col[2], alpha, Math.atan2(dy, dx), 6); }
    },
    glowFlush() { segGlow.draw({}, Render.scene, 'pm'); segGlow.reset(); },
    rope(pts, thick, col, alpha) { segRope.reset();
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; const dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy); const t = thick[i] || thick;
        segRope.push((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, L + t * 1.2, t * 2.2, col[0], col[1], col[2], alpha, Math.atan2(dy, dx), 0.9); }
      segRope.draw({}, Render.scene, 'pm'); },
    cracks(list, alpha) { segCrack.reset(); // list of segments [x0,y0,x1,y1,width,grow]
      for (const s of list) { const g = s[5] == null ? 1 : s[5]; if (g <= 0) continue; const x1 = s[0] + (s[2] - s[0]) * g, y1 = s[1] + (s[3] - s[1]) * g;
        const dx = x1 - s[0], dy = y1 - s[1]; const L = Math.hypot(dx, dy); segCrack.push((s[0] + x1) / 2, (s[1] + y1) / 2, L + 2, s[4] * 4, 1, 1, 1, alpha, Math.atan2(dy, dx)); }
      segCrack.draw({}, Render.scene, 'pm'); },
    scorch(list) { scorch.reset(); for (const s of list) scorch.push(s.x, s.y, s.r * 2, s.r * 1.6, 0, 0, 0, s.a, s.rot || 0, 0, s.seed, s.ember || 0); scorch.draw({}, Render.scene, 'pm'); },
    shards(list) { shards.reset(); for (const s of list) shards.push(s.x, s.y, s.size, s.size * 0.8, 1, 1, 1, s.a, s.rot, 0, s.seed); shards.draw({ uScreen: Render.screenTex, uHasScreen: Render.hasScreen ? 1 : 0 }, Render.scene, 'pm'); },
    oilStampBatch() { return oilStamp || (oilStamp = GLX.batch(`in vec2 vUV; in vec4 vCol; out vec4 o; void main(){ vec2 q=vUV*2.-1.; float d=dot(q,q); float n=fbm(q*2.+vCol.g*10.); float a=smoothstep(1.,0.2,d+n*0.5-0.25)*vCol.r; o=vec4(a,0,0,a); }`, 300)); },
    oilStamp(list) { const b = Shapes.oilStampBatch(); b.reset(); for (const s of list) b.push(s[0], s[1], s[2], s[2] * 0.8, s[3], Math.random(), 0, 1, Math.random() * 6); b.draw({}, oilFbo, 'max', 0.5); },
    oilStep() { GLX.pass(P.oilSpread, { uSrc: oilFbo, uTx: oilFbo.texel, uK: 0.5 }, oilFbo); },
    oilDraw(fade) { GLX.pass(P.oil, { uOil: oilFbo, uScreen: Render.screenTex, uHasScreen: Render.hasScreen ? 1 : 0, uTx: oilFbo.texel, uFade: fade }, Render.scene, 'pm'); },
    oilClear() { GLX.clear(oilFbo); },
    snowbank(heights, floorY, fade) { // heights: Float32Array per column
      const w = heights.length; const d = new Uint8Array(w * 4); for (let i = 0; i < w; i++) { const v = Math.min(255, heights[i]); d[i * 4] = v; d[i * 4 + 3] = 255; }
      const g = GLX.gl; g.bindTexture(g.TEXTURE_2D, snowTex); g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, w, 1, 0, g.RGBA, g.UNSIGNED_BYTE, d);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      GLX.pass(P.snowbank, { uH: snowTex, uFloor: floorY, uFade: fade * 255 / 255 * 1 }, Render.scene, 'pm'); },
  };
})();
