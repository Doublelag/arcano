// Verificación del arreglo: en win/over el aviso de logro baja abajo (clase .low inyectada en caliente)
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'E:/PROYECTOS/arcano/tools/out/rev', TAG = process.env.TAG || '';
fs.mkdirSync(OUT, { recursive: true });
const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${name}${TAG}.png`, Buffer.from(r.result.data, 'base64')); };
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
await send('Page.reload', {}); await sleep(1500);
await ev(`(() => { const s = document.createElement('style'); s.textContent = '#achToast.low { top: auto; bottom: calc(var(--u) * 24px); transform: translate(-50%, calc(var(--u) * 160px)); } #achToast.low.show { transform: translate(-50%, 0); }'; document.head.appendChild(s); })()`);
await ev('__arcano.flags.freeze = true');
await ev('__arcano.grim(true)');
await ev(`__arcano.school('fire')`); await ev(`__arcano.awaken('fire')`); await ev(`__arcano.awaken('bolt')`);
await sleep(7000);
await ev('__arcano.goto(20)'); await ev('__arcano.god(true)'); await ev('__arcano.step(2.5)');
await ev(`(() => { const A = __arcano, i = A.enemies.findIndex(e => e.kind === 'boss'); const e = A.enemies[i]; e.spawnT = 0; e.hp = 1; return A.hit(i, ['fire']); })()`);
for (let i = 0; i < 600 && await ev('__arcano.state') !== 'win'; i++) { await ev('__arcano.step(' + (1 / 60) + ')'); await sleep(12); }
await ev(`document.getElementById('achToast').classList.add('low')`);
await sleep(600);
const r = await ev(`(() => { const p = document.querySelector('.panel'), a = document.getElementById('achToast').getBoundingClientRect(); const hits = [...p.querySelectorAll('.emblem,.newmark,.title,.sub,.btn,.stats,.chips,.skill-chips')].map(el => { const b = el.getBoundingClientRect(); return [el.className, Math.round(b.top), Math.round(b.bottom)]; }); return { ach: [Math.round(a.top), Math.round(a.bottom)], scroll: [p.scrollHeight, p.clientHeight], hits }; })()`);
console.log(JSON.stringify(r));
await shot('fix-victoria-logro');
