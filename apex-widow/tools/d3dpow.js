// Test helper (INIT=tools/d3dpow.js node tools/probe.mjs ...): makes shader math break the way it does on a real
// Windows PC (Chrome -> ANGLE -> Direct3D): pow/log/sqrt of a negative number, acos/asin outside -1..1 and
// normalize() of a zero vector all give NaN. The cloud's software GPU quietly "fixes" those, which hides bugs that
// show up as a black screen on the player's NVIDIA card (one NaN pixel gets smeared over the screen by bloom).
(() => {
  const P = WebGL2RenderingContext.prototype, orig = P.shaderSource;
  const NAN = 'intBitsToFloat(0x7fc00000)';
  const T = ['float', 'vec2', 'vec3', 'vec4'];
  let help = `\nfloat d3d_nan(){ return ${NAN}; }\n`;
  const bad = (t, cond) => t === 'float' ? `(${cond})` : `any(${cond})`;
  for (const t of T) {
    const lt = t === 'float' ? 'x < 0.0' : `lessThan(x, ${t}(0.0))`;
    const out = t === 'float' ? 'd3d_nan()' : `${t}(d3d_nan())`;
    help += `${t} d3d_pow(${t} x, ${t} y){ return ${bad(t, lt)} ? ${out} : pow(x, y); }\n`;
    if (t !== 'float') help += `${t} d3d_pow(${t} x, float y){ return ${bad(t, lt)} ? ${out} : pow(x, ${t}(y)); }\n`;
    help += `${t} d3d_log2(${t} x){ return ${bad(t, lt)} ? ${out} : log2(x); }\n`;
    help += `${t} d3d_log(${t} x){ return ${bad(t, lt)} ? ${out} : log(x); }\n`;
    help += `${t} d3d_sqrt(${t} x){ return ${bad(t, lt)} ? ${out} : sqrt(x); }\n`;
    const oob = t === 'float' ? 'abs(x) > 1.0' : `greaterThan(abs(x), ${t}(1.0))`;
    help += `${t} d3d_acos(${t} x){ return ${bad(t, oob)} ? ${out} : acos(x); }\n`;
    help += `${t} d3d_asin(${t} x){ return ${bad(t, oob)} ? ${out} : asin(x); }\n`;
    if (t !== 'float') help += `${t} d3d_normalize(${t} x){ return dot(x, x) == 0.0 ? ${out} : normalize(x); }\n`;
  }
  const names = ['pow', 'log2', 'log', 'sqrt', 'acos', 'asin', 'normalize'];
  window.__d3d = 0;
  P.shaderSource = function (sh, src) {
    const re = /^[ \t]*precision\s+\w+\s+\w+\s*;[ \t]*$/gm; let m, end = -1;
    while ((m = re.exec(src))) end = m.index + m[0].length;
    if (end > 0 && /#version 300 es/.test(src)) {
      let body = src.slice(end);
      for (const n of names) body = body.replace(new RegExp(`(^|[^\\w.])${n}\\s*\\(`, 'g'), `$1d3d_${n}(`);
      src = src.slice(0, end) + help + body; window.__d3d++;
    }
    return orig.call(this, sh, src);
  };
})();
