// Cinemática con el mago cerca de la puerta (arriba de la sala): ¿la tapan el aviso y el logro?
// Uso: SHOTS=dir CDP_PORT=9454 node tools/cdp.mjs 360 640 tools/rev/rev-cine-top.js
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'E:/PROYECTOS/arcano/tools/out/rev';
fs.mkdirSync(OUT, { recursive: true });
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
await send('Page.reload', {}); await sleep(1500);
await ev('__arcano.flags.freeze = true');
await ev('__arcano.grim(true)');
await ev('__arcano.seed(4)'); await ev(`__arcano.school('fire')`);
await ev('__arcano.goto(7)'); await ev('__arcano.god(true)'); await ev('__arcano.step(1)'); await ev('__arcano.clear()'); await ev('__arcano.step(0.3)');
await ev('(() => { const p = __arcano.player; p.x = 270; p.y = 128 + 75; })()');
await ev(`__arcano.awaken('fire', true)`);
let t = 0;
for (const target of [0.5, 0.95, 1.2, 1.6, 2.4]) {
  await ev(`__arcano.step(${(target - t).toFixed(3)})`); t = target;
  await sleep(250); // el logro (DOM) entra con transición
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${OUT}/top-${target}.png`, Buffer.from(r.result.data, 'base64'));
  console.log(target, JSON.stringify(await ev('({ p: [Math.round(__arcano.player.x), Math.round(__arcano.player.y)], ui: __arcano.ui(), t: __arcano.toasts() })')));
}
