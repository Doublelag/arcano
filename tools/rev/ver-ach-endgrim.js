// Verificación: ¿cuánto tiempo tapa el aviso de logro el emblema "Ganaste como X" en la primera victoria?
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'E:/PROYECTOS/arcano/tools/out/rev', TAG = process.env.TAG || '';
fs.mkdirSync(OUT, { recursive: true });
const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${name}${TAG}.png`, Buffer.from(r.result.data, 'base64')); };
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
await send('Page.reload', {}); await sleep(1500);
await ev('__arcano.flags.freeze = true');
await ev('__arcano.grim(true)');
await ev(`__arcano.school('fire')`); await ev(`__arcano.awaken('fire')`); await ev(`__arcano.awaken('bolt')`);
await sleep(7000);
await ev('__arcano.goto(20)'); await ev('__arcano.god(true)'); await ev('__arcano.step(2.5)');
await ev(`(() => { const A = __arcano, i = A.enemies.findIndex(e => e.kind === 'boss'); const e = A.enemies[i]; e.spawnT = 0; e.hp = 1; return A.hit(i, ['fire']); })()`);
for (let i = 0; i < 600 && await ev('__arcano.state') !== 'win'; i++) { await ev('__arcano.step(' + (1 / 60) + ')'); await sleep(12); }
const t0 = Date.now();
let covered = 0, last = '';
for (let k = 0; k < 40; k++) {
  const r = await ev(`(() => { const t = document.getElementById('achToast'), a = t.getBoundingClientRect(), e = document.querySelector('.emblem').getBoundingClientRect(); const op = +getComputedStyle(t).opacity; return { op, txt: t.innerText.replace(/\\n/g,' '), ov: Math.max(0, Math.min(a.bottom, e.bottom) - Math.max(a.top, e.top)) / e.height }; })()`);
  const on = r.op > 0.5 && r.ov > 0.3;
  if (on) covered = Date.now() - t0;
  const line = `${on ? 'TAPA' : 'libre'} ${r.txt}`;
  if (line !== last) { console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', line, 'solape', (r.ov * 100).toFixed(0) + '%', 'op', r.op.toFixed(2)); last = line; }
  await sleep(250);
}
console.log('emblema tapado hasta ~', (covered / 1000).toFixed(1), 's tras la victoria');
console.log('logros', await ev(`JSON.stringify(Object.keys(JSON.parse(localStorage.getItem('arcano.meta')||'{}').ach||{}))`));
