# E3-S01: Función de evaluación de posición

## Status: Done (2026-10-09)
## Epic: E3 — IA
## Priority: Alta (la base de todo lo demás)

## Description
Puntuar un estado: posesión y distancia del balón a cada zona, jugadores de pie
por bando, portador protegido (caja), amenaza de placajes con 2 dados, turnos
restantes. Determinista y testeable con estados fijos. Los pesos, [PLACEHOLDER].

## Acceptance Criteria
- [x] evaluar(estado, equipo) → { total, propios, rivales }: el número Y su desglose,
      cada término con su porqué (regla de la casa heredada del motor)
- [x] Prefiere: tener balón > suelto cerca > suelto lejos > el rival lo tiene; más
      avance (y más en la recta final de la parte); la caja protege; derribar rivales
      mejora y un KO más que un tumbado
- [x] Antisimétrica por construcción: evaluar(e,0) = −evaluar(e,1)
- [x] Barata: 4,7 µs por evaluación medidos (≈200× por debajo del límite de 1 ms)
- Pesos en src/ia/pesos.js, todos [PLACEHOLDER] hasta el ajuste con el arnés (E3-S06)

## Tasks
(Por refinar con /hive:plan)
