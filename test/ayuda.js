/** Dado guionizado: devuelve los valores en el orden dado. Agota = error, no silencio. */
export function dadoGuionizado(...valores) {
  const cola = valores.flat();
  let i = 0;
  return () => {
    if (i >= cola.length) throw new Error(`El guion de dados se agotó tras ${cola.length} tiradas`);
    return cola[i++];
  };
}

/** Dado fijo: siempre la misma cara. */
export const dadoFijo = (v) => () => v;
