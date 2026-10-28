#!/bin/sh
# Barrido de calibración del ESQUIVADOR: tiempo de reacción y error sobre el perfil medio (fuego y hielo, sin formas, 6 semillas)
# Uso: CDP_PORT=9441 sh tools/esquivador-calibra.sh   → tools/esquivador-out/calibra.jsonl (TAG = configuración)
cd "$(dirname "$0")/.."
OUT=${OUT:-tools/esquivador-out/calibra.jsonl}
for R in 0.12 0.16 0.24 0.32 0.40; do
  TAG="react=$R" PROF="{\"react\":$R}" PROFILES=medio SCHOOLS=fire,ice FORMS=0 SEEDS=6 OUT=$OUT node tools/cdp.mjs 135 240 tools/esquivador.js | tail -1
done
# error ×k sobre el medio (posErr 6, angErr 0.08, dirErr 0.2)
for K in 0.5 2 3; do
  P=$(node -e "const k=$K;console.log(JSON.stringify({posErr:6*k,angErr:0.08*k,dirErr:0.2*k}))")
  TAG="err=x$K" PROF="$P" PROFILES=medio SCHOOLS=fire,ice FORMS=0 SEEDS=6 OUT=$OUT node tools/cdp.mjs 135 240 tools/esquivador.js | tail -1
done
