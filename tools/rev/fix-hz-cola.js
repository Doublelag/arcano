// Aviso de trampa (seenHz): se da por visto al SALIR en pantalla, no al encolarse, y no se duplica si ya espera en la cola
// Uso: CDP_PORT=9461 node tools/cdp.mjs 360 640 tools/rev/fix-hz-cola.js
let fails = 0;
const check = (ok, msg, x) => { if (!ok) fails++; console.log((ok ? '  ok   ' : '  FALLO ') + msg + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
const HZ = /^¡(PINCHOS|CHARCO VENENOSO|HIELO|LAVA)!/;
const seenHz = async () => JSON.parse(await ev(`localStorage.getItem('arcano.settings')`)).seenHz || {};
const start = async () => {
  await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: {}, seenHz: {} }))`);
  await send('Page.reload', {}); await sleep(1500);
  await ev('__arcano.flags.freeze = true'); await ev('__arcano.seed(11)');
  await ev(`__arcano.school('fire')`); await ev('__arcano.god(true)');
};
const toTrapRoom = async () => { // salas normales hasta que alguna tenga trampa (su aviso entra en la cola)
  for (const r of [3, 6, 7, 8, 11, 12, 13, 16, 17, 18]) {
    await ev(`__arcano.goto(${r})`); await ev('__arcano.god(true)');
    if ((await ev('__arcano.toasts()')).some(s => HZ.test(s))) return r;
  }
  return 0;
};
// A) sin nada delante: el aviso sale ya y queda visto
console.log('A) aviso de trampa sin cola');
await start();
let r = await toTrapRoom();
console.log('  sala', r, JSON.stringify(await ev('__arcano.toasts()')), 'seenHz', JSON.stringify(await seenHz()));
check(r && Object.keys(await seenHz()).length === 1, 'sale en pantalla y queda visto');
// B) con 3 avisos delante (AFINIDAD, SOLO 2, ALGO OSCURO): espera en la cola sin darse por visto, no se duplica y al salir queda visto
console.log('B) aviso de trampa detrás de otros 3');
await start();
await ev(`__arcano.give('ice')`);
r = await toTrapRoom();
const q = await ev('__arcano.toasts()');
console.log('  sala', r, JSON.stringify(q), 'seenHz', JSON.stringify(await seenHz()));
check(r && !HZ.test(q[0]) && q.some(s => HZ.test(s)), 'el aviso de trampa espera en la cola');
check(Object.keys(await seenHz()).length === 0, 'mientras espera no se da por visto');
await ev(`__arcano.goto(${r})`); await ev('__arcano.god(true)');
check((await ev('__arcano.toasts()')).filter(s => HZ.test(s)).length <= 1, 'otra sala con trampa: no se duplica');
for (let i = 0; i < 200 && !HZ.test((await ev('__arcano.toasts()'))[0] || ''); i++) await ev('__arcano.step(0.1)');
check(HZ.test((await ev('__arcano.toasts()'))[0] || '') && Object.keys(await seenHz()).length === 1, 'cuando sale en pantalla, queda visto', await seenHz());
console.log(fails ? `FALLOS: ${fails}` : 'TODO OK');
