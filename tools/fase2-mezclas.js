// Fase 2: las 8 Mezclas (activación con give(), aviso, bit del Grimorio y efecto), cartas de forma y Capa 0
// Uso: SHOTS=dir CDP_PORT=9435 node tools/cdp.mjs 360 640 tools/fase2-mezclas.js
const fs = await import('node:fs');
const DIR = process.env.SHOTS || '.';
let fails = 0;
const ok = (c, msg, x) => { console.log((c ? 'OK   ' : 'FAIL ') + msg + (x !== undefined ? '  ' + JSON.stringify(x) : '')); if (!c) fails++; };
const P = code => ev(`(() => { const A = __arcano, E = A.enemies, P = A.player, F = window.ArcanoForms; ${code} })()`);
const shot = async name => { await sleep(120); const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${DIR}/${name}.png`, Buffer.from(r.result.data, 'base64')); };
// enemigos quietos, lejos y con mucha vida; el mago no dispara solo
const park = `E.forEach((e, i) => { e.spawnT = 0; e.hp = e.maxHp = 5000; e.burn = e.burnDps = e.poisonDps = e.slow = e.shock = e.frozen = e.reactCd = e.corrode = 0; e.kx = e.ky = 0; e.x = 60 + (i % 6) * 80; e.y = 180 + Math.floor(i / 6) * 60; }); P.cd = 99; P.crit = 0;`;
const run = async (school, room = 7) => {
  await ev(`__arcano.school('${school}')`);
  await ev(`__arcano.goto(${room})`);
  await ev('__arcano.god(true)');
  await P(park);
};
// activa la Mezcla cogiendo su carta como una elección normal (give = pickSkill)
const activate = async (id, card) => {
  const r = await P(`const g0 = A.grim().m; A.give('${card}'); const m = F.MIXES.find(x => x.id === '${id}');
    return { mixes: A.formInfo().mixes, toast: A.toasts().find(t => t.startsWith('MEZCLA: ')) || null, bit: !!(A.grim().m & F.bit('${id}')), was: !!(g0 & F.bit('${id}')), name: m.name };`);
  ok(r.mixes.includes(id) && r.toast && r.toast.startsWith('MEZCLA: ' + r.name.toUpperCase()) && r.bit, `${r.name}: se activa al coger la carta, aviso y bit del Grimorio`, { mixes: r.mixes, toast: r.toast });
  return r;
};

await ev('__arcano.flags.freeze = true');
await ev('__arcano.seed(5)');
await ev('__arcano.grim(true)');

// ---------- receta oculta en las cartas y peso ×1,3 ----------
console.log('--- Receta oculta');
await run('fire');
let r = await P(`let html = null; for (let i = 0; i < 60 && !html; i++) { A.levelup(); const c = document.querySelector('[data-act="pick"][data-id="pierce"]'); if (c) html = c.innerHTML; } A.later(); document.getElementById('overlay').className = 'hidden'; return html && html.replace(/\\s+/g, ' ');`);
ok(r && r.includes('Algo reacciona') && r.includes('combo mix'), 'la pieza que falta de una Mezcla nueva: "Algo reacciona…"', r && r.slice(0, 160));
r = await P(`let a = 0, b = 0; for (let i = 0; i < 4000; i++) { const k = A.roll(1)[0]; if (k === 'pierce') a++; else if (k === 'ricochet') b++; } return { pierce: a, ricochet: b, ratio: +(a / b).toFixed(2) };`);
ok(r.ratio > 1.15 && r.ratio < 1.45, 'peso ×1,3 para la pieza que falta (Lanza de éter frente a Salto arcano, mismo peso base)', r);
await P(`A.give('pierce'); return 1;`); // descubre Cometa
await run('fire');
r = await P(`let html = null; for (let i = 0; i < 60 && !html; i++) { A.levelup(); const c = document.querySelector('[data-act="pick"][data-id="pierce"]'); if (c) html = c.innerHTML; } return html && html.replace(/\\s+/g, ' ');`);
ok(r && r.includes('Mezcla: Cometa'), 'ya descubierta: "Mezcla: Cometa"', r && r.slice(0, 160));
await shot('mezcla-carta');
await P(`document.getElementById('overlay').className = 'hidden'; return 1;`);

// ---------- Cometa (Fuego + Lanza de éter) ----------
console.log('--- Mezclas');
await run('fire');
await activate('cometa', 'pierce');
r = await P(`${park} const a = E[0], b = E[1]; a.x = 200; a.y = 400; b.x = 228; b.y = 400; const hb = b.hp, t0 = A.tok.comet;
  const s = { x: a.x, y: a.y, vx: 0, vy: -760, dmg: P.atk, hit: new Set(), pierce: 1, rico: 0, wall: 0, els: [] }; A.hit(0, [], s);
  return { dmg: +(hb - b.hp).toFixed(2), burn: b.burn > 0, atk: P.atk, tok: +(t0 - A.tok.comet).toFixed(2) };`);
ok(Math.abs(r.dmg - 0.5 * r.atk) < 0.01 && r.burn && r.tok === 1, 'Cometa: al atravesar, llamarada (0,5×atk) que prende y gasta ficha', r);
r = await P(`${park} const a = E[0], b = E[1]; a.x = 200; a.y = 400; b.x = 228; b.y = 400; const hb = b.hp; A.hit(0, [], { pierce: 0 }); return hb - b.hp;`);
ok(r === 0, 'Cometa: sin atravesar no hay llamarada', r);
r = await P(`${park} const a = E[0], b = E[1]; a.x = 200; a.y = 400; b.x = 228; b.y = 400; const hb = b.hp; A.hit(0, [], { pierce: 1, nofx: true }); return hb - b.hp;`);
ok(r === 0, 'Cometa: los secundarios (nofx) no la activan', r);

// ---------- Halo solar (Fuego + Orbes) ----------
await run('fire');
await activate('halo', 'orbs');
r = await P(`${park} const e = E[0]; const a = P.orbA + 3.4 / 60; e.x = P.x + Math.cos(a) * 72; e.y = P.y + Math.sin(a) * 72; e.orbCd = 0; const h = e.hp; A.step(1 / 60); return { dmg: +(h - e.hp).toFixed(2), burn: e.burn, atk: P.atk };`);
ok(r.dmg > 0 && r.burn > 0, 'Halo solar: el orbe quema al contacto', r);
r = await P(`${park} const e = E[1], a = P.orbA + 3.4 / 60; e.x = P.x + Math.cos(a) * 122; e.y = P.y + Math.sin(a) * 122; e.orbCd = 9; P.haloT = 0.001; const h = e.hp; A.step(1 / 60); return { dmg: +(h - e.hp).toFixed(2), atk: P.atk, t: +P.haloT.toFixed(2) };`);
ok(Math.abs(r.dmg - 0.6 * r.atk) < 0.01 && r.t > 1.9, 'Halo solar: cada 2 s anillo de fuego (0,6×atk)', r);

// ---------- Glaciar (Hielo + Rebote) ----------
await run('ice');
await activate('glaciar', 'wall');
r = await P(`A.clear(); A.step(0.05); A.shots.length = 0;
  let cell = -1; for (let i = 0; i < 240 && cell < 0; i++) { const c = i % 12, rr = Math.floor(i / 12); if (A.grid[i] && c > 1 && rr > 2 && rr < 18 && !A.grid[i - 1] && !A.grid[i - 2]) cell = i; }
  const cx = 30 + (cell % 12) * 40 + 20, cy = 128 + Math.floor(cell / 12) * 40 + 20;
  A.shots.push({ x: cx - 45, y: cy, vx: 760, vy: 0, dmg: 10, life: 1.6, hit: new Set(), pierce: 0, rico: 0, wall: 2, els: ['ice'], col: '#7fe3ff', col2: null, sty: P.sty, kind: null, nofx: false, split: false });
  A.step(0.05); const S = A.shots;
  return { cell, n: S.length, split: S.map(s => s.split), nofx: S.map(s => s.nofx), dmg: S.map(s => +s.dmg.toFixed(2)), ang: S.map(s => Math.round(Math.atan2(s.vy, s.vx) * 180 / Math.PI)), wall: S.map(s => s.wall) };`);
ok(r.n === 2 && r.split.every(Boolean) && r.dmg.every(d => d === 6) && r.nofx.join() === 'false,true', 'Glaciar: al rebotar se parte en 2 (60% cada uno; la mitad nueva es nofx)', r);
ok(r.ang.map(Math.abs).every(a => Math.abs(a - 155) <= 1), 'Glaciar: ±25° respecto al rebote', r.ang);
await ev('__arcano.step(0.4)');
r = await P(`return A.shots.length;`);
ok(r <= 2, 'Glaciar: los trozos no se vuelven a partir', r);

// ---------- Granizo (Hielo + Salto arcano) ----------
await run('ice');
await activate('granizo', 'ricochet');
r = await P(`${park} A.shots.length = 0; E[0].x = 200; E[0].y = 400; E[1].x = 320; E[1].y = 400; A.hit(0, ['ice'], { rico: 2 }); A.step(1 / 60);
  const H = A.shots.filter(s => s.sub === 'hail'); return { n: H.length, nofx: H.every(s => s.nofx), dmg: H.map(s => +s.dmg.toFixed(2)), els: H.map(s => s.els.join()), atk: P.atk };`);
ok(r.n === 2 && r.nofx && r.dmg.every(d => Math.abs(d - 0.35 * r.atk) < 0.01) && r.els.every(e => e === 'ice'), 'Granizo: cada salto suelta 2 esquirlas de hielo (0,35×atk, nofx)', r);

// ---------- Anillo voltaico (Rayo + Orbes) ----------
await run('bolt');
await activate('anillo', 'orbs');
r = await P(`${park} const e = E[0]; const a = P.orbA + 3.4 / 60; e.x = (P.x + Math.cos(a) * 72 + P.x) / 2; e.y = (P.y + Math.sin(a) * 72 + P.y - 4) / 2; P.ringT = 0; const h = e.hp; A.step(1 / 60);
  return { dmg: +(h - e.hp).toFixed(2), shock: +e.shock.toFixed(2), atk: P.atk };`);
ok(Math.abs(r.dmg - 0.5 * r.atk) < 0.01 && r.shock >= 1.4, 'Anillo voltaico: el arco orbe↔mago daña (0,5×atk) y electrocuta', r);

// ---------- Chispazo (Rayo + Concentración) ----------
await run('bolt');
await activate('chispazo', 'crit');
r = await P(`${park} P.crit = 1; E[0].x = 200; E[0].y = 400; E[1].x = 260; E[1].y = 400; E[2].x = 300; E[2].y = 430; const h1 = E[1].hp, h2 = E[2].hp, t0 = A.tok.spark;
  A.hit(0, []); P.crit = 0; return { d1: +(h1 - E[1].hp).toFixed(2), d2: +(h2 - E[2].hp).toFixed(2), exp: +(P.atk * P.critMul * 0.5).toFixed(2), tok: +(t0 - A.tok.spark).toFixed(2) };`);
ok(Math.abs(r.d1 - r.exp) < 0.01 && Math.abs(r.d2 - r.exp) < 0.01 && r.tok === 1, 'Chispazo: el crítico lanza una cadena de rayos (50% del crítico)', r);
r = await P(`${park} E[0].x = 200; E[0].y = 400; E[1].x = 260; E[1].y = 400; const h1 = E[1].hp; A.hit(0, []); return h1 - E[1].hp;`);
ok(r === 0, 'Chispazo: sin crítico, nada', r);

// ---------- Contagio (Veneno + Salto arcano) ----------
await run('poison');
await activate('contagio', 'ricochet');
r = await P(`${park} E[0].x = 200; E[0].y = 400; E[1].x = 320; E[1].y = 400; E[0].poisonDps = 40; A.hit(0, [], { rico: 2 }); return { next: E[1].poisonDps, src: E[0].poisonDps };`);
ok(r.next === 40, 'Contagio: el veneno pasa al siguiente del salto', r);

// ---------- Aguijón (Veneno + Abanico) ----------
await run('poison');
await activate('aguijon', 'diag');
r = await P(`${park} E[0].x = 270; E[0].y = 300; A.shots.length = 0; P.cd = 0; P.still = 1; A.step(1 / 60);
  const D = A.shots.filter(s => s.kind === 'diag'), N = A.shots.filter(s => !s.kind);
  return { n: D.length, needle: D.every(s => s.needle), sp: D.map(s => Math.round(Math.hypot(s.vx, s.vy))), pierce: D.map(s => s.pierce), front: N.map(s => [Math.round(Math.hypot(s.vx, s.vy)), s.pierce, !!s.needle]) };`);
ok(r.n === 2 && r.needle && r.sp.every(v => v === 988) && r.pierce.every(v => v === 1) && r.front.every(f => f[0] === 760 && f[1] === 0 && !f[2]), 'Aguijón: las diagonales son agujas (×1,3 de velocidad, +1 perforación); las de frente no', r);
r = await P(`${park} E[0].x = 200; E[0].y = 400; E[1].x = 400; E[1].y = 400; A.hit(0, ['poison'], { needle: true }); A.hit(1, ['poison']); return { aguja: +E[0].poisonDps.toFixed(2), normal: +E[1].poisonDps.toFixed(2) };`);
ok(Math.abs(r.aguja - 2 * r.normal) < 1e-6 && r.normal > 0, 'Aguijón: veneno ×2 por impacto', r);
await shot('mezcla-agujas');

// ---------- logro Mezclador y Grimorio ----------
r = await P(`return { m: A.grim().m, ach: A.ach().includes('mixes8') };`);
ok(r.m === 255 && r.ach, 'las 8 Mezclas descubiertas: bits 0-7 y logro Mezclador', r);

// ---------- solo las de tus 2 elementos ----------
console.log('--- Afinidad');
await run('fire');
r = await P(`A.give('ice'); A.give('wall'); A.give('ricochet'); return { aff: A.formInfo().aff, mixes: A.formInfo().mixes };`);
ok(r.mixes.join() === 'glaciar,granizo' && r.aff.join() === 'fire,ice', 'Piromante con hielo: Glaciar y Granizo activas', r);
r = await P(`A.give('orbs'); A.give('crit'); A.give('diag'); return A.formInfo().mixes;`);
ok(r.join() === 'halo,glaciar,granizo', 'con la Afinidad sellada (fuego + hielo) no salen las de rayo ni veneno', r);
r = await P(`return A.mix('anillo');`);
ok(!r.includes('anillo'), 'mix() no puede activar una fuera de la Afinidad', r);
// multiplicador ×1,25 si tu forma contiene el elemento
r = await P(`const m0 = P.mixM.glaciar; A.awaken('ice'); return { m0, m1: P.mixM.glaciar, halo: P.mixM.halo };`);
ok(r.m0 === 1 && r.m1 === 1.25 && r.halo === 1, 'en forma Glacial las de hielo van a ×1,25', r);

// ---------- cartas de forma ----------
console.log('--- Cartas de forma');
await run('fire');
r = await P(`const seen = new Set(); for (let i = 0; i < 400; i++) A.roll(3).forEach(k => k.startsWith('f_') && seen.add(k)); return [...seen];`);
ok(r.length === 0, 'Aprendiz: no salen cartas de forma', r);
await P(`A.awaken('fire'); return 1;`);
r = await P(`const seen = new Set(); for (let i = 0; i < 400; i++) A.roll(3).forEach(k => k.startsWith('f_') && seen.add(k)); return [...seen];`);
ok(r.join() === 'f_ignea', 'Ígnea: solo sale Fuego interior', r);
r = await P(`const t0 = JSON.parse(JSON.stringify(P.tr)); A.give('f_ignea'); const t1 = JSON.parse(JSON.stringify(P.tr)); A.give('f_ignea');
  let n = 0; for (let i = 0; i < 300; i++) if (A.roll(3).includes('f_ignea')) n++;
  return { b0: t0.burnK, b1: t1.burnK, b2: P.tr.burnK, r0: t0.deathBlast.r, r2: P.tr.deathBlast.r, offered: n };`);
ok(r.b0 === 0.5 && r.b1 === 0.6 && r.b2 === 0.7 && r.r0 === 55 && r.r2 === 75 && r.offered === 0, 'Fuego interior: burnK +0,1 y estallido +10 por nivel, máx. 2', r);
// la carta se conserva en el 2º despertar (Plasma con núcleo fuego mantiene burnK de Pira + la carta)
r = await P(`A.awaken('bolt'); return { form: P.form, burnK: P.tr.burnK, arc: P.tr.plasmaArc };`);
ok(r.form === 'plasma' && r.burnK === 0.7 && r.arc && r.arc.p === 0.3, 'en Plasma (núcleo fuego) los niveles de Fuego interior siguen sumando', r);
const CARD = [
  ['ice', ['ice'], 'f_glacial', 'tr.frzChance', 0.18],
  ['bolt', ['bolt'], 'f_voltaica', 'tr.chainN', 4],
  ['poison', ['poison'], 'f_toxica', 'tr.puddle.max', 6],
  ['fire', ['fire', 'bolt'], 'f_plasma', 'tr.plasmaArc.p', 0.4],
  ['bolt', ['bolt', 'ice'], 'f_aurora', 'tr.shards.n', 8],
  ['ice', ['ice', 'poison'], 'f_mortaja', 'tr.shroud.r', 115],
  ['poison', ['poison', 'fire'], 'f_azufre', 'tr.puddle.r', 65],
  ['fire', ['pact', 'fire', 'ice'], 'f_eclipse', 'tr.implode.r', 135],
];
for (const [s, path, card, field, exp] of CARD) {
  await ev(`__arcano.school('${s}')`);
  for (const el of path) await ev(el === 'pact' ? '__arcano.pact()' : `__arcano.awaken('${el}')`);
  r = await P(`const seen = new Set(); for (let i = 0; i < 300; i++) A.roll(3).forEach(k => k.startsWith('f_') && seen.add(k)); A.give('${card}'); return { seen: [...seen], v: P.${field}, form: P.form };`);
  ok(r.seen.join() === card && Math.abs(r.v - exp) < 1e-9, `${r.form}: solo ${card} y suma su nivel (${field} = ${exp})`, r);
}
// carta de forma en el panel: borde y línea de su forma
r = await P(`let html = null; for (let i = 0; i < 80 && !html; i++) { A.levelup(); const c = document.querySelector('[data-act="pick"][data-id="f_eclipse"]'); if (c) html = c.outerHTML; } return html && html.replace(/\\s+/g, ' ');`);
ok(r && r.includes('formcard') && r.includes('Carta de tu forma ECLIPSE'), 'carta de forma con su borde y su línea', r && r.slice(0, 200));
await shot('carta-forma');
await P(`document.getElementById('overlay').className = 'hidden'; return 1;`);

// ---------- Capa 0: cada carta se nota en el disparo ----------
console.log('--- Capa 0');
await run('fire');
r = await P(`const s0 = P.sty; for (let i = 0; i < 6; i++) A.give('atk'); for (let i = 0; i < 4; i++) A.give('crit'); A.give('pierce'); A.give('wall');
  const s = P.sty, e = P.styEcho; return { core0: s0.coreR, glow0: s0.glowR, white0: s0.whiteR, core: +s.coreR.toFixed(2), glow: s.glowR, white: +s.whiteR.toFixed(2), ell: s.ell, rim: s.rim, echo: e.alpha, main: s.alpha };`);
ok(r.core0 === 5.5 && r.core === 7.9 && r.glow0 === 17 && r.glow === 26, 'Poder: núcleo 5,5 → 7,9 y brillo 17 → 26', r);
ok(r.white0 === 2.8 && r.white === 3.6, 'Concentración: centro blanco 2,8 → 3,6', r);
ok(r.ell === true && !!r.rim, 'Lanza de éter: núcleo en elipse; Rebote: contorno', r);
ok(r.echo === 0.7 && r.main === 1, 'Eco arcano: las ráfagas del eco con alfa 0,7', r);

console.log(fails ? `FALLOS: ${fails}` : 'TODO OK');
