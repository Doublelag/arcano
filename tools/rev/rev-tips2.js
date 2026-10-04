// Revisión: avisos únicos (settings.tips) que se marcan como vistos pero se pierden por la cola de avisos (máx. 3)
// Caso: primera partida (grim vacío, tips vacíos), Piromante, red (a) tras el Gólem y despertar eligiendo Hielo (opuesto).
// Uso: CDP_PORT=9453 node tools/cdp.mjs 360 640 tools/rev/rev-tips.js
const fs = await import('node:fs');
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { anima: 1 } }))`);
await ev(`localStorage.removeItem('arcano.meta')`);
await send('Page.reload', { ignoreCache: true }); await sleep(1500);
const ELX = process.env.EL || 'ice';
await ev(`__arcano.school('fire')`);
await ev('__arcano.god(true)');
await ev(`__arcano.give('atk', 6)`); await ev(`__arcano.give('atkspd', 4)`);
await ev(`__arcano.goto(5)`);
const shown = new Set(); const seenAll = new Set();
let cur = '';
const track = async () => {
  const t = await ev('__arcano.toasts()');
  if (Array.isArray(t)) { for (const x of t) seenAll.add(x.split(' | ')[0]); const c = t[0] && !t[0].startsWith('BANNER') && !t[0].startsWith('NEXT') ? t[0].split(' | ')[0] : ''; const full = JSON.stringify(t.map(s => s.split(" | ")[0])); if (full !== globalThis.__last) { globalThis.__last = full; console.log("   t=", await ev("__arcano.player && Math.round(__arcano.player.anima)"), await ev("__arcano.state"), full); } if (c && c !== cur) { cur = c; shown.add(c); console.log('  aviso en pantalla:', c, '· cola:', JSON.stringify(t.slice(1).map(s => s.split(' | ')[0]))); } }
};
let picked = false;
for (let i = 0; i < 900; i++) {
  const st = await ev('__arcano.state');
  if (st === 'levelup') {
    const ids = await ev(`[...document.querySelectorAll('[data-act="pick"]')].map(c => c.dataset.id)`);
    const k = ids.indexOf('awk:${ELX}'.replace('${ELX}', ELX));
    if (ids.some(x => x.startsWith('awk:'))) { console.log('oferta del despertar:', ids.join(','), '· tips antes', await ev(`localStorage.getItem('arcano.settings')`)); await ev(`__arcano.pick(${k >= 0 ? k : 0})`); picked = true; }
    else { const j = ids.findIndex(x => !['fire','ice','bolt','poison'].includes(x)); await ev('__arcano.pick(' + Math.max(0, j) + ')'); }
  } else if (st === 'play') { await ev('__arcano.step(0.1)'); await track(); }
  else if (st === 'transition') await ev('__arcano.step(0.1)');
  else break;
  if (picked && (await ev('__arcano.player.awak')) >= 1 && i % 1 === 0) { /* sigue unos segundos */ }
  if (picked && (globalThis.__after = (globalThis.__after || 0) + 1) > 120) break;
}
console.log('forma:', JSON.stringify(await ev(`(() => { const f = __arcano.formInfo(); return { form: f.form, aff: f.aff, net: f.net }; })()`)));
console.log('tips guardados:', await ev(`JSON.parse(localStorage.getItem('arcano.settings')).tips`) && JSON.stringify(await ev(`JSON.parse(localStorage.getItem('arcano.settings')).tips`)));
console.log('avisos que llegaron a verse:', [...shown].join(' / '));
console.log('avisos que pasaron por la cola:', [...seenAll].join(' / '));
console.log('¿se vio SOLO 2 ELEMENTOS?', shown.has('SOLO 2 ELEMENTOS POR PARTIDA'));
