// Verificación final: cuánto tiempo está en pantalla cada aviso de la ráfaga del despertar (orden, nada se pierde, ≥2 s)
// Uso: CDP_PORT=9482 node tools/cdp.mjs 360 640 tools/rev/vf-toast-tiempos.js
let fails = 0;
const check = (ok, msg, x) => { if (!ok) fails++; console.log((ok ? '  ok   ' : '  FALLO ') + msg + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
const reset = async () => {
  await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: {}, seenHz: {} }))`);
  await ev(`localStorage.removeItem('arcano.meta')`);
  await send('Page.reload', { ignoreCache: true }); await sleep(1500);
  await ev('__arcano.flags.freeze = true'); await ev('__arcano.seed(2)'); await ev('__arcano.grim(true)');
};
// recorre la ráfaga a 1/60 s dentro de la página: devuelve [{aviso, segundos en pantalla}] en orden y lo que quedó sin ver
const run = () => ev(`(() => {
  const A = __arcano, seen = [], all = new Set();
  let cur = null, n = 0;
  const head = () => { const t = A.toasts(); for (const s of t) if (!s.startsWith('BANNER') && !s.startsWith('NEXT')) all.add(s.split(' | ')[0]); return t[0] && !t[0].startsWith('BANNER') && !t[0].startsWith('NEXT') ? t[0].split(' | ')[0] : null; };
  for (let i = 0; i < 60 * 40; i++) {
    const st = A.step(1 / 60);
    if (st === 'levelup') A.pick(0);
    const h = head();
    if (h !== cur) { if (cur) seen.push({ aviso: cur, s: +(n / 60).toFixed(2) }); cur = h; n = 0; }
    if (h) n++;
    if (!h && i > 60 && !A.toasts().some(s => !s.startsWith('BANNER') && !s.startsWith('NEXT'))) break;
  }
  if (cur) seen.push({ aviso: cur, s: +(n / 60).toFixed(2) });
  return { seen, perdidos: [...all].filter(a => !seen.some(s => s.aviso === a)), tips: JSON.parse(localStorage.getItem('arcano.settings')).tips };
})()`);

console.log('A) 2º despertar Fuego→Rayo con Concentración (MEZCLA: CHISPAZO): 6 avisos seguidos');
await reset();
await ev(`__arcano.school('fire')`); await ev('__arcano.god(true)'); await ev(`__arcano.give('crit')`);
await ev(`__arcano.awaken('fire')`); await ev('__arcano.step(6)');
await ev('__arcano.goto(12)'); await ev('__arcano.god(true)'); await ev('__arcano.step(0.5)'); await ev('__arcano.clear()'); await ev('__arcano.step(0.3)');
console.log('  antes:', JSON.stringify(await ev('__arcano.toasts()')));
await ev(`__arcano.awaken('bolt', true)`);
let r = await run();
console.log('  vistos:', JSON.stringify(r.seen));
check(r.perdidos.length === 0, 'ninguno se pierde', r.perdidos);
check(r.seen.every(s => s.s >= 1.95), 'cada aviso ≥ 2 s en pantalla', r.seen.filter(s => s.s < 1.95));
const names = r.seen.map(s => s.aviso);
check(names.indexOf('AFINIDAD · FUEGO + RAYO') < names.indexOf('SOLO 2 ELEMENTOS POR PARTIDA') && names.indexOf('SOLO 2 ELEMENTOS POR PARTIDA') < names.indexOf('MEZCLA: CHISPAZO') && names.indexOf('MEZCLA: CHISPAZO') < names.indexOf('MEZCLAS SECRETAS') && names.indexOf('NUEVO DEFINITIVO: TORMENTA') < names.indexOf('¡NUEVA FORMA!'), 'orden: AFINIDAD, SOLO 2, MEZCLA, MEZCLAS SECRETAS, …, NUEVO DEFINITIVO, ¡NUEVA FORMA!', names);
check(r.tips.aff === 1 && r.tips.mix === 1, 'tips aff y mix marcados al mostrarse', r.tips);
console.log('  total ráfaga:', r.seen.reduce((a, s) => a + s.s, 0).toFixed(1), 's');

console.log('B) 1er despertar Fuego→Hielo con ¡PINCHOS! en pantalla (sala 6)');
await reset();
await ev(`__arcano.school('fire')`); await ev('__arcano.god(true)');
let room = 0;
for (const rm of [3, 6, 7, 8]) { await ev(`__arcano.goto(${rm})`); await ev('__arcano.god(true)'); if ((await ev('__arcano.toasts()')).some(s => /^¡(PINCHOS|CHARCO|HIELO|LAVA)/.test(s))) { room = rm; break; } }
await ev('__arcano.step(0.3)'); await ev('__arcano.clear()'); await ev('__arcano.step(0.3)');
console.log('  sala', room, 'antes:', JSON.stringify(await ev('__arcano.toasts()')));
await ev(`__arcano.awaken('ice', true)`);
r = await run();
console.log('  vistos:', JSON.stringify(r.seen));
check(r.perdidos.length === 0, 'ninguno se pierde', r.perdidos);
check(r.seen.every(s => s.s >= 1.95), 'cada aviso ≥ 2 s en pantalla', r.seen.filter(s => s.s < 1.95));
check(r.tips.aff === 1 && r.tips.opp === 1, 'tips aff y opp marcados', r.tips);
console.log('  seenHz:', JSON.stringify(await ev(`JSON.parse(localStorage.getItem('arcano.settings')).seenHz`)));

console.log('C) cola a tope: 10 avisos de golpe (el 9º y 10º tiran un consejo, no un aviso único)');
await reset();
await ev(`__arcano.school('fire')`); await ev('__arcano.god(true)');
await ev(`__arcano.give('ice')`); // AFINIDAD, SOLO 2, ALGO OSCURO
await ev('__arcano.anima(60)'); // DESPERTAR (tip)
const q0 = await ev('__arcano.toasts()');
console.log('  en cola:', q0.length, JSON.stringify(q0.map(s => s.split(' | ')[0])));
check(q0.filter(s => !s.startsWith('BANNER')).length === 4, '4 avisos en cola (1 en pantalla + 3)');
console.log(fails ? `FALLOS: ${fails}` : 'TODO OK');
