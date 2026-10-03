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
  const SHOT_SPEED = 760;
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
    get(k, d) { try { const v = localStorage.getItem('arcano.' + k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem('arcano.' + k, JSON.stringify(v)); } catch (_) { /* sin almacenamiento */ } },
    del(k) { try { localStorage.removeItem('arcano.' + k); } catch (_) { /* sin almacenamiento */ } },
  };

  const VERSION = '1.0';

  // Ajustes del jugador (pantalla de Ajustes)
  const SETTINGS_DEFAULT = {
    music: 0.6, sfx: 0.8, vibration: true, shake: true, dmgNumbers: true,
    lefty: false, quality: 'alta', fps: false, tutorial: false, ultTip: false,
  };
  const settings = Object.assign({}, SETTINGS_DEFAULT, store.get('settings', {}));
  const saveSettings = () => store.set('settings', settings);
  const lowQ = () => settings.quality === 'baja';

  // ================================================================
  //  Sonido (sintetizado, sin archivos): efectos y música van por buses separados
  // ================================================================
  const Sfx = {
    ctx: null, master: null, sfxBus: null, musicBus: null, nbuf: null, last: {}, muted: store.get('muted', false),
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 1;
        this.master.connect(this.ctx.destination);
        this.sfxBus = this.ctx.createGain();
        this.musicBus = this.ctx.createGain();
        this.sfxBus.connect(this.master);
        this.musicBus.connect(this.master);
        this.applyVolumes();
        if (window.ArcanoMusic) window.ArcanoMusic.attach(this.ctx, this.musicBus);
      } catch (_) { this.ctx = null; }
    },
    applyVolumes() {
      if (!this.ctx) return;
      this.sfxBus.gain.value = 0.5 * settings.sfx;
      this.musicBus.gain.value = settings.music;
    },
    setMuted(m) { this.muted = m; store.set('muted', m); if (this.master) this.master.gain.value = m ? 0 : 1; },
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
      o.connect(g); g.connect(this.sfxBus);
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
      s.connect(f); f.connect(g); g.connect(this.sfxBus);
      s.start(t); s.stop(t + dur);
    },
    shoot() { if (this.gate('shoot', 60)) this.tone(520, 0.09, 'sine', 0.05, 1.8); },
    react() { if (this.gate('react', 80)) { this.tone(660, 0.18, 'triangle', 0.08, 1.6); this.noise(0.15, 0.06, 3000); } },
    freeze() { this.tone(1400, 0.35, 'sine', 0.07, 0.5); this.noise(0.3, 0.06, 6000); },
    zap() { if (this.gate('zap', 50)) { this.noise(0.14, 0.14, 5000); this.tone(220, 0.12, 'sawtooth', 0.05, 0.5); } },
    whistle() { this.tone(1500, 0.7, 'sine', 0.05, 0.25); },
    plague() { this.noise(0.6, 0.1, 400); this.tone(140, 0.6, 'sawtooth', 0.06, 0.6); },
    blast() { if (this.gate('blast', 60)) { this.noise(0.35, 0.16, 700); this.tone(120, 0.3, 'sine', 0.14, 0.4); } },
    fuse() { if (this.gate('fuse', 120)) this.tone(900, 0.06, 'square', 0.03); },
    buy() { [660, 880, 1320].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.08, 1, i * 0.06)); },
    ultReady() { this.tone(880, 0.12, 'sine', 0.07); this.tone(1320, 0.2, 'sine', 0.07, 1, 0.1); },
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
    click() { if (this.gate('click', 60)) this.tone(660, 0.05, 'triangle', 0.05, 1.2); },
    ach() { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.16, 'sine', 0.08, 1, i * 0.08)); },
    shield() { this.tone(1200, 0.2, 'sine', 0.08, 0.6); },
  };

  // música (music.js); si no ha cargado o el audio no está listo, no hace nada
  function music(track) {
    try { if (window.ArcanoMusic && Sfx.ctx) window.ArcanoMusic.play(track); } catch (_) { /* sin música */ }
  }
  function vibrate(ms) {
    if (!settings.vibration) return;
    try {
      const ua = navigator.userActivation;
      if (navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(ms);
    } catch (_) { /* ignorar */ }
  }

  // ================================================================
  //  Datos: enemigos, jefes, habilidades
  // ================================================================
  const ENEMIES = {
    slime:   { hp: 20, r: 17, speed: 78,  dmg: 10, xp: 3, cost: 1,   color: '#6fd25a', ground: true },
    bat:     { hp: 12, r: 13, speed: 112, dmg: 8,  xp: 2, cost: 1,   color: '#8a4fd8', ground: false },
    archer:  { hp: 18, r: 16, speed: 62,  dmg: 12, xp: 3, cost: 1.5, color: '#5d8f2f', ground: true },
    charger: { hp: 34, r: 19, speed: 50,  dmg: 16, xp: 4, cost: 2,   color: '#9a6431', ground: true },
    mage:    { hp: 28, r: 17, speed: 34,  dmg: 11, xp: 4, cost: 2,   color: '#9a2a52', ground: true }, // cultista
    bigslime: { hp: 55, r: 19, speed: 52, dmg: 16, xp: 5, cost: 2.5, color: '#3fbf6a', ground: true }, // se divide al morir
    bomber:  { hp: 22, r: 15, speed: 100, dmg: 24, xp: 3, cost: 1.5, color: '#ff6a2a', ground: true }, // diablillo bomba
    totem:   { hp: 45, r: 18, speed: 0,   dmg: 12, xp: 4, cost: 2,   color: '#8b7bb8', ground: true }, // torreta rúnica
    spirit:  { hp: 24, r: 15, speed: 30,  dmg: 12, xp: 4, cost: 2,   color: '#9fd8ff', ground: false }, // espectro que se teletransporta
  };
  // colores de enemigos por bioma, para que no se confundan con el suelo (los verdes en la pradera)
  const BIOME_TINT = {
    pradera: { slime: '#59b4ff', bigslime: '#3f86e8', archer: '#b8642e' },
    cristal: { spirit: '#e3c8ff' },
  };
  // sala a partir de la que aparece cada enemigo
  const ENEMY_UNLOCK = { slime: 1, bat: 1, archer: 2, charger: 3, mage: 4, bigslime: 6, bomber: 6, totem: 7, spirit: 11 };

  // Elementos, escuelas de magia y reacciones
  const EL = {
    arcane: { name: 'Arcano', color: '#c77dff' },
    fire:   { name: 'Fuego',  color: '#ff8a3d' },
    ice:    { name: 'Hielo',  color: '#7fe3ff' },
    bolt:   { name: 'Rayo',   color: '#ffe45c' },
    poison: { name: 'Veneno', color: '#8dff6a' },
  };
  const ELEMENTS = ['fire', 'ice', 'bolt', 'poison'];
  const SCHOOLS = {
    fire:   { name: 'Piromante',    el: 'fire',   icon: '🔥', ultIcon: '☄️', ult: 'Meteoro',  desc: 'Tus hechizos queman', ultDesc: 'Un meteorito arrasa la zona con más enemigos' },
    ice:    { name: 'Criomante',    el: 'ice',    icon: '❄️', ultIcon: '🌨️', ult: 'Ventisca', desc: 'Tus hechizos ralentizan', ultDesc: 'Congela a todos los enemigos y borra sus disparos' },
    bolt:   { name: 'Electromante', el: 'bolt',   icon: '⚡', ultIcon: '🌩️', ult: 'Tormenta', desc: 'Tus hechizos electrocutan y saltan', ultDesc: 'Diez rayos caen sobre los enemigos' },
    poison: { name: 'Pestilente',   el: 'poison', icon: '☠️', ultIcon: '☣️', ult: 'Plaga', cost: 150, desc: 'Tus hechizos envenenan', ultDesc: 'Envenena a todos: los que mueran revientan y contagian' },
    arcane: { name: 'Arcanista',    el: null, grant: { front: 1, atkspd: 1 }, icon: '🔮', ultIcon: '🌌', ult: 'Singularidad', cost: 250, desc: 'Sin elemento, pero +1 proyectil y más cadencia', ultDesc: 'Un agujero negro atrae a los enemigos y estalla' },
  };
  const REACTIONS = [
    { id: 'vapor',   a: 'fire', b: 'ice',    name: 'VAPOR',       color: '#e8f7ff', desc: 'Golpe de daño triple' },
    { id: 'overload', a: 'fire', b: 'bolt',  name: 'SOBRECARGA',  color: '#ffb347', desc: 'Explosión en área' },
    { id: 'freeze',  a: 'ice',  b: 'bolt',   name: 'CONGELACIÓN', color: '#9fefff', desc: 'Congela al enemigo' },
    { id: 'combust', a: 'fire', b: 'poison', name: 'COMBUSTIÓN',  color: '#c6ff5a', desc: 'Nube tóxica que contagia' },
    { id: 'corrode', a: 'bolt', b: 'poison', name: 'CORROSIÓN',   color: '#d4ff4a', desc: 'Recibe +40% de daño 4 s' },
  ];

  // Mejoras permanentes del Santuario (se compran con esencia entre partidas)
  const META_UPS = [
    { id: 'vida',   icon: '❤️', name: 'Vitalidad eterna', desc: '+10 de vida máxima',                max: 5, cost: [30, 60, 100, 150, 220] },
    { id: 'poder',  icon: '💥', name: 'Poder ancestral',  desc: '+6% de daño',                       max: 5, cost: [40, 80, 130, 190, 260] },
    { id: 'mana',   icon: '💠', name: 'Reserva de maná',  desc: '+15 de maná al empezar',            max: 4, cost: [30, 60, 100, 150] },
    { id: 'sabio',  icon: '📜', name: 'Sabiduría',        desc: '+10% de experiencia',               max: 3, cost: [50, 110, 180] },
    { id: 'suerte', icon: '🍀', name: 'Suerte',           desc: '+1 cambio de cartas por partida',   max: 3, cost: [40, 90, 160] },
    { id: 'paso',   icon: '👟', name: 'Paso ligero',      desc: '+4% de velocidad',                  max: 3, cost: [35, 75, 130] },
    { id: 'fenix',  icon: '🕊️', name: 'Pluma de fénix',   desc: 'Revives una vez por partida con 50% de vida', max: 1, cost: [300] },
  ];
  const ALTAR_ROOMS = new Set([4, 9, 14, 19]); // salas de descanso justo antes de cada jefe

  // Logros: dan esencia al desbloquearse
  const ACHIEVEMENTS = [
    { id: 'firstUlt',    icon: '✨', name: 'Primer conjuro',      desc: 'Lanza tu primer hechizo definitivo',     reward: 10 },
    { id: 'boss1',       icon: '🗿', name: 'Rompepiedras',        desc: 'Derrota al Gólem de Piedra',             reward: 20 },
    { id: 'room10',      icon: '🚪', name: 'Explorador',          desc: 'Llega a la sala 10',                     reward: 20 },
    { id: 'boss2',       icon: '👑', name: 'Regicida viscoso',    desc: 'Derrota al Rey Slime',                   reward: 30 },
    { id: 'boss3',       icon: '🌙', name: 'Duelo de magos',      desc: 'Derrota al Brujo Sombrío',               reward: 40 },
    { id: 'boss4',       icon: '😈', name: 'Señor de nada',       desc: 'Derrota al Señor de la Mazmorra',        reward: 60 },
    { id: 'firstWin',    icon: '🏆', name: 'Archimago',           desc: 'Completa la mazmorra',                   reward: 100 },
    { id: 'reactAll',    icon: '⚗️', name: 'Alquimista',          desc: 'Provoca las 5 reacciones elementales',   reward: 40 },
    { id: 'react50',     icon: '💥', name: 'Reacción en cadena',  desc: '50 reacciones en una sola partida',      reward: 40 },
    { id: 'untouchable', icon: '🛡️', name: 'Intocable',           desc: 'Derrota a un jefe sin recibir daño',     reward: 50 },
    { id: 'lvl15',       icon: '📈', name: 'Erudito',             desc: 'Alcanza el nivel 15 en una partida',     reward: 30 },
    { id: 'phoenix',     icon: '🕊️', name: 'Renacido',            desc: 'Vuelve a la vida con la pluma de fénix', reward: 20 },
    { id: 'elites',      icon: '⭐', name: 'Cazaélites',          desc: 'Derrota a 25 enemigos élite en total',   reward: 40 },
    { id: 'kills1000',   icon: '💀', name: 'Exterminador',        desc: 'Derrota a 1000 enemigos en total',       reward: 60 },
    { id: 'allSchools',  icon: '📚', name: 'Biblioteca completa', desc: 'Desbloquea todas las escuelas',          reward: 50 },
    { id: 'speedrun',    icon: '⏱️', name: 'Contrarreloj',        desc: 'Gana en menos de 6 minutos',             reward: 80 },
    { id: 'winAll',      icon: '🌈', name: 'Maestro de escuelas', desc: 'Gana con las 5 escuelas',                reward: 150 },
  ];

  const BOSSES = {
    5:  { tier: 1, name: 'Gólem de Piedra',      hp: 480,  r: 40, speed: 55, color: '#8f8270', bullet: '#ffb347', pats: ['ring', 'charge', 'aimed'] },
    10: { tier: 2, name: 'Rey Slime',            hp: 1150, r: 42, speed: 65, color: '#57c75e', bullet: '#b6ff6b', pats: ['summon', 'ring', 'charge', 'aimed'] },
    15: { tier: 3, name: 'Brujo Sombrío',        hp: 2100, r: 34, speed: 45, color: '#6d4bd8', bullet: '#c58bff', pats: ['spiral', 'teleport', 'aimed', 'summon', 'ring'] },
    20: { tier: 4, name: 'Señor de la Mazmorra', hp: 3600, r: 44, speed: 70, color: '#d63c3c', bullet: '#ff6a3d', pats: ['spiral', 'charge', 'ring', 'summon', 'teleport', 'aimed'] },
  };

  const SKILLS = [
    { id: 'front',    icon: '🔮', name: 'Proyectil extra',  max: 3, w: 1.1, desc: '+1 proyectil hacia delante (−12% daño cada uno)' },
    { id: 'multi',    icon: '🔁', name: 'Eco arcano',       max: 3, w: 1.1, desc: 'El hechizo se repite justo después (−10% daño)' },
    { id: 'diag',     icon: '↗️', name: 'Abanico',          max: 2, w: 1,   desc: '+2 proyectiles en diagonal' },
    { id: 'side',     icon: '↔️', name: 'Orbes laterales',  max: 1, w: 0.8, desc: '+2 proyectiles a los lados' },
    { id: 'rear',     icon: '↩️', name: 'Guardia trasera',  max: 1, w: 0.8, desc: '+1 proyectil hacia atrás' },
    { id: 'ricochet', icon: '🔀', name: 'Salto arcano',     max: 2, w: 1,   desc: 'Los proyectiles saltan a 2 enemigos más' },
    { id: 'pierce',   icon: '💫', name: 'Lanza de éter',    max: 2, w: 1,   desc: 'Los proyectiles atraviesan 1 enemigo más' },
    { id: 'wall',     icon: '↪️', name: 'Rebote',           max: 2, w: 0.9, desc: 'Los proyectiles rebotan 2 veces en muros y rocas' },
    { id: 'atk',      icon: '💥', name: 'Poder +25%',       max: 6, w: 1,   desc: 'Más daño en todos tus hechizos' },
    { id: 'atkspd',   icon: '⏱️', name: 'Celeridad',        max: 5, w: 1,   desc: '+22% de velocidad de lanzamiento' },
    { id: 'crit',     icon: '🎯', name: 'Concentración',    max: 4, w: 0.9, desc: '+10% prob. de crítico y +25% daño crítico' },
    { id: 'hp',       icon: '❤️', name: 'Vitalidad',        max: 5, w: 0.9, desc: '+25 de vida máxima y te cura 25' },
    { id: 'heal',     icon: '⚗️', name: 'Poción',           max: 99, w: 1.4, desc: 'Recuperas el 40% de la vida', cond: () => player.hp < player.maxHp * 0.75 },
    { id: 'fire',     icon: '🔥', name: 'Runa de fuego',    max: 2, w: 1.1, el: true, desc: 'Tus hechizos queman durante 2,5 s' },
    { id: 'ice',      icon: '❄️', name: 'Runa de hielo',    max: 2, w: 1.1, el: true, desc: 'Tus hechizos ralentizan a los enemigos' },
    { id: 'bolt',     icon: '⚡', name: 'Runa de rayo',     max: 2, w: 1.1, el: true, desc: 'Electrocutan y pueden saltar a 2 enemigos' },
    { id: 'poison',   icon: '☠️', name: 'Runa de veneno',   max: 2, w: 1,   el: true, desc: 'Daño continuo que se acumula con cada impacto' },
    { id: 'orbs',     icon: '🌀', name: 'Orbes guardianes', max: 3, w: 0.9, desc: 'Un orbe gira a tu alrededor y daña al contacto' },
    { id: 'blood',    icon: '🦇', name: 'Drenar vida',      max: 3, w: 0.8, desc: 'Cada baja te cura un 2% de la vida máxima' },
    { id: 'channel',  icon: '💠', name: 'Canalización',     max: 2, w: 0.9, desc: 'Tu hechizo definitivo se carga un 35% más rápido' },
    { id: 'speed',    icon: '👟', name: 'Botas ligeras',    max: 2, w: 0.8, desc: '+12% de velocidad de movimiento' },
    { id: 'dodge',    icon: '💨', name: 'Parpadeo',         max: 3, w: 0.8, desc: '+8% de probabilidad de esquivar golpes' },
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
  const btnUlt = document.getElementById('btnUlt');

  // fondo de sala pintado por biomes.js (se cachea por sala y escala)
  let roomBg = null, roomBgDirty = true, runSeed = 1, menuBiome = null;
  function resize() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    const dpr = settings.quality === 'baja' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    wrap.style.width = W * s + 'px';
    wrap.style.height = H * s + 'px';
    wrap.style.setProperty('--u', s);
    canvas.style.width = W * s + 'px';
    canvas.style.height = H * s + 'px';
    canvas.width = Math.round(W * s * dpr);
    canvas.height = Math.round(H * s * dpr);
    roomBgDirty = true; // el fondo se vuelve a pintar a la nueva escala
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
  let enemies = [], shots = [], bullets = [], drops = [], parts = [], texts = [], bolts = [], volleys = [];
  let cleared = true, doorAnim = 1, banner = null, shake = 0, hurtFlash = 0, fade = 0;
  let transPhase = null, transT = 0, deathT = 0, winTimer = -1;
  let pendingLevels = 0, lockUntil = 0;
  let rings = [], meteors = [], storm = null, sing = null, screenFlash = null, toast = null;
  let altar = null, bossesKilled = 0, runEssence = 0;
  let roomHit = false, runUlts = 0, runReacts = 0;   // para logros
  let tut = null;                                     // tutorial de la primera partida
  let fps = 60, fpsAcc = 0, fpsN = 0;
  let slowT = 0; // cámara lenta (al matar a un jefe)
  const seenReactions = new Set();

  const dmgMul = () => 1 + 0.07 * (room - 1);
  const xpNeed = lvl => 6 + (lvl - 1) * 5;

  // progreso permanente: esencia, mejoras compradas y escuelas desbloqueadas
  const META_DEFAULT = () => ({
    essence: 0, up: {}, schools: ['fire', 'ice', 'bolt'], runs: 0, ach: {},
    stats: { kills: 0, wins: 0, bosses: 0, elites: 0, reactions: 0, ults: 0, time: 0, essenceTotal: 0, best: {}, winsBy: {}, reactSeen: {} },
  });
  const meta = loadMeta();
  function loadMeta() {
    let saved = store.get('meta', null);
    if (!saved) { // sin progreso en este almacenamiento: probamos la copia de la cookie
      try {
        const m = document.cookie.match(/(?:^|; )arcano_meta=([^;]*)/);
        if (m) saved = JSON.parse(decodeURIComponent(m[1]));
      } catch (_) { saved = null; }
    }
    const d = META_DEFAULT(), s = saved || {};
    const m = Object.assign(d, s);
    m.up = Object.assign({}, s.up);
    m.ach = Object.assign({}, s.ach);
    m.schools = Array.isArray(s.schools) ? [...new Set(['fire', 'ice', 'bolt', ...s.schools])].filter(id => SCHOOLS[id]) : d.schools;
    m.stats = Object.assign(META_DEFAULT().stats, s.stats);
    for (const k of ['best', 'winsBy', 'reactSeen']) m.stats[k] = Object.assign({}, s.stats && s.stats[k]);
    if (!(m.essence >= 0)) m.essence = 0;
    return m;
  }
  function saveMeta() {
    store.set('meta', meta);
    try { document.cookie = 'arcano_meta=' + encodeURIComponent(JSON.stringify(meta)) + ';max-age=31536000;path=/;SameSite=Lax'; } catch (_) { /* sin cookies */ }
  }
  const metaLv = id => meta.up[id] || 0;
  const schoolOpen = id => meta.schools.includes(id);

  // ---------- Logros: aviso flotante que funciona en cualquier pantalla ----------
  const achEl = document.createElement('div');
  achEl.id = 'achToast';
  wrap.appendChild(achEl);
  const achQueue = [];
  let achBusy = false;
  function unlock(id) {
    if (meta.ach[id]) return;
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (!a) return;
    meta.ach[id] = true;
    meta.essence += a.reward;
    meta.stats.essenceTotal += a.reward;
    saveMeta();
    achQueue.push(a);
    nextAch();
  }
  function nextAch() {
    if (achBusy || !achQueue.length) return;
    const a = achQueue.shift();
    achBusy = true;
    achEl.innerHTML = `<span class="ic">${a.icon}</span><span class="tx"><b>¡Logro desbloqueado!</b>${a.name}</span><span class="rw">+✨ ${a.reward}</span>`;
    achEl.classList.add('show');
    Sfx.ach();
    setTimeout(() => { achEl.classList.remove('show'); setTimeout(() => { achBusy = false; nextAch(); }, 350); }, 2600);
  }

  // un espectro o jefe congelado a medio desvanecerse vuelve a ser visible y tocable
  function unfade(e) {
    if (e.alpha === undefined || e.kind === 'boss') return;
    e.alpha = 1;
    if (e.kind === 'spirit') { e.state = 'idle'; e.timer = rand(1, 1.6); }
  }

  // ---------- Tutorial de la primera partida ----------
  const TOUCH = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
  const TUT_TEXT = {
    move: () => TOUCH ? 'Arrastra el dedo por la pantalla para moverte' : 'Muévete con WASD o con las flechas',
    shoot: () => 'Ahora quédate quieto: lanzas hechizos tú solo',
    clear: () => '¡Eso es! Muévete para esquivar y para para atacar',
    door: () => 'Sala limpia: cruza la puerta de arriba',
  };
  function tutStart() { tut = settings.tutorial ? null : { step: 'move', t: 0 }; }
  function tutDone() { tut = null; settings.tutorial = true; saveSettings(); }
  function tutNext() { if (!settings.ultTip) { settings.ultTip = true; saveSettings(); } }

  // ================================================================
  //  Entrada: teclado + joystick flotante
  // ================================================================
  const keys = new Set();
  window.addEventListener('keydown', e => {
    keys.add(e.code);
    if (state === 'splash') { showTapToStart(); return; }
    if (state === 'tap') { startFromTap(); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (state === 'play' || state === 'paused') togglePause();
      else if (['settings', 'credits', 'stats', 'shop'].includes(state)) goBack();
      else if (state === 'school') showMenu();
    }
    const onButton = document.activeElement && document.activeElement.tagName === 'BUTTON';
    if (state === 'menu' && (e.code === 'Enter' || e.code === 'Space') && !onButton) { Sfx.init(); hideOverlay(); newRun(); }
    else if (state === 'play' && (e.code === 'Space' || e.code === 'KeyE') && !e.repeat) castUlt();
    if ((state === 'levelup' || state === 'school' || state === 'altar') && /^Digit[1-5]$/.test(e.code)) {
      const card = overlay.querySelectorAll('[data-act="pick"],[data-act="school"]:not(.locked),[data-act="altar"]')[+e.code.slice(5) - 1];
      if (card) card.click();
    }
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); resetJoy(); if (state === 'play') pause(); });
  window.addEventListener('storage', e => {
    if (e.key !== 'arcano.meta' || !e.newValue) return;
    const f = loadMeta();
    for (const k of Object.keys(meta)) delete meta[k];
    Object.assign(meta, f);
    if (state === 'menu') showMenu(); else if (state === 'shop') showShop(); else if (state === 'stats') showStats();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state === 'play') pause();
      if (player) saveMeta(); // por si cierran la app a mitad de partida
      try { if (Sfx.ctx) Sfx.ctx.suspend(); } catch (_) { /* ignorar */ }
    } else {
      try { if (Sfx.ctx) Sfx.ctx.resume(); } catch (_) { /* ignorar */ }
    }
  });

  const joy = { active: false, id: null, ox: 0, oy: 0, vx: 0, vy: 0 };
  function resetJoy() { joy.active = false; joy.id = null; joy.vx = joy.vy = 0; }
  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  canvas.addEventListener('pointerdown', e => {
    Sfx.init();
    if (!backArmed && state === 'play') armBack();
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
    const hp = 100 + 10 * metaLv('vida'); // mejoras del Santuario
    return {
      x: AX + AW / 2, y: AY + AH - 50, r: 15, hp, maxHp: hp, lvl: 1, xp: 0, sk: {},
      atk: 10, rate: 1.5, crit: 0.05, critMul: 2, speed: 190, dodge: 0,
      cd: 0, still: 0, inv: 0, face: -Math.PI / 2, moving: false, orbA: 0, walkT: 0,
      school: 'fire', mana: 30 + 15 * metaLv('mana'), castFx: 0,
      revives: metaLv('fenix'), rerolls: metaLv('suerte'), shield: 0,
    };
  }

  // ---------- Maná y hechizo definitivo ----------
  function gainMana(v) {
    if (!player || player.mana >= 100) return;
    player.mana = Math.min(100, player.mana + v * (1 + 0.35 * (player.sk.channel || 0)));
    if (player.mana >= 100) { Sfx.ultReady(); addText(player.x, player.y - 50, '¡DEFINITIVO LISTO!', EL[player.school].color, 0.8); }
  }

  function liveEnemies() { return enemies.filter(e => !e.dead && e.spawnT <= 0); }

  // el enemigo con más vecinos cerca (el jefe pesa más): blanco de meteoro y singularidad
  function densest(live) {
    let best = live[0], bc = -1;
    for (const e of live) {
      const c = live.filter(o => dist(o, e) < 130).length + (e.kind === 'boss' ? 3 : 0);
      if (c > bc) { bc = c; best = e; }
    }
    return best;
  }

  function castUlt() {
    if (state !== 'play' || !player || player.mana < 100) return;
    const live = liveEnemies();
    if (!live.length) return;
    player.mana = 0;
    player.castFx = 0.5;
    shake = Math.max(shake, 6);
    runUlts++;
    meta.stats.ults++;
    unlock('firstUlt');
    tutNext();
    const col = EL[player.school].color;
    rings.push({ x: player.x, y: player.y, r0: 10, r1: 120, t: 0.4, max: 0.4, color: col, w: 6 });
    if (player.school === 'fire') {
      const best = densest(live);
      meteors.push({ x: best.x, y: best.y, t: 0.75, max: 0.75, r: 140 });
      Sfx.whistle();
    } else if (player.school === 'ice') {
      for (const e of live) {
        e.frozen = e.kind === 'boss' ? 1.2 : 2.5;
        unfade(e);
        e.slow = Math.max(e.slow, 3);
        damageEnemy(e, player.atk * 4, false, EL.ice.color, true);
      }
      for (const b of bullets) sparks(b.x, b.y, EL.ice.color, 2);
      bullets = [];
      for (let i = 0; i < 60; i++) {
        parts.push({ x: rand(AX, AX + AW), y: rand(AY, AY + AH), vx: rand(-30, 30), vy: rand(40, 120), life: rand(0.6, 1.2), max: 1.2, color: '#eafcff', size: rand(1.5, 3.5) });
      }
      screenFlash = { color: '180,235,255', t: 0.5, max: 0.5 };
      Sfx.freeze();
    } else if (player.school === 'poison') {
      // Plaga: veneno fuerte para todos; los que mueran en 6 s revientan y contagian
      for (const e of live) {
        e.poisonDps = Math.max(e.poisonDps, player.atk * 1.2);
        e.plague = 6;
        damageEnemy(e, player.atk * 2, false, EL.poison.color, true);
        for (let i = 0; i < 6; i++) parts.push({ x: e.x + rand(-e.r, e.r), y: e.y, vx: rand(-20, 20), vy: rand(-70, -20), life: rand(0.5, 1), max: 1, color: EL.poison.color, size: rand(2, 4.5) });
      }
      screenFlash = { color: '150,255,110', t: 0.4, max: 0.4 };
      Sfx.plague();
    } else if (player.school === 'arcane') {
      const best = densest(live);
      sing = { x: best.x, y: best.y, t: 2, max: 2, tick: 0 };
      Sfx.whistle();
    } else {
      storm = { n: 10, t: 0 };
      for (const b of bullets) if (dist(b, player) < 170) { b.dead = true; sparks(b.x, b.y, EL.bolt.color, 2); }
      bullets = bullets.filter(b => !b.dead);
      screenFlash = { color: '255,240,150', t: 0.25, max: 0.25 };
    }
  }

  function updateUlts(dt) {
    for (const m of meteors) {
      m.t -= dt;
      if (m.t <= 0) {
        m.done = true;
        explode(m.x, m.y, m.r, player.atk * 12, EL.fire.color);
        for (const e of enemies) if (!e.dead && dist(e, m) < m.r + e.r) { e.burn = 3; e.burnDps = Math.max(e.burnDps, player.atk * 0.6); }
        for (const b of bullets) if (dist(b, m) < m.r) b.dead = true;
        bullets = bullets.filter(b => !b.dead);
        burst(m.x, m.y, '#ffd27a', 40, 340);
        shake = Math.max(shake, 16);
        screenFlash = { color: '255,150,60', t: 0.3, max: 0.3 };
        Sfx.boom();
      }
    }
    meteors = meteors.filter(m => !m.done);
    if (sing) {
      // Singularidad: atrae a los enemigos, los daña poco a poco y al final estalla
      sing.t -= dt; sing.tick -= dt;
      for (const e of enemies) {
        if (e.dead || e.spawnT > 0 || e.kind === 'totem') continue;
        const d = dist(e, sing);
        if (d < 270 && d > 3) {
          const pull = Math.min(d, (e.kind === 'boss' ? 45 : 175) * dt);
          e.x += (sing.x - e.x) / d * pull; e.y += (sing.y - e.y) / d * pull;
        }
      }
      if (sing.tick <= 0) {
        sing.tick = 0.25;
        for (const e of enemies) if (!e.dead && e.spawnT <= 0 && dist(e, sing) < 110 + e.r) damageEnemy(e, player.atk * 0.7, false, EL.arcane.color, true);
      }
      for (const b of bullets) if (dist(b, sing) < 220) { b.dead = true; sparks(b.x, b.y, EL.arcane.color, 2); }
      bullets = bullets.filter(b => !b.dead);
      if (Math.random() < dt * 40) {
        const a = rand(0, TAU), r = rand(80, 150);
        parts.push({ x: sing.x + Math.cos(a) * r, y: sing.y + Math.sin(a) * r, vx: -Math.cos(a) * r * 2.2 - Math.sin(a) * 120, vy: -Math.sin(a) * r * 2.2 + Math.cos(a) * 120, life: 0.4, max: 0.4, color: EL.arcane.color, size: rand(1.5, 3) });
      }
      if (sing.t <= 0) {
        explode(sing.x, sing.y, 150, player.atk * 7, EL.arcane.color);
        burst(sing.x, sing.y, '#ffffff', 30, 300);
        shake = Math.max(shake, 14);
        screenFlash = { color: '200,140,255', t: 0.35, max: 0.35 };
        Sfx.boom();
        sing = null;
      }
    }
    if (storm) {
      storm.t -= dt;
      if (storm.t <= 0) {
        const live = liveEnemies();
        if (!live.length || storm.n <= 0) { storm = null; return; }
        const e = pick(live);
        bolts.push({ x1: e.x + rand(-40, 40), y1: AY - 30, x2: e.x, y2: e.y, life: 0.25, sky: true });
        rings.push({ x: e.x, y: e.y, r0: 6, r1: 50, t: 0.25, max: 0.25, color: EL.bolt.color, w: 4 });
        damageEnemy(e, player.atk * 4.5, false, EL.bolt.color);
        if (!e.dead) e.shock = 2;
        Sfx.zap();
        shake = Math.max(shake, 4);
        storm.n--; storm.t = 0.14;
      }
    }
  }

  function recalc() {
    const s = player.sk;
    player.atk = 10 * (1 + 0.25 * (s.atk || 0)) * (1 + 0.06 * metaLv('poder'));
    player.rate = 1.5 * (1 + 0.22 * (s.atkspd || 0));
    player.crit = 0.05 + 0.1 * (s.crit || 0);
    player.critMul = 2 + 0.25 * (s.crit || 0);
    player.speed = 190 * (1 + 0.12 * (s.speed || 0)) * (1 + 0.04 * metaLv('paso'));
    player.dodge = 0.08 * (s.dodge || 0);
  }

  function heal(n, show = true) {
    const before = player.hp;
    player.hp = Math.min(player.maxHp, player.hp + n);
    const got = Math.round(player.hp - before);
    if (show && got > 0) addText(player.x, player.y - 34, '+' + got, '#5ee36a', 1);
  }

  function addXp(v) {
    player.xp += v * (1 + 0.1 * metaLv('sabio'));
    while (player.xp >= xpNeed(player.lvl)) {
      player.xp -= xpNeed(player.lvl);
      player.lvl++;
      pendingLevels++;
      Sfx.level();
      rings.push({ x: player.x, y: player.y, r0: 10, r1: 70, t: 0.5, max: 0.5, color: '#ffd25a', w: 5 });
      burst(player.x, player.y, '#ffd25a', 18, 200);
      if (player.lvl >= 15) unlock('lvl15');
    }
  }

  function hurtPlayer(dmg) {
    if (player.inv > 0 || state !== 'play') return;
    if (Math.random() < player.dodge) {
      player.inv = 0.3;
      addText(player.x, player.y - 34, 'ESQUIVA', '#9be7ff', 0.9);
      return;
    }
    if (player.shield > 0) { // escudo del altar: absorbe un golpe entero
      player.shield--;
      player.inv = 0.6;
      rings.push({ x: player.x, y: player.y, r0: player.r + 4, r1: player.r + 34, t: 0.35, max: 0.35, color: '#9fe8ff', w: 4 });
      addText(player.x, player.y - 34, 'ESCUDO', '#9fe8ff', 0.95);
      Sfx.shield();
      return;
    }
    dmg = Math.max(1, Math.round(dmg));
    player.hp -= dmg;
    player.inv = 0.7;
    roomHit = true;
    shake = Math.max(shake, 7);
    hurtFlash = 0.25;
    addText(player.x, player.y - 34, '-' + dmg, '#ff5a5a', 1.15);
    Sfx.hurt();
    vibrate(50);
    if (player.hp <= 0) {
      if (player.revives > 0) revive();
      else { player.hp = 0; die(); }
    }
  }

  // Pluma de fénix: vuelves con media vida y una onda que limpia la zona
  function revive() {
    player.revives--;
    unlock('phoenix');
    player.hp = Math.round(player.maxHp * 0.5);
    player.inv = 2.5;
    for (const b of bullets) sparks(b.x, b.y, '#ffcf4a', 2);
    bullets = [];
    explode(player.x, player.y, 170, player.atk * 5, '#ffcf4a');
    burst(player.x, player.y, '#ffcf4a', 40, 300);
    screenFlash = { color: '255,210,110', t: 0.6, max: 0.6 };
    toast = { text: '¡RENACES!', sub: 'La pluma de fénix te devuelve a la vida', color: '#ffcf4a', t: 2.4, max: 2.4 };
    shake = Math.max(shake, 12);
    Sfx.win();
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

  function spawnShot(x, y, a, dmg) {
    const s = player.sk;
    const els = ELEMENTS.filter(k => s[k]);
    const main = els.includes(player.school) ? player.school : els[0] || 'arcane';
    const second = els.find(k => k !== main);
    shots.push({
      x: x + Math.cos(a) * 18, y: y + Math.sin(a) * 18,
      vx: Math.cos(a) * SHOT_SPEED, vy: Math.sin(a) * SHOT_SPEED,
      dmg, life: 1.6, hit: new Set(),
      pierce: s.pierce || 0, rico: (s.ricochet || 0) * 2, wall: (s.wall || 0) * 2,
      els, col: EL[main].color, col2: second ? EL[second].color : null,
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
      spawnShot(player.x + px * off, player.y + py * off, base, dmg);
    }
    const diagA = [0.5, 0.95];
    for (let i = 0; i < (s.diag || 0); i++) {
      spawnShot(player.x, player.y, base + diagA[i], dmg);
      spawnShot(player.x, player.y, base - diagA[i], dmg);
    }
    if (s.side) { spawnShot(player.x, player.y, base + Math.PI / 2, dmg); spawnShot(player.x, player.y, base - Math.PI / 2, dmg); }
    if (s.rear) spawnShot(player.x, player.y, base + Math.PI, dmg);
    player.face = base;
    player.castFx = 0.12;
    Sfx.shoot();
  }

  function updatePlayer(dt) {
    const p = player;
    const [mx, my] = moveInput();
    p.moving = mx !== 0 || my !== 0;
    if (p.moving) {
      p.x += mx * p.speed * dt; p.y += my * p.speed * dt;
      p.face = Math.atan2(my, mx); p.walkT += dt; p.still = 0;
      if (tut && tut.step === 'move' && (tut.t += dt) > 0.6) tut.step = 'shoot';
    } else p.still += dt;
    collideRocks(p);
    clampArena(p, cleared && room < TOTAL_ROOMS);
    if (p.inv > 0) p.inv -= dt;
    if (p.cd > 0) p.cd -= dt;
    if (p.castFx > 0) p.castFx -= dt;
    if (!cleared) gainMana(dt * 0.6);

    // Quieto = lanzas hechizos; moviéndote = no
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

    // orbes guardianes
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
    const tint = window.ArcanoBiomes ? BIOME_TINT[window.ArcanoBiomes.forRoom(Math.max(1, room))] : null;
    return {
      kind, x, y, r: d.r, hp: d.hp * hm, maxHp: d.hp * hm, speed: d.speed * rand(0.92, 1.08),
      dmg: d.dmg * dmgMul(), xp: d.xp, ground: d.ground, color: (tint && tint[kind]) || d.color,
      spawnT: 0.75 + delay, spawnMax: 0.75 + delay, t: 0, seed: rand(0, TAU), flash: 0,
      state: kind === 'archer' ? 'move' : 'idle', timer: rand(0.6, 1.6), aim: 0, tx: x, ty: y,
      vx: 0, vy: 0, knock: 0, burn: 0, burnDps: 0, poisonDps: 0, dotT: 0.5, slow: 0, orbCd: 0, dead: false,
      shock: 0, frozen: 0, reactCd: 0, corrode: 0, plague: 0,
      heavy: kind === 'totem', alpha: kind === 'spirit' ? 1 : undefined, spin: rand(0, TAU),
      vscale: kind === 'bigslime' ? 1.4 : 1, // se dibuja más grande de lo que ocupa (cabe por pasillos de 1 celda)
    };
  }

  // Élite: más vida, más daño, aura dorada y el doble de experiencia
  function makeElite(e) {
    e.elite = true;
    e.hp *= 2.2; e.maxHp *= 2.2;
    e.r = Math.min(Math.round(e.r * 1.15), e.ground ? 19 : 30); // en tierra tiene que caber por pasillos de 40 px
    e.vscale = (e.vscale || 1) * 1.15;
    e.dmg *= 1.25; e.xp *= 2;
    return e;
  }

  function makeBoss(B) {
    return {
      kind: 'boss', tier: B.tier, name: B.name, x: AX + AW / 2, y: AY + 190, r: B.r,
      hp: B.hp, maxHp: B.hp, speed: B.speed, dmg: 14 * dmgMul(), xp: 25 + B.tier * 10, ground: true,
      color: B.color, bcolor: B.bullet, pats: B.pats, pi: 0, state: 'idle', timer: 1.4, sub: 0,
      aim: 0, spin: 0, acc: 0, alpha: 1, ringN: 12 + B.tier * 3, enraged: false,
      spawnT: 1, spawnMax: 1, t: 0, seed: 0, flash: 0, tx: 0, ty: 0, vx: 0, vy: 0, knock: 0,
      burn: 0, burnDps: 0, poisonDps: 0, dotT: 0.5, slow: 0, orbCd: 0, dead: false,
      shock: 0, frozen: 0, reactCd: 0, corrode: 0, plague: 0, heavy: true,
    };
  }

  function roomEnemies(n) {
    const pool = Object.keys(ENEMY_UNLOCK).filter(k => n >= ENEMY_UNLOCK[k]);
    const cap = { totem: 2, spirit: 3, bomber: 3, bigslime: 2 }; // máximo por sala
    let budget = 3.5 + n * 0.55;
    const list = [];
    for (let guard = 0; guard < 200 && budget > 0.9 && list.length < 11; guard++) {
      const k = pick(pool), c = ENEMIES[k].cost;
      if (c > budget + 0.3) continue;
      if (cap[k] && list.filter(x => x === k).length >= cap[k]) continue;
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
    if (e.shock > 0) e.shock -= dt;
    if (e.reactCd > 0) e.reactCd -= dt;
    if (e.corrode > 0) e.corrode -= dt;
    if (e.plague > 0) {
      e.plague -= dt;
      if (Math.random() < dt * 18) parts.push({ x: e.x + rand(-e.r, e.r), y: e.y, vx: 0, vy: -40, life: 0.4, max: 0.4, color: EL.poison.color, size: 2 });
    }
    if (e.frozen > 0) { e.frozen -= dt; return; } // congelado: ni se mueve ni ataca
    if (e.kx || e.ky) { // empujón del impacto, se frena rápido
      e.x += e.kx * dt; e.y += e.ky * dt;
      const f = Math.pow(0.0004, dt);
      e.kx *= f; e.ky *= f;
      if (Math.abs(e.kx) + Math.abs(e.ky) < 2) e.kx = e.ky = 0;
    }
    const chill = (player.sk.ice || 0) >= 2 ? 0.5 : 0.62;
    const ds = dt * (e.slow > 0 ? chill : 1); // el hielo ralentiza también sus ataques

    switch (e.kind) {
      case 'slime':
      case 'bigslime': {
        const hop = 0.3 + 0.7 * Math.max(0, Math.sin(e.t * (e.kind === 'bigslime' ? 3.5 : 5) + e.seed));
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
          for (let i = 0; i < n; i++) fireBullet(e.x, e.y, off + i * TAU / n, 165 + room * 3, e.dmg, '#ff6f9c');
          Sfx.eshot();
          const t = freeCellNear(e.x, e.y, 120);
          Object.assign(e, { state: 'idle', timer: rand(2.4, 3.4), tx: t.x, ty: t.y });
        }
        break;
      }
      case 'bomber': { // corre hacia ti, se para, chisporrotea y explota
        e.timer -= ds;
        if (e.state === 'idle') {
          const a = chaseDir(e);
          e.x += Math.cos(a) * e.speed * ds; e.y += Math.sin(a) * e.speed * ds;
          if (dist(e, player) < 72) { e.state = 'fuse'; e.timer = 0.8; }
        } else {
          if (Math.random() < dt * 20) sparks(e.x, e.y - e.r, '#ffd27a', 1);
          Sfx.fuse();
          if (e.timer <= 0) { bomberBlast(e, true); return; }
        }
        break;
      }
      case 'totem': { // torreta fija: cruz de balas que va girando
        e.timer -= ds;
        if (e.timer <= 0) {
          const n = room >= 15 ? 6 : 4;
          for (let i = 0; i < n; i++) fireBullet(e.x, e.y, e.spin + i * TAU / n, 150 + room * 3, e.dmg, '#c9a8ff', 6);
          e.spin += 0.38;
          e.timer = room >= 14 ? 0.95 : 1.3;
          Sfx.eshot();
        }
        break;
      }
      case 'spirit': { // flota, se desvanece y reaparece a tu lado para dispararte
        e.timer -= ds;
        if (e.state === 'idle') {
          const a = angTo(e, player) + Math.sin(e.t * 2 + e.seed) * 1.2;
          e.x += Math.cos(a) * e.speed * ds; e.y += Math.sin(a) * e.speed * ds;
          if (e.timer <= 0) { e.state = 'out'; e.timer = 0.35; }
        } else if (e.state === 'out') {
          e.alpha = clamp(e.timer / 0.35, 0, 1);
          if (e.timer <= 0) {
            for (let i = 0; i < 15; i++) {
              const a = rand(0, TAU), d = rand(150, 230);
              const t = { x: player.x + Math.cos(a) * d, y: player.y + Math.sin(a) * d };
              if (t.x > AX + 30 && t.x < AX + AW - 30 && t.y > AY + 30 && t.y < AY + AH - 30) { e.x = t.x; e.y = t.y; break; }
            }
            e.state = 'in'; e.timer = 0.35;
          }
        } else if (e.state === 'in') {
          e.alpha = 1 - clamp(e.timer / 0.35, 0, 1);
          if (e.timer <= 0) {
            e.alpha = 1;
            const a = angTo(e, player), n = room >= 15 ? 5 : 3;
            for (let i = 0; i < n; i++) fireBullet(e.x, e.y, a + (i - (n - 1) / 2) * 0.2, 210, e.dmg, '#bfe9ff', 6);
            Sfx.eshot();
            e.state = 'idle'; e.timer = rand(1.8, 2.6);
          }
        }
        break;
      }
      case 'boss':
        updateBoss(e, ds);
        break;
    }

    if (e.ground) collideRocks(e);
    clampArena(e, false);

    if (e.kind === 'totem') { // es un pilar: te bloquea el paso, no te daña al tocarlo
      const d = dist(e, player), min = e.r + player.r;
      if (d < min && d > 0.01) { player.x += (player.x - e.x) / d * (min - d); player.y += (player.y - e.y) / d * (min - d); }
      return;
    }
    if (e.kind === 'bomber') return; // solo hace daño al explotar

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
        const wa = a.heavy ? 0 : b.heavy ? 2 : 1; // jefes y tótems no se dejan empujar
        const wb = b.heavy ? 0 : a.heavy ? 2 : 1;
        a.x -= ux * push * wa; a.y -= uy * push * wa;
        b.x += ux * push * wb; b.y += uy * push * wb;
      }
    }
  }

  // ---------- Daño a enemigos ----------
  function damageEnemy(e, dmg, crit, color, small) {
    if (e.dead) return;
    if (e.frozen > 0) dmg *= 1.3; // los congelados reciben más daño
    if (e.corrode > 0) dmg *= 1.4; // corrosión (rayo + veneno)
    e.hp -= dmg;
    e.flash = 0.08;
    if (e.kind === 'boss') gainMana(dmg / e.maxHp * 90);
    if (settings.dmgNumbers) addText(e.x + rand(-6, 6), e.y - e.r - 6, Math.max(1, Math.round(dmg)), color || (crit ? '#ffd23f' : '#ffffff'), crit ? 1.35 : small ? 0.75 : 1);
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    const isBoss = e.kind === 'boss';
    if (e.selfBlast) { burst(e.x, e.y, e.color, lowQ() ? 6 : 14, 170); return; } // se ha inmolado: sin baja ni premio
    kills++;
    meta.stats.kills++;
    if (tut && tut.step === 'shoot') tut.step = 'clear';
    if (e.elite) { meta.stats.elites++; if (meta.stats.elites >= 25) unlock('elites'); }
    if (meta.stats.kills >= 1000) unlock('kills1000');
    burst(e.x, e.y, e.color, isBoss ? 70 : 14, isBoss ? 320 : 170);
    rings.push({ x: e.x, y: e.y, r0: e.r * 0.6, r1: e.r * 1.9, t: 0.25, max: 0.25, color: '#ffffff', w: 3 }); // "pop" al morir
    if (isBoss) { Sfx.boom(); shake = 16; } else Sfx.kill();
    let xp = e.xp;
    while (xp > 0) {
      const v = xp >= 5 ? 5 : 1;
      xp -= v;
      drops.push({ type: 'gem', v, x: e.x, y: e.y, vx: rand(-150, 150), vy: rand(-150, 150), t: 0 });
    }
    const hearts = isBoss ? 2 : Math.random() < (e.elite ? 0.3 : 0.06) ? 1 : 0;
    for (let i = 0; i < hearts; i++) drops.push({ type: 'heart', x: e.x, y: e.y, vx: rand(-120, 120), vy: rand(-120, 120), t: 0 });
    if (player.sk.blood) heal(player.maxHp * 0.02 * player.sk.blood);
    if (!isBoss) gainMana(e.minion ? 2 : e.elite ? 10 : 5);
    if (isBoss) {
      bossesKilled++;
      meta.stats.bosses++;
      slowT = 1.1;
      unlock('boss' + e.tier);
      if (!roomHit) unlock('untouchable');
      boss = null;
      for (const o of enemies) if (!o.dead && o !== e) { o.wiped = true; killEnemy(o); }
      return;
    }
    if (e.wiped) return; // muerto por la caída del jefe: sin efectos en cadena
    if (e.kind === 'bigslime') { // se divide en dos slimes pequeños
      for (const s of [-1, 1]) {
        const m = makeEnemy('slime', e.x + s * 14, e.y, -0.6);
        m.xp = 1; m.minion = true;
        clampArena(m, false);
        enemies.push(m);
      }
    }
    if (e.kind === 'bomber' && !e.blown) bomberBlast(e, false); // si lo matas, revienta contra los suyos
    if (e.plague > 0) { // Plaga: revienta y contagia
      e.plague = 0;
      explode(e.x, e.y, 85, player.atk * 2, EL.poison.color, player.atk * 0.8);
    }
  }

  // Explosión del diablillo: te daña si estás cerca (solo si llegó a detonar) y a sus compañeros siempre
  function bomberBlast(e, detonated) {
    e.blown = true;
    if (detonated) { e.xp = 0; e.selfBlast = true; }
    const rad = 80;
    rings.push({ x: e.x, y: e.y, r0: 10, r1: rad, t: 0.35, max: 0.35, color: '#ff6a2a', w: 6 });
    burst(e.x, e.y, '#ffb347', 26, 260);
    shake = Math.max(shake, 8);
    Sfx.blast();
    if (detonated && dist(e, player) < rad + player.r) hurtPlayer(e.dmg);
    for (const o of enemies) {
      if (o === e || o.dead || o.spawnT > 0) continue;
      if (dist(o, e) < rad + o.r) damageEnemy(o, 30 * dmgMul(), false, '#ffb347', true);
    }
    if (detonated && !e.dead) killEnemy(e); // selfBlast: no cuenta como baja tuya
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
      if (!o.dead) o.shock = Math.max(o.shock, 1.5);
    }
    if (near.length) Sfx.zap();
  }

  // ---------- Elementos y reacciones ----------
  function applyElements(e, els) {
    const s = player.sk;
    if (els.includes('fire')) { e.burn = 2.5; e.burnDps = Math.max(e.burnDps, player.atk * 0.35 * s.fire); }
    if (els.includes('ice')) e.slow = 1.8;
    if (els.includes('bolt')) e.shock = 2;
    if (els.includes('poison')) {
      const cap = player.atk * 0.8 * s.poison; // no rebaja un veneno más fuerte (p. ej. el de la Plaga)
      if (e.poisonDps < cap) e.poisonDps = Math.min(e.poisonDps + player.atk * 0.1 * s.poison, cap);
    }
  }

  function explode(x, y, rad, dmg, color, poison = 0) {
    rings.push({ x, y, r0: 10, r1: rad, t: 0.35, max: 0.35, color, w: 5 });
    burst(x, y, color, 20, 240);
    shake = Math.max(shake, 5);
    for (const o of enemies) {
      if (o.dead || o.spawnT > 0) continue;
      if (Math.hypot(o.x - x, o.y - y) < rad + o.r) {
        damageEnemy(o, dmg, false, color, true);
        if (poison && !o.dead) o.poisonDps = Math.max(o.poisonDps, poison);
      }
    }
  }

  function react(r, e) {
    e.reactCd = 1;
    const atk = player.atk;
    addText(e.x, e.y - e.r - 28, r.name, r.color, 1.15);
    Sfx.react();
    runReacts++;
    meta.stats.reactions++;
    meta.stats.reactSeen[r.id] = true;
    if (REACTIONS.every(x => meta.stats.reactSeen[x.id])) unlock('reactAll');
    if (runReacts >= 50) unlock('react50');
    if (!seenReactions.has(r.id)) {
      seenReactions.add(r.id);
      toast = { text: `¡${r.name}!`, sub: `${EL[r.a].name} + ${EL[r.b].name}: ${r.desc}`, color: r.color, t: 2.6, max: 2.6 };
    }
    if (r.id === 'vapor') {
      e.burn = 0; e.burnDps = 0; e.slow = 0;
      for (let i = 0; i < 16; i++) parts.push({ x: e.x + rand(-12, 12), y: e.y, vx: rand(-40, 40), vy: rand(-140, -60), life: rand(0.4, 0.8), max: 0.8, color: '#e8f7ff', size: rand(3, 6) });
      rings.push({ x: e.x, y: e.y, r0: e.r, r1: e.r + 40, t: 0.3, max: 0.3, color: r.color, w: 4 });
      damageEnemy(e, atk * 3, true, r.color);
    } else if (r.id === 'overload') {
      e.shock = 0;
      explode(e.x, e.y, 95, atk * 2.2, r.color);
    } else if (r.id === 'freeze') {
      e.slow = 0; e.shock = 0;
      e.frozen = e.kind === 'boss' ? 0.7 : 1.6;
      unfade(e);
      rings.push({ x: e.x, y: e.y, r0: e.r + 20, r1: e.r, t: 0.3, max: 0.3, color: r.color, w: 4 });
      Sfx.freeze();
    } else if (r.id === 'corrode') {
      e.shock = 0;
      e.corrode = 4;
      rings.push({ x: e.x, y: e.y, r0: e.r, r1: e.r + 30, t: 0.35, max: 0.35, color: r.color, w: 3 });
      for (let i = 0; i < 10; i++) parts.push({ x: e.x + rand(-e.r, e.r), y: e.y + rand(-e.r, e.r), vx: rand(-30, 30), vy: rand(20, 70), life: rand(0.4, 0.7), max: 0.7, color: r.color, size: rand(2, 3.5) });
    } else if (r.id === 'combust') {
      e.burn = 0; e.burnDps = 0;
      explode(e.x, e.y, 85, atk * 1.5, r.color, atk * 0.15 * Math.max(1, player.sk.poison || 1));
    }
  }

  // ================================================================
  //  Proyectiles, balas y botín
  // ================================================================
  function shotHit(ar, e) {
    ar.hit.add(e);
    const crit = Math.random() < player.crit;
    const dmg = ar.dmg * (crit ? player.critMul : 1);
    Sfx.hit();
    // estados previos al impacto: con ellos se decide si hay reacción
    const had = { fire: e.burn > 0, ice: e.slow > 0, bolt: e.shock > 0, poison: e.poisonDps > 0 };
    damageEnemy(e, dmg, crit);
    if (!e.dead && !e.heavy) { // retroceso al recibir el impacto
      const sp = Math.hypot(ar.vx, ar.vy) || 1;
      e.kx = (e.kx || 0) + ar.vx / sp * 80; e.ky = (e.ky || 0) + ar.vy / sp * 80;
    }
    if (!e.dead && e.reactCd <= 0) {
      for (const r of REACTIONS) {
        if ((ar.els.includes(r.a) && had[r.b]) || (ar.els.includes(r.b) && had[r.a])) { react(r, e); break; }
      }
    }
    if (!e.dead) applyElements(e, ar.els);
    if (ar.els.includes('bolt') && Math.random() < 0.25 * player.sk.bolt) chainLightning(e, ar.dmg * 0.5);

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
        ar.vx = Math.cos(a) * SHOT_SPEED; ar.vy = Math.sin(a) * SHOT_SPEED;
        ar.life = Math.max(ar.life, 0.8);
        return;
      }
    }
    if (ar.pierce > 0) { ar.pierce--; return; }
    ar.dead = true;
  }

  function updateShots(dt) {
    for (const ar of shots) {
      ar.life -= dt;
      if (ar.life <= 0) { ar.dead = true; continue; }
      for (let s = 0; s < 2 && !ar.dead; s++) {
        const px = ar.x, py = ar.y;
        ar.x += ar.vx * dt / 2; ar.y += ar.vy * dt / 2;
        // primero enemigos: un murciélago puede estar volando sobre una roca
        for (const e of enemies) {
          if (e.dead || e.spawnT > 0 || ar.hit.has(e) || (e.alpha !== undefined && e.alpha < 0.4)) continue;
          const rr = e.r + 5;
          if ((e.x - ar.x) ** 2 + (e.y - ar.y) ** 2 < rr * rr) { shotHit(ar, e); break; }
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
    shots = shots.filter(a => !a.dead);
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
    texts.push({ x, y, vx: rand(-25, 25), vy: -110, text: String(text), color, size, life: 0.8, max: 0.8 });
    if (texts.length > 80) texts.shift();
  }
  function sparks(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(40, 160);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.15, 0.35), max: 0.35, color, size: rand(1.5, 3) });
    }
  }
  function burst(x, y, color, n, speed) {
    if (lowQ()) n = Math.ceil(n * 0.4); // calidad baja: menos partículas
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(speed * 0.3, speed);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), max: 0.7, color, size: rand(2.5, 5.5) });
    }
    const cap = lowQ() ? 180 : 500;
    if (parts.length > cap) parts.splice(0, parts.length - cap);
  }

  function updateFx(dt) {
    const fr = Math.pow(0.05, dt);
    for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= fr; p.vy *= fr; p.life -= dt; }
    parts = parts.filter(p => p.life > 0);
    for (const t of texts) { t.vy += 230 * dt; t.x += t.vx * dt; t.y += t.vy * dt; t.life -= dt; } // saltan y caen
    texts = texts.filter(t => t.life > 0);
    for (const b of bolts) b.life -= dt;
    bolts = bolts.filter(b => b.life > 0);
    for (const r of rings) r.t -= dt;
    rings = rings.filter(r => r.t > 0);
    if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
    if (toast) { toast.t -= dt; if (toast.t <= 0) toast = null; }
    if (screenFlash) { screenFlash.t -= dt; if (screenFlash.t <= 0) screenFlash = null; }
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
      music('boss');
      return;
    }
    boss = null;
    if (ALTAR_ROOMS.has(room)) { // sala tranquila antes del jefe
      altar = { x: AX + AW / 2, y: AY + 340, used: false };
      banner = { text: 'ALTAR', sub: 'Tócalo para recibir una bendición', color: '#ffd27a', t: 1.8, max: 1.8 };
      music('menu');
      return;
    }
    if (state !== 'school') music('dungeon');
    const reach = bfs(grid, SPAWN_C, SPAWN_R, new Int16Array(COLS * ROWS));
    const cells = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      if (grid[i] || reach[i] < 0) continue;
      const c = i % COLS, r = (i / COLS) | 0;
      const x = AX + c * CELL + CELL / 2, y = AY + r * CELL + CELL / 2;
      if (r < 15 && Math.hypot(x - player.x, y - player.y) > 300) cells.push({ x, y });
    }
    shuffle(cells);
    let elites = 0;
    roomEnemies(room).forEach((k, i) => {
      const p = cells[i % Math.max(1, cells.length)] || { x: AX + AW / 2, y: AY + 150 };
      const e = makeEnemy(k, k === 'totem' ? p.x : p.x + rand(-5, 5), k === 'totem' ? p.y : p.y + rand(-5, 5), i * 0.05);
      if (room >= 6 && elites < 2 && Math.random() < 0.1 + room * 0.006) { makeElite(e); elites++; }
      enemies.push(e);
    });
    banner = { text: 'SALA ' + room, sub: room === TOTAL_ROOMS - 1 ? 'Se oye algo enorme al otro lado…' : '', color: '#ffffff', t: 1.4, max: 1.4 };
    if (room % 5 === 1 && Biomes()) { // nuevo capítulo = nuevo bioma
      try {
        const info = Biomes().info(biomeId());
        banner = { text: 'CAPÍTULO ' + Math.ceil(room / 5), sub: info.name, color: info.accent || '#ffd27a', t: 2.2, max: 2.2 };
      } catch (_) { /* sin biomas */ }
    }
  }

  function nextRoom() {
    for (const g of drops) collectDrop(g); // nada se pierde al cambiar de sala
    room++;
    if (room >= 10) unlock('room10');
    if (tut && room >= 2) tutDone();
    roomHit = false;
    grid = genRocks(!!BOSSES[room] || ALTAR_ROOMS.has(room));
    roomBgDirty = true;
    shots = []; bullets = []; drops = []; bolts = []; volleys = []; parts = []; texts = [];
    rings = []; meteors = []; storm = null; sing = null; altar = null;
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
    if (tut && room === 1) tut.step = 'door';
  }

  function newRun() {
    player = newPlayer();
    recalc();
    room = 0; kills = 0; runTime = 0; winTimer = -1; bossesKilled = 0; runEssence = 0;
    shake = 0; hurtFlash = 0; fade = 0; banner = null;
    toast = null; screenFlash = null;
    seenReactions.clear();
    pendingLevels = 0;
    runUlts = 0; runReacts = 0;
    runSeed = Math.floor(Math.random() * 1e9);
    slowT = 0;
    // nada de la partida anterior: ni gemas en el suelo ni efectos a medias
    drops = []; enemies = []; shots = []; bullets = []; parts = []; texts = []; bolts = []; volleys = [];
    tutStart();
    state = 'school';
    try { if (window.ArcanoMusic) window.ArcanoMusic.setIntensity(0); } catch (_) { /* sin música */ }
    nextRoom();
    resetJoy();
    showSchools();
  }

  function showSchools() {
    state = 'school';
    hud(false);
    lockUntil = performance.now() + 250;
    let n = 0;
    const cards = Object.entries(SCHOOLS).map(([id, s], i) => {
      const open = schoolOpen(id);
      return `
      <button class="card school${open ? '' : ' locked'}" data-act="${open ? 'school' : 'shop'}" data-id="${id}" style="--c:${EL[id].color};animation-delay:${i * 60}ms">
        <div class="ic">${open ? s.icon : '🔒'}</div>
        <div class="tx">
          <div class="nm">${s.name}</div>
          <div class="ds">${s.desc}</div>
          ${open ? `<div class="ult">${s.ultIcon} <b>${s.ult}</b>: ${s.ultDesc}</div>` : `<div class="ult">Se desbloquea en el <b>Santuario</b> por ✨ ${s.cost}</div>`}
        </div>
        ${open ? `<kbd>${++n}</kbd>` : ''}
      </button>`;
    }).join('');
    showOverlay(`
      <div class="panel">
        <div class="title gold">ELIGE TU ESCUELA</div>
        <div class="sub">Tu elemento base y tu hechizo definitivo</div>
        <div class="cards">${cards}</div>
        <button class="btn ghost" data-act="menu" style="margin-top:calc(var(--u)*14px)">VOLVER</button>
      </div>`);
  }

  function pickSchool(id) {
    if (!schoolOpen(id)) return;
    const S = SCHOOLS[id];
    player.school = id;
    if (S.el) player.sk[S.el] = 1;
    for (const [k, v] of Object.entries(S.grant || {})) player.sk[k] = (player.sk[k] || 0) + v;
    recalc();
    Sfx.pick();
    hideOverlay();
    hud(true);
    syncUlt(true);
    state = 'play';
    music('dungeon');
  }

  // botón del definitivo: carga circular con el color de la escuela
  let ultShown = -1;
  function syncUlt(force) {
    if (!player) return;
    const p = Math.floor(player.mana);
    if (!force && p === ultShown) return;
    ultShown = p;
    const s = SCHOOLS[player.school];
    btnUlt.style.setProperty('--p', p);
    btnUlt.style.setProperty('--c', EL[player.school].color);
    btnUlt.classList.toggle('ready', p >= 100);
    if (force) btnUlt.querySelector('.in').textContent = s.ultIcon;
  }

  function die() {
    state = 'dying';
    deathT = 1.1;
    burst(player.x, player.y, '#4fa3ff', 40, 260);
    shake = 14;
    resetJoy();
    Sfx.die();
    music('defeat');
  }

  // ================================================================
  //  Bucle
  // ================================================================
  let intensityT = 0;
  function update(dt) {
    runTime += dt;
    meta.stats.time += dt;
    updatePlayer(dt);
    if ((intensityT -= dt) <= 0) { // la música sube de capas con más enemigos
      intensityT = 0.5;
      try { if (window.ArcanoMusic) window.ArcanoMusic.setIntensity(clamp(enemies.length / 8, 0, 1)); } catch (_) { /* sin música */ }
    }
    flowT -= dt;
    if (flowT <= 0) { flowT = 0.2; bfs(grid, cellC(player.x), cellR(player.y), flow); }
    for (const e of enemies) if (!e.dead) updateEnemy(e, dt);
    separate();
    updateShots(dt);
    updateUlts(dt);
    updateBullets(dt);
    updateDrops(dt);
    updateFx(dt);
    syncUlt();
    enemies = enemies.filter(e => !e.dead);

    if (!cleared && enemies.length === 0) onCleared();
    if (cleared) doorAnim = Math.min(1, doorAnim + dt * 2);
    if (altar && !altar.used && state === 'play' && dist(player, altar) < player.r + 26) openAltar();
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
    const raw = (now - last) / 1000;
    const dt = Math.min(raw, 1 / 30);
    last = now;
    clock += dt;
    fpsAcc += raw; fpsN++;
    if (fpsAcc >= 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
    if (slowT > 0) slowT -= dt;
    if (state === 'play') update(slowT > 0 ? dt * 0.28 : dt);
    else if (state === 'transition') updateTransition(dt);
    else if (state === 'dying') {
      deathT -= dt;
      updateFx(dt);
      if (deathT <= 0) showEnd(false);
    }
    if (state !== 'play' && state !== 'dying') shake = 0; // que no tiemble detrás de los menús
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
  function star(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 4, rr = i % 2 ? r * 0.4 : r;
      ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }
  // ---- utilidades de color y sprites cacheados (volumen tipo 3D y brillos) ----
  const shadeCache = new Map();
  function rgbOf(hex) {
    let h = hex.slice(1);
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  // aclara (amt > 0) u oscurece (amt < 0) un color #hex
  function shade(hex, amt) {
    if (hex[0] !== '#') return hex;
    const key = hex + amt;
    let v = shadeCache.get(key);
    if (v) return v;
    const t = amt < 0 ? 0 : 255, k = Math.abs(amt);
    const [r, g, b] = rgbOf(hex).map(c => Math.round(c + (t - c) * k));
    v = `rgb(${r},${g},${b})`;
    shadeCache.set(key, v);
    return v;
  }
  const rgba = (hex, a) => { const [r, g, b] = rgbOf(hex); return `rgba(${r},${g},${b},${a})`; };

  // esfera con luz arriba a la izquierda (degradado cacheado por color y radio)
  const ballCache = new Map();
  function ballGrad(col, r) {
    const key = col + '|' + r;
    let g = ballCache.get(key);
    if (!g) {
      g = ctx.createRadialGradient(-r * 0.35, -r * 0.42, r * 0.08, 0, 0, r);
      g.addColorStop(0, shade(col, 0.55));
      g.addColorStop(0.5, col);
      g.addColorStop(1, shade(col, -0.4));
      ballCache.set(key, g);
    }
    return g;
  }
  function ball(x, y, r, col, rim = true) {
    if (col[0] !== '#') { circle(x, y, r, col); return; }
    const rr = Math.max(1, Math.round(r * 2) / 2);
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU);
    ctx.fillStyle = ballGrad(col, rr); ctx.fill();
    if (rim) { ctx.strokeStyle = shade(col, -0.62); ctx.lineWidth = 2; ctx.stroke(); }
    ctx.restore();
  }
  // igual pero ovalado (slimes)
  function blob(x, y, rx, ry, col, rim = true) {
    const r = Math.max(1, Math.round(Math.max(rx, ry) * 2) / 2);
    ctx.save();
    ctx.translate(x, y); ctx.scale(rx / r, ry / r);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = ballGrad(col, r); ctx.fill();
    if (rim) { ctx.strokeStyle = shade(col, -0.6); ctx.lineWidth = 2 * r / Math.max(rx, ry); ctx.stroke(); }
    ctx.restore();
  }

  // halo de luz aditivo (sprite por color)
  const glowCache = new Map();
  function glowSprite(col) {
    let c = glowCache.get(col);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(col, 0.9));
    gr.addColorStop(0.3, rgba(col, 0.45));
    gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    glowCache.set(col, c);
    return c;
  }
  function glow(x, y, r, col, a = 1) {
    if (!col || col[0] !== '#') col = '#ffffff';
    const pa = ctx.globalAlpha, op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = pa * a;
    ctx.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = pa;
    ctx.globalCompositeOperation = op;
  }

  // sombra suave difuminada
  const shadowSpr = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return c;
  })();

  // viñeta permanente para dar profundidad (se pinta una vez)
  const vignetteSpr = (() => {
    const c = document.createElement('canvas');
    c.width = 270; c.height = 480;
    const g = c.getContext('2d'), gr = g.createRadialGradient(135, 260, 120, 135, 260, 330);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.42)');
    g.fillStyle = gr; g.fillRect(0, 0, 270, 480);
    return c;
  })();

  function shadow(e, lift = 0) {
    const w = e.r * 2.5, h = e.r * 1.05;
    ctx.drawImage(shadowSpr, e.x - w / 2, e.y + e.r * 0.78 + lift - h / 2, w, h);
  }

  const Biomes = () => window.ArcanoBiomes;
  function biomeId() {
    if (!Biomes()) return null;
    if (!player) return menuBiome || (menuBiome = pick(Biomes().list));
    return Biomes().forRoom(Math.max(1, room));
  }
  function buildRoomBg() {
    if (roomBg) roomBg.width = roomBg.height = 0; // libera el lienzo anterior (Safari tiene poca memoria para canvas)
    roomBg = null;
    try {
      roomBg = Biomes().render({ grid, biome: biomeId(), seed: (runSeed * 31 + room * 7919) >>> 0, scale: canvas.width / W, doorX0: DOOR_X0, doorX1: DOOR_X1 });
    } catch (_) { roomBg = null; }
  }
  function drawRoom() {
    if (Biomes()) {
      if (roomBgDirty) { buildRoomBg(); roomBgDirty = false; }
      if (roomBg) {
        ctx.drawImage(roomBg, 0, 0, W, H);
        drawTorches();
        drawDoor();
        return;
      }
    }
    drawRoomPlain();
  }

  function drawTorches() {
    for (const tx of [AX + 70, AX + AW - 70]) {
      const fl = Math.sin(clock * 13 + tx) * 0.5 + Math.sin(clock * 7.3 + tx * 2) * 0.5;
      glow(tx, AY - 22, 60 + fl * 4, '#ff9a3d', 0.55);
      ctx.fillStyle = '#3b2a1a'; ctx.fillRect(tx - 3, AY - 18, 6, 14);
      ellipse(tx, AY - 23 - fl, 6 + fl, 9 + fl * 2, '#ff8a2a');
      ellipse(tx, AY - 21 - fl, 3, 5 + fl, '#ffe08a');
    }
  }

  // sala sin biomes.js (respaldo)
  function drawRoomPlain() {
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
    // círculo rúnico donde apareces
    const cx = AX + AW / 2, cy = AY + AH - 50;
    ctx.strokeStyle = 'rgba(199,125,255,.16)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 42, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 32, 0, TAU); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const a = -Math.PI / 2 + i * TAU * 2 / 5;
      ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * 32, cy + Math.sin(a) * 32);
    }
    ctx.stroke();
    // antorchas en el muro
    for (const tx of [AX + 70, AX + AW - 70]) {
      const fl = Math.sin(clock * 13 + tx) * 0.5 + Math.sin(clock * 7.3 + tx * 2) * 0.5;
      const gl = ctx.createRadialGradient(tx, AY, 4, tx, AY, 110 + fl * 6);
      gl.addColorStop(0, 'rgba(255,170,80,.22)'); gl.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = gl; ctx.fillRect(tx - 120, AY - 34, 240, 150);
      ctx.fillStyle = '#3b2a1a'; ctx.fillRect(tx - 3, AY - 18, 6, 14);
      ellipse(tx, AY - 23 - fl, 6 + fl, 9 + fl * 2, '#ff8a2a');
      ellipse(tx, AY - 21 - fl, 3, 5 + fl, '#ffe08a');
    }
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
      if (e.kind === 'bomber' && e.state === 'fuse') { // radio de la explosión
        const k = 1 - e.timer / 0.8;
        ctx.fillStyle = `rgba(255,80,30,${0.1 + 0.18 * k})`;
        ctx.beginPath(); ctx.arc(e.x, e.y, 80, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,120,60,.8)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, 80 * k, 0, TAU); ctx.stroke();
      }
    }
  }

  function drawAltar() {
    if (!altar) return;
    const { x, y } = altar, used = altar.used;
    if (!used) { // haz de luz
      const g = ctx.createRadialGradient(x, y - 10, 4, x, y - 10, 90);
      g.addColorStop(0, `rgba(255,214,122,${0.35 + 0.1 * Math.sin(clock * 3)})`); g.addColorStop(1, 'rgba(255,214,122,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 10, 90, 0, TAU); ctx.fill();
    }
    ellipse(x, y + 18, 30, 10, 'rgba(0,0,0,.35)');
    ctx.fillStyle = '#4b3e6e'; rrect(x - 26, y - 2, 52, 22, 6); ctx.fill();
    ctx.fillStyle = '#6a5a94'; rrect(x - 22, y - 8, 44, 12, 5); ctx.fill();
    const cy = y - 26 + Math.sin(clock * 2.5) * 4;
    ctx.globalAlpha = used ? 0.35 : 1;
    ctx.fillStyle = '#ffd27a';
    ctx.beginPath(); ctx.moveTo(x, cy - 16); ctx.lineTo(x + 10, cy); ctx.lineTo(x, cy + 14); ctx.lineTo(x - 10, cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x - 2, cy - 9, 3, 8);
    ctx.globalAlpha = 1;
    if (!used) for (let i = 0; i < 3; i++) {
      const a = clock * 1.6 + i * TAU / 3;
      circle(x + Math.cos(a) * 34, y - 14 + Math.sin(a) * 12, 2.5, '#fff1c4');
    }
  }

  function drawSingularity() {
    if (!sing) return;
    const k = 1 - sing.t / sing.max, r = 22 + 10 * k;
    const g = ctx.createRadialGradient(sing.x, sing.y, r * 0.5, sing.x, sing.y, r * 3.2);
    g.addColorStop(0, 'rgba(199,125,255,.45)'); g.addColorStop(1, 'rgba(199,125,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sing.x, sing.y, r * 3.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = EL.arcane.color; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const a = clock * 6 + i * TAU / 3;
      ctx.beginPath(); ctx.arc(sing.x, sing.y, r + 10 + i * 6, a, a + 1.6); ctx.stroke();
    }
    circle(sing.x, sing.y, r, '#07040d');
    ctx.strokeStyle = '#efdcff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sing.x, sing.y, r, 0, TAU); ctx.stroke();
  }

  function drawDrops() {
    for (const g of drops) {
      const bob = g.magnet ? 0 : Math.sin(clock * 5 + g.x) * 2;
      if (g.type === 'gem') { // gema facetada que gira y brilla
        const s = g.v >= 5 ? 8 : 5.5, col = g.v >= 5 ? '#5ab8ff' : '#5df2a0';
        const spin = Math.abs(Math.cos(clock * 4 + g.x * 0.1)) * 0.7 + 0.3, y = g.y + bob;
        glow(g.x, y, s * 2.6, col, 0.6);
        ctx.fillStyle = shade(col, -0.25);
        ctx.beginPath(); ctx.moveTo(g.x, y - s); ctx.lineTo(g.x + s * 0.75 * spin, y); ctx.lineTo(g.x, y + s); ctx.lineTo(g.x - s * 0.75 * spin, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(col, 0.35);
        ctx.beginPath(); ctx.moveTo(g.x, y - s); ctx.lineTo(g.x + s * 0.75 * spin, y); ctx.lineTo(g.x, y); ctx.lineTo(g.x - s * 0.75 * spin, y); ctx.closePath(); ctx.fill();
        if (Math.sin(clock * 3 + g.x) > 0.95) star(g.x + s * 0.4, y - s * 0.6, 3, '#ffffff');
      } else { // corazón que late
        const x = g.x, y = g.y + bob, k = 1 + 0.12 * Math.sin(clock * 8);
        glow(x, y + 2, 18, '#ff4d6d', 0.6);
        ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
        ctx.fillStyle = '#ff4d6d';
        ctx.beginPath(); ctx.arc(-4, -2, 5, 0, TAU); ctx.arc(4, -2, 5, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.lineTo(0, 10); ctx.closePath(); ctx.fill();
        circle(-5, -4, 1.8, 'rgba(255,255,255,.75)');
        ctx.restore();
      }
    }
  }

  function drawPlayer() {
    const p = player;
    const blink = p.inv > 0 && Math.floor(p.inv * 16) % 2 === 0;
    ctx.globalAlpha = blink ? 0.4 : 1;
    shadow(p);
    const bob = p.moving ? Math.abs(Math.sin(p.walkT * 12)) * 3 : 0;
    const x = p.x, y = p.y - bob, a = p.face, r = p.r;
    const col = EL[p.school].color;
    const lean = p.moving ? -Math.cos(a) * 4 : 0;
    // capa ondeando detrás
    const wave = p.moving ? Math.sin(p.walkT * 14) * 3 : Math.sin(clock * 2) * 1;
    ctx.fillStyle = '#2a1873';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.85, y - r * 0.15);
    ctx.quadraticCurveTo(x - r * 1.2 - wave, y + r * 0.7, x - r * 0.7, y + r * 1.05);
    ctx.lineTo(x + r * 0.7, y + r * 1.05);
    ctx.quadraticCurveTo(x + r * 1.2 + wave, y + r * 0.7, x + r * 0.85, y - r * 0.15);
    ctx.closePath(); ctx.fill();
    // bastón (en la mano del lado hacia el que mira)
    const hx = x + Math.cos(a + 0.9) * (r - 1), hy = y + Math.sin(a + 0.9) * (r - 1) + 2;
    const tx = hx + Math.cos(a) * 20, ty = hy + Math.sin(a) * 20 - 8;
    ctx.strokeStyle = '#4a2c14'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx - Math.cos(a) * 10, hy - Math.sin(a) * 10 + 4); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(hx - Math.cos(a) * 10, hy - Math.sin(a) * 10 + 4); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.lineCap = 'butt';
    // túnica
    blob(x, y + r * 0.2, r * 0.95, r * 0.85, '#5b3fd1');
    ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y + r * 0.2, r * 0.8, 0.35, Math.PI - 0.35); ctx.stroke(); // ribete dorado
    // cabeza grande (chibi)
    ball(x, y - r * 0.5, r * 0.66, '#ffd2a6');
    eyes(x + Math.cos(a) * 3, y - r * 0.42 + Math.sin(a) * 2, a, 3.4, 2.4);
    circle(x - r * 0.42, y - r * 0.28, 2, 'rgba(255,120,120,.35)'); // mofletes
    circle(x + r * 0.42, y - r * 0.28, 2, 'rgba(255,120,120,.35)');
    // sombrero puntiagudo
    const hy0 = y - r * 0.92;
    blob(x, hy0, r * 1.15, r * 0.4, '#3a24a0');
    const hg = ctx.createLinearGradient(x - r, 0, x + r, 0);
    hg.addColorStop(0, '#6a4ff0'); hg.addColorStop(0.55, '#4a30c0'); hg.addColorStop(1, '#2c1a7a');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.72, hy0 - 1); ctx.lineTo(x + r * 0.72, hy0 - 1);
    ctx.quadraticCurveTo(x + 4 + lean, hy0 - r * 1.05, x + 10 + lean * 1.6, hy0 - r * 1.75);
    ctx.quadraticCurveTo(x - 1 + lean, hy0 - r * 1.0, x - r * 0.72, hy0 - 1);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1f1250'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = col; // cinta del color de la escuela
    ctx.beginPath(); ctx.moveTo(x - r * 0.7, hy0 - 2); ctx.lineTo(x + r * 0.7, hy0 - 2); ctx.lineTo(x + r * 0.6, hy0 - 6.5); ctx.lineTo(x - r * 0.6, hy0 - 6.5); ctx.closePath(); ctx.fill();
    star(x + 1 + lean * 0.5, hy0 - r * 0.62, 4, '#ffcf4a');
    // cristal del bastón (delante de todo, brilla)
    const pulse = (p.castFx > 0 ? 9 : 0) + Math.sin(clock * 6) * 1.5;
    glow(tx, ty, 16 + pulse, col);
    circle(tx, ty, 5, col); circle(tx - 1.5, ty - 1.5, 2, '#fff');
    ctx.globalAlpha = 1;
    if (p.shield > 0) { // escudo arcano del altar
      glow(p.x, p.y - 4, p.r + 18, '#9fe8ff', 0.35);
      ctx.strokeStyle = `rgba(159,232,255,${0.5 + 0.3 * Math.sin(clock * 5)})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(p.x, p.y - 4, p.r + 12, 0, TAU); ctx.stroke();
    }
    // barra de vida segmentada con daño que se va vaciando
    p.hpShow = p.hpShow == null ? p.hp : p.hpShow + (p.hp - p.hpShow) * Math.min(1, 0.06 + (p.hp > p.hpShow ? 1 : 0));
    const bw = 50, bx = p.x - bw / 2, by = p.y - r * 2.9 - 6, k = clamp(p.hp / p.maxHp, 0, 1), ks = clamp(p.hpShow / p.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,.65)'; rrect(bx - 2, by - 2, bw + 4, 10, 5); ctx.fill();
    if (ks > k) { ctx.fillStyle = '#ffffff'; rrect(bx, by, bw * ks, 6, 3); ctx.fill(); }
    const hpg = ctx.createLinearGradient(0, by, 0, by + 6);
    hpg.addColorStop(0, k < 0.3 ? '#ff8a8a' : '#9dff8a'); hpg.addColorStop(1, k < 0.3 ? '#d93030' : '#2fb84a');
    ctx.fillStyle = hpg; rrect(bx, by, bw * k, 6, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1; // marcas cada 25 de vida
    if (p.maxHp <= 500) for (let v = 25; v < p.maxHp; v += 25) { const lx = bx + bw * v / p.maxHp; ctx.beginPath(); ctx.moveTo(lx, by); ctx.lineTo(lx, by + 6); ctx.stroke(); }
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
    const vs = e.vscale || 1;
    ctx.save();
    if (vs !== 1) { ctx.translate(e.x, e.y); ctx.scale(vs, vs); ctx.translate(-e.x, -e.y); }
    const fly = e.kind === 'bat' ? 10 : e.kind === 'spirit' ? 8 + Math.sin(e.t * 3) * 3 : 0;
    shadow(e, fly * 0.3);
    const ang = angTo(e, player);
    if (e.elite && !spawning) { // aura dorada
      glow(e.x, e.y - fly, e.r * 2.4, '#ffcf4a', 0.35 + 0.15 * Math.sin(clock * 6 + e.seed));
      ctx.strokeStyle = `rgba(255,207,74,${0.55 + 0.25 * Math.sin(clock * 6 + e.seed)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y - fly, e.r + 6, 0, TAU); ctx.stroke();
    }

    switch (e.kind) {
      case 'slime': drawSlime(e.x, e.y, e.r, e.color, e.t * 5 + e.seed, ang); break;
      case 'bigslime':
        drawSlime(e.x, e.y, e.r, e.color, e.t * 3.5 + e.seed, ang);
        circle(e.x + e.r * 0.35, e.y + e.r * 0.2, e.r * 0.18, 'rgba(20,80,40,.6)'); // núcleo que se ve dentro
        break;
      case 'bomber': {
        const fuse = e.state === 'fuse';
        const blink = fuse && Math.sin(clock * (20 + (1 - e.timer / 0.8) * 40)) > 0;
        const jx = fuse ? rand(-1.5, 1.5) : 0;
        if (fuse) glow(e.x, e.y, e.r * 3, '#ff6a2a', 0.5 + 0.4 * Math.sin(clock * 30));
        ball(e.x + jx, e.y, e.r, blink ? '#fff1d6' : e.color);
        ctx.fillStyle = '#2a1206'; // cuernecillos
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(e.x + jx + s * 6, e.y - e.r + 3); ctx.lineTo(e.x + jx + s * 10, e.y - e.r - 7); ctx.lineTo(e.x + jx + s * 2, e.y - e.r + 1); ctx.closePath(); ctx.fill(); }
        eyes(e.x + jx + Math.cos(ang) * 4, e.y + Math.sin(ang) * 4, ang, 4, 2.6, '#ffe14a', '#3a0a00');
        ctx.strokeStyle = '#3b2a1a'; ctx.lineWidth = 2; // mecha
        ctx.beginPath(); ctx.moveTo(e.x + jx, e.y - e.r); ctx.quadraticCurveTo(e.x + jx + 6, e.y - e.r - 8, e.x + jx + 2, e.y - e.r - 12); ctx.stroke();
        circle(e.x + jx + 2, e.y - e.r - 12, 2.5 + Math.random() * 1.5, '#ffd27a');
        break;
      }
      case 'totem': {
        const charge = e.timer < 0.3 ? 1 - e.timer / 0.3 : 0;
        ctx.fillStyle = '#2b2440'; rrect(e.x - e.r, e.y - e.r - 10, e.r * 2, e.r * 2 + 10, 6); ctx.fill();
        const tg = ctx.createLinearGradient(e.x - e.r, 0, e.x + e.r, 0);
        tg.addColorStop(0, shade(e.color, 0.35)); tg.addColorStop(0.5, e.color); tg.addColorStop(1, shade(e.color, -0.35));
        ctx.fillStyle = tg; rrect(e.x - e.r + 3, e.y - e.r - 14, e.r * 2 - 6, e.r * 2 + 4, 6); ctx.fill();
        ctx.fillStyle = shade(e.color, 0.45); rrect(e.x - e.r + 3, e.y - e.r - 14, e.r * 2 - 6, 6, 3); ctx.fill(); // cara de arriba
        if (charge > 0) glow(e.x, e.y - 4, 26, '#c9a8ff', charge);
        ctx.globalAlpha = alpha * (0.3 + 0.7 * charge);
        circle(e.x, e.y - 4, 14, 'rgba(201,168,255,.6)');
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = charge > 0 ? '#ffffff' : '#c9a8ff'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
        ctx.beginPath(); // runa: rombo con dos patas
        ctx.moveTo(e.x, e.y - 14); ctx.lineTo(e.x + 7, e.y - 6); ctx.lineTo(e.x, e.y + 2); ctx.lineTo(e.x - 7, e.y - 6); ctx.closePath();
        ctx.moveTo(e.x - 4, e.y - 1); ctx.lineTo(e.x - 9, e.y + 6); ctx.moveTo(e.x + 4, e.y - 1); ctx.lineTo(e.x + 9, e.y + 6);
        ctx.stroke();
        break;
      }
      case 'spirit': {
        const y = e.y - fly;
        glow(e.x, y, e.r * 2.2, '#9fd8ff', 0.35);
        const sg = ctx.createLinearGradient(0, y - e.r, 0, y + e.r);
        sg.addColorStop(0, 'rgba(230,248,255,.95)'); sg.addColorStop(1, 'rgba(120,190,255,.55)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(e.x, y, e.r, Math.PI, 0);
        for (let i = 0; i <= 4; i++) { // cola ondulada
          const px = e.x + e.r - i * (e.r * 2 / 4), py = y + e.r * 0.9 + (i % 2 ? -5 : 4) + Math.sin(e.t * 8 + i) * 2;
          ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        eyes(e.x + Math.cos(ang) * 3, y - 2 + Math.sin(ang) * 3, ang, 5, 3, '#1b2a44', null);
        break;
      }
      case 'bat': {
        const y = e.y - fly, flap = Math.sin(e.t * 22) * 0.5 + 0.5;
        ctx.fillStyle = '#3b1a66';
        for (const s of [-1, 1]) { // alas con membrana festoneada
          ctx.beginPath();
          ctx.moveTo(e.x + s * e.r * 0.4, y - 3);
          ctx.lineTo(e.x + s * (e.r + 15 + flap * 6), y - 9 - flap * 9);
          ctx.quadraticCurveTo(e.x + s * (e.r + 12), y + 2, e.x + s * (e.r + 7), y + 2);
          ctx.quadraticCurveTo(e.x + s * (e.r + 3), y + 8, e.x + s * e.r * 0.5, y + 4);
          ctx.closePath(); ctx.fill();
        }
        ball(e.x, y, e.r, e.color);
        ctx.fillStyle = shade(e.color, -0.3); // orejas
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(e.x + s * 4, y - e.r + 2); ctx.lineTo(e.x + s * 8, y - e.r - 6); ctx.lineTo(e.x + s * 10, y - e.r + 4); ctx.closePath(); ctx.fill(); }
        eyes(e.x + Math.cos(ang) * 4, y + Math.sin(ang) * 4, ang, 4, 2.6, '#ff5a6a', null);
        break;
      }
      case 'archer': {
        const a = e.state === 'aim' ? e.aim : ang;
        ball(e.x, e.y, e.r, e.color);
        ball(e.x + Math.cos(a) * 2, e.y - 3, e.r * 0.62, '#8cc455', false);
        ctx.fillStyle = '#3d6a1f'; // orejas puntiagudas de goblin
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(e.x + s * e.r * 0.5, e.y - 6); ctx.lineTo(e.x + s * (e.r + 8), e.y - 10); ctx.lineTo(e.x + s * e.r * 0.6, e.y + 1); ctx.closePath(); ctx.fill(); }
        eyes(e.x + Math.cos(a) * 5, e.y + Math.sin(a) * 5, a, 4.5, 3, '#ffe066', '#3b2a00');
        ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 5, a - 0.8, a + 0.8); ctx.stroke();
        break;
      }
      case 'charger': {
        const a = e.state === 'dash' || e.state === 'wind' ? e.aim : ang;
        const jx = e.state === 'wind' ? rand(-2, 2) : 0;
        ctx.save(); ctx.translate(e.x + jx, e.y); ctx.rotate(a);
        if (e.state === 'dash') glow(-e.r, 0, e.r * 2, '#ff8a3d', 0.4);
        blob(-2, 0, e.r * 1.1, e.r * 0.85, e.color);
        ellipse(-8, 0, e.r * 0.55, e.r * 0.42, 'rgba(255,220,170,.25)');
        ctx.fillStyle = shade(e.color, -0.4); // cresta
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-e.r * 0.8 + i * 7, -3); ctx.lineTo(-e.r * 0.6 + i * 7, -10); ctx.lineTo(-e.r * 0.4 + i * 7, -3); ctx.closePath(); ctx.fill(); }
        ctx.fillStyle = '#f3ead7';
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(e.r * 0.8, s * 6); ctx.lineTo(e.r * 1.35, s * 10); ctx.lineTo(e.r * 0.85, s * 10); ctx.closePath(); ctx.fill();
        }
        circle(e.r * 0.45, -6, 2.6, '#ff3b3b'); circle(e.r * 0.45, 6, 2.6, '#ff3b3b');
        ctx.restore();
        break;
      }
      case 'mage': { // cultista encapuchado
        if (e.state === 'cast') glow(e.x, e.y, e.r * 2.6, '#ff6f9c', 0.6);
        ball(e.x, e.y, e.r, e.color);
        ctx.fillStyle = shade(e.color, -0.25); // punta de la capucha
        ctx.beginPath(); ctx.moveTo(e.x - 8, e.y - e.r + 4); ctx.lineTo(e.x - Math.cos(ang) * 6, e.y - e.r - 9); ctx.lineTo(e.x + 8, e.y - e.r + 4); ctx.closePath(); ctx.fill();
        circle(e.x + Math.cos(ang) * 4, e.y + Math.sin(ang) * 4, e.r * 0.58, '#1a0710');
        eyes(e.x + Math.cos(ang) * 6, e.y + Math.sin(ang) * 6, ang, 3.5, 2.2, '#ff5a7a', null);
        if (e.state === 'cast') {
          const k = 1 - e.timer / 0.75;
          ctx.strokeStyle = `rgba(255,111,156,${0.4 + 0.5 * k})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4 + 18 * k, 0, TAU); ctx.stroke();
        }
        break;
      }
      case 'boss': drawBoss(e, ang); break;
    }

    if (e.flash > 0) { ctx.globalAlpha = 0.7 * alpha; circle(e.x, e.y - fly, e.r, '#fff'); }
    ctx.restore();
    ctx.globalAlpha = 1;
    if (spawning) return;
    if (e.frozen > 0) { // bloque de hielo
      ctx.fillStyle = 'rgba(170,235,255,.45)'; rrect(e.x - e.r - 5, e.y - e.r - 5 - fly, e.r * 2 + 10, e.r * 2 + 10, 6); ctx.fill();
      ctx.strokeStyle = '#e6fbff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(e.x - e.r, e.y - e.r - fly, 4, e.r);
    } else if (e.slow > 0) { ctx.strokeStyle = 'rgba(143,233,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y - fly, e.r + 3, 0, TAU); ctx.stroke(); }
    if (e.shock > 0 && Math.sin(clock * 40 + e.seed) > 0) {
      ctx.strokeStyle = EL.bolt.color; ctx.lineWidth = 2;
      const a = rand(0, TAU), x0 = e.x + Math.cos(a) * e.r, y0 = e.y - fly + Math.sin(a) * e.r;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + rand(-7, 7), y0 + rand(-7, 7)); ctx.lineTo(x0 + rand(-10, 10), y0 + rand(-10, 10)); ctx.stroke();
    }
    if (e.poisonDps > 0) circle(e.x + e.r * 0.7, e.y - e.r * 0.7 - fly, 4, '#9dff6e');
    if (e.corrode > 0) { ctx.strokeStyle = 'rgba(212,255,74,.8)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y - fly, e.r + 5, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    if (e.kind !== 'boss') {
      const bw = Math.max(28, e.r * 2), by = e.y - e.r - (e.kind === 'totem' ? 24 : 12) - fly, k = clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; rrect(e.x - bw / 2 - 1.5, by - 1.5, bw + 3, 7, 3.5); ctx.fill();
      ctx.fillStyle = e.elite ? '#ffcf4a' : '#ff4d4d'; rrect(e.x - bw / 2, by, bw * k, 4, 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(e.x - bw / 2 + 1, by, Math.max(0, bw * k - 2), 1.2);
    }
  }

  function drawSlime(x, y, r, color, phase, ang) {
    const s = Math.sin(phase), lift = Math.max(0, s) * 6;
    const sx = 1 - 0.12 * s, sy = 1 + 0.12 * s;
    blob(x, y - lift, r * sx, r * sy * 0.92, color);
    ellipse(x - r * 0.38, y - lift - r * 0.42, r * 0.26, r * 0.15, 'rgba(255,255,255,.6)'); // brillo gelatinoso
    circle(x + r * 0.3, y - lift - r * 0.5, r * 0.07, 'rgba(255,255,255,.7)');
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
      const gg = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
      gg.addColorStop(0, shade(b.color, 0.35)); gg.addColorStop(0.5, b.color); gg.addColorStop(1, shade(b.color, -0.4));
      ctx.fillStyle = gg; rrect(x - r + jx, y - r, r * 2, r * 2, 14); ctx.fill();
      glow(x + jx, y + r * 0.1, r * 0.9, '#ffb347', 0.25 + 0.1 * Math.sin(clock * 3)); // núcleo de lava
      ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.8); ctx.lineTo(x - r * 0.2, y - r * 0.2); ctx.lineTo(x - r * 0.5, y + r * 0.4); ctx.stroke();
      for (const s of [-1, 1]) ball(x + s * (r + 10) + jx, y + 8, 13, '#8a7d6a');
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
        glow(x + Math.cos(oa) * (r + 16), y + Math.sin(oa) * (r + 16), 14, '#c58bff');
        circle(x + Math.cos(oa) * (r + 16), y + Math.sin(oa) * (r + 16), 5, '#e9d6ff');
      }
      glow(x, y, r * 2.2, '#c58bff', 0.35);
      ball(x, y, r, b.color);
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
      ball(x, y, r, b.color);
      eyes(x + Math.cos(a) * 10, y + Math.sin(a) * 10, a, 13, 7, '#ffe14a', '#5a0000');
    }
  }

  function drawShots() {
    // orbes mágicos con estela (el color sale del elemento del hechizo)
    for (const a of shots) {
      const col = a.col;
      const sp = Math.hypot(a.vx, a.vy) || 1, ux = a.vx / sp, uy = a.vy / sp;
      // estela afilada
      const op = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(col, 0.5); ctx.lineCap = 'round';
      ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x - ux * 16, a.y - uy * 16); ctx.stroke();
      ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x - ux * 30, a.y - uy * 30); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.globalCompositeOperation = op;
      glow(a.x, a.y, 17, col, 0.9);
      circle(a.x, a.y, 5.5, col);
      if (a.col2) { // segundo elemento: chispa orbitando
        const t = clock * 25;
        glow(a.x + Math.cos(t) * 8, a.y + Math.sin(t) * 8, 6, a.col2);
        circle(a.x + Math.cos(t) * 8, a.y + Math.sin(t) * 8, 2.4, a.col2);
      }
      circle(a.x, a.y, 2.8, '#fff');
    }
  }

  function drawBullets() {
    for (const b of bullets) {
      glow(b.x, b.y, b.r * 2.6, b.color, 0.7);
      circle(b.x, b.y, b.r + 1.5, 'rgba(40,0,10,.75)'); // contorno oscuro para leerlas sobre suelos claros
      circle(b.x, b.y, b.r, b.color);
      circle(b.x, b.y, b.r * 0.5, '#fff');
    }
  }

  function drawOrbs() {
    const n = player.sk.orbs || 0;
    for (let i = 0; i < n; i++) {
      const a = player.orbA + i * TAU / n;
      const x = player.x + Math.cos(a) * 72, y = player.y + Math.sin(a) * 72;
      const col = EL[player.school].color;
      for (let k = 1; k <= 3; k++) { // estela
        ctx.globalAlpha = 0.25 * (1 - k / 4);
        circle(player.x + Math.cos(a - k * 0.12) * 72, player.y + Math.sin(a - k * 0.12) * 72, 9 - k, col);
      }
      ctx.globalAlpha = 1;
      glow(x, y, 20, col);
      circle(x, y, 7, col); circle(x, y, 3.5, '#fff');
    }
  }

  function drawMotes() {
    for (let i = 0; i < 28; i++) {
      const sp = 8 + (i % 5) * 5;
      const x = ((i * 83.7 + Math.sin(clock * 0.5 + i) * 30) % W + W) % W;
      const y = H - ((clock * sp + i * 137) % (H + 40));
      ctx.globalAlpha = 0.3 + 0.25 * Math.sin(clock * 2 + i);
      circle(x, y, 1.5 + (i % 3), i % 4 ? '#c77dff' : '#ffd27a');
    }
    ctx.globalAlpha = 1;
  }

  function drawRings() {
    for (const r of rings) {
      const k = 1 - r.t / r.max;
      ctx.globalAlpha = clamp(r.t / r.max, 0, 1);
      ctx.strokeStyle = r.color; ctx.lineWidth = r.w || 3;
      ctx.beginPath(); ctx.arc(r.x, r.y, Math.max(1, r.r0 + (r.r1 - r.r0) * k), 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawMeteorMarks() { // aviso en el suelo
    for (const m of meteors) {
      const k = 1 - m.t / m.max;
      ctx.fillStyle = `rgba(255,90,40,${0.12 + 0.15 * k})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,140,60,.8)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r * k, 0, TAU); ctx.stroke();
    }
  }

  function drawMeteors() { // la roca cayendo
    for (const m of meteors) {
      const k = m.t / m.max, x = m.x + 160 * k, y = m.y - 620 * k;
      for (let i = 1; i <= 6; i++) {
        ctx.globalAlpha = 0.5 * (1 - i / 7);
        circle(x + i * 9, y - i * 34 * 0.6, 22 - i * 2, i < 3 ? '#ffd27a' : '#ff6a2a');
      }
      ctx.globalAlpha = 1;
      circle(x, y, 24, '#ff7a2a'); circle(x, y, 17, '#5a2a14'); circle(x - 5, y - 5, 6, '#8a4a24');
    }
  }

  function drawToast() {
    if (!toast) return;
    const a = clamp(Math.min(toast.t, toast.max - toast.t) / 0.25, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(12,8,22,.82)'; rrect(W / 2 - 220, 140, 440, 66, 18); ctx.fill();
    ctx.strokeStyle = toast.color; ctx.lineWidth = 2; ctx.stroke();
    txt(toast.text, W / 2, 162, 24, toast.color, 'center', false);
    txt(toast.sub, W / 2, 189, 15, '#e9e3ff', 'center', false);
    ctx.globalAlpha = 1;
  }

  function drawBolts() {
    for (const b of bolts) {
      const pts = [[b.x1, b.y1]];
      for (let i = 1; i < 6; i++) {
        const t = i / 6;
        pts.push([b.x1 + (b.x2 - b.x1) * t + rand(-9, 9), b.y1 + (b.y2 - b.y1) * t + rand(-9, 9)]);
      }
      pts.push([b.x2, b.y2]);
      const layers = b.sky ? [[10, 'rgba(255,230,90,.35)'], [4, '#fff7c2']] : [[6, 'rgba(120,220,255,.35)'], [2, '#ffffff']];
      for (const [w, c] of layers) {
        ctx.strokeStyle = c; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts) ctx.lineTo(p[0], p[1]);
        ctx.stroke();
      }
    }
  }

  function drawParts() {
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter'; // las chispas suman luz
    for (const p of parts) {
      const k = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = k;
      circle(p.x, p.y, p.size * (0.5 + 0.5 * k), p.color);
    }
    ctx.globalCompositeOperation = op;
    ctx.globalAlpha = 1;
  }

  function drawTexts() {
    for (const t of texts) {
      const age = t.max - t.life;
      const pop = 1 + 0.7 * Math.max(0, 1 - age / 0.12); // aparece grande y se asienta
      ctx.globalAlpha = clamp(t.life / t.max * 2.2, 0, 1);
      txt(t.text, t.x, t.y, Math.round(19 * t.size * pop), t.color);
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
    if (player.revives > 0) { // pluma de fénix disponible
      ctx.save(); ctx.translate(bx + 190, 72); ctx.rotate(-0.6);
      ellipse(0, 0, 4, 10, '#ff9a3d'); ellipse(0, -2, 2, 6, '#ffd27a');
      ctx.strokeStyle = '#ffe9b0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, 13); ctx.stroke();
      ctx.restore();
    }
    txt(`☠ ${kills}`, bx + bw, 72, 18, '#cfc6e8', 'right', false);
    // barra del jefe
    if (boss && !boss.dead) {
      const x = AX + 30, w = AW - 60, y = AY - 28, kb = clamp(boss.hp / boss.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,.75)'; rrect(x - 2, y - 2, w + 4, 24, 8); ctx.fill();
      ctx.fillStyle = boss.enraged ? '#ff3b3b' : '#e0453a'; rrect(x, y, w * kb, 20, 7); ctx.fill();
      txt(boss.name.toUpperCase(), AX + AW / 2, y + 10, 13, '#fff');
    }
    if (tut && TUT_TEXT[tut.step]) hint(TUT_TEXT[tut.step](), '#ffd27a');
    else if (!settings.ultTip && player.mana >= 100 && enemies.length) {
      hint(TOUCH ? '¡Definitivo listo! Toca el botón brillante' : '¡Definitivo listo! Pulsa Espacio', EL[player.school].color);
      if (TOUCH) { // flecha hacia el botón
        const bxu = settings.lefty ? 74 : W - 74, bob = Math.sin(clock * 8) * 6;
        txt('▼', bxu, 790 + bob * 0.7, 26, EL[player.school].color, 'center', true);
      }
    }
  }

  function hint(text, color) {
    ctx.font = `800 17px ${FONT}`;
    const w = Math.min(W - 40, ctx.measureText(text).width + 40), y = TOUCH ? 735 : 770;
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(clock * 4);
    ctx.fillStyle = 'rgba(12,8,22,.85)'; rrect(W / 2 - w / 2, y - 22, w, 44, 22); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    txt(text, W / 2, y, 17, color, 'center', false);
    ctx.globalAlpha = 1;
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
    if (shake > 0 && settings.shake) ctx.translate(rand(-shake, shake) * 0.6, rand(-shake, shake) * 0.6);
    drawRoom();
    if (!player) drawMotes(); // motas mágicas flotando detrás de los menús
    if (player) {
      drawTelegraphs();
      drawMeteorMarks();
      drawAltar();
      drawSingularity();
      drawDrops();
      if (Biomes() && !lowQ()) { try { Biomes().ambient(ctx, clock, biomeId()); } catch (_) { /* sin biomas */ } }
      const list = enemies.slice();
      if (player.hp > 0) list.push(player);
      list.sort((a, b) => a.y - b.y);
      for (const o of list) (o === player ? drawPlayer() : drawEnemy(o));
      if (player.hp > 0) drawOrbs();
      drawShots();
      drawBullets();
      drawRings();
      drawBolts();
      drawMeteors();
      drawParts();
      drawTexts();
    }
    ctx.restore();
    ctx.drawImage(vignetteSpr, 0, 0, W, H);
    if (player) {
      if (screenFlash) {
        ctx.fillStyle = `rgba(${screenFlash.color},${0.4 * screenFlash.t / screenFlash.max})`;
        ctx.fillRect(0, 0, W, H);
      }
      drawHUD();
      drawVignette();
      drawBanner();
      drawToast();
      drawJoystick();
    }
    if (fade > 0) { ctx.fillStyle = `rgba(10,7,18,${fade})`; ctx.fillRect(0, 0, W, H); }
    if (settings.fps) txt(`${Math.round(fps)} FPS`, 10, H - 12, 13, '#9fe8ff', 'left', true);
  }

  // ================================================================
  //  Pantallas (DOM)
  // ================================================================
  function showOverlay(html, cls = '') { overlay.className = cls; overlay.innerHTML = html; }
  function hideOverlay() { overlay.className = 'hidden'; overlay.innerHTML = ''; }
  function hud(show) {
    hudBtns.classList.toggle('hidden', !show);
    btnUlt.classList.toggle('hidden', !show);
  }

  const hasEl = k => (player.sk[k] || 0) > 0;
  // reacciones que desbloquearía conseguir este elemento
  function unlocksWith(el) {
    if (hasEl(el)) return [];
    return REACTIONS.filter(r => (r.a === el && hasEl(r.b)) || (r.b === el && hasEl(r.a)));
  }

  function reactionList() {
    return `<div class="reacts">${REACTIONS.map(r => {
      const on = hasEl(r.a) && hasEl(r.b);
      return `<div class="react ${on ? 'on' : ''}" style="--c:${r.color}">
        <span>${SKILLS.find(k => k.id === r.a).icon}+${SKILLS.find(k => k.id === r.b).icon}</span>
        <b>${r.name}</b><i>${on ? r.desc : 'Bloqueada'}</i></div>`;
    }).join('')}</div>`;
  }

  function skillChips() {
    const owned = SKILLS.filter(k => player.sk[k.id] && k.id !== 'heal');
    if (!owned.length) return '<div class="empty">Sin habilidades todavía</div>';
    return `<div class="chips">${owned.map(k =>
      `<span class="chip" title="${k.name}">${k.icon}${player.sk[k.id] > 1 ? `<i>${player.sk[k.id]}</i>` : ''}</span>`).join('')}</div>`;
  }

  // ---------- Intro: Doublelag Games ----------
  let splashTimer = 0;
  function showSplash() {
    state = 'splash';
    hud(false);
    showOverlay(`
      <div class="splash" data-act="skip">
        <div class="dl-logo">
          <img src="assets/doublelag-logo.png" alt="" onerror="this.style.display='none'">
          <div class="dl-word">DOUBLELAG<span>GAMES</span></div>
        </div>
        <div class="dl-pres">presenta</div>
      </div>`, 'solid');
    clearTimeout(splashTimer);
    splashTimer = setTimeout(showTapToStart, 2800);
  }

  // pantalla intermedia: el primer toque desbloquea el audio en móvil
  function showTapToStart() {
    clearTimeout(splashTimer);
    if (state !== 'splash') return;
    state = 'tap';
    showOverlay(`
      <div class="panel tap" data-act="start">
        <div class="logo big">ARCANO</div>
        <div class="tag">Roguelite de magia</div>
        <div class="tap-hint">${TOUCH ? 'Toca para empezar' : 'Haz clic o pulsa una tecla'}</div>
        <div class="by">Un juego de <b>Doublelag Games</b></div>
      </div>`);
  }

  function startFromTap() {
    Sfx.init();
    armBack();
    showMenu();
  }

  // el gesto Atrás de Android hace lo mismo que Escape (necesita una entrada en el historial creada en un gesto)
  let backArmed = false;
  function armBack() {
    if (backArmed) return;
    try { history.pushState({ arcano: 1 }, ''); backArmed = true; } catch (_) { /* sin historial */ }
  }
  window.addEventListener('popstate', () => {
    backArmed = false;
    if (state === 'play' || state === 'paused') togglePause();
    else if (['settings', 'credits', 'stats', 'shop'].includes(state)) goBack();
    else if (state === 'school') showMenu();
    else if (state === 'menu' || state === 'splash' || state === 'tap') history.back(); // en el menú sí sale
    // se vuelve a armar en el siguiente toque (Chrome ignora las entradas creadas sin gesto del usuario)
  });

  function showMenu() {
    state = 'menu';
    player = null; boss = null; room = 0;
    enemies = []; shots = []; bullets = []; drops = []; parts = []; texts = []; bolts = [];
    rings = []; meteors = []; storm = null; sing = null; altar = null; toast = null; screenFlash = null;
    cleared = true; doorAnim = 1; fade = 0; shake = 0;
    grid = genRocks(false);
    menuBiome = null; roomBgDirty = true;
    hud(false);
    music('menu');
    try { if (window.ArcanoMusic) window.ArcanoMusic.setIntensity(0); } catch (_) { /* sin música */ }
    const b = store.get('best', null);
    const done = ACHIEVEMENTS.filter(a => meta.ach[a.id]).length;
    showOverlay(`
      <div class="panel menu">
        <div class="logo">ARCANO</div>
        <div class="tag">Roguelite de magia · ${TOTAL_ROOMS} salas · 4 jefes</div>
        <button class="btn primary menu-play" data-act="play">JUGAR</button>
        <button class="btn ghost" data-act="shop">🏛️ Santuario <span class="ess">✨ ${meta.essence}</span></button>
        <div class="btn-row">
          <button class="btn ghost" data-act="stats">🏆 Logros <span class="cnt">${done}/${ACHIEVEMENTS.length}</span></button>
          <button class="btn ghost" data-act="settings">⚙️ Ajustes</button>
        </div>
        ${installEvt ? '<button class="btn ghost install" data-act="install">📲 Instalar en el móvil</button>' : ''}
        ${b ? `<div class="best">Récord: ${b.school && SCHOOLS[b.school] ? SCHOOLS[b.school].icon + ' ' : ''}${b.win ? '🏆 Mazmorra completada' : 'Sala ' + b.room} · Nivel ${b.lvl}</div>` : ''}
        <div class="howto">
          <div><b>Muévete</b> para esquivar · <b>quieto</b> para lanzar hechizos</div>
          <div><b>Combina elementos</b> y suelta tu <b>definitivo</b></div>
        </div>
        <div class="foot"><button class="link" data-act="credits">Doublelag Games</button> · v${VERSION}</div>
      </div>`);
  }

  // ---------- Ajustes ----------
  let settingsFrom = 'menu', notice = '';
  const TOGGLES = [
    ['vibration', '📳', 'Vibración', 'Al recibir un golpe (solo móvil)'],
    ['shake', '💥', 'Temblor de pantalla', ''],
    ['dmgNumbers', '🔢', 'Números de daño', ''],
    ['lefty', '✋', 'Modo zurdo', 'El botón del definitivo pasa a la izquierda'],
    ['fps', '📊', 'Mostrar FPS', ''],
  ];
  const slider = (k, ic, name) => `<label class="set-row"><span class="ic">${ic}</span><span class="tx"><b>${name}</b></span>
      <input type="range" min="0" max="100" step="5" value="${Math.round(settings[k] * 100)}" data-set="${k}" aria-label="${name}"></label>`;

  function showSettings(from) {
    if (from) settingsFrom = from;
    const st = state === 'settings' ? panelScroll() : 0;
    state = 'settings';
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.navigator.standalone;
    showOverlay(`
      <div class="panel shop settings">
        <div class="title">AJUSTES</div>
        ${notice ? `<div class="notice">${notice}</div>` : ''}
        <div class="set-list">
          <button class="set-row" data-act="mute"><span class="ic">${Sfx.muted ? '🔇' : '🔊'}</span><span class="tx"><b>Sonido</b>${Sfx.muted ? '<i>Silenciado</i>' : ''}</span>
            <span class="sw ${Sfx.muted ? '' : 'on'}"></span></button>
          ${slider('music', '🎵', 'Música')}
          ${slider('sfx', '🔊', 'Efectos')}
          ${TOGGLES.map(([k, ic, name, sub]) => `<button class="set-row" data-act="toggle" data-key="${k}">
            <span class="ic">${ic}</span><span class="tx"><b>${name}</b>${sub ? `<i>${sub}</i>` : ''}</span>
            <span class="sw ${settings[k] ? 'on' : ''}"></span></button>`).join('')}
          <div class="set-row"><span class="ic">🎨</span><span class="tx"><b>Calidad gráfica</b><i>Baja = más fluido en móviles modestos</i></span>
            <span class="seg"><button data-act="quality" data-v="alta" class="${settings.quality === 'alta' ? 'on' : ''}">Alta</button><button data-act="quality" data-v="baja" class="${settings.quality === 'baja' ? 'on' : ''}">Baja</button></span></div>
          <button class="set-row" data-act="tutorial"><span class="ic">🎓</span><span class="tx"><b>Ver el tutorial otra vez</b>
            <i>${settings.tutorial ? 'Toca para que salga en la próxima partida' : 'Saldrá en tu próxima partida ✓'}</i></span></button>
        </div>
        ${ios ? '<div class="dim">En iPhone: Compartir → «Añadir a pantalla de inicio» para jugar a pantalla completa. Hazlo cuanto antes: en iOS antiguos el progreso de Safari no siempre pasa a la app.</div>' : ''}
        <div class="btn-row">
          <button class="btn ghost" data-act="credits">Créditos</button>
          ${settingsFrom === 'pause' ? '' : '<button class="btn ghost danger" data-act="reset">Borrar progreso</button>'}
        </div>
        <button class="btn primary sticky" data-act="back">VOLVER</button>
      </div>`);
    notice = '';
    restoreScroll(st);
  }

  function applySettings() {
    wrap.classList.toggle('lefty', settings.lefty);
    Sfx.applyVolumes();
    resize();
  }

  function toggleSetting(k) {
    settings[k] = !settings[k];
    saveSettings();
    applySettings();
    Sfx.click();
    if (k === 'vibration' && settings.vibration) vibrate(40);
    showSettings();
  }

  function resetProgress() {
    const fresh = META_DEFAULT();
    for (const k of Object.keys(meta)) delete meta[k];
    Object.assign(meta, fresh);
    saveMeta();
    store.del('best');
    settings.tutorial = false; settings.ultTip = false;
    saveSettings();
    notice = 'Progreso borrado: empiezas de cero';
    showSettings();
  }

  // ---------- Créditos ----------
  let creditsFrom = 'menu';
  function showCredits(from) {
    creditsFrom = from || 'menu';
    state = 'credits';
    showOverlay(`
      <div class="panel credits">
        <div class="dl-logo small">
          <img src="assets/doublelag-logo.png" alt="" onerror="this.style.display='none'">
          <div class="dl-word">DOUBLELAG<span>GAMES</span></div>
        </div>
        <div class="logo mid">ARCANO</div>
        <div class="cred">
          <div><span>Un juego de</span><b>Doublelag Games</b></div>
          <div><span>Idea y dirección</span><b>Double</b></div>
          <div><span>Música y sonido</span><b>Sintetizados en tiempo real</b></div>
          <div><span>Versión</span><b>v${VERSION} · 2026</b></div>
        </div>
        <div class="sec">Sigue a Doublelag</div>
        <div class="btn-row">
          <a class="btn ghost yt" href="https://www.youtube.com/@Doublelag" target="_blank" rel="noopener">▶ Doublelag</a>
          <a class="btn ghost yt" href="https://www.youtube.com/@DoublelagGTA6" target="_blank" rel="noopener">▶ Doublelag GTA6</a>
        </div>
        <div class="dim thanks">Gracias por jugar ❤️</div>
        <button class="btn primary" data-act="back">VOLVER</button>
      </div>`);
  }

  // ---------- Logros y estadísticas ----------
  const fmtLong = s => s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor(s % 3600 / 60)} min` : `${Math.floor(s / 60)} min`;
  function showStats() {
    state = 'stats';
    const S = meta.stats;
    const done = ACHIEVEMENTS.filter(a => meta.ach[a.id]).length;
    const bests = Object.entries(SCHOOLS).map(([id, s]) => {
      const b = S.best[id], w = S.winsBy[id] || 0;
      return `<div class="sb ${schoolOpen(id) ? '' : 'off'}" style="--c:${EL[id].color}">
          <span>${schoolOpen(id) ? s.icon : '🔒'}</span><b>${b ? (b > TOTAL_ROOMS ? '🏆' : 'Sala ' + b) : '—'}</b>
          <i>${w ? w + (w > 1 ? ' victorias' : ' victoria') : s.name}</i></div>`;
    }).join('');
    const achs = ACHIEVEMENTS.map(a => {
      const got = meta.ach[a.id];
      return `<div class="shop-item ach ${got ? 'got' : ''}"><span class="ic">${got ? a.icon : '🔒'}</span>
          <span class="tx"><b>${a.name}</b><i>${a.desc}</i></span><span class="price">${got ? '✓' : '✨ ' + a.reward}</span></div>`;
    }).join('');
    showOverlay(`
      <div class="panel shop">
        <div class="title gold">LOGROS</div>
        <div class="sub">${done} de ${ACHIEVEMENTS.length} desbloqueados</div>
        <div class="stats">
          <div><span>Partidas</span><b>${meta.runs}</b></div>
          <div><span>Victorias</span><b>${S.wins}</b></div>
          <div><span>Bajas</span><b>${S.kills}</b></div>
          <div><span>Jefes</span><b>${S.bosses}</b></div>
          <div><span>Reacciones</span><b>${S.reactions}</b></div>
          <div><span>Tiempo jugado</span><b>${fmtLong(S.time)}</b></div>
        </div>
        <div class="sec">Mejor sala por escuela</div>
        <div class="sbests">${bests}</div>
        <div class="sec">Logros</div>
        <div class="shop-list">${achs}</div>
        <button class="btn primary sticky" data-act="back">VOLVER</button>
      </div>`);
  }

  let shopFrom = 'menu';
  function goBack() {
    Sfx.click();
    if (state === 'shop' && shopFrom === 'school') { shopFrom = 'menu'; hideOverlay(); return newRun(); }
    if (state === 'settings') return settingsFrom === 'pause' ? showPause() : showMenu();
    if (state === 'credits') return creditsFrom === 'settings' ? showSettings() : showMenu();
    showMenu();
  }

  function panelScroll() { const p = overlay.querySelector('.panel'); return p ? p.scrollTop : 0; }
  function restoreScroll(st) { const p = overlay.querySelector('.panel'); if (p && st) p.scrollTop = st; }

  // instalar como app (Android/Chrome); en iPhone se explica en Ajustes
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (state === 'menu') showMenu(); });
  window.addEventListener('appinstalled', () => { installEvt = null; if (state === 'menu') showMenu(); });


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
    const title = `¡NIVEL ${player.lvl - pendingLevels + 1}!`;
    const cards = opts.map((k, i) => {
      const lv = player.sk[k.id] || 0;
      const pips = k.max > 1 && k.max < 50 ? `<div class="pips">${'★'.repeat(lv + 1)}${'☆'.repeat(k.max - lv - 1)}</div>` : '';
      const combo = k.el ? unlocksWith(k.id) : [];
      const comboHtml = combo.length ? `<div class="combo">✨ Desbloquea ${combo.map(r => r.name).join(' y ')}</div>` : '';
      return `<button class="card${combo.length ? ' hot' : ''}" data-act="pick" data-id="${k.id}" style="animation-delay:${i * 70}ms">
          <div class="ic">${k.icon}</div>
          <div class="tx"><div class="nm">${k.name}</div><div class="ds">${k.desc}</div>${comboHtml}${pips}</div>
          <kbd>${i + 1}</kbd>
        </button>`;
    }).join('');
    const reroll = player.rerolls > 0 ? `<button class="btn ghost reroll" data-act="reroll">🍀 Cambiar cartas (${player.rerolls})</button>` : '';
    showOverlay(`
      <div class="panel">
        <div class="title gold">${title}</div>
        <div class="sub">Elige una habilidad</div>
        <div class="cards">${cards}</div>
        ${reroll}
      </div>`);
  }

  // ---------- Altar (sala de descanso antes de cada jefe) ----------
  function openAltar() {
    altar.used = true;
    state = 'altar';
    resetJoy();
    lockUntil = performance.now() + 380;
    Sfx.level();
    showOverlay(`
      <div class="panel">
        <div class="title gold">ALTAR</div>
        <div class="sub">Elige una bendición antes del jefe</div>
        <div class="cards">
          <button class="card" data-act="altar" data-id="heal">
            <div class="ic">⛲</div>
            <div class="tx"><div class="nm">Fuente sagrada</div><div class="ds">Recuperas el 60% de la vida (${Math.ceil(player.hp)}/${player.maxHp})</div></div><kbd>1</kbd>
          </button>
          <button class="card" data-act="altar" data-id="bless" style="animation-delay:70ms">
            <div class="ic">✨</div>
            <div class="tx"><div class="nm">Bendición arcana</div><div class="ds">Subes un nivel ahora mismo</div></div><kbd>2</kbd>
          </button>
          ${player.mana >= 100 ? `<button class="card" data-act="altar" data-id="shield" style="animation-delay:140ms">
            <div class="ic">🛡️</div>
            <div class="tx"><div class="nm">Escudo arcano</div><div class="ds">Bloquea por completo el primer golpe del jefe</div></div><kbd>3</kbd>
          </button>` : `<button class="card" data-act="altar" data-id="mana" style="animation-delay:140ms">
            <div class="ic">${SCHOOLS[player.school].ultIcon}</div>
            <div class="tx"><div class="nm">Ofrenda de maná</div><div class="ds">Tu ${SCHOOLS[player.school].ult} empieza el jefe cargado</div></div><kbd>3</kbd>
          </button>`}
        </div>
      </div>`);
  }

  function pickAltar(id) {
    hideOverlay();
    state = 'play';
    if (id === 'heal') heal(player.maxHp * 0.6);
    else if (id === 'bless') { player.lvl++; pendingLevels++; if (player.lvl >= 15) unlock('lvl15'); }
    else if (id === 'shield') player.shield = 1;
    else { player.mana = 100; syncUlt(true); }
    Sfx.pick();
    burst(altar.x, altar.y - 20, '#ffd27a', 24, 200);
  }

  // ---------- Santuario: mejoras permanentes ----------
  function showShop() {
    const st = state === 'shop' ? panelScroll() : 0;
    state = 'shop';
    const rows = META_UPS.map(u => {
      const lv = metaLv(u.id), maxed = lv >= u.max, cost = maxed ? 0 : u.cost[lv];
      return `<button class="shop-item${maxed ? ' maxed' : ''}" data-act="buy" data-id="${u.id}" ${maxed || meta.essence < cost ? 'disabled' : ''}>
          <span class="ic">${u.icon}</span>
          <span class="tx"><b>${u.name}</b><i>${u.desc}</i><span class="pips">${'●'.repeat(lv)}${'○'.repeat(u.max - lv)}</span></span>
          <span class="price">${maxed ? 'MÁX' : '✨ ' + cost}</span>
        </button>`;
    }).join('');
    const schools = Object.entries(SCHOOLS).filter(([id]) => !schoolOpen(id)).map(([id, s]) => `
        <button class="shop-item school" data-act="buyschool" data-id="${id}" style="--c:${EL[id].color}" ${meta.essence < s.cost ? 'disabled' : ''}>
          <span class="ic">${s.icon}</span>
          <span class="tx"><b>${s.name}</b><i>${s.ultIcon} ${s.ult}: ${s.ultDesc}</i></span>
          <span class="price">✨ ${s.cost}</span>
        </button>`).join('');
    showOverlay(`
      <div class="panel shop">
        <div class="title gold">SANTUARIO</div>
        <div class="sub">Mejoras permanentes · <b class="ess">✨ ${meta.essence} de esencia</b></div>
        <div class="dim">La esencia se gana en cada partida: salas, bajas y jefes</div>
        ${schools ? `<div class="sec">Escuelas</div><div class="shop-list">${schools}</div>` : ''}
        <div class="sec">Mejoras</div>
        <div class="shop-list">${rows}</div>
        <button class="btn primary sticky" data-act="back">VOLVER</button>
      </div>`);
    restoreScroll(st);
  }

  function buyUpgrade(id) {
    const u = META_UPS.find(x => x.id === id), lv = metaLv(id);
    if (!u || lv >= u.max || meta.essence < u.cost[lv]) return;
    meta.essence -= u.cost[lv];
    meta.up[id] = lv + 1;
    saveMeta();
    Sfx.buy();
    lockUntil = performance.now() + 300;
    showShop();
  }

  function buySchool(id) {
    const s = SCHOOLS[id];
    if (!s || schoolOpen(id) || meta.essence < s.cost) return;
    meta.essence -= s.cost;
    meta.schools.push(id);
    saveMeta();
    Sfx.buy();
    lockUntil = performance.now() + 300;
    if (Object.keys(SCHOOLS).every(schoolOpen)) unlock('allSchools');
    showShop();
  }

  function calcEssence(win) {
    return Math.round(Math.max(0, room - 1) * 3 + kills * 0.4 + bossesKilled * 15 + (win ? 40 : 0));
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
    hideOverlay();
    state = 'play';
  }

  function pause() {
    if (state !== 'play') return;
    showPause();
  }
  function showPause() {
    state = 'paused';
    resetJoy();
    showOverlay(`
      <div class="panel">
        <div class="title">PAUSA</div>
        <div class="sub">${SCHOOLS[player.school].icon} ${SCHOOLS[player.school].name} · Sala ${room} · Nivel ${player.lvl} · ${Math.ceil(player.hp)}/${player.maxHp} vida</div>
        ${skillChips()}
        <div class="sec">Reacciones</div>
        ${reactionList()}
        <button class="btn primary" data-act="resume" style="margin-top:calc(var(--u)*26px)">CONTINUAR</button>
        <button class="btn ghost" data-act="settings-pause">⚙️ Ajustes</button>
        <button class="btn quit" data-act="quit">Abandonar partida</button>
      </div>`);
  }
  function resume() { if (state !== 'paused') return; hideOverlay(); state = 'play'; last = performance.now(); }
  function togglePause() { if (state === 'play') pause(); else if (state === 'paused') resume(); }

  function showEnd(win, quit = false) {
    state = win ? 'win' : 'over';
    hud(false);
    resetJoy();
    if (win) Sfx.win();
    const prev = store.get('best', null);
    const cur = { room, lvl: player.lvl, win, school: player.school };
    const better = !prev || (win && !prev.win) || (!prev.win && (room > prev.room || (room === prev.room && player.lvl > prev.lvl)));
    if (better) store.set('best', cur);
    runEssence = calcEssence(win);
    meta.essence += runEssence;
    meta.runs++;
    const S = meta.stats;
    S.essenceTotal += runEssence;
    S.best[player.school] = Math.max(S.best[player.school] || 0, win ? TOTAL_ROOMS + 1 : room);
    if (win) {
      S.wins++;
      S.winsBy[player.school] = (S.winsBy[player.school] || 0) + 1;
      unlock('firstWin');
      if (runTime < 360) unlock('speedrun');
      if (Object.keys(SCHOOLS).every(id => S.winsBy[id])) unlock('winAll');
      music('victory');
    } else if (quit) music('menu');
    saveMeta();
    const title = win ? '¡VICTORIA!' : quit ? 'PARTIDA TERMINADA' : 'HAS CAÍDO';
    const sub = win ? 'Has limpiado la mazmorra entera' : `${quit ? 'abandonaste' : 'caíste'} en la sala ${room} de ${TOTAL_ROOMS}`;
    showOverlay(`
      <div class="panel">
        <div class="title ${win ? 'gold' : 'red'}">${title}</div>
        <div class="sub">${SCHOOLS[player.school].icon} ${SCHOOLS[player.school].name} · ${sub}</div>
        <div class="earn">+✨ ${runEssence} de esencia <span>(tienes ${meta.essence})</span></div>
        <div class="stats">
          <div><span>Sala</span><b>${room}/${TOTAL_ROOMS}</b></div>
          <div><span>Nivel</span><b>${player.lvl}</b></div>
          <div><span>Bajas</span><b>${kills}</b></div>
          <div><span>Tiempo</span><b>${fmtTime(runTime)}</b></div>
        </div>
        ${better ? '<div class="newbest">¡Nuevo récord!</div>' : ''}
        ${skillChips()}
        <button class="btn primary" data-act="play" style="margin-top:calc(var(--u)*28px)">${win ? 'OTRA VEZ' : 'REINTENTAR'}</button>
        <div class="btn-row">
          <button class="btn ghost" data-act="shop">🏛️ SANTUARIO</button>
          <button class="btn ghost" data-act="menu">MENÚ</button>
        </div>
      </div>`);
  }

  overlay.addEventListener('click', e => {
    if (!backArmed && state !== 'splash' && state !== 'tap') armBack();
    const el = e.target.closest('[data-act]');
    if (!el) return;
    Sfx.init();
    const act = el.dataset.act;
    const now = performance.now(), ready = now >= lockUntil;
    if (act === 'skip') showTapToStart();
    else if (act === 'start') startFromTap();
    else if (act === 'play') { if (ready) { hideOverlay(); newRun(); } }
    else if (act === 'pick') { if (ready) pickSkill(el.dataset.id); }
    else if (act === 'school') { if (ready) pickSchool(el.dataset.id); }
    else if (act === 'altar') { if (ready) pickAltar(el.dataset.id); }
    else if (act === 'reroll') { if (ready && player.rerolls > 0) { player.rerolls--; Sfx.pick(); openLevelUp(); } }
    else if (act === 'resume') resume();
    else if (act === 'quit') { // dos toques para no perder una partida por accidente
      if (el.dataset.armed && ready) showEnd(false, true);
      else { el.dataset.armed = '1'; el.classList.add('armed'); el.textContent = '¿Seguro? Toca otra vez para abandonar'; lockUntil = now + 400; }
    }
    else if (act === 'shop') { shopFrom = state === 'school' ? 'school' : 'menu'; Sfx.click(); showShop(); lockUntil = now + 350; }
    else if (act === 'buy') { if (ready) buyUpgrade(el.dataset.id); }
    else if (act === 'buyschool') { if (ready) buySchool(el.dataset.id); }
    else if (act === 'stats') { Sfx.click(); showStats(); lockUntil = now + 350; }
    else if (act === 'settings') { Sfx.click(); showSettings('menu'); lockUntil = now + 350; }
    else if (act === 'settings-pause') { Sfx.click(); showSettings('pause'); lockUntil = now + 350; }
    else if (act === 'credits') { Sfx.click(); showCredits(state === 'settings' ? 'settings' : 'menu'); lockUntil = now + 350; }
    else if (act === 'toggle') { if (ready) toggleSetting(el.dataset.key); }
    else if (act === 'mute') { if (ready) { Sfx.init(); Sfx.setMuted(!Sfx.muted); syncMute(); Sfx.click(); showSettings(); } }
    else if (act === 'quality') { if (ready) { settings.quality = el.dataset.v; saveSettings(); applySettings(); Sfx.click(); showSettings(); } }
    else if (act === 'tutorial') { if (ready) { settings.tutorial = false; settings.ultTip = false; saveSettings(); Sfx.click(); showSettings(); } }
    else if (act === 'reset') {
      if (el.dataset.armed && ready) resetProgress();
      else { el.dataset.armed = '1'; el.classList.add('armed'); el.textContent = '¿Seguro? Se borra todo'; lockUntil = now + 400; }
    }
    else if (act === 'install') {
      if (installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; if (state === 'menu') showMenu(); }); }
    }
    else if (act === 'back') { goBack(); lockUntil = now + 350; }
    else if (act === 'menu') { Sfx.click(); showMenu(); lockUntil = now + 350; }
  });
  // deslizadores de volumen
  overlay.addEventListener('input', e => {
    const k = e.target.dataset && e.target.dataset.set;
    if (!k) return;
    settings[k] = clamp(+e.target.value / 100, 0, 1);
    saveSettings();
    Sfx.init();
    if (Sfx.muted) { Sfx.setMuted(false); syncMute(); const row = overlay.querySelector('[data-act="mute"]'); if (row) { row.querySelector('.sw').classList.add('on'); row.querySelector('.ic').textContent = '🔊'; const i = row.querySelector('i'); if (i) i.remove(); } }
    Sfx.applyVolumes();
    if (k === 'sfx') Sfx.click();
  });
  document.addEventListener('click', () => { if (state === 'tap') startFromTap(); });
  // pointerdown (no click) para que funcione con otro dedo en el joystick
  btnUlt.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Sfx.init(); castUlt(); });
  btnPause.addEventListener('click', () => { Sfx.init(); togglePause(); });
  const syncMute = () => { btnMute.textContent = Sfx.muted ? '🔇' : '🔊'; };
  btnMute.addEventListener('click', () => { Sfx.init(); Sfx.setMuted(!Sfx.muted); syncMute(); });
  syncMute();

  // Acceso para depurar desde la consola (las herramientas que modifican la partida solo con ?debug)
  window.__arcano = {
    get state() { return state; }, get room() { return room; }, get player() { return player; },
    get enemies() { return enemies; }, get bullets() { return bullets; }, get grid() { return grid; },
    get kills() { return kills; },
  };
  if (/[?&]debug\b/.test(location.search)) {
    Object.assign(window.__arcano, {
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
      pick(i = 0) { const c = overlay.querySelectorAll('[data-act="pick"],[data-act="school"]:not(.locked),[data-act="altar"]')[i]; if (c) { lockUntil = 0; c.click(); } return state; },
      ult() { player.mana = 100; castUlt(); },
      seen() { return [...seenReactions]; },
      give(id, n = 1) { for (let i = 0; i < n; i++) pickSkill(id); },
      goto(n) { room = n - 1; nextRoom(); state = 'play'; hideOverlay(); },
      toDoor() { player.x = AX + AW / 2; player.y = AY - 30; },
      god(v = true) { player.inv = v ? 1e9 : 0; },
    });
  }

  applySettings();
  if (/[?&]debug\b/.test(location.search)) showMenu(); else showSplash();
  requestAnimationFrame(frame);
})();
