import test from 'node:test';
import assert from 'node:assert/strict';
import { crearEquipo } from '../src/engine/equipo.js';
import { ROSTERS_1000K } from '../src/data/rosters-iniciales.js';
import { crearPartido, jugador } from '../src/engine/partido.js';
import { activar } from '../src/engine/movimiento.js';
import { lanzarCompanero } from '../src/engine/lanzar.js';
import { apunalar, vomitar } from '../src/engine/especiales.js';
import { dadoGuionizado, dadoFijo } from './ayuda.js';

// Humanos: hu1 Ogro (Lanzar compañero, Siempre hambriento NO: eso es del Troll) ·
// hu6 Halfling (Humanoide bala, Escurridizo). Orcos Negros: bl1 Troll Adiestrado
// (Lanzar compañero + Siempre hambriento) · bl9-13 Goblins (Humanoide bala).
function montar(a = 'human', b = 'chaos_chosen') {
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

test('lanzamiento excelente: dispersión de 3 y aterrizaje de pie del Halfling', () => {
  const e = montar();
  colocar(e, 'hu1', 7, 13);            // Ogro (PS 5+)
  const h = colocar(e, 'hu6', 8, 13);  // Halfling (AG 3+)
  activar(e, 'hu1', 'ttm', { azar: dadoFijo(6) }); // sin rasgos que tirar
  // Objetivo (7,10): rápido (3 casillas). PS 5+: sale 5 → excelente.
  // Dispersión 3: D8 7,7,2 (↓↓↑) → (7,11),(7,12),(7,11). Aterrizaje AG 3+: 3 → de pie.
  const r = lanzarCompanero(e, 'hu6', 7, 10, { azar: dadoGuionizado(5, 7, 7, 2, 3) });
  assert.equal(r.resultado, 'de_pie');
  assert.deepEqual([h.x, h.y], [7, 11]);
  assert.equal(h.postura, 'de_pie');
  assert.equal(e.turnover, null);
  assert.equal(e.activacion, null, 'lanzar termina la activación del Ogro');
});

test('el Halfling con el balón que aterriza de pie en la zona rival puede anotar', () => {
  const e = montar();
  colocar(e, 'hu1', 7, 3);             // el Ogro plantado cerca de la zona de anotación
  const h = colocar(e, 'hu6', 8, 3);
  e.balon = { portador: 'hu6' };
  activar(e, 'hu1', 'ttm', { azar: dadoFijo(6) });
  // Objetivo (7,1): rápido. PS 5+: 6 natural → excelente. Dispersión: 7,2,2 → (7,2),(7,1),(7,0).
  // Aterrizaje en (7,0) —la zona de anotación—: AG 3+ con 6 → de pie.
  const r = lanzarCompanero(e, 'hu6', 7, 1, { azar: dadoGuionizado(6, 7, 2, 2, 6) });
  assert.equal(r.resultado, 'de_pie');
  assert.deepEqual([h.x, h.y], [7, 0]);
  assert.equal(e.balon.portador, 'hu6', 'conserva el balón en el vuelo');
});

test('lanzamiento mediocre: −1 al aterrizar; el fallo tira la armadura y no es turnover sin balón', () => {
  const e = montar();
  colocar(e, 'hu1', 7, 13);
  const h = colocar(e, 'hu6', 8, 13);
  activar(e, 'hu1', 'ttm', { azar: dadoFijo(6) });
  // PS 5+: sale 3 (mod 3 < 5, no pifia) → mediocre. Dispersión 7,7,7 desde (7,10) →
  // (7,13)?? ocupada por el Ogro… mejor objetivo (5,10): dispersión 2,2,2 → (5,7).
  // Aterrizaje AG 3+ −1 (mediocre) → necesita 4: sale 3 → cae. Armadura 4,3=7 < 7+?
  // Halfling AR 7+: 7 ≥ 7 ¡rompe! Heridas 2,2=4 → aturdido (tabla Escurridizos: 2-6).
  const r = lanzarCompanero(e, 'hu6', 5, 10, { azar: dadoGuionizado(3, 2, 2, 2, 3, 4, 3, 2, 2) });
  assert.equal(r.resultado, 'caida');
  assert.deepEqual([h.x, h.y], [5, 7]);
  assert.equal(h.postura, 'aturdido');
  assert.equal(e.turnover, null, 'sin balón no hay cambio de turno');
});

test('la pifia rebota desde el lanzador, y el portador que se estampa es turnover', () => {
  const e = montar();
  colocar(e, 'hu1', 7, 13);
  const h = colocar(e, 'hu6', 8, 13);
  e.balon = { portador: 'hu6' };
  activar(e, 'hu1', 'ttm', { azar: dadoFijo(6) });
  // PS 5+: 1 natural → pifia. Rebote 1 desde el Ogro: D8 2 (↑) → (7,12).
  // Aterrizaje AG 3+ −1 (pifia) → 4: sale 2 → cae. Armadura 3,3=6 < 7 no rompe…
  // pero suelta el balón al caer: rebote D8 5 → (8,12).
  const r = lanzarCompanero(e, 'hu6', 7, 10, { azar: dadoGuionizado(1, 2, 2, 5, 3, 3) });
  assert.equal(r.resultado, 'caida');
  assert.deepEqual([h.x, h.y], [7, 12]);
  assert.equal(h.postura, 'tumbado');
  assert.equal(e.turnover.causa, 'portador_derribado');
  assert.deepEqual([e.balon.x, e.balon.y], [8, 12]);
});

test('aterrizaje forzoso: el aplastado es derribado y el lanzado rebota y se cae', () => {
  const e = montar();
  colocar(e, 'hu1', 7, 13);
  const h = colocar(e, 'hu6', 8, 13);
  const pobre = colocar(e, 'ch5', 7, 10); // beastman en la casilla objetivo (AR 9+)
  activar(e, 'hu1', 'ttm', { azar: dadoFijo(6) });
  // PS 5+: 5 → excelente. Dispersión 2,7,7 desde (7,10) → (7,9),(7,10),(7,11)…
  // termina en (7,11)? No: 2=↑ →(7,9); 7=↓ →(7,10); 7=↓ →(7,11). (7,11) libre…
  // para caer SOBRE el beastman hace falta acabar en (7,10): dispersión 2,7,5:
  // (7,9),(7,10),(8,10)… vaya. Más fácil: dispersión 7,2,2 → (7,11),(7,10),(7,9)…
  // Elegimos 2,2,7: (7,9),(7,8),(7,9)?? Para no liarnos: dispersión 5,4,7 →
  // (8,10),(7,10)… 4=← (6,10)… Simplemente: 7,2,7 → (7,11),(7,10),(7,11): libre.
  // Mejor ponemos al beastman en (7,11) y dispersamos 7,7,2 → (7,11),(7,12),(7,11):
  // acaba en (7,11) = beastman.
  pobre.x = 7; pobre.y = 11;
  // Aplastado: armadura 6,4=10 ≥ 9 rompe; heridas 3,2=5 → aturdido.
  // Rebote del lanzado: D8 5 (→) → (8,11) libre. Se cae: armadura 2,2=4 < 7 no rompe.
  const r = lanzarCompanero(e, 'hu6', 7, 10, {
    azar: dadoGuionizado(5, 7, 7, 2, 6, 4, 3, 2, 5, 2, 2),
  });
  assert.equal(r.resultado, 'forzoso');
  assert.equal(pobre.postura, 'aturdido', 'el aplastado paga la armadura');
  assert.deepEqual([h.x, h.y], [8, 11]);
  assert.equal(h.postura, 'tumbado', 'el lanzado se cae sin chequeo');
  assert.equal(e.turnover, null);
});

test('Siempre hambriento: con doble 1 el Troll se come al Goblin, sin apotecario que valga', () => {
  const e = montar('black_orc', 'human');
  colocar(e, 'bl1', 7, 13);            // Troll Adiestrado (Siempre hambriento)
  const g = colocar(e, 'bl9', 8, 13);  // Goblin
  activar(e, 'bl1', 'ttm', { azar: dadoGuionizado(4) }); // Realmente estúpido: 4+2… no hay compañero
  // ¡Ojo!: el Troll Adiestrado tiene Realmente estúpido: el 4 de arriba (+2 por el
  // goblin adyacente) lo pasa. Ahora el lanzamiento: hambre 1 → bocado 1 → devorado.
  const r = lanzarCompanero(e, 'bl9', 7, 10, { azar: dadoGuionizado(1, 1) });
  assert.equal(r.resultado, 'devorado');
  assert.equal(g.situacion, 'devorado');
  assert.equal(e.turnover, null, 'sin balón, la merienda no es cambio de turno');

  // Con balón sí lo es (FAQ).
  const e2 = montar('black_orc', 'human');
  colocar(e2, 'bl1', 7, 13);
  const g2 = colocar(e2, 'bl9', 8, 13);
  e2.balon = { portador: 'bl9' };
  activar(e2, 'bl1', 'ttm', { azar: dadoGuionizado(4) });
  // hambre 1 → bocado 1 → devorado; el balón rebota desde el goblin: D8 2 → (8,12).
  const r2 = lanzarCompanero(e2, 'bl9', 7, 10, { azar: dadoGuionizado(1, 1, 2) });
  assert.equal(r2.resultado, 'devorado');
  assert.equal(e2.turnover.causa, 'companero_devorado');
});

test('solo se lanza a Humanoides bala adyacentes y a corta distancia', () => {
  const e = montar();
  colocar(e, 'hu1', 7, 13);
  colocar(e, 'hu6', 8, 13);
  colocar(e, 'hu7', 6, 13);            // línea sin Humanoide bala
  activar(e, 'hu1', 'ttm', { azar: dadoFijo(6) });
  assert.throws(() => lanzarCompanero(e, 'hu7', 7, 10, { azar: dadoFijo(5) }), /Humanoide bala/);
  assert.throws(() => lanzarCompanero(e, 'hu6', 7, 2, { azar: dadoFijo(5) }), /dos primeras secciones/);
});

test('Apuñalar: armadura sin modificadores; si rompe, herida sin derribo del atacante', () => {
  const e = montar('skaven', 'human');
  colocar(e, 'sk5', 7, 13);            // Gutter Runner (Apuñalar)
  const v = colocar(e, 'hu7', 7, 12);  // línea AR 9+
  activar(e, 'sk5', 'stab', { azar: dadoFijo(6) });
  // Armadura 5,4=9 ≥ 9 rompe; heridas 4,4=8 → KO.
  const r = apunalar(e, 'hu7', { azar: dadoGuionizado(5, 4, 4, 4) });
  assert.equal(v.situacion, 'ko');
  assert.equal(e.turnover, null, 'apuñalar no es cambio de turno');
  assert.equal(e.activacion, null);

  // Sin romper, no pasa nada de nada.
  const e2 = montar('skaven', 'human');
  colocar(e2, 'sk5', 7, 13);
  const v2 = colocar(e2, 'hu7', 7, 12);
  activar(e2, 'sk5', 'stab', { azar: dadoFijo(6) });
  const r2 = apunalar(e2, 'hu7', { azar: dadoGuionizado(4, 4) });
  assert.equal(v2.postura, 'de_pie');
  assert.equal(v2.situacion, 'campo');
});

test('el puñal no derriba: la víctima herida con el balón lo suelta desde su casilla', () => {
  const e = montar('skaven', 'human');
  colocar(e, 'sk5', 7, 13);
  const v = colocar(e, 'hu4', 7, 12);  // catcher AR 8+, portador
  e.balon = { portador: 'hu4' };
  activar(e, 'sk5', 'stab', { azar: dadoFijo(6) });
  // Armadura 5,4=9 ≥ 8 rompe; balón rebota D8 2 → (7,11); heridas 2,3=5 → aturdido.
  apunalar(e, 'hu4', { azar: dadoGuionizado(5, 4, 2, 2, 3) });
  assert.equal(v.postura, 'aturdido');
  assert.deepEqual([e.balon.x, e.balon.y], [7, 11]);
  assert.equal(e.turnover, null, 'el portador era rival: ningún cambio de turno');
});

test('Proyectil de vómito: con 1 se lo traga el propio Troll', () => {
  const e = montar('black_orc', 'human');
  const troll = colocar(e, 'bl1', 7, 13); // AR 10+
  colocar(e, 'hu7', 7, 12);
  activar(e, 'bl1', 'vomit', { azar: dadoGuionizado(4) }); // Realmente estúpido: 4 sin ayuda ✓
  // Vómito: 1 → va contra sí mismo. Armadura propia 6,5=11 ≥ 10 rompe; heridas 4,4=8
  // → KO (el Troll Adiestrado no tiene Cabeza dura: eso es cosa de Ogros). La
  // Regeneración no aplica: solo salva de las lesiones, no de los KO.
  const r = vomitar(e, 'hu7', { azar: dadoGuionizado(1, 6, 5, 4, 4) });
  assert.equal(r.autolesion, true);
  assert.equal(troll.situacion, 'ko', 'el Troll se noquea con su propio vómito');
  assert.equal(e.turnover, null, 'sin balón no hay cambio de turno');

  // Con 2+ lo paga el rival.
  const e2 = montar('black_orc', 'human');
  colocar(e2, 'bl1', 7, 13);
  const v = colocar(e2, 'hu7', 7, 12); // AR 9+
  activar(e2, 'bl1', 'vomit', { azar: dadoGuionizado(4) });
  // 5 → al rival. Armadura 5,4=9 rompe; heridas 5,4=9 → KO.
  vomitar(e2, 'hu7', { azar: dadoGuionizado(5, 5, 4, 5, 4) });
  assert.equal(v.situacion, 'ko');
});

test('las acciones sin movimiento no pueden dar pasos', async () => {
  const { paso } = await import('../src/engine/movimiento.js');
  const e = montar('skaven', 'human');
  colocar(e, 'sk5', 7, 13);
  colocar(e, 'hu7', 7, 12);
  activar(e, 'sk5', 'stab', { azar: dadoFijo(6) });
  assert.throws(() => paso(e, 6, 13, { azar: dadoFijo(6) }), /no incluye movimiento/);
});
