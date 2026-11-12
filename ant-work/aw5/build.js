#!/usr/bin/env node
/* ANT WORK 5 build: src/*.js + src/00_head.html -> dist/index.html, copies assets/lib/gs3kit, optional zip.
   node build.js            -> dist/
   node build.js --zip      -> dist/ + "ANT WORK 5.zip" next to dist
   Lines (voice script) live in assets/voice/lines.json and get inlined as const LINES. */
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const root = __dirname, src = path.join(root, 'src'), dist = path.join(root, 'dist');
const head = fs.readFileSync(path.join(src, '00_head.html'), 'utf8');
const mods = fs.readdirSync(src).filter(f => /^\d+[a-z]?_.*\.js$/.test(f)).sort();
const lines = JSON.parse(fs.readFileSync(path.join(root, 'assets/voice/lines.json'), 'utf8'));
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
let out = head.replace('%VERSION%', version);
out += '<script src="lib/three.min.js"></script>\n';
out += '<script>if(!window.THREE){ window.__showErr && window.__showErr("The 3D engine file (lib/three.min.js) is missing from the game folder. Put the whole folder back together and try again."); }</script>\n';
out += '<script>\nconst GAME_VERSION=' + JSON.stringify(version) + ';\nconst LINES=' + JSON.stringify(lines) + ';\n</script>\n';
for (const m of mods) {
  out += '<script>\n/* ===== ' + m + ' ===== */\n' + fs.readFileSync(path.join(src, m), 'utf8') + '\n</script>\n';
}
out += '</body>\n</html>\n';
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), out);
const copyDir = (a, b, filter) => { fs.mkdirSync(b, { recursive: true }); for (const f of fs.readdirSync(a)) { const p = path.join(a, f), q = path.join(b, f); if (fs.statSync(p).isDirectory()) copyDir(p, q, filter); else if (!filter || filter(p)) fs.copyFileSync(p, q); } };
copyDir(path.join(root, 'lib'), path.join(dist, 'lib'));
copyDir(path.join(root, 'gs3kit'), path.join(dist, 'gs3kit'), p => !/demo\.html|README/.test(p));
copyDir(path.join(root, 'assets'), path.join(dist, 'assets'), p => !/lines\.json$|_disp\.jpg$|\.txt$/.test(p));
/* every sound + texture also as a script (assets/js/...) so it loads when the game is opened straight from the folder (file://) */
{ const A=path.join(dist,'assets'); let n=0; const walk=d=>{ for(const f of fs.readdirSync(d)){ const p=path.join(d,f); if(fs.statSync(p).isDirectory()){ if(f!=='js') walk(p); continue; } if(!/\.(glb|mp3|ogg|wav|jpg|jpeg|png)$/i.test(f)) continue;
    const rel=path.relative(A,p).split(path.sep).join('/'), q=path.join(A,'js',rel+'.js'); fs.mkdirSync(path.dirname(q),{recursive:true});
    fs.writeFileSync(q,'__awBytes('+JSON.stringify('assets/'+rel)+',"'+fs.readFileSync(p).toString('base64')+'");\n'); fs.rmSync(p); n++; } };
  walk(A); console.log('files packed for folder play:',n); }
const size = d => { let n = 0; for (const f of fs.readdirSync(d)) { const p = path.join(d, f); n += fs.statSync(p).isDirectory() ? size(p) : fs.statSync(p).size; } return n; };
console.log('built dist/index.html', (fs.statSync(path.join(dist, 'index.html')).size / 1024).toFixed(0) + ' KB, dist total', (size(dist) / 1048576).toFixed(1) + ' MB, modules:', mods.length, 'lines:', Object.keys(lines).length);
if (process.argv.includes('--zip')) {
  const zip = path.join(root, 'ANT WORK 5.zip');
  fs.rmSync(zip, { force: true });
  execSync('cd "' + dist + '" && zip -q -r -9 "' + zip + '" .');
  console.log('zip', (fs.statSync(zip).size / 1048576).toFixed(1) + ' MB ->', zip);
}
