// Memoria de la marca: datos que Kike le cuenta al gato y que leen los tres agentes.

import * as store from './store.js';
import { emit } from './state.js';
import { uid } from './ui.js';

export const MEM_CATS = [
  { id: 'precios', label: 'Precios', icon: '💵', ask: 'los precios de tus tours (por persona, qué incluye, formas de pago, descuentos)' },
  { id: 'destinos', label: 'Destinos y tours', icon: '🏝️', ask: 'tus destinos y tours (cuáles ofreces, duración, qué se hace, lo más vendido)' },
  { id: 'marca', label: 'Marca en redes', icon: '🎨', ask: 'cómo es la marca en redes (tono, estilo, hashtags, bio, frases típicas)' },
  { id: 'publico', label: 'Público', icon: '👥', ask: 'tu público en redes (quién compra, edades, ciudades, qué los motiva, qué los frena)' },
  { id: 'operacion', label: 'Operación', icon: '🚌', ask: 'cómo operan los viajes (salidas, puntos de encuentro, cupos, requisitos, políticas)' },
  { id: 'competencia', label: 'Competencia', icon: '🔍', ask: 'tu competencia (quiénes son, en qué te diferencias)' },
  { id: 'otros', label: 'Otros datos', icon: '📌', ask: 'cualquier otro dato útil' },
];

export const catLabel = (id) => MEM_CATS.find((c) => c.id === id) || MEM_CATS[MEM_CATS.length - 1];

const norm = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();

export const facts = () => store.memory();

function persist() {
  store.save('memory');
  emit('memory');
}

/** Guarda un dato. Si reemplaza otro (por id), lo sustituye. Devuelve el dato o null si ya existía. */
export function addFact({ cat, text, replaces }) {
  const list = facts();
  const clean = String(text || '').trim().slice(0, 600);
  if (!clean) return null;
  const category = MEM_CATS.some((c) => c.id === cat) ? cat : 'otros';
  if (list.some((f) => norm(f.text) === norm(clean))) return null;
  const old = replaces ? list.find((f) => f.id === replaces) : null;
  if (old) {
    const prev = { ...old };
    old.text = clean;
    old.cat = category;
    old.ts = Date.now();
    persist();
    return { ...old, replaced: prev };
  }
  const fact = { id: uid().slice(-6), cat: category, text: clean, ts: Date.now() };
  list.push(fact);
  if (list.length > 400) list.splice(0, list.length - 400);
  persist();
  return fact;
}

export function updateFact(id, patch) {
  const f = facts().find((x) => x.id === id);
  if (!f) return;
  Object.assign(f, patch, { ts: Date.now() });
  persist();
}

export function removeFact(id) {
  const list = facts();
  const i = list.findIndex((f) => f.id === id);
  if (i < 0) return null;
  const [gone] = list.splice(i, 1);
  persist();
  return gone;
}

/** Devuelve un dato borrado/reemplazado (deshacer). */
export function restoreFact(fact) {
  const list = facts();
  if (!list.some((f) => f.id === fact.id)) list.push(fact);
  persist();
}

export function clearMemory() {
  store.set('memory', []);
  emit('memory');
}

export function coverage() {
  const out = Object.fromEntries(MEM_CATS.map((c) => [c.id, 0]));
  for (const f of facts()) out[f.cat in out ? f.cat : 'otros']++;
  return out;
}

/** Categorías con poca información (para que el gato sepa qué preguntar). */
export function gaps() {
  const cov = coverage();
  return MEM_CATS.filter((c) => c.id !== 'otros' && c.id !== 'competencia' && cov[c.id] < 2).sort((a, b) => cov[a.id] - cov[b.id]);
}

/**
 * Texto de la memoria para los prompts. Con ids para que el gato pueda corregir/borrar.
 * Se corta por tamaño: se priorizan los datos más recientes.
 */
export function memoryText({ withIds = false, max = 4200 } = {}) {
  const list = [...facts()].sort((a, b) => b.ts - a.ts);
  const picked = [];
  let size = 0;
  for (const f of list) {
    const line = withIds ? `[${f.id}] ${f.text}` : f.text;
    if (size + line.length > max) continue;
    size += line.length + 4;
    picked.push(f);
  }
  const ids = new Set(picked.map((f) => f.id));
  return MEM_CATS.map((c) => {
    const rows = facts().filter((f) => f.cat === c.id && ids.has(f.id));
    if (!rows.length) return '';
    return `### ${c.label}\n${rows.map((f) => `- ${withIds ? `[${f.id}] ` : ''}${f.text}`).join('\n')}`;
  })
    .filter(Boolean)
    .join('\n\n');
}
