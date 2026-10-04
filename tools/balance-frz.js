// Diagnóstico de congelación de jefes por partida (con definitivos). Uso: CFG='{"school":"ice","noForms":true}' SEEDS=8 CDP_PORT=9437 node tools/cdp.mjs 360 640 tools/balance-frz.js
const SEEDS = +process.env.SEEDS || 8, ULT = process.env.ULT !== '0';
const CFGS = process.env.CFG ? [JSON.parse(process.env.CFG)] : [{ school: 'ice', noForms: true }, { school: 'ice', path: ['ice'], stop: 1 }, { school: 'ice', path: ['ice', 'bolt'] }, { school: 'ice', path: ['ice', 'fire'], pact: true }, { school: 'arcane', path: ['ice', 'poison'] }];
await ev('__arcano.flags.freeze = true');
for (const c of CFGS) {
  const rows = [];
  for (let s = 1; s <= SEEDS; s++) {
    const r = await ev(`(() => { const r = __arcano.sim(${JSON.stringify(Object.assign({ seed: s, ult: ULT }, c))}); return { ttk: r.ttk, frz: r.frz, ults: r.ults, time: r.time, form: r.form }; })()`);
    rows.push(r);
  }
  console.log(JSON.stringify(c));
  for (const r of rows) console.log('  ', r.form.padEnd(9), String(Math.floor(r.time / 60)) + ':' + String(Math.floor(r.time % 60)).padStart(2, '0'), 'ults', String(r.ults).padEnd(3), [5, 10, 15, 20].map(b => `${b}: ${r.ttk[b]}s ${Math.round((r.frz[b] || 0) * 100)}%`).join('  '));
}
