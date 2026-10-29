/* Animated light waves for the PlayStation backgrounds (PS4 blue waves, PS3/PSP XMB ribbon).
   Drawn on a small canvas at ~30 fps and stretched, so it costs almost nothing. */
const XMB_COLORS = ['#9a9fa8', '#c9a63c', '#6c9e3c', '#d681a8', '#3f9a4e', '#9a74c4', '#37aaa8', '#3b78c8', '#8a58c0', '#cf823b', '#8c5d3b', '#b93a3a'];

export function xmbColor(month) { return XMB_COLORS[(month == null ? new Date().getMonth() : month) % 12]; }

export function waves(canvas, opts) {
  const ctx = canvas.getContext('2d');
  let raf = 0;
  let last = 0;
  let t = 0;
  const mode = opts.mode;
  function size() {
    const r = canvas.getBoundingClientRect();
    const scale = 0.5;
    canvas.width = Math.max(320, Math.round(r.width * scale));
    canvas.height = Math.max(180, Math.round(r.height * scale));
  }
  function hexToRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function draw() {
    const W = canvas.width, H = canvas.height;
    if (mode === 'ps4') {
      const g = ctx.createLinearGradient(0, 0, W, H);
      /* the real PS4 theme blue (picked off Sony's own PS4 screenshots) */
      g.addColorStop(0, '#1b3d9f'); g.addColorStop(0.5, '#2149ab'); g.addColorStop(1, '#0b2480');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (let k = 0; k < 7; k++) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 6) {
          const y = H * (0.62 + k * 0.035) + Math.sin(x / W * 5 + t * (0.25 + k * 0.04) + k) * H * (0.06 + k * 0.012) + Math.sin(x / W * 11 - t * 0.3 + k * 2) * H * 0.015;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(160, 210, 255,' + (0.05 + k * 0.025) + ')';
        ctx.lineWidth = 1 + k * 0.6;
        ctx.stroke();
      }
      const glow = ctx.createRadialGradient(W * 0.75, H * 0.2, 0, W * 0.75, H * 0.2, W * 0.6);
      glow.addColorStop(0, 'rgba(140,200,255,.18)'); glow.addColorStop(1, 'rgba(140,200,255,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    } else {
      const base = hexToRgb(opts.color || xmbColor());
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgb(' + base.map(function (c) { return Math.round(c * 0.55); }).join(',') + ')');
      g.addColorStop(0.5, 'rgb(' + base.join(',') + ')');
      g.addColorStop(1, 'rgb(' + base.map(function (c) { return Math.round(c * 0.35); }).join(',') + ')');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      /* the ribbon: two soft bands of thin lines that slowly twist */
      for (let band = 0; band < 2; band++) {
        for (let k = 0; k < 18; k++) {
          ctx.beginPath();
          for (let x = 0; x <= W; x += 5) {
            const p = x / W;
            const amp = H * (0.08 + 0.05 * Math.sin(t * 0.2 + band * 2));
            const y = H * 0.56 + Math.sin(p * 3.2 + t * 0.35 + band * 1.7) * amp + Math.sin(p * 7 + k * 0.18 + t * 0.5) * H * 0.012 * (band ? 1.4 : 1) + (k - 9) * H * 0.0035;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.035 + (band ? 0.02 : 0.03)) + ')';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
  }
  let sleeping = false;
  function loop(ts) {
    /* Game System 3 isn't the window you're using (or motion is off): stop drawing until it is */
    if (document.body.classList.contains('idle') || (document.body.classList.contains('reduce-motion') && t > 0.1)) { raf = 0; sleeping = true; return; }
    raf = requestAnimationFrame(loop);
    if (ts - last < 33) return;
    t += (ts - last) / 1000 || 0.033;
    last = ts;
    draw();
  }
  window.addEventListener('resize', function () { if (raf || sleeping) { size(); draw(); } });
  window.addEventListener('gs-idle', function (e) { if (!e.detail && sleeping) { sleeping = false; last = performance.now(); raf = requestAnimationFrame(loop); } });
  return {
    start: function () { if (raf) return; size(); last = performance.now(); draw(); raf = requestAnimationFrame(loop); },
    stop: function () { cancelAnimationFrame(raf); raf = 0; sleeping = false; },
    setColor: function (c) { opts.color = c; }
  };
}
