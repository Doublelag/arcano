// Iteración rápida del balance: banco de salas normales (roomBench) y de jefes (bench 15 y 20) de cada forma contra la
// misma build sin formas (mismas runas). La base no depende de forms.js: se guarda en tools/out/base-cache.json
// (bórrala si cambia game.js: DR, enemigos, salas...).
// Uso: [SEEDS=16] [BSEEDS=5] [ONLY=eclipse,hibrida] [SKIP=salas|jefes] [OUT=f.json] CDP_PORT=9437 node tools/cdp.mjs 360 640 tools/balance-banco.js
const fs = await import('node:fs');
const SEEDS = +process.env.SEEDS || 16, BSEEDS = +process.env.BSEEDS || 5, ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const SKIP = process.env.SKIP || '', OUT = process.env.OUT || '';
const CACHE = 'E:/PROYECTOS/arcano/tools/out/base-cache.json';
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const R = [
  ...['fire', 'ice', 'bolt', 'poison'].map(s => ({ g: 'pura', school: s, path: [s] })),
  ...[['fire', 'bolt'], ['bolt', 'fire'], ['bolt', 'ice'], ['ice', 'bolt'], ['ice', 'poison'], ['poison', 'ice'], ['poison', 'fire'], ['fire', 'poison']].map(([a, b]) => ({ g: 'hibrida', school: a, path: [a, b] })),
  ...[['fire', 'ice'], ['ice', 'fire'], ['bolt', 'poison'], ['poison', 'bolt']].map(([a, b]) => ({ g: 'eclipse', school: a, path: [a, b], pact: true })),
  { g: 'arcanista', school: 'arcane', path: ['fire', 'bolt'] }, { g: 'arcanista', school: 'arcane', path: ['ice', 'poison'] },
].filter(c => (!ONLY || ONLY.includes(c.g)) && (!process.env.IDS || process.env.IDS.split(',').includes(c.school + '/' + c.path.join('+'))));
await ev('__arcano.flags.freeze = true');
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const med = a => { const v = a.slice().sort((x, y) => x - y), m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
async function base(kind, c, seed, room) {
  const k = `${kind}|${c.school}|${c.path.join('+')}|${seed}|${room || ''}`;
  if (cache[k] == null) {
    const o = Object.assign({ seed, noForms: true, school: c.school, path: c.path }, room ? { room } : {});
    const r = await ev(`__arcano.${kind}(${JSON.stringify(o)})`);
    cache[k] = kind === 'roomBench' ? r.total : r.ttk;
  }
  return cache[k];
}
const out = [];
console.log(`banco: salas (${SEEDS} semillas) y jefes 15/20 (${BSEEDS} semillas); forma / misma build sin formas`);
console.log('ruta                     forma      salas  q        J15   q15   frz   J20   q20   frz');
for (const c of R) {
  const row = { g: c.g, id: `${c.school}/${c.path.join('+')}${c.pact ? ' pacto' : ''}` };
  if (!SKIP.includes('salas')) {
    const q = [];
    for (let s = 1; s <= SEEDS; s++) { const f = await ev(`__arcano.roomBench(${JSON.stringify(Object.assign({ seed: s }, c))})`); row.form = f.form; q.push(f.total / await base('roomBench', c, s)); }
    row.salas = mean(q); row.salasE = Math.sqrt(q.reduce((s, v) => s + (v - row.salas) ** 2, 0) / (q.length - 1) / q.length);
  }
  if (!SKIP.includes('jefes')) for (const room of [15, 20]) {
    const t = [], b = [], fz = [];
    for (let s = 1; s <= BSEEDS; s++) { const f = await ev(`__arcano.bench(${JSON.stringify(Object.assign({ seed: s, room }, c))})`); row.form = f.form; t.push(f.ttk); fz.push(f.frz); b.push(await base('bench', c, s, room)); }
    row['j' + room] = med(t); row['q' + room] = med(t) / med(b); row['f' + room] = Math.max(...fz); row['b' + room] = med(b);
  }
  out.push(row);
  const f = (v, d = 3) => v == null ? '—' : v.toFixed(d);
  console.log(row.id.padEnd(24), String(row.form).padEnd(9), f(row.salas).padEnd(6), ('±' + f(row.salasE)).padEnd(8), f(row.j15, 1).padEnd(5), f(row.q15, 2).padEnd(5), f(row.f15, 2).padEnd(5), f(row.j20, 1).padEnd(5), f(row.q20, 2).padEnd(5), f(row.f20, 2));
}
fs.mkdirSync('E:/PROYECTOS/arcano/tools/out', { recursive: true }); // tools/out/ no se sube (.gitignore)
fs.writeFileSync(CACHE, JSON.stringify(cache));
for (const k of ['pura', 'hibrida', 'eclipse', 'arcanista']) { const g = out.filter(r => r.g === k); if (g.length) console.log(`media ${k}: salas ${g[0].salas != null ? mean(g.map(r => r.salas)).toFixed(3) : '—'}  J15 ${g[0].q15 != null ? mean(g.map(r => r.q15)).toFixed(2) : '—'}  J20 ${g[0].q20 != null ? mean(g.map(r => r.q20)).toFixed(2) : '—'}`); }
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
