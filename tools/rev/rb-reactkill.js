// Rasgos "al morir ardiendo/envenenado": ¿funcionan cuando el golpe final es la reacción que consume ese estado?
const fs = await import('node:fs');
await ev(fs.readFileSync('E:/PROYECTOS/arcano/tools/rev/rb-harness.js', 'utf8'));
const test = (school, path, pact, els, prep, label) => ev(`(() => {
  const A = __arcano;
  const P = RB.setup({ school: '${school}', path: ${JSON.stringify(path)}, runes: ${JSON.stringify(path)}, build: {}, pact: ${pact} });
  A.goto(7); P.xp = -1e12; A.step(1.2); P.cd = 1e9; P.crit = 0;
  const E = A.enemies.filter(e => !e.dead);
  E.forEach((e, i) => { e.spawnT = 0; e.hp = e.maxHp = 1e6; e.x = 100 + i * 45; e.y = 300; e.speed = 0; });
  const a = E[0], b = E[1]; a.x = 270; a.y = 400; b.x = 300; b.y = 400;
  const out = {};
  for (const mode of ['reaccion', 'normal']) {
    [a, b].forEach(e => { e.burn = e.burnDps = e.poisonDps = e.slow = e.shock = e.frozen = e.reactCd = e.corrode = 0; e.dead = false; });
    a.hp = 1e6; b.hp = 1e6;
    ${prep}
    // reaccion: el disparo no la mata, la reacción sí; normal: la mata el disparo (con el estado puesto)
    a.hp = mode === 'reaccion' ? P.atk + 1 : 1;
    if (mode === 'normal') a.reactCd = 9;
    A.tok.blast = 3;
    const pools0 = A.formInfo().pools, hb = b.hp;
    A.hit(0, ${JSON.stringify(els)});
    out[mode] = { muerto: a.dead, estallido: A.tok.blast < 3, danoVecino: +(hb - b.hp).toFixed(1), charcos: A.formInfo().pools - pools0 };
  }
  return { form: P.form, tr: Object.keys(P.tr).join(','), ...out };
})()`);
console.log('Eclipse núcleo fuego (Pira) · VAPOR:', JSON.stringify(JSON.parse(JSON.stringify(await test('fire', ['fire', 'ice'], true, ['fire', 'ice'], 'a.burn = 2; a.burnDps = 1;')))));
console.log('Ígnea→Plasma (Pira) · SOBRECARGA:', JSON.stringify(await test('fire', ['fire', 'bolt'], false, ['fire', 'bolt'], 'a.burn = 2; a.burnDps = 1; a.shock = 1;')));
console.log('Mortaja núcleo veneno (Ponzoña) · NECROSIS:', JSON.stringify(await test('poison', ['poison', 'ice'], false, ['ice', 'poison'], 'a.poisonDps = 5; a.slow = 1;')));
console.log('Azufre núcleo fuego (charco) · COMBUSTIÓN:', JSON.stringify(await test('fire', ['fire', 'poison'], false, ['fire', 'poison'], 'a.burn = 2; a.burnDps = 1;')));
