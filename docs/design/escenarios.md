# Catálogo de escenarios del juego

> Creado el 2026-10-09 a petición del entrenador. Es la **matriz de verificación** del
> proyecto: cada escenario con su orden canónico de operaciones, qué dados intervienen,
> quién decide cada cosa y su estado (✔ motor+test · ⚠ parcial · ✘ pendiente→ticket).
> Compilar este catálogo destapó un fallo real de rerolls (ver §9) — esa es su función.
>
> Fuentes: `bloodbowl-my-rosters/source/tablas/*` · tests en `test/*.test.js`.

Leyenda de decisores: **A** = entrenador activo · **D** = entrenador defensor/inactivo
· **G** = ganador de una tirada · **M** = motor (automático, sin elección real).

---

## 1 · Macro-secuencia del partido

| # | Escenario | Orden canónico | Dados | Decide | Estado |
|---|---|---|---|---|---|
| 1.1 | Previa | hinchas (D3+hinchas cada uno) → clima (1D6 cada uno, suma) → sorteo (enfrentada) → elegir saque | D3×2, 2D6, enfrentada | G: patear/recibir | ✔ |
| 1.2 | Despliegue | primero patea, luego recibe; ≤11, ≥3 en centro pegados a LOS, ≤2 por zona ancha, mitad propia | — | A de cada fase (colocar/formación) | ✔ |
| 1.3 | Patada | casilla en mitad rival → desvío D6+D8 → evento 2D6 (en el aire) → caída | D6, D8, 2D6 | kicker: casilla | ✔ |
| 1.4 | Caída del balón | jugador debajo → atrapar; vacía → rebote; fuera o mitad kicker → recepción libre | D8, AG | receptor: a quién dar (recepción libre) | ✔ |
| 1.5 | Turnos alternos | empieza el receptor; tras TD patea el anotador y sigue el turno del que encajó; TD en turno rival → celebración (salta su siguiente) | — | M | ✔ |
| 1.6 | Final de entrada | armas secretas (n/a en 9 equipos) → clima (calor: D3 fuera por equipo) → recuperar KO (4+) → expiran efectos → campo a reservas | D3, D6×KO | M | ✔ |
| 1.7 | Descanso | turnos a 0, rerolls repuestos, patea quien recibió al inicio | — | M | ✔ |
| 1.8 | Final / prórroga | marcador; prórroga 8 turnos sin reponer rerolls; penaltis 5 enfrentadas | — | — | ⚠ final ✔ · prórroga ✘ E1-S06 |

## 2 · Turno y activación

| # | Escenario | Orden canónico | Estado |
|---|---|---|---|
| 2.1 | Empezar turno | avanzar contador → limpiar acciones usadas → marcar aturdidos-al-empezar | ✔ |
| 2.2 | Activar jugador | quitar Distraído → declarar acción (cuenta aunque se arruine) → rasgos «tras declarar» en orden: Estúpido (2+) · Realmente estúpido (4+, +2 con compañero) · Ira descontrolada (4+, +2 si pega) · Ferocidad animal (4+, +2 si pega; al fallar ataca a un compañero adyacente y PUEDE seguir) | ✔ |
| 2.3 | Acciones 1/turno | blitz, pass, handoff, foul, ttm, secure — se gastan al declarar, incluso si el rasgo las arruina | ✔ |
| 2.4 | Acciones con/sin movimiento | mueven: move, blitz, pass, handoff, foul, secure, ttm · no mueven: block, stab, vomit | ✔ (test) |
| 2.5 | Fin de turno | aturdidos-al-empezar → tumbados; alternancia (con celebración); fin de parte si ambos a 8 | ✔ |
| 2.6 | Stalling | portador que puede anotar sin dados y no anota → «el público actúa» | ✘ E1-S01 |

### 2.7 · Las 11 causas de cambio de turno (fundamentos §6)

| Causa | Estado |
|---|---|
| 1. Jugador activo se cae en su activación | ✔ |
| 2. Jugador activo derribado en su turno | ✔ |
| 3. Portador activo tumbado o fuera del campo | ✔ |
| 4. Falla al recoger (incluye Asegurar el balón) | ✔ |
| 5. Pifia de pase | ✔ (Pase seguro la convierte en retención sin turnover) |
| 6. Fallo al atrapar tras pase/entrega y balón al suelo (salvo rebote a compañero que atrapa) | ✔ |
| 7. Tras pase nadie activo lo atrapa y queda en el suelo | ✔ |
| 8. Rival acaba con el balón tras pase/entrega o intercepta | ✔ |
| 9. Portador lanzado no aterriza bien / cae al público / es comido | ✔ (comido: FAQ, solo con balón) |
| 10. Expulsión por falta | ✔ (se mantiene aunque el soborno funcione) |
| 11. Touchdown | ✔ |
| Extra: jugador del equipo activo empujado al público | ✔ |

## 3 · Movimiento (orden POR CASILLA — el que más se juega)

Orden canónico al entrar en una casilla: **Forzar la marcha → Esquivar → recoger**
(acciones-y-modificadores.md). Implementado exactamente así en `paso()`.

| # | Escenario | Detalle | Dados | Estado |
|---|---|---|---|---|
| 3.1 | Paso libre sin marcaje | ni un dado | — | ✔ |
| 3.2 | Forzar la marcha | máx. 2/activación, 2+ (−1 Ventisca); 1 → cae EN DESTINO | D6 | ✔ |
| 3.3 | Esquivar | al salir de casilla marcada; AG −1 por marcador del DESTINO; Escurridizo ignora marcadores; Cola prensil −1 (uno por salida); Esquivar (hab.) repite 1/turno; al fallar cae en destino; Llave de brazo +1 al derribo | D6 | ✔ |
| 3.4 | Saltar sobre caído | 2 MV (rush ANTES, cae en ORIGEN si falla); AG −1 por el peor lado; 1 natural → origen | D6 | ✔ |
| 3.5 | Recoger | AG −1/marcador del jugador, −1 lluvia; Manos seguras repite; fallo → rebote + turnover | D6, D8 | ✔ |
| 3.6 | Levantarse | 3 MV antes de nada; MV≤2: 4+ o pierde activación | (D6) | ✔ |
| 3.7 | Asegurar el balón | declaración restringida (suelto, sin rivales a 2, ni grandes ni Temblorosos); recogida 2+ sin repeticiones; no acabar encima → turnover | D6 | ✔ |
| 3.8 | Dejada | el portador deja el balón en la casilla que abandona, sin rebote | — | ✔ |
| 3.9 | Perseguir (rival) | tras esquiva exitosa: D 4+ ocupa la casilla vacada | D6 | ✘ E1-S03 |

## 4 · Placaje (el pipeline completo)

Orden canónico (una sola pasada, sin vuelta atrás tras el primer dado):

```
1 declarar (A)                        7 convertir resultado:
2 apoyos: marca al implicado y          · Imparable (blitz): both_down→push
  nadie más le marca (M)                · Forcejear (A o D): ambos tumbados
3 FU comparada → 1/2/3 dados (M)        · Placar: no cae en both_down
4 tirar dados (A siempre tira)          · Esquivar vs Placaje defensivo (stumble)
5 Luchador: repite UN both_down       8 empujón: 3 casillas de enfrente; libre
  (solo Placaje declarado) — y          obligatoria si existe; Mantenerse firme /
  entonces NO hay reroll de equipo      Echarse a un lado (D elige) / Apartar;
6 reroll de equipo (grupo entero)       cadenas (A dirige); público
  → elegir dado (el entrenador        9 impulso (gratis, ANTES de la armadura;
  del lado fuerte)                      Furia obliga; Zafarse lo veta)
                                     10 Robar balón (tras impulso) → rebote
                                     11 derribo → §7 (GM/Garras del causante)
                                     12 Furia: segundo placaje (en blitz, +1 MV)
```

| Decisiones | Quién |
|---|---|
| Dado elegido | entrenador del lado FUERTE (A o D) |
| Casilla de empuje | A — salvo Echarse a un lado (D) y Apartar (A entre todas las libres) |
| Impulso | A (Furia: forzado) |
| Forcejear | el que la tiene (A o D) |
| Mantenerse firme | D (también en cadena; absorbe el empujón — interpretación anotada) |

Estado: ✔ completo con tests (incluida batería específica de apoyos). Pendiente:
sustituir el placaje del blitz por Apuñalar/Vómito → E1-S05.

## 5 · Penetración (Blitz)

objetivo declarado AL ACTIVAR → movimiento → placaje por 1 MV (rush si no queda) →
puede seguir moviendo → Cuernos +1 FU en todos sus placajes · Imparable anula
Forcejear/Firme/Zafarse y convierte both_down. Un solo placaje por Penetración
(Furia paga MV por el segundo). **Estado: ✔**

## 6 · Juego de balón aéreo

| # | Escenario | Orden | Estado |
|---|---|---|---|
| 6.1 | Pase | declarar casilla → medir (tabla oficial de alcances) → precisión PS (alcance 0/−1/−2/−3, −1/marcador, −1 sol; Ventisca solo corto/rápido) → pifia (nat 1 o ≤1; Pase seguro retiene) → intercepción (UN rival bajo la regla hasta donde CAE: AG −3/−2, −1 marcadores, −1 lluvia, −1 Escurridizo; Partenubes/A-lo-loco la vetan) → preciso en casilla / impreciso dispersión 3 → atrapar o rebote → turnover si no acaba en manos activas | ✔ |
| 6.2 | Atrapar | obligatorio; AG −1 rebote, −1 saque banda, −1/marcador (Nervios de acero los ignora), −1 lluvia, +1 Recepción heroica en casilla objetivo; imposible sin zona de defensa | ✔ |
| 6.3 | Entrega | compañero adyacente de pie con zona; solo atrapar; Pasar-y-seguir deja seguir tras entrega o pase rápido | ✔ |
| 6.4 | Saque de banda | plantilla 3 direcciones + 2D6 contando el logo; esquina D3; receptor atrapa a −1 | ✔ |
| 6.5 | El balón es mío | veta pase y entrega voluntarios | ✔ |
| 6.6 | Atento al balón | mover 3 antes del chequeo de pase rival / tras el desvío de patada | ✘ E1-S04 |
| 6.7 | Lanzar compañero | adyacente con Humanoide bala → Siempre hambriento (1 → bocado: 2+ pifia, 1 devorado) → PS (corto −1, marcadores) → excelente/mediocre/pifia → dispersión 3 (pifia: rebote desde lanzador) → aterrizaje AG (−1 mediocre, −1 pifia, −1/marcador; tumbado = auto-fallo) → forzoso: aplastado tira armadura, lanzado rebota y cae → público: heridas directas, turnover solo portador | ✔ |

## 7 · Daño (de la caída a la enfermería)

```
tumbar (sin armadura) / caerse / derribado
  → Equilibrio firme (6 evita; nunca contra «tumbar» ni en el suelo)
  → tumbado + balón rebota
  → armadura 2D6 ≥ AR (+GM óptimo explicado, Garras nat 8+, apoyos en falta)
  → heridas 2D6 (tabla Escurridizos aparte; Cabeza dura ajusta el KO)
  → KO (casilla guardada) · Lesión: Regeneración 4+ → reservas; D16 (+1/mal curada)
  → permanentes D6 (AG/PS suben, MV/FU/AR bajan; mínimo → MNG)
  → apotecario (ventana inmediata): KO → aturdido en su casilla (público → reservas);
    lesión → segunda D16 y el dueño ELIGE (Magullado → reservas). 1/partido.
```
Heridas directas sin derribo: Apuñalar (armadura sin mods) y Proyectil de vómito
(1 = contra ti mismo). Público: heridas sin armadura, aturdido → reservas.
**Estado: ✔ completo con tests.**

## 8 · Patada: los 11 eventos (2D6)

| 2D6 | Evento | Decide | Estado |
|---|---|---|---|
| 2 | Árbitro intimidado (soborno a cada uno) | M | ✔ |
| 3 | ¡Tiempo muerto! (±1 turnos) | M | ✔ |
| 4 | Defensa sólida (D3+3 recolocados) | kicker | ✔ |
| 5 | Patada alta (uno bajo el balón) | receptor | ✔ (sin el matiz On the Ball → E1-S04) |
| 6 | Hinchas animan (apoyo extra 1er placaje) | M | ✔ |
| 7 | Entrenador brillante (reroll de la entrada) | M | ✔ |
| 8 | Clima cambiante (+ dispersión 3 si perfecto) | M | ✔ |
| 9 | Anticipación (D3+3 mueven 1) | receptor | ✔ |
| 10 | ¡A la carga! (D3+3 activaciones gratis) | kicker | ✘ E1-S02 |
| 11 | Indigestión (−1 MV/AR o al baño) | M (azar) | ✔ |
| 12 | Invasión de campo (D3 aturdidos) | M (azar) | ✔ |

## 9 · Dados y repeticiones (las reglas transversales)

| Regla | Estado |
|---|---|
| 1 natural falla, 6 natural acierta, siempre | ✔ |
| Modificado: tope 6, sin suelo (errata 2026) | ✔ |
| Modificador sin motivo = excepción (regla de la casa) | ✔ |
| **Nunca se repite una repetición** — habilidad gratis primero y agota el chequeo; Luchador sobre el grupo veta el reroll de equipo | ✔ **(corregido 2026-10-09: este catálogo lo destapó)** |
| Reroll de equipo: solo en tu turno; prohibido en dispersión, armadura, heridas, lesiones, saque, soborno, protesta y «el público actúa» | ✔ (por construcción: el motor no ofrece alFallar en esas tiradas) |
| Reroll de equipo en atrapar/aterrizaje propios | ⚠ legal pero no ofrecido (aterrizaje sí; atrapar no — hueco menor, anotar en E1) |
| Solitario (X+) al usar reroll de equipo | ✘ ¡no implementado! → **nuevo E1-S07** |
| Azar criptográfico en producción, guionizado en tests, semilla en bot | ✔ |

## 10 · Interacción entre entrenadores

| Modo | Cómo deciden | Estado |
|---|---|---|
| **Hot-seat** (un móvil) | interstitial «le toca a X» en cada relevo; las decisiones del defensor (dado si es más fuerte, Echarse a un lado, interceptar, Forcejear, apotecario, protesta) se preguntan con su nombre y se pasa el móvil | ✔ |
| **Por enlace** (dos móviles) | el estado entero viaja en la URL (ADR 001); el que NO tiene el dispositivo delega de facto sus micro-decisiones en el que juega — **limitación asumida entre amigos**, documentarla en pantalla; la repetición narrada de la jugada rival es E2-S02 | ⚠ |
| **Contra la IA** (fase 2) | la IA cubre los callbacks de decisión automáticamente y sus tiradas se narran con las mismas tarjetas | ✘ E3 |

Decisiones del entrenador, inventario completo: reroll de equipo (alFallar) · dado de
placaje · casilla de empuje · impulso · Forcejear · interceptor · protestar · soborno ·
apotecario (usar + elegir lesión) · elegir diagnóstico · formación · casilla de patada
· objetivo de blitz al activar · compañero y destino del lanzamiento.

## 11 · Huecos conocidos, en una lista

E1-S01 Stalling · E1-S02 ¡A la carga! · E1-S03 Perseguir · E1-S04 Atento al balón ·
E1-S05 especiales en blitz · E1-S06 prórroga · **E1-S07 Solitario en rerolls (nuevo,
destapado aquí)** · reroll de equipo no ofrecido al atrapar · modo enlace: decisiones
del ausente (asumido) · E3 entera.

## Método

Cada escenario nuevo o corregido debe: citar su fuente del repo de rosters, entrar aquí
con su orden y decisor, y tener test con dados guionizados. Para dudas finas de orden de
operaciones, el **oráculo es FFB** (github.com/christerk/ffb, MIT): ver
`docs/discovery/ffb.md`.
