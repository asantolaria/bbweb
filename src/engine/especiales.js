// Acciones especiales concedidas por rasgos: Apuñalar y Proyectil de vómito.
//
// Fuente: source/habilidades/rasgos.md. Ambas hieren SIN derribo: armadura sin
// modificadores y, si rompe, la cadena de heridas. Pueden sustituir el placaje de una
// Penetración (pendiente en el backlog; aquí van como acción propia).

import { tirar } from './dice.js';
import { jugador, anotar, tieneZonaDefensa } from './partido.js';
import { sonAdyacentes } from './tablero.js';
import { tiene } from '../data/habilidades.js';
import { heridaDirecta } from './derribo.js';
import { terminarActivacion } from './movimiento.js';

function validar(estado, accion, habilidad, victimaId) {
  const a = estado.activacion;
  if (!a || a.accion !== accion) throw new Error(`Hace falta una acción de ${accion}.`);
  const A = jugador(estado, a.jugador);
  if (!tiene(A.hab, habilidad)) throw new Error(`${A.id} no tiene esa habilidad.`);
  const V = jugador(estado, victimaId);
  if (V.equipo === A.equipo) throw new Error('Contra un rival.');
  if (V.situacion !== 'campo' || !(V.postura === 'de_pie' || V.postura === 'distraido')) {
    throw new Error('El rival debe estar de pie.');
  }
  if (!sonAdyacentes(A.x, A.y, V.x, V.y)) throw new Error('Debe estar adyacente.');
  return [A, V];
}

/** Apuñalar: armadura sin modificadores; si rompe, heridas. Sin cambio de turno. */
export function apunalar(estado, victimaId, { azar } = {}) {
  const [A, V] = validar(estado, 'stab', 'stab', victimaId);
  anotar(estado, 'apunalar', { atacante: A.id, victima: V.id });
  const r = heridaDirecta(estado, V, { azar });
  // Herir al portador rival no es cambio de turno: el balón queda botando para ti.
  terminarActivacion(estado);
  return r;
}

/**
 * Proyectil de vómito: 1D6 — con 2+ la armadura (sin mods) va contra el rival; con 1,
 * contra el propio vomitador. Varios por turno (cada jugador actúa una vez igualmente).
 */
export function vomitar(estado, victimaId, { azar } = {}) {
  const [A, V] = validar(estado, 'vomit', 'projectile_vomit', victimaId);
  const d = tirar(6, { azar, motivo: `Proyectil de vómito (${A.id})` });
  anotar(estado, 'vomito', { atacante: A.id, victima: V.id, d6: d.valor, aQuien: d.valor >= 2 ? V.id : A.id });
  const objetivo = d.valor >= 2 ? V : A;
  const llevaba = estado.balon?.portador === objetivo.id;
  const r = heridaDirecta(estado, objetivo, { azar });
  // Si la armadura rompe, el herido acaba en el suelo: autolesionarse llevando el
  // balón (solo puede pasarle al equipo activo) es cambio de turno.
  if (llevaba && objetivo.equipo === estado.activo && r.armadura.rota) {
    estado.turnover = { causa: 'portador_derribado' };
  }
  terminarActivacion(estado);
  return { ...r, victima: objetivo.id, autolesion: d.valor === 1 };
}
