// Lanzar compañero: el Big Guy con el rasgo agarra a un compañero adyacente con
// Humanoide bala y lo tira por los aires.
//
// Fuente: source/tablas/acciones-y-modificadores.md («Lanzar compañero») y los rasgos
// Siempre hambriento y Humanoide bala.
//
// Decisión anotada: la hoja de acciones dice que caer al público es cambio de turno a
// secas, pero la lista canónica de causas (fundamentos §6) y la FAQ del devorado lo
// limitan al PORTADOR. Se sigue la lista: turnover solo si llevaba el balón.

import { tirar, chequeo } from './dice.js';
import { enCampo, DIRECCIONES_D8, sonAdyacentes } from './tablero.js';
import { jugador, enCasilla, marcadoresDe, anotar } from './partido.js';
import { tiene } from '../data/habilidades.js';
import { resolverSuelo, aplicarResultadoHeridas, heridaDirecta } from './derribo.js';
import { tiradaHeridas } from './heridas.js';
import { rebotar, saqueDeBanda, soltarBalon } from './balon.js';
import { alcance } from './pase.js';
import { terminarActivacion } from './movimiento.js';

/**
 * Lanza al compañero a la casilla objetivo. Requiere una acción 'ttm' en curso, el
 * rasgo Lanzar compañero en el lanzador y Humanoide bala en el lanzado; el objetivo
 * debe caer en las dos primeras secciones de la regla (rápido o corto).
 */
export function lanzarCompanero(estado, companeroId, objetivoX, objetivoY, { azar, opciones = {} } = {}) {
  const a = estado.activacion;
  if (!a || a.accion !== 'ttm') throw new Error('Hace falta una acción de Lanzar compañero.');
  const L = jugador(estado, a.jugador);
  const C = jugador(estado, companeroId);
  if (!tiene(L.hab, 'throw_team_mate')) throw new Error(`${L.id} no sabe lanzar compañeros.`);
  if (C.equipo !== L.equipo) throw new Error('Solo se lanza a los compañeros (en teoría).');
  if (!tiene(C.hab, 'right_stuff')) throw new Error(`${C.id} no tiene Humanoide bala.`);
  if (!sonAdyacentes(L.x, L.y, C.x, C.y)) throw new Error('El compañero debe estar adyacente.');
  if (!enCampo(objetivoX, objetivoY)) throw new Error('La casilla objetivo debe estar en el campo.');

  const tipo = alcance(L.x, L.y, objetivoX, objetivoY);
  if (tipo !== 'quick' && tipo !== 'short') {
    throw new Error('Un compañero solo llega a las dos primeras secciones de la regla.');
  }

  // El lanzado puede estar tumbado (Humanoide bala lo permite), pero lo pagará al caer.
  const estabaDePie = C.postura === 'de_pie';
  const llevabaBalon = estado.balon?.portador === C.id;
  anotar(estado, 'lanzar_companero', { lanzador: L.id, lanzado: C.id, a: [objetivoX, objetivoY], alcance: tipo });

  // Siempre hambriento: 1D6 antes del chequeo; con 1 intenta comérselo.
  if (tiene(L.hab, 'always_hungry')) {
    const d = tirar(6, { azar, motivo: `Siempre hambriento (${L.id})` });
    anotar(estado, 'siempre_hambriento', { jugador: L.id, d6: d.valor });
    if (d.valor === 1) {
      const bocado = tirar(6, { azar, motivo: `intento de merienda (${L.id})` });
      if (bocado.valor === 1) {
        // Devorado: se retira de la plantilla, sin apotecario ni Regeneración.
        anotar(estado, 'devorado', { jugador: C.id, por: L.id });
        if (llevabaBalon) {
          estado.balon = null;
          rebotar(estado, C.x, C.y, { azar });
          estado.turnover = { causa: 'companero_devorado' };
        }
        C.situacion = 'devorado'; C.x = C.y = -1;
        terminarActivacion(estado);
        return { resultado: 'devorado' };
      }
      anotar(estado, 'casi_merienda', { jugador: C.id, efecto: 'el lanzamiento se convierte en pifia' });
      return resolverVuelo(estado, L, C, { pifia: true, llevabaBalon, estabaDePie, azar, opciones });
    }
  }

  // Chequeo de precisión del lanzador (PS): alcance y marcadores.
  const mods = [];
  if (tipo === 'short') mods.push({ v: -1, porque: 'lanzamiento corto' });
  for (const m of marcadoresDe(estado, L.equipo, L.x, L.y)) {
    mods.push({ v: -1, porque: `${m.id} marca al lanzador` });
  }
  let c = chequeo({ objetivo: L.perfil.ps, mods, azar, motivo: `lanzar compañero (${L.id})` });
  anotar(estado, 'lanzamiento', { jugador: L.id, chequeo: c });
  if (!c.exito && opciones.alFallar?.('lanzamiento', c)) {
    const E = estado.equipos[L.equipo];
    if (E.rerolls <= 0) throw new Error('No quedan rerolls de equipo.');
    E.rerolls--;
    c = chequeo({ objetivo: L.perfil.ps, mods, azar, motivo: `lanzar compañero (${L.id}, reroll)` });
    anotar(estado, 'lanzamiento_reroll', { jugador: L.id, chequeo: c });
  }

  if (c.natural1 || c.modificado <= 1) {
    return resolverVuelo(estado, L, C, { pifia: true, llevabaBalon, estabaDePie, azar, opciones });
  }
  return resolverVuelo(estado, L, C, {
    objetivoX, objetivoY, mediocre: !c.exito, llevabaBalon, estabaDePie, azar, opciones,
  });
}

/**
 * El vuelo y el aterrizaje.
 * Excelente: dispersión (3) desde el objetivo. Mediocre: igual, con −1 al aterrizar.
 * Pifia: rebota (1) desde el lanzador, con −1 al aterrizar.
 */
function resolverVuelo(estado, L, C, { objetivoX, objetivoY, pifia = false, mediocre = false, llevabaBalon, estabaDePie, azar, opciones }) {
  // El compañero despega: su casilla queda libre durante el vuelo.
  const origen = { x: C.x, y: C.y };
  C.x = -1; C.y = -1;

  let x, y, pasos;
  if (pifia) {
    x = L.x; y = L.y; pasos = 1;
    anotar(estado, 'lanzamiento_pifia', { lanzado: C.id });
  } else {
    x = objetivoX; y = objetivoY; pasos = 3;
  }
  let dentroX = pifia ? L.x : null, dentroY = pifia ? L.y : null;
  for (let i = 0; i < pasos; i++) {
    const d = tirar(8, { azar, motivo: 'dispersión del compañero' });
    x += DIRECCIONES_D8[d.valor][0]; y += DIRECCIONES_D8[d.valor][1];
    if (enCampo(x, y)) { dentroX = x; dentroY = y; }
    else break;
  }
  anotar(estado, 'vuelo', { lanzado: C.id, caeEn: [x, y] });

  // Al público: heridas sin armadura; saque de banda si llevaba el balón; cambio de
  // turno solo si era el portador (ver nota de cabecera).
  if (!enCampo(x, y)) {
    if (llevabaBalon) {
      estado.balon = null;
      saqueDeBanda(estado, dentroX ?? origen.x, dentroY ?? origen.y, { azar });
      estado.turnover = { causa: 'portador_al_publico' };
    }
    const r = resolverSuelo(estado, C, { forma: 'derribado', azar, porElPublico: true });
    anotar(estado, 'lanzado_al_publico', { jugador: C.id, final: r.final });
    terminarActivacion(estado);
    return { resultado: 'publico', final: r.final };
  }

  // Aterrizaje forzoso: cae sobre alguien → ese alguien es derribado, y el lanzado
  // rebota desde ahí y se cae (repitiendo si vuelve a caer sobre otro).
  let aplastados = [];
  let ocupante = enCasilla(estado, x, y);
  let forzoso = !!ocupante;
  for (let i = 0; ocupante && i < 20; i++) {
    anotar(estado, 'aterrizaje_forzoso', { lanzado: C.id, sobre: ocupante.id });
    const yaEnElSuelo = ocupante.postura !== 'de_pie' && ocupante.postura !== 'distraido';
    aplastados.push(resolverSuelo(estado, ocupante, { forma: 'derribado', azar, yaEnElSuelo }));
    const d = tirar(8, { azar, motivo: 'rebote del lanzado' });
    x += DIRECCIONES_D8[d.valor][0]; y += DIRECCIONES_D8[d.valor][1];
    if (!enCampo(x, y)) {
      if (llevabaBalon) {
        estado.balon = null;
        saqueDeBanda(estado, x - DIRECCIONES_D8[d.valor][0], y - DIRECCIONES_D8[d.valor][1], { azar });
        estado.turnover = { causa: 'portador_al_publico' };
      }
      const r = resolverSuelo(estado, C, { forma: 'derribado', azar, porElPublico: true });
      terminarActivacion(estado);
      return { resultado: 'publico', final: r.final, aplastados };
    }
    ocupante = enCasilla(estado, x, y);
  }

  C.x = x; C.y = y;

  if (forzoso) {
    // Tras el rebote se cae sin chequeo de aterrizaje.
    const r = resolverSuelo(estado, C, { forma: 'caida', azar });
    if (llevabaBalon && r.final !== 'de_pie') estado.turnover = { causa: 'portador_derribado' };
    terminarActivacion(estado);
    return { resultado: 'forzoso', final: r.final, aplastados };
  }

  // Aterrizaje normal: chequeo de AG del lanzado. Lanzado tumbado/aturdido/distraído:
  // falla automáticamente.
  if (!estabaDePie) {
    anotar(estado, 'aterrizaje_imposible', { jugador: C.id, porque: 'no estaba de pie al despegar' });
    const r = resolverSuelo(estado, C, { forma: 'caida', azar });
    if (llevabaBalon && r.final !== 'de_pie') estado.turnover = { causa: 'portador_derribado' };
    terminarActivacion(estado);
    return { resultado: 'caida', final: r.final };
  }

  const mods = [];
  for (const m of marcadoresDe(estado, C.equipo, x, y)) {
    mods.push({ v: -1, porque: `${m.id} marca el aterrizaje` });
  }
  if (mediocre) mods.push({ v: -1, porque: 'lanzamiento mediocre' });
  if (pifia) mods.push({ v: -1, porque: 'lanzamiento pifiado' });

  let c = chequeo({ objetivo: C.perfil.ag, mods, azar, motivo: `aterrizaje (${C.id})` });
  anotar(estado, 'aterrizaje', { jugador: C.id, chequeo: c });
  if (!c.exito && opciones.alFallar?.('aterrizaje', c)) {
    const E = estado.equipos[C.equipo];
    if (E.rerolls <= 0) throw new Error('No quedan rerolls de equipo.');
    E.rerolls--;
    c = chequeo({ objetivo: C.perfil.ag, mods, azar, motivo: `aterrizaje (${C.id}, reroll)` });
    anotar(estado, 'aterrizaje_reroll', { jugador: C.id, chequeo: c });
  }

  if (c.exito) {
    anotar(estado, 'aterrizaje_limpio', { jugador: C.id });
    terminarActivacion(estado);
    return { resultado: 'de_pie' };
  }
  const r = resolverSuelo(estado, C, { forma: 'caida', azar });
  if (llevabaBalon && r.final !== 'de_pie') estado.turnover = { causa: 'portador_derribado' };
  terminarActivacion(estado);
  return { resultado: 'caida', final: r.final };
}
