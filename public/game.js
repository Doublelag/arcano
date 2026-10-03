'use strict';
(() => {
  // ================================================================
  //  Constantes
  // ================================================================
  const W = 540, H = 960;                       // resolución lógica (vertical)
  const AX = 30, AY = 128, AW = 480, AH = 800;  // arena jugable
  const CELL = 40, COLS = 12, ROWS = 20;        // rejilla de obstáculos
  const DOOR_X0 = AX + AW / 2 - 50, DOOR_X1 = AX + AW / 2 + 50;
  const TOTAL_ROOMS = 20;
  const TAU = Math.PI * 2;
  const ARROW_SPEED = 760;
  const JOY_R = 70;
  const SPAWN_C = 5, SPAWN_R = 18;              // celda donde aparece el jugador
  const DIR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const DIR8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif';

  // ================================================================
  //  Utilidades
  // ================================================================
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('arquero.' + k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem('arquero.' + k, JSON.stringify(v)); } catch (_) { /* sin almacenamiento */ } },
  };

  // ================================================================
  //  Sonido (sintetizado, sin archivos)
  // ================================================================
  const Sfx = {
    ctx: null, master: null, nbuf: null, last: {}, muted: store.get('muted', false),
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
      } catch (_) { this.ctx = null; }
    },
    setMuted(m) { this.muted = m; store.set('muted', m); if (this.master) this.master.gain.value = m ? 0 : 0.5; },
    gate(k, ms) { const n = performance.now(); if (n - (this.last[k] || 0) < ms) return false; this.last[k] = n; return true; },
    tone(f, dur, type = 'square', vol = 0.1, slide = 1, delay = 0) {
      if (!this.ctx || this.muted) return;
      const c = this.ctx, t = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    },
    noise(dur, vol = 0.1, freq = 1500) {
      if (!this.ctx || this.muted) return;
      const c = this.ctx, t = c.currentTime;
      if (!this.nbuf) {
        this.nbuf = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate);
        const d = this.nbuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.nbuf; f.type = 'lowpass'; f.frequency.value = freq;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(this.master);
      s.start(t); s.stop(t + dur);
    },
    shoot() { if (this.gate('shoot', 60)) this.tone(740, 0.07, 'triangle', 0.05, 0.55); },
    hit() { if (this.gate('hit', 35)) this.noise(0.05, 0.07, 2400); },
    kill() { if (this.gate('kill', 40)) { this.tone(420, 0.12, 'square', 0.05, 0.35); this.noise(0.12, 0.06, 900); } },
    hurt() { this.tone(180, 0.25, 'sawtooth', 0.12, 0.45); this.noise(0.15, 0.1, 600); },
    eshot() { if (this.gate('eshot', 70)) this.tone(330, 0.08, 'sawtooth', 0.03, 0.7); },
    gem() { if (this.gate('gem', 28)) this.tone(1100 + Math.random() * 300, 0.05, 'sine', 0.05); },
    level() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.09, 1, i * 0.07)); },
    pick() { this.tone(880, 0.1, 'triangle', 0.08, 1.5); },
    door() { this.tone(196, 0.35, 'triangle', 0.1, 2); },
    boss() { this.tone(110, 0.6, 'sawtooth', 0.12, 0.6); this.tone(82, 0.8, 'square', 0.06, 0.8, 0.15); },
    boom() { this.noise(0.6, 0.2, 500); this.tone(90, 0.5, 'sine', 0.2, 0.4); },
    die() { this.tone(300, 0.7, 'sawtooth', 0.12, 0.2); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.1, 1, i * 0.11)); },
  };

  // ================================================================
  //  Datos: enemigos, jefes, habilidades
  // ================================================================
  const ENEMIES = {
    slime:   { hp: 20, r: 17, speed: 78,  dmg: 10, xp: 3, cost: 1,   color: '#6fd25a', ground: true },
    bat:     { hp: 12, r: 13, speed: 112, dmg: 8,  xp: 2, cost: 1,   color: '#8a4fd8', ground: false },
    archer:  { hp: 18, r: 16, speed: 62,  dmg: 12, xp: 3, cost: 1.5, color: '#5d8f2f', ground: true },
    charger: { hp: 34, r: 19, speed: 50,  dmg: 16, xp: 4, cost: 2,   color: '#9a6431', ground: true },
    mage:    { hp: 28, r: 17, speed: 34,  dmg: 11, xp: 4, cost: 2,   color: '#4659d6', ground: true },
  };

  const BOSSES = {
    5:  { tier: 1, name: 'Gólem de Piedra',      hp: 480,  r: 40, speed: 55, color: '#8f8270', bullet: '#ffb347', pats: ['ring', 'charge', 'aimed'] },
    10: { tier: 2, name: 'Rey Slime',            hp: 1150, r: 42, speed: 65, color: '#57c75e', bullet: '#b6ff6b', pats: ['summon', 'ring', 'charge', 'aimed'] },
    15: { tier: 3, name: 'Brujo Sombrío',        hp: 2100, r: 34, speed: 45, color: '#6d4bd8', bullet: '#c58bff', pats: ['spiral', 'teleport', 'aimed', 'summon', 'ring'] },
    20: { tier: 4, name: 'Señor de la Mazmorra', hp: 3600, r: 44, speed: 70, color: '#d63c3c', bullet: '#ff6a3d', pats: ['spiral', 'charge', 'ring', 'summon', 'teleport', 'aimed'] },
  };

  const SKILLS = [
    { id: 'front',    icon: '🏹', name: 'Flecha frontal +1',  max: 3, w: 1.1, desc: '+1 flecha hacia delante (−12% daño por flecha)' },
    { id: 'multi',    icon: '🔁', name: 'Disparo múltiple',   max: 3, w: 1.1, desc: 'Lanzas otra ráfaga justo después (−10% daño)' },
    { id: 'diag',     icon: '↗️', name: 'Flechas diagonales', max: 2, w: 1,   desc: '+2 flechas en diagonal' },
    { id: 'side',     icon: '↔️', name: 'Flechas laterales',  max: 1, w: 0.8, desc: '+2 flechas a los lados' },
    { id: 'rear',     icon: '↩️', name: 'Flecha trasera',     max: 1, w: 0.8, desc: '+1 flecha hacia atrás' },
    { id: 'ricochet', icon: '🔀', name: 'Rebote',             max: 2, w: 1,   desc: 'Las flechas saltan a 2 enemigos más' },
    { id: 'pierce',   icon: '🗡️', name: 'Atravesar',          max: 2, w: 1,   desc: 'Las flechas atraviesan 1 enemigo más' },
    { id: 'wall',     icon: '🧱', name: 'Rebote en muros',    max: 2, w: 0.9, desc: 'Las flechas rebotan 2 veces en muros y rocas' },
    { id: 'atk',      icon: '⚔️', name: 'Ataque +25%',        max: 6, w: 1,   desc: 'Más daño en todos tus ataques' },
    { id: 'atkspd',   icon: '⚡', name: 'Velocidad de ataque', max: 5, w: 1,  desc: '+22% de cadencia de disparo' },
    { id: 'crit',     icon: '🎯', name: 'Ojo de halcón',      max: 4, w: 0.9, desc: '+10% prob. de crítico y +25% daño crítico' },
    { id: 'hp',       icon: '❤️', name: 'Vitalidad',          max: 5, w: 0.9, desc: '+25 de vida máxima y te cura 25' },
    { id: 'heal',     icon: '💚', name: 'Curación',           max: 99, w: 1.4, desc: 'Recuperas el 40% de la vida', cond: () => player.hp < player.maxHp * 0.75 },
    { id: 'fire',     icon: '🔥', name: 'Flechas de fuego',   max: 2, w: 0.9, desc: 'Queman al enemigo durante 2,5 s' },
    { id: 'ice',      icon: '❄️', name: 'Flechas de hielo',   max: 1, w: 0.9, desc: 'Ralentizan a los enemigos un 45%' },
    { id: 'poison',   icon: '☠️', name: 'Veneno',             max: 2, w: 0.9, desc: 'Daño continuo que se acumula con cada flecha' },
    { id: 'bolt',     icon: '🌩️', name: 'Rayo en cadena',     max: 2, w: 0.9, desc: '25% de que un rayo salte a 2 enemigos cercanos' },
    { id: 'orbs',     icon: '🌀', name: 'Espadas giratorias', max: 3, w: 0.9, desc: 'Una espada orbita a tu alrededor y corta al contacto' },
    { id: 'blood',    icon: '🩸', name: 'Sed de sangre',      max: 3, w: 0.8, desc: 'Cada baja te cura un 2% de la vida máxima' },
    { id: 'speed',    icon: '👟', name: 'Botas ligeras',      max: 2, w: 0.8, desc: '+12% de velocidad de movimiento' },
    { id: 'dodge',    icon: '💨', name: 'Agilidad',           max: 3, w: 0.8, desc: '+8% de probabilidad de esquivar golpes' },
  ];
  const SKILL_BY_ID = Object.fromEntries(SKILLS.map(k => [k.id, k]));

  // ================================================================
  //  Lienzo y escalado
  // ================================================================
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const wrap = document.getElementById('wrap');
  const overlay = document.getElementById('overlay');
  const hudBtns = document.getElementById('hudBtns');
  const btnPause = document.getElementById('btnPause');
  const btnMute = document.getElementById('btnMute');

  function resize() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    wrap.style.width = W * s + 'px';
    wrap.style.height = H * s + 'px';
    wrap.style.setProperty('--u', s);
    canvas.style.width = W * s + 'px';
    canvas.style.height = H * s + 'px';
    canvas.width = Math.round(W * s * dpr);
    canvas.height = Math.round(H * s * dpr);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize();

  // ================================================================
  //  Estado de la partida
  // ================================================================
  let state = 'menu';   // menu | play | levelup | paused | transition | dying | over | win
  let room = 0, kills = 0, runTime = 0, clock = 0;
  let grid = new Uint8Array(COLS * ROWS);
  const flow = new Int16Array(COLS * ROWS);
  let flowT = 0;
  let player = null, boss = null;
  let enemies = [], arrows = [], bullets = [], drops = [], parts = [], texts = [], bolts = [], volleys = [];
  let cleared = true, doorAnim = 1, banner = null, shake = 0, hurtFlash = 0, fade = 0;
  let transPhase = null, transT = 0, deathT = 0, winTimer = -1;
  let pendingLevels = 0, firstPick = false, lockUntil = 0;

  const dmgMul = () => 1 + 0.07 * (room - 1);
  const xpNeed = lvl => 6 + (lvl - 1) * 5;

  // ================================================================
  //  Entrada: teclado + joystick flotante
  // ================================================================
  const keys = new Set();
  window.addEventListener('keydown', e => {
    keys.add(e.code);
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
    if (state === 'menu' && (e.code === 'Enter' || e.code === 'Space')) { Sfx.init(); hideOverlay(); newRun(); }
    if (state === 'levelup' && /^Digit[1-3]$/.test(e.code)) {
      const card = overlay.querySelectorAll('[data-act="pick"]')[+e.code.slice(5) - 1];
      if (card) card.click();
    }
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); resetJoy(); if (state === 'play') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') pause(); });

  const joy = { active: false, id: null, ox: 0, oy: 0, vx: 0, vy: 0 };
  function resetJoy() { joy.active = false; joy.id = null; joy.vx = joy.vy = 0; }
  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  canvas.addEventListener('pointerdown', e => {
    Sfx.init();
    if (state !== 'play' || joy.active) return;
    const p = toLogical(e);
    Object.assign(joy, { active: true, id: e.pointerId, ox: p.x, oy: p.y, vx: 0, vy: 0 });
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignorar */ }
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => {
    if (!joy.active || e.pointerId !== joy.id) return;
    const p = toLogical(e);
    let dx = p.x - joy.ox, dy = p.y - joy.oy;
    const d = Math.hypot(dx, dy);
    if (d > JOY_R) { // el joystick "persigue" al dedo
      joy.ox = p.x - dx / d * JOY_R; joy.oy = p.y - dy / d * JOY_R;
      dx = dx / d * JOY_R; dy = dy / d * JOY_R;
    }
    joy.vx = dx / JOY_R; joy.vy = dy / JOY_R;
  });
  const endJoy = e => { if (e.pointerId === joy.id) resetJoy(); };
  canvas.addEventListener('pointerup', endJoy);
  canvas.addEventListener('pointercancel', endJoy);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  function moveInput() {
    let mx = 0, my = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
    if (joy.active) {
      const m = Math.hypot(joy.vx, joy.vy);
      if (m > 0.2) { mx = joy.vx; my = joy.vy; }
    }
    const m = Math.hypot(mx, my);
    return m > 0 ? [mx / m, my / m] : [0, 0];
  }

  // ================================================================
  //  Rejilla, obstáculos y caminos
  // ================================================================
  function bfs(g, sc, sr, out) {
    out.fill(-1);
    const start = sr * COLS + sc;
    if (g[start]) return out;
    const q = new Int16Array(COLS * ROWS);
    let h = 0, t = 0;
    out[start] = 0; q[t++] = start;
    while (h < t) {
      const i = q[h++], c = i % COLS, r = (i / COLS) | 0;
      for (const [dc, dr] of DIR4) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
        const j = nr * COLS + nc;
        if (g[j] || out[j] >= 0) continue;
        out[j] = out[i] + 1; q[t++] = j;
      }
    }
    return out;
  }

  function genRocks(bossRoom) {
    const reach = new Int16Array(COLS * ROWS);
    for (let tries = 0; tries < 80; tries++) {
      const g = new Uint8Array(COLS * ROWS);
      const set = (c, r) => {
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
        g[r * COLS + c] = 1; g[r * COLS + (COLS - 1 - c)] = 1; // simetría espejo
      };
      if (bossRoom) { set(2, 6); set(2, 13); return g; }

      if (Math.random() < 0.3) { // muro horizontal con huecos
        const r = randi(6, 12), gap = randi(1, 5);
        for (let c = 1; c <= 5; c++) if (c !== gap) set(c, r);
      }
      const blobs = randi(2, 5);
      for (let b = 0; b < blobs; b++) {
        const w = randi(1, 2), h = randi(1, 3);
        const c = randi(0, 6 - w), r = randi(2, 16 - h);
        for (let dc = 0; dc < w; dc++) for (let dr = 0; dr < h; dr++) set(c + dc, r + dr);
      }
      // zonas despejadas: puerta y punto de aparición
      for (let r = 0; r <= 1; r++) for (let c = 4; c <= 7; c++) g[r * COLS + c] = 0;
      for (let r = 16; r < ROWS; r++) for (let c = 4; c <= 7; c++) g[r * COLS + c] = 0;

      let rocks = 0;
      for (let i = 0; i < g.length; i++) rocks += g[i];
      if (rocks > 36) continue;
      bfs(g, SPAWN_C, SPAWN_R, reach);
      if (reach[0 * COLS + 5] < 0) continue; // la puerta tiene que ser alcanzable
      for (let i = 0; i < g.length; i++) if (!g[i] && reach[i] < 0) g[i] = 1; // tapar huecos cerrados
      return g;
    }
    return new Uint8Array(COLS * ROWS);
  }

  function isRock(x, y) {
    if (x < AX || x >= AX + AW || y < AY || y >= AY + AH) return true;
    return grid[((y - AY) / CELL | 0) * COLS + ((x - AX) / CELL | 0)] === 1;
  }

  function los(x0, y0, x1, y1) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 14);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (isRock(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }

  function rayEnd(x, y, a, max) {
    const dx = Math.cos(a) * 8, dy = Math.sin(a) * 8;
    for (let d = 0; d < max; d += 8) { x += dx; y += dy; if (isRock(x, y)) break; }
    return { x, y };
  }

  const cellC = x => clamp(Math.floor((x - AX) / CELL), 0, COLS - 1);
  const cellR = y => clamp(Math.floor((y - AY) / CELL), 0, ROWS - 1);

  // Dirección para perseguir al jugador esquivando rocas (campo de flujo)
  function chaseDir(e) {
    if (los(e.x, e.y, player.x, player.y)) return angTo(e, player);
    const c = cellC(e.x), r = cellR(e.y);
    let best = flow[r * COLS + c]; if (best < 0) best = 9999;
    let bc = -1, br = -1;
    for (const [dc, dr] of DIR8) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      const j = nr * COLS + nc;
      if (grid[j] || flow[j] < 0) continue;
      if (dc && dr && (grid[r * COLS + nc] || grid[nr * COLS + c])) continue; // no cortar esquinas
      if (flow[j] < best) { best = flow[j]; bc = nc; br = nr; }
    }
    if (bc < 0) return angTo(e, player);
    return Math.atan2(AY + br * CELL + CELL / 2 - e.y, AX + bc * CELL + CELL / 2 - e.x);
  }

  function collideRocks(e) {
    let hit = false;
    const c0 = Math.floor((e.x - e.r - AX) / CELL), c1 = Math.floor((e.x + e.r - AX) / CELL);
    const r0 = Math.floor((e.y - e.r - AY) / CELL), r1 = Math.floor((e.y + e.r - AY) / CELL);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS || !grid[r * COLS + c]) continue;
        const rx = AX + c * CELL, ry = AY + r * CELL;
        const px = clamp(e.x, rx, rx + CELL), py = clamp(e.y, ry, ry + CELL);
        const dx = e.x - px, dy = e.y - py, d2 = dx * dx + dy * dy;
        if (d2 >= e.r * e.r) continue;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2), push = e.r - d;
          e.x += dx / d * push; e.y += dy / d * push;
        } else { // el centro ha quedado dentro de la roca
          const l = e.x - rx, rr = rx + CELL - e.x, t = e.y - ry, b = ry + CELL - e.y;
          const m = Math.min(l, rr, t, b);
          if (m === l) e.x = rx - e.r; else if (m === rr) e.x = rx + CELL + e.r;
          else if (m === t) e.y = ry - e.r; else e.y = ry + CELL + e.r;
        }
        hit = true;
      }
    }
    return hit;
  }

  function clampArena(e, door) {
    const ox = e.x, oy = e.y;
    let minY = AY + e.r;
    if (door && e.x > DOOR_X0 + e.r - 8 && e.x < DOOR_X1 - e.r + 8) minY = AY - 60;
    e.x = clamp(e.x, AX + e.r, AX + AW - e.r);
    e.y = clamp(e.y, minY, AY + AH - e.r);
    if (e.y < AY + e.r) e.x = clamp(e.x, DOOR_X0 + e.r, DOOR_X1 - e.r);
    return ox !== e.x || oy !== e.y;
  }

  // ================================================================
  //  Jugador
  // ================================================================
  function newPlayer() {
    return {
      x: AX + AW / 2, y: AY + AH - 50, r: 15, hp: 100, maxHp: 100, lvl: 1, xp: 0, sk: {},
      atk: 10, rate: 1.5, crit: 0.05, critMul: 2, speed: 190, dodge: 0,
      cd: 0, still: 0, inv: 0, face: -Math.PI / 2, moving: false, orbA: 0, walkT: 0,
    };
  }

  function recalc() {
    const s = player.sk;
    player.atk = 10 * (1 + 0.25 * (s.atk || 0));
    player.rate = 1.5 * (1 + 0.22 * (s.atkspd || 0));
    player.crit = 0.05 + 0.1 * (s.crit || 0);
    player.critMul = 2 + 0.25 * (s.crit || 0);
    player.speed = 190 * (1 + 0.12 * (s.speed || 0));
    player.dodge = 0.08 * (s.dodge || 0);
  }

  function heal(n, show = true) {
    const before = player.hp;
    player.hp = Math.min(player.maxHp, player.hp + n);
    const got = Math.round(player.hp - before);
    if (show && got > 0) addText(player.x, player.y - 34, '+' + got, '#5ee36a', 1);
  }

  function addXp(v) {
    player.xp += v;
    while (player.xp >= xpNeed(player.lvl)) {
      player.xp -= xpNeed(player.lvl);
      player.lvl++;
      pendingLevels++;
      Sfx.level();
    }
  }

  function hurtPlayer(dmg) {
    if (player.inv > 0 || state !== 'play') return;
    if (Math.random() < player.dodge) {
      player.inv = 0.3;
      addText(player.x, player.y - 34, 'ESQUIVA', '#9be7ff', 0.9);
      return;
    }
    dmg = Math.max(1, Math.round(dmg));
    player.hp -= dmg;
    player.inv = 0.7;
    shake = Math.max(shake, 7);
    hurtFlash = 0.25;
    addText(player.x, player.y - 34, '-' + dmg, '#ff5a5a', 1.15);
    Sfx.hurt();
    try {
      const ua = navigator.userActivation;
      if (navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(50);
    } catch (_) { /* ignorar */ }
    if (player.hp <= 0) { player.hp = 0; die(); }
  }

  function findTarget() {
    let best = null, bd = Infinity, bestL = null, bdl = Infinity;
    for (const e of enemies) {
      if (e.dead || e.spawnT > 0 || (e.alpha !== undefined && e.alpha < 0.4)) continue;
      const d = (e.x - player.x) ** 2 + (e.y - player.y) ** 2;
      if (d < bd) { bd = d; best = e; }
      if (d < bdl && los(player.x, player.y, e.x, e.y)) { bdl = d; bestL = e; }
    }
    return bestL || best;
  }

  function spawnArrow(x, y, a, dmg) {
    const s = player.sk;
    arrows.push({
      x: x + Math.cos(a) * 18, y: y + Math.sin(a) * 18,
      vx: Math.cos(a) * ARROW_SPEED, vy: Math.sin(a) * ARROW_SPEED,
      dmg, life: 1.6, hit: new Set(),
      pierce: s.pierce || 0, rico: (s.ricochet || 0) * 2, wall: (s.wall || 0) * 2,
      fire: s.fire || 0, ice: s.ice || 0, poison: s.poison || 0, bolt: s.bolt || 0,
      col: s.fire ? '#ff9a4a' : s.ice ? '#8fe9ff' : s.poison ? '#9dff6e' : '#f4efe0',
    });
  }

  function fireVolley(target) {
    const s = player.sk;
    const base = angTo(player, target);
    const dmg = player.atk * Math.pow(0.88, s.front || 0) * Math.pow(0.9, s.multi || 0);
    const nF = 1 + (s.front || 0);
    const px = Math.cos(base + Math.PI / 2), py = Math.sin(base + Math.PI / 2);
    for (let i = 0; i < nF; i++) {
      const off = (i - (nF - 1) / 2) * 13;
      spawnArrow(player.x + px * off, player.y + py * off, base, dmg);
    }
    const diagA = [0.5, 0.95];
    for (let i = 0; i < (s.diag || 0); i++) {
      spawnArrow(player.x, player.y, base + diagA[i], dmg);
      spawnArrow(player.x, player.y, base - diagA[i], dmg);
    }
    if (s.side) { spawnArrow(player.x, player.y, base + Math.PI / 2, dmg); spawnArrow(player.x, player.y, base - Math.PI / 2, dmg); }
    if (s.rear) spawnArrow(player.x, player.y, base + Math.PI, dmg);
    player.face = base;
    Sfx.shoot();
  }

  function updatePlayer(dt) {
    const p = player;
    const [mx, my] = moveInput();
    p.moving = mx !== 0 || my !== 0;
    if (p.moving) {
      p.x += mx * p.speed * dt; p.y += my * p.speed * dt;
      p.face = Math.atan2(my, mx); p.walkT += dt; p.still = 0;
    } else p.still += dt;
    collideRocks(p);
    clampArena(p, cleared && room < TOTAL_ROOMS);
    if (p.inv > 0) p.inv -= dt;
    if (p.cd > 0) p.cd -= dt;

    // Quieto = disparas; moviéndote = no
    const target = findTarget();
    if (target && !p.moving) p.face = angTo(p, target);
    if (target && !p.moving && p.still > 0.06 && p.cd <= 0) {
      fireVolley(target);
      p.cd = 1 / p.rate;
      for (let i = 1; i <= (p.sk.multi || 0); i++) volleys.push(i * 0.12);
    }
    for (let i = volleys.length - 1; i >= 0; i--) {
      volleys[i] -= dt;
      if (volleys[i] <= 0) {
        volleys.splice(i, 1);
        const t = findTarget();
        if (t) fireVolley(t);
      }
    }

    // espadas giratorias
    const n = p.sk.orbs || 0;
    if (n) {
      p.orbA += dt * 3.4;
      for (let i = 0; i < n; i++) {
        const a = p.orbA + i * TAU / n;
        const ox = p.x + Math.cos(a) * 72, oy = p.y + Math.sin(a) * 72;
        for (const e of enemies) {
          if (e.dead || e.spawnT > 0 || e.orbCd > 0) continue;
          if ((e.x - ox) ** 2 + (e.y - oy) ** 2 < (e.r + 11) ** 2) {
            e.orbCd = 0.4;
            sparks(ox, oy, '#d9d2ff', 4);
            damageEnemy(e, p.atk * 0.8, false, '#d9d2ff', true);
          }
        }
      }
    }
  }

  // ================================================================
  //  Enemigos
  // ================================================================
  function makeEnemy(kind, x, y, delay = 0) {
    const d = ENEMIES[kind], hm = 1 + 0.2 * (room - 1);
    return {
      kind, x, y, r: d.r, hp: d.hp * hm, maxHp: d.hp * hm, speed: d.speed * rand(0.92, 1.08),
      dmg: d.dmg * dmgMul(), xp: d.xp, ground: d.ground, color: d.color,
      spawnT: 0.75 + delay, spawnMax: 0.75 + delay, t: 0, seed: rand(0, TAU), flash: 0,
      state: kind === 'archer' ? 'move' : 'idle', timer: rand(0.6, 1.6), aim: 0, tx: x, ty: y,
      vx: 0, vy: 0, knock: 0, burn: 0, burnDps: 0, poisonDps: 0, dotT: 0.5, slow: 0, orbCd: 0, dead: false,
    };
  }

  function makeBoss(B) {
    return {
      kind: 'boss', tier: B.tier, name: B.name, x: AX + AW / 2, y: AY + 190, r: B.r,
      hp: B.hp, maxHp: B.hp, speed: B.speed, dmg: 14 * dmgMul(), xp: 25 + B.tier * 10, ground: true,
      color: B.color, bcolor: B.bullet, pats: B.pats, pi: 0, state: 'idle', timer: 1.4, sub: 0,
      aim: 0, spin: 0, acc: 0, alpha: 1, ringN: 12 + B.tier * 3, enraged: false,
      spawnT: 1, spawnMax: 1, t: 0, seed: 0, flash: 0, tx: 0, ty: 0, vx: 0, vy: 0, knock: 0,
      burn: 0, burnDps: 0, poisonDps: 0, dotT: 0.5, slow: 0, orbCd: 0, dead: false,
    };
  }

  function roomEnemies(n) {
    const pool = ['slime', 'bat'];
    if (n >= 2) pool.push('archer');
    if (n >= 3) pool.push('charger');
    if (n >= 4) pool.push('mage');
    let budget = 3.5 + n * 0.55;
    const list = [];
    for (let guard = 0; guard < 200 && budget > 0.9 && list.length < 11; guard++) {
      const k = pick(pool), c = ENEMIES[k].cost;
      if (c > budget + 0.3) continue;
      list.push(k); budget -= c;
    }
    return list;
  }

  function freeCellNear(x, y, range) {
    for (let i = 0; i < 12; i++) {
      const tx = x + rand(-range, range), ty = y + rand(-range, range);
      if (tx > AX + 20 && tx < AX + AW - 20 && ty > AY + 20 && ty < AY + AH - 20 && !isRock(tx, ty)) return { x: tx, y: ty };
    }
    return { x, y };
  }

  // Los enemigos a distancia deambulan, pero si no te ven salen de su escondite
  function wanderOrSeek(e, ds) {
    if (!los(e.x, e.y, player.x, player.y)) {
      const a = chaseDir(e), sp = Math.max(e.speed, 55);
      e.x += Math.cos(a) * sp * ds; e.y += Math.sin(a) * sp * ds;
      e.tx = e.x; e.ty = e.y;
      return;
    }
    const d = Math.hypot(e.tx - e.x, e.ty - e.y);
    if (d > 4) { e.x += (e.tx - e.x) / d * e.speed * ds; e.y += (e.ty - e.y) / d * e.speed * ds; }
  }

  function fireBullet(x, y, a, sp, dmg, color, r = 7) {
    bullets.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r, dmg, color });
  }

  function dots(e, dt) {
    if (e.burn <= 0 && e.poisonDps <= 0) return;
    if (e.burn > 0) { e.burn -= dt; if (e.burn <= 0) e.burnDps = 0; if (Math.random() < dt * 8) sparks(e.x + rand(-e.r, e.r) * 0.6, e.y - e.r * 0.5, '#ff9a4a', 1); }
    e.dotT -= dt;
    if (e.dotT <= 0) {
      e.dotT = 0.5;
      const d = (e.burnDps + e.poisonDps) * 0.5;
      if (d > 0) damageEnemy(e, d, false, e.burnDps > 0 ? '#ffa24a' : '#9cff6b', true);
    }
  }

  function updateEnemy(e, dt) {
    e.t += dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.spawnT > 0) { e.spawnT -= dt; return; }
    dots(e, dt);
    if (e.dead) return;
    if (e.slow > 0) e.slow -= dt;
    if (e.orbCd > 0) e.orbCd -= dt;
    const ds = dt * (e.slow > 0 ? 0.55 : 1); // el hielo ralentiza también sus ataques

    switch (e.kind) {
      case 'slime': {
        const hop = 0.3 + 0.7 * Math.max(0, Math.sin(e.t * 5 + e.seed));
        const a = chaseDir(e);
        e.x += Math.cos(a) * e.speed * hop * ds;
        e.y += Math.sin(a) * e.speed * hop * ds;
        break;
      }
      case 'bat': {
        if (e.knock > 0) { e.knock -= dt; e.x += e.vx * ds; e.y += e.vy * ds; break; }
        const a = angTo(e, player) + Math.sin(e.t * 2.6 + e.seed) * 0.9;
        e.x += Math.cos(a) * e.speed * ds;
        e.y += Math.sin(a) * e.speed * ds;
        break;
      }
      case 'archer': {
        e.timer -= ds;
        if (e.state === 'move') {
          wanderOrSeek(e, ds);
          if (e.timer <= 0) { e.state = 'aim'; e.timer = 0.6; }
        } else if (e.timer > 0) {
          if (e.timer > 0.15) e.aim = angTo(e, player);
        } else {
          const sp = 290 + room * 4;
          fireBullet(e.x, e.y, e.aim, sp, e.dmg, '#ffcf4a', 6);
          if (room >= 9) { fireBullet(e.x, e.y, e.aim - 0.22, sp, e.dmg, '#ffcf4a', 6); fireBullet(e.x, e.y, e.aim + 0.22, sp, e.dmg, '#ffcf4a', 6); }
          Sfx.eshot();
          const t = freeCellNear(e.x, e.y, 150);
          Object.assign(e, { state: 'move', timer: rand(1.1, 1.9), tx: t.x, ty: t.y });
        }
        break;
      }
      case 'charger': {
        e.timer -= ds;
        if (e.state === 'idle') {
          const a = chaseDir(e);
          e.x += Math.cos(a) * e.speed * ds; e.y += Math.sin(a) * e.speed * ds;
          if (e.timer <= 0 && dist(e, player) < 460) { e.state = 'wind'; e.timer = 0.65; e.aim = angTo(e, player); }
        } else if (e.state === 'wind') {
          if (e.timer > 0.2) e.aim = angTo(e, player);
          if (e.timer <= 0) { e.state = 'dash'; e.timer = 0.6; }
        } else if (e.state === 'dash') {
          e.x += Math.cos(e.aim) * 500 * ds; e.y += Math.sin(e.aim) * 500 * ds;
          const hit = collideRocks(e) | clampArena(e, false);
          if (hit || e.timer <= 0) {
            e.state = 'rest'; e.timer = 0.6;
            if (hit) { shake = Math.max(shake, 3); sparks(e.x, e.y, '#c9b38a', 8); }
          }
        } else if (e.timer <= 0) { e.state = 'idle'; e.timer = rand(1.2, 2.2); }
        break;
      }
      case 'mage': {
        e.timer -= ds;
        if (e.state === 'idle') {
          wanderOrSeek(e, ds);
          if (e.timer <= 0) { e.state = 'cast'; e.timer = 0.75; }
        } else if (e.timer <= 0) {
          const n = 8 + Math.floor(room / 5) * 2, off = rand(0, TAU);
          for (let i = 0; i < n; i++) fireBullet(e.x, e.y, off + i * TAU / n, 165 + room * 3, e.dmg, '#b48cff');
          Sfx.eshot();
          const t = freeCellNear(e.x, e.y, 120);
          Object.assign(e, { state: 'idle', timer: rand(2.4, 3.4), tx: t.x, ty: t.y });
        }
        break;
      }
      case 'boss':
        updateBoss(e, ds);
        break;
    }

    if (e.ground) collideRocks(e);
    clampArena(e, false);

    // daño por contacto
    if ((e.alpha === undefined || e.alpha > 0.5) && dist(e, player) < e.r + player.r - 3) {
      hurtPlayer(e.kind === 'boss' ? e.dmg * 1.4 : e.dmg);
      if (e.kind === 'bat') {
        const a = angTo(player, e);
        e.knock = 0.5; e.vx = Math.cos(a) * 160; e.vy = Math.sin(a) * 160;
      }
    }
  }

  // ---------- Jefes ----------
  function bossRing(b, off) {
    const n = b.ringN + (b.enraged ? 4 : 0);
    for (let i = 0; i < n; i++) fireBullet(b.x, b.y, off + i * TAU / n, 175 + b.tier * 12, b.dmg, b.bcolor, 8);
    Sfx.eshot();
  }

  function bossIdle(b) {
    b.state = 'idle';
    b.timer = (rand(0.9, 1.5) - b.tier * 0.1) * (b.enraged ? 0.7 : 1);
  }

  function bossNext(b) {
    const p = b.pats[b.pi++ % b.pats.length];
    b.sub = 0;
    if (p === 'ring') { b.state = 'ring'; b.timer = 0.3; }
    else if (p === 'spiral') { b.state = 'spiral'; b.timer = 2.2; b.acc = 0; }
    else if (p === 'aimed') { b.state = 'aimed'; b.timer = 0.25; }
    else if (p === 'charge') { b.state = 'wind'; b.timer = 0.75; b.aim = angTo(b, player); }
    else if (p === 'summon') { b.state = 'summon'; b.timer = 0.6; }
    else if (p === 'teleport') { b.state = 'tpOut'; b.timer = 0.4; }
  }

  function updateBoss(b, ds) {
    b.timer -= ds;
    if (!b.enraged && b.hp < b.maxHp * 0.5) {
      b.enraged = true;
      addText(b.x, b.y - b.r - 20, '¡FURIA!', '#ff5a5a', 1.3);
      shake = Math.max(shake, 6);
    }
    switch (b.state) {
      case 'idle': {
        if (dist(b, player) > 170) {
          const a = chaseDir(b);
          b.x += Math.cos(a) * b.speed * ds; b.y += Math.sin(a) * b.speed * ds;
        }
        if (b.timer <= 0) bossNext(b);
        break;
      }
      case 'ring':
        if (b.timer <= 0) {
          bossRing(b, (b.sub % 2) * Math.PI / b.ringN);
          b.sub++; b.timer = 0.42;
          if (b.sub >= 3) bossIdle(b);
        }
        break;
      case 'spiral': {
        b.acc += ds;
        const arms = b.tier >= 4 ? 4 : 3;
        while (b.acc >= 0.075) {
          b.acc -= 0.075; b.spin += 0.3;
          for (let k = 0; k < arms; k++) fireBullet(b.x, b.y, b.spin + k * TAU / arms, 185, b.dmg, b.bcolor, 7);
        }
        if (b.timer <= 0) bossIdle(b);
        break;
      }
      case 'aimed':
        if (b.timer <= 0) {
          const a = angTo(b, player);
          for (let i = -2; i <= 2; i++) fireBullet(b.x, b.y, a + i * 0.17, 300, b.dmg, b.bcolor, 8);
          Sfx.eshot();
          b.sub++; b.timer = 0.35;
          if (b.sub >= 3) bossIdle(b);
        }
        break;
      case 'wind':
        if (b.timer > 0.2) b.aim = angTo(b, player);
        if (b.timer <= 0) { b.state = 'dash'; b.timer = 0.9; }
        break;
      case 'dash': {
        b.x += Math.cos(b.aim) * 560 * ds; b.y += Math.sin(b.aim) * 560 * ds;
        const hit = collideRocks(b) | clampArena(b, false);
        if (hit || b.timer <= 0) {
          if (hit) {
            shake = Math.max(shake, 9); sparks(b.x, b.y, '#c9b38a', 14);
            if (b.tier >= 2) bossRing(b, rand(0, TAU));
          }
          b.sub++;
          if (b.sub < 2) { b.state = 'wind'; b.timer = 0.55; } else bossIdle(b);
        }
        break;
      }
      case 'summon':
        if (b.timer <= 0) {
          const alive = enemies.filter(o => !o.dead && o.minion).length;
          const n = Math.min(3, 6 - alive), kind = b.tier >= 3 ? 'bat' : 'slime';
          for (let i = 0; i < n; i++) {
            const a = rand(0, TAU);
            const m = makeEnemy(kind, b.x + Math.cos(a) * (b.r + 26), b.y + Math.sin(a) * (b.r + 26), -0.3);
            m.minion = true; m.xp = 1;
            clampArena(m, false);
            enemies.push(m);
          }
          bossIdle(b);
        }
        break;
      case 'tpOut':
        b.alpha = clamp(b.timer / 0.4, 0, 1);
        if (b.timer <= 0) {
          for (let i = 0; i < 20; i++) {
            const t = { x: rand(AX + 60, AX + AW - 60), y: rand(AY + 80, AY + AH * 0.6) };
            if (dist(t, player) > 230 && !isRock(t.x, t.y)) { b.x = t.x; b.y = t.y; break; }
          }
          b.state = 'tpIn'; b.timer = 0.35;
        }
        break;
      case 'tpIn':
        b.alpha = 1 - clamp(b.timer / 0.35, 0, 1);
        if (b.timer <= 0) { b.alpha = 1; bossRing(b, rand(0, TAU)); bossIdle(b); }
        break;
    }
  }

  function separate() {
    for (let i = 0; i < enemies.length; i++) {
      const a = enemies[i];
      if (a.dead || a.spawnT > 0) continue;
      for (let j = i + 1; j < enemies.length; j++) {
        const b = enemies[j];
        if (b.dead || b.spawnT > 0 || a.ground !== b.ground) continue;
        const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 < 0.01) continue;
        const d = Math.sqrt(d2), push = (rr - d) / 2, ux = dx / d, uy = dy / d;
        const wa = a.kind === 'boss' ? 0 : b.kind === 'boss' ? 2 : 1;
        const wb = b.kind === 'boss' ? 0 : a.kind === 'boss' ? 2 : 1;
        a.x -= ux * push * wa; a.y -= uy * push * wa;
        b.x += ux * push * wb; b.y += uy * push * wb;
      }
    }
  }

  // ---------- Daño a enemigos ----------
  function damageEnemy(e, dmg, crit, color, small) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 0.08;
    addText(e.x + rand(-6, 6), e.y - e.r - 6, Math.max(1, Math.round(dmg)), color || (crit ? '#ffd23f' : '#ffffff'), crit ? 1.35 : small ? 0.75 : 1);
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    kills++;
    const isBoss = e.kind === 'boss';
    burst(e.x, e.y, e.color, isBoss ? 70 : 14, isBoss ? 320 : 170);
    if (isBoss) { Sfx.boom(); shake = 16; } else Sfx.kill();
    let xp = e.xp;
    while (xp > 0) {
      const v = xp >= 5 ? 5 : 1;
      xp -= v;
      drops.push({ type: 'gem', v, x: e.x, y: e.y, vx: rand(-150, 150), vy: rand(-150, 150), t: 0 });
    }
    const hearts = isBoss ? 2 : Math.random() < 0.06 ? 1 : 0;
    for (let i = 0; i < hearts; i++) drops.push({ type: 'heart', x: e.x, y: e.y, vx: rand(-120, 120), vy: rand(-120, 120), t: 0 });
    if (player.sk.blood) heal(player.maxHp * 0.02 * player.sk.blood);
    if (isBoss) {
      boss = null;
      for (const o of enemies) if (!o.dead && o !== e) killEnemy(o);
    }
  }

  function chainLightning(src, dmg) {
    const near = enemies
      .filter(o => o !== src && !o.dead && o.spawnT <= 0)
      .map(o => ({ o, d: dist(o, src) }))
      .filter(x => x.d < 200)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    for (const { o } of near) {
      bolts.push({ x1: src.x, y1: src.y, x2: o.x, y2: o.y, life: 0.18 });
      damageEnemy(o, dmg, false, '#9fe8ff', true);
    }
  }

  // ================================================================
  //  Flechas, balas y botín
  // ================================================================
  function arrowHit(ar, e) {
    ar.hit.add(e);
    const crit = Math.random() < player.crit;
    const dmg = ar.dmg * (crit ? player.critMul : 1);
    Sfx.hit();
    damageEnemy(e, dmg, crit);
    if (!e.dead) {
      if (ar.fire) { e.burn = 2.5; e.burnDps = Math.max(e.burnDps, player.atk * 0.35 * ar.fire); }
      if (ar.ice) e.slow = 1.6;
      if (ar.poison) e.poisonDps = Math.min(e.poisonDps + player.atk * 0.1 * ar.poison, player.atk * 0.8 * ar.poison);
    }
    if (ar.bolt && Math.random() < 0.25 * ar.bolt) chainLightning(e, ar.dmg * 0.5);

    if (ar.rico > 0) {
      let best = null, bd = 280 * 280;
      for (const o of enemies) {
        if (o === e || o.dead || o.spawnT > 0 || ar.hit.has(o)) continue;
        const d2 = (o.x - ar.x) ** 2 + (o.y - ar.y) ** 2;
        if (d2 < bd) { bd = d2; best = o; }
      }
      if (best) {
        ar.rico--;
        const a = angTo(ar, best);
        ar.vx = Math.cos(a) * ARROW_SPEED; ar.vy = Math.sin(a) * ARROW_SPEED;
        ar.life = Math.max(ar.life, 0.8);
        return;
      }
    }
    if (ar.pierce > 0) { ar.pierce--; return; }
    ar.dead = true;
  }

  function updateArrows(dt) {
    for (const ar of arrows) {
      ar.life -= dt;
      if (ar.life <= 0) { ar.dead = true; continue; }
      for (let s = 0; s < 2 && !ar.dead; s++) {
        const px = ar.x, py = ar.y;
        ar.x += ar.vx * dt / 2; ar.y += ar.vy * dt / 2;
        // primero enemigos: un murciélago puede estar volando sobre una roca
        for (const e of enemies) {
          if (e.dead || e.spawnT > 0 || ar.hit.has(e) || (e.alpha !== undefined && e.alpha < 0.4)) continue;
          const rr = e.r + 5;
          if ((e.x - ar.x) ** 2 + (e.y - ar.y) ** 2 < rr * rr) { arrowHit(ar, e); break; }
        }
        if (ar.dead) break;
        if (isRock(ar.x, ar.y)) {
          if (ar.wall > 0) {
            ar.wall--;
            const hx = isRock(ar.x, py), hy = isRock(px, ar.y);
            if (hx && !hy) ar.vx = -ar.vx;
            else if (hy && !hx) ar.vy = -ar.vy;
            else { ar.vx = -ar.vx; ar.vy = -ar.vy; }
            ar.x = px; ar.y = py; ar.hit.clear();
          } else {
            ar.dead = true;
            sparks(px, py, '#d8d0ea', 3);
          }
        }
      }
    }
    arrows = arrows.filter(a => !a.dead);
  }

  function updateBullets(dt) {
    for (const b of bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (isRock(b.x, b.y)) { b.dead = true; sparks(b.x, b.y, b.color, 3); continue; }
      const rr = b.r + player.r - 4;
      if ((b.x - player.x) ** 2 + (b.y - player.y) ** 2 < rr * rr) { hurtPlayer(b.dmg); b.dead = true; }
    }
    bullets = bullets.filter(b => !b.dead);
  }

  function collectDrop(g) {
    if (g.type === 'gem') { addXp(g.v); Sfx.gem(); }
    else heal(player.maxHp * 0.15);
  }

  function updateDrops(dt) {
    const fr = Math.pow(0.02, dt);
    for (const g of drops) {
      g.t += dt;
      const d = dist(g, player);
      if (cleared || d < 70 || g.magnet) {
        g.magnet = true;
        const a = angTo(g, player), sp = 380 + g.t * 300;
        g.vx = Math.cos(a) * sp; g.vy = Math.sin(a) * sp;
      } else { g.vx *= fr; g.vy *= fr; }
      g.x += g.vx * dt; g.y += g.vy * dt;
      if (!g.magnet) { g.x = clamp(g.x, AX + 8, AX + AW - 8); g.y = clamp(g.y, AY + 8, AY + AH - 8); }
      if (d < player.r + 10) { g.dead = true; collectDrop(g); }
    }
    drops = drops.filter(g => !g.dead);
  }

  // ================================================================
  //  Efectos
  // ================================================================
  function addText(x, y, text, color, size = 1) {
    texts.push({ x, y, text: String(text), color, size, life: 0.75, max: 0.75 });
    if (texts.length > 80) texts.shift();
  }
  function sparks(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(40, 160);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.15, 0.35), max: 0.35, color, size: rand(1.5, 3) });
    }
  }
  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(speed * 0.3, speed);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), max: 0.7, color, size: rand(2.5, 5.5) });
    }
    if (parts.length > 500) parts.splice(0, parts.length - 500);
  }

  function updateFx(dt) {
    const fr = Math.pow(0.05, dt);
    for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= fr; p.vy *= fr; p.life -= dt; }
    parts = parts.filter(p => p.life > 0);
    for (const t of texts) { t.y -= 42 * dt; t.life -= dt; }
    texts = texts.filter(t => t.life > 0);
    for (const b of bolts) b.life -= dt;
    bolts = bolts.filter(b => b.life > 0);
    if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
    shake = Math.max(0, shake - dt * 40);
    if (hurtFlash > 0) hurtFlash -= dt;
  }

  // ================================================================
  //  Salas
  // ================================================================
  function spawnRoom() {
    enemies = [];
    const B = BOSSES[room];
    if (B) {
      boss = makeBoss(B);
      enemies.push(boss);
      banner = { text: '¡JEFE!', sub: B.name, color: '#ff5a5a', t: 2.2, max: 2.2 };
      Sfx.boss();
      return;
    }
    boss = null;
    const reach = bfs(grid, SPAWN_C, SPAWN_R, new Int16Array(COLS * ROWS));
    const cells = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      if (grid[i] || reach[i] < 0) continue;
      const c = i % COLS, r = (i / COLS) | 0;
      const x = AX + c * CELL + CELL / 2, y = AY + r * CELL + CELL / 2;
      if (r < 15 && Math.hypot(x - player.x, y - player.y) > 300) cells.push({ x, y });
    }
    shuffle(cells);
    roomEnemies(room).forEach((k, i) => {
      const p = cells[i % Math.max(1, cells.length)] || { x: AX + AW / 2, y: AY + 150 };
      enemies.push(makeEnemy(k, p.x + rand(-5, 5), p.y + rand(-5, 5), i * 0.05));
    });
    banner = { text: 'SALA ' + room, sub: room === TOTAL_ROOMS - 1 ? 'Se oye algo enorme al otro lado…' : '', color: '#ffffff', t: 1.4, max: 1.4 };
  }

  function nextRoom() {
    for (const g of drops) collectDrop(g); // nada se pierde al cambiar de sala
    room++;
    grid = genRocks(!!BOSSES[room]);
    arrows = []; bullets = []; drops = []; bolts = []; volleys = []; parts = []; texts = [];
    Object.assign(player, { x: AX + AW / 2, y: AY + AH - 50, face: -Math.PI / 2, cd: 0.35, still: 0 });
    cleared = false; doorAnim = 0; flowT = 0;
    spawnRoom();
  }

  function onCleared() {
    cleared = true;
    for (const b of bullets) sparks(b.x, b.y, b.color, 2);
    bullets = [];
    if (BOSSES[room]) heal(player.maxHp * 0.25);
    if (room >= TOTAL_ROOMS) { winTimer = 2.2; pendingLevels = 0; }
    else Sfx.door();
  }

  function newRun() {
    player = newPlayer();
    recalc();
    room = 0; kills = 0; runTime = 0; winTimer = -1;
    shake = 0; hurtFlash = 0; fade = 0; banner = null;
    nextRoom();
    hud(true);
    resetJoy();
    state = 'play';
    pendingLevels = 1; firstPick = true; // habilidad inicial gratis
  }

  function die() {
    state = 'dying';
    deathT = 1.1;
    burst(player.x, player.y, '#4fa3ff', 40, 260);
    shake = 14;
    resetJoy();
    Sfx.die();
  }

  // ================================================================
  //  Bucle
  // ================================================================
  function update(dt) {
    runTime += dt;
    updatePlayer(dt);
    flowT -= dt;
    if (flowT <= 0) { flowT = 0.2; bfs(grid, cellC(player.x), cellR(player.y), flow); }
    for (const e of enemies) if (!e.dead) updateEnemy(e, dt);
    separate();
    updateArrows(dt);
    updateBullets(dt);
    updateDrops(dt);
    updateFx(dt);
    enemies = enemies.filter(e => !e.dead);

    if (!cleared && enemies.length === 0) onCleared();
    if (cleared) doorAnim = Math.min(1, doorAnim + dt * 2);
    if (state === 'play' && cleared && room < TOTAL_ROOMS && player.y < AY - 24) {
      state = 'transition'; transPhase = 'out'; transT = 0; resetJoy();
    }
    if (winTimer > 0 && state === 'play') {
      winTimer -= dt;
      if (winTimer <= 0) { showEnd(true); return; }
    }
    if (pendingLevels > 0 && state === 'play' && winTimer < 0) openLevelUp();
  }

  function updateTransition(dt) {
    transT += dt;
    if (transPhase === 'out') {
      fade = Math.min(1, transT / 0.28);
      if (transT >= 0.28) { nextRoom(); transPhase = 'in'; transT = 0; }
    } else {
      fade = 1 - Math.min(1, transT / 0.28);
      if (transT >= 0.28) { fade = 0; state = 'play'; }
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    clock += dt;
    if (state === 'play') update(dt);
    else if (state === 'transition') updateTransition(dt);
    else if (state === 'dying') {
      deathT -= dt;
      updateFx(dt);
      if (deathT <= 0) showEnd(false);
    }
    render();
    requestAnimationFrame(frame);
  }

  // ================================================================
  //  Dibujo
  // ================================================================
  function rrect(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function circle(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
  function ellipse(x, y, rx, ry, fill) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
  function eyes(x, y, a, spread, size, white = '#fff', pupil = '#141018') {
    const px = -Math.sin(a), py = Math.cos(a);
    for (const s of [-1, 1]) {
      const ex = x + px * spread * s, ey = y + py * spread * s;
      circle(ex, ey, size, white);
      if (pupil) circle(ex + Math.cos(a) * size * 0.4, ey + Math.sin(a) * size * 0.4, size * 0.55, pupil);
    }
  }
  function txt(s, x, y, size, color, align = 'center', stroke = true) {
    ctx.font = `800 ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (stroke) { ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = 'rgba(10,6,20,.85)'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  }
  function shadow(e, lift = 0) {
    ellipse(e.x, e.y + e.r * 0.8 + lift, e.r * 0.95, e.r * 0.36, 'rgba(0,0,0,.32)');
  }

  function drawRoom() {
    // marco y muros
    ctx.fillStyle = '#1b1529';
    ctx.fillRect(AX - 24, AY - 34, AW + 48, AH + 58);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.fillStyle = (r + c) & 1 ? '#3a3154' : '#352d4d';
        ctx.fillRect(AX + c * CELL, AY + r * CELL, CELL, CELL);
      }
    }
    ctx.fillStyle = '#4b3e6e';
    ctx.fillRect(AX - 24, AY - 34, AW + 48, 34);
    ctx.fillStyle = '#5c4d86';
    ctx.fillRect(AX - 24, AY - 34, AW + 48, 6);
    ctx.strokeStyle = 'rgba(0,0,0,.28)';
    ctx.lineWidth = 1;
    for (let row = 0; row < 2; row++) {
      const y = AY - 28 + row * 14;
      ctx.beginPath(); ctx.moveTo(AX - 24, y); ctx.lineTo(AX + AW + 24, y); ctx.stroke();
      for (let x = AX - 24 + (row ? 15 : 0); x < AX + AW + 24; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 14); ctx.stroke();
      }
    }
    ctx.fillStyle = '#2d2445';
    ctx.fillRect(AX - 24, AY, 24, AH);
    ctx.fillRect(AX + AW, AY, 24, AH);
    ctx.fillRect(AX - 24, AY + AH, AW + 48, 24);
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.fillRect(AX - 4, AY, 4, AH);
    ctx.fillRect(AX + AW, AY, 4, AH);
    const g = ctx.createLinearGradient(0, AY, 0, AY + 26);
    g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(AX, AY, AW, 26);
    drawDoor();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r * COLS + c]) drawRock(AX + c * CELL, AY + r * CELL);
  }

  function drawDoor() {
    const x = DOOR_X0, w = DOOR_X1 - DOOR_X0, y = AY - 34, h = 34;
    ctx.fillStyle = '#0c0914';
    ctx.fillRect(x, y, w, h);
    if (doorAnim > 0) {
      const gl = ctx.createLinearGradient(0, y, 0, y + h);
      gl.addColorStop(0, `rgba(255,210,120,${0.6 * doorAnim})`);
      gl.addColorStop(1, 'rgba(255,210,120,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(x, y, w, h);
    }
    const lift = doorAnim * h;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = '#8b8fa8'; ctx.lineWidth = 4;
    for (let bx = x + 10; bx < x + w; bx += 16) {
      ctx.beginPath(); ctx.moveTo(bx, y - lift); ctx.lineTo(bx, y + h - lift); ctx.stroke();
    }
    ctx.fillStyle = '#8b8fa8';
    ctx.fillRect(x, y + h - lift - 6, w, 4);
    ctx.restore();
    ctx.strokeStyle = '#9c86d6'; ctx.lineWidth = 3;
    ctx.strokeRect(x - 1.5, y + 1.5, w + 3, h);
    if (cleared && doorAnim >= 1 && room < TOTAL_ROOMS && player) {
      const bob = Math.sin(clock * 6) * 4;
      for (let i = 0; i < 2; i++) txt('▲', x + w / 2, AY + 26 + i * 16 + bob, 20 - i * 4, `rgba(255,210,122,${0.9 - i * 0.35})`, 'center', false);
    }
  }

  function drawRock(x, y) {
    ctx.fillStyle = 'rgba(0,0,0,.3)'; rrect(x + 4, y + 8, CELL - 4, CELL - 4, 7); ctx.fill();
    ctx.fillStyle = '#54476f'; rrect(x + 2, y + 4, CELL - 4, CELL - 4, 7); ctx.fill();
    ctx.fillStyle = '#7b6d9d'; rrect(x + 2, y + 1, CELL - 4, CELL - 11, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.13)'; rrect(x + 7, y + 4, CELL - 18, 4, 2); ctx.fill();
  }

  function drawTelegraphs() {
    for (const e of enemies) {
      if (e.spawnT > 0) continue;
      if (e.kind === 'archer' && e.state === 'aim') {
        const end = rayEnd(e.x, e.y, e.aim, 700);
        ctx.strokeStyle = `rgba(255,70,70,${0.3 + 0.3 * Math.sin(clock * 30)})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(end.x, end.y); ctx.stroke();
      }
      if ((e.kind === 'charger' || e.kind === 'boss') && e.state === 'wind') {
        const end = rayEnd(e.x, e.y, e.aim, 900);
        ctx.strokeStyle = 'rgba(255,60,60,.16)'; ctx.lineWidth = e.r * 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(end.x, end.y); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,80,80,.55)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(end.x, end.y); ctx.stroke();
        ctx.lineCap = 'butt';
      }
    }
  }

  function drawDrops() {
    for (const g of drops) {
      const bob = g.magnet ? 0 : Math.sin(clock * 5 + g.x) * 2;
      if (g.type === 'gem') {
        const s = g.v >= 5 ? 8 : 5, col = g.v >= 5 ? '#5ab8ff' : '#5df2a0';
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(g.x, g.y - s + bob); ctx.lineTo(g.x + s * 0.75, g.y + bob);
        ctx.lineTo(g.x, g.y + s + bob); ctx.lineTo(g.x - s * 0.75, g.y + bob);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        ctx.fillRect(g.x - 1.5, g.y - s * 0.5 + bob, 2, s * 0.5);
      } else {
        const x = g.x, y = g.y + bob;
        ctx.fillStyle = '#ff4d6d';
        ctx.beginPath();
        ctx.arc(x - 4, y - 2, 5, 0, TAU); ctx.arc(x + 4, y - 2, 5, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.lineTo(x, y + 10); ctx.closePath(); ctx.fill();
      }
    }
  }

  function drawPlayer() {
    const p = player;
    const blink = p.inv > 0 && Math.floor(p.inv * 16) % 2 === 0;
    ctx.globalAlpha = blink ? 0.4 : 1;
    shadow(p);
    const bob = p.moving ? Math.abs(Math.sin(p.walkT * 12)) * 3 : 0;
    const x = p.x, y = p.y - bob, a = p.face;
    // carcaj a la espalda
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = '#7a4a22'; rrect(-p.r - 5, -5, 10, 10, 3); ctx.fill();
    ctx.restore();
    circle(x, y, p.r + 2.5, '#13294d');
    circle(x, y, p.r, '#3d8cf0');
    circle(x - 4, y - 5, p.r * 0.45, 'rgba(255,255,255,.22)');
    eyes(x + Math.cos(a) * 6, y + Math.sin(a) * 6, a, 5, 3.6);
    // arco
    const br = p.r + 7;
    ctx.strokeStyle = '#a5692c'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, br, a - 0.85, a + 0.85); ctx.stroke();
    ctx.strokeStyle = 'rgba(240,235,220,.85)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a - 0.85) * br, y + Math.sin(a - 0.85) * br);
    ctx.lineTo(x + Math.cos(a + 0.85) * br, y + Math.sin(a + 0.85) * br);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.globalAlpha = 1;
    // vida
    const bw = 46, bx = p.x - bw / 2, by = p.y - p.r - 20, k = clamp(p.hp / p.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; rrect(bx - 1.5, by - 1.5, bw + 3, 9, 4.5); ctx.fill();
    ctx.fillStyle = k < 0.3 ? '#ff5050' : '#5ee36a'; rrect(bx, by, bw * k, 6, 3); ctx.fill();
    txt(String(Math.ceil(p.hp)), p.x, by - 9, 13, '#fff');
  }

  function drawEnemy(e) {
    const spawning = e.spawnT > 0;
    let alpha = 1;
    if (spawning) {
      const k = 1 - e.spawnT / e.spawnMax;
      ctx.strokeStyle = 'rgba(255,90,90,.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(1, e.r * (2 - k)), 0, TAU); ctx.stroke();
      alpha = clamp(k, 0, 1) * 0.85;
    }
    if (e.alpha !== undefined) alpha *= e.alpha;
    ctx.globalAlpha = alpha;
    const fly = e.kind === 'bat' ? 10 : 0;
    shadow(e, fly * 0.3);
    const ang = angTo(e, player);

    switch (e.kind) {
      case 'slime': drawSlime(e.x, e.y, e.r, e.color, e.t * 5 + e.seed, ang); break;
      case 'bat': {
        const y = e.y - fly, flap = Math.sin(e.t * 22) * 0.5 + 0.5;
        ctx.fillStyle = '#4b2380';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(e.x + s * e.r * 0.4, y - 2);
          ctx.lineTo(e.x + s * (e.r + 14 + flap * 6), y - 8 - flap * 9);
          ctx.lineTo(e.x + s * (e.r + 8), y + 6);
          ctx.closePath(); ctx.fill();
        }
        circle(e.x, y, e.r, e.color);
        eyes(e.x + Math.cos(ang) * 4, y + Math.sin(ang) * 4, ang, 4, 2.6, '#ff5a6a', null);
        break;
      }
      case 'archer': {
        const a = e.state === 'aim' ? e.aim : ang;
        circle(e.x, e.y, e.r + 2, '#26401a');
        circle(e.x, e.y, e.r, e.color);
        circle(e.x, e.y, e.r * 0.62, '#8cc455');
        eyes(e.x + Math.cos(a) * 5, e.y + Math.sin(a) * 5, a, 4.5, 3, '#ffe066', '#3b2a00');
        ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 5, a - 0.8, a + 0.8); ctx.stroke();
        break;
      }
      case 'charger': {
        const a = e.state === 'dash' || e.state === 'wind' ? e.aim : ang;
        const jx = e.state === 'wind' ? rand(-2, 2) : 0;
        ctx.save(); ctx.translate(e.x + jx, e.y); ctx.rotate(a);
        ellipse(0, 0, e.r * 1.15, e.r * 0.9, '#5e3a17');
        ellipse(-2, 0, e.r * 1.02, e.r * 0.78, e.color);
        ellipse(-6, 0, e.r * 0.6, e.r * 0.45, '#b37a42');
        ctx.fillStyle = '#f3ead7';
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(e.r * 0.8, s * 6); ctx.lineTo(e.r * 1.35, s * 10); ctx.lineTo(e.r * 0.85, s * 10); ctx.closePath(); ctx.fill();
        }
        circle(e.r * 0.45, -6, 2.6, '#ff3b3b'); circle(e.r * 0.45, 6, 2.6, '#ff3b3b');
        ctx.restore();
        break;
      }
      case 'mage': {
        circle(e.x, e.y, e.r + 2, '#1c2470');
        circle(e.x, e.y, e.r, e.color);
        eyes(e.x + Math.cos(ang) * 4, e.y + Math.sin(ang) * 4 + 2, ang, 4.5, 2.8, '#7ff9ff', null);
        ctx.fillStyle = '#272c86';
        ctx.beginPath();
        ctx.moveTo(e.x - e.r * 0.95, e.y - e.r * 0.25);
        ctx.lineTo(e.x + e.r * 0.95, e.y - e.r * 0.25);
        ctx.lineTo(e.x + 5, e.y - e.r * 1.9);
        ctx.closePath(); ctx.fill();
        if (e.state === 'cast') {
          const k = 1 - e.timer / 0.75;
          ctx.strokeStyle = `rgba(190,150,255,${0.4 + 0.5 * k})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4 + 18 * k, 0, TAU); ctx.stroke();
        }
        break;
      }
      case 'boss': drawBoss(e, ang); break;
    }

    if (e.flash > 0) { ctx.globalAlpha = 0.7 * alpha; circle(e.x, e.y - fly, e.r, '#fff'); }
    ctx.globalAlpha = 1;
    if (spawning) return;
    if (e.slow > 0) { ctx.strokeStyle = 'rgba(143,233,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y - fly, e.r + 3, 0, TAU); ctx.stroke(); }
    if (e.poisonDps > 0) circle(e.x + e.r * 0.7, e.y - e.r * 0.7 - fly, 4, '#9dff6e');
    if (e.kind !== 'boss') {
      const bw = Math.max(28, e.r * 2), by = e.y - e.r - 12 - fly, k = clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(e.x - bw / 2 - 1, by - 1, bw + 2, 6);
      ctx.fillStyle = '#ff4d4d'; ctx.fillRect(e.x - bw / 2, by, bw * k, 4);
    }
  }

  function drawSlime(x, y, r, color, phase, ang) {
    const s = Math.sin(phase), lift = Math.max(0, s) * 6;
    const sx = 1 - 0.12 * s, sy = 1 + 0.12 * s;
    ellipse(x, y - lift, r * sx + 2, r * sy * 0.92 + 2, 'rgba(20,50,20,.9)');
    ellipse(x, y - lift, r * sx, r * sy * 0.92, color);
    ellipse(x - r * 0.35, y - lift - r * 0.35, r * 0.3, r * 0.2, 'rgba(255,255,255,.35)');
    eyes(x + Math.cos(ang) * r * 0.3, y - lift + Math.sin(ang) * r * 0.3, ang, r * 0.3, r * 0.2);
  }

  function drawBoss(b, ang) {
    const { x, y, r } = b;
    const a = b.state === 'wind' || b.state === 'dash' ? b.aim : ang;
    if (b.enraged) {
      ctx.strokeStyle = `rgba(255,60,60,${0.35 + 0.25 * Math.sin(clock * 10)})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, r + 8, 0, TAU); ctx.stroke();
    }
    if (b.tier === 1) { // gólem
      const jx = b.state === 'wind' ? rand(-2, 2) : 0;
      ctx.fillStyle = '#4e463b'; rrect(x - r - 2 + jx, y - r - 2, r * 2 + 4, r * 2 + 4, 16); ctx.fill();
      ctx.fillStyle = b.color; rrect(x - r + jx, y - r, r * 2, r * 2, 14); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.8); ctx.lineTo(x - r * 0.2, y - r * 0.2); ctx.lineTo(x - r * 0.5, y + r * 0.4); ctx.stroke();
      for (const s of [-1, 1]) circle(x + s * (r + 10) + jx, y + 8, 13, '#7c705f');
      eyes(x + Math.cos(a) * 10 + jx, y + Math.sin(a) * 10, a, 12, 6, '#ffb347', '#7a2a00');
    } else if (b.tier === 2) { // rey slime
      drawSlime(x, y, r, b.color, b.t * 3, a);
      ctx.fillStyle = '#ffcf3a';
      const cy = y - r * 0.95;
      ctx.beginPath();
      ctx.moveTo(x - 18, cy + 8); ctx.lineTo(x - 18, cy - 8); ctx.lineTo(x - 9, cy);
      ctx.lineTo(x, cy - 12); ctx.lineTo(x + 9, cy); ctx.lineTo(x + 18, cy - 8); ctx.lineTo(x + 18, cy + 8);
      ctx.closePath(); ctx.fill();
    } else if (b.tier === 3) { // brujo
      for (let i = 0; i < 3; i++) {
        const oa = clock * 2 + i * TAU / 3;
        circle(x + Math.cos(oa) * (r + 16), y + Math.sin(oa) * (r + 16), 6, '#c58bff');
      }
      circle(x, y, r + 3, '#2a1a63');
      circle(x, y, r, b.color);
      eyes(x + Math.cos(a) * 7, y + Math.sin(a) * 7 + 4, a, 9, 5, '#7ff9ff', null);
      ctx.fillStyle = '#2c1d6e';
      ctx.beginPath();
      ctx.moveTo(x - r * 1.1, y - r * 0.2); ctx.lineTo(x + r * 1.1, y - r * 0.2); ctx.lineTo(x + 10, y - r * 2.1);
      ctx.closePath(); ctx.fill();
    } else { // señor de la mazmorra
      const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 1.7);
      g.addColorStop(0, 'rgba(255,80,40,.35)'); g.addColorStop(1, 'rgba(255,80,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.7, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1d1016';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + s * r * 0.45, y - r * 0.7); ctx.lineTo(x + s * r * 1.05, y - r * 1.55); ctx.lineTo(x + s * r * 0.85, y - r * 0.45);
        ctx.closePath(); ctx.fill();
      }
      circle(x, y, r + 3, '#4a0d0d');
      circle(x, y, r, b.color);
      circle(x - r * 0.3, y - r * 0.35, r * 0.3, 'rgba(255,255,255,.15)');
      eyes(x + Math.cos(a) * 10, y + Math.sin(a) * 10, a, 13, 7, '#ffe14a', '#5a0000');
    }
  }

  function drawArrows() {
    for (const a of arrows) {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(Math.atan2(a.vy, a.vx));
      ctx.strokeStyle = a.col; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(2, 0); ctx.stroke();
      ctx.fillStyle = a.col;
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-1, -4.5); ctx.lineTo(-1, 4.5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-21, -4); ctx.moveTo(-16, 0); ctx.lineTo(-21, 4); ctx.stroke();
      ctx.restore();
    }
  }

  function drawBullets() {
    for (const b of bullets) {
      ctx.globalAlpha = 0.3; circle(b.x, b.y, b.r + 5, b.color);
      ctx.globalAlpha = 1; circle(b.x, b.y, b.r, b.color);
      circle(b.x, b.y, b.r * 0.45, '#fff');
    }
  }

  function drawOrbs() {
    const n = player.sk.orbs || 0;
    for (let i = 0; i < n; i++) {
      const a = player.orbA + i * TAU / n;
      const x = player.x + Math.cos(a) * 72, y = player.y + Math.sin(a) * 72;
      ctx.globalAlpha = 0.3; circle(x, y, 15, '#b9a8ff');
      ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = '#eeeaff';
      ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(4, 4); ctx.lineTo(0, 9); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function drawBolts() {
    for (const b of bolts) {
      const pts = [[b.x1, b.y1]];
      for (let i = 1; i < 6; i++) {
        const t = i / 6;
        pts.push([b.x1 + (b.x2 - b.x1) * t + rand(-9, 9), b.y1 + (b.y2 - b.y1) * t + rand(-9, 9)]);
      }
      pts.push([b.x2, b.y2]);
      for (const [w, c] of [[6, 'rgba(120,220,255,.35)'], [2, '#ffffff']]) {
        ctx.strokeStyle = c; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts) ctx.lineTo(p[0], p[1]);
        ctx.stroke();
      }
    }
  }

  function drawParts() {
    for (const p of parts) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      circle(p.x, p.y, p.size, p.color);
    }
    ctx.globalAlpha = 1;
  }

  function drawTexts() {
    for (const t of texts) {
      ctx.globalAlpha = clamp(t.life / t.max * 1.6, 0, 1);
      txt(t.text, t.x, t.y, Math.round(18 * t.size), t.color);
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    ctx.fillStyle = '#120e1c';
    ctx.fillRect(0, 0, W, 94);
    // nivel
    circle(48, 50, 30, '#a84a00');
    circle(48, 48, 30, '#ffb547');
    txt('NV', 48, 34, 12, '#5a2a00', 'center', false);
    txt(String(player.lvl), 48, 56, 26, '#2a1300', 'center', false);
    // experiencia
    const bx = 92, bw = 310, k = clamp(player.xp / xpNeed(player.lvl), 0, 1);
    ctx.fillStyle = '#2a2340'; rrect(bx, 30, bw, 18, 9); ctx.fill();
    if (k > 0) { ctx.fillStyle = '#ffd25a'; rrect(bx, 30, Math.max(18, bw * k), 18, 9); ctx.fill(); }
    txt(`SALA ${room} / ${TOTAL_ROOMS}`, bx, 72, 20, '#ffffff', 'left', false);
    txt(`☠ ${kills}`, bx + bw, 72, 18, '#cfc6e8', 'right', false);
    // barra del jefe
    if (boss && !boss.dead) {
      const x = AX + 30, w = AW - 60, y = AY - 28, kb = clamp(boss.hp / boss.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,.75)'; rrect(x - 2, y - 2, w + 4, 24, 8); ctx.fill();
      ctx.fillStyle = boss.enraged ? '#ff3b3b' : '#e0453a'; rrect(x, y, w * kb, 20, 7); ctx.fill();
      txt(boss.name.toUpperCase(), AX + AW / 2, y + 10, 13, '#fff');
    }
    if (room === 1 && !cleared) txt('Quieto = disparas  ·  Moviéndote = esquivas', W / 2, H - 20, 15, 'rgba(255,255,255,.7)');
  }

  function drawVignette() {
    let k = hurtFlash > 0 ? hurtFlash * 2.4 : 0;
    if (player.hp > 0 && player.hp < player.maxHp * 0.25) k = Math.max(k, 0.28 + 0.14 * Math.sin(clock * 5));
    if (k <= 0) return;
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
    g.addColorStop(0, 'rgba(255,0,0,0)');
    g.addColorStop(1, `rgba(255,30,30,${Math.min(0.7, k)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawBanner() {
    if (!banner) return;
    const a = clamp(Math.min(banner.t, banner.max - banner.t) / 0.25, 0, 1);
    ctx.globalAlpha = a;
    txt(banner.text, W / 2, 430, 58, banner.color);
    if (banner.sub) txt(banner.sub, W / 2, 482, 22, '#ffd27a');
    ctx.globalAlpha = 1;
  }

  function drawJoystick() {
    if (!joy.active) return;
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(joy.ox, joy.oy, JOY_R, 0, TAU); ctx.fill(); ctx.stroke();
    circle(joy.ox + joy.vx * JOY_R, joy.oy + joy.vy * JOY_R, 28, 'rgba(255,255,255,.35)');
  }

  function render() {
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.fillStyle = '#120e1c';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake) * 0.6, rand(-shake, shake) * 0.6);
    drawRoom();
    if (player) {
      drawTelegraphs();
      drawDrops();
      const list = enemies.slice();
      if (player.hp > 0) list.push(player);
      list.sort((a, b) => a.y - b.y);
      for (const o of list) (o === player ? drawPlayer() : drawEnemy(o));
      if (player.hp > 0) drawOrbs();
      drawArrows();
      drawBullets();
      drawBolts();
      drawParts();
      drawTexts();
    }
    ctx.restore();
    if (player) {
      drawHUD();
      drawVignette();
      drawBanner();
      drawJoystick();
    }
    if (fade > 0) { ctx.fillStyle = `rgba(10,7,18,${fade})`; ctx.fillRect(0, 0, W, H); }
  }

  // ================================================================
  //  Pantallas (DOM)
  // ================================================================
  function showOverlay(html) { overlay.innerHTML = html; overlay.classList.remove('hidden'); }
  function hideOverlay() { overlay.classList.add('hidden'); overlay.innerHTML = ''; }
  function hud(show) { hudBtns.classList.toggle('hidden', !show); }

  function skillChips() {
    const owned = SKILLS.filter(k => player.sk[k.id] && k.id !== 'heal');
    if (!owned.length) return '<div class="empty">Sin habilidades todavía</div>';
    return `<div class="chips">${owned.map(k =>
      `<span class="chip" title="${k.name}">${k.icon}${player.sk[k.id] > 1 ? `<i>${player.sk[k.id]}</i>` : ''}</span>`).join('')}</div>`;
  }

  function showMenu() {
    state = 'menu';
    player = null; boss = null; room = 0;
    enemies = []; arrows = []; bullets = []; drops = []; parts = []; texts = []; bolts = [];
    cleared = true; doorAnim = 1; fade = 0; shake = 0;
    grid = genRocks(false);
    hud(false);
    const b = store.get('best', null);
    showOverlay(`
      <div class="panel">
        <div class="logo">ARQUERO</div>
        <div class="tag">Roguelite de mazmorras · ${TOTAL_ROOMS} salas · 4 jefes</div>
        <button class="btn primary menu-play" data-act="play">JUGAR</button>
        ${b ? `<div class="best">Récord: ${b.win ? '🏆 Mazmorra completada' : 'Sala ' + b.room} · Nivel ${b.lvl}</div>` : ''}
        <div class="howto">
          <div><b>Muévete</b> para esquivar</div>
          <div><b>Quédate quieto</b> para disparar solo</div>
          <div>Cada nivel: elige <b>1 de 3</b> habilidades</div>
          <div class="dim">Móvil: arrastra el dedo · PC: WASD o flechas · P = pausa</div>
        </div>
      </div>`);
  }

  function rollSkills(n) {
    const pool = SKILLS.filter(k => (player.sk[k.id] || 0) < k.max && (!k.cond || k.cond()));
    const out = [];
    while (out.length < n && pool.length) {
      const tot = pool.reduce((s, k) => s + k.w, 0);
      let r = Math.random() * tot, idx = 0;
      for (; idx < pool.length - 1; idx++) { r -= pool[idx].w; if (r <= 0) break; }
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  }

  function openLevelUp() {
    const opts = rollSkills(3);
    if (!opts.length) { pendingLevels = 0; return; }
    state = 'levelup';
    resetJoy();
    lockUntil = performance.now() + 380; // evita elegir sin querer con el dedo aún en pantalla
    const title = firstPick ? 'HABILIDAD INICIAL' : `¡NIVEL ${player.lvl - pendingLevels + 1}!`;
    const cards = opts.map((k, i) => {
      const lv = player.sk[k.id] || 0;
      const pips = k.max > 1 && k.max < 50 ? `<div class="pips">${'★'.repeat(lv + 1)}${'☆'.repeat(k.max - lv - 1)}</div>` : '';
      return `<button class="card" data-act="pick" data-id="${k.id}" style="animation-delay:${i * 70}ms">
          <div class="ic">${k.icon}</div>
          <div class="tx"><div class="nm">${k.name}</div><div class="ds">${k.desc}</div>${pips}</div>
          <kbd>${i + 1}</kbd>
        </button>`;
    }).join('');
    showOverlay(`
      <div class="panel">
        <div class="title gold">${title}</div>
        <div class="sub">Elige una habilidad</div>
        <div class="cards">${cards}</div>
      </div>`);
  }

  function pickSkill(id) {
    const s = player.sk;
    if (id === 'heal') heal(player.maxHp * 0.4);
    else {
      s[id] = (s[id] || 0) + 1;
      if (id === 'hp') { player.maxHp += 25; player.hp += 25; }
    }
    recalc();
    Sfx.pick();
    pendingLevels = Math.max(0, pendingLevels - 1);
    firstPick = false;
    hideOverlay();
    state = 'play';
  }

  function pause() {
    if (state !== 'play') return;
    state = 'paused';
    resetJoy();
    showOverlay(`
      <div class="panel">
        <div class="title">PAUSA</div>
        <div class="sub">Sala ${room} · Nivel ${player.lvl} · ${Math.ceil(player.hp)}/${player.maxHp} vida</div>
        ${skillChips()}
        <button class="btn primary" data-act="resume" style="margin-top:calc(var(--u)*34px)">CONTINUAR</button>
        <button class="btn ghost" data-act="menu">ABANDONAR</button>
      </div>`);
  }
  function resume() { if (state !== 'paused') return; hideOverlay(); state = 'play'; last = performance.now(); }
  function togglePause() { if (state === 'play') pause(); else if (state === 'paused') resume(); }

  function showEnd(win) {
    state = win ? 'win' : 'over';
    hud(false);
    resetJoy();
    if (win) Sfx.win();
    const prev = store.get('best', null);
    const cur = { room, lvl: player.lvl, win };
    const better = !prev || (win && !prev.win) || (!prev.win && (room > prev.room || (room === prev.room && player.lvl > prev.lvl)));
    if (better) store.set('best', cur);
    showOverlay(`
      <div class="panel">
        <div class="title ${win ? 'gold' : 'red'}">${win ? '¡VICTORIA!' : 'HAS CAÍDO'}</div>
        <div class="sub">${win ? 'Has limpiado la mazmorra entera' : `En la sala ${room} de ${TOTAL_ROOMS}`}</div>
        <div class="stats">
          <div><span>Sala</span><b>${room}/${TOTAL_ROOMS}</b></div>
          <div><span>Nivel</span><b>${player.lvl}</b></div>
          <div><span>Bajas</span><b>${kills}</b></div>
          <div><span>Tiempo</span><b>${fmtTime(runTime)}</b></div>
        </div>
        ${better ? '<div class="newbest">¡Nuevo récord!</div>' : ''}
        ${skillChips()}
        <button class="btn primary" data-act="play" style="margin-top:calc(var(--u)*28px)">${win ? 'OTRA VEZ' : 'REINTENTAR'}</button>
        <button class="btn ghost" data-act="menu">MENÚ</button>
      </div>`);
  }

  overlay.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    Sfx.init();
    const act = el.dataset.act;
    if (act === 'play') { hideOverlay(); newRun(); }
    else if (act === 'pick') { if (performance.now() >= lockUntil) pickSkill(el.dataset.id); }
    else if (act === 'resume') resume();
    else if (act === 'menu') showMenu();
  });
  btnPause.addEventListener('click', () => { Sfx.init(); togglePause(); });
  const syncMute = () => { btnMute.textContent = Sfx.muted ? '🔇' : '🔊'; };
  btnMute.addEventListener('click', () => { Sfx.init(); Sfx.setMuted(!Sfx.muted); syncMute(); });
  syncMute();

  // Acceso para depurar desde la consola (las herramientas que modifican la partida solo con ?debug)
  window.__arquero = {
    get state() { return state; }, get room() { return room; }, get player() { return player; },
    get enemies() { return enemies; }, get bullets() { return bullets; }, get grid() { return grid; },
    get kills() { return kills; },
  };
  if (/[?&]debug\b/.test(location.search)) {
    Object.assign(window.__arquero, {
      // avanza la simulación sin depender de requestAnimationFrame (pestañas ocultas, pruebas)
      step(sec, hold = []) {
        hold.forEach(k => keys.add(k));
        for (let t = 0; t < sec; t += 1 / 60) {
          if (state === 'play') update(1 / 60);
          else if (state === 'transition') updateTransition(1 / 60);
          else if (state === 'dying') { deathT -= 1 / 60; updateFx(1 / 60); if (deathT <= 0) showEnd(false); }
          else break;
        }
        hold.forEach(k => keys.delete(k));
        render();
        return state;
      },
      pick(i = 0) { const c = overlay.querySelectorAll('[data-act="pick"]')[i]; if (c) { lockUntil = 0; c.click(); } return state; },
      give(id, n = 1) { for (let i = 0; i < n; i++) pickSkill(id); },
      goto(n) { room = n - 1; nextRoom(); state = 'play'; hideOverlay(); },
      toDoor() { player.x = AX + AW / 2; player.y = AY - 30; },
      god(v = true) { player.inv = v ? 1e9 : 0; },
    });
  }

  showMenu();
  requestAnimationFrame(frame);
})();
