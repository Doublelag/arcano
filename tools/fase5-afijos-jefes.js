// Fase 5 de docs/progresion-spec.md (§5.1-5.4, K5, K8): afijos de élite, 2ª y 3ª fase de jefe, Rocas/Salto/Espejismo/Juicio y
// Pacto favorable. Comprueba la mecánica, que ningún aviso nuevo dure menos de 0,35 s y saca capturas de cada aviso.
// Uso: SHOTS=E:/PROYECTOS/arcano/tools/out/fase5 CDP_PORT=9641 node tools/cdp.mjs 360 640 tools/fase5-afijos-jefes.js
const fs = await import('node:fs');
const DIR = process.env.SHOTS || 'E:/PROYECTOS/arcano/tools/out/fase5';
fs.mkdirSync(DIR, { recursive: true });
let fails = 0, oks = 0;
const ok = (c, m, x) => { if (c) oks++; else { fails++; console.log('FALLO', m, x === undefined ? '' : JSON.stringify(x)); } };
const P = code => ev(`(() => { const A = __arcano, E = A.enemies, P = A.player, B = A.boss; ${code} })()`);
const shot = async name => { await sleep(120); const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${DIR}/${name}.png`, Buffer.from(r.result.data, 'base64')); };
const gray = v => P(`document.querySelectorAll('canvas').forEach(c => c.style.filter = ${v ? "'grayscale(1)'" : "''"}); return 1;`);
for (let i = 0; i < 60 && (await ev(`!!(window.__arcano && window.__arcano.step)`)) !== true; i++) await sleep(150);
await ev('__arcano.flags.freeze = true');
const TELE = {}; // duración de cada aviso nuevo (s)

// ---------- 1. afijos por sala (datos) ----------
const AF = await ev(`JSON.stringify([5, 6, 10, 11, 12, 13, 18].map(r => [r, window.ArcanoChapters.eliteParams(window.ArcanoChapters.get(1), false, r).affixes]))`);
const afx = Object.fromEntries(JSON.parse(AF));
ok(afx[5].length === 0 && afx[6].join() === 'veloz,escudado' && afx[10].join() === 'veloz,escudado', 'Veloz y Escudado desde la s6', afx);
ok(afx[11].join() === 'veloz,escudado,volatil' && afx[13].join() === 'veloz,escudado,volatil,invocador', 'Volátil desde la s11 e Invocador desde la s13', afx);

// ---------- 2. afijos en partida: una élite = un afijo permitido en su sala ----------
const seen = JSON.parse(await ev(`(() => { const A = __arcano, out = { n: 0, bad: [], ids: {} };
  for (const r of [6, 8, 11, 12, 13, 17, 18]) for (let s = 1; s <= 25; s++) { A.seed(s * 31 + r); A.school('fire'); A.goto(r);
    const allow = window.ArcanoChapters.eliteParams(A.CH, false, r).affixes;
    for (const e of A.enemies) if (e.elite) { out.n++; const a = e.afx || []; a.forEach(id => out.ids[id] = (out.ids[id] || 0) + 1);
      if (a.length !== 1 || !allow.includes(a[0])) out.bad.push(r + ':' + a.join('+')); } }
  return JSON.stringify(out); })()`));
ok(seen.n >= 40 && !seen.bad.length, `todas las élites llevan 1 afijo permitido en su sala (${seen.n} élites)`, seen);
ok(['veloz', 'escudado', 'volatil', 'invocador'].every(id => seen.ids[id] > 0), 'salen los 4 afijos del C1', seen.ids);

// prepara una sala tranquila con enemigos de prueba (modo dios, sin disparar fuerte)
const lab = async (room = 13) => {
  await ev(`__arcano.seed(7)`); await ev(`__arcano.school('fire')`); await ev(`__arcano.goto(${room})`);
  await P(`A.god(true); A.clear(); A.step(1 / 60); P.atk = 0.0001; return 1;`);
};
await lab();
const ve = JSON.parse(await P(`const e = A.spawn('archer', P.x, P.y - 300), sp = e.speed; e.hp = e.maxHp = 1e6; const i = E.indexOf(e); A.affix(i, 'veloz');
  return JSON.stringify({ k: e.speed / sp, h: e.hasteK, afx: e.afx, elite: e.elite, kb: e.kbMul });`));
ok(Math.abs(ve.k - 1.35) < 1e-6 && Math.abs(ve.h - 1 / 0.7) < 1e-6 && ve.elite && ve.kb === 0, 'VELOZ: velocidad ×1,35, temporizadores ×0,7, élite sin empujón', ve);
const es = JSON.parse(await P(`const e = A.spawn('mage', P.x + 120, P.y - 300); const i = E.indexOf(e); A.affix(i, 'escudado'); const sh0 = e.shield, hp0 = e.hp;
  A.hit(i, ['fire'], { dmg: sh0 * 0.4 }); const a = { sh: e.shield, hp: e.hp }; const r1 = A.hit(i, ['ice'], { dmg: 1 });
  A.hit(i, [], { dmg: sh0 }); const b = { sh: e.shield, hp: e.hp, stun: e.stun };
  return JSON.stringify({ sh0, max: e.maxHp, hp0, a, react1: r1.reactCd, b, txt: A.toasts() });`));
ok(Math.abs(es.sh0 - es.max * 0.3) < 1e-6, 'ESCUDADO: escudo = 30 % de la vida máxima', es);
ok(es.a.hp === es.hp0 && es.a.sh < es.sh0, 'ESCUDADO: el daño se lo come el escudo antes que la vida', es);
ok(es.react1 === 0, 'ESCUDADO: con escudo no sufre reacciones', es);
ok(es.b.sh === 0 && es.b.stun > 0.25 && es.b.hp < es.hp0, 'ESCUDADO: al romperse, aturdido 0,3 s y el resto del golpe a la vida', es);
await P(`A.clear(); A.step(1 / 60); return 1;`);
const vo = JSON.parse(await P(`const e = A.spawn('slime', P.x, P.y - 260); const i = E.indexOf(e); A.affix(i, 'volatil'); const k0 = A.kills;
  const s2 = A.spawn('slime', P.x + 100, P.y - 200); s2.hp = s2.maxHp = 1e6; // que la sala no se limpie
  A.hit(i, [], { dmg: 1e6 }); const q = A.volatileQ.length, t0 = A.volatileQ[0] && A.volatileQ[0].t;
  A.step(0.5); const b1 = A.bullets.filter(b => b.src === 'volatile').length; A.step(0.15);
  const b2 = A.bullets.filter(b => b.src === 'volatile'); return JSON.stringify({ q, t0, b1, n: b2.length, sp: Math.hypot(b2[0].vx, b2[0].vy), col: b2[0].color, kills: A.kills - k0 });`));
ok(vo.q === 1 && vo.b1 === 0 && vo.n === 8 && Math.abs(vo.sp - 140) < 1 && vo.col === '#ff3b6b', 'VOLÁTIL: 0,6 s de aviso y 8 balas a 140 px/s en estrella', vo);
TELE.volatil = vo.t0;
const vw = JSON.parse(await P(`A.clear(); A.step(1 / 60); const e = A.spawn('slime', P.x, P.y - 260); const i = E.indexOf(e); A.affix(i, 'volatil'); e.wiped = true;
  const s2 = A.spawn('slime', P.x + 100, P.y - 200); s2.hp = s2.maxHp = 1e6; A.hit(i, [], { dmg: 1e6 }); return JSON.stringify({ q: A.volatileQ.length });`));
ok(vw.q === 0, 'VOLÁTIL: si muere por la caída del jefe (wiped) no estalla', vw);
await P(`A.clear(); A.step(1 / 60); return 1;`);
await lab();
const inv = JSON.parse(await P(`const e = A.spawn('mage', P.x, P.y - 280); e.hp = e.maxHp = 1e6; const i = E.indexOf(e); A.affix(i, 'invocador');
  const s0 = e.sumT; let warn = 0; for (let k = 0; k < 60 * 4.2; k++) { if (e.sumT < 0.5 && e.sumT > 0) warn += 1 / 60; A.step(1 / 60); }
  const n1 = A.enemies.filter(o => o.owner === e && !o.dead).length; for (const o of A.enemies) if (o.owner === e) { o.hp = o.maxHp = 1e6; }
  A.step(6.1); const n2 = A.enemies.filter(o => o.owner === e && !o.dead).length; for (const o of A.enemies) if (o.owner === e) o.hp = o.maxHp = 1e6;
  A.step(6.1); const n3 = A.enemies.filter(o => o.owner === e && !o.dead).length;
  const m = A.enemies.find(o => o.owner === e); return JSON.stringify({ s0, warn, n1, n2, n3, minion: m && m.minion, xp: m && m.xp, kind: m && m.kind });`));
ok(inv.n1 === 2 && inv.n2 === 4 && inv.n3 === 4 && inv.minion && inv.xp === 1 && inv.kind === 'bat', 'INVOCADOR: 2 murciélagos cada 6 s, como mucho 4 suyos vivos', inv);
TELE.invocador = 0.5;
// captura de los 4 afijos
await lab(13);
await P(`const ids = ['veloz', 'escudado', 'volatil', 'invocador'], ks = ['charger', 'mage', 'archer', 'spirit'];
  ids.forEach((id, j) => { const e = A.spawn(ks[j], P.x - 150 + j * 100, P.y - 260 - (j % 2) * 60); e.hp = e.maxHp = 1e6; A.affix(E.indexOf(e), id); if (id === 'volatil') e.hp = e.maxHp * 0.2; });
  A.step(0.4); return 1;`);
await shot('afijos'); await gray(true); await shot('afijos-gris'); await gray(false);
await P(`const m = E.find(e => e.afx && e.afx.includes('invocador')); m.sumT = 0.3; const v = E.find(e => e.afx && e.afx.includes('volatil')); A.volatileQ.push({ x: v.x + 60, y: v.y + 120, t: 0.35, max: 0.6, dmg: 0 }); A.step(0.05); return 1;`);
await shot('afijos-avisos');

// ---------- 3. fases de jefe (§5.2, K5) ----------
const boss = async (room, pats) => { // jefe ya en pie, quieto, con el patrón que se pide
  await ev(`__arcano.seed(9)`); await ev(`__arcano.school('fire')`); await ev(`__arcano.goto(${room})`);
  await P(`A.god(true); P.atk = 0.0001; A.step(3.2); return 1;`);
  if (pats) await P(`B.pats = ${JSON.stringify(pats)}; B.pi = 0; B.state = 'idle'; B.timer = 0; return 1;`);
};
await boss(5);
const ph = JSON.parse(await P(`const r0 = B.ringN; for (let k = 0; k < 6; k++) A.bullets.push({ x: P.x + 200, y: P.y - 400, vx: 0, vy: 0, r: 7, dmg: 0, color: '#ff4d6d', src: 'x' });
  const nb = A.bullets.length; const s = A.bossHp(0.49); const after = { nb: A.bullets.length, phaseT: B.phaseT, phase: B.phase, pats: B.pats.slice(), ring: B.ringN - r0, banner: A.ui().banner, frzImm: B.frzImm };
  const hp0 = B.hp; A.hit(E.indexOf(B), [], { dmg: 500 }); const inv = B.hp === hp0; return JSON.stringify(Object.assign(after, { nb0: nb, inv }));`));
ok(ph.phase === 1 && Math.abs(ph.phaseT - 0.6) < 1e-9 && ph.pats[0] === 'rocks' && ph.ring === 4, '2ª fase al 50 %: 0,6 s de transición, Rocas al principio, anillo +4', ph);
ok(ph.nb === ph.nb0, 'K5: la transición NO vacía las balas', ph);
ok(ph.inv, 'durante la transición el jefe no pierde vida', ph);
ok(ph.banner && ph.banner.text === '¡SEGUNDA FASE!' && ph.frzImm >= 2, 'rótulo «¡SEGUNDA FASE!» y fuera la congelación (frzImm 2 s)', ph);
await shot('fase2-gólem');
const big = JSON.parse(await P(`A.step(0.7); const i = E.indexOf(B); A.hit(i, [], { dmg: 1e7 }); return JSON.stringify({ dead: !A.boss || B.dead });`));
ok(big.dead, 'el Gólem (no final) muere al pasar de la 2ª fase: no tiene 3ª', big);
await boss(20);
const sk = JSON.parse(await P(`const i = E.indexOf(B), out = []; for (let k = 0; k < 3; k++) { A.hit(i, [], { dmg: 1e7 }); out.push({ hp: Math.round(B.hp / B.maxHp * 100), phase: B.phase, dead: B.dead, banner: A.ui().banner && A.ui().banner.text }); A.step(0.7); }
  return JSON.stringify(out);`));
ok(sk[0].phase === 1 && sk[0].hp === 50 && !sk[0].dead, 'un golpe enorme no se salta la 2ª fase (se queda al 50 %)', sk);
ok(sk[1].phase === 2 && sk[1].hp === 25 && !sk[1].dead && sk[1].banner === '¡ÚLTIMO ALIENTO!', 'Señor (final): 3ª fase al 25 % con «¡ÚLTIMO ALIENTO!»', sk);
ok(sk[2].dead, 'y muere tras la 3ª', sk);
await boss(20);
const p3 = JSON.parse(await P(`A.bossHp(0.4); A.step(0.7); const pats = B.pats.slice(); A.bossHp(0.2); A.step(0.7); B.pats = ['teleport']; B.pi = 0; B.state = 'idle'; B.timer = 0;
  const m0 = A.enemies.filter(o => o.minion && !o.dead).length; A.step(1.2); return JSON.stringify({ pats, ring: B.ringN, bats: A.enemies.filter(o => o.minion && !o.dead).length - m0 });`));
ok(p3.pats.includes('sweep') && p3.pats.includes('alt') && p3.ring === 12 + 4 * 3 + 8, 'Señor 2ª fase: Juicio + Rocas/Salto alternados; anillo +4 por fase', p3);
ok(p3.bats === 2, 'Último aliento: 2 murciélagos con cada teletransporte', p3);
// pausa entre ataques ×0,7 por fase (§5.2): se mide con la misma semilla
const idle = JSON.parse(await P(`for (const o of E) if (o !== B) o.dead = true; A.bullets.length = 0; const out = []; for (const f of [0, 1, 2]) { P.cd = 9; B.phase = f; B.state = 'ring'; B.sub = 2; B.timer = 0; A.seed(4); A.step(1 / 60); out.push(B.timer); } return JSON.stringify(out);`));
ok(Math.abs(idle[1] / idle[0] - 0.7) < 0.03 && Math.abs(idle[2] / idle[0] - 0.49) < 0.03, 'pausa del jefe ×0,7 por fase', idle);

// ---------- 4. ataques extra (§5.3) ----------
const noGod = `A.god(false); P.dodge = 0; P.shield = 0; P.maxHp = P.hp = 99999; P.inv = 0; A.bullets.length = 0; for (const o of E) if (o !== B) o.dead = true;`;
const src = s => `(A.hitStats().src['${s}'] || 0)`;
// Rocas
await boss(5, ['rocks']);
const rk = JSON.parse(await P(`${noGod} A.step(0.34); const n = A.rocks.length, r0 = A.rocks[0], t0 = r0 && r0.max, d0 = r0 && Math.hypot(r0.x - P.x, r0.y - P.y);
  B.timer = 99; A.bullets.length = 0; const h0 = ${src('boss:rocks')}; A.step(0.3); return JSON.stringify({ n, t0, d0, r: r0 && r0.r, h0, sx: P.x, sy: P.y });`));
ok(rk.n === 3 && rk.d0 < 1 && rk.r === 60 && rk.t0 >= 0.35, 'ROCAS: 3 círculos r 60 (uno sobre ti) que tardan ≥ 0,35 s en caer', rk);
TELE.rocas = rk.t0;
await shot('rocas'); await gray(true); await shot('rocas-gris'); await gray(false);
const rk2 = JSON.parse(await P(`A.step(0.7); return JSON.stringify({ hit: ${src('boss:rocks')}, left: A.rocks.length });`));
ok(rk2.hit === 1 && rk2.left === 0, 'ROCAS: quedarse dentro duele (una vez: las demás no te pillan dentro)', rk2);
await P(`B.pats = ['rocks']; B.pi = 0; B.state = 'idle'; B.timer = 0; P.inv = 0; A.step(0.34); B.timer = 99; P.x += 0; return 1;`);
const rk3 = JSON.parse(await P(`const h0 = ${src('boss:rocks')}; const far = A.rocks.reduce((m, k) => Math.max(m, 0), 0);
  // te apartas a 200 px de todos los círculos
  let best = null; for (let a = 0; a < 6.28; a += 0.2) { const x = P.x + Math.cos(a) * 200, y = P.y + Math.sin(a) * 200; if (x < 50 || x > 490 || y < 148 || y > 908) continue; const d = Math.min(...A.rocks.map(k => Math.hypot(k.x - x, k.y - y))); if (!best || d > best.d) best = { x, y, d }; }
  P.x = best.x; P.y = best.y; A.step(1); return JSON.stringify({ hit: ${src('boss:rocks')} - h0, d: Math.round(best.d) });`));
ok(rk3.hit === 0, 'ROCAS: fuera del círculo no te dan', rk3);
await boss(5, ['rocks']);
const rk4 = JSON.parse(await P(`B.strong = true; A.step(0.34); const n1 = A.rocks.length; A.step(0.36 * 4); return JSON.stringify({ n1, tot: A.rocks.length + 0, st: B.state });`));
ok(rk4.n1 === 1 && rk4.tot >= 3, 'ROCAS en 2ª fase: van cayendo una a una cada 0,35 s donde estés (5)', rk4);
// Salto
await boss(10, ['slam']);
const sl = JSON.parse(await P(`${noGod} A.step(1 / 60); const st = B.state, tp = B.tp && { x: B.tp.x, y: B.tp.y }; let t = 0; for (let k = 0; k < 120 && B.state !== 'idle'; k++) { if (k === 20) A.ui(); A.step(1 / 60); t += 1 / 60; if (B.state === 'slamUp' && k === 20) { } }
  return JSON.stringify({ st, tp, t, d: tp && Math.hypot(tp.x - P.x, tp.y - P.y), hit: ${src('boss:slam')}, ring: A.bullets.filter(b => b.src === 'boss:slam').length });`));
ok(sl.st === 'slamUp' && sl.d < 1 && sl.t >= 0.6 && sl.hit === 1, 'SALTO: cae donde estabas tras ≥ 0,6 s de sombra y la onda te da', sl);
TELE.salto = sl.t;
await boss(10, ['slam']);
await P(`${noGod} A.step(0.3); return 1;`);
await shot('salto');
const sl2 = JSON.parse(await P(`const h0 = ${src('boss:slam')}; P.x = B.tp.x + (B.tp.x > 270 ? -170 : 170); P.inv = 0; for (let k = 0; k < 30 && B.state !== 'idle'; k++) A.step(1 / 60);
  return JSON.stringify({ hit: ${src('boss:slam')} - h0, ring: A.bullets.filter(b => b.src === 'boss:slam').length });`));
ok(sl2.hit === 0 && sl2.ring === 12, 'SALTO: apartado de la sombra no te pilla la onda; al caer, anillo de 12 balas', sl2);
// Espejismo
await boss(15, ['mirror']);
const mi = JSON.parse(await P(`A.step(1 / 60); const st = B.state, w = B.timer, d = B.mir && B.mir.map(t => Math.round(Math.hypot(t.x - B.x, t.y - B.y)));
  A.step(0.46); B.timer = 99; const cs = A.enemies.filter(o => o.decoy); return JSON.stringify({ st, w, d, n: cs.length, hp: cs.map(c => c.hp), a: cs.map(c => c.alpha), xp: cs.map(c => c.xp) });`));
ok(mi.st === 'mirror' && mi.w >= 0.35 && mi.n === 2 && mi.hp.every(h => h === 1) && mi.a.every(a => a === 0.6) && mi.xp.every(x => x === 0), 'ESPEJISMO: marca de destino ≥ 0,35 s y 2 copias (1 de vida, alpha 0,6, sin experiencia)', mi);
TELE.espejismo = mi.w;
await P(`A.step(0.55); return 1;`);
await shot('espejismo');
const mi2 = JSON.parse(await P(`const cs = A.enemies.filter(o => o.decoy); const k0 = A.kills; A.step(0.8); const shots = A.bullets.filter(b => b.src === 'boss:mirror').length;
  A.hit(E.indexOf(cs[0]), [], { dmg: 5 }); const dead = cs[0].dead, gems = 0; A.step(4); return JSON.stringify({ shots, dead, kills: A.kills - k0, left: A.enemies.filter(o => o.decoy && !o.dead).length });`));
ok(mi2.shots >= 5 && mi2.dead && mi2.kills === 0 && mi2.left === 0, 'ESPEJISMO: las copias disparan su abanico, mueren de un golpe sin contar baja y se van a los 4 s', mi2);
// Juicio
await boss(20, ['sweep']);
const sw = JSON.parse(await P(`${noGod} B.x = 270; B.y = 528; A.step(1 / 60); const st = B.state, w = B.timer; P.x = B.x + Math.cos(B.sw.a0 + B.sw.dir * 1.2) * 220; P.y = B.y + Math.sin(B.sw.a0 + B.sw.dir * 1.2) * 220;
  const h0 = ${src('boss:sweep')}; A.step(0.4); return JSON.stringify({ st, w, h0 });`));
ok(sw.st === 'sweepW' && sw.w >= 0.75, 'JUICIO: línea de aviso de 0,8 s', sw);
TELE.juicio = 0.8;
await shot('juicio-aviso'); await gray(true); await shot('juicio-aviso-gris'); await gray(false);
await P(`A.step(0.4 + 0.25); return 1;`);
await shot('juicio-barrido');
const sw2 = JSON.parse(await P(`A.step(1.2); return JSON.stringify({ hit: ${src('boss:sweep')}, st: B.state });`));
ok(sw2.hit === 1, 'JUICIO: si estás en lo que barre, te da (una vez)', sw2);
await boss(20, ['sweep']);
const sw3 = JSON.parse(await P(`${noGod} B.x = 270; B.y = 528; A.step(1 / 60); const h0 = ${src('boss:sweep')}; const a = B.sw.a0 - B.sw.dir * 0.6; // detrás de la línea de salida
  P.x = B.x + Math.cos(a) * 200; P.y = B.y + Math.sin(a) * 200; A.step(2.1); const far = ${src('boss:sweep')} - h0;
  return JSON.stringify({ hit: far });`));
ok(sw3.hit === 0, 'JUICIO: por detrás de la línea de salida no te da', sw3);
await boss(20, ['sweep']);
const sw4 = JSON.parse(await P(`${noGod} A.step(1 / 60); const h0 = ${src('boss:sweep')}; const a = B.sw.a0 + B.sw.dir * 1.5; P.x = B.x + Math.cos(a) * 60; P.y = B.y + Math.sin(a) * 60;
  const ok0 = Math.hypot(P.x - B.x, P.y - B.y); B.x = 270; B.y = 300; P.x = 270; P.y = 300 + 440; A.step(2.1); return JSON.stringify({ hit: ${src('boss:sweep')} - h0 });`));
ok(sw4.hit === 0, 'JUICIO: fuera del radio 420 no te da', sw4);

// ---------- 5. ningún aviso nuevo de menos de 0,35 s (§10.5) ----------
ok(Object.values(TELE).every(v => v >= 0.35), 'avisos nuevos ≥ 0,35 s', TELE);
console.log('avisos (s):', JSON.stringify(TELE));

// ---------- 6. Pacto favorable (§5.4) ----------
const pact = async (clean) => {
  await ev(`__arcano.seed(11)`); await ev(`__arcano.school('fire')`); await ev(`__arcano.goto(5)`);
  await P(`A.god(true); P.atk = 0.0001; A.step(3.2); return 1;`);
  if (!clean) await P(`A.god(false); P.dodge = 0; P.shield = 0; P.inv = 0; A.bullets.push({ x: P.x, y: P.y, vx: 0, vy: 0, r: 7, dmg: 1, color: '#ff4d6d', src: 'boss:ring' }); A.step(1 / 60); A.god(true); return 1;`);
  await P(`const i = E.indexOf(B); for (let k = 0; k < 3 && A.boss; k++) { A.hit(i, [], { dmg: 1e7 }); A.step(0.7); } return 1;`);
  const c = await ev('__arcano.lastBossClean');
  await ev(`__arcano.goto(9)`);
  await P(`for (let k = 0; k < 600 && A.state !== 'altar'; k++) { if (A.state === 'levelup') A.pick(0); else { P.x = 270; P.y = 128 + 352; A.step(1 / 60); } } return 1;`);
  return JSON.parse(await P(`const card = document.querySelector('[data-act="altar"][data-id="pact"]'); return JSON.stringify({ clean: ${c}, st: A.state, fav: !!(card && card.classList.contains('fav')), txt: card && card.innerText, after: A.lastBossClean, hp: P.maxHp });`));
};
const pf = await pact(true);
ok(pf.clean && pf.st === 'altar' && pf.fav && /Pacto favorable/.test(pf.txt) && /15%/.test(pf.txt) && /3 habilidades/.test(pf.txt) && !pf.after, 'PACTO FAVORABLE: jefe sin tocarte → carta dorada en el siguiente altar (y se gasta ahí)', pf);
await shot('altar-favorable');
const pk = JSON.parse(await P(`const all = [...document.querySelectorAll('[data-act="pick"],[data-act="school"]:not(.locked),[data-act="altar"]')]; const hp0 = P.maxHp;
  A.pick(all.findIndex(b => b.dataset.id === 'pact')); const k = P.maxHp / hp0; let n = 0; for (let k = 0; k < 400 && n < 6; k++) { if (A.state === 'levelup') { n++; A.pick(0); } else A.step(1 / 60); }
  return JSON.stringify({ k, picks: n });`));
ok(Math.abs(pk.k - 0.85) < 0.02 && pk.picks >= 3, 'PACTO FAVORABLE: −15 % de vida máxima y 3 habilidades', pk);
const pn = await pact(false);
ok(!pn.clean && !pn.fav && /Pacto oscuro/.test(pn.txt) && /20%/.test(pn.txt), 'si el jefe te tocó, el Pacto de siempre (−20 %, 2 habilidades)', pn);

console.log(fails ? `FALLOS: ${fails} (OK ${oks})` : `TODO OK (${oks})`);
