// Arco de plasma: ¿sale también al golpear a un enemigo que NO ardía antes del impacto?
const fs = await import('node:fs');
await ev(fs.readFileSync('E:/PROYECTOS/arcano/tools/rev/rb-harness.js', 'utf8'));
const r = await ev(`(() => {
  const A = __arcano;
  const P = RB.setup({ school: 'fire', path: ['fire', 'bolt'], runes: ['fire', 'bolt'], build: {} });
  A.goto(7); P.xp = -1e12; A.step(1.2); P.cd = 1e9;
  const E = A.enemies.filter(e => !e.dead);
  E.forEach((e, i) => { e.spawnT = 0; e.hp = e.maxHp = 1e6; e.x = 200 + (i % 2) * 60; e.y = 300 + Math.floor(i / 2) * 200; });
  let fresh = 0, burning = 0, nF = 0, nB = 0;
  for (let k = 0; k < 400; k++) {
    const e = E[0];
    const pre = k % 2 === 0; // alterna: sin arder / ardiendo antes del golpe
    e.burn = pre ? 2 : 0; e.burnDps = pre ? 1 : 0; e.shock = 0; e.reactCd = 9; e.slow = 0; e.poisonDps = 0;
    A.tok.arc = 5;
    A.hit(0, ['fire', 'bolt'], { nofx: false });
    const arc = A.tok.arc < 5;
    if (pre) { nB++; if (arc) burning++; } else { nF++; if (arc) fresh++; }
  }
  return { form: P.form, arcP: P.tr.plasmaArc.p, sinArder: +(fresh / nF).toFixed(2), ardiendo: +(burning / nB).toFixed(2) };
})()`);
console.log(JSON.stringify(r));
