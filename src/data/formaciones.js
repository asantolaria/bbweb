// Formaciones de despliegue rápido.
//
// Las formas son las clásicas de la comunidad (los nombres varían según el autor):
//   · Ziggurat y variantes — talkfantasyfootball.org/viewtopic.php?t=29010
//   · Hilos de setups de bbtactics.com y la guía de formaciones de Goonhammer.
// FUMBBL ofrece la misma idea con sus «saved setups» por equipo.
//
// Cada casilla se expresa para el equipo que despliega: `x` absoluta (0-14, centro 7)
// y `df` = filas por detrás de su línea de placajes iniciales (0 = pegado a la línea).
// `rol` decide quién la ocupa:
//   linea  → los prescindibles: coste bajo primero (la línea se come los placajes)
//   muro   → los duros: FU y AR altos
//   ala    → los rápidos: MV alto
//   balon  → el que jugará el balón: Manos seguras / Pasar, luego AG
//
// Todas cumplen el reglamento: 3 en el campo central pegados a la línea y máximo 2
// por zona ancha. Con menos de 11 jugadores se rellenan por orden.

export const FORMACIONES = {
  ziggurat: {
    nombre: 'Ziggurat', lado: 'defensa',
    casillas: [
      { x: 6, df: 0, rol: 'linea' }, { x: 7, df: 0, rol: 'linea' }, { x: 8, df: 0, rol: 'linea' },
      { x: 4, df: 1, rol: 'muro' }, { x: 10, df: 1, rol: 'muro' },
      { x: 2, df: 2, rol: 'ala' }, { x: 12, df: 2, rol: 'ala' },
      { x: 6, df: 2, rol: 'muro' }, { x: 8, df: 2, rol: 'muro' },
      { x: 7, df: 2, rol: 'balon' },
      { x: 7, df: 4, rol: 'ala' },
    ],
  },
  chevron: {
    nombre: 'Chevrón', lado: 'defensa',
    casillas: [
      { x: 6, df: 0, rol: 'linea' }, { x: 7, df: 0, rol: 'linea' }, { x: 8, df: 0, rol: 'linea' },
      { x: 5, df: 1, rol: 'muro' }, { x: 9, df: 1, rol: 'muro' },
      { x: 4, df: 2, rol: 'muro' }, { x: 10, df: 2, rol: 'muro' },
      { x: 3, df: 3, rol: 'ala' }, { x: 11, df: 3, rol: 'ala' },
      { x: 7, df: 2, rol: 'balon' },
      { x: 7, df: 5, rol: 'ala' },
    ],
  },
  columnas: {
    nombre: 'Columnas 3-4-4', lado: 'defensa',
    casillas: [
      { x: 6, df: 0, rol: 'linea' }, { x: 7, df: 0, rol: 'linea' }, { x: 8, df: 0, rol: 'linea' },
      { x: 2, df: 2, rol: 'ala' }, { x: 5, df: 2, rol: 'muro' },
      { x: 9, df: 2, rol: 'muro' }, { x: 12, df: 2, rol: 'ala' },
      { x: 3, df: 4, rol: 'ala' }, { x: 6, df: 4, rol: 'muro' },
      { x: 8, df: 4, rol: 'balon' }, { x: 11, df: 4, rol: 'ala' },
    ],
  },
  caja: {
    nombre: 'Caja', lado: 'ataque',
    casillas: [
      { x: 6, df: 0, rol: 'linea' }, { x: 7, df: 0, rol: 'linea' }, { x: 8, df: 0, rol: 'linea' },
      { x: 6, df: 2, rol: 'muro' }, { x: 8, df: 2, rol: 'muro' },
      { x: 6, df: 4, rol: 'muro' }, { x: 8, df: 4, rol: 'muro' },
      { x: 7, df: 3, rol: 'balon' },
      { x: 2, df: 2, rol: 'ala' }, { x: 12, df: 2, rol: 'ala' },
      { x: 7, df: 6, rol: 'ala' },
    ],
  },
  lanzamiento: {
    nombre: 'Lanzamiento', lado: 'ataque',
    casillas: [
      { x: 6, df: 0, rol: 'linea' }, { x: 7, df: 0, rol: 'linea' }, { x: 8, df: 0, rol: 'linea' },
      { x: 1, df: 1, rol: 'ala' }, { x: 13, df: 1, rol: 'ala' },
      { x: 4, df: 2, rol: 'ala' }, { x: 10, df: 2, rol: 'ala' },
      { x: 7, df: 2, rol: 'muro' },
      { x: 5, df: 4, rol: 'muro' }, { x: 9, df: 4, rol: 'muro' },
      { x: 7, df: 7, rol: 'balon' },
    ],
  },
};

/**
 * Reparte a los jugadores disponibles entre las casillas de una formación.
 * Devuelve una lista [{ id, x, df }] lista para desplegar (quien llama traduce `df`
 * a la fila real según el equipo). No muta nada.
 */
export function asignarFormacion(formacion, jugadores, costes = {}) {
  const puntua = {
    linea: (j) => -(costes[j.pos] ?? 50) * 10 - j.perfil.fu,          // barato primero
    muro: (j) => j.perfil.fu * 100 + j.perfil.ar,                      // duro primero
    ala: (j) => j.perfil.mv * 100 - j.perfil.fu,                       // rápido primero
    balon: (j) => (j.hab.includes('sure_hands') ? 1000 : 0) + (j.hab.includes('pass') ? 800 : 0)
      + (j.hab.includes('dodge') ? 200 : 0) + (7 - j.perfil.ag) * 50 + j.perfil.mv,
  };
  const libres = [...jugadores];
  const salida = [];
  // El balón y la línea eligen primero (son los roles con requisitos); las alas después.
  const orden = ['balon', 'linea', 'muro', 'ala'];
  const porRol = orden.flatMap((rol) => formacion.casillas.filter((c) => c.rol === rol).map((c) => ({ ...c })));
  for (const slot of porRol) {
    if (!libres.length) break;
    libres.sort((a, b) => puntua[slot.rol](b) - puntua[slot.rol](a));
    const j = libres.shift();
    salida.push({ id: j.id, x: slot.x, df: slot.df });
  }
  return salida;
}
