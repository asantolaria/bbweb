# E2-S01: Tests de UI automatizados

## Status: Done (2026-10-09)
## Epic: E2 — Experiencia de juego en el móvil
## Priority: Alta (el único módulo sin red de seguridad)

## Description
src/ui/app.js (~1.100 líneas) se verifica a mano con Playwright en cada tanda.
Convertir esos recorridos en suite reproducible: inicio→previa→despliegue→patada→
turno→placaje con decisiones→enlace, con estados inyectados y dados… la UI usa
azarReal: valorar inyección de semilla vía query param para tests.

## Acceptance Criteria
- [x] Recorrido inicio → previa → despliegues → patada → primer turno, sin errores
      de consola, en un viewport de móvil (390×800) con Chrome real
- [x] Escenarios deterministas con ?semilla=N: vista previa del placaje con apoyos,
      mapa de alcances del pase, repetición al abrir un enlace, apotecario, y la
      prueba de que la misma semilla da los mismos dados
- [x] Local y sin servicios externos: servidor estático propio, Chrome del sistema,
      service worker bloqueado. `npm run test:ui`, ~10 s
- [x] Verificada contra una mutación (quitar el resaltado de apoyos la hace fallar)

## Tasks
(Por refinar con /hive:plan)
