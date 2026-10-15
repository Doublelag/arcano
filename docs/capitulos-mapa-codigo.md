# Mapa de "mazmorra única de 20 salas" en Arcano: qué hay que parametrizar para Capítulos y Modo Héroe

Copia analizada: `E:\PROYECTOS\arcano-rev\public` (game.js 5604 líneas, biomes.js, forms.js, equipment.js, music.js, sw.js, index.html). No he editado nada. Las líneas se refieren a game.js salvo que ponga otro fichero.

## Lo más importante

1. **Hoy no existe ningún objeto "capítulo".** Hay unas 30 constantes y condiciones repartidas que dependen de la variable global `room`:
   - `TOTAL_ROOMS`, `BOSSES[room]` y `ALTAR_ROOMS`.
   - `ArcanoBiomes.forRoom`, que asume tramos de 5 salas.
   - El escalado y el comportamiento de los enemigos.
2. **El `tier` del jefe hace cinco cosas a la vez:**
   - decide su dibujo (`drawBoss`);
   - decide su arena de trampas (`placeHazards`);
   - decide su dificultad (anillos, espiral, invocación);
   - decide el logro que da (`'boss'+tier`);
   - decide la red de seguridad del Despertar.

   Para reutilizar jefes en otros capítulos hay que separar al menos "modelo" de "dificultad".
3. **No hay oleadas.** Cada sala saca todos sus enemigos de golpe, con un retraso de 0,05 s entre uno y otro (`spawnRoom` 2620-2625). Hacer oleadas al estilo Archero es código nuevo.
4. **Hay código muerto.** El aviso "Se oye algo enorme…" (2626) nunca se ve: la sala 19 es un altar y `spawnRoom` sale antes, en 2602-2606.
5. **Choque de nombres.** Hoy ya sale un rótulo "CAPÍTULO n" cada 5 salas (2629-2634) que en realidad es el cambio de bioma. Con capítulos de verdad hay que renombrarlo ("zona") o quitarlo.
6. **Los bots se ejecutan en modo dios** (`player.god=true` en `sim`, `bench` y `roomBench`). Miden tiempos y ritmo, no si el jugador muere. Para ajustar el Modo Héroe ("el juego es fácil") hace falta un contador nuevo de **daño recibido por sala**. Hoy `hurtPlayer` (1483) sale antes de contarlo cuando `god` está activo.
7. **Determinismo.** Las comprobaciones de `simMatrix` dependen de la semilla. En la refactorización no se puede cambiar ni el número ni el orden de llamadas a `Math.random`: los cortocircuitos `room>=2 && … && Math.random()`, el orden de las claves de `ENEMY_UNLOCK` (de él sale `pick(pool)`), etc. Multiplicar por 1 no altera los floats.

---

## 1. Estructura de la mazmorra

**TOTAL_ROOMS (L10)**
- **Hoy:** 20 fijo. Se usa en:
  - 1610 (`clampArena`: la puerta se abre si `room<TOTAL_ROOMS`);
  - 2662 (`onCleared`: `room>=TOTAL_ROOMS` → `winTimer`);
  - 2828 (cruzar la puerta);
  - 3189 (flecha de la puerta);
  - 4121 (HUD "SALA x / 20");
  - 4378 (texto del menú);
  - 4628 y 5130 (récord por escuela, 21 = victoria);
  - 5148 y 5160 (pantalla final);
  - 5439 (bot `sim`).
- **Cambio:** `CH.len` con un accesor `lastRoom()`.
- **Riesgo:** 21 está metido en los datos guardados como "victoria" (`S.best`). Hace falta una codificación nueva compatible con la antigua (ver el apartado 12).

**BOSSES (298-303)**
- **Hoy:** van por sala `{5,10,15,20}` y cada uno lleva `tier`, `hp` fijo (480, 1150, 2600, 4700), `r`, `speed`, colores y `pats`.
  - `spawnRoom` (2588) los consulta por `BOSSES[room]`; también 2643 (`genRocks`), 2659 (cura del 25%) y 2661 (Ánima por sala limpia).
  - `makeBoss` (1687): `dmg = 14*dmgMul()` y `xp = 25+tier*10`. La vida del jefe **no** escala con `hm`.
- **Cambio:** un `BOSS_DEFS` por id (`golem`, `rey`, `brujo`, `senor`) y que el capítulo diga `bosses:{sala:{id, tier, hpMul, title}}`.
- **Riesgo:** el `tier` también se usa en:
  - `drawBoss` 3841-3885 (dibujo);
  - `bossRing` 1928 (`ringN` y velocidad);
  - `bossIdle` 1934;
  - la espiral (1973, 4 brazos si tier ≥ 4);
  - `dash` (2000, anillo si tier ≥ 2);
  - `summon` (2010, murciélago si tier ≥ 3, si no slime);
  - las arenas de `placeHazards` (2523-2531);
  - el logro (2099);
  - las redes del Despertar (2106-2108).

  Todo eso hay que repartirlo entre `model` (dibujo, arena y logro) y `tier` (patrones).

**ALTAR_ROOMS (L254)**
- **Hoy:** `{4,9,14,19}` fijo. Se usa en `placeHazards` (2533, sin trampas), `spawnRoom` (2602, altar y música 'menu'), `nextRoom` (2643, arena despejada) y `onCleared` (2661, sin Ánima por sala limpia).
- **Cambio:** que salga solo de los jefes: `altarAt(r) = !!bossAt(r+1)`, con opción de desactivarlo por capítulo.
- **Riesgo:** dos jefes seguidos dejarían un altar en una sala de jefe; hay que validarlo al cargar `CHAPTERS`.

**BOSS_TITLES (L265)**
- **Hoy:** van por sala; solo los lee la cinemática (2594 → `drawCine` 3362).
- **Cambio:** pasar el título al capítulo (`bosses[r].title`), porque el mismo jefe puede tener otro título en otro bioma.

**Fin de partida y puerta**
- **Hoy:** `onCleared` 2662 → `winTimer` → `update` 2831-2833 → `showEnd(true)`. `canOfferAwaken` (900) ya excluye la última sala porque `winTimer>=0`.
- **Cambio:** última sala = `CH.len` y tiene que ser un jefe.
- **Riesgo:** si un capítulo acaba sin jefe, `winTimer` sigue funcionando pero el Despertar y el texto "Se oye algo enorme" se descolocan.

## 2. Biomas y tinte

**ArcanoBiomes.forRoom** (biomes.js 1352-1355)
- **Hoy:** `r<=5 pradera`, `<=10 cripta`, `<=15 cristal`, si no `volcan`.
- **Se llama desde dos sitios:**
  - `biomeId()` (3070-3074), que usan el fondo (3079), las trampas (2511) y el ambiente (4224);
  - directamente desde `makeEnemy` (1664) para `BIOME_TINT`. Este duplicado es fácil de olvidar.
- **Cambio:** `CH.zones=[['pradera',5],…]` con un `biomeAt(room)` en game.js, y que `makeEnemy` use `biomeId()`. `forRoom` se queda como respaldo.

**BIOME_HAZARD (L264)**
- **Hoy:** por bioma (pradera 0, cripta veneno, cristal hielo, volcán lava), con `'cripta'` de respaldo si no hay biomes.js.
- **Cambio:** se puede quedar por bioma y permitir `CH.hazard.special` para sobrescribirlo.

**BIOME_TINT (212-215)**
- **Hoy:** recolorea enemigos por bioma (slimes azules en la pradera).
- **Cambio:** permitir `CH.enemyTint` por capítulo para que el tinte del suelo no se coma a los enemigos.

**Tinte del fondo**
- **Hoy:** `render()` (biomes.js 1209-1298) no tiene parámetro de tinte; los colores están escritos dentro de cada bioma (p. ej. pradera 255+).
- **Cambio, la opción más barata:** `opts.tint={color, alpha, mode:'color'|'multiply'}` aplicado al lienzo cacheado. Se puede hacer al final de `render()` o en `buildRoomBg` (3075-3082) **antes** de `paintHazardBase`.
- **Riesgo:** quedarían sin teñir las antorchas (`drawTorches` 3096, color fijo), las partículas de ambiente (`ambient` 1303) y la puerta.

**Rótulo "CAPÍTULO n" cada 5 salas (2629-2634)**
- **Cambio:** convertirlo en un rótulo de zona que salte cuando cambie `biomeAt(room)`, no con `room%5===1`. El rótulo de capítulo de verdad iría en la sala 1.

**Fondo del menú**
- **Hoy:** `menuBiome = pick(list)` al azar (3072 y 4362).
- **Cambio:** usar el primer bioma del capítulo seleccionado.

## 3. Música

- **Hoy:** una sola pista 'dungeon' para todo.
  - `spawnRoom` 2598 'boss', 2605 'menu' en el altar, 2608 'dungeon' (salvo en el selector de escuela); `pickSchool` 2752; `die` 2791; `showEnd` 5144-5145.
  - `TRACKS` en music.js 511-519.
  - `play(t)` no hace nada si se pide la pista que ya suena (music.js 677).
- **Cambio:** `CH.music={dungeon, boss, key}`.
  - Opción barata: una transposición global en music.js aplicada al programar notas. Los `step` trabajan con MIDI, así que funciona aunque la pista ya esté sonando.
  - Opción cara: pistas nuevas en `TRACKS`.
  - Para el Héroe: transposición o capas extra subiendo `setIntensity`.
- **Riesgo:** el `bpm` se fija en `makePlayer` (music.js 541); cambiarlo obliga a usar otro nombre de pista. Hay un límite de 44 fuentes (`MAX_SRC`).

## 4. Escalado de enemigos y jefes (núcleo de la dificultad)

**Fórmulas de vida y daño**
- **Hoy:**
  - Vida: `makeEnemy` 1663, `hm = 1+0.2(r-1)+0.006(r-1)²` → ×1,9 en la sala 5, ×3,29 en la 10, ×4,98 en la 15, ×6,97 en la 20.
  - Daño: `dmgMul()` L399, `1+0.07(r-1)` → ×2,33 en la sala 20. Lo usan el daño de enemigos (1667), el del jefe (1690), las trampas (1615-1616: pinchos 10, lava 7) y la explosión del diablillo contra los suyos (2141).
- **Cambio:**
  - `hpMul = CH.scale.hp × (héroe ? HERO.hp : 1) × curva(rn)`, con `rn = (r-1)·19/(len-1)`. Para un capítulo de 20 salas sale exactamente igual que hoy.
  - Igual para `dmgMul`.
  - **No** continuar la curva con "sala 21-40": el jugador vuelve a empezar en nivel 1 en cada partida.

**Comportamientos que dependen de `room` en `updateEnemy`**
- **Hoy:**
  - arquero: velocidad `290+room*4`, triple disparo si `room>=9` (1802-1804);
  - cultista: `8+floor(room/5)*2` balas a `165+room*3` (1836-1837);
  - tótem: 6 brazos si `room>=15`, ritmo 0,95 s si `room>=14`, velocidad `150+room*3` (1860-1863);
  - espectro: 5 balas si `room>=15` (1888).
- **Cambio:** guardar `e.lv` al crear el enemigo (= `room` en el capítulo 1 normal) y usarlo en vez de `room`. En el Héroe, `e.lv = room + HERO.lv` (por ejemplo +8): eso son los "enemigos mejorados" reutilizando ramas que ya existen (triple disparo desde la sala 1, más balas, tótem de 6 brazos), sin dibujo nuevo.

**Más mejoras posibles para el Héroe** (código pequeño y nuevo):
- carga doble del embestidor (copiando `b.sub` del jefe);
- mecha del diablillo de 0,8 a 0,55 s (1849);
- slime grande que se divide en 3 (2115).

**Jefes**
- **Hoy:** furia al 50% (1950); daño por contacto ×1,4 (1913); como mucho 3 secuaces (2010).
- **Cambio:** `HERO.enrageAt` (por ejemplo 0,6), `bossHp` y `bossDmg` por capítulo y por Héroe.
- **Riesgo:** el objetivo de los bots es congelar al jefe ≤35% del combate (5493-5494). Con más vida, el combate dura más y cambia ese porcentaje. Hay que repasar `FRZ_DR` (L790).

## 5. Presupuesto de enemigos por sala y oleadas

**Presupuesto** (`roomEnemies(n)` 1699-1711)
- **Hoy:**
  - qué enemigos salen: `ENEMY_UNLOCK` (L217, sala de aparición de cada tipo);
  - presupuesto `3.5+0.55n` (4,05 en la sala 1, 13,4 en la 18);
  - como mucho 11 enemigos;
  - topes por tipo `{totem:2, spirit:3, bomber:3, bigslime:2}`;
  - coste por tipo en `ENEMIES` (200-210).
- **Cambio:** `CH.pool` (mismo formato y **mismo orden de claves**), `CH.budget=[base, porSala]`, `CH.maxN` y `CH.caps`. Para el Héroe, `budget×` o `+maxN`.
- **Riesgo:** `pick(pool)` es uniforme. Para dar personalidad a un capítulo pueden hacer falta pesos, y eso añade llamadas a `Math.random`, así que solo en contenido nuevo.

**Oleadas**
- **Hoy:** no existen.
- **Cambio:** `CH.waves` (por sala o como regla, p. ej. `{from:6, n:2, at:0.3}`). `spawnRoom` repartiría la lista en `waveQ` y `update` (2820) pasaría a hacer `if(!cleared && !enemies.length){ waveQ.length ? spawnWave() : onCleared() }`.
- **Riesgos:**
  - entre oleadas las gemas no se atraen solas (`updateDrops` 2410 depende de `cleared`);
  - el maná solo se gana con `!cleared` (1620);
  - la intensidad de la música usa `enemies.length` (2804);
  - el `unstick` de los bots;
  - el contador de reacciones por sala (`roomReactA`).

  Dejarlo para el final.

## 6. Élites

- **Hoy:** en `spawnRoom` 2623, `room>=6 && elites<2 && rand<0.1+room*0.006`. `makeElite` (1678-1685) da vida ×2,2, daño ×1,25 y experiencia ×2. Un élite también cambia: corazones 30% (2088), maná 10 (2092), Ánima `elite` (2094) y estadística y logro (2077).
- **Cambio:** `CH.elite={from, max, p0, pr, hp, dmg}` más un extra del Héroe (`from:3`, `max:3`).
- **Riesgo:** con más élites se gana más Ánima y se adelanta el Despertar. Hay que volver a medir `aw1` y `aw2`.

## 7. Trampas, cofres y curaciones

Son las palancas directas de "es fácil".

**Trampas** (`placeHazards` 2533-2539)
- **Hoy:** ninguna antes de la sala 3 ni en altares; 60% de salas con trampas; 2-3 grupos; 55% del tipo especial del bioma. Las arenas de jefe van por tier (2523-2531).
- **Cambio:** `CH.hazard={from, chance, n, special}` y que la arena vaya por `model`.

**Cofres** (2619)
- **Hoy:** desde la sala 2, 20%, como mucho 3 por partida. `openChest` (2560-2581) cura el 15%, da 5 gemas de 5, +5 de esencia, un objeto y una elección de habilidad.
- **Cambio:** `CH.chest={from, p, max}`.

**Curaciones fijas:**
- 25% tras cada jefe (`onCleared` 2659);
- 60% en el altar (`pickAltar` 4982);
- corazones: probabilidad 6% normal y 30% élite (2088), curan el 15% (`collectDrop` 2401);
- Poción del 40% (318 y 5072);
- 10% de la ventaja `roomShield` (2660).

**Cambio:** `CH.heal={boss, altar, heart}` y en el Héroe, por ejemplo, `boss:0.1, altar:0.4, heart×0.5`.

**Riesgo:** hay que cambiar también el texto del altar ("Recuperas el 60%", 4958).

## 8. Botín

- **Hoy:**
  - Cofre: `rollDrop(min(20, room+3))` (2570).
  - Final de partida: `rollDrop(room)` × `1+min(2,bossesKilled)+win`, solo si `room>=3` (5123-5126). El `min(2,…)` da por hecho que hay 4 jefes.
  - equipment.js: `rarityOdds` (127-136) **limita la profundidad a 1-20** (130) y el comentario de cabecera (14-16) está escrito por sala.
- **Cambio:** `depth = room + CH.loot + (héroe ? HERO.loot : 0)` y ampliar el límite de `rarityOdds` (por ejemplo a 40) continuando las curvas de épico y legendario.
- **Riesgos:**
  - inflación de legendarios, que hace el juego más fácil por la vía del equipo;
  - el inventario se llena antes (`GEAR_MAX` 60, L473);
  - el mítico nunca cae (equipment.js 144), y eso se mantiene.

## 9. Esencia por partida (tiene que COSTAR)

- **Hoy:** `essenceParts(win)` 5056-5064:
  - salas: `(room-1)×1,5`;
  - bajas: `kills×0,15`;
  - jefes: `bossesKilled×8`;
  - cofres: `runBonusEss`;
  - victoria: 25.
- **Estimación:** una victoria de 20 salas da unos 29 + 13 + 32 + 25 + 5 ≈ 105; morir hacia la sala 8 da ≈ 25-30.
- El HUD muestra la esencia en directo (4122) y `showEnd` la suma (5121-5122).
- **Cambio:** `CH.ess` como multiplicador o por partes. Un capítulo largo ya da más por "salas" y "bajas" sin tocar nada.
- **Recomendación:** en el Héroe, poco multiplicador (≤×1,25) y que el premio sea una **bonificación de primera vez** guardada en `meta`, no ×N en cada partida.
- **Riesgo:** inflar la economía va contra lo que quiere Double. Hay que pasar `tools/rev-econ.js` en cada capítulo y modo.

## 10. Logros (ACHIEVEMENTS 268-296)

- **`boss1`-`boss4`:** hoy se dan con `unlock('boss'+e.tier)` (2099), con nombres de jefes concretos. Debe pasar a `unlock(BOSS_DEFS[id].ach)`. Si se reutiliza un jefe con otro tier en el capítulo 2, hoy daría un logro equivocado.
- **`room10`:** `room>=10` (2640). Vale en cualquier capítulo.
- **`firstWin`:** "Completa la mazmorra". Pasa a ser el capítulo 1.
- **`speedrun`:** `runTime<270` (5142). Solo tiene sentido en un capítulo de 20 salas: `CH.speedrun` o solo en el capítulo 1 normal.
- **`winAll` y `formWins`:** cualquier victoria cuenta. Decidir si vale cualquier capítulo (lo lógico es que sí).
- **Nuevos:** capítulo 2 completado, primer Héroe completado, etc. Cada uno da esencia, otra vez el riesgo de economía.

## 11. Récord (`arcano.best`)

- **Hoy:** guarda `{room, lvl, win, school}` (5117-5120) y compara por victoria, sala y nivel. El menú lo muestra en 4366/4386 ("🏆 Mazmorra completada" o "Sala N") y `resetProgress` lo borra (4468).
- **Cambio:** `{ch, hero, room, len, lvl, win, school}`, ordenado por (capítulo, héroe, victoria, sala, nivel). Un guardado sin `ch` se trata como capítulo 1 normal.
- **Riesgo:** los récords guardados con el formato actual.

## 12. Estadísticas: mejor sala por escuela

- **Hoy:** `S.best[escuela] = max(…, win ? 21 : room)` (5130). `showStats` lo pinta con `b > TOTAL_ROOMS ? '🏆' : 'Sala '+b` (4626-4628) bajo el título "Mejor sala por escuela" (4649).
- **Cambio:** un entero compatible con lo guardado: `(ch-1)*100 + (héroe?50:0) + (win ? len+1 : room)`, con `len<50`. Los valores 1-21 actuales siguen significando capítulo 1 normal. Mostrarlo como "C2·S12" o "🏆 C2★".
- **Más estadísticas:** victorias por capítulo y héroe, en un campo compacto.

## 13. Despertar

**Redes de seguridad** (`killEnemy` 2104-2109, por tier del jefe)
- **Hoy:** (a) tier 1 sin haber despertado nunca; (b) tier 2 con `aw0`; (c) tier 3 con `aw1`. Están documentadas en `docs/despertar-spec.md` 82-84.
- **Cambio:** por ordinal de jefe dentro del capítulo: `CH.nets={a:1, b:2, c:3}` (en el capítulo 1 coincide con el tier). Hay que llevar un contador `bossOrd`.

**Ritmo por sala**
- **Hoy:** la especificación (85-87) dice 1.er despertar en las salas 5-7 y 2.º en las 12-14, y lo comprueban `simChecks` 5489-5490.
- **Cambio:** medirlo como fracción del capítulo (por ejemplo 0,25-0,35 y 0,6-0,7).

**`need` del Ánima** (forms.js L27)
- **Hoy:** `ANIMA.need=[100,160]`, con kill 2, elite 6, minion 0,5, boss 40 (proporcional al daño, así que no le afecta `bossHp`) y clean 5.
- **Cambio:** que el capítulo pueda sobrescribir `need`. Los capítulos largos y los que tienen más élites lo adelantan; en el Héroe cuesta más acabar una sala sin recibir daño y lo atrasa, y las redes lo compensan.

**Otros**
- `snoozeRoom` (900, 919) y `awakenLater` no cambian.
- La especificación (L96) dice "No se ofrece en la sala 20"; pasa a ser "en la última sala".

## 14. Grimorio

- **Marca II de forma pura:** `discoverForm` 981/983, `room<=6`. Texto fijo "Despiértala antes de la sala 7" (4720) y especificación L402. Cambio: `CH.markRoom` (6 en el capítulo 1) o un umbral por fracción, y que el texto salga de ahí.
- **Ritmo `k`:**
  - `g.k[...] += room` (985), mostrado en `grimRhythm` (4773-4776) y `grimStatRows` (4766-4771) como "sala media".
  - Mezclar capítulos de distinta longitud estropea la media.
  - Cambio: normalizar a la escala de 20 salas (`room*20/len`) para no cambiar el formato de 4 números de la cookie (`grimPack` L411), o contar solo el capítulo 1 normal.

## 15. Pantallas

**Menú** (`showMenu` 4353-4393)
- Hoy: el texto "Roguelite de magia · 20 salas · 4 jefes" (4378); JUGAR → `newRun()` (5184); Enter o Espacio → `newRun()` (551).
- Cambio: un selector de capítulos estilo Archero (flechas, candado, interruptor HÉROE si está desbloqueado, récord del capítulo). Puede ir dentro del menú o en un estado nuevo `'chapters'`; en ese caso hay que añadirlo a Escape (547), a `popstate` (4347-4348) y a `goBack` (4812).

**`newRun` (2667-2693)**
- Hoy: llama a `nextRoom()` **antes** de `showSchools()`. La sala 1 se genera detrás del selector de escuela, así que el capítulo tiene que estar fijado **antes** de `newRun`.
- `goBack` desde el Santuario abierto en el selector de escuela vuelve a llamar a `newRun()` (4814): debe conservar el capítulo.

**Selector de escuela** (`showSchools` 2695-2720)
- Añadir el nombre del capítulo y una insignia de Héroe en el subtítulo.

**Pausa** (5098)
- Hoy: "Sala N". Pasar a "Cap. X · Sala N/len (Héroe)".

**Final** (`showEnd` 5112-5173)
- Textos a cambiar: "Has limpiado la mazmorra entera" y "sala N de 20" (5148), y la estadística "Sala room/20" (5160).
- Botón OTRA VEZ / REINTENTAR (5167) → mismo capítulo y modo.
- Al ganar: aviso "Capítulo X+1 desbloqueado / Modo Héroe desbloqueado" y botón "SIGUIENTE CAPÍTULO".

**HUD** (4121)
- Hoy: "SALA x / 20". Pasar a "C2 · SALA x/25" y marcar el Héroe con color o icono.

**Estadísticas** (4621): ver el apartado 12.

**CSS:** `.tag`, `.best` y `.sbests` (style.css 76/119/520). El selector necesita CSS nuevo y hay que comprobarlo en pantallas bajas, porque el panel del menú ya tiene muchas filas.

**index.html:** las descripciones meta dicen "limpia la mazmorra" (L14/25/33). Si el capítulo va en un fichero nuevo (`chapters.js`), cargarlo antes de game.js (47-51).

## 16. Tutorial

- **Hoy:** `tutStart` (532) se activa si `!settings.tutorial`; `tutDone` cuando `room>=2` (2641); el paso 'door' en la sala 1 (2664).
- **Cambio:** que solo arranque en el capítulo 1 normal. No es un riesgo real: el selector solo deja elegir otros capítulos tras ganar el 1.

## 17. Depuración, bots y herramientas

**Depuración**
- `__arcano` (5250-5254): añadir getters de `chapter` y `hero`.
- `goto(n)` (5283) hace `room=n-1; nextRoom()`. Pasa a `goto(n, ch=1, hero=false)` **compatible**: más de 50 scripts de `E:\PROYECTOS\arcano-rev\tools` (balance-*, rev-*, fase*, bots.js, smoke.js…) usan `goto`, `sim`, `bench` o `.room` dando por hecho el capítulo 1.
- `school(id)` (5293) llama a `newRun()`: añadir `dbg.chapter(id, hero)`.

**Bots**
- `sim` (5414-5458): la condición `room < TOTAL_ROOMS` (5439) y faltan un parámetro `ch`/`hero` y el contador de daño recibido.
- `simRow` (5465): los tiempos de jefe están fijos en `[5,10,15,20]`; hay que sacarlos de `CH.bosses`.
- `simChecks` (5479-5501):
  - tiempo de 4 a 6 minutos (5485);
  - despertares en salas 5-7 y 11-14 (5489-5490);
  - redes b ≤15% y c ≤20%.

  Todo eso pasa a ser por capítulo.
- `bench`: sala 15 por defecto (5531).
- `roomBench`: salas `[7,8,11,12,13,16,17,18]` (5565), que son las normales del capítulo 1. Sacarlas del capítulo.

## 18. Guardado y service worker

**Guardado**
- `META_DEFAULT` (403-409), `loadMeta` (426-451) y la validación de tipos al estilo de `grimValid`.
- `cookieValue`: tope de 3800 caracteres (453-459), que ya obliga a compactar equipo y Grimorio.
- Hay que añadir el progreso compacto (por ejemplo `prog:{n:1, h:0, cn:0, chh:0}`: capítulo más alto desbloqueado, Héroe desbloqueado y máscaras de capítulos completados).
- **Migración:** si `stats.wins>0`, desbloquear el capítulo 2 y el Héroe del capítulo 1.
- `resetProgress` (4463) ya lo cubre a través de `META_DEFAULT`.
- El evento `storage` (561-567) recarga `meta`; repintar también el selector.
- El capítulo seleccionado puede guardarse en `settings`, que es por dispositivo.

**Service worker:** `sw.js` tiene `CACHE='arcano-v3'` y `PRECACHE`. Funciona "red primero", pero conviene subir la versión y añadir `chapters.js` si se crea.

---

## Propuesta de estructura de datos

```js
// jefes por id (separa modelo/arena/logro de la dificultad)
const BOSS_DEFS = {
  golem: { model: 1, ach: 'boss1', arena: 'spikes', name: 'Gólem de Piedra',      hp: 480,  r: 40, speed: 55, color: '#8f8270', bullet: '#ffb347', pats: ['ring','charge','aimed'] },
  rey:   { model: 2, ach: 'boss2', arena: 'poison', name: 'Rey Slime',            hp: 1150, r: 42, speed: 65, color: '#57c75e', bullet: '#b6ff6b', pats: ['summon','ring','charge','aimed'] },
  brujo: { model: 3, ach: 'boss3', arena: 'ice',    name: 'Brujo Sombrío',        hp: 2600, r: 34, speed: 45, color: '#6d4bd8', bullet: '#c58bff', pats: ['spiral','teleport','aimed','summon','ring'] },
  senor: { model: 4, ach: 'boss4', arena: 'lava',   name: 'Señor de la Mazmorra', hp: 4700, r: 44, speed: 70, color: '#d63c3c', bullet: '#ff6a3d', pats: ['spiral','charge','ring','summon','teleport','aimed'] },
};
// Modo Héroe: misma estructura, encima de cualquier capítulo (valores iniciales a ajustar con bots)
const HERO = { hp: 1.8, dmg: 1.4, bossHp: 1.7, bossDmg: 1.3, lv: 8, enrageAt: 0.6,
  elite: { from: 3, max: 3, p0: 0.2 }, budget: 1.15, heal: { boss: 0.10, altar: 0.40, heart: 0.5 },
  loot: 6, ess: 1.2, firstClearEss: 40, music: { key: 1 } };
const CHAPTERS = [
  { id: 1, name: 'La Mazmorra', len: 20,                        // = juego actual, bit a bit
    zones: [['pradera', 5], ['cripta', 10], ['cristal', 15], ['volcan', 20]], tint: null, enemyTint: null,
    bosses: { 5:  { id: 'golem', tier: 1, title: 'Guardián de la pradera' },
              10: { id: 'rey',   tier: 2, title: 'Monarca de la cripta' },
              15: { id: 'brujo', tier: 3, title: 'Tirano de la gruta helada' },
              20: { id: 'senor', tier: 4, title: 'Corazón del volcán' } },
    altars: true,                                               // altar en bossRoom-1
    pool: { slime: 1, bat: 1, archer: 2, charger: 3, mage: 4, bigslime: 6, bomber: 6, totem: 7, spirit: 11 }, // MISMO orden de claves
    caps: { totem: 2, spirit: 3, bomber: 3, bigslime: 2 }, maxN: 11, budget: [3.5, 0.55], waves: null,
    scale: { hp: 1, dmg: 1, bossHp: 1, bossDmg: 1, lv: 0 },     // curva normalizada a len
    elite: { from: 6, max: 2, p0: 0.1, pr: 0.006, hp: 2.2, dmg: 1.25 },
    hazard: { from: 3, chance: 0.6, n: [2, 3], special: 0.55 },
    chest: { from: 2, p: 0.2, max: 3 },
    heal: { boss: 0.25, altar: 0.6, heart: 1 },
    loot: 0, ess: 1, music: { dungeon: 'dungeon', boss: 'boss', key: 0 },
    anima: null,                                                // null = forms.js ANIMA.need
    nets: { a: 1, b: 2, c: 3 }, markRoom: 6, speedrun: 270,
    unlock: null },                                             // siempre abierto
  { id: 2, name: 'Catacumbas de Ceniza', len: 25,
    zones: [['cripta', 8], ['volcan', 16], ['cristal', 25]], tint: { color: '#ff6a3d', a: 0.12, mode: 'color' },
    bosses: { 8: { id: 'rey', tier: 2, hpMul: 1.3 }, 16: { id: 'golem', tier: 3, hpMul: 2.6 }, 25: { id: 'brujo', tier: 4, hpMul: 1.6 } },
    pool: { slime: 1, bat: 1, archer: 1, charger: 2, mage: 2, bomber: 3, bigslime: 4, totem: 5, spirit: 7 },
    budget: [4.5, 0.55], scale: { hp: 1.35, dmg: 1.2, bossHp: 1, bossDmg: 1.15, lv: 3 }, loot: 4, ess: 1.1,
    nets: { a: 1, b: 2, c: 2 }, markRoom: 9, unlock: { ch: 1 } /* … resto heredado del cap. 1 */ },
];
```

**Accesores únicos.** Ningún otro sitio debería leer `room` para decisiones de diseño:
- `CH`, `HEROIC`;
- `lastRoom()`, `bossAt(r)` (que mezcla `BOSS_DEFS` con el capítulo), `altarAt(r)`, `biomeAt(r)`;
- `curveR(r)`, `hpMul(r)`, `dmgMul()`, `enemyLv()`, `lootDepth()`, `essMul()`.

**Herencia:** `CHAPTERS[i] = Object.assign({}, CHAPTERS[0], overrides)` con objetos internos copiados, y un `validateChapters()` al cargar que compruebe:
- última sala = jefe;
- ningún altar en una sala de jefe;
- las zonas cubren `len`;
- todos los ids existen en `BOSS_DEFS` y `ENEMIES`.

## Orden de implementación seguro

0. **Línea base.** Guardar en JSON, con semillas fijas, los resultados de `simMatrix({seeds:8})`, `bench`, `roomBench`, `rev-econ` y `smoke` del código actual.
1. **Refactorización sin cambio de comportamiento:**
   - `CHAPTERS[0]` igual que hoy;
   - sustituir `TOTAL_ROOMS`, `BOSSES`, `ALTAR_ROOMS`, `ENEMY_UNLOCK`, presupuesto, élites, trampas, cofres, curaciones y `BOSS_TITLES` por los accesores;
   - `biomeAt` en lugar de `forRoom`, incluido el de `makeEnemy` (1664);
   - `e.lv` en `updateEnemy`;
   - jefe con `model`/`tier`/`ach`/`arena` separados;
   - redes por ordinal; `markRoom`, `speedrun`, `ess` y `loot` del capítulo.

   Hay que comparar el JSON **idéntico** con la línea base. Ni una llamada a `Math.random` más ni menos, y el mismo orden de claves.
2. **Guardado y migración:** `meta.prog`, el récord con `ch`/`hero`, la nueva codificación de `S.best` y la prueba de tamaño con `__arcano.cookie()`. Validar con `rev-save1/2`.
3. **Modo Héroe del capítulo 1.** Es el contenido más barato y responde directamente a "es fácil":
   - multiplicadores, `HERO.lv`, curaciones y élites;
   - contador de daño recibido en `sim`;
   - ajuste con bots;
   - desbloqueo al ganar el capítulo 1.
4. **Interfaz:** selector de capítulo y Héroe; HUD, pausa, final, selector de escuela y estadísticas; Enter/Escape/`popstate`/`goBack`; botón "Siguiente capítulo".
5. **Contenido:**
   - tinte en biomes.js (`opts.tint`);
   - transposición en music.js (opcional);
   - datos del capítulo 2 y luego del 3 (son datos, no código).
6. **Despertar y Grimorio por capítulo:** `anima.need` por capítulo, `k` normalizado, texto de la Marca II y `simChecks` por fracción del capítulo.
7. **Economía:**
   - esencia por capítulo y Héroe con bonificación de primera vez;
   - `rarityOdds` con límite ampliado en equipment.js;
   - logros nuevos;
   - `rev-econ` para mantener "partida media ~30".
8. **Oleadas (opcional, al final).** Tocan el ciclo de sala limpia, el maná, la atracción de gemas y los bots.
9. **Cierre:** subir la versión de caché en `sw.js`, actualizar el meta de `index.html` y los docs (`docs/despertar-spec.md` 82-96 y 402).

Ajustar la dificultad del capítulo 1 normal (la queja de que es fácil) debe ir **después** del paso 1 y en un cambio separado. Si se mezcla con la refactorización, se pierde la comparación exacta con los bots.