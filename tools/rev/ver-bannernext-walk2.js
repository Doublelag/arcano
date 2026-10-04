// Verificación: ¿con andar normal (tecla W, sin teletransporte) el rótulo ECLIPSE y las esquirlas pasan a la sala siguiente?
// La carta sale 0,8 s después de limpiar: el jugador lleva ~150 px andados. Probamos varias distancias a la puerta al acabar la cinemática.
const fs = await import('node:fs');
const OUT = process.env.SHOTS || 'E:/PROYECTOS/arcano/tools/out/rev';
fs.mkdirSync(OUT, { recursive: true });
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: { aff: 1, opp: 1, anima: 1, mix: 1 } }))`);
await send('Page.reload', {}); await sleep(1500);
await ev('__arcano.flags.freeze = true');
for (const startY of [128 + 110, 128 + 500]) {
  let seed = 1, ok = false;
  for (; seed < 200 && !ok; seed++) {
    await ev('__arcano.grim(true)');
    await ev(`__arcano.seed(${seed})`); await ev(`__arcano.school('fire')`); await ev(`__arcano.awaken('fire')`); await ev('__arcano.pact()');
    await ev('__arcano.goto(12)');
    ok = await ev(`(() => { const g = __arcano.grid; for (let r = 0; r < 14; r++) for (const c of [5, 6]) if (g[r * 12 + c]) return false; return true; })()`);
  }
  console.log('semilla', seed - 1, 'columna central libre', ok);
  await ev('__arcano.god(true)'); await ev('__arcano.step(1)'); await ev('__arcano.clear()'); await ev('__arcano.step(0.5)');
  await ev(`(() => { const p = __arcano.player; p.x = 270; p.y = ${startY}; })()`);
  await ev(`__arcano.awaken('ice', true)`);
  await ev('__arcano.step(1.42)');
  console.log('--- tras la cinemática, y =', startY, JSON.stringify(await ev('({ t: __arcano.toasts(), fx: __arcano.ambient(), awk: __arcano.formInfo().awakenFx })')));
  let shot = false;
  for (let i = 0; i < 60; i++) {
    await ev(`__arcano.step(0.1, ['KeyW'])`);
    const s = await ev('({ room: __arcano.room, state: __arcano.state, y: Math.round(__arcano.player.y), banner: __arcano.ui().banner && __arcano.ui().banner.text, next: __arcano.toasts().filter(x => x.startsWith("NEXT")), efx: __arcano.ambient().eclipseFx, en: __arcano.enemies.filter(e => !e.dead).length })');
    console.log((i / 10).toFixed(1), JSON.stringify(s));
    if (!shot && s.room === 13 && s.state === 'play' && s.efx) { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/walk-${startY}-efx.png`, Buffer.from(r.result.data, 'base64')); shot = true; }
    if (s.room === 13 && s.banner === 'ECLIPSE') { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/walk-${startY}-banner.png`, Buffer.from(r.result.data, 'base64')); console.log('ECLIPSE en sala 13 con', s.en, 'enemigos'); break; }
    if (s.room === 13 && !s.efx && !s.next.length) { console.log('sin restos'); break; }
    if (s.room === 12 && i > 30) { console.log('no llegó'); break; }
  }
}
