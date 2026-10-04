// Arnés del revisor de balance: se inyecta en la página (window.RB). Partidas dirigidas con build a medida.
window.RB = (() => {
  const A = __arcano;
  const AX = 30, AY = 128, AW = 480, AH = 800, CELL = 40, COLS = 12;
  const rock = (x, y) => x < AX || x >= AX + AW || y < AY || y >= AY + AH || A.grid[((y - AY) / CELL | 0) * COLS + ((x - AX) / CELL | 0)] === 1;
  const los = (x0, y0, x1, y1) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 14); for (let i = 1; i < n; i++) { const t = i / n; if (rock(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; } return true; };
  function setup(c) {
    A.seed(c.seed || 1);
    A.flags.noForms = !!c.noForms;
    A.flags.freeze = true;
    A.flags.phase2 = c.phase2 !== false;
    A.school(c.school || 'fire');
    A.god(true);
    const P = A.player;
    for (const [k, n] of Object.entries(c.build || {})) A.give(k, n);
    for (const el of c.runes || []) while ((P.sk[el] || 0) < 2) A.give(el);
    if (c.pact) A.pact();
    if (!c.noForms) for (const el of c.path || []) A.awaken(el);
    for (const [k, n] of c.after || []) A.give(k, n);
    return P;
  }
  // limpia cada sala (sin subir de nivel), con el mago que se recoloca si se atasca
  function rooms(c) {
    const P = setup(c), T = {};
    let tot = 0;
    for (const r of c.rooms || [7, 8, 11, 12, 13, 16, 17, 18]) {
      A.goto(r); P.xp = -1e12;
      let t = 0, idle = 0, hs = 0;
      for (let i = 0; i < (c.maxT || 60) * 60; i++) {
        if (A.state !== 'play') { T.stuck = A.state; break; }
        A.step(1 / 60); t += 1 / 60;
        const live = A.enemies.filter(e => !e.dead);
        if (!live.length) break;
        const s = live.reduce((a, e) => a + e.hp, 0);
        idle = s < hs - 0.01 ? 0 : idle + 1 / 60; hs = s;
        if (idle > 2) {
          idle = 0;
          const e = live[0];
          for (let k = 0; k < 20; k++) { const x = e.x + (Math.random() - 0.5) * 200, y = e.y + (Math.random() - 0.5) * 200; if (!rock(x, y) && los(x, y, e.x, e.y)) { P.x = x; P.y = y; break; } }
        }
      }
      T[r] = Math.round(t * 10) / 10; tot += t;
    }
    return { rooms: T, total: Math.round(tot * 10) / 10, form: P.form, atk: +P.atk.toFixed(1), mixes: P.mixes.map(m => m.id) };
  }
  // jefe: el mago quieto en el inicio; mide tiempo, % congelado, Ánima/maná
  function boss(c) {
    const P = setup(c);
    A.goto(c.room || 15); P.xp = -1e12;
    const x0 = P.x, y0 = P.y;
    let bT = 0, fT = 0, b = null, maxFrz = 0, cur = 0, ults = 0;
    for (let i = 0; i < (c.secs || 120) * 60; i++) {
      if (A.state !== 'play' && A.state !== 'transition' && A.state !== 'dying') break;
      A.step(1 / 60);
      if (!c.move) { P.x = x0; P.y = y0; }
      b = A.enemies.find(e => e.kind === 'boss');
      if (b && c.bossHp && !b._hpx) { b._hpx = 1; b.hp *= c.bossHp; b.maxHp *= c.bossHp; }
      if (c.ult && P.mana >= 100 && b && !b.dead && b.spawnT <= 0) { A.ult(); ults++; }
      if (b && !b.dead && b.spawnT <= 0) { bT += 1 / 60; if (b.frozen > 0) { fT += 1 / 60; cur += 1 / 60; maxFrz = Math.max(maxFrz, cur); } else cur = 0; }
      if (bT > 0 && (!b || b.dead)) break;
    }
    return { ttk: Math.round(bT * 10) / 10, frz: bT ? Math.round(fT / bT * 100) / 100 : 0, maxFrz: +maxFrz.toFixed(2), form: P.form, atk: +P.atk.toFixed(1), killed: !b || b.dead, ults, mixes: P.mixes.map(m => m.id) };
  }
  // DPS contra muñecos: n enemigos parados con mucha vida, el mago quieto, s segundos
  function dummy(c) {
    const P = setup(c);
    A.goto(c.room || 12); P.xp = -1e12;
    A.step(1); // que aparezcan
    if (!c.rocks) A.grid.fill(0); // sin rocas: todos los muñecos a la vista
    const E = A.enemies.filter(e => !e.dead);
    const n = c.n || 6;
    E.forEach((e, i) => { if (i >= n) { e.dead = true; return; } e.spawnT = 0; e.hp = e.maxHp = 1e7; e.speed = 0; e.x = 150 + (i % 4) * 70; e.y = 300 + Math.floor(i / 4) * 60; e.kind = e.kind === 'boss' ? 'boss' : 'slime'; e.ground = true; });
    A.step(1 / 60);
    const live = A.enemies.filter(e => !e.dead);
    const hp0 = live.reduce((a, e) => a + e.hp, 0);
    P.x = AX + AW / 2; P.y = AY + AH - 120;
    const x0 = P.x, y0 = P.y;
    for (let i = 0; i < (c.secs || 10) * 60; i++) { A.step(1 / 60); P.x = x0; P.y = y0; live.forEach(e => { e.kx = e.ky = 0; }); }
    const dmg = hp0 - live.reduce((a, e) => a + Math.max(0, e.hp), 0);
    return { dps: Math.round(dmg / (c.secs || 10)), perAtk: +(dmg / (c.secs || 10) / P.atk).toFixed(2), form: P.form, atk: +P.atk.toFixed(1), mixes: P.mixes.map(m => m.id), shots: A.shots.length };
  }
  return { setup, rooms, boss, dummy, rock, los };
})();
'ok';
