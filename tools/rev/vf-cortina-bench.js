// Verificación final (18): Cortina boreal a 18× contra jefes. Compara Aurora con Voltaica (Tormenta) y Plasma (Sol cautivo)
// en las salas 15 y 20: __arcano.bench (sin definitivo), RB.boss con definitivo, y el daño aislado de un solo definitivo
// Uso: CDP_PORT=9483 node tools/cdp.mjs 360 640 tools/rev/vf-cortina-bench.js
const fs = await import('node:fs');
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
await send('Page.reload', {}); await sleep(1500);
await ev('__arcano.flags.freeze = true');
await ev(fs.readFileSync('E:/PROYECTOS/arcano/tools/rev/rb-harness.js', 'utf8'));
const FORMS = [['Voltaica', 'bolt', ['bolt']], ['Aurora', 'bolt', ['bolt', 'ice']], ['Plasma', 'bolt', ['bolt', 'fire']], ['Glacial', 'ice', ['ice']], ['Aurora(hielo)', 'ice', ['ice', 'bolt']]];
console.log('--- __arcano.bench (build media, sin definitivo): tiempo en matar al jefe, semillas 1-3');
for (const room of [15, 20]) for (const [name, school, path] of FORMS) {
  const rs = [];
  for (const seed of [1, 2, 3]) rs.push(await ev(`__arcano.bench({ room: ${room}, school: '${school}', path: ${JSON.stringify(path)}, seed: ${seed}, secs: 120 })`));
  console.log(`sala ${room} ${name.padEnd(13)} ttk ${rs.map(r => r.ttk).join(' / ')}  frz ${rs.map(r => r.frz).join(' / ')}  atk ${rs[0].atk} linaje ${rs[0].linaje} killed ${rs.every(r => r.killed)}`);
}
const MID = { atk: 3, atkspd: 2, front: 1, multi: 1, crit: 1, hp: 2 };
console.log('--- RB.boss con definitivo (ult: true) vs sin: segundos que ahorra el definitivo');
for (const room of [15, 20]) for (const [name, school, path] of FORMS.slice(0, 3)) {
  const a = [], b = [];
  for (const seed of [1, 2, 3]) {
    a.push(await ev(`RB.boss({ room: ${room}, school: '${school}', path: ${JSON.stringify(path)}, runes: ${JSON.stringify(path)}, build: ${JSON.stringify(MID)}, seed: ${seed}, secs: 120, ult: false })`));
    b.push(await ev(`RB.boss({ room: ${room}, school: '${school}', path: ${JSON.stringify(path)}, runes: ${JSON.stringify(path)}, build: ${JSON.stringify(MID)}, seed: ${seed}, secs: 120, ult: true })`));
  }
  const avg = x => +(x.reduce((s, r) => s + r.ttk, 0) / x.length).toFixed(1);
  console.log(`sala ${room} ${name.padEnd(9)} sin ult ${a.map(r => r.ttk).join('/')} (media ${avg(a)})  con ult ${b.map(r => r.ttk).join('/')} (media ${avg(b)}, ${b.map(r => r.ults).join('/')} lanzados)  ahorro ${(avg(a) - avg(b)).toFixed(1)} s`);
}
console.log('--- daño aislado de UN definitivo contra el jefe solo (sin disparos, en múltiplos de atk base y en % de su vida)');
for (const room of [15, 20]) for (const [name, school, path] of FORMS.slice(0, 3)) {
  const r = await ev(`(() => {
    const A = __arcano, P = RB.setup({ school: '${school}', path: ${JSON.stringify(path)}, runes: ${JSON.stringify(path)}, build: ${JSON.stringify(MID)}, seed: 1 });
    A.goto(${room}); P.xp = -1e12;
    for (let i = 0; i < 600 && A.enemies.some(e => e.kind === 'boss' && e.spawnT > 0); i++) A.step(1 / 60);
    const B = A.enemies.find(e => e.kind === 'boss');
    A.enemies.filter(e => e !== B).forEach(e => { e.dead = true; });
    P.cd = 1e9; B.frozen = 0; B.frzImm = 0; B.shock = 0; B.burn = 0; B.burnDps = 0;
    const hp0 = B.hp; let frz = 0;
    A.ult();
    for (let i = 0; i < 240; i++) { P.cd = 1e9; A.step(1 / 60); if (B.frozen > 0) frz += 1 / 60; }
    return { form: P.form, ult: A.ults().name, atk: +P.atk.toFixed(1), linaje: A.formInfo().linaje, dmg: Math.round(hp0 - B.hp), k: +((hp0 - B.hp) / P.atk).toFixed(1), pct: +(100 * (hp0 - B.hp) / B.maxHp).toFixed(1), frz: +frz.toFixed(2), bossHp: B.maxHp };
  })()`);
  console.log(`sala ${room} ${name.padEnd(9)}`, JSON.stringify(r));
}
