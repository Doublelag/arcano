# Arcano

**Roguelite de mazmorras de magia para móvil y PC, inspirado en Archero.** Elige tu escuela, combina runas elementales para provocar reacciones y abre paso sala a sala hasta el Señor de la Mazmorra. Todo en HTML5 + canvas, sin dependencias ni paso de build.

El primer juego de **Doublelag Games**.

**Jugar:** https://arcano.comparador-hosting.workers.dev

<!-- CAPTURA AQUÍ -->
> 📸 CAPTURA AQUÍ (partida en curso en vertical, por ejemplo una sala con élites y el botón del definitivo cargado)

## Características

- **Control de una mano**: muévete para esquivar y, al quedarte quieto, lanzas hechizos al enemigo más cercano (joystick flotante, WASD o flechas).
- **5 escuelas de magia**, cada una con su elemento base y su hechizo definitivo:
  - 🔥 Piromante — Meteoro
  - ❄️ Criomante — Ventisca
  - ⚡ Electromante — Tormenta
  - ☠️ Pestilente — Plaga *(se desbloquea en el Santuario)*
  - 🔮 Arcanista — Singularidad *(se desbloquea en el Santuario)*
- **Reacciones elementales** al combinar runas sobre un enemigo:
  - Fuego + Hielo = **Vapor** (golpe de daño triple)
  - Fuego + Rayo = **Sobrecarga** (explosión en área)
  - Hielo + Rayo = **Congelación** (bloquea al enemigo, recibe +30% daño)
  - Fuego + Veneno = **Combustión** (nube tóxica que contagia)
  - Rayo + Veneno = **Corrosión** (+40% de daño recibido durante 4 s)
- **Despertar** (`forms.js`): el Ánima se llena durante la partida y despierta formas elementales (10 en total, combinando los 4 elementos), con Afinidad, Mezclas secretas (una runa más una carta concreta) y un **Grimorio** que las va apuntando.
- **Hechizo definitivo** con maná: botón abajo a la derecha o `Espacio`/`E`.
- **Capítulo 1 de 20 salas** al azar, con altares antes de cada jefe (curar, subir de nivel o cargar el definitivo), jefes en las salas 5/10/15/20, élites con afijos (veloz, escudado, volátil, invocador), refuerzos, trampas y cofres. La estructura de capítulos y el **Modo Héroe** están preparados en `chapters.js`.
- **Equipo** (`equipment.js`): 4 huecos (bastón, túnica, anillo, amuleto), 5 rarezas, perks y fusión 3→1.
- **Santuario**: mejoras permanentes con la esencia que ganas en cada partida (vida, poder, maná inicial, experiencia, cambio de cartas, velocidad, pluma de fénix) y escuelas nuevas.
- **9 enemigos**: slime, slime gigante (se divide), murciélago, arquero goblin, jabalí, cultista, diablillo bomba, tótem rúnico y espectro.
- **4 biomas** (estilo Archero): Pradera esmeralda, Cripta de los susurros, Gruta de cristal y Corazón volcánico, con suelos, muros, obstáculos, decoración y partículas propios (`biomes.js`).
- **Gráficos con volumen**: personajes sombreados como esferas, sombras suaves, brillos aditivos, números de daño, retroceso al golpear y cámara lenta al matar a un jefe.
- **Música procedural** (`music.js`): temas de menú, mazmorra, jefe, victoria y derrota, sin archivos de audio.
- **Ajustes**: volumen de música y efectos, vibración, temblor de pantalla, números de daño, modo zurdo, calidad gráfica, FPS, repetir tutorial y borrar progreso.
- **Tutorial** en la primera partida, **logros** con recompensa de esencia, **estadísticas** y **créditos**.
- **Intro de Doublelag Games**, pantalla de "toca para empezar" (desbloquea el audio en móvil) y menú animado.
- **App instalable (PWA)**: manifest, iconos propios y service worker (red primero, funciona sin conexión).

## Tecnología

- **JavaScript puro** (scripts clásicos, sin frameworks ni bundler) y **Canvas 2D** para todo el render.
- **Web Audio API** para la música y los efectos, generados en tiempo real.
- **PWA**: `manifest.webmanifest` + `sw.js` (estrategia red primero con caché de respaldo).
- **Cloudflare Workers** (archivos estáticos) para publicar, configurado en `wrangler.jsonc`.
- El progreso se guarda en una cookie compacta en el propio navegador; no hay servidor ni cuentas.
- **Node.js** solo para las pruebas y las herramientas de desarrollo (sin dependencias de npm).

## Jugar en local

No hace falta instalar nada: basta con servir la carpeta `public/`.

```bash
python3 -m http.server 5191 --directory public
# o bien: npm start
```

Abre http://localhost:5191.

**Controles:** arrastrar el dedo (joystick flotante) o WASD/flechas para moverte. `Espacio`/`E` lanza el definitivo, `P`/`Esc` pausa y `1`-`5` eligen carta.

## Pruebas

```bash
npm test
```

Ejecuta, con Node 18 o superior y sin instalar dependencias:

- `tools/check.mjs`: comprueba que todos los JS de `public/` se pueden analizar, que existen todos los archivos que enlaza `index.html`, los iconos del manifest y la lista de precaché del service worker, y que `wrangler.jsonc` publica `public/`.
- `tools/test-chapters.mjs`: pruebas de la lógica pura de capítulos, Modo Héroe, récords y migración de guardados (`chapters.js`).
- `tools/test-forms.mjs`: pruebas de la lógica pura del Despertar (`forms.js`).

Las mismas pruebas se ejecutan en GitHub Actions en cada push a `main` y en cada pull request (`.github/workflows/test.yml`).

## Publicar (Cloudflare)

El proyecto se publica como un Worker de Cloudflare que solo sirve archivos estáticos: `wrangler.jsonc` sube la carpeta `public/` tal cual.

```bash
npx wrangler login     # la primera vez
npx wrangler deploy
```

Si cambias la lista de archivos del juego, actualiza también `PRECACHE` en `public/sw.js` (la prueba `tools/check.mjs` avisa si falta algún script).

## Estructura del proyecto

```
public/                 Lo que se publica
  index.html            Página única: canvas, HUD y carga de scripts
  game.js               El juego: datos, IA, combate, render y pantallas
  chapters.js           Capítulos, Modo Héroe y progreso (lógica pura, window.ArcanoChapters)
  forms.js              Despertar: formas, Afinidad y Mezclas (window.ArcanoForms)
  equipment.js          Equipo: huecos, rarezas, perks y fusión (window.ArcanoGear)
  biomes.js             Fondos de sala por bioma (window.ArcanoBiomes)
  music.js              Música procedural (window.ArcanoMusic)
  style.css             Pantallas y botones
  sw.js, manifest.webmanifest, icons/, assets/, og-image.png   App instalable y marca
tools/                  Pruebas y herramientas de desarrollo
  check.mjs, test-*.mjs Pruebas que ejecuta npm test
  cdp.mjs, bots.js, esquivador.js, smoke.js, ...   Bots y scripts de balance por Chrome DevTools
  baseline/, esquivador-out/   Resultados de referencia de los bots
docs/                   Especificaciones de diseño, investigación y revisiones
wrangler.jsonc          Configuración de Cloudflare
```

Las herramientas de `tools/` que lanzan Chrome (`cdp.mjs` y los scripts que usa) tienen rutas de Windows del equipo de desarrollo; `CDP_URL` y `CDP_PORT` se pueden cambiar por variables de entorno.

## Depuración

Con `?debug` en la URL, `window.__arcano` expone `step(seg)`, `pick(i)`, `give(id, n)`, `goto(sala)`, `toDoor()`, `god()`, `ult()` y `seen()` para simular partidas sin depender de `requestAnimationFrame`.

## Cómo se hizo

Arcano está hecho con IA ("vibe coding") por Doublelag usando **Claude Code**: el diseño, el código, el balance y la documentación salen de iterar con el asistente. El proceso se ve en el propio repositorio:

- `docs/` guarda las especificaciones (progresión, capítulos, Despertar), la investigación sobre Archero y otros roguelites y las revisiones de cada fase.
- Para ajustar la dificultad se usan **bots** que juegan partidas completas en Chrome sin ventana: el *esquivador* (`tools/esquivador.js`) imita a un jugador humano razonable y sus resultados (`tools/baseline/`, `tools/esquivador-out/`) sirven para calibrar la vida de los jefes, la densidad de enemigos y las curas.
- El historial de commits sigue las fases del desarrollo (Fase 0 a Fase 4, Despertar, etc.).
