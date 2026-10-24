import * as THREE from 'three';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);

// Web system: shoot sticky lines that anchor to surfaces, zip toward the hit
// point (web zip), and wrap nearby prey in cocoons. Webs stay in the world.
export class Webs{
  constructor(scene){
    this.scene=scene; this.lines=[]; this.cocoons=[];
    this.mat=new THREE.LineBasicMaterial({color:0xf2f4ff,transparent:true,opacity:0.7});
    this.group=new THREE.Group(); scene.add(this.group);
  }
  strand(a,b){
    const g=new THREE.BufferGeometry().setFromPoints([a,b]);
    const l=new THREE.Line(g,this.mat); this.group.add(l); this.lines.push({l,born:performance.now()});
    if(this.lines.length>120){const old=this.lines.shift();this.group.remove(old.l);old.l.geometry.dispose();}
    return l;
  }
  cocoon(prey){
    if(prey.cocooned)return;
    prey.cocooned=true;
    const r=prey.t.r*1.3;
    const m=new THREE.Mesh(new THREE.SphereGeometry(r,10,10),new THREE.MeshStandardMaterial({color:0xe8eaf2,roughness:0.8,transparent:true,opacity:0.9}));
    m.scale.set(1,1.5,1); m.position.copy(prey.pos); m.position.y=r*1.4;
    this.group.add(m); prey.cocoonMesh=m;
    // silk wrap lines around it
    for(let i=0;i<8;i++){const a=V(prey.pos.x,0,prey.pos.z);const b=prey.pos.clone();b.y=r*2.8;this.strand(a.clone().add(V(Math.sin(i)*r,0,Math.cos(i)*r)),b);}
    this.cocoons.push({prey,m});
    prey.group.visible=false;
  }
  update(dt){
    const now=performance.now();
    for(const o of this.lines){ const age=(now-o.born)/1000; o.l.material.opacity=Math.max(0.12,0.7-age*0.02); }
  }
}
