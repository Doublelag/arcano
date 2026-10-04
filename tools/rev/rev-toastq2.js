// Avisos: ¿se pierde alguno en la cola (tope 3) al despertar? Jugador nuevo (sin tips vistos).
// Uso: CDP_PORT=9454 node tools/cdp.mjs 360 640 tools/rev/rev-toastq.js
const CASES = [
  ['eclipse 2º despertar (sella opuestos)', 'fire', ['fire', 'pact'], 'ice', 13],
  ['1er despertar sala 6 (sella opuestos, Corona)', 'fire', [], 'ice', 6], ['1er despertar sala 6 (sella vecinos)', 'fire', [], 'bolt', 6],
];
for (const [label, school, pre, el, room] of CASES) {
  await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true }))`);
  await send('Page.reload', {}); await sleep(1500);
  await ev('__arcano.flags.freeze = true');
  await ev('__arcano.seed(2)');
  await ev(`__arcano.school('${school}')`);
  for (const x of pre) await ev(x === 'pact' ? '__arcano.pact()' : `__arcano.awaken('${x}')`);
  await ev(`__arcano.goto(${room})`); await ev('__arcano.god(true)');
  await ev('__arcano.step(1.5)'); await ev('__arcano.clear()'); await ev('__arcano.step(0.5)');
  const seen = new Set(), pushed = new Set();
  const snap = async () => { const t = await ev('__arcano.toasts()'); t.forEach(x => { if (!x.startsWith('BANNER') && !x.startsWith('NEXT')) pushed.add(x); }); if (t[0] && !t[0].startsWith('BANNER')) seen.add(t[0]); return t; };
  await snap();
  await ev(`__arcano.awaken('${el}', true)`);
  console.log(label, '· al empezar:', JSON.stringify(await snap()));
  for (let i = 0; i < 200; i++) { await ev('__arcano.step(0.1)'); const t = await snap(); if (i === 9) console.log('  t≈1.0 cola:', JSON.stringify(t)); if (i === 14) console.log('  t≈1.5 cola:', JSON.stringify(t)); }
  console.log('  vistos en pantalla:', JSON.stringify([...seen]));
  console.log('  ¿tips guardados?', await ev('JSON.stringify(JSON.parse(localStorage.getItem("arcano.settings")).tips)'));
}
