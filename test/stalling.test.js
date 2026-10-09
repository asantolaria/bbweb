// Stalling («el público actúa»): un portador que podía anotar sin tirar ni un dado y
// termina su activación sin hacerlo recibe una piedra: 1D6 ≥ número de turno →
// derribado y cambio de turno. E1-S01, con los criterios del oráculo FFB.

import test from 'node:test';
import assert from 'node:assert/strict';
import { crearEquipo } from '../src/engine/equipo.js';
import { ROSTERS_1000K } from '../src/data/rosters-iniciales.js';
import { crearPartido, jugador } from '../src/engine/partido.js';
import { activar, paso, terminarAccion, puedeAnotarSinDados } from '../src/engine/movimiento.js';
import { dadoGuionizado, dadoFijo } from './ayuda.js';

function montar(turno = 2) {
  const e = crearPartido(
    crearEquipo('human', ROSTERS_1000K.human, { nombre: 'A' }),
    crearEquipo('chaos_chosen', ROSTERS_1000K.chaos_chosen, { nombre: 'B' }),
  );
  e.fase = 'turno'; e.activo = 0;
  e.equipos[0].turno = turno;
  return e;
}
function colocar(e, id, x, y, postura = 'de_pie') {
  const j = jugador(e, id);
  j.situacion = 'campo'; j.x = x; j.y = y; j.postura = postura;
  return j;
}

test('el detector: camino libre dentro del MV, sin marcar y sin dados', () => {
  const e = montar();
  const c = colocar(e, 'hu4', 7, 5);   // catcher MV 8, anota en y=0, a 5 pasos limpios
  e.balon = { portador: 'hu4' };
  assert.equal(puedeAnotarSinDados(e, c), true);

  // Un muro de zonas de placaje en medio lo desactiva.
  colocar(e, 'ch5', 6, 3); colocar(e, 'ch6', 8, 3); colocar(e, 'ch7', 7, 2);
  colocar(e, 'ch8', 4, 3); colocar(e, 'ch9', 10, 3); colocar(e, 'ch10', 2, 3);
  colocar(e, 'ch11', 12, 3); colocar(e, 'ch2', 0, 3); colocar(e, 'ch3', 14, 3);
  assert.equal(puedeAnotarSinDados(e, c), false, 'cruzar el muro exigiría esquivar');
});

test('el detector dice no: marcado, sin balón, lejos, o con rasgo que tira al activarse', () => {
  const e = montar();
  const c = colocar(e, 'hu4', 7, 5);
  e.balon = { portador: 'hu4' };
  colocar(e, 'ch5', 7, 6);             // lo marca
  assert.equal(puedeAnotarSinDados(e, c), false, 'marcado: salir ya es esquivar');

  const e2 = montar();
  const lejos = colocar(e2, 'hu7', 7, 12); // línea MV 6, a 12 de la zona
  e2.balon = { portador: 'hu7' };
  assert.equal(puedeAnotarSinDados(e2, lejos), false, 'no llega sin forzar la marcha');

  const e3 = montar();
  const ogro = colocar(e3, 'hu1', 7, 4);  // Ogro: Estúpido tira al activarse
  e3.balon = { portador: 'hu1' };
  assert.equal(puedeAnotarSinDados(e3, ogro), false, 'Estúpido siempre necesita un dado');
});

test('la piedra acierta: d6 ≥ turno → derribado y cambio de turno', () => {
  const e = montar(2);
  colocar(e, 'hu4', 7, 5);
  e.balon = { portador: 'hu4' };
  activar(e, 'hu4', 'move', { azar: dadoFijo(6) });
  paso(e, 7, 4, { azar: dadoFijo(6) });      // se pasea en vez de anotar
  // Piedra: 5 ≥ 2 → acierta. Derribado: armadura 5,4=9 ≥ 8 rompe; heridas 2,3 → aturdido.
  // El balón rebota (D8 2) al caer.
  terminarAccion(e, { azar: dadoGuionizado(5, 2, 5, 4, 2, 3) });
  const j = jugador(e, 'hu4');
  assert.equal(j.postura, 'aturdido');
  assert.equal(e.turnover.causa, 'el_publico_actua');
  const ev = e.registro.find((x) => x.tipo === 'stalling');
  assert.deepEqual([ev.turno, ev.d6, ev.acierta], [2, 5, true]);
});

test('la piedra falla: d6 < turno → el tramposo respira', () => {
  const e = montar(5);
  colocar(e, 'hu4', 7, 5);
  e.balon = { portador: 'hu4' };
  activar(e, 'hu4', 'move', { azar: dadoFijo(6) });
  terminarAccion(e, { azar: dadoGuionizado(3) }); // 3 < 5
  assert.equal(jugador(e, 'hu4').postura, 'de_pie');
  assert.equal(e.turnover, null);
});

test('a partir del turno 7 no hay piedra posible (atajo del oráculo FFB)', () => {
  const e = montar(7);
  colocar(e, 'hu4', 7, 5);
  e.balon = { portador: 'hu4' };
  activar(e, 'hu4', 'move', { azar: dadoFijo(6) });
  terminarAccion(e, { azar: () => { throw new Error('no debería tirar nada'); } });
  assert.ok(e.registro.some((x) => x.tipo === 'stalling_sin_piedra'));
  assert.equal(e.turnover, null);
});

test('anotar o deshacerse del balón exime de la piedra', () => {
  // Anota: entra en la zona → touchdown de los buenos, sin piedra.
  const e = montar(1);
  const c = colocar(e, 'hu4', 7, 1);
  e.balon = { portador: 'hu4' };
  activar(e, 'hu4', 'move', { azar: dadoFijo(6) });
  paso(e, 7, 0, { azar: dadoFijo(6) });
  terminarAccion(e, { azar: () => { throw new Error('anotó: sin piedra'); } });
  assert.equal(jugador(e, 'hu4').y, 0);

  // El vigilado que ya no lleva el balón (lo dejó con Dejada) tampoco la sufre.
  const e2 = montar(1);
  const elfo = crearPartido(
    crearEquipo('elven_union', ROSTERS_1000K.elven_union, { nombre: 'E' }),
    crearEquipo('human', ROSTERS_1000K.human, { nombre: 'H' }),
  );
  elfo.fase = 'turno'; elfo.activo = 0; elfo.equipos[0].turno = 1;
  const linea = jugador(elfo, 'el4');
  linea.situacion = 'campo'; linea.x = 7; linea.y = 3; linea.postura = 'de_pie';
  elfo.balon = { portador: 'el4' };
  activar(elfo, 'el4', 'move', { azar: dadoFijo(6) });
  paso(elfo, 7, 2, { azar: dadoFijo(6), dejarBalon: true }); // Dejada: balón atrás
  terminarAccion(elfo, { azar: () => { throw new Error('sin balón: sin piedra'); } });
  assert.equal(elfo.turnover, null);
});
