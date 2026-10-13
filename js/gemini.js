// Cliente mínimo para la API de Gemini (Google AI Studio), llamado directo desde el navegador.

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function friendlyError(status, body) {
  const msg = body?.error?.message || '';
  if (status === 400 && /api key|API_KEY/i.test(msg)) {
    return 'Tu API key de Google AI Studio no es válida. Revísala en Configuración → Claves.';
  }
  if (status === 400) return `Gemini rechazó la solicitud: ${msg || 'formato inválido'}.`;
  if (status === 401 || status === 403) {
    return 'Google rechazó la API key (permiso denegado). Verifica que esté activa en AI Studio.';
  }
  if (status === 404) {
    return 'Ese modelo no existe o no está disponible para tu key. Elige otro en Configuración → Claves.';
  }
  if (status === 429) {
    return 'Llegaste al límite gratis de Gemini por ahora. Espera un minuto (o hasta mañana si es el límite diario) y vuelve a intentar.';
  }
  if (status >= 500) return 'Los servidores de Gemini están congestionados. Intenta de nuevo en unos segundos.';
  return msg || `Error ${status} de Gemini.`;
}

async function post(url, apiKey, body, signal) {
  let res;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      throw new ApiError('No hay conexión con Gemini. Revisa tu internet.', 0);
    }
    if ((res.status === 503 || res.status === 500) && attempt === 0) {
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    break;
  }
  if (!res.ok) {
    let j = null;
    try {
      j = await res.json();
    } catch {
      /* sin cuerpo */
    }
    throw new ApiError(friendlyError(res.status, j), res.status);
  }
  return res;
}

function buildBody({ system, contents, tools, toolConfig, generationConfig }) {
  const body = { contents };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (tools?.length) body.tools = tools;
  if (toolConfig) body.toolConfig = toolConfig;
  if (generationConfig) body.generationConfig = generationConfig;
  return body;
}

/**
 * Genera una respuesta en streaming.
 * Devuelve { text, parts, functionCalls, grounding, finishReason }.
 * `parts` conserva las partes tal cual llegan (incluidas las firmas de pensamiento),
 * necesario para devolverlas en los turnos de llamada a funciones.
 */
export async function generate({ apiKey, model, system, contents, tools, toolConfig, generationConfig, signal, onText }) {
  const url = `${BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
  const res = await post(url, apiKey, buildBody({ system, contents, tools, toolConfig, generationConfig }), signal);

  const parts = [];
  let text = '';
  let grounding = null;
  let finishReason = null;
  let blockReason = null;
  let lastText = null;

  const handle = (chunk) => {
    if (chunk.promptFeedback?.blockReason) blockReason = chunk.promptFeedback.blockReason;
    const c = chunk.candidates?.[0];
    if (!c) return;
    if (c.finishReason) finishReason = c.finishReason;
    if (c.groundingMetadata) grounding = c.groundingMetadata;
    for (const p of c.content?.parts || []) {
      if (typeof p.text === 'string' && !p.functionCall && !p.thought) {
        if (lastText) {
          lastText.text += p.text;
          if (p.thoughtSignature) lastText.thoughtSignature = p.thoughtSignature;
        } else {
          lastText = { ...p };
          parts.push(lastText);
        }
        text += p.text;
        onText?.(text);
      } else {
        parts.push(p);
        lastText = null;
      }
    }
  };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  const flushLines = () => {
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        handle(JSON.parse(data));
      } catch {
        /* fragmento incompleto */
      }
    }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    flushLines();
  }
  buf += decoder.decode();
  buf += '\n';
  flushLines();

  const functionCalls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);
  if (!text && !functionCalls.length) {
    if (blockReason || finishReason === 'SAFETY' || finishReason === 'PROHIBITED_CONTENT') {
      throw new ApiError('Gemini bloqueó la respuesta por sus filtros de seguridad. Reformula la petición.', 400);
    }
    if (finishReason === 'MAX_TOKENS') {
      throw new ApiError('La respuesta se cortó por largo. Pide algo más puntual.', 400);
    }
  }
  return { text, parts, functionCalls, grounding, finishReason };
}

/** Respuesta estructurada en JSON (sin streaming). */
export async function generateJSON({ apiKey, model, system, contents, schema, signal }) {
  const url = `${BASE}/models/${encodeURIComponent(model)}:generateContent`;
  const res = await post(
    url,
    apiKey,
    buildBody({
      system,
      contents,
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
    }),
    signal
  );
  const j = await res.json();
  const raw = (j.candidates?.[0]?.content?.parts || [])
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('');
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError('Gemini no devolvió un JSON válido. Intenta de nuevo.', 0);
  }
}

/** Lista los modelos de Gemini disponibles para la key (sirve también para probarla). */
export async function listModels(apiKey) {
  let res;
  try {
    res = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey } });
  } catch {
    throw new ApiError('No hay conexión con Gemini. Revisa tu internet.', 0);
  }
  if (!res.ok) {
    let j = null;
    try {
      j = await res.json();
    } catch {
      /* sin cuerpo */
    }
    throw new ApiError(friendlyError(res.status, j), res.status);
  }
  const j = await res.json();
  return (j.models || [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent') && /gemini/i.test(m.name))
    .filter((m) => !/(tts|image|embedding|audio|live|robotics|computer-use)/i.test(m.name))
    .map((m) => ({ id: m.name.replace(/^models\//, ''), label: m.displayName || m.name }));
}
