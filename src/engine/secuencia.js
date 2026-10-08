// La secuencia de partido: previa, despliegue, patada inicial con su tabla de eventos,
// turnos, touchdowns, final de entrada, descanso y final del partido.
//
// Fuente: source/tablas/secuencia-de-partido.md, patada-inicial.md y clima.md.
//
// Fases (estado.fase):
//   pre_partido → eleccion_saque → despliegue_kicker → despliegue_receiver →
//   patada → evento_pendiente* → turno ⇄ … → fin_drive → (despliegue | descanso | fin)
//
// Los eventos de patada que requieren decisiones (Defensa sólida, Patada alta,
// Anticipación, ¡A la carga!) dejan `estado.pendiente` y la UI los resuelve con las
// funciones de este módulo antes de que caiga el balón.

import { tirar, tirar2D6, tirarD3, tiradaEnfrentada, consultarTabla } from './dice.js';
import { DIRECCIONES_D8, enCampo, filaLos, enMitadPropia, enZonaAncha, enCampoCentral, filaAnotacion, ALTO } from './tablero.js';
import { jugador, enCasilla, anotar, tieneZonaDefensa, marcadoresDe, posicionBalon } from './partido.js';
import { rebotar, intentarAtrapar } from './balon.js';

export const TABLA_CLIMA = {
  nombre: 'weather',
  filas: [
    [2, 2, 'sweltering_heat', 'Calor asfixiante: al final de cada entrada, D3 jugadores al azar de cada equipo a Reservas.'],
    [3, 3, 'very_sunny', 'Muy soleado: −1 a los chequeos de Pase.'],
    [4, 10, 'perfect_conditions', 'Clima perfecto.'],
    [11, 11, 'pouring_rain', 'Lluvia torrencial: −1 a recoger, atrapar e interceptar.'],
    [12, 12, 'blizzard', 'Ventisca: −1 a Forzar la marcha; solo pases Rápidos y Cortos.'],
  ],
};

export const TABLA_PATADA = {
  nombre: 'kickoff',
  filas: [
    [2, 2, 'get_the_ref', 'Árbitro intimidado: un Soborno gratis para cada equipo.'],
    [3, 3, 'time_out', '¡Tiempo muerto!: los marcadores de turno retroceden o avanzan.'],
    [4, 4, 'solid_defence', 'Defensa sólida: el pateador recoloca hasta D3+3 desmarcados.'],
    [5, 5, 'high_kick', 'Patada alta: un desmarcado del receptor se coloca bajo el balón.'],
    [6, 6, 'cheering_fans', 'Los hinchas animan: D6+animadoras; apoyo extra en el primer placaje.'],
    [7, 7, 'brilliant_coaching', 'Entrenador brillante: D6+ayudantes; un reroll extra esta entrada.'],
    [8, 8, 'changing_weather', 'Clima cambiante: nueva tirada de clima.'],
    [9, 9, 'quick_snap', 'Anticipación: hasta D3+3 desmarcados del receptor mueven 1 casilla.'],
    [10, 10, 'blitz_event', '¡A la carga!: hasta D3+3 desmarcados del pateador se activan.'],
    [11, 11, 'dodgy_snack', 'Indigestión: un jugador al azar del que pierda la tirada lo paga.'],
    [12, 12, 'pitch_invasion', 'Invasión de campo: D3 jugadores al azar del perdedor, derribados y aturdidos.'],
  ],
};

export const MAX_EN_CAMPO = 11;
const receptor = (estado) => 1 - estado.kicker;

/** 1. Previa: hinchas (D3 + hinchas), clima (1D6 por entrenador) y tirada enfrentada. */
export function prePartido(estado, { azar }) {
  if (estado.fase !== undefined && estado.fase !== 'pre_partido') throw new Error(`Fase: ${estado.fase}`);
  for (const E of estado.equipos) {
    const d = tirarD3({ azar, motivo: 'hinchas ocasionales' });
    E.factorHinchas = E.hinchas + d.valor;
    anotar(estado, 'factor_hinchas', { equipo: E.nombre, d3: d.valor, total: E.factorHinchas });
  }
  const clima = tirar2D6({ azar, motivo: 'clima' });
  estado.clima = consultarTabla(TABLA_CLIMA, clima.valor).nombre;
  anotar(estado, 'clima', { dados: clima.dados, resultado: estado.clima });

  const sorteo = tiradaEnfrentada({ azar });
  estado.ganadorSorteo = sorteo.ganador;
  anotar(estado, 'sorteo', { rondas: sorteo.rondas, ganador: estado.equipos[sorteo.ganador].nombre });
  estado.fase = 'eleccion_saque';
  return { sorteo };
}

/** 2. El ganador del sorteo decide si patea o recibe. */
export function elegirSaque(estado, decide) {
  if (estado.fase !== 'eleccion_saque') throw new Error(`Fase: ${estado.fase}`);
  if (decide !== 'patear' && decide !== 'recibir') throw new Error('patear o recibir');
  estado.kicker = decide === 'patear' ? estado.ganadorSorteo : 1 - estado.ganadorSorteo;
  estado.recibioAlEmpezar = receptor(estado);          // patea el otro en la 2ª parte
  anotar(estado, 'eleccion', { equipo: estado.equipos[estado.ganadorSorteo].nombre, decide });
  estado.fase = 'despliegue_kicker';
}

/** Coloca a un jugador durante el despliegue (o lo devuelve a reservas con x = null). */
export function desplegar(estado, jugadorId, x, y) {
  const equipoQueDespliega = estado.fase === 'despliegue_kicker' ? estado.kicker
    : estado.fase === 'despliegue_receiver' ? receptor(estado)
    : (() => { throw new Error(`Fase: ${estado.fase}`); })();
  const j = jugador(estado, jugadorId);
  if (j.equipo !== equipoQueDespliega) throw new Error(`No le toca desplegar a ${j.id}.`);
  if (j.situacion !== 'reserva' && j.situacion !== 'campo') throw new Error(`${j.id} no está disponible (${j.situacion}).`);
  if (x === null) { j.situacion = 'reserva'; j.x = j.y = -1; return; }
  if (!enCampo(x, y) || !enMitadPropia(j.equipo, y)) throw new Error('Solo en su propia mitad.');
  if (enCasilla(estado, x, y)) throw new Error('Casilla ocupada.');
  j.situacion = 'campo'; j.postura = 'de_pie'; j.x = x; j.y = y;
}

/** Validación del despliegue: máx. 11, mín. 3 en el centro pegados a la LOS, máx. 2 por banda. */
export function validarDespliegue(estado, equipo) {
  const problemas = [];
  const enCampoEq = Object.values(estado.jugadores).filter((j) => j.equipo === equipo && j.situacion === 'campo');
  const disponibles = Object.values(estado.jugadores).filter((j) => j.equipo === equipo && (j.situacion === 'campo' || j.situacion === 'reserva')).length;

  if (enCampoEq.length > MAX_EN_CAMPO) problemas.push(`Como mucho ${MAX_EN_CAMPO} jugadores en el campo.`);
  const esperados = Math.min(MAX_EN_CAMPO, disponibles);
  if (enCampoEq.length < esperados) problemas.push(`Hay que alinear ${esperados} jugadores (hay ${enCampoEq.length}).`);

  const los = filaLos(equipo);
  const enLos = enCampoEq.filter((j) => j.y === los && enCampoCentral(j.x)).length;
  const minLos = Math.min(3, enCampoEq.length);
  if (enLos < minLos) problemas.push(`Hacen falta ${minLos} jugadores en el campo central pegados a la línea (hay ${enLos}).`);

  for (const lado of [[0, 3], [11, 14]]) {
    const n = enCampoEq.filter((j) => j.x >= lado[0] && j.x <= lado[1]).length;
    if (n > 2) problemas.push(`Como mucho 2 jugadores en cada zona ancha (hay ${n} en x ${lado[0]}-${lado[1]}).`);
  }
  return problemas;
}

export function confirmarDespliegue(estado) {
  if (estado.fase === 'despliegue_kicker') {
    const p = validarDespliegue(estado, estado.kicker);
    if (p.length) throw new Error(p.join(' '));
    estado.fase = 'despliegue_receiver';
  } else if (estado.fase === 'despliegue_receiver') {
    const p = validarDespliegue(estado, receptor(estado));
    if (p.length) throw new Error(p.join(' '));
    estado.fase = 'patada';
  } else throw new Error(`Fase: ${estado.fase}`);
}

/**
 * 3. La patada: el balón se coloca en la mitad del receptor, se desvía 1D6 casillas en
 * dirección 1D8 y, con el balón en el aire, el pateador tira el evento de patada.
 */
export function patada(estado, x, y, { azar }) {
  if (estado.fase !== 'patada') throw new Error(`Fase: ${estado.fase}`);
  if (!enCampo(x, y) || enMitadPropia(estado.kicker, y)) throw new Error('El balón se coloca en la mitad rival.');

  const d6 = tirar(6, { azar, motivo: 'distancia del desvío' });
  const d8 = tirar(8, { azar, motivo: 'dirección del desvío' });
  const [dx, dy] = DIRECCIONES_D8[d8.valor];
  const bx = x + dx * d6.valor, by = y + dy * d6.valor;
  estado.patadaEnElAire = { x: bx, y: by };   // aún no se puede atrapar
  anotar(estado, 'patada', { desde: [x, y], d6: d6.valor, d8: d8.valor, a: [bx, by] });

  const t = tirar2D6({ azar, motivo: 'evento de patada' });
  const evento = consultarTabla(TABLA_PATADA, t.valor).nombre;
  anotar(estado, 'evento_patada', { dados: t.dados, evento });
  estado.fase = 'evento_patada';
  resolverEventoPatada(estado, evento, { azar });
  if (!estado.pendiente) caidaDelBalon(estado, { azar });
  return { evento };
}

function resolverEventoPatada(estado, evento, { azar }) {
  const K = estado.equipos[estado.kicker], R = estado.equipos[receptor(estado)];
  switch (evento) {
    case 'get_the_ref':
      for (const E of estado.equipos) E.sobornos = (E.sobornos ?? 0) + 1;
      anotar(estado, 'get_the_ref', { efecto: 'un Soborno gratis para cada equipo' });
      return;
    case 'time_out': {
      // Si el marcador del pateador va por el turno 6-8, ambos retroceden; si no, avanzan.
      const atras = K.turno >= 6;
      for (const E of estado.equipos) E.turno = Math.max(0, Math.min(8, E.turno + (atras ? -1 : 1)));
      anotar(estado, 'time_out', { atras });
      return;
    }
    case 'cheering_fans':
    case 'brilliant_coaching': {
      const extra = evento === 'cheering_fans' ? 'animadoras' : 'ayudantes';
      const tiradas = estado.equipos.map((E) => tirar(6, { azar, motivo: `${evento} (${E.nombre})` }).valor + E[extra]);
      const max = Math.max(...tiradas);
      estado.equipos.forEach((E, i) => {
        if (tiradas[i] !== max) return;
        if (evento === 'brilliant_coaching') { E.rerolls++; E.rerollExtraDrive = (E.rerollExtraDrive ?? 0) + 1; }
        else E.apoyoExtraProximoTurno = true;
      });
      anotar(estado, evento, { tiradas });
      return;
    }
    case 'changing_weather': {
      const c = tirar2D6({ azar, motivo: 'clima cambiante' });
      estado.clima = consultarTabla(TABLA_CLIMA, c.valor).nombre;
      anotar(estado, 'clima', { dados: c.dados, resultado: estado.clima });
      if (estado.clima === 'perfect_conditions' && estado.patadaEnElAire) {
        // El balón se dispersa 3 veces en el aire antes de caer.
        let { x, y } = estado.patadaEnElAire;
        for (let i = 0; i < 3; i++) {
          const d = tirar(8, { azar, motivo: 'dispersión en el aire' });
          x += DIRECCIONES_D8[d.valor][0]; y += DIRECCIONES_D8[d.valor][1];
        }
        estado.patadaEnElAire = { x, y };
        anotar(estado, 'dispersion_aire', { a: [x, y] });
      }
      return;
    }
    case 'dodgy_snack': {
      const tiradas = estado.equipos.map((E) => tirar(6, { azar, motivo: `indigestión (${E.nombre})` }).valor);
      const min = Math.min(...tiradas);
      estado.equipos.forEach((E, i) => {
        if (tiradas[i] !== min) return;
        const victima = jugadorAlAzar(estado, i, { azar });
        if (!victima) return;
        const d = tirar(6, { azar, motivo: `indigestión de ${victima.id}` });
        if (d.valor === 1) {
          victima.situacion = 'reserva'; victima.x = victima.y = -1;
          anotar(estado, 'dodgy_snack', { jugador: victima.id, efecto: 'pasa la entrada en el baño' });
        } else {
          victima.perfil.mv -= 1; victima.perfil.ar -= 1;
          estado.efectosDrive.push({ jugador: victima.id, mv: 1, ar: 1 });
          anotar(estado, 'dodgy_snack', { jugador: victima.id, efecto: '−1 MV y −1 AR esta entrada' });
        }
      });
      return;
    }
    case 'pitch_invasion': {
      const tiradas = estado.equipos.map((E) => tirar(6, { azar, motivo: `invasión (${E.nombre})` }).valor + E.factorHinchas);
      const min = Math.min(...tiradas);
      estado.equipos.forEach((E, i) => {
        if (tiradas[i] !== min) return;
        const n = tirarD3({ azar, motivo: 'cuántos pisotean' }).valor;
        for (let k = 0; k < n; k++) {
          const v = jugadorAlAzar(estado, i, { azar, dePie: true });
          if (!v) break;
          v.postura = 'aturdido';
          anotar(estado, 'pitch_invasion', { jugador: v.id });
        }
      });
      return;
    }
    case 'solid_defence':
    case 'quick_snap':
    case 'high_kick':
    case 'blitz_event': {
      const n = evento === 'high_kick' ? 1 : tirarD3({ azar, motivo: evento }).valor + 3;
      estado.pendiente = { tipo: evento, equipo: evento === 'solid_defence' || evento === 'blitz_event' ? estado.kicker : receptor(estado), restantes: n };
      anotar(estado, evento, { jugadores: n });
      return;
    }
    default:
      throw new Error(`Evento desconocido: ${evento}`);
  }
}

/** Mueve un jugador durante un evento pendiente (Anticipación: 1 casilla; Defensa sólida: recolocar). */
export function moverEnEvento(estado, jugadorId, x, y) {
  const p = estado.pendiente;
  if (!p) throw new Error('No hay evento pendiente.');
  const j = jugador(estado, jugadorId);
  if (j.equipo !== p.equipo) throw new Error(`${j.id} no es del equipo del evento.`);
  if (!tieneZonaDefensa(j) || marcadoresDe(estado, j.equipo, j.x, j.y).length) {
    throw new Error('Solo jugadores desmarcados.');
  }
  if (p.restantes <= 0) throw new Error('Ya no quedan movimientos del evento.');
  if (enCasilla(estado, x, y) || !enCampo(x, y)) throw new Error('Casilla no disponible.');

  if (p.tipo === 'quick_snap') {
    if (Math.max(Math.abs(x - j.x), Math.abs(y - j.y)) !== 1) throw new Error('Anticipación: una casilla.');
  } else if (p.tipo === 'solid_defence') {
    if (!enMitadPropia(j.equipo, y)) throw new Error('Defensa sólida: en su propia mitad.');
  } else if (p.tipo === 'high_kick') {
    const b = estado.patadaEnElAire;
    if (!b || x !== b.x || y !== b.y) throw new Error('Patada alta: solo a la casilla donde caerá el balón.');
  } else {
    throw new Error(`El evento ${p.tipo} no se resuelve moviendo (usa las activaciones).`);
  }
  j.x = x; j.y = y;
  p.restantes--;
  anotar(estado, 'mueve_en_evento', { jugador: j.id, a: [x, y], evento: p.tipo });
}

/** Da por terminado el evento pendiente y deja caer el balón. */
export function terminarEvento(estado, { azar }) {
  if (!estado.pendiente) throw new Error('No hay evento pendiente.');
  if (estado.pendiente.tipo === 'solid_defence') {
    const p = validarDespliegue(estado, estado.pendiente.equipo);
    if (p.length) throw new Error(p.join(' '));
  }
  estado.pendiente = null;
  caidaDelBalon(estado, { azar });
}

/**
 * 4. El balón cae. Si sale del campo o acaba en la mitad del pateador: Recepción libre.
 * Si cae en un jugador, intenta atraparlo; si no, rebota.
 */
export function caidaDelBalon(estado, { azar }) {
  const { x, y } = estado.patadaEnElAire;
  estado.patadaEnElAire = null;

  const haciaReceptor = !enMitadPropia(estado.kicker, y);
  if (!enCampo(x, y) || !haciaReceptor) {
    estado.recepcionLibre = true;
    estado.fase = 'recepcion_libre';
    anotar(estado, 'recepcion_libre', { porque: !enCampo(x, y) ? 'el balón salió del campo' : 'cruzó a la mitad del pateador' });
    return;
  }
  const j = enCasilla(estado, x, y);
  if (j && j.equipo === receptor(estado)) {
    const r = intentarAtrapar(estado, j, { azar });
    if (!r.exito) rebotar(estado, x, y, { azar });
  } else if (j) {
    rebotar(estado, x, y, { azar }); // un jugador del pateador no puede atraparla: rebota
  } else {
    estado.balon = { x, y };
    rebotar(estado, x, y, { azar });
  }
  empezarPrimerTurno(estado);
}

/** Recepción libre: el receptor da el balón a cualquier jugador suyo de pie. */
export function recepcionLibre(estado, jugadorId) {
  if (estado.fase !== 'recepcion_libre') throw new Error(`Fase: ${estado.fase}`);
  const j = jugador(estado, jugadorId);
  if (j.equipo !== receptor(estado) || j.situacion !== 'campo' || j.postura !== 'de_pie') {
    throw new Error('El balón se entrega a un jugador propio de pie.');
  }
  estado.balon = { portador: j.id };
  estado.recepcionLibre = false;
  anotar(estado, 'recepcion_libre_entrega', { jugador: j.id });
  empezarPrimerTurno(estado);
}

function empezarPrimerTurno(estado) {
  estado.fase = 'turno';
  estado.activo = receptor(estado);
  empezarTurno(estado);
}

export function empezarTurno(estado) {
  const E = estado.equipos[estado.activo];
  E.turno++;
  estado.usadas = {};
  estado.turnover = null;
  estado.activacion = null;
  for (const j of Object.values(estado.jugadores)) {
    if (j.equipo !== estado.activo) continue;
    j.activado = false;
    j.aturdidoAlEmpezarTurno = j.postura === 'aturdido';
  }
  anotar(estado, 'turno', { equipo: E.nombre, numero: E.turno, mitad: estado.mitad });
}

/**
 * Fin del turno (voluntario o por turnover). Los aturdidos que EMPEZARON así el turno
 * pasan a tumbados, y el turno pasa al rival (o la parte/el drive terminan).
 */
export function terminarTurno(estado, { azar }) {
  if (estado.fase !== 'turno') throw new Error(`Fase: ${estado.fase}`);
  estado.activacion = null;
  for (const j of Object.values(estado.jugadores)) {
    if (j.equipo === estado.activo && j.aturdidoAlEmpezarTurno && j.postura === 'aturdido') {
      j.postura = 'tumbado';
      anotar(estado, 'recupera_de_aturdido', { jugador: j.id });
    }
  }
  // El touchdown termina la entrada (finDeDrive lee quién anotó para elegir pateador).
  if (estado.touchdownPendiente !== undefined && estado.touchdownPendiente !== null) {
    return finDeDrive(estado, { azar });
  }

  if (estado.equipos[0].turno >= 8 && estado.equipos[1].turno >= 8) return finDeDrive(estado, { azar });

  // Alternancia, saltándose el turno de celebración si anotó en el turno rival.
  let siguiente = 1 - estado.activo;
  if (estado.equipos[siguiente].saltaTurno) {
    estado.equipos[siguiente].saltaTurno = false;
    anotar(estado, 'celebracion', { equipo: estado.equipos[siguiente].nombre });
    siguiente = estado.activo;
  }
  estado.activo = siguiente;
  empezarTurno(estado);
}

/**
 * Comprueba el touchdown: un jugador DE PIE con el balón en la zona de anotación rival.
 * Se llama después de cada acción. Anotar provoca el fin del turno (del bueno).
 */
export function comprobarTouchdown(estado) {
  const b = estado.balon;
  if (!b?.portador) return false;
  const j = jugador(estado, b.portador);
  if (j.situacion !== 'campo' || (j.postura !== 'de_pie' && j.postura !== 'distraido')) return false;
  if (j.y !== filaAnotacion(j.equipo)) return false;

  const E = estado.equipos[j.equipo];
  E.marcador++;
  estado.touchdownPendiente = j.equipo;
  anotar(estado, 'touchdown', { equipo: E.nombre, jugador: j.id, marcador: estado.equipos.map((x) => x.marcador) });

  // Si anota durante el turno rival, el anotador se salta su siguiente turno (celebración)
  // y el turno rival termina ya.
  if (j.equipo !== estado.activo) E.saltaTurno = true;
  estado.turnover = { causa: 'touchdown' };
  return true;
}

/** 5. Final de la entrada: recuperar KO (4+), calor asfixiante, efectos que expiran. */
export function finDeDrive(estado, { azar }) {
  // Efectos «hasta el final de la entrada».
  for (const ef of estado.efectosDrive ?? []) {
    const j = jugador(estado, ef.jugador);
    if (ef.mv) j.perfil.mv += ef.mv;
    if (ef.ar) j.perfil.ar += ef.ar;
  }
  estado.efectosDrive = [];
  for (const E of estado.equipos) {
    if (E.rerollExtraDrive) { E.rerolls = Math.max(0, E.rerolls - E.rerollExtraDrive); E.rerollExtraDrive = 0; }
    E.apoyoExtraProximoTurno = false;
  }

  // Calor asfixiante: D3 jugadores al azar de cada equipo que estaban en el campo, fuera.
  if (estado.clima === 'sweltering_heat') {
    for (let i = 0; i < 2; i++) {
      const n = tirarD3({ azar, motivo: 'calor asfixiante' }).valor;
      for (let k = 0; k < n; k++) {
        const v = jugadorAlAzar(estado, i, { azar });
        if (!v) break;
        v.situacion = 'reserva'; v.x = v.y = -1; v.fueraPorCalor = true;
        anotar(estado, 'calor', { jugador: v.id });
      }
    }
  }

  // Recuperar inconscientes: 1D6 por KO, con 4+ a Reservas.
  for (const j of Object.values(estado.jugadores)) {
    if (j.situacion !== 'ko') continue;
    const d = tirar(6, { azar, motivo: `recuperación de ${j.id}` });
    if (d.valor >= 4) { j.situacion = 'reserva'; }
    anotar(estado, 'recuperacion_ko', { jugador: j.id, d6: d.valor, vuelve: d.valor >= 4 });
  }

  // La ventana del apotecario es inmediata: al acabar la entrada, se cerró.
  for (const j of Object.values(estado.jugadores)) j.apoVentana = false;

  // Todos los del campo vuelven al banquillo; el siguiente drive se despliega de cero.
  const anoto = estado.touchdownPendiente;
  estado.touchdownPendiente = null;
  for (const j of Object.values(estado.jugadores)) {
    if (j.situacion === 'campo') { j.situacion = 'reserva'; j.x = j.y = -1; j.postura = 'de_pie'; }
  }
  estado.balon = null;
  estado.turnover = null;

  const finDeParte = estado.equipos[0].turno >= 8 && estado.equipos[1].turno >= 8;
  if (finDeParte && estado.mitad === 2) {
    estado.fase = 'fin';
    anotar(estado, 'final', { marcador: estado.equipos.map((E) => E.marcador) });
    return;
  }
  if (finDeParte) {
    estado.mitad = 2;
    for (const E of estado.equipos) { E.turno = 0; E.rerolls = E.rerollsMax; }
    for (const j of Object.values(estado.jugadores)) j.fueraPorCalor = false;
    estado.kicker = estado.recibioAlEmpezar;  // patea quien recibió al empezar el partido
    anotar(estado, 'descanso', {});
  } else if (anoto !== null && anoto !== undefined) {
    estado.kicker = anoto;                    // patea el que anotó
  }
  estado.fase = 'despliegue_kicker';
}

function jugadorAlAzar(estado, equipo, { azar, dePie = false }) {
  const candidatos = Object.values(estado.jugadores).filter((j) =>
    j.equipo === equipo && j.situacion === 'campo' && (!dePie || j.postura === 'de_pie'));
  if (!candidatos.length) return null;
  // D16 contra la lista; se repite hasta acertar (acotado por seguridad).
  for (let i = 0; i < 100; i++) {
    const d = tirar(16, { azar, motivo: 'jugador al azar' });
    const j = candidatos.find((c) => c.dorsal === d.valor);
    if (j) return j;
  }
  return candidatos[0];
}
