// La interfaz móvil. Toda la lógica de juego vive en src/engine/; aquí solo hay
// pantalla, toques y las decisiones de entrenador.
//
// Las decisiones (elegir dado, casilla de empuje, reroll…) se preguntan con hojas
// táctiles, no con diálogos del navegador. El truco: el estado es serializable y los
// dados van inyectados, así que una acción se ejecuta hasta el punto de decisión, se
// descarta, se pregunta con calma y se re-ejecuta con los MISMOS dados grabados y la
// respuesta puesta. Determinista, y el motor ni se entera (ver conDecisiones()).

import { azarReal } from '../engine/dice.js';
import { EQUIPOS } from '../data/equipos.js';
import { ROSTERS_1000K } from '../data/rosters-iniciales.js';
import { EQUIPOS_ES, POSICIONES_ES, FICHA_ES, HABILIDADES_ES } from '../data/nombres.es.js';
import { FORMACIONES, asignarFormacion } from '../data/formaciones.js';
import { crearEquipo } from '../engine/equipo.js';
import { crearPartido, jugador, enCasilla, tieneZonaDefensa, posicionBalon, marcadoresDe } from '../engine/partido.js';
import { ANCHO, ALTO, filaLos, sonAdyacentes } from '../engine/tablero.js';
import { activar, paso, saltar, levantarse, terminarAccion } from '../engine/movimiento.js';
import { placar, placarEnPenetracion, fuerzasPlacaje, apoyos } from '../engine/placaje.js';
import { pase, entrega, alcance } from '../engine/pase.js';
import { falta } from '../engine/falta.js';
import { lanzarCompanero } from '../engine/lanzar.js';
import { apunalar, vomitar } from '../engine/especiales.js';
import { puedeCurar, curarKO, curarLesion, rechazarCura } from '../engine/apotecario.js';
import { tiene } from '../data/habilidades.js';
import {
  prePartido, elegirSaque, desplegar, validarDespliegue, confirmarDespliegue,
  patada, moverEnEvento, terminarEvento, recepcionLibre, terminarTurno, comprobarTouchdown,
  TABLA_PATADA,
} from '../engine/secuencia.js';
import { aEnlace, desdeEnlace, tramoRival } from '../enlace.js';

const KEY = 'bbweb-v1';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

let E = null;                                    // estado del partido (motor)
let ui = {
  sel: null, modo: null, hoja: null, decision: null, ttmCompanero: null,
  preview: null,        // vista previa pendiente de confirmar (placaje, pase, patada)
  resultado: null,      // tarjetas de resultado de la última acción
  resultadoIdx: 0,
  inicio: { a: 'human', b: 'black_orc' },        // selección de la pantalla de inicio
  decisorVisto: null,                            // a quién se le mostró ya el «te toca»
  eventoInfo: null,                              // resumen del último evento de patada
  formacion: {},                                 // última formación aplicada por equipo
};
let undoStack = [];
let enCurso = false;                             // evita dobles toques durante una acción

/* ---------- persistencia y deshacer ---------- */

const guardar = () => { try { localStorage.setItem(KEY, JSON.stringify(E)); } catch {} };
function deshacer() {
  if (!undoStack.length) return toast('Nada que deshacer.');
  E = JSON.parse(undoStack.pop());
  ui.sel = null; ui.modo = null; ui.hoja = null; ui.decision = null;
  ui.preview = null; ui.resultado = null; ui.resultadoIdx = 0; ui.ttmCompanero = null;
  ui.decisorVisto = quienDecide();               // deshacer no es un cambio de manos
  guardar(); render();
}

/* ---------- el bucle de decisiones ----------
   ejecutar(fn) corre fn(azar, decidir). Si fn necesita una decisión que aún no tiene
   respuesta, se lanza NecesitaDecision: se descarta la ejecución parcial, se pregunta
   con una hoja (o tocando el tablero) y se repite la acción con los dados grabados. */

class NecesitaDecision extends Error {
  constructor(pregunta) { super('decision'); this.pregunta = pregunta; }
}

async function ejecutar(fn) {
  if (enCurso) return false;
  enCurso = true;
  const snap = JSON.stringify(E);
  const dados = [];
  const respuestas = [];
  try {
    for (let i = 0; i < 60; i++) {
      E = JSON.parse(snap);
      let iDado = 0, iResp = 0;
      const azar = (caras) => {
        if (iDado < dados.length && dados[iDado].caras === caras) return dados[iDado++].v;
        dados.length = iDado;                    // una rama nueva: los dados viejos ya no valen
        const v = azarReal(caras);
        dados.push({ caras, v }); iDado++;
        return v;
      };
      const decidir = (pregunta) => {
        if (iResp < respuestas.length) return respuestas[iResp++];
        throw new NecesitaDecision(pregunta);
      };
      try {
        const antes = JSON.parse(snap).registro.length;
        fn(azar, decidir);
        undoStack.push(snap);
        if (undoStack.length > 40) undoStack.shift();
        if (E.fase === 'turno') comprobarTouchdown(E);
        prepararResultados(E.registro.slice(antes));
        guardar(); render();
        return true;
      } catch (err) {
        E = JSON.parse(snap);
        if (!(err instanceof NecesitaDecision)) { toast(err.message); render(); return false; }
        render();
        respuestas.push(await preguntar(err.pregunta));
      }
    }
    toast('Demasiadas decisiones: acción cancelada.');
    return false;
  } finally {
    enCurso = false;
    ui.decision = null;
    render();
  }
}

/** Muestra la pregunta (hoja de botones, o casillas tocables en el tablero). */
function preguntar(pregunta) {
  return new Promise((resolver) => {
    ui.decision = { pregunta, resolver };
    render();
  });
}

/** Callbacks del motor expresados como decisiones. */
const CARA_ES = {
  player_down: '💀 Atacante derribado', both_down: '💥 Ambos derribados', push: '➡️ Empujón',
  stumble: '〰️ Desequilibrado', pow: '⭐ ¡POW!',
};

function opcionesMotor(decidir) {
  return {
    alFallar: (tipo, c, jugadorId) => {
      const Eq = E.equipos[E.activo];
      if (Eq.rerolls <= 0) return false;
      const detalle = c?.necesario ? ` — hacía falta ${c.necesario}+ y salió ${c.valor}` : '';
      const j = jugadorId && E.jugadores[jugadorId];
      const solo = j?.hab.find((h) => h.startsWith('loner_'));
      const aviso = solo ? ` ⚠ Solitario (${solo.slice(-1)}+): puede gastarse sin repetir` : '';
      return decidir({
        tipo: 'si_no', titulo: `Ha fallado: ${tipo}${detalle}${aviso}`,
        si: `Gastar reroll (quedan ${Eq.rerolls})`, no: 'Aceptar el resultado',
      });
    },
    elegirDado: (resultados, quien) => decidir({
      tipo: 'opciones',
      titulo: `Dados de placaje — elige ${E.equipos[quien === 'objetivo' ? 1 - E.activo : E.activo].nombre}`,
      opciones: resultados.map((r) => CARA_ES[r]),
    }),
    elegirEmpuje: (cands, ctx) => decidir({
      tipo: 'casilla',
      titulo: ctx.defensor ? 'Echarse a un lado: el DEFENSOR toca la casilla' : 'Toca la casilla del empujón',
      casillas: cands.map((c) => ({ x: c.x, y: c.y, fuera: c.fuera })),
    }),
    impulso: () => decidir({ tipo: 'si_no', titulo: '¿Hacer el impulso?', si: 'Ocupar la casilla', no: 'Quedarse' }),
    usarForcejear: (j) => decidir({
      tipo: 'si_no', titulo: `${etiqueta(j)} tiene Forcejear`,
      si: 'Usarlo: ambos tumbados sin armadura', no: 'No usarlo',
    }),
    elegirInterceptor: (ids) => {
      const i = decidir({
        tipo: 'opciones', titulo: `${E.equipos[1 - E.activo].nombre}: ¿interceptar el pase?`,
        opciones: [...ids.map((id) => etiqueta(jugador(E, id))), 'No interceptar'],
      });
      return i >= ids.length ? null : ids[i];
    },
    protestar: () => decidir({ tipo: 'si_no', titulo: '¡Expulsado!', si: 'Protestar al árbitro', no: 'Aceptarlo' }),
    usarSoborno: () => decidir({ tipo: 'si_no', titulo: 'Queda un Soborno', si: 'Untar al árbitro', no: 'Guardarlo' }),
  };
}

/* ---------- de quién es el turno de decidir ---------- */

function quienDecide() {
  if (!E) return null;
  if (E.pendiente) return E.pendiente.equipo;
  const enCarga = E.pendiente?.tipo === 'blitz_event';
  switch (enCarga ? 'turno' : E.fase) {
    case 'eleccion_saque': return E.ganadorSorteo;
    case 'despliegue_kicker': return E.kicker;
    case 'despliegue_receiver': return 1 - E.kicker;
    case 'patada': return E.kicker;
    case 'recepcion_libre': return 1 - E.kicker;
    case 'turno': return E.activo;
    default: return null;
  }
}

function tareaActual() {
  if (E.pendiente) {
    const EV = { solid_defence: 'Recoloca a tus jugadores desmarcados', quick_snap: 'Mueve una casilla a tus desmarcados', high_kick: 'Coloca a un jugador bajo el balón', blitz_event: '¡A la carga!: activa gratis a tus desmarcados (Mover, 1 Blitz, 1 Lanzar comp.) antes de que caiga el balón' };
    return EV[E.pendiente.tipo] ?? '';
  }
  switch (E.fase) {
    case 'despliegue_kicker': return 'Pateas: despliega a tus 11 (elige una formación o colócalos tocando el campo).';
    case 'despliegue_receiver': return 'Recibes: despliega a tus 11 (elige una formación o colócalos tocando el campo).';
    case 'patada': return 'Elige dónde pateas: toca una casilla de la mitad rival.';
    case 'recepcion_libre': return 'Recepción libre: toca al jugador que recibirá el balón.';
    case 'turno': return `Tu turno ${E.equipos[E.activo].turno} de 8: toca a un jugador para activarlo.`;
    default: return '';
  }
}

/* ---------- textos ---------- */

const etiqueta = (j) => `${POSICIONES_ES[j.pos] ?? j.pos} #${j.dorsal}`;

/** Anillo de peana por rol (convención NAF): gris línea, verde bloqueador, rojo
 *  blitzer, blanco lanzador, amarillo receptor, azul especialista, negro Big Guy. */
const ANILLO = {
  linea: '#b9c0c7', bloqueador: '#2f9e44', blitzer: '#e03131', lanzador: '#ffffff',
  receptor: '#ffd43b', especial: '#4dabf7', grande: '#17191c',
};
const rolDe = (j) => EQUIPOS[E.equipos[j.equipo].id]?.pos[j.pos]?.rol ?? 'linea';
const ROL_ES = {
  linea: 'Línea', bloqueador: 'Bloqueador', blitzer: 'Blitzer', lanzador: 'Lanzador',
  receptor: 'Receptor', especial: 'Especialista', grande: 'Jugador grande',
};
const POSTURA_ES = { de_pie: 'De pie', distraido: 'Distraído', tumbado: 'Tumbado', aturdido: 'Aturdido' };
const LESION_ES = {
  badly_hurt: 'Magullado (sin secuelas)', seriously_hurt: 'Apaleado (se pierde el próximo)',
  serious_injury: 'Herida grave (mal curada + próximo)', lasting_injury: 'Herida permanente',
  dead: 'MUERTO',
};
const SITUACION_ES = { reserva: 'En reservas', campo: 'En el campo', ko: 'KO', lesionado: 'Lesionado', expulsado: 'Expulsado' };

/** El balón, con forma de balón (óvalo con costura y cordones). */
const BALON_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <ellipse cx="12" cy="12" rx="9.2" ry="5.6" transform="rotate(-38 12 12)" fill="#8a5a2b" stroke="#53351a" stroke-width="1.3"/>
  <line x1="7.6" y1="15.4" x2="16.4" y2="8.6" stroke="#f0e6d2" stroke-width="1.2"/>
  <line x1="10" y1="10.6" x2="12" y2="13.2" stroke="#f0e6d2" stroke-width="1.1"/>
  <line x1="11.6" y1="9.4" x2="13.6" y2="12" stroke="#f0e6d2" stroke-width="1.1"/>
  <line x1="13.2" y1="8.2" x2="15.2" y2="10.8" stroke="#f0e6d2" stroke-width="1.1"/>
</svg>`;
const statLinea = (j) =>
  `MV ${j.perfil.mv} · FU ${j.perfil.fu} · AG ${j.perfil.ag}+ · PS ${j.perfil.ps}+ · AR ${j.perfil.ar}+`;
const habilidades = (j) => j.hab.map((h) => HABILIDADES_ES[h] ?? h).join(', ') || '—';

const CLIMA_ES = {
  sweltering_heat: 'Calor asfixiante', very_sunny: 'Muy soleado',
  perfect_conditions: 'Clima perfecto', pouring_rain: 'Lluvia torrencial', blizzard: 'Ventisca',
};
const CLIMA_FX = {
  sweltering_heat: 'D3 jugadores de cada equipo se retiran al acabar cada entrada',
  very_sunny: '−1 a los chequeos de Pase',
  perfect_conditions: 'sin efectos',
  pouring_rain: '−1 a recoger, atrapar e interceptar',
  blizzard: '−1 a Forzar la marcha; solo pases rápidos o cortos',
};
const EVENTO_ES = {
  get_the_ref: 'Árbitro intimidado', time_out: '¡Tiempo muerto!', solid_defence: 'Defensa sólida',
  high_kick: 'Patada alta', cheering_fans: 'Los hinchas animan', brilliant_coaching: 'Entrenador brillante',
  changing_weather: 'Clima cambiante', quick_snap: 'Anticipación', blitz_event: '¡A la carga!',
  dodgy_snack: 'Indigestión', pitch_invasion: 'Invasión de campo',
};

function lineaRegistro(ev) {
  const j = ev.jugador && E.jugadores[ev.jugador] ? `#${E.jugadores[ev.jugador].dorsal}` : ev.jugador ?? '';
  const c = ev.chequeo ? ` [${ev.chequeo.valor}${ev.chequeo.suma ? (ev.chequeo.suma > 0 ? '+' : '') + ev.chequeo.suma : ''} vs ${ev.chequeo.necesario}+ → ${ev.chequeo.exito ? 'OK' : 'falla'}]` : '';
  const porques = ev.chequeo?.mods?.length ? ` (${ev.chequeo.mods.map((m) => `${m.v > 0 ? '+' : ''}${m.v} ${m.porque}`).join('; ')})` : '';
  const T = {
    activacion: () => `— ${j} declara ${ev.accion}${ev.objetivo ? ` contra ${ev.objetivo}` : ''}`,
    esquivar: () => `${j} esquiva${c}${porques}`,
    esquivar_reroll: () => `  repite${ev.habilidad ? ' (Esquivar)' : ' (reroll)'}${c}`,
    rush: () => `${j} fuerza la marcha${ev.chequeo ? c : ` [${ev.d6}]`}`,
    recoger: () => `${j} recoge${c}${porques}`,
    atrapar: () => `${j} atrapa${c}${porques}`,
    pase: () => `${j} pasa (${ev.alcance})${c}${porques}`,
    intercepcion: () => `${j} intercepta${c}${porques}`,
    placaje: () => `${ev.atacante} placa a ${ev.objetivo} [${ev.dados.map((d) => CARA_ES[d]).join(' / ')}] FU ${ev.fuerzas.atacante}–${ev.fuerzas.objetivo}`,
    placaje_resultado: () => `  → ${CARA_ES[ev.resultado]}`,
    empujon: () => `${j} empujado a (${ev.a[0] + 1},${ev.a[1] + 1})`,
    impulso: () => `${j} impulsa`,
    armadura: () => `armadura de ${ev.jugador}: ${ev.tirada.dados.join('+')}${ev.tirada.suma ? '+' + ev.tirada.suma : ''} vs ${ev.tirada.ar}+ → ${ev.tirada.rota ? 'ROTA' : 'aguanta'}`,
    heridas: () => `heridas: ${ev.tirada.dados.join('+')} → ${ev.tirada.resultado}`,
    lesion: () => `lesión (D16 ${ev.tirada.valor}): ${ev.tirada.resultado}`,
    regeneracion: () => `${j} regenera [${ev.d6}] → ${ev.regenera ? 'sí' : 'no'}`,
    touchdown: () => `¡TOUCHDOWN de ${ev.equipo}! (${ev.marcador.join('–')})`,
    turno: () => `— Turno ${ev.numero} de ${ev.equipo} (parte ${ev.mitad})`,
    clima: () => `clima: ${CLIMA_ES[ev.resultado]}`,
    evento_patada: () => `evento de patada [${ev.dados.join('+')}]: ${ev.evento}`,
    patada: () => `patada: desvío ${ev.d6} casillas → (${ev.a[0] + 1},${ev.a[1] + 1})`,
    rebote: () => `rebote → (${ev.a[0] + 1},${ev.a[1] + 1})`,
    saque_banda: () => `saque de banda → (${ev.a[0] + 1},${ev.a[1] + 1})`,
    falta: () => `${ev.atacante} comete falta sobre ${ev.victima} → ${ev.resultado}`,
    arbitro: () => `¡el árbitro ve la falta de ${ev.jugador}!`,
    soborno: () => `soborno [${ev.d6}] → ${ev.funciona ? 'funciona' : 'perdido'}`,
    lanzar_companero: () => `${ev.lanzador} lanza a ${ev.lanzado} (${ev.alcance})`,
    lanzamiento: () => `lanzamiento${c}${porques}`,
    vuelo: () => `vuela hasta (${ev.caeEn[0] + 1},${ev.caeEn[1] + 1})`,
    aterrizaje: () => `${j} aterriza${c}${porques}`,
    aterrizaje_forzoso: () => `¡${ev.lanzado} aplasta a ${ev.sobre}!`,
    siempre_hambriento: () => `al Troll le suenan las tripas [${ev.d6}]`,
    devorado: () => `¡${ev.jugador} DEVORADO por ${ev.por}!`,
    apunalar: () => `${ev.atacante} apuñala a ${ev.victima}`,
    vomito: () => `${ev.atacante} vomita [${ev.d6}] sobre ${ev.aQuien}`,
    apotecario: () => `apotecario: ${ev.efecto} (${ev.jugador})`,
    apotecario_lesion: () => `el apotecario tira otra vez: ${ev.original} o ${ev.nueva}`,
  };
  return (T[ev.tipo] ?? (() => `${ev.tipo}${j ? ' ' + j : ''}${c}`))();
}

/* ---------- tarjetas de resultado en grande ---------- */

const ICONO_EVENTO = {
  pow: '💥', stumble: '〰️', push: '➡️', both_down: '🤼', player_down: '💀',
};

/** Convierte los eventos de una acción en tarjetas grandes; decide si merecen modal. */
function prepararResultados(eventos, { repeticion = false } = {}) {
  const tarjetas = [];
  const nombre = (id) => (E.jugadores[id] ? etiqueta(E.jugadores[id]) : id);
  const cheq = (c) => ({
    dados: [c.valor], exito: c.exito,
    mods: (c.mods ?? []).map((m) => `${m.v > 0 ? '+' : ''}${m.v} ${m.porque}`),
    detalle: `Necesitaba ${c.necesario}+ y ha salido ${c.valor}${c.suma ? ` (${c.suma > 0 ? '+' : ''}${c.suma})` : ''}`,
  });
  for (const ev of eventos) {
    switch (ev.tipo) {
      case 'placaje':
        tarjetas.push({
          icono: '🎲', titulo: `${nombre(ev.atacante)} placa a ${nombre(ev.objetivo)}`,
          dadosTexto: ev.dados.map((d) => CARA_ES[d]),
          detalle: `FU ${ev.fuerzas.atacante} contra ${ev.fuerzas.objetivo} · ${ev.dados.length} dado${ev.dados.length > 1 ? 's' : ''}${ev.elige ? ` (elige el entrenador ${ev.elige === 'atacante' ? 'atacante' : 'defensor'})` : ''}`,
          mods: [...ev.fuerzas.modsA, ...ev.fuerzas.modsO].map((m) => `+${m.v} ${m.porque}`),
        });
        break;
      case 'placaje_resultado':
        tarjetas.push({ icono: ICONO_EVENTO[ev.resultado] ?? '🎲', titulo: CARA_ES[ev.resultado], detalle: '' });
        break;
      case 'esquivar': case 'saltar': case 'recoger': case 'atrapar': case 'intercepcion':
      case 'pase': case 'lanzamiento': case 'aterrizaje': case 'asegurar': {
        const T = {
          esquivar: ['🩰', 'Esquiva'], saltar: ['🦘', 'Salto'], recoger: ['🖐️', 'Recoge el balón'],
          atrapar: ['🙌', 'Atrapa'], intercepcion: ['✋', 'Intercepción'],
          pase: ['🏈', `Pase ${({ quick: 'rápido', short: 'corto', long: 'largo', bomb: 'bomba' })[ev.alcance] ?? ''}`], lanzamiento: ['🏋️', 'Lanza al compañero'],
          aterrizaje: ['🛬', 'Aterrizaje'], asegurar: ['🧤', 'Asegura el balón'],
        }[ev.tipo];
        tarjetas.push({ icono: T[0], titulo: `${T[1]} — ${nombre(ev.jugador)}`, ...cheq(ev.chequeo) });
        break;
      }
      case 'armadura':
        tarjetas.push({
          icono: ev.tirada.rota ? '🛡️💔' : '🛡️', titulo: `Armadura de ${nombre(ev.jugador)}`,
          dados: ev.tirada.dados,
          detalle: `${ev.tirada.total} contra ${ev.tirada.ar}+ → ${ev.tirada.rota ? '¡ROTA!' : 'aguanta'}${ev.tirada.porGarras ? ' (Garras)' : ''}`,
          mods: (ev.tirada.mods ?? []).map((m) => `${m.v > 0 ? '+' : ''}${m.v} ${m.porque}`),
        });
        break;
      case 'heridas': {
        const R = { stunned: ['😵', 'Aturdido'], ko: ['🚑', '¡KO!'], casualty: ['☠️', '¡LESIÓN!'] };
        const [ic, tx] = R[ev.tirada.resultado] ?? ['❓', ev.tirada.resultado];
        tarjetas.push({ icono: ic, titulo: `${tx} — ${nombre(ev.jugador)}`, dados: ev.tirada.dados, detalle: ev.tirada.efecto ?? '' });
        break;
      }
      case 'lesion':
        tarjetas.push({ icono: '🏥', titulo: `${nombre(ev.jugador)}: ${LESION_ES[ev.tirada.resultado] ?? ev.tirada.resultado}`, dados: [ev.tirada.valor], detalle: 'Tabla de lesiones (D16)' });
        break;
      case 'regeneracion':
        tarjetas.push({ icono: '🧟', titulo: `Regeneración de ${nombre(ev.jugador)}`, dados: [ev.d6], exito: ev.regenera, detalle: ev.regenera ? 'Se recompone y vuelve a Reservas' : 'Esta vez no' });
        break;
      case 'devorado':
        tarjetas.push({ icono: '🍽️', titulo: `¡${nombre(ev.jugador)} DEVORADO!`, detalle: 'Sin apotecario ni Regeneración que valgan.' });
        break;
      case 'apunalar':
        tarjetas.push({ icono: '🗡️', titulo: `${nombre(ev.atacante)} apuñala a ${nombre(ev.victima)}`, detalle: 'Armadura sin modificadores' });
        break;
      case 'vomito':
        tarjetas.push({ icono: '🤮', titulo: ev.d6 === 1 ? '¡Se vomita encima!' : `Vomita sobre ${nombre(ev.aQuien)}`, dados: [ev.d6], detalle: '' });
        break;
      case 'touchdown':
        tarjetas.push({ icono: '🏆', titulo: `¡TOUCHDOWN de ${ev.equipo}!`, detalle: `Marcador ${ev.marcador.join(' – ')}` });
        break;
      case 'stalling':
        tarjetas.push({
          icono: '🪨', titulo: ev.acierta ? '¡El público lanza una piedra!' : 'El público gruñe… y falla',
          dados: [ev.d6], exito: !ev.acierta,
          detalle: `Hacía tiempo pudiendo anotar: 1D6 ≥ turno ${ev.turno}`,
        });
        break;
      case 'solitario':
        tarjetas.push({
          icono: '🐺', titulo: `Solitario ${ev.objetivo}+ — ${nombre(ev.jugador)}`,
          dados: [ev.d6], exito: ev.repite,
          detalle: ev.repite ? 'El reroll procede' : 'El reroll se GASTA sin repetir nada',
        });
        break;
      case 'rush':
        if (ev.chequeo) tarjetas.push({ icono: '💨', titulo: `Fuerza la marcha — ${nombre(ev.jugador)}`, ...cheq(ev.chequeo) });
        break;
      case 'patada':
        tarjetas.push({ icono: '🦵', titulo: 'Patada', dados: [ev.d6, ev.d8], detalle: `Se desvía ${ev.d6} casillas` });
        break;
      case 'turno':
        if (repeticion) tarjetas.push({ icono: '⏱️', titulo: `Turno ${ev.numero} de ${ev.equipo}`, detalle: `Parte ${ev.mitad}` });
        break;
      case 'recuperacion_ko':
        if (repeticion) tarjetas.push({ icono: ev.vuelve ? '🏥✅' : '🏥', titulo: `${nombre(ev.jugador)} ${ev.vuelve ? 'se recupera del KO' : 'sigue KO'}`, dados: [ev.d6], detalle: '' });
        break;
      case 'apotecario':
        if (repeticion) tarjetas.push({ icono: '🧪', titulo: 'Apotecario', detalle: ev.efecto });
        break;
      case 'evento_patada':
        tarjetas.push({ icono: '📯', titulo: EVENTO_ES[ev.evento] ?? ev.evento, dados: ev.dados, detalle: '' });
        break;
    }
  }
  // Solo abre el modal si pasó algo con chicha (un paseo con una esquiva limpia, no).
  const conChicha = eventos.some((e) =>
    ['placaje_resultado', 'armadura', 'heridas', 'pase', 'intercepcion', 'lanzamiento',
      'touchdown', 'asegurar', 'apunalar', 'vomito', 'devorado', 'entrega'].includes(e.tipo));
  if (tarjetas.length && (conChicha || repeticion)) {
    ui.resultado = tarjetas;
    ui.resultadoIdx = 0;
    ui.resultadoTitulo = repeticion ? 'Mientras no mirabas…' : 'Resultado';
    ui.hoja = 'resultado';
  }
}

let tt;
function toast(m) {
  const t = $('toast');
  t.textContent = m;
  t.classList.add('show');
  clearTimeout(tt);
  tt = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ---------- partida nueva ---------- */

async function nuevaPartida(razaA, razaB, nombreA, nombreB) {
  const A = crearEquipo(razaA, ROSTERS_1000K[razaA], { nombre: nombreA || EQUIPOS_ES[razaA] });
  const B = crearEquipo(razaB, ROSTERS_1000K[razaB], { nombre: nombreB || EQUIPOS_ES[razaB] });
  E = crearPartido(A, B);
  E.fase = 'pre_partido';
  undoStack = [];
  ui.sel = null; ui.modo = null; ui.hoja = null; ui.decision = null;
  ui.decisorVisto = null; ui.eventoInfo = null; ui.formacion = {};
  await ejecutar((azar) => prePartido(E, { azar }));
}

/** Aplica una formación clásica con lo que haya disponible. */
function aplicarFormacion(equipo, clave) {
  const F = FORMACIONES[clave];
  const mios = Object.values(E.jugadores).filter((j) => j.equipo === equipo && (j.situacion === 'campo' || j.situacion === 'reserva'));
  for (const j of mios) desplegar(E, j.id, null);
  const costes = Object.fromEntries(Object.entries(EQUIPOS[E.equipos[equipo].id].pos).map(([k, p]) => [k, p.coste]));
  const los = filaLos(equipo);
  for (const { id, x, df } of asignarFormacion(F, mios.slice(0, 11), costes)) {
    desplegar(E, id, x, equipo === 0 ? los + df : los - df);
  }
}

/* ---------- interacción con el campo ---------- */

async function tapCell(x, y) {
  if (!E) return;

  // Con una vista previa de pase o patada abierta, tocar otra casilla la recoloca.
  if (ui.preview?.tipo === 'pase') {
    const yo = jugador(E, E.activacion.jugador);
    const t = alcance(yo.x, yo.y, x, y);
    if (t) { ui.preview = { tipo: 'pase', x, y, alcance: t }; render(); }
    else toast('Fuera de alcance.');
    return;
  }
  if (ui.preview?.tipo === 'patada') {
    ui.preview = { tipo: 'patada', x, y };
    render(); return;
  }
  if (ui.preview?.tipo === 'placar') { ui.preview = null; render(); return; }

  // Una decisión de tipo casilla se resuelve tocando el tablero.
  if (ui.decision) {
    const p = ui.decision.pregunta;
    if (p.tipo === 'casilla') {
      const i = p.casillas.findIndex((c) => c.x === x && c.y === y);
      if (i >= 0) { const r = ui.decision.resolver; ui.decision = null; r(i); }
      else toast('Toca una de las casillas marcadas.');
    }
    return;
  }
  if (enCurso) return;

  const j = enCasilla(E, x, y);

  if (E.fase === 'despliegue_kicker' || E.fase === 'despliegue_receiver') {
    const eq = E.fase === 'despliegue_kicker' ? E.kicker : 1 - E.kicker;
    if (ui.sel) {
      const s = ui.sel; ui.sel = null;
      await ejecutar(() => desplegar(E, s, x, y));
      return;
    }
    if (j && j.equipo === eq) { ui.sel = j.id; render(); }
    return;
  }

  if (E.fase === 'patada') {
    ui.preview = { tipo: 'patada', x, y };
    render(); return;
  }

  if (E.pendiente && E.pendiente.tipo !== 'blitz_event') {
    if (ui.sel) {
      const id = ui.sel; ui.sel = null;
      await ejecutar(() => moverEnEvento(E, id, x, y));
      return;
    }
    if (j && j.equipo === E.pendiente.equipo) { ui.sel = j.id; render(); }
    return;
  }

  if (E.fase === 'recepcion_libre') {
    if (j && j.equipo !== E.kicker) await ejecutar(() => recepcionLibre(E, j.id));
    return;
  }

  const enCarga = E.pendiente?.tipo === 'blitz_event';
  if (!(E.fase === 'turno' || enCarga) || E.turnover) return;

  const a = E.activacion;
  if (!a) {
    if (ui.modo === 'blitz_objetivo' && j && j.equipo !== E.activo) {
      const sel = ui.sel; ui.modo = null;
      await ejecutar((azar) => activar(E, sel, 'blitz', { azar, objetivo: j.id }));
      return;
    }
    if (j && j.equipo === E.activo && !j.activado && j.postura !== 'aturdido') {
      ui.sel = j.id; ui.modo = 'elegir_accion';
    } else {
      ui.sel = j?.id ?? null; ui.modo = j ? 'mirar' : null;
    }
    render();
    return;
  }

  // Hay activación en curso.
  const yo = jugador(E, a.jugador);

  if (ui.modo === 'pase_objetivo') {
    const tipo = alcance(yo.x, yo.y, x, y);
    if (!tipo) { toast('Fuera de alcance.'); return; }
    ui.preview = { tipo: 'pase', x, y, alcance: tipo };
    render(); return;
  }
  if (j && a.accion === 'blitz' && j.id === a.objetivoBlitz && sonAdyacentes(yo.x, yo.y, j.x, j.y) && !a.placajeHecho) {
    ui.preview = { tipo: 'placar', atacante: yo.id, objetivo: j.id, blitz: true };
    render(); return;
  }
  if (j && a.accion === 'block' && j.equipo !== yo.equipo && sonAdyacentes(yo.x, yo.y, j.x, j.y)) {
    ui.preview = { tipo: 'placar', atacante: yo.id, objetivo: j.id, blitz: false };
    render(); return;
  }
  // (la piedra de Stalling se tira dentro de terminarAccion, con el azar del replay)
  if (j && a.accion === 'foul' && j.equipo !== yo.equipo && sonAdyacentes(yo.x, yo.y, j.x, j.y)) {
    await ejecutar((azar, decidir) => falta(E, j.id, { azar, opciones: opcionesMotor(decidir) }));
    return;
  }
  if (j && a.accion === 'handoff' && j.equipo === yo.equipo && sonAdyacentes(yo.x, yo.y, j.x, j.y)) {
    await ejecutar((azar) => entrega(E, j.id, { azar }));
    return;
  }
  if (j && a.accion === 'stab' && j.equipo !== yo.equipo && sonAdyacentes(yo.x, yo.y, j.x, j.y)) {
    await ejecutar((azar) => apunalar(E, j.id, { azar }));
    return;
  }
  if (j && a.accion === 'vomit' && j.equipo !== yo.equipo && sonAdyacentes(yo.x, yo.y, j.x, j.y)) {
    await ejecutar((azar) => vomitar(E, j.id, { azar }));
    return;
  }
  if (a.accion === 'ttm') {
    // Primero se toca al compañero (Humanoide bala adyacente); luego la casilla destino.
    if (j && j.equipo === yo.equipo && sonAdyacentes(yo.x, yo.y, j.x, j.y) && tiene(j.hab, 'right_stuff')) {
      ui.ttmCompanero = j.id; render(); return;
    }
    if (!j && ui.ttmCompanero) {
      const companero = ui.ttmCompanero; ui.ttmCompanero = null;
      await ejecutar((azar, decidir) => lanzarCompanero(E, companero, x, y, { azar, opciones: opcionesMotor(decidir) }));
      return;
    }
  }
  if (!j) {
    const dist = Math.max(Math.abs(x - yo.x), Math.abs(y - yo.y));
    await ejecutar((azar, decidir) => {
      const opciones = opcionesMotor(decidir);
      if (jugador(E, a.jugador).postura === 'tumbado') {
        levantarse(E, { azar });
        if (!E.activacion) return;
        if (x === yo.x && y === yo.y) return;   // solo quería levantarse
      }
      if (dist === 1) paso(E, x, y, { azar, alFallar: opciones.alFallar });
      else if (dist === 2) saltar(E, x, y, { azar, alFallar: opciones.alFallar });
      else throw new Error('Mueve casilla a casilla (o salta por encima de un caído).');
    });
  }
}

/* ---------- acciones de los chips ---------- */

async function act(el) {
  const d = el.dataset;
  switch (d.act) {
    case 'nueva': ui.hoja = 'inicio'; break;
    case 'pick': ui.inicio[d.side] = d.team; render(); return;
    case 'empezar':
      await nuevaPartida(ui.inicio.a, ui.inicio.b, $('nomA').value.trim(), $('nomB').value.trim());
      return;
    case 'apo_si': {
      const id = ui.apoJugador;
      ui.hoja = null; ui.apoJugador = null;
      const herido = jugador(E, id);
      if (herido.situacion === 'ko') await ejecutar(() => curarKO(E, id));
      else await ejecutar((azar, decidir) => curarLesion(E, id, {
        azar,
        elegir: (ops) => decidir({
          tipo: 'opciones', titulo: 'El apotecario ofrece dos diagnósticos: elige el que se queda',
          opciones: ops.map((o) => LESION_ES[o] ?? o),
        }),
      }));
      return;
    }
    case 'apo_no': {
      const id = ui.apoJugador;
      ui.hoja = null; ui.apoJugador = null;
      await ejecutar(() => rechazarCura(E, id));
      return;
    }
    case 'visto':
      // Solo el intersticial de relevo da por enterado al entrenador; cerrar el modal
      // de un evento deja que el «te toca» aparezca a continuación.
      if (ui.hoja === 'turno_de') ui.decisorVisto = quienDecide();
      ui.hoja = null; ui.eventoInfo = null;
      render(); return;
    case 'saque': await ejecutar(() => elegirSaque(E, d.v)); return;
    case 'formacion': {
      const eq = E.fase === 'despliegue_kicker' ? E.kicker : 1 - E.kicker;
      if (await ejecutar(() => aplicarFormacion(eq, d.v))) ui.formacion[eq] = d.v;
      render(); return;
    }
    case 'confirmar': ui.sel = null; await ejecutar(() => confirmarDespliegue(E)); return;
    case 'centro':
      ui.preview = { tipo: 'patada', x: 7, y: E.kicker === 0 ? 6 : 19 };
      render(); return;
    case 'evento_fin': ui.sel = null; await ejecutar((azar) => terminarEvento(E, { azar })); return;
    case 'accion': {
      const sel = ui.sel;
      ui.modo = null; ui.preview = null;
      if (d.v === 'blitz') { ui.modo = 'blitz_objetivo'; render(); return; }
      await ejecutar((azar) => activar(E, sel, d.v, { azar }));
      return;
    }
    case 'lanzar': ui.modo = 'pase_objetivo'; ui.preview = null; render(); return;
    case 'preview_no': ui.preview = null; render(); return;
    case 'placar_go': {
      const p = ui.preview; ui.preview = null;
      if (!p) return;
      if (p.blitz) await ejecutar((azar, decidir) => placarEnPenetracion(E, { azar, opciones: opcionesMotor(decidir) }));
      else await ejecutar((azar, decidir) => { placar(E, p.atacante, p.objetivo, { azar, opciones: opcionesMotor(decidir) }); terminarAccion(E, { azar }); });
      return;
    }
    case 'pase_go': {
      const p = ui.preview; ui.preview = null; ui.modo = null;
      if (!p) return;
      await ejecutar((azar, decidir) => pase(E, p.x, p.y, { azar, opciones: opcionesMotor(decidir) }));
      return;
    }
    case 'patada_go': {
      const p = ui.preview; ui.preview = null;
      if (!p) return;
      if (await ejecutar((azar) => patada(E, p.x, p.y, { azar }))) { prepararEventoInfo(); render(); }
      return;
    }
    case 'res_sig':
      ui.resultadoIdx++;
      if (ui.resultadoIdx >= (ui.resultado?.length ?? 0)) { ui.hoja = null; ui.resultado = null; ui.resultadoIdx = 0; ui.resultadoTitulo = null; }
      render(); return;
    case 'res_fin':
      ui.hoja = null; ui.resultado = null; ui.resultadoIdx = 0; ui.resultadoTitulo = null;
      render(); return;
    case 'fin_activacion': ui.sel = null; ui.modo = null; ui.ttmCompanero = null; ui.preview = null; await ejecutar((azar) => terminarAccion(E, { azar })); return;
    case 'fin_turno':
      ui.sel = null; ui.modo = null; ui.preview = null;
      await ejecutar((azar) => terminarTurno(E, { azar }));
      return;
    case 'deshacer': deshacer(); return;
    case 'hoja': ui.hoja = d.v; break;
    case 'cerrar': ui.hoja = null; break;
    case 'decision': {
      if (!ui.decision) break;
      const r = ui.decision.resolver;
      ui.decision = null;
      r(d.v === 'si' ? true : d.v === 'no' ? false : +d.v);
      return;
    }
    case 'enlace': {
      const base = location.href.split('#')[0];
      aEnlace(E, base).then((url) => navigator.clipboard?.writeText(url).then(
        () => toast('Enlace copiado: envíaselo al rival.'),
        () => { prompt('Copia el enlace:', url); },
      ));
      return;
    }
  }
  render();
}

/** Prepara el modal con el resultado del evento de patada recién tirado. */
function prepararEventoInfo() {
  const ev = [...E.registro].reverse().find((x) => x.tipo === 'evento_patada');
  if (!ev) return;
  const fila = TABLA_PATADA.filas.find((f) => f[2] === ev.evento);
  const lineas = [];
  if (ev.evento === 'changing_weather') {
    lineas.push(`Clima nuevo: ${CLIMA_ES[E.clima]} (${CLIMA_FX[E.clima]}).`);
  }
  if (E.pendiente) {
    lineas.push(`${E.equipos[E.pendiente.equipo].nombre} resuelve el evento antes de que caiga el balón.`);
  }
  if (E.fase === 'recepcion_libre') {
    lineas.push('El balón se fue largo: recepción libre para el que recibe.');
  }
  ui.eventoInfo = {
    dados: ev.dados, nombre: EVENTO_ES[ev.evento] ?? ev.evento,
    efecto: fila?.[3] ?? '', lineas,
  };
  ui.hoja = 'evento_info';
}

/* ---------- render ---------- */

function render() {
  if (!E) { renderInicio(); return; }

  // Los modales de fase caducan cuando su fase pasa.
  if (ui.hoja === 'previa' && E.fase !== 'eleccion_saque') ui.hoja = null;
  if (ui.hoja === 'final' && E.fase !== 'fin') ui.hoja = null;

  // ¿Hay un herido con la ventana del apotecario abierta? Su entrenador decide ya.
  if (!ui.decision && !ui.hoja && !enCurso) {
    const herido = Object.values(E.jugadores).find((j) => j.apoVentana && puedeCurar(E, j.id));
    if (herido) { ui.hoja = 'apotecario'; ui.apoJugador = herido.id; }
  }

  // Modales de fase: la previa y el final ocupan la pantalla; la cuadrícula solo
  // cuando hace falta tocarla.
  if (!ui.decision && !ui.hoja) {
    if (E.fase === 'eleccion_saque') ui.hoja = 'previa';
    else if (E.fase === 'fin') ui.hoja = 'final';
    else {
      // Intersticial «le toca a…» cada vez que cambia quién decide (también al abrir
      // un enlace recibido).
      const d = quienDecide();
      if (d !== null && d !== ui.decisorVisto) ui.hoja = 'turno_de';
    }
  }
  renderTop(); renderPitch(); renderPanel(); renderNav(); renderHoja();
}

const colorEq = (i) => (i === 0 ? ['var(--eqA)', 'var(--eqAt)'] : ['var(--eqB)', 'var(--eqBt)']);

function renderTop() {
  const fases = {
    eleccion_saque: 'Sorteo', despliegue_kicker: 'Despliegue', despliegue_receiver: 'Despliegue',
    patada: 'Patada', evento_patada: 'Evento', recepcion_libre: 'Recepción', turno: `Parte ${E.mitad}`,
    fin: 'Final',
  };
  $('top').innerHTML = E.equipos.map((Eq, i) => {
    const [c] = colorEq(i);
    return `<div class="team ${i ? 'b' : ''} ${E.fase === 'turno' && E.activo === i ? 'on' : ''}" style="--c:${c}">
      <div class="sc">${Eq.marcador}</div>
      <div class="meta"><span class="nm">${esc(Eq.nombre)}</span>
      <span class="sub">T${Eq.turno}/8 · RR ${Eq.rerolls}</span></div></div>`;
  }).join(`<button class="mid" data-act="hoja" data-v="registro"><small>${esc(CLIMA_ES[E.clima] ?? '')}</small><b>${fases[E.fase] ?? ''}</b></button>`);
}

function renderPitch() {
  const main = document.querySelector('main');
  const cell = Math.max(12, Math.min(
    Math.floor((main.clientHeight - 10) / ALTO),
    Math.floor((main.clientWidth - 12) / ANCHO), 26,
  ));
  const p = $('pitch');
  p.style.setProperty('--cell', `${cell}px`);

  // Casillas destacadas: una decisión de empuje, la casilla elegida en una vista
  // previa, o las zonas de placaje rivales.
  const destacadas = new Set();
  if (ui.decision?.pregunta.tipo === 'casilla') {
    for (const c of ui.decision.pregunta.casillas) destacadas.add(`${c.x},${c.y}`);
  }
  if (ui.preview && 'x' in (ui.preview ?? {})) destacadas.add(`${ui.preview.x},${ui.preview.y}`);

  // Apoyos de la vista previa del placaje: verdes los del atacante, naranjas los del
  // defensor (ver reglamento: compañero que marca al implicado sin nadie más encima).
  const marcaApoyo = new Map();
  if (ui.preview?.tipo === 'placar') {
    const A = jugador(E, ui.preview.atacante), O = jugador(E, ui.preview.objetivo);
    const ap = apoyos(E, A, O);
    for (const c of ap.ofensivos) marcaApoyo.set(c.id, 'apoyo');
    for (const c of ap.defensivos) marcaApoyo.set(c.id, 'apoyo-def');
  }

  // Mapa de alcances del pase: verde rápido, verdoso corto, naranja largo, rojo bomba.
  const alcances = new Map();
  if (ui.modo === 'pase_objetivo' && E.activacion) {
    const yo = jugador(E, E.activacion.jugador);
    for (let yy = 0; yy < ALTO; yy++) for (let xx = 0; xx < ANCHO; xx++) {
      const t = alcance(yo.x, yo.y, xx, yy);
      if (t && !(xx === yo.x && yy === yo.y)) alcances.set(`${xx},${yy}`, { quick: 'al-q', short: 'al-s', long: 'al-l', bomb: 'al-b' }[t]);
    }
  }
  const marca = new Set();
  const sel = ui.sel && E.jugadores[ui.sel];
  if (sel && E.fase === 'turno' && !ui.decision) {
    for (const r of Object.values(E.jugadores)) {
      if (r.equipo !== sel.equipo && tieneZonaDefensa(r)) {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (dx || dy) marca.add(`${r.x + dx},${r.y + dy}`);
        }
      }
    }
  }

  const b = posicionBalon(E);
  const portador = E.balon?.portador;
  let html = '';
  for (let y = 0; y < ALTO; y++) {
    for (let x = 0; x < ANCHO; x++) {
      const cls = ['c'];
      if ((x + y) % 2) cls.push('s2');
      if (y === 0 || y === ALTO - 1) cls.push('ez');
      if (y === 13) cls.push('los');
      if (x === 4 || x === ANCHO - 4) cls.push('wz');
      if (destacadas.has(`${x},${y}`)) cls.push('ok');
      else if (alcances.has(`${x},${y}`)) cls.push(alcances.get(`${x},${y}`));
      else if (marca.has(`${x},${y}`)) cls.push('tz');
      const j = enCasilla(E, x, y);
      let inner = '';
      if (j) {
        const [c, t] = colorEq(j.equipo);
        const k = ['tk', j.postura !== 'de_pie' ? j.postura : '', j.grande ? 'big' : '',
          j.activado && E.fase === 'turno' ? 'act' : '', ui.sel === j.id ? 'sel' : '',
          marcaApoyo.get(j.id) ?? '',
          ui.preview?.tipo === 'placar' && (j.id === ui.preview.atacante || j.id === ui.preview.objetivo) ? 'sel' : '',
        ].filter(Boolean).join(' ');
        const balon = portador === j.id ? `<span class="bc">${BALON_SVG}</span>` : '';
        inner = `<div class="${k}" style="--c:${c};--t:${t};--anillo:${ANILLO[rolDe(j)]}"><span>${esc(FICHA_ES[j.pos] ?? '?')}</span>${balon}</div>`;
      } else if (b && !portador && b.x === x && b.y === y) {
        inner = `<div class="ball">${BALON_SVG}</div>`;
      }
      html += `<div class="${cls.join(' ')}" data-x="${x}" data-y="${y}">${inner}</div>`;
    }
  }
  p.innerHTML = html;
}

const MODALES_DE_FASE = ['previa', 'turno_de', 'evento_info', 'final', 'inicio', 'apotecario', 'resultado'];

/** La ficha del jugador seleccionado: quién es, cómo está y qué sabe hacer. */
function fichaJugador(j) {
  const [c, t] = colorEq(j.equipo);
  const estados = [];
  if (j.situacion !== 'campo') estados.push([SITUACION_ES[j.situacion], 'mal']);
  else if (j.postura !== 'de_pie') estados.push([POSTURA_ES[j.postura], 'mal']);
  else estados.push(['De pie', 'bien']);
  if (E.balon?.portador === j.id) estados.push(['🏈 lleva el balón', 'bien']);
  if (j.activado && E.fase === 'turno' && j.equipo === E.activo) estados.push(['ya ha actuado', 'mal']);
  if (j.sinApoyos) estados.push(['sin apoyos (Piquete de ojos)', 'mal']);
  return `<div class="carta">
    <div class="mini"><div class="tk ${j.grande ? 'big' : ''}" style="--c:${c};--t:${t};--anillo:${ANILLO[rolDe(j)]}"><span>${esc(FICHA_ES[j.pos] ?? '?')}</span></div></div>
    <div class="datos">
      <span class="nom">${esc(POSICIONES_ES[j.pos] ?? j.pos)} #${j.dorsal} · ${esc(E.equipos[j.equipo].nombre)}</span>
      <span class="skills">${ROL_ES[rolDe(j)]} · ${statLinea(j)}</span>
      <span class="skills">${esc(habilidades(j))}</span>
      <span>${estados.map(([txt, cls]) => `<span class="est ${cls}">${esc(txt)}</span>`).join(' · ')}</span>
    </div></div>`;
}

function renderPanel() {
  const info = $('info'), chips = $('chips');
  // Con un modal de fase delante, el panel calla para no duplicar botones.
  if (MODALES_DE_FASE.includes(ui.hoja)) { info.innerHTML = ''; chips.innerHTML = ''; return; }
  const sel = ui.sel && E.jugadores[ui.sel];
  let txt = '', ch = '';
  const chip = (act, label, extra = '') => `<button data-act="${act}" ${extra}>${label}</button>`;
  const chipV = (act, v, label, extra = '') => `<button data-act="${act}" data-v="${v}" ${extra}>${label}</button>`;

  // Una vista previa pendiente de confirmar manda sobre el panel normal.
  if (ui.preview?.tipo === 'placar') {
    const A = jugador(E, ui.preview.atacante), O = jugador(E, ui.preview.objetivo);
    const f = fuerzasPlacaje(E, A, O, { blitz: ui.preview.blitz });
    const quien = f.elige === null ? 'un dado'
      : `${f.dados} dados — elige el entrenador ${f.elige === 'atacante' ? 'atacante' : 'DEFENSOR'}`;
    const modsTxt = [...f.modsA.map((m) => `+${m.v} ${m.porque}`), ...f.modsO.map((m) => `+${m.v} ${m.porque} (rival)`)].join(' · ');
    info.innerHTML = `<b>${esc(etiqueta(A))} va a placar a ${esc(etiqueta(O))}</b>
      <span class="skills">FU ${f.fuA} contra ${f.fuO} → ${quien}</span>
      <span class="skills">${esc(modsTxt || 'Sin apoyos: nadie más mete la nariz.')}</span>`;
    chips.innerHTML = chip('placar_go', `🎲 Tirar ${f.dados} dado${f.dados > 1 ? 's' : ''}`, 'class="hot"') + chip('preview_no', 'Cancelar');
    return;
  }
  if (ui.preview?.tipo === 'pase') {
    const yo = jugador(E, E.activacion.jugador);
    const ALC = { quick: ['Pase rápido', '+0'], short: ['Pase corto', '−1'], long: ['Pase largo', '−2'], bomb: ['Bomba larga', '−3'] };
    const [nombreAlc, modAlc] = ALC[ui.preview.alcance];
    const marcadores = marcadoresDe(E, yo.equipo, yo.x, yo.y).length;
    const extra = [];
    if (marcadores) extra.push(`−${marcadores} por marcador${marcadores > 1 ? 'es' : ''} al lanzador`);
    if (E.clima === 'very_sunny') extra.push('−1 Muy soleado');
    const receptor = enCasilla(E, ui.preview.x, ui.preview.y);
    info.innerHTML = `<b>${nombreAlc}</b> (${modAlc}) de ${esc(etiqueta(yo))}` +
      (receptor ? ` hacia ${esc(etiqueta(receptor))}` : ' a una casilla vacía') +
      `<span class="skills">PS ${yo.perfil.ps}+ ${extra.length ? '· ' + esc(extra.join(' · ')) : ''}</span>`;
    chips.innerHTML = chip('pase_go', '🎲 Lanzar', 'class="hot"') + chip('preview_no', 'Otra casilla');
    return;
  }
  if (ui.preview?.tipo === 'patada') {
    info.innerHTML = `<b>Patada a la columna ${ui.preview.x + 1}, fila ${ui.preview.y + 1}</b>
      <span class="skills">El balón se desviará 1D6 casillas en una dirección al azar.</span>`;
    chips.innerHTML = chip('patada_go', '🎲 Patear', 'class="hot"') + chip('preview_no', 'Otra casilla');
    return;
  }

  // Una decisión en curso manda sobre todo lo demás.
  if (ui.decision) {
    const p = ui.decision.pregunta;
    info.innerHTML = `<b>${esc(p.titulo)}</b>` + (p.tipo === 'casilla' ? '<span class="skills">Toca una casilla marcada en el campo.</span>' : '');
    if (p.tipo === 'si_no') {
      chips.innerHTML = chipV('decision', 'si', esc(p.si), 'class="hot"') + chipV('decision', 'no', esc(p.no));
    } else if (p.tipo === 'opciones') {
      chips.innerHTML = p.opciones.map((o, i) => chipV('decision', i, esc(o), i === 0 ? 'class="hot"' : '')).join('');
    } else {
      chips.innerHTML = '';
    }
    return;
  }

  const enCarga = E.pendiente?.tipo === 'blitz_event';
  switch (enCarga ? 'turno' : E.fase) {
    case 'eleccion_saque':
      txt = `<b>${esc(E.equipos[E.ganadorSorteo].nombre)}</b> gana el sorteo (clima: ${CLIMA_ES[E.clima]}).`;
      ch = chipV('saque', 'patear', 'Patear', 'class="hot"') + chipV('saque', 'recibir', 'Recibir', 'class="hot"');
      break;
    case 'despliegue_kicker': case 'despliegue_receiver': {
      const eq = E.fase === 'despliegue_kicker' ? E.kicker : 1 - E.kicker;
      const n = Object.values(E.jugadores).filter((j) => j.equipo === eq && j.situacion === 'campo').length;
      const problemas = validarDespliegue(E, eq);
      txt = `Despliega <b>${esc(E.equipos[eq].nombre)}</b> (${n}/11)` +
        (sel ? ` — toca una casilla para colocar a ${esc(etiqueta(sel))}` : '') +
        (problemas.length ? `<span class="skills">${esc(problemas[0])}</span>` : '');
      const defendiendo = eq === E.kicker;
      const orden = Object.entries(FORMACIONES)
        .sort(([, a], [, b]) => (a.lado === (defendiendo ? 'defensa' : 'ataque') ? -1 : 1) - (b.lado === (defendiendo ? 'defensa' : 'ataque') ? -1 : 1));
      ch = orden.map(([k, F]) =>
        chipV('formacion', k, (ui.formacion[eq] === k ? '✓ ' : '') + F.nombre, ui.formacion[eq] === k ? 'class="hot"' : '')).join('') +
        chip('confirmar', problemas.length ? 'Faltan jugadores' : 'Confirmar ✓', problemas.length ? 'disabled' : 'class="warn"');
      ch += `<span style="flex:1"></span>` + bench(eq);
      break;
    }
    case 'patada':
      txt = `<b>${esc(E.equipos[E.kicker].nombre)}</b> patea: toca la casilla de la mitad rival.`;
      ch = chip('centro', 'Al centro', 'class="hot"');
      break;
    case 'evento_patada': {
      const p = E.pendiente;
      if (p) {
        const EV = { solid_defence: 'Defensa sólida', quick_snap: 'Anticipación', high_kick: 'Patada alta', blitz_event: '¡A la carga!' };
        txt = `<b>${EV[p.tipo]}</b> — ${esc(E.equipos[p.equipo].nombre)} puede mover (quedan ${p.restantes}).` +
          (ui.sel ? ' Toca el destino.' : ' Toca un jugador desmarcado.');
        ch = chip('evento_fin', 'Continuar', 'class="hot"');
      }
      break;
    }
    case 'recepcion_libre':
      txt = `<b>Recepción libre</b>: ${esc(E.equipos[1 - E.kicker].nombre)} da el balón a un jugador de pie.`;
      break;
    case 'turno': {
      const Eq = E.equipos[E.activo];
      if (enCarga && E.turnover) {
        txt = '<b>¡La Carga se detiene!</b> Alguien ha besado el césped.';
        ch = chip('evento_fin', 'Que caiga el balón', 'class="warn"');
        break;
      }
      if (E.turnover) {
        const TO = {
          touchdown: '¡Touchdown!', pifia: 'Pifia', intercepcion: 'Intercepción',
          atacante_derribado: 'El atacante cayó', portador_derribado: 'El portador cayó',
        };
        txt = `<b>Cambio de turno</b>: ${TO[E.turnover.causa] ?? E.turnover.causa}.`;
        ch = chip('fin_turno', 'Fin de turno', 'class="warn"');
        break;
      }
      const a = E.activacion;
      if (a) {
        const yo = jugador(E, a.jugador);
        const restante = yo.perfil.mv - a.mvGastado;
        const ACCION_ES = { move: 'Movimiento', blitz: 'Penetración', block: 'Placaje', pass: 'Pase', handoff: 'Entrega', foul: 'Falta', secure: 'Asegurar el balón', ttm: 'Lanzar compañero', stab: 'Apuñalar', vomit: 'Proyectil de vómito' };
        txt = `<b>${esc(etiqueta(yo))}</b> — ${ACCION_ES[a.accion] ?? a.accion} · MV ${Math.max(0, restante)}${a.rushUsados ? ` · rush ${a.rushUsados}/2` : ''}` +
          (ui.modo === 'pase_objetivo' ? ' · <b>toca la casilla del pase</b>' : '') +
          `<span class="skills">${esc(habilidades(yo))}</span>`;
        if (a.accion === 'pass' && E.balon?.portador === yo.id) ch += chip('lanzar', 'Lanzar', 'class="hot"');
        if (a.accion === 'ttm') {
          txt += `<span class="skills">${ui.ttmCompanero
            ? `Lanzas a ${esc(etiqueta(jugador(E, ui.ttmCompanero)))}: toca la casilla destino (cerca).`
            : 'Toca al compañero con Humanoide bala que vas a lanzar.'}</span>`;
        }
        if (a.accion === 'stab' || a.accion === 'vomit') {
          txt += '<span class="skills">Toca al rival adyacente que lo va a sufrir.</span>';
        }
        if (a.accion === 'blitz' && !a.placajeHecho) {
          const O = jugador(E, a.objetivoBlitz);
          if (sonAdyacentes(yo.x, yo.y, O.x, O.y)) txt += '<span class="skills">Toca al objetivo para placar.</span>';
        }
        ch += chip('fin_activacion', 'Terminar activación');
      } else if (sel && ui.modo === 'elegir_accion') {
        txt = fichaJugador(sel);
        const puede = (k) => !E.usadas[k];
        if (enCarga) {
          txt += `<span class="skills">¡A la carga! (quedan ${E.pendiente.restantes})</span>`;
          ch = chipV('accion', 'move', 'Mover', 'class="hot"') +
            (puede('blitz') ? chipV('accion', 'blitz', 'Blitz') : '') +
            (puede('ttm') && tiene(sel.hab, 'throw_team_mate') ? chipV('accion', 'ttm', 'Lanzar comp.') : '') +
            chip('evento_fin', 'Terminar la Carga');
          break;
        }
        ch = chipV('accion', 'move', 'Mover', 'class="hot"') +
          (puede('blitz') ? chipV('accion', 'blitz', 'Blitz') : '') +
          chipV('accion', 'block', 'Placar') +
          (puede('pass') ? chipV('accion', 'pass', 'Pase') : '') +
          (puede('handoff') ? chipV('accion', 'handoff', 'Entrega') : '') +
          (puede('foul') ? chipV('accion', 'foul', 'Falta') : '') +
          (puede('secure') && E.balon && !E.balon.portador ? chipV('accion', 'secure', 'Asegurar') : '') +
          (puede('ttm') && tiene(sel.hab, 'throw_team_mate') ? chipV('accion', 'ttm', 'Lanzar comp.') : '') +
          (tiene(sel.hab, 'stab') ? chipV('accion', 'stab', 'Apuñalar') : '') +
          (tiene(sel.hab, 'projectile_vomit') ? chipV('accion', 'vomit', 'Vomitar') : '');
      } else if (sel) {
        txt = fichaJugador(sel);
        ch = chip('fin_turno', 'Fin de turno');
      } else if (ui.modo === 'blitz_objetivo') {
        txt = '<b>Penetración</b>: toca al rival objetivo.';
      } else if (enCarga) {
        txt = `<b>¡A la carga!</b> ${esc(Eq.nombre)} activa gratis a sus desmarcados (quedan ${E.pendiente.restantes}). Toca a uno.`;
        ch = chip('evento_fin', 'Terminar la Carga', 'class="hot"');
      } else {
        txt = `Turno ${Eq.turno} de <b>${esc(Eq.nombre)}</b>. Toca a un jugador.`;
        ch = chip('fin_turno', 'Fin de turno');
      }
      break;
    }
    case 'fin':
      txt = `<b>Final</b>: ${esc(E.equipos[0].nombre)} ${E.equipos[0].marcador} – ${E.equipos[1].marcador} ${esc(E.equipos[1].nombre)}`;
      ch = chip('nueva', 'Nueva partida', 'class="hot"');
      break;
  }
  info.innerHTML = txt;
  chips.innerHTML = ch;
}

function bench(eq) {
  const reservas = Object.values(E.jugadores).filter((j) => j.equipo === eq && j.situacion === 'reserva');
  return reservas.slice(0, 16).map((j) => {
    const [c, t] = colorEq(eq);
    return `<button data-bench="${j.id}" class="${ui.sel === j.id ? 'sel' : ''}" style="padding:.3rem .45rem">
      <span class="tk" style="--c:${c};--t:${t};--anillo:${ANILLO[rolDe(j)]};width:24px;height:24px;font-size:.72rem;display:grid;place-items:center">${esc(FICHA_ES[j.pos])}</span></button>`;
  }).join('');
}

function renderNav() {
  $('nav').innerHTML =
    `<button data-act="hoja" data-v="t0">${esc(E.equipos[0].nombre)}</button>
     <button data-act="hoja" data-v="t1">${esc(E.equipos[1].nombre)}</button>
     <button data-act="hoja" data-v="registro">Tiradas</button>
     <button data-act="hoja" data-v="menu">Menú</button>`;
}

function renderInicio() {
  $('top').innerHTML = ''; $('pitch').innerHTML = ''; $('info').innerHTML = ''; $('chips').innerHTML = ''; $('nav').innerHTML = '';
  ui.hoja = 'inicio';
  renderHoja();
}

function renderHoja() {
  const wrap = $('wrap'), sheet = $('sheet');
  if (!ui.hoja) { wrap.hidden = true; return; }
  wrap.hidden = false;
  wrap.classList.toggle('center', ['previa', 'turno_de', 'evento_info', 'final', 'inicio', 'apotecario', 'resultado'].includes(ui.hoja));
  const head = (t, cerrable = true) =>
    `<div class="shead"><h2>${t}</h2>${cerrable ? '<button class="x" data-act="cerrar">✕</button>' : ''}</div>`;

  if (ui.hoja === 'inicio') {
    const grid = (side) => `<div class="equ-grid">` + Object.keys(EQUIPOS).map((k) =>
      `<button data-act="pick" data-side="${side}" data-team="${k}" class="${ui.inicio[side] === k ? 'sel' : ''}">${esc(EQUIPOS_ES[k])}</button>`,
    ).join('') + `</div>`;
    sheet.innerHTML = head('Blood Bowl', !!E) + `
      <p style="font-size:.85rem;color:var(--muted)">Dos equipos a 1.000k con los rosters
      iniciales. Se juega en este móvil o pasándose el enlace por turnos.</p>
      <h3>Equipo local</h3>${grid('a')}
      <div class="row"><input id="nomA" class="field" placeholder="Nombre (opcional)"></div>
      <h3>Equipo visitante</h3>${grid('b')}
      <div class="row"><input id="nomB" class="field" placeholder="Nombre (opcional)"></div>
      <div class="row"><button class="primary" data-act="empezar">Empezar partido</button></div>`;
    return;
  }
  if (ui.hoja === 'previa') {
    const g = E.ganadorSorteo;
    const [c] = colorEq(g);
    sheet.innerHTML = head('Previa del partido', false) + `
      <div class="dato"><span>Hinchas</span><b>${esc(E.equipos[0].nombre)} ${E.equipos[0].factorHinchas} · ${E.equipos[1].factorHinchas} ${esc(E.equipos[1].nombre)}</b></div>
      <div class="dato"><span>Clima</span><b>${CLIMA_ES[E.clima]}<small>${CLIMA_FX[E.clima]}</small></b></div>
      <div class="dato"><span>Sorteo</span><b>gana ${esc(E.equipos[g].nombre)}</b></div>
      <div class="turnode"><span class="eq" style="background:${c}">${esc(E.equipos[g].nombre)}</span>
      <p>decide quién empieza con el balón.</p></div>
      <div class="row"><button class="primary" data-act="saque" data-v="recibir">Recibir el balón</button></div>
      <div class="row"><button class="primary" style="background:var(--btn);color:var(--ink)" data-act="saque" data-v="patear">Patear (defender)</button></div>`;
    return;
  }
  if (ui.hoja === 'turno_de') {
    const d = quienDecide();
    if (d === null) { ui.hoja = null; wrap.hidden = true; return; }
    const [c] = colorEq(d);
    const esTurno = E.fase === 'turno';
    sheet.innerHTML = head(esTurno ? `Turno ${E.equipos[d].turno} de 8` : 'Cambio de manos', false) + `
      <div class="turnode"><span class="eq" style="background:${c}">${esc(E.equipos[d].nombre)}</span>
      <p>${esc(tareaActual())}</p></div>
      <div class="row"><button class="primary" data-act="visto">¡A jugar!</button></div>` +
      (esTurno || E.fase.startsWith('despliegue') ? `
      <div class="row"><button class="primary" style="background:var(--btn);color:var(--ink)" data-act="enlace">Copiar enlace para el rival</button></div>` : '');
    return;
  }
  if (ui.hoja === 'evento_info') {
    const ev = ui.eventoInfo;
    if (!ev) { ui.hoja = null; wrap.hidden = true; return; }
    sheet.innerHTML = head('Evento de patada', false) + `
      <div class="dato"><span>2D6 = ${ev.dados.join(' + ')}</span><b>${esc(ev.nombre)}</b></div>
      <p style="font-size:.9rem">${esc(ev.efecto)}</p>` +
      ev.lineas.map((l) => `<p style="font-size:.9rem;color:var(--muted)">${esc(l)}</p>`).join('') + `
      <div class="row"><button class="primary" data-act="visto">Continuar</button></div>`;
    return;
  }
  if (ui.hoja === 'resultado') {
    const t = ui.resultado?.[ui.resultadoIdx];
    if (!t) { ui.hoja = null; wrap.hidden = true; return; }
    const ultimo = ui.resultadoIdx === ui.resultado.length - 1;
    sheet.innerHTML = head(esc(ui.resultadoTitulo || 'Resultado'), false) + `
      <div class="res-icono">${t.icono}</div>
      <div class="res-titulo">${esc(t.titulo)}</div>` +
      (t.dadosTexto ? `<div class="res-dados">${t.dadosTexto.map((d) => `<div class="res-dado" style="font-size:.62rem;padding:2px;text-align:center">${esc(d)}</div>`).join('')}</div>` : '') +
      (t.dados ? `<div class="res-dados">${t.dados.map((d) => `<div class="res-dado">${d}</div>`).join('')}</div>` : '') +
      (t.exito !== undefined ? `<div class="res-exito ${t.exito ? 'si' : 'no'}">${t.exito ? '✅ ¡Éxito!' : '❌ Fallo'}</div>` : '') +
      (t.detalle ? `<p class="res-mods">${esc(t.detalle)}</p>` : '') +
      (t.mods?.length ? `<p class="res-mods">${esc(t.mods.join(' · '))}</p>` : '') + `
      <div class="res-paso">${ui.resultadoIdx + 1} de ${ui.resultado.length}</div>
      <div class="row"><button class="primary" data-act="res_sig">${ultimo ? 'Listo' : 'Siguiente →'}</button></div>` +
      (ultimo || ui.resultado.length < 3 ? '' : `<div class="row"><button class="primary" style="background:var(--btn);color:var(--ink)" data-act="res_fin">Saltar al tablero</button></div>`);
    return;
  }
  if (ui.hoja === 'apotecario') {
    const j = E.jugadores[ui.apoJugador];
    if (!j) { ui.hoja = null; wrap.hidden = true; return; }
    const [c] = colorEq(j.equipo);
    const que = j.situacion === 'ko'
      ? 'Está KO. El apotecario puede dejarlo <b>Aturdido en su casilla</b>' + (j.koPorPublico ? ' (del público se vuelve a Reservas)' : '') + '.'
      : `Lesión: <b>${esc(LESION_ES[j.lesion] ?? j.lesion)}</b>. El apotecario tira otra vez y eliges cuál se aplica (Magullado = vuelve a Reservas).`;
    sheet.innerHTML = head('Apotecario', false) + `
      <div class="turnode"><span class="eq" style="background:${c}">${esc(E.equipos[j.equipo].nombre)}</span></div>
      ${fichaJugador(j)}
      <p style="font-size:.9rem">${que}</p>
      <p style="font-size:.8rem;color:var(--muted)">Solo hay uno y solo actúa una vez por partido.</p>
      <div class="row"><button class="primary" data-act="apo_si">Usar el apotecario</button></div>
      <div class="row"><button class="primary" style="background:var(--btn);color:var(--ink)" data-act="apo_no">Guardarlo</button></div>`;
    return;
  }
  if (ui.hoja === 'final') {
    const m = E.equipos.map((x) => x.marcador);
    const ganador = m[0] === m[1] ? null : (m[0] > m[1] ? 0 : 1);
    sheet.innerHTML = head('Final del partido', false) + `
      <div class="turnode">
        <p style="font-size:1.6rem;font-weight:800">${esc(E.equipos[0].nombre)} ${m[0]} – ${m[1]} ${esc(E.equipos[1].nombre)}</p>
        <p>${ganador === null ? 'Empate: nadie presume en la taberna.' : `Victoria de ${esc(E.equipos[ganador].nombre)}.`}</p>
      </div>
      <div class="row"><button class="primary" data-act="nueva">Nueva partida</button></div>
      <div class="row"><button class="primary" style="background:var(--btn);color:var(--ink)" data-act="hoja" data-v="registro">Ver las tiradas</button></div>`;
    return;
  }
  if (ui.hoja === 'registro') {
    const lineas = E.registro.slice(-60).map(lineaRegistro).join('\n');
    sheet.innerHTML = head('Tiradas') + `<div class="log">${esc(lineas) || 'Aún no hay tiradas.'}</div>`;
    sheet.querySelector('.log').scrollTop = 1e6;
    return;
  }
  if (ui.hoja === 't0' || ui.hoja === 't1') {
    const i = +ui.hoja[1];
    const Eq = E.equipos[i];
    const SIT = { reserva: 'Reservas', campo: 'En el campo', ko: 'KO', lesionado: 'Lesionado', expulsado: 'Expulsado' };
    const filas = Object.values(E.jugadores).filter((j) => j.equipo === i)
      .map((j) => `<div style="padding:5px 0;border-bottom:1px solid var(--line);font-size:.84rem">
        <b>#${j.dorsal} ${esc(POSICIONES_ES[j.pos])}</b> · ${statLinea(j)} · ${SIT[j.situacion]}${j.postura !== 'de_pie' && j.situacion === 'campo' ? ` (${j.postura})` : ''}
        <span class="skills">${esc(habilidades(j))}</span></div>`).join('');
    sheet.innerHTML = head(esc(Eq.nombre)) +
      `<p style="font-size:.84rem;color:var(--muted)">Rerolls ${Eq.rerolls}/${Eq.rerollsMax} ·
       Apotecario ${Eq.apotecario ? (Eq.apotecarioUsado ? 'usado' : 'sí') : 'no'} ·
       Hinchas ${Eq.hinchas}${Eq.sobornos ? ` · Sobornos ${Eq.sobornos}` : ''}</p>` + filas;
    return;
  }
  if (ui.hoja === 'menu') {
    sheet.innerHTML = head('Menú') + `
      <div class="row"><button class="primary" data-act="enlace">Copiar enlace de la partida</button></div>
      <div class="row"><button class="primary" style="background:var(--btn);color:var(--ink)" data-act="deshacer">Deshacer la última jugada</button></div>
      <div class="row"><button class="primary" style="background:var(--bad)" data-act="nueva">Nueva partida</button></div>
      <p style="font-size:.78rem;color:var(--muted)">La partida se guarda sola en este
      navegador. El enlace lleva la partida entera dentro: quien lo abra sigue donde lo
      dejaste.</p>`;
    return;
  }
}

/* ---------- eventos globales ---------- */

document.addEventListener('click', (ev) => {
  const bench = ev.target.closest('[data-bench]');
  if (bench) { ui.sel = ui.sel === bench.dataset.bench ? null : bench.dataset.bench; render(); return; }
  const btn = ev.target.closest('[data-act]');
  if (btn) { act(btn); return; }
  const cel = ev.target.closest('.c');
  if (cel) tapCell(+cel.dataset.x, +cel.dataset.y);
});
window.addEventListener('resize', () => E && renderPitch());

/* ---------- arranque ---------- */

async function boot() {
  try {
    const deEnlace = await desdeEnlace(location.href);
    if (deEnlace) {
      E = deEnlace;
      history.replaceState(null, '', location.pathname + location.search);
      guardar();
      // La repetición: lo que pasó desde tu último turno, narrado en tarjetas.
      const tramo = tramoRival(E.registro, E.equipos?.[E.activo]?.nombre);
      if (tramo.length > 1) prepararResultados(tramo, { repeticion: true });
      else toast('Partida cargada del enlace.');
      render();
      return;
    }
  } catch (err) {
    toast(err.message);
  }
  try {
    const s = localStorage.getItem(KEY);
    if (s) {
      const o = JSON.parse(s);
      if (o && o.equipos && o.fase) E = o;
    }
  } catch {}
  render();
}
boot();
