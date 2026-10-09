// Activación y movimiento: declarar acción (con los rasgos negativos), levantarse,
// paso a paso con Esquivar, Forzar la marcha, Saltar y recoger el balón.
//
// Fuente: source/tablas/acciones-y-modificadores.md («Acciones», «Movimiento»)
// y los rasgos negativos de source/habilidades/rasgos.md.

import { tirar, chequeo, azarReal } from './dice.js';
import { enCampo, sonAdyacentes } from './tablero.js';
import { jugador, enCasilla, marcadoresDe, estaMarcado, anotar, tieneZonaDefensa } from './partido.js';
import { tiene } from '../data/habilidades.js';
import { resolverSuelo } from './derribo.js';
import { rebotar } from './balon.js';
import { usarRerollEquipo } from './rerolls.js';
import { filaAnotacion } from './tablero.js';

/** Acciones limitadas a 1 por turno de equipo. */
const UNA_POR_TURNO = new Set(['blitz', 'pass', 'handoff', 'foul', 'ttm', 'secure']);

export const MAX_RUSH = 2;

/**
 * Declara la acción de un jugador y resuelve los rasgos que se tiran «tras declarar»
 * (Estúpido, Realmente estúpido, Ira descontrolada, Ferocidad animal).
 *
 * Si el rasgo falla, la acción CUENTA como declarada igualmente (nadie más puede hacer
 * la Penetración ese turno aunque el Troll se quede mirando las nubes).
 */
export function activar(estado, jugadorId, accion, { azar, companeroObjetivo = null, objetivo = null } = {}) {
  const j = jugador(estado, jugadorId);
  if (estado.turnover) throw new Error('El turno ha terminado.');
  if (estado.activacion) throw new Error(`Ya hay una activación en curso (${estado.activacion.jugador}).`);
  if (j.equipo !== estado.activo) throw new Error(`${jugadorId} no es del equipo activo.`);
  if (j.situacion !== 'campo') throw new Error(`${jugadorId} no está en el campo.`);
  if (j.activado) throw new Error(`${jugadorId} ya se activó este turno.`);
  if (j.postura === 'aturdido') throw new Error(`${jugadorId} está aturdido: no puede activarse.`);
  if (UNA_POR_TURNO.has(accion) && estado.usadas[accion]) {
    throw new Error(`La acción ${accion} ya se declaró este turno.`);
  }

  // ¡A la carga! (evento de patada 10): hasta D3+3 desmarcados del pateador, con
  // Movimiento; UNO puede hacer Penetración y UNO Lanzar compañero. Si alguien cae,
  // la Carga se corta (vía turnover, que terminarEvento limpia).
  if (estado.pendiente?.tipo === 'blitz_event') {
    if (!['move', 'blitz', 'ttm'].includes(accion)) {
      throw new Error('En la Carga solo caben Movimiento, una Penetración y un Lanzar compañero.');
    }
    if (estado.pendiente.restantes <= 0) throw new Error('La Carga ya gastó sus activaciones.');
    if (estaMarcado(estado, j)) throw new Error('A la Carga solo van jugadores desmarcados.');
    estado.pendiente.restantes--;
  }

  // Asegurar el balón: solo con el balón suelto, sin rivales de pie no distraídos a 2
  // casillas al declarar, y la declaran ni Big Guys ni jugadores con Tembloroso.
  if (accion === 'secure') {
    const b = estado.balon;
    if (!b || b.portador) throw new Error('Asegurar el balón exige un balón suelto.');
    if (j.grande) throw new Error('Los jugadores grandes no pueden Asegurar el balón.');
    if (tiene(j.hab, 'unsteady')) throw new Error('Tembloroso: no puede Asegurar el balón.');
    const rivalCerca = Object.values(estado.jugadores).some((r) =>
      r.equipo !== j.equipo && tieneZonaDefensa(r) &&
      Math.max(Math.abs(r.x - b.x), Math.abs(r.y - b.y)) <= 2);
    if (rivalCerca) throw new Error('Hay un rival de pie a 2 casillas del balón.');
  }

  j.activado = true;
  if (UNA_POR_TURNO.has(accion)) estado.usadas[accion] = true;
  // Distraído: se quita al activarse, antes de declarar (FAQ). También recupera los
  // apoyos que le quitó un Piquete de ojos.
  if (j.postura === 'distraido') j.postura = 'de_pie';
  j.sinApoyos = false;

  // La Penetración nombra a su objetivo al declararse.
  if (accion === 'blitz') {
    if (!objetivo) throw new Error('La Penetración declara su objetivo al activarse.');
    const O = jugador(estado, objetivo);
    if (O.equipo === j.equipo || O.situacion !== 'campo') throw new Error('Objetivo inválido.');
  }

  estado.activacion = {
    jugador: jugadorId, accion, objetivoBlitz: objetivo,
    mvGastado: 0, rushUsados: 0, esquivarUsado: false, placajeHecho: false, terminada: false,
    // Stalling: la condición se evalúa AL ACTIVARSE (como FFB StallingExtension) y la
    // piedra se tira al terminar la activación si sigue siendo culpable.
    vigiladoPorStalling: puedeAnotarSinDados(estado, j),
  };
  anotar(estado, 'activacion', { jugador: jugadorId, accion, objetivo });

  const negatraits = resolverRasgosNegativos(estado, j, accion, { azar, companeroObjetivo });
  if (negatraits?.terminaActivacion) terminarActivacion(estado);
  return negatraits;
}

function resolverRasgosNegativos(estado, j, accion, { azar, companeroObjetivo }) {
  const esAtaque = accion === 'block' || accion === 'blitz';

  // Estúpido (Bone Head): 1D6, 2+ sigue; 1 = Distraído y la activación termina.
  if (tiene(j.hab, 'bone_head')) {
    const c = chequeo({ objetivo: 2, azar, motivo: `Estúpido (${j.id})` });
    anotar(estado, 'bone_head', { jugador: j.id, chequeo: c });
    if (!c.exito) { j.postura = 'distraido'; return { rasgo: 'bone_head', fallo: true, terminaActivacion: true }; }
  }

  // Realmente estúpido: 4+ (con +2 si hay compañero de pie no distraído y sin el rasgo al lado).
  if (tiene(j.hab, 'really_stupid')) {
    const ayuda = Object.values(estado.jugadores).some((c) =>
      c.equipo === j.equipo && c.id !== j.id && tieneZonaDefensa(c) &&
      !tiene(c.hab, 'really_stupid') && sonAdyacentes(c.x, c.y, j.x, j.y));
    const mods = ayuda ? [{ v: +2, porque: 'compañero de pie adyacente que le explica qué hacer' }] : [];
    const c = chequeo({ objetivo: 4, mods, azar, motivo: `Realmente estúpido (${j.id})` });
    anotar(estado, 'really_stupid', { jugador: j.id, chequeo: c });
    if (!c.exito) { j.postura = 'distraido'; return { rasgo: 'really_stupid', fallo: true, terminaActivacion: true }; }
  }

  // Ira descontrolada: 4+ (+2 en Placaje/Penetración); si falla, ruge y pierde la activación.
  if (tiene(j.hab, 'unchannelled_fury')) {
    const mods = esAtaque ? [{ v: +2, porque: 'va a pegar a alguien (Placaje o Penetración)' }] : [];
    const c = chequeo({ objetivo: 4, mods, azar, motivo: `Ira descontrolada (${j.id})` });
    anotar(estado, 'unchannelled_fury', { jugador: j.id, chequeo: c });
    if (!c.exito) return { rasgo: 'unchannelled_fury', fallo: true, terminaActivacion: true };
  }

  // Ferocidad animal: 4+ (+2 en Placaje/Penetración); si falla, derriba a un compañero
  // adyacente de pie (y después PUEDE continuar su activación, FAQ). Sin compañero al
  // lado, se queda Distraído y la activación termina.
  if (tiene(j.hab, 'animal_savagery')) {
    const mods = esAtaque ? [{ v: +2, porque: 'va a pegar a alguien (Placaje o Penetración)' }] : [];
    const c = chequeo({ objetivo: 4, mods, azar, motivo: `Ferocidad animal (${j.id})` });
    anotar(estado, 'animal_savagery', { jugador: j.id, chequeo: c });
    if (!c.exito) {
      const candidatos = Object.values(estado.jugadores).filter((v) =>
        v.equipo === j.equipo && v.id !== j.id && v.situacion === 'campo' &&
        (v.postura === 'de_pie' || v.postura === 'distraido') && sonAdyacentes(v.x, v.y, j.x, j.y));
      if (!candidatos.length) {
        j.postura = 'distraido';
        return { rasgo: 'animal_savagery', fallo: true, terminaActivacion: true };
      }
      const victima = candidatos.find((v) => v.id === companeroObjetivo) ?? candidatos[0];
      const llevabaBalon = estado.balon?.portador === victima.id;
      // Con Golpe mortífero debe usarlo contra el compañero.
      const modsArmadura = tiene(j.hab, 'mighty_blow')
        ? [{ v: +1, porque: 'Golpe mortífero (obligado contra su compañero)' }] : [];
      const suelo = resolverSuelo(estado, victima, { forma: 'derribado', azar, modsArmadura });
      anotar(estado, 'ataque_a_companero', { jugador: j.id, victima: victima.id, resultado: suelo.final });
      // Sin cambio de turno salvo que la víctima llevara el balón.
      if (suelo.final !== 'de_pie' && llevabaBalon) {
        estado.turnover = { causa: 'portador_derribado' };
      }
      return { rasgo: 'animal_savagery', fallo: true, victima: victima.id, terminaActivacion: false };
    }
  }
  return { fallo: false };
}

/** MV efectivo del jugador en esta activación. */
export const mvRestante = (estado) => {
  const a = estado.activacion;
  const j = jugador(estado, a.jugador);
  return j.perfil.mv - a.mvGastado;
};

export function terminarActivacion(estado) {
  if (estado.activacion) estado.activacion.terminada = true;
  estado.activacion = null;
}

/**
 * Cierra la activación por decisión del entrenador. Una acción de Asegurar el balón
 * que no termina en la casilla del balón es cambio de turno, y un portador que podía
 * anotar gratis y no lo hizo se expone a la piedra del público.
 */
export function terminarAccion(estado, { azar = azarReal } = {}) {
  const a = estado.activacion;
  if (!a) return;
  if (a.accion === 'secure') {
    const j = jugador(estado, a.jugador);
    if (estado.balon?.portador !== j.id) {
      anotar(estado, 'asegurar_incumplido', { jugador: j.id });
      estado.turnover = { causa: 'asegurar_incumplido' };
    }
  }
  piedraDelPublico(estado, { azar });
  terminarActivacion(estado);
}

/**
 * Levantarse: cuesta 3 de MV, lo primero de la activación. Con MV ≤ 2: 1D6, con 4+ se
 * levanta gastando todo su MV; con 1-3 sigue tumbado y la activación termina.
 */
export function levantarse(estado, { azar } = {}) {
  const a = estado.activacion;
  if (!a) throw new Error('No hay activación en curso.');
  const j = jugador(estado, a.jugador);
  if (j.postura !== 'tumbado') throw new Error(`${j.id} no está tumbado.`);
  if (a.mvGastado > 0) throw new Error('Levantarse va antes de moverse.');

  if (j.perfil.mv <= 2) {
    const c = chequeo({ objetivo: 4, azar, motivo: `levantarse con MV ${j.perfil.mv} (${j.id})` });
    anotar(estado, 'levantarse_dificil', { jugador: j.id, chequeo: c });
    if (!c.exito) { terminarActivacion(estado); return { exito: false, chequeo: c }; }
    j.postura = 'de_pie';
    a.mvGastado = j.perfil.mv; // todo su MV
    return { exito: true, chequeo: c };
  }
  j.postura = 'de_pie';
  a.mvGastado += 3;
  anotar(estado, 'levantarse', { jugador: j.id });
  return { exito: true };
}

/**
 * Un paso de movimiento a una casilla adyacente libre.
 *
 * Orden de tiradas en la misma casilla (acciones-y-modificadores.md):
 * Forzar la marcha → Esquivar → recoger el balón.
 *
 * `alFallar(tipo, chequeo)` → true para repetir con reroll de equipo (lo decide la capa
 * de turno o la UI); las repeticiones de habilidad (Esquivar) se aplican solas.
 */
/**
 * ¿Puede este jugador anotar sin tirar NINGÚN dado? (la condición de Stalling)
 *
 * Criterios (FFB StallingExtension, BB2025): lleva el balón, está de pie, no tiene
 * rasgos que tiren al activarse (Estúpido y familia), NO está marcado en su casilla,
 * y existe un camino hasta la zona de anotación dentro de su MV —sin Forzar la
 * marcha— cuyas casillas intermedias están libres y sin marcar (salir de ellas no
 * exigiría esquivar). La casilla final de la zona puede estar marcada: se anota al
 * entrar. Fuente: secuencia-de-partido.md §3 + oráculo FFB.
 */
export function puedeAnotarSinDados(estado, j) {
  if (estado.balon?.portador !== j.id) return false;
  if (j.situacion !== 'campo' || j.postura !== 'de_pie') return false;
  const RASGOS_DE_ACTIVACION = ['bone_head', 'really_stupid', 'animal_savagery', 'unchannelled_fury'];
  if (RASGOS_DE_ACTIVACION.some((r) => tiene(j.hab, r))) return false;
  if (estaMarcado(estado, j)) return false;

  const meta = filaAnotacion(j.equipo);
  if (j.y === meta) return false; // ya está dentro: eso es anotar, no hacer tiempo

  // BFS por casillas libres y sin marcar, a lo sumo MV pasos.
  const vistos = new Set([`${j.x},${j.y}`]);
  let frontera = [[j.x, j.y]];
  for (let paso = 1; paso <= j.perfil.mv; paso++) {
    const siguiente = [];
    for (const [x, y] of frontera) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        const clave = `${nx},${ny}`;
        if (!enCampo(nx, ny) || vistos.has(clave) || enCasilla(estado, nx, ny)) continue;
        if (ny === meta) return true; // entrar en la zona anota, aunque esté marcada
        if (marcadoresDe(estado, j.equipo, nx, ny).length) continue; // salir exigiría esquivar
        vistos.add(clave);
        siguiente.push([nx, ny]);
      }
    }
    frontera = siguiente;
    if (!frontera.length) break;
  }
  return false;
}

/**
 * La piedra del público («el público actúa»). Se tira al cerrar la activación de un
 * portador vigilado que sigue con el balón, de pie y sin anotar: 1D6 ≥ número de turno
 * → derribado (armadura y heridas) y cambio de turno. A partir del turno 7 el D6 ya no
 * alcanza y no se tira (atajo del oráculo FFB). Reroll de equipo: prohibido.
 */
function piedraDelPublico(estado, { azar }) {
  const a = estado.activacion;
  if (!a?.vigiladoPorStalling) return;
  const j = jugador(estado, a.jugador);
  if (estado.balon?.portador !== j.id) return;                 // se deshizo del balón
  if (j.situacion !== 'campo' || j.postura !== 'de_pie') return;
  if (j.y === filaAnotacion(j.equipo)) return;                 // anotó
  if (estado.turnover) return;                                 // el turno ya se rompió

  const turno = estado.equipos[j.equipo].turno;
  if (turno > 6) {
    anotar(estado, 'stalling_sin_piedra', { jugador: j.id, turno });
    return;
  }
  const d = tirar(6, { azar, motivo: `el público actúa (${j.id})` });
  anotar(estado, 'stalling', { jugador: j.id, turno, d6: d.valor, acierta: d.valor >= turno });
  if (d.valor >= turno) {
    const r = resolverSuelo(estado, j, { forma: 'derribado', azar });
    if (r.final !== 'de_pie') estado.turnover = { causa: 'el_publico_actua' };
  }
}

/** Acciones que incluyen movimiento; el resto (Placaje, Apuñalar, Vómito…) no se mueve. */
const CON_MOVIMIENTO = new Set(['move', 'blitz', 'pass', 'handoff', 'foul', 'secure', 'ttm']);

export function paso(estado, destinoX, destinoY, { azar, alFallar = () => false, ...opcionesPaso } = {}) {
  const a = estado.activacion;
  if (!a) throw new Error('No hay activación en curso.');
  if (!CON_MOVIMIENTO.has(a.accion)) throw new Error(`La acción ${a.accion} no incluye movimiento.`);
  const j = jugador(estado, a.jugador);
  if (j.postura === 'tumbado') throw new Error(`${j.id} debe levantarse primero.`);
  if (!enCampo(destinoX, destinoY)) throw new Error('Fuera del campo.');
  if (!sonAdyacentes(j.x, j.y, destinoX, destinoY)) throw new Error('Solo a una casilla adyacente.');
  if (enCasilla(estado, destinoX, destinoY)) throw new Error('La casilla está ocupada.');

  // 1. ¿Hace falta Forzar la marcha?
  if (a.mvGastado >= j.perfil.mv) {
    if (a.rushUsados >= MAX_RUSH) throw new Error('Sin movimiento: ya forzó la marcha dos veces.');
    a.rushUsados++;
    const mods = estado.clima === 'blizzard' ? [{ v: -1, porque: 'Ventisca' }] : [];
    let c = chequeo({ objetivo: 2, mods, azar, motivo: `Forzar la marcha (${j.id})` });
    anotar(estado, 'rush', { jugador: j.id, chequeo: c });
    if (!c.exito && alFallar('rush', c, j.id) && usarRerollEquipo(estado, j, { azar }).repite) {
      c = chequeo({ objetivo: 2, mods, azar, motivo: `Forzar la marcha (${j.id}, reroll)` });
      anotar(estado, 'rush_reroll', { jugador: j.id, chequeo: c });
    }
    if (!c.exito) {
      moverA(estado, j, destinoX, destinoY);
      return caerse(estado, j, { azar, causa: 'rush' });
    }
  }

  // Dejada (Fumblerooski): el portador puede dejar el balón en la casilla que abandona.
  const origen = [j.x, j.y];
  if (opcionesPaso?.dejarBalon) {
    if (estado.balon?.portador !== j.id) throw new Error(`${j.id} no lleva el balón.`);
    if (!tiene(j.hab, 'fumblerooski')) throw new Error('Hace falta Dejada para soltar sin rebote.');
    estado.balon = { x: j.x, y: j.y };
    anotar(estado, 'dejada', { jugador: j.id, en: origen });
  }

  // 2. ¿Esquiva? (sale de una casilla donde está marcado)
  const marcadoAqui = estaMarcado(estado, j);
  if (marcadoAqui) {
    const r = esquivar(estado, j, origen, [destinoX, destinoY], { azar, alFallar });
    if (!r.exito) {
      moverA(estado, j, destinoX, destinoY);
      a.mvGastado++;
      return caerse(estado, j, { azar, causa: 'esquivar', modsArmadura: r.modsArmadura });
    }
  }

  // 3. Llega.
  moverA(estado, j, destinoX, destinoY);
  a.mvGastado++;

  // 4. ¿Hay balón suelto en la casilla? Recogida obligatoria (movimiento voluntario).
  if (estado.balon && !estado.balon.portador &&
      estado.balon.x === destinoX && estado.balon.y === destinoY) {
    return recogerBalon(estado, j, { azar, alFallar });
  }
  return { exito: true };
}

function moverA(estado, j, x, y) {
  j.x = x; j.y = y;
}

/** El chequeo de esquivar, con Escurridizo, Cola prensil y la habilidad Esquivar. */
function esquivar(estado, j, [ox, oy], [dx, dy], { azar, alFallar }) {
  const a = estado.activacion;
  const mods = [];

  // −1 por rival que marque la casilla de destino… salvo Escurridizo.
  if (!tiene(j.hab, 'stunty')) {
    for (const m of marcadoresDe(estado, j.equipo, dx, dy)) {
      mods.push({ v: -1, porque: `${m.id} marca el destino` });
    }
  } else {
    anotar(estado, 'stunty', { jugador: j.id, efecto: 'ignora los marcadores al esquivar' });
  }

  // Cola prensil: −1 adicional si sale de la zona de defensa de quien la tiene (solo una).
  const conCola = marcadoresDe(estado, j.equipo, ox, oy).find((m) => tiene(m.hab, 'prehensile_tail'));
  if (conCola) mods.push({ v: -1, porque: `Cola prensil de ${conCola.id}` });

  let c = chequeo({ objetivo: j.perfil.ag, mods, azar, motivo: `esquivar (${j.id})` });
  anotar(estado, 'esquivar', { jugador: j.id, de: [ox, oy], a: [dx, dy], chequeo: c });

  // Nunca se repite una repetición (fundamentos §6): la habilidad Esquivar es gratis y
  // va primero; si se usa, el chequeo queda agotado y el reroll de equipo ya no cabe.
  if (!c.exito && tiene(j.hab, 'dodge') && !a.esquivarUsado) {
    a.esquivarUsado = true;
    c = chequeo({ objetivo: j.perfil.ag, mods, azar, motivo: `esquivar (${j.id}, repite por Esquivar)` });
    anotar(estado, 'esquivar_reroll', { jugador: j.id, habilidad: 'dodge', chequeo: c });
  } else if (!c.exito && alFallar('esquivar', c, j.id) && usarRerollEquipo(estado, j, { azar }).repite) {
    c = chequeo({ objetivo: j.perfil.ag, mods, azar, motivo: `esquivar (${j.id}, reroll de equipo)` });
    anotar(estado, 'esquivar_reroll', { jugador: j.id, habilidad: null, chequeo: c });
  }

  // Llave de brazo: si cae al fallar la esquiva, +1 a Armadura o Heridas (solo uno).
  const modsArmadura = [];
  if (!c.exito) {
    const conLlave = marcadoresDe(estado, j.equipo, ox, oy).find((m) => tiene(m.hab, 'arm_bar'));
    if (conLlave) modsArmadura.push({ v: +1, porque: `Llave de brazo de ${conLlave.id}` });
  }
  return { exito: c.exito, chequeo: c, modsArmadura };
}

/** Recoger el balón al entrar en su casilla durante la activación. */
function recogerBalon(estado, j, { azar, alFallar }) {
  // Asegurar el balón: recogida a 2+ (no es un chequeo de AG), sin repeticiones de
  // Manos seguras; la activación termina al recogerlo.
  if (estado.activacion.accion === 'secure') {
    const c = chequeo({ objetivo: 2, azar, motivo: `asegurar el balón (${j.id})` });
    anotar(estado, 'asegurar', { jugador: j.id, chequeo: c });
    if (c.exito) {
      estado.balon = { portador: j.id };
      terminarActivacion(estado);
      return { exito: true, balon: true };
    }
    estado.balon = { x: j.x, y: j.y };
    rebotar(estado, j.x, j.y, { azar });
    estado.turnover = { causa: 'asegurar_fallido' };
    terminarActivacion(estado);
    return { exito: false, turnover: true };
  }
  const mods = [];
  for (const m of marcadoresDe(estado, j.equipo, j.x, j.y)) {
    mods.push({ v: -1, porque: `${m.id} marca al jugador` });
  }
  if (estado.clima === 'pouring_rain') mods.push({ v: -1, porque: 'Lluvia torrencial' });

  let c = chequeo({ objetivo: j.perfil.ag, mods, azar, motivo: `recoger el balón (${j.id})` });
  anotar(estado, 'recoger', { jugador: j.id, chequeo: c });
  // Nunca se repite una repetición: Manos seguras (gratis) agota el chequeo.
  if (!c.exito && tiene(j.hab, 'sure_hands')) {
    c = chequeo({ objetivo: j.perfil.ag, mods, azar, motivo: `recoger (${j.id}, repite por Manos seguras)` });
    anotar(estado, 'recoger_reroll', { jugador: j.id, habilidad: 'sure_hands', chequeo: c });
  } else if (!c.exito && alFallar('recoger', c, j.id) && usarRerollEquipo(estado, j, { azar }).repite) {
    c = chequeo({ objetivo: j.perfil.ag, mods, azar, motivo: `recoger (${j.id}, reroll de equipo)` });
    anotar(estado, 'recoger_reroll', { jugador: j.id, habilidad: null, chequeo: c });
  }

  if (c.exito) {
    estado.balon = { portador: j.id };
    anotar(estado, 'balon_recogido', { jugador: j.id });
    return { exito: true, balon: true };
  }
  // Falla: el balón rebota y hay cambio de turno.
  estado.balon = { x: j.x, y: j.y };
  rebotar(estado, j.x, j.y, { azar });
  estado.turnover = { causa: 'recogida_fallida' };
  terminarActivacion(estado);
  return { exito: false, turnover: true };
}

/** La caída de un jugador del equipo activo durante su activación. */
function caerse(estado, j, { azar, causa, modsArmadura = [] }) {
  const resultado = resolverSuelo(estado, j, { forma: 'caida', azar, modsArmadura });
  anotar(estado, 'caida', { jugador: j.id, causa, final: resultado.final });
  if (resultado.final === 'de_pie') return { exito: true, evitado: 'steady_footing' }; // Equilibrio firme
  estado.turnover = { causa: `caida_${causa}` };
  terminarActivacion(estado);
  return { exito: false, caida: resultado, turnover: true };
}

/**
 * Saltar por encima de un jugador tumbado o aturdido: cuesta 2 de MV, chequeo de AG con
 * −1 por rival que marque el origen o el destino (lo que sea peor). Con 1 natural cae
 * en el origen; si falla, cae en el destino.
 */
export function saltar(estado, destinoX, destinoY, { azar, alFallar = () => false } = {}) {
  const a = estado.activacion;
  if (!a) throw new Error('No hay activación en curso.');
  const j = jugador(estado, a.jugador);

  const dx = destinoX - j.x, dy = destinoY - j.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) !== 2) throw new Error('El salto cruza exactamente una casilla.');
  const sobre = enCasilla(estado, j.x + Math.sign(dx), j.y + Math.sign(dy));
  if (!sobre || (sobre.postura !== 'tumbado' && sobre.postura !== 'aturdido')) {
    throw new Error('Solo se salta por encima de un jugador tumbado o aturdido.');
  }
  if (!enCampo(destinoX, destinoY) || enCasilla(estado, destinoX, destinoY)) {
    throw new Error('El destino debe ser una casilla libre del campo.');
  }

  // Cuesta 2 MV; si no quedan, Forzar la marcha ANTES del salto (cae en el origen si falla).
  for (let i = 0; i < 2; i++) {
    if (a.mvGastado >= j.perfil.mv) {
      if (a.rushUsados >= MAX_RUSH) throw new Error('Sin movimiento para saltar.');
      a.rushUsados++;
      const mods = estado.clima === 'blizzard' ? [{ v: -1, porque: 'Ventisca' }] : [];
      const c = chequeo({ objetivo: 2, mods, azar, motivo: `Forzar la marcha antes del salto (${j.id})` });
      anotar(estado, 'rush', { jugador: j.id, chequeo: c });
      if (!c.exito) return caerse(estado, j, { azar, causa: 'rush' }); // en la casilla en la que está
    } else {
      a.mvGastado++;
    }
  }

  // Escurridizo ignora marcadores «al esquivar», no al saltar: aquí cuentan todos.
  const porOrigen = marcadoresDe(estado, j.equipo, j.x, j.y);
  const porDestino = marcadoresDe(estado, j.equipo, destinoX, destinoY);
  const peor = porOrigen.length >= porDestino.length ? porOrigen : porDestino;
  const mods = peor.map((m) => ({ v: -1, porque: `${m.id} marca ${peor === porOrigen ? 'el origen' : 'el destino'}` }));
  const conCola = marcadoresDe(estado, j.equipo, j.x, j.y).find((m) => tiene(m.hab, 'prehensile_tail'));
  if (conCola) mods.push({ v: -1, porque: `Cola prensil de ${conCola.id}` });

  let c = chequeo({ objetivo: j.perfil.ag, mods, azar, motivo: `saltar (${j.id})` });
  anotar(estado, 'saltar', { jugador: j.id, a: [destinoX, destinoY], chequeo: c });
  if (!c.exito && alFallar('saltar', c, j.id) && usarRerollEquipo(estado, j, { azar }).repite) {
    c = chequeo({ objetivo: j.perfil.ag, mods, azar, motivo: `saltar (${j.id}, reroll de equipo)` });
    anotar(estado, 'saltar_reroll', { jugador: j.id, chequeo: c });
  }

  if (c.exito) {
    j.x = destinoX; j.y = destinoY;
    return { exito: true };
  }
  // Con 1 natural cae en el origen; si no, en el destino. La activación termina.
  if (!c.natural1) { j.x = destinoX; j.y = destinoY; }
  return caerse(estado, j, { azar, causa: 'saltar' });
}
