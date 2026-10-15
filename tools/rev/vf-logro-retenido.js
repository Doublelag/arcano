// Verificación final: un logro retenido por el despertar no se queda retenido para siempre
//  A) retenido (sala limpia, Ánima lista) y el jugador abandona la partida antes del panel → debe salir en la pantalla final
//  B) retenido y el jugador cruza la puerta antes del panel → sale en la sala siguiente
//  C) retenido con el panel abierto y "Aún no" → sale al cerrar
//  D) desbloqueado durante la cinemática → sale cuando acaba el rótulo de la forma (no antes)
// Tiempo real (setTimeout). Uso: CDP_PORT=9485 node tools/cdp.mjs 360 640 tools/rev/vf-logro-retenido.js
let fails = 0;
const check = (ok, msg, x) => { if (!ok) fails++; console.log((ok ? '  ok   ' : '  FALLO ') + msg + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
const ach = () => ev(`(() => { const a = document.getElementById('achToast'); return { st: __arcano.state, cls: a.className, txt: a.textContent.slice(0, 40), ui: __arcano.ui() }; })()`);
const reset = async () => {
  await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
  await ev(`localStorage.removeItem('arcano.meta')`);
  await send('Page.reload', { ignoreCache: true }); await sleep(1500);
  await ev('__arcano.flags.freeze = true'); await ev('__arcano.seed(3)'); await ev('__arcano.grim(true)');
  await ev(`__arcano.school('fire')`); await ev('__arcano.goto(7)'); await ev('__arcano.god(true)'); await ev('__arcano.step(1.2)');
  await ev('__arcano.clear()'); await ev('__arcano.step(0.2)'); await ev('__arcano.anima(1e6)'); await ev('__arcano.step(0.1)'); // limpia + lista: awakenDue
};
const waitShow = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const a = await ach(); if (a.cls.includes('show')) return a; await sleep(40); } return null; };

console.log('A) retenido y abandonar la partida');
await reset();
await ev(`__arcano.achPop('firstUlt')`); await sleep(100);
let a = await ach(); console.log('  tras achPop:', JSON.stringify(a));
check(!a.cls.includes('show'), 'retenido (sala limpia con despertar a punto)');
await ev(`document.getElementById('btnPause').click()`); await sleep(300);
await ev(`document.querySelector('[data-act="quit"]').click()`); await sleep(500); await ev(`document.querySelector('[data-act="quit"]').click()`); await sleep(300);
a = await waitShow(2000); console.log('  tras abandonar:', JSON.stringify(a));
check(a && a.st === 'over', 'sale en la pantalla final', a && a.cls);

console.log('B) retenido y cruzar la puerta antes del panel');
await reset();
await ev(`__arcano.achPop('firstUlt')`); await sleep(100);
check(!(await ach()).cls.includes('show'), 'retenido');
await ev('__arcano.toDoor()'); await ev('__arcano.step(0.1)'); await ev('__arcano.flags.freeze = false');
a = await waitShow(3000); console.log('  tras cruzar:', JSON.stringify(a), 'sala', await ev('__arcano.room'));
check(a && a.st === 'play' && (await ev('__arcano.room')) === 8, 'sale en la sala siguiente');
await ev('__arcano.flags.freeze = true');

console.log('C) retenido con el panel abierto y "Aún no"');
await reset();
await ev(`__arcano.achPop('firstUlt')`); await ev('__arcano.step(1)'); await sleep(100);
a = await ach(); console.log('  con el panel:', JSON.stringify(a));
check(a.st === 'levelup' && !a.cls.includes('show'), 'panel abierto, logro retenido');
await ev('__arcano.later()');
a = await waitShow(1500); console.log('  tras Aún no:', JSON.stringify(a));
check(a && a.st === 'play', 'sale al cerrar el panel');

console.log('D) desbloqueado durante la cinemática: espera al rótulo de la forma');
await reset();
await ev('__arcano.flags.freeze = false'); await ev(`__arcano.awaken('fire', true)`); await sleep(300);
await ev(`__arcano.achPop('firstUlt')`); await sleep(100);
a = await ach(); console.log('  en la cinemática:', JSON.stringify(a));
check(!a.cls.includes('show') && a.ui && !a.ui.banner, 'retenido durante la transformación');
const t0 = Date.now(); a = await waitShow(6000);
console.log('  sale a los', Date.now() - t0, 'ms:', JSON.stringify(a));
check(a && !a.ui.banner, 'sale cuando ya no está el rótulo ÍGNEA');
console.log(fails ? `FALLOS: ${fails}` : 'TODO OK');
