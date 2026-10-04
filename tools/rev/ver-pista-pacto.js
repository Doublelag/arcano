// Verificación: pista "sella un Pacto oscuro en un altar" cuando ya no queda altar
const fs = await import('node:fs');
const OUT = 'E:/PROYECTOS/arcano/tools/out/rev/ver';
fs.mkdirSync(OUT, { recursive: true });
const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64')); };
await ev('__arcano.flags.freeze = true');
await ev(`__arcano.school('bolt')`); await ev('__arcano.god(true)');
await ev(`__arcano.give('poison')`);
console.log('aff', JSON.stringify((await ev('__arcano.formInfo()')).aff));
await ev(`__arcano.awaken('bolt')`);
// sala 18 limpia con Ánima llena: la pista es correcta (aún queda el altar 19)
await ev('__arcano.goto(18)'); await ev('__arcano.god(true)'); await ev('__arcano.clear()'); await ev('__arcano.step(1)');
await ev('__arcano.anima(1e6)'); await ev('__arcano.step(0.5)');
let fi = await ev('__arcano.formInfo()');
console.log('sala18', await ev('__arcano.room'), 'ready', fi.ready, 'lock', fi.lock, 'pactRun', fi.pactRun, 'state', await ev('__arcano.state'));
await shot('s18');
// sala 19: usar altar y elegir Fuente sagrada
await ev('__arcano.toDoor()'); for (let i = 0; i < 40 && (await ev('__arcano.room')) === 18; i++) await ev('__arcano.step(0.1)');
await ev('__arcano.god(true)'); await ev('__arcano.step(1)');
console.log('sala', await ev('__arcano.room'), 'state', await ev('__arcano.state'));
await shot('s19-antes');
await ev('__arcano.player.x = 270; __arcano.player.y = 480'); await ev('__arcano.step(0.2)');
console.log('altar abierto:', await ev('__arcano.state'), (await ev(`document.getElementById('overlay').innerText`)).replace(/\n+/g, ' / ').slice(0, 300));
await ev(`__arcano.pick([...document.querySelectorAll('[data-act="altar"]')].findIndex(c => c.dataset.id === 'heal'))`);
await ev('__arcano.player.y = 700'); await ev('__arcano.step(2)');
fi = await ev('__arcano.formInfo()');
console.log('tras curar', await ev('__arcano.state'), 'ready', fi.ready, 'lock', fi.lock, 'pactRun', fi.pactRun);
await shot('s19-despues');
// sala 20: matar al jefe
await ev('__arcano.toDoor()'); for (let i = 0; i < 40 && (await ev('__arcano.room')) === 19; i++) await ev('__arcano.step(0.1)');
await ev('__arcano.god(true)'); await ev('__arcano.step(4)');
console.log('sala', await ev('__arcano.room'), 'state', await ev('__arcano.state'));
await ev('__arcano.clear()'); await ev('__arcano.step(0.6)');
console.log('jefe muerto state', await ev('__arcano.state'));
await shot('s20-limpia');
await ev('__arcano.step(3)');
console.log('final state', await ev('__arcano.state'));
