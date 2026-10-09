# FFB (FUMBBL) como oráculo — y por qué NO lo portamos

> 2026-10-09. Respuesta a «¿y si portamos github.com/christerk/ffb a web?».

## Qué es

El cliente/servidor Java con el que FUMBBL lleva ~15 años sirviendo Blood Bowl online.
**Licencia MIT** (verificado), ~10,3 MB de Java puro (≈250k líneas), activo (push esta
semana). Módulos: `ffb-server` (lógica autoritativa), `ffb-client` + `ffb-client-logic`,
`ffb-common` (modelo y mecánicas), `ffb-statetest`, `ffb-tools`.

Es, con diferencia, la implementación de reglas más batalla-probada que existe — y este
proyecto **ya bebe de ella**: la tabla oficial de alcances del pase salió de su
`PassMechanic`, y los rosters se contrastaron con los datos de FUMBBL.

## El veredicto: no portar. Minar.

| Opción | Coste real | Qué obtienes |
|---|---|---|
| Reescribir 250k líneas de Java a JS | meses-años; congela el producto | lo que ya tenemos, más tarde |
| Usar su servidor + cliente web nuevo | escribir un cliente del protocolo FFB + operar un servidor Java con cuentas | un FUMBBL-lite: muere el ADR 001 (cero backend, enlace, offline) y la PWA |
| Transpilar el cliente (CheerpJ/TeaVM) | descarga enorme, UX de escritorio en canvas | un applet en el móvil; el servidor sigue haciendo falta |
| **Minarlo como oráculo (elegido)** | horas puntuales por regla | la respuesta batalla-probada a cada duda fina, con licencia MIT para traducir lógica |

El argumento decisivo no es el tamaño: es que FFB es **cliente-servidor autoritativo**,
la arquitectura exactamente opuesta a la nuestra (estado serializable que viaja en un
enlace, sin servidor, offline). Portarlo no es traducir sintaxis: es renunciar al
diseño que hace a bbweb lo que es. Nuestro motor ya juega partidos completos (153
tests, bot de 810 partidos) y cabe en 24 archivos cacheables.

## Cómo minarlo (el método)

1. **Duda fina de orden de operaciones o FAQ** (Stalling, ¡A la carga!, Perseguir,
   Atento al balón — justo las E1 pendientes): localizar la mecánica en `ffb-common`/
   `ffb-server` (los pasos de juego viven como `Step*`/`*Mechanic` por versión de
   reglas), leer la rama BB2020/2025, y traducir la LÓGICA a nuestro motor con test
   propio y cita en el comentario (`// FFB: <clase>`). MIT lo permite; la atribución
   se mantiene por respeto.
2. **Validación ambiciosa (spike futuro)**: `ffb-statetest` y los replays de FUMBBL
   sugieren un arnés de contraste — reproducir situaciones de partidos reales en
   nuestro motor y comparar resultados. Caro; solo si algún día dudamos a escala.
3. **Lo que NUNCA se toma**: textos de reglas (GW), assets, nombres de su UI.

## Regla de oro

La fuente normativa sigue siendo `bloodbowl-my-rosters`. FFB desempata
INTERPRETACIONES cuando el texto no alcanza; si FFB y el repo chocan en un dato, gana
el repo y se anota la discrepancia en sources.md.
