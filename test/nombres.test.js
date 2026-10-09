// Los nombres de pantalla son EXACTAMENTE los del repo bloodbowl-my-rosters
// (instrucción del entrenador, 2026-10-09). Este fixture es una copia congelada de las
// tablas «Roster» de source/teams/*.md en esa fecha: si alguien «mejora» una
// traducción aquí, este test lo delata; si el repo cambia un nombre, se actualiza el
// fixture en el mismo commit que nombres.es.js.

import test from 'node:test';
import assert from 'node:assert/strict';
import { POSICIONES_ES, HABILIDADES_ES } from '../src/data/nombres.es.js';

const CANON_POSICIONES = {
  human_lineman: 'Línea', human_halfling: 'Halfling', human_catcher: 'Catcher',
  human_thrower: 'Thrower', human_blitzer: 'Blitzer', human_ogre: 'Ogre',
  high_elf_lineman: 'Alto Elfo Línea',
  high_elf_thrower: 'Alto Elfo Phoenix Prince Thrower',
  high_elf_blitzer: 'Alto Elfo White Lion Blitzer',
  high_elf_dragon_warrior: 'Alto Elfo Dragon Warrior',
  chaos_beastman: 'Beastman', chaos_warrior: 'Guerrero Caos',
  chaos_troll: 'Troll del Caos', chaos_ogre: 'Ogro del Caos', chaos_minotaur: 'Minotauro',
  lizardmen_skink: 'Eslizón Línea', lizardmen_chameleon: 'Camaleón',
  lizardmen_saurus: 'Saurio', lizardmen_kroxigor: 'Kroxigor',
  undead_skeleton: 'Esqueleto', undead_zombie: 'Zombie', undead_ghoul: 'Necrófago',
  undead_wight: 'Caballero', undead_mummy: 'Momia',
  imperial_retainer: 'Retainer Línea', imperial_thrower: 'Imperial Thrower',
  imperial_blitzer: 'Noble Blitzer', imperial_bodyguard: 'Bodyguard', imperial_ogre: 'Ogre',
  black_orc_goblin: 'Goblin Bruiser', black_orc_blocker: 'Black Orc',
  black_orc_troll: 'Troll Adiestrado',
  skaven_lineman: 'Linemen', skaven_thrower: 'Thrower', skaven_gutter_runner: 'Gutter Runner',
  skaven_blitzer: 'Blitzer', skaven_rat_ogre: 'Rata Ogro',
  elven_union_lineman: 'Elfo Línea', elven_union_thrower: 'Elfo Lanzador',
  elven_union_catcher: 'Elfo Catcher', elven_union_blitzer: 'Elfo Blitzer',
};

// Muestra de habilidades donde una «mejora» bienintencionada es más tentadora.
const CANON_HABILIDADES = {
  tackle: 'Placaje defensivo', mighty_blow: 'Golpe mortífero', thick_skull: 'Cabeza dura',
  stunty: 'Escurridizo', right_stuff: 'Humanoide bala', unsteady: 'Tembloroso',
  juggernaut: 'Imparable', fumblerooski: 'Dejada', give_and_go: 'Pasar y seguir',
  hail_mary_pass: 'Pase a lo loco', on_the_ball: 'Atento al balón',
  diving_catch: 'Recepción heroica', side_step: 'Echarse a un lado',
  animal_savagery: 'Ferocidad animal', unchannelled_fury: 'Ira descontrolada',
  cloud_burster: 'Partenubes', steady_footing: 'Equilibrio firme', grab: 'Apartar',
  brawler: 'Luchador', eye_gouge: 'Piquete de ojos', loner_3: 'Solitario (3+)',
};

test('los posicionales en pantalla son los del repo de rosters, letra a letra', () => {
  assert.deepEqual(POSICIONES_ES, CANON_POSICIONES);
});

test('las habilidades en pantalla son las del repo de rosters, letra a letra', () => {
  for (const [id, canon] of Object.entries(CANON_HABILIDADES)) {
    assert.equal(HABILIDADES_ES[id], canon, id);
  }
});
