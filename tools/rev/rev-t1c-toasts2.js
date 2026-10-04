// Revisión: 2º despertar que sella la Afinidad y activa la 1ª Mezcla: ¿qué avisos llegan a verse?
await ev('__arcano.flags.freeze = true');
await ev(`__arcano.school('fire')`); await ev('__arcano.god(true)');
await ev(`localStorage.setItem('arcano.settings', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('arcano.settings') || '{}'), { tips: { anima: 1 } })))`);
await ev(`__arcano.give('crit')`);
await ev(`__arcano.awaken('fire')`); // 1er despertar (sin cinemática)
for (let i = 0; i < 80; i++) await ev('__arcano.step(0.1)'); // se leen los avisos que hubiera
console.log('pendientes antes:', JSON.stringify(await ev('__arcano.toasts()')), 'aff', JSON.stringify((await ev('__arcano.formInfo()')).aff));
await ev('__arcano.anima(160)'); await ev('__arcano.clear()');
let ok = false;
for (let i = 0; i < 60; i++) {
  const s = await ev('__arcano.state');
  if (s === 'levelup' && await ev(`!!document.querySelector('[data-act="later"]')`)) { ok = true; break; }
  if (s === 'levelup') await ev('__arcano.pick(0)'); else await ev('__arcano.step(0.1)');
}
console.log('panel', ok, (await ev(`document.getElementById('overlay').innerText`)).replace(/\n+/g, ' / ').slice(0, 300));
const idx = await ev(`[...document.querySelectorAll('[data-act="pick"]')].findIndex(c => c.dataset.id === 'awk:bolt')`);
await ev(`__arcano.pick(${idx})`);
const seen = new Set(), heads = new Set(), log = [];
for (let i = 0; i < 250; i++) {
  const s0 = await ev('__arcano.step(0.1)');
  if (s0 !== 'play') { await ev('__arcano.pick(0)'); }
  const t = await ev('__arcano.toasts()');
  for (const x of t) if (!seen.has(x)) { seen.add(x); log.push((i / 10).toFixed(1) + 's en cola: ' + x); }
  if (t[0] && !t[0].startsWith('BANNER') && !heads.has(t[0])) { heads.add(t[0]); log.push((i / 10).toFixed(1) + 's SE VE: ' + t[0]); }
}
console.log(log.join('\n'));
console.log('NUNCA SE VEN:', JSON.stringify([...seen].filter(x => !heads.has(x) && !x.startsWith('BANNER') && !x.startsWith('NEXT'))));
console.log('tips', await ev('localStorage.getItem("arcano.settings")'));
