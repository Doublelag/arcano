// Fase 3 · capturas de la transformación (carga, estallido, rótulo) y de las esquirlas de sombra de Eclipse.
// Uso: SHOTS=dir [LOWQ=1] [CROWN=1] CDP_PORT=9436 node tools/cdp.mjs 360 640 tools/fase3-cine.js
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'shots-fase3';
fs.mkdirSync(OUT, { recursive: true });
const low = !!process.env.LOWQ, tag = (low ? 'low-' : '') + (process.env.CROWN ? 'crown-' : '');
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ ${low ? "quality: 'baja', " : ''}tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
await send('Page.reload', {}); await sleep(1500);
await ev('__arcano.flags.freeze = true');
await ev(`(() => { const g = __arcano.grim(true); g.f = 1023; ${process.env.CROWN ? 'g.e = 1023; g.w = 1023;' : ''} })()`);
const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/k-${tag}${name}.png`, Buffer.from(r.result.data, 'base64')); };
const CASES = [['ignea', 'fire', [], 'fire'], ['plasma', 'fire', ['fire'], 'bolt'], ['eclipse', 'fire', ['fire', 'pact'], 'ice']];
for (const [name, school, pre, el] of CASES) {
  await ev('__arcano.seed(11)');
  await ev(`__arcano.school('${school}')`);
  for (const x of pre) await ev(x === 'pact' ? '__arcano.pact()' : `__arcano.awaken('${x}')`);
  await ev('__arcano.goto(8)'); await ev('__arcano.god(true)'); await ev('__arcano.step(1)'); await ev('__arcano.clear()'); await ev('__arcano.step(0.3)');
  await ev(`__arcano.awaken('${el}', true)`);
  let t = 0;
  for (const [k, at] of [['carga', 0.6], ['boom', 0.97], ['vuelta', 1.25], ['rotulo', 1.9], ['despues', 3.2]]) {
    await ev(`__arcano.step(${(at - t).toFixed(3)})`); t = at;
    await shot(`${name}-${k}`);
  }
  console.log(name, JSON.stringify(await ev('__arcano.formInfo()')).slice(0, 120), JSON.stringify(await ev('__arcano.toasts()')));
}
