import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tiradaArmadura, tiradaHeridas, tiradaLesion, tiradaPermanente, heridoPorElPublico,
} from '../src/engine/heridas.js';
import { dadoGuionizado } from './ayuda.js';

/** Un 2D6 que sume exactamente `n`, con dos dados legales (2..12). */
const suma = (n) => {
  const a = Math.min(6, n - 1), b = n - a;
  return dadoGuionizado(a, b);
};

test('la armadura se rompe al igualar el AR, no solo al superarlo', () => {
  assert.equal(tiradaArmadura({ ar: 9, azar: suma(8) }).rota, false);
  assert.equal(tiradaArmadura({ ar: 9, azar: suma(9) }).rota, true, 'igualar ya rompe');
  assert.equal(tiradaArmadura({ ar: 9, azar: suma(10) }).rota, true);
});

test('Golpe mortífero suma a la armadura y queda registrado con su motivo', () => {
  const r = tiradaArmadura({
    ar: 9, azar: suma(8), mods: [{ v: +1, porque: 'Golpe mortífero' }],
  });
  assert.equal(r.total, 9);
  assert.equal(r.rota, true);
  assert.equal(r.mods[0].porque, 'Golpe mortífero');
});

test('la armadura avisa de las dobles naturales (una Falta expulsa con ellas)', () => {
  assert.equal(tiradaArmadura({ ar: 9, azar: dadoGuionizado(4, 4) }).dobles, true);
  assert.equal(tiradaArmadura({ ar: 9, azar: dadoGuionizado(4, 5) }).dobles, false);
});

test('tabla de Heridas normal: las tres bandas, en sus bordes', () => {
  const esperado = [
    [2, 'stunned'], [7, 'stunned'],
    [8, 'ko'], [9, 'ko'],
    [10, 'casualty'], [12, 'casualty'],
  ];
  for (const [total, resultado] of esperado) {
    assert.equal(tiradaHeridas({ azar: suma(total) }).resultado, resultado, `2D6=${total}`);
  }
});

test('tabla de Escurridizos: bandas distintas, no un modificador', () => {
  const esperado = [
    [2, 'stunned'], [6, 'stunned'],
    [7, 'ko'], [8, 'ko'],
    [9, 'casualty'], [10, 'casualty'], [12, 'casualty'],
  ];
  for (const [total, resultado] of esperado) {
    const r = tiradaHeridas({ escurridizo: true, azar: suma(total) });
    assert.equal(r.resultado, resultado, `2D6=${total}`);
    assert.equal(r.tabla, 'injury_stunty');
  }
});

test('un Escurridizo con 9 es Magullado automático: no se tira el D16', () => {
  const r = tiradaHeridas({ escurridizo: true, azar: suma(9) });
  assert.equal(r.automatico, 'badly_hurt');
  // Con 10 sí hay que tirar en la tabla de Lesiones.
  assert.equal(tiradaHeridas({ escurridizo: true, azar: suma(10) }).automatico, null);
  // Y en la tabla normal el 9 es un KO, no una Lesión.
  assert.equal(tiradaHeridas({ azar: suma(9) }).resultado, 'ko');
});

test('tabla de Lesiones (D16): las cinco bandas de BB2025, en sus bordes', () => {
  const esperado = [
    [1, 'badly_hurt'], [8, 'badly_hurt'],
    [9, 'seriously_hurt'], [10, 'seriously_hurt'],
    [11, 'serious_injury'], [12, 'serious_injury'],
    [13, 'lasting_injury'], [14, 'lasting_injury'],
    [15, 'dead'], [16, 'dead'],
  ];
  for (const [d16, resultado] of esperado) {
    assert.equal(tiradaLesion({ azar: dadoGuionizado(d16) }).resultado, resultado, `D16=${d16}`);
  }
});

test('cada Lesión mal curada empeora la siguiente tirada en +1', () => {
  // Un 8 limpio es Magullado; con una mal curada pasa a Apaleado.
  assert.equal(tiradaLesion({ azar: dadoGuionizado(8) }).resultado, 'badly_hurt');
  assert.equal(tiradaLesion({ malCuradas: 1, azar: dadoGuionizado(8) }).resultado, 'seriously_hurt');
  assert.equal(tiradaLesion({ malCuradas: 3, azar: dadoGuionizado(14) }).resultado, 'dead');
  // Y no se sale de la tabla por arriba.
  assert.equal(tiradaLesion({ malCuradas: 5, azar: dadoGuionizado(16) }).total, 21);
  assert.equal(tiradaLesion({ malCuradas: 5, azar: dadoGuionizado(16) }).resultado, 'dead');
});

test('heridas permanentes: cada cara reduce el atributo que toca', () => {
  const perfil = { mv: 6, fu: 3, ag: 3, ps: 4, ar: 9 };
  const esperado = [
    [1, 'ar', 8], [2, 'ar', 8], [3, 'mv', 5], [4, 'ps', 5], [5, 'ag', 4], [6, 'fu', 2],
  ];
  for (const [d6, attr, nuevo] of esperado) {
    const r = tiradaPermanente({ perfil, azar: dadoGuionizado(d6) });
    assert.equal(r.atributo, attr, `D6=${d6}`);
    assert.equal(r.aplicable, true);
    assert.equal(r.a, nuevo, `D6=${d6} deja ${attr} en ${nuevo}`);
  }
});

test('solo AG y PS empeoran subiendo: AR empeora bajando, como MV y FU', () => {
  const perfil = { mv: 6, fu: 3, ag: 3, ps: 4, ar: 9 };
  // AG 3+ → 4+ y PS 4+ → 5+: el jugador necesita sacar más.
  assert.equal(tiradaPermanente({ perfil, azar: dadoGuionizado(5) }).empeoraSubiendo, true);
  assert.equal(tiradaPermanente({ perfil, azar: dadoGuionizado(4) }).empeoraSubiendo, true);
  // AR 9+ → 8+: es el RIVAL quien tira contra él, así que bajar es peor armadura.
  const ar = tiradaPermanente({ perfil, azar: dadoGuionizado(1) });
  assert.equal(ar.empeoraSubiendo, false);
  assert.equal(ar.a, 8, 'una cabeza fracturada deja el AR más fácil de romper');
  assert.equal(tiradaPermanente({ perfil, azar: dadoGuionizado(3) }).empeoraSubiendo, false);
});

test('si el atributo ya está en su peor valor, la reducción no se aplica: pasa a MNG', () => {
  const alLimite = { mv: 1, fu: 1, ag: 6, ps: 6, ar: 3 };
  for (const d6 of [1, 3, 4, 5, 6]) {
    const r = tiradaPermanente({ perfil: alLimite, azar: dadoGuionizado(d6) });
    assert.equal(r.aplicable, false, `D6=${d6}`);
    assert.equal(r.resultado, 'seriously_hurt');
    assert.equal(r.a, r.de, 'el atributo no se toca');
    assert.match(r.nota, /ya está en su peor valor/);
  }
});

test('herido por el público: sin armadura, y un Aturdido va a Reservas', () => {
  const aturdido = heridoPorElPublico({ azar: suma(5) });
  assert.equal(aturdido.resultado, 'stunned');
  assert.equal(aturdido.destino, 'reserves', 'no puede quedarse tumbado fuera del campo');
  // Un KO o una Lesión se aplican tal cual.
  assert.equal(heridoPorElPublico({ azar: suma(8) }).destino, 'ko');
  assert.equal(heridoPorElPublico({ azar: suma(11) }).destino, 'casualty');
});
