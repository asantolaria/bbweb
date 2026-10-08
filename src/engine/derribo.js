// Caídas y derribos: la cadena Equilibrio firme → suelo → balón → Armadura →
// Heridas (con Cabeza dura) → Lesión (con Regeneración) → aplicar al estado.
//
// Fuentes: source/tablas/heridas-y-lesiones.md, fundamentos-y-principios.md §8
// («Formas de acabar en el suelo») y las habilidades implicadas.

import { tirar } from './dice.js';
import { tiradaArmadura, tiradaHeridas, tiradaLesion, heridoPorElPublico } from './heridas.js';
import { anotar } from './partido.js';
import { soltarBalon } from './balon.js';
import { tiene } from '../data/habilidades.js';

/**
 * Ajuste de Cabeza dura sobre el resultado de la tirada de Heridas:
 * Inconsciente solo con 9 (con Escurridizo, con 8); el valor por debajo es Aturdido.
 */
export function aplicarCabezaDura(h, j) {
  if (!tiene(j.hab, 'thick_skull') || h.resultado !== 'ko') return h;
  const umbralKO = tiene(j.hab, 'stunty') ? 8 : 9;
  if (h.total < umbralKO) {
    return { ...h, resultado: 'stunned', ajuste: 'thick_skull', efecto: 'Cabeza dura: se queda en Aturdido.' };
  }
  return h;
}

/**
 * Resuelve que un jugador acabe en el suelo.
 *
 * `forma`: 'tumbado' (sin Armadura) | 'caida' (autoinfligido) | 'derribado' (por el rival).
 * Las tres sueltan el balón; solo caída y derribo tiran Armadura; la causa del posible
 * cambio de turno la decide quien llama (aquí solo se señala si era del equipo activo).
 *
 * `modsArmadura` / `modsHeridas`: modificadores con motivo (Golpe mortífero, Falta…).
 * `sinArmaduraRotaNoHayNada` es el caso normal; con `porElPublico` no hay Armadura.
 */
export function resolverSuelo(estado, j, {
  forma, azar, modsArmadura = [], modsHeridas = [], porElPublico = false,
}) {
  const resultado = { jugador: j.id, forma, final: 'tumbado' };

  // Equilibrio firme: 1D6, con 6 no cae (solo contra «derribado» o «caerse»).
  if ((forma === 'caida' || forma === 'derribado') && tiene(j.hab, 'steady_footing') && !porElPublico) {
    const d = tirar(6, { azar, motivo: `Equilibrio firme (${j.id})` });
    anotar(estado, 'equilibrio_firme', { jugador: j.id, d6: d.valor, evita: d.valor === 6 });
    if (d.valor === 6) return { ...resultado, final: 'de_pie', evitadoPor: 'steady_footing' };
  }

  j.postura = 'tumbado';
  soltarBalon(estado, j, { azar });

  if (forma === 'tumbado' && !porElPublico) {
    anotar(estado, 'tumbado', { jugador: j.id });
    return resultado;
  }

  // Armadura (el público pega sin armadura).
  let heridas = null;
  if (porElPublico) {
    heridas = heridoPorElPublico({ escurridizo: tiene(j.hab, 'stunty'), azar });
    anotar(estado, 'publico', { jugador: j.id, heridas });
  } else {
    const arm = tiradaArmadura({ ar: j.perfil.ar, mods: modsArmadura, azar });
    anotar(estado, 'armadura', { jugador: j.id, tirada: arm });
    resultado.armadura = arm;
    if (!arm.rota) return resultado;
    heridas = tiradaHeridas({ escurridizo: tiene(j.hab, 'stunty'), mods: modsHeridas, azar });
    anotar(estado, 'heridas', { jugador: j.id, tirada: heridas });
  }

  heridas = aplicarCabezaDura(heridas, j);
  if (heridas.ajuste) anotar(estado, 'cabeza_dura', { jugador: j.id });
  resultado.heridas = heridas;

  switch (heridas.resultado) {
    case 'stunned':
      if (porElPublico) { j.situacion = 'reserva'; resultado.final = 'reserva'; }
      else { j.postura = 'aturdido'; resultado.final = 'aturdido'; }
      break;
    case 'ko':
      j.situacion = 'ko'; j.x = j.y = -1; resultado.final = 'ko';
      break;
    case 'casualty': {
      // Regeneración: 1D6 antes de la tabla de lesiones; 4+ → a Reservas, sin lesión.
      if (tiene(j.hab, 'regeneration')) {
        const d = tirar(6, { azar, motivo: `Regeneración (${j.id})` });
        anotar(estado, 'regeneracion', { jugador: j.id, d6: d.valor, regenera: d.valor >= 4 });
        if (d.valor >= 4) {
          j.situacion = 'reserva'; j.x = j.y = -1;
          return { ...resultado, final: 'regenerado' };
        }
      }
      j.situacion = 'lesionado'; j.x = j.y = -1; resultado.final = 'lesionado';
      if (heridas.automatico) {
        resultado.lesion = { resultado: heridas.automatico, automatico: true };
      } else {
        const les = tiradaLesion({ malCuradas: j.malCuradas ?? 0, azar });
        anotar(estado, 'lesion', { jugador: j.id, tirada: les });
        resultado.lesion = les;
      }
      break;
    }
  }
  return resultado;
}
