// Photo mode: time stops, the HUD goes away, and you frame the shot.
const $ = (id) => document.getElementById(id);

export class Photo {
  constructor(game) {
    this.game = game;
    this.state = { ev: 0, fov: 60, roll: 0, bloom: 0.5, grain: true };
    const bind = (id, key, num = true) => {
      const el = $(id);
      el.addEventListener('input', () => { this.state[key] = num ? +el.value : el.checked; this.push(); });
      el.addEventListener('keydown', (e) => e.stopPropagation());
    };
    bind('ph-exp', 'ev');
    bind('ph-fov', 'fov');
    bind('ph-roll', 'roll');
    bind('ph-bloom', 'bloom');
    $('ph-grain').addEventListener('change', (e) => { this.state.grain = e.target.checked; this.push(); });
    $('ph-snap').addEventListener('click', () => this.capture());
    $('ph-leave').addEventListener('click', () => { if (this.game.photoOn) this.toggle(); });
    $('photo-close').addEventListener('click', () => { $('photo-shot').hidden = true; });
  }

  toggle() {
    const g = this.game;
    g.photoOn = !g.photoOn;
    $('photo').hidden = !g.photoOn;
    g.input.noLock = g.photoOn;
    if (g.photoOn) {
      g.input.releaseLock();
      this.hudWas = g.hud.mode;
      g.hud.show(false);
      $('tip').hidden = true;
      this.state.fov = Math.round(g.cam.fov);
      $('ph-fov').value = this.state.fov;
      this.push();
    } else {
      g.renderer.photo = null;
      g.hud.setMode(this.hudWas || 'full');
      g.last = performance.now();
    }
  }

  push() {
    this.game.renderer.photo = { ...this.state };
  }

  input(dt) {
    const g = this.game, inp = g.input, cam = g.cam;
    if (inp.dragging || inp.locked) cam.look(inp.mouseDX, inp.mouseDY, g.settings.sens, g.settings.invert);
    if (inp.wheel) cam.zoomBy(inp.wheel);
    void dt;
  }

  capture() {
    const g = this.game;
    const r = g.renderer;
    r.render();
    let url = '';
    try { url = g.canvas.toDataURL('image/png'); } catch { url = ''; }
    if (!url) return;
    $('photo-img').src = url;
    $('photo-shot').hidden = false;
    g.audio.blip();
  }
}
