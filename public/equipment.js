/* Arcano · sistema de equipo (4 huecos, 5 rarezas, fusión 3→1).
   Script clásico: expone window.ArcanoGear. Lógica pura: sin DOM, sin canvas, sin almacenamiento.

   NÚMEROS (referencia del jugador base: 100 de vida, 10 de daño, 5% crítico ×2, 30 de maná):
   - Rarezas: Común ×1 · Raro ×1,7 · Épico ×2,6 · Legendario ×3,8 · Mítico ×5,5 (multiplican las stats de común).
     Los % se redondean al 1% entero y los planos (vida, maná) a la unidad, por rareza.
   - Perk: se desbloquea en Épico (nivel 1) y mejora en Legendario y Mítico (nivel 2).
   - Equipo completo (una base por hueco), media de las 256 combinaciones:
       Común      ≈ +7% daño, +26 vida, +1,6% crítico, +1,5% cadencia  → daño efectivo ≈ +10%
       Legendario ≈ +26% daño, +98 vida, +6% crítico, +6% cadencia     → daño efectivo ≈ +41%
       Mítico     ≈ +37% daño, +142 vida                               → daño efectivo ≈ +63%
     Rango en legendario: build ofensiva ≈ +60% efectivo / ~55 de vida; build tanque ≈ +23% / ~150 de vida.
     (daño efectivo = daño × factor de crítico × cadencia; los perks van aparte).
   - Caída de rareza por sala (ver rarityOdds): sala 1 = 85% común / 15% raro; sala 5 ≈ 80/19/0,3;
     sala 10 ≈ 71/25/3/0,1; sala 20 ≈ 50,5/35/13/1,5. Mítico nunca cae: solo por fusión. */
(function () {
  'use strict';

  // ---------- huecos y rarezas ----------
  const SLOTS = [
    { id: 'baston',  name: 'Bastón',  icon: '🔱' },
    { id: 'tunica',  name: 'Túnica',  icon: '👘' },
    { id: 'anillo',  name: 'Anillo',  icon: '💍' },
    { id: 'amuleto', name: 'Amuleto', icon: '📿' },
  ];

  const RARITIES = [
    { id: 'comun',      name: 'Común',      color: '#b8b8c8', mult: 1 },
    { id: 'raro',       name: 'Raro',       color: '#4da3ff', mult: 1.7 },
    { id: 'epico',      name: 'Épico',      color: '#b06bff', mult: 2.6 },
    { id: 'legendario', name: 'Legendario', color: '#ffb547', mult: 3.8 },
    { id: 'mitico',     name: 'Mítico',     color: '#ff4d6d', mult: 5.5 },
  ];
  const MAX_R = RARITIES.length - 1;
  const PERK_R1 = 2; // Épico: perk nivel 1
  const PERK_R2 = 3; // Legendario: perk nivel 2

  // ---------- perks (el juego implementa los efectos) ----------
  const PERKS = {
    'startRune:fire':   { name: 'Brasa eterna',     desc1: 'Empiezas cada partida con la Runa de fuego',            desc2: 'Empiezas cada partida con la Runa de fuego a nivel 2' },
    'startRune:ice':    { name: 'Corazón helado',   desc1: 'Empiezas cada partida con la Runa de hielo',            desc2: 'Empiezas cada partida con la Runa de hielo a nivel 2' },
    'startRune:bolt':   { name: 'Chispa viva',      desc1: 'Empiezas cada partida con la Runa de rayo',             desc2: 'Empiezas cada partida con la Runa de rayo a nivel 2' },
    'startRune:poison': { name: 'Sangre de víbora', desc1: 'Empiezas cada partida con la Runa de veneno',           desc2: 'Empiezas cada partida con la Runa de veneno a nivel 2' },
    'extraShot':        { name: 'Eco arcano',       desc1: '+1 proyectil frontal',                                   desc2: '+2 proyectiles frontales' },
    'roomShield':       { name: 'Égida',            desc1: 'Empiezas cada sala con un escudo que absorbe un golpe', desc2: 'Escudo al empezar cada sala y te curas un 10% de la vida al limpiarla' },
    'lifeOnKill':       { name: 'Sed de sangre',    desc1: 'Cada baja te cura un 1% de la vida máxima',             desc2: 'Cada baja te cura un 2% de la vida máxima' },
    'manaRegen':        { name: 'Pozo de maná',     desc1: 'Tu definitivo se carga un 40% más rápido',              desc2: 'Tu definitivo se carga un 80% más rápido' },
    'thorns':           { name: 'Espinas',          desc1: 'Los enemigos que te tocan reciben daño',                desc2: 'Los enemigos que te tocan reciben el doble de daño' },
    'magnet':           { name: 'Imán de almas',    desc1: 'Las gemas te persiguen desde más lejos y +15% de experiencia', desc2: 'Las gemas te persiguen desde más lejos y +30% de experiencia' },
  };

  // ---------- bases (stats en Común) ----------
  function base(id, slot, name, icon, stats, perkId) {
    const p = PERKS[perkId];
    return { id, slot, name, icon, stats, perk: { id: perkId, desc1: p.desc1, desc2: p.desc2 } };
  }
  const BASES = [
    // Bastones: daño
    base('ascuas',    'baston',  'Bastón de Ascuas',          '🔥', { atkPct: 0.06, critPct: 0.01 },  'startRune:fire'),
    base('escarcha',  'baston',  'Vara de Escarcha',          '💎', { atkPct: 0.055, hpFlat: 6 },     'startRune:ice'),
    base('tormenta',  'baston',  'Cetro de la Tormenta',      '⚡', { atkPct: 0.05, rateP: 0.025 },   'startRune:bolt'),
    base('gemelo',    'baston',  'Báculo Gemelo',             '✨', { atkPct: 0.05, hpFlat: 4 },      'extraShot'),
    // Túnicas: vida
    base('peregrino', 'tunica',  'Túnica del Peregrino',      '🐚', { hpFlat: 13, speedP: 0.03 },     'roomShield'),
    base('carmesi',   'tunica',  'Manto Carmesí',             '🦇', { hpFlat: 11, atkPct: 0.025 },    'lifeOnKill'),
    base('zarzas',    'tunica',  'Túnica de Zarzas',          '🌵', { hpFlat: 16 },                   'thorns'),
    base('sombras',   'tunica',  'Capa de Sombras',           '🌑', { hpFlat: 11, dodgeP: 0.02 },     'manaRegen'),
    // Anillos: crítico, cadencia, esquiva
    base('rosa',      'anillo',  'Anillo de Rosa Sangrienta', '🌹', { critPct: 0.035, hpFlat: 4 },    'lifeOnKill'),
    base('enjambre',  'anillo',  'Anillo del Enjambre',       '🐝', { rateP: 0.04, atkPct: 0.01 },    'extraShot'),
    base('marea',     'anillo',  'Anillo de la Marea',        '🌙', { dodgeP: 0.025, hpFlat: 7 },     'magnet'),
    base('escorpion', 'anillo',  'Anillo del Escorpión',      '🦂', { critPct: 0.025, atkPct: 0.02 }, 'startRune:poison'),
    // Amuletos: maná, experiencia, velocidad
    base('buho',      'amuleto', 'Amuleto del Búho',          '🦉', { xpPct: 0.07, hpFlat: 7 },       'magnet'),
    base('arcano',    'amuleto', 'Colgante Arcano',           '🔮', { manaStart: 8, hpFlat: 7 },      'manaRegen'),
    base('viento',    'amuleto', 'Talismán del Viento',       '🍃', { speedP: 0.04, hpFlat: 8 },      'roomShield'),
    base('dragon',    'amuleto', 'Escama de Dragón',          '🐉', { manaStart: 5, hpFlat: 12 },     'thorns'),
  ];
  const BASE_BY_ID = {}, BASE_IDX = {};
  BASES.forEach((b, i) => { BASE_BY_ID[b.id] = b; BASE_IDX[b.id] = i; });

  // Claves de stats (orden de las líneas) y cómo se muestran
  const STAT_KEYS = ['atkPct', 'hpFlat', 'critPct', 'rateP', 'speedP', 'dodgeP', 'manaStart', 'xpPct'];
  const STAT_FMT = {
    atkPct:    { pct: true,  label: 'de daño' },
    hpFlat:    { pct: false, label: 'de vida máxima' },
    critPct:   { pct: true,  label: 'de prob. de crítico' },
    rateP:     { pct: true,  label: 'de cadencia' },
    speedP:    { pct: true,  label: 'de velocidad' },
    dodgeP:    { pct: true,  label: 'de esquiva' },
    manaStart: { pct: false, label: 'de maná inicial' },
    xpPct:     { pct: true,  label: 'de experiencia' },
  };
  // Peso de cada stat para power() (iguala aprox. el valor de cada hueco)
  const POWER_W = { atkPct: 1000, hpFlat: 4, critPct: 1200, rateP: 1000, speedP: 600, dodgeP: 1200, manaStart: 4, xpPct: 500 };

  // ---------- utilidades ----------
  function clampR(r) {
    r = Math.floor(Number(r));
    if (!isFinite(r) || r < 0) return 0;
    return r > MAX_R ? MAX_R : r;
  }
  function validR(r) { return typeof r === 'number' && r >= 0 && r <= MAX_R && Math.floor(r) === r; }
  function getBase(id) { return Object.prototype.hasOwnProperty.call(BASE_BY_ID, id) ? BASE_BY_ID[id] : null; }
  function isItem(it) { return !!(it && typeof it === 'object' && getBase(it.base) && validR(it.r)); }

  // Valor de una stat en una rareza, ya redondeado (% al entero, planos a la unidad)
  function statValue(key, v, r) {
    const x = v * RARITIES[r].mult;
    return STAT_FMT[key].pct ? Math.round(x * 100 + 1e-9) / 100 : Math.round(x + 1e-9);
  }
  function itemStats(it) {
    const b = getBase(it.base), out = {};
    for (const k of STAT_KEYS) if (b.stats[k]) out[k] = statValue(k, b.stats[k], it.r);
    return out;
  }
  function perkLevel(r) { return r >= PERK_R2 ? 2 : r >= PERK_R1 ? 1 : 0; }

  // ---------- API ----------
  function makeItem(baseId, rarity, uid) {
    if (!getBase(baseId)) return null;
    return { uid, base: baseId, r: clampR(rarity) };
  }

  // Probabilidades [comun, raro, epico, legendario, mitico] según la sala (1-20)
  function rarityOdds(depth) {
    let d = Number(depth);
    if (!isFinite(d)) d = 1;
    d = Math.max(1, Math.min(20, d));
    const t = (d - 1) / 19;
    const leg = d >= 10 ? 0.015 * Math.pow((d - 9) / 11, 2) : 0;
    const epi = d >= 5 ? 0.13 * Math.pow((d - 4) / 16, 1.4) : 0;
    const rar = 0.15 + 0.20 * t;
    return [1 - rar - epi - leg, rar, epi, leg, 0];
  }

  function rollDrop(depth, rand) {
    const R = typeof rand === 'function' ? rand : Math.random;
    const unit = () => { const x = Number(R()); return x >= 0 && x < 1 ? x : 0; };
    const odds = rarityOdds(depth);
    let x = unit(), r = 0, acc = 0;
    for (let i = 0; i < odds.length; i++) { acc += odds[i]; if (x < acc) { r = i; break; } r = i; }
    if (r > PERK_R2) r = PERK_R2; // mítico jamás cae
    while (r > 0 && odds[r] <= 0) r--;
    const b = BASES[Math.min(BASES.length - 1, Math.floor(unit() * BASES.length))];
    return { base: b.id, r };
  }

  function describe(item) {
    if (!isItem(item)) {
      return { name: 'Objeto desconocido', icon: '❔', slot: null, rarityName: RARITIES[0].name, color: RARITIES[0].color, lines: [], perk: null, nextPerk: null };
    }
    const b = getBase(item.base), rar = RARITIES[item.r], st = itemStats(item);
    const lines = [];
    for (const k of STAT_KEYS) {
      if (!(k in st)) continue;
      const f = STAT_FMT[k];
      lines.push('+' + (f.pct ? Math.round(st[k] * 100) + '%' : st[k]) + ' ' + f.label);
    }
    const lv = perkLevel(item.r);
    const perk = lv === 2 ? b.perk.desc2 : lv === 1 ? b.perk.desc1 : null;
    // Extra para la interfaz: qué desbloquea la siguiente rareza
    const nextPerk = lv === 0 ? 'En ' + RARITIES[PERK_R1].name + ': ' + b.perk.desc1
      : lv === 1 ? 'En ' + RARITIES[PERK_R2].name + ': ' + b.perk.desc2 : null;
    return { name: b.name, icon: b.icon, slot: b.slot, rarityName: rar.name, color: rar.color, lines, perk, nextPerk };
  }

  function statsOf(items) {
    const out = { atkPct: 0, hpFlat: 0, critPct: 0, rateP: 0, speedP: 0, dodgeP: 0, manaStart: 0, xpPct: 0, perks: {} };
    const list = Array.isArray(items) ? items : [];
    for (const it of list) {
      if (!isItem(it)) continue;
      const st = itemStats(it);
      for (const k in st) out[k] += st[k];
      const lv = perkLevel(it.r);
      if (lv) {
        const id = getBase(it.base).perk.id;
        if (!(out.perks[id] >= lv)) out.perks[id] = lv;
      }
    }
    for (const k of STAT_KEYS) out[k] = Math.round(out[k] * 10000) / 10000; // limpia ruido de coma flotante
    return out;
  }

  function power(item) {
    if (!isItem(item)) return 0;
    const st = itemStats(item);
    let p = 0;
    for (const k in st) p += st[k] * POWER_W[k];
    p += perkLevel(item.r) * 40;
    return Math.round(p);
  }

  function mergeGroups(inv) {
    const list = Array.isArray(inv) ? inv : [];
    const seen = new Set(), buckets = {};
    for (const it of list) {
      if (!isItem(it) || it.r >= MAX_R || it.uid === undefined || it.uid === null || seen.has(it.uid)) continue;
      seen.add(it.uid);
      const key = it.r + '|' + it.base;
      (buckets[key] || (buckets[key] = { r: it.r, i: BASE_IDX[it.base], uids: [] })).uids.push(it.uid);
    }
    const groups = [];
    Object.keys(buckets).map(k => buckets[k])
      .sort((a, b) => a.r - b.r || a.i - b.i)
      .forEach(bk => { for (let i = 0; i + 3 <= bk.uids.length; i += 3) groups.push(bk.uids.slice(i, i + 3)); });
    return groups;
  }

  function merge(inv, uids, newUid) {
    if (!Array.isArray(inv) || !Array.isArray(uids) || uids.length !== 3) return null;
    if (uids[0] === uids[1] || uids[0] === uids[2] || uids[1] === uids[2]) return null;
    const its = uids.map(u => inv.find(it => it && it.uid === u));
    if (its.some(it => !isItem(it))) return null;
    const { base: b, r } = its[0];
    if (r >= MAX_R || its.some(it => it.base !== b || it.r !== r)) return null;
    return makeItem(b, r + 1, newUid);
  }

  window.ArcanoGear = {
    SLOTS, RARITIES, BASES,
    makeItem, rollDrop, describe, statsOf, power, mergeGroups, merge,
    // extras de apoyo (opcionales)
    PERKS, getBase, rarityOdds,
  };
})();
