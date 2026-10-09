# E1-S07: Solitario (X+) al usar rerolls de equipo

## Status: To Do
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
- [ ] Helper único de gasto de reroll con la tirada de Solitario dentro, explicada
- [ ] Con 1D6 < X: reroll descontado, tirada NO repetida, tarjeta de resultado honesta
- [ ] Tests: Ogro (3+) y Troll del Caos (4+) en esquiva, placaje y pase
- [ ] El bot y el barrido de 810 siguen en verde

## Tasks
(Por refinar con /hive:plan)
