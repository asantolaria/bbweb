# E3-S01: Función de evaluación de posición

## Status: To Do
## Epic: E3 — IA
## Priority: Alta (la base de todo lo demás)

## Description
Puntuar un estado: posesión y distancia del balón a cada zona, jugadores de pie
por bando, portador protegido (caja), amenaza de placajes con 2 dados, turnos
restantes. Determinista y testeable con estados fijos. Los pesos, [PLACEHOLDER].

## Acceptance Criteria
- [ ] evaluar(estado, equipo) → número, con tests de estados construidos
- [ ] Prefiere: tener balón > balón libre cerca > rival con balón
- [ ] Barata: ≤1 ms por evaluación (el móvil manda)

## Tasks
(Por refinar con /hive:plan)
