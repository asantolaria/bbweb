// Estado del partido y consultas sobre él (zonas de defensa, marcaje).
//
// Fuente: source/tablas/fundamentos-y-principios.md §8 «Estados del jugador».
//
// El estado es un objeto JSON serializable (ADR 001: tiene que caber en un enlace).
// Posturas: 'de_pie' | 'distraido' (de pie sin zona de defensa) | 'tumbado' | 'aturdido'.
// Situaciones: 'reserva' | 'campo' | 'ko' | 'lesionado' | 'expulsado'.

import { sonAdyacentes } from './tablero.js';

/** Crea el estado inicial de un partido entre dos plantillas de crearEquipo(). */
export function crearPartido(local, visitante, { clima = 'perfect_conditions' } = {}) {
  const estado = {
    equipos: [local, visitante].map((T, i) => ({
      id: T.equipo, nombre: T.nombre, marcador: 0,
      rerolls: T.rerolls, rerollsMax: T.rerolls,
      apotecario: T.apotecario, apotecarioUsado: false,
      ayudantes: T.ayudantes, animadoras: T.animadoras, hinchas: T.hinchas,
      turno: 0,
    })),
    jugadores: {},
    balon: null,
    clima,
    mitad: 1,
    activo: 0,
    activacion: null,
    usadas: {},        // acciones limitadas a 1 por turno ya declaradas
    turnover: null,
    efectosDrive: [],  // penalizaciones que expiran al final de la entrada
    touchdownPendiente: null,
    registro: [],
  };
  [local, visitante].forEach((T, i) => {
    for (const j of T.jugadores) {
      estado.jugadores[j.id] = {
        ...j, equipo: i,
        situacion: 'reserva', postura: 'de_pie',
        x: -1, y: -1,
        activado: false, aturdidoAlEmpezarTurno: false,
      };
    }
  });
  return estado;
}

export const jugador = (estado, id) => {
  const j = estado.jugadores[id];
  if (!j) throw new Error(`Jugador desconocido: ${id}`);
  return j;
};

export const enCasilla = (estado, x, y) =>
  Object.values(estado.jugadores).find((j) => j.situacion === 'campo' && j.x === x && j.y === y) ?? null;

/** Zona de defensa: solo los jugadores de pie (no distraídos) marcan. */
export const tieneZonaDefensa = (j) => j.situacion === 'campo' && j.postura === 'de_pie';

/** Rivales de `equipo` que marcan la casilla (x, y). */
export function marcadoresDe(estado, equipo, x, y) {
  return Object.values(estado.jugadores).filter(
    (j) => j.equipo !== equipo && tieneZonaDefensa(j) && sonAdyacentes(j.x, j.y, x, y),
  );
}

/** ¿Está marcado el jugador en su casilla actual? */
export const estaMarcado = (estado, j) => marcadoresDe(estado, j.equipo, j.x, j.y).length > 0;

/** Anota un evento explicable en el registro del partido. */
export function anotar(estado, tipo, datos) {
  const ev = { tipo, ...datos };
  estado.registro.push(ev);
  return ev;
}

/** Posición del balón, esté suelto o portado. */
export function posicionBalon(estado) {
  const b = estado.balon;
  if (!b) return null;
  if (b.portador) {
    const j = estado.jugadores[b.portador];
    return { x: j.x, y: j.y };
  }
  return { x: b.x, y: b.y };
}
