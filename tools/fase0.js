// Pruebas de la fase 0 del Despertar: datos, NECROSIS, nofx y tope de proyectiles, DR de congelación en jefes,
// Ventisca (con estallido) y guardado (Grimorio, cookie con 60 objetos, avisos).
// Uso: CDP_PORT=9432 node tools/cdp.mjs 360 640 tools/fase0.js
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; console.log((cond ? 'OK    ' : 'FALLO ') + name + (info !== undefined ? ' · ' + JSON.stringify(info) : '')); };
const URL = 'file:///E:/PROYECTOS/arcano/public/index.html?debug';
const reload = async () => { await send('Page.navigate', { url: URL }); await sleep(1300); };

// ---------- 0. Datos: logros nuevos y texto de Alquimista ----------
{
  await ev(`document.querySelector('[data-act="stats"]').click()`);
  await sleep(200);
  const r = await ev(`(() => {
    const items = [...document.querySelectorAll('.shop-item.ach')].map(x => ({ n: x.querySelector('b').textContent, d: x.querySelector('i').textContent, p: x.querySelector('.price').textContent }));
    const nuevos = ['Despertar', 'Alma doble', 'Cuatro caminos', 'Equilibrio roto', 'Grimorio de formas', 'Mil caras', 'Mezclador'];
    const got = items.filter(x => nuevos.includes(x.n));
    return { total: items.length, nuevos: got.length, sum: got.reduce((a, x) => a + (+x.p.replace(/\\D/g, '') || 0), 0),
      ultimos: items.slice(-7).map(x => x.n).join(','), alq: (items.find(x => x.n === 'Alquimista') || {}).d,
      hyb: (items.find(x => x.n === 'Cuatro caminos') || {}).d };
  })()`);
  ok('7 logros nuevos al final', r.nuevos === 7 && r.ultimos === 'Despertar,Alma doble,Cuatro caminos,Equilibrio roto,Grimorio de formas,Mil caras,Mezclador', r);
  ok('los logros nuevos suman 100 de esencia', r.sum === 100, r.sum);
  ok('Alquimista pide 6 reacciones', r.alq === 'Provoca las 6 reacciones elementales', r.alq);
  ok('Cuatro caminos no nombra formas', !/plasma|aurora|mortaja|azufre|eclipse/i.test(r.hyb), r.hyb);
  await ev(`document.querySelector('[data-act="back"]').click()`);
}

// ---------- 1. NECROSIS ----------
{
  const r = await ev(`(() => {
    const A = __arcano; A.seed(7); A.school('ice'); A.give('poison'); A.god(true);
    const p = A.player; p.crit = 0; p.cd = 1e9; // que no dispare: solo cuentan los impactos de prueba
    A.step(1.3);
    const live = A.enemies.filter(e => !e.dead && e.spawnT <= 0);
    if (live.length < 3) return 'pocos enemigos: ' + live.length;
    const [e0, e1, e2] = live, i0 = A.enemies.indexOf(e0), atk = p.atk;
    for (const e of live) { e.hp = e.maxHp = 5000; e.poisonDps = 0; e.slow = 0; e.shock = 0; e.burn = 0; e.reactCd = 0; e.frozen = 0; }
    e0.x = 270; e0.y = 500; e1.x = 320; e1.y = 500; e2.x = 470; e2.y = 500;
    const out = { atk };
    // a) veneno 10/s + impacto de hielo: 3 x 10 = 30, entre 1,5 y 4 x atk
    e0.poisonDps = 10;
    let hp = e0.hp, h = A.hit(i0, ['ice']);
    out.a = { necro: hp - h.hp - atk, esperado: Math.min(Math.max(30, 1.5 * atk), 4 * atk), veneno: h.poisonDps, vecino: e1.poisonDps, lejos: e2.poisonDps, seen: A.seen().includes('necro') };
    // b) tope: veneno enorme + ralentizado + impacto de veneno
    e0.reactCd = 0; e0.poisonDps = 100; e0.slow = 1; e1.poisonDps = 80;
    hp = e0.hp; h = A.hit(i0, ['poison']);
    out.b = { necro: hp - h.hp - atk, tope: 4 * atk, veneno: h.poisonDps, vecino: e1.poisonDps };
    // c) mínimo: casi sin veneno
    e0.reactCd = 0; e0.poisonDps = 0.1; e0.slow = 1;
    hp = e0.hp; h = A.hit(i0, ['poison']);
    out.c = { necro: hp - h.hp - atk, minimo: 1.5 * atk };
    return out;
  })()`);
  if (typeof r === 'string') ok('NECROSIS: preparación', false, r);
  else {
    const near = (a, b) => Math.abs(a - b) < 0.01;
    ok('NECROSIS: daño = veneno x 3 dentro de [1,5; 4] x atk', near(r.a.necro, r.a.esperado), r.a);
    ok('NECROSIS: el veneno del objetivo queda a 0', r.a.veneno === 0, r.a.veneno);
    ok('NECROSIS: contagia la mitad a ≤70 px y no más lejos', near(r.a.vecino, 5) && r.a.lejos === 0, r.a);
    ok('NECROSIS: aparece como reacción vista', r.a.seen === true);
    ok('NECROSIS: tope de 4 x atk', near(r.b.necro, r.b.tope), r.b);
    ok('NECROSIS: el contagio no rebaja un veneno más fuerte (max)', near(r.b.vecino, 80), r.b.vecino);
    ok('NECROSIS: tras la reacción solo queda el veneno del propio disparo', r.b.veneno <= 0.1 * r.atk + 1e-9, r.b.veneno);
    ok('NECROSIS: mínimo de 1,5 x atk', near(r.c.necro, r.c.minimo), r.c);
  }
}

// ---------- 1b. NECROSIS jugando de verdad (Criomante + Runa de veneno, sin impactos de prueba) ----------
{
  const r = await ev(`(() => {
    const A = __arcano; A.seed(21); A.school('ice'); A.give('poison'); A.god(true); A.goto(3);
    for (let i = 0; i < 60 * 25 && !A.seen().includes('necro'); i++) {
      if (A.state === 'levelup' || A.state === 'altar') A.pick(0);
      if (A.state === 'play' && !A.enemies.some(e => !e.dead)) A.goto(A.room + 1);
      A.step(1 / 60);
    }
    return { seen: A.seen(), room: A.room };
  })()`);
  ok('NECROSIS sale sola en partida con hielo + veneno', r.seen.includes('necro'), r);
}

// ---------- 2. nofx y tope de proyectiles ----------
{
  const r = await ev(`(() => {
    const A = __arcano; A.seed(9); A.school('ice'); A.give('poison'); A.god(true);
    const p = A.player; p.cd = 1e9; p.crit = 0; p.sk.bolt = 2;
    A.step(1.3);
    const live = A.enemies.filter(e => !e.dead && e.spawnT <= 0);
    for (const e of live) { e.hp = e.maxHp = 5000; }
    const [e0] = live, i0 = A.enemies.indexOf(e0);
    const hps = () => live.map(e => Math.round(e.hp)).join(',');
    const before = hps(), seen0 = A.seen().length;
    let reacted = 0;
    for (let k = 0; k < 25; k++) { e0.reactCd = 0; e0.slow = 1; e0.shock = 1; e0.poisonDps = 5; e0.frozen = 0; const h = A.hit(i0, ['ice', 'bolt'], { nofx: true }); if (h.reactCd > 0 || h.frozen > 0 || h.poisonDps === 0) reacted++; }
    const others = live.slice(1).map(e => Math.round(e.hp)).join(',') === before.split(',').slice(1).join(',');
    // control: sin nofx sí reacciona (CONGELACIÓN)
    e0.reactCd = 0; e0.slow = 1; e0.shock = 1; e0.frozen = 0; e0.poisonDps = 0;
    const c = A.hit(i0, ['ice', 'bolt']);
    // tope: 200 secundarios piden sitio, solo caben 140 en pantalla
    for (const e of live) { e.x = 60; e.y = 900; }
    const n0 = A.shots.length, made = A.sub(200);
    A.step(1 / 60);
    const after = A.shots.length, more = A.sub(10);
    return { reacted, others, control: { reactCd: c.reactCd, frozen: c.frozen }, n0, made, after, more, seenSame: A.seen().length === seen0 + 1 };
  })()`);
  ok('nofx: 25 impactos sin reacción', r.reacted === 0, r.reacted);
  ok('nofx: sin cadena (los demás enemigos intactos)', r.others === true);
  ok('sin nofx sí reacciona (control)', r.control.reactCd > 0 && r.control.frozen > 0, r.control);
  ok('tope: no se crean más de 140 proyectiles', r.made === 140 - r.n0 && r.after <= 140 && r.more === 0, r);
}

// ---------- 3. DR de congelación en el jefe (sala 5, hielo + rayo) ----------
const bossRun = async (noDR) => ev(`(() => {
  const A = __arcano; A.seed(11); A.school('ice'); A.give('ice'); A.give('bolt', 2); A.give('atkspd', 2); A.god(true); A.goto(5);
  let bT = 0, fT = 0, set = false, imm = 0;
  for (let i = 0; i < 60 * 80; i++) {
    if (A.state === 'levelup' || A.state === 'altar') A.pick(0);
    const b = A.enemies.find(e => e.kind === 'boss');
    if (b && !set && b.spawnT <= 0) { b.hp = b.maxHp = 1e5; set = true; }
    if (${noDR} && b) b.frzImm = 0; // sin rendimientos decrecientes: como antes
    A.player.hp = A.player.maxHp;
    A.step(1 / 60);
    if (b && !b.dead && b.spawnT <= 0) { bT++; if (b.frozen > 0) fT++; if (b.frzImm > 0) imm++; }
    if (bT >= 60 * 45) break;
  }
  return { seg: +(bT / 60).toFixed(1), congelado: +(fT / Math.max(1, bT)).toFixed(3), estado: A.state };
})()`);
{
  const conDR = await bossRun(false), sinDR = await bossRun(true);
  ok('jefe congelado ≤ 35% del tiempo con DR', conDR.seg > 30 && conDR.congelado <= 0.35, { conDR, sinDR });
  ok('la DR reduce la congelación frente a antes', conDR.congelado < sinDR.congelado, { conDR: conDR.congelado, sinDR: sinDR.congelado });
}

// ---------- 4. Ventisca: congela 2,8-3,3 s, estalla al romperse; en el jefe 1,8 s forzado ----------
{
  const r = await ev(`(() => {
    const A = __arcano; A.seed(5); A.school('ice'); A.god(true); A.goto(3);
    const p = A.player; p.cd = 1e9; p.crit = 0;
    A.step(1.3);
    const live = A.enemies.filter(e => !e.dead && e.spawnT <= 0);
    for (const e of live) { e.hp = e.maxHp = 800; e.frozen = 0; }
    A.ult();
    const st = live.map(e => ({ s: e.shatter, f: e.frozen, hp: e.hp }));
    A.step(3.6);
    const end = live.map(e => ({ s: e.shatter, hp: e.hp, dead: e.dead }));
    return { n: live.length, st, end };
  })()`);
  ok('Ventisca: todos congelados entre 2,8 y 3,3 s y marcados para estallar', r.n > 0 && r.st.every(x => x.s && x.f >= 2.8 && x.f <= 3.3), r.st);
  ok('Ventisca: al romperse estallan (sin marca y con daño extra)', r.end.every((x, i) => !x.s && x.hp < r.st[i].hp - 30), r.end);
  const b = await ev(`(() => {
    const A = __arcano; A.seed(6); A.school('ice'); A.god(true); A.goto(5); A.player.cd = 1e9;
    let b = null;
    for (let i = 0; i < 600; i++) { A.step(1 / 60); b = A.enemies.find(e => e.kind === 'boss'); if (b && b.spawnT <= 0 && i > 200) break; }
    b.hp = b.maxHp = 1e5;
    const bi = A.enemies.indexOf(b);
    A.ult();
    const r = { frozen: b.frozen, imm: b.frzImm, shatter: b.shatter };
    A.step(1.9);
    r.tras = { shatter: b.shatter, frozen: +b.frozen.toFixed(2), imm: +b.frzImm.toFixed(2) };
    b.slow = 1; b.shock = 0; b.reactCd = 0;
    const h1 = A.hit(bi, ['bolt']);           // aún inmune: no hay CONGELACIÓN
    r.inmune = { frozen: h1.frozen, reactCd: h1.reactCd };
    A.step(2);
    b.slow = 1; b.shock = 0; b.reactCd = 0; b.frozen = 0;
    const h2 = A.hit(bi, ['bolt']);           // ya no: 0,7 s y 2,7 s de inmunidad
    r.libre = { frozen: h2.frozen, imm: h2.frzImm };
    return r;
  })()`);
  ok('Ventisca en jefe: 1,8 s forzado (aunque sea inmune) e inmunidad 3,8 s', b.frozen === 1.8 && b.imm === 3.8 && b.shatter === true, b);
  ok('Ventisca en jefe: el bloque estalla al romperse', b.tras.shatter === false, b.tras);
  ok('jefe inmune: CONGELACIÓN no salta ni gasta estados', b.inmune.frozen <= 0 && b.inmune.reactCd <= 0, b.inmune);
  ok('jefe sin inmunidad: CONGELACIÓN 0,7 s e inmunidad 2,7 s', Math.abs(b.libre.frozen - 0.7) < 1e-9 && Math.abs(b.libre.imm - 2.7) < 1e-9, b.libre);
}

// ---------- 5. Depuración: seed repetible y god inmune a trampas ----------
{
  const r = await ev(`(() => {
    const A = __arcano;
    A.seed(42); const a = [Math.random(), Math.random()]; A.seed(42); const b = [Math.random(), Math.random()]; A.seed(null);
    let lava = [];
    for (let n = 16; n <= 18 && !lava.length; n++) for (let s = 1; s <= 6 && !lava.length; s++) { A.seed(s * 100 + n); A.school('fire'); A.god(true); A.goto(n); lava = A.hzCells(4); }
    A.seed(null);
    const hp0 = A.player.hp;
    if (lava.length) { const c = lava[0]; for (let i = 0; i < 60; i++) { A.player.x = c.x; A.player.y = c.y; A.step(1 / 60); } }
    return { igual: a[0] === b[0] && a[1] === b[1], lava: lava.length, hp: A.player.hp === hp0, god: A.player.god };
  })()`);
  ok('seed(n) repite la misma secuencia', r.igual === true);
  ok('god: sin daño de trampas (1 s sobre lava)', r.god === true && r.lava > 0 && r.hp === true, r);
}

// ---------- 6. Guardado: Grimorio, cookie con 60 objetos y avisos ----------
{
  const g0 = await ev(`JSON.stringify(__arcano.grim(true))`);
  ok('grim por defecto', g0 === '{"f":1,"w":0,"e":0,"m":0,"n":"0000000000","k":[0,0,0,0],"t":-1}', g0);
  const ck = await ev(`decodeURIComponent(__arcano.cookie())`);
  ok('la cookie lleva el Grimorio compacto', JSON.parse(ck).grim === '1.0.0.0.0000000000.0-0-0-0.-1', JSON.parse(ck).grim);

  // meta antiguo sin grim -> por defecto
  await ev(`localStorage.setItem('arcano.meta', JSON.stringify({ essence: 12, schools: ['fire','ice','bolt'] }))`);
  await reload();
  ok('meta antiguo sin grim carga el de por defecto', await ev(`JSON.stringify(__arcano.grim())`) === g0);
  // grim roto -> por defecto (salvo lo válido)
  await ev(`localStorage.setItem('arcano.meta', JSON.stringify({ grim: { f: 'x', w: 3, n: '123', k: [1, 2], t: 99 } }))`);
  await reload();
  ok('grim con tipos rotos se valida', await ev(`JSON.stringify(__arcano.grim())`) === '{"f":1,"w":3,"e":0,"m":0,"n":"0000000000","k":[0,0,0,0],"t":-1}', await ev(`JSON.stringify(__arcano.grim())`));
  // grim compacto (como viene de la cookie)
  await ev(`localStorage.setItem('arcano.meta', JSON.stringify({ grim: '1023.1023.31.255.9999999999.312-40-520-38.9' }))`);
  await reload();
  ok('grim compacto se desempaqueta', await ev(`JSON.stringify(__arcano.grim())`) === '{"f":1023,"w":1023,"e":31,"m":255,"n":"9999999999","k":[312,40,520,38],"t":9}', await ev(`JSON.stringify(__arcano.grim())`));

  // cookie al máximo: 60 objetos, todos los logros, estadísticas llenas y grim lleno
  const heavy = await ev(`(() => {
    const G = window.ArcanoGear, bases = ['ascuas','escarcha','tormenta','gemelo','peregrino','carmesi','zarzas','sombras','rosa','enjambre','marea','escorpion','buho','arcano','viento','dragon'];
    const inv = []; for (let i = 0; i < 60; i++) inv.push({ uid: 900 + i, base: bases[i % 16], r: i % 5 });
    const ach = {}; for (const id of ['firstUlt','boss1','room10','boss2','boss3','boss4','firstWin','reactAll','react50','untouchable','lvl15','phoenix','elites','kills1000','allSchools','speedrun','winAll','chests','pact','awaken1','awaken2','hybrids','eclipse','forms10','formWins','mixes8']) ach[id] = true;
    const sch = { fire: 21, ice: 21, bolt: 21, poison: 21, arcane: 21 }, wins = { fire: 120, ice: 99, bolt: 87, poison: 64, arcane: 51 };
    const m = { essence: 123456, up: { vida: 5, poder: 5, mana: 4, sabio: 3, suerte: 3, paso: 3, fenix: 1 }, schools: ['fire','ice','bolt','poison','arcane'], runs: 99999, ach,
      gear: { inv, eq: { baston: 900, tunica: 904, anillo: 908, amuleto: 912 }, next: 960 },
      stats: { kills: 9999999, wins: 9999, bosses: 99999, elites: 99999, reactions: 9999999, ults: 999999, time: 1234567.891234, essenceTotal: 9999999, chests: 9999, pacts: 9999, best: sch, winsBy: wins,
        reactSeen: { vapor: true, overload: true, freeze: true, combust: true, corrode: true, necro: true } },
      grim: { f: 1023, w: 1023, e: 31, m: 255, n: '9999999999', k: [99999, 9999, 99999, 9999], t: 9 } };
    localStorage.setItem('arcano.meta', JSON.stringify(m));
    return true;
  })()`);
  await reload();
  const c = await ev(`(() => { const v = __arcano.cookie(); const d = v && JSON.parse(decodeURIComponent(v)); return { len: v.length, inv: d && d.gear && typeof d.gear.inv === 'string' ? d.gear.inv.split(',').length : 0, grim: d && d.grim }; })()`);
  ok('cookie con 60 objetos y el grim lleno cabe (≤ 3800) y conserva el equipo', heavy && c.len > 0 && c.len <= 3800 && c.inv === 60, c);

  // "Tutorial" y Borrar progreso vacían los avisos
  await ev(`localStorage.setItem('arcano.settings', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('arcano.settings') || '{}'), { tips: { aff: 1, opp: 1 } })))`);
  await reload();
  await ev(`document.querySelector('[data-act="settings"]').click()`); await sleep(450);
  await ev(`document.querySelector('[data-act="tutorial"]').click()`); await sleep(100);
  ok('el botón Tutorial vacía settings.tips', await ev(`JSON.stringify(JSON.parse(localStorage.getItem('arcano.settings')).tips)`) === '{}');
  await ev(`localStorage.setItem('arcano.settings', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('arcano.settings')), { tips: { anima: 1 } })))`);
  await reload();
  await ev(`document.querySelector('[data-act="settings"]').click()`); await sleep(450);
  await ev(`document.querySelector('[data-act="reset"]').click()`); await sleep(450);
  await ev(`document.querySelector('[data-act="reset"]').click()`); await sleep(100);
  const after = await ev(`({ tips: JSON.stringify(JSON.parse(localStorage.getItem('arcano.settings')).tips), grim: JSON.stringify(__arcano.grim()), inv: __arcano.gear().inv.length })`);
  ok('Borrar progreso vacía tips y el Grimorio', after.tips === '{}' && after.grim === g0 && after.inv === 0, after);
}

console.log(fails ? `\n${fails} PRUEBA(S) FALLIDA(S)` : '\nTODO OK');
