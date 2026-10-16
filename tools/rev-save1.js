// Revisión guardado 1: tamaño de la cookie con 60 objetos (uids realistas) y grim lleno
// Uso: CDP_PORT=9453 node tools/cdp.mjs 360 640 tools/rev-save1.js
const reload = async () => { await send('Page.reload', { ignoreCache: true }); await sleep(1500); };
const build = (uid0, timeVal, extra) => `(() => {
  const bases = ['ascuas','escarcha','tormenta','gemelo','peregrino','carmesi','zarzas','sombras','rosa','enjambre','marea','escorpion','buho','arcano','viento','dragon'];
  const inv = []; for (let i = 0; i < 60; i++) inv.push({ uid: ${uid0} + i * 7, base: bases[i % 16], r: i % 5 });
  const ach = {}; for (const id of ['firstUlt','boss1','room10','boss2','boss3','boss4','firstWin','reactAll','react50','untouchable','lvl15','phoenix','elites','kills1000','allSchools','speedrun','winAll','chests','pact','awaken1','awaken2','hybrids','eclipse','forms10','formWins','mixes8']) ach[id] = true;
  const sch = { fire: 21, ice: 21, bolt: 21, poison: 21, arcane: 21 }, wins = { fire: 120, ice: 99, bolt: 87, poison: 64, arcane: 51 };
  const m = { essence: 12345, up: { vida: 5, poder: 5, mana: 4, sabio: 3, suerte: 3, paso: 3, fenix: 1 }, schools: ['fire','ice','bolt','poison','arcane'], runs: 1500, ach,
    gear: { inv, eq: { baston: inv[0].uid, tunica: inv[4].uid, anillo: inv[8].uid, amuleto: inv[12].uid }, next: ${uid0} + 60 * 7 },
    stats: { kills: 412345, wins: 421, bosses: 3456, elites: 23456, reactions: 812345, ults: 45678, time: ${timeVal}, essenceTotal: 98765, chests: 2345, pacts: 1234, best: sch, winsBy: wins,
      reactSeen: { vapor: true, overload: true, freeze: true, combust: true, corrode: true, necro: true } },
    grim: { f: 1023, w: 1023, e: 31, m: 255, n: '9999999999', k: [4123, 412, 5321, 401], t: 9 } ${extra || ''} };
  localStorage.setItem('arcano.meta', JSON.stringify(m));
  return true;
})()`;
const measure = () => ev(`(() => { const v = __arcano.cookie(); const d = v && JSON.parse(decodeURIComponent(v)); return { len: v.length, inv: d && d.gear && typeof d.gear.inv === 'string' ? d.gear.inv.split(',').length : 0, hasGear: !!(d && d.gear), grim: d && d.grim, ckNow: (document.cookie.match(/arcano_meta=([^;]*)/) || [, ''])[1].length }; })()`);
for (const [uid0, t] of [[900, '1234567.891234'], [1000, '98765.43333333287'], [3000, '387654.1166666712'], [9000, '387654.1166666712']]) {
  await ev(build(uid0, t));
  await reload();
  console.log('uid0', uid0, 'time', t, JSON.stringify(await measure()));
}
// cuánto ocupaba antes (sin grim ni los 7 logros nuevos)
await ev(build(1000, '98765.43333333287'));
await reload();
console.log('sin grim ni 7 logros nuevos (estimado):', await ev(`(() => { const v = __arcano.cookie(); const d = JSON.parse(decodeURIComponent(v)); delete d.grim; for (const k of ['awaken1','awaken2','hybrids','eclipse','forms10','formWins','mixes8']) delete d.ach[k]; return encodeURIComponent(JSON.stringify(d)).length; })()`));
// guardar y ver qué queda en la cookie real
await ev(`(() => { document.querySelector('[data-act="settings"]').click(); return 1; })()`);
await sleep(400);
await ev(`(() => { const t = document.querySelector('[data-act="tset"][data-key="fps"]'); t.click(); return 1; })()`);
console.log('cookie real tras guardar:', await ev(`(document.cookie.match(/arcano_meta=([^;]*)/) || [, ''])[1].length`));
