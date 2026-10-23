// Pacing check: how fast does a run grow?
const H = require('./src/core.js');
const r = H.newRun(0);
const marks = [10, 30, 60, 120, 300, 600, 1200, 1800, 3600, 7200, 21600, 43200, 86400, 259200, 604800];
let t = 0, mi = 0, bought = 0, levels = 0, miles = [];
const firstTier = {};
while (mi < marks.length) {
  const dt = t < 3600 ? 0.1 : t < 86400 ? 1 : 10;
  const o = H.step(r, dt);
  bought += o.bought.length; levels += o.levels;
  for (const m of o.milestones) if (!(m in firstTier)) firstTier[m] = r.t;
  t += dt;
  if (t >= marks[mi] - 1e-9) {
    const p = H.parts(r.logC);
    console.log(H.fmtTime(t).padStart(12), ('lv ' + r.level).padEnd(8), ('w ' + H.worldOf(r.level)).padEnd(5), ('ups ' + r.ups).padEnd(8),
      'log', r.logC.toFixed(1).padStart(7), '|', p.num, p.word, '| income/s 10^' + H.incomeLog(r).toFixed(1), '| money', H.moneyName(r.maxTier));
    mi++;
  }
}
const ft = Object.entries(firstTier).slice(0, 12).map(([k, v]) => k + '@' + v.toFixed(0) + 's').join(' ');
console.log('first milestones:', ft);
const gaps = []; const keys = Object.keys(firstTier).map(Number);
for (let i = 1; i < keys.length; i++) gaps.push(firstTier[keys[i]] - firstTier[keys[i - 1]]);
console.log('milestone gap at 10m/1h/24h ~', [600, 3600, 86400].map((T) => { const i = keys.findIndex((k) => firstTier[k] > T); return i > 0 ? gaps[i - 1].toFixed(0) + 's' : '-'; }).join(' / '));
