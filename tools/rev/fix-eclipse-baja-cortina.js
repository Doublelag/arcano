// 12) Calidad baja: el disparo de Eclipse lleva su aro claro (si no, es un punto negro en la cripta y el volcán)
// 18) Cortina boreal contra un jefe solo: 18× (21,6× con Linaje) en vez de 7×; los demás enemigos siguen en 7×
// Uso: SHOTS=dir CDP_PORT=9461 node tools/cdp.mjs 360 640 tools/rev/fix-eclipse-baja-cortina.js
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'E:/PROYECTOS/arcano/tools/out/rev', TAG = process.env.TAG || '';
fs.mkdirSync(OUT, { recursive: true });
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, quality: 'baja', tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
await send('Page.reload', {}); await sleep(1500);
await ev('__arcano.flags.freeze = true');
await ev('__arcano.grim(true)'); await ev('__arcano.seed(5)');
// 12: Eclipse en la cripta (sala 8) y en el volcán (sala 18), calidad baja: píxeles claros alrededor de cada disparo
await ev(`__arcano.school('fire')`); await ev(`__arcano.awaken('fire')`); await ev('__arcano.pact()'); await ev(`__arcano.awaken('ice')`);
for (const r of [8, 18]) {
  await ev(`__arcano.goto(${r})`); await ev('__arcano.god(true)'); await ev('__arcano.step(1.5)');
  for (let i = 0; i < 12; i++) await ev('__arcano.step(1 / 30)');
  const sh = await ev(`__arcano.shots.filter(s => !s.sub).slice(0, 4).map(s => [Math.round(s.x), Math.round(s.y)])`);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${OUT}/eclipse-baja-${r}${TAG}.png`, Buffer.from(shot.result.data, 'base64'));
  const light = await ev(`(async () => {
    const img = new Image(); img.src = 'data:image/png;base64,${shot.result.data}'; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const cv = document.querySelector('canvas').getBoundingClientRect(), k = img.width / innerWidth, s = cv.width / 540;
    return ${JSON.stringify(sh)}.map(([x, y]) => { // máximo de luminancia en un cuadrado de 22 px lógicos alrededor del disparo
      const px = (cv.left + x * s) * k, py = (cv.top + y * s) * k, h = 11 * s * k; let m = 0;
      const d = g.getImageData(px - h, py - h, 2 * h, 2 * h).data;
      for (let i = 0; i < d.length; i += 4) m = Math.max(m, 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
      return Math.round(m);
    });
  })()`);
  console.log('sala', r, 'forma', await ev('__arcano.player.form'), 'disparos', JSON.stringify(sh), 'luz máx. alrededor', JSON.stringify(light));
}
// 18: Aurora contra el jefe de la sala 15, solo
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
await send('Page.reload', {}); await sleep(1500);
await ev('__arcano.flags.freeze = true'); await ev('__arcano.grim(true)'); await ev('__arcano.seed(5)');
for (const [school, path] of [['bolt', ['bolt', 'ice']], ['ice', ['ice', 'bolt']]]) {
  await ev(`__arcano.school('${school}')`); for (const el of path) await ev(`__arcano.awaken('${el}')`);
  await ev('__arcano.goto(15)'); await ev('__arcano.god(true)');
  for (let i = 0; i < 80 && (await ev(`__arcano.enemies.some(e => e.kind === 'boss' && e.spawnT > 0)`)); i++) await ev('__arcano.step(0.1)');
  await ev('__arcano.step(3)');
  const r = await ev(`(() => { const A = __arcano, P = A.player, B = A.enemies.find(e => e.kind === 'boss');
    A.enemies.filter(e => e !== B).forEach(e => { e.dead = true; }); P.cd = 1e9; B.frozen = 0; B.frzImm = 0; B.corrode = 0;
    const hp0 = B.hp; A.ult(); for (let i = 0; i < 120; i++) { P.cd = 1e9; A.step(1 / 60); }
    return { form: P.form, linaje: A.formInfo().linaje, atk: P.atk, dmg: Math.round(hp0 - B.hp), k: +((hp0 - B.hp) / P.atk).toFixed(1), pct: +(100 * (hp0 - B.hp) / B.maxHp).toFixed(1) }; })()`);
  console.log('Cortina contra el jefe:', JSON.stringify(r));
}
