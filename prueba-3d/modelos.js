// Registro de modelos. ARQUITECTURA PARA EL FUTURO: la escena nunca construye personajes u objetos directamente;
// los pide por nombre con `crearModelo(nombre, opciones)`. Hoy cada nombre apunta a una fábrica provisional hecha por código.
// Más adelante, `registrarModelo('minifigura', miFabricaQueCargaUnGLB)` sustituye al provisional sin tocar la escena.
//
// Contrato de un modelo: { objeto: THREE.Object3D, animar(estado, tiempo, dt) }
// Los estados son los mismos que ya existen en la app: idle | thinking | searching | meeting | talking | walking.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { plastico, PALETA } from './materiales.js';

const fabricas = new Map();
export const registrarModelo = (nombre, fabrica) => fabricas.set(nombre, fabrica);
export function crearModelo(nombre, opciones = {}) {
  const f = fabricas.get(nombre);
  if (!f) throw new Error(`No hay modelo registrado con el nombre "${nombre}"`);
  return f(opciones);
}

const caja = (w, h, d, r = 0.05) => new RoundedBoxGeometry(w, h, d, 3, r);
const malla = (geo, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

function texturaCara() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#1d2433';
  g.beginPath();
  g.ellipse(88, 52, 9, 13, 0, 0, Math.PI * 2);
  g.ellipse(168, 52, 9, 13, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#6b3a2a';
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(128, 74, 30, 0.25 * Math.PI, 0.75 * Math.PI);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Minifigura provisional: cabeza cilíndrica con taquito, torso, caderas, piernas, brazos y manos en C. */
function minifigura({ camisa = PALETA.naranja, piel = '#f5cd30', pantalon = '#3b4252', gorra = null } = {}) {
  const raiz = new THREE.Group();
  const cuerpo = new THREE.Group();
  raiz.add(cuerpo);
  const mPiel = plastico(piel);
  const mCamisa = plastico(camisa);
  const mPant = plastico(pantalon);

  // piernas y cadera
  const piernaIzq = malla(caja(0.98, 1.5, 1.0, 0.06), mPant, -0.5, 0.75, 0);
  const piernaDer = malla(caja(0.98, 1.5, 1.0, 0.06), mPant, 0.5, 0.75, 0);
  const cadera = malla(caja(2.0, 0.34, 1.05, 0.06), mPant, 0, 1.67, 0);
  // torso
  const torso = malla(caja(2.0, 1.75, 1.05, 0.12), mCamisa, 0, 2.7, 0);
  // brazos con manos en C
  const brazo = (lado) => {
    const g = new THREE.Group();
    g.position.set(lado * 1.28, 3.35, 0);
    g.add(malla(caja(0.56, 1.5, 0.62, 0.1), mCamisa, 0, -0.7, 0));
    const mano = malla(new THREE.TorusGeometry(0.27, 0.12, 10, 18, Math.PI * 1.55), mPiel, 0, -1.62, 0.02);
    mano.rotation.set(Math.PI / 2, 0, lado > 0 ? 0.2 : Math.PI - 0.2);
    g.add(mano);
    return g;
  };
  const brazoIzq = brazo(-1);
  const brazoDer = brazo(1);
  // cuello, cabeza y taquito
  const cabeza = new THREE.Group();
  cabeza.position.set(0, 3.6, 0);
  cabeza.add(malla(new THREE.CylinderGeometry(0.72, 0.72, 0.95, 40), mPiel, 0, 0.48, 0));
  cabeza.add(malla(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 24), mPiel, 0, 1.05, 0));
  const cara = new THREE.Mesh(
    new THREE.CylinderGeometry(0.725, 0.725, 0.95, 40, 1, true, -Math.PI / 2 - 0.62, 1.24),
    new THREE.MeshBasicMaterial({ map: texturaCara(), transparent: true })
  );
  cara.position.y = 0.48;
  cara.rotation.y = 0; // el frente del personaje mira a +z
  cabeza.add(cara);
  if (gorra) {
    const mG = plastico(gorra);
    cabeza.add(malla(new THREE.SphereGeometry(0.78, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mG, 0, 0.72, 0));
    cabeza.add(malla(caja(1.0, 0.1, 0.8, 0.04), mG, 0, 0.78, 0.86));
  }
  cuerpo.add(piernaIzq, piernaDer, cadera, torso, brazoIzq, brazoDer, cabeza);

  const animar = (estado, t) => {
    const respira = Math.sin(t * 1.6) * 0.02;
    cuerpo.position.y = respira;
    brazoIzq.rotation.x = 0;
    brazoDer.rotation.x = 0;
    cabeza.rotation.set(0, 0, 0);
    switch (estado) {
      case 'thinking': // teclea: los dos brazos al frente, cabeza ligeramente gacha
      case 'searching':
        brazoIzq.rotation.x = -1.2 + Math.sin(t * 14) * 0.12;
        brazoDer.rotation.x = -1.2 + Math.sin(t * 14 + 1.6) * 0.12;
        cabeza.rotation.x = 0.12;
        break;
      case 'talking':
        brazoDer.rotation.x = -0.9 + Math.sin(t * 5) * 0.35;
        cabeza.rotation.y = Math.sin(t * 2.4) * 0.15;
        break;
      case 'walking':
        brazoIzq.rotation.x = Math.sin(t * 8) * 0.6;
        brazoDer.rotation.x = -Math.sin(t * 8) * 0.6;
        piernaIzq.rotation.x = -Math.sin(t * 8) * 0.4;
        piernaDer.rotation.x = Math.sin(t * 8) * 0.4;
        break;
      default:
        cabeza.rotation.y = Math.sin(t * 0.7) * 0.2;
    }
    if (estado !== 'walking') piernaIzq.rotation.x = piernaDer.rotation.x = 0;
  };
  return { objeto: raiz, animar };
}

registrarModelo('minifigura', minifigura);
