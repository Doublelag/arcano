// Coste (7.5): update() y render() en la sala 18 con las formas más pesadas (con y sin su definitivo), calidad alta y baja,
// CPU normal y 4× más lenta; máximos de disparos y partículas; tamaño de las cachés de brillos tras recorrer las 10 formas.
// Uso: CDP_PORT=9437 node tools/cdp.mjs 360 640 tools/balance-coste.js
const P = code => ev(`(() => { const A = __arcano, E = A.enemies, P = A.player; ${code} })()`);
const BUILD = `for (const [k, n] of Object.entries({ atk: 3, atkspd: 2, front: 1, multi: 1, crit: 1, hp: 2 })) for (let i = 0; i < n; i++) A.give(k);`;
// las Mezclas más cargadas: Glaciar + Granizo + Aguijón (Aurora), Halo + Anillo + Cometa (Plasma)
const CFG = [['fire', ['fire', 'bolt'], ['bolt', 'orbs', 'orbs', 'pierce']], ['bolt', ['bolt', 'ice'], ['ice', 'wall', 'ricochet', 'diag']], ['ice', ['ice', 'poison'], ['poison', 'ricochet']],
  ['poison', ['poison', 'fire'], ['fire', 'diag']], ['fire', ['pact', 'fire', 'ice'], ['ice', 'pierce']]];
await ev('__arcano.flags.freeze = true');
const rows = [];
for (const q of ['alta', 'baja']) {
  // la calidad se lee de los ajustes guardados: se cambia y se recarga la página
  await ev(`localStorage.setItem('arcano.settings', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('arcano.settings') || '{}'), { quality: '${q}' })))`);
  await send('Page.reload'); await sleep(1500);
  await ev('__arcano.flags.freeze = true');
  for (const rate of [1, 4]) {
    await send('Emulation.setCPUThrottlingRate', { rate });
    for (const [s, path, cards] of CFG) {
      await ev('__arcano.seed(4)');
      await ev(`__arcano.school('${s}')`);
      await P(`${BUILD} ${cards.map(c => `A.give('${c}');`).join(' ')} return 1;`);
      for (const el of path) await ev(el === 'pact' ? '__arcano.pact()' : `__arcano.awaken('${el}')`);
      await ev('__arcano.goto(18)'); await ev('__arcano.god(true)');
      await P(`E.forEach(e => { e.spawnT = 0; e.hp = e.maxHp = 1e5; }); return 1;`);
      await ev('__arcano.step(1)');
      const run = async (n, ult) => {
        let u = 0, r = 0, um = 0, ms = 0, mp = 0, k = 0;
        if (ult) await P(`P.mana = 100; A.ult(); return 1;`);
        for (let i = 0; i < n / 50; i++) { const x = await P(`return A.perf(50);`); u += x.update * x.steps; r += x.render * x.steps; k += x.steps; um = Math.max(um, x.updateMax); ms = Math.max(ms, x.shots); mp = Math.max(mp, x.parts); }
        return { update: +(u / k).toFixed(3), updateMax: um, render: +(r / k).toFixed(3), maxShots: ms, maxParts: mp };
      };
      const a = await run(600, false), b = await run(150, true);
      const form = await P(`return P.form;`);
      rows.push({ q, rate, form, a, b });
      console.log(`calidad ${q} CPU ×${rate} ${form.padEnd(8)} combate: update ${a.update} ms (pico ${a.updateMax}) render ${a.render} ms, shots ${a.maxShots}, parts ${a.maxParts} · con definitivo: update ${b.update} render ${b.render} shots ${b.maxShots} parts ${b.maxParts}`);
    }
  }
}
await send('Emulation.setCPUThrottlingRate', { rate: 1 });
// cachés de brillos: las 10 formas dibujadas (con su definitivo) en la sala 18
await ev(`localStorage.setItem('arcano.settings', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('arcano.settings') || '{}'), { quality: 'alta' })))`);
await send('Page.reload'); await sleep(1500);
await ev('__arcano.flags.freeze = true');
for (const [s, path] of [['fire', []], ['fire', ['fire']], ['ice', ['ice']], ['bolt', ['bolt']], ['poison', ['poison']], ['fire', ['fire', 'bolt']], ['bolt', ['bolt', 'ice']], ['ice', ['ice', 'poison']], ['poison', ['poison', 'fire']], ['fire', ['pact', 'fire', 'ice']]]) {
  await ev(`__arcano.school('${s}')`);
  for (const el of path) await ev(el === 'pact' ? '__arcano.pact()' : `__arcano.awaken('${el}')`);
  await ev('__arcano.goto(18)'); await ev('__arcano.god(true)');
  await P(`P.mana = 100; A.ult(); return 1;`);
  for (let i = 0; i < 6; i++) await ev('__arcano.step(0.25)');
}
console.log('cachés tras las 10 formas:', JSON.stringify(await ev('__arcano.formStats()')));
