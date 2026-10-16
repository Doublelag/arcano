// Pruebas de mecánica del Despertar: redes de seguridad, fuentes de Ánima, rasgos de las formas, equipo, Sintonía y sin formas
// Uso: CDP_PORT=9433 node tools/cdp.mjs 360 640 tools/despertar-rasgos.js
let fails = 0;
const ok = (c, msg, x) => { console.log((c ? 'OK   ' : 'FAIL ') + msg + (x !== undefined ? '  ' + JSON.stringify(x) : '')); if (!c) fails++; };
const P = code => ev(`(() => { const A = __arcano, E = A.enemies, P = A.player; ${code} })()`);
const info = () => ev('__arcano.formInfo()');
const run = async (school, path = [], room = 0) => {
  await ev(`__arcano.school('${school}')`);
  for (const el of path) { if (el === 'pact') await ev('__arcano.pact()'); else await ev(`__arcano.awaken('${el}')`); }
  if (room) await ev(`__arcano.goto(${room})`);
  await ev('__arcano.god(true)');
  await P(`E.forEach(e => { e.spawnT = 0; }); P.crit = 0;`);
};
// enemigos quietos (congelados no, que cambia el daño): lejos del jugador y con mucha vida
const park = `E.forEach((e, i) => { e.spawnT = 0; e.hp = e.maxHp = 5000; e.burn = e.burnDps = e.poisonDps = e.slow = e.shock = e.frozen = e.reactCd = 0; e.x = 60 + (i % 6) * 80; e.y = 200 + Math.floor(i / 6) * 60; });`;

await ev('__arcano.flags.freeze = true');
await ev('__arcano.seed(7)');

// ---------- Redes de seguridad ----------
console.log('--- Redes');
await run('fire', [], 5);
let r = await P(`const b = E[0]; b.hp = 1; A.hit(0, ['fire']); return { kind: b.kind, dead: b.dead, info: A.formInfo() };`);
ok(r.kind === 'boss' && r.dead && r.info.ready && r.info.net[0] && r.info.net[0].net === 'a', '(a) quien nunca ha despertado: Ánima llena tras el Gólem', r.info.net);
await ev(`__arcano.awaken('fire')`); // ya hay una forma en el Grimorio
await run('fire', [], 5);
r = await P(`E[0].hp = 1; A.hit(0, ['fire']); return A.formInfo();`);
ok(!r.ready && !r.net.length, '(a) ya no salta si el Grimorio tiene formas', { anima: r.anima });
await ev('__arcano.goto(10)'); await P(`E.forEach(e => e.spawnT = 0);`);
r = await P(`E[0].hp = 1; A.hit(0, ['fire']); return A.formInfo();`);
ok(r.ready && r.net.some(n => n.net === 'b'), '(b) 1º despertar garantizado tras el Rey Slime', r.net);
await run('fire', ['fire'], 15);
r = await P(`E[0].hp = 1; A.hit(0, ['fire']); return A.formInfo();`);
ok(r.ready && r.net.some(n => n.net === 'c') && r.need === 175, '(c) 2º despertar garantizado tras el Brujo (need 175 desde la fase 4)', r.net);

// ---------- Fuentes de Ánima ----------
console.log('--- Ánima');
await run('fire', [], 7);
r = await P(`${park} const a0 = P.anima; E[0].hp = 1; E[0].elite = false; A.hit(0, []); const a1 = P.anima; E[1].hp = 1; E[1].elite = true; A.hit(1, []); const a2 = P.anima; E[2].hp = 1; E[2].minion = true; A.hit(2, []); return [a1 - a0, a2 - a1, P.anima - a2];`);
ok(r[0] === 2 && r[1] === 6 && r[2] === 0.5, 'bajas: +2 normal, +6 élite, +0,5 esbirro', r);
r = await P(`${park} const a0 = P.anima; for (let i = 0; i < 12; i++) { E[3].reactCd = 0; E[3].burn = 1; A.hit(3, ['ice']); E[3].slow = 0; } return P.anima - a0;`);
ok(Math.abs(r - 12) < 1e-9, 'reacciones: +1,5 con tope de 12 por sala', r);
await run('fire', [], 5);
r = await P(`const b = E[0], a0 = P.anima; A.hit(0, [], { dmg: b.maxHp * 0.5 }); return P.anima - a0;`);
ok(Math.abs(r - 20) < 0.01, 'jefe: 50% de su vida = +20', r);
await run('fire', [], 3);
r = await P(`E.forEach((e, i) => { e.hp = 1; A.hit(i, []); }); const n = E.length, a = P.anima; A.step(0.1); return { n, kills: a, after: P.anima };`);
ok(Math.abs(r.after - r.kills - 5) < 1e-9, 'sala limpia sin recibir daño: +5', r);
await run('arcane', [], 3);
r = await P(`E[0].hp = 1; A.hit(0, []); return P.anima;`);
ok(r === 2.5, 'Arcanista: todo ×1,25', r);

// ---------- Ígnea: estallido al morir ardiendo (3 cada 0,3 s) ----------
console.log('--- Rasgos');
await run('fire', ['fire'], 7);
r = await P(`${park} const a = E.find(e => e.kind !== 'bomber'), b = E.find(e => e !== a); a.x = 200; a.y = 400; b.x = 240; b.y = 400; a.burn = 2; a.hp = 1; const hb = b.hp; A.hit(E.indexOf(a), []); return { dead: a.dead, dmg: hb - b.hp, burn: b.burn, atk: P.atk };`);
ok(r.dead && Math.abs(r.dmg - 0.8 * r.atk) < 0.01 && r.burn === 3.5, 'Ígnea: estalla (0,8×atk) y prende al vecino (3,5 s)', r);
await ev('__arcano.goto(16)'); await ev('__arcano.god(true)'); await ev('__arcano.step(0.5)'); // que se recarguen las fichas
r = await P(`${park} const L = E.filter(e => e.kind !== 'boss' && e.kind !== 'bomber'), b = L[L.length - 1]; let n = 0; /* el diablillo revienta al morir por su cuenta */ for (let i = 0; i < Math.min(5, L.length - 1); i++) { const a = L[i]; a.x = 300; a.y = 500; b.x = 330; b.y = 500; a.burn = 2; a.hp = 1; const h = b.hp; A.hit(E.indexOf(a), []); if (b.hp < h) n++; } return { n, tries: Math.min(5, L.length - 1), kinds: L.slice(0, 5).map(e => e.kind) };`);
ok(r.n === 3 && r.tries >= 4, 'fichas: como mucho 3 estallidos seguidos (sin tiempo para recargar)', r);

// ---------- Tóxica: charcos ----------
await run('poison', ['poison'], 7);
r = await P(`${park} const a = E[0], b = E[1]; a.x = 250; a.y = 500; a.poisonDps = 5; a.hp = 1; A.hit(0, []); b.x = 252; b.y = 502; b.frozen = 5; b.poisonDps = 0; A.step(0.6); return { pools: A.formInfo().pools, poison: b.poisonDps };`);
ok(r.pools === 1 && r.poison > 0, 'Tóxica: charco al morir envenenado que envenena', r);
r = await P(`${park} for (let i = 0; i < 6 && i < E.length; i++) { E[i].poisonDps = 5; E[i].hp = 1; A.hit(i, []); } return A.formInfo().pools;`);
ok(r <= 5, 'Tóxica: como mucho 5 charcos', r);

// ---------- Azufre: charco de azufre (daño, fuego y veneno) y COMBUSTIÓN mayor ----------
await run('poison', ['poison', 'fire'], 7);
let fi = await info();
ok(fi.form === 'azufre' && fi.tr.puddle.sulfur && fi.tr.combR === 110 && fi.tr.poisonK === 0.15 && !fi.tr.burnK, 'Azufre (núcleo veneno): Ponzoña + Suelo de azufre, sin Pira', fi.tr);
r = await P(`${park} const a = E[0], b = E[1]; a.x = 250; a.y = 500; a.burn = 2; a.hp = 1; A.hit(0, []); b.x = 252; b.y = 502; b.frozen = 5; const h = b.hp; A.step(0.6); return { dmg: h - b.hp, burn: b.burn, poison: b.poisonDps, atk: P.atk };`);
ok(r.dmg > 0 && r.burn > 0 && r.poison > 0, 'Azufre: el charco quema, envenena y hace daño', r);

// ---------- Aurora: esquirlas al morir congelado (nofx, 1 cada 0,15 s) ----------
await run('bolt', ['bolt', 'ice'], 7);
fi = await info();
ok(fi.form === 'aurora' && fi.tr.frozenMul === 1.5 && fi.tr.chainN === 3, 'Aurora (núcleo rayo): Arco vivo + Escarcha polar', fi.tr);
r = await P(`${park} E[0].frozen = 1; E[0].hp = 1; A.hit(0, []); A.step(1 / 60); const s1 = A.shots.filter(s => s.sub === 'shard' && s.nofx).length; E[1].frozen = 1; E[1].hp = 1; A.hit(1, []); A.step(1 / 60); return { s1, s2: A.shots.filter(s => s.sub === 'shard').length };`);
ok(r.s1 === 6 && r.s2 <= 6, 'Aurora: 6 esquirlas nofx y no otra tanda en el mismo instante', r);
r = await P(`${park} const e = E[0]; e.frozen = 0; e.slow = 1; e.reactCd = 0; A.hit(0, ['bolt']); return { frozen: e.frozen };`);
ok(Math.abs(r.frozen - 2) < 0.02, 'Aurora: CONGELACIÓN dura 2 s', r);

// ---------- Plasma: arcos desde el que arde ----------
await run('fire', ['fire', 'bolt'], 7);
r = await P(`${park} const a = E[0], b = E[1]; a.x = 200; a.y = 400; b.x = 300; b.y = 400; b.frozen = 0; const h = b.hp; let n = 0; for (let i = 0; i < 40; i++) { a.reactCd = 9; const hb = b.hp; A.hit(0, ['fire']); if (b.hp < hb) n++; } return { n, burn: b.burn, tok: A.tok.arc };`);
ok(r.n === 5 && r.burn > 0, 'Plasma: arco al vecino que lo prende (tope de 5 fichas)', r);

// ---------- Glacial: congela a veces a los ralentizados ----------
await run('ice', ['ice'], 7);
r = await P(`${park} const e = E[0]; let n = 0; for (let i = 0; i < 2000; i++) { e.frozen = 0; e.slow = 1; e.reactCd = 9; e.hp = 5000; A.hit(0, ['ice']); if (e.frozen > 0) n++; } let m = 0; for (let i = 0; i < 100; i++) { e.frozen = 0; e.slow = 0; A.hit(0, ['ice']); if (e.frozen > 0) m++; } return { n, m };`);
ok(r.n > 190 && r.n < 290 && r.m === 0, 'Glacial: ~12% de congelar a los ya ralentizados (y 0 a los demás)', r);

// ---------- Mortaja: Sudario ----------
await run('ice', ['ice', 'poison'], 7);
r = await P(`${park} const a = E[0], b = E[1]; a.x = P.x + 50; a.y = P.y - 40; b.x = P.x; b.y = P.y - 300; a.frozen = b.frozen = 5; A.step(0.55); return { aSlow: a.slow, aPois: a.poisonDps, bPois: b.poisonDps, k: P.atk * 0.1 };`);
ok(r.aSlow > 0 && r.aPois > 0 && r.bPois === 0, 'Mortaja: el Sudario ralentiza y envenena solo a los cercanos', r);

// ---------- Eclipse: reacción al primer golpe e implosión ----------
await run('fire', ['fire', 'pact', 'ice'], 7);
fi = await info();
ok(fi.form === 'eclipse' && fi.tr.firstHit && fi.tr.implode, 'Eclipse con Desequilibrio y Aniquilación');
r = await P(`${park} const a = E[0], b = E[1]; a.x = 250; a.y = 400; b.x = 330; b.y = 400; b.kind = b.kind === 'totem' ? 'slime' : b.kind; const ha = a.hp, hb = b.hp; A.hit(0, ['fire', 'ice']); return { dmgA: ha - a.hp, cd: a.reactCd, bx: b.x, dmgB: hb - b.hp, atk: P.atk };`);
const ET = await ev('ArcanoForms.FORMS.eclipse.trait'); // números del balance con bots (forms.js)
ok(r.dmgA > ET.vaporK * r.atk && Math.abs(r.cd - ET.reactCd) < 1e-9, `Eclipse: VAPOR al primer golpe (${ET.vaporK}×) y recarga de ${ET.reactCd} s`, r);
ok(Math.abs(r.bx - 290) < 1 && r.dmgB > 0, 'Eclipse: la implosión atrae 40 px y daña', r);
r = await P(`const b = E.find(e => !e.dead); return Math.round(P.atk / (10 * (1 + 0.06 * 0)) * 100) / 100;`);
ok(Math.abs(r - ET.atkMul) < 0.011, `Eclipse: atk ×${ET.atkMul}`, r);

// ---------- Equipo: runas que caben y que no caben en la Afinidad ----------
console.log('--- Equipo');
await P(`const i1 = A.giveGear('escarcha', 3), i2 = A.giveGear('escorpion', 2); A.equip(i1.uid); A.equip(i2.uid);`);
await ev(`__arcano.school('fire')`);
fi = await info();
let sk = await ev('__arcano.player.sk');
ok(fi.aff.join() === 'fire,ice' && sk.ice === 2 && !sk.poison && fi.fusedLv === 1, 'Piromante + Vara de Escarcha + Anillo del Escorpión: Afinidad fuego+hielo y veneno fundido', { aff: fi.aff, sk, fusedLv: fi.fusedLv });
let ts = await ev('__arcano.toasts()');
ok(ts.some(t => /AFINIDAD · FUEGO \+ HIELO \| Por tu equipo/.test(t)) && ts.some(t => /RUNA DE VENENO DEL EQUIPO/.test(t)), 'avisos de sala 1 por el equipo', ts);
await ev(`__arcano.school('arcane')`);
fi = await info();
ok(fi.aff.join() === 'ice,poison' && fi.fusedLv === 0, 'Arcanista con 2 runas de equipo: sella la pareja', fi.aff);
await ev('__arcano.unequipAll()');

// ---------- Sintonía y definitivo del Arcanista ----------
await ev(`__arcano.school('fire')`); await ev(`__arcano.give('fire')`);
await P(`P.mana = 10;`);
await ev(`__arcano.awaken('fire')`);
r = await P(`return { mana: P.mana, fire: P.sk.fire, t: A.toasts() };`);
ok(r.mana === 100 && r.fire === 2 && r.t.some(x => /SINTONÍA/.test(x)), 'Sintonía: runa ya al máximo → definitivo lleno', r);
await ev(`__arcano.school('arcane')`); await ev(`__arcano.awaken('bolt')`);
r = await P(`return { k: A.formInfo().ultKey, ic: document.querySelector('#btnUlt .in').textContent };`);
ok(r.k === 'bolt' && r.ic === '🌩️', 'Arcanista despertado: Tormenta en el botón', r);

// ---------- Teclado y pausa durante la cinemática ----------
console.log('--- Teclas y pausa');
await ev(`__arcano.school('ice')`); await ev('__arcano.god(true)');
await ev('__arcano.clear()'); await ev('__arcano.step(0.2)'); await ev('__arcano.offer()');
await sleep(650);
await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Digit1', key: '1', windowsVirtualKeyCode: 49 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Digit1', key: '1', windowsVirtualKeyCode: 49 });
fi = await info();
ok(fi.awakenFx && fi.awakenFx.el === 'fire', 'la tecla 1 elige la primera carta (Fuego)', fi.awakenFx);
await ev('__arcano.step(0.3)');
await ev(`window.dispatchEvent(new Event('blur'))`);
ok(await ev('__arcano.state') === 'paused', 'blur pausa en plena transformación');
await ev('__arcano.step(1)');
ok((await info()).awakenFx.t < 0.35, 'en pausa no avanza');
await ev(`document.querySelector('[data-act="resume"]').click()`);
await ev('__arcano.step(1.3)');
fi = await info();
ok(!fi.awakenFx && fi.form === 'ignea' && fi.aff.join() === 'ice,fire', 'al reanudar termina la secuencia (Criomante → Ígnea, sella opuestos)', fi);
r = await P(`P.x = 270; P.y = 878; return A.hzCells(4).length;`);

// ---------- Sin formas (flags.noForms): como antes ----------
console.log('--- Sin formas');
await ev('__arcano.flags.noForms = true');
await run('fire', [], 1);
await ev(`__arcano.give('ice')`); await ev(`__arcano.give('bolt')`);
fi = await info();
ok(fi.aff.length === 0 && !(await ev(`document.getElementById('btnUlt').classList.contains('anima')`)), 'sin Afinidad ni anillo');
let rolls = new Set(); for (let i = 0; i < 40; i++) (await ev('__arcano.roll(3)')).forEach(x => rolls.add(x));
ok(rolls.has('poison'), 'todas las runas siguen saliendo', [...rolls].filter(x => ['fire', 'ice', 'bolt', 'poison'].includes(x)));
await ev('__arcano.anima(500)');
ok(!(await info()).ready, 'el Ánima no hace nada');
await ev('__arcano.step(3)');
ok((await ev('__arcano.shots.every(s => !s.sty)')), 'disparos sin estilo de forma (dibujo de siempre)');
await ev('__arcano.flags.noForms = false');

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
