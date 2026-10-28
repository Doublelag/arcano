// Comprobación estática del sitio (sin dependencias): node tools/check.mjs
// - Todos los JS de public/ se pueden analizar (sin errores de sintaxis).
// - Todo lo que enlaza index.html (scripts, estilos, iconos, manifest) existe en public/.
// - Los iconos del manifest y la lista PRECACHE del service worker apuntan a archivos reales.
// - wrangler.jsonc publica la carpeta public/.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(ROOT, 'public');
let fails = 0, oks = 0;
const ok = (cond, name) => { if (cond) oks++; else { fails++; console.log('FALLO', name); } };
const local = (ref) => !/^(https?:|data:|mailto:|#|\/\/)/.test(ref);
const exists = (ref) => existsSync(join(PUB, ref.split(/[?#]/)[0]));

// 1. sintaxis de cada JS de public/
for (const f of readdirSync(PUB).filter((f) => f.endsWith('.js'))) {
  try { new vm.Script(readFileSync(join(PUB, f), 'utf8'), { filename: f }); ok(true, f); }
  catch (e) { ok(false, `${f} no se puede analizar: ${e.message}`); }
}

// 2. referencias de index.html
const html = readFileSync(join(PUB, 'index.html'), 'utf8');
const refs = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter(local);
ok(refs.length > 0, 'index.html tiene referencias locales');
for (const r of refs) ok(exists(r), `index.html enlaza "${r}" y no existe`);
// los scripts en línea también deben poder analizarse
for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
  try { new vm.Script(m[1]); ok(true, 'script en línea'); } catch (e) { ok(false, `script en línea de index.html: ${e.message}`); }
}
// la imagen para compartir (og:image) es una URL absoluta: su archivo debe estar en public/
for (const m of html.matchAll(/content="https?:\/\/[^"/]+\/([^"]+\.(?:png|jpe?g|webp))"/g)) ok(exists(m[1]), `og/twitter image "${m[1]}" no existe`);

// 3. manifest
const man = JSON.parse(readFileSync(join(PUB, 'manifest.webmanifest'), 'utf8'));
ok(man.name && man.start_url, 'manifest con name y start_url');
for (const ic of man.icons || []) ok(exists(ic.src), `icono del manifest "${ic.src}" no existe`);

// 4. PRECACHE del service worker
const sw = readFileSync(join(PUB, 'sw.js'), 'utf8');
const pre = sw.match(/const PRECACHE = \[([\s\S]*?)\];/);
ok(pre, 'sw.js define PRECACHE');
if (pre) for (const [, u] of pre[1].matchAll(/'([^']+)'/g)) if (u !== './') ok(exists(u), `PRECACHE de sw.js incluye "${u}" y no existe`);
// y cada script que carga index.html está en PRECACHE (si no, no funciona sin conexión)
if (pre) for (const r of refs.filter((r) => r.endsWith('.js') && r !== 'sw.js')) ok(pre[1].includes(`'${r}'`), `"${r}" falta en PRECACHE de sw.js`);

// 5. wrangler
const wr = readFileSync(join(ROOT, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
const cfg = JSON.parse(wr);
ok(cfg.assets && /^\.?\/?public\/?$/.test(cfg.assets.directory), 'wrangler.jsonc publica ./public');

console.log(fails ? `${fails} FALLOS (${oks} bien)` : `TODO OK (${oks} comprobaciones)`);
process.exit(fails ? 1 : 0);
