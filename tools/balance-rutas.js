// Cada ruta con formas contra la misma ruta sin formas (mismas runas, mismo bot): aísla lo que aporta el Despertar.
// Uso: SEEDS=8 [ULT=1] [ONLY=hibrida,eclipse] [OUT=f.json] CDP_PORT=9437 node tools/cdp.mjs 360 640 tools/balance-rutas.js
const fs = await import('node:fs');
const SEEDS = +process.env.SEEDS || 8, ULT = process.env.ULT === '1', ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, OUT = process.env.OUT || '';
const med = a => { const v = a.filter(Number.isFinite).sort((x, y) => x - y), m = v.length >> 1; return !v.length ? null : v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const fmt = s => s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const R = [
  ...['fire', 'ice', 'bolt', 'poison'].map(s => ({ g: 'pura', school: s, path: [s], stop: 1 })),
  ...[['fire', 'bolt'], ['bolt', 'fire'], ['bolt', 'ice'], ['ice', 'bolt'], ['ice', 'poison'], ['poison', 'ice'], ['poison', 'fire'], ['fire', 'poison']].map(([a, b]) => ({ g: 'hibrida', school: a, path: [a, b] })),
  ...[['fire', 'ice'], ['ice', 'fire'], ['bolt', 'poison'], ['poison', 'bolt']].map(([a, b]) => ({ g: 'eclipse', school: a, path: [a, b], pact: true })),
  { g: 'arcanista', school: 'arcane', path: ['fire', 'bolt'] }, { g: 'arcanista', school: 'arcane', path: ['ice', 'poison'] },
].filter(c => (!ONLY || ONLY.includes(c.g)) && (!process.env.IDS || process.env.IDS.split(',').includes(c.school + '/' + c.path.join('+'))));
await ev('__arcano.flags.freeze = true');
const out = [];
console.log(`rutas × ${SEEDS} semillas${ULT ? ' (con definitivos)' : ''}: formas contra la misma ruta sin formas`);
console.log('ruta                     forma      t.formas t.base  ratio  q±err        1º   2º   redB redC frz   lvl');
for (const c of R) {
  const F = [], B = [];
  for (let s = 1; s <= SEEDS; s++) {
    const q = o => `(() => { const r = __arcano.sim(${JSON.stringify(Object.assign({ seed: s, ult: ULT }, c, o))}); return { time: r.time, win: r.win, form: r.form, awk: r.awk, net: r.net, frz: r.frz, ttk: r.ttk, lvl: r.lvl }; })()`;
    F.push(await ev(q({})));
    B.push(await ev(q({ noForms: true })));
  }
  const tf = med(F.map(r => r.time)), tb = med(B.map(r => r.time));
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length, sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
  // media del cociente por semilla (misma semilla = mismas salas hasta el despertar) y su error típico
  const q = F.map((r, i) => r.time / B[i].time), qm = mean(q), qe = sd(q) / Math.sqrt(q.length);
  const aw = n => med(F.map(r => (r.awk.find(a => a.st === n) || {}).room));
  const forms = {}; for (const r of F) forms[r.form] = (forms[r.form] || 0) + 1;
  const row = { g: c.g, id: `${c.school}/${c.path.join('+')}${c.pact ? ' pacto' : ''}`, forms, tf, tb, ratio: Math.round(tf / tb * 100) / 100, qm: Math.round(qm * 1000) / 1000, qe: Math.round(qe * 1000) / 1000, mf: mean(F.map(r => r.time)), mb: mean(B.map(r => r.time)), aw1: aw(1), aw2: aw(2),
    netB: F.filter(r => r.net.includes('b')).length / SEEDS, netC: F.filter(r => r.net.includes('c')).length / SEEDS,
    frz: Math.max(0, ...F.flatMap(r => Object.values(r.frz))), win: F.filter(r => r.win).length / SEEDS, lvl: med(F.map(r => r.lvl)),
    ttkF: Object.fromEntries([5, 10, 15, 20].map(b => [b, med(F.map(r => r.ttk[b]))])), ttkB: Object.fromEntries([5, 10, 15, 20].map(b => [b, med(B.map(r => r.ttk[b]))])) };
  out.push(row);
  console.log([row.id.padEnd(24), Object.keys(forms).join(',').padEnd(10), fmt(tf).padEnd(8), fmt(tb).padEnd(7), String(row.ratio).padEnd(6), (row.qm.toFixed(3) + '±' + row.qe.toFixed(3)).padEnd(12), String(row.aw1 ?? '—').padEnd(4), String(row.aw2 ?? '—').padEnd(4),
    String(Math.round(row.netB * 100) / 100).padEnd(4), String(Math.round(row.netC * 100) / 100).padEnd(4), String(row.frz).padEnd(5), row.lvl, row.win < 1 ? 'DERROTAS ' + row.win : ''].join(' '));
}
const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
const g = k => out.filter(r => r.g === k);
for (const k of ['pura', 'hibrida', 'eclipse', 'arcanista']) if (g(k).length) console.log(`media ${k}: ratio ${avg(g(k).map(r => r.ratio)).toFixed(2)}  q ${avg(g(k).map(r => r.qm)).toFixed(3)}  tiempo ${fmt(avg(g(k).map(r => r.tf)))}`);
console.log(`media total: ratio ${avg(out.map(r => r.ratio)).toFixed(2)}  q ${avg(out.map(r => r.qm)).toFixed(3)}  tiempo ${fmt(avg(out.map(r => r.tf)))}`);
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
