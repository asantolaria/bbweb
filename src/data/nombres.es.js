// Nombres de pantalla en castellano (ADR 002: el motor jamás importa este archivo).
// Fuente: los propios archivos del repo bloodbowl-my-rosters, que siguen a Nuffle Zone.

export const EQUIPOS_ES = {
  human: 'Humanos',
  high_elf: 'Altos Elfos',
  chaos_chosen: 'Elegidos del Caos',
  lizardmen: 'Hombres Lagarto',
  shambling_undead: 'No-Muertos',
  imperial_nobility: 'Nobleza Imperial',
  black_orc: 'Orcos Negros',
  skaven: 'Skavens',
  elven_union: 'Unión Élfica',
};

export const POSICIONES_ES = {
  // Nombres EXACTOS de las tablas «Roster» de source/teams/*.md en bloodbowl-my-rosters
  // (instrucción del entrenador, 2026-10-09: ni una traducción propia). Las
  // inconsistencias internas del repo (Ogre/Ogro, «Linemen» en plural) se respetan tal
  // cual y están señaladas en docs/discovery/sources.md para unificarlas allí.
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
  imperial_blitzer: 'Noble Blitzer', imperial_bodyguard: 'Bodyguard',
  imperial_ogre: 'Ogre',

  black_orc_goblin: 'Goblin Bruiser', black_orc_blocker: 'Black Orc',
  black_orc_troll: 'Troll Adiestrado',

  skaven_lineman: 'Linemen', skaven_thrower: 'Thrower', skaven_gutter_runner: 'Gutter Runner',
  skaven_blitzer: 'Blitzer', skaven_rat_ogre: 'Rata Ogro',

  elven_union_lineman: 'Elfo Línea', elven_union_thrower: 'Elfo Lanzador',
  elven_union_catcher: 'Elfo Catcher', elven_union_blitzer: 'Elfo Blitzer',
};

/** Abreviatura para la ficha del tablero. */
export const FICHA_ES = {
  human_lineman: 'L', human_halfling: 'H', human_catcher: 'C', human_thrower: 'Lz',
  human_blitzer: 'B', human_ogre: 'O',
  high_elf_lineman: 'L', high_elf_thrower: 'Lz', high_elf_blitzer: 'LB', high_elf_dragon_warrior: 'GD',
  chaos_beastman: 'Bm', chaos_warrior: 'G', chaos_troll: 'T', chaos_ogre: 'O', chaos_minotaur: 'M',
  lizardmen_skink: 'E', lizardmen_chameleon: 'Cm', lizardmen_saurus: 'S', lizardmen_kroxigor: 'K',
  undead_skeleton: 'E', undead_zombie: 'Z', undead_ghoul: 'N', undead_wight: 'Cb', undead_mummy: 'M',
  imperial_retainer: 'R', imperial_thrower: 'Lz', imperial_blitzer: 'B', imperial_bodyguard: 'Gd', imperial_ogre: 'O',
  black_orc_goblin: 'G', black_orc_blocker: 'ON', black_orc_troll: 'T',
  skaven_lineman: 'L', skaven_thrower: 'Lz', skaven_gutter_runner: 'C', skaven_blitzer: 'B', skaven_rat_ogre: 'RO',
  elven_union_lineman: 'L', elven_union_thrower: 'Lz', elven_union_catcher: 'C', elven_union_blitzer: 'B',
};

export const HABILIDADES_ES = {
  block: 'Placar', brawler: 'Luchador', fend: 'Zafarse', frenzy: 'Furia',
  pro: 'Profesional', steady_footing: 'Equilibrio firme', strip_ball: 'Robar balón',
  sure_hands: 'Manos seguras', tackle: 'Placaje defensivo', wrestle: 'Forcejear',
  catch: 'Atrapar', diving_catch: 'Recepción heroica', dodge: 'Esquivar',
  side_step: 'Echarse a un lado',
  arm_bar: 'Llave de brazo', grab: 'Apartar', juggernaut: 'Imparable',
  mighty_blow: 'Golpe mortífero', stand_firm: 'Mantenerse firme', thick_skull: 'Cabeza dura',
  cloud_burster: 'Partenubes', give_and_go: 'Pasar y seguir', hail_mary_pass: 'Pase a lo loco',
  nerves_of_steel: 'Nervios de acero', on_the_ball: 'Atento al balón', pass: 'Pasar',
  safe_pass: 'Pase seguro',
  claws: 'Garras', horns: 'Cuernos', prehensile_tail: 'Cola prensil',
  animal_savagery: 'Ferocidad animal', always_hungry: 'Siempre hambriento',
  bone_head: 'Estúpido', eye_gouge: 'Piquete de ojos', fumblerooski: 'Dejada',
  loner_3: 'Solitario (3+)', loner_4: 'Solitario (4+)', my_ball: 'El balón es mío',
  projectile_vomit: 'Proyectil de vómito', really_stupid: 'Realmente estúpido',
  regeneration: 'Regeneración', right_stuff: 'Humanoide bala', shadowing: 'Perseguir',
  stab: 'Apuñalar', stunty: 'Escurridizo', throw_team_mate: 'Lanzar compañero',
  unchannelled_fury: 'Ira descontrolada', unsteady: 'Tembloroso',
};

export const ESPECIALES_ES = {
  team_captain: 'Capitán del equipo',
  favoured_of: 'Elegidos de…',
  masters_of_undeath: 'Señores de los No Muertos',
  brawlin_brutes: 'Brutos brutales',
  bribery_and_corruption: 'Sobornos y corrupción',
};
