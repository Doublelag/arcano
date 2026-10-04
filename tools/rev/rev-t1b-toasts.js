// Revisión: igual que t1 pero con el aviso DESPERTAR (50%) ya leído antes, como en una partida real
await ev('__arcano.flags.freeze = true');
const EL = process.env.EL || 'ice';
await ev(`__arcano.school('fire')`); await ev('__arcano.god(true)');
await ev('__arcano.anima(55)');
for (let i = 0; i < 60; i++) await ev('__arcano.step(0.1)'); // se lee el aviso de DESPERTAR
console.log('avisos pendientes antes:', JSON.stringify(await ev('__arcano.toasts()')));
await ev('__arcano.anima(100)');
await ev('__arcano.clear()');
let ok = false;
for (let i = 0; i < 60; i++) {
  const s = await ev('__arcano.state');
  if (s === 'levelup' && await ev(`!!document.querySelector('[data-act="later"]')`)) { ok = true; break; }
  if (s === 'levelup') await ev('__arcano.pick(0)'); else await ev('__arcano.step(0.1)');
}
console.log('panel', ok, 'sala', await ev('__arcano.room'));
const idx = await ev(`[...document.querySelectorAll('[data-act="pick"]')].findIndex(c => c.dataset.id === 'awk:${EL}')`);
await ev(`__arcano.pick(${idx})`);
const seen = new Set(), heads = new Set();
const shown = [];
for (let i = 0; i < 200; i++) {
  const s0 = await ev('__arcano.step(0.1)');
  if (s0 !== 'play') { shown.push((i / 10).toFixed(1) + 's state=' + s0 + ' ' + (await ev(`document.getElementById('overlay').innerText`)).replace(/\n+/g, ' / ').slice(0, 200)); await ev('__arcano.pick(0)'); }
  const t = await ev('__arcano.toasts()');
  for (const x of t) if (!seen.has(x)) { seen.add(x); shown.push((i / 10).toFixed(1) + 's queued ' + x); }
  if (t[0] && !t[0].startsWith('BANNER') && !heads.has(t[0])) { heads.add(t[0]); shown.push((i / 10).toFixed(1) + 's SHOWN ' + t[0]); }
}
console.log(shown.join('\n'));
console.log('nunca mostrados:', JSON.stringify([...seen].filter(x => !heads.has(x) && !x.startsWith('BANNER') && !x.startsWith('NEXT'))));
console.log('tips', JSON.stringify(await ev('JSON.parse(localStorage.getItem("arcano.settings")||"{}").tips')));
