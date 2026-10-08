# Pendientes y decisiones

## Pendiente

**Tirada de armadura incompleta.** El botón «Armadura» tira 2D6 contra el AV y, si rompe,
encadena la tirada de herida. No tiene en cuenta **Golpe Mortífero** ni **Cabeza Dura**,
que son los dos modificadores que más aparecen. Hoy se corrige con Deshacer. Arreglarlo
es leer `sk` del posicional en la función de armadura.

**Habilidades solo informativas.** Se muestran al seleccionar un jugador y en la lista del
equipo, pero no afectan a nada. Automatizar las fáciles (Placar, Esquivar) sin las
difíciles crea un sistema a medias en el que no se sabe qué ha aplicado la app y qué no
—por eso no se ha hecho aún—. Si se hace, debería ser todo o nada, y visible.

**Bloqueos sin resolver.** Se tiran los dados de placaje; empujones, seguimientos y caídas
los mueven los entrenadores a mano.

**Sin pase, esquive ni recogida asistidos.** No hay tirada de agilidad guiada con los
modificadores de zonas de placaje. Es el siguiente candidato natural: los modificadores
son calculables desde el estado, a diferencia de las habilidades.

## Decidido no hacer

**Juego en red.** La partida vive en el `localStorage` del navegador. Dos entrenadores,
un dispositivo (o uno mira y otro juega). Sincronizar exigiría servidor y rompería la
premisa del archivo único.

**Liga y progresión.** Sin experiencia, sin subidas, sin tesorería entre partidos.
La app es una mesa, no un gestor de equipo.

**Inducements.** Fuera del creador de equipo; se acuerdan de palabra.

**IA.** No hay entrenador automático ni va a haberlo.

## Trampas conocidas

- **Cambiar `RACES` invalida las partidas guardadas.** Hay que subir la versión de `KEY`
  (`bb-mesa-bb2025-v4` → `-v5`) o un `S` antiguo se cargará con posicionales que ya no
  existen. Ya ha pasado dos veces.
- **Las fuentes de Google se bloquean bajo CSP estricta** (p. ej. publicado como Artifact
  de Claude). Degrada a `system-ui` / `Arial Narrow`; la app funciona, se ve distinta.
- **`p.t` no se persiste**: lo inyecta `allP()`. Si alguna vez se guarda un jugador suelto
  fuera de `S.teams`, se pierde su equipo.
