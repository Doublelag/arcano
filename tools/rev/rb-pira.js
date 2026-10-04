// Frecuencia real de "Pira" (quien muere ardiendo estalla) por baja, según la forma con núcleo fuego
const fs = await import('node:fs');
await ev(fs.readFileSync('E:/PROYECTOS/arcano/tools/rev/rb-harness.js', 'utf8'));
const MID = { atk: 3, atkspd: 2, front: 1, multi: 1, crit: 1, hp: 2 };
for (const k of [{ path: ['fire', 'ice'], pact: true }, { path: ['fire', 'bolt'] }, { path: ['fire', 'poison'] }, { path: ['fire'], runes: ['fire'] }]) {
  const r = await ev(`(() => {
    const A = __arcano;
    let kills = 0, blasts = 0;
    for (const seed of [1, 2, 3]) {
      const P = RB.setup({ school: 'fire', path: ${JSON.stringify(k.path)}, runes: ${JSON.stringify(k.runes || k.path)}, build: ${JSON.stringify(MID)}, pact: ${!!k.pact}, seed });
      for (const room of [7, 8, 11, 12, 13, 16, 17, 18]) {
        A.goto(room); P.xp = -1e12;
        const k0 = A.kills;
        let idle = 0, hs = 0;
        for (let i = 0; i < 60 * 60; i++) {
          const tb = A.tok.blast;
          A.step(1 / 60);
          if (A.tok.blast < tb - 0.5) blasts += Math.round(tb - A.tok.blast + 10 / 60);
          const live = A.enemies.filter(e => !e.dead);
          if (!live.length) break;
          const s = live.reduce((a, e) => a + e.hp, 0); idle = s < hs - 0.01 ? 0 : idle + 1 / 60; hs = s;
          if (idle > 2) { idle = 0; const e = live[0]; for (let q = 0; q < 20; q++) { const x = e.x + (Math.random() - 0.5) * 200, y = e.y + (Math.random() - 0.5) * 200; if (!RB.rock(x, y) && RB.los(x, y, e.x, e.y)) { P.x = x; P.y = y; break; } } }
        }
        kills += A.kills - k0;
      }
    }
    return { form: A.player.form, kills, blasts, porBaja: +(blasts / kills).toFixed(2) };
  })()`);
  console.log(k.path.join('+').padEnd(12), JSON.stringify(r));
}
