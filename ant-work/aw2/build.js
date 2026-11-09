/* ANT WORK 2 build: src/ modules -> dist/index.html (+ lib, assets) -> "ANT WORK 2.zip" with --zip
   - three.js is shipped inside the game (no internet needed = no more "Loading..." hang)
   - every recorded voice line (assets/voice/<id>.mp3) is listed so the game knows which lines have a real voice */
const fs=require('fs'), path=require('path'), cp=require('child_process');
const SRC=path.join(__dirname,'src'), OUT=path.join(__dirname,'dist');
const version=require('./package.json').version;
let head=fs.readFileSync(path.join(SRC,'00_head.html'),'utf8');
const cdn=/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js"><\/script>\s*<script>\s*if\(!window\.THREE\)\{ document\.write\([^\n]*\n<\/script>\s*<script>\s*if\(!window\.THREE\)\{[^\n]*\n<\/script>/;
if(!cdn.test(head)) throw new Error('could not find the three.js CDN block in 00_head.html');
head=head.replace(cdn,'<script src="lib/three.min.js"></script>\n<script>\nif(!window.THREE){ window.__showErr && window.__showErr("The 3D engine file (lib/three.min.js) is missing. Unzip the whole game folder and try again."); }\n</script>');
const ids=fs.existsSync(path.join(__dirname,'assets/voice'))?fs.readdirSync(path.join(__dirname,'assets/voice')).filter(f=>/^[0-9a-f]{8}\.mp3$/.test(f)).map(f=>f.slice(0,8)):[];
let out=head+'<script>\nconst AW2_VERSION='+JSON.stringify(version)+';\nconst AW2_VOICE_IDS=new Set('+JSON.stringify(ids)+');\n</script>\n';
const mods=fs.readdirSync(SRC).filter(f=>/^\d+[a-z]?_.*\.js$/.test(f)).sort();
for(const m of mods) out+='<script>\n/* ===== '+m+' ===== */\n'+fs.readFileSync(path.join(SRC,m),'utf8')+'</script>\n';
out+=fs.readFileSync(path.join(SRC,'99_tail.html'),'utf8');
fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true});
fs.writeFileSync(path.join(OUT,'index.html'),out);
const copy=(a,b,skip)=>{ fs.mkdirSync(b,{recursive:true}); for(const f of fs.readdirSync(a)){ if(skip&&skip(f)) continue; const p=path.join(a,f), q=path.join(b,f); if(fs.statSync(p).isDirectory()) copy(p,q,skip); else fs.copyFileSync(p,q); } };
copy(path.join(__dirname,'lib'),path.join(OUT,'lib'));
copy(path.join(__dirname,'assets'),path.join(OUT,'assets'),f=>f.endsWith('.json')||f.endsWith('.txt')&&f!=='CREDITS.txt');
const size=d=>fs.readdirSync(d).reduce((s,f)=>{ const p=path.join(d,f); return s+(fs.statSync(p).isDirectory()?size(p):fs.statSync(p).size); },0);
console.log('built dist/index.html',(fs.statSync(path.join(OUT,'index.html')).size/1024|0)+' KB, dist '+(size(OUT)/1048576).toFixed(1)+' MB, modules '+mods.length+', voice lines '+ids.length);
if(process.argv.includes('--zip')){ const z=path.join(__dirname,'ANT WORK 2.zip'); fs.rmSync(z,{force:true}); cp.execSync('cd "'+OUT+'" && zip -qr -9 "'+z+'" .'); console.log('zip',(fs.statSync(z).size/1048576).toFixed(1)+' MB ->',z); }
