// «Nunca se repite una repetición. Un dado no puede repetirse más de una vez aunque
// haya varias fuentes. Si un Reroll permite repetir un dado de un grupo, no se puede
// usar otra fuente para repetir el resto.» — fundamentos-y-principios.md §6.
//
// Este archivo existe porque el catálogo de escenarios destapó que el motor ofrecía
// reroll de equipo DESPUÉS de una repetición de habilidad. Ilegal; ya no.

import test from 'node:test';
import assert from 'node:assert/strict';
import { crearEquipo } from '../src/engine/equipo.js';
import { ROSTERS_1000K } from '../src/data/rosters-iniciales.js';
import { crearPartido, jugador } from '../src/engine/partido.js';
import { activar, paso } from '../src/engine/movimiento.js';
import { placar } from '../src/engine/placaje.js';
import { pase } from '../src/engine/pase.js';
import { dadoGuionizado, dadoFijo } from './ayuda.js';

function montar(a = 'human', b = 'chaos_chosen') {
  return crearPartido(
    crearEquipo(a, ROSTERS_1000K[a], { nombre: 'A' }),
    crearEquipo(b, ROSTERS_1000K[b], { nombre: 'B' }),
  );
}
function colocar(e, id, x, y, postura = 'de_pie') {
  const j = jugador(e, id);
  j.situacion = 'campo'; j.x = x; j.y = y; j.postura = postura;
  return j;
}
/** Un alFallar que detona si alguien pregunta: la pregunta misma es el fallo. */
const nuncaPreguntes = (tipo) => { throw new Error(`ILEGAL: reroll de equipo ofrecido tras repetición (${tipo})`); };

test('tras repetir con Esquivar NO se ofrece el reroll de equipo', () => {
  const e = montar();
  colocar(e, 'hu4', 7, 13);            // catcher con Esquivar
  colocar(e, 'ch5', 7, 12);            // marca el origen
  activar(e, 'hu4', 'move', { azar: dadoFijo(6) });
  // Esquiva 2 (falla) → repite por Esquivar: 2 (falla) → cae SIN preguntar por reroll.
  // Dados: 2, 2, armadura 3,3 (no rompe).
  const r = paso(e, 7, 14, { azar: dadoGuionizado(2, 2, 3, 3), alFallar: nuncaPreguntes });
  assert.equal(r.exito, false);
  assert.equal(e.equipos[0].rerolls, 3, 'ni un reroll gastado');
});

test('sin la habilidad, el reroll de equipo SÍ se ofrece en la esquiva', () => {
  const e = montar();
  colocar(e, 'hu7', 7, 13);            // línea sin Esquivar
  colocar(e, 'ch5', 7, 12);
  activar(e, 'hu7', 'move', { azar: dadoFijo(6) });
  let preguntado = false;
  // Esquiva 2 (falla) → pregunta → sí → reroll 4 (éxito).
  const r = paso(e, 7, 14, { azar: dadoGuionizado(2, 4), alFallar: () => { preguntado = true; return true; } });
  assert.equal(preguntado, true);
  assert.equal(r.exito, true);
  assert.equal(e.equipos[0].rerolls, 2);
});

test('tras repetir con Manos seguras NO se ofrece el reroll de equipo', () => {
  const e = montar('skaven', 'human');
  colocar(e, 'sk2', 7, 13);            // thrower con Manos seguras
  e.balon = { x: 7, y: 12 };
  activar(e, 'sk2', 'move', { azar: dadoFijo(6) });
  // Recogida 2 (falla) → Manos seguras: 2 (falla) → rebote (D8 2) y turnover, sin pregunta.
  const r = paso(e, 7, 12, { azar: dadoGuionizado(2, 2, 2), alFallar: nuncaPreguntes });
  assert.equal(r.turnover, true);
  assert.equal(e.equipos[0].rerolls, 3);
});

test('tras repetir con Pasar NO se ofrece el reroll de equipo', () => {
  const e = montar('skaven', 'human');
  colocar(e, 'sk2', 7, 13);
  colocar(e, 'sk5', 7, 10);
  e.balon = { portador: 'sk2' };
  activar(e, 'sk2', 'pass', { azar: dadoFijo(6) });
  // PS 2+: 1 natural (pifia-candidato… la pifia repite por Pasar) → 1 otra vez → pifia
  // definitiva con rebote (D8 2), sin pregunta de reroll de equipo.
  const r = pase(e, 7, 10, { azar: dadoGuionizado(1, 1, 2), opciones: { alFallar: nuncaPreguntes } });
  assert.equal(r.resultado, 'pifia');
  assert.equal(e.equipos[0].rerolls, 3);
});

test('si Luchador repite un dado del grupo, el reroll de equipo queda vetado', () => {
  const e = montar('black_orc', 'human');
  colocar(e, 'bl6', 7, 13);            // Orco Negro: Luchador (FU 4 vs 3 → 2 dados)
  colocar(e, 'hu7', 7, 12);
  // Dados 2,1 → Luchador repite el both_down: sale 1 → grupo [1,1] (player down ×2).
  // Ninguna pregunta de reroll de equipo pese al grupo horrible. El atacante cae:
  // armadura 3,3 (no rompe).
  const r = placar(e, 'bl6', 'hu7', {
    azar: dadoGuionizado(2, 1, 1, 3, 3),
    opciones: { alFallar: nuncaPreguntes },
  });
  assert.equal(r.resultado, 'player_down');
  assert.equal(e.equipos[0].rerolls, 2 + 0, 'intactos');
});

test('sin Luchador en juego, el reroll de equipo del placaje sigue disponible', () => {
  const e = montar();
  colocar(e, 'hu7', 7, 13);
  colocar(e, 'ch5', 7, 12);
  let preguntado = false;
  // 1 dado: 1 (player down) → pregunta → sí → nuevo dado 3 (push).
  placar(e, 'hu7', 'ch5', {
    azar: dadoGuionizado(1, 3),
    opciones: { alFallar: () => { preguntado = true; return true; }, impulso: () => false },
  });
  assert.equal(preguntado, true);
  assert.equal(e.equipos[0].rerolls, 2);
});
