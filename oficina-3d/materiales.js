// Materiales de plástico tipo LEGO (copiado y ampliado de prueba-3d/materiales.js).
// Una sola fábrica con caché: todas las piezas del mismo color comparten material. Los materiales de la caché están
// marcados como compartidos (`userData.compartido`) y NO se liberan al quitar un modelo; solo `liberarTodo()` los libera.
import * as THREE from 'three';

const cache = new Map();

function guardar(key, crear) {
  if (!cache.has(key)) {
    const m = crear();
    m.userData.compartido = true;
    cache.set(key, m);
  }
  return cache.get(key);
}

const PARAMS = {
  plastico: () => new THREE.MeshPhysicalMaterial({ roughness: 0.36, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.3, envMapIntensity: 0.42 }),
  mate: () => new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0, envMapIntensity: 0.3 }),
};

function deTipo(tipo, color) {
  return guardar(`${tipo}:${color}`, () => {
    const m = PARAMS[tipo]();
    m.color.set(color);
    m.userData.tipo = tipo; // permite juntar piezas de distinto color en una sola malla (colores por vértice)
    return m;
  });
}

/** Plástico brillante (ABS). El barniz y los reflejos se ajustan según la calidad gráfica. */
export function plastico(color) {
  return deTipo('plastico', color);
}

/** Plástico mate (tronco, tierra, papel). */
export function mate(color) {
  return deTipo('mate', color);
}

/**
 * Material de un tipo con colores por vértice (o por instancia): lo usan las mallas fusionadas y los taquitos para
 * dibujar piezas de muchos colores en una sola llamada.
 */
export function porVertice(tipo) {
  return guardar(`v:${tipo}`, () => {
    const m = PARAMS[tipo]();
    m.vertexColors = true;
    m.userData.porVertice = tipo;
    return m;
  });
}

/**
 * Plástico estampado con una trama (tela de la sudadera, camuflaje del pantalón): colores por vértice multiplicados por
 * una textura en gris que se repite. Permite juntar en una malla piezas de distinto color con la misma trama.
 */
export function trama(clave, textura) {
  return guardar(`trama:${clave}`, () => {
    textura.colorSpace = THREE.SRGBColorSpace;
    textura.wrapS = textura.wrapT = THREE.RepeatWrapping;
    textura.anisotropy = 4;
    const m = new THREE.MeshPhysicalMaterial({ map: textura, vertexColors: true, roughness: 0.5, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.5, envMapIntensity: 0.32 });
    m.userData.trama = clave;
    return m;
  });
}

/** Plástico translúcido (vidrio de ventana, pantallas). */
export function translucido(color, opacidad = 0.35) {
  return guardar(`t:${color}:${opacidad}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, transparent: true, opacity: opacidad, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false }));
}

/** Material con una imagen o dibujo (canvas). `clave` identifica la textura para no repetirla. */
export function estampado(clave, textura, { brillo = false } = {}) {
  return guardar(`e:${clave}`, () => {
    textura.colorSpace = THREE.SRGBColorSpace;
    textura.anisotropy = 4;
    return new THREE.MeshStandardMaterial({ map: textura, roughness: brillo ? 0.3 : 0.55, metalness: 0, envMapIntensity: 0.3 });
  });
}

/** Aplica el nivel de calidad a todos los materiales ya creados. */
export function ajustarMateriales(nivel) {
  for (const m of cache.values()) {
    if (m.transparent) continue;
    if ('clearcoat' in m) {
      const antes = m.clearcoat > 0;
      m.clearcoat = nivel.barniz ? 0.3 : 0;
      if (antes !== nivel.barniz) m.needsUpdate = true;
    }
    m.envMapIntensity = nivel.entorno ? (m.map ? 0.3 : 0.42) : 0;
  }
}

export function todosLosMateriales() {
  return [...cache.values()];
}

/** Libera todos los materiales compartidos (solo al cerrar la escena por completo). */
export function liberarTodo() {
  for (const m of cache.values()) {
    m.map?.dispose();
    m.dispose();
  }
  cache.clear();
}
