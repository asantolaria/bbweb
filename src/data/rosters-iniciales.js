// Rosters por defecto a 1.000k, partiendo de rosters/iniciales/ del repo
// bloodbowl-my-rosters (versión corregida, commit 0fde8fb: todos con 11+ jugadores).
//
// Única desviación respecto al repo, verificada contra bloodbowlbase BB2025
// (drafting_a_blood_bowl_team): los Hinchas cuestan 5k por punto y como mucho +3 al
// crear (se empieza con 1). Los rosters del repo aún los cobran a 10k —el precio de
// ayudantes/animadoras— y Nobleza lleva 6. Aquí esas compras se sustituyen por otras
// legales de igual importe para cerrar 1.000k exactos:
//
//   · Elegidos del Caos: 50k de hinchas → apotecario (50k).
//   · Humanos: 10k de 1 hincha → +2 hinchas legales (10k).
//   · Nobleza Imperial: su roster además suma los RR a 50k cuando su propio archivo
//     de equipo dice 60k. Con precios buenos: fuera hinchas y apotecario, entra
//     personal (2 ayudantes + 2 animadoras).
//   · Skavens: 20k de 2 hinchas → 2 ayudantes del entrenador (20k).
//
// `hinchas` = puntos COMPRADOS al crear (0–3); todo equipo empieza además con 1 de serie.

export const PRESUPUESTO = 1000;

export const ROSTERS_1000K = {
  // 790 jug. + 150 RR + 50 apo + 10 (2 hinchas) = 1000 · 12 jugadores
  human: {
    jugadores: { human_ogre: 1, human_blitzer: 2, human_catcher: 2, human_halfling: 1, human_lineman: 6 },
    rerolls: 3, apotecario: true, hinchas: 2,
  },
  // 850 jug. + 150 RR = 1000 · 11 jugadores (2 White Lion, 1 Guerrero Dragón, 8 Líneas)
  high_elf: {
    jugadores: { high_elf_blitzer: 2, high_elf_dragon_warrior: 1, high_elf_lineman: 8 },
    rerolls: 3,
  },
  // 800 jug. + 150 RR + 50 apo = 1000 · 11 jugadores
  chaos_chosen: {
    jugadores: { chaos_troll: 1, chaos_warrior: 3, chaos_beastman: 7 },
    rerolls: 3, apotecario: true,
  },
  // 930 jug. + 70 RR = 1000 · 11 jugadores
  lizardmen: {
    jugadores: { lizardmen_kroxigor: 1, lizardmen_saurus: 6, lizardmen_chameleon: 1, lizardmen_skink: 3 },
    rerolls: 1,
  },
  // 790 jug. + 210 RR = 1000 · 11 jugadores
  shambling_undead: {
    jugadores: { undead_mummy: 2, undead_wight: 2, undead_ghoul: 2, undead_zombie: 5 },
    rerolls: 3,
  },
  // 840 jug. + 120 RR + 20 ayudantes + 20 animadoras = 1000 · 11 jugadores
  // Ojo: el roster del repo suma los RR a 50k, pero el archivo del equipo dice 60k.
  // Con el precio bueno no cabe el apotecario; se cierra con personal.
  imperial_nobility: {
    jugadores: { imperial_ogre: 1, imperial_blitzer: 2, imperial_bodyguard: 4, imperial_retainer: 4 },
    rerolls: 2, ayudantes: 2, animadoras: 2,
  },
  // 880 jug. + 120 RR = 1000 · 12 jugadores
  black_orc: {
    jugadores: { black_orc_troll: 1, black_orc_blocker: 6, black_orc_goblin: 5 },
    rerolls: 2,
  },
  // 830 jug. + 150 RR + 20 (2 ayudantes) = 1000 · 11 jugadores
  skaven: {
    jugadores: { skaven_rat_ogre: 1, skaven_thrower: 1, skaven_blitzer: 2, skaven_gutter_runner: 2, skaven_lineman: 5 },
    rerolls: 3, ayudantes: 2,
  },
  // 850 jug. + 150 RR = 1000 · 11 jugadores
  elven_union: {
    jugadores: { elven_union_blitzer: 2, elven_union_catcher: 1, elven_union_lineman: 8 },
    rerolls: 3,
  },
};
