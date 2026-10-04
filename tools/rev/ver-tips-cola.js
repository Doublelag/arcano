// Verificación: ¿se pierden avisos únicos (settings.tips) por el tope de la cola de avisos?
// Uso: CDP_PORT=9473 TIPS='{"anima":1}' EL=ice node tools/cdp.mjs 360 640 tools/rev/ver-tips-cola.js
const TIPS = process.env.TIPS || '{}';
const ELX = process.env.EL || 'ice';
await ev(`localStorage.setItem('arcano.settings', JSON.stringify({ tutorial: true, ultTip: true, tips: ${TIPS} }))`);
await ev(`localStorage.removeItem('arcano.meta')`);
await send('Page.reload', { ignoreCache: true }); await sleep(1500);
await ev(`__arcano.seed(7)`);
await ev(`__arcano.school('fire')`);
await ev('__arcano.god(true)');
await ev(`__arcano.give('atk', 6)`); await ev(`__arcano.give('atkspd', 4)`);
await ev(`__arcano.goto(5)`);
console.log('sala', await ev('__arcano.room'), 'aff', JSON.stringify(await ev('__arcano.formInfo().aff')), 'tips', await ev(`localStorage.getItem('arcano.settings')`));
const shown = []; let cur = null; const passed = new Set();
const track = async () => {
  const t = await ev('__arcano.toasts().filter(s => !s.startsWith("BANNER") && !s.startsWith("NEXT")).map(s => s.split(" | ")[0])');
  for (const x of t) passed.add(x);
  const c = t[0] || null;
  if (c !== cur) { cur = c; if (c) { shown.push(c); console.log('  EN PANTALLA:', c, '| cola:', JSON.stringify(t.slice(1))); } }
};
let picked = false, after = 0;
for (let i = 0; i < 3000; i++) {
  const st = await ev('__arcano.state');
  if (st === 'levelup') {
    const ids = await ev(`[...document.querySelectorAll('[data-act="pick"]')].map(c => c.dataset.id)`);
    if (ids.some(x => x.startsWith('awk:'))) {
      console.log('panel despertar:', ids.join(','), '| aviso en pantalla:', JSON.stringify(await ev('__arcano.toasts()')));
      const k = ids.indexOf('awk:' + ELX); await ev(`__arcano.pick(${k >= 0 ? k : 0})`); picked = true;
    } else { const j = ids.findIndex(x => !['fire', 'ice', 'bolt', 'poison'].includes(x)); await ev('__arcano.pick(' + Math.max(0, j) + ')'); }
  } else if (st === 'play' || st === 'transition') { await ev('__arcano.step(0.05)'); await track(); }
  else { console.log('estado', st); break; }
  if (picked && ++after > 400) break;
}
console.log('forma:', JSON.stringify(await ev(`(() => { const f = __arcano.formInfo(); return { form: f.form, aff: f.aff, net: f.net, mixes: f.mixes }; })()`)));
console.log('tips guardados:', JSON.stringify(await ev(`JSON.parse(localStorage.getItem('arcano.settings')).tips`)));
console.log('avisos que llegaron a la pantalla:', shown.join(' / '));
console.log('avisos que pasaron por la cola (alguna vez visibles en toasts()):', [...passed].join(' / '));
console.log('¿se vio SOLO 2 ELEMENTOS?', shown.includes('SOLO 2 ELEMENTOS POR PARTIDA'), '| ¿ALGO OSCURO?', shown.includes('ALGO OSCURO DUERME…'), '| ¿AFINIDAD?', shown.some(s => s.startsWith('AFINIDAD')));
