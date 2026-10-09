// Pesos de la evaluación de posición (E3-S01).
//
// TODOS son hipótesis [PLACEHOLDER] hasta el playtest (GameDesigner: «ningún número
// mágico sin justificación»). La justificación de cada uno va al lado; el ajuste se
// hará midiendo con el arnés de semillas (E3-S06), no a ojo.

export const PESOS = {
  touchdown: 1000,        // un TD vale más que cualquier ventaja posicional
  posesion: 220,          // tener el balón es la mitad del juego
  avancePorFila: 12,      // cada fila hacia la zona rival con el balón en la mano
  balonSueltoCerca: 6,    // por casilla de ventaja en la carrera al balón suelto
  jugadorDePie: 25,       // un jugador útil en el campo
  jugadorTumbado: 10,     // en el campo, pero pierde la activación levantándose
  jugadorAturdido: 4,     // casi un cero hasta su siguiente turno
  escoltaDelPortador: 14, // compañero de pie adyacente al portador (la «caja»)
  marcaAlPortador: 30,    // rival que marca al propio portador: riesgo de perderlo
  turnosPorJugar: 4,      // del turno 5 al 8 el avance pesa hasta el doble (8−4)/4
};
