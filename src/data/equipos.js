// Los 9 equipos iniciales, transcritos de source/teams/*.md del repo
// bloodbowl-my-rosters (BB2025 / 3ª temporada). Cada perfil se puede rastrear hasta la
// tabla «Roster 2025» de su archivo.
//
// AG, PS y AR se guardan como el número del objetivo «X+» (ag: 3 significa 3+).
// `max` es la cantidad máxima de ese posicional (0-X del roster).
// `eligeUno`: posiciones mutuamente excluyentes (Elegidos del Caos elige 1 Big Guy de 3).

export const COSTE_APOTECARIO = 50;
export const COSTE_AYUDANTE = 10;      // ayudantes del entrenador, máx. 6
export const COSTE_ANIMADORA = 10;     // animadoras, máx. 6
export const COSTE_HINCHA = 5;         // hinchas: 5k por punto, máx. +3 al crear
export const MAX_HINCHAS_CREACION = 3;
export const MAX_REROLLS = 8;
export const MIN_JUGADORES = 11;
export const MAX_JUGADORES = 16;

export const EQUIPOS = {
  // source/teams/humanos.md
  human: {
    rrCoste: 50, apotecario: true, especiales: ['team_captain'],
    pos: {
      human_lineman:  { max: 16, coste: 50,  mv: 6, fu: 3, ag: 3, ps: 4, ar: 9,  hab: [] },
      human_halfling: { max: 3,  coste: 30,  mv: 5, fu: 2, ag: 3, ps: 4, ar: 7,  hab: ['stunty', 'dodge', 'right_stuff'] },
      human_catcher:  { max: 2,  coste: 75,  mv: 8, fu: 3, ag: 3, ps: 4, ar: 8,  hab: ['catch', 'dodge'] },
      human_thrower:  { max: 2,  coste: 75,  mv: 6, fu: 3, ag: 3, ps: 3, ar: 9,  hab: ['sure_hands', 'pass'] },
      human_blitzer:  { max: 2,  coste: 85,  mv: 7, fu: 3, ag: 3, ps: 4, ar: 9,  hab: ['block', 'tackle'] },
      human_ogre:     { max: 1,  coste: 140, mv: 5, fu: 5, ag: 4, ps: 5, ar: 10, hab: ['bone_head', 'loner_3', 'mighty_blow', 'thick_skull', 'throw_team_mate'], grande: true },
    },
  },

  // source/teams/altos-elfos.md (lista Caledor)
  high_elf: {
    rrCoste: 50, apotecario: true, especiales: [],
    pos: {
      high_elf_lineman:        { max: 16, coste: 65,  mv: 6, fu: 3, ag: 2, ps: 3, ar: 9, hab: [] },
      high_elf_thrower:        { max: 2,  coste: 90,  mv: 6, fu: 3, ag: 2, ps: 2, ar: 9, hab: ['cloud_burster', 'pass', 'safe_pass'] },
      high_elf_blitzer:        { max: 2,  coste: 110, mv: 7, fu: 3, ag: 2, ps: 3, ar: 9, hab: ['wrestle', 'claws'] },
      high_elf_dragon_warrior: { max: 2,  coste: 110, mv: 8, fu: 3, ag: 2, ps: 4, ar: 9, hab: ['my_ball', 'steady_footing', 'block'] },
    },
  },

  // source/teams/elegidos-del-caos.md
  chaos_chosen: {
    rrCoste: 50, apotecario: true, especiales: ['favoured_of'],
    eligeUno: ['chaos_troll', 'chaos_ogre', 'chaos_minotaur'],
    pos: {
      chaos_beastman: { max: 16, coste: 55,  mv: 6, fu: 3, ag: 3, ps: 3, ar: 9,  hab: ['horns', 'thick_skull'] },
      chaos_warrior:  { max: 4,  coste: 100, mv: 5, fu: 4, ag: 3, ps: 5, ar: 10, hab: ['arm_bar'] },
      chaos_troll:    { max: 1,  coste: 115, mv: 4, fu: 5, ag: 5, ps: 5, ar: 10, hab: ['always_hungry', 'loner_4', 'mighty_blow', 'projectile_vomit', 'really_stupid', 'regeneration', 'throw_team_mate'], grande: true },
      chaos_ogre:     { max: 1,  coste: 140, mv: 5, fu: 5, ag: 4, ps: 5, ar: 10, hab: ['bone_head', 'loner_4', 'mighty_blow', 'thick_skull', 'throw_team_mate'], grande: true },
      chaos_minotaur: { max: 1,  coste: 150, mv: 5, fu: 5, ag: 4, ps: 6, ar: 9,  hab: ['frenzy', 'horns', 'loner_4', 'mighty_blow', 'thick_skull', 'unchannelled_fury'], grande: true },
    },
  },

  // source/teams/hombres-lagarto.md
  lizardmen: {
    rrCoste: 70, apotecario: true, especiales: [],
    pos: {
      lizardmen_skink:     { max: 16, coste: 60,  mv: 8, fu: 2, ag: 3, ps: 4, ar: 8,  hab: ['dodge', 'stunty'] },
      lizardmen_chameleon: { max: 2,  coste: 70,  mv: 7, fu: 2, ag: 3, ps: 3, ar: 8,  hab: ['dodge', 'on_the_ball', 'shadowing', 'stunty'] },
      lizardmen_saurus:    { max: 6,  coste: 90,  mv: 6, fu: 4, ag: 5, ps: 6, ar: 10, hab: ['juggernaut', 'unsteady'] },
      lizardmen_kroxigor:  { max: 1,  coste: 140, mv: 6, fu: 5, ag: 5, ps: 6, ar: 10, hab: ['thick_skull', 'bone_head', 'prehensile_tail', 'mighty_blow', 'loner_4'], grande: true },
    },
  },

  // source/teams/no-muertos.md — sin apotecario (Señores de los No Muertos)
  shambling_undead: {
    rrCoste: 70, apotecario: false, especiales: ['masters_of_undeath'],
    pos: {
      undead_skeleton: { max: 16, coste: 40,  mv: 5, fu: 3, ag: 4, ps: 6, ar: 8,  hab: ['regeneration', 'thick_skull'] },
      undead_zombie:   { max: 16, coste: 40,  mv: 4, fu: 3, ag: 4, ps: 6, ar: 9,  hab: ['eye_gouge', 'unsteady', 'regeneration'] },
      undead_ghoul:    { max: 2,  coste: 75,  mv: 7, fu: 3, ag: 3, ps: 3, ar: 8,  hab: ['dodge', 'regeneration'] },
      undead_wight:    { max: 2,  coste: 95,  mv: 6, fu: 3, ag: 3, ps: 5, ar: 9,  hab: ['thick_skull', 'block', 'tackle', 'regeneration'] },
      undead_mummy:    { max: 2,  coste: 125, mv: 3, fu: 5, ag: 5, ps: 6, ar: 10, hab: ['mighty_blow', 'regeneration'], grande: true },
    },
  },

  // source/teams/nobleza-imperial.md
  imperial_nobility: {
    rrCoste: 60, apotecario: true, especiales: [],
    pos: {
      imperial_retainer:  { max: 16, coste: 45,  mv: 6, fu: 3, ag: 3, ps: 4, ar: 8,  hab: ['fend'] },
      imperial_thrower:   { max: 2,  coste: 75,  mv: 6, fu: 3, ag: 3, ps: 2, ar: 9,  hab: ['pass', 'give_and_go', 'pro'] },
      imperial_blitzer:   { max: 2,  coste: 90,  mv: 7, fu: 3, ag: 3, ps: 4, ar: 9,  hab: ['block', 'catch', 'pro'] },
      imperial_bodyguard: { max: 4,  coste: 85,  mv: 5, fu: 3, ag: 3, ps: 4, ar: 9,  hab: ['stand_firm', 'wrestle'] },
      imperial_ogre:      { max: 1,  coste: 140, mv: 5, fu: 5, ag: 4, ps: 5, ar: 10, hab: ['bone_head', 'loner_3', 'mighty_blow', 'thick_skull', 'throw_team_mate'], grande: true },
    },
  },

  // source/teams/orcos-negros.md — el Troll Adiestrado NO lleva Solitario
  black_orc: {
    rrCoste: 60, apotecario: true, especiales: ['brawlin_brutes', 'bribery_and_corruption'],
    pos: {
      black_orc_goblin:  { max: 16, coste: 45,  mv: 6, fu: 2, ag: 3, ps: 4, ar: 8,  hab: ['dodge', 'right_stuff', 'stunty', 'thick_skull'] },
      black_orc_blocker: { max: 6,  coste: 90,  mv: 4, fu: 4, ag: 4, ps: 5, ar: 10, hab: ['brawler', 'grab'] },
      black_orc_troll:   { max: 1,  coste: 115, mv: 4, fu: 5, ag: 5, ps: 5, ar: 10, hab: ['always_hungry', 'mighty_blow', 'projectile_vomit', 'really_stupid', 'regeneration', 'throw_team_mate'], grande: true },
    },
  },

  // source/teams/skavens.md
  skaven: {
    rrCoste: 50, apotecario: true, especiales: [],
    pos: {
      skaven_lineman:       { max: 16, coste: 50,  mv: 7, fu: 3, ag: 3, ps: 4, ar: 8, hab: [] },
      skaven_thrower:       { max: 2,  coste: 80,  mv: 7, fu: 3, ag: 3, ps: 2, ar: 8, hab: ['sure_hands', 'pass'] },
      skaven_gutter_runner: { max: 2,  coste: 85,  mv: 9, fu: 2, ag: 2, ps: 4, ar: 8, hab: ['stab', 'dodge'] },
      skaven_blitzer:       { max: 2,  coste: 90,  mv: 8, fu: 3, ag: 3, ps: 4, ar: 9, hab: ['block', 'strip_ball'] },
      skaven_rat_ogre:      { max: 1,  coste: 150, mv: 6, fu: 5, ag: 4, ps: 6, ar: 9, hab: ['animal_savagery', 'prehensile_tail', 'frenzy', 'mighty_blow', 'loner_4'], grande: true },
    },
  },

  // source/teams/union-elfica.md
  elven_union: {
    rrCoste: 50, apotecario: true, especiales: [],
    pos: {
      elven_union_lineman: { max: 16, coste: 65,  mv: 6, fu: 3, ag: 2, ps: 3, ar: 8, hab: ['fumblerooski'] },
      elven_union_thrower: { max: 2,  coste: 75,  mv: 6, fu: 3, ag: 2, ps: 2, ar: 8, hab: ['pass', 'hail_mary_pass'] },
      elven_union_catcher: { max: 2,  coste: 100, mv: 8, fu: 3, ag: 2, ps: 4, ar: 8, hab: ['catch', 'nerves_of_steel', 'diving_catch'] },
      elven_union_blitzer: { max: 2,  coste: 115, mv: 7, fu: 3, ag: 2, ps: 3, ar: 9, hab: ['side_step', 'block'] },
    },
  },
};
