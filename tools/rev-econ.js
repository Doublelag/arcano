// Revisión economía: partida real (sin sandbox) de un jugador nuevo con 2 despertares.
// La esencia ganada debe ser exactamente la de la partida (+✨ N del final) más los premios de los logros nuevos.
// Uso: CDP_PORT=9453 node tools/cdp.mjs 360 640 tools/rev-econ.js
const PATH = (process.env.PATH_ELS || 'fire,bolt').split(',');
await ev(`localStorage.clear()`);
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
await send('Page.reload', { ignoreCache: true }); await sleep(1500);
const REW = await ev(`(() => { const out = {}; document.querySelector('[data-act="stats"]').click(); return 1; })()`);
await sleep(400);
const rewards = await ev(`[...document.querySelectorAll('.shop-item.ach')].map(e => [e.querySelector('b').textContent, +(e.querySelector('.price').textContent.replace(/[^0-9]/g, '') || 0)])`);
await ev(`document.querySelector('[data-act="back"]').click()`); await sleep(400);
const res = await ev(`(() => {
  const A = __arcano; A.seed(${+process.env.SEED || 7});
  A.school('${process.env.SCHOOL || 'fire'}'); A.god(true);
  const L = { offers: 0, badOffer: 0, awk: [], stuck: 0 }, C = { path: ${JSON.stringify(PATH)}, stop: 2, pact: false };
  let clr = 0, n = 0;
  for (let i = 0; i < 40000; i++) {
    const st = A.state;
    if (st === 'play') { A.step(0.05); if (!A.enemies.some(e => !e.dead)) { clr += 0.05; if (clr > 2.5) { A.toDoor(); clr = 0; } } else clr = 0; }
    else if (st === 'transition' || st === 'dying') A.step(0.05);
    else if (st === 'levelup') A.botPick(C, L);
    else if (st === 'altar') A.pick(1);
    else break;
    n = i;
  }
  return { state: A.state, room: A.room, iters: n, awk: L.awk, form: A.player && A.player.form };
})()`);
console.log('partida:', JSON.stringify(res));
await sleep(3000);
const end = await ev(`document.getElementById('overlay').innerText`);
console.log('final:', end.split('\n').slice(0, 8).join(' | '));
const m = await ev(`JSON.parse(localStorage.getItem('arcano.meta'))`);
const earn = +((end.match(/\+✨ (\d+) de esencia/) || [])[1] || NaN);
const ach = Object.keys(m.ach).filter(k => m.ach[k]);
console.log('logros:', ach.join(','));
console.log('esencia guardada', m.essence, '· essenceTotal', m.stats.essenceTotal, '· partida +', earn, '· grim', JSON.stringify(m.grim));
console.log('premios en la lista de Logros:', JSON.stringify(rewards.filter(r => r[1]).map(r => r.join(':'))));
