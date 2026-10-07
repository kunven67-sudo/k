// Dev page for the front end. ?screen=boot|menu|settings|credits|loading|icons  (&logo=neon|gold|cards|reels)
// boot → menu → settings → credits run through the real engine via runState + extraStates.
import * as THREE from 'three';
import { runState } from './harness.js';

const q = new URLSearchParams(location.search);
const screen = q.get('screen') || 'boot';

// Minimal backdrop state for overlays that are normally opened over another screen.
class Backdrop {
  constructor(engine) {
    this.engine = engine;
  }
  async enter() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1013);
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 50);
    this.engine.setView(scene, cam);
    if (screen === 'logo') {
      // Loop the chosen logo forever (dev). ?logo=neon|gold|cards|reels
      this.host = { stage: null };
      const name = q.get('logo') || 'neon';
      const mod = await import(`../src/ui/boot/logos/${name}.js`);
      const loop = async () => {
        const skip = { requested: false };
        this.engine.fade(false, 300);
        await mod.runLogo(this.engine, this.engine.uiRoot, skip, this.host);
        if (q.get('loop')) loop();
      };
      loop();
    } else if (screen === 'settings') {
      const { openSettings } = await import('../src/ui/settings.js');
      openSettings(this.engine, { onClose: () => setTimeout(() => openSettings(this.engine), 600) });
    } else if (screen === 'loading') {
      const { showLoading } = await import('../src/ui/loading.js');
      const kinds = ['newspaper', 'tip', 'slot'];
      const kind = q.get('kind') || kinds[0];
      const l = showLoading({ kind });
      let p = 0;
      const tick = setInterval(() => {
        p = Math.min(1, p + 0.07);
        l.setProgress(p);
        if (p >= 1) clearInterval(tick);
      }, 400);
    } else if (screen === 'icons') {
      const { renderIcon } = await import('../src/ui/icons.js');
      await (await import('../src/ui/three/stage.js')).loadFonts();
      // window.__icons(): data URLs for every PWA icon size (the capture script saves them).
      window.__icons = () => ({
        'icon-180.png': renderIcon(180, { maskable: true }).toDataURL('image/png'),
        'icon-192.png': renderIcon(192).toDataURL('image/png'),
        'icon-512.png': renderIcon(512).toDataURL('image/png'),
        'icon-maskable-192.png': renderIcon(192, { maskable: true }).toDataURL('image/png'),
        'icon-maskable-512.png': renderIcon(512, { maskable: true }).toDataURL('image/png'),
      });
      const size = Number(q.get('size') || 512);
      const c = renderIcon(size, { maskable: q.get('maskable') === '1' });
      Object.assign(c.style, { position: 'fixed', left: 0, top: 0, width: `${size}px`, height: `${size}px`, zIndex: 50 });
      document.body.appendChild(c);
    }
  }
  update(dt) {
    this.host?.stage?.update(dt);
  }
  exit() {}
}

async function boot() {
  const extra = {};
  const want = async (name, path, cls) => {
    try {
      extra[name] = (await import(path))[cls];
    } catch (e) {
      console.warn('[dev/ui] missing', name, e.message);
    }
  };
  await want('boot', '../src/states/boot.js', 'BootState');
  await want('menu', '../src/states/menu.js', 'MenuState');
  await want('credits', '../src/states/credits.js', 'CreditsState');
  // Stand-ins for states owned by other modules, so PLAY can be clicked in isolation.
  extra.creator = extra.world = Backdrop;
  const first = { boot: extra.boot, menu: extra.menu, credits: extra.credits }[screen] || Backdrop;
  await runState(first, {}, extra);
}
boot();

// Screenshot helper: fast-forward the active 3D stage by `sec` seconds of animation time
// (headless SwiftShader renders ~2 fps, far too slow to reach later moments in real time).
window.ff = (sec) =>
  new Promise((res) => {
    let left = Math.round(sec * 60);
    const step = () => {
      const st = window.__gamble?.engine?.state;
      // States that own a host (boot / dev logo) drive a sub-stage; others (menu, credits) update fully.
      const stage = st?.host?.stage;
      for (let i = 0; i < 15 && left > 0; i++, left--) {
        if (stage) stage.update(1 / 60);
        else st?.update?.(1 / 60, 1 / 60);
      }
      if (left > 0) requestAnimationFrame(step);
      else res(true);
    };
    step();
  });
