// Fase 2: tiempo de update() y render() en la sala 18 con las 5 formas combinadas (con y sin su definitivo), CPU normal y 4× más lenta
// Uso: CDP_PORT=9435 node tools/cdp.mjs 360 640 tools/fase2-perf.js
const P = code => ev(`(() => { const A = __arcano, E = A.enemies, P = A.player; ${code} })()`);
const BUILD = `for (const [k, n] of Object.entries({ atk: 3, atkspd: 2, front: 1, multi: 1, crit: 1, hp: 2 })) for (let i = 0; i < n; i++) A.give(k);`;
await ev('__arcano.flags.freeze = true');
for (const rate of [1, 4]) {
  await send('Emulation.setCPUThrottlingRate', { rate });
  for (const [s, path, cards] of [['fire', ['fire', 'bolt'], ['bolt', 'orbs', 'orbs', 'pierce']], ['bolt', ['bolt', 'ice'], ['ice', 'wall', 'ricochet', 'diag']], ['ice', ['ice', 'poison'], ['poison']], ['poison', ['poison', 'fire'], ['fire']], ['fire', ['pact', 'fire', 'ice'], ['ice']]]) {
    await ev('__arcano.seed(4)');
    await ev(`__arcano.school('${s}')`);
    await P(`${BUILD} ${cards.map(c => `A.give('${c}');`).join(' ')} return 1;`);
    for (const el of path) await ev(el === 'pact' ? '__arcano.pact()' : `__arcano.awaken('${el}')`);
    await ev('__arcano.goto(18)'); await ev('__arcano.god(true)');
    await P(`E.forEach(e => { e.spawnT = 0; e.hp = e.maxHp = 1e5; }); return 1;`);
    await ev('__arcano.step(1)');
    const a = await P(`return A.perf(600);`);
    const b = await P(`P.mana = 100; A.ult(); return A.perf(150);`);
    console.log(`CPU ×${rate} ${s}/${path.join('+')}: combate ${JSON.stringify(a)} · con definitivo ${JSON.stringify(b)}`);
  }
}
await send('Emulation.setCPUThrottlingRate', { rate: 1 });
