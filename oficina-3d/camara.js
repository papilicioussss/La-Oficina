// Cámara de la oficina 3D: vista isométrica inicial, giro con ratón o un dedo, zoom con rueda o pellizco,
// desplazamiento con dos dedos o clic derecho, límites para no perder la oficina y enfoque suave de una sala.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ESCALA } from './plano.js';

// Contorno de la oficina en el mundo (24 × 34 del plano)
export const LIMITES = { x0: 0, x1: 24 * ESCALA, z0: 0, z1: 34 * ESCALA };
export const CENTRO = new THREE.Vector3((LIMITES.x0 + LIMITES.x1) / 2, 2, (LIMITES.z0 + LIMITES.z1) / 2);
const AZIMUT = Math.PI / 4; // mismo ángulo que la oficina SVG: el fondo queda en x = 0 y en y = 0
const ELEVACION = Math.atan(1 / Math.SQRT2); // isométrica clásica (≈ 35°)

export function crearCamara(lienzo) {
  const camara = new THREE.PerspectiveCamera(30, 1, 1, 600);
  const controles = new OrbitControls(camara, lienzo);
  controles.enableDamping = true;
  controles.dampingFactor = 0.09;
  controles.rotateSpeed = 0.8;
  controles.zoomSpeed = 0.9;
  controles.minDistance = 22;
  controles.maxDistance = 320; // se ajusta en vistaGeneral() según la pantalla
  controles.minPolarAngle = Math.PI * 0.12; // no mira desde justo arriba
  controles.maxPolarAngle = Math.PI * 0.43; // ni desde el piso
  controles.screenSpacePanning = false; // desplazar mueve sobre el piso
  controles.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  const tween = { activo: false };
  const tmp = new THREE.Vector3();
  const delta = new THREE.Vector3();

  const esquinas = Array.from({ length: 8 }, () => new THREE.Vector3());
  const prueba = new THREE.PerspectiveCamera();

  /**
   * Distancia a la que la caja (rectángulo del piso × alto) cabe completa en pantalla desde el ángulo pedido.
   * Se busca proyectando las 8 esquinas (búsqueda binaria): funciona igual en pantallas anchas y en celulares verticales.
   */
  function distanciaPara(rect, alto, objetivo, azimut = AZIMUT, elevacion = ELEVACION, margen = 0.9) {
    prueba.fov = camara.fov;
    prueba.aspect = lienzo.clientWidth / Math.max(1, lienzo.clientHeight);
    prueba.near = camara.near;
    prueba.far = camara.far;
    prueba.updateProjectionMatrix();
    let i = 0;
    for (const x of [rect.x, rect.x + rect.w]) for (const z of [rect.z, rect.z + rect.d]) for (const y of [0, alto]) esquinas[i++].set(x, y, z);
    let lo = 5;
    let hi = 600;
    for (let paso = 0; paso < 28; paso++) {
      const d = (lo + hi) / 2;
      prueba.position.copy(posicionDesde(objetivo, d, azimut, elevacion));
      prueba.lookAt(objetivo);
      prueba.updateMatrixWorld();
      let max = 0;
      for (const e of esquinas) {
        const p = e.clone().project(prueba);
        max = Math.max(max, Math.abs(p.x), Math.abs(p.y));
      }
      if (max > margen) lo = d;
      else hi = d;
    }
    return hi;
  }

  function posicionDesde(objetivo, distancia, azimut = AZIMUT, elevacion = ELEVACION) {
    return new THREE.Vector3(
      objetivo.x + Math.sin(azimut) * Math.cos(elevacion) * distancia,
      objetivo.y + Math.sin(elevacion) * distancia,
      objetivo.z + Math.cos(azimut) * Math.cos(elevacion) * distancia
    );
  }

  /** Vuelo suave a una posición y objetivo (o salto inmediato). */
  function volar(posicion, objetivo, ms = 700) {
    if (!ms) {
      camara.position.copy(posicion);
      controles.target.copy(objetivo);
      controles.update();
      tween.activo = false;
      return;
    }
    Object.assign(tween, { activo: true, desde: camara.position.clone(), hasta: posicion, tDesde: controles.target.clone(), tHasta: objetivo, ini: performance.now(), ms });
  }

  /** Vista isométrica de toda la oficina. */
  let enGeneral = false; // si la cámara sigue en la vista general, se reencuadra al cambiar el tamaño de la pantalla
  function vistaGeneral(ms = 700) {
    enGeneral = true;
    const rect = { x: LIMITES.x0 - 1, z: LIMITES.z0 - 1, w: LIMITES.x1 - LIMITES.x0 + 2, d: LIMITES.z1 - LIMITES.z0 + 2 };
    const d = distanciaPara(rect, 10, CENTRO);
    // en un celular vertical hace falta alejarse más: el límite de alejamiento acompaña a la vista general
    controles.maxDistance = Math.max(160, d * 1.35);
    volar(posicionDesde(CENTRO, d), CENTRO.clone(), ms);
  }

  /** Enfoca una sala (usa su centro y su tamaño). Pensado para futuras ampliaciones (selección de salas). */
  function enfocar(sala, ms = 700) {
    enGeneral = false;
    const { centro, rect } = sala.userData;
    const objetivo = centro.clone().setY(2);
    const d = Math.max(controles.minDistance, distanciaPara(rect, 6, objetivo, AZIMUT, ELEVACION, 0.95));
    volar(posicionDesde(objetivo, d), objetivo, ms);
  }

  /** Avanza el vuelo y mantiene el objetivo dentro de la oficina. Devuelve true si la cámara cambió. */
  function actualizar(ahora) {
    let cambio = false;
    if (tween.activo) {
      const k = Math.min(1, (ahora - tween.ini) / tween.ms);
      const e = k * k * (3 - 2 * k);
      camara.position.lerpVectors(tween.desde, tween.hasta, e);
      controles.target.lerpVectors(tween.tDesde, tween.tHasta, e);
      if (k >= 1) tween.activo = false;
      cambio = true;
    }
    // límite del desplazamiento: el objetivo no sale del contorno de la oficina (con un margen)
    const t = controles.target;
    tmp.set(THREE.MathUtils.clamp(t.x, LIMITES.x0 - 4, LIMITES.x1 + 4), THREE.MathUtils.clamp(t.y, 0, 8), THREE.MathUtils.clamp(t.z, LIMITES.z0 - 4, LIMITES.z1 + 4));
    if (!tmp.equals(t)) {
      camara.position.add(delta.subVectors(tmp, t));
      t.copy(tmp);
      cambio = true;
    }
    if (controles.update()) cambio = true;
    return cambio;
  }

  // cualquier gesto del usuario cancela el vuelo automático
  const cancelar = () => {
    tween.activo = false;
    enGeneral = false;
  };
  lienzo.addEventListener('pointerdown', cancelar);
  lienzo.addEventListener('wheel', cancelar, { passive: true });

  /** Al girar el celular o cambiar el tamaño de la ventana: reencuadra si nadie movió la cámara. */
  function alRedimensionar() {
    if (enGeneral && !tween.activo) vistaGeneral(0);
  }

  return { camara, controles, vistaGeneral, enfocar, actualizar, volar, posicionDesde, tween, alRedimensionar };
}
