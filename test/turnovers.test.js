// La suite canónica de cambios de turno: un test por causa, numerado como la lista de
// fundamentos-y-principios.md §6 y el catálogo (escenarios.md §2.7). Si una causa deja
// de dispararse —o se dispara cuando no toca—, revienta aquí con su número delante.

import test from 'node:test';
import assert from 'node:assert/strict';
import { crearEquipo } from '../src/engine/equipo.js';
import { ROSTERS_1000K } from '../src/data/rosters-iniciales.js';
import { crearPartido, jugador } from '../src/engine/partido.js';
import { activar, paso, terminarAccion } from '../src/engine/movimiento.js';
import { placar } from '../src/engine/placaje.js';
import { pase, entrega } from '../src/engine/pase.js';
import { falta } from '../src/engine/falta.js';
import { lanzarCompanero } from '../src/engine/lanzar.js';
import { comprobarTouchdown } from '../src/engine/secuencia.js';
import { dadoGuionizado, dadoFijo } from './ayuda.js';

function montar(a = 'human', b = 'chaos_chosen') {
  const e = crearPartido(
    crearEquipo(a, ROSTERS_1000K[a], { nombre: 'A' }),
    crearEquipo(b, ROSTERS_1000K[b], { nombre: 'B' }),
  );
  e.fase = 'turno';
  return e;
}
function colocar(e, id, x, y, postura = 'de_pie') {
  const j = jugador(e, id);
  j.situacion = 'campo'; j.x = x; j.y = y; j.postura = postura;
  return j;
}

test('causa 1: un jugador activo se cae durante su activación (esquiva fallida)', () => {
  const e = montar();
  colocar(e, 'hu7', 7, 13);
  colocar(e, 'ch5', 7, 12);            // marca el origen
  activar(e, 'hu7', 'move', { azar: dadoFijo(6) });
  // Esquiva 2 (falla, sin habilidad, sin reroll) → cae: armadura 3,3 no rompe.
  paso(e, 7, 14, { azar: dadoGuionizado(2, 3, 3) });
  assert.equal(e.turnover.causa, 'caida_esquivar');
});

test('causa 2: el atacante activo es derribado en su propio placaje', () => {
  const e = montar();
  colocar(e, 'hu7', 7, 13);
  colocar(e, 'ch5', 7, 12);
  // 1 dado: 1 (Atacante derribado). Armadura 3,3 no rompe.
  placar(e, 'hu7', 'ch5', { azar: dadoGuionizado(1, 3, 3) });
  assert.equal(e.turnover.causa, 'atacante_derribado');
});

test('causa 3a: el portador activo queda tumbado (Forcejear en Ambos derribados)', () => {
  const e = montar('high_elf', 'human');
  const wl = colocar(e, 'hi1', 7, 13); // León Blanco: Forcejear, sin Placar
  colocar(e, 'hu7', 7, 12);
  e.balon = { portador: 'hi1' };
  placar(e, 'hi1', 'hu7', { azar: dadoGuionizado(2, 5) }); // both down → Forcejear; rebote D8 5
  assert.equal(wl.postura, 'tumbado');
  assert.equal(e.turnover.causa, 'portador_tumbado');
});

test('causa 3b/extra: un propio del equipo activo acaba en el público por una cadena', () => {
  const e = montar();
  colocar(e, 'hu7', 2, 10);            // ataca hacia la banda izquierda
  colocar(e, 'ch5', 1, 10);            // objetivo rival
  const portador = colocar(e, 'hu8', 0, 10); // compañero PROPIO contra la banda, con balón
  colocar(e, 'ch6', 0, 9); colocar(e, 'ch7', 0, 11); // el resto de candidatas, ocupadas
  e.balon = { portador: 'hu8' };
  // 1 dado: 3 (empujón). Candidatas de ch5: (0,9),(0,10),(0,11) ocupadas → cadena sobre
  // hu8 → sus tres candidatas están fuera → ¡al público! Balón: saque de banda desde
  // (0,10): dirección D6 3 → [1,0], distancia 3+4=7 → (6,10) libre. Heridas 2,2 →
  // aturdido → Reservas. Sin impulso.
  placar(e, 'hu7', 'ch5', {
    azar: dadoGuionizado(3, 3, 3, 4, 2, 2),
    opciones: { elegirEmpuje: (c) => c.findIndex((k) => k.x === 0 && k.y === 10), impulso: () => false },
  });
  assert.equal(portador.situacion, 'reserva', 'aturdido por el público → Reservas');
  assert.equal(e.turnover.causa, 'empujado_al_publico');
  assert.deepEqual([e.balon.x, e.balon.y], [6, 10], 'el balón volvió por saque de banda');
});

test('causa 3c: la Rata Ogro muerde a su propio portador', () => {
  const e = montar('skaven', 'human');
  colocar(e, 'sk1', 7, 13);            // Ferocidad animal + Golpe mortífero
  const portador = colocar(e, 'sk7', 8, 13);
  e.balon = { portador: 'sk7' };
  // Ferocidad 2 (falla sin +2: es move) → derriba al compañero. Balón rebota D8 2.
  // Armadura 4,4+1 (GM obligado) = 9 ≥ 8 rompe; heridas 4,4=8 → KO.
  const r = activar(e, 'sk1', 'move', { azar: dadoGuionizado(2, 2, 4, 4, 4, 4) });
  assert.equal(r.victima, 'sk7');
  assert.equal(portador.situacion, 'ko');
  assert.equal(e.turnover.causa, 'portador_derribado');
});

test('causa 4: fallar al recoger el balón del suelo', () => {
  const e = montar();
  colocar(e, 'hu7', 7, 13);
  e.balon = { x: 7, y: 12 };
  activar(e, 'hu7', 'move', { azar: dadoFijo(6) });
  // Recogida 2 (falla a 3+, sin Manos seguras) → rebote D8 2 → turnover.
  const r = paso(e, 7, 12, { azar: dadoGuionizado(2, 2) });
  assert.equal(r.turnover, true);
  assert.equal(e.turnover.causa, 'recogida_fallida');
});

test('causa 5: pifia de pase (y el rebote desde el lanzador)', () => {
  const e = montar('skaven', 'human');
  colocar(e, 'sk2', 7, 13);
  e.balon = { portador: 'sk2' };
  activar(e, 'sk2', 'pass', { azar: dadoFijo(6) });
  // 1 natural → repite por Pasar (agota el chequeo) → 1 natural → pifia. Rebote D8 2.
  const r = pase(e, 7, 10, { azar: dadoGuionizado(1, 1, 2) });
  assert.equal(r.resultado, 'pifia');
  assert.equal(e.turnover.causa, 'pifia');
});

test('causa 6: el compañero falla la entrega y el balón acaba en el suelo…', () => {
  const e = montar();
  colocar(e, 'hu7', 7, 13);
  const companero = colocar(e, 'hu8', 8, 13);
  e.balon = { portador: 'hu7' };
  activar(e, 'hu7', 'handoff', { azar: dadoFijo(6) });
  // Atrapar 2 (falla a 3+) → rebote D8 5 → (9,13) vacía → suelo → turnover.
  const r = entrega(e, 'hu8', { azar: dadoGuionizado(2, 5) });
  assert.equal(r.resultado, 'turnover');
  assert.equal(e.turnover.causa, 'entrega_al_suelo');
});

test('causa 6, la excepción: el rebote cae en otro compañero que SÍ atrapa → sin turnover', () => {
  const e = montar();
  colocar(e, 'hu7', 7, 13);
  colocar(e, 'hu8', 8, 13);            // receptor torpe
  const salvador = colocar(e, 'hu4', 9, 13); // catcher al lado (Atrapar, AG 3+)
  e.balon = { portador: 'hu7' };
  activar(e, 'hu7', 'handoff', { azar: dadoFijo(6) });
  // hu8 falla (2) → rebote D8 5 → cae en hu4: atrapa con −1 por rebote: 4 → la tiene.
  const r = entrega(e, 'hu4' === 'x' ? 'x' : 'hu8', { azar: dadoGuionizado(2, 5, 4) });
  assert.equal(e.balon.portador, 'hu4');
  assert.equal(e.turnover, null, 'el reglamento lo perdona si acaba en manos propias');
  assert.equal(r.resultado, 'completado');
});

test('causa 7: tras un pase nadie lo atrapa y queda en el suelo', () => {
  const e = montar();
  colocar(e, 'hu4', 7, 13);            // catcher PS 4+
  e.balon = { portador: 'hu4' };
  activar(e, 'hu4', 'pass', { azar: dadoFijo(6) });
  // Pase corto a (5,9): necesita 5, sale 3 → impreciso: dispersión 7,7,7 → (5,12) vacía
  // → rebote 4 → (4,12) vacía → suelo → turnover.
  const r = pase(e, 5, 9, { azar: dadoGuionizado(3, 7, 7, 7, 4) });
  assert.equal(e.turnover.causa, 'pase_al_suelo');
});

test('causa 8: un rival intercepta el pase', () => {
  const e = montar('skaven', 'human');
  colocar(e, 'sk2', 7, 13);
  colocar(e, 'sk5', 7, 7);
  colocar(e, 'hu4', 7, 10);            // en la trayectoria
  e.balon = { portador: 'sk2' };
  activar(e, 'sk2', 'pass', { azar: dadoFijo(6) });
  // Largo: 4+ → 5 preciso. Intercepción AG 3+ −3 → 6 natural → suya.
  const r = pase(e, 7, 7, { azar: dadoGuionizado(5, 6), opciones: { elegirInterceptor: (ids) => ids[0] } });
  assert.equal(r.resultado, 'interceptado');
  assert.equal(e.turnover.causa, 'intercepcion');
});

test('causa 9: el portador lanzado por un compañero se estampa', () => {
  const e = montar();
  colocar(e, 'hu1', 7, 13);            // Ogro
  colocar(e, 'hu6', 8, 13);            // Halfling con el balón
  e.balon = { portador: 'hu6' };
  activar(e, 'hu1', 'ttm', { azar: dadoFijo(6) });
  // PS 5+: 1 → pifia. Rebote desde el Ogro D8 2 → (7,12). Aterrizaje 3+ −1 → 2: cae.
  // Armadura 3,3 < 7 no rompe; balón rebota D8 5.
  const r = lanzarCompanero(e, 'hu6', 7, 10, { azar: dadoGuionizado(1, 2, 2, 5, 3, 3) });
  assert.equal(r.resultado, 'caida');
  assert.equal(e.turnover.causa, 'portador_derribado');
});

test('causa 10: expulsión por falta (dobles naturales)', () => {
  const e = montar();
  colocar(e, 'hu7', 7, 13);
  colocar(e, 'ch5', 7, 12, 'tumbado');
  activar(e, 'hu7', 'foul', { azar: dadoFijo(6) });
  // Armadura 5,5 (dobles, rompe AR 9); heridas 2,3 → aturdido. Sin protesta ni soborno.
  const r = falta(e, 'ch5', { azar: dadoGuionizado(5, 5, 2, 3) });
  assert.equal(r.expulsado, true);
  assert.equal(e.turnover.causa, 'expulsion');
});

test('causa 11: touchdown (el cambio de turno bueno)', () => {
  const e = montar();
  e.activo = 0;
  const heroe = colocar(e, 'hu4', 7, 0); // zona de anotación rival del equipo 0
  e.balon = { portador: 'hu4' };
  assert.equal(comprobarTouchdown(e), true);
  assert.equal(e.turnover.causa, 'touchdown');
  assert.equal(e.equipos[0].marcador, 1);
});

test('control negativo: derribar al portador RIVAL no es cambio de turno', () => {
  const e = montar('shambling_undead', 'human');
  colocar(e, 'sh1', 7, 13);            // Momia FU 5 (2 dados)
  const rival = colocar(e, 'hu4', 7, 12);
  e.balon = { portador: 'hu4' };
  // 2 dados: 6,6 → POW. Empuje (6,11), impulso no. Balón rebota D8 5 tras el derribo…
  // soltar ocurre dentro de resolverSuelo: armadura 6,4=10 ≥ 8 rompe (GM a heridas);
  // orden: tumbado → rebote (D8 5) → armadura → heridas 2,2+1=5 → aturdido.
  placar(e, 'sh1', 'hu4', {
    azar: dadoGuionizado(6, 6, 5, 6, 4, 2, 2),
    opciones: { impulso: () => false },
  });
  assert.equal(rival.postura, 'aturdido');
  assert.equal(e.turnover, null, 'que el rival suelte el balón es tu mejor noticia');
});
