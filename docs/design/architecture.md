# Arquitectura

Todo vive en `index.html` (~97 KB, ~740 líneas): datos, estilos y lógica. No hay módulos,
ni framework, ni paso de compilación. El archivo tiene tres bloques en este orden:

1. **`<head>`** — fuentes de Google (Saira Condensed + Barlow) y un `<style>` con todo el
   CSS. Paleta por variables en `:root`, con bloque `@media (prefers-color-scheme: dark)`
   y `:root[data-theme="dark"]` para el tema oscuro.
2. **Markup** — el esqueleto fijo: `header` (marcador y botón de fin de turno), `main`
   (el campo), `footer` (panel de información + navegación), más la hoja modal `#wrap` y
   el `#toast`. Todo lo demás se pinta por `innerHTML`.
3. **`<script>`** — datos y lógica, sin `type="module"`, sin `defer`: se ejecuta al final.

## Datos (constantes, no se tocan en caliente)

| Constante | Qué es |
|---|---|
| `RACES` | Los 30 equipos. Cada uno: nombre, coste de re-roll (`rr`), boticario (`apo`), máximo de jugadores grandes (`bg`), `tier`, reglas especiales y `pos[]` con los posicionales. |
| `pos[]` | Por posicional: clave, nombre castellano (`n`) e inglés (`en`), abreviatura de ficha (`ab`), máximo (`max`), coste, `ma`/`st`/`ag`/`pa`/`av`, rol para el color (`r`) y habilidades (`sk`). |
| `TABLES` | `weather`, `kickoff`, `injury`, `casualty`, `lasting` — dados que tira cada una, rangos y texto. |
| `BLOCK` | Las seis caras del dado de placaje. |
| `COLORS` | Paleta de equipo (color de ficha + color de texto). |
| `DIRS` / `ARROW` | Las ocho direcciones del D8, en vector y en flecha. |

## Estado

Un único objeto `S`, serializable a JSON. Eso es lo que hace baratos el guardado y el
deshacer: `save()` lo mete entero en `localStorage` bajo la clave
`bb-mesa-bb2025-v4`, y `commit()` apila una copia en `hist` (máximo 80) antes de cada
cambio. **Subir la versión de la clave invalida las partidas guardadas** — es lo que hay
que hacer cuando cambian los datos de equipo.

```js
S = {
  teams: [T0, T1],      // cada T: name, race, color, players[], score, rr, rrMax,
                        //          turn, df (ayudantes/animadoras), ff, apo, apoUsed…
  ball, carrier,        // balón suelto {x,y} | id del portador
  active, half, gturn,  // equipo con el turno, parte, turno global
  phase,                // ver máquina de estados
  budget, kicker, firstKicker, coin, weather, kick, used, drive, lastScorer, halfOver
}
```

Cada jugador: `{id, k (posicional), num, st, x, y, prone, stun, stunAt, act, mv}`, donde
`st` es `reserve | pitch | ko | cas`. `p.t` (índice de equipo) **no se guarda**: lo añade
`allP()` al vuelo.

Todo cambio pasa por `commit(fn)`, que apila el historial, ejecuta `fn`, comprueba
touchdown, guarda y repinta. No modifiques `S` fuera de `commit`.

## Máquina de estados (`S.phase`)

```
pre_teams ──► pre_game ──► setup_kick ──► setup_recv ──► kick_place ──► kick_land
 (fichajes)   (previa:      (despliega     (despliega     (elige        (D8+D6
              afición,       el que         el que         casilla)      de desvío)
              clima,         patea)         recibe)                          │
              moneda)                                                        ▼
                                                                        kick_event
     ┌──────────────────────────────────────────────────────────────────┘
     ▼
   turn ──► drive_end ──► (siguiente drive: setup_kick)  ──►  end
```

`guide()` es la pieza central: dada la fase, devuelve el título, el texto, los botones
(«chips») y la etiqueta del botón principal del panel. `doPrimary()` ejecuta ese botón.
**Para añadir una fase hay que tocar las dos**, más `setupCheck()` si requiere validar un
despliegue.

## Render

`render()` llama a cuatro funciones independientes, cada una dueña de su zona del DOM:

- `renderTop()` — marcador y botón de fin de turno.
- `renderPitch()` — el campo. Calcula `--cell` a partir del alto disponible (de ahí el
  `addEventListener('resize', …)` del final) y pinta las 390 casillas con `tokenHTML()`.
- `renderPanel()` — info del jugador seleccionado o guía de fase, y los chips.
- `renderNav()` — los cinco botones inferiores: equipo 0, equipo 1, Dados, Partido,
  Deshacer.

Las hojas modales se pintan aparte en `renderSheet()`, que elige entre `teamSheet()`,
`diceSheet()`, `preSheet()` y `gameSheet()`.

Todo es `innerHTML` con plantillas, sin diffing. A este tamaño no se nota, y evita tener
que sincronizar estado con DOM: el DOM es siempre una función de `S`.

## Eventos

Dos puntos de entrada, por delegación:

- `tapCell(x, y)` — toque en el campo: seleccionar, mover, colocar en despliegue, elegir
  casilla de patada, según la fase.
- `act(btn)` — todo lo demás. Cada botón lleva `data-act` (y `data-t`, `data-s`, `data-d`…
  como parámetros) y `act()` es el `switch` que los despacha. **Un botón nuevo = una
  entrada en ese switch**, nunca un `onclick`.

## Dados

`rnd(n)` usa `crypto.getRandomValues`, no `Math.random`. `roll(n, f, block)` tira dados
sueltos y `rollTable(k)` resuelve una entrada de `TABLES`. Todas las tiradas se apilan en
`diceLog`, que se muestra en la hoja de Dados.

## Dónde tocar

| Quiero… | Toco |
|---|---|
| Corregir un perfil o un coste | la entrada en `RACES` **y subir `KEY`** |
| Añadir un equipo | una entrada en `RACES` (el selector se genera solo por `tier`) |
| Cambiar una tabla | `TABLES` |
| Añadir un botón | el markup o la plantilla que lo pinta + un `case` en `act()` |
| Cambiar el flujo del partido | `guide()` + `doPrimary()` (+ `setupCheck()`) |
| Cambiar la pinta de las fichas | `tokenHTML()` y las reglas `.tk` del `<style>` |

## Lo que no hay (a propósito)

Sin build, sin tests, sin dependencias en tiempo de ejecución salvo las dos fuentes de
Google — que degradan a `system-ui` y `Arial Narrow` si no cargan. Si el archivo se
publica en un entorno con CSP estricta (por ejemplo como Artifact de Claude), las fuentes
se bloquean y se usa el fallback; el resto funciona igual. Para evitarlo habría que
empotrar las fuentes como `data:` URI, lo que multiplicaría el tamaño del archivo.

---

# En construcción: el motor de reglas

El `index.html` de arriba es la **mesa** actual: mueve fichas y tira dados, pero no
arbitra. A partir del 2026-10-08 se está construyendo junto a él un **motor de reglas**
que sí lo hará (ver [PRD](prd.md)). Hasta que esté terminado conviven los dos.

```
src/
├── engine/        motor puro: ni DOM, ni localStorage, ni nombres propios
│   ├── dice.js       dados y chequeos con modificadores justificados
│   └── heridas.js    armadura, heridas, lesiones y permanentes
├── data/          perfiles de equipo y, aparte, los nombres de pantalla
└── enlace.js      serializar la partida dentro de la URL (ADR 001)
test/              un fichero por módulo; `npm test` (node --test, sin dependencias)
```

## Tres reglas de la casa

**Ningún modificador sin motivo.** `chequeo()` lanza una excepción si recibe un
modificador sin el campo `porque`. No es una comprobación defensiva de cortesía: el PRD
exige que cualquier tirada se pueda justificar en pantalla, así que un modificador que no
sabe explicarse no debe llegar a producción.

```js
chequeo({ objetivo: 3, mods: [
  { v: -1, porque: 'Línea Orco marca el destino' },
  { v: -1, porque: 'Blitzer Orco marca el destino' },
]})  // → necesario: 5
```

**Identificadores en inglés, prosa en castellano.** Las claves de datos (`'badly_hurt'`,
`'human_blitzer'`, `'block'`) van en inglés porque es lo que usan todas las fuentes de
datos y lo que mantiene la capa de nombres separable ([ADR 002](adr-002-nombres-separados-del-motor.md)).
El código, los comentarios y los tests van en castellano.

**El azar se inyecta.** Toda función que tire dados acepta un parámetro `azar`. En
producción es `azarReal` (criptográfico, con rechazo del resto para no sesgar las caras);
en los tests es un dado guionizado, lo que permite comprobar **cada banda de cada tabla**
en sus bordes exactos en vez de muestrear al azar.

## Dónde buscar cada regla

| Regla | Módulo | Fuente |
|---|---|---|
| 1 natural falla, 6 natural acierta, tope en 6 sin suelo | `dice.js` | `tablas/fundamentos-y-principios.md` §6 |
| Armadura, Heridas, Lesiones, permanentes, público | `heridas.js` | `tablas/heridas-y-lesiones.md` |
| Formato del enlace | `enlace.js` | [ADR 001](adr-001-multijugador-por-enlace.md) |

«Fuente» es siempre un fichero de
[`asantolaria/bloodbowl-my-rosters`](https://github.com/asantolaria/bloodbowl-my-rosters).

## Trampas que ya han mordido

**AR no empeora como AG y PS.** Los tres se escriben «X+», pero AG y PS son objetivos que
tira el propio jugador (peor = subir, 3+ → 4+) y AR es el objetivo que tira el **rival**
para romper la armadura (peor = bajar, 9+ → 8+). Agruparlos costó un test en rojo.

**El 9 de la tabla de Escurridizos no es una Lesión más.** Es Magullado ya resuelto: no se
tira el D16. En la tabla normal, el 9 ni siquiera es Lesión, es un KO.
