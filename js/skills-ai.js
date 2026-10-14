// "Elegir skills por mí" con IA: un modelo rápido lee tu pedido y escoge las habilidades que mejor encajan.
// Es opcional (cada uso gasta una consulta gratis); la versión simple por palabras clave no gasta nada.

import * as store from './store.js';
import { generateJSON } from './gemini.js';
import { groqJSON, groqModelFor } from './groq.js';
import { groqReady } from './brain.js';
import { skillsFor, isEnabled } from './skills.js';

export async function suggestSkillsAI(agentId, text, signal) {
  const s = store.settings();
  const list = skillsFor(agentId).filter((x) => !x.core && isEnabled(x.id));
  const catalog = list.map((x) => `- ${x.id}: ${x.name} — ${x.desc}`).join('\n');
  const prompt = `Eres el asistente que elige habilidades de marketing para un agente de una agencia de turismo nacional en Venezuela (Instagram, TikTok y WhatsApp).
Pedido del usuario:
"""${text.slice(0, 1200)}"""

Habilidades disponibles:
${catalog}

Elige de 1 a 4 habilidades que realmente ayuden a cumplir ese pedido (no elijas por elegir). Responde solo JSON: {"ids":["..."],"motivo":"una frase corta y simple en español explicando la elección"}`;
  let out;
  if (groqReady() && s.lightGroq !== false) {
    out = await groqJSON({ apiKey: s.groqKey, kind: 'fast', model: groqModelFor('fast'), prompt, signal });
  } else {
    if (!s.geminiKey) throw new Error('Falta una API key (Gemini o Groq) en Configuración → Claves.');
    out = await generateJSON({
      apiKey: s.geminiKey,
      model: s.fastModel || s.model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      schema: { type: 'OBJECT', properties: { ids: { type: 'ARRAY', items: { type: 'STRING' } }, motivo: { type: 'STRING' } }, required: ['ids', 'motivo'] },
      signal,
    });
  }
  const valid = new Set(list.map((x) => x.id));
  const ids = (out.ids || []).filter((id) => valid.has(id)).slice(0, 4);
  if (!ids.length) throw new Error('La IA no encontró skills claras para ese pedido.');
  return { ids, motivo: String(out.motivo || '').slice(0, 240) };
}
