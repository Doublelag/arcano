// Informe de las partidas del ESQUIVADOR (tools/esquivador.js)
// Uso: node tools/esquivador-report.mjs [runs.jsonl ...]   (por defecto tools/esquivador-out/runs.jsonl)
//   TAG=texto  solo las partidas con esa etiqueta     META=fresh|veterano  solo ese progreso
//   START=1    solo partidas completas (por defecto; START=any incluye bancos)
import fs from 'node:fs';

const files = process.argv.slice(2).length ? process.argv.slice(2) : ['E:/PROYECTOS/arcano-snap/tools/esquivador-out/runs.jsonl'];
let runs = files.flatMap(f => fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)));
if (process.env.TAG != null) runs = runs.filter(r => (r.tag || '') === process.env.TAG);
if (process.env.META) runs = runs.filter(r => r.meta === process.env.META);
if ((process.env.START || '1') !== 'any') runs = runs.filter(r => r.rooms.length && r.rooms[0].n === 1);

const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN;
const med = a => { const v = a.filter(Number.isFinite).sort((x, y) => x - y), m = v.length >> 1; return !v.length ? NaN : v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const pct = (a, n) => n ? Math.round(100 * a / n) + '%' : '—';
const f1 = v => Number.isFinite(v) ? (Math.round(v * 10) / 10).toString() : '—';
const mmss = s => Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : '—';
const pad = (s, n) => String(s).padEnd(n);
const TYPES = ['bala', 'contacto', 'trampa', 'jefe', 'bomba', 'otro'];
const PROFS = [...new Set(runs.map(r => r.profile))];
const SCH = ['fire', 'ice', 'bolt', 'poison', 'arcane'].filter(s => runs.some(r => r.school === s));

console.log(`${runs.length} partidas (${files.join(', ')})\n`);

// ---------- tabla por perfil × formas × escuela ----------
console.log('perfil formas escuela  n  victorias  sala muerte(media)  t victoria(med/min)  golpes/partida b/c/t/j/x  vida perdida/partida  curas  tp   esencia');
for (const pr of PROFS) for (const fm of [false, true]) {
  const grp = runs.filter(r => r.profile === pr && r.forms === fm);
  if (!grp.length) continue;
  for (const sc of [...SCH, 'TOTAL']) {
    const g = sc === 'TOTAL' ? grp : grp.filter(r => r.school === sc);
    if (!g.length) continue;
    const w = g.filter(r => r.win), l = g.filter(r => !r.win);
    const hits = TYPES.slice(0, 5).map(k => f1(avg(g.map(r => r.hits[k]))));
    const dmg = avg(g.map(r => TYPES.reduce((s, k) => s + r.dmg[k], 0)));
    const heal = avg(g.map(r => r.heal.carta + r.heal.cofre + r.heal.jefe + r.heal.otras));
    console.log([pad(pr, 6), pad(fm ? 'sí' : 'no', 6), pad(sc, 8), pad(g.length, 3), pad(`${pct(w.length, g.length)} (${w.length}/${g.length})`, 11),
      pad(l.length ? f1(avg(l.map(r => r.room))) : '—', 19), pad(`${mmss(med(w.map(r => r.time)))} / ${mmss(Math.min(...w.map(r => r.time)))}`, 20),
      pad(hits.join('/'), 25), pad(Math.round(dmg), 21), pad(Math.round(heal), 6), pad(f1(avg(g.map(r => r.tp))), 4), f1(avg(g.filter(r => r.ess != null).map(r => r.ess)))].join(' '));
  }
  console.log('');
}

// ---------- dónde se muere y dónde se pierde la vida ----------
for (const pr of PROFS.filter(p => p !== 'dios')) {
  const g = runs.filter(r => r.profile === pr);
  const deaths = {};
  for (const r of g) if (!r.win) deaths[r.room] = (deaths[r.room] || 0) + 1;
  console.log(`[${pr}] muertes por sala: ${Object.entries(deaths).sort((a, b) => b[1] - a[1]).map(([k, v]) => `s${k}×${v}`).join(' ') || 'ninguna'}`);
  const byRoom = {};
  for (const r of g) for (const x of r.rooms) { (byRoom[x.n] = byRoom[x.n] || []).push(x); }
  const rows = Object.entries(byRoom).map(([n, xs]) => ({ n: +n, dmg: avg(xs.map(x => x.dmg)), pctHp: avg(xs.map(x => x.dmg / x.max)), hits: avg(xs.map(x => x.hits)), t: avg(xs.map(x => x.t)), heal: avg(xs.map(x => x.heal)), k: xs.length }));
  const top = rows.slice().sort((a, b) => b.dmg - a.dmg).slice(0, 6);
  console.log(`[${pr}] salas con más vida perdida (media por partida que la juega): ` + top.map(x => `s${x.n} ${Math.round(x.dmg)} (${Math.round(x.pctHp * 100)}% vida máx, ${f1(x.hits)} golpes)`).join(' · '));
  const tot = rows.reduce((s, x) => s + x.dmg * x.k, 0), boss = rows.filter(x => x.n % 5 === 0).reduce((s, x) => s + x.dmg * x.k, 0);
  console.log(`[${pr}] vida perdida en jefes: ${pct(boss, tot)} del total; salas normales: ${f1(avg(rows.filter(x => x.n % 5 && ![4, 9, 14, 19].includes(x.n)).map(x => x.hits)))} golpes/sala de media`);
  console.log(`[${pr}] tiempo medio por sala (s): ` + rows.sort((a, b) => a.n - b.n).map(x => `${x.n}:${Math.round(x.t)}`).join(' '));
  const seen = g.reduce((a, r) => { for (const k in r.seen || {}) a[k] = (a[k] || 0) + r.seen[k]; return a; }, {});
  const nb = (seen.vista || 0) + (seen.tarde || 0) + (seen.despiste || 0);
  console.log(`[${pr}] golpes de bala (incl. jefe): vista ${pct(seen.vista || 0, nb)} · aún sin ver por reacción ${pct(seen.tarde || 0, nb)} · despiste ${pct(seen.despiste || 0, nb)}; esquivas por Parpadeo ${f1(avg(g.map(r => r.dodges)))}/partida; % del combate moviéndose ${Math.round(100 * avg(g.map(r => r.moveFrac)))}%`);
  const src = {};
  for (const r of g) for (const [k, v] of Object.entries(r.src || {})) src[k] = (src[k] || 0) + v;
  const ns = Object.values(src).reduce((a, b) => a + b, 0);
  if (ns) console.log(`[${pr}] de dónde vienen los golpes (balas y toques, sin trampas): ` + Object.entries(src).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v, ns)}`).join(' · '));
  const hpMin = g.filter(r => r.win).map(r => r.minHpPct);
  const gs = {}; let ng = 0; // origen exacto según el juego (hitStats().src; esquivador de la fase 5 en adelante)
  for (const r of g) if (r.gsrc) { ng++; for (const [k, v] of Object.entries(r.gsrc)) gs[k] = (gs[k] || 0) + v; }
  if (ng) console.log(`[${pr}] golpes por origen (juego, por partida): ` + Object.entries(gs).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${f1(v / ng)}`).join(' · '));
  const alt = {}; for (const r of g) for (const k of r.picks.filter(x => x.startsWith('altar:'))) alt[k.slice(6)] = (alt[k.slice(6)] || 0) + 1;
  if (Object.keys(alt).length) console.log(`[${pr}] altares (${[...new Set(g.map(r => r.altar || 'bendicion'))].join('/')}): ` + Object.entries(alt).map(([k, v]) => `${k} ${v}`).join(' · ') + (g.some(r => r.fuente) ? ` · Fuente ${Math.round(avg(g.map(r => r.fuente || 0)))} de vida por partida` : ''));
  console.log(`[${pr}] en las victorias, vida mínima media ${Math.round(100 * avg(hpMin))}% · victorias sin bajar del 50%: ${pct(hpMin.filter(v => v >= 0.5).length, hpMin.length)} · sin recibir golpe en jefes: ${pct(g.filter(r => r.win && r.rooms.filter(x => x.boss).every(x => x.hits === 0)).length, g.filter(r => r.win).length)}`);
  console.log('');
}

// ---------- objetivos ----------
const wr = pr => { const g = runs.filter(r => r.profile === pr); return g.length ? g.filter(r => r.win).length / g.length : NaN; };
const allWins = runs.filter(r => r.win && r.profile !== 'dios');
console.log('OBJETIVO                                   ACTUAL');
if (PROFS.includes('medio')) console.log(`perfil medio gana 40-55% (K1)              ${Math.round(100 * wr('medio'))}%`);
if (PROFS.includes('bueno')) console.log(`perfil bueno gana 80-92% (K1)              ${Math.round(100 * wr('bueno'))}%`);
if (PROFS.includes('novato')) { const g = runs.filter(r => r.profile === 'novato'); console.log(`novato gana 3-10%, llega a la s10 >= 80%   ${Math.round(100 * wr('novato'))}% · s10 ${pct(g.filter(r => r.win || r.room >= 10).length, g.length)} · muere antes de la s6 ${pct(g.filter(r => !r.win && r.room < 6).length, g.length)}`); }
if (allWins.length) console.log(`nadie gana en menos de ~5:00               ${pct(allWins.filter(r => r.time < 300).length, allWins.length)} de las victorias < 5:00 (mín ${mmss(Math.min(...allWins.map(r => r.time)))}, mediana ${mmss(med(allWins.map(r => r.time)))})`);
const god = runs.filter(r => r.profile === 'dios');
if (god.length) for (const fm of [false, true]) {
  const g = god.filter(r => r.forms === fm);
  if (g.length) console.log(`modo dios ${fm ? 'con' : 'sin'} formas: ` + SCH.map(s => { const x = g.filter(r => r.school === s); return `${s} ${mmss(med(x.map(r => r.time)))} (${mmss(Math.min(...x.map(r => r.time)))}-${mmss(Math.max(...x.map(r => r.time)))})`; }).join(' · '));
}
