# PRD — Mesa de Blood Bowl

> **Revisado el 2026-10-08.** La versión anterior decía que la app no arbitraría y que las
> reglas las aplicarían los entrenadores. Eso se ha invertido: ahora el objetivo es un
> **motor de reglas completo y meticuloso**. El resto del documento refleja la dirección
> nueva; el historial está en git.

## El problema

Jugar Blood Bowl sin la mesa física, con alguien que no está en la misma habitación, sin
que ninguno de los dos tenga que instalar ni registrarse en nada.

## Los tres objetivos, en orden

1. **Que las reglas sean correctas.** Es el requisito duro. Una app que se equivoca en un
   modificador de esquivar es peor que no tener app, porque nadie la va a auditar a mitad
   de partida. Esto manda sobre todo lo demás: sobre el calendario, sobre lo bonito que
   quede y sobre cuántos equipos haya.
2. **Que jugar a dos sea trivial.** Abres el navegador, pasas un enlace, jugáis.
   Ver [ADR 001](adr-001-multijugador-por-enlace.md).
3. **Fase 2: jugar solo contra la máquina.** Una IA que sepa jugar un turno razonable. No
   entra hasta que el motor esté terminado y probado, porque una IA sobre reglas dudosas
   no se puede depurar: no sabrías si juega mal o si el motor le miente.

## A quién va dirigido

Entrenadores que ya saben jugar. No es una herramienta de aprendizaje: la app aplica las
reglas, no las explica.

## Decisiones de producto

**Móvil en vertical primero.** La restricción que manda sobre la interfaz: el campo
entero de 15×26 casillas cabe en pantalla sin scroll ni zoom. De ahí salen las fichas con
abreviatura en vez de retratos y las hojas deslizantes en vez de diálogos.

**La app arbitra, y se le puede pedir cuentas.** Cada tirada queda en un registro que dice
qué se tiró, contra qué objetivo, con qué modificadores y de dónde sale cada uno
(«Esquivar 3+ · −1 por Línea Orco en destino · −1 por Blitzer en destino → necesitas 5+»).
Si un entrenador no se fía, lo abre y lo comprueba. Un motor que acierta pero no se explica
no sirve: en la mesa real los dados se tiran a la vista.

**Deshacer sigue existiendo.** Ahora cubre errores de la app, no del jugador. Mientras
queden reglas sin implementar, es la vía de escape.

**Un enlace, nada más.** Sin registro, sin instalación, sin backend.

**Los nombres no viven en el motor.** Ver [ADR 002](adr-002-nombres-separados-del-motor.md).

## La fuente de verdad

Las reglas se implementan contra
[`asantolaria/bloodbowl-my-rosters`](https://github.com/asantolaria/bloodbowl-my-rosters),
que ya tiene el reglamento Season 3 ordenado en castellano: `source/tablas/` (secuencia de
partido, acciones y modificadores, heridas, patada inicial, clima),
`source/habilidades/` por categorías, `source/teams/` con los 33 equipos y un glosario de
662 líneas.

Esto no es un detalle de implementación, es la razón por la que el proyecto es viable:
cada regla del motor se puede rastrear hasta una línea concreta de ese repo, y cuando haya
discrepancia gana el repo.

Los equipos arrancan en **1.000k**, con los rosters por defecto de `rosters/iniciales/`.

## Alcance

**Fase 1 — motor.** Secuencia de partido completa; activaciones y declaración de acciones;
movimiento con esquivar, saltar, forzar la marcha y levantarse, con todos sus
modificadores; placaje con dados, apoyos, empujones en cadena, impulso y salidas al
público; armadura, heridas, lesiones y apotecario; pase, entrega, intercepción, atrapar,
rebote y saque de banda; faltas y expulsiones; las 11 causas de cambio de turno; segundas
oportunidades con sus restricciones; habilidades que el motor aplica de verdad.

**Fase 2 — IA.** Un rival que juegue un turno razonable.

**Fuera, de momento.** Liga, progresión y SPP. Incentivos. Jugadores estrella. Tiempo
real. Reglas de torneo (Sevens, copas temáticas).

## Cómo sabemos que funciona

- El motor tiene **tests** por cada regla, escritos contra los ejemplos y tablas del repo
  de rosters. Una regla sin test no está implementada.
- Una partida completa de dos partes se juega de principio a fin sin que ningún estado
  quede atascado.
- Cualquier tirada que haga la app se puede justificar leyendo su registro.
