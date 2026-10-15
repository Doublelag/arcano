## 1. [medio] [logica] La cola de avisos tira los más antiguos al pasar de 3: en el despertar se pierden avisos únicos ("SOLO 2 ELEMENTOS POR PARTIDA", "MEZCLA: X", "AFINIDAD · X + Y") y quedan marcados como vistos para siempre
E:\PROYECTOS\arcano-rev\public\game.js:845
Escenario: Partida nueva y perfil nuevo. Piromante con la Afinidad sin sellar (aff=[fire]) llega al 1er despertar en la sala 5 o antes y elige Hielo. En el estallido se meten en cola AFINIDAD · FUEGO + HIELO, SOLO 2 ELEMENTOS POR PARTIDA y ALGO OSCURO DUERME…, y a los 1,4 s ¡NUEVA FORMA! y ¡CORONA DE GLACIAL! (5 avisos). pushToast hace toastQ.shift() en cuanto hay más de 3 esperando, así que SOLO 2 ELEMENTOS POR PARTIDA no llega a verse nunca, pero settings.tips.aff ya se guardó a 1 y no vuelve a salir en ninguna partida. Pasa lo mismo en el 2º despertar: Piromante con Concentración que despierta en Fuego y luego en Rayo encola AFINIDAD, SOLO 2, MEZCLA: CHISPAZO, MEZCLAS SECRETAS, NUEVO DEFINITIVO y ¡NUEVA FORMA!, y se pierden SOLO 2 ELEMENTOS y MEZCLA: CHISPAZO, que es el único aviso con la receta. Si aún se está leyendo otro aviso (por ejemplo el de DESPERTAR al 50%), también se pierde el propio AFINIDAD · FUEGO + HIELO. Un Pacto cuyas 2 cartas sellan y activan una Mezcla provoca lo mismo.
Arreglo verificado: Son dos líneas en E:\PROYECTOS\arcano-rev\public\game.js.

**1) Línea 845 (pushToast): subir el tope** para que quepa la ráfaga del despertar. Todas las fuentes de avisos tienen límite: una vez por partida, una vez por perfil o una vez por despertar, y toastQ se vacía en newRun.

```js
else { toastQ.push(o); if (toastQ.length > 8) toastQ.shift(); }
```

**2) Línea 2484 (updateFx): acelerar el aviso actual cuando hay cola**, para que no se acumulen 15-20 s de avisos. Cada uno sigue en pantalla unos 2 s como mínimo.

```js
if (toast && !cine) { toast.t -= dt * (toastQ.length > 2 ? 1.5 : 1); if (toast.t <= 0) toast = toastQ.shift() || null; }
```

Comprobado en la copia parcheada:
- 1er despertar en Hielo: AFINIDAD, SOLO 2 ELEMENTOS, ALGO OSCURO, ¡NUEVA FORMA! y ¡CORONA DE GLACIAL! se ven todos, en orden.
- 2º despertar en Rayo: AFINIDAD, SOLO 2, MEZCLA: CHISPAZO, MEZCLAS SECRETAS, NUEVO DEFINITIVO y ¡NUEVA FORMA! se ven todos.
- En los dos casos, "nunca mostrados: []".

**Opcional:** también se puede guardar settings.tips.* y seenHz cuando el aviso pasa a mostrarse y no al encolarlo. Con el tope a 8 deja de hacer falta para estos casos.

## 2. [bajo] [logica] El Pacto del altar sigue diciendo "Abre el camino a Eclipse" cuando ya está abierto o ya eres Eclipse, e invita a pagar otro 20% de vida para nada
E:\PROYECTOS\arcano-rev\public\game.js:4973
Escenario: Piromante que coge la Runa de hielo (Afinidad Fuego + Hielo) y firma el Pacto oscuro en el altar de la sala 9 (pactRun = true). En el altar de la sala 14 la carta del Pacto vuelve a decir "Pierdes el 20% de la vida máxima… · Abre el camino a Eclipse si tus elementos son opuestos". También sale si ya despertó Eclipse. El jugador puede firmar un 2º pacto creyendo que lo necesita para Eclipse y perder otro 20% de vida máxima sin ganar nada en ese camino.
Arreglo verificado: En E:\PROYECTOS\arcano-rev\public\game.js:4973, condicionar el añadido también a que el pacto no esté firmado:
`${FX() && !pactRun && player.aff.length === 2 && Forms().isOpp(player.aff[0], player.aff[1]) ? ' · Abre el camino a Eclipse si tus elementos son opuestos' : ''}`
En el juego real no se puede ser Eclipse sin pacto: F.options bloquea el opuesto sin pact, así que con `!pactRun` basta. Añadir `&& player.awak < 2` no hace daño y cubre el modo debug. Opcional: si pactRun ya es true, en vez de ocultarlo, enseñar " · El camino a Eclipse ya está abierto".

## 3. [bajo] [logica] La pista "Opuestos: sella un Pacto oscuro en un altar para despertar" sigue en pantalla cuando ya no queda ningún altar
E:\PROYECTOS\arcano-rev\public\game.js:4148
Escenario: Electromante que sella Rayo + Veneno (opuestos), despierta en Rayo y llena el Ánima del 2º despertar (por ejemplo con la red c tras el Brujo) sin haber firmado ningún pacto. En la sala 19 (último altar) elige Fuente sagrada en vez del Pacto. La píldora morada sigue pidiendo sellar un Pacto en un altar en la sala 19 y otra vez al limpiar la 20, aunque ya no queda ningún altar y en la sala 20 no hay oferta. El anillo del definitivo se queda en animalock y la pausa dice "Despertar: falta un Pacto oscuro": el objetivo que se le marca al jugador ya es imposible.
Arreglo verificado: In game.js, show the pill only while an altar is still usable: the current one unused, or one in a later room. Use ALTAR_ROOMS rather than hard-coding 19.

Line 4148:
    else if (player.animaReady && player.awkLock && cleared && !awakenFx && FX() && ((altar && !altar.used) || [...ALTAR_ROOMS].some(r => r > room))) hint('Opuestos: sella un Pacto oscuro en un altar para despertar', '#c77dff');

Result:
- Room 19 before using the altar: altar && !altar.used is true, so the pill shows.
- Room 19 after using it: the condition is false, so the pill is hidden.
- Room 20: altar is null and there is no altar room after 20, so the pill is hidden.
- Rooms 15 to 18: room 19 is still ahead, so the pill shows.

Optional, for consistency: in formLine (line 4782), when no altar is left, say 'Opuestos: sin Pacto no hay 2º despertar' instead of 'Despertar: falta un Pacto oscuro'. Use the same expression for this; it is currently written inline.

## 4. [alto] [interfaz] La cola de avisos tira justo los avisos clave del primer despertar (AFINIDAD, SOLO 2 ELEMENTOS, ¡NUEVA FORMA!) y los marca como vistos para siempre
E:\PROYECTOS\arcano-rev\public\game.js:843
Escenario: Perfil nuevo, Piromante, sala 5. Al matar al Gólem salta la red (a), que llena el Ánima. Esa misma llamada lanza el aviso 'DESPERTAR · El anillo del definitivo se llena…' (y el de ¡PINCHOS! si la sala tiene trampas). Se abre el panel y eliges Rayo: entran en cola AFINIDAD · FUEGO + RAYO, SOLO 2 ELEMENTOS, ¡NUEVA FORMA! y ¡CORONA DE VOLTAICA!, y luego MEZCLA y MEZCLAS SECRETAS con las cartas de nivel del jefe. pushToast solo guarda 3 en espera y descarta los más antiguos con toastQ.shift(). En pantalla solo salen DESPERTAR, ¡CORONA DE VOLTAICA!, MEZCLA: COMETA y MEZCLAS SECRETAS. El jugador nunca ve qué elementos se le han cerrado, ni la regla de los 2 elementos, ni '¡NUEVA FORMA! Grimorio 2/10'. Eligiendo Hielo (opuesto) se pierden AFINIDAD y SOLO 2 ELEMENTOS. Además settings.tips.aff (línea 885) y seenHz (línea 2547) se guardan al meter el aviso en la cola, no al enseñarlo, así que esos consejos no vuelven a salir nunca.
Arreglo verificado: Probado en la copia verq9472-fix5. Cambios en game.js:

1) Sustituir pushToast (843-846) por esto:
```js
// avisos en cola: el nuevo no pisa al que se está leyendo (como mucho 5 esperando). Si sobra uno se tira el de menos
// prioridad (pri 2 = consejo de una vez, 1 = AFINIDAD / ¡NUEVA FORMA!, 0 = resto), el más antiguo entre iguales.
// Los consejos de una vez (o.tip = clave de settings.tips, o.hz = trampa) se marcan como vistos al SALIR en pantalla.
function pushToast(o) {
  if ((o.tip || o.hz) && [toast, ...toastQ].some(t => t && ((o.tip && t.tip === o.tip) || (o.hz && t.hz === o.hz)))) return; // ya en cola
  if (!toast) return showToast(o);
  toastQ.push(o);
  if (toastQ.length > 5) {
    const lo = Math.min(...toastQ.map(t => t.pri || 0));
    toastQ.splice(toastQ.findIndex(t => (t.pri || 0) === lo), 1);
  }
}
function showToast(o) {
  toast = o;
  if (!o) return;
  if (o.tip) { settings.tips[o.tip] = 1; saveSettings(); }
  if (o.hz) { (settings.seenHz || (settings.seenHz = {}))[o.hz] = true; saveSettings(); }
}
```

2) En updateFx (2484-2485): cambiar `toast = toastQ.shift() || null` por `showToast(toastQ.shift() || null)`, y `toast = toastQ.shift()` por `showToast(toastQ.shift())`.

3) Quitar las marcas al encolar y añadir tip/pri a cada aviso:
- 855-856: quitar `settings.tips.anima = 1; saveSettings();` y añadir `tip: 'anima', pri: 2` al aviso DESPERTAR.
- 884: añadir `pri: 1` al aviso AFINIDAD.
- 885: `if (!settings.tips.aff) pushToast({ ...SOLO 2..., tip: 'aff', pri: 2 });`
- 886: `if (F.isOpp(a, b) && !settings.tips.opp) pushToast({ ...ALGO OSCURO..., tip: 'opp', pri: 2 });` y quitar el saveSettings() de la 887.
- 975: añadir `pri: 1` a '¡NUEVA FORMA!'.
- 1024: `if (!settings.tips.mix) pushToast({ ...MEZCLAS SECRETAS..., tip: 'mix', pri: 2 });` (sin el `settings.tips.mix = 1; saveSettings();`).
- hazardHints, 2546-2548: `if (seen[t] || !hz.includes(t) || [toast, ...toastQ].some(x => x && x.hz === t)) continue; pushToast({ text: HZ_INFO[t].name, sub: HZ_INFO[t].tip, color: HZ_INFO[t].color, t: 3, max: 3, hz: t, pri: 2 }); return;` (sin `seen[t] = true; saveSettings();`).

## 5. [medio] [interfaz] En la pantalla final, el aviso de logro tapa el emblema 'Ganaste como X' y la línea de la Marca II
E:\PROYECTOS\arcano-rev\public\game.js:4805
Escenario: Primera victoria con forma combinada (por ejemplo Plasma) y Marca II nueva. showEnd desbloquea firstWin (y boss4, Intocable, formWins o speedrun si tocan). El #achToast (top 104u, z-index 5) baja justo encima del emblema 'Ganaste como Plasma' y del principio de '👑 Marca II de Plasma: corona y título…'. Esas dos líneas se añadieron arriba del panel final, que ahora es más alto y queda pegado arriba. El logro dura 2,6 s y encadena con los siguientes de la cola, así que durante varios segundos no se lee con qué forma ganaste justo en el momento de la recompensa.
Arreglo verificado: Move the toast to the bottom while the end screen is up (state 'win' or 'over'), including the toast that is already showing when the screen opens.

1) style.css, after line 557 (#achToast.show):
#achToast.low { top: auto; bottom: calc(var(--u) * 24px); transform: translate(-50%, calc(var(--u) * 160px)); }
#achToast.low.show { transform: translate(-50%, 0); }

2) game.js nextAch() (line 511-512), just before achEl.classList.add('show'):
achEl.classList.toggle('low', state === 'win' || state === 'over');

3) game.js showEnd() (line 5113), right after state = win ? 'win' : 'over';:
achEl.classList.add('low'); // the 'Señor de nada' toast, unlocked as the boss died, is still showing: move it down too

Verified by injecting it at runtime at 360x640 and 412x915. The emblem, the Marca II line, the title and OTRA VEZ stay readable. The toast only covers SANTUARIO and MENÚ for a few seconds, and they can still be tapped through it (pointer-events: none). On the next screen, nextAch puts the toast back at the top based on state.

## 6. [medio] [interfaz] El primer panel DESPIERTA tras el Gólem sale con el aviso de logro encima del subtítulo y del rombo
E:\PROYECTOS\arcano-rev\public\game.js:2098
Escenario: Jugador que nunca ha despertado. Al matar al Gólem se desbloquea boss1 (y Intocable si no le han dado), que dura 2,6 s más 0,35 s. En el mismo frame fillAnima('a') llena el anillo y el panel del despertar se abre a ~1,9 s reales (1,1 s de cámara lenta y 0,8 s de espera). Durante ~1 s, o ~3,5 s más si sale también Intocable, el '¡Logro desbloqueado!' tapa 'Elige tu elemento · no hay vuelta atrás' y la parte de arriba del mini-rombo, justo la primera vez que el jugador ve el sistema nuevo.
Arreglo verificado: In E:\PROYECTOS\arcano-rev\public\game.js, line 900 (canOfferAwaken), add the achievement-toast condition to the early return, so the 0.8 s wait restarts when the last queued achievement finishes:

    if (p.awkLock || awakenFx || state !== 'play' || winTimer >= 0 || cine || slowT > 0 || !cleared || p.snoozeRoom === room || (achBusy && !quiet)) { awakenWait = 0; return false; }

achBusy (line 494) and quiet (line 32) are in the same closure. The panel then opens 0.8 s after the last achievement leaves the screen. Normal level-ups and chests are still offered first, as they are now.

## 7. [bajo] [interfaz] Grimorio: al pasar a 'Reacciones' las pestañas bajan 54-70 px y esa pestaña parte su contador en dos líneas
E:\PROYECTOS\arcano-rev\public\game.js:4754
Escenario: En el Grimorio, toca 'Reacciones' y luego otra pestaña. El panel (.panel.shop) se centra en vertical y la lista de Reacciones es corta, así que todo el encabezado, pestañas incluidas, baja más de lo que mide una pestaña (44-48 px). El siguiente toque en el mismo sitio cae sobre el título o el subtítulo y no cambia de pestaña. Además '⚗️ Reacciones 0/6' no cabe en su tercio y el '0/6' pasa a una segunda línea, mientras Formas y Mezclas van en una sola.
Arreglo verificado: In E:\PROYECTOS\arcano\public\style.css (next to .grim-tabs, around lines 817-823), CSS only, no changes to game.js:

1) Fixed panel height, so the header no longer moves between tabs. The panel's top edge is the same as on the Formas tab now, and short lists just leave empty space at the bottom:
.panel.shop.grim { height: 96%; }

2) Counter always on its own line in all three tabs, so the layout is the same everywhere and nothing gets cut off. "⚗️ Reacciones" fits on one line even at 320 px:
.grim-tabs .tab i { display: block; }
(or add display:block to the existing .grim-tabs .tab i rule on line 822)

## 8. [bajo] [interfaz] Logros: 'Despertar medio (sala) 1 / 1' se lee como una fracción, igual que 'Formas 5/10' justo al lado
E:\PROYECTOS\arcano-rev\public\game.js:4770
Escenario: Abre Logros después de haber despertado. En la cuadrícula de estadísticas sale 'Formas 5/10' (x de y) y, en la casilla de al lado, 'Despertar medio (sala) 1 / 1' o '5,5 / 13', con la misma notación de barra. En realidad son dos medias distintas: la sala media del 1º despertar y la del 2º. El jugador lo lee como '5,5 de 13'.
Arreglo verificado: In E:\PROYECTOS\arcano\public\game.js, grimStatRows(), replace line 4770
  `<div><span>Despertar medio (sala)</span><b>${grimAvg(k[0], k[1])} / ${grimAvg(k[2], k[3])}</b></div>`
with
  `<div><span>Sala media al despertar</span><b>${grimAvg(k[0], k[1])}${k[3] ? ' y ' + grimAvg(k[2], k[3]) : ''}</b></div>`

This uses the same wording as grimRhythm in the Grimorio. The box then shows '5,5 y 13' after both awakenings, '5' after only the 1st, and '—' before any. The slash is gone, so it no longer looks like a fraction next to 'Formas 3/10', and '— / —' and '5 / —' no longer appear.

I checked the width by injecting the new label and value into the DOM (tools/ver-stats-despertar2.js). The label stays on one line at 360 px (box 151 px, text 135 px) and at 320 px (box 134 px, text 120 px).

## 9. [medio] [guardado] Los avisos únicos (settings.tips) se dan por vistos aunque la cola los tire, así que no salen nunca
public/game.js:845
Escenario: Primera partida con tips vacíos. Juegas con el Piromante hasta el Gólem (sala 5) sin coger una 2ª runa. La red (a) llena el Ánima y en el despertar eliges Hielo. En onAffinity entran a la vez AFINIDAD · FUEGO + HIELO, SOLO 2 ELEMENTOS POR PARTIDA y ALGO OSCURO DUERME…. Medio segundo después, announceForm añade ¡NUEVA FORMA! y ¡CORONA DE GLACIAL!. pushToast admite como mucho 3 avisos en cola y hace toastQ.shift(), que tira el más antiguo: 'SOLO 2 ELEMENTOS POR PARTIDA' desaparece sin llegar a verse. Aun así, settings.tips.aff=1 y opp=1 ya están guardados, así que ese aviso no vuelve a salir en ninguna partida. Si además la runa completa una Mezcla (por ejemplo, Rebote + Hielo = Glaciar), también se pierden 'ALGO OSCURO DUERME…' y el aviso 'MEZCLA: GLACIAR' con su receta, aunque la Mezcla queda marcada en el Grimorio. Si el aviso DESPERTAR sigue en pantalla, se pierde también el de AFINIDAD.
Arreglo verificado: En public/game.js hay que dar el tip por visto cuando el aviso sale en pantalla, no al meterlo en la cola. También hay que evitar que se vuelva a meter mientras ya espera, porque gainAnima lo pediría en cada baja.

1) Sustituir pushToast (843-846) por:
  function showToast(o) {
    toast = o;
    if (o && o.tip && !settings.tips[o.tip]) { settings.tips[o.tip] = 1; saveSettings(); }
  }
  function pushToast(o) {
    if (o.tip && (settings.tips[o.tip] || [toast, ...toastQ].some(t => t && t.tip === o.tip))) return; // ya visto o ya esperando
    if (!toast) showToast(o);
    else { toastQ.push(o); if (toastQ.length > 3) toastQ.shift(); }
  }

2) Quitar el «settings.tips.X = 1» de los cuatro avisos únicos y añadirles tip:
- 854-857: if (!settings.tips.anima && p.anima >= need * 0.5) pushToast({ text: 'DESPERTAR', ..., t: 3.2, max: 3.2, tip: 'anima' });
- 885: if (!settings.tips.aff) pushToast({ text: 'SOLO 2 ELEMENTOS POR PARTIDA', ..., tip: 'aff' });
- 886: if (F.isOpp(a, b) && !settings.tips.opp) pushToast({ text: 'ALGO OSCURO DUERME…', ..., tip: 'opp' });
- 1024: if (!settings.tips.mix) pushToast({ text: 'MEZCLAS SECRETAS', ..., tip: 'mix' });

3) En updateFx (2484-2485), sacar los avisos de la cola con showToast:
  if (toast && !cine) { toast.t -= dt; if (toast.t <= 0) showToast(toastQ.shift() || null); }
  else if (!toast && toastQ.length) showToast(toastQ.shift());

Así, un tip que la cola tira no se da por visto y vuelve a salir en la siguiente ocasión, normalmente en otra partida. Si se quiere que salga en esa misma ráfaga, se puede recortar la cola tirando primero el aviso más antiguo sin tip: const i = toastQ.findIndex(t => !t.tip); toastQ.splice(i >= 0 ? i : 0, 1). El inconveniente es que se perderían ¡NUEVA FORMA! o ¡CORONA!, que también son únicos.

## 10. [bajo] [guardado] Sin forms.js, Logros cuenta los 7 logros del Despertar, que no se pueden conseguir
public/game.js:4369
Escenario: forms.js no carga (un 404, o el precache falló y luego no hay conexión). El juego funciona sin formas, como debe, pero el menú pone 'Logros n/26' y la lista enseña Despertar, Alma doble, Cuatro caminos, Equilibrio roto, Grimorio de formas, Mil caras y Mezclador con su esencia (✨5…25). Sin formas no se puede conseguir ninguno. La spec (punto 15) dice que sin forms.js el juego debe quedar idéntico al de antes, que tenía 19 logros.
Arreglo verificado: En public/game.js:

1) Añadir `forms: true` a las 7 entradas del Despertar de ACHIEVEMENTS (líneas 289-295), por ejemplo:
   { id: 'awaken1', icon: '🌅', name: 'Despertar', desc: 'Despierta una forma por primera vez', reward: 5, forms: true },
   (y lo mismo en awaken2, hybrids, eclipse, forms10, formWins y mixes8).

2) Justo después del array, añadir un helper:
   const achList = () => ACHIEVEMENTS.filter(a => !a.forms || FX());

3) Usarlo solo en lo que se muestra:
   - showMenu, línea 4367: `const AL = achList(); const done = AL.filter(a => meta.ach[a.id]).length;` y, en la línea 4369, `${done}/${AL.length}`.
   - showStats, línea 4624: `const AL = achList(); const done = AL.filter(a => meta.ach[a.id]).length;`. En la línea 4631, `AL.map(...)` en vez de `ACHIEVEMENTS.map(...)`. En la línea 4639, `${done} de ${AL.length} desbloqueados`.

unlock() (línea 497) y achPop de depuración (línea 5343) siguen buscando en ACHIEVEMENTS completo, así que no se toca nada guardado: si forms.js vuelve a cargar, los logros ya conseguidos reaparecen. Con forms.js cargado, FX() es verdadero y la lista sigue siendo de 26 como ahora. Sin él queda en 19, como en fb09a13.

## 11. [medio] [visual] La cola de avisos (tope 3) tira el aviso AFINIDAD y el consejo único 'SOLO 2 ELEMENTOS', que queda marcado como visto
public/game.js:843
Escenario: Jugador nuevo (sin tips vistos), con un aviso ya en pantalla, por ejemplo el de trampa que sale al entrar ('¡PINCHOS!', '¡HIELO!', '¡LAVA!'). El despertar sella la Afinidad (Piromante que en el 1º despertar elige Rayo o Hielo, o que en el 2º elige otro elemento). En el mismo segundo se encolan AFINIDAD, SOLO 2 ELEMENTOS, ALGO OSCURO (si son opuestos), NUEVO DEFINITIVO y ¡NUEVA FORMA! o ¡CORONA! (announceForm, línea 968). pushToast descarta los más antiguos cuando hay más de 3 en cola. Además, durante la cinemática el aviso actual corre a ×0,15 y no deja pasar la cola. Resultado: el aviso 'AFINIDAD · FUEGO + HIELO / Rayo y Veneno dejan de salir' no se ve nunca, y en el caso de opuestos tampoco 'SOLO 2 ELEMENTOS POR PARTIDA'. onAffinity (línea 882) ya guardó settings.tips.aff=1, así que ese consejo no vuelve a salir jamás.
Arreglo verificado: public/game.js:845, en pushToast, subir el tope de la cola para que quepa la ráfaga del despertar (1 aviso en pantalla + hasta 5 esperando):

  function pushToast(o) {
    if (!toast) toast = o;
    else { toastQ.push(o); if (toastQ.length > 6) toastQ.shift(); }
  }

(Antes era `> 3`. Comprobado en Chrome sin ventana: con 6 se ven AFINIDAD, SOLO 2 ELEMENTOS, ALGO OSCURO, NUEVO DEFINITIVO / ¡NUEVA FORMA! y ¡CORONA! en todos los casos, también con ¡PINCHOS! en pantalla.)

Refuerzo opcional, por si algún día se junta una ráfaga aún más larga (por ejemplo, con una MEZCLA nueva en el mismo despertar):
- En onAffinity (líneas 885-886), no poner settings.tips.aff/opp = 1 al encolar. Basta con añadir al objeto del aviso un `tip: 'aff'` (o `'opp'`).
- Marcar el consejo como visto cuando se muestra de verdad, con un helper `showToast(t){ toast = t; if (t && t.tip && !settings.tips[t.tip]) { settings.tips[t.tip] = 1; saveSettings(); } }`.
- Usar ese helper en los tres sitios donde se asigna toast: pushToast y las líneas 2484-2485 de updateFx.
- La comprobación `!settings.tips.aff` que decide si se encola se puede quedar como está.

## 12. [medio] [visual] Calidad baja: los disparos de Eclipse son puntos negros casi invisibles en los biomas oscuros
public/forms.js:171
Escenario: Ajustes > calidad baja. Una partida que llega a Eclipse (Fuego + Pacto + Hielo), en la cripta (salas 6-10) o el volcán (16-20). En calidad baja drawShot (línea 721) solo pinta brillo + círculo de color s.lowCol. lowCol es d.low || d.body (línea 594) y Eclipse no define 'low', así que el círculo es body '#0a0612', casi negro. Sobre el suelo oscuro el disparo es un punto negro con un halo violeta muy flojo y el jugador apenas ve sus propios hechizos. Mortaja sí tiene low:'#5fffd0' por el mismo problema.
Arreglo verificado: In public/forms.js, inside drawShot's low-quality branch (lines 721-725), stroke the ring after the circle. G.circle leaves the arc as the current path, so a direct c.stroke() works:

    if (G.lowQ()) { // calidad baja: brillo y círculo
      G.glow(x, y, s.glowR * 0.8, s.glow, 0.85);
      G.circle(x, y, s.coreR, s.lowCol);
      if (s.shape === 'void') { c.strokeStyle = s.rim || s.edge; c.lineWidth = s.edgeW; c.stroke(); } // Eclipse: sin el aro claro el disco negro no se lee
      return true;
    }

Do not add low:'#e8d5ff' or low:'#c77dff' to Eclipse: in low quality it would look like the totem's '#c9a8ff' and the Brujo's '#c58bff' enemy bullets. Tested on a copy in the scratchpad (scratchpad\pub, captures in scratchpad\eclfix\b8-low-eclipse.png and b18-low-eclipse.png): the shot shows as a black disc with a clear ring in both the crypt and the volcano, with no console errors.

## 13. [bajo] [visual] El rótulo 'ECLIPSE' y las esquirlas de sombra se cuelan en la sala siguiente, en pleno combate
public/game.js:2647
Escenario: Primer Eclipse (f.first). Tras la cinemática sale 'LA FORMA PROHIBIDA' (1,2 s) y queda bannerNext = ECLIPSE (línea 972). Si el jugador cruza la puerta en ese segundo, nextRoom pone el rótulo 'SALA N' pero no limpia bannerNext ni eclipseFx (línea 2647 limpia pools, amb, ash, curtains y fog, pero no esos dos). Al acabar 'SALA N', aparece 'ECLIPSE · Ni luz ni sombra. Solo yo.' a 58 px en el centro de la pantalla durante 2,6 s, tapando enemigos y balas. Además, las 24 esquirlas de sombra de eclipseFx (3 s, línea 964) siguen cayendo sobre el combate nuevo, y unos rombos oscuros violetas cayendo en combate parecen proyectiles. Lo de las esquirlas pasa en cualquier Eclipse, no solo en el primero, si sales rápido.
Arreglo verificado: En game.js, función nextRoom, justo después de la línea 2647 (`pools = []; amb = []; ash = []; roomReactA = 0; awakenWait = 0; curtains = []; fog = null;`), añadir:

    bannerNext = null; eclipseFx = null; // el rótulo pendiente y las esquirlas del Eclipse no pasan a la sala nueva

No hace falta bloquear la puerta. Los toasts (¡NUEVA FORMA!, NUEVO DEFINITIVO) siguen en toastQ y se ven igual. El cambio iguala el primer Eclipse a cualquier otra forma, cuyo rótulo ya se pierde bajo 'SALA N' si sales rápido.

## 14. [bajo] [visual] Si el mago se transforma cerca de la puerta, el logro y los avisos lo tapan justo en el estallido y al estrenar forma
public/game.js:4001
Escenario: Al limpiar la sala el jugador va hacia la puerta, y el panel sale 0,8 s después con el mago en la franja de arriba (y ≈ 160-250). En el estallido (t=0,9) discoverForm lanza el logro DOM ('¡Logro desbloqueado! Despertar', top 104·u), que tapa el sombrero y el centro del destello. Después, '¡NUEVA FORMA!', 'NUEVO DEFINITIVO' y 'AFINIDAD' se pintan uno tras otro en toastY=186-252, encima del mago, durante varios segundos. El jugador no ve su forma nueva en el momento clave.
Arreglo verificado: Cuatro cambios en public/game.js, probados en una copia:

1) nextAch (línea 508): que no enseñe logros durante la cinemática ni mientras se ve el nombre de la forma:
   if (achBusy || !achQueue.length || awakenFx || (banner && banner.form)) return; // la transformación y el nombre de la forma son del mago: el logro espera

2) announceForm (líneas 971-972): marcar los rótulos de la forma con form: true:
   const main = { text: D.short, sub: D.line, color: ..., crown: ..., t: 2.6, max: 2.6, form: true };
   ... banner = { text: 'LA FORMA PROHIBIDA', sub: '', color: '#c77dff', t: 1.2, max: 1.2, form: true }; bannerNext = main;

3) update (línea 2483): sacar los logros retenidos cuando acaba el rótulo:
   if (banner) { banner.t -= dt; if (banner.t <= 0) { banner = bannerNext; bannerNext = null; nextAch(); } }

4) drawToast (líneas 4003-4004): si el mago está en la franja de arriba cuando empieza un aviso, ese aviso sale debajo del rótulo. La posición se decide una vez por aviso, para que no salte mientras te mueves:
   if (!toast || cine) return;
   if (toast.low === undefined) toast.low = !!player && player.y < 330; // mago junto a la puerta (bajo la franja de avisos): el aviso sale bajo el rótulo
   const a = clamp(Math.min(toast.t, toast.max - toast.t) / 0.25, 0, 1), y = toast.low ? 540 : toastY;

Notas:
- El cambio 4 vale para cualquier aviso, no solo para los del despertar. Si se quiere limitar al despertar, añadir `&& (awakenFx || (banner && banner.form))` en la condición de toast.low.
- Retener el logro solo hasta que awakenFx sea null, como proponía el revisor, no basta: el logro saldría a t=1,4 encima del mago justo mientras se ve el nombre de la forma.

Scripts de prueba que he creado:
- E:\PROYECTOS\arcano-rev\tools\ver-cine-top.js
- E:\PROYECTOS\arcano-rev\tools\ver-cine-top2.js (admite CDP_URL para la copia, STAGE=2 y EL=bolt)

## 15. [bajo] [visual] El icono del definitivo de Eclipse (🕳️) casi no se ve en el botón mientras carga
public/forms.js:43
Escenario: En Eclipse, el botón del definitivo muestra '🕳️' (agujero negro), que es una elipse oscura con un borde gris fino. El fondo del botón es #1d1630 y mientras no está listo lleva filter: grayscale(.7) brightness(.7) (style.css:250). El botón parece vacío durante casi toda la partida. Pasa lo mismo en la cinemática y en el combate en los biomas oscuros. El resto de formas tienen iconos claros (☄️, 🌞, 🧊, 🌧️…).
Arreglo verificado: Cambiar una línea en public/forms.js:43, el icono del definitivo 'void': icon: '🕳️' pasa a icon: '🌘'. Quedaría así: void: { key: 'void', name: 'Sol negro', icon: '🌘', desc: 'Un sol negro lo atrae todo; tus disparos +50%' },. Ese icono se usa en el botón (syncUlt, mediante ultIcon), en la carta del altar (game.js:4968) y en ults(). Con este cambio se ven bien en todos esos sitios sin tocar el CSS. Medido en el botón con maná 40: '🌘' llega al 34,6 % del círculo con contraste, frente al 4,0 % de '🕳️'.

## 16. [medio] [combate] Los rasgos al morir (Pira, charcos) fallan cuando el golpe final es la reacción propia de la forma (VAPOR, COMBUSTIÓN, NECROSIS)
public/game.js:2210
Escenario: `react()` borra el estado antes de hacer el daño. VAPOR pone `e.burn=0; e.burnDps=0` y luego hace `damageEnemy(e, 3,2×atk)`. COMBUSTIÓN pone `e.burn=0` y luego `explode(...)`. `necrosis()` pone `e.poisonDps=0` y luego `damageEnemy`. Si esa reacción mata al enemigo, `formDeath` lo ve sin quemadura ni veneno: no hay estallido de Pira (núcleo fuego) ni charco de Ponzoña o Azufre. Afecta a las formas cuya reacción es su seña: Eclipse fuego+hielo, que hace VAPOR al primer golpe a cada enemigo cada segundo, Azufre (COMBUSTIÓN) y Mortaja núcleo veneno (NECROSIS). El jugador ve morir ardiendo a un enemigo que no estalla.
Arreglo verificado: Arreglo en public/game.js: hacer primero el daño y borrar el estado después. Con el enemigo vivo el efecto es el mismo que ahora, y con el enemigo muerto formDeath todavía ve el estado.

1) VAPOR, en react():
    if (r.id === 'vapor') {
      for (...) parts.push(...);   // sin cambios
      rings.push(...);             // sin cambios
      damageEnemy(e, atk * (tr.vaporK || 3), true, r.color); // primero el daño: si muere, formDeath aún lo ve ardiendo
      e.burn = 0; e.burnDps = 0; e.slow = 0;
    }

2) COMBUSTIÓN, en react():
    } else if (r.id === 'combust') {
      explode(e.x, e.y, tr.combR || 85, atk * (tr.combK || 1.5), r.color, atk * 0.15 * Math.max(1, player.sk.poison || 1));
      e.burn = 0; e.burnDps = 0;
    }

3) necrosis(e, atk): quitar 'e.poisonDps = 0;' de la segunda línea (pd y half ya se calculan antes en el const) y ponerlo al final, después del daño, como dice la spec 3.1:
    damageEnemy(e, clamp(pd * (tr.necroK || 3), 1.5 * atk, (tr.necroCap || 4) * atk), true, '#5fffd0');
    e.poisonDps = 0;
  }

Esto también corrige la NECROSIS final de Invierno negro, que usa la misma función. Verificado en una copia parcheada con tools/rb-reactkill.js y tools/rb-pira.js, sin errores de consola.

## 17. [bajo] [combate] Las esquirlas de Aurora se encadenan: una baja causada por una esquirla (nofx) suelta otra ráfaga
public/game.js:1141
Escenario: La spec dice que los secundarios no activan rasgos y no generan más esquirlas (2.11.4 y 7.4.11). Pero `formDeath()` no mira qué causó la baja: si una esquirla mata a un enemigo congelado y hay ficha, salen otras 6 esquirlas (10 con Luz polar ×2). Esas matan al siguiente congelado y así sigue la cadena. Pasa mucho tras la Cortina boreal, que congela toda la sala. Lo mismo ocurre con las esquirlas de Granizo y las mitades de Glaciar sobre enemigos que arden: disparan la Pira.
Arreglo verificado: In E:\PROYECTOS\arcano-rev\public\game.js (the same change applies to E:\PROYECTOS\arcano\public\game.js), use a dedicated flag rather than fxDepth:

1) Line 810: `let shotQ = [];` -> `let shotQ = [], subHit = false;`

2) In shotHit (line 2268), wrap the damage call:
```js
    subHit = !!ar.nofx; // the kill from a secondary does not trigger death effects (formDeath)
    damageEnemy(e, dmg, crit);
    subHit = false;
```

3) In formDeath (line 1120):
```js
    if (!FX() || !tr || subHit) return; // secondaries (nofx): no blast, no puddle, no more shards
```
This skips the blast, puddle and shards only when a nofx shot causes the kill. Normal shots, the ult, reactions, chain lightning and the Pira blast itself keep their current behaviour.

If you only want to stop the chain and still allow puddles from secondary kills, put the `subHit` check only on the shard condition (line 1141, `if (sh && !subHit && e.frozen > 0 && takeTok('shard'))`) and on the blast condition (line 1122, `&& !subHit`). The spec says secondaries trigger no traits, which points to the full early return.

## 18. [bajo] [combate] Electromante que pasa de Voltaica a Aurora: su definitivo contra jefes cae a menos de un tercio
public/game.js:1423
Escenario: Con núcleo rayo, el 2º despertar cambia Tormenta (8 rayos × 3,2×uAtk, todos al jefe si está solo) por Cortina boreal. Contra un jefe solo, la Cortina golpea con una sola columna (7×uAtk) y lo congela 0,8 s. El aviso «NUEVO DEFINITIVO» lo presenta como una mejora. El comentario del código solo la comparó con la Ventisca (núcleo hielo), no con la Tormenta a la que sustituye en la ruta del Electromante.
Arreglo verificado: In E:\PROYECTOS\arcano\public\game.js, updateCurtains, line 1423, make only the jefe take a heavier hit. Damage to normal enemies and the freeze (0.8 s to a jefe, once per column) stay the same:

  damageEnemy(e, uAtk() * (e.kind === 'boss' ? 18 : 7), false, '#6affc8'); // el jefe solo cabe en una columna: 18× (con Linaje 21,6×) lo deja cerca de Tormenta 25,6 / Sol cautivo 26,6 / Lluvia 21, por debajo por ser el definitivo defensivo

Checked on a patched copy (in the scratchpad, not in the repo), no console errors:
- Cortina against the jefe goes to 21.6×atk (Rey Slime 33%, Brujo 15%, Señor 8%).
- Time saved by the definitivo with Aurora, rooms 10/15/20: 3.0 / 5.2 / 5.9 s. Voltaica saves 4.3 / 4.9 / 7.8 s and Plasma 2.4 / 3.7 / 5.0 s.
- Aurora with ults beats Voltaica against the final jefe: 26.7 s against 28.8 s.
- For an ice core it also stops being below the Ventisca (11.8×).

Avoid the alternative of hitting the jefe in every column. Each column's forced freeze would keep him frozen about 2 s, and the ×1.5 bonus Aurora gives against frozen targets would push the damage to about 59×.

## 19. [bajo] [combate] El Arco de plasma no comprueba si el enemigo ya ardía: salta también en el primer golpe
public/game.js:2291
Escenario: La spec dice: «cada impacto sobre un enemigo que arde tiene un 30%». En `shotHit`, el disparo de Plasma (que siempre lleva fuego) llama antes a `applyElements` (l. 2282) y después mira `e.burn > 0`. Así la condición siempre se cumple y el arco sale con un 30% también contra enemigos que no ardían.
Arreglo verificado: En public/game.js, línea 2291, cambiar `e.burn > 0` por el estado anterior al impacto:
`if (tr.plasmaArc && had.fire && Math.random() < tr.plasmaArc.p) plasmaArc(e, ar, tr.plasmaArc);`
(`had` ya existe en la l. 2263 y se calcula antes del daño y de applyElements.) Conviene corregir también el paso 6 de la tabla de docs/despertar-spec.md (l. 540): `e.burn>0` debe ser `prev.fire`, para que la spec no vuelva a meter el fallo.

## 20. [bajo] [combate] En la sala 20 el Ánima puede llenarse ("¡DESPERTAR LISTO!" y anillo girando) pero el despertar nunca llega
public/game.js:858
Escenario: Un jugador con 1 despertar que entra en la sala 20 sin el Ánima llena (por ejemplo, porque despertó la primera vez después del Brujo) la llena con el daño al jefe final. Suenan el aviso y la vibración, sale el texto «¡DESPERTAR LISTO!» y el anillo pasa a `animafull`. Pero `canOfferAwaken` lo bloquea con `winTimer` al limpiar y la partida termina en victoria sin ofrecerlo. Avisa de algo que no va a pasar.
Arreglo verificado: En E:\PROYECTOS\arcano-rev\public\game.js, función `gainAnima` (línea 851), añadir la sala final a la salida temprana:

    if (!F || !p || p.awak >= 2 || p.animaReady || room >= TOTAL_ROOMS) return; // en la sala final ya no hay despertar

Con esto, en la sala 20 no se suma Ánima por el jefe, las bajas ni la sala limpia. Tampoco salen el sonido, la vibración, el texto «¡DESPERTAR LISTO!» ni el anillo `animafull`. Además se evita el consejo del 50% en esa sala. `fillAnima` no se ve afectado: solo se usa con los jefes de tier 1 a 3.

Opcional, para que el anillo tampoco gire en la sala 20 si se entra con el despertar pospuesto: en `syncForm` (línea 2780) usar `on && p.animaReady && !p.awkLock && room < TOTAL_ROOMS` para la clase `animafull`.

## 21. [bajo] [combate] El segundo pacto, ya en Eclipse, sigue prometiendo «Abre el camino a Eclipse»
public/game.js:4973
Escenario: La línea extra del Pacto oscuro solo comprueba que `aff` sea opuesta. No mira si el pacto ya está firmado (`pactRun`) ni si ya has despertado Eclipse (`awak===2`). Ejemplo: Piromante con 2 Vitalidades, pacto en la sala 4, Eclipse en la 12–14 y en el altar 19 todavía tiene ≥80 de vida máxima. El altar le ofrece otro pacto «· Abre el camino a Eclipse», que solo le quita un 20% más de vida sin abrir nada.
Arreglo verificado: En E:\PROYECTOS\arcano-rev\public\game.js:4973, dentro de la condición de la coletilla, añadir `!pactRun &&` (los demás textos no cambian):

${FX() && !pactRun && player.aff.length === 2 && Forms().isOpp(player.aff[0], player.aff[1]) ? ' · Abre el camino a Eclipse si tus elementos son opuestos' : ''}

(Opcional, por defensa: `&& player.awak < 2`; no hace falta porque Eclipse no se puede despertar sin pacto.)
