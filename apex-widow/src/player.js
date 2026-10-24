import * as THREE from 'three';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const UP=V(0,1,0);

// Third-person surface-walking controller. The spider sticks to whatever
// surface is under its feet (floor, wall, ceiling, props) via raycasts.
export class Controller {
  constructor(spider, camera, dom){
    this.sp=spider; this.cam=camera; this.dom=dom;
    this.pos=V(-6,1.25,-2);          // start in the tank
    this.up=V(0,1,0);
    this.fwd=V(0,0,1);
    this.yaw=0; this.pitch=0.35; this.camYaw=0; this.camPitch=0.3;
    this.vel=V(0,0,0);
    this.keys={};
    this.camDist=6;
    this.climbing=true;
    this.locked=false;
    this.sens=0.0025;
    this.speedBase=6;
    this.enabled=false;
    this._bind();
  }
  _bind(){
    addEventListener('keydown',e=>{this.keys[e.code]=true;});
    addEventListener('keyup',e=>{this.keys[e.code]=false;});
    this.dom.addEventListener('click',()=>{ if(this.enabled && !this.locked) this.dom.requestPointerLock&&this.dom.requestPointerLock(); });
    document.addEventListener('pointerlockchange',()=>{ this.locked=document.pointerLockElement===this.dom; });
    addEventListener('mousemove',e=>{
      if(!this.locked)return;
      this.camYaw -= e.movementX*this.sens;
      this.camPitch = Math.max(-0.4, Math.min(1.2, this.camPitch + e.movementY*this.sens));
    });
    addEventListener('wheel',e=>{ this.camDist=Math.max(3,Math.min(18,this.camDist+Math.sign(e.deltaY)*0.6)); },{passive:true});
  }
  // raycast helpers against climb surfaces
  _ray(origin,dir,surfaces,far=4){
    this._rc=this._rc||new THREE.Raycaster();
    this._rc.set(origin,dir.clone().normalize()); this._rc.far=far;
    const hits=this._rc.intersectObjects(surfaces,false);
    return hits[0]||null;
  }
  update(dt, world){
    const surf=world.climb;
    // camera basis built around current up
    const camUp=this.up;
    // movement input in camera space projected onto surface tangent
    let f=0,s=0;
    if(this.keys['KeyW'])f+=1; if(this.keys['KeyS'])f-=1;
    if(this.keys['KeyA'])s-=1; if(this.keys['KeyD'])s+=1;
    const sprint=this.keys['ShiftLeft']||this.keys['ShiftRight'];
    const sizeSpeed=Math.min(3, 1+Math.log2(Math.max(1,this.sp.scale))*0.25);
    const speed=this.speedBase*(sprint?1.9:1)*sizeSpeed;

    // forward from camera yaw, flattened to surface
    const camDir=V(Math.sin(this.camYaw),0,Math.cos(this.camYaw));
    let fwd=camDir.clone().projectOnPlane(this.up).normalize();
    if(fwd.lengthSq()<1e-3) fwd=this.fwd.clone();
    const right=fwd.clone().cross(this.up).normalize();
    const move=fwd.multiplyScalar(f).add(right.multiplyScalar(s));
    const moving=move.lengthSq()>1e-4;
    if(moving) move.normalize();

    // proposed new position
    const step=move.clone().multiplyScalar(speed*dt);
    let np=this.pos.clone().add(step);

    // stick to surface: cast from above feet along -up
    const probeUp=this.up.clone();
    let hit=this._ray(np.clone().addScaledVector(probeUp,0.8), probeUp.clone().negate(), surf, 2.2);
    if(hit){
      np.copy(hit.point).addScaledVector(hit.face.normal.clone().transformDirection(hit.object.matrixWorld),0.05);
      const n=hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
      this.up.lerp(n,0.3).normalize();
    } else if(moving){
      // no floor under feet → try to climb onto a wall ahead (edge transition)
      const ahead=this._ray(this.pos.clone().addScaledVector(this.up,0.3), move, surf, 1.2);
      if(ahead){
        const n=ahead.face.normal.clone().transformDirection(ahead.object.matrixWorld).normalize();
        this.up.copy(n);
        np.copy(ahead.point).addScaledVector(n,0.05);
      } else {
        // walk over edge onto underside/next face: search downward further
        const far=this._ray(np.clone().addScaledVector(probeUp,0.3), probeUp.clone().negate(), surf, 3.5);
        if(far){ np.copy(far.point).addScaledVector(far.face.normal.clone().transformDirection(far.object.matrixWorld),0.05); }
      }
    }
    this.pos.copy(np);

    // heading: face move dir
    if(moving){ this.fwd.lerp(move,0.25).normalize(); }

    // build spider orientation from up + fwd
    const f2=this.fwd.clone().projectOnPlane(this.up).normalize();
    const r2=f2.clone().cross(this.up).normalize();
    const m=new THREE.Matrix4().makeBasis(r2, this.up, f2.clone().negate());
    this.sp.group.position.copy(this.pos);
    this.sp.group.quaternion.setFromRotationMatrix(m);
    this.sp.update(dt, moving?move:V(0,0,0), moving?speed:0, this.up);

    this._camera(dt);
    this.moving=moving;
  }
  _camera(dt){
    const up=this.up;
    const camDir=V(Math.sin(this.camYaw),0,Math.cos(this.camYaw));
    const flatFwd=camDir.clone().projectOnPlane(up).normalize();
    const pitch=this.camPitch;
    const back=flatFwd.clone().multiplyScalar(-Math.cos(pitch)).add(up.clone().multiplyScalar(Math.sin(pitch)+0.3));
    const dist=this.camDist*Math.max(0.6,Math.min(6,this.sp.scale*0.9));
    const want=this.pos.clone().addScaledVector(back.normalize(), dist).addScaledVector(up,dist*0.15);
    this.cam.position.lerp(want, 1-Math.pow(0.001,dt));
    const look=this.pos.clone().addScaledVector(up, this.sp.scale*0.6);
    this.cam.up.lerp(up,0.1).normalize();
    this.cam.lookAt(look);
  }
}
