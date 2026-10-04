// Fase 2: Mezclas en combate (capturas), pausa con Mezclas, pestaña Mezclas del Grimorio y rendimiento en la sala 18
// Uso: SHOTS=dir CDP_PORT=9435 node tools/cdp.mjs 360 640 tools/fase2-galeria.js   (LOWQ=1: calidad baja)
const fs = await import('node:fs');
const DIR = process.env.SHOTS || '.', LOW = !!process.env.LOWQ, TAG = LOW ? '-baja' : '';
let fails = 0;
const ok = (c, msg, x) => { console.log((c ? 'OK   ' : 'FAIL ') + msg + (x !== undefined ? '  ' + JSON.stringify(x) : '')); if (!c) fails++; };
const P = code => ev(`(() => { const A = __arcano, E = A.enemies, P = A.player, F = window.ArcanoForms; ${code} })()`);
const shot = async name => { await sleep(150); const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${DIR}/${name}${TAG}.png`, Buffer.from(r.result.data, 'base64')); };
const BUILD = `for (const [k, n] of Object.entries({ atk: 3, atkspd: 2, front: 1, multi: 1, crit: 1, hp: 2 })) for (let i = 0; i < n; i++) A.give(k);`;
const setup = async (school, path, cards, room = 18) => {
  await ev(`__arcano.school('${school}')`);
  await P(`${BUILD} ${cards.map(c => `A.give('${c}');`).join(' ')} return 1;`);
  for (const el of path) await ev(el === 'pact' ? '__arcano.pact()' : `__arcano.awaken('${el}')`);
  await ev(`__arcano.goto(${room})`);
  await ev('__arcano.god(true)');
  await P(`E.forEach(e => { e.spawnT = 0; e.hp = e.maxHp = 1e5; }); return 1;`);
};

await ev('__arcano.flags.freeze = true');
await ev('__arcano.seed(3)');
if (LOW) await P(`document.querySelector('#overlay'); localStorage.setItem('arcano.settings', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('arcano.settings') || '{}'), { quality: 'baja' }))); return 1;`);
if (LOW) { await send('Page.reload'); await sleep(1500); await ev('__arcano.flags.freeze = true'); await ev('__arcano.seed(3)'); }

// ---------- Plasma: Halo solar + Anillo voltaico (2 orbes) + Cometa + Chispazo ----------
await setup('fire', ['fire', 'bolt'], ['bolt', 'orbs', 'orbs', 'pierce', 'crit']);
let r = await P(`return A.formInfo().mixes;`);
ok(['cometa', 'halo', 'anillo', 'chispazo'].every(m => r.includes(m)), 'Plasma con orbes, lanza y concentración: 4 Mezclas', r);
await ev('__arcano.step(2.6)');
await shot('mezclas-plasma');
r = await P(`return A.perf(600);`);
console.log('perf Plasma sala 18', JSON.stringify(r));
ok(r.update < 4, 'Plasma: update medio < 4 ms', r);
r = await P(`P.mana = 100; A.ult(); return A.perf(120);`);
console.log('perf Plasma + Sol cautivo', JSON.stringify(r));

// ---------- Aurora: Glaciar + Granizo + Cortina ----------
await setup('bolt', ['bolt', 'ice'], ['ice', 'wall', 'wall', 'ricochet', 'ricochet', 'diag']);
r = await P(`return A.formInfo().mixes;`);
ok(['glaciar', 'granizo'].every(m => r.includes(m)), 'Aurora con rebote y salto: Glaciar y Granizo', r);
await ev('__arcano.step(2.6)');
await shot('mezclas-aurora');
r = await P(`return A.perf(600);`);
console.log('perf Aurora sala 18', JSON.stringify(r));
ok(r.update < 4, 'Aurora: update medio < 4 ms', r);
r = await P(`P.mana = 100; A.ult(); return A.perf(120);`);
console.log('perf Aurora + Cortina', JSON.stringify(r));
r = await P(`return { stats: A.formStats() };`);
ok(r.stats.glowGame < 70, 'glowCache < 70', r.stats);

// ---------- Azufre: Aguijón + Contagio ----------
await setup('poison', ['poison', 'fire'], ['diag', 'diag', 'ricochet']);
r = await P(`return A.formInfo().mixes;`);
ok(['contagio', 'aguijon'].every(m => r.includes(m)), 'Azufre con abanico y salto: Aguijón y Contagio', r);
await ev('__arcano.step(2.2)');
await shot('mezclas-azufre');

// ---------- pausa con las Mezclas activas ----------
r = await P(`A.flags.freeze = false; document.getElementById('btnPause').click(); return A.state;`);
await sleep(300);
r = await P(`const o = document.getElementById('overlay'), p = o.querySelector('.panel'); return { st: A.state, line: (o.querySelector('.mixline') || {}).textContent, scroll: p.scrollHeight > p.clientHeight + 2 };`);
ok(r.st === 'paused' && /Mezclas: Contagio · Aguijón/.test(r.line || ''), 'pausa: línea de Mezclas activas', r);
await shot('pausa-mezclas');
await P(`A.flags.freeze = true; return 1;`);

// ---------- Grimorio: pestaña Mezclas ----------
await P(`A.flags.freeze = false; return 1;`);
for (let i = 0; i < 2; i++) { await ev(`(() => { const b = document.querySelector('[data-act="quit"]'); if (b) b.click(); return 1; })()`); await sleep(600); }
await ev(`(() => { const b = document.querySelector('[data-act="menu"]'); if (b) b.click(); return 1; })()`);
await sleep(500);
await ev(`(() => { const b = document.querySelector('[data-act="grimoire"]'); if (b) b.click(); return 1; })()`);
await sleep(800);
await ev(`(() => { const b = document.querySelector('[data-act="grim"][data-tab="mezclas"]'); if (b) b.click(); return 1; })()`);
await sleep(400);
r = await P(`const o = document.getElementById('overlay'); return { st: A.state, tabs: [...o.querySelectorAll('.grim-tabs .tab')].map(t => t.textContent.trim()), items: [...o.querySelectorAll('.shop-item.grim')].map(i => i.querySelector('b').textContent), sub: (o.querySelector('.sub') || {}).textContent };`);
ok(r.st === 'grimoire' && r.tabs.length === 3 && r.items.length === 8, 'Grimorio: pestaña Mezclas con 8 entradas', r);
ok(/de 24 páginas/.test(r.sub || ''), 'Grimorio: 24 páginas con las Mezclas', r.sub);
await shot('grimorio-mezclas');

console.log(fails ? `FALLOS: ${fails}` : 'TODO OK');
