// Fase 2 (docs/progresion-spec.md §8): guardado de capítulos (meta.prog), migración, cookie, settings.chapter y resetProgress
// Uso (http, para que haya cookie): python -m http.server 8611 --bind 127.0.0.1 (en public/) y
//   CDP_PORT=9611 CDP_URL=http://127.0.0.1:8611/index.html?debug node tools/cdp.mjs 360 640 tools/fase2-guardado.js
let fails = 0, oks = 0;
const ok = (c, msg, extra) => { if (c) oks++; else { fails++; console.log('FALLO', msg, extra !== undefined ? JSON.stringify(extra) : ''); } };
// al recargar, la página que se va guarda la meta (visibilitychange): se bloquean sus escrituras para que mande lo preparado
const LOCK = `(() => { if (!window.__si) { window.__si = Storage.prototype.setItem; Storage.prototype.setItem = function () {}; Object.defineProperty(document, 'cookie', { set() {}, get() { return ''; } }); } return 1; })()`;
const reload = async () => { await ev(LOCK); await send('Page.reload', { ignoreCache: true }); await sleep(1300); };
const prog = async () => JSON.parse(await ev('JSON.stringify(__arcano.prog())'));
const ls = k => ev(`localStorage.getItem('arcano.${k}')`);
const setLS = (k, v) => ev(`(window.__si || Storage.prototype.setItem).call(localStorage, 'arcano.${k}', ${JSON.stringify(JSON.stringify(v))})`);
const CK = `Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')`; // la cookie de verdad aunque esté bloqueada
const wipe = async () => { await ev(`(() => { localStorage.clear(); ${CK}.set.call(document, 'arcano_meta=;max-age=0;path=/'); return 1; })()`); await ev(LOCK); };
const cookieMeta = () => ev(`(() => { const m = ${CK}.get.call(document).match(/(?:^|; )arcano_meta=([^;]*)/); return m ? decodeURIComponent(m[1]) : null; })()`);
const save = () => ev(`(() => { __arcano.prog(__arcano.prog()); return 1; })()`); // prog(p) guarda la meta

console.log('chapters.js:', await ev('!!window.ArcanoChapters'), '· http:', await ev('location.protocol'));

// ---------- 1. Guardado nuevo vacío ----------
await wipe(); await reload();
let p = await prog();
ok(JSON.stringify(p) === JSON.stringify({ n: 1, d: 0, h: 0, st: '00000000', b: {}, t: -1, af: 0 }), 'vacío: prog por defecto', p);
ok(JSON.stringify(await ev('__arcano.settingsChapter()')) === '{"id":1,"hero":false}', 'vacío: settings.chapter C1 Normal');

// ---------- 2. Guardado antiguo (v1.0, sin prog): victorias + arcano.best ----------
await wipe();
await setLS('meta', { essence: 50, schools: ['fire', 'ice', 'bolt'], runs: 9, ach: { firstWin: true }, stats: { wins: 3, best: { fire: 21, ice: 15, bolt: 4 }, winsBy: { fire: 3 } } });
await setLS('best', { room: 20, lvl: 14, win: true, school: 'fire' });
await setLS('settings', { tutorial: true, chapter: { id: 2, hero: false } });
await reload();
p = await prog();
ok(p.d === 1 && p.n === 2 && p.h === 0, 'antiguo con victorias: C1 completado, n = 2', p);
ok(p.st === '30000000', 'antiguo con victorias: ★★★ del C1', p.st);
ok(p.b['1'] === '20.20.14.1.0.fire', 'antiguo: arcano.best → prog.b["1"]', p.b);
ok(Object.keys(p.b).length === 1, 'antiguo: sin récords de más', p.b);
ok(JSON.parse(await ls('best')).room === 20, 'antiguo: arcano.best no se borra');
ok(await ev('__arcano.ach().length') === 1 && await ev('__arcano.meta.essence') === 50, 'antiguo: sin esencia retroactiva por la ★★★');
ok(JSON.stringify(await ev('__arcano.settingsChapter()')) === '{"id":1,"hero":false}', 'antiguo: settings.chapter en un capítulo que no existe → C1', await ev('__arcano.settingsChapter()'));
ok(JSON.parse(await ls('settings')).chapter.id === 1, 'antiguo: la corrección del capítulo se guarda');
// se guarda prog en cuanto se guarda la meta, y S.best sigue en el formato de siempre
await save();
const lsMeta = JSON.parse(await ls('meta'));
ok(lsMeta.prog && lsMeta.prog.st === '30000000', 'antiguo: prog guardado en localStorage', lsMeta.prog);
ok(lsMeta.stats.best.fire === 21 && lsMeta.stats.best.ice === 15, 'antiguo: S.best intacto');

// ---------- 3. Antiguo sin victorias ni arcano.best: estrellas por S.best y récord rehecho ----------
for (const [best, st, rec] of [[{ ice: 9 }, '10000000', '9.20.0.0.0.ice'], [{ fire: 14, ice: 6 }, '20000000', '14.20.0.0.0.fire'], [{ bolt: 3 }, '00000000', '3.20.0.0.0.bolt'], [{}, '00000000', undefined]]) {
  await wipe();
  await setLS('meta', { essence: 0, runs: 2, stats: { wins: 0, best } });
  await reload();
  p = await prog();
  ok(p.st === st && p.d === 0 && p.n === 1, `antiguo S.best ${JSON.stringify(best)}: estrellas ${st}`, p);
  ok(p.b['1'] === rec, `antiguo S.best ${JSON.stringify(best)}: récord ${rec}`, p.b);
}

// ---------- 4. Guardado nuevo: ida y vuelta (localStorage y cookie) ----------
await wipe(); await reload();
const P1 = { n: 2, d: 1, h: 0, st: '32100000', b: { 1: '20.20.15.1.251.ice', 2: '7.15.6.0.0.fire' }, t: 2, af: 5 };
await ev(`__arcano.prog(${JSON.stringify(P1)})`);
await reload();
p = await prog();
ok(JSON.stringify(p) === JSON.stringify(P1), 'nuevo: ida y vuelta por localStorage', p);
const ck = await cookieMeta();
ok(ck && JSON.parse(ck).prog === '2.1.0.32100000.2.5|1:20.20.15.1.251.ice,2:7.15.6.0.0.fire', 'nuevo: prog compacto en la cookie', ck && JSON.parse(ck).prog);
await ev('localStorage.clear()'); await reload();
p = await prog();
ok(JSON.stringify(p) === JSON.stringify(P1), 'nuevo: restaurado desde la cookie', p);

// ---------- 5. Guardados rotos ----------
const broken = [
  [{ n: 'x', d: -5, h: 1.5, st: '99', b: { 1: '<script>', zz: '1.2.3.0.0.fire', '2h': '5.15.3.0.0.fire', 3: 7 }, t: 100, af: 'a' }, { n: 1, d: 0, h: 1, st: '00000000', b: { '2h': '5.15.3.0.0.fire' }, t: -1, af: 0 }], // 1,5 → 1
  ['basura|1:no,,:x', { n: 1, d: 0, h: 0, st: '00000000', b: {}, t: -1, af: 0 }],
  [{ n: 9, d: 4095, h: 300, st: '3333333', b: null, t: 3, af: 256 }, { n: 4, d: 255, h: 44, st: '00000000', b: {}, t: 3, af: 0 }],
  [[1, 2, 3], { n: 1, d: 0, h: 0, st: '00000000', b: {}, t: -1, af: 0 }],
];
for (const [bad, want] of broken) {
  await wipe();
  await setLS('meta', { essence: 10, stats: { wins: 0, best: {} }, prog: bad });
  await reload();
  p = await prog();
  ok(JSON.stringify(p) === JSON.stringify(want), 'roto: ' + JSON.stringify(bad).slice(0, 50), p);
  ok(await ev('__arcano.state') === 'menu', 'roto: el juego arranca');
}
// prog null / numérico = guardado sin prog: migra
await wipe();
await setLS('meta', { stats: { wins: 1, best: { fire: 21 } }, prog: null });
await reload();
p = await prog();
ok(p.d === 1 && p.st === '30000000' && p.b['1'] === '20.20.0.1.0.fire', 'prog null: migra desde stats', p);
// cookie con prog roto
await wipe();
await ev(`(() => { ${CK}.set.call(document, 'arcano_meta=' + encodeURIComponent(JSON.stringify({ essence: 3, stats: { wins: 0, best: {} }, prog: '7.x.y.zz|1:20.20' })) + ';path=/'); return 1; })()`);
await reload();
p = await prog();
ok(JSON.stringify(p) === JSON.stringify({ n: 4, d: 0, h: 0, st: '00000000', b: {}, t: -1, af: 0 }) && await ev('__arcano.meta.essence') === 3, 'cookie con prog roto', p);

// ---------- 6. settings.chapter cerrado ----------
for (const [pr, sel, want] of [
  [{ d: 0 }, { id: 1, hero: true }, { id: 1, hero: false }],
  [{ d: 0 }, { id: 3, hero: false }, { id: 1, hero: false }],
  [{ d: 3, n: 3 }, { id: 2, hero: false }, { id: 1, hero: false }], // C2 abierto pero aún no existe en chapters.js
  [{ d: 3, n: 3 }, { id: 1, hero: true }, { id: 1, hero: true }],   // Héroe abierto (C2 completado) y C1 Normal completado
  [{ d: 0 }, 'x', { id: 1, hero: false }],
  [{ d: 0 }, { id: 1.5, hero: 'si' }, { id: 1, hero: false }],
]) {
  await wipe();
  await setLS('meta', { stats: { wins: 0, best: {} }, prog: Object.assign({ n: 1, h: 0, st: '00000000', b: {}, t: -1, af: 0 }, pr) });
  await setLS('settings', { tutorial: true, chapter: sel });
  await reload();
  const got = await ev('__arcano.settingsChapter()');
  ok(JSON.stringify(got) === JSON.stringify(want), `settings.chapter ${JSON.stringify(sel)} con d=${pr.d}`, got);
}
// newRun respeta settings.chapter (Héroe abierto) y no deja jugar uno cerrado
await setLS('meta', { stats: { wins: 0, best: {} }, prog: { n: 3, d: 3, h: 0, st: '00000000', b: {}, t: -1, af: 0 } });
await setLS('settings', { tutorial: true, chapter: { id: 1, hero: true } });
await reload();
await ev(`(() => { __arcano.school('fire'); return 1; })()`);
ok(await ev('__arcano.hero') === true && await ev('__arcano.chapterId') === 1, 'newRun: Héroe 1 abierto → partida Héroe');
await ev(`(() => { __arcano.chapter(1, true, false); return 1; })()`);
await setLS('meta', { stats: {}, prog: { d: 0 } });
await reload();
await ev(`(() => { __arcano.chapter(1, true, false); __arcano.school('fire'); return 1; })()`); // sin forzar y cerrado: C1 Normal
ok(await ev('__arcano.hero') === false, 'newRun: Héroe cerrado → C1 Normal');
await ev(`(() => { __arcano.chapter(1, true); __arcano.school('fire'); return 1; })()`); // ?debug forzado
ok(await ev('__arcano.hero') === true, 'newRun: ?debug forzado → Héroe');
await ev(`(() => { __arcano.chapter(1, false); return 1; })()`);

// ---------- 7. Final de partida: estrellas al llegar, victoria, récord y S.best ----------
await wipe(); await setLS('settings', { tutorial: true }); await reload();
await ev(`(() => { __arcano.school('ice'); __arcano.god(true); __arcano.goto(7); return 1; })()`);
p = await prog();
ok(p.st === '10000000', 'llegar a la s7: ★', p.st);
ok(JSON.parse(await ls('meta')).prog.st === '10000000', 'la ★ se guarda al llegar');
await ev(`__arcano.goto(14)`);
ok((await prog()).st === '20000000', 'llegar a la s14: ★★');
await ev(`__arcano.goto(20)`);
for (let i = 0; i < 40 && await ev('__arcano.state') !== 'win'; i++) {
  const st = await ev('__arcano.state');
  if (st === 'levelup' || st === 'altar') await ev('__arcano.pick(0)');
  else await ev(`(() => { __arcano.clear(); return __arcano.step(0.5); })()`);
}
ok(await ev('__arcano.state') === 'win', 'victoria en la s20', await ev('__arcano.state'));
p = await prog();
ok(p.d === 1 && p.n === 2 && p.st === '30000000', 'victoria: C1 completado, n = 2, ★★★', p);
ok(/^20\.20\.\d+\.1\.\d+\.ice$/.test(p.b['1'] || ''), 'victoria: récord del C1', p.b);
const rp = await ev('__arcano.runProg()');
ok(rp && rp.stars === 3 && rp.first === true && rp.record === true && rp.unlock.length === 0, 'victoria: runProg (★★★, primera vez, sin C2 que desbloquear)', rp);
ok(await ev('__arcano.meta.stats.best.ice') === 21, 'victoria: S.best del C1 sigue siendo 21');
ok(JSON.parse(await ls('best')).ch === 1, 'victoria: arcano.best con capítulo');
// una derrota peor no pisa el récord ni las estrellas
const rec1 = p.b['1'];
await ev(`(() => { __arcano.school('ice'); __arcano.goto(3); return 1; })()`);
await ev(`(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })); return 1; })()`);
await sleep(500);
await ev(`document.querySelector('[data-act="quit"]').click()`); await sleep(500);
await ev(`document.querySelector('[data-act="quit"]').click()`); await sleep(300);
ok(await ev('__arcano.state') === 'over', 'abandonar: fin de partida', await ev('__arcano.state'));
p = await prog();
ok(p.b['1'] === rec1 && p.st === '30000000' && p.d === 1, 'derrota peor: récord y estrellas intactos', p);
ok(await ev('__arcano.meta.stats.best.ice') === 21, 'derrota peor: S.best intacto');
const rp2 = await ev('__arcano.runProg()');
ok(rp2 && rp2.stars === 0 && rp2.record === false && !rp2.first, 'derrota: runProg vacío', rp2);

// ---------- 8. Los bots no tocan prog ----------
const before = await ls('meta');
await ev(`(() => { __arcano.sim({ school: 'fire', seed: 2, fresh: true }); return 1; })()`);
await ev(`(() => { __arcano.bench({ room: 10, school: 'ice', secs: 10 }); return 1; })()`);
ok(await ls('meta') === before, 'bots: localStorage intacto');
ok(JSON.stringify(await prog()) === JSON.stringify(p), 'bots: prog en memoria intacto');

// ---------- 9. resetProgress ----------
await setLS('settings', { tutorial: true, chapter: { id: 1, hero: true }, seenAfx: { veloz: 1 }, skin: 2 });
await reload();
await ev(`document.querySelector('[data-act="settings"]').click()`); await sleep(500);
await ev(`document.querySelector('[data-act="reset"]').click()`); await sleep(500);
await ev(`document.querySelector('[data-act="reset"]').click()`); await sleep(300);
p = await prog();
ok(JSON.stringify(p) === JSON.stringify({ n: 1, d: 0, h: 0, st: '00000000', b: {}, t: -1, af: 0 }), 'reset: prog por defecto', p);
const sAfter = JSON.parse(await ls('settings'));
ok(JSON.stringify(sAfter.chapter) === '{"id":1,"hero":false}' && JSON.stringify(sAfter.seenAfx) === '{}' && sAfter.skin === 0, 'reset: settings.chapter, seenAfx y skin', sAfter);
ok(await ls('best') === null, 'reset: arcano.best borrado');
await reload();
p = await prog();
ok(p.d === 0 && p.st === '00000000' && !Object.keys(p.b).length, 'reset: tras recargar no vuelve a migrar', p);

// ---------- 10. Cookie: 60 objetos + Grimorio lleno + 8 récords + todos los logros ≤ 3800 ----------
const bigMeta = recs => `(() => {
  const bases = ['ascuas','escarcha','tormenta','gemelo','peregrino','carmesi','zarzas','sombras','rosa','enjambre','marea','escorpion','buho','arcano','viento','dragon'];
  const inv = []; for (let i = 0; i < 60; i++) inv.push({ uid: 9000 + i * 7, base: bases[i % 16], r: i % 5 });
  const ach = {}; for (const id of ['firstUlt','boss1','room10','boss2','boss3','boss4','firstWin','reactAll','react50','untouchable','lvl15','phoenix','elites','kills1000','allSchools','speedrun','winAll','chests','pact','awaken1','awaken2','hybrids','eclipse','forms10','formWins','mixes8','cap2','cap3','cap4','heroe1','heroeTodo','afijos']) ach[id] = true;
  const sch = { fire: 449, ice: 399, bolt: 349, poison: 299, arcane: 199 }, wins = { fire: 1200, ice: 999, bolt: 870, poison: 640, arcane: 510 };
  const b = {}; for (const k of ${JSON.stringify(recs)}) b[k] = '20.20.99.1.99999.poison';
  const m = { essence: 123456, up: { vida: 5, poder: 5, mana: 4, sabio: 3, suerte: 3, paso: 3, fenix: 1 }, schools: ['fire','ice','bolt','poison','arcane'], runs: 15000, ach,
    gear: { inv, eq: { baston: inv[0].uid, tunica: inv[4].uid, anillo: inv[8].uid, amuleto: inv[12].uid }, next: 9000 + 60 * 7 },
    stats: { kills: 4123456, wins: 4210, bosses: 34567, elites: 234567, reactions: 8123456, ults: 456789, time: 1234567.891234, essenceTotal: 987654, chests: 23456, pacts: 12345, best: sch, winsBy: wins,
      reactSeen: { vapor: true, overload: true, freeze: true, combust: true, corrode: true, necro: true } },
    grim: { f: 1023, w: 1023, e: 1023, m: 255, n: '9999999999', k: [41234, 4123, 53214, 4012], t: 9 },
    prog: { n: 4, d: 15, h: 15, st: '33333333', b, t: 63, af: 63 } };
  (window.__si || Storage.prototype.setItem).call(localStorage, 'arcano.meta', JSON.stringify(m));
  return 1;
})()`;
await wipe();
await ev(bigMeta(['1', '1h', '2', '2h', '3', '3h', '4', '4h']));
await reload();
const ck1 = await ev(`(() => { const v = __arcano.cookie(); const d = v && JSON.parse(decodeURIComponent(v)); return { len: v.length, gear: !!(d && d.gear), inv: d && d.gear ? d.gear.inv.split(',').length : 0, prog: d && d.prog }; })()`);
console.log('cookie lleno (60 objetos, Grimorio lleno, 8 récords, 32 logros):', JSON.stringify(ck1));
ok(ck1.len > 0 && ck1.len <= 3800 && ck1.gear && ck1.inv === 60 && ck1.prog.split('|')[1].split(',').length === 8, 'cookie ≤ 3800 con todo dentro', ck1.len);
await save();
const real = await cookieMeta();
ok(real && JSON.parse(real).prog === ck1.prog, 'cookie real escrita con prog');
// sin localStorage: todo vuelve desde la cookie
await ev('localStorage.clear()'); await reload();
p = await prog();
ok(p.n === 4 && p.d === 15 && p.h === 15 && p.st === '33333333' && Object.keys(p.b).length === 8 && p.t === 63 && p.af === 63, 'cookie llena: prog restaurado', p);
ok(await ev('__arcano.gear().inv.length') === 60, 'cookie llena: equipo restaurado');
// orden de recorte: si no cabe, sale primero el equipo y después prog.b (nunca la cabecera de prog)
const cut = await ev(`(() => {
  const M = __arcano.meta, keep = M.stats.reactSeen, out = [];
  let last = '';
  for (let n = 0; n < 400; n++) {
    M.stats.reactSeen = Object.assign({}, keep); for (let i = 0; i < n; i++) M.stats.reactSeen['r' + i] = 1;
    const v = __arcano.cookie(), d = v && JSON.parse(decodeURIComponent(v));
    const tag = !v ? 'nada' : (d.gear ? 'equipo+' : '') + (d.prog.includes('|') ? 'récords' : 'cabecera:' + d.prog);
    if (tag !== last) { out.push({ n, len: v.length, tag }); last = tag; }
    if (!v) break;
  }
  M.stats.reactSeen = keep;
  return out;
})()`);
console.log('recorte:', JSON.stringify(cut));
ok(cut.length === 4 && cut[0].tag === 'equipo+récords' && cut[1].tag === 'récords' && cut[2].tag === 'cabecera:4.15.15.33333333.63.63' && cut[3].tag === 'nada',
  'recorte: primero sale el equipo, después los récords; la cabecera de prog nunca', cut);
// sin récords en la cookie: se rehacen desde S.best al cargar
await wipe();
await ev(`(() => { ${CK}.set.call(document, 'arcano_meta=' + encodeURIComponent(JSON.stringify({ essence: 3, stats: { wins: 2, best: { fire: 21, ice: 12 } }, prog: '2.1.0.30000000.-1.0' })) + ';path=/'); return 1; })()`);
await reload();
p = await prog();
ok(p.b['1'] === '20.20.0.1.0.fire' && p.d === 1 && p.st === '30000000', 'cookie sin récords: se rehacen desde S.best', p);

console.log(`\n${fails ? 'FALLOS: ' + fails : 'TODO OK'} (${oks} comprobaciones)`);
