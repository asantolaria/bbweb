import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chequeo, naturalNecesario, tirar, tirar2D6, tirarD3,
  tiradaEnfrentada, consultarTabla, azarConSemilla, azarReal,
} from '../src/engine/dice.js';
import { dadoGuionizado, dadoFijo } from './ayuda.js';

test('naturalNecesario nunca pide menos de 2 ni más de 6', () => {
  // Con bonificadores enormes sigue haciendo falta un 2: el 1 natural siempre falla.
  assert.equal(naturalNecesario(3, +5), 2);
  // Con penalizadores enormes basta el 6: el 6 natural siempre tiene éxito.
  assert.equal(naturalNecesario(3, -9), 6);
  assert.equal(naturalNecesario(4, 0), 4);
  assert.equal(naturalNecesario(4, -1), 5);
  assert.equal(naturalNecesario(2, -1), 3);
});

test('el 1 natural falla aunque los modificadores lo hagan imposible de fallar', () => {
  const r = chequeo({ objetivo: 2, mods: [{ v: +4, porque: 'prueba' }], azar: dadoFijo(1) });
  assert.equal(r.exito, false);
  assert.equal(r.natural1, true);
});

test('el 6 natural acierta aunque los modificadores lo hagan imposible de acertar', () => {
  const r = chequeo({ objetivo: 6, mods: [{ v: -5, porque: 'prueba' }], azar: dadoFijo(6) });
  assert.equal(r.exito, true);
  assert.equal(r.natural6, true);
});

test('un D6 modificado nunca pasa de 6, pero sí puede bajar de 1', () => {
  // Tope por arriba.
  const alto = chequeo({ objetivo: 3, mods: [{ v: +3, porque: 'prueba' }], azar: dadoFijo(5) });
  assert.equal(alto.modificado, 6);
  // Sin suelo por abajo (errata de mayo de 2026).
  const bajo = chequeo({ objetivo: 3, mods: [{ v: -4, porque: 'prueba' }], azar: dadoFijo(2) });
  assert.equal(bajo.modificado, -2);
});

test('un chequeo normal se resuelve por el valor modificado', () => {
  // Esquivar 3+ con dos rivales marcando el destino: hace falta un 5 natural.
  const mods = [
    { v: -1, porque: 'Línea Orco marca el destino' },
    { v: -1, porque: 'Blitzer Orco marca el destino' },
  ];
  assert.equal(chequeo({ objetivo: 3, mods, azar: dadoFijo(5) }).exito, true);
  assert.equal(chequeo({ objetivo: 3, mods, azar: dadoFijo(4) }).exito, false);
  assert.equal(chequeo({ objetivo: 3, mods, azar: dadoFijo(4) }).necesario, 5);
});

test('un modificador sin motivo es un error de programación, no un aviso', () => {
  assert.throws(
    () => chequeo({ objetivo: 3, mods: [{ v: -1 }], azar: dadoFijo(4), motivo: 'esquivar' }),
    /Modificador sin motivo en «esquivar»/,
  );
});

test('2D6 devuelve los dos dados, la suma y si son dobles', () => {
  const t = tirar2D6({ azar: dadoGuionizado(3, 3) });
  assert.deepEqual(t.dados, [3, 3]);
  assert.equal(t.valor, 6);
  assert.equal(t.dobles, true);
  assert.equal(tirar2D6({ azar: dadoGuionizado(2, 5) }).dobles, false);
});

test('D3 es 1D6 partido por 2 redondeando hacia arriba', () => {
  for (const [d6, d3] of [[1, 1], [2, 1], [3, 2], [4, 2], [5, 3], [6, 3]]) {
    assert.equal(tirarD3({ azar: dadoFijo(d6) }).valor, d3, `D6 ${d6}`);
  }
});

test('la tirada enfrentada repite los empates hasta que haya ganador', () => {
  const r = tiradaEnfrentada({ azar: dadoGuionizado(4, 4, 2, 2, 6, 1) });
  assert.equal(r.ganador, 0);
  assert.equal(r.rondas.length, 3);
});

test('consultarTabla acierta la fila y protesta fuera de rango', () => {
  const tabla = { nombre: 'prueba', filas: [[2, 7, 'bajo', ''], [8, 12, 'alto', '']] };
  assert.equal(consultarTabla(tabla, 7).nombre, 'bajo');
  assert.equal(consultarTabla(tabla, 8).nombre, 'alto');
  assert.throws(() => consultarTabla(tabla, 13), /fuera de la tabla/);
});

test('el generador con semilla es reproducible y se mantiene en rango', () => {
  const a = azarConSemilla(12345), b = azarConSemilla(12345);
  const sa = Array.from({ length: 50 }, () => a(6));
  const sb = Array.from({ length: 50 }, () => b(6));
  assert.deepEqual(sa, sb);
  assert.ok(sa.every((v) => v >= 1 && v <= 6));
});

test('el generador criptográfico cubre todas las caras y ninguna más', () => {
  const vistas = new Set();
  for (let i = 0; i < 2000; i++) {
    const v = azarReal(8);
    assert.ok(v >= 1 && v <= 8, `fuera de rango: ${v}`);
    vistas.add(v);
  }
  assert.equal(vistas.size, 8, 'deberían salir las 8 caras');
});

test('tirar registra el dado y el motivo', () => {
  const t = tirar(16, { azar: dadoFijo(13), motivo: 'lesión' });
  assert.equal(t.dado, 'D16');
  assert.equal(t.valor, 13);
  assert.equal(t.motivo, 'lesión');
});
