import * as THREE from 'three';

// Whole-body poses built on the avatar helpers. Everything works in world space:
// you give a spot + facing direction, the body arranges itself there.
const UP = new THREE.Vector3(0, 1, 0);

// Put the avatar root so that the pelvis lands on `pelvisWorld`, body facing `yaw` (0 = +z).
export function placeRoot(av, pelvisWorld, yaw, pitch = 0) {
  const r = av.root;
  r.rotation.set(pitch, yaw, 0, 'YXZ');
  r.position.set(0, 0, 0);
  r.updateMatrixWorld(true);
  const off = av.restPelvis.clone().applyEuler(r.rotation);
  r.position.copy(pelvisWorld).sub(off);
  r.updateMatrixWorld(true);
}

function basis(yaw) {
  const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw)); // avatar's right (it faces +z at yaw 0, right is -x)
  return { fwd, right };
}

// Legs for sitting on a seat: knees forward, shins down, feet flat on the floor.
export function sitLegs(av, yaw, floorY = 0, spread = 0.06, kneeFwd = 0.43) {
  const { fwd, right } = basis(yaw);
  for (const [side, s] of [['l', -1], ['r', 1]]) {
    const hip = av.pos('thigh_' + side);
    const knee = hip.clone().addScaledVector(fwd, kneeFwd).addScaledVector(right, s * spread).add(new THREE.Vector3(0, -0.02, 0));
    av.pointBone('thigh_' + side, knee.clone().sub(hip));
    const k = av.pos('calf_' + side);
    const ankle = new THREE.Vector3(k.x, floorY + 0.075, k.z).addScaledVector(fwd, 0.04);
    av.pointBone('calf_' + side, ankle.clone().sub(k));
    const a = av.pos('foot_' + side);
    const ball = new THREE.Vector3(a.x, floorY + 0.012, a.z).addScaledVector(fwd, 0.13);
    av.pointBone('foot_' + side, ball.clone().sub(a));
    av.pointBone('ball_' + side, fwd);
  }
}

// Legs standing / walking. phase advances with distance walked, amt = 0 standing .. 1 full stride
export function walkLegs(av, yaw, phase, amt, floorY = 0) {
  const { fwd, right } = basis(yaw);
  for (const [side, s, off] of [['l', -1, 0], ['r', 1, Math.PI]]) {
    const ph = phase + off;
    const swing = Math.sin(ph) * 0.42 * amt;
    const lift = Math.max(0, Math.cos(ph)) * 0.55 * amt;
    const hip = av.pos('thigh_' + side);
    // rotating "down" around your right axis by +a swings it forward
    const thighDir = new THREE.Vector3(0, -1, 0).applyAxisAngle(right, swing).addScaledVector(right, s * 0.025);
    const thighLen = av.bones['calf_' + side].position.length();
    av.pointBone('thigh_' + side, thighDir);
    const knee = hip.clone().addScaledVector(thighDir.normalize(), thighLen);
    const shinDir = new THREE.Vector3(0, -1, 0).applyAxisAngle(right, swing - lift);
    av.pointBone('calf_' + side, shinDir);
    void knee;
    const a = av.pos('foot_' + side);
    const toe = fwd.clone().multiplyScalar(0.13).add(new THREE.Vector3(0, -0.06 + lift * 0.05, 0));
    av.pointBone('foot_' + side, toe);
    av.pointBone('ball_' + side, fwd.clone());
    void a; void floorY;
  }
}

// Spine: lean forward by `lean` radians, twist toward yaw offset, head looks along lookDir
export function spineAndHead(av, yaw, lean, lookDir, headWeight = 1) {
  const { fwd, right } = basis(yaw);
  const segs = ['spine_01', 'spine_02', 'spine_03'];
  segs.forEach((n, i) => {
    const d = UP.clone().applyAxisAngle(right, -lean * (0.3 + i * 0.25));
    av.pointBone(n, d);
  });
  // neck takes a little of the look, head the rest
  const look = lookDir.clone().normalize();
  const neckDir = UP.clone().lerp(look, 0.18 * headWeight).normalize().applyAxisAngle(right, -lean * 0.4);
  av.pointBone('neck_01', neckDir);
  const lookFlat = new THREE.Vector3(look.x, 0, look.z);
  const f = look.lengthSq() > 0 ? look : fwd;
  const blended = fwd.clone().lerp(f, headWeight).normalize();
  const up = UP.clone().addScaledVector(lookFlat.normalize(), -look.y).normalize();
  av.orientBone('head', blended, up);
}

// Arms hanging (standing/walking) with a natural swing
export function hangArms(av, yaw, phase = 0, amt = 0) {
  const { fwd, right } = basis(yaw);
  for (const [side, s, off] of [['l', -1, Math.PI], ['r', 1, 0]]) {
    const swing = Math.sin(phase + off) * 0.3 * amt;
    const up = new THREE.Vector3(0, -1, 0).applyAxisAngle(right, -swing).addScaledVector(right, s * 0.12);
    av.pointBone('upperarm_' + side, up);
    const low = new THREE.Vector3(0, -1, 0).applyAxisAngle(right, -swing + 0.18).addScaledVector(right, s * 0.05).addScaledVector(fwd, 0.05);
    av.pointBone('lowerarm_' + side, low);
    av.orientHand(side, new THREE.Vector3(0, -1, 0).addScaledVector(fwd, 0.15), right.clone().multiplyScalar(s));
    av.relaxFingers(side, 0.4);
  }
}

// Lying on your back (bed). headDir = world direction from feet to head.
export function lieDown(av, pelvisWorld, headDir) {
  const yaw = Math.atan2(headDir.x, headDir.z);
  av.root.rotation.set(0, 0, 0);
  // stand the avatar up, then tip it backward so it lies face up with the head along headDir
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const qy = new THREE.Quaternion().setFromAxisAngle(UP, yaw + Math.PI);
  av.root.quaternion.copy(qy.multiply(q));
  av.root.position.set(0, 0, 0);
  av.root.updateMatrixWorld(true);
  const off = av.restPelvis.clone().applyQuaternion(av.root.quaternion);
  av.root.position.copy(pelvisWorld).sub(off);
  av.root.updateMatrixWorld(true);
}

// While lying: spine stays flat with the body, the head (propped on the pillow) turns toward
// where you look, arms rest along your sides / on your belly under the covers.
export function lyingPose(av, headDir, lookDir) {
  av.root.updateMatrixWorld(true);
  const toes = headDir.clone().negate();
  const right = av.pos('upperarm_r').sub(av.pos('upperarm_l')).normalize();
  // neck lifted a little by the pillow
  av.pointBone('neck_01', headDir.clone().addScaledVector(UP, 0.45).normalize());
  const look = lookDir.clone().normalize();
  const face = UP.clone().lerp(look, 0.55).normalize();
  const top = headDir.clone().addScaledVector(face, -headDir.dot(face)).normalize();
  av.orientBone('head', face, top);
  // legs straight and close together, feet pointing up (toes make the duvet bump)
  for (const [side, s] of [['l', -1], ['r', 1]]) {
    av.pointBone('thigh_' + side, toes.clone().addScaledVector(right, s * 0.035).addScaledVector(UP, 0.02).normalize());
    av.pointBone('calf_' + side, toes.clone().addScaledVector(right, s * 0.01).addScaledVector(UP, -0.03).normalize());
    av.pointBone('foot_' + side, UP.clone().multiplyScalar(0.55).add(toes).addScaledVector(right, s * 0.3).normalize());
    av.pointBone('ball_' + side, UP.clone().multiplyScalar(0.3).add(toes).addScaledVector(right, s * 0.3).normalize());
  }
  for (const [side, s] of [['l', -1], ['r', 1]]) {
    av.pointBone('upperarm_' + side, toes.clone().addScaledVector(right, s * 0.18).addScaledVector(UP, -0.08).normalize());
    av.pointBone('lowerarm_' + side, toes.clone().addScaledVector(UP, 0.06).addScaledVector(right, s * 0.04).normalize());
    av.orientHand(side, toes.clone(), right.clone().multiplyScalar(-s).addScaledVector(UP, 0.3).normalize());
    av.relaxFingers(side, 0.5);
  }
}

// Holding something in your right hand: it sits at the bottom right of your view, and comes up
// to your mouth while you drink / eat (lift 0..1).
export function holdArm(av, lookDir, lift = 0) {
  av.root.updateMatrixWorld(true);
  const eye = av.eyeWorld(new THREE.Vector3());
  const look = lookDir.clone().normalize();
  const right = new THREE.Vector3().crossVectors(look, UP).normalize();
  const up = new THREE.Vector3().crossVectors(right, look).normalize();
  const rest = eye.clone().addScaledVector(look, 0.36).addScaledVector(up, -0.27).addScaledVector(right, 0.15);
  const mouth = eye.clone().addScaledVector(look, 0.12).addScaledVector(up, -0.11).addScaledVector(right, 0.04);
  av.armIK('r', rest.lerp(mouth, lift), right.clone().multiplyScalar(0.7).addScaledVector(UP, -0.7));
  const fingers = look.clone().addScaledVector(right, -0.6).addScaledVector(up, 0.2 + lift * 0.5).normalize();
  av.orientHand('r', fingers, right.clone().addScaledVector(up, 0.2));
  av.relaxFingers('r', 0.95);
}
