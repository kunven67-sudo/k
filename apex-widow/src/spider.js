import * as THREE from 'three';

// ---- Procedural black widow (Latrodectus) ----
// Real-ish proportions: small cephalothorax, big round shiny abdomen,
// 8 legs in 2-segment IK, red hourglass, fangs, 8 eyes.

const V = (x,y,z)=>new THREE.Vector3(x,y,z);

export class Spider {
  constructor(opts={}){
    this.group = new THREE.Group();          // world transform (pos + orient to surface)
    this.body = new THREE.Group();            // body bob/roll local to group
    this.group.add(this.body);
    this.legs = [];
    this.scale = 1;                           // body "radius" meters (legspan ~ scale*3)
    this.up = V(0,1,0);                        // current surface normal
    this.heading = 0;                          // yaw around up
    this.phase = 0;
    this.quality = opts.quality ?? 'high';
    this._build();
  }

  _mat(hex, rough, metal, emis){
    const m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal });
    if (emis){ m.emissive = new THREE.Color(emis); m.emissiveIntensity = 0.9; }
    return m;
  }

  _build(){
    const hi = this.quality !== 'low';
    const sd = hi ? 20 : 10;
    // sheen-black carapace material
    const black = this._mat(0x0a0a0d, 0.28, 0.12);
    const hairy = this._mat(0x111114, 0.6, 0.05);
    const red   = this._mat(0xcc0d16, 0.35, 0.0, 0x400000);

    // Abdomen: big round, slightly egg-shaped, shiny
    const abGeo = new THREE.SphereGeometry(0.62, sd, sd);
    abGeo.scale(1.0, 0.92, 1.12);
    const abdomen = new THREE.Mesh(abGeo, black);
    abdomen.position.set(0, 0.46, -0.55);
    abdomen.castShadow = true;
    this.body.add(abdomen);
    this.abdomen = abdomen;

    // Red hourglass on the UNDERSIDE of the abdomen (two triangles tip to tip)
    const hg = new THREE.Group();
    for (const s of [1,-1]){
      const tg = new THREE.ConeGeometry(0.17, 0.22, 3);
      const tm = new THREE.Mesh(tg, red);
      tm.rotation.x = Math.PI/2;
      tm.position.set(0, 0, s*0.11);
      tm.scale.set(1,1,0.5);
      hg.add(tm);
    }
    hg.position.set(0, -0.5, 0.05);
    hg.rotation.x = -0.25;
    abdomen.add(hg);

    // Cephalothorax: smaller flattened dome up front
    const ctGeo = new THREE.SphereGeometry(0.33, sd, sd);
    ctGeo.scale(1.05, 0.62, 1.15);
    const cephalo = new THREE.Mesh(ctGeo, black);
    cephalo.position.set(0, 0.34, 0.33);
    cephalo.castShadow = true;
    this.body.add(cephalo);
    this.cephalo = cephalo;

    // waist (pedicel)
    const waist = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), black);
    waist.position.set(0, 0.4, -0.07);
    this.body.add(waist);

    // 8 eyes (two rows) on front of cephalo
    if (hi){
      const eyeMat = this._mat(0x090909, 0.15, 0.6, 0x120a0a);
      const glint = this._mat(0x663, 0.1, 0.9);
      const eyePos = [
        [-0.09,0.12,0.26],[-0.03,0.14,0.28],[0.03,0.14,0.28],[0.09,0.12,0.26],
        [-0.13,0.06,0.24],[-0.05,0.08,0.27],[0.05,0.08,0.27],[0.13,0.06,0.24],
      ];
      for (const [x,y,z] of eyePos){
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.035,8,8), eyeMat);
        e.position.set(x,y,z); cephalo.add(e);
      }
    }

    // chelicerae + fangs
    const fangMat = this._mat(0x1a0a0a, 0.3, 0.2);
    const chel = new THREE.Group();
    for (const s of [-1,1]){
      const base = new THREE.Mesh(new THREE.CapsuleGeometry(0.05,0.12,3,6), black);
      base.position.set(s*0.07,0.0,0.3); base.rotation.x=0.4; cephalo.add(base);
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.03,0.17,6), fangMat);
      fang.position.set(s*0.07,-0.12,0.37); fang.rotation.x=0.8;
      cephalo.add(fang);
    }
    // pedipalps
    for (const s of [-1,1]){
      const p = new THREE.Mesh(new THREE.CapsuleGeometry(0.04,0.18,3,6), hairy);
      p.position.set(s*0.14,0.02,0.33); p.rotation.set(0.6,s*0.3,0); cephalo.add(p);
    }

    // 8 legs: 4 per side. Attach near cephalo/abdomen junction.
    // Each leg = upper (coxa+femur) + lower (tibia+tarsus) with IK.
    const sideAngles = [0.95, 0.42, -0.18, -0.78]; // front→back yaw offset per leg
    const sideReach  = [1.9, 2.3, 2.25, 1.8];      // how far the foot sits out
    for (const side of [-1,1]){
      for (let i=0;i<4;i++){
        const yaw = sideAngles[i]*0;
        const leg = this._makeLeg(hairy, hi);
        leg.side = side; leg.idx = i;
        // rest direction in body space (outward + a bit forward/back)
        const baseYaw = side*(Math.PI/2) ; // outward
        const spread = sideAngles[i];
        const dir = new THREE.Vector2(Math.sin(baseYaw)+ (side*0), 0);
        leg.restDir = new THREE.Vector3(
          side*Math.cos(spread), 0, Math.sin(spread)
        ).normalize();
        leg.reach = sideReach[i];
        leg.hip = V(side*0.22, 0.4, 0.2 - i*0.18);
        leg.group.position.copy(leg.hip);
        leg.foot = leg.hip.clone().addScaledVector(leg.restDir, leg.reach*0.5);
        leg.foot.y = 0;
        leg.target = leg.foot.clone();
        leg.stepT = 1; leg.stepping=false;
        // stance group opposite feet step together (tetrapod gait)
        leg.gaitGroup = (i + (side>0?0:1)) % 2;
        this.body.add(leg.group);
        this.legs.push(leg);
      }
    }
    this.group.scale.setScalar(this.scale);
  }

  _makeLeg(mat, hi){
    const g = new THREE.Group();
    const seg = hi ? 7 : 5;
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.055,0.9,3,seg), mat);
    upper.castShadow = true;
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.035,1.0,3,seg), mat);
    lower.castShadow = true;
    const foot = new THREE.Mesh(new THREE.ConeGeometry(0.04,0.18,seg), mat);
    g.add(upper); g.add(lower); g.add(foot);
    return { group:g, upper, lower, foot:null, meshes:{upper,lower,footM:foot} };
  }

  // Place one leg's two segments so the tip reaches `worldFoot` from `hipWorld`.
  _solveLeg(leg, bob){
    // Work in body-local space.
    const hip = leg.hip.clone(); hip.y = 0.4 + bob;
    const foot = this._toLocal(leg.target);
    const L1 = 0.95, L2 = 1.05;
    const dir = foot.clone().sub(hip);
    let d = dir.length();
    d = Math.min(d, L1+L2-0.02);
    const dn = dir.clone().normalize();
    // elbow raised outward+up (knee bend)
    const up = V(0,1,0);
    const side = dn.clone().cross(up).normalize();
    // law of cosines for elbow height
    const a = (L1*L1 - L2*L2 + d*d)/(2*d);
    const h = Math.sqrt(Math.max(0, L1*L1 - a*a));
    const mid = hip.clone().addScaledVector(dn, a).addScaledVector(up, h*0.9);
    // position upper
    const ms = leg.meshes;
    this._aim(ms.upper, hip, mid);
    this._aim(ms.lower, mid, foot);
    ms.footM.position.copy(foot);
    this._aim(ms.footM, foot, foot.clone().addScaledVector(dn,0.1).setY(foot.y-0.1));
  }

  _aim(mesh, a, b){
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mesh.position.copy(mid);
    const len = a.distanceTo(b);
    mesh.scale.y = Math.max(0.1, len / (mesh.geometry.parameters.length + mesh.geometry.parameters.radius*2 || 1));
    const dir = b.clone().sub(a).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(V(0,1,0), dir);
    mesh.quaternion.copy(q);
  }

  _toLocal(worldOrBodyPoint){
    // our targets are stored in body-local already (flat around hips)
    return worldOrBodyPoint.clone();
  }

  setScale(s){ this.scale = s; this.group.scale.setScalar(s); }

  // move: planar dir (x,z) in world, speed meters/s, up normal from surface
  update(dt, moveDir, speed, up){
    this.phase += dt * (2.5 + speed*0.4);
    if (up) this.up.copy(up);
    const moving = moveDir.lengthSq() > 1e-4;
    const bob = moving ? Math.sin(this.phase*2)*0.04 : 0;
    this.body.position.y = 0;
    this.body.rotation.z = Math.sin(this.phase)*0.015*(moving?1:0);

    // step legs: targets drift ahead of body; when too far, step to new spot
    const stepLen = 1.1;
    const heading = moveDir.clone().normalize();
    for (const leg of this.legs){
      // desired foot = hip + restDir*reach*0.5 + lead in move direction
      const rest = leg.restDir.clone().multiplyScalar(leg.reach*0.55);
      const want = leg.hip.clone().add(rest);
      if (moving){
        // lead foot forward in local move dir (approx: moveDir rotated into body frame)
        const lead = new THREE.Vector3(moveDir.x, 0, moveDir.z).multiplyScalar(stepLen*0.5);
        want.add(lead);
      }
      want.y = 0;
      const far = leg.target.distanceTo(want);
      const groupPhase = (Math.sin(this.phase*2 + leg.gaitGroup*Math.PI) > 0);
      if (!leg.stepping && far > (moving?0.6:1.2) && (groupPhase||!moving)){
        leg.stepping = true; leg.stepT = 0; leg.stepFrom = leg.target.clone(); leg.stepTo = want.clone();
      }
      if (leg.stepping){
        leg.stepT += dt*7;
        const t = Math.min(1, leg.stepT);
        const lift = Math.sin(t*Math.PI)*0.45;
        leg.target.lerpVectors(leg.stepFrom, leg.stepTo, t);
        leg.target.y = lift;
        if (t>=1){ leg.stepping=false; leg.target.copy(leg.stepTo); leg.target.y=0; }
      }
      this._solveLeg(leg, bob);
    }
  }

  dispose(){
    this.group.traverse(o=>{ if(o.geometry)o.geometry.dispose(); if(o.material)o.material.dispose&&o.material.dispose(); });
  }
}
