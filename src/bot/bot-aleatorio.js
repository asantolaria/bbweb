// Un bot aleatorio pero legal: juega partidas completas usando solo el motor.
// Nació como arnés de pruebas y es el embrión de la IA de la fase 2.

import { azarConSemilla } from '../engine/dice.js';
import { crearEquipo } from '../engine/equipo.js';
import { ROSTERS_1000K } from '../data/rosters-iniciales.js';
import { FORMACIONES, asignarFormacion } from '../data/formaciones.js';
import { EQUIPOS } from '../data/equipos.js';
import { crearPartido, jugador, enCasilla, tieneZonaDefensa } from '../engine/partido.js';
import { enCampo, filaLos, filaAnotacion, sonAdyacentes } from '../engine/tablero.js';
import { activar, paso, terminarAccion } from '../engine/movimiento.js';
import { placar } from '../engine/placaje.js';
import {
  prePartido, elegirSaque, desplegar, confirmarDespliegue, patada,
  terminarEvento, recepcionLibre, terminarTurno, comprobarTouchdown,
} from '../engine/secuencia.js';

export function desplegarFormacion(e, equipo, azar) {
  const claves = Object.keys(FORMACIONES);
  const F = FORMACIONES[claves[azar(claves.length) - 1]];
  const mios = Object.values(e.jugadores).filter((j) => j.equipo === equipo && (j.situacion === 'campo' || j.situacion === 'reserva'));
  for (const j of mios) desplegar(e, j.id, null);
  const costes = Object.fromEntries(Object.entries(EQUIPOS[e.equipos[equipo].id].pos).map(([k, p]) => [k, p.coste]));
  const los = filaLos(equipo);
  for (const { id, x, df } of asignarFormacion(F, mios.slice(0, 11), costes)) {
    desplegar(e, id, x, equipo === 0 ? los + df : los - df);
  }
}

/** Un turno del bot: mover hacia la zona rival, placar de vez en cuando. */
export function turnoBot(e, azar) {
  const equipo = e.activo;
  const meta = filaAnotacion(equipo);
  const mios = Object.values(e.jugadores)
    .filter((j) => j.equipo === equipo && j.situacion === 'campo' && j.postura !== 'aturdido');

  for (const j of mios) {
    if (e.turnover || e.fase !== 'turno') break;
    // La lista se congela al empezar el turno, pero el campo cambia debajo: una Rata
    // Ogro hambrienta o un empujón en cadena pueden sacar a un compañero del campo
    // antes de que le toque activarse.
    if (j.activado || j.situacion !== 'campo' || j.postura === 'aturdido') continue;

    // ¿Hay un rival de pie al lado? La mitad de las veces, Placaje.
    const rival = Object.values(e.jugadores).find((r) =>
      r.equipo !== equipo && tieneZonaDefensa(r) && sonAdyacentes(r.x, r.y, j.x, j.y));
    if (rival && j.postura === 'de_pie' && azar(2) === 1) {
      activar(e, j.id, 'block', { azar });
      if (e.activacion) {
        placar(e, j.id, rival.id, { azar });
        if (e.activacion) terminarAccion(e, { azar });
      }
      comprobarTouchdown(e);
      continue;
    }

    activar(e, j.id, 'move', { azar });
    if (!e.activacion) { comprobarTouchdown(e); continue; }

    // Camina hacia la meta mientras pueda y las casillas estén libres.
    let presupuesto = j.perfil.mv + (j.postura === 'tumbado' ? 0 : 0);
    for (let k = 0; k < presupuesto && e.activacion && !e.turnover; k++) {
      const actual = jugador(e, j.id);
      if (actual.postura !== 'de_pie') break;
      const dy = Math.sign(meta - actual.y) || 1;
      const candidatas = [
        [actual.x, actual.y + dy], [actual.x + 1, actual.y + dy], [actual.x - 1, actual.y + dy],
        [actual.x + 1, actual.y], [actual.x - 1, actual.y],
      ].filter(([x, y]) => enCampo(x, y) && !enCasilla(e, x, y));
      if (!candidatas.length) break;
      const [x, y] = candidatas[azar(candidatas.length) - 1];
      const a = e.activacion;
      if (a.mvGastado >= actual.perfil.mv) break; // sin forzar la marcha: el bot es prudente
      paso(e, x, y, { azar });
    }
    if (e.activacion) terminarAccion(e, { azar });
    comprobarTouchdown(e);
  }
  if (e.fase === 'turno') terminarTurno(e, { azar });
}

export function jugarPartido(razaA, razaB, semilla) {
  const azar = azarConSemilla(semilla);
  const e = crearPartido(
    crearEquipo(razaA, ROSTERS_1000K[razaA], { nombre: 'A' }),
    crearEquipo(razaB, ROSTERS_1000K[razaB], { nombre: 'B' }),
  );
  e.fase = 'pre_partido';
  prePartido(e, { azar });

  for (let pasos = 0; pasos < 3000; pasos++) {
    if (e.fase === 'fin') return e;
    switch (e.fase) {
      case 'eleccion_saque':
        elegirSaque(e, azar(2) === 1 ? 'patear' : 'recibir');
        break;
      case 'despliegue_kicker':
        desplegarFormacion(e, e.kicker, azar);
        confirmarDespliegue(e);
        break;
      case 'despliegue_receiver':
        desplegarFormacion(e, 1 - e.kicker, azar);
        confirmarDespliegue(e);
        break;
      case 'patada':
        patada(e, 4 + azar(7) - 1, e.kicker === 0 ? 3 + azar(8) : 14 + azar(8), { azar });
        break;
      case 'evento_patada':
        if (e.pendiente) terminarEvento(e, { azar });
        break;
      case 'recepcion_libre': {
        const receptor = Object.values(e.jugadores).find((j) =>
          j.equipo === 1 - e.kicker && j.situacion === 'campo' && j.postura === 'de_pie');
        if (receptor) recepcionLibre(e, receptor.id);
        else { e.fase = 'turno'; e.activo = 1 - e.kicker; } // caso límite: nadie de pie
        break;
      }
      case 'turno':
        turnoBot(e, azar);
        break;
      default:
        throw new Error(`El bot no conoce la fase ${e.fase}`);
    }
  }
  throw new Error(`Partido atascado en fase ${e.fase} (A ${e.equipos[0].turno}/8, B ${e.equipos[1].turno}/8, mitad ${e.mitad})`);
}

