// Conversaciones con cada agente: enviar, detener, reintentar y limpiar.

import * as store from './store.js';
import { AGENT_IDS } from './store.js';
import { runtime, setStatus, emit } from './state.js';
import { runAgent, SetupError } from './brain.js';
import { agentName } from './prompts.js';
import { toast, uid } from './ui.js';

const MAX_STORED = 80;

/** Al abrir la app: respuestas que quedaron a medias pasan a error. */
export function recoverChats() {
  for (const id of AGENT_IDS) {
    let changed = false;
    for (const m of store.chat(id)) {
      if (m.pending) {
        m.pending = false;
        delete m.status;
        if (!m.text) m.error = 'Se interrumpió (se recargó la página). Intenta de nuevo.';
        changed = true;
      }
    }
    if (changed) store.save('chat:' + id);
  }
}

const idleStatus = (id) => (runtime.location[id] === 'meeting' ? 'meeting' : 'idle');

export function isBusy(agentId) {
  return !!runtime.aborters[agentId];
}

export async function sendToAgent(agentId, text, images = [], opts = {}) {
  if (isBusy(agentId)) {
    toast(`${agentName(agentId)} todavía está respondiendo. Espera o detén la respuesta.`, 'warn');
    return;
  }
  const list = store.chat(agentId);
  const history = list.slice();
  const reply = { id: uid(), role: 'model', text: '', pending: true, ts: Date.now(), sources: [] };
  list.push({ id: uid(), role: 'user', text, images: images.length, ts: Date.now() }, reply);
  if (list.length > MAX_STORED) list.splice(0, list.length - MAX_STORED);
  store.save('chat:' + agentId);
  emit('chat', { agentId, type: 'append' });

  const ctrl = new AbortController();
  runtime.aborters[agentId] = ctrl;
  setStatus(agentId, 'thinking');
  const update = () => emit('chat', { agentId, type: 'update', id: reply.id });
  try {
    const res = await runAgent({
      agentId,
      history,
      text,
      images,
      forcedSkills: opts.skills || [],
      signal: ctrl.signal,
      onText: (t) => {
        reply.text = t;
        update();
      },
      onStatus: (status, query) => {
        setStatus(agentId, status);
        reply.status = status === 'searching' ? `🔎 Buscando: “${query}”` : '';
        update();
      },
    });
    reply.text = res.text;
    reply.sources = res.sources;
    if (res.via) reply.via = res.via;
    reply.skills = res.skills || [];
    if (!reply.text.trim()) reply.error = 'No llegó respuesta. Intenta de nuevo.';
  } catch (e) {
    if (e.name === 'AbortError') {
      if (!reply.text) reply.error = 'Detuviste la respuesta.';
    } else {
      reply.error = e.message || 'Algo falló.';
      if (e instanceof SetupError) reply.setup = true;
    }
  } finally {
    reply.pending = false;
    delete reply.status;
    delete runtime.aborters[agentId];
    setStatus(agentId, idleStatus(agentId));
    store.save('chat:' + agentId);
    emit('chat', { agentId, type: 'done', id: reply.id });
  }
}

export function stopAgent(agentId) {
  runtime.aborters[agentId]?.abort();
}

/** Reintenta el mensaje del usuario que originó una respuesta con error. */
export function retry(agentId, replyId) {
  const list = store.chat(agentId);
  const idx = list.findIndex((m) => m.id === replyId);
  if (idx < 1 || list[idx - 1].role !== 'user') return;
  const userMsg = list[idx - 1];
  if (userMsg.images) toast('Las imágenes no se guardan: si hacían falta, adjúntalas de nuevo.', 'info');
  list.splice(idx - 1, 2);
  store.save('chat:' + agentId);
  sendToAgent(agentId, userMsg.text);
}

export function clearChat(agentId) {
  stopAgent(agentId);
  store.set('chat:' + agentId, []);
  emit('chat', { agentId, type: 'append' });
}
