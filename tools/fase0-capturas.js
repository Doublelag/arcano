// Capturas de la fase 0: NECROSIS en partida y la lista de 6 reacciones en la pausa
// Uso: CDP_PORT=9432 node tools/cdp.mjs 360 640 tools/fase0-capturas.js
const fs = await import('node:fs');
const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`E:/PROYECTOS/arcano/tools/${name}.png`, Buffer.from(r.result.data, 'base64')); console.log('captura', name); };
const r = await ev(`(() => {
  const A = __arcano; A.seed(21); A.school('ice'); A.give('poison'); A.god(true); A.goto(3);
  for (let i = 0; i < 60 * 25 && !A.seen().includes('necro'); i++) {
    if (A.state === 'levelup' || A.state === 'altar') A.pick(0);
    A.step(1 / 60);
  }
  A.step(0.05);
  return { seen: A.seen(), state: A.state };
})()`);
console.log(r);
await sleep(100);
await shot('fase0-necrosis');
await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }))`);
await sleep(300);
await ev(`(() => { const p = document.querySelector('.panel'); const r = p && p.querySelector('.reacts'); if (r) r.scrollIntoView(); })()`);
await sleep(200);
await shot('fase0-pausa');
