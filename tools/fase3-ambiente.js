// Fase 3 · ¿suelta cada forma sus partículas de ambiente en partida (y la ceniza de Azufre en su array propio)?
// Uso: [LOWQ=1] CDP_PORT=9436 node tools/cdp.mjs 360 640 tools/fase3-ambiente.js
const low = !!process.env.LOWQ;
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ ${low ? "quality: 'baja', " : ''}tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
await send('Page.reload', {}); await sleep(1500);
await ev('__arcano.flags.freeze = true');
const PATHS = {
  aprendiz: ['fire', []], ignea: ['fire', ['fire']], glacial: ['ice', ['ice']], voltaica: ['bolt', ['bolt']], toxica: ['poison', ['poison']],
  plasma: ['fire', ['fire', 'bolt']], aurora: ['bolt', ['bolt', 'ice']], mortaja: ['ice', ['ice', 'poison']], azufre: ['poison', ['poison', 'fire']],
  eclipse: ['fire', ['fire', 'pact', 'ice']],
};
let fails = 0;
for (const [name, [school, path]] of Object.entries(PATHS)) {
  await ev(`__arcano.school('${school}')`);
  for (const el of path) await ev(el === 'pact' ? '__arcano.pact()' : `__arcano.awaken('${el}')`);
  await ev('__arcano.goto(4)'); await ev('__arcano.god(true)'); await ev('__arcano.clear()'); await ev('__arcano.step(2)');
  const r = await ev('__arcano.ambient ? __arcano.ambient() : null');
  const okk = name === 'aprendiz' ? r.amb + r.ash === 0 : name === 'azufre' ? r.ash > 0 : r.amb > 0;
  if (!okk) fails++;
  console.log((okk ? 'OK   ' : 'FAIL ') + name.padEnd(9), JSON.stringify(r));
}
console.log(fails ? `${fails} FALLOS` : 'TODO OK');
