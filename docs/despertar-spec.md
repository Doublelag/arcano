# ESPECIFICACIÓN FINAL: "DESPERTAR". Formas elementales, Afinidad y Mezclas para Arcano

Revisé esto contra `E:\PROYECTOS\arcano\public\game.js` tal como estaba hoy (4048 líneas). Las líneas que cito son aproximadas: otro proceso edita este archivo a la vez que nosotros. Antes de cada edición hay que localizar la función por su nombre con grep. En pantalla nunca aparecen las palabras "Lux", "Elementalista", "Final Spark", "Luz"/"Oscuridad" como nombre de forma, ni nombres de Isaac. Tampoco se usa "Fusionar", porque ya existe en Equipo.

---

## 0. Decisiones cerradas (base: la propuesta lux, con los cambios que pidieron los jueces)

| Tema | Decisión final | Origen |
|---|---|---|
| Estructura | Aprendiz → forma pura → forma combinada. Son 10 formas: Aprendiz, 4 puras, 4 híbridas y Eclipse. Los elementos opuestos dan Eclipse | lux |
| Exclusividad | Máximo 2 elementos (Afinidad) por partida. La Afinidad es definitiva una vez sellada. Una sola forma final. No hay vuelta atrás ni Renacer | lux, corregida |
| Barra | Ánima. Se muestra como anillo exterior del botón del definitivo, sin botón nuevo | movil |
| Cuándo se despierta | Solo con la sala limpia (también en altar y tras el jefe). Nunca en combate, para que no sea un botón de pánico | movil |
| Cómo se elige | Cartas `data-act="pick"` con id `awk:<el>` dentro de `openLevelUp` (state `levelup`, `pickSource='awaken'`) | isaac |
| Sellos I, II y III | Eliminados. Se sustituyen por redes de seguridad: la primera vez se despierta tras el Gólem, el 1º despertar está garantizado tras el Rey Slime y el 2º tras el Brujo | movil |
| Eclipse | Pareja opuesta y además un Pacto oscuro sellado en esta partida antes del 2º despertar. Nunca da los 4 elementos | movil, corregida |
| 2º despertar | Conserva el rasgo puro del núcleo y suma el rasgo combinado, pero no el rasgo puro del 2º elemento. La runa sube +1, no se fija a Nv2 | recorte de los jueces |
| Linaje | Solo +20% al definitivo si la forma contiene el elemento de tu escuela | recorte |
| Exceso de runas del equipo | +6% de daño por nivel, con un tope total de +24% (fusedLv ≤ 4) | lux/isaac |
| Capa estilo Isaac | 8 Mezclas runa + carta (2 por elemento, así cada pareja tiene acceso a 4) con receta oculta, más la Capa 0 visual | isaac |
| Reacción 6 | NECROSIS (hielo + veneno). Consume el veneno y tiene tope de daño | isaac |
| Correcciones globales | DR de congelación en jefes, multiplicador de corrosión parametrizado, bloqueo de música, cola de avisos, `nofx` en esquirlas, tope de proyectiles | jueces |
| Guardado | `meta.grim` con máscaras de bits y cadenas de dígitos (menos de 120 caracteres codificados) | isaac/movil |

---

## 1. Resumen para Double

1. Cada partida eres Aprendiz y solo puedes dominar **2 elementos**: el de tu escuela y otro. En cuanto coges una runa de otro elemento, las otras dos dejan de salir hasta el final.
2. Matar, provocar reacciones y pegar a jefes llena un **anillo alrededor del botón del definitivo**. Cuando está lleno y limpias la sala, **despiertas**: cámara lenta, destello, y el mago cambia entero (túnica, aura, disparos, sonido y definitivo).
3. Hay **dos despertares por partida**. El primero te convierte en una forma pura (Ígnea, Glacial, Voltaica, Tóxica). El segundo junta tus dos elementos en una forma combinada: **Plasma, Aurora, Mortaja o Azufre**.
4. Si mezclas **opuestos** (Fuego con Hielo, o Rayo con Veneno) y has firmado un **Pacto oscuro**, despiertas **Eclipse**, la forma prohibida: más daño a cambio de vida.
5. Además hay **8 Mezclas secretas** estilo Isaac (una runa más una carta concreta, por ejemplo Fuego + Lanza de éter = Cometa) que cambian cómo se comportan los hechizos. Todo se apunta en un **Grimorio** con huecos "???". No regala esencia: solo unos pocos logros de una vez.

---

## 2. Reglas exactas en partida

### 2.1 Vocabulario visible (el jugador solo necesita cuatro palabras)
**Afinidad** (tus 2 elementos), **Despertar/Forma**, **Mezcla**, **Grimorio**. "Ánima" es el nombre interno del anillo. En la interfaz solo sale en la pausa ("Despertar 64%").

### 2.2 El cuadrado
- Orden fijo: `SQUARE = ['fire','bolt','ice','poison']` (Fuego arriba, Rayo a la derecha, Hielo abajo, Veneno a la izquierda).
- Parejas vecinas: Fuego+Rayo = **PLASMA**, Rayo+Hielo = **AURORA**, Hielo+Veneno = **MORTAJA**, Veneno+Fuego = **AZUFRE**.
- Parejas opuestas: Fuego+Hielo y Rayo+Veneno = **ECLIPSE** (requiere pacto).
- Formas puras: fire → ÍGNEA, ice → GLACIAL, bolt → VOLTAICA, poison → TÓXICA.

### 2.3 Afinidad (máximo 2 elementos)
1. **Escuela elemental:** `aff = [school.el]` y la runa de la escuela empieza a Nv1, como ahora.
2. **Arcanista:** `aff = []`. Su primera runa elemental entra en `aff` sin cerrar nada (la carta dice "Será tu primer elemento"). La segunda sella la pareja.
3. **Sellado:** cuando `aff.length` pasa a 2 (por coger una runa, por el equipo o por elegir otro elemento en el 1º despertar):
   - las runas de los otros 2 elementos **no vuelven a salir en toda la partida**, tampoco con un cambio de cartas;
   - aviso: "AFINIDAD · FUEGO + RAYO", con el texto "Hielo y Veneno dejan de salir";
   - aparece un anillo doble con los 2 colores alrededor del mago y suena `Sfx.fuse`;
   - la primera vez que le pasa al jugador sale además este aviso único: "Solo 2 elementos por partida: los demás dejan de salir" (`settings.tips.aff`);
   - si la pareja es opuesta y es la primera vez, sale el aviso "Algo oscuro duerme entre Fuego y Hielo…" (`settings.tips.opp`).
4. **Promesa visual del sellado** (Aprendiz): la cinta del sombrero pasa a ser bicolor (mitad izquierda del color de `aff[0]`, mitad derecha del de `aff[1]`) y el cristal del bastón toma el color de `aff[1]`.
5. **Peso en el mazo una vez sellada:** tus runas por debajo de su máximo pesan ×1,5 (1,1 → 1,65).
6. **Carta de runa que sellaría** (`aff.length===1` y no es tuya): lleva marco bicolor (`.card.seal`, `--c` del color de `aff[0]` y `--c2` del color de la runa) y **2 líneas**:
   - "Sella Fuego + Rayo → PLASMA" (o "→ ???" si nunca la descubriste);
   - "Cierra Hielo y Veneno". Si son opuestos: "Opuestos: el 2º despertar exigirá un Pacto oscuro".
   - Se conserva el texto actual "Desbloquea SOBRECARGA" en la primera línea: "Desbloquea SOBRECARGA · Sella → ???".
7. **Equipo con `startRune`** (Brasa eterna, Corazón helado, Chispa viva, Sangre de víbora). Al elegir escuela:
   - se ordenan los perks por nivel (de mayor a menor) y, si empatan, los de bastón (fire, ice, bolt) antes que el de anillo (poison);
   - si el elemento ya está en `aff`, o `aff.length < 2`, se aplica como hoy (`sk[el] = min(2, max(sk[el], lv))`) y entra en `aff`;
   - si no cabe, se funde: `fusedLv = min(4, fusedLv + lv)` (+6% de daño por nivel, tope +24%) y sale el aviso "Runa de Veneno del equipo: no cabe en tu Afinidad → +6% de daño";
   - si el equipo sella la pareja, el aviso de sala 1 es "AFINIDAD · X + Y (por tu equipo)";
   - hay que cambiar el texto de los perks en `equipment.js`: desc1 "Empiezas con la Runa de fuego (fija tu Afinidad si cabe)" y desc2 "…a nivel 2 (fija tu Afinidad si cabe)".

### 2.4 Ánima (solo existe dentro de la partida, no es esencia)
| Fuente | Ánima | Dónde |
|---|---|---|
| Baja normal / élite / esbirro (`minion`) | +2 / +6 / +0,5 | `killEnemy`, no cuenta con `wiped` ni `selfBlast` |
| Reacción | +1,5, con un tope de **12 por sala** (`roomReactA`) | `react` |
| Daño al jefe | `min(dmg, hp antes)/maxHp × 40` (+40 por jefe completo) | `damageEnemy` |
| Sala limpia sin recibir daño | +5, solo en salas con enemigos (no en altares) | `onCleared` |
| Arcanista | todo ×1,25 | `gainAnima` |

- **Umbrales:** `need = [100, 160]` (1º y 2º despertar). Al llegar se fija `anima = need` y `animaReady = true`. Después del 2º despertar ya no se gana más.
- **Redes de seguridad** (`fillAnima()` llena hasta el umbral actual):
  - (a) Jugador que nunca ha despertado (`meta.grim.f` sin bits de forma): matar al Gólem (tier 1) con `awak===0`.
  - (b) Matar al Rey Slime (tier 2) con `awak===0`.
  - (c) Matar al Brujo (tier 3) con `awak===1`.
- **Ritmo previsto** (presupuesto `3,5 + 0,55·sala`: unas 4 bajas en las salas 1-3, 4-5 en las 6-8 y 6-7 más divisiones en las 11-13):
  - 1º despertar en la sala 5 la primera vez (red a) y en las salas 6-7 normalmente;
  - 2º despertar en las salas 12-14, o en la 15 por la red (c).
  - Se ajusta con bots (sección 7) y con `meta.grim.k`.
- **Promesa:** con el Ánima al 80% o más y sin despertar, el Aprendiz lleva un aura `#fff1c4` que late.

### 2.5 Oferta del Despertar
- Condiciones (`canOfferAwaken(dt)`, todas a la vez): `state==='play'`, `player.animaReady`, `cleared`, `!awakenFx`, `!cine`, `slowT<=0`, `winTimer<0`, `room !== player.snoozeRoom`, no hay `pendingLevels` ni `bonusPicks` pendientes (va detrás de ellos en la cadena `else if`) y existe al menos una opción no bloqueada. Si se cumplen, `awakenWait += dt` y a los **0,8 s** llama a `openLevelUp('awaken')`.
- Si todas las opciones están bloqueadas (opuestos sin pacto), no hay panel. En salas limpias sale la píldora: "Opuestos: sella un Pacto oscuro en un altar para despertar" (`#c77dff`) y el anillo se pone en `.animalock`.
- **"Aún no"** (botón `data-act="later"`, Escape o Atrás de Android): `snoozeRoom = room`. El panel vuelve a abrirse en la siguiente sala limpia, o en esta misma si firmas un Pacto (`pickAltar('pact')` pone `snoozeRoom = -1`).
- Si cruzas la puerta antes de que pasen los 0,8 s no pasa nada: se ofrece en la siguiente sala limpia.
- No se ofrece en la sala 20 (el jefe final activa `winTimer`).

### 2.6 Primer despertar (forma pura)
- Opciones (`options` en forms.js):
  - `aff.length===2`: las 2 de `aff`;
  - si no: los 4 elementos. Elegir uno que no esté en `aff` lo añade (y sella si ya había uno). La carta lo avisa con la línea de sellado.
- Al despertar en el elemento X:
  - `core = X`;
  - la runa X sube **+1** (máx. 2). Si ya estaba a Nv2: **Sintonía**, el definitivo pasa al 100% y sale el aviso "SINTONÍA: definitivo lleno";
  - `form = TIER1[X]` y `tr = traitsFor(X, null, sk)`;
  - el definitivo pasa a ser el del elemento X (Meteoro, Ventisca, Tormenta o Plaga), con el color de la forma.

### 2.7 Segundo despertar (forma combinada)
- Opciones: si `aff.length===2`, solo el otro elemento de `aff`. Si no, los 3 que no son `core`.
- La opción opuesta queda `locked` si `!pactRun` y su carta dice "??? · Opuestos — Sella un Pacto oscuro en un altar".
- Al despertar en Y:
  - `second = Y` y se sella la Afinidad si hacía falta;
  - la runa Y sube +1 (máx. 2), con Sintonía igual que antes;
  - `form = formFor(core, Y)` y `tr = traitsFor(core, Y, sk)`, que junta el rasgo puro del núcleo con el rasgo combinado;
  - **no** se suma el rasgo puro de Y. Así el mismo híbrido se juega distinto según el núcleo: Plasma con núcleo fuego tiene Pira; Plasma con núcleo rayo tiene Arco vivo;
  - definitivo: en la fase 1, el del núcleo con el color de la forma; en la fase 2, el definitivo combinado (3.3).

### 2.8 Eclipse
- Requisitos: pareja opuesta (`OPP[core]===Y`), `pactRun===true` (Pacto firmado en esta partida, antes) y estar en el 2º despertar.
- Precio adicional al despertar: `maxHp = max(40, round(maxHp × 0,85))`, que se suma al −20% del pacto.
- No da más elementos: sigues con 2.

### 2.9 Linaje y Sintonía
- **Linaje:** si la forma actual contiene `SCHOOLS[school].el` (y la escuela no es Arcanista), el definitivo hace ×1,2 (`uAtk()`). La carta del despertar lo indica con "Fiel a tu escuela: definitivo +20%". El Arcanista nunca tiene Linaje.
- **Sintonía:** descrita en 2.6 y 2.7. En la carta: "Runa al máximo: despiertas con el definitivo lleno".

### 2.10 Interacciones
| Sistema | Regla |
|---|---|
| Escuela | Fija `aff[0]`. Hasta el 1º despertar todo funciona exactamente como hoy (con el tope de 2 elementos) |
| Runas | Mismo máximo (2) y mismos efectos base. Los rasgos de forma solo cambian números a través de `player.tr` |
| Reacciones | Con 2 elementos solo es posible la reacción de tu pareja. La 6ª es NECROSIS. El logro Alquimista pasa a pedir "las 6"; quien ya lo tiene lo conserva |
| Cofres | Sin cambios: su elección va antes que la oferta del despertar |
| Altar | Sin cambios. El Pacto pone `pactRun = true` y `snoozeRoom = -1`. Su texto añade: "· Abre el camino a Eclipse si tus elementos son opuestos" (solo si `aff` es opuesta) |
| Cambiar cartas | No muestra nunca runas cerradas. El panel del despertar no tiene botón de cambiar |
| Poción, fénix, escudo | Sin cambios |
| Cartas de forma (fase 2) | Solo salen en su forma (`cond: player.form===id`), con máx. 2 y w 1,3 |
| Mezclas (fase 2) | Solo pueden activarse las de tus 2 elementos. Con la Afinidad sellada, 4 de 8 posibles |

### 2.11 Correcciones de balance globales (se hacen en la fase 1, antes que el resto)
1. **Congelación de jefes con rendimientos decrecientes.** Nueva función `freezeEnemy(e, t, tBoss, force)`:
   - jefe: si `e.frzImm > 0 && !force` no hace nada; si no, `e.frozen = tBoss` y `e.frzImm = tBoss + 2`;
   - resto: `e.frozen = max(e.frozen, t)`;
   - siempre `unfade(e)`.
   - La usan la reacción CONGELACIÓN, Glacial, Aurora, Ventisca (`force`) y Cortina boreal (`force`).
   - Objetivo: menos del 35% del tiempo congelado en un combate de jefe (hoy está en ~70% con hielo+rayo).
2. **Corrosión parametrizada:** `damageEnemy` usa `dmg *= e.corrMul || 1.4`. La reacción fija `e.corrMul = tr.corrMul || 1.4` y `e.corrode = tr.corrT || 4`.
3. Nada nuevo ralentiza a un jefe por debajo del `chill` normal (0,62, o 0,5 con hielo a Nv2). El Sudario y la niebla solo renuevan `e.slow`.
4. Las esquirlas y los proyectiles secundarios llevan `nofx: true`: no reaccionan, no encadenan, no activan Mezclas ni rasgos y no generan más esquirlas. Solo se crean si `shots.length < 140`.
5. **Topes por fichas** (`tok`, se recargan en `updateForms`):

| Ficha | Tope | Recarga |
|---|---|---|
| `blast` | 3 | 10/s |
| `arc` | 5 | 5/s |
| `implode` | 6 | 6/s |
| `comet` | 6 | 6/s |
| `spark` | 4 | 4/s |
| `shard` | 1 | cada 0,15 s |

---

## 3. Contenido

Todos los colores van en `'#rrggbb'` (glowCache crea un canvas de 64 px por color; nunca se interpolan). Los iconos son puntos de código Unicode.

### 3.1 Reacción nueva: NECROSIS
- `REACTIONS` (se añade **al final**): `{ id:'necro', a:'ice', b:'poison', name:'NECROSIS', color:'#5fffd0', desc:'Detona el veneno de golpe' }`.
- Efecto en `react`:
  - `d = clamp(e.poisonDps × (tr.necroK||3), 1.5×atk, (tr.necroCap||4)×atk)`;
  - `damageEnemy(e, d, true, '#5fffd0')`;
  - `half = e.poisonDps × 0.5`, luego `e.poisonDps = 0`;
  - a los enemigos a ≤ `(tr.necroSpread||70)` px se les pone `poisonDps = max(poisonDps, half)`.
- Visual: anillo `#5fffd0` de r a r+40 en 0,3 s y 10 partículas blancas `#eafffa`. Sonido: `Sfx.react()` + `tone(1100,.25,'sine',.06,.5)`.

### 3.2 Las 10 formas

Claves comunes de la paleta (corresponden 1:1 con los colores fijos de `drawPlayer`): `cape`, `robe`, `trim`, `brim` (`#3a24a0` hoy), `hat:[c0,c1,c2]` (gradiente, hoy `#6a4ff0/#4a30c0/#2c1a7a`), `hatLine` (`#1f1250`), `band`, `star` (`#ffcf4a`), `gem` (cristal), `eyes?` y `cracks?`. Proyectil: `shape`, `sz`, `glow`, `core`, `trail`, `trail2?`, `len` (multiplicador de estela). Voz: `{f, type, slide, f2?}`. Tono: `key` (Hz).

---

**APRENDIZ** (`aprendiz`, bit 0, siempre descubierta) · icono U+1FA84 · sin rasgo
- Paleta: cape `#2a1873`, robe `#5b3fd1`, trim `#ffcf4a`, brim `#3a24a0`, hat `#6a4ff0/#4a30c0/#2c1a7a`, hatLine `#1f1250`, star `#ffcf4a`.
  - band: color de la escuela; bicolor si la Afinidad está sellada.
  - gem: color de la escuela, o de `aff[1]` si está sellada.
- Aura: ninguna. Con el Ánima al 80% o más, `glow(x, y-4, 28+4·sin(clock·5), '#fff1c4', .35)`.
- Proyectil: el actual (`orb`): color principal del elemento y chispa orbitando del 2º.
- Definitivo: el de la escuela. Voz: la actual (520 Hz, sine, slide 1,8). key 440.

---

**ÍGNEA** (`ignea`, bit 1, fuego) · U+1F525 · "¡Que todo arde!"
- **Rasgo "Pira":**
  - quemadura `0,5×atk×nivel/s` (antes 0,35) y dura 3,5 s (antes 2,5);
  - quien muere ardiendo estalla: r55, 0,8×atk, prende a los alcanzados;
  - ficha `blast`; las bajas causadas por un estallido no estallan (`fxDepth`).
  - `trait: { burnK:.5, burnT:3.5, deathBlast:{ r:55, k:.8 } }`.
- Paleta: cape `#3a0d06`, robe `#8a2a12`, trim `#ffcf4a`, brim `#5a1a0a`, hat `#c2410c/#8a2a12/#4a1206`, hatLine `#2a0a04`, band `#ff8a3d`, star `#ffd23a`, gem `#ff8a3d`.
- Aura `wings`: dos alas a la espalda, cada una con 3 curvas cuadráticas (lineWidth 3, `#ff8a3d` y `#ffd23a` alternos) que aletean a 3 Hz (±0,25 rad), más `glow(…, 30, '#ff8a3d', .35)`.
- Ambiente: brasas `#ffb347` que suben (vy −60, vida 0,6 s), 1 cada 0,08 s.
- Proyectil `tear`: glow `#ff8a3d`, núcleo `#fff3c4`, estela `#ff5a1f` con len ×1,4, sz 1,1.
- Definitivo: Meteoro. Voz `{f:440, type:'sawtooth', slide:1.3}` (volumen 0,04). key 523.

**GLACIAL** (`glacial`, bit 2, hielo) · U+2744 · "Calma. Silencio. Hielo."
- **Rasgo "Gélido":**
  - la ralentización dura 2,6 s (antes 1,8);
  - un impacto sobre un enemigo **ya ralentizado antes del golpe** tiene un 12% de congelarlo 0,7 s (jefe 0,35 s, con DR).
  - `trait: { slowT:2.6, frzChance:.12, frzT:.7, frzBossT:.35 }`.
- Paleta: cape `#0f2b48`, robe `#1d4f7a`, trim `#e8fbff`, brim `#16395c`, hat `#5fb8e8/#2a6a9a/#16395c`, hatLine `#0b1f33`, band `#7fe3ff`, star `#e8fbff`, gem `#7fe3ff`.
- Aura `shards`: 3 rombos de 6×12 px (relleno `#bff4ff`, borde `#7fe3ff`) que orbitan a 26 px a 1,2 rad/s.
- Ambiente: copos `#eafcff` que caen (vy +40).
- Proyectil `diamond` de 7×13 px orientado: núcleo `#ffffff`, glow `#7fe3ff`, estela `#bff4ff`, sz 1,15. Al impactar suelta 4 chispas `#e6fbff` (`sparks`).
- Definitivo: Ventisca. Voz `{f:880, type:'sine', slide:1.2}`. key 784.

**VOLTAICA** (`voltaica`, bit 3, rayo) · U+26A1 · "¡Más rápido que el trueno!"
- **Rasgo "Arco vivo":** probabilidad de cadena 0,25×nivel (50% a Nv2; antes 0,16), 3 objetivos (antes 2), radio 230 px (antes 200), 50% del daño (antes 40%).
  - `trait: { chainP:.25, chainN:3, chainR:230, chainK:.5 }`.
- Paleta: cape `#141040`, robe `#2a2470`, trim `#ffe45c`, brim `#1e1a5a`, hat `#5a52d0/#2a2470/#141040`, hatLine `#0c0a2a`, band `#ffe45c`, star `#fff6a0`, gem `#ffe45c`.
- Aura `arcs`: 2 zigzags de 4 tramos alrededor del cuerpo (r 22, `#fff6a0`, lineWidth 2) que se regeneran cada 0,08 s, más glow `#ffe45c` 0,3.
- Ambiente: chispas `#fff6a0` (vida 0,2 s), 1 cada 0,12 s.
- Proyectil `star4`: estrella de 4 puntas (r ext 7, int 2,5) que gira a 8 rad/s; glow `#ffe45c`, núcleo `#ffffff`, estela `#fff6a0`.
- Definitivo: Tormenta. Voz `{f:600, type:'square', slide:1.5}` + `noise(.03,.03,6000)`. key 659.

**TÓXICA** (`toxica`, bit 4, veneno) · U+2620 · "Paciencia… el veneno trabaja."
- **Rasgo "Ponzoña":**
  - cada golpe añade `0,15×atk×nivel` (antes 0,1), con tope `1,1×atk×nivel` (antes 0,8);
  - quien muere envenenado deja un charco (r45, 2,5 s, máx. 5) que cada 0,5 s aplica `applyElements(e,['poison'])` a los enemigos de dentro.
  - `trait: { poisonK:.15, poisonCap:1.1, puddle:{ r:45, t:2.5, k:0, max:5 } }`.
- Paleta: cape `#0e2a0c`, robe `#1f4a1a`, trim `#c6ff5a`, brim `#173a14`, hat `#4f9a3a/#1f4a1a/#0e2a0c`, hatLine `#081a06`, band `#8dff6a`, star `#c6ff5a`, gem `#8dff6a`.
- Aura `bubbles`: glow `#8dff6a` 0,25.
- Ambiente: burbujas `#8dff6a` que suben (vy −40, tamaño 2-4).
- Proyectil `drop`: círculo con una punta triangular hacia atrás; glow `#8dff6a`, núcleo `#eaffd8`, estela `#4fbf3a`, sz 1,05.
- Charco: elipse `#8dff6a` al 25% con borde discontinuo `#4fbf3a`.
- Definitivo: Plaga. Voz `{f:300, type:'triangle', slide:.7}`. key 392.

---

**PLASMA** (`plasma`, bit 5, fuego+rayo, potencia SOBRECARGA) · U+2600 · "¡Soy una estrella!"
- **Rasgo combinado "Arco de plasma":**
  - cada impacto sobre un enemigo que arde tiene un 30% de lanzar un arco al enemigo más cercano a ≤180 px, con el 50% del daño del disparo, y lo prende (ficha `arc`);
  - SOBRECARGA pasa a r125 (antes 95) y 2,8×atk (antes 2,2).
  - `trait: { plasmaArc:{ p:.3, k:.5, r:180 }, overR:125, overK:2.8 }`.
- Paleta: cape `#1a0620`, robe `#3d0f4a`, trim `#ffb347`, brim `#2a0a36`, hat `#a0309a/#5a1660/#2a0a36`, hatLine `#14041a`, band `#ff5ad1`, star `#ffb347`, gem `#ff5ad1`.
- Aura `ring`: anillo r24 `#ff5ad1` (lineWidth 3, discontinuo [6,6]) que gira, con 2 chispas `#ffb347` en órbita.
- Arcos: capas `[[6,'rgba(255,90,209,.35)'],[2,'#fff0ff']]`.
- Proyectil `sphere`: glow `#ff5ad1` de r22, núcleo `#fff0ff` y un anillo elíptico `#ffb347` (rx r+4, ry ×0,4) que gira a 6 rad/s; estela `#ff5ad1`, sz 1,25.
- Definitivo (fase 2): SOL CAUTIVO. Voz `{f:520, f2:780, type:'sine', slide:1.4}`. key: la del núcleo.

**AURORA** (`aurora`, bit 6, rayo+hielo, potencia CONGELACIÓN) · U+1F320 · "La luz del norte me guía."
- **Rasgo "Escarcha polar":**
  - CONGELACIÓN dura 2,0 s (antes 1,6; en jefes sigue en 0,7 con DR);
  - los congelados reciben ×1,5 (antes ×1,3);
  - quien muere congelado estalla en 6 esquirlas (0,6×atk, `els:['ice']`, vida 0,21 s ≈ 160 px, `nofx`), como mucho un estallido cada 0,15 s.
  - `trait: { freezeT:2, freezeBossT:.7, frozenMul:1.5, shards:{ n:6, k:.6 } }`.
- Paleta: cape `#1a2f5a`, robe `#10284a`, trim `#bff4ff`, brim `#0c1e38`, hat `#3a7ab0/#1c4a7a/#0c1e38`, hatLine `#081426`, band `#6affc8`, star `#b07cff`, gem `#6affc8`.
- Aura `ribbons`: 3 cintas senoidales de 8 puntos sobre los hombros (`#6affc8`, `#7fe3ff`, `#b07cff`, alfa 0,35).
- Proyectil `diamond`: núcleo `#ffffff`, glow `#7fe3ff`, doble estela (`#6affc8` desplazada +2 px y `#b07cff` −2 px en perpendicular), sz 1,2.
- Definitivo (fase 2): CORTINA BOREAL. Voz `{f:990, type:'sine', slide:1.5}`.

**MORTAJA** (`mortaja`, bit 7, hielo+veneno, potencia NECROSIS) · U+1F32B · "Duerme, y no despiertes."
- **Rasgo "Sudario":**
  - aura de r90 alrededor del mago: cada 0,5 s, a los enemigos de dentro, `e.slow = max(e.slow,.6)` y +0,1×atk de veneno, respetando el tope de veneno;
  - NECROSIS con tope 5×atk (antes 4) y contagio a 100 px (antes 70).
  - `trait: { shroud:{ r:90, k:.1 }, necroCap:5, necroSpread:100 }`.
- Paleta: cape `#141a20`, robe `#26303a`, trim `#8dffb0`, brim `#1a2128`, hat `#4a5a66/#26303a/#141a20`, hatLine `#0a0e12`, band `#5fffd0`, star `#8dffb0`, gem `#5fffd0`.
- Aura `mist`: 3 manchas de glow `#5fffd0` al 0,15 que derivan, más un círculo punteado r90 (`[4,8]`, alfa 0,25) que marca el Sudario.
- Proyectil `droplong`: elipse alargada en la dirección de vuelo, núcleo `#1d3b33` con borde blanco de 1,5 px; glow `#5fffd0`, estela `#9fb5b0`, sz 1,1.
- Definitivo (fase 2): INVIERNO NEGRO. Voz `{f:260, type:'triangle', slide:.6}`.

**AZUFRE** (`azufre`, bit 8, fuego+veneno, potencia COMBUSTIÓN) · U+1F30B · "La tierra escupe fuego."
- **Rasgo "Suelo de azufre":**
  - quien muere ardiendo o envenenado deja un charco r50 de 3 s (máx. 6) que cada 0,5 s hace 0,3×atk y aplica fuego y veneno. Sustituye al charco de Tóxica;
  - COMBUSTIÓN pasa a r110 (antes 85) y 2,0×atk (antes 1,5).
  - `trait: { puddle:{ r:50, t:3, k:.3, max:6, sulfur:true }, combR:110, combK:2 }`.
- Paleta: cape `#1c0c04`, robe `#3a1a0a`, cracks `#ffb000` (3 polilíneas fijas sobre la túnica, alfa 0,6+0,4·sin), trim `#ffcf3a`, brim `#2a1206`, hat `#6a3a1a/#3a1a0a/#1c0c04`, hatLine `#120802`, band `#d6ff3a`, star `#ffcf3a`, gem `#d6ff3a`.
- Aura `smoke`: glow `#c8d84a` 0,2 de r34.
- Ambiente: ceniza `#7a7a70` que cae (dibujada en un array propio con composición normal, porque `drawParts` usa `lighter`) y alguna brasa `#ff8a3d`.
- Proyectil `blob`: círculo `#d6ff3a` con núcleo `#ff8a3d`; glow `#d6ff3a`, estela `#c8d84a`, sz 1,15.
- Charco: elipse `#ff8a3d` al 30% con 3 grietas `#ffb000` generadas al crearlo.
- Definitivo (fase 2): LLUVIA DE AZUFRE. Voz `{f:360, type:'sawtooth', slide:.8}`.

**ECLIPSE** (`eclipse`, bit 9, opuestos con Pacto) · U+1F311 · "Ni luz ni sombra. Solo yo."
- **Precio y bonus:** atk ×1,2, maxHp ×0,85 al despertar (mín. 40) y +1 de perforación.
- **"Desequilibrio":**
  - contra enemigos que no son jefe, el disparo reacciona desde el primer impacto (los elementos del propio disparo cuentan como estado previo);
  - recarga de reacción 0,6 s contra no jefes (1 s contra jefes).
- **"Aniquilación":** cada reacción provoca una implosión de r110 que atrae 40 px hacia el objetivo a los que no son jefe y hace 1,0×atk a todos los de dentro (ficha `implode`).
- Según la pareja: Vapor pasa a 3,6×atk (antes 3); Corrosión pasa a ×1,5 durante 5 s (antes ×1,4 durante 4 s).
- `trait: { atkMul:1.2, hpMul:.85, pierce:1, firstHit:true, reactCd:.6, implode:{ r:110, k:1, pull:40 }, vaporK:3.6, corrMul:1.5, corrT:5 }`.
- Paleta: cape `#05030a`, robe `#0d0718`, trim `#c77dff`, brim `#120a22`, hat `#3a2266/#1a0f30/#05030a`, hatLine `#02010a`, band `#c77dff`, star `#e8d5ff` (dibujada como sol negro: círculo `#05030a` con aro `#e8d5ff`), gem `void` (círculo `#0a0612` con aro `#e8d5ff` y glow `#c77dff`), eyes white `#e8d5ff` / pupil `#2a1046`.
- Aura `void`: glow `#c77dff` de r38 al 0,6 y, encima, un disco `#05030a` al 0,6 de r18 detrás del cuerpo (brillo invertido).
- Ambiente: motas `#c77dff` que caen despacio. Viñeta violeta permanente al 12% (sprite prerenderizado como `vignetteSpr`).
- Proyectil `void`: glow `#c77dff` de r20, disco `#0a0612` de r6 y aro `#f3e8ff` de 2 px; estela `#7a3dff` con len ×1,3, sz 1,2. Es lo contrario de una bala del Brujo (`#c58bff`, centro blanco).
- Definitivo (fase 2): SOL NEGRO. Voz `{f:180, type:'sine', slide:1.6}`. key 311.

### 3.3 Definitivos (fase 2 para los combinados)
`uAtk() = player.atk × (linaje ? 1.2 : 1)`. Sustituye a `player.atk` dentro de `castUlt` y `updateUlts`.

| id | Forma | Efecto | Estructura | Sonido |
|---|---|---|---|---|
| (puros) | Ígnea/Glacial/Voltaica/Tóxica | Meteoro / Ventisca / Tormenta / Plaga actuales, con el color de la forma | las de hoy | las de hoy |
| `sun` SOL CAUTIVO | Plasma | Esfera sobre `densest` durante 1,2 s. Cada 0,15 s lanza un rayo a un enemigo a ≤260 px: 2,2×uAtk, `shock=2` y fuego (8 rayos). Al final: `explode` r160, 9×uAtk, quemadura de 3 s (0,6×atk/s) y borra balas en r160 | `sing={kind:'sun',…}` y `bolts` con capas magenta | `Sfx.zap` por rayo y `boom` |
| `curtain` CORTINA BOREAL | Aurora | 5 columnas de ancho AW/5, escalonadas cada 0,2 s, activas 0,35 s. A cada enemigo con x dentro: 4,5×uAtk y `freezeEnemy(e,2,.8,true)`. Borran las balas de su columna | `curtains[]` | `Sfx.freeze` por columna |
| `fog` INVIERNO NEGRO | Mortaja | Niebla 4 s en toda la sala: renueva `slow`, `poisonDps=max(…,1.0×uAtk)` y las balas enemigas van a ×0,5. Al acabar, NECROSIS sobre todos (con los valores de Mortaja) | `fog={t:4}` | `Sfx.plague` y `freeze` al final |
| `sulfur` LLUVIA DE AZUFRE | Azufre | 6 bolas, una cada 0,12 s, con aviso de 0,5 s, sobre los más densos (si hay menos de 6 enemigos, repiten objetivo). Cada una: r85, 3,5×uAtk, fuego+veneno y charco de azufre de 3 s | `meteors` con `{dmg:3.5, r:85, col:'#d6ff3a', pool:true}` | `whistle` y `blast` |
| `void` SOL NEGRO | Eclipse | 2,5 s en el centro de la sala: atrae en r400 (jefe 45 px/s, el resto 175); cada 0,25 s hace 0,5×uAtk en r130. Al final: r220, 12×uAtk. Mientras dura, la pantalla se oscurece al 55% y tus disparos hacen +50% | `sing={kind:'void',…}` | `tone(55,2.5,'sine',.15)` y `boom` |

Comparativa contra un solo objetivo: Tormenta ≈ 25,6×atk, Meteoro 12, Sol cautivo ≈ 26,6, Lluvia ≈ 21, Sol negro ≈ 17 más el buff, Invierno ≈ 9 más el veneno.

### 3.4 Cartas de forma (fase 2)
`SKILLS` (máx. 2, w 1,3, `cond: () => player.form === forma`). Las genera `ArcanoForms.cards()`. Los niveles se quedan en `sk` y `traitsFor` los suma siempre.

| id | Forma | Nombre | Por nivel |
|---|---|---|---|
| f_ignea | Ígnea | Fuego interior | burnK +0,1; deathBlast.r +10 |
| f_glacial | Glacial | Hielo perpetuo | frzChance +0,06 |
| f_voltaica | Voltaica | Relámpago en cadena | chainN +1; chainP +0,05 |
| f_toxica | Tóxica | Veneno añejo | poisonCap +0,2; puddle.max +1 |
| f_plasma | Plasma | Núcleo de plasma | plasmaArc.p +0,1; overR ×1,1 |
| f_aurora | Aurora | Luz polar | shards.n +2; freezeT +0,3 (no jefe) |
| f_mortaja | Mortaja | Sudario hondo | shroud.r +25; shroud.k +0,05 |
| f_azufre | Azufre | Venas de azufre | puddle.r +15; puddle.t +1 |
| f_eclipse | Eclipse | Horizonte negro | implode.r +25; implode.k +0,4 |

### 3.5 Las 8 Mezclas (fase 2, capa estilo Isaac)
- Se activan solas cuando la runa está a Nv1 o más y la carta también. No gastan elección.
- Si tu forma contiene ese elemento, `m = 1,25` (daño y radio); si no, `m = 1`.
- Las esquirlas y los proyectiles nuevos llevan `nofx`.

| id (bit) | Nombre | Receta | Efecto | Dónde | Visual |
|---|---|---|---|---|---|
| cometa (0) | Cometa | Fuego + Lanza de éter | Al atravesar a un enemigo: llamarada r40·m, 0,5×atk·m y fuego a los cercanos (ficha `comet`) | `shotHit`, rama `pierce` | estela len ×1,45, color `#ff8a3d` |
| halo (1) | Halo solar | Fuego + Orbes guardianes | Los orbes queman al contacto. Cada 2 s, cada orbe lanza un anillo r70·m de 0,6×atk·m | `updatePlayer` (orbes) y `updateForms` | orbe de 9 px con corona `#ffb347` |
| glaciar (2) | Glaciar | Hielo + Rebote | Al rebotar en un muro o roca, el disparo se parte una vez en 2 (±25°) con el 60% del daño cada uno (`split`) | `updateShots`, rama `wall` | rombos `#e6fbff` |
| granizo (3) | Granizo | Hielo + Salto arcano | En cada salto, 2 esquirlas a ±35° (0,35×atk·m, hielo, vida 0,35 s) | `shotHit`, rama `rico` | triángulos `#e6fbff` |
| anillo (4) | Anillo voltaico | Rayo + Orbes guardianes | Arcos entre orbes consecutivos (o orbe↔mago si solo hay uno). Cada 0,3 s, los enemigos a <r+10 del segmento reciben 0,5×atk·m y `shock≥1,5` | `updateForms` | zigzag `#ffe45c` de 4 tramos, regenerado cada 0,1 s |
| chispazo (5) | Chispazo | Rayo + Concentración | Cada crítico: `chainLightning(e, dmg×.5·m, 3, 200)` (ficha `spark`) | `shotHit` | capas `sky` |
| contagio (6) | Contagio | Veneno + Salto arcano | Al saltar, `next.poisonDps = max(next.poisonDps, e.poisonDps)` | `shotHit`, rama `rico` | estela verde en el salto |
| aguijon (7) | Aguijón | Veneno + Abanico | Los disparos en diagonal son agujas: velocidad ×1,3, +1 de perforación y veneno ×2 por impacto | `spawnShot(…,'diag')` y `applyElements(e,els,mul)` | aguja de 14×3 px `#8dff6a` |

- **Receta oculta:**
  - la carta que completaría una Mezcla no descubierta pone "Algo reacciona…" (`.combo.mix`); si ya está en `grim.m`, pone "Mezcla: Cometa";
  - peso ×1,3 en `rollSkills` para la pieza que falta de una Mezcla de tus elementos;
  - al activarse: texto flotante "MEZCLA: COMETA" en su color, aviso con la receta y `Sfx.mix()` (`tone(990,.18,'triangle',.08,1.6)`); si es nueva, se marca el bit y se comprueba el logro `mixes8`.

### 3.6 Capa 0 (fase 2): cada carta se ve en el disparo
Solo cambian parámetros dentro de `shotStyle`; no hay trazos nuevos.
- Poder (`atk`): radio del núcleo `5,5 + 0,4·nv` (máx. 7,9) y glow `17 + 1,5·nv`.
- Concentración: centro blanco de 2,8 a `2,8 + 0,2·nv` (máx. 3,6).
- Lanza de éter: núcleo en elipse 1,4:1 orientada (`ctx.ellipse` con ángulo, sin save/rotate).
- Rebote: contorno de 1,5 px con el color secundario.
- Eco arcano: las ráfagas del eco usan `styEcho` con alfa 0,7.

---

## 4. Momento de transformación

### 4.1 Micromomentos previos
- **Afinidad** (sin pausa): `burst` con los 2 colores, anillo de 10 a 90 px, `Sfx.fuse`, aviso en cola y cinta bicolor.
- **Ánima llena:** `Sfx.formReady(key)` (3 notas triangle: key, ×1,26, ×1,5, separadas 0,08 s); `vibrate(30)`; texto "¡DESPERTAR LISTO!" `#fff1c4` sobre el mago; el anillo pasa a `.animafull` (gradiente de 4 colores girando).
- **Panel** (`openAwaken`, state `levelup`, `lockUntil +600 ms`):
  - título "DESPIERTA" (o "SEGUNDO DESPERTAR") en dorado; subtítulo "Elige tu elemento · no hay vuelta atrás";
  - mini-rombo opcional (`.rombo`, 110 px);
  - cartas `.card.awaken` en el orden del cuadrado;
  - botón "Aún no".
- **Contenido de cada carta:**
  - icono del elemento y nombre "Fuego → FORMA ÍGNEA", o "Fuego → ???" si no está descubierta;
  - una línea de efecto (siempre visible);
  - como mucho 1 línea extra, por esta prioridad: sellado > Sintonía > Linaje.

### 4.2 La transformación (tiempo real 1,4 s; state sigue en `'play'`)
| t real | Escala del mundo | Qué pasa |
|---|---|---|
| 0,00 | ×0,15 | `pickSkill('awk:el')` → `startAwaken(el)`. Además: `hideOverlay`; `awakenFx={t:0, el, st, boom:false}`; `player.inv=max(inv,2)`; entrada bloqueada (`moveInput` da 0 y no hay trampas); `musicHoldT=1.4` y `setIntensity(0)` (silencio); `Sfx.awakenCharge()` (sierra de 220 a 880 Hz en 0,9 s más 3 tonos `noise` crecientes); `vibrate(20)` |
| 0,00–0,90 | ×0,15 | Levita 0→12 px (easeOut) con la capa hacia arriba. 3 anillos se cierran de 160 a 20 px con los colores de la pareja (dorado `#fff1c4` en el 1º si no hay pareja). 36 partículas en espiral hacia el mago (14 en calidad baja). Oscuridad del mundo de 0 a 0,35 (rect `#05030a`, dibujado bajo el mago). Zoom del mundo de 1 a 1,12 centrado en el mago (solo el mundo, no el HUD). `shake` sube de 0 a 6 |
| **0,90** | — | **ESTALLIDO:** `awaken(el)`, la paleta cambia en este fotograma. `screenFlash` blanco de 0,15 s y luego el color de la forma 0,45 s. Onda de 20 a 220 px (w 8, color de la forma) más un anillo blanco de 20 a 160. `burst` de 60 partículas con los colores del aura (24 en calidad baja). Se borran las balas. `shake` 14 (18 en el 2º). `vibrate(120)` (200 en el 2º). `Sfx.awakenBoom(st,key)`: 1º, acorde de 3 notas (key, ×1,5, ×2, sine, 0,6 s); 2º, arpegio de 5 notas (×1, 1,25, 1,5, 2, 2,5; paso 0,06 s); después `boom`. Música: `setIntensity(1)` y `musicHoldT=6` |
| 0,90–1,40 | rampa de 0,15 a 1 (easeInOut) | El zoom vuelve a 1, la levitación a 0 y la oscuridad a 0 |
| 1,40 | ×1 | `awakenFx=null`. `banner={text:short, sub:line, color, t:2.6}`. Si es la primera vez: aviso "¡NUEVA FORMA! · Grimorio n/10" y logros (aviso DOM existente). Se desbloquea la entrada |

**Variante Eclipse:**
- destello `'10,0,20'` de 0,25 s y luego violeta `'199,125,255'` de 0,5 s;
- `tone(55,1.5,'sine',.15)` y arpegio descendente en menor desde 622 Hz;
- `eclipseFx={t:3}`: 24 esquirlas de sombra (rombos `#1a1024` con filo `#c77dff`, composición normal) que caen;
- la primera vez: `banner` "LA FORMA PROHIBIDA" (1,2 s) y luego, mediante `bannerNext`, "ECLIPSE".

Después:
- el botón del definitivo toma el color y el icono de la forma;
- pausa: "Forma: AURORA · Rayo + Hielo";
- final: "Ganaste como Plasma" o "Caíste como Mortaja".

---

## 5. Meta

### 5.1 Principio
Ninguna forma se bloquea detrás de misiones: el pico emocional tiene que llegar el primer día. Lo coleccionable es conocimiento (Grimorio), aspecto (Coronas) y títulos. La esencia solo llega con 7 logros que se cobran una vez (100 en total). Los logros actuales suman 445 y una partida media da unos 30.

### 5.2 Misiones medibles (Maestrías, fase 3; los contadores se graban desde la fase 1)
| Marca | Condición | Contador |
|---|---|---|
| I · Despertada (todas) | Despertar esa forma una vez | `grim.f` (bit) |
| II · Forma pura | Despertarla en la sala 6 o antes | `grim.e` (bit; en `discoverForm` si `st===1 && room<=6`) |
| II · Combinada y Eclipse | Ganar una partida en esa forma | `grim.w` (bit; en `showEnd(win)`) |
| II · Aprendiz | Ganar sin despertar | `grim.w` bit 0 (`awak===0 && win`) |
| Contador | Despertares por forma | `grim.n` (10 dígitos 0-9, tope 9) |
| Ritmo | Sala media del 1º y 2º despertar | `grim.k = [s1,n1,s2,n2]` |

- Premio de la Marca II: **Corona** (aro de 2 px del color de la forma sobre el sombrero, solo en esa forma), su nombre en dorado en el banner y un **título** que se elige en el Grimorio (`grim.t`) y se muestra bajo el logo del menú y en la pantalla final.
- Títulos: Aprendiz "Sin Forma", Ígnea "Llama Viva", Glacial "Invierno Quieto", Voltaica "Trueno Errante", Tóxica "Paciencia Verde", Plasma "Estrella Caída", Aurora "Luz del Norte", Mortaja "Sudario Blanco", Azufre "Boca de Volcán", Eclipse "Sin Equilibrio".

### 5.3 Logros nuevos (añadir al final de `ACHIEVEMENTS`)
| id | Nombre | Descripción | Esencia | Fase |
|---|---|---|---|---|
| awaken1 | Despertar | Despierta una forma por primera vez | 5 | 1 |
| awaken2 | Alma doble | Alcanza una forma combinada | 10 | 1 |
| hybrids | Cuatro caminos | Descubre las 4 formas híbridas | 15 | 1 |
| eclipse | Equilibrio roto | Despierta la forma prohibida | 15 | 1 |
| forms10 | Grimorio de formas | Descubre las 10 formas | 25 | 1 |
| formWins | Mil caras | Gana con las 5 formas combinadas | 20 | 1 |
| mixes8 | Mezclador | Descubre las 8 Mezclas | 10 | 2 |

`reactAll`: la descripción pasa a "Provoca las 6 reacciones elementales" (la comprobación ya usa `REACTIONS.every`).

### 5.4 Grimorio (botón en el menú y `state='grimoire'`)
- **Menú:**
  - fila 2: "Grimorio n/10" | "Logros n/N";
  - fila 3 nueva: "Ajustes" en solitario.
- **Pantalla:** patrón `.panel.shop`, con pestañas `data-act="grim" data-tab`:
  - **Formas** (10):
    - arriba, `.rombo` con los 4 elementos y los nombres de las híbridas descubiertas en los lados;
    - debajo, 10 `.shop-item.grim`:
      - **sin descubrir:** icono con `filter:brightness(0)` y "???". Las puras muestran el icono del elemento. Las híbridas muestran la receta ("icono A + icono B · ???"). Eclipse aparece en blanco: "??? — La forma prohibida. Algo duerme entre los opuestos";
      - **descubierta:** nombre en su color, receta, frase, rasgo (1 línea), definitivo, "Despertada N veces", marcas I/II y "Lucir título" si tiene la Marca II.
  - **Reacciones** (6): desde `stats.reactSeen`.
  - **Mezclas** (8, fase 2): sin descubrir, icono de la runa y "???"; descubierta, nombre, receta y efecto.
- Contador general en el subtítulo: "Grimorio 9/24 · 37%" (fase 1: 16 entradas).

### 5.5 Pausa, final y estadísticas
- **Pausa:**
  - línea `formLine()`: "Forma: PLASMA · Fuego + Rayo", o "Aprendiz · Afinidad: Fuego + Rayo · Despertar 64%";
  - en `reactionList`, las parejas fuera de `aff` (con la Afinidad sellada) se muestran como "Cerrada esta partida".
- **Final:**
  - emblema "Ganaste como X" o "Caíste como X";
  - "Te faltan: icono+icono ???, …, ???" (máximo 4 elementos y luego "+N");
  - "Nueva página del Grimorio" si la hubo.
- **Estadísticas:** filas "Formas n/10" y "Despertar medio: sala a / b" (desde `grim.k`).

### 5.6 Guardado
`meta.grim = { f:1, w:0, e:0, m:0, n:'0000000000', k:[0,0,0,0], t:-1 }`. Ocupa unos 90-120 caracteres codificados en la cookie.

`settings.tips = {}` (`aff`, `opp`, `anima`, `mix`). El botón "Repetir tutorial" y `resetProgress` lo vacían.

---

## 6. Plan de integración

### 6.0 Reglas
- Otro proceso edita game.js: antes de cada bloque, `grep -n "function <nombre>"` y bajar la versión actual. No editar en paralelo.
- Si `window.ArcanoForms` no carga, `Forms()` devuelve null y el juego queda como hoy: sin tope, sin Ánima y con el dibujo de siempre.
- `flags.noForms` (solo en debug) hace lo mismo para comparar.

### 6.1 Archivos
| Archivo | Cambio |
|---|---|
| `public/forms.js` | NUEVO (unas 450 líneas): datos, lógica pura y dibujo |
| `public/game.js` | Enganches (6.3) |
| `public/style.css` | Anillo, cartas, rombo y Grimorio (6.4) |
| `public/index.html` | `<script src="forms.js"></script>` entre `equipment.js` y `game.js` |
| `public/sw.js` | `CACHE='arcano-v3'` y `'forms.js'` en `PRECACHE` |
| `public/equipment.js` | Textos de los perks `startRune:*` (2.3.7) |

### 6.2 API de `window.ArcanoForms`
```js
// Constantes
SQUARE: ['fire','bolt','ice','poison']
OPP: { fire:'ice', ice:'fire', bolt:'poison', poison:'bolt' }
IDS: ['aprendiz','ignea','glacial','voltaica','toxica','plasma','aurora','mortaja','azufre','eclipse'] // índice = bit
TIER1: { fire:'ignea', ice:'glacial', bolt:'voltaica', poison:'toxica' }
PAIR: { 'bolt|fire':'plasma', 'bolt|ice':'aurora', 'ice|poison':'mortaja', 'fire|poison':'azufre', 'fire|ice':'eclipse', 'bolt|poison':'eclipse' }
ANIMA: { need:[100,160], kill:2, elite:6, minion:.5, react:1.5, reactCap:12, boss:40, clean:5, arcane:1.25, wait:.8, glowAt:.8 }
FORMS: { [id]: { id, bit, tier:0|1|2, name, short, line, icon, color, key, pal, aura, ambient, shot, voice, trait, card, ult } }
MIXES: [ { id, bit, el, card, name, desc } ]   // 8
// Lógica pura
isOpp(a, b) -> boolean
formFor(core, second?) -> id                    // second null -> TIER1[core]
traitsFor(core, second, sk) -> object          // copia: puro(core) + combinado + cartas f_*
options({ stage, aff, core, pact }) -> [{ el, form, locked, why:'pact'|null, seals:[a,b]|null }]
sealInfo(aff, el) -> { form, opp, closes:[x,y] } | null   // aff.length===1 && !aff.includes(el)
bit(id) -> int;  has(mask, id) -> bool;  count(mask) -> int
cards() -> [{ id:'f_ignea', form:'ignea', icon, name, max:2, w:1.3, desc }]
activeMixes(sk) -> mix[];  mixHint(cardId, sk, aff) -> mix|null
// Visual (necesita bind)
bind({ glow, circle, ellipse, blob, star, rgba, lowQ })
look(id, p, EL) -> pal                          // resuelve band/gem del Aprendiz; caché por id|school|aff
shotStyle(id, sk, echo, cols, mixIds) -> sty    // caché por clave; trailA/trail2A rgba precalculados
hatGrad(ctx, pal, r) -> CanvasGradient          // coordenadas locales (-r..r); caché por pal.id|r
drawAura(ctx, p, id, t, anima01)                // antes de shadow(p)
drawShot(ctx, a, t) -> boolean                  // false = que dibuje el código antiguo
drawOrb(ctx, x, y, id, t, mix)                  // mix = {halo, anillo}
drawPool(ctx, pool, t)
drawAwaken(ctx, fx, p, t)                       // anillos convergentes, espiral, esquirlas de Eclipse
ambient(id) -> { color, every, vx:[a,b], vy:[a,b], life, size:[a,b], normal? } | null
BOLT_LAYERS: { plasma: [[6,'rgba(255,90,209,.35)'],[2,'#fff0ff']] }
```
- Regla de `options`: ver 2.6, 2.7 y 2.8. El orden de salida es el de SQUARE.
- `traitsFor` hace un `Object.assign` superficial por clave de nivel superior: el `puddle` de Azufre sustituye al de Tóxica. Después aplica `card.apply(t, lv)`.
- `drawShot`: estela con 2 trazos `lighter` (`sty.trailA`, longitud `16·len` y `30·len`), un glow y como mucho 2 rellenos según `sty.shape`. Con `lowQ`, glow más círculo.

### 6.3 game.js, función por función

| Zona (línea aprox.) | Cambio |
|---|---|
| Arriba (~46) | `const Forms = () => window.ArcanoForms; const flags = { noForms:false }; const FX = () => !flags.noForms && Forms();` |
| `Sfx` (51-139) | Añadir `formReady(key)`, `awakenCharge()`, `awakenBoom(st,key,eclipse)`, `shootV(v)` (gate 60 ms; `tone(v.f,.09,v.type,.05,v.slide)` y `v.f2`), `mix()` |
| `REACTIONS` (191) | Añadir NECROSIS al final |
| `ACHIEVEMENTS` (223) | Los 7 logros y el texto de reactAll |
| Tras `SKILLS` (252-275) | `if (window.ArcanoForms) for (const c of ArcanoForms.cards()) SKILLS.push({ ...c, cond: () => player && player.form === c.form });` antes de `SKILL_BY_ID` |
| Globales (312-337) | `let awakenFx=null, eclipseFx=null, awakenWait=0, musicHoldT=0, toastQ=[], bannerNext=null, pools=[], curtains=[], fog=null, pactRun=false, roomReactA=0, ambT=0, fxDepth=0; const tok={blast:3,arc:5,implode:6,comet:6,spark:4,shard:1}; const seenMixes=new Set();` |
| `META_DEFAULT` (342) | `grim:{ f:1, w:0, e:0, m:0, n:'0000000000', k:[0,0,0,0], t:-1 }` |
| `loadMeta` (347) | `m.grim = Object.assign(META_DEFAULT().grim, s.grim);` y validar tipos (`n` de longitud 10, `k` con 4 números) |
| `SETTINGS_DEFAULT` (40) | `tips: {}` |
| keydown (452) | Escape: `if (state==='levelup' && pickSource==='awaken') awakenLater();` y añadir `'grimoire'` a la lista de `goBack`. Los dígitos ya funcionan (`data-act="pick"`) |
| storage (472) | `else if (state==='grimoire') showGrimoire(grimTab);` |
| `newPlayer` (672) | `form:'aprendiz', core:null, second:null, aff:[], awak:0, anima:0, animaReady:false, snoozeRoom:-1, fusedLv:0, tr:{}, sty:null, styEcho:null, mixes:[], god:false, orbT:0, arcT:0, shroudT:0` |
| `gainMana` (686) | Color del texto: `formColor()` |
| `castUlt` (704) | `const k = ultKey()` sustituye a `player.school` en las ramas. Anillo con `ultColor()`. `player.atk` → `uAtk()`. Fase 2: ramas `sun/curtain/fog/sulfur/void`. La Ventisca usa `freezeEnemy(e, rand(2.8,3.3), 1.8, true)` |
| `updateUlts` (759) | `uAtk()`. `sing.kind` (`sun`: rayos y explosión, sin atracción; `void`: r400, 0,5/0,25 s y final de 12). `meteors` con `m.dmg ?? 12`, `m.r` y `m.pool`. `curtains` y `fog` |
| `recalc` (822) | Al final: `player.atk *= (1 + .06*Math.min(4, player.fusedLv)) * (player.tr.atkMul||1); refreshStyle();` |
| `hurtPlayer` (850) | Primera línea: `if (player.god) return;` (debug) |
| `spawnShot` (923) | Firma `spawnShot(x,y,a,dmg,sty,kind)`. `els/col/col2` salen de `player.shotEls/shotCol/shotCol2` (calculados en `refreshStyle`). Campos `sty`, `pierce: s.pierce + (tr.pierce||0)`, `nofx:false`, `split:false`. Aguijón si `kind==='diag'`. Sol negro: `dmg *= 1.5` |
| `fireVolley` (937) | Firma `fireVolley(target, echo=false)`; `sty = echo ? player.styEcho : player.sty`. Las diagonales pasan `'diag'`. `Sfx.shootV(FORMS[form].voice)` sustituye a `Sfx.shoot()` |
| `updatePlayer` (959) | `const [mx,my] = awakenFx ? [0,0] : moveInput();`. Trampas solo si `!awakenFx`. Ráfagas del eco: `fireVolley(t, true)`. Orbes: Halo (fuego al contacto) |
| `makeEnemy`/`makeBoss` (1027/1052) | `frzImm:0, corrMul:0` |
| `updateEnemy` (1113) | `if (e.frzImm > 0) e.frzImm -= dt;` junto a los demás temporizadores |
| `damageEnemy` (1421) | Congelado: `dmg *= player.tr.frozenMul || 1.3`. Corrosión: `e.corrMul || 1.4`. Jefe: `gainAnima(Math.min(dmg, Math.max(0,e.hp))/e.maxHp*ANIMA.boss)` calculado antes de restar |
| `killEnemy` (1432) | Tras `gainMana`: `if (!isBoss && !e.wiped) gainAnima(e.minion?.5:e.elite?6:2)`. En la rama de jefe: redes (a), (b) y (c). Tras `if (e.wiped) return;`: `formDeath(e)`, que gestiona deathBlast (si `e.burn>0`, ficha `blast` y `fxDepth===0`), charco (`e.poisonDps>0`, o `e.burn>0` con azufre) y esquirlas (`e.frozen>0`) |
| `chainLightning` (1499) | Firma `chainLightning(src, dmg, n=2, r=200)` |
| `applyElements` (1515) | Firma `(e, els, mul=1)`. Quemadura `burnK·s.fire` y `burnT`. `slow = tr.slowT||1.8`. Veneno: `cap = atk·(tr.poisonCap||.8)·s.poison` y paso `atk·(tr.poisonK||.1)·s.poison·mul` |
| `react` (1539) | `e.reactCd = e.kind==='boss' ? 1 : (tr.reactCd||1)`. Ánima con `roomReactA`. Vapor: `tr.vaporK||3`. Sobrecarga: `overR/overK`. Congelación: `freezeEnemy(e, tr.freezeT||1.6, tr.freezeBossT||.7)`. Corrosión: `corrMul/corrT`. Combustión: `combR/combK`. NECROSIS. Al final, implosión si `tr.implode` y queda ficha. Primer aviso con `pushToast` |
| `shotHit` (1581) | Orden nuevo:<br>1. `prev`; luego `rx = (tr.firstHit && e.kind!=='boss' && !ar.nofx) ? prev ∪ ar.els : prev`<br>2. daño; Chispazo si es crítico<br>3. retroceso<br>4. bucle de reacciones con `rx` (si `!ar.nofx`)<br>5. `applyElements`<br>6. si `!ar.nofx`: Glacial (`prev.ice`), Arco de plasma (`prev.fire`: ya ardía antes del impacto, ficha `arc`) y cadena (`(tr.chainP||.16)·sk.bolt`, `chainK/N/R`)<br>7. rama `rico` (Granizo, Contagio) y rama `pierce` (Cometa) |
| `updateShots` (1620) | Glaciar en el rebote: se apila en `newShots` y se concatena después del bucle (nunca `push` dentro del `for…of`) |
| `updateBullets` (1652) | `const k = fog ? .5 : 1;` en el movimiento |
| `updateFx` (1742) | Toast: `if (toast && !cine) toast.t -= dt;` y al acabar `toast = toastQ.shift() || null`. Banner: al acabar, `banner = bannerNext; bannerNext = null`. `eclipseFx.t` |
| `nextRoom` (1904) | `pools=[]; curtains=[]; fog=null; roomReactA=0; awakenWait=0;` |
| `onCleared` (1921) | `if (!roomHit && (BOSSES[room] || !ALTAR_ROOMS.has(room))) gainAnima(ANIMA.clean);` |
| `newRun` (1932) | `pactRun=false; toastQ=[]; bannerNext=null; awakenFx=null; eclipseFx=null; musicHoldT=0; seenMixes.clear();` |
| `pickSchool` (1982) | Bucle de perks reescrito (2.3.7) con `aff`, `fusedLv` y avisos. Al final, `refreshMixes()` |
| `syncUlt` (2003) | Color e icono desde `ultColor()/ultIcon()`. Llama a `syncForm()` |
| `update` (2029) | Intensidad: `musicHoldT=max(0,musicHoldT-dt); if ((intensityT -= dt) <= 0 && musicHoldT <= 0) {…}`. Tras `updateUlts`: `updateForms(dt)`. Los abridores llevan `&& !awakenFx`. Tras el `else if (bonusPicks…)`: `else if (canOfferAwaken(dt)) openLevelUp('awaken');` |
| `frame` (2119) | `if (awakenFx && state==='play') updateAwaken(dt);` y luego `update(dt * (awakenFx ? awakenScale(awakenFx.t) : slowT>0 ? .28 : 1))`, con `awakenScale = t<.9 ? .15 : .15 + .85*ease(min(1,(t-.9)/.5))` |
| `drawPlayer` (2667) | `const L = FX() ? Forms().look(p.form,p,EL) : null`. Sustituir los 9 colores fijos por `L.*` (con valores por defecto los actuales). El sombrero se dibuja con `ctx.save(); ctx.translate(x,0)` y `Forms().hatGrad`. Cinta bicolor con 2 rellenos. `Forms().drawAura` antes de `shadow(p)`. Levitación `y -= lev`. Grietas, ojos y Corona |
| `drawShots` (2967) | `if (!(FX() && Forms().drawShot(ctx,a,clock))) {código actual}` |
| `drawOrbs` (3000) | `Forms().drawOrb(…)`. Arcos del Anillo voltaico |
| `drawBolts` (3070) | `const layers = b.layers || (b.sky ? … : …)` |
| `drawHUD` (3110) | `else if` con la pista de opuestos bloqueados (cuando `cleared`). Pista "¡Definitivo listo!" con `ultColor()` |
| `render` (3225) | Tras el `shake`: zoom si `awakenFx`. Tras `drawHazards`: `drawPools()`. Tras `drawDrops`: oscuridad de la cinemática y de Sol negro. Tras `drawParts`: `Forms().drawAwaken`. Tras `vignetteSpr`: viñeta de Eclipse |
| `unlocksWith`/`reactionList` (3290) | "Cerrada esta partida" |
| popstate (3355) | `'grimoire'` en la lista; `levelup`+`awaken` → `awakenLater()` |
| `showMenu` (3363) | Filas nuevas (5.4). Título (fase 3). `awakenFx=null; eclipseFx=null; pools=[]` |
| `resetProgress` (3468) | `settings.tips = {}` |
| `showStats` (3626) | 2 filas nuevas |
| `rollSkills` (3680) | Filtro `!(k.el && sealed && !aff.includes(k.id))`. Pesos en un array local: ×1,5 a las runas propias por debajo del máximo y ×1,3 a la pieza que falta de una Mezcla |
| `openLevelUp` (3692) | `if (src==='awaken') return openAwaken();`. Por carta, `cardLines(k)` (sellado de 2 líneas > Mezcla > desbloquea) y clases `seal/hot` |
| `pickAltar` (3756) | Pacto: `pactRun=true; player.snoozeRoom=-1;`. Ofrenda de maná: `ultName()` |
| `pickSkill` (3845) | Primera línea: `if (id.startsWith('awk:')) return startAwaken(id.slice(4));`. Si `k.el && FX() && !aff.includes(id)` → `addAffinity(id)`. Si es `f_*` → recalcular `tr`. Después de `recalc`: `refreshMixes()` |
| `showPause` (3864) | `formLine()` |
| `showEnd` (3882) | Bits `w`/`e`, `formWins`, emblema y "Te faltan" |
| Clics (3942) | `'later'` → `awakenLater()`; `'grimoire'` → `showGrimoire('formas')`; `'grim'` → `showGrimoire(el.dataset.tab)`; `'title'` → `grim.t` |

**Funciones nuevas** (ponerlas tras `gainMana`, ~690, salvo las de dibujo):
```js
function freezeEnemy(e, t, tb, force) { if (e.kind==='boss') { if (e.frzImm>0 && !force) return false; e.frozen=tb; e.frzImm=tb+2; } else e.frozen=Math.max(e.frozen,t); unfade(e); return true; }
// (revisión) cola de 8; los consejos llevan tip/hz y se dan por vistos al SALIR en pantalla (showToast), no al encolarse
function pushToast(o) { if (!toast) toast=o; else { toastQ.push(o); if (toastQ.length>3) toastQ.shift(); } }
// (revisión) sin Ánima en la sala final (room>=TOTAL_ROOMS); el consejo solo si no se llena de golpe, y dropTip('anima') al quedar listo
function gainAnima(v) { const p=player, F=FX(); if (!F||!p||p.awak>=2||p.animaReady) return;
  p.anima += v*(p.school==='arcane'?F.ANIMA.arcane:1); const need=F.ANIMA.need[p.awak];
  if (!settings.tips.anima && p.anima>=need*.5) { settings.tips.anima=1; saveSettings(); pushToast({text:'DESPERTAR', sub:'El anillo del definitivo se llena con bajas, reacciones y jefes', color:'#fff1c4', t:3, max:3}); }
  if (p.anima>=need) { p.anima=need; p.animaReady=true; Sfx.formReady(F.FORMS[p.form].key); vibrate(30); addText(p.x,p.y-50,'¡DESPERTAR LISTO!','#fff1c4',.8); } syncForm(true); }
function fillAnima() { if (player.awak<2 && !player.animaReady) gainAnima(1e9); }
function addAffinity(el, silent) { const a=player.aff; if (a.includes(el)||a.length>=2) return; a.push(el); if (a.length===2) onAffinity(silent); }
function canOfferAwaken(dt) { const p=player, F=FX();
  if (!F||!p.animaReady||awakenFx||state!=='play'||winTimer>=0||cine||slowT>0||!cleared||p.snoozeRoom===room) { awakenWait=0; return false; }
  const o=F.options({stage:p.awak+1, aff:p.aff, core:p.core, pact:pactRun}); p.awkLock=!o.some(x=>!x.locked);
  if (p.awkLock) return false; return (awakenWait+=dt) > F.ANIMA.wait; }
function startAwaken(el) { hideOverlay(); state='play'; last=performance.now(); resetJoy(); awakenFx={t:0,el,st:player.awak+1,boom:false}; player.inv=Math.max(player.inv,2); musicHoldT=1.4; try{ArcanoMusic.setIntensity(0)}catch(_){} Sfx.awakenCharge(); vibrate(20); }
function awakenLater() { hideOverlay(); state='play'; last=performance.now(); player.snoozeRoom=room; Sfx.click(); }
function updateAwaken(dt) { const f=awakenFx; f.t+=dt; if (!f.boom && f.t>=.9) { f.boom=true; awaken(f.el); boomFx(f); } if (f.t>=1.4) { awakenFx=null; announceForm(f); } }
function awaken(el) { const p=player, F=Forms(), st=p.awak+1;
  if (st===1) p.core=el; else p.second=el; addAffinity(el, true);
  const sync=(p.sk[el]||0)>=2; p.sk[el]=Math.min(2,(p.sk[el]||0)+1);
  p.awak=st; p.form=F.formFor(p.core, p.second); p.anima=0; p.animaReady=false; p.snoozeRoom=-1;
  p.tr=F.traitsFor(p.core, p.second, p.sk);
  if (st===2 && p.tr.hpMul) { p.maxHp=Math.max(40,Math.round(p.maxHp*p.tr.hpMul)); p.hp=Math.min(p.hp,p.maxHp); }
  if (sync) { p.mana=100; pushToast({text:'SINTONÍA', sub:'Runa al máximo: definitivo lleno', color:F.FORMS[p.form].color, t:2.2, max:2.2}); }
  recalc(); refreshMixes(); syncUlt(true); syncForm(true); discoverForm(p.form, st); }
```
- `ultKey()` = `awak===2 && COMBINED_ULTS ? form : awak>=1 ? core : school`.
- `ultColor()` = `awak ? FORMS[form].color : EL[school].color`.
- `ultIcon()` / `ultName()`: según la clave (SCHOOLS[clave] o FORMS[form].ult).
- `linaje()` = `school!=='arcane' && (core===S.el || second===S.el)`.
- `syncForm(force)`: fija `--a = round(anima/need·100)`, `--ac` (`#fff1c4` antes del 1º despertar, color de la forma después) y las clases `anima` (si `FX() && awak<2`), `animafull` y `animalock`. Usa caché `animaShown`.
- `updateForms(dt)`:
  - recarga de fichas;
  - ticks de `pools` cada 0,5 s;
  - Sudario cada 0,5 s;
  - Anillo voltaico cada 0,3 s y Halo cada 2 s;
  - partículas de ambiente (cada `ambient.every`, ×2,5 en calidad baja, recortando `parts` a 500/180);
  - `curtains` y `fog`.
- `discoverForm(id, st)`: bits `f`/`e`, `n++`, `k`, logros y `saveMeta`; guarda `awakenFx.first`.

### 6.4 style.css
```css
.ult-btn::before{content:'';position:absolute;inset:calc(var(--u)*-9px);border-radius:50%;pointer-events:none;opacity:0;transition:opacity .3s;
 background:conic-gradient(var(--ac,#fff1c4) calc(var(--a,0)*1%),rgba(255,255,255,.10) 0);
 -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - var(--u)*5px),#000 calc(100% - var(--u)*5px));
 mask:radial-gradient(farthest-side,transparent calc(100% - var(--u)*5px),#000 calc(100% - var(--u)*5px));}
.ult-btn.anima::before{opacity:1}
.ult-btn.animafull::before{background:conic-gradient(#ff8a3d,#ffe45c,#7fe3ff,#8dff6a,#ff8a3d);animation:animaSpin 1.6s linear infinite}
.ult-btn.animalock::before{background:#c77dff;opacity:.5}
@keyframes animaSpin{to{transform:rotate(360deg)}}
.card.awaken{border-color:var(--c);box-shadow:0 0 calc(var(--u)*14px) var(--c2)}
.card.awaken .ic{background:radial-gradient(circle,var(--c) -80%,rgba(0,0,0,.3) 70%)}
.card.awaken .nm b{color:var(--c2)}
.card.locked{opacity:.5;filter:grayscale(.5);cursor:default}
.card.seal{border-color:transparent;background:linear-gradient(#2e2548,#211a36) padding-box,linear-gradient(90deg,var(--c),var(--c2)) border-box}
.card .combo.close{color:#ff9a9a}.card .combo.mix{color:#8dffb0}
.btn.later{margin-top:calc(var(--u)*12px)}
.rombo{position:relative;width:calc(var(--u)*110px);height:calc(var(--u)*110px);margin:calc(var(--u)*6px) auto 0}
.rombo .v{position:absolute;font-size:calc(var(--u)*24px);opacity:.35}.rombo .v.on{opacity:1;filter:drop-shadow(0 0 6px var(--c))}
.grim-tabs{display:flex;gap:calc(var(--u)*8px);margin-top:calc(var(--u)*10px)}.grim-tabs .on{border-color:#ffcf4a}
.shop-item.grim.locked .ic{filter:brightness(0) drop-shadow(0 0 1px #6a5a9a)}.shop-item.grim .line{font-style:italic;opacity:.8}
```
La regla `.lefty .ult-btn` ya existente mueve también el anillo.

### 6.5 Claves de guardado
- `meta.grim` (5.6), `settings.tips`.
- Las partidas guardadas antiguas cargan con los valores por defecto.
- Probar `saveMeta` con 60 objetos: la cookie debe seguir conservando el equipo.

### 6.6 Debug (bloque `?debug`, ~4010)
| Función | Qué hace |
|---|---|
| `seed(n)` | `Math.random = mulberry32(n)`; `seed(null)` restaura el original |
| `school(id)` | `hideOverlay(); newRun(); pickSchool(id); return state` |
| `formInfo()` | `{form, core, second, aff, awak, anima, need, ready, tr, fusedLv, mixes, pactRun}` |
| `anima(v)` | Fija el Ánima y llama a `gainAnima(0)` |
| `awaken(el, fx=false)` | Con `fx` usa `startAwaken`; sin `fx`, llama a `awaken(el)` directamente |
| `offer()` | `player.animaReady=true; openLevelUp('awaken')` |
| `flags` | Referencia a `flags` (`noForms`) |
| `god(v)` | Además `player.god=v` (inmune a trampas) |
| `grim(reset)` | Devuelve `meta.grim`; con `reset`, lo vacía |
| `mix(id)` | Da la runa y la carta de esa Mezcla |
| `sim(cfg)`, `simMatrix(opts)`, `bench(cfg)` | Sección 7 |
| `step()` | Llama también a `updateAwaken(1/60)` si `awakenFx` |

---

## 7. Plan de pruebas

### 7.1 Bot de partida completa (`sim`, síncrono, sin render)
```js
sim(cfg) { const C = Object.assign({ school:'fire', path:[], pact:false, stop:2, noForms:false, maxT:900, seed:1 }, cfg);
  this.seed(C.seed); flags.noForms = C.noForms; hideOverlay(); newRun(); pickSchool(C.school); player.god = true;
  const L = { roomT:{}, ttk:{}, frz:{}, awk:[], net:[], offers:0, badOffer:0, maxShots:0, maxParts:0, maxAff:0 };
  let clT=0, idle=0, hpSum=0, bT=0, fT=0, rStart=0;
  for (let i=0; i<C.maxT*60; i++) {
    if (state==='play') { if (awakenFx) updateAwaken(1/60); update(1/60);
      L.maxShots=Math.max(L.maxShots,shots.length); L.maxParts=Math.max(L.maxParts,parts.length); L.maxAff=Math.max(L.maxAff,player.aff.length);
      if (boss && !boss.dead && boss.spawnT<=0) { bT+=1/60; if (boss.frozen>0) fT+=1/60; }
      if (cleared && !awakenFx) { clT+=1/60;
        if (altar && !altar.used) { player.x=altar.x; player.y=altar.y+12; }
        else if (clT>1.6 && room<TOTAL_ROOMS) { player.x=AX+AW/2; player.y=AY-30; } }
      else { clT=0; const s=enemies.reduce((a,e)=>a+e.hp,0); idle = s<hpSum-0.01 ? 0 : idle+1/60; hpSum=s;
        if (idle>3) { idle=0; const t=findTarget(); if (t) { const c=freeCellNear(t.x,t.y,140); if (los(c.x,c.y,t.x,t.y)) { player.x=c.x; player.y=c.y; } } } }
      if (bT && !boss) { L.ttk[room]=bT; L.frz[room]=fT/bT; bT=fT=0; } }
    else if (state==='transition') { const r=room; updateTransition(1/60); if (room!==r) { L.roomT[r]=runTime-rStart; rStart=runTime; } }
    else if (state==='levelup') botPick(C, L);
    else if (state==='altar') pickAltar(C.pact && !pactRun ? 'pact' : 'bless');
    else break; }
  return { cfg:C, win: state==='win', time: runTime, form: player.form, ...L };
}
```
`botPick`:
- `pickSource==='awaken'`: `L.offers++`; si `player.awak >= C.stop`, llama a `awakenLater()`; si no, elige `C.path[player.awak]` si está entre las opciones (si no, la primera) y registra `{st, room}` en `L.awk` mediante `pickSkill('awk:'+el)`.
- En los demás casos, con la Afinidad sellada, toda runa ofrecida fuera de `aff` suma `L.badOffer++`.
- Prioridad: la runa de `C.path[1]` (o `[0]` si es Arcanista), tus runas por debajo de Nv2, `atk, atkspd, front, multi, crit, pierce, ricochet, diag, orbs, f_*, hp, heal`, y por último la primera.
- `L.net` registra las redes de seguridad (instrumentar `fillAnima` con un contador de debug).

### 7.2 Matriz (`simMatrix({seeds:8})`, asíncrona, cede con `setTimeout(0)` entre partidas)
- **Base:** 5 escuelas con `noForms:true`.
- **Puras** (`stop:1`): fire/[fire], ice/[ice], bolt/[bolt], poison/[poison].
- **Híbridas, 8 rutas:** fire/[fire,bolt], bolt/[bolt,fire], bolt/[bolt,ice], ice/[ice,bolt], ice/[ice,poison], poison/[poison,ice], poison/[poison,fire], fire/[fire,poison].
- **Eclipse, 4 rutas:** fire/[fire,ice], ice/[ice,fire], bolt/[bolt,poison], poison/[poison,bolt], todas con `pact:true`.
- **Opuesto sin pacto:** fire/[fire,ice] con `pact:false` (debe quedarse en Ígnea, con `awkLock`).
- **Arcanista:** arcane/[fire,bolt], arcane/[ice,poison].
- **Traición a la escuela:** fire/[bolt,ice] (Aurora sin Linaje).

**Objetivos (mediana de 8 semillas):**
| Métrica | Objetivo |
|---|---|
| Victorias en modo dios | 100% |
| Tiempo por escuela (con formas) | 4:00–6:00 |
| Ninguna forma final más del 25% más rápida que la media | `t_forma ≥ 0,8 × media(formas)` |
| Formas contra base | `media(formas)/base` entre 0,80 y 1,00 |
| Sala del 1º despertar | 5–7 |
| Sala del 2º despertar | 11–14 |
| Uso de la red (b) | ≤ 15% |
| Uso de la red (c) | ≤ 20% |
| Congelación del jefe | ≤ 35% en todas las configuraciones |
| `badOffer`, `maxAff > 2` | 0 |
| `maxShots` | ≤ 200 |
| `maxParts` | ≤ 500 |

**Palancas de ajuste** (todas en forms.js): `ANIMA.need`, `ANIMA.react`/`reactCap`, cada `trait`, la DR (+2 s) y los multiplicadores de las Mezclas. Si Eclipse se elige más del 40% o es la más rápida: `atkMul` a 1,15 o `hpMul` a 0,8.

### 7.3 Banco de jefes (`bench({room, school, path, build:'mid', secs:90, seed})`)
- Preparación: `school()`, `god`, build media mediante `pickSkill` (atk×3, atkspd×2, front, multi, crit, hp×2, runas de la ruta a Nv2), despertares instantáneos con `awaken(el)` y `goto(room)`. Se mide desde `boss.spawnT<=0` y el jugador se queda quieto en el inicio.
- Objetivos con formas:
  - Brujo (15): 15–20 s; Señor (20): 25–35 s;
  - ninguna configuración por debajo del 60% del TTK base de su escuela;
  - congelación del jefe ≤ 35%.

### 7.4 Pruebas dirigidas (casos límite)
1. **Equipo:**
   - Piromante con Vara de Escarcha y Anillo del Escorpión: `aff=[fire,ice]`, `fusedLv=lv` del veneno, aviso en la sala 1 y ninguna runa de rayo ni de veneno ofrecida;
   - Arcanista con 2 perks: sella la pareja;
   - `fusedLv` nunca pasa de 4.
2. **Arcanista sin runas en el 1º despertar:** 4 opciones; elegir una la convierte en `aff[0]` y no cierra nada.
3. **Escuela con `aff` de 1 elemento en el 1º despertar:** elegir otro elemento sella la pareja; la carta lo avisa.
4. **"Aún no":** no vuelve a abrirse en esa sala; reaparece en la siguiente sala limpia; un Pacto en la misma sala lo reabre.
5. **Escape y Atrás de Android** en el panel equivalen a "Aún no". Las teclas 1-4 eligen. `__arcano.pick(i)` funciona.
6. **Orden de la oferta:**
   - con `pendingLevels>0`, primero los niveles;
   - con un cofre pendiente, primero el cofre;
   - durante `cine` o `slowT`, nunca;
   - en la sala 20 tras el jefe, nunca.
7. **Altar:** la oferta llega a los 0,8 s y el altar sigue usable después. Si los opuestos están bloqueados, no hay panel; hay pista, y tras el pacto aparece Eclipse.
8. **Pacto doble más Eclipse:** `maxHp ≥ 40` siempre.
9. **Cinemática:**
   - el jugador sobre lava o pinchos no recibe daño;
   - la puerta no se cruza;
   - pausar con `blur` y reanudar continúa la secuencia;
   - el `shake` se reinicia en los menús;
   - la música no baja antes de 6 s tras el estallido.
10. **NECROSIS:** el veneno queda a 0 tras la reacción, el daño está entre 1,5 y 4 (5)×atk y el contagio respeta `max`.
11. **Esquirlas de Aurora:** no congelan ni generan más esquirlas (`nofx`); no se crean con `shots ≥ 140`.
12. **Estallidos de Ígnea en cadena:** como mucho 3 cada 0,3 s.
13. **Guardado:**
    - un `meta` antiguo carga con `grim` por defecto;
    - la cookie con 60 objetos ocupa ≤ 3800 y conserva el equipo;
    - `resetProgress` borra `grim` y `tips`.
14. **Logros:** quien ya tenía `reactAll` lo conserva; `hybrids` no revela nombres; la esencia de los logros nuevos suma exactamente 100.
15. **Sin forms.js** (bloquear la petición): el juego es idéntico al de hoy y no hay errores en consola.
16. **Modo zurdo:** el anillo sigue al botón.

### 7.5 Móvil y rendimiento
- 360×640 y 375×812 (`resize_window`):
  - panel de despertar con 4 cartas y "Aún no" sin desplazamiento;
  - el menú con la nueva fila cabe;
  - las cartas de sellado no pasan de 3 líneas de texto.
- Calidad baja: proyectiles de círculo, ambiente ×0,4, FPS ≥ 55 en la sala 18 con Plasma y Aurora (Chrome con CPU 4× más lenta: ≥ 45).
- `glowCache.size` < 70 tras recorrer las 10 formas (`__arcano` puede exponerlo en debug).
- Daltonismo: comprobar en escala de grises que las 9 siluetas de proyectil se distinguen entre sí y de las balas enemigas en los 4 biomas.

### 7.6 Regresión
`simMatrix` con `noForms:true` antes y después de la fase 1. Los tiempos de la base solo deben cambiar por la DR de congelación en los jefes; anotar el delta del Criomante y del Electromante.

---

**Orden de entrega**
- **Fase 1:** forms.js (datos, lógica, paletas, proyectiles, auras básicas, voces), correcciones de 2.11, NECROSIS, Afinidad, Ánima y anillo, oferta, cinemática, 9 rasgos, Eclipse con pacto, Linaje, Sintonía, Grimorio (Formas y Reacciones), 6 logros, pausa y final, debug y bots.
- **Fase 2:** 5 definitivos combinados, 9 cartas de forma, 8 Mezclas, Capa 0, pestaña Mezclas y logro `mixes8`.
- **Fase 3:** auras completas (alas, cintas, esquirlas de sombra), Maestrías, Coronas y títulos, rombo del Grimorio y estadísticas de ritmo en pantalla.

Archivos de referencia: `E:\PROYECTOS\arcano\public\game.js`, `E:\PROYECTOS\arcano\public\equipment.js`, `E:\PROYECTOS\arcano\public\style.css`, `E:\PROYECTOS\arcano\public\sw.js`, `E:\PROYECTOS\arcano\public\index.html`. Archivo nuevo: `E:\PROYECTOS\arcano\public\forms.js`.