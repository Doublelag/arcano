// Fase 2: los 5 definitivos combinados lanzados en la sala 18, con captura en su momento álgido
// Uso: SHOTS=dir CDP_PORT=9435 node tools/cdp.mjs 360 640 tools/fase2-ults.js
// LOWQ=1: lo mismo en calidad baja
const fs = await import('node:fs');
const DIR = process.env.SHOTS || '.', LOW = !!process.env.LOWQ, TAG = LOW ? '-baja' : '';
let fails = 0;
const ok = (c, msg, x) => { console.log((c ? 'OK   ' : 'FAIL ') + msg + (x !== undefined ? '  ' + JSON.stringify(x) : '')); if (!c) fails++; };
const P = code => ev(`(() => { const A = __arcano, E = A.enemies, P = A.player; ${code} })()`);
const shot = async name => { await sleep(120); const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${DIR}/${name}${TAG}.png`, Buffer.from(r.result.data, 'base64')); };
if (LOW) {
  await ev(`localStorage.setItem('arcano.settings', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('arcano.settings') || '{}'), { quality: 'baja' })))`);
  await send('Page.reload'); await sleep(1500);
}
// partida con dos despertares, sala 18, enemigos ya en pie, quietos un momento y con mucha vida
const setup = async (school, path, pact) => {
  await ev(`__arcano.school('${school}')`);
  if (pact) await ev('__arcano.pact()');
  for (const el of path) await ev(`__arcano.awaken('${el}')`);
  await ev('__arcano.goto(18)');
  await ev('__arcano.god(true)');
  await P(`E.forEach((e, i) => { e.spawnT = 0; e.hp = e.maxHp = 4000; }); P.x = 270; P.y = 820; return E.length;`);
  await ev('__arcano.step(2.2)'); // que se acerquen, disparen un poco y se vaya el rótulo de la sala
};

await ev('__arcano.flags.freeze = true');
await ev('__arcano.seed(11)');

// ---------- SOL CAUTIVO (Plasma, núcleo fuego: Linaje) ----------
console.log('--- Sol cautivo');
await setup('fire', ['fire', 'bolt']);
let r = await P(`return { form: P.form, ...A.ults(), atk: P.atk, info: A.formInfo().linaje };`);
ok(r.form === 'plasma' && r.key === 'sun' && r.name === 'Sol cautivo' && r.icon === '🌞', 'Plasma → Sol cautivo (clave, nombre e icono)', { form: r.form, key: r.key, name: r.name, icon: r.icon });
ok(r.info === true, 'Piromante en Plasma tiene Linaje', r.info);
r = await P(`const hp0 = E.map(e => e.hp); A.ult(); const u = A.ults(); A.step(0.5); const mid = A.ults(); return { u: u.sing, mid: mid.sing, hit: E.filter((e, i) => e.hp < hp0[i]).length, n: E.length };`);
ok(r.u && r.u.kind === 'sun' && r.u.n === 8, 'se crea la esfera con 8 rayos', r.u);
ok(r.mid && r.mid.n < 8 && r.hit > 0, 'a mitad lanza rayos y daña', r);
await ev('__arcano.step(0.25)');
await shot('ult-sol-cautivo');
r = await P(`const hp0 = E.map(e => e.hp), bul = A.bullets.length; A.step(0.6); return { sing: A.ults().sing, burn: E.filter(e => e.burn > 0).length, n: E.length, dmg: E.reduce((s, e, i) => s + Math.max(0, hp0[i] - e.hp), 0), bul0: bul };`);
ok(!r.sing && r.burn > 0 && r.dmg > 0, 'al final estalla, quema y desaparece', r);
// Linaje: daño de un rayo = 2,2 × atk × 1,2
r = await P(`A.shots.length = 0; E.forEach((e, i) => { e.x = 200 + (i % 4) * 30; e.y = 460 + Math.floor(i / 4) * 30; e.hp = e.maxHp = 1e6; e.frozen = 0; e.corrode = 0; e.burn = e.burnDps = e.poisonDps = 0; e.frzImm = 9; });
  P.cd = 99; P.mana = 100; A.ult(); A.step(0.07); return { d: E.reduce((s, e) => s + 1e6 - e.hp, 0), atk: P.atk };`);
ok(Math.abs(r.d - 2.2 * r.atk * 1.2) < 0.05, 'rayo del Sol cautivo = 2,2 × atk × 1,2 (Linaje)', r);
await ev('__arcano.step(1.2)');

// ---------- CORTINA BOREAL (Aurora, núcleo rayo) ----------
console.log('--- Cortina boreal');
await setup('bolt', ['bolt', 'ice']);
r = await P(`return { form: P.form, ...A.ults() };`);
ok(r.form === 'aurora' && r.key === 'curtain' && r.name === 'Cortina boreal', 'Aurora → Cortina boreal', { form: r.form, key: r.key });
r = await P(`A.ult(); const c = A.ults().curtains; A.step(0.3); const fr = E.filter(e => e.frozen > 0).length; return { n: c.length, d: c.map(x => +x.d.toFixed(2)), fr };`);
ok(r.n === 5 && r.d.join() === '0,0.2,0.4,0.6,0.8', '5 columnas escalonadas cada 0,2 s', r);
await ev('__arcano.step(0.12)');
await shot('ult-cortina-boreal');
r = await P(`A.step(1); const fr = E.filter(e => e.frozen > 0 || e.dead).length; return { fr, n: E.length, left: A.ults().curtains.length };`);
ok(r.fr === r.n && r.left === 0, 'al pasar las 5, todos congelados y no queda ninguna', r);
// borra balas en su columna
r = await P(`E.forEach(e => { e.frozen = 9; e.x = 60; e.y = 160; }); const b = A.bullets; b.length = 0; for (let i = 0; i < 10; i++) b.push({ x: 40 + i * 48, y: 600, vx: 0, vy: 0, r: 7, dmg: 5, color: '#ff6a3d' }); P.mana = 100; A.ult(); A.step(1.2); return A.bullets.length;`);
ok(r === 0, 'las columnas borran las balas', r);
// jefe: congelación forzada de 0,8 s (con la DR)
await ev('__arcano.goto(20)'); await ev('__arcano.god(true)');
r = await P(`const b = E.find(e => e.kind === 'boss'); b.spawnT = 0; b.hp = b.maxHp = 1e6; b.frzImm = 5; b.x = 270; b.y = 400; P.mana = 100; A.ult(); A.step(1.0); return { frozen: +b.frozen.toFixed(2), frzImm: +b.frzImm.toFixed(2) };`);
ok(r.frozen > 0 && r.frozen <= 0.8, 'el jefe se congela 0,8 s aunque fuera inmune (fuerza)', r);
await ev('__arcano.step(2)');

// ---------- INVIERNO NEGRO (Mortaja) ----------
console.log('--- Invierno negro');
await setup('ice', ['ice', 'poison']);
r = await P(`return { form: P.form, ...A.ults() };`);
ok(r.form === 'mortaja' && r.key === 'fog' && r.name === 'Invierno negro', 'Mortaja → Invierno negro', { form: r.form, key: r.key });
r = await P(`E.forEach(e => { e.poisonDps = 0; }); A.ult(); A.step(0.3); const f = A.ults().fog;
  // bala de prueba en una columna sin rocas (rejilla de 12×20 celdas de 40 px desde (30, 128))
  let col = 0; for (let c = 0; c < 12; c++) { let free = true; for (let rr = 3; rr < 8; rr++) if (A.grid[rr * 12 + c]) free = false; if (free) { col = c; break; } }
  const bx = 30 + col * 40 + 20, b = A.bullets; b.length = 0; b.push({ x: bx, y: 260, vx: 0, vy: 200, r: 7, dmg: 1, color: '#ff6a3d' }); const o = b[0]; A.step(0.5); const dy = o.y - 260;
  return { f, poison: E.filter(e => e.poisonDps >= f.atk - 1e-6).length, slow: E.filter(e => e.slow > 0).length, n: E.length, dy };`);
ok(r.f && r.f.t > 3, 'niebla de 4 s', r.f);
ok(r.poison === r.n && r.slow === r.n, 'todos envenenados (1×atk) y lentos', r);
ok(r.dy != null && Math.abs(r.dy - 50) < 6, 'las balas enemigas van a la mitad (200 px/s → 50 px en 0,5 s)', r.dy);
await shot('ult-invierno-negro');
// justo antes del final y justo después: cada enemigo recibe al menos el mínimo de NECROSIS (1,5×atk)
r = await P(`A.step(3.12); const left = A.ults().fog.t, hp0 = E.map(e => e.hp); A.step(0.12); const f = A.ults().fog;
  return { left: +left.toFixed(2), f, atk: P.atk, n: E.length, dmg: E.map((e, i) => Math.round(hp0[i] - e.hp)), kind: E.map(e => e.kind), self: E.map(e => !!e.selfBlast) };`);
// un diablillo que se inmola junto al mago (modo dios) muere sin recibir daño: no cuenta (fallaba al azar)
ok(r.left < 0.12 && !r.f && r.dmg.every((d, i) => r.self[i] || d >= 1.5 * r.atk - 0.5), 'al acabar, NECROSIS en todos (≥ 1,5×atk cada uno)', r);

// ---------- LLUVIA DE AZUFRE (Azufre, núcleo veneno) ----------
console.log('--- Lluvia de azufre');
await setup('poison', ['poison', 'fire']);
r = await P(`return { form: P.form, ...A.ults() };`);
ok(r.form === 'azufre' && r.key === 'sulfur' && r.name === 'Lluvia de azufre', 'Azufre → Lluvia de azufre', { form: r.form, key: r.key });
r = await P(`A.ult(); const m = A.ults().meteors; return { n: m.length, d: m.map(x => +x.d.toFixed(2)), r: m[0].r, pool: m.every(x => x.pool) };`);
ok(r.n === 6 && r.d.join() === '0,0.12,0.24,0.36,0.48,0.6' && r.r === 85 && r.pool, '6 bolas (r85) una cada 0,12 s', r);
await ev('__arcano.step(0.52)');
await shot('ult-lluvia-azufre');
r = await P(`A.step(0.8); return { left: A.ults().meteors.length, pools: A.ults().pools, fp: E.filter(e => e.burn > 0 && e.poisonDps > 0).length, n: E.length };`);
ok(r.left === 0 && r.pools >= 1 && r.pools <= 6 && r.fp > 0, 'caen todas: charcos de azufre y fuego + veneno', r);
// pocos enemigos: repiten objetivo
r = await P(`E.forEach((e, i) => { if (i) e.dead = true; }); A.step(0.05); P.mana = 100; A.ult(); const m = A.ults().meteors; return { n: m.length, live: A.enemies.filter(e => !e.dead).length };`);
ok(r.n === 6 && r.live >= 1, 'con 1 enemigo caen igualmente las 6 (pueden llegar refuerzos: fase 4)', r);
await ev('__arcano.step(1.5)');

// ---------- SOL NEGRO (Eclipse con pacto) ----------
console.log('--- Sol negro');
await setup('fire', ['fire', 'ice'], true);
r = await P(`return { form: P.form, ...A.ults() };`);
ok(r.form === 'eclipse' && r.key === 'void' && r.name === 'Sol negro', 'Eclipse → Sol negro', { form: r.form, key: r.key });
// los tótems no se mueven (como con la Singularidad); el resto, a menos de 400 px, se acerca
// quietos (congelados): un embestidor a mitad de carga se aleja más rápido de lo que tira el sol, y eso no es lo que se mide
r = await P(`const L = E.filter(e => e.kind !== 'totem'); L.forEach((e, i) => { e.x = 270 + Math.cos(i) * 300; e.y = 528 + Math.sin(i) * 300; e.kx = e.ky = 0; e.frozen = 2; });
  const d0 = L.map(e => Math.hypot(e.x - 270, e.y - 528)); A.ult(); const s = A.ults().sing; A.step(1.2);
  const d1 = L.map(e => Math.hypot(e.x - 270, e.y - 528));
  return { s, d0: d0.map(Math.round), d1: d1.map(Math.round), kinds: L.map(e => e.kind) };`);
ok(r.s && r.s.kind === 'void' && Math.abs(r.s.t - 2.5) < 1e-6, 'Sol negro de 2,5 s en el centro', r.s);
ok(r.d1.every((d, i) => d < r.d0[i] - 50 || d < 40), 'atrae hacia el centro a los que están a menos de 400 px', r);
// tus disparos +50% mientras dura
r = await P(`P.cd = 0; P.still = 1; A.step(1 / 60); const s = A.shots.filter(x => !x.nofx && x.life > 1.55); return { n: s.length, dmg: s[0] && +s[0].dmg.toFixed(2), atk: +P.atk.toFixed(2), t: A.ults().sing.t };`);
ok(r.n > 0 && Math.abs(r.dmg / r.atk - 1.5) < 0.01, 'disparos +50% durante el Sol negro', r);
await shot('ult-sol-negro');
r = await P(`const hp0 = E.map(e => e.hp); A.step(1.45); return { s: A.ults().sing, dmg: E.reduce((s, e, i) => s + Math.max(0, hp0[i] - e.hp), 0), atk: P.atk };`);
ok(!r.s && r.dmg > 12 * r.atk, 'al final estalla (12×atk en r220)', r);

// ---------- Puros y Arcanista siguen igual ----------
console.log('--- Puros');
for (const [s, el, key] of [['fire', 'fire', 'fire'], ['ice', 'ice', 'ice'], ['bolt', 'bolt', 'bolt'], ['poison', 'poison', 'poison']]) {
  await ev(`__arcano.school('${s}')`); await ev(`__arcano.awaken('${el}')`);
  r = await P(`return A.ults();`);
  ok(r.key === key, `forma pura ${el}: definitivo ${r.name}`, r.key);
}
await ev(`__arcano.school('arcane')`);
r = await P(`return A.ults();`);
ok(r.key === 'arcane' && r.name === 'Singularidad', 'Arcanista sin despertar: Singularidad', r.key);
await ev(`__arcano.awaken('ice')`); await ev(`__arcano.awaken('bolt')`);
r = await P(`return { ...A.ults(), lin: A.formInfo().linaje };`);
ok(r.key === 'curtain' && r.lin === false, 'Arcanista en Aurora: Cortina boreal sin Linaje', r);
// sin fase 2: el del núcleo
r = await P(`A.flags.phase2 = false; const k = A.ults().key; A.flags.phase2 = true; return k;`);
ok(r === 'ice', 'con flags.phase2 = false vuelve el definitivo del núcleo', r);

console.log(fails ? `FALLOS: ${fails}` : 'TODO OK');
