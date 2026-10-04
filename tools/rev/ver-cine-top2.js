// Igual que ver-cine-top.js pero con más capturas (para comprobar el arreglo en una copia: CDP_URL=file:///.../index.html?debug)
// STAGE=2 hace antes un primer despertar (fuego) y mira el segundo (con AFINIDAD y NUEVO DEFINITIVO)
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'E:/PROYECTOS/arcano/tools/out/rev';
fs.mkdirSync(OUT, { recursive: true });
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
await send('Page.reload', {}); await sleep(1500);
await ev('__arcano.flags.freeze = true');
await ev('__arcano.grim(true)');
await ev('__arcano.seed(4)'); await ev(`__arcano.school('fire')`);
await ev('__arcano.goto(7)'); await ev('__arcano.god(true)');
if (process.env.STAGE === '2') {
  await ev(`__arcano.awaken('fire')`); await sleep(3500);
  await ev('__arcano.step(6)');
}
const walk = +(process.env.WALK || 3.6);
await ev(`__arcano.step(${walk}, ['KeyW'])`);
await ev('__arcano.anima(1000)');
await ev('__arcano.clear()');
let st;
for (let i = 0; i < 40; i++) { st = await ev('__arcano.step(0.1)'); if (st !== 'play') break; }
console.log('estado', st, 'pos', await ev('[Math.round(__arcano.player.x), Math.round(__arcano.player.y)]'), 'awak', await ev('__arcano.player.awak'));
if (process.env.EL) { // elegir directamente (como tocar la carta): cierra paneles y arranca la cinemática
  for (let i = 0; i < 5 && (await ev('__arcano.state')) === 'levelup'; i++) await ev('__arcano.pick(0)');
  console.log('awaken', await ev(`__arcano.awaken('${process.env.EL}', true)`));
} else console.log('pick', await ev(`__arcano.pick(${process.env.PICK || 0})`));
let t = 0;
for (const target of [0.95, 1.2, 1.6, 2.4, 3.2, 4.2, 5.0]) {
  while (t < target - 1e-6) { await ev('__arcano.step(0.1)'); await sleep(100); t += 0.1; }
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${OUT}/w-${target}.png`, Buffer.from(r.result.data, 'base64'));
  console.log(target, JSON.stringify(await ev('({ p: [Math.round(__arcano.player.x), Math.round(__arcano.player.y)], form: __arcano.player.form, ui: __arcano.ui(), t: __arcano.toasts() })')));
}
