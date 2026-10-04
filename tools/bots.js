// Bots de la sección 7: una partida suelta, el banco de jefes y la matriz (simMatrix)
// Uso: MODE=one|bench|matrix SEEDS=2 CDP_PORT=9434 node tools/cdp.mjs 360 640 tools/bots.js
const MODE = process.env.MODE || 'one', SEEDS = +process.env.SEEDS || 2, ULT = process.env.ULT === '1';
await ev('__arcano.flags.freeze = true');
const before = await ev('JSON.stringify({ g: __arcano.grim(), a: __arcano.ach(), c: __arcano.cookie().length })');
if (MODE === 'one') {
  for (const cfg of [{ school: 'fire', path: ['fire', 'bolt'] }, { school: 'fire', path: [], noForms: true }, { school: 'fire', path: ['fire', 'ice'], pact: true }]) {
    const t0 = Date.now();
    const r = await ev(`(() => { const r = __arcano.sim(${JSON.stringify(cfg)}); return JSON.stringify(r); })()`);
    console.log(((Date.now() - t0) / 1000).toFixed(1) + ' s', r.slice(0, 900));
  }
} else if (MODE === 'bench') {
  for (const cfg of [
    { room: 15, school: 'fire', noForms: true }, { room: 15, school: 'fire', path: ['fire', 'bolt'] },
    { room: 15, school: 'ice', noForms: true }, { room: 15, school: 'ice', path: ['ice', 'bolt'] },
    { room: 20, school: 'bolt', path: ['bolt', 'poison'], pact: true },
  ]) console.log(JSON.stringify(await ev(`__arcano.bench(${JSON.stringify(cfg)})`)));
} else {
  const t0 = Date.now();
  const m = await ev(`__arcano.simMatrix({ seeds: ${SEEDS}, ult: ${ULT} }).then(r => JSON.stringify(r))`);
  const R = JSON.parse(m);
  console.log(`matriz: ${R.rows.length} configuraciones × ${SEEDS} semillas${ULT ? ' (con definitivos)' : ''} en ${R.secs} s (reloj ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  const fmt = s => s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  console.log('grupo     config                 win  tiempo  1º  2º  redA redB redC  frzJefe  formas                       ttk 5/10/15/20         shots parts aff bad');
  for (const r of R.rows) console.log([r.g.padEnd(9), r.id.padEnd(22), String(r.win).padEnd(4), fmt(r.time).padEnd(7), String(r.aw1 ?? '—').padEnd(3), String(r.aw2 ?? '—').padEnd(3),
    String(r.netA).padEnd(4), String(r.netB).padEnd(4), String(r.netC).padEnd(4), String(r.frz).padEnd(8), JSON.stringify(r.forms).padEnd(28),
    [5, 10, 15, 20].map(b => r.ttk[b] ?? '—').join('/').padEnd(22), String(r.maxShots).padEnd(5), String(r.maxParts).padEnd(5), String(r.maxAff).padEnd(3), r.badOffer + (r.stuck ? ' atascos ' + r.stuck : '')].join(' '));
  console.log('\nobjetivos (7.2):');
  for (const c of R.checks) console.log((c.ok ? 'OK   ' : 'NO   ') + c.name + '  ' + JSON.stringify(c.val));
}
const after = await ev('JSON.stringify({ g: __arcano.grim(), a: __arcano.ach(), c: __arcano.cookie().length })');
console.log(before === after ? 'OK   el progreso guardado no cambia con los bots' : 'FAIL los bots han tocado el progreso ' + before + ' → ' + after);
console.log('estado final', await ev('__arcano.state'));
