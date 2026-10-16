# Informe: cómo darle dificultad a Arcano

Tomé los datos de la copia estable `E:\PROYECTOS\arcano-snap\public` y no he tocado nada en `E:\PROYECTOS\arcano`. Para medir creé tres scripts de prueba:
- `E:\PROYECTOS\arcano-snap\tools\dific-base.js`: tiempo por sala, TTK de jefes y vida de las salas.
- `E:\PROYECTOS\arcano-snap\tools\dific-spec.js`: compara con los objetivos de la spec (7.2 y 7.3).
- `E:\PROYECTOS\arcano-snap\tools\dific-kills.js`: bajas por partida.

## 1. Diagnóstico con datos: Double juega igual que un bot quieto en modo dios

El bot de `sim()` no esquiva, está en modo dios y está quieto salvo cuando se atasca. Mido con él para separar la dificultad del juego de la habilidad del jugador.

| Métrica | Arcano hoy (bot) | Objetivo de la spec / referencia |
|---|---|---|
| Duración de la partida (sin definitivo) | 2:31–3:19 (Arcanista, Electromante, Piro); Crio 3:20–6:25 | 4:00–6:00 (despertar-spec 7.2) |
| Duración (con definitivo) | 2:10–3:15 | Double: 2:43 y 3:02 |
| TTK Brujo (sala 15), partida real | 5,2–15,2 s (con definitivo, unos 4,6 s) | 15–20 s (7.3) |
| TTK Señor (sala 20), partida real | 5,7–17 s (con definitivo, 6–10 s) | 25–35 s |
| TTK con la build "media" de `bench` | Brujo 11–13 s, Señor 20–24 s | Esa build de 10 elecciones es más débil que una partida real (nivel 14–15, más cofres, altar y pacto) |
| Segundos por sala de combate | unos 5–12 s, de los que 0,75 s son de aparición y 1,7 s de transición | — |
| Bajas por partida | 78–93 | — |

**Las causas, con referencia al código:**

1. **Escalado asimétrico.**
   - La vida de los enemigos crece así: `hm = 1 + 0.2(n−1) + 0.006(n−1)²` (en `makeEnemy`, línea 1661). Llega a ×7,0 en la sala 20.
   - El daño enemigo, `dmgMul = 1 + 0.07(n−1)` (línea 399), llega a ×2,33.
   - Los jefes solo pasan de 480 a 4700 de vida, ×9,8 (`BOSSES`, línea 298).
   - El poder del jugador se multiplica por 5 ejes a la vez: Poder ×6 = ×2,5; Celeridad ×5 = ×2,1; Proyectil extra ×3 = 4 proyectiles × 0,88³ = ×2,7; Eco ×3 = 4 × 0,9³ = ×2,9; crítico 45% ×3 = ×1,9. En total unas **75 veces** contra un jefe (todas las balas impactan), sin contar elementos ni formas.
   - El escalado de los enemigos es una sola curva, casi lineal.

2. **Penalizaciones por proyectil muy suaves.**
   - Arcano: Proyectil extra −12% (línea 1571) y Eco −10%. Atravesar, Salto y Rebote **no pierden daño** (`shotHit`, líneas 2293–2318). Además, el rebote vacía `ar.hit`, así que puede volver a golpear al mismo enemigo.
   - Archero: flecha frontal −25%; multidisparo −10% de daño y −15% de cadencia; rebote −30% por salto; atravesar −33% por enemigo; rebote en muros −50% ([Android Authority](https://www.androidauthority.com/archero-guide-heroes-abilities-1086651/)).

3. **La ventana de amenaza es casi nula.**
   - Los enemigos tardan en atacar por primera vez:
     - Arquero: `timer rand(0.6,1.6)` (línea 1667) más 0,6 s de apuntado.
     - Cultista: entre 1,35 y 2,35 s.
     - Embestidor: `timer rand(0.6,1.6)` más 0,65 s de carga.
     - Encima, todos tardan 0,75 s en aparecer.
   - Si la sala muere en 3–6 s, cada enemigo dispara una o dos veces.
   - Todos aparecen a la vez: el retraso es `i*0.05` (línea 2620) y no hay refuerzos.

4. **Se cura demasiado.**
   - Corazones: 6% de probabilidad por enemigo normal, 30% por élite y 2 por jefe (línea 2086). Cada uno cura el 15% (línea 2399).
   - Al limpiar un jefe, +25% (línea 2657). Cada cofre cura otro 15% (línea 2565).
   - Con unas 85 bajas, eso suma **unas 2,9 barras de vida pasivas por partida**.
   - Además, si los coges:
     - Fuente del altar: 60% cada vez, hasta 4 por partida (línea 4980).
     - Drenar vida: 2% por baja y nivel, hasta 6% por baja, unas 5 barras (línea 324).
     - Poción: cura el 40% y su peso, 1,4, es **el más alto del mazo** (línea 318).
   - Comparación: el Robavida de Archero da 1,5% por baja, y su ángel aparece cada 10 salas (salas 5, 15, 25…). En Arcano hay un altar cada 5.

5. **Mucho margen de supervivencia.**
   - Tras un golpe hay 0,7 s de invulnerabilidad (línea 1514). La esquiva puede llegar al 60% (línea 1457), que equivale a ×2,5 de vida efectiva.
   - Un veterano tiene unos 275 de vida: Santuario +50 y equipo legendario unos +101 (equipment.js). Una bala de la sala 18 hace unos 26, así que aguanta **más de 10 golpes**.
   - El progreso permanente aplana el reto. Por eso todos los juegos de referencia añaden la escalera de dificultad *después* de la primera victoria.

6. **Élites y jefes sin comportamiento nuevo.**
   - El élite solo gana estadísticas: ×2,2 de vida y ×1,25 de daño (`makeElite`, líneas 1676–1683). Como mucho hay 2 por sala, con probabilidad 0,1 + 0,006·sala desde la sala 6 (línea 2621).
   - La furia del jefe al 50% solo añade 4 balas al anillo y acorta un 30% la pausa entre ataques (líneas 1925–1952). Con un TTK de 5 s, esa furia dura unos 2 s.

7. **Solo hay 12 salas de combate de 20**: 4 son altar y 4 son jefe.

## 2. Cómo escalan los mejores

- **Archero**
  - Las partidas se organizan en capítulos de salas cortas con jefes intercalados.
  - En el modo héroe, algunos monstuos se vuelven "héroes": más vida y ataque, más tamaño y movimientos parecidos a los de su jefe. Cada capítulo héroe equivale a 2–4 capítulos normales ([Archero fandom, Chapters](https://archero.fandom.com/wiki/Category:Chapters)).
  - Se siente justo porque los tiradores avisan con una línea roja, los patrones son consistentes y cada sala dura menos de un minuto ([Game Developer, Finding the Fun 1](https://www.gamedeveloper.com/design/finding-the-fun-archero-part-1---gameplay)).
  - El diablo cuesta un 20% de la vida máxima, y el ángel es una elección entre curarse y mejorar ([Android Authority](https://www.androidauthority.com/archero-guide-heroes-abilities-1086651/)).
  - Las oleadas del capítulo 3 rompían el ritmo, así que conviene usar refuerzos con moderación.

- **Hades, Pacto de Castigo**
  - Condiciones a la carta, cada una con su coste de Calor:
    - Trabajos forzados: +20% de daño enemigo por rango (hasta +100%).
    - Consecuencias duraderas: −25% de curación por rango.
    - Citación del jurado: +20% de enemigos por rango.
    - Calistenia: +15% de vida.
    - Horas extra: +20% de velocidad.
    - Medidas extremas: jefes con técnicas nuevas.
    - Paquete de beneficios: perks para los enemigos con armadura.
    - Mandos intermedios: un élite más.
    - Plazo ajustado: 9 min por región, −2 min por rango.
    - Proceso de aprobación: una opción menos al elegir.
    - Seguridad reforzada: +400% de daño de trampas.
  - Recompensa: botín de jefe que solo se cobra la **primera vez** que subes de Calor con cada arma ([Prima](https://primagames.com/gaming/hades-guide-pact-of-punishment-modifiers-heat), [RPG Site](https://rpgsite.net/feature/10287-hades-pact-of-punishment-heat-modifiers-and-how-to-maximize-your-rewards)).
  - En dirección contraria, el Modo Dios da un 20% de resistencia al daño y +2% por cada muerte ([Can I Play That](https://caniplaythat.com/2021/08/11/hades-god-mode-explained-by-supergiant-games)).

- **Slay the Spire, Ascensión** (acumulativa; se desbloquea ganando) ([wiki.gg](https://slaythespire.wiki.gg/wiki/Ascension)):
  - A1: unos 60% más de élites.
  - A2, A3, A4: más daño de normales, élites y jefes.
  - A5: tras el jefe solo curas el 75% de lo que te falta.
  - A6: empiezas con −10% de vida.
  - A7 a A9: más vida y bloqueo.
  - A11: un hueco de poción menos.
  - A14: −4 o −5 de vida máxima.
  - A17 a A19: movimientos nuevos para normales, élites y jefes.
  - A20: dos jefes al final.
  - Primero suben los números y después se cambia el comportamiento.

- **The Binding of Isaac, modo difícil**
  - Probabilidad de campeón 20% (frente a 5%). Los campeones solo sueltan objeto un 33% de las veces.
  - Entre un 34% y un 66% menos de corazones al limpiar salas. Más salas por piso ([wiki.gg](https://bindingofisaacrebirth.wiki.gg/wiki/Hard_Mode)).
  - Cada campeón se identifica por su color: rojo ×2,6 de vida, cian oscuro explota al morir, blanco es invulnerable hasta que mueren los demás, violeta atrae al jugador y sus balas ([Champions](https://bindingofisaacrebirth.wiki.gg/wiki/Champions)).

- **Vampire Survivors**
  - La Maldición sube la vida, la velocidad, la frecuencia y la cantidad de enemigos. No da más oro directamente, pero más enemigos significa más XP, lo que retroalimenta al jugador ([wiki](https://vampire.survivors.wiki/w/Curse)).
  - Modo Inverso: +200% de vida enemiga, +5% compuesto por minuto, y +200% de oro.

- **Brotato**
  - La vida enemiga crece en línea por oleada: base + k·(oleada−1) ([Enemies](https://brotato.wiki.spellsandguns.com/Enemies)).
  - Niveles de peligro ([Dangers](https://brotato.wiki.spellsandguns.com/Dangers)):
    - P2: un élite o una horda.
    - P3: +12% de vida y daño.
    - P4: +26% y tres oleadas especiales.
    - P5: +40% y dos jefes con −25% de vida.
  - La recompensa son **personajes desbloqueables**. Un élite suelta un cofre legendario que cura 100 ([Elite Wave](https://brotato.wiki.spellsandguns.com/Elite_Wave)).

- **Risk of Rain 2**
  - La dificultad sube con el tiempo: `coef = (1 + min × 0,0506 × dificultad) × 1,15^etapas` ([Difficulty](https://riskofrain2.wiki.gg/wiki/Difficulty)).
  - Eclipse 1–8 se desbloquea por personaje ([Eclipse](https://riskofrain2.wiki.gg/wiki/Eclipse)):
    - E1: empiezas cada etapa con 50% de vida.
    - E4: enemigos +40% de velocidad.
    - E5: −50% de curación.
    - E7: −50% de enfriamiento enemigo.
    - E8: daño permanente.
  - Escalar por tiempo castiga al jugador lento. A Double, que es rápido, apenas le afectaría.

- **Dead Cells, células de jefe** ([wiki.gg](https://deadcells.wiki.gg/wiki/Boss_Stem_Cells), [Malaise](https://deadcells.wiki.gg/wiki/Malaise)):
  - Las fuentes de vida desaparecen poco a poco: en BC1 una de cada dos; en BC4, cero.
  - Los enemigos detectan desde más lejos y se teletransportan.
  - Las recompensas suben de calidad: objetos +1 o +3 niveles y ×2 o ×3 células.

## 3. Qué modificadores funcionan y cuáles frustran (en móvil)

- **Funcionan:**
  - Más élites, con afijos visibles.
  - Movimientos nuevos para jefes, mejor como fase 2 (A17–19, Medidas extremas).
  - Menos curas automáticas, siempre que siga habiendo una cura **elegida** (altar o fuente).
  - Un poco más de vida y daño. Como mucho +25–40% por escalón; si no, el combate se alarga sin ser más interesante.
  - Algún enemigo más por sala, contando con que eso da más XP.
- **Frustran:**
  - Temporizadores: en móvil hay pausas e interrupciones.
  - Control de movimiento: cárceles, miedo, atracción.
  - Reflejar daño sin aviso.
  - Invisibilidad.
  - Teletransporte encima de enemigos que ya se teletransportan, como el espectro.
  - Anticuración total.
  - Vida inflada sin cambios de patrón.
- La misma pauta en Diablo 3: las combinaciones de afijos de control (Carcelero, Remolino, Pesadilla) con daño en área son las más odiadas ([Blizzard Watch](https://blizzardwatch.com/2015/07/11/combat-elite-monster-affixes-diablo-3/)).
- Los jugadores llaman "muy castigador" a quedarse sin formas de curarse ([Game Wisdom](https://game-wisdom.com/?p=24881)).

## 4. Recompensas por subir la dificultad sin romper la esencia

- **Botín único al superar cada nivel nuevo, por escuela** (como el Calor de Hades). Propuesta: 10 de esencia por nivel nuevo, como mucho 100 por escuela y 500 en total. Eso son unas 4–5 victorias normales (una victoria da unos 110: salas 28, bajas 13, jefes 32, cofres unos 10, victoria 25; `essenceParts`, línea 5088).
- **Nada de multiplicar la esencia por partida.** Es lo que hacen Dead Cells (×2–3) y Vampire Survivors (+200%), y va contra la norma de Double.
- **Mejor calidad en vez de más moneda**:
  - Equipo: `rollDrop(min(20, sala+3) + nivel)` en `openChest` (línea 2569).
  - Cosméticos: túnica o aura, como los aspectos de Eclipse o los Testamentos de Hades II.
  - Título en el Grimorio.
  - Insignia "M7" en la pantalla de victoria. Para un streamer vale más que la esencia.

## 5. Avisos y legibilidad en móvil

- **Ventana de reacción**: hacen falta al menos unos 340 ms entre el aviso y el golpe: 100 ms de percepción, 70 de decisión, 70 de movimiento y margen ([Game Developer, DS3](https://www.gamedeveloper.com/blogs/anatomy-of-an-enemy-attack-in-dark-souls-3)).
- **Lo que Arcano ya avisa bien**:
  - Arquero: línea roja durante 0,6 s.
  - Embestidor y jefe: carril de carga de 0,65 y 0,75 s.
  - Bombardero: círculo durante 0,8 s.
  - Cultista: brillo durante 0,75 s.
  - Aparición de enemigos: 0,75 s.
  - Todo está en `drawTelegraphs`, línea 3200.
- **Lo que falta**:
  - Ráfaga apuntada del jefe: sale tras 0,25 s, a velocidad 300, sin aviso (línea 1974).
  - Anillo y espiral del jefe: sin aviso.
  - Reaparición del jefe tras teletransportarse y del espectro: 0,35 s, justo en el límite.
- **Colores que se confunden con los disparos del jugador**:
  - Bala del arquero `#ffcf4a` con la runa de rayo `#ffe45c`.
  - Bala del espectro `#bfe9ff` con la de hielo `#7fe3ff`.
  - Bala del tótem `#c9a8ff` con la arcana `#c77dff`.
  - El contorno oscuro (línea 3915) ayuda, pero si sube la densidad de balas conviene llevar todas las enemigas a una familia rojo/magenta.
- **Caja de impacto**: ahora la bala choca con el jugador a `b.r + player.r − 4` (línea 2385). En los shooters de balas, la caja de impacto es mucho más pequeña que el sprite ([TV Tropes, Danmaku](https://tvtropes.org/pmwiki/pmwiki.php/Main/Danmaku)). Si sube la densidad, pasar a −7.

## 6. Afijos de élite y fases de jefe (propuesta)

**Afijos de élite:** 1 afijo; 2 desde la sala 11 o con la escalera. Cada uno se marca con el color del aura y un icono sobre la barra (línea 3818).

| Afijo | Qué hace | Inspiración |
|---|---|---|
| Escudado | Burbuja que absorbe el 30% de su vida | Diablo 3 (Escudado), Isaac |
| Veloz | +35% de velocidad y temporizadores ×0,7 | Diablo 3, Isaac amarillo |
| Volátil | Al morir, 0,6 s de círculo de aviso y luego 8 balas lentas (140) | Isaac cian, RoR2 Glacial |
| Divisor | Al morir se parte en 2 copias con el 35% de su vida | Ya existe en `bigslime` |
| Sanador | Cura a los aliados cercanos un 4% por segundo | RoR2 Mending |
| Invocador | Cada 6 s, 2 murciélagos (como mucho 4) | Diablo 3 (Horda) |
| Charco | Deja un rastro de veneno o lava; usa `hz` y `HZ_INFO` | Diablo 3 (Fundido, Plagado) |
| Vengador | +15% de tamaño y daño por cada aliado que muere | Diablo 3 (Vengador) |

Mejor no usar: Reflejo, Carcelero, Invisible, ni teletransporte.

**Fases de jefe** (`updateBoss`, línea 1946):
- Al 50%: 1 s invulnerable con aviso, se limpian las balas y se añade un patrón nuevo a `pats`. Ejemplos:
  - Gólem: rocas que caen, avisadas con círculos durante 0,8 s.
  - Rey Slime: se divide.
  - Brujo: anillos dobles con hueco.
- El Señor de la Mazmorra tiene una tercera fase al 25%.

## 7. Doce recomendaciones, ordenadas por impacto

1. **Más vida para los jefes y fase 2 de verdad.** Gólem 480→720, Rey 1150→2000, Brujo 2600→5200, Señor 4700→11000 (`BOSSES`, línea 298), más la fase 2 del punto 6. Objetivo con build real y definitivo: 15–20 s en la sala 15 y 25–35 s en la 20, la meta de la propia spec.
2. **Curva de vida enemiga más empinada.** Cambiar `0.006(n−1)²` por `0.02(n−1)²` en `makeEnemy` (línea 1661): sala 11 ×5,0 (hoy 3,6); sala 16 ×8,5 (hoy 5,35); sala 18 ×10,2 (hoy 6,1). Las salas tempranas casi no cambian.
3. **Recortar las curas automáticas y mantener las elegidas.**
   - Corazón de enemigo normal: 6% → 3%. Jefe: 2 corazones → 1 (línea 2086).
   - Poción: peso 1,4 → 0,7, cura 40% → 30% (línea 318).
   - Drenar vida: 2% → 1% por baja (línea 324 y 2088).
   - Se mantienen la fuente del altar al 60% y el 25% tras el jefe.
   - Resultado: de unas 2,9 barras pasivas a unas 1,8.
4. **Afijos de élite** (tabla del punto 6): `makeElite` (línea 1676) y la probabilidad pasan a 0,15 + 0,008·sala (línea 2621). Es el cambio que más cambia la *sensación*, como el modo héroe de Archero o los campeones de Isaac.
5. **Escalera "Maldición 1–10"** por escuela, que se desbloquea al ganar con ella. Acumulativa, como la Ascensión, porque es más simple en móvil que el Pacto a la carta:
   - M1: +50% de élites.
   - M2: +15% de vida.
   - M3: jefes con su patrón extra desde el principio.
   - M4: −25% de curas.
   - M5: +20% de daño.
   - M6: empiezas al 85% de vida.
   - M7: +1 enemigo por sala.
   - M8: el altar ofrece 2 opciones.
   - M9: élites con 2 afijos.
   - M10: jefe final con fase 3.
   - Hace falta porque el Santuario y el equipo aplanan el reto de los veteranos.
6. **Avisos que faltan**: ráfaga apuntada del jefe con un abanico rojo de 0,35 s (línea 1974); anillo con un pulso de 0,4 s; marcador de 0,4 s donde va a reaparecer (líneas 2002 y 1870). Va antes de subir la densidad de balas.
7. **Penalización por proyectil.** Atravesar −25% por enemigo, Salto −25% por salto, Rebote −40% y sin vaciar `ar.hit` (`shotHit`, líneas 2293–2318). Los referentes de Archero son −33%, −30% y −50%. Recorta el poder contra grupos sin tocar el daño a un solo objetivo.
8. **Más agresividad tardía**: desde la sala 11, primer disparo con `rand(0.3,1.0)` (línea 1667) y cultista con una pausa de `rand(1.8,2.6)` (línea 1837).
9. **Una oleada de refuerzo**: en una de cada tres salas a partir de la 7, el 35% del presupuesto (`roomEnemies`, línea 1700) aparece con avisos cuando la primera oleada baja a la mitad. Solo una, por lo aprendido del capítulo 3 de Archero.
10. **Límites de defensa**: esquiva máxima 0,6 → 0,4 (línea 1457) e invulnerabilidad tras golpe 0,7 → 0,55 s (línea 1514). Daño enemigo `0.07` → `0.09` (línea 399), que en la sala 20 sube de ×2,33 a ×2,7.
11. **Recompensa sin inflar la economía**: botín único de 10 de esencia por nivel nuevo y escuela (máximo 500 en total), mejor rareza del equipo `+M` en los cofres, cosmético o título por M5 y M10, e insignia en la victoria. Ningún multiplicador de esencia por partida.
12. **Legibilidad y red de seguridad**: balas enemigas en la familia rojo/magenta, caja de impacto a −7 (línea 2385) y un "Modo Aprendiz" opcional (+20% de resistencia y +2% por muerte, como el Modo Dios de Hades). Así la base puede endurecerse sin perder a la audiencia casual.

**Cómo validarlo:** subir el objetivo de duración de `simChecks` (líneas 5468–5470) y medir con `dific-spec.js`. Un buen objetivo para el bot en modo dios: 4:00–5:30, y TTK de jefe de 15–35 s en la partida real, no solo en `bench`.

## Fuentes
- [Archero – Android Authority](https://www.androidauthority.com/archero-guide-heroes-abilities-1086651/)
- [Finding the Fun: Archero Part 1 (Game Developer)](https://www.gamedeveloper.com/design/finding-the-fun-archero-part-1---gameplay)
- [Finding the Fun: Archero Part 2 (Game Developer)](https://www.gamedeveloper.com/design/finding-the-fun-archero-part-2---progression)
- [Archero – fandom, Chapters](https://archero.fandom.com/wiki/Category:Chapters)
- [Archero Healing Guide – HubPages](https://discover.hubpages.com/games-hobbies/Archero-Healing-Guide)
- [Hades Pact – Prima](https://primagames.com/gaming/hades-guide-pact-of-punishment-modifiers-heat)
- [Hades Pact – RPG Site](https://rpgsite.net/feature/10287-hades-pact-of-punishment-heat-modifiers-and-how-to-maximize-your-rewards)
- [Hades God Mode – Can I Play That](https://caniplaythat.com/2021/08/11/hades-god-mode-explained-by-supergiant-games)
- [Slay the Spire Ascension – wiki.gg](https://slaythespire.wiki.gg/wiki/Ascension)
- [Isaac Hard Mode – wiki.gg](https://bindingofisaacrebirth.wiki.gg/wiki/Hard_Mode)
- [Isaac Champions – wiki.gg](https://bindingofisaacrebirth.wiki.gg/wiki/Champions)
- [Vampire Survivors Curse](https://vampire.survivors.wiki/w/Curse)
- [Brotato Dangers](https://brotato.wiki.spellsandguns.com/Dangers)
- [Brotato Enemies](https://brotato.wiki.spellsandguns.com/Enemies)
- [Brotato Elite Wave](https://brotato.wiki.spellsandguns.com/Elite_Wave)
- [RoR2 Difficulty](https://riskofrain2.wiki.gg/wiki/Difficulty)
- [RoR2 Eclipse](https://riskofrain2.wiki.gg/wiki/Eclipse)
- [Dead Cells Boss Stem Cells](https://deadcells.wiki.gg/wiki/Boss_Stem_Cells)
- [Dead Cells Malaise](https://deadcells.wiki.gg/wiki/Malaise)
- [Anatomy of an Enemy Attack in Dark Souls 3](https://www.gamedeveloper.com/blogs/anatomy-of-an-enemy-attack-in-dark-souls-3)
- [Diablo 3 elite affixes – Blizzard Watch](https://blizzardwatch.com/2015/07/11/combat-elite-monster-affixes-diablo-3/)
- [Game Wisdom – roguelikes accesibles](https://game-wisdom.com/?p=24881)
- [TV Tropes – Danmaku](https://tvtropes.org/pmwiki/pmwiki.php/Main/Danmaku)