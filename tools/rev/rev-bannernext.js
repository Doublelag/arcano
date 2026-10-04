// ¿El rótulo ECLIPSE (bannerNext) salta a la sala siguiente si cruzas la puerta durante "LA FORMA PROHIBIDA"?
// Uso: SHOTS=dir CDP_PORT=9454 node tools/cdp.mjs 360 640 tools/rev/rev-bannernext.js
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'E:/PROYECTOS/arcano/tools/out/rev';
fs.mkdirSync(OUT, { recursive: true });
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
await send('Page.reload', {}); await sleep(1500);
await ev('__arcano.flags.freeze = true');
await ev('__arcano.grim(true)');
await ev('__arcano.seed(6)'); await ev(`__arcano.school('fire')`); await ev(`__arcano.awaken('fire')`); await ev('__arcano.pact()');
await ev('__arcano.goto(12)'); await ev('__arcano.god(true)'); await ev('__arcano.step(1)'); await ev('__arcano.clear()'); await ev('__arcano.step(0.5)');
await ev('(() => { const p = __arcano.player; p.x = 270; p.y = 128 + 40; })()'); // junto a la puerta
await ev(`__arcano.awaken('ice', true)`);
await ev('__arcano.step(1.45)');
console.log('tras la cinemática', JSON.stringify(await ev('({ ui: __arcano.ui(), t: __arcano.toasts(), room: __arcano.room })')));
await ev('__arcano.toDoor()');
for (let i = 0; i < 40; i++) {
  await ev('__arcano.step(0.1)');
  const s = await ev('({ room: __arcano.room, state: __arcano.state, banner: __arcano.ui().banner && __arcano.ui().banner.text, enemies: __arcano.enemies.filter(e => !e.dead).length })');
  if (i % 3 === 0) console.log(i / 10, JSON.stringify(s));
  if (s.banner === 'ECLIPSE' && s.room === 13) { await ev('__arcano.step(0.5)'); console.log('eclipseFx', JSON.stringify(await ev('__arcano.ambient()'))); const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/bannernext.png`, Buffer.from(r.result.data, 'base64')); console.log('captura', JSON.stringify(s)); break; }
}
