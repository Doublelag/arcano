/* Arcano · biomas de sala: fondos estáticos en perspectiva cenital 3/4.
   Script clásico: expone window.ArcanoBiomes. Todo es procedural y con semilla. */
(function () {
  'use strict';

  // Constantes del juego (coordenadas lógicas)
  const W = 540, H = 960;
  const AX = 30, AY = 128, AW = 480, AH = 800;
  const CELL = 40, COLS = 12, ROWS = 20;
  const TAU = Math.PI * 2;
  const SPAWN_X = AX + AW / 2, SPAWN_Y = AY + AH - 50;
  const TORCHES = [AX + 70, AX + AW - 70];

  // ---------- utilidades ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  const rnd = (R, a, b) => a + R() * (b - a);
  const pick = (R, arr) => arr[(R() * arr.length) | 0];

  // Rectángulo con radio por esquina (0 = esquina viva)
  function rrPath(c, x, y, w, h, tl, tr, br, bl) {
    c.beginPath();
    c.moveTo(x + tl, y);
    c.arcTo(x + w, y, x + w, y + h, tr);
    c.arcTo(x + w, y + h, x, y + h, br);
    c.arcTo(x, y + h, x, y, bl);
    c.arcTo(x, y, x + w, y, tl);
    c.closePath();
  }
  function ellP(c, x, y, rx, ry, rot) { c.moveTo(x + rx * Math.cos(rot || 0), y + rx * Math.sin(rot || 0)); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); }
  function circP(c, x, y, r) { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); }
  function fillEll(c, x, y, rx, ry, col) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); }
  function fillCirc(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  function poly(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }
  function glow(c, x, y, r, col, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function solidAt(grid, x, y) {
    if (x < AX || x >= AX + AW || y < AY || y >= AY + AH) return true;
    return grid[((y - AY) / CELL | 0) * COLS + ((x - AX) / CELL | 0)] === 1;
  }
  // Punto libre del suelo (lejos de obstáculos y, opcionalmente, del círculo de inicio)
  function freeSpot(R, grid, pad, avoidSpawn) {
    for (let k = 0; k < 8; k++) {
      const x = rnd(R, AX + pad, AX + AW - pad), y = rnd(R, AY + pad, AY + AH - pad);
      if (solidAt(grid, x, y)) continue;
      if (avoidSpawn && Math.hypot(x - SPAWN_X, y - SPAWN_Y) < 52) continue;
      return [x, y];
    }
    return null;
  }
  const nearTorch = (x, m) => TORCHES.some(t => Math.abs(x - t) < m);

  // Grietas: polilíneas quebradas (tronco + ramitas), precalculadas
  function crackLines(R, x, y, len, ang) {
    const main = [x, y], out = [main];
    let a = ang;
    for (let i = 0; i < 4; i++) {
      a += rnd(R, -0.7, 0.7);
      x += Math.cos(a) * len / 4; y += Math.sin(a) * len / 4;
      main.push(x, y);
      if (R() < 0.3) { const b = a + rnd(R, -1.3, 1.3); out.push([x, y, x + Math.cos(b) * len / 6, y + Math.sin(b) * len / 6]); }
    }
    return out;
  }
  function addLines(c, lines) {
    for (const p of lines) { c.moveTo(p[0], p[1]); for (let k = 2; k < p.length; k += 2) c.lineTo(p[k], p[k + 1]); }
  }
  function crackPath(c, R, x, y, len, ang) { addLines(c, crackLines(R, x, y, len, ang)); }

  // Ladrillos de una cara frontal (filas desfasadas, tono variable)
  function bricks(c, R, x0, y0, w, h, rowH, minW, maxW, mortar, base, round) {
    c.fillStyle = mortar; c.fillRect(x0, y0, w, h);
    for (let y = y0, row = 0; y < y0 + h - 1; y += rowH, row++) {
      let x = x0 - (row & 1 ? rnd(R, 4, 14) : 0);
      const hh = Math.min(rowH, y0 + h - y) - 1.5;
      while (x < x0 + w) {
        const bw = rnd(R, minW, maxW);
        const bx = Math.max(x, x0), bww = Math.min(x + bw, x0 + w) - bx - 1.5;
        if (bww > 1) {
          const v = R();
          rrPath(c, bx + 0.75, y + 0.75, bww, hh, round, round, round, round);
          c.fillStyle = base; c.fill();
          c.fillStyle = v < 0.5 ? `rgba(255,255,255,${0.02 + v * 0.1})` : `rgba(0,0,0,${(v - 0.5) * 0.22})`; c.fill();
          c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(bx + 1.5, y + 1, bww - 1.5, 1.2);
        }
        x += bw;
      }
    }
  }

  // Bloques de remate vistos desde arriba (muros laterales/inferior)
  function capStones(c, R, x, y, w, h, vertical, size, line) {
    c.strokeStyle = line; c.lineWidth = 1.2;
    c.beginPath();
    if (vertical) {
      for (let yy = y + rnd(R, 6, size); yy < y + h; yy += rnd(R, size * 0.7, size * 1.3)) { c.moveTo(x + 2, yy); c.lineTo(x + w - 2, yy); }
    } else {
      for (let xx = x + rnd(R, 6, size); xx < x + w; xx += rnd(R, size * 0.7, size * 1.3)) { c.moveTo(xx, y + 2); c.lineTo(xx, y + h - 2); }
    }
    c.stroke();
  }

  // Bloque 3/4 (cara superior + frontal) que se fusiona con sus vecinos.
  // P = { top, front, edge }; devuelve la geometría para añadir detalles.
  const LIFT = 12;
  function block(c, x, y, nb, P) {
    const inL = nb.l ? 0 : 2, inR = nb.r ? 0 : 2;
    const x0 = x + inL, w = CELL - inL - inR;
    const yT = y - LIFT, yF = y + CELL - LIFT;
    const yB = nb.d ? yF + 2 : y + CELL + 1;
    const r = 7;
    const tl = !nb.u && !nb.l ? r : 0, tr = !nb.u && !nb.r ? r : 0;
    const bl = !nb.d && !nb.l ? r : 0, br = !nb.d && !nb.r ? r : 0;
    // contorno oscuro solo por los lados expuestos
    const eL = nb.l ? 0 : 1.5, eR = nb.r ? 0 : 1.5, eU = nb.u ? 0 : 1.5, eD = nb.d ? 0 : 1.5;
    c.fillStyle = P.edge;
    rrPath(c, x0 - eL, yT - eU, w + eL + eR, yB - yT + eU + eD, tl && tl + 1, tr && tr + 1, br && br + 1, bl && bl + 1); c.fill();
    // silueta = cara frontal
    c.fillStyle = P.front;
    rrPath(c, x0, yT, w, yB - yT, tl, tr, br, bl); c.fill();
    if (!nb.d) {
      const g = c.createLinearGradient(0, yF, 0, yB);
      g.addColorStop(0, 'rgba(255,255,255,.06)'); g.addColorStop(1, 'rgba(0,0,0,.28)');
      c.fillStyle = g; rrPath(c, x0, yF, w, yB - yF, 0, 0, br, bl); c.fill();
    }
    // cara superior
    const yTopEnd = nb.d ? yB : yF;
    c.fillStyle = P.top;
    rrPath(c, x0, yT, w, yTopEnd - yT, tl, tr, nb.d ? br : 0, nb.d ? bl : 0); c.fill();
    // luz desde arriba-izquierda
    c.fillStyle = 'rgba(255,255,255,.16)';
    if (!nb.u) c.fillRect(x0 + tl, yT + 1, w - tl - tr, 2);
    if (!nb.l) c.fillRect(x0 + 1, yT + tl, 2, yTopEnd - yT - tl - (nb.d ? bl : 0));
    c.fillStyle = 'rgba(0,0,0,.12)';
    if (!nb.r) c.fillRect(x0 + w - 3, yT + tr, 3, yTopEnd - yT - tr);
    if (!nb.d) { c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(x0 + bl * 0.3, yF - 1, w - (bl + br) * 0.3, 1.5); }
    return { x0, x1: x0 + w, w, yT, yF, yB, yTopEnd, tl, tr };
  }
  // Recorte a la cara superior / frontal: grietas y vetas no se salen al suelo (cerrar con c.restore())
  function clipTop(c, g) { c.save(); rrPath(c, g.x0, g.yT, g.w, g.yTopEnd - g.yT, g.tl, g.tr, 0, 0); c.clip(); }
  function clipFront(c, g) { c.save(); c.beginPath(); c.rect(g.x0, g.yF, g.w, g.yB - g.yF); c.clip(); }

  // Sombras al suelo de los bloques (por zonas: las celdas vecinas no acumulan alfa)
  function blockShadows(c, cells) {
    if (!cells.length) return;
    c.fillStyle = 'rgba(0,0,0,.13)';
    zoned(c, cells, ([x, y]) => c.rect(x + 1, y + 4, CELL + 3, CELL));
    c.fillStyle = 'rgba(0,0,0,.15)';
    zoned(c, cells, ([x, y]) => c.rect(x + 3, y + 6, CELL - 1, CELL - 3));
  }
  function propShadow(c, cx, cy, rx, ry) {
    fillEll(c, cx + 2, cy + 1, rx + 2, ry + 1.5, 'rgba(0,0,0,.12)');
    fillEll(c, cx + 2, cy + 1, rx - 1, ry - 0.5, 'rgba(0,0,0,.18)');
  }

  // Cristal / esquirla puntiaguda (cristales de hielo, obsidiana)
  function shard(c, bx, by, w, h, lean, cTip, cBase, side, line) {
    const sx = bx - w / 2, ex = bx + w / 2, sh = by - h * 0.78;
    const pts = [sx, by, sx + lean * 0.7, sh, bx + lean, by - h, ex + lean * 0.7, sh, ex, by];
    const g = c.createLinearGradient(0, by - h, 0, by);
    g.addColorStop(0, cTip); g.addColorStop(1, cBase);
    c.fillStyle = g; poly(c, pts); c.fill();
    // cara derecha en sombra
    c.fillStyle = side;
    poly(c, [bx + lean * 0.15, by, bx + lean, by - h, ex + lean * 0.7, sh, ex, by]); c.fill();
    c.strokeStyle = line; c.lineWidth = 1.2; c.lineJoin = 'round';
    poly(c, pts); c.stroke();
    // filo iluminado
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(sx + 1.5, by - 2); c.lineTo(sx + lean * 0.7 + 1.5, sh + 1); c.lineTo(bx + lean, by - h + 3); c.stroke();
  }
  function sparkle(c, x, y, s, col) {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(x, y - s); c.lineTo(x + s * 0.25, y - s * 0.25); c.lineTo(x + s, y); c.lineTo(x + s * 0.25, y + s * 0.25);
    c.lineTo(x, y + s); c.lineTo(x - s * 0.25, y + s * 0.25); c.lineTo(x - s, y); c.lineTo(x - s * 0.25, y - s * 0.25);
    c.closePath(); c.fill();
  }

  // ---------- lotes: agrupar figuras por color y zona para hacer pocos fill() ----------
  function bucket(map, col) { let a = map.get(col); if (!a) map.set(col, a = []); return a; }
  // Color sólido aclarado (t>0) u oscurecido (t<0): evita capas semitransparentes a pantalla completa
  const mixCache = new Map();
  function mix(hex, t) {
    const key = hex + t.toFixed(3);
    let s = mixCache.get(key);
    if (!s) {
      const n = parseInt(hex.slice(1), 16), ch = [n >> 16, n >> 8 & 255, n & 255];
      const f = v => Math.round(t > 0 ? v + (255 - v) * t : v * (1 + t));
      s = `rgb(${f(ch[0])},${f(ch[1])},${f(ch[2])})`; mixCache.set(key, s);
    }
    return s;
  }
  // variación aleatoria cuantizada (8 niveles = pocos lotes)
  function jitterT(v, jit) {
    const lv = Math.min(7, v * 8 | 0);
    return lv < 4 ? (lv + 0.5) / 8 * jit : -(lv - 3.5) / 8 * jit * 1.2;
  }
  // OJO rendimiento: en canvas por GPU un trazado con muchas figuras repartidas por toda la sala
  // es carísimo (se rellena su caja entera). Por eso se agrupa por zonas pequeñas (ZONE px).
  const ZONE = 80;
  const zoneKey = (x, y) => ((x / ZONE) | 0) * 64 + ((y / ZONE) | 0);
  // items: [x, y, ...]; draw(item) añade la figura al trazado actual
  function zoned(c, items, draw, stroke) {
    const m = new Map();
    for (const it of items) bucket(m, zoneKey(it[0], it[1])).push(it);
    for (const list of m.values()) { c.beginPath(); for (const it of list) draw(it); if (stroke) c.stroke(); else c.fill(); }
  }
  const drawCirc = c => it => circP(c, it[0], it[1], it[2]);
  const drawEll = c => it => ellP(c, it[0], it[1], it[2], it[3], it[4]);
  const drawLines = c => it => { c.moveTo(it[0], it[1]); for (let k = 2; k < it.length; k += 2) c.lineTo(it[k], it[k + 1]); };
  function flushRects(c, map) {
    for (const [col, a] of map) { c.fillStyle = col; for (let i = 0; i < a.length; i += 4) c.fillRect(a[i], a[i + 1], a[i + 2], a[i + 3]); }
    map.clear();
  }
  function flushPolys(c, map) {
    for (const [col, list] of map) {
      c.fillStyle = col;
      zoned(c, list, p => { c.moveTo(p[0], p[1]); for (let k = 2; k < p.length; k += 2) c.lineTo(p[k], p[k + 1]); c.closePath(); });
    }
    map.clear();
  }
  // rectángulo de esquinas romas como polígono (octógono), barato para lotes
  function bevelRect(x, y, w, h, r) {
    return [x + r, y, x + w - r, y, x + w, y + r, x + w, y + h - r, x + w - r, y + h, x + r, y + h, x, y + h - r, x, y + r];
  }

  // Suelo a tablero con variación sutil por baldosa
  function checker(c, R, a, b, jit) {
    const m = new Map();
    for (let r = 0; r < ROWS; r++) for (let k = 0; k < COLS; k++) bucket(m, mix((r + k) & 1 ? a : b, jitterT(R(), jit))).push(AX + k * CELL, AY + r * CELL, CELL, CELL);
    flushRects(c, m);
  }
  function speckles(c, R, n, col, sz) {
    c.fillStyle = col;
    for (let i = 0; i < n; i++) { const s = rnd(R, sz * 0.5, sz); c.fillRect(rnd(R, AX, AX + AW - s), rnd(R, AY, AY + AH - s), s, s); }
  }
  function softPatches(c, R, n, col, rmin, rmax) {
    for (let i = 0; i < n; i++) glow(c, rnd(R, AX, AX + AW), rnd(R, AY, AY + AH), rnd(R, rmin, rmax), col, rnd(R, 0.05, 0.1));
  }

  // ======================================================================
  //  PRADERA
  // ======================================================================
  const pradera = {
    name: 'Pradera esmeralda', dark: '#13231a', accent: '#a6e36b', ambient: 'leaves',
    floor(c, R, grid) {
      checker(c, R, '#5a9844', '#54913f', 0.05);
      softPatches(c, R, 5, '255,250,190', 40, 80);
      softPatches(c, R, 4, '20,60,20', 40, 75);
      // calvas de tierra
      for (let i = 0; i < 3; i++) {
        const p = freeSpot(R, grid, 40, true); if (!p) continue;
        const n = 3 + (R() * 3 | 0), e = [];
        for (let k = 0; k < n; k++) e.push([p[0] + rnd(R, -16, 16), p[1] + rnd(R, -7, 7), rnd(R, 8, 15), rnd(R, 5, 9)]);
        c.fillStyle = 'rgba(60,80,30,.16)'; c.beginPath();
        for (const [x, y, a, b] of e) ellP(c, x + 1, y + 1.5, a + 2, b + 1.5);
        c.fill();
        c.fillStyle = 'rgba(182,150,98,.5)'; c.beginPath();
        for (const [x, y, a, b] of e) ellP(c, x, y, a, b);
        c.fill();
        c.fillStyle = 'rgba(120,95,60,.4)'; c.beginPath();
        for (let k = 0; k < 5; k++) circP(c, p[0] + rnd(R, -14, 14), p[1] + rnd(R, -5, 5), rnd(R, 1, 2));
        c.fill();
      }
      speckles(c, R, 380, 'rgba(210,255,160,.09)', 2.2);
      speckles(c, R, 300, 'rgba(20,55,15,.13)', 2.2);
      // matojos de hierba
      const tufts = [];
      for (let i = 0; i < 130; i++) { const p = freeSpot(R, grid, 6, false); if (p) tufts.push(p); }
      c.lineCap = 'round';
      const blades = [];
      for (const [x, y] of tufts) for (let b = -1; b <= 1; b++) blades.push([x + b * 2, y, x + b * 4 + rnd(R, -1, 1), y - rnd(R, 4, 7)]);
      c.strokeStyle = 'rgba(32,78,26,.5)'; c.lineWidth = 1.4;
      zoned(c, blades, drawLines(c), true);
      c.strokeStyle = 'rgba(175,225,115,.38)'; c.lineWidth = 1;
      zoned(c, tufts.map(([x, y]) => [x + 1, y - 1, x + 2.5, y - 5]), drawLines(c), true);
      // tréboles
      const clover = [];
      for (let i = 0; i < 18; i++) {
        const p = freeSpot(R, grid, 8, true); if (!p) continue;
        for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + 0.4; clover.push([p[0] + Math.cos(a) * 2.2, p[1] + Math.sin(a) * 2.2, 2]); }
      }
      c.fillStyle = 'rgba(70,140,55,.55)'; zoned(c, clover, drawCirc(c));
      // florecillas y piedrecitas (en lotes por color)
      const cols = ['#fff3dc', '#ffd84d', '#ff9fc6', '#cdb2ff', '#fff3dc'];
      const E = new Map();
      for (let i = 0; i < 34; i++) {
        const p = freeSpot(R, grid, 8, true); if (!p) continue;
        const [x, y] = p, s = rnd(R, 1.5, 2.3), pc = bucket(E, 'p' + pick(R, cols));
        bucket(E, 'sombra').push([x + 1, y + 2, 4, 1.6]);
        for (let k = 0; k < 5; k++) { const a = k * TAU / 5; pc.push([x + Math.cos(a) * s * 1.2, y + Math.sin(a) * s * 1.2, s, s]); }
        bucket(E, 'centro').push([x, y, s * 0.75, s * 0.75]);
      }
      for (let i = 0; i < 12; i++) {
        const p = freeSpot(R, grid, 8, true); if (!p) continue;
        const rx = rnd(R, 2.5, 4.5);
        bucket(E, 'psombra').push([p[0] + 1, p[1] + 1.5, rx, rx * 0.6]);
        bucket(E, 'piedra').push([p[0], p[1], rx, rx * 0.65]);
        bucket(E, 'pbrillo').push([p[0] - rx * 0.3, p[1] - rx * 0.25, rx * 0.45, rx * 0.25]);
      }
      const ecol = { sombra: 'rgba(0,40,0,.18)', centro: '#f2b630', psombra: 'rgba(0,0,0,.2)', piedra: '#9aa0a0', pbrillo: 'rgba(255,255,255,.35)' };
      for (const k of ['sombra', 'psombra', ...cols.map(x => 'p' + x), 'centro', 'piedra', 'pbrillo']) {
        const a = E.get(k); if (!a) continue;
        c.fillStyle = ecol[k] || k.slice(1);
        zoned(c, a, drawEll(c)); E.delete(k);
      }
    },
    threshold(c, R, d0, d1) {
      // camino de tierra que entra por la puerta
      const e = [];
      for (let y = AY + 4; y < AY + 70; y += 8) e.push([(d0 + d1) / 2 + rnd(R, -6, 6), y, (d1 - d0) / 2 - 6 - (y - AY) * 0.3 + rnd(R, -3, 3)]);
      c.fillStyle = 'rgba(182,150,98,.36)'; c.beginPath();
      for (const [x, y, rx] of e) ellP(c, x, y, rx, 7);
      c.fill();
      c.fillStyle = 'rgba(120,95,60,.3)'; c.beginPath();
      for (let k = 0; k < 10; k++) circP(c, (d0 + d1) / 2 + rnd(R, -30, 30), AY + rnd(R, 6, 50), rnd(R, 1, 2));
      c.fill();
    },
    walls(c, R, d0, d1) {
      const yC = AY - 24;
      // cara frontal: piedra clara
      bricks(c, R, AX, yC, AW, 24, 8, 16, 30, '#7d7564', '#b8af99', 1.5);
      const g = c.createLinearGradient(0, yC, 0, AY);
      g.addColorStop(0, 'rgba(255,248,225,.10)'); g.addColorStop(1, 'rgba(0,0,0,.30)');
      c.fillStyle = g; c.fillRect(AX, yC, AW, 24);
      // musgo en la base del muro
      c.fillStyle = 'rgba(80,150,60,.75)'; c.beginPath();
      for (let x = AX; x < AX + AW; x += rnd(R, 5, 10)) circP(c, x, AY - rnd(R, 0, 2), rnd(R, 2, 4));
      c.fill();
      // enredaderas
      for (const vx of [160, 190, 365, 395, 470]) {
        if (R() < 0.35 || nearTorch(vx, 18)) continue;
        const len = rnd(R, 10, 20);
        c.strokeStyle = '#3e7d31'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(vx, yC);
        for (let k = 1; k <= 4; k++) c.lineTo(vx + Math.sin(k * 1.7 + vx) * 2.5, yC + len * k / 4);
        c.stroke();
        c.fillStyle = '#5fae46'; c.beginPath();
        for (let k = 1; k <= 4; k++) ellP(c, vx + (k & 1 ? 3 : -3), yC + len * k / 4 - 2, 2.6, 1.6, k & 1 ? 0.5 : -0.5);
        c.fill();
      }
      // remates: seto continuo
      const hedge = (x, y, w, h) => { c.fillStyle = '#3a7d30'; c.fillRect(x, y, w, h); };
      hedge(AX - 24, AY - 34, AW + 48, 10);
      hedge(AX - 24, AY - 34, 24, AH + 58);
      hedge(AX + AW, AY - 34, 24, AH + 58);
      hedge(AX - 24, AY + AH, AW + 48, 24);
      this.hedgeTexture(c, R);
    },
    hedgeTexture(c, R) {
      // cada capa se pinta por zonas pequeñas (rápido también en GPU)
      const layer = (col, f, r0, r1, dx, dy) => {
        const items = [];
        all.forEach((area, i) => { for (let k = 0; k < counts[i] * f; k++) { const [x, y] = area(); items.push([x + dx, y + dy, rnd(R, r0, r1)]); } });
        c.fillStyle = col; zoned(c, items, drawCirc(c));
      };
      // bultos por el borde interior (miran a la sala) y textura de hojas
      const edgeTop = () => [rnd(R, AX - 20, AX + AW + 20), AY - 26 + rnd(R, -2, 2)];
      const edgeTop2 = () => [rnd(R, AX - 20, AX + AW + 20), AY - 32 + rnd(R, -2, 2)];
      const sideL = () => [AX - rnd(R, 2, 6), rnd(R, AY - 24, AY + AH + 20)];
      const sideR = () => [AX + AW + rnd(R, 2, 6), rnd(R, AY - 24, AY + AH + 20)];
      const midL = () => [rnd(R, AX - 22, AX - 4), rnd(R, AY - 30, AY + AH + 22)];
      const midR = () => [rnd(R, AX + AW + 4, AX + AW + 22), rnd(R, AY - 30, AY + AH + 22)];
      const bot = () => [rnd(R, AX - 20, AX + AW + 20), rnd(R, AY + AH + 2, AY + AH + 22)];
      const botEdge = () => [rnd(R, AX - 20, AX + AW + 20), AY + AH + rnd(R, 1, 4)];
      const all = [edgeTop, edgeTop2, sideL, sideR, midL, midR, bot, botEdge];
      const counts = [52, 44, 70, 70, 80, 80, 52, 46];
      layer('#2f6c28', 0.6, 4, 7, 1.5, 2);      // sombra de los bultos
      layer('#46923a', 1, 3.5, 6.5, 0, 0);
      layer('#5aa947', 0.55, 2.5, 4.5, -1.5, -1.5);
      layer('rgba(150,215,105,.55)', 0.3, 1, 2.2, -2.5, -2.5);
      // florecillas en el seto
      const fl = n => { const a = []; for (let i = 0; i < n; i++) { const p = pick(R, all)(); a.push([p[0], p[1], 1.3]); } return a; };
      c.fillStyle = '#fff1d6'; zoned(c, fl(26), drawCirc(c));
      c.fillStyle = '#ff9fc6'; zoned(c, fl(14), drawCirc(c));
    },
    pillar: { face: '#bcb39d', cap: '#d8cfb6', line: '#6f6756' },
    groups: [['moss', 0.5], ['hedge', 0.5]],
    singles: [['moss', 0.38], ['bush', 0.36], ['stump', 0.26]],
    props: {
      moss(c, x, y, nb, R) {
        const g = block(c, x, y, nb, { top: '#a2a7a8', front: '#6e7378', edge: 'rgba(28,38,32,.6)' });
        // vetas de la piedra
        clipTop(c, g);
        c.strokeStyle = 'rgba(60,66,70,.35)'; c.lineWidth = 1; c.beginPath();
        crackPath(c, R, rnd(R, g.x0 + 8, g.x1 - 8), rnd(R, g.yT + 6, g.yF - 10), 14, rnd(R, 0, TAU));
        c.stroke(); c.restore();
        if (!nb.d) { // juntas en la cara frontal
          c.fillStyle = 'rgba(0,0,0,.18)';
          c.fillRect(rnd(R, g.x0 + 8, g.x1 - 10), g.yF + 2, 1.5, g.yB - g.yF - 4);
        }
        // musgo
        const merged = nb.u || nb.d || nb.l || nb.r;
        const n = (merged ? 1 : 2) + (R() * 2 | 0), blobs = [];
        for (let i = 0; i < n; i++) {
          const rr = rnd(R, 4, 8);
          blobs.push([rnd(R, g.x0 + rr + 1, g.x1 - rr - 1), rnd(R, g.yT + rr + 1, g.yTopEnd - rr - 1), rr]);
        }
        if (!nb.u && R() < 0.7) blobs.push([rnd(R, g.x0 + 8, g.x1 - 8), g.yT + 6, rnd(R, 5, 7)]);
        c.fillStyle = '#4f8f39'; c.beginPath();
        for (const [bx, by, rr] of blobs) { circP(c, bx, by, rr); circP(c, bx + rr * 0.7, by + rr * 0.3, rr * 0.7); }
        c.fill();
        c.fillStyle = '#6cb34b'; c.beginPath();
        for (const [bx, by, rr] of blobs) circP(c, bx - rr * 0.25, by - rr * 0.3, rr * 0.6);
        c.fill();
        if (!nb.d) { // musgo que gotea por el canto
          c.fillStyle = '#4f8f39'; c.beginPath();
          const k = 1 + (R() * 3 | 0);
          for (let i = 0; i < k; i++) { const dx = rnd(R, g.x0 + 6, g.x1 - 6); ellP(c, dx, g.yF + 1, rnd(R, 3, 6), rnd(R, 2.5, 5)); }
          c.fill();
        }
      },
      hedge(c, x, y, nb, R) {
        const g = block(c, x, y, nb, { top: '#3f8a35', front: '#2b6227', edge: 'rgba(12,38,12,.65)' });
        // bultos de hoja sobre el borde superior
        if (!nb.u) {
          c.fillStyle = '#3f8a35'; c.beginPath();
          for (let bx = g.x0 + 6; bx < g.x1 - 3; bx += rnd(R, 7, 10)) circP(c, bx, g.yT + 3, rnd(R, 4.5, 6.5));
          c.fill();
        }
        const leaf = (col, n, r0, r1, dx, dy) => {
          c.fillStyle = col; c.beginPath();
          for (let i = 0; i < n; i++) circP(c, rnd(R, g.x0 + 5, g.x1 - 5) + dx, rnd(R, g.yT + 4, g.yTopEnd - 4) + dy, rnd(R, r0, r1));
          c.fill();
        };
        leaf('#357a2e', 7, 3, 5.5, 1, 1.5);
        leaf('#4c9c3f', 9, 3, 5, 0, 0);
        leaf('#64b44d', 6, 2, 3.5, -1.2, -1.2);
        leaf('rgba(160,225,110,.6)', 5, 1, 1.8, -2, -2);
        if (!nb.d) {
          c.fillStyle = '#23561f'; c.beginPath();
          for (let bx = g.x0 + 4; bx < g.x1 - 2; bx += rnd(R, 6, 9)) circP(c, bx, g.yF + 2, rnd(R, 2.5, 4));
          c.fill();
        }
        if (R() < 0.3) { fillCirc(c, rnd(R, g.x0 + 8, g.x1 - 8), rnd(R, g.yT + 8, g.yTopEnd - 8), 1.8, pick(R, ['#fff1d6', '#ff9fc6', '#ffd84d'])); }
      },
      bush(c, x, y, nb, R) {
        const cx = x + 20;
        const berries = R() < 0.55;
        c.fillStyle = 'rgba(10,35,10,.6)'; c.beginPath();
        circP(c, cx - 9, y + 24, 11.5); circP(c, cx + 9, y + 24, 11.5); circP(c, cx, y + 13, 14.5); circP(c, cx, y + 26, 12);
        c.fill();
        c.fillStyle = '#2d6a2a'; c.beginPath();
        circP(c, cx - 9, y + 24, 10); circP(c, cx + 9, y + 24, 10); circP(c, cx, y + 26, 10.5);
        c.fill();
        c.fillStyle = '#43933a'; c.beginPath();
        circP(c, cx - 8, y + 17, 10); circP(c, cx + 8, y + 17, 9.5); circP(c, cx, y + 12, 13);
        c.fill();
        c.fillStyle = '#5cad48'; c.beginPath();
        circP(c, cx - 6, y + 9, 7.5); circP(c, cx + 4, y + 5, 7); circP(c, cx - 10, y + 17, 5);
        c.fill();
        c.fillStyle = 'rgba(165,230,115,.75)'; c.beginPath();
        circP(c, cx - 8, y + 6, 2.6); circP(c, cx + 2, y + 1, 2.2); circP(c, cx - 12, y + 14, 1.8);
        c.fill();
        if (berries) {
          const col = pick(R, ['#e8473f', '#ff7eb3', '#f7f0ff']);
          for (let i = 0; i < 4; i++) {
            const bx = cx + rnd(R, -12, 12), by = y + rnd(R, 10, 26);
            fillCirc(c, bx, by, 2, col); fillCirc(c, bx - 0.6, by - 0.6, 0.7, 'rgba(255,255,255,.8)');
          }
        }
      },
      stump(c, x, y, nb, R) {
        const cx = x + 20, top = y + 6, bot = y + 30, rx = 13.5, ry = 5.5;
        // raíces
        c.fillStyle = '#5a361d'; c.beginPath();
        poly(c, [cx - 13, bot - 6, cx - 19, bot + 5, cx - 7, bot + 2]); c.fill();
        poly(c, [cx + 12, bot - 6, cx + 19, bot + 4, cx + 7, bot + 3]); c.fill();
        // tronco
        const g = c.createLinearGradient(cx - rx, 0, cx + rx, 0);
        g.addColorStop(0, '#9a6640'); g.addColorStop(0.45, '#7a4c2b'); g.addColorStop(1, '#4e2f19');
        c.fillStyle = 'rgba(30,15,5,.7)'; c.beginPath();
        c.moveTo(cx - rx - 1.5, top); c.lineTo(cx - rx - 1.5, bot); c.ellipse(cx, bot, rx + 1.5, ry + 1.5, 0, Math.PI, 0, true); c.lineTo(cx + rx + 1.5, top); c.closePath(); c.fill();
        c.fillStyle = g; c.beginPath();
        c.moveTo(cx - rx, top); c.lineTo(cx - rx, bot); c.ellipse(cx, bot, rx, ry, 0, Math.PI, 0, true); c.lineTo(cx + rx, top); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(40,20,8,.45)'; c.lineWidth = 1.2; c.beginPath();
        for (const dx of [-8, -3, 3, 8]) { c.moveTo(cx + dx, top + 4 + rnd(R, 0, 3)); c.lineTo(cx + dx + rnd(R, -1, 1), bot + ry * 0.7 - Math.abs(dx) * 0.3); }
        c.stroke();
        // corte superior con anillos
        fillEll(c, cx, top, rx + 1.5, ry + 1.5, 'rgba(30,15,5,.7)');
        fillEll(c, cx, top, rx, ry, '#d8ad70');
        c.strokeStyle = 'rgba(150,100,50,.7)'; c.lineWidth = 1;
        for (const k of [0.72, 0.45, 0.2]) { c.beginPath(); c.ellipse(cx + 0.5, top + 0.3, rx * k, ry * k, 0, 0, TAU); c.stroke(); }
        c.strokeStyle = 'rgba(110,70,30,.6)'; c.beginPath(); c.moveTo(cx, top); c.lineTo(cx + rx * 0.8, top - 1.5); c.stroke();
        fillEll(c, cx - 4, top - 1.5, 5, 1.5, 'rgba(255,240,200,.35)');
        // musgo y seta
        fillEll(c, cx - rx + 2, top + 3, 4, 3, '#4f8f39');
        if (R() < 0.6) {
          const mx = cx + rx - 1, my = bot + 1;
          c.fillStyle = '#efe2cc'; c.fillRect(mx - 1, my - 5, 2.5, 5);
          fillEll(c, mx, my - 5, 4.5, 3, '#d9443a');
          fillCirc(c, mx - 1.5, my - 6, 0.9, '#fff'); fillCirc(c, mx + 1.6, my - 5.2, 0.8, '#fff');
        }
      }
    }
  };

  // ======================================================================
  //  CRIPTA
  // ======================================================================
  const cripta = {
    name: 'Cripta de los susurros', dark: '#110c19', accent: '#c58cff', ambient: 'dust',
    floor(c, R, grid) {
      c.fillStyle = '#332b3e'; c.fillRect(AX, AY, AW, AH); // juntas
      const base = new Map(), lines = new Map();
      for (let r = 0; r < ROWS; r++) for (let k = 0; k < COLS; k++) {
        const x = AX + k * CELL, y = AY + r * CELL;
        const kind = R();
        const slabs = kind < 0.68 ? [[0, 0, 40, 40]] : kind < 0.88 ? [[0, 0, 20, 40], [20, 0, 20, 40]] : [[0, 0, 20, 20], [20, 0, 20, 20], [0, 20, 20, 20], [20, 20, 20, 20]];
        for (const [sx, sy, sw, sh] of slabs) {
          bucket(base, mix((r + k) & 1 ? '#4c4459' : '#484055', jitterT(R(), 0.12))).push(bevelRect(x + sx + 1, y + sy + 1, sw - 2, sh - 2, 1.5));
          bucket(lines, 'rgba(255,255,255,.06)').push(x + sx + 2, y + sy + 1.5, sw - 4, 1.2);
          bucket(lines, 'rgba(0,0,0,.16)').push(x + sx + 2, y + sy + sh - 2.5, sw - 4, 1.2);
        }
      }
      flushPolys(c, base); flushRects(c, lines);
      softPatches(c, R, 4, '180,150,255', 50, 85);
      softPatches(c, R, 5, '0,0,0', 40, 85);
      speckles(c, R, 260, 'rgba(0,0,0,.18)', 2);
      speckles(c, R, 160, 'rgba(220,200,255,.06)', 2);
      // grietas
      const cr = [];
      for (let i = 0; i < 22; i++) { const p = freeSpot(R, grid, 10, true); if (p) cr.push(...crackLines(R, p[0], p[1], rnd(R, 12, 26), rnd(R, 0, TAU))); }
      c.strokeStyle = 'rgba(18,12,26,.55)'; c.lineWidth = 1.1; c.lineJoin = 'round';
      zoned(c, cr, drawLines(c), true);
      // musgo entre juntas
      const moss = [];
      for (let i = 0; i < 70; i++) {
        const k = R() * COLS | 0, r = R() * ROWS | 0;
        moss.push([AX + k * CELL + rnd(R, 0, 40), AY + r * CELL + (R() < 0.5 ? 0 : 40) + rnd(R, -1, 1), rnd(R, 1, 2.4)]);
      }
      c.fillStyle = 'rgba(105,135,80,.3)'; zoned(c, moss, drawCirc(c));
      // charcos
      for (let i = 0; i < 5; i++) {
        const p = freeSpot(R, grid, 30, true); if (!p) continue;
        const rx = rnd(R, 12, 20), ry = rx * rnd(R, 0.45, 0.6);
        const pud = () => { c.beginPath(); ellP(c, p[0], p[1], rx, ry); ellP(c, p[0] + rx * 0.6, p[1] + ry * 0.4, rx * 0.55, ry * 0.7); };
        // borde húmedo más oscuro, agua y reflejo del techo
        c.save(); c.translate(0, 1); c.fillStyle = 'rgba(15,10,25,.35)'; pud(); c.fill(); c.restore();
        c.fillStyle = 'rgba(52,58,104,.75)'; pud(); c.fill();
        const wg = c.createLinearGradient(0, p[1] - ry, 0, p[1] + ry);
        wg.addColorStop(0, 'rgba(150,160,230,.28)'); wg.addColorStop(1, 'rgba(150,160,230,0)');
        c.fillStyle = wg; pud(); c.fill();
        c.strokeStyle = 'rgba(200,205,255,.45)'; c.lineWidth = 1.2; c.lineCap = 'round';
        c.beginPath(); c.ellipse(p[0] - rx * 0.15, p[1] - ry * 0.1, rx * 0.6, ry * 0.5, 0, Math.PI * 1.15, Math.PI * 1.55); c.stroke();
        fillEll(c, p[0] + rx * 0.35, p[1] + ry * 0.15, 2, 0.9, 'rgba(220,225,255,.45)');
      }
      // huesos y calaveras
      for (let i = 0; i < 16; i++) {
        const p = freeSpot(R, grid, 12, true); if (!p) continue;
        const a = rnd(R, 0, TAU), L = rnd(R, 5, 8), dx = Math.cos(a) * L, dy = Math.sin(a) * L * 0.7;
        const [x, y] = p;
        c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 2.6; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x - dx + 1, y - dy + 1.5); c.lineTo(x + dx + 1, y + dy + 1.5); c.stroke();
        c.strokeStyle = '#d6ccb6'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x - dx, y - dy); c.lineTo(x + dx, y + dy); c.stroke();
        c.fillStyle = '#e4dcc8'; c.beginPath();
        circP(c, x - dx + dy * 0.18, y - dy - dx * 0.18, 1.8); circP(c, x - dx - dy * 0.18, y - dy + dx * 0.18, 1.8);
        circP(c, x + dx + dy * 0.18, y + dy - dx * 0.18, 1.8); circP(c, x + dx - dy * 0.18, y + dy + dx * 0.18, 1.8);
        c.fill();
      }
      for (let i = 0; i < 4; i++) {
        const p = freeSpot(R, grid, 14, true); if (!p) continue;
        const [x, y] = p;
        fillEll(c, x + 1, y + 4, 6, 2.5, 'rgba(0,0,0,.3)');
        fillCirc(c, x, y, 5, '#ddd3bd'); c.fillStyle = '#ddd3bd'; c.fillRect(x - 3, y + 2, 6, 3.5);
        fillCirc(c, x - 2, y + 0.5, 1.4, '#2a2030'); fillCirc(c, x + 2, y + 0.5, 1.4, '#2a2030');
        fillCirc(c, x - 1.5, y - 2.5, 1.5, 'rgba(255,255,255,.4)');
      }
      // telarañas en las esquinas
      const web = (x, y, sx, sy, r) => {
        c.strokeStyle = 'rgba(225,215,245,.22)'; c.lineWidth = 0.8; c.beginPath();
        for (let k = 0; k <= 4; k++) { const a = k / 4 * Math.PI / 2; c.moveTo(x, y); c.lineTo(x + sx * Math.cos(a) * r, y + sy * Math.sin(a) * r); }
        for (let ring = 1; ring <= 3; ring++) {
          const rr = r * ring / 3.4;
          c.moveTo(x + sx * rr, y);
          for (let k = 1; k <= 4; k++) { const a = k / 4 * Math.PI / 2, m = (k - 0.5) / 4 * Math.PI / 2; c.quadraticCurveTo(x + sx * Math.cos(m) * rr * 0.8, y + sy * Math.sin(m) * rr * 0.8, x + sx * Math.cos(a) * rr, y + sy * Math.sin(a) * rr); }
        }
        c.stroke();
      };
      web(AX, AY, 1, 1, 38); web(AX + AW, AY, -1, 1, 34);
      web(AX, AY + AH, 1, -1, 26); web(AX + AW, AY + AH, -1, -1, 30);
    },
    threshold(c, R, d0, d1) {
      // alfombra raída delante de la puerta
      const x = d0 + 14, w = d1 - d0 - 28;
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + 2, AY + 2, w, 50);
      c.fillStyle = '#4a1f5e'; c.fillRect(x, AY, w, 48);
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x, AY, w, 10);
      c.strokeStyle = 'rgba(214,170,80,.5)'; c.lineWidth = 1.5; c.strokeRect(x + 4, AY + 3, w - 8, 41);
      c.fillStyle = 'rgba(214,170,80,.45)'; poly(c, [x + w / 2, AY + 16, x + w / 2 + 7, AY + 26, x + w / 2, AY + 36, x + w / 2 - 7, AY + 26]); c.fill();
      c.fillStyle = '#4a1f5e';
      for (let fx = x + 2; fx < x + w; fx += 4) c.fillRect(fx, AY + 48, 2, 3 + (R() * 2 | 0));
    },
    walls(c, R, d0, d1) {
      const yC = AY - 24;
      bricks(c, R, AX, yC, AW, 24, 8, 14, 26, '#1f1829', '#3e334c', 1);
      const g = c.createLinearGradient(0, yC, 0, AY);
      g.addColorStop(0, 'rgba(120,100,150,.10)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
      c.fillStyle = g; c.fillRect(AX, yC, AW, 24);
      c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1; c.beginPath();
      for (let i = 0; i < 6; i++) crackPath(c, R, rnd(R, AX + 10, AX + AW - 10), yC + rnd(R, 2, 10), 12, Math.PI / 2 + rnd(R, -0.5, 0.5));
      c.stroke();
      // estandartes
      for (const bx of [161, 379]) {
        const top = yC - 1, bw = 20, bh = 22;
        c.fillStyle = 'rgba(0,0,0,.35)'; poly(c, [bx - bw / 2 + 2, top + 2, bx + bw / 2 + 2, top + 2, bx + bw / 2 + 2, top + bh + 2, bx + 2, top + bh - 4, bx - bw / 2 + 2, top + bh + 2]); c.fill();
        c.fillStyle = '#4e2272'; poly(c, [bx - bw / 2, top, bx + bw / 2, top, bx + bw / 2, top + bh, bx, top + bh - 6, bx - bw / 2, top + bh]); c.fill();
        c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(bx - bw / 2, top, 4, bh - 1);
        c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(bx + bw / 2 - 4, top, 4, bh - 1);
        c.fillStyle = '#d9a441'; poly(c, [bx, top + 5, bx + 4.5, top + 10, bx, top + 15, bx - 4.5, top + 10]); c.fill();
        fillCirc(c, bx, top + 10, 1.6, '#4e2272');
        c.fillStyle = '#20172b'; c.fillRect(bx - bw / 2 - 2, top - 1.5, bw + 4, 3);
      }
      // remates de losa oscura
      const cap = '#514664';
      c.fillStyle = cap;
      c.fillRect(AX - 24, AY - 34, AW + 48, 10);
      c.fillRect(AX - 24, AY - 34, 24, AH + 58);
      c.fillRect(AX + AW, AY - 34, 24, AH + 58);
      c.fillRect(AX - 24, AY + AH, AW + 48, 24);
      capStones(c, R, AX - 24, AY - 34, AW + 48, 10, false, 26, 'rgba(20,14,28,.55)');
      capStones(c, R, AX - 24, AY - 24, 24, AH + 48, true, 26, 'rgba(20,14,28,.55)');
      capStones(c, R, AX + AW, AY - 24, 24, AH + 48, true, 26, 'rgba(20,14,28,.55)');
      capStones(c, R, AX, AY + AH, AW, 24, false, 30, 'rgba(20,14,28,.55)');
      this.capShade(c, '255,240,255', '0,0,0');
    },
    capShade(c, hi, lo) {
      // brillo en el canto interior de los remates y sombra en el exterior
      c.fillStyle = `rgba(${hi},.14)`;
      c.fillRect(AX - 24, AY - 34, AW + 48, 2);
      c.fillRect(AX - 3, AY - 24, 3, AH + 24);
      c.fillRect(AX - 24, AY + AH, AW + 48, 2);
      c.fillStyle = `rgba(${lo},.22)`;
      c.fillRect(AX + AW, AY - 24, 3, AH + 24);
      c.fillRect(AX - 24, AY - 25, AW + 48, 1.5);
      c.fillRect(AX - 24, AY + AH + 22, AW + 48, 2);
    },
    pillar: { face: '#5d5174', cap: '#776a92', line: '#1c1526' },
    groups: [['wall', 1]],
    singles: [['tomb', 0.45], ['column', 0.35], ['wall', 0.2]],
    props: {
      wall(c, x, y, nb, R) {
        const g = block(c, x, y, nb, { top: '#7d7296', front: '#43384f', edge: 'rgba(8,4,14,.8)' });
        // bisel de luz solo en el borde superior del grupo (un degradado por celda dejaba franjas en las juntas)
        if (!nb.u) {
          const tg = c.createLinearGradient(0, g.yT + 3, 0, g.yT + 16);
          tg.addColorStop(0, 'rgba(255,255,255,.09)'); tg.addColorStop(1, 'rgba(255,255,255,0)');
          const ix0 = g.x0 + (nb.l ? 0 : 2), ix1 = g.x1 - (nb.r ? 0 : 2);
          c.fillStyle = tg; c.fillRect(ix0, g.yT + 3, ix1 - ix0, 13);
        }
        // losas de la cara superior
        c.strokeStyle = 'rgba(30,22,45,.5)'; c.lineWidth = 1; c.beginPath();
        const mx = rnd(R, g.x0 + 12, g.x1 - 12);
        c.moveTo(mx, g.yT + 2); c.lineTo(mx, g.yTopEnd - 2);
        const my = rnd(R, g.yT + 12, g.yTopEnd - 12);
        c.moveTo(g.x0 + 2, my); c.lineTo(mx, my);
        c.stroke();
        if (!nb.d) {
          c.strokeStyle = 'rgba(10,6,16,.5)'; c.beginPath();
          const ym = (g.yF + g.yB) / 2;
          c.moveTo(g.x0 + 2, ym); c.lineTo(g.x1 - 2, ym);
          const bx = rnd(R, g.x0 + 8, g.x1 - 8);
          c.moveTo(bx, g.yF + 1); c.lineTo(bx, ym); c.moveTo(bx + (bx < x + 20 ? 12 : -12), ym); c.lineTo(bx + (bx < x + 20 ? 12 : -12), g.yB - 2);
          c.stroke();
        }
        clipTop(c, g);
        c.strokeStyle = 'rgba(15,10,22,.45)'; c.beginPath();
        if (R() < 0.6) crackPath(c, R, rnd(R, g.x0 + 6, g.x1 - 6), rnd(R, g.yT + 5, g.yTopEnd - 10), 12, rnd(R, 0, TAU));
        c.stroke(); c.restore();
        // vela encima (a veces)
        if (R() < 0.18) {
          const vx = rnd(R, g.x0 + 10, g.x1 - 10), vy = rnd(R, g.yT + 18, g.yTopEnd - 6);
          glow(c, vx, vy - 9, 13, '255,190,110', 0.3); // halo sin pasar de 16 px por encima
          fillEll(c, vx, vy, 4, 1.8, 'rgba(230,220,200,.7)');
          c.fillStyle = '#e9e2d2'; c.fillRect(vx - 2, vy - 9, 4, 9);
          fillEll(c, vx, vy - 12, 1.6, 3, '#ffcf6a'); fillEll(c, vx, vy - 11.5, 0.8, 1.6, '#fff6d8');
        } else if (R() < 0.15) { // calavera
          const sx = rnd(R, g.x0 + 9, g.x1 - 9), sy = rnd(R, g.yT + 9, g.yTopEnd - 6);
          fillCirc(c, sx, sy, 4.5, '#d9cfb8'); c.fillStyle = '#d9cfb8'; c.fillRect(sx - 2.8, sy + 2, 5.6, 3);
          fillCirc(c, sx - 1.8, sy + 0.5, 1.2, '#241b2e'); fillCirc(c, sx + 1.8, sy + 0.5, 1.2, '#241b2e');
        }
      },
      tomb(c, x, y, nb, R) {
        const cx = x + 20, base = y + 31;
        propShadow(c, cx, base + 1, 17, 6);
        // túmulo de tierra
        fillEll(c, cx, base, 17, 7, '#2e2433');
        fillEll(c, cx - 2, base - 1.5, 13, 4.5, '#3d3143');
        c.fillStyle = 'rgba(100,130,80,.5)'; c.beginPath();
        for (let i = 0; i < 6; i++) circP(c, cx + rnd(R, -14, 14), base + rnd(R, -2, 4), rnd(R, 1, 2));
        c.fill();
        const tilt = rnd(R, -0.08, 0.08);
        c.save(); c.translate(cx, base - 2); c.rotate(tilt);
        const lw = 12, top = -30, arcY = top + lw;
        const shape = (dy) => { c.beginPath(); c.moveTo(-lw, dy); c.lineTo(-lw, arcY + dy); c.arc(0, arcY + dy, lw, Math.PI, 0); c.lineTo(lw, dy); c.closePath(); };
        c.fillStyle = 'rgba(15,10,22,.75)';
        c.save(); c.translate(0, -1.5); c.scale(1.12, 1.06); shape(0); c.restore(); c.fill();
        // grosor visible por arriba
        c.fillStyle = '#c7c1d9'; shape(-3); c.fill();
        const gr = c.createLinearGradient(0, top, 0, 0);
        gr.addColorStop(0, '#a49eba'); gr.addColorStop(1, '#6f6987');
        c.fillStyle = gr; shape(0); c.fill();
        c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(-lw, arcY, 3, -arcY);
        c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(lw - 3, arcY, 3, -arcY);
        // cruz grabada
        c.fillStyle = 'rgba(40,30,55,.6)'; c.fillRect(-1.5, top + 7, 3, 15); c.fillRect(-6, top + 11, 12, 3);
        c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(1.5, top + 7, 0.8, 15); c.fillRect(-6, top + 14, 12, 0.8);
        c.strokeStyle = 'rgba(30,22,40,.5)'; c.lineWidth = 0.9; c.beginPath();
        crackPath(c, R, rnd(R, -8, 8), top + 4, 10, Math.PI / 2 + rnd(R, -0.6, 0.6)); c.stroke();
        c.fillStyle = 'rgba(100,135,80,.6)'; c.beginPath(); circP(c, -lw + 2, -2, 2.5); circP(c, -lw + 5, -1, 2); circP(c, lw - 3, -1.5, 1.8); c.fill();
        c.restore();
      },
      column(c, x, y, nb, R) {
        const cx = x + 20;
        propShadow(c, cx, y + 33, 17, 6);
        // plinto
        c.fillStyle = 'rgba(12,8,18,.7)'; rrPath(c, x + 2.5, y + 18.5, 35, 21, 3, 3, 4, 4); c.fill();
        c.fillStyle = '#5b5470'; rrPath(c, x + 4, y + 20, 32, 19, 2, 2, 3, 3); c.fill();
        c.fillStyle = '#8d87a6'; rrPath(c, x + 4, y + 20, 32, 9, 2, 2, 0, 0); c.fill();
        c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(x + 6, y + 21, 28, 1.5);
        // fuste roto
        const top = y - rnd(R, 6, 11), bot = y + 25, l = cx - 10, r = cx + 10;
        const jag = [r, top + rnd(R, 2, 7), cx + 4, top + rnd(R, 6, 10), cx - 1, top, cx - 6, top + rnd(R, 3, 7), l, top + rnd(R, 1, 5)];
        const path = () => { c.beginPath(); c.moveTo(l, bot); c.lineTo(r, bot); for (let i = 0; i < jag.length; i += 2) c.lineTo(jag[i], jag[i + 1]); c.closePath(); };
        c.fillStyle = 'rgba(12,8,18,.7)'; c.save(); c.translate(cx, bot); c.scale(1.14, 1.04); c.translate(-cx, -bot); path(); c.restore(); c.fill();
        const g = c.createLinearGradient(l, 0, r, 0);
        g.addColorStop(0, '#bdb7d2'); g.addColorStop(0.4, '#9690ae'); g.addColorStop(1, '#5f5978');
        c.fillStyle = g; path(); c.fill();
        c.strokeStyle = 'rgba(30,22,45,.3)'; c.lineWidth = 1; c.beginPath();
        for (const dx of [-5, 0, 5]) { c.moveTo(cx + dx, bot - 1); c.lineTo(cx + dx, top + 9); }
        c.stroke();
        // superficie de rotura
        c.fillStyle = '#d3cde4'; c.beginPath(); c.moveTo(l + 1, jag[9] + 1); c.lineTo(cx - 6, jag[7] + 1); c.lineTo(cx - 1, top + 1); c.lineTo(cx + 4, jag[3] + 1); c.lineTo(r - 1, jag[1] + 1); c.lineTo(cx + 2, top + 9); c.closePath(); c.fill();
        // cascotes
        for (let i = 0; i < 3; i++) {
          const px = x + rnd(R, 4, 36), py = y + rnd(R, 34, 37);
          fillEll(c, px, py, rnd(R, 2, 3.5), 1.8, '#7e7896'); fillEll(c, px - 0.6, py - 0.6, 1.2, 0.8, 'rgba(255,255,255,.25)');
        }
      }
    }
  };

  // ======================================================================
  //  CRISTAL
  // ======================================================================
  const CRY = [
    ['#e9fbff', '#3c9ad8', 'rgba(25,70,140,.32)', '120,220,255'],
    ['#f1e8ff', '#8564da', 'rgba(60,30,120,.32)', '190,160,255'],
    ['#e4fff7', '#2fa38d', 'rgba(15,80,70,.32)', '120,255,220']
  ];
  const cristal = {
    name: 'Gruta de cristal', dark: '#0a1322', accent: '#7fe0ff', ambient: 'snow',
    floor(c, R, grid) {
      checker(c, R, '#3f5878', '#3b5373', 0.06);
      // lajas de roca irregulares (canto inferior en sombra, superior con luz)
      const sh = new Map(), lt = new Map();
      const lts = ['rgba(190,225,255,.04)', 'rgba(190,225,255,.06)', 'rgba(190,225,255,.08)'];
      for (let r = 0; r < ROWS; r++) for (let k = 0; k < COLS; k++) {
        if (R() < 0.5) continue;
        const cx = AX + k * CELL + rnd(R, 12, 28), cy = AY + r * CELL + rnd(R, 12, 28);
        const n = 5 + (R() * 3 | 0), rx = rnd(R, 9, 15), ry = rx * rnd(R, 0.6, 0.85), pts = [], spts = [];
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU + rnd(R, -0.3, 0.3), m = rnd(R, 0.75, 1);
          const px = cx + Math.cos(a) * rx * m, py = cy + Math.sin(a) * ry * m;
          pts.push(px, py); spts.push(px + 1, py + 1.5);
        }
        bucket(sh, 'rgba(10,20,40,.16)').push(spts);
        bucket(lt, pick(R, lts)).push(pts);
      }
      flushPolys(c, sh); flushPolys(c, lt);
      softPatches(c, R, 5, '160,220,255', 50, 90);
      softPatches(c, R, 4, '0,10,30', 50, 85);
      speckles(c, R, 260, 'rgba(10,20,40,.18)', 2);
      speckles(c, R, 200, 'rgba(210,240,255,.10)', 2);
      // escarcha
      for (let i = 0; i < 12; i++) {
        const p = freeSpot(R, grid, 20, true); if (!p) continue;
        c.fillStyle = 'rgba(215,240,255,.10)'; c.beginPath();
        for (let k = 0; k < 5; k++) ellP(c, p[0] + rnd(R, -18, 18), p[1] + rnd(R, -9, 9), rnd(R, 8, 16), rnd(R, 5, 9));
        c.fill();
        c.strokeStyle = 'rgba(220,245,255,.22)'; c.lineWidth = 0.8; c.beginPath();
        for (let k = 0; k < 3; k++) crackPath(c, R, p[0] + rnd(R, -10, 10), p[1] + rnd(R, -5, 5), rnd(R, 8, 14), rnd(R, 0, TAU));
        c.stroke();
      }
      // grietas heladas
      const icr = [];
      for (let i = 0; i < 12; i++) { const p = freeSpot(R, grid, 10, true); if (p) icr.push(...crackLines(R, p[0], p[1], rnd(R, 14, 26), rnd(R, 0, TAU))); }
      c.strokeStyle = 'rgba(160,220,255,.2)'; c.lineWidth = 1;
      zoned(c, icr, drawLines(c), true);
      // esquirlas sueltas y destellos
      for (let i = 0; i < 16; i++) {
        const p = freeSpot(R, grid, 10, true); if (!p) continue;
        const [x, y] = p, s = rnd(R, 3, 5), cc = R() < 0.75 ? CRY[0] : CRY[1];
        fillEll(c, x + 1, y + 1, s, s * 0.4, 'rgba(0,10,30,.3)');
        c.fillStyle = cc[1]; poly(c, [x - s * 0.5, y, x, y - s * 1.6, x + s * 0.5, y]); c.fill();
        c.fillStyle = cc[0]; poly(c, [x - s * 0.5, y, x, y - s * 1.6, x, y]); c.fill();
      }
      for (let i = 0; i < 26; i++) { const p = freeSpot(R, grid, 6, false); if (p) sparkle(c, p[0], p[1], rnd(R, 1.5, 3), 'rgba(235,250,255,.55)'); }
      // nieve acumulada junto a los muros
      // (x,y,w,h) zona; (gx0,gy0)->(gx1,gy1) del muro hacia dentro
      const sn = (x, y, w, h, gx0, gy0, gx1, gy1) => { const g = c.createLinearGradient(gx0, gy0, gx1, gy1); g.addColorStop(0, 'rgba(225,242,255,.26)'); g.addColorStop(1, 'rgba(225,242,255,0)'); c.fillStyle = g; c.fillRect(x, y, w, h); };
      sn(AX, AY, 16, AH, AX, 0, AX + 16, 0);
      sn(AX + AW - 16, AY, 16, AH, AX + AW, 0, AX + AW - 16, 0);
      sn(AX, AY + AH - 14, AW, 14, 0, AY + AH, 0, AY + AH - 14);
    },
    threshold(c, R, d0, d1) {
      c.fillStyle = 'rgba(200,235,255,.08)';
      rrPath(c, d0 + 8, AY + 2, d1 - d0 - 16, 44, 4, 4, 14, 14); c.fill();
      c.strokeStyle = 'rgba(200,235,255,.16)'; c.lineWidth = 1; c.stroke();
    },
    walls(c, R, d0, d1) {
      const yC = AY - 24;
      c.fillStyle = '#1d2d4a'; c.fillRect(AX, yC, AW, 24);
      // piedras irregulares
      for (let row = 0; row < 2; row++) {
        let x = AX - rnd(R, 0, 12);
        const y = yC + row * 12;
        while (x < AX + AW) {
          const w = rnd(R, 14, 32);
          const v = R();
          c.fillStyle = v < 0.5 ? '#3a5884' : '#34507a';
          const bx = Math.max(x, AX), bw = Math.min(x + w, AX + AW) - bx - 1.5;
          if (bw > 2) {
            rrPath(c, bx + 0.75, y + 0.75, bw, 10.5, 4, 3, 4, 3); c.fill();
            c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(bx + 2, y + 1.5, bw - 4, 1.5);
          }
          x += w;
        }
      }
      const g = c.createLinearGradient(0, yC, 0, AY);
      g.addColorStop(0, 'rgba(200,235,255,.14)'); g.addColorStop(1, 'rgba(0,0,10,.35)');
      c.fillStyle = g; c.fillRect(AX, yC, AW, 24);
      // cristales incrustados
      for (const cx of [150, 190, 350, 392, 480]) {
        if (R() < 0.3 || nearTorch(cx, 18)) continue;
        const cc = pick(R, CRY);
        glow(c, cx, AY - 10, 14, cc[3], 0.3);
        shard(c, cx, AY - 3, 6, rnd(R, 12, 17), rnd(R, -2, 2), cc[0], cc[1], cc[2], 'rgba(10,30,60,.5)');
      }
      // remate de nieve: base continua + bordes ondulados hacia la sala
      c.fillStyle = '#b4cde8';
      c.fillRect(AX - 24, AY - 34, AW + 48, 10);
      c.fillRect(AX - 24, AY - 34, 24, AH + 58);
      c.fillRect(AX + AW, AY - 34, 24, AH + 58);
      c.fillRect(AX - 24, AY + AH, AW + 48, 24);
      // ondulaciones suaves de la nieve (luces y sombras de bajo contraste)
      const capPt = () => {
        const s = R();
        if (s < 0.4) return [rnd(R, AX - 22, AX - 2), rnd(R, AY - 30, AY + AH + 22)];
        if (s < 0.8) return [rnd(R, AX + AW + 2, AX + AW + 22), rnd(R, AY - 30, AY + AH + 22)];
        return [rnd(R, AX - 20, AX + AW + 20), R() < 0.4 ? rnd(R, AY - 32, AY - 26) : rnd(R, AY + AH + 3, AY + AH + 21)];
      };
      const ells = (n, dx, dy, a0, a1, b0, b1) => { const a = []; for (let i = 0; i < n; i++) { const [x, y] = capPt(); a.push([x + dx, y + dy, rnd(R, a0, a1), rnd(R, b0, b1)]); } return a; };
      c.fillStyle = 'rgba(70,105,155,.16)'; zoned(c, ells(160, 1, 2, 4, 7, 2.5, 4), drawEll(c));
      c.fillStyle = 'rgba(235,245,255,.5)'; zoned(c, ells(160, 0, 0, 3, 6, 2, 3.5), drawEll(c));
      c.fillStyle = 'rgba(70,100,145,.7)'; zoned(c, ells(18, 0, 0, 1.5, 3, 1, 2), drawEll(c));
      const edgeBumps = [];
      for (let x = AX - 22; x < AX + AW + 24; x += rnd(R, 5, 8)) edgeBumps.push([x, AY - 24 + rnd(R, -1, 1.5), rnd(R, 3, 5)]);
      for (let y = AY - 20; y < AY + AH + 4; y += rnd(R, 5, 8)) { edgeBumps.push([AX + rnd(R, -1, 1.5), y, rnd(R, 3, 5)]); edgeBumps.push([AX + AW - rnd(R, -1, 1.5), y, rnd(R, 3, 5)]); }
      for (let x = AX; x < AX + AW; x += rnd(R, 5, 8)) edgeBumps.push([x, AY + AH + rnd(R, -1, 1), rnd(R, 3, 4.5)]);
      c.fillStyle = '#93b6dc'; zoned(c, edgeBumps.map(([x, y, r]) => [x + 0.8, y + 1.8, r]), drawCirc(c));
      c.fillStyle = '#d9ebfb'; zoned(c, edgeBumps, drawCirc(c));
      c.fillStyle = 'rgba(255,255,255,.8)'; zoned(c, edgeBumps.filter(() => R() < 0.4).map(([x, y, r]) => [x - r * 0.35, y - r * 0.35, r * 0.4]), drawCirc(c));
      c.fillStyle = 'rgba(255,255,255,.7)';
      c.fillRect(AX - 24, AY - 34, AW + 48, 2);
      // carámbanos
      for (let x = AX + 6; x < AX + AW - 4; x += rnd(R, 7, 16)) {
        if (nearTorch(x, 14) || (x > d0 - 12 && x < d1 + 12)) continue;
        const len = rnd(R, 5, 13), w = rnd(R, 2, 3.5);
        c.fillStyle = 'rgba(225,245,255,.85)'; poly(c, [x - w, yC, x + w, yC, x + rnd(R, -0.5, 0.5), yC + len]); c.fill();
        c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(x - w + 0.5, yC, 1, len * 0.5);
      }
      cripta.capShade(c, '255,255,255', '0,10,30');
    },
    pillar: { face: '#4d6d9a', cap: '#e1f0ff', line: '#1a2a45' },
    groups: [['rock', 1]],
    singles: [['crystal', 0.6], ['ice', 0.2], ['rock', 0.2]],
    props: {
      rock(c, x, y, nb, R) {
        const g = block(c, x, y, nb, { top: '#4d6c96', front: '#2e4568', edge: 'rgba(6,14,30,.7)' });
        clipTop(c, g);
        c.strokeStyle = 'rgba(15,28,50,.4)'; c.lineWidth = 1; c.beginPath();
        crackPath(c, R, rnd(R, g.x0 + 8, g.x1 - 8), rnd(R, g.yT + 8, g.yTopEnd - 8), 14, rnd(R, 0, TAU)); c.stroke();
        c.restore();
        // capa de nieve continua en el borde superior del grupo
        if (!nb.u) {
          const yb = g.yT + rnd(R, 10, 15), scal = [];
          for (let bx = g.x0 + 2; bx < g.x1 + 1; bx += 5) {
            const rr = rnd(R, 3, 4.5), by = yb + rnd(R, -2, 2);
            if (bx - rr >= g.x0 - (nb.l ? 3 : 0) && bx + rr + 0.5 <= g.x1 + (nb.r ? 3 : 0)) scal.push([bx, by, rr]);
          }
          c.fillStyle = '#9dbfe3'; c.beginPath();
          for (const [bx, by, rr] of scal) circP(c, bx + 0.5, by + 1.5, rr);
          c.fill();
          c.fillStyle = '#dcedfc'; rrPath(c, g.x0, g.yT, g.w, yb - g.yT, g.tl, g.tr, 0, 0); c.fill();
          c.beginPath();
          for (const [bx, by, rr] of scal) circP(c, bx, by, rr);
          c.fill();
          c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(g.x0 + g.tl, g.yT + 1, g.w - g.tl - g.tr, 2);
        }
        if (!nb.d) {
          for (let k = 0; k < 2; k++) {
            const ix = rnd(R, g.x0 + 5, g.x1 - 5), len = rnd(R, 4, 8);
            c.fillStyle = 'rgba(220,240,255,.8)'; poly(c, [ix - 2, g.yF + 1, ix + 2, g.yF + 1, ix, g.yF + 1 + len]); c.fill();
          }
        }
        if (R() < 0.35) { // esquirla que asoma
          const cc = pick(R, CRY), sx = rnd(R, g.x0 + 9, g.x1 - 9), sy = rnd(R, g.yT + 16, g.yTopEnd - 4);
          glow(c, sx, sy - 6, 12, cc[3], 0.3);
          shard(c, sx, sy, 7, Math.min(16, sy - (y - 16)), rnd(R, -2, 2), cc[0], cc[1], cc[2], 'rgba(10,30,60,.5)');
        }
      },
      ice(c, x, y, nb, R) {
        const g = block(c, x, y, nb, { top: '#bfe4fa', front: '#6ea6d2', edge: 'rgba(15,45,85,.6)' });
        c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1; c.beginPath();
        c.moveTo(g.x0 + 6, g.yT + 8); c.lineTo(g.x0 + 14, g.yT + 4);
        c.moveTo(g.x0 + 6, g.yT + 14); c.lineTo(g.x0 + 22, g.yT + 5);
        c.stroke();
        clipTop(c, g);
        c.strokeStyle = 'rgba(60,120,180,.4)'; c.beginPath();
        crackPath(c, R, rnd(R, g.x0 + 12, g.x1 - 12), rnd(R, g.yT + 12, g.yTopEnd - 10), 14, rnd(R, 0, TAU)); c.stroke();
        c.restore();
        sparkle(c, rnd(R, g.x0 + 8, g.x1 - 8), rnd(R, g.yT + 6, g.yTopEnd - 6), 3, 'rgba(255,255,255,.9)');
        fillEll(c, (g.x0 + g.x1) / 2, (g.yT + g.yTopEnd) / 2 + 3, 9, 6, 'rgba(120,200,255,.25)');
      },
      crystal(c, x, y, nb, R) {
        const cc = R() < 0.7 ? CRY[0] : pick(R, CRY);
        const cx = x + 20;
        glow(c, cx, y + 16, 24, cc[3], 0.24); // halo dentro de la celda (±4 px)
        propShadow(c, cx, y + 33, 17, 6);
        // base de roca
        c.fillStyle = 'rgba(8,16,32,.7)'; c.beginPath(); ellP(c, cx, y + 31, 18.5, 8.5); c.fill();
        c.fillStyle = '#2c4366'; c.beginPath(); ellP(c, cx, y + 31, 17, 7.5); c.fill();
        c.fillStyle = '#425f8a'; c.beginPath(); ellP(c, cx - 2, y + 29, 13, 5); c.fill();
        // esquirlas: de atrás hacia delante
        const list = [
          [cx + 9 + rnd(R, -1, 1), y + 30, 11, rnd(R, 24, 30), rnd(R, 3, 6)],
          [cx - 9 + rnd(R, -1, 1), y + 30, 11, rnd(R, 22, 28), rnd(R, -6, -3)],
          [cx + rnd(R, -2, 2), y + 31, 15, rnd(R, 40, 46), rnd(R, -2, 2)],
          [cx + rnd(R, 6, 9), y + 35, 7, rnd(R, 11, 15), rnd(R, 2, 4)],
          [cx - rnd(R, 7, 10), y + 35, 6, rnd(R, 9, 12), rnd(R, -3, -1)]
        ];
        c.globalAlpha = 0.93;
        for (const [bx, by, w, h, lean] of list) shard(c, bx, by, w, Math.min(h, by - (y - 16)), lean, cc[0], cc[1], cc[2], 'rgba(10,30,60,.55)');
        c.globalAlpha = 1;
        sparkle(c, cx + list[2][4] - 2, y - 2, 3.5, 'rgba(255,255,255,.95)');
        sparkle(c, cx - 10, y + 14, 2.2, 'rgba(255,255,255,.8)');
      }
    }
  };

  // ======================================================================
  //  VOLCÁN
  // ======================================================================
  // Veta incandescente en 3 pasadas (halo, cuerpo, núcleo) sobre polilíneas precalculadas
  function lavaStroke(c, lines, wide) {
    if (!lines.length) return;
    c.lineCap = 'round'; c.lineJoin = 'round';
    const d = drawLines(c);
    c.strokeStyle = 'rgba(255,80,20,.16)'; c.lineWidth = wide; zoned(c, lines, d, true);
    c.strokeStyle = 'rgba(255,115,35,.6)'; c.lineWidth = wide * 0.38; zoned(c, lines, d, true);
    c.strokeStyle = '#ffd27a'; c.lineWidth = Math.max(0.8, wide * 0.14); zoned(c, lines, d, true);
  }
  const volcan = {
    name: 'Corazón volcánico', dark: '#170908', accent: '#ff8f45', ambient: 'embers',
    floor(c, R, grid) {
      c.fillStyle = '#1e1618'; c.fillRect(AX, AY, AW, AH);
      // columnas de basalto hexagonales vistas desde arriba
      const hr = 22, hw = Math.sqrt(3) * hr, vs = 1.5 * hr;
      const shades = ['#3b3133', '#372d30', '#3f3437', '#342a2d'];
      const tops = [-0.1, 0.035, 0.05, 0.065];
      const base = new Map(), over = new Map(), hi = [];
      for (let row = 0, y = AY - hr * 0.5; y < AY + AH + hr; row++, y += vs) {
        for (let x = AX - (row & 1 ? hw / 2 : 0); x < AX + AW + hw; x += hw) {
          const pts = [], sh = pick(R, shades);
          for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; pts.push(x + Math.cos(a) * (hr - 1.6) + rnd(R, -1, 1), y + Math.sin(a) * (hr - 1.6) + rnd(R, -1, 1)); }
          bucket(base, sh).push(pts);
          // cara superior algo más clara y desplazada arriba: canto inferior en sombra
          const top = [];
          for (let i = 0; i < 12; i += 2) top.push(x + (pts[i] - x) * 0.8, y - 1.5 + (pts[i + 1] - y) * 0.8);
          bucket(over, mix(sh, pick(R, tops))).push(top);
          hi.push(x - hr * 0.45, y - hr * 0.86, hr * 0.9, 1.2);
        }
      }
      flushPolys(c, base); flushPolys(c, over);
      flushRects(c, new Map([['rgba(255,230,220,.07)', hi]]));
      softPatches(c, R, 4, '255,90,30', 50, 90);
      softPatches(c, R, 4, '0,0,0', 50, 85);
      // ceniza
      speckles(c, R, 320, 'rgba(190,180,180,.10)', 2.2);
      speckles(c, R, 200, 'rgba(0,0,0,.25)', 2);
      for (let i = 0; i < 8; i++) {
        const p = freeSpot(R, grid, 20, true); if (!p) continue;
        c.fillStyle = 'rgba(150,140,140,.10)'; c.beginPath();
        for (let k = 0; k < 4; k++) ellP(c, p[0] + rnd(R, -16, 16), p[1] + rnd(R, -8, 8), rnd(R, 8, 16), rnd(R, 5, 9));
        c.fill();
      }
      // grietas de lava (pocas y finas para no confundir con balas)
      const cracks = [];
      for (let i = 0; i < 9; i++) {
        const p = freeSpot(R, grid, 30, true); if (!p) continue;
        const pts = [p[0], p[1]]; let a = rnd(R, 0, TAU), x = p[0], y = p[1];
        const n = 4 + (R() * 4 | 0);
        for (let k = 0; k < n; k++) {
          a += rnd(R, -0.8, 0.8); x += Math.cos(a) * rnd(R, 8, 15); y += Math.sin(a) * rnd(R, 8, 15);
          if (x < AX + 6 || x > AX + AW - 6 || y < AY + 6 || y > AY + AH - 6) break;
          pts.push(x, y);
        }
        cracks.push(pts);
      }
      for (const pts of cracks) glow(c, pts[0], pts[1], 26, '255,100,30', 0.13);
      lavaStroke(c, cracks, 6);
      // ascuas quietas
      const emb = [];
      for (let i = 0; i < 26; i++) { const p = freeSpot(R, grid, 6, true); if (p) emb.push([p[0], p[1], rnd(R, 0.6, 1.3)]); }
      c.fillStyle = 'rgba(255,150,60,.55)'; zoned(c, emb, drawCirc(c));
      // rocas pequeñas
      for (let i = 0; i < 10; i++) {
        const p = freeSpot(R, grid, 8, true); if (!p) continue;
        const rx = rnd(R, 2.5, 4.5);
        fillEll(c, p[0] + 1, p[1] + 1.5, rx, rx * 0.6, 'rgba(0,0,0,.35)');
        fillEll(c, p[0], p[1], rx, rx * 0.65, '#3d3236');
        fillEll(c, p[0] - rx * 0.3, p[1] - rx * 0.25, rx * 0.45, rx * 0.25, 'rgba(255,220,210,.2)');
      }
    },
    threshold(c, R, d0, d1) {
      glow(c, (d0 + d1) / 2, AY + 4, 60, '255,120,40', 0.1);
    },
    walls(c, R, d0, d1) {
      const yC = AY - 24;
      c.fillStyle = '#140807'; c.fillRect(AX, yC, AW, 24);
      const seams = [];
      for (let row = 0; row < 2; row++) {
        let x = AX - rnd(R, 0, 12);
        const y = yC + row * 12;
        while (x < AX + AW) {
          const w = rnd(R, 12, 30);
          const bx = Math.max(x, AX), bw = Math.min(x + w, AX + AW) - bx - 2;
          if (bw > 2) {
            c.fillStyle = R() < 0.5 ? '#3d201c' : '#361b18';
            const j = () => rnd(R, -1, 1);
            poly(c, [bx + 1 + j(), y + 1 + j(), bx + bw + j(), y + 1.5 + j(), bx + bw + 0.5, y + 10.5 + j(), bx + 1, y + 11 + j()]); c.fill();
            c.fillStyle = 'rgba(255,200,170,.07)'; c.fillRect(bx + 2, y + 2, bw - 3, 1.5);
            if (R() < 0.18) seams.push([bx + bw + 1, y, row]);
          }
          x += w;
        }
      }
      const g = c.createLinearGradient(0, yC, 0, AY);
      g.addColorStop(0, 'rgba(0,0,0,.15)'); g.addColorStop(0.7, 'rgba(0,0,0,.2)'); g.addColorStop(1, 'rgba(255,90,30,.18)');
      c.fillStyle = g; c.fillRect(AX, yC, AW, 24);
      // juntas incandescentes y goteos de lava
      const sl = [];
      for (const [sx, sy] of seams) { if (nearTorch(sx, 14) || (sx > d0 - 10 && sx < d1 + 10)) continue; sl.push([sx, sy + 1, sx + rnd(R, -1, 1), sy + 10]); }
      lavaStroke(c, sl, 4);
      const drips = [];
      for (const dx of [150, 186, 356, 396, 478]) {
        if (R() < 0.4 || nearTorch(dx, 18)) continue;
        drips.push([dx, yC, dx + rnd(R, -1, 1), yC + rnd(R, 8, 18)]);
      }
      lavaStroke(c, drips, 4.5);
      for (const d of drips) fillCirc(c, d[2], d[3] + 1, 1.8, '#ffb347');
      // remates de roca negra
      c.fillStyle = '#2a1614';
      c.fillRect(AX - 24, AY - 34, AW + 48, 10);
      c.fillRect(AX - 24, AY - 34, 24, AH + 58);
      c.fillRect(AX + AW, AY - 34, 24, AH + 58);
      c.fillRect(AX - 24, AY + AH, AW + 48, 24);
      capStones(c, R, AX - 24, AY - 34, AW + 48, 10, false, 22, 'rgba(0,0,0,.55)');
      capStones(c, R, AX - 24, AY - 24, 24, AH + 48, true, 24, 'rgba(0,0,0,.55)');
      capStones(c, R, AX + AW, AY - 24, 24, AH + 48, true, 24, 'rgba(0,0,0,.55)');
      capStones(c, R, AX, AY + AH, AW, 24, false, 26, 'rgba(0,0,0,.55)');
      c.fillStyle = 'rgba(180,160,160,.10)';
      for (let i = 0; i < 260; i++) {
        const side = R();
        const x = side < 0.33 ? rnd(R, AX - 23, AX - 1) : side < 0.66 ? rnd(R, AX + AW + 1, AX + AW + 23) : rnd(R, AX - 23, AX + AW + 23);
        const y = side < 0.66 ? rnd(R, AY - 33, AY + AH + 23) : (R() < 0.5 ? rnd(R, AY - 33, AY - 25) : rnd(R, AY + AH + 1, AY + AH + 23));
        c.fillRect(x, y, 1.6, 1.6);
      }
      // vetas de lava en los remates laterales
      const vl = [];
      for (let i = 0; i < 7; i++) {
        const left = R() < 0.5, x = left ? AX - rnd(R, 7, 17) : AX + AW + rnd(R, 7, 17), y = rnd(R, AY + 20, AY + AH - 20);
        vl.push([x, y, x + rnd(R, -3, 3), y + rnd(R, 8, 14), x + rnd(R, -3, 3), y + rnd(R, 16, 26)]);
      }
      lavaStroke(c, vl, 4);
      cripta.capShade(c, '255,150,110', '0,0,0');
    },
    pillar: { face: '#4a2621', cap: '#5e322b', line: '#0d0505' },
    groups: [['basalt', 1]],
    singles: [['obsidian', 0.55], ['spikes', 0.25], ['basalt', 0.2]],
    props: {
      basalt(c, x, y, nb, R) {
        const g = block(c, x, y, nb, { top: '#2a1f29', front: '#120c11', edge: 'rgba(0,0,0,.85)' });
        // facetas sutiles de obsidiana
        c.fillStyle = 'rgba(150,120,170,.10)';
        poly(c, [g.x0 + 3, g.yT + 3, g.x0 + rnd(R, 14, 24), g.yT + 3, g.x0 + 3, g.yT + rnd(R, 14, 22)]); c.fill();
        if (!nb.d) { c.fillStyle = 'rgba(255,120,60,.16)'; c.fillRect(g.x0 + 2, g.yB - 3, g.w - 4, 1.5); }
        // vetas de lava (recortadas a su cara para que no se derramen al suelo)
        const vt = R() < 0.6 ? crackLines(R, rnd(R, g.x0 + 10, g.x1 - 10), rnd(R, g.yT + 10, g.yTopEnd - 10), 14, rnd(R, 0, TAU)) : [];
        if (vt.length) { clipTop(c, g); lavaStroke(c, vt, 4); c.restore(); }
        if (!nb.d && R() < 0.7) {
          const vx = rnd(R, g.x0 + 6, g.x1 - 6);
          clipFront(c, g); lavaStroke(c, [[vx, g.yF + 1, vx + rnd(R, -3, 3), g.yB - 3]], 4); c.restore();
        }
        c.fillStyle = 'rgba(200,180,180,.12)'; c.beginPath();
        for (let i = 0; i < 14; i++) c.rect(rnd(R, g.x0 + 2, g.x1 - 3), rnd(R, g.yT + 2, g.yTopEnd - 3), 1.6, 1.6);
        c.fill();
      },
      obsidian(c, x, y, nb, R) {
        const cx = x + 20;
        glow(c, cx, y + 22, 22, '255,100,30', 0.17);
        propShadow(c, cx, y + 33, 17, 6);
        const j = () => rnd(R, -2, 2);
        const p = [x + 2 + j(), y + 30 + j(), x + 4 + j(), y + 12 + j(), x + 13 + j(), y - 7 + j(), x + 25 + j(), y - 10 + Math.abs(j()),
          x + 35 + j(), y + 4 + j(), x + 38, y + 24 + j(), x + 31 + j(), y + 38, x + 9 + j(), y + 38];
        const ccx = cx + j(), ccy = y + 12 + j();
        c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineJoin = 'round';
        poly(c, p); c.stroke(); c.fillStyle = '#1b141c'; c.fill();
        // facetas (luz arriba-izquierda): cada una es un abanico desde el centro
        const P2 = i => [p[i * 2], p[i * 2 + 1]];
        const fan = (ids, col) => { const pts = [ccx, ccy]; for (const i of ids) pts.push(...P2(i)); c.fillStyle = col; poly(c, pts); c.fill(); };
        fan([1, 2, 3], '#4a3b52');
        fan([3, 4, 5], '#30253a');
        fan([0, 1], '#3a2e42');
        fan([5, 6], '#1a131d');
        fan([6, 7, 0], '#241c29');
        c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(p[2], p[3]); c.lineTo(p[4], p[5]); c.lineTo(p[6], p[7]); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.moveTo(p[4], p[5]); c.lineTo(ccx, ccy); c.lineTo(p[10], p[11]); c.moveTo(ccx, ccy); c.lineTo(p[0], p[1]); c.stroke();
        // vetas incandescentes
        let vx = rnd(R, x + 12, x + 28), vy = y + 36;
        const main = [vx, vy], vl = [main];
        for (let k = 0; k < 3; k++) { vx += rnd(R, -5, 5); vy -= rnd(R, 6, 10); main.push(vx, vy); }
        if (R() < 0.6) vl.push([vx, vy + 8, vx + rnd(R, 6, 10), vy + rnd(R, 2, 6)]);
        lavaStroke(c, vl, 5);
      },
      spikes(c, x, y, nb, R) {
        const cx = x + 20;
        glow(c, cx, y + 22, 22, '255,100,30', 0.2);
        propShadow(c, cx, y + 33, 17, 6);
        fillEll(c, cx, y + 31, 17, 7.5, '#130d10');
        fillEll(c, cx - 2, y + 29.5, 13, 4.5, '#2a2027');
        const list = [
          [cx + 9, y + 30, 9, rnd(R, 20, 26), rnd(R, 3, 6)],
          [cx - 9, y + 30, 9, rnd(R, 18, 24), rnd(R, -6, -3)],
          [cx + rnd(R, -2, 2), y + 32, 12, rnd(R, 36, 44), rnd(R, -2, 2)],
          [cx - 7, y + 36, 6, rnd(R, 9, 12), -2]
        ];
        for (const [bx, by, w, h, lean] of list) shard(c, bx, by, w, Math.min(h, by - (y - 16)), lean, '#5c4866', '#140f16', 'rgba(0,0,0,.35)', 'rgba(0,0,0,.7)');
        lavaStroke(c, [[cx - 4, y + 34, cx - 1, y + 26, cx + 3, y + 30, cx + 6, y + 22]], 4);
        const m = list[2], tipY = m[1] - Math.min(m[3], m[1] - (y - 16));
        glow(c, m[0] + m[4], tipY + 2, 7, '255,160,60', 0.5);
      }
    }
  };

  const BIOMES = { pradera, cripta, cristal, volcan };
  const LIST = ['pradera', 'cripta', 'cristal', 'volcan'];

  // ---------- render ----------
  function components(grid) {
    const comp = new Int16Array(COLS * ROWS).fill(-1), sizes = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      if (grid[i] !== 1 || comp[i] >= 0) continue;
      const id = sizes.length, st = [i]; comp[i] = id; let n = 0;
      while (st.length) {
        const j = st.pop(); n++;
        const r = j / COLS | 0, k = j % COLS;
        const nbrs = [k > 0 ? j - 1 : -1, k < COLS - 1 ? j + 1 : -1, r > 0 ? j - COLS : -1, r < ROWS - 1 ? j + COLS : -1];
        for (const q of nbrs) if (q >= 0 && grid[q] === 1 && comp[q] < 0) { comp[q] = id; st.push(q); }
      }
      sizes.push(n);
    }
    return { comp, sizes };
  }
  function weighted(R, list) {
    let t = R() * list.reduce((s, e) => s + e[1], 0);
    for (const [k, w] of list) { t -= w; if (t <= 0) return k; }
    return list[list.length - 1][0];
  }

  function runeCircle(c) {
    const cx = SPAWN_X, cy = SPAWN_Y;
    c.strokeStyle = 'rgba(199,125,255,.2)'; c.lineWidth = 2;
    c.beginPath(); c.arc(cx, cy, 42, 0, TAU); c.stroke();
    c.beginPath(); c.arc(cx, cy, 32, 0, TAU); c.stroke();
    c.beginPath();
    for (let i = 0; i <= 5; i++) {
      const a = -Math.PI / 2 + i * TAU * 2 / 5;
      c[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * 32, cy + Math.sin(a) * 32);
    }
    c.stroke();
    c.fillStyle = 'rgba(199,125,255,.18)';
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + 0.2; c.fillRect(cx + Math.cos(a) * 37 - 1.5, cy + Math.sin(a) * 37 - 1.5, 3, 3); }
  }

  function render(opts) {
    opts = opts || {};
    const B = BIOMES[opts.biome] || pradera;
    const id = BIOMES[opts.biome] ? opts.biome : 'pradera';
    const scale = opts.scale > 0 ? opts.scale : 1;
    const grid = opts.grid || new Uint8Array(COLS * ROWS);
    const d0 = opts.doorX0 != null ? opts.doorX0 : AX + AW / 2 - 50;
    const d1 = opts.doorX1 != null ? opts.doorX1 : AX + AW / 2 + 50;
    const seed = ((opts.seed | 0) ^ hashStr(id)) >>> 0;

    const cv = document.createElement('canvas');
    cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
    const c = cv.getContext('2d');
    c.setTransform(scale, 0, 0, scale, 0, 0);
    // fondo oscuro solo fuera de la arena (el suelo la cubre entera)
    c.fillStyle = B.dark;
    c.fillRect(0, 0, W, AY); c.fillRect(0, AY + AH, W, H - AY - AH);
    c.fillRect(0, AY, AX, AH); c.fillRect(AX + AW, AY, W - AX - AW, AH);

    // suelo (semilla propia: no cambia con los obstáculos más de lo necesario)
    c.save();
    c.beginPath(); c.rect(AX, AY, AW, AH); c.clip();
    B.floor(c, mulberry32(seed), grid);
    B.threshold(c, mulberry32(seed + 7), d0, d1);
    // viñeta suave: la luz cae arriba-izquierda (centro desplazado)
    const vg = c.createRadialGradient(AX + AW * 0.45, AY + AH * 0.46, 210, AX + AW / 2, AY + AH / 2, 560);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.26)');
    c.fillStyle = vg; c.fillRect(AX, AY, AW, AH);
    // oclusión junto a los muros
    let g = c.createLinearGradient(0, AY, 0, AY + 30);
    g.addColorStop(0, 'rgba(0,0,0,.38)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(AX, AY, AW, 30);
    g = c.createLinearGradient(AX, 0, AX + 16, 0);
    g.addColorStop(0, 'rgba(0,0,0,.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(AX, AY, 16, AH);
    g = c.createLinearGradient(AX + AW, 0, AX + AW - 10, 0);
    g.addColorStop(0, 'rgba(0,0,0,.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(AX + AW - 10, AY, 10, AH);
    g = c.createLinearGradient(0, AY + AH, 0, AY + AH - 10);
    g.addColorStop(0, 'rgba(0,0,0,.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(AX, AY + AH - 10, AW, 10);
    runeCircle(c);
    c.restore();

    // muros (la cara frontal del superior queda detrás de los obstáculos de la fila 0)
    const RW = mulberry32(seed + 13);
    B.walls(c, RW, d0, d1);
    // puerta: hueco oscuro + pilares
    c.fillStyle = '#0c0914'; c.fillRect(d0, AY - 34, d1 - d0, 34);
    const P = B.pillar;
    for (const px of [d0 - 10, d1 + 1]) {
      c.fillStyle = P.line; c.fillRect(px - 1, AY - 39, 11, 40);
      c.fillStyle = P.face; c.fillRect(px, AY - 30, 9, 30);
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(px, AY - 8, 9, 8);
      c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(px, AY - 30, 2, 22);
      c.fillStyle = P.cap; c.fillRect(px, AY - 38, 9, 8);
      c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(px, AY - 38, 9, 1.5);
    }

    // obstáculos
    const RO = mulberry32(seed + 29);
    const { comp, sizes } = components(grid);
    const style = sizes.map(n => n > 1 ? weighted(RO, B.groups) : weighted(RO, B.singles));
    const isBlock = k => k === 'moss' || k === 'hedge' || k === 'wall' || k === 'rock' || k === 'ice' || k === 'basalt';
    const shadowCells = [];
    for (let i = 0; i < COLS * ROWS; i++) if (grid[i] === 1 && isBlock(style[comp[i]])) shadowCells.push([AX + (i % COLS) * CELL, AY + (i / COLS | 0) * CELL]);
    // recorte: pueden subir sobre la cara del muro superior, pero no pisar los laterales ni el inferior
    c.save(); c.beginPath(); c.rect(AX, 0, AW, AY + AH); c.clip();
    blockShadows(c, shadowCells);
    const same = (i, q) => q >= 0 && q < COLS * ROWS && grid[q] === 1 && comp[q] === comp[i] && isBlock(style[comp[q]]);
    for (let r = 0; r < ROWS; r++) for (let k = 0; k < COLS; k++) {
      const i = r * COLS + k;
      if (grid[i] !== 1) continue;
      const st = style[comp[i]];
      const blockish = isBlock(st);
      const nb = blockish ? {
        u: r > 0 && same(i, i - COLS), d: r < ROWS - 1 && same(i, i + COLS),
        l: k > 0 && same(i, i - 1), r: k < COLS - 1 && same(i, i + 1)
      } : { u: false, d: false, l: false, r: false };
      const Rc = mulberry32(seed * 31 + i * 977 + 3);
      B.props[st](c, AX + k * CELL, AY + r * CELL, nb, Rc);
    }

    c.restore();
    // márgenes exteriores limpios (la franja del HUD admite que asomen remates)
    c.fillStyle = B.dark;
    c.fillRect(0, AY + AH + 24, W, H - AY - AH - 24);
    c.fillRect(0, 0, AX - 24, H); c.fillRect(AX + AW + 24, 0, W - AX - AW - 24, H);
    return cv;
  }

  // ---------- partículas ambientales ----------
  function hs(i, k) { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); }
  const wrap = (v, a, w) => a + (((v - a) % w) + w) % w;
  function ambient(ctx, t, biome) {
    const B = BIOMES[biome] || pradera;
    ctx.save();
    if (B.ambient === 'leaves') {
      const cols = ['#9ad65a', '#c9e46e', '#6fbf47', '#e7cf6a'];
      for (let i = 0; i < 14; i++) {
        const sp = 24 + hs(i, 1) * 26;
        const y = wrap(t * sp + hs(i, 2) * (AH + 40), AY - 20, AH + 40);
        const x = wrap(AX + hs(i, 3) * AW + t * (10 + hs(i, 7) * 10) + Math.sin(t * (0.7 + hs(i, 4)) + i) * (16 + hs(i, 5) * 20), AX, AW);
        const rot = t * (1 + hs(i, 6) * 2) + i, flip = Math.abs(Math.cos(t * 2.2 + i * 1.3));
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = 'rgba(0,30,0,.25)';
        ctx.beginPath(); ctx.ellipse(x + 6, y + 10, 4, 1.6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = cols[i & 3];
        ctx.beginPath(); ctx.ellipse(x, y, 4.6, 0.6 + 2 * flip, rot, 0, TAU); ctx.fill();
      }
    } else if (B.ambient === 'dust') {
      ctx.fillStyle = '#d8c8ff';
      for (let i = 0; i < 30; i++) {
        const x = wrap(AX + hs(i, 1) * AW + Math.sin(t * 0.3 + i) * 24 + t * (hs(i, 6) - 0.5) * 8, AX, AW);
        const y = wrap(AY + hs(i, 2) * AH - t * (5 + hs(i, 3) * 9), AY, AH);
        ctx.globalAlpha = 0.1 + 0.22 * (0.5 + 0.5 * Math.sin(t * (0.8 + hs(i, 4)) + i * 2));
        ctx.beginPath(); ctx.arc(x, y, 1 + hs(i, 5) * 1.6, 0, TAU); ctx.fill();
      }
    } else if (B.ambient === 'snow') {
      ctx.fillStyle = '#eef8ff';
      for (let i = 0; i < 36; i++) {
        const sp = 18 + hs(i, 1) * 34;
        const y = wrap(t * sp + hs(i, 2) * AH, AY, AH);
        const x = wrap(AX + hs(i, 3) * AW + Math.sin(t * (0.5 + hs(i, 4)) + i) * (8 + hs(i, 5) * 14) + t * 6, AX, AW);
        ctx.globalAlpha = 0.4 + hs(i, 6) * 0.45;
        ctx.beginPath(); ctx.arc(x, y, 0.9 + hs(i, 7) * 1.6, 0, TAU); ctx.fill();
      }
    } else {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 30; i++) {
        const sp = 26 + hs(i, 1) * 50, span = AH * (0.45 + hs(i, 8) * 0.5);
        const trav = (t * sp + hs(i, 2) * span) % span;
        const y = AY + AH - 10 - trav;
        const x = wrap(AX + hs(i, 3) * AW + Math.sin(t * (1 + hs(i, 4) * 1.5) + i) * (6 + hs(i, 5) * 12), AX, AW);
        const life = 1 - trav / span;
        ctx.globalAlpha = Math.max(0, life * (0.55 + 0.45 * Math.sin(t * 9 + i * 3)));
        ctx.fillStyle = i % 3 ? '#ff8a3a' : '#ffd27a';
        ctx.beginPath(); ctx.arc(x, y, 0.8 + hs(i, 6) * 1.5, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  function forRoom(room) {
    const r = Math.round(Number(room) || 1);
    return r <= 5 ? 'pradera' : r <= 10 ? 'cripta' : r <= 15 ? 'cristal' : 'volcan';
  }
  function info(id) {
    const B = BIOMES[id] || pradera;
    return { name: B.name, dark: B.dark, accent: B.accent, ambient: B.ambient };
  }

  window.ArcanoBiomes = { list: LIST.slice(), forRoom, info, render, ambient };
})();
