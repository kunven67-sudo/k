import * as THREE from 'three';
import { Spider } from './spider.js';
import { Lab } from './world.js';
import { Controller } from './player.js';
import { Prey } from './prey.js';
import { Webs } from './web.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { STAGES, stageFor } from './sizes.js';

const V=(x,y,z)=>new THREE.Vector3(x,y,z);

class Game{
  constructor(){
    this.settings={quality:'Auto', gore:'MAX', fear:false, shake:true};
    this.audio=new Audio();
    this.state='menu';
    this._initRenderer();
    this.ui=new UI(this);
    this._loop();
    addEventListener('resize',()=>this._resize());
  }
  _initRenderer(){
    const c=document.getElementById('c');
    this.renderer=new THREE.WebGLRenderer({canvas:c, antialias:true, powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.shadowMap.enabled=true; this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure=1.25;
    this.scene=new THREE.Scene();
    this.scene.background=new THREE.Color(0x0a0c12);
    this.scene.fog=new THREE.Fog(0x0a0c12, 45, 130);
    this.cam=new THREE.PerspectiveCamera(62, innerWidth/innerHeight, 0.05, 2000);
    this.cam.position.set(-3,3,2);
    this._pr=Math.min(devicePixelRatio,2); this._fpsAcc=0; this._fpsN=0; this._fps=60;
  }
  _resize(){ this.cam.aspect=innerWidth/innerHeight; this.cam.updateProjectionMatrix(); this.renderer.setSize(innerWidth,innerHeight); }
  applyQuality(){
    const q=this.settings.quality;
    const map={Low:0.6,Med:0.85,High:1,Ultra:1,Auto:this._pr};
    this.renderer.shadowMap.enabled = q!=='Low';
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,(map[q]||1)* (q==='Ultra'?1.3:1)));
  }
  start(){
    this.ui.clear();
    this._buildScene();
    this._cutscene();
  }
  _buildScene(){
    // reset scene
    while(this.scene.children.length)this.scene.remove(this.scene.children[0]);
    this.scene.background=new THREE.Color(0x0a0c12);
    this.scene.fog=new THREE.Fog(0x0a0c12,45,130);
    const amb=new THREE.HemisphereLight(0x9db0d6,0x343842,1.15); this.scene.add(amb); this.amb=amb;
    const key=new THREE.DirectionalLight(0xdfe8ff,0.5); key.position.set(6,12,4); this.scene.add(key);
    this.lab=new Lab(this.scene, this.settings.quality==='Low'?'low':'high');
    const q=this.settings.fear?'low':'high';
    this.spider=new Spider({quality:q}); this.spider.setScale(STAGES[0].scale); this.scene.add(this.spider.group);
    this.applyFear();
    this.ctrl=new Controller(this.spider,this.cam,this.renderer.domElement);
    this.webs=new Webs(this.scene);
    this.prey=[]; this.kills=0;
    this.stats={hp:100, hunger:0.9, molt:0, silk:1, kills:0};
    this.stageI=0;
    this._spawnLab();
    this.broke=false; this.rooftop=false;
    this.audio.resume();
  }
  applyFear(){
    if(!this.spider)return;
    // fear mode: make the widow cartoony/less creepy (blue blob, simple)
    this.spider.group.traverse(o=>{ if(o.isMesh && o.material && o.material.color){
      if(this.settings.fear){ if(!o._oc)o._oc=o.material.color.getHex(); o.material.color.setHex(0x5b78d6); o.material.roughness=0.9; }
      else if(o._oc!==undefined){ o.material.color.setHex(o._oc); }
    }});
  }
  _spawnLab(){
    const spots=[[2,-6],[8,-7],[12,2],[-10,8],[4,8],[-14,-6],[14,-10],[0,6],[-6,10],[9,-2]];
    for(const [x,z] of spots){
      const t=['fly','fly','roach','spiderling','roach'][Math.floor(Math.random()*5)];
      const p=new Prey(t,V(x, t==='fly'?1.5:0.3, z)); this.scene.add(p.group); this.prey.push(p);
    }
    // one rat hiding
    const rat=new Prey('rat',V(14,0.5,8)); this.scene.add(rat.group); this.prey.push(rat);
  }

  // ---- injection cutscene then breakout ----
  _cutscene(){
    this.ui.hud(); this.state='cutscene';
    this.ui.bars(true);
    const cam=this.cam;
    const tank=this.lab.tankCenter.clone();
    cam.position.copy(tank).add(V(0.2,0.3,1.6)); cam.up.set(0,1,0); cam.lookAt(tank);
    const seq=[
      {t:0.3, line:'VOSS BIOGENETICS — SUBLEVEL ?? '},
      {t:2.6, line:'"Specimen 8. Let\'s try again."'},
      {t:5.4, line:'The needle goes in.', flash:'#ffffff', shake:1},
      {t:7.0, line:'Something is wrong. You are growing.', shake:1},
      {t:9.4, line:'The glass cracks.', crack:true, shake:2},
      {t:11.4,line:'GET OUT.', alarm:true},
      {t:13.0,end:true},
    ];
    this._cutStart=performance.now(); this._cutSeq=seq; this._cutDone=new Set();
  }
  _updateCutscene(dt){
    const el=(performance.now()-this._cutStart)/1000;
    const tank=this.lab.tankCenter.clone();
    // slow push-in + heartbeat wobble
    const wob=Math.sin(el*8)*0.01*Math.max(0,el-5);
    this.cam.position.lerp(tank.clone().add(V(0.1,0.25,1.2+Math.max(0,3-el*0.2))),0.03);
    this.cam.position.x+=wob; this.cam.lookAt(tank);
    for(const s of this._cutSeq){
      if(el>=s.t && !this._cutDone.has(s)){
        this._cutDone.add(s);
        if(s.line)this.ui.cine(s.line);
        if(s.flash)this.ui.flash(s.flash);
        if(s.shake)this._shake=s.shake*0.3;
        if(s.crack){ this.lab.tankBrokenPane.visible=false; this.audio.bite(); }
        if(s.alarm){ this.audio.alarm(); this.lab.alarm.intensity=3; for(const l of this.lab.lights)l.color.setHex(0xffd0c0); }
        if(s.end){ this.ui.cine(''); this.ui.bars(false); this._beginPlay(); }
      }
    }
    // pulse alarm
    if(this.lab.alarm.intensity>0) this.lab.alarm.intensity=2+Math.sin(el*6)*2;
  }
  _beginPlay(){
    this.state='play';
    this.ui.hint('WASD move · mouse look · E eat · RMB web-zip · R wrap prey · M molt · click to lock mouse');
    this.ui.news('SPECIMEN 8 HAS ESCAPED CONTAINMENT');
    setTimeout(()=>this.ui.hint(''),6500);
    this._bindActions();
  }
  _bindActions(){
    if(this._bound)return; this._bound=true;
    addEventListener('mousedown',e=>{
      if(this.state!=='play')return;
      if(e.button===2){ this._webZip(); }
    });
    addEventListener('contextmenu',e=>{ if(this.state!=='play'||this.ctrl.locked)e.preventDefault(); });
    addEventListener('keydown',e=>{
      if(this.state!=='play')return;
      if(e.code==='KeyE'){ this._tryEat(); }
      if(e.code==='KeyR'){ this._tryWrap(); }
      if(e.code==='KeyM'){ this._tryMolt(); }
      if(e.code==='Escape'&&this.ctrl.locked){} 
    });
  }
  _nearestPrey(range){
    let best=null,bd=range*range;
    const p=this.ctrl.pos;
    for(const pr of this.prey){ if(pr.eaten)continue; const d=pr.pos.distanceToSquared(p); if(d<bd){bd=d;best=pr;} }
    return best;
  }
  _tryEat(){
    const reach=1.2*this.spider.scale+0.6;
    const pr=this._nearestPrey(reach);
    if(!pr){ this.ui.hint('nothing close to eat'); setTimeout(()=>this.ui.hint(''),1200); return; }
    // size gate: can't eat things way bigger than you
    if(pr.t.r > this.spider.scale*1.6 && !pr.cocooned){ this.ui.news('too big to eat — wrap it first or grow'); return; }
    pr.eaten=true; if(pr.cocoonMesh)pr.cocoonMesh.visible=false; pr.group.visible=false;
    this.audio.bite();
    this.stats.hunger=Math.min(1,this.stats.hunger + pr.t.food/100);
    this.stats.molt=Math.min(1,this.stats.molt + pr.t.food/160);
    this.stats.hp=Math.min(100,this.stats.hp+3);
    this.kills++; this.stats.kills=this.kills;
    this._grow(pr.t.grow);
    this.ui.flash('#5a0a10');
    if(Math.random()<0.4)this.ui.news('reports of a "giant spider" at VOSS tower');
    // respawn a new bug so there's always food
    setTimeout(()=>this._respawn(),1500);
  }
  _respawn(){
    if(this.rooftop)return;
    const x=(Math.random()-0.5)*34,z=(Math.random()-0.5)*24;
    const t=['fly','roach','spiderling'][Math.floor(Math.random()*3)];
    const p=new Prey(t,V(x,t==='fly'?1.5:0.3,z)); this.scene.add(p.group); this.prey.push(p);
  }
  _tryWrap(){
    const reach=1.5*this.spider.scale+0.8;
    const pr=this._nearestPrey(reach);
    if(!pr||pr.cocooned){ return; }
    if(this.stats.silk<0.1){ this.ui.news('out of silk'); return; }
    this.stats.silk-=0.12; this.webs.cocoon(pr); this.audio.web();
    this.ui.news('prey wrapped in silk');
  }
  _webZip(){
    // cast from camera to surface, zip the spider there
    if(this.stats.silk<0.05)return;
    const rc=new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(0,0), this.cam); rc.far=60;
    const hit=rc.intersectObjects(this.lab.climb,false)[0];
    if(!hit)return;
    this.stats.silk-=0.05;
    this.webs.strand(this.ctrl.pos.clone().addScaledVector(this.ctrl.up,this.spider.scale*0.5), hit.point.clone());
    this._zipTarget=hit.point.clone().addScaledVector(hit.face.normal.clone().transformDirection(hit.object.matrixWorld),this.spider.scale*0.3);
    this._zipT=0; this.audio.web();
  }
  _grow(a){
    const cur=this.spider.scale;
    const ns=Math.min(STAGES[STAGES.length-1].scale, cur + a*(this.rooftop?3:1));
    this.spider.setScale(ns);
    const ni=stageFor(ns);
    if(ni>this.stageI){ this.stageI=ni; this.ui.news('you grew — now '+STAGES[ni].label+' ('+STAGES[ni].as+')'); 
      if(ni>=6 && !this.broke && !this.rooftop){ this.ui.hint('big enough — ram the WINDOW to break out (walk into it)'); setTimeout(()=>this.ui.hint(''),6000);} }
  }
  _tryMolt(){
    if(this.stats.molt<1){ this.ui.news('molt meter not full — eat more'); return; }
    this.state='molt'; this.audio.molt(); this.ui.bars(true); this.ui.cine('MOLTING — pick your evolution');
    const opts=[
      {name:'GROW',desc:'A clean size jump. Bigger, stronger, longer reach.',fn:()=>{this._grow(0.4);}},
      {name:'WIDOW VENOM',desc:'Deadlier bite — prey dies faster, more food per kill.',fn:()=>{this.venom=(this.venom||1)*1.4;}},
      {name:'HEAVY SILK',desc:'More silk and faster web-zip. Wrap bigger things.',fn:()=>{this.stats.silk=1;this.silkMax=(this.silkMax||1)*1.3;}},
    ];
    setTimeout(()=>{
      this.ui.cards('CHOOSE', opts, (o)=>{
        o.fn(); this.stats.molt=0; this.stats.hp=100;
        this._grow(0.25); this.ui.bars(false); this.ui.cine(''); this.state='play';
        this.ui.flash('#fff'); this.ui.news('you molted — new shell, new power');
      });
    }, 900);
  }
  _breakout(){
    if(this.broke)return; this.broke=true;
    this.lab.window.visible=false; this.audio.bite(); this.ui.flash('#fff');
    this.ui.cine('YOU BURST THROUGH THE GLASS'); setTimeout(()=>this.ui.cine(''),2200);
    setTimeout(()=>this._toRooftop(),1400);
  }
  _toRooftop(){
    this.rooftop=true; this.state='play';
    // swap the lab for a night rooftop + skyline
    this.scene.remove(this.lab.group);
    for(const p of this.prey){ this.scene.remove(p.group); } this.prey=[];
    this.scene.background=new THREE.Color(0x0a1022);
    this.scene.fog=new THREE.Fog(0x070a16, 90, 340);
    this.amb.intensity=0.7; this.amb.color.setHex(0x44557a);
    const moon=new THREE.DirectionalLight(0xaec4ff,1.7); moon.position.set(40,80,-30); moon.castShadow=this.settings.quality!=='Low';
    if(moon.castShadow){moon.shadow.mapSize.set(1024,1024);moon.shadow.camera.left=-60;moon.shadow.camera.right=60;moon.shadow.camera.top=60;moon.shadow.camera.bottom=-60;moon.shadow.camera.far=240;}
    this.scene.add(moon);
    this._buildRooftop();
    this.ctrl.pos.set(0,0.5,0); this.ctrl.up.set(0,1,0);
    this.ui.news('NEW HALVERN — the city sees you now');
    this.ui.hint('keep eating to grow — cars, dogs, pigeons. (first playable ends at house-size)');
    setTimeout(()=>this.ui.hint(''),7000);
  }
  _winTex(){
    if(this._wt) return this._wt;
    const c=document.createElement('canvas'); c.width=64; c.height=128; const x=c.getContext('2d');
    x.fillStyle='#070a12'; x.fillRect(0,0,64,128);
    for(let yy=6;yy<128;yy+=10) for(let xx=6;xx<64;xx+=12){
      if(Math.random()<0.55){ const w=['#ffd98a','#fff1c0','#9fd0ff','#ffc060'][Math.floor(Math.random()*4)]; x.fillStyle=w; x.globalAlpha=0.5+Math.random()*0.5; x.fillRect(xx,yy,7,6); }
    }
    x.globalAlpha=1;
    const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; this._wt=t; return t;
  }
  _buildRooftop(){
    const g=new THREE.Group(); this.scene.add(g); this.roofG=g; this.lab={climb:[],collide:[]}; 
    // rooftop slab
    const roof=new THREE.Mesh(new THREE.BoxGeometry(60,1,60),new THREE.MeshStandardMaterial({color:0x2a2e36,roughness:0.9}));
    roof.position.y=-0.5; roof.receiveShadow=true; g.add(roof); this.lab.climb.push(roof); this.lab.collide.push(roof);
    // parapet
    for(const[dx,dz,w,d] of [[0,-30,60,1],[0,30,60,1],[-30,0,1,60],[30,0,1,60]]){
      const p=new THREE.Mesh(new THREE.BoxGeometry(w,2,d),new THREE.MeshStandardMaterial({color:0x33373f,roughness:0.9}));
      p.position.set(dx,0.5,dz); g.add(p); this.lab.climb.push(p); this.lab.collide.push(p);
    }
    // rooftop clutter: AC units, a water tank, vents
    for(let i=0;i<8;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(3,2,3),new THREE.MeshStandardMaterial({color:0x4a4e56,roughness:0.6,metalness:0.4}));b.position.set((Math.random()-0.5)*44,1,(Math.random()-0.5)*44);b.castShadow=true;g.add(b);this.lab.climb.push(b);this.lab.collide.push(b);}
    const tank=new THREE.Mesh(new THREE.CylinderGeometry(4,4,6,16),new THREE.MeshStandardMaterial({color:0x5a4a3a,roughness:0.8}));tank.position.set(16,3,-14);tank.castShadow=true;g.add(tank);this.lab.climb.push(tank);this.lab.collide.push(tank);
    // skyline of distant towers with window lights
    for(let i=0;i<60;i++){
      const h=20+Math.random()*120, w=8+Math.random()*16;
      const ang=Math.random()*6.28, dist=70+Math.random()*160;
      const bx=Math.cos(ang)*dist, bz=Math.sin(ang)*dist;
      const col=0x0a0e18;
      const wt=this._winTex(); const emap=wt.clone(); emap.repeat.set(Math.max(1,Math.round(w/4)),Math.max(2,Math.round(h/12)));
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,w),new THREE.MeshStandardMaterial({color:0x0a0e18,emissive:0xffffff,emissiveMap:emap,emissiveIntensity:1.1,roughness:0.9}));
      m.position.set(bx,h/2-1,bz); g.add(m);
      // window glow
      const lit=new THREE.Mesh(new THREE.BoxGeometry(w*0.98,h*0.98,w*0.98),new THREE.MeshStandardMaterial({color:0x000,emissive:0xffcb6b,emissiveIntensity:0.0}));
    }
    // stars
    const starGeo=new THREE.BufferGeometry();const sp=[];for(let i=0;i<800;i++){const r=400;const u=Math.random(),v=Math.random();const th=u*6.28,ph=Math.acos(2*v-1);sp.push(r*Math.sin(ph)*Math.cos(th),Math.abs(r*Math.cos(ph))+20,r*Math.sin(ph)*Math.sin(th));}
    starGeo.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));
    const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xcdd6ff,size:1.4,sizeAttenuation:false}));g.add(stars);
    // moon disc
    const moon=new THREE.Mesh(new THREE.CircleGeometry(16,32),new THREE.MeshBasicMaterial({color:0xdfe6ff}));moon.position.set(-120,120,-200);moon.lookAt(0,0,0);g.add(moon);
    // rooftop prey: pigeons, rats, a stray dog, cars on a lower rooftop
    const spots=[['rat',[-10,0.3,8]],['rat',[12,0.3,-6]],['fly',[0,2,0]],['fly',[6,2,4]],['rat',[-16,0.3,-10]]];
    for(const[t,[x,y,z]] of spots){const p=new Prey(t,V(x,y,z));this.scene.add(p.group);this.prey.push(p);}
    this._roofRespawn=()=>{ if(!this.rooftop)return; const p=new Prey(Math.random()<0.5?'rat':'fly',V((Math.random()-0.5)*44,0.3,(Math.random()-0.5)*44));this.scene.add(p.group);this.prey.push(p); };
  }

  _loop(){
    let last=performance.now();
    const tick=()=>{
      requestAnimationFrame(tick);
      const now=performance.now(); let dt=(now-last)/1000; last=now; dt=Math.min(dt,0.05);
      this._fpsAcc+=dt; this._fpsN++;
      if(this._fpsAcc>0.5){ this._fps=this._fpsN/this._fpsAcc; this._fpsAcc=0;this._fpsN=0; this._autoQ(); if(this.ui.h&&this.ui.h.fps)this.ui.h.fps.textContent=this._fps.toFixed(0)+' fps'; }
      if(this.state==='cutscene'){ this._updateCutscene(dt); }
      else if(this.state==='play'||this.state==='molt'){ this._update(dt); }
      // shake decay
      if(this._shake>0){ this.cam.position.x+=(Math.random()-0.5)*this._shake; this.cam.position.y+=(Math.random()-0.5)*this._shake; this._shake*=0.85; if(this._shake<0.01)this._shake=0; }
      this.renderer.render(this.scene,this.cam);
    };
    tick();
  }
  _autoQ(){
    if(this.settings.quality!=='Auto'||!this.renderer)return;
    if(this._fps<40 && this._pr>0.7){ this._pr=Math.max(0.6,this._pr-0.1); this.renderer.setPixelRatio(this._pr*Math.min(devicePixelRatio,1)); }
    else if(this._fps>58 && this._pr<Math.min(devicePixelRatio,2)){ this._pr=Math.min(2,this._pr+0.05); this.renderer.setPixelRatio(Math.min(devicePixelRatio,this._pr)); }
  }
  _update(dt){
    if(this.state==='play') this.ctrl.update(dt,this.lab);
    // web zip movement
    if(this._zipTarget){ this._zipT+=dt*4; this.ctrl.pos.lerp(this._zipTarget,Math.min(1,dt*8)); if(this.ctrl.pos.distanceTo(this._zipTarget)<0.3||this._zipT>1){this._zipTarget=null;} }
    // prey
    for(const p of this.prey){ p.update(dt,this.ctrl.pos,this.lab.climb); }
    // hunger / hp
    if(this.state==='play'){
      this.stats.hunger=Math.max(0,this.stats.hunger - dt*0.012);
      if(this.stats.hunger<=0) this.stats.hp-=dt*4;
      this.stats.silk=Math.min(this.silkMax||1, this.stats.silk + dt*0.03);
      if(this.stats.hp<=0){ this._die('you starved'); }
    }
    // breakout: near window & big enough & moving into it
    if(this.state==='play'&&!this.rooftop&&!this.broke&&this.stageI>=6&&this.lab.window){
      if(this.ctrl.pos.distanceTo(this.lab.windowPos)<3+this.spider.scale){ this._breakout(); }
    }
    if(this.rooftop&&this.prey.length<6&&Math.random()<dt*0.5)this._roofRespawn&&this._roofRespawn();
    // intensity for audio from size
    this._intensity=Math.min(1,this.stageI/9); this.audio.setIntensity(this._intensity);
    // HUD
    const st=STAGES[this.stageI];
    this.ui.setHUD({hp:this.stats.hp,hunger:this.stats.hunger,molt:this.stats.molt,silk:this.stats.silk/(this.silkMax||1),kills:this.kills,sizeLabel:st.label,asBig:st.as});
    // contextual hint for eating
    if(this.state==='play'){ const near=this._nearestPrey(1.2*this.spider.scale+0.6); this.ui.hint(near?('E — eat the '+near.t.name):''); }
  }
  _die(reason){
    this.state='dead'; document.exitPointerLock&&document.exitPointerLock();
    this.ui.cards('YOU DIED — '+reason, [
      {name:'RESTART',desc:'Back in the tank as Specimen 8. The serum, again.',fn:()=>{}},
    ], ()=>{ this.start(); });
  }
}
window.__game=new Game();
