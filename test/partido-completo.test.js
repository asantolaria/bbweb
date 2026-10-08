// La prueba de fuego: el bot aleatorio (src/bot/) juega partidas COMPLETAS contra sí
// mismo con dados de semilla fija. Si alguna fase se atasca o alguna acción lanza una
// excepción inesperada, revienta aquí y no en el móvil de nadie.

import test from 'node:test';
import assert from 'node:assert/strict';
import { jugarPartido } from '../src/bot/bot-aleatorio.js';

const EMPAREJAMIENTOS = [
  ['human', 'black_orc', 1], ['skaven', 'shambling_undead', 2], ['high_elf', 'lizardmen', 3],
  ['chaos_chosen', 'elven_union', 4], ['imperial_nobility', 'human', 5], ['black_orc', 'black_orc', 6],
];

for (const [a, b, semilla] of EMPAREJAMIENTOS) {
  test(`partido completo con bot: ${a} contra ${b} (semilla ${semilla})`, () => {
    const e = jugarPartido(a, b, semilla * 7919);
    assert.equal(e.fase, 'fin');
    assert.ok(e.equipos[0].turno >= 8 && e.equipos[1].turno >= 8, 'las 8 rondas de las dos partes');
    assert.ok(e.equipos[0].marcador + e.equipos[1].marcador <= 16, 'marcador plausible');
    assert.ok(e.registro.length > 100, 'pasaron cosas');
  });
}
