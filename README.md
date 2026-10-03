# Arcano

Roguelite de mazmorras **de magia** para móvil y PC (inspirado en Archero). HTML5 + canvas, sin dependencias ni build.

- **Muévete** para esquivar, **quédate quieto** y lanzas hechizos al enemigo más cercano.
- **Escuelas de magia**: al empezar eliges Piromante 🔥, Criomante ❄️ o Electromante ⚡ (elemento base + hechizo definitivo).
- **Reacciones elementales** al combinar runas sobre un enemigo:
  - Fuego + Hielo = **Vapor** (golpe de daño triple)
  - Fuego + Rayo = **Sobrecarga** (explosión en área)
  - Hielo + Rayo = **Congelación** (bloquea al enemigo, recibe +30% daño)
  - Fuego + Veneno = **Combustión** (nube tóxica que contagia)
- **Hechizo definitivo** con maná (bajas, daño al jefe y regeneración): Meteoro, Ventisca o Tormenta. Botón abajo a la derecha o `Espacio`/`E`.
- 20 salas generadas al azar, jefes en las salas 5, 10, 15 y 20 (con fase de furia al 50%).
- 22 habilidades: proyectiles extra, eco arcano, abanico, salto arcano, runas elementales, orbes guardianes, canalización…

## Jugar en local

```bash
python -m http.server 5191 --directory public
```

Abre http://localhost:5191. Controles: arrastrar el dedo (joystick flotante) o WASD/flechas. `P`/`Esc` pausa, `1`-`3` eligen carta.

## Depuración

Con `?debug` en la URL, `window.__arcano` expone `step(seg)`, `pick(i)`, `give(id, n)`, `goto(sala)`, `toDoor()`, `god()`, `ult()` y `seen()` para simular partidas sin depender de `requestAnimationFrame`.
