// Línea base de los bots en modo dios (fase 0 de docs/progresion-spec.md §9.5): JSON con semillas fijas.
// Uso: CDP_PORT=9601 PART=matrix|bench|room OUT=tools/baseline/x.json node tools/cdp.mjs 360 640 tools/baseline/baseline.js
//   PART=matrix ONLY=base,pura   → simMatrix({seeds:8, only}) (sin `secs`, que es tiempo real)
//   PART=bench                   → bench de los 4 jefes × 5 escuelas × semillas 1-3 (con y sin formas, y rutas con despertar)
//   PART=room                    → roomBench × 5 escuelas × semillas 1-2 (con y sin formas)
// Comparar dos ficheros: node tools/baseline/compare.mjs a.json b.json
const fs = await import('node:fs');
const E = process.env, PART = E.PART || 'matrix', OUT = E.OUT || `E:/PROYECTOS/arcano/tools/baseline/${PART}.json`;
const ONLY = E.ONLY ? E.ONLY.split(',') : null;
for (let i = 0; i < 60 && (await ev(`!!(window.__arcano && window.__arcano.simMatrix)`)) !== true; i++) await sleep(150);
const SCH = ['fire', 'ice', 'bolt', 'poison', 'arcane'];
const PATHS = { fire: ['fire', 'bolt'], ice: ['ice', 'poison'], bolt: ['bolt', 'ice'], poison: ['poison', 'fire'], arcane: ['fire', 'bolt'] };
let out;
const t0 = Date.now();
if (PART === 'matrix') {
  out = await ev(`__arcano.simMatrix(${JSON.stringify({ seeds: +E.SEEDS || 8, only: ONLY })}).then(r => { delete r.secs; return r; })`);
} else if (PART === 'sims') { // partidas sueltas con todo el detalle (tiempo por sala, TTK, despertares…): comparación fina
  out = [];
  const CFG = [...SCH.map(school => ({ school, noForms: true })), ...SCH.map(school => ({ school, path: PATHS[school] })),
    { school: 'fire', path: ['fire', 'ice'], pact: true }, { school: 'ice', path: ['ice'], stop: 1, ult: true }, { school: 'bolt', path: ['bolt', 'poison'], fresh: true }];
  for (const c of CFG) for (let seed = 1; seed <= (+E.SEEDS || 4); seed++) out.push(await ev(`__arcano.sim(${JSON.stringify(Object.assign({ seed }, c))})`));
} else if (PART === 'bench') {
  out = [];
  for (const room of [5, 10, 15, 20]) for (const school of SCH) for (const v of [{ noForms: true }, { path: PATHS[school] }]) for (let seed = 1; seed <= 3; seed++) {
    out.push(await ev(`__arcano.bench(${JSON.stringify(Object.assign({ room, school, seed }, v))})`));
  }
} else if (PART === 'room') {
  out = [];
  for (const school of SCH) for (const v of [{ noForms: true }, { path: PATHS[school] }]) for (let seed = 1; seed <= 2; seed++) {
    out.push(await ev(`__arcano.roomBench(${JSON.stringify(Object.assign({ school, seed }, v))})`));
  }
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(PART, ONLY ? ONLY.join(',') : '', '→', OUT, `(${Math.round((Date.now() - t0) / 1000)} s)`, typeof out === 'string' ? out.slice(0, 300) : '');
