# E1-S07: Solitario (X+) al usar rerolls de equipo

## Status: Done (2026-10-09)
## Epic: E1 — Reglas pendientes del motor
## Priority: Alta (afecta a los 7 Big Guys de los equipos iniciales, en cada reroll)

## Description
Destapado al compilar docs/design/escenarios.md: un jugador con Solitario (X+) debe
tirar 1D6 ≥ X antes de que un reroll de equipo repita SU tirada; si falla, el reroll
se gasta igualmente pero no se repite nada. Hoy el motor repite sin preguntar.
Fuente: habilidades/rasgos.md (Loner).

La implementación buena centraliza el gasto: hoy gastarReroll vive en movimiento.js y
placaje/pase/lanzar duplican el patrón inline. Un único usarRerollEquipo(estado,
jugador, {azar}) → { repite: bool } aplicado en: esquivar, recoger, saltar, rush,
pase, lanzamiento, aterrizaje y el grupo del placaje (Solitario del atacante).

## Acceptance Criteria
- [x] Helper único de gasto de reroll (engine/rerolls.js) con la tirada explicada
- [x] Con 1D6 < X: reroll descontado, tirada NO repetida, tarjeta 🐺 honesta
- [x] Tests: Ogro (3+) en esquiva, Troll del Caos (4+) en placaje de grupo, controles
      sin Solitario y el Troll Adiestrado (que no lo lleva)
- [x] Suite completa en verde (175); aviso ⚠ en la UI antes de gastar el reroll

## Tasks
(Por refinar con /hive:plan)
