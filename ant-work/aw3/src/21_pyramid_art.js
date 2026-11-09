/* ================================================================
   PYRAMID ART — old flat wall paintings (Egyptian style: profile
   figures, bands of glyphs), faded, flaking and dusty. Painted onto a
   transparent layer that sits on the real plaster texture.
   ================================================================ */
const PAINT={ochre:'#9c6a36',red:'#7a3424',black:'#2b2119',teal:'#4c6e66',white:'#d6c6a6',purple:'#5e4680',pink:'#a8786a',gold:'#9c823e'};
function _fig(x,c,base,s,o={}){
  // a person in profile, striding, Egyptian style (head side-on, shoulders front-on)
  const h=70*s, col_=o.color||PAINT.red;
  c.save(); c.translate(x,base); if(o.flip) c.scale(-1,1);
  c.fillStyle=col_; c.strokeStyle=col_; c.lineCap='round'; c.lineJoin='round';
  // legs
  c.lineWidth=7*s; c.beginPath(); c.moveTo(0,-h*.45); c.lineTo(-h*.16,0); c.moveTo(0,-h*.45); c.lineTo(h*.16,0); c.stroke();
  // kilt
  c.fillStyle=PAINT.white; c.beginPath(); c.moveTo(-h*.1,-h*.55); c.lineTo(h*.12,-h*.55); c.lineTo(h*.16,-h*.36); c.lineTo(-h*.12,-h*.36); c.closePath(); c.fill();
  // body
  c.fillStyle=col_; c.beginPath(); c.moveTo(-h*.13,-h*.84); c.lineTo(h*.13,-h*.84); c.lineTo(h*.08,-h*.55); c.lineTo(-h*.07,-h*.55); c.closePath(); c.fill();
  // arms
  c.lineWidth=5*s; c.beginPath();
  if(o.pose==='carry'){ c.moveTo(h*.1,-h*.8); c.lineTo(h*.22,-h*.92); c.lineTo(h*.18,-h*1.04); c.moveTo(-h*.1,-h*.8); c.lineTo(-h*.02,-h*.95); c.lineTo(h*.04,-h*1.04); }
  else if(o.pose==='up'){ c.moveTo(h*.1,-h*.8); c.lineTo(h*.24,-h*1.02); c.moveTo(-h*.1,-h*.8); c.lineTo(-h*.06,-h*1.06); }
  else if(o.pose==='offer'){ c.moveTo(h*.1,-h*.8); c.lineTo(h*.3,-h*.78); c.moveTo(-h*.1,-h*.8); c.lineTo(h*.24,-h*.72); }
  else if(o.pose==='eat'){ c.moveTo(h*.1,-h*.8); c.lineTo(h*.2,-h*.86); c.lineTo(h*.1,-h*.93); c.moveTo(-h*.1,-h*.8); c.lineTo(-h*.16,-h*.6); }
  else { c.moveTo(h*.1,-h*.8); c.lineTo(h*.18,-h*.58); c.moveTo(-h*.1,-h*.8); c.lineTo(-h*.16,-h*.6); }
  c.stroke();
  // head + hair (black wig) + eye
  c.fillStyle=o.skin||PAINT.red; c.beginPath(); c.ellipse(h*.02,-h*.93,h*.085,h*.1,0,0,7); c.fill();
  c.fillStyle=PAINT.black; c.beginPath(); c.ellipse(-h*.02,-h*.96,h*.09,h*.085,0,Math.PI*.55,Math.PI*2.05); c.fill();
  c.fillStyle=PAINT.white; c.beginPath(); c.ellipse(h*.065,-h*.94,h*.022,h*.012,0,0,7); c.fill(); c.fillStyle=PAINT.black; c.fillRect(h*.06,-h*.947,h*.014,h*.014);
  c.restore();
}
function _fallen(x,c,base,s){ c.save(); c.translate(x,base); c.rotate(-Math.PI/2); _fig(0,c,0,s,{}); c.restore(); }
function _ant(x,c,base,s,o={}){
  c.save(); c.translate(x,base); if(o.flip) c.scale(-1,1);
  const k=s; c.fillStyle=o.color||PAINT.black; c.strokeStyle=o.color||PAINT.black; c.lineCap='round';
  // legs (3 pairs, bent)
  c.lineWidth=6*k; for(let i=0;i<3;i++){ const lx=-20*k+i*30*k; c.beginPath(); c.moveTo(lx,-70*k); c.lineTo(lx-16*k+i*8*k,-108*k); c.lineTo(lx-30*k+i*14*k,0); c.stroke(); }
  // abdomen, waist, thorax, head
  c.beginPath(); c.ellipse(-95*k,-80*k,70*k,46*k,-.15,0,7); c.fill();
  c.beginPath(); c.ellipse(-18*k,-82*k,14*k,10*k,0,0,7); c.fill();
  c.beginPath(); c.ellipse(20*k,-86*k,38*k,22*k,.15,0,7); c.fill();
  c.beginPath(); c.ellipse(80*k,-100*k,30*k,26*k,.2,0,7); c.fill();
  // mandibles + antennae
  c.lineWidth=5*k; c.beginPath(); c.moveTo(104*k,-90*k); c.quadraticCurveTo(126*k,-84*k,118*k,-70*k); c.moveTo(100*k,-82*k); c.quadraticCurveTo(116*k,-70*k,104*k,-62*k); c.stroke();
  c.lineWidth=3.5*k; c.beginPath(); c.moveTo(86*k,-124*k); c.quadraticCurveTo(110*k,-170*k,140*k,-160*k); c.moveTo(78*k,-124*k); c.quadraticCurveTo(90*k,-176*k,124*k,-182*k); c.stroke();
  // eye
  c.fillStyle=PAINT.ochre; c.beginPath(); c.ellipse(88*k,-106*k,7*k,6*k,0,0,7); c.fill();
  c.restore();
}
function _pigKing(x,c,base,s){
  c.save(); c.translate(x,base);
  const k=s;
  // throne (side view block chair)
  c.fillStyle=PAINT.ochre; c.fillRect(-120*k,-150*k,170*k,150*k); c.fillRect(-140*k,-330*k,40*k,330*k);
  c.fillStyle=PAINT.teal; for(let i=0;i<6;i++) c.fillRect(-112*k+i*26*k,-138*k,14*k,120*k);
  c.fillStyle=PAINT.black; c.fillRect(-120*k,-160*k,175*k,12*k);
  // body: huge belly
  c.fillStyle=PAINT.pink; c.beginPath(); c.ellipse(-20*k,-235*k,95*k,105*k,0,0,7); c.fill();
  // legs seated
  c.fillRect(-20*k,-175*k,120*k,46*k); c.fillRect(70*k,-175*k,40*k,175*k);
  c.fillStyle=PAINT.black; c.fillRect(64*k,-18*k,56*k,18*k);
  // armor plate + kilt band
  c.fillStyle=PAINT.gold; c.beginPath(); c.ellipse(-10*k,-300*k,70*k,46*k,0,Math.PI,Math.PI*2); c.fill(); c.fillRect(-80*k,-300*k,140*k,30*k);
  c.fillStyle=PAINT.teal; for(let i=0;i<7;i++) c.fillRect(-74*k+i*20*k,-296*k,10*k,22*k);
  // arm holding a leg of meat up
  c.fillStyle=PAINT.pink; c.save(); c.translate(40*k,-280*k); c.rotate(-.9); c.fillRect(0,-18*k,110*k,36*k); c.restore();
  c.fillStyle=PAINT.red; c.beginPath(); c.ellipse(125*k,-372*k,30*k,46*k,.5,0,7); c.fill(); c.fillStyle=PAINT.white; c.fillRect(96*k,-336*k,12*k,34*k);
  // pig head in profile
  c.fillStyle=PAINT.pink; c.beginPath(); c.ellipse(10*k,-385*k,62*k,55*k,0,0,7); c.fill();
  c.beginPath(); c.moveTo(50*k,-405*k); c.lineTo(108*k,-398*k); c.lineTo(110*k,-360*k); c.lineTo(52*k,-352*k); c.closePath(); c.fill();
  c.fillStyle=PAINT.red; c.fillRect(104*k,-398*k,9*k,38*k);
  c.fillStyle=PAINT.black; c.beginPath(); c.ellipse(52*k,-400*k,7*k,6*k,0,0,7); c.fill();
  c.fillStyle=PAINT.pink; c.beginPath(); c.moveTo(-20*k,-430*k); c.lineTo(-2*k,-470*k); c.lineTo(20*k,-432*k); c.closePath(); c.fill();
  // tusk + crown
  c.fillStyle=PAINT.white; c.beginPath(); c.moveTo(70*k,-352*k); c.lineTo(84*k,-372*k); c.lineTo(78*k,-350*k); c.fill();
  c.fillStyle=PAINT.gold; c.fillRect(-40*k,-448*k,80*k,18*k); for(let i=0;i<4;i++){ c.beginPath(); c.moveTo(-40*k+i*26*k,-448*k); c.lineTo(-27*k+i*26*k,-478*k); c.lineTo(-14*k+i*26*k,-448*k); c.fill(); }
  c.restore();
}
function _fruit(x,y,c,r){ const g=c.createRadialGradient(x,y,1,x,y,r*2.2); g.addColorStop(0,'rgba(220,170,255,.9)'); g.addColorStop(.35,'rgba(150,80,210,.6)'); g.addColorStop(1,'rgba(120,60,180,0)'); c.fillStyle=g; c.beginPath(); c.arc(x,y,r*2.2,0,7); c.fill();
  c.fillStyle=PAINT.purple; c.beginPath(); c.ellipse(x,y+r*.15,r*.8,r,0,0,7); c.fill(); c.beginPath(); c.ellipse(x,y-r*.6,r*.5,r*.55,0,0,7); c.fill(); }
function _glyphs(c,x,y,w,h,seed){ const rr=RNG(seed); c.save(); c.fillStyle=PAINT.black; c.strokeStyle=PAINT.black; c.lineWidth=3;
  for(let yy=y;yy<y+h-16;yy+=26){ for(let xx=x;xx<x+w-16;xx+=24){ const t=rr(); c.beginPath();
    if(t<.18){ c.ellipse(xx+8,yy+8,8,5,0,0,7); c.stroke(); c.fillRect(xx+6,yy+6,4,4); }        // eye
    else if(t<.34){ c.moveTo(xx,yy+14); c.lineTo(xx+16,yy+14); c.moveTo(xx+3,yy+14); c.quadraticCurveTo(xx+8,yy,xx+13,yy+14); c.stroke(); }   // bird-ish
    else if(t<.48){ for(let i=0;i<3;i++){ c.moveTo(xx+i*6,yy+2); c.lineTo(xx+i*6+3,yy+16); } c.stroke(); }                              // water
    else if(t<.6){ c.arc(xx+8,yy+8,7,0,7); c.stroke(); c.moveTo(xx+8,yy+1); c.lineTo(xx+8,yy+15); c.stroke(); }
    else if(t<.72){ c.fillRect(xx+2,yy+3,12,10); }
    else if(t<.84){ c.moveTo(xx,yy+16); c.lineTo(xx+8,yy); c.lineTo(xx+16,yy+16); c.stroke(); }
    else { c.ellipse(xx+8,yy+9,4,7,0,0,7); c.fill(); } } } c.restore(); }
/* age it: chipped, faded, cracked, dust settled on the bottom and top */
function _age(c,w,h,seed){
  const rr=RNG(seed);
  // flaked-off paint: lots of chips, big bare patches, cracks
  c.globalCompositeOperation='destination-out';
  for(let i=0;i<5200;i++){ c.fillStyle='rgba(0,0,0,'+(rr()*.7).toFixed(2)+')'; const s=rr()*6+1; c.fillRect(rr()*w,rr()*h,s,s*(.4+rr())); }
  for(let i=0;i<70;i++){ c.fillStyle='rgba(0,0,0,'+(.55+rr()*.45).toFixed(2)+')'; c.beginPath(); const x=rr()*w,y=rr()*h; c.moveTo(x,y); for(let k=0;k<7;k++) c.lineTo(x+(rr()-.5)*90,y+(rr()-.5)*50); c.fill(); }
  c.strokeStyle='rgba(0,0,0,.9)'; for(let i=0;i<18;i++){ c.lineWidth=1+rr()*2.5; let x=rr()*w, y=rr()*h; c.beginPath(); c.moveTo(x,y); for(let j=0;j<10;j++){ x+=(rr()-.5)*70; y+=rr()*34; c.lineTo(x,y); } c.stroke(); }
  // the bottom third worn away by sand blowing in
  const wear=c.createLinearGradient(0,h*.6,0,h); wear.addColorStop(0,'rgba(0,0,0,0)'); wear.addColorStop(1,'rgba(0,0,0,.65)'); c.fillStyle=wear; c.fillRect(0,h*.6,w,h*.4);
  c.globalCompositeOperation='source-over';
  // grime and soot (old torches), then a pale film of dust over everything
  for(let i=0;i<45;i++){ c.fillStyle='rgba(30,20,12,'+(rr()*.22).toFixed(2)+')'; c.beginPath(); c.ellipse(rr()*w,rr()*h*.5,rr()*120+30,rr()*40+10,0,0,7); c.fill(); }
  const g=c.createLinearGradient(0,0,0,h); g.addColorStop(0,'rgba(196,170,128,.4)'); g.addColorStop(.2,'rgba(196,170,128,.16)'); g.addColorStop(.7,'rgba(196,170,128,.2)'); g.addColorStop(1,'rgba(200,176,132,.6)'); c.fillStyle=g; c.fillRect(0,0,w,h);
  for(let i=0;i<110;i++){ c.fillStyle='rgba(196,172,130,'+(rr()*.3).toFixed(2)+')'; c.beginPath(); c.ellipse(rr()*w,rr()*h,rr()*80+10,rr()*16+3,0,0,7); c.fill(); }
}
/* the four paintings, each 1024 x 448 (about 6 m x 2.6 m on the wall) */
const PAINTINGS={
  bugs(c,w,h){ // tiny people working under giant ants
    c.fillStyle=PAINT.red; c.fillRect(0,18,w,10); c.fillStyle=PAINT.black; c.fillRect(0,32,w,6); c.fillRect(0,h-34,w,6); c.fillStyle=PAINT.ochre; c.fillRect(0,h-26,w,12);
    _glyphs(c,20,48,90,h-110,11); _glyphs(c,w-110,48,90,h-110,12);
    _ant(330,c,h-60,1.25,{color:PAINT.black}); _ant(800,c,h-60,1.1,{color:'#3a1a10',flip:true});
    for(let i=0;i<9;i++) _fig(150+i*72+(i>4?60:0),c,h-60,.62,{pose:i%3===0?'carry':i%3===1?'up':'walk',color:PAINT.red});
    for(let i=0;i<5;i++){ c.fillStyle=PAINT.ochre; c.fillRect(160+i*72,h-128,22,16); }   // loads on their heads
  },
  king(c,w,h){ // the fat pig king on his throne, tiny people bowing with fruit
    c.fillStyle=PAINT.teal; c.fillRect(0,16,w,10); c.fillStyle=PAINT.black; c.fillRect(0,30,w,6); c.fillRect(0,h-34,w,6); c.fillStyle=PAINT.red; c.fillRect(0,h-26,w,12);
    _glyphs(c,18,48,110,h-110,21);
    _pigKing(330,c,h-40,.84);
    for(let i=0;i<5;i++){ const x=580+i*86; _fig(x,c,h-60,.6,{flip:true,pose:'offer',color:PAINT.red}); _fruit(x-30,h-106,c,8); }
    _glyphs(c,w-120,48,100,h-110,22);
  },
  fruit(c,w,h){ // people eat the glowing fruit... and fall down. Pig guards drag them away
    c.fillStyle=PAINT.red; c.fillRect(0,18,w,10); c.fillStyle=PAINT.black; c.fillRect(0,32,w,6); c.fillRect(0,h-34,w,6);
    // the table with two fruits
    c.fillStyle=PAINT.ochre; c.fillRect(120,h-130,150,18); c.fillRect(140,h-112,20,52); c.fillRect(230,h-112,20,52);
    _fruit(170,h-150,c,12); _fruit(220,h-150,c,12);
    _fig(80,c,h-60,.62,{pose:'eat'}); _fig(320,c,h-60,.62,{pose:'eat',flip:true});
    _fallen(420,c,h-48,.62); _fallen(480,c,h-48,.62);
    // a pig guard dragging a sleeper by a chain
    c.save(); c.translate(700,h-60); c.fillStyle=PAINT.pink; c.beginPath(); c.ellipse(0,-90,40,50,0,0,7); c.fill(); c.fillRect(-14,-46,12,46); c.fillRect(8,-46,12,46);
    c.beginPath(); c.ellipse(10,-160,30,26,0,0,7); c.fill(); c.fillRect(30,-170,26,18); c.fillStyle=PAINT.black; c.beginPath(); c.ellipse(26,-166,4,4,0,0,7); c.fill(); c.fillStyle=PAINT.gold; c.fillRect(-36,-110,76,24); c.restore();
    c.strokeStyle=PAINT.black; c.lineWidth=3; c.setLineDash([6,4]); c.beginPath(); c.moveTo(680,h-150); c.quadraticCurveTo(620,h-90,560,h-62); c.stroke(); c.setLineDash([]);
    _fallen(540,c,h-48,.62);
    _glyphs(c,w-170,48,150,h-110,31);
  },
  chains(c,w,h){ // a long line of tiny people in chains, walking to the throne
    c.fillStyle=PAINT.teal; c.fillRect(0,18,w,10); c.fillStyle=PAINT.black; c.fillRect(0,32,w,6); c.fillRect(0,h-34,w,6); c.fillStyle=PAINT.ochre; c.fillRect(0,h-26,w,12);
    for(let i=0;i<11;i++) _fig(90+i*76,c,h-60,.6,{pose:'walk',color:i%2?PAINT.red:'#9a4a2a'});
    c.strokeStyle=PAINT.black; c.lineWidth=3; c.setLineDash([5,4]); c.beginPath(); c.moveTo(70,h-100); c.lineTo(90+10*76+20,h-100); c.stroke(); c.setLineDash([]);
    _glyphs(c,24,48,w-48,110,41);
  }
};
function paintingTexture(name){
  return canvasTex(1024,448,(c,w,h)=>{ c.clearRect(0,0,w,h); c.globalAlpha=.74; PAINTINGS[name](c,w,h); c.globalAlpha=1; _age(c,w,h,name.length*97+7); });
}
/* ---------- bones ---------- */
function boneMat(){ if(!boneMat.m){ boneMat.m=pbrMat('clay_plaster',.25,{opts:{roughness:.85}}); boneMat.m.color=col(0xe2d4b4); } return boneMat.m; }
function makeLongBone(len=.42,r=.018){
  return mesh(lathe('bone'+len+'_'+r,[[0,0],[r*1.9,.004],[r*2.1,len*.05],[r*1.1,len*.14],[r*.95,len*.5],[r*1.1,len*.86],[r*2,len*.95],[r*1.7,len*.995],[0,len]],12),boneMat(),0,0,0);
}
function makeSkull(){
  const g=new THREE.Group(), m=boneMat(), dark=new THREE.MeshStandardMaterial({color:col(0x120c08),roughness:1});
  const cr=mesh(GC('skullCr',()=>new THREE.SphereGeometry(.085,20,14)),m,0,.08,-.01); cr.scale.set(.88,.92,1.1); g.add(cr);
  const face=mesh(GC('skullFace',()=>new THREE.SphereGeometry(.06,16,12)),m,0,.045,.045); face.scale.set(1.05,1,.85); g.add(face);
  for(const sd of [-1,1]){ const e=mesh(GC('skullEye',()=>new THREE.SphereGeometry(.021,10,8)),dark,sd*.029,.06,.088); e.scale.set(1,.9,.6); g.add(e); g.add(mesh(GC('skullCheek',()=>new THREE.SphereGeometry(.018,8,6)),m,sd*.05,.035,.06)); }
  const n=mesh(GC('skullNose',()=>new THREE.ConeGeometry(.011,.026,3)),dark,0,.032,.097); n.rotation.x=Math.PI; g.add(n);
  const teeth=mesh(GC('skullTeeth',()=>new THREE.BoxGeometry(.05,.016,.02)),mat(0xd8cdb0,{roughness:.6}),0,.006,.09); g.add(teeth);
  const jaw=mesh(GC('skullJaw',()=>new THREE.TorusGeometry(.04,.011,6,14,Math.PI)),m,0,-.006,.05); jaw.rotation.x=Math.PI/2; g.add(jaw);
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  return g;
}
function makeRibs(){
  const g=new THREE.Group(), m=boneMat();
  g.add(Object.assign(makeLongBone(.5,.012),{}));
  g.children[0].rotation.z=Math.PI/2; g.children[0].position.set(-.25,0,0);
  for(let i=0;i<6;i++){ const r=mesh(GC('rib'+i,()=>new THREE.TorusGeometry(.1-i*.004,.007,5,14,Math.PI*.95)),m,-.18+i*.07,.0,0); r.rotation.y=Math.PI/2; r.rotation.x=-.25; g.add(r); }
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  return g;
}
/* a whole (fallen apart) skeleton lying on the floor */
function makeSkeleton(seed=1){
  const rr=RNG(seed), g=new THREE.Group();
  const sk=makeSkull(); sk.position.set(0,.0,-.5); sk.rotation.set(-.5+rr()*.4,rr()*2,rr()*.8); g.add(sk);
  const rb=makeRibs(); rb.position.set(0,.06,-.18); rb.rotation.set(0,Math.PI/2+rr()*.3,Math.PI/2*.9); g.add(rb);
  for(let i=0;i<6;i++){ const b=makeLongBone(rand(.26,.46)); b.rotation.set(Math.PI/2,0,rr()*Math.PI*2); b.position.set(rand(-.35,.35),.02,rand(-.1,.6)); g.add(b); }
  return g;
}
