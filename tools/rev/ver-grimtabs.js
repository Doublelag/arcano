// Verificación: salto vertical de las pestañas del Grimorio y salto de línea de "Reacciones"
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'E:/PROYECTOS/arcano/tools/out/rev/gt';
fs.mkdirSync(OUT, { recursive: true });
const TAG = process.env.TAG || '';
const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${name}${TAG}.png`, Buffer.from(r.result.data, 'base64')); };
await ev('__arcano.flags.freeze = true');
if (process.env.GRIMEMPTY) await ev('__arcano.grim(true)');
await sleep(400);
console.log('phase2', await ev('__arcano.flags.phase2'), 'state', await ev('__arcano.state'));
await ev(`document.querySelector('[data-act="grimoire"]').click()`); await sleep(600);
const m = () => ev(`(() => { const t = [...document.querySelectorAll('.grim-tabs .tab')]; const p = document.querySelector('#overlay .panel');
  return { panelTop: Math.round(p.getBoundingClientRect().top), panelH: Math.round(p.getBoundingClientRect().height), scrollH: p.scrollHeight, clientH: p.clientHeight,
    tabs: t.map(b => { const r = b.getBoundingClientRect(), i = b.querySelector('i').getBoundingClientRect(); return { tab: b.dataset.tab, x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2), top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width), lines: i.top > r.top + r.height*0.45 ? 2 : 1, text: b.innerText.replace(/\\n/g,'|') }; }) }; })()`);
const elAt = (x, y) => ev(`(() => { const e = document.elementFromPoint(${x}, ${y}); if (!e) return null; const b = e.closest('button'); return (b ? 'BUTTON ' + (b.dataset.tab || b.dataset.act) : e.className + ' ' + e.tagName) + ' :: ' + (e.innerText||'').slice(0,30); })()`);
const a = await m(); console.log('formas', JSON.stringify(a));
await shot('a-formas');
// toque REAL sobre la pestaña Reacciones
const rx = a.tabs.find(t => t.tab === 'reacciones');
await tap(rx.x, rx.y); await sleep(500);
const b = await m(); console.log('tras tocar reacciones', JSON.stringify(b));
await shot('b-reacciones');
// qué hay ahora donde estaban Formas y Mezclas
for (const t of a.tabs) console.log(`  en la posición antigua de ${t.tab} (${t.x},${t.y}) ahora hay:`, await elAt(t.x, t.y));
// toque REAL en la posición antigua de Formas
const fo = a.tabs.find(t => t.tab === 'formas');
await tap(fo.x, fo.y); await sleep(500);
console.log('tras tocar la posición antigua de Formas, pestaña activa =', await ev(`document.querySelector('.grim-tabs .tab.on').dataset.tab`));
const mz = a.tabs.find(t => t.tab === 'mezclas');
if (mz) {
  await tap(mz.x, mz.y); await sleep(500);
  console.log('tras tocar la posición antigua de Mezclas, pestaña activa =', await ev(`document.querySelector('.grim-tabs .tab.on').dataset.tab`));
}
// forzar mezclas y ver
await ev(`document.querySelector('[data-tab="mezclas"]') && document.querySelector('[data-tab="mezclas"]').click()`); await sleep(500);
const c = await m(); console.log('mezclas', JSON.stringify(c));
await shot('c-mezclas');
