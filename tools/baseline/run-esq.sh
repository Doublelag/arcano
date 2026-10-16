#!/bin/bash
# Esquivador de la línea base: 40 partidas por fila (5 escuelas × semillas 11-18), con formas.
#   esq-fresco.jsonl   medio + bueno, cuenta nueva (80)      esq-veterano.jsonl   medio + bueno, META=veterano (80)
# Un Chrome por escuela y perfil (10 a la vez, puertos P0..P0+9).
# Uso: DEST=tools/baseline P0=9601 [CDP_URL=...] bash tools/baseline/run-esq.sh
# Informe: node tools/esquivador-report.mjs tools/baseline/esq-fresco.jsonl
cd /e/PROYECTOS/arcano
DEST=${DEST:-tools/baseline}; P0=${P0:-9601}
mkdir -p "$DEST/esq-tmp"
for META in fresh veterano; do
  i=0
  for PR in medio bueno; do for S in fire ice bolt poison arcane; do
    CDP_PORT=$((P0+i)) META=$META PROFILES=$PR SCHOOLS=$S FORMS=1 SEEDS=8 SEED0=11 TAG=base-$META OUT=$DEST/esq-tmp/$META-$PR-$S.jsonl \
      node tools/cdp.mjs 135 240 tools/esquivador.js > $DEST/esq-tmp/$META-$PR-$S.log 2>&1 &
    i=$((i+1))
  done; done
  wait
done
cat $DEST/esq-tmp/fresh-*.jsonl > $DEST/esq-fresco.jsonl
cat $DEST/esq-tmp/veterano-*.jsonl > $DEST/esq-veterano.jsonl
wc -l $DEST/esq-*.jsonl
