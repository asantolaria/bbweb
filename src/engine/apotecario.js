// El apotecario: una vez por partido.
//
// Fuente: source/tablas/heridas-y-lesiones.md («Reglas relacionadas»).
//   · Sobre un KO: en lugar de ir al banquillo queda Aturdido en su casilla (si el KO
//     fue cosa del público, a Reservas).
//   · Sobre una Lesión: el rival tira OTRA VEZ en la tabla y el dueño elige cuál de
//     las dos aplicar; si elige Magullado, el jugador vuelve a Reservas.
//
// La ventana es inmediata: `apoVentana` se abre al caer y se cierra al decidir (o al
// terminar la entrada).

import { jugador, enCasilla, anotar } from './partido.js';
import { tiradaLesion } from './heridas.js';

export function puedeCurar(estado, jugadorId) {
  const j = jugador(estado, jugadorId);
  const E = estado.equipos[j.equipo];
  return !!(E.apotecario && !E.apotecarioUsado && j.apoVentana &&
    (j.situacion === 'ko' || j.situacion === 'lesionado'));
}

export function rechazarCura(estado, jugadorId) {
  jugador(estado, jugadorId).apoVentana = false;
}

/** Cura un KO: Aturdido en su casilla (o Reservas si fue cosa del público). */
export function curarKO(estado, jugadorId) {
  const j = jugador(estado, jugadorId);
  if (!puedeCurar(estado, jugadorId) || j.situacion !== 'ko') throw new Error('El apotecario no puede con eso.');
  const E = estado.equipos[j.equipo];
  E.apotecarioUsado = true;
  j.apoVentana = false;

  const sitio = j.ultimaCasilla;
  if (!j.koPorPublico && sitio && !enCasilla(estado, sitio.x, sitio.y)) {
    j.situacion = 'campo'; j.postura = 'aturdido';
    j.x = sitio.x; j.y = sitio.y;
    anotar(estado, 'apotecario', { jugador: j.id, efecto: 'el KO se queda en Aturdido, en su casilla' });
  } else {
    // Del público se vuelve a Reservas; y si alguien ocupó la casilla (un rebote raro,
    // un empujón posterior), no hay sitio donde dejarlo tumbado: a Reservas también.
    j.situacion = 'reserva';
    anotar(estado, 'apotecario', { jugador: j.id, efecto: 'el KO vuelve a Reservas' });
  }
  return { curado: true };
}

/**
 * Cura una Lesión: segunda tirada en la tabla y el dueño elige cuál aplicar.
 * `elegir(opciones)` → índice (0 = la original, 1 = la nueva).
 */
export function curarLesion(estado, jugadorId, { azar, elegir = () => 1 } = {}) {
  const j = jugador(estado, jugadorId);
  if (!puedeCurar(estado, jugadorId) || j.situacion !== 'lesionado') throw new Error('El apotecario no puede con eso.');
  const E = estado.equipos[j.equipo];
  E.apotecarioUsado = true;
  j.apoVentana = false;

  const original = j.lesion ?? 'badly_hurt';
  const segunda = tiradaLesion({ malCuradas: j.malCuradas ?? 0, azar });
  anotar(estado, 'apotecario_lesion', { jugador: j.id, original, nueva: segunda.resultado });

  const elegida = [original, segunda.resultado][Math.max(0, Math.min(1, elegir([original, segunda.resultado])))];
  j.lesion = elegida;
  if (elegida === 'badly_hurt') {
    j.situacion = 'reserva';
    anotar(estado, 'apotecario', { jugador: j.id, efecto: 'Magullado: vuelve a Reservas' });
  } else {
    anotar(estado, 'apotecario', { jugador: j.id, efecto: `se queda con ${elegida}` });
  }
  return { curado: true, elegida };
}
