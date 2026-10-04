// Primer plano del mago en una forma (FORM=ignea por defecto) para revisar el aura
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'shots-despertar';
const PATH = { ignea: ['fire', ['fire']], plasma: ['fire', ['fire', 'bolt']], aurora: ['bolt', ['bolt', 'ice']], glacial: ['ice', ['ice']], eclipse: ['fire', ['fire', 'pact', 'ice']] };
await ev('__arcano.flags.freeze = true');
for (const f of (process.env.FORM || 'ignea').split(',')) {
  const [school, path] = PATH[f];
  await ev(`__arcano.school('${school}')`);
  for (const el of path) await ev(el === 'pact' ? '__arcano.pact()' : `__arcano.awaken('${el}')`);
  await ev('__arcano.goto(2)'); await ev('__arcano.god(true)'); await ev('__arcano.clear()'); await ev('__arcano.step(0.9)');
  for (const [k, dt] of [[0, 0], [1, 0.08], [2, 0.08]]) {
    if (dt) await ev(`__arcano.step(${dt})`);
    const p = await ev('({ x: __arcano.player.x, y: __arcano.player.y })'), s = 360 / 540;
    const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: (p.x - 55) * s, y: (p.y - 60) * s, width: 110 * s, height: 90 * s, scale: 4 } });
    fs.writeFileSync(`${OUT}/m-${f}-${k}.png`, Buffer.from(r.result.data, 'base64'));
  }
}
