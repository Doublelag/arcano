# Progresión de Archero (Habby, 2019): capítulos, modo héroe y propuesta para Arcano

## 1) Capítulos

**Estructura.** Para desbloquear el capítulo siguiente hay que superar **todas las salas en una sola partida**. Cada capítulo trae enemigos nuevos o variantes con otros movimientos y patrones de ataque ([gamedeveloper p2](https://www.gamedeveloper.com/design/finding-the-fun-archero-part-2---progression)). El juego **no tiene una sola plantilla de capítulo: alterna cuatro formatos**, y la dificultad sube con altibajos, no en línea recta:

| # | Nombre | Salas | Jefes | Ángel | Notas |
|---|---|---|---|---|---|
| 1 | Verdant Prairie | 50 | cada 10 | 5,15,25,35,45 | Sala de tesoro en las acabadas en 9 (oro, XP, 2 corazones, con pinchos o sierras). Unos 200 enemigos. "Muy fácil" |
| 2 | Storm Desert | 50 | cada 10 | igual | Estrena la ruleta inicial y el Mercader misterioso. Enemigos más rápidos |
| 3 | Abandoned Dungeon | 20 | cada 5 | 2,4,7,9,12,14,17,19 | Primer capítulo de **oleadas con temporizador** (si no limpias a tiempo, entra la siguiente). Sin cofres |
| 4 | Crystal Mines | 50 | 9,19…49 | 4,14… | El patrón se desplaza (cofre en las acabadas en 8) |
| 5 | Lost Castle | 50 | cada 10 | 5,15… | "Intermedio". Jefe final: Demonio |
| 6 | Cave of Bones | 20 oleadas | cada 5 | 8 ángeles | **Respiro**: "muy fácil" justo después del 5 |
| 7 | Barrens of Shadow | 10 | **todas** (9 jefes con esbirros, 2 en la sala 10) | ninguno | Ruleta tras cada sala. **El muro famoso** |
| 8 | Silent Expanse | 50 | cada 10 | 5,15… | Difícil, muchos muros |
| 9 | Frozen Pinnacle | 50 | cada 10 | 5,15… | |
| 10 | Land of Doom | 20 oleadas | cada 5 | 8 | |
| 11 | The Capital | 50 | cada 10 | | |
| 12 | Dungeon of Traps | 30 | cada 10 | 5,15,25 | Trampas. Corto y más fácil |
| 13 | Lava Land | 50 | cada 10 | | Jefe final fijo; los demás salen de un grupo de 6, así que **no ves todos en una partida** |
| 14 | Eskimo Lands | 10 | todas (desde la 5, **dos jefes a la vez**) | – | Tras cada jefe, diablo o ruleta. "Muy difícil" |
| 15 | Pharaoh's Chamber | 30 oleadas | cada 10 | | |
| 16 | Archaic Temple | 20 oleadas | cada 5 | | "Extremadamente difícil" |
| 17 | Dragon Lair | 30 | 10, 20 (doble), 30 | | |
| 18 | Escape Chamber | – | – | – | Del 19 y 20 no encontré los nombres. El 21 es Nightmare Land |

Fuentes: wiki por capítulo ([1](https://archero.fandom.com/wiki/Verdant_Prairie), [2](https://archero.fandom.com/wiki/Storm_Desert), [3](https://archero.fandom.com/wiki/Abandoned_Dungeon), [7](https://archero.fandom.com/wiki/Barrens_of_Shadow), [13](https://archero.fandom.com/wiki/Lava_Land), [14](https://archero.fandom.com/wiki/Eskimo_Lands), [17](https://archero.fandom.com/wiki/Dragon_Lair)) y [Version History](https://archero.fandom.com/wiki/Version_History). La wiki devuelve 402 desde el navegador; la leí por su API.

**Después.** El juego nunca dejó de añadir capítulos. Los normales llegaron al **94** en la v6.7.0 ([apkmirror](https://www.apkmirror.com/apk/habby/archero/archero-6-7-0-release/)) y los del modo héroe a **150** en la v7.9.0 de abril de 2026 ([App Store](https://apps.apple.com/us/app/-/id1453651052)).

**Jefes.** Cada capítulo tiene un **jefe final fijo** y **jefes intermedios sacados al azar de un grupo**. En el capítulo 1 hay 4 posibles: Giant Red Plant, Blue Tree Stump, Round Fire Dragon y Red Skull, y el final es Giant Blue Rock Golem. En el 2 el final es Giant Cactus, en el 3 Giant Electric Dragon, en el 4 Dark Angel y en el 5 Demon. Los jefes son **versiones gigantes de monstruos normales** y se reciclan en capítulos posteriores en versión **"Buffed"**, con un ataque extra: la planta pasa a lanzar un láser en 8 direcciones y el cactus añade una embestida con puñetazo. Más adelante aparecen en parejas ([jefes cap.1-2](https://archero.fandom.com/wiki/Verdant_Prairie_Bosses), [cap.5](https://archero.fandom.com/wiki/Lost_Castle_Bosses)).

**Ángel y diablo.**
- **Ángel:** da a elegir entre una habilidad menor (+20 % de vida, la mitad de una mejora de ataque…) o curarte.
- **Diablo:** sale **seguro tras un jefe si este no te ha tocado**; si te ha tocado, la probabilidad es baja. Cobra un 20 % de la vida máxima (un 30 % por la vida extra) a cambio de habilidades exclusivas: vida extra, multidisparo o atravesar muros.
- **Ruleta tras un jefe:** si no sale el diablo, da oro, una habilidad o curación.

Fuentes: [Angels](https://archero.fandom.com/wiki/Angels), [The Devil](https://archero.fandom.com/wiki/The_Devil), [Lucky Wheel](https://archero.fandom.com/wiki/Lucky_Wheel).

**Escalado entre capítulos.** No hay multiplicadores publicados. Uso como referencia la tabla de botín del barrido rápido (Quick Raid): la XP crece **unas 1,5 veces por capítulo** y el oro **unas 1,2 veces**. El **Héroe N da exactamente el botín del Normal N+3**: Héroe 1 da 453-680 de XP, igual que el capítulo normal 4 ([Quick raid](https://archero.fandom.com/wiki/Quick_raid)). La ruleta inicial da 300 × (capítulo − 1) de oro.

**Hitos y récord.**
- **Recompensas de hito, una sola vez por capítulo:** en el modo normal, 20 gemas y **5 de energía** al llegar a las salas 10, 20, 30 y 40, y 50 gemas en la 50, con alguna llave dorada u obsidiana suelta ([Stage Rewards](https://archero.fandom.com/wiki/Stage_Rewards)).
- **El progreso cuenta aunque mueras:** llegar a la sala 30 y caer ya cobra los hitos 10, 20 y 30. Eso es el récord por capítulo.
- **Barrido rápido:** tras superar un capítulo 5 veces se puede completar al instante y cobrar el botín.

**Energía.** Cada partida cuesta 5 de energía. Se recupera 1 cada 12 minutos, con un tope de 20 (4 horas para llenarla). Hay +5 por anuncio (4 al día) y 20 por 100 gemas. El pase de pago sube el tope a 30. Los eventos largos cuestan 15 ([Energy](https://archero.fandom.com/wiki/Energy), [udonis](https://www.blog.udonis.co/mobile-marketing/mobile-games/archero-monetization)).

**El progreso de capítulos desbloquea funciones:** los eventos diarios se abren al superar el capítulo 3 ([v1.2.5](https://www.apkmirror.com/apk/habby/archero/archero-1-2-5-release/)) y el modo héroe en la sala 25 del capítulo 4. Más adelante Habby metió **habilidades nuevas propias de capítulos concretos**: 13 y 17 en la [v4.12.3](https://www.apkmirror.com/apk/habby/archero/archero-4-12-3-release/), y 12, 20 y 22 en otra versión.

## 2) Modo héroe

Fuentes de este bloque: [v1.1.4](https://www.apkmirror.com/apk/habby/archero/archero-1-1-4-release), [LevelSkip vía archive.org](https://web.archive.org/web/2021/https://levelskip.com/mobile/Archero-Hero-Mode-Guide), [AndroidAuthority](https://www.androidauthority.com/archero-guide-heroes-abilities-1086651/), [Quick raid](https://archero.fandom.com/wiki/Quick_raid), [Stage Rewards](https://archero.fandom.com/wiki/Stage_Rewards).

- **Desbloqueo:** al llegar a la sala 25 del capítulo 4 (v1.1.4). Es un interruptor en la pantalla principal que cambia la lista entera de capítulos y **obliga a subir otra vez desde el 1**.
- **Cuánto más difícil es:** un capítulo héroe equivale a **2-4 capítulos normales más** (Héroe 1 se siente como el Normal 4). El botín lo confirma con +3 exacto.
- **Qué cambia:**
  1. Más vida y más ataque en todos los monstruos.
  2. **Monstruos "héroe" al azar en cada sala:** barra de vida morada, icono de jefe, más grandes y **con un movimiento que normalmente no tienen**, a menudo tomado de su versión jefe. El murciélago embiste soltando un anillo de balas, el cactus embiste, la planta dispara en oleadas, el gólem hace una embestida giratoria, el fantasma se teletransporta y el tornado lanza tres en vez de uno.
  3. **Jefes con ataques modificados:** láser bifurcado, varias embestidas cortas en lugar de una.
  4. Más obstáculos y pinchos.
- **Recompensas:**
  - **Hitos propios de primera vez:** gemas, 5-15 pergaminos de equipo por hito, llaves y 20-30 zafiros al final.
  - **En cada partida no hay un premio extra:** da lo mismo que un capítulo normal de dificultad equivalente. AndroidAuthority recomienda limpiarlo una vez por los hitos y no usarlo para farmear.
- **Cuántos hay:** se lanzó con 3 capítulos y luego fue más lento que el modo normal (4-5, 6-7, 8-9, 10, 11, 12-14, 17…). Llegó a 120 y después a **150**.

## 3) Otros modos (una línea cada uno)

- **Up-Close Dangers:** 20 salas casi solo cuerpo a cuerpo; ángel en 5, 9, 15 y 19; jefes al azar en 10 y 20. Da mucho oro y XP aunque no lo acabes ([wiki](https://archero.fandom.com/wiki/Up-close_Dangers)).
- **Flying Bullets:** el gemelo con enemigos a distancia y lluvia de proyectiles. Alterna con el anterior: según guías, uno al día y los dos el domingo; las entradas gratis son limitadas ([v4.7.0](https://www.apkmirror.com/apk/habby/archero/archero-4-7-0-release/); el calendario no lo pude confirmar en una fuente primaria).
- **Infinite / Hero Adventure:** sin fin, 15 de energía, 3 héroes que comparten habilidades, jefe cada 10 y ángel cada 5. Un mago ofrece mejoras con contrapartida ("menos vida a los monstruos, menos XP"). La dificultad es **fija**, no escala con tu progreso, y se guarda el **récord por temporada** con premios cada 10 salas entre la 50 y la 200 ([wiki](https://archero.fandom.com/wiki/Infinite_Adventure)).
- **Evil Dungeon:** 9 salas de 3 jefes, uno cada 30 s y 150 s de límite, más 8 salas de mejora donde sale el ángel o el **Mago maligno**. Este te deja **elegir una mejora para los jefes a cambio de más botín** (por ejemplo, "Élite": +20 %) ([wiki](https://archero.fandom.com/wiki/Evil_Dungeon)).
- **Ancient Maze:** 100 salas **sin tu equipo**. Eliges portal según riesgo y botín: verde, azul, morado, o naranja con cofres. Hay una moneda propia de la partida para comprar equipo y habilidades, y al completarlo se abre un selector de dificultad ([wiki](https://archero.fandom.com/wiki/Ancient_Maze)).
- **Hero Duo:** cooperativo de 100 niveles; solo 3 intentos al día dan premio ([wiki](https://archero.fandom.com/wiki/Hero_Duo)).
- **Expedition:** cientos de pisos cortos para runas ([wiki](https://archero.fandom.com/wiki/Expedition_Mode)).
- **Infinite Challenge:** semanal. **Quick Raid:** barrido rápido.

## 4) Por qué funciona y qué se critica

**Lo que funciona:**
- Núcleo simple con una progresión de cuenta simple ([gameanalytics](https://www.gameanalytics.com/blog/six-games-that-successfully-layer-in-meta-mechanics)).
- **Cada capítulo enseña patrones nuevos**, así que mejoras como jugador y en estadísticas a la vez ("not only improving their stats but their skills", [gamedeveloper p2](https://www.gamedeveloper.com/design/finding-the-fun-archero-part-2---progression)).
- Los hitos hacen que **morir también haga avanzar**.
- La ruleta sirve como mecanismo de alcance si vas por detrás.
- La alternancia de formatos (50, 20 de oleadas, 10 de jefes, 30) rompe la monotonía.
- El modo héroe da **el doble de contenido reutilizando escenarios**: solo añade comportamientos.
- Nunca obliga a pagar ([gamedeveloper p3](https://gamedeveloper.com/design/finding-the-fun-archero-part-3---monetization)).

**Lo que se critica** (estimación de las reseñas de [justuseapp](https://justuseapp.com/en/app/1453651052/archero/reviews)):
- **Energía (~25 % de las quejas):** "terrible business practice".
- **Muro de equipo y pago para ganar (~20 %):** "$1000 at least to get your gear leveled up".
- **Saltos de dificultad (~20 %):** el capítulo 7 se volvió legendario; la [FAQ de la wiki](https://archero.fandom.com/wiki/Frequently_Asked_Questions) dice que la gente acababa pagando o haciendo trampas. Habby tuvo que **bajar la dificultad varias veces**: capítulos 1, 2 y 7-12; 16-40 ([v4.7.0](https://www.apkmirror.com/apk/habby/archero/archero-4-7-0-release/)); 34 ([v4.12.3](https://www.apkmirror.com/apk/habby/archero/archero-4-12-3-release/)).
- **Azar en las habilidades:** "some abilities are useless".
- **Monetización agresiva:** gacha con solo 16 piezas de equipo y revivir por 30 gemas con 5 segundos para decidir.
- **Farmeo degenerado:** como la ruleta inicial escala con el capítulo, compensaba **morirse rápido** para cobrar oro ([androidayuda](https://en.androidayuda.com/?p=228403)).

**Para un juego gratis:**
- **Copiar:** formatos que rotan, jefes reciclados en versión mejorada, monstruos héroe, hitos de primera vez, récord por capítulo y riesgo opcional a cambio de botín.
- **Evitar:** energía, muros que dependen del equipo, recompensas por empezar una partida y saltos que luego hay que parchear.

## 5) Propuesta para Arcano (partidas de 5-10 min, sin compras)

Lo que hay hoy (20 salas, jefes en 5/10/15/20, altares en 4/9/14/19 y daño ×(1+0,07·(sala−1)) en `E:\PROYECTOS\arcano\public\game.js:399`) ya es en la práctica **un "capítulo arena" de Archero**. La propuesta es partirlo en capítulos cortos.

**Al lanzar: 8 capítulos normales y 8 héroe.** Cada capítulo es un bioma con su plantel de enemigos (más 1-2 del bioma anterior), un jefe final fijo y jefes intermedios sacados al azar de los ya vistos, en versión mejorada. Rotan los formatos:

| Cap | Formato | Salas | Jefes | Altar |
|---|---|---|---|---|
| 1 Pradera | estándar | 12 | 6 (mini), 12 | 5, 11 |
| 2 Cripta | estándar | 15 | 5, 10, 15 | 4, 9, 14 |
| 3 Cristal | oleadas con temporizador | 10 | 5, 10 | 2, 4, 7, 9 |
| 4 Volcán | estándar | 15 | 5, 10, 15 | 4, 9, 14 |
| 5 Pradera nocturna (remezcla) | estándar con trampas | 15 | 5, 10, 15 | 4, 9, 14 |
| 6 Cripta (respiro) | oleadas | 10 | 5, 10 | 3, 7 |
| 7 "Prueba de los Archimagos" | **solo jefes** | 8 | todas | ninguno; pacto o curación tras cada jefe. Es **el muro de habilidad** |
| 8 Corazón del volcán | estándar con dobles jefes desde la 10 | 15 | 5, 10, 15 | 4, 9, 14 |

**Dificultad:**
- Dentro del capítulo: +5 % por sala.
- Entre capítulos: vida ×1,18^(c−1) y daño ×1,12^(c−1).
- **Pacto con el diablo:** que salga seguro si el jefe no te ha tocado, como en Archero. Premia jugar bien sin inflar nada.
- **Desbloqueo:** el capítulo c+1 se abre al completar el c entero en una partida.
- **Récord:** se guarda la mejor sala por capítulo y modo.

**Modo héroe:**
- Se abre al llegar a la mitad del capítulo 4 o al completar el 3.
- El héroe N exige haber completado el normal N y el héroe N−1.
- Estadísticas del normal N+3 (vida ≈ ×1,6).
- Cada sala convierte 1-2 enemigos en **élite héroe** (barra morada y un ataque prestado de su jefe). Arcano ya tiene élites.
- Jefes con un ataque más y más trampas.
- Sirve como respuesta directa a que el juego es fácil, sin castigar a quien empieza.

**Recompensas sin inflar la economía:**
- **Esencia solo por salas superadas**, nunca por empezar partida (evita el farmeo de morirse rápido). Sube suave por capítulo (+10 %/capítulo) y en héroe equivale a la del normal c+3, sin bonus extra.
- **Hitos de primera vez** en cada tercio del capítulo: un poco de esencia fija más algo **no económico** (página del Grimorio, título, aspecto de forma, escuela). El total de los 16 capítulos debería equivaler a pocas partidas buenas, no a semanas de mejoras.
- **Nada de energía.** Si se quiere más vida útil:
  - **Desafío diario** con semilla fija y mutador opcional al estilo del Mago maligno: maldición a cambio de +X % de esencia, con tope.
  - **Sin fin semanal** con récord, dificultad fija y premios cosméticos por tramos.
- Ritmo de contenido: ir añadiendo capítulos de dos en dos y no prometer 50.