# Arquitectura

> Revisada el 2026-10-09. La versión anterior describía la mesa v0 de un solo archivo;
> aquella app vive ahora en `legacy/mesa-v0.html` como pieza histórica y no se mantiene.

## La forma del sistema

Tres capas con una regla de dependencia estricta — el motor no conoce a nadie:

```
src/
├── engine/            el motor de reglas: puro, sin DOM, sin nombres propios, testeado
│   ├── dice.js           dados y chequeos con modificadores justificados
│   ├── tablero.js        geometría 15×26 (zonas, LOS, direcciones del D8)
│   ├── partido.js        estado del partido, marcaje, zonas de defensa, registro
│   ├── equipo.js         coste y validación de rosters; crearEquipo()
│   ├── heridas.js        tablas: armadura, heridas (+Escurridizos), lesiones, permanentes
│   ├── derribo.js        la cadena suelo→armadura→heridas→lesión; heridaDirecta()
│   ├── balon.js          rebote, atrapar, saque de banda
│   ├── movimiento.js     activar (rasgos negativos), pasos, esquivar, rush, saltar,
│   │                     levantarse, recoger, Asegurar el balón, Dejada
│   ├── placaje.js        apoyos, dados, empujones (cadena/banda/público), impulso,
│   │                     Furia, Penetración (objetivo declarado, 1 MV)
│   ├── pase.js           alcances (tabla oficial), precisión, pifia, intercepción
│   ├── falta.js          falta, expulsión por dobles, protesta, soborno
│   ├── lanzar.js         Lanzar compañero (Siempre hambriento, vuelos, aterrizajes)
│   ├── especiales.js     Apuñalar y Proyectil de vómito (heridas sin derribo)
│   ├── apotecario.js     curar KO (a su casilla) o lesión (segunda tirada y elección)
│   └── secuencia.js      previa, despliegue, patada y sus 11 eventos, turnos,
│                         touchdowns, final de entrada, descanso, final
├── data/              datos del juego, separados del motor Y de los nombres
│   ├── equipos.js        9 equipos: perfiles, cupos, costes, habilidades, rol de anillo
│   ├── habilidades.js    registro de habilidades (categoría, élite, parametrizadas)
│   ├── rosters-iniciales.js  los 9 rosters por defecto, legales y a 1.000k exactos
│   ├── formaciones.js    Ziggurat, Chevrón, Columnas, Caja, Lanzamiento + asignador
│   └── nombres.es.js     TODO nombre visible (ADR 002: el motor jamás lo importa)
├── bot/bot-aleatorio.js  bot legal que juega partidas completas; arnés de estrés y
│                         embrión de la IA (E3)
├── enlace.js          la partida comprimida dentro de la URL (ADR 001)
└── ui/app.js          el tablero táctil: pantallas, vistas previas, decisiones
index.html             esqueleto + CSS + registro del service worker (PWA)
sw.js                  caché offline, versionada (bbweb-vN invalida a los clientes)
test/                  147+ tests, node --test, cero dependencias
```

Módulos ES nativos: **no hay build**. Se sirve en local (`npm run serve`) y en
producción (Vercel, `vercel deploy --prod`; proyecto `bbweb`, cuenta personal).

## El estado del partido

`crearPartido()` devuelve un objeto JSON serializable — obligación del ADR 001: la
partida entera debe caber comprimida en un enlace (~700–1.200 caracteres medidos).

- Posturas: `de_pie | distraido | tumbado | aturdido`. Situaciones:
  `reserva | campo | ko | lesionado | expulsado | devorado`.
- Todo evento con dados se apila en `estado.registro` con sus modificadores y porqués:
  de ahí salen la hoja de Tiradas, las tarjetas de resultado y la futura repetición de
  la jugada rival (E2-S02).
- `estado.fase` gobierna el flujo: `pre_partido → eleccion_saque → despliegue_kicker →
  despliegue_receiver → patada → evento_patada → (recepcion_libre) → turno ⇄ … → fin`,
  con `estado.pendiente` para los eventos de patada interactivos.
- Identificadores en inglés (`'badly_hurt'`, `'block'`), código y comentarios en
  castellano. Los ids de jugador llevan prefijo de raza; `crearPartido` renombra al
  visitante en los espejos para evitar colisiones.

## Tres reglas de la casa (motor)

**Ningún modificador sin motivo.** `chequeo()` lanza si un modificador llega sin su
campo `porque`. El PRD exige que toda tirada se justifique en pantalla; un modificador
que no sabe explicarse no compila.

**El azar se inyecta.** Toda función que tira dados acepta `azar`: criptográfico en
producción (`azarReal`, con rechazo del resto), guionizado en los tests (cada banda de
cada tabla se prueba en sus bordes exactos), con semilla en el bot.

**Las decisiones de entrenador son callbacks.** El motor no decide por nadie: dados de
placaje, casillas de empuje, impulso, Forcejear, interceptar, rerolls de equipo,
protestar, sobornar y el apotecario llegan como funciones síncronas en `opciones`.

## La interfaz: decisiones por replay

El truco central de `ui/app.js` (sin tocar el motor): como el estado es serializable y
el azar va inyectado, `ejecutar(fn)` corre la acción entera; si un callback necesita una
decisión sin respuesta, se lanza `NecesitaDecision`, se DESCARTA la ejecución parcial,
se pregunta con una hoja táctil (async) y se repite la acción con los **mismos dados
grabados** y la respuesta puesta. Determinista y justo: una decisión posterior nunca
altera dados ya vistos; una rama nueva (un reroll) tira dados frescos.

Encima de eso:
- **Vistas previas antes de tirar**: el placaje ilumina los apoyos en el tablero (verde
  ofensivos, naranja defensivos) y anuncia dados y quién elige; el pase pinta el campo
  por alcances (verde→rojo) y confirma; la patada se confirma sobre la casilla.
- **Tarjetas de resultado**: cada acción con dados termina en un modal paginado (icono,
  dados, ✅/❌, modificadores) construido del `registro` — se enseña lo que pasó, no una
  reconstrucción. Los paseos sin incidentes no interrumpen.
- **Intersticial de relevo** («le toca a X») cuando cambia quién decide, también al
  abrir un enlace recibido; modales de fase a pantalla completa cuando la cuadrícula no
  pinta nada (previa, evento de patada, apotecario, final).
- **Deshacer** por pila de snapshots (40); **guardado** automático en localStorage
  (clave `bbweb-v1`); **enlace** vía `aEnlace()/desdeEnlace()`.

## PWA y despliegue

`sw.js` cachea los ~24 archivos con stale-while-revalidate: la app juega sin cobertura
y actualiza en la segunda apertura. **Todo cambio desplegado debe subir `VERSION`**
(`bbweb-vN`) o los móviles seguirán sirviendo la caché vieja. Producción:
https://bbweb-umber.vercel.app (deploy manual `vercel deploy --prod` hasta cerrar
E4-S01; `.vercelignore` deja fuera docs, legacy y tests).

## Dónde tocar

| Quiero… | Toco |
|---|---|
| Corregir un perfil o coste | `data/equipos.js` + tests de `datos.test.js` |
| Añadir un equipo | `data/equipos.js` (con `rol`), `rosters-iniciales.js`, `nombres.es.js`, habilidades nuevas a `habilidades.js` con gancho de motor y test (proceso: E5-S01) |
| Una regla nueva | su módulo de `engine/` + test con dados guionizados + fuente citada en comentario |
| Una habilidad nueva | registro en `data/habilidades.js` + gancho donde aplique + test |
| Cambiar el flujo del partido | `secuencia.js` (fases) y los interstitiales de `app.js` |
| Una decisión de entrenador nueva | callback en `opciones` del motor + `opcionesMotor()` en la UI |
| La pinta de fichas/tablero | CSS de `index.html` + `renderPitch()` |
| El formato del enlace | `enlace.js` — y SUBIR `VERSION_ESTADO` (rompe enlaces en circulación) |

## El catálogo de escenarios

[`escenarios.md`](escenarios.md) es la matriz de verificación: cada escenario del juego
con su orden canónico, sus dados, quién decide y su estado de implementación. Toda regla
nueva entra por ahí. Para dudas finas de interpretación, el oráculo es FFB
([`docs/discovery/ffb.md`](../discovery/ffb.md)).

## Decisiones de interpretación anotadas

- **Golpe mortífero**: la elección armadura/heridas se automatiza de forma óptima (si
  la armadura falla por 1 exacto se gasta ahí; si rompe sola, va a heridas) y queda
  explicada en el registro.
- **Mantenerse firme en una cadena**: si el de la cadena no se mueve, el empujón entero
  queda absorbido (el reglamento no cubre el caso; anotado en `placaje.js`).
- **El resultado aplicado manda**: cuando una habilidad convierte un resultado
  (Imparable, Esquivar), la función devuelve lo aplicado y el dado elegido queda en el
  registro.
- **Caer al público lanzado por un compañero**: cambio de turno solo para el portador
  (la lista canónica de causas y la FAQ del devorado mandan sobre la hoja de
  referencia, que se contradice).
- **Escurridizo** ignora marcadores «al esquivar» según su texto: al saltar cuentan
  todos.

## Trampas que ya han mordido

- **Los campos de evento no se llaman `tipo`**: `anotar(estado, tipo, datos)` hace
  spread de `datos` y un campo `tipo` pisa el tipo del evento. Pasó con el pase y con
  Lanzar compañero. Tercera vez: refactorizar `anotar` para blindarlo.
- **AR no empeora como AG y PS**: peor armadura es BAJAR el número (9+ → 8+).
- **El 9 de la tabla de Escurridizos** es Magullado ya resuelto, sin D16.
- **El service worker enseña código viejo** en la primera apertura tras un deploy: es
  su diseño (revalida detrás). Para probar: desregistrar y limpiar caches.
- **Espejos**: dos equipos de la misma raza colisionaban ids hasta el renombrado del
  visitante en `crearPartido`.
