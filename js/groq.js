// Cliente mínimo para Groq (API compatible con OpenAI), llamado directo desde el navegador.

import * as store from './store.js';

const BASE = 'https://api.groq.com/openai/v1';

const MAIN_PREF = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'qwen/qwen3-32b'];
const FAST_PREF = ['llama-3.1-8b-instant', 'openai/gpt-oss-20b'];

/** Elige solo los mejores modelos de la lista que Groq le da a esta key. */
export function autoPick(list) {
  const ids = (list || []).map((m) => m.id);
  if (!ids.length) return { main: MAIN_PREF[0], fast: FAST_PREF[0] };
  const bad = (id) => /allam/i.test(id);
  const main =
    MAIN_PREF.find((id) => ids.includes(id)) ||
    ids.find((id) => !bad(id) && /(70b|120b)/i.test(id)) ||
    ids.find((id) => !bad(id) && !/8b/i.test(id)) ||
    ids[0];
  const fast = FAST_PREF.find((id) => ids.includes(id)) || ids.find((id) => /(8b|20b)/i.test(id) && !bad(id)) || main;
  return { main, fast };
}

/** Modelo a usar: automático (recomendado) o el que Kike haya fijado a mano. */
export function groqModelFor(kind) {
  const s = store.settings();
  if (s.groqAuto === false) return (kind === 'fast' ? s.groqFastModel || s.groqModel : s.groqModel) || autoPick(s.groqKnownModels)[kind === 'fast' ? 'fast' : 'main'];
  return autoPick(s.groqKnownModels)[kind === 'fast' ? 'fast' : 'main'];
}

/** Si Groq dice que el modelo ya no existe, vuelve a leer su lista y reintenta con el nuevo mejor. */
async function withAutoModel(kind, model, run) {
  try {
    return await run(model);
  } catch (e) {
    const s = store.settings();
    if (!(e instanceof GroqError) || e.status !== 404 || s.groqAuto === false) throw e;
    const list = await listGroqModels(s.groqKey);
    s.groqKnownModels = list;
    store.save('settings');
    const next = groqModelFor(kind);
    if (next === model) throw e;
    return run(next);
  }
}

export class GroqError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'GroqError';
    this.status = status;
  }
}

function friendlyError(status, body) {
  const msg = body?.error?.message || '';
  if (status === 401) return 'Tu API key de Groq no es válida. Revísala en Configuración → Claves.';
  if (status === 404 || /model/i.test(msg)) return 'Ese modelo de Groq no existe o fue retirado. Elige otro en Configuración → Claves.';
  if (status === 413) return 'El mensaje es demasiado largo para Groq.';
  if (status === 429) return 'Llegaste al límite gratis de Groq por ahora.';
  if (status >= 500) return 'Groq está congestionado. Intenta de nuevo en unos segundos.';
  return msg || `Error ${status} de Groq.`;
}

async function request(path, apiKey, init) {
  // Una key con espacios, comillas o "…" hace que el navegador rechace la petición antes de enviarla.
  if (!/^[\x21-\x7e]+$/.test(apiKey || '')) {
    throw new GroqError('Tu API key de Groq tiene caracteres raros (espacios, comillas o puntos suspensivos). Cópiala de nuevo desde console.groq.com/keys, sin nada más.', 401);
  }
  let res;
  try {
    res = await fetch(BASE + path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` } });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    // ¿La página llega a Groq sin la key? Así se distingue "red bloqueada" de "petición con key bloqueada".
    const reachable = await fetch(BASE + '/models').then(() => true, () => false);
    throw new GroqError(
      reachable
        ? `Groq sí responde desde tu navegador, pero esta petición con tu key no llegó. Revisa que la key esté completa, sin espacios ni comillas (vuelve a copiarla de console.groq.com/keys). Si sigue igual, prueba en una ventana de incógnito o desactiva las extensiones de privacidad para esta página. (Detalle: ${e.message || 'error de red'})`
        : `Esta página no puede llegar a Groq. Suele ser un bloqueador de anuncios o extensión de privacidad, una VPN o red que bloquea Groq. Prueba en una ventana de incógnito o desactiva las extensiones para esta página. (Detalle: ${e.message || 'error de red'})`,
      0
    );
  }
  if (!res.ok) {
    let j = null;
    try {
      j = await res.json();
    } catch {
      /* sin cuerpo */
    }
    throw new GroqError(friendlyError(res.status, j), res.status);
  }
  return res;
}

function buildMessages(system, messages) {
  return [...(system ? [{ role: 'system', content: system }] : []), ...messages];
}

/** Respuesta en streaming. messages: [{role:'user'|'assistant', content}] */
const extra = (model) => (/gpt-oss/i.test(model) ? { reasoning_effort: 'low' } : {});

export function groqChat({ kind = 'main', model, ...rest }) {
  return withAutoModel(kind, model, (m) => groqChatOnce({ ...rest, model: m }));
}

async function groqChatOnce({ apiKey, model, system, messages, signal, onText, maxTokens = 4096 }) {
  const res = await request('/chat/completions', apiKey, {
    method: 'POST',
    body: JSON.stringify({ model, messages: buildMessages(system, messages), stream: true, max_tokens: maxTokens, ...extra(model) }),
    signal,
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let text = '';
  const flush = () => {
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const delta = JSON.parse(data).choices?.[0]?.delta?.content;
        if (delta) {
          text += delta;
          onText?.(text);
        }
      } catch {
        /* fragmento incompleto */
      }
    }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    flush();
  }
  buf += decoder.decode() + '\n';
  flush();
  if (!text.trim()) throw new GroqError('Groq no devolvió respuesta.', 0);
  return text;
}

/** Respuesta en JSON (sin streaming). */
export function groqJSON({ kind = 'fast', model, ...rest }) {
  return withAutoModel(kind, model, (m) => groqJSONOnce({ ...rest, model: m }));
}

async function groqJSONOnce({ apiKey, model, system, prompt, signal }) {
  const res = await request('/chat/completions', apiKey, {
    method: 'POST',
    body: JSON.stringify({
      model,
      messages: buildMessages(system, [{ role: 'user', content: prompt }]),
      response_format: { type: 'json_object' },
      max_tokens: 1024,
      ...extra(model),
    }),
    signal,
  });
  const j = await res.json();
  try {
    return JSON.parse(j.choices?.[0]?.message?.content || '');
  } catch {
    throw new GroqError('Groq no devolvió un JSON válido.', 0);
  }
}

/** Lista los modelos de texto disponibles (sirve para probar la key). */
export async function listGroqModels(apiKey) {
  const res = await request('/models', apiKey, { method: 'GET' });
  const j = await res.json();
  return (j.data || [])
    .filter((m) => m.active !== false && !/(whisper|tts|guard|playai|orpheus|distil)/i.test(m.id))
    .map((m) => ({ id: m.id, label: m.id }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
