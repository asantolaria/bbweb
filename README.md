# bbweb — Mesa de Blood Bowl

Tablero digital para jugar **Blood Bowl (Season 3, reglas 2025)** en el móvil. Es una
aplicación web de **un solo archivo** (`index.html`): no hay servidor, ni build, ni
dependencias que instalar. Se abre en el navegador y la partida se guarda sola.

> No sustituye al reglamento: la app mueve fichas, tira dados y lleva la cuenta.
> Las decisiones de reglas siguen siendo de los entrenadores.

> Repositorio **privado**. No incluye material con copyright de Games Workshop; los
> perfiles de equipo son datos de juego recogidos de fuentes públicas (ver
> [`docs/discovery/sources.md`](docs/discovery/sources.md)).

## Uso

```bash
xdg-open index.html            # abrir en el navegador local
python3 -m http.server 8000    # o servirlo para jugar desde el móvil -> http://<ip-del-pc>:8000
```

Pensado para **móvil en vertical**: el campo completo de 15×26 casillas cabe en pantalla
sin hacer scroll.

## Qué hace

**Equipos.** Los 30 equipos oficiales de Season 3, agrupados por tier, con sus
posicionales (coste, límite, MA/ST/AG/PA/AV y habilidades), su precio de re-roll, si
admiten boticario y su límite de jugadores grandes. El creador valida presupuesto
(1.000k por defecto, ajustable en pasos de 50k) y plantilla (11–16 jugadores), e incluye
un botón de plantilla recomendada para cada equipo.

**Fichas.** Cada jugador es un círculo del color de su equipo con la abreviatura de su
posicional; los jugadores grandes llevan ficha cuadrada. Derribado se dibuja con la letra
girada, aturdido con rayado y la letra invertida, y ya activado atenuado. El balón se ve
como un punto en la ficha del portador.

**Movimiento.** Tocas un jugador y luego una casilla: la app cuenta los pasos frente a su
MA, avisa de los Rush y marca en rojo las zonas de placaje rivales mientras tienes a
alguien seleccionado.

**Partido.** Previa automática (afición, clima y moneda, con los dados a la vista),
despliegue por mitades, patada con desvío D8+D6, evento de patada, turnos y partes,
touchdowns, recuperación de KO y boticario. El botón Deshacer revierte cualquier acción.

**Dados.** D6, 2D6, 3D6, D8, D16 y dados de placaje de 1, 2 y 3, más las tablas de clima,
evento de patada, herida, lesión y lesión permanente. Todas las tiradas usan
`crypto.getRandomValues` y quedan en un historial.

## Estructura

```
bbweb/
├── index.html          # la aplicación entera (~97 KB: datos, CSS y JS en un archivo)
├── docs/
│   ├── design/
│   │   ├── prd.md            # qué resuelve, alcance y decisiones de producto
│   │   └── architecture.md   # estado, fases, render y dónde tocar cada cosa
│   ├── discovery/
│   │   └── sources.md        # de dónde salen los perfiles y las discrepancias conocidas
│   └── delivery/
│       └── backlog.md        # lo que falta y lo que se decidió no hacer
└── CHANGELOG.md
```

## Límites conocidos

- Las **habilidades son informativas**: se muestran, pero la app no las aplica. La tirada
  de armadura no tiene en cuenta Golpe Mortífero ni Cabeza Dura — corrígelo con Deshacer.
- Unas **30 habilidades poco comunes** llevan traducción propia, con el nombre inglés
  entre paréntesis (p. ej. «Mirada Hipnótica (Hypnotic Gaze)»).
- Los **bloqueos no se resuelven solos**: se tiran los dados y los entrenadores aplican el
  resultado.
- La partida vive en `localStorage` de ese navegador. **No hay juego en red.**

Detalle y motivos en [`docs/delivery/backlog.md`](docs/delivery/backlog.md).
