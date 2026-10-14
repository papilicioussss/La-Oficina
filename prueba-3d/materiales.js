// Materiales de plástico tipo LEGO. Una sola fábrica con caché: todas las piezas del mismo color comparten material.
import * as THREE from 'three';

export const PALETA = {
  rojo: '#d4382c',
  amarillo: '#f5cd30',
  azul: '#1f6fc9',
  verde: '#2a9a55',
  blanco: '#f4f4f2',
  naranja: '#ff8a3d',
  gris: '#a9aeb4',
  oscuro: '#3b4252',
  arena: '#e4cd9e',
  marron: '#8a5a36',
  base: '#4fa35d',
};

const cache = new Map();

/** Plástico brillante (ABS). El barniz (clearcoat) y el brillo se ajustan después según la calidad gráfica. */
export function plastico(color) {
  const key = String(color);
  if (!cache.has(key)) {
    cache.set(
      key,
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.38,
        metalness: 0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.3,
        envMapIntensity: 0.42,
      })
    );
  }
  return cache.get(key);
}

/** Plástico translúcido (por ejemplo, vidrio de ventana). */
export function translucido(color, opacidad = 0.45) {
  const key = `t:${color}:${opacidad}`;
  if (!cache.has(key)) {
    cache.set(key, new THREE.MeshPhysicalMaterial({ color, roughness: 0.1, transparent: true, opacity: opacidad, clearcoat: 1, clearcoatRoughness: 0.05 }));
  }
  return cache.get(key);
}

/** Aplica el nivel de calidad a todos los materiales ya creados (y a los que se creen después). */
export function ajustarMateriales(nivel) {
  const alta = nivel.barniz;
  for (const m of cache.values()) {
    const antes = m.clearcoat;
    if (m.transparent) continue;
    m.clearcoat = alta ? 0.3 : 0;
    m.envMapIntensity = nivel.entorno ? 0.42 : 0;
    if ((antes > 0) !== alta) m.needsUpdate = true;
    m.needsUpdate = true;
  }
}

export function todosLosMateriales() {
  return [...cache.values()];
}
