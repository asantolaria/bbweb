// Pase y Entrega.
//
// Fuente: source/tablas/acciones-y-modificadores.md («Pase», «Atrapar») y las
// habilidades de pase. La tabla de alcances en casillas es la Passing Range Chart
// oficial, tomada de la implementación de FUMBBL (la misma fuente pública que se usó
// para contrastar los rosters): filas = |Δy|, columnas = |Δx|.

import { chequeo, tirar } from './dice.js';
import { enCampo, DIRECCIONES_D8 } from './tablero.js';
import { jugador, enCasilla, marcadoresDe, tieneZonaDefensa, anotar } from './partido.js';
import { tiene } from '../data/habilidades.js';
import { intentarAtrapar, rebotar, saqueDeBanda } from './balon.js';
import { terminarActivacion } from './movimiento.js';

// T = la casilla del lanzador, Q/S/L/B = Rápido/Corto/Largo/Bomba, espacio = fuera de alcance.
const TABLA_ALCANCE = [
  'TQQQSSSLLLLBBB',
  'QQQQSSSLLLLBBB',
  'QQQSSSSLLLLBBB',
  'QQSSSSSLLLBBB ',
  'SSSSSSLLLLBBB ',
  'SSSSSLLLLBBB  ',
  'SSSSLLLLLBBB  ',
  'LLLLLLLLBBB   ',
  'LLLLLLLBBBB   ',
  'LLLLLBBBBB    ',
  'LLLBBBBBB     ',
  'BBBBBBB       ',
  'BBBBB         ',
  'BBB           ',
];
const ALCANCES = { Q: 'quick', S: 'short', L: 'long', B: 'bomb' };
export const MOD_ALCANCE = { quick: 0, short: -1, long: -2, bomb: -3 };

/** Tipo de pase entre dos casillas, o null si está fuera de alcance. */
export function alcance(ax, ay, bx, by) {
  const dx = Math.abs(bx - ax), dy = Math.abs(by - ay);
  if (dy >= TABLA_ALCANCE.length) return null;
  const letra = TABLA_ALCANCE[dy][dx] ?? ' ';
  return ALCANCES[letra] ?? null;
}

/** Casillas que cruza la trayectoria del pase (supercover), sin el origen. */
export function casillasBajoLaRegla(ax, ay, bx, by) {
  const celdas = [];
  const dx = bx - ax, dy = by - ay;
  const pasos = Math.max(Math.abs(dx), Math.abs(dy)) * 2;
  let ux = ax, uy = ay;
  for (let i = 1; i <= pasos; i++) {
    const x = Math.round(ax + (dx * i) / pasos);
    const y = Math.round(ay + (dy * i) / pasos);
    if ((x !== ux || y !== uy) && enCampo(x, y)) {
      celdas.push([x, y]);
      ux = x; uy = y;
    }
  }
  return celdas;
}

/**
 * La acción de Pase: declarar casilla → medir → chequeo de precisión → intercepción →
 * resolver. Tras pasar no se puede seguir moviendo (salvo Pasar y seguir tras un
 * Pase rápido sin cambio de turno).
 *
 * `opciones.elegirInterceptor(candidatos)` → id del rival que lo intenta, o null. El
 * motor no decide por el rival: sin callback no hay intento.
 */
export function pase(estado, objetivoX, objetivoY, { azar, opciones = {}, bomba = false } = {}) {
  const a = estado.activacion;
  if (!a || a.accion !== 'pass') throw new Error('Hace falta una acción de Pase.');
  const j = jugador(estado, a.jugador);
  if (estado.balon?.portador !== j.id) throw new Error(`${j.id} no lleva el balón.`);
  if (tiene(j.hab, 'my_ball')) throw new Error('El balón es mío: no lo suelta voluntariamente.');
  if (!enCampo(objetivoX, objetivoY)) throw new Error('La casilla objetivo debe estar en el campo.');

  const esALoLoco = tiene(j.hab, 'hail_mary_pass') && opciones.aLoLoco === true;
  let tipo = alcance(j.x, j.y, objetivoX, objetivoY);
  if (esALoLoco) tipo = 'bomb';            // chequeo como bomba larga, sin regla de alcance
  if (!tipo) throw new Error('Fuera de alcance.');
  if (estado.clima === 'blizzard' && tipo !== 'quick' && tipo !== 'short') {
    throw new Error('Con Ventisca solo se intentan pases Rápidos o Cortos.');
  }

  // Chequeo de precisión.
  const mods = [{ v: MOD_ALCANCE[tipo], porque: `pase ${tipo}` }].filter((m) => m.v !== 0);
  if (!tiene(j.hab, 'nerves_of_steel')) {
    for (const m of marcadoresDe(estado, j.equipo, j.x, j.y)) {
      mods.push({ v: -1, porque: `${m.id} marca al lanzador` });
    }
  }
  if (estado.clima === 'very_sunny') mods.push({ v: -1, porque: 'Muy soleado' });

  let c = chequeo({ objetivo: j.perfil.ps, mods, azar, motivo: `pase (${j.id})` });
  anotar(estado, 'pase', { jugador: j.id, a: [objetivoX, objetivoY], alcance: tipo, chequeo: c });
  // Nunca se repite una repetición: la habilidad Pasar (gratis) agota el chequeo.
  if (!c.exito && tiene(j.hab, 'pass')) {
    c = chequeo({ objetivo: j.perfil.ps, mods, azar, motivo: `pase (${j.id}, repite por Pasar)` });
    anotar(estado, 'pase_reroll', { jugador: j.id, habilidad: 'pass', chequeo: c });
  } else if (!c.exito && opciones.alFallar?.('pase', c)) {
    const E = estado.equipos[j.equipo];
    if (E.rerolls <= 0) throw new Error('No quedan rerolls de equipo.');
    E.rerolls--;
    c = chequeo({ objetivo: j.perfil.ps, mods, azar, motivo: `pase (${j.id}, reroll de equipo)` });
    anotar(estado, 'pase_reroll', { jugador: j.id, habilidad: null, chequeo: c });
  }

  // Pifia: 1 natural o resultado modificado ≤ 1.
  if (c.natural1 || c.modificado <= 1) {
    if (tiene(j.hab, 'safe_pass') && c.natural1) {
      anotar(estado, 'pase_seguro', { jugador: j.id, efecto: 'mantiene el balón; la activación termina' });
      terminarActivacion(estado);
      return { resultado: 'retenido' };
    }
    anotar(estado, 'pifia', { jugador: j.id });
    estado.balon = null;
    rebotar(estado, j.x, j.y, { azar });
    estado.turnover = { causa: 'pifia' };
    terminarActivacion(estado);
    return { resultado: 'pifia' };
  }

  let preciso = c.exito;
  if (esALoLoco && preciso) {
    preciso = false; // un Pase a lo loco nunca es preciso
    anotar(estado, 'a_lo_loco', { jugador: j.id });
  }

  // ¿Dónde va a caer? Impreciso: Dispersión (3) desde el objetivo, en el aire.
  estado.balon = null;
  let cx = objetivoX, cy = objetivoY;
  if (!preciso) {
    for (let i = 0; i < 3; i++) {
      const d = tirar(8, { azar, motivo: 'dispersión del pase' });
      cx += DIRECCIONES_D8[d.valor][0]; cy += DIRECCIONES_D8[d.valor][1];
      if (!enCampo(cx, cy)) break;
    }
    anotar(estado, 'pase_impreciso', { caeEn: [cx, cy] });
  }

  // Intercepción: un rival de pie bajo la regla, entre el lanzador y donde VA A CAER.
  if (enCampo(cx, cy) && !esALoLoco && !tiene(j.hab, 'cloud_burster') && opciones.elegirInterceptor) {
    const celdas = casillasBajoLaRegla(j.x, j.y, cx, cy);
    const candidatos = Object.values(estado.jugadores).filter((r) =>
      r.equipo !== j.equipo && tieneZonaDefensa(r) &&
      celdas.some(([x, y]) => x === r.x && y === r.y) && !(r.x === cx && r.y === cy));
    const id = candidatos.length ? opciones.elegirInterceptor(candidatos.map((r) => r.id)) : null;
    if (id) {
      const interceptor = jugador(estado, id);
      const modsI = [{ v: preciso ? -3 : -2, porque: preciso ? 'pase preciso' : 'pase impreciso' }];
      for (const m of marcadoresDe(estado, interceptor.equipo, interceptor.x, interceptor.y)) {
        modsI.push({ v: -1, porque: `${m.id} marca al interceptor` });
      }
      if (estado.clima === 'pouring_rain') modsI.push({ v: -1, porque: 'Lluvia torrencial' });
      if (tiene(interceptor.hab, 'stunty')) modsI.push({ v: -1, porque: 'Escurridizo' });
      const ci = chequeo({ objetivo: interceptor.perfil.ag, mods: modsI, azar, motivo: `intercepción (${id})` });
      anotar(estado, 'intercepcion', { jugador: id, chequeo: ci });
      if (ci.exito) {
        estado.balon = { portador: id };
        estado.turnover = { causa: 'intercepcion' };
        terminarActivacion(estado);
        return { resultado: 'interceptado', por: id };
      }
    }
  }

  if (esALoLoco && !enCampo(cx, cy)) {
    // Un Pase a lo loco también puede salirse al dispersarse.
  }
  if (!enCampo(cx, cy)) {
    saqueDeBanda(estado, Math.max(0, Math.min(14, cx)), Math.max(0, Math.min(25, cy)), { azar });
  } else {
    const receptor = enCasilla(estado, cx, cy);
    if (receptor) {
      intentarAtrapar(estado, receptor, { azar, paseObjetivo: preciso && cx === objetivoX && cy === objetivoY });
      if (!estado.balon?.portador) rebotar(estado, cx, cy, { azar });
    } else {
      estado.balon = { x: cx, y: cy };
      rebotar(estado, cx, cy, { azar });
    }
  }
  return finalizarJugadaDeBalon(estado, j, 'pase', tipo);
}

/** La Entrega: a un compañero adyacente de pie con zona de defensa; solo hay atrapar. */
export function entrega(estado, companeroId, { azar } = {}) {
  const a = estado.activacion;
  if (!a || a.accion !== 'handoff') throw new Error('Hace falta una acción de Entrega.');
  const j = jugador(estado, a.jugador);
  if (estado.balon?.portador !== j.id) throw new Error(`${j.id} no lleva el balón.`);
  if (tiene(j.hab, 'my_ball')) throw new Error('El balón es mío: no lo suelta voluntariamente.');
  const c = jugador(estado, companeroId);
  if (c.equipo !== j.equipo) throw new Error('La Entrega es a un compañero.');
  if (!tieneZonaDefensa(c)) throw new Error('El compañero debe estar de pie y con zona de defensa.');
  if (Math.max(Math.abs(c.x - j.x), Math.abs(c.y - j.y)) !== 1) throw new Error('Debe estar adyacente.');

  anotar(estado, 'entrega', { de: j.id, a: c.id });
  estado.balon = null;
  intentarAtrapar(estado, c, { azar });
  if (!estado.balon?.portador) rebotar(estado, c.x, c.y, { azar });
  return finalizarJugadaDeBalon(estado, j, 'entrega', 'quick');
}

/** Tras pase o entrega: cambio de turno si el balón no acaba en manos del equipo activo. */
function finalizarJugadaDeBalon(estado, j, jugada, tipo) {
  const portador = estado.balon?.portador ? jugador(estado, estado.balon.portador) : null;
  const enManosActivas = portador && portador.equipo === estado.activo;
  if (!enManosActivas) {
    estado.turnover = { causa: portador ? `${jugada}_al_rival` : `${jugada}_al_suelo` };
    terminarActivacion(estado);
    return { resultado: 'turnover' };
  }
  // Pasar y seguir: tras un Pase rápido o una Entrega sin cambio de turno, puede seguir.
  if (tiene(j.hab, 'give_and_go') && (jugada === 'entrega' || tipo === 'quick')) {
    anotar(estado, 'pasar_y_seguir', { jugador: j.id });
    return { resultado: 'completado', sigue: true };
  }
  terminarActivacion(estado);
  return { resultado: 'completado' };
}
