// Jugador que nunca ha despertado (fresh: red a tras el Gólem): sala del 1º y 2º despertar, redes usadas y victorias.
// Uso: CDP_PORT=9437 node tools/cdp.mjs 360 640 tools/balance-novato.js
await ev('__arcano.flags.freeze = true');
const med = a => { const v = a.filter(Number.isFinite).sort((x, y) => x - y), m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
for (const c of [{ school: 'fire', path: ['fire', 'bolt'] }, { school: 'ice', path: ['ice', 'poison'] }, { school: 'arcane', path: ['ice', 'poison'] }]) {
  const a1 = [], a2 = [], nets = {}; let win = 0;
  for (let s = 1; s <= 16; s++) {
    const r = await ev(`(() => { const r = __arcano.sim(${JSON.stringify(Object.assign({ seed: s, fresh: true }, c))}); return { awk: r.awk, net: r.net, win: r.win }; })()`);
    a1.push((r.awk.find(a => a.st === 1) || {}).room); a2.push((r.awk.find(a => a.st === 2) || {}).room); for (const n of r.net) nets[n] = (nets[n] || 0) + 1; win += r.win ? 1 : 0;
  }
  console.log('novato', JSON.stringify(c).padEnd(45), '1º', med(a1), '2º', med(a2), 'redes', JSON.stringify(nets), 'victorias', win + '/16');
}
