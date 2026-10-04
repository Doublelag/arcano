// Esquirlas de Aurora: una baja causada por una esquirla (nofx) ¿genera otra ráfaga de esquirlas? (spec 7.4.11: no deberían)
const fs = await import('node:fs');
await ev(fs.readFileSync('E:/PROYECTOS/arcano/tools/rev/rb-harness.js', 'utf8'));
const r = await ev(`(() => {
  const A = __arcano;
  const P = RB.setup({ school: 'bolt', path: ['bolt', 'ice'], runes: ['bolt', 'ice'], build: {} });
  A.goto(7); P.xp = -1e12; A.step(1.2); P.cd = 1e9; P.crit = 0;
  A.grid.fill(0);
  const E = A.enemies.filter(e => !e.dead);
  E.forEach((e, i) => { e.spawnT = 0; e.hp = e.maxHp = 1e6; e.x = 60 + i * 30; e.y = 880; e.speed = 0; });
  const a = E[0], b = E[1], c = E[2];
  // a en el centro; b a 140 px (en el camino de una esquirla); c a 140 px de b; todos congelados y con poca vida
  a.x = 200; a.y = 400; b.x = 340; b.y = 400; c.x = 480; c.y = 400;
  for (const e of [a, b, c]) { e.frozen = 5; e.kx = e.ky = 0; e.slow = 0; e.shock = 0; e.burn = 0; e.poisonDps = 0; }
  b.hp = 1; c.hp = 1; a.hp = 1;
  A.shots.length = 0; A.tok.shard = 1;
  Math.random = () => 0; // la primera esquirla sale a 0 rad (hacia la derecha, hacia b)
  A.hit(0, []); // mata a 'a' (congelado): estalla en esquirlas
  const after0 = A.shots.filter(s => s.sub === 'shard').length;
  const log = [];
  for (let i = 0; i < 40; i++) { A.step(1 / 60); log.push(A.shots.filter(s => s.sub === 'shard').length); }
  return { tr: P.tr.shards, form: P.form, aMuerto: a.dead, bMuerto: b.dead, cMuerto: c.dead, esquirlasTrasA: after0, maxEsquirlas: Math.max(...log), serie: log.join(',') };
})()`);
console.log(JSON.stringify(r));
