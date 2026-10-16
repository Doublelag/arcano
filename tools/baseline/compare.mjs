// Compara dos carpetas de línea base (JSON de los bots en modo dios). Criterio de la fase 1: IDÉNTICOS.
// Uso: node tools/baseline/compare.mjs tools/baseline <otra carpeta>
import { readFileSync, existsSync } from 'node:fs';
const [a, b] = process.argv.slice(2);
let bad = 0;
for (const f of ['simMatrix.json', 'sims.json', 'bench.json', 'roomBench.json']) {
  if (!existsSync(`${a}/${f}`) || !existsSync(`${b}/${f}`)) { console.log(`${f}: falta`); bad++; continue; }
  const x = readFileSync(`${a}/${f}`, 'utf8').replace(/\r/g, ''), y = readFileSync(`${b}/${f}`, 'utf8').replace(/\r/g, '');
  if (x === y) { console.log(`${f}: IDÉNTICO`); continue; }
  bad++;
  const X = x.split('\n'), Y = y.split('\n');
  const i = X.findIndex((l, k) => l !== Y[k]);
  console.log(`${f}: DISTINTO (primera diferencia en la línea ${i + 1})\n  - ${X[i]}\n  + ${Y[i]}`);
}
process.exit(bad ? 1 : 0);
