// Sin forms.js la interfaz queda como antes: menú sin Grimorio (Logros | Ajustes), sin filas de formas en Logros,
// pausa sin línea de forma, final sin emblema. Y sin errores en consola.
// Uso: CDP_PORT=9434 node tools/cdp.mjs 360 640 tools/grimorio-sinforms.js
await send('Network.enable');
await send('Network.setBlockedURLs', { urls: ['*forms.js*'] });
await send('Page.reload', { ignoreCache: true });
await sleep(1800);
let fails = 0;
const ok = (c, msg, x) => { console.log((c ? 'OK   ' : 'FAIL ') + msg + (x !== undefined ? '  ' + JSON.stringify(x) : '')); if (!c) fails++; };
const txt = () => ev(`document.getElementById('overlay').innerText`);
const click = sel => ev(`(() => { const e = document.querySelector('${sel}'); if (!e) return false; e.click(); return true; })()`);
ok(await ev('typeof window.ArcanoForms') === 'undefined', 'forms.js bloqueado');
ok(!(await ev(`!!document.querySelector('[data-act="grimoire"]')`)), 'menú sin botón de Grimorio');
ok(await ev(`(() => { const a = document.querySelector('[data-act="stats"]'), b = document.querySelector('[data-act="settings"]'); return a.parentElement === b.parentElement; })()`), 'Logros | Ajustes en la misma fila, como antes');
await click('[data-act="stats"]'); await sleep(450);
ok(!/Formas|Despertar medio/.test(await txt()), 'Logros sin filas del Grimorio');
await click('[data-act="back"]'); await sleep(450);
await ev(`__arcano.school('fire')`);
await ev(`__arcano.step(0.5)`);
await ev(`document.getElementById('btnPause').click()`); await sleep(200);
let t = await txt();
ok(/PAUSA/.test(t) && !/Forma:|Aprendiz ·|Cerrada esta partida/.test(t), 'pausa sin línea de forma ni reacciones cerradas');
await click('[data-act="quit"]'); await sleep(450); await click('[data-act="quit"]'); await sleep(300);
t = await txt();
ok(/PARTIDA TERMINADA/.test(t) && !/como|Te faltan|Grimorio/.test(t), 'final sin emblema ni Grimorio');
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
