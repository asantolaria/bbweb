// Solitario (X+): para usar un reroll de equipo, 1D6 ≥ X; si falla, el reroll se gasta
// pero no se repite nada. E1-S07 — antes los Big Guys repetían gratis.

import test from 'node:test';
import assert from 'node:assert/strict';
import { crearEquipo } from '../src/engine/equipo.js';
import { ROSTERS_1000K } from '../src/data/rosters-iniciales.js';
import { crearPartido, jugador } from '../src/engine/partido.js';
import { activar, paso } from '../src/engine/movimiento.js';
import { placar } from '../src/engine/placaje.js';
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

test('el Ogro (Solitario 3+) falla la lealtad: reroll gastado y tirada NO repetida', () => {
  const e = montar();
  const ogro = colocar(e, 'hu1', 7, 13);
  colocar(e, 'ch5', 7, 12);            // marca el origen
  activar(e, 'hu1', 'move', { azar: dadoGuionizado(2) }); // Estúpido: 2 → pasa
  // Esquiva AG 4+: sale 2 (falla) → reroll aceptado → Solitario 3+: sale 2 → NO repite
  // → cae con la MISMA tirada: armadura 4,4=8 < 10 no rompe.
  const r = paso(e, 7, 14, { azar: dadoGuionizado(2, 2, 4, 4), alFallar: () => true });
  assert.equal(r.exito, false);
  assert.equal(ogro.postura, 'tumbado');
  assert.equal(e.equipos[0].rerolls, 2, 'el reroll se ha gastado igualmente');
  const ev = e.registro.find((x) => x.tipo === 'solitario');
  assert.deepEqual([ev.objetivo, ev.d6, ev.repite], [3, 2, false]);
});

test('el Ogro pasa la lealtad con 3+: el reroll repite con normalidad', () => {
  const e = montar();
  colocar(e, 'hu1', 7, 13);
  colocar(e, 'ch5', 7, 12);
  activar(e, 'hu1', 'move', { azar: dadoGuionizado(2) });
  // Esquiva 2 (falla) → reroll → Solitario: 3 (pasa) → repite: 5 → éxito.
  const r = paso(e, 7, 14, { azar: dadoGuionizado(2, 3, 5), alFallar: () => true });
  assert.equal(r.exito, true);
  assert.equal(e.equipos[0].rerolls, 2);
});

test('el Troll del Caos (Solitario 4+) también lo paga en el placaje de grupo', () => {
  const e = montar('chaos_chosen', 'human');
  colocar(e, 'ch1', 7, 13);            // Troll del Caos, FU 5
  colocar(e, 'hu7', 7, 12);
  // Placaje directo (sin activación: los rasgos negativos se tiran al activar, no aquí).
  // 2 dados: 1,1 → reroll aceptado → Solitario 4+: 3 → NO se repite el grupo: queda
  // [1,1] → atacante derribado. Armadura del Troll 3,3=6 < 10 no rompe.
  placar(e, 'ch1', 'hu7', {
    azar: dadoGuionizado(1, 1, 3, 3, 3),
    opciones: { alFallar: () => true },
  });
  assert.equal(e.equipos[0].rerolls, 2, 'reroll del Caos gastado (3−1)');
  assert.equal(jugador(e, 'ch1').postura, 'tumbado');
  assert.ok(e.registro.some((x) => x.tipo === 'solitario' && x.repite === false));
});

test('un jugador sin Solitario repite sin peaje (control)', () => {
  const e = montar();
  colocar(e, 'hu7', 7, 13);
  colocar(e, 'ch5', 7, 12);
  activar(e, 'hu7', 'move', { azar: dadoFijo(6) });
  // Esquiva 2 (falla) → reroll → SIN tirada de Solitario → repite directamente: 4 → OK.
  const r = paso(e, 7, 14, { azar: dadoGuionizado(2, 4), alFallar: () => true });
  assert.equal(r.exito, true);
  assert.ok(!e.registro.some((x) => x.tipo === 'solitario'));
});

test('el Troll Adiestrado no tiene Solitario: repite gratis como cualquiera', () => {
  const e = montar('black_orc', 'human');
  colocar(e, 'bl1', 7, 13);            // Troll Adiestrado: sin Solitario (detalle del repo)
  colocar(e, 'hu7', 7, 12);
  // 2 dados 1,1 → reroll → sin Solitario → grupo nuevo: 6,3 → elige POW → empuja a la
  // primera candidata, sin impulso; armadura 2,2 + 1 (Golpe mortífero) = 5 < 9 no rompe.
  placar(e, 'bl1', 'hu7', {
    azar: dadoGuionizado(1, 1, 6, 3, 2, 2),
    opciones: { alFallar: () => true, impulso: () => false },
  });
  assert.ok(!e.registro.some((x) => x.tipo === 'solitario'));
  assert.equal(e.equipos[0].rerolls, 1, '2−1: gastado pero con repetición');
});
