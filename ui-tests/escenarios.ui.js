// Pruebas de interfaz de los escenarios del catálogo (docs/design/escenarios.md),
// en un móvil de 390×800 con Chrome real. Dados fijados con ?semilla=N; los estados de
// partida se construyen con el propio motor y se inyectan antes de cargar.

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, pulsar, estadoDe, leerTarjetas, despejar } from './ayuda.js';
import { crearEquipo } from '../src/engine/equipo.js';
import { ROSTERS_1000K } from '../src/data/rosters-iniciales.js';
import { crearPartido, jugador } from '../src/engine/partido.js';
import { empezarTurno, terminarTurno } from '../src/engine/secuencia.js';
import { activar, terminarAccion } from '../src/engine/movimiento.js';
import { placar } from '../src/engine/placaje.js';
import { azarConSemilla } from '../src/engine/dice.js';
import { aEnlace } from '../src/enlace.js';

let h;
before(async () => { h = await arrancar(); });
after(async () => { await h.cerrar(); });

/** Partido a mitad de turno, con los jugadores donde se le pida. */
function estadoTurno(local, visitante, colocar, { balon = null, activo = 0 } = {}) {
  const e = crearPartido(
    crearEquipo(local, ROSTERS_1000K[local], { nombre: 'Locales' }),
    crearEquipo(visitante, ROSTERS_1000K[visitante], { nombre: 'Visitantes' }),
  );
  e.fase = 'turno'; e.activo = activo; e.kicker = 1 - activo; e.mitad = 1;
  e.equipos[0].turno = 1; e.equipos[1].turno = 1;
  for (const [id, x, y, postura = 'de_pie'] of colocar) {
    const j = jugador(e, id);
    j.situacion = 'campo'; j.x = x; j.y = y; j.postura = postura;
  }
  if (balon) e.balon = balon;
  return e;
}
const celda = (x, y) => `.c[data-x="${x}"][data-y="${y}"]`;

test('flujo completo: inicio → previa → despliegues → patada → primer turno', async () => {
  const { pagina, errores, ctx } = await h.pagina();
  await pagina.goto(h.base + '?semilla=7');
  await pulsar(pagina, 'button[data-act="pick"][data-side="a"][data-team="skaven"]');
  assert.equal(await pagina.locator('.equ-grid button.sel[data-side="a"]').getAttribute('data-team'), 'skaven');
  await pulsar(pagina, 'button[data-act="empezar"]');

  assert.equal(await pagina.locator('.sheet h2').textContent(), 'Previa del partido');
  await pulsar(pagina, '.sheet button[data-act="saque"][data-v="patear"]');

  for (const formacion of ['ziggurat', 'caja']) {
    await despejar(pagina);                                   // «le toca a…»
    await pulsar(pagina, `button[data-act="formacion"][data-v="${formacion}"]`);
    assert.match(await pagina.locator(`button[data-act="formacion"][data-v="${formacion}"]`).textContent(), /✓/);
    await pulsar(pagina, 'button[data-act="confirmar"]');
  }
  await despejar(pagina);
  await pulsar(pagina, 'button[data-act="centro"]');
  await pulsar(pagina, 'button[data-act="patada_go"]');
  await despejar(pagina);                                     // evento de patada + relevo
  // Si el evento abrió la Carga u otro pendiente, se cierra para llegar al turno.
  for (let i = 0; i < 3; i++) {
    if (await pagina.locator('button[data-act="evento_fin"]').count()) await pulsar(pagina, 'button[data-act="evento_fin"]');
    await despejar(pagina);
  }
  const e = await estadoDe(pagina);
  assert.ok(['turno', 'recepcion_libre'].includes(e.fase), `fase ${e.fase}`);
  assert.deepEqual(errores, []);
  await ctx.close();
});

test('placaje: la vista previa ilumina apoyos y anuncia los dados antes de tirar', async () => {
  const estado = estadoTurno('human', 'chaos_chosen', [
    ['hu2', 7, 13], ['ch5', 7, 12],        // atacante y objetivo
    ['hu8', 8, 12],                        // apoyo ofensivo limpio
    ['hu9', 6, 12], ['ch6', 5, 12],        // apoyo anulado: ch6 marca a hu9
    ['ch7', 6, 14],                        // apoyo defensivo limpio
  ]);
  const { pagina, errores, ctx } = await h.pagina({ estado });
  await pagina.goto(h.base + '?semilla=3');
  await despejar(pagina);
  await pulsar(pagina, celda(7, 13));
  await pulsar(pagina, 'button[data-act="accion"][data-v="block"]');
  await pulsar(pagina, celda(7, 12));

  assert.equal(await pagina.locator('.tk.apoyo').count(), 1, 'un apoyo ofensivo (hu9 está marcado)');
  assert.equal(await pagina.locator('.tk.apoyo-def').count(), 1, 'un apoyo defensivo');
  assert.match(await pagina.locator('#info').textContent(), /FU 4 contra 4 → un dado/);
  assert.match(await pagina.locator('#chips').textContent(), /Tirar 1 dado/);
  assert.equal((await estadoDe(pagina)).registro.filter((x) => x.tipo === 'placaje').length, 0, 'aún no se ha tirado');

  await pulsar(pagina, 'button[data-act="placar_go"]');
  // Decisiones intermedias (empuje tocando casilla, impulso…) hasta que salgan tarjetas.
  for (let i = 0; i < 6; i++) {
    if (await pagina.locator('button[data-act="decision"]').count()) { await pulsar(pagina, 'button[data-act="decision"]'); continue; }
    if (await pagina.locator('.c.ok').count() && !(await pagina.locator('#wrap:not([hidden])').count())) { await pulsar(pagina, '.c.ok'); continue; }
    break;
  }
  const tarjetas = await leerTarjetas(pagina);
  assert.match(tarjetas[0], /placa a/);
  assert.ok(tarjetas.length >= 2, `tarjetas: ${tarjetas.join(' | ')}`);
  assert.deepEqual(errores, []);
  await ctx.close();
});

test('pase: el campo se pinta por alcances y el pase se confirma antes de lanzar', async () => {
  const estado = estadoTurno('skaven', 'human', [
    ['sk2', 7, 18], ['sk5', 7, 14], ['hu7', 2, 3],
  ], { balon: { portador: 'sk2' } });
  const { pagina, errores, ctx } = await h.pagina({ estado });
  await pagina.goto(h.base + '?semilla=11');
  await despejar(pagina);
  await pulsar(pagina, celda(7, 18));
  await pulsar(pagina, 'button[data-act="accion"][data-v="pass"]');
  await pulsar(pagina, 'button[data-act="lanzar"]');

  for (const clase of ['al-q', 'al-s', 'al-l', 'al-b']) {
    assert.ok(await pagina.locator(`.c.${clase}`).count() > 0, `hay casillas ${clase}`);
  }
  await pulsar(pagina, celda(7, 14));                 // 4 casillas: pase corto
  assert.match(await pagina.locator('#info').textContent(), /Pase corto \(−1\)/);
  assert.equal((await estadoDe(pagina)).registro.filter((x) => x.tipo === 'pase').length, 0, 'aún no se ha lanzado');

  await pulsar(pagina, 'button[data-act="pase_go"]');
  for (let i = 0; i < 4; i++) {
    if (await pagina.locator('button[data-act="decision"][data-v="no"]').count()) { await pulsar(pagina, 'button[data-act="decision"][data-v="no"]'); continue; }
    break;
  }
  const tarjetas = await leerTarjetas(pagina);
  assert.match(tarjetas[0], /Pase corto/);
  assert.deepEqual(errores, []);
  await ctx.close();
});

test('enlace: al abrirlo se narra la jugada del rival antes de devolver el control', async () => {
  const azar = azarConSemilla(4242);
  const e = estadoTurno('human', 'black_orc', [
    ['hu2', 7, 13], ['hu7', 6, 13], ['bl2', 7, 12], ['bl9', 3, 8],
  ], { balon: { portador: 'bl9' }, activo: 1 });
  e.kicker = 0; e.recibioAlEmpezar = 1;
  e.equipos[1].turno = 0;
  empezarTurno(e);
  activar(e, 'bl2', 'block', { azar });
  placar(e, 'bl2', 'hu2', { azar, opciones: { impulso: () => false } });
  terminarAccion(e, { azar });
  terminarTurno(e, { azar });
  const enlace = await aEnlace(e, h.base);

  const { pagina, errores, ctx } = await h.pagina();
  await pagina.goto(enlace);
  const tarjetas = await leerTarjetas(pagina, 'Mientras no mirabas…');
  assert.ok(tarjetas.some((t) => /placa a/.test(t)), `tarjetas: ${tarjetas.join(' | ')}`);
  assert.equal(await pagina.evaluate(() => location.hash), '', 'la URL queda limpia');
  assert.match(await pagina.locator('.sheet h2').textContent(), /Turno/, 'y después, el relevo');
  assert.deepEqual(errores, []);
  await ctx.close();
});

test('apotecario: el modal aparece al quedar alguien KO y lo devuelve a su casilla', async () => {
  const estado = estadoTurno('shambling_undead', 'human', [['sh1', 7, 13], ['sh7', 3, 20], ['hu8', 3, 5]]);
  const ko = jugador(estado, 'hu7');
  Object.assign(ko, { situacion: 'ko', x: -1, y: -1, ultimaCasilla: { x: 7, y: 12 }, apoVentana: true, koPorPublico: false });
  const { pagina, errores, ctx } = await h.pagina({ estado });
  await pagina.goto(h.base + '?semilla=5');
  assert.equal(await pagina.locator('.sheet h2').textContent(), 'Apotecario');
  await pulsar(pagina, 'button[data-act="apo_si"]');
  const j = (await estadoDe(pagina)).jugadores.hu7;
  assert.deepEqual([j.situacion, j.postura, j.x, j.y], ['campo', 'aturdido', 7, 12]);
  assert.deepEqual(errores, []);
  await ctx.close();
});

test('determinismo: la misma semilla da exactamente los mismos dados', async () => {
  const estado = estadoTurno('human', 'chaos_chosen', [['hu2', 7, 13], ['ch5', 7, 12]]);
  const dados = [];
  for (let vuelta = 0; vuelta < 2; vuelta++) {
    const { pagina, ctx } = await h.pagina({ estado });
    await pagina.goto(h.base + '?semilla=99');
    await despejar(pagina);
    await pulsar(pagina, celda(7, 13));
    await pulsar(pagina, 'button[data-act="accion"][data-v="block"]');
    await pulsar(pagina, celda(7, 12));
    await pulsar(pagina, 'button[data-act="placar_go"]');
    const e = await estadoDe(pagina);
    dados.push(JSON.stringify(e.registro.filter((x) => x.tipo === 'placaje').map((x) => x.dados)));
    await ctx.close();
  }
  assert.equal(dados[0], dados[1]);
});
