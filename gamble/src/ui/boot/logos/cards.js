// Logo C: six playing cards are dealt across green felt face down, then flip one after another
// to spell G-A-M-B-L-E (each card's rank is a letter). One atlas texture holds all six faces,
// so the whole hand is two materials.

import * as THREE from 'three';
import { mat } from '../../../gfx/materials.js';
import { worldUV } from '../../../gfx/geom.js';
import { canvasTexture } from '../../../gfx/textures.js';
import { Stage, loadFonts, fitDistance, ease, clamp01 } from '../../three/stage.js';
import { uiSound, vary } from '../../sfx.js';

const WORD = ['G', 'A', 'M', 'B', 'L', 'E'];
const SUITS = ['♥', '♠', '♦', '♣', '♥', '♠'];
const RED = (s) => s === '♥' || s === '♦';
const CW = 1.6;
const CH = 2.3;
const PW = 384; // texture px per card
const PH = 552;

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function faceAtlas() {
  return canvasTexture('ui-cards-faces', PW * 6, PH, (g) => {
    g.clearRect(0, 0, PW * 6, PH);
    WORD.forEach((ch, i) => {
      const x = i * PW;
      const suit = SUITS[i];
      const ink = RED(suit) ? '#b5121b' : '#14110f';
      roundRectPath(g, x + 4, 4, PW - 8, PH - 8, 34);
      const bg = g.createLinearGradient(x, 0, x + PW, PH);
      bg.addColorStop(0, '#fffdf6');
      bg.addColorStop(1, '#efe7d4');
      g.fillStyle = bg;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = '#cbbd9c';
      g.stroke();
      // Inner frame, like a court card.
      g.strokeStyle = RED(suit) ? 'rgba(181,18,27,.35)' : 'rgba(20,17,15,.3)';
      g.lineWidth = 3;
      roundRectPath(g, x + 62, 70, PW - 124, PH - 140, 14);
      g.stroke();
      g.fillStyle = ink;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      // Corner indices (rotated copy bottom-right).
      for (const flip of [false, true]) {
        g.save();
        if (flip) {
          g.translate(x + PW, PH);
          g.rotate(Math.PI);
          g.translate(-x, 0);
        }
        g.font = '700 58px "Playfair Display", serif';
        g.fillText(ch, x + 36, 50);
        g.font = '400 44px "Playfair Display", serif';
        g.fillText(suit, x + 36, 100);
        g.restore();
      }
      // Big letter with a suit watermark behind it.
      g.globalAlpha = 0.09;
      g.font = '400 300px "Playfair Display", serif';
      g.fillText(suit, x + PW / 2, PH / 2 + 10);
      g.globalAlpha = 1;
      g.font = '700 230px "Playfair Display", serif';
      g.fillText(ch, x + PW / 2, PH / 2 + 14);
    });
  });
}

function backTexture() {
  return canvasTexture('ui-cards-back', PW, PH, (g) => {
    g.clearRect(0, 0, PW, PH);
    roundRectPath(g, 4, 4, PW - 8, PH - 8, 34);
    g.fillStyle = '#fbf7ec';
    g.fill();
    roundRectPath(g, 22, 22, PW - 44, PH - 44, 20);
    g.save();
    g.clip();
    g.fillStyle = '#8e1018';
    g.fillRect(0, 0, PW, PH);
    // Fine diamond lattice + a center medallion (casino house back).
    g.strokeStyle = 'rgba(255,225,200,.35)';
    g.lineWidth = 2;
    for (let k = -PH; k < PW + PH; k += 18) {
      g.beginPath();
      g.moveTo(k, 0);
      g.lineTo(k + PH, PH);
      g.moveTo(k, PH);
      g.lineTo(k + PH, 0);
      g.stroke();
    }
    g.fillStyle = '#8e1018';
    g.beginPath();
    g.ellipse(PW / 2, PH / 2, 92, 118, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#e8c77a';
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = '#e8c77a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '400 64px "Rye", serif';
    g.fillText('LD', PW / 2, PH / 2 - 8);
    g.font = '400 22px "Bebas Neue", sans-serif';
    g.fillText('L O A D E D   D I C E', PW / 2, PH / 2 + 52);
    g.restore();
  });
}

export async function runLogo(engine, root, skip, host) {
  await loadFonts();
  const stage = new Stage(engine, { fov: 32, background: 0x020302, envIntensity: 0.45 });
  host.stage = stage;
  const { scene, camera, tier } = stage;

  const feltMat = mat('felt', { color: 0x0f5534, dirt: 0.3, wear: 0.4 });
  const feltGeo = new THREE.PlaneGeometry(40, 30);
  feltGeo.rotateX(-Math.PI / 2);
  worldUV(feltGeo, feltMat.userData.tileMeters * 3);
  const felt = new THREE.Mesh(feltGeo, feltMat);
  felt.receiveShadow = true;
  scene.add(felt);
  scene.add(new THREE.HemisphereLight(0x8a7a66, 0x040403, 0.35));
  const lamp = new THREE.SpotLight(0xffe6c0, 420, 50, 0.6, 0.75, 2);
  lamp.position.set(0, 16, 3);
  lamp.target.position.set(0, 0, 0);
  lamp.castShadow = tier.shadows;
  lamp.shadow.mapSize.setScalar(Math.min(2048, tier.shadowMapSize));
  lamp.shadow.bias = -0.0003;
  scene.add(lamp, lamp.target);

  const front = new THREE.MeshStandardMaterial({ map: faceAtlas(), roughness: 0.5, alphaTest: 0.5, side: THREE.FrontSide });
  const back = new THREE.MeshStandardMaterial({ map: backTexture(), roughness: 0.42, alphaTest: 0.5, side: THREE.FrontSide });
  stage.own(front);
  stage.own(back);

  const spacing = CW + 0.28;
  const cards = WORD.map((ch, i) => {
    const fg = new THREE.PlaneGeometry(CW, CH);
    const uv = fg.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setX(k, (uv.getX(k) + i) / 6);
    const bg = new THREE.PlaneGeometry(CW, CH);
    bg.rotateZ(Math.PI); // back art reads upright when the card lies face down
    bg.rotateY(Math.PI);
    const card = new THREE.Group();
    const f = new THREE.Mesh(fg, front);
    const b = new THREE.Mesh(bg, back);
    f.castShadow = b.castShadow = true;
    card.add(f, b);
    // Lying on the felt: the card's local +z (face) points down until flipped.
    const slot = new THREE.Vector3((i - 2.5) * spacing, 0.012 + i * 0.002, 0.3);
    card.visible = false;
    scene.add(card);
    return { card, slot, dealT: -1, flipT: -1, from: new THREE.Vector3(0, 3.5, 9), spinY: (Math.random() - 0.5) * 1.2 };
  });

  const q = new THREE.Quaternion();
  const faceDown = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  const faceUp = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const tmpQ = new THREE.Quaternion();
  const axisY = new THREE.Vector3(0, 1, 0);
  stage.onUpdate((dt, time) => {
    for (const c of cards) {
      if (c.dealT < 0) continue;
      c.dealT += dt;
      const p = clamp01(c.dealT / 0.55);
      const e = ease.outCubic(p);
      c.card.visible = true;
      // Deal: slides out of the shoe in an arc, spinning flat, and settles face down.
      c.card.position.lerpVectors(c.from, c.slot, e);
      c.card.position.y += Math.sin(p * Math.PI) * 0.8;
      tmpQ.setFromAxisAngle(axisY, c.spinY * (1 - e) * 3);
      q.copy(tmpQ).multiply(faceDown);
      if (c.flipT >= 0) {
        c.flipT += dt;
        const f = clamp01(c.flipT / 0.5);
        const fe = ease.outBack(f, 1.2);
        // Flip along the card's long edge with a little lift.
        q.copy(faceDown).slerp(faceUp, Math.min(1, fe));
        if (fe > 1) q.multiply(tmpQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (fe - 1) * 0.6));
        c.card.position.y += Math.sin(f * Math.PI) * 0.9;
      }
      c.card.quaternion.copy(q);
    }
    // Overhead, slightly tilted; pulls back on narrow screens so all six cards fit.
    const d = Math.max(12, fitDistance(camera, (spacing * 6) / 2 + 0.3, 2.2));
    camera.position.set(Math.sin(time * 0.2) * 0.3, d * 0.86, d * 0.52);
    camera.lookAt(0, 0, 1.1);
  });

  await stage.wait(300, skip);
  for (const c of cards) {
    if (skip.requested) break;
    c.dealT = 0;
    uiSound('card.deal', { rate: vary(0.1), bus: 'sfx', gain: 0.8 });
    await stage.wait(160, skip);
  }
  await stage.wait(500, skip);
  for (const c of cards) {
    if (skip.requested) break;
    c.flipT = 0;
    uiSound('logo.cards', { rate: vary(0.12), bus: 'sfx' });
    await stage.wait(210, skip);
  }
  if (!skip.requested) uiSound('chip.stack', { bus: 'sfx', gain: 0.6 });
  await stage.wait(2300, skip);
  await engine.fade(true, skip.requested ? 250 : 700);
  stage.dispose();
}
