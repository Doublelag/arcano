// Pruebas de la interfaz del Despertar (fase 1): menú con Grimorio, pantalla del Grimorio, pausa con forma,
// final ("Ganaste/Caíste como X", "Te faltan", "Nueva página") y estadísticas.
// Uso: SHOTS=carpeta CDP_PORT=9434 node tools/cdp.mjs 360 640 tools/grimorio.js
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'shots-grimorio';
const TAG = process.env.TAG || '';
fs.mkdirSync(OUT, { recursive: true });
const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${name}${TAG}.png`, Buffer.from(r.result.data, 'base64')); };
let fails = 0;
const ok = (c, msg, x) => { console.log((c ? 'OK   ' : 'FAIL ') + msg + (x !== undefined ? '  ' + JSON.stringify(x) : '')); if (!c) fails++; };
const st = () => ev('__arcano.state');
const txt = () => ev(`document.getElementById('overlay').innerText`);
const click = sel => ev(`(() => { const e = document.querySelector('${sel}'); if (!e) return false; e.click(); return true; })()`);
const fits = () => ev(`(() => { const p = document.querySelector('#overlay .panel, #overlay .popup'); return p ? p.scrollHeight <= p.clientHeight + 1 : null; })()`);
const VK = { Escape: 27 };
const key = async code => { await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: code, windowsVirtualKeyCode: VK[code] }); await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: code, windowsVirtualKeyCode: VK[code] }); };
const wait = () => sleep(450); // lockUntil de los botones (350 ms)

await ev('__arcano.flags.freeze = true');
await ev('__arcano.grim(true)'); // Grimorio vacío

// ---------- 1. Menú ----------
console.log('--- 1. Menú');
await sleep(500);
let t = await txt();
ok(/Grimorio\s*1\/10/.test(t), 'botón "Grimorio 1/10"', t.match(/Grimorio[^\n]*/) && t.match(/Grimorio[^\n]*/)[0]);
ok(/Logros\s*\d+\/26/.test(t), 'botón Logros en la misma fila');
ok(await ev(`(() => { const a = document.querySelector('[data-act="grimoire"]'), b = document.querySelector('[data-act="stats"]'), c = document.querySelector('[data-act="settings"]');
  return a.parentElement === b.parentElement && c.parentElement !== a.parentElement && c.parentElement.children.length === 1; })()`), 'Grimorio | Logros en una fila y Ajustes solo en otra');
ok(await fits(), 'el menú cabe sin desplazamiento');
await shot('01-menu');

// ---------- 2. Grimorio vacío ----------
console.log('--- 2. Grimorio vacío');
await click('[data-act="grimoire"]'); await wait();
ok(await st() === 'grimoire', 'state grimoire', await st());
t = await txt();
ok(/GRIMORIO/.test(t) && /1 de 24 páginas · 4%/.test(t), 'título y contador 1/24 (fase 2: 10 formas + 6 reacciones + 8 Mezclas)', t.split('\n').slice(0, 3));
ok(await ev(`document.querySelectorAll('.shop-item.grim').length`) === 10, '10 formas');
ok(await ev(`document.querySelectorAll('.shop-item.grim.locked').length`) === 9, '9 huecos (Aprendiz siempre descubierta)');
ok(/La forma prohibida\. Algo duerme entre los opuestos/.test(t), 'Eclipse: "La forma prohibida…"');
ok(/🔥 \+ ⚡ · \?\?\?/.test(t), 'híbrida: receta con iconos y ???');
ok(!/Plasma|Aurora|Mortaja|Azufre|Eclipse|Ígnea|PLASMA|ECLIPSE/.test(t), 'no revela nombres sin descubrir');
ok(!/Lux|Elementalista|Isaac/.test(t), 'sin nombres prohibidos');
await sleep(300);
await shot('02-grimorio-vacio');
await ev(`document.querySelector('#overlay .panel').scrollTop = 99999`); await sleep(200);
await shot('03-grimorio-vacio-abajo');
await click('[data-act="grim"][data-tab="reacciones"]'); await wait();
t = await txt();
ok(await ev(`document.querySelectorAll('.shop-item.grim').length`) === 6, 'pestaña Reacciones: 6 entradas');
ok(/data-tab="mezclas"/.test(await ev(`document.getElementById('overlay').innerHTML`)), 'pestaña de Mezclas (fase 2)');
await shot('04-grimorio-reacciones');
await key('Escape'); await sleep(200);
ok(await st() === 'menu', 'Escape vuelve al menú', await st());
await click('[data-act="grimoire"]'); await wait();
ok(await ev(`document.querySelector('.grim-tabs .tab.on').dataset.tab`) === 'formas', 'al abrir desde el menú, pestaña Formas');
await click('[data-act="back"]'); await wait();
ok(await st() === 'menu', 'VOLVER vuelve al menú');

// ---------- 3. Partida: Ígnea y luego Plasma; pausa ----------
console.log('--- 3. Pausa con forma');
await ev(`__arcano.school('fire')`); await ev('__arcano.god(true)');
await ev('__arcano.anima(64)');
await key('Escape'); await sleep(200);
t = await txt();
ok(/Aprendiz · Afinidad: Fuego · Despertar 64%/.test(t), 'pausa Aprendiz: "Aprendiz · Afinidad: Fuego · Despertar 64%"', (t.match(/.*Despertar.*/) || [''])[0]);
await key('Escape'); await sleep(100);
await ev(`__arcano.awaken('fire')`);
await ev(`__arcano.give('bolt')`); // sella Fuego + Rayo
await ev('__arcano.anima(40)');
// reacción de verdad para el Grimorio: fuego y luego rayo sobre el mismo enemigo
await ev(`(() => { const A = __arcano, i = A.enemies.findIndex(e => !e.dead), e = A.enemies[i]; e.spawnT = 0; e.hp = e.maxHp = 1e5; A.hit(i, ['fire']); A.enemies[i].reactCd = 0; return A.hit(i, ['bolt']); })()`);
await ev('__arcano.step(0.1)');
await key('Escape'); await sleep(200);
t = await txt();
ok(/Forma: ÍGNEA · Afinidad: Fuego \+ Rayo · Despertar 25%/.test(t), 'pausa Ígnea: forma, Afinidad y Despertar 25%', (t.match(/.*Forma.*/) || [''])[0]);
ok((t.match(/Cerrada esta partida/g) || []).length === 5, '5 reacciones "Cerrada esta partida" (solo queda SOBRECARGA)', (t.match(/Cerrada esta partida/g) || []).length);
ok(await fits(), 'la pausa cabe sin desplazamiento');
await shot('05-pausa-ignea');
await key('Escape'); await sleep(100);
await ev(`__arcano.awaken('bolt')`);
await key('Escape'); await sleep(200);
t = await txt();
ok(/Forma: PLASMA · Fuego \+ Rayo/.test(t) && !/Despertar \d/.test(t), 'pausa Plasma: "Forma: PLASMA · Fuego + Rayo"', (t.match(/.*Forma.*/) || [''])[0]);
ok(await fits(), 'la pausa cabe sin desplazamiento (Plasma)');
await shot('06-pausa-plasma');

// ---------- 4. Final: abandonar ----------
console.log('--- 4. Final');
await click('[data-act="quit"]'); await wait(); await click('[data-act="quit"]'); await sleep(300);
ok(await st() === 'over', 'partida abandonada', await st());
t = await txt();
ok(/Terminaste como Plasma/.test(t), 'emblema "Terminaste como Plasma"');
ok(/(\d páginas nuevas|Nueva página) del Grimorio/.test(t), 'página nueva del Grimorio', (t.match(/.*Grimorio.*/) || [''])[0]);
ok(/Te faltan: ❄️ \?\?\?, ⚡ \?\?\?, ☠️ \?\?\?, ⚡\+❄️ \?\?\? \+3/.test(t), 'Te faltan: 4 y "+3"', (t.match(/Te faltan.*/) || [''])[0]);
ok(await fits(), 'el final cabe sin desplazamiento');
await shot('07-final-abandono');

// ---------- 5. Final: victoria (Grimorio: bit de victoria y logro formWins con las 5) ----------
await ev(`(() => { const g = __arcano.grim(); g.w = (1 << 5) | (1 << 7) | (1 << 8) | (1 << 9); g.f |= (1 << 6) | (1 << 7) | (1 << 8) | (1 << 9); return g; })()`);
await ev(`__arcano.school('ice')`); await ev('__arcano.god(true)');
await ev(`__arcano.awaken('ice')`); await ev(`__arcano.awaken('bolt')`); // Aurora
await ev('__arcano.goto(20)'); await ev('__arcano.step(0.2)'); await ev('__arcano.clear()');
for (let i = 0; i < 12 && await st() !== 'win'; i++) await ev('__arcano.step(0.5)');
ok(await st() === 'win', 'victoria', await st());
t = await txt();
ok(/Ganaste como Aurora/.test(t), 'emblema "Ganaste como Aurora"');
ok(await ev(`!!(__arcano.grim().w & (1 << 6))`), 'grim.w con el bit de Aurora');
ok(await ev(`__arcano.ach().includes('formWins')`), 'logro formWins (Mil caras) al ganar con las 5 combinadas');
ok(await ev(`['awaken1', 'awaken2', 'hybrids'].every(k => __arcano.ach().includes(k))`), 'logros awaken1, awaken2 e hybrids (las 4 híbridas en grim.f)');
ok(await fits(), 'el final de victoria cabe sin desplazamiento');
await shot('08-final-victoria');

// ---------- 6. Grimorio con formas, título y estadísticas ----------
console.log('--- 6. Grimorio con formas');
await click('[data-act="menu"]'); await wait();
t = await txt();
ok(/Grimorio\s*8\/10/.test(t), 'menú: Grimorio 8/10', t.match(/Grimorio[^\n]*/) && t.match(/Grimorio[^\n]*/)[0]);
await click('[data-act="grimoire"]'); await wait();
t = await txt();
ok(/Ígnea/.test(t) && /Plasma/.test(t) && /Glacial/.test(t), 'formas descubiertas con nombre');
ok(/Despertada 1 vez/.test(t), '"Despertada 1 vez"');
ok(/¡Soy una estrella!/.test(t), 'frase de Plasma');
ok(await ev(`document.querySelectorAll('.rombo .h.on').length`) === 4, 'rombo: las 4 híbridas en los lados');
ok(await ev(`!!document.querySelector('[data-act="title"]')`), 'botón Lucir título (Marca II)');
await shot('09-grimorio-formas');
await click('[data-act="title"]'); await wait();
ok(await ev('__arcano.grim().t') >= 0, 'título elegido', await ev('__arcano.grim().t'));
await ev(`document.querySelector('#overlay .panel').scrollTop = 520`); await sleep(200);
await shot('10-grimorio-formas-medio');
await click('[data-act="grim"][data-tab="reacciones"]'); await wait();
t = await txt();
ok(/SOBRECARGA/.test(t), 'Reacciones: SOBRECARGA descubierta');
await shot('11-grimorio-reacciones');
await click('[data-act="back"]'); await wait();
t = await txt();
ok(/«Llama Viva»|«Invierno Quieto»|«Luz del Norte»|«Estrella Caída»/.test(t), 'título bajo el logo del menú', (t.match(/«.*»/) || [''])[0]);
ok(await fits(), 'el menú con título cabe sin desplazamiento');
await shot('12-menu-titulo');
await click('[data-act="stats"]'); await wait();
t = await txt();
ok(/Formas\s*8\/10/.test(t), 'estadísticas: Formas 8/10');
ok(/Despertar medio \(sala\)\s*1 \/ 1/.test(t), 'estadísticas: Despertar medio', (t.match(/Despertar medio[^\n]*\n[^\n]*/) || [''])[0]);
await shot('13-estadisticas');
await click('[data-act="back"]'); await wait();

// ---------- 7. Atrás de Android (popstate) en el Grimorio ----------
await click('[data-act="grimoire"]'); await wait();
await ev(`history.pushState({ arcano: 1 }, ''); history.back();`); await sleep(300);
ok(await st() === 'menu', 'Atrás de Android en el Grimorio vuelve al menú', await st());

// ---------- 8. Sincronización entre pestañas (storage) ----------
await click('[data-act="grimoire"]'); await wait();
await ev(`(() => { const m = JSON.parse(localStorage.getItem('arcano.meta')); m.grim.f = 1023; localStorage.setItem('arcano.meta', JSON.stringify(m)); window.dispatchEvent(new StorageEvent('storage', { key: 'arcano.meta', newValue: JSON.stringify(m) })); })()`);
await sleep(200);
ok(await st() === 'grimoire' && /1[0-9] de 24|2[0-4] de 24/.test(await txt()), 'storage: el Grimorio se redibuja con el progreso de otra pestaña', (await txt()).split('\n')[1]);

// ---------- 9. Eclipse: logros eclipse y forms10, marca e (sala <= 6) solo en el 1er despertar ----------
await ev(`(() => { const g = __arcano.grim(true); g.f = 1023 & ~(1 << 9); })()`);
await ev(`__arcano.school('fire')`); await ev('__arcano.god(true)');
await ev(`__arcano.give('ice')`); await ev('__arcano.pact()');
await ev(`__arcano.awaken('fire')`); await ev(`__arcano.awaken('ice')`);
ok(await ev('__arcano.player.form') === 'eclipse', 'Eclipse con pareja opuesta y pacto');
ok(await ev(`['eclipse', 'forms10'].every(k => __arcano.ach().includes(k))`), 'logros Equilibrio roto y Grimorio de formas');
ok(await ev(`(() => { const g = __arcano.grim(); return !!(g.e & 2) && !(g.e & (1 << 9)) && g.n[1] === '1' && g.n[9] === '1'; })()`), 'grim.e solo con la pura y grim.n cuenta cada forma', await ev('__arcano.grim()'));

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
