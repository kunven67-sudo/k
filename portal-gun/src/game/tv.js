// Interdimensional Cable on the Smiths' TV. Channel names are from the show;
// the jokes are newly written for this game.
import * as THREE from '../three.js';
import { makeCanvas, canvasTexture } from '../render/materials.js';
import { audio } from '../core/audio.js';

const INK = '#1c1b20';
const W = 512, H = 288;

function head(g, x, y, r, skin, extra) {
  g.lineWidth = 4;
  g.strokeStyle = INK;
  g.fillStyle = skin;
  g.beginPath();
  g.ellipse(x, y, r, r * 1.1, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  extra?.(g);
}

function eyes(g, x, y, r, gap) {
  for (const s of [-1, 1]) {
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(x + s * gap, y, r, r * 1.1, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = INK;
    g.beginPath();
    g.arc(x + s * gap, y, r * 0.22, 0, Math.PI * 2);
    g.fill();
  }
}

function banner(g, text, y, bg, fg, size = 34) {
  g.fillStyle = bg;
  g.fillRect(0, y - size * 0.8, W, size * 1.25);
  g.fillStyle = fg;
  g.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, W / 2, y - size * 0.15);
}

function mouth(g, x, y, w, open) {
  g.fillStyle = '#4a1d22';
  g.beginPath();
  if (open) g.ellipse(x, y, w / 2, w * 0.35, 0, 0, Math.PI * 2);
  else g.ellipse(x, y, w / 2, 3, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
}

const CHANNELS = [
  {
    name: 'REAL FAKE DOORS',
    voice: 'tv',
    lines: [
      'Come on down to Real Fake Doors! Every door we sell is a hundred percent real, and a hundred percent fake!',
      "You pull, nothing! You push, nothing! It's a wall with a doorknob, baby!",
      'Real Fake Doors! Burglars hate us! Honestly, so does everybody else!',
    ],
    draw(g, t, talking) {
      g.fillStyle = '#e9d8b0';
      g.fillRect(0, 0, W, H);
      const cols = ['#b5523b', '#3b6fb5', '#5aa04a', '#d9b13b', '#8a4fb0', '#c0c0c0'];
      for (let i = 0; i < 7; i++) {
        const x = 20 + i * 72;
        g.fillStyle = cols[i % cols.length];
        g.fillRect(x, 60, 58, 150);
        g.strokeStyle = INK;
        g.lineWidth = 3;
        g.strokeRect(x, 60, 58, 150);
        g.fillStyle = '#e8c45a';
        g.beginPath();
        g.arc(x + 46, 140, 5, 0, Math.PI * 2);
        g.fill();
      }
      // salesman
      const bob = Math.sin(t * 6) * 4;
      g.fillStyle = '#3a6ea8';
      g.fillRect(196, 190 + bob, 120, 110);
      g.strokeRect(196, 190 + bob, 120, 110);
      head(g, 256, 150 + bob, 46, '#f0c9a0');
      eyes(g, 256, 140 + bob, 11, 18);
      g.fillStyle = '#4a2c1a';
      g.beginPath();
      g.ellipse(256, 168 + bob, 30, 9, 0, 0, Math.PI * 2);
      g.fill();
      mouth(g, 256, 182 + bob, 22, talking);
      // his arm waves at a door
      g.strokeStyle = INK;
      g.lineWidth = 8;
      g.beginPath();
      g.moveTo(310, 210 + bob);
      g.lineTo(370 + Math.sin(t * 5) * 12, 160);
      g.stroke();
      banner(g, 'REAL FAKE DOORS', 268, '#d22b2b', '#fff6c8', 34);
    },
  },
  {
    name: "ANTS IN MY EYES JOHNSON'S",
    voice: 'tv2',
    lines: [
      "Hi! I'm Ants in My Eyes Johnson! Everything in my store is on sale. I think. I genuinely cannot tell!",
      "Is this a microwave? Is this a TV? There are ants in my eyes, folks, I'm just pointing at stuff!",
      "Ants in My Eyes Johnson's Electronics! Come on down, and please, somebody describe my store to me!",
    ],
    draw(g, t, talking) {
      g.fillStyle = '#b9d8e8';
      g.fillRect(0, 0, W, H);
      // shelves of electronics
      for (let i = 0; i < 6; i++) {
        g.fillStyle = '#2b2d33';
        g.fillRect(20 + i * 82, 40, 64, 46);
        g.fillStyle = `hsl(${(i * 60 + t * 40) % 360},70%,60%)`;
        g.fillRect(26 + i * 82, 46, 52, 34);
        g.fillStyle = '#eeeeee';
        g.fillRect(20 + i * 82, 110, 64, 40);
        g.strokeStyle = INK;
        g.lineWidth = 3;
        g.strokeRect(20 + i * 82, 110, 64, 40);
      }
      // Johnson
      g.fillStyle = '#f2f2f2';
      g.fillRect(200, 200, 112, 100);
      g.strokeRect(200, 200, 112, 100);
      g.fillStyle = '#c0392b';
      g.fillRect(250, 200, 12, 70);
      head(g, 256, 160, 44, '#f3c7a0');
      // eyes full of ants
      for (const s of [-1, 1]) {
        g.fillStyle = '#fff';
        g.beginPath();
        g.ellipse(256 + s * 18, 150, 13, 14, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.fillStyle = INK;
        for (let a = 0; a < 7; a++) {
          const ang = t * 3 + a * 0.9 + s;
          g.beginPath();
          g.ellipse(256 + s * 18 + Math.cos(ang * 1.3) * 8, 150 + Math.sin(ang) * 9, 2.5, 1.5, ang, 0, Math.PI * 2);
          g.fill();
        }
      }
      // a few escaping down his face
      for (let a = 0; a < 4; a++) {
        const y = 165 + ((t * 20 + a * 12) % 40);
        g.beginPath();
        g.ellipse(240 + a * 10, y, 2.5, 1.5, 1.4, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = INK;
      mouth(g, 256, 186, 26, talking);
      banner(g, "ANTS IN MY EYES JOHNSON'S", 268, '#1f4fa8', '#ffe14a', 28);
    },
  },
  {
    name: 'TWO BROTHERS',
    voice: 'tv',
    lines: ['Two brothers. One car. Zero plans.', 'This summer, the brothers are back. They never left. They live in that car.', 'Two Brothers. Rated R, for brothers.'],
    draw(g, t) {
      g.fillStyle = '#05050a';
      g.fillRect(0, 0, W, H);
      const flash = Math.max(0, Math.sin(t * 2.2)) ** 8;
      if (flash > 0.1) {
        const gr = g.createRadialGradient(W / 2, H * 0.7, 10, W / 2, H * 0.7, 260);
        gr.addColorStop(0, `rgba(255,180,60,${flash})`);
        gr.addColorStop(1, 'rgba(255,60,0,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, W, H);
      }
      // two silhouettes
      g.fillStyle = '#000';
      for (const x of [200, 312]) {
        g.beginPath();
        g.arc(x, 150, 24, 0, Math.PI * 2);
        g.fill();
        g.fillRect(x - 30, 172, 60, 120);
      }
      g.fillStyle = '#f0e6c8';
      g.font = '900 54px Georgia, serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const phase = Math.floor(t / 2.5) % 3;
      g.globalAlpha = 0.5 + 0.5 * Math.sin(((t % 2.5) / 2.5) * Math.PI);
      g.fillText(['TWO', 'BROTHERS', 'TWO BROTHERS'][phase], W / 2, 70);
      g.globalAlpha = 1;
    },
  },
  {
    name: 'BALL FONDLERS',
    voice: 'tv',
    lines: ['Previously, on Ball Fondlers!', 'When the world needs saving, the Ball Fondlers answer the call. Usually late.', 'Ball Fondlers! Now with fifty percent more explosions and zero explanations!'],
    draw(g, t) {
      // comic burst
      g.fillStyle = '#1b2a6b';
      g.fillRect(0, 0, W, H);
      g.save();
      g.translate(W / 2, H / 2 - 10);
      g.rotate(t * 0.3);
      for (let i = 0; i < 16; i++) {
        g.fillStyle = i % 2 ? '#ffcf3a' : '#ff5a2a';
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, 400, (i / 16) * Math.PI * 2, ((i + 1) / 16) * Math.PI * 2);
        g.fill();
      }
      g.restore();
      // heroes posing
      const cols = ['#2ecc71', '#e74c3c', '#9b59b6'];
      cols.forEach((c, i) => {
        const x = 150 + i * 106;
        const jump = Math.abs(Math.sin(t * 3 + i)) * 10;
        g.fillStyle = c;
        g.strokeStyle = INK;
        g.lineWidth = 4;
        g.fillRect(x - 26, 150 - jump, 52, 90);
        g.strokeRect(x - 26, 150 - jump, 52, 90);
        head(g, x, 122 - jump, 24, '#f0c9a0');
        g.fillStyle = '#111';
        g.fillRect(x - 20, 112 - jump, 40, 10);
      });
      g.fillStyle = '#fff';
      g.strokeStyle = INK;
      g.lineWidth = 8;
      g.font = '900 52px Impact, "Arial Black", sans-serif';
      g.textAlign = 'center';
      g.strokeText('BALL FONDLERS', W / 2, 266);
      g.fillText('BALL FONDLERS', W / 2, 266);
    },
  },
  {
    name: 'BABY LEGS',
    voice: 'tvf',
    lines: ["He's a regular detective, with regular arms, and regular... baby legs.", "Baby Legs! He can't chase anybody, but he's got heart!", 'Next week, on Baby Legs: the stairs.'],
    draw(g, t, talking) {
      g.fillStyle = '#3a3f52';
      g.fillRect(0, 0, W, H);
      // city skyline
      g.fillStyle = '#23263a';
      for (let i = 0; i < 9; i++) g.fillRect(i * 60, 80 + ((i * 37) % 60), 50, 200);
      g.fillStyle = '#f7d36a';
      for (let i = 0; i < 30; i++) g.fillRect((i * 53) % W, 100 + ((i * 29) % 120), 6, 8);
      // detective in a trench coat on tiny legs
      const x = 256 + Math.sin(t * 1.5) * 40;
      g.fillStyle = '#9a7b4f';
      g.strokeStyle = INK;
      g.lineWidth = 4;
      g.fillRect(x - 40, 120, 80, 110);
      g.strokeRect(x - 40, 120, 80, 110);
      head(g, x, 96, 28, '#f0c9a0');
      g.fillStyle = '#5b4a3a';
      g.fillRect(x - 34, 62, 68, 14);
      eyes(g, x, 92, 7, 11);
      mouth(g, x, 110, 14, talking);
      g.fillStyle = '#f7c8a8';
      for (const s of [-1, 1]) {
        const step = Math.sin(t * 12 + s) * 3;
        g.fillRect(x + s * 12 - 6, 230, 12, 22 + step);
        g.strokeRect(x + s * 12 - 6, 230, 12, 22 + step);
      }
      banner(g, 'BABY LEGS', 272, '#000000', '#ffffff', 30);
    },
  },
];

export class TV {
  constructor(game, anchor) {
    this.game = game;
    this.canvas = makeCanvas(W, H);
    this.ctx = this.canvas.getContext('2d');
    this.tex = canvasTexture(this.canvas);
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex });
    this.mat.color.setScalar(1.15);
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(anchor.w, anchor.h), this.mat);
    this.screen.position.copy(anchor.pos);
    this.screen.rotation.y = Math.PI / 2; // faces +x, into the living room
    this.screen.userData.dynamic = true;
    game.scene.add(this.screen);
    this.on = false;
    this.channel = 0;
    this.t = 0;
    this.static = 0;
    this.lineIdx = CHANNELS.map(() => 0);
    this.watching = false;
    this.nextLine = 0;
    this._off();
  }

  get channels() {
    return CHANNELS;
  }

  _off() {
    const g = this.ctx;
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#1d2128');
    gr.addColorStop(0.5, '#2b313a');
    gr.addColorStop(1, '#16191e');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.beginPath();
    g.moveTo(40, 0);
    g.lineTo(140, 0);
    g.lineTo(60, H);
    g.lineTo(0, H);
    g.fill();
    this.tex.needsUpdate = true;
  }

  turnOn() {
    this.on = true;
    this.static = 0.4;
    audio.tvChannel();
  }

  turnOff() {
    this.on = false;
    this._off();
  }

  change(step) {
    this.channel = (this.channel + step + CHANNELS.length) % CHANNELS.length;
    this.static = 0.35;
    this.nextLine = 0.6;
    audio.tvChannel();
    this.game.dialogue.stop();
  }

  update(dt) {
    if (!this.on) return;
    this.t += dt;
    const g = this.ctx;
    const ch = CHANNELS[this.channel];
    if (this.static > 0) {
      this.static -= dt;
      const img = g.createImageData(W / 4, H / 4);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      g.drawImage(this.canvas, 0, 0, W / 4, H / 4, 0, 0, W, H);
    } else {
      const talking = this.game.dialogue.busy && this.game.dialogue.speaker?.startsWith('tv');
      ch.draw(g, this.t, talking && Math.sin(this.t * 20) > 0);
      // channel number
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(W - 70, 8, 62, 30);
      g.fillStyle = '#7dff6a';
      g.font = '700 22px monospace';
      g.textAlign = 'center';
      g.fillText(`CH ${String(this.channel + 1).padStart(2, '0')}`, W - 39, 30);
    }
    // scanlines
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
    this.tex.needsUpdate = true;

    if (this.watching && this.static <= 0) {
      this.nextLine -= dt;
      if (this.nextLine <= 0 && !this.game.dialogue.busy) {
        const i = this.lineIdx[this.channel]++ % ch.lines.length;
        this.game.say([[ch.voice, ch.lines[i]]]);
        this.nextLine = 2.5;
      }
    }
  }
}
