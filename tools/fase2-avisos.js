// Fase 2: avisos en partida (Mezcla nueva y nuevo definitivo) a 360 px
// Uso: SHOTS=dir CDP_PORT=9435 node tools/cdp.mjs 360 640 tools/fase2-avisos.js
const fs = await import('node:fs');
const DIR = process.env.SHOTS || '.';
const P = code => ev(`(() => { const A = __arcano, E = A.enemies, P = A.player; ${code} })()`);
const shot = async name => { await sleep(150); const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${DIR}/${name}.png`, Buffer.from(r.result.data, 'base64')); };
// avanza hasta que el aviso en pantalla empiece por pre (como mucho 16 s)
const until = async pre => { for (let i = 0; i < 80; i++) { const t = await ev('__arcano.toasts()'); if (t[0] && t[0].startsWith(pre)) return true; await P(`if (A.state !== 'play') { document.getElementById('overlay').className = 'hidden'; A.pick(0); } A.step(0.2); return 1;`); } return false; };
await ev('__arcano.flags.freeze = true');
await ev('__arcano.seed(2)');
await ev(`__arcano.school('fire')`); await ev('__arcano.goto(3)'); await ev('__arcano.god(true)');
await P(`A.give('pierce'); return 1;`);
console.log('mezcla en pantalla:', await until('MEZCLA: '));
await ev('__arcano.step(0.3)');
await shot('aviso-mezcla');
await P(`A.awaken('fire'); A.give('poison'); return 1;`);
await ev(`__arcano.awaken('poison', true)`);
console.log('definitivo en pantalla:', await until('NUEVO DEFINITIVO'));
await ev('__arcano.step(0.3)');
await shot('aviso-definitivo');
