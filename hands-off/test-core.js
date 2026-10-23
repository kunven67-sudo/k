// Unit tests for src/core.js. Run: node test-core.js
const H = require('./src/core.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
const eq = (a, b, m) => ok(a === b, m + ' -> got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));
const near = (a, b, e, m) => ok(Math.abs(a - b) <= e, m + ' -> got ' + a + ', want ~' + b);

// names (Conway-Wechsler)
const names = { 1: 'thousand', 2: 'million', 3: 'billion', 4: 'trillion', 5: 'quadrillion', 10: 'nonillion', 11: 'decillion', 12: 'undecillion',
  13: 'duodecillion', 14: 'tredecillion', 17: 'sedecillion', 21: 'vigintillion', 22: 'unvigintillion', 24: 'tresvigintillion',
  31: 'trigintillion', 101: 'centillion', 1001: 'millinillion' };
for (const t in names) eq(H.tierName(+t), names[t], 'tierName ' + t);
eq(H.illionName(16), 'sedecillion', 'illion 16');
eq(H.illionName(17), 'septendecillion', 'illion 17 (septen before N)');
eq(H.illionName(18), 'octodecillion', 'illion 18');
eq(H.illionName(27), 'septemvigintillion', 'illion 27 (septem before M)');
eq(H.illionName(29), 'novemvigintillion', 'illion 29');
eq(H.illionName(86), 'sexoctogintillion', 'illion 86 (sex before X)');
for (let t = 1; t < 3000; t += 7) ok(/^[a-z]+$/.test(H.tierName(t)) && H.tierName(t).length > 3, 'name is letters ' + t + ' ' + H.tierName(t));

// formatting
const P = (x) => { const p = H.parts(x); return (p.num + ' ' + p.word).trim(); };
eq(P(H.ZERO), '0', 'zero');
eq(P(H.L.from(7)), '7', 'seven');
eq(P(H.L.from(123456)), '123,456', 'commas');
eq(P(6), '1 million', 'million exactly');
eq(P(H.L.from(4.2e9)), '4.2 billion', '4.2 billion');
eq(P(H.L.from(999999999)), '999.9 million', 'never rounds up to 1000 million');
eq(P(H.L.from(12.3456e12)), '12.34 trillion', 'trillions');
eq(P(100), '10 duotrigintillion', 'googol');
ok(/e1843/.test(H.short(1843.4)), 'short uses e for long names: ' + H.short(1843.4));
eq(H.short(H.L.from(5e9)), '5 billion', 'short billion');
eq(H.fmtTime(0), '00:00', 'time 0');
eq(H.fmtTime(65.9), '01:05', 'time 65');
eq(H.fmtTime(3725), '1:02:05', 'time 1h');
eq(H.fmtTime(90061), '1d 01:01:01', 'time 1d');
for (let l = 0; l < 4000; l += 0.37) { const p = H.parts(l); ok(!/NaN|undefined|Infinity/.test(p.num + p.word) && parseFloat(p.num.replace(/,/g, '')) < 1000 || l < 6, 'parts sane ' + l); }

// log math
near(H.L.add(H.L.from(3), H.L.from(4)), Math.log10(7), 1e-12, 'add');
near(H.L.sub(H.L.from(10), H.L.from(4)), Math.log10(6), 1e-12, 'sub');
eq(H.L.sub(2, 2), H.ZERO, 'sub to zero');
eq(H.L.sub(2, 3), H.ZERO, 'sub floors at zero');
eq(H.L.add(H.ZERO, 5), 5, 'add zero');
eq(H.L.add(500, 2), 500, 'add tiny to huge');

// upgrades
for (let k = 0; k < 2000; k++) {
  const u = H.upgrade(k);
  ok(u.cost > (k ? H.upgrade(k - 1).cost : 0) && isFinite(u.mult) && u.mult >= 0 && u.name.indexOf(' ') > 0, 'upgrade ' + k);
}

// stepping is the same in big and small pieces (offline == online)
function runFor(sec, dt) { const r = H.newRun(0); let t = 0; while (t < sec - 1e-9) { const h = Math.min(dt, sec - t); H.step(r, h); t += h; } return r; }
for (const sec of [30, 300, 3600]) {
  const a = runFor(sec, 0.05), b = runFor(sec, sec);
  ok(Math.abs(a.level - b.level) <= 1, 'levels match small vs big steps @' + sec + ': ' + a.level + ' vs ' + b.level);
  near(a.maxLog, b.maxLog, 0.6, 'money matches small vs big steps @' + sec);
  ok(Math.abs(a.ups - b.ups) <= 1, 'upgrades match @' + sec + ': ' + a.ups + ' vs ' + b.ups);
}
{ const r = runFor(30 * 86400, 30 * 86400); ok(isFinite(r.logC) && r.level > 0 && r.level < 1e6, 'a month offline stays sane: lv ' + r.level + ' log ' + r.logC.toFixed(0)); }
{ const r = H.newRun(0); const t0 = Date.now(); H.step(r, 7 * 86400); ok(Date.now() - t0 < 1500, 'a week offline works out fast: ' + (Date.now() - t0) + 'ms'); }
{ const r = H.newRun(0); const o = H.step(r, 120); ok(o.milestones.length >= 3 && o.bought.length >= 10 && o.levels > 30, 'step reports what happened'); ok(o.milestones.every((m, i) => m === i + 1), 'milestones in order'); }

// saves
const s = H.newSave(1000);
s.run = runFor(600, 1);
s.rec.bestLog = 40; s.tro.reset1 = 5; s.tro.fake = 1;
const back = H.parse(H.serialize(s));
ok(back && back.run && back.run.level === s.run.level && Math.abs(back.run.logC - s.run.logC) < 1e-9, 'run round trip');
ok(Math.abs(back.run.upLog - s.run.upLog) < 1e-9 && Math.abs(back.run.speed - s.run.speed) < 1e-9, 'upgrade effects rebuilt the same');
eq(back.tro.fake, undefined, 'unknown trophy dropped');
eq(back.tro.reset1, 5, 'trophy kept');
const z = H.parse(H.serialize(H.newSave(5)));
ok(z && z.run === null && z.rec.bestLog === H.ZERO, 'empty save round trip keeps zero');
eq(H.parse('nope'), null, 'garbage save');
eq(H.parse('{"run":{"level":"x"}}').run, null, 'bad run dropped');
const evil = H.parse(JSON.stringify({ run: { level: 5, logC: 1e300, ups: 1e12, lp: 7 }, set: { quality: 'ultra', music: 5 } }));
ok(evil.run.logC === H.ZERO && evil.run.ups === 0 && evil.run.lp === 0, 'bad numbers cleaned');
eq(evil.set.quality, 'auto', 'bad quality'); eq(evil.set.music, 0.7, 'bad volume');

// money names
eq(H.moneyName(0), 'FLUX', 'first money name');
ok(H.moneyName(24) !== H.moneyName(0) && / II$/.test(H.moneyName(24)), 'money names lap with numbers');
eq(H.worldName(0), 'EVENT HORIZON', 'world 0'); eq(H.worldName(6), 'EVENT HORIZON 2', 'world 6');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
