// Revisión visual: botón del definitivo de cada forma (sin cargar y listo), recortado
// Uso: SHOTS=dir CDP_PORT=9454 node tools/cdp.mjs 360 640 tools/rev/rev-ultbtn.js
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'E:/PROYECTOS/arcano/tools/out/rev';
fs.mkdirSync(OUT, { recursive: true });
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
await send('Page.reload', {}); await sleep(1500);
await ev('__arcano.flags.freeze = true');
const PATHS = {
  aprendiz: ['fire', []], ignea: ['fire', ['fire']], glacial: ['ice', ['ice']], voltaica: ['bolt', ['bolt']], toxica: ['poison', ['poison']],
  plasma: ['fire', ['fire', 'bolt']], aurora: ['bolt', ['bolt', 'ice']], mortaja: ['ice', ['ice', 'poison']], azufre: ['poison', ['poison', 'fire']],
  eclipse: ['fire', ['fire', 'pact', 'ice']], arcane: ['arcane', []],
};
for (const [name, [school, path]] of Object.entries(PATHS)) {
  await ev('__arcano.seed(5)');
  await ev(`__arcano.school('${school}')`);
  for (const el of path) await ev(el === 'pact' ? '__arcano.pact()' : `__arcano.awaken('${el}')`);
  await ev('__arcano.goto(8)'); await ev('__arcano.god(true)');
  await ev('__arcano.step(0.5)');
  const rect = await ev(`(() => { const r = document.getElementById('btnUlt').getBoundingClientRect(); return { x: r.x - 10, y: r.y - 10, width: r.width + 20, height: r.height + 20 }; })()`);
  for (const m of [40, 100]) {
    await ev(`(() => { __arcano.player.mana = ${m}; __arcano.step(0.1); })()`);
    await sleep(150);
    const r = await send('Page.captureScreenshot', { format: 'png', clip: { ...rect, scale: 2 } });
    fs.writeFileSync(`${OUT}/u-${name}-${m}.png`, Buffer.from(r.result.data, 'base64'));
  }
  console.log(name, JSON.stringify(await ev('({ icon: __arcano.ults().icon, name: __arcano.ults().name, form: __arcano.player.form })')));
}
