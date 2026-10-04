// Sala 20: el Ánima se llena durante el jefe final ("¡DESPERTAR LISTO!") pero el despertar nunca se ofrece
const fs = await import('node:fs');
await ev(fs.readFileSync('E:/PROYECTOS/arcano/tools/rev/rb-harness.js', 'utf8'));
const r = await ev(`(() => {
  const A = __arcano;
  const P = RB.setup({ school: 'fire', path: ['fire'], runes: ['fire', 'bolt'], build: { atk: 3, atkspd: 2, front: 1, multi: 1, crit: 1, hp: 2 } });
  A.goto(20); P.xp = -1e12;
  P.anima = 150; P.animaReady = false;
  const log = [];
  let readyAt = null, offer = false, t = 0;
  for (; t < 120 * 60; t++) {
    const st = A.state;
    if (st === 'levelup') { offer = !!document.querySelector('[data-act="later"]'); log.push('panel ' + (offer ? 'despertar' : 'otro')); break; }
    if (st !== 'play' && st !== 'transition' && st !== 'dying') break;
    A.step(1 / 60);
    if (P.animaReady && readyAt == null) readyAt = { t: +(t / 60).toFixed(1), boss: !!A.enemies.find(e => e.kind === 'boss' && !e.dead), ring: document.getElementById('btnUlt').className };
  }
  return { readyAt, offer, final: A.state, secs: +(t / 60).toFixed(1), log };
})()`);
console.log(JSON.stringify(r));
