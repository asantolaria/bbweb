# E2-S01: Tests de UI automatizados

## Status: To Do
## Epic: E2 — Experiencia de juego en el móvil
## Priority: Alta (el único módulo sin red de seguridad)

## Description
src/ui/app.js (~1.100 líneas) se verifica a mano con Playwright en cada tanda.
Convertir esos recorridos en suite reproducible: inicio→previa→despliegue→patada→
turno→placaje con decisiones→enlace, con estados inyectados y dados… la UI usa
azarReal: valorar inyección de semilla vía query param para tests.

## Acceptance Criteria
- [ ] Recorrido completo de partida corta sin errores de consola
- [ ] Escenarios de decisión (dados de placaje, empuje, apotecario) deterministas
- [ ] Ejecutable en local sin servicios externos

## Tasks
(Por refinar con /hive:plan)
