// El Placaje: apoyos, dados, resultados, empujones (con cadena, banda y público),
// impulso, Furia y el placaje de la Penetración.
//
// Fuente: source/tablas/acciones-y-modificadores.md («Placaje», «Penetración») y las
// habilidades implicadas (Placar, Forcejear, Esquivar, Placaje defensivo, Luchador,
// Imparable, Cuernos, Mantenerse firme, Echarse a un lado, Zafarse, Apartar,
// Robar balón, Golpe mortífero, Garras).
//
// Las decisiones de entrenador llegan como callbacks en `opciones`; los valores por
// defecto son la jugada razonable (y serán el punto de partida de la IA de la fase 2):
//   elegirDado(resultados, quien)  → índice del dado a aplicar
//   elegirEmpuje(candidatas, contexto) → índice de la casilla de empuje
//   impulso() → ¿hace el impulso? (true)
//   usarForcejear(jugador) → ¿usa Forcejear? (sí, si no tiene Placar)
//   alFallar(tipo, datos) → ¿gasta reroll de equipo? (no)

import { tirar } from './dice.js';
import { enCampo } from './tablero.js';
import { jugador, enCasilla, marcadoresDe, tieneZonaDefensa, anotar } from './partido.js';
import { sonAdyacentes } from './tablero.js';
import { tiene } from '../data/habilidades.js';
import { resolverSuelo } from './derribo.js';
import { rebotar, saqueDeBanda } from './balon.js';

/** Las caras del dado de placaje. */
export const CARAS_PLACAJE = ['player_down', 'both_down', 'push', 'push', 'stumble', 'pow'];

/** Orden de preferencia del atacante (la del defensor es la inversa). */
const PREFERENCIA_ATAQUE = ['pow', 'stumble', 'push', 'both_down', 'player_down'];

/**
 * Apoyos: +1 FU por compañero que marque al rival implicado y que no esté marcado por
 * ningún otro rival distinto de ese.
 */
export function apoyos(estado, atacante, objetivo) {
  const puedeApoyar = (companero, rivalMarcado, unicoRivalPermitido) => {
    if (companero.sinApoyos) return false; // Piquete de ojos
    if (!tieneZonaDefensa(companero)) return false;
    if (!sonAdyacentes(companero.x, companero.y, rivalMarcado.x, rivalMarcado.y)) return false;
    const rivales = marcadoresDe(estado, companero.equipo, companero.x, companero.y);
    return rivales.every((r) => r.id === unicoRivalPermitido.id);
  };
  const ofensivos = Object.values(estado.jugadores).filter((c) =>
    c.equipo === atacante.equipo && c.id !== atacante.id && puedeApoyar(c, objetivo, objetivo));
  const defensivos = Object.values(estado.jugadores).filter((c) =>
    c.equipo === objetivo.equipo && c.id !== objetivo.id && puedeApoyar(c, atacante, atacante));
  return { ofensivos, defensivos };
}

/** Fuerzas comparadas y número de dados. La FU se compara tras TODOS los modificadores. */
export function fuerzasPlacaje(estado, atacante, objetivo, { blitz = false } = {}) {
  const ap = apoyos(estado, atacante, objetivo);
  const modsA = [];
  if (blitz && tiene(atacante.hab, 'horns')) modsA.push({ v: 1, porque: 'Cuernos (en Penetración)' });
  for (const c of ap.ofensivos) modsA.push({ v: 1, porque: `apoyo ofensivo de ${c.id}` });
  const modsO = ap.defensivos.map((c) => ({ v: 1, porque: `apoyo defensivo de ${c.id}` }));

  const fuA = atacante.perfil.fu + modsA.reduce((t, m) => t + m.v, 0);
  const fuO = objetivo.perfil.fu + modsO.reduce((t, m) => t + m.v, 0);

  let dados = 1, elige = null;
  if (fuA !== fuO) {
    const fuerte = fuA > fuO ? fuA : fuO;
    const debil = fuA > fuO ? fuO : fuA;
    dados = fuerte > debil * 2 ? 3 : 2;
    elige = fuA > fuO ? 'atacante' : 'objetivo';
  }
  return { fuA, fuO, modsA, modsO, dados, elige };
}

const tirarDados = (n, azar) =>
  Array.from({ length: n }, () => CARAS_PLACAJE[tirar(6, { azar, motivo: 'dado de placaje' }).valor - 1]);

function elegirPorDefecto(resultados, quien) {
  const orden = quien === 'objetivo' ? [...PREFERENCIA_ATAQUE].reverse() : PREFERENCIA_ATAQUE;
  let mejor = 0;
  for (let i = 1; i < resultados.length; i++) {
    if (orden.indexOf(resultados[i]) < orden.indexOf(resultados[mejor])) mejor = i;
  }
  return mejor;
}

/**
 * Las tres casillas de empuje: las «de enfrente» según el vector atacante→objetivo.
 * Las que caen fuera del campo se devuelven con `fuera: true` (son el público).
 */
export function casillasDeEmpuje(atacante, objetivo) {
  const vx = Math.sign(objetivo.x - atacante.x), vy = Math.sign(objetivo.y - atacante.y);
  const offsets = vx && vy
    ? [[vx, 0], [vx, vy], [0, vy]]
    : vx ? [[vx, -1], [vx, 0], [vx, 1]] : [[-1, vy], [0, vy], [1, vy]];
  return offsets.map(([dx, dy]) => {
    const x = objetivo.x + dx, y = objetivo.y + dy;
    return { x, y, fuera: !enCampo(x, y) };
  });
}

/**
 * Empuja a `objetivo` una casilla (con cadena y público). `empujadoPor` es quien ocupa
 * la casilla de la que viene el empuje (para la geometría de la cadena).
 *
 * Devuelve { destino, alPublico, cadena } y deja el balón donde toque.
 */
export function empujar(estado, empujadoPor, objetivo, {
  azar, opciones = {}, permitirMantenerseFirme = true, atacanteConApartar = false,
}) {
  // Mantenerse firme: puede negarse a moverse (también en cadena). Imparable lo anula.
  if (permitirMantenerseFirme && tiene(objetivo.hab, 'stand_firm')) {
    anotar(estado, 'mantenerse_firme', { jugador: objetivo.id });
    return { destino: { x: objetivo.x, y: objetivo.y }, seMovio: false, alPublico: false };
  }

  const origen = { x: objetivo.x, y: objetivo.y };
  let candidatas = casillasDeEmpuje(empujadoPor, objetivo);

  // Apartar (solo en Placaje declarado): el atacante elige cualquier adyacente libre y
  // anula Echarse a un lado. Echarse a un lado: el DEFENSOR elige cualquier adyacente libre.
  let eleccionDelDefensor = false;
  if (atacanteConApartar) {
    const libres = adyacentesLibres(estado, objetivo);
    if (libres.length) candidatas = libres;
  } else if (tiene(objetivo.hab, 'side_step')) {
    const libres = adyacentesLibres(estado, objetivo);
    if (libres.length) {
      candidatas = libres;
      eleccionDelDefensor = true;
      anotar(estado, 'echarse_a_un_lado', { jugador: objetivo.id });
    }
  }

  // Si hay casillas libres dentro del campo, hay que elegir entre ellas.
  const libres = candidatas.filter((c) => !c.fuera && !enCasilla(estado, c.x, c.y));
  const entre = libres.length ? libres : candidatas;
  const idx = (opciones.elegirEmpuje ?? (() => 0))(entre, {
    objetivo: objetivo.id, libres: libres.length > 0, defensor: eleccionDelDefensor,
  });
  const casilla = entre[Math.max(0, Math.min(entre.length - 1, idx))];

  // Al público.
  if (casilla.fuera) {
    const llevabaBalon = estado.balon?.portador === objetivo.id;
    objetivo.situacion = 'fuera'; // transitorio: el resultado del público decide
    anotar(estado, 'empujado_al_publico', { jugador: objetivo.id, desde: [origen.x, origen.y] });
    if (llevabaBalon) {
      estado.balon = null;
      saqueDeBanda(estado, origen.x, origen.y, { azar });
    }
    const r = resolverSuelo(estado, objetivo, { forma: 'derribado', azar, porElPublico: true });
    objetivo.x = objetivo.y = -1;
    if (objetivo.situacion === 'fuera') objetivo.situacion = 'reserva'; // aturdido → reservas ya lo hace resolverSuelo
    if (objetivo.equipo === estado.activo) estado.turnover = { causa: 'empujado_al_publico' };
    return { destino: null, seMovio: true, alPublico: true, publico: r };
  }

  // Cadena: la casilla elegida está ocupada → ese jugador es empujado a su vez.
  const ocupante = enCasilla(estado, casilla.x, casilla.y);
  let cadena = null;
  if (ocupante) {
    anotar(estado, 'empujon_en_cadena', { jugador: ocupante.id });
    cadena = empujar(estado, objetivo, ocupante, { azar, opciones });
    // Interpretación anotada: si el de la cadena usa Mantenerse firme y no se mueve, la
    // casilla sigue ocupada y el empujón se queda absorbido (nadie se mueve).
    if (!cadena.seMovio && !cadena.alPublico) {
      anotar(estado, 'empujon_absorbido', { jugador: objetivo.id, por: ocupante.id });
      return { destino: { x: origen.x, y: origen.y }, seMovio: false, alPublico: false, cadena };
    }
  }

  objetivo.x = casilla.x; objetivo.y = casilla.y;
  anotar(estado, 'empujon', { jugador: objetivo.id, de: [origen.x, origen.y], a: [casilla.x, casilla.y] });

  // Piquete de ojos: el empujado no da apoyos hasta que vuelva a activarse.
  if (tiene(empujadoPor.hab ?? [], 'eye_gouge')) {
    objetivo.sinApoyos = true;
    anotar(estado, 'piquete_de_ojos', { jugador: objetivo.id, por: empujadoPor.id });
  }

  // Empujado sobre un balón suelto: rebota (sin cambio de turno).
  if (estado.balon && !estado.balon.portador &&
      estado.balon.x === casilla.x && estado.balon.y === casilla.y) {
    rebotar(estado, casilla.x, casilla.y, { azar });
  }
  return { destino: casilla, seMovio: true, alPublico: false, cadena, origen };
}

function adyacentesLibres(estado, j) {
  const out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const x = j.x + dx, y = j.y + dy;
    if (!enCampo(x, y) || enCasilla(estado, x, y)) continue;
    out.push({ x, y, fuera: false });
  }
  return out;
}

/**
 * El placaje de una Penetración: contra el objetivo declarado al activarse, cuesta
 * 1 de MV (con Forzar la marcha si hace falta) y después se puede seguir moviendo.
 */
export function placarEnPenetracion(estado, { azar, opciones = {} } = {}) {
  const a = estado.activacion;
  if (!a || a.accion !== 'blitz') throw new Error('Hace falta una Penetración en curso.');
  if (a.placajeHecho) throw new Error('El placaje de esta Penetración ya se hizo.');
  const A = jugador(estado, a.jugador);
  const O = jugador(estado, a.objetivoBlitz);
  if (!sonAdyacentes(A.x, A.y, O.x, O.y)) throw new Error('El objetivo no está adyacente.');

  // El placaje cuesta 1 de MV; si no queda, Forzar la marcha (2+, −1 con Ventisca).
  if (a.mvGastado < A.perfil.mv) a.mvGastado++;
  else {
    if (a.rushUsados >= 2) throw new Error('Sin movimiento para el placaje.');
    a.rushUsados++;
    const mods = estado.clima === 'blizzard' ? [{ v: -1, porque: 'Ventisca' }] : [];
    const c = tirar(6, { azar, motivo: `Forzar la marcha para placar (${A.id})` });
    anotar(estado, 'rush', { jugador: A.id, d6: c.valor, necesario: estado.clima === 'blizzard' ? 3 : 2 });
    const necesario = estado.clima === 'blizzard' ? 3 : 2;
    if (c.valor < necesario) {
      const caida = resolverSuelo(estado, A, { forma: 'caida', azar });
      if (caida.final !== 'de_pie') {
        estado.turnover = { causa: 'caida_rush' };
        return { resultado: 'caida', caida };
      }
    }
  }
  a.placajeHecho = true;
  return placar(estado, A.id, O.id, { azar, blitz: true, opciones });
}

/**
 * Un Placaje completo contra un rival de pie al que se marca.
 * `blitz`: forma parte de una Penetración (Cuernos e Imparable aplican; Luchador y
 * Apartar no).
 */
export function placar(estado, atacanteId, objetivoId, { azar, blitz = false, opciones = {}, segundaVez = false } = {}) {
  const A = jugador(estado, atacanteId);
  const O = jugador(estado, objetivoId);
  if (!tieneZonaDefensa(A)) throw new Error(`${A.id} no puede placar (${A.postura}).`);
  if (O.situacion !== 'campo' || (O.postura !== 'de_pie' && O.postura !== 'distraido')) {
    throw new Error(`${O.id} no está de pie.`);
  }
  if (!sonAdyacentes(A.x, A.y, O.x, O.y)) throw new Error('Solo se placa a un rival adyacente.');
  if (A.equipo === O.equipo) throw new Error('A los compañeros no se les placa (para eso está Ferocidad animal).');

  const f = fuerzasPlacaje(estado, A, O, { blitz });
  let resultados = tirarDados(f.dados, azar);
  anotar(estado, 'placaje', {
    atacante: A.id, objetivo: O.id, blitz,
    fuerzas: { atacante: f.fuA, objetivo: f.fuO, modsA: f.modsA, modsO: f.modsO },
    dados: resultados, elige: f.elige,
  });

  // Luchador: en Placaje declarado (no Penetración) puede repetir UN «Ambos derribados».
  let luchadorUsado = false;
  if (!blitz && tiene(A.hab, 'brawler') && resultados.includes('both_down')) {
    luchadorUsado = true;
    const i = resultados.indexOf('both_down');
    const nuevo = tirarDados(1, azar)[0];
    anotar(estado, 'luchador', { atacante: A.id, de: 'both_down', a: nuevo });
    resultados = resultados.map((r, k) => (k === i ? nuevo : r));
  }

  // Reroll de equipo: repite TODOS los dados del grupo… salvo que Luchador ya repitiera
  // uno — «si un Reroll permite repetir un dado de un grupo, no se puede usar otra
  // fuente para repetir el resto» (fundamentos §6).
  if (!luchadorUsado && opciones.alFallar?.('placaje', { resultados, fuerzas: f })) {
    const E = estado.equipos[A.equipo];
    if (E.rerolls <= 0) throw new Error('No quedan rerolls de equipo.');
    E.rerolls--;
    resultados = tirarDados(f.dados, azar);
    anotar(estado, 'placaje_reroll', { atacante: A.id, dados: resultados });
  }

  const quien = f.elige ?? 'atacante';
  const idx = (opciones.elegirDado ?? elegirPorDefecto)(resultados, quien);
  const resultado = resultados[Math.max(0, Math.min(resultados.length - 1, idx))];
  anotar(estado, 'placaje_resultado', { resultado, eligio: quien });

  return aplicarResultado(estado, A, O, resultado, { azar, blitz, opciones, segundaVez });
}

function aplicarResultado(estado, A, O, resultado, { azar, blitz, opciones, segundaVez = false }) {
  const salida = { resultado, atacante: A.id, objetivo: O.id };
  const golpeMortifero = tiene(A.hab, 'mighty_blow');
  const garras = tiene(A.hab, 'claws');
  const imparable = blitz && tiene(A.hab, 'juggernaut');

  switch (resultado) {
    case 'player_down': {
      // El atacante cae «como si el objetivo le hubiera placado»: aplican las
      // habilidades del objetivo.
      salida.suelo = resolverSuelo(estado, A, {
        forma: 'derribado', azar,
        golpeMortifero: tiene(O.hab, 'mighty_blow'), garras: tiene(O.hab, 'claws'),
      });
      if (salida.suelo.final !== 'de_pie' && A.equipo === estado.activo) {
        estado.turnover = { causa: 'atacante_derribado' };
      }
      return salida;
    }

    case 'both_down': {
      // Imparable (en Penetración): cuenta como Empujón y anula Forcejear/Firme/Zafarse.
      if (imparable) {
        anotar(estado, 'imparable', { atacante: A.id, efecto: 'Ambos derribados pasa a Empujón' });
        return aplicarResultado(estado, A, O, 'push', { azar, blitz, opciones, segundaVez });
      }
      // Forcejear (de cualquiera de los dos): ambos tumbados boca arriba, sin armadura.
      const decideForcejear = opciones.usarForcejear
        ?? ((j) => tiene(j.hab, 'wrestle') && !tiene(j.hab, 'block'));
      const forcejea = [A, O].find((j) => tiene(j.hab, 'wrestle') && decideForcejear(j));
      if (forcejea) {
        anotar(estado, 'forcejear', { jugador: forcejea.id });
        for (const j of [A, O]) {
          const llevaba = estado.balon?.portador === j.id;
          resolverSuelo(estado, j, { forma: 'tumbado', azar });
          if (llevaba && j.equipo === estado.activo) estado.turnover = { causa: 'portador_tumbado' };
        }
        salida.forcejeo = forcejea.id;
        return salida;
      }
      // Sin Placar se cae; con Placar, no.
      if (!tiene(O.hab, 'block')) {
        salida.sueloObjetivo = resolverSuelo(estado, O, { forma: 'derribado', azar, golpeMortifero, garras });
        if (salida.sueloObjetivo.final !== 'de_pie' && O.equipo === estado.activo) {
          estado.turnover = { causa: 'portador_derribado' };
        }
      } else {
        anotar(estado, 'placar', { jugador: O.id, efecto: 'no cae en Ambos derribados' });
      }
      if (!tiene(A.hab, 'block')) {
        salida.sueloAtacante = resolverSuelo(estado, A, {
          forma: 'derribado', azar,
          golpeMortifero: tiene(O.hab, 'mighty_blow'), garras: tiene(O.hab, 'claws'),
        });
        if (salida.sueloAtacante.final !== 'de_pie' && A.equipo === estado.activo) {
          estado.turnover = { causa: 'atacante_derribado' };
        }
      } else {
        anotar(estado, 'placar', { jugador: A.id, efecto: 'no cae en Ambos derribados' });
      }
      return salida;
    }

    case 'stumble': {
      // Esquivar lo convierte en Empujón… salvo que el atacante tenga Placaje defensivo.
      if (tiene(O.hab, 'dodge') && !tiene(A.hab, 'tackle')) {
        anotar(estado, 'esquivar_placaje', { jugador: O.id, efecto: 'Desequilibrado pasa a Empujón' });
        return aplicarResultado(estado, A, O, 'push', { azar, blitz, opciones, segundaVez });
      }
      if (tiene(O.hab, 'dodge') && tiene(A.hab, 'tackle')) {
        anotar(estado, 'placaje_defensivo', { atacante: A.id, efecto: 'anula Esquivar en el Desequilibrado' });
      }
      return aplicarResultado(estado, A, O, 'pow', { azar, blitz, opciones, segundaVez });
    }

    case 'push':
    case 'pow': {
      const derriba = resultado === 'pow';
      const llevabaBalon = estado.balon?.portador === O.id;
      const emp = empujar(estado, A, O, {
        azar, opciones,
        permitirMantenerseFirme: !imparable, // Imparable anula Mantenerse firme
        atacanteConApartar: !blitz && tiene(A.hab, 'grab'),
      });
      salida.empuje = emp;
      if (emp.alPublico) return salida;

      // Impulso: gratis, se decide antes de cualquier otra tirada. Furia obliga.
      const origen = emp.seMovio ? emp.origen : null;
      const quiereImpulso = tiene(A.hab, 'frenzy') ? true : (opciones.impulso ?? (() => true))();
      const impulsoBloqueado = tiene(O.hab, 'fend') && !imparable;
      if (origen && quiereImpulso && !impulsoBloqueado) {
        A.x = origen.x; A.y = origen.y;
        anotar(estado, 'impulso', { jugador: A.id, a: [origen.x, origen.y] });
      } else if (origen && quiereImpulso && impulsoBloqueado) {
        anotar(estado, 'zafarse', { jugador: O.id, efecto: 'impide el impulso' });
      }

      // Robar balón: el balón cae en el destino tras decidir el impulso (Manos seguras lo impide).
      if (!derriba && llevabaBalon && tiene(A.hab, 'strip_ball') && !tiene(O.hab, 'sure_hands')) {
        anotar(estado, 'robar_balon', { atacante: A.id, objetivo: O.id });
        estado.balon = null;
        rebotar(estado, O.x, O.y, { azar });
        if (O.equipo === estado.activo) estado.turnover = { causa: 'portador_sin_balon' };
      }

      if (derriba) {
        salida.suelo = resolverSuelo(estado, O, { forma: 'derribado', azar, golpeMortifero, garras });
        if (salida.suelo.final !== 'de_pie' && llevabaBalon && O.equipo === estado.activo) {
          estado.turnover = { causa: 'portador_derribado' };
        }
      }

      // Furia: si el objetivo sigue en pie, segundo Placaje (en Penetración cuesta 1 MV).
      if (!derriba && !segundaVez && tiene(A.hab, 'frenzy') && O.situacion === 'campo' &&
          (O.postura === 'de_pie' || O.postura === 'distraido')) {
        if (blitz && estado.activacion) {
          const a = estado.activacion;
          const j = jugador(estado, a.jugador);
          if (a.mvGastado < j.perfil.mv) a.mvGastado++;
          else if (a.rushUsados < 2) {
            a.rushUsados++;
            const c = tirar(6, { azar, motivo: `Forzar la marcha para el segundo placaje (${A.id})` });
            anotar(estado, 'rush', { jugador: A.id, d6: c.valor });
            if (c.valor === 1) {
              const caida = resolverSuelo(estado, A, { forma: 'caida', azar });
              estado.turnover = { causa: 'caida_rush' };
              salida.furia = { caida };
              return salida;
            }
          } else {
            anotar(estado, 'furia_sin_mv', { jugador: A.id });
            return salida; // sin movimiento: no hay segundo placaje
          }
        }
        if (sonAdyacentes(A.x, A.y, O.x, O.y)) {
          anotar(estado, 'furia', { atacante: A.id, efecto: 'segundo placaje obligatorio' });
          salida.segundoPlacaje = placar(estado, A.id, O.id, { azar, blitz, opciones, segundaVez: true });
        }
      }
      return salida;
    }
    default:
      throw new Error(`Resultado de placaje desconocido: ${resultado}`);
  }
}
