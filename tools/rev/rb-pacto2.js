// Segundo pacto ya en Eclipse: ¿el altar sigue prometiendo "Abre el camino a Eclipse"?
const fs = await import('node:fs');
await ev(fs.readFileSync('E:/PROYECTOS/arcano/tools/rev/rb-harness.js', 'utf8'));
const r = await ev(`(() => {
  const A = __arcano;
  const P = RB.setup({ school: 'fire', path: ['fire', 'ice'], runes: ['fire', 'ice'], build: { hp: 2 }, pact: true });
  A.goto(19); P.xp = -1e12;
  for (let i = 0; i < 300 && A.state === 'play'; i++) { A.step(1 / 60); P.y -= 3; }
  const txt = document.getElementById('overlay').innerText.replace(/\\n+/g, ' / ');
  return { form: P.form, awak: P.awak, maxHp: P.maxHp, state: A.state, pacto: (txt.match(/Pacto oscuro[^/]*\\/[^/]*/) || [''])[0] };
})()`);
console.log(JSON.stringify(r));
const s = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('E:/PROYECTOS/arcano/tools/out/rev/pacto2.png', Buffer.from(s.result.data, 'base64'));
