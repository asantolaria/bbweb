// Los apoyos del placaje son la mecánica que más partidas decide y la más fácil de
// implementar mal. Esta batería cubre los casos retorcidos uno a uno.
//
// Regla (acciones-y-modificadores.md «Placaje»): +1 FU por cada compañero que marque
// al rival implicado y que NO esté marcado por ningún otro rival distinto de ese.

import test from 'node:test';
import assert from 'node:assert/strict';
import { crearEquipo } from '../src/engine/equipo.js';
import { ROSTERS_1000K } from '../src/data/rosters-iniciales.js';
import { crearPartido, jugador } from '../src/engine/partido.js';
import { apoyos, fuerzasPlacaje, placar } from '../src/engine/placaje.js';
import { dadoGuionizado, dadoFijo } from './ayuda.js';

function montar() {
  return crearPartido(
    crearEquipo('human', ROSTERS_1000K.human, { nombre: 'A' }),
    crearEquipo('chaos_chosen', ROSTERS_1000K.chaos_chosen, { nombre: 'B' }),
  );
}
function colocar(e, id, x, y, postura = 'de_pie') {
  const j = jugador(e, id);
  j.situacion = 'campo'; j.x = x; j.y = y; j.postura = postura;
  return j;
}
// hu7-12 Líneas humanas (FU 3) · ch5-11 Beastmen (FU 3) · ch2-4 Guerreros (FU 4).

test('el apoyo ofensivo exige marcar al objetivo y no estar marcado por nadie más', () => {
  const e = montar();
  const A = colocar(e, 'hu7', 7, 13);
  const O = colocar(e, 'ch5', 7, 12);
  const ayudante = colocar(e, 'hu8', 8, 12);     // marca al objetivo, limpio → apoya
  assert.equal(fuerzasPlacaje(e, A, O).fuA, 4, '3 + 1 apoyo');

  // Un beastman se pega al ayudante: el apoyo se esfuma.
  colocar(e, 'ch6', 9, 12);
  assert.equal(fuerzasPlacaje(e, A, O).fuA, 3, 'el ayudante está ocupado');

  // …salvo que ese beastman esté tumbado: los caídos no marcan.
  jugador(e, 'ch6').postura = 'tumbado';
  assert.equal(fuerzasPlacaje(e, A, O).fuA, 4);

  // Distraído tampoco marca.
  jugador(e, 'ch6').postura = 'distraido';
  assert.equal(fuerzasPlacaje(e, A, O).fuA, 4);
});

test('estar marcado por EL PROPIO objetivo no anula el apoyo', () => {
  const e = montar();
  const A = colocar(e, 'hu7', 7, 13);
  const O = colocar(e, 'ch5', 7, 12);
  // El ayudante está adyacente al objetivo (claro: lo marca) y a NADIE más.
  colocar(e, 'hu8', 6, 12);
  const ap = apoyos(e, A, O);
  assert.deepEqual(ap.ofensivos.map((j) => j.id), ['hu8']);
});

test('un jugador tumbado o distraído no puede dar apoyo aunque esté bien situado', () => {
  const e = montar();
  const A = colocar(e, 'hu7', 7, 13);
  const O = colocar(e, 'ch5', 7, 12);
  colocar(e, 'hu8', 8, 12, 'tumbado');
  colocar(e, 'hu9', 6, 12, 'distraido');
  assert.equal(apoyos(e, A, O).ofensivos.length, 0);
});

test('los apoyos defensivos funcionan igual, sobre el atacante', () => {
  const e = montar();
  const A = colocar(e, 'hu7', 7, 13);
  const O = colocar(e, 'ch5', 7, 12);
  const guardia = colocar(e, 'ch6', 8, 14);      // marca al atacante, limpio
  assert.equal(fuerzasPlacaje(e, A, O).fuO, 4, '3 + 1 defensivo');
  // Un humano marca al guardia → deja de apoyar.
  colocar(e, 'hu8', 9, 15);
  assert.equal(fuerzasPlacaje(e, A, O).fuO, 3);
});

test('apoyos cruzados a la vez: cada bando cuenta solo los suyos limpios', () => {
  const e = montar();
  // Pelea de masas: atacante con 2 ayudantes (1 limpio), defensor con 2 (1 limpio).
  const A = colocar(e, 'hu7', 7, 13);
  const O = colocar(e, 'ch5', 7, 12);
  colocar(e, 'hu8', 8, 12);                      // of. limpio → +1
  colocar(e, 'hu9', 6, 12); colocar(e, 'ch6', 5, 12);  // hu9 marcado por ch6: no apoya
  colocar(e, 'ch7', 6, 14);                      // def. limpio → +1
  colocar(e, 'ch8', 8, 14); colocar(e, 'hu10', 9, 15); // ch8 marcado por hu10: no apoya
  const f = fuerzasPlacaje(e, A, O);
  assert.equal(f.fuA, 4, '3 +1 (hu8)');
  assert.equal(f.fuO, 4, '3 +1 (ch7)');
  assert.equal(f.dados, 1, 'igualados: 1 dado');
  // Los motivos van con nombre y apellido.
  assert.match(f.modsA[0].porque, /apoyo ofensivo de hu8/);
  assert.match(f.modsO[0].porque, /apoyo defensivo de ch7/);
});

test('dos apoyos convierten un 3v4 en un 5v4: dos dados del lado débil en FU base', () => {
  const e = montar();
  const A = colocar(e, 'hu7', 7, 13);            // FU 3
  const O = colocar(e, 'ch2', 7, 12);            // Guerrero, FU 4
  colocar(e, 'hu8', 8, 12); colocar(e, 'hu9', 6, 12);
  const f = fuerzasPlacaje(e, A, O);
  assert.deepEqual([f.fuA, f.fuO, f.dados, f.elige], [5, 4, 2, 'atacante']);
});

test('tras un Piquete de ojos, el empujado no apoya hasta reactivarse', () => {
  const e = crearPartido(
    crearEquipo('shambling_undead', ROSTERS_1000K.shambling_undead, { nombre: 'U' }),
    crearEquipo('human', ROSTERS_1000K.human, { nombre: 'H' }),
  );
  const zombi = colocar(e, 'sh7', 7, 13);        // zombi con Piquete de ojos
  const victima = colocar(e, 'hu7', 7, 12);
  // El zombi empuja (dado 3): la víctima queda sin apoyos.
  placar(e, 'sh7', 'hu7', { azar: dadoGuionizado(3), opciones: { impulso: () => false } });
  assert.equal(victima.sinApoyos, true);
  // Ahora la víctima está junto a un compañero humano que ataca: no cuenta como apoyo.
  const atacado = colocar(e, 'sh8', victima.x + 1, victima.y);
  const atacante = colocar(e, 'hu8', atacado.x + 1, atacado.y);
  const ap = apoyos(e, atacante, atacado);
  assert.ok(!ap.ofensivos.some((j) => j.id === victima.id), 'el del piquete no apoya');
});
