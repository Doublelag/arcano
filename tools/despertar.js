// Pruebas del Despertar (fase 1) en Chrome sin ventana: oferta, cinemática, Afinidad, Arcanista, opuestos, "Aún no"
// Uso: CDP_PORT=9433 node tools/cdp.mjs 360 640 tools/despertar.js   (capturas en SHOTS o en ./shots-despertar)
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'shots-despertar';
fs.mkdirSync(OUT, { recursive: true });
const shot = async (name, clip) => {
  const r = await send('Page.captureScreenshot', Object.assign({ format: 'png' }, clip ? { clip: Object.assign({ scale: 1 }, clip) } : {}));
  fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64'));
};
let fails = 0;
const ok = (c, msg, x) => { console.log((c ? 'OK   ' : 'FAIL ') + msg + (x !== undefined ? '  ' + JSON.stringify(x) : '')); if (!c) fails++; };
const info = () => ev('__arcano.formInfo()');
const st = () => ev('__arcano.state');
const ovl = () => ev(`document.getElementById('overlay').innerText`);
const isAwakenPanel = () => ev(`!!document.querySelector('[data-act="later"]')`);
// avanza hasta que aparezca el panel del despertar (eligiendo la 1ª carta en los niveles que salgan antes)
async function untilPanel(maxSec = 4) {
  for (let i = 0; i < maxSec * 10; i++) {
    const s = await st();
    if (s === 'levelup' && await isAwakenPanel()) return true;
    if (s === 'levelup' || s === 'altar') await ev('__arcano.pick(0)');
    else await ev('__arcano.step(0.1)');
  }
  return false;
}
const idx = el => ev(`[...document.querySelectorAll('[data-act="pick"]')].findIndex(c => c.dataset.id === 'awk:${el}')`);
const clipPlayer = async () => { const p = await ev('({x:__arcano.player.x, y:__arcano.player.y})'); const s = 360 / 540; return { x: (p.x - 110) * s, y: (p.y - 130) * s, width: 220 * s, height: 200 * s, scale: 3 }; };

await ev('__arcano.flags.freeze = true');

// ---------- 1. Piromante: la oferta llega al limpiar la sala, cinemática y forma nueva ----------
console.log('--- 1. Piromante');
await ev(`__arcano.school('fire')`); await ev('__arcano.god(true)');
let fi = await info();
ok(fi.form === 'aprendiz' && fi.aff.join() === 'fire' && fi.awak === 0, 'Aprendiz con Afinidad [fuego]', fi.aff);
ok(await ev(`document.getElementById('btnUlt').classList.contains('anima')`), 'el botón del definitivo lleva el anillo de Ánima');
await ev('__arcano.anima(100)');
fi = await info(); ok(fi.ready, 'Ánima lista al llegar a 100');
ok(await ev(`document.getElementById('btnUlt').classList.contains('animafull')`), 'anillo en animafull');
await ev('__arcano.step(1)');
ok(await st() !== 'levelup' || !(await isAwakenPanel()), 'sin oferta con enemigos vivos', await st());
while (await st() === 'levelup') { await ev('__arcano.pick(0)'); }
await ev('__arcano.clear()');
await ev('__arcano.step(0.4)');
ok(!(await isAwakenPanel()), 'a los 0,4 s de limpiar aún no hay panel');
ok(await untilPanel(), 'panel del despertar al limpiar la sala');
let txt = await ovl();
ok(/DESPIERTA/.test(txt) && /Aún no/.test(txt), 'título DESPIERTA y botón Aún no');
ok(await ev(`document.querySelectorAll('[data-act="pick"]').length`) === 4, '4 cartas (Fuego, Rayo, Hielo, Veneno)', txt.replace(/\n+/g, ' / ').slice(0, 400));
ok(await ev(`(() => { const p = document.querySelector('#overlay .panel'); return p.scrollHeight <= p.clientHeight + 1; })()`), 'el panel cabe sin desplazamiento a 360x640');
await sleep(700); // que acaben las animaciones de entrada de las cartas
await shot('01-panel');
await ev(`__arcano.pick(${await idx('fire')})`);
ok(await st() === 'play' && (await info()).awakenFx, 'empieza la transformación (state play)');
await ev('__arcano.step(0.45)');
fi = await info();
ok(fi.form === 'aprendiz' && fi.awakenFx.t > 0.4 && !fi.awakenFx.boom, 'carga: todavía Aprendiz', fi.awakenFx);
await shot('02-carga');
await ev('__arcano.step(0.48)');
fi = await info();
ok(fi.awakenFx && fi.awakenFx.boom && fi.form === 'ignea', 'estallido: ya es Ígnea', fi.awakenFx);
await shot('03-estallido');
await ev('__arcano.step(0.62)');
fi = await info();
ok(!fi.awakenFx && fi.form === 'ignea' && fi.core === 'fire' && fi.awak === 1, 'después: forma Ígnea, núcleo fuego', { form: fi.form, core: fi.core });
ok(fi.tr.burnK === 0.5 && fi.tr.deathBlast && fi.ultKey === 'fire' && fi.linaje, 'rasgo Pira, Meteoro y Linaje', { tr: fi.tr, linaje: fi.linaje });
ok(await ev('__arcano.player.sk.fire') === 2, 'la runa de fuego sube a Nv2');
console.log('   avisos:', JSON.stringify(await ev('__arcano.toasts()')));
await shot('04-despues');
await shot('04b-mago', await clipPlayer());
// sala siguiente: los disparos ya son de la forma
await ev('__arcano.toDoor()');
for (let i = 0; i < 20 && (await ev('__arcano.room')) < 2; i++) await ev('__arcano.step(0.1)');
await ev('__arcano.step(1)');
let sh = [];
for (let i = 0; i < 40 && !sh.length; i++) { await ev('__arcano.step(0.05)'); sh = await ev(`__arcano.shots.map(a => a.sty && a.sty.id)`); }
ok(sh.length > 0 && sh.every(x => x === 'ignea'), 'los disparos llevan el estilo de Ígnea', sh.slice(0, 4));
await shot('05-disparos');
ok(await ev(`getComputedStyle(document.getElementById('btnUlt')).getPropertyValue('--c').trim()`) === '#ff8a3d', 'botón del definitivo con el color de la forma');

// ---------- 2. Afinidad: una runa de otro elemento sella la pareja ----------
console.log('--- 2. Afinidad');
await ev(`__arcano.school('fire')`); await ev('__arcano.god(true)');
let found = null;
for (let i = 0; i < 60 && !found; i++) {
  await ev('__arcano.levelup()');
  found = await ev(`(() => { const c = document.querySelector('.card.seal'); return c ? { id: c.dataset.id, txt: c.innerText.replace(/\\n+/g, ' / ') } : null; })()`);
}
ok(!!found, 'carta de runa que sella con marco bicolor y 2 líneas', found);
await sleep(600);
await shot('06-carta-sello');
const sealEl = found.id;
await ev(`__arcano.pick([...document.querySelectorAll('[data-act="pick"]')].findIndex(c => c.dataset.id === '${sealEl}'))`);
fi = await info();
ok(fi.aff.length === 2 && fi.aff.includes(sealEl), 'Afinidad sellada', fi.aff);
const closed = ['fire', 'bolt', 'ice', 'poison'].filter(x => !fi.aff.includes(x));
let bad = 0, seenOwn = 0;
for (let i = 0; i < 50; i++) { const r = await ev('__arcano.roll(3)'); if (r.some(x => closed.includes(x))) bad++; if (r.includes(sealEl)) seenOwn++; }
ok(bad === 0, `en 50 tiradas no sale ninguna runa cerrada (${closed.join(', ')})`, { bad, seenOwn });
console.log('   avisos:', JSON.stringify(await ev('__arcano.toasts()')));
await ev('__arcano.step(0.3)');
await shot('07-afinidad', await clipPlayer());
await ev('__arcano.step(0.6)');
await shot('07b-afinidad-aviso');

// ---------- 3. Arcanista ----------
console.log('--- 3. Arcanista');
await ev(`__arcano.school('arcane')`); await ev('__arcano.god(true)');
fi = await info();
ok(fi.aff.length === 0, 'Arcanista sin Afinidad', fi.aff);
await ev('__arcano.clear()'); await ev('__arcano.step(0.2)');
await ev('__arcano.offer()');
ok(await ev(`document.querySelectorAll('[data-act="pick"]').length`) === 4 && await ev(`document.querySelectorAll('.card.seal').length`) === 0, 'sin runas: 4 opciones y ninguna sella');
await ev('__arcano.later()');
await ev(`__arcano.give('ice')`);
fi = await info(); ok(fi.aff.join() === 'ice', 'la 1ª runa entra en la Afinidad sin sellar', fi.aff);
await ev('__arcano.player.snoozeRoom = -1');
await ev('__arcano.offer()');
ok(await ev(`document.querySelectorAll('.card.seal').length`) === 3, 'con Afinidad de 1: las 3 ajenas sellan');
await sleep(700);
await shot('08-arcanista-panel');
await ev(`__arcano.pick(${await idx('poison')})`);
await ev('__arcano.step(1.5)');
fi = await info();
ok(fi.form === 'toxica' && fi.core === 'poison' && fi.aff.join() === 'ice,poison' && !fi.linaje && fi.ultKey === 'poison', 'Arcanista → Tóxica, sella Hielo + Veneno, sin Linaje, Plaga', fi);
await ev('__arcano.anima(160)');
await ev('__arcano.offer()');
ok(await ev(`document.querySelectorAll('[data-act="pick"]').length`) === 1, '2º despertar: solo el otro elemento de la Afinidad');
await ev('__arcano.pick(0)'); await ev('__arcano.step(1.5)');
fi = await info();
ok(fi.form === 'mortaja' && fi.tr.shroud && fi.tr.poisonK === 0.15, 'Mortaja con núcleo veneno: Sudario + Ponzoña', fi.tr);
await shot('08b-mortaja', await clipPlayer());

// ---------- 4. Opuestos sin pacto (sin panel, con pista) y con pacto (Eclipse) ----------
console.log('--- 4. Opuestos');
await ev(`__arcano.school('fire')`); await ev('__arcano.god(true)');
await ev(`__arcano.give('ice')`);
fi = await info();
ok(fi.aff.join() === 'fire,ice', 'Fuego + Hielo sellados (opuestos)');
console.log('   avisos:', JSON.stringify(await ev('__arcano.toasts()')));
await ev(`__arcano.awaken('fire')`);
await ev('__arcano.anima(160)');
await ev('__arcano.clear()'); await ev('__arcano.step(1.5)');
fi = await info();
ok(await st() === 'play' && fi.lock && !(await isAwakenPanel()), 'opuestos sin pacto: sin panel y bloqueado', { st: await st(), lock: fi.lock });
ok(await ev(`document.getElementById('btnUlt').classList.contains('animalock')`), 'anillo en animalock');
await shot('09-opuestos-pista');
await ev('__arcano.goto(4)'); await ev('__arcano.god(true)'); await ev('__arcano.step(0.5)');
await ev('__arcano.player.x = 270; __arcano.player.y = 480'); await ev('__arcano.step(0.1)');
ok(await st() === 'altar', 'altar abierto', await st());
txt = await ovl();
ok(/Eclipse/.test(txt), 'el Pacto avisa del camino a Eclipse');
const hp0 = await ev('__arcano.player.maxHp');
await ev(`__arcano.pick([...document.querySelectorAll('[data-act="altar"]')].findIndex(c => c.dataset.id === 'pact'))`);
const hpP = await ev('__arcano.player.maxHp'); // justo tras el pacto (las 2 cartas pueden traer Vitalidad)
ok((await info()).pactRun, 'pacto firmado (pactRun)');
ok(await untilPanel(6), 'tras las 2 cartas del pacto llega el panel con Eclipse');
txt = await ovl();
ok(/SEGUNDO DESPERTAR/.test(txt), 'título SEGUNDO DESPERTAR', txt.replace(/\n+/g, ' / ').slice(0, 300));
await sleep(700);
await shot('10-panel-eclipse');
const hp1 = await ev('__arcano.player.maxHp');
await ev('__arcano.pick(0)');
await ev('__arcano.step(0.5)'); await shot('11-eclipse-carga');
await ev('__arcano.step(0.45)'); await shot('12-eclipse-estallido');
fi = await info();
ok(fi.form === 'eclipse' && fi.eclipseFx, 'Eclipse con esquirlas de sombra', fi.form);
const eHp = await ev('ArcanoForms.FORMS.eclipse.trait.hpMul');
ok(fi.maxHp === Math.max(40, Math.round(hp1 * eHp)) && hpP === Math.max(40, Math.round(hp0 * 0.8)), `precio: −20% del pacto y ×${eHp} de Eclipse`, { hp0, hpP, hp1, hp2: fi.maxHp });
await ev('__arcano.step(0.6)');
console.log('   avisos:', JSON.stringify(await ev('__arcano.toasts()')));
await shot('13-eclipse-banner');
await ev('__arcano.step(1.4)');
await shot('13b-eclipse-banner2');
await shot('13c-eclipse-mago', await clipPlayer());

// ---------- 5. "Aún no": Escape, siguiente sala, botón y pacto en la misma sala ----------
console.log('--- 5. Aún no');
await ev(`__arcano.school('bolt')`); await ev('__arcano.god(true)');
await ev('__arcano.anima(100)'); await ev('__arcano.clear()');
ok(await untilPanel(), 'panel ofrecido');
await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Escape', key: 'Escape', windowsVirtualKeyCode: 27 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Escape', key: 'Escape', windowsVirtualKeyCode: 27 });
ok(await st() === 'play' && (await info()).snooze === 1, 'Escape = Aún no (snoozeRoom = sala)');
await ev('__arcano.step(2)');
ok(!(await isAwakenPanel()), 'no vuelve a abrirse en esta sala');
await ev('__arcano.toDoor()');
for (let i = 0; i < 20 && (await ev('__arcano.room')) < 2; i++) await ev('__arcano.step(0.1)');
await ev('__arcano.step(0.3)'); await ev('__arcano.clear()');
ok(await untilPanel(), 'reaparece en la siguiente sala limpia');
await sleep(650);
await ev(`document.querySelector('[data-act="later"]').click()`);
ok(await st() === 'play', 'botón Aún no');
await ev('__arcano.step(1.5)');
ok(!(await isAwakenPanel()), 'sigue cerrado en esa sala');
await ev('__arcano.pact()');
ok(await untilPanel(), 'un pacto en la misma sala lo reabre');
await ev('__arcano.later()');

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
