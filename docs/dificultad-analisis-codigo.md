**Informe: dificultad de Arcano (copia estable `E:\PROYECTOS\arcano-snap\public`)**

Resumen: el juego es fácil en todas las salas, no a partir de una concreta. Un bot que se queda quieto y no esquiva nunca, sin ninguna mejora del Santuario, recibe de media 0,4–0,8 golpes por sala normal y 1,4–3,5 por jefe. Gana en unos 3:03 de mediana con el Despertar, casi el mismo tiempo que Double (Arcanista 2:43, Electromante 3:02, nivel 14). Con una inversión modesta en el Santuario y 4 objetos raros, ese bot quieto sobrevive en 37 de cada 40 partidas. Con el Santuario al máximo y 4 épicos recibe 58 de daño en toda la partida.

Cómo lo he medido: lectura del código más 160 partidas en Chrome sin ventana. El bot es mío: elige cartas con el `botPick` del juego, usa el definitivo y no esquiva. La vida está instrumentada para no bajar de 1 y registrar cada golpe y cada cura. He probado 4 perfiles de jugador con 5 escuelas y 8 semillas cada uno:
- **fresh-apr**: sin mejoras y sin despertar.
- **fresh-forms**: sin mejoras, con despertar a forma doble.
- **mid**: Santuario vida 2, poder 2, maná 1, sabiduría 1, más 4 objetos raros.
- **vet**: Santuario al máximo más 4 épicos.

No he editado nada del juego ni de `E:\PROYECTOS\arcano`.

---

## 1. Enemigos (`game.js` 200-217, 1660-1921)

| Enemigo | Vida | Velocidad | Daño contacto | Ataque | Sala de aparición |
|---|---|---|---|---|---|
| Slime | 20 | 78, pero ~41 px/s efectivos por el salto (`hop` media 0,52, l.1779) | 10 | — | 1 |
| Murciélago | 12 | 112 con zigzag ±0,9 rad; rebota tras tocarte (l.1916) | 8 | — | 1 |
| Arquero | 18 | 62 | 12 | 1 bala apuntada a 290+4·sala px/s; desde la sala 9, 3 balas a ±0,22 rad. Ciclo ~2,3 s (moverse 1,1-1,9 s + apuntar 0,6 s) (l.1792) | 2 |
| Embestidor | 34 | 50 | 16 | Carga 0,65 s y embiste a 500 px/s durante 0,6 s; descansa 0,6 s más 1,2-2,2 s (l.1809) | 3 |
| Cultista (mago) | 28 | 34 | 11 | Anillo radial de 8+2·⌊sala/5⌋ balas a 165+3·sala px/s, tras cargar 0,75 s. Ciclo ~3,6 s (l.1828) | 4 |
| Slime grande | 55 | 52 (~27 efectivos) | 16 | Se divide en 2 slimes al morir | 6 |
| Diablillo bomba | 22 | 100 | 24 solo al explotar | A menos de 72 px enciende la mecha 0,8 s y explota en r80 (l.1842, 2128) | 6 |
| Tótem | 45 | 0 | 0 (es un pilar) | Cruz de 4 balas (6 desde la sala 15) cada 1,3 s (0,95 s desde la 14), girando 0,38 rad por ráfaga (l.1855) | 7 |
| Espectro | 24 | 30 | 12 | Se desvanece 0,35 s, reaparece a 150-230 px de ti y dispara 3 balas (5 desde la sala 15) apuntadas a 210 px/s. Ciclo ~2,9 s (l.1866) | 11 |

- **Escalado por sala:**
  - vida `hm = 1 + 0,2(n−1) + 0,006(n−1)²` (l.1661): ×1 / 1,90 / 3,29 / 4,98 / 6,97 en las salas 1/5/10/15/20.
  - daño `dmgMul = 1 + 0,07(n−1)` (l.399): ×1 / 1,28 / 1,63 / 1,98 / 2,33.
- **Cuántos salen (`roomEnemies` l.1697):**
  - Presupuesto 3,5 + 0,55·n; coste por enemigo 1-2,5; topes por sala: tótem 2, espectro 3, bomba 3, slime grande 2; máximo 11 enemigos, que nunca se alcanza.
  - **No hay oleadas**: todos aparecen a la vez, a más de 300 px del jugador y en las filas de arriba (fila < 15, l.2613). Tienen 0,75 s + 0,05·i de aparición (l.1666).
- **Élites (l.2621, 1676):**
  - Desde la sala 6, como mucho 2 por sala, con probabilidad 0,1 + 0,006·sala por enemigo (13,6-20,8%).
  - Vida ×2,2, daño ×1,25, experiencia ×2, 30% de soltar corazón.
- **Composición media** (Monte Carlo de 20.000 salas, `tools/dif-rooms.mjs`):

| Sala | Enemigos | Vida total | Élites | Tiradores | Experiencia |
|---|---|---|---|---|---|
| 1 | 4,0 | 64 | 0 | 0 | 10 |
| 3 | 3,7 | 104 | 0 | 0,8 | 11 |
| 8 | 4,9 | 473 | 0,7 | 1,7 | 20 |
| 13 | 6,2 | 963 | 1,0 | 2,6 | 26 |
| 18 | 8,0 | 1806 | 1,35 | 3,4 | 34 |

- **Solo hay 12 salas normales** (1-3, 6-8, 11-13, 16-18), más 4 de altar y 4 de jefe.
- **Aviso previo de cada ataque:**
  - Arquero apunta 0,6 s; la dirección se fija 0,15 s antes de disparar.
  - Embestidor carga 0,65 s (fija 0,2 s antes); cultista 0,75 s; mecha de la bomba 0,8 s; espectro 0,7 s entre desaparecer y reaparecer.
  - El primer disparo enemigo llega como pronto entre 1,35 y 2,35 s después de entrar en la sala.

## 2. Jefes (l.298-303, 1685, 1924-2034)

**Comunes a todos:**
- Daño de bala 14·dmgMul y de contacto ×1,4.
- Anillo de 12+3·nivel de jefe balas (+4 con furia); 3 anillos separados 0,42 s, a 175+12·nivel px/s.
- **Espiral**: 2,2 s disparando 3 brazos (4 en el Señor) cada 0,075 s, es decir, 88-117 balas.
- **Apuntado**: 3 abanicos de 5 balas a 300 px/s.
- **Embestida**: carga 0,75 s, 2 embestidas a 560 px/s; desde el Rey Slime hace un anillo al chocar.
- **Invocación**: 3 slimes (murciélagos desde el Brujo).
- **Teletransporte**: reaparece a más de 230 px y lanza un anillo.
- Pausa entre ataques: (0,9-1,5 s − 0,1·nivel) ×0,7 con furia.
- **Una sola fase**: la furia al 50% de vida, que solo añade +4 balas por anillo y −30% de pausa.

| Jefe | Vida | Bala / contacto | Patrones |
|---|---|---|---|
| Gólem (5) | 480 | 17,9 / 25,1 | anillo, embestida, apuntado |
| Rey Slime (10) | 1150 | 22,8 / 31,9 | invocación, anillo, embestida, apuntado |
| Brujo (15) | 2600 | 27,7 / 38,8 | espiral, teletransporte, apuntado, invocación, anillo |
| Señor (20) | 4700 | 32,6 / 45,7 | los 6 |

**Tiempo real de pelea, sin contar la entrada cinematográfica de 2,4 s:**
- fresh-forms: 6,6 / 9,0 / 11,6 / 11,8 s.
- vet: 2,5 / 3,7 / 4,6 / 5,6 s.
- Objetivo de la spec (§7.3): Brujo 15-20 s y Señor 25-35 s.
- Cada jefe solo llega a hacer 2-5 ataques.

## 3. Trampas (l.257-264, 1611-1614, 2500-2538)

- Solo hacen daño dos:
  - **pinchos**: 10·dmgMul cuando están arriba (0,9 s de cada ciclo de 3 s).
  - **lava** (volcán, salas 16-20): 7·dmgMul cada 0,6 s, unos 11,7·dmgMul por segundo.
- El charco venenoso de la cripta solo ralentiza (−40%); el hielo del cristal solo hace resbalar.
- Aparecen desde la sala 3, salvo en altares, con 60% de probabilidad y 2-3 grupos. Nunca en la zona donde apareces ni delante de la puerta.
- Se saltan escudo, esquiva e invulnerabilidad (l.1484). Aun así, un jugador quieto nunca las pisa.

## 4. Supervivencia

**Vida y defensa:**
- Vida inicial 100 + 10 por nivel del Santuario + vida del equipo (l.763).
- Carta Vitalidad: +25 de vida máxima y cura 25.
- Invulnerable 0,7 s tras recibir un golpe (l.1514), 0,3 s tras esquivar, 0,6 s tras gastar el escudo y 1,4 s durante el despertar (l.1481).
- Esquiva: 8% por nivel de carta, tope 60%. Fénix: revives con 50% de vida, 2,5 s invulnerable y una explosión de 5×daño (l.1528).
- La transformación del despertar borra todas las balas (l.958).

**Curas:**
- Corazón: 15% de la vida máxima (l.2399). Lo suelta el 6% de las bajas normales, el 30% de las élites y siempre 2 cada jefe (l.2086). Además, al salir de la sala se recogen solos (`nextRoom` l.2636).
- Al matar un jefe: +25% (l.2657). Con sus 2 corazones, son +55% por jefe.
- Cofre: +15% (l.2565). Altar: fuente del 60% antes de cada jefe (l.4980).
- Poción: 40%. Es la carta con más peso (1,4) y sale cuando estás por debajo del 75% de vida.
- Drenar vida: 2% por baja y nivel, hasta 6% por baja. Equipo «Sed de sangre»: 1-2% por baja. «Égida»: un escudo por sala.
- **Oferta media por partida**: ~85 bajas dan unos 15 corazones (~225% de la vida máxima). Con los 4 jefes (100%) y unos 2 cofres (30%) suman ~355% sin hacer nada; los altares añaden hasta 240% más.
- **Medido** (fresh-forms, bot quieto): 264 de cura efectiva frente a 382 de daño recibido en toda la partida.
- **La presión se reinicia cada 5 salas**: altar → jefe (+55%) → 3 salas → altar.

## 5. Poder del jugador

**Experiencia y niveles:**
- `xpNeed = 6 + 5(nivel−1)` (l.400); el nivel 14 cuesta 71 de experiencia.
- Experiencia acumulada sin cofres: 66 / 164 / 294 / 455 al llegar a las salas 5/10/15/20.
- Nivel medido al acabar cada jefe: 4,5 / 7 / 10 / 14 (fresh), y 16 en la sala 20 con mid o vet.
- Elecciones de carta totales: unas 13 por nivel, ~2 de cofres y 4 de los altares, así que ~19.

**Cartas (`recalc` l.1449, `fireVolley` l.1571):**
- Poder: +25% de daño, suma lineal (×2,5 con 6).
- Celeridad: +22% de cadencia (×2,1 con 5).
- Crítico: +10% de probabilidad y +0,25 de multiplicador por nivel (×1,9 con 4).
- **Proyectil extra**: (1+n)·0,88ⁿ, es decir ×1,76 / 2,32 / 2,73.
- **Eco**: (1+n)·0,9ⁿ, es decir ×1,80 / 2,43 / 2,92, y repite la ráfaga entera, diagonales incluidas.
- Juntas, 3 de Proyectil extra y 3 de Eco multiplican el daño a un solo blanco por **7,96**, más que 6 de Poder y 5 de Celeridad juntas (×5,25).
- Valor de la siguiente carta en una build media: Poder +14%, Celeridad +15%, Proyectil extra +32%, Eco +35%.
- Además, cada proyectil aplica por su cuenta el veneno, las reacciones, la cadena de rayo y el crítico.
- Salto arcano: 2 saltos más por nivel. Lanza de éter: +1 enemigo atravesado. Medido en la sala 18: 4,9 proyectiles por ráfaga y hasta 4,4 blancos por proyectil.
- **Empujón**: cada impacto empuja unos 10 px a enemigos que no son pesados (l.2269). A 6-17 impactos por segundo, eso son 65-175 px/s hacia atrás, más rápido de lo que anda cualquier cuerpo a cuerpo.

**Maná y definitivo:**
- Empiezas con 30 + 15 por nivel del Santuario. Ganas 0,6 por segundo en combate, 5 por baja y 10 por élite (l.1618, 2090), y **90 por la vida entera de un jefe** (l.2062).
- Uso medido: 8,6 definitivos por partida (fresh) y 12 (vet), con 1,1-1,7 por jefe.
- Valores:
  - Meteoro: 12×daño en r140.
  - Ventisca: 5×daño + congelación + estallido de 4×daño, y borra las balas.
  - Tormenta: 8 rayos de 3,2×daño, todos al jefe si está solo.
  - Singularidad: unos 8×daño.
  - Linaje: ×1,2.

**Santuario:**
- Poder +6% por nivel (×1,30 con 5), vida +10 (+50 con 5), maná +15, sabiduría +10% de experiencia, fénix.
- Coste total: 4110 de esencia más 800 de escuelas. Una victoria da ~109 de esencia, así que maxearlo exige unas 40 victorias: la esencia sí cuesta.

**Equipo (`equipment.js`):**
- Multiplicador por rareza ×1 / 1,7 / 2,6 / 3,8 / 5,5. Un juego legendario completo da ~+26% de daño y +101 de vida.
- **La ventaja «Disparo gemelo» en un épico regala un Proyectil extra (×1,76)**, que vale más que todas las demás estadísticas del objeto juntas.
- Se ganan ~4 objetos por victoria; a la sala 20, un 13% son épicos.

**Despertar (`forms.js` 27, 77-177):**
- Ánima necesaria: 100 y 160. El primer despertar llega en las salas 6-8 y el segundo en las 12-16.
- Frente a no despertar: −14% de tiempo de partida, −36-38% de tiempo de pelea contra los jefes 15 y 20, y −47% de daño recibido.

## 6. Tabla por sala

Perfil **fresh-forms** (sin mejoras, con despertar y definitivo; es el más parecido a Double). Vida máxima 100.

| Sala | Nivel | DPS a un blanco (daño × cadencia × proyectiles × eco × crítico) | Vida de la sala | Segundos teóricos (vida/DPS) | Limpieza medida | Daño recibido quieto (golpes) | Daño por golpe | 10% de las balas | Golpes para morir |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2 | 19 | 67 (4 enemigos) | 3,5 | 7,9 s | 0,4 (0,1) | 8 | 0 | 12 |
| 3 | 4 | 29 | 104 (3,9) | 3,6 | 7,5 s | 9,7 (0,7) | 14,7 | 2 | 7 |
| 5 (jefe) | 4,5 | 38 | 480 | 12,6 | 6,6 s de pelea | 40,5 (1,8) | 22,7 | 93 | 4,4 |
| 8 | 7 | 65 | 405 (4,9) | 6,2 | 8,0 s | 11,4 (0,6) | 18,3 | 28 | 5,5 |
| 10 (jefe) | 7 | 81 | 1150 | 14,2 | 9,0 s | 37,3 (1,4) | 26 | 138 | 3,8 |
| 13 | 10 | 125 | 862 (6,3) | 6,9 | 7,6 s | 13,3 (0,6) | 24,3 | 49 | 4,1 |
| 15 (jefe) | 10 | 147 | 2600 | 17,7 | 11,6 s | 48,3 (1,7) | 28 | 462 | 3,6 |
| 18 | 13 | 205 | 1659 (7,8) | 8,1 | 7,6 s | 15,4 (0,7) | 26,7 | 89 | 3,7 |
| 20 (jefe) | 14 | 250 | 4700 | 18,8 | 11,8 s | 135,5 (3,5) | 39 | 623 | 2,6 |

Cómo leerla:
- Los jefes mueren antes de lo que dice la cuenta teórica porque el DPS efectivo es mayor: 240 y 390 en las salas 15 y 20, por los definitivos, los efectos al impactar y las formas.
- **Un jugador quieto recibe solo el 1-3% de las balas.** Los anillos y espirales radiales dejan huecos, las rocas paran balas y la invulnerabilidad de 0,7 s absorbe las ráfagas. La hipótesis del 10% de las balas es mucho más dura que lo que pasa de verdad.
- Las salas normales se limpian en 6-9 s desde la 1 hasta la 18, es decir, la curva es plana.

**¿Habría muerto el bot quieto?**

| Perfil | Tiempo mediano | Muere en… | Daño total por partida |
|---|---|---|---|
| fresh-apr | 213 s | 36 de 40 partidas (sobre todo jefes 5 y 10) | 726 |
| fresh-forms | 183 s | 34 de 40 (18 en el jefe final) | 382 |
| mid | 158 s | 3 de 40 | 212 |
| vet | 129 s | 0 de 40 | 58 (2,5 golpes) |

- Con el perfil vet, la vida del jefe 20 equivale a solo 8 s de su DPS teórico (583).

## 7. Diagnóstico

1. **La curva no se rompe en una sala: es plana y fácil desde la sala 1.** Las salas normales hacen a un jugador quieto un 10-15% de su vida y los corazones le devuelven ~6% por sala. Solo los jefes cuentan como prueba. El salto real llega con el primer despertar (salas 6-8) y el segundo (12-16): la vida del jefe se multiplica ×2,3 y luego ×4,1, pero el tiempo de pelea se queda en 9-12 s. Con algo de Santuario y equipo, ni los jefes inquietan.
2. **Los enemigos mueren antes de poder actuar.** Aparecen a más de 300 px, con 0,75 s de aparición y su primer ataque a 1,35-2,35 s. El empujón continuo los mantiene lejos. Hay pocos (4-8 por sala) y sin oleadas.
3. **Enemigos que no son amenaza:**
   - Slime (41 px/s efectivos) y slime grande (27 px/s): nunca llegan a tocarte.
   - Murciélago: muere de una ráfaga.
   - Cultista y tótem: anillos y cruces radiales; el tótem ni siquiera hace daño al tocarlo.
   - Lo único peligroso es el arquero (3 balas apuntadas desde la sala 9), el espectro (reaparece a 150-230 px), el embestidor y la bomba. Esta última hace 52-66 de daño en las salas finales, pero solo si llega hasta ti.
4. **Fuentes de poder excesivas:**
   - Proyectil extra y Eco: ×7,96 con 6 cartas, y multiplican también los efectos al impactar.
   - Salto arcano y Lanza de éter: el daño en área no está contemplado en el escalado `hm`, que solo sube ×7.
   - «Disparo gemelo» en un épico, gratis.
   - Maná por dañar al jefe (90 por jefe) con definitivos que borran balas.
   - Poder del Santuario: ×1,30.
   - El Arcanista empieza con +1 proyectil y gana Ánima ×1,25.
5. **Curas excesivas:**
   - +55% tras cada jefe y altar del 60% justo antes.
   - Corazones al 6% de las bajas, que además se recogen solos al salir de la sala.
   - La Poción es la carta de más peso (1,4).
   - Drenar vida hasta 6% por baja.
   - «Égida» anula prácticamente todo el daño de una sala normal (0,4-0,8 golpes).
6. **Jefes con poca vida y sin segunda fase de verdad.** Con 4700 de vida, el Señor dura 5,6-11,8 s frente a los 25-35 s que pide la spec.

**Palancas para el otro agente:**

| Qué tocar | Propuesta |
|---|---|
| Presupuesto de enemigos | 3,5+0,55n → ~5+0,9n, tope 16, o una 2ª oleada al 50% |
| Distancia de aparición | 300 → 200 px |
| Primer ataque enemigo | temporizador inicial 0,6-1,6 s → 0,2-0,8 s |
| Empujón | 80 → 40, y 0 para élites y embestidores |
| Proyectil extra / Eco | penalización por proyectil 0,88/0,9 → 0,80 |
| Vida de los jefes | ×1,6-2, o que escale con el nivel del jugador, y que la furia añada un patrón |
| Maná del jefe | 90 → 40 |
| Curas | corazones 6% → 3% sin recogida automática; cura del jefe 25% → 10% |
| Daño enemigo | dmgMul 0,07 → 0,09 |

No afectan a la esencia.

**Ficheros** (en `E:\PROYECTOS\arcano-snap\tools`):
- `dif-rooms.mjs`: Monte Carlo de la composición de salas.
- `dif-sim.js`: el bot quieto con la vida instrumentada; se lanza con `CDP_PORT=9471 DIF_PROFILE=fresh|mid|vet DIF_RUNS='[…]' node tools/cdp.mjs 360 640 tools/dif-sim.js`.
- `dif-agg.mjs`: tabla por sala a partir de la salida del bot.
- `dif-dps.mjs`: DPS teórico por sala.
- `dif-spec.js`: compara con el `sim()` de la spec, con y sin definitivo.
- `dif-cmp.js`: comprueba que ambos bots dan tiempos parecidos.

Salidas en bruto en el scratchpad (`C:\Users\josea\AppData\Local\Temp\claude\E--\fb9d0aba-d7f8-41ca-a774-03ef55f0a514\scratchpad`): `fresh-apr.txt`, `fresh-forms.txt`, `mid-forms.txt`, `vet-forms.txt`.