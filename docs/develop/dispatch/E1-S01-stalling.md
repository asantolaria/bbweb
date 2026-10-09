# E1-S01: Stalling — «el público actúa»

## Status: Done (2026-10-09)
## Epic: E1 — Reglas pendientes del motor
## Priority: Alta (regla con impacto competitivo real)

## Description
Si un portador puede anotar sin tirar ningún dado y termina su activación sin
hacerlo, 1D6 al final de la activación: resultado ≥ número de turno → derribado y
cambio de turno. Exige detectar «puede anotar sin dados»: camino hasta la zona
rival dentro del MV sin esquivas (ninguna casilla de salida marcada), sin rushes
y sin tiradas de rasgo pendientes. Fuente: secuencia-de-partido.md §3.

## Acceptance Criteria
- [x] Detector puedeAnotarSinDados() con los criterios del oráculo FFB (BFS sin
      marcajes dentro del MV, exclusión de rasgos que tiran al activarse) y tests de
      borde (muro de zonas, marcado, lejos, Ogro)
- [x] La piedra se tira en terminarAccion; turno 7+ sin tirada (atajo FFB)
- [x] Exento si anota o se deshace del balón (test con Dejada)
- [x] Sin reroll de equipo por construcción (el motor no ofrece alFallar ahí)
- [ ] Renunciar explícito: la UI no tiene ese botón; cubierto cuando exista

## Tasks
(Por refinar con /hive:plan)
