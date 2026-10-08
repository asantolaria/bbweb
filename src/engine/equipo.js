// Creación y validación de equipos (drafting).
//
// Fuente: source/tablas/creacion-de-equipo.md, verificada contra
// bloodbowlbase BB2025 (drafting_a_blood_bowl_team).

import {
  EQUIPOS, COSTE_APOTECARIO, COSTE_AYUDANTE, COSTE_ANIMADORA, COSTE_HINCHA,
  MAX_HINCHAS_CREACION, MAX_REROLLS, MIN_JUGADORES, MAX_JUGADORES,
} from '../data/equipos.js';

/** Desglose de coste de un roster, en miles. */
export function costeRoster(equipoId, roster) {
  const E = EQUIPOS[equipoId];
  if (!E) throw new Error(`Equipo desconocido: ${equipoId}`);
  let jugadores = 0;
  for (const [posId, n] of Object.entries(roster.jugadores ?? {})) {
    const pos = E.pos[posId];
    if (!pos) throw new Error(`${equipoId} no tiene el posicional ${posId}`);
    jugadores += pos.coste * n;
  }
  const rerolls = (roster.rerolls ?? 0) * E.rrCoste;
  const apotecario = roster.apotecario ? COSTE_APOTECARIO : 0;
  const ayudantes = (roster.ayudantes ?? 0) * COSTE_AYUDANTE;
  const animadoras = (roster.animadoras ?? 0) * COSTE_ANIMADORA;
  const hinchas = (roster.hinchas ?? 0) * COSTE_HINCHA;
  return {
    jugadores, rerolls, apotecario, ayudantes, animadoras, hinchas,
    total: jugadores + rerolls + apotecario + ayudantes + animadoras + hinchas,
  };
}

/**
 * Valida un roster contra las reglas de creación. Devuelve la lista de problemas,
 * cada uno con texto para el jugador; lista vacía = roster legal.
 */
export function validarRoster(equipoId, roster, presupuesto = 1000) {
  const problemas = [];
  const E = EQUIPOS[equipoId];
  if (!E) return [`Equipo desconocido: ${equipoId}`];

  let total = 0;
  for (const [posId, n] of Object.entries(roster.jugadores ?? {})) {
    const pos = E.pos[posId];
    if (!pos) { problemas.push(`El equipo no tiene el posicional ${posId}.`); continue; }
    if (n < 0 || !Number.isInteger(n)) problemas.push(`Cantidad inválida de ${posId}: ${n}.`);
    if (n > pos.max) problemas.push(`Demasiados ${posId}: ${n} (máximo 0-${pos.max}).`);
    total += n;
  }

  // 11-16 jugadores en el draft.
  if (total < MIN_JUGADORES) problemas.push(`Hacen falta al menos ${MIN_JUGADORES} jugadores (hay ${total}).`);
  if (total > MAX_JUGADORES) problemas.push(`Como mucho ${MAX_JUGADORES} jugadores (hay ${total}).`);

  // Posiciones mutuamente excluyentes (Elegidos del Caos: un solo Big Guy de los 3).
  if (E.eligeUno) {
    const elegidos = E.eligeUno.filter((p) => (roster.jugadores?.[p] ?? 0) > 0);
    if (elegidos.length > 1) problemas.push(`Solo puede llevarse uno de: ${E.eligeUno.join(', ')}.`);
  }

  if (roster.apotecario && !E.apotecario) problemas.push('Este equipo no puede contratar apotecario.');
  if ((roster.rerolls ?? 0) > MAX_REROLLS) problemas.push(`Como mucho ${MAX_REROLLS} rerolls.`);
  if ((roster.ayudantes ?? 0) > 6) problemas.push('Como mucho 6 ayudantes del entrenador.');
  if ((roster.animadoras ?? 0) > 6) problemas.push('Como mucho 6 animadoras.');
  if ((roster.hinchas ?? 0) > MAX_HINCHAS_CREACION) {
    problemas.push(`Como mucho +${MAX_HINCHAS_CREACION} hinchas al crear el equipo.`);
  }

  const c = costeRoster(equipoId, { ...roster, jugadores: Object.fromEntries(
    Object.entries(roster.jugadores ?? {}).filter(([p]) => E.pos[p]),
  ) });
  if (c.total > presupuesto) problemas.push(`El roster cuesta ${c.total}k y el presupuesto es ${presupuesto}k.`);

  return problemas;
}

/**
 * Construye la plantilla de partido a partir de un roster legal: una lista de
 * jugadores con su perfil copiado (las heridas permanentes modifican el perfil del
 * jugador, no el del posicional) y dorsales correlativos.
 */
export function crearEquipo(equipoId, roster, { nombre = '' } = {}) {
  const errores = validarRoster(equipoId, roster);
  if (errores.length) throw new Error(`Roster ilegal (${equipoId}): ${errores.join(' ')}`);
  const E = EQUIPOS[equipoId];

  const jugadores = [];
  let dorsal = 1;
  for (const [posId, n] of Object.entries(roster.jugadores)) {
    const p = E.pos[posId];
    for (let i = 0; i < n; i++) {
      jugadores.push({
        id: `${equipoId.slice(0, 2)}${dorsal}`,
        dorsal: dorsal++,
        pos: posId,
        grande: !!p.grande,
        perfil: { mv: p.mv, fu: p.fu, ag: p.ag, ps: p.ps, ar: p.ar },
        hab: [...p.hab],
      });
    }
  }

  return {
    equipo: equipoId,
    nombre,
    jugadores,
    rerolls: roster.rerolls ?? 0,
    apotecario: !!roster.apotecario,
    ayudantes: roster.ayudantes ?? 0,
    animadoras: roster.animadoras ?? 0,
    hinchas: 1 + (roster.hinchas ?? 0), // todo equipo empieza con 1 de serie
    tesoreria: 1000 - costeRoster(equipoId, roster).total,
  };
}
