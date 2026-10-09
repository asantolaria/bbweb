// La partida dentro del enlace.
//
// Ver docs/design/adr-001-multijugador-por-enlace.md. El estado completo se comprime y
// viaja en el **fragmento** de la URL, que el navegador nunca envía al servidor: la
// partida no sale de los dos móviles ni aparece en ningún log.
//
// El formato del enlace es una API pública: en cuanto alguien tenga un enlace guardado
// en una conversación, cambiar la forma del estado lo rompe. Por eso lleva versión y por
// eso el cargador prefiere fallar con un mensaje claro antes que adivinar.

export const VERSION_ESTADO = 1;

const b64urlDesdeBytes = (bytes) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const bytesDesdeB64url = (txt) => {
  const s = atob(txt.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
};

const pasarPor = async (bytes, stream) =>
  new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

/** Comprime el estado y devuelve la carga lista para el fragmento (`1.H4sIA...`). */
export async function empaquetar(estado) {
  const json = new TextEncoder().encode(JSON.stringify(estado));
  const gz = await pasarPor(json, new CompressionStream('gzip'));
  return `${VERSION_ESTADO}.${b64urlDesdeBytes(gz)}`;
}

/** Deshace `empaquetar`. Lanza con un mensaje para el jugador, no para el programador. */
export async function desempaquetar(carga) {
  const punto = String(carga).indexOf('.');
  if (punto < 1) throw new Error('Este enlace no contiene una partida.');

  const version = Number(carga.slice(0, punto));
  if (!Number.isInteger(version)) throw new Error('Este enlace no contiene una partida.');
  if (version > VERSION_ESTADO) {
    throw new Error(
      `Este enlace viene de una versión más nueva de la app (formato ${version}, aquí se entiende hasta el ${VERSION_ESTADO}). Actualiza y vuelve a abrirlo.`,
    );
  }
  if (version < VERSION_ESTADO) {
    throw new Error(
      `Este enlace es de un formato antiguo (${version}) que esta versión ya no sabe leer. La partida tendrá que empezarse de nuevo.`,
    );
  }

  let json;
  try {
    const bytes = bytesDesdeB64url(carga.slice(punto + 1));
    json = new TextDecoder().decode(await pasarPor(bytes, new DecompressionStream('gzip')));
  } catch {
    throw new Error('El enlace está incompleto o se ha copiado a medias.');
  }

  try {
    return JSON.parse(json);
  } catch {
    throw new Error('El enlace está incompleto o se ha copiado a medias.');
  }
}

/**
 * El tramo del registro que el receptor del enlace no ha visto: desde el primer
 * marcador de turno RIVAL del tramo final (tras el último turno propio del receptor)
 * hasta el final. Es a la vez el recorte del enlace y el guion de la repetición.
 */
export function tramoRival(registro, nombreReceptor) {
  if (!registro?.length) return [];
  let inicio = -1;
  let finalVisto = false;
  for (let i = registro.length - 1; i >= 0; i--) {
    const ev = registro[i];
    if (ev.tipo !== 'turno') continue;
    if (ev.equipo === nombreReceptor) {
      // El último marcador es el turno NUEVO del receptor: se salta; el siguiente hacia
      // atrás es su turno anterior, donde dejó de mirar.
      if (!finalVisto && i === registro.map((x) => x.tipo).lastIndexOf('turno')) { finalVisto = true; continue; }
      break;
    }
    inicio = i;
  }
  return inicio === -1 ? [] : registro.slice(inicio);
}

/** Tope de eventos que viajan en el enlace (≈16 caracteres comprimidos por evento). */
export const MAX_EVENTOS_ENLACE = 150;

/**
 * Copia del estado con el registro recortado para viajar: el tramo que el rival no ha
 * visto (más un pequeño colchón), nunca más de MAX_EVENTOS_ENLACE. El historial
 * completo se queda en el dispositivo del que envía; el campo `registroRecortado`
 * avisa de cuántos eventos se quedaron atrás.
 */
export function recortarParaEnlace(estado) {
  const reg = estado.registro ?? [];
  if (reg.length <= MAX_EVENTOS_ENLACE) return estado;
  const nombreReceptor = estado.equipos?.[estado.activo]?.nombre;
  const tramo = tramoRival(reg, nombreReceptor);
  // Se conserva el tramo rival entero (o una cola de cortesía si no lo hay), sin
  // superar nunca el tope: manda el más cercano al final de los dos puntos de corte.
  const inicioTramo = tramo.length ? reg.indexOf(tramo[0]) : reg.length - 40;
  const inicio = Math.max(0, reg.length - MAX_EVENTOS_ENLACE, Math.min(inicioTramo, reg.length));
  return { ...estado, registro: reg.slice(inicio), registroRecortado: inicio };
}

/** Construye el enlace que se le pasa al rival. */
export async function aEnlace(estado, base) {
  const url = new URL(base);
  url.hash = `g=${await empaquetar(recortarParaEnlace(estado))}`;
  return url.toString();
}

/** Lee la partida de un enlace, o `null` si no trae ninguna (visita normal a la web). */
export async function desdeEnlace(href) {
  const hash = new URL(href).hash.replace(/^#/, '');
  const campo = new URLSearchParams(hash).get('g');
  return campo ? desempaquetar(campo) : null;
}
