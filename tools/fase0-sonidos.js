// Comprueba que los sonidos nuevos del Despertar se ejecutan sin errores (con contexto de audio real)
// Uso: CDP_PORT=9432 node tools/cdp.mjs 360 640 tools/fase0-sonidos.js
await tap(180, 320); // gesto del usuario para que el audio pueda arrancar
const calls = [['formReady', 523], ['awakenCharge'], ['awakenBoom', 1, 523], ['awakenBoom', 2, 659], ['awakenBoom', 2, 311, true],
  ['shootV', { f: 440, type: 'sawtooth', slide: 1.3, vol: 0.04 }], ['shootV', { f: 520, f2: 780, type: 'sine', slide: 1.4 }],
  ['shootV', { f: 600, type: 'square', slide: 1.5, noise: true }], ['shootV', null], ['mix'], ['fuse'], ['sizzle']];
for (const c of calls) { console.log(JSON.stringify(c), await ev(`__arcano.sfx(...${JSON.stringify(c)})`)); await sleep(80); }
console.log('estado audio', await ev(`(() => { try { return __arcano.sfx('click'); } catch (e) { return 'ERR ' + e.message; } })()`));
