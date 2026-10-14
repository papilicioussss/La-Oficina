// Cliente mínimo para Groq (API compatible con OpenAI), llamado directo desde el navegador.

const BASE = 'https://api.groq.com/openai/v1';

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
  let res;
  try {
    res = await fetch(BASE + path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` } });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new GroqError('No pude conectar con Groq desde el navegador (sin internet o bloqueo del navegador).', 0);
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
export async function groqChat({ apiKey, model, system, messages, signal, onText, maxTokens = 4096 }) {
  const res = await request('/chat/completions', apiKey, {
    method: 'POST',
    body: JSON.stringify({ model, messages: buildMessages(system, messages), stream: true, max_tokens: maxTokens }),
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
export async function groqJSON({ apiKey, model, system, prompt, signal }) {
  const res = await request('/chat/completions', apiKey, {
    method: 'POST',
    body: JSON.stringify({
      model,
      messages: buildMessages(system, [{ role: 'user', content: prompt }]),
      response_format: { type: 'json_object' },
      max_tokens: 1024,
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
