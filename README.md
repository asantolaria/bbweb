# bbweb — Blood Bowl para el móvil

Blood Bowl (Season 3 / BB2025) jugable en el navegador del móvil: **el motor aplica las
reglas** —movimiento, placajes con apoyos, pases, faltas, heridas, turnos— y la partida
a dos se juega **pasándose un enlace** que lleva el estado entero dentro (sin servidor,
sin cuentas). Fase 2 prevista: una IA para jugar solo.

> Repositorio **privado**. Las reglas se implementan contra
> [`asantolaria/bloodbowl-my-rosters`](https://github.com/asantolaria/bloodbowl-my-rosters);
> aquí no se reproduce texto del reglamento (ver `docs/discovery/sources.md`).

## Jugar

**En producción: https://bbweb-umber.vercel.app** — ábrelo en el móvil y usa
«Añadir a pantalla de inicio» para tenerlo como app (funciona sin conexión).

En local:

```bash
npm run serve        # python3 -m http.server 8000
# móvil en la misma red → http://<ip-del-pc>:8000
```

Publicar cambios: `vercel deploy --prod` (proyecto `bbweb` de la cuenta personal de
Vercel; el despliegue automático por push se activa conectando GitHub en el dashboard).

La app usa módulos ES nativos: hace falta servirla (no funciona con doble clic en el
archivo). No hay build ni dependencias: `node --test` para los tests y listo.

- **Un móvil**: os lo vais pasando (hot-seat).
- **Dos móviles**: al acabar tu turno, «Copiar enlace del turno» y se lo mandas; el
  enlace lleva la partida comprimida en el fragmento de la URL
  ([ADR 001](docs/design/adr-001-multijugador-por-enlace.md)).
- La partida también se guarda sola en el navegador, y hay Deshacer.

## Qué hay implementado (motor con tests)

- **Equipos**: los 9 con roster inicial a 1.000k del repo de rosters, validados contra
  las reglas de creación (presupuesto, cupos, hinchas a 5k…).
- **Secuencia completa**: previa (hinchas, clima, sorteo), despliegue validado con
  **formaciones rápidas** (Ziggurat, Chevrón, Columnas, Caja, Lanzamiento), patada con
  desvío y los **11 eventos** de la tabla 2025, turnos, touchdowns, KO, descanso y final.
- **Acciones declaradas al activar**, como manda el reglamento: Movimiento, Penetración
  (con objetivo nombrado de antemano y su placaje a 1 MV), Placaje, Pase, Entrega,
  Falta y Asegurar el balón — las limitadas a una por turno se gastan aunque el rasgo
  negativo del jugador las arruine.
- **Placajes**: apoyos ofensivos y defensivos con su condición exacta (batería de tests
  propia), 1/2/3 dados según FU comparada, empujones con cadena, banda y público,
  impulso, Furia, y las habilidades: Placar, Forcejear, Esquivar, Placaje defensivo,
  Luchador, Imparable, Cuernos, Apartar, Mantenerse firme, Echarse a un lado, Zafarse,
  Robar balón, Golpe mortífero, Garras, Piquete de ojos.
- **Pases**: tabla oficial de alcances, precisión, pifias, dispersión, intercepción,
  saque de banda, y Pasar/Pase seguro/Pase a lo loco/Partenubes/Nervios de acero/El
  balón es mío/Pasar y seguir/Recepción heroica.
- **Heridas**: armadura, heridas (con Cabeza dura y la tabla de Escurridizos), lesiones,
  permanentes, Regeneración, Equilibrio firme, apotecario pendiente de UI.
- **Rasgos negativos**: Estúpido, Realmente estúpido, Ira descontrolada y Ferocidad
  animal (con el ataque al compañero).
- Cada tirada queda en un **registro explicado**: qué se tiró, contra qué objetivo y de
  dónde sale cada modificador.

Pendientes conocidos, con motivo: [`docs/delivery/backlog.md`](docs/delivery/backlog.md)
(Lanzar compañero, Stalling, ¡A la carga!, Perseguir, prórroga…).

## Estructura

```
bbweb/
├── index.html            la pantalla (CSS + esqueleto); la lógica va en módulos
├── src/
│   ├── engine/           el motor de reglas, puro y probado (sin DOM ni nombres)
│   ├── data/             equipos, habilidades, rosters, formaciones y nombres ES
│   ├── ui/app.js         tablero táctil, paneles y decisiones de entrenador
│   └── enlace.js         la partida dentro de la URL
├── test/                 125 tests (node --test, cero dependencias)
├── docs/                 PRD, arquitectura, ADRs, fuentes y backlog
│   └── develop/dispatch/ el plan: 5 épicas y 23 historias (E1 reglas pendientes,
│                         E2 experiencia móvil, E3 la IA, E4 operaciones, E5 contenido)
└── legacy/mesa-v0.html   la mesa original sin motor (histórico, autocontenida)
```

## Documentación

- [PRD](docs/design/prd.md) — objetivos: reglas correctas > jugar a dos > IA.
- [Arquitectura](docs/design/architecture.md) — módulos, estado y dónde tocar.
- [ADR 001](docs/design/adr-001-multijugador-por-enlace.md) — el enlace como transporte.
- [ADR 002](docs/design/adr-002-nombres-separados-del-motor.md) — nombres fuera del motor.
- [Fuentes](docs/discovery/sources.md) — de dónde sale cada dato y los desempates.
