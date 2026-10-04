// Verificación: ¿la cola de avisos (tope 3) tira AFINIDAD / SOLO 2 al despertar SIN aviso previo en pantalla?
// Uso: CDP_PORT=9474 node tools/cdp.mjs 360 640 tools/rev/ver-toastq-9474.js
const CASES = [
  // [etiqueta, escuela, despertares previos, elemento, sala]
  ['1er despertar sala 5 (jefe) Fuego->Hielo', 'fire', [], 'ice', 5],
  ['1er despertar sala 5 (jefe) Fuego->Rayo', 'fire', [], 'bolt', 5],
  ['2o despertar sala 16 Eclipse (pacto)', 'fire', ['fire', 'pact'], 'ice', 16],
];
for (const [label, school, pre, el, room] of CASES) {
  await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { anima: 1 } }))`);
  await send('Page.reload', {}); await sleep(1500);
  await ev('__arcano.flags.freeze = true');
  await ev('__arcano.seed(2)');
  await ev('__arcano.grim(true)');
  await ev(`__arcano.school('${school}')`);
  for (const x of pre) await ev(x === 'pact' ? '__arcano.pact()' : `__arcano.awaken('${x}')`);
  await ev(`__arcano.goto(${room})`); await ev('__arcano.god(true)');
  await ev('__arcano.step(9)'); // entrada (jefe) + aviso de trampa ya caducado
  console.log(label);
  console.log('  antes de limpiar:', JSON.stringify(await ev('__arcano.toasts()')));
  await ev('__arcano.clear()'); await ev('__arcano.step(1.2)');
  const pre0 = await ev('__arcano.toasts()');
  console.log('  justo antes del despertar:', JSON.stringify(pre0), 'aff=', JSON.stringify((await ev('__arcano.formInfo()')).aff), 'state=', await ev('__arcano.state'));
  const seen = [];
  const snap = async () => { const t = await ev('__arcano.toasts()'); const cur = t[0] && !t[0].startsWith('BANNER') && !t[0].startsWith('NEXT') ? t[0] : null; if (cur && seen[seen.length - 1] !== cur) seen.push(cur); return t; };
  await snap();
  await ev(`__arcano.awaken('${el}', true)`);
  for (let i = 0; i < 250; i++) { await ev('__arcano.step(0.1)'); const t = await snap(); if (i === 14) console.log('  t=1.5 cola:', JSON.stringify(t.map(s => s.split(' | ')[0]))); }
  console.log('  vistos en pantalla (en orden):', JSON.stringify(seen.map(s => s.split(' | ')[0])));
  console.log('  tips guardados:', await ev('JSON.stringify(JSON.parse(localStorage.getItem("arcano.settings")).tips)'));
}
