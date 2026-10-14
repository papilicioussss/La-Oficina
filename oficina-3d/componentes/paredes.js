// Paredes exteriores de ladrillo trabado (cuatro lados del contorno) y tabiques bajos entre salas con sus puertas.
//
// Ocultado: cada pared exterior tiene una "base" (la primera hilera) y un "cuerpo" (el resto, con su decoración).
// Cuando la pared queda entre la cámara y la oficina, el cuerpo baja suavemente hasta desaparecer y queda solo la
// base, como en los juegos de construcción. Hay histéresis (umbral para ocultar mayor que para mostrar) para que no
// parpadee cuando la cámara está justo en el límite.
import * as THREE from 'three';
import { Constructor, fusionar, registrarVariantes, ALTO_LADRILLO as L, ALTO_PLACA as P } from '../ladrillos.js';
import { plastico } from '../materiales.js';
import { PAREDES, PARTITIONS, VENTANA, COLORES, ALTURAS, ESCALA } from '../plano.js';

const HILERAS = Math.round(ALTURAS.pared / L); // 8
const FILAS_VENTANA = [3, 4, 5, 6]; // la ventana ocupa estas hileras (y de 3.6 a 8.4)

// Rectángulo de cada pared en el mundo (taquitos), resolviendo las esquinas para que no se superpongan.
const RECTS = {
  'fondo-izq': { x: -1, z: -1, w: 1, d: 49 },
  'fondo-der': { x: 0, z: -1, w: 49, d: 1 },
  'frente-der': { x: 48, z: 0, w: 1, d: 69 },
  'frente-kike': { x: 23, z: 68, w: 25, d: 1 },
  'frente-guion': { x: -1, z: 48, w: 25, d: 1 },
  'lado-kike': { x: 23, z: 49, w: 1, d: 19 },
};

/** Tramos sólidos de una hilera: [desde, hasta] a lo largo de la pared, quitando el hueco de la ventana. */
function tramos(largo, hueco, fila) {
  if (!hueco || !FILAS_VENTANA.includes(fila)) return [[0, largo]];
  return [[0, hueco[0]], [hueco[1], largo]].filter(([a, b]) => b - a > 0.01);
}

/** Llena un tramo con ladrillos de 4 (con medio ladrillo al empezar las filas impares: aparejo trabado). */
function ladrillosDe(a, b, fila) {
  const out = [];
  let x = a;
  const primero = fila % 2 ? 2 : 4;
  let largo = primero;
  while (x < b - 0.01) {
    const l = Math.min(largo, b - x);
    out.push([x, l]);
    x += l;
    largo = 4;
  }
  return out;
}

function construirPared(def, finos) {
  const variantesPared = { fino: [], simple: [] };
  const r = RECTS[def.id];
  const aLoLargoDeX = def.eje === 'y'; // la pared corre a lo largo de x cuando está en y = constante
  const largo = aLoLargoDeX ? r.w : r.d;
  const grupo = new THREE.Group();
  grupo.name = `pared:${def.id}`;
  const base = new THREE.Group();
  const cuerpo = new THREE.Group(); // pivota en la parte de arriba de la base
  cuerpo.position.y = L;
  const contenido = new THREE.Group();
  contenido.position.y = -L;
  cuerpo.add(contenido);
  grupo.add(base, cuerpo);

  const hueco = def.id === VENTANA.pared ? [VENTANA.desde * ESCALA - r.x, VENTANA.hasta * ESCALA - r.x] : null;
  const colores = [plastico(COLORES.paredA), plastico(COLORES.paredB)];
  const kb = new Constructor(base);
  const kc = new Constructor(contenido);
  // los ladrillos van dos veces: biselados (calidad Alta) y cajas simples (Media y Baja); se ve una sola versión
  for (const seg of [1, 0]) {
    const bLadrillos = new THREE.Group();
    const cLadrillos = new THREE.Group();
    base.add(bLadrillos);
    contenido.add(cLadrillos);
    const kbl = new Constructor(bLadrillos);
    const kcl = new Constructor(cLadrillos);
    let n = 0;
    for (let fila = 0; fila < HILERAS; fila++) {
      const k = fila === 0 ? kbl : kcl;
      for (const [a, b] of tramos(largo, hueco, fila)) {
        for (const [p, l] of ladrillosDe(a, b, fila)) {
          const material = colores[(n++ + fila) % 2];
          const pos = aLoLargoDeX ? { x: r.x + p, z: r.z, w: l, d: r.d } : { x: r.x, z: r.z + p, w: r.w, d: l };
          k.ladrillo({ ...pos, y: fila * L, alto: L, material, taquitos: false, seg });
        }
      }
    }
    fusionar(bLadrillos);
    fusionar(cLadrillos);
    (seg ? variantesPared.fino : variantesPared.simple).push(bLadrillos, cLadrillos);
  }
  // remate: azulejos con una fila de taquitos
  const remate = aLoLargoDeX ? { x: r.x, z: r.z, w: r.w, d: r.d } : { x: r.x, z: r.z, w: r.w, d: r.d };
  kc.placa({ ...remate, y: HILERAS * L, color: '#f0e1c4', taquitos: true, seg: 1 });
  // remate de la base (se ve cuando la pared está oculta)
  kb.placa({ ...remate, y: L, alto: 0.2, color: '#f0e1c4', taquitos: false, seg: 1 });
  if (hueco) {
    // marco blanco de la ventana y alféizar
    const y0 = FILAS_VENTANA[0] * L;
    const y1 = (FILAS_VENTANA.at(-1) + 1) * L;
    kc.ladrillo({ x: r.x + hueco[0] - 0.3, z: r.z - 0.1, w: hueco[1] - hueco[0] + 0.6, d: r.d + 0.6, y: y0 - 0.3, alto: 0.3, color: BLANCO_MARCO, taquitos: false, seg: 1 });
    kc.ladrillo({ x: r.x + hueco[0] - 0.3, z: r.z - 0.1, w: hueco[1] - hueco[0] + 0.6, d: r.d + 0.2, y: y1, alto: 0.3, color: BLANCO_MARCO, taquitos: false, seg: 1 });
    kc.ladrillo({ x: r.x + (hueco[0] + hueco[1]) / 2 - 0.15, z: r.z, w: 0.3, d: r.d, y: y0, alto: y1 - y0, color: BLANCO_MARCO, taquitos: false, seg: 1 });
  }
  kb.terminar(finos);
  kc.terminar(finos);
  fusionar(base);
  fusionar(contenido);
  variantesPared.fino.forEach((g, i) => registrarVariantes(g, variantesPared.simple[i]));
  return {
    id: def.id,
    grupo,
    cuerpo,
    contenido,
    normal: new THREE.Vector3(def.normal[0], 0, def.normal[1]),
    centro: new THREE.Vector3(r.x + r.w / 2, 0, r.z + r.d / 2),
    hueco,
    rect: r,
    visible: 1, // 1 = completa, 0 = oculta (solo la base)
    meta: 1,
  };
}
const BLANCO_MARCO = '#fffaf0';

function construirTabiques(finos) {
  const grupo = new THREE.Group();
  grupo.name = 'tabiques';
  const k = new Constructor(grupo);
  const grosor = 0.3 * ESCALA; // igual que el obstáculo del plano (±0.15)
  const filas = Math.round(ALTURAS.tabique / L);
  const material = plastico(COLORES.tabique);
  const versiones = [new THREE.Group(), new THREE.Group()]; // biselados / simples
  grupo.add(...versiones);
  const kv = versiones.map((g) => new Constructor(g));
  for (const [eje, en, desde, hasta] of PARTITIONS) {
    const c = en * ESCALA;
    const a = desde * ESCALA;
    const b = hasta * ESCALA;
    for (let fila = 0; fila < filas; fila++) {
      for (const [p, l] of ladrillosDe(a, b, fila)) {
        const pos = eje === 'x' ? { x: c - grosor / 2, z: p, w: grosor, d: l } : { x: p, z: c - grosor / 2, w: l, d: grosor };
        kv.forEach((kk, i) => kk.ladrillo({ ...pos, y: fila * L, alto: L, material, taquitos: false, seg: i ? 0 : 1 }));
      }
    }
    const tapa = eje === 'x' ? { x: c - grosor / 2, z: a, w: grosor, d: b - a } : { x: a, z: c - grosor / 2, w: b - a, d: grosor };
    k.placa({ ...tapa, y: filas * L, color: COLORES.tabique, taquitos: false, seg: 1 });
    // taquitos a lo largo del tabique (uno por taquito de largo)
    for (let s = Math.ceil(a); s < b - 0.5; s++) {
      if (eje === 'x') k.taquito(c, filas * L + P, s + 0.5, COLORES.tabique);
      else k.taquito(s + 0.5, filas * L + P, c, COLORES.tabique);
    }
  }
  k.terminar(finos);
  versiones.forEach((g) => fusionar(g));
  registrarVariantes(versiones[0], versiones[1]);
  fusionar(grupo);
  return grupo;
}

export function construirParedes({ finos = true } = {}) {
  const grupo = new THREE.Group();
  grupo.name = 'paredes';
  const paredes = PAREDES.map((def) => construirPared(def, finos));
  paredes.forEach((p) => grupo.add(p.grupo));
  grupo.add(construirTabiques(finos));
  return { grupo, paredes, porId: Object.fromEntries(paredes.map((p) => [p.id, p])) };
}

// ─── Ocultar las paredes que tapan la vista ──────────────────────────────────────────────────────────────────
const OCULTAR = 0.32; // la pared se oculta cuando la cámara está claramente detrás de ella
const MOSTRAR = 0.12; // y vuelve a aparecer solo cuando la cámara está claramente delante (histéresis)
const dir = new THREE.Vector3();

/**
 * Decide qué paredes ocultar según la cámara y avanza la animación. Devuelve true si algo cambió (hay que dibujar).
 * `inmediato` salta la animación (al cargar o con movimiento reducido).
 */
export function actualizarParedes(paredes, camara, objetivo, dt, { inmediato = false } = {}) {
  dir.subVectors(camara.position, objetivo).setY(0).normalize();
  let cambio = false;
  for (const p of paredes) {
    const d = dir.dot(p.normal);
    if (p.meta === 1 && d > OCULTAR) p.meta = 0;
    else if (p.meta === 0 && d < MOSTRAR) p.meta = 1;
    if (p.visible === p.meta) continue;
    const paso = inmediato ? 1 : dt / 0.35; // 350 ms
    p.visible = p.meta > p.visible ? Math.min(p.meta, p.visible + paso) : Math.max(p.meta, p.visible - paso);
    const e = p.visible * p.visible * (3 - 2 * p.visible);
    p.cuerpo.scale.y = Math.max(0.0001, e);
    p.cuerpo.visible = p.visible > 0.001;
    cambio = true;
  }
  return cambio;
}
