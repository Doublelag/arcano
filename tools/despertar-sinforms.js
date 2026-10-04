// El juego sin forms.js: se bloquea la carga (o, si file:// no se deja bloquear, una copia del index sin el script)
// y se juegan unas salas como en smoke.js. Debe ir como siempre y sin errores en consola.
// Uso: CDP_PORT=9433 node tools/cdp.mjs 360 640 tools/despertar-sinforms.js
const fs = await import('node:fs');
await send('Network.enable');
await send('Network.setBlockedURLs', { urls: ['*forms.js*'] });
await send('Page.reload', { ignoreCache: true });
await sleep(1800);
let how = 'bloqueo CDP';
if (await ev('typeof window.ArcanoForms') !== 'undefined') {
  how = 'copia sin <script src="forms.js">';
  const html = fs.readFileSync('E:/PROYECTOS/arcano/public/index.html', 'utf8')
    .replace('<script src="forms.js"></script>', '').replace('<head>', '<head>\n<base href="../public/">');
  fs.writeFileSync('E:/PROYECTOS/arcano/tools/_noforms.html', html);
  await send('Page.navigate', { url: 'file:///E:/PROYECTOS/arcano/tools/_noforms.html?debug' });
  await sleep(1800);
}
console.log('sin forms.js por', how, '· ArcanoForms =', await ev('typeof window.ArcanoForms'), '· estado', await ev('__arcano.state'));
await ev(`document.querySelector('[data-act="play"]').click()`);
await sleep(400);
await ev('__arcano.pick(0)');
await ev('__arcano.god(true)');
const sk0 = await ev('JSON.stringify(__arcano.player.sk)');
await ev(`__arcano.give('ice')`); await ev(`__arcano.give('bolt')`); await ev(`__arcano.give('poison')`);
console.log('runas', sk0, '→', await ev('JSON.stringify(__arcano.player.sk)'), '· formInfo', JSON.stringify(await ev('__arcano.formInfo()')).slice(0, 160));
console.log('anillo en el botón:', await ev(`document.getElementById('btnUlt').className`));
await ev('__arcano.offer()');
console.log('offer() sin formas → estado', await ev('__arcano.state'));
for (let i = 0; i < 60; i++) {
  const st = await ev('__arcano.state');
  if (st === 'levelup' || st === 'altar') await ev('__arcano.pick(0)');
  else if (st === 'play') await ev(`(() => { const A = __arcano; A.player.hp = A.player.maxHp; if (!A.enemies.some(e => !e.dead)) A.toDoor(); return A.step(1); })()`);
  else if (st === 'transition') await ev('__arcano.step(1)');
  else break;
}
console.log('final', await ev('__arcano.state'), 'sala', await ev('__arcano.room'), 'nivel', await ev('__arcano.player && __arcano.player.lvl'), 'disparos con sty', await ev('__arcano.shots.filter(s => s.sty).length'));
await ev('__arcano.ult()'); await ev('__arcano.step(1)');
const r = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync((process.env.SHOTS || '.') + '/20-sin-forms.png', Buffer.from(r.result.data, 'base64'));
try { fs.unlinkSync('E:/PROYECTOS/arcano/tools/_noforms.html'); } catch (_) { /* no había copia */ }
