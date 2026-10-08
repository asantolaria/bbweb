// Armadura, Heridas, Lesiones y Heridas permanentes.
//
// Fuente: source/tablas/heridas-y-lesiones.md
//
// Convenio del proyecto (ADR 002): los identificadores van en inglés porque es la clave
// estable entre fuentes de datos; el castellano vive en la capa de nombres. El código y
// los comentarios van en castellano.

import { tirar, tirar2D6, consultarTabla } from './dice.js';

/**
 * Peores valores posibles de cada característica: una reducción que los rebasaría no se
 * aplica. MV, FU y AR empeoran bajando; AG y PS empeoran subiendo.
 */
export const MINIMOS = { mv: 1, fu: 1, ar: 3 };   // suelo de los que empeoran bajando
export const MAXIMOS = { ag: 6, ps: 6 };          // techo de los que empeoran subiendo

export const TABLA_HERIDAS = {
  nombre: 'injury',
  filas: [
    [2, 7, 'stunned', 'Queda Aturdido en su casilla.'],
    [8, 9, 'ko', 'A la casilla de Inconscientes.'],
    [10, 12, 'casualty', 'A la casilla de Lesionados; se tira en la Tabla de Lesiones.'],
  ],
};

/** Se usa en lugar de la normal si el jugador tiene el rasgo Escurridizo (Stunty). */
export const TABLA_HERIDAS_ESCURRIDIZOS = {
  nombre: 'injury_stunty',
  filas: [
    [2, 6, 'stunned', 'Queda Aturdido en su casilla.'],
    [7, 8, 'ko', 'A la casilla de Inconscientes.'],
    // El 9 es Lesión, pero con el resultado ya decidido: no se tira en la tabla D16.
    [9, 9, 'casualty', 'Magullado automático, sin tirar en la Tabla de Lesiones.'],
    [10, 12, 'casualty', 'A la casilla de Lesionados; se tira en la Tabla de Lesiones.'],
  ],
};

export const TABLA_LESIONES = {
  nombre: 'casualty',
  filas: [
    [1, 8, 'badly_hurt', 'Sin secuelas a largo plazo.'],
    [9, 10, 'seriously_hurt', 'Se pierde el próximo partido.'],
    [11, 12, 'serious_injury', 'Lesión mal curada y se pierde el próximo partido.'],
    [13, 14, 'lasting_injury', 'Reducción de atributo y se pierde el próximo partido.'],
    [15, 16, 'dead', 'Se borra del roster.'],
  ],
};

export const TABLA_PERMANENTES = {
  nombre: 'lasting',
  filas: [
    [1, 2, 'ar', 'Cabeza fracturada: −1 AR'],
    [3, 3, 'mv', 'Rodilla aplastada: −1 MV'],
    [4, 4, 'ps', 'Brazo roto: −1 PS'],
    [5, 5, 'ag', 'Cadera dislocada: −1 AG'],
    [6, 6, 'fu', 'Rotura de hombro: −1 FU'],
  ],
};

/**
 * Tirada de Armadura: 2D6 contra el AR del jugador. Iguala o supera → rota.
 *
 * Los modificadores llegan con su motivo (Golpe mortífero, apoyos de una Falta…).
 * Las dobles naturales importan fuera de aquí: en una Falta expulsan al atacante.
 */
export function tiradaArmadura({ ar, mods = [], azar }) {
  const t = tirar2D6({ azar, motivo: 'armadura' });
  const suma = mods.reduce((n, m) => n + m.v, 0);
  const total = t.valor + suma;
  return { ...t, ar, mods, suma, total, rota: total >= ar, dobles: t.dobles };
}

/**
 * Tirada de Heridas: 2D6 contra la tabla que corresponda.
 * `escurridizo` cambia de tabla por completo, no añade un modificador.
 */
export function tiradaHeridas({ escurridizo = false, mods = [], azar }) {
  const tabla = escurridizo ? TABLA_HERIDAS_ESCURRIDIZOS : TABLA_HERIDAS;
  const t = tirar2D6({ azar, motivo: 'heridas' });
  const suma = mods.reduce((n, m) => n + m.v, 0);
  const total = t.valor + suma;
  const fila = consultarTabla(tabla, Math.max(2, Math.min(12, total)));

  // En la tabla de Escurridizos el 9 es Lesión ya resuelta: Magullado sin tirar el D16.
  const automatico = escurridizo && total === 9 ? 'badly_hurt' : null;

  return { ...t, tabla: tabla.nombre, mods, suma, total, resultado: fila.nombre, automatico, efecto: fila.efecto };
}

/**
 * Tabla de Lesiones (D16). `malCuradas` son las Lesiones mal curadas que ya arrastra el
 * jugador: cada una suma +1 a esta tirada.
 */
export function tiradaLesion({ malCuradas = 0, azar }) {
  const t = tirar(16, { azar, motivo: 'lesión' });
  const total = t.valor + malCuradas;
  const mods = malCuradas ? [{ v: malCuradas, porque: `${malCuradas} Lesión(es) mal curada(s)` }] : [];
  const fila = consultarTabla(TABLA_LESIONES, Math.min(16, total));
  return { ...t, mods, total, resultado: fila.nombre, efecto: fila.efecto };
}

/**
 * Tabla de Heridas permanentes (D6). Si la característica ya está en su peor valor la
 * reducción no se aplica y el resultado pasa a ser «se pierde el próximo partido»
 * («Nuffle cree que ya ha sufrido bastante»).
 *
 * Cuidado: AG, PS y AR se escriben los tres como «X+», pero no empeoran igual.
 *   · AG y PS son objetivos que el propio jugador tiene que sacar → peor es SUBIR
 *     (3+ → 4+), hasta un tope de 6+.
 *   · AR es el objetivo que el RIVAL tiene que sacar para romper la armadura → peor es
 *     BAJAR (9+ → 8+), hasta un suelo de 3+, igual que MV y FU.
 * El repo de reglas lo marca anotando «el objetivo sube» solo en Brazo roto y Cadera
 * dislocada; en Cabeza fracturada no.
 */
export function tiradaPermanente({ perfil, azar }) {
  const t = tirar(6, { azar, motivo: 'herida permanente' });
  const fila = consultarTabla(TABLA_PERMANENTES, t.valor);
  const attr = fila.nombre;
  const empeoraSubiendo = attr === 'ag' || attr === 'ps';
  const actual = perfil[attr];

  const nuevo = empeoraSubiendo ? actual + 1 : actual - 1;
  const aplicable = empeoraSubiendo ? nuevo <= MAXIMOS[attr] : nuevo >= MINIMOS[attr];

  return {
    ...t, atributo: attr, descripcion: fila.efecto, empeoraSubiendo,
    aplicable, de: actual, a: aplicable ? nuevo : actual,
    resultado: aplicable ? 'lasting_injury' : 'seriously_hurt',
    nota: aplicable ? null : `${attr.toUpperCase()} ya está en su peor valor: pasa a perderse el próximo partido.`,
  };
}

/**
 * Herido por el público: empujado fuera del campo. Tirada de Heridas **sin** Armadura,
 * y un Aturdido se convierte en ir a Reservas (no se queda tumbado en un campo del que
 * ya ha salido).
 */
export function heridoPorElPublico({ escurridizo = false, azar }) {
  const h = tiradaHeridas({ escurridizo, azar });
  return { ...h, destino: h.resultado === 'stunned' ? 'reserves' : h.resultado, porElPublico: true };
}
