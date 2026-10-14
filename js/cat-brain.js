// Cerebro del gato: conversa con Kike y guarda/corrige/borra datos en la memoria de la marca.

import * as store from './store.js';
import { generate, ApiError } from './gemini.js';
import { groqChat, groqJSON } from './groq.js';
import { buildCatPrompt, CAT_TOOLS, bossName } from './prompts.js';
import { addFact, removeFact, updateFact, restoreFact, facts, MEM_CATS } from './memory.js';
import { groqReady, noteGroqFailure, SetupError } from './brain.js';

const geminiDown = (e) => e instanceof ApiError && (e.status === 429 || e.status >= 500 || e.status === 0);

function toContents(history, text, images) {
  const contents = history
    .filter((m) => m.text && !m.pending && !m.error)
    .slice(-20)
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
  contents.push({
    role: 'user',
    parts: [{ text: text || 'Mira la imagen que te mando.' }, ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } }))],
  });
  return contents;
}

/** Ejecuta una llamada de herramienta del gato y devuelve { response, saved }. */
function runTool(fc) {
  const args = fc.args || {};
  if (fc.name === 'guardar_memoria') {
    const fact = addFact({ cat: args.categoria, text: args.dato, replaces: args.reemplaza_id });
    if (!fact) return { response: { ok: true, nota: 'Ese dato ya estaba guardado.' }, saved: null };
    return {
      response: { ok: true, id: fact.id },
      saved: { op: fact.replaced ? 'update' : 'add', id: fact.id, cat: fact.cat, text: fact.text, prev: fact.replaced || null },
    };
  }
  if (fc.name === 'olvidar_memoria') {
    const gone = removeFact(args.id);
    if (!gone) return { response: { ok: false, error: 'No encontré ese id.' }, saved: null };
    return { response: { ok: true }, saved: { op: 'remove', id: gone.id, cat: gone.cat, text: gone.text, prev: gone } };
  }
  return { response: { ok: false, error: 'Herramienta desconocida.' }, saved: null };
}

/**
 * Un turno de conversación. Devuelve { text, saved, via }.
 * `saved` son los cambios hechos a la memoria en este turno (para mostrarlos y poder deshacerlos).
 */
export async function runCat({ history, text, images = [], onText, onStatus, signal }) {
  const s = store.settings();
  if (!s.geminiKey && !groqReady()) {
    throw new SetupError('Falta tu API key de Google AI Studio (o de Groq). Ve a Configuración → Claves.');
  }
  const saved = [];

  const viaGemini = async () => {
    const system = buildCatPrompt();
    const convo = toContents(history, text, images);
    let prefix = '';
    for (let step = 0; step < 4; step++) {
      onStatus?.('thinking');
      const res = await generate({
        apiKey: s.geminiKey,
        model: s.model,
        system,
        contents: convo,
        tools: [{ functionDeclarations: CAT_TOOLS }],
        toolConfig: step === 3 ? { functionCallingConfig: { mode: 'NONE' } } : undefined,
        generationConfig: { temperature: 1 },
        signal,
        onText: (t) => onText?.(prefix + t),
      });
      if (!res.functionCalls.length || step === 3) return { text: prefix + res.text, saved, via: 'gemini' };
      if (res.text.trim()) prefix += res.text.trim() + '\n\n';
      convo.push({ role: 'model', parts: res.parts });
      const responses = [];
      for (const fc of res.functionCalls) {
        const r = runTool(fc);
        if (r.saved) saved.push(r.saved);
        responses.push({ functionResponse: { name: fc.name, ...(fc.id ? { id: fc.id } : {}), response: r.response } });
      }
      convo.push({ role: 'user', parts: responses });
    }
    return { text: '', saved, via: 'gemini' };
  };

  // Respaldo con Groq: conversa y, aparte, extrae los datos del mensaje para guardarlos.
  const viaGroq = async () => {
    onStatus?.('thinking');
    const reply = await groqChat({
      apiKey: s.groqKey,
      model: s.groqModel,
      system: buildCatPrompt() + '\n\n(En este momento no tienes herramientas: conversa normal; los datos que te den se guardan solos.)',
      messages: toContents(history, text, []).map((c) => ({ role: c.role === 'model' ? 'assistant' : 'user', content: c.parts.map((p) => p.text || '').join('') })),
      signal,
      onText,
    });
    if (text.trim()) {
      try {
        const known = facts().map((f) => `[${f.id}] (${f.cat}) ${f.text}`).join('\n') || '(vacía)';
        const j = await groqJSON({
          apiKey: s.groqKey,
          model: s.groqFastModel || s.groqModel,
          prompt: `${bossName()} le escribió esto a su gato asistente:\n"""${text}"""\n\nMemoria actual:\n${known}\n\nExtrae SOLO los datos nuevos o corregidos de la marca que aparezcan en ese mensaje (precios, destinos, tono, público, operación…). Cada dato: una frase clara y autosuficiente. Si corrige uno existente, pon su id en reemplaza_id. Si no hay datos nuevos, devuelve una lista vacía. Categorías válidas: ${MEM_CATS.map((c) => c.id).join(', ')}.\nResponde solo JSON: {"datos":[{"categoria":"...","dato":"...","reemplaza_id":""}]}`,
          signal,
        });
        for (const d of (j.datos || []).slice(0, 8)) {
          const fact = addFact({ cat: d.categoria, text: d.dato, replaces: d.reemplaza_id || undefined });
          if (fact) saved.push({ op: fact.replaced ? 'update' : 'add', id: fact.id, cat: fact.cat, text: fact.text, prev: fact.replaced || null });
        }
      } catch (e) {
        if (e.name === 'AbortError') throw e;
      }
    }
    return { text: reply, saved, via: 'groq' };
  };

  if (!s.geminiKey) return viaGroq();
  try {
    return await viaGemini();
  } catch (e) {
    if (e.name === 'AbortError' || !geminiDown(e) || !s.groqFallback || !groqReady() || images.length) throw e;
    onText?.('');
    try {
      return await viaGroq();
    } catch (g) {
      if (g.name === 'AbortError') throw g;
      // Si el respaldo también falla, se muestra el motivo real (el de Gemini) y se avisa aparte de Groq.
      noteGroqFailure(g);
      throw e;
    }
  }
}

/** Deshace un cambio hecho a la memoria. */
export function undoSaved(item) {
  if (item.op === 'add') removeFact(item.id);
  else if (item.op === 'update' && item.prev) updateFact(item.id, { text: item.prev.text, cat: item.prev.cat });
  else if (item.op === 'remove' && item.prev) restoreFact(item.prev);
}
