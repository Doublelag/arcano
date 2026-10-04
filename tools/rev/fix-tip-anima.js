// El consejo de primera vez "DESPERTAR · El anillo del definitivo se llena…" no debe seguir en pantalla cuando el despertar
// ya está listo ni durante la cinemática de la transformación. Perfil nuevo (sin consejos vistos).
// Uso: CDP_PORT=9461 node tools/cdp.mjs 360 640 tools/rev/fix-tip-anima.js   (CDP_URL=... para comparar con otra copia)
const isTip = s => s.startsWith('DESPERTAR |');
const reset = async () => {
  await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: {} }))`);
  await ev(`localStorage.removeItem('arcano.meta')`);
  await send('Page.reload', { ignoreCache: true }); await sleep(1500);
  await ev('__arcano.flags.freeze = true'); await ev('__arcano.seed(3)');
};
const tipsNow = async () => JSON.stringify(JSON.parse(await ev(`localStorage.getItem('arcano.settings')`)).tips || {});
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ok   ' : '  FALLO ') + msg); };

// A) Jefe 1 (Gólem): la red (a) llena el Ánima de golpe tras el 50 %. Panel, carta y cinemática
console.log('A) Gólem: Ánima al 60 % por bajas, la red del jefe la llena y se despierta');
await reset();
await ev(`__arcano.school('fire')`); await ev('__arcano.goto(5)'); await ev('__arcano.god(true)'); await ev('__arcano.step(2.5)');
await ev('__arcano.anima(60)'); await ev('__arcano.step(0.6)'); // el consejo sale y se lee un poco
console.log('  tras el 50 %:', JSON.stringify(await ev('__arcano.toasts()')), 'tips', await tipsNow());
await ev(`(() => { const A = __arcano, i = A.enemies.findIndex(e => e.kind === 'boss'); const e = A.enemies[i]; e.spawnT = 0; e.hp = 1; return A.hit(i, ['fire']); })()`);
let seenReady = false, inCine = [], inPanel = [];
for (let i = 0; i < 400; i++) {
  const st = await ev('__arcano.state');
  const t = (await ev('__arcano.toasts()')).filter(s => !s.startsWith('BANNER') && !s.startsWith('NEXT'));
  const ready = (await ev('__arcano.formInfo()')).ready;
  if (ready && !seenReady) { seenReady = true; console.log('  despertar listo, avisos:', JSON.stringify(t)); }
  if (st === 'levelup') {
    if (await ev(`!!document.querySelector('[data-act="later"]')`)) {
      inPanel = t; console.log('  panel del despertar, avisos:', JSON.stringify(t));
      const k = await ev(`[...document.querySelectorAll('[data-act="pick"]')].findIndex(c => c.dataset.id === 'awk:fire')`);
      await ev(`__arcano.pick(${k})`); break;
    }
    await ev('__arcano.pick(0)'); continue;
  }
  await ev('__arcano.step(0.05)');
}
for (let i = 0; i < 40; i++) {
  await ev('__arcano.step(0.05)');
  if (!(await ev('__arcano.formInfo()')).awakenFx) break;
  inCine.push(...(await ev('__arcano.toasts()')).filter(s => !s.startsWith('BANNER') && !s.startsWith('NEXT')));
}
check(!inPanel.some(isTip), 'el consejo DESPERTAR no está con el panel abierto');
check(!inCine.some(isTip), 'el consejo DESPERTAR no está durante la cinemática');
console.log('  tips al acabar:', await tipsNow());

// B) El consejo se lee entero (más de 1 s) y luego se llena el Ánima: se desvanece y queda visto
console.log('B) consejo leído 1,5 s y luego Ánima llena');
await reset();
await ev(`__arcano.school('fire')`); await ev('__arcano.god(true)');
await ev('__arcano.anima(60)'); await ev('__arcano.step(1.5)');
await ev('__arcano.anima(1e6)');
const b0 = await ev('__arcano.toasts()'); await ev('__arcano.step(0.3)'); const b1 = await ev('__arcano.toasts()');
console.log('  al llenarse:', JSON.stringify(b0), '| 0,3 s después:', JSON.stringify(b1), '| tips', await tipsNow());
check(!b1.some(isTip), 'el consejo se ha ido en 0,3 s');
check(JSON.parse(await tipsNow()).anima === 1, 'queda como visto');

// C) El consejo apenas se ha visto (0,3 s): se va y NO queda como visto (saldrá en el 2º despertar)
console.log('C) consejo visto 0,3 s y Ánima llena');
await reset();
await ev(`__arcano.school('fire')`); await ev('__arcano.god(true)');
await ev('__arcano.anima(60)'); await ev('__arcano.step(0.3)');
await ev('__arcano.anima(1e6)'); await ev('__arcano.step(0.3)');
console.log('  avisos:', JSON.stringify(await ev('__arcano.toasts()')), '| tips', await tipsNow());
check(!(await ev('__arcano.toasts()')).some(isTip), 'el consejo se ha ido');
check(!JSON.parse(await tipsNow()).anima, 'no queda como visto');
await ev(`__arcano.awaken('fire')`); await ev('__arcano.anima(90)'); await ev('__arcano.step(0.1)');
check((await ev('__arcano.toasts()')).some(isTip), 'vuelve a salir al 50 % del 2º despertar');

// D) Se llena de golpe desde menos del 50 %: el consejo ni sale (sobraría), y no se da por visto
console.log('D) de 0 a lleno de golpe');
await reset();
await ev(`__arcano.school('fire')`); await ev('__arcano.god(true)');
await ev('__arcano.anima(1e6)'); await ev('__arcano.step(0.1)');
check(!(await ev('__arcano.toasts()')).some(isTip) && !JSON.parse(await tipsNow()).anima, 'no sale ni se marca');

// E) Despertar sin panel (depuración) con el consejo en pantalla: fuera en cuanto empieza la cinemática
console.log('E) cinemática con el consejo en pantalla');
await reset();
await ev(`__arcano.school('fire')`); await ev('__arcano.god(true)');
await ev('__arcano.anima(60)'); await ev('__arcano.step(1.2)');
await ev(`__arcano.awaken('ice', true)`); await ev('__arcano.step(0.05)');
check(!(await ev('__arcano.toasts()')).some(isTip), 'el consejo no sigue durante la cinemática');
console.log(fails ? `FALLOS: ${fails}` : 'TODO OK');
