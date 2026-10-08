import test from 'node:test';
import assert from 'node:assert/strict';
import { crearEquipo } from '../src/engine/equipo.js';
import { ROSTERS_1000K } from '../src/data/rosters-iniciales.js';
import { crearPartido, jugador } from '../src/engine/partido.js';
import { resolverSuelo } from '../src/engine/derribo.js';
import { puedeCurar, curarKO, curarLesion, rechazarCura } from '../src/engine/apotecario.js';
import { dadoGuionizado, dadoFijo } from './ayuda.js';

function montar() {
  return crearPartido(
    crearEquipo('human', ROSTERS_1000K.human, { nombre: 'A' }),
    crearEquipo('shambling_undead', ROSTERS_1000K.shambling_undead, { nombre: 'U' }),
  );
}
function colocar(e, id, x, y) {
  const j = jugador(e, id);
  j.situacion = 'campo'; j.x = x; j.y = y; j.postura = 'de_pie';
  return j;
}
const suma = (n) => { const a = Math.min(6, n - 1); return [a, n - a]; };

test('el apotecario deja un KO aturdido en su casilla, una sola vez por partido', () => {
  const e = montar();
  const j = colocar(e, 'hu7', 7, 13);
  // Derribo con KO: armadura 9 (5,4) rompe AR 9; heridas 9 (5,4) → KO.
  resolverSuelo(e, j, { forma: 'derribado', azar: dadoGuionizado(5, 4, 5, 4) });
  assert.equal(j.situacion, 'ko');
  assert.equal(puedeCurar(e, 'hu7'), true);
  curarKO(e, 'hu7');
  assert.equal(j.situacion, 'campo');
  assert.equal(j.postura, 'aturdido');
  assert.deepEqual([j.x, j.y], [7, 13], 'en la casilla donde cayó');
  assert.equal(e.equipos[0].apotecarioUsado, true);

  // Segundo herido: el apotecario ya está gastado.
  const k = colocar(e, 'hu8', 8, 13);
  resolverSuelo(e, k, { forma: 'derribado', azar: dadoGuionizado(5, 4, 5, 4) });
  assert.equal(puedeCurar(e, 'hu8'), false);
});

test('un KO por el público curado vuelve a Reservas, no al campo', () => {
  const e = montar();
  const j = colocar(e, 'hu7', 0, 10);
  // Público: heridas directas 8 (4,4) → KO.
  resolverSuelo(e, j, { forma: 'derribado', porElPublico: true, azar: dadoGuionizado(4, 4) });
  assert.equal(j.situacion, 'ko');
  curarKO(e, 'hu7');
  assert.equal(j.situacion, 'reserva');
});

test('la lesión curada tira otra vez y el dueño elige; Magullado vuelve a Reservas', () => {
  const e = montar();
  const j = colocar(e, 'hu7', 7, 13);
  // Lesión: armadura 10 (5,5) rompe; heridas 11 (6,5) → lesión; D16 = 15 → muerto.
  resolverSuelo(e, j, { forma: 'derribado', azar: dadoGuionizado(5, 5, 6, 5, 15) });
  assert.equal(j.situacion, 'lesionado');
  assert.equal(j.lesion, 'dead');
  // El apotecario tira otra vez: D16 = 3 → Magullado; el dueño elige la nueva.
  const r = curarLesion(e, 'hu7', { azar: dadoGuionizado(3), elegir: (ops) => ops.indexOf('badly_hurt') });
  assert.equal(r.elegida, 'badly_hurt');
  assert.equal(j.situacion, 'reserva', 'Magullado: listo para el siguiente drive');
});

test('si la segunda tirada es peor, se queda la original (eligiendo)', () => {
  const e = montar();
  const j = colocar(e, 'hu7', 7, 13);
  // Lesión original: D16 = 9 → seriously_hurt. Segunda: 16 → dead. Se elige la original.
  resolverSuelo(e, j, { forma: 'derribado', azar: dadoGuionizado(5, 5, 6, 5, 9) });
  const r = curarLesion(e, 'hu7', { azar: dadoGuionizado(16), elegir: () => 0 });
  assert.equal(r.elegida, 'seriously_hurt');
  assert.equal(j.situacion, 'lesionado', 'sigue fuera del partido');
});

test('los No-Muertos no tienen apotecario y la ventana se puede rechazar', () => {
  const e = montar();
  const z = colocar(e, 'sh7', 7, 12);
  // El zombi cae KO: armadura 10 (5,5) ≥ 9; heridas 9 (5,4) → KO.
  resolverSuelo(e, z, { forma: 'derribado', azar: dadoGuionizado(5, 5, 5, 4) });
  assert.equal(puedeCurar(e, 'sh7'), false, 'Señores de los No Muertos: sin apotecario');

  const h = colocar(e, 'hu7', 7, 13);
  resolverSuelo(e, h, { forma: 'derribado', azar: dadoGuionizado(5, 4, 5, 4) });
  assert.equal(puedeCurar(e, 'hu7'), true);
  rechazarCura(e, 'hu7');
  assert.equal(puedeCurar(e, 'hu7'), false, 'la ventana se cerró al decir que no');
});
