/* ================================================================
   THE WATCH — your watch from Ant Work 2 is how you call Jim. Its
   screen is drawn live: the time, "CALLING JIM", then just static.
   Jay 2 has the same watch on his wrist.
   ================================================================ */
const WATCH={mode:'time',t:0,canvas:null,ctx:null,tex:null,acc:0,dots:0};
function watchSetup(){
  if(WATCH.canvas||!VM.watchScr) return;
  const c=document.createElement('canvas'); c.width=96; c.height=120; WATCH.canvas=c; WATCH.ctx=c.getContext('2d');
  const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.minFilter=THREE.LinearFilter; WATCH.tex=t;
  VM.watchScr.material=new THREE.MeshBasicMaterial({map:t,color:col(0xffffff).multiplyScalar(1.7),transparent:false});
  VM.watchCanvas=true; watchDraw(0);
}
function watchMode(m){ WATCH.mode=m; WATCH.t=0; watchDraw(0); }
function watchDraw(dt){
  const x=WATCH.ctx; if(!x) return; const w=96,h=120; WATCH.t+=dt;
  x.fillStyle='#03080a'; x.fillRect(0,0,w,h);
  const g=x.createRadialGradient(w/2,h/2,10,w/2,h/2,80); g.addColorStop(0,'rgba(60,140,140,.18)'); g.addColorStop(1,'rgba(0,0,0,0)'); x.fillStyle=g; x.fillRect(0,0,w,h);
  x.textAlign='center'; x.fillStyle='#8ff5e0'; x.font='bold 13px monospace';
  if(WATCH.mode==='time'){ x.font='bold 28px monospace'; x.fillText('12:07',w/2,62); x.font='10px monospace'; x.fillStyle='#4fb8a8'; x.fillText('NO NETWORK',w/2,84); }
  else if(WATCH.mode==='calling'){ const k=WATCH.t;
    x.strokeStyle='rgba(143,245,224,'+(.35+.3*Math.sin(k*6))+')'; x.lineWidth=2; for(let i=0;i<3;i++){ const r=((k*30+i*14)%42)+6; x.globalAlpha=1-r/48; x.beginPath(); x.arc(w/2,46,r,0,7); x.stroke(); } x.globalAlpha=1;
    x.fillStyle='#8ff5e0'; x.beginPath(); x.arc(w/2,40,9,0,7); x.fill(); x.beginPath(); x.ellipse(w/2,60,14,9,0,Math.PI,0); x.fill();
    x.font='bold 12px monospace'; x.fillText('CALLING',w/2,88); x.fillText('JIM'+'.'.repeat(1+Math.floor(k*2.5)%3),w/2,103); }
  else if(WATCH.mode==='static'){ const img=x.getImageData(0,0,w,h), d=img.data; for(let i=0;i<d.length;i+=4){ const v=Math.random()*190|0; d[i]=v*.7; d[i+1]=v; d[i+2]=v*.95; d[i+3]=255; } x.putImageData(img,0,0);
    for(let i=0;i<3;i++){ x.fillStyle='rgba(0,0,0,.35)'; x.fillRect(0,(WATCH.t*90+i*40)%h,w,6); }
    x.fillStyle='rgba(0,0,0,.55)'; x.fillRect(8,48,80,22); x.fillStyle='#ff8a7a'; x.font='bold 11px monospace'; x.fillText('NO SIGNAL',w/2,63); }
  else if(WATCH.mode==='off'){ x.fillStyle='#000'; x.fillRect(0,0,w,h); }
  WATCH.tex.needsUpdate=true;
}
on('tick',dt=>{ if(!WATCH.ctx) return; if(!PLAYER.hasWatch||!(PLAYER.watchLook>0)) return; WATCH.acc+=dt; if(WATCH.acc>(WATCH.mode==='static'?.05:.12)){ watchDraw(WATCH.acc); WATCH.acc=0; } });
/* the same watch on a person's left wrist (Jay 2) */
function giveWatch(h){
  if(h.userData.watch) return h.userData.watch; const J=h.userData.J; if(!J||!J.hdL) return null;
  const w=new THREE.Group();
  const band=mesh(GC('wBandP',()=>new THREE.TorusGeometry(.03,.007,8,20)),mat(0x1a1c22,{roughness:.4,metalness:.6}),0,0,0); band.rotation.x=Math.PI/2; w.add(band);
  const face=mesh(roundedBoxGeo(.04,.01,.048,.005),mat(0x303640,{roughness:.2,metalness:.9}),0,0,.03); face.rotation.x=Math.PI/2; w.add(face);
  const scr=mesh(GC('wScrP',()=>new THREE.PlaneGeometry(.032,.04)),new THREE.MeshBasicMaterial({color:col(0x6dffd8).multiplyScalar(1.6)}),0,0,.0365,false); w.add(scr);
  w.position.set(0,.03,0); J.hdL.add(w); h.userData.watch=w; h.userData.watchScr=scr;
  return w;
}
/* Jay 2 lifts his wrist and looks at it */
POSES.watch=(t)=>({shL:[-.95,.45,.2],elL:[-1.85,.25,0],hdL:[.25,.6,0],head:[.42,.18,0],spine:[.05,0,0]});
POSES.guard=(t)=>{ const s=Math.sin(t*3.1)*.05; return {shL:[-.9+s,-.38,.22],elL:[-2.25,.3,0],shR:[-.92-s,.38,-.22],elR:[-2.25,-.3,0],hdL:[.2,.5,0],hdR:[.2,-.5,0],spine:[.14,0,0],chest:[.05,0,0],head:[.16,0,0],fL:1,fR:1}; };
POSES.holdHead=(t)=>({shL:[-1.4,.2,.5],elL:[-2.4,.3,0],shR:[-1.4,-.2,-.5],elR:[-2.4,-.3,0],head:[.25,0,0],spine:[.18,0,0]});
POSES.flinch=(t)=>({shL:[-1.3,.4,.6],elL:[-2.2,.3,0],shR:[-1.3,-.4,-.6],elR:[-2.2,-.3,0],head:[.35,0,0],spine:[.25,0,0]});
POSES.flail=(t)=>({shL:[-1.8+Math.sin(t*5)*.4,0,.9],elL:[-.6,0,0],shR:[-1.8+Math.cos(t*5)*.4,0,-.9],elR:[-.6,0,0],head:[-.4,0,0],spine:[-.3,0,0],thL:[-.6,0,0],thR:[-.9,0,0],knL:[.8,0,0],knR:[.5,0,0]});
POSES.lieBack=(t)=>({spine:[-.15,0,0],head:[-.1,0,0],shL:[.2,0,.5],shR:[.2,0,-.5],elL:[-.3,0,0],elR:[-.3,0,0]});
POSES.chained=(t)=>({thL:[-1.5,0,-.05],thR:[-1.5,0,.05],knL:[1.5,0,0],knR:[1.5,0,0],ftL:[.05,0,0],ftR:[.05,0,0],spine:[-.05,0,0],shL:[-.35,-.15,.12],elL:[-1.15,0,0],shR:[-.35,.15,-.12],elR:[-1.15,0,0],hdL:[0,.9,0],hdR:[0,-.9,0],fL:.5,fR:.5});
POSES.chainedSleep=(t)=>{ const P=POSES.chained(t); P.head=[.62+Math.sin(t*.9)*.02,.1,.18]; P.spine=[.18,0,0]; return P; };
POSES.eatFruit=(t)=>({shR:[-.9,.34,-.12],elR:[-2.1,0,0],hdR:[.3,-1.1,0],head:[.12,0,0],fR:.85});
POSES.holdFruit=(t)=>({shR:[-.85,.1,-.1],elR:[-1.2,0,0],hdR:[0,-1.3,0],head:[.25,0,0],fR:.85});
