// Verificación final (14): el aviso que sale "bajo el rótulo" (mago junto a la puerta) no se queda en medio de la pantalla
// al cruzar a la sala siguiente, en pleno combate. Captura en la sala nueva con el aviso aún vivo.
// Uso: SHOTS=dir CDP_PORT=9486 node tools/cdp.mjs 360 640 tools/rev/vf-toast-sala.js
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'E:/PROYECTOS/arcano/tools/out/ver';
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const check = (ok, msg, x) => { if (!ok) fails++; console.log((ok ? '  ok   ' : '  FALLO ') + msg + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
await send('Page.reload', {}); await sleep(1500);
await ev('__arcano.flags.freeze = true'); await ev('__arcano.grim(true)'); await ev('__arcano.seed(4)');
await ev(`__arcano.school('fire')`); await ev(`__arcano.awaken('fire')`); await ev('__arcano.step(6)');
await ev('__arcano.goto(7)'); await ev('__arcano.god(true)'); await ev('__arcano.step(0.5)'); await ev('__arcano.clear()'); await ev('__arcano.step(0.3)');
await ev('(() => { const p = __arcano.player; p.x = 270; p.y = 128 + 60; })()'); // junto a la puerta
await ev(`__arcano.awaken('bolt', true)`); await ev('__arcano.step(1.45)');
// hasta que el aviso en pantalla sea uno de la ráfaga (el de trampa anterior se decidió con el mago abajo)
for (let i = 0; i < 60 && !/^(AFINIDAD|NUEVO DEFINITIVO|¡NUEVA FORMA)/.test((await ev('__arcano.toasts()'))[0] || ''); i++) { if ((await ev('__arcano.step(0.1)')) === 'levelup') await ev('__arcano.pick(0)'); }
let u = await ev('__arcano.ui()');
console.log('  tras la cinemática:', JSON.stringify(u), JSON.stringify(await ev('__arcano.toasts()')));
check(u.toastLow === true, 'el aviso sale bajo el rótulo (toastLow) con el mago arriba');
await ev('__arcano.toDoor()');
for (let i = 0; i < 40 && (await ev('__arcano.room')) !== 8; i++) { if ((await ev('__arcano.step(0.1)')) === 'levelup') { await ev('__arcano.pick(0)'); await ev('__arcano.toDoor()'); } }
await ev('__arcano.step(0.2)');
u = await ev('__arcano.ui()');
console.log('  en la sala', await ev('__arcano.room'), 'estado', await ev('__arcano.state'), 'ui', JSON.stringify(u), JSON.stringify(await ev('__arcano.toasts()')));
const r = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(`${OUT}/vf-toast-sala8.png`, Buffer.from(r.result.data, 'base64'));
check(u.toastLow !== true, 'en la sala nueva el aviso vuelve arriba (no tapa el combate)', u.toastLow);
console.log(fails ? `FALLOS: ${fails}` : 'TODO OK');
