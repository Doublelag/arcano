// Prueba rápida: el juego arranca en ?debug, se puede empezar una partida y avanzar unas salas sin errores
// Uso: node tools/cdp.mjs 360 640 tools/smoke.js
console.log('estado inicial', await ev('__arcano.state'));
await ev(`document.querySelector('[data-act="play"]').click()`);
await sleep(500);
console.log('tras jugar', await ev('__arcano.state'));
await ev('__arcano.pick(0)');
await sleep(200);
console.log('partida', await ev('__arcano.state'), 'sala', await ev('__arcano.room'));
await ev('__arcano.god(true)');
for (let i = 0; i < 40; i++) {
  const st = await ev('__arcano.state');
  if (st === 'levelup' || st === 'altar') await ev('__arcano.pick(0)');
  else if (st === 'play') {
    await ev(`(() => { const A = __arcano; A.player.hp = A.player.maxHp; if (!A.enemies.some(e => !e.dead)) A.toDoor(); return A.step(1); })()`);
  } else if (st === 'transition') await ev('__arcano.step(1)');
  else break;
}
console.log('final', await ev('__arcano.state'), 'sala', await ev('__arcano.room'), 'nivel', await ev('__arcano.player && __arcano.player.lvl'));
