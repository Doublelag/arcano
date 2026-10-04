// Verificación: flujo real (sin teletransporte tras limpiar). El mago sube andando, la sala se limpia,
// el panel del despertar sale solo, se elige carta y se mira la cinemática en tiempo casi real.
// Uso: SHOTS=dir CDP_PORT=9477 node tools/cdp.mjs 360 640 tools/rev/ver-cine-top.js
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'E:/PROYECTOS/arcano/tools/out/rev';
fs.mkdirSync(OUT, { recursive: true });
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
await send('Page.reload', {}); await sleep(1500);
await ev('__arcano.flags.freeze = true');
await ev('__arcano.grim(true)');
await ev('__arcano.seed(4)'); await ev(`__arcano.school('fire')`);
await ev('__arcano.goto(7)'); await ev('__arcano.god(true)');
console.log('inicio', await ev('[Math.round(__arcano.player.x), Math.round(__arcano.player.y)]'));
// sube andando (dios: no muere) con enemigos vivos
const walk = +(process.env.WALK || 2.2);
await ev(`__arcano.step(${walk}, ['KeyW'])`);
console.log('tras andar', await ev('[Math.round(__arcano.player.x), Math.round(__arcano.player.y)]'));
await ev('__arcano.anima(1000)');
await ev('__arcano.clear()');
let st;
for (let i = 0; i < 40; i++) { st = await ev('__arcano.step(0.1)'); if (st !== 'play') break; }
console.log('estado', st, 'pos', await ev('[Math.round(__arcano.player.x), Math.round(__arcano.player.y)]'));
const r0 = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(`${OUT}/panel.png`, Buffer.from(r0.result.data, 'base64'));
console.log('pick', await ev('__arcano.pick(0)'));
// tiempo casi real: 0,1 s de juego por 0,1 s de reloj (el logro del DOM usa setTimeout real)
let t = 0;
const shots = [0.95, 1.2, 1.6, 2.4, 3.2];
for (const target of shots) {
  while (t < target - 1e-6) { await ev('__arcano.step(0.1)'); await sleep(100); t += 0.1; }
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${OUT}/v-${target}.png`, Buffer.from(r.result.data, 'base64'));
  console.log(target, JSON.stringify(await ev('({ p: [Math.round(__arcano.player.x), Math.round(__arcano.player.y)], form: __arcano.player.form, ui: __arcano.ui(), t: __arcano.toasts() })')));
}
