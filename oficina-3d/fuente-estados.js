// Fuente de estados de los agentes: la ÚNICA puerta de entrada de la escena 3D a los estados.
//
// Imita exactamente la forma en que la app expone sus estados (js/state.js y js/store.js):
//   runtime.status[id]    'idle' | 'thinking' | 'searching' | 'meeting' | 'talking'   (setStatus)
//   runtime.location[id]  'office' | 'meeting'   (lo cambia moveAgent() de js/office.js al EMPEZAR a caminar; sin evento)
//   runtime.meetingBusy   reunión en curso
//   on('status', {id, status})                 cada cambio de estado
//   on('chat', {agentId, type, id})            type: 'append' | 'update' (llega texto) | 'done'
//   chat(id)                                   mensajes del chat (el último dice si la respuesta salió bien)
//
// Fases 1–5: la alimenta el simulador (simulador.js). Fase 6 (con autorización aparte): la alimentará la app real
// con su propio runtime, on() y store.chat(); la escena 3D no cambia.
export function crearFuente() {
  const ids = ['copy', 'analista', 'guion'];
  const runtime = {
    status: Object.fromEntries(ids.map((id) => [id, 'idle'])),
    location: Object.fromEntries(ids.map((id) => [id, 'office'])),
    aborters: {},
    meetingBusy: false,
    activeMeetingId: null,
  };
  const chats = Object.fromEntries(ids.map((id) => [id, []]));
  const bus = new EventTarget();
  const emit = (nombre, detail) => bus.dispatchEvent(new CustomEvent(nombre, { detail }));
  const on = (nombre, fn) => {
    const h = (e) => fn(e.detail);
    bus.addEventListener(nombre, h);
    return () => bus.removeEventListener(nombre, h);
  };
  // copia de setStatus() de js/state.js
  const setStatus = (id, status) => {
    if (runtime.status[id] === status) return;
    runtime.status[id] = status;
    emit('status', { id, status });
  };
  return { runtime, on, emit, setStatus, chat: (id) => chats[id], origen: 'simulador' };
}
