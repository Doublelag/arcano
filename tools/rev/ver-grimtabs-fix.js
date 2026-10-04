// Verificación del arreglo propuesto (inyectado en caliente, sin tocar el fuente):
//   .panel.shop.grim { height: 96%; }        -> el panel ocupa siempre lo mismo y el encabezado no se mueve
//   .grim-tabs .tab i { display: block; }     -> el contador va siempre en su propia línea (las 3 pestañas iguales)
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'E:/PROYECTOS/arcano/tools/out/rev/gt';
fs.mkdirSync(OUT, { recursive: true });
const TAG = process.env.TAG || '';
const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${name}${TAG}.png`, Buffer.from(r.result.data, 'base64')); };
await ev('__arcano.flags.freeze = true');
if (!process.env.NOFIX) await ev(`(() => { const s = document.createElement('style'); s.textContent = '.panel.shop.grim { height: 96%; } .grim-tabs .tab i { display: block; }'; document.head.appendChild(s); })()`);
await sleep(300);
await ev(`document.querySelector('[data-act="grimoire"]').click()`); await sleep(600);
const m = () => ev(`(() => { const t = [...document.querySelectorAll('.grim-tabs .tab')]; const p = document.querySelector('#overlay .panel');
  const name = b => { const r = document.createRange(); r.selectNodeContents(b.firstChild); return r.getClientRects().length; };
  return { panelTop: Math.round(p.getBoundingClientRect().top), panelH: Math.round(p.getBoundingClientRect().height), scroll: p.scrollHeight > p.clientHeight,
    tabs: t.map(b => { const r = b.getBoundingClientRect(); return { tab: b.dataset.tab, top: Math.round(r.top), h: Math.round(r.height), nameLines: name(b), ovf: b.scrollWidth > b.clientWidth }; }),
    back: Math.round(document.querySelector('[data-act="back"]').getBoundingClientRect().top) }; })()`);
const out = {};
for (const tab of ['formas', 'reacciones', 'mezclas', 'formas']) {
  await ev(`document.querySelector('[data-tab="${tab}"]').click()`); await sleep(450);
  const r = await m();
  console.log(tab.padEnd(11), 'panelTop', r.panelTop, 'H', r.panelH, 'scroll', r.scroll, 'tabsTop', r.tabs.map(t => t.top).join('/'), 'h', r.tabs[0].h, 'nameLines', r.tabs.map(t => t.nameLines).join('/'), 'ovf', r.tabs.some(t => t.ovf), 'volverTop', r.back);
  if (!out[tab]) { out[tab] = 1; await shot('fix-' + tab); }
}
// desplazar Formas abajo, cambiar a Reacciones y volver: arranca arriba
await ev(`document.querySelector('#overlay .panel').scrollTop = 9999`); await sleep(200);
await ev(`document.querySelector('[data-tab="reacciones"]').click()`); await sleep(450);
console.log('tras scroll+cambio, scrollTop', await ev(`document.querySelector('#overlay .panel').scrollTop`), 'tabsTop', (await m()).tabs[0].top);
