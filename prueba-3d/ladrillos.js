// Piezas LEGO por código: ladrillos, placas, azulejos y taquitos (studs). Unidad: 1 = separación entre taquitos (8 mm reales).
// Altura de ladrillo = 1.2, de placa = 0.4.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { plastico } from './materiales.js';

export const ALTO_LADRILLO = 1.2;
export const ALTO_PLACA = 0.4;
const ALTO_TAQUITO = 0.2;

// Taquito: cilindro corto con el borde superior biselado (se ve mucho más real que un cilindro liso).
// (el perfil se recorre de abajo hacia arriba para que las caras miren hacia afuera)
const perfilTaquito = [
  new THREE.Vector2(0.3, 0),
  new THREE.Vector2(0.3, ALTO_TAQUITO - 0.045),
  new THREE.Vector2(0.24, ALTO_TAQUITO),
  new THREE.Vector2(0, ALTO_TAQUITO),
];
const geoTaquito = new THREE.LatheGeometry(perfilTaquito, 16);

const geoCache = new Map();
function geoCaja(w, h, d) {
  const key = `${w}|${h}|${d}`;
  if (!geoCache.has(key)) geoCache.set(key, new RoundedBoxGeometry(w - 0.03, h, d - 0.03, 3, 0.055));
  return geoCache.get(key);
}

/**
 * Constructor de escenas de ladrillos. Acumula los taquitos por color y los dibuja con instancias (InstancedMesh):
 * cientos de taquitos cuestan una sola llamada de dibujo por color, lo que importa en celulares modestos.
 */
export class Constructor {
  constructor() {
    this.grupo = new THREE.Group();
    this.taquitos = new Map(); // color -> [matrices]
    this.cajas = 0;
  }

  /** Ladrillo (o placa) con su esquina inferior en la rejilla (x, nivel, z). w y d en taquitos. */
  ladrillo({ x, y = 0, z, w, d, alto = ALTO_LADRILLO, color, taquitos = true }) {
    const malla = new THREE.Mesh(geoCaja(w, alto, d), plastico(color));
    malla.position.set(x + w / 2, y + alto / 2, z + d / 2);
    malla.castShadow = true;
    malla.receiveShadow = true;
    this.grupo.add(malla);
    this.cajas++;
    if (taquitos) this.#taquitos(x, y + alto, z, w, d, color);
    return malla;
  }

  placa(o) {
    return this.ladrillo({ ...o, alto: ALTO_PLACA });
  }

  /** Azulejo liso (sin taquitos). */
  azulejo(o) {
    return this.ladrillo({ ...o, alto: ALTO_PLACA, taquitos: false });
  }

  #taquitos(x, yTop, z, w, d, color) {
    if (!this.taquitos.has(color)) this.taquitos.set(color, []);
    const lista = this.taquitos.get(color);
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) lista.push([x + i + 0.5, yTop, z + j + 0.5]);
  }

  /** Taquitos sueltos (por ejemplo, sobre una superficie ya construida). */
  taquito(x, y, z, color) {
    if (!this.taquitos.has(color)) this.taquitos.set(color, []);
    this.taquitos.get(color).push([x, y, z]);
  }

  /** Crea las mallas instanciadas de taquitos. Se llama una vez al terminar de construir. */
  terminar() {
    const m = new THREE.Matrix4();
    for (const [color, lista] of this.taquitos) {
      const inst = new THREE.InstancedMesh(geoTaquito, plastico(color), lista.length);
      lista.forEach(([x, y, z], i) => {
        m.makeTranslation(x, y, z);
        inst.setMatrixAt(i, m);
      });
      inst.castShadow = true;
      inst.receiveShadow = true;
      this.grupo.add(inst);
    }
    return this.grupo;
  }
}
