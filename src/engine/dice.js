// Dados y chequeos.
//
// Aquí no vive ninguna regla de Blood Bowl: solo el procedimiento de tirar y la
// aritmética de modificadores, que es común a todo el reglamento. Las reglas dicen
// QUÉ modificadores aplican; este módulo sabe qué hacer con ellos.
//
// Fuente: source/tablas/fundamentos-y-principios.md §6 «Principios generales».

/** Generador por defecto: criptográfico, no `Math.random`. */
export function azarReal(caras) {
  const a = new Uint32Array(1);
  // Rechazo del resto para que las caras sean equiprobables (sin sesgo del módulo).
  const limite = Math.floor(0x100000000 / caras) * caras;
  let n;
  do { crypto.getRandomValues(a); n = a[0]; } while (n >= limite);
  return (n % caras) + 1;
}

/**
 * Generador reproducible a partir de una semilla (xorshift32).
 * Solo para tests y para la IA de la fase 2: una partida real usa `azarReal`.
 */
export function azarConSemilla(semilla) {
  let s = semilla >>> 0 || 1;
  return (caras) => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;  s >>>= 0;
    return (s % caras) + 1;
  };
}

/** Una tirada suelta, con su registro. */
export function tirar(caras, { azar = azarReal, motivo = '' } = {}) {
  const valor = azar(caras);
  return { dado: `D${caras}`, valor, motivo };
}

/** 2D6: devuelve los dos dados y la suma. Se usa en Armadura, Heridas y las tablas. */
export function tirar2D6({ azar = azarReal, motivo = '' } = {}) {
  const a = azar(6), b = azar(6);
  return { dado: '2D6', dados: [a, b], valor: a + b, dobles: a === b, motivo };
}

/** D3 = 1D6 / 2 redondeando hacia arriba. */
export function tirarD3({ azar = azarReal, motivo = '' } = {}) {
  const d6 = azar(6);
  return { dado: 'D3', d6, valor: Math.ceil(d6 / 2), motivo };
}

/**
 * Cuánto hay que sacar de forma natural para superar un chequeo.
 *
 * Dos reglas acotan el resultado y por eso nunca se pide menos de 2 ni más de 6:
 * «1 natural = fallo» y «6 natural = éxito», pase lo que pase con los modificadores.
 */
export function naturalNecesario(objetivo, suma) {
  return Math.max(2, Math.min(6, objetivo - suma));
}

/**
 * Un chequeo de característica (AG, PS, Forzar la marcha, Estúpido…): 1D6 contra un
 * objetivo X+, con modificadores que han de venir **con su motivo**.
 *
 * El motivo no es decoración: el PRD exige que cualquier tirada se pueda justificar en
 * pantalla, así que un modificador sin explicación es un error de programación.
 *
 *   chequeo({ objetivo: 3, mods: [{ v: -1, porque: 'Línea Orco marca el destino' }] })
 *
 * @returns {{valor:number, objetivo:number, mods:Array, suma:number, necesario:number,
 *            modificado:number, exito:boolean, natural1:boolean, natural6:boolean}}
 */
export function chequeo({ objetivo, mods = [], azar = azarReal, motivo = '' }) {
  for (const m of mods) {
    if (!m || typeof m.v !== 'number' || !m.porque) {
      throw new Error(`Modificador sin motivo en «${motivo || 'chequeo'}»: ` + JSON.stringify(m));
    }
  }
  const suma = mods.reduce((t, m) => t + m.v, 0);
  const valor = azar(6);

  // «Un D6 modificado nunca pasa de 6, pero sí puede bajar de 1» (errata mayo 2026):
  // el tope por arriba existe, el suelo por abajo no.
  const modificado = Math.min(6, valor + suma);

  const natural1 = valor === 1;
  const natural6 = valor === 6;
  const exito = natural6 ? true : natural1 ? false : modificado >= objetivo;

  return {
    dado: 'D6', valor, objetivo, mods, suma, modificado,
    necesario: naturalNecesario(objetivo, suma),
    exito, natural1, natural6, motivo,
  };
}

/** Tirada enfrentada: cada entrenador 1D6, se repiten los empates. Devuelve 0 o 1. */
export function tiradaEnfrentada({ azar = azarReal } = {}) {
  const rondas = [];
  for (;;) {
    const a = azar(6), b = azar(6);
    rondas.push([a, b]);
    if (a !== b) return { ganador: a > b ? 0 : 1, rondas };
    if (rondas.length > 100) throw new Error('Tirada enfrentada sin resolver');
  }
}

/** Resuelve una tabla de rangos (clima, patada inicial, heridas…) contra una tirada. */
export function consultarTabla(tabla, valor) {
  const fila = tabla.filas.find(([min, max]) => valor >= min && valor <= max);
  if (!fila) throw new Error(`${tabla.nombre}: ${valor} fuera de la tabla`);
  return { nombre: fila[2], efecto: fila[3], rango: [fila[0], fila[1]], valor };
}
