// El gasto de rerolls de equipo, en un único sitio.
//
// Fuente: source/tablas/fundamentos-y-principios.md §6 («Rerolls») y el rasgo
// Solitario (X+) de source/habilidades/rasgos.md: para usar una Segunda oportunidad,
// el jugador tira 1D6 contra su X; si falla, el reroll SE GASTA pero no repite nada.
//
// Nacido de E1-S07: antes cada módulo descontaba el reroll por su cuenta y ninguno
// conocía Solitario, así que los Big Guys repetían gratis.

import { tirar } from './dice.js';
import { anotar } from './partido.js';
import { valorDe } from '../data/habilidades.js';

/**
 * Gasta un reroll de equipo para repetir una tirada de `j`. Devuelve si la repetición
 * procede: con Solitario (X+) fallado, el reroll se pierde y no se repite.
 */
export function usarRerollEquipo(estado, j, { azar }) {
  const E = estado.equipos[j.equipo];
  if (E.rerolls <= 0) throw new Error('No quedan rerolls de equipo.');
  E.rerolls--;
  anotar(estado, 'reroll_equipo', { equipo: j.equipo, jugador: j.id });

  const x = valorDe(j.hab, 'loner');
  if (x !== null) {
    const d = tirar(6, { azar, motivo: `Solitario ${x}+ (${j.id})` });
    const repite = d.valor >= x;
    anotar(estado, 'solitario', { jugador: j.id, objetivo: x, d6: d.valor, repite });
    return { repite };
  }
  return { repite: true };
}
