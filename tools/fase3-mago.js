// Fase 3 · primer plano del mago en las 10 formas (aura, ambiente, corona) con la sala limpia.
// Uso: SHOTS=dir [ROOM=2] [CROWN=1] [LOWQ=1] [FORMS=ignea,...] CDP_PORT=9436 node tools/cdp.mjs 360 640 tools/fase3-mago.js
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'shots-fase3';
fs.mkdirSync(OUT, { recursive: true });
const low = !!process.env.LOWQ, ROOM = +process.env.ROOM || 2;
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ ${low ? "quality: 'baja', " : ''}tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
await send('Page.reload', {}); await sleep(1500);
await ev('__arcano.flags.freeze = true');
await ev(`(() => { const g = __arcano.grim(true); ${process.env.CROWN ? 'g.f = 1023; g.e = 1023; g.w = 1023;' : ''} })()`);
const PATHS = {
  aprendiz: ['fire', ['+ice']], ignea: ['fire', ['fire']], glacial: ['ice', ['ice']], voltaica: ['bolt', ['bolt']], toxica: ['poison', ['poison']],
  plasma: ['fire', ['fire', 'bolt']], aurora: ['bolt', ['bolt', 'ice']], mortaja: ['ice', ['ice', 'poison']], azufre: ['poison', ['poison', 'fire']],
  eclipse: ['fire', ['fire', 'pact', 'ice']],
};
const FORMS = (process.env.FORMS || Object.keys(PATHS).join(',')).split(',');
const s = 360 / 540, tag = (low ? 'low-' : '') + (process.env.CROWN ? 'crown-' : '');
for (const name of FORMS) {
  const [school, path] = PATHS[name];
  await ev('__arcano.seed(7)');
  await ev(`__arcano.school('${school}')`);
  for (const el of path) {
    if (el === 'pact') await ev('__arcano.pact()');
    else if (el[0] === '+') await ev(`__arcano.give('${el.slice(1)}')`);
    else await ev(`__arcano.awaken('${el}')`);
  }
  await ev(`__arcano.goto(${ROOM})`); await ev('__arcano.god(true)'); await ev('__arcano.clear()');
  await ev('__arcano.player.y -= 120'); // lejos de la puerta y del botón del definitivo
  await ev('__arcano.step(1.5)');
  const p = await ev('({ x: __arcano.player.x, y: __arcano.player.y })');
  const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: (p.x - 60) * s, y: (p.y - 75) * s, width: 120 * s, height: 105 * s, scale: 3 } });
  fs.writeFileSync(`${OUT}/m${ROOM}-${tag}${name}.png`, Buffer.from(r.result.data, 'base64'));
}
console.log('ok', FORMS.length);
