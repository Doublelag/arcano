// Revisión guardado 2 (http, con cookie): bots no ensucian, cookie de respaldo restaura grim, reset
// Uso: CDP_PORT=9453 CDP_URL=http://localhost:8453/index.html?debug node tools/cdp.mjs 360 640 tools/rev-save2.js
const reload = async () => { await send('Page.reload', { ignoreCache: true }); await sleep(1500); };
const snap = () => ev(`JSON.stringify({ ls: Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])), ck: document.cookie })`);
// progreso con algo de todo
await ev(`(() => {
  const m = { essence: 77, schools: ['fire','ice','bolt'], runs: 12, ach: { reactAll: true, boss1: true, awaken1: true },
    stats: { kills: 900, essenceTotal: 400, reactSeen: { vapor: true, overload: true, freeze: true, combust: true, corrode: true } },
    gear: { inv: [{ uid: 5, base: 'ascuas', r: 2 }], eq: { baston: 5 }, next: 6 },
    grim: { f: 3, w: 1, e: 2, m: 1, n: '1100000000', k: [6, 1, 0, 0], t: 1 } };
  localStorage.setItem('arcano.meta', JSON.stringify(m));
  localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { aff: 1 } }));
})()`);
await reload();
await ev(`document.querySelector('[data-act="settings"]').click()`); await sleep(400);
await ev(`document.querySelector('[data-act="tset"][data-key="fps"]').click()`); await sleep(100); // fuerza saveSettings
await ev(`__arcano.grim()`); await ev(`(() => { __arcano.equip(5); return 1; })()`); // fuerza saveMeta (cookie)
const before = await snap();
const meta0 = await ev(`JSON.stringify([__arcano.grim(), __arcano.ach(), __arcano.gear()])`);
console.log('cookie presente:', /arcano_meta=/.test(JSON.parse(before).ck));
// bots: sim, bench, roomBench
const r1 = await ev(`(() => { const r = __arcano.sim({ school: 'fire', path: ['fire', 'bolt'], seed: 3, fresh: true }); return { win: r.win, form: r.form, room: r.room }; })()`);
console.log('sim', JSON.stringify(r1));
const r2 = await ev(`(() => { const r = __arcano.sim({ school: 'ice', path: ['ice', 'fire'], pact: true, seed: 2 }); return { win: r.win, form: r.form, room: r.room }; })()`);
console.log('sim eclipse', JSON.stringify(r2));
const r3 = await ev(`(() => { const r = __arcano.bench({ room: 20, school: 'poison', path: ['poison', 'ice'], secs: 30 }); return r.killed; })()`);
console.log('bench', r3);
const after = await snap();
const meta1 = await ev(`JSON.stringify([__arcano.grim(), __arcano.ach(), __arcano.gear()])`);
console.log('localStorage+cookie iguales tras bots:', before === after);
if (before !== after) { const a = JSON.parse(before), b = JSON.parse(after); for (const k of new Set([...Object.keys(a.ls), ...Object.keys(b.ls)])) if (a.ls[k] !== b.ls[k]) console.log('  DIFF', k, '\n   antes', a.ls[k], '\n   despues', b.ls[k]); if (a.ck !== b.ck) console.log('  DIFF cookie'); }
console.log('meta en memoria igual:', meta0 === meta1);
await sleep(3500); // avisos de logro/temporizadores pendientes
console.log('tras 3,5 s igual:', before === await snap(), '· aviso de logro visible:', await ev(`document.getElementById('achToast').className`));
// visibilitychange tras los bots (player = null) → no guarda nada raro
// ---------- cookie de respaldo: sin localStorage, ¿vuelve el grim? ----------
await ev(`localStorage.clear()`);
await reload();
console.log('restaurado de la cookie:', await ev(`JSON.stringify([__arcano.grim(), __arcano.ach(), __arcano.gear().inv.length, __arcano.gear().eq])`));
console.log('settings tras borrar localStorage:', await ev(`localStorage.getItem('arcano.settings')`));
