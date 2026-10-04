// Fase 3 · revisión visual: las 10 formas en los 4 biomas (salas 3, 8, 13, 18) a pantalla completa, en combate,
// con balas enemigas en vuelo. Guarda b<sala>-<forma>.png (pantalla) y c<sala>-<forma>.png (primer plano del mago).
// Uso: SHOTS=dir [LOWQ=1] [ROOMS=3,8] [FORMS=ignea,eclipse] [CROWN=1] CDP_PORT=9436 node tools/cdp.mjs 360 640 tools/fase3-biomas.js
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'shots-fase3';
fs.mkdirSync(OUT, { recursive: true });
const low = !!process.env.LOWQ, tag = low ? 'low-' : '';
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ ${low ? "quality: 'baja', " : ''}tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
await send('Page.reload', {}); await sleep(1500);
await ev('__arcano.flags.freeze = true');
if (process.env.CROWN) await ev('(() => { const g = __arcano.grim(); g.f = 1023; g.e = 1023; g.w = 1023; })()'); // todas las Marcas II: coronas
const PATHS = {
  aprendiz: ['fire', ['+ice']], ignea: ['fire', ['fire']], glacial: ['ice', ['ice']], voltaica: ['bolt', ['bolt']], toxica: ['poison', ['poison']],
  plasma: ['fire', ['fire', 'bolt']], aurora: ['bolt', ['bolt', 'ice']], mortaja: ['ice', ['ice', 'poison']], azufre: ['poison', ['poison', 'fire']],
  eclipse: ['fire', ['fire', 'pact', 'ice']],
};
const ROOMS = (process.env.ROOMS || '3,8,13,18').split(',').map(Number);
const FORMS = (process.env.FORMS || Object.keys(PATHS).join(',')).split(',');
const s = 360 / 540;
for (const room of ROOMS) {
  for (const name of FORMS) {
    const [school, path] = PATHS[name];
    await ev('__arcano.seed(' + (room * 13 + 5) + ')');
    await ev(`__arcano.school('${school}')`);
    for (const el of path) {
      if (el === 'pact') await ev('__arcano.pact()');
      else if (el[0] === '+') await ev(`__arcano.give('${el.slice(1)}')`);
      else await ev(`__arcano.awaken('${el}')`);
    }
    await ev(`__arcano.give('front')`); await ev(`__arcano.give('diag')`);
    await ev(`__arcano.goto(${room})`); await ev('__arcano.god(true)');
    await ev('__arcano.step(1.2)');
    // hasta que haya balas enemigas y disparos propios en vuelo (lejos del mago) a la vez
    let st = null;
    for (let i = 0; i < 120; i++) {
      await ev('__arcano.step(0.05)');
      st = await ev(`(() => { const A = __arcano, p = A.player; return { b: A.bullets.length, s: A.shots.length, f: A.shots.filter(s => Math.hypot(s.x - p.x, s.y - p.y) > 90).length, e: A.enemies.filter(e => !e.dead).length }; })()`);
      if (st.b >= 2 && st.f >= 3) break;
    }
    const p = await ev('({ x: __arcano.player.x, y: __arcano.player.y, form: __arcano.player.form })');
    let r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/b${room}-${tag}${name}.png`, Buffer.from(r.result.data, 'base64'));
    r = await send('Page.captureScreenshot', { format: 'png', clip: { x: Math.max(0, Math.min(540 - 260, p.x - 130) * s), y: Math.max(0, (p.y - 280) * s), width: 260 * s, height: 330 * s, scale: 2 } });
    fs.writeFileSync(`${OUT}/c${room}-${tag}${name}.png`, Buffer.from(r.result.data, 'base64'));
    console.log(`sala ${room} ${name} → ${p.form} · balas ${st.b} · disparos ${st.s} (lejos ${st.f}) · enemigos ${st.e}`);
  }
}
console.log('cachés', JSON.stringify(await ev('__arcano.formStats()')));
