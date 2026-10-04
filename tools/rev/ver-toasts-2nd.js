// Verificación: 2º despertar en Rayo (Piromante con Concentración), sin aviso DESPERTAR en pantalla
await ev('__arcano.flags.freeze = true');
await ev(`__arcano.school('fire')`); await ev('__arcano.god(true)');
await ev('__arcano.anima(55)'); // aviso DESPERTAR (se marca tips.anima en memoria)
for (let i = 0; i < 60; i++) await ev('__arcano.step(0.1)');
await ev(`__arcano.give('crit')`);
await ev(`__arcano.awaken('fire')`); // 1er despertar sin cinemática
for (let i = 0; i < 100; i++) await ev('__arcano.step(0.1)');
console.log('pendientes antes:', JSON.stringify(await ev('__arcano.toasts()')), 'aff', JSON.stringify((await ev('__arcano.formInfo()')).aff), 'mixes', JSON.stringify((await ev('__arcano.formInfo()')).mixes));
await ev('__arcano.anima(160)'); await ev('__arcano.clear()');
let ok = false;
for (let i = 0; i < 60; i++) {
  const s = await ev('__arcano.state');
  if (s === 'levelup' && await ev(`!!document.querySelector('[data-act="later"]')`)) { ok = true; break; }
  if (s === 'levelup') await ev('__arcano.pick(0)'); else await ev('__arcano.step(0.1)');
}
console.log('panel', ok, 'pendientes:', JSON.stringify(await ev('__arcano.toasts()')));
// envolvemos pushToast desde fuera no se puede: registramos lo encolado muestreando cada paso de 0,05 s
const idx = await ev(`[...document.querySelectorAll('[data-act="pick"]')].findIndex(c => c.dataset.id === 'awk:bolt')`);
await ev(`__arcano.pick(${idx})`);
const seen = new Set(), heads = new Set(), log = [];
for (let i = 0; i < 400; i++) {
  const s0 = await ev('__arcano.step(0.05)');
  if (s0 !== 'play') { await ev('__arcano.pick(0)'); }
  const t = await ev('__arcano.toasts()');
  for (const x of t) if (!seen.has(x)) { seen.add(x); log.push((i / 20).toFixed(2) + 's en cola: ' + x); }
  if (t[0] && !t[0].startsWith('BANNER') && !heads.has(t[0])) { heads.add(t[0]); log.push((i / 20).toFixed(2) + 's SE VE: ' + t[0]); }
}
console.log(log.join('\n'));
console.log('NUNCA SE VEN:', JSON.stringify([...seen].filter(x => !heads.has(x) && !x.startsWith('BANNER') && !x.startsWith('NEXT'))));
console.log('tips', JSON.stringify(JSON.parse(await ev('localStorage.getItem("arcano.settings")')).tips));
