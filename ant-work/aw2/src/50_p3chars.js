/* ================================================================
   MARS SHIFT PART 3 — characters and pieces: blocky people (after XXX5
   turns the Earth into blocks), the rat, Jeff the dog, XXX5 itself,
   and pixel-art block textures.
   ================================================================ */
/* ---------- Part 3 sounds, music and voices ---------- */
Object.assign(SFX,{
  ring:()=>{ for(let i=0;i<2;i++){ fm(1320,.12,2,1.5,.06,i*.2); fm(1760,.12,2,1.5,.05,i*.2+.07); } },
  clank:()=>{ fm(420,.8,2.76,4,.12); fm(1130,.6,3.1,3,.06,.01); noise(.08,.3,0,3000,'bandpass',D(),1.5); },
  metalBite:()=>{ noise(.06,.35,0,2400,'bandpass',D(),2); fm(2200,.2,3.3,3,.05,.01); noise(.2,.1,.05,5000,'highpass',D()); },
  crunch:()=>{ const d=D(); for(let i=0;i<5;i++) noise(.06,.3,i*.06,900+Math.random()*1800,'bandpass',d,1.2); noise(.3,.3,0,300,'lowpass',d,.7,BROWN_BUF); tone(90,.4,'sine',.3,0,40,d); },
  xxxRoar:()=>{ tone(55,2.4,'sawtooth',.16,0,38,sfxBus,.2,['lowpass',500]); tone(82,2.2,'square',.07,.1,60,sfxBus,.3,['lowpass',700]); noise(2.4,.35,0,600,'lowpass',sfxBus,2,BROWN_BUF,200,.3); fm(110,2.2,1.41,6,.07,.05); },
  blockGlitch:()=>{ for(let i=0;i<6;i++) tone(110+i*55,.05,'square',.04,i*.03,null,sfxBus,.002,['lowpass',2400]); noise(.2,.1,0,2000,'bandpass',sfxBus,3); },
  shipBoom:()=>{ tone(40,3.5,'sine',.9,0,22); noise(4,.9,0,500,'lowpass',sfxBus,.6,BROWN_BUF,80,.01); noise(1.2,.5,0,3000,'bandpass',sfxBus,.5); },
  jet:()=>noise(.2,.1,0,700,'bandpass',D(),.8,null,500,.03),
  bark:()=>{ /* a REAL recorded dog (4 different woofs); the old beep-bark only if the files are missing */
    const k=['bark1','bark2','bark3','bark4'].filter(n=>SND.has(n)); if(k.length){ SND.play(pick(k),{vol:.9,rate:rand(.94,1.06),dest:D()}); return; }
    const d=D(); tone(520,.12,'sawtooth',.14,0,380,d,.005,['lowpass',1800]); noise(.1,.18,0,1400,'bandpass',d,1.5); tone(560,.1,'sawtooth',.1,.22,400,d,.005,['lowpass',1800]); noise(.08,.14,.22,1400,'bandpass',d,1.5); },
  whine:()=>{ const d=D(); tone(900,.5,'sine',.06,0,1300,d,.05); tone(1200,.4,'sine',.05,.45,800,d,.05); },
  nukeArm:()=>{ fm(880,.2,2,2,.08); fm(1320,.35,2,2,.08,.22); tone(220,.6,'square',.04,.1,null,sfxBus,.01,['lowpass',900]); },
  scream:()=>{ const d=D(); const f=700+Math.random()*500; tone(f,1.1,'sawtooth',.04,0,f*1.4,d,.05,['bandpass',1400]); noise(1,.04,0,1800,'bandpass',d,2); },
  beam:()=>{ tone(160,2.5,'sine',.08,0,320,sfxBus,.5); fm(320,2.5,1.5,3,.03,0); noise(2.5,.05,0,2600,'bandpass',sfxBus,4,null,5200,1); },
  suitOn:()=>{ noise(.4,.2,0,1600,'bandpass',sfxBus,1,null,600,.05); tone(300,.3,'square',.04,.3,600,sfxBus,.01,['lowpass',1200]); noise(.6,.15,.5,4000,'highpass',sfxBus,.7,null,1500,.3); },
  // a real, wet, sick cough: a sharp burst of breath shaped by the throat, then a raspy pull of air back in
  cough:(n=2)=>{ const d=D(); let t=0; for(let i=0;i<n;i++){ const f=520+Math.random()*180;
      noise(.17,.34,t,f,'bandpass',d,1.2,PINK_BUF,f*.6,.005); noise(.13,.15,t,f*2.6,'bandpass',d,2,PINK_BUF,f*1.5,.005); noise(.07,.22,t,240,'lowpass',d,.7,BROWN_BUF);
      tone(110+Math.random()*25,.07,'sawtooth',.035,t+.005,80,d,.004,['bandpass',f,1.5]); t+=.24+Math.random()*.12; }
    noise(.55,.045,t+.12,1700,'bandpass',d,3,PINK_BUF,2300,.22); },
  gooSuck:()=>{ const d=D(); noise(.6,.22,0,420,'lowpass',d,4,BROWN_BUF,160,.05); tone(150,.4,'sine',.08,.05,70,d,.03); },
  thud:()=>{ tone(70,.4,'sine',.5,0,40); noise(.25,.35,0,300,'lowpass',sfxBus,.7,BROWN_BUF); },
  ding2:()=>{ fm(1568,.5,3.01,1.2,.06); fm(2093,.6,3.01,1.2,.05,.1); }
});
SONGS.ship={bpm:66,chords:['D3 F3 Ab3 C4','Db3 F3 Ab3 C4','Bb2 Db3 F3 Ab3','C3 E3 G3 Bb3'],pad:{inst:'pad',vol:.05,cut:650},bass:{inst:'bass',vol:.12,pat:'0...............'},keys:{inst:'glass',vol:.025,pat:'2.......1.......'}};
SONGS.xxx5={bpm:150,chords:['C3 Eb3 G3','C3 Eb3 Ab3','Bb2 D3 F3','B2 D3 G3'],pad:{inst:'brass',vol:.07,cut:1600},bass:{inst:'synbass',vol:.18,pat:'0.0.0.0.0.0.0.0.'},drums:{k:'x...x...x...x.x.',s:'....x.......x...',h:'xxxxxxxxxxxxxxxx',vol:.6},lead:{inst:'square',vol:.035,mel:'C5 - Eb5 - G5 - - - Ab5 - G5 - Eb5 - D5 - C5 - Eb5 - G5 - C6 - B5 - - - G5 - - -'}};
SONGS.blocky={bpm:84,chords:['A2 C3 E3 G3','F2 A2 C3 E3','D3 F3 A3 C4','E3 G#3 B3 D4'],pad:{inst:'pad',vol:.035,cut:900},keys:{inst:'square',vol:.03,pat:'0.2.1.3.0.2.1.3.'},bass:{inst:'bass',vol:.12,pat:'0.......0.......'},drums:{k:'x.......x.......',h:'....x.......x...',vol:.2}};
SONGS.pluto={bpm:70,chords:['E3 G3 B3 D4','C3 E3 G3 B3','A2 C3 E3 G3','B2 D3 F#3 A3'],pad:{inst:'pad',vol:.04,cut:1400},keys:{inst:'bell',vol:.03,pat:'0...2...1...3...'},bass:{inst:'bass',vol:.11,pat:'0.......0.......'},lead:{inst:'glass',vol:.028,mel:'B4 - - - D5 - - - E5 - - - - - - - G5 - F#5 - E5 - D5 - B4 - - - - - - -'}};
SONGS.fly={bpm:124,swing:.08,chords:['G3 B3 D4','E3 G3 B3','C3 E3 G3','D3 F#3 A3'],keys:{inst:'pluck',vol:.055,pat:'0.1.2.1.0.1.2.1.'},bass:{inst:'synbass',vol:.14,pat:'0.0...0.0.0...0.'},drums:{k:'x...x...x...x...',s:'....x.......x...',h:'.x.x.x.x.x.x.x.x',vol:.4},lead:{inst:'lead',vol:.04,mel:'D5 - B4 - G4 - B4 - D5 - E5 - D5 - - - C5 - E5 - G5 - E5 - D5 - C5 - B4 - A4 -'}};
SONGS.burning={bpm:96,chords:['C3 Eb3 G3 Bb3','Ab2 C3 Eb3 G3','F2 Ab2 C3 Eb3','G2 B2 D3 F3'],pad:{inst:'brass',vol:.06,cut:1200},bass:{inst:'synbass',vol:.15,pat:'0...0.0.0...0.0.'},drums:{k:'x.....x.x.......',s:'....x.......x...',h:'x.x.x.x.x.x.x.x.',vol:.5}};
SONGS.sad={bpm:52,chords:['F3 A3 C4 E4','D3 F3 A3 C4','Bb2 D3 F3 A3','C3 E3 G3 Bb3'],pad:{inst:'pad',vol:.045,cut:900},keys:{inst:'epiano',vol:.05,pat:'0...2...1...3...'},lead:{inst:'glass',vol:.025,mel:'A4 - - - G4 - - - F4 - - - - - - - D4 - - - E4 - F4 - C4 - - - - - - -'}};
Object.assign(VOICE_PROFILES,{Kid:{g:'m',i:2,pitch:1.9,rate:1.12,babble:340},Alex:{g:'f',i:2,pitch:1.35,rate:1.0,babble:280},Bob:{g:'m',i:3,pitch:.9,rate:.98,babble:140},Jeff:{g:'m',i:0,pitch:1,rate:1,babble:400,sfx:()=>SFX.bark()}});
Object.assign(WHO_CLASS,{Alex:'alien',Kid:'',Bob:'bob',Jeff:''});

/* 16x16 pixel-art textures, drawn crisp (nearest filtering) */
const PIX={};
function pixTex(key,draw,w=16,h=16){ if(PIX[key]) return PIX[key]; const t=canvasTex(w,h,(x)=>draw(x,w,h),null,{nearest:true}); PIX[key]=t; return t; }
function pxNoise(x,w,h,base,vars,n=80){ x.fillStyle=base; x.fillRect(0,0,w,h); for(let i=0;i<n;i++){ x.fillStyle=pick(vars); x.fillRect(Math.random()*w|0,Math.random()*h|0,1,1); } }
const BLOCKTEX={
  grassTop:()=>pixTex('grassTop',(x,w,h)=>pxNoise(x,w,h,'#5a9a3a',['#4a8a2e','#6aaa44','#528f34','#7ab84e'],120)),
  grassSide:()=>pixTex('grassSide',(x,w,h)=>{ pxNoise(x,w,h,'#8a5a36',['#7a4e2e','#9a6a40','#6e4428'],90); x.fillStyle='#5a9a3a'; x.fillRect(0,0,w,4); for(let i=0;i<w;i++) if(Math.random()<.5){ x.fillRect(i,4,1,1+(Math.random()*2|0)); } }),
  dirt:()=>pixTex('dirt',(x,w,h)=>pxNoise(x,w,h,'#8a5a36',['#7a4e2e','#9a6a40','#6e4428'],90)),
  stone:()=>pixTex('stone',(x,w,h)=>pxNoise(x,w,h,'#8a8a8a',['#7a7a7a','#9a9a9a','#6e6e6e','#a4a4a4'],110)),
  road:()=>pixTex('road',(x,w,h)=>pxNoise(x,w,h,'#3a3a3e',['#333337','#44444a','#2e2e32'],100)),
  plank:()=>pixTex('plank',(x,w,h)=>{ pxNoise(x,w,h,'#b88a54',['#a87a48','#c49a60','#9e7040'],70); x.fillStyle='#7a5430'; for(let j=3;j<h;j+=4) x.fillRect(0,j,w,1); x.fillRect(5,0,1,4); x.fillRect(11,4,1,4); x.fillRect(3,8,1,4); x.fillRect(12,12,1,4); }),
  brick:()=>pixTex('brick',(x,w,h)=>{ x.fillStyle='#b8b0a4'; x.fillRect(0,0,w,h); for(let j=0;j<4;j++) for(let i=0;i<2;i++){ x.fillStyle=pick(['#a8483a','#b85444','#9c4034']); x.fillRect(i*8+(j%2?4:0)-8*(i*8+(j%2?4:0)>=16),j*4,7,3); x.fillRect(((i*8+(j%2?4:0))%16),j*4,7,3); } }),
  whiteWall:()=>pixTex('whiteWall',(x,w,h)=>pxNoise(x,w,h,'#e8e4dc',['#dcd8d0','#f0ece4','#d4d0c8'],50)),
  roof:()=>pixTex('roof',(x,w,h)=>{ pxNoise(x,w,h,'#5a3a34',['#4e322c','#66423a'],60); x.fillStyle='#3e2a24'; for(let j=0;j<h;j+=4) x.fillRect(0,j,w,1); }),
  glass:()=>pixTex('glass',(x,w,h)=>{ x.fillStyle='#9ad4ec'; x.fillRect(0,0,w,h); x.fillStyle='#d8f4ff'; x.fillRect(2,2,2,5); x.fillRect(5,2,1,3); x.fillStyle='#e8e8e8'; x.fillRect(0,0,w,1); x.fillRect(0,h-1,w,1); x.fillRect(0,0,1,h); x.fillRect(w-1,0,1,h); }),
  leaves:()=>pixTex('leaves',(x,w,h)=>pxNoise(x,w,h,'#3a7a2a',['#2e6a22','#4a8a34','#2a5e1e','#56963e'],130)),
  log:()=>pixTex('log',(x,w,h)=>{ pxNoise(x,w,h,'#6a4a2a',['#5a3e22','#7a5632'],60); x.fillStyle='#4a321c'; for(let i=1;i<w;i+=3) x.fillRect(i,0,1,h); }),
  door:()=>pixTex('door',(x,w,h)=>{ pxNoise(x,w,h,'#8a5a30',['#7a4e28','#9a6a3a'],40); x.fillStyle='#5a3a1e'; x.fillRect(0,0,w,1); x.fillRect(0,0,1,h); x.fillRect(w-1,0,1,h); x.fillRect(0,7,w,1); x.fillStyle='#d8c040'; x.fillRect(12,8,2,2); }),
  purple:()=>pixTex('purpleX',(x,w,h)=>{ pxNoise(x,w,h,'#1a0a24',['#24102e','#140818','#2e1238'],90); x.fillStyle='#b84aff'; for(let i=0;i<5;i++){ let px=Math.random()*w|0, py=Math.random()*h|0; for(let k=0;k<6;k++){ x.fillRect(px,py,1,1); px+=Math.random()<.5?1:0; py+=Math.random()<.5?1:-1; } } }),
  fire:()=>pixTex('fire',(x,w,h)=>{ x.clearRect(0,0,w,h); for(let i=0;i<w;i++){ const hh=4+Math.random()*10|0; for(let j=0;j<hh;j++){ x.fillStyle=j<2?'#ff4a1a':j<5?'#ff9a2a':'#ffe066'; x.fillRect(i,h-1-j,1,1); } } })
};
function blockMat(key,o={}){ const t=BLOCKTEX[key](); return new THREE.MeshStandardMaterial(Object.assign({map:t,roughness:.95},o)); }
const _U1=new THREE.BoxGeometry(1,1,1);
/* many cubes of one material -> one InstancedMesh */
class VoxBatch{
  constructor(material){ this.m=material; this.list=[]; }
  add(x,y,z,sx=1,sy=1,sz=1,ry=0){ this.list.push([x,y,z,sx,sy,sz,ry]); return this; }
  build(scene,shadow=true){ if(!this.list.length) return null; const im=new THREE.InstancedMesh(_U1,this.m,this.list.length); const o=new THREE.Object3D();
    this.list.forEach((v,i)=>{ o.position.set(v[0],v[1],v[2]); o.scale.set(v[3],v[4],v[5]); o.rotation.set(0,v[6],0); o.updateMatrix(); im.setMatrixAt(i,o.matrix); });
    im.castShadow=shadow; im.receiveShadow=true; scene.add(im); return im; }
}
/* grass cube material with a grass top and dirt sides */
function grassBlockMats(){ const side=blockMat('grassSide'), top=blockMat('grassTop'), bot=blockMat('dirt'); return [side,side,top,bot,side,side]; }

/* ---------- blocky people ---------- */
const FOLK=[];
function blockFaceTex(o){ return canvasTex(8,8,(x)=>{ x.fillStyle=o.skinHex; x.fillRect(0,0,8,8); x.fillStyle=o.hairHex; x.fillRect(0,0,8,2); x.fillRect(0,2,1,1); x.fillRect(7,2,1,1);
  x.fillStyle='#ffffff'; x.fillRect(1,3,2,1); x.fillRect(5,3,2,1); x.fillStyle=o.eyeHex||'#3a2a8a'; x.fillRect(2,3,1,1); x.fillRect(5,3,1,1);
  x.fillStyle=o.mouthHex||'#94584a'; x.fillRect(3,5,2,1); if(o.beard){ x.fillStyle=o.hairHex; x.fillRect(1,5,1,2); x.fillRect(6,5,1,2); x.fillRect(2,6,4,1); } },null,{nearest:true}); }
function flatTex(hex,shade=.85,n=40){ return canvasTex(8,8,(x)=>{ x.fillStyle=hex; x.fillRect(0,0,8,8); const c=new THREE.Color().setHex(parseInt(hex.slice(1),16));  // plain sRGB numbers (col() is linear and made the speckles dark blotches)
 for(let i=0;i<n;i++){ const k=rand(shade,1.1); x.fillStyle=`rgb(${Math.min(255,c.r*255*k)|0},${Math.min(255,c.g*255*k)|0},${Math.min(255,c.b*255*k)|0})`; x.fillRect(Math.random()*8|0,Math.random()*8|0,1,1); } },null,{nearest:true}); }
function makeBlockPerson(o={}){
  const opt=Object.assign({skin:0xd8a880,shirt:0x3a7ad8,pants:0x2a3a6a,hair:0x4a2e1a,shoes:0x2a2a2a,name:'?',voice:'Jim',beard:false},o);
  const hx=h=>'#'+new THREE.Color(h).getHexString();  // the real sRGB colour (col() is linear and made everyone too dark)
  const g=new THREE.Group(); g.name=opt.name;
  const S=new THREE.MeshStandardMaterial({map:flatTex(hx(opt.skin),.97,6),roughness:.85});
  const F=new THREE.MeshStandardMaterial({map:blockFaceTex({skinHex:hx(opt.skin),hairHex:hx(opt.hair),beard:opt.beard}),roughness:.85});
  const Hm=new THREE.MeshStandardMaterial({map:flatTex(hx(opt.hair),.9,14),roughness:.9});
  const T=new THREE.MeshStandardMaterial({map:flatTex(hx(opt.shirt),.94,12),roughness:.9});
  const P=new THREE.MeshStandardMaterial({map:flatTex(hx(opt.pants),.94,12),roughness:.9});
  const Sh=mat(opt.shoes,{roughness:.8});
  const box=(w,h,d,m)=>{ const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); b.castShadow=true; b.receiveShadow=true; return b; };
  const hips=new THREE.Group(); hips.position.y=.72; g.add(hips);
  const torso=box(.44,.66,.24,T); torso.position.y=.33; hips.add(torso);
  const headJ=new THREE.Group(); headJ.position.y=.66; hips.add(headJ);
  const head=box(.44,.44,.44,[S,S,Hm,S,F,Hm]); head.position.y=.22; headJ.add(head);
  const hairBack=box(.46,.2,.46,Hm); hairBack.position.set(0,.36,-.01); headJ.add(hairBack);
  const limb=(x,y,m,m2,len=.66)=>{ const j=new THREE.Group(); j.position.set(x,y,0); const l=box(.2,len,.22,m); l.position.y=-len/2; j.add(l); if(m2){ const e=box(.21,.14,.23,m2); e.position.y=-len+.07; j.add(e); } return j; };
  const armL=limb(.32,.62,T,S,.62), armR=limb(-.32,.62,T,S,.62);
  hips.add(armL); hips.add(armR);
  const legL=limb(.11,0,P,Sh,.72), legR=limb(-.11,0,P,Sh,.72); hips.add(legL); hips.add(legR);
  const holdR=new THREE.Group(); holdR.position.y=-.66; armR.add(holdR);
  g.userData={folk:true,holdR,name:opt.name,voice:opt.voice,head:headJ,parts:{hips,torso,headJ,armL,armR,legL,legR},
    A:{talk:false,mood:'neutral',moodK:{},pose:null,phase:Math.random()*10,speed:0,lastPos:new THREE.Vector3(),walkPhase:0,look:null,mode:null,path:null}};
  FOLK.push(g); return g;
}
function animateBlockPerson(p,dt,t){
  const U=p.userData, A=U.A, J=U.parts; if(!p.visible) return;
  p.getWorldPosition(_hw); const moved=_hw.distanceTo(A.lastPos); A.lastPos.copy(_hw);
  const sp=dt>0?Math.min(8,moved/dt):0; A.speed=damp(A.speed,sp>.05?sp:0,10,dt);
  const wk=Math.min(1,A.speed/1.2); A.walkPhase+=dt*A.speed*3.2;
  const s=Math.sin(A.walkPhase)*.7*wk;
  J.legL.rotation.x=s; J.legR.rotation.x=-s; J.armL.rotation.x=-s*.8; J.armR.rotation.x=s*.8; J.armL.rotation.z=.05; J.armR.rotation.z=-.05;
  J.hips.position.y=.72+Math.abs(Math.cos(A.walkPhase))*.04*wk;
  if(A.mode==='panic'){ J.armL.rotation.z=2.6+Math.sin(t*14+A.phase)*.4; J.armR.rotation.z=-2.6-Math.cos(t*13+A.phase)*.4; J.armL.rotation.x=J.armR.rotation.x=0; }
  if(A.mode==='lifted'){ J.armL.rotation.z=2.2+Math.sin(t*18+A.phase)*.8; J.armR.rotation.z=-2.2-Math.sin(t*17+A.phase)*.8; J.legL.rotation.x=Math.sin(t*16)*.8; J.legR.rotation.x=-Math.sin(t*16)*.8; }
  if(A.pose==='point'||A.pose==='holdOut'){ J.armR.rotation.x=-1.45; J.armR.rotation.z=-.05; }
  if(A.pose==='talk'&&A.talk){ J.armR.rotation.x=-.5+Math.sin(t*3+A.phase)*.25; J.armL.rotation.x=-.3+Math.cos(t*2.6)*.15; }
  if(A.pose==='hips'){ J.armL.rotation.z=.5; J.armR.rotation.z=-.5; }
  if(A.mode==='wave'){ J.armR.rotation.z=-2.6+Math.sin(t*10)*.4; }
  if(A.mode==='down'){ p.rotation.z=damp(p.rotation.z,Math.PI/2,6,dt); }
  if(A.mode==='kneel'){ J.hips.position.y=.38; J.legL.rotation.x=-1.45; J.legR.rotation.x=.2; J.armL.rotation.x=-.35; J.armR.rotation.x=-.6-(A.talk?Math.sin(t*3)*.15:0); }
  if(A.mode==='lie'){ J.hips.position.y=.72; J.legL.rotation.x=J.legR.rotation.x=0; J.armL.rotation.x=J.armR.rotation.x=0; J.armL.rotation.z=.12; J.armR.rotation.z=-.12; J.torso.scale.y=1+Math.sin(t*1.6)*.015; }
  // talking: little head bobs; looking at the player
  const talk=A.talk?Math.sin(t*14)*.06:0;
  let yaw=0; if(A.look==='player'){ const d=camera.position.clone().sub(_hw); yaw=clamp(angDiff(p.rotation.y,Math.atan2(d.x,d.z)),-.9,.9); }
  J.headJ.rotation.y=damp(J.headJ.rotation.y,yaw,6,dt); J.headJ.rotation.x=talk+Math.sin(t*1.3+A.phase)*.02;
  // simple waypoint walking
  if(A.path){ const P=A.path; const tg=P.pts[P.i]; const dx=tg.x-p.position.x, dz=tg.z-p.position.z, d=Math.hypot(dx,dz), st=P.speed*dt;
    if(d<=st){ p.position.x=tg.x; p.position.z=tg.z; P.i++; if(P.i>=P.pts.length){ A.path=null; P.res&&P.res(); } } else { p.position.x+=dx/d*st; p.position.z+=dz/d*st; p.rotation.y=angLerp(p.rotation.y,Math.atan2(dx,dz),Math.min(1,dt*8));
      const px=p.position.x-PLAYER.pos.x, pz=p.position.z-PLAYER.pos.z, pd=Math.hypot(px,pz); if(pd<.75&&pd>1e-4&&A.mode!=='lifted'){ p.position.x=PLAYER.pos.x+px/pd*.75; p.position.z=PLAYER.pos.z+pz/pd*.75; } } }
}
function folkWalk(p,pts,speed=1.6){ return new Promise(res=>{ p.userData.A.path={pts,i:0,speed,res}; }); }
function updateFolk(dt,t){ for(const p of FOLK){ if(!p.parent||!p.visible) continue; if(LV&&p.userData.level&&p.userData.level!==LV.name) continue; animateBlockPerson(p,dt,t); } }

/* ---------- the rat ---------- */
function makeRat(){
  const g=new THREE.Group();
  const fur=new THREE.MeshStandardMaterial({color:col(0x6a625a),roughness:.95}), pink=mat(0xe8a0a0,{roughness:.6}), eye=mat(0x050505,{roughness:.1,metalness:.3});
  const body=mesh(GC('ratBody',()=>{ const q=new THREE.SphereGeometry(.1,20,14); q.scale(1,.9,1.7); return q; }),fur,0,.09,0); g.add(body);
  const headJ=new THREE.Group(); headJ.position.set(0,.11,.15); g.add(headJ);
  headJ.add(mesh(GC('ratHead',()=>{ const q=new THREE.ConeGeometry(.07,.16,16); q.rotateX(Math.PI/2); q.translate(0,0,.06); return q; }),fur,0,0,0));
  headJ.add(sph(.012,pink,0,0,.14,8,6,false));
  for(const sd of [-1,1]){ headJ.add(sph(.012,eye,sd*.035,.025,.06,8,6,false)); const ear=mesh(GC('ratEar',()=>new THREE.CircleGeometry(.03,16)),pink,sd*.045,.055,.01,false); ear.rotation.y=sd*.5; ear.material.side=THREE.DoubleSide; headJ.add(ear);
    for(let k=0;k<3;k++){ const w=mesh(GC('whisk',()=>{ const c=new THREE.CylinderGeometry(.0012,.0012,.09,3); c.rotateZ(Math.PI/2); return c; }),mat(0xeeeeee),sd*.05,-.005+k*.008,.12,false); w.rotation.y=sd*(.3+k*.15); headJ.add(w); } }
  const tailPts=[]; for(let i=0;i<12;i++) tailPts.push(V3(0,.06+Math.sin(i*.5)*.01,-.16-i*.035));
  const tail=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tailPts),24,.008,6),pink); g.add(tail);
  const legs=[]; for(const [x,z] of [[.06,.1],[-.06,.1],[.07,-.1],[-.07,-.1]]){ const l=cyl(.012,.014,.07,pink,x,.035,z,6); g.add(l); legs.push(l); }
  g.userData={headJ,tail,legs,chew:0,phase:Math.random()*10,head:headJ};
  return g;
}
function animateRat(r,t,moving){ const U=r.userData; U.headJ.rotation.x=U.chew?Math.sin(t*22)*.18:Math.sin(t*2+U.phase)*.08; U.headJ.rotation.y=Math.sin(t*1.3)*.2; U.tail.rotation.y=Math.sin(t*3)*.25;
  U.legs.forEach((l,i)=>{ l.position.y=.035+(moving?Math.max(0,Math.sin(t*20+i*1.6))*.02:0); }); }

/* Jeff the dog: see 50b_dog.js */

/* ---------- XXX5: a growing mass of dark purple blocks with glowing eyes ---------- */
function makeXXX5(heads=1){
  const g=new THREE.Group();
  const skin=new THREE.MeshStandardMaterial({map:BLOCKTEX.purple(),roughness:.7,emissive:col(0x9a3aff),emissiveMap:BLOCKTEX.purple(),emissiveIntensity:.6});
  const eyeM=basicGlow(0xd86aff,6), mouthM=basicGlow(0x2a0038,1);
  const core=new THREE.Group(); g.add(core);
  const VB=new VoxBatch(skin); const r=RNG(55);
  for(let i=0;i<(heads>1?90:26);i++){ const s=.6+r()*1.4; const a=r()*6.28, rr=r()*(heads>1?3.2:1.2); VB.add(Math.cos(a)*rr,(r()-.5)*(heads>1?3:1.4),Math.sin(a)*rr-(heads>1?1:0),s,s,s,r()*3); }
  const body=VB.build(core,false);
  const headObjs=[];
  const mkHead=(x,y,z,s)=>{ const H=new THREE.Group(); H.position.set(x,y,z); core.add(H);
    const top=new THREE.Mesh(_U1,skin); top.scale.set(2*s,1.3*s,2*s); top.position.y=.5*s; H.add(top);
    const jaw=new THREE.Group(); jaw.position.set(0,-.2*s,.95*s); H.add(jaw); const jm=new THREE.Mesh(_U1,skin); jm.scale.set(1.9*s,.6*s,1.9*s); jm.position.set(0,-.3*s,-.95*s); jaw.add(jm);
    const mouth=new THREE.Mesh(_U1,mouthM); mouth.scale.set(1.6*s,.5*s,.1); mouth.position.set(0,-.1*s,1.0*s); H.add(mouth);
    const eyes=[]; for(const sd of [-1,1]){ const e=new THREE.Mesh(_U1,eyeM); e.scale.set(.45*s,.22*s,.06); e.position.set(sd*.5*s,.55*s,1.01*s); H.add(e); eyes.push(e); }
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.3*s,3.2*s,1,24,1,true),new THREE.MeshBasicMaterial({color:col(0xc86aff),transparent:true,opacity:.22,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
    beam.geometry.translate(0,-.5,0); beam.position.set(0,.55*s,1.05*s); beam.visible=false; H.add(beam);
    headObjs.push({H,jaw,eyes,beam,s}); return H; };
  if(heads===1) mkHead(0,1.2,0,1); else { mkHead(0,4.2,1.2,1.5); mkHead(-4.4,2.4,.4,1.2); mkHead(4.4,2.4,.4,1.2); }
  // tentacles: chains of cubes
  const tents=[]; const nT=heads>1?9:4;
  for(let i=0;i<nT;i++){ const chain=[]; const base=V3(Math.cos(i/nT*6.28)*(heads>1?2.5:.8),-.4,Math.sin(i/nT*6.28)*(heads>1?2.5:.8)-(heads>1?1:0));
    for(let k=0;k<(heads>1?14:8);k++){ const c=new THREE.Mesh(_U1,skin); const s=(heads>1?1.1:.5)*(1-k/(heads>1?16:10)); c.scale.setScalar(s); core.add(c); chain.push(c); }
    tents.push({base,chain,ph:i*1.3}); }
  g.userData={core,heads:headObjs,tents,skin,eyeM,phase:0,big:heads>1,head:headObjs[0].H,noCamBlock:true};
  return g;
}
function animateXXX5(x,t,o={}){
  const U=x.userData;
  U.core.rotation.y=Math.sin(t*.3)*.15; U.core.position.y=Math.sin(t*.8)*.2;
  for(const h of U.heads){ h.jaw.rotation.x=(o.jaw!=null?o.jaw:(.15+Math.max(0,Math.sin(t*1.7))*.35)); h.H.rotation.y=Math.sin(t*.6+h.H.position.x)*.25; h.beam.visible=!!o.beam; if(o.beam){ h.beam.scale.set(1,o.beamLen||30,1); h.beam.material.opacity=.16+Math.sin(t*9)*.05; } }
  U.eyeM.color.setRGB(1,.45,1).multiplyScalar(4+Math.sin(t*5)*1.5+(o.rage?4:0));
  for(const tn of U.tents){ let p=tn.base.clone(); const step=U.big?1:.45; tn.chain.forEach((c,k)=>{ const a=t*1.6+tn.ph+k*.35; p=p.clone().add(V3(Math.sin(a)*step*.6,-step*.7+Math.cos(a*.7)*step*.3,Math.cos(a*1.1)*step*.6)); c.position.copy(p); c.rotation.set(a*.3,a*.2,0); }); }
}

function makeBlockJim(suit){ return makeBlockPerson({name:'Jim',voice:'Jim',skin:0xecc0a0,shirt:suit?0xf0f0ec:0xd9a441,pants:suit?0xf0f0ec:0x3a4a6a,hair:0x7a4a22,beard:true,shoes:suit?0x9aa0a8:0x6b4a2a}); }

