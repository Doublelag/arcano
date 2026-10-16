'use strict';
(() => {
  // ================================================================
  //  Constantes
  // ================================================================
  const W = 540, H = 960;                       // resolución lógica (vertical)
  const AX = 30, AY = 128, AW = 480, AH = 800;  // arena jugable
  const CELL = 40, COLS = 12, ROWS = 20;        // rejilla de obstáculos
  const DOOR_X0 = AX + AW / 2 - 50, DOOR_X1 = AX + AW / 2 + 50;
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

  // quiet (bots de prueba): no se guarda nada ni salen avisos de logro; el progreso se restaura al acabar
  let quiet = false;
  const store = {
    get(k, d) { try { const v = localStorage.getItem('arcano.' + k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { if (quiet) return; try { localStorage.setItem('arcano.' + k, JSON.stringify(v)); } catch (_) { /* sin almacenamiento */ } },
    del(k) { try { localStorage.removeItem('arcano.' + k); } catch (_) { /* sin almacenamiento */ } },
  };

  const VERSION = '1.0';

  // Ajustes del jugador (pantalla de Ajustes)
  const SETTINGS_DEFAULT = {
    music: 0.6, sfx: 0.8, vibration: true, shake: true, dmgNumbers: true,
    lefty: false, quality: 'alta', fps: false, tutorial: false, ultTip: false, seenHz: {},
    tips: {}, // avisos únicos ya vistos (aff, opp, anima, mix)
    chapter: { id: 1, hero: false }, // capítulo y modo que relanza JUGAR (se corrige con meta.prog en fixChapter)
    seenAfx: {}, skin: 0, // afijos ya avisados · tinte de túnica elegido
  };
  const settings = Object.assign({}, SETTINGS_DEFAULT, store.get('settings', {}));
  settings.tips = Object.assign({}, typeof settings.tips === 'object' && settings.tips); // copia propia, nunca la de SETTINGS_DEFAULT
  settings.seenAfx = Object.assign({}, typeof settings.seenAfx === 'object' && settings.seenAfx);
  settings.skin = Number.isInteger(settings.skin) && settings.skin >= 0 && settings.skin < 16 ? settings.skin : 0;
  { const c = settings.chapter; settings.chapter = { id: c && Number.isInteger(c.id) && c.id >= 1 && c.id <= 9 ? c.id : 1, hero: !!(c && c.hero === true) }; }
  const saveSettings = () => store.set('settings', settings);
  const lowQ = () => settings.quality === 'baja';

  // Despertar (forms.js): si no carga, Forms() no existe y el juego queda como siempre (sin tope de elementos,
  // sin Ánima y con el dibujo de siempre). flags.noForms (depuración) hace lo mismo para comparar.
  // flags.phase2: definitivos combinados, cartas de forma y Mezclas (fase 2)
  const Forms = () => window.ArcanoForms;
  const flags = { noForms: false, phase2: true, freeze: false }; // freeze (pruebas): el bucle no avanza, solo step()
  const FX = () => (!flags.noForms && Forms()) || null;

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
    noise(dur, vol = 0.1, freq = 1500, delay = 0) {
      if (!this.ctx || this.muted) return;
      const c = this.ctx, t = c.currentTime + delay;
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
    // voz del disparo de cada forma: { f, type, slide, f2?, vol?, noise? } (comparte compuerta con shoot)
    shootV(v) {
      if (!v) return this.shoot();
      if (!this.gate('shoot', 60)) return;
      this.tone(v.f, 0.09, v.type || 'sine', v.vol || 0.05, v.slide || 1);
      if (v.f2) this.tone(v.f2, 0.09, v.type || 'sine', (v.vol || 0.05) * 0.7, v.slide || 1);
      if (v.noise) this.noise(0.03, 0.03, 6000);
    },
    react() { if (this.gate('react', 80)) { this.tone(660, 0.18, 'triangle', 0.08, 1.6); this.noise(0.15, 0.06, 3000); } },
    freeze() { this.tone(1400, 0.35, 'sine', 0.07, 0.5); this.noise(0.3, 0.06, 6000); },
    zap() { if (this.gate('zap', 50)) { this.noise(0.14, 0.14, 5000); this.tone(220, 0.12, 'sawtooth', 0.05, 0.5); } },
    whistle() { this.tone(1500, 0.7, 'sine', 0.05, 0.25); },
    plague() { this.noise(0.6, 0.1, 400); this.tone(140, 0.6, 'sawtooth', 0.06, 0.6); },
    blast() { if (this.gate('blast', 60)) { this.noise(0.35, 0.16, 700); this.tone(120, 0.3, 'sine', 0.14, 0.4); } },
    sizzle() { if (this.gate('sizzle', 120)) this.tone(900, 0.06, 'square', 0.03); }, // mecha del diablillo
    // Afinidad sellada: dos notas que se juntan y un cristal
    fuse() { this.tone(392, 0.3, 'triangle', 0.07, 1.5); this.tone(587, 0.3, 'triangle', 0.07); this.tone(1175, 0.35, 'sine', 0.05, 1, 0.18); this.noise(0.2, 0.04, 4000, 0.18); },
    // Despertar listo: tres notas (tónica, tercera y quinta) en el tono de la forma
    formReady(key = 440) { [1, 1.26, 1.5].forEach((m, i) => this.tone(key * m, 0.16, 'triangle', 0.08, 1, i * 0.08)); },
    // carga de la transformación: sierra que sube de 220 a 880 Hz en 0,9 s y tres soplos de ruido crecientes
    awakenCharge() {
      if (!this.ctx || this.muted) return;
      const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(880, t + 0.9);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.85); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
      o.connect(g); g.connect(this.sfxBus);
      o.start(t); o.stop(t + 1);
      [0, 0.3, 0.6].forEach((d, i) => this.noise(0.25, 0.03 + i * 0.03, 1500 * (i + 1), d));
    },
    // estallido: 1º despertar = acorde; 2º = arpegio de 5 notas; Eclipse = grave y arpegio menor que baja
    awakenBoom(st, key = 440, eclipse = false) {
      if (eclipse) {
        this.tone(55, 1.5, 'sine', 0.15);
        [622, 466, 370, 311].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.08, 1, i * 0.09));
      } else if (st >= 2) [1, 1.25, 1.5, 2, 2.5].forEach((m, i) => this.tone(key * m, 0.6, 'sine', 0.07, 1, i * 0.06));
      else [1, 1.5, 2].forEach(m => this.tone(key * m, 0.6, 'sine', 0.07));
      this.boom();
    },
    mix() { this.tone(990, 0.18, 'triangle', 0.08, 1.6); }, // se activa una Mezcla
    buy() { [660, 880, 1320].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.08, 1, i * 0.06)); },
    ultReady() { this.tone(880, 0.12, 'sine', 0.07); this.tone(1320, 0.2, 'sine', 0.07, 1, 0.1); },
    hit() { if (this.gate('hit', 35)) this.noise(0.05, 0.07, 2400); },
    kill() { if (this.gate('kill', 40)) { this.tone(420, 0.12, 'square', 0.05, 0.35); this.noise(0.12, 0.06, 900); } },
    hurt() { this.tone(180, 0.25, 'sawtooth', 0.12, 0.45); this.noise(0.15, 0.1, 600); },
    eshot() { if (this.gate('eshot', 70)) this.tone(330, 0.08, 'sawtooth', 0.03, 0.7); },
    gemN: 0, gemT: 0,
    gem() { // racha: cada gema seguida sube una nota y suena como una melodía
      const now = performance.now();
      if (now - this.gemT > 650) this.gemN = 0;
      this.gemT = now;
      if (!this.gate('gem', 22)) return;
      const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];
      const f = 660 * Math.pow(2, scale[Math.min(this.gemN++, scale.length - 1)] / 12);
      this.tone(f, 0.09, 'sine', 0.06);
      this.tone(f * 2, 0.05, 'triangle', 0.018);
    },
    xpFill() { if (this.gate('xpFill', 40)) this.tone(1800 + Math.random() * 400, 0.03, 'sine', 0.025); },
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
    ice:    { name: 'Criomante',    el: 'ice',    icon: '❄️', ultIcon: '🌨️', ult: 'Ventisca', desc: 'Tus hechizos ralentizan', ultDesc: 'Congela a todos y borra sus disparos; al romperse, el hielo estalla' },
    bolt:   { name: 'Electromante', el: 'bolt',   icon: '⚡', ultIcon: '🌩️', ult: 'Tormenta', desc: 'Tus hechizos electrocutan y saltan', ultDesc: 'Ocho rayos caen sobre los enemigos' },
    poison: { name: 'Pestilente',   el: 'poison', icon: '☠️', ultIcon: '☣️', ult: 'Plaga', cost: 300, desc: 'Tus hechizos envenenan', ultDesc: 'Envenena a todos: los que mueran revientan y contagian' },
    arcane: { name: 'Arcanista',    el: null, grant: { front: 1 }, icon: '🔮', ultIcon: '🌌', ult: 'Singularidad', cost: 500, desc: 'Sin elemento, pero +1 proyectil', ultDesc: 'Un agujero negro atrae a los enemigos y estalla' },
  };
  const REACTIONS = [
    { id: 'vapor',   a: 'fire', b: 'ice',    name: 'VAPOR',       color: '#e8f7ff', desc: 'Golpe de daño triple' },
    { id: 'overload', a: 'fire', b: 'bolt',  name: 'SOBRECARGA',  color: '#ffb347', desc: 'Explosión en área' },
    { id: 'freeze',  a: 'ice',  b: 'bolt',   name: 'CONGELACIÓN', color: '#9fefff', desc: 'Congela al enemigo' },
    { id: 'combust', a: 'fire', b: 'poison', name: 'COMBUSTIÓN',  color: '#c6ff5a', desc: 'Nube tóxica que contagia' },
    { id: 'corrode', a: 'bolt', b: 'poison', name: 'CORROSIÓN',   color: '#d4ff4a', desc: 'Recibe +40% de daño 4 s' },
    { id: 'necro',   a: 'ice',  b: 'poison', name: 'NECROSIS',    color: '#5fffd0', desc: 'Detona el veneno de golpe' },
  ];

  // Mejoras permanentes del Santuario (se compran con esencia entre partidas)
  const META_UPS = [
    { id: 'vida',   icon: '❤️', name: 'Vitalidad eterna', desc: '+10 de vida máxima',                max: 5, cost: [40, 80, 140, 220, 320] },
    { id: 'poder',  icon: '💥', name: 'Poder ancestral',  desc: '+6% de daño',                       max: 5, cost: [60, 120, 200, 300, 420] },
    { id: 'mana',   icon: '💠', name: 'Reserva de maná',  desc: '+15 de maná al empezar',            max: 4, cost: [40, 80, 140, 220] },
    { id: 'sabio',  icon: '📜', name: 'Sabiduría',        desc: '+10% de experiencia',               max: 3, cost: [70, 150, 260] },
    { id: 'suerte', icon: '🍀', name: 'Suerte',           desc: '+1 cambio de cartas por partida',   max: 3, cost: [60, 130, 220] },
    { id: 'paso',   icon: '👟', name: 'Paso ligero',      desc: '+4% de velocidad',                  max: 3, cost: [50, 110, 180] },
    { id: 'fenix',  icon: '🕊️', name: 'Pluma de fénix',   desc: 'Revives una vez por partida con 50% de vida', max: 1, cost: [500] },
  ];

  // Trampas del suelo: solo dañan al jugador
  const HZ = { SPIKES: 1, POISON: 2, ICE: 3, LAVA: 4 };
  const HZ_INFO = {
    1: { name: '¡PINCHOS!', tip: 'Suben y bajan: crúzalos cuando estén escondidos', color: '#d8d8e8' },
    2: { name: '¡CHARCO VENENOSO!', tip: 'Te ralentiza mientras lo pisas', color: '#b06bff' },
    3: { name: '¡HIELO!', tip: 'Resbala: frenas y giras más despacio', color: '#9fe8ff' },
    4: { name: '¡LAVA!', tip: 'Quema mientras la pisas', color: '#ff8a3d' },
  };
  const BIOME_HAZARD = { pradera: 0, cripta: HZ.POISON, cristal: HZ.ICE, volcan: HZ.LAVA };

  // Logros: dan esencia al desbloquearse
  const ACHIEVEMENTS = [
    { id: 'firstUlt',    icon: '✨', name: 'Primer conjuro',      desc: 'Lanza tu primer hechizo definitivo',     reward: 5 },
    { id: 'boss1',       icon: '🗿', name: 'Rompepiedras',        desc: 'Derrota al Gólem de Piedra',             reward: 10 },
    { id: 'room10',      icon: '🚪', name: 'Explorador',          desc: 'Llega a la sala 10',                     reward: 10 },
    { id: 'boss2',       icon: '👑', name: 'Regicida viscoso',    desc: 'Derrota al Rey Slime',                   reward: 15 },
    { id: 'boss3',       icon: '🌙', name: 'Duelo de magos',      desc: 'Derrota al Brujo Sombrío',               reward: 20 },
    { id: 'boss4',       icon: '😈', name: 'Señor de nada',       desc: 'Derrota al Señor de la Mazmorra',        reward: 30 },
    { id: 'firstWin',    icon: '🏆', name: 'Archimago',           desc: 'Completa la mazmorra',                   reward: 50 },
    { id: 'reactAll',    icon: '⚗️', name: 'Alquimista',          desc: 'Provoca las 6 reacciones elementales',   reward: 20 },
    { id: 'react50',     icon: '💥', name: 'Reacción en cadena',  desc: '50 reacciones en una sola partida',      reward: 20 },
    { id: 'untouchable', icon: '🛡️', name: 'Intocable',           desc: 'Derrota a un jefe sin recibir daño',     reward: 25 },
    { id: 'lvl15',       icon: '📈', name: 'Erudito',             desc: 'Alcanza el nivel 15 en una partida',     reward: 15 },
    { id: 'phoenix',     icon: '🕊️', name: 'Renacido',            desc: 'Vuelve a la vida con la pluma de fénix', reward: 10 },
    { id: 'elites',      icon: '⭐', name: 'Cazaélites',          desc: 'Derrota a 25 enemigos élite en total',   reward: 20 },
    { id: 'kills1000',   icon: '💀', name: 'Exterminador',        desc: 'Derrota a 1000 enemigos en total',       reward: 30 },
    { id: 'allSchools',  icon: '📚', name: 'Biblioteca completa', desc: 'Desbloquea todas las escuelas',          reward: 25 },
    { id: 'speedrun',    icon: '⏱️', name: 'Contrarreloj',        desc: 'Gana en menos de 4 min 30 s',             reward: 40 },
    { id: 'winAll',      icon: '🌈', name: 'Maestro de escuelas', desc: 'Gana con las 5 escuelas',                reward: 75 },
    { id: 'chests',      icon: '🗝️', name: 'Cazatesoros',         desc: 'Abre 5 cofres en total',                 reward: 15 },
    { id: 'pact',        icon: '😈', name: 'Trato hecho',         desc: 'Sella un pacto oscuro en un altar',      reward: 10 },
    // Despertar: se cobran una sola vez (100 de esencia en total)
    { id: 'awaken1',     icon: '🌅', name: 'Despertar',           desc: 'Despierta una forma por primera vez',    reward: 5, forms: true },
    { id: 'awaken2',     icon: '🔆', name: 'Alma doble',          desc: 'Alcanza una forma combinada',            reward: 10, forms: true },
    { id: 'hybrids',     icon: '🧭', name: 'Cuatro caminos',      desc: 'Descubre las 4 formas híbridas',         reward: 15, forms: true },
    { id: 'eclipse',     icon: '🌑', name: 'Equilibrio roto',     desc: 'Despierta la forma prohibida',           reward: 15, forms: true },
    { id: 'forms10',     icon: '📖', name: 'Grimorio de formas',  desc: 'Descubre las 10 formas',                 reward: 25, forms: true },
    { id: 'formWins',    icon: '🎭', name: 'Mil caras',           desc: 'Gana con las 5 formas combinadas',       reward: 20, forms: true },
    { id: 'mixes8',      icon: '🧪', name: 'Mezclador',           desc: 'Descubre las 8 Mezclas',                 reward: 10, forms: true },
  ];
  const achList = () => ACHIEVEMENTS.filter(a => !a.forms || FX()); // sin forms.js, los del Despertar ni se cuentan ni se enseñan

  // ================================================================
  //  Capítulos (chapters.js): datos y fórmulas puras (sin Math.random). CH = capítulo de la partida (resuelto),
  //  HEROIC = Modo Héroe. Sin chapters.js, CH_FALLBACK: el Capítulo 1 de siempre embebido y las mismas fórmulas.
  // ================================================================
  const Chapters = () => window.ArcanoChapters;
  const CH_FALLBACK = (() => {
    const BOSSES = { // las salas de jefe del C1 v1.1 (modelo, logro y arena van con el modelo)
      5:  { model: 'golem', ach: 'boss1', arena: 'golem', tier: 1, title: 'Guardián de la pradera', name: 'Gólem de Piedra', hp: 624, r: 40, speed: 55, color: '#8f8270', bullet: '#ff4d6d', pats: ['ring', 'charge', 'aimed'] },
      10: { model: 'rey', ach: 'boss2', arena: 'rey', tier: 2, title: 'Monarca de la cripta', name: 'Rey Slime', hp: 1725, r: 42, speed: 65, color: '#57c75e', bullet: '#ff5a7a', pats: ['summon', 'ring', 'charge', 'aimed'] },
      15: { model: 'brujo', ach: 'boss3', arena: 'brujo', tier: 3, title: 'Tirano de la gruta helada', name: 'Brujo Sombrío', hp: 3900, r: 34, speed: 45, color: '#6d4bd8', bullet: '#ff5aa0', pats: ['spiral', 'teleport', 'aimed', 'summon', 'ring'] },
      20: { model: 'senor', ach: 'boss4', arena: 'senor', tier: 4, title: 'Corazón del volcán', name: 'Señor de la Mazmorra', hp: 5640, r: 44, speed: 70, color: '#d63c3c', bullet: '#ff2e63', pats: ['spiral', 'charge', 'ring', 'summon', 'teleport', 'aimed'], final: true },
    };
    const ch = {
      id: 1, name: 'La Mazmorra', short: 'Mazmorra', len: 20, hero: false, k: 0, altars: [4, 9, 14, 19], tint: null, enemyTint: null,
      ENEMY_UNLOCK: { slime: 1, bat: 1, archer: 2, charger: 3, mage: 4, bigslime: 6, bomber: 6, totem: 7, spirit: 11 }, // sala a partir de la que aparece cada enemigo
      nets: { a: 1, b: 2, c: 3 }, markRoom: 6, stars: [7, 14], speedrun: 270, warn: { aimed: 0.35, early: true },
      spawnStep: 0.04, anima: [110, 175], waves: [6, 7, 8, 11, 12, 13, 16, 17, 18],
      foe: { archer: { sp: [295, 5], cd: [0.9, 1.6] }, mage: { sp: [175, 4], cd: [2.0, 3.0] }, totem: { sp: [160, 4], cd: [1.15, 0.9] }, spirit: { sp: [220, 2] },
        speed: { slime: 90, bigslime: 62, bat: 122, bomber: 112 }, batZig: 0.675, dash: 540, rest: 0.45, ring: 185 },
    };
    const HEAL = { boss: 0.10, bossHearts: 1, heart: 0.04, eliteHeart: 0.20, heartVal: 0.12, chest: 0.10, altar: 0.5, fullAt: 0.95, autoHearts: false };
    const api = {
      lastRoom: c => c.len,
      bossAt: (c, r) => (BOSSES[r] ? Object.assign({}, BOSSES[r], { pats: BOSSES[r].pats.slice(), ord: r / 5, final: !!BOSSES[r].final }) : null),
      bossRooms: () => [5, 10, 15, 20],
      altarAt: (c, r) => c.altars.includes(r),
      zoneAt: (c, r) => Math.min(3, Math.ceil(r / 5) - 1),
      biomeAt: (c, r) => (r <= 5 ? 'pradera' : r <= 10 ? 'cripta' : r <= 15 ? 'cristal' : 'volcan'),
      zoneStart: (c, r) => r % 5 === 1,
      hpMul: (c, h, r) => 1 + 0.2 * (r - 1) + 0.006 * (r - 1) * (r - 1),
      dmgMul: (c, h, r) => 1 + 0.07 * (r - 1),
      enemyLv: (c, h, r) => r,
      budget: (c, h, r) => ({ budget: (4.5 + r * 0.75) * (r <= 3 ? 0.85 : 1), maxN: 14, caps: { totem: 2, spirit: 3, bomber: 3, bigslime: 2, mage: 4 },
        pool: Object.keys(c.ENEMY_UNLOCK).filter(k => r >= c.ENEMY_UNLOCK[k]), threat: r >= 6 ? { p: 0.65, light: ['slime', 'bat'] } : null }),
      firstAttack: (c, h, r) => (r <= 3 ? [0.6, 1.6] : [0.35, 1.0]),
      spawnDist: (c, r) => (r <= 3 ? 280 : 220),
      eliteParams: (c, h, r) => ({ p: r < 6 ? 0 : 0.18 + r * 0.008, max: 2, affixes: [], dual: 0, hp: 2.0 }),
      wavesAt: (c, h, r) => (c.waves.includes(r) ? { share: 0.4, at: 0.3 } : null),
      hazard: () => ({ from: 3, chance: 0.6, n: [2, 3], special: 0.55, arenaK: 1 }),
      chest: () => ({ from: 2, p: 0.2, max: 3 }),
      heal: () => Object.assign({}, HEAL),
      lootDepth: (c, h, r, add = 0) => Math.min(20, r + add),
      nets: c => Object.assign({}, c.nets),
      markRoom: c => c.markRoom,
    };
    return { ch, api };
  })();
  const CHA = () => Chapters() || CH_FALLBACK.api;
  // capítulo resuelto (id, Héroe); si no existe, el Capítulo 1
  const resolveCH = (id, hero) => (Chapters() && (Chapters().get(id, hero) || Chapters().get(1, false))) || CH_FALLBACK.ch;
  // el capítulo de la próxima partida es settings.chapter; chForce (?debug) deja jugar uno cerrado
  let chForce = false;
  let CH = resolveCH(1, false), HEROIC = false;
  const lastRoom = () => CH.len;
  const bossAt = r => CHA().bossAt(CH, r);
  const altarAt = r => CHA().altarAt(CH, r);
  const biomeAt = r => CHA().biomeAt(CH, Math.max(1, r));
  const healCfg = () => CHA().heal(CH, HEROIC);
  const foeCfg = () => CH.foe || CH_FALLBACK.ch.foe; // ritmo de los enemigos (§4.4)
  // Ánima para despertar (1º, 2º): la del capítulo o, sin ella, la de forms.js
  const animaNeed = i => (CH.anima ? CH.anima[i] : FX().ANIMA.need[i]);


  const SKILLS = [
    { id: 'front',    icon: '🔮', name: 'Proyectil extra',  max: 3, w: 1.1, desc: '+1 proyectil hacia delante (−15% daño cada uno)' },
    { id: 'multi',    icon: '🔁', name: 'Eco arcano',       max: 3, w: 1.1, desc: 'El hechizo se repite justo después (−13% daño)' },
    { id: 'diag',     icon: '↗️', name: 'Abanico',          max: 2, w: 1,   desc: '+2 proyectiles en diagonal' },
    { id: 'side',     icon: '↔️', name: 'Orbes laterales',  max: 1, w: 0.8, desc: '+2 proyectiles a los lados' },
    { id: 'rear',     icon: '↩️', name: 'Guardia trasera',  max: 1, w: 0.8, desc: '+1 proyectil hacia atrás' },
    { id: 'ricochet', icon: '🔀', name: 'Salto arcano',     max: 2, w: 1,   desc: 'Los proyectiles saltan a 2 enemigos más (−25% por salto)' },
    { id: 'pierce',   icon: '💫', name: 'Lanza de éter',    max: 2, w: 1,   desc: 'Los proyectiles atraviesan 1 enemigo más (−25% por enemigo)' },
    { id: 'wall',     icon: '↪️', name: 'Rebote',           max: 2, w: 0.9, desc: 'Los proyectiles rebotan 2 veces en muros y rocas (−40% por rebote)' },
    { id: 'atk',      icon: '💥', name: 'Poder +25%',       max: 6, w: 1,   desc: 'Más daño en todos tus hechizos' },
    { id: 'atkspd',   icon: '⏱️', name: 'Celeridad',        max: 5, w: 1,   desc: '+22% de velocidad de lanzamiento' },
    { id: 'crit',     icon: '🎯', name: 'Concentración',    max: 4, w: 0.9, desc: '+10% prob. de crítico y +25% daño crítico' },
    { id: 'hp',       icon: '❤️', name: 'Vitalidad',        max: 5, w: 0.9, desc: '+25 de vida máxima y te cura 25' },
    { id: 'heal',     icon: '⚗️', name: 'Poción',           max: 99, w: 1.0, desc: 'Recuperas el 35% de la vida', cond: () => player.hp < player.maxHp * 0.6 },
    { id: 'fire',     icon: '🔥', name: 'Runa de fuego',    max: 2, w: 1.1, el: true, desc: 'Tus hechizos queman durante 2,5 s' },
    { id: 'ice',      icon: '❄️', name: 'Runa de hielo',    max: 2, w: 1.1, el: true, desc: 'Tus hechizos ralentizan a los enemigos' },
    { id: 'bolt',     icon: '⚡', name: 'Runa de rayo',     max: 2, w: 1.1, el: true, desc: 'Electrocutan y a veces saltan a 2 enemigos' },
    { id: 'poison',   icon: '☠️', name: 'Runa de veneno',   max: 2, w: 1,   el: true, desc: 'Daño continuo que se acumula con cada impacto' },
    { id: 'orbs',     icon: '🌀', name: 'Orbes guardianes', max: 3, w: 0.9, desc: 'Un orbe gira a tu alrededor y daña al contacto' },
    { id: 'blood',    icon: '🦇', name: 'Drenar vida',      max: 3, w: 0.8, desc: 'Cada baja te cura un 1,5% de la vida máxima' },
    { id: 'channel',  icon: '💠', name: 'Canalización',     max: 2, w: 0.9, desc: 'Tu hechizo definitivo se carga un 35% más rápido' },
    { id: 'speed',    icon: '👟', name: 'Botas ligeras',    max: 2, w: 0.8, desc: '+12% de velocidad de movimiento' },
    { id: 'dodge',    icon: '💨', name: 'Parpadeo',         max: 3, w: 0.8, desc: '+8% de probabilidad de esquivar golpes' },
  ];
  // cartas de forma (fase 2): solo salen en su forma
  if (window.ArcanoForms) for (const c of window.ArcanoForms.cards()) SKILLS.push(Object.assign({}, c, { cond: () => flags.phase2 && !!player && player.form === c.form }));
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
  const hz = new Uint8Array(COLS * ROWS), hzOff = new Float32Array(COLS * ROWS); // trampas del suelo
  let hzClock = 0;
  let chest = null, chestsThisRun = 0, runBonusEss = 0, pickSource = 'level';
  let runLoot = [], lostLoot = 0; // objetos de equipo conseguidos (o perdidos por no caber) en la partida
  let bonusPicks = []; // elecciones de habilidad que no suben de nivel: 'chest' | 'pact' | 'bless'
  let cine = null; // entrada cinematográfica del jefe
  // HUD animado: la barra de experiencia se llena con retraso y con chispas que vuelan hasta ella
  const hudFx = { xpShow: 0, lvlShow: 1, hold: 0, flash: 0, pulse: 0, wait: 0 };
  let flyers = [], hudParts = [];
  let tut = null;                                     // tutorial de la primera partida
  let fps = 60, fpsAcc = 0, fpsN = 0;
  let slowT = 0; // cámara lenta (al matar a un jefe)
  const seenReactions = new Set();
  // Despertar: cinemática, esquirlas de Eclipse, espera de la oferta, música retenida, cola de avisos, charcos...
  let awakenFx = null, eclipseFx = null, awakenWait = 0, musicHoldT = 0, toastQ = [], bannerNext = null, flashNext = null;
  let pools = [], amb = [], ash = [], pactRun = false, roomReactA = 0, ambT = 0, fxDepth = 0, netLog = [];
  let waveQ = [], wave1N = 0, waveAt = 0.3; // refuerzos pendientes de la sala (§4.5)
  let curtains = [], fog = null; // definitivos combinados: columnas de Cortina boreal y niebla de Invierno negro
  const seenMixes = new Set();   // Mezclas ya anunciadas en esta partida
  let runGrim0 = null; // páginas del Grimorio al empezar la partida (para "Nueva página" en el final)
  let runProg = null;  // lo nuevo de meta.prog en esta partida (estrellas, desbloqueos, récord): lo pinta el final (fase 6)

  const dmgMul = () => CHA().dmgMul(CH, HEROIC, room);
  const xpNeed = lvl => 6 + (lvl - 1) * 5;

  // progreso permanente: esencia, mejoras compradas y escuelas desbloqueadas
  const META_DEFAULT = () => ({
    essence: 0, up: {}, schools: ['fire', 'ice', 'bolt'], runs: 0, ach: {}, gear: { inv: [], eq: {}, next: 1 },
    stats: { kills: 0, wins: 0, bosses: 0, elites: 0, reactions: 0, ults: 0, time: 0, essenceTotal: 0, chests: 0, pacts: 0, best: {}, winsBy: {}, reactSeen: {} },
    // Grimorio: f = formas descubiertas, w = ganadas, e = despertadas pronto, m = Mezclas (máscaras de bits);
    // n = despertares por forma (10 dígitos, tope 9); k = [suma sala 1º, nº 1º, suma sala 2º, nº 2º]; t = título elegido
    grim: { f: 1, w: 0, e: 0, m: 0, n: '0000000000', k: [0, 0, 0, 0], t: -1 },
    // capítulos (chapters.js): n = Normal más alto abierto, d / h = completados (bits), st = estrellas, b = récords, t = título, af = afijos
    prog: Chapters() ? Chapters().PROG_DEFAULT() : { n: 1, d: 0, h: 0, st: '00000000', b: {}, t: -1, af: 0 },
  });
  // la cookie lleva el Grimorio compacto: "f.w.e.m.n.k0-k1-k2-k3.t" (sin comillas ni llaves que codificar)
  const grimPack = g => [g.f, g.w, g.e, g.m, g.n, g.k.map(Math.round).join('-'), g.t].join('.');
  function grimUnpack(s) {
    const [f, w, e, m, n, k, t] = String(s).split('.');
    return { f: +f, w: +w, e: +e, m: +m, n, k: String(k || '').split('-').map(Number), t: +t };
  }
  function grimValid(src) { // tipos seguros aunque el guardado venga roto o de otra versión
    const g = META_DEFAULT().grim, s = src && typeof src === 'object' ? src : {};
    for (const k of ['f', 'w', 'e', 'm']) if (Number.isInteger(s[k]) && s[k] >= 0) g[k] = s[k];
    g.f |= 1; // el Aprendiz siempre está descubierto
    if (typeof s.n === 'string' && /^\d{10}$/.test(s.n)) g.n = s.n;
    if (Array.isArray(s.k) && s.k.length === 4 && s.k.every(v => Number.isFinite(v) && v >= 0)) g.k = s.k.slice();
    if (Number.isInteger(s.t) && s.t >= -1 && s.t < 10) g.t = s.t;
    return g;
  }
  const meta = loadMeta();
  function loadMeta() {
    let saved = store.get('meta', null);
    if (!saved) { // sin progreso en este almacenamiento: probamos la copia de la cookie
      try {
        const m = document.cookie.match(/(?:^|; )arcano_meta=([^;]*)/);
        if (m) saved = JSON.parse(decodeURIComponent(m[1]));
        if (saved && saved.gear && typeof saved.gear.inv === 'string') { // copia compacta del equipo
          saved.gear.inv = saved.gear.inv ? saved.gear.inv.split(',').map(t => { const [u, b, r] = t.split('.'); return { uid: +u, base: b, r: +r }; }) : [];
        }
      } catch (_) { saved = null; }
    }
    const d = META_DEFAULT(), s = saved || {};
    const m = Object.assign(d, s);
    m.up = Object.assign({}, s.up);
    m.ach = Object.assign({}, s.ach);
    const sg = s.gear || {}; // equipo: inventario, huecos equipados y contador de ids
    m.gear = { inv: Array.isArray(sg.inv) ? sg.inv.filter(it => it && it.uid != null && it.base) : [], eq: Object.assign({}, sg.eq), next: 1 };
    m.gear.next = Math.max(sg.next > 0 ? sg.next : 1, 1 + m.gear.inv.reduce((a, it) => Math.max(a, +it.uid || 0), 0));
    for (const k of Object.keys(m.gear.eq)) if (!m.gear.inv.some(it => it.uid === m.gear.eq[k])) delete m.gear.eq[k];
    m.schools = Array.isArray(s.schools) ? [...new Set(['fire', 'ice', 'bolt', ...s.schools])].filter(id => SCHOOLS[id]) : d.schools;
    m.stats = Object.assign(META_DEFAULT().stats, s.stats);
    for (const k of ['best', 'winsBy', 'reactSeen']) m.stats[k] = Object.assign({}, s.stats && s.stats[k]);
    m.grim = grimValid(typeof s.grim === 'string' ? grimUnpack(s.grim) : s.grim); // un guardado antiguo carga el de por defecto
    const C = Chapters(); // sin chapters.js, prog se queda tal cual venga (para no perderlo)
    if (C) {
      if (typeof s.prog === 'string') m.prog = C.progUnpack(s.prog); // copia compacta de la cookie
      else if (s.prog && typeof s.prog === 'object') m.prog = C.progValid(s.prog);
      else m.prog = C.migrate({ stats: m.stats }, store.get('best', null)); // guardado de antes de los capítulos
      progRebuild(m);
    }
    if (!(m.essence >= 0)) m.essence = 0;
    return m;
  }
  // récord 'room.len.lvl.win.time.school': victoria > sala > nivel; entre victorias, menos tiempo (0 = sin tiempo, el peor)
  function recRank(r) { const [rm, , lv, w, t] = String(r).split('.').map(Number); return w ? 2e6 + (t > 0 ? 1e5 - t : 0) : rm * 100 + lv; }
  // récords de capítulo que faltan (la cookie los suelta si no caben): se rehacen desde S.best, sin nivel ni tiempo
  function progRebuild(m) {
    const C = Chapters(), b = m.prog.b, add = {};
    for (const [school, v] of Object.entries(m.stats.best)) {
      if (!SCHOOLS[school] || !(v > 0)) continue;
      const d = C.decodeBest(v), c = C.get(d.ch, false), key = d.ch + (d.hero ? 'h' : '');
      if (!c || b[key] || !(d.win || d.room > 0)) continue;
      const rec = [d.win ? c.len : Math.min(d.room, c.len), c.len, 0, d.win ? 1 : 0, 0, school].join('.');
      if (!add[key] || recRank(rec) > recRank(add[key])) add[key] = rec;
    }
    Object.assign(b, add);
  }
  // copia para la cookie (no admite más de ~4 KB): equipo y Grimorio van compactos; si aun así no cabe, el equipo se queda fuera
  // prog va compacto ("n.d.h.st.t.af|1:…"); si no cabe sale primero el equipo, después los récords de capítulo (se rehacen desde S.best)
  function cookieValue() {
    const inv = meta.gear.inv.map(it => `${it.uid}.${it.base}.${it.r}`).join(',');
    const grim = grimPack(meta.grim), C = Chapters();
    const prog = C ? C.progPack(meta.prog) : meta.prog, progNoB = C ? C.progPack(Object.assign({}, meta.prog, { b: {} })) : prog;
    const enc = o => encodeURIComponent(JSON.stringify(Object.assign({}, meta, o)));
    let v = enc({ gear: { inv, eq: meta.gear.eq, next: meta.gear.next }, grim, prog });
    if (v.length > 3800) v = enc({ gear: undefined, grim, prog });
    if (v.length > 3800) v = enc({ gear: undefined, grim, prog: progNoB });
    return v.length <= 3800 ? v : '';
  }
  function saveMeta() {
    if (quiet) return;
    store.set('meta', meta);
    try {
      const v = cookieValue();
      if (v) document.cookie = 'arcano_meta=' + v + ';max-age=31536000;path=/;SameSite=Lax';
    } catch (_) { /* sin cookies */ }
  }
  const metaLv = id => meta.up[id] || 0;
  const schoolOpen = id => meta.schools.includes(id);

  // ---------- Capítulos: qué está abierto, estrellas y récords (meta.prog) ----------
  // sin chapters.js solo existe el Capítulo 1 Normal
  const chOpen = (id, hero) => (Chapters() ? !!Chapters().get(id, false) && Chapters().isUnlocked(meta.prog, id, hero) : id === 1 && !hero);
  // settings.chapter apuntando a un capítulo cerrado (o que ya no existe) → el Normal más alto abierto
  function fixChapter() {
    const c = settings.chapter;
    if (chOpen(c.id, c.hero)) return;
    let id = Math.max(1, Math.min(meta.prog.n | 0, 9));
    while (id > 1 && !chOpen(id, false)) id--;
    settings.chapter = { id, hero: false };
    saveSettings();
  }
  fixChapter();
  // JUGAR desde el selector de capítulos (fase 6): fija y guarda el capítulo y va al selector de escuela
  function startChapter(id, hero) {
    settings.chapter = { id, hero: !!hero }; chForce = false;
    fixChapter(); saveSettings();
    newRun();
  }
  // estrellas del capítulo y modo en curso hasta esta sala (cuentan aunque mueras); devuelve las nuevas o 0
  function progStars(win) {
    const C = Chapters();
    if (!C || !player) return 0;
    const P = meta.prog, i = CH.id - 1 + (HEROIC ? 4 : 0), had = +P.st[i] || 0, got = C.starsFor(CH, room, win);
    if (i > 7 || got <= had) return 0;
    P.st = P.st.slice(0, i) + got + P.st.slice(i + 1);
    return got;
  }
  // final de partida: estrellas, completados, capítulo siguiente y récord del capítulo y modo; devuelve lo nuevo (para el final)
  function progEnd(win) {
    const C = Chapters();
    if (!C || !player) return null;
    const P = meta.prog, bit = 1 << (CH.id - 1), was = { n: P.n, hero: C.heroOpen(P) }, key = CH.id + (HEROIC ? 'h' : '');
    const out = { stars: progStars(win), first: false, unlock: [], record: false };
    if (win) {
      if (HEROIC) { out.first = !(P.h & bit); P.h |= bit; }
      else { out.first = !(P.d & bit); P.d |= bit; P.n = Math.max(P.n, Math.min(C.MAX_CH, CH.id + 1)); }
    }
    if (C.get(CH.id + 1, false) && C.isUnlocked(P, CH.id + 1, false) && was.n < CH.id + 1) out.unlock.push({ id: CH.id + 1, hero: false });
    if (!was.hero && C.heroOpen(P)) out.unlock.push({ id: 1, hero: true });
    const rec = [win ? CH.len : Math.min(room, CH.len), CH.len, Math.min(99, player.lvl), win ? 1 : 0, win ? Math.min(99999, Math.round(runTime)) : 0, player.school].join('.');
    if (!P.b[key] || recRank(rec) > recRank(P.b[key])) { P.b[key] = rec; out.record = true; }
    return out;
  }
  // S.best[escuela]: el C1 Normal se guarda como siempre (1-20 sala, 21 victoria); el resto con encodeBest
  const bestCode = win => (!Chapters() || (CH.id === 1 && !HEROIC) ? (win ? CH.len + 1 : room) : Chapters().encodeBest(CH, HEROIC, room, win));
  const bestRank = v => (Chapters() ? Chapters().bestRank(v) : v);

  // ---------- Equipo (lógica en equipment.js) ----------
  const Gear = () => window.ArcanoGear;
  const GEAR_MAX = 60;
  const EMPTY_GEAR = { atkPct: 0, hpFlat: 0, critPct: 0, rateP: 0, speedP: 0, dodgeP: 0, manaStart: 0, xpPct: 0, perks: {} };
  const gearItem = uid => meta.gear.inv.find(it => it.uid === uid);
  const isEquipped = uid => Object.values(meta.gear.eq).includes(uid);
  const equippedList = () => Object.values(meta.gear.eq).map(gearItem).filter(Boolean);
  function gearStats() {
    try { return (Gear() && Gear().statsOf(equippedList())) || EMPTY_GEAR; } catch (_) { return EMPTY_GEAR; }
  }
  function addGear(drop) { // devuelve el objeto añadido o null si no cabe
    if (!Gear() || !drop || meta.gear.inv.length >= GEAR_MAX) return null;
    const it = Gear().makeItem(drop.base, drop.r, meta.gear.next++);
    if (it) meta.gear.inv.push(it);
    return it;
  }
  const perkLv = id => (player && player.gear && player.gear.perks[id]) || 0;

  // ---------- Logros: aviso flotante que funciona en cualquier pantalla ----------
  const achEl = document.createElement('div');
  achEl.id = 'achToast';
  wrap.appendChild(achEl);
  const achQueue = [];
  let achBusy = false, achCur = null, achT0 = 0, achTimer = 0, achAgain = false; // achAgain: el siguiente es uno que se cortó (vuelve sin sonido)
  function unlock(id) {
    if (meta.ach[id]) return;
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (!a) return;
    meta.ach[id] = true;
    meta.essence += a.reward;
    meta.stats.essenceTotal += a.reward;
    saveMeta();
    if (quiet) return;
    achQueue.push(a);
    nextAch();
  }
  // el despertar es del mago: el logro espera mientras se ofrece el panel (o está a punto), en la transformación y mientras se ve el nombre de la forma
  const achHold = () => !!player && (state === 'levelup' ? pickSource === 'awaken' : state === 'play' && (!!awakenFx || !!(banner && banner.form) || awakenDue()));
  function nextAch() {
    if (achBusy || !achQueue.length || achHold()) return; // update vuelve a llamar cuando se acaba la retención
    const a = achQueue.shift();
    achBusy = true;
    achEl.innerHTML = `<span class="ic">${a.icon}</span><span class="tx"><b>¡Logro desbloqueado!</b>${a.name}</span><span class="rw">+✨ ${a.reward}</span>`;
    achEl.classList.toggle('low', state === 'win' || state === 'over'); // pantalla final: abajo, sin tapar el emblema ni la Marca II
    achEl.classList.add('show');
    if (achAgain) achAgain = false; else Sfx.ach(); // el que vuelve ya sonó
    achCur = a; achT0 = performance.now();
    achTimer = setTimeout(achOut, 2600);
  }
  function achOut() {
    achEl.classList.remove('show'); achCur = null;
    achTimer = setTimeout(() => { achBusy = false; nextAch(); }, 350);
  }
  // se abre el panel del despertar: el logro que se ve se aparta para no taparlo (si apenas se ha leído, vuelve después)
  function achYield() {
    if (!achCur) return;
    clearTimeout(achTimer);
    if (performance.now() - achT0 < 1500) { achQueue.unshift(achCur); achAgain = true; }
    achOut();
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
  function tutStart() { tut = settings.tutorial || CH.id !== 1 || HEROIC ? null : { step: 'move', t: 0 }; } // solo en el C1 Normal
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
    if (e.code === 'Escape' && state === 'levelup' && pickSource === 'awaken') awakenLater(); // Escape = "Aún no"
    else if (e.code === 'Escape' || e.code === 'KeyP') {
      if (state === 'play' || state === 'paused') togglePause();
      else if (['settings', 'credits', 'stats', 'shop', 'gear', 'item', 'grimoire'].includes(state)) goBack();
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
    fixChapter();
    if (state === 'menu') showMenu(); else if (state === 'shop') showShop(); else if (state === 'stats') showStats(); else if (state === 'grimoire') showGrimoire();
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
    const gear = gearStats();
    const hp = 100 + 10 * metaLv('vida') + gear.hpFlat; // Santuario + equipo
    return {
      gear,
      x: AX + AW / 2, y: AY + AH - 50, r: 15, hp, maxHp: hp, lvl: 1, xp: 0, sk: {},
      atk: 10, rate: 1.5, crit: 0.05, critMul: 2, speed: 190, dodge: 0,
      cd: 0, still: 0, inv: 0, face: -Math.PI / 2, moving: false, orbA: 0, walkT: 0,
      school: 'fire', mana: Math.min(100, 30 + 15 * metaLv('mana') + gear.manaStart), castFx: 0,
      revives: metaLv('fenix'), rerolls: metaLv('suerte'), shield: 0, vx: 0, vy: 0, trapCd: 0,
      tr: {},      // rasgos de la forma despertada (vacío = valores de siempre)
      god: false,  // solo depuración: inmune a todo, también a las trampas
      // Despertar: forma, núcleo y 2º elemento, Afinidad (máx. 2 elementos), despertares y Ánima
      form: 'aprendiz', core: null, second: null, aff: [], awak: 0, anima: 0, animaReady: false, awkLock: false,
      snoozeRoom: -1, fusedLv: 0, lev: 0, shroudT: 0, mixes: [], mixM: {}, haloT: 2, ringT: 0, // mixM: id → multiplicador (1 o 1,25)
      sty: null, styEcho: null, shotEls: [], shotCol: EL.arcane.color, shotCol2: null, // estilo del disparo (refreshStyle)
    };
  }

  // ---------- Maná y hechizo definitivo ----------
  function gainMana(v) {
    if (!player || player.mana >= 100) return;
    player.mana = Math.min(100, player.mana + v * (1 + 0.35 * (player.sk.channel || 0)) * (1 + 0.4 * perkLv('manaRegen')));
    if (player.mana >= 100) { Sfx.ultReady(); addText(player.x, player.y - 50, '¡DEFINITIVO LISTO!', ultColor(), 0.8); }
  }

  // Congelar. Los jefes tienen rendimientos decrecientes: tras cada congelación quedan inmunes
  // (frzImm = duración + FRZ_DR) salvo a lo que fuerza (definitivos). Devuelve si se ha congelado.
  // FRZ_DR era 2 s; con 3 los núcleos de hielo con definitivo bajan del 35% del combate congelado (balance con bots)
  const FRZ_DR = 3;
  function freezeEnemy(e, t, tb, force) {
    if (e.kind === 'boss') {
      if (e.frzImm > 0 && !force) return false;
      e.frozen = tb; e.frzImm = tb + FRZ_DR;
    } else e.frozen = Math.max(e.frozen, t);
    unfade(e);
    return true;
  }

  // Fichas: topes de efectos en cadena (estallidos, arcos...) que se recargan solas
  const TOK_MAX = { blast: 3, arc: 5, implode: 6, comet: 6, spark: 4, shard: 1 };
  const TOK_RATE = { blast: 10, arc: 5, implode: 6, comet: 6, spark: 4, shard: 1 / 0.15 }; // por segundo
  const tok = Object.assign({}, TOK_MAX);
  const takeTok = k => tok[k] >= 1 ? (tok[k]--, true) : false;
  function rechargeTok(dt) { for (const k in TOK_MAX) tok[k] = Math.min(TOK_MAX[k], tok[k] + TOK_RATE[k] * dt); }

  // Proyectil secundario (esquirlas, divisiones): nofx = no reacciona, no encadena, no activa rasgos ni crea más.
  // Se apila en shotQ y entra en shots al acabar updateShots; con 140 en pantalla no se crea.
  const SHOT_CAP = 140;
  let shotQ = [], subHit = false; // subHit: el golpe en curso es de un secundario (su baja no activa los rasgos al morir)
  function spawnSub(x, y, a, dmg, els, o) {
    if (shots.length + shotQ.length >= SHOT_CAP) return null;
    const main = els && els[0] && EL[els[0]] ? els[0] : 'arcane';
    const s = Object.assign({
      x, y, vx: Math.cos(a) * SHOT_SPEED, vy: Math.sin(a) * SHOT_SPEED, dmg, life: 0.21, hit: new Set(),
      pierce: 0, rico: 0, wall: 0, els: els || [], col: EL[main].color, col2: null, nofx: true,
    }, o);
    shotQ.push(s);
    return s;
  }

  // ================================================================
  //  Despertar: Afinidad, Ánima, despertares y rasgos de forma (datos y dibujo en forms.js)
  // ================================================================
  // definitivo: el de la escuela hasta despertar; después, el del núcleo con el color de la forma;
  // en la forma combinada (fase 2), el suyo: sun, curtain, fog, sulfur o void (claves de ULT en forms.js)
  const ultKey = () => {
    const p = player, F = FX();
    if (!F || !p.awak || !p.core) return p.school;
    return p.awak >= 2 && flags.phase2 && F.FORMS[p.form].ult ? F.FORMS[p.form].ult.key : p.core;
  };
  const ultColor = () => (player.awak && FX() ? Forms().FORMS[player.form].color : EL[player.school].color);
  const ultIcon = () => { const k = ultKey(); return SCHOOLS[k] ? SCHOOLS[k].ultIcon : Forms().ULT[k].icon; };
  const ultName = () => { const k = ultKey(); return SCHOOLS[k] ? SCHOOLS[k].ult : Forms().ULT[k].name; };
  // Mezclas activas: 0 si no está; si está, su multiplicador (1,25 si tu forma tiene su elemento); MIXP = datos y números
  const MIXP = Forms() ? Object.fromEntries(Forms().MIXES.map(m => [m.id, m])) : {};
  const mixOn = id => (player && player.mixM[id]) || 0;
  // Linaje: tu forma contiene el elemento de tu escuela (el Arcanista nunca lo tiene) → definitivo ×1,2
  const linaje = () => { const p = player, el = SCHOOLS[p.school].el; return !!el && p.awak > 0 && !!FX() && (p.core === el || p.second === el); };
  const uAtk = () => player.atk * (linaje() ? 1.2 : 1);

  // avisos en cola: el nuevo no pisa al que se está leyendo (como mucho 8 esperando; si sobra uno, antes un consejo, que volverá otro día).
  // Los consejos de una vez (tip = clave de settings.tips, hz = trampa) se dan por vistos al salir en pantalla, no al encolarse
  function pushToast(o) {
    if ((o.tip || o.hz) && [toast, ...toastQ].some(t => t && t.tip === o.tip && t.hz === o.hz)) return; // ya en cola
    if (!toast) return showToast(o);
    toastQ.push(o);
    if (toastQ.length > 8) { const i = toastQ.findIndex(t => t.tip || t.hz); toastQ.splice(i >= 0 ? i : 0, 1); }
  }
  function showToast(o) {
    toast = o;
    if (o && o.tip) { settings.tips[o.tip] = 1; saveSettings(); }
    if (o && o.hz) { (settings.seenHz || (settings.seenHz = {}))[o.hz] = true; saveSettings(); }
  }
  // un consejo que ya sobra: fuera de la cola y, si se está leyendo, se desvanece (now: se quita ya). Si apenas se ha visto, volverá a salir
  function dropTip(k, now) {
    toastQ = toastQ.filter(t => t.tip !== k);
    if (!toast || toast.tip !== k) return;
    if (toast.max - toast.t < 1) { delete settings.tips[k]; saveSettings(); }
    if (now) showToast(toastQ.shift() || null); else toast.t = Math.min(toast.t, 0.25);
  }

  // Ánima (anillo del definitivo): bajas, reacciones y daño a jefes. Al llenarse, el despertar queda listo
  function gainAnima(v) {
    const p = player, F = FX();
    if (!F || !p || p.awak >= 2 || p.animaReady || room >= lastRoom()) return; // en la sala final ya no hay despertar
    const A = F.ANIMA, need = animaNeed(p.awak);
    p.anima += v * (p.school === 'arcane' ? A.arcane : 1);
    if (!settings.tips.anima && p.anima >= need * 0.5 && p.anima < need) // si se llena de golpe, el consejo espera al siguiente
      pushToast({ text: 'DESPERTAR', sub: 'El anillo del definitivo se llena con bajas, reacciones y jefes', color: '#fff1c4', t: 3.2, max: 3.2, tip: 'anima' });
    if (p.anima >= need) {
      p.anima = need; p.animaReady = true;
      dropTip('anima'); // el despertar ya está listo: el consejo del anillo sobra
      Sfx.formReady(F.keyOf(p.form, p.core));
      vibrate(30);
      addText(p.x, p.y - 50, '¡DESPERTAR LISTO!', '#fff1c4', 0.8);
    }
    syncForm();
  }
  // redes de seguridad tras los jefes: llena el Ánima hasta el umbral del despertar que toca
  function fillAnima(net) {
    if (player.awak >= 2 || player.animaReady || !FX()) return;
    netLog.push({ net, room, awak: player.awak });
    gainAnima(1e9);
  }

  // Afinidad: máximo 2 elementos por partida. Al entrar el 2º se sella y los otros dos dejan de salir
  // silent: sin anillo ni sonido (despertar, equipo); 'gear' = la ha sellado el equipo
  function addAffinity(el, silent) {
    const a = player.aff;
    if (!FX() || !ELEMENTS.includes(el) || a.includes(el) || a.length >= 2) return false;
    a.push(el);
    if (a.length === 2) onAffinity(silent);
    return true;
  }
  function onAffinity(silent) {
    const p = player, F = Forms(), [a, b] = p.aff, cl = F.SQUARE.filter(x => !p.aff.includes(x));
    pushToast({ text: `AFINIDAD · ${EL[a].name.toUpperCase()} + ${EL[b].name.toUpperCase()}`, sub: (silent === 'gear' ? 'Por tu equipo · ' : '') + `${EL[cl[0]].name} y ${EL[cl[1]].name} dejan de salir`, color: EL[b].color, t: 2.8, max: 2.8 });
    if (!settings.tips.aff) pushToast({ text: 'SOLO 2 ELEMENTOS POR PARTIDA', sub: 'Los demás dejan de salir hasta el final', color: '#fff1c4', t: 3, max: 3, tip: 'aff' });
    if (F.isOpp(a, b) && !settings.tips.opp) pushToast({ text: 'ALGO OSCURO DUERME…', sub: `…entre ${EL[a].name} y ${EL[b].name}`, color: '#c77dff', t: 3, max: 3, tip: 'opp' });
    if (silent) return;
    rings.push({ x: p.x, y: p.y - 4, r0: 10, r1: 90, t: 0.45, max: 0.45, color: EL[a].color, w: 4 }); // anillo doble con los 2 colores
    rings.push({ x: p.x, y: p.y - 4, r0: 10, r1: 90, t: 0.55, max: 0.55, color: EL[b].color, w: 4 });
    burst(p.x, p.y - 4, EL[a].color, 14, 220); burst(p.x, p.y - 4, EL[b].color, 14, 220);
    Sfx.fuse();
  }

  // ¿toca ofrecer el despertar? Sala limpia, sin menús ni cámara lenta, Ánima llena y alguna opción abierta
  function awakenDue() {
    const p = player, F = FX();
    if (!F || !p || !p.animaReady || p.awak >= 2) return false;
    p.awkLock = !F.options({ stage: p.awak + 1, aff: p.aff, core: p.core, pact: pactRun }).some(o => !o.locked); // opuestos sin pacto
    return !(p.awkLock || awakenFx || state !== 'play' || winTimer >= 0 || cine || slowT > 0 || !cleared || p.snoozeRoom === room);
  }
  // se ofrece tras 0,8 s de calma (los logros esperan: achHold)
  function canOfferAwaken(dt) {
    if (!awakenDue()) { awakenWait = 0; return false; }
    return (awakenWait += dt) > FX().ANIMA.wait;
  }
  // elegir carta del panel: empieza la transformación (state sigue en 'play', el mundo va a cámara lenta)
  function startAwaken(el) {
    const p = player, F = FX();
    hideOverlay(); state = 'play'; last = performance.now(); resetJoy();
    if (!F || awakenFx || !F.options({ stage: p.awak + 1, aff: p.aff, core: p.core, pact: pactRun }).some(o => o.el === el && !o.locked)) return;
    awakenFx = { t: 0, el, st: p.awak + 1, boom: false, first: false };
    banner = null; bannerNext = null; // la escena es del mago: fuera el rótulo de la sala
    dropTip('anima', true); achYield(); // y el consejo del anillo, que ya se ha cumplido, y el logro que se esté viendo
    awakenWait = 0; musicHoldT = 1.4;
    try { if (window.ArcanoMusic) window.ArcanoMusic.setIntensity(0); } catch (_) { /* sin música */ }
    Sfx.awakenCharge();
    vibrate(20);
  }
  // "Aún no": vuelve a ofrecerse en la siguiente sala limpia (o en esta si firmas un pacto)
  function awakenLater() {
    if (!player) return;
    hideOverlay(); state = 'play'; last = performance.now(); resetJoy();
    player.snoozeRoom = room; awakenWait = 0;
    Sfx.click();
    nextAch(); // los logros retenidos por el panel ya pueden salir
  }
  // 1,4 s reales: carga con el mundo a ×0,15, estallido a los 0,9 s y vuelta a la normalidad
  function updateAwaken(dt) {
    const f = awakenFx;
    f.t += dt;
    const T = Forms().timeline(f.t);
    player.lev = T.lev;
    if (!f.boom) shake = Math.max(shake, T.shake);
    if (!f.boom && f.t >= 0.9) { f.boom = true; awaken(f.el); boomFx(f); }
    if (f.t >= 1.4) { awakenFx = null; player.lev = 0; announceForm(f); }
  }
  const awakenScale = () => (awakenFx ? Forms().timeline(awakenFx.t).scale : 1);

  // el despertar en sí: núcleo o 2º elemento, runa +1 (Sintonía si ya estaba al máximo), forma y rasgos
  function awaken(el) {
    const p = player, F = Forms(), st = p.awak + 1;
    if (!F || st > 2 || !ELEMENTS.includes(el)) return;
    if (st === 1) p.core = el; else p.second = el;
    addAffinity(el, true);
    const sync = (p.sk[el] || 0) >= 2;
    p.sk[el] = Math.min(2, (p.sk[el] || 0) + 1);
    p.awak = st;
    p.form = F.formFor(p.core, p.second);
    p.anima = 0; p.animaReady = false; p.awkLock = false; p.snoozeRoom = -1;
    p.tr = F.traitsFor(p.core, p.second, p.sk); // puro del núcleo + combinado (sin el puro del 2º)
    if (st === 2 && p.tr.hpMul) { p.maxHp = Math.max(40, Math.round(p.maxHp * p.tr.hpMul)); p.hp = Math.min(p.hp, p.maxHp); } // precio de Eclipse
    if (sync) { p.mana = 100; pushToast({ text: 'SINTONÍA', sub: 'Runa al máximo: definitivo lleno', color: F.FORMS[p.form].color, t: 2.2, max: 2.2 }); }
    recalc(); refreshMixes(); syncUlt(true); syncForm(true);
    discoverForm(p.form, st);
  }
  // ESTALLIDO: destello, onda, partículas con los colores del aura, se borran las balas y vuelve la música
  function boomFx(f) {
    const p = player, F = Forms(), D = F.FORMS[p.form], ecl = p.form === 'eclipse', x = p.x, y = p.y - 4 - p.lev;
    screenFlash = ecl ? { color: '10,0,20', t: 0.25, max: 0.25, real: true } : { color: '255,255,255', t: 0.15, max: 0.15, real: true };
    flashNext = { color: ecl ? '199,125,255' : rgbOf(D.color).join(','), t: ecl ? 0.5 : 0.45, max: ecl ? 0.5 : 0.45, real: true };
    rings.push({ x, y, r0: 20, r1: 220, t: 0.45, max: 0.45, color: D.color, w: 8 });
    rings.push({ x, y, r0: 20, r1: 160, t: 0.35, max: 0.35, color: '#ffffff', w: 4 });
    for (const c of D.colors) burst(x, y, c, 20, 320); // 60 partículas (24 en calidad baja)
    for (const b of bullets) sparks(b.x, b.y, D.color, 2);
    bullets = [];
    shake = f.st === 2 ? 18 : 14;
    vibrate(f.st === 2 ? 200 : 120);
    Sfx.awakenBoom(f.st, F.keyOf(p.form, p.core), ecl);
    if (ecl) eclipseFx = { t: 3, max: 3 };
    try { if (window.ArcanoMusic) window.ArcanoMusic.setIntensity(1); } catch (_) { /* sin música */ }
    musicHoldT = 6;
  }
  function announceForm(f) {
    const F = Forms(), D = F.FORMS[player.form], crown = grimMark2(player.form);
    // con la Marca II de la forma: nombre en dorado con su corona encima
    const main = { text: D.short, sub: D.line, color: crown ? '#ffcf4a' : D.color, crown: crown ? D.color : null, t: 2.6, max: 2.6, form: true }; // form: los logros esperan
    if (player.form === 'eclipse' && f.first) { banner = { text: 'LA FORMA PROHIBIDA', sub: '', color: '#c77dff', t: 1.2, max: 1.2, form: true }; bannerNext = main; }
    else banner = main;
    if (f.st === 2 && flags.phase2 && D.ult) pushToast({ text: `NUEVO DEFINITIVO: ${D.ult.name.toUpperCase()}`, sub: D.ult.desc, color: D.color, t: 2.8, max: 2.8 }); // lo que cambia al jugar, primero
    if (f.first) pushToast({ text: '¡NUEVA FORMA!', sub: `Grimorio ${F.count(meta.grim.f)}/10`, color: D.color, t: 2.6, max: 2.6 });
    if (f.mark) pushToast({ text: `¡CORONA DE ${D.short}!`, sub: `Marca II · título «${GRIM_TITLES[D.bit]}» en el Grimorio`, color: '#ffcf4a', t: 3, max: 3 });
  }
  // Grimorio: forma descubierta (f), despertada pronto (e), veces (n), ritmo (k) y logros
  function discoverForm(id, st) {
    const F = Forms(), g = meta.grim, b = F.bit(id), i = F.FORMS[id].bit, first = !(g.f & b);
    const early = st === 1 && room <= CHA().markRoom(CH); // Marca II: forma pura despertada antes de la sala 7 (C1)
    const mark = early && !(g.e & b); // Marca II nueva
    g.f |= b;
    if (early) g.e |= b;
    g.n = g.n.slice(0, i) + Math.min(9, +g.n[i] + 1) + g.n.slice(i + 1);
    g.k[(st - 1) * 2] += room; g.k[(st - 1) * 2 + 1]++;
    if (awakenFx) { awakenFx.first = first; awakenFx.mark = mark; }
    unlock('awaken1');
    if (st === 2) unlock('awaken2');
    if (['plasma', 'aurora', 'mortaja', 'azufre'].every(x => F.has(g.f, x))) unlock('hybrids');
    if (id === 'eclipse') unlock('eclipse');
    if (F.count(g.f) >= 10) unlock('forms10');
    saveMeta();
  }

  // estilo del disparo: elementos y colores (siempre) y, con forms.js, la silueta de la forma (cacheada allí)
  function refreshStyle() {
    const p = player, s = p.sk;
    const els = ELEMENTS.filter(k => s[k]);
    const main = els.includes(p.school) ? p.school : els[0] || 'arcane';
    const second = els.find(k => k !== main);
    p.shotEls = els; p.shotCol = EL[main].color; p.shotCol2 = second ? EL[second].color : null;
    const F = FX(), cols = [p.shotCol, p.shotCol2];
    p.sty = F ? F.shotStyle(p.form, s, false, cols, p.mixes) : null;
    p.styEcho = F ? F.shotStyle(p.form, s, true, cols, p.mixes) : null;
  }
  // Mezclas activas (fase 2): solo las de tus 2 elementos. Se activan solas (runa + carta) y se anuncian una vez por partida
  function refreshMixes() {
    const p = player, F = FX();
    p.mixes = F && flags.phase2 ? F.activeMixes(p.sk).filter(m => p.aff.length < 2 || p.aff.includes(m.el)) : [];
    p.mixM = {};
    for (const m of p.mixes) {
      p.mixM[m.id] = F.mixMul(m, p.core, p.second); // ×1,25 si tu forma contiene su elemento
      if (!seenMixes.has(m.id)) { seenMixes.add(m.id); announceMix(m); }
    }
    refreshStyle();
  }
  // MEZCLA: texto flotante en su color, aviso con la receta y sonido; si es nueva, página del Grimorio
  function announceMix(m) {
    const p = player, F = Forms(), g = meta.grim, b = F.bit(m.id), fresh = !(g.m & b);
    addText(p.x, p.y - 56, 'MEZCLA: ' + m.name.toUpperCase(), m.color, 1.05);
    rings.push({ x: p.x, y: p.y - 4, r0: 12, r1: 70, t: 0.4, max: 0.4, color: m.color, w: 4 });
    sparks(p.x, p.y - 4, m.color, 10);
    pushToast({ text: 'MEZCLA: ' + m.name.toUpperCase(), sub: `${m.recipe} · ${m.tip}`, color: m.color, t: 2.8, max: 2.8 });
    if (!settings.tips.mix) pushToast({ text: 'MEZCLAS SECRETAS', sub: 'Una runa y una carta concretas se combinan solas', color: '#8dffb0', t: 3, max: 3, tip: 'mix' });
    Sfx.mix();
    if (fresh) {
      g.m |= b;
      if (F.count(g.m) >= F.MIXES.length) unlock('mixes8');
      saveMeta();
    }
  }

  // cada frame: charcos, Sudario y partículas de ambiente de la forma (las fichas se recargan en update)
  function updateForms(dt) {
    const F = FX(), p = player;
    if (!F) return;
    if (pools.length) {
      for (const o of pools) { o.t -= dt; if ((o.tick -= dt) <= 0) { o.tick = 0.5; poolTick(o); } }
      pools = pools.filter(o => o.t > 0);
    }
    const sh = p.tr.shroud;
    if (sh && (p.shroudT -= dt) <= 0) { p.shroudT = 0.5; shroudTick(sh); }
    const no = p.sk.orbs || 0;
    if (no && mixOn('halo') && (p.haloT -= dt) <= 0) { p.haloT = MIXP.halo.p.every; if (!cleared) haloTick(no); } // sin enemigos, sin anillos
    if (no && mixOn('anillo') && (p.ringT -= dt) <= 0) { p.ringT = MIXP.anillo.p.every; ringTick(no); }
    const A = F.FORMS[p.form].ambient;
    if (A && !awakenFx && (ambT -= dt) <= 0) {
      ambT = A.every * (lowQ() ? 2.5 : 1);
      const q = F.spawnAmbient(p.form, p);
      if (q) { const arr = q.normal ? ash : amb; arr.push(q); if (arr.length > (lowQ() ? 30 : 80)) arr.shift(); }
    }
    // el ambiente va sin rozamiento (las chispas de parts frenan enseguida)
    if (amb.length) { for (const q of amb) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; } amb = amb.filter(q => q.life > 0); }
    if (ash.length) { for (const q of ash) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; } ash = ash.filter(q => q.life > 0); }
  }
  // charco de Tóxica (veneno) o de Azufre (daño, fuego y veneno) cada 0,5 s a los que estén dentro
  function poolTick(o) {
    const atk = player.atk, els = o.sulfur ? ['fire', 'poison'] : ['poison'];
    for (const e of enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const dx = (e.x - o.x) / (o.r + e.r * 0.5), dy = (e.y - o.y) / (o.r * 0.62 + e.r * 0.5);
      if (dx * dx + dy * dy > 1) continue;
      if (o.k > 0) damageEnemy(e, atk * o.k, false, o.sulfur ? '#d6ff3a' : '#8dff6a', true);
      if (!e.dead) applyElements(e, els);
    }
  }
  // posición del orbe guardián i de n (giran a 72 px del mago)
  const ORB_R = 72;
  const orbX = (i, n) => player.x + Math.cos(player.orbA + i * TAU / n) * ORB_R;
  const orbY = (i, n) => player.y + Math.sin(player.orbA + i * TAU / n) * ORB_R;
  // Halo solar: cada orbe lanza un anillo de fuego (r70·m, 0,6×atk·m)
  function haloTick(n) {
    const m = mixOn('halo'), P = MIXP.halo.p, r = P.r * m, d = player.atk * P.k * m;
    for (let i = 0; i < n; i++) {
      const x = orbX(i, n), y = orbY(i, n);
      rings.push({ x, y, r0: 10, r1: r, t: 0.35, max: 0.35, color: '#ffb347', w: 4 });
      for (const e of enemies) {
        if (e.dead || e.spawnT > 0 || (e.x - x) ** 2 + (e.y - y) ** 2 > (r + e.r) ** 2) continue;
        damageEnemy(e, d, false, '#ffb347', true);
      }
    }
    if (Sfx.gate('halo', 200)) Sfx.tone(330, 0.25, 'triangle', 0.05, 1.6);
  }
  // Anillo voltaico: arcos entre orbes consecutivos (o orbe↔mago si solo hay uno); daña y electrocuta lo que toca
  function orbSegs(n) {
    const p = player;
    if (n === 1) return [[orbX(0, 1), orbY(0, 1), p.x, p.y - 4]];
    const out = [];
    for (let i = 0; i < (n === 2 ? 1 : n); i++) out.push([orbX(i, n), orbY(i, n), orbX((i + 1) % n, n), orbY((i + 1) % n, n)]);
    return out;
  }
  function ringTick(n) {
    const m = mixOn('anillo'), P = MIXP.anillo.p, d = player.atk * P.k * m;
    let hit = false;
    for (const [x1, y1, x2, y2] of orbSegs(n)) {
      const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
      for (const e of enemies) {
        if (e.dead || e.spawnT > 0) continue;
        const u = clamp(((e.x - x1) * dx + (e.y - y1) * dy) / L2, 0, 1), qx = x1 + dx * u - e.x, qy = y1 + dy * u - e.y;
        if (qx * qx + qy * qy > (e.r + P.pad) ** 2) continue;
        damageEnemy(e, d, false, '#ffe45c', true);
        if (!e.dead) e.shock = Math.max(e.shock, P.shock);
        hit = true;
      }
    }
    if (hit) Sfx.zap();
  }
  // Sudario de Mortaja: ralentiza y envenena (con el tope de siempre) a los que están cerca
  function shroudTick(sh) {
    const p = player, atk = p.atk, cap = atk * (p.tr.poisonCap || 0.8) * (p.sk.poison || 1);
    for (const e of enemies) {
      if (e.dead || e.spawnT > 0 || (e.x - p.x) ** 2 + (e.y - p.y) ** 2 > (sh.r + e.r) ** 2) continue;
      e.slow = Math.max(e.slow, 0.6);
      if (e.poisonDps < cap) e.poisonDps = Math.min(cap, e.poisonDps + atk * sh.k);
    }
  }
  // al morir: estallido de Ígnea (ardiendo), charco de Tóxica/Azufre y esquirlas de Aurora (congelado)
  function formDeath(e) {
    const tr = player.tr, atk = player.atk;
    if (!FX() || !tr || subHit) return; // la baja de un secundario: ni estallido, ni charco, ni más esquirlas
    const d = tr.deathBlast;
    if (d && e.burn > 0 && fxDepth === 0 && takeTok('blast')) { // las bajas de un estallido no estallan
      fxDepth++;
      rings.push({ x: e.x, y: e.y, r0: 10, r1: d.r, t: 0.3, max: 0.3, color: '#ff8a3d', w: 5 });
      burst(e.x, e.y, '#ffb347', 14, 240);
      shake = Math.max(shake, 4);
      Sfx.blast();
      for (const o of enemies) {
        if (o === e || o.dead || o.spawnT > 0 || Math.hypot(o.x - e.x, o.y - e.y) > d.r + o.r) continue;
        damageEnemy(o, atk * d.k, false, '#ff8a3d', true);
        if (!o.dead) applyElements(o, ['fire']);
      }
      fxDepth--;
    }
    const pd = tr.puddle;
    if (pd && (e.poisonDps > 0 || (pd.sulfur && e.burn > 0))) {
      pools.push(Forms().newPool(e.x, e.y, pd));
      if (pools.length > pd.max) pools.shift();
    }
    const sh = tr.shards;
    if (sh && e.frozen > 0 && takeTok('shard')) {
      const a0 = rand(0, TAU);
      for (let i = 0; i < sh.n; i++) spawnSub(e.x, e.y, a0 + i * TAU / sh.n, atk * sh.k, ['ice'], { sub: 'shard' });
      sparks(e.x, e.y, '#e6fbff', 6);
    }
  }
  // Aniquilación de Eclipse: cada reacción atrae (no a jefes ni tótems) y daña a los de alrededor
  function implode(e, d) {
    const atk = player.atk;
    rings.push({ x: e.x, y: e.y, r0: d.r, r1: 8, t: 0.3, max: 0.3, color: '#c77dff', w: 5 });
    if (!lowQ()) for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 + rand(-0.2, 0.2), r = d.r * rand(0.7, 1);
      parts.push({ x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r, vx: -Math.cos(a) * r * 3, vy: -Math.sin(a) * r * 3, life: 0.3, max: 0.3, color: '#c77dff', size: rand(2, 3.5) });
    }
    if (Sfx.gate('implode', 90)) Sfx.tone(160, 0.22, 'sine', 0.08, 0.45);
    for (const o of enemies) {
      if (o.dead || o.spawnT > 0) continue;
      const dd = Math.hypot(o.x - e.x, o.y - e.y);
      if (dd > d.r + o.r) continue;
      if (o !== e && o.kind !== 'boss' && o.kind !== 'totem' && dd > 1) {
        const m = Math.min(d.pull, dd);
        o.x += (e.x - o.x) / dd * m; o.y += (e.y - o.y) / dd * m;
        if (o.ground) collideRocks(o);
        clampArena(o, false);
      }
      damageEnemy(o, atk * d.k, false, '#c77dff', true);
    }
  }
  // Arco de plasma: del enemigo que arde salta un arco al más cercano, con parte del daño, y lo prende
  function plasmaArc(e, ar, pa) {
    let best = null, bd = pa.r * pa.r;
    for (const o of enemies) {
      if (o === e || o.dead || o.spawnT > 0) continue;
      const d2 = (o.x - e.x) ** 2 + (o.y - e.y) ** 2;
      if (d2 < bd) { bd = d2; best = o; }
    }
    if (!best || !takeTok('arc')) return;
    bolts.push({ x1: e.x, y1: e.y, x2: best.x, y2: best.y, life: 0.18, layers: Forms().BOLT_LAYERS.plasma });
    damageEnemy(best, ar.dmg * pa.k, false, '#ff5ad1', true);
    if (!best.dead) applyElements(best, ['fire']);
    Sfx.zap();
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
    const col = ultColor(), k = ultKey(), atk = uAtk(); // tras despertar: el del núcleo con el color de la forma
    rings.push({ x: player.x, y: player.y, r0: 10, r1: 120, t: 0.4, max: 0.4, color: col, w: 6 });
    if (k === 'fire') {
      const best = densest(live);
      meteors.push({ x: best.x, y: best.y, t: 0.75, max: 0.75, r: 140 });
      Sfx.whistle();
    } else if (k === 'ice') {
      for (const e of live) {
        // los bloques no se rompen todos a la vez: el estallido va crujiendo en cascada
        freezeEnemy(e, rand(2.8, 3.3), 1.8, true);
        e.shatter = true;
        e.slow = Math.max(e.slow, 3);
        damageEnemy(e, atk * 5, false, EL.ice.color, true);
      }
      for (const b of bullets) sparks(b.x, b.y, EL.ice.color, 2);
      bullets = [];
      for (let i = 0; i < 60; i++) {
        parts.push({ x: rand(AX, AX + AW), y: rand(AY, AY + AH), vx: rand(-30, 30), vy: rand(40, 120), life: rand(0.6, 1.2), max: 1.2, color: '#eafcff', size: rand(1.5, 3.5) });
      }
      screenFlash = { color: '180,235,255', t: 0.5, max: 0.5 };
      Sfx.freeze();
    } else if (k === 'poison') {
      // Plaga: veneno fuerte para todos; los que mueran en 6 s revientan y contagian
      for (const e of live) {
        e.poisonDps = Math.max(e.poisonDps, atk * 1.2);
        e.plague = 6;
        damageEnemy(e, atk * 2, false, EL.poison.color, true);
        for (let i = 0; i < 6; i++) parts.push({ x: e.x + rand(-e.r, e.r), y: e.y, vx: rand(-20, 20), vy: rand(-70, -20), life: rand(0.5, 1), max: 1, color: EL.poison.color, size: rand(2, 4.5) });
      }
      screenFlash = { color: '150,255,110', t: 0.4, max: 0.4 };
      Sfx.plague();
    } else if (k === 'arcane') {
      const best = densest(live);
      sing = { x: best.x, y: best.y, t: 2, max: 2, tick: 0 };
      Sfx.whistle();
    } else if (k === 'sun') {
      // SOL CAUTIVO (Plasma): esfera sobre el grupo más denso; 8 rayos (uno cada 0,15 s) y al final estalla
      const best = densest(live);
      sing = { kind: 'sun', x: best.x, y: best.y, t: 1.2, max: 1.2, tick: 0.05, n: 8 };
      screenFlash = { color: '255,90,209', t: 0.25, max: 0.25 };
      Sfx.tone(392, 0.9, 'sine', 0.06, 2); Sfx.tone(587, 0.9, 'triangle', 0.04, 2);
    } else if (k === 'curtain') {
      // CORTINA BOREAL (Aurora): 5 columnas de luz polar, una cada 0,2 s, desde tu lado de la sala
      const w = AW / 5, dir = player.x < AX + AW / 2 ? 1 : -1;
      curtains = [];
      for (let j = 0; j < 5; j++) { const i = dir > 0 ? j : 4 - j; curtains.push({ x: AX + i * w, w, d: j * 0.2, t: 0.35, max: 0.35, seed: rand(0, 99), on: false, hit: new Set() }); }
      screenFlash = { color: '106,255,200', t: 0.2, max: 0.2 };
    } else if (k === 'fog') {
      // INVIERNO NEGRO (Mortaja): niebla 4 s en toda la sala; al acabar, NECROSIS sobre todos
      fog = { t: 4, max: 4, tick: 0, atk };
      for (const b of bullets) sparks(b.x, b.y, '#5fffd0', 1);
      screenFlash = { color: '30,60,55', t: 0.5, max: 0.5 };
      Sfx.plague();
    } else if (k === 'sulfur') {
      // LLUVIA DE AZUFRE (Azufre): 6 bolas sobre los más densos (repiten objetivo si hay pocos), una cada 0,12 s con aviso de 0,5 s
      const dens = live.map(e => ({ e, c: live.filter(o => dist(o, e) < 130).length + (e.kind === 'boss' ? 3 : 0) })).sort((a, b) => b.c - a.c);
      for (let i = 0; i < 6; i++) {
        const e = dens[i % dens.length].e, j = i < dens.length ? 0 : 22;
        meteors.push({ x: e.x + rand(-j, j), y: e.y + rand(-j, j), d: i * 0.12, t: 0.5, max: 0.5, r: 85, dmg: 3.5, col: '#d6ff3a', pool: true });
      }
      Sfx.whistle();
    } else if (k === 'void') {
      // SOL NEGRO (Eclipse): 2,5 s en el centro de la sala; lo atrae todo, oscurece la pantalla y tus disparos hacen +50%
      sing = { kind: 'void', x: AX + AW / 2, y: AY + AH / 2, t: 2.5, max: 2.5, tick: 0.25 };
      screenFlash = { color: '10,0,20', t: 0.35, max: 0.35 };
      Sfx.tone(55, 2.5, 'sine', 0.15); Sfx.tone(110, 1.2, 'triangle', 0.05, 0.5);
    } else {
      storm = { n: 8, t: 0 };
      for (const b of bullets) if (dist(b, player) < 170) { b.dead = true; sparks(b.x, b.y, EL.bolt.color, 2); }
      bullets = bullets.filter(b => !b.dead);
      screenFlash = { color: '255,240,150', t: 0.25, max: 0.25 };
    }
  }

  function updateUlts(dt) {
    for (const m of meteors) {
      if (m.d > 0) { m.d -= dt; continue; } // Lluvia de azufre: caen escalonadas
      m.t -= dt;
      if (m.t > 0) continue;
      m.done = true;
      explode(m.x, m.y, m.r, uAtk() * (m.dmg || 12), m.col || EL.fire.color);
      if (m.pool) { // bola de azufre: fuego y veneno a los alcanzados y charco de azufre de 3 s
        for (const e of enemies) if (!e.dead && e.spawnT <= 0 && dist(e, m) < m.r + e.r) applyElements(e, ['fire', 'poison']);
        const pd = player.tr.puddle && player.tr.puddle.sulfur ? player.tr.puddle : { r: 50, t: 3, k: 0.3, max: 6, sulfur: true };
        pools.push(Forms().newPool(m.x, m.y, pd));
        if (pools.length > pd.max) pools.shift();
        burst(m.x, m.y, '#ffb000', 16, 260);
        shake = Math.max(shake, 9);
        Sfx.blast();
        continue;
      }
      for (const e of enemies) if (!e.dead && dist(e, m) < m.r + e.r) { e.burn = 3; e.burnDps = Math.max(e.burnDps, uAtk() * 0.6); }
      for (const b of bullets) if (dist(b, m) < m.r) b.dead = true;
      bullets = bullets.filter(b => !b.dead);
      burst(m.x, m.y, '#ffd27a', 40, 340);
      shake = Math.max(shake, 16);
      screenFlash = { color: '255,150,60', t: 0.3, max: 0.3 };
      Sfx.boom();
    }
    meteors = meteors.filter(m => !m.done);
    if (sing) {
      if (sing.kind === 'sun') updateSun(dt);
      else updateHole(dt);
    }
    if (curtains.length) updateCurtains(dt);
    if (fog) updateFog(dt);
    if (storm) {
      storm.t -= dt;
      if (storm.t <= 0) {
        const live = liveEnemies();
        if (!live.length || storm.n <= 0) storm = null;
        else {
          const e = pick(live);
          bolts.push({ x1: e.x + rand(-40, 40), y1: AY - 30, x2: e.x, y2: e.y, life: 0.25, sky: true });
          rings.push({ x: e.x, y: e.y, r0: 6, r1: 50, t: 0.25, max: 0.25, color: EL.bolt.color, w: 4 });
          damageEnemy(e, uAtk() * 3.2, false, EL.bolt.color);
          if (!e.dead) e.shock = 2;
          Sfx.zap();
          shake = Math.max(shake, 4);
          storm.n--; storm.t = 0.14;
        }
      }
    }
  }
  // Singularidad (Arcanista) y Sol negro (Eclipse): atraen, dañan poco a poco y al final estallan
  function updateHole(dt) {
    const v = sing.kind === 'void', R = v ? 400 : 270, col = v ? '#c77dff' : EL.arcane.color;
    sing.t -= dt; sing.tick -= dt;
    for (const e of enemies) {
      if (e.dead || e.spawnT > 0 || e.kind === 'totem') continue;
      const d = dist(e, sing);
      if (d < R && d > 3) {
        const pull = Math.min(d, (e.kind === 'boss' ? 45 : 175) * dt);
        e.x += (sing.x - e.x) / d * pull; e.y += (sing.y - e.y) / d * pull;
      }
    }
    if (sing.tick <= 0) {
      sing.tick = 0.25;
      const rr = v ? 130 : 110, k = v ? 0.5 : 0.45;
      for (const e of enemies) if (!e.dead && e.spawnT <= 0 && dist(e, sing) < rr + e.r) damageEnemy(e, uAtk() * k, false, col, true);
      if (v) rings.push({ x: sing.x, y: sing.y, r0: 130, r1: 30, t: 0.25, max: 0.25, color: '#7a3dff', w: 3 });
    }
    const br = v ? 130 : 220; // el Sol negro se traga las balas de su zona de daño
    for (const b of bullets) if (dist(b, sing) < br) { b.dead = true; sparks(b.x, b.y, col, 2); }
    bullets = bullets.filter(b => !b.dead);
    if (Math.random() < dt * (v ? (lowQ() ? 25 : 60) : 40)) { // polvo que cae en espiral
      const a = rand(0, TAU), r = rand(80, v ? 220 : 150);
      parts.push({ x: sing.x + Math.cos(a) * r, y: sing.y + Math.sin(a) * r, vx: -Math.cos(a) * r * 2.2 - Math.sin(a) * 120, vy: -Math.sin(a) * r * 2.2 + Math.cos(a) * 120, life: 0.4, max: 0.4, color: v && Math.random() < 0.4 ? '#e8d5ff' : col, size: rand(1.5, 3) });
    }
    if (sing.t > 0) return;
    if (v) {
      explode(sing.x, sing.y, 220, uAtk() * 12, '#c77dff');
      rings.push({ x: sing.x, y: sing.y, r0: 20, r1: 260, t: 0.5, max: 0.5, color: '#e8d5ff', w: 6 });
      burst(sing.x, sing.y, '#e8d5ff', 40, 380);
      burst(sing.x, sing.y, '#7a3dff', 30, 300);
      shake = Math.max(shake, 18);
      screenFlash = { color: '232,213,255', t: 0.45, max: 0.45 };
    } else {
      explode(sing.x, sing.y, 150, uAtk() * 4.5, EL.arcane.color);
      burst(sing.x, sing.y, '#ffffff', 30, 300);
      shake = Math.max(shake, 14);
      screenFlash = { color: '200,140,255', t: 0.35, max: 0.35 };
    }
    Sfx.boom();
    sing = null;
  }
  // Sol cautivo: la esfera flota sobre el grupo y baja al final; cada 0,15 s un rayo (2,2×) a un enemigo a 260 px o menos
  const sunLift = () => 46 * clamp(sing.t / 0.25, 0, 1);
  function updateSun(dt) {
    sing.t -= dt; sing.tick -= dt;
    if (sing.tick <= 0 && sing.n > 0) {
      sing.tick = 0.15; sing.n--;
      const sy = sing.y - sunLift(), near = enemies.filter(e => !e.dead && e.spawnT <= 0 && (e.x - sing.x) ** 2 + (e.y - sy) ** 2 < (260 + e.r) ** 2);
      if (near.length) {
        const e = pick(near);
        bolts.push({ x1: sing.x, y1: sy, x2: e.x, y2: e.y, life: 0.2, layers: Forms().BOLT_LAYERS.plasma });
        rings.push({ x: e.x, y: e.y, r0: 6, r1: 40, t: 0.2, max: 0.2, color: '#ff5ad1', w: 3 });
        damageEnemy(e, uAtk() * 2.2, false, '#ff5ad1');
        if (!e.dead) { e.shock = 2; applyElements(e, ['fire']); }
        shake = Math.max(shake, 3);
        Sfx.zap();
      }
    }
    if (Math.random() < dt * (lowQ() ? 10 : 30)) { // chispas que saltan de la esfera
      const a = rand(0, TAU), s = rand(60, 160);
      parts.push({ x: sing.x, y: sing.y - sunLift(), vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.3, max: 0.3, color: Math.random() < 0.5 ? '#ffb347' : '#ff5ad1', size: rand(1.5, 3) });
    }
    if (sing.t > 0) return;
    const R = 160;
    explode(sing.x, sing.y, R, uAtk() * 9, '#ff5ad1');
    for (const e of enemies) if (!e.dead && dist(e, sing) < R + e.r) { e.burn = 3; e.burnDps = Math.max(e.burnDps, uAtk() * 0.6); }
    for (const b of bullets) if (dist(b, sing) < R) { b.dead = true; sparks(b.x, b.y, '#ffb347', 2); }
    bullets = bullets.filter(b => !b.dead);
    rings.push({ x: sing.x, y: sing.y, r0: 20, r1: R + 30, t: 0.4, max: 0.4, color: '#ffb347', w: 6 });
    burst(sing.x, sing.y, '#fff0ff', 30, 360);
    burst(sing.x, sing.y, '#ff5ad1', 30, 300);
    shake = Math.max(shake, 16);
    screenFlash = { color: '255,120,220', t: 0.35, max: 0.35 };
    Sfx.boom();
    sing = null;
  }
  // Cortina boreal: cada columna se enciende tras su espera y, mientras brilla (0,35 s), golpea una vez a cada enemigo
  // que esté o entre en ella (7× y congela) y borra las balas
  function updateCurtains(dt) {
    for (const c of curtains) {
      if (!c.on) {
        if ((c.d -= dt) > 0) continue;
        c.on = true;
        for (let i = 0; i < (lowQ() ? 6 : 16); i++) parts.push({ x: c.x + rand(0, c.w), y: rand(AY, AY + AH), vx: rand(-15, 15), vy: rand(-120, -40), life: rand(0.3, 0.6), max: 0.6, color: i % 3 ? '#6affc8' : '#b07cff', size: rand(1.5, 3.5) });
        shake = Math.max(shake, 5);
        Sfx.freeze();
      }
      c.t -= dt;
      for (const e of enemies) {
        if (e.dead || e.spawnT > 0 || e.x < c.x || e.x >= c.x + c.w || c.hit.has(e)) continue;
        c.hit.add(e);
        // 4,5× quedaba muy por debajo de la Ventisca (5× + 4× al romperse) que sustituye. El jefe solo cabe en una columna: 18× (21,6× con Linaje)
        // lo deja cerca de Tormenta (25,6×) y Sol cautivo (26,6×), algo por debajo por ser el definitivo defensivo
        damageEnemy(e, uAtk() * (e.kind === 'boss' ? 18 : 7), false, '#6affc8');
        if (!e.dead) freezeEnemy(e, 2, 0.8, true);
      }
      for (const b of bullets) if (b.x >= c.x && b.x < c.x + c.w) { b.dead = true; sparks(b.x, b.y, '#bff4ff', 2); }
    }
    bullets = bullets.filter(b => !b.dead);
    curtains = curtains.filter(c => c.t > 0);
  }
  // Invierno negro: renueva la lentitud (sin bajar del frío normal) y el veneno (1×atk) de todos; al acabar, NECROSIS en todos
  function updateFog(dt) {
    fog.t -= dt;
    if ((fog.tick -= dt) <= 0) {
      fog.tick = 0.25;
      for (const e of enemies) {
        if (e.dead || e.spawnT > 0) continue;
        e.slow = Math.max(e.slow, 0.6);
        e.poisonDps = Math.max(e.poisonDps, fog.atk);
      }
    }
    if (fog.t > 0) return;
    const a = fog.atk;
    fog = null;
    for (const e of liveEnemies()) if (!e.dead && e.poisonDps > 0) necrosis(e, a);
    screenFlash = { color: '95,255,208', t: 0.35, max: 0.35 };
    shake = Math.max(shake, 10);
    Sfx.freeze(); Sfx.tone(1100, 0.3, 'sine', 0.07, 0.5);
  }

  function recalc() {
    const s = player.sk;
    const g = player.gear || EMPTY_GEAR;
    player.atk = 10 * (1 + 0.25 * (s.atk || 0)) * (1 + 0.06 * metaLv('poder')) * (1 + g.atkPct);
    player.rate = 1.5 * (1 + 0.22 * (s.atkspd || 0)) * (1 + g.rateP);
    player.crit = 0.05 + 0.1 * (s.crit || 0) + g.critPct;
    player.critMul = 2 + 0.25 * (s.crit || 0);
    player.speed = 190 * (1 + 0.12 * (s.speed || 0)) * (1 + 0.04 * metaLv('paso')) * (1 + g.speedP);
    player.dodge = Math.min(0.45, 0.08 * (s.dodge || 0) + g.dodgeP); // nunca más de un 45% de esquiva
    // runas del equipo que no caben en la Afinidad (+6% por nivel, tope +24%) y precio/bonus de la forma (Eclipse)
    player.atk *= (1 + 0.06 * Math.min(4, player.fusedLv || 0)) * ((player.tr && player.tr.atkMul) || 1);
    refreshStyle();
  }

  function heal(n, show = true) {
    const before = player.hp;
    player.hp = Math.min(player.maxHp, player.hp + n);
    const got = Math.round(player.hp - before);
    if (show && got > 0) addText(player.x, player.y - 34, '+' + got, '#5ee36a', 1);
  }

  function addXp(v) {
    player.xp += v * (1 + 0.1 * metaLv('sabio') + (player.gear ? player.gear.xpPct : 0) + 0.15 * perkLv('magnet'));
    while (player.xp >= xpNeed(player.lvl)) {
      player.xp -= xpNeed(player.lvl);
      player.lvl++;
      pendingLevels++;
      if (player.lvl >= 15) unlock('lvl15');
    }
  }

  // origen del golpe (src) → tipo para los bots: bala, contacto, trampa, jefe, bomba, héroe o afijo
  const HIT_KIND = { archer: 'bala', mage: 'bala', totem: 'bala', spirit: 'bala', shot: 'bala', contact: 'contacto', bomb: 'bomba', volatile: 'afijo' };
  const hitKind = src => { const s = String(src), i = s.indexOf(':'), h = i < 0 ? s : s.slice(0, i);
    return h === 'boss' ? 'jefe' : h === 'trap' ? 'trampa' : h === 'hero' ? 'heroe' : HIT_KIND[h] || 'otro'; };
  const HIT_STAT0 = () => ({ hits: 0, dmgTaken: 0, rawN: 0, raw: 0, rawBy: {}, hitsBy: {}, dmgBy: {}, src: {}, rawInv: 0 });
  let hitStat = HIT_STAT0(), lastHit = null; // golpes de la partida (también en modo dios: raw = lo que te habría dado)
  function countHit(dmg, src) { // golpe que de verdad quita vida
    const k = hitKind(src);
    hitStat.hits++; hitStat.dmgTaken += dmg;
    hitStat.hitsBy[k] = (hitStat.hitsBy[k] || 0) + 1; hitStat.dmgBy[k] = (hitStat.dmgBy[k] || 0) + dmg;
    hitStat.src[src] = (hitStat.src[src] || 0) + 1;
    lastHit = { src, room };
  }

  function hurtPlayer(dmg, src = 'shot') {
    const trap = String(src).startsWith('trap');
    // lo que llega (antes del modo dios, la esquiva y el escudo); en modo dios, la invulnerabilidad de 0,7 s se imita con el reloj
    if (state === 'play' && (trap ? !(player.trapCd > 0 || winTimer > 0) : player.god ? runTime >= hitStat.rawInv : player.inv <= 0)) {
      const k = hitKind(src);
      hitStat.rawN++; hitStat.raw += dmg; hitStat.rawBy[k] = (hitStat.rawBy[k] || 0) + dmg;
      if (!trap) hitStat.rawInv = runTime + 0.7;
    }
    if (player.god || awakenFx) { if (trap && player.god && state === 'play' && player.trapCd <= 0) player.trapCd = 0.6; return; } // depuración / transformación: ni golpes ni trampas
    if (state !== 'play') return;
    if (trap) { // las trampas tienen su propio ritmo: no gastan escudo ni esquiva, ni dan invulnerabilidad
      if (player.trapCd > 0 || winTimer > 0) return;
      player.trapCd = 0.6;
      dmg = Math.max(1, Math.round(dmg));
      player.hp -= dmg;
      countHit(dmg, src);
      roomHit = true;
      shake = Math.max(shake, 4);
      hurtFlash = 0.2;
      addText(player.x, player.y - 34, '-' + dmg, '#ff8a5a', 1);
      Sfx.hurt();
      vibrate(30);
      if (player.hp <= 0) { if (player.revives > 0) revive(); else { player.hp = 0; die(); } }
      return;
    }
    if (player.inv > 0) return;
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
    countHit(dmg, src);
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

  // elementos y colores salen de refreshStyle (no se recalculan por disparo); sty = silueta de la forma (forms.js)
  // Aguijón (Mezcla): las diagonales son agujas más rápidas, que atraviesan uno más y envenenan doble. Sol negro: +50% de daño
  function spawnShot(x, y, a, dmg, sty, kind) {
    const s = player.sk, nd = kind === 'diag' && !!mixOn('aguijon'), sp = SHOT_SPEED * (nd ? MIXP.aguijon.p.spd : 1);
    if (sing && sing.kind === 'void') dmg *= 1.5;
    shots.push({
      x: x + Math.cos(a) * 18, y: y + Math.sin(a) * 18,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      dmg, life: 1.6, hit: new Set(),
      pierce: (s.pierce || 0) + (player.tr.pierce || 0) + (nd ? MIXP.aguijon.p.pierce : 0), rico: (s.ricochet || 0) * 2, wall: (s.wall || 0) * 2,
      els: player.shotEls, col: player.shotCol, col2: player.shotCol2, sty: sty || null, kind: kind || null, nofx: false, split: false, needle: nd,
    });
  }

  function fireVolley(target, echo = false) {
    const s = player.sk;
    const base = angTo(player, target);
    const dmg = player.atk * Math.pow(0.85, s.front || 0) * Math.pow(0.87, s.multi || 0);
    const nF = 1 + (s.front || 0), sty = echo ? player.styEcho : player.sty;
    const px = Math.cos(base + Math.PI / 2), py = Math.sin(base + Math.PI / 2);
    for (let i = 0; i < nF; i++) {
      const off = (i - (nF - 1) / 2) * 13;
      spawnShot(player.x + px * off, player.y + py * off, base, dmg, sty);
    }
    const diagA = [0.5, 0.95];
    for (let i = 0; i < (s.diag || 0); i++) {
      spawnShot(player.x, player.y, base + diagA[i], dmg, sty, 'diag');
      spawnShot(player.x, player.y, base - diagA[i], dmg, sty, 'diag');
    }
    if (s.side) { spawnShot(player.x, player.y, base + Math.PI / 2, dmg, sty); spawnShot(player.x, player.y, base - Math.PI / 2, dmg, sty); }
    if (s.rear) spawnShot(player.x, player.y, base + Math.PI, dmg, sty);
    player.face = base;
    player.castFx = 0.12;
    const F = FX();
    Sfx.shootV(F ? F.FORMS[player.form].voice : null); // cada forma tiene su voz
  }

  function updatePlayer(dt) {
    const p = player;
    const [mx, my] = awakenFx ? [0, 0] : moveInput(); // durante la transformación no te mueves
    p.moving = mx !== 0 || my !== 0;
    const ground = hzAt(p.x, p.y);
    const spd = p.speed * (ground === HZ.POISON ? 0.6 : 1);
    if (ground === HZ.ICE) { // en el hielo se acelera y se frena despacio
      const k = Math.min(1, dt * 4);
      p.vx += (mx * spd - p.vx) * k; p.vy += (my * spd - p.vy) * k;
    } else { p.vx = mx * spd; p.vy = my * spd; }
    const ox = p.x, oy = p.y;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.moving) {
      p.face = Math.atan2(my, mx); p.walkT += dt; p.still = 0;
      if (tut && tut.step === 'move' && (tut.t += dt) > 0.6) tut.step = 'shoot';
    } else p.still += dt;
    collideRocks(p);
    clampArena(p, cleared && room < lastRoom());
    // en el hielo solo se pierde la velocidad que choca contra la roca, no la que la roza
    if (ground === HZ.ICE && dt > 0) { p.vx = (p.x - ox) / dt; p.vy = (p.y - oy) / dt; }
    if (p.trapCd > 0) p.trapCd -= dt;
    const ci = cellIndex(p.x, p.y), now = ci < 0 || awakenFx ? 0 : hz[ci]; // la casilla en la que estás (sin trampas al transformarte)
    if (now === HZ.SPIKES && spikePhase(ci) === 2) hurtPlayer(10 * dmgMul(), 'trap:spikes');
    else if (now === HZ.LAVA) hurtPlayer(7 * dmgMul(), 'trap:lava');
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
        if (t) fireVolley(t, true); // ráfaga del eco
      }
    }

    // orbes guardianes (Halo solar: además queman al contacto)
    const n = p.sk.orbs || 0;
    if (n) {
      p.orbA += dt * 3.4;
      const halo = mixOn('halo');
      for (let i = 0; i < n; i++) {
        const ox = orbX(i, n), oy = orbY(i, n);
        for (const e of enemies) {
          if (e.dead || e.spawnT > 0 || e.orbCd > 0) continue;
          if ((e.x - ox) ** 2 + (e.y - oy) ** 2 < (e.r + 11) ** 2) {
            e.orbCd = 0.4;
            sparks(ox, oy, halo ? '#ffb347' : '#d9d2ff', 4);
            damageEnemy(e, p.atk * 0.8, false, halo ? '#ffb347' : '#d9d2ff', true);
            if (halo && !e.dead) applyElements(e, ['fire']);
          }
        }
      }
    }
  }

  // ================================================================
  //  Enemigos
  // ================================================================
  function makeEnemy(kind, x, y, delay = 0) {
    const d = ENEMIES[kind], hm = CHA().hpMul(CH, HEROIC, room), fa = CHA().firstAttack(CH, HEROIC, room);
    const tint = window.ArcanoBiomes ? BIOME_TINT[biomeAt(room)] : null;
    return {
      kind, x, y, r: d.r, hp: d.hp * hm, maxHp: d.hp * hm, speed: (foeCfg().speed[kind] || d.speed) * rand(0.92, 1.08),
      dmg: d.dmg * dmgMul(), xp: d.xp, ground: d.ground, color: (CH.enemyTint && CH.enemyTint[kind]) || (tint && tint[kind]) || d.color,
      lv: CHA().enemyLv(CH, HEROIC, room), // nivel: lo que leen sus ataques (en el C1 Normal, la sala)
      spawnT: 0.75 + delay, spawnMax: 0.75 + delay, t: 0, seed: rand(0, TAU), flash: 0,
      state: kind === 'archer' ? 'move' : 'idle', timer: rand(fa[0], fa[1]), aim: 0, tx: x, ty: y,
      vx: 0, vy: 0, knock: 0, burn: 0, burnDps: 0, poisonDps: 0, dotT: 0.5, slow: 0, orbCd: 0, dead: false,
      shock: 0, frozen: 0, reactCd: 0, corrode: 0, plague: 0, frzImm: 0, corrMul: 0,
      heavy: kind === 'totem', alpha: kind === 'spirit' ? 1 : undefined, spin: rand(0, TAU),
      vscale: kind === 'bigslime' ? 1.4 : 1, // se dibuja más grande de lo que ocupa (cabe por pasillos de 1 celda)
      kbMul: kind === 'charger' || kind === 'totem' ? 0 : 0.6, // empujón de tus hechizos (embestidores, élites y pesados: nada)
    };
  }

  // Élite: más vida (hpK: la del capítulo), más daño, aura dorada, sin empujón y el doble de experiencia
  function makeElite(e, hpK = 2.0) {
    e.elite = true; e.kbMul = 0;
    e.hp *= hpK; e.maxHp *= hpK;
    e.r = Math.min(Math.round(e.r * 1.15), e.ground ? 19 : 30); // en tierra tiene que caber por pasillos de 40 px
    e.vscale = (e.vscale || 1) * 1.15;
    e.dmg *= 1.25; e.xp *= 2;
    return e;
  }

  function makeBoss(B) {
    return {
      kind: 'boss', tier: B.tier, model: B.model, ach: B.ach, arena: B.arena, ord: B.ord, final: !!B.final, name: B.name, x: AX + AW / 2, y: AY + 190, r: B.r,
      hp: B.hp, maxHp: B.hp, speed: B.speed, dmg: 14 * dmgMul(), xp: 25 + B.tier * 10, ground: true,
      color: B.color, bcolor: B.bullet, pats: B.pats, pi: 0, state: 'idle', timer: 1.4, sub: 0,
      aim: 0, spin: 0, acc: 0, alpha: 1, ringN: 12 + B.tier * 3, enraged: false,
      spawnT: 1, spawnMax: 1, t: 0, seed: 0, flash: 0, tx: 0, ty: 0, vx: 0, vy: 0, knock: 0,
      burn: 0, burnDps: 0, poisonDps: 0, dotT: 0.5, slow: 0, orbCd: 0, dead: false,
      shock: 0, frozen: 0, reactCd: 0, corrode: 0, plague: 0, frzImm: 0, corrMul: 0, heavy: true,
    };
  }

  function roomEnemies(n) {
    const P = CHA().budget(CH, HEROIC, n), pool = P.pool, cap = P.caps; // cap: máximo por sala
    let budget = P.budget;
    const list = [];
    const T = P.threat, heavy = T ? pool.filter(x => !T.light.includes(x)) : null; // K2: densidad de amenaza, no de bichos
    for (let guard = 0; guard < 200 && budget > 0.9 && list.length < P.maxN; guard++) {
      let k = pick(pool);
      if (T && T.light.includes(k) && heavy.length && Math.random() < T.p) k = pick(heavy);
      const c = ENEMIES[k].cost;
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

  // balas enemigas: familia rojo-rosa-magenta (nada de naranja: es el Fuego, la lava y el volcán); src = origen del golpe
  const BUL = { archer: '#ff6b8a', mage: '#ff6f9c', totem: '#ff8ad1', spirit: '#ffb3c8', volatile: '#ff3b6b' };
  // D23: si hay más de 280 balas al empezar un ataque, el enemigo se lo salta entero (los anillos nunca salen con huecos)
  const bulletCap = () => bullets.length > 280;
  const bulMul = () => CHA().bulletMul ? CHA().bulletMul(CH, HEROIC) : 1; // velocidad de bala del capítulo (k)
  function fireBullet(x, y, a, sp, dmg, color, r = 7, src = 'shot') {
    bullets.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r, dmg, color, src });
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
    if (e.frzImm > 0) e.frzImm -= dt; // inmunidad a congelar (jefes): corre también mientras está congelado
    if (e.plague > 0) {
      e.plague -= dt;
      if (Math.random() < dt * 18) parts.push({ x: e.x + rand(-e.r, e.r), y: e.y, vx: 0, vy: -40, life: 0.4, max: 0.4, color: EL.poison.color, size: 2 });
    }
    if (e.frozen > 0) { // congelado: ni se mueve ni ataca
      e.frozen -= dt;
      if (e.frozen <= 0 && e.shatter) shatter(e);
      return;
    }
    if (e.kx || e.ky) { // empujón del impacto, se frena rápido
      e.x += e.kx * dt; e.y += e.ky * dt;
      const f = Math.pow(0.0004, dt);
      e.kx *= f; e.ky *= f;
      if (Math.abs(e.kx) + Math.abs(e.ky) < 2) e.kx = e.ky = 0;
    }
    const chill = (player.sk.ice || 0) >= 2 ? 0.5 : 0.62;
    const ds = dt * (e.slow > 0 ? chill : 1); // movimiento ralentizado por el hielo
    const dsA = dt * (e.slow > 0 ? 0.8 : 1); // sus ataques, menos (K10: el hielo no puede ser la escuela «segura»)
    const F = foeCfg();

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
        const a = angTo(e, player) + Math.sin(e.t * 2.6 + e.seed) * F.batZig;
        e.x += Math.cos(a) * e.speed * ds;
        e.y += Math.sin(a) * e.speed * ds;
        break;
      }
      case 'archer': {
        e.timer -= dsA;
        if (e.state === 'move') {
          wanderOrSeek(e, ds);
          if (e.timer <= 0) { e.state = 'aim'; e.timer = 0.6; }
        } else if (e.timer > 0) {
          if (e.timer > 0.15) e.aim = angTo(e, player);
        } else {
          const sp = (F.archer.sp[0] + e.lv * F.archer.sp[1]) * bulMul();
          if (!bulletCap()) {
            fireBullet(e.x, e.y, e.aim, sp, e.dmg, BUL.archer, 6, 'archer');
            if (e.lv >= 9) { fireBullet(e.x, e.y, e.aim - 0.22, sp, e.dmg, BUL.archer, 6, 'archer'); fireBullet(e.x, e.y, e.aim + 0.22, sp, e.dmg, BUL.archer, 6, 'archer'); }
            Sfx.eshot();
          }
          const t = freeCellNear(e.x, e.y, 150);
          Object.assign(e, { state: 'move', timer: rand(F.archer.cd[0], F.archer.cd[1]), tx: t.x, ty: t.y });
        }
        break;
      }
      case 'charger': {
        e.timer -= dsA;
        if (e.state === 'idle') {
          const a = chaseDir(e);
          e.x += Math.cos(a) * e.speed * ds; e.y += Math.sin(a) * e.speed * ds;
          if (e.timer <= 0 && dist(e, player) < 460) { e.state = 'wind'; e.timer = 0.65; e.aim = angTo(e, player); }
        } else if (e.state === 'wind') {
          if (e.timer > 0.2) e.aim = angTo(e, player);
          if (e.timer <= 0) { e.state = 'dash'; e.timer = 0.6; }
        } else if (e.state === 'dash') {
          e.x += Math.cos(e.aim) * F.dash * ds; e.y += Math.sin(e.aim) * F.dash * ds;
          const hit = collideRocks(e) | clampArena(e, false);
          if (hit || e.timer <= 0) {
            e.state = 'rest'; e.timer = F.rest;
            if (hit) { shake = Math.max(shake, 3); sparks(e.x, e.y, '#c9b38a', 8); }
          }
        } else if (e.timer <= 0) { e.state = 'idle'; e.timer = rand(1.2, 2.2); }
        break;
      }
      case 'mage': {
        e.timer -= dsA;
        if (e.state === 'idle') {
          wanderOrSeek(e, ds);
          if (e.timer <= 0) { e.state = 'cast'; e.timer = 0.75; }
        } else if (e.timer <= 0) {
          const n = 8 + Math.floor(e.lv / 5) * 2, off = rand(0, TAU);
          if (!bulletCap()) {
            for (let i = 0; i < n; i++) fireBullet(e.x, e.y, off + i * TAU / n, (F.mage.sp[0] + e.lv * F.mage.sp[1]) * bulMul(), e.dmg, BUL.mage, 7, 'mage');
            Sfx.eshot();
          }
          const t = freeCellNear(e.x, e.y, 120);
          Object.assign(e, { state: 'idle', timer: rand(F.mage.cd[0], F.mage.cd[1]), tx: t.x, ty: t.y });
        }
        break;
      }
      case 'bomber': { // corre hacia ti, se para, chisporrotea y explota
        e.timer -= dsA;
        if (e.state === 'idle') {
          const a = chaseDir(e);
          e.x += Math.cos(a) * e.speed * ds; e.y += Math.sin(a) * e.speed * ds;
          if (dist(e, player) < 72) { e.state = 'fuse'; e.timer = 0.8; }
        } else {
          if (Math.random() < dt * 20) sparks(e.x, e.y - e.r, '#ffd27a', 1);
          Sfx.sizzle();
          if (e.timer <= 0) { bomberBlast(e, true); return; }
        }
        break;
      }
      case 'totem': { // torreta fija: cruz de balas que va girando
        e.timer -= dsA;
        if (e.timer <= 0) {
          const n = e.lv >= 15 ? 6 : 4;
          if (!bulletCap()) {
            for (let i = 0; i < n; i++) fireBullet(e.x, e.y, e.spin + i * TAU / n, (F.totem.sp[0] + e.lv * F.totem.sp[1]) * bulMul(), e.dmg, BUL.totem, 6, 'totem');
            e.spin += 0.38;
            Sfx.eshot();
          }
          e.timer = e.lv >= 14 ? F.totem.cd[1] : F.totem.cd[0];
        }
        break;
      }
      case 'spirit': { // flota, se desvanece y reaparece a tu lado para dispararte
        e.timer -= dsA;
        if (e.state === 'idle') {
          const a = angTo(e, player) + Math.sin(e.t * 2 + e.seed) * 1.2;
          e.x += Math.cos(a) * e.speed * ds; e.y += Math.sin(a) * e.speed * ds;
          if (e.timer <= 0) { e.state = 'out'; e.timer = 0.35; e.tp = warnCfg().early ? spiritDest() || { x: e.x, y: e.y } : null; }
        } else if (e.state === 'out') {
          e.alpha = clamp(e.timer / 0.35, 0, 1);
          if (e.timer <= 0) {
            const t = e.tp || spiritDest();
            if (t) { e.x = t.x; e.y = t.y; }
            e.tp = null;
            e.state = 'in'; e.timer = 0.35;
          }
        } else if (e.state === 'in') {
          e.alpha = 1 - clamp(e.timer / 0.35, 0, 1);
          if (e.timer <= 0) {
            e.alpha = 1;
            const a = angTo(e, player), n = e.lv >= 15 ? 5 : 3;
            if (!bulletCap()) {
              for (let i = 0; i < n; i++) fireBullet(e.x, e.y, a + (i - (n - 1) / 2) * 0.2, (F.spirit.sp[0] + e.lv * F.spirit.sp[1]) * bulMul(), e.dmg, BUL.spirit, 6, 'spirit');
              Sfx.eshot();
            }
            e.state = 'idle'; e.timer = rand(1.8, 2.6);
          }
        }
        break;
      }
      case 'boss':
        updateBoss(e, ds, dsA);
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
      hurtPlayer(e.kind === 'boss' ? e.dmg * 1.4 : e.dmg, e.kind !== 'boss' ? 'contact' : e.state === 'dash' ? 'boss:charge' : 'boss:contact');
      if (perkLv('thorns') && !e.dead && runTime - (e.thornT || -9) > 0.5) {
        e.thornT = runTime;
        damageEnemy(e, player.atk * 1.5 * perkLv('thorns'), false, '#9be36a', true);
      }
      if (e.kind === 'bat') {
        const a = angTo(player, e);
        e.knock = 0.5; e.vx = Math.cos(a) * 160; e.vy = Math.sin(a) * 160;
      }
    }
  }

  // ---------- Jefes ----------
  function bossRing(b, off) {
    const n = b.ringN + (b.enraged ? 4 : 0);
    for (let i = 0; i < n; i++) fireBullet(b.x, b.y, off + i * TAU / n, (foeCfg().ring + b.tier * 12) * bulMul(), b.dmg, b.bcolor, 8, 'boss:ring');
    Sfx.eshot();
  }

  function bossIdle(b) {
    b.state = 'idle';
    b.timer = (rand(0.9, 1.5) - b.tier * 0.1) * (b.enraged ? 0.7 : 1);
  }

  const warnCfg = () => (CH && CH.warn) || CH_FALLBACK.ch.warn;
  // destino de un teletransporte: el jefe lejos de ti y fuera de las rocas; el espectro cerca de ti (null = no encontró)
  function bossTpDest() {
    for (let i = 0; i < 20; i++) {
      const t = { x: rand(AX + 60, AX + AW - 60), y: rand(AY + 80, AY + AH * 0.6) };
      if (dist(t, player) > 230 && !isRock(t.x, t.y)) return t;
    }
    return null;
  }
  function spiritDest() {
    for (let i = 0; i < 15; i++) {
      const a = rand(0, TAU), d = rand(150, 230);
      const t = { x: player.x + Math.cos(a) * d, y: player.y + Math.sin(a) * d };
      if (t.x > AX + 30 && t.x < AX + AW - 30 && t.y > AY + 30 && t.y < AY + AH - 30) return t;
    }
    return null;
  }

  function bossNext(b) {
    if (bulletCap()) return bossIdle(b); // D23: con la pantalla llena se salta el ataque
    const p = b.pats[b.pi++ % b.pats.length];
    b.sub = 0;
    if (p === 'ring') { b.state = 'ring'; b.timer = 0.3; }
    else if (p === 'spiral') { b.state = 'spiral'; b.timer = 2.2; b.acc = 0; }
    else if (p === 'aimed') { b.state = 'aimed'; b.timer = warnCfg().aimed; }
    else if (p === 'charge') { b.state = 'wind'; b.timer = 0.75; b.aim = angTo(b, player); }
    else if (p === 'summon') { b.state = 'summon'; b.timer = 0.6; }
    else if (p === 'teleport') { b.state = 'tpOut'; b.timer = 0.4; b.tp = warnCfg().early ? bossTpDest() || { x: b.x, y: b.y } : null; }
  }

  function updateBoss(b, ds, dsA = ds) {
    b.timer -= dsA;
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
        b.acc += dsA;
        const arms = b.tier >= 4 ? 4 : 3;
        while (b.acc >= 0.075) {
          b.acc -= 0.075; b.spin += 0.3;
          for (let k = 0; k < arms; k++) fireBullet(b.x, b.y, b.spin + k * TAU / arms, 185, b.dmg, b.bcolor, 7, 'boss:spiral');
        }
        if (b.timer <= 0) bossIdle(b);
        break;
      }
      case 'aimed':
        if (b.timer <= 0) {
          const a = angTo(b, player);
          for (let i = -2; i <= 2; i++) fireBullet(b.x, b.y, a + i * 0.17, 300, b.dmg, b.bcolor, 8, 'boss:aimed');
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
          const t = b.tp || bossTpDest();
          if (t) { b.x = t.x; b.y = t.y; }
          b.tp = null;
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
    if (e.frozen > 0) dmg *= player.tr.frozenMul || 1.3; // los congelados reciben más daño
    if (e.corrode > 0) dmg *= e.corrMul || 1.4; // corrosión (rayo + veneno)
    if (e.kind === 'boss' && FX()) gainAnima(Math.min(dmg, Math.max(0, e.hp)) / e.maxHp * Forms().ANIMA.boss); // +40 de Ánima por jefe entero
    e.hp -= dmg;
    e.flash = 0.08;
    if (e.kind === 'boss') gainMana(dmg / e.maxHp * 45);
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
    const HL = healCfg(), full = HL.fullAt && player.hp >= player.maxHp * HL.fullAt; // con la vida casi llena no cae corazón
    const hearts = isBoss ? HL.bossHearts : Math.random() < (e.elite ? HL.eliteHeart : HL.heart) && !full ? 1 : 0;
    for (let i = 0; i < hearts; i++) drops.push({ type: 'heart', x: e.x, y: e.y, vx: rand(-120, 120), vy: rand(-120, 120), t: 0 });
    if (player.sk.blood) heal(player.maxHp * 0.015 * player.sk.blood);
    if (perkLv('lifeOnKill')) { // Sed de sangre: 0,75 % por nivel y baja, como mucho un 1 % de la vida máxima por segundo
      const tok = Math.min(0.01, (player.lokTok != null ? player.lokTok : 0.01) + (runTime - (player.lokT || 0)) * 0.01);
      const got = Math.min(tok, 0.0075 * perkLv('lifeOnKill'));
      player.lokTok = tok - got; player.lokT = runTime;
      if (got > 0) heal(player.maxHp * got);
    }
    if (!isBoss) gainMana(e.minion ? 2 : e.elite ? 10 : 5);
    const F = FX();
    if (F && !isBoss && !e.wiped) gainAnima(e.minion ? F.ANIMA.minion : e.elite ? F.ANIMA.elite : F.ANIMA.kill);
    if (isBoss) {
      bossesKilled++;
      meta.stats.bosses++;
      slowT = 1.1;
      unlock(e.ach || 'boss' + e.tier);
      if (!roomHit) unlock('untouchable');
      boss = null;
      for (const o of enemies) if (!o.dead && o !== e) { o.wiped = true; killEnemy(o); }
      // redes de seguridad del despertar, por ordinal del jefe en el capítulo (C1: (a) quien nunca ha despertado, tras
      // el Gólem; (b) 1º tras el Rey Slime; (c) 2º tras el Brujo)
      if (F) {
        const aw = player.awak, N = CHA().nets(CH);
        if (e.ord === N.a && aw === 0 && !(meta.grim.f & ~1)) fillAnima('a');
        else if (e.ord === N.b && aw === 0) fillAnima('b');
        else if (e.ord === N.c && aw === 1) fillAnima('c');
      }
      return;
    }
    if (e.wiped) return; // muerto por la caída del jefe: sin efectos en cadena
    formDeath(e);
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
    if (detonated && dist(e, player) < rad + player.r) hurtPlayer(e.dmg, 'bomb');
    for (const o of enemies) {
      if (o === e || o.dead || o.spawnT > 0) continue;
      if (dist(o, e) < rad + o.r) damageEnemy(o, 30 * dmgMul(), false, '#ffb347', true);
    }
    if (detonated && !e.dead) killEnemy(e); // selfBlast: no cuenta como baja tuya
  }

  function chainLightning(src, dmg, n = 2, r = 200, lay = null) {
    const near = enemies
      .filter(o => o !== src && !o.dead && o.spawnT <= 0)
      .map(o => ({ o, d: dist(o, src) }))
      .filter(x => x.d < r)
      .sort((a, b) => a.d - b.d)
      .slice(0, n);
    const F = FX(), layers = lay || (F ? F.BOLT_LAYERS[player.form] || null : null); // Plasma, Aurora y Eclipse tiñen sus rayos (Chispazo: los del cielo)
    for (const { o } of near) {
      bolts.push({ x1: src.x, y1: src.y, x2: o.x, y2: o.y, life: 0.18, layers });
      damageEnemy(o, dmg, false, '#9fe8ff', true);
      if (!o.dead) o.shock = Math.max(o.shock, 1.5);
    }
    if (near.length) Sfx.zap();
  }

  // ---------- Elementos y reacciones ----------
  // mul: multiplica lo que suma el veneno por impacto. Un elemento sin runa (esquirlas, charcos) cuenta como Nv1
  function applyElements(e, els, mul = 1) {
    const s = player.sk, tr = player.tr;
    if (els.includes('fire')) { e.burn = tr.burnT || 2.5; e.burnDps = Math.max(e.burnDps, player.atk * (tr.burnK || 0.35) * (s.fire || 1)); }
    if (els.includes('ice')) e.slow = tr.slowT || 1.8;
    if (els.includes('bolt')) e.shock = 2;
    if (els.includes('poison')) {
      const lv = s.poison || 1, cap = player.atk * (tr.poisonCap || 0.8) * lv; // no rebaja un veneno más fuerte (p. ej. el de la Plaga)
      if (e.poisonDps < cap) e.poisonDps = Math.min(e.poisonDps + player.atk * (tr.poisonK || 0.1) * lv * mul, cap);
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
    const tr = player.tr;
    e.reactCd = e.kind === 'boss' ? 1 : (tr.reactCd || 1);
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
      pushToast({ text: `¡${r.name}!`, sub: `${EL[r.a].name} + ${EL[r.b].name}: ${r.desc}`, color: r.color, t: 2.6, max: 2.6 });
    }
    const F = FX();
    if (F && roomReactA < F.ANIMA.reactCap) { // Ánima por reacción, con tope por sala
      const v = Math.min(F.ANIMA.react, F.ANIMA.reactCap - roomReactA);
      roomReactA += v;
      gainAnima(v);
    }
    // el estado que consume la reacción se borra DESPUÉS del daño: si la reacción mata, los rasgos al morir (Pira, charcos) aún lo ven
    if (r.id === 'vapor') {
      for (let i = 0; i < 16; i++) parts.push({ x: e.x + rand(-12, 12), y: e.y, vx: rand(-40, 40), vy: rand(-140, -60), life: rand(0.4, 0.8), max: 0.8, color: '#e8f7ff', size: rand(3, 6) });
      rings.push({ x: e.x, y: e.y, r0: e.r, r1: e.r + 40, t: 0.3, max: 0.3, color: r.color, w: 4 });
      damageEnemy(e, atk * (tr.vaporK || 3), true, r.color);
      e.burn = 0; e.burnDps = 0; e.slow = 0;
    } else if (r.id === 'overload') {
      e.shock = 0;
      explode(e.x, e.y, tr.overR || 95, atk * (tr.overK || 2.2), r.color);
    } else if (r.id === 'freeze') {
      e.slow = 0; e.shock = 0;
      freezeEnemy(e, tr.freezeT || 1.6, tr.freezeBossT || 0.7);
      rings.push({ x: e.x, y: e.y, r0: e.r + 20, r1: e.r, t: 0.3, max: 0.3, color: r.color, w: 4 });
      Sfx.freeze();
    } else if (r.id === 'corrode') {
      e.shock = 0;
      e.corrMul = tr.corrMul || 1.4;
      e.corrode = tr.corrT || 4;
      rings.push({ x: e.x, y: e.y, r0: e.r, r1: e.r + 30, t: 0.35, max: 0.35, color: r.color, w: 3 });
      for (let i = 0; i < 10; i++) parts.push({ x: e.x + rand(-e.r, e.r), y: e.y + rand(-e.r, e.r), vx: rand(-30, 30), vy: rand(20, 70), life: rand(0.4, 0.7), max: 0.7, color: r.color, size: rand(2, 3.5) });
    } else if (r.id === 'combust') {
      explode(e.x, e.y, tr.combR || 85, atk * (tr.combK || 1.5), r.color, atk * 0.15 * Math.max(1, player.sk.poison || 1));
      e.burn = 0; e.burnDps = 0;
    } else if (r.id === 'necro') {
      necrosis(e, atk);
      Sfx.tone(1100, 0.25, 'sine', 0.06, 0.5);
    }
    if (tr.implode && takeTok('implode')) implode(e, tr.implode); // Eclipse: Aniquilación
  }
  // NECROSIS (hielo + veneno): el veneno acumulado revienta de golpe (con tope) y la mitad salta a los de al lado.
  // También la lanza Invierno negro sobre todos al acabar (con los valores de Mortaja)
  function necrosis(e, atk) {
    const tr = player.tr, pd = e.poisonDps, half = pd * 0.5, spread = tr.necroSpread || 70;
    rings.push({ x: e.x, y: e.y, r0: e.r, r1: e.r + 40, t: 0.3, max: 0.3, color: '#5fffd0', w: 4 });
    for (let i = 0; i < (lowQ() ? 4 : 10); i++) {
      const a = rand(0, TAU), v = rand(60, 180);
      parts.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.3, 0.55), max: 0.55, color: '#eafffa', size: rand(2, 3.5) });
    }
    if (half > 0) for (const o of enemies) {
      if (o === e || o.dead || o.spawnT > 0) continue;
      if (Math.hypot(o.x - e.x, o.y - e.y) < spread + o.r) o.poisonDps = Math.max(o.poisonDps, half);
    }
    damageEnemy(e, clamp(pd * (tr.necroK || 3), 1.5 * atk, (tr.necroCap || 4) * atk), true, '#5fffd0');
    e.poisonDps = 0; // después del daño: si muere, el charco de Ponzoña aún lo ve envenenado
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
    const tr = player.tr, fx = !ar.nofx, els = ar.els;
    // Eclipse (Desequilibrio): contra no jefes, los elementos del propio disparo cuentan como estado previo
    const rx = tr.firstHit && fx && e.kind !== 'boss'
      ? { fire: had.fire || els.includes('fire'), ice: had.ice || els.includes('ice'), bolt: had.bolt || els.includes('bolt'), poison: had.poison || els.includes('poison') } : had;
    subHit = !fx; damageEnemy(e, dmg, crit); subHit = false;
    // Chispazo (Mezcla): cada crítico lanza una cadena de rayos
    if (crit && fx && mixOn('chispazo') && takeTok('spark')) { const P = MIXP.chispazo.p; chainLightning(e, dmg * P.k * mixOn('chispazo'), P.n, P.r, BOLT_SKY); }
    if (!e.dead && !e.heavy) { // retroceso al recibir el impacto
      const sp = Math.hypot(ar.vx, ar.vy) || 1;
      const kb = 80 * (e.kbMul != null ? e.kbMul : 0.6); // embestidores y élites no retroceden: el cuerpo a cuerpo llega
      e.kx = (e.kx || 0) + ar.vx / sp * kb; e.ky = (e.ky || 0) + ar.vy / sp * kb;
    }
    // nofx (esquirlas y proyectiles secundarios): sin reacciones, sin cadena y sin rasgos; solo daño y elementos
    if (fx && !e.dead && e.reactCd <= 0) {
      for (const r of REACTIONS) {
        if (r.id === 'freeze' && e.frzImm > 0) continue; // jefe aún inmune a congelar: no gasta sus estados
        if ((els.includes(r.a) && rx[r.b]) || (els.includes(r.b) && rx[r.a])) { react(r, e); break; }
      }
    }
    if (!e.dead) applyElements(e, els, ar.needle ? MIXP.aguijon.p.poison * mixOn('aguijon') : 1); // Aguijón: veneno ×2
    if (ar.sty && ar.sty.hit) sparks(ar.x, ar.y, ar.sty.hit, lowQ() ? 2 : 4); // Glacial y Aurora: chispas de escarcha
    if (fx && !e.dead) {
      // Glacial (Gélido): golpear a un ralentizado puede congelarlo (jefes, menos y con rendimientos decrecientes)
      if (tr.frzChance && had.ice && e.frozen <= 0 && Math.random() < tr.frzChance && freezeEnemy(e, tr.frzT || 0.7, tr.frzBossT || 0.35)) {
        rings.push({ x: e.x, y: e.y, r0: e.r + 14, r1: e.r, t: 0.25, max: 0.25, color: '#bff4ff', w: 3 });
        if (Sfx.gate('frz', 120)) Sfx.tone(1400, 0.15, 'sine', 0.04, 0.6);
      }
      // Plasma: arco al enemigo más cercano si este arde
      if (tr.plasmaArc && had.fire && Math.random() < tr.plasmaArc.p) plasmaArc(e, ar, tr.plasmaArc); // ya ardía antes del impacto
    }
    if (fx && els.includes('bolt') && Math.random() < (tr.chainP || 0.16) * (player.sk.bolt || 1)) chainLightning(e, ar.dmg * (tr.chainK || 0.4), tr.chainN || 2, tr.chainR || 200);

    if (ar.rico > 0) {
      let best = null, bd = 280 * 280;
      for (const o of enemies) {
        if (o === e || o.dead || o.spawnT > 0 || ar.hit.has(o)) continue;
        const d2 = (o.x - ar.x) ** 2 + (o.y - ar.y) ** 2;
        if (d2 < bd) { bd = d2; best = o; }
      }
      if (best) {
        ar.rico--; ar.dmg *= 0.75; // −25 % por salto
        const a = angTo(ar, best);
        ar.vx = Math.cos(a) * SHOT_SPEED; ar.vy = Math.sin(a) * SHOT_SPEED;
        ar.life = Math.max(ar.life, 0.8);
        if (fx) {
          // Granizo: 2 esquirlas de hielo a ±35° del salto
          const mg = mixOn('granizo');
          if (mg) { const P = MIXP.granizo.p; for (const s of [-1, 1]) spawnSub(ar.x, ar.y, a + s * P.ang * Math.PI / 180, player.atk * P.k * mg, ['ice'], { life: P.life, sub: 'hail' }); }
          // Contagio: el veneno del que recibe el golpe pasa al siguiente
          if (mixOn('contagio') && e.poisonDps > best.poisonDps) { best.poisonDps = e.poisonDps; sparks(best.x, best.y, '#8dff6a', 4); }
        }
        return;
      }
    }
    if (ar.pierce > 0) {
      ar.pierce--; ar.dmg *= 0.75; // −25 % por enemigo atravesado
      const mc = fx ? mixOn('cometa') : 0;
      if (mc && takeTok('comet')) cometa(ar.x, ar.y, mc); // Cometa: llamarada al atravesar
      return;
    }
    ar.dead = true;
  }
  // Cometa (Mezcla): llamarada r40·m que hace 0,5×atk·m y prende a los de alrededor
  function cometa(x, y, m) {
    const P = MIXP.cometa.p, r = P.r * m, d = player.atk * P.k * m;
    rings.push({ x, y, r0: 6, r1: r, t: 0.25, max: 0.25, color: '#ff8a3d', w: 4 });
    burst(x, y, '#ffb347', 8, 180);
    for (const o of enemies) {
      if (o.dead || o.spawnT > 0 || (o.x - x) ** 2 + (o.y - y) ** 2 > (r + o.r) ** 2) continue;
      damageEnemy(o, d, false, '#ff8a3d', true);
      if (!o.dead) applyElements(o, ['fire']);
    }
    if (Sfx.gate('comet', 70)) Sfx.tone(240, 0.18, 'sawtooth', 0.05, 0.5);
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
            ar.x = px; ar.y = py; // ya no vuelve a dar a los que tocó (sin hit.clear)
            // Glaciar (Mezcla): la primera vez que rebota se parte en 2 (±25°) con el 60% del daño cada uno;
            // la otra mitad es un secundario (nofx) que entra en shots al acabar el bucle
            const mg = !ar.nofx && !ar.split ? mixOn('glaciar') : 0;
            if (mg) {
              const P = MIXP.glaciar.p, a = Math.atan2(ar.vy, ar.vx), da = P.ang * Math.PI / 180, sp = Math.hypot(ar.vx, ar.vy);
              ar.dmg *= P.k * mg; ar.split = true;
              ar.vx = Math.cos(a + da) * sp; ar.vy = Math.sin(a + da) * sp;
              const o = spawnSub(ar.x, ar.y, a - da, ar.dmg, ar.els, { life: ar.life, wall: ar.wall, split: true, col: ar.col, col2: ar.col2 });
              if (o) { o.vx = Math.cos(a - da) * sp; o.vy = Math.sin(a - da) * sp; }
              if (Sfx.gate('split', 80)) Sfx.tone(1700, 0.08, 'triangle', 0.04, 0.7);
            } else ar.dmg *= 0.6; // −40 % por rebote (el rebote que parte el Glaciar ya reparte su daño)
          } else {
            ar.dead = true;
            sparks(px, py, '#d8d0ea', 3);
          }
        }
      }
    }
    shots = shots.filter(a => !a.dead);
    if (shotQ.length) { shots = shots.concat(shotQ); shotQ = []; } // secundarios creados durante el bucle
  }

  function updateBullets(dt) {
    const k = fog ? 0.5 : 1; // Invierno negro: las balas enemigas van a la mitad
    for (const b of bullets) {
      b.x += b.vx * dt * k; b.y += b.vy * dt * k;
      if (isRock(b.x, b.y)) { b.dead = true; sparks(b.x, b.y, b.color, 3); continue; }
      const rr = b.r + player.r - 4;
      if ((b.x - player.x) ** 2 + (b.y - player.y) ** 2 < rr * rr) { hurtPlayer(b.dmg, b.src); b.dead = true; }
    }
    bullets = bullets.filter(b => !b.dead);
  }

  function collectDrop(g) {
    if (g.type === 'gem') {
      addXp(g.v);
      Sfx.gem();
      const col = g.v >= 5 ? '#5ab8ff' : '#5df2a0';
      sparks(player.x, player.y - 6, col, 3);
      if (state === 'play') flyers.push({ x0: player.x, y0: player.y - 10, t: 0, dur: rand(0.32, 0.45), col, side: rand(-1, 1) });
      hudFx.hold = 0.3; // la barra espera a que lleguen las chispas
    } else heal(player.maxHp * healCfg().heartVal);
  }

  function updateDrops(dt) {
    const fr = Math.pow(0.02, dt);
    let k = 0;
    for (const g of drops) {
      g.t += dt;
      const d = dist(g, player);
      if ((cleared || d < (perkLv('magnet') ? 150 : 70)) && !g.magnet) { // empieza el imán: cada gema con su pequeño retraso
        g.magnet = true; g.mt = -(cleared ? 0.2 + (k++) * 0.035 : 0); g.curl = rand(-1, 1) * 260;
      }
      if (g.magnet) {
        g.mt += dt;
        if (g.mt < 0) { g.vx *= fr; g.vy = g.vy * fr - 30; } // flota hacia arriba un instante
        else {
          const a = angTo(g, player), sp = 260 + g.mt * 900;
          const curl = g.curl * Math.max(0, 1 - g.mt * 2.5); // espiral que se cierra
          g.vx = Math.cos(a) * sp - Math.sin(a) * curl; g.vy = Math.sin(a) * sp + Math.cos(a) * curl;
          if (g.type === 'gem' && Math.random() < dt * 30) parts.push({ x: g.x, y: g.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: g.v >= 5 ? '#5ab8ff' : '#5df2a0', size: 2 });
        }
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
  // final de la Ventisca: el bloque de hielo revienta, daña al enemigo y salpica a los de al lado
  let shatterSfxT = 0;
  function shatter(e) {
    e.shatter = false;
    if (e.dead || !player) return;
    const atk = player.atk;
    rings.push({ x: e.x, y: e.y, r0: e.r, r1: e.r + 46, t: 0.3, max: 0.3, color: '#dff8ff', w: 4 });
    for (let i = 0; i < 10; i++) {
      const a = rand(0, TAU), v = rand(120, 260);
      parts.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: rand(0.35, 0.6), max: 0.6, color: i % 2 ? '#bff4ff' : '#ffffff', size: rand(2.5, 4.5) });
    }
    for (const o of enemies) {
      if (o === e || o.dead || o.spawnT > 0) continue;
      if (Math.hypot(o.x - e.x, o.y - e.y) < 70 + o.r) damageEnemy(o, atk, false, '#bff4ff', true);
    }
    damageEnemy(e, atk * 4, false, '#bff4ff');
    shake = Math.max(shake, 5);
    if (clock - shatterSfxT > 0.08) { shatterSfxT = clock; Sfx.freeze(); }
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
    if (banner) { banner.t -= dt; if (banner.t <= 0) { banner = bannerNext; bannerNext = null; } }
    if (!cine && !awakenFx) { // la cola espera a la entrada del jefe y a la transformación; con cola, cada aviso dura menos (nunca menos de 2 s)
      if (toast) { toast.t -= dt * (toastQ.length > 2 ? Math.min(1.5, toast.max / 2) : 1); if (toast.t <= 0) showToast(toastQ.shift() || null); }
      else if (toastQ.length) showToast(toastQ.shift());
    }
    if (!achBusy && achQueue.length) nextAch(); // los logros retenidos durante el despertar
    if (screenFlash && !screenFlash.real) { screenFlash.t -= dt; if (screenFlash.t <= 0) screenFlash = null; }
    if (eclipseFx) { eclipseFx.t -= dt; if (eclipseFx.t <= 0) eclipseFx = null; }
    if (cine) { cine.t -= dt; if (cine.t <= 0) { cine = null; hazardHints(); } }
    shake = Math.max(0, shake - dt * 40);
    if (hurtFlash > 0) hurtFlash -= dt;
  }

  // ================================================================
  //  Trampas y cofres
  // ================================================================
  function cellIndex(x, y) {
    const c = Math.floor((x - AX) / CELL), r = Math.floor((y - AY) / CELL);
    return c < 0 || c >= COLS || r < 0 || r >= ROWS ? -1 : r * COLS + c;
  }
  function hzAt(x, y) { const i = cellIndex(x, y); return i < 0 ? 0 : hz[i]; }
  // pinchos: 0 escondidos, 1 avisando, 2 arriba (ciclo de 3 s desfasado por grupo)
  function spikePhase(i) {
    if (i < 0) return 0;
    const t = (hzClock + hzOff[i]) % 3;
    return t > 2.1 ? 2 : t > 1.4 ? 1 : 0; // 1,4 s escondidos, 0,7 s avisando, 0,9 s arriba
  }

  function placeHazards(bossDef) {
    hz.fill(0);
    hzOff.fill(0);
    const special = BIOME_HAZARD[biomeId() || 'cripta'] || 0;
    // nunca en la zona de aparición ni delante de la puerta
    const blocked = (c, r) => (r >= 15 && c >= 3 && c <= 8) || (r <= 2 && c >= 3 && c <= 8);
    const cluster = (type, size, c, r) => {
      const off = rand(0, 3);
      for (let k = 0; k < size * 4 && size > 0; k++) {
        const i = r * COLS + c;
        if (!blocked(c, r) && !grid[i] && !hz[i]) { hz[i] = type; hzOff[i] = off; size--; }
        const d = pick(DIR4);
        c = clamp(c + d[0], 0, COLS - 1); r = clamp(r + d[1], 1, ROWS - 1);
      }
    };
    if (bossDef) { // arena temática de cada jefe
      if (bossDef.arena === 'golem') for (const [c, r] of [[3, 9], [8, 9], [5, 4], [6, 13]]) cluster(HZ.SPIKES, 2, c, r);
      else if (bossDef.arena === 'rey') for (const [c, r] of [[2, 3], [9, 3], [1, 15], [10, 15], [5, 9]]) cluster(HZ.POISON, 4, c, r);
      else if (bossDef.arena === 'brujo') { cluster(HZ.ICE, 16, 5, 9); cluster(HZ.ICE, 8, 2, 4); cluster(HZ.ICE, 8, 9, 4); }
      else {
        for (let r = 6; r <= 13; r++) for (const c of [0, 1, 10, 11]) { const i = r * COLS + c; if (!grid[i]) hz[i] = HZ.LAVA; }
        cluster(HZ.SPIKES, 3, 5, 4); cluster(HZ.SPIKES, 3, 6, 12);
      }
      return;
    }
    const Z = CHA().hazard(CH, HEROIC, room);
    if (room < Z.from || altarAt(room) || Math.random() > Z.chance) return;
    const n = randi(Z.n[0], Z.n[1]);
    for (let k = 0; k < n; k++) {
      const type = special && Math.random() < Z.special ? special : HZ.SPIKES;
      const size = type === HZ.ICE ? randi(6, 10) : type === HZ.SPIKES ? randi(2, 4) : randi(3, 6);
      cluster(type, size, randi(1, COLS - 2), randi(3, 13));
    }
  }

  // la primera vez que aparece cada trampa, un aviso explicándola
  function hazardHints() {
    const seen = settings.seenHz || (settings.seenHz = {});
    for (const t of [1, 2, 3, 4]) {
      if (seen[t] || !hz.includes(t) || [toast, ...toastQ].some(x => x && x.hz === t)) continue; // visto o ya en cola
      pushToast({ text: HZ_INFO[t].name, sub: HZ_INFO[t].tip, color: HZ_INFO[t].color, t: 3, max: 3, hz: t }); // se da por visto al salir
      return;
    }
  }

  function placeChest(cells) {
    const spot = cells.find(p => { const i = cellIndex(p.x, p.y); return i >= 0 && !hz[i] && p.y > AY + 160 && p.y < AY + 540; });
    if (!spot) return;
    chest = { x: spot.x, y: spot.y, opened: false, openT: 0 };
    chestsThisRun++;
  }

  function openChest() {
    chest.opened = true;
    chest.openT = 0;
    Sfx.ach();
    burst(chest.x, chest.y - 10, '#ffd25a', 34, 260);
    rings.push({ x: chest.x, y: chest.y, r0: 10, r1: 90, t: 0.5, max: 0.5, color: '#ffd25a', w: 5 });
    for (let i = 0; i < 5; i++) drops.push({ type: 'gem', v: 5, x: chest.x, y: chest.y - 8, vx: rand(-170, 170), vy: rand(-200, -40), t: 0 });
    heal(player.maxHp * healCfg().chest);
    runBonusEss += 5;
    if (Gear()) { // un objeto de equipo, algo mejor que el de la sala
      const it = addGear(Gear().rollDrop(CHA().lootDepth(CH, HEROIC, room, 3), Math.random));
      if (it) {
        runLoot.push(it); saveMeta();
        const d = Gear().describe(it);
        addText(chest.x, chest.y - 64, d.icon + ' ' + d.rarityName, d.color, 1.1);
      } else { lostLoot++; addText(chest.x, chest.y - 64, '🎒 Inventario lleno', '#ff8a8a', 1.1); }
    }
    addText(chest.x, chest.y - 40, '+✨ 5', '#ffcf4a', 1.1);
    bonusPicks.push('chest');
    meta.stats.chests++;
    if (meta.stats.chests >= 5) unlock('chests');
  }

  // ================================================================
  //  Salas
  // ================================================================
  function spawnRoom() {
    enemies = [];
    const B = bossAt(room);
    placeHazards(B);
    if (B) {
      boss = makeBoss(B);
      boss.spawnT = boss.spawnMax = 2.4; // aparece durante la entrada cinematográfica
      enemies.push(boss);
      cine = { t: 2.7, max: 2.7, name: B.name, title: B.title || '', color: B.bullet };
      banner = null;
      shake = Math.max(shake, 6);
      Sfx.boss();
      music('boss');
      return; // los avisos de trampas salen al acabar la entrada
    }
    boss = null;
    if (altarAt(room)) { // sala tranquila antes del jefe
      altar = { x: AX + AW / 2, y: AY + 340, used: false };
      banner = { text: 'ALTAR', sub: 'Tócalo para recibir una bendición', color: '#ffd27a', t: 1.8, max: 1.8 };
      music('menu');
      return;
    }
    if (state !== 'school') music('dungeon');
    const reach = bfs(grid, SPAWN_C, SPAWN_R, new Int16Array(COLS * ROWS));
    const cells = [], sd = CHA().spawnDist(CH, room);
    for (let i = 0; i < COLS * ROWS; i++) {
      if (grid[i] || reach[i] < 0) continue;
      const c = i % COLS, r = (i / COLS) | 0;
      const x = AX + c * CELL + CELL / 2, y = AY + r * CELL + CELL / 2;
      if (r < 15 && Math.hypot(x - player.x, y - player.y) > sd) cells.push({ x, y });
    }
    shuffle(cells);
    let elites = 0;
    const CC = CHA().chest(CH), EP = CHA().eliteParams(CH, HEROIC, room);
    if (room >= CC.from && chestsThisRun < CC.max && Math.random() < CC.p) placeChest(cells.slice().reverse());
    let list = roomEnemies(room);
    const WV = CHA().wavesAt ? CHA().wavesAt(CH, HEROIC, room) : null;
    if (WV && list.length >= 3) { // refuerzos: el 60 % sale ahora y el 40 % espera en waveQ
      const cut = Math.ceil(list.length * (1 - WV.share));
      waveQ = list.slice(cut); list = list.slice(0, cut); wave1N = list.length; waveAt = WV.at;
    }
    list.forEach((k, i) => {
      const p = cells[i % Math.max(1, cells.length)] || { x: AX + AW / 2, y: AY + 150 };
      const e = makeEnemy(k, k === 'totem' ? p.x : p.x + rand(-5, 5), k === 'totem' ? p.y : p.y + rand(-5, 5), i * (CH.spawnStep || 0.05));
      if (EP.p > 0 && elites < EP.max && Math.random() < EP.p) { makeElite(e, EP.hp); elites++; } // p = 0 antes de su sala: sin gastar azar
      enemies.push(e);
    });
    banner = { text: 'SALA ' + room, sub: room === lastRoom() - 1 ? 'Se oye algo enorme al otro lado…' : '', color: '#ffffff', t: 1.4, max: 1.4 };
    if (chest) banner.sub = 'Hay un cofre: limpia la sala para abrirlo';
    hazardHints();
    if (CHA().zoneStart(CH, room) && Biomes()) { // nueva zona = nuevo bioma
      try {
        const info = Biomes().info(biomeId());
        banner = { text: 'CAPÍTULO ' + (CHA().zoneAt(CH, room) + 1), sub: info.name + (chest ? ' · hay un cofre' : ''), color: info.accent || '#ffd27a', t: 2.2, max: 2.2 };
      } catch (_) { /* sin biomas */ }
    }
  }

  // Refuerzos (§4.5): la tanda que quedó en waveQ aparece lejos de ti, con su círculo violeta y su rótulo
  function spawnWave() {
    const ks = waveQ, EP = CHA().eliteParams(CH, HEROIC, room);
    waveQ = [];
    const cells = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      if (grid[i]) continue;
      const c = i % COLS, r = (i / COLS) | 0;
      const x = AX + c * CELL + CELL / 2, y = AY + r * CELL + CELL / 2;
      if (r < 12 && Math.hypot(x - player.x, y - player.y) > 220) cells.push({ x, y });
    }
    shuffle(cells);
    let elites = enemies.filter(o => o.elite && !o.dead).length;
    ks.forEach((k, i) => {
      const p = cells[i % Math.max(1, cells.length)] || { x: AX + AW / 2, y: AY + 150 };
      const e = makeEnemy(k, p.x, p.y, i * (CH.spawnStep || 0.04));
      e.wave = true;
      if (EP.p > 0 && elites < EP.max && Math.random() < EP.p) { makeElite(e, EP.hp); elites++; } // también pueden traer élite
      enemies.push(e);
    });
    banner = { text: '¡REFUERZOS!', sub: '', color: '#ff8a5a', t: 1.2, max: 1.2 };
    Sfx.boss();
    if (!settings.tips.waves) pushToast({ text: 'REFUERZOS', sub: 'No te confíes al quedar pocos: llegan más', color: '#ff8a5a', t: 3, max: 3, tip: 'waves' });
  }

  function nextRoom() {
    const auto = healCfg().autoHearts; // al salir solo se recogen solas las gemas: los corazones hay que pisarlos (K3)
    for (const g of drops) if (auto || g.type === 'gem') collectDrop(g); // la experiencia no se pierde al cambiar de sala
    waveQ = []; wave1N = 0;
    room++;
    if (progStars(false)) saveMeta(); // la estrella de tercio cuenta al llegar, aunque mueras en esta sala
    if (room >= 10) unlock('room10');
    if (tut && room >= 2) tutDone();
    roomHit = false;
    grid = genRocks(!!bossAt(room) || altarAt(room));
    roomBgDirty = true;
    shots = []; shotQ = []; bullets = []; drops = []; bolts = []; volleys = []; parts = []; texts = [];
    rings = []; meteors = []; storm = null; sing = null; altar = null; chest = null; cine = null;
    pools = []; amb = []; ash = []; roomReactA = 0; awakenWait = 0; curtains = []; fog = null;
    bannerNext = null; eclipseFx = null; // el rótulo pendiente y las esquirlas del Eclipse no pasan a la sala nueva
    if (toast) delete toast.low; // el aviso que iba bajo el rótulo vuelve arriba: en la sala nueva hay combate en medio
    hz.fill(0);
    Object.assign(player, { x: AX + AW / 2, y: AY + AH - 50, face: -Math.PI / 2, cd: 0.35, still: 0, vx: 0, vy: 0 });
    if (perkLv('roomShield')) player.shield = Math.max(player.shield, 1);
    cleared = false; doorAnim = 0; flowT = 0;
    spawnRoom();
  }

  function onCleared() {
    cleared = true;
    for (const b of bullets) sparks(b.x, b.y, b.color, 2);
    bullets = [];
    const isBossRoom = !!bossAt(room);
    if (isBossRoom) heal(player.maxHp * healCfg().boss);
    if (perkLv('roomShield') >= 2) heal(player.maxHp * 0.06);
    if (!roomHit && FX() && (isBossRoom || !altarAt(room))) gainAnima(Forms().ANIMA.clean); // sala limpia sin recibir daño
    if (room >= lastRoom()) { winTimer = 2.2; pendingLevels = 0; }
    else Sfx.door();
    if (tut && room === 1) tut.step = 'door';
  }

  function newRun() {
    { const s = settings.chapter, ok = chForce || chOpen(s.id, s.hero); // capítulo y modo de la partida
      CH = resolveCH(ok ? s.id : 1, ok && s.hero); HEROIC = !!CH.hero; }
    player = newPlayer();
    recalc();
    room = 0; kills = 0; runTime = 0; winTimer = -1; bossesKilled = 0; runEssence = 0;
    shake = 0; hurtFlash = 0; fade = 0; banner = null;
    toast = null; screenFlash = null;
    toastQ = []; bannerNext = null; flashNext = null; awakenFx = null; eclipseFx = null; musicHoldT = 0;
    pactRun = false; pools = []; amb = []; ash = []; roomReactA = 0; awakenWait = 0; fxDepth = 0; netLog = []; ambT = 0;
    curtains = []; fog = null; seenMixes.clear();
    runGrim0 = grimPages(); runProg = null; hitStat = HIT_STAT0(); lastHit = null; waveQ = []; wave1N = 0;
    seenReactions.clear();
    pendingLevels = 0;
    runUlts = 0; runReacts = 0;
    runSeed = Math.floor(Math.random() * 1e9);
    chestsThisRun = 0; bonusPicks = []; runBonusEss = 0; hzClock = 0; runLoot = []; lostLoot = 0;
    Object.assign(hudFx, { xpShow: 0, lvlShow: 1, hold: 0, flash: 0, pulse: 0, wait: 0 }); flyers = []; hudParts = [];
    slowT = 0;
    // nada de la partida anterior: ni gemas en el suelo ni efectos a medias
    drops = []; enemies = []; shots = []; shotQ = []; bullets = []; parts = []; texts = []; bolts = []; volleys = [];
    Object.assign(tok, TOK_MAX);
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
    const F = FX(), p = player;
    if (S.el) { p.sk[S.el] = 1; if (F) p.aff = [S.el]; } // la escuela fija el 1er elemento de la Afinidad
    for (const [k, v] of Object.entries(S.grant || {})) p.sk[k] = (p.sk[k] || 0) + v;
    const perks = Object.entries((p.gear && p.gear.perks) || {});
    for (const [perk, lv] of perks) if (perk === 'extraShot') p.sk.front = Math.min(3, (p.sk.front || 0) + lv);
    // runas del equipo: primero las de más nivel y, si empatan, las de bastón antes que la del anillo.
    // Si caben en la Afinidad se aplican como siempre; si no, se funden en daño (+6% por nivel, tope +24%)
    const BASTON = ['fire', 'ice', 'bolt'];
    const runes = perks.filter(([k]) => k.startsWith('startRune:')).map(([k, lv]) => [k.slice(10), lv]).filter(([el]) => ELEMENTS.includes(el))
      .sort((a, b) => b[1] - a[1] || (BASTON.includes(a[0]) ? 0 : 1) - (BASTON.includes(b[0]) ? 0 : 1));
    for (const [el, lv] of runes) {
      if (!F || p.aff.includes(el) || p.aff.length < 2) {
        p.sk[el] = Math.min(2, Math.max(p.sk[el] || 0, lv));
        if (F) addAffinity(el, 'gear');
      } else {
        p.fusedLv = Math.min(4, p.fusedLv + lv);
        pushToast({ text: `RUNA DE ${EL[el].name.toUpperCase()} DEL EQUIPO`, sub: `No cabe en tu Afinidad → +${6 * lv}% de daño`, color: EL[el].color, t: 2.8, max: 2.8 });
      }
    }
    recalc();
    refreshMixes();
    Sfx.pick();
    hideOverlay();
    hud(true);
    syncUlt(true);
    state = 'play';
    music('dungeon');
  }

  // botón del definitivo: carga circular con el color de la escuela (o de la forma, tras despertar)
  let ultShown = -1;
  function syncUlt(force) {
    if (!player) return;
    syncForm(force);
    const p = Math.floor(player.mana);
    if (!force && p === ultShown) return;
    ultShown = p;
    btnUlt.style.setProperty('--p', p);
    btnUlt.style.setProperty('--c', ultColor());
    btnUlt.classList.toggle('ready', p >= 100);
    if (force) btnUlt.querySelector('.in').textContent = ultIcon();
  }
  // anillo exterior del botón = Ánima: --a (0-100), --ac (color) y clases anima / animafull / animalock
  let animaShown = -1, animaCls = '';
  function syncForm(force) {
    if (!player) return;
    const p = player, F = FX(), on = !!F && p.awak < 2;
    const a = on ? Math.round(clamp(p.anima / animaNeed(p.awak), 0, 1) * 100) : 0;
    const rdy = on && p.animaReady && room < lastRoom(); // en la sala final ya no se ofrece: el anillo no gira
    const cls = (on ? 'a' : '') + (rdy ? (p.awkLock ? 'l' : 'f') : '') + p.awak;
    if (!force && a === animaShown && cls === animaCls) return;
    animaShown = a; animaCls = cls;
    btnUlt.style.setProperty('--a', a);
    btnUlt.style.setProperty('--ac', on && p.awak ? F.FORMS[p.form].color : '#fff1c4');
    btnUlt.classList.toggle('anima', on);
    btnUlt.classList.toggle('animafull', rdy && !p.awkLock);
    btnUlt.classList.toggle('animalock', rdy && p.awkLock);
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
    if ((intensityT -= dt) <= 0 && musicHoldT <= 0) { // la música sube de capas con más enemigos (salvo tras despertar)
      intensityT = 0.5;
      try { if (window.ArcanoMusic) window.ArcanoMusic.setIntensity(clamp(enemies.length / 8, 0, 1)); } catch (_) { /* sin música */ }
    }
    flowT -= dt;
    if (flowT <= 0) { flowT = 0.2; bfs(grid, cellC(player.x), cellR(player.y), flow); }
    for (const e of enemies) if (!e.dead) updateEnemy(e, dt);
    separate();
    updateShots(dt);
    updateUlts(dt);
    rechargeTok(dt);
    updateForms(dt);
    updateBullets(dt);
    updateDrops(dt);
    updateFx(dt);
    syncUlt();
    enemies = enemies.filter(e => !e.dead);

    // refuerzos: cuando quedan pocos (sin contar esbirros ni tótems, que no se mueven)
    if (!cleared && waveQ.length && enemies.filter(e => !e.dead && !e.minion && !e.heavy).length <= Math.ceil(wave1N * waveAt)) spawnWave();
    if (!cleared && enemies.length === 0) onCleared();
    if (cleared) doorAnim = Math.min(1, doorAnim + dt * 2);
    if (altar && !altar.used && state === 'play' && !awakenFx && dist(player, altar) < player.r + 26) openAltar();
    hzClock += dt;
    if (chest) {
      if (chest.opened) chest.openT += dt;
      else if (cleared && state === 'play' && !awakenFx && dist(player, chest) < player.r + 22) openChest();
    }
    if (state === 'play' && cleared && !awakenFx && room < lastRoom() && player.y < AY - 24) {
      state = 'transition'; transPhase = 'out'; transT = 0; resetJoy();
    }
    if (winTimer > 0 && state === 'play') {
      winTimer -= dt;
      if (winTimer <= 0) { showEnd(true); return; }
    }
    updateHud(dt);
    if (awakenFx) return; // durante la transformación no se abre nada
    if (pendingLevels > 0 && state === 'play' && winTimer < 0 && (hudFx.lvlShow > player.lvl - pendingLevels || hudFx.wait > 1.5)) {
      hudFx.wait = 0;
      openLevelUp('level');
    }
    else if (bonusPicks.length && state === 'play' && winTimer < 0 && !(bonusPicks[0] === 'chest' && chest && chest.opened && chest.openT < 0.8)) {
      openLevelUp(bonusPicks[0]); // el cofre espera a que se vea la apertura
    }
    else if (!pendingLevels && !bonusPicks.length && canOfferAwaken(dt)) openLevelUp('awaken'); // el despertar va detrás de niveles y cofres
  }

  // barra de experiencia: se llena tras recibir las chispas; al completarse, destello, sonido y nivel
  function updateHud(dt) {
    hudFx.flash = Math.max(0, hudFx.flash - dt * 2);
    hudFx.pulse = Math.max(0, hudFx.pulse - dt * 4);
    hudFx.wait = pendingLevels > 0 && hudFx.lvlShow <= player.lvl - pendingLevels ? hudFx.wait + dt : 0;
    for (const f of flyers) {
      f.t += dt;
      if (f.t >= f.dur && !f.done) { f.done = true; hudFx.pulse = 1; Sfx.xpFill(); for (let i = 0; i < 3; i++) hudSpark(xpBarEnd(), 40, '#ffe08a'); }
    }
    flyers = flyers.filter(f => !f.done);
    for (const q of hudParts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 300 * dt; q.life -= dt; }
    hudParts = hudParts.filter(q => q.life > 0);
    if (hudFx.hold > 0) { hudFx.hold -= dt; return; }
    const target = hudFx.lvlShow < player.lvl ? 1 : clamp(player.xp / xpNeed(player.lvl), 0, 1);
    hudFx.xpShow += (target - hudFx.xpShow) * Math.min(1, dt * 9);
    if (hudFx.lvlShow < player.lvl && hudFx.xpShow > 0.98) { // ¡nivel!
      hudFx.lvlShow++;
      hudFx.xpShow = 0;
      hudFx.flash = 1; hudFx.pulse = 1;
      Sfx.level();
      for (let i = 0; i < 22; i++) hudSpark(XPB.x + Math.random() * XPB.w, XPB.y + XPB.h / 2, i % 3 ? '#ffd25a' : '#ffffff');
      rings.push({ x: player.x, y: player.y, r0: 10, r1: 70, t: 0.5, max: 0.5, color: '#ffd25a', w: 5 });
      burst(player.x, player.y, '#ffd25a', 18, 200);
      addText(player.x, player.y - 50, '¡NIVEL ' + hudFx.lvlShow + '!', '#ffd25a', 1.2);
    }
  }
  const XPB = { x: 112, y: 28, w: 412, h: 24 }; // barra de experiencia del HUD (la pausa va a su izquierda)
  function xpBarEnd() { return XPB.x + Math.max(14, XPB.w * hudFx.xpShow); }
  function hudSpark(x, y, color) {
    const a = rand(-Math.PI, 0), sp = rand(60, 220);
    hudParts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.35, 0.7), max: 0.7, color, size: rand(1.5, 3.2) });
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
    const dt = clamp(raw, 0, 1 / 30); // nunca negativo: tras reponer last en un toque (carta del despertar), el reloj del frame puede ir por detrás
    last = now;
    clock += dt;
    fpsAcc += raw; fpsN++;
    if (fpsAcc >= 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
    if (!flags.freeze) advance(dt);
    if (state !== 'play' && state !== 'dying') shake = 0; // que no tiemble detrás de los menús
    render();
    requestAnimationFrame(frame);
  }
  // un paso de simulación (frame y depuración). La transformación va en tiempo real y escala el del mundo
  function advance(dt) {
    if (slowT > 0) slowT -= dt;
    if (musicHoldT > 0) musicHoldT = Math.max(0, musicHoldT - dt);
    if (screenFlash && screenFlash.real) { screenFlash.t -= dt; if (screenFlash.t <= 0) { screenFlash = flashNext; flashNext = null; } }
    if (state === 'play') {
      if (awakenFx) updateAwaken(dt);
      update(dt * (awakenFx ? awakenScale() : slowT > 0 ? 0.28 : 1));
    } else if (state === 'transition') updateTransition(dt);
    else if (state === 'dying') {
      deathT -= dt;
      updateFx(dt);
      if (deathT <= 0) showEnd(false);
    }
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
  // forms.js dibuja con estos mismos helpers (comparte la caché de brillos y la calidad gráfica)
  if (Forms()) Forms().bind({ glow, circle, ellipse, star, lowQ, W, H });

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
    return biomeAt(room);
  }
  function buildRoomBg() {
    if (roomBg) roomBg.width = roomBg.height = 0; // libera el lienzo anterior (Safari tiene poca memoria para canvas)
    roomBg = null;
    try {
      roomBg = Biomes().render({ grid, biome: biomeId(), seed: (runSeed * 31 + room * 7919) >>> 0, scale: canvas.width / W, doorX0: DOOR_X0, doorX1: DOOR_X1 });
      if (roomBg) { const g = roomBg.getContext('2d'); g.setTransform(canvas.width / W, 0, 0, canvas.width / W, 0, 0); paintHazardBase(g); }
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
    if (cleared && doorAnim >= 1 && room < lastRoom() && player) {
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
      if (e.spawnT > 0) { // refuerzo a punto de salir: círculo violeta en el suelo
        if (e.wave) {
          const k = clamp(1 - e.spawnT / e.spawnMax, 0, 1);
          ctx.fillStyle = `rgba(176,107,255,${0.12 + 0.14 * k})`; ctx.strokeStyle = 'rgba(200,150,255,.75)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 10, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.arc(e.x, e.y, (e.r + 10) * (1 - 0.6 * k) + 4, 0, TAU); ctx.stroke();
        }
        continue;
      }
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
      if (e.kind === 'boss' && e.state === 'aimed') { // abanico apuntado: cono rojo hacia ti (±0,34 rad) antes de cada ráfaga
        const k = clamp(1 - e.timer / (e.sub ? 0.35 : warnCfg().aimed), 0, 1), a = angTo(e, player), L = 520;
        ctx.fillStyle = `rgba(255,50,70,${0.1 + 0.16 * k})`;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, L, a - 0.34, a + 0.34); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = `rgba(255,70,90,${0.35 + 0.4 * k})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a - 0.34) * L, e.y + Math.sin(a - 0.34) * L); ctx.lineTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(a + 0.34) * L, e.y + Math.sin(a + 0.34) * L); ctx.stroke();
      }
      if (e.kind === 'boss' && e.state === 'ring' && e.sub === 0) { // anillo: pulso que se abre antes de la primera ronda
        const k = clamp(1 - e.timer / 0.3, 0, 1);
        ctx.strokeStyle = `rgba(255,60,60,${0.35 * (1 - 0.5 * k) + 0.15})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 10 + 30 * k, 0, TAU); ctx.stroke();
      }
      // destino del teletransporte del jefe / de la reaparición del espectro: marca punteada donde va a salir
      const tp = e.kind === 'boss' ? (e.state === 'tpOut' ? e.tp : e.state === 'tpIn' ? e : null)
        : e.kind === 'spirit' ? (e.state === 'out' ? e.tp : e.state === 'in' ? e : null) : null;
      if (tp) tpMark(tp.x, tp.y, e.r);
      if (e.kind === 'bomber' && e.state === 'fuse') { // radio de la explosión
        const k = 1 - e.timer / 0.8;
        ctx.fillStyle = `rgba(255,80,30,${0.1 + 0.18 * k})`;
        ctx.beginPath(); ctx.arc(e.x, e.y, 80, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,120,60,.8)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, 80 * k, 0, TAU); ctx.stroke();
      }
    }
  }

  function tpMark(x, y, r) {
    const R = r + 10, p = 0.5 + 0.5 * Math.sin(clock * 14);
    ctx.save();
    ctx.fillStyle = `rgba(255,60,110,${0.1 + 0.08 * p})`;
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
    ctx.setLineDash([7, 6]); ctx.lineDashOffset = -clock * 30;
    ctx.strokeStyle = 'rgba(20,0,10,.6)'; ctx.lineWidth = 4.5; // borde oscuro debajo: se lee en suelos claros
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255,90,140,${0.65 + 0.3 * p})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  // ---- trampas: la parte fija se pinta una vez en el fondo de la sala; cada frame solo se anima ----
  function hzSame(i, dc, dr) {
    const c = i % COLS + dc, r = ((i / COLS) | 0) + dr;
    return c >= 0 && c < COLS && r >= 0 && r < ROWS && hz[r * COLS + c] === hz[i];
  }
  function rpath(g, x, y, w, h, r) { // subtrazo de rectángulo redondeado (sin beginPath)
    r = Math.min(r, w / 2, h / 2);
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  // una sola ruta por tipo: las celdas vecinas se funden en un charco continuo
  function poolPath(g, t, inset, rad) {
    g.beginPath();
    for (let i = 0; i < hz.length; i++) {
      if (hz[i] !== t) continue;
      const x = AX + (i % COLS) * CELL, y = AY + ((i / COLS) | 0) * CELL;
      rpath(g, x + inset, y + inset, CELL - inset * 2, CELL - inset * 2, rad);
      if (hzSame(i, 1, 0)) g.rect(x + CELL / 2, y + inset, CELL, CELL - inset * 2);
      if (hzSame(i, 0, 1)) g.rect(x + inset, y + CELL / 2, CELL - inset * 2, CELL);
      if (hzSame(i, 1, 0) && hzSame(i, 0, 1) && hzSame(i, 1, 1)) g.rect(x + CELL / 2, y + CELL / 2, CELL, CELL);
    }
  }
  function paintHazardBase(g) {
    if (!hz.some(t => t)) return;
    g.save();
    // veneno
    if (hz.includes(HZ.POISON)) {
      poolPath(g, HZ.POISON, 2, 14); g.fillStyle = 'rgba(60,16,80,.8)'; g.fill();
      poolPath(g, HZ.POISON, 6, 11); g.fillStyle = 'rgba(140,70,210,.6)'; g.fill();
    }
    // hielo
    if (hz.includes(HZ.ICE)) {
      poolPath(g, HZ.ICE, 1, 9); g.fillStyle = 'rgba(200,244,255,.42)'; g.fill();
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.5;
      for (let i = 0; i < hz.length; i++) {
        if (hz[i] !== HZ.ICE) continue;
        const x = AX + (i % COLS) * CELL, y = AY + ((i / COLS) | 0) * CELL;
        g.beginPath(); g.moveTo(x + 9, y + 27); g.lineTo(x + 20, y + 14); g.moveTo(x + 19, y + 31); g.lineTo(x + 29, y + 19); g.stroke();
      }
    }
    // lava: costra, magma y vetas brillantes recortadas dentro del charco
    if (hz.includes(HZ.LAVA)) {
      poolPath(g, HZ.LAVA, 1, 12); g.fillStyle = '#3a1206'; g.fill();
      poolPath(g, HZ.LAVA, 5, 10); g.fillStyle = '#e0520f'; g.fill();
      g.save(); g.clip();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < hz.length; i++) {
        if (hz[i] !== HZ.LAVA) continue;
        const x = AX + (i % COLS) * CELL + 8 + (i * 13) % 24, y = AY + ((i / COLS) | 0) * CELL + 8 + (i * 7) % 24;
        const lg = g.createRadialGradient(x, y, 1, x, y, 22);
        lg.addColorStop(0, 'rgba(255,230,140,.75)'); lg.addColorStop(1, 'rgba(255,120,30,0)');
        g.fillStyle = lg; g.fillRect(x - 22, y - 22, 44, 44);
      }
      g.restore();
    }
    // placas de pinchos: losa metálica con ranuras y remaches (se lee como trampa aunque estén escondidos)
    for (let i = 0; i < hz.length; i++) {
      if (hz[i] !== HZ.SPIKES) continue;
      const x = AX + (i % COLS) * CELL, y = AY + ((i / COLS) | 0) * CELL;
      g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); rpath(g, x + 3, y + 5, CELL - 6, CELL - 6, 7); g.fill();
      g.fillStyle = '#8c8698'; g.beginPath(); rpath(g, x + 3, y + 3, CELL - 6, CELL - 6, 7); g.fill();
      g.fillStyle = '#a8a2b4'; g.beginPath(); rpath(g, x + 5, y + 5, CELL - 10, CELL - 12, 6); g.fill();
      g.strokeStyle = '#5a5466'; g.lineWidth = 1.5; g.beginPath(); rpath(g, x + 3, y + 3, CELL - 6, CELL - 6, 7); g.stroke();
      g.fillStyle = '#3c3646';
      for (const [hx, hy] of SPIKE_HOLES) { g.fillRect(x + hx - 4, y + hy + 1, 8, 3); }  // ranuras
      g.fillStyle = '#d8d4e2';
      for (const [rx, ry] of [[6, 6], [34, 6], [6, 34], [34, 34]]) { g.beginPath(); g.arc(x + rx, y + ry, 1.6, 0, TAU); g.fill(); } // remaches
    }
    g.restore();
  }
  const SPIKE_HOLES = [[13, 13], [27, 13], [13, 27], [27, 27]];

  function drawHazards() {
    if (!roomBg) paintHazardBase(ctx); // sin fondo horneado (respaldo): se pinta cada frame
    for (let i = 0; i < hz.length; i++) {
      const t = hz[i];
      if (!t) continue;
      const x = AX + (i % COLS) * CELL, y = AY + ((i / COLS) | 0) * CELL;
      if (t === HZ.SPIKES) {
        const ph = spikePhase(i);
        if (ph === 1) { ctx.fillStyle = `rgba(255,60,60,${0.3 + 0.2 * Math.sin(hzClock * 26)})`; rrect(x + 3, y + 3, CELL - 6, CELL - 6, 7); ctx.fill(); }
        const h = ph === 2 ? 15 : ph === 1 ? 5 : 2.5; // escondidos asoman las puntas
        for (const [hx0, hy0] of SPIKE_HOLES) {
          const hx = x + hx0, hy = y + hy0 + 2;
          ctx.fillStyle = ph === 2 ? '#d6d6e4' : '#6e6878';
          ctx.beginPath(); ctx.moveTo(hx - 4.5, hy); ctx.lineTo(hx, hy - h); ctx.lineTo(hx + 4.5, hy); ctx.closePath(); ctx.fill();
          if (ph === 2) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.moveTo(hx - 1.2, hy - 1); ctx.lineTo(hx, hy - h); ctx.lineTo(hx + 0.8, hy - 1); ctx.closePath(); ctx.fill();
          }
        }
      } else if (t === HZ.POISON) {
        const b = (hzClock * 0.8 + i * 0.37) % 1; // burbujas
        circle(x + 12 + (i * 7) % 16, y + 28 - b * 14, 2.5 * (1 - b) + 0.5, 'rgba(160,255,120,.7)');
      } else if (t === HZ.LAVA) {
        if (!lowQ() && i % 2 === 0) glow(x + 20, y + 20, 40, '#ff7a1a', 0.3 + 0.1 * Math.sin(hzClock * 3 + i));
        const b = (hzClock * 0.6 + i * 0.29) % 1;
        if (b < 0.6) circle(x + 10 + (i * 11) % 20, y + 12 + (i * 5) % 16, 3 * (1 - b / 0.6) + 1, 'rgba(255,240,180,.85)');
      }
    }
  }

  function drawChest() {
    if (!chest) return;
    const { x, y } = chest;
    const ready = cleared && !chest.opened;
    const bob = ready ? Math.abs(Math.sin(clock * 5)) * -4 : 0;
    if (ready || (chest.opened && chest.openT < 1.5)) glow(x, y - 8, 46, '#ffd25a', chest.opened ? Math.max(0, 1 - chest.openT / 1.5) : 0.5);
    ctx.drawImage(shadowSpr, x - 26, y + 6, 52, 18);
    const by = y - 4 + bob;
    ctx.fillStyle = '#5a3414'; rrect(x - 20, by - 8, 40, 24, 5); ctx.fill();          // cuerpo
    ctx.fillStyle = '#8a5424'; rrect(x - 18, by - 6, 36, 18, 4); ctx.fill();
    ctx.fillStyle = '#ffcf4a'; ctx.fillRect(x - 20, by - 1, 40, 3); ctx.fillRect(x - 3, by - 8, 6, 24);  // herrajes
    if (chest.opened) { // tapa abierta y rayos de luz
      ctx.fillStyle = '#2a1606'; ctx.fillRect(x - 18, by - 12, 36, 6); // interior
      ctx.fillStyle = '#6a3c18'; rrect(x - 20, by - 24, 40, 14, 5); ctx.fill();
      ctx.fillStyle = '#ffcf4a'; ctx.fillRect(x - 20, by - 15, 40, 2);
      if (chest.openT < 1.5) {
        ctx.globalAlpha = Math.max(0, 1 - chest.openT / 1.5);
        ctx.fillStyle = 'rgba(255,230,150,.6)';
        for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x + k * 5, by - 8); ctx.lineTo(x + k * 18 - 6, by - 70); ctx.lineTo(x + k * 18 + 6, by - 70); ctx.closePath(); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
    } else {
      ctx.fillStyle = '#6a3c18'; rrect(x - 21, by - 18, 42, 13, 6); ctx.fill();         // tapa cerrada
      ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(x - 17, by - 16, 34, 3);
      ctx.fillStyle = '#ffcf4a'; ctx.fillRect(x - 21, by - 9, 42, 3);
      circle(x, by - 2, 4, ready ? '#fff1b0' : '#2a1606');                              // cerradura
      if (ready && Math.sin(clock * 3) > 0.9) star(x + 14, by - 20, 4, '#ffffff');
    }
  }

  // entrada del jefe: franjas de cine, nombre y título
  function drawCine() {
    if (!cine) return;
    const age = cine.max - cine.t;
    const k = clamp(Math.min(age / 0.35, cine.t / 0.4), 0, 1);
    ctx.fillStyle = '#07050c';
    ctx.fillRect(0, 94, W, 70 * k);                          // franja de arriba (tapa el muro, no la arena)
    const low = (H - (AY + AH)) * k;
    ctx.fillRect(0, H - low, W, low);                        // la de abajo no invade la arena: el jugador se ve
    const a = clamp(Math.min((age - 0.3) / 0.3, cine.t / 0.4), 0, 1);
    if (a <= 0) return;
    ctx.globalAlpha = a;
    const slide = (1 - Math.min(1, (age - 0.3) / 0.4)) * 40;
    // placa oscura detrás del nombre para que se lea sobre cualquier suelo
    const pg = ctx.createLinearGradient(0, 380, 0, 500);
    pg.addColorStop(0, 'rgba(7,5,12,0)'); pg.addColorStop(0.25, 'rgba(7,5,12,.82)'); pg.addColorStop(0.75, 'rgba(7,5,12,.82)'); pg.addColorStop(1, 'rgba(7,5,12,0)');
    ctx.fillStyle = pg; ctx.fillRect(0, 380, W, 120);
    const nm = cine.name.toUpperCase();
    if (!cine.size) { ctx.font = `800 46px ${FONT}`; cine.size = Math.min(46, Math.floor(46 * (W - 60) / ctx.measureText(nm).width)); }
    txt(nm, W / 2 - slide, 424, cine.size, cine.color);
    ctx.fillStyle = cine.color; ctx.fillRect(W / 2 - 120 + slide, 448, 240, 2);
    txt(cine.title, W / 2 + slide, 470, 19, '#f2e6ff');
    ctx.globalAlpha = 1;
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

  // ---------- definitivos combinados (fase 2) ----------
  const DASH_VOID = [5, 9], DASH_SUN = [10, 8], NODASH = [];
  // Sol negro: disco negro con aro claro, corona violeta y arcos de acreción girando (sobre la oscuridad, bajo los enemigos)
  function drawVoid() {
    if (!sing || sing.kind !== 'void') return;
    const k = 1 - sing.t / sing.max, x = sing.x, y = sing.y, inA = Math.min(1, k * 6), r = (18 + 14 * Math.min(1, k * 3)) * (sing.t < 0.15 ? 1 + (0.15 - sing.t) * 4 : 1);
    glow(x, y, 150, '#7a3dff', 0.35 * inA);
    glow(x, y, 80 + 6 * Math.sin(clock * 9), '#c77dff', 0.75 * inA);
    ctx.globalAlpha = 0.22 * inA; ctx.strokeStyle = '#c77dff'; ctx.lineWidth = 2; // zona de daño (r130)
    ctx.setLineDash(DASH_VOID); ctx.lineDashOffset = clock * 30;
    ctx.beginPath(); ctx.arc(x, y, 130, 0, TAU); ctx.stroke();
    ctx.setLineDash(NODASH); ctx.lineDashOffset = 0; ctx.globalAlpha = 1;
    if (!lowQ()) { // arcos de acreción
      ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const a = -clock * (5 + i) + i * TAU / 4, rr = r + 9 + i * 7;
        ctx.globalAlpha = (0.85 - i * 0.15) * inA;
        ctx.strokeStyle = i % 2 ? '#e8d5ff' : '#c77dff'; ctx.lineWidth = 3 - i * 0.5;
        ctx.beginPath(); ctx.arc(x, y, rr, a, a + 1.3 + i * 0.2); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.lineCap = 'butt';
    }
    circle(x, y, r, '#05030a');
    ctx.strokeStyle = '#e8d5ff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  }
  // Sol cautivo: esfera de plasma flotando (núcleo claro, anillo que gira y chisporroteo) sobre los enemigos
  function drawSun() {
    if (!sing || sing.kind !== 'sun') return;
    const k = 1 - sing.t / sing.max, x = sing.x, y = sing.y - sunLift(), r = 13 + 11 * Math.min(1, k * 4) + Math.sin(clock * 30) * 1.5;
    ctx.globalAlpha = 0.07 + 0.06 * k; circle(sing.x, sing.y, 160, '#ff5ad1'); // zona del estallido: tenue, con un aro que se cierra
    ctx.globalAlpha = 0.7; ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 2.5;
    ctx.setLineDash(DASH_SUN); ctx.lineDashOffset = -clock * 40;
    ctx.beginPath(); ctx.arc(sing.x, sing.y, 160 * (1 - 0.15 * k), 0, TAU); ctx.stroke();
    ctx.setLineDash(NODASH); ctx.lineDashOffset = 0; ctx.globalAlpha = 1;
    glow(x, y, 110 + 30 * k, '#ff5ad1', 1);
    glow(x, y, 50 + 10 * Math.sin(clock * 12), '#ffb347', 0.9);
    if (!lowQ()) for (let i = 0; i < 4; i++) { // chisporroteo alrededor
      const a = clock * 7 + i * TAU / 4;
      Forms().drawArc(ctx, x + Math.cos(a) * (r + 2), y + Math.sin(a) * (r + 2), x + Math.cos(a + 0.8) * (r + 28), y + Math.sin(a + 0.8) * (r + 28), clock, '#ff5ad1', i, 3, 0.06);
    }
    circle(x, y, r, '#ff5ad1'); circle(x, y, r * 0.7, '#ffc4ee'); circle(x, y, r * 0.42, '#ffffff');
    ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, y, r + 12, (r + 12) * 0.36, clock * 6, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#fff0ff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x, y, r + 18, (r + 18) * 0.3, -clock * 4 + 1, 0, TAU); ctx.stroke();
  }
  // Cortina boreal: columna de luz polar (sprite cacheado: degradado verde→violeta con bordes suaves)
  let curtainSpr = null;
  function curtainSprite() {
    if (curtainSpr) return curtainSpr;
    const c = document.createElement('canvas');
    c.width = 48; c.height = 256;
    const g = c.getContext('2d'), gv = g.createLinearGradient(0, 0, 0, 256);
    gv.addColorStop(0, 'rgba(176,124,255,0)'); gv.addColorStop(0.18, 'rgba(176,124,255,.75)'); gv.addColorStop(0.55, 'rgba(106,255,200,.85)');
    gv.addColorStop(0.9, 'rgba(127,227,255,.6)'); gv.addColorStop(1, 'rgba(127,227,255,0)');
    g.fillStyle = gv; g.fillRect(0, 0, 48, 256);
    for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(4 + i * 6.5 + (i % 2) * 2, 0, 1.5, 256); } // rayas de luz
    g.globalCompositeOperation = 'destination-in'; // bordes laterales suaves
    const gh = g.createLinearGradient(0, 0, 48, 0);
    gh.addColorStop(0, 'rgba(0,0,0,0)'); gh.addColorStop(0.3, 'rgba(0,0,0,1)'); gh.addColorStop(0.7, 'rgba(0,0,0,1)'); gh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gh; g.fillRect(0, 0, 48, 256);
    return (curtainSpr = c);
  }
  function drawCurtains() {
    if (!curtains.length) return;
    const op = ctx.globalCompositeOperation, spr = curtainSprite();
    ctx.globalCompositeOperation = 'lighter';
    for (const c of curtains) {
      if (!c.on) { // aviso: la columna se dibuja tenue antes de caer
        if (c.d > 0.45) continue;
        ctx.globalAlpha = 0.18 * (1 - c.d / 0.45);
        ctx.drawImage(spr, c.x, AY, c.w, AH);
        continue;
      }
      const k = c.t / c.max, sw = 1 + 0.15 * Math.sin(clock * 20 + c.seed);
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.drawImage(spr, c.x - c.w * 0.1 * sw, AY - 30, c.w * 1.2 * sw, AH + 60);
      if (!lowQ()) { ctx.globalAlpha = 0.5 * k; ctx.drawImage(spr, c.x + c.w * 0.3, AY - 30, c.w * 0.4, AH + 60); } // núcleo más brillante
    }
    ctx.globalCompositeOperation = op; ctx.globalAlpha = 1;
  }
  // Invierno negro: niebla helada por toda la sala (sprite de nubes cacheado que deriva), bajo los enemigos
  let fogSpr = null;
  function fogSprite() {
    if (fogSpr) return fogSpr;
    const c = document.createElement('canvas');
    c.width = 120; c.height = 200;
    const g = c.getContext('2d');
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); // nubes siempre iguales
    for (let i = 0; i < 26; i++) {
      const x = r() * 120, y = r() * 200, rr = 18 + r() * 26, gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, i % 3 ? 'rgba(159,181,176,.55)' : 'rgba(95,255,208,.35)'); gr.addColorStop(1, 'rgba(159,181,176,0)');
      g.fillStyle = gr;
      for (const ox of [-120, 0, 120]) for (const oy of [-200, 0, 200]) { g.save(); g.translate(ox, oy); g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); g.restore(); } // se repite sin cortes
    }
    return (fogSpr = c);
  }
  function drawFog() {
    if (!fog) return;
    const k = Math.min(1, (fog.max - fog.t) / 0.4, fog.t / 0.5), spr = fogSprite();
    ctx.globalAlpha = 0.28 * k; ctx.fillStyle = '#0e2a26'; ctx.fillRect(AX, AY, AW, AH);
    const off = (clock * 18) % AH;
    for (let i = 0; i < (lowQ() ? 1 : 2); i++) {
      const dy = i ? -off : off - AH, dx = i ? 0 : -AW * 0.5;
      ctx.globalAlpha = (i ? 0.45 : 0.6) * k;
      ctx.save(); ctx.beginPath(); ctx.rect(AX, AY, AW, AH); ctx.clip();
      ctx.drawImage(spr, AX + dx, AY + dy, AW, AH); ctx.drawImage(spr, AX + dx, AY + dy + AH, AW, AH);
      if (dx) { ctx.drawImage(spr, AX + dx + AW, AY + dy, AW, AH); ctx.drawImage(spr, AX + dx + AW, AY + dy + AH, AW, AH); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawSingularity() {
    if (!sing || sing.kind) return; // Singularidad del Arcanista (el Sol negro y el Sol cautivo se dibujan aparte)
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
    const p = player, F = FX();
    const L = F ? F.look(p.form, p, EL) : null; // paleta de la forma (Aprendiz: la de siempre con la cinta de la escuela)
    const blink = p.inv > 0 && !awakenFx && Math.floor(p.inv * 16) % 2 === 0;
    ctx.globalAlpha = blink ? 0.4 : 1;
    if (F) F.drawAura(ctx, p, p.form, clock, p.awak ? 0 : p.anima / animaNeed(0)); // aura detrás del mago
    shadow(p);
    const lev = p.lev || 0; // levitación de la transformación
    const bob = p.moving ? Math.abs(Math.sin(p.walkT * 12)) * 3 : 0;
    const x = p.x, y = p.y - bob - lev, a = p.face, r = p.r;
    const col = EL[p.school].color;
    const lean = p.moving ? -Math.cos(a) * 4 : 0;
    // capa ondeando detrás (al levitar se abre hacia arriba)
    const wave = p.moving ? Math.sin(p.walkT * 14) * 3 : Math.sin(clock * 2) * 1;
    const cu = lev * 0.45, cw = lev * 0.35 * (1 + 0.4 * Math.sin(clock * 18));
    ctx.fillStyle = L ? L.cape : '#2a1873';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.85, y - r * 0.15);
    ctx.quadraticCurveTo(x - r * 1.2 - wave - cw, y + r * 0.7 - cu, x - r * 0.7 - cw, y + r * 1.05 - cu);
    ctx.lineTo(x + r * 0.7 + cw, y + r * 1.05 - cu);
    ctx.quadraticCurveTo(x + r * 1.2 + wave + cw, y + r * 0.7 - cu, x + r * 0.85, y - r * 0.15);
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
    blob(x, y + r * 0.2, r * 0.95, r * 0.85, L ? L.robe : '#5b3fd1');
    ctx.strokeStyle = L ? L.trim : '#ffcf4a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y + r * 0.2, r * 0.8, 0.35, Math.PI - 0.35); ctx.stroke(); // ribete
    if (L && L.cracks) F.drawCracks(ctx, x, y, r, L, clock); // Azufre: grietas de lava
    // cabeza grande (chibi)
    ball(x, y - r * 0.5, r * 0.66, L ? L.skin : '#ffd2a6');
    eyes(x + Math.cos(a) * 3, y - r * 0.42 + Math.sin(a) * 2, a, 3.4, 2.4, L ? L.eyeW : '#fff', L ? L.eyeP : '#141018');
    circle(x - r * 0.42, y - r * 0.28, 2, 'rgba(255,120,120,.35)'); // mofletes
    circle(x + r * 0.42, y - r * 0.28, 2, 'rgba(255,120,120,.35)');
    // sombrero puntiagudo
    const hy0 = y - r * 0.92;
    blob(x, hy0, r * 1.15, r * 0.4, L ? L.brim : '#3a24a0');
    // Corona (Marca II de esta forma): aro del color de la forma que rodea el cono, la mitad de atrás antes del sombrero
    const crown = L && grimMark2(p.form), kx = x + 4.5 + lean * 1.1, ky = hy0 - r * 1.15, kr = 0.2 + lean * 0.04, kc = crown ? F.FORMS[p.form].color : null;
    if (crown) F.drawCrown(ctx, kx, ky, kc, clock, 1, kr);
    if (L) { // degradado cacheado en forms.js, en coordenadas locales
      ctx.save(); ctx.translate(x, 0);
      ctx.fillStyle = F.hatGrad(ctx, L, r);
      ctx.beginPath();
      ctx.moveTo(-r * 0.72, hy0 - 1); ctx.lineTo(r * 0.72, hy0 - 1);
      ctx.quadraticCurveTo(4 + lean, hy0 - r * 1.05, 10 + lean * 1.6, hy0 - r * 1.75);
      ctx.quadraticCurveTo(-1 + lean, hy0 - r * 1.0, -r * 0.72, hy0 - 1);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = L.hatLine; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
      F.drawBand(ctx, x, hy0, r, L); // cinta (bicolor con la Afinidad sellada)
      F.drawHatStar(ctx, x + 1 + lean * 0.5, hy0 - r * 0.62, L);
      if (crown) F.drawCrown(ctx, kx, ky, kc, clock, 2, kr); // mitad de delante, brillo y destello
    } else {
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
    }
    // cristal del bastón (delante de todo, brilla)
    const pulse = (p.castFx > 0 ? 9 : 0) + Math.sin(clock * 6) * 1.5;
    if (L) F.drawGem(ctx, tx, ty, L, pulse);
    else { glow(tx, ty, 16 + pulse, col); circle(tx, ty, 5, col); circle(tx - 1.5, ty - 1.5, 2, '#fff'); }
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
      const crack = e.shatter && e.frozen < 0.5 && Math.sin(clock * 50) > 0;
      ctx.fillStyle = crack ? 'rgba(235,252,255,.75)' : 'rgba(170,235,255,.45)'; rrect(e.x - e.r - 5, e.y - e.r - 5 - fly, e.r * 2 + 10, e.r * 2 + 10, 6); ctx.fill();
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
    if (b.model === 'golem') { // gólem
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
    } else if (b.model === 'rey') { // rey slime
      drawSlime(x, y, r, b.color, b.t * 3, a);
      ctx.fillStyle = '#ffcf3a';
      const cy = y - r * 0.95;
      ctx.beginPath();
      ctx.moveTo(x - 18, cy + 8); ctx.lineTo(x - 18, cy - 8); ctx.lineTo(x - 9, cy);
      ctx.lineTo(x, cy - 12); ctx.lineTo(x + 9, cy); ctx.lineTo(x + 18, cy - 8); ctx.lineTo(x + 18, cy + 8);
      ctx.closePath(); ctx.fill();
    } else if (b.model === 'brujo') { // brujo
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
    // orbes mágicos con estela (el color sale del elemento del hechizo); con forms.js, la silueta de la forma
    const F = FX();
    for (const a of shots) {
      if (F && F.drawShot(ctx, a, clock)) continue;
      const col = a.col, k = a.nofx ? 0.6 : 1; // las esquirlas, más pequeñas
      const sp = Math.hypot(a.vx, a.vy) || 1, ux = a.vx / sp * k, uy = a.vy / sp * k;
      // estela afilada
      const op = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(col, 0.5); ctx.lineCap = 'round';
      ctx.lineWidth = 7 * k; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x - ux * 16, a.y - uy * 16); ctx.stroke();
      ctx.lineWidth = 3.5 * k; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x - ux * 30, a.y - uy * 30); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.globalCompositeOperation = op;
      glow(a.x, a.y, 17 * k, col, 0.9);
      circle(a.x, a.y, 5.5 * k, col);
      if (a.col2) { // segundo elemento: chispa orbitando
        const t = clock * 25;
        glow(a.x + Math.cos(t) * 8, a.y + Math.sin(t) * 8, 6, a.col2);
        circle(a.x + Math.cos(t) * 8, a.y + Math.sin(t) * 8, 2.4, a.col2);
      }
      circle(a.x, a.y, 2.8 * k, '#fff');
    }
  }

  function drawBullets() {
    for (const b of bullets) {
      glow(b.x, b.y, b.r * 2.6, b.color, 0.7);
      circle(b.x, b.y, b.r + 2, 'rgba(26,0,12,.9)'); // contorno oscuro de 2 px (los hechizos del jugador no lo llevan)
      circle(b.x, b.y, b.r, b.color);
      circle(b.x, b.y, b.r * 0.5, '#fff'); // núcleo claro
    }
  }

  const orbMix = { halo: false, anillo: false };
  function drawOrbs() {
    const n = player.sk.orbs || 0, F = FX();
    if (!n) return;
    orbMix.halo = !!mixOn('halo'); orbMix.anillo = !!mixOn('anillo');
    const col = orbMix.halo ? '#ffb347' : F && player.awak ? F.FORMS[player.form].color : EL[player.school].color;
    // Anillo voltaico: zigzags entre orbes (o orbe↔mago con uno solo), regenerados cada 0,1 s
    if (F && orbMix.anillo) orbSegs(n).forEach((s, i) => F.drawArc(ctx, s[0], s[1], s[2], s[3], clock, '#ffe45c', i + 1, 4, 0.1));
    for (let i = 0; i < n; i++) {
      const a = player.orbA + i * TAU / n;
      const x = player.x + Math.cos(a) * ORB_R, y = player.y + Math.sin(a) * ORB_R;
      for (let k = 1; k <= 3; k++) { // estela
        ctx.globalAlpha = 0.25 * (1 - k / 4);
        circle(player.x + Math.cos(a - k * 0.12) * ORB_R, player.y + Math.sin(a - k * 0.12) * ORB_R, 9 - k, col);
      }
      ctx.globalAlpha = 1;
      if (F) { F.drawOrb(ctx, x, y, player.form, clock, orbMix, col); continue; }
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
      if (m.d > 0) continue;
      const k = 1 - m.t / m.max, s = !!m.pool; // s: bola de azufre
      ctx.globalAlpha = 0.12 + 0.15 * k;
      circle(m.x, m.y, m.r, s ? '#d6ff3a' : '#ff5a28');
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = s ? '#ffb000' : '#ff8c3c'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r * k, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawMeteors() { // la roca cayendo (azufre: bola verde ácido con núcleo de lava, más pequeña y más recta)
    for (const m of meteors) {
      if (m.d > 0) continue;
      const s = !!m.pool, k = m.t / m.max, x = m.x + (s ? 70 : 160) * k, y = m.y - (s ? 560 : 620) * k, z = s ? 0.85 : 1;
      for (let i = 1; i <= 6; i++) {
        ctx.globalAlpha = 0.5 * (1 - i / 7);
        circle(x + i * 9 * (s ? 0.45 : 1), y - i * 34 * 0.6, (22 - i * 2) * z, s ? (i < 3 ? '#d6ff3a' : i < 5 ? '#ff8a3d' : '#7a7a70') : i < 3 ? '#ffd27a' : '#ff6a2a');
      }
      ctx.globalAlpha = 1;
      if (s) { glow(x, y, 46, '#d6ff3a', 0.8); circle(x, y, 20, '#9aba1a'); circle(x, y, 17, '#d6ff3a'); circle(x + 2, y + 2, 10, '#ff8a3d'); circle(x - 4, y - 4, 4.5, '#fff3c4'); }
      else { circle(x, y, 24, '#ff7a2a'); circle(x, y, 17, '#5a2a14'); circle(x - 5, y - 5, 6, '#8a4a24'); }
    }
  }

  // tamaño de letra para que un texto quepa en maxW (se mide una vez y se guarda en el objeto)
  function fitSize(text, size, maxW) {
    ctx.font = `800 ${size}px ${FONT}`;
    const w = ctx.measureText(text).width;
    return w > maxW ? Math.max(10, Math.floor(size * maxW / w)) : size;
  }
  // el aviso baja mientras se ve el logro (aviso DOM de arriba) para que no lo tape
  let toastY = 140;
  function drawToast() {
    toastY += ((achBusy && state === 'play' ? 186 : 140) - toastY) * 0.25;
    if (!toast || cine || awakenFx) return; // la transformación es del mago
    // sala limpia con el mago arriba (junto a la puerta, bajo la franja de avisos): el aviso sale bajo el rótulo. Se decide una vez por aviso
    if (toast.low === undefined) toast.low = !!player && cleared && player.y < 330;
    const a = clamp(Math.min(toast.t, toast.max - toast.t) / 0.25, 0, 1), y = toast.low ? 540 : toastY;
    if (!toast.fs) { toast.fs = fitSize(toast.text, 24, 410); toast.ss = fitSize(toast.sub || '', 15, 416); }
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(12,8,22,.82)'; rrect(W / 2 - 220, y, 440, 66, 18); ctx.fill();
    ctx.strokeStyle = toast.color; ctx.lineWidth = 2; ctx.stroke();
    txt(toast.text, W / 2, y + 22, toast.fs, toast.color, 'center', false);
    txt(toast.sub, W / 2, y + 49, toast.ss, '#e9e3ff', 'center', false);
    ctx.globalAlpha = 1;
  }

  const BOLT_SKY = [[10, 'rgba(255,230,90,.35)'], [4, '#fff7c2']], BOLT_CHAIN = [[6, 'rgba(120,220,255,.35)'], [2, '#ffffff']];
  function drawBolts() {
    for (const b of bolts) {
      const pts = [[b.x1, b.y1]];
      for (let i = 1; i < 6; i++) {
        const t = i / 6;
        pts.push([b.x1 + (b.x2 - b.x1) * t + rand(-9, 9), b.y1 + (b.y2 - b.y1) * t + rand(-9, 9)]);
      }
      pts.push([b.x2, b.y2]);
      const layers = b.layers || (b.sky ? BOLT_SKY : BOLT_CHAIN);
      for (const [w, c] of layers) {
        ctx.strokeStyle = c; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts) ctx.lineTo(p[0], p[1]);
        ctx.stroke();
      }
    }
  }

  // charcos de Tóxica y Azufre (en el suelo, bajo todo lo demás)
  function drawPools() {
    if (!pools.length || !Forms()) return;
    for (const o of pools) Forms().drawPool(ctx, o, clock);
  }
  // partículas de ambiente de la forma: chispas que suman luz y ceniza con composición normal
  function drawAmb() {
    if (amb.length) {
      const op = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      for (const q of amb) { const k = clamp(q.life / q.max, 0, 1); ctx.globalAlpha = k; circle(q.x, q.y, q.size * (0.5 + 0.5 * k), q.color); }
      ctx.globalCompositeOperation = op; ctx.globalAlpha = 1;
    }
    if (ash.length && Forms()) Forms().drawNormalParts(ctx, ash);
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
    // franja superior con degradado (el juego se intuye por debajo)
    const hg = ctx.createLinearGradient(0, 0, 0, 96);
    hg.addColorStop(0, '#0c0816'); hg.addColorStop(1, '#16102a');
    ctx.fillStyle = hg; ctx.fillRect(0, 0, W, 94);
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(0, 93, W, 1);
    const { x: bx, y: by, w: bw, h: bh } = XPB;
    // barra de experiencia: marco con relieve, relleno dorado con brillo que recorre la barra
    ctx.fillStyle = '#05030a'; rrect(bx - 3, by - 3, bw + 6, bh + 6, 13); ctx.fill();
    ctx.fillStyle = '#2a2042'; rrect(bx, by, bw, bh, 11); ctx.fill();
    const fw = Math.max(0, bw * hudFx.xpShow);
    if (fw > 2) {
      const fg = ctx.createLinearGradient(0, by, 0, by + bh);
      fg.addColorStop(0, '#fff1a8'); fg.addColorStop(0.45, '#ffd04a'); fg.addColorStop(1, '#e08a12');
      ctx.fillStyle = fg; rrect(bx, by, Math.max(bh, fw), bh, 11); ctx.fill();
      ctx.save(); rrect(bx, by, Math.max(bh, fw), bh, 11); ctx.clip();
      const sx = bx + ((clock * 260) % (bw + 160)) - 80; // reflejo que recorre la barra
      const sg = ctx.createLinearGradient(sx - 40, 0, sx + 40, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,.45)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg; ctx.fillRect(sx - 40, by, 80, bh);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(bx + 6, by + 3, Math.max(0, fw - 12), 3);
      ctx.restore();
      glow(bx + fw, by + bh / 2, 22 + hudFx.pulse * 18, '#ffd25a', 0.5 + hudFx.pulse * 0.5); // punta encendida
    }
    if (hudFx.flash > 0) { ctx.globalAlpha = hudFx.flash; ctx.fillStyle = '#ffffff'; rrect(bx, by, bw, bh, 11); ctx.fill(); ctx.globalAlpha = 1; }
    // insignia de nivel encima del inicio de la barra
    const lp = 1 + hudFx.pulse * 0.18 + hudFx.flash * 0.25;
    ctx.save(); ctx.translate(bx, by + bh / 2); ctx.scale(lp, lp);
    if (hudFx.flash > 0) glow(0, 0, 50, '#ffd25a', hudFx.flash);
    circle(0, 3, 27, '#7a3a00');
    ball(0, 0, 26, '#ffb547', false);
    ctx.strokeStyle = '#5a2a00'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.stroke();
    txt('NV', 0, -11, 11, '#5a2a00', 'center', false);
    txt(String(hudFx.lvlShow), 0, 7, 24, '#ffffff', 'center', true);
    ctx.restore();
    // chispas que vuelan desde las gemas hasta la punta de la barra
    for (const f of flyers) {
      const t = Math.min(1, f.t / f.dur), e = t * t; // acelera al final
      const tx = xpBarEnd(), ty = by + bh / 2;
      const cx = (f.x0 + tx) / 2 + f.side * 140, cy = (f.y0 + ty) / 2;
      const x = (1 - e) * (1 - e) * f.x0 + 2 * (1 - e) * e * cx + e * e * tx;
      const y = (1 - e) * (1 - e) * f.y0 + 2 * (1 - e) * e * cy + e * e * ty;
      glow(x, y, 14, f.col, 0.9);
      circle(x, y, 3.2, '#ffffff');
    }
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    for (const q of hudParts) { ctx.globalAlpha = clamp(q.life / q.max, 0, 1); circle(q.x, q.y, q.size, q.color); }
    ctx.globalCompositeOperation = op; ctx.globalAlpha = 1;
    // segunda fila: sala en el centro, esencia y bajas a la derecha
    txt(`SALA ${room} / ${lastRoom()}`, W / 2, 75, 17, '#e9e3ff', 'center', true);
    txt(`✨ ${calcEssence(false)}`, W - 16, 75, 17, '#ffcf4a', 'right', true);
    txt(`☠ ${kills}`, bx + 40, 75, 16, '#cfc6e8', 'left', true);
    if (player.revives > 0) { // pluma de fénix disponible
      ctx.save(); ctx.translate(W - 96, 75); ctx.rotate(-0.6);
      ellipse(0, 0, 4, 10, '#ff9a3d'); ellipse(0, -2, 2, 6, '#ffd27a');
      ctx.strokeStyle = '#ffe9b0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, 13); ctx.stroke();
      ctx.restore();
    }
    // barra del jefe
    if (boss && !boss.dead) {
      const x = AX + 30, w = AW - 60, y = AY - 28, kb = clamp(boss.hp / boss.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,.75)'; rrect(x - 2, y - 2, w + 4, 24, 8); ctx.fill();
      ctx.fillStyle = boss.enraged ? '#ff3b3b' : '#e0453a'; rrect(x, y, w * kb, 20, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x + w / 2 - 1, y, 2, 20); // a la mitad se enfurece
      txt(boss.name.toUpperCase(), AX + AW / 2, y + 10, 13, '#fff');
    }
    if (tut && TUT_TEXT[tut.step]) hint(TUT_TEXT[tut.step](), '#ffd27a');
    else if (!settings.ultTip && player.mana >= 100 && enemies.length) {
      const uc = ultColor();
      hint(TOUCH ? '¡Definitivo listo! Toca el botón brillante' : '¡Definitivo listo! Pulsa Espacio', uc);
      if (TOUCH) { // flecha hacia el botón
        const bxu = settings.lefty ? 74 : W - 74, bob = Math.sin(clock * 8) * 6;
        txt('▼', bxu, 790 + bob * 0.7, 26, uc, 'center', true);
      }
    }
    // despertar listo pero bloqueado: opuestos sin pacto
    else if (player.animaReady && player.awkLock && cleared && !awakenFx && FX() && altarLeft()) hint('Opuestos: sella un Pacto oscuro en un altar para despertar', '#c77dff');
  }
  // ¿queda algún altar donde firmar el Pacto? El de esta sala sin usar o uno más adelante
  function altarLeft() { return (!!altar && !altar.used) || CH.altars.some(r => r > room); }

  function hint(text, color) {
    const fs = fitSize(text, 17, W - 80); // los textos largos encogen en vez de salirse de la píldora
    const w = Math.min(W - 40, ctx.measureText(text).width + 40), y = TOUCH ? 735 : 770;
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(clock * 4);
    ctx.fillStyle = 'rgba(12,8,22,.85)'; rrect(W / 2 - w / 2, y - 22, w, 44, 22); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    txt(text, W / 2, y, fs, color, 'center', false);
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
    if (!banner.fs) banner.fs = fitSize(banner.text, 58, W - 50);
    ctx.globalAlpha = a;
    if (banner.crown) { // Marca II: corona (aro del color de la forma) sobre el nombre dorado
      const cy = 430 - banner.fs * 0.62 - 12 + Math.sin(clock * 3) * 2;
      if (!lowQ()) glow(W / 2, cy, 46, banner.crown, 0.55);
      ctx.strokeStyle = 'rgba(10,6,20,.85)'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.ellipse(W / 2, cy, 34, 8, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = banner.crown; ctx.lineWidth = 4; ctx.stroke();
      circle(W / 2 + Math.cos(clock * 2.2) * 34, cy + Math.sin(clock * 2.2) * 8, 2.6, '#ffffff');
    }
    txt(banner.text, W / 2, 430, banner.fs, banner.color);
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
    // transformación: zoom del mundo (no del HUD) centrado en el mago y oscuridad bajo él
    const T = awakenFx && player && Forms() ? Forms().timeline(awakenFx.t) : null;
    if (T && T.zoom !== 1) { const zx = player.x, zy = player.y - 10; ctx.translate(zx, zy); ctx.scale(T.zoom, T.zoom); ctx.translate(-zx, -zy); }
    drawRoom();
    if (!player) drawMotes(); // motas mágicas flotando detrás de los menús
    if (player) {
      drawHazards();
      drawPools();
      drawChest();
      drawTelegraphs();
      drawMeteorMarks();
      drawAltar();
      drawSingularity();
      drawDrops();
      if (T && T.dark > 0) { ctx.fillStyle = `rgba(5,3,10,${T.dark.toFixed(3)})`; ctx.fillRect(-20, -20, W + 40, H + 40); }
      if (sing && sing.kind === 'void') { // Sol negro: la pantalla se oscurece al 55% (el mundo, no los enemigos ni tus disparos)
        ctx.globalAlpha = 0.55 * clamp(Math.min((sing.max - sing.t) / 0.3, sing.t / 0.2), 0, 1); ctx.fillStyle = '#05030a'; ctx.fillRect(-20, -20, W + 40, H + 40); ctx.globalAlpha = 1;
        drawVoid();
      }
      drawFog();
      if (Biomes() && !lowQ()) { try { Biomes().ambient(ctx, clock, biomeId()); } catch (_) { /* sin biomas */ } }
      const list = enemies.slice();
      if (player.hp > 0) list.push(player);
      list.sort((a, b) => a.y - b.y);
      for (const o of list) (o === player ? drawPlayer() : drawEnemy(o));
      if (player.hp > 0) drawOrbs();
      const pci = cellIndex(player.x, player.y);
      if (player.hp > 0 && pci >= 0 && hz[pci] === HZ.SPIKES && spikePhase(pci) === 1) {
        ctx.strokeStyle = `rgba(255,70,70,${0.6 + 0.4 * Math.sin(hzClock * 26)})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(player.x, player.y + 12, 24, 10, 0, 0, TAU); ctx.stroke();
      }
      drawShots();
      drawBullets();
      drawCurtains();
      drawRings();
      drawBolts();
      drawSun();
      drawMeteors();
      drawParts();
      drawAmb();
      if ((awakenFx || eclipseFx) && Forms()) Forms().drawAwaken(ctx, awakenFx, player, clock, eclipseFx); // anillos, espiral y esquirlas de sombra
      drawTexts();
    }
    ctx.restore();
    ctx.drawImage(vignetteSpr, 0, 0, W, H);
    if (player && player.form === 'eclipse' && FX()) { const v = Forms().vignette('eclipse'); if (v) ctx.drawImage(v, 0, 0, W, H); } // viñeta violeta de Eclipse
    if (player) {
      if (screenFlash) {
        ctx.fillStyle = `rgba(${screenFlash.color},${0.4 * screenFlash.t / screenFlash.max})`;
        ctx.fillRect(0, 0, W, H);
      }
      drawHUD();
      drawVignette();
      drawBanner();
      drawCine();
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
      const on = hasEl(r.a) && hasEl(r.b), aff = player.aff;
      const shut = !on && !!FX() && aff.length >= 2 && !(aff.includes(r.a) && aff.includes(r.b)); // fuera de tu Afinidad sellada
      return `<div class="react ${on ? 'on' : shut ? 'shut' : ''}" style="--c:${r.color}">
        <span>${SKILLS.find(k => k.id === r.a).icon}+${SKILLS.find(k => k.id === r.b).icon}</span>
        <b>${r.name}</b><i>${on ? r.desc : shut ? 'Cerrada esta partida' : 'Bloqueada'}</i></div>`;
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
    backArmed = !!(history.state && history.state.arcano);
    if (state === 'levelup' && pickSource === 'awaken') awakenLater(); // Atrás en el panel del despertar = "Aún no"
    else if (state === 'play' || state === 'paused') togglePause();
    else if (['settings', 'credits', 'stats', 'shop', 'gear', 'item', 'grimoire'].includes(state)) goBack();
    else if (state === 'school') showMenu();
    else if (state === 'menu' || state === 'splash' || state === 'tap') history.back(); // en el menú sí sale
    // se vuelve a armar en el siguiente toque (Chrome ignora las entradas creadas sin gesto del usuario)
  });

  function showMenu() {
    state = 'menu';
    player = null; boss = null; room = 0;
    enemies = []; shots = []; bullets = []; drops = []; parts = []; texts = []; bolts = [];
    rings = []; meteors = []; storm = null; sing = null; altar = null; toast = null; screenFlash = null;
    chest = null; cine = null; hz.fill(0);
    awakenFx = null; eclipseFx = null; pools = []; amb = []; ash = []; toastQ = []; bannerNext = null; flashNext = null; curtains = []; fog = null;
    cleared = true; doorAnim = 1; fade = 0; shake = 0;
    nextAch(); // si se sale desde el panel del despertar, los logros retenidos salen aquí
    grid = genRocks(false);
    menuBiome = null; roomBgDirty = true;
    hud(false);
    music('menu');
    try { if (window.ArcanoMusic) window.ArcanoMusic.setIntensity(0); } catch (_) { /* sin música */ }
    const b = store.get('best', null);
    const AL = achList(), done = AL.filter(a => meta.ach[a.id]).length;
    const F = FX(), tt = grimTitle();
    const logros = `<button class="btn ghost" data-act="stats">🏆 Logros <span class="cnt">${done}/${AL.length}</span></button>`;
    const ajustes = '<button class="btn ghost" data-act="settings">⚙️ Ajustes</button>';
    // con forms.js: Grimorio | Logros y Ajustes en su propia fila; sin él, el menú de siempre
    const rows = F ? `<div class="btn-row"><button class="btn ghost" data-act="grimoire">📖 Grimorio <span class="cnt">${F.count(meta.grim.f)}/10</span></button>${logros}</div>
        <div class="btn-row solo">${ajustes}</div>` : `<div class="btn-row">${logros}${ajustes}</div>`;
    showOverlay(`
      <div class="panel menu">
        <div class="logo">ARCANO</div>
        ${tt ? `<div class="mtitle" style="--c:${tt.color}">«${tt.text}»</div>` : ''}
        <div class="tag">Roguelite de magia · ${lastRoom()} salas · 4 jefes</div>
        <button class="btn primary menu-play" data-act="play">JUGAR</button>
        <div class="btn-row">
          <button class="btn ghost" data-act="shop">🏛️ Santuario <span class="ess">✨ ${meta.essence}</span></button>
          <button class="btn ghost" data-act="gear">🎒 Equipo</button>
        </div>
        ${rows}
        ${installEvt ? '<button class="btn ghost install" data-act="install">📲 Instalar en el móvil</button>' : ''}
        ${b ? `<div class="best">Récord: ${b.school && SCHOOLS[b.school] ? SCHOOLS[b.school].icon + ' ' : ''}${b.win ? '🏆 Mazmorra completada' : 'Sala ' + b.room} · Nivel ${b.lvl}</div>` : ''}
        <div class="howto">
          <div><b>Muévete</b> para esquivar · <b>quieto</b> para lanzar hechizos</div>
          <div><b>Combina elementos</b> y suelta tu <b>definitivo</b></div>
        </div>
        <div class="foot"><button class="link" data-act="credits">Doublelag Games</button> · v${VERSION}</div>
      </div>`);
  }

  // ---------- Ajustes (ventana emergente con botones redondos, estilo Archero) ----------
  let settingsFrom = 'menu', notice = '';
  // [clave, icono, nombre]; música y sonido son interruptores como en Archero
  const TOGGLES = [
    ['music', '🎵', 'Música'], ['sfx', '🔊', 'Sonido'], ['vibration', '📳', 'Vibración'],
    ['shake', '💥', 'Temblor'], ['dmgNumbers', '🔢', 'Daño'], ['hd', '✨', 'Gráficos HD'],
    ['lefty', '✋', 'Zurdo'], ['fps', '📊', 'FPS'],
  ];
  const toggleOn = k => k === 'music' || k === 'sfx' ? settings[k] > 0 : k === 'hd' ? settings.quality !== 'baja' : !!settings[k];

  function showSettings(from) {
    if (from) settingsFrom = from;
    state = 'settings';
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.navigator.standalone;
    const tiles = TOGGLES.map(([k, ic, name]) => {
      const on = toggleOn(k);
      return `<button class="ttile ${on ? 'on' : 'off'}" data-act="tset" data-key="${k}" aria-pressed="${on}">
          <span class="ti">${ic}</span><span class="tl">${name}</span><span class="tst">${on ? 'SÍ' : 'NO'}</span></button>`;
    }).join('');
    showOverlay(`
      <div class="popup">
        <div class="pop-head"><span>AJUSTES</span><button class="pop-x" data-act="back" aria-label="Cerrar">✕</button></div>
        <div class="pop-body">
          ${notice ? `<div class="notice">${notice}</div>` : ''}
          <div class="tgrid">${tiles}</div>
          <div class="btn-row">
            <button class="btn ghost" data-act="tutorial">🎓 ${settings.tutorial ? 'Tutorial' : 'Tutorial ✓'}</button>
            <button class="btn ghost" data-act="credits">⭐ Créditos</button>
          </div>
          ${settingsFrom === 'pause' ? '' : '<button class="btn danger wide" data-act="reset">Borrar progreso</button>'}
          ${ios ? '<div class="dim">En iPhone: Compartir → «Añadir a pantalla de inicio» para jugar a pantalla completa. Hazlo cuanto antes: en iOS antiguos el progreso de Safari no siempre pasa a la app.</div>' : ''}
          <div class="pop-foot">Arcano v${VERSION} · Doublelag Games</div>
        </div>
      </div>`);
    notice = '';
  }

  // interruptores de la ventana de ajustes
  function toggleTile(k) {
    if (k === 'music' || k === 'sfx') {
      const keep = k + 'Vol';
      if (settings[k] > 0) { settings[keep] = settings[k]; settings[k] = 0; }
      else settings[k] = settings[keep] || SETTINGS_DEFAULT[k];
      Sfx.init();
    } else if (k === 'hd') settings.quality = settings.quality === 'baja' ? 'alta' : 'baja';
    else settings[k] = !settings[k];
    saveSettings();
    applySettings();
    Sfx.click();
    if (k === 'vibration' && settings.vibration) vibrate(40);
    showSettings();
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
    settings.tutorial = false; settings.ultTip = false; settings.seenHz = {}; settings.tips = {};
    settings.chapter = { id: 1, hero: false }; settings.seenAfx = {}; settings.skin = 0; chForce = false;
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

  // ---------- Equipo ----------
  const GSTAT = [['atkPct', 'Daño', true], ['hpFlat', 'Vida', false], ['critPct', 'Crítico', true], ['rateP', 'Cadencia', true],
    ['speedP', 'Velocidad', true], ['dodgeP', 'Esquiva', true], ['manaStart', 'Maná', false], ['xpPct', 'Experiencia', true]];
  function gearSummary(g) {
    const parts = GSTAT.filter(([k]) => g[k] > 0).map(([k, n, pct]) => `<span><b>+${pct ? Math.round(g[k] * 100) + '%' : g[k]}</b> ${n}</span>`);
    const perks = Object.entries(g.perks).map(([id, lv]) => {
      const P = Gear().PERKS && Gear().PERKS[id];
      return `<span class="gperk">✨ ${P ? P.name : id}${lv > 1 ? ' II' : ''}</span>`;
    });
    return parts.length + perks.length ? parts.concat(perks).join('') : '<span class="dim">Sin equipo: equipa objetos para hacerte más fuerte</span>';
  }

  function showGear() {
    const G = Gear();
    if (!G) { showMenu(); return; }
    const st = state === 'gear' ? panelScroll() : state === 'item' ? gearScroll : 0;
    state = 'gear';
    const slots = G.SLOTS.map(sl => {
      const it = gearItem(meta.gear.eq[sl.id]), d = it ? G.describe(it) : null;
      return `<button class="gslot ${it ? '' : 'empty'}" data-act="${it ? 'item' : 'noop'}" data-uid="${it ? it.uid : ''}" style="--rc:${d ? d.color : '#4a4060'}">
          <span class="gi">${d ? d.icon : sl.icon}</span><span class="gn">${d ? d.name : sl.name}</span></button>`;
    }).join('');
    const inv = meta.gear.inv.slice().sort((a, b) => G.power(b) - G.power(a));
    const tiles = inv.map(it => {
      const d = G.describe(it), eq = isEquipped(it.uid);
      return `<button class="gtile ${eq ? 'eq' : ''}" data-act="item" data-uid="${it.uid}" style="--rc:${d.color}"><span class="gi">${d.icon}</span>${eq ? '<i>E</i>' : ''}</button>`;
    }).join('');
    const groups = G.mergeGroups(meta.gear.inv.filter(it => !isEquipped(it.uid)));
    showOverlay(`
      <div class="panel shop gear">
        <div class="title gold">EQUIPO</div>
        ${notice ? `<div class="notice">${notice}</div>` : ''}
        <div class="gslots">${slots}</div>
        <div class="gsum">${gearSummary(gearStats())}</div>
        <div class="sec">Inventario · ${inv.length}/${GEAR_MAX}</div>
        ${groups.length ? `<button class="btn primary wide" data-act="mergeall">⚒️ Fusionar todo (${groups.length})</button>` : ''}
        ${inv.length ? `<div class="ginv">${tiles}</div>` : '<div class="empty">Aún no tienes objetos: caen al final de cada partida y en los cofres</div>'}
        <div class="dim">3 objetos iguales de la misma rareza se fusionan en uno mejor</div>
        <button class="btn primary sticky" data-act="back">VOLVER</button>
      </div>`);
    notice = '';
    restoreScroll(st);
  }

  let gearScroll = 0;
  function showItem(uid) {
    const G = Gear(), it = gearItem(uid);
    if (!G || !it) { showGear(); return; }
    if (state === 'gear') {
      gearScroll = panelScroll();
      // entrada propia en el historial: el gesto Atrás cierra el objeto sin salir del juego
      if (!(history.state && history.state.arcano === 'item')) try { history.pushState({ arcano: 'item' }, ''); } catch (_) { /* sin historial */ }
    }
    state = 'item';
    const d = G.describe(it), eq = isEquipped(uid), slot = G.SLOTS.find(sl => sl.id === d.slot);
    const same = meta.gear.inv.filter(o => o.base === it.base && o.r === it.r && !isEquipped(o.uid));
    const canMerge = !eq && it.r < G.RARITIES.length - 1 && same.length >= 3;
    showOverlay(`
      <div class="popup">
        <div class="pop-head" style="background:linear-gradient(${shade(d.color, 0.2)}, ${shade(d.color, -0.3)})"><span>${d.rarityName.toUpperCase()}</span>
          <button class="pop-x" data-act="gearback" aria-label="Cerrar">✕</button></div>
        <div class="pop-body">
          <div class="ibig" style="--rc:${d.color}">${d.icon}</div>
          <div class="iname" style="color:${d.color}">${d.name}</div>
          <div class="islot">${slot ? slot.icon + ' ' + slot.name : ''}</div>
          <div class="ilines">${d.lines.map(l => `<div>${l}</div>`).join('')}</div>
          ${d.perk ? `<div class="iperk">✨ ${d.perk}</div>` : ''}
          ${d.nextPerk ? `<div class="inext">🔒 ${d.nextPerk}</div>` : ''}
          <div class="btn-row">
            <button class="btn ${eq ? 'ghost' : 'primary'}" data-act="${eq ? 'unequip' : 'equip'}" data-uid="${uid}">${eq ? 'Quitar' : 'Equipar'}</button>
            ${canMerge ? `<button class="btn ghost" data-act="merge" data-uid="${uid}">⚒️ Fusionar</button>` : ''}
          </div>
          ${!canMerge && !eq && it.r < G.RARITIES.length - 1 ? `<div class="dim">Para fusionar: ${same.length}/3 iguales sin equipar</div>` : ''}
          ${!eq ? `<button class="btn danger small salvage" data-act="salvage" data-uid="${uid}">🗑️ Desechar</button>` : ''}
        </div>
      </div>`);
  }

  function gearAction(act, uid) {
    const G = Gear(), it = gearItem(uid);
    if (act === 'equip' && it) { meta.gear.eq[G.getBase(it.base).slot] = uid; Sfx.pick(); }
    else if (act === 'unequip' && it) { delete meta.gear.eq[G.getBase(it.base).slot]; Sfx.click(); }
    else if (act === 'merge' && it) {
      const others = meta.gear.inv.filter(o => o.uid !== uid && o.base === it.base && o.r === it.r && !isEquipped(o.uid)).slice(0, 2);
      const made = others.length === 2 && G.merge(meta.gear.inv, [uid, others[0].uid, others[1].uid], meta.gear.next);
      if (made) {
        meta.gear.next++;
        const gone = new Set([uid, others[0].uid, others[1].uid]);
        meta.gear.inv = meta.gear.inv.filter(o => !gone.has(o.uid));
        meta.gear.inv.push(made);
        saveMeta(); Sfx.buy();
        showItem(made.uid);
        return;
      }
    } else if (act === 'mergeall') { // fusiona en cadena hasta que no quede nada que fusionar
      let n = 0;
      for (let guard = 0; guard < 50; guard++) {
        const groups = G.mergeGroups(meta.gear.inv.filter(o => !isEquipped(o.uid)));
        if (!groups.length) break;
        for (const grp of groups) {
          const made = G.merge(meta.gear.inv, grp, meta.gear.next);
          if (!made) continue;
          meta.gear.next++;
          meta.gear.inv = meta.gear.inv.filter(o => !grp.includes(o.uid));
          meta.gear.inv.push(made); n++;
        }
      }
      if (n) { Sfx.buy(); notice = `⚒️ ${n} fusión${n > 1 ? 'es' : ''} hecha${n > 1 ? 's' : ''}`; }
    } else if (act === 'salvage' && it && !isEquipped(uid)) {
      meta.gear.inv = meta.gear.inv.filter(o => o.uid !== uid);
      Sfx.click(); notice = '🗑️ Objeto desechado';
    }
    saveMeta();
    showGear();
  }

  // ---------- Logros y estadísticas ----------
  const fmtLong = s => s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor(s % 3600 / 60)} min` : `${Math.floor(s / 60)} min`;
  // S.best: «Sala 12» / «🏆» en el C1 Normal; «C2·S12», «🏆 C3», «♛ C1·S8» en el resto
  function bestLabel(v) {
    const d = Chapters() ? Chapters().decodeBest(v) : { ch: 1, hero: false, room: Math.min(20, v), win: v > CH_FALLBACK.ch.len };
    if (d.ch === 1 && !d.hero) return d.win ? '🏆' : 'Sala ' + d.room;
    const c = (d.hero ? '♛ ' : '') + 'C' + d.ch;
    return d.win ? '🏆 ' + c : c + '·S' + d.room;
  }
  function showStats() {
    state = 'stats';
    const S = meta.stats;
    const AL = achList(), done = AL.filter(a => meta.ach[a.id]).length;
    const bests = Object.entries(SCHOOLS).map(([id, s]) => {
      const b = S.best[id], w = S.winsBy[id] || 0;
      return `<div class="sb ${schoolOpen(id) ? '' : 'off'}" style="--c:${EL[id].color}">
          <span>${schoolOpen(id) ? s.icon : '🔒'}</span><b>${b ? bestLabel(b) : '—'}</b>
          <i>${w ? w + (w > 1 ? ' victorias' : ' victoria') : s.name}</i></div>`;
    }).join('');
    const achs = AL.map(a => {
      const got = meta.ach[a.id];
      return `<div class="shop-item ach ${got ? 'got' : ''}"><span class="ic">${got ? a.icon : '🔒'}</span>
          <span class="tx"><b>${a.name}</b><i>${a.desc}</i></span><span class="price">${got ? '✓' : '✨ ' + a.reward}</span></div>`;
    }).join('');
    showOverlay(`
      <div class="panel shop">
        <div class="title gold">LOGROS</div>
        <div class="sub">${done} de ${AL.length} desbloqueados</div>
        <div class="stats">
          <div><span>Partidas</span><b>${meta.runs}</b></div>
          <div><span>Victorias</span><b>${S.wins}</b></div>
          <div><span>Bajas</span><b>${S.kills}</b></div>
          <div><span>Jefes</span><b>${S.bosses}</b></div>
          <div><span>Reacciones</span><b>${S.reactions}</b></div>
          <div><span>Tiempo jugado</span><b>${fmtLong(S.time)}</b></div>
          ${grimStatRows()}
        </div>
        <div class="sec">Mejor sala por escuela</div>
        <div class="sbests">${bests}</div>
        <div class="sec">Logros</div>
        <div class="shop-list">${achs}</div>
        <button class="btn primary sticky" data-act="back">VOLVER</button>
      </div>`);
  }

  // ---------- Grimorio: formas, reacciones y (fase 2) Mezclas descubiertas ----------
  const GRIM_TITLES = ['Sin Forma', 'Llama Viva', 'Invierno Quieto', 'Trueno Errante', 'Paciencia Verde', 'Estrella Caída', 'Luz del Norte', 'Sudario Blanco', 'Boca de Volcán', 'Sin Equilibrio'];
  const elIc = el => SKILL_BY_ID[el].icon;
  const decimal = v => (Math.round(v * 10) / 10).toString().replace('.', ',');
  let grimTab = 'formas';
  // páginas: 10 formas + 6 reacciones (+ 8 Mezclas en la fase 2)
  function grimPages() {
    const F = FX(), g = meta.grim, mx = !!F && flags.phase2;
    const f = F ? F.count(g.f) : 0, r = REACTIONS.filter(x => meta.stats.reactSeen[x.id]).length, m = mx ? F.count(g.m) : 0;
    return { f, r, m, n: f + r + m, tot: 10 + REACTIONS.length + (mx ? F.MIXES.length : 0) };
  }
  // Marca II: la pura, despertada antes de la sala 7; combinadas, Eclipse y Aprendiz, ganar con ella
  function grimMark2(id) { const F = Forms(), g = meta.grim; return F.FORMS[id].tier === 1 ? F.has(g.e, id) : F.has(g.w, id); }
  // título que se luce (si aún tiene la Marca II de esa forma)
  function grimTitle() {
    const F = FX(), t = meta.grim.t;
    return F && t >= 0 && grimMark2(F.IDS[t]) ? { text: GRIM_TITLES[t], color: F.FORMS[F.IDS[t]].color } : null;
  }
  // receta de una forma: elementos y en qué despertar se consigue
  function formRecipe(D) {
    if (D.tier === 0) return 'Tu forma al empezar cada partida';
    if (D.id === 'eclipse') return `${elIc('fire')}+${elIc('ice')} o ${elIc('bolt')}+${elIc('poison')} · opuestos y Pacto oscuro`;
    return D.els.map(el => `${elIc(el)} ${EL[el].name}`).join(' + ') + (D.tier === 1 ? ' · 1er despertar' : ' · 2º despertar');
  }
  // rombo del cuadrado: Fuego arriba, Rayo a la derecha, Hielo abajo y Veneno a la izquierda; las híbridas en los lados, Eclipse en el centro.
  // run = opciones del panel del despertar: además enseña la partida (tu núcleo, lo que la Afinidad cerró y a dónde puedes despertar)
  function grimRombo(run) {
    const F = Forms(), on = id => F.has(meta.grim.f, id), p = player;
    const V = { fire: [50, 0], bolt: [100, 50], ice: [50, 100], poison: [0, 50] };
    const SIDES = [['plasma', 'fire', 'bolt', 'tr'], ['aurora', 'bolt', 'ice', 'br'], ['mortaja', 'ice', 'poison', 'bl'], ['azufre', 'poison', 'fire', 'tl']];
    const open = run ? run.filter(o => !o.locked) : [], aff = run ? p.aff : [], sealed = aff.length >= 2;
    const goEl = el => open.some(o => o.el === el), goForm = (id, a, b) => open.some(o => o.form === id && (!a || [a, b].includes(o.el)));
    const shutEl = el => sealed && !aff.includes(el), shutPair = (a, b) => shutEl(a) || shutEl(b) || (run && p.core && ![a, b].includes(p.core));
    const line = (a, b, col, dash, go) => `<line${go ? ' class="go"' : ''} x1="${V[a][0]}" y1="${V[a][1]}" x2="${V[b][0]}" y2="${V[b][1]}" stroke="${col}"${dash ? ' stroke-dasharray="3 5"' : ''} />`;
    const ecl = on('eclipse'), faint = 'rgba(255,255,255,.12)';
    let svg = '', labels = '', ctr = ecl ? ' on' : '';
    for (const [a, b] of [['fire', 'ice'], ['bolt', 'poison']]) { // diagonales: Eclipse
      const go = run && goForm('eclipse', a, b);
      if (go) ctr = ' on go';
      svg += line(a, b, go || ecl ? (run && shutPair(a, b) ? faint : '#c77dff') : faint, !go && !ecl, go);
    }
    for (const [id, a, b, pos] of SIDES) {
      const D = F.FORMS[id], o = on(id), go = run && goForm(id, a, b), shut = run && !go && shutPair(a, b);
      svg += line(a, b, (o || go) && !shut ? D.color : 'rgba(255,255,255,.22)', !o && !go, go);
      labels += `<span class="h ${pos}${o ? ' on' : ''}${go ? ' go' : ''}${shut ? ' shut' : ''}" style="--c:${D.color}">${o ? D.short : '???'}</span>`;
    }
    // un vértice se enciende si alguna forma descubierta lleva ese elemento; en partida, si es tuyo o puedes despertar en él
    const verts = F.SQUARE.map(el => {
      const lit = run ? aff.includes(el) || p.core === el || goEl(el) : F.IDS.some(id => on(id) && F.FORMS[id].els.includes(el));
      const cls = (lit ? ' on' : '') + (run && p.core === el ? ' core' : '') + (run && !p.core && goEl(el) ? ' go' : '') + (run && shutEl(el) ? ' shut' : '');
      return `<span class="v${cls}" style="left:${V[el][0]}%;top:${V[el][1]}%;--c:${EL[el].color}">${elIc(el)}</span>`;
    }).join('');
    return `<div class="rombo${run ? ' mini' : ''}"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${svg}</svg>${verts}${labels}
      <span class="ctr${ctr}">${ecl ? F.FORMS.eclipse.icon : '?'}</span></div>`;
  }
  function grimFormItem(id) {
    const F = Forms(), g = meta.grim, D = F.FORMS[id], i = D.bit;
    if (!F.has(g.f, id)) { // hueco: silueta y "???"; las híbridas enseñan la receta y Eclipse nada
      const rec = id === 'eclipse' ? 'La forma prohibida. Algo duerme entre los opuestos' : D.els.map(elIc).join(' + ') + ' · ???';
      return `<div class="shop-item grim locked"><span class="ic">${id === 'eclipse' ? '❔' : D.icon}</span><span class="tx"><b>???</b><i>${rec}</i></span></div>`;
    }
    const n = +g.n[i], m2 = grimMark2(id), worn = g.t === i;
    const ult = D.tier === 0 ? 'el de tu escuela' : D.tier === 1 || flags.phase2 ? `${D.ult.icon} ${D.ult.name}` : 'el de tu núcleo';
    const goal = D.tier === 1 ? `Despiértala antes de la sala ${CHA().markRoom(CH) + 1}` : D.tier === 0 ? 'Gana sin despertar' : 'Gana con ella';
    return `<div class="shop-item grim${m2 ? ' crowned' : ''}" style="--c:${D.color}">
        <span class="ic">${D.icon}</span>
        <span class="tx"><b>${D.name}</b><i class="rc">${formRecipe(D)}</i><i class="line">${D.line}</i>
          <i><u>${D.trName}</u> · ${D.desc}</i><i>Definitivo: ${ult}</i>
          <span class="gfoot"><span class="mk on" title="Marca I">I</span><span class="mk${m2 ? ' on' : ''}" title="Marca II">II</span>
            ${D.tier ? `<em>Despertada ${n >= 9 ? '9+' : n} ${n === 1 ? 'vez' : 'veces'}</em>` : ''}
            ${m2 ? `<button class="gtt${worn ? ' on' : ''}" data-act="title" data-i="${i}">${worn ? '✓ Luces' : 'Lucir'} «${GRIM_TITLES[i]}»</button>` : `<em class="goal">II: ${goal} → corona y título</em>`}</span>
        </span>
      </div>`;
  }
  function grimReactItem(r) {
    const seen = !!meta.stats.reactSeen[r.id];
    return `<div class="shop-item grim${seen ? '' : ' unseen'}" style="--c:${r.color}"><span class="ic rx">${elIc(r.a)}${elIc(r.b)}</span>
        <span class="tx"><b>${seen ? r.name : '???'}</b><i>${EL[r.a].name} + ${EL[r.b].name}${seen ? ' · ' + r.desc : ''}</i></span></div>`;
  }
  function grimMixItem(m) {
    if (!Forms().has(meta.grim.m, m.id)) return `<div class="shop-item grim unseen"><span class="ic">${elIc(m.el)}</span><span class="tx"><b>???</b><i>${elIc(m.el)} + ???</i></span></div>`;
    return `<div class="shop-item grim" style="--c:${m.color}"><span class="ic">${m.icon}</span><span class="tx"><b>${m.name}</b><i class="rc">${m.recipe}</i><i>${m.desc}</i></span></div>`;
  }
  function showGrimoire(tab) {
    const F = FX();
    if (!F) { showMenu(); return; }
    const st = state === 'grimoire' && (!tab || tab === grimTab) ? panelScroll() : 0; // cambiar de pestaña vuelve arriba
    if (tab) grimTab = tab;
    if (grimTab === 'mezclas' && !flags.phase2) grimTab = 'formas';
    state = 'grimoire';
    const P = grimPages();
    const tabs = [['formas', '📖 Formas', `${P.f}/10`], ['reacciones', '⚗️ Reacciones', `${P.r}/${REACTIONS.length}`]]
      .concat(flags.phase2 ? [['mezclas', '🧪 Mezclas', `${P.m}/${F.MIXES.length}`]] : []);
    let body;
    if (grimTab === 'formas') body = grimRombo() + grimRhythm() + `<div class="shop-list">${F.IDS.map(grimFormItem).join('')}</div>`;
    else if (grimTab === 'reacciones') body = `<div class="dim">Junta dos elementos en el mismo enemigo</div><div class="shop-list">${REACTIONS.map(grimReactItem).join('')}</div>`;
    else body = `<div class="dim">Una runa y una carta concretas: la receta está oculta</div><div class="shop-list">${F.MIXES.map(grimMixItem).join('')}</div>`;
    showOverlay(`
      <div class="panel shop grim">
        <div class="title gold">GRIMORIO</div>
        <div class="sub">${P.n} de ${P.tot} páginas · ${Math.floor(P.n / P.tot * 100)}%</div>
        <div class="grim-tabs">${tabs.map(([id, name, n]) => `<button class="tab${id === grimTab ? ' on' : ''}" data-act="grim" data-tab="${id}">${name} <i>${n}</i></button>`).join('')}</div>
        ${body}
        <button class="btn primary sticky" data-act="back">VOLVER</button>
      </div>`);
    restoreScroll(st);
  }
  // filas del Grimorio en Logros: formas y sala media de cada despertar
  const grimAvg = (s, n) => (n ? decimal(s / n) : '—');
  function grimStatRows() {
    const F = FX(), k = meta.grim.k;
    if (!F) return '';
    return `<div><span>Formas</span><b>${F.count(meta.grim.f)}/10</b></div>
          <div><span>Sala media al despertar</span><b>${grimAvg(k[0], k[1])}${k[3] ? ' y ' + grimAvg(k[2], k[3]) : ''}</b></div>`;
  }
  // ritmo bajo el rombo del Grimorio (cuando ya has despertado alguna vez)
  function grimRhythm() {
    const k = meta.grim.k;
    return k[1] ? `<div class="rhythm">Despiertas de media en la sala <b>${grimAvg(k[0], k[1])}</b>${k[3] ? ` y en la <b>${grimAvg(k[2], k[3])}</b>` : ''}</div>` : '';
  }
  // pausa: "Forma: PLASMA · Fuego + Rayo" o "Aprendiz · Afinidad: Fuego + Rayo · Despertar 64%"
  function formLine() {
    const p = player, F = FX();
    if (!F || !p) return '';
    const D = F.FORMS[p.form], aff = p.aff.map(el => EL[el].name).join(' + ');
    const prog = p.awak >= 2 ? '' : p.animaReady ? (p.awkLock ? (altarLeft() ? 'Despertar: falta un Pacto oscuro' : 'Opuestos: sin Pacto no hay 2º despertar') : 'Despertar listo')
      : `Despertar ${Math.floor(clamp(p.anima / animaNeed(p.awak), 0, 1) * 100)}%`;
    const parts = p.awak ? [`Forma: <b>${D.short}</b>`, p.awak === 2 ? F.pairText(p.core, p.second) : aff.includes('+') ? 'Afinidad: ' + aff : EL[p.core].name]
      : ['Aprendiz', aff ? 'Afinidad: ' + aff : ''];
    return `<div class="formline" style="--c:${D.color}">${D.icon} ${parts.concat(prog).filter(Boolean).join(' · ')}</div>`;
  }
  // pausa: Mezclas activas en esta partida
  function mixLine() {
    const p = player;
    if (!p || !p.mixes.length) return '';
    return `<div class="mixline">🧪 Mezclas: ${p.mixes.map(m => `<b style="--c:${m.color}">${m.name}</b>`).join(' · ')}</div>`;
  }
  // final: con qué forma acabas, Marca II nueva, qué te falta por descubrir y si hubo página nueva
  function endGrim(win, quit, mark) {
    const F = FX();
    if (!F || !player) return '';
    const D = F.FORMS[player.form], g = meta.grim;
    const miss = F.IDS.filter(id => !F.has(g.f, id)).map(id => {
      const E = F.FORMS[id];
      return id === 'eclipse' ? '???' : E.els.map(elIc).join('+') + ' ???';
    });
    const P = grimPages(), fresh = runGrim0 ? P.n - runGrim0.n : 0;
    const tt = grimTitle(), verb = win ? 'Ganaste' : quit ? 'Terminaste' : 'Caíste';
    return `<div class="emblem${grimMark2(player.form) ? ' crowned' : ''}" style="--c:${D.color}"><span class="ei">${D.icon}</span><span>${verb} como <b>${D.name}</b>${tt ? ` <i>«${tt.text}»</i>` : ''}</span></div>
        ${mark ? `<div class="newmark" style="--c:${F.FORMS[mark].color}">👑 Marca II de ${F.FORMS[mark].name}: corona y título «${GRIM_TITLES[F.FORMS[mark].bit]}»</div>` : ''}
        ${fresh > 0 ? `<div class="newpage">📖 ${fresh > 1 ? fresh + ' páginas nuevas' : 'Nueva página'} del Grimorio</div>` : ''}
        ${miss.length ? `<div class="missing">Te faltan: ${miss.slice(0, 4).join(', ')}${miss.length > 4 ? ` +${miss.length - 4}` : ''}</div>` : ''}`;
  }

  let shopFrom = 'menu';
  function goBack() {
    Sfx.click();
    if (state === 'shop' && shopFrom === 'school') { shopFrom = 'menu'; hideOverlay(); return newRun(); }
    if (state === 'item') return showGear();
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
    const p = player, F = FX(), sealed = !!F && p.aff.length >= 2;
    // con la Afinidad sellada las runas de los otros dos elementos no vuelven a salir (tampoco al cambiar cartas)
    const pool = SKILLS.filter(k => (p.sk[k.id] || 0) < k.max && (!k.cond || k.cond()) && !(sealed && k.el && !p.aff.includes(k.id)));
    // pesos: tus runas ×1,5 con la Afinidad sellada; la pieza que falta de una Mezcla de tus elementos ×1,3 (fase 2)
    const w = pool.map(k => k.w * (sealed && k.el ? 1.5 : 1) * (F && flags.phase2 && F.mixHint(k.id, p.sk, p.aff) ? 1.3 : 1));
    const out = [];
    while (out.length < n && pool.length) {
      const tot = w.reduce((s, v) => s + v, 0);
      let r = Math.random() * tot, idx = 0;
      for (; idx < pool.length - 1; idx++) { r -= w[idx]; if (r <= 0) break; }
      out.push(pool.splice(idx, 1)[0]);
      w.splice(idx, 1);
    }
    return out;
  }

  // líneas extra de una carta: sellado de la Afinidad (2 líneas) > Mezcla (fase 2) > reacciones que desbloquea
  function cardLines(k) {
    const p = player, F = FX();
    const combo = k.el ? unlocksWith(k.id) : [];
    const unl = combo.length ? `Desbloquea ${combo.map(r => r.name).join(' y ')}` : '';
    const si = F && k.el ? F.sealInfo(p.aff, k.id) : null;
    if (si) {
      const fn = F.has(meta.grim.f, si.form) ? F.FORMS[si.form].short : '???';
      const l1 = unl ? `${unl} · Sella → ${fn}` : `Sella ${EL[si.pair[0]].name} + ${EL[si.pair[1]].name} → ${fn}`;
      const l2 = si.opp ? 'Opuestos: el 2º despertar exigirá un Pacto oscuro' : `Cierra ${EL[si.closes[0]].name} y ${EL[si.closes[1]].name}`;
      return { cls: ' seal', style: `--c:${EL[si.pair[0]].color};--c2:${EL[si.pair[1]].color};`, html: `<div class="combo">✨ ${l1}</div><div class="combo close">${l2}</div>` };
    }
    if (F && k.el && !p.aff.length && !p.aff.includes(k.id)) return { cls: combo.length ? ' hot' : '', style: '', html: `<div class="combo">✨ ${unl ? unl + ' · ' : ''}Será tu primer elemento</div>` };
    if (F && k.form) { const D = F.FORMS[k.form]; return { cls: ' formcard', style: `--c:${D.color};`, html: `<div class="combo fm">${D.icon} Carta de tu forma ${D.short}</div>` }; } // fase 2: solo sale en esa forma
    const mx = F && flags.phase2 ? F.mixHint(k.id, p.sk, p.aff) : null;
    if (mx) return { cls: ' hot', style: '', html: `<div class="combo mix">🧪 ${F.has(meta.grim.m, mx.id) ? 'Mezcla: ' + mx.name : 'Algo reacciona…'}</div>` };
    return { cls: combo.length ? ' hot' : '', style: '', html: unl ? `<div class="combo">✨ ${unl}</div>` : '' };
  }

  function openLevelUp(src = pickSource) {
    if (src === 'awaken') return openAwaken();
    pickSource = src;
    awakenWait = 0;
    const opts = rollSkills(3);
    if (!opts.length) { if (src === 'level') pendingLevels = 0; else bonusPicks = []; return; }
    state = 'levelup';
    resetJoy();
    lockUntil = performance.now() + 380; // evita elegir sin querer con el dedo aún en pantalla
    const title = { chest: '¡COFRE!', pact: '¡PACTO!', bless: '¡BENDICIÓN!' }[src] || `¡NIVEL ${player.lvl - pendingLevels + 1}!`;
    const cards = opts.map((k, i) => {
      const lv = player.sk[k.id] || 0;
      const pips = k.max > 1 && k.max < 50 ? `<div class="pips">${'★'.repeat(lv + 1)}${'☆'.repeat(k.max - lv - 1)}</div>` : '';
      const cl = cardLines(k);
      return `<button class="card${cl.cls}" data-act="pick" data-id="${k.id}" style="${cl.style}animation-delay:${i * 70}ms">
          <div class="ic">${k.icon}</div>
          <div class="tx"><div class="nm">${k.name}</div><div class="ds">${k.desc}</div>${cl.html}${pips}</div>
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

  // ---------- Despertar: panel con una carta por elemento (en el orden del cuadrado) y "Aún no" ----------
  function openAwaken() {
    const p = player, F = FX();
    if (!F) return;
    const st = p.awak + 1, S = SCHOOLS[p.school];
    const opts = F.options({ stage: st, aff: p.aff, core: p.core, pact: pactRun });
    if (!opts.some(o => !o.locked)) return;
    pickSource = 'awaken';
    state = 'levelup';
    resetJoy();
    awakenWait = 0;
    achYield(); // el logro del jefe no tapa el título ni el rombo
    lockUntil = performance.now() + 600; // que no se elija sin querer: no hay vuelta atrás
    let n = 0;
    const cards = opts.map((o, i) => {
      const D = F.FORMS[o.form], ic = SKILL_BY_ID[o.el].icon, delay = `animation-delay:${i * 80}ms`;
      if (o.locked) return `<button class="card awaken locked" data-act="noop" style="--c:#c77dff;--c2:#c77dff;${delay}">
          <div class="ic">${ic}</div>
          <div class="tx"><div class="nm">${EL[o.el].name} → <b>???</b></div><div class="ds">Opuestos · Sella un Pacto oscuro en un altar</div></div>
        </button>`;
      const name = F.has(meta.grim.f, o.form) ? D.title : '???';
      // como mucho 1 línea extra: sellado > Sintonía > Linaje
      let extra = '';
      if (o.form === 'eclipse') extra = (o.seals ? `Sella ${F.pairText(o.seals[0], o.seals[1])} · ` : '') + `forma prohibida: −${Math.round((1 - F.FORMS.eclipse.trait.hpMul) * 100)}% de vida`; // el precio, siempre a la vista
      else if (o.seals) {
        const cl = F.SQUARE.filter(x => !o.seals.includes(x));
        extra = `Sella ${F.pairText(o.seals[0], o.seals[1])} · ` + (F.isOpp(o.seals[0], o.seals[1]) ? 'el 2º despertar exigirá un Pacto oscuro' : `cierra ${EL[cl[0]].name.toLowerCase()} y ${EL[cl[1]].name.toLowerCase()}`);
      }
      else if ((p.sk[o.el] || 0) >= 2) extra = 'Runa al máximo: despiertas con el definitivo lleno';
      else if (S.el && (o.el === S.el || (st === 2 && p.core === S.el))) extra = 'Fiel a tu escuela: definitivo +20%';
      return `<button class="card awaken${o.seals ? ' seal' : ''}" data-act="pick" data-id="awk:${o.el}" style="--c:${EL[o.el].color};--c2:${D.color};${delay}">
          <div class="ic">${ic}</div>
          <div class="tx"><div class="nm">${EL[o.el].name} → <b>${name}</b></div><div class="ds">${D.desc}</div>${extra ? `<div class="combo${o.seals || o.form === 'eclipse' ? ' close' : ''}">${extra}</div>` : ''}</div>
          <kbd>${++n}</kbd>
        </button>`;
    }).join('');
    showOverlay(`
      <div class="panel">
        <div class="title gold${st === 1 ? '' : ' long'}">${st === 1 ? 'DESPIERTA' : 'SEGUNDO DESPERTAR'}</div>
        <div class="sub">Elige tu elemento · no hay vuelta atrás</div>
        ${grimRombo(opts)}
        <div class="cards">${cards}</div>
        <button class="btn ghost later" data-act="later">Aún no</button>
      </div>`);
    // el mini-rombo es opcional: fuera si con él hubiera que desplazar el panel (4 cartas en pantallas bajas)
    const pn = overlay.querySelector('.panel');
    if (pn && pn.scrollHeight > pn.clientHeight + 1) { const rb = pn.querySelector('.rombo'); if (rb) rb.remove(); }
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
            <div class="tx"><div class="nm">Fuente sagrada</div><div class="ds">Recuperas el ${Math.round(healCfg().altar * 100)}% de la vida (${Math.ceil(player.hp)}/${player.maxHp})</div></div><kbd>1</kbd>
          </button>
          <button class="card" data-act="altar" data-id="bless" style="animation-delay:70ms">
            <div class="ic">✨</div>
            <div class="tx"><div class="nm">Bendición arcana</div><div class="ds">Eliges una habilidad ahora mismo</div></div><kbd>2</kbd>
          </button>
          ${player.mana >= 100 ? `<button class="card" data-act="altar" data-id="shield" style="animation-delay:140ms">
            <div class="ic">🛡️</div>
            <div class="tx"><div class="nm">Escudo arcano</div><div class="ds">Bloquea por completo el primer golpe del jefe</div></div><kbd>3</kbd>
          </button>` : `<button class="card" data-act="altar" data-id="mana" style="animation-delay:140ms">
            <div class="ic">${ultIcon()}</div>
            <div class="tx"><div class="nm">Ofrenda de maná</div><div class="ds">Tu ${ultName()} empieza el jefe cargado</div></div><kbd>3</kbd>
          </button>`}
          ${player.maxHp >= 80 ? `<button class="card pact" data-act="altar" data-id="pact" style="animation-delay:210ms">
            <div class="ic">😈</div>
            <div class="tx"><div class="nm">Pacto oscuro</div><div class="ds">Pierdes el 20% de la vida máxima a cambio de 2 habilidades ahora${FX() && !pactRun && player.awak < 2 && player.aff.length === 2 && Forms().isOpp(player.aff[0], player.aff[1]) ? ' · Abre el camino a Eclipse si tus elementos son opuestos' : ''}</div></div><kbd>4</kbd>
          </button>` : ''}
        </div>
      </div>`);
  }

  function pickAltar(id) {
    hideOverlay();
    state = 'play';
    if (id === 'heal') heal(player.maxHp * healCfg().altar);
    else if (id === 'bless') bonusPicks.push('bless');
    else if (id === 'shield') player.shield = Math.min(3, (player.shield || 0) + 1);
    else if (id === 'pact') {
      player.maxHp = Math.max(40, Math.round(player.maxHp * 0.8));
      player.hp = Math.min(player.hp, player.maxHp);
      bonusPicks.push('pact', 'pact'); // dos habilidades sin subir de nivel (no encarece la experiencia)
      pactRun = true; player.snoozeRoom = -1; // abre el camino a Eclipse y reabre el despertar en esta sala
      meta.stats.pacts++;
      unlock('pact');
      burst(player.x, player.y, '#b0203a', 30, 240);
      screenFlash = { color: '120,0,30', t: 0.5, max: 0.5 };
      pushToast({ text: 'PACTO SELLADO', sub: 'Tu vida máxima baja… pero tu poder crece', color: '#ff5a7a', t: 2.4, max: 2.4 });
      Sfx.boss();
    }
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

  function essenceParts(win) {
    return [
      ['Salas', Math.max(0, room - 1) * 1.5],
      ['Bajas', kills * 0.15],
      ['Jefes', bossesKilled * 8],
      ['Cofres', runBonusEss],
      ['Victoria', win ? 25 : 0],
    ].map(([k, v]) => [k, Math.round(v)]).filter(([, v]) => v > 0);
  }
  function calcEssence(win) {
    return essenceParts(win).reduce((a, [, v]) => a + v, 0);
  }

  function pickSkill(id) {
    if (id.startsWith('awk:')) return startAwaken(id.slice(4)); // carta del despertar
    const s = player.sk, F = FX(), k = SKILL_BY_ID[id];
    if (id === 'heal') heal(player.maxHp * 0.35);
    else {
      s[id] = (s[id] || 0) + 1;
      if (id === 'hp') { player.maxHp += 25; player.hp += 25; }
    }
    if (F && k && k.el && !player.aff.includes(id)) addAffinity(id); // runa de otro elemento: entra en la Afinidad (y quizá la sella)
    if (F && id.startsWith('f_')) player.tr = F.traitsFor(player.core, player.second, s); // carta de forma: rasgos de nuevo
    recalc();
    refreshMixes();
    Sfx.pick();
    if (pickSource === 'level') pendingLevels = Math.max(0, pendingLevels - 1);
    else bonusPicks.shift();
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
        ${formLine()}
        ${skillChips()}
        ${mixLine()}
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
    achEl.classList.add('low'); // el logro que ya se ve (el del jefe) también baja: arriba va el emblema
    nextAch(); // uno retenido por un despertar a punto (se abandona o se cae antes del panel) sale aquí, no en la partida siguiente
    hud(false);
    resetJoy();
    if (win) Sfx.win();
    // récord del menú: el del capítulo más alto (c_ef) jugado; sin ch = Capítulo 1 Normal (guardados de antes)
    const prev = store.get('best', null), cEf = b => ((b && b.ch) || 1) + (b && b.hero ? 3 : 0);
    const cur = { room, lvl: player.lvl, win, school: player.school, ch: CH.id, hero: HEROIC };
    const better = !prev || cEf(cur) > cEf(prev) || (cEf(cur) === cEf(prev) && ((win && !prev.win) || (!prev.win && (room > prev.room || (room === prev.room && player.lvl > prev.lvl)))));
    if (better) store.set('best', cur);
    runProg = progEnd(win); // estrellas, capítulos completados y récord por capítulo (meta.prog)
    runEssence = calcEssence(win);
    meta.essence += runEssence;
    if (Gear() && room >= 3) { // botín de equipo según hasta dónde llegaste
      const n = 1 + Math.min(2, bossesKilled) + (win ? 1 : 0);
      for (let i = 0; i < n; i++) { const it = addGear(Gear().rollDrop(room, Math.random)); if (it) runLoot.push(it); else lostLoot++; }
    }
    meta.runs++;
    const S = meta.stats;
    S.essenceTotal += runEssence;
    { const v = bestCode(win), o = S.best[player.school] || 0; if (!o || bestRank(v) > bestRank(o)) S.best[player.school] = v; }
    let mark = null; // Marca II conseguida con esta victoria (combinadas, Eclipse y Aprendiz)
    if (win) {
      S.wins++;
      if (FX()) { // Grimorio: forma con la que has ganado (Aprendiz = sin despertar)
        const F = Forms(), had = grimMark2(player.form);
        meta.grim.w |= F.bit(player.form);
        if (!had && grimMark2(player.form)) mark = player.form;
        if (['plasma', 'aurora', 'mortaja', 'azufre', 'eclipse'].every(x => F.has(meta.grim.w, x))) unlock('formWins');
      }
      S.winsBy[player.school] = (S.winsBy[player.school] || 0) + 1;
      unlock('firstWin');
      if (runTime < 270) unlock('speedrun');
      if (Object.keys(SCHOOLS).every(id => S.winsBy[id])) unlock('winAll');
      music('victory');
    } else if (quit) music('menu');
    saveMeta();
    const title = win ? '¡VICTORIA!' : quit ? 'PARTIDA TERMINADA' : 'HAS CAÍDO';
    const sub = win ? 'Has limpiado la mazmorra entera' : `${quit ? 'abandonaste' : 'caíste'} en la sala ${room} de ${lastRoom()}`;
    showOverlay(`
      <div class="panel">
        <div class="title ${win ? 'gold' : 'red'}">${title}</div>
        <div class="sub">${SCHOOLS[player.school].icon} ${SCHOOLS[player.school].name} · ${sub}</div>
        ${endGrim(win, quit, mark)}
        <div class="earn">+✨ ${runEssence} de esencia <span>(tienes ${meta.essence})</span></div>
        <div class="earn-parts">${essenceParts(win).map(([k, v]) => `${k} +${v}`).join(' · ')}</div>
        ${runLoot.length && Gear() ? `<div class="loot">${runLoot.map(it => { const d = Gear().describe(it); return `<span class="gtile" style="--rc:${d.color}" title="${d.name}"><span class="gi">${d.icon}</span></span>`; }).join('')}</div>
        <div class="loot-txt">Botín nuevo en tu <b>Equipo</b></div>` : ''}
        ${lostLoot && Gear() ? `<div class="loot-txt warn">🎒 Inventario lleno: ${lostLoot} objeto${lostLoot > 1 ? 's' : ''} perdido${lostLoot > 1 ? 's' : ''}. Fusiona o desecha en Equipo</div>` : ''}
        <div class="stats">
          <div><span>Sala</span><b>${room}/${lastRoom()}</b></div>
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
    else if (act === 'later') { if (ready) awakenLater(); }
    else if (act === 'school') { if (ready) pickSchool(el.dataset.id); }
    else if (act === 'altar') { if (ready) pickAltar(el.dataset.id); }
    else if (act === 'reroll') { if (ready && player.rerolls > 0) { player.rerolls--; Sfx.pick(); openLevelUp(pickSource); } }
    else if (act === 'resume') resume();
    else if (act === 'quit') { // dos toques para no perder una partida por accidente
      if (el.dataset.armed && ready) showEnd(false, true);
      else { el.dataset.armed = '1'; el.classList.add('armed'); el.textContent = '¿Seguro? Toca otra vez para abandonar'; lockUntil = now + 400; }
    }
    else if (act === 'shop') { shopFrom = state === 'school' ? 'school' : 'menu'; Sfx.click(); showShop(); lockUntil = now + 350; }
    else if (act === 'buy') { if (ready) buyUpgrade(el.dataset.id); }
    else if (act === 'buyschool') { if (ready) buySchool(el.dataset.id); }
    else if (act === 'stats') { Sfx.click(); showStats(); lockUntil = now + 350; }
    else if (act === 'grimoire') { Sfx.click(); showGrimoire('formas'); lockUntil = now + 350; }
    else if (act === 'grim') { if (ready && el.dataset.tab !== grimTab) { Sfx.click(); showGrimoire(el.dataset.tab); lockUntil = now + 200; } }
    else if (act === 'title') { // lucir (o dejar de lucir) el título de una forma con la Marca II
      if (ready) { const i = +el.dataset.i; meta.grim.t = meta.grim.t === i ? -1 : i; saveMeta(); Sfx.pick(); showGrimoire(); lockUntil = now + 250; }
    }
    else if (act === 'settings') { Sfx.click(); showSettings('menu'); lockUntil = now + 350; }
    else if (act === 'settings-pause') { Sfx.click(); showSettings('pause'); lockUntil = now + 350; }
    else if (act === 'credits') { Sfx.click(); showCredits(state === 'settings' ? 'settings' : 'menu'); lockUntil = now + 350; }
    else if (act === 'toggle') { if (ready) toggleSetting(el.dataset.key); }
    else if (act === 'tset') { if (ready) toggleTile(el.dataset.key); }
    else if (act === 'gear') { Sfx.click(); showGear(); lockUntil = now + 350; }
    else if (act === 'item') { if (ready) { Sfx.click(); showItem(+el.dataset.uid); lockUntil = now + 300; } }
    else if (act === 'gearback') { if (ready) { Sfx.click(); showGear(); lockUntil = now + 300; } }
    else if (['equip', 'unequip', 'merge', 'mergeall'].includes(act)) { if (ready) { gearAction(act, +el.dataset.uid); lockUntil = now + 350; } }
    else if (act === 'salvage') { // dos toques para no tirar un objeto por accidente
      if (el.dataset.armed && ready) { gearAction('salvage', +el.dataset.uid); lockUntil = now + 350; }
      else { el.dataset.armed = '1'; el.classList.add('armed'); el.textContent = '¿Seguro? Toca otra vez'; lockUntil = now + 400; }
    }
    else if (act === 'mute') { if (ready) { Sfx.init(); Sfx.setMuted(!Sfx.muted); syncMute(); Sfx.click(); showSettings(); } }
    else if (act === 'quality') { if (ready) { settings.quality = el.dataset.v; saveSettings(); applySettings(); Sfx.click(); showSettings(); } }
    else if (act === 'tutorial') { if (ready) { settings.tutorial = false; settings.ultTip = false; settings.seenHz = {}; settings.tips = {}; saveSettings(); Sfx.click(); showSettings(); } }
    else if (act === 'reset') {
      if (el.dataset.armed && ready) resetProgress();
      else { el.dataset.armed = '1'; el.classList.add('armed'); el.textContent = '¿Seguro? Se borra todo'; lockUntil = now + 400; }
    }
    else if (act === 'install') {
      if (installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; if (state === 'menu') showMenu(); }); }
    }
    else if (act === 'back') { if (ready) { goBack(); lockUntil = now + 350; } }
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
    get kills() { return kills; }, get shots() { return shots; },
    get chapterId() { return CH.id; }, get hero() { return HEROIC; }, get CH() { return CH; }, get meta() { return meta; }, get lastHit() { return lastHit; }, // chapter(id, hero) cambia de capítulo (?debug)
  };
  if (/[?&]debug\b/.test(location.search)) {
    const rnd0 = Math.random;
    Object.assign(window.__arcano, {
      // avanza la simulación sin depender de requestAnimationFrame (pestañas ocultas, pruebas)
      step(sec, hold = []) {
        hold.forEach(k => keys.add(k));
        for (let t = 0; t < sec; t += 1 / 60) {
          if (state === 'play' || state === 'transition' || state === 'dying') advance(1 / 60); // incluye la transformación y la cámara lenta
          else break;
        }
        hold.forEach(k => keys.delete(k));
        render();
        return state;
      },
      pick(i = 0) { const c = overlay.querySelectorAll('[data-act="pick"],[data-act="school"]:not(.locked),[data-act="altar"]')[i]; if (c) { lockUntil = 0; c.click(); } return state; },
      ult() { player.mana = 100; castUlt(); },
      seen() { return [...seenReactions]; },
      gear() { return JSON.parse(JSON.stringify(meta.gear)); },
      giveGear(base, r) { const it = Gear().makeItem(base, r, meta.gear.next++); meta.gear.inv.push(it); saveMeta(); return it; },
      equip(uid) { const it = gearItem(uid); if (!it) return false; meta.gear.eq[Gear().getBase(it.base).slot] = uid; saveMeta(); return true; },
      unequipAll() { meta.gear.eq = {}; saveMeta(); },
      hazards() { const n = {}; for (const t of hz) if (t) n[t] = (n[t] || 0) + 1; return n; },
      hzCells(t) { const out = []; for (let i = 0; i < hz.length; i++) if (hz[i] === t) out.push({ x: AX + (i % COLS) * CELL + 20, y: AY + ((i / COLS) | 0) * CELL + 20, i }); return out; },
      spike(i) { return spikePhase(i); },
      clear() { for (const e of enemies) e.dead = true; },
      spawn(kind, x, y) { const e = makeEnemy(kind, x, y); e.spawnT = 0; enemies.push(e); return e; }, // enemigo suelto ya activo (pruebas)
      chest() { return chest && { ...chest }; },
      forceChest() { const cells = []; for (let i = 0; i < COLS * ROWS; i++) if (!grid[i]) cells.push({ x: AX + (i % COLS) * CELL + 20, y: AY + ((i / COLS) | 0) * CELL + 20 }); placeChest(cells.filter(p => p.y > AY + 200)); return !!chest; },
      give(id, n = 1) { for (let i = 0; i < n; i++) pickSkill(id); },
      // capítulo y modo de las partidas siguientes (y de la actual, para goto); devuelve el capítulo resuelto
      // (no se guarda en los ajustes y vale aunque el capítulo esté cerrado; chapter() sin forzar = como un jugador)
      chapter(id = 1, hero = false, force = true) { settings.chapter = { id, hero: !!hero }; chForce = !!force; CH = resolveCH(id, !!hero); HEROIC = !!CH.hero; return CH; },
      goto(n, ch = CH.id, hero = HEROIC) { if (ch !== CH.id || !!hero !== HEROIC) dbg.chapter(ch, hero); room = n - 1; nextRoom(); state = 'play'; hideOverlay(); },
      toDoor() { player.x = AX + AW / 2; player.y = AY - 30; },
      god(v = true) { player.god = !!v; player.inv = 0; }, // player.god ya ignora golpes y trampas (sin parpadeo)
      // azar con semilla para pruebas repetibles; seed(null) devuelve el Math.random original
      seed(n) {
        if (n == null) { Math.random = rnd0; return; }
        let a = n | 0;
        Math.random = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; // mulberry32
      },
      // partida nueva con esa escuela (aunque esté bloqueada: solo para esta partida, no se guarda)
      school(id) {
        hideOverlay(); newRun();
        const had = meta.schools;
        if (!had.includes(id)) meta.schools = [...had, id];
        pickSchool(id);
        meta.schools = had;
        return state;
      },
      grim(reset) { if (reset) { meta.grim = META_DEFAULT().grim; saveMeta(); } return meta.grim; },
      // progreso de capítulos: prog() lo lee; prog(objeto | cadena compacta) lo sustituye y lo guarda
      prog(p) {
        if (p != null && Chapters()) { meta.prog = typeof p === 'string' ? Chapters().progUnpack(p) : Chapters().progValid(p); fixChapter(); saveMeta(); }
        return meta.prog;
      },
      runProg() { return runProg; },
      hitStats() { return JSON.parse(JSON.stringify(Object.assign({ lastHit }, hitStat))); }, // golpes de la partida por tipo (src) y lastHit
      settingsChapter() { return Object.assign({}, settings.chapter); },
      ach() { return Object.keys(meta.ach).filter(k => meta.ach[k]); }, // logros conseguidos
      cookie() { return cookieValue(); }, // lo que se guardaría en la cookie ('' = no cabe)
      sfx(name, ...args) { Sfx.init(); Sfx[name](...args); return !!Sfx.ctx; }, // probar un sonido: sfx('awakenBoom', 2, 523)
      // impacto de prueba sobre enemies[i] con esos elementos (o = campos extra del disparo, p. ej. { nofx: true })
      hit(i, els, o) {
        const e = enemies[i];
        if (!e || e.dead) return null;
        shotHit(Object.assign({ x: e.x, y: e.y, vx: 0, vy: -SHOT_SPEED, dmg: player.atk, hit: new Set(), pierce: 0, rico: 0, wall: 0, els }, o), e);
        return { hp: e.hp, dead: e.dead, poisonDps: e.poisonDps, slow: e.slow, frozen: e.frozen, frzImm: e.frzImm, reactCd: e.reactCd };
      },
      sub(n = 1, els = ['ice']) { let k = 0; for (let i = 0; i < n; i++) if (spawnSub(player.x, player.y, -Math.PI / 2 + rand(-0.6, 0.6), player.atk * 0.6, els)) k++; return k; },
      tok, // referencia fija (Object.assign no copia getters)
      flags, // flags.noForms = true: juego sin formas (para comparar); flags.phase2: cartas de forma y Mezclas
      // estado del Despertar de la partida
      formInfo() {
        const p = player, F = FX();
        if (!p) return null;
        return JSON.parse(JSON.stringify({ form: p.form, core: p.core, second: p.second, aff: p.aff, awak: p.awak, anima: p.anima, need: F && p.awak < 2 ? animaNeed(p.awak) : null,
          ready: p.animaReady, lock: p.awkLock, snooze: p.snoozeRoom, tr: p.tr, fusedLv: p.fusedLv, mixes: p.mixes.map(m => m.id), pactRun, atk: p.atk, maxHp: p.maxHp,
          awakenFx: awakenFx && { t: awakenFx.t, el: awakenFx.el, st: awakenFx.st, boom: awakenFx.boom }, eclipseFx: !!eclipseFx, pools: pools.length, net: netLog, ultKey: ultKey(), linaje: linaje() }));
      },
      anima(v) { player.anima = v; player.animaReady = false; gainAnima(0); syncForm(true); return player.animaReady; },
      // despertar en ese elemento: con fx, la cinemática entera (como al elegir la carta); sin fx, al instante
      awaken(el, fx = false) { if (fx) { player.animaReady = true; startAwaken(el); return !!awakenFx; } awaken(el); return player.form; },
      offer() { player.animaReady = true; openLevelUp('awaken'); return state; },
      later() { if (state === 'levelup' && pickSource === 'awaken') awakenLater(); return state; },
      pact() { pactRun = true; player.snoozeRoom = -1; return pactRun; },
      // da la runa y la carta de una Mezcla
      mix(id) {
        const m = Forms() && Forms().MIXES.find(x => x.id === id);
        if (!m) return null;
        for (const k of [m.el, m.card]) { player.sk[k] = Math.max(1, player.sk[k] || 0); if (SKILL_BY_ID[k].el) addAffinity(k); }
        recalc(); refreshMixes();
        return player.mixes.map(x => x.id);
      },
      roll(n = 3) { return rollSkills(n).map(k => k.id); },
      levelup() { pendingLevels = Math.max(1, pendingLevels); openLevelUp('level'); return state; },
      toasts() { return [toast, ...toastQ].filter(Boolean).map(t => t.text + ' | ' + t.sub).concat(banner ? ['BANNER ' + banner.text] : [], bannerNext ? ['NEXT ' + bannerNext.text] : []); },
      // rótulo, posición del aviso (baja si hay logro en pantalla) y Marca II de la forma actual
      ui() { return { banner: banner && { text: banner.text, color: banner.color, crown: banner.crown || null }, toastY: Math.round(toastY), toastLow: toast ? toast.low : null, achBusy, achQ: achQueue.length, achAgain, crown: !!(player && FX() && grimMark2(player.form)) }; },
      ambient() { return { amb: amb.length, ash: ash.length, eclipseFx: !!eclipseFx }; }, // partículas de ambiente de la forma
      achPop(id = 'firstWin') { const a = ACHIEVEMENTS.find(x => x.id === id); if (a) { achQueue.push(a); nextAch(); } return achBusy; }, // enseña el aviso de un logro (sin darlo)
      formStats() { return Forms() ? Object.assign(Forms().stats(), { glowGame: glowCache.size }) : null; },
      // tiempo medio (ms) de update() y de render() en n pasos de 1/60 s (sin requestAnimationFrame)
      perf(n = 600) {
        let tu = 0, tr = 0, mx = 0, k = 0;
        for (; k < n && state === 'play'; k++) {
          const a = performance.now(); update(1 / 60);
          const b = performance.now(); render();
          const c = performance.now(); tu += b - a; tr += c - b; mx = Math.max(mx, b - a);
        }
        k = Math.max(1, k);
        return { steps: k, update: +(tu / k).toFixed(3), updateMax: +mx.toFixed(2), render: +(tr / k).toFixed(3), shots: shots.length, parts: parts.length, enemies: enemies.length };
      },
      // definitivos en curso
      ults() { return { key: player && ultKey(), name: player && ultName(), icon: player && ultIcon(), sing: sing && { kind: sing.kind || 'arcane', t: sing.t, n: sing.n }, curtains: curtains.map(c => ({ x: c.x, d: c.d, t: c.t })), fog: fog && { t: fog.t, atk: fog.atk }, meteors: meteors.map(m => ({ d: m.d || 0, t: m.t, r: m.r, pool: !!m.pool })), pools: pools.length, storm: !!storm }; },
    });

    // ---------- Bots de prueba (sección 7 de docs/despertar-spec.md): partidas enteras sin dibujar, en modo dios ----------
    const dbg = window.__arcano;
    const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
    const med = a => { const v = a.filter(Number.isFinite).sort((x, y) => x - y), m = v.length >> 1; return !v.length ? null : v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
    // nada de lo que pase en una partida de bot se queda: ni esencia, ni logros, ni Grimorio, ni equipo, ni ajustes, ni sonido
    function sandbox(fn) {
      const m0 = JSON.stringify(meta), s0 = JSON.stringify(settings), fr = flags.freeze, nf = flags.noForms, mu = Sfx.muted, gt = Sfx.gate, cs = settings.chapter, cf = chForce;
      // Sfx.gate mira el reloj real y xpFill gasta Math.random si pasa: sin esto la misma semilla da partidas distintas
      quiet = true; flags.freeze = true; Sfx.muted = true; Sfx.gate = () => false;
      try { return fn(); } finally {
        Sfx.gate = gt;
        const m = JSON.parse(m0);
        for (const k of Object.keys(meta)) delete meta[k];
        Object.assign(meta, m, { grim: grimValid(m.grim) });
        Object.assign(settings, JSON.parse(s0));
        quiet = false; flags.freeze = fr; flags.noForms = nf; Sfx.muted = mu;
        dbg.chapter(cs.id, cs.hero, cf);
        Math.random = rnd0;
        showMenu();
      }
    }
    const roundBy = o => { const r = {}; for (const k of Object.keys(o).sort()) r[k] = Math.round(o[k]); return r; };
    const botChapter = cfg => { if (cfg && (cfg.ch != null || cfg.hero != null)) dbg.chapter(cfg.ch || 1, !!cfg.hero); };
    // atascado: sin línea de tiro 1 s (un jugador se movería) o 3 s sin bajar la vida de nadie (quemaduras y venenos
    // también la bajan, así que la línea de tiro se mira aparte) → se planta cerca de su objetivo, con línea de tiro
    function unstick(U, DT) {
      const s = enemies.reduce((a, e) => a + e.hp, 0), t = findTarget();
      U.idle = s < U.hpSum - 0.01 ? 0 : U.idle + DT; U.hpSum = s;
      U.blind = t && !los(player.x, player.y, t.x, t.y) ? U.blind + DT : 0;
      if (U.idle <= 3 && U.blind <= 1) return;
      U.idle = U.blind = 0;
      if (t) { const c = freeCellNear(t.x, t.y, 140); if (los(c.x, c.y, t.x, t.y)) { player.x = c.x; player.y = c.y; } }
    }
    // elección del bot: en el despertar, la ruta (C.path) o la primera opción abierta; en el resto, por prioridades
    const PRIO = ['atk', 'atkspd', 'front', 'multi', 'crit', 'pierce', 'ricochet', 'diag', 'orbs'];
    function botPick(C, L) {
      const p = player, F = FX();
      if (pickSource === 'awaken') {
        L.offers++;
        const all = F ? F.options({ stage: p.awak + 1, aff: p.aff, core: p.core, pact: pactRun }) : [], o = all.filter(x => !x.locked);
        const goal = all.find(x => x.el === C.path[p.awak]);
        if (p.awak >= C.stop || !o.length || (goal && goal.locked)) { awakenLater(); return; } // su ruta pide un Pacto: espera
        const pk = goal || o[0];
        L.awk.push({ st: p.awak + 1, room, el: pk.el });
        pickSkill('awk:' + pk.el);
        return;
      }
      const ids = [...overlay.querySelectorAll('[data-act="pick"]')].map(c => c.dataset.id).filter(id => SKILL_BY_ID[id]);
      if (!ids.length) { L.stuck++; hideOverlay(); state = 'play'; pendingLevels = 0; bonusPicks = []; return; }
      if (F && p.aff.length >= 2) L.badOffer += ids.filter(id => SKILL_BY_ID[id].el && !p.aff.includes(id)).length; // runa cerrada ofrecida
      const lv = id => p.sk[id] || 0, rune = id => !!SKILL_BY_ID[id].el, first = list => list.map(k => ids.find(id => id === k)).find(Boolean);
      const want = C.path.filter(el => el !== SCHOOLS[p.school].el); // el 2º elemento de la ruta (el Arcanista, los dos)
      pickSkill(first(want) || ids.find(id => rune(id) && lv(id) > 0 && lv(id) < 2) || first(PRIO) || ids.find(id => id.startsWith('f_'))
        || first(['hp', 'heal']) || ids.find(id => !rune(id)) || ids[0]);
    }
    // partida entera (síncrona). fresh: jugador que nunca ha despertado (red a); si no, veterano.
    // ult: lanza el definitivo al llenarse (el bot de 7.1 no lo usa, así que va apagado por defecto)
    function sim(cfg) {
      const C = Object.assign({ school: 'fire', path: [], pact: false, stop: 2, noForms: false, maxT: 900, seed: 1, ult: false, fresh: false }, cfg);
      return sandbox(() => {
        botChapter(C);
        dbg.seed(C.seed);
        flags.noForms = !!C.noForms;
        settings.tutorial = true;
        if (C.fresh) meta.grim = META_DEFAULT().grim; else meta.grim.f |= 2;
        dbg.school(C.school);
        player.god = true;
        const L = { roomT: {}, ttk: {}, frz: {}, awk: [], offers: 0, badOffer: 0, maxShots: 0, maxParts: 0, maxAff: 0, ults: 0, stuck: 0, maxBullets: 0 };
        const DT = 1 / 60;
        let clT = 0, bT = 0, fT = 0, rStart = 0, rNow = room;
        const U = { idle: 0, hpSum: 0, blind: 0 };
        for (let i = 0; i < C.maxT * 60; i++) {
          if (state === 'play') {
            advance(DT);
            if (state !== 'play') continue;
            if (room !== rNow) { rNow = room; clT = 0; }
            L.maxShots = Math.max(L.maxShots, shots.length); L.maxParts = Math.max(L.maxParts, parts.length); L.maxBullets = Math.max(L.maxBullets, bullets.length); L.maxAff = Math.max(L.maxAff, player.aff.length);
            if (boss && !boss.dead && boss.spawnT <= 0) { bT += DT; if (boss.frozen > 0) fT += DT; }
            if (cleared && !awakenFx) {
              if (slowT <= 0) clT += DT; // tras un jefe, la cámara lenta no cuenta: da tiempo a la oferta del despertar (0,8 s)
              if (altar && !altar.used) { player.x = altar.x; player.y = altar.y + 12; }
              else if (chest && !chest.opened) { player.x = chest.x; player.y = chest.y + 12; }
              // con "¡DESPERTAR LISTO!" en pantalla un jugador espera a la oferta (0,8 s tras las subidas de nivel): hasta 3 s
              else if (clT > (player.animaReady && player.awak < C.stop && !player.awkLock && player.snoozeRoom !== room ? 3 : 1.6) && room < lastRoom()) { player.x = AX + AW / 2; player.y = AY - 30; }
            } else if (!cleared) {
              clT = 0;
              unstick(U, DT);
              if (C.ult && player.mana >= 100 && !awakenFx && (boss || enemies.length >= 3)) { castUlt(); if (player.mana < 100) L.ults++; }
            }
            if (bT && !boss) { L.ttk[room] = r1(bT); L.frz[room] = r2(fT / bT); bT = fT = 0; }
          } else if (state === 'transition') {
            const r = room;
            advance(DT);
            if (room !== r) { L.roomT[r] = r1(runTime - rStart); rStart = runTime; }
          } else if (state === 'levelup') botPick(C, L);
          else if (state === 'altar') pickAltar(C.pact && !pactRun && player.maxHp >= 80 ? 'pact' : 'bless');
          else break;
        }
        const p = player;
        return Object.assign({ cfg: C, win: state === 'win', time: r1(runTime), room, lvl: p.lvl, form: p.form, core: p.core, second: p.second,
          aff: p.aff.slice(), lock: !!p.awkLock, linaje: linaje(), net: netLog.map(n => n.net) }, L,
          // golpes (en modo dios solo raw: lo que te habría llegado, por tipo)
          { hits: hitStat.hits, dmgTaken: Math.round(hitStat.dmgTaken), rawN: hitStat.rawN, raw: Math.round(hitStat.raw), rawBy: roundBy(hitStat.rawBy), hitsBy: Object.assign({}, hitStat.hitsBy) });
      });
    }
    // resumen de varias semillas de una configuración (medianas)
    function simRow(c, runs) {
      const aw = n => med(runs.map(r => (r.awk.find(a => a.st === n) || {}).room));
      const forms = {};
      for (const r of runs) forms[r.form] = (forms[r.form] || 0) + 1;
      const ttk = {};
      for (const b of CHA().bossRooms(CH)) { const v = med(runs.map(r => r.ttk[b])); ttk[b] = v == null ? null : r1(v); }
      const netP = k => r2(runs.filter(r => r.net.includes(k)).length / runs.length);
      return {
        g: c.g, id: `${c.school}/${c.path.join('+') || '-'}${c.pact ? ' pacto' : ''}`, n: runs.length, win: r2(runs.filter(r => r.win).length / runs.length),
        time: med(runs.map(r => r.time)), aw1: aw(1), aw2: aw(2), netA: netP('a'), netB: netP('b'), netC: netP('c'),
        frz: r2(Math.max(0, ...runs.flatMap(r => Object.values(r.frz)))), ttk, forms,
        // congelación de jefe sin los combates cortos (<8 s: una Ventisca de 1,8 s ya es media pelea) y pesada por tiempo
        frz8: r2(Math.max(0, ...runs.flatMap(r => Object.keys(r.frz).filter(b => r.ttk[b] >= 8).map(b => r.frz[b])))),
        frzW: r2(med(runs.map(r => { const b = Object.keys(r.frz), t = b.reduce((a, k) => a + r.ttk[k], 0); return t ? b.reduce((a, k) => a + r.ttk[k] * r.frz[k], 0) / t : 0; }))), locks: runs.filter(r => r.lock).length, linaje: runs.filter(r => r.linaje).length,
        badOffer: runs.reduce((a, r) => a + r.badOffer, 0), maxAff: Math.max(...runs.map(r => r.maxAff)), maxShots: Math.max(...runs.map(r => r.maxShots)),
        maxParts: Math.max(...runs.map(r => r.maxParts)), stuck: runs.reduce((a, r) => a + r.stuck, 0), ults: med(runs.map(r => r.ults)),
      };
    }
    // objetivos de 7.2 contra las medianas de la matriz
    function simChecks(rows) {
      const out = [], chk = (name, ok, val) => out.push({ name, ok: !!ok, val });
      const fr = rows.filter(r => r.g !== 'base'), base = rows.filter(r => r.g === 'base'), fin = rows.filter(r => r.g === 'hibrida' || r.g === 'eclipse');
      const avg = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
      const mF = avg(fr.map(r => r.time)), mB = avg(base.map(r => r.time)), mFin = avg(fin.map(r => r.time));
      chk('victorias 100%', rows.every(r => r.win === 1), rows.filter(r => r.win < 1).map(r => r.id + ' ' + r.win));
      chk('tiempo con formas 4:00-6:00', fr.every(r => r.time >= 240 && r.time <= 360), fr.map(r => `${r.id} ${fmtTime(r.time)}`));
      chk('ninguna forma final >25% más rápida', !mFin || fin.every(r => r.time >= 0.8 * mFin), mFin && fin.map(r => `${r.id} ${r2(r.time / mFin)}`));
      chk('formas/base 0,80-1,00', mF && mB && mF / mB >= 0.8 && mF / mB <= 1, mF && mB && r2(mF / mB));
      const a1 = fr.filter(r => r.aw1 != null), a2 = fr.filter(r => r.aw2 != null);
      chk('1er despertar en sala 5-7', a1.every(r => r.aw1 >= 5 && r.aw1 <= 7), a1.map(r => `${r.id} ${r.aw1}`));
      chk('2º despertar en sala 11-14', a2.every(r => r.aw2 >= 11 && r.aw2 <= 14), a2.map(r => `${r.id} ${r.aw2}`));
      chk('red (b) <= 15%', avg(fr.map(r => r.netB)) <= 0.15, r2(avg(fr.map(r => r.netB))));
      chk('red (c) <= 20%', avg(fr.map(r => r.netC)) <= 0.2, r2(avg(fr.map(r => r.netC))));
      chk('congelación del jefe <= 35%', rows.every(r => r.frz <= 0.35), rows.filter(r => r.frz > 0.35).map(r => r.id + ' ' + r.frz));
      chk('congelación del jefe <= 35% (combates de 8 s o más)', rows.every(r => r.frz8 <= 0.35), rows.filter(r => r.frz8 > 0.35).map(r => r.id + ' ' + r.frz8));
      chk('badOffer 0 y Afinidad <= 2', fr.every(r => !r.badOffer && r.maxAff <= 2), fr.filter(r => r.badOffer || r.maxAff > 2).map(r => r.id));
      chk('maxShots <= 200', rows.every(r => r.maxShots <= 200), Math.max(...rows.map(r => r.maxShots)));
      chk('maxParts <= 500', rows.every(r => r.maxParts <= 500), Math.max(...rows.map(r => r.maxParts)));
      const op = rows.find(r => r.g === 'opuesto');
      if (op) chk('opuesto sin pacto: se queda en Ígnea', op.forms.ignea === op.n, { formas: op.forms, bloqueadas: op.locks });
      return out;
    }
    // matriz de 7.2 (asíncrona: cede entre partidas). only: grupos a correr ('base', 'pura', 'hibrida', 'eclipse', 'opuesto', 'arcanista', 'traicion')
    async function simMatrix(opts) {
      const O = Object.assign({ seeds: 8, only: null, maxT: 900, log: false, ult: false }, opts);
      // "Traición" (7.2 pide fire/[bolt,ice]): con la escuela fijando aff[0] el Piromante no puede llegar a Aurora,
      // así que se prueba fire/[bolt,fire]: Voltaica sin Linaje y luego Plasma
      const CFG = [
        ...['fire', 'ice', 'bolt', 'poison', 'arcane'].map(s => ({ g: 'base', school: s, path: [], noForms: true })),
        ...ELEMENTS.map(s => ({ g: 'pura', school: s, path: [s], stop: 1 })),
        ...[['fire', 'bolt'], ['bolt', 'fire'], ['bolt', 'ice'], ['ice', 'bolt'], ['ice', 'poison'], ['poison', 'ice'], ['poison', 'fire'], ['fire', 'poison']]
          .map(([a, b]) => ({ g: 'hibrida', school: a, path: [a, b] })),
        ...[['fire', 'ice'], ['ice', 'fire'], ['bolt', 'poison'], ['poison', 'bolt']].map(([a, b]) => ({ g: 'eclipse', school: a, path: [a, b], pact: true })),
        { g: 'opuesto', school: 'fire', path: ['fire', 'ice'], pact: false },
        { g: 'arcanista', school: 'arcane', path: ['fire', 'bolt'] }, { g: 'arcanista', school: 'arcane', path: ['ice', 'poison'] },
        { g: 'traicion', school: 'fire', path: ['bolt', 'fire'] },
      ].filter(c => !O.only || O.only.includes(c.g));
      const rows = [], t0 = performance.now();
      for (const c of CFG) {
        const runs = [];
        for (let s = 1; s <= O.seeds; s++) {
          runs.push(sim(Object.assign({}, c, { seed: s, maxT: O.maxT, ult: O.ult })));
          await new Promise(r => setTimeout(r, 0));
        }
        rows.push(simRow(c, runs));
        if (O.log) console.log(JSON.stringify(rows[rows.length - 1]));
      }
      return { secs: r1((performance.now() - t0) / 1000), rows, checks: simChecks(rows) };
    }
    // banco de jefes (7.3): build media, despertares al instante y el mago quieto en el inicio de la sala del jefe
    function bench(cfg) {
      const C = Object.assign({ room: 15, school: 'fire', path: [], build: 'mid', secs: 90, seed: 1, noForms: false, pact: false }, cfg);
      return sandbox(() => {
        botChapter(C);
        if (!bossAt(C.room)) C.room = lastRoom(); // en otro capítulo, por defecto su jefe final
        dbg.seed(C.seed);
        flags.noForms = !!C.noForms;
        settings.tutorial = true;
        dbg.school(C.school);
        player.god = true;
        const S = SCHOOLS[C.school], runes = C.path.length ? C.path : S.el ? [S.el] : [];
        const B = C.build === 'mid' ? { atk: 3, atkspd: 2, front: 1, multi: 1, crit: 1, hp: 2 } : {};
        for (const [k, n] of Object.entries(B)) for (let i = 0; i < n; i++) pickSkill(k);
        for (const el of runes) while ((player.sk[el] || 0) < 2) pickSkill(el);
        if (C.pact) pactRun = true;
        if (FX()) for (const el of C.path.slice(0, 2)) awaken(el);
        pendingLevels = 0; bonusPicks = [];
        dbg.goto(C.room);
        const L = { offers: 0, badOffer: 0, awk: [], stuck: 0 }, P = Object.assign({}, C, { stop: player.awak }), DT = 1 / 60;
        const x0 = player.x, y0 = player.y;
        let bT = 0, fT = 0, killed = false;
        for (let i = 0; i < (C.secs + 30) * 60 && !killed && bT < C.secs; i++) {
          if (state === 'play') {
            advance(DT);
            player.x = x0; player.y = y0; // quieto en el inicio
            if (boss && !boss.dead && boss.spawnT <= 0) { bT += DT; if (boss.frozen > 0) fT += DT; }
            if (bT > 0 && (!boss || boss.dead)) killed = true;
          } else if (state === 'levelup') botPick(P, L);
          else if (state === 'transition' || state === 'dying') advance(DT);
          else break;
        }
        return { cfg: C, ttk: r1(bT), killed, frz: bT ? r2(fT / bT) : 0, form: player.form, atk: r1(player.atk), linaje: linaje() };
      });
    }
    // banco de salas normales: misma build fija (como bench), despertares al instante y se mide lo que tarda en limpiar
    // cada sala (sin subir de nivel: la build no cambia). Aísla lo que aportan los rasgos de la forma fuera de los jefes.
    function roomBench(cfg) {
      const C = Object.assign({ rooms: [7, 8, 11, 12, 13, 16, 17, 18], school: 'fire', path: [], build: 'mid', seed: 1, noForms: false, pact: false, maxT: 60 }, cfg);
      return sandbox(() => {
        botChapter(C);
        // en otro capítulo, sus salas normales pasado el primer 30 % (en el C1: 7, 8, 11, 12, 13, 16, 17 y 18)
        if (!(cfg && cfg.rooms) && CH.id !== 1) C.rooms = Array.from({ length: lastRoom() }, (_, i) => i + 1).filter(r => r > lastRoom() * 0.3 && !bossAt(r) && !altarAt(r));
        dbg.seed(C.seed);
        flags.noForms = !!C.noForms;
        settings.tutorial = true;
        dbg.school(C.school);
        player.god = true;
        const S = SCHOOLS[C.school], runes = C.path.length ? C.path : S.el ? [S.el] : [];
        const B = C.build === 'mid' ? { atk: 3, atkspd: 2, front: 1, multi: 1, crit: 1, hp: 2 } : {};
        for (const [k, n] of Object.entries(B)) for (let i = 0; i < n; i++) pickSkill(k);
        for (const el of runes) while ((player.sk[el] || 0) < 2) pickSkill(el);
        if (C.pact) pactRun = true;
        if (FX()) for (const el of C.path.slice(0, 2)) awaken(el);
        const DT = 1 / 60, T = {};
        let tot = 0;
        for (const r of C.rooms) {
          pendingLevels = 0; bonusPicks = [];
          dbg.goto(r);
          let t = 0;
          const U = { idle: 0, hpSum: 0, blind: 0 };
          for (let i = 0; i < C.maxT * 60; i++) {
            if (state === 'levelup') { hideOverlay(); state = 'play'; pendingLevels = 0; bonusPicks = []; }
            if (state !== 'play') break;
            advance(DT); t += DT;
            if (cleared) break;
            unstick(U, DT);
          }
          T[r] = r1(t); tot += t;
        }
        return { cfg: C, rooms: T, total: r1(tot), form: player.form, atk: r1(player.atk) };
      });
    }
    Object.assign(window.__arcano, { sim, simMatrix, bench, botPick, roomBench });
  }

  if (Sfx.muted) { settings.musicVol = settings.music || SETTINGS_DEFAULT.music; settings.sfxVol = settings.sfx || SETTINGS_DEFAULT.sfx; settings.music = 0; settings.sfx = 0; saveSettings(); Sfx.setMuted(false); }
  applySettings();
  if (/[?&]debug\b/.test(location.search)) showMenu(); else showSplash();
  requestAnimationFrame(frame);
})();
