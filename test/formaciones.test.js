import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMACIONES, asignarFormacion } from '../src/data/formaciones.js';
import { EQUIPOS } from '../src/data/equipos.js';
import { ROSTERS_1000K } from '../src/data/rosters-iniciales.js';
import { crearEquipo } from '../src/engine/equipo.js';
import { crearPartido } from '../src/engine/partido.js';
import { desplegar, validarDespliegue } from '../src/engine/secuencia.js';
import { filaLos } from '../src/engine/tablero.js';

test('las 5 formaciones son legales para los 9 equipos, en las dos mitades', () => {
  for (const [raza, roster] of Object.entries(ROSTERS_1000K)) {
    const e = crearPartido(
      crearEquipo(raza, roster, { nombre: 'A' }),
      crearEquipo(raza, roster, { nombre: 'B' }),
    );
    e.fase = 'despliegue_kicker'; e.kicker = 0;
    const costes = Object.fromEntries(Object.entries(EQUIPOS[raza].pos).map(([k, p]) => [k, p.coste]));
    for (const equipo of [0, 1]) {
      e.fase = equipo === 0 ? 'despliegue_kicker' : 'despliegue_receiver';
      for (const [clave, F] of Object.entries(FORMACIONES)) {
        const mios = Object.values(e.jugadores).filter((j) => j.equipo === equipo);
        for (const j of mios) { j.situacion = 'reserva'; j.x = j.y = -1; }
        const sitios = asignarFormacion(F, mios.slice(0, 11), costes);
        assert.equal(sitios.length, Math.min(11, mios.length), `${raza}/${clave}`);
        const los = filaLos(equipo);
        for (const { id, x, df } of sitios) desplegar(e, id, x, equipo === 0 ? los + df : los - df);
        assert.deepEqual(validarDespliegue(e, equipo), [], `${raza} ${clave} equipo ${equipo}`);
      }
    }
  }
});

test('los roles se reparten con cabeza: línea barata, balón a quien lo juega', () => {
  const e = crearPartido(
    crearEquipo('skaven', ROSTERS_1000K.skaven, { nombre: 'S' }),
    crearEquipo('human', ROSTERS_1000K.human, { nombre: 'H' }),
  );
  const costes = Object.fromEntries(Object.entries(EQUIPOS.skaven.pos).map(([k, p]) => [k, p.coste]));
  const mios = Object.values(e.jugadores).filter((j) => j.equipo === 0);
  const sitios = asignarFormacion(FORMACIONES.lanzamiento, mios.slice(0, 11), costes);
  const porId = Object.fromEntries(sitios.map((s) => [s.id, s]));
  // El thrower skaven (Manos seguras + Pasar) ocupa la casilla de balón, al fondo.
  const thrower = mios.find((j) => j.pos === 'skaven_thrower');
  assert.equal(porId[thrower.id].df, 7, 'el thrower va a la casilla del balón');
  // La línea de scrimmage son los baratos (línea a 50k), no la Rata Ogro.
  const rata = mios.find((j) => j.pos === 'skaven_rat_ogre');
  assert.notEqual(porId[rata.id].df, 0, 'la Rata Ogro no se desperdicia en la línea');
});

test('con 8 jugadores la formación rellena por prioridad y sigue siendo legal', () => {
  const e = crearPartido(
    crearEquipo('human', ROSTERS_1000K.human, { nombre: 'A' }),
    crearEquipo('human', ROSTERS_1000K.human, { nombre: 'B' }),
  );
  e.fase = 'despliegue_kicker'; e.kicker = 0;
  const todos = Object.values(e.jugadores).filter((j) => j.equipo === 0);
  // Solo quedan 8 sanos: el resto está en la enfermería.
  for (const j of todos.slice(8)) j.situacion = 'lesionado';
  const mios = todos.slice(0, 8);
  const sitios = asignarFormacion(FORMACIONES.ziggurat, mios, {});
  assert.equal(sitios.length, 8);
  for (const { id, x, df } of sitios) desplegar(e, id, x, 13 + df);
  assert.deepEqual(validarDespliegue(e, 0), []);
});
