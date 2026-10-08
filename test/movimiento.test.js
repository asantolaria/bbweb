import test from 'node:test';
import assert from 'node:assert/strict';
import { crearEquipo } from '../src/engine/equipo.js';
import { ROSTERS_1000K } from '../src/data/rosters-iniciales.js';
import { crearPartido, jugador, marcadoresDe, estaMarcado } from '../src/engine/partido.js';
import { activar, paso, saltar, levantarse, terminarActivacion } from '../src/engine/movimiento.js';
import { resolverSuelo } from '../src/engine/derribo.js';
import { rebotar } from '../src/engine/balon.js';
import { dadoGuionizado, dadoFijo } from './ayuda.js';

/** Partido de prueba: Humanos (equipo 0) contra Hombres Lagarto (equipo 1). */
function partido(opts = {}) {
  return crearPartido(
    crearEquipo('human', ROSTERS_1000K.human, { nombre: 'A' }),
    crearEquipo('lizardmen', ROSTERS_1000K.lizardmen, { nombre: 'B' }),
    opts,
  );
}
function colocar(e, id, x, y, postura = 'de_pie') {
  const j = jugador(e, id);
  j.situacion = 'campo'; j.x = x; j.y = y; j.postura = postura;
  return j;
}
// Dorsales del roster humano: hu1 Ogro · hu2-3 Blitzer · hu4-5 Catcher · hu6 Halfling · hu7-12 Línea.
// Lagartos: li1 Kroxigor · li2-7 Saurio · li8 Camaleón · li9-11 Eslizón.

test('marcaje: los de pie marcan; tumbados, aturdidos y distraídos no', () => {
  const e = partido();
  colocar(e, 'hu4', 7, 13);
  colocar(e, 'li2', 7, 12);              // saurio de pie adyacente: marca
  colocar(e, 'li3', 8, 12, 'tumbado');   // tumbado: no marca
  colocar(e, 'li4', 6, 12, 'distraido'); // distraído: no marca
  const m = marcadoresDe(e, 0, 7, 13);
  assert.deepEqual(m.map((j) => j.id), ['li2']);
  assert.equal(estaMarcado(e, jugador(e, 'hu4')), true);
});

test('un paso a casilla libre sin marcaje no tira ningún dado', () => {
  const e = partido();
  colocar(e, 'hu4', 7, 13);
  activar(e, 'hu4', 'move', { azar: dadoFijo(6) });
  const r = paso(e, 7, 14, { azar: () => { throw new Error('no debería tirar'); } });
  assert.equal(r.exito, true);
  assert.equal(jugador(e, 'hu4').x, 7);
  assert.equal(jugador(e, 'hu4').y, 14);
  assert.equal(e.activacion.mvGastado, 1);
});

test('salir de una casilla marcada obliga a esquivar, con −1 por marcador del destino', () => {
  const e = partido();
  colocar(e, 'hu2', 7, 13);            // blitzer AG 3+, sin Esquivar
  colocar(e, 'li2', 7, 12);            // marca el origen
  colocar(e, 'li3', 8, 15);            // marca el destino (7,14)
  activar(e, 'hu2', 'move', { azar: dadoFijo(6) });
  // Necesita 4+ (AG 3+ con −1). Un 4 natural pasa.
  const r = paso(e, 7, 14, { azar: dadoGuionizado(4) });
  assert.equal(r.exito, true);
  const ev = e.registro.find((x) => x.tipo === 'esquivar');
  assert.equal(ev.chequeo.necesario, 4);
  assert.match(ev.chequeo.mods[0].porque, /li3 marca el destino/);
});

test('la habilidad Esquivar repite una esquiva fallida, solo una vez por activación', () => {
  const e = partido();
  colocar(e, 'hu4', 7, 13);            // catcher con Esquivar
  colocar(e, 'li2', 7, 12);
  colocar(e, 'li3', 7, 15);            // seguirá marcando la siguiente casilla
  activar(e, 'hu4', 'move', { azar: dadoFijo(6) });
  // Primera esquiva: falla (2), repite por Esquivar (4 → éxito).
  const r1 = paso(e, 7, 14, { azar: dadoGuionizado(2, 4) });
  assert.equal(r1.exito, true);
  assert.equal(e.activacion.esquivarUsado, true);
  // Segunda esquiva en la misma activación: falla (2) y ya no repite: cae.
  // Dados: esquiva 2 → armadura 2D6 (3,3=6 < AR 8: no rompe).
  const r2 = paso(e, 6, 15, { azar: dadoGuionizado(2, 3, 3) });
  assert.equal(r2.exito, false);
  assert.equal(r2.turnover, true);
  assert.equal(jugador(e, 'hu4').postura, 'tumbado');
  assert.equal(e.turnover.causa, 'caida_esquivar');
  assert.equal(e.activacion, null, 'la activación terminó');
});

test('Escurridizo ignora los marcadores del destino al esquivar', () => {
  const e = partido();
  e.activo = 1;
  colocar(e, 'li9', 7, 12);            // eslizón AG 3+ (Esquivar + Escurridizo)
  colocar(e, 'hu2', 7, 13);            // marca el origen
  colocar(e, 'hu3', 8, 10);            // marcaría el destino (7,11)
  activar(e, 'li9', 'move', { azar: dadoFijo(6) });
  const r = paso(e, 7, 11, { azar: dadoGuionizado(3) }); // 3+ limpio gracias a Escurridizo
  assert.equal(r.exito, true);
  const ev = e.registro.find((x) => x.tipo === 'esquivar');
  assert.equal(ev.chequeo.mods.length, 0);
});

test('Cola prensil resta 1 al esquivar desde la zona del Kroxigor', () => {
  const e2 = partido();
  colocar(e2, 'hu4', 7, 13);
  colocar(e2, 'li1', 7, 12);
  activar(e2, 'hu4', 'move', { azar: dadoFijo(6) });
  const r2 = paso(e2, 7, 14, { azar: dadoGuionizado(3, 4) });
  assert.equal(r2.exito, true);
  const ev = e2.registro.find((x) => x.tipo === 'esquivar');
  assert.match(ev.chequeo.mods[0].porque, /Cola prensil de li1/);
});

test('Forzar la marcha: 2+ por casilla extra, máximo dos, y con 1 se cae', () => {
  const e = partido();
  const j = colocar(e, 'hu4', 7, 20);  // catcher MV 8
  activar(e, 'hu4', 'move', { azar: dadoFijo(6) });
  e.activacion.mvGastado = 8;          // MV agotado
  const r1 = paso(e, 7, 21, { azar: dadoGuionizado(2) });
  assert.equal(r1.exito, true);
  // Segundo rush: saca 1 → cae en la casilla de destino. Armadura 2D6 (6,5=11 ≥ 8: rompe),
  // heridas 2D6 (2,3=5 → aturdido).
  const r2 = paso(e, 7, 22, { azar: dadoGuionizado(1, 6, 5, 2, 3) });
  assert.equal(r2.exito, false);
  assert.equal(j.x, 7); assert.equal(j.y, 22, 'cae en la casilla a la que iba');
  assert.equal(j.postura, 'aturdido');
  assert.equal(e.turnover.causa, 'caida_rush');
});

test('con Ventisca, Forzar la marcha es a 3+ y se explica', () => {
  const e = partido({ clima: 'blizzard' });
  colocar(e, 'hu4', 7, 20);
  activar(e, 'hu4', 'move', { azar: dadoFijo(6) });
  e.activacion.mvGastado = 8;
  paso(e, 7, 21, { azar: dadoGuionizado(3) });
  const ev = e.registro.find((x) => x.tipo === 'rush');
  assert.equal(ev.chequeo.necesario, 3);
  assert.match(ev.chequeo.mods[0].porque, /Ventisca/);
});

test('levantarse cuesta 3 de MV; con MV ≤ 2 es un 4+ que consume todo', () => {
  const e = partido();
  const j = colocar(e, 'hu2', 7, 13, 'tumbado'); // blitzer MV 7
  activar(e, 'hu2', 'move', { azar: dadoFijo(6) });
  levantarse(e);
  assert.equal(j.postura, 'de_pie');
  assert.equal(e.activacion.mvGastado, 3);
  terminarActivacion(e);

  const lento = colocar(e, 'hu7', 3, 20, 'tumbado');
  lento.perfil.mv = 2;                 // lesionado de la rodilla dos veces, pobre
  lento.activado = false;
  activar(e, 'hu7', 'move', { azar: dadoFijo(6) });
  const r = levantarse(e, { azar: dadoGuionizado(3) }); // 3 < 4: sigue tumbado
  assert.equal(r.exito, false);
  assert.equal(lento.postura, 'tumbado');
  assert.equal(e.activacion, null, 'la activación se pierde');
});

test('recoger el balón: −1 por marcador, Manos seguras repite, y el fallo es turnover', () => {
  // Skaven thrower (AG 3+, Manos seguras) entra en la casilla del balón marcado por un rival.
  const e = crearPartido(
    crearEquipo('skaven', ROSTERS_1000K.skaven, { nombre: 'S' }),
    crearEquipo('human', ROSTERS_1000K.human, { nombre: 'H' }),
  );
  colocar(e, 'sk2', 7, 13);
  colocar(e, 'hu2', 8, 15);            // marcará (7,14), donde está el balón
  e.balon = { x: 7, y: 14 };
  activar(e, 'sk2', 'move', { azar: dadoFijo(6) });
  // Chequeo a 3+ con −1 (marcador) → necesita 4. Falla (3), Manos seguras repite (4): la coge.
  const r = paso(e, 7, 14, { azar: dadoGuionizado(3, 4) });
  assert.equal(r.balon, true);
  assert.equal(e.balon.portador, 'sk2');

  // El mismo caso fallando las dos: rebota y cambio de turno. Dados: 3, 3 y D8 del rebote.
  const e2 = crearPartido(
    crearEquipo('skaven', ROSTERS_1000K.skaven, { nombre: 'S' }),
    crearEquipo('human', ROSTERS_1000K.human, { nombre: 'H' }),
  );
  colocar(e2, 'sk2', 7, 13);
  colocar(e2, 'hu2', 8, 15);
  e2.balon = { x: 7, y: 14 };
  activar(e2, 'sk2', 'move', { azar: dadoFijo(6) });
  const r2 = paso(e2, 7, 14, { azar: dadoGuionizado(3, 3, 2) }); // D8=2: rebota a (7,13)
  assert.equal(r2.turnover, true);
  assert.equal(e2.turnover.causa, 'recogida_fallida');
  assert.deepEqual([e2.balon.x, e2.balon.y], [7, 13]);
});

test('saltar sobre un tumbado: 2 MV, cuenta el lado peor y con 1 natural cae en el origen', () => {
  const e = partido();
  const j = colocar(e, 'hu4', 7, 13);
  colocar(e, 'li2', 7, 14, 'tumbado'); // se salta por encima
  colocar(e, 'li3', 6, 12);            // marca el origen
  colocar(e, 'li4', 8, 12);            // marca el origen (peor lado: 2 marcadores)
  activar(e, 'hu4', 'move', { azar: dadoFijo(6) });
  const r = saltar(e, 7, 15, { azar: dadoGuionizado(5) }); // 3+ −2 → necesita 5
  assert.equal(r.exito, true);
  assert.equal(e.activacion.mvGastado, 2);
  assert.equal(j.y, 15);

  // Con 1 natural cae en el ORIGEN (no cruza). Armadura 5,4=9 ≥ 8 rompe; heridas 4,4=8 → KO.
  const e2 = partido();
  const k = colocar(e2, 'hu4', 7, 13);
  colocar(e2, 'li2', 7, 14, 'tumbado');
  activar(e2, 'hu4', 'move', { azar: dadoFijo(6) });
  const r2 = saltar(e2, 7, 15, { azar: dadoGuionizado(1, 5, 4, 4, 4) });
  assert.equal(r2.exito, false);
  assert.equal(k.situacion, 'ko');
  assert.deepEqual([k.x, k.y], [-1, -1]);
  assert.equal(e2.turnover.causa, 'caida_saltar');
});

test('Estúpido: con 1 queda Distraído, pierde la activación y la Penetración se gasta', () => {
  const e = partido();
  colocar(e, 'hu1', 7, 13);            // Ogro
  colocar(e, 'li2', 7, 11);            // el objetivo declarado de la Penetración
  const r = activar(e, 'hu1', 'blitz', { azar: dadoGuionizado(1), objetivo: 'li2' });
  assert.equal(r.rasgo, 'bone_head');
  assert.equal(jugador(e, 'hu1').postura, 'distraido');
  assert.equal(e.activacion, null);
  assert.equal(e.usadas.blitz, true, 'la Penetración del turno se ha gastado igualmente');
});

test('Realmente estúpido: +2 si hay un compañero de pie al lado que le explique', () => {
  const e = crearPartido(
    crearEquipo('chaos_chosen', ROSTERS_1000K.chaos_chosen, { nombre: 'C' }),
    crearEquipo('human', ROSTERS_1000K.human, { nombre: 'H' }),
  );
  colocar(e, 'ch1', 7, 13);            // Troll del Caos
  colocar(e, 'ch5', 8, 13);            // Beastman al lado
  activar(e, 'ch1', 'move', { azar: dadoGuionizado(2) }); // 2 + 2 = 4: pasa
  const ev = e.registro.find((x) => x.tipo === 'really_stupid');
  assert.equal(ev.chequeo.exito, true);
  assert.match(ev.chequeo.mods[0].porque, /compañero de pie adyacente/);
});

test('Ferocidad animal fallida: derriba al compañero con Golpe mortífero y puede seguir', () => {
  const e = crearPartido(
    crearEquipo('skaven', ROSTERS_1000K.skaven, { nombre: 'S' }),
    crearEquipo('human', ROSTERS_1000K.human, { nombre: 'H' }),
  );
  const rata = colocar(e, 'sk1', 7, 13);   // Rata Ogro
  const linea = colocar(e, 'sk7', 8, 13);  // compañero adyacente (AR 8+)
  // Ferocidad 2 (sin +2: es move) → ataca al compañero. Armadura 4,3=7 +1 GM = 8 ≥ 8 rompe.
  // Heridas 3,2=5 → aturdido.
  const r = activar(e, 'sk1', 'move', { azar: dadoGuionizado(2, 4, 3, 3, 2) });
  assert.equal(r.rasgo, 'animal_savagery');
  assert.equal(r.victima, 'sk7');
  assert.equal(r.terminaActivacion, false, 'puede continuar su activación');
  assert.equal(linea.postura, 'aturdido');
  assert.notEqual(e.activacion, null);
  const arm = e.registro.find((x) => x.tipo === 'armadura');
  assert.match(arm.tirada.mods[0].porque, /Golpe mortífero/);
});

test('Equilibrio firme: con un 6 no se cae, sin armadura ni cambio de turno', () => {
  const e = crearPartido(
    crearEquipo('high_elf', ROSTERS_1000K.high_elf, { nombre: 'E' }),
    crearEquipo('human', ROSTERS_1000K.human, { nombre: 'H' }),
  );
  // hi1-2 White Lion · hi3 Guerrero Dragón (steady_footing) · hi4-11 Línea.
  const gd = colocar(e, 'hi3', 7, 13);
  colocar(e, 'hu2', 7, 12);            // marca el origen
  activar(e, 'hi3', 'move', { azar: dadoFijo(6) });
  // Esquiva 1 (natural: falla, sin repetir: no tiene Esquivar) → Equilibrio firme 6: no cae.
  const r = paso(e, 7, 14, { azar: dadoGuionizado(1, 6) });
  assert.equal(r.exito, true);
  assert.equal(r.evitado, 'steady_footing');
  assert.equal(gd.postura, 'de_pie');
  assert.equal(e.turnover, null);
});

test('Cabeza dura: un 8 en heridas deja Aturdido en vez de KO', () => {
  const e = partido();
  const beastman = { id: 'x1', equipo: 0, pos: 'p', grande: false, situacion: 'campo', postura: 'de_pie',
    x: 5, y: 5, perfil: { mv: 6, fu: 3, ag: 3, ps: 3, ar: 9 }, hab: ['thick_skull'] };
  e.jugadores.x1 = beastman;
  // Armadura 5,5=10 ≥ 9 rompe; heridas 4,4=8: sería KO, Cabeza dura lo deja en aturdido.
  const r = resolverSuelo(e, beastman, { forma: 'derribado', azar: dadoGuionizado(5, 5, 4, 4) });
  assert.equal(r.heridas.ajuste, 'thick_skull');
  assert.equal(r.final, 'aturdido');
  // Con un 9 sí es KO.
  const b2 = { ...beastman, id: 'x2', postura: 'de_pie', x: 6, y: 6 };
  e.jugadores.x2 = b2;
  const r2 = resolverSuelo(e, b2, { forma: 'derribado', azar: dadoGuionizado(5, 5, 4, 5) });
  assert.equal(r2.final, 'ko');
});

test('Regeneración: con 4+ la lesión se queda en un susto y va a Reservas', () => {
  const e = crearPartido(
    crearEquipo('shambling_undead', ROSTERS_1000K.shambling_undead, { nombre: 'U' }),
    crearEquipo('human', ROSTERS_1000K.human, { nombre: 'H' }),
  );
  const momia = colocar(e, 'sh1', 7, 13); // sh1-2 momias (AR 10+)
  // Armadura 6,5=11 ≥ 10 rompe; heridas 6,5=11 → lesión; regeneración 4: regenera.
  const r = resolverSuelo(e, momia, { forma: 'derribado', azar: dadoGuionizado(6, 5, 6, 5, 4) });
  assert.equal(r.final, 'regenerado');
  assert.equal(momia.situacion, 'reserva');
  // Con 3 no regenera: tabla de lesiones D16 (7 → malherido).
  const momia2 = colocar(e, 'sh2', 8, 13);
  const r2 = resolverSuelo(e, momia2, { forma: 'derribado', azar: dadoGuionizado(6, 5, 6, 5, 3, 7) });
  assert.equal(r2.final, 'lesionado');
  assert.equal(r2.lesion.resultado, 'badly_hurt');
});

test('el rebote que cae en un jugador de pie obliga a atrapar; en un tumbado, vuelve a rebotar', () => {
  const e = partido();
  colocar(e, 'hu4', 7, 14);            // catcher (AG 3+, Atrapar)
  // Rebote desde (7,13): D8=7 → (7,14). Atrapar con −1 por rebote: 3 falla (necesita 4),
  // repite por Atrapar: 5 → la coge.
  const r = rebotar(e, 7, 13, { azar: dadoGuionizado(7, 3, 5) });
  assert.equal(r.portador, 'hu4');

  const e2 = partido();
  colocar(e2, 'li2', 7, 14, 'tumbado');
  // D8=7 → cae en el tumbado: imposible atrapar, rebota otra vez. D8=7 → (7,15) libre.
  const r2 = rebotar(e2, 7, 13, { azar: dadoGuionizado(7, 7) });
  assert.deepEqual([r2.x, r2.y], [7, 15]);
  assert.equal(r2.portador, null);
  assert.ok(e2.registro.some((x) => x.tipo === 'atrapar_imposible'));
});

test('el rebote que sale del campo se convierte en saque de banda de 2D6 contando el logo', () => {
  const e = partido();
  e.balon = { x: 0, y: 10 };
  // Rebote D8=4 (←): sale por la banda izquierda desde (0,10). Dirección D6=3 → [1,0];
  // distancia 2D6 = 4+3 = 7 → desplazamiento neto 6: cae en (6,10), libre.
  const r = rebotar(e, 0, 10, { azar: dadoGuionizado(4, 3, 4, 3) });
  assert.deepEqual([r.x, r.y], [6, 10]);
  const ev = e.registro.find((x) => x.tipo === 'saque_banda');
  assert.deepEqual(ev.a, [6, 10]);
});
