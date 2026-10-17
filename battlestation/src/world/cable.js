import * as THREE from 'three';
import { mesh, box } from './build.js';

// A cable between two things. The plug end can be pulled out: it then hangs loose
// next to the socket. The tube is rebuilt while it moves, so it always looks connected.
export class Cable {
  constructor(parent, o) {
    this.parent = parent;
    this.o = { radius: 0.0028, color: 0x111111, sag: 0.08, segments: 48, plug: 'barrel', ...o };
    this.mat = new THREE.MeshStandardMaterial({ color: this.o.color, roughness: 0.55, metalness: 0 });
    this.plugMat = new THREE.MeshStandardMaterial({ color: this.o.plugColor ?? 0x161616, roughness: 0.45 });
    this.plugged = o.plugged ?? true;
    this.t = this.plugged ? 1 : 0;
    this.mesh = null;
    const sizes = { barrel: [0.012, 0.012, 0.03], rj45: [0.013, 0.011, 0.026], coax: [0.011, 0.011, 0.024], iec: [0.03, 0.02, 0.035], usb: [0.012, 0.006, 0.022], plug: [0.034, 0.024, 0.04] };
    const s = sizes[this.o.plug] || sizes.barrel;
    this.head = mesh(box(s[0], s[1], s[2], 0.002), this.plugMat, { parent });
    this.head.name = 'plug';
    this.build();
  }

  // points: start -> (mid points) -> end; end moves between "in" and "out" positions
  endPos() { return new THREE.Vector3().lerpVectors(this.o.out, this.o.in, this.t); }

  build() {
    const a = this.o.from, e = this.endPos();
    const pts = [a];
    for (const m of this.o.via || []) pts.push(m);
    // a little sag in the middle of the last stretch
    const last = pts[pts.length - 1];
    const mid = new THREE.Vector3().lerpVectors(last, e, 0.5);
    mid.y -= this.o.sag * (0.6 + 0.4 * (1 - this.t));
    pts.push(mid);
    // straight run into the socket
    const dir = this.o.inDir ? this.o.inDir.clone() : new THREE.Vector3(0, 0, 0);
    const lead = e.clone().addScaledVector(dir, -0.05 * this.t - 0.02);
    if (this.t > 0.05) pts.push(lead);
    pts.push(e);
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const g = new THREE.TubeGeometry(curve, this.o.segments, this.o.radius, 8, false);
    if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.geometry = g; }
    else this.mesh = mesh(g, this.mat, { parent: this.parent, name: 'cable' });
    this.head.position.copy(e);
    const tan = curve.getTangent(1);
    this.head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
    this.head.position.addScaledVector(tan, -this.head.geometry.parameters?.depth / 2 || -0.012);
  }

  set(plugged) { this.plugged = plugged; }

  update(dt) {
    const target = this.plugged ? 1 : 0;
    if (Math.abs(this.t - target) < 1e-3) return;
    this.t += Math.sign(target - this.t) * Math.min(Math.abs(target - this.t), dt * 4);
    this.build();
  }
}
