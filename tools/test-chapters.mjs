// Pruebas de lógica pura de public/chapters.js (docs/progresion-spec.md §9.1): node tools/test-chapters.mjs
// validate() vacío, el C1_LEGACY reproduce los números de siempre, tablas del §2.2, récords, progreso, migración y desbloqueos.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../public/chapters.js', import.meta.url), 'utf8');
const ctx = { window: {}, Math: Object.create(Math) };
ctx.Math.random = () => { throw new Error('chapters.js no puede usar Math.random'); };
vm.createContext(ctx);
vm.runInContext(SRC, ctx);
const C = ctx.window.ArcanoChapters;

let fails = 0, oks = 0;
const ok = (cond, name, extra) => { if (cond) oks++; else { fails++; console.log('FALLO', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const near = (a, b, e = 0.006) => Math.abs(a - b) <= e;

// ---------- estructura ----------
ok(!/Math\.random/.test(SRC.replace(/\/\/.*$/gm, '')), 'sin Math.random en el código');
ok(C.validate().length === 0, 'validate() vacío', C.validate());
const ch = C.get(1, false);
ok(ch && ch.id === 1 && ch.len === 20 && ch.k === 0 && ch.cEf === 1, 'get(1) resuelto', ch && { id: ch.id, k: ch.k });
ok(ch !== C.C1_LEGACY && ch.bosses !== C.C1_LEGACY.bosses && ch.pool !== C.C1_LEGACY.pool && ch.altars !== C.C1_LEGACY.altars, 'get() copia los objetos internos');
ok(C.get(1, false) === ch, 'get() cacheado');
ok(C.get(99, false) === null, 'capítulo que no existe = null');
ok(Object.keys(ch.pool).join() === 'slime,bat,archer,charger,mage,bigslime,bomber,totem,spirit', 'plantel en el orden de ENEMY_UNLOCK');

// ---------- el C1 de siempre, número a número (mismo cálculo que game.js antes del refactor) ----------
const OLD_BOSSES = {
  5: { tier: 1, name: 'Gólem de Piedra', hp: 480, r: 40, speed: 55, color: '#8f8270', bullet: '#ffb347', pats: ['ring', 'charge', 'aimed'], title: 'Guardián de la pradera', ach: 'boss1', model: 'golem' },
  10: { tier: 2, name: 'Rey Slime', hp: 1150, r: 42, speed: 65, color: '#57c75e', bullet: '#b6ff6b', pats: ['summon', 'ring', 'charge', 'aimed'], title: 'Monarca de la cripta', ach: 'boss2', model: 'rey' },
  15: { tier: 3, name: 'Brujo Sombrío', hp: 2600, r: 34, speed: 45, color: '#6d4bd8', bullet: '#c58bff', pats: ['spiral', 'teleport', 'aimed', 'summon', 'ring'], title: 'Tirano de la gruta helada', ach: 'boss3', model: 'brujo' },
  20: { tier: 4, name: 'Señor de la Mazmorra', hp: 4700, r: 44, speed: 70, color: '#d63c3c', bullet: '#ff6a3d', pats: ['spiral', 'charge', 'ring', 'summon', 'teleport', 'aimed'], title: 'Corazón del volcán', ach: 'boss4', model: 'senor' },
};
const UNLOCK = { slime: 1, bat: 1, archer: 2, charger: 3, mage: 4, bigslime: 6, bomber: 6, totem: 7, spirit: 11 };
const forRoom = r => (r <= 5 ? 'pradera' : r <= 10 ? 'cripta' : r <= 15 ? 'cristal' : 'volcan');
for (let r = 1; r <= 20; r++) {
  const B = C.bossAt(ch, r), O = OLD_BOSSES[r];
  if (O) ok(B && Object.keys(O).every(k => JSON.stringify(B[k]) === JSON.stringify(O[k])) && B.ord === r / 5, `jefe de la sala ${r}`, B);
  else ok(B === null, `sin jefe en la sala ${r}`);
  ok(C.altarAt(ch, r) === [4, 9, 14, 19].includes(r), `altar sala ${r}`);
  ok(C.biomeAt(ch, r) === forRoom(r), `bioma sala ${r}`);
  ok(C.zoneStart(ch, r) === (r % 5 === 1) && C.zoneAt(ch, r) + 1 === Math.ceil(r / 5), `zona sala ${r}`);
  ok(C.hpMul(ch, false, r) === 1 + 0.2 * (r - 1) + 0.006 * (r - 1) * (r - 1), `vida sala ${r} (bit a bit)`);
  ok(C.dmgMul(ch, false, r) === 1 + 0.07 * (r - 1), `daño sala ${r} (bit a bit)`);
  ok(C.enemyLv(ch, false, r) === r, `nivel sala ${r}`);
  const P = C.budget(ch, false, r);
  ok(P.budget === 3.5 + r * 0.55 && P.maxN === 11 && JSON.stringify(P.caps) === '{"totem":2,"spirit":3,"bomber":3,"bigslime":2}', `presupuesto sala ${r} (bit a bit)`, P);
  ok(P.pool.join() === Object.keys(UNLOCK).filter(k => r >= UNLOCK[k]).join(), `plantel sala ${r}`);
  const fa = C.firstAttack(ch, false, r);
  ok(fa[0] === 0.6 && fa[1] === 1.6 && C.spawnDist(ch, r) === 300, `primer ataque y aparición sala ${r}`);
  const E = C.eliteParams(ch, false, r);
  ok(E.p === (r >= 6 ? 0.1 + r * 0.006 : 0) && E.max === 2 && E.dual === 0 && E.affixes.length === 0, `élites sala ${r} (bit a bit)`, E);
  ok(C.lootDepth(ch, false, r, 3) === Math.min(20, r + 3) && C.lootDepth(ch, false, r) === r, `botín sala ${r}`);
  ok(C.wavesAt(ch, false, r) === null && C.heroCount(ch, false, r) === 0, `sin refuerzos ni héroes sala ${r}`);
}
const Z = C.hazard(ch, false, 7);
ok(Z.from === 3 && Z.chance === 0.6 && Z.n.join() === '2,3' && Z.special === 0.55, 'trampas como siempre', Z);
ok(JSON.stringify(C.chest(ch)) === '{"from":2,"p":0.2,"max":3}', 'cofres como siempre');
const H = C.heal(ch, false);
ok(H.boss === 0.25 && H.bossHearts === 2 && H.heart === 0.06 && H.eliteHeart === 0.3 && H.heartVal === 0.15 && H.chest === 0.15 && H.altar === 0.6, 'curas como siempre', H);
ok(JSON.stringify(C.nets(ch)) === '{"a":1,"b":2,"c":3}' && C.markRoom(ch) === 6 && C.anima(ch) === null, 'redes, Marca II y Ánima como siempre');
ok(C.essMul(ch, false) === 1 && C.bulletMul(ch, false) === 1 && C.tintAt(ch, false, 3) === null, 'esencia ×1, balas ×1, sin tinte');
ok(JSON.stringify(C.milestones(ch)) === '[7,14,20]', 'hitos del C1');
ok(C.starsFor(ch, 6, false) === 0 && C.starsFor(ch, 7, false) === 1 && C.starsFor(ch, 14, false) === 2 && C.starsFor(ch, 20, false) === 2 && C.starsFor(ch, 20, true) === 3, 'estrellas por sala');

// ---------- tablas del §2.2 (capítulo de prueba con k = 0..6) ----------
const chK = k => Object.assign(C.deepMerge(C.C1_LEGACY, { id: k + 1 }), { k });
const T = { hp: [1, 1.12, 1.25, 1.40, 1.57, 1.76, 1.97], dmg: [1, 1.06, 1.12, 1.19, 1.26, 1.34, 1.42], bul: [1, 1.04, 1.08, 1.12, 1.17, 1.20, 1.20], ess: [1, 1.1, 1.2, 1.4, 1.5, 1.6, 1.8] };
for (let k = 0; k <= 6; k++) {
  const c = chK(k), r = 10;
  ok(C.k(c, false) === k, `k = ${k}`);
  ok(near(C.hpMul(c, false, r) / C.hpMul(ch, false, r), T.hp[k]), `vida ×1,12^${k}`, C.hpMul(c, false, r) / C.hpMul(ch, false, r));
  ok(near(C.dmgMul(c, false, r) / C.dmgMul(ch, false, r), T.dmg[k]), `daño ×1,06^${k}`);
  ok(near(C.bulletMul(c, false), T.bul[k]), `balas k ${k}`, C.bulletMul(c, false));
  ok(C.enemyLv(c, false, r) === r + Math.min(12, 3 * k), `nivel r+min(12,3k) k ${k}`);
  ok(near(C.budget(c, false, r).budget - C.budget(ch, false, r).budget, 0.4 * k + 0.04 * k * r, 1e-9) && C.budget(c, false, r).maxN === Math.min(16, 11 + k), `presupuesto k ${k}`);
  const E = C.eliteParams(c, false, 12);
  ok(near(E.p, 0.1 + 0.02 * k + 0.006 * 12, 1e-9) && E.max === (k >= 4 ? 4 : k >= 1 ? 3 : 2) && E.dual === (k >= 3 ? 0.35 : k >= 1 ? 0.2 : 0), `élites k ${k}`, E);
  ok(C.essMul(c, false) === T.ess[k], `esencia k ${k}`);
  ok(C.lootDepth(c, false, 18) === Math.min(20, 18 + 3 * k), `botín k ${k}`);
}
// Héroe = números del Normal N+3
const h1 = C.get(1, true);
ok(h1.hero === true && h1.cEf === 4 && h1.k === 3 && C.k(h1, true) === 3, 'Héroe 1 = c_ef 4, k 3');
ok(C.get(1, true) !== C.get(1, false), 'Héroe y Normal cacheados por separado');
ok(near(C.hpMul(h1, true, 10) / C.hpMul(ch, false, 10), 1.40) && C.enemyLv(h1, true, 5) === 14, 'Héroe 1: vida ×1,40 y nivel r+9');
ok(C.bossAt(h1, 20).hp === Math.round(4700 * Math.pow(1.12, 3) * 1e6) / 1e6 || near(C.bossAt(h1, 20).hp, 4700 * Math.pow(1.12, 3), 1e-6), 'Héroe: vida absoluta de jefe × 1,12³');
ok(C.bossAt(h1, 20).phase2At === 0.6 && C.bossAt(h1, 20).phase3At === 0.35 && C.bossAt(ch, 20).phase3At === 0.25 && C.bossAt(ch, 5).phase3At === 0, 'fases de jefe 50/25 (Héroe 60/35)');
const Hh = C.heal(h1, true);
ok(Hh.boss === 0.05 && Hh.bossHearts === 1 && near(Hh.heart, 0.03, 1e-9) && Hh.altar === 0.5 && Hh.chest === 0.1, 'curas de Héroe', Hh);
ok(C.heroCount(h1, true, 1) === 0 && C.heroCount(h1, true, 2) === 1 && C.heroCount(h1, true, 11) === 2 && C.heroCount(h1, true, 5) === 0 && C.heroCount(h1, true, 4) === 0, 'monstruos héroe por sala');
ok(C.wavesAt(h1, true, 7) && C.wavesAt(h1, true, 16) && !C.wavesAt(h1, true, 8), 'refuerzos extra del Héroe 1 (7 y 16)');
const Zh = C.hazard(h1, true, 7);
ok(near(Zh.chance, 0.8, 1e-9) && Zh.n.join() === '3,4', 'trampas de Héroe', Zh);
// vida de jefe por sala real (puntos K3) y extrapolación
ok(C.bossHp(5) === 720 && C.bossHp(10) === 1725 && C.bossHp(15) === 3900 && C.bossHp(20) === 7050, 'BOSS_HP en los puntos');
ok(C.bossHp(3) < 720 && C.bossHp(3) >= 300 && C.bossHp(1) >= 300 && C.bossHp(12) > 1725 && C.bossHp(12) < 3900, 'BOSS_HP entre puntos y por debajo de la sala 5', [C.bossHp(1), C.bossHp(3), C.bossHp(12)]);

// ---------- récords (S.best) ----------
for (let v = 1; v <= 21; v++) { const d = C.decodeBest(v); ok(d.ch === 1 && !d.hero && d.win === (v === 21) && d.room === Math.min(20, v), `récord antiguo ${v}`, d); }
for (let id = 1; id <= 4; id++) for (const hero of [false, true]) for (const win of [false, true]) for (let room = 1; room <= 20; room++) {
  const c = { id, len: 20 }, v = C.encodeBest(c, hero, room, win), d = C.decodeBest(v);
  if (!(d.ch === id && d.hero === hero && d.win === win && (win || d.room === room))) ok(false, 'ida y vuelta de encodeBest', { id, hero, room, win, v, d });
}
ok(true, 'encodeBest/decodeBest de ida y vuelta');
const enc = (id, hero, room, win) => C.encodeBest({ id, len: 20 }, hero, room, win);
ok(C.bestRank(enc(1, false, 20, true)) > C.bestRank(enc(1, false, 20, false)), 'victoria > sala');
ok(C.bestRank(enc(2, false, 3, false)) > C.bestRank(21), 'C2·S3 > victoria del C1');
ok(C.bestRank(enc(1, true, 5, false)) > C.bestRank(enc(4, false, 5, false)), 'Héroe 1 por delante del C4 si empatan');
ok(C.bestRank(enc(1, true, 2, false)) > C.bestRank(enc(3, false, 20, true)), 'H1 (c_ef 4) > C3');

// ---------- progreso ----------
const P0 = C.PROG_DEFAULT();
ok(JSON.stringify(P0) === '{"n":1,"d":0,"h":0,"st":"00000000","b":{},"t":-1,"af":0}', 'PROG_DEFAULT');
const pr = { n: 3, d: 3, h: 1, st: '33210000', b: { 1: '20.20.15.1.272.fire', '1h': '7.20.9.0.0.ice', 2: '12.15.10.0.0.poison' }, t: 2, af: 5 };
const packed = C.progPack(pr);
ok(JSON.stringify(C.progUnpack(packed)) === JSON.stringify(C.progValid(pr)), 'progPack de ida y vuelta', packed);
ok(C.progPack(P0) === '1.0.0.00000000.-1.0', 'progPack vacío', C.progPack(P0));
const bad = C.progValid({ n: 'x', d: -3, h: 1.7, st: '9999', b: { 9: 'x', zz: '1.20.1.0.0.fire', 3: 12 }, t: 'a', af: null });
ok(JSON.stringify(bad) === '{"n":1,"d":0,"h":1,"st":"00000000","b":{},"t":-1,"af":0}', 'progValid con basura', bad);
ok(JSON.stringify(C.progUnpack('basura|a:b,c')) === JSON.stringify(P0) && JSON.stringify(C.progUnpack(null)) === JSON.stringify(P0), 'progUnpack con basura');
ok(packed.length < 120, 'prog compacto', packed.length);
// migración de un guardado sin prog
const m1 = C.migrate({ stats: { wins: 2, best: { fire: 21, ice: 9 } } }, { room: 20, lvl: 16, win: true, school: 'fire' });
ok(m1.d === 1 && m1.n === 2 && m1.st[0] === '3' && m1.b['1'] === '20.20.16.1.0.fire', 'migración con victorias', m1);
const m2 = C.migrate({ stats: { wins: 0, best: { fire: 15 } } }, null);
ok(m2.d === 0 && m2.n === 1 && m2.st === '20000000', 'migración: récord ≥ 14 = ★★', m2);
const m3 = C.migrate({ stats: { wins: 0, best: { fire: 8, ice: 3 } } });
ok(m3.st === '10000000' && JSON.stringify(m3.b) === '{}', 'migración: récord ≥ 7 = ★', m3);
ok(JSON.stringify(C.migrate({ stats: {} })) === JSON.stringify(P0) && JSON.stringify(C.migrate(null)) === JSON.stringify(P0), 'migración de una cuenta nueva');
ok(JSON.stringify(C.migrate({ prog: pr, stats: { wins: 0 } })) === JSON.stringify(C.progValid(pr)), 'con prog no se migra');

// ---------- desbloqueos: todas las combinaciones ----------
const bit = (m, c) => !!(m & (1 << (c - 1)));
let n = 0;
for (let d = 0; d < 16; d++) for (let h = 0; h < 16; h++) for (let id = 0; id <= 5; id++) for (const hero of [false, true]) {
  const prog = { d, h }, real = C.isUnlocked(prog, id, hero);
  let want;
  if (id < 1 || id > 4) want = false;
  else if (!hero) want = id === 1 || bit(d, id - 1); // Normal N: completar el Normal N-1
  else want = bit(d, 2) && bit(d, id) && (id === 1 || bit(h, id - 1)); // Héroe: C2 completado, Normal N y Héroe N-1
  if (real !== want) ok(false, 'isUnlocked', { d, h, id, hero, real, want });
  n++;
}
ok(n === 16 * 16 * 6 * 2, 'isUnlocked en todas las combinaciones');
ok(!C.isUnlocked({ d: 1, h: 0 }, 1, true), 'Héroe cerrado sin completar el C2');
ok(C.isUnlocked({ d: 3, h: 0 }, 1, true) && !C.isUnlocked({ d: 3, h: 0 }, 2, true) && C.isUnlocked({ d: 3, h: 1 }, 2, true), 'Héroe 1 abierto con el C2; Héroe 2 pide el Héroe 1');
// siguiente capítulo (con un solo capítulo cargado: tras el C1 no hay Normal siguiente; si el Héroe 1 está abierto, se ofrece)
ok(C.nextChapter(1, false, { d: 1, h: 0 }) === null, 'sin siguiente con solo el C1');
ok(JSON.stringify(C.nextChapter(1, false, { d: 3, h: 0 })) === '{"id":1,"hero":true}', 'probar el Héroe');
ok(C.nextChapter(1, true, { d: 3, h: 1 }) === null, 'sin más Héroes');

console.log(fails ? `${fails} FALLOS (${oks} bien)` : `TODO OK (${oks} comprobaciones)`);
process.exit(fails ? 1 : 0);
