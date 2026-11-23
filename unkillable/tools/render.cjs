// Renders every frame of the episode in a headless browser and pipes them into ffmpeg.
// node tools/render.cjs <out.mp4> [from] [to]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
(async () => {
  const out = process.argv[2], from = +(process.argv[3] || 0), to = process.argv[4] ? +process.argv[4] : null;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('http://127.0.0.1:47840/preview.html'); await p.waitForFunction(() => window.ready);
  await p.evaluate(() => document.fonts.load('900 40px "Inter Display"'));
  const info = await p.evaluate(() => ({ D: A.DURATION, FPS: A.FPS }));
  const end = to ?? info.D; const n0 = Math.round(from * info.FPS), n1 = Math.round(end * info.FPS);
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(info.FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now(); const B = 24;
  for (let f = n0; f < n1; f += B) {
    const batch = await p.evaluate(([f, n, fps]) => { const r = []; const cv = document.getElementById('c'); for (let i = f; i < f + n; i++) { A.drawFrame(ctx, i / fps); r.push(cv.toDataURL('image/jpeg', 0.93).slice(23)); } return r; }, [f, Math.min(B, n1 - f), info.FPS]);
    for (const s of batch) { if (!ff.stdin.write(Buffer.from(s, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r)); }
    if ((f - n0) % (B * 50) === 0) console.log(`${((f - n0) / (n1 - n0) * 100).toFixed(1)}%  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await b.close();
  console.log('done', ((Date.now() - t0) / 1000).toFixed(0), 's');
})();
