// Banco de salas normales (roomBench): cada forma contra la misma build sin formas, con las mismas salas y semillas.
// Uso: SEEDS=12 [ONLY=pura,hibrida] [ROOMS=7,8,11] [OUT=f.json] CDP_PORT=9437 node tools/cdp.mjs 360 640 tools/balance-salas.js
const fs = await import('node:fs');
const SEEDS = +process.env.SEEDS || 12, ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, OUT = process.env.OUT || '';
const ROOMS = process.env.ROOMS ? process.env.ROOMS.split(',').map(Number) : null;
const R = [
  ...['fire', 'ice', 'bolt', 'poison'].map(s => ({ g: 'pura', school: s, path: [s] })),
  ...[['fire', 'bolt'], ['bolt', 'fire'], ['bolt', 'ice'], ['ice', 'bolt'], ['ice', 'poison'], ['poison', 'ice'], ['poison', 'fire'], ['fire', 'poison']].map(([a, b]) => ({ g: 'hibrida', school: a, path: [a, b] })),
  ...[['fire', 'ice'], ['ice', 'fire'], ['bolt', 'poison'], ['poison', 'bolt']].map(([a, b]) => ({ g: 'eclipse', school: a, path: [a, b], pact: true })),
  { g: 'arcanista', school: 'arcane', path: ['fire', 'bolt'] }, { g: 'arcanista', school: 'arcane', path: ['ice', 'poison'] },
].filter(c => !ONLY || ONLY.includes(c.g));
await ev('__arcano.flags.freeze = true');
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const out = [];
console.log(`banco de salas × ${SEEDS} semillas: tiempo total de limpiar las salas, forma / misma build sin formas`);
for (const c of R) {
  const F = [], B = [];
  for (let s = 1; s <= SEEDS; s++) {
    const q = o => `__arcano.roomBench(${JSON.stringify(Object.assign({ seed: s }, ROOMS ? { rooms: ROOMS } : {}, c, o))})`;
    F.push(await ev(q({})));
    B.push(await ev(q({ noForms: true })));
  }
  const mf = mean(F.map(r => r.total)), mb = mean(B.map(r => r.total));
  const q = F.map((r, i) => r.total / B[i].total), qm = mean(q), qe = Math.sqrt(q.reduce((s, v) => s + (v - qm) ** 2, 0) / (q.length - 1) / q.length);
  const row = { g: c.g, id: `${c.school}/${c.path.join('+')}${c.pact ? ' pacto' : ''}`, form: F[0].form, mf, mb, ratio: mf / mb, qm, qe };
  out.push(row);
  console.log(row.id.padEnd(24), row.form.padEnd(9), mf.toFixed(1).padStart(6), mb.toFixed(1).padStart(6), ' ratio', row.ratio.toFixed(3), ' q', qm.toFixed(3) + '±' + qe.toFixed(3));
}
for (const k of ['pura', 'hibrida', 'eclipse', 'arcanista']) { const g = out.filter(r => r.g === k); if (g.length) console.log(`media ${k}: ratio ${mean(g.map(r => r.ratio)).toFixed(3)}`); }
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
