// Verificación: el Pacto vuelve a anunciar "Abre el camino a Eclipse" con el pacto ya firmado (sin trucar la vida)
const ovl = async () => (await ev(`document.getElementById('overlay').innerText`)).replace(/\n+/g, ' / ');
await ev('__arcano.flags.freeze = true');
await ev(`__arcano.school('fire')`); await ev('__arcano.god(true)');
await ev(`__arcano.give('ice')`);
console.log('aff', JSON.stringify(await ev('__arcano.player.aff')), 'maxHp', await ev('__arcano.player.maxHp'));
// altar de la sala 9: firmar el pacto desde el panel real
await ev('__arcano.goto(9)'); await ev('__arcano.god(true)'); await ev('__arcano.step(0.5)');
await ev('__arcano.player.x = 270; __arcano.player.y = 480'); await ev('__arcano.step(0.1)');
console.log('sala 9:', await ev('__arcano.state'), (await ovl()).slice(0, 400));
await ev(`__arcano.pick([...document.querySelectorAll('[data-act="altar"]')].findIndex(c => c.dataset.id === 'pact'))`);
await ev('__arcano.step(0.2)');
const f1 = await ev('__arcano.formInfo()');
console.log('tras pacto: pactRun', f1.pactRun, 'maxHp', await ev('__arcano.player.maxHp'), 'state', await ev('__arcano.state'));
for (let i = 0; i < 6 && (await ev('__arcano.state')) !== 'play'; i++) {
  const names = await ev(`[...document.querySelectorAll('#overlay .card .nm')].map(n => n.textContent)`);
  const k = Math.max(0, names.findIndex(n => !/Vitalidad/.test(n)));
  await ev(`__arcano.pick(${k})`); await ev('__arcano.step(0.2)');
}
console.log('tras elegir: state', await ev('__arcano.state'), 'maxHp', await ev('__arcano.player.maxHp'));
// altar de la sala 14
await ev('__arcano.goto(14)'); await ev('__arcano.god(true)'); await ev('__arcano.step(0.5)');
await ev('__arcano.player.x = 270; __arcano.player.y = 480'); await ev('__arcano.step(0.1)');
const f2 = await ev('__arcano.formInfo()');
console.log('sala 14: pactRun', f2.pactRun, 'maxHp', await ev('__arcano.player.maxHp'), 'state', await ev('__arcano.state'));
console.log('overlay 14:', (await ovl()).slice(0, 500));
