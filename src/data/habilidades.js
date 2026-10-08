// Registro de habilidades y rasgos.
//
// Fuente: source/habilidades/*.md del repo bloodbowl-my-rosters (tablas «ES | Inglés»),
// que a su vez vienen de Nuffle Zone verificadas contra bloodbowlbase BB2025.
//
// Solo las que usan los 9 equipos iniciales; la lista crece con cada equipo nuevo.
// Convenio para habilidades con parámetro: `loner_3` = Solitario (3+). El helper
// `valorDe()` del motor extrae el número.
//
// `cat`: general | agility | strength | passing | mutation | trait.
// `elite`: las marcadas «Activa (Elite)» en la fuente.

export const HABILIDADES = {
  // General
  block:          { cat: 'general', elite: true },
  brawler:        { cat: 'strength' },             // Luchador
  fend:           { cat: 'general' },              // Zafarse
  frenzy:         { cat: 'general' },              // Furia
  pro:            { cat: 'general' },              // Profesional
  steady_footing: { cat: 'general' },              // Equilibrio firme
  strip_ball:     { cat: 'general' },              // Robar balón
  sure_hands:     { cat: 'general' },              // Manos seguras
  tackle:         { cat: 'general' },              // Placaje defensivo
  wrestle:        { cat: 'general' },              // Forcejear

  // Agilidad
  catch:          { cat: 'agility' },              // Atrapar
  diving_catch:   { cat: 'agility' },              // Recepción heroica
  dodge:          { cat: 'agility', elite: true }, // Esquivar
  side_step:      { cat: 'agility' },              // Echarse a un lado

  // Fuerza
  arm_bar:        { cat: 'strength' },             // Llave de brazo
  grab:           { cat: 'strength' },             // Apartar
  juggernaut:     { cat: 'strength' },             // Imparable
  mighty_blow:    { cat: 'strength', elite: true },// Golpe mortífero
  stand_firm:     { cat: 'strength' },             // Mantenerse firme
  thick_skull:    { cat: 'strength' },             // Cabeza dura

  // Pase
  cloud_burster:  { cat: 'passing' },              // Partenubes
  give_and_go:    { cat: 'passing' },              // Pasar y seguir
  hail_mary_pass: { cat: 'passing' },              // Pase a lo loco
  nerves_of_steel:{ cat: 'passing' },              // Nervios de acero
  on_the_ball:    { cat: 'passing' },              // Atento al balón
  pass:           { cat: 'passing' },              // Pasar
  safe_pass:      { cat: 'passing' },              // Pase seguro

  // Mutaciones
  claws:          { cat: 'mutation' },             // Garras
  horns:          { cat: 'mutation' },             // Cuernos
  prehensile_tail:{ cat: 'mutation' },             // Cola prensil

  // Rasgos
  animal_savagery:  { cat: 'trait' },              // Ferocidad animal
  always_hungry:    { cat: 'trait' },              // Siempre hambriento
  bone_head:        { cat: 'trait' },              // Estúpido
  eye_gouge:        { cat: 'trait' },              // Piquete de ojos
  fumblerooski:     { cat: 'trait' },              // Dejada
  loner_3:          { cat: 'trait', base: 'loner', x: 3 }, // Solitario (3+)
  loner_4:          { cat: 'trait', base: 'loner', x: 4 }, // Solitario (4+)
  my_ball:          { cat: 'trait' },              // El balón es mío
  projectile_vomit: { cat: 'trait' },              // Proyectil de vómito
  really_stupid:    { cat: 'trait' },              // Realmente estúpido
  regeneration:     { cat: 'trait' },              // Regeneración
  right_stuff:      { cat: 'trait' },              // Humanoide bala
  shadowing:        { cat: 'trait' },              // Perseguir
  stab:             { cat: 'trait' },              // Apuñalar
  stunty:           { cat: 'trait' },              // Escurridizo
  throw_team_mate:  { cat: 'trait' },              // Lanzar compañero
  unchannelled_fury:{ cat: 'trait' },              // Ira descontrolada
  unsteady:         { cat: 'trait' },              // Tembloroso
};

/** ¿Tiene el jugador esta habilidad? Las parametrizadas se buscan por su base. */
export const tiene = (habilidades, id) =>
  habilidades.includes(id) || habilidades.some((h) => HABILIDADES[h]?.base === id);

/** Parámetro de una habilidad parametrizada: valorDe(['loner_4'], 'loner') → 4. */
export const valorDe = (habilidades, base) => {
  const h = habilidades.find((x) => HABILIDADES[x]?.base === base);
  return h ? HABILIDADES[h].x : null;
};
