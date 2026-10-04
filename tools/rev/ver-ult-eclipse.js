// Verificación: botón del definitivo de Eclipse a escala real (pantalla completa) frente a Mortaja
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'E:/PROYECTOS/arcano/tools/out/rev';
fs.mkdirSync(OUT, { recursive: true });
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
await send('Page.reload', {}); await sleep(1500);
await ev('__arcano.flags.freeze = true');
const PATHS = { eclipse: ['fire', ['fire', 'pact', 'ice']], mortaja: ['ice', ['ice', 'poison']], aurora: ['bolt', ['bolt', 'ice']] };
for (const [name, [school, path]] of Object.entries(PATHS)) {
  for (const biome of [8, 18]) {
    await ev('__arcano.seed(5)');
    await ev(`__arcano.school('${school}')`);
    for (const el of path) await ev(el === 'pact' ? '__arcano.pact()' : `__arcano.awaken('${el}')`);
    await ev(`__arcano.goto(${biome})`); await ev('__arcano.god(true)');
    await ev('__arcano.step(0.5)');
    for (const m of [40]) {
      await ev(`(() => { __arcano.player.mana = ${m}; __arcano.step(0.1); })()`);
      await sleep(150);
      const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 360, height: 640, scale: 1 } });
      fs.writeFileSync(`${OUT}/full-${name}-${biome}-${m}.png`, Buffer.from(r.result.data, 'base64'));
    }
    const info = await ev(`(() => { const i = document.querySelector('#btnUlt .in'); const cs = getComputedStyle(i); return { txt: i.textContent, filter: cs.filter, bg: cs.backgroundColor, fs: cs.fontSize, ff: cs.fontFamily, w: i.getBoundingClientRect().width }; })()`);
    console.log(name, biome, JSON.stringify(info));
  }
}
