// Contador discreto de consultas gratis del día (Gemini, Groq y Tavily) y de las veces que el proveedor dijo "límite".
// Solo cuenta lo que esta app envía desde este navegador; Google, Groq y Tavily llevan su propia cuenta oficial.

import * as store from './store.js';
import { emit } from './state.js';
import { toast } from './ui.js';

const dayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fresh = (day) => ({ day, gemini: {}, groq: 0, tavily: 0, hits: { gemini: 0, groq: 0, tavily: 0 }, warned: {} });

/** Contadores de hoy (si cambió el día, arrancan en cero). */
export function usage() {
  let u = store.get('usage');
  if (!u || u.day !== dayKey()) {
    u = fresh(dayKey());
    store.set('usage', u);
  }
  return u;
}

export const geminiTotal = (u = usage()) => Object.values(u.gemini).reduce((a, b) => a + b, 0);
export const totalOf = (provider, u = usage()) => (provider === 'gemini' ? geminiTotal(u) : u[provider] || 0);

const NAMES = { gemini: 'Gemini', groq: 'Groq', tavily: 'Tavily (búsquedas)' };

/** Cuenta una consulta enviada. Para Gemini se separa por modelo (cada uno tiene su propio límite). */
export function countCall(provider, model = '') {
  const u = usage();
  if (provider === 'gemini') u.gemini[model || 'otro'] = (u.gemini[model || 'otro'] || 0) + 1;
  else u[provider] = (u[provider] || 0) + 1;
  store.save('usage');
  // Aviso suave al llegar al 80 % del tope que Kike anotó (una sola vez por día y proveedor)
  const cap = Number(store.settings()['limit' + provider[0].toUpperCase() + provider.slice(1)]) || 0;
  if (cap > 0 && totalOf(provider, u) >= Math.ceil(cap * 0.8) && !u.warned[provider]) {
    u.warned[provider] = true;
    store.save('usage');
    toast(`Vas por ${totalOf(provider, u)} de ${cap} consultas de ${NAMES[provider]} hoy: te queda poco.`, 'warn', 6000);
  }
  emit('usage');
}

/** El proveedor respondió "límite alcanzado" (429). */
export function countLimitHit(provider) {
  const u = usage();
  u.hits[provider] = (u.hits[provider] || 0) + 1;
  store.save('usage');
  emit('usage');
}

/** Resumen corto para la pantalla de inicio. */
export function usageLine() {
  const u = usage();
  const parts = [];
  if (geminiTotal(u)) parts.push(`Gemini ${geminiTotal(u)}`);
  if (u.groq) parts.push(`Groq ${u.groq}`);
  if (u.tavily) parts.push(`Búsquedas ${u.tavily}`);
  const hits = Object.entries(u.hits).filter(([, n]) => n > 0);
  return { text: parts.join(' · '), hits: hits.map(([k, n]) => `${NAMES[k]} (${n})`), any: parts.length > 0 };
}
