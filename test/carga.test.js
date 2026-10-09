// ¡A la carga! (evento de patada 10): el pateador activa hasta D3+3 desmarcados antes
// del primer turno — Movimiento, UNA Penetración, UN Lanzar compañero; una caída corta
// la Carga; todo es gratis (los activados vuelven frescos al primer turno). E1-S02.

import test from 'node:test';
import assert from 'node:assert/strict';
import { crearEquipo } from '../src/engine/equipo.js';
import { ROSTERS_1000K } from '../src/data/rosters-iniciales.js';
import { crearPartido, jugador } from '../src/engine/partido.js';
import { activar, paso, terminarAccion } from '../src/engine/movimiento.js';
import {
  prePartido, elegirSaque, desplegar, confirmarDespliegue, patada, terminarEvento,
} from '../src/engine/secuencia.js';
import { FORMACIONES, asignarFormacion } from '../src/data/formaciones.js';
import { EQUIPOS } from '../src/data/equipos.js';
import { filaLos } from '../src/engine/tablero.js';
import { dadoGuionizado, dadoFijo } from './ayuda.js';

function hastaLaCarga() {
  const e = crearPartido(
    crearEquipo('human', ROSTERS_1000K.human, { nombre: 'Humanos' }),
    crearEquipo('chaos_chosen', ROSTERS_1000K.chaos_chosen, { nombre: 'Caos' }),
  );
  e.fase = 'pre_partido';
  // Previa: D3 4,4 · clima 3,4 (perfecto) · sorteo 5,2 → ganan Humanos, patean.
  prePartido(e, { azar: dadoGuionizado(4, 4, 3, 4, 5, 2) });
  elegirSaque(e, 'patear');
  for (const equipo of [0, 1]) {
    const mios = Object.values(e.jugadores).filter((j) => j.equipo === equipo);
    const costes = Object.fromEntries(Object.entries(EQUIPOS[e.equipos[equipo].id].pos).map(([k, p]) => [k, p.coste]));
    const los = filaLos(equipo);
    for (const { id, x, df } of asignarFormacion(FORMACIONES.ziggurat, mios.slice(0, 11), costes)) {
      desplegar(e, id, x, equipo === 0 ? los + df : los - df);
    }
    confirmarDespliegue(e);
  }
  // Patada a (2,8): desvío 1 (↑) → (2,7). Evento 4+6=10: ¡A la carga! D3 (5→3)+3 = 6.
  patada(e, 2, 8, { azar: dadoGuionizado(1, 2, 4, 6, 5) });
  return e;
}

test('el evento 10 abre la Carga: pendiente, el pateador manda y acciones restringidas', () => {
  const e = hastaLaCarga();
  assert.equal(e.pendiente.tipo, 'blitz_event');
  assert.equal(e.pendiente.equipo, 0, 'la Carga es del pateador');
  assert.equal(e.pendiente.restantes, 6);
  assert.equal(e.activo, 0);
  assert.ok(e.patadaEnElAire, 'el balón sigue en el aire');

  // Un humano desmarcado avanza una casilla gratis.
  const corredor = Object.values(e.jugadores).filter((j) => j.equipo === 0 && j.situacion === 'campo').sort((a, b) => b.y - a.y)[0];
  const y0 = corredor.y;
  activar(e, corredor.id, 'move', { azar: dadoFijo(6) });
  assert.equal(e.pendiente.restantes, 5);
  paso(e, corredor.x, y0 - 1, { azar: dadoFijo(6) });
  assert.equal(corredor.y, y0 - 1);

  // Las acciones prohibidas en la Carga no pasan (cerrando antes la activación abierta).
  terminarAccion(e, { azar: dadoFijo(6) });
  const otro = Object.values(e.jugadores).find((j) => j.equipo === 0 && j.situacion === 'campo' && !j.activado);
  assert.throws(() => activar(e, otro.id, 'foul', { azar: dadoFijo(6) }), /solo caben Movimiento/);
});

test('terminar la Carga deja frescos a los cargadores y el balón cae', () => {
  const e = hastaLaCarga();
  const corredor = Object.values(e.jugadores).filter((j) => j.equipo === 0 && j.situacion === 'campo').sort((a, b) => b.y - a.y)[0];
  activar(e, corredor.id, 'move', { azar: dadoFijo(6) });
  paso(e, corredor.x, corredor.y - 1, { azar: dadoFijo(6) });
  // Cae el balón: (2,7) vacía → rebote D8 2 → (2,6).
  terminarEvento(e, { azar: dadoGuionizado(2) });
  assert.equal(e.pendiente, null);
  assert.equal(e.fase, 'turno');
  assert.equal(e.activo, 1, 'el primer turno es del receptor');
  assert.equal(corredor.activado, false, 'la Carga fue gratis: vuelve fresco');
  assert.deepEqual([e.balon.x, e.balon.y], [2, 6]);
});

test('una caída corta la Carga, y terminarla no arrastra el turnover al partido', () => {
  const e = hastaLaCarga();
  const corredor = Object.values(e.jugadores).filter((j) => j.equipo === 0 && j.situacion === 'campo').sort((a, b) => b.y - a.y)[0];
  activar(e, corredor.id, 'move', { azar: dadoFijo(6) });
  // Agota su MV para forzar la marcha y caer: catcher/línea MV variable — forzamos:
  e.activacion.mvGastado = jugador(e, corredor.id).perfil.mv;
  // Rush 1 → cae: armadura 3,3 no rompe. La caída marca turnover (fin de la Carga).
  paso(e, corredor.x, corredor.y - 1, { azar: dadoGuionizado(1, 3, 3) });
  assert.ok(e.turnover, 'la caída corta la Carga');
  terminarEvento(e, { azar: dadoGuionizado(2) });
  assert.equal(e.turnover, null, 'el turnover de la Carga no contamina el primer turno');
  assert.equal(e.fase, 'turno');
});

test('en la Carga solo cabe UNA Penetración (y gasta la del evento, no la del turno)', () => {
  const e = hastaLaCarga();
  const humanos = Object.values(e.jugadores).filter((j) => j.equipo === 0 && j.situacion === 'campo');
  const beastman = Object.values(e.jugadores).find((j) => j.equipo === 1 && j.situacion === 'campo');
  // Blitz declarado contra un caótico (da igual la distancia: se declara y cuenta).
  const b1 = humanos.find((j) => !j.activado);
  activar(e, b1.id, 'blitz', { azar: dadoFijo(6), objetivo: beastman.id });
  terminarAccion(e, { azar: dadoFijo(6) });    // cierra su activación sin placar
  const b2 = humanos.find((j) => !j.activado);
  assert.throws(() => activar(e, b2.id, 'blitz', { azar: dadoFijo(6), objetivo: beastman.id }), /ya se declaró/);
  // Pero al terminar la Carga, el primer turno REAL del pateador tendrá su Blitz intacto.
  terminarEvento(e, { azar: dadoGuionizado(2) });
  assert.deepEqual(e.usadas, {}, 'las acciones de 1/turno quedan liberadas');
});
