# ADR 001 — El estado de la partida viaja dentro del enlace

**Fecha:** 2026-10-08 · **Estado:** aceptada

## Contexto

El objetivo pasa a ser: un entrenador abre la web en el móvil, le pasa un enlace a otro y
juegan. Sin registros, sin instalar nada. La idea inicial era guardar la partida en
cookies para no montar backend.

Las cookies no resuelven esto. Una cookie vive en un navegador de un dispositivo y nunca
cruza a otra persona; sirve para persistencia local —donde además `localStorage` es mejor
(~5 MB frente a 4 KB, y no viaja en cada petición)— pero no para compartir. Son dos
problemas distintos y solo uno estaba resuelto.

## Decisión

**El estado completo de la partida se serializa, se comprime y se mete en el fragmento de
la URL** (`#g=...`). Terminas tu turno, la app genera el enlace, lo mandas, el otro lo
abre y continúa.

Medido sobre un estado representativo (dos equipos de 13, 11 en campo, segunda parte):

| | Tamaño |
|---|---|
| JSON crudo | 3.789 B |
| gzip | 537 B |
| en base64url dentro de la URL | **716 caracteres** |

Muy por debajo del límite práctico de un enlace compartible por mensajería (~2.000). Se usa
`CompressionStream('gzip')`, disponible en Chrome 80+, Safari 16.4+ y Firefox 113+.

## Por qué funciona aquí y no en otros juegos

1. **Blood Bowl es de información perfecta.** No hay manos ocultas, así que mandar el
   estado entero al rival no filtra nada.
2. **Alterna por turno completo de equipo**, no jugada a jugada. Un partido son ~32
   intercambios de enlace, no cientos.
3. El fragmento (`#`) **no se envía al servidor**: la partida no sale del navegador ni
   aparece en ningún log.

## Consecuencias

- Cero backend, cero cuentas, cero coste. Funciona sin cobertura entre turno y turno.
- Hay que mandar el enlace cada turno. Si se hace pesado, se añade transporte en tiempo
  real sin rehacer nada: el estado ya es un objeto serializable y el transporte queda
  aislado tras un módulo.
- El estado lo controla el cliente: un tramposo decidido podría rehacer una tirada. Entre
  amigos es irrelevante y el coste de evitarlo (servidor con autoridad) no compensa.
- **El estado es la API.** Cambiar su forma rompe los enlaces en circulación, así que lleva
  número de versión y el cargador rechaza con un mensaje claro lo que no entiende.

## Descartadas

- **WebRTC P2P.** Tiempo real sin backend propio, pero entre dos móviles con datos la NAT
  simétrica tumba la conexión a menudo y haría falta un TURN — que es un backend.
- **Worker de Cloudflare con Durable Object.** Funcionaría y es gratis, pero es una pieza
  más que desplegar y vigilar para un problema que el enlace ya resuelve.
