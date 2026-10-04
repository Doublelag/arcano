// Pruebas de la lógica pura de public/forms.js (window.ArcanoForms) sin navegador.
// Uso: node tools/test-forms.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const file = fileURLToPath(new URL('../public/forms.js', import.meta.url));
const src = readFileSync(file, 'utf8');
globalThis.window = globalThis;
vm.runInThisContext(src, { filename: file });
const F = globalThis.ArcanoForms;

let ok = 0, fail = 0;
function test(name, fn) {
  try { fn(); ok++; } catch (e) { fail++; console.log('FALLA:', name, '\n  ', e.message.split('\n').slice(0, 6).join('\n   ')); }
}
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg || ''} ${a} ≠ ${b}`);
const els = o => o.map(x => x.el);

// ---------- constantes ----------
test('constantes', () => {
  assert.deepEqual(F.SQUARE, ['fire', 'bolt', 'ice', 'poison']);
  assert.deepEqual(F.OPP, { fire: 'ice', ice: 'fire', bolt: 'poison', poison: 'bolt' });
  assert.equal(F.IDS.length, 10);
  F.IDS.forEach((id, i) => { assert.equal(F.FORMS[id].id, id); assert.equal(F.FORMS[id].bit, i); });
  assert.deepEqual(F.ANIMA.need, [100, 160]);
  assert.equal(F.ANIMA.wait, 0.8); assert.equal(F.ANIMA.glowAt, 0.8); assert.equal(F.ANIMA.arcane, 1.25);
  assert.equal(F.MIXES.length, 8);
  F.MIXES.forEach((m, i) => assert.equal(m.bit, i));
  assert.deepEqual(F.BOLT_LAYERS.plasma, [[6, 'rgba(255,90,209,.35)'], [2, '#fff0ff']]);
});
test('tiers y nombres', () => {
  assert.equal(F.FORMS.aprendiz.tier, 0);
  for (const id of ['ignea', 'glacial', 'voltaica', 'toxica']) assert.equal(F.FORMS[id].tier, 1);
  for (const id of ['plasma', 'aurora', 'mortaja', 'azufre', 'eclipse']) assert.equal(F.FORMS[id].tier, 2);
  assert.equal(F.FORMS.ignea.title, 'FORMA ÍGNEA');
  assert.equal(F.FORMS.mortaja.short, 'MORTAJA');
});
test('colores en #rrggbb (glowCache)', () => {
  const hex = /^#[0-9a-f]{6}$/;
  for (const id of F.IDS) {
    const f = F.FORMS[id], p = f.pal;
    assert.match(f.color, hex, id + ' color');
    for (const k of ['cape', 'robe', 'trim', 'brim', 'hatLine', 'band', 'star', 'gem', 'skin', 'eyeW', 'eyeP']) assert.match(p[k], hex, `${id}.pal.${k}`);
    p.hat.forEach(c => assert.match(c, hex, id + ' hat'));
    if (p.cracks) assert.match(p.cracks, hex);
    for (const k of ['glow', 'body', 'core', 'trail', 'trail2', 'ring', 'edge', 'c2', 'hit']) if (f.shot[k]) assert.match(f.shot[k], hex, `${id}.shot.${k}`);
    f.colors.forEach(c => assert.match(c, hex, id + ' colors'));
    assert.ok(f.voice.f > 0 && f.key > 0, id + ' voz/tono');
  }
  F.MIXES.forEach(m => assert.match(m.color, hex));
});
test('paletas = colores fijos actuales de drawPlayer', () => {
  const p = F.FORMS.aprendiz.pal;
  assert.equal(p.cape, '#2a1873'); assert.equal(p.robe, '#5b3fd1'); assert.equal(p.trim, '#ffcf4a'); assert.equal(p.brim, '#3a24a0');
  assert.deepEqual(p.hat, ['#6a4ff0', '#4a30c0', '#2c1a7a']); assert.equal(p.hatLine, '#1f1250'); assert.equal(p.star, '#ffcf4a');
});

// ---------- formFor / isOpp ----------
test('formFor', () => {
  assert.equal(F.formFor(null), 'aprendiz');
  assert.equal(F.formFor(undefined, 'fire'), 'aprendiz');
  assert.equal(F.formFor('fire'), 'ignea');
  assert.equal(F.formFor('ice', null), 'glacial');
  assert.equal(F.formFor('bolt'), 'voltaica');
  assert.equal(F.formFor('poison'), 'toxica');
  assert.equal(F.formFor('fire', 'bolt'), 'plasma');
  assert.equal(F.formFor('bolt', 'fire'), 'plasma');
  assert.equal(F.formFor('bolt', 'ice'), 'aurora');
  assert.equal(F.formFor('ice', 'bolt'), 'aurora');
  assert.equal(F.formFor('ice', 'poison'), 'mortaja');
  assert.equal(F.formFor('poison', 'ice'), 'mortaja');
  assert.equal(F.formFor('poison', 'fire'), 'azufre');
  assert.equal(F.formFor('fire', 'poison'), 'azufre');
  assert.equal(F.formFor('fire', 'ice'), 'eclipse');
  assert.equal(F.formFor('ice', 'fire'), 'eclipse');
  assert.equal(F.formFor('bolt', 'poison'), 'eclipse');
  assert.equal(F.formFor('poison', 'bolt'), 'eclipse');
  assert.equal(F.formFor('fire', 'fire'), 'ignea');
});
test('isOpp', () => {
  assert.equal(F.isOpp('fire', 'ice'), true);
  assert.equal(F.isOpp('ice', 'fire'), true);
  assert.equal(F.isOpp('bolt', 'poison'), true);
  assert.equal(F.isOpp('poison', 'bolt'), true);
  assert.equal(F.isOpp('fire', 'bolt'), false);
  assert.equal(F.isOpp('fire', 'fire'), false);
  assert.equal(F.isOpp(null, 'ice'), false);
});

// ---------- options (2.6, 2.7, 2.8) ----------
test('1º despertar: Arcanista sin Afinidad → 4 opciones, sin sellar', () => {
  const o = F.options({ stage: 1, aff: [], core: null, pact: false });
  assert.deepEqual(els(o), ['fire', 'bolt', 'ice', 'poison']);
  assert.deepEqual(o.map(x => x.form), ['ignea', 'voltaica', 'glacial', 'toxica']);
  assert.ok(o.every(x => !x.locked && x.why === null && x.seals === null));
});
test('1º despertar: Afinidad de 1 → 4 opciones, las ajenas sellan', () => {
  const o = F.options({ stage: 1, aff: ['fire'], core: null, pact: false });
  assert.deepEqual(els(o), ['fire', 'bolt', 'ice', 'poison']);
  assert.equal(o[0].seals, null);
  assert.deepEqual(o[1].seals, ['fire', 'bolt']);
  assert.deepEqual(o[2].seals, ['fire', 'ice']);
  assert.deepEqual(o[3].seals, ['fire', 'poison']);
  assert.ok(o.every(x => !x.locked)); // en el 1º nunca hay bloqueo (ni siquiera con opuestos)
});
test('1º despertar: Afinidad sellada → solo sus 2, en orden del cuadrado', () => {
  let o = F.options({ stage: 1, aff: ['fire', 'bolt'], pact: false });
  assert.deepEqual(els(o), ['fire', 'bolt']);
  assert.deepEqual(o.map(x => x.form), ['ignea', 'voltaica']);
  assert.ok(o.every(x => !x.locked && x.seals === null));
  o = F.options({ stage: 1, aff: ['poison', 'ice'], pact: false });
  assert.deepEqual(els(o), ['ice', 'poison']);
  o = F.options({ stage: 1, aff: ['ice', 'fire'], pact: false }); // opuestos: el 1º no se bloquea
  assert.deepEqual(els(o), ['fire', 'ice']);
  assert.ok(o.every(x => !x.locked));
});
test('2º despertar: Afinidad sellada vecina → solo el otro elemento', () => {
  const o = F.options({ stage: 2, aff: ['fire', 'bolt'], core: 'fire', pact: false });
  assert.equal(o.length, 1);
  assert.deepEqual(o[0], { el: 'bolt', form: 'plasma', locked: false, why: null, opp: false, seals: null });
  const o2 = F.options({ stage: 2, aff: ['fire', 'bolt'], core: 'bolt', pact: false });
  assert.deepEqual(els(o2), ['fire']); assert.equal(o2[0].form, 'plasma');
});
test('2º despertar: opuestos sin pacto → bloqueado; con pacto → Eclipse', () => {
  let o = F.options({ stage: 2, aff: ['fire', 'ice'], core: 'fire', pact: false });
  assert.equal(o.length, 1);
  assert.equal(o[0].el, 'ice'); assert.equal(o[0].form, 'eclipse');
  assert.equal(o[0].locked, true); assert.equal(o[0].why, 'pact'); assert.equal(o[0].opp, true);
  assert.ok(!o.some(x => !x.locked)); // todas bloqueadas → no hay panel
  o = F.options({ stage: 2, aff: ['fire', 'ice'], core: 'fire', pact: true });
  assert.equal(o[0].locked, false); assert.equal(o[0].why, null); assert.equal(o[0].form, 'eclipse');
  o = F.options({ stage: 2, aff: ['poison', 'bolt'], core: 'poison', pact: true });
  assert.deepEqual(els(o), ['bolt']); assert.equal(o[0].form, 'eclipse');
});
test('2º despertar: Afinidad de 1 → los 3 que no son núcleo; el opuesto pide pacto', () => {
  let o = F.options({ stage: 2, aff: ['ice'], core: 'ice', pact: false });
  assert.deepEqual(els(o), ['fire', 'bolt', 'poison']);
  assert.deepEqual(o.map(x => x.form), ['eclipse', 'aurora', 'mortaja']);
  assert.deepEqual(o.map(x => x.locked), [true, false, false]);
  assert.deepEqual(o.map(x => x.why), ['pact', null, null]);
  assert.deepEqual(o.map(x => x.seals), [['ice', 'fire'], ['ice', 'bolt'], ['ice', 'poison']]);
  o = F.options({ stage: 2, aff: ['ice'], core: 'ice', pact: true });
  assert.ok(o.every(x => !x.locked));
});
test('2º despertar: Arcanista que despertó sin runas', () => {
  const o = F.options({ stage: 2, aff: ['bolt'], core: 'bolt', pact: false });
  assert.deepEqual(els(o), ['fire', 'ice', 'poison']);
  assert.deepEqual(o.map(x => x.form), ['plasma', 'aurora', 'eclipse']);
  assert.deepEqual(o.map(x => x.locked), [false, false, true]);
});
test('options: etapas fuera de rango o sin núcleo', () => {
  assert.deepEqual(F.options({ stage: 3, aff: ['fire', 'bolt'], core: 'fire' }), []);
  assert.deepEqual(F.options({ stage: 2, aff: [], core: null }), []);
  assert.equal(F.options().length, 4); // por defecto, 1º despertar sin Afinidad
});

// ---------- sealInfo ----------
test('sealInfo', () => {
  assert.deepEqual(F.sealInfo(['fire'], 'bolt'), { form: 'plasma', opp: false, pair: ['fire', 'bolt'], closes: ['ice', 'poison'] });
  assert.deepEqual(F.sealInfo(['fire'], 'ice'), { form: 'eclipse', opp: true, pair: ['fire', 'ice'], closes: ['bolt', 'poison'] });
  assert.deepEqual(F.sealInfo(['poison'], 'ice'), { form: 'mortaja', opp: false, pair: ['poison', 'ice'], closes: ['fire', 'bolt'] });
  assert.equal(F.sealInfo(['bolt'], 'poison').form, 'eclipse');
  assert.equal(F.sealInfo(['fire'], 'fire'), null);
  assert.equal(F.sealInfo(['fire', 'bolt'], 'ice'), null);
  assert.equal(F.sealInfo([], 'fire'), null);
  assert.equal(F.sealInfo(['fire'], 'atk'), null);
  assert.equal(F.sealInfo(null, 'fire'), null);
  assert.equal(F.pairText('fire', 'bolt'), 'Fuego + Rayo');
});

// ---------- traitsFor ----------
test('traitsFor: Aprendiz sin rasgos', () => {
  assert.deepEqual(F.traitsFor(null, null, {}), {});
  assert.deepEqual(F.traitsFor(undefined), {});
});
test('traitsFor: puros', () => {
  assert.deepEqual(F.traitsFor('fire', null, {}), { burnK: 0.5, burnT: 3.5, deathBlast: { r: 55, k: 0.8 } });
  assert.deepEqual(F.traitsFor('ice', null), { slowT: 2.6, frzChance: 0.12, frzT: 0.7, frzBossT: 0.35 });
  assert.deepEqual(F.traitsFor('bolt', null), { chainP: 0.25, chainN: 3, chainR: 230, chainK: 0.5 });
  assert.deepEqual(F.traitsFor('poison', null), { poisonK: 0.15, poisonCap: 1.1, puddle: { r: 45, t: 2.5, k: 0, max: 5 } });
});
test('traitsFor: combinado = puro del núcleo + combinado, sin el puro del 2º', () => {
  const a = F.traitsFor('fire', 'bolt', {});
  assert.equal(a.burnK, 0.5); assert.deepEqual(a.plasmaArc, { p: 0.3, k: 0.5, r: 180 }); assert.equal(a.overR, 125); assert.equal(a.overK, 2.8);
  assert.equal(a.chainP, undefined); assert.equal(a.chainN, undefined);
  const b = F.traitsFor('bolt', 'fire', {});
  assert.equal(b.chainP, 0.25); assert.equal(b.chainN, 3); assert.deepEqual(b.plasmaArc, { p: 0.3, k: 0.5, r: 180 });
  assert.equal(b.burnK, undefined); assert.equal(b.deathBlast, undefined);
  const c = F.traitsFor('ice', 'bolt', {});
  assert.equal(c.slowT, 2.6); assert.equal(c.freezeT, 2); assert.equal(c.frozenMul, 1.5); assert.deepEqual(c.shards, { n: 6, k: 0.6 });
  const d = F.traitsFor('ice', 'poison', {});
  assert.deepEqual(d.shroud, { r: 90, k: 0.1 }); assert.equal(d.necroCap, 5); assert.equal(d.necroSpread, 100); assert.equal(d.poisonK, undefined);
});
test('traitsFor: el charco de Azufre sustituye al de Tóxica', () => {
  const t = F.traitsFor('poison', 'fire', {});
  assert.deepEqual(t.puddle, { r: 50, t: 3, k: 0.3, max: 6, sulfur: true });
  assert.equal(t.poisonK, 0.15); assert.equal(t.combR, 110); assert.equal(t.combK, 2); assert.equal(t.burnK, undefined);
});
test('traitsFor: Eclipse', () => {
  const t = F.traitsFor('fire', 'ice', {});
  assert.equal(t.atkMul, 1.2); assert.equal(t.hpMul, 0.85); assert.equal(t.pierce, 1); assert.equal(t.firstHit, true); assert.equal(t.reactCd, 0.6);
  assert.deepEqual(t.implode, { r: 110, k: 1, pull: 40 }); assert.equal(t.vaporK, 3.6); assert.equal(t.corrMul, 1.5); assert.equal(t.corrT, 5);
  assert.equal(t.burnK, 0.5); assert.equal(t.slowT, undefined);
  const u = F.traitsFor('poison', 'bolt', {});
  assert.equal(u.atkMul, 1.2); assert.equal(u.poisonK, 0.15); assert.equal(u.chainP, undefined);
});
test('traitsFor: cartas de forma', () => {
  let t = F.traitsFor('fire', null, { f_ignea: 2 });
  near(t.burnK, 0.7); assert.equal(t.deathBlast.r, 75);
  t = F.traitsFor('ice', null, { f_glacial: 2 }); near(t.frzChance, 0.24);
  t = F.traitsFor('bolt', null, { f_voltaica: 1 }); assert.equal(t.chainN, 4); near(t.chainP, 0.3);
  t = F.traitsFor('poison', null, { f_toxica: 1 }); near(t.poisonCap, 1.3); assert.equal(t.puddle.max, 6);
  t = F.traitsFor('fire', 'bolt', { f_plasma: 1, f_ignea: 1 }); near(t.plasmaArc.p, 0.4); near(t.overR, 137.5); near(t.burnK, 0.6); assert.equal(t.deathBlast.r, 65);
  t = F.traitsFor('fire', 'bolt', { f_plasma: 2 }); near(t.overR, 151.25);
  t = F.traitsFor('ice', 'bolt', { f_aurora: 2 }); assert.equal(t.shards.n, 10); near(t.freezeT, 2.6); assert.equal(t.freezeBossT, 0.7);
  t = F.traitsFor('ice', 'poison', { f_mortaja: 1 }); assert.equal(t.shroud.r, 115); near(t.shroud.k, 0.15);
  t = F.traitsFor('poison', 'fire', { f_azufre: 1, f_toxica: 1 }); assert.equal(t.puddle.r, 65); assert.equal(t.puddle.t, 4); assert.equal(t.puddle.max, 7); assert.equal(t.puddle.sulfur, true);
  t = F.traitsFor('bolt', 'poison', { f_eclipse: 2 }); assert.equal(t.implode.r, 160); near(t.implode.k, 1.8);
  t = F.traitsFor('fire', null, { f_glacial: 2, f_mortaja: 1 }); // cartas sin su rasgo base: no inventan claves
  assert.equal(t.frzChance, undefined); assert.equal(t.shroud, undefined);
  t = F.traitsFor('fire', null, { f_ignea: 9 }); near(t.burnK, 0.7); // tope de 2 niveles
});
test('traitsFor: devuelve copias (no toca FORMS)', () => {
  const t = F.traitsFor('fire', null, { f_ignea: 2 });
  t.deathBlast.k = 99;
  assert.equal(F.FORMS.ignea.trait.deathBlast.r, 55);
  assert.equal(F.FORMS.ignea.trait.deathBlast.k, 0.8);
  const a = F.traitsFor('poison', 'fire', { f_azufre: 2 });
  assert.equal(F.FORMS.azufre.trait.puddle.r, 50); assert.equal(a.puddle.r, 80);
  assert.notEqual(F.traitsFor('ice', 'bolt'), F.traitsFor('ice', 'bolt'));
});

// ---------- cartas ----------
test('cards()', () => {
  const cs = F.cards();
  assert.equal(cs.length, 9);
  assert.deepEqual(cs.map(c => c.id), ['f_ignea', 'f_glacial', 'f_voltaica', 'f_toxica', 'f_plasma', 'f_aurora', 'f_mortaja', 'f_azufre', 'f_eclipse']);
  for (const c of cs) {
    assert.equal(c.max, 2); assert.equal(c.w, 1.3);
    assert.equal('f_' + c.form, c.id);
    assert.ok(c.name && c.desc && c.icon);
    assert.equal(c.apply, undefined);
    assert.equal(c.cond, undefined);
  }
  assert.equal(cs[5].name, 'Luz polar');
  assert.notEqual(F.cards()[0], F.cards()[0]); // copias nuevas
});

// ---------- Mezclas ----------
const mixIds = sk => F.activeMixes(sk).map(m => m.id);
test('activeMixes', () => {
  assert.deepEqual(mixIds({}), []);
  assert.deepEqual(mixIds(null), []);
  assert.deepEqual(mixIds({ fire: 1, pierce: 1 }), ['cometa']);
  assert.deepEqual(mixIds({ fire: 1 }), []);
  assert.deepEqual(mixIds({ pierce: 2 }), []);
  assert.deepEqual(mixIds({ fire: 1, orbs: 1, bolt: 1 }), ['halo', 'anillo']);
  assert.deepEqual(mixIds({ ice: 2, wall: 1, ricochet: 2 }), ['glaciar', 'granizo']);
  assert.deepEqual(mixIds({ poison: 1, diag: 1, ricochet: 1 }), ['contagio', 'aguijon']);
  assert.deepEqual(mixIds({ bolt: 1, crit: 3 }), ['chispazo']);
  assert.deepEqual(mixIds({ fire: 0, pierce: 1 }), []);
});
test('mixHint', () => {
  const id = m => (m ? m.id : null);
  assert.equal(id(F.mixHint('pierce', { fire: 1 }, ['fire'])), 'cometa');
  assert.equal(id(F.mixHint('pierce', { fire: 1, pierce: 1 }, ['fire'])), null); // ya la tiene
  assert.equal(id(F.mixHint('fire', { pierce: 1 }, ['fire'])), 'cometa'); // la runa también completa
  assert.equal(id(F.mixHint('fire', { pierce: 1 }, [])), 'cometa');
  assert.equal(id(F.mixHint('orbs', { bolt: 1 }, ['bolt', 'ice'])), 'anillo');
  assert.equal(id(F.mixHint('orbs', { fire: 1, bolt: 1 }, ['fire', 'bolt'])), 'halo');
  assert.equal(id(F.mixHint('pierce', {}, ['fire'])), null);
  assert.equal(id(F.mixHint('ricochet', { ice: 1 }, ['ice', 'poison'])), 'granizo');
  assert.equal(id(F.mixHint('ricochet', { poison: 1 }, ['ice', 'poison'])), 'contagio');
  assert.equal(id(F.mixHint('fire', { pierce: 1, orbs: 1 }, ['ice', 'poison'])), null); // fuera de tu Afinidad sellada
  assert.equal(id(F.mixHint('diag', { poison: 2 }, ['poison'])), 'aguijon');
  assert.equal(id(F.mixHint('crit', { bolt: 1 }, ['bolt', 'fire'])), 'chispazo');
  assert.equal(id(F.mixHint('atk', { fire: 2 }, ['fire'])), null);
  assert.equal(id(F.mixHint('wall', { ice: 1 })), 'glaciar');
});
test('mixMul', () => {
  const cometa = F.MIXES[0];
  assert.equal(F.mixMul(cometa, 'fire', null), 1.25);
  assert.equal(F.mixMul(cometa, 'bolt', 'fire'), 1.25);
  assert.equal(F.mixMul(cometa, null, null), 1);
  assert.equal(F.mixMul(cometa, 'ice', 'bolt'), 1);
});

// ---------- bits del Grimorio ----------
test('bit / has / count', () => {
  assert.equal(F.bit('aprendiz'), 1);
  assert.equal(F.bit('ignea'), 2);
  assert.equal(F.bit('eclipse'), 512);
  assert.equal(F.bit('cometa'), 1);
  assert.equal(F.bit('aguijon'), 128);
  assert.equal(F.bit('nada'), 0);
  assert.equal(F.has(1, 'aprendiz'), true);
  assert.equal(F.has(1, 'ignea'), false);
  assert.equal(F.has(1 | 512, 'eclipse'), true);
  assert.equal(F.has(0xffff, 'nada'), false);
  assert.equal(F.count(0), 0);
  assert.equal(F.count(0b1011), 3);
  assert.equal(F.count(1023), 10);
  let m = 1; for (const id of ['plasma', 'aurora', 'mortaja', 'azufre']) m |= F.bit(id);
  assert.equal(F.count(m), 5);
});

// ---------- extras ----------
test('formEls / keyOf / ult', () => {
  assert.deepEqual(F.formEls('fire', 'bolt'), ['fire', 'bolt']);
  assert.deepEqual(F.formEls(null, null), []);
  assert.equal(F.keyOf('plasma', 'fire'), 523);
  assert.equal(F.keyOf('plasma', 'bolt'), 659);
  assert.equal(F.keyOf('eclipse', 'fire'), 311);
  assert.equal(F.keyOf('glacial', 'ice'), 784);
  assert.equal(F.keyOf('aprendiz'), 440);
  assert.equal(F.FORMS.aprendiz.ult, null);
  assert.equal(F.FORMS.ignea.ult.name, 'Meteoro');
  assert.equal(F.FORMS.plasma.ult.key, 'sun');
  assert.deepEqual(['plasma', 'aurora', 'mortaja', 'azufre', 'eclipse'].map(id => F.FORMS[id].ult.key), ['sun', 'curtain', 'fog', 'sulfur', 'void']);
});
test('timeline de la cinemática', () => {
  let L = F.timeline(0); assert.equal(L.scale, 0.15); assert.equal(L.lev, 0); assert.equal(L.zoom, 1);
  L = F.timeline(0.899); assert.equal(L.scale, 0.15); assert.ok(L.lev > 11.9 && L.zoom > 1.11);
  L = F.timeline(1.4); near(L.scale, 1); near(L.lev, 0); near(L.zoom, 1); near(L.dark, 0);
  L = F.timeline(1.15); assert.ok(L.scale > 0.15 && L.scale < 1);
});
test('ambient', () => {
  assert.equal(F.ambient('aprendiz'), null);
  for (const id of F.IDS.slice(1)) { const a = F.ambient(id); assert.ok(a && a.every > 0 && a.life > 0 && a.color, id); }
  assert.equal(F.ambient('azufre').normal, true);
  let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const q = F.spawnAmbient('ignea', { x: 100, y: 200 }, rnd);
  assert.ok(q.vy < 0 && q.life > 0 && q.max === q.life && q.color === '#ffb347' && q.normal === false);
  assert.equal(F.spawnAmbient('aprendiz', { x: 0, y: 0 }), null);
  let n = 0, em = 0; for (let i = 0; i < 200; i++) { const a = F.spawnAmbient('azufre', { x: 0, y: 0 }, rnd); if (a.normal) n++; else { em++; assert.equal(a.color, '#ff8a3d'); assert.ok(a.vy < 0); } }
  assert.ok(n > 120 && em > 10, `ceniza ${n} brasas ${em}`);
});
test('shotStyle: caché, Capa 0 y Mezclas', () => {
  const a = F.shotStyle('aprendiz', {}, false, ['#ff8a3d', '#ffe45c'], []);
  assert.equal(a, F.shotStyle('aprendiz', {}, false, ['#ff8a3d', '#ffe45c'], []));
  assert.equal(a.shape, 'orb'); assert.equal(a.glow, '#ff8a3d'); assert.equal(a.col2, '#ffe45c'); assert.equal(a.coreR, 5.5); assert.equal(a.glowR, 17); assert.equal(a.whiteR, 2.8);
  assert.equal(a.trailA, 'rgba(255,138,61,0.5)'); assert.equal(a.alpha, 1);
  const b = F.shotStyle('aprendiz', { atk: 6, crit: 4, pierce: 1, wall: 2 }, true, ['#ff8a3d'], []);
  near(b.coreR, 7.9); near(b.glowR, 26); near(b.whiteR, 3.6); assert.equal(b.ell, true); assert.equal(b.rim, '#fff1c4'); assert.equal(b.alpha, 0.7); assert.equal(b.col2, null);
  const c = F.shotStyle('ignea', { atk: 9 }, false, ['#ff8a3d', '#7fe3ff'], []);
  near(c.coreR, 7.9 * 1.1); assert.equal(c.col2, '#7fe3ff'); // forma pura con runa de otro elemento
  assert.equal(F.shotStyle('ignea', {}, false, ['#ff8a3d'], []).col2, null);
  assert.equal(F.shotStyle('plasma', {}, false, ['#ff8a3d', '#ffe45c'], []).col2, null);
  const d = F.shotStyle('ignea', { pierce: 1 }, false, ['#ff8a3d'], [F.MIXES[0]]);
  near(d.len, 1.4 * 1.45); assert.equal(d.trail2A, 'rgba(255,138,61,0.5)');
  assert.equal(F.shotStyle('toxica', {}, false, [], ['aguijon', 'contagio']).needle, true);
  assert.equal(F.shotStyle('aurora', {}, false, [], []).dbl, true);
  assert.equal(F.shotStyle('glacial', {}, false, [], []).hit, '#e6fbff');
  assert.equal(F.shotStyle('nada', {}, false, [], []).id, 'aprendiz');
});
test('look: cinta y cristal del Aprendiz', () => {
  const EL = { fire: { color: '#ff8a3d' }, bolt: { color: '#ffe45c' }, arcane: { color: '#c77dff' } };
  const a = F.look('aprendiz', { school: 'fire', aff: ['fire'] }, EL);
  assert.equal(a.band, '#ff8a3d'); assert.equal(a.band2, null); assert.equal(a.gem, '#ff8a3d'); assert.equal(a.robe, '#5b3fd1');
  const b = F.look('aprendiz', { school: 'fire', aff: ['fire', 'bolt'] }, EL);
  assert.equal(b.band, '#ff8a3d'); assert.equal(b.band2, '#ffe45c'); assert.equal(b.gem, '#ffe45c');
  assert.equal(b, F.look('aprendiz', { school: 'fire', aff: ['fire', 'bolt'] }, EL)); // caché
  const c = F.look('aprendiz', { school: 'arcane', aff: [] });
  assert.equal(c.band, '#c77dff'); assert.equal(c.gem, '#c77dff');
  assert.equal(F.look('plasma', { school: 'fire', aff: ['fire', 'bolt'] }), F.FORMS.plasma.pal);
  assert.equal(F.look('eclipse', {}).voidGem, true);
});
test('newPool', () => {
  const p = F.newPool(10, 20, F.FORMS.azufre.trait.puddle);
  assert.equal(p.r, 50); assert.equal(p.t, 3); assert.equal(p.max, 3); assert.equal(p.k, 0.3); assert.equal(p.sulfur, true);
  const q = F.newPool(0, 0, F.FORMS.toxica.trait.puddle);
  assert.equal(q.sulfur, false); assert.equal(q.k, 0);
});
test('sin nombres prohibidos en el texto', () => {
  const visible = [];
  for (const id of F.IDS) { const f = F.FORMS[id]; visible.push(f.name, f.short, f.title, f.line, f.trName, f.desc); if (f.ult) visible.push(f.ult.name, f.ult.desc); }
  for (const c of F.cards()) visible.push(c.name, c.desc);
  for (const m of F.MIXES) visible.push(m.name, m.desc, m.recipe);
  const txt = visible.join(' | ');
  for (const bad of [/\bLux\b/, /Elementalista/i, /Final Spark/i, /Fusionar/i, /Isaac/i, /Brimstone/i, /\bLuz\b(?! polar)/, /Oscuridad/]) assert.doesNotMatch(txt, bad);
  assert.doesNotMatch(src, /\bLux\b|Elementalista/);
});

console.log(`\n${ok} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
