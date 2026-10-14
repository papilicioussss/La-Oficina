// Router de modelos: elige el modelo según lo que pide Kike para gastar solo lo necesario.
//   light    → saludos, gracias y charla corta: modelo más rápido, prompt mínimo, sin herramientas.
//   standard → lo normal (captions, ideas, respuestas): modelo principal.
//   heavy    → tareas grandes (planes, análisis, guiones completos, imágenes, textos largos): modelo potente
//              (si Kike configura uno; si no, el principal).

import * as store from './store.js';
import { norm } from './skills.js';

const SMALL_WORDS = new Set(
  `hola holi holaa holaaa buenas buenos buen dia dias tarde tardes noche noches hey epa saludos que tal como estas esta andas vas amaneciste
   todo bien gracias muchas muy ok okey oki vale listo perfecto genial chevere excelente dale de acuerdo entendido jaja jajaja jaj jeje jejeje
   adios chao hasta luego nos vemos bye miau si no claro por favor jefe equipo amigo mano pana panas y tu usted el la equipo todos
   un saludo abrazo feliz dia lunes martes miercoles jueves viernes sabado domingo mil gracias de nada`.split(/\s+/)
);

const HEAVY_RE =
  /\b(plan de contenido|plan completo|plan mensual|plan del mes|calendario|estrategia|analiza|analisis|auditoria|informe|reporte|investiga|investigacion|compar(a|ativa)|guion completo|serie de|lanzamiento|campana)\b/;

const words = (t) =>
  norm(t)
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/**
 * Clasifica un mensaje. `names` son nombres propios que no cuentan (el del agente o el del gato).
 * Devuelve { tier: 'light'|'standard'|'heavy', reason }.
 */
export function classify({ text = '', images = 0, forced = 0, matches = 0, names = [] }) {
  const s = store.settings();
  if (s.routerOn === false) return { tier: 'standard', reason: 'router apagado' };
  const raw = String(text || '');
  const w = words(raw);
  const skip = new Set(names.flatMap((n) => words(n)));

  if (images > 0) return { tier: 'heavy', reason: 'imagen' };
  if (raw.length > 1500) return { tier: 'heavy', reason: 'texto largo' };
  if (forced >= 2 || matches >= 3) return { tier: 'heavy', reason: 'varias skills' };
  if (HEAVY_RE.test(norm(raw))) return { tier: 'heavy', reason: 'tarea grande' };

  if (!forced && w.length && w.length <= 8 && w.every((x) => SMALL_WORDS.has(x) || skip.has(x))) {
    return { tier: 'light', reason: 'saludo o charla corta' };
  }
  return { tier: 'standard', reason: 'normal' };
}

/** Qué modelo usar para un nivel. Devuelve { provider: 'gemini'|'groq', model, label }. */
export function modelFor(tier, { groqOk = false } = {}) {
  const s = store.settings();
  if (s.routerOn === false) return { provider: 'gemini', model: s.model, label: 'principal' };
  if (tier === 'light') {
    if (groqOk && s.lightGroq !== false && s.groqKey) return { provider: 'groq', model: s.groqFastModel || s.groqModel, label: 'rápido' };
    return { provider: 'gemini', model: s.fastModel || s.model, label: 'rápido' };
  }
  if (tier === 'heavy' && s.heavyModel) return { provider: 'gemini', model: s.heavyModel, label: 'potente' };
  return { provider: 'gemini', model: s.model, label: 'principal' };
}

/** Recorta el historial: pocos mensajes y los viejos más cortos (menos tokens en cada consulta). */
export function trimHistory(history, tier) {
  const keep = tier === 'light' ? 4 : tier === 'heavy' ? 14 : 10;
  const list = history.filter((m) => m.text && !m.pending && !m.error).slice(-keep);
  return list.map((m, i) => {
    const old = i < list.length - 2;
    const max = old ? (m.role === 'user' ? 900 : 1100) : 6000;
    return m.text.length > max ? { ...m, text: m.text.slice(0, max) + '…' } : m;
  });
}
