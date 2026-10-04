// Captura de la vista previa de formas (tools/forms-preview.html).
// Uso: CDP_URL=file:///E:/PROYECTOS/arcano/tools/forms-preview.html?static CDP_PORT=9431 node tools/cdp.mjs 900 1200 tools/shot-forms.js
// Variables: SHOT_T (tiempo), SHOT_OUT (png de salida), SHOT_CLIP="x,y,w,h" (recorte en px CSS)
const fs = await import('node:fs');
const t = +(process.env.SHOT_T || 1.3);
const out = process.env.SHOT_OUT || 'E:/PROYECTOS/arcano/tools/forms-preview.png';
console.log('forms', await ev('typeof ArcanoForms'), 'render', await ev(`(renderAt(${t}), 'ok')`));
const p = { format: 'png' };
if (process.env.SHOT_CLIP) { const [x, y, width, height] = process.env.SHOT_CLIP.split(',').map(Number); p.clip = { x, y, width, height, scale: 1 }; }
const r = await send('Page.captureScreenshot', p);
fs.writeFileSync(out, Buffer.from(r.result.data, 'base64'));
console.log('guardado', out);
