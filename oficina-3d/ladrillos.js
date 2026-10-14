// Piezas LEGO por código (copiado y ampliado de prueba-3d/ladrillos.js).
// Unidad: 1 = separación entre taquitos (8 mm reales). Ladrillo = 1.2 de alto, placa = 0.4.
//
// Rendimiento:
// - Los taquitos se dibujan con instancias (InstancedMesh): cientos de taquitos = una llamada de dibujo por color.
//   Hay dos geometrías de taquito (fina y simple); la calidad elige cuál usar sin reconstruir la escena.
// - Las cajas usan geometrías compartidas por medida (caché) y luego `fusionar()` junta por material todas las
//   piezas fijas de un grupo en una sola malla: menos llamadas de dibujo en celulares.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { plastico, porVertice } from './materiales.js';

export const ALTO_LADRILLO = 1.2;
export const ALTO_PLACA = 0.4;
const ALTO_TAQUITO = 0.2;

function perfil() {
  return [new THREE.Vector2(0.3, 0), new THREE.Vector2(0.3, ALTO_TAQUITO - 0.045), new THREE.Vector2(0.24, ALTO_TAQUITO), new THREE.Vector2(0, ALTO_TAQUITO)];
}
// fino (alta) y simple (media/baja): el contorno se ve igual de lejos y cuesta menos de la mitad
export const TAQUITO = { fino: new THREE.LatheGeometry(perfil(), 16), simple: new THREE.LatheGeometry(perfil(), 8) };
TAQUITO.fino.userData.compartida = TAQUITO.simple.userData.compartida = true;
const instanciasTaquito = new Set();

const variantes = new Set(); // grupos con versión fina y versión simple (paredes y pisos)

/** Registra un par de grupos equivalentes: uno con piezas biseladas y otro con cajas simples. */
export function registrarVariantes(fino, simple) {
  variantes.add({ fino, simple });
}

/** Cambia el detalle de taquitos y piezas grandes según la calidad (sin reconstruir la escena). */
export function detalleTaquitos(fino) {
  for (const inst of instanciasTaquito) inst.geometry = fino ? TAQUITO.fino : TAQUITO.simple;
  for (const v of variantes) {
    v.fino.visible = fino;
    v.simple.visible = !fino;
  }
}

const geoCache = new Map();
/** Caja redondeada compartida por medida. `seg` = segmentos del redondeo (1 para piezas grandes y repetidas; 0 = caja simple). */
export function geoCaja(w, h, d, seg = 2, radio = 0.05) {
  const key = `${w}|${h}|${d}|${seg}|${radio}`;
  if (!geoCache.has(key) && seg === 0) {
    // seg = 0: caja simple sin bisel (12 triángulos) para las versiones livianas
    const g = new THREE.BoxGeometry(Math.max(0.02, w - 0.03), h, Math.max(0.02, d - 0.03));
    g.userData.compartida = true;
    geoCache.set(key, g);
  }
  if (!geoCache.has(key)) {
    const g = new RoundedBoxGeometry(Math.max(0.02, w - 0.03), h, Math.max(0.02, d - 0.03), seg, Math.max(0.005, Math.min(radio, h / 2 - 0.001, w / 2 - 0.016, d / 2 - 0.016)));
    g.userData.compartida = true;
    geoCache.set(key, g);
  }
  return geoCache.get(key);
}

/**
 * Constructor de piezas. Agrega cajas a `grupo` y acumula taquitos por color.
 * Las cajas quedan marcadas como fijas (`userData.fija`) para que `fusionar()` pueda juntarlas.
 */
export class Constructor {
  constructor(grupo = new THREE.Group()) {
    this.grupo = grupo;
    this.taquitos = new Map(); // color -> [[x, y, z]]
    this.cajas = 0;
  }

  /** Ladrillo (o placa) con su esquina inferior en (x, y, z). w = ancho en x, d = fondo en z. */
  ladrillo({ x, y = 0, z, w, d, alto = ALTO_LADRILLO, color, material, taquitos = true, seg = 2 }) {
    const malla = new THREE.Mesh(geoCaja(w, alto, d, seg), material || plastico(color));
    malla.position.set(x + w / 2, y + alto / 2, z + d / 2);
    malla.castShadow = true;
    malla.receiveShadow = true;
    malla.userData.fija = true;
    this.grupo.add(malla);
    this.cajas++;
    if (taquitos) this.taquitosEn(x, y + alto, z, w, d, color);
    return malla;
  }

  placa(o) {
    return this.ladrillo({ ...o, alto: ALTO_PLACA });
  }

  /** Azulejo liso (sin taquitos). */
  azulejo(o) {
    return this.ladrillo({ ...o, alto: ALTO_PLACA, taquitos: false });
  }

  /** Taquitos sobre un rectángulo (w × d taquitos enteros, centrados). */
  taquitosEn(x, yTop, z, w, d, color) {
    const nx = Math.max(1, Math.round(w));
    const nz = Math.max(1, Math.round(d));
    const ox = x + (w - nx) / 2;
    const oz = z + (d - nz) / 2;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) this.taquito(ox + i + 0.5, yTop, oz + j + 0.5, color);
  }

  taquito(x, y, z, color) {
    if (!this.taquitos.has(color)) this.taquitos.set(color, []);
    this.taquitos.get(color).push([x, y, z]);
  }

  /** Crea UNA malla instanciada con todos los taquitos (cada uno con su color). Se llama una vez al terminar. */
  terminar(fino = true) {
    const lista = [];
    for (const [color, pos] of this.taquitos) for (const p of pos) lista.push([p, color]);
    if (lista.length) this.grupo.add(crearTaquitos(lista.map(([[x, y, z], color]) => [new THREE.Matrix4().makeTranslation(x, y, z), new THREE.Color(color)]), fino));
    this.taquitos.clear();
    return this.grupo;
  }
}

/** Malla instanciada de taquitos con color por instancia (material blanco de plástico que se tiñe). */
function crearTaquitos(lista, fino) {
  const material = plastico('#ffffff');
  const inst = new THREE.InstancedMesh(fino ? TAQUITO.fino : TAQUITO.simple, material, lista.length);
  lista.forEach(([m, c], i) => {
    inst.setMatrixAt(i, m);
    inst.setColorAt(i, c);
  });
  inst.castShadow = true;
  inst.receiveShadow = true;
  inst.userData.taquitos = true;
  instanciasTaquito.add(inst);
  return inst;
}

/**
 * Junta por material todas las mallas fijas (sin textura, no transparentes) que cuelgan de `raiz`, en una malla por
 * material. Las piezas que deben seguir separadas (por ejemplo, un modelo .glb animado) se marcan con
 * `userData.fija = false` y se respetan. Devuelve cuántas mallas se juntaron.
 */
export function fusionar(raiz) {
  raiz.updateMatrixWorld(true);
  const inversa = new THREE.Matrix4().copy(raiz.matrixWorld).invert();
  const porMaterial = new Map();
  const quitar = [];
  raiz.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.userData.fija) return;
    if (o.material.transparent || o.material.map || Array.isArray(o.material)) return;
    let fijo = true;
    for (let p = o.parent; p && p !== raiz; p = p.parent) if (p.userData.fija === false) fijo = false;
    if (!fijo) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const nombre of Object.keys(g.attributes)) if (nombre !== 'position' && nombre !== 'normal') g.deleteAttribute(nombre);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inversa, o.matrixWorld));
    // piezas del mismo tipo de plástico (aunque sean de distinto color) van juntas, con el color en cada vértice
    const tipo = o.material.userData.tipo;
    const c = o.material.color;
    const n = g.attributes.position.count;
    const colores = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colores.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colores, 3));
    const k = tipo ? `tipo:${tipo}` : o.material.uuid;
    if (!porMaterial.has(k)) porMaterial.set(k, { material: tipo ? porVertice(tipo) : o.material, geos: [], sombra: false });
    const grupo = porMaterial.get(k);
    grupo.geos.push(g);
    grupo.sombra ||= o.castShadow;
    quitar.push(o);
  });
  for (const o of quitar) {
    o.removeFromParent();
    if (!o.geometry.userData.compartida) o.geometry.dispose();
  }
  let n = 0;
  for (const { material, geos, sombra } of porMaterial.values()) {
    const unida = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!material.vertexColors) unida.deleteAttribute('color');
    const malla = new THREE.Mesh(unida, material);
    malla.castShadow = sombra;
    malla.receiveShadow = true;
    malla.userData.fusionada = true;
    raiz.add(malla);
    n += geos.length;
  }
  return n;
}

/**
 * Junta todos los taquitos instanciados que cuelgan de `raiz` en una sola malla instanciada por color
 * (los modelos crean sus propios taquitos; aquí se agrupan para que una sala entera cueste una llamada por color).
 */
export function unirTaquitos(raiz, fino = true) {
  raiz.updateMatrixWorld(true);
  const inversa = new THREE.Matrix4().copy(raiz.matrixWorld).invert();
  const lista = [];
  const quitar = [];
  const m = new THREE.Matrix4();
  const rel = new THREE.Matrix4();
  const c = new THREE.Color();
  raiz.traverse((o) => {
    if (!o.isInstancedMesh || !o.userData.taquitos) return;
    rel.multiplyMatrices(inversa, o.matrixWorld);
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      if (o.instanceColor) o.getColorAt(i, c);
      else c.copy(o.material.color);
      lista.push([new THREE.Matrix4().multiplyMatrices(rel, m), c.clone()]);
    }
    quitar.push(o);
  });
  for (const o of quitar) {
    instanciasTaquito.delete(o);
    o.removeFromParent();
    o.dispose();
  }
  if (lista.length) raiz.add(crearTaquitos(lista, fino));
  return lista.length;
}
