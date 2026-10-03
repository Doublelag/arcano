# Arcano

Roguelite de mazmorras **de magia** para móvil y PC (inspirado en Archero). HTML5 + canvas, sin dependencias ni build.
El primer juego de **Doublelag Games**.

**Jugar:** https://arcano.comparador-hosting.workers.dev

- **Muévete** para esquivar, **quédate quieto** y lanzas hechizos al enemigo más cercano.
- **5 escuelas de magia** (elemento base + hechizo definitivo):
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
- **Hechizo definitivo** con maná: botón abajo a la derecha o `Espacio`/`E`.
- **Santuario**: mejoras permanentes compradas con la esencia que ganas en cada partida (vida, poder, maná inicial, experiencia, cambio de cartas, velocidad, pluma de fénix) y escuelas nuevas.
- 20 salas al azar, **altares** antes de cada jefe (curar, subir de nivel o cargar el definitivo), jefes en 5/10/15/20 y **élites** desde la sala 6.
- 9 enemigos: slime, slime gigante (se divide), murciélago, arquero goblin, jabalí, cultista, diablillo bomba, tótem rúnico y espectro.
- **4 biomas** (uno por capítulo, estilo Archero): Pradera esmeralda, Cripta de los susurros, Gruta de cristal y Corazón volcánico, con suelos, muros, obstáculos, decoración y partículas ambientales propios (`biomes.js`).
- **Gráficos con volumen**: personajes sombreados como esferas, sombras suaves, brillos aditivos, números de daño que saltan, retroceso al golpear, cámara lenta al matar a un jefe.
- **Intro de Doublelag Games**, pantalla de "toca para empezar" (desbloquea el audio en móvil) y menú animado.
- **Música procedural** (`music.js`): temas de menú, mazmorra, jefe, victoria y derrota, sin archivos de audio.
- **Ajustes**: volumen de música y efectos, vibración, temblor de pantalla, números de daño, modo zurdo, calidad gráfica, FPS, repetir tutorial y borrar progreso.
- **Tutorial** en la primera partida, **17 logros** con recompensa de esencia, **estadísticas** y **créditos**.
- **App instalable (PWA)**: manifest, iconos propios y service worker (red primero, funciona sin conexión).

## Archivos

- `public/game.js`: todo el juego (datos, IA, combate, render, pantallas)
- `public/music.js`: motor de música procedural (`window.ArcanoMusic`)
- `public/biomes.js`: fondos de sala por bioma (`window.ArcanoBiomes`)
- `public/style.css`: pantallas y botones
- `public/sw.js`, `public/manifest.webmanifest`, `public/icons/`, `public/assets/`: app instalable y marca

## Jugar en local

```bash
python -m http.server 5191 --directory public
```

Abre http://localhost:5191. Controles: arrastrar el dedo (joystick flotante) o WASD/flechas. `P`/`Esc` pausa, `1`-`5` eligen carta.

## Publicar

```bash
wrangler deploy
```

## Depuración

Con `?debug` en la URL, `window.__arcano` expone `step(seg)`, `pick(i)`, `give(id, n)`, `goto(sala)`, `toDoor()`, `god()`, `ult()` y `seen()` para simular partidas sin depender de `requestAnimationFrame`.
