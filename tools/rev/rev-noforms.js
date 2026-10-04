// Revisión: forms.js da 404 (http). El juego sigue, el Grimorio guardado no se pierde y no hay errores.
// Uso: servidor 8453; CDP_URL=about:blank
const srv = q => fetch('http://localhost:8453/' + q).then(r => r.text());
await srv('__root?dir=' + encodeURIComponent('E:/PROYECTOS/arcano/public'));
await send('Page.navigate', { url: 'http://localhost:8453/index.html?debug' }); await sleep(1500);
await ev(`(() => { localStorage.setItem('arcano.meta', JSON.stringify({ essence: 50, ach: { awaken1: true, reactAll: true }, grim: { f: 7, w: 1, e: 2, m: 3, n: '1110000000', k: [11, 2, 0, 0], t: 1 } }));
  localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { aff: 1, anima: 1 } })); })()`);
console.log(await srv('__block?f=forms.js&on=1'));
await send('Page.reload', { ignoreCache: true }); await sleep(1800);
console.log('ArcanoForms:', await ev('typeof window.ArcanoForms'), '· menú:', (await ev(`document.getElementById('overlay').innerText`)).replace(/\n+/g, ' | ').slice(0, 200));
await ev(`__arcano.school('fire')`);
await ev('__arcano.god(true)');
for (let i = 0; i < 400; i++) {
  const st = await ev('__arcano.state');
  if (st === 'levelup' || st === 'altar') await ev('__arcano.pick(0)');
  else if (st === 'play') await ev(`(() => { const A = __arcano; if (!A.enemies.some(e => !e.dead)) A.toDoor(); return A.step(1); })()`);
  else if (st === 'transition') await ev('__arcano.step(1)');
  else break;
}
await sleep(300);
console.log('final:', await ev('__arcano.state'), 'sala', await ev('__arcano.room'));
console.log('pantalla final:', (await ev(`document.getElementById('overlay').innerText`)).replace(/\n+/g, ' | ').slice(0, 300));
console.log('grim guardado:', await ev(`localStorage.getItem('arcano.meta').match(/"grim":\\{[^}]*\\}/)[0]`));
console.log('cookie grim:', await ev(`(() => { const m = document.cookie.match(/arcano_meta=([^;]*)/); return m && JSON.parse(decodeURIComponent(m[1])).grim; })()`));
console.log('logros:', await ev(`__arcano.ach().join(',')`), '· esencia', await ev(`JSON.parse(localStorage.getItem('arcano.meta')).essence`));
await ev(`document.querySelector('[data-act="menu"]').click()`); await sleep(500);
await ev(`document.querySelector('[data-act="stats"]').click()`); await sleep(500);
const t = await ev(`document.getElementById('overlay').innerText`);
console.log('Logros sin forms:', t.split('\n').slice(0, 3).join(' | '), '· filas Despertar:', (t.match(/Despertar|Alma doble|Cuatro caminos|Equilibrio roto|Grimorio de formas|Mil caras|Mezclador/g) || []).join(','));
console.log(await srv('__block?f=forms.js&on=0'));
