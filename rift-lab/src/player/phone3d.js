// The Vireo phone in your right hand. A real 3D phone (aluminum frame, glass, camera bump)
// held up in front of you; its screen is real HTML stretched exactly onto the glass
// (a perspective "homography"), so you tap it with the mouse while the world keeps going.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const PW = 0.0715, PH = 0.147, PD = 0.0079;
const SW = 0.0662, SH = 0.1424; // screen glass size
export const SCREEN_PX = { w: 393, h: 852 };

function skin(color = 0xc68e6b) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color(0xffd2b8), clearcoat: 0.05 });
}

export class Phone3D {
  constructor(camera, { skinColor } = {}) {
    this.camera = camera;
    this.root = new THREE.Group();
    this.root.name = 'phone';
    this.root.visible = false;
    camera.add(this.root);

    const frame = new THREE.MeshStandardMaterial({ color: 0x8c9096, metalness: 0.85, roughness: 0.32 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x050607, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02 });
    const backGlass = new THREE.MeshPhysicalMaterial({ color: 0x3b4a5c, roughness: 0.35, metalness: 0.1, clearcoat: 0.6 });
    const phone = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(PW, PH, PD, 4, 0.0095), frame);
    phone.add(body);
    const front = new THREE.Mesh(new RoundedBoxGeometry(PW - 0.0012, PH - 0.0012, 0.0006, 4, 0.009), glass);
    front.position.z = PD / 2 - 0.0002;
    phone.add(front);
    const back = new THREE.Mesh(new RoundedBoxGeometry(PW - 0.0012, PH - 0.0012, 0.0006, 4, 0.009), backGlass);
    back.position.z = -PD / 2 + 0.0002;
    phone.add(back);
    // camera bump with 3 lenses + flash (on the back, top left when viewed from the back)
    const bump = new THREE.Mesh(new RoundedBoxGeometry(0.034, 0.035, 0.0026, 3, 0.006), backGlass);
    bump.position.set(PW / 2 - 0.022, PH / 2 - 0.022, -PD / 2 - 0.0012);
    phone.add(bump);
    const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0b10, roughness: 0.02, metalness: 0.3, clearcoat: 1 });
    for (const [x, y] of [[0.0075, 0.0085], [0.0075, -0.0085], [-0.0085, 0]]) {
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.0022, 24), lensMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(bump.position.x + x, bump.position.y + y, -PD / 2 - 0.0028);
      phone.add(lens);
    }
    this.flashMat = new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0x000000 });
    const flash = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.001, 12), this.flashMat);
    flash.rotation.x = Math.PI / 2;
    flash.position.set(bump.position.x - 0.0085, bump.position.y - 0.012, -PD / 2 - 0.0026);
    phone.add(flash);
    // side buttons
    for (const [y, h] of [[0.03, 0.022]]) { const b = new THREE.Mesh(new RoundedBoxGeometry(0.0012, h, 0.003, 2, 0.0005), frame); b.position.set(PW / 2 + 0.0004, y, 0); phone.add(b); }
    for (const y of [0.035, 0.012]) { const b = new THREE.Mesh(new RoundedBoxGeometry(0.0012, 0.016, 0.003, 2, 0.0005), frame); b.position.set(-PW / 2 - 0.0004, y, 0); phone.add(b); }
    this.phone = phone;
    this.root.add(phone);

    // right hand holding it: palm behind, fingers around the left edge, thumb on the right
    const sk = skin(skinColor);
    const hand = new THREE.Group();
    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.085, 0.03, 4, 0.013), sk);
    palm.position.set(0.012, -0.052, -PD / 2 - 0.016);
    palm.rotation.z = -0.15;
    hand.add(palm);
    const fingerGeo = (len) => new THREE.CapsuleGeometry(0.0085, len, 4, 10);
    [[-0.002, 0.016], [-0.024, 0.017], [-0.046, 0.016], [-0.066, 0.013]].forEach(([y, len], i) => {
      const f = new THREE.Mesh(fingerGeo(len), sk);
      f.rotation.set(0, Math.PI / 2, Math.PI / 2 - 0.15);
      f.position.set(-PW / 2 - 0.004, y, -0.003 - i * 0.0005);
      hand.add(f);
      const tip = new THREE.Mesh(fingerGeo(0.012), sk);
      tip.rotation.set(Math.PI / 2, 0, 0);
      tip.position.set(-PW / 2 + 0.002, y, PD / 2 + 0.002);
      tip.scale.set(1, 0.8, 1);
      hand.add(tip);
    });
    const thumb = new THREE.Mesh(fingerGeo(0.045), sk);
    thumb.position.set(PW / 2 + 0.004, -0.045, 0.004);
    thumb.rotation.z = 0.35;
    hand.add(thumb);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.033, 0.28, 6, 16), sk);
    arm.position.set(0.05, -0.22, -0.06);
    arm.rotation.set(-0.5, 0, 0.35);
    hand.add(arm);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.055, 0.22, 20), new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.9 }));
    sleeve.position.set(0.085, -0.33, -0.12);
    sleeve.rotation.set(-0.5, 0, 0.35);
    hand.add(sleeve);
    this.root.add(hand);

    // pose: up (looking at it) vs down (out of view)
    // held close + near the middle, like when you really read your phone
    this.up = { p: new THREE.Vector3(0.032, -0.022, -0.168), r: new THREE.Euler(0.06, -0.12, 0.02) };
    this.down = { p: new THREE.Vector3(0.17, -0.42, -0.2), r: new THREE.Euler(1.1, -0.4, 0.3) };
    this.t = 0;          // 0 down .. 1 up
    this.target = 0;
    this.corners = [new THREE.Vector3(-SW / 2, SH / 2, PD / 2 + 0.0002), new THREE.Vector3(SW / 2, SH / 2, PD / 2 + 0.0002), new THREE.Vector3(-SW / 2, -SH / 2, PD / 2 + 0.0002), new THREE.Vector3(SW / 2, -SH / 2, PD / 2 + 0.0002)];
    this.time = 0;
  }

  get isUp() { return this.t > 0.98; }

  setUp(up) { this.target = up ? 1 : 0; }

  setFlash(on) { this.flashMat.emissive.setHex(on ? 0xfff4d6 : 0x000000); this.flashMat.emissiveIntensity = on ? 4 : 0; }

  update(dt, moving) {
    this.time += dt;
    const speed = 4.2;
    this.t += Math.sign(this.target - this.t) * Math.min(Math.abs(this.target - this.t), dt * speed);
    const e = this.t < 0.5 ? 2 * this.t * this.t : 1 - Math.pow(-2 * this.t + 2, 2) / 2; // ease in-out
    this.root.visible = this.t > 0.001;
    this.root.position.lerpVectors(this.down.p, this.up.p, e);
    const q1 = new THREE.Quaternion().setFromEuler(this.down.r), q2 = new THREE.Quaternion().setFromEuler(this.up.r);
    this.root.quaternion.slerpQuaternions(q1, q2, e);
    // tiny hand sway (breathing, walking)
    const sway = moving ? 0.004 : 0.0012;
    this.root.position.x += Math.sin(this.time * (moving ? 7 : 1.3)) * sway;
    this.root.position.y += Math.abs(Math.cos(this.time * (moving ? 7 : 1.1))) * sway;
  }

  // CSS matrix3d that maps the HTML screen (393x852 px) onto the glass as seen by the camera
  screenTransform(viewW, viewH) {
    this.root.updateMatrixWorld(true);
    const pts = this.corners.map((c) => {
      const v = c.clone().applyMatrix4(this.phone.matrixWorld).project(this.camera);
      return [(v.x * 0.5 + 0.5) * viewW, (-v.y * 0.5 + 0.5) * viewH];
    });
    return homography(SCREEN_PX.w, SCREEN_PX.h, pts);
  }
}

// Solve the projective transform from a w×h rectangle to 4 points (tl, tr, bl, br).
function homography(w, h, [p0, p1, p2, p3]) {
  const src = [[0, 0], [w, 0], [0, h], [w, h]];
  const dst = [p0, p1, p2, p3];
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const hv = solve(A, b);
  if (!hv) return null;
  const [a, bb, c, d, e, f, g, hh] = hv;
  // 3x3 [a b c; d e f; g h 1] -> CSS matrix3d (column-major)
  return `matrix3d(${a},${d},0,${g},${bb},${e},0,${hh},0,0,1,0,${c},${f},0,1)`;
}

function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let k = col; k <= n; k++) M[r][k] -= f * M[col][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}
