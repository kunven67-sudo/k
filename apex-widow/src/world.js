import * as THREE from 'three';

const V=(x,y,z)=>new THREE.Vector3(x,y,z);

// VOSS skyscraper top floor: tank room + lab benches + office corner + big
// window you burst out of into night-time New Halvern.
export class Lab {
  constructor(scene, quality){
    this.scene = scene;
    this.quality = quality;
    this.collide = [];      // meshes to raycast move against
    this.climb = [];        // surfaces the spider can walk on (floor+walls+props)
    this.group = new THREE.Group();
    scene.add(this.group);
    this._mats();
    this._build();
  }
  _mats(){
    this.M = {
      floor: new THREE.MeshStandardMaterial({color:0x6b7280, roughness:0.7, metalness:0.1}),
      wall:  new THREE.MeshStandardMaterial({color:0x8a919b, roughness:0.85, metalness:0.05}),
      wallDark: new THREE.MeshStandardMaterial({color:0x474d57, roughness:0.9}),
      metal: new THREE.MeshStandardMaterial({color:0x8d949c, roughness:0.4, metalness:0.8}),
      steel: new THREE.MeshStandardMaterial({color:0xb7bcc2, roughness:0.3, metalness:0.9}),
      glass: new THREE.MeshPhysicalMaterial({color:0xbfe4ff, roughness:0.05, metalness:0, transmission:0.9, transparent:true, opacity:0.35, thickness:0.3}),
      white: new THREE.MeshStandardMaterial({color:0xe9edf1, roughness:0.5}),
      screen:new THREE.MeshStandardMaterial({color:0x0a2a1a, emissive:0x1b7f4a, emissiveIntensity:0.8, roughness:0.3}),
      rubber:new THREE.MeshStandardMaterial({color:0x161a1f, roughness:0.85}),
      warn:  new THREE.MeshStandardMaterial({color:0xd8a200, roughness:0.6}),
    };
  }
  _box(w,h,d,mat,x,y,z,climb=false,coll=true){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true;
    this.group.add(m);
    if(coll) this.collide.push(m);
    if(climb) this.climb.push(m);
    return m;
  }
  _build(){
    const W=40, D=30, H=5;
    // floor
    const floor=this._box(W,0.4,D,this.M.floor,0,-0.2,0,true);
    floor.receiveShadow=true;
    // tile lines
    const grid=new THREE.GridHelper(W,20,0x20242a,0x20242a); grid.position.y=0.011; this.group.add(grid);
    // walls
    this._box(W,H,0.4,this.M.wall,0,H/2,-D/2,true);
    this._box(0.4,H,D,this.M.wall,-W/2,H/2,0,true);
    this._box(0.4,H,D,this.M.wall, W/2,H/2,0,true);
    // back wall is the WINDOW wall (big glass you burst out of)
    const frame=this._box(W,H,0.4,this.M.wallDark,0,H/2,D/2,false);
    const win=new THREE.Mesh(new THREE.BoxGeometry(26,3.6,0.12),this.M.glass);
    win.position.set(0,2.0,D/2-0.18); this.group.add(win); this.window=win;
    this.windowPos=win.position.clone();
    // mullions
    for(let i=-3;i<=3;i++) this._box(0.15,3.6,0.14,this.M.metal,i*3.6,2.0,D/2-0.18,false);
    // ceiling
    this._box(W,0.3,D,this.M.wallDark,0,H,0,false);

    // ---- the glass TANK you start in (center, on a bench) ----
    const benchTop=this._box(3.2,0.18,2.2,this.M.steel,-6,1.0,-2,true);
    this._box(0.2,1.0,0.2,this.M.metal,-7.3,0.5,-2.9); this._box(0.2,1.0,0.2,this.M.metal,-4.7,0.5,-2.9);
    this._box(0.2,1.0,0.2,this.M.metal,-7.3,0.5,-1.1); this._box(0.2,1.0,0.2,this.M.metal,-4.7,0.5,-1.1);
    // tank glass box (open top). Walls as 4 thin glass panes + a cracked one
    const tankMat=this.M.glass;
    const tx=-6, ty=1.09+0.6, tz=-2;
    const th=1.2, tw=2.0, tdd=1.4;
    const paneF=this._box(tw,th,0.04,tankMat,tx,ty,tz-tdd/2,false,false);
    const paneB=this._box(tw,th,0.04,tankMat,tx,ty,tz+tdd/2,false,false);
    this._box(0.04,th,tdd,tankMat,tx-tw/2,ty,tz,false,false);
    this._box(0.04,th,tdd,tankMat,tx+tw/2,ty,tz,false,false);
    this.tankFloor=this._box(tw,0.04,tdd,this.M.white,tx,1.09,tz,true);
    this.tankCenter=V(tx,1.2,tz);
    this.tankBrokenPane=paneF; // front pane shatters in the breakout
    // label card
    const card=this._box(0.5,0.3,0.02,this.M.warn,tx,1.4,tz-tdd/2-0.03,false,false);

    // ---- lab benches with gear around the room ----
    this._bench(6,-8); this._bench(11,-8); this._bench(6,5); this._bench(-10,6);
    // specimen jar shelf (Specimens 1-7) on the left wall
    this._shelf(-W/2+0.6, -8);
    // fume hood / chemistry corner
    this._box(3,2.2,1.2,this.M.white,W/2-2.2,1.1,-D/2+1.4,true);
    this._box(2.6,1.6,0.06,this.M.glass,W/2-2.2,1.5,-D/2+2.0,false,false);
    // pipes along the ceiling
    for(let i=0;i<6;i++){
      const p=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,W-2,10),this.M.metal);
      p.rotation.z=Math.PI/2; p.position.set(0,H-0.4-i*0.0,-D/2+2+i*4);
      this.group.add(p); this.collide.push(p); this.climb.push(p);
    }
    // the VENT you can escape into (hole high on the side wall)
    const vent=this._box(1.2,1.2,0.1,this.M.rubber,-W/2+0.3,3.2,8,false,false);
    this.ventPos=V(-W/2+0.3,3.2,8);
    // floor crate clutter
    this._box(1,1,1,this.M.warn,10,0.5,10,true); this._box(1,1,1,this.M.warn,10.8,0.5,10.4,true);
    this._box(1.2,1.2,1.2,this.M.rubber,-14,0.6,-10,true);

    // overhead lights (emissive panels + actual lights)
    this.lights=[];
    for(const lx of [-10,0,10]) for(const lz of [-8,2]){
      const panel=new THREE.Mesh(new THREE.BoxGeometry(2.4,0.08,1.2),new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xeaf4ff,emissiveIntensity:1.6}));
      panel.position.set(lx,H-0.2,lz); this.group.add(panel);
      const l=new THREE.PointLight(0xdfefff, 42, 34, 2); l.position.set(lx,H-0.6,lz);
      if(this.quality!=='low') l.castShadow=lx===0&&lz===2;
      this.group.add(l); this.lights.push(l);
    }
    // red alarm strips (off until breakout)
    this.alarm=new THREE.PointLight(0xff2a1a,0,30,2); this.alarm.position.set(0,H-1,0); this.group.add(this.alarm);
  }
  _bench(x,z){
    this._box(3,0.9,1.4,this.M.white,x,0.45,z,true);
    this._box(3,0.1,1.4,this.M.steel,x,0.95,z,true);
    // a microscope-ish shape + beakers + monitor
    const scope=new THREE.Group();
    scope.add(mk(new THREE.CylinderGeometry(0.2,0.3,0.1,12),this.M.metal,0,0.05,0));
    scope.add(mk(new THREE.CylinderGeometry(0.06,0.06,0.5,10),this.M.metal,0,0.3,0));
    scope.add(mk(new THREE.BoxGeometry(0.1,0.1,0.3),this.M.metal,0,0.45,0.1));
    scope.position.set(x-0.8,1.0,z); this.group.add(scope);
    for(let i=0;i<3;i++){
      const b=mk(new THREE.CylinderGeometry(0.07,0.09,0.22,10),this.M.glass,x+0.2+i*0.25,1.11,z-0.3);
      this.group.add(b);
    }
    // monitor
    const mon=mk(new THREE.BoxGeometry(0.9,0.55,0.05),this.M.screen,x+0.6,1.4,z+0.4);
    this.group.add(mon);
    this._box(0.3,0.4,0.05,this.M.metal,x+0.6,1.1,z+0.4,false,false);
  }
  _shelf(x,z){
    for(let r=0;r<3;r++){
      this._box(0.5,0.05,6,this.M.metal,x,1.0+r*1.0,z,true);
      // jars with specimens
      for(let j=0;j<5;j++){
        const jar=mk(new THREE.CylinderGeometry(0.16,0.16,0.5,12),this.M.glass,x,1.3+r*1.0,z-2.5+j*1.1);
        this.group.add(jar);
        const spec=mk(new THREE.SphereGeometry(0.1,8,8),new THREE.MeshStandardMaterial({color:0x2a1a1a,roughness:0.6}),x,1.25+r*1.0,z-2.5+j*1.1);
        this.group.add(spec);
      }
    }
  }
}
function mk(g,m,x,y,z){const e=new THREE.Mesh(g,m);e.position.set(x,y,z);e.castShadow=true;return e;}
