// Verificación: fila "Despertar medio (sala)" en Logros
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'E:/PROYECTOS/arcano/tools/out/rev';
const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64')); };
const click = sel => ev(`(() => { const e = document.querySelector('${sel}'); if (!e) return false; e.click(); return true; })()`);
await ev('__arcano.flags.freeze = true');
for (const [name, k] of [['k-a', [11, 2, 13, 1]], ['k-b', [5, 1, 0, 0]]]) {
  await ev(`(() => { const g = __arcano.grim(); g.k = ${JSON.stringify(k)}; g.f |= 0b111; return g; })()`);
  await click('[data-act="back"]'); await sleep(450);
  await click('[data-act="stats"]'); await sleep(450);
  console.log(name, JSON.stringify(await ev(`[...document.querySelectorAll('#overlay .stats > div')].map(d => d.innerText.replace(/\\n/g, ' | '))`)));
  await shot('ver-' + name);
}
