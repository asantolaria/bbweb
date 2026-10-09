# E3-S02: Orden de activaciones seguro→arriesgado

## Status: To Do
## Epic: E3 — IA
## Priority: Alta

## Description
La regla de oro del Blood Bowl: primero lo que no tira dados, después lo que tira
pocos, al final la jugada arriesgada. El bot actual activa en orden fijo. Ordenar
candidatos por riesgo (nº de chequeos y sus objetivos) × valor (Δevaluación).

## Acceptance Criteria
- [ ] Un turno sin dados disponibles se juega entero antes del primer chequeo
- [ ] Test: el bot ya no pierde turnos por esquivas evitables (comparar tasas
      de turnover con el bot aleatorio sobre 200 semillas)

## Tasks
(Por refinar con /hive:plan)
