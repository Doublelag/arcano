// Pruebas de la fase 3 del Despertar: Maestrías (Marca II, corona, rótulo dorado, aviso y final), títulos,
// mini-rombo del panel del despertar, ritmo en el Grimorio y aviso que baja bajo el logro.
// Uso: SHOTS=carpeta [TAG=-375] CDP_PORT=9436 node tools/cdp.mjs 360 640 tools/fase3.js
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'shots-fase3';
const TAG = process.env.TAG || '';
fs.mkdirSync(OUT, { recursive: true });
const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/f3-${name}${TAG}.png`, Buffer.from(r.result.data, 'base64')); };
let fails = 0;
const ok = (c, msg, x) => { console.log((c ? 'OK   ' : 'FAIL ') + msg + (x !== undefined ? '  ' + JSON.stringify(x) : '')); if (!c) fails++; };
const st = () => ev('__arcano.state');
const txt = () => ev(`document.getElementById('overlay').innerText`);
const click = sel => ev(`(() => { const e = document.querySelector('${sel}'); if (!e) return false; e.click(); return true; })()`);
const fits = () => ev(`(() => { const p = document.querySelector('#overlay .panel'); return p ? p.scrollHeight <= p.clientHeight + 1 : null; })()`);
const wait = () => sleep(450);
const H = await ev('innerHeight'), WD = await ev('innerWidth');

await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
await send('Page.reload', {}); await sleep(1500);
await ev('__arcano.flags.freeze = true');
await ev('__arcano.grim(true)');
// espía de la corona: cuántas veces se dibuja (2 por fotograma: mitad de atrás y de delante)
await ev(`(() => { const F = ArcanoForms, o = F.drawCrown; window.__crowns = 0; F.drawCrown = function () { window.__crowns++; return o.apply(this, arguments); }; })()`);
// en una sola evaluación: el bucle de rAF también pinta (con freeze) y no debe colarse entre medias
const crowns = () => ev('(() => { window.__crowns = 0; __arcano.step(1 / 60); return window.__crowns; })()');

// ---------- 1. Marca II de una forma pura: despertar antes de la sala 7 ----------
console.log('--- 1. Marca II pura (sala ≤ 6)');
await ev(`__arcano.school('fire')`); await ev('__arcano.goto(5)'); await ev('__arcano.god(true)'); await ev('__arcano.step(0.5)'); await ev('__arcano.clear()'); await ev('__arcano.step(0.3)');
ok(await crowns() === 0, 'Aprendiz sin Marca II: sin corona');
await ev(`__arcano.awaken('fire', true)`); await ev('__arcano.step(1.45)');
let u = await ev('__arcano.ui()');
ok(await ev('!!(__arcano.grim().e & 2)'), 'grim.e con el bit de Ígnea (sala 5)');
ok(u.banner && u.banner.text === 'ÍGNEA' && u.banner.color === '#ffcf4a' && u.banner.crown === '#ff8a3d', 'rótulo: nombre dorado con la corona del color de la forma', u.banner);
let ts = await ev('__arcano.toasts()');
ok(ts.some(s => s.startsWith('¡CORONA DE ÍGNEA! | Marca II · título «Llama Viva» en el Grimorio')), 'aviso "¡CORONA DE ÍGNEA!" con el título', ts);
ok(ts.findIndex(s => s.startsWith('¡NUEVA FORMA!')) < ts.findIndex(s => s.startsWith('¡CORONA')), 'primero "¡NUEVA FORMA!", luego la corona');
ok(await crowns() === 2, 'la corona se dibuja (atrás y delante)');
await ev('__arcano.step(1.2)'); await shot('01-rotulo-corona');
// misma forma en la sala 7: no hay Marca nueva (ya la tiene) y el rótulo sigue dorado
await ev('__arcano.grim(true)');
await ev(`__arcano.school('ice')`); await ev('__arcano.goto(7)'); await ev('__arcano.god(true)'); await ev('__arcano.step(0.5)'); await ev('__arcano.clear()'); await ev('__arcano.step(0.3)');
await ev(`__arcano.awaken('ice', true)`); await ev('__arcano.step(1.45)');
u = await ev('__arcano.ui()'); ts = await ev('__arcano.toasts()');
ok(!(await ev('__arcano.grim().e & 4')), 'Glacial en la sala 7: sin Marca II');
ok(u.banner && u.banner.color === '#7fe3ff' && !u.banner.crown, 'rótulo en el color de la forma, sin corona', u.banner);
ok(!ts.some(s => s.startsWith('¡CORONA')), 'sin aviso de corona');
ok(await crowns() === 0, 'sin corona en el mago');

// ---------- 2. Corona por forma (solo en la forma de la Marca) y sin forms ----------
console.log('--- 2. Corona por forma');
await ev('(() => { const g = __arcano.grim(true); g.f = 1023; g.e = 2; g.w = 1 | 32; })()'); // Ígnea (pura), Aprendiz y Plasma (victoria)
await ev(`__arcano.school('fire')`); await ev('__arcano.goto(3)'); await ev('__arcano.god(true)'); await ev('__arcano.step(0.3)');
ok(await crowns() === 2, 'Aprendiz con victoria sin despertar: corona');
await ev(`__arcano.awaken('fire')`);
ok(await crowns() === 2, 'Ígnea con Marca II: corona');
await ev(`__arcano.awaken('poison')`);
ok(await ev('__arcano.player.form') === 'azufre' && await crowns() === 0, 'Azufre sin Marca II: sin corona (la de Ígnea no se hereda)');
await ev(`__arcano.school('fire')`); await ev(`__arcano.awaken('fire')`); await ev(`__arcano.awaken('bolt')`); await ev('__arcano.goto(3)'); await ev('__arcano.god(true)'); await ev('__arcano.step(0.3)');
ok(await ev('__arcano.player.form') === 'plasma' && await crowns() === 2, 'Plasma con victoria: corona');
await ev('__arcano.flags.noForms = true'); await ev(`__arcano.school('fire')`); await ev('__arcano.step(0.2)');
ok(await crowns() === 0, 'flags.noForms: sin corona');
await ev('__arcano.flags.noForms = false');

// ---------- 3. Victorias: Marca II nueva en el final ----------
console.log('--- 3. Final con Marca II');
const winAs = async (school, path) => {
  await ev(`__arcano.school('${school}')`); await ev('__arcano.god(true)');
  await ev('__arcano.goto(20)'); // despertar ya en la sala 20: sin Marca II de pura por despertar pronto
  for (const el of path) await ev(el === 'pact' ? '__arcano.pact()' : `__arcano.awaken('${el}')`);
  await ev('__arcano.step(0.2)'); await ev('__arcano.clear()');
  for (let i = 0; i < 14 && await st() !== 'win'; i++) await ev('__arcano.step(0.5)');
  await sleep(200);
  return st();
};
await ev('(() => { const g = __arcano.grim(true); g.f = 1023; })()');
ok(await winAs('bolt', ['bolt', 'ice']) === 'win', 'victoria en Aurora');
let t = await txt();
ok(/👑 Marca II de Aurora: corona y título «Luz del Norte»/.test(t), 'final: "Marca II de Aurora: corona y título «Luz del Norte»"', (t.match(/Marca II[^\n]*/) || [''])[0]);
ok(await ev(`!!document.querySelector('.emblem.crowned')`), 'emblema con corona (nombre dorado)');
ok(await fits(), 'el final con la Marca cabe sin desplazamiento');
await sleep(2900); await shot('02-final-marca');
ok(await winAs('bolt', ['bolt', 'ice']) === 'win', 'otra victoria en Aurora');
ok(!/Marca II/.test(await txt()), 'la segunda vez no repite la Marca');
ok(await winAs('fire', ['fire']) === 'win', 'victoria en Ígnea (pura)');
ok(!/Marca II/.test(await txt()) && !(await ev('__arcano.grim().e & 2')), 'pura: ganar no da la Marca II (es despertar pronto)');
ok(await winAs('poison', []) === 'win', 'victoria sin despertar');
t = await txt();
ok(/Ganaste como Aprendiz/.test(t) && /Marca II de Aprendiz: corona y título «Sin Forma»/.test(t), 'Aprendiz: Marca II por ganar sin despertar', (t.match(/Marca II[^\n]*/) || [''])[0]);
ok(await ev('(__arcano.grim().w & 1) === 1'), 'grim.w bit 0');
ok(await winAs('fire', ['fire', 'pact', 'ice']) === 'win', 'victoria en Eclipse');
ok(/Marca II de Eclipse: corona y título «Sin Equilibrio»/.test(await txt()), 'Eclipse: Marca II');

// ---------- 4. Títulos: Grimorio → menú y final ----------
console.log('--- 4. Títulos');
await click('[data-act="menu"]'); await wait();
await click('[data-act="grimoire"]'); await wait();
t = await txt();
ok(await ev(`document.querySelectorAll('.shop-item.grim.crowned').length`) === 3, 'Grimorio: 3 formas coronadas (Aprendiz, Aurora, Eclipse)');
ok(/II: Despiértala antes de la sala 7 → corona y título/.test(t), 'meta de la Marca II con su premio');
ok(await ev(`document.querySelectorAll('[data-act="title"]').length`) === 3, '3 botones "Lucir"');
await click('.shop-item.grim.crowned:nth-of-type(7) [data-act="title"], [data-act="title"][data-i="6"]'); await wait();
ok(await ev('__arcano.grim().t') === 6, 'luce «Luz del Norte»', await ev('__arcano.grim().t'));
await click('[data-act="back"]'); await wait();
t = await txt();
ok(/«Luz del Norte»/.test(t) && await ev(`!!document.querySelector('.mtitle')`), 'menú: título bajo el logo');
ok(await fits(), 'el menú con título cabe');
await shot('03-menu-titulo');
ok(await winAs('poison', []) === 'win' && /Ganaste como Aprendiz «Luz del Norte»/.test(await txt()), 'final: «título» en el emblema');

// ---------- 5. Ritmo en el Grimorio ----------
console.log('--- 5. Ritmo');
await ev('(() => { const g = __arcano.grim(); g.k = [11, 2, 27, 2]; })()');
await click('[data-act="menu"]'); await wait(); await click('[data-act="grimoire"]'); await wait();
t = await txt();
ok(/Despiertas de media en la sala 5,5 y en la 13,5/.test(t), 'Grimorio: "Despiertas de media en la sala 5,5 y en la 13,5"', (t.match(/Despiertas[^\n]*/) || [''])[0]);
await shot('04-grimorio-ritmo');
await click('[data-act="back"]'); await wait(); await click('[data-act="stats"]'); await wait();
ok(/Sala media al despertar\s*5,5 y 13,5/.test(await txt()), 'Logros: "Sala media al despertar 5,5 y 13,5"');
await click('[data-act="back"]'); await wait();

// ---------- 6. Mini-rombo del panel del despertar ----------
console.log('--- 6. Mini-rombo');
await ev('(() => { const g = __arcano.grim(true); g.f = 1 | 2 | 32; })()'); // Ígnea y Plasma descubiertas
await ev(`__arcano.school('fire')`); await ev('__arcano.goto(6)'); await ev('__arcano.clear()'); await ev('__arcano.step(0.3)');
await ev('__arcano.offer()'); await sleep(700);
const hasR = () => ev(`!!document.querySelector('#overlay .rombo.mini')`);
ok(await fits(), '1º despertar (4 cartas): cabe sin desplazamiento');
ok(await hasR(), `1º despertar (4 cartas, ${H}px de alto): con mini-rombo`);
ok(await ev(`document.querySelectorAll('.rombo.mini .v.go').length`) === 4, 'los 4 elementos laten (puedes despertar en cualquiera)');
await shot('05-panel1');
await ev('__arcano.later()');
// pantalla más baja (barra del navegador): el rombo se quita para que el panel quepa sin desplazamiento
// pantalla diminuta (los mínimos de letra en px pesan más): con o sin rombo, el panel cabe sin desplazamiento
await send('Emulation.setDeviceMetricsOverride', { width: 270, height: 480, deviceScaleFactor: 2, mobile: true }); await sleep(300);
await ev('__arcano.offer()'); await sleep(500);
ok(await fits(), 'pantalla de 270x480: el panel cabe', { rombo: await hasR() });
await shot('05b-panel1-mini');
await ev('__arcano.later()');
// si aun así no cupiera (letra del sistema grande, textos largos…), el rombo se quita
await ev(`(() => { const s = document.createElement('style'); s.id = 'apretado'; s.textContent = '#overlay .panel { max-height: 70% !important; }'; document.head.appendChild(s); })()`);
await ev('__arcano.offer()'); await sleep(300);
ok(!(await hasR()), 'panel apretado: el mini-rombo se quita');
await ev('__arcano.later()'); await ev(`document.getElementById('apretado').remove()`);
await send('Emulation.setDeviceMetricsOverride', { width: WD, height: H, deviceScaleFactor: 2, mobile: true }); await sleep(300);
// 1º despertar con la Afinidad sellada: 2 cartas, rombo con lo cerrado apagado
await ev(`__arcano.give('bolt')`); await ev('__arcano.offer()'); await sleep(700);
ok(await hasR() && await fits(), 'Afinidad sellada (2 cartas): mini-rombo y cabe');
ok(await ev(`document.querySelectorAll('.rombo.mini .v.shut').length`) === 2, 'Hielo y Veneno apagados (cerrados)');
ok(await ev(`document.querySelectorAll('.rombo.mini .h.shut').length`) === 3, 'solo Plasma queda abierta en los lados');
await shot('06-panel1-sellado');
await ev('__arcano.later()');
// 2º despertar sin pareja: núcleo fuego; Plasma y Azufre posibles, Eclipse cerrada sin pacto
await ev(`__arcano.school('fire')`); await ev(`__arcano.awaken('fire')`); await ev('__arcano.goto(12)'); await ev('__arcano.clear()'); await ev('__arcano.step(0.3)');
await ev('__arcano.offer()'); await sleep(700);
ok(await hasR() && await fits(), '2º despertar: mini-rombo y cabe');
ok(await ev(`(() => { const v = document.querySelector('.rombo.mini .v.core'); return !!v && v.textContent.includes('🔥'); })()`), 'el núcleo (Fuego) lleva aro');
ok(await ev(`[...document.querySelectorAll('.rombo.mini .h.go')].map(e => e.textContent).join(',')`) === 'PLASMA,???', 'caminos: PLASMA (descubierta) y ??? (Azufre)', await ev(`[...document.querySelectorAll('.rombo.mini .h.go')].map(e => e.textContent).join(',')`));
ok(await ev(`document.querySelectorAll('.rombo.mini .h.shut').length`) === 2, 'Aurora y Mortaja cerradas (no tocan el núcleo)');
ok(!(await ev(`!!document.querySelector('.rombo.mini .ctr.go')`)), 'Eclipse sin pacto: el centro no late');
await shot('07-panel2');
await ev('__arcano.later()'); await ev('__arcano.pact()'); await ev('__arcano.offer()'); await sleep(700);
ok(await ev(`!!document.querySelector('.rombo.mini .ctr.go')`) && await ev(`document.querySelectorAll('.rombo.mini line.go').length`) === 3, 'con pacto: Eclipse late en el centro y 3 caminos');
ok(await fits(), 'con pacto: cabe');
ok(/Sella Fuego \+ Hielo · forma prohibida: −20% de vida/.test(await txt()), 'carta opuesta: el precio de la forma prohibida a la vista');
await shot('08-panel2-pacto');
await ev('__arcano.later()');

// ---------- 7. El aviso baja mientras se ve un logro ----------
console.log('--- 7. Aviso y logro');
const frames = async n => { for (let i = 0; i < n; i++) await ev('__arcano.step(1 / 60)'); }; // step pinta una vez por llamada
const noAch = async () => { for (let i = 0; i < 40 && (await ev('__arcano.ui()')).achBusy; i++) await sleep(500); };
await ev(`__arcano.school('fire')`); await ev('__arcano.goto(3)'); await ev('__arcano.god(true)'); await noAch(); await frames(30);
u = await ev('__arcano.ui()');
ok(u.toastY === 140, 'sin logro: aviso en su sitio', u.toastY);
ok(await ev(`__arcano.achPop('awaken1')`), 'logro en pantalla (aviso DOM)');
await ev(`__arcano.give('ice')`); // AFINIDAD · FUEGO + HIELO
await frames(20);
u = await ev('__arcano.ui()');
ok(u.toastY >= 180, 'con logro: el aviso baja', u.toastY);
const box = await ev(`(() => { const a = document.getElementById('achToast').getBoundingClientRect(), c = document.querySelector('canvas').getBoundingClientRect(), s = c.width / 540; return { bottom: (a.bottom - c.top) / s }; })()`);
ok(box.bottom < u.toastY, 'el aviso queda por debajo del logro', { logro: Math.round(box.bottom), aviso: u.toastY });
await shot('09-aviso-bajo-logro');
await noAch(); await frames(30);
ok((await ev('__arcano.ui()')).toastY <= 142, 'al irse el logro, el aviso vuelve arriba', (await ev('__arcano.ui()')).toastY);

// ---------- 8. Textos ----------
const html = await ev('document.body.innerText');
ok(!/Lux|Elementalista|Isaac|Final Spark/.test(html), 'sin nombres prohibidos');
console.log(fails ? `${fails} FALLOS` : 'TODO OK');
