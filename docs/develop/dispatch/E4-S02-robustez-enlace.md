# E4-S02: Robustez del enlace entre versiones

## Status: To Do
## Epic: E4 — Multijugador y operaciones
## Priority: Media (crece con cada cambio del estado)

## Description
VERSION_ESTADO sigue en 1 mientras el estado gana campos (apoVentana, lesion,
ultimaCasilla…). Los campos nuevos son aditivos y los enlaces viejos cargan, pero
nadie lo vigila. Falta: test de compatibilidad con enlaces de versiones
anteriores congelados como fixtures, política de cuándo subir versión, y medir
el tamaño del enlace con registro completo (E2-S02 lo engorda).

## Acceptance Criteria
- [ ] Fixtures de enlaces v1 reales en test/ que deben seguir cargando
- [ ] Guía en architecture.md: qué cambio exige subir VERSION_ESTADO
- [ ] Alarma de tamaño: test falla si un estado realista supera 1.800 caracteres

## Tasks
(Por refinar con /hive:plan)
