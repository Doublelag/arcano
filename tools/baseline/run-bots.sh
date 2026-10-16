#!/bin/bash
# Bots en modo dios de la línea base (o de la versión a comparar): matriz, partidas sueltas, banco de jefes y de salas.
# Uso: DEST=tools/baseline P0=9601 [CDP_URL=file:///.../index.html?debug] bash tools/baseline/run-bots.sh
# Después: node tools/baseline/compare.mjs tools/baseline <DEST>
cd /e/PROYECTOS/arcano
DEST=${DEST:-tools/baseline}; P0=${P0:-9601}
mkdir -p "$DEST"
CDP_PORT=$((P0+0)) PART=matrix OUT=$DEST/simMatrix.json node tools/cdp.mjs 360 640 tools/baseline/baseline.js &
CDP_PORT=$((P0+1)) PART=sims OUT=$DEST/sims.json node tools/cdp.mjs 360 640 tools/baseline/baseline.js &
CDP_PORT=$((P0+2)) PART=bench OUT=$DEST/bench.json node tools/cdp.mjs 360 640 tools/baseline/baseline.js &
CDP_PORT=$((P0+3)) PART=room OUT=$DEST/roomBench.json node tools/cdp.mjs 360 640 tools/baseline/baseline.js &
wait
CDP_PORT=$((P0+4)) node tools/cdp.mjs 360 640 tools/smoke.js > $DEST/smoke.txt 2>&1
CDP_PORT=$((P0+5)) SEED=7 node tools/cdp.mjs 360 640 tools/rev-econ.js > $DEST/rev-econ.txt 2>&1
echo BOTS TERMINADOS
