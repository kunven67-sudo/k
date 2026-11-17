/* ================================================================
   THROWN — the god hurls you through 5 realities, one after another,
   smashing through the walls between them, still in the air:
   the desert -> Nivalis -> Dry Gulch -> Earth (the beach) -> space + time.
   Where you STOP depends on what you did before (never told).
   Far away (z +600): a rainy street on Earth, for the one who comes next.
   ================================================================ */
const THROWN={seg:80, order:['desert','nivalis','gulch','beach','time'], street:V3(0,0,600)};
function thrownZ(i){ return -i*THROWN.seg; }      // segment i spans z from thrownZ(i) to thrownZ(i+1)
defineLevel('thrown',{
  title:'???',
  env:{fx:{exposure:1.05,saturation:1.05,contrast:1.08,temp:0,bloomStrength:.5,bloomThreshold:.95,aoRadius:.5,vignette:.4,grain:.04},music:null,reverb:.4,surface:'sand',far:700,speed:3.4},
  async build(scene,lv){ lv.occluders=[]; lv.panes=[]; lv.segs={};
    scene.background=col(0x9ab0c8); scene.fog=new THREE.FogExp2(col(0x9ab0c8),.006);
    lv.hemi=new THREE.HemisphereLight(col(0xd8e8ff),col(0x8a7a60),.9); scene.add(lv.hemi); const d=new THREE.DirectionalLight(col(0xfff0d8),1.6); d.position.set(.4,1,.3); scene.add(d); lv.sunL=d;
    const W=60;
    const ground=(i,m,amp=0)=>{ const g=new THREE.PlaneGeometry(W*2,THROWN.seg,amp?60:1,amp?40:1); if(amp){ const pp=g.attributes.position; for(let k=0;k<pp.count;k++){ const x=pp.getX(k), y=pp.getY(k), side=Math.min(1,Math.max(0,(Math.abs(x)-10)/18)); pp.setZ(k,(Math.sin(x*.11+y*.07+i)*.6+Math.sin(x*.05-y*.13)*.8+.9)*amp*side); } g.computeVertexNormals(); }
      const p=mesh(g,m,0,0,thrownZ(i)-THROWN.seg/2,false); p.rotation.x=-Math.PI/2; p.receiveShadow=true; withAO(p.geometry); scene.add(p); return p; };
    const rocks=(i,n,tint)=>{ const z0=thrownZ(i); for(let k=0;k<n;k++){ const x=(Math.random()<.5?-1:1)*rand(12,55); const r=fitProp(pick(['rock_07','moon_rock_01']),rand(1.2,5)); r.position.set(x,-.15,z0-rand(4,76)); r.rotation.y=rand(0,6.28); if(tint) r.traverse(o=>{ if(o.isMesh){ o.material=o.material.clone(); o.material.color=col(tint); } }); scene.add(r); } };
    // 0: the desert (AW1) + Jim's stand
    { const z0=thrownZ(0); ground(0,pbrMat('desert_sand',6,{w:W*2,h:THROWN.seg}),2.2); rocks(0,10,0xd8b890); const pyr=mesh(new THREE.ConeGeometry(30,24,4),pbrMat('desert_sand',8,{w:60,h:60}),-60,12,z0-60); pyr.rotation.y=Math.PI/4; scene.add(pyr);
      const st=new THREE.Group(); st.position.set(6,0,z0-50); const wd=pbrMat('rough_wood',1,{}); { const c1=fitProp('wooden_crate_02',.7); c1.position.set(-1.2,0,-1.1); st.add(c1); const c2=fitProp('wooden_crate_02',.6); c2.position.set(-.5,0,-1.2); c2.rotation.y=.4; st.add(c2); const b=fitProp('barrel_03',.55,.85); b.position.set(1.9,0,-.4); st.add(b); } st.add(box(3.2,.08,1.4,wd,0,1,0)); for(const [x,z] of [[-1.5,-.6],[1.5,-.6],[-1.5,.6],[1.5,.6]]) st.add(cyl(.05,.05,2.4,wd,x,1.2,z,8)); { const aw=mesh(new THREE.PlaneGeometry(3.6,1.6),new THREE.MeshStandardMaterial({map:canvasTex(256,32,(c,w,h)=>{ for(let i=0;i<10;i++){ c.fillStyle=i%2?'#efe6d0':'#b8302a'; c.fillRect(i*w/10,0,w/10,h); } }),roughness:.9,side:THREE.DoubleSide}),0,2.45,0,false); aw.rotation.x=-Math.PI/2; st.add(aw); } scene.add(st); lv.stand=st;
      lv.segs.desert={z:z0-50,land:V3(3,0,z0-46)}; }
    // 1: Nivalis (snow, ice spikes, the cave's glow)
    { const z0=thrownZ(1); { const sn=pbrMat('desert_sand',6,{w:W*2,h:THROWN.seg}); sn.color=col(0xdfe8f4); sn.roughness=.75; ground(1,sn,1.6); } rocks(1,8,0x8a94a4); for(let i=0;i<14;i++){ const c=mesh(new THREE.ConeGeometry(rand(1,3),rand(6,16),6),new THREE.MeshPhysicalMaterial({color:col(0x7aaed0),roughness:.08,clearcoat:1,envMapIntensity:.6}),(Math.random()<.5?-1:1)*rand(10,50),3,z0-rand(5,75)); scene.add(c); }
      const hm=pbrMat('cliff_side',3,{w:40,h:20}); hm.color=col(0x9aa4b0); const hill=mesh(new THREE.SphereGeometry(14,40,20,0,Math.PI*2,0,Math.PI/2),hm,-8,0,z0-58); { const pp=hill.geometry.attributes.position; for(let k=0;k<pp.count;k++){ const v=V3(pp.getX(k),pp.getY(k),pp.getZ(k)); v.multiplyScalar(1+Math.sin(v.x*.7)*.05+Math.sin(v.z*.9+v.y)*.05); pp.setXYZ(k,v.x,v.y,v.z); } hill.geometry.computeVertexNormals(); } hill.scale.y=.7; scene.add(hill);
      lv.caveL=new THREE.PointLight(col(0xff9040),3,14,1.6); lv.caveL.position.set(-8,1.2,z0-46); scene.add(lv.caveL); scene.add(box(4,3,.4,mat(0x050403),-8,1.5,z0-44.6));
      lv.segs.nivalis={z:z0-46,land:V3(-6,0,z0-40)}; }
    // 2: Dry Gulch (the street, the saloon)
    { const z0=thrownZ(2); const gm=pbrMat('dry_ground_01',6,{w:W*2,h:THROWN.seg}); gm.color=col(0xd0b088); ground(2,gm,1.2); const pl=pbrMat('brown_planks_03',3,{w:16,h:8});
      const post=pbrMat('rough_wood',1,{}); const glassD=new THREE.MeshStandardMaterial({color:col(0x1a1612),roughness:.2,metalness:.3}); const tin=pbrMat('metal_grate_rusty',1,{}); tin.color=col(0x8a7a6a);
      for(let i=0;i<4;i++) for(const s of [-1,1]){ const h=7+i%2*2, bz=z0-10-i*18, bx=s*16, fx=bx-s*6; scene.add(box(12,h,14,pl,bx,h/2,bz)); scene.add(box(.3,h+2.2,14.4,pl,fx,(h+2.2)/2,bz));   /* tall false front */
        for(const wz of [-4,4]){ scene.add(box(.12,1.6,1.8,glassD,fx-s*.16,4.2,bz+wz)); scene.add(box(.16,1.8,.12,post,fx-s*.2,4.2,bz+wz-.95)); scene.add(box(.16,1.8,.12,post,fx-s*.2,4.2,bz+wz+.95)); scene.add(box(.18,.12,2,post,fx-s*.2,3.25,bz+wz)); }
        scene.add(box(.12,2.5,1.6,new THREE.MeshStandardMaterial({color:col(0x3a2414),roughness:.8}),fx-s*.16,1.25,bz));     /* door */
        scene.add(box(3,.14,14,pl,fx-s*1.5,.32,bz)); for(const pz of [-6.8,-2.3,2.3,6.8]) scene.add(cyl(.09,.11,3.3,post,fx-s*2.85,1.95,bz+pz,6));   /* boardwalk + porch posts */
        const roof=box(3.2,.1,14.2,tin,fx-s*1.5,3.55,bz); roof.rotation.z=s*.12; scene.add(roof);
        if(i%2===0){ const b=fitProp('barrel_03',.6,.9); b.position.set(fx-s*2.2,.39,bz+rand(-5,5)); scene.add(b); } else { const c=fitProp('wooden_crate_02',.8); c.position.set(fx-s*2.1,.39,bz+rand(-5,5)); c.rotation.y=rand(0,1); scene.add(c); }
        if(i===1){ const hr=new THREE.Group(); hr.position.set(fx-s*4.2,0,bz); hr.add(box(.1,1.1,.1,post,0,.55,-1.4)); hr.add(box(.1,1.1,.1,post,0,.55,1.4)); hr.add(box(.08,.08,3,post,0,1.05,0)); scene.add(hr); } }
      rocks(2,6,0xb08a68);
      const sg=mesh(new THREE.PlaneGeometry(6,1.3),new THREE.MeshStandardMaterial({map:canvasTex(512,110,(c,w,h)=>{ c.fillStyle='#d9c49a'; c.fillRect(0,0,w,h); c.fillStyle='#3a1e0e'; c.font='bold 70px Georgia'; c.textAlign='center'; c.fillText('SALOON',w/2,80); })}),-9.9,8,z0-28,false); sg.rotation.y=Math.PI/2; scene.add(sg);
      lv.segs.gulch={z:z0-30,land:V3(0,0,z0-30)}; }
    // 3: Earth, the beach
    { const z0=thrownZ(3); const sm=pbrMat('desert_sand',5,{w:W*2,h:THROWN.seg}); sm.color=col(0xf0e0c0); ground(3,sm,.8); const sea=mesh(new THREE.PlaneGeometry(W*2,30),new THREE.MeshPhysicalMaterial({color:col(0x1a6a98),roughness:.08,clearcoat:1,envMapIntensity:1.2}),0,.1,z0-60,false); sea.rotation.x=-Math.PI/2; scene.add(sea); lv.sea=sea; { const foam=mesh(new THREE.PlaneGeometry(W*2,1.2),new THREE.MeshBasicMaterial({color:col(0xf4f8ff),transparent:true,opacity:.7}),0,.12,z0-45,false); foam.rotation.x=-Math.PI/2; scene.add(foam); lv.foam=foam; }
      for(let i=0;i<5;i++){ const u=new THREE.Group(); u.position.set(rand(-30,30),0,z0-rand(8,40)); u.add(cyl(.05,.05,2.4,mat(0xeeeeee),0,1.2,0,8)); const cc=pick(['#d8402e','#2a6ab0','#e8a828']); u.add(mesh(new THREE.ConeGeometry(1.4,.45,16,1,true),new THREE.MeshStandardMaterial({map:canvasTex(256,32,(c,w,h)=>{ for(let k=0;k<8;k++){ c.fillStyle=k%2?'#f4f0e6':cc; c.fillRect(k*w/8,0,w/8,h); } }),roughness:.85,side:THREE.DoubleSide}),0,2.3,0)); const tw=mesh(new THREE.PlaneGeometry(.8,1.7),new THREE.MeshStandardMaterial({color:col(pick([0xe8a030,0x3a9a8a,0xd04a6a])),roughness:1}),.8,.04,.4,false); tw.rotation.x=-Math.PI/2; tw.rotation.z=rand(-.5,.5); u.add(tw); scene.add(u); } rocks(3,5,0xa09080);
      lv.segs.beach={z:z0-30,land:V3(0,0,z0-30)}; }
    // 4: space + time
    { const z0=thrownZ(4); const sp=new THREE.Mesh(new THREE.BoxGeometry(W*2,60,THROWN.seg),new THREE.MeshBasicMaterial({color:col(0x03030a),side:THREE.BackSide})); sp.position.set(0,25,z0-THROWN.seg/2); scene.add(sp); const st=makeStars(1500,40); st.position.set(0,20,z0-40); scene.add(st);
      lv.rings=[]; for(let i=0;i<4;i++){ const r=mesh(new THREE.TorusGeometry(6+i*4,.15,8,80),new THREE.MeshBasicMaterial({color:col([0xffd060,0x80c0ff,0xff80d0,0xffffff][i])}),0,8,z0-40,false); scene.add(r); lv.rings.push(r); }
      lv.segs.time={z:z0-40,land:V3(0,8,z0-40)}; }
    // the walls between realities (glass with cracks), one after each segment
    const crackTex=canvasTex(512,512,(c,w,h)=>{ c.clearRect(0,0,w,h); c.strokeStyle='rgba(255,255,255,.9)'; for(let k=0;k<26;k++){ c.lineWidth=rand(.5,2.5); c.beginPath(); let x=w/2,y=h/2; c.moveTo(x,y); for(let s=0;s<6;s++){ x+=rand(-60,60); y+=rand(-60,60); c.lineTo(x,y); } c.stroke(); } });
    for(let i=0;i<5;i++){ const p=mesh(new THREE.PlaneGeometry(W*2,40),new THREE.MeshPhysicalMaterial({color:col(0xe8f4ff),map:crackTex,transparent:true,opacity:.55,roughness:.05,transmission:.5,side:THREE.DoubleSide,depthWrite:false}),0,20,thrownZ(i+1),false); scene.add(p); lv.panes.push(p); }
    // far away: an Earth street in the rain (night) — for the next one
    { const S=THROWN.street; const wet=new THREE.MeshPhysicalMaterial({color:col(0x2a2c30),roughness:.15,clearcoat:1,map:pbrMat('stone_tiles_02',3,{w:20,h:60}).map}); const rd=mesh(new THREE.PlaneGeometry(20,80),wet,S.x,.01,S.z,false); rd.rotation.x=-Math.PI/2; scene.add(rd);
      const win=canvasTex(128,256,(c,w,h)=>{ c.fillStyle='#1a1c22'; c.fillRect(0,0,w,h); for(let y=10;y<h;y+=28) for(let x=8;x<w;x+=26){ c.fillStyle=Math.random()<.4?'#ffd890':'#2a2e38'; c.fillRect(x,y,14,18); } });
      for(let i=0;i<6;i++) for(const s of [-1,1]){ const b=box(10,rand(12,24),12,new THREE.MeshStandardMaterial({color:col(0x5a5c66),map:win,roughness:.8,emissive:col(0x332a18),emissiveMap:win}),S.x+s*15,0,S.z-35+i*14); b.position.y=b.scale.y/2; scene.add(b); }
      for(const sx of [-1,1]){ const sw=box(4,.2,80,pbrMat('stone_tiles_02',2,{w:4,h:80}),S.x+sx*12,.1,S.z); scene.add(sw); } for(let k=0;k<10;k++){ const ln=mesh(new THREE.PlaneGeometry(.18,3),new THREE.MeshStandardMaterial({color:col(0xe8d070),roughness:.6}),S.x,.02,S.z-36+k*8,false); ln.rotation.x=-Math.PI/2; scene.add(ln); } for(let k=0;k<3;k++) for(const sx of [-1,1]){ const lx=S.x+sx*10.5, lz=S.z-30+k*24; scene.add(cyl(.09,.12,6,mat(0x2a2a2a),lx,3,lz,8)); scene.add(box(.9,.12,.4,mat(0x2a2a2a),lx-sx*.4,6,lz)); scene.add(mesh(new THREE.SphereGeometry(.18,10,8),new THREE.MeshBasicMaterial({color:col(0xffe0a0)}),lx-sx*.7,5.9,lz,false)); const pl=new THREE.PointLight(col(0xffc890),1.2,14,1.6); pl.position.set(lx-sx*.7,5.6,lz); scene.add(pl); }
      lv.streetL=new THREE.PointLight(col(0xffc890),0,30,1.5); lv.streetL.position.set(S.x+4,6,S.z); scene.add(lv.streetL); scene.add(cyl(.12,.12,6,mat(0x2a2a2a),S.x+4.5,3,S.z,8)); }
    lv.ground=(x,z)=>0; lv.col.bounds=[-60,60,-420,700];
  },
  enter(){ setAmbience([['wind',.06]]); },
  update(dt,t){ const lv=this; if(lv.rings) lv.rings.forEach((r,i)=>{ r.rotation.x+=dt*(.3+i*.2); r.rotation.y+=dt*(.2+i*.1)*(i%2?-1:1); }); if(lv.rain) lv.rain(dt); if(lv.foam){ lv.foam.position.z=thrownZ(3)-45+Math.sin(t*.7)*.8; lv.foam.material.opacity=.45+Math.sin(t*.7+1)*.25; } }
});
/* every reality has its own sky + light */
const MOODS=[{bg:0xe8d0a8,fog:.004,hemi:.95,hc:0xffe8c8,sun:1.8,sc:0xfff0d0},{bg:0x0a1424,fog:.014,hemi:.4,hc:0x8aa8d8,sun:.45,sc:0x9ab8e8},{bg:0xd89060,fog:.006,hemi:.75,hc:0xffc890,sun:1.4,sc:0xff9a50},{bg:0x9ac8f0,fog:.003,hemi:1.05,hc:0xe0f0ff,sun:2.0,sc:0xfff8e8},{bg:0x000000,fog:.001,hemi:.3,hc:0x8a8aff,sun:.2,sc:0xffffff}];
const MOOD_SKY=[['dry_cracked_lake',1],['rogland_clear_night',.5],['dry_cracked_lake',.8],['noon_grass',1],null];
function skyBG(name,k){ const key='bg_'+name+'_'+k; if(TEXCACHE[key]) return TEXCACHE[key]; const src=ASSETS.tex&&ASSETS.tex['hdri_'+name]; if(!src||!src.image) return null; const c=document.createElement('canvas'); c.width=src.image.width; c.height=src.image.height; const x=c.getContext('2d'); x.filter='brightness('+k+')'; x.drawImage(src.image,0,0); const t=new THREE.CanvasTexture(c); t.mapping=THREE.EquirectangularReflectionMapping; t.encoding=THREE.sRGBEncoding; TEXCACHE[key]=t; return t; }
function realityMood(i){ const lv=LEVELS.thrown, M=MOODS[i]; const SK=MOOD_SKY[i]; const bg=SK&&skyBG(SK[0],SK[1]); lv.scene.environment=SK?hdriEnv(SK[0],SK[1]):null; if(bg){ lv.scene.background=bg; lv.scene.fog.color.set(M.bg); lv.scene.fog.density=M.fog*.45; lv.hemi.intensity=M.hemi*.75; lv.hemi.color.set(M.hc); lv.sunL.intensity=M.sun; lv.sunL.color.set(M.sc); return; } lv.scene.background=col(M.bg); lv.scene.fog.color.set(M.bg); lv.scene.fog.density=M.fog; lv.hemi.intensity=M.hemi; lv.hemi.color.set(M.hc); lv.sunL.intensity=M.sun; lv.sunL.color.set(M.sc); }
/* the flight: camera on a rail through the walls. stopAt = index of the reality you land in (0..4), or 5 = all the way through */
async function throwThrough(stopAt,onReality){ const lv=LEVELS.thrown; let shake_=0; const L=lv;
  for(let i=0;i<5;i++){ const z0=thrownZ(i), z1=thrownZ(i+1);
    // fly the segment (high, spinning a little); stop early in the landing reality
    const last=i===stopAt; const zEnd=last?(lv.segs[THROWN.order[i]].z):z1+.5; const dur=last?1.6:1.15;
    realityMood(i); if(onReality) onReality(i);
    await new Promise(res=>{ let t=0; camFollow((tt,dt)=>{ t=Math.min(1,tt/dur); const z=lerp(z0+2,zEnd,t); const h=last?lerp(8,1.6,t*t):7+Math.sin(tt*3)*1.5; return {pos:V3(Math.sin(tt*2+i)*3,h,z),look:V3(Math.sin(tt*2+i)*3+Math.sin(tt*4)*.3,h-.5-(last?t*2:0),z-10),fov:82}; },82); CAM.fnT=0; later(dur,res); });
    if(last){ SND.play('body_fall',{vol:1}); SND.play('sand_fall',{vol:.8}); shake(1.2); flashWhite(.4,.1); return i; }
    // SMASH through the wall into the next reality
    SND.play('glass_break',{vol:1,rate:rand(.7,1)}); SND.play('blast',{vol:.5,rate:1.4}); shake(1); flashWhite(.7,.12); lv.panes[i].visible=false; FX.aberr=.04; later(.2,()=>FX.aberr=.004);
    for(let k=0;k<40;k++) lv.soft.spawn(rand(-6,6),rand(4,10),z1,rand(-6,6),rand(-3,4),rand(-14,-4),rand(.6,1.4),rand(.05,.15),.9,.95,1,.8,0,.5,1.6); }
  return 5; }
