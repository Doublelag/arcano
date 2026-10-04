// Congelación de jefe con definitivos por configuración: pesada por tiempo, peor partida, peor combate y peor combate de 8 s o más.
// Uso: CDP_PORT=9437 node tools/cdp.mjs 360 640 tools/balance-frz-pesada.js
await ev('__arcano.flags.freeze = true');
const SEEDS = 16;
for (const c of [{ school: 'ice', noForms: true }, { school: 'ice', path: ['ice'], stop: 1 }, { school: 'ice', path: ['ice', 'bolt'] }, { school: 'bolt', path: ['bolt', 'ice'] }, { school: 'ice', path: ['ice', 'poison'] }, { school: 'ice', path: ['ice', 'fire'], pact: true }, { school: 'arcane', path: ['ice', 'poison'] }]) {
  let F = 0, T = 0, mx = 0, mxL = 0, nShort = 0, n = 0; const per = [];
  for (let s = 1; s <= SEEDS; s++) {
    const r = await ev(`(() => { const r = __arcano.sim(${JSON.stringify(Object.assign({ seed: s, ult: true }, c))}); return { ttk: r.ttk, frz: r.frz }; })()`);
    let f = 0, t = 0;
    for (const b of Object.keys(r.ttk)) { const tt = r.ttk[b], fz = r.frz[b] || 0; f += tt * fz; t += tt; n++; mx = Math.max(mx, fz); if (tt >= 8) mxL = Math.max(mxL, fz); else nShort++; }
    F += f; T += t; per.push(f / t);
  }
  per.sort((a, b) => a - b);
  console.log(JSON.stringify(c).padEnd(60), 'pesada', (F / T).toFixed(2), ' peor partida', per[per.length - 1].toFixed(2), ' max combate', mx.toFixed(2), ' max combate >=8s', mxL.toFixed(2), ` (${nShort}/${n} combates <8s)`);
}
