'use strict';
// ================================================================
//  Arcano · música procedural (Web Audio, sin samples ni archivos)
//  Doublelag Games
//
//  API (window.ArcanoMusic):
//    attach(ctx, out)  usa el AudioContext del juego; la salida va a `out`
//    play(pista)       'menu' | 'dungeon' | 'boss' | 'victory' | 'defeat' | null
//    setIntensity(x)   0..1: en la mazmorra añade percusión y arpegio
//    stop()            silencio inmediato
//    current           pista que suena (o null)
// ================================================================
(function () {
  // ================================================================
  //  Constantes
  // ================================================================
  const LOOKAHEAD = 0.1;   // s que se programan por delante
  const TICK_MS = 25;      // periodo del planificador
  const FADE = 1;          // fundido cruzado entre pistas (s)
  const MAX_SRC = 44;      // fuentes simultáneas como máximo (osciladores + ruido)
  const LATE_SKIP = 0.3;   // atraso a partir del cual se salta al presente
  const MASTER = 0.3;      // nivel general: la música va por debajo de los efectos
  const EPS = 0.0001;      // suelo para rampas exponenciales
  const DET = [0.99654, 1.00347];   // ±6 cents para los pads
  const KICK_GAIN = 0.4;             // peso del bombo en la mezcla

  // ================================================================
  //  Utilidades
  // ================================================================
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const sstep = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  const disc = n => { try { if (n) n.disconnect(); } catch (_) {} };
  const isHidden = () => { try { return typeof document !== 'undefined' && !!document.hidden; } catch (_) { return false; } };
  const pickR = (R, arr) => arr[Math.floor(R() * arr.length)];
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  // Pseudoaleatorio con semilla (mulberry32): variaciones reproducibles por pasada
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ================================================================
  //  Estado
  // ================================================================
  let ctx = null, out = null, master = null, tail = null, nbuf = null;
  let timer = null, players = [], voices = [], nsrc = 0;
  let inten = 0, intenS = 0, lastNow = 0;

  // ================================================================
  //  Voces (cada nota crea sus nodos y los suelta al acabar)
  // ================================================================
  // Envuelve un instrumento: si algo falla se pierde esa nota y nada más
  const safe = fn => function () { try { fn.apply(null, arguments); } catch (_) {} };
  // ¿Cabe otra nota? prio 2 = esencial (pad, bajo, bombo), 1 = normal, 0 = adorno
  function room(n, prio) {
    const cap = prio >= 2 ? MAX_SRC : prio === 1 ? MAX_SRC * 0.8 : MAX_SRC * 0.6;
    return nsrc + n <= cap;
  }
  // Arranca las fuentes, las registra y desconecta todos los nodos al terminar
  function launch(p, srcs, nodes, t, end, off) {
    for (const s of srcs) { if (off != null) s.start(t, off); else s.start(t); s.stop(end); }
    srcs[srcs.length - 1].onended = () => { for (const s of srcs) disc(s); for (const n of nodes) disc(n); };
    voices.push({ p, srcs, end });
    nsrc += srcs.length;
  }
  function prune(now) {
    let k = 0;
    nsrc = 0;
    for (const v of voices) if (v.end > now) { voices[k++] = v; nsrc += v.srcs.length; }
    voices.length = k;
  }
  function route(p, g, send) { g.connect(p.bus); if (send && p.send) g.connect(p.send); }
  // Amplificador de envolvente que parte de 0: si no, la primera muestra (arranque a mitad de muestra) sale a volumen 1 y chasca
  function envGain() { const g = ctx.createGain(); g.gain.value = 0; return g; }

  // Voz genérica: oscilador → paso bajo (envolvente opcional) → amplificador
  const syn = safe(function (p, t, m, o, v, h) {
    const vol = v != null ? v : o.vol;
    if (!(vol > 0.001) || !room(1, o.prio == null ? 1 : o.prio)) return;
    const att = o.att || 0.005, hold = Math.max(0, h != null ? h : o.hold || 0), rel = o.rel || 0.2, cut = o.cut || 2000;
    const end = t + att + hold + rel;
    const os = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = envGain();
    os.type = o.type || 'triangle';
    os.frequency.setValueAtTime(mtof(m), t);
    f.type = 'lowpass';
    f.Q.setValueAtTime(o.q || 0.7, t);
    if (o.fenv) {
      f.frequency.setValueAtTime(cut * o.fenv, t);
      f.frequency.exponentialRampToValueAtTime(cut, t + att + Math.min(0.3, hold + rel * 0.5));
    } else f.frequency.setValueAtTime(cut, t);
    g.gain.setValueAtTime(EPS, t);
    g.gain.linearRampToValueAtTime(vol, t + att);
    if (hold > 0) g.gain.linearRampToValueAtTime(Math.max(EPS, vol * (o.sus || 1)), t + att + hold);
    g.gain.exponentialRampToValueAtTime(EPS, end);
    os.connect(f); f.connect(g); route(p, g, o.send);
    launch(p, [os], [f, g], t, end + 0.02);
  });

  // Pad: pares de sierras desafinadas por un paso bajo con barrido lento
  const pad = safe(function (p, t, notes, dur, o) {
    if (!room(notes.length * 2, 2)) return;
    const att = o.att, rel = o.rel, vol = o.vol, cut = o.cut, hold = Math.max(att, dur), end = t + hold + rel;
    const f = ctx.createBiquadFilter(), g = envGain(), srcs = [];
    f.type = 'lowpass';
    f.Q.setValueAtTime(0.5, t);
    f.frequency.setValueAtTime(cut * 0.55, t);
    f.frequency.linearRampToValueAtTime(cut, t + hold * 0.6 + 0.01);
    f.frequency.linearRampToValueAtTime(cut * 0.7, end);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + att);
    g.gain.setValueAtTime(vol, t + hold);
    g.gain.linearRampToValueAtTime(0, end);
    for (const m of notes) {
      const fr = mtof(m);
      for (const d of DET) {
        const os = ctx.createOscillator();
        os.type = o.type || 'sawtooth';
        os.frequency.setValueAtTime(fr * d, t);
        os.connect(f);
        srcs.push(os);
      }
    }
    f.connect(g); route(p, g, o.send);
    launch(p, srcs, [f, g], t, end + 0.02);
  });

  // Bordón: seno grave + triángulo una octava arriba (para que se oiga en el móvil)
  const drone = safe(function (p, t, m, dur, vol, rel, att) {
    att = att || Math.min(1.2, dur * 0.4);
    const hold = Math.max(0, dur - att);
    syn(p, t, m, { type: 'sine', att, hold, rel, vol, cut: 500, prio: 2 });
    syn(p, t, m + 12, { type: 'triangle', att, hold, rel, vol: vol * 0.4, cut: 700, prio: 1 });
  });

  // Campanita FM: moduladora inarmónica que se apaga rápido → ataque metálico y cola limpia
  const bell = safe(function (p, t, m, vol, o) {
    if (!(vol > 0.001) || !room(2, 0)) return;
    const fr = mtof(m), dec = o.dec || 2, ratio = o.ratio || 3.5, idx = o.idx || 1;
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = envGain();
    car.type = 'sine'; mod.type = 'sine';
    car.frequency.setValueAtTime(fr, t);
    mod.frequency.setValueAtTime(fr * ratio, t);
    mg.gain.setValueAtTime(fr * idx, t);
    mg.gain.exponentialRampToValueAtTime(fr * 0.02, t + dec * 0.4);
    g.gain.setValueAtTime(EPS, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(EPS, t + dec);
    mod.connect(mg); mg.connect(car.frequency); car.connect(g); route(p, g, true);
    launch(p, [mod, car], [mg, g], t, t + dec + 0.02);
  });

  // Bombo: seno con caída de tono (atenuado: el grave apenas se oye en el móvil y se come el margen)
  const kick = safe(function (p, t, vol, o) {
    vol *= KICK_GAIN;
    if (!(vol > 0.01) || !room(1, 2)) return;
    o = o || {};
    const dec = o.dec || 0.24;
    const os = ctx.createOscillator(), g = envGain();
    os.type = 'sine';
    os.frequency.setValueAtTime(o.f0 || 150, t);
    os.frequency.exponentialRampToValueAtTime(o.f1 || 55, t + 0.08);
    g.gain.setValueAtTime(EPS, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(EPS, t + dec);
    os.connect(g); route(p, g, false);
    launch(p, [os], [g], t, t + dec + 0.02);
  });

  // Ruido blanco compartido (1 s), se crea una sola vez por contexto
  function noiseBuf() {
    if (nbuf) return nbuf;
    const sr = ctx.sampleRate || 44100, len = Math.floor(sr);
    const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return (nbuf = b);
  }
  // Golpe de ruido filtrado (charles, caja, platillo)
  const hit = safe(function (p, t, vol, o) {
    if (!(vol > 0.002) || !room(1, o.prio == null ? 0 : o.prio)) return;
    const b = noiseBuf(), dec = o.dec || 0.04;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = envGain();
    s.buffer = b; s.loop = true;
    f.type = o.ft || 'highpass';
    f.frequency.setValueAtTime(o.f || 7000, t);
    f.Q.setValueAtTime(o.q || 0.7, t);
    g.gain.setValueAtTime(EPS, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.002);
    g.gain.exponentialRampToValueAtTime(EPS, t + 0.002 + dec);
    s.connect(f); f.connect(g); route(p, g, o.send);
    launch(p, [s], [f, g], t, t + dec + 0.03, Math.random() * 0.5);
  });
  const HAT_C = { f: 7500, dec: 0.035 }, HAT_O = { f: 7000, dec: 0.16 };
  const SNR = { ft: 'bandpass', f: 1800, q: 0.8, dec: 0.13, prio: 1 };
  const SNR_B = { type: 'triangle', att: 0.002, rel: 0.08, cut: 1200, prio: 0 };
  const hat = (p, t, vol, open) => hit(p, t, vol, open ? HAT_O : HAT_C);
  function snare(p, t, vol) {
    hit(p, t, vol, SNR);
    syn(p, t, 54, SNR_B, vol * 0.6);   // cuerpo de la caja (~185 Hz)
  }
  const crash = (p, t, vol) => hit(p, t, vol, { f: 5000, dec: 1.6, send: true, prio: 1 });

  // ================================================================
  //  Armonía y forma
  // ================================================================
  // Acorde: raíz del bajo, voces del pad, notas de arpegio y de campanitas (MIDI)
  function ch(r, pad, tones) {
    const arp = pad.map(n => n + 12).concat(pad[0] + 24);
    return { r, pad, arp, tones: tones || arp.concat(pad[1] + 24) };
  }
  // Encadena secciones según la forma y precalcula dónde cambia el acorde
  function song(sections, form) {
    const bars = [], sec = [], sb = [], fi = [];
    form.forEach((id, k) => sections[id].forEach((c, j) => { bars.push(c); sec.push(id); sb.push(j); fi.push(k); }));
    const L = bars.length, starts = [], left = new Array(L);
    for (let i = 0; i < L; i++) starts.push(i === 0 || bars[i] !== bars[i - 1]);
    for (let i = L - 1; i >= 0; i--) left[i] = i < L - 1 && !starts[i + 1] ? left[i + 1] + 1 : 1;
    return { bars, sec, sb, fi, starts, left, L };
  }
  // Posición musical de un paso (semicorchea)
  function where(S, st) {
    const bar = Math.floor(st / 16), i = bar % S.L;
    return { s: st % 16, bar, i, pass: Math.floor(bar / S.L), c: S.bars[i], sec: S.sec[i], sb: S.sb[i], fi: S.fi[i] };
  }
  // Duración del pad si toca lanzarlo (cambio de acorde o al retomar tras un salto); 0 si no
  function padDur(p, S, w) {
    // tras un salto solo se relanza si el pad anterior ya no cubre este punto (si no, sonaría doble)
    if (!((w.s === 0 && S.starts[w.i]) || (p.fresh && p.next >= p.padEnd - 0.01))) return 0;
    const d = S.left[w.i] * p.sd * 16 - w.s * p.sd;
    p.padEnd = p.next + d;
    return d;
  }
  const STEPS = [-2, -1, -1, 1, 1, 2];
  // Campanitas de un compás: n corcheas al azar con paseo por las notas del acorde
  function bellPlan(R, p, tones, n) {
    const slots = [0, 2, 4, 6, 8, 10, 12, 14], res = {};
    for (let k = slots.length - 1; k > 0; k--) { const j = Math.floor(R() * (k + 1)), x = slots[k]; slots[k] = slots[j]; slots[j] = x; }
    const pos = slots.slice(0, n).sort((a, b) => a - b);
    let idx = Math.min(tones.length - 1, p.bIdx);
    for (const s of pos) {
      idx = Math.max(0, Math.min(tones.length - 1, idx + pickR(R, STEPS)));
      res[s] = [tones[idx], 0.75 + R() * 0.25];
    }
    p.bIdx = idx;
    return res;
  }
  // Melodía de un compás: ritmo de una plantilla y paseo por la escala → { paso: [nota, pasos] }
  function melodyPlan(R, p, pool, rhythms) {
    const r = pickR(R, rhythms), res = {};
    let idx = Math.min(pool.length - 1, p.mIdx);
    for (let k = 0; k < r.length; k++) {
      idx = Math.max(0, Math.min(pool.length - 1, idx + pickR(R, STEPS)));
      res[r[k]] = [pool[idx], (k + 1 < r.length ? r[k + 1] : 16) - r[k]];
    }
    p.mIdx = idx;
    return res;
  }

  // ================================================================
  //  Menú · Re dórico con préstamos eólicos, 64 BPM, 32 compases
  // ================================================================
  const mDm9 = ch(38, [53, 57, 64], [69, 72, 74, 76, 77, 81]);
  const mG = ch(38, [55, 59, 62], [67, 71, 74, 79, 81, 83]);   // IV mayor (color dórico) sobre pedal de Re
  const mF = ch(41, [57, 60, 64], [69, 72, 76, 77, 79, 84]);
  const mC = ch(36, [55, 62, 64], [67, 72, 74, 76, 79, 84]);
  const mBb = ch(34, [57, 62, 65], [69, 70, 74, 77, 81, 82]);
  const mAm = ch(45, [55, 60, 64], [69, 72, 76, 79, 81, 84]);
  const mGm = ch(43, [53, 58, 62], [67, 70, 74, 77, 79, 82]);
  const mEm = ch(40, [55, 59, 62], [67, 71, 74, 76, 79, 83]);
  const mAs = ch(45, [57, 62, 64], [69, 74, 76, 81, 86]);      // La sus4: pide volver a Re
  const MENU_S = song([
    [mDm9, mDm9, mG, mG, mF, mF, mC, mC, mBb, mBb, mAm, mAm, mGm, mGm, mAs, mAs],
    [mDm9, mDm9, mC, mC, mBb, mBb, mF, mF, mG, mG, mEm, mEm, mF, mF, mAs, mAs],
  ], [0, 1]);
  const FLUTE_R = [[0, 8], [0], [0, 12], [4, 12], [0, 6, 8]];
  const BELL_M = { ratio: 3.5, idx: 1, dec: 2.6 };
  const SPARK = { ratio: 4, idx: 0.5, dec: 1.2 };
  const FLUTE = { type: 'triangle', att: 0.25, rel: 0.9, vol: 0.034, sus: 0.8, cut: 1600, send: true, prio: 1 };

  function menuStep(p, st, t) {
    const S = MENU_S, w = where(S, st), c = w.c, s = w.s;
    const d = padDur(p, S, w);
    if (d > 0) {
      pad(p, t, c.pad, d, { att: Math.min(1.6, d * 0.5), rel: 2.4, vol: 0.02, cut: 1250, send: true });
      drone(p, t, c.r, d, 0.07, 2.2);
    }
    // planes del compás: la semilla rota cada 4 pasadas (8 min) para que no se repita igual
    if (p.planBar !== w.bar) {
      p.planBar = w.bar;
      const R = rng(w.i * 131 + (w.pass % 4) * 7919 + 11);
      const flute = w.bar >= 8 && (w.pass + (w.i >= 16 ? 1 : 0)) % 2 === 1;
      p.plan = R() < (flute ? 0.5 : 0.22) ? null : bellPlan(R, p, c.tones, flute ? 1 : 2 + Math.floor(R() * 3));
      p.lplan = flute ? melodyPlan(R, p, c.tones.slice(0, 5), FLUTE_R) : null;
    }
    if (p.plan) { const b = p.plan[s]; if (b) bell(p, t, b[0], 0.06 * b[1], BELL_M); }
    // destellos al cerrar algunas frases de 8 compases
    if (w.i % 8 === 7 && s >= 12 && (w.pass + (w.i >> 3)) % 2 === 0) {
      bell(p, t, c.tones[Math.min(c.tones.length - 1, s - 11)] + 12, 0.022, SPARK);
    }
    // flauta lenta (alterna mitades de la canción en cada pasada)
    if (p.lplan) { const n = p.lplan[s]; if (n) syn(p, t, n[0], FLUTE, null, n[1] * p.sd - 0.35); }
  }

  // ================================================================
  //  Mazmorra · La menor, 104 BPM, 48 compases
  // ================================================================
  const dAm = ch(45, [57, 60, 64]), dF = ch(41, [57, 60, 65]), dC = ch(48, [55, 60, 64]);
  const dG = ch(43, [55, 59, 62]), dEm = ch(40, [55, 59, 64]), dDm = ch(38, [57, 62, 65]);
  const dD = ch(38, [57, 62, 66]), dE = ch(40, [56, 59, 64]), dEs = ch(40, [57, 59, 64]);
  dD.scale = dD.tones; dE.scale = dE.tones;   // Fa# y Sol#: la melodía usa sus notas, no la pentatónica
  const DUN_S = song([
    [dAm, dAm, dF, dF, dG, dG, dEm, dEm],
    [dAm, dF, dC, dG, dAm, dF, dDm, dE],
    [dF, dG, dAm, dAm, dF, dG, dEs, dE],
    [dAm, dC, dD, dF, dAm, dG, dF, dE],
  ], [0, 1, 0, 2, 1, 3]);
  // Bajo: 0 silencio, 1 raíz, 2 octava, 5 quinta
  const BASS_D = [
    [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],   // corcheas
    [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],   // 3-3-2
    [1, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 5, 0, 2, 0],   // con octava y quinta
    [1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 2, 0, 1, 0],   // sincopado
  ];
  const BASS_SEL = [[0, 2], [1, 1], [3, 1], [2, 0]];   // patrón por sección y pasada
  const ARP_P = [
    [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 2, 3, 2, 1],
    [0, 2, 1, 3, 0, 2, 1, 3, 1, 3, 2, 3, 0, 2, 1, 2],
    [3, 2, 1, 0, 1, 2, 3, 2, 3, 2, 1, 0, 1, 0, 1, 2],
    [0, 0, 2, 1, 3, 1, 2, 1, 0, 0, 2, 1, 3, 2, 1, 2],
  ];
  const LEAD_R = [[0, 6, 8, 12], [0, 4, 10], [0, 3, 6, 8, 14], [0, 8], [2, 4, 8]];
  const PENTA_A = [64, 67, 69, 72, 74, 76, 79, 81];
  const BASS_V = { type: 'sawtooth', att: 0.004, hold: 0.07, rel: 0.16, cut: 280, fenv: 3.2, q: 2.2, prio: 2 };
  const ARP_V = { type: 'square', att: 0.003, rel: 0.18, cut: 1500, fenv: 2.5, q: 1, send: true, prio: 0 };
  const OCA = { type: 'triangle', att: 0.05, rel: 0.35, cut: 2200, sus: 0.75, vol: 0.045, send: true, prio: 1 };
  const BELL_D = { ratio: 2, idx: 0.9, dec: 1.5 };

  function dungeonStep(p, st, t) {
    const S = DUN_S, w = where(S, st), c = w.c, s = w.s, sec = w.sec, sb = w.sb;
    const I = intenS, L1 = sstep(0.08, 0.45, I), L2 = sstep(0.3, 0.7, I), L3 = sstep(0.6, 0.95, I);
    const d = padDur(p, S, w);
    if (d > 0) pad(p, t, c.pad, d, { att: 0.3, rel: 0.9, vol: 0.016, cut: 800 + 500 * I });
    // planes del compás: campanitas en las secciones 1-2, melodía en la 3-4
    if (p.planBar !== w.bar) {
      p.planBar = w.bar;
      const R = rng(w.i * 97 + (w.pass % 3) * 7919 + 5), lead = sec >= 2;
      p.plan = lead || R() < 0.35 ? null : bellPlan(R, p, c.tones, 1 + Math.floor(R() * 3));
      p.lplan = lead && R() < 0.85 ? melodyPlan(R, p, c.scale || PENTA_A, LEAD_R) : null;
    }
    // bajo: el pulso de la mazmorra
    const bv = BASS_D[BASS_SEL[sec][(w.pass + (w.fi > 2 ? 1 : 0)) % 2]][s];
    if (bv) syn(p, t, c.r + (bv === 2 ? 12 : bv === 5 ? 7 : 0), BASS_V, (s === 0 ? 0.12 : 0.095) + 0.02 * I);
    // bombo: latido suave en calma, más presente con enemigos
    let k = 0;
    if (s === 0) k = 0.3 + 0.4 * L1;
    else if (s === (sec === 2 ? 10 : 8)) k = 0.2 + 0.42 * L1;
    else if (s === 14 && (sb & 1)) k = 0.38 * L3;
    if (k) kick(p, t, k);
    // charles: contratiempos → corcheas → semicorcheas según la intensidad
    if (s === 14 && (sb & 1) && L3 > 0.05) hat(p, t, 0.03 * L3, true);
    else if (s % 4 === 2) hat(p, t, 0.032 * L1);
    else if (s % 4 === 0) hat(p, t, 0.016 * L2);
    else hat(p, t, 0.011 * L3);
    // caja: redoble al cerrar sección y contratiempo con intensidad alta
    if (sb === 7 && s >= 12 && L1 > 0.25) snare(p, t, (0.035 + 0.012 * (s - 12)) * L1);
    else if (s === 4 || s === 12) snare(p, t, 0.085 * L3);
    // arpegio: corcheas y, más arriba, semicorcheas
    if (L2 > 0.01) {
      const pat = ARP_P[(w.fi + w.pass) % ARP_P.length];
      syn(p, t, c.arp[pat[s]], ARP_V, s % 2 === 0 ? 0.03 * L2 : 0.021 * sstep(0.55, 0.9, I));
    }
    // campanitas cuando hay calma
    if (p.plan && L2 < 0.95) { const b = p.plan[s]; if (b) bell(p, t, b[0], 0.045 * b[1] * (1 - L2), BELL_D); }
    // ocarina
    if (p.lplan) { const n = p.lplan[s]; if (n) syn(p, t, n[0], OCA, null, n[1] * p.sd - 0.12); }
  }

  // ================================================================
  //  Jefe · Re menor armónica, 132 BPM, 48 compases
  // ================================================================
  const bDm = ch(38, [57, 62, 65]), bBb = ch(34, [58, 62, 65]), bGm = ch(43, [58, 62, 67]);
  const bA = ch(45, [57, 61, 64]), bA7 = ch(45, [55, 61, 64]);
  const bCd = ch(37, [58, 61, 64]), bEd = ch(40, [55, 58, 64]);   // Do#dis7 y Mi disminuido
  const BOSS_S = song([
    [bDm, bDm, bBb, bBb, bGm, bGm, bA, bA],
    [bDm, bCd, bDm, bBb, bGm, bEd, bA, bA7],
    [bBb, bA, bBb, bA, bGm, bA, bBb, bA],      // tensión a medio tiempo
    [bDm, bDm, bGm, bGm, bBb, bEd, bA, bA7],   // tema principal
  ], [0, 1, 0, 2, 1, 3]);
  // Melodías: por compás, [paso, nota, duración en pasos]
  const LEAD_B3 = [
    [[0, 77, 8], [8, 82, 8]], [[0, 81, 8], [8, 85, 8]], [[0, 86, 8], [8, 82, 8]], [[0, 85, 16]],
    [[0, 82, 8], [8, 79, 8]], [[0, 81, 8], [8, 76, 8]], [[0, 77, 8], [8, 74, 8]], [[0, 73, 16]],
  ];
  const LEAD_B4 = [
    [[0, 74, 3], [3, 76, 1], [4, 77, 4], [8, 81, 6], [14, 82, 2]],
    [[0, 81, 4], [4, 77, 2], [6, 76, 2], [8, 74, 8]],
    [[0, 79, 3], [3, 81, 1], [4, 82, 4], [8, 86, 6], [14, 85, 2]],
    [[0, 86, 4], [4, 82, 2], [6, 81, 2], [8, 79, 8]],
    [[0, 77, 4], [4, 81, 4], [8, 82, 4], [12, 81, 4]],
    [[0, 79, 4], [4, 76, 4], [8, 82, 4], [12, 79, 4]],
    [[0, 81, 6], [6, 82, 2], [8, 85, 8]],                          // segunda aumentada Sib-Do#
    [[0, 85, 4], [4, 82, 4], [8, 81, 4], [12, 79, 2], [14, 76, 2]],
  ];
  const OST = [
    [0, 1, 2, 1, 3, 1, 2, 1, 0, 1, 2, 1, 3, 2, 1, 2],
    [0, 2, 3, 2, 1, 2, 3, 2, 0, 2, 3, 2, 1, 3, 2, 1],
    [3, 2, 1, 0, 1, 2, 3, 2, 3, 2, 1, 0, 2, 1, 2, 3],
  ];
  const STAB = { att: 0.005, rel: 0.22, vol: 0.015, cut: 2400 };
  const BASS_B = { type: 'sawtooth', att: 0.003, hold: 0.05, rel: 0.1, cut: 320, fenv: 4, q: 3, prio: 2 };
  const BASS_B16 = { type: 'sawtooth', att: 0.003, hold: 0.03, rel: 0.07, cut: 320, fenv: 4, q: 3, prio: 2 };
  const OST_V = { type: 'sawtooth', att: 0.003, rel: 0.12, cut: 1500, fenv: 2.2, q: 2.5, send: true, prio: 0 };
  const LEAD_V = { type: 'sawtooth', att: 0.015, rel: 0.12, cut: 1700, q: 1, sus: 0.8, vol: 0.036, send: true, prio: 1 };
  const KICK_B = { dec: 0.2 };

  function bossStep(p, st, t) {
    const S = BOSS_S, w = where(S, st), c = w.c, s = w.s, sec = w.sec, sb = w.sb, I = intenS;
    const brk = sec === 2;
    const d = padDur(p, S, w);
    if (d > 0) pad(p, t, c.pad, d, { att: 0.12, rel: 0.5, vol: 0.012, cut: 1100 });
    if (s === 0 && S.starts[w.i]) pad(p, t, c.pad.map(n => n + 12), 0.06, STAB);   // golpe de metales
    // bajo: octavas en corcheas; semicorcheas tensas en la parte a medio tiempo
    if (brk) syn(p, t, c.r + (s === 14 ? 12 : 0), BASS_B16, s % 4 === 0 ? 0.11 : 0.07);
    else if (s % 2 === 0) syn(p, t, c.r + (s % 4 === 2 ? 12 : 0), BASS_B, s % 4 === 0 ? 0.12 : 0.09);
    // bombo a negras (o a medio tiempo) con golpes extra según la pasada
    let k = 0;
    if (brk) k = s === 0 || s === 10 ? 0.7 : 0;
    else if (s % 4 === 0) k = s === 0 ? 0.78 : 0.66;
    else if (s === 14 && (sb & 1) && (w.fi + w.pass) % 2 === 1) k = 0.42;
    if (k) kick(p, t, k, KICK_B);
    // caja y redoble al final de cada sección
    if (sb === 7 && s >= 8 && !brk) snare(p, t, 0.03 + 0.008 * (s - 8));
    else if (brk ? s === 12 : s === 4 || s === 12) snare(p, t, 0.1);
    // charles en semicorcheas
    if (s % 4 === 2) hat(p, t, 0.04, brk);
    else hat(p, t, s % 2 === 0 ? 0.022 : 0.012 + 0.01 * I);
    // ostinato (entra tras 4 compases de introducción)
    if (w.bar >= 4) {
      const pat = OST[(sec + w.pass) % OST.length];
      syn(p, t, c.arp[pat[s]], OST_V, (s % 4 === 0 ? 0.028 : 0.02) * (0.7 + 0.4 * I));
    }
    // melodía principal (la de la parte tensa baja una octava en pasadas impares)
    const ph = brk ? LEAD_B3 : sec === 3 ? LEAD_B4 : null;
    if (ph) {
      const shift = brk && w.pass % 2 === 1 ? -12 : 0;
      for (const n of ph[sb]) if (n[0] === s) syn(p, t, n[1] + shift, LEAD_V, null, n[2] * p.sd - 0.05);
    }
  }

  // ================================================================
  //  Temas cortos (sin bucle)
  // ================================================================
  const V_PAD = { att: 0.04, rel: 0.5, vol: 0.02, cut: 2600, send: true };
  const V_END = { att: 0.04, rel: 2, vol: 0.016, cut: 2400, send: true };
  const V_BELL = { ratio: 3.5, idx: 1, dec: 2 };
  // Victoria · Re mayor, 120 BPM: arpegios ascendentes I-IV-V-I y destellos (~6,5 s)
  const VICTORY = {
    0: (p, t) => { pad(p, t, [62, 66, 69], 0.9, V_PAD); drone(p, t, 38, 0.9, 0.08, 0.4, 0.02); kick(p, t, 0.45); bell(p, t, 74, 0.06, V_BELL); },
    2: (p, t) => bell(p, t, 78, 0.055, V_BELL),
    4: (p, t) => bell(p, t, 81, 0.055, V_BELL),
    6: (p, t) => bell(p, t, 86, 0.05, V_BELL),
    8: (p, t) => { pad(p, t, [62, 67, 71], 0.9, V_PAD); drone(p, t, 43, 0.9, 0.08, 0.4, 0.02); bell(p, t, 83, 0.055, V_BELL); },
    10: (p, t) => bell(p, t, 86, 0.05, V_BELL),
    12: (p, t) => bell(p, t, 91, 0.04, V_BELL),
    16: (p, t) => { pad(p, t, [61, 64, 69], 0.9, V_PAD); drone(p, t, 45, 0.9, 0.08, 0.4, 0.02); bell(p, t, 81, 0.055, V_BELL); },
    18: (p, t) => bell(p, t, 85, 0.05, V_BELL),
    20: (p, t) => bell(p, t, 88, 0.045, V_BELL),
    22: (p, t) => bell(p, t, 85, 0.045, V_BELL),
    24: (p, t) => {
      pad(p, t, [62, 66, 69, 74], 1.8, V_END);
      drone(p, t, 38, 1.6, 0.08, 1.8, 0.02);
      kick(p, t, 0.5);
      crash(p, t, 0.03);
      [86, 90, 93, 98].forEach((m, k) => bell(p, t + k * 0.06, m, 0.045, V_BELL));
    },
    28: (p, t) => bell(p, t, 93, 0.022, SPARK),
    30: (p, t) => bell(p, t, 90, 0.022, SPARK),
    32: (p, t) => bell(p, t, 95, 0.02, SPARK),
    34: (p, t) => bell(p, t, 88, 0.02, SPARK),
    36: (p, t) => bell(p, t, 98, 0.018, SPARK),
  };
  // Derrota · Re menor, 84 BPM: campanas que caen i-VI-iv-V-i y golpe grave (~7,5 s)
  const D_PAD = { att: 0.1, rel: 0.8, vol: 0.02, cut: 1000, send: true };
  const D_BELL = { ratio: 3.5, idx: 0.9, dec: 2.4 };
  const DEFEAT = {
    0: (p, t) => { pad(p, t, [57, 62, 65], 1.3, D_PAD); drone(p, t, 38, 1.3, 0.07, 0.8); bell(p, t, 81, 0.055, D_BELL); },
    3: (p, t) => bell(p, t, 77, 0.045, D_BELL),
    6: (p, t) => bell(p, t, 76, 0.04, D_BELL),
    8: (p, t) => { pad(p, t, [58, 62, 65], 1.3, D_PAD); drone(p, t, 34, 1.3, 0.07, 0.8); bell(p, t, 74, 0.05, D_BELL); },
    11: (p, t) => bell(p, t, 70, 0.04, D_BELL),
    16: (p, t) => { pad(p, t, [55, 58, 62], 0.65, D_PAD); drone(p, t, 43, 0.65, 0.07, 0.6); bell(p, t, 70, 0.045, D_BELL); },
    20: (p, t) => { pad(p, t, [57, 61, 64], 0.65, D_PAD); drone(p, t, 45, 0.65, 0.07, 0.6); bell(p, t, 73, 0.045, D_BELL); },
    24: (p, t) => {
      pad(p, t, [50, 53, 57], 1.4, { att: 0.05, rel: 1.8, vol: 0.022, cut: 700, send: true });
      drone(p, t, 38, 1.4, 0.08, 1.8, 0.05);
      kick(p, t, 0.5, { dec: 1.1, f0: 90, f1: 35 });
      bell(p, t, 62, 0.05, { ratio: 3.5, idx: 0.8, dec: 3 });
    },
  };

  // ================================================================
  //  Pistas
  // ================================================================
  const TRACKS = {
    menu: { bpm: 64, level: 0.55, echo: { beats: 0.75, fb: 0.42, send: 0.3, cut: 2600 }, step: menuStep },
    dungeon: { bpm: 104, level: 0.95, echo: { beats: 0.75, fb: 0.3, send: 0.25, cut: 2400 }, step: dungeonStep },
    boss: { bpm: 132, level: 0.9, echo: { beats: 0.5, fb: 0.25, send: 0.2, cut: 2200 }, step: bossStep },
    victory: { bpm: 120, level: 0.85, len: 40, tail: 2, echo: { beats: 0.75, fb: 0.35, send: 0.3, cut: 3000 },
      step(p, st, t) { const f = VICTORY[st]; if (f) f(p, t); } },
    defeat: { bpm: 84, level: 0.85, len: 26, tail: 3.1, echo: { beats: 0.75, fb: 0.35, send: 0.3, cut: 2000 },
      step(p, st, t) { const f = DEFEAT[st]; if (f) f(p, t); } },
  };

  // ================================================================
  //  Reproductores: uno por pista sonando (varios durante un fundido)
  // ================================================================
  // Volumen actual del bus (se sigue en JS: .value no es fiable durante las rampas)
  function gainAt(p, now) {
    const g = p.gv;
    if (now >= g.t1) return g.to;
    if (now <= g.t0) return g.from;
    return g.from + (g.to - g.from) * (now - g.t0) / (g.t1 - g.t0);
  }
  function ramp(p, to, dur) {
    const now = ctx.currentTime, v = gainAt(p, now), prm = p.bus.gain;
    if (prm.cancelScheduledValues) prm.cancelScheduledValues(now);
    prm.setValueAtTime(v, now);
    prm.linearRampToValueAtTime(to, now + dur);
    p.gv = { from: v, to, t0: now, t1: now + dur };
  }
  function makePlayer(name) {
    const def = TRACKS[name], now = ctx.currentTime;
    const p = {
      name, def, sd: 60 / def.bpm / 4, step: 0, next: now + 0.06, fresh: true,
      ending: Infinity, dispose: Infinity, fading: false, padEnd: 0,
      plan: null, lplan: null, planBar: -1, bIdx: 2, mIdx: 3,
      bus: ctx.createGain(), send: null, fx: [], gv: { from: 0, to: 0, t0: now, t1: now },
    };
    p.bus.gain.value = 0;
    p.bus.gain.setValueAtTime(0, now);
    p.bus.connect(master);
    // eco propio de la pista (retardo con realimentación filtrada)
    if (def.echo && typeof ctx.createDelay === 'function') {
      try {
        const e = def.echo, send = ctx.createGain(), dl = ctx.createDelay(2), lp = ctx.createBiquadFilter(), fb = ctx.createGain();
        send.gain.value = e.send;
        dl.delayTime.value = Math.min(1.9, e.beats * 60 / def.bpm);
        lp.type = 'lowpass';
        lp.frequency.value = e.cut;
        fb.gain.value = e.fb;
        send.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(p.bus);
        p.send = send; p.fx = [send, dl, lp, fb];
      } catch (_) { p.send = null; }
    }
    ramp(p, def.level, def.len ? 0.03 : FADE);
    return p;
  }
  function fadeOut(p, dur) {
    const now = ctx.currentTime;
    ramp(p, 0, dur);
    p.fading = true;
    p.ending = Math.min(p.ending, now + dur);
    p.dispose = Math.min(p.dispose, now + dur + 0.15);
  }
  // Suelta un reproductor: corta sus notas pendientes y desconecta su bus
  function kill(p, now) {
    for (const v of voices) if (v.p === p) for (const s of v.srcs) { try { s.stop(now); } catch (_) {} }
    voices = voices.filter(v => v.p !== p);
    nsrc = 0;
    for (const v of voices) nsrc += v.srcs.length;
    disc(p.bus);
    for (const n of p.fx) disc(n);
  }
  function halt() { if (timer) { clearInterval(timer); timer = null; } }

  function start(track) {
    const now = ctx.currentTime;
    let keep = null;
    for (const p of players) {
      // volver a una pista que aún se está apagando: se recupera sin cortarla
      if (!keep && track && p.name === track && !p.def.len && p.fading && now < p.ending) {
        keep = p;
        p.fading = false; p.ending = Infinity; p.dispose = Infinity;
        ramp(p, p.def.level, FADE);
      } else if (!p.fading) fadeOut(p, FADE);
    }
    if (track && !keep) players.push(makePlayer(track));
    if (!timer && players.length) timer = setInterval(tick, TICK_MS);
    tick();
  }

  // ================================================================
  //  Planificador (lookahead): programa notas ~0,1 s por delante
  // ================================================================
  function tick() {
    try {
      if (!ctx) return halt();
      const now = ctx.currentTime;
      for (let i = players.length - 1; i >= 0; i--) {
        const p = players[i];
        if (now < p.dispose) continue;
        kill(p, now);
        players.splice(i, 1);
        if (M.current === p.name && !players.some(q => q.name === p.name && !q.fading)) M.current = null;
      }
      if (!players.length) return halt();
      const st = ctx.state;
      if ((st && st !== 'running') || isHidden()) { lastNow = now; return; }
      prune(now);
      const dt = Math.min(1, Math.max(0, now - lastNow));
      lastNow = now;
      intenS += (inten - intenS) * (1 - Math.exp(-dt / 1.2));
      const horizon = now + LOOKAHEAD;
      for (const p of players) {
        // pestaña oculta o tirón largo: saltamos al presente sin avalancha de notas atrasadas
        if (p.next < now - LATE_SKIP) {
          const k = Math.ceil((now - p.next) / p.sd);
          p.step += k; p.next += k * p.sd; p.fresh = true;
        }
        let guard = 0;
        while (p.next < horizon && p.next < p.ending && guard++ < 8) {
          if (p.def.len && p.step >= p.def.len) {   // fin de un tema corto
            p.fading = true; p.ending = p.next; p.dispose = p.next + p.def.tail;
            break;
          }
          try { p.def.step(p, p.step, Math.max(p.next, now)); } catch (_) {}
          p.fresh = false;
          p.step++;
          p.next += p.sd;
        }
      }
    } catch (_) {}
  }

  // ================================================================
  //  API pública
  // ================================================================
  function attach(c, o) {
    try {
      if (c !== ctx) {
        // contexto nuevo: soltamos todo lo del anterior
        if (ctx) {
          const now = ctx.currentTime;
          for (const p of players) kill(p, now);
          disc(tail); disc(master);
        }
        players = []; voices = []; nsrc = 0; halt();
        ctx = master = tail = nbuf = out = null;
        if (!c || typeof c.createGain !== 'function') return;
        ctx = c;
        master = c.createGain();
        master.gain.value = MASTER;   // sin compresor: su ganancia automática subiría el volumen; los niveles ya van medidos
        tail = master;
      }
      const dest = o || ctx.destination;
      if (dest !== out) {
        if (out) disc(tail);
        out = dest;
        tail.connect(out);
      }
      // pista pedida antes de tener contexto
      if (M.current && !players.length) start(M.current);
    } catch (_) { ctx = null; }
  }

  function play(track) {
    try {
      const t = track == null ? null : String(track);
      if (t !== null && !has(TRACKS, t)) return;   // pista desconocida: se ignora
      if (t === M.current) return;
      M.current = t;
      if (ctx) start(t);
    } catch (_) {}
  }

  function setIntensity(x) {
    try {   // Number() lanza con Symbol o con un valueOf que falle
      const v = Number(x);
      if (v === v && isFinite(v)) inten = clamp01(v);
    } catch (_) {}
  }

  function stop() {
    try {
      M.current = null;
      if (!ctx) return;
      const now = ctx.currentTime;
      for (const p of players) {
        try { ramp(p, 0, 0.02); } catch (_) {}
        p.fading = true; p.ending = now; p.dispose = now + 0.05;
      }
      for (const v of voices) for (const s of v.srcs) { try { s.stop(now + 0.03); } catch (_) {} }
      voices = []; nsrc = 0;
    } catch (_) {}
  }

  const M = { current: null, attach, play, setIntensity, stop };
  (typeof window !== 'undefined' ? window : globalThis).ArcanoMusic = M;
})();
