// Selección de habilidades: las básicas van siempre; el resto se activa solo según lo que se pide.

import * as store from './store.js';
import { SKILLS } from './skills-data.js';

const MAX_EXTRA = 3; // habilidades adicionales por consulta (además de las básicas)
const MAX_FORCED = 4;

export const norm = (t) =>
  String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const esc = (t) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const kwCache = new Map();
function kwRegex(kw) {
  if (!kwCache.has(kw)) kwCache.set(kw, new RegExp('(^|[^a-z0-9])' + esc(kw)));
  return kwCache.get(kw);
}

/** Skills propias que Kike crea en Configuración. */
function customSkills() {
  return (store.settings().customSkills || []).map((c) => ({
    id: c.id,
    agents: c.agents?.length ? c.agents : ['copy', 'analista', 'guion'],
    icon: c.icon || '⭐',
    name: c.name,
    desc: 'Skill propia',
    core: false,
    custom: true,
    kw: (c.kw || []).map(norm).filter(Boolean),
    text: c.text,
  }));
}

export const allSkills = () => [...SKILLS, ...customSkills()];
export const skillById = (id) => allSkills().find((s) => s.id === id);
export const skillsFor = (agentId) => allSkills().filter((s) => s.agents.includes(agentId));
export const isEnabled = (id) => !(store.settings().skillsOff || []).includes(id);
export const isPinned = (id) => (store.settings().skillsPinned || []).includes(id);

function score(skill, q) {
  let n = 0;
  for (const kw of skill.kw) if (kwRegex(kw).test(q)) n += kw.includes(' ') ? 2 : 1;
  return n;
}

/**
 * Elige las habilidades para una consulta.
 * Devuelve una lista: primero las básicas (core), luego las forzadas por Kike, las fijadas y las que
 * coinciden con la consulta (máx. 3 en total además de las forzadas).
 */
export function pickSkills(agentId, query = '', forced = []) {
  const mine = skillsFor(agentId).filter((s) => isEnabled(s.id));
  const q = norm(query);
  const core = mine.filter((s) => s.core);
  const picked = [];
  const add = (s) => s && !picked.includes(s) && !s.core && picked.push(s);
  for (const id of forced.slice(0, MAX_FORCED)) add(mine.find((s) => s.id === id));
  const forcedCount = picked.length;
  for (const s of mine) if (isPinned(s.id)) add(s);
  const matches = mine
    .filter((s) => !s.core && !picked.includes(s))
    .map((s) => ({ s, n: score(s, q) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  for (const { s } of matches) {
    if (picked.length - forcedCount >= MAX_EXTRA) break;
    add(s);
  }
  return [...core, ...picked];
}

/** Nombres para mostrar en la interfaz (sin las básicas). */
export const skillNames = (list) => list.filter((s) => !s.core).map((s) => `${s.icon} ${s.name}`);

/** Bloque de instrucciones que se agrega al prompt del agente. */
export function skillsPrompt(list) {
  if (!list.length) return '';
  const extra = list.filter((s) => !s.core);
  const head = extra.length
    ? '## Habilidades profesionales activas para esta consulta\nAplica estas guías de marketing donde correspondan. Son criterios de trabajo: adapta todo a los datos reales de la marca y no las menciones por su nombre.'
    : '## Criterios base de trabajo';
  return `${head}\n\n${list.map((s) => `### ${s.name}\n${s.text}`).join('\n\n')}`;
}

/** Para la interfaz: qué habilidades se activarían con este texto y por qué (palabras que coincidieron). */
export function explainPick(agentId, query = '') {
  const q = norm(query);
  const mine = skillsFor(agentId).filter((s) => isEnabled(s.id) && !s.core);
  return mine
    .map((s) => ({ skill: s, matched: s.kw.filter((kw) => kwRegex(kw).test(q)), n: score(s, q) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, MAX_EXTRA);
}
