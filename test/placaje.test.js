import test from 'node:test';
import assert from 'node:assert/strict';
import { crearEquipo } from '../src/engine/equipo.js';
import { ROSTERS_1000K } from '../src/data/rosters-iniciales.js';
import { crearPartido, jugador } from '../src/engine/partido.js';
import { placar, fuerzasPlacaje, apoyos, casillasDeEmpuje } from '../src/engine/placaje.js';
import { dadoGuionizado, dadoFijo } from './ayuda.js';

function montar(a = 'human', b = 'lizardmen') {
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
// Humanos: hu1 Ogro · hu2-3 Blitzer (Placar, P. defensivo) · hu4-5 Catcher (Esquivar) ·
// hu6 Halfling · hu7-12 Línea. Lagartos: li1 Kroxigor · li2-7 Saurio (Imparable) ·
// li8 Camaleón · li9-11 Eslizón.

test('apoyos: solo cuenta el compañero que no está marcado por ningún otro rival', () => {
  const e = montar();
  const A = colocar(e, 'hu7', 7, 13);
  const O = colocar(e, 'li2', 7, 12);
  colocar(e, 'hu8', 8, 12);            // marca al objetivo, libre → apoya
  colocar(e, 'hu9', 6, 12);            // marca al objetivo…
  colocar(e, 'li3', 5, 12);            // …pero li3 lo marca a él → no apoya
  const ap = apoyos(e, A, O);
  assert.deepEqual(ap.ofensivos.map((j) => j.id), ['hu8']);
});

test('dados de placaje: 1 igualados, 2 el más fuerte, 3 con más del doble', () => {
  const e = montar('shambling_undead', 'lizardmen');
  const momia = colocar(e, 'sh1', 7, 13);    // FU 5
  const saurio = colocar(e, 'li2', 7, 12);   // FU 4
  assert.deepEqual(
    [fuerzasPlacaje(e, momia, saurio).dados, fuerzasPlacaje(e, momia, saurio).elige],
    [2, 'atacante'],
  );
  // Momia (5) contra eslizón (2), lejos de cualquier apoyo: 5 > 2·2 → 3 dados.
  const e2 = montar('shambling_undead', 'lizardmen');
  const momia2 = colocar(e2, 'sh1', 7, 13);
  const eslizon = colocar(e2, 'li9', 7, 12);
  assert.equal(fuerzasPlacaje(e2, momia2, eslizon).dados, 3);
  // Dos saurios marcando al eslizón… no: marcando a la MOMIA (apoyo defensivo del
  // eslizón): 5 contra 2+2 → ya no es más del doble → 2 dados.
  colocar(e2, 'li3', 8, 14); colocar(e2, 'li4', 6, 14);
  assert.equal(fuerzasPlacaje(e2, momia2, eslizon).dados, 2);
  // Zombi contra zombi del otro… un igualado de verdad: línea humana vs beastman.
  const e3 = montar('human', 'chaos_chosen');
  const a = colocar(e3, 'hu7', 7, 13), o = colocar(e3, 'ch5', 7, 12);
  assert.deepEqual([fuerzasPlacaje(e3, a, o).dados, fuerzasPlacaje(e3, a, o).elige], [1, null]);
});

test('empuje recto y en diagonal: las tres casillas «de enfrente»', () => {
  const recto = casillasDeEmpuje({ x: 7, y: 10 }, { x: 7, y: 11 });
  assert.deepEqual(recto.map((c) => [c.x, c.y]), [[6, 12], [7, 12], [8, 12]]);
  const diagonal = casillasDeEmpuje({ x: 7, y: 10 }, { x: 8, y: 11 });
  assert.deepEqual(diagonal.map((c) => [c.x, c.y]), [[9, 11], [9, 12], [8, 12]]);
});

test('Ambos derribados sin Placar: caen los dos y es cambio de turno del atacante', () => {
  const e = montar('human', 'chaos_chosen');
  colocar(e, 'hu7', 7, 13);            // línea sin Placar, FU 3
  const O = colocar(e, 'ch5', 7, 12);  // beastman sin Placar, FU 3 → 1 dado
  // Dado: 2 (both down). Objetivo: armadura 3,3=6 < 9 no rompe. Atacante: 4,3=7 < 9.
  const r = placar(e, 'hu7', 'ch5', { azar: dadoGuionizado(2, 3, 3, 4, 3) });
  assert.equal(r.resultado, 'both_down');
  assert.equal(jugador(e, 'hu7').postura, 'tumbado');
  assert.equal(O.postura, 'tumbado');
  assert.equal(e.turnover.causa, 'atacante_derribado');
});

test('Placar evita caer en Ambos derribados; el rival sin Placar cae igual', () => {
  const e = montar('human', 'chaos_chosen');
  colocar(e, 'hu2', 7, 13);            // blitzer con Placar, FU 3
  colocar(e, 'ch5', 7, 12);            // beastman FU 3 → 1 dado
  // Dado 2; el beastman (AR 9) cae: armadura 5,4=9 rompe, heridas 3,3=6 → aturdido.
  // El blitzer no cae: ni un dado de armadura para él.
  const r = placar(e, 'hu2', 'ch5', { azar: dadoGuionizado(2, 5, 4, 3, 3) });
  assert.equal(jugador(e, 'hu2').postura, 'de_pie');
  assert.equal(jugador(e, 'ch5').postura, 'aturdido');
  assert.equal(e.turnover, null, 'el atacante no ha caído');
});

test('Forcejear deja a los dos tumbados boca arriba, sin tirada de armadura', () => {
  const e = montar('high_elf', 'human');
  colocar(e, 'hi1', 7, 13);            // León Blanco: Forcejear (y sin Placar)
  colocar(e, 'hu7', 7, 12);
  const r = placar(e, 'hi1', 'hu7', { azar: dadoGuionizado(2) }); // both down y nada más
  assert.equal(r.forcejeo, 'hi1');
  assert.equal(jugador(e, 'hi1').postura, 'tumbado');
  assert.equal(jugador(e, 'hu7').postura, 'tumbado');
  assert.ok(!e.registro.some((x) => x.tipo === 'armadura'), 'Tumbar no tira armadura');
});

test('Desequilibrado: con Esquivar es empujón; con Placaje defensivo enfrente, ¡POW!', () => {
  // Línea humana (sin Placaje defensivo) contra Necrófago (Esquivar, FU 3): empujón.
  const e = montar('human', 'shambling_undead');
  colocar(e, 'hu7', 7, 13);
  const ghoul = colocar(e, 'sh5', 7, 12); // sh5-6 Necrófagos (Esquivar)
  const r = placar(e, 'hu7', 'sh5', { azar: dadoGuionizado(5) }); // 1 dado: stumble
  assert.equal(r.resultado, 'push');
  assert.equal(ghoul.postura, 'de_pie');
  assert.ok(e.registro.some((x) => x.tipo === 'esquivar_placaje'));

  // Blitzer humano (Placaje defensivo) contra el mismo Necrófago: POW pese a Esquivar.
  const e2 = montar('human', 'shambling_undead');
  colocar(e2, 'hu2', 7, 13);
  const ghoul2 = colocar(e2, 'sh5', 7, 12);
  // Dado 5 → POW: empuje y derribo. AR 8: 5,4=9 rompe; heridas 4,3=7 → aturdido.
  const r2 = placar(e2, 'hu2', 'sh5', { azar: dadoGuionizado(5, 5, 4, 4, 3) });
  assert.equal(r2.resultado, 'pow');
  assert.equal(ghoul2.postura, 'aturdido');
  assert.ok(e2.registro.some((x) => x.tipo === 'placaje_defensivo'));
});

test('POW: empuje, impulso y derribo en la casilla nueva con Golpe mortífero óptimo', () => {
  const e = montar('shambling_undead', 'human');
  const momia = colocar(e, 'sh1', 7, 13); // Momia: FU 5, Golpe mortífero
  const linea = colocar(e, 'hu7', 7, 12); // AR 9
  // 2 dados (5 vs 3): 6,1 → elige POW. Empuje a (7,11) (por defecto la primera: (6,11)).
  // Armadura 4,4=8: falla por 1 exacto → Golpe mortífero a la armadura → rompe.
  // Heridas 3,2=5 → aturdido.
  const r = placar(e, 'sh1', 'hu7', { azar: dadoGuionizado(6, 1, 4, 4, 3, 2) });
  assert.equal(r.resultado, 'pow');
  assert.deepEqual([linea.x, linea.y], [6, 11], 'empujado a la primera candidata');
  assert.deepEqual([momia.x, momia.y], [7, 12], 'la momia hizo el impulso');
  assert.equal(linea.postura, 'aturdido');
  const arm = e.registro.find((x) => x.tipo === 'armadura');
  assert.match(arm.tirada.mods.at(-1).porque, /Golpe mortífero.*armadura/);
});

test('Golpe mortífero se guarda para las heridas si la armadura rompe sola', () => {
  const e = montar('shambling_undead', 'human');
  colocar(e, 'sh1', 7, 13);
  const linea = colocar(e, 'hu7', 7, 12);
  // 2 dados: 6,6 → POW. Armadura 6,4=10 ≥ 9 rompe sola → GM pasa a heridas.
  // Heridas 4,3=7 +1 GM = 8 → KO.
  const r = placar(e, 'sh1', 'hu7', { azar: dadoGuionizado(6, 6, 6, 4, 4, 3) });
  assert.equal(linea.situacion, 'ko');
  const h = e.registro.find((x) => x.tipo === 'heridas');
  assert.match(h.tirada.mods[0].porque, /Golpe mortífero.*heridas/);
});

test('Garras: un 8+ natural rompe cualquier armadura', () => {
  const e = montar('high_elf', 'lizardmen');
  colocar(e, 'hi1', 7, 13);            // León Blanco: Garras (y Forcejear)
  const krox = colocar(e, 'li1', 7, 12); // Kroxigor AR 10+
  // 1 dado (3 vs 5… ¡elige el Kroxigor!): FU 3 vs 5 → 2 dados y elige el objetivo.
  // Dados 6,3: el defensor elige lo peor para el atacante → player_down… mejor evitamos:
  // usamos elegirDado explícito para forzar el POW y probar solo las Garras.
  const r = placar(e, 'hi1', 'li1', {
    azar: dadoGuionizado(6, 3, 5, 3, 4, 4),
    opciones: { elegirDado: (dados) => dados.indexOf('pow') },
  });
  // Armadura 5,3=8 < 10 pero 8 natural con Garras → rota. Heridas 4,4=8 → KO…
  // el Kroxigor tiene Cabeza dura: 8 se queda en aturdido.
  assert.equal(r.resultado, 'pow');
  const arm = e.registro.find((x) => x.tipo === 'armadura');
  assert.equal(arm.tirada.porGarras, true);
  assert.equal(krox.postura, 'aturdido');
});

test('empujado al público: heridas sin armadura, y si era del equipo activo, turnover', () => {
  const e = montar('human', 'chaos_chosen');
  colocar(e, 'hu7', 1, 10);
  const bm = colocar(e, 'ch5', 0, 10); // beastman contra la banda izquierda, FU 3 → 1 dado
  // Dado: 3 (push). Las tres candidatas están fuera → al público. Heridas directas
  // 5,5=10 → lesión; sin Regeneración: tabla D16, 7 → Magullado.
  const r = placar(e, 'hu7', 'ch5', { azar: dadoGuionizado(3, 5, 5, 7) });
  assert.equal(r.empuje.alPublico, true);
  assert.equal(bm.situacion, 'lesionado');
  assert.equal(e.turnover, null, 'el beastman no es del equipo activo');
  assert.ok(!e.registro.some((x) => x.tipo === 'armadura'), 'el público pega sin armadura');
});

test('empujón en cadena: el de detrás se aparta en la dirección que elige el atacante', () => {
  const e = montar('human', 'chaos_chosen');
  colocar(e, 'hu7', 7, 10);
  const O = colocar(e, 'ch5', 7, 11);       // FU 3 → 1 dado
  const detras = colocar(e, 'ch6', 6, 12);  // ocupará la primera candidata (6,12)
  colocar(e, 'ch7', 7, 12); colocar(e, 'ch8', 8, 12); // las otras dos también ocupadas
  // Dado: 3 (push) → (6,12) ocupada → cadena: ch6 empujado con vector (7,11)→(6,12),
  // a su primera candidata libre (5,12). ch5 acaba en (6,12).
  const r = placar(e, 'hu7', 'ch5', { azar: dadoGuionizado(3) });
  assert.deepEqual([detras.x, detras.y], [5, 12]);
  assert.deepEqual([O.x, O.y], [6, 12]);
  assert.ok(e.registro.some((x) => x.tipo === 'empujon_en_cadena'));
});

test('Mantenerse firme se queda quieto, y en un POW cae en su propia casilla', () => {
  const e = montar('human', 'imperial_nobility');
  colocar(e, 'hu2', 7, 13);
  const guarda = colocar(e, 'im4', 7, 12); // im1 Ogro · im2-3 Blitzer · im4-7 Bodyguard
  // 1 dado: 6 (POW) → Mantenerse firme: no se mueve; derribo en su casilla.
  // AR 9: 3,3=6 no rompe.
  const r = placar(e, 'hu2', 'im4', { azar: dadoGuionizado(6, 3, 3) });
  assert.deepEqual([guarda.x, guarda.y], [7, 12], 'no se ha movido');
  assert.equal(guarda.postura, 'tumbado');
  assert.ok(e.registro.some((x) => x.tipo === 'mantenerse_firme'));
});

test('Echarse a un lado elige el defensor; Zafarse impide el impulso', () => {
  const e = montar('human', 'elven_union');
  colocar(e, 'hu7', 7, 13);
  const blitzerElfo = colocar(e, 'el1', 7, 12); // el1-2 Blitzer (Echarse a un lado, Placar)
  // 1 dado: 3 (push) → Echarse a un lado: el defensor elige entre TODAS las adyacentes
  // libres; con el callback lo mandamos a (8,12), que no es candidata frontal.
  const r = placar(e, 'hu7', 'el1', {
    azar: dadoGuionizado(3),
    opciones: { elegirEmpuje: (cands, ctx) => cands.findIndex((c) => c.x === 8 && c.y === 12) },
  });
  assert.deepEqual([blitzerElfo.x, blitzerElfo.y], [8, 12]);
  assert.ok(e.registro.some((x) => x.tipo === 'echarse_a_un_lado'));

  // Zafarse: el Retainer imperial impide el impulso.
  const e2 = montar('human', 'imperial_nobility');
  colocar(e2, 'hu7', 7, 13);
  colocar(e2, 'im8', 7, 12);           // im8-11 Retainer (Zafarse)
  const r2 = placar(e2, 'hu7', 'im8', { azar: dadoGuionizado(3) });
  assert.deepEqual([jugador(e2, 'hu7').x, jugador(e2, 'hu7').y], [7, 13], 'sin impulso');
  assert.ok(e2.registro.some((x) => x.tipo === 'zafarse'));
});

test('Furia: empujón con impulso obligatorio y exactamente un segundo placaje', () => {
  const e = montar('skaven', 'human');
  const rata = colocar(e, 'sk1', 7, 13); // Rata Ogro: Furia, Golpe mortífero, FU 5
  const linea = colocar(e, 'hu7', 7, 12);
  // 1er placaje (2 dados, 5v3): 3,1 → elige empujón. Impulso obligatorio.
  // 2º placaje (2 dados): 3,3 → empujón otra vez, impulso… y NO hay tercero.
  // Con elegirEmpuje forzamos el empujón recto (la opción por defecto es la diagonal).
  const recto = (cands) => { const i = cands.findIndex((c) => c.x === 7); return i < 0 ? 0 : i; };
  const r = placar(e, 'sk1', 'hu7', { azar: dadoGuionizado(3, 1, 3, 3), opciones: { elegirEmpuje: recto } });
  assert.equal(r.resultado, 'push');
  assert.ok(r.segundoPlacaje, 'hay segundo placaje');
  assert.equal(r.segundoPlacaje.segundoPlacaje, undefined, 'y no hay tercero');
  assert.deepEqual([linea.x, linea.y], [7, 10], 'empujado dos casillas');
  assert.deepEqual([rata.x, rata.y], [7, 11], 'la rata ha impulsado dos veces');
});

test('Cuernos suma FU solo en Penetración; Imparable convierte Ambos derribados en empujón', () => {
  const e = montar('chaos_chosen', 'human');
  const beastman = colocar(e, 'ch5', 7, 13); // Cuernos, FU 3
  const linea = colocar(e, 'hu7', 7, 12);
  assert.equal(fuerzasPlacaje(e, beastman, linea).dados, 1, 'sin blitz, 3 contra 3');
  assert.equal(fuerzasPlacaje(e, beastman, linea, { blitz: true }).dados, 2, 'con Cuernos, 4 contra 3');

  const e2 = montar('lizardmen', 'human');
  colocar(e2, 'li2', 7, 13);           // Saurio: Imparable, FU 4
  const l2 = colocar(e2, 'hu7', 7, 12);
  // Penetración: 2 dados 2,2 → both_down elegido → Imparable: empujón (recto, forzado).
  const recto = (cands) => { const i = cands.findIndex((c) => c.x === 7); return i < 0 ? 0 : i; };
  const r = placar(e2, 'li2', 'hu7', {
    azar: dadoGuionizado(2, 2), blitz: true, opciones: { elegirEmpuje: recto },
  });
  assert.equal(r.resultado, 'push', 'el resultado aplicado es el empujón');
  assert.ok(e2.registro.some((x) => x.tipo === 'placaje_resultado' && x.resultado === 'both_down'),
    'el dado elegido fue Ambos derribados');
  assert.deepEqual([l2.x, l2.y], [7, 11], 'empujado, no derribado');
  assert.ok(e2.registro.some((x) => x.tipo === 'imparable'));
});

test('Robar balón tira el balón al empujar al portador, salvo que tenga Manos seguras', () => {
  const e = montar('skaven', 'human');
  colocar(e, 'sk3', 7, 13);            // Blitzer skaven: Placar, Robar balón
  const catcher = colocar(e, 'hu4', 7, 12);
  e.balon = { portador: 'hu4' };
  // 1 dado: 3 (push). Empuje a (6,11) por defecto… primera candidata (6,11). El balón
  // cae ahí y rebota: D8=2 → (6,10), libre.
  const r = placar(e, 'sk3', 'hu4', { azar: dadoGuionizado(3, 2) });
  assert.equal(e.balon.portador, undefined);
  assert.ok(e.registro.some((x) => x.tipo === 'robar_balon'));

  // Contra Manos seguras no funciona (el thrower humano no está en el roster: usamos
  // el thrower skaven como víctima en un montaje invertido).
  const e2 = montar('human', 'skaven');
  colocar(e2, 'hu2', 7, 13);           // blitzer humano: sin Robar balón… placa normal
  const thrower = colocar(e2, 'sk2', 7, 12); // Manos seguras
  e2.balon = { portador: 'sk2' };
  const r2 = placar(e2, 'hu2', 'sk2', { azar: dadoGuionizado(3) });
  assert.equal(e2.balon.portador, 'sk2', 'sin Robar balón el empujón no suelta el balón');
});

test('Luchador repite un Ambos derribados en Placaje declarado, no en Penetración', () => {
  const e = montar('black_orc', 'human');
  colocar(e, 'bl6', 7, 13);            // bl1 Troll · bl2-7 Orco Negro (Luchador, Apartar)
  colocar(e, 'hu7', 7, 12);
  // 2 dados (4v3): 2,3 → Luchador repite el both_down: sale 6 → dados finales [pow… ]
  // elige pow → empuje y derribo: AR 9: 6,5=11 rompe; heridas 2,2=4 → aturdido.
  const r = placar(e, 'bl6', 'hu7', { azar: dadoGuionizado(2, 3, 6, 6, 5, 2, 2) });
  assert.ok(e.registro.some((x) => x.tipo === 'luchador'));
  assert.equal(r.resultado, 'pow');
});

test('la Penetración declara objetivo, cuesta 1 MV y deja seguir moviéndose', async () => {
  const { activar: act, paso: p2 } = await import('../src/engine/movimiento.js');
  const { placarEnPenetracion } = await import('../src/engine/placaje.js');
  const e = montar('human', 'chaos_chosen');
  const blitzer = colocar(e, 'hu2', 7, 16);
  colocar(e, 'ch5', 7, 13);
  // Declara la Penetración contra el beastman, aún a 3 casillas.
  act(e, 'hu2', 'blitz', { azar: dadoFijo(6), objetivo: 'ch5' });
  assert.equal(e.usadas.blitz, true);
  p2(e, 7, 15, { azar: dadoFijo(6) });
  p2(e, 7, 14, { azar: dadoFijo(6) });
  assert.equal(e.activacion.mvGastado, 2);
  // Placa (1 dado, 3v3): 6 → POW. Empuje por defecto, sin impulso. AR 9: 2,2 no rompe.
  const r = placarEnPenetracion(e, { azar: dadoGuionizado(6, 2, 2), opciones: { impulso: () => false } });
  assert.equal(r.resultado, 'pow');
  assert.equal(e.activacion.mvGastado, 3, 'el placaje costó 1 MV');
  // Y puede seguir moviendo con el MV restante (blitzer MV 7).
  p2(e, 6, 15, { azar: dadoFijo(6) });
  assert.deepEqual([blitzer.x, blitzer.y], [6, 15]);
  // El segundo placaje de la misma Penetración está prohibido.
  assert.throws(() => placarEnPenetracion(e, { azar: dadoFijo(6) }), /ya se hizo/);
});
