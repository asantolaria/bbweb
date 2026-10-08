# PRD — Mesa de Blood Bowl

## El problema

Jugar Blood Bowl sin la mesa física. Las alternativas existentes son o bien un simulador
completo (que juega por ti y exige aprender su interfaz) o bien un tablero genérico de VTT
(que no sabe nada de Blood Bowl). Lo que falta es lo intermedio: **una mesa que recuerde el
estado y tire los dados, mientras los entrenadores aplican las reglas**.

## A quién va dirigido

Dos entrenadores que ya saben jugar, comparten un móvil o cada uno mira el suyo, y quieren
echar una partida sin sacar el tablero. No es una herramienta de aprendizaje ni un
sustituto del reglamento.

## Decisiones de producto

**Móvil en vertical primero.** La restricción que manda: el campo entero de 15×26 casillas
tiene que caber en pantalla sin scroll ni zoom. De ahí salen las fichas pequeñas con
abreviatura en vez de retratos, el panel inferior de 104 px y las hojas deslizantes en vez
de diálogos.

**La app no arbitra.** Mueve, cuenta movimiento, marca zonas de placaje, tira dados y
lleva el marcador. No resuelve bloqueos ni aplica habilidades. El motivo es doble: las
habilidades de Blood Bowl interactúan de forma que automatizarlas a medias es peor que no
automatizarlas, y los entrenadores que ya saben jugar prefieren decidir ellos.

**Deshacer en vez de confirmaciones.** Cualquier acción se revierte (hasta 80 pasos). Es
más barato en toques que confirmar cada movimiento, y cubre también los errores de la app
—por ejemplo la tirada de armadura, que ignora Golpe Mortífero y Cabeza Dura—.

**Un solo archivo, sin servidor.** Se abre con doble clic, se copia por WhatsApp, se sirve
con `python3 -m http.server`. No hay build que se oxide ni dependencias que actualizar.

**Fichas que identifican el posicional.** Cada posicional tiene su abreviatura (L, B, Lz,
R, C…) y los jugadores grandes ficha cuadrada. Era el requisito original: reconocer de un
vistazo quién es quién sin tocar nada.

## Alcance

**Dentro.** Los 30 equipos de Season 3 con sus perfiles y costes; creación de equipo con
presupuesto y validación; previa (afición, clima, moneda); despliegue; patada con desvío y
evento; movimiento con Rush y zonas de placaje; turnos, partes y marcador; touchdowns;
KO, lesiones y boticario; las cinco tablas de referencia; dados sueltos con historial;
guardado automático y deshacer.

**Fuera.** Juego en red o por turnos asíncrono. Liga, progresión de jugadores y gestión
entre partidos. Resolución automática de bloqueos, pases y esquives. Inducements. Modo
espectador. Cualquier forma de IA que juegue.

## Cómo sabemos que funciona

Una partida completa de dos partes se juega de principio a fin sin tener que salir de la
app para nada que no sea consultar el reglamento, y sin que ningún estado quede atrapado
en una fase de la que no se pueda salir.
