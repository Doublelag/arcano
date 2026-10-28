#!/bin/sh
# Matriz completa del ESQUIVADOR (≈40 min con un solo Chrome): 5 escuelas × sin/con formas × 8 semillas (6 en dios y novato, 4 en veterano)
#   medio + bueno (lo pedido) · dios (referencia de DPS) · novato (cota inferior) · veterano (Santuario + equipo raro)
# Uso: CDP_PORT=9441 sh tools/esquivador-matriz.sh   → tools/esquivador-out/matriz.jsonl
# Informe: node tools/esquivador-report.mjs tools/esquivador-out/matriz.jsonl   (META=fresh / META=veterano para separar)
cd "$(dirname "$0")/.."
OUT=${OUT:-tools/esquivador-out/matriz.jsonl}
S0=${SEED0:-11}
TAG=matriz PROFILES=medio,bueno FORMS=both SEEDS=8 SEED0=$S0 OUT=$OUT node tools/cdp.mjs 135 240 tools/esquivador.js
TAG=matriz PROFILES=dios FORMS=both SEEDS=6 SEED0=$S0 OUT=$OUT node tools/cdp.mjs 135 240 tools/esquivador.js
TAG=matriz PROFILES=novato FORMS=both SEEDS=6 SEED0=$S0 OUT=$OUT node tools/cdp.mjs 135 240 tools/esquivador.js
TAG=veterano META=veterano PROFILES=medio,bueno FORMS=1 SEEDS=4 SEED0=$S0 OUT=$OUT node tools/cdp.mjs 135 240 tools/esquivador.js
echo MATRIZ TERMINADA
