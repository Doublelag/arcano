// =====================================================================================================
//  ESQUIVADOR · bot "jugador humano razonable" para medir la dificultad de Arcano (SIN modo dios)
// =====================================================================================================
//  Uso (Chrome sin ventana, una partida tras otra, cada una en una página recién cargada):
//    CDP_PORT=9441 node tools/cdp.mjs 135 240 tools/esquivador.js
//  Variables de entorno (todas opcionales):
//    SCHOOLS=fire,ice,bolt,poison,arcane   escuelas
//    PROFILES=medio,bueno                  perfiles (medio | bueno | novato = cota inferior | dios = modo dios sin esquivar, referencia de DPS)
//    FORMS=both                            0 = sin formas (flags.noForms), 1 = con formas, both = las dos
//    SEEDS=6  SEED0=1                      semillas SEED0..SEED0+SEEDS-1 (__arcano.seed(n))
//    META=fresh                            fresh = cuenta nueva (sin Santuario ni equipo) | veterano (ver META_VET)
//    OUT=tools/esquivador-out/runs.jsonl   se AÑADE una línea JSON por partida (el informe: tools/esquivador-report.mjs)
//    PROF='{"react":0.2}'                  retoques del perfil para calibrar (se mezclan con el perfil elegido)
//    TAG=texto                             etiqueta que se guarda en cada partida (para filtrar en el informe)
//    MAXMIN=20                             minutos de juego como máximo por partida
//    ALTAR=bendicion                       política de altar (K8): bendicion (siempre Bendición, la de antes) | fuente (siempre
//                                          Fuente) | auto (Pacto si es favorable, Fuente con la vida < 50 %, si no Bendición)
//    CHAPTER=1 HERO=0                      capítulo y modo (__arcano.chapter(n, hero) tras cargar: vale aunque esté cerrado)
//
//  Cómo juega (todo por las vías de entrada del juego, nada de teletransportes salvo para desatascar):
//   - Se mueve con el JOYSTICK (PointerEvent pointerdown/pointermove/pointerup sobre el canvas → joy.vx/vy,
//     moveInput() en game.js). Al estar QUIETO dispara solo (updatePlayer: "Quieto = lanzas hechizos",
//     p.still > 0.06 y sin mover), así que cada esquiva cuesta daño: el bot prefiere quedarse quieto.
//   - Definitivo con la tecla Espacio (keydown en window → castUlt) si hay 3+ enemigos o jefe.
//   - Cartas, altar y despertar: clic en la carta (__arcano.pick(i) = clic sin el bloqueo antitoque de 380 ms).
//   - Esquiva con un planificador de "persona": cada `think` s mira las amenazas que YA ha visto (una bala
//     solo cuenta cuando lleva `react` s en pantalla; con prob. `lapse` no la ve nunca; solo atiende a las
//     `attn` más peligrosas; posición/dirección percibidas con error `posErr`/`angErr`) y prueba quedarse
//     quieto o moverse en 16 direcciones durante 0,12-0,6 s, simulando su trayectoria (rocas, hielo, veneno)
//     contra balas, enemigos de contacto (persecución), embestidas de cargador/jefe, explosión del diablillo y
//     trampas (lava, pinchos según su fase, charco). Elige lo más barato (moverse cuesta `wMove` porque no
//     dispara) y lo ejecuta con un error de dirección `dirErr` (pulgar en el joystick).
//   - Sin línea de tiro `blind` s → se acerca al enemigo más cercano por la rejilla (BFS). Mantiene distancia
//     `comfort` a los de contacto (kiting). Sala limpia → cofre → altar → (espera al despertar) → puerta.
//   - Desatascar: 8 s sin quitar vida a nadie en combate o 12 s sin llegar a su objetivo con la sala limpia
//     → teletransporte (se cuenta en `tp`).
//  Registro por partida: victoria, sala de muerte, tiempo (reloj del juego y real), tiempo/vida perdida/curas
//  por sala, golpes por tipo (bala, contacto, trampa, jefe, bomba) y esquivas/escudos.
//  Fase 5 (K8): también «ve» las Rocas del Gólem (círculo que se llena), el Salto del Rey (sombra donde cae), el Juicio
//  del Señor (línea que barre 180°: sale de lo que va a barrer antes de que llegue), el aviso del Volátil y las copias del
//  Espejismo (sus balas; el bueno lee su cono). gsrc/ghits/gdmg = origen exacto de los golpes según el juego (hitStats()).
//  Lee las velocidades reales de los enemigos (e.speed, CH.foe) en vez de las de antes de la v1.1.
// =====================================================================================================

const fs = await import('node:fs');
const path = await import('node:path');
const E = process.env;
const SCHOOLS = (E.SCHOOLS || 'fire,ice,bolt,poison,arcane').split(',').filter(Boolean);
const PROFILES = (E.PROFILES || 'medio,bueno').split(',').filter(Boolean);
const FORMS = E.FORMS || 'both';
const SEEDS = +E.SEEDS || 6, SEED0 = +E.SEED0 || 1;
const META = E.META || 'fresh';
const OUT = E.OUT || 'E:/PROYECTOS/arcano-snap/tools/esquivador-out/runs.jsonl';
const PROF = E.PROF ? JSON.parse(E.PROF) : {};
const TAG = E.TAG || '';
const MAXMIN = +E.MAXMIN || 20;
const ALTAR = E.ALTAR || 'bendicion', CHAPTER = +E.CHAPTER || 1, HERO = E.HERO === '1';
// banco (para calibrar): START=20 GIVE='{"atk":3,"atkspd":2,"front":1}' AWAKEN=fire,bolt → empieza en esa sala con esa build
const SHOTS = +E.SHOTS || 0, SHOTDIR = E.SHOTDIR || 'E:/PROYECTOS/arcano-snap/tools/esquivador-out/golpes';
const START = +E.START || 1, GIVE = E.GIVE ? JSON.parse(E.GIVE) : null, AWAKEN = E.AWAKEN ? E.AWAKEN.split(',') : null, DEBUG = E.DEBUG === '1';
fs.mkdirSync(path.dirname(OUT), { recursive: true });

// progreso guardado con el que se carga cada partida (localStorage antes de recargar la página)
const SETTINGS = { tutorial: true, ultTip: true, quality: 'baja', dmgNumbers: false, shake: false, vibration: false, music: 0, sfx: 0,
  seenHz: { 1: true, 2: true, 3: true, 4: true }, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } };
// grim.f = 3: ya despertó alguna vez (sin la red (a) del primer despertar), como el bot sim() de game.js
const META_FRESH = { essence: 0, up: {}, schools: ['fire', 'ice', 'bolt'], grim: { f: 3, w: 0, e: 0, m: 0, n: '0000000000', k: [0, 0, 0, 0], t: -1 } };
// veterano: unas 15-20 partidas de Santuario y un equipo raro completo (sin perks)
const META_VET = Object.assign({}, META_FRESH, {
  up: { vida: 3, poder: 3, mana: 2, sabio: 1, paso: 1 },
  gear: { inv: [{ uid: 1, base: 'gemelo', r: 1 }, { uid: 2, base: 'carmesi', r: 1 }, { uid: 3, base: 'rosa', r: 1 }, { uid: 4, base: 'buho', r: 1 }],
    eq: { baston: 1, tunica: 2, anillo: 3, amuleto: 4 }, next: 5 },
});

// ------------------------------------------- lado de la página -------------------------------------------
function PAGE() {
  if (window.__esq) return;
  const A = window.__arcano;
  const AX = 30, AY = 128, AW = 480, AH = 800, CELL = 40, COLS = 12, ROWS = 20, TAU = Math.PI * 2, DT = 1 / 60;
  const canvas = document.getElementById('game'), overlay = document.getElementById('overlay');
  // Determinismo (misma semilla = misma partida): PRE (abajo, en el lado de Node) se inyecta ANTES que game.js con
  // Page.addScriptToEvaluateOnNewDocument: sin bucle de requestAnimationFrame (así `clock` se queda en 0: render()
  // gasta Math.random según sin(clock·40) y un reloj real cambiaría la semilla), performance.now = reloj falso que
  // avanza 1/60 s por frame (Sfx.gate gasta Math.random según el reloj) y sin AudioContext.
  if (!window.__fakeMs) { // por si se usa sin PRE (no será determinista del todo)
    window.__fakeMs = 1e6; performance.now = () => window.__fakeMs;
    try { window.AudioContext = undefined; window.webkitAudioContext = undefined; } catch (_) { /* nada */ }
    window.requestAnimationFrame = () => 0;
  }
  const evc = window.__esqEv = {};
  for (const k of ['blur', 'focus', 'resize', 'visibilitychange', 'pagehide']) window.addEventListener(k, () => { evc[k] = (evc[k] || 0) + 1; }, true);

  // Táctica común (los dos perfiles colocan igual: lejos del jefe, en sitio abierto, a distancia de los de contacto)
  const TACT = { horizon: 0.7, durs: [0.12, 0.25, 0.45, 0.7], clear: 8, comfort: 60, wProx: 200, wMove: 60, wTurn: 8, wGoal: 2, wEdge: 60,
    wSpace: 100, wBoss: 200, bossDist: 260, wCenter: 60, blind: 0.6 };
  // Lo que cambia entre perfiles es la PERCEPCIÓN y la EJECUCIÓN:
  //  react = tiempo hasta "ver" una bala nueva o un aviso (embestida, mecha); think = cada cuánto replanifica;
  //  posErr/angErr = error al estimar dónde está y hacia dónde va cada bala (px / rad, fijo por bala);
  //  dirErr = error del pulgar en el joystick (rad); lapse = prob. de no ver una bala; attn = amenazas a la vez;
  //  tele = lee los avisos (arquero apuntando, espectro reapareciendo, ráfaga del jefe); margin = colchón en px.
  const PROFILES = {
    bueno: Object.assign({}, TACT, { react: 0.16, think: 0.05, margin: 4, posErr: 3, angErr: 0.03, dirErr: 0.08, lapse: 0.02, attn: 14, tele: true, ultDelay: 0.3 }),
    medio: Object.assign({}, TACT, { react: 0.24, think: 0.1, margin: 2, posErr: 6, angErr: 0.08, dirErr: 0.2, lapse: 0.04, attn: 8, tele: false, ultDelay: 0.8 }),
    // novato (cota inferior, no se pidió): reacción lenta, el doble de error que el medio, se le escapan balas y mira menos por delante
    novato: Object.assign({}, TACT, { react: 0.32, think: 0.15, margin: 0, posErr: 12, angErr: 0.16, dirErr: 0.4, lapse: 0.08, attn: 5, tele: false, ultDelay: 1.5,
      horizon: 0.5, durs: [0.15, 0.3, 0.5], wMove: 90 }),
    // modo dios: no esquiva (solo navega y dispara): referencia de DPS
    dios: Object.assign({}, TACT, { god: true, react: 0.2, think: 0.1, margin: 0, posErr: 0, angErr: 0, dirErr: 0, lapse: 0, attn: 0, tele: false, ultDelay: 0.3,
      clear: 0, comfort: 0, wProx: 0, wEdge: 0, wSpace: 0, wBoss: 0, wCenter: 0 }),
  };
  // 2º elemento de la ruta (adyacente en el cuadrado: nunca opuesto, así no pide Pacto)
  const PARTNER = { fire: 'bolt', ice: 'bolt', bolt: 'fire', poison: 'fire', arcane: 'bolt' };
  const SCHOOL_EL = { fire: 'fire', ice: 'ice', bolt: 'bolt', poison: 'poison', arcane: 'fire' }; // el Arcanista empieza su ruta por fuego
  const LOW = ['pierce', 'ricochet', 'diag', 'hp', 'orbs', 'blood', 'dodge', 'wall', 'speed', 'channel', 'side', 'rear'];

  let rs = 1;
  const rng = () => { rs = rs + 0x6D2B79F5 | 0; let t = Math.imul(rs ^ rs >>> 15, 1 | rs); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const gauss = () => { let u = 0; while (!u) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rng()); };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const angDiff = (a, b) => { let d = Math.abs(a - b) % TAU; return d > Math.PI ? TAU - d : d; };

  // ---------- rejilla ----------
  let G = A.grid;
  const isRock = (x, y) => (x < AX || x >= AX + AW || y < AY || y >= AY + AH) ? true : G[((y - AY) / CELL | 0) * COLS + ((x - AX) / CELL | 0)] === 1;
  const los = (x0, y0, x1, y1) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 14); for (let i = 1; i < n; i++) { const t = i / n; if (isRock(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; } return true; };
  const cellOf = (x, y) => { const c = Math.floor((x - AX) / CELL), r = Math.floor((y - AY) / CELL); return c < 0 || c >= COLS || r < 0 || r >= ROWS ? -1 : r * COLS + c; };
  const K7 = 15 * 0.7, K9 = 15 * 0.9;
  const blocked = (x, y) => isRock(x, y) || isRock(x + K7, y + K7) || isRock(x - K7, y + K7) || isRock(x + K7, y - K7) || isRock(x - K7, y - K7)
    || isRock(x + K9, y) || isRock(x - K9, y) || isRock(x, y + K9) || isRock(x, y - K9);
  // campo de distancias (BFS 4-dir) hasta unas celdas objetivo; fval = distancia suave en px desde (x,y)
  function makeField(cells, gx, gy) {
    const f = new Int16Array(COLS * ROWS).fill(-1), q = [];
    for (const c of cells) if (c >= 0 && !G[c]) { f[c] = 0; q.push(c); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], c = i % COLS, r = (i / COLS) | 0;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
        const j = nr * COLS + nc;
        if (G[j] || f[j] >= 0) continue;
        f[j] = f[i] + 1; q.push(j);
      }
    }
    return { f, gx, gy };
  }
  function fval(F, x, y) {
    const c = cellOf(x, y);
    if (c < 0) return 5000;
    const cc = c % COLS, cr = (c / COLS) | 0;
    let best = 1e9;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nc = cc + dc, nr = cr + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      const n = nr * COLS + nc, v = F.f[n];
      if (v < 0 || G[n]) continue;
      const tx = v === 0 ? F.gx : AX + nc * CELL + 20, ty = v === 0 ? F.gy : AY + nr * CELL + 20;
      const d = v * CELL + Math.hypot(x - tx, y - ty);
      if (d < best) best = d;
    }
    return best > 1e8 ? 5000 : best;
  }

  // ---------- entrada: joystick (puntero sobre el canvas) y teclado ----------
  let joyOn = false;
  function joy(dx, dy) {
    if (!dx && !dy) {
      if (joyOn) { canvas.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, bubbles: true })); joyOn = false; }
      return;
    }
    const r = canvas.getBoundingClientRect(), s = r.width / 540, cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, clientX: cx, clientY: cy, bubbles: true, cancelable: true })); // si ya está activo, el juego lo ignora
    canvas.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: cx + dx * 66 * s, clientY: cy + dy * 66 * s, bubbles: true }));
    joyOn = true;
  }
  function press(code) {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code === 'Space' ? ' ' : code, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code === 'Space' ? ' ' : code, bubbles: true }));
  }

  // ---------- partida ----------
  async function run(cfg) {
    const P = Object.assign({}, PROFILES[cfg.profile] || PROFILES.medio, cfg.prof || {});
    const H = P.horizon, NS = Math.max(4, Math.round(H * 30)), dts = H / NS;
    const px = new Float64Array(NS + 1), py = new Float64Array(NS + 1);
    A.flags.freeze = true;
    A.flags.noForms = !!cfg.noForms;
    if (A.chapter && (cfg.chapter > 1 || cfg.hero)) A.chapter(cfg.chapter, cfg.hero); // capítulo y modo (aunque esté cerrado)
    rs = (cfg.seed * 7919 + 17) | 0;
    A.seed(cfg.seed);
    let rcnt = 0;
    if (cfg.trace) { const r0 = Math.random; Math.random = () => { rcnt++; return r0(); }; }
    A.school(cfg.school);
    if (P.god) A.god(true);
    if (cfg.start > 1) { // banco: empieza en esa sala con una build dada (give = { id: niveles }, awaken = [elementos])
      for (const [id, n] of Object.entries(cfg.give || {})) A.give(id, n);
      for (const el of cfg.awaken || []) A.awaken(el);
      A.goto(cfg.start);
    }
    const R = { school: cfg.school, profile: cfg.profile, forms: !cfg.noForms, seed: cfg.seed, meta: cfg.meta, tag: cfg.tag || '', prof: cfg.prof || null,
      win: false, room: 0, lvl: 1, time: 0, realT: 0, frames: 0, hits: { bala: 0, contacto: 0, trampa: 0, jefe: 0, bomba: 0, otro: 0 },
      dmg: { bala: 0, contacto: 0, trampa: 0, jefe: 0, bomba: 0, otro: 0 }, dodges: 0, shields: 0, heal: { carta: 0, cofre: 0, jefe: 0, otras: 0 },
      ults: 0, tp: 0, tpLog: [], picks: [], offers: [], awk: [], combatF: 0, moveF: 0, seen: { vista: 0, tarde: 0, despiste: 0 }, src: {}, hitLog: [], rooms: [], lastHit: null, minHpPct: 1, err: null };
    if (cfg.trace) R.trace = [];
    let frames = 0, room = -1, rec = null, nextThink = 0, cur = { dir: null, until: 0, ex: 0, ey: 0 }, blindT = 0, idleT = 0, hpSum = -1;
    let clearT = 0, goalT = 0, altarUsed = false, awWait = 0, manaFullT = -1, menuSpin = 0, lastDir = null;
    let HZ = new Uint8Array(COLS * ROWS), spikes = [], CRAMP = new Float32Array(COLS * ROWS);
    const seenB = new WeakMap(), seenE = new WeakMap();
    const now = () => frames / 60;
    const seenO = new WeakMap(), seenAt = (o, t) => { if (!seenO.has(o)) seenO.set(o, t); return seenO.get(o); };
    const swept = (pa, a0, a1, dir, w) => { let v = (pa - a0) % TAU; if (v > Math.PI) v -= TAU; if (v < -Math.PI) v += TAU; const s = dir * v; return s >= -w && s <= Math.abs(a1 - a0) + w; };
    const FOE = (A.CH && A.CH.foe) || {}, BM = A.CH && A.CH.k ? Math.min(1.2, Math.pow(1.04, A.CH.k)) : 1;

    function newRoom() {
      room = A.room; G = A.grid;
      HZ = new Uint8Array(COLS * ROWS); spikes = [];
      for (const t of [1, 2, 3, 4]) for (const c of A.hzCells(t)) { HZ[c.i] = t; if (t === 1) spikes.push(c.i); }
      CRAMP = new Float32Array(COLS * ROWS);
      for (let i = 0; i < COLS * ROWS; i++) {
        const c = i % COLS, r = (i / COLS) | 0;
        let k = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = c + dc, nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) { k += 1; continue; }
          const j = nr * COLS + nc;
          k += G[j] ? 1 : (HZ[j] === 4 || HZ[j] === 1) ? 1.5 : 0;
        }
        CRAMP[i] = k;
      }
      const p = A.player;
      rec = { n: room, t: 0, dmg: 0, hits: 0, heal: 0, hp0: Math.round(p.hp), max: p.maxHp, hpMin: p.hp, hp1: 0, boss: room % 5 === 0, tp: 0 };
      R.rooms.push(rec);
      clearT = 0; goalT = 0; altarUsed = false; awWait = 0; blindT = 0; idleT = 0; hpSum = -1; cur = { dir: null, until: 0 };
    }
    const live = () => A.enemies.filter(e => !e.dead && e.spawnT <= 0);

    // ---------- percepción ----------
    function perceive(t) {
      for (const b of A.bullets) if (!seenB.has(b)) {
        const a = gauss() * P.angErr;
        // quién la ha disparado: el enemigo más cercano a la bala al aparecer (el jefe, con su patrón)
        let src = '?', sd = 1e9;
        for (const e of A.enemies) { const d = Math.hypot(e.x - b.x, e.y - b.y); if (d < sd) { sd = d; src = e.kind === 'boss' ? 'jefe:' + ({ ring: 'anillo', spiral: 'espiral', aimed: 'rafaga' }[e.state] || 'choque/teleport') : e.kind; } }
        seenB.set(b, { t0: t, src, lapse: rng() < P.lapse, ex: gauss() * P.posErr, ey: gauss() * P.posErr, ca: Math.cos(a), sa: Math.sin(a) });
      }
      for (const e of A.enemies) {
        const s = seenE.get(e);
        if (!s) seenE.set(e, { st: e.state, t, wind: e.state === 'wind' ? t : -9 });
        else if (s.st !== e.state) { if (e.state === 'wind' || (e.state === 'aim' || e.state === 'in' || e.state === 'fuse' || e.state === 'aimed')) s.wind = t; s.st = e.state; s.t = t; }
      }
    }
    // tiempo hasta que una bala choca con roca (las balas mueren al tocarla)
    function rockTime(x, y, vx, vy, tmax) {
      const v = Math.hypot(vx, vy);
      if (v < 1) return tmax;
      const ux = vx / v, uy = vy / v, L = v * tmax;
      for (let d = 8; d <= L; d += 8) if (isRock(x + ux * d, y + uy * d)) return d / v;
      return tmax + 1;
    }

    // ---------- planificador ----------
    function plan(t) {
      const p = A.player, rm = A.room;
      const TB = [], TE = [], TD = [], TF = [], TS = [];
      const L = live();
      const cleared = A.enemies.every(e => e.dead);
      let canShoot = false;
      for (const e of L) if ((e.alpha === undefined || e.alpha >= 0.4) && los(p.x, p.y, e.x, e.y)) { canShoot = true; break; }
      if (!P.god) {
        for (const b of A.bullets) {
          const s = seenB.get(b);
          if (!s || s.lapse || t - s.t0 < P.react) continue;
          const vx = b.vx * s.ca - b.vy * s.sa, vy = b.vx * s.sa + b.vy * s.ca, x = b.x + s.ex, y = b.y + s.ey;
          const dx = x - p.x, dy = y - p.y, v2 = vx * vx + vy * vy;
          const tc = v2 > 0 ? clamp(-(dx * vx + dy * vy) / v2, 0, H) : 0, dc = Math.hypot(dx + vx * tc, dy + vy * tc);
          if (dc > p.speed * H + 45) continue;
          TB.push({ x, y, vx, vy, rr: b.r + p.r - 4, tS: 0, tR: rockTime(x, y, vx, vy, H), k: dc + 150 * tc });
        }
        for (const e of L) {
          const s = seenE.get(e) || { t: t, wind: t };
          if (e.kind === 'totem') continue;
          if (e.kind === 'bomber') {
            if (e.state === 'fuse') { if (t - s.wind >= P.react) TF.push({ x: e.x, y: e.y, t: e.timer, R: 80 + p.r }); }
            else TE.push({ x: e.x, y: e.y, sp: e.speed * (e.slow > 0 ? 0.62 : 1) * (e.frozen > 0 ? 0 : 1), rr: 72, soft: true });
            continue;
          }
          if (e.alpha !== undefined && e.alpha <= 0.5 && e.kind !== 'boss') {
            // espectro desvanecido: el bueno sabe que reaparece a 150-230 px y dispara (se mira al reaparecer)
            continue;
          }
          if (e.frozen > H) continue;
          if (e.kind === 'mirror') { // copia del Espejismo: no toca; el bueno lee el cono antes de su abanico
            if (P.tele && e.shots < 2 && e.timer < 0.5 && t - s.t >= P.react) {
              const a = Math.atan2(p.y - e.y, p.x - e.x), n = e.strong ? 7 : 5;
              for (let i = 0; i < n; i++) {
                const vx = Math.cos(a + (i - (n - 1) / 2) * 0.17) * 300, vy = Math.sin(a + (i - (n - 1) / 2) * 0.17) * 300;
                TB.push({ x: e.x - vx * e.timer, y: e.y - vy * e.timer, vx, vy, rr: 8 + p.r - 4, tS: e.timer, tR: e.timer + rockTime(e.x, e.y, vx, vy, H), k: 60 + 150 * e.timer });
              }
            }
            continue;
          }
          const boss = e.kind === 'boss';
          if ((e.kind === 'charger' || boss) && (e.state === 'wind' || e.state === 'dash')) {
            const sp = boss ? 560 : FOE.dash || 500, dur = boss ? 0.9 : 0.6;
            if (t - s.wind >= P.react || e.state === 'dash' && t - s.t >= P.react) {
              let t0, d, a;
              if (e.state === 'wind') { t0 = e.timer; d = dur; a = e.timer > 0.2 ? Math.atan2(p.y - e.y, p.x - e.x) : e.aim; }
              else { t0 = 0; d = e.timer; a = e.aim; }
              TD.push({ x: e.x, y: e.y, ux: Math.cos(a) * sp, uy: Math.sin(a) * sp, t0, t1: t0 + d, rr: e.r + p.r - 3, boss });
            }
            TE.push({ x: e.x, y: e.y, sp: 0, rr: e.r + p.r - 3, boss });
            continue;
          }
          let sp = 0;
          if (e.kind === 'slime' || e.kind === 'bigslime') sp = e.speed * 0.65; else if (e.kind === 'bat') sp = e.speed * 0.9; // salto medio / zigzag
          else if (e.kind === 'charger') sp = 50; else if (boss) sp = Math.hypot(e.x - p.x, e.y - p.y) > 170 ? e.speed : 0;
          if (e.slow > 0) sp *= 0.62;
          if (e.frozen > 0) sp = 0;
          TE.push({ x: e.x, y: e.y, sp, rr: e.r + p.r - 3, boss });
          // avisos que lee el jugador bueno: el arquero apuntando, el espectro reapareciendo y la ráfaga del jefe
          if (P.tele && t - s.wind >= P.react) {
            if (e.kind === 'archer' && e.state === 'aim') {
              const lv = e.lv || rm, a = e.timer > 0.15 ? Math.atan2(p.y - e.y, p.x - e.x) : e.aim, spd = (FOE.archer ? FOE.archer.sp[0] + FOE.archer.sp[1] * lv : 290 + lv * 4) * BM;
              for (const da of lv >= 9 ? [-0.22, 0, 0.22] : [0]) {
                const vx = Math.cos(a + da) * spd, vy = Math.sin(a + da) * spd;
                TB.push({ x: e.x - vx * e.timer, y: e.y - vy * e.timer, vx, vy, rr: 6 + p.r - 4, tS: e.timer, tR: e.timer + rockTime(e.x, e.y, vx, vy, H), k: 60 + 150 * e.timer });
              }
            } else if (boss && e.state === 'aimed') {
              const a = Math.atan2(p.y - e.y, p.x - e.x), m = e.strong && e.model === 'brujo' ? 3 : 2;
              for (let i = -m; i <= m; i++) {
                const vx = Math.cos(a + i * 0.17) * 300, vy = Math.sin(a + i * 0.17) * 300;
                TB.push({ x: e.x - vx * e.timer, y: e.y - vy * e.timer, vx, vy, rr: 8 + p.r - 4, tS: e.timer, tR: e.timer + rockTime(e.x, e.y, vx, vy, H), k: 60 + 150 * e.timer });
              }
            }
          }
        }
        if (P.tele) for (const e of L) if (e.kind === 'spirit' && e.state === 'in' && t - (seenE.get(e) || { wind: t }).wind >= P.react) {
          const lv = e.lv || rm, a = Math.atan2(p.y - e.y, p.x - e.x), n = lv >= 15 ? 5 : 3, spd = (FOE.spirit ? FOE.spirit.sp[0] + FOE.spirit.sp[1] * lv : 210) * BM;
          for (let i = 0; i < n; i++) {
            const aa = a + (i - (n - 1) / 2) * 0.2, vx = Math.cos(aa) * spd, vy = Math.sin(aa) * spd;
            TB.push({ x: e.x - vx * e.timer, y: e.y - vy * e.timer, vx, vy, rr: 6 + p.r - 4, tS: e.timer, tR: e.timer + rockTime(e.x, e.y, vx, vy, H), k: 60 + 150 * e.timer });
          }
        }
        TB.sort((a, b) => a.k - b.k);
        if (TB.length > P.attn) TB.length = P.attn;
        // fase 5 (K8): rocas (círculo que se llena), estallido del Volátil, Salto del Rey y Juicio del Señor, vistos tras `react`
        for (const k of A.rocks || []) { if (t - seenAt(k, t) >= P.react) TF.push({ x: k.x, y: k.y, t: k.t, R: k.r + p.r * 0.5, big: true }); }
        for (const v of A.volatileQ || []) { if (t - seenAt(v, t) >= P.react) TF.push({ x: v.x, y: v.y, t: v.t + 0.15, R: 55 }); }
        for (const e of L) if (e.kind === 'boss') {
          // se ven desde que empieza el aviso (la sombra / la línea), no desde el último cambio de estado
          if ((e.state === 'slamUp' || e.state === 'slamDown') && e.tp && t - seenAt(e.tp, t) >= P.react)
            TF.push({ x: e.tp.x, y: e.tp.y, t: e.state === 'slamUp' ? e.timer + 0.25 : e.timer, R: 80 + p.r * 0.5, big: true });
          if ((e.state === 'sweepW' || e.state === 'sweep') && e.sw && !e.sw.hit && t - seenAt(e.sw, t) >= P.react)
            TS.push({ x: e.x, y: e.y, a0: e.sw.a0, dir: e.sw.dir, tS: e.state === 'sweepW' ? e.timer : -(1.2 - e.timer), R: 420 + p.r });
        }
      }
      // objetivo de navegación
      let goal = null;
      if (cleared) {
        const ch = A.chest();
        const wantAw = !A.flags.noForms && p.animaReady && p.awak < 2 && !p.awkLock && p.snoozeRoom !== rm;
        if (ch && !ch.opened) goal = makeField([cellOf(ch.x, ch.y)], ch.x, ch.y);
        else if ([4, 9, 14, 19].includes(rm) && !altarUsed) goal = makeField([cellOf(AX + AW / 2, AY + 340)], AX + AW / 2, AY + 340);
        else if (wantAw && awWait < 2.5) goal = null;
        else if (rm < 20) goal = makeField([5, 6], AX + AW / 2, AY + 20);
      } else if (blindT > P.blind && L.length) {
        let best = null, bd = 1e9;
        for (const e of L) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
        goal = makeField([cellOf(best.x, best.y)], best.x, best.y);
      }
      // la puerta: en su columna, todo recto hacia arriba
      if (cleared && goal && goal.gy === AY + 20 && Math.abs(p.x - (AX + AW / 2)) < 26 && p.y < AY + 70) return { dir: -Math.PI / 2, dur: 1 };
      const spPh = {};
      for (const i of spikes) spPh[i] = A.spike(i);
      const bossE = L.find(e => e.kind === 'boss') || null;
      let best = null, bestC = Infinity;
      const tryCand = (dir, dur) => {
        let x = p.x, y = p.y, vx = p.vx, vy = p.vy, cost = 0;
        px[0] = x; py[0] = y;
        for (let i = 1; i <= NS; i++) {
          const tt = i * dts, mv = dir !== null && tt <= dur + 1e-6;
          const ci = cellOf(x, y), gr = ci >= 0 ? HZ[ci] : 0, spd = p.speed * (gr === 2 ? 0.6 : 1);
          const tx = mv ? Math.cos(dir) * spd : 0, ty = mv ? Math.sin(dir) * spd : 0;
          if (gr === 3) { const k = Math.min(1, dts * 4); vx += (tx - vx) * k; vy += (ty - vy) * k; } else { vx = tx; vy = ty; }
          let nx = clamp(x + vx * dts, AX + 15, AX + AW - 15), ny = clamp(y + vy * dts, AY + 15, AY + AH - 15);
          if (blocked(nx, ny)) { if (!blocked(nx, y)) ny = y; else if (!blocked(x, ny)) nx = x; else { nx = x; ny = y; } }
          x = nx; y = ny; px[i] = x; py[i] = y;
          if (!P.god) {
            const c2 = cellOf(x, y), h = c2 >= 0 ? HZ[c2] : 0;
            if (h === 4) cost += 60; else if (h === 1) cost += spPh[c2] === 2 ? 80 : spPh[c2] === 1 ? 30 : 4; else if (h === 2) cost += 5;
          }
        }
        for (const b of TB) {
          let hit = -1, dmin = 1e9;
          for (let i = 1; i <= NS; i++) {
            const tt = i * dts;
            if (tt < b.tS || tt > b.tR) continue;
            const d = Math.hypot(px[i] - b.x - b.vx * tt, py[i] - b.y - b.vy * tt);
            if (d < dmin) dmin = d;
            if (d < b.rr + P.margin) { hit = tt; break; }
          }
          if (hit >= 0) cost += 1000 * (1 - 0.5 * hit / H);
          else if (P.clear > 0 && dmin < b.rr + P.margin + P.clear) cost += 120 * (1 - (dmin - b.rr - P.margin) / P.clear);
        }
        // contacto: el primer toque y el tiempo que sigues encima (si ya te ha alcanzado, cuenta salir cuanto antes)
        for (const e of TE) {
          let ex = e.x, ey = e.y, hit = -1, over = 0, gmin = 1e9;
          for (let i = 1; i <= NS; i++) {
            if (e.sp > 0) { const dx = px[i] - ex, dy = py[i] - ey, d = Math.hypot(dx, dy); if (d > 1) { const st = Math.min(d, e.sp * dts); ex += dx / d * st; ey += dy / d * st; } }
            const g = Math.hypot(px[i] - ex, py[i] - ey) - e.rr;
            if (g < gmin) gmin = g;
            if (!e.soft && g < P.margin) { over++; if (hit < 0) hit = i * dts; }
          }
          if (hit >= 0) cost += (e.boss ? 1100 : 900) * (0.5 * (1 - 0.5 * hit / H) + 0.5 * over / NS);
          else if (P.comfort > 0 && gmin < P.comfort) cost += P.wProx * (1 - Math.max(0, gmin) / P.comfort) * (e.soft ? 1.5 : 1);
        }
        for (const d of TD) {
          let hit = -1, over = 0;
          for (let i = 1; i <= NS; i++) {
            const tt = i * dts;
            if (tt < d.t0 - 0.05 || tt > d.t1 + 0.05) continue;
            const k = clamp(tt - d.t0, 0, d.t1 - d.t0);
            if (Math.hypot(px[i] - d.x - d.ux * k, py[i] - d.y - d.uy * k) < d.rr + P.margin + 4) { over++; if (hit < 0) hit = tt; }
          }
          if (hit >= 0) cost += (d.boss ? 1100 : 950) * (0.6 * (1 - 0.5 * hit / H) + 0.4 * over / NS);
        }
        for (const f of TF) {
          if (f.t <= H) { const i = clamp(Math.round(f.t / dts), 1, NS); if (Math.hypot(px[i] - f.x, py[i] - f.y) < f.R + P.margin + 3) cost += 1000 * (1 - 0.5 * f.t / H); }
          else if (Math.hypot(px[NS] - f.x, py[NS] - f.y) < f.R + 10) cost += f.big ? 600 : 300;
        }
        for (const S of TS) { // Juicio: el rayo barre de a0 a a0 + dir·π en 1,2 s desde tS
          const beam = tt => S.a0 + S.dir * Math.PI * clamp((tt - S.tS) / 1.2, 0, 1);
          let hit = -1;
          for (let i = 1; i <= NS && hit < 0; i++) {
            const tt = i * dts;
            if (tt < S.tS) continue;
            const d = Math.hypot(px[i] - S.x, py[i] - S.y);
            if (d < S.R && swept(Math.atan2(py[i] - S.y, px[i] - S.x), beam(tt - dts), beam(tt), S.dir, Math.asin(Math.min(1, (p.r - 4 + P.margin) / Math.max(d, 1))))) hit = tt;
          }
          if (hit >= 0) cost += 1100 * (1 - 0.5 * hit / H);
          else { // al acabar el plan, ¿sigue dentro de lo que aún falta por barrer?
            const d = Math.hypot(px[NS] - S.x, py[NS] - S.y);
            if (d < S.R && swept(Math.atan2(py[NS] - S.y, px[NS] - S.x), beam(H), S.a0 + S.dir * Math.PI, S.dir, 0.05)) cost += 500;
          }
        }
        if (dir !== null) {
          cost += (canShoot ? P.wMove : P.wMove * 0.2) * Math.min(1, dur / H);
          if (lastDir !== null && angDiff(dir, lastDir) > 0.8) cost += P.wTurn;
        }
        if (goal) cost += P.wGoal * fval(goal, px[NS], py[NS]);
        if (P.wEdge) { const ed = Math.min(px[NS] - AX, AX + AW - px[NS], py[NS] - AY, AY + AH - py[NS]); if (ed < 50) cost += P.wEdge * (1 - ed / 50); }
        // sitio con espacio para esquivar: casillas vecinas con roca/borde (1) o lava/pinchos (1,5)
        if (P.wSpace && !cleared) { const c2 = cellOf(px[NS], py[NS]); if (c2 >= 0) cost += P.wSpace * CRAMP[c2] / 8; }
        // distancia al jefe (embiste hacia ti y su anillo nace donde choca)
        if (P.wBoss && bossE) {
          const d = Math.hypot(px[NS] - bossE.x, py[NS] - bossE.y);
          if (d < P.bossDist) cost += P.wBoss * (1 - d / P.bossDist);
          cost += P.wCenter * (Math.abs(px[NS] - (AX + AW / 2)) / (AW / 2) + Math.abs(py[NS] - (AY + AH / 2)) / (AH / 2)) / 2; // contra el jefe, por el centro
        }
        if (cost < bestC - 1e-6) { bestC = cost; best = { dir, dur }; }
      };
      tryCand(null, 0);
      if (bestC > 0.5 || goal) for (let k = 0; k < 16; k++) for (const d of P.durs) tryCand(k * TAU / 16, d);
      return best;
    }

    // ---------- un frame de simulación con el registro de golpes y curas ----------
    const near = [], shotBuf = [];
    R.shots = [];
    function stepFrame() {
      const p = A.player, st0 = A.state, rm = A.room;
      const hp0 = p.hp, inv0 = p.inv, tcd0 = p.trapCd, sh0 = p.shield;
      const lh0 = A.lastHit;
      let ch0 = null, live0 = 0, fuse = null;
      near.length = 0;
      if (st0 === 'play') {
        for (const b of A.bullets) if (Math.abs(b.x - p.x) < 70 && Math.abs(b.y - p.y) < 70) near.push(b);
        for (const e of A.enemies) {
          if (!e.dead) live0++;
          if (e.kind === 'bomber' && e.state === 'fuse' && !e.dead && e.timer < 0.1 && Math.hypot(e.x - p.x, e.y - p.y) < 110) fuse = e;
        }
        ch0 = A.chest();
      }
      A.step(DT - 1e-7);
      window.__fakeMs += 1000 / 60;
      frames++;
      if (cfg.trace && frames % cfg.trace === 0) R.trace.push([frames, A.room, A.state, Math.round(p.x * 100), Math.round(p.y * 100), A.enemies.length, A.bullets.length, rcnt, cur.dir === null ? -1 : Math.round(cur.dir * 100), A.kills, A.shots.length, Math.round(A.enemies.reduce((s, e) => s + e.hp, 0) * 100), Math.round(p.xp * 100), Math.round(p.mana * 100), p.lvl].join(','));
      if (cfg.shots && frames % 6 === 0) { shotBuf.push({ t: Math.round(frames / 6) / 10, png: canvas.toDataURL('image/png'), plan: cur.dir === null ? 'quieto' : Math.round(cur.dir * 57.3) + 'º' }); if (shotBuf.length > 10) shotBuf.shift(); }
      if (rec) rec.t += DT;
      const dh = p.hp - hp0;
      if (st0 !== 'play') return;
      let hit = null, info = null;
      if (p.trapCd > tcd0 + 0.2 && dh < 0) hit = 'trampa';
      else if (p.inv > inv0 + 0.2) {
        if (dh < -0.01) {
          const cur = new Set(A.bullets);
          let bh = null, bd = 1e9;
          for (const b of near) if (!cur.has(b)) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (d < bd) { bd = d; bh = b; } }
          if (bh && bd < bh.r + p.r + Math.hypot(bh.vx, bh.vy) / 60 + 6) {
            hit = rm % 5 === 0 ? 'jefe' : 'bala';
            const sb = seenB.get(bh), age = sb ? frames / 60 - sb.t0 : 0;
            info = { age: Math.round(age * 100) / 100, k: sb && sb.lapse ? 'despiste' : age < P.react ? 'tarde' : 'vista' };
            R.seen[info.k]++;
            const src = sb ? sb.src : '?';
            R.src[src] = (R.src[src] || 0) + 1;
          }
          else if (A.lastHit !== lh0 && A.lastHit && /^boss:(rocks|slam|sweep)$/.test(A.lastHit.src)) { hit = 'jefe'; const k = 'jefe:' + A.lastHit.src.slice(5); R.src[k] = (R.src[k] || 0) + 1; } // rocas, salto y Juicio
          else if (fuse && (fuse.dead || fuse.selfBlast)) hit = 'bomba';
          else {
            let ce = null, cd = 1e9;
            for (const e of A.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - p.x, e.y - p.y) - e.r - p.r; if (d < cd) { cd = d; ce = e; } }
            hit = ce && cd < 12 ? (ce.kind === 'boss' ? 'jefe' : 'contacto') : 'otro';
            if (ce) { info = { e: ce.kind, st: ce.state }; const k = 'toque:' + ce.kind + (ce.kind === 'boss' || ce.kind === 'charger' ? '/' + ce.state : ''); R.src[k] = (R.src[k] || 0) + 1; }
          }
        } else if (p.shield < sh0) R.shields++;
        else if (Math.abs(p.inv - 0.3) < 0.05) R.dodges++;
      }
      if (hit) {
        const d = Math.max(0, -dh);
        R.hits[hit]++; R.dmg[hit] += d; R.lastHit = hit;
        if (rec) { rec.hits++; rec.dmg += d; }
        if (cfg.shots && R.shots.length < cfg.shots) R.shots.push({ hit, t: Math.round(frames / 6) / 10, frames: shotBuf.concat([{ t: Math.round(frames / 6) / 10, png: canvas.toDataURL('image/png'), plan: 'GOLPE' }]) });
        if (cfg.debug) R.hitLog.push(Object.assign({ t: Math.round(frames / 6) / 10, room: rm, hit, dmg: Math.round(d), hp: Math.round(p.hp), x: Math.round(p.x), y: Math.round(p.y), plan: cur.dir === null ? 'quieto' : Math.round(cur.dir * 57.3) + 'º', nb: A.bullets.length }, info));
      } else if (dh > 0.01) {
        let src = 'otras';
        const ch1 = A.chest();
        if (ch0 && ch1 && !ch0.opened && ch1.opened) src = 'cofre';
        else if (rm % 5 === 0 && live0 > 0 && A.enemies.every(e => e.dead)) src = 'jefe';
        R.heal[src] += dh;
        if (rec) rec.heal += dh;
      }
      if (rec) rec.hpMin = Math.min(rec.hpMin, p.hp);
      R.minHpPct = Math.min(R.minHpPct, Math.max(0, p.hp) / p.maxHp);
    }

    // ---------- menús ----------
    function chooseCard() {
      const p = A.player;
      const ids = [...overlay.querySelectorAll('[data-act="pick"]')].map(b => b.dataset.id);
      if (!ids.length) { if (p.animaReady) A.later(); return false; }
      if (ids[0].startsWith('awk:')) {
        const els = ids.map(id => id.slice(4)), st = p.awak + 1;
        const school = SCHOOL_EL[cfg.school];
        const want = st === 1 ? (p.aff[0] || school) : (p.aff.find(x => x !== p.core) || PARTNER[cfg.school]);
        const el = els.includes(want) ? want : els[0];
        R.awk.push({ st, room: A.room, el });
        A.pick(ids.indexOf('awk:' + el));
        return true;
      }
      const lv = id => p.sk[id] || 0;
      const own = SCHOOL_EL[cfg.school], partner = cfg.school === 'arcane' ? 'bolt' : PARTNER[cfg.school];
      const has = id => ids.includes(id);
      let pick = null;
      if (has('heal') && p.hp < p.maxHp * 0.5) pick = 'heal';
      if (!pick) pick = ['front', 'atk', 'atkspd', 'multi', 'crit'].find(has);
      if (!pick && has(own) && lv(own) < 2) pick = own;
      if (!pick && has(partner) && lv(partner) < 2) pick = partner;
      if (!pick && has('hp') && p.hp < p.maxHp * 0.6) pick = 'hp';
      if (!pick) pick = ids.find(id => id.startsWith('f_'));
      if (!pick) pick = LOW.find(has);
      if (!pick) pick = ids.find(id => id !== 'heal' && !['fire', 'ice', 'bolt', 'poison'].includes(id)) || ids.find(id => id !== 'heal') || ids[0];
      const hp0 = p.hp;
      R.picks.push(pick);
      R.offers.push(ids.join('/'));
      A.pick(ids.indexOf(pick));
      if (p.hp > hp0) R.heal.carta += p.hp - hp0;
      return true;
    }
    const ALTAR = cfg.altar || 'bendicion';
    function chooseAltar() {
      const ids = [...overlay.querySelectorAll('[data-act="altar"]')].map(b => b.dataset.id);
      altarUsed = true;
      const all = [...overlay.querySelectorAll('[data-act="pick"],[data-act="school"]:not(.locked),[data-act="altar"]')], p = A.player;
      const fav = !!overlay.querySelector('[data-act="altar"][data-id="pact"].fav');
      // K8: bendicion = siempre Bendición · fuente = siempre Fuente · auto = Pacto favorable si lo hay, Fuente con < 50 %, si no Bendición
      let want = ALTAR === 'fuente' ? 'heal' : ALTAR === 'auto' ? (fav ? 'pact' : p.hp < p.maxHp * 0.5 ? 'heal' : 'bless') : 'bless';
      if (!ids.includes(want)) want = 'bless';
      const i = all.findIndex(b => b.dataset.id === want);
      const hp0 = p.hp;
      A.pick(i >= 0 ? i : 0);
      if (p.hp > hp0) { R.heal.otras += p.hp - hp0; R.fuente = (R.fuente || 0) + Math.round(p.hp - hp0); } // la Fuente cuenta en las curas
      R.picks.push('altar:' + (i >= 0 ? want : ids[0]) + (want === 'pact' && fav ? '+' : ''));
    }

    // ---------- bucle ----------
    const maxF = (cfg.maxMin || 20) * 3600;
    while (frames < maxF) {
      const st = A.state;
      if (st === 'play') {
        if (A.room !== room) newRoom();
        menuSpin = 0;
        const t = now(), p = A.player;
        perceive(t);
        const L = live(), cleared = A.enemies.every(e => e.dead);
        // línea de tiro, atascos y definitivo
        if (!cleared) {
          clearT = 0;
          const vis = L.some(e => (e.alpha === undefined || e.alpha >= 0.4) && los(p.x, p.y, e.x, e.y));
          blindT = vis ? 0 : blindT + DT;
          const s = A.enemies.reduce((a, e) => a + (e.dead ? 0 : e.hp), 0);
          idleT = hpSum < 0 || s < hpSum - 0.01 ? 0 : idleT + DT; hpSum = s;
          if (idleT > 8 && L.length) { // desatascar: al lado del enemigo más cercano con línea de tiro
            idleT = 0;
            let best = null, bd = 1e9;
            for (const e of L) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
            for (let k = 0; k < 30; k++) {
              const a = rng() * TAU, d = 120 + rng() * 80, x = clamp(best.x + Math.cos(a) * d, AX + 20, AX + AW - 20), y = clamp(best.y + Math.sin(a) * d, AY + 20, AY + AH - 20);
              if (!blocked(x, y) && los(x, y, best.x, best.y)) { p.x = x; p.y = y; R.tp++; rec.tp++; R.tpLog.push(A.room + ':combate'); break; }
            }
          }
          const bossOn = L.some(e => e.kind === 'boss');
          if (p.mana >= 100) {
            if (manaFullT < 0) manaFullT = t;
            if (t - manaFullT >= P.ultDelay && (bossOn || L.length >= 3)) { press('Space'); if (p.mana < 100) { R.ults++; manaFullT = -1; } }
          } else manaFullT = -1;
        } else {
          clearT += DT; blindT = 0;
          const wantAw = !A.flags.noForms && p.animaReady && p.awak < 2 && !p.awkLock && p.snoozeRoom !== A.room;
          if (wantAw) awWait += DT; else goalT += DT;
          if (goalT > 12 && A.room < 20) { // desatascar con la sala limpia
            goalT = 0; R.tp++; rec.tp++; R.tpLog.push(A.room + ':objetivo');
            const ch = A.chest();
            if (ch && !ch.opened) { p.x = ch.x; p.y = ch.y + 12; }
            else if ([4, 9, 14, 19].includes(A.room) && !altarUsed) { p.x = AX + AW / 2; p.y = AY + 352; }
            else { p.x = AX + AW / 2; p.y = AY + 30; }
          }
        }
        if (t >= nextThink || (cur.dir !== null && t >= cur.until)) {
          const b = plan(t);
          nextThink = t + P.think;
          if (b && b.dir !== null) {
            const d = b.dir + gauss() * P.dirErr;
            cur = { dir: b.dir, until: t + b.dur + Math.abs(gauss()) * 0.02, ex: Math.cos(d), ey: Math.sin(d) };
            lastDir = b.dir;
          } else { cur = { dir: null, until: 0 }; lastDir = null; }
        }
        const mv = cur.dir !== null && t < cur.until;
        if (mv) joy(cur.ex, cur.ey); else joy(0, 0);
        if (!cleared && L.length) { R.combatF++; if (mv) R.moveF++; }
        stepFrame();
      } else if (st === 'transition' || st === 'dying') { joyOn = false; stepFrame(); }
      else if (st === 'levelup') { joyOn = false; if (++menuSpin > 30) { R.err = 'menu atascado'; break; } chooseCard(); }
      else if (st === 'altar') { joyOn = false; chooseAltar(); }
      else if (st === 'paused') { R.pauses = (R.pauses || 0) + 1; const b = overlay.querySelector('[data-act="resume"]'); if (b) b.click(); else break; }
      else break;
      if ((frames & 2047) === 0) await new Promise(r => setTimeout(r, 0));
    }
    const p = A.player, st = A.state;
    R.win = st === 'win'; R.room = A.room; R.lvl = p.lvl; R.frames = frames; R.realT = Math.round(frames / 6) / 10;
    if (st !== 'win' && st !== 'over') R.err = R.err || 'tiempo agotado (' + st + ')';
    const m = (overlay.innerHTML.match(/Tiempo<\/span><b>(\d+):(\d+)/) || []);
    R.time = m.length ? +m[1] * 60 + +m[2] : null;
    const me = overlay.innerHTML.match(/\+✨ (\d+) de esencia/);
    R.ess = me ? +me[1] : null; // esencia ganada en la partida (pantalla final)
    if (rec) rec.hp1 = Math.round(Math.max(0, p.hp));
    for (const r of R.rooms) { r.t = Math.round(r.t * 10) / 10; r.dmg = Math.round(r.dmg); r.heal = Math.round(r.heal); r.hpMin = Math.round(Math.max(0, r.hpMin)); }
    for (const k in R.dmg) R.dmg[k] = Math.round(R.dmg[k]);
    for (const k in R.heal) R.heal[k] = Math.round(R.heal[k]);
    R.minHpPct = Math.round(R.minHpPct * 100) / 100;
    R.moveFrac = R.combatF ? Math.round(R.moveF / R.combatF * 100) / 100 : 0;
    R.maxHp = p.maxHp; R.form = p.form; R.core = p.core; R.second = p.second; R.aff = p.aff.slice();
    R.sk = Object.assign({}, p.sk);
    R.ev = Object.assign({}, window.__esqEv);
    try { const hs = A.hitStats(); R.gsrc = hs.src; R.ghits = hs.hitsBy; R.gdmg = Object.fromEntries(Object.entries(hs.dmgBy).map(([k, v]) => [k, Math.round(v)])); } catch (_) { /* juego sin contador */ }
    R.chapter = A.chapterId || 1; R.hero = !!A.hero; R.altar = cfg.altar;
    joy(0, 0);
    return JSON.stringify(R);
  }
  window.__esq = { run, PROFILES };
}

// ------------------------------------------- lado de Node -------------------------------------------
const PRE = `window.__fakeMs = 1e6; performance.now = () => window.__fakeMs; window.requestAnimationFrame = () => 0;
  try { window.AudioContext = undefined; window.webkitAudioContext = undefined; } catch (_) {}`;
let preDone = false;
async function freshPage(meta) {
  if (!preDone) { await send('Page.addScriptToEvaluateOnNewDocument', { source: PRE }); preDone = true; }
  await ev(`(() => { localStorage.clear(); localStorage.setItem('arcano.settings', ${JSON.stringify(JSON.stringify(SETTINGS))}); localStorage.setItem('arcano.meta', ${JSON.stringify(JSON.stringify(meta))}); localStorage.setItem('arcano.muted', 'false'); document.cookie = 'arcano_meta=;max-age=0;path=/'; location.reload(); return 1; })()`);
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    const ok = await ev(`!!(window.__arcano && window.__arcano.step && window.__arcano.state === 'menu')`);
    if (ok === true) break;
  }
  await ev(`(${PAGE.toString()})(); 1`);
}

const runs = [];
const formsList = FORMS === 'both' ? [false, true] : [FORMS === '1'];
for (const profile of PROFILES) for (const withForms of (profile === 'dios' && FORMS === 'both' ? [false, true] : formsList)) for (const school of SCHOOLS) for (let s = SEED0; s < SEED0 + SEEDS; s++) {
  const cfg = { school, profile, noForms: !withForms, seed: s, meta: META, tag: TAG, prof: Object.keys(PROF).length ? PROF : null, maxMin: MAXMIN, altar: ALTAR, chapter: CHAPTER, hero: HERO, start: START, give: GIVE, awaken: AWAKEN, debug: DEBUG, shots: SHOTS, trace: +E.TRACE || 0 };
  await freshPage(META === 'veterano' ? META_VET : META_FRESH);
  const t0 = Date.now();
  const out = await ev(`__esq.run(${JSON.stringify(cfg)})`);
  if (typeof out !== 'string' || out.startsWith('ERR')) { console.log('ERROR', JSON.stringify(cfg), String(out).slice(0, 400)); continue; }
  const R = JSON.parse(out);
  if (R.shots && R.shots.length) {
    fs.mkdirSync(SHOTDIR, { recursive: true });
    R.shots.forEach((h, k) => h.frames.forEach((f, j) => fs.writeFileSync(`${SHOTDIR}/${profile}-${school}-s${s}-g${k}-${String(j).padStart(2, '0')}-${f.t}s-${f.plan}.png`, Buffer.from(f.png.split(',')[1], 'base64'))));
  }
  delete R.shots;
  R.wall = Math.round((Date.now() - t0) / 100) / 10;
  fs.appendFileSync(OUT, JSON.stringify(R) + '\n');
  runs.push(R);
  const fmt = s => s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const h = R.hits;
  if (DEBUG) for (const h of R.hitLog) console.log('   golpe', JSON.stringify(h));
  console.log(`${profile.padEnd(5)} ${withForms ? 'formas' : 'sin   '} ${school.padEnd(6)} s${String(s).padEnd(3)} ${R.win ? 'GANA ' : 'muere'} sala ${String(R.room).padStart(2)} niv ${String(R.lvl).padStart(2)} t ${fmt(R.time)} (real ${fmt(R.realT)}) ` +
    `golpes b${h.bala}/c${h.contacto}/t${h.trampa}/j${h.jefe}/x${h.bomba}/o${h.otro} esq ${R.dodges} curas ${R.heal.carta + R.heal.cofre + R.heal.jefe + R.heal.otras} ult ${R.ults} tp ${R.tp}${R.tpLog.length ? '(' + R.tpLog.join(',') + ')' : ''} mov ${R.moveFrac} ${R.form || ''}${R.err ? ' ERR ' + R.err : ''} [${R.wall}s]`);
}
console.log(`\n${runs.length} partidas → ${OUT}`);
