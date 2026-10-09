import test from 'node:test';
import assert from 'node:assert/strict';
import { empaquetar, desempaquetar, aEnlace, desdeEnlace, VERSION_ESTADO } from '../src/enlace.js';

/** Estado representativo: dos equipos de 13, 11 en campo, segunda parte. */
const partidaDeEjemplo = () => {
  const jugador = (i, t) => ({
    id: `p${t}${i}`, k: 'human_lineman', num: i + 1, st: i < 11 ? 'pitch' : 'reserve',
    x: i % 15, y: t ? 12 - (i % 6) : 13 + (i % 6),
    prone: false, stun: false, stunAt: -1, act: false, mv: 0,
  });
  const equipo = (t) => ({
    name: 'Los Machacas del Imperio', race: 'human', color: t, score: 1,
    rr: 3, rrMax: 3, turn: 5, df: 2, ff: 1, apo: 1, apoUsed: false,
    players: Array.from({ length: 13 }, (_, i) => jugador(i, t)),
  });
  return {
    teams: [equipo(0), equipo(1)], ball: null, carrier: 'p05', active: 0,
    half: 2, gturn: 11, phase: 'turn', kicker: 1, weather: { t: 'Clima perfecto' },
  };
};

test('la partida sobrevive al viaje de ida y vuelta sin perder nada', async () => {
  const antes = partidaDeEjemplo();
  const despues = await desempaquetar(await empaquetar(antes));
  assert.deepEqual(despues, antes);
});

test('una partida de media hora cabe de sobra en un enlace de mensajería', async () => {
  const carga = await empaquetar(partidaDeEjemplo());
  const enlace = await aEnlace(partidaDeEjemplo(), 'https://bbweb.example/');
  // El límite práctico para que WhatsApp o Telegram no destrocen el enlace ronda los 2.000.
  assert.ok(enlace.length < 2000, `el enlace mide ${enlace.length} caracteres`);
  assert.ok(carga.length < 1500, `la carga mide ${carga.length} caracteres`);
});

test('el enlace solo usa caracteres que sobreviven a una URL', async () => {
  const carga = await empaquetar(partidaDeEjemplo());
  assert.match(carga, /^\d+\.[A-Za-z0-9_-]+$/, 'base64url: ni +, ni /, ni =');
});

test('la partida viaja en el fragmento, que nunca llega al servidor', async () => {
  const enlace = await aEnlace(partidaDeEjemplo(), 'https://bbweb.example/sala?x=1');
  const url = new URL(enlace);
  assert.ok(url.hash.startsWith('#g='), 'va en el fragmento');
  assert.equal(url.search, '?x=1', 'no se cuela en la query');
});

test('una visita normal a la web no trae partida, y eso no es un error', async () => {
  assert.equal(await desdeEnlace('https://bbweb.example/'), null);
  assert.equal(await desdeEnlace('https://bbweb.example/#otracosa=1'), null);
});

test('un enlace del futuro se rechaza diciendo qué hacer', async () => {
  const carga = await empaquetar(partidaDeEjemplo());
  const futuro = `${VERSION_ESTADO + 1}.${carga.split('.')[1]}`;
  await assert.rejects(() => desempaquetar(futuro), /versión más nueva.*Actualiza/s);
});

test('un enlace de formato viejo se rechaza diciendo qué pasa', async () => {
  const carga = await empaquetar(partidaDeEjemplo());
  await assert.rejects(
    () => desempaquetar(`0.${carga.split('.')[1]}`),
    /formato antiguo.*empezarse de nuevo/s,
  );
});

test('un enlace cortado al copiarlo avisa en vez de romperse por dentro', async () => {
  const carga = await empaquetar(partidaDeEjemplo());
  await assert.rejects(() => desempaquetar(carga.slice(0, carga.length - 40)), /incompleto o se ha copiado a medias/);
  await assert.rejects(() => desempaquetar('esto no es una partida'), /no contiene una partida|incompleto/);
  await assert.rejects(() => desempaquetar(''), /no contiene una partida/);
});

test('el enlace se puede volver a leer desde la URL completa', async () => {
  const antes = partidaDeEjemplo();
  const recuperado = await desdeEnlace(await aEnlace(antes, 'https://bbweb.example/'));
  assert.deepEqual(recuperado, antes);
});

test('el enlace recorta el registro al tramo que el rival no ha visto', async () => {
  const { tramoRival, recortarParaEnlace, MAX_EVENTOS_ENLACE } = await import('../src/enlace.js');
  // Registro sintético: turno mío → mis cosas → turno rival → sus cosas → mi turno nuevo.
  const reg = [
    { tipo: 'turno', equipo: 'Míos', numero: 2 },
    { tipo: 'esquivar', jugador: 'a1' }, { tipo: 'touchdown', equipo: 'Míos' },
    { tipo: 'turno', equipo: 'Rivales', numero: 2 },
    { tipo: 'placaje', atacante: 'b1', objetivo: 'a2' }, { tipo: 'armadura', jugador: 'a2' },
    { tipo: 'turno', equipo: 'Rivales', numero: 3 },   // celebración: dos turnos seguidos
    { tipo: 'pase', jugador: 'b3' },
    { tipo: 'turno', equipo: 'Míos', numero: 3 },      // mi turno nuevo (lo marca el enlace)
  ];
  const tramo = tramoRival(reg, 'Míos');
  assert.equal(tramo[0].numero, 2, 'arranca en el PRIMER turno rival del tramo');
  assert.equal(tramo.length, 6, 'los dos turnos rivales y mi marcador nuevo');

  // Un registro kilométrico queda acotado y con la marca de recorte.
  const estado = { activo: 0, equipos: [{ nombre: 'Míos' }, { nombre: 'Rivales' }],
    registro: Array.from({ length: 900 }, (_, i) => ({ tipo: 'esquivar', i })) };
  const r = recortarParaEnlace(estado);
  assert.equal(r.registro.length, 40, 'sin marcador rival: cola de cortesía, no el tope');
  assert.equal(r.registroRecortado, 860);
  assert.ok(MAX_EVENTOS_ENLACE >= 40);
});

test('un enlace de final de partido del bot cabe en mensajería', async () => {
  const { jugarPartido } = await import('../src/bot/bot-aleatorio.js');
  const { aEnlace } = await import('../src/enlace.js');
  const e = jugarPartido('human', 'black_orc', 7919);
  const enlace = await aEnlace(e, 'https://bbweb-umber.vercel.app/');
  assert.ok(enlace.length < 4500, `mide ${enlace.length}`);
});
