// Compara dos carpetas de línea base (JSON de los bots en modo dios). Criterio de las fases 1-3: IDÉNTICOS.
// Uso: node tools/baseline/compare.mjs tools/baseline <otra carpeta>
// Los campos que se añadieron después de la línea base (fase 3: contador de golpes de sim) solo se comparan si
// existen en las dos carpetas: si la línea base no los tiene, se quitan de la otra antes de comparar.
import { readFileSync, existsSync } from 'node:fs';
const NEW_KEYS = ['hits', 'dmgTaken', 'rawN', 'raw', 'rawBy', 'hitsBy', 'maxBullets'];
const [a, b] = process.argv.slice(2);
let bad = 0;
const has = (v, k) => v && typeof v === 'object' && (Array.isArray(v) ? v.some(x => has(x, k)) : k in v || Object.values(v).some(x => has(x, k)));
const strip = (v, ks) => Array.isArray(v) ? v.map(x => strip(x, ks)) : v && typeof v === 'object'
  ? Object.fromEntries(Object.entries(v).filter(([k]) => !ks.includes(k)).map(([k, x]) => [k, strip(x, ks)])) : v;
for (const f of ['simMatrix.json', 'sims.json', 'bench.json', 'roomBench.json']) {
  if (!existsSync(`${a}/${f}`) || !existsSync(`${b}/${f}`)) { console.log(`${f}: falta`); bad++; continue; }
  let x = readFileSync(`${a}/${f}`, 'utf8').replace(/\r/g, ''), y = readFileSync(`${b}/${f}`, 'utf8').replace(/\r/g, '');
  const X0 = JSON.parse(x), Y0 = JSON.parse(y), gone = NEW_KEYS.filter(k => !has(X0, k) && has(Y0, k));
  if (gone.length) { x = JSON.stringify(X0, null, 1); y = JSON.stringify(strip(Y0, gone), null, 1); }
  const note = gone.length ? ` (sin ${gone.join(', ')}, que la línea base no tiene)` : '';
  if (x === y) { console.log(`${f}: IDÉNTICO${note}`); continue; }
  bad++;
  const X = x.split('\n'), Y = y.split('\n');
  const i = X.findIndex((l, k) => l !== Y[k]);
  console.log(`${f}: DISTINTO${note} (primera diferencia en la línea ${i + 1})\n  - ${X[i]}\n  + ${Y[i]}`);
}
process.exit(bad ? 1 : 0);
