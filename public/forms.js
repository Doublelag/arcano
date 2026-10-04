/* Arcano · DESPERTAR: formas elementales, Afinidad y Mezclas (ver docs/despertar-spec.md).
   Script clásico: expone window.ArcanoForms.
   - Datos y lógica pura (sin DOM): SQUARE, OPP, IDS, TIER1, PAIR, ANIMA, FORMS, MIXES, formFor, traitsFor,
     options, sealInfo, cards, activeMixes, mixHint, bit/has/count.
   - Dibujo: bind({ glow, circle, ellipse, blob, star, rgba, lowQ }) con los helpers de game.js para compartir
     la caché de brillos y la calidad gráfica. Sin bind usa sus propias versiones (vista previa y pruebas).
     Todas las funciones de dibujo reciben el contexto (ctx) y lo dejan como estaba (composición, alfa, trazo discontinuo).
   Todos los colores van en '#rrggbb': el glow cachea un sprite de 64 px por color y nunca se interpolan. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  // pseudoaleatorio sin estado: el mismo n da siempre el mismo valor en [0,1)
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const r3 = v => Math.round(v * 1000) / 1000;
  const isHex = c => typeof c === 'string' && c[0] === '#';

  // ================================================================
  //  El cuadrado (Fuego arriba, Rayo a la derecha, Hielo abajo, Veneno a la izquierda)
  // ================================================================
  const SQUARE = ['fire', 'bolt', 'ice', 'poison'];
  const OPP = { fire: 'ice', ice: 'fire', bolt: 'poison', poison: 'bolt' };
  const IDS = ['aprendiz', 'ignea', 'glacial', 'voltaica', 'toxica', 'plasma', 'aurora', 'mortaja', 'azufre', 'eclipse']; // índice = bit
  const TIER1 = { fire: 'ignea', ice: 'glacial', bolt: 'voltaica', poison: 'toxica' };
  const PAIR = { 'bolt|fire': 'plasma', 'bolt|ice': 'aurora', 'ice|poison': 'mortaja', 'fire|poison': 'azufre', 'fire|ice': 'eclipse', 'bolt|poison': 'eclipse' };
  // Ánima (solo dentro de la partida): palancas de ajuste del ritmo de los despertares
  const ANIMA = { need: [100, 160], kill: 2, elite: 6, minion: 0.5, react: 1.5, reactCap: 12, boss: 40, clean: 5, arcane: 1.25, wait: 0.8, glowAt: 0.8 };
  // mismos colores, nombres e iconos que EL/SKILLS de game.js (por si no se pasa EL)
  const ELC = { arcane: '#c77dff', fire: '#ff8a3d', ice: '#7fe3ff', bolt: '#ffe45c', poison: '#8dff6a' };
  const ELN = { arcane: 'Arcano', fire: 'Fuego', ice: 'Hielo', bolt: 'Rayo', poison: 'Veneno' };
  const ELI = { arcane: '🔮', fire: '🔥', ice: '❄️', bolt: '⚡', poison: '☠️' };

  // Definitivos: los puros son los de las escuelas; los combinados llegan en la fase 2
  const ULT = {
    fire:    { key: 'fire',    name: 'Meteoro',          icon: '☄️', desc: 'Un meteorito arrasa la zona con más enemigos' },
    ice:     { key: 'ice',     name: 'Ventisca',         icon: '🌨️', desc: 'Congela a todos y borra sus disparos' },
    bolt:    { key: 'bolt',    name: 'Tormenta',         icon: '🌩️', desc: 'Ocho rayos caen sobre los enemigos' },
    poison:  { key: 'poison',  name: 'Plaga',            icon: '☣️', desc: 'Envenena a todos: los que mueren revientan' },
    sun:     { key: 'sun',     name: 'Sol cautivo',      icon: '🌞', desc: 'Una esfera de plasma lanza rayos y luego estalla' },
    curtain: { key: 'curtain', name: 'Cortina boreal',   icon: '🌌', desc: 'Cinco columnas de luz polar congelan y borran balas' },
    fog:     { key: 'fog',     name: 'Invierno negro',   icon: '🧊', desc: 'Niebla helada y venenosa; al final, NECROSIS en todos' },
    sulfur:  { key: 'sulfur',  name: 'Lluvia de azufre', icon: '🌧️', desc: 'Seis bolas de azufre caen y dejan charcos' },
    void:    { key: 'void',    name: 'Sol negro',        icon: '🕳️', desc: 'Un sol negro lo atrae todo; tus disparos +50%' },
  };

  // ================================================================
  //  Las 10 formas
  // ================================================================
  // paleta del Aprendiz = colores fijos de drawPlayer; las demás solo cambian lo que hace falta
  const P0 = {
    cape: '#2a1873', robe: '#5b3fd1', trim: '#ffcf4a', brim: '#3a24a0', hat: ['#6a4ff0', '#4a30c0', '#2c1a7a'], hatLine: '#1f1250',
    band: '#c77dff', band2: null, star: '#ffcf4a', gem: '#c77dff', skin: '#ffd2a6', eyeW: '#ffffff', eyeP: '#141018',
    eyes: null, cracks: null, sun: false, voidGem: false,
  };
  const pal = (id, o) => Object.freeze(Object.assign({ id }, P0, o));

  const FORMS = {};
  function def(id, tier, o) {
    FORMS[id] = Object.assign({ id, bit: IDS.indexOf(id), tier, card: null, ult: null, power: null }, o);
    if (o.card) o.card.form = id;
  }
  // shot: shape, sz (tamaño), glow (#rrggbb), glowR, body (relleno), core (centro), trail, trail2?, len (estela), c2 (color secundario: contorno de Rebote)
  def('aprendiz', 0, {
    name: 'Aprendiz', short: 'APRENDIZ', title: 'APRENDIZ', line: 'Todo gran mago empezó así.', icon: '🪄', color: '#ffcf4a', key: 440, els: [],
    trName: 'Sin forma', desc: 'Tu escuela de siempre, sin despertar',
    pal: pal('aprendiz', {}), aura: null, colors: ['#fff1c4', '#ffcf4a'],
    shot: { shape: 'orb', sz: 1, glowR: 17, core: '#ffffff', len: 1 },
    voice: { f: 520, type: 'sine', slide: 1.8 }, trait: {},
  });
  def('ignea', 1, {
    name: 'Ígnea', short: 'ÍGNEA', title: 'FORMA ÍGNEA', line: '¡Que todo arde!', icon: '🔥', color: '#ff8a3d', key: 523, els: ['fire'],
    trName: 'Pira', desc: 'Quemaduras más fuertes; quien muere ardiendo estalla',
    pal: pal('ignea', { cape: '#3a0d06', robe: '#8a2a12', trim: '#ffcf4a', brim: '#5a1a0a', hat: ['#c2410c', '#8a2a12', '#4a1206'], hatLine: '#2a0a04', band: '#ff8a3d', star: '#ffd23a', gem: '#ff8a3d' }),
    aura: 'wings', colors: ['#ff8a3d', '#ffd23a', '#ffb347'],
    shot: { shape: 'tear', sz: 1.1, glow: '#ff8a3d', body: '#ff8a3d', core: '#fff3c4', trail: '#ff5a1f', len: 1.4, c2: '#ffd23a' },
    voice: { f: 440, type: 'sawtooth', slide: 1.3, vol: 0.04 },
    trait: { burnK: 0.5, burnT: 3.5, deathBlast: { r: 55, k: 0.8 } },
    card: { id: 'f_ignea', name: 'Fuego interior', desc: 'Quemaduras más fuertes y estallidos más grandes',
      apply(t, lv) { if (t.burnK) t.burnK = r3(t.burnK + 0.1 * lv); if (t.deathBlast) t.deathBlast.r += 10 * lv; } },
    ult: ULT.fire,
  });
  def('glacial', 1, {
    name: 'Glacial', short: 'GLACIAL', title: 'FORMA GLACIAL', line: 'Calma. Silencio. Hielo.', icon: '❄️', color: '#7fe3ff', key: 784, els: ['ice'],
    trName: 'Gélido', desc: 'Ralentizas más tiempo y a veces congelas a los lentos',
    pal: pal('glacial', { cape: '#0f2b48', robe: '#1d4f7a', trim: '#e8fbff', brim: '#16395c', hat: ['#5fb8e8', '#2a6a9a', '#16395c'], hatLine: '#0b1f33', band: '#7fe3ff', star: '#e8fbff', gem: '#7fe3ff' }),
    aura: 'shards', colors: ['#7fe3ff', '#bff4ff', '#ffffff'],
    shot: { shape: 'diamond', sz: 1.15, glow: '#7fe3ff', body: '#bff4ff', core: '#ffffff', trail: '#bff4ff', len: 1, c2: '#7fe3ff', hit: '#e6fbff' },
    voice: { f: 880, type: 'sine', slide: 1.2 },
    trait: { slowT: 2.6, frzChance: 0.12, frzT: 0.7, frzBossT: 0.35 },
    card: { id: 'f_glacial', name: 'Hielo perpetuo', desc: '+6% de probabilidad de congelar a los ralentizados',
      apply(t, lv) { if (t.frzChance) t.frzChance = r3(t.frzChance + 0.06 * lv); } },
    ult: ULT.ice,
  });
  def('voltaica', 1, {
    name: 'Voltaica', short: 'VOLTAICA', title: 'FORMA VOLTAICA', line: '¡Más rápido que el trueno!', icon: '⚡', color: '#ffe45c', key: 659, els: ['bolt'],
    trName: 'Arco vivo', desc: 'Tus rayos saltan más a menudo, más lejos y a 3 enemigos',
    pal: pal('voltaica', { cape: '#141040', robe: '#2a2470', trim: '#ffe45c', brim: '#1e1a5a', hat: ['#5a52d0', '#2a2470', '#141040'], hatLine: '#0c0a2a', band: '#ffe45c', star: '#fff6a0', gem: '#ffe45c' }),
    aura: 'arcs', colors: ['#ffe45c', '#fff6a0', '#ffffff'],
    shot: { shape: 'star4', sz: 1, glow: '#ffe45c', body: '#ffe45c', core: '#ffffff', trail: '#fff6a0', len: 1, c2: '#fff6a0' },
    voice: { f: 600, type: 'square', slide: 1.5, noise: [0.03, 0.03, 6000] },
    trait: { chainP: 0.25, chainN: 3, chainR: 230, chainK: 0.5 },
    card: { id: 'f_voltaica', name: 'Relámpago en cadena', desc: 'Tus rayos saltan a 1 enemigo más y más a menudo',
      apply(t, lv) { if (t.chainN) t.chainN += lv; if (t.chainP) t.chainP = r3(t.chainP + 0.05 * lv); } },
    ult: ULT.bolt,
  });
  def('toxica', 1, {
    name: 'Tóxica', short: 'TÓXICA', title: 'FORMA TÓXICA', line: 'Paciencia… el veneno trabaja.', icon: '☠️', color: '#8dff6a', key: 392, els: ['poison'],
    trName: 'Ponzoña', desc: 'Más veneno por golpe; los envenenados dejan charcos',
    pal: pal('toxica', { cape: '#0e2a0c', robe: '#1f4a1a', trim: '#c6ff5a', brim: '#173a14', hat: ['#4f9a3a', '#1f4a1a', '#0e2a0c'], hatLine: '#081a06', band: '#8dff6a', star: '#c6ff5a', gem: '#8dff6a' }),
    aura: 'bubbles', colors: ['#8dff6a', '#c6ff5a', '#4fbf3a'],
    shot: { shape: 'drop', sz: 1.05, glow: '#8dff6a', body: '#8dff6a', core: '#eaffd8', trail: '#4fbf3a', len: 1, c2: '#c6ff5a' },
    voice: { f: 300, type: 'triangle', slide: 0.7 },
    trait: { poisonK: 0.15, poisonCap: 1.1, puddle: { r: 45, t: 2.5, k: 0, max: 5 } },
    card: { id: 'f_toxica', name: 'Veneno añejo', desc: 'Acumulas más veneno y 1 charco más a la vez',
      apply(t, lv) { if (t.poisonCap) t.poisonCap = r3(t.poisonCap + 0.2 * lv); if (t.puddle) t.puddle.max += lv; } },
    ult: ULT.poison,
  });
  def('plasma', 2, {
    name: 'Plasma', short: 'PLASMA', title: 'PLASMA', line: '¡Soy una estrella!', icon: '☀️', color: '#ff5ad1', key: 587, els: ['fire', 'bolt'], power: 'overload',
    trName: 'Arco de plasma', desc: 'Arcos de plasma entre enemigos que arden; SOBRECARGA mayor',
    pal: pal('plasma', { cape: '#1a0620', robe: '#3d0f4a', trim: '#ffb347', brim: '#2a0a36', hat: ['#a0309a', '#5a1660', '#2a0a36'], hatLine: '#14041a', band: '#ff5ad1', star: '#ffb347', gem: '#ff5ad1' }),
    aura: 'ring', colors: ['#ff5ad1', '#ffb347', '#fff0ff'],
    shot: { shape: 'sphere', sz: 1.25, glow: '#ff5ad1', glowR: 22, body: '#ff5ad1', core: '#fff0ff', ring: '#ffb347', trail: '#ff5ad1', len: 1, c2: '#ffb347' },
    voice: { f: 520, f2: 780, type: 'sine', slide: 1.4 },
    trait: { plasmaArc: { p: 0.3, k: 0.5, r: 180 }, overR: 125, overK: 2.8 },
    card: { id: 'f_plasma', name: 'Núcleo de plasma', desc: 'Más arcos de plasma y SOBRECARGA un 10% mayor',
      apply(t, lv) { if (t.plasmaArc) t.plasmaArc.p = r3(t.plasmaArc.p + 0.1 * lv); if (t.overR) t.overR = r3(t.overR * Math.pow(1.1, lv)); } },
    ult: ULT.sun,
  });
  def('aurora', 2, {
    name: 'Aurora', short: 'AURORA', title: 'AURORA', line: 'La luz del norte me guía.', icon: '🌠', color: '#6affc8', key: 698, els: ['bolt', 'ice'], power: 'freeze',
    trName: 'Escarcha polar', desc: 'Congelas más tiempo y los congelados estallan en esquirlas',
    pal: pal('aurora', { cape: '#1a2f5a', robe: '#10284a', trim: '#bff4ff', brim: '#0c1e38', hat: ['#3a7ab0', '#1c4a7a', '#0c1e38'], hatLine: '#081426', band: '#6affc8', star: '#b07cff', gem: '#6affc8' }),
    aura: 'ribbons', colors: ['#6affc8', '#7fe3ff', '#b07cff'],
    shot: { shape: 'diamond', sz: 1.2, glow: '#7fe3ff', body: '#bff4ff', core: '#ffffff', trail: '#6affc8', trail2: '#b07cff', dbl: true, len: 1, c2: '#b07cff', hit: '#e6fbff' },
    voice: { f: 990, type: 'sine', slide: 1.5 },
    trait: { freezeT: 2, freezeBossT: 0.7, frozenMul: 1.5, shards: { n: 6, k: 0.6 } },
    card: { id: 'f_aurora', name: 'Luz polar', desc: '+2 esquirlas y congelas más tiempo (no a jefes)',
      apply(t, lv) { if (t.shards) t.shards.n += 2 * lv; if (t.freezeT) t.freezeT = r3(t.freezeT + 0.3 * lv); } },
    ult: ULT.curtain,
  });
  def('mortaja', 2, {
    name: 'Mortaja', short: 'MORTAJA', title: 'MORTAJA', line: 'Duerme, y no despiertes.', icon: '🌫️', color: '#5fffd0', key: 523, els: ['ice', 'poison'], power: 'necro',
    trName: 'Sudario', desc: 'Un sudario te rodea: ralentiza y envenena; NECROSIS mayor',
    pal: pal('mortaja', { cape: '#141a20', robe: '#26303a', trim: '#8dffb0', brim: '#1a2128', hat: ['#4a5a66', '#26303a', '#141a20'], hatLine: '#0a0e12', band: '#5fffd0', star: '#8dffb0', gem: '#5fffd0' }),
    aura: 'mist', colors: ['#5fffd0', '#8dffb0', '#eafffa'],
    shot: { shape: 'droplong', sz: 1.1, glow: '#5fffd0', body: '#1d3b33', low: '#5fffd0', core: '#5fffd0', edge: '#ffffff', trail: '#9fb5b0', len: 1, c2: '#5fffd0' },
    voice: { f: 260, type: 'triangle', slide: 0.6 },
    trait: { shroud: { r: 90, k: 0.1 }, necroCap: 5, necroSpread: 100 },
    card: { id: 'f_mortaja', name: 'Sudario hondo', desc: 'El sudario crece y envenena más',
      apply(t, lv) { if (t.shroud) { t.shroud.r += 25 * lv; t.shroud.k = r3(t.shroud.k + 0.05 * lv); } } },
    ult: ULT.fog,
  });
  def('azufre', 2, {
    name: 'Azufre', short: 'AZUFRE', title: 'AZUFRE', line: 'La tierra escupe fuego.', icon: '🌋', color: '#d6ff3a', key: 466, els: ['fire', 'poison'], power: 'combust',
    trName: 'Suelo de azufre', desc: 'Charcos de azufre al morir; COMBUSTIÓN mayor',
    pal: pal('azufre', { cape: '#1c0c04', robe: '#3a1a0a', cracks: '#ffb000', trim: '#ffcf3a', brim: '#2a1206', hat: ['#6a3a1a', '#3a1a0a', '#1c0c04'], hatLine: '#120802', band: '#d6ff3a', star: '#ffcf3a', gem: '#d6ff3a' }),
    aura: 'smoke', colors: ['#d6ff3a', '#ff8a3d', '#ffb000'],
    shot: { shape: 'blob', sz: 1.15, glow: '#d6ff3a', body: '#d6ff3a', core: '#ff8a3d', trail: '#c8d84a', len: 1, c2: '#ff8a3d' },
    voice: { f: 360, type: 'sawtooth', slide: 0.8 },
    trait: { puddle: { r: 50, t: 3, k: 0.3, max: 6, sulfur: true }, combR: 110, combK: 2 },
    card: { id: 'f_azufre', name: 'Venas de azufre', desc: 'Charcos de azufre más grandes y duraderos',
      apply(t, lv) { if (t.puddle) { t.puddle.r += 15 * lv; t.puddle.t += lv; } } },
    ult: ULT.sulfur,
  });
  def('eclipse', 2, {
    name: 'Eclipse', short: 'ECLIPSE', title: 'ECLIPSE', line: 'Ni luz ni sombra. Solo yo.', icon: '🌑', color: '#c77dff', key: 311, els: [], powers: ['vapor', 'corrode'],
    trName: 'Desequilibrio', desc: '+10% de daño y reacciones al primer golpe, a cambio de vida',
    pal: pal('eclipse', { cape: '#05030a', robe: '#0d0718', trim: '#c77dff', brim: '#120a22', hat: ['#3a2266', '#1a0f30', '#05030a'], hatLine: '#02010a', band: '#c77dff', star: '#e8d5ff', gem: '#0a0612', eyeW: '#e8d5ff', eyeP: '#2a1046', eyes: { white: '#e8d5ff', pupil: '#2a1046' }, sun: true, voidGem: true }),
    aura: 'void', colors: ['#c77dff', '#e8d5ff', '#7a3dff'],
    shot: { shape: 'void', sz: 1.2, glow: '#c77dff', glowR: 20, body: '#0a0612', core: '#f3e8ff', edge: '#f3e8ff', trail: '#7a3dff', len: 1.3, c2: '#c77dff' },
    voice: { f: 180, type: 'sine', slide: 1.6 },
    // balance con bots (docs/despertar-spec.md 7.2): con atk ×1,2, recarga 0,6 y implosión de 1×atk limpiaba las salas
    // en el 62% del tiempo de la misma build sin formas (híbridas: 77-100%) y era la ruta más rápida
    trait: { atkMul: 1.1, hpMul: 0.8, pierce: 1, firstHit: true, reactCd: 1, implode: { r: 100, k: 0.35, pull: 40 }, vaporK: 3.2, corrMul: 1.4, corrT: 5 },
    card: { id: 'f_eclipse', name: 'Horizonte negro', desc: 'Implosiones más grandes y dañinas',
      apply(t, lv) { if (t.implode) { t.implode.r += 20 * lv; t.implode.k = r3(t.implode.k + 0.15 * lv); } } },
    ult: ULT.void,
  });
  const CARDS = IDS.map(id => FORMS[id].card).filter(Boolean);

  // ================================================================
  //  Las 8 Mezclas (runa + carta, receta oculta)
  // ================================================================
  const MIX_M = 1.25; // daño y radio si tu forma contiene el elemento de la Mezcla
  // tip = efecto en pocas palabras para el aviso en partida (desc completo en el Grimorio)
  const MIXES = [
    { id: 'cometa',   bit: 0, el: 'fire',   card: 'pierce',   name: 'Cometa',          recipe: 'Fuego + Lanza de éter',    color: '#ff8a3d', desc: 'Al atravesar a un enemigo, estalla en llamas',  tip: 'estalla al atravesar',  p: { r: 40, k: 0.5 } },
    { id: 'halo',     bit: 1, el: 'fire',   card: 'orbs',     name: 'Halo solar',      recipe: 'Fuego + Orbes guardianes', color: '#ffb347', desc: 'Tus orbes queman y lanzan anillos de fuego',     tip: 'orbes de fuego',        p: { r: 70, k: 0.6, every: 2 } },
    { id: 'glaciar',  bit: 2, el: 'ice',    card: 'wall',     name: 'Glaciar',         recipe: 'Hielo + Rebote',           color: '#e6fbff', desc: 'Al rebotar, el hechizo se parte en dos',         tip: 'se parte al rebotar',   p: { k: 0.6, ang: 25 } },
    { id: 'granizo',  bit: 3, el: 'ice',    card: 'ricochet', name: 'Granizo',         recipe: 'Hielo + Salto arcano',     color: '#bff4ff', desc: 'Cada salto suelta 2 esquirlas de hielo',         tip: 'esquirlas al saltar',   p: { n: 2, ang: 35, k: 0.35, life: 0.35 } },
    { id: 'anillo',   bit: 4, el: 'bolt',   card: 'orbs',     name: 'Anillo voltaico', recipe: 'Rayo + Orbes guardianes',  color: '#ffe45c', desc: 'Arcos eléctricos unen tus orbes',                tip: 'orbes unidos por rayos', p: { k: 0.5, every: 0.3, pad: 10, shock: 1.5 } },
    { id: 'chispazo', bit: 5, el: 'bolt',   card: 'crit',     name: 'Chispazo',        recipe: 'Rayo + Concentración',     color: '#fff7c2', desc: 'Cada crítico lanza una cadena de rayos',         tip: 'críticos con rayos',    p: { k: 0.5, n: 3, r: 200 } },
    { id: 'contagio', bit: 6, el: 'poison', card: 'ricochet', name: 'Contagio',        recipe: 'Veneno + Salto arcano',    color: '#8dff6a', desc: 'Al saltar, el veneno pasa al siguiente',         tip: 'el veneno salta',       p: {} },
    { id: 'aguijon',  bit: 7, el: 'poison', card: 'diag',     name: 'Aguijón',         recipe: 'Veneno + Abanico',         color: '#c6ff5a', desc: 'Los disparos en diagonal son agujas venenosas',  tip: 'agujas en diagonal',    p: { spd: 1.3, pierce: 1, poison: 2 } },
  ];
  for (const m of MIXES) m.icon = ELI[m.el];
  const MIX_BY = Object.fromEntries(MIXES.map(m => [m.id, m]));

  // ================================================================
  //  Lógica pura
  // ================================================================
  const isEl = el => SQUARE.includes(el);
  const isOpp = (a, b) => !!a && OPP[a] === b;
  const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const inSquare = arr => SQUARE.filter(e => arr.includes(e));

  // forma de un núcleo y (opcional) un segundo elemento; sin núcleo, Aprendiz
  function formFor(core, second) {
    if (!isEl(core)) return 'aprendiz';
    if (!isEl(second) || second === core) return TIER1[core];
    return PAIR[pairKey(core, second)];
  }
  // elementos que contiene la forma actual (para Linaje y Mezclas)
  function formEls(core, second) { return [core, second].filter(isEl); }
  const mixMul = (mix, core, second) => (mix && (mix.el === core || mix.el === second) ? MIX_M : 1);
  // tono de la forma: los híbridos usan el del núcleo
  function keyOf(id, core) { const F = FORMS[id] || FORMS.aprendiz; return F.tier === 2 && F.id !== 'eclipse' && isEl(core) ? FORMS[TIER1[core]].key : F.key; }

  // rasgos: puro del núcleo + combinado (sin el puro del 2º) + cartas f_*; siempre una copia
  const clone = o => JSON.parse(JSON.stringify(o));
  function traitsFor(core, second, sk) {
    const t = {};
    if (!isEl(core)) return t;
    Object.assign(t, clone(FORMS[TIER1[core]].trait));
    if (isEl(second) && second !== core) Object.assign(t, clone(FORMS[formFor(core, second)].trait)); // el puddle de Azufre sustituye al de Tóxica
    if (sk) for (const c of CARDS) { const lv = Math.min(2, sk[c.id] || 0); if (lv > 0) c.apply(t, lv); }
    return t;
  }

  // opciones del panel de despertar, en el orden del cuadrado
  function options(o) {
    o = o || {};
    const st = o.stage || 1, aff = o.aff || [], core = o.core, pact = !!o.pact;
    let els;
    if (st === 1) els = aff.length >= 2 ? inSquare(aff) : SQUARE.slice();
    else if (st === 2 && isEl(core)) els = (aff.length >= 2 ? inSquare(aff) : SQUARE).filter(e => e !== core);
    else return [];
    return els.map(el => {
      const opp = st === 2 && isOpp(core, el), locked = opp && !pact;
      return { el, form: st === 1 ? TIER1[el] : formFor(core, el), locked, why: locked ? 'pact' : null, opp, seals: aff.length === 1 && !aff.includes(el) ? [aff[0], el] : null };
    });
  }

  // qué pasaría al coger una runa que sella la Afinidad (null si no sella)
  function sealInfo(aff, el) {
    if (!aff || aff.length !== 1 || !isEl(aff[0]) || !isEl(el) || aff.includes(el)) return null;
    const a = aff[0];
    return { form: PAIR[pairKey(a, el)], opp: isOpp(a, el), pair: [a, el], closes: SQUARE.filter(e => e !== a && e !== el) };
  }
  const pairText = (a, b) => ELN[a] + ' + ' + ELN[b];

  // máscaras de bits del Grimorio (formas por IDS, mezclas por MIXES)
  function bit(id) { const i = IDS.indexOf(id); if (i >= 0) return 1 << i; const m = MIX_BY[id]; return m ? 1 << m.bit : 0; }
  const has = (mask, id) => { const b = bit(id); return b !== 0 && ((mask | 0) & b) !== 0; };
  function count(mask) { let n = 0; mask = mask >>> 0; while (mask) { n += mask & 1; mask >>>= 1; } return n; }

  // cartas de forma (fase 2): game.js les añade cond: () => player.form === c.form
  function cards() { return CARDS.map(c => ({ id: c.id, form: c.form, icon: FORMS[c.form].icon, name: c.name, max: 2, w: 1.3, desc: c.desc })); }

  function activeMixes(sk) { if (!sk) return []; return MIXES.filter(m => (sk[m.el] || 0) >= 1 && (sk[m.card] || 0) >= 1); }
  // Mezcla que completaría coger esta carta (runa o carta), solo de tus elementos
  function mixHint(cardId, sk, aff) {
    sk = sk || {}; aff = aff || [];
    if ((sk[cardId] || 0) >= 1) return null; // ya la tienes: no completa nada nuevo
    for (const m of MIXES) {
      if (aff.length >= 2 && !aff.includes(m.el)) continue;
      if ((m.card === cardId && (sk[m.el] || 0) >= 1) || (m.el === cardId && (sk[m.card] || 0) >= 1)) return m;
    }
    return null;
  }

  // línea de tiempo de la cinemática (t real desde startAwaken): escala del mundo, levitación, oscuridad, zoom y temblor
  const smooth = u => u * u * (3 - 2 * u);
  const TL = { scale: 1, lev: 0, dark: 0, zoom: 1, shake: 0 };
  function timeline(t) {
    if (t < 0.9) { const u = t / 0.9, eo = 1 - (1 - u) * (1 - u); TL.scale = 0.15; TL.lev = 12 * eo; TL.dark = 0.35 * u; TL.zoom = 1 + 0.12 * u; TL.shake = 6 * u; }
    else { const u = smooth(Math.min(1, (t - 0.9) / 0.5)); TL.scale = 0.15 + 0.85 * u; TL.lev = 12 * (1 - u); TL.dark = 0.35 * (1 - u); TL.zoom = 1 + 0.12 * (1 - u); TL.shake = 0; }
    return TL;
  }

  // ================================================================
  //  Dibujo: helpers (los de game.js tras bind; si no, estos)
  // ================================================================
  let X = null;              // contexto del dibujo en curso
  let VW = 540, VH = 960;    // tamaño lógico de la pantalla (esquirlas de Eclipse)
  const rgbaCache = new Map();
  function rgbaS(hex, a) {
    const key = hex + a;
    let v = rgbaCache.get(key);
    if (v) return v;
    let h = hex.slice(1);
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    v = `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
    rgbaCache.set(key, v);
    return v;
  }
  const glowSpr = new Map();
  function glowSprite(col) {
    let c = glowSpr.get(col);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgbaS(col, 0.9)); gr.addColorStop(0.3, rgbaS(col, 0.45)); gr.addColorStop(1, rgbaS(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    glowSpr.set(col, c);
    return c;
  }
  const G = {
    glow(x, y, r, col, a = 1) {
      if (!isHex(col)) col = '#ffffff';
      const pa = X.globalAlpha, op = X.globalCompositeOperation;
      X.globalCompositeOperation = 'lighter'; X.globalAlpha = pa * a;
      X.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2);
      X.globalAlpha = pa; X.globalCompositeOperation = op;
    },
    circle(x, y, r, fill) { X.beginPath(); X.arc(x, y, r, 0, TAU); X.fillStyle = fill; X.fill(); },
    ellipse(x, y, rx, ry, fill) { X.beginPath(); X.ellipse(x, y, rx, ry, 0, 0, TAU); X.fillStyle = fill; X.fill(); },
    blob(x, y, rx, ry, col) { G.ellipse(x, y, rx, ry, col); },
    star(x, y, r, color) {
      X.fillStyle = color; X.beginPath();
      for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, rr = i % 2 ? r * 0.4 : r; X[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      X.closePath(); X.fill();
    },
    rgba: rgbaS,
    lowQ: () => false,
  };
  function bind(o) {
    if (!o) return api;
    for (const k of Object.keys(G)) if (typeof o[k] === 'function') G[k] = o[k];
    if (o.W) VW = o.W;
    if (o.H) VH = o.H;
    return api;
  }
  const NODASH = [], DASH6 = [6, 6], DASH48 = [4, 8], DASH34 = [3, 4], DASH65 = [6, 5];
  const seg = (c, x1, y1, x2, y2) => { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };

  // ---------- paleta del mago ----------
  const lookCache = new Map();
  function look(id, p, EL) {
    const F = FORMS[id] || FORMS.aprendiz;
    if (F.id !== 'aprendiz') return F.pal;
    const sch = (p && p.school) || 'arcane', aff = (p && p.aff) || [];
    const key = F.id + '|' + sch + '|' + aff.join(',');
    let L = lookCache.get(key);
    if (L) return L;
    const col = k => (EL && EL[k] && EL[k].color) || ELC[k] || ELC.arcane;
    const sealed = aff.length >= 2; // Afinidad sellada: cinta bicolor y cristal del 2º elemento
    L = Object.freeze(Object.assign({}, F.pal, { band: sealed ? col(aff[0]) : col(sch), band2: sealed ? col(aff[1]) : null, gem: sealed ? col(aff[1]) : col(sch) }));
    lookCache.set(key, L);
    return L;
  }
  // degradado del sombrero en coordenadas locales (-r..r): dibujar con ctx.translate(x, 0)
  const gradCache = new Map();
  function hatGrad(c, L, r) {
    const key = L.id + '|' + r;
    let g = gradCache.get(key);
    if (!g) {
      g = c.createLinearGradient(-r, 0, r, 0);
      g.addColorStop(0, L.hat[0]); g.addColorStop(0.55, L.hat[1]); g.addColorStop(1, L.hat[2]);
      gradCache.set(key, g);
    }
    return g;
  }
  // cinta del sombrero (bicolor si la Afinidad está sellada); hy0 = y - r * 0.92 como en drawPlayer
  function drawBand(c, x, hy0, r, L) {
    X = c;
    const half = (x0, x1, x2, x3, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x0, hy0 - 2); c.lineTo(x1, hy0 - 2); c.lineTo(x2, hy0 - 6.5); c.lineTo(x3, hy0 - 6.5); c.closePath(); c.fill(); };
    if (!L.band2) { half(x - r * 0.7, x + r * 0.7, x + r * 0.6, x - r * 0.6, L.band); return; }
    half(x - r * 0.7, x + 0.5, x + 0.5, x - r * 0.6, L.band);
    half(x, x + r * 0.7, x + r * 0.6, x, L.band2);
  }
  // estrella del sombrero (Eclipse: sol negro)
  function drawHatStar(c, x, y, L) {
    X = c;
    if (!L.sun) { G.star(x, y, 4, L.star); return; }
    G.circle(x, y, 4.2, '#05030a');
    c.strokeStyle = L.star; c.lineWidth = 1.4; c.beginPath(); c.arc(x, y, 4.2, 0, TAU); c.stroke();
  }
  // cristal del bastón (Eclipse: cristal de vacío)
  function drawGem(c, x, y, L, pulse) {
    X = c; pulse = pulse || 0;
    if (L.voidGem) {
      G.glow(x, y, 17 + pulse, '#c77dff');
      G.circle(x, y, 5, '#0a0612');
      c.strokeStyle = '#e8d5ff'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 5, 0, TAU); c.stroke();
      return;
    }
    G.glow(x, y, 16 + pulse, L.gem);
    G.circle(x, y, 5, L.gem); G.circle(x - 1.5, y - 1.5, 2, '#fff');
  }
  // grietas de lava sobre la túnica (Azufre): 3 polilíneas fijas en unidades de r
  const CRACKS = [[-0.55, 0.05, -0.32, 0.3, -0.42, 0.62], [0.06, -0.12, 0.16, 0.24, -0.04, 0.58], [0.52, 0.08, 0.34, 0.38, 0.5, 0.64]];
  function drawCracks(c, x, y, r, L, t) {
    if (!L.cracks) return;
    X = c;
    const pa = c.globalAlpha, lj = c.lineJoin, cy = y + r * 0.2;
    c.globalAlpha = pa * (0.6 + 0.4 * Math.sin(t * 3));
    c.strokeStyle = L.cracks; c.lineWidth = 1.6; c.lineJoin = 'round';
    c.beginPath();
    for (const q of CRACKS) { c.moveTo(x + q[0] * r, cy + q[1] * r); c.lineTo(x + q[2] * r, cy + q[3] * r); c.lineTo(x + q[4] * r, cy + q[5] * r); }
    c.stroke();
    c.lineJoin = lj; c.globalAlpha = pa;
  }
  // Corona (Marca II): aro de 2 px del color de la forma que rodea el cono del sombrero.
  // part: 0 = entero; 1 = mitad de atrás (antes del sombrero); 2 = mitad de delante, brillo y destello (después)
  function drawCrown(c, x, y, col, t, part, rot) {
    X = c; part = part || 0; rot = rot || 0;
    const yy = y + Math.sin((t || 0) * 3) * 0.8, lq = G.lowQ(), pa = c.globalAlpha;
    if (part !== 1 && !lq) G.glow(x, yy, 15, col, 0.5);
    c.strokeStyle = col; c.lineWidth = 2;
    if (part === 1) c.globalAlpha = pa * 0.75; // la mitad de atrás queda un poco en sombra
    const a0 = part === 1 ? Math.PI : 0, a1 = part === 2 ? Math.PI : TAU; // arriba = detrás del cono; abajo = delante
    c.beginPath(); c.ellipse(x, yy, 8, 2.6, rot, a0, a1); c.stroke();
    c.globalAlpha = pa;
    if (part !== 1) { // destello que recorre el aro por delante
      const a = ((t || 0) * 1.6) % Math.PI, ca = Math.cos(rot), sa = Math.sin(rot), ex = Math.cos(a) * 8, ey = Math.sin(a) * 2.6;
      G.circle(x + ex * ca - ey * sa, yy + ex * sa + ey * ca, 1.4, '#ffffff');
    }
  }

  // ================================================================
  //  Auras (se dibujan antes de shadow(p): quedan detrás del mago)
  // ================================================================
  const WING_L = [36, 32, 25], WP = new Float32Array(12), BUB_FILL = 'rgba(141,255,106,.22)';
  function drawAura(c, p, id, t, a01) {
    if (!c || !p) return;
    X = c;
    const F = FORMS[id] || FORMS.aprendiz, lq = G.lowQ();
    const x = p.x, y = p.y - (p.lev || 0), pa = c.globalAlpha, op = c.globalCompositeOperation, lj = c.lineJoin, lc = c.lineCap;
    switch (F.aura) {
      case 'wings': { // alas de fuego a la espalda: nacen de los hombros, se abren hacia arriba y aletean a 3 Hz (±0,25 rad)
        G.glow(x, y - 6, 30, '#ff8a3d', 0.35);
        if (lq) return;
        const fl = 0.25 * Math.sin(t * 3 * TAU);
        c.lineCap = 'round'; c.lineJoin = 'round';
        for (const s of [-1, 1]) {
          const sx = x + s * 5, sy = y - 9;
          for (let j = 0; j < 3; j++) { // punta y punto de control: la pluma sale hacia fuera y se curva hacia arriba
            const a = -1.2 + 0.45 * j - fl * (1 - 0.25 * j), L = WING_L[j], b = a + 0.55;
            WP[j * 4] = sx + s * Math.cos(a) * L; WP[j * 4 + 1] = sy + Math.sin(a) * L;
            WP[j * 4 + 2] = sx + s * Math.cos(b) * L * 0.65; WP[j * 4 + 3] = sy + Math.sin(b) * L * 0.65;
          }
          c.fillStyle = 'rgba(255,90,31,.42)'; // membrana (composición normal: se lee también sobre suelos claros)
          c.beginPath(); c.moveTo(sx, sy);
          c.quadraticCurveTo(WP[2], WP[3], WP[0], WP[1]);
          c.lineTo(WP[4], WP[5]); c.lineTo(WP[8], WP[9]);
          c.quadraticCurveTo(sx + s * 14, sy + 4, sx, sy + 5);
          c.closePath(); c.fill();
          c.globalCompositeOperation = 'lighter'; c.lineWidth = 3;
          for (let j = 0; j < 3; j++) {
            c.strokeStyle = j % 2 ? '#ffd23a' : '#ff8a3d';
            c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(WP[j * 4 + 2], WP[j * 4 + 3], WP[j * 4], WP[j * 4 + 1]); c.stroke();
          }
          c.globalCompositeOperation = op;
        }
        c.lineCap = lc; c.lineJoin = lj;
        return;
      }
      case 'shards': { // 3 rombos de hielo en órbita
        if (!lq) G.glow(x, y - 4, 28, '#7fe3ff', 0.22);
        c.strokeStyle = '#7fe3ff'; c.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const a = t * 1.2 + i * TAU / 3, sx = x + Math.cos(a) * 26, sy = y - 6 + Math.sin(a) * 15 + Math.sin(t * 2 + i) * 1.5;
          c.beginPath(); c.moveTo(sx, sy - 6); c.lineTo(sx + 3, sy); c.lineTo(sx, sy + 6); c.lineTo(sx - 3, sy); c.closePath();
          c.fillStyle = '#bff4ff'; c.fill(); c.stroke();
        }
        return;
      }
      case 'arcs': { // 2 zigzags eléctricos que se regeneran cada 0,08 s
        G.glow(x, y - 4, 30, '#ffe45c', 0.3);
        if (lq) return;
        const b = Math.floor(t / 0.08);
        c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#fff6a0'; c.lineWidth = 2; c.lineJoin = 'round';
        for (let k = 0; k < 2; k++) {
          const a0 = hash(b * 2 + k) * TAU, span = 1.1 + hash(b * 2 + k + 0.37) * 0.9;
          c.beginPath();
          for (let i = 0; i <= 4; i++) {
            const a = a0 + span * i / 4, rr = 22 + (i % 4 ? (hash(b * 7 + k * 3 + i) - 0.5) * 12 : 0);
            c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y - 4 + Math.sin(a) * rr);
          }
          c.stroke();
        }
        c.lineJoin = lj; c.globalCompositeOperation = op;
        return;
      }
      case 'bubbles': { // brillo verde y burbujas que suben (relleno tenue + borde: se leen también sobre la pradera)
        G.glow(x, y - 2, 30, '#8dff6a', 0.25);
        if (lq) return;
        c.strokeStyle = '#8dff6a'; c.lineWidth = 1.4;
        for (let i = 0; i < 4; i++) {
          const ph = (t * 0.7 + i / 4) % 1, bx = x + (i - 1.5) * 10 + Math.sin(t * 2 + i) * 3, by = y + 6 - ph * 38, br = 1.8 + 2.4 * (1 - ph * 0.5);
          c.globalAlpha = pa * 0.9 * (1 - ph) * Math.min(1, ph * 5);
          c.beginPath(); c.arc(bx, by, br, 0, TAU); c.fillStyle = BUB_FILL; c.fill(); c.stroke();
          G.circle(bx - br * 0.35, by - br * 0.35, br * 0.3, '#eaffd8');
        }
        c.globalAlpha = pa;
        return;
      }
      case 'ring': { // anillo de plasma que gira con 2 chispas en órbita
        G.glow(x, y - 4, 34, '#ff5ad1', 0.28);
        if (lq) return;
        c.strokeStyle = '#ff5ad1'; c.lineWidth = 3;
        c.setLineDash(DASH6); c.lineDashOffset = -t * 40;
        c.beginPath(); c.arc(x, y - 4, 24, 0, TAU); c.stroke();
        c.setLineDash(NODASH); c.lineDashOffset = 0;
        for (let k = 0; k < 2; k++) {
          const a = t * 4 + k * Math.PI, sx = x + Math.cos(a) * 24, sy = y - 4 + Math.sin(a) * 24;
          G.glow(sx, sy, 9, '#ffb347', 0.8); G.circle(sx, sy, 2.5, '#ffb347');
        }
        return;
      }
      case 'ribbons': { // aurora boreal: 3 cintas senoidales sobre los hombros
        if (lq) { G.glow(x, y - 14, 30, '#6affc8', 0.25); return; }
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = pa * 0.35; c.lineWidth = 5; c.lineCap = 'round'; c.lineJoin = 'round';
        const RIB = F.colors;
        for (let j = 0; j < 3; j++) {
          c.strokeStyle = RIB[j];
          c.beginPath();
          for (let i = 0; i < 8; i++) {
            const u = i / 7, px = x - 34 + 68 * u, py = y - 6 - j * 7 - Math.sin(u * Math.PI) * (20 + j * 4) + Math.sin(t * 2.4 + u * 5 + j * 1.9) * 4;
            c[i ? 'lineTo' : 'moveTo'](px, py);
          }
          c.stroke();
        }
        c.globalAlpha = pa; c.globalCompositeOperation = op; c.lineCap = lc; c.lineJoin = lj;
        return;
      }
      case 'mist': { // niebla que deriva y el círculo punteado del Sudario
        if (!lq) for (let j = 0; j < 3; j++) G.glow(x + Math.cos(t * 0.5 + j * 2.1) * 20, y - 2 + Math.sin(t * 0.7 + j * 1.4) * 10, 34, '#5fffd0', 0.15);
        // jirones claros a ras de suelo (composición normal: el brillo solo no se ve sobre suelos claros)
        for (let j = 0, n = lq ? 2 : 4; j < n; j++) {
          const a = t * 0.55 + j * TAU / n;
          c.globalAlpha = pa * (0.17 + 0.06 * Math.sin(t * 1.3 + j * 2));
          G.ellipse(x + Math.cos(a) * 21, p.y + 3 + Math.sin(a) * 7, 14 + 3 * Math.sin(t + j), 5.5, '#d8fff4');
        }
        c.globalAlpha = pa;
        const R = (p.tr && p.tr.shroud && p.tr.shroud.r) || 90;
        c.globalAlpha = pa * 0.25; c.strokeStyle = '#5fffd0'; c.lineWidth = 2;
        c.setLineDash(DASH48); c.lineDashOffset = t * 6;
        c.beginPath(); c.arc(x, p.y, R, 0, TAU); c.stroke();
        c.setLineDash(NODASH); c.lineDashOffset = 0; c.globalAlpha = pa;
        return;
      }
      case 'smoke': { // brillo sulfuroso y humo que sube de los hombros (borla oscura con luz arriba: se lee en suelos claros y oscuros)
        G.glow(x, y - 4, 34, '#c8d84a', 0.2);
        if (lq) return;
        for (let i = 0; i < 4; i++) {
          const ph = (t * 0.45 + i / 4) % 1, k = (1 - ph) * Math.min(1, ph * 4), rr = 5 + ph * 8;
          const sx = x + (i - 1.5) * 8 + Math.sin(t + i * 2) * 4, sy = y - 16 - ph * 30;
          c.globalAlpha = pa * 0.42 * k; G.circle(sx, sy, rr, '#4a4234');
          c.globalAlpha = pa * 0.22 * k; G.circle(sx - rr * 0.25, sy - rr * 0.3, rr * 0.55, '#9a8f72');
        }
        c.globalAlpha = pa;
        return;
      }
      case 'void': { // brillo invertido: corona violeta y disco negro detrás del cuerpo
        G.glow(x, y - 4, 38, '#c77dff', 0.6);
        c.globalAlpha = pa * 0.6; G.circle(x, y - 4, 18, '#05030a'); c.globalAlpha = pa;
        if (!lq) { c.strokeStyle = rgbaS('#e8d5ff', 0.45); c.lineWidth = 1.2; c.beginPath(); c.arc(x, y - 4, 18.5, 0, TAU); c.stroke(); }
        return;
      }
      default: // Aprendiz: promesa de despertar con el Ánima casi llena
        if ((a01 || 0) >= ANIMA.glowAt) G.glow(x, y - 4, 28 + 4 * Math.sin(t * 5), '#fff1c4', 0.35);
    }
  }

  // ================================================================
  //  Proyectiles
  // ================================================================
  const styCache = new Map();
  const CONTAGIO_A = rgbaS('#8dff6a', 0.5);
  // estilo de disparo (se calcula en refreshStyle, no por fotograma); incluye la Capa 0 y lo visual de las Mezclas
  function shotStyle(id, sk, echo, cols, mixIds) {
    sk = sk || {}; cols = cols || [];
    const F = FORMS[id] || FORMS.aprendiz, d = F.shot, orb = d.shape === 'orb';
    const mx = (mixIds || []).map(m => (typeof m === 'string' ? m : m && m.id)).filter(Boolean).sort();
    const atk = Math.min(6, sk.atk || 0), crit = Math.min(4, sk.crit || 0), ell = (sk.pierce || 0) > 0, wall = (sk.wall || 0) > 0;
    const c0 = isHex(cols[0]) ? cols[0] : '', c1s = isHex(cols[1]) ? cols[1] : '';
    const key = F.id + '|' + (echo ? 1 : 0) + '|' + c0 + '|' + c1s + '|' + atk + '|' + crit + '|' + (ell ? 1 : 0) + '|' + (wall ? 1 : 0) + '|' + mx.join(',');
    let s = styCache.get(key);
    if (s) return s;
    const main = orb ? c0 || ELC.arcane : d.glow;
    const own = F.els.length === 1 ? ELC[F.els[0]] : null;
    // chispa del 2º elemento: Aprendiz siempre; formas puras solo si llevas runa de otro elemento
    const col2 = orb || F.tier === 1 ? [c0, c1s].find(c => c && c !== main && c !== own) || null : null;
    const comet = mx.includes('cometa');
    const trail = orb ? main : d.trail, trail2 = comet ? '#ff8a3d' : d.trail2 || trail;
    s = {
      key, id: F.id, shape: d.shape, sz: d.sz,
      glow: main, glowR: (d.glowR || 17) + 1.5 * atk,                         // Poder: brillo 17 + 1,5·nv
      body: orb ? main : d.body, core: d.core, edge: d.edge || null, ring: d.ring || null, lowCol: orb ? main : d.low || d.body,
      coreR: (5.5 + 0.4 * atk) * d.sz,                                        // Poder: núcleo 5,5 + 0,4·nv (máx. 7,9)
      whiteR: (2.8 + 0.2 * crit) * (orb ? 1 : d.sz), edgeW: 2 + 0.25 * crit,  // Concentración: centro 2,8 + 0,2·nv
      trailA: rgbaS(trail, 0.5), trail2A: rgbaS(trail2, 0.5), dbl: !!d.dbl, len: d.len * (comet ? 1.45 : 1),
      alpha: echo ? 0.7 : 1, col2,
      ell,                                                                    // Lanza de éter: núcleo en elipse 1,4:1
      rim: wall ? (orb ? col2 || '#fff1c4' : d.c2) : null,                    // Rebote: contorno del color secundario
      needle: mx.includes('aguijon'), contagio: mx.includes('contagio'), hit: d.hit || null, mixes: mx,
    };
    styCache.set(key, s);
    return s;
  }
  // estilos de proyectiles secundarios (nofx): esquirlas de Aurora/Granizo, trozos de Glaciar y agujas de Aguijón
  const SUB = {
    shard:  { shape: 'shard',  sz: 0.6, glow: '#bff4ff', glowR: 10, body: '#e6fbff', core: '#ffffff', trail: '#bff4ff', len: 0.5 },
    hail:   { shape: 'shard',  sz: 0.6, glow: '#bff4ff', glowR: 10, body: '#e6fbff', core: '#ffffff', trail: '#bff4ff', len: 0.6 },
    split:  { shape: 'split',  sz: 0.8, glow: '#7fe3ff', glowR: 12, body: '#e6fbff', core: '#ffffff', trail: '#bff4ff', len: 0.7 },
    needle: { shape: 'needle', sz: 0.6, glow: '#8dff6a', glowR: 12, body: '#8dff6a', core: '#eaffd8', trail: '#8dff6a', len: 0.9 },
  };
  const subCache = new Map();
  function subStyle(kind) {
    let s = subCache.get(kind);
    if (s) return s;
    const d = SUB[kind] || SUB.shard;
    s = { key: 'sub|' + kind, id: kind, shape: d.shape, sz: d.sz, glow: d.glow, glowR: d.glowR, body: d.body, core: d.core, lowCol: d.body,
      coreR: 5.5 * d.sz, whiteR: 2.8 * d.sz, trailA: rgbaS(d.trail, 0.5), trail2A: rgbaS(d.trail, 0.5), len: d.len, alpha: 1, dbl: false, ell: false, rim: null };
    subCache.set(kind, s);
    return s;
  }

  const fillRim = (c, fill, rim) => { c.fillStyle = fill; c.fill(); if (rim) { c.strokeStyle = rim; c.lineWidth = 1.5; c.stroke(); } };
  // rombo orientado: h = media longitud (en la dirección de vuelo), w = media anchura
  function quad(c, x, y, ux, uy, h, w) {
    c.beginPath(); c.moveTo(x + ux * h, y + uy * h); c.lineTo(x - uy * w, y + ux * w); c.lineTo(x - ux * h, y - uy * h); c.lineTo(x + uy * w, y - ux * w); c.closePath();
  }
  // lágrima: arco de radio r por delante y punta a distancia d por detrás
  function tearPath(c, x, y, ux, uy, r, d) {
    const b = Math.acos(Math.min(1, r / d)), a = Math.atan2(uy, ux) + Math.PI;
    c.beginPath(); c.arc(x, y, r, a + b, a - b + TAU); c.lineTo(x - ux * d, y - uy * d); c.closePath();
  }
  // centro blanco: elipse orientada con Lanza de éter
  function coreDot(c, s, x, y, ux, uy, r, col) {
    if (s.ell) { c.beginPath(); c.ellipse(x, y, r * 1.4, r, Math.atan2(uy, ux), 0, TAU); c.fillStyle = col; c.fill(); }
    else G.circle(x, y, r, col);
  }
  // relleno de cada silueta (máx. 2 rellenos y algún trazo; sin save/rotate)
  function shotBody(c, s, x, y, ux, uy, t) {
    const r = s.coreR, k = r / 5.5, el = s.ell ? 1.4 : 1;
    switch (s.shape) {
      case 'orb':
        c.beginPath();
        if (s.ell) c.ellipse(x, y, r * 1.4, r, Math.atan2(uy, ux), 0, TAU); else c.arc(x, y, r, 0, TAU);
        fillRim(c, s.body, s.rim);
        if (s.col2) { const q = t * 25, cx = x + Math.cos(q) * 8, cy = y + Math.sin(q) * 8; G.glow(cx, cy, 6, s.col2); G.circle(cx, cy, 2.4, s.col2); }
        G.circle(x, y, s.whiteR, s.core);
        return;
      case 'tear': { // llama: lágrima larga que parpadea, con otra lágrima clara dentro
        const d = r * 3 * el * (1 + 0.12 * Math.sin(t * 31 + x * 0.1)), wr = s.whiteR * 1.05;
        tearPath(c, x, y, ux, uy, r, d); fillRim(c, s.body, s.rim);
        tearPath(c, x + ux * r * 0.25, y + uy * r * 0.25, ux, uy, wr, d * 0.5); c.fillStyle = s.core; c.fill();
        break;
      }
      case 'drop': // gota: cabeza redonda y punta corta hacia atrás
        tearPath(c, x, y, ux, uy, r, r * 1.9 * el); fillRim(c, s.body, s.rim);
        coreDot(c, s, x + ux * r * 0.15, y + uy * r * 0.15, ux, uy, s.whiteR, s.core);
        break;
      case 'diamond': {
        const h = 6.5 * k * el, w = 3.5 * k;
        quad(c, x, y, ux, uy, h, w); fillRim(c, s.body, s.rim);
        quad(c, x, y, ux, uy, h * 0.5 * (s.whiteR / (2.8 * s.sz)), w * 0.5); c.fillStyle = s.core; c.fill();
        break;
      }
      case 'star4': { // estrella de 4 puntas que gira
        const R = 7 * k, ri = 2.5 * k, q0 = t * 8;
        c.beginPath();
        for (let i = 0; i < 8; i++) { const q = q0 + i * Math.PI / 4, rr = i % 2 ? ri : R; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(q) * rr, y + Math.sin(q) * rr); }
        c.closePath(); fillRim(c, s.body, s.rim);
        coreDot(c, s, x, y, ux, uy, s.whiteR * 0.8, s.core);
        break;
      }
      case 'sphere': // esfera con anillo elíptico que gira
        c.beginPath(); c.arc(x, y, r, 0, TAU); fillRim(c, s.body, s.rim);
        coreDot(c, s, x, y, ux, uy, Math.max(r * 0.5, s.whiteR), s.core);
        c.strokeStyle = s.ring; c.lineWidth = 1.6;
        c.beginPath(); c.ellipse(x, y, r + 4, (r + 4) * 0.4, t * 6, 0, TAU); c.stroke();
        break;
      case 'droplong': // gota alargada oscura con borde blanco
        c.beginPath(); c.ellipse(x, y, r * 1.6 * el, r * 0.78, Math.atan2(uy, ux), 0, TAU);
        c.fillStyle = s.body; c.fill(); c.strokeStyle = s.rim || s.edge; c.lineWidth = 1.5; c.stroke();
        G.circle(x + ux * r * 0.55, y + uy * r * 0.55, s.whiteR * 0.55, s.core);
        break;
      case 'blob':
        c.beginPath();
        if (s.ell) c.ellipse(x, y, r * 1.4, r, Math.atan2(uy, ux), 0, TAU); else c.arc(x, y, r, 0, TAU);
        fillRim(c, s.body, s.rim);
        coreDot(c, s, x, y, ux, uy, s.whiteR * 1.1, s.core);
        break;
      case 'void': // disco negro con aro claro (lo contrario de una bala del Brujo)
        c.beginPath();
        if (s.ell) c.ellipse(x, y, r * 1.3, r, Math.atan2(uy, ux), 0, TAU); else c.arc(x, y, r, 0, TAU);
        c.fillStyle = s.body; c.fill(); c.strokeStyle = s.rim || s.edge; c.lineWidth = s.edgeW; c.stroke();
        break;
      case 'needle': { // aguja de 14×3
        c.beginPath(); c.moveTo(x + ux * 7, y + uy * 7); c.lineTo(x - ux * 2 - uy * 1.6, y - uy * 2 + ux * 1.6); c.lineTo(x - ux * 7, y - uy * 7); c.lineTo(x - ux * 2 + uy * 1.6, y - uy * 2 - ux * 1.6); c.closePath();
        c.fillStyle = s.body; c.fill();
        G.circle(x + ux * 4.5, y + uy * 4.5, 1.3, s.core);
        break;
      }
      case 'shard': // triángulo de hielo
        c.beginPath(); c.moveTo(x + ux * 5, y + uy * 5); c.lineTo(x - ux * 3 - uy * 2.6, y - uy * 3 + ux * 2.6); c.lineTo(x - ux * 3 + uy * 2.6, y - uy * 3 - ux * 2.6); c.closePath();
        c.fillStyle = s.body; c.fill();
        break;
      case 'split':
        quad(c, x, y, ux, uy, 5.5, 2.8); c.fillStyle = s.body; c.fill();
        break;
    }
  }
  // dibuja un proyectil con estilo; false = que lo dibuje el código antiguo (sin sty)
  // campos que mira: a.sty, a.sub ('shard'|'hail'|'split'|'needle'), a.split, a.needle o a.kind === 'diag' (Aguijón), a.hit (Contagio)
  function drawShot(c, a, t) {
    if (!c || !a) return false;
    const s0 = a.sty;
    let s = a.sub ? subStyle(a.sub) : a.split ? subStyle('split') : s0;
    if (s && s === s0 && (a.needle || (s0.needle && a.kind === 'diag'))) s = subStyle('needle');
    if (!s) return false;
    X = c;
    const x = a.x, y = a.y, sp = Math.hypot(a.vx, a.vy) || 1, ux = a.vx / sp, uy = a.vy / sp;
    if (G.lowQ()) { // calidad baja: brillo y círculo
      G.glow(x, y, s.glowR * 0.8, s.glow, 0.85);
      G.circle(x, y, s.coreR, s.lowCol);
      return true;
    }
    const pa = c.globalAlpha, al = s0 ? s0.alpha : 1;
    if (al !== 1) c.globalAlpha = pa * al;
    // estela: 2 trazos que suman luz
    const op = c.globalCompositeOperation, lc = c.lineCap, L = s.len;
    const tr2 = s0 && s0.contagio && s === s0 && a.hit && a.hit.size ? CONTAGIO_A : s.trail2A;
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    if (s.dbl) { // doble estela paralela (Aurora)
      const ox = -uy * 2.5, oy = ux * 2.5, l = 28 * L;
      c.lineWidth = 3.5 * s.sz;
      c.strokeStyle = s.trailA; seg(c, x + ox, y + oy, x + ox - ux * l, y + oy - uy * l);
      c.strokeStyle = tr2; seg(c, x - ox, y - oy, x - ox - ux * l, y - oy - uy * l);
    } else {
      c.lineWidth = 7 * s.sz; c.strokeStyle = s.trailA; seg(c, x, y, x - ux * 16 * L, y - uy * 16 * L);
      c.lineWidth = 3.5 * s.sz; c.strokeStyle = tr2; seg(c, x, y, x - ux * 30 * L, y - uy * 30 * L);
    }
    c.lineCap = lc; c.globalCompositeOperation = op;
    G.glow(x, y, s.glowR, s.glow, 0.9);
    shotBody(c, s, x, y, ux, uy, t);
    c.globalAlpha = pa;
    return true;
  }

  // ================================================================
  //  Orbes, arcos y charcos
  // ================================================================
  // orbe guardián (el rastro lo sigue pintando drawOrbs); mix = { halo, anillo }; col = color del Aprendiz (escuela)
  function drawOrb(c, x, y, id, t, mix, col) {
    if (!c) return;
    X = c;
    const F = FORMS[id] || FORMS.aprendiz, lq = G.lowQ(), halo = mix && mix.halo, ani = mix && mix.anillo;
    col = isHex(col) ? col : F.tier ? F.color : ELC.arcane;
    if (ani && !lq) G.glow(x, y, 16, '#ffe45c', 0.45 + 0.3 * Math.sin(t * 20));
    if (halo) { // Halo solar: orbe de 9 px con corona
      G.glow(x, y, 28, '#ffb347', 0.7);
      if (!lq) {
        c.strokeStyle = '#ffb347'; c.lineWidth = 2.5; c.setLineDash(DASH34); c.lineDashOffset = -t * 30;
        c.beginPath(); c.arc(x, y, 12.5, 0, TAU); c.stroke();
        c.setLineDash(NODASH); c.lineDashOffset = 0;
      }
      G.circle(x, y, 9, '#ff8a3d'); G.circle(x, y, 4.5, '#fff3c4');
      return;
    }
    if (F.id === 'eclipse') {
      G.glow(x, y, 20, '#c77dff');
      G.circle(x, y, 7, '#0a0612');
      c.strokeStyle = '#f3e8ff'; c.lineWidth = 1.6; c.beginPath(); c.arc(x, y, 7, 0, TAU); c.stroke();
      return;
    }
    G.glow(x, y, 20, col);
    G.circle(x, y, 7, col); G.circle(x, y, 3.5, '#fff');
  }
  // zigzag eléctrico entre 2 puntos que se regenera cada `every` s (Anillo voltaico y similares)
  const ZP = new Float32Array(24);
  function drawArc(c, x1, y1, x2, y2, t, col, seed, n, every) {
    if (!c) return;
    X = c; col = isHex(col) ? col : '#ffe45c'; seed = seed || 0; n = Math.min(10, n || 4); every = every || 0.1;
    const b = Math.floor(t / every), dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, amp = Math.min(10, L * 0.18);
    for (let i = 0; i <= n; i++) {
      const u = i / n, j = i && i < n ? (hash(b * 13 + seed * 7 + i) - 0.5) * 2 * amp : 0;
      ZP[i * 2] = x1 + dx * u + nx * j; ZP[i * 2 + 1] = y1 + dy * u + ny * j;
    }
    const op = c.globalCompositeOperation, lj = c.lineJoin;
    c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round';
    const pass = (w, st) => { c.strokeStyle = st; c.lineWidth = w; c.beginPath(); c.moveTo(ZP[0], ZP[1]); for (let i = 1; i <= n; i++) c.lineTo(ZP[i * 2], ZP[i * 2 + 1]); c.stroke(); };
    if (!G.lowQ()) pass(6, rgbaS(col, 0.35));
    pass(2, col);
    c.lineJoin = lj; c.globalCompositeOperation = op;
  }
  // charco nuevo a partir de trait.puddle (Tóxica o Azufre)
  function newPool(x, y, pd) {
    pd = pd || { r: 45, t: 2.5, k: 0, max: 5 };
    return { x, y, r: pd.r, t: pd.t, max: pd.t, k: pd.k || 0, sulfur: !!pd.sulfur, tick: 0, seed: Math.random() * 1000, cr: null };
  }
  // grietas del charco de azufre: se generan una vez y se guardan en el charco
  function poolCracks(o) {
    const cr = [];
    for (let i = 0; i < 3; i++) {
      const a = (o.seed || 0) + i * 2.1 + hash(o.seed + i) * 0.8;
      const r1 = 0.15 + hash(o.seed * 3 + i) * 0.2, r2 = 0.5 + hash(o.seed * 5 + i) * 0.2, r3x = 0.78 + hash(o.seed * 7 + i) * 0.14, bend = (hash(o.seed * 9 + i) - 0.5) * 0.9;
      cr.push(Math.cos(a) * r1, Math.sin(a) * r1, Math.cos(a + bend) * r2, Math.sin(a + bend) * r2, Math.cos(a - bend * 0.5) * r3x, Math.sin(a - bend * 0.5) * r3x);
    }
    return cr;
  }
  function drawPool(c, o, t) {
    if (!c || !o) return;
    X = c;
    const max = o.max || 2.5, life = o.t == null ? max : o.t;
    const fa = clamp(Math.min((max - life) / 0.2, life / 0.4), 0, 1);
    if (fa <= 0) return;
    const pa = c.globalAlpha, lj = c.lineJoin, rx = o.r, ry = o.r * 0.62, lq = G.lowQ();
    c.globalAlpha = pa * fa;
    c.beginPath(); c.ellipse(o.x, o.y, rx, ry, 0, 0, TAU);
    if (o.sulfur) { // azufre: lava naranja con 3 grietas brillantes
      c.fillStyle = 'rgba(255,138,61,.3)'; c.fill();
      if (!lq) G.glow(o.x, o.y, rx * 0.9, '#ff8a3d', 0.22 + 0.06 * Math.sin(t * 4 + (o.seed || 0)));
      const cr = o.cr || (o.cr = poolCracks(o));
      c.globalAlpha = pa * fa * (0.75 + 0.25 * Math.sin(t * 5 + (o.seed || 0)));
      c.strokeStyle = '#ffb000'; c.lineWidth = 2; c.lineJoin = 'round';
      c.beginPath();
      for (let i = 0; i < cr.length; i += 6) { c.moveTo(o.x + cr[i] * rx, o.y + cr[i + 1] * ry); c.lineTo(o.x + cr[i + 2] * rx, o.y + cr[i + 3] * ry); c.lineTo(o.x + cr[i + 4] * rx, o.y + cr[i + 5] * ry); }
      c.stroke(); c.lineJoin = lj;
    } else { // veneno: verde translúcido con borde discontinuo
      c.fillStyle = 'rgba(141,255,106,.25)'; c.fill();
      c.strokeStyle = '#4fbf3a'; c.lineWidth = 2; c.setLineDash(DASH65); c.lineDashOffset = -t * 8; c.stroke();
      c.setLineDash(NODASH); c.lineDashOffset = 0;
      if (!lq) { const b = (t * 0.9 + (o.seed || 0)) % 1; G.circle(o.x + Math.sin((o.seed || 0) * 3) * rx * 0.4, o.y + ry * 0.2 - b * ry * 0.6, 2.4 * (1 - b) + 0.6, 'rgba(198,255,90,.7)'); }
    }
    c.globalAlpha = pa;
  }

  // ================================================================
  //  Cinemática del despertar y esquirlas de Eclipse
  // ================================================================
  // colores de los anillos: la pareja (dorado si el 1º despertar no tiene pareja); Eclipse añade violeta
  function awakenCols(fx, p) {
    const aff = (p && p.aff) || [], el = fx.el;
    const pair = fx.st === 2 ? [p.core, el] : aff.length >= 2 ? aff : aff.length === 1 && aff[0] !== el ? [aff[0], el] : null;
    if (!pair || !isEl(pair[0]) || !isEl(pair[1])) return ['#fff1c4', ELC[el] || '#fff1c4', '#fff1c4'];
    return [ELC[pair[0]], isOpp(pair[0], pair[1]) && fx.st === 2 ? '#c77dff' : ELC[pair[1]], ELC[pair[1]]];
  }
  // fx = awakenFx {t, el, st, boom}; efx = eclipseFx {t} (opcional, también con drawEclipse)
  function drawAwaken(c, fx, p, t, efx) {
    if (!c) return;
    X = c;
    if (efx) drawEclipse(c, efx, t);
    if (!fx || !p) return;
    const lq = G.lowQ(), x = p.x, y = p.y - 4 - (p.lev || 0), pa = c.globalAlpha, op = c.globalCompositeOperation, lc = c.lineCap;
    const cols = awakenCols(fx, p);
    c.globalCompositeOperation = 'lighter';
    if (fx.t < 0.9) {
      const k = fx.t / 0.9;
      // 3 anillos que se cierran de 160 a 20 px, escalonados
      c.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const u = clamp(k * 1.15 - i * 0.15, 0, 1), rr = 20 + 140 * (1 - u * u);
        c.globalAlpha = pa * (0.25 + 0.75 * Math.min(1, k * 2.5)) * (u >= 1 ? 0.5 : 1);
        c.strokeStyle = cols[i]; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.stroke();
      }
      // espiral de partículas hacia el mago
      const n = lq ? 14 : 36;
      for (let j = 0; j < n; j++) {
        const u = (j / n + k * 1.8) % 1, rr = 150 * (1 - u), a = j * 2.39996 + u * 5;
        c.globalAlpha = pa * Math.min(1, u * 4) * Math.min(1, k * 6);
        G.circle(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8, 1.4 + 2.2 * u, cols[j % 3]);
      }
      c.globalAlpha = pa;
      G.glow(x, y, 18 + 40 * k, cols[0], 0.25 + 0.5 * k);
    } else { // tras el estallido: rayos de luz que se abren y se apagan
      const k = clamp((fx.t - 0.9) / 0.5, 0, 1), FC = (FORMS[p.form] || FORMS.aprendiz).colors;
      if (!lq) {
        c.lineCap = 'round';
        for (let i = 0; i < 12; i++) {
          const a = i * TAU / 12 + 0.26, r0 = 18 + 40 * k, r1 = 40 + 200 * (1 - (1 - k) * (1 - k));
          c.globalAlpha = pa * 0.65 * (1 - k); c.strokeStyle = FC[i % FC.length]; c.lineWidth = 1 + 3 * (1 - k);
          seg(c, x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1);
        }
        c.lineCap = lc; c.globalAlpha = pa;
      }
      G.glow(x, y, 50 + 80 * k, '#ffffff', 0.8 * (1 - k));
    }
    c.globalCompositeOperation = op; c.globalAlpha = pa;
  }
  // 24 esquirlas de sombra que caen por toda la pantalla (rombos #1a1024 con filo #c77dff, composición normal)
  function drawEclipse(c, efx, t) {
    if (!c || !efx || !(efx.t > 0)) return;
    X = c;
    const max = efx.max || 3, e = max - efx.t, n = G.lowQ() ? 12 : 24, pa = c.globalAlpha;
    c.globalAlpha = pa * Math.min(1, efx.t / 0.6, e / 0.15 + 0.2);
    c.fillStyle = '#1a1024'; c.strokeStyle = '#c77dff'; c.lineWidth = 1.3;
    for (let i = 0; i < n; i++) {
      const h1 = hash(i * 3.1), h2 = hash(i * 7.7 + 1), h3 = hash(i * 5.3 + 2);
      const sy = -40 - h3 * 260 + e * (170 + h2 * 190);
      if (sy < -30 || sy > VH + 30) continue;
      const sx = h1 * VW + Math.sin(e * 2 + i) * 14, rot = e * (1.5 + h2 * 2.5) * (i % 2 ? 1 : -1) + i, s = 0.8 + h3 * 0.7;
      const ux = Math.cos(rot), uy = Math.sin(rot), hh = 7 * s, ww = 2.8 * s;
      quad(c, sx, sy, ux, uy, hh, ww); c.fill(); c.stroke();
    }
    c.globalAlpha = pa;
  }
  // viñeta violeta permanente de Eclipse (sprite prerenderizado como vignetteSpr: drawImage(spr, 0, 0, W, H))
  let vigE = null;
  function vignette(id) {
    if (id !== 'eclipse' || typeof document === 'undefined') return null;
    if (!vigE) {
      vigE = document.createElement('canvas');
      vigE.width = 270; vigE.height = 480;
      const g = vigE.getContext('2d'), gr = g.createRadialGradient(135, 250, 90, 135, 250, 330);
      gr.addColorStop(0, 'rgba(122,61,255,0)'); gr.addColorStop(0.6, 'rgba(122,61,255,.06)'); gr.addColorStop(1, 'rgba(150,70,255,.2)');
      g.fillStyle = gr; g.fillRect(0, 0, 270, 480);
    }
    return vigE;
  }

  // ================================================================
  //  Ambiente (partículas que suelta la forma)
  // ================================================================
  // r = radio de aparición alrededor del mago, oy = desplazamiento vertical; normal = no usa composición 'lighter'
  const AMB = {
    ignea:    { color: '#ffb347', every: 0.08, vx: [-12, 12], vy: [-70, -50], life: 0.6, size: [1.5, 3], r: 14, oy: -6 },
    glacial:  { color: '#eafcff', every: 0.1, vx: [-10, 10], vy: [35, 45], life: 0.8, size: [1.2, 2.4], r: 22, oy: -30 },
    voltaica: { color: '#fff6a0', every: 0.12, vx: [-60, 60], vy: [-60, 60], life: 0.2, size: [1.5, 2.5], r: 18, oy: -4 },
    toxica:   { color: '#8dff6a', every: 0.12, vx: [-8, 8], vy: [-40, -40], life: 0.7, size: [2, 4], r: 14, oy: 4 },
    plasma:   { color: '#ff5ad1', color2: '#ffb347', p2: 0.5, every: 0.12, vx: [-30, 30], vy: [-50, -20], life: 0.4, size: [1.5, 2.5], r: 20, oy: -4 },
    aurora:   { color: '#6affc8', color2: '#b07cff', p2: 0.4, every: 0.14, vx: [-10, 10], vy: [-30, -20], life: 0.9, size: [1.5, 2.5], r: 22, oy: -10 },
    mortaja:  { color: '#5fffd0', every: 0.16, vx: [-12, 12], vy: [-12, -4], life: 1, size: [2, 3.5], r: 30, oy: 6 },
    azufre:   { color: '#7a7a70', every: 0.1, vx: [-8, 8], vy: [30, 45], life: 0.9, size: [1.5, 2.5], r: 24, oy: -34, normal: true, ember: { color: '#ff8a3d', p: 0.18, vy: [-60, -40] } },
    eclipse:  { color: '#c77dff', every: 0.14, vx: [-6, 6], vy: [12, 20], life: 1.2, size: [1.5, 2.5], r: 26, oy: -30 },
  };
  for (const id of IDS) FORMS[id].ambient = AMB[id] || null;
  function ambient(id) { return AMB[id] || null; }
  // partícula lista para meter en parts (o en un array propio si .normal): {x,y,vx,vy,life,max,color,size,normal}
  function spawnAmbient(id, p, rnd) {
    const A = AMB[id];
    if (!A || !p) return null;
    rnd = rnd || Math.random;
    const R = (a, b) => a + rnd() * (b - a);
    const em = !!A.ember && rnd() < A.ember.p, alt = !em && !!A.color2 && rnd() < A.p2;
    const ang = rnd() * TAU, rr = rnd() * A.r, life = A.life * R(0.8, 1.2);
    return {
      x: p.x + Math.cos(ang) * rr, y: p.y + A.oy + Math.sin(ang) * rr * 0.6,
      vx: R(A.vx[0], A.vx[1]), vy: em ? R(A.ember.vy[0], A.ember.vy[1]) : R(A.vy[0], A.vy[1]),
      life, max: life, color: em ? A.ember.color : alt ? A.color2 : A.color, size: R(A.size[0], A.size[1]), normal: !!A.normal && !em,
    };
  }
  // partículas con composición normal (ceniza de Azufre): drawParts usa 'lighter' y el gris se perdería
  function drawNormalParts(c, arr) {
    if (!c || !arr || !arr.length) return;
    X = c;
    const pa = c.globalAlpha;
    for (const q of arr) { const k = clamp(q.life / q.max, 0, 1); c.globalAlpha = pa * k; G.circle(q.x, q.y, q.size * (0.5 + 0.5 * k), q.color); }
    c.globalAlpha = pa;
  }

  // capas de los rayos (drawBolts: const layers = b.layers || …)
  const BOLT_LAYERS = {
    plasma: [[6, 'rgba(255,90,209,.35)'], [2, '#fff0ff']],
    aurora: [[6, 'rgba(106,255,200,.35)'], [2, '#ffffff']],
    eclipse: [[6, 'rgba(199,125,255,.35)'], [2, '#f3e8ff']],
  };

  // tamaños de las cachés (depuración: glowCache < 70 tras recorrer las 10 formas)
  const stats = () => ({ glow: glowSpr.size, sty: styCache.size, sub: subCache.size, look: lookCache.size, grad: gradCache.size, rgba: rgbaCache.size });

  const api = {
    // constantes
    SQUARE, OPP, IDS, TIER1, PAIR, ANIMA, FORMS, MIXES, ULT, MIX_M, BOLT_LAYERS, EL_COLOR: ELC, EL_NAME: ELN, EL_ICON: ELI,
    // lógica pura
    isOpp, formFor, formEls, keyOf, mixMul, traitsFor, options, sealInfo, pairText, bit, has, count, cards, activeMixes, mixHint, timeline,
    // dibujo
    bind, look, hatGrad, drawBand, drawHatStar, drawGem, drawCracks, drawCrown, drawAura, shotStyle, subStyle, drawShot, drawOrb, drawArc,
    newPool, drawPool, drawAwaken, drawEclipse, vignette, ambient, spawnAmbient, drawNormalParts, stats,
  };
  window.ArcanoForms = api;
})();
