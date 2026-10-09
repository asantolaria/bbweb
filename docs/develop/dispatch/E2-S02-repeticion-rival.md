# E2-S02: Repetición de la jugada rival al abrir un enlace

## Status: Done (2026-10-09)
## Epic: E2 — Experiencia de juego en el móvil
## Priority: Alta (el corazón del juego por enlace)

## Description
Al abrir el enlace del rival hoy se ve el estado final, no QUÉ pasó. El registro
del motor ya guarda todo: reproducir como tarjetas de resultado los eventos desde
el último turno propio («el Blitzer te placó: ¡POW!, tu línea KO…»). El estado del
enlace lleva el registro completo: solo hay que recortarlo y narrarlo.

## Acceptance Criteria
- [x] Al cargar de enlace: «Mientras no mirabas…», tarjetas paginadas del tramo rival
      (turnos, placajes, tiradas, KO, apotecario) y luego el intersticial de relevo
- [x] «Saltar al tablero» en repeticiones de 3+ tarjetas
- [x] Medido: el registro completo de un partido inflaba el enlace a 6.922 caracteres.
      recortarParaEnlace() lo limita al tramo rival (tope 150 eventos): un final de
      partido del bot cabe en < 4.500 y un turno típico en ~1.600 (test)

## Tasks
(Por refinar con /hive:plan)
