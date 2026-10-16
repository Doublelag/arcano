'use strict';
// =====================================================================================================
//  Arcano · Capítulos (docs/progresion-spec.md §9.1): datos y lógica pura de capítulos, Modo Héroe y progreso.
//  Script clásico que expone window.ArcanoChapters. Sin DOM, sin canvas y SIN Math.random: game.js gasta el azar
//  exactamente igual que antes (la misma semilla da la misma partida).
//  Si este fichero no carga, game.js usa CH_FALLBACK (el Capítulo 1 de siempre embebido) y nada se rompe.
// =====================================================================================================
(() => {
  const VERSION = '1.1';
  const MAX_CH = 4; // capítulos previstos al lanzar (las máscaras de progreso y el desbloqueo trabajan con 1..MAX_CH)

  // ---------------------------------------------- datos ----------------------------------------------
  // Modelos de jefe: dibujo (model), logro (ach), arena de trampas (arena) y su ataque extra (fase 5)
  const BOSS_DEFS = {
    golem: { model: 'golem', ach: 'boss1', arena: 'golem', name: 'Gólem de Piedra',      r: 40, speed: 55, color: '#8f8270', bullet: '#ff4d6d', pats: ['ring', 'charge', 'aimed'], extra: 'rocks' },
    rey:   { model: 'rey',   ach: 'boss2', arena: 'rey',   name: 'Rey Slime',            r: 42, speed: 65, color: '#57c75e', bullet: '#ff5a7a', pats: ['summon', 'ring', 'charge', 'aimed'], extra: 'slam' },
    brujo: { model: 'brujo', ach: 'boss3', arena: 'brujo', name: 'Brujo Sombrío',        r: 34, speed: 45, color: '#6d4bd8', bullet: '#ff5aa0', pats: ['spiral', 'teleport', 'aimed', 'summon', 'ring'], extra: 'mirror' },
    senor: { model: 'senor', ach: 'boss4', arena: 'senor', name: 'Señor de la Mazmorra', r: 44, speed: 70, color: '#d63c3c', bullet: '#ff2e63', pats: ['spiral', 'charge', 'ring', 'summon', 'teleport', 'aimed'], extra: 'sweep' },
  };
  // tipos de enemigo que existen en game.js (ENEMIES), en el orden de ENEMY_UNLOCK de siempre
  const ENEMY_KINDS = ['slime', 'bat', 'archer', 'charger', 'mage', 'bigslime', 'bomber', 'totem', 'spirit'];
  // afijos de élite (fase 5; colores corregidos K9: glifo blanco sobre el aura dorada de élite donde el color chocaba)
  const AFFIXES = [
    { id: 'veloz',     name: 'VELOZ',     color: '#ffcf4a', glyph: '»', tip: 'Se mueve y ataca más rápido' },
    { id: 'escudado',  name: 'ESCUDADO',  color: '#dfe6f0', glyph: '⬡', tip: 'Rompe su escudo y quedará aturdido' },
    { id: 'volatil',   name: 'VOLÁTIL',   color: '#ff8a3d', glyph: '✶', tip: 'No te quedes donde muere' },
    { id: 'invocador', name: 'INVOCADOR', color: '#ffcf4a', glyph: '✧', tip: 'Mátalo antes de que llame a más' },
    { id: 'vengador',  name: 'VENGADOR',  color: '#ff3b3b', glyph: '▲', tip: 'Se enfurece con cada baja: mátalo primero' },
    { id: 'charco',    name: 'CHARCO',    color: '#ffcf4a', glyph: '◌', tip: 'Deja rastro: no lo persigas' },
  ];
  const AFFIX_DENY = [['charco', 'veloz'], ['invocador', 'vengador']];
  // capa del Modo Héroe (fase 8): Héroe N juega con los números del Normal N+3
  const HERO = {
    add: 3, phase2At: 0.6, phase3At: 0.35, heroes: { from: 2, n: 1, n2AfterHalf: 1 },
    heal: { boss: 0.05, bossHearts: 1, heartK: 0.5, altarDelta: -0.10, chest: 0.10 },
    hazard: { chance: 0.2, n: 1 }, extraWaves: { 1: [7, 16], 2: [7, 11], 3: [7, 11], 4: [1] },
    tint: { color: '#c77dff', a: 0.08 }, title: ['Cazador de Héroes', 'Verdugo de Ceniza', 'Corazón de Escarcha', 'Leyenda de Arcano'],
  };
  const HERO_MOVES = { slime: 'slam', bat: 'dash', archer: 'fan5', charger: 'dash2', mage: 'ring2', bigslime: 'split3', bomber: 'lava', totem: 'spiral', spirit: 'tp2' };
  // vida de jefe por sala real (D13 corregido por K3: ×1,5 sobre la de hoy); interpolación logarítmica
  const BOSS_HP_PTS = [[5, 720], [10, 1725], [15, 3900], [20, 7050]];
  const ESS_MUL = [1, 1.1, 1.2, 1.4, 1.5, 1.6, 1.8];

  // Capítulo 1 tal y como es hoy (fases 1-3): reproduce el juego bit a bit. En la fase 4 lo sustituye el C1 v1.1.
  const C1_LEGACY = {
    id: 1, name: 'La Mazmorra', short: 'Mazmorra', len: 20, format: 'std',
    zones: [['pradera', 5], ['cripta', 5], ['cristal', 5], ['volcan', 5]],
    tint: null, enemyTint: null,
    bosses: {
      5:  { id: 'golem', tier: 1, hp: 480,  title: 'Guardián de la pradera' },
      10: { id: 'rey',   tier: 2, hp: 1150, title: 'Monarca de la cripta' },
      15: { id: 'brujo', tier: 3, hp: 2600, title: 'Tirano de la gruta helada' },
      20: { id: 'senor', tier: 4, hp: 4700, title: 'Corazón del volcán', final: true },
    },
    altars: [4, 9, 14, 19],
    pool: { slime: 1, bat: 1, archer: 2, charger: 3, mage: 4, bigslime: 6, bomber: 6, totem: 7, spirit: 11 },
    caps: { totem: 2, spirit: 3, bomber: 3, bigslime: 2 },
    budget: { base: 3.5, per: 0.55, maxN: 11 }, budgetMul: 1, budgetEarly: 1,
    waves: [], spawnDist: [300, 300], spawnStep: 0.05, firstAtk: [[0.6, 1.6], [0.6, 1.6]],
    elite: { from: 6, max: 2, p0: 0.1, pr: 0.006, affixes: {} },
    hazard: { from: 3, chance: 0.6, n: [2, 3], special: 0.55, arenaK: 1 },
    chest: { from: 2, p: 0.2, max: 3 },
    heal: { boss: 0.25, bossHearts: 2, heart: 0.06, eliteHeart: 0.3, heartVal: 0.15, chest: 0.15, altar: 0.6 },
    loot: { cap: 20, chest: 3 },
    anima: null, nets: { a: 1, b: 2, c: 3 }, markRoom: 6,
    stars: [7, 14], title2: 'Caminante de la Mazmorra', tint3: 'Piedra', speedrun: 270, unlock: null, music: { key: 0 },
    // avisos: abanico apuntado (s) y destino del teletransporte/espectro elegido al empezar (cambia el orden del azar)
    warn: { aimed: 0.25, early: false },
  };
  const CHAPTERS = [C1_LEGACY];

  // ------------------------------------------- utilidades -------------------------------------------
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  // copia profunda de base con over encima (los objetos internos se copian; las listas se sustituyen por copias)
  function deepMerge(base, over) {
    const out = {};
    for (const src of [base, over]) {
      if (!isObj(src)) continue;
      for (const k of Object.keys(src)) {
        const v = src[k];
        if (isObj(v)) out[k] = deepMerge(isObj(out[k]) ? out[k] : {}, v);
        else if (Array.isArray(v)) out[k] = v.map(x => (Array.isArray(x) ? x.slice() : isObj(x) ? deepMerge({}, x) : x));
        else out[k] = v;
      }
    }
    return out;
  }
  const int0 = v => (Number.isFinite(+v) && +v >= 0 ? Math.floor(+v) : 0);

  // ------------------------------------------- resolución -------------------------------------------
  const cache = new Map();
  const def = id => CHAPTERS.find(c => c.id === id) || null;
  // capítulo resuelto (herencia + capa HERO), con sus objetos internos copiados y cacheado; null si no existe
  function get(id, hero = false) {
    const key = id + (hero ? 'h' : '');
    if (cache.has(key)) return cache.get(key);
    const d = def(id);
    if (!d) return null;
    const ch = deepMerge(d, { hero: !!hero });
    ch.cEf = ch.id + (hero ? HERO.add : 0);
    ch.k = ch.cEf - 1;
    cache.set(key, ch);
    return ch;
  }
  const cEf = (ch, hero) => ch.id + (hero ? HERO.add : 0);
  const kOf = (ch, hero) => cEf(ch, hero) - 1;
  const lastRoom = ch => ch.len;
  const bossRooms = ch => Object.keys(ch.bosses).map(Number).sort((a, b) => a - b);

  // vida de jefe por sala real (por debajo de la sala 5, la pendiente del primer tramo; mínimo 300)
  function bossHp(r) {
    const P = BOSS_HP_PTS;
    let i = 0;
    while (i < P.length - 2 && r > P[i + 1][0]) i++;
    const [r0, h0] = P[i], [r1, h1] = P[i + 1];
    return Math.max(300, Math.round(h0 * Math.pow(h1 / h0, (r - r0) / (r1 - r0))));
  }
  // jefe de la sala r (modelo + entrada del capítulo) con su ordinal (1 = primer jefe del capítulo) y su vida
  function bossAt(ch, r) {
    const e = ch.bosses[r];
    if (!e) return null;
    const k = ch.k != null ? ch.k : kOf(ch, ch.hero), D = BOSS_DEFS[e.id];
    const hp = e.hp ? e.hp * (k + 1 > ch.id ? Math.pow(1.12, k + 1 - ch.id) : 1)
      : Math.round(bossHp(r) * (k ? Math.pow(1.12, k) : 1) * (e.hpMul || 1));
    return Object.assign({}, D, e, {
      pats: (e.pats || D.pats).slice(), ord: bossRooms(ch).indexOf(+r) + 1, tier: e.tier || Math.min(4, Math.ceil(r / 5)), hp,
      title: e.title || '', ascended: !!(e.ascended || ch.hero), final: !!e.final,
      phase2At: ch.hero ? HERO.phase2At : 0.5, phase3At: e.final ? (ch.hero ? HERO.phase3At : 0.25) : 0,
    });
  }
  const altarAt = (ch, r) => ch.altars.includes(r);
  // zona (bioma) de la sala r: índice en ch.zones (0-based); salas fuera de rango se pegan a la primera o la última
  function zoneAt(ch, r) {
    let acc = 0;
    for (let i = 0; i < ch.zones.length; i++) { acc += ch.zones[i][1]; if (r <= acc) return i; }
    return ch.zones.length - 1;
  }
  const biomeAt = (ch, r) => ch.zones[zoneAt(ch, r)][0];
  function zoneStart(ch, r) {
    let acc = 1;
    for (const z of ch.zones) { if (r === acc) return true; acc += z[1]; }
    return false;
  }
  function tintAt(ch, hero, r) { // tinte del capítulo y, en Héroe, el violeta encima (el que manda es el último)
    if (hero) return { color: HERO.tint.color, a: HERO.tint.a, mode: 'color', under: ch.tint || null };
    return ch.tint ? Object.assign({}, ch.tint) : null;
  }

  // ---------------------------------------------- curvas ----------------------------------------------
  // (con k = 0 cada fórmula devuelve exactamente el mismo número que el código de siempre: nada de multiplicar por 1,0…)
  function hpMul(ch, hero, r) {
    const k = kOf(ch, hero), h = 1 + 0.2 * (r - 1) + 0.006 * (r - 1) * (r - 1);
    return k ? h * Math.pow(1.12, k) : h;
  }
  function dmgMul(ch, hero, r) {
    const k = kOf(ch, hero), d = 1 + 0.07 * (r - 1);
    return k ? d * Math.pow(1.06, k) : d;
  }
  const bulletMul = (ch, hero) => Math.min(1.2, Math.pow(1.04, kOf(ch, hero)));
  const enemyLv = (ch, hero, r) => r + Math.min(12, 3 * kOf(ch, hero));
  // presupuesto de enemigos de la sala r: {budget, maxN, caps, pool} (pool en el orden de claves de ch.pool)
  function budget(ch, hero, r) {
    const k = kOf(ch, hero), B = ch.budget;
    let b = k ? (B.base + 0.4 * k) + (B.per + 0.04 * k) * r : B.base + r * B.per;
    if (r <= 3 && ch.budgetEarly !== 1) b *= ch.budgetEarly;
    if (ch.budgetMul !== 1) b *= ch.budgetMul;
    return { budget: b, maxN: Math.min(16, B.maxN + k), caps: Object.assign({}, ch.caps), pool: Object.keys(ch.pool).filter(x => r >= ch.pool[x]) };
  }
  // ventana del primer ataque [a, b] (game.js hace UNA llamada a rand(a, b))
  function firstAttack(ch, hero, r) {
    const k = kOf(ch, hero), w = ch.firstAtk[r <= 3 ? 0 : 1];
    return k ? [Math.max(0.25, w[0] - 0.03 * k), Math.max(0.25, w[1] - 0.03 * k)] : [w[0], w[1]];
  }
  const spawnDist = (ch, r) => ch.spawnDist[r <= 3 ? 0 : 1];
  // élites: p = 0 antes de `from` (game.js mantiene el cortocircuito y no gasta Math.random)
  function eliteParams(ch, hero, r) {
    const k = kOf(ch, hero), E = ch.elite;
    const p = r < E.from ? 0 : k ? (E.p0 + 0.02 * k) + E.pr * r : E.p0 + r * E.pr;
    const affixes = Object.keys(E.affixes || {}).filter(id => r >= E.affixes[id]);
    const dual = k >= 3 ? (r >= 8 ? 0.35 : 0) : k >= 1 ? (r >= 11 ? 0.2 : 0) : 0;
    return { p, max: Math.max(E.max, k >= 4 ? 4 : k >= 1 ? 3 : 0), affixes, dual };
  }
  // monstruos héroe de la sala (solo Héroe, salas normales desde la 2 y la antesala)
  function heroCount(ch, hero, r) {
    if (!hero || r < HERO.heroes.from || ch.bosses[r] || altarAt(ch, r)) return 0;
    return HERO.heroes.n + (r > ch.len / 2 ? HERO.heroes.n2AfterHalf : 0);
  }
  function wavesAt(ch, hero, r) {
    const extra = hero ? HERO.extraWaves[ch.id] || [] : [];
    return ch.waves.includes(r) || extra.includes(r) ? { share: 0.4, at: 0.3 } : null;
  }
  function hazard(ch, hero, r) {
    const Z = ch.hazard;
    if (!hero) return { from: Z.from, chance: Z.chance, n: Z.n.slice(), special: Z.special, arenaK: Z.arenaK };
    return { from: Z.from, chance: Math.min(1, Z.chance + HERO.hazard.chance), n: [Z.n[0] + HERO.hazard.n, Z.n[1] + HERO.hazard.n], special: Z.special, arenaK: Z.arenaK };
  }
  const chest = ch => Object.assign({}, ch.chest);
  function heal(ch, hero) {
    const H = Object.assign({}, ch.heal);
    if (hero) {
      const X = HERO.heal;
      Object.assign(H, { boss: X.boss, bossHearts: X.bossHearts, heart: H.heart * X.heartK, eliteHeart: H.eliteHeart * X.heartK, chest: X.chest,
        altar: Math.round((H.altar + X.altarDelta) * 100) / 100 });
    }
    return H;
  }
  // profundidad de botín (add: +3 en los cofres)
  const lootDepth = (ch, hero, r, add = 0) => Math.min(ch.loot.cap, r + add + 3 * kOf(ch, hero));
  const essMul = (ch, hero) => ESS_MUL[Math.min(ESS_MUL.length - 1, kOf(ch, hero))];
  const anima = ch => (ch.anima ? ch.anima.slice() : null);
  const nets = ch => Object.assign({}, ch.nets);
  const markRoom = ch => ch.markRoom;

  // ------------------------------------------ hitos y récords ------------------------------------------
  const milestones = ch => [ch.stars[0], ch.stars[1], ch.len];
  const starsFor = (ch, room, win) => (win ? 3 : room >= ch.stars[1] ? 2 : room >= ch.stars[0] ? 1 : 0);
  // S.best[escuela]: < 100 = C1 Normal de siempre (1-20 sala, 21 victoria); nuevos ch·100 + (Héroe 50) + (victoria 49 | sala)
  const encodeBest = (ch, hero, room, win) => ch.id * 100 + (hero ? 50 : 0) + (win ? 49 : Math.min(48, room));
  function decodeBest(v) {
    v = int0(v);
    if (v < 100) return { ch: 1, hero: false, room: Math.min(20, v), win: v >= 21 };
    const id = Math.floor(v / 100), rest = v % 100, hero = rest >= 50, x = rest - (hero ? 50 : 0);
    return { ch: id, hero, room: x === 49 ? (def(id) ? def(id).len : null) : x, win: x === 49 };
  }
  function bestRank(v) {
    const d = decodeBest(v);
    return (d.ch + (d.hero ? HERO.add : 0)) * 100 + (d.win ? 99 : d.room || 0) + (d.hero ? 0.5 : 0);
  }

  // ----------------------------------------- progreso (meta.prog) -----------------------------------------
  // n = Normal más alto abierto · d / h = máscaras de Normal / Héroe completados (bit c-1) · st = estrellas 0-3
  // (0-3 Normal, 4-7 Héroe) · b = récords {'1': 'room.len.lvl.win.time.school', '1h': …} · t = título · af = afijos
  const PROG_DEFAULT = () => ({ n: 1, d: 0, h: 0, st: '00000000', b: {}, t: -1, af: 0 });
  const heroOpen = prog => !!(prog.d & 2); // el Modo Héroe se abre al completar el C2 Normal
  // abierto: Normal N si es el 1 o se completó el N-1; Héroe N si el Héroe está abierto, el Normal N completado y el Héroe N-1 completado
  function isUnlocked(prog, id, hero) {
    if (!prog || id < 1 || id > MAX_CH) return false;
    if (!hero) return id === 1 || !!(prog.d & (1 << (id - 2)));
    return heroOpen(prog) && !!(prog.d & (1 << (id - 1))) && (id === 1 || !!(prog.h & (1 << (id - 2))));
  }
  // lo que ofrece «SIGUIENTE CAPÍTULO» tras ganar: el siguiente del mismo modo; si no hay, el primer Héroe pendiente; o null
  function nextChapter(id, hero, prog) {
    if (def(id + 1) && isUnlocked(prog, id + 1, hero)) return { id: id + 1, hero: !!hero };
    if (!hero) for (const c of CHAPTERS) if (isUnlocked(prog, c.id, true) && !(prog.h & (1 << (c.id - 1)))) return { id: c.id, hero: true };
    return null;
  }
  const RECORD_RE = /^\d{1,2}\.\d{1,2}\.\d{1,2}\.[01]\.\d{1,5}\.[a-z]{1,8}$/;
  function progValid(s) {
    const p = PROG_DEFAULT();
    if (!isObj(s)) return p;
    p.n = Math.min(MAX_CH, Math.max(1, int0(s.n) || 1));
    p.d = int0(s.d) & 255; p.h = int0(s.h) & 255; p.af = int0(s.af) & 255;
    p.st = typeof s.st === 'string' && /^[0-3]{8}$/.test(s.st) ? s.st : p.st;
    p.t = Number.isInteger(s.t) && s.t >= -1 && s.t < 64 ? s.t : -1;
    if (isObj(s.b)) for (const k of Object.keys(s.b)) if (/^[1-9]h?$/.test(k) && typeof s.b[k] === 'string' && s.b[k].length <= 40 && RECORD_RE.test(s.b[k])) p.b[k] = s.b[k];
    return p;
  }
  // cookie: "n.d.h.st.t.af|1:7.20.9.0.0.fire,1h:…"
  function progPack(prog) {
    const p = progValid(prog), recs = Object.keys(p.b).map(k => k + ':' + p.b[k]).join(',');
    return [p.n, p.d, p.h, p.st, p.t, p.af].join('.') + (recs ? '|' + recs : '');
  }
  function progUnpack(str) {
    if (typeof str !== 'string') return PROG_DEFAULT();
    const [head, recs] = str.split('|'), f = head.split('.');
    const b = {};
    if (recs) for (const r of recs.split(',')) { const i = r.indexOf(':'); if (i > 0) b[r.slice(0, i)] = r.slice(i + 1); }
    return progValid({ n: +f[0], d: +f[1], h: +f[2], st: f[3], t: +f[4], af: +f[5], b });
  }
  // guardado sin prog: lo que ya se había conseguido en el C1 (sin pagar la esencia de la ★★★ con efecto retroactivo)
  // oldBest = store 'best' de siempre ({room, lvl, win, school}) → prog.b['1']
  function migrate(meta, oldBest) {
    if (meta && isObj(meta.prog)) return progValid(meta.prog);
    const p = PROG_DEFAULT(), S = (meta && meta.stats) || {};
    let st = 0;
    if (int0(S.wins) > 0) { p.d |= 1; p.n = 2; st = 3; }
    const best = Math.max(0, ...Object.values(isObj(S.best) ? S.best : {}).map(int0));
    if (best >= 21) st = 3; else if (best >= 14) st = Math.max(st, 2); else if (best >= 7) st = Math.max(st, 1);
    p.st = st + p.st.slice(1);
    if (isObj(oldBest) && oldBest.room) {
      const school = /^[a-z]{1,8}$/.test(oldBest.school) ? oldBest.school : 'fire';
      p.b['1'] = [Math.min(20, int0(oldBest.room)), 20, Math.min(99, int0(oldBest.lvl)), oldBest.win ? 1 : 0, 0, school].join('.');
    }
    return progValid(p);
  }

  // ---------------------------------------------- validación ----------------------------------------------
  function validate() {
    const err = [];
    const legacyOrder = ENEMY_KINDS.join(',');
    for (const c of CHAPTERS) {
      const t = `C${c.id}`, br = bossRooms(c);
      if (!(c.len > 0 && c.len < 50)) err.push(`${t}: len ${c.len}`);
      if (!c.bosses[c.len]) err.push(`${t}: la última sala no es de jefe`);
      for (const r of br) if (!BOSS_DEFS[c.bosses[r].id]) err.push(`${t}: jefe desconocido ${c.bosses[r].id}`);
      for (const r of br) if (r < 1 || r > c.len) err.push(`${t}: jefe fuera de rango (sala ${r})`);
      for (const r of c.altars) if (c.bosses[r] || r < 1 || r > c.len) err.push(`${t}: altar en la sala ${r}`);
      if (c.zones.reduce((a, z) => a + z[1], 0) !== c.len) err.push(`${t}: las zonas no suman ${c.len}`);
      for (const k of Object.keys(c.pool)) if (!ENEMY_KINDS.includes(k)) err.push(`${t}: enemigo desconocido ${k}`);
      for (const r of c.waves || []) if (c.bosses[r] || c.altars.includes(r)) err.push(`${t}: refuerzos en la sala ${r}`);
      if (c.id === 1 && Object.keys(c.pool).join(',') !== legacyOrder) err.push(`${t}: el plantel no sigue el orden de ENEMY_UNLOCK`);
      if (!(c.stars[0] < c.stars[1] && c.stars[1] <= c.len)) err.push(`${t}: hitos ${c.stars}`);
      for (const n of ['a', 'b', 'c']) if (!(c.nets[n] >= 1 && c.nets[n] <= br.length)) err.push(`${t}: red ${n} = ${c.nets[n]}`);
      if (CHAPTERS.filter(x => x.id === c.id).length > 1) err.push(`${t}: id repetido`);
    }
    return err;
  }

  window.ArcanoChapters = {
    VERSION, MAX_CH, BOSS_DEFS, ENEMY_KINDS, AFFIXES, AFFIX_DENY, HERO, HERO_MOVES, BOSS_HP_PTS, ESS_MUL, CHAPTERS, C1_LEGACY,
    get, cEf, k: kOf, lastRoom, bossRooms, bossHp, bossAt, altarAt, zoneAt, biomeAt, zoneStart, tintAt,
    hpMul, dmgMul, bulletMul, enemyLv, budget, firstAttack, spawnDist, eliteParams, heroCount, wavesAt, hazard, chest, heal,
    lootDepth, essMul, anima, nets, markRoom, milestones, starsFor, encodeBest, decodeBest, bestRank,
    PROG_DEFAULT, heroOpen, isUnlocked, nextChapter, progValid, progPack, progUnpack, migrate, validate, deepMerge,
  };
})();
