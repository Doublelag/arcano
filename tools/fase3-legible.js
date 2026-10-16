// Fase 3 de docs/progresion-spec.md (§4.8 y §10.5): avisos, colores de bala (K9), src de los golpes y contador de los bots.
// Uso: SHOTS=E:/PROYECTOS/arcano/tools/out CDP_PORT=9621 node tools/cdp.mjs 360 640 tools/fase3-legible.js
// Capturas: lg-<bioma>-<escuela>[-gris].png (balas enemigas de las 4 familias + jefes junto a tus hechizos) y lg-aviso-*.png
const fs = await import('node:fs');
const DIR = process.env.SHOTS || 'E:/PROYECTOS/arcano/tools/out/fase3-legible';
fs.mkdirSync(DIR, { recursive: true });
let fails = 0, oks = 0;
const ok = (c, m, x) => { if (c) oks++; else { fails++; console.log('FALLO', m, x === undefined ? '' : JSON.stringify(x)); } };
const P = code => ev(`(() => { const A = __arcano, E = A.enemies, P = A.player; ${code} })()`);
const shot = async name => { await sleep(120); const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${DIR}/${name}.png`, Buffer.from(r.result.data, 'base64')); };
const gray = v => P(`document.querySelectorAll('canvas').forEach(c => c.style.filter = ${v ? "'grayscale(1)'" : "''"}); return 1;`);
for (let i = 0; i < 60 && (await ev(`!!(window.__arcano && window.__arcano.step)`)) !== true; i++) await sleep(150);
await ev('__arcano.flags.freeze = true');
await ev('__arcano.seed(5)');

// ---------- 1. colores (K9): ninguna bala enemiga naranja ni con los colores de las escuelas ----------
const lum = h => { const n = parseInt(h.slice(1), 16), c = [n >> 16, n >> 8 & 255, n & 255].map(v => v / 255); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const hue = h => { const n = parseInt(h.slice(1), 16), [r, g, b] = [n >> 16, n >> 8 & 255, n & 255].map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0; const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (x * 60 + 360) % 360; };
const BOSS = await ev(`Object.fromEntries(Object.entries(window.ArcanoChapters.BOSS_DEFS).map(([k, d]) => [k, d.bullet]))`);
const FAM = { archer: '#ff6b8a', mage: '#ff6f9c', totem: '#ff8ad1', spirit: '#ffb3c8', volatile: '#ff3b6b' };
const ALL = Object.assign({}, FAM, Object.fromEntries(Object.entries(BOSS).map(([k, v]) => ['jefe-' + k, v])));
for (const [k, c] of Object.entries(ALL)) {
  const h = hue(c);
  ok(h >= 300 || h <= 2, `bala ${k} en la familia rojo-rosa-magenta (tono ${Math.round(h)}º)`, c);
  ok(!['#ff8a3d', '#ff7a1a', '#ff8f45', '#ffe45c', '#c77dff', '#b06bff', '#ffcf4a'].includes(c.toLowerCase()), `bala ${k} sin colores de escuela/lava/élite`, c);
}
console.log('luminancia (gris) de las balas:', Object.entries(ALL).map(([k, c]) => `${k} ${lum(c).toFixed(2)}`).join(' · '));

// ---------- 2. capturas: 4 biomas × balas enemigas junto a tus hechizos, en color y en gris ----------
const ROOMS = { pradera: 2, cripta: 7, cristal: 12, volcan: 17 };
async function scene(bio, school, form) {
  await ev(`__arcano.seed(5)`);
  await ev(`__arcano.school('${school}')`);
  await ev(`__arcano.goto(${ROOMS[bio]})`);
  await P(`A.god(true); A.clear(); A.step(2.6); return 1;`); // que pase el rótulo de la sala
  if (form) await ev(`__arcano.awaken('${school === 'arcane' ? 'fire' : school}')`);
  await P(`A.give('front'); A.give('multi'); const x = P.x, y = P.y; const d = A.spawn('slime', x, y - 330); d.speed = 0; d.hp = d.maxHp = 1e9; d.xp = 0; return 1;`);
  await ev('__arcano.step(0.7)');
  // tres filas de balas enemigas por encima de ti, cruzando la estela de tus hechizos
  await P(`const B = ${JSON.stringify(ALL)}, ks = Object.keys(B), x0 = P.x - 150, y0 = P.y - 230;
    ks.forEach((k, i) => { for (let j = 0; j < 3; j++) A.bullets.push({ x: x0 + i * 37, y: y0 + j * 60 + (i % 2) * 18, vx: 0, vy: 0, r: k.startsWith('jefe') ? 8 : k === 'mage' ? 7 : 6, dmg: 0, color: B[k], src: k }); });
    // y que tus hechizos estén a media altura, entre las balas
    for (let i = 0; i < 90 && !A.shots.some(s => s.y < P.y - 150 && s.y > P.y - 230); i++) A.step(1 / 60);
    A.step(0); return 1;`);
  const n = `lg-${bio}-${school}${form ? '-forma' : ''}`;
  await shot(n); await gray(true); await shot(n + '-gris'); await gray(false);
}
for (const bio of Object.keys(ROOMS)) await scene(bio, 'fire');
for (const sc of ['ice', 'bolt', 'poison', 'arcane']) await scene('volcan', sc);
await scene('volcan', 'fire', true);

// ---------- 3. src de los golpes, lastHit y contador (sin modo dios) ----------
await ev(`__arcano.seed(6)`);
await ev(`__arcano.school('fire')`); await ev('__arcano.goto(3)');
await P(`A.clear(); A.step(1 / 60); A.god(false); P.dodge = 0; P.shield = 0; P.maxHp = P.hp = 9999; return 1;`);
const hitBy = async (src, kind) => {
  await P(`P.inv = 0; A.bullets.push({ x: P.x, y: P.y, vx: 0, vy: 0, r: 7, dmg: 5, color: '#ff4d6d', src: '${src}' }); A.step(1 / 60); return 1;`);
  const H = await ev('__arcano.hitStats()');
  ok(H.src[src] >= 1 && H.hitsBy[kind] >= 1 && H.lastHit && H.lastHit.src === src && H.lastHit.room === 3, `golpe ${src} → ${kind}`, H);
};
for (const [s, k] of [['archer', 'bala'], ['mage', 'bala'], ['totem', 'bala'], ['spirit', 'bala'], ['boss:ring', 'jefe'], ['boss:aimed', 'jefe'], ['boss:spiral', 'jefe'], ['volatile', 'afijo'], ['hero:bat', 'heroe']]) await hitBy(s, k);
await P(`P.inv = 0; const e = A.spawn('slime', P.x, P.y); e.speed = 0; A.step(1 / 60); e.dead = true; return 1;`);
let H = await ev('__arcano.hitStats()');
ok(H.src.contact === 1 && H.hitsBy.contacto === 1, 'contacto → contacto', H.src);
ok(H.hits === 10 && H.dmgTaken > 0 && H.rawN >= H.hits, 'hits, dmgTaken y raw', H);
// en modo dios solo cuenta raw (con la invulnerabilidad de 0,7 s imitada)
await P(`A.god(true); A.step(0.75); for (let i = 0; i < 3; i++) { A.bullets.push({ x: P.x, y: P.y, vx: 0, vy: 0, r: 7, dmg: 5, color: '#ff4d6d', src: 'archer' }); A.step(1 / 60); } return 1;`);
const H2 = await ev('__arcano.hitStats()');
ok(H2.hits === H.hits && H2.rawN === H.rawN + 1, 'modo dios: golpes sin cambio y raw +1 en 0,7 s', { h: H2.hits, raw: H2.rawN, raw0: H.rawN });
// trampas: 'trap:*' sigue con su ritmo propio (0,6 s) y cuenta como trampa
await ev(`__arcano.seed(3)`); await ev(`__arcano.school('fire')`);
let lava = [];
for (const r of [16, 17, 18, 19, 20, 12, 13]) { await ev(`__arcano.goto(${r})`); lava = await ev('__arcano.hzCells(4)'); if (lava.length) break; }
if (lava.length) {
  await P(`A.clear(); A.god(false); P.dodge = 0; P.maxHp = P.hp = 9999; P.trapCd = 0; P.inv = 0; P.x = ${lava[0].x}; P.y = ${lava[0].y}; return 1;`);
  await P(`for (let i = 0; i < 40; i++) { P.x = ${lava[0].x}; P.y = ${lava[0].y}; A.step(1 / 60); } return 1;`);
  H = await ev('__arcano.hitStats()');
  ok(H.src['trap:lava'] >= 1 && H.src['trap:lava'] <= 2 && H.hitsBy.trampa === H.src['trap:lava'], 'lava → trap:lava, una vez cada 0,6 s', H.src);
} else console.log('AVISO: sin lava en las salas probadas');
// la partida nueva vacía el contador
await ev(`__arcano.school('fire')`);
H = await ev('__arcano.hitStats()');
ok(H.hits === 0 && H.rawN === 0 && H.lastHit === null, 'newRun vacía el contador', H);

// ---------- 4. avisos del jefe y del espectro ----------
const warn = await ev('JSON.stringify(__arcano.CH.warn)');
ok(warn === '{"aimed":0.25,"early":false}', 'C1_LEGACY: avisos de siempre (0,25 s y destino al final)', warn);
await ev(`__arcano.seed(4)`); await ev(`__arcano.school('fire')`); await ev('__arcano.goto(15)');
const boss = `const b = E.find(e => e.kind === 'boss');`;
await P(`A.god(true); ${boss} b.spawnT = 0; A.step(1 / 60); return 1;`);
const force = pat => P(`${boss} b.pats = ['${pat}']; b.pi = 0; b.state = 'idle'; b.timer = 0; b.frozen = 0; b.slow = 0; P.x = b.x; P.y = b.y + 260; A.step(1 / 60); return { st: b.state, t: b.timer, tp: b.tp || null, x: b.x, y: b.y };`);
let B = await force('aimed');
ok(B.st === 'aimed' && B.t > 0.2 && B.t <= 0.25, 'abanico: 0,25 s en C1_LEGACY', B);
await ev('__arcano.step(0.12)'); await shot('lg-aviso-abanico');
await P(`A.CH.warn.aimed = 0.35; return 1;`);
B = await force('aimed');
ok(B.st === 'aimed' && B.t > 0.3 && B.t <= 0.35, 'abanico: 0,35 s con warn.aimed', B);
B = await force('ring');
ok(B.st === 'ring', 'anillo', B);
await ev('__arcano.step(0.15)'); await shot('lg-aviso-anillo');
B = await force('teleport');
ok(B.st === 'tpOut' && B.tp === null, 'teletransporte de siempre: sin destino previo', B);
await ev('__arcano.step(0.42)');
let B2 = await P(`${boss} return { st: b.state, x: b.x, y: b.y };`);
ok(B2.st === 'tpIn', 'tpIn tras 0,4 s', B2);
await shot('lg-aviso-tp-llegada');
await P(`A.CH.warn.early = true; return 1;`);
B = await force('teleport');
ok(B.st === 'tpOut' && B.tp && Math.hypot(B.tp.x - B.x, B.tp.y - B.y) > 1, 'warn.early: destino elegido al empezar', B);
await ev('__arcano.step(0.2)'); await shot('lg-aviso-tp-destino');
await ev('__arcano.step(0.25)');
B2 = await P(`${boss} return { st: b.state, x: b.x, y: b.y };`);
ok(B2.st === 'tpIn' && Math.abs(B2.x - B.tp.x) < 0.01 && Math.abs(B2.y - B.tp.y) < 0.01, 'warn.early: aparece donde marcó', { B2, tp: B.tp });
// espectro: destino marcado al empezar a desvanecerse
const sp = await P(`${boss} b.dead = true; const s = A.spawn('spirit', P.x + 120, P.y - 200); s.state = 'idle'; s.timer = 0; A.step(1 / 60); return { st: s.state, tp: s.tp || null };`);
ok(sp.st === 'out' && sp.tp, 'espectro con warn.early: destino al empezar', sp);
await ev('__arcano.step(0.15)'); await shot('lg-aviso-espectro');
await ev('__arcano.step(0.25)');
const sp2 = await P(`const s = E.find(e => e.kind === 'spirit'); return { st: s.state, x: s.x, y: s.y };`);
ok(sp2.st === 'in' && sp.tp && Math.abs(sp2.x - sp.tp.x) < 0.01, 'espectro: reaparece en la marca', { sp2, tp: sp.tp });
await P(`A.CH.warn.early = false; A.CH.warn.aimed = 0.25; return 1;`); // el CH está en la caché de chapters.js: se deja como estaba

console.log(fails ? `FALLOS: ${fails} (de ${oks + fails})` : `TODO OK (${oks})`);
