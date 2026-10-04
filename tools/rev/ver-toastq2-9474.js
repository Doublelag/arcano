// Verificación 2: casos sin aviso previo y con aviso de trampa en pantalla. Compara original vs arreglo (CDP_URL)
const CASES = [
  // [etiqueta, escuela, despertares previos, elemento, sala, segundos en sala antes de limpiar]
  ['1er desp. sala 5 Fuego->Hielo, sin previo', 'fire', [], 'ice', 5, 9],
  ['1er desp. sala 6 Fuego->Hielo, con trampa en pantalla', 'fire', [], 'ice', 6, 1.5],
  ['1er desp. sala 6 Fuego->Rayo, con trampa en pantalla', 'fire', [], 'bolt', 6, 1.5],
  ['2o desp. sala 16 Eclipse, sin previo', 'fire', ['fire', 'pact'], 'ice', 16, 9],
];
for (const [label, school, pre, el, room, wait] of CASES) {
  await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { anima: 1 } }))`);
  await send('Page.reload', {}); await sleep(1500);
  await ev('__arcano.flags.freeze = true');
  await ev('__arcano.seed(2)');
  await ev('__arcano.grim(true)');
  await ev(`__arcano.school('${school}')`);
  for (const x of pre) await ev(x === 'pact' ? '__arcano.pact()' : `__arcano.awaken('${x}')`);
  await ev(`__arcano.goto(${room})`); await ev('__arcano.god(true)');
  await ev(`__arcano.step(${wait})`);
  await ev('__arcano.clear()'); await ev('__arcano.step(0.5)');
  const pre0 = (await ev('__arcano.toasts()')).map(s => s.split(' | ')[0]);
  const seen = [];
  const snap = async () => { const t = await ev('__arcano.toasts()'); const cur = t[0] && !t[0].startsWith('BANNER') && !t[0].startsWith('NEXT') ? t[0] : null; if (cur && seen[seen.length - 1] !== cur) seen.push(cur); return t; };
  await snap();
  await ev(`__arcano.awaken('${el}', true)`);
  for (let i = 0; i < 300; i++) { await ev('__arcano.step(0.1)'); await snap(); }
  console.log(label, '| previo:', JSON.stringify(pre0));
  console.log('   vistos:', JSON.stringify(seen.map(s => s.split(' | ')[0])), '| tips:', await ev('JSON.stringify(JSON.parse(localStorage.getItem("arcano.settings")).tips)'));
}
