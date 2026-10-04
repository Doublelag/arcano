// Recorre la vista previa de formas en muchos instantes (y en calidad baja) buscando errores y midiendo el coste.
// Uso: CDP_URL=file:///E:/PROYECTOS/arcano/tools/forms-preview.html?static CDP_PORT=9431 node tools/cdp.mjs 900 1200 tools/sweep-forms.js
const r = await ev(`(() => {
  const t0 = performance.now(); let n = 0;
  for (let t = 0; t < 12; t += 0.037) { renderAt(t); n++; }
  return { frames: n, msPorFrame: +((performance.now() - t0) / n).toFixed(2) };
})()`);
console.log('barrido', JSON.stringify(r));
// API con datos raros: no debe lanzar
console.log('robustez', await ev(`(() => {
  const F = ArcanoForms, c = document.createElement('canvas').getContext('2d');
  c.lineJoin = 'round'; c.lineCap = 'square'; c.globalAlpha = 0.8; // estado previo raro: debe conservarse
  F.drawAura(c, { x: 0, y: 0 }, 'nada', 1, 0); F.drawAura(c, null, 'ignea', 1); F.drawAura(c, { x: 5, y: 5 }, 'mortaja', 1);
  F.drawShot(c, { x: 0, y: 0, vx: 0, vy: 0, sty: F.shotStyle('ignea') }, 1);
  F.drawShot(c, { x: 0, y: 0, vx: 1, vy: 0, sub: 'needle' }, 1);
  const nf = F.drawShot(c, { x: 0, y: 0, vx: 1, vy: 0 }, 1);
  F.drawOrb(c, 0, 0, 'nada', 1); F.drawOrb(c, 0, 0, 'eclipse', 1, { halo: true, anillo: true });
  F.drawPool(c, { x: 0, y: 0, r: 40, t: 1, max: 2, sulfur: true }, 1); F.drawPool(c, { x: 0, y: 0, r: 40 }, 1);
  F.drawAwaken(c, { t: 0.2, el: 'fire', st: 1 }, { x: 0, y: 0, aff: [] }, 1);
  F.drawAwaken(c, { t: 1.1, el: 'ice', st: 2, boom: true }, { x: 0, y: 0, aff: ['fire', 'ice'], core: 'fire', form: 'eclipse' }, 1, { t: 2 });
  F.drawArc(c, 0, 0, 0, 0, 1);
  const st = [c.globalAlpha, c.globalCompositeOperation, c.getLineDash().length, c.lineDashOffset, c.lineCap, c.lineJoin];
  return { sinEstiloDevuelveFalse: nf === false, estadoCtx: st };
})()`));
