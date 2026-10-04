// Balance con bots (sección 7.2/7.3): matriz por grupos, banco de jefes y coste. Guarda el JSON en OUT si se pide.
// Uso: SEEDS=8 [ONLY=base,pura] [ULT=1] [OUT=fichero.json] [MODE=matrix|bench|both] CDP_PORT=9437 node tools/cdp.mjs 360 640 tools/balance.js
const fs = await import('node:fs');
const MODE = process.env.MODE || 'matrix', SEEDS = +process.env.SEEDS || 8, ULT = process.env.ULT === '1';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, OUT = process.env.OUT || '';
const fmt = s => s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
await ev('__arcano.flags.freeze = true');
const before = await ev('JSON.stringify({ g: __arcano.grim(), a: __arcano.ach(), c: __arcano.cookie().length })');
const res = {};
if (MODE === 'matrix' || MODE === 'both') {
  const t0 = Date.now();
  const R = JSON.parse(await ev(`__arcano.simMatrix({ seeds: ${SEEDS}, ult: ${ULT}, only: ${JSON.stringify(ONLY)} }).then(r => JSON.stringify(r))`));
  res.matrix = R;
  console.log(`matriz: ${R.rows.length} configs × ${SEEDS} semillas${ULT ? ' (con definitivos)' : ''} en ${R.secs} s (reloj ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  console.log('grupo     config                 win  tiempo  1º   2º   redA redB redC frz/≥8s/pes     formas                                 ttk 5/10/15/20         shots parts');
  for (const r of R.rows) console.log([r.g.padEnd(9), r.id.padEnd(22), String(r.win).padEnd(4), fmt(r.time).padEnd(7), String(r.aw1 ?? '—').padEnd(4), String(r.aw2 ?? '—').padEnd(4),
    String(r.netA).padEnd(4), String(r.netB).padEnd(4), String(r.netC).padEnd(4), `${r.frz}/${r.frz8}/${r.frzW}`.padEnd(15), JSON.stringify(r.forms).padEnd(38),
    [5, 10, 15, 20].map(b => r.ttk[b] ?? '—').join('/').padEnd(22), String(r.maxShots).padEnd(5), String(r.maxParts).padEnd(5), (r.badOffer ? 'bad ' + r.badOffer : '') + (r.stuck ? ' atascos ' + r.stuck : '')].join(' '));
  console.log('\nobjetivos (7.2):');
  for (const c of R.checks) console.log((c.ok ? 'OK   ' : 'NO   ') + c.name + '  ' + JSON.stringify(c.val));
}
if (MODE === 'bench' || MODE === 'both') {
  const B = [];
  const CF = [];
  for (const room of [15, 20]) {
    for (const s of ['fire', 'ice', 'bolt', 'poison', 'arcane']) CF.push({ room, school: s, noForms: true });
    // base con las mismas runas que la ruta (sin formas): aísla lo que aporta el Despertar
    if (process.env.PAIRBASE === '1') for (const [a, b] of [['fire', 'bolt'], ['bolt', 'ice'], ['ice', 'poison'], ['poison', 'fire'], ['fire', 'ice'], ['bolt', 'poison']]) CF.push({ room, school: a, path: [a, b], noForms: true });
    for (const s of ['fire', 'ice', 'bolt', 'poison']) CF.push({ room, school: s, path: [s] });
    for (const [a, b] of [['fire', 'bolt'], ['bolt', 'fire'], ['bolt', 'ice'], ['ice', 'bolt'], ['ice', 'poison'], ['poison', 'ice'], ['poison', 'fire'], ['fire', 'poison']]) CF.push({ room, school: a, path: [a, b] });
    for (const [a, b] of [['fire', 'ice'], ['ice', 'fire'], ['bolt', 'poison'], ['poison', 'bolt']]) CF.push({ room, school: a, path: [a, b], pact: true });
    CF.push({ room, school: 'arcane', path: ['fire', 'bolt'] }, { room, school: 'arcane', path: ['ice', 'poison'] });
  }
  const BS = +process.env.BSEEDS || 3;
  for (const c of CF) {
    const rs = [];
    for (let s = 1; s <= BS; s++) rs.push(await ev(`__arcano.bench(${JSON.stringify(Object.assign({ seed: s, ult: ULT }, c))})`));
    const med = a => { const v = a.slice().sort((x, y) => x - y), m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
    const row = { room: c.room, id: `${c.school}/${(c.path || []).join('+') || '-'}${c.noForms ? ' base' : ''}${c.pact ? ' pacto' : ''}`, base: !!c.noForms, school: c.school,
      ttk: med(rs.map(r => r.ttk)), frz: Math.max(...rs.map(r => r.frz)), killed: rs.every(r => r.killed), form: rs[0].form, atk: rs[0].atk, linaje: rs[0].linaje };
    B.push(row);
  }
  res.bench = B;
  console.log('\nbanco de jefes (mediana de ' + BS + ' semillas)' + (ULT ? ' con definitivos' : ''));
  for (const room of [15, 20]) {
    const tgt = room === 15 ? [15, 20] : [25, 35];
    console.log(`-- sala ${room} (objetivo ${tgt[0]}-${tgt[1]} s, ≥60% del TTK base, congelación ≤35%)`);
    for (const r of B.filter(x => x.room === room)) {
      const b = B.find(x => x.room === room && x.base && x.school === r.school && x.id.split(' ')[0].endsWith('/-'));
      const rel = b && !r.base ? Math.round(r.ttk / b.ttk * 100) / 100 : null;
      const bad = [];
      if (!r.base && (r.ttk < tgt[0] || r.ttk > tgt[1])) bad.push('ttk');
      if (rel != null && rel < 0.6) bad.push('<60%');
      if (r.frz > 0.35) bad.push('frz');
      if (!r.killed) bad.push('vivo');
      console.log([r.id.padEnd(26), r.form.padEnd(9), String(r.ttk).padEnd(6), String(rel ?? '').padEnd(5), String(r.frz).padEnd(5), 'atk ' + r.atk, r.linaje ? 'linaje' : '', bad.length ? 'NO ' + bad.join(',') : ''].join(' '));
    }
  }
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
const after = await ev('JSON.stringify({ g: __arcano.grim(), a: __arcano.ach(), c: __arcano.cookie().length })');
console.log(before === after ? 'OK   el progreso guardado no cambia con los bots' : 'FAIL los bots han tocado el progreso ' + before + ' → ' + after);
