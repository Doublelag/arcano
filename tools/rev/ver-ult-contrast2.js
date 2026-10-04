// Verificación: contraste de iconos candidatos en el botón del definitivo de Eclipse (maná 40)
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'E:/PROYECTOS/arcano/tools/out/rev';
fs.mkdirSync(OUT, { recursive: true });
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
await send('Page.reload', {}); await sleep(1500);
await ev('__arcano.flags.freeze = true');
await ev('__arcano.seed(5)'); await ev(`__arcano.school('fire')`);
for (const el of ['fire', 'pact', 'ice']) await ev(el === 'pact' ? '__arcano.pact()' : `__arcano.awaken('${el}')`);
await ev('__arcano.goto(8)'); await ev('__arcano.god(true)'); await ev('__arcano.step(0.5)');
await ev(`(() => { __arcano.player.mana = 40; __arcano.step(0.1); })()`);
for (const ic of ['🕳️', '🌘', '🌑']) {
  await ev(`document.querySelector('#btnUlt .in').textContent = '${ic}'`);
  await sleep(100);
  const rect = await ev(`(() => { const r = document.querySelector('#btnUlt .in').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
  const r = await send('Page.captureScreenshot', { format: 'png', clip: { ...rect, scale: 2 } });
  fs.writeFileSync(`${OUT}/cand-${[...ic][0].codePointAt(0).toString(16)}.png`, Buffer.from(r.result.data, 'base64'));
  const stats = await ev(`(async () => {
    const img = new Image(); img.src = 'data:image/png;base64,${r.result.data}'; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data; const W = c.width, H = c.height, R = W / 2 * 0.8;
    const L = (i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    const bg = L(((H / 2 | 0) * W + 4) * 4); let n = 0, n20 = 0, n60 = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if ((x - W / 2) ** 2 + (y - H / 2) ** 2 > R * R) continue; n++; const dd = Math.abs(L((y * W + x) * 4) - bg); if (dd > 20) n20++; if (dd > 60) n60++; }
    return { pct20: +(100 * n20 / n).toFixed(1), pct60: +(100 * n60 / n).toFixed(1) };
  })()`);
  console.log(ic, JSON.stringify(stats));
}
