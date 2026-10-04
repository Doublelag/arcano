// Revisión: avisos únicos (tips) que se pierden por el tope de la cola en el 1er despertar
await ev('__arcano.flags.freeze = true');
console.log('estado', await ev('__arcano.state'));
await ev(`__arcano.school('fire')`); await ev('__arcano.god(true)');
console.log('tips antes', JSON.stringify(await ev('JSON.parse(localStorage.getItem("arcano.settings")||"{}").tips')));
await ev('__arcano.anima(100)');
await ev('__arcano.clear()');
// hasta panel
let ok = false;
for (let i = 0; i < 60; i++) {
  const s = await ev('__arcano.state');
  if (s === 'levelup' && await ev(`!!document.querySelector('[data-act="later"]')`)) { ok = true; break; }
  if (s === 'levelup') await ev('__arcano.pick(0)'); else await ev('__arcano.step(0.1)');
}
console.log('panel', ok);
const idx = await ev(`[...document.querySelectorAll('[data-act="pick"]')].findIndex(c => c.dataset.id === 'awk:ice')`);
await ev(`__arcano.pick(${idx})`);
const seen = new Set(), heads = new Set();
const shown = [];
for (let i = 0; i < 200; i++) {
  await ev('__arcano.step(0.1)');
  const t = await ev('(() => { const a = __arcano.toasts(); return a; })()');
  for (const x of t) if (!seen.has(x)) { seen.add(x); shown.push((i / 10).toFixed(1) + 's queued ' + x); }
  if (t[0] && !t[0].startsWith('BANNER') && !heads.has(t[0])) { heads.add(t[0]); shown.push((i / 10).toFixed(1) + 's SHOWN ' + t[0]); }
}
console.log(shown.join('\n'));
console.log('nunca mostrados:', [...seen].filter(x => !heads.has(x) && !x.startsWith('BANNER') && !x.startsWith('NEXT')));
// el aviso que de verdad se mostró es el primero de la lista; registramos solo la cabeza en cada paso
console.log('tips despues', JSON.stringify(await ev('JSON.parse(localStorage.getItem("arcano.settings")||"{}").tips')));
