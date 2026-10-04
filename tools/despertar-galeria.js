// Galería en partida: cada forma en combate (mago, aura, disparos, charcos, ambiente). Con LOWQ=1, en calidad baja.
// Uso: CDP_PORT=9433 node tools/cdp.mjs 360 640 tools/despertar-galeria.js
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'shots-despertar';
fs.mkdirSync(OUT, { recursive: true });
const low = !!process.env.LOWQ;
if (low) {
  await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ quality: 'baja', tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1 } }))`);
} else await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1 } }))`);
await send('Page.reload', {}); await sleep(1500);
await ev('__arcano.flags.freeze = true');
await ev('__arcano.seed(3)');
const PATHS = [
  ['aprendiz', 'fire', ['+ice']], ['ignea', 'fire', ['fire']], ['glacial', 'ice', ['ice']], ['voltaica', 'bolt', ['bolt']], ['toxica', 'poison', ['poison']],
  ['plasma', 'fire', ['fire', 'bolt']], ['aurora', 'bolt', ['bolt', 'ice']], ['mortaja', 'ice', ['ice', 'poison']], ['azufre', 'poison', ['poison', 'fire']],
  ['eclipse', 'fire', ['fire', 'pact', 'ice']],
];
const s = 360 / 540;
for (const [name, school, path] of PATHS) {
  await ev(`__arcano.school('${school}')`);
  for (const el of path) {
    if (el === 'pact') await ev('__arcano.pact()');
    else if (el[0] === '+') await ev(`__arcano.give('${el.slice(1)}')`);
    else await ev(`__arcano.awaken('${el}')`);
  }
  await ev(`__arcano.give('front')`); await ev(`__arcano.give('diag')`);
  await ev('__arcano.goto(7)'); await ev('__arcano.god(true)');
  await ev('__arcano.step(1.4)');
  let n = 0;
  for (let i = 0; i < 30 && n < 3; i++) { await ev('__arcano.step(0.05)'); n = await ev('__arcano.shots.length'); }
  await ev('__arcano.step(0.15)'); // en vuelo, que no tapen al mago
  const p = await ev('({ x: __arcano.player.x, y: __arcano.player.y, form: __arcano.player.form })');
  const clip = { x: Math.max(0, (p.x - 130) * s), y: (p.y - 300) * s, width: 260 * s, height: 340 * s, scale: 2 };
  const r = await send('Page.captureScreenshot', { format: 'png', clip });
  fs.writeFileSync(`${OUT}/g-${low ? 'low-' : ''}${name}.png`, Buffer.from(r.result.data, 'base64'));
  console.log(name, '→', p.form, '· disparos', n, '· fps-cache', JSON.stringify(await ev('__arcano.formStats()')));
}
// partida corta en Plasma con muchos enemigos para ver el coste por fotograma (sin pintar: solo lógica + render de step)
await ev(`__arcano.school('fire')`); await ev(`__arcano.awaken('fire')`); await ev(`__arcano.awaken('bolt')`);
for (const k of ['front', 'front', 'diag', 'diag', 'multi', 'multi', 'atkspd', 'atkspd', 'orbs']) await ev(`__arcano.give('${k}')`);
await ev('__arcano.goto(18)'); await ev('__arcano.god(true)');
const t0 = await ev('performance.now()');
const frames = 240;
for (let i = 0; i < frames / 20; i++) await ev('(() => { for (let k = 0; k < 20; k++) __arcano.step(1 / 60); })()');
const t1 = await ev('performance.now()');
console.log(`sala 18 en Plasma (${low ? 'baja' : 'alta'}): ${((t1 - t0) / frames).toFixed(2)} ms por fotograma (lógica + render) · disparos ${await ev('__arcano.shots.length')} · cachés ${JSON.stringify(await ev('__arcano.formStats()'))}`);
