import * as THREE from 'three';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);

// Simple procedural critters the widow hunts. Each wanders, flees when you're
// close, and can be grabbed + eaten. Sizes are real-ish relative to a tiny spider.
const TYPES={
  fly:   {r:0.12, hp:4,  food:8,  grow:0.02, speed:3.5, color:0x222222, flee:2.2, name:'fly'},
  roach: {r:0.22, hp:10, food:18, grow:0.05, speed:2.2, color:0x3a2412, flee:1.8, name:'roach'},
  spiderling:{r:0.18, hp:8, food:14, grow:0.04, speed:3.0, color:0x15151a, flee:1.5, name:'test spider'},
  rat:   {r:0.6,  hp:40, food:60, grow:0.18, speed:3.4, color:0x5a5048, flee:3.0, name:'lab rat'},
};
export class Prey{
  constructor(type,pos){
    const t=TYPES[type]; this.t=t; this.type=type;
    this.hp=t.hp; this.maxhp=t.hp; this.dead=false; this.eaten=false; this.cocooned=false;
    this.vel=V(0,0,0); this.pos=pos.clone();
    this.wander=Math.random()*6.28;
    this.group=new THREE.Group(); this.group.position.copy(pos);
    this._mesh(t);
  }
  _mesh(t){
    const mat=new THREE.MeshStandardMaterial({color:t.color,roughness:0.6,metalness:0.1});
    if(this.type==='fly'){
      const b=new THREE.Mesh(new THREE.SphereGeometry(t.r,8,8),mat); b.scale.set(1,0.8,1.4); this.group.add(b);
      const wm=new THREE.MeshStandardMaterial({color:0xcccccc,transparent:true,opacity:0.4,roughness:0.2});
      for(const s of[-1,1]){const w=new THREE.Mesh(new THREE.PlaneGeometry(t.r*2,t.r),wm);w.position.set(s*t.r,t.r*0.4,0);w.rotation.y=s*0.4;this.group.add(w);this['w'+(s>0?'R':'L')]=w;}
    } else if(this.type==='rat'){
      const b=new THREE.Mesh(new THREE.SphereGeometry(t.r,12,12),mat); b.scale.set(1,0.7,1.6); this.group.add(b);
      const h=new THREE.Mesh(new THREE.SphereGeometry(t.r*0.5,10,10),mat); h.position.set(0,0,t.r*1.3); this.group.add(h);
      const tail=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.01,t.r*2.5,6),new THREE.MeshStandardMaterial({color:0xc090a0,roughness:0.7}));
      tail.rotation.x=Math.PI/2.2; tail.position.set(0,0,-t.r*1.8); this.group.add(tail);
      for(const sx of[-1,1])for(const sz of[-1,1]){const l=new THREE.Mesh(new THREE.CapsuleGeometry(0.04,t.r*0.6,2,5),mat);l.position.set(sx*t.r*0.6,-t.r*0.5,sz*t.r*0.8);this.group.add(l);}
    } else {
      const b=new THREE.Mesh(new THREE.SphereGeometry(t.r,10,10),mat); b.scale.set(1,0.7,1.3); this.group.add(b);
      // legs
      for(const s of[-1,1])for(let i=0;i<3;i++){const l=new THREE.Mesh(new THREE.CapsuleGeometry(0.02,t.r*1.1,2,4),mat);l.position.set(s*t.r,0,(i-1)*t.r*0.6);l.rotation.z=s*0.9;this.group.add(l);}
    }
    this.group.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  }
  update(dt, playerPos, surfaces){
    if(this.eaten||this.cocooned)return;
    const t=this.t;
    const toP=playerPos.clone().sub(this.pos); const d=toP.length();
    let dir;
    if(d<t.flee){ dir=toP.clone().multiplyScalar(-1).setY(0).normalize(); this.alert=1; }
    else { this.wander+=(Math.random()-0.5)*dt*3; dir=V(Math.sin(this.wander),0,Math.cos(this.wander)); this.alert=(this.alert||0)*0.95; }
    const sp=t.speed*(d<t.flee?1.3:0.5);
    this.vel.lerp(dir.multiplyScalar(sp),0.1);
    this.pos.addScaledVector(this.vel,dt);
    // keep on floor-ish
    this.pos.y=Math.max(t.r*0.7, this.pos.y);
    // clamp to room
    this.pos.x=Math.max(-19,Math.min(19,this.pos.x)); this.pos.z=Math.max(-14,Math.min(14,this.pos.z));
    this.group.position.copy(this.pos);
    if(this.vel.lengthSq()>1e-3) this.group.rotation.y=Math.atan2(this.vel.x,this.vel.z);
    // wing flap
    if(this.wL){const f=Math.sin(performance.now()*0.05)*0.6;this.wL.rotation.z=f;this.wR.rotation.z=-f; this.pos.y=t.r*2+Math.sin(performance.now()*0.004)*0.3;}
  }
}
