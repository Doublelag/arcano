// Verificación del arreglo propuesto (inyectado en el DOM, sin tocar el código)
const fs = await import('node:fs');
const OUT = 'E:/PROYECTOS/arcano/tools/out/rev';
const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64')); };
const click = sel => ev(`(() => { const e = document.querySelector('${sel}'); if (!e) return false; e.click(); return true; })()`);
await ev('__arcano.flags.freeze = true');
await ev(`(() => { const g = __arcano.grim(); g.k = [11, 2, 13, 1]; g.f |= 0b111; return g; })()`);
await click('[data-act="stats"]'); await sleep(450);
for (const lab of ['Sala media al despertar', '1º y 2º despertar (sala)']) {
  console.log(lab, JSON.stringify(await ev(`(() => { const d = [...document.querySelectorAll('#overlay .stats > div')].pop(); const s = d.querySelector('span'), b = d.querySelector('b');
    s.textContent = ${JSON.stringify(lab)}; b.textContent = '5,5 y 13';
    const lh = parseFloat(getComputedStyle(s).lineHeight) || 20; return { spanH: s.getBoundingClientRect().height, lh, bH: b.getBoundingClientRect().height, w: d.clientWidth, sw: s.scrollWidth }; })()`)));
  await shot('ver-fix-' + lab.length);
}
