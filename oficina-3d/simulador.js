// Simulador de estados (herramienta de PRUEBA, no es una función de la app). Reproduce, con la fuente de
// fuente-estados.js, las mismas transiciones y en el mismo orden que el código real:
//
//   responder()  ← sendToAgent() de js/conversation.js + runAgent() de js/brain.js
//       mensaje del usuario y respuesta pendiente (chat 'append') → setStatus 'thinking'
//       → [si busca: onStatus 'searching' y luego 'thinking' otra vez (cada paso del modelo empieza en 'thinking')]
//       → el texto llega en trozos (chat 'update')
//       → final: respuesta no pendiente; si hubo error, texto vacío o se detuvo, el mensaje queda con error
//         ('Detuviste la respuesta.' solo si no había texto) → setStatus idleStatus() → chat 'done'
//       idleStatus(): 'meeting' si el agente está en la sala; si no, 'idle'.
//   reunion()    ← runSession() de js/meeting.js
//       meetingBusy = true → cada participante: setStatus 'meeting' (o su estado si está ocupado) y moveAgent 'meeting'
//       → [investigación: el analista (o el primero) 'searching' → al terminar 'meeting']
//       → espera que todos lleguen → [plan: moderador (guion o el primero) 'talking' → 'meeting']
//         o turnos en ORDER (analista, guion, copy): 'talking' con texto → 'meeting'
//       → meetingBusy = false. Si se cancela, el turno en curso vuelve a 'meeting' y la reunión queda en pausa.
//   terminarReunion() ← endMeeting(): cada agente en la sala vuelve con moveAgent 'office' y, al llegar,
//       setStatus 'idle' (o su estado si está ocupado).
//
// Qué NO puede verificar hasta la fase 6: los tiempos reales de la IA (aquí son fijos), los textos reales, los
// errores reales de red o de cuota, la interacción simultánea con el chat real, y que la app emita exactamente
// estos eventos en un navegador real (eso se comprobará conectando la fuente a js/state.js).
import { ORDEN_REUNION, duracionCaminata } from './plano.js';

const abortado = () => Object.assign(new Error('Detenido'), { name: 'AbortError' });
const espera = (ms, senal) =>
  new Promise((ok, mal) => {
    if (senal?.aborted) return mal(abortado());
    const t = setTimeout(ok, ms);
    senal?.addEventListener('abort', () => {
      clearTimeout(t);
      mal(abortado());
    });
  });

export function crearSimulador(fuente, { velocidad = 1 } = {}) {
  const { runtime, setStatus, emit } = fuente;
  const caminatas = {};
  const ms = (x) => x / sim.velocidad;
  let n = 0;
  const uid = () => `s${++n}`;

  // moveAgent(): cambia la ubicación AL EMPEZAR y resuelve al terminar la caminata (encolada por agente)
  function moveAgent(id, hacia) {
    caminatas[id] = (caminatas[id] || Promise.resolve()).then(async () => {
      if (runtime.location[id] === hacia) return;
      runtime.location[id] = hacia;
      await espera(duracionCaminata(id, hacia)); // las caminatas no se aceleran: duran lo mismo que en el SVG
    });
    return caminatas[id];
  }

  /**
   * Respuesta de un agente en su chat.
   * opciones: { buscar = false, texto = '...', pensar = 1200 ms, trozos = 6, final = 'ok' | 'error' | 'vacia' | 'detener',
   *             detenerEn = 'pensando' | 'escribiendo' }
   */
  async function responder(id, op = {}) {
    const { buscar = false, texto = 'Aquí tienes 3 variantes de copy para el reel.', pensar = 1200, trozos = 6, final = 'ok', detenerEn = 'escribiendo' } = op;
    if (runtime.aborters[id]) return 'ocupado';
    const list = fuente.chat(id);
    const reply = { id: uid(), role: 'model', text: '', pending: true };
    list.push({ id: uid(), role: 'user', text: 'pedido' }, reply);
    emit('chat', { agentId: id, type: 'append' });
    const ctrl = new AbortController();
    runtime.aborters[id] = ctrl;
    setStatus(id, 'thinking');
    const update = () => emit('chat', { agentId: id, type: 'update', id: reply.id });
    try {
      await espera(ms(pensar), ctrl.signal);
      if (buscar) {
        setStatus(id, 'searching');
        reply.status = '🔎 Buscando';
        update();
        await espera(ms(1800), ctrl.signal);
        setStatus(id, 'thinking');
        reply.status = '';
        update();
        await espera(ms(600), ctrl.signal);
      }
      if (final === 'detener' && detenerEn === 'pensando') ctrl.abort();
      if (final === 'error') throw new Error('Llegaste al límite gratis de Gemini por ahora.');
      if (final !== 'vacia') {
        for (let i = 1; i <= trozos; i++) {
          if (final === 'detener' && i === Math.ceil(trozos / 2)) ctrl.abort();
          await espera(ms(250), ctrl.signal);
          reply.text = texto.slice(0, Math.ceil((texto.length * i) / trozos));
          update();
        }
      }
      if (!reply.text.trim()) reply.error = 'No llegó respuesta. Intenta de nuevo.';
    } catch (e) {
      if (e.name === 'AbortError') {
        if (!reply.text) reply.error = 'Detuviste la respuesta.';
      } else reply.error = e.message || 'Algo falló.';
    } finally {
      reply.pending = false;
      delete reply.status;
      delete runtime.aborters[id];
      setStatus(id, runtime.location[id] === 'meeting' ? 'meeting' : 'idle');
      emit('chat', { agentId: id, type: 'done', id: reply.id });
    }
    return reply.error ? 'error' : 'ok';
  }

  /** Reunión. opciones: { participantes, investigar = false, plan = false, cancelarEnTurno = null } */
  async function reunion(op = {}) {
    const { participantes = ['analista', 'guion', 'copy'], investigar = false, plan = false, cancelarEnTurno = null } = op;
    if (runtime.meetingBusy) return 'ocupada';
    const partes = ORDEN_REUNION.filter((x) => participantes.includes(x));
    runtime.meetingBusy = true;
    const ctrl = new AbortController();
    runtime.aborters.meeting = ctrl;
    const signal = ctrl.signal;
    let resultado = 'ok';
    try {
      const llegada = Promise.all(
        partes.map((id) => {
          setStatus(id, runtime.aborters[id] ? runtime.status[id] : 'meeting');
          return moveAgent(id, 'meeting');
        })
      );
      if (investigar) {
        const quien = partes.includes('analista') ? 'analista' : partes[0];
        setStatus(quien, 'searching');
        try {
          await espera(ms(2500), signal);
        } finally {
          setStatus(quien, 'meeting');
        }
      }
      await llegada;
      if (plan) {
        const mod = partes.includes('guion') ? 'guion' : partes[0];
        setStatus(mod, 'talking');
        try {
          await espera(ms(3000), signal);
        } finally {
          setStatus(mod, 'meeting');
        }
      } else {
        for (const id of partes) {
          setStatus(id, 'talking');
          try {
            if (cancelarEnTurno === id) {
              setTimeout(() => ctrl.abort(), ms(600));
            }
            await espera(ms(2200), signal);
          } finally {
            setStatus(id, 'meeting');
          }
        }
      }
    } catch (e) {
      resultado = e.name === 'AbortError' ? 'pausa' : 'error';
    } finally {
      runtime.meetingBusy = false;
      delete runtime.aborters.meeting;
    }
    return resultado;
  }

  /** endMeeting(): todos los que están en la sala vuelven a su oficina; al llegar, 'idle' (si no están ocupados). */
  function terminarReunion() {
    runtime.aborters.meeting?.abort();
    const vueltas = [];
    for (const id of Object.keys(runtime.location)) {
      if (runtime.location[id] === 'meeting') vueltas.push(moveAgent(id, 'office').then(() => setStatus(id, runtime.aborters[id] ? runtime.status[id] : 'idle')));
    }
    return Promise.all(vueltas);
  }

  /** stopAgent(): aborta la respuesta en curso de un agente. */
  const detener = (id) => runtime.aborters[id]?.abort();

  const sim = { velocidad, responder, reunion, terminarReunion, detener, moveAgent };
  return sim;
}
