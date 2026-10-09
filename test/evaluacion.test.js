// E3-S01: la evaluación de posición. Se prueban las PREFERENCIAS (el orden entre
// posiciones), no los números: los pesos son hipótesis y cambiarán con el playtest.

import test from 'node:test';
import assert from 'node:assert/strict';
import { crearEquipo } from '../src/engine/equipo.js';
import { ROSTERS_1000K } from '../src/data/rosters-iniciales.js';
import { crearPartido, jugador } from '../src/engine/partido.js';
import { evaluar } from '../src/ia/evaluacion.js';
import { jugarPartido } from '../src/bot/bot-aleatorio.js';

function base(colocar = [], { balon = null, turno = 2 } = {}) {
  const e = crearPartido(
    crearEquipo('human', ROSTERS_1000K.human, { nombre: 'A' }),
    crearEquipo('chaos_chosen', ROSTERS_1000K.chaos_chosen, { nombre: 'B' }),
  );
  e.fase = 'turno'; e.activo = 0; e.mitad = 1;
  e.equipos[0].turno = turno; e.equipos[1].turno = turno;
  // Formación neutra: 5 por bando de pie, lejos del balón.
  const fijos = [['hu7', 2, 15], ['hu8', 4, 15], ['hu9', 10, 15], ['hu10', 12, 15], ['hu11', 7, 16],
    ['ch6', 2, 10], ['ch7', 4, 10], ['ch8', 10, 10], ['ch9', 12, 10], ['ch10', 7, 9]];
  for (const [id, x, y, p = 'de_pie'] of [...fijos, ...colocar]) {
    const j = jugador(e, id); j.situacion = 'campo'; j.x = x; j.y = y; j.postura = p;
  }
  if (balon) e.balon = balon;
  return e;
}
const v = (e, eq = 0) => evaluar(e, eq).total;

test('antisimétrica: lo que es bueno para uno es igual de malo para el otro', () => {
  const e = base([['hu4', 7, 12]], { balon: { portador: 'hu4' } });
  assert.equal(v(e, 0), -v(e, 1));
});

test('tener el balón > balón suelto cerca > balón suelto lejos > el rival lo tiene', () => {
  const conBalon = base([['hu4', 7, 13]], { balon: { portador: 'hu4' } });
  const sueltoCerca = base([['hu4', 7, 13]], { balon: { x: 7, y: 12 } });
  const sueltoLejos = base([['hu4', 7, 13]], { balon: { x: 1, y: 3 } });
  const rivalLoTiene = base([['hu4', 7, 13], ['ch5', 7, 11]], { balon: { portador: 'ch5' } });
  assert.ok(v(conBalon) > v(sueltoCerca), 'tenerlo > suelto cerca');
  assert.ok(v(sueltoCerca) > v(sueltoLejos), 'suelto cerca > suelto lejos');
  assert.ok(v(sueltoLejos) > v(rivalLoTiene), 'suelto lejos > el rival lo tiene');
});

test('más cerca de anotar es mejor, y más aún en la recta final de la parte', () => {
  const lejos = base([['hu4', 7, 20]], { balon: { portador: 'hu4' } });
  const cerca = base([['hu4', 7, 4]], { balon: { portador: 'hu4' } });
  assert.ok(v(cerca) > v(lejos));
  const cercaTarde = base([['hu4', 7, 4]], { balon: { portador: 'hu4' }, turno: 8 });
  assert.ok(v(cercaTarde) - v(base([['hu4', 7, 20]], { balon: { portador: 'hu4' }, turno: 8 }))
    > v(cerca) - v(lejos), 'en el turno 8 la misma ventaja de avance pesa más');
});

test('la caja protege: escolta suma, rivales marcando al portador restan', () => {
  const solo = base([['hu4', 7, 13]], { balon: { portador: 'hu4' } });
  const escoltado = base([['hu4', 7, 13], ['hu2', 6, 13], ['hu3', 8, 13]], { balon: { portador: 'hu4' } });
  const acosado = base([['hu4', 7, 13], ['ch5', 7, 12], ['ch2', 8, 12]], { balon: { portador: 'hu4' } });
  // El escoltado suma dos jugadores de pie más: se descuenta para aislar el efecto caja.
  const masJugadores = base([['hu4', 7, 13], ['hu2', 1, 20], ['hu3', 13, 20]], { balon: { portador: 'hu4' } });
  assert.ok(v(escoltado) > v(masJugadores), 'la escolta vale más que los mismos jugadores lejos');
  assert.ok(v(acosado) < v(solo) - 40, 'dos rivales encima del portador pesan');
});

test('derribar rivales mejora la posición; perder jugadores la empeora', () => {
  const normal = base();
  const rivalTumbado = base([['ch6', 2, 10, 'tumbado']]);
  const rivalKO = base(); jugador(rivalKO, 'ch6').situacion = 'ko';
  assert.ok(v(rivalTumbado) > v(normal));
  assert.ok(v(rivalKO) > v(rivalTumbado), 'un KO es mejor que un tumbado');
});

test('el desglose explica cada término (ninguna puntuación sin motivo)', () => {
  const e = base([['hu4', 7, 13], ['hu2', 6, 13]], { balon: { portador: 'hu4' } });
  const r = evaluar(e, 0);
  for (const t of [...r.propios, ...r.rivales]) {
    assert.equal(typeof t.v, 'number');
    assert.ok(t.porque && t.porque.length > 3, JSON.stringify(t));
  }
  const suma = r.propios.reduce((n, x) => n + x.v, 0) - r.rivales.reduce((n, x) => n + x.v, 0);
  assert.equal(suma, r.total, 'el total es exactamente la suma de sus porqués');
  assert.ok(r.propios.some((t) => /tiene el balón/.test(t.porque)));
});

test('barata: menos de 1 ms por evaluación de media en estados reales', () => {
  const estados = [1, 2, 3].map((s) => jugarPartido('skaven', 'black_orc', s * 101));
  const t0 = performance.now();
  let n = 0;
  for (let i = 0; i < 1000; i++) for (const e of estados) { evaluar(e, i % 2); n++; }
  const ms = (performance.now() - t0) / n;
  assert.ok(ms < 1, `${ms.toFixed(4)} ms por evaluación`);
});
