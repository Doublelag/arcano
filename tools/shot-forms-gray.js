// Escala de grises + contador de cachés. Uso: CDP_URL=...forms-preview.html?static&gray CDP_PORT=9431 node tools/cdp.mjs 900 1200 tools/shot-forms-gray.js
const fs = await import('node:fs');
await ev('renderAt(1.3)');
console.log('caches', JSON.stringify(await ev('ArcanoForms.stats()')));
const r = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('E:/PROYECTOS/arcano/tools/forms-preview-gray.png', Buffer.from(r.result.data, 'base64'));
