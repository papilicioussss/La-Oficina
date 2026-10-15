// Apariencia de cada agente: la por defecto de la app (copiada en plano.js) y, si este navegador tiene una
// apariencia personalizada guardada por la app (clave "vaof:agents"), esa. Solo LECTURA: nunca se escribe nada.
import { AGENTES, AGENT_IDS } from '../plano.js';

export function aparienciaAgentes() {
  let guardado = null;
  try {
    guardado = JSON.parse(localStorage.getItem('vaof:agents') || 'null');
  } catch {
    guardado = null; // sin acceso al almacenamiento o dato dañado: se usan los valores por defecto
  }
  const out = {};
  for (const id of AGENT_IDS) {
    const base = AGENTES[id];
    const g = guardado?.[id] || {};
    out[id] = { name: (g.name || base.name).slice(0, 16), look: { ...base.look, ...(g.look || {}), kit: base.look.kit } };
  }
  return out;
}
