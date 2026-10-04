// Verificación: primer Gólem en tiempo REAL (bucle rAF, sin freeze): ¿el logro tapa el panel DESPIERTA?
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'E:/PROYECTOS/arcano/tools/out/rev/shots', TAG = process.env.TAG || '';
fs.mkdirSync(OUT, { recursive: true });
const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${name}${TAG}.png`, Buffer.from(r.result.data, 'base64')); };
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true }))`);
await send('Page.reload', {}); await sleep(1500);
await ev('__arcano.grim(true)');
await ev(`__arcano.school('${process.env.SCH || 'fire'}')`);
await ev('__arcano.goto(5)'); await ev('__arcano.god(true)');
await sleep(2500);
console.log('state', await ev('__arcano.state'), 'boss?', await ev(`__arcano.enemies.map(e => e.kind + ':' + e.tier).join(',')`));
console.log('ach boss1 antes:', await ev(`JSON.parse(localStorage.getItem('arcano.meta')||'{}').ach`));
await ev(`(() => { const A = __arcano, i = A.enemies.findIndex(e => e.kind === 'boss'); const e = A.enemies[i]; e.spawnT = 0; e.hp = 1; return A.hit(i, ['fire']); })()`);
const t0 = Date.now();
let last = '';
let shots = 0;
for (let i = 0; i < 160; i++) {
  const s = await ev(`(() => { const ov = document.querySelector('[data-act="later"]'); const a = document.getElementById('achToast'); const r = a.getBoundingClientRect(); const sub = document.querySelector('.panel .sub'); const sr = sub && sub.getBoundingClientRect(); const rb = document.querySelector('.panel .rombo'); const rr = rb && rb.getBoundingClientRect();
    return JSON.stringify({ st: __arcano.state, awk: !!ov, ach: a.className, op: getComputedStyle(a).opacity, achTxt: a.textContent.slice(0,40), achBot: Math.round(r.bottom), achTop: Math.round(r.top), subTop: sr && Math.round(sr.top), subBot: sr && Math.round(sr.bottom), romboTop: rr && Math.round(rr.top), romboBot: rr && Math.round(rr.bottom) }); })()`);
  const o = JSON.parse(s);
  const key = o.st + o.awk + o.ach + o.achTxt;
  if (key !== last) { console.log(Date.now() - t0, 'ms', s); last = key; }
  if (o.awk && o.ach === 'show' && shots < 2) { await shot('golem-panel-' + shots); shots++; console.log('  captura', Date.now() - t0, 'ms', s); }
  if (o.st === 'levelup' && !o.awk) { console.log('panel normal', Date.now() - t0, 'logro', o.ach, o.achTop, o.achBot, 'sub', o.subTop); await sleep(+process.env.PICKMS || 300); await ev('__arcano.pick(0)'); last = ''; }
  await sleep(50);
}
