// Verificación final (6/14): un logro que el panel del despertar corta antes de 1,5 s vuelve a salir después.
// ¿Cuántas veces aparece (= cuántas veces suena)? Tiempo REAL (los logros van con setTimeout).
// Uso: CDP_PORT=9484 node tools/cdp.mjs 360 640 tools/rev/vf-logro-doble.js
let fails = 0;
const check = (ok, msg, x) => { if (!ok) fails++; console.log((ok ? '  ok   ' : '  FALLO ') + msg + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
await ev(`localStorage.removeItem('arcano.meta')`);
await send('Page.reload', { ignoreCache: true }); await sleep(1500);
await ev('__arcano.flags.freeze = true'); await ev('__arcano.seed(3)'); await ev('__arcano.grim(true)');
await ev(`__arcano.school('fire')`); await ev('__arcano.goto(7)'); await ev('__arcano.god(true)'); await ev('__arcano.step(1.2)');
await ev('__arcano.anima(1e6)'); // listo, pero la sala no está limpia: el logro no se retiene
// el logro sale ahora; 0,3 s después se limpia la sala y el panel llega a los 0,8 s: el logro lleva ~1,1 s (< 1,5) y vuelve después
await ev(`__arcano.achPop('firstUlt')`);
await sleep(300);
await ev('__arcano.clear()'); await ev('__arcano.flags.freeze = false'); // tiempo real desde aquí
const t0 = Date.now(), log = [];
let shows = 0, lastCls = '', panelAt = null, picked = false, ui0 = null;
for (let i = 0; i < 240; i++) {
  const s = await ev(`(() => { const a = document.getElementById('achToast'); return { st: __arcano.state, awk: !!document.querySelector('[data-act="later"]'), cls: a.className, txt: a.textContent.slice(0, 30), ui: __arcano.ui() }; })()`);
  const key = s.st + '|' + s.awk + '|' + s.cls;
  if (key !== lastCls) { log.push(`${Date.now() - t0} ms ${JSON.stringify(s)}`); if (s.cls.includes('show') && !lastCls.includes('show') && /Primer co/.test(s.txt)) shows++; lastCls = key; }
  if (s.awk && !picked) {
    panelAt = Date.now() - t0; ui0 = s;
    await sleep(400);
    const k = await ev(`[...document.querySelectorAll('[data-act="pick"]')].findIndex(c => c.dataset.id === 'awk:fire')`);
    await ev(`__arcano.pick(${k})`); picked = true;
  }
  if (picked && Date.now() - t0 > 9000) break;
  await sleep(40);
}
console.log(log.join('\n'));
check(panelAt !== null, 'el panel del despertar se abre', panelAt);
check(ui0 && !ui0.cls.includes('show'), 'con el panel abierto el logro no está en pantalla', ui0 && ui0.cls);
check(shows === 2, 'el logro cortado vuelve a salir una vez después (2 apariciones)', shows);
const again = log.filter(l => /"achAgain":true/.test(l)).length, uiEnd = await ev('__arcano.ui()');
check(again > 0 && !uiEnd.achAgain, 'la segunda aparición va marcada (sin sonido) y la marca se consume', { again, achAgain: uiEnd.achAgain });
console.log('  ui al final:', JSON.stringify(uiEnd));
console.log(fails ? `FALLOS: ${fails}` : 'TODO OK');
