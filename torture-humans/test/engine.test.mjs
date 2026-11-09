import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Settings, DEFAULT_SETTINGS, GRAPHICS_PRESETS } from '../src/game/engine/settings.js';
import { extractRootMotion, solveTwoBone } from '../src/game/engine/anim.js';
import { keyLabel } from '../src/game/engine/input.js';

function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m };
}

test('settings: defaults, presets, custom, persistence', () => {
  const st = memStorage();
  const s = new Settings(st);
  assert.equal(s.get('graphics.preset'), 'high');
  s.set({ graphics: { preset: 'low' } });
  assert.equal(s.get('graphics.ssao'), GRAPHICS_PRESETS.low.ssao);
  assert.equal(s.get('graphics.resolutionScale'), 0.75);
  s.set('graphics.ssao', true); // changing a detail makes it "custom"
  assert.equal(s.get('graphics.preset'), 'custom');
  assert.equal(s.get('graphics.ssao'), true);
  const again = new Settings(st);
  assert.equal(again.get('graphics.ssao'), true);
  assert.equal(again.get('graphics.preset'), 'custom');
});

test('settings: broken or hostile saves never break the game', () => {
  const bad = memStorage({ 'th.settings.v1': JSON.stringify({ graphics: { fov: 'lots', ssao: 'yes' }, controls: { bindings: { jump: ['KeyJ'] } }, junk: 1 }) });
  const s = new Settings(bad);
  assert.equal(s.get('graphics.fov'), DEFAULT_SETTINGS.graphics.fov);
  assert.equal(s.get('graphics.ssao'), DEFAULT_SETTINGS.graphics.ssao);
  assert.deepEqual(s.get('controls.bindings'), { jump: ['KeyJ'] });
  assert.equal(s.get('junk'), undefined);
  const notJson = new Settings(memStorage({ 'th.settings.v1': '{oops' }));
  assert.equal(notJson.get('gameplay.gore'), 'some');
});

test('root motion is removed and turned into speed', () => {
  // 1.2 m forward in 1.2 s with a bob: speed 1 m/s, travel removed, bob kept
  const times = [0, 0.3, 0.6, 0.9, 1.2];
  const values = [];
  times.forEach((t, i) => values.push(0.01 * i, 0.9 + (i % 2) * 0.03, t));
  const clip = new THREE.AnimationClip('walk', 1.2, [new THREE.VectorKeyframeTrack('Bip01.position', times, values)]);
  const speed = extractRootMotion(clip);
  assert.ok(Math.abs(speed - Math.hypot(0.04, 1.2) / 1.2) < 1e-6);
  const v = clip.tracks[0].values;
  for (let i = 0; i < times.length; i++) {
    assert.ok(Math.abs(v[i * 3]) < 1e-6);
    assert.ok(Math.abs(v[i * 3 + 2]) < 1e-6);
  }
  assert.ok(Math.abs(v[4] - 0.93) < 1e-6, 'vertical bob kept');
  const idle = new THREE.AnimationClip('idle', 2, []);
  assert.equal(extractRootMotion(idle), 0);
});

test('two-bone IK puts the foot on the target', () => {
  const root = new THREE.Object3D();
  const thigh = new THREE.Bone();
  const calf = new THREE.Bone();
  const foot = new THREE.Bone();
  root.add(thigh); thigh.add(calf); calf.add(foot);
  thigh.position.set(0, 1, 0);
  calf.position.set(0, -0.45, 0.02);   // slight bend so the knee direction is known
  foot.position.set(0, -0.45, -0.02);
  root.updateMatrixWorld(true);
  const target = new THREE.Vector3(0.1, 0.25, 0.1);
  solveTwoBone(thigh, calf, foot, target, 1);
  root.updateMatrixWorld(true);
  const got = foot.getWorldPosition(new THREE.Vector3());
  assert.ok(got.distanceTo(target) < 0.01, `foot ${got.toArray()} vs ${target.toArray()}`);
  // bone lengths never change
  assert.ok(Math.abs(calf.position.length() - Math.hypot(0.45, 0.02)) < 1e-9);
});

test('key labels read nicely', () => {
  assert.equal(keyLabel('KeyW'), 'W');
  assert.equal(keyLabel('Digit3'), '3');
  assert.equal(keyLabel('Mouse0'), 'Left click');
  assert.equal(keyLabel(null), '—');
});
