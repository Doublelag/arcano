// Verificación: sin forms.js (ArcanoForms nunca se define), ¿cuántos logros enseña el menú y la pantalla de Logros?
await send('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(window, 'ArcanoForms', { get() { return undefined; }, set(v) {}, configurable: false });` });
await ev(`localStorage.clear()`);
await send('Page.reload', { ignoreCache: true }); await sleep(1800);
console.log('ArcanoForms:', await ev('typeof window.ArcanoForms'));
console.log('menu:', (await ev(`document.getElementById('overlay').innerText`)).replace(/\n+/g, ' | ').slice(0, 200));
await ev(`document.querySelector('[data-act="stats"]').click()`); await sleep(500);
const t = await ev(`document.getElementById('overlay').innerText`);
console.log('stats head:', t.split('\n').slice(0, 3).join(' | '));
console.log('filas Despertar:', (t.match(/Despertar|Alma doble|Cuatro caminos|Equilibrio roto|Grimorio de formas|Mil caras|Mezclador/g) || []).join(','));
console.log('n items ach:', await ev(`document.querySelectorAll('.shop-item.ach').length`));
