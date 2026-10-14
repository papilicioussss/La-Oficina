// Registro de modelos de la oficina 3D.
//
// La escena NUNCA construye un mueble directamente: lo pide por nombre con `crearModelo(nombre, opciones)`.
// Hoy cada nombre apunta a una fábrica hecha por código (componentes/muebles.js). Mañana se puede apuntar a un
// archivo .glb sin tocar salas.js ni el resto de la escena.
//
// ─── Contrato de un modelo ─────────────────────────────────────────────────────────────────────────────────
// La fábrica recibe las opciones del plano (color, logo, placa…) y devuelve un THREE.Object3D. El registro lo
// envuelve y devuelve:
//   objeto      Object3D listo para agregar. Origen = centro de su huella, apoyado en el piso (y = 0).
//               Frente = +z (hacia +y del plano, la cámara isométrica). El giro lo pone la escena con `rot`.
//   anclas      { nombre: Vector3 local } puntos útiles: 'superficie' (donde se apoyan objetos encima),
//               'asiento' (donde se sentará un personaje), 'pantalla', etc.
//   medida      { w, d, alto } tamaño de referencia en taquitos (para escalar un .glb al mismo tamaño).
//   liberar()   libera geometrías y texturas PROPIAS del modelo (no las compartidas de la caché).
//
// ─── Cómo registrar un modelo ──────────────────────────────────────────────────────────────────────────────
//   registrarModelo('silla', (op) => crearSillaPorCodigo(op), { medida: { w: 2.4, d: 2.6, alto: 4.2 }, anclas: {...} })
//
// ─── Escala y orientación de un .glb ───────────────────────────────────────────────────────────────────────
// Modela en Blender con 1 unidad = 1 taquito (8 mm), el origen en el centro de la base y el frente mirando a +Y
// de Blender (que el exportador glTF convierte en +Z de Three.js). Si el archivo viene en otra escala u
// orientación, se corrige al registrarlo con `escala` y `giro` (grados alrededor del eje vertical).
//
// ─── Puntos de anclaje en un .glb ──────────────────────────────────────────────────────────────────────────
// En Blender crea objetos vacíos (Empty) llamados `ancla_superficie`, `ancla_asiento`, etc. `anclasDesde(objeto)`
// los convierte en el mapa `anclas`. Si el archivo no trae un ancla, se usa la definida al registrar.
//
// ─── Reemplazar un modelo provisional por un .glb ──────────────────────────────────────────────────────────
// 1. Copia el GLTFLoader de Three.js a vendor/three/addons/loaders/ (archivo local, sin internet).
// 2. Carga el archivo antes de construir la escena y registra una fábrica que clone su escena:
//      const gltf = await new GLTFLoader().loadAsync('./modelos/silla.glb');
//      registrarModelo('silla', () => gltf.scene.clone(true), { escala: 1, giro: 0, fija: true });
// 3. Si el modelo tendrá animación o se moverá, regístralo con `fija: false` para que no se fusione con la sala.
// No se necesita compresión (Draco/meshopt) para esta etapa.
//
// ─── Liberar memoria ───────────────────────────────────────────────────────────────────────────────────────
// `liberarObjeto(objeto)` recorre el modelo y libera sus geometrías y texturas. Los materiales de la caché
// (materiales.js) y las geometrías compartidas por medida se marcan como compartidos y no se liberan aquí.
import * as THREE from 'three';

const fabricas = new Map();

/**
 * Registra (o reemplaza) la fábrica de un modelo.
 * opciones: { medida, anclas, escala = 1, giro = 0 (grados), fija = true }
 */
export function registrarModelo(nombre, fabrica, opciones = {}) {
  fabricas.set(nombre, { fabrica, escala: 1, giro: 0, fija: true, anclas: {}, ...opciones });
}

export const modelosRegistrados = () => [...fabricas.keys()];
export const datosModelo = (nombre) => fabricas.get(nombre);

/** Lee anclas de objetos vacíos con nombre `ancla_*` (para modelos .glb). */
export function anclasDesde(objeto) {
  const out = {};
  objeto.traverse((o) => {
    if (o.name?.startsWith('ancla_')) out[o.name.slice(6)] = o.position.clone();
  });
  return out;
}

/** Crea un modelo por nombre. Lanza un error claro si el nombre no está registrado. */
export function crearModelo(nombre, opciones = {}) {
  const def = fabricas.get(nombre);
  if (!def) throw new Error(`Modelo no registrado: ${nombre}`);
  const interno = def.fabrica(opciones);
  const objeto = new THREE.Group();
  objeto.name = `modelo:${nombre}`;
  if (def.escala !== 1) interno.scale.multiplyScalar(def.escala);
  if (def.giro) interno.rotation.y += THREE.MathUtils.degToRad(def.giro);
  objeto.add(interno);
  objeto.userData.modelo = nombre;
  objeto.userData.fija = def.fija;
  const anclas = { ...def.anclas, ...(interno.userData.anclas || {}), ...anclasDesde(interno) };
  return {
    objeto,
    anclas,
    medida: interno.userData.medida || def.medida || null,
    liberar: () => liberarObjeto(objeto),
  };
}

/** Libera geometrías y texturas propias de un objeto (no las compartidas). */
export function liberarObjeto(objeto) {
  objeto.traverse((o) => {
    if (o.geometry && !o.geometry.userData?.compartida) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (m.userData?.compartido) continue;
      m.map?.dispose();
      m.dispose();
    }
  });
  objeto.removeFromParent();
}
