// Evaluación de posición (E3-S01): ¿cómo de bien está este equipo?
//
// La IA lee el motor; el motor no conoce a la IA. Regla de la casa, heredada del motor:
// ninguna puntuación sin motivo. evaluar() devuelve el total Y sus términos, cada uno
// con su porqué, para que cualquier decisión de la IA se pueda justificar en pantalla.
//
// Antisimétrica por construcción: evaluar(e, 0).total === -evaluar(e, 1).total. Se
// puntúa cada bando por separado y se resta.

import { PESOS as P } from './pesos.js';
import { filaAnotacion, sonAdyacentes } from '../engine/tablero.js';
import { marcadoresDe, posicionBalon, tieneZonaDefensa } from '../engine/partido.js';

/** Puntuación de UN bando, con sus términos. */
function puntuarBando(estado, equipo) {
  const t = [];
  const add = (v, porque) => { if (v) t.push({ v, porque }); };
  const E = estado.equipos[equipo];
  const mios = Object.values(estado.jugadores).filter((j) => j.equipo === equipo);

  add(E.marcador * P.touchdown, `${E.marcador} touchdown(s)`);

  // Jugadores en el campo según su postura.
  let dePie = 0, tumbados = 0, aturdidos = 0;
  for (const j of mios) {
    if (j.situacion !== 'campo') continue;
    if (j.postura === 'de_pie' || j.postura === 'distraido') dePie++;
    else if (j.postura === 'tumbado') tumbados++;
    else if (j.postura === 'aturdido') aturdidos++;
  }
  add(dePie * P.jugadorDePie, `${dePie} jugadores de pie`);
  add(tumbados * P.jugadorTumbado, `${tumbados} tumbados`);
  add(aturdidos * P.jugadorAturdido, `${aturdidos} aturdidos`);

  // Posesión: avance hacia la zona rival, escolta y peligro sobre el portador.
  const portadorId = estado.balon?.portador;
  const portador = portadorId ? estado.jugadores[portadorId] : null;
  if (portador && portador.equipo === equipo && portador.situacion === 'campo') {
    add(P.posesion, 'tiene el balón');
    const meta = filaAnotacion(equipo);
    const filasRecorridas = 25 - Math.abs(portador.y - meta);
    // En la recta final de la parte (turno 5+), avanzar con el balón vale más: el TD
    // que no llega antes del descanso se pierde.
    const prisa = 1 + Math.max(0, E.turno - 4) / P.turnosPorJugar;
    add(Math.round(filasRecorridas * P.avancePorFila * prisa), `portador a ${Math.abs(portador.y - meta)} filas de anotar`);
    const escolta = mios.filter((c) => c.id !== portador.id && tieneZonaDefensa(c)
      && sonAdyacentes(c.x, c.y, portador.x, portador.y)).length;
    add(escolta * P.escoltaDelPortador, `${escolta} compañeros escoltan al portador`);
    const acoso = marcadoresDe(estado, equipo, portador.x, portador.y).length;
    add(-acoso * P.marcaAlPortador, `${acoso} rivales marcan al portador`);
  }

  // Balón suelto: ventaja en la carrera (distancia del propio más cercano de pie).
  const b = posicionBalon(estado);
  if (b && !portadorId) {
    const dist = (j) => Math.max(Math.abs(j.x - b.x), Math.abs(j.y - b.y));
    const cercania = mios.filter(tieneZonaDefensa).map(dist);
    if (cercania.length) {
      const masCercano = Math.min(...cercania);
      add(Math.max(0, 12 - masCercano) * P.balonSueltoCerca, `el más cercano al balón suelto está a ${masCercano}`);
    }
  }
  return t;
}

/**
 * Evaluación de la posición desde el punto de vista de `equipo`.
 * @returns {{ total: number, propios: Array, rivales: Array }}
 */
export function evaluar(estado, equipo) {
  const propios = puntuarBando(estado, equipo);
  const rivales = puntuarBando(estado, 1 - equipo);
  const suma = (t) => t.reduce((n, x) => n + x.v, 0);
  return { total: suma(propios) - suma(rivales), propios, rivales };
}
