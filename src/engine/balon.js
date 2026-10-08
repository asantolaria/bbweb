// El balón: rebote, dispersión, atrapar y saque de banda.
//
// Fuentes: source/tablas/fundamentos-y-principios.md («Desvío, Dispersión y Rebote»)
// y source/tablas/acciones-y-modificadores.md («Atrapar», «Saque de banda»).

import { tirar, tirar2D6, chequeo } from './dice.js';
import { DIRECCIONES_D8, enCampo, ANCHO, ALTO } from './tablero.js';
import { enCasilla, marcadoresDe, tieneZonaDefensa, anotar } from './partido.js';
import { tiene } from '../data/habilidades.js';

/**
 * Chequeo de atrapar. El jugador DEBE intentarlo si el balón le llega.
 * Modificadores: −1 si rebotó, −1 si viene de saque de banda, −1 por rival que marque
 * al receptor, −1 con Lluvia. Tumbados, aturdidos o distraídos fallan automáticamente.
 * Atrapar (Catch) permite repetir el chequeo fallido.
 */
export function intentarAtrapar(estado, j, { rebotado = false, saqueDeBanda = false, azar }) {
  if (!tieneZonaDefensa(j)) {
    anotar(estado, 'atrapar_imposible', { jugador: j.id, porque: `está ${j.postura}` });
    return { exito: false, automatico: true };
  }
  const mods = [];
  if (rebotado) mods.push({ v: -1, porque: 'el balón rebotó' });
  if (saqueDeBanda) mods.push({ v: -1, porque: 'viene de un saque de banda' });
  for (const m of marcadoresDe(estado, j.equipo, j.x, j.y)) {
    mods.push({ v: -1, porque: `${m.id} marca al receptor` });
  }
  if (estado.clima === 'pouring_rain') mods.push({ v: -1, porque: 'Lluvia torrencial' });

  let c = chequeo({ objetivo: j.perfil.ag, mods, azar, motivo: `atrapar (${j.id})` });
  anotar(estado, 'atrapar', { jugador: j.id, chequeo: c });
  if (!c.exito && tiene(j.hab, 'catch')) {
    c = chequeo({ objetivo: j.perfil.ag, mods, azar, motivo: `atrapar (${j.id}, repite por Atrapar)` });
    anotar(estado, 'atrapar_reroll', { jugador: j.id, habilidad: 'catch', chequeo: c });
  }
  if (c.exito) estado.balon = { portador: j.id };
  return { exito: c.exito, chequeo: c };
}

/**
 * Rebote: Dispersión (1) desde una casilla. Si acaba en un jugador, este intenta
 * atraparlo; si la casilla está vacía queda en el suelo; si sale del campo, saque de
 * banda. Devuelve dónde terminó y quién lo tiene (si alguien).
 */
export function rebotar(estado, desdeX, desdeY, { azar }) {
  const d8 = tirar(8, { azar, motivo: 'rebote' });
  const [dx, dy] = DIRECCIONES_D8[d8.valor];
  const x = desdeX + dx, y = desdeY + dy;
  anotar(estado, 'rebote', { d8: d8.valor, a: [x, y] });

  if (!enCampo(x, y)) return saqueDeBanda(estado, desdeX, desdeY, { azar });

  const j = enCasilla(estado, x, y);
  if (j) {
    const r = intentarAtrapar(estado, j, { rebotado: true, azar });
    if (r.exito) return { x, y, portador: j.id };
    return rebotar(estado, x, y, { azar }); // falló: vuelve a rebotar desde ahí
  }
  estado.balon = { x, y };
  return { x, y, portador: null };
}

/**
 * Saque de banda: plantilla sobre la última casilla que ocupó el balón, 1D6 para la
 * dirección (tres opciones hacia dentro del campo) y 2D6 casillas de viaje contando la
 * del logo como la primera. En esquina, 1D3 entre las tres direcciones hacia dentro.
 */
export function saqueDeBanda(estado, x, y, { azar }) {
  const dirs = direccionesHaciaDentro(x, y);
  let dir;
  if (dirs.length === 3 && (x === 0 || x === ANCHO - 1) && (y === 0 || y === ALTO - 1)) {
    const d3 = Math.ceil(azar(6) / 2);
    dir = dirs[d3 - 1];
    anotar(estado, 'saque_banda_direccion', { dado: 'D3', valor: d3 });
  } else {
    const d6 = azar(6);
    dir = dirs[Math.min(2, Math.floor((d6 - 1) / 2))];
    anotar(estado, 'saque_banda_direccion', { dado: 'D6', valor: d6 });
  }
  const dist = tirar2D6({ azar, motivo: 'distancia del saque de banda' });

  // «El balón viaja 2D6 casillas; la primera es la del logo»: desplazamiento neto 2D6−1.
  let bx = x + dir[0] * (dist.valor - 1);
  let by = y + dir[1] * (dist.valor - 1);
  anotar(estado, 'saque_banda', { desde: [x, y], direccion: dir, dados: dist.dados, a: [bx, by] });

  if (!enCampo(bx, by)) {
    // Vuelve a salir: se repite desde la última casilla del campo que sobrevoló.
    let ux = x, uy = y;
    while (enCampo(ux + dir[0], uy + dir[1]) &&
           (Math.abs(ux + dir[0] - x) <= Math.abs(bx - x)) && (Math.abs(uy + dir[1] - y) <= Math.abs(by - y))) {
      ux += dir[0]; uy += dir[1];
    }
    return saqueDeBanda(estado, ux, uy, { azar });
  }

  const j = enCasilla(estado, bx, by);
  if (j) {
    const r = intentarAtrapar(estado, j, { saqueDeBanda: true, azar });
    if (r.exito) return { x: bx, y: by, portador: j.id };
    return rebotar(estado, bx, by, { azar });
  }
  estado.balon = { x: bx, y: by };
  return { x: bx, y: by, portador: null };
}

/** Las tres direcciones «hacia dentro» de la plantilla de saque desde un borde. */
export function direccionesHaciaDentro(x, y) {
  const haciaX = x === 0 ? 1 : x === ANCHO - 1 ? -1 : 0;
  const haciaY = y === 0 ? 1 : y === ALTO - 1 ? -1 : 0;
  if (haciaX && haciaY) return [[haciaX, 0], [haciaX, haciaY], [0, haciaY]]; // esquina
  if (haciaX) return [[haciaX, -1], [haciaX, 0], [haciaX, 1]];               // banda lateral
  return [[-1, haciaY], [0, haciaY], [1, haciaY]];                           // fondo
}

/** Si el jugador llevaba el balón, se le cae y rebota desde su casilla. */
export function soltarBalon(estado, j, { azar }) {
  if (estado.balon?.portador === j.id) {
    estado.balon = null;
    anotar(estado, 'balon_suelto', { jugador: j.id });
    return rebotar(estado, j.x, j.y, { azar });
  }
  return null;
}
