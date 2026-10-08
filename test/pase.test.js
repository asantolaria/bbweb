import test from 'node:test';
import assert from 'node:assert/strict';
import { crearEquipo } from '../src/engine/equipo.js';
import { ROSTERS_1000K } from '../src/data/rosters-iniciales.js';
import { crearPartido, jugador } from '../src/engine/partido.js';
import { activar, paso, terminarAccion } from '../src/engine/movimiento.js';
import { pase, entrega, alcance } from '../src/engine/pase.js';
import { falta } from '../src/engine/falta.js';
import { dadoGuionizado, dadoFijo } from './ayuda.js';

function montar(a = 'skaven', b = 'human') {
  return crearPartido(
    crearEquipo(a, ROSTERS_1000K[a], { nombre: 'A' }),
    crearEquipo(b, ROSTERS_1000K[b], { nombre: 'B' }),
  );
}
function colocar(e, id, x, y, postura = 'de_pie') {
  const j = jugador(e, id);
  j.situacion = 'campo'; j.x = x; j.y = y; j.postura = postura;
  return j;
}
// Skavens: sk1 Rata Ogro · sk2 Thrower (Manos seguras, Pasar, PS 2+) · sk3-4 Blitzer ·
// sk5-6 Gutter Runner · sk7-11 Línea.

test('la tabla de alcances: rápido, corto, largo, bomba y fuera de alcance', () => {
  assert.equal(alcance(7, 13, 7, 10), 'quick');   // 3 recto
  assert.equal(alcance(7, 13, 7, 9), 'short');    // 4
  assert.equal(alcance(7, 13, 7, 6), 'long');     // 7
  assert.equal(alcance(7, 13, 7, 2), 'bomb');     // 11
  assert.equal(alcance(0, 0, 13, 13), null);      // la esquina del mapa: fuera
  assert.equal(alcance(7, 13, 10, 10), 'short');  // diagonal 3,3
});

test('un pase rápido preciso: chequeo de PS, el receptor atrapa en el objetivo', () => {
  const e = montar();
  colocar(e, 'sk2', 7, 13);
  const receptor = colocar(e, 'sk5', 7, 10);
  e.balon = { portador: 'sk2' };
  activar(e, 'sk2', 'pass', { azar: dadoFijo(6) });
  // PS 2+ sin mods: 3 → preciso. Atrapar AG 2+… el Gutter Runner tiene AG 2+: 4 → coge.
  const r = pase(e, 7, 10, { azar: dadoGuionizado(3, 4) });
  assert.equal(r.resultado, 'completado');
  assert.equal(e.balon.portador, 'sk5');
  assert.equal(e.turnover, null);
  const ev = e.registro.find((x) => x.tipo === 'pase');
  assert.equal(ev.alcance, 'quick');
});

test('los modificadores del pase: alcance, marcadores y Muy soleado, explicados', () => {
  const e = montar();
  e.clima = 'very_sunny';
  colocar(e, 'sk2', 7, 13);
  colocar(e, 'hu2', 8, 14);            // marca al lanzador
  colocar(e, 'sk5', 7, 6);             // a 7 casillas: pase largo
  e.balon = { portador: 'sk2' };
  activar(e, 'sk2', 'pass', { azar: dadoFijo(6) });
  // PS 2+ −2 (largo) −1 (marcador) −1 (sol) → necesita 6. Un 5 falla → repite por
  // Pasar: 6 → preciso. Atrapar: AG 2+ −… nadie marca al receptor: 2 → coge.
  const r = pase(e, 7, 6, { azar: dadoGuionizado(5, 6, 2) });
  assert.equal(r.resultado, 'completado');
  const ev = e.registro.find((x) => x.tipo === 'pase');
  assert.equal(ev.chequeo.necesario, 6);
  assert.equal(ev.chequeo.mods.length, 3);
});

test('la pifia rebota desde el lanzador y es cambio de turno', () => {
  const e = montar();
  colocar(e, 'sk2', 7, 13);
  colocar(e, 'sk5', 7, 10);
  e.balon = { portador: 'sk2' };
  activar(e, 'sk2', 'pass', { azar: dadoFijo(6) });
  // 1 natural → pifia (sin Pase seguro)… ¡el thrower repite por Pasar! 1 otra vez.
  // Rebote D8 2 → (7,12), vacía.
  const r = pase(e, 7, 10, { azar: dadoGuionizado(1, 1, 2) });
  assert.equal(r.resultado, 'pifia');
  assert.equal(e.turnover.causa, 'pifia');
  assert.deepEqual([e.balon.x, e.balon.y], [7, 12]);
});

test('un pase impreciso se dispersa 3 veces desde el objetivo', () => {
  // Detalle que salió de este mismo test: un pasador con PS 2+ y −1 de modificador
  // nunca es impreciso (o saca 2+ modificado y acierta, o es pifia). Para ver la
  // dispersión hace falta un pasador mediocre: el catcher humano, PS 4+.
  const e = montar('human', 'skaven');
  colocar(e, 'hu4', 7, 13);
  e.balon = { portador: 'hu4' };
  activar(e, 'hu4', 'pass', { azar: dadoFijo(6) });
  // Pase corto a (5,9): PS 4+ −1 → necesita 5: sale 3 (mod 2: falla sin pifia).
  // Impreciso: dispersión 7,7,7 (↓↓↓) desde (5,9) → (5,12), vacía → cae y rebota
  // (D8 4 ←) a (4,12). Nadie del equipo activo lo tiene → turnover.
  const r = pase(e, 5, 9, { azar: dadoGuionizado(3, 7, 7, 7, 4) });
  assert.equal(r.resultado, 'turnover');
  assert.equal(e.turnover.causa, 'pase_al_suelo');
  assert.deepEqual([e.balon.x, e.balon.y], [4, 12]);
});

test('la intercepción: un rival bajo la trayectoria se queda el balón y es turnover', () => {
  const e = montar();
  colocar(e, 'sk2', 7, 13);
  colocar(e, 'sk5', 7, 7);
  const ladron = colocar(e, 'hu4', 7, 10);   // catcher humano en la trayectoria
  e.balon = { portador: 'sk2' };
  activar(e, 'sk2', 'pass', { azar: dadoFijo(6) });
  // Pase largo (6): PS 2+ −2 → 4: sale 5 → preciso. Intercepción: AG 3+ −3 (preciso)
  // → necesita 6: sale 6 natural → ¡suya!
  const r = pase(e, 7, 7, {
    azar: dadoGuionizado(5, 6),
    opciones: { elegirInterceptor: (ids) => ids[0] },
  });
  assert.equal(r.resultado, 'interceptado');
  assert.equal(e.balon.portador, 'hu4');
  assert.equal(e.turnover.causa, 'intercepcion');
  assert.equal(jugador(e, 'hu4').id, ladron.id);
});

test('la entrega solo tira el atrapar, y Pasar y seguir deja seguir moviéndose', () => {
  const e = montar('imperial_nobility', 'human');
  // El roster inicial de Nobleza no ficha Thrower (im2 es Blitzer): le damos Pasar y
  // seguir a mano, que es la habilidad del Thrower imperial que queremos probar.
  const pasador = colocar(e, 'im2', 7, 13);
  pasador.hab = [...pasador.hab, 'give_and_go'];
  const noble = colocar(e, 'im3', 8, 13);    // Blitzer noble (Atrapar)
  e.balon = { portador: 'im2' };
  activar(e, 'im2', 'handoff', { azar: dadoFijo(6) });
  const r = entrega(e, 'im3', { azar: dadoGuionizado(3) }); // AG 3+ limpio
  assert.equal(e.balon.portador, 'im3');
  assert.equal(r.sigue, true, 'Pasar y seguir: puede continuar su Movimiento');
  assert.notEqual(e.activacion, null);
});

test('El balón es mío impide pasar y entregar', () => {
  const e = montar('high_elf', 'human');
  colocar(e, 'hi3', 7, 13);            // Guerrero Dragón: El balón es mío
  colocar(e, 'hi4', 8, 13);
  e.balon = { portador: 'hi3' };
  activar(e, 'hi3', 'pass', { azar: dadoFijo(6) });
  assert.throws(() => pase(e, 7, 10, { azar: dadoFijo(5) }), /El balón es mío/);
});

test('Pase seguro convierte la pifia en quedarse el balón sin cambio de turno', () => {
  const e = montar('high_elf', 'human');
  colocar(e, 'hi2', 7, 13);            // hi1-2 White Lion… no: el thrower es Príncipe Fénix
  const princeps = colocar(e, 'hi11', 7, 20); // da igual: montamos directo con el thrower
  const e2 = montar('high_elf', 'human');
  const thrower = Object.values(e2.jugadores).find((j) => j.pos === 'high_elf_thrower');
  // El roster inicial de Altos Elfos no ficha thrower: lo probamos con el perfil a mano.
  if (!thrower) {
    const j = colocar(e2, 'hi4', 7, 13);
    j.hab = [...j.hab, 'safe_pass', 'pass'];
    e2.balon = { portador: j.id };
    activar(e2, j.id, 'pass', { azar: dadoFijo(6) });
    // 1 natural → repite por Pasar → 1 natural otra vez → Pase seguro: retiene.
    const r = pase(e2, 7, 10, { azar: dadoGuionizado(1, 1) });
    assert.equal(r.resultado, 'retenido');
    assert.equal(e2.balon.portador, j.id);
    assert.equal(e2.turnover, null);
  }
});

test('con Ventisca no se declaran pases largos', () => {
  const e = montar();
  e.clima = 'blizzard';
  colocar(e, 'sk2', 7, 13);
  e.balon = { portador: 'sk2' };
  activar(e, 'sk2', 'pass', { azar: dadoFijo(6) });
  assert.throws(() => pase(e, 7, 6, { azar: dadoFijo(5) }), /Ventisca/);
});

test('Asegurar el balón: 2+ para recogerlo y la activación termina; fallar es turnover', () => {
  const e = montar();
  e.balon = { x: 7, y: 12 };
  const linea = colocar(e, 'sk7', 7, 14);
  activar(e, 'sk7', 'secure', { azar: dadoFijo(6) });
  paso(e, 7, 13, { azar: dadoFijo(6) });
  const r = paso(e, 7, 12, { azar: dadoGuionizado(2) });   // 2+ → la tiene
  assert.equal(e.balon.portador, 'sk7');
  assert.equal(e.activacion, null, 'recoger termina la activación');

  // Declararla con un rival a 2 casillas del balón está prohibido.
  const e2 = montar();
  e2.balon = { x: 7, y: 12 };
  colocar(e2, 'sk8', 7, 14);
  colocar(e2, 'hu2', 8, 11);           // rival de pie a una casilla del balón
  assert.throws(() => activar(e2, 'sk8', 'secure', { azar: dadoFijo(6) }), /rival de pie/);

  // El Tembloroso no puede declararla (zombi en un montaje aparte).
  const e3 = montar('shambling_undead', 'human');
  e3.balon = { x: 7, y: 12 };
  colocar(e3, 'sh7', 7, 14);           // zombi: Tembloroso
  assert.throws(() => activar(e3, 'sh7', 'secure', { azar: dadoFijo(6) }), /Tembloroso/);
});

test('terminar una acción de Asegurar lejos del balón es cambio de turno', () => {
  const e = montar();
  e.balon = { x: 7, y: 5 };
  colocar(e, 'sk7', 7, 14);
  activar(e, 'sk7', 'secure', { azar: dadoFijo(6) });
  paso(e, 7, 13, { azar: dadoFijo(6) });
  terminarAccion(e);
  assert.equal(e.turnover.causa, 'asegurar_incumplido');
});

test('Dejada: el portador suelta el balón en la casilla que abandona, sin rebote', () => {
  const e = montar('elven_union', 'human');
  const linea = colocar(e, 'el4', 7, 13);    // el1-2 Blitzer · el3 Catcher · el4-11 Línea (Dejada)
  e.balon = { portador: linea.id };
  activar(e, linea.id, 'move', { azar: dadoFijo(6) });
  paso(e, 7, 12, { azar: dadoFijo(6), dejarBalon: true });
  assert.deepEqual([e.balon.x, e.balon.y], [7, 13], 'el balón se queda donde estaba él');
  assert.equal(e.turnover, null);
});

test('la falta: apoyos en la armadura, y las dobles expulsan con cambio de turno', () => {
  const e = montar('human', 'chaos_chosen');
  colocar(e, 'hu7', 7, 13);
  const caido = colocar(e, 'ch5', 7, 12, 'tumbado');  // beastman AR 9
  colocar(e, 'hu8', 6, 12);            // apoyo ofensivo (marca al caído, nadie le marca)
  activar(e, 'hu7', 'foul', { azar: dadoFijo(6) });
  // Armadura 4,4=8 +1 apoyo = 9 ≥ 9 rompe… y son DOBLES: expulsión. Heridas 3,3=6 →
  // aturdido (también dobles, da igual: ya está pillado). Sin protestar ni soborno.
  const r = falta(e, 'ch5', { azar: dadoGuionizado(4, 4, 3, 3) });
  assert.equal(caido.postura, 'aturdido');
  assert.equal(r.expulsado, true);
  assert.equal(jugador(e, 'hu7').situacion, 'expulsado');
  assert.equal(e.turnover.causa, 'expulsion');
  const arm = e.registro.find((x) => x.tipo === 'armadura');
  assert.match(arm.tirada.mods[0].porque, /apoyo ofensivo/);
});

test('el soborno salva al expulsado con 2+', () => {
  const e = montar('human', 'chaos_chosen');
  colocar(e, 'hu7', 7, 13);
  colocar(e, 'ch5', 7, 12, 'tumbado');
  e.equipos[0].sobornos = 1;
  activar(e, 'hu7', 'foul', { azar: dadoFijo(6) });
  // Armadura 5,5=10 (dobles, rompe); heridas 2,3=5 aturdido; protesta no; soborno: 4 → se queda.
  const r = falta(e, 'ch5', {
    azar: dadoGuionizado(5, 5, 2, 3, 4),
    opciones: { usarSoborno: () => true },
  });
  assert.equal(r.expulsado, false);
  assert.equal(jugador(e, 'hu7').situacion, 'campo');
  assert.equal(e.equipos[0].sobornos, 0, 'el soborno se gasta');
  assert.equal(e.turnover.causa, 'expulsion', 'el cambio de turno se mantiene');
});

test('una falta sin dobles no expulsa y no es turnover', () => {
  const e = montar('human', 'chaos_chosen');
  colocar(e, 'hu7', 7, 13);
  colocar(e, 'ch5', 7, 12, 'tumbado');
  activar(e, 'hu7', 'foul', { azar: dadoFijo(6) });
  const r = falta(e, 'ch5', { azar: dadoGuionizado(5, 3) }); // 8 < 9: ni rompe
  assert.equal(r.expulsado, false);
  assert.equal(e.turnover, null);
});
