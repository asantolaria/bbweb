// Geometría del campo. 15 casillas de ancho (x) por 26 de largo (y), en vertical:
// el equipo 0 defiende la mitad y ≥ 13 y anota en y = 0; el equipo 1 al revés.
//
// Fuente: source/tablas/fundamentos-y-principios.md §1 «El campo».

export const ANCHO = 15;
export const ALTO = 26;

export const enCampo = (x, y) => x >= 0 && x < ANCHO && y >= 0 && y < ALTO;

/** Dirección de la plantilla de dirección aleatoria (D8), como en la caja del juego. */
export const DIRECCIONES_D8 = {
  1: [-1, -1], 2: [0, -1], 3: [1, -1],
  4: [-1, 0],              5: [1, 0],
  6: [-1, 1],  7: [0, 1],  8: [1, 1],
};

export function adyacentes(x, y) {
  const out = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (enCampo(nx, ny)) out.push([nx, ny]);
    }
  }
  return out;
}

export const sonAdyacentes = (ax, ay, bx, by) =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by)) === 1;

/** Fila donde anota cada equipo (la zona de anotación RIVAL). */
export const filaAnotacion = (equipo) => (equipo === 0 ? 0 : ALTO - 1);

/** Fila de la línea de placajes iniciales de cada equipo (su lado de la línea central). */
export const filaLos = (equipo) => (equipo === 0 ? 13 : 12);

/** ¿La casilla está en la mitad propia del equipo? */
export const enMitadPropia = (equipo, y) => (equipo === 0 ? y >= 13 : y <= 12);

/** Zonas anchas: las franjas laterales de 4 casillas. */
export const enZonaAncha = (x) => x <= 3 || x >= ANCHO - 4;

/** Campo central: entre las dos zonas anchas. */
export const enCampoCentral = (x) => x > 3 && x < ANCHO - 4;
