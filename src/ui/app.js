// La interfaz móvil. Toda la lógica de juego vive en src/engine/; aquí solo hay
// pantalla, toques y las decisiones de entrenador (callbacks síncronos del motor).

import { azarReal } from '../engine/dice.js';
import { EQUIPOS } from '../data/equipos.js';
import { ROSTERS_1000K } from '../data/rosters-iniciales.js';
import { EQUIPOS_ES, POSICIONES_ES, FICHA_ES, HABILIDADES_ES } from '../data/nombres.es.js';
import { crearEquipo } from '../engine/equipo.js';
import { crearPartido, jugador, enCasilla, marcadoresDe, tieneZonaDefensa, posicionBalon } from '../engine/partido.js';
import { ANCHO, ALTO, filaLos, enZonaAncha, sonAdyacentes } from '../engine/tablero.js';
import { activar, paso, saltar, levantarse, terminarAccion } from '../engine/movimiento.js';
import { placar, placarEnPenetracion, CARAS_PLACAJE } from '../engine/placaje.js';
import { pase, entrega, alcance } from '../engine/pase.js';
import { falta } from '../engine/falta.js';
import {
  prePartido, elegirSaque, desplegar, validarDespliegue, confirmarDespliegue,
  patada, moverEnEvento, terminarEvento, recepcionLibre, terminarTurno, comprobarTouchdown,
} from '../engine/secuencia.js';
import { aEnlace, desdeEnlace } from '../enlace.js';
import { FORMACIONES, asignarFormacion } from '../data/formaciones.js';

const KEY = 'bbweb-v1';
const azar = azarReal;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

let E = null;                                   // estado del partido (motor)
let ui = { sel: null, modo: null, hoja: null }; // selección y modo de la pantalla
let undoStack = [];

/* ---------- persistencia y deshacer ---------- */

const guardar = () => { try { localStorage.setItem(KEY, JSON.stringify(E)); } catch {} };
function deshacer() {
  if (!undoStack.length) return toast('Nada que deshacer.');
  E = JSON.parse(undoStack.pop());
  ui = { sel: null, modo: null, hoja: null };
  guardar(); render();
}

/** Ejecuta una jugada del motor con red de seguridad: si lanza, el estado no cambia. */
function ejecutar(fn) {
  const snap = JSON.stringify(E);
  try {
    fn();
  } catch (err) {
    E = JSON.parse(snap);
    toast(err.message);
    render();
    return false;
  }
  undoStack.push(snap);
  if (undoStack.length > 40) undoStack.shift();
  if (E.fase === 'turno') comprobarTouchdown(E);
  guardar(); render();
  return true;
}

/* ---------- decisiones de entrenador (síncronas) ---------- */

function elegirSync(titulo, textos) {
  if (textos.length <= 1) return 0;
  const msg = `${titulo}\n` + textos.map((t, i) => `${i + 1}. ${t}`).join('\n');
  for (;;) {
    const r = prompt(msg, '1');
    if (r === null) return 0;
    const n = parseInt(r, 10);
    if (n >= 1 && n <= textos.length) return n - 1;
  }
}

const CARA_ES = {
  player_down: 'Atacante derribado', both_down: 'Ambos derribados', push: 'Empujón',
  stumble: 'Desequilibrado', pow: '¡POW!',
};

function opcionesMotor() {
  return {
    alFallar: (tipo, c) => {
      const Eq = E.equipos[E.activo];
      if (Eq.rerolls <= 0) return false;
      const detalle = c?.necesario ? ` (hacía falta ${c.necesario}+, salió ${c.valor})` : '';
      return confirm(`Ha fallado: ${tipo}${detalle}.\n¿Gastar un reroll de equipo? (quedan ${Eq.rerolls})`);
    },
    elegirDado: (resultados, quien) => {
      const quienTxt = quien === 'objetivo' ? E.equipos[1 - E.activo].nombre : E.equipos[E.activo].nombre;
      return elegirSync(`Dados de placaje — elige ${quienTxt}:`, resultados.map((r) => CARA_ES[r]));
    },
    elegirEmpuje: (cands, ctx) =>
      elegirSync(ctx.defensor ? 'Echarse a un lado — elige el DEFENSOR la casilla:' : 'Casilla de empuje:',
        cands.map((c) => (c.fuera ? '¡Al público!' : `columna ${c.x + 1}, fila ${c.y + 1}`))),
    impulso: () => confirm('¿Hacer el impulso (ocupar la casilla del empujado)?'),
    usarForcejear: (j) => confirm(`${j.id} tiene Forcejear. ¿Usarlo (ambos tumbados, sin armadura)?`),
    elegirInterceptor: (ids) => {
      if (!confirm(`${E.equipos[1 - E.activo].nombre}: ¿intentar interceptar el pase?`)) return null;
      return ids[elegirSync('¿Quién lo intenta?', ids.map((id) => etiqueta(jugador(E, id))))];
    },
    protestar: () => confirm('¡Expulsado! ¿Protestar al árbitro?'),
    usarSoborno: () => confirm('¿Usar un Soborno para que el árbitro mire a otro lado?'),
  };
}

/* ---------- textos ---------- */

const etiqueta = (j) => `${POSICIONES_ES[j.pos] ?? j.pos} #${j.dorsal} (${E.equipos[j.equipo].nombre})`;
const statLinea = (j) =>
  `MV ${j.perfil.mv} · FU ${j.perfil.fu} · AG ${j.perfil.ag}+ · PS ${j.perfil.ps}+ · AR ${j.perfil.ar}+`;
const habilidades = (j) => j.hab.map((h) => HABILIDADES_ES[h] ?? h).join(', ') || '—';

const CLIMA_ES = {
  sweltering_heat: 'Calor asfixiante', very_sunny: 'Muy soleado',
  perfect_conditions: 'Clima perfecto', pouring_rain: 'Lluvia torrencial', blizzard: 'Ventisca',
};

function lineaRegistro(ev) {
  const j = ev.jugador && E.jugadores[ev.jugador] ? `#${E.jugadores[ev.jugador].dorsal}` : ev.jugador ?? '';
  const c = ev.chequeo ? ` [${ev.chequeo.valor}${ev.chequeo.suma ? (ev.chequeo.suma > 0 ? '+' : '') + ev.chequeo.suma : ''} vs ${ev.chequeo.necesario}+ → ${ev.chequeo.exito ? 'OK' : 'falla'}]` : '';
  const porques = ev.chequeo?.mods?.length ? ` (${ev.chequeo.mods.map((m) => `${m.v > 0 ? '+' : ''}${m.v} ${m.porque}`).join('; ')})` : '';
  const T = {
    activacion: () => `— ${j} declara ${ev.accion}${ev.objetivo ? ` contra ${ev.objetivo}` : ''}`,
    esquivar: () => `${j} esquiva${c}${porques}`,
    esquivar_reroll: () => `  repite${ev.habilidad ? ' (Esquivar)' : ' (reroll)'}${c}`,
    rush: () => `${j} fuerza la marcha${c ?? ` [${ev.d6}]`}`,
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
  };
  return (T[ev.tipo] ?? (() => `${ev.tipo}${j ? ' ' + j : ''}${c}`))();
}

/* ---------- toast ---------- */

let tt;
function toast(m) {
  const t = $('toast');
  t.textContent = m;
  t.classList.add('show');
  clearTimeout(tt);
  tt = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ---------- partida nueva ---------- */

function nuevaPartida(razaA, razaB, nombreA, nombreB) {
  const A = crearEquipo(razaA, ROSTERS_1000K[razaA], { nombre: nombreA || EQUIPOS_ES[razaA] });
  const B = crearEquipo(razaB, ROSTERS_1000K[razaB], { nombre: nombreB || EQUIPOS_ES[razaB] });
  E = crearPartido(A, B);
  E.fase = 'pre_partido';
  undoStack = [];
  ejecutar(() => prePartido(E, { azar }));
  ui.hoja = null;
  render();
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

function tapCell(x, y) {
  if (!E) return;
  const j = enCasilla(E, x, y);

  if (E.fase === 'despliegue_kicker' || E.fase === 'despliegue_receiver') {
    const eq = E.fase === 'despliegue_kicker' ? E.kicker : 1 - E.kicker;
    if (ui.sel) {
      const s = jugador(E, ui.sel);
      ejecutar(() => desplegar(E, s.id, x, y));
      ui.sel = null; render();
      return;
    }
    if (j && j.equipo === eq) { ui.sel = j.id; render(); }
    return;
  }

  if (E.fase === 'patada') {
    ejecutar(() => patada(E, x, y, { azar }));
    return;
  }

  if (E.pendiente) {
    if (ui.sel) {
      const id = ui.sel; ui.sel = null;
      ejecutar(() => moverEnEvento(E, id, x, y));
      return;
    }
    if (j && j.equipo === E.pendiente.equipo) { ui.sel = j.id; render(); }
    return;
  }

  if (E.fase === 'recepcion_libre') {
    if (j && j.equipo !== E.kicker) ejecutar(() => recepcionLibre(E, j.id));
    return;
  }

  if (E.fase !== 'turno' || E.turnover) return;

  const a = E.activacion;
  if (!a) {
    // Seleccionar a un jugador propio activable.
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
  const opciones = opcionesMotor();

  if (ui.modo === 'blitz_objetivo') return; // el objetivo se elige antes de activar

  if (ui.modo === 'pase_objetivo') {
    ui.modo = null;
    ejecutar(() => pase(E, x, y, { azar, opciones }));
    return;
  }
  if (j && a.accion === 'blitz' && j.id === a.objetivoBlitz && sonAdyacentes(yo.x, yo.y, j.x, j.y) && !a.placajeHecho) {
    ejecutar(() => placarEnPenetracion(E, { azar, opciones }));
    return;
  }
  if (j && a.accion === 'block' && j.equipo !== yo.equipo && sonAdyacentes(yo.x, yo.y, j.x, j.y)) {
    ejecutar(() => { placar(E, yo.id, j.id, { azar, opciones }); terminarAccion(E); });
    return;
  }
  if (j && a.accion === 'foul' && j.equipo !== yo.equipo && sonAdyacentes(yo.x, yo.y, j.x, j.y)) {
    ejecutar(() => falta(E, j.id, { azar, opciones }));
    return;
  }
  if (j && a.accion === 'handoff' && j.equipo === yo.equipo && sonAdyacentes(yo.x, yo.y, j.x, j.y)) {
    ejecutar(() => entrega(E, j.id, { azar }));
    return;
  }
  if (!j) {
    const dist = Math.max(Math.abs(x - yo.x), Math.abs(y - yo.y));
    if (yo.postura === 'tumbado') {
      if (!ejecutar(() => levantarse(E, { azar }))) return;
      if (!E.activacion) return;
    }
    if (dist === 1) ejecutar(() => paso(E, x, y, { azar, alFallar: opciones.alFallar }));
    else if (dist === 2) ejecutar(() => saltar(E, x, y, { azar, alFallar: opciones.alFallar }));
    else toast('Mueve casilla a casilla (o salta por encima de un caído).');
  }
}

/* ---------- acciones de los chips ---------- */

function act(el) {
  const d = el.dataset;
  const opciones = opcionesMotor();
  switch (d.act) {
    case 'nueva': ui.hoja = 'inicio'; break;
    case 'empezar': {
      const razaA = $('selA').value, razaB = $('selB').value;
      nuevaPartida(razaA, razaB, $('nomA').value.trim(), $('nomB').value.trim());
      return;
    }
    case 'saque': ejecutar(() => elegirSaque(E, d.v)); return;
    case 'formacion': ejecutar(() => aplicarFormacion(E.fase === 'despliegue_kicker' ? E.kicker : 1 - E.kicker, d.v)); return;
    case 'confirmar': ui.sel = null; ejecutar(() => confirmarDespliegue(E)); return;
    case 'centro': ejecutar(() => patada(E, 7, E.kicker === 0 ? 6 : 19, { azar })); return;
    case 'evento_fin': ui.sel = null; ejecutar(() => terminarEvento(E, { azar })); return;
    case 'accion': {
      const sel = ui.sel;
      ui.modo = null;
      if (d.v === 'blitz') { ui.modo = 'blitz_objetivo'; render(); return; }
      ejecutar(() => activar(E, sel, d.v, { azar }));
      return;
    }
    case 'lanzar': ui.modo = 'pase_objetivo'; render(); return;
    case 'fin_activacion': ui.sel = null; ui.modo = null; ejecutar(() => terminarAccion(E)); return;
    case 'fin_turno':
      ui.sel = null; ui.modo = null;
      if (!ejecutar(() => terminarTurno(E, { azar }))) return;
      if (E.fase === 'turno') ui.hoja = 'relevo';
      render(); return;
    case 'deshacer': deshacer(); return;
    case 'hoja': ui.hoja = d.v; break;
    case 'cerrar': ui.hoja = null; break;
    case 'enlace': {
      const base = location.origin === 'null' ? location.href.split('#')[0] : location.href.split('#')[0];
      aEnlace(E, base).then((url) => navigator.clipboard?.writeText(url).then(
        () => toast('Enlace copiado: envíaselo al rival.'),
        () => { prompt('Copia el enlace:', url); },
      ));
      return;
    }
  }
  render();
}

// El objetivo del blitz se elige tocando al rival ANTES de activar.
function tapBlitzObjetivo(x, y) {
  const j = enCasilla(E, x, y);
  const sel = ui.sel;
  if (!j || j.equipo === E.activo) { toast('Toca al rival objetivo de la Penetración.'); return; }
  ui.modo = null;
  ejecutar(() => activar(E, sel, 'blitz', { azar, objetivo: j.id }));
}

/* ---------- render ---------- */

function render() {
  if (!E) { renderInicio(); return; }
  renderTop(); renderPitch(); renderPanel(); renderNav(); renderHoja();
}

function colorEq(i) {
  return i === 0 ? ['var(--eqA)', 'var(--eqAt)'] : ['var(--eqB)', 'var(--eqBt)'];
}

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

  // Marcaje visible: con un jugador propio seleccionado, las zonas de placaje rivales.
  const marca = new Set();
  const sel = ui.sel && E.jugadores[ui.sel];
  if (sel && E.fase === 'turno') {
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
      if (marca.has(`${x},${y}`)) cls.push('tz');
      const j = enCasilla(E, x, y);
      let inner = '';
      if (j) {
        const [c, t] = colorEq(j.equipo);
        const k = ['tk', j.postura !== 'de_pie' ? j.postura : '', j.grande ? 'big' : '',
          j.activado && E.fase === 'turno' ? 'act' : '', ui.sel === j.id ? 'sel' : ''].filter(Boolean).join(' ');
        const balon = portador === j.id ? '<span class="bc"></span>' : '';
        inner = `<div class="${k}" style="--c:${c};--t:${t}"><span>${esc(FICHA_ES[j.pos] ?? '?')}</span>${balon}</div>`;
      } else if (b && !portador && b.x === x && b.y === y) {
        inner = '<div class="ball"></div>';
      }
      html += `<div class="${cls.join(' ')}" data-x="${x}" data-y="${y}">${inner}</div>`;
    }
  }
  p.innerHTML = html;
}

function renderPanel() {
  const info = $('info'), chips = $('chips');
  const sel = ui.sel && E.jugadores[ui.sel];
  let txt = '', ch = '';
  const chip = (act, label, extra = '') => `<button data-act="${act}" ${extra}>${label}</button>`;
  const chipV = (act, v, label, extra = '') => `<button data-act="${act}" data-v="${v}" ${extra}>${label}</button>`;

  switch (E.fase) {
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
      // El pateador defiende; el receptor ataca: sus formaciones primero.
      const defendiendo = eq === E.kicker;
      const orden = Object.entries(FORMACIONES)
        .sort(([, a], [, b]) => (a.lado === (defendiendo ? 'defensa' : 'ataque') ? -1 : 1) - (b.lado === (defendiendo ? 'defensa' : 'ataque') ? -1 : 1));
      ch = chip('confirmar', 'Confirmar', problemas.length ? 'disabled' : 'class="hot"') +
        orden.map(([k, F]) => chipV('formacion', k, F.nombre)).join('');
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
        txt = `<b>${esc(etiqueta(yo))}</b> — ${a.accion} · MV ${Math.max(0, restante)}${a.rushUsados ? ` · rush ${a.rushUsados}/2` : ''}` +
          (ui.modo === 'pase_objetivo' ? ' · <b>toca la casilla del pase</b>' : '') +
          `<span class="skills">${esc(habilidades(yo))}</span>`;
        if (a.accion === 'pass' && E.balon?.portador === yo.id) ch += chip('lanzar', 'Lanzar', 'class="hot"');
        if (a.accion === 'blitz' && !a.placajeHecho) {
          const O = jugador(E, a.objetivoBlitz);
          if (sonAdyacentes(yo.x, yo.y, O.x, O.y)) txt += '<span class="skills">Toca al objetivo para placar.</span>';
        }
        ch += chip('fin_activacion', 'Terminar activación');
      } else if (sel && ui.modo === 'elegir_accion') {
        txt = `<b>${esc(etiqueta(sel))}</b> · ${statLinea(sel)}<span class="skills">${esc(habilidades(sel))}</span>`;
        const puede = (k) => !E.usadas[k];
        ch = chipV('accion', 'move', 'Mover', 'class="hot"') +
          (puede('blitz') ? chipV('accion', 'blitz', 'Blitz') : '') +
          chipV('accion', 'block', 'Placar') +
          (puede('pass') ? chipV('accion', 'pass', 'Pase') : '') +
          (puede('handoff') ? chipV('accion', 'handoff', 'Entrega') : '') +
          (puede('foul') ? chipV('accion', 'foul', 'Falta') : '') +
          (puede('secure') && E.balon && !E.balon.portador ? chipV('accion', 'secure', 'Asegurar') : '');
      } else if (sel) {
        txt = `<b>${esc(etiqueta(sel))}</b> · ${statLinea(sel)}<span class="skills">${esc(habilidades(sel))}</span>`;
        ch = chip('fin_turno', 'Fin de turno');
      } else if (ui.modo === 'blitz_objetivo') {
        txt = '<b>Penetración</b>: toca al rival objetivo.';
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
      <span class="tk" style="--c:${c};--t:${t};width:24px;height:24px;font-size:.72rem;display:grid;place-items:center">${esc(FICHA_ES[j.pos])}</span></button>`;
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
  const head = (t, cerrable = true) =>
    `<div class="shead"><h2>${t}</h2>${cerrable ? '<button class="x" data-act="cerrar">✕</button>' : ''}</div>`;

  if (ui.hoja === 'inicio') {
    const ops = Object.keys(EQUIPOS).map((k) => `<option value="${k}">${esc(EQUIPOS_ES[k])}</option>`).join('');
    sheet.innerHTML = head('Blood Bowl', !!E) + `
      <p style="font-size:.85rem;color:var(--muted)">Dos equipos a 1.000k con los rosters
      iniciales. La partida se juega en este móvil o pasándose el enlace por turnos.</p>
      <h3>Equipo local</h3>
      <div class="row"><select id="selA" class="field">${ops}</select></div>
      <div class="row"><input id="nomA" class="field" placeholder="Nombre (opcional)"></div>
      <h3>Equipo visitante</h3>
      <div class="row"><select id="selB" class="field">${ops}</select></div>
      <div class="row"><input id="nomB" class="field" placeholder="Nombre (opcional)"></div>
      <div class="row"><button class="primary" data-act="empezar">Empezar partido</button></div>`;
    const selB = sheet.querySelector('#selB');
    if (selB) selB.value = 'black_orc';
    return;
  }
  if (ui.hoja === 'relevo') {
    const Eq = E.equipos[E.activo];
    sheet.innerHTML = head('Cambio de turno') + `
      <p>Le toca a <b>${esc(Eq.nombre)}</b> (turno ${Eq.turno}).</p>
      <p style="font-size:.85rem;color:var(--muted)">Pásale el móvil… o envíale el enlace
      con la partida dentro y que siga en el suyo.</p>
      <div class="row"><button class="primary" data-act="enlace">Copiar enlace del turno</button></div>
      <div class="row"><button class="primary" style="background:var(--btn);color:var(--ink)" data-act="cerrar">Seguir en este móvil</button></div>`;
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
  if (cel) {
    const x = +cel.dataset.x, y = +cel.dataset.y;
    if (ui.modo === 'blitz_objetivo') { tapBlitzObjetivo(x, y); return; }
    tapCell(x, y);
  }
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
      toast('Partida cargada del enlace.');
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
