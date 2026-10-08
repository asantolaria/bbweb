# Changelog

Sin versiones numeradas todavía. Esto registra los hitos tal y como se construyó la app.

## Importación al repositorio — 2026-10-08

Primer volcado a git de la app, hasta ahora desarrollada como artefacto en claude.ai.
Se añade la documentación (`README.md`, `docs/`) y se renombra el archivo a `index.html`.
El código de la app no cambia.

## Todos los equipos + previa automática

- Los **30 equipos oficiales de Season 3**, agrupados por tier, con reglas especiales,
  coste de re-roll, disponibilidad de boticario y límite de jugadores grandes.
- Nombres de posicional en castellano con el original inglés debajo.
- Plantilla recomendada para cada equipo (11 jugadores, ≤1.000k).
- **Previa automática**: afición (D3 + seguidores), clima (2D6) y moneda se tiran juntas
  y se muestran los dados; el ganador elige ahí mismo si patea o recibe.
- La patada enseña el D8 de dirección (con flecha) y el D6 de distancia; el evento de
  patada y los cambios de clima también muestran sus dados.
- Datos contrastados contra la base de plantillas 2025 de FUMBBL.

## Creación de equipo

- Selección de equipo como primera fase del partido; no se arranca hasta que ambos
  equipos son legales.
- Fichajes con presupuesto (1.000k por defecto, pasos de 50k), coste y límite por
  posicional, barra de gasto y validación en vivo (11–16 jugadores).
- Banda: re-rolls al precio de cada equipo, boticario (50k, si el equipo lo permite),
  ayudantes y animadoras (10k), seguidores.
- Lo fichado cuenta en partido: el evento de patada usa animadoras/ayudantes/Fan Factor,
  y KO/lesionados tienen botón de boticario (uno por partido).
- Habilidades en castellano.
- 9 equipos en esta tanda.

## Reglas Season 3 (2025)

- Plantillas oficiales 2025 con atributos y habilidades.
- Dados de placaje 2025: «Tropieza» (empujón si hay Dodge, ¡POW! si no).
- Botón de armadura por jugador: 2D6 contra AV y, si rompe, tirada de herida.
- Tablas de clima, evento de patada, herida, lesión (D16) y lesión permanente.
- Recuperación de KO (4+) al final de cada drive.
- El exceso de movimiento pasa a llamarse **Rush**.

## Primera versión

Campo de 15×26 en vertical para móvil, con zonas de anotación, línea de scrimmage y
bandas. Fichas circulares por posicional (cuadradas para jugadores grandes), estados
derribado/aturdido/activado, balón en la ficha del portador. Movimiento contra MA con
aviso de «A Por Ellos» y zonas de placaje marcadas. Turnos, marcador, re-rolls, partes.
Dados D6/2D6/3D6/D8/D16 y de placaje con historial. Deshacer y guardado automático.
5 equipos con plantilla inicial.
