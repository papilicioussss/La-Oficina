// "Cerebro" de los agentes: arma las llamadas a Gemini, la búsqueda web y las reuniones.

import * as store from './store.js';
import { generate, generateJSON, ApiError } from './gemini.js';
import { groqChat, groqJSON, GroqError, groqModelFor } from './groq.js';
import { tavilySearch, toTimeRange, SearchUnavailable, SearchError } from './search.js';
import { buildSystemPrompt, buildLightPrompt, SEARCH_TOOL, ROLES, agentName, bossName, today } from './prompts.js';
import { classify, modelFor, trimHistory } from './router.js';
import { runtime } from './state.js';
import { pickSkills, skillNames } from './skills.js';
import { toast } from './ui.js';

export class SetupError extends Error {}

function requireKey() {
  const s = store.settings();
  if (!s.geminiKey) throw new SetupError('Falta tu API key de Google AI Studio. Ve a Configuración → Claves para agregarla.');
  return s;
}

/** Qué buscador usar ahora mismo: 'tavily', 'google' o null. */
export function searchProvider() {
  const s = store.settings();
  if (!s.webSearch) return null;
  if (s.searchProvider === 'tavily' && (s.tavilyKey || s.tavilyProxy) && !runtime.tavilyBlocked) return 'tavily';
  return 'google';
}

// ---------------- Groq ----------------

/** Groq está configurado y no ha fallado por bloqueo del navegador en esta sesión. */
export function groqReady() {
  const s = store.settings();
  return !!s.groqKey && !runtime.groqBlocked;
}

/** Errores de Gemini que justifican pasarse a Groq: límite, saturación o sin conexión. */
function geminiDown(e) {
  return e instanceof ApiError && (e.status === 429 || e.status >= 500 || e.status === 0);
}

export function noteGroqFailure(e) {
  if (e instanceof GroqError && e.status === 0) runtime.groqBlocked = true;
  if (!runtime.groqWarned) {
    runtime.groqWarned = true;
    toast(`Groq falló (${e.message}). Sigo con Gemini.`, 'warn', 7000);
  }
}

function addSource(list, src) {
  if (!src?.url || list.some((x) => x.url === src.url)) return;
  list.push({ title: src.title || src.url, url: src.url });
}

function groundingSources(grounding, list) {
  for (const c of grounding?.groundingChunks || []) {
    if (c.web?.uri) addSource(list, { title: c.web.title || c.web.domain || c.web.uri, url: c.web.uri });
  }
}

function toolsFor(provider) {
  if (provider === 'tavily') return [{ functionDeclarations: [SEARCH_TOOL] }];
  if (provider === 'google') return [{ google_search: {} }];
  return undefined;
}

async function doTavily({ consulta, periodo, soloOficiales, signal, maxResults = 4 }) {
  const s = store.settings();
  return tavilySearch({
    key: s.tavilyKey,
    proxy: s.tavilyProxy,
    query: consulta,
    timeRange: toTimeRange(periodo),
    domains: soloOficiales ? s.sources : undefined,
    maxResults,
    signal,
  });
}

function blockTavily(e) {
  runtime.tavilyBlocked = true;
  toast(`${e.message} Uso la búsqueda de Google (Gemini) mientras tanto. Ver README → "Proxy de Tavily".`, 'warn', 9000);
}

/**
 * Respuesta rápida y barata para mensajes simples (sin herramientas ni skills).
 * Orden: Groq rápido (si está disponible) → Gemini rápido → Gemini principal.
 * Devuelve { text, via, model }.
 */
export async function lightGenerate({ system, history, text, signal, onText, onStatus }) {
  const s = store.settings();
  onStatus?.('thinking');
  const messages = [...history.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })), { role: 'user', content: text }];
  const first = modelFor('light', { groqOk: groqReady() });
  if (first.provider === 'groq') {
    try {
      const out = await groqChat({ kind: 'fast', apiKey: s.groqKey, model: first.model, system, messages, signal, onText, maxTokens: 400 });
      return { text: out, via: 'groq', model: first.model };
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      noteGroqFailure(e);
      onText?.('');
    }
  }
  requireKey();
  const contents = messages.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
  const lite = s.fastModel || s.model;
  try {
    const r = await generate({ apiKey: s.geminiKey, model: lite, system, contents, signal, onText });
    return { text: r.text, via: 'gemini', model: lite };
  } catch (e) {
    // Si el modelo rápido no existe o no responde, se usa el principal.
    if (e.name === 'AbortError' || lite === s.model || !(e instanceof ApiError) || ![400, 404, 429, 500, 503].includes(e.status)) throw e;
    onText?.('');
    const r = await generate({ apiKey: s.geminiKey, model: s.model, system, contents, signal, onText });
    return { text: r.text, via: 'gemini', model: s.model };
  }
}

/**
 * Conversación con un agente en su oficina.
 * history: mensajes previos [{role:'user'|'model', text}]
 * Devuelve { text, sources }.
 */
/** ¿Kike pidió expresamente buscar en internet? Entonces el agente busca sí o sí (y se ve "Buscando en la web…"). */
export function wantsSearch(text = '') {
  return /\b(busca|buscame|búscame|buscar|investiga|investigame|averigua|googlea)\b|en (internet|la web|google)|en linea|en línea/i.test(text);
}

export async function runAgent({ agentId, history, text, images = [], forcedSkills = [], onText, onStatus, signal }) {
  const s = requireKey();
  const recentUser = history.filter((m) => m.role === 'user').slice(-2).map((m) => m.text).join(' ');
  const skills = pickSkills(agentId, `${text} ${recentUser}`, forcedSkills);
  const skillLabels = skillNames(skills);

  // Router: según lo que pide, usa el modelo más rápido, el normal o el potente.
  const { tier } = classify({ text, images: images.length, forced: forcedSkills.length, matches: pickSkills(agentId, text, []).filter((x) => !x.core).length, names: [store.agents()[agentId].name] });
  if (tier === 'light') {
    const res = await lightGenerate({
      system: buildLightPrompt(agentId),
      history: trimHistory(history, 'light'),
      text,
      signal,
      onText,
      onStatus,
    });
    return { text: res.text, sources: [], via: res.via === 'groq' ? 'groq' : undefined, skills: [], tier, model: res.model };
  }
  const chosen = modelFor(tier);
  const contents = trimHistory(history, tier).map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
  contents.push({
    role: 'user',
    parts: [{ text: text || 'Revisa la imagen adjunta.' }, ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } }))],
  });

  const attempt = async (provider) => {
    const system = buildSystemPrompt(agentId, { searchAvailable: !!provider, skills, mustSearch: !!provider && wantsSearch(text) });
    const tools = toolsFor(provider);
    const convo = [...contents];
    const sources = [];
    let prefix = '';
    for (let step = 0; step < 5; step++) {
      const last = step === 4;
      onStatus?.('thinking');
      const res = await generate({
        apiKey: s.geminiKey,
        model: chosen.model,
        system,
        contents: convo,
        tools,
        toolConfig: last && provider === 'tavily' ? { functionCallingConfig: { mode: 'NONE' } } : undefined,
        signal,
        onText: (t) => onText?.(prefix + t),
      });
      if (provider === 'google') groundingSources(res.grounding, sources);
      if (!res.functionCalls.length || last) return { text: prefix + res.text, sources, skills: skillLabels, tier, model: chosen.model, modelLabel: chosen.label };

      if (res.text.trim()) prefix += res.text.trim() + '\n\n';
      convo.push({ role: 'model', parts: res.parts });
      const responses = [];
      for (const fc of res.functionCalls) {
        const args = fc.args || {};
        const consulta = args.consulta || args.query || '';
        onStatus?.('searching', consulta);
        let response;
        try {
          const results = await doTavily({
            consulta,
            periodo: args.periodo,
            soloOficiales: !!args.solo_fuentes_oficiales,
            signal,
          });
          results.forEach((r) => addSource(sources, r));
          response = {
            consulta,
            resultados: results.map((r) => ({ titulo: r.title, url: r.url, fecha: r.date, extracto: r.content })),
          };
        } catch (e) {
          if (e instanceof SearchUnavailable) throw e;
          if (e.name === 'AbortError') throw e;
          response = { error: e.message };
          if (e instanceof SearchError) toast(e.message, 'warn', 6000);
        }
        responses.push({ functionResponse: { name: fc.name, ...(fc.id ? { id: fc.id } : {}), response } });
      }
      convo.push({ role: 'user', parts: responses });
    }
    return { text: prefix, sources, skills: skillLabels, tier, model: chosen.model, modelLabel: chosen.label };
  };

  const provider = searchProvider();
  try {
    try {
      return await attempt(provider);
    } catch (e) {
      if (!(e instanceof SearchUnavailable)) throw e;
      blockTavily(e);
      onText?.('');
      return await attempt('google');
    }
  } catch (e) {
    // Respaldo: si Gemini llegó al límite o está caído, responde Groq (sin búsqueda ni imágenes).
    if (!geminiDown(e) || !s.groqFallback || !groqReady() || images.length) throw e;
    onStatus?.('thinking');
    onText?.('');
    try {
      const reply = await groqChat({
        apiKey: s.groqKey,
        model: groqModelFor('main'),
        system: buildSystemPrompt(agentId, { searchAvailable: false, skills }),
        messages: contents.map((c) => ({ role: c.role === 'model' ? 'assistant' : 'user', content: c.parts.map((p) => p.text || '').join('') })),
        signal,
        onText,
      });
      return { text: reply, sources: [], via: 'groq', skills: skillLabels };
    } catch (g) {
      if (g.name === 'AbortError') throw g;
      noteGroqFailure(g);
      throw e;
    }
  }
}

// ---------------- Sala de juntas ----------------

function meetingBrief(m) {
  const lines = [`TEMA / NECESIDAD: ${m.topic}`];
  if (m.format) lines.push(`FORMATO: ${m.format}`);
  if (m.goal) lines.push(`OBJETIVO: ${m.goal}`);
  if (m.destination) lines.push(`DESTINO / PRODUCTO: ${m.destination}`);
  return lines.join('\n');
}

function transcript(m) {
  const out = [];
  for (const t of m.turns) {
    if (t.error || t.pending) continue;
    if (t.speaker === 'research') {
      out.push(`[INVESTIGACIÓN WEB${t.focus ? ` sobre "${t.focus}"` : ''}]\n${String(t.digest || '').slice(0, 2800)}`);
    } else if (t.speaker === 'kike') {
      out.push(`[${bossName()} – jefe]: ${t.text}`);
    } else {
      out.push(`[${agentName(t.speaker)} – ${ROLES[t.speaker].title}]: ${t.text.length > 1400 ? t.text.slice(0, 1400) + '…' : t.text}`);
    }
  }
  return out.join('\n\n');
}

/** Investigación previa a la reunión. Devuelve { queries, sources, digest, provider }. */
export async function research({ meeting, focus, signal, onStatus }) {
  const s = requireKey();
  const provider = searchProvider() || 'google';
  const about = focus ? `${meetingBrief(meeting)}\nPREGUNTA NUEVA DE ${bossName().toUpperCase()} (EL JEFE): ${focus}` : meetingBrief(meeting);

  if (provider === 'tavily') {
    onStatus?.('Preparando las búsquedas…');
    let queries;
    const queryPrompt = `Hoy es ${today()}. Genera 3 consultas de búsqueda web para investigar las estrategias de contenido más recientes útiles para esta necesidad de una agencia de turismo nacional en Venezuela que vende por Instagram, TikTok y WhatsApp:\n\n${about}\n\nConsulta 1: en español, sobre turismo/viajes en Venezuela o Latinoamérica en redes. Consulta 2: en inglés, sobre tendencias recientes de TikTok/Instagram para travel o tourism. Consulta 3: sobre mejores prácticas o cambios de algoritmo recientes aplicables al formato. Sé concreto.`;
    if (groqReady()) {
      try {
        const j = await groqJSON({
          apiKey: s.groqKey,
          kind: 'fast',
          model: groqModelFor('fast'),
          prompt: `${queryPrompt}\n\nResponde solo con JSON: {"queries": ["...", "...", "..."]}`,
          signal,
        });
        queries = (j.queries || []).filter((q) => typeof q === 'string' && q.trim()).slice(0, 3);
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        noteGroqFailure(e);
      }
    }
    if (!queries?.length) try {
      const j = await generateJSON({
        apiKey: s.geminiKey,
        model: s.fastModel || s.model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: queryPrompt,
              },
            ],
          },
        ],
        schema: { type: 'OBJECT', properties: { queries: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['queries'] },
        signal,
      });
      queries = (j.queries || []).filter(Boolean).slice(0, 3);
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      queries = []; // si el modelo rápido falla, usamos consultas básicas
    }
    if (!queries?.length) {
      queries = [
        `${meeting.topic} ${meeting.destination || ''} contenido redes sociales turismo Venezuela`.trim(),
        `travel tourism ${meeting.format || 'reels tiktok'} content trends`,
        `instagram tiktok algorithm best practices ${new Date().getFullYear()}`,
      ];
    }
    onStatus?.('Buscando en la web…');
    try {
      const batches = await Promise.all(
        queries.map((q, i) =>
          doTavily({ consulta: q, periodo: i === 2 ? 'año' : 'mes', soloOficiales: i === 2, signal, maxResults: 4 }).catch((e) => {
            if (e instanceof SearchUnavailable || e.name === 'AbortError') throw e;
            return [];
          })
        )
      );
      const seen = new Set();
      const results = batches.flat().filter((r) => !seen.has(r.url) && seen.add(r.url)).slice(0, 9);
      const digest = results.length
        ? results.map((r, i) => `[${i + 1}] ${r.title} (${r.url}${r.date ? ', ' + r.date : ''}): ${r.content.slice(0, 500)}`).join('\n')
        : 'No se encontraron resultados útiles.';
      return { queries, sources: results.map((r) => ({ title: r.title, url: r.url })), digest, provider };
    } catch (e) {
      if (!(e instanceof SearchUnavailable)) throw e;
      blockTavily(e);
    }
  }

  // Búsqueda de Google a través de Gemini
  onStatus?.('Buscando con Google (Gemini)…');
  const res = await generate({
    apiKey: s.geminiKey,
    model: s.model,
    system: buildSystemPrompt('analista', { searchAvailable: true, meeting: true }),
    tools: [{ google_search: {} }],
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Investiga en la web (prioriza fuentes oficiales y expertos de los últimos meses) lo más útil para esta reunión de contenido:\n\n${about}\n\nResume en 6–10 viñetas los hallazgos concretos (tendencias, formatos, datos, cambios de algoritmo) indicando la fuente de cada uno.`,
          },
        ],
      },
    ],
    signal,
  });
  const sources = [];
  groundingSources(res.grounding, sources);
  return { queries: [], sources, digest: res.text, provider: 'google' };
}

/**
 * Turno de un agente en la sala de juntas. Usa Groq si está activado (rápido y ahorra cuota de
 * Gemini) y cae en Gemini si Groq falla, o al revés si Gemini llegó al límite.
 * Devuelve { text, via }.
 */
function meetingQuery(m) {
  const lastBoss = [...m.turns].reverse().find((t) => t.speaker === 'kike' && t.text)?.text || '';
  return [m.topic, m.format, m.goal, m.destination, lastBoss].filter(Boolean).join(' ');
}

export async function meetingTurn({ meeting, agentId, onText, signal }) {
  const s = requireKey();
  const skills = pickSkills(agentId, meetingQuery(meeting));
  const system =
    buildSystemPrompt(agentId, { meeting: true, skills }) +
    `\n\n## Estás en la SALA DE JUNTAS
Estás reunido con ${bossName()} (tu jefe, que dirige la reunión) y tus compañeros para crear contenido. Si ${bossName()} aportó algo, tómalo en cuenta primero. Habla en primera persona como en una reunión real: breve (máximo unas 170 palabras), sin repetir lo que ya se dijo. Construye sobre las ideas de los demás o discrepa con argumentos. Apóyate en la investigación cuando aplique y menciona la fuente entre paréntesis. Termina con una propuesta concreta desde tu área. No armes el plan completo: eso se hace al cierre.`;
  const user = `${meetingBrief(meeting)}

TRANSCRIPCIÓN HASTA AHORA:
${transcript(meeting) || '(Eres el primero en hablar.)'}

Tu turno, ${agentName(agentId)}. Aporta desde tu área: ${ROLES[agentId].meetingFocus}`;
  const res = await dualGenerate({ system, user, signal, onText, preferGroq: s.groqMeetings });
  return { ...res, skills: skillNames(skills) };
}

/** Genera texto con Groq o Gemini según preferencia, usando el otro como respaldo. */
async function dualGenerate({ system, user, signal, onText, preferGroq }) {
  const s = store.settings();
  const viaGroq = () =>
    groqChat({ apiKey: s.groqKey, model: groqModelFor('main'), system, messages: [{ role: 'user', content: user }], signal, onText }).then((text) => ({
      text,
      via: 'groq',
    }));
  const viaGemini = () =>
    generate({ apiKey: s.geminiKey, model: s.model, system, contents: [{ role: 'user', parts: [{ text: user }] }], signal, onText }).then((r) => ({
      text: r.text,
      via: 'gemini',
    }));
  if (preferGroq && groqReady()) {
    try {
      return await viaGroq();
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      noteGroqFailure(e);
      onText?.('');
      return viaGemini();
    }
  }
  try {
    return await viaGemini();
  } catch (e) {
    if (!geminiDown(e) || !s.groqFallback || !groqReady()) throw e;
    onText?.('');
    return viaGroq();
  }
}

/** Cierre de la reunión: plan de contenido final. */
export async function meetingPlan({ meeting, onText, signal }) {
  requireKey();
  // El moderador usa las habilidades de guion y de copy que pida el tema.
  const query = meetingQuery(meeting);
  const skills = [...pickSkills('guion', query), ...pickSkills('copy', query).filter((s) => !s.core)].slice(0, 6);
  const system =
    buildSystemPrompt('guion', { meeting: true, skills }) +
    '\n\n## Ahora moderas el cierre de la reunión\nTu trabajo es convertir la conversación en un plan claro, accionable y listo para grabar y publicar. Respeta las ideas acordadas y resuelve contradicciones eligiendo la opción con mejor argumento.';
  const names = meeting.participants.map((id) => `${agentName(id)} (${ROLES[id].title})`).join(', ');
  const user = `${meetingBrief(meeting)}

PARTICIPANTES: ${bossName()} (jefe), ${names}.

TRANSCRIPCIÓN COMPLETA:
${transcript(meeting)}

Redacta el PLAN DE CONTENIDO final con estas secciones (Markdown):
## Idea ganadora (2–3 líneas)
## Por qué va a funcionar (apoyado en la investigación/datos, con fuentes si las hay)
## Guion (tabla: Tiempo | Toma | Texto en pantalla | Voz)
## Copy (2–3 variantes de caption con CTA a WhatsApp)
## Hooks alternativos (3)
## Hashtags y palabras clave
## Cuándo y dónde publicar (Instagram / TikTok)
## Cómo lo vamos a medir (qué métrica y qué número nos diría que funcionó)
## Pendientes para ${bossName()} (lista corta)`;
  const res = await dualGenerate({ system, user, signal, onText, preferGroq: false });
  return { ...res, skills: skillNames(skills) };
}

// ---------------- Métricas desde captura ----------------

const nullableNumber = { type: 'NUMBER', nullable: true };

export async function extractMetricsFromImage(image, signal) {
  const s = requireKey();
  return generateJSON({
    apiKey: s.geminiKey,
    model: s.model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: 'Esta es una captura de estadísticas de una publicación de Instagram (Insights) o TikTok (Analytics). Extrae los números visibles. Convierte abreviaturas a números completos (ej.: "1,2 mil" o "1.2K" = 1200; "3,4 M" = 3400000). El tiempo promedio de visualización va en segundos. La retención o "% vio el video completo" va como número de 0 a 100. Usa null para lo que no aparezca. No inventes.',
          },
          { inlineData: { mimeType: image.mimeType, data: image.data } },
        ],
      },
    ],
    schema: {
      type: 'OBJECT',
      properties: {
        red: { type: 'STRING', enum: ['instagram', 'tiktok', 'desconocida'] },
        formato: { type: 'STRING', nullable: true },
        fecha: { type: 'STRING', nullable: true, description: 'Fecha de publicación en formato AAAA-MM-DD si aparece' },
        vistas: nullableNumber,
        alcance: nullableNumber,
        likes: nullableNumber,
        comentarios: nullableNumber,
        compartidos: nullableNumber,
        guardados: nullableNumber,
        seguidores: nullableNumber,
        visitasPerfil: nullableNumber,
        tiempoPromedio: nullableNumber,
        retencion: nullableNumber,
      },
      required: ['red'],
    },
    signal,
  });
}
