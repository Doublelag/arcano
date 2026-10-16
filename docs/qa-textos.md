# QA de textos (verificado)

## 1. [medio] Icono 🪄 del Aprendiz (Emoji 13.0) no existe en Android 10 o anterior: cuadro vacío en la pantalla final, la pausa y el Grimorio
E:\PROYECTOS\arcano-rev\public\forms.js:64
Escenario: Móvil con Android 10 o más viejo (Chrome o la PWA). Cualquier partida sin despertar (todas las primeras): al morir, el emblema dice 'Caíste como ▯ Aprendiz'; en PAUSA la línea '▯ Aprendiz · Afinidad…' y la primera entrada del Grimorio (Formas) salen con un recuadro en vez del icono. Los tres sitios usan FORMS.aprendiz.icon (capturas shots-tx4/p06-derrota-sala2.png, n16-pausa-aprendiz.png, n18-grimorio-formas.png). Además 🧊 (definitivo Invierno negro: botón del definitivo, Grimorio, altar 'Ofrenda de maná'), 🧪 (pestaña Mezclas, 'Algo reacciona…' en cartas, logro Mezclador) y 🧭 (logro Cuatro caminos) exigen Android 9+.
Arreglo verificado: Solo cambiar las cadenas de icono (no hay lógica que dependa de ellas; los demás elementos se comparan por id/key, no por icono). Sustitutos elegidos entre emoji Unicode ≤7.0 y que NO se usen ya en el juego para otra cosa:
1) E:\PROYECTOS\arcano-rev\public\forms.js:64 — icon: '🪄' → icon: '🌟' (U+1F31F, Unicode 6.0; amarillo, pega con el color #ffcf4a del Aprendiz). No usar '✨' (es la moneda de esencia en todo el juego) ni '📜' (es la mejora Sabiduría, game.js:249).
2) E:\PROYECTOS\arcano-rev\public\forms.js:41 — icon: '🧊' → icon: '🌬️' (U+1F32C U+FE0F, Unicode 7.0, sin uso). No usar '🌫️' como propone el hallazgo: es el icono de la forma Mortaja y en el Grimorio saldría '🌫️ Mortaja … Definitivo: 🌫️ Invierno negro'.
3) E:\PROYECTOS\arcano-rev\public\game.js:295, :4796, :4839, :4909 — '🧪' → '🔬' (U+1F52C, Unicode 6.0, sin uso) en los cuatro sitios, para que Mezclas siga distinguiéndose de Reacciones/Alquimista/Poción, que ya usan '⚗️'. ('⚗️' también vale si se prefiere, pero duplica icono con la pestaña Reacciones.)
4) E:\PROYECTOS\arcano-rev\public\game.js:291 — icon: '🧭' → icon: '🗺️' (U+1F5FA U+FE0F, Unicode 7.0, sin uso) para 'Cuatro caminos'.
Comprobación tras el cambio: ejecutar el escaneo de emoji (regex \p{Extended_Pictographic} sobre game.js, forms.js, equipment.js, biomes.js, index.html) y confirmar que ningún codepoint queda en U+1F90C–U+1F9FF (Unicode 10-12) ni U+1FA70–U+1FAFF (Unicode 12-15); hoy los únicos son los cuatro de arriba.

## 2. [medio] Tutorial: la pista '¡Eso es! Muévete para esquivar y para para atacar' se lee como palabra repetida
E:\PROYECTOS\arcano-rev\public\game.js:545
Escenario: Primera partida de cualquier jugador: tras la primera baja (tut.step 'clear') aparece en la píldora inferior '¡Eso es! Muévete para esquivar y para para atacar' durante toda la sala 1 (captura shots-tx4/p04-tut-clear.png). 'para para' (párate + para) es correcto pero cualquiera lo lee como errata, justo en el texto más visto del juego.
Arreglo verificado: En E:\PROYECTOS\arcano-rev\public\game.js línea 545, cambiar:
    clear: () => '¡Eso es! Muévete para esquivar y para para atacar',
por:
    clear: () => '¡Eso es! Muévete para esquivar y párate para atacar',
Motivo: 431 px a 800 17px (< 460 de maxW), se mantiene a 17 px sin encoger. NO usar la variante 'quédate quieto para atacar' tal cual: mide 504 px y fitSize la bajaría a 15 px. Si se quiere mantener la coherencia con el paso 'shoot' ('Ahora quédate quieto...'), habría que acortar el resto de la frase para quedar por debajo de 460 px, p. ej. '¡Eso es! Esquiva moviéndote y quédate quieto para atacar' (medir antes con tools/qa/measure-tut-clear.js).

## 3. [bajo] README: '17 logros' cuando el juego tiene 26, y lista de Ajustes/altares desactualizada
E:\PROYECTOS\arcano\README.md:30
Escenario: Quien lea el README público (GitHub) ve '17 logros', 'Ajustes: volumen de música y efectos' y 'altares (curar, subir de nivel o cargar el definitivo)'. En el juego el menú muestra 'Logros 0/26' y la pantalla de Logros '0 de 26 desbloqueados' (log tx-verify: 26 items), los ajustes de sonido son interruptores SÍ/NO (no volúmenes) y el altar ofrece Fuente 60 %, Bendición (elegir habilidad), Escudo/Ofrenda de maná y Pacto oscuro. No se mencionan Despertar, Grimorio, Equipo ni Mezclas.
Arreglo verificado: Solo README.md (E:\PROYECTOS\arcano\README.md; NO lo he tocado). Cambios mínimos, línea a línea:

- L23 → `- 20 salas al azar, **altares** antes de cada jefe (Fuente sagrada: curas el 60 %; Bendición arcana: eliges una habilidad; Ofrenda de maná: el definitivo empieza cargado, o Escudo arcano si ya lo tienes lleno; Pacto oscuro: pierdes el 20 % de la vida máxima a cambio de 2 habilidades), jefes en 5/10/15/20 y **élites** desde la sala 6.`
- L29 → `- **Ajustes** (interruptores SÍ/NO estilo Archero): música, sonido, vibración, temblor de pantalla, números de daño, gráficos HD, modo zurdo, FPS, repetir tutorial y borrar progreso.`
- L30 → `- **Tutorial** en la primera partida, **26 logros** con recompensa de esencia, **estadísticas** y **créditos**.`
- Añadir tras L22 (Santuario) dos viñetas nuevas:
  `- **Despertar** (`forms.js`): el mago despierta en su elemento y combina dos; 10 formas (aprendiz, 4 puras, 4 híbridas y Eclipse, la prohibida, que exige un Pacto oscuro) y 8 **Mezclas** (elemento + carta), todo coleccionado en el **Grimorio** del menú.`
  `- **Equipo** (`equipment.js`): bastón, túnica, anillo y amuleto; 16 bases, 5 rarezas (Común → Mítico) y fusión de 3 iguales en 1 de la rareza siguiente; los objetos caen en la mazmorra y se gestionan desde el menú.`
- Sección Archivos: añadir `- `public/forms.js`: Despertar, formas y Mezclas (`window.ArcanoForms`)` y `- `public/equipment.js`: equipo, rarezas y fusión (`window.ArcanoGear`)`.
- Commit y push a origin/main para que GitHub muestre el README actualizado.

Verificación tras el cambio: `grep -n "26 logros\|interruptores\|Pacto oscuro\|forms.js\|equipment.js" README.md` debe dar 5+ líneas, y `curl -s https://raw.githubusercontent.com/Doublelag/arcano/main/README.md | grep -c "17 logros"` debe devolver 0 tras el push.

## 4. [bajo] La versión visible sigue en 'v1.0' (menú, Ajustes, Créditos) tras añadir Despertar, Equipo, biomas y Mezclas
E:\PROYECTOS\arcano-rev\public\game.js:39
Escenario: Pie del menú 'Doublelag Games · v1.0', Ajustes 'Arcano v1.0 · Doublelag Games' y Créditos 'Versión · v1.0 · 2026' (logs menu/ajustes/creditos). Un jugador que ya jugó la v1.0 publicada no ve que hay versión nueva, y cualquier bug que reporten dirá 'v1.0' sea la build que sea.
Arreglo verificado: Arreglo mínimo (un solo sitio): en E:\PROYECTOS\arcano-rev\public\game.js:39 cambiar `const VERSION = '1.0';` por la versión de esta publicación, p. ej. `const VERSION = '1.1';` (o '2.0' si Double considera Despertar+capítulos un salto mayor; decisión suya). Con eso los tres textos (:4438, :4473, :4538) se actualizan solos porque interpolan ${VERSION}; no hay que tocar index.html, manifest.webmanifest ni sw.js (el nombre de caché 'arcano-v3' es independiente y ya está subido para esta publicación). Opcional/cosmético: en game.js:4538 dejar `<div><span>Versión</span><b>${VERSION} · 2026</b></div>` (sin la 'v' repetida tras la etiqueta 'Versión'). Recomendación de proceso, no código: subir VERSION en el mismo commit en que se suba CACHE de sw.js en futuras publicaciones. Script de comprobación dejado en E:\PROYECTOS\arcano-rev\tools\qa\ver-version-texto.js (CDP_PORT=9544 CDP_URL="file:///E:/PROYECTOS/arcano-rev/public/index.html?debug" node tools/cdp.mjs 360 640 tools/qa/ver-version-texto.js); tras el cambio debe imprimir la versión nueva en las tres líneas.

## 5. [bajo] Botón de Ajustes '🎓 Tutorial ✓': la marca aparece ANTES de hacer el tutorial y desaparece al completarlo
E:\PROYECTOS\arcano-rev\public\game.js:4468
Escenario: Instalación nueva → Ajustes: el botón dice '🎓 Tutorial ✓' sin haber jugado (captura shots-tx4/p01-ajustes-nuevo.png, log 'ajustes nuevo'). Tras completar el tutorial pasa a '🎓 Tutorial' (n03-ajustes.png). Al pulsarlo vuelve a '✓' y pulsarlo otra vez no lo quita (log 'ajustes tras pulsar Tutorial'). El ✓ se lee como 'hecho' cuando significa lo contrario ('se repetirá').
Arreglo verificado: Dos líneas en E:\PROYECTOS\arcano-rev\public\game.js (no he editado nada; solo informo):

1) game.js:4468 — sustituir
   <button class="btn ghost" data-act="tutorial">🎓 ${settings.tutorial ? 'Tutorial' : 'Tutorial ✓'}</button>
   por
   <button class="btn ghost" data-act="tutorial">🎓 Repetir tutorial</button>

2) game.js:5268 — en la rama `act === 'tutorial'`, añadir `notice = 'El tutorial saldrá en la próxima partida';` justo antes de `showSettings();`:
   else if (act === 'tutorial') { if (ready) { settings.tutorial = false; settings.ultTip = false; settings.seenHz = {}; settings.tips = {}; saveSettings(); Sfx.click(); notice = 'El tutorial saldrá en la próxima partida'; showSettings(); } }

Comprobado (script E:\PROYECTOS\arcano-rev\tools\qa\vf-tutorial-fix.js, inyectando el texto y el aviso en la ventana viva): a 320x568, 360x640 y 412x915 no hay textCut/outsideX ni scroll horizontal pese a que .btn-row .btn es white-space:nowrap + flex:1 (style.css:780/409); los dos botones siguen en la misma fila con el mismo ancho (125/141/161 px); el mecanismo `notice` ya existe (game.js:4443, se pinta en 4465 y se limpia en 4476) y .notice tiene estilo (style.css:487), igual que usa resetProgress en game.js:4518. Capturas: shots-vf-tut\fix-320x568.png, fix-360x640.png, fix-412x915.png. Opcional: como el handler también reinicia ultTip/seenHz/tips, el aviso puede decir "El tutorial y los avisos saldrán en la próxima partida". Alternativa de una sola línea (menos clara, sin feedback): invertir 4468 a `${settings.tutorial ? 'Tutorial ✓' : 'Tutorial'}`.

## 6. [bajo] Jefe 15 'Tirano de la gruta helada' pero el capítulo 3 se llama 'Gruta de cristal'
E:\PROYECTOS\arcano-rev\public\game.js:265
Escenario: En la sala 11 el rótulo dice 'CAPÍTULO 3 · Gruta de cristal' (shots-tx4/p07-capitulo3.png) y en la 15 la entrada del Brujo Sombrío titula 'Tirano de la gruta helada' (p08-cine-brujo.png). Los otros tres títulos sí coinciden con su bioma (pradera, cripta, volcán).
Arreglo verificado: E:\PROYECTOS\arcano-rev\public\game.js:265 — cambiar la cadena de BOSS_TITLES[15]: `15: 'Tirano de la gruta helada'` → `15: 'Tirano de la gruta de cristal'`. Una sola línea; no hace falta tocar biomes.js ni el README (el bioma ya se llama "Gruta de cristal" en ambos). Verificado que a 19 px mide 258 px y cabe centrado en los 480 px útiles del lienzo. Script de comprobación: E:\PROYECTOS\arcano-rev\tools\qa\tx-boss15-titulo.js (ejecutar con CDP_URL="file:///E:/PROYECTOS/arcano-rev/public/index.html?debug" porque tools/cdp.mjs apunta por defecto a E:/PROYECTOS/arcano/public).

## 7. [bajo] Equipo vacío: 'caen al final de cada partida' pero solo cae botín si llegas a la sala 3
E:\PROYECTOS\arcano-rev\public\game.js:4586
Escenario: Jugador nuevo muere en la sala 1 o 2 (lo normal las primeras veces), entra en Equipo y lee 'Aún no tienes objetos: caen al final de cada partida y en los cofres' sin haber recibido nada. Reproducido: derrota en sala 2 → gear.inv sigue en 0 y el texto no cambia (log tx-verify2 'gear inv tras derrota sala 2: 0').
Arreglo verificado: Cambiar solo la cadena de E:\PROYECTOS\arcano-rev\public\game.js:4586: sustituir '<div class="empty">Aún no tienes objetos: caen al final de cada partida y en los cofres</div>' por '<div class="empty">Aún no tienes objetos: caen al acabar una partida (si llegas a la sala 3) y en los cofres</div>'. Coincide exactamente con la lógica de game.js:5172 (room >= 3) y no toca ninguna mecánica. Opcional, fuera del mínimo: en showEnd (game.js ~5205), cuando room < 3 y no hay runLoot, añadir una línea tipo '<div class="loot-txt">Llega a la sala 3 para conseguir equipo</div>' para que el jugador lo sepa en el momento.

## 8. [bajo] Carta 'Rebote': dice 'rebotan 2 veces' en los dos niveles, pero cada nivel suma 2 rebotes
E:\PROYECTOS\arcano-rev\public\game.js:314
Escenario: Con Rebote ★☆ ya cogido, la carta vuelve a salir con el mismo texto 'Los proyectiles rebotan 2 veces en muros y rocas'; al cogerla el proyectil rebota 4 veces. La carta hermana 'Salto arcano' sí dice 'saltan a 2 enemigos más'.
Arreglo verificado: E:\PROYECTOS\arcano-rev\public\game.js:314 — cambiar desc: 'Los proyectiles rebotan 2 veces en muros y rocas' → 'Los proyectiles rebotan 2 veces más en muros y rocas'. Un solo literal; coherente con 'Salto arcano' y 'Lanza de éter' y con wall: (s.wall||0)*2 (★☆ = 2, ★★ = 4). Verificado que no hay más textos que toquen el número de rebotes (grep 'rebotan|Rebote' en public/: solo game.js:314 y comentarios/colores en forms.js).

## 9. [bajo] Ajustes: el interruptor de los números de daño se llama 'Daño' (SÍ/NO)
E:\PROYECTOS\arcano-rev\public\game.js:4447
Escenario: En Ajustes la baldosa '🔢 Daño · SÍ/NO' controla settings.dmgNumbers (mostrar las cifras que saltan al golpear), pero se lee como si apagara el daño del juego (captura shots-tx4/n03-ajustes.png). Es la única baldosa cuyo nombre no describe lo que hace.
Arreglo verificado: Cambio de una sola cadena en E:\PROYECTOS\arcano-rev\public\game.js:4447: sustituir `['dmgNumbers', '🔢', 'Daño']` por `['dmgNumbers', '🔢', 'Nº daño']` (o 'Cifras'). Cabe sin problema: .ttile .tl (style.css:702) no tiene ancho fijo ni ellipsis y la baldosa 'Gráficos HD' (11 caracteres) ya es más larga que 'Nº daño' (7). No hay que tocar la clave 'dmgNumbers', ni SETTINGS_DEFAULT (game.js:43), ni toggleOn/toggleTile, ni el guardado: solo cambia el texto visible. Sin impacto en partidas guardadas.

## 10. [bajo] Santuario: 'La esencia se gana en cada partida: salas, bajas y jefes' omite cofres, victoria y logros
E:\PROYECTOS\arcano-rev\public\game.js:5072
Escenario: El propio desglose de la pantalla final enseña 'Salas +29 · Victoria +25' y 'Cofres +5' (log tx-verify2 'victoria'), y cada logro suma '+✨ N' en su aviso, pero el Santuario solo cita salas, bajas y jefes.
Arreglo verificado: En E:\PROYECTOS\arcano-rev\public\game.js, línea 5072, cambiar únicamente el texto del div .dim:

ANTES:
        <div class="dim">La esencia se gana en cada partida: salas, bajas y jefes</div>

DESPUÉS:
        <div class="dim">La esencia se gana jugando: salas, bajas, jefes, cofres, victoria y logros</div>

Notas: se quita "en cada partida" porque los logros son de una sola vez (no por partida); "victoria" en singular coincide con la etiqueta 'Victoria' del desglose de essenceParts. No hace falta tocar nada más: el cálculo (essenceParts/calcEssence) y el desglose de la pantalla final ya son correctos; solo el rótulo del Santuario estaba incompleto.
