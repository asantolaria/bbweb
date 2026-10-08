import test from 'node:test';
import assert from 'node:assert/strict';
import { crearEquipo } from '../src/engine/equipo.js';
import { ROSTERS_1000K } from '../src/data/rosters-iniciales.js';
import { crearPartido, jugador } from '../src/engine/partido.js';
import {
  prePartido, elegirSaque, desplegar, validarDespliegue, confirmarDespliegue,
  patada, moverEnEvento, terminarEvento, recepcionLibre,
  empezarTurno, terminarTurno, comprobarTouchdown, finDeDrive,
} from '../src/engine/secuencia.js';
import { dadoGuionizado, dadoFijo } from './ayuda.js';

function montar() {
  const e = crearPartido(
    crearEquipo('human', ROSTERS_1000K.human, { nombre: 'Humanos' }),
    crearEquipo('chaos_chosen', ROSTERS_1000K.chaos_chosen, { nombre: 'Caos' }),
  );
  e.fase = 'pre_partido';
  return e;
}

/** Despliegue legal de 11: 3 en el centro de la LOS y el resto por el campo central. */
function desplegarLegal(e, equipo) {
  const ids = Object.values(e.jugadores).filter((j) => j.equipo === equipo).map((j) => j.id);
  const los = equipo === 0 ? 13 : 12;
  const atras = equipo === 0 ? 20 : 5;
  const sitios = [
    [5, los], [6, los], [7, los],
    [4, atras], [5, atras], [6, atras], [7, atras], [8, atras], [9, atras], [10, atras],
    [7, atras + (equipo === 0 ? 2 : -2)],
  ];
  sitios.forEach(([x, y], i) => desplegar(e, ids[i], x, y));
}

/** Previa guiada hasta la fase de patada: humanos (ganan el sorteo) eligen patear. */
function hastaPatada(e) {
  // D3 hinchas ×2 (dados 4,4 → 2 cada uno), clima 3+4=7 (perfecto), sorteo 5 vs 2.
  prePartido(e, { azar: dadoGuionizado(4, 4, 3, 4, 5, 2) });
  elegirSaque(e, 'patear');
  desplegarLegal(e, 0);
  confirmarDespliegue(e);
  desplegarLegal(e, 1);
  confirmarDespliegue(e);
}

test('la previa tira hinchas, clima y sorteo, y el ganador elige patear', () => {
  const e = montar();
  hastaPatada(e);
  assert.equal(e.equipos[0].factorHinchas, 3 + 2, '3 hinchas (1 de serie + 2) + D3 2');
  assert.equal(e.clima, 'perfect_conditions');
  assert.equal(e.ganadorSorteo, 0);
  assert.equal(e.kicker, 0);
  assert.equal(e.recibioAlEmpezar, 1);
  assert.equal(e.fase, 'patada');
});

test('el despliegue exige 3 en el centro de la línea y máximo 2 por zona ancha', () => {
  const e = montar();
  prePartido(e, { azar: dadoGuionizado(4, 4, 3, 4, 5, 2) });
  elegirSaque(e, 'patear');
  const ids = Object.values(e.jugadores).filter((j) => j.equipo === 0).map((j) => j.id);
  // Solo 2 en la LOS central.
  desplegar(e, ids[0], 5, 13); desplegar(e, ids[1], 6, 13);
  for (let i = 2; i < 11; i++) desplegar(e, ids[i], 4 + (i - 2), 20);
  assert.ok(validarDespliegue(e, 0).some((p) => /pegados a la línea/.test(p)));
  // Tres en la zona ancha izquierda.
  desplegar(e, ids[2], 7, 13);                 // arregla la LOS
  desplegar(e, ids[3], 0, 20); desplegar(e, ids[4], 1, 20); desplegar(e, ids[5], 2, 20);
  assert.ok(validarDespliegue(e, 0).some((p) => /zona ancha/.test(p)));
  // No se puede desplegar en la mitad rival.
  assert.throws(() => desplegar(e, ids[6], 7, 10), /su propia mitad/);
});

test('la patada se desvía D6 casillas en la dirección del D8 y el balón cae y rebota', () => {
  const e = montar();
  hastaPatada(e);
  // Patada a (2,8): desvío 1 casilla dirección 2 (↑) → (2,7). Evento 1,1 (Árbitro).
  // Caída en (2,7), vacía → rebote D8 2 (↑) → (2,6), vacía.
  const r = patada(e, 2, 8, { azar: dadoGuionizado(1, 2, 1, 1, 2) });
  assert.equal(r.evento, 'get_the_ref');
  assert.equal(e.equipos[0].sobornos, 1);
  assert.equal(e.equipos[1].sobornos, 1);
  assert.deepEqual([e.balon.x, e.balon.y], [2, 6]);
  assert.equal(e.fase, 'turno');
  assert.equal(e.activo, 1, 'empieza el receptor');
  assert.equal(e.equipos[1].turno, 1);
});

test('si el balón cruza a la mitad del pateador hay Recepción libre', () => {
  const e = montar();
  hastaPatada(e);
  // Patada a (7,12): desvío 6 casillas dirección 7 (↓) → (7,18): mitad del pateador.
  patada(e, 7, 12, { azar: dadoGuionizado(6, 7, 1, 1) });
  assert.equal(e.fase, 'recepcion_libre');
  const receptor = Object.values(e.jugadores).find((j) => j.equipo === 1 && j.situacion === 'campo');
  recepcionLibre(e, receptor.id);
  assert.equal(e.balon.portador, receptor.id);
  assert.equal(e.fase, 'turno');
});

test('Entrenador brillante da un reroll que se esfuma al final de la entrada', () => {
  const e = montar();
  hastaPatada(e);
  // Humanos: 0 ayudantes; Caos: 0. Evento 3,4=7. Tiradas: 5 (humanos) vs 2 (caos) →
  // reroll extra para los humanos. Luego cae el balón en (2,7) y rebota a (2,6).
  patada(e, 2, 8, { azar: dadoGuionizado(1, 2, 3, 4, 5, 2, 2) });
  assert.equal(e.equipos[0].rerolls, 4, '3 + 1 extra');
  assert.equal(e.equipos[1].rerolls, 3);
  finDeDrive(e, { azar: dadoFijo(5) });
  assert.equal(e.equipos[0].rerolls, 3, 'el extra no sobrevive a la entrada');
});

test('Indigestión castiga al que pierde: −1 MV y −1 AR hasta el final de la entrada', () => {
  const e = montar();
  hastaPatada(e);
  // Evento 5,6=11 (Indigestión). Tiradas 6 (humanos) vs 1 (caos): pierde el Caos.
  // Jugador al azar: D16=1 → dorsal 1 (el Troll, MV 4 AR 10). Aguanta: 2+ → −1/−1.
  // Después cae el balón: (2,7) vacía → rebote 2 → (2,6).
  const troll = jugador(e, 'ch1');
  const mv = troll.perfil.mv, ar = troll.perfil.ar;
  patada(e, 2, 8, { azar: dadoGuionizado(1, 2, 5, 6, 6, 1, 1, 2, 2) });
  assert.equal(troll.perfil.mv, mv - 1);
  assert.equal(troll.perfil.ar, ar - 1);
  finDeDrive(e, { azar: dadoFijo(5) });
  assert.equal(troll.perfil.mv, mv, 'recupera el MV al acabar la entrada');
  assert.equal(troll.perfil.ar, ar);
});

test('Anticipación: el receptor mueve hasta D3+3 desmarcados una casilla', () => {
  const e = montar();
  hastaPatada(e);
  // Evento 4,5=9 (Anticipación): D3 (dado 2 → 1) +3 = 4 movimientos.
  patada(e, 2, 8, { azar: dadoGuionizado(1, 2, 4, 5, 2) });
  assert.equal(e.pendiente.tipo, 'quick_snap');
  assert.equal(e.pendiente.restantes, 4);
  const j = Object.values(e.jugadores).find((x) => x.equipo === 1 && x.situacion === 'campo' && x.y === 5);
  moverEnEvento(e, j.id, j.x, j.y + 1);
  assert.equal(e.pendiente.restantes, 3);
  assert.throws(() => moverEnEvento(e, j.id, j.x, j.y + 3), /una casilla/);
  // Al terminar el evento cae el balón en (2,7), vacía, y rebota.
  terminarEvento(e, { azar: dadoGuionizado(2) });
  assert.equal(e.fase, 'turno');
});

test('los aturdidos al empezar su turno pasan a tumbados al terminarlo', () => {
  const e = montar();
  hastaPatada(e);
  patada(e, 2, 8, { azar: dadoGuionizado(1, 2, 1, 1, 2) });
  // Turno del Caos (equipo 1). Un jugador suyo aturdido desde antes…
  const victima = Object.values(e.jugadores).find((j) => j.equipo === 1 && j.situacion === 'campo');
  victima.postura = 'aturdido';
  victima.aturdidoAlEmpezarTurno = true;       // empezó así el turno
  const tarde = Object.values(e.jugadores).filter((j) => j.equipo === 1 && j.situacion === 'campo')[1];
  tarde.postura = 'aturdido';
  tarde.aturdidoAlEmpezarTurno = false;        // cayó aturdido DURANTE este turno
  terminarTurno(e, { azar: dadoFijo(5) });
  assert.equal(victima.postura, 'tumbado', 'el que empezó aturdido se recupera');
  assert.equal(tarde.postura, 'aturdido', 'el que cayó durante el turno espera al siguiente');
  assert.equal(e.activo, 0, 'turno del rival');
  assert.equal(e.equipos[0].turno, 1);
});

test('touchdown: anota, termina la entrada y patea el que anotó', () => {
  const e = montar();
  hastaPatada(e);
  patada(e, 2, 8, { azar: dadoGuionizado(1, 2, 1, 1, 2) });
  // El Caos (equipo 1, anota en y=25) lleva el balón a la zona humana.
  const corredor = Object.values(e.jugadores).find((j) => j.equipo === 1 && j.situacion === 'campo');
  corredor.x = 7; corredor.y = 25;
  e.balon = { portador: corredor.id };
  assert.equal(comprobarTouchdown(e), true);
  assert.equal(e.equipos[1].marcador, 1);
  assert.equal(e.turnover.causa, 'touchdown');
  terminarTurno(e, { azar: dadoFijo(5) });     // sin KO que recuperar
  assert.equal(e.fase, 'despliegue_kicker');
  assert.equal(e.kicker, 1, 'patea el que anotó');
  assert.equal(corredor.situacion, 'reserva', 'el campo se vacía para el siguiente drive');
  assert.equal(e.balon, null);
});

test('al descanso: pasa a la 2ª parte, rerolls recuperados y patea quien recibió al inicio', () => {
  const e = montar();
  hastaPatada(e);
  patada(e, 2, 8, { azar: dadoGuionizado(1, 2, 1, 1, 2) });
  e.equipos[0].rerolls = 0;
  e.equipos[0].turno = 8; e.equipos[1].turno = 8;
  terminarTurno(e, { azar: dadoFijo(5) });
  assert.equal(e.mitad, 2);
  assert.equal(e.fase, 'despliegue_kicker');
  assert.equal(e.equipos[0].rerolls, 3, 'rerolls recuperados');
  assert.equal(e.equipos[0].turno, 0);
  assert.equal(e.kicker, 1, 'en la 2ª parte patea quien recibió al empezar el partido');
});

test('final de entrada: los KO se recuperan con 4+', () => {
  const e = montar();
  hastaPatada(e);
  patada(e, 2, 8, { azar: dadoGuionizado(1, 2, 1, 1, 2) });
  const [a, b] = Object.values(e.jugadores).filter((j) => j.equipo === 0 && j.situacion === 'campo');
  a.situacion = 'ko'; b.situacion = 'ko';
  finDeDrive(e, { azar: dadoGuionizado(4, 3) });
  assert.equal(a.situacion, 'reserva', 'con 4 vuelve');
  assert.equal(b.situacion, 'ko', 'con 3 se queda en el banquillo');
});

test('un touchdown en el turno rival hace saltar la celebración del anotador', () => {
  const e = montar();
  hastaPatada(e);
  patada(e, 2, 8, { azar: dadoGuionizado(1, 2, 1, 1, 2) });
  // Turno del Caos (activo = 1): un HUMANO (equipo 0, anota en y=0) resulta empujado a
  // la zona de anotación con el balón.
  const heroe = Object.values(e.jugadores).find((j) => j.equipo === 0 && j.situacion === 'campo');
  heroe.x = 7; heroe.y = 0;
  e.balon = { portador: heroe.id };
  assert.equal(comprobarTouchdown(e), true);
  assert.equal(e.equipos[0].saltaTurno, true, 'se saltará su siguiente turno');
  assert.equal(e.equipos[0].marcador, 1);
});
