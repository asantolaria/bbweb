// La Falta: armadura con apoyos, expulsión por dobles, Protestar al árbitro y Soborno.
//
// Fuente: source/tablas/acciones-y-modificadores.md («Falta»).

import { tirar } from './dice.js';
import { jugador, anotar } from './partido.js';
import { sonAdyacentes } from './tablero.js';
import { apoyos } from './placaje.js';
import { resolverSuelo } from './derribo.js';
import { terminarActivacion } from './movimiento.js';

/**
 * Comete la Falta contra un rival tumbado o aturdido adyacente. Los apoyos usan las
 * mismas condiciones que el Placaje: +1 por ofensivo, −1 por defensivo (los ofensivos
 * son opcionales y se declaran antes de tirar; por defecto, todos).
 */
export function falta(estado, victimaId, { azar, opciones = {} } = {}) {
  const a = estado.activacion;
  if (!a || a.accion !== 'foul') throw new Error('Hace falta una acción de Falta.');
  const atacante = jugador(estado, a.jugador);
  const victima = jugador(estado, victimaId);
  if (victima.equipo === atacante.equipo) throw new Error('La Falta es contra un rival.');
  if (victima.situacion !== 'campo' || (victima.postura !== 'tumbado' && victima.postura !== 'aturdido')) {
    throw new Error('Solo contra un rival tumbado o aturdido.');
  }
  if (!sonAdyacentes(atacante.x, atacante.y, victima.x, victima.y)) throw new Error('Debe estar adyacente.');

  const ap = apoyos(estado, atacante, victima);
  const modsArmadura = [];
  for (const c of ap.ofensivos) modsArmadura.push({ v: +1, porque: `apoyo ofensivo de ${c.id}` });
  for (const c of ap.defensivos) modsArmadura.push({ v: -1, porque: `apoyo defensivo de ${c.id}` });

  // La víctima ya está en el suelo: la falta tira armadura y heridas sin volver a tumbar.
  const r = resolverSuelo(estado, victima, { forma: 'derribado', azar, modsArmadura, yaEnElSuelo: true });
  anotar(estado, 'falta', { atacante: atacante.id, victima: victima.id, resultado: r.final });

  // Dobles naturales en Armadura O en Heridas → expulsión tras resolver la falta.
  const dobles = (r.armadura?.dobles ?? false) || (r.heridas?.dobles ?? false);
  let expulsado = false;
  if (dobles) {
    expulsado = true;
    anotar(estado, 'arbitro', { jugador: atacante.id, porque: 'dobles naturales en la falta' });

    // Protestar al árbitro: 1 = también expulsado el entrenador (no vuelve a protestar);
    // 2-5 nada; 6 el jugador se queda (el cambio de turno se mantiene).
    const E = estado.equipos[atacante.equipo];
    if (opciones.protestar?.() && !E.protestaAgotada) {
      const d = tirar(6, { azar, motivo: 'protestar al árbitro' });
      anotar(estado, 'protesta', { d6: d.valor });
      if (d.valor === 1) E.protestaAgotada = true;
      if (d.valor === 6) expulsado = false;
    }
    // Soborno: con 2+ el jugador se queda; con 1 el soborno se pierde igualmente.
    if (expulsado && (E.sobornos ?? 0) > 0 && opciones.usarSoborno?.()) {
      E.sobornos--;
      const d = tirar(6, { azar, motivo: 'soborno' });
      anotar(estado, 'soborno', { d6: d.valor, funciona: d.valor >= 2 });
      if (d.valor >= 2) expulsado = false;
    }
    if (expulsado) {
      atacante.situacion = 'expulsado';
      atacante.x = atacante.y = -1;
    }
    estado.turnover = { causa: 'expulsion' };
  }
  terminarActivacion(estado);
  return { ...r, dobles, expulsado };
}
