// Cruce de datos contra reglas: los 9 equipos, sus rosters por defecto y la capa de
// nombres. Si un dato transcrito del repo de rosters no cuadra con las reglas de
// creación, revienta aquí y no en mitad de una partida.

import test from 'node:test';
import assert from 'node:assert/strict';
import { EQUIPOS } from '../src/data/equipos.js';
import { ROSTERS_1000K, PRESUPUESTO } from '../src/data/rosters-iniciales.js';
import { HABILIDADES, tiene, valorDe } from '../src/data/habilidades.js';
import { EQUIPOS_ES, POSICIONES_ES, FICHA_ES, HABILIDADES_ES, ESPECIALES_ES } from '../src/data/nombres.es.js';
import { costeRoster, validarRoster, crearEquipo } from '../src/engine/equipo.js';

test('hay roster por defecto para cada equipo, y equipo para cada roster', () => {
  assert.deepEqual(Object.keys(ROSTERS_1000K).sort(), Object.keys(EQUIPOS).sort());
});

test('los 9 rosters por defecto son legales', () => {
  for (const [id, roster] of Object.entries(ROSTERS_1000K)) {
    assert.deepEqual(validarRoster(id, roster, PRESUPUESTO), [], id);
  }
});

test('los 9 rosters por defecto cuestan 1.000k exactos', () => {
  for (const [id, roster] of Object.entries(ROSTERS_1000K)) {
    const c = costeRoster(id, roster);
    assert.equal(c.total, 1000, `${id}: ${JSON.stringify(c)}`);
  }
});

test('toda habilidad usada por un posicional existe en el registro', () => {
  for (const [eq, E] of Object.entries(EQUIPOS)) {
    for (const [pos, p] of Object.entries(E.pos)) {
      for (const h of p.hab) {
        assert.ok(HABILIDADES[h], `${eq}.${pos} usa la habilidad desconocida «${h}»`);
      }
    }
  }
});

test('todo identificador tiene nombre castellano y abreviatura de ficha', () => {
  for (const eq of Object.keys(EQUIPOS)) {
    assert.ok(EQUIPOS_ES[eq], `falta nombre de equipo: ${eq}`);
    for (const pos of Object.keys(EQUIPOS[eq].pos)) {
      assert.ok(POSICIONES_ES[pos], `falta nombre de posicional: ${pos}`);
      assert.ok(FICHA_ES[pos], `falta abreviatura de ficha: ${pos}`);
    }
    for (const sp of EQUIPOS[eq].especiales) {
      assert.ok(ESPECIALES_ES[sp], `falta nombre de regla especial: ${sp}`);
    }
  }
  for (const h of Object.keys(HABILIDADES)) {
    assert.ok(HABILIDADES_ES[h], `falta nombre de habilidad: ${h}`);
  }
});

test('los perfiles están dentro de los límites de característica del reglamento', () => {
  // fundamentos-y-principios.md §7: MV 1-9, FU 1-8, AG/PS 1+-6+, AR 3+-11+.
  for (const [eq, E] of Object.entries(EQUIPOS)) {
    for (const [pos, p] of Object.entries(E.pos)) {
      const d = `${eq}.${pos}`;
      assert.ok(p.mv >= 1 && p.mv <= 9, `${d}: MV ${p.mv}`);
      assert.ok(p.fu >= 1 && p.fu <= 8, `${d}: FU ${p.fu}`);
      assert.ok(p.ag >= 1 && p.ag <= 6, `${d}: AG ${p.ag}+`);
      assert.ok(p.ps >= 1 && p.ps <= 6, `${d}: PS ${p.ps}+`);
      assert.ok(p.ar >= 3 && p.ar <= 11, `${d}: AR ${p.ar}+`);
      assert.ok(p.coste % 5 === 0 && p.coste > 0, `${d}: coste ${p.coste}`);
      assert.ok(p.max >= 1 && p.max <= 16, `${d}: max ${p.max}`);
    }
  }
});

test('los No-Muertos no pueden comprar apotecario', () => {
  assert.equal(EQUIPOS.shambling_undead.apotecario, false);
  const roster = { ...ROSTERS_1000K.shambling_undead, apotecario: true };
  const problemas = validarRoster('shambling_undead', roster);
  assert.ok(problemas.some((p) => /apotecario/.test(p)), problemas.join(' | '));
});

test('los Elegidos del Caos solo pueden llevar un Big Guy de los tres', () => {
  const roster = {
    jugadores: { chaos_troll: 1, chaos_ogre: 1, chaos_beastman: 9 },
    rerolls: 0,
  };
  const problemas = validarRoster('chaos_chosen', roster, 2000);
  assert.ok(problemas.some((p) => /uno de/.test(p)), problemas.join(' | '));
});

test('un roster de 10 jugadores no es legal', () => {
  const roster = {
    jugadores: { human_blitzer: 2, human_lineman: 8 },
    rerolls: 3,
  };
  const problemas = validarRoster('human', roster);
  assert.ok(problemas.some((p) => /al menos 11/.test(p)), problemas.join(' | '));
});

test('pasarse de presupuesto o de cupo se detecta y se explica', () => {
  const caro = { jugadores: { human_blitzer: 2, human_catcher: 2, human_thrower: 2, human_ogre: 1, human_lineman: 6 }, rerolls: 8 };
  assert.ok(validarRoster('human', caro).some((p) => /presupuesto/.test(p)));
  const exceso = { jugadores: { human_blitzer: 3, human_lineman: 8 }, rerolls: 0 };
  assert.ok(validarRoster('human', exceso).some((p) => /Demasiados human_blitzer/.test(p)));
  const hinchas = { ...ROSTERS_1000K.high_elf, hinchas: 4 };
  assert.ok(validarRoster('high_elf', hinchas, 2000).some((p) => /hinchas/.test(p)));
});

test('crearEquipo monta la plantilla con perfiles copiados, no compartidos', () => {
  const T = crearEquipo('human', ROSTERS_1000K.human, { nombre: 'Reikland Reavers' });
  assert.equal(T.jugadores.length, 12);
  assert.equal(T.rerolls, 3);
  assert.equal(T.hinchas, 3, '1 de serie + 2 comprados');
  assert.equal(T.tesoreria, 0);
  // El Ogro es jugador grande y lleva Solitario (3+).
  const ogro = T.jugadores.find((j) => j.pos === 'human_ogre');
  assert.equal(ogro.grande, true);
  assert.equal(valorDe(ogro.hab, 'loner'), 3);
  assert.ok(tiene(ogro.hab, 'loner'));
  // Mutar el perfil de un jugador (herida permanente) no toca al resto.
  const [l1, l2] = T.jugadores.filter((j) => j.pos === 'human_lineman');
  l1.perfil.mv -= 1;
  assert.equal(l2.perfil.mv, 6);
  // Dorsales únicos y correlativos.
  assert.equal(new Set(T.jugadores.map((j) => j.dorsal)).size, 12);
});

test('crearEquipo rechaza un roster ilegal en vez de construirlo a medias', () => {
  assert.throws(
    () => crearEquipo('shambling_undead', { ...ROSTERS_1000K.shambling_undead, apotecario: true }),
    /Roster ilegal/,
  );
});

test('el Troll Adiestrado de los Orcos Negros no lleva Solitario (y los demás grandes sí)', () => {
  // Detalle fácil de perder al transcribir: en la tabla del repo el Troll Adiestrado
  // no tiene Solitario, a diferencia del Troll del Caos y del resto de Big Guys.
  assert.equal(valorDe(EQUIPOS.black_orc.pos.black_orc_troll.hab, 'loner'), null);
  assert.equal(valorDe(EQUIPOS.chaos_chosen.pos.chaos_troll.hab, 'loner'), 4);
  assert.equal(valorDe(EQUIPOS.human.pos.human_ogre.hab, 'loner'), 3);
  assert.equal(valorDe(EQUIPOS.skaven.pos.skaven_rat_ogre.hab, 'loner'), 4);
});

test('todo equipo tiene un posicional 0-16 (la Línea del reglamento)', () => {
  for (const [eq, E] of Object.entries(EQUIPOS)) {
    assert.ok(Object.values(E.pos).some((p) => p.max === 16), eq);
  }
});
