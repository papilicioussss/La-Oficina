// Estado en memoria (no se guarda) + bus de eventos para que las vistas se enteren de cambios.

import { AGENT_IDS } from './store.js';

const bus = new EventTarget();

export function emit(name, detail) {
  bus.dispatchEvent(new CustomEvent(name, { detail }));
}

/** Se suscribe a un evento; devuelve la función para desuscribirse. */
export function on(name, fn) {
  const handler = (e) => fn(e.detail);
  bus.addEventListener(name, handler);
  return () => bus.removeEventListener(name, handler);
}

export const runtime = {
  // idle | thinking | searching | meeting | talking
  status: Object.fromEntries(AGENT_IDS.map((id) => [id, 'idle'])),
  // office | meeting
  location: Object.fromEntries(AGENT_IDS.map((id) => [id, 'office'])),
  aborters: {}, // AbortController por agente / reunión
  drafts: {}, // borradores del cuadro de texto por agente
  forcedSkills: {}, // skills elegidas a mano para el próximo mensaje de cada agente
  meetingDraft: null, // tema precargado para la sala de juntas
  activeMeetingId: null,
  meetingBusy: false,
  tavilyBlocked: false,
  groqBlocked: false,
  groqWarned: false,
  catStatus: 'idle', // idle | thinking | talking
};

export function setStatus(id, status) {
  if (runtime.status[id] === status) return;
  runtime.status[id] = status;
  emit('status', { id, status });
}

export function go(hash) {
  if (location.hash === hash) emit('route');
  else location.hash = hash;
}

export const STATUS_LABEL = {
  idle: '',
  thinking: 'Pensando…',
  searching: 'Buscando en la web…',
  meeting: 'En reunión',
  talking: 'Hablando…',
};
