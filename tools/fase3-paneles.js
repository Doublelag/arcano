// Fase 3 · capturas de interfaz: panel del despertar (1º y 2º), Grimorio, menú con título, final y estadísticas
// Uso: SHOTS=dir [TAG=-375] CDP_PORT=9436 node tools/cdp.mjs 360 640 tools/fase3-paneles.js
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'shots-fase3', TAG = process.env.TAG || '';
fs.mkdirSync(OUT, { recursive: true });
const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/p-${name}${TAG}.png`, Buffer.from(r.result.data, 'base64')); };
const fits = () => ev(`(() => { const p = document.querySelector('#overlay .panel'); return p ? { sh: p.scrollHeight, ch: p.clientHeight, fits: p.scrollHeight <= p.clientHeight + 1 } : null; })()`);
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
await send('Page.reload', {}); await sleep(1500);
await ev('__arcano.flags.freeze = true');
await ev('(() => { const g = __arcano.grim(true); g.f = 1 | 2 | 32 | 64 | 512; g.e = 2; g.w = 1 | 32; g.n = "1300011001"; g.k = [11, 2, 13, 1]; })()');
// 1º despertar: Piromante con Afinidad de 1 elemento (4 cartas)
await ev(`__arcano.school('fire')`); await ev('__arcano.goto(6)'); await ev('__arcano.clear()'); await ev('__arcano.step(0.5)');
await ev('__arcano.offer()'); await sleep(900); await shot('awaken1');
console.log('awaken1', JSON.stringify(await fits()));
await ev('__arcano.later()');
// 2º despertar: Ígnea con fuego sin pareja (3 opciones, la opuesta bloqueada)
await ev('__arcano.awaken("fire")'); await ev('__arcano.offer()'); await sleep(900); await shot('awaken2');
console.log('awaken2', JSON.stringify(await fits()));
await ev('__arcano.later()');
// pausa y final (abandonar) con forma
await ev('__arcano.awaken("bolt")'); await sleep(3200);
await ev(`document.getElementById('btnPause') ? document.getElementById('btnPause').click() : null`); await sleep(500);
if (await ev('__arcano.state') !== 'paused') await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }))`);
await sleep(400); await shot('pause'); console.log('pause', await ev('__arcano.state'), JSON.stringify(await fits()));
await ev(`document.querySelector('[data-act="quit"]').click()`); await sleep(500);
await ev(`document.querySelector('[data-act="quit"]').click()`); await sleep(800); await shot('end');
console.log('end', await ev('__arcano.state'), JSON.stringify(await fits()));
// victoria (sala 20) en Plasma: Marca II nueva
await ev(`__arcano.school('fire')`); await ev('__arcano.awaken("fire")'); await ev('__arcano.awaken("bolt")'); await ev('__arcano.god(true)');
await ev('__arcano.goto(20)'); await ev('__arcano.step(2)'); await ev('__arcano.clear()');
for (let i = 0; i < 20 && await ev('__arcano.state') === 'play'; i++) await ev('__arcano.step(0.5)');
await sleep(3200); await shot('win'); console.log('win', await ev('__arcano.state'), JSON.stringify(await fits()));
// menú y Grimorio
await ev(`document.querySelector('[data-act="menu"]').click()`); await sleep(500); await shot('menu');
await ev(`document.querySelector('[data-act="grimoire"]').click()`); await sleep(600); await shot('grim');
console.log('grim', JSON.stringify(await fits()));
await ev(`document.querySelector('#overlay .panel').scrollTop = 99999`); await sleep(300); await shot('grim-fin');
