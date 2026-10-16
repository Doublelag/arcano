# Arcano · Especificación final de progresión: capítulos, Modo Héroe y dificultad (v1.1)

> Documento para implementar sin más preguntas. Parte de la propuesta «movil» (ganadora: 45,6 frente a 40,1 y 38,1) y le injerta las mejores ideas de «archero» y «roguelite», con los errores que señalaron los jueces ya corregidos.
> Base de datos: `docs/dificultad-bot-matriz.txt`, el informe del esquivador (320 + 96 + 75 partidas), `docs/dificultad-analisis-codigo.md`, `docs/dificultad-investigacion.md`, `docs/archero-capitulos.md`, `docs/capitulos-mapa-codigo.md` y `docs/despertar-spec.md`.
> Las líneas de código son de `E:\PROYECTOS\arcano-snap\public\game.js` (copia idéntica al HEAD). **Antes de tocar nada en `E:\PROYECTOS\arcano`, busca siempre la función por su nombre con grep, nunca por el número de línea**, porque otro agente está editando ese árbol.

---

## Correcciones del crítico (16-oct-2026, v1.1-K) · LEER ANTES QUE EL RESTO

Se probó la curva base del C1 con parches temporales sobre **copias en el scratch** (no se tocó `arcano-snap/public` ni `arcano`) y el esquivador: 5 escuelas × 8 semillas (11-18) = **40 partidas por fila**, cuenta fresca y con formas salvo que se diga. Total: 1.000 partidas nuevas. Datos: `scratchpad\c1v11\out`, `c1v11b\out`, `c1\out`, `c2\out`, `vd\out` (sesión fb9d0aba); parches `c1v11-patch.mjs` (fase 4 = §4.1-4.7 tal cual), `c1v11-patchB.mjs` (aproximación de la fase 5) y `c1v11-patchC.mjs`; resumen `c1v11-sum.mjs`.

**La aproximación de la fase 5 (B)** usa solo lo que el bot sabe esquivar: fases de jefe al 50 % (Señor también al 25 %) con 1 s invulnerable y balas vaciadas como dice el §5.2, el extra es un patrón que ya existe (Gólem espiral, Rey teletransporte con anillo, Brujo abanico doble, Señor anillo), pausa `(rand(0,8;1,3) − 0,1·tier)·0,7^fase`; afijos Veloz (`ds` ×1,4), Escudado (vida ×1,3), Volátil (8 balas a 140 px/s tras 0,6 s, s11+) e Invocador (2 murciélagos cada 6 s, s13+); abanico del jefe con aviso de 0,35 s. No incluye Rocas, Salto, Espejismo ni Juicio.

| Variante | novato | medio | medio sin formas | bueno | vet. medio | vet. bueno | dios t. med. (mín.) | golpes medio | sala normal | jefes 5/10/15 | s20 | cura/daño |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Hoy | 33 % | 95 % | 80 % | 98 % | 100 % | 100 % | 3:33 (2:55) | 3,6 | 0,10 | 0,4/0,35/0,33 | 1,33 | 1,08 |
| **A** = fase 4 tal cual (§4.1-4.7) | 13 % (sin formas 0 %) | **70 %** | 48 % | 95 % | 98 % | 100 % | 4:05 (3:17) | 5,7 | 0,16 | 0,5/0,88/0,42 | 2,11 | 0,65 |
| **B** = A + aprox. fase 5 | 13 % | 70 % | — | 93 % | — | — | 4:07 (3:34) | 6,4 | 0,18 | 0,75/0,57/1,23 | 1,81 | 0,78 |
| **C1** = B + refuerzos en las 9 salas normales desde la s6 + élites `p0` 0,18 + corazones sin recogida automática + jefes ×1,5 | 3 % | 60 % | — | 93 % | 98 % | 100 % | 4:25 (3:28) | 6,5 | 0,17 | 0,6/0,85/1,18 | 2,26 | 0,70 |
| **C2** = C1 + `dmgMul` 0,085 | 0 % | 38 % | — | 85 % | 100 % | 100 % | (= C1) | 6,6 | 0,16 | 0,6/0,85/1,26 | 2,56 | 0,59 |
| **D** = C1 + plantel ponderado (K2) | **5 %** | **48 %** | — | **88 %** | 90 % (n=20) | — | **4:30 (3:38)** | 6,4 | 0,18 | 0,6/0,75/1,45 | 1,91 | 0,63 |

Otros datos de D: muertes del medio s15×7, s18×1, s20×13 (62 % en la s20, 33 % entre la s10 y la s15); el novato llega a la s10 en el 88 % y muere en la s5 en el 12 %; Despertar 1º s6-7 y 2º s12-13 con `need` [110, 175] (dentro de las ventanas); esencia de victoria 113-117. Por escuela (medio): hielo 100 %, arcano 38 %, veneno 50 %, fuego 38 %, rayo 13 %.

**Veredicto**: la spec, tal cual, **no llega a su objetivo**: deja al medio en el 70 % (no 25-35 %), con 5,7 golpes (no 8,5-10) y el dios en 4:05 (no 5:00). La fase 5, tal como está escrita, no añade dificultad medible (A → B: 70 → 70 %), porque la transición vacía las balas y da 1 s de respiro, y lo que de verdad es nuevo (Rocas, Salto, Juicio) el bot ni lo ve. Con las correcciones de abajo (variante D) el C1 queda **en un punto publicable**: medio 48 %, bueno 88 %, novato 5 % (y casi todos llegan a la s10), partidas de 4:30-4:50, sin tocar el daño por golpe ni la caja. Lo que **no** se consigue con ningún ajuste justo es que el C1 le cueste a Double: el veterano gana el 90-100 % en las seis variantes, también con daño ×1,12. Eso no es un fallo del C1, es un dato que manda en el diseño de los capítulos 2-4 y del Héroe (K12).

**Correcciones (ya aplicadas en el texto, marcadas con «K»)**
- **K1 · Objetivos del C1 (D9, §10.1)**: medio 40-55 %, bueno 80-92 %, novato 3-10 % con ≥ 80 % llegando a la s10, veterano sin objetivo (≥ 85 %). Los objetivos antiguos son incompatibles entre sí: todo lo que baja al medio hunde antes al novato (medio 38 % ⇒ novato 0 %) y el bueno nunca baja del 85 %. Con el bot unos 10 puntos optimista, una persona media queda en 30-45 %, que es lo sano para la puerta de entrada (restricción 8).
- **K2 · Densidad de amenaza, no de bichos (§4.2, D10)**: desde la s6, un slime o murciélago sacado del plantel se cambia por otro tipo con probabilidad 0,65. Es la palanca que más mueve al medio (60 → 48 %) sin tocar al novato (3 → 5 %). Las salas normales siguen en 0,16-0,18 golpes por sala en todas las variantes: el objetivo de ≥ 0,3 era irreal y se baja a ≥ 0,15.
- **K3 · Paquete base del C1**: refuerzos en las 9 salas normales desde la s6; élites `p = 0,18 + 0,008·r`; los corazones no se recogen solos al salir; jefes ×1,5 (720 / 1725 / 3900 / 7050) desde el principio. Las palancas de reserva del §4.10 se reescriben.
- **K4 · Calibración por fases (§9.5)**: la fase 4 se cierra con el medio en 55-70 %, no en 25-35 %; si se calibra la fase 4 al objetivo final, la fase 5 lo deja por debajo.
- **K5 · Transición de fase (§5.2)**: 0,6 s invulnerable y **sin** vaciar balas.
- **K6 · Tiempo y `speedrun` (D22, §4.9, §10.1)**: el suelo de 5:00 no se alcanza sin esponjas (dios con formas: 4:05 con la fase 4, 4:30 con D). Objetivo nuevo: dios con formas 4:15-4:45 de mediana. El `speedrun` se queda en 270 s: con 360 s sería un regalo (el medio fresco gana en 4:46 de mediana).
- **K7 · Esencia en derrota (§6.2)**: el medio muere sobre todo en la s15 y la s20, así que una derrota paga 69-74, no 28-35. Esencia media por partida del medio ≈ 0,48·115 + 0,52·71 ≈ 92 (hoy ≈ 110): el Santuario se encarece solo un 15-20 %. Es correcto (no se inflan recompensas), pero las cifras de la tabla del §6.2 estaban mal.
- **K8 · El bot no mide lo que la fase 5 añade (§9.4)**: no ve Rocas, Salto, Juicio ni el aviso del Volátil, y en el altar elige siempre Bendición: la Fuente (60 → 50 %) y el Pacto favorable **no están medidos**. Hay que añadirlo al esquivador antes de calibrar la fase 5.
- **K9 · Colores (§3.3, §4.8, §5.1)**: la spec pintaba de naranja las balas enemigas, que es el color de la escuela de Fuego (`#ff8a3d`), de la lava y del volcán, donde más se muere; los monstruos héroe con `#c77dff`, que es exactamente el color del Arcano; Veloz con `#ffe45c`, que es el del Rayo; Invocador con `#b06bff`, que es el del charco venenoso. Corregido: balas en rojo, rosa y magenta con contorno oscuro; afijos con el aura dorada de élite y el glifo en blanco; héroe en `#8a3cff` con barra morada de 40 px (hoy **todos** los enemigos llevan barra, así que «los normales no la llevan» era falso).
- **K10 · Escuelas**: la diferencia entre escuelas pasa de 19 puntos (hoy) a 87 (hielo 100 %, rayo 13 %). El hielo frena también los **ataques** (`ds` ×0,62, ×0,5 con Hielo 2): con más tiradores, eso vale más. Fase 4, tras K2: que la ralentización afecte a los temporizadores de ataque solo ×0,8 (el movimiento sigue ×0,62/×0,5) y revisar el rayo (`chainP`) con `bench`. Es condición de publicación (§10.1: ninguna escuela más de 20 puntos por encima de la media).
- **K11 · C4 sin salas normales (§2.6)**: llegas al Señor Supremo a nivel ~11 (hoy el C1 se gana a nivel ~15): con 6500 de vida, el TTK pasa de 30 s. Hay que hacer `bench` con la build real de cada hueco y, si hace falta, experiencia de jefe ×2 en el C4 o una carta tras cada jefe.
- **K12 · Capítulos 2-4 y Héroe (aviso, sin medir)**: el veterano gana el 100 % incluso con un 12 % más de daño por golpe (C2), porque el Santuario y el equipo le dan unos 156 de vida máxima, Disparo gemelo y 2 % de cura por baja (2 × Sed de sangre), y más enemigos = más cura. Los escalones de daño ×1,06^k y vida ×1,12^k de la tabla del §2.2 se quedan cortos para él: H1 = k 3 (daño ×1,19) apunta a «veterano 35-55 %» sin ningún dato detrás. Antes de cerrar el §2.2, medir el C2 y el H1 con `META=veterano`. Las palancas que funcionan con el veterano son las que **no** se curan con bajas: monstruos héroe, jefes ascendidos y menos curas. Sed de sangre a 0,75 / 1,5 % (§4.7) es obligatorio, y además con un tope de 1 % por segundo.
- **Además**: (a) los refuerzos también pueden traer élite y no tienen por qué esperar a que la sala esté a menos del 30 % si hay tótems (que no se mueven): contar solo los enemigos que no son `heavy`; (b) el murciélago héroe no choca con rocas (vuela); (c) para publicar, la validación con personas (§10.6) es lo que manda: el bot no recibe toques cuerpo a cuerpo (0-1 % del daño en todas las variantes) y eso una persona sí los va a recibir.

---

## 0. Decisiones cerradas

| # | Tema | Decisión | Fuente / motivo |
|---|---|---|---|
| D1 | Esqueleto | Base de la propuesta «movil»: `chapters.js` con datos y lógica pura, refactor sin cambio de comportamiento y `CH_FALLBACK` | Ganadora de los 3 jueces |
| D2 | Capítulos al lanzar | **4 Normales y 4 Héroe.** C1 «La Mazmorra» (estándar, 20 salas) · C2 «Catacumbas de Ceniza» (corto, 15) · C3 «Sima Helada» (trampas, 15) · C4 «Prueba de los Archimagos» (solo jefes, 10, con antesala). El C4 se puede recortar del lanzamiento | Variedad de formatos («archero») con un alcance asumible («movil») |
| D3 | Hoja de ruta (no entra en el lanzamiento) | Capítulo de oleadas **sin reloj**, jefes en pareja, Bestiario completo de héroes, reto diario y afijos Sanador/Divisor | Las parejas chocan con `killEnemy` (pone `boss = null` y elimina a todos los vivos) y con la variable única `boss`; las oleadas con reloj fueron lo que más se criticó del capítulo 3 de Archero |
| D4 | Fórmulas por sala | Usan la **sala real** `r` (no se estiran los capítulos cortos a 20). Un capítulo corto es más corto, no más comprimido. La dificultad entre capítulos la marca `k` | Evita esponjas en los capítulos de 15 salas y que el jugador llegue a las salas altas con menos poder |
| D5 | Escalón de capítulo | `c_ef = c` en Normal y `c + 3` en Héroe; `k = c_ef − 1` | Regla madre única. Héroe N tiene exactamente los números del Normal N+3 |
| D6 | Escalado entre capítulos | Sube sobre todo la **amenaza**: densidad, élites, `lv` (+3k), velocidad de bala. La vida enemiga crece ×1,12^k como mucho; el daño ×1,06^k | Corrige la esponja de «movil» (×1,22^k, jefe de H4 por encima de 20.000) |
| D7 | Héroe | Sin segundo multiplicador. Héroe = números de N+3, más monstruos héroe, menos curas, jefes ascendidos con la 2ª fase al 60 % y más trampas y refuerzos | Corrige el doble conteo de «roguelite» |
| D8 | Desbloqueo del Héroe | Se abre al **completar el C2 Normal**. Héroe N exige Normal N completado y Héroe N−1 completado | Evita pasar de golpe del C1 a un H1 equivalente al C4 en la primera sesión (juez 3) |
| D9 | Objetivo del C1 (bot) | ~~Medio 25-35 %, bueno 50-65 %, novato 5-12 %, veterano medio 60-75 %~~ **(corregido, ver K1)** Medio **40-55 %**, bueno 80-92 %, novato 3-10 % (≥ 85 % llega a la s10), veterano sin objetivo en el C1 (≥ 85 %) | Medido: los cuatro objetivos antiguos son incompatibles entre sí con este bot (cuando el medio baja a 38 %, el novato está en 0 % y el bueno en 85 %) y el veterano gana el 90-100 % con cualquier palanca. Con el bot unos 10 puntos optimista, una persona media queda en 30-45 % |
| D10 | Palanca principal | Densidad y amenaza. **No** se toca el daño por golpe del C1 (`dmgMul` sigue en 0,07 por sala), ni la invulnerabilidad (0,7 s), ni la caja de impacto (−4). **(K2)** La densidad solo cuenta si es densidad de **amenaza**: desde la s6 el plantel se pondera para que slimes y murciélagos (que no tocan a nadie que se mueva) dejen sitio a tiradores y embestidores | El bot demostró que el daño ×2 es mala palanca; en móvil la caja y la invulnerabilidad son cuestión de justicia. Medido: `dmgMul` 0,085 baja al medio al 38 % pero deja al novato en 0 % y al veterano en 100 %: no se usa en el C1 |
| D11 | Calibración | **Una palanca cada vez** con el esquivador. El orden de palancas está en §4.10 | Juez 2: si se mezclan, no se sabe qué hizo cada cambio |
| D12 | Curas | Cura de jefe 25 % → 10 %, 1 corazón por jefe, no caen corazones con la vida ≥ 95 %. **(corregido, K3)** Al salir de la sala solo se recogen solas las gemas: los corazones hay que pisarlos (era la palanca de reserva nº 3 y hace falta desde el principio) | Jueces 1 y 2; crítico (medido) |
| D13 | Vida de jefe | Por **sala real** (curva `BOSS_HP`), no por modelo. **(corregido, K3)** C1: **720 / 1725 / 3900 / 7050** (×1,5 sobre hoy) desde la fase 4; `BOSS_HP_PTS` = (5; 720), (10; 1725), (15; 3900), (20; 7050). Tope ×1,5 | Con ×1,3 el dios con formas queda en 4:05; con ×1,5 y refuerzos, 4:25. Sigue sin ser esponja (TTK del dios: 20-28 s) |
| D14 | Fases de jefe | Todos los jefes tienen 2ª fase al 50 % (Héroe 60 %) con su ataque extra. El jefe final de cada capítulo tiene además 3ª fase al 25 % (Héroe 35 %) | Las tres propuestas |
| D15 | Afijos al lanzar | 6: Veloz, Escudado, Volátil, Invocador (C1); Vengador (C2+); Charco (C3+). Parejas prohibidas: Charco+Veloz e Invocador+Vengador | Viabilidad y legibilidad |
| D16 | Monstruos héroe | **Los 9 tipos** desde el lanzamiento (tabla de «archero», con el murciélago corregido) | Con 5 de 9 el Héroe se siente a medias (jueces 1 y 3) |
| D17 | Riesgo/recompensa | **Pacto favorable** si el jefe anterior no te tocó: −15 % de vida máxima y 3 habilidades | «roguelite», sin tocar la economía |
| D18 | Maldiciones, Tributo nuevo, Modo Aprendiz, descuentos | **Fuera.** Sin economía camuflada ni modo fácil | Restricción 1 y jueces |
| D19 | Esencia | Solo por progreso. En `essenceParts`, Salas y Jefes pasan a proporción del capítulo (en el C1 sale idéntico a hoy) × `ESS_MUL[c_ef]`. Héroe N usa el de N+3. Primera vez: +15 por ★★★, una sola vez | Restricción 1. Monotonía (juez 3) |
| D20 | Hitos | 3 estrellas por capítulo **y por modo**: ★ primer tercio, ★★ segundo tercio, ★★★ completar. Cuentan aunque mueras. Fila dorada (Normal) y fila morada (Héroe) aparte | «archero» y juez 3 |
| D21 | Menú | **JUGAR relanza el último capítulo y modo jugados** (un toque). Un botón aparte, «📜 Capítulos ★ n/24», abre el selector | «archero» y juez 3 |
| D22 | `speedrun` | Solo en C1 Normal. **(corregido, K6)** El umbral **se queda en 270 s** (texto «Gana el Capítulo 1 en menos de 4 min 30 s»). 360 s lo regalaría: el medio fresco ya gana en 4:21-4:46 de mediana | El suelo de 5:00 no se alcanza (dios con formas 4:05-4:25 medido); con 270 s el logro sigue siendo de buen jugador con build (veterano: mediana 3:52-4:08) |
| D23 | Tope de balas | No se cortan balas sueltas. Si `bullets.length > 280` **al empezar un ataque**, el enemigo se salta ese ataque entero y reinicia su temporizador. Los anillos nunca salen con huecos | Juez 2: el tope de 320 en `fireBullet` abría huecos aleatorios |
| D24 | Glifos | Los afijos y los monstruos héroe se dibujan en el canvas con glifos de texto (», ⬡, ✶, ✧, ▲, ◌, ♛), no con emoji | Los emoji cambian entre Android |
| D25 | Validación humana | Antes de publicar, **2-3 personas reales** juegan el C1 (§10.6) | Común a las tres propuestas |
| D26 | Texto con Double | La nota de versión dice «4 capítulos y Modo Héroe, más en camino». Hay que decirle por escrito que su reto está en el C3, el C4 y el Héroe | Double es «veterano con formas» y gana hoy el 100 % |

---

## 1. Resumen para Double (lenguaje de jugador)

- **Lo que hoy es el juego pasa a ser el Capítulo 1, y ahora es difícil de verdad.** Hay más bichos a la vez y aparecen más cerca. A partir de la sala 8 llegan **refuerzos** a mitad de pelea. Las élites traen **poderes** (son rápidas, llevan escudo, explotan al morir o invocan murciélagos). Cada jefe tiene **segunda fase** con un ataque nuevo: el Gólem tira rocas, el Rey Slime salta encima de ti, el Brujo crea copias de sí mismo y el Señor hace un barrido láser. El Señor tiene además una tercera fase. Ya no te curas gratis: matar a un jefe cura el 10 % (antes el 25 %).
- **Todo se avisa.** Cada ataque nuevo tiene su señal (círculo, sombra, línea roja o cono) al menos 0,35 s antes. Las balas enemigas pasan a tonos rojos, rosas y naranjas para que no se confundan con tus hechizos. Cuando mueres, el juego te dice qué te mató y cómo esquivarlo.
- **4 capítulos («Capítulos»)**, cada uno con su forma de jugar:
  1. **La Mazmorra**: 20 salas y 4 jefes. Es la de siempre, endurecida.
  2. **Catacumbas de Ceniza**: 15 salas, más cortas e intensas. Los jefes vuelven «ascendidos», con su ataque de segunda fase desde el principio.
  3. **Sima Helada**: 15 salas con el suelo lleno de trampas y tótems desde la primera sala. Hay que mirar dónde pisas.
  4. **Prueba de los Archimagos**: una antesala y después 6 jefes seguidos, con 3 altares por medio. Es el muro de habilidad.
- **Modo Héroe**: se desbloquea al completar el Capítulo 2. El Héroe del capítulo N juega con los números del capítulo N+3. Además, en cada sala 1 o 2 enemigos son **monstruos héroe**: más grandes, con barra morada y corona, y con un ataque robado a su jefe (el slime salta como el Rey, el arquero dispara un abanico de 5…). Los jefes salen ascendidos y te curas menos. Para jugar el Héroe 2 tienes que pasarte antes el Héroe 1.
- **Recompensas sin trampa**: la esencia sigue saliendo solo de avanzar. Los capítulos altos y el Héroe pagan algo más por partida, pero nada de multiplicadores raros. Lo que se colecciona son **estrellas** (llegar a un tercio, a dos tercios y completar), **títulos**, páginas del **Bestiario** y la **corona de Héroe**, que se ve en directo.
- **Para ti** (corregido con datos): con tu nivel (veterano con formas: Santuario y equipo), el Capítulo 1 lo vas a seguir ganando casi siempre (el bot con tu perfil gana el 90-100 % con cualquier ajuste que no hunda a los nuevos). Es la puerta de entrada y tiene que poder pasarla gente nueva. Lo que notarás: más bichos que disparan, refuerzos, jefes con segunda fase y menos curas, y partidas de unos 4 minutos en vez de 3. Tu reto de verdad está en los Capítulos 2-4 y, sobre todo, en el Héroe.
- **Cómo queda medido** (bot que juega como una persona, 40 partidas por fila): un jugador medio pasa de ganar el 95 % a ganar en torno a la mitad (48 % medido) y llega a la sala 15-20 con la vida justa; uno bueno, del 98 % al 88 %; un novato, del 33 % al 5 %, pero casi 9 de cada 10 llegan a la sala 10. El bot invencible tarda unos 4:25 (hoy, 3:33).

---

## 2. Capítulos

### 2.1 Tabla general

| C | Nombre | Formato | Salas | Jefes (sala: modelo «título») | Altares | Cofres | Zonas (bioma · tinte) | k Normal / Héroe | Desbloqueo |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **La Mazmorra** | estándar | 20 | 5 Gólem «Guardián de la pradera» · 10 Rey Slime «Monarca de la cripta» · 15 Brujo «Tirano de la gruta helada» · 20 **Señor de la Mazmorra** «Corazón del volcán» (final, 3 fases) | 4, 9, 14, 19 | desde s2, 20 %, máx. 3 | pradera 1-5 · cripta 6-10 · cristal 11-15 · volcán 16-20 · sin tinte | 0 / 3 | siempre abierto |
| 2 | **Catacumbas de Ceniza** | estándar corto | 15 | 5 Rey Slime asc. «Monarca de ceniza» · 10 Gólem asc. «Guardián enterrado» · 15 **Brujo de Ceniza** «Hereje de las catacumbas» (final, 3 fases) | 4, 9, 14 | desde s2, 20 %, máx. 2 | cripta 1-8 · volcán 9-15 · tinte `#ff6a3d` α 0,12 modo `color` | 1 / 4 | completar C1 Normal |
| 3 | **Sima Helada** | trampas | 15 | 5 Brujo «Aprendiz del frío» (sin ascender) · 10 Rey Slime asc. «Rey de escarcha» · 15 **Gólem Colosal** «Corazón de piedra» (final, 3 fases) | 4, 9, 14 | desde s2, 25 %, máx. 2 | cristal 1-5 · cripta 6-10 · cristal 11-15 · tinte `#7fe0ff` α 0,10 modo `color` | 2 / 5 | completar C2 Normal |
| 4 | **Prueba de los Archimagos** | solo jefes | 10 | 3 Gólem asc. «Primer sello» · 4 Rey asc. «Segundo sello» · 6 Brujo asc. «Tercer sello» · 7 Señor asc. «Cuarto sello» · 9 **Brujo Ascendido** «Archimago» · 10 **Señor Supremo** (final, 3 fases) | 2, 5, 8 | ninguno | volcán 1-10 · tinte `#ff3b3b` α 0,12 modo `color` | 3 / 6 | completar C3 Normal |

«asc.» = ascendido: lleva su ataque extra desde el principio (§5.3). En la 2ª fase gana además la variante fuerte.

### 2.2 Multiplicadores entre capítulos (todos los capítulos y modos)

Se aplican sobre la curva base del §4, con `k = c_ef − 1`:

| Concepto | Fórmula | k=0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|---|
| Vida enemiga | `×1,12^k` | 1 | 1,12 | 1,25 | 1,40 | 1,57 | 1,76 | 1,97 |
| Daño enemigo y de jefe | `×1,06^k` | 1 | 1,06 | 1,12 | 1,19 | 1,26 | 1,34 | 1,42 |
| Velocidad de bala enemiga | `min(1,20; 1,04^k)` | 1 | 1,04 | 1,08 | 1,12 | 1,17 | 1,20 | 1,20 |
| Nivel de enemigo `e.lv` | `r + min(12, 3k)` | r | r+3 | r+6 | r+9 | r+12 | r+12 | r+12 |
| Presupuesto base / por sala | `4,5+0,4k` / `0,75+0,04k` | 4,5/0,75 | 4,9/0,79 | 5,3/0,83 | 5,7/0,87 | 6,1/0,91 | 6,5/0,95 | 6,9/0,99 |
| Máx. enemigos (`maxN`) | `min(16, 14+k)` | 14 | 15 | 16 | 16 | 16 | 16 | 16 |
| Élites p0 / máx. | `0,14+0,02k` / 2 (3 si k≥1, 4 si k≥4) | 0,14/2 | 0,16/3 | 0,18/3 | 0,20/3 | 0,22/4 | 0,24/4 | 0,26/4 |
| 2º afijo | k=0: nunca · k 1-2: 20 % desde s11 · k≥3: 35 % desde s8 | — | 0,2 | 0,2 | 0,35 | 0,35 | 0,35 | 0,35 |
| Vida de jefe | `BOSS_HP(r) × 1,12^k × entry.hpMul` (o `entry.hp` absoluta × `1,12^(c_ef − c)`) | | | | | | | |
| Profundidad de botín | `min(40, r + 3k)` | | | | | | | |
| Esencia `ESS_MUL[c_ef]` | tabla | 1,00 | 1,10 | 1,20 | 1,40 | 1,50 | 1,60 | 1,80 |

`BOSS_HP(r)` es una interpolación logarítmica sobre los puntos (5; 620), (10; 1500), (15; 3400), (20; 6100). Por debajo de 5 se extrapola con la pendiente del primer tramo y el mínimo es 300.
Comprobación de esponjas: el jefe más duro del juego es el Señor del H1 (6100 × 1,40 = **8540**). El Gólem Colosal del H3 queda en 3400 × 1,76 × 1,2 = 7180 y el Señor Supremo del H4 en 6500 × 1,12³ = 9130. Todos por debajo de 10.000 (en «movil» pasaban de 20.000).

### 2.3 Capítulo 1 · LA MAZMORRA

- **Formato**: estándar de 20 salas. Normales 1-3, 6-8, 11-13 y 16-18; altares 4, 9, 14 y 19; jefes 5, 10, 15 y 20.
- **Plantel** (`pool`, mismo orden de claves que `ENEMY_UNLOCK` por determinismo): slime 1, bat 1, archer 2, charger 3, mage 4, bigslime 6, bomber 6, totem 7, spirit 11. Topes: totem 2, spirit 3, bomber 3, bigslime 2, mage 4.
- **Lección por sala** (para el jugador nuevo): s1 slimes y murciélagos (quieto dispara, moverse esquiva) · s2 arquero (línea roja) · s3 embestidor y primeras trampas (pinchos con aviso) · s4 altar · s5 Gólem (anillo, embestida, abanico; en la 2ª fase, rocas: «mira al suelo») · s6 primera élite, slime grande y diablillo · s7 tótem · s8 primer «¡REFUERZOS!» · s11 espectro y Volátil · s13 Invocador.
- **Salas 1-3**: presupuesto ×0,85, aparición a ≥ 280 px y primer ataque lento como hoy. Sin élites ni refuerzos.
- **Élites**: desde la s6, máx. 2, `p = 0,18 + 0,008·r` (corregido K3; antes 0,14). Las tandas de refuerzo también pueden traer élite (mismo `p`, mismo tope de 2 vivas). Afijos: Veloz y Escudado desde la s6, Volátil desde la s11, Invocador desde la s13. Un solo afijo.
- **Refuerzos**: ~~salas 8, 12, 17 y 18~~ **(K3) todas las salas normales desde la s6: 6, 7, 8, 11, 12, 13, 16, 17 y 18.** El rótulo «¡REFUERZOS!» se enseña la primera vez en la s6.
- **Trampas**: desde la s3, en el 60 % de las salas, 2-3 grupos, 55 % del tipo del bioma (como hoy).
- **Jefes**: 5 Gólem **720** · 10 Rey Slime **1725** · 15 Brujo **3900** · 20 Señor **7050** (×1,5, K3). Ataques en §5.2-5.4.
- **Curas**: §4.7 (jefe 10 %, Fuente 50 %).
- **Multiplicadores**: k=0 (todo ×1). Esencia ×1,00.
- **Hitos (★ fila dorada)**: ★ llegar a la s7 → página del Bestiario «La Mazmorra» · ★★ llegar a la s14 → título «Caminante de la Mazmorra» · ★★★ completar → +15 de esencia (una vez) y tinte de túnica «Piedra». Héroe (fila morada): §3.6.
- **Tutorial**: solo aquí y solo en Normal (`tutStart` si `CH.id === 1 && !HEROIC`).
- **Récord**: hereda `arcano.best` y `stats.best[escuela]` 1-21 tal cual.
- **Rótulos**: en la s1 «CAPÍTULO 1 · LA MAZMORRA»; al cambiar de bioma, «ZONA · <nombre del bioma>» (sustituye al «CAPÍTULO n» que hoy sale cada 5 salas). Se borra el texto muerto «Se oye algo enorme…», que nunca se ve porque la sala 19 es un altar.

### 2.4 Capítulo 2 · CATACUMBAS DE CENIZA (k=1)

- **Formato**: estándar corto de 15 salas. Normales 1-3, 6-8 y 11-13; altares 4, 9 y 14; jefes 5, 10 y 15.
- **Zonas**: cripta 1-8, volcán 9-15. Tinte de ceniza `#ff6a3d` α 0,12. `enemyTint`: slime `#59b4ff`, archer `#e0a050` (que no se pierdan en el fondo).
- **Plantel** (contenido nuevo, orden libre): slime 1, bat 1, archer 1, charger 2, mage 2, bomber 3, bigslime 4, totem 5, spirit 7. Todo llega antes.
- **Élites**: desde la s3, máx. 3, `p = 0,16 + 0,008·r`. Afijos: los 4 del C1 (Volátil desde la s6, Invocador desde la s7) más **Vengador** desde la s6. 2º afijo al 20 % desde la s11.
- **Refuerzos**: salas 6, 8, 12 y 13.
- **Trampas**: desde la s2, en el 70 % de las salas, 2-3 grupos.
- **Jefes** (`BOSS_HP(r)` × 1,12): s5 Rey Slime ascendido (Salto desde el principio) **695** · s10 Gólem ascendido (Rocas desde el principio; en la 2ª fase, 5 rocas) **1680** · s15 Brujo de Ceniza (modelo brujo, tier 4, color `#ff6a3d`, Espejismo desde el principio y espiral de 4 brazos; 3ª fase) **3810**.
- **Curas**: jefe 10 %, Fuente 45 %, cofre 10 %.
- **Esencia** ×1,10. **Botín**: profundidad `r + 3`.
- **Hitos**: ★ s5 → Bestiario «Catacumbas» · ★★ s10 → título «Caminante de Ceniza» · ★★★ completar → +15 y tinte «Ceniza». Completarlo **desbloquea el C3 y el Modo Héroe**.
- **Despertar**: `need [85, 135]`, redes {a:1, b:1, c:2}, `markRoom` 5.

### 2.5 Capítulo 3 · SIMA HELADA (k=2) · formato trampas

- **Formato**: 15 salas con la misma rejilla que el C2. **Trampas en el 100 % de las salas normales desde la s1**, 2-4 grupos, 70 % del tipo del bioma (hielo en cristal). Las arenas de jefe llevan 1,5× grupos. Presupuesto de enemigos ×0,85 (menos bichos, más suelo).
- **Zonas**: cristal 1-5, cripta 6-10, cristal 11-15. Tinte `#7fe0ff` α 0,10. `enemyTint`: spirit `#e3c8ff`, bat `#b48cff`.
- **Plantel**: slime 1, bat 1, archer 1, **totem 1**, charger 2, mage 3, spirit 5, bomber 6, bigslime 8. Identidad: tótems fijos sobre hielo que resbala, entre cruces de balas.
- **Élites**: desde la s3, máx. 3, `p = 0,18 + 0,008·r`. Afijos: los 5 anteriores más **Charco** desde la s4. 2º afijo al 20 % desde la s11.
- **Refuerzos**: salas 7, 8, 12 y 13.
- **Jefes** (× 1,25): s5 Brujo «Aprendiz del frío» (espiral de 3 brazos, sin teletransporte doble; Espejismo solo en la 2ª fase) **780** · s10 Rey Slime ascendido **1880** · s15 **Gólem Colosal** (modelo gólem, r 48, `hpMul` 1,2, Rocas ×5 desde el principio, embestida doble con anillo al chocar; 3ª fase: lluvia de rocas cada 0,5 s durante 3 s) **5100**.
- **Curas**: jefe 10 %, Fuente 45 %, cofre 10 %.
- **Esencia** ×1,20. **Botín** `r + 6`.
- **Control**: las trampas deben hacer entre el 20 y el 35 % del daño. Si pasan del 35 %, se baja `hazard.n` a [2, 3].
- **Hitos**: ★ s5 → Bestiario «Sima» · ★★ s10 → título «Pies de Hielo» · ★★★ → +15 y tinte «Escarcha».
- **Despertar**: `need [80, 125]`, redes {a:1, b:1, c:2}, `markRoom` 5.

### 2.6 Capítulo 4 · PRUEBA DE LOS ARCHIMAGOS (k=3) · solo jefes · recortable

- **Formato**: 10 salas: 1 antesala · 2 altar · 3 jefe · 4 jefe · 5 altar · 6 jefe · 7 jefe · 8 altar · 9 jefe · 10 jefe final. Los altares van en una lista explícita (`altars: [2, 5, 8]`), no son «la sala antes del jefe».
- **Antesala (s1)**: plantel completo del C1 con `lv` +9, presupuesto ×1,3, **2 élites garantizadas** y refuerzo. Sirve para que el primer jefe no te pille a nivel 1. Sin cofre.
- **Bioma**: volcán entero, tinte `#ff3b3b` α 0,12 («Sanctasanctórum»). Música: pista `boss` desde la s3 (en el selector de escuela suena la del menú).
- **Jefes con vida absoluta** (calibrada para el nivel con que llegas): s3 Gólem asc. 450 (tier 1) · s4 Rey asc. 800 (tier 2) · s6 Brujo asc. 1500 (tier 3) · s7 Señor asc. 2600 (tier 4, sin 3ª fase) · s9 Brujo Ascendido «Archimago» 4000 (tier 4, espiral de 5 brazos) · s10 **Señor Supremo** 6500 (tier 4, los 7 patrones, 2ª fase al 50 % y 3ª al 25 %). Los valores absolutos no llevan `1,12^k`; en Héroe se multiplican por `1,12^3`. TTK esperado con build real: 15-22 s por jefe.
- **(K11) Nivel con el que llegas**: sin salas normales, la experiencia sale casi toda de los jefes (`xp = 25 + 10·tier`, 35-65) y de la antesala (~20): ~350 de experiencia en total, nivel ~11 en el Señor Supremo frente al ~15 con que se gana hoy el C1. Con 6500 de vida y la build de nivel 11, el TTK pasa de los 30 s. Antes de fijar las vidas: `bench` del C4 con la build real de cada hueco y, si hace falta, experiencia de jefe ×2 en el C4 (no es economía: no da esencia) o una carta de habilidad tras cada jefe, como el formato de jefes de Archero.
- **Altares**: los de siempre (Fuente 45 %, Bendición y Pacto, con Pacto favorable si el jefe anterior no te tocó). Es la «elección de cura» del formato: no hay cura gratis entre jefes salvo el 10 % del propio jefe.
- **Curas**: jefe 10 %, Fuente 45 %, sin cofres.
- **Esencia** ×1,40. **Botín** `r + 9`, y además 1 objeto por cada 2 jefes al final (por la fórmula de siempre: `1 + min(2, jefes) + victoria`).
- **Despertar**: `need [80, 110]`, redes {a:1, b:2, c:4}, `markRoom` 4. La oferta llega en la sala limpia tras el jefe, como siempre.
- **Hitos**: ★ s4 → Bestiario «Archimagos» · ★★ s7 → título «Archimago Supremo» · ★★★ → +15 y marco dorado en el selector.

### 2.7 Datos de cada capítulo (`CHAPTERS`, en `chapters.js`)

```js
{ id, name, short, len, format: 'std'|'traps'|'bosses',
  zones: [['pradera',5],['cripta',5],...],          // suma = len
  tint: {color, a, mode} | null, enemyTint: {kind: color} | null,
  bosses: { sala: {id, tier, hpMul?, hp?, title, ascended, final, arms?, rocks?, r?, color?} },
  altars: [..],                                       // lista explícita
  pool: {kind: salaDesde}, caps: {kind: n},
  budgetMul: 1, budgetEarly: 0.85, antesala?: {budgetMul:1.3, elites:2, lvAdd:9},
  waves: [salas], spawnDist: [280, 220],              // [salas 1-3, resto]
  elite: {from, max?, pr: 0.008, affixes: {id: salaDesde}},
  hazard: {from, chance, n:[a,b], special, arenaK},
  chest: {from, p, max}, heal: {boss, altar, chest, heart, bossHearts},
  anima: [n1,n2] | null, nets: {a,b,c}, markRoom,
  stars: [s1, s2], title2, tint3, speedrun: 360|null, unlock: chapterId|null,
  music: {key: 0} }
```

Herencia: cada capítulo es `deepMerge(CH1, overrides)` (copia los objetos internos). `CHAPTERS[0]` reproduce **bit a bit** el juego de hoy hasta la fase 4 (§9.5). Los datos de dificultad nuevos del C1 se activan con `CH1_V11` en la fase 4.

---

## 3. Modo Héroe

### 3.1 Acceso

- El interruptor **NORMAL | HÉROE** aparece en el selector al completar el C2 Normal. Antes se ve gris, con 🔒 y el texto «Completa el Capítulo 2».
- Héroe N exige Normal N completado **y** Héroe N−1 completado (para Héroe 1, solo Normal 1). Hay que volver a subir desde el 1.
- La primera vez que se desbloquea, la pantalla final muestra «¡MODO HÉROE DESBLOQUEADO!» en violeta y el selector, un aviso de 3 líneas bajo el interruptor: «Héroe: enemigos con ataques de jefe, menos curas y jefes ascendidos. Paga como un capítulo más alto.»
- `settings.chapter = {id, hero}` guarda qué estás jugando en este dispositivo; `meta.prog.h` guarda los héroes completados (se sincroniza con la cookie).

### 3.2 Qué cambia exactamente (capa `HERO`, aplicada por los accesores; nada se duplica)

1. **Números**: `c_ef = c + 3`, así que se aplica la tabla del §2.2 con k = c+2. Es la única fuente de vida, daño, velocidad de bala, `lv`, presupuesto, élites, botín y esencia. **No hay ningún otro multiplicador de vida ni de daño.**
2. **Jefes**: todos ascendidos (extra desde el principio); 2ª fase al **60 %**; el final de cada capítulo tiene 3ª fase al **35 %**. Su vida sale de la tabla con k (o del valor absoluto × 1,12³ en el C4).
3. **Monstruos héroe**: §3.3.
4. **Élites**: los afijos del capítulo, con el 2º afijo según k (35 % desde la s8 con k≥3).
5. **Curas**: jefe +5 % con 1 corazón; corazón normal 2 % y de élite 10 % (la mitad); Fuente −10 puntos (C1 40 %, C2-C4 35 %); cofre 10 %. La Poción, la Vitalidad y Drenar vida no cambian (son curas elegidas).
6. **Trampas**: probabilidad +0,2 (tope 1,0) y +1 grupo.
7. **Refuerzos**: las salas del capítulo y 2 más (C1: 7 y 16; C2 y C3: 7 y 11; C4: la antesala, siempre).
8. **Estética**: tinte violeta `#c77dff` α 0,08 sobre el del capítulo, corona ♛ en el HUD, tarjeta con borde violeta y rótulo de la s1 «CAPÍTULO 2 · HÉROE».
9. **No cambia**: la Afinidad, el Eclipse, las Mezclas, el equipo ni las cartas. El tutorial queda apagado.

### 3.3 Monstruos héroe

- **Cuántos**: en cada sala normal desde la 2 (y en la antesala del C4), `1 + (r > len/2 ? 1 : 0)` enemigos. Se eligen **después** de asignar las élites y entre los que no lo son (un héroe nunca es élite). Nunca son esbirros (`minion`).
- **Estadísticas** (`makeHero(e)`): vida ×3, daño ×1,3, radio ×1,3 (en tierra, tope de 19 para caber por los pasillos), `vscale` ×1,35, **sin empujón**, XP ×3, Ánima +6 (como una élite), maná +10, corazón al morir con un 25 % de probabilidad.
- **Visual**: aura `glow` violeta **`#8a3cff`** α 0,4 (corregido K9: `#c77dff` es exactamente el color de la escuela Arcano, la del Arcanista), anillo violeta oscuro con borde blanco de 1 px bajo el cuerpo, barra de vida **morada de 40 px** encima (corregido: hoy TODOS los enemigos llevan barra de ≥ 28 px en `drawEnemy`, roja, o dorada si es élite; la del héroe tiene que ser más ancha y de otro color), corona ♛ sobre la barra y rótulo «HÉROE» flotando 1 s al aparecer. La corona parpadea 0,4 s antes de cada ataque prestado.
- **Primera vez**: toast «MONSTRUO HÉROE · Más grande, más duro y con un ataque de jefe» (`settings.seenAfx.hero`).

| Enemigo | Ataque prestado (de quién) | Detalle | Aviso (≥ 0,35 s) |
|---|---|---|---|
| Slime | **Salto** (Rey) | Cada 3 s salta hacia ti; al caer, anillo de 6 balas a 150 px/s | Sombra elíptica creciente de 0,5 s donde va a caer |
| Murciélago | **Embestida** (Gólem) | Cada 3 s carga 0,6 s y embiste a 420 px/s durante 0,45 s; si choca con un muro, 4 balas en cruz (corregido: el murciélago vuela, `ground: false`, y `collideRocks` no se le aplica; las rocas no lo paran). **No suelta nada al tocarte** (corregido de «roguelite») | Carril rojo de 0,6 s |
| Arquero | **Abanico** (`aimed` del jefe) | 5 balas a ±0,17 rad en lugar de 1-3 | Línea roja y cono rojo de 0,35 s |
| Embestidor | **Doble embestida** (`sub` del jefe) | 2 cargas seguidas con 0,55 s entre ellas | Carril rojo antes de cada carga |
| Cultista | **Anillo doble** (Brujo) | 2 anillos desfasados medio paso, con 0,4 s entre ellos; el hueco siempre existe porque `n` es par | Pulso circular de 0,4 s |
| Slime grande | **Escisión** (Rey) | Se divide en **3** slimes con `lv + 4` | Ya es visible (tamaño); sin aviso extra |
| Diablillo | **Mecha corta + lava** | Mecha de 0,55 s (aviso ≥ 0,35 s) y al explotar deja un charco de lava r 60 durante 2,5 s (`hz` temporal) | Círculo de mecha que se llena |
| Tótem | **Espiral** (Brujo) | Además de su cruz, espiral de 2 brazos durante 1,5 s cada 4 s | El tótem brilla 0,4 s antes |
| Espectro | **Teletransporte doble** (Señor) | Reaparece 2 veces seguidas (la 2ª a 0,8 s) y dispara en cada una | Marcador punteado de 0,4 s donde va a salir |

Todos reutilizan estados que ya existen (`wind`/`dash` del embestidor, `spiral`, `tpOut`/`tpIn`, `aimed`) mediante `e.move = HERO_MOVES[kind]`. Si se recorta algo, el orden para dejarlo después es tótem → diablillo → slime grande → espectro (mientras tanto, solo estadísticas y afijo Veloz). **Objetivo de lanzamiento: los 9.**

### 3.4 Números de Héroe

| Héroe | c_ef / k | Vida enemiga | Daño | Balas | `lv` | Jefe final |
|---|---|---|---|---|---|---|
| H1 (La Mazmorra) | 4 / 3 | ×1,40 | ×1,19 | ×1,12 | r+9 | Señor 8540 |
| H2 (Catacumbas) | 5 / 4 | ×1,57 | ×1,26 | ×1,17 | r+12 | Brujo de Ceniza 5340 |
| H3 (Sima) | 6 / 5 | ×1,76 | ×1,34 | ×1,20 | r+12 | Gólem Colosal 7180 |
| H4 (Archimagos) | 7 / 6 | ×1,97 (antesala) | ×1,42 | ×1,20 | r+12 | Señor Supremo 9130 |

### 3.5 Jefes en Héroe

- Ascendidos siempre: el extra entra en `pats` desde la creación.
- La 2ª fase (al 60 %) aplica la **variante fuerte** del extra (§5.3), +4 balas por anillo y pausa ×0,7.
- El final de capítulo tiene 3ª fase al 35 %.
- Las invocaciones de la 2ª fase traen 1 élite con afijo del capítulo.

### 3.6 Recompensas de Héroe (sin inflar)

- **Esencia**: la de `ESS_MUL[c+3]` (H1 ×1,40, H2 ×1,50, H3 ×1,60, H4 ×1,80). Sin bonus por partida.
- **Estrellas moradas** (primera vez, cuentan aunque mueras): ★ primer tercio → página «Héroes» del Bestiario (el monstruo héroe del capítulo con su ataque) · ★★ segundo tercio → título · ★★★ completar → +15 de esencia y la insignia **«H{n} ★»** junto al récord y en la pantalla final.
- **Títulos**: H1 «Cazador de Héroes», H2 «Verdugo de Ceniza», H3 «Corazón de Escarcha», H4 «Leyenda de Arcano».
- **Corona dorada** cosmética en el sombrero, visible en todas las formas: al completar el H2.
- **Logros**: `heroe1` «Héroe» (25, completa cualquier capítulo en Héroe) y `heroeTodo` «Leyenda» (50, los 4).

---

## 4. Curva base dentro del capítulo

Se aplica a todos los capítulos; los números son los del C1 (k=0). Va en un cambio aparte del refactor (fase 4). En cada punto se indica la función de `game.js`.

### 4.1 Escalado por sala

- `makeEnemy` (`hm`): `1 + 0,2(r−1) + 0,006(r−1)²` **sin cambios** × `1,12^k`. Sin esponjas.
- `dmgMul` (línea 400): `(1 + 0,07(r−1)) × 1,06^k`. En el C1 queda **igual que hoy** (31 de daño por golpe en la s20; 3,5 golpes para morir).
- `e.lv = r + min(12, 3k)`. En `updateEnemy` **todas** las ramas que hoy leen `room` pasan a leer `e.lv` (líneas ~1839-1841, 1873-1874, 1897-1900 y 1925; búscalas por `room` dentro de `updateEnemy`). Los umbrales no cambian (arquero triple desde lv 9, número de balas del cultista, 6 brazos y ritmo del tótem, 5 balas del espectro).
- `makeEnemy` deja de llamar a `ArcanoBiomes.forRoom` (línea 1701) y toma el tinte de `biomeAt(CH, room)` + `CH.enemyTint`.

### 4.2 Densidad: `roomEnemies(n)` → `Chapters().budget(CH, hero, n)`

- Presupuesto: `(4,5 + 0,4k) + (0,75 + 0,04k)·n`, ×0,85 en las salas 1-3 y × `CH.budgetMul` (C3 0,85; antesala del C4 1,3). Hoy es `3,5 + 0,55n`.
- **(K2) Plantel ponderado desde la s6**: si `pick(pool)` saca slime o murciélago, con probabilidad 0,65 se cambia por `pick` entre el resto del plantel (tiradores, embestidores, cultistas, tótems, espectros, diablillos). Medido: slimes y murciélagos son 2 de 9 tipos, los más baratos (los que más salen) y hacen el 0-1 % del daño; sin esto la densidad nueva es experiencia regalada, no amenaza (C1 medio 60 % → 48 % solo con este cambio). Gasta 1-2 `Math.random` más por enemigo: va en la fase 4, nunca en la 1.
- `maxN`: 11 → `min(16, 14 + k)`. Topes por tipo: totem 2, spirit 3, bomber 3, bigslime 2 y **mage 4** (nuevo); con k≥3, totem 3 y spirit 4.
- El coste por tipo no cambia. El bucle (`pick(pool)`) es el mismo, así que el C1 refactorizado gasta las mismas llamadas a `Math.random` hasta la fase 4.

| Sala C1 | Presupuesto hoy → nuevo | Enemigos aprox. |
|---|---|---|
| 1 | 4,05 → 4,46 | 4 → 4-5 |
| 3 | 5,15 → 5,74 | 3,7 → 5 |
| 8 | 7,9 → 10,5 | 4,9 → 7 |
| 13 | 10,65 → 14,25 | 6,2 → 8-9 |
| 18 | 13,4 → 18,0 | 8 → 11 |

### 4.3 Aparición y primer ataque

- `spawnRoom`: distancia mínima de aparición 300 → `CH.spawnDist` (280 en las salas 1-3, 220 en el resto). Las filas candidatas siguen siendo `r < 15`. Escalón entre apariciones `i·0,05` → `i·0,04`.
- `makeEnemy`: `timer: rand(0,6; 1,6)` → `r ≤ 3 ? rand(0,6; 1,6) : rand(0,35; 1,0) − 0,03k` (mínimo 0,25). Sigue siendo **una** llamada a `rand`. `spawnT` 0,75 se queda: es el aviso de aparición.

### 4.4 Velocidades y cadencias (`updateEnemy`, con `bm = bulletMul(CH, hero)`)

| Enemigo | Hoy | Nuevo |
|---|---|---|
| Arquero | bala `290 + 4·room`, pausa `rand(1,1; 1,9)` | `(295 + 5·lv)·bm`, pausa `rand(0,9; 1,6)` |
| Cultista | `165 + 3·room`, ciclo `rand(2,4; 3,4)` | `(175 + 4·lv)·bm`, ciclo `rand(2,0; 3,0)` |
| Tótem | `150 + 3·room`, ritmo 1,3 / 0,95 s | `(160 + 4·lv)·bm`, ritmo 1,15 / 0,9 s |
| Espectro | 210, reaparece sin aviso | `(220 + 2·lv)·bm`, el destino se elige al empezar `out` y se marca 0,4 s antes |
| Slime / slime grande | 78 / 52 | 90 / 62 |
| Murciélago | 112, zigzag amplio | 122 y zigzag ×0,75 (va más recto) |
| Embestidor | dash 500, descanso 0,6 s | dash 540, descanso 0,45 s |
| Diablillo | 100, mecha 0,8 s | 112, mecha 0,8 s (igual) |

Ataque de jefe (`bossRing`): `175 + 12·tier` → `(185 + 12·tier)·bm`.
Tope de balas (D23): al empezar cualquier ataque enemigo o de jefe, si `bullets.length > 280`, se salta el ataque y el temporizador se reinicia.

### 4.5 Refuerzos (código nuevo pequeño; no toca el ciclo de sala limpia)

- `spawnRoom`: si `CH.waves` (o `HERO.extraWaves`) incluye la sala, la lista de `roomEnemies` se parte en 60/40. El 60 % aparece normal y el 40 % queda en `waveQ` (global nueva). Se guarda `wave1N` = número inicial sin esbirros.
- `update` (línea 2862), **antes** de `if (!cleared && enemies.length === 0) onCleared()`:
  `if (!cleared && waveQ.length && enemies.filter(e => !e.dead && !e.minion).length <= Math.ceil(wave1N * 0.3)) spawnWave();`
- `spawnWave()`: coloca la tanda a ≥ 220 px del jugador en filas `< 12`, con el anillo de aparición de 0,75 s (`spawnT`) y círculos violetas en el suelo durante ese tiempo. Rótulo `banner` «¡REFUERZOS!» `#ff8a5a` 1,2 s y `Sfx.boss()` corto. La primera vez, toast «Refuerzos: no te confíes al quedar pocos».
- Como la sala nunca pasa a `cleared` entre tandas, las gemas, el maná, la intensidad de la música y `roomReactA` siguen funcionando como hoy. `nextRoom` vacía `waveQ = []`.
- C1: salas 8, 12, 17 y 18 (+16 s por partida).

### 4.6 Penalizaciones por proyectil y poder del jugador

- `fireVolley` (1607): Proyectil extra `0,88ⁿ` → `0,85ⁿ`; Eco `0,9ⁿ` → `0,87ⁿ`. Textos de `SKILLS`: «−15 % daño cada uno» y «−13 % daño».
- `shotHit`: Salto arcano −25 % de daño por salto (`ar.dmg *= 0.75` al saltar); Lanza de éter −25 % por enemigo atravesado. Textos: «…saltan a 2 enemigos más (−25 % por salto)» y «…atraviesan 1 enemigo más (−25 % por enemigo)».
- `updateShots`, rama del muro (línea 2397): Rebote −40 % de daño por rebote y **no** se llama a `ar.hit.clear()` (ya no vuelve a pegar al mismo enemigo).
- `shotHit` (línea 2311), empujón: el impulso de 80 pasa a `80 × e.kbMul`, con `kbMul` = 0,6 por defecto y **0** para élites, monstruos héroe, embestidores y `heavy`. Así el cuerpo a cuerpo llega a tocarte.
- `damageEnemy`: maná por daño a jefe 90 → 45 (menos definitivos que borran la pelea).
- `recalc` (1496): tope de esquiva 0,6 → **0,45**.
- `hurtPlayer`: invulnerabilidad 0,7 s **sin cambio**; caja de impacto `b.r + player.r − 4` **sin cambio** (palanca de reserva, §4.10).
- Poder, Celeridad y Concentración **no cambian**: el jugador tiene que notar que mejora.

### 4.7 Curas (objetivo: cura efectiva / daño ≤ 0,7; hoy 1,1)

| Fuente | Hoy | C1 | C2-C4 | Héroe | Función |
|---|---|---|---|---|---|
| Matar jefe | 25 % | **10 %** | 10 % | 5 % | `onCleared` |
| Corazones de jefe | 2 | **1** | 1 | 1 | `killEnemy` |
| Prob. de corazón normal / élite | 6 % / 30 % | **4 % / 20 %** | 4 / 20 | 2 / 10 | `killEnemy` |
| No cae corazón si `hp ≥ 95 %` | no | **sí** | sí | sí | `killEnemy` |
| Valor del corazón | 15 % | **12 %** | 12 % | 12 % | `collectDrop` |
| Recogida automática al salir | todo | todo (se mantiene) | ídem | ídem | `nextRoom` |
| Cofre | 15 % | **10 %** | 10 % | 10 % | `openChest` |
| Fuente del altar | 60 % | **50 %** | 45 % | −10 p. | `openAltar` / `pickAltar` (texto desde el dato) |
| Poción (carta) | 40 %, peso 1,4, `< 75 %` | **35 %, peso 1,0, `< 60 %`** | ídem | ídem | `SKILLS.heal` |
| Drenar vida | 2 % por nivel | **1,5 %** | ídem | ídem | `killEnemy` + texto |
| Égida nv. 2 (`roomShield`) | 10 % | **6 %** | ídem | ídem | `onCleared` |
| Sed de sangre (equipo) | 1 / 2 % | 0,75 / 1,5 % | ídem | ídem | `equipment.js` |

### 4.8 Avisos que faltan (van **antes** que la densidad, en la fase 3)

- Abanico apuntado del jefe (`bossNext`): `timer` 0,25 → **0,35 s**, con un cono rojo translúcido de ±0,34 rad hacia el jugador.
- Anillo del jefe: en `state === 'ring'` con `sub === 0`, pulso circular `r+10 → r+40` en 0,3 s (rgba 255,60,60,.35).
- Teletransporte del jefe y reaparición del espectro: el destino se elige al **empezar** `tpOut`/`out` (`b.tpX/tpY`, `e.tpX/tpY`) y se dibuja un marcador punteado 0,4 s antes de que aparezca.
- Rocas, salto, espejismo y juicio: §5.3.
- **Balas enemigas en la familia rojo-rosa-magenta (corregido K9: NADA de naranja)**: la escuela de Fuego dispara `#ff8a3d`, la lava es `#ff8a3d`/`#ff7a1a` y el volcán (s16-20, donde más se muere) tiene acento `#ff8f45`; balas naranjas ahí se pierden o se confunden con tus hechizos. Arquero `#ffcf4a` → `#ff6b8a`; tótem `#c9a8ff` → `#ff8ad1`; espectro `#bfe9ff` → `#ffb3c8`; cultista `#ff6f9c` (se queda). `bcolor` de los jefes: Gólem `#ffb347` → `#ff4d6d`, Rey `#b6ff6b` → `#ff5a7a`, Brujo `#c58bff` → `#ff5aa0`, Señor `#ff6a3d` → `#ff2e63`. Volátil: balas `#ff3b6b`. Todas con contorno oscuro de 2 px y núcleo claro (los hechizos del jugador no llevan contorno oscuro). Prueba de escala de grises del §10.5 obligatoria con la escuela de Fuego en el volcán.
- **Origen del golpe**: `fireBullet(x, y, a, sp, dmg, color, r, src)` guarda `b.src` y `updateBullets` llama a `hurtPlayer(b.dmg, b.src)`. Fuentes: `archer, mage, totem, spirit, boss:ring, boss:aimed, boss:spiral, boss:charge, boss:rocks, boss:slam, boss:mirror, boss:sweep, contact, bomb, trap:spikes, trap:lava, volatile, hero:<kind>`. En `hurtPlayer`, la comprobación `src === 'trap'` pasa a `String(src).startsWith('trap')`. Se guarda `lastHit = {src, room}`.

### 4.9 Previsión del C1 (perfil medio, fresco y con formas)

| Sala | Golpes hoy → previstos | Notas |
|---|---|---|
| Salas normales (12) | ~~0,06 → 0,35-0,45 por sala~~ **medido: 0,10 → 0,16-0,18** | Ni la densidad ni los refuerzos en 9 salas lo suben: el jugador mata durante la aparición y el primer ataque. No es un objetivo alcanzable con el bot (K2) |
| Jefes 5/10/15 | 0,3-0,4 → **medido 0,6 / 0,75 / 1,45** | Con la aproximación de la fase 5 (variante D del bloque K) |
| Sala 20 | 1,3 → **medido 1,9** | |
| **Total** | **3,6 → medido 6,4** (no 8,5-10) | Daño 163, curas 103 (ratio 0,63) |

Tiempo del dios con formas: ~~5:00-5:40~~ **medido 4:05 (solo fase 4) y 4:25 (con jefes ×1,5 y refuerzos en 9 salas)**; hoy 3:33. Las salas normales del dios duran 12-16 s y los jefes 20-28 s: no se llega a 5:00 sin esponjas, y no hace falta (K6).

### 4.10 Orden de palancas para calibrar el C1 (una cada vez; 40 partidas del esquivador por paso)

**(Corregido K3)** Las palancas 1-3 antiguas (más refuerzos, élites +0,04, corazones sin recogida automática) y la vida de jefe ×1,5 ya forman parte de la base: aun con todas, el medio gana el 60 % si el plantel no se pondera (K2).
Si el medio gana **más** del 55 %: 1) Fuente del altar 50 → 45 % (y medirla con `ALTAR=auto`, K8) → 2) élites máx. 3 desde la s11 → 3) daño de los **jefes** 15 y 20 ×1,1 (solo `makeBoss`; los golpes normales no cambian) → 4) caja de impacto −4 → −5. `dmgMul` general 0,085 queda descartado (medido: medio 38 %, novato 0 %, bueno 85 %, veterano 100 %).
Si gana **menos** del 40 %, o el novato llega a la s10 en menos del 80 % de las partidas, o muere antes de la s6 en más del 15 %: deshacer en orden inverso; después, refuerzos solo en 8, 12, 13, 17 y 18; después, presupuesto de las salas 1-5 ×0,85.
Tiempo: no hay objetivo de 5:00 (K6). Si el dios con formas baja de 4:00 de mediana, se revisa el DPS del jugador (Disparo gemelo, Eco), no la vida de los jefes (tope ×1,5).

---

## 5. Élites con afijos y fases de jefe

### 5.1 Afijos de élite

`makeElite(e, affixes)`: vida ×2,0 (hoy 2,2: el afijo ya es la amenaza), daño ×1,25, XP ×2, sin empujón, corazón 20 %, Ánima +6, cuenta para `elites`. Visual común: aura del color del afijo bajo el cuerpo, glifo de 14 px sobre la cabeza y su nombre flotando 2 s al aparecer. La **primera vez** que sale cada afijo: toast de 3 s con nombre y consejo (`settings.seenAfx[id]`). Los afijos se eligen con `pick` entre los permitidos en esa sala del capítulo: **una sola llamada a `Math.random` por élite y por afijo, y solo existe a partir de la fase 5**.

| Afijo (ES) | Efecto | Visual | Aviso de primera vez | Capítulo mínimo |
|---|---|---|---|---|
| **VELOZ** | Velocidad ×1,35 y temporizadores ×0,7 (`e.hasteK` multiplica el `ds` de su rama) | Aura dorada de élite (la de hoy) y glifo «»» **en blanco**, estela de 3 copias tenues (corregido K9: `#ffe45c` es el color exacto del Rayo y casi el dorado de élite `#ffcf4a`) | «ÉLITE VELOZ · Se mueve y ataca más rápido» | C1 s6 |
| **ESCUDADO** | Escudo = 30 % de su vida máxima que se gasta antes que la vida (`e.shield`). Mientras dura, no sufre reacciones. Al romperse: 0,3 s aturdido, estallido de esquirlas y «¡ESCUDO ROTO!» | Aura plata `#dfe6f0`, glifo «⬡», anillo hexagonal que se agrieta | «ÉLITE ESCUDADO · Rompe su escudo y quedará aturdido» | C1 s6 |
| **VOLÁTIL** | Al morir, círculo de aviso de 0,6 s (r 90) y luego 8 balas lentas (140 px/s) en estrella (`src: 'volatile'`) | Aura naranja `#ff8a3d`, glifo «✶», parpadea por debajo del 30 % | «ÉLITE VOLÁTIL · No te quedes donde muere» | C1 s11 |
| **INVOCADOR** | Cada 6 s invoca 2 murciélagos (máx. 4 vivos suyos, `minion`, XP 1); reutiliza la rama `summon` del jefe | Aura dorada de élite y glifo «✧» **en blanco** (corregido K9: `#b06bff` es el color del charco venenoso y casi el del Arcano), círculo de invocación de 0,5 s | «ÉLITE INVOCADOR · Mátalo antes de que llame a más» | C1 s13 |
| **VENGADOR** | +15 % de tamaño visual y de daño por cada aliado que muere en la sala (tope +45 %) | Aura roja `#ff3b3b`, glifo «▲», crece a saltos con un pulso | «ÉLITE VENGADOR · Se enfurece con cada baja: mátalo primero» | C2 s6 |
| **CHARCO** | Cada 0,5 s deja un charco del tipo del bioma (r 30, 3 s, máx. 10 vivos; `hz` temporal) que hace `6·dmgMul` cada 0,6 s como trampa | Aura dorada de élite y glifo «◌» en blanco; el charco, del color de `HZ_INFO` del bioma con borde blanco discontinuo (en el volcán la lava es del color del Fuego) | «ÉLITE CHARCO · Deja rastro: no lo persigas» | C3 s4 |

- **Parejas prohibidas** (cuando hay 2 afijos): Charco+Veloz, Invocador+Vengador y dos iguales.
- **Descartados por frustrantes en móvil**: reflejo, cárcel, invisibilidad, atracción y teletransporte en tipos que ya se teletransportan.
- **Hoja de ruta**: Sanador (cura a sus aliados un 4 %/s a ≤ 120 px) y Divisor (al morir, 2 copias al 35 %).

### 5.2 Fases de jefe (`updateBoss`; sustituyen a la «furia» actual)

- **2ª fase**: cuando `hp < maxHp · phase2At` (0,5 en Normal, 0,6 en Héroe). Durante **0,6 s** el jefe es invulnerable (`b.phaseT`; `damageEnemy` no resta vida), **no** se vacía `bullets` (corregido K5: vaciar las balas y 1 s de pausa regalan un respiro en cada fase; medido con la aproximación, la fase 5 entera no subió nada la dificultad), sale el rótulo «¡SEGUNDA FASE!» `#ff5a5a` con temblor 8 y `Sfx.boss`, y se anula la congelación (`frozen = 0`, `slow = 0`, `frzImm = 2 s`) para que el hielo no se salte la fase. Después: si no la tenía, `b.pats.unshift(extra)`; `ringN += 4`; pausa ×0,7; el extra pasa a su variante fuerte.
- **3ª fase** (solo `final`): al 25 % (Héroe 35 %). La misma transición, con el rótulo «¡ÚLTIMO ALIENTO!». Pausa ×0,7 sobre la anterior (×0,49 en total), `ringN += 4` y 2 murciélagos con cada teletransporte o invocación (tope de 4 esbirros).
- **Pausa** (`bossIdle`): `(rand(0,8; 1,3) − 0,1·tier) × 0,7^fase`. Hoy es `rand(0,9; 1,5) − 0,1·tier`, ×0,7 en furia.
- **Daño**: `14 · dmgMul()` sin cambios por fase. Lo que sube es la presión, no el golpe.
- La barra del jefe (`drawHUD`) marca la fase 2 (50 o 60 %) y, en los finales, la 3 (25 o 35 %).

### 5.3 Ataque extra por modelo (ascendido = desde el principio)

| Modelo | Extra (nombre en pantalla) | Variante fuerte (2ª fase) | Aviso | Código |
|---|---|---|---|---|
| **Gólem** | **Rocas**: caen 3 rocas (sobre ti y 2 a 90 px), r 70, daño 1,2·`b.dmg`; solo polvo decorativo | 5 rocas, cadencia 0,35 s | Círculo r 70 que se llena en 0,9 s (0,7 s en Héroe) | Estado `rocks`, lista `rocks[]` y `drawRocks` (~35 líneas) |
| **Rey Slime** | **Salto**: desaparece 0,5 s y cae sobre tu posición del inicio del salto; onda de contacto r 90 y anillo de 12 balas a 150 px/s | **Escisión**, una vez al entrar en la fase: 2 «Príncipes» (slime grande élite Veloz, esbirros) | Sombra elíptica que crece de 20 a 60 px en 0,6 s | Reutiliza `tpOut`/`tpIn` con destino = jugador (~20 líneas) |
| **Brujo** | **Espejismo**: 2 copias a 200 px (alpha 0,6, 1 de vida, `decoy`: sin XP, sin Ánima, sin baja) que repiten su abanico 2 veces y se desvanecen a los 4 s; su teletransporte lleva marcador | Abanico de 7 balas e invoca 2 espectros en lugar de murciélagos | Marcador de destino de 0,4 s y la copia aparece en blanco 0,35 s antes de disparar | ~30 líneas. `killEnemy`: `if (e.decoy) { burst; return; }`, como `selfBlast` |
| **Señor** | **Juicio**: una línea roja fina gira 0,8 s desde su centro y luego barre 180° en 1,2 s; daño 1,5·bala una vez; atraviesa rocas; se esquiva cruzándola por detrás o saliendo del radio 420 | Rocas + Salto alternados | Línea de aviso de 6 px y 0,8 s | Estado `sweep` (~35 líneas) |
| **Gólem Colosal** (final del C3) | Rocas ×5 desde el principio, embestida doble con anillo al chocar | 3ª fase: lluvia de rocas cada 0,5 s durante 3 s | Ídem rocas | Solo datos (`BOSS_DEFS.golemx`) |
| **Brujo de Ceniza / Ascendido** | Espejismo y espiral de 4 brazos (5 en el Ascendido) desde el principio | Ídem Brujo | Ídem | Solo datos (`arms`) |
| **Señor Supremo** (final del C4) | Los 7 patrones (los 6 de hoy + Juicio) | 2ª fase al 50 %, 3ª al 25 % | Ídem | Solo datos |

- Patrones existentes que cambian por `tier` (tope 4): anillo `12 + 3·tier` (+4 por fase), velocidad del §4.4, murciélagos si tier ≥ 3, anillo al chocar si tier ≥ 2, 4 brazos si tier ≥ 4 o `b.arms`.
- **Arena por modelo** (no por tier; `placeHazards` 2564-2571): Gólem pinchos, Rey veneno, Brujo hielo, Señor lava y pinchos.
- **Logro por modelo**: `BOSS_DEFS[id].ach` → `boss1`…`boss4`. El Colosal da `boss1`, el Brujo de Ceniza y el Ascendido `boss3`, el Señor Supremo `boss4`.
- `untouchable` sigue valiendo para cualquier jefe.

### 5.4 Pacto favorable

- `lastBossClean = !roomHit` al morir cada jefe (en `killEnemy`, rama del jefe). Se pone a `false` en `newRun`.
- En el siguiente altar, si `lastBossClean`, la carta se llama «Pacto favorable» (borde dorado): pierdes el **15 %** de la vida máxima (no el 20 %) y ganas **3** habilidades (no 2). Sigue abriendo el Eclipse. Se consume en ese altar.
- Texto: «Pacto favorable · El jefe no te tocó: pierdes solo el 15 % de vida máxima y ganas 3 habilidades».

---

## 6. Despertar, esencia, botín, logros, récords y Grimorio

### 6.1 Despertar por capítulo (`forms.js` no cambia; `game.js` lee `CH.anima` y `CH.nets`)

| C | len | `need` [1º, 2º] | Redes {a, b, c} (ordinal de jefe) | `markRoom` (Marca II) | Ventanas objetivo |
|---|---|---|---|---|---|
| 1 | 20 | **[110, 175]** (hoy [100, 160]; sube por las élites y los refuerzos) | {1, 2, 3} (igual que hoy) | 6 | 1º s5-7, 2º s11-14 |
| 2 | 15 | [85, 135] | {1, 1, 2} | 5 | 1º s4-5, 2º s8-10 |
| 3 | 15 | [80, 125] (menos bajas) | {1, 1, 2} | 5 | 1º s4-5, 2º s8-10 |
| 4 | 10 | [80, 110] (Ánima sobre todo de jefes, 40 por jefe) | {1, 2, 4} | 4 | 1º tras el jefe 2 (s4), 2º antes del jefe final |

- **Héroe**: los mismos `need` (hay más bajas, pero se pierde el +5 de sala limpia; se mide y no se toca de antemano).
- `bossOrd`: contador nuevo que `killEnemy` incrementa en cada jefe. Las redes pasan de `e.tier === 1/2/3` a `bossOrd === CH.nets.a/b/c` (en el C1 es idéntico).
- La oferta no sale en la última sala (`winTimer`).
- `grim.k` se suma normalizado, `round(room · 20 / len)`, para no cambiar el formato de 4 números de la cookie.
- Marca II: `room <= CH.markRoom`; el texto «Despiértala antes de la sala 7» sale de `markRoom + 1`.
- `simChecks` por fracción de `len`: 1º en [0,25; 0,38], 2º en [0,55; 0,72], red b ≤ 15 %, red c ≤ 20 %, congelación de jefe ≤ 35 %.

### 6.2 Esencia (tiene que costar)

`essenceParts(win)` (5104), con las mismas partes, normalizadas al capítulo y multiplicadas por `ESS_MUL[c_ef]`:

- Salas: `28,5 · (room − 1) / (len − 1)` (en el C1 es `1,5·(room−1)`, idéntico a hoy).
- Bajas: `kills · 0,15` (igual).
- Jefes: `32 · bossesKilled / nBosses` (en el C1 es 8 por jefe, idéntico).
- Cofres: +5 cada uno (igual). Victoria: +25 (igual).
- Total × `ESS_MUL[c_ef]` = [1,00; 1,10; 1,20; 1,40; 1,50; 1,60; 1,80]. El HUD y la pantalla final ya muestran la cifra multiplicada (lo que ves es lo que cobras).

| Capítulo / modo | Victoria estimada | Derrota media |
|---|---|---|
| C1 (×1,00) | ~110 (medido 113-117) | ~~28-35~~ **medido 69-74 en el medio** (2/3 de sus muertes son en la s20) y 50-57 en el novato (K7) |
| C2 (×1,10) | ~120 | ~30-35 |
| C3 (×1,20) | ~125 | ~30-38 |
| C4 (×1,40) | ~125 | ~30-40 |
| H1 (×1,40) | ~160 | ~40 |
| H2 (×1,50) | ~165 | ~40 |
| H3 (×1,60) | ~170 | ~45 |
| H4 (×1,80) | ~165-170 | ~45 |

- **Reglas**: la victoria de cada escalón no puede bajar más de un 5 % respecto a la del anterior; la esencia por minuto de juego del perfil medio debe ser **creciente** con `c_ef` y estar entre 5 y 9; no se cobra nada por empezar partida, no hay ×N por modo ni barrido rápido.
- **Primera vez**: +15 por cada ★★★ (4 Normal + 4 Héroe = 120). Con los logros nuevos (§6.4, 155) suman **275**, unas 2,5 victorias. El Santuario (4110 + 800) sigue costando unas 35-40 victorias.

### 6.3 Equipo y botín

- `openChest` (2600): `rollDrop(lootDepth(CH, hero, room))` con `lootDepth = min(40, room + 3k)`.
- Final de partida (`showEnd`): `n = 1 + min(2, bossesKilled) + win` (sin cambio), con `rollDrop(min(40, room + 3k))`.
- `equipment.js` `rarityOdds`: el tope pasa de 20 a 40 prolongando las curvas, con tope épico 0,22 y legendario 0,05. El mítico sigue sin caer.
- Revisar «Disparo gemelo» (regala un Proyectil extra): ahora tiene la penalización 0,85.
- El inventario de 60 se llena antes: la pantalla final ya avisa y «Fusionar todo» ya existe.
- Nada de equipo exclusivo por capítulo (sin muro de equipo).

### 6.4 Logros

| Id | Qué pasa |
|---|---|
| `boss1`-`boss4` | `unlock(BOSS_DEFS[model].ach)`; valen en cualquier capítulo y modo |
| `room10` | Llegar a la sala 10 en cualquier capítulo (el C4 tiene 10 salas: vale llegar a la s10) |
| `firstWin` | Texto: «Completa el Capítulo 1». Solo C1 (Normal o Héroe) |
| `speedrun` | Solo C1 Normal, `runTime < CH.speedrun` (360 s provisional, §D22). Texto: «Gana el Capítulo 1 en menos de 6 min». Quien ya lo tenga lo conserva |
| `winAll`, `formWins` | Cuentan victorias de cualquier capítulo y modo |
| `untouchable` | Cualquier jefe |
| `elites` | Igual |

**Nuevos** (al final de `ACHIEVEMENTS`, en este orden): `cap2` «Ceniza» (completa el C2) 15 · `cap3` «Pies de hielo» (C3) 20 · `cap4` «Archimago Supremo» (C4) 30 · `heroe1` «Héroe» (cualquier capítulo en Héroe) 25 · `heroeTodo` «Leyenda» (los 4 en Héroe) 50 · `afijos` «Cazador de afijos» (mata una élite de cada uno de los 6 afijos; máscara `prog.af`) 15. **Total: 155.**

### 6.5 Récords y estadísticas

- **Récord por capítulo y modo**: `meta.prog.b['1']`, `['1h']`, `['2']`… = `"room.len.lvl.win.time.school"` compacto. Mejor = victoria > sala > nivel; entre victorias, menos tiempo.
- `S.best[escuela]` = `encodeBest`: los valores `< 100` (de hoy, 1-21) son C1 Normal (21 = victoria). Los nuevos: `ch·100 + (hero ? 50 : 0) + (win ? 49 : room)`. Se compara con `bestRank(code) = c_ef·100 + (win ? 99 : room)`, con el Héroe por delante si empatan.
- `store 'best'` (el récord del menú): pasa a ser el del capítulo **más alto** jugado; el antiguo se copia a `prog.b['1']` y no se borra.
- `showStats` (4668): «Mejor sala por escuela» con `decodeBest`: «C2·S12», «🏆 C3», «♛ C1·S8». Fila nueva: «Capítulos: 2/4 · Héroe 1/4 · ★ 9/24».

### 6.6 Grimorio

- Pestaña nueva **«Bestiario»** (`showGrimoire('beast')`): una página por cada ★ de tercio (4 Normal + 4 Héroe). Cada página muestra las fichas de los enemigos del capítulo con su color, los afijos vistos y la variante de jefe con su ataque extra; en las de Héroe, los monstruos héroe con su ataque prestado. **Es recortable**: en ese caso la ★ da solo el título.
- Títulos: la lista de títulos de forma se amplía con los de capítulo (`CH_TITLES`). `grimTitle()` (4718) elige según `prog.t` / `grim.t`; solo uno lucido a la vez.
- Tintes de túnica («Piedra», «Ceniza», «Escarcha») y la corona: `settings.skin` elige el tinte del Aprendiz entre los desbloqueados. Recortable (en ese caso la ★★★ da solo la esencia).

---

## 7. Pantallas (lógica 540×960; a 360×640 la escala es 0,667)

### 7.1 Menú (`showMenu` 4399)

- `.tag`: «Roguelite de magia · 4 capítulos · Modo Héroe».
- **JUGAR** → `startChapter(settings.chapter.id, settings.chapter.hero)` → `newRun()` (un toque, como hoy). La primera vez es el C1 Normal.
- Debajo de JUGAR, línea pequeña: «Capítulo 2 · Catacumbas de Ceniza» (+ chip violeta «♛ HÉROE»).
- Fila nueva a todo el ancho: botón **«📜 Capítulos ★ 9/24»** (estrellas totales, Normal y Héroe).
- Después, como hoy: [Santuario | Equipo], [Grimorio | Logros], [Ajustes], Instalar y cómo se juega.
- Récord: «Récord: C2 · Sala 12 · Nv 9» o «Récord: 🏆 C3» o «Récord: ♛ H1 ★».
- El fondo (`menuBiome`) es el primer bioma del capítulo seleccionado, con su tinte.
- Enter/Espacio = JUGAR.

### 7.2 Selector de capítulos (`showChapters()`, estado `'chapters'`)

Wireframe a 360×640 reales (los números son px reales):

```
┌──────────────────────────────────────┐  360
│ ←   CAPÍTULOS            ★ 9/24      │  40
│      «Caminante de Ceniza»           │  16 (título lucido)
│ ┌────────────┬─────────────┐         │
│ │  NORMAL    │  ♛ HÉROE 🔒 │         │  38 (segmentado)
│ └────────────┴─────────────┘         │
│ Completa el Capítulo 2               │  14 (solo si bloqueado)
│ ┌─▌──────────────────────────────┐   │
│ │▌ 1  LA MAZMORRA       ★★★      │   │  68
│ │▌    20 salas · 4 jefes  🏆 5:12│   │
│ └────────────────────────────────┘   │
│ ┌─▌──────────────────────────────┐   │
│ │▌ 2  CATACUMBAS DE CENIZA ★★☆   │   │  68  ← borde dorado = seleccionada
│ │▌    15 salas · 3 jefes  Sala 12│   │
│ └────────────────────────────────┘   │
│ ┌─▌──────────────────────────────┐   │
│ │▌ 3  SIMA HELADA        ☆☆☆     │   │  68
│ │▌    15 salas · trampas      —  │   │
│ └────────────────────────────────┘   │
│ ┌─▌──────────────────────────────┐   │
│ │▌ 🔒 PRUEBA DE LOS ARCHIMAGOS    │   │  68 (opacidad 0,45)
│ │▌    Supera el Capítulo 3        │   │
│ └────────────────────────────────┘   │
│        [   VOLVER   ]                │  44 (sticky)
└──────────────────────────────────────┘  ~520 de 640: sin scroll
```

- Franja izquierda de 6 px con el `accent` del primer bioma (`Biomes().info(zona0).accent`) y el tinte del capítulo.
- Subtítulos exactos: «20 salas · 4 jefes» · «15 salas · 3 jefes» · «15 salas · trampas» · «10 salas · solo jefes».
- A la derecha: 3 estrellas del modo activo (dorada `#ffd27a` / gris) y, debajo, el récord del capítulo y modo («Sala 14», «🏆 5:12» o «—»).
- Bloqueada: candado en vez del número y el texto «Supera el Capítulo N»; en Héroe, «Supera el Capítulo N y el Héroe N−1».
- **Tocar una tarjeta abierta** = `startChapter(id, hero)`: fija y guarda `settings.chapter` y llama a `newRun()` (va al selector de escuela). No hay botón JUGAR aparte. Tocar una bloqueada = toast con su requisito.
- **Interruptor**: activo en violeta `#c77dff`, que tiñe el borde de las tarjetas y cambia las estrellas a moradas. Bloqueado: al tocarlo, aviso en línea «Completa el Capítulo 2».
- Escape, `popstate` y `goBack` (4859) vuelven al menú. El evento `storage` (561) repinta si está abierto.
- Si hay más de 5 capítulos, la lista hace scroll (`panelScroll`/`restoreScroll` ya existen).

### 7.3 Selector de escuela (`showSchools` 2736)

Subtítulo encima de las escuelas: «Capítulo 2 · Catacumbas de Ceniza» y, en Héroe, una píldora violeta «♛ HÉROE». El Santuario abierto desde aquí y `goBack` vuelven a `newRun()` con el mismo capítulo (sale de `settings`).

### 7.4 En partida

- HUD (`drawHUD`): «C2 · SALA 7/15» centrado; en Héroe, «♛ C2 · SALA 7/15» en `#c77dff`. La barra del jefe lleva las marcas de fase. Si la partida tiene refuerzos pendientes, un punto violeta junto al número de sala.
- Rótulos: s1 «CAPÍTULO 2 · CATACUMBAS DE CENIZA» (color del bioma, 2,2 s; en Héroe «CAPÍTULO 2 · HÉROE»); cambio de zona «ZONA · Corazón volcánico»; «¡REFUERZOS!»; «¡SEGUNDA FASE!»; «¡ÚLTIMO ALIENTO!»; «HÉROE» sobre cada monstruo héroe.
- Avisos de primera vez en la cola de `pushToast`: cada afijo, el monstruo héroe, los refuerzos y el Pacto favorable.

### 7.5 Pausa (`showPause` 5140)

«Cap. 2 · Catacumbas · Sala 7/15 · Héroe · Nivel 9 · 71/100» y debajo la línea de forma que ya existe.

### 7.6 Final de partida (`showEnd` 5160)

- Título igual («¡VICTORIA!», «HAS CAÍDO», «PARTIDA TERMINADA»).
- Sub: victoria «Has conquistado Catacumbas de Ceniza» (+ « · Héroe»); derrota «Catacumbas · caíste en la sala 7 de 15» (+ « · Héroe»).
- **Hitos nuevos** (solo si los hay; fila dorada o morada): «★ Primer tercio · Página del Bestiario» · «★★ Segundo tercio · Título: Caminante de Ceniza» · «★★★ Completado · +15 ✨ · Tinte Ceniza».
- **Desbloqueos**: «¡CAPÍTULO 3 DESBLOQUEADO!» (dorado) o «¡MODO HÉROE DESBLOQUEADO!» (violeta).
- **Consejo al morir** (1 línea, según `lastHit`; tabla `DEATH_TIPS`):

| `src` | Texto |
|---|---|
| boss:ring | «Te acabó: el anillo del jefe · Busca el hueco y muévete en diagonal» |
| boss:aimed | «Te acabó: el abanico del jefe · El cono rojo avisa: sal de lado» |
| boss:charge | «Te acabó: la embestida · Apártate del carril rojo, no corras por él» |
| boss:spiral | «Te acabó: la espiral · Gira en su mismo sentido, despacio» |
| boss:rocks | «Te acabó: las rocas del Gólem · Mira al suelo: sal del círculo antes de que se llene» |
| boss:slam | «Te acabó: el salto del Rey · La sombra marca dónde cae: sal de ella» |
| boss:mirror | «Te acabó: un espejismo del Brujo · Las copias caen de un golpe: rómpelas» |
| boss:sweep | «Te acabó: el Juicio del Señor · Cruza la línea por detrás o aléjate» |
| archer | «Te acabó un arquero · La línea roja dice adónde dispara» |
| spirit | «Te acabó un espectro · El marcador muestra dónde va a salir» |
| totem / mage | «Te acabó una lluvia de balas · Mata antes a los que disparan en círculo» |
| contact / bomb | «Te alcanzaron cuerpo a cuerpo · No te quedes quieto con bichos cerca» |
| trap:* | «Te acabó el suelo · Las trampas avisan: pinchos que suben, lava que brilla» |
| volatile | «Te acabó una élite Volátil · Aléjate cuando muera» |
| hero:* | «Te acabó un monstruo héroe · Su corona parpadea antes de atacar» |

- **Botones**: victoria → primario **«SIGUIENTE CAPÍTULO»** (`startChapter(id+1, hero)`; si no hay siguiente en Normal y el Héroe está abierto, «PROBAR EL HÉROE»; si no hay nada más, «CAPÍTULOS») y «OTRA VEZ» (ghost, mismo capítulo y modo). Derrota → «REINTENTAR» (mismo capítulo y modo) y «MENÚ». Fila inferior: Santuario · Capítulos.
- Estadísticas: «Sala 7/15» y «Capítulo 2 · Héroe». «¡Nuevo récord!» por capítulo y modo.
- Insignia «H{n} ★» junto al récord cuando se completa un Héroe.

### 7.7 CSS (`style.css`, unas 50 líneas)

Nuevas clases `.chap`, `.chap.locked`, `.chap.sel`, `.chap.hero`, `.chap .stars`, `.seg`, `.seg.hero`, `.pill.hero`, `.miles` (fila de hitos), `.tip` (consejo de muerte). Se reutilizan `.panel.shop`, `.btn`, `.cnt` y `.sticky`. Se comprueba con `resize_window` a 360×640 y 375×812: la lista de 4 sin scroll y el final con la fila de hitos y el consejo sin empujar los botones fuera.

---

## 8. Guardado, migración, sw.js y compatibilidad

### 8.1 `META_DEFAULT` (404)

```js
prog: { n: 1, d: 0, h: 0, st: '00000000', b: {}, t: -1, af: 0 }
// n  = capítulo Normal más alto abierto (1-4)
// d  = máscara de Normales completados (bit c-1); h = máscara de Héroes completados
// st = estrellas 0-3 por capítulo: índices 0-3 Normal, 4-7 Héroe
// b  = récords {'1': 'room.len.lvl.win.time.school', '1h': ...}
// t  = título de capítulo lucido (-1 = ninguno); af = máscara de afijos matados (logro)
```

El Héroe está abierto si `d & 2` (C2 completado).

### 8.2 `loadMeta` (427)

- `m.prog = progValid(s.prog)`: tipos seguros, como `grimValid`. Enteros ≥ 0, `st` con `/^[0-3]{8}$/`, `b` con claves `/^[1-9]h?$/` y valores de cadena ≤ 40 caracteres.
- **Migración** (solo si falta `s.prog`): si `stats.wins > 0` → `d |= 1`, `n = 2`, `st[0] = '3'` (las estrellas del C1 se dan por conseguidas; la esencia de la ★★★ **no** se paga retroactivamente); si `stats.best` tiene algún valor ≥ 14 → `st[0] ≥ 2`, y ≥ 7 → `≥ 1`. `store.get('best')` sin `ch` → `prog.b['1']` (no se borra `arcano.best`). Los `S.best[escuela]` de 1 a 21 se quedan como están: `decodeBest` los lee como C1 Normal.
- `settings` (`SETTINGS_DEFAULT`, línea 42): `chapter: {id: 1, hero: false}`, `seenAfx: {}`, `skin: 0`. Si `settings.chapter` apunta a un capítulo cerrado, se corrige a `prog.n` en Normal.

### 8.3 Cookie (`cookieValue` 454)

- `prog` va compacto: `"n.d.h.st.t.af|1:7.20.9.0.0.fire,1h:..."` (`progPack` / `progUnpack`). Unos 40 caracteres, más ~30 por récord.
- **Prueba obligatoria antes de la interfaz**: 60 objetos + Grimorio lleno + 8 récords ≤ 3800. Si no cabe, sale primero el equipo (ya pasa hoy), después `prog.b` (los récords se reconstruyen desde `S.best`), y `prog` sin `b` nunca.

### 8.4 Otros

- `resetProgress` (4510): queda cubierto por `META_DEFAULT`. Además: `settings.chapter = {id: 1, hero: false}`, `settings.seenAfx = {}`, `settings.skin = 0`.
- **sw.js**: `CACHE = 'arcano-v4'` y `'chapters.js'` en `PRECACHE`.
- **index.html**: `<script src="chapters.js"></script>` entre `forms.js` y `game.js` (líneas 50-51). En las metas (L14/25/33), «limpia la mazmorra» → «supera sus 4 capítulos y el Modo Héroe».
- **Sin `chapters.js`**: `Chapters()` devuelve null y `game.js` usa `CH_FALLBACK` (el C1 de hoy embebido: `TOTAL_ROOMS`, `BOSSES`, `ALTAR_ROOMS`, `ENEMY_UNLOCK` y `BOSS_TITLES` se quedan **solo** ahí). El botón «Capítulos» se oculta. El juego nunca se rompe.
- **Compatibilidad**: guardado sin `prog` → C1 abierto; `S.best` 1-21 → C1; `rev-save1/2` tienen que pasar.

---

## 9. Plan de integración

### 9.1 `chapters.js` (nuevo; script clásico; `window.ArcanoChapters`; ~450 líneas; sin DOM, sin canvas y **sin `Math.random`**)

```js
// datos
BOSS_DEFS = { golem, rey, brujo, senor, golemx, brujox, senorx }
  // {model, ach, arena, name, r, speed, color, bullet, pats:[...], extra, arms?, rocks?, final?}
AFFIXES = [ {id:'veloz', name:'VELOZ', color:'#ffe45c', glyph:'»', tip:'Se mueve y ataca más rápido'}, escudado, volatil, invocador, vengador, charco ]
AFFIX_DENY = [['charco','veloz'], ['invocador','vengador']]
HERO = { add: 3, phase2At: .6, phase3At: .35, heroes: {from: 2, n: 1, n2AfterHalf: 1},
         heal: {boss: .05, bossHearts: 1, heartK: .5, altarDelta: -.10, chest: .10},
         hazard: {chance: .2, n: 1}, extraWaves: {1: [7,16], 2: [7,11], 3: [7,11], 4: [1]},
         tint: {color: '#c77dff', a: .08}, title: [...], ess: 'c+3' }
HERO_MOVES = { slime:'slam', bat:'dash', archer:'fan5', charger:'dash2', mage:'ring2',
               bigslime:'split3', bomber:'lava', totem:'spiral', spirit:'tp2' }
BOSS_HP_PTS = [[5,620],[10,1500],[15,3400],[20,6100]]
ESS_MUL = [1, 1.1, 1.2, 1.4, 1.5, 1.6, 1.8]
CHAPTERS = [C1, C2, C3, C4]           // C1_LEGACY (fases 1-3) y C1 v1.1 (fase 4+)
VERSION = '1.1'

// lógica pura (ch = objeto resuelto; hero = bool; r = sala real)
get(id, hero) -> CH                   // resuelto con herencia + HERO, objetos internos copiados, cacheado
cEf(ch, hero) -> int ; k(ch, hero) -> int
lastRoom(ch) -> int
bossAt(ch, r) -> {...BOSS_DEFS[id], ...entrada, ord, tier, hp, title, ascended, final, phase2At, phase3At} | null
altarAt(ch, r) -> bool ; biomeAt(ch, r) -> biomeId ; zoneStart(ch, r) -> bool ; tintAt(ch, hero, r) -> {color,a,mode}|null
hpMul(ch, hero, r) -> num             // curva de hoy × 1,12^k
dmgMul(ch, hero, r) -> num            // (1+0,07(r-1)) × 1,06^k
bulletMul(ch, hero) -> num            // min(1,2; 1,04^k)
enemyLv(ch, hero, r) -> int
budget(ch, hero, r) -> {budget, maxN, caps, pool}
firstAttack(ch, hero, r) -> [a, b]
eliteParams(ch, hero, r) -> {p, max, affixes:[ids], dual}   // p=0 si r < from (conserva el cortocircuito)
heroCount(ch, hero, r) -> int
wavesAt(ch, hero, r) -> {share:.4, at:.3} | null
hazard(ch, hero, r) -> {chance, n:[a,b], special, arenaK}
chest(ch) -> {from, p, max} ; heal(ch, hero) -> {boss, bossHearts, heart, heartVal, chest, altar}
lootDepth(ch, hero, r) -> int ; essMul(ch, hero) -> num
anima(ch) -> [n1,n2] | null ; nets(ch) -> {a,b,c} ; markRoom(ch) -> int
milestones(ch) -> [s1, s2, len] ; starsFor(ch, room, win) -> 0-3
encodeBest(ch, hero, room, win) -> int ; decodeBest(int) -> {ch, hero, room, win} ; bestRank(int) -> num
isUnlocked(prog, id, hero) -> bool ; nextChapter(id, hero, prog) -> {id, hero} | null
progValid(obj) -> prog ; progPack(prog) -> str ; progUnpack(str) -> prog ; migrate(meta) -> prog
validate() -> [errores]   // última sala = jefe; ningún altar en sala de jefe; zonas suman len; ids en BOSS_DEFS y ENEMIES;
                          // waves sin altares ni jefes; C1 pool con el mismo orden de claves que ENEMY_UNLOCK; len < 50
```

Prueba en node: `tools/test-chapters.mjs` (`validate()` vacío, tablas del §2.2, `encodeBest`/`decodeBest` de ida y vuelta, `progPack` de ida y vuelta, migraciones, `isUnlocked` en todas las combinaciones).

### 9.2 `game.js`, función por función (nombres reales; líneas de la copia snap)

- **Cabecera (~46)**: `const Chapters = () => window.ArcanoChapters; let CH = null, HEROIC = false, bossOrd = 0, waveQ = [], wave1N = 0, lastBossClean = false, lastHit = null, rocks = [], volatileQ = [];` y los accesores locales `lastRoom()`, `bossAt(r)`, `altarAt(r)`, `biomeAt(r)`. `CH_FALLBACK` con las constantes de hoy.
- **`TOTAL_ROOMS`** → `lastRoom()` en `clampArena` (764), `onCleared` (2703), la puerta (~2870), la flecha (~3189), `drawHUD`, `showMenu` (4425), `showStats` (4626-4628), `showEnd` (5179/5197/5209) y `sim` (5488).
- **`BOSSES[room]`** → `bossAt(room)` en `spawnRoom` (2628), `nextRoom`/`genRocks` (2683), `onCleared` (2700/2702) y `altarLeft` (4195 → `CH.altars.some(r => r > room)`).
- **`ALTAR_ROOMS`** → `altarAt(room)` en `placeHazards` (2574), `spawnRoom` (2642), `nextRoom` (2683), `onCleared` (2702) y `altarLeft`. **`BOSS_TITLES`** → `bossAt(room).title`. **`ENEMY_UNLOCK`** → `CH.pool`.
- **`dmgMul` (400)** → `Chapters().dmgMul(CH, HEROIC, room)`.
- **`ACHIEVEMENTS` (268)**: textos de `firstWin` y `speedrun`; 6 nuevos al final.
- **`tutStart` (548)**: solo si `CH.id === 1 && !HEROIC`.
- **`genRocks` / `nextRoom`**: `genRocks(!!bossAt(room) || altarAt(room))`.
- **`recalc` (1488)**: esquiva 0,45.
- **`hurtPlayer` (1519)**: (1) contador de bots **antes** del `return` de `god`: `if (simStat) { simStat.raw += dmg; simStat.rawBy[src] = ...; }`; (2) tras pasar la invulnerabilidad y la esquiva, `simStat.hits++`, `simStat.dmgTaken += dmg`, `simStat.hitsBy[srcKind]++`, `lastHit = {src, room}`; (3) trampa con `startsWith('trap')`.
- **`fireVolley` (1607)**: 0,85 / 0,87.
- **`makeEnemy` (1699)**: `hm` × `hpMul`, `e.lv`, `timer` de `firstAttack`, tinte de `biomeAt` + `enemyTint`, `kbMul`, `affix: null`, `hero: false`, `shield: 0`.
- **`makeElite` (1715)**: ×2,0 (fase 4), afijos (fase 5), `kbMul = 0`. **`makeHero(e)`** nueva.
- **`makeBoss` (1724)**: recibe `bossAt(room)` → `model`, `tier`, `ord`, `ach`, `arena`, `extra`, `ascended`, `final`, `phase: 0`, `phaseT: 0`, `phase2At`, `phase3At`, `hp` de la tabla y `pats` con el extra si está ascendido.
- **`roomEnemies` (1736)** ← `budget(CH, HEROIC, n)`. Devuelve la lista; `spawnRoom` la parte para `waveQ`.
- **`fireBullet` (1770)**: parámetro `src` (por defecto `'shot'`).
- **`updateEnemy` (1785)**: `room` → `e.lv`; velocidades × `bm`; `ds *= e.hasteK || 1`; `affixTick(e, dt)` (Invocador, Vengador, Charco); `heroTick(e, dt)` (las 9 ramas de `HERO_MOVES`); tope de balas al empezar un ataque.
- **`bossRing` / `bossIdle` / `bossNext` / `updateBoss` (1963-2073)**: pausa nueva, `bossPhase(b, n)` (2ª y 3ª fase), estados `rocks`, `slam`, `mirror`, `sweep`, `aimed` de 0,35 s, `tpX/tpY` elegidos al empezar el teletransporte, velocidad de anillo.
- **`damageEnemy` (2094)**: si `e.phaseT > 0` no resta vida; maná del jefe 45; si hay escudo (`e.shield > 0`), lo gasta primero y sin reacciones; al romperse, aturdimiento de 0,3 s.
- **`killEnemy` (2106)**: `decoy` sale antes de contar baja; corazones con `heal(CH, HEROIC)` y la regla del 95 %; Drenar 1,5 %; `unlock(BOSS_DEFS[model].ach)`; `bossOrd++`; redes por `nets(CH)`; `lastBossClean = !roomHit`; afijos al morir (Volátil → `volatileQ` con aviso de 0,6 s; Vengador de sus aliados +1); héroe slime grande en 3; `prog.af |= bit` si era élite con afijo; logro `afijos`.
- **`shotHit` (2295)**: empujón `80 × kbMul`; Salto y Lanza −25 %.
- **`updateShots` (2376)**: Rebote −40 % y no se llama a `ar.hit.clear()`.
- **`updateBullets` (2420)**: `hurtPlayer(b.dmg, b.src)`; la caja sigue en −4.
- **`collectDrop` (2431)**: valor del corazón según `heal().heartVal` (0,12).
- **`placeHazards` (2549)**: arena por `model`; parámetros de `hazard(CH, HEROIC, room)`; `altarAt`.
- **`openChest` (2600)**: cura 0,10; `lootDepth`.
- **`spawnRoom` (2626)**: `bossAt` y `altarAt`; guarda `music` con `state !== 'school'` en todas las ramas; `spawnDist`; élites con `eliteParams` (manteniendo el cortocircuito `r >= from &&` antes del `Math.random`); afijos; héroes; cofre de `chest(CH)`; partición en `waveQ`; antesala del C4; rótulos de capítulo (s1) y de zona (`zoneStart`); se borra «Se oye algo enorme…».
- **`nextRoom` (2677)**: `waveQ = []`, `rocks = []`, `volatileQ = []`. La recogida automática se mantiene (palanca de reserva nº 3: `if (g.type === 'gem')`).
- **`update` (~2840)**: `spawnWave()` antes de `onCleared` (2862); `room < lastRoom()` en la puerta.
- **`onCleared` (2696)**: cura del jefe según `heal().boss`; `room >= lastRoom()` → `winTimer`; Ánima `clean` con `altarAt`; estrellas de tercio (`starsFor`) que se guardan **al llegar** a la sala (en `nextRoom`, para que cuenten aunque mueras).
- **`newRun` (2708)**: `CH = Chapters() ? Chapters().get(settings.chapter.id, settings.chapter.hero) : CH_FALLBACK; HEROIC = !!(settings.chapter.hero && isUnlocked(...)); bossOrd = 0; waveQ = []; lastBossClean = false; lastHit = null; rocks = []; volatileQ = [];` **antes** de `nextRoom()`. Nueva `startChapter(id, hero)`: guarda `settings.chapter` y llama a `newRun()`.
- **`showSchools` (2736)**: subtítulo.
- **`biomeId` (3112)** → `biomeAt(room)`. **`buildRoomBg` (3117)**: `tintAt` sobre el lienzo cacheado **antes** de `paintHazardBase` (las antorchas, `drawTorches` 3138, no se tiñen).
- **`drawTelegraphs` (3244)**: cono del abanico, pulso del anillo, marcadores de destino, círculos de rocas, sombra del salto, línea del Juicio, aviso Volátil, círculos de refuerzo, avisos de los monstruos héroe.
- **`drawEnemy` (3703)**: aura, glifo y nombre del afijo; escudo hexagonal; barra, corona y anillo del héroe.
- **`drawBoss` (3876)**: por `b.model` (no por `tier`); r 48 del Colosal; anillo de transición de fase; copias del Espejismo con alpha 0,6.
- **`drawHUD` (4115)**: «C2 · SALA 7/15» (+ ♛), marcas de fase.
- **`showMenu` (4399)**: tag, línea de capítulo, botón Capítulos, récord, fondo. **`showChapters()`** nueva. Clics (5224): `'chapters'`, `'chapter'` (`data-id`), `'heromode'`, `'next'`. Teclado (547/570), `popstate` (4347) y `goBack` (4859) con `'chapters'`.
- **`showStats` (4668)**, **`grimTitle` (4718)**, **`showGrimoire` (4787)**: §6.5-6.6.
- **`rollSkills` (4877)**: sin cambios (la Poción cambia en `SKILLS`).
- **`openAltar` / `pickAltar` (4993/5027)**: Fuente desde `heal().altar` (texto «Recuperas el 50 %…»), Pacto favorable (15 %, 3 cartas).
- **`essenceParts` / `calcEssence` (5104/5113)**: normalización y `essMul`.
- **`showPause` (5140)** y **`showEnd` (5160)**: textos, `prog` (d/h/n/st/b), `encodeBest`, hitos, desbloqueos, `DEATH_TIPS`, botones, `speedrun` con `CH.speedrun`, logros nuevos.
- **`SKILLS`**: Poción (peso 1,0, 35 %, `< 0,6`), Drenar (texto 1,5 %), Proyectil extra, Eco, Salto, Lanza y Rebote (textos).

### 9.3 Otros ficheros

- `biomes.js`: `render(..., opts.tint)` / `info()` sin cambios de API; el tinte lo aplica `game.js` en `buildRoomBg`.
- `music.js` (**recortable**): `ArcanoMusic.play(track, {key})` con transposición global en semitonos al programar las notas; Héroe +1; el `bpm` no cambia.
- `equipment.js`: `rarityOdds` (tope 40, épico 0,22, legendario 0,05) y Sed de sangre.
- `forms.js`: sin cambios.

### 9.4 Depuración y bots (bloque `?debug`, 5250-5650)

- `__arcano.chapter(id, hero)` fija `settings` y devuelve `CH`; getters `chapter`, `hero` y `CH`.
- `goto(n, ch = settings.chapter.id, hero = settings.chapter.hero)`: compatible con los más de 50 scripts de `tools/` (sin argumentos = capítulo actual).
- `sim({ch, hero, ...})` devuelve además `hits`, `dmgTaken`, `raw`, `hitsBy` (bala/contacto/trampa/jefe/bomba/héroe/afijo), `maxBullets` y `phaseT` por jefe. `simRow` toma los jefes de `CH`. `simChecks(rows, ch)` trabaja con fracciones. `bench({room, ch, hero})` usa por defecto la última sala; `roomBench` usa las salas normales de `CH`.
- **(K8) Antes de medir la fase 5, el esquivador tiene que «ver» lo nuevo**: hoy solo esquiva balas, contacto, embestidas, bombas y trampas. Hay que enseñarle las Rocas (círculo que se llena), el Salto (sombra), el Juicio (línea que barre), los Espejismos (son balas, ya los ve) y el aviso del Volátil; si no, mide golpes que una persona sí esquivaría. Y una política de altar `ALTAR=bendicion|fuente|auto` (auto = Fuente si la vida < 50 %, si no Bendición; Pacto si `lastBossClean`): hoy elige siempre Bendición, así que la Fuente (60 → 50 %) y el Pacto favorable **no están medidos**.
- Esquivador: variables `CHAPTER=n HERO=0|1`, que escriben `settings.chapter` en `localStorage` antes de cargar; `TAG` para filtrar. `esquivador-report.mjs`: columna capítulo/modo, golpes por sala normal, de jefe y de la sala final, reparto de muertes por sala y `hitsBy`.

### 9.5 Orden por fases (cada fase con medición y commit propios)

| Fase | Contenido | Qué se puede probar al final |
|---|---|---|
| **0** Línea base (2 h) | JSON de `simMatrix({seeds:8})`, `bench`, `roomBench`, `rev-econ`, `smoke`; 40 partidas del esquivador (medio/bueno, fresco, con formas) y 40 de veterano | Ficheros en `tools/baseline/` |
| **1** Refactor sin cambio | `chapters.js` con el C1 de hoy (`C1_LEGACY`), accesores, `e.lv` (= room), modelo/tier/ach/arena del jefe, redes por ordinal, `lastRoom`, `biomeAt` en `makeEnemy`, `CH_FALLBACK`, `test-chapters.mjs` | **JSON idéntico** a la línea base: el mismo número y orden de llamadas a `Math.random`. Si no es idéntico, no se sigue |
| **2** Guardado | `prog`, `progPack`, migración, `encodeBest`, `settings.chapter`, `resetProgress`, prueba de la cookie con 60 objetos | `rev-save1/2`, guardado antiguo sin `prog`, cookie ≤ 3800 |
| **3** Avisos y legibilidad | Telegrafiados del §4.8, colores de bala, `src` en las balas, `lastHit` y contador de golpes en los bots | JSON todavía idéntico (los colores no gastan aleatoriedad); prueba en escala de grises (§10.5) |
| **4** Curva base del C1 | §4.1-4.7, aplicando las palancas en el orden del §4.10. `C1_LEGACY` → `C1` | Esquivador del C1 (corregido K4): medio **55-70 %** al cerrar la fase 4 (medido: 70 % con la curva del §4 tal cual, 48 % con todo el paquete K3+K2 y la aproximación de la fase 5); dios con formas ≥ 4:00 |
| **5** Afijos, fases y Pacto | Los 4 afijos del C1, 2ª y 3ª fase, Rocas/Salto/Espejismo/Juicio, Pacto favorable | Esquivador del C1 otra vez **con el bot que ve las Rocas, el Salto y el Juicio (K8)**: medio 40-55 %; `bench` de jefes; congelación ≤ 35 %; afinar con el §4.10 |
| **6** Interfaz | Menú, selector, interruptor, HUD, pausa, final (hitos, consejo, siguiente), escuela, estadísticas, CSS a 360×640 y 375×812 | **Publicable como v1.1 «C1 difícil»** (los capítulos 2-4 se ocultan si no están) |
| **7** C2 y C3 | Datos, tintes, `enemyTint`, jefes ascendidos y finales, Vengador y Charco, `anima`/`nets`/`markRoom` por capítulo, `grim.k` normalizado | Esquivador del C2 y del C3; ventanas del Despertar; trampas del C3 ≤ 35 % del daño |
| **8** Modo Héroe | Capa `HERO`, `makeHero` y los 9 movimientos, desbloqueo tras el C2, tinte violeta, corona | Esquivador `HERO=1` en el C1: H1 ≈ C4 ±5; monstruos héroe 25-40 % de los golpes en salas normales |
| **9** C4 (recortable) | Antesala, altares por lista, vida absoluta, Brujo Ascendido y Señor Supremo, música | Esquivador del C4 y del H4; despertares del C4 |
| **10** Economía y coleccionables | `essenceParts` normalizado, `ESS_MUL`, ★★★ +15, logros nuevos, títulos, Bestiario (recortable), tintes/corona (recortable), `rarityOdds` 40 | `rev-econ` por capítulo y modo; monotonía; esencia/minuto |
| **11** Cierre | sw v4, metas de `index.html`, docs (`despertar-spec.md` 82-96 y 402: redes por ordinal y «última sala»; `capitulos-mapa-codigo.md`), `perf(600)`, prueba sin `chapters.js` y sin `forms.js`, **prueba con 2-3 personas** y push privado a GitHub desde `E:\PROYECTOS\arcano` | §10 completo |

- **Recortables** si aprieta el plazo, en este orden: C4 (fase 9), Bestiario, tintes de túnica y corona, transposición musical, monstruos héroe tótem/diablillo/slime grande/espectro.
- **Nunca se recorta**: las fases 3, 4 y 5 (son la respuesta a «le falta dificultad»), la 6 y la validación con bots y personas.
- **No se mezclan en un mismo commit** la dificultad (fases 4-5) y los capítulos (fases 7-9).

---

## 10. Plan de pruebas

Todas las cifras son medianas de **8 semillas × 5 escuelas = 40 partidas por fila**, en partida fresca y con formas salvo que se diga «veterano» (`META=veterano`, que es el perfil de Double). Esquivador: `CDP_PORT=94xx node E:/PROYECTOS/arcano-snap/tools/cdp.mjs 135 240 E:/PROYECTOS/arcano-snap/tools/esquivador.js` con `PROFILES=novato,medio,bueno,dios FORMS=1 SEEDS=8 CHAPTER=n HERO=0|1`.

### 10.1 Capítulo 1 Normal (el que decide el lanzamiento)

| Métrica | Hoy | Objetivo |
|---|---|---|
| Victorias novato / medio / bueno | 20-33 / 95 / 98 % | ~~5-12 / 25-35 / 50-65 %~~ **3-10 / 40-55 / 80-92 %** (K1; medido con la variante D: 5 / 48 / 88 %) |
| Veterano medio / bueno | 100 / 100 % | ~~60-75 / 75-90 %~~ sin objetivo en el C1 (≥ 85 %; medido 90-100 % en todas las variantes). Su objetivo vive en el C3, el C4 y el H1 |
| Novato que llega a la s10 | — | **≥ 80 %** de las partidas; muertes antes de la s6 ≤ 15 % (medido D: 88 % y 12 %) |
| Golpes del medio por partida | 3,6 | ~~8,5-10~~ **6-7,5** (medido D: 6,4) |
| Golpes en sala normal / jefe 5-10-15 / sala 20 | 0,10 / 0,3-0,4 / 1,3 | **≥ 0,15** / 0,6-1,5 cada uno / 1,7-2,3 (medido D: 0,18 / 0,6-0,75-1,45 / 1,9) |
| Muertes del medio | 100 % en la s20 | ≤ 60 % en la s20 y ≥ 25 % entre la s10 y la s15 |
| Daño del medio por tipo | jefe 70 / bala 17 / trampa 13 / contacto 0 / bomba 0 % | jefe 55-70 / bala 20-35 / trampa 5-15 / contacto+bomba: **sin objetivo con el bot** (medido 0-1 % en todas las variantes: el bot se aleja y los cuerpo a cuerpo van a 90-122 frente a 190; se mira con personas, §10.6) |
| Cura efectiva / daño (medio) | 1,1 | ≤ 0,7; cura de jefe ≤ 20 por partida |
| Tiempo del dios con formas | 3:33 (mín. 2:55) | ~~5:00-5:45~~ mediana **4:15-4:45**, mínimo ≥ 3:30 (medido D: 4:30, mín. 3:38) |
| Victorias del medio | 3:47 | mediana ≥ 4:30, p10 ≥ 4:00 (medido D: 4:46, p10 4:10) |
| Golpes «sin ver aún» (bueno) | 2-4 % | ≤ 8 % con todas las fases nuevas |
| Despertar | — | 1º en s5-7, 2º en s11-14; red b ≤ 15 %, red c ≤ 20 % |
| `bench` (build media con formas) | — | Gólem 12-15 s, Rey 15-18 s, Brujo 15-20 s, Señor 25-35 s; congelación ≤ 35 % |
| Escuelas | hielo la más segura (medio: hielo 94 %, fuego 75 %) | **K10: hoy falla de largo** (medido D: hielo 100 %, arcano 38 %, veneno 50 %, fuego 38 %, rayo 13 %); ninguna escuela más de 20 puntos por encima de la media; ninguna forma final más de un 25 % más rápida |
| Esencia | victoria 103-112 | victoria 100-120; partida media del medio 25-40; del novato 15-25 |

### 10.2 Capítulos 2-4 Normal

| C | Medio | Bueno | Veterano | Dios (tiempo, victorias) | Específico |
|---|---|---|---|---|---|
| 2 | 15-25 % | 40-55 % | 55-70 % | 3:50-4:40, 100 % | Golpes del medio 10-12 |
| 3 | 10-20 % | 30-45 % | 45-65 % | 4:00-4:50, 100 % | Trampas 20-35 % del daño |
| 4 | ≤ 10 % | 15-35 % | 35-55 % | 3:30-4:45, 100 % | ≥ 1 golpe por jefe para el bueno; ningún jefe con TTK > 30 s en `bench`; 1º despertar tras el jefe 2 en ≥ 70 % de las rutas y el 2º antes del final en ≥ 60 % |

### 10.3 Héroe

- H1 dentro de ±5 puntos del C4 en todos los perfiles (bueno 15-35 %, veterano 35-55 %).
- H2: bueno 8-20 %, veterano 25-45 %. H3: veterano 15-35 %. H4: veterano 8-20 %; dios 100 % con mediana ≤ 6:30.
- Monstruos héroe: responsables del 25-40 % de los golpes en salas normales (por debajo del 15 % no se notan; por encima del 50 % son un muro).
- Ninguna muerte del perfil medio en las salas 1-2 del H1.
- Si el dios tarda demasiado o el veterano no gana nunca: vida 1,12 → 1,10 por escalón. **Nunca** se sube el daño por golpe.

### 10.4 Transversales y monotonía

- La victoria del medio decrece estrictamente con `c_ef`: C1 > C2 > C3 > C4 ≈ H1 > H2 > H3 > H4.
- Esencia (`rev-econ` por capítulo y modo): la victoria no baja más de un 5 % entre escalones; la esencia por minuto del medio es creciente y está entre 5 y 9; los hitos y logros nuevos suman ≤ 275.
- El veterano en H4 gana menos que el bueno en el C1.

### 10.5 Legibilidad y rendimiento

- **Escala de grises**: captura de las 4 familias de bala enemiga sobre los 4 biomas teñidos (y con el tinte violeta de Héroe) frente a las 9 siluetas de proyectil del jugador. Ningún par puede confundirse.
- Ningún ataque nuevo con aviso de menos de 0,35 s (comprobar con un script sobre los temporizadores).
- `maxShots ≤ 200`, `maxParts ≤ 500`, enemigos vivos ≤ 16, balas enemigas ≤ 280 (métrica `maxBullets`).
- `perf(600)` en la s18 del C1 y del H1, y en la s10 del H4, con calidad baja: `update` ≤ 4 ms de media; FPS ≥ 55, y ≥ 45 con la CPU 4× más lenta en Chrome. `glowCache.size < 80`.
- Si sobra carga, se recortan partículas antes que enemigos.

### 10.6 Validación con personas (D25)

Antes de publicar, 2-3 personas que no hayan jugado el juego juegan 3 partidas del C1 Normal, y Double juega el C3 y el H1. Se mira: ¿alguien muere antes de la s5? (máximo 1 de 9 partidas); ¿todos llegan alguna vez a la s10?; ¿entienden de qué murieron (consejo)?; ¿alguien gana en menos de 5:00? (no debería). Si la persona media no pasa de la s10 en ninguna partida, se aplica el §4.10 hacia abajo.

### 10.7 Regresión y casos límite

- **Fase 1**: `simMatrix`, `bench`, `roomBench`, `rev-econ` y `smoke` idénticos al JSON de la línea base.
- **Despertar**: `simChecks` por capítulo; redes por ordinal en el C2 y el C3 (3 jefes) y en el C4 (6 jefes); la oferta no sale en la última sala; `grim.k` normalizado (4 números, cookie compatible); Marca II con `markRoom`; Eclipse con Pacto favorable.
- **Casos límite**:
  - Morir durante la transición de fase del jefe.
  - Matar al jefe con el definitivo mientras está en `phaseT` (no debe morir hasta acabar la transición).
  - Refuerzo pendiente cuando el último enemigo muere por veneno.
  - `unstick` del bot que teletransporta encima de una tanda (≥ 220 px al nacer).
  - Copias del Espejismo cuando muere el jefe (`wiped`, sin baja).
  - Volátil que muere por `wiped` (no explota).
  - Escisión del Rey en la sala con el tope de esbirros.
  - Monstruo héroe congelado (el ataque prestado se cancela y se reinicia).
  - Pausa y `blur` a mitad de Juicio.
  - Cambio de pestaña durante `spawnWave`.
  - Inventario lleno con botín de profundidad 40.
  - `settings.chapter` apuntando a un capítulo cerrado tras un `resetProgress`.
  - Guardado de otra versión con `prog` roto.
  - Desbloquear el Héroe y el C3 en la misma victoria (dos rótulos).
  - El C4 en la sala 1 sin música de jefe.
  - Partida sin `forms.js` (sin redes ni `need`) y sin `chapters.js` (`CH_FALLBACK`).
  - `speedrun` ya conseguido con el umbral antiguo (se conserva).
- **Navegación**: Escape, Atrás del navegador y `goBack` desde el selector, la escuela, el Santuario abierto desde la escuela y el final (SIGUIENTE / OTRA VEZ / REINTENTAR con el mismo capítulo y modo).
- **Pantallas** a 360×640 y 375×812: selector sin scroll; final con la fila de hitos, el desbloqueo y el consejo sin que los botones queden fuera.
