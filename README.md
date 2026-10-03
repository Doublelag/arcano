# Arquero

Roguelite de mazmorras estilo **Archero** para móvil y PC. HTML5 + canvas, sin dependencias ni build.

- **Muévete** para esquivar, **quédate quieto** y disparas solo al enemigo más cercano.
- 20 salas generadas al azar (rocas simétricas, siempre con camino a la puerta).
- Jefes en las salas 5, 10, 15 y 20: Gólem de Piedra, Rey Slime, Brujo Sombrío y Señor de la Mazmorra (con fase de furia al 50%).
- 5 enemigos: slime, murciélago, arquero goblin, jabalí (embiste) y hechicero (anillos de balas).
- Cada nivel: elige 1 de 3 habilidades entre 21 (flecha frontal, disparo múltiple, diagonales, rebote, atravesar, fuego, hielo, veneno, rayo, espadas giratorias, sed de sangre…).
- Sonido sintetizado con WebAudio, récord guardado en el navegador.

## Jugar en local

```bash
python -m http.server 5191 --directory public
```

Y abre http://localhost:5191. Controles: arrastrar el dedo (joystick flotante) o WASD/flechas. `P`/`Esc` pausa, `1`-`3` eligen carta.

## Depuración

Con `?debug` en la URL, `window.__arquero` expone `step(seg)`, `pick(i)`, `give(id, n)`, `goto(sala)`, `toDoor()` y `god()` para simular partidas sin depender de `requestAnimationFrame`.

## Archivos

- `public/index.html`: contenedor
- `public/style.css`: pantallas (menú, cartas de habilidad, pausa, fin)
- `public/game.js`: todo el juego (datos, IA, físicas, render, UI)
