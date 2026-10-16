# Informe del agente que aplicó los arreglos

## Hecho
All fixes from docs/revision-despertar.md are applied in E:\PROYECTOS\arcano, with the duplicates grouped. Every fixed bug was reproduced first, and every regression test passes. Local commit b3ee74c "Despertar: arreglos de la revisión" (with the Co-Authored-By line). No push and no deploy.

The bug you saw (the "DESPERTAR · El anillo del definitivo se llena…" notice staying up during the transformation) is fixed:
- When the awakening becomes ready, that notice leaves the queue, and if it is on screen it fades out in 0.25 s.
- When the transformation starts, it is removed immediately.
- If the ring fills in one go (e.g. the safety fill after a boss), the notice does not appear at all.
- If it was on screen for less than 1 s, it is not counted as seen, so it shows again at 50% of the 2nd awakening.
- No notice is drawn or counted down during the transformation, the same as during the boss intro.

**Notice queue (1/4/9/11):**
- The queue now holds 8. If it overflows, a one-time tip is dropped first, since it will come back another time.
- When more than 2 are waiting, each notice runs at 1.5× speed.
- settings.tips.* and seenHz are only marked when the notice is SHOWN (new helper showToast; notices carry `tip`/`hz`).
- The same tip or trap notice cannot be queued twice.

**Achievement notice covering things (5/6/14):**
- Achievements wait while the awakening panel is open or about to open, during the transformation, and while the form name banner is up.
- When the panel opens, the achievement on screen moves out of the way. If it had been visible less than 1.5 s, it comes back afterwards.
- On the end screen, achievements show at the bottom (CSS class `.low`).
- After the transformation, if the mage is near the door in a cleared room, notices show below the form name.
- Change from the review's suggestion for 6: I don't delay the panel until the achievement ends. That made the panel depend on real time, and it would not open in scripts that step the game faster than real time.

**Pact (2/21):** the line "Abre el camino a Eclipse" only shows if there is no pact yet and you are not Eclipse.

**Other fixes:**
- 3: the "sella un Pacto oscuro" hint only shows while an altar is left. The pause screen says "Opuestos: sin Pacto no hay 2º despertar".
- 7: the Grimorio panel has a fixed height and the counter sits on its own line.
- 8: the stat now reads "Sala media al despertar 5,5 y 13".
- 10: without forms.js, Logros shows 19 achievements.
- 12: in low quality, Eclipse shots have a light ring.
- 13: the ECLIPSE banner and shadow shards no longer carry into the next room.
- 15: the Sol negro icon is now 🌘.
- 16: reactions clear the state after the damage.
- 17: kills by secondary projectiles (subHit) don't trigger death effects.
- 18: Cortina boreal does 18× to the jefe.
- 19: the plasma arc uses had.fire.
- 20: no Ánima in room 20, and the ring doesn't spin there.

docs/despertar-spec.md is updated: plasma arc line plus notes in the code snippets. Everything is commented in Spanish, in the code's style.

## No hecho
- I did not commit the docs that aren't mine: docs/revision-despertar.md, docs/archero-capitulos.md and docs/capitulos-mapa-codigo.md stay untracked.
- I didn't take finding 4's priority system (pri). The 8-slot queue plus dropping a tip first covers those cases.
- With the achievement hold, an achievement whose display was cut short when the awakening panel opened (under 1.5 s on screen) is shown again later and its sound plays a second time.
- On the end screen, the achievement covers the SANTUARIO/MENÚ buttons for a few seconds. They can still be tapped through it.
- After the form name, the "Despertar" achievement still shows at the top and can cover the mage if he is right at the door. The review accepted this.
- For 18, my measurement against the Brujo includes other damage sources (33.4× in total vs 13.6× before). The ×18 is the value from the review, and I did not rebalance it.

## Pruebas
All runs used CDP_PORT=9461. Captures went to E:/PROYECTOS/arcano/tools/out (ignored by git). No PNGs ended up in the repo.

**Regression suite (via tools/out/reg.sh), all TODO OK / 0 failures / no console errors:**
- smoke, fase0, despertar, despertar-rasgos, grimorio, fase2-mezclas, fase2-ults, fase2-avisos
- fase3, fase3-paneles, fase3-cine, despertar-sinforms, grimorio-sinforms

I updated 3 assertions for the intended label change in 8: tools/fase3.js, tools/grimorio.js and tools/grimorio-sinforms.js. The last one also now checks there are 19 achievements without forms.js.

fase3 section 7 failed at first because held achievements only came back on the next game frame. Fixed with nextAch() in awakenLater and showMenu, and it passes now.

**Reviewer scripts:** copied to E:/PROYECTOS/arcano/tools/rev with paths fixed. Each one run before (original code) and after:
- ver-toastq2-9474: AFINIDAD / SOLO 2 / ALGO OSCURO used to get lost; now all are seen, in order.
- ver-toasts-2nd: "NUNCA SE VEN" had 2 entries; now it is empty. It is random: one run failed because a level-up card sealed Fire+Ice, unrelated to the fix.
- ver-golem-logro: the panel no longer has the achievement on top.
- ver-ach-endgrim: the emblem was covered up to 10.3 s; now 0 s.
- ver-cine-top2 (stage 1 and 2): the burst is clear.
- ver-pacto2 and rb-pacto2: the line no longer appears.
- ver-pista-pacto: the hint shows before using the altar in room 19 and is gone after.
- ver-grimtabs: the tabs don't move.
- ver-stats-despertar: shows "5,5 y 13".
- ver-noforms-logros: 26 → 19.
- rb-sala20: readyAt null.
- rb-reactkill: blast and puddle on reaction kills.
- rb-shards: max 11 → 6 shards.
- rb-plasma: chance on enemies that weren't burning 0.26 → 0.
- rev-bannernext: no ECLIPSE banner in room 13.
- ver-ult-contrast: Eclipse icon contrast 4% → 34.6%.

**New scripts in tools/rev:**
- fix-tip-anima.js: your bug, 5 cases. 7 failures on the original, TODO OK now.
- fix-end-logro.js: end screen at 360x640 and 412x915.
- fix-eclipse-baja-cortina.js: low-quality crop shows the ring; Cortina vs jefe 13.6× → 33.4× atk.
- fix-hz-cola.js: a trap notice waiting in the queue is not marked as seen and is not duplicated.

node --check passes on game.js and forms.js.