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
  golpeMortifero = false, garras = false, yaEnElSuelo = false,
}) {
  const resultado = { jugador: j.id, forma, final: yaEnElSuelo ? j.postura : 'tumbado' };

  // Equilibrio firme: 1D6, con 6 no cae (solo contra «derribado» o «caerse», y nunca
  // para quien ya está en el suelo, como la víctima de una Falta).
  if (!yaEnElSuelo && (forma === 'caida' || forma === 'derribado') && tiene(j.hab, 'steady_footing') && !porElPublico) {
    const d = tirar(6, { azar, motivo: `Equilibrio firme (${j.id})` });
    anotar(estado, 'equilibrio_firme', { jugador: j.id, d6: d.valor, evita: d.valor === 6 });
    if (d.valor === 6) return { ...resultado, final: 'de_pie', evitadoPor: 'steady_footing' };
  }

  if (!yaEnElSuelo) j.postura = 'tumbado';
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

    // Garras: un 8+ natural rompe la armadura sea cual sea el AR del rival.
    if (garras && !arm.rota && arm.valor >= 8) {
      arm.rota = true;
      arm.porGarras = true;
    }

    // Golpe mortífero: +1 a Armadura O a Heridas, a elegir DESPUÉS de tirar. La elección
    // óptima es mecánica: si la armadura falla por 1 exacto, se gasta ahí (si no, no pasa
    // nada en absoluto); si rompe sola, se guarda para las heridas.
    let mbEnHeridas = false;
    if (golpeMortifero) {
      if (!arm.rota && arm.total + 1 >= j.perfil.ar) {
        arm.rota = true;
        arm.mods = [...arm.mods, { v: +1, porque: 'Golpe mortífero (elegido para la armadura)' }];
        arm.total += 1;
      } else if (arm.rota) {
        mbEnHeridas = true;
      }
    }

    anotar(estado, 'armadura', { jugador: j.id, tirada: arm });
    resultado.armadura = arm;
    if (!arm.rota) return resultado;
    const mh = mbEnHeridas
      ? [...modsHeridas, { v: +1, porque: 'Golpe mortífero (elegido para las heridas)' }]
      : modsHeridas;
    heridas = tiradaHeridas({ escurridizo: tiene(j.hab, 'stunty'), mods: mh, azar });
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
