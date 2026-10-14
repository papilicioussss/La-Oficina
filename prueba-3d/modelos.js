// Registro de modelos. ARQUITECTURA PARA EL FUTURO: la escena nunca construye personajes u objetos directamente;
// los pide por nombre con `crearModelo(nombre, opciones)`. Hoy cada nombre apunta a una fábrica provisional hecha por código.
// Más adelante, `registrarModelo('minifigura', miFabricaQueCargaUnGLB)` sustituye al provisional sin tocar la escena.
//
// Contrato de un modelo:
//   objeto                      THREE.Object3D que se agrega a la escena
//   animar(estado, t, dt)       avanza la animación; devuelve true cuando termina una animación de una sola vez (saludo)
//   mirarA(Vector3 | null)      punto del mundo al que el personaje dirige la mirada (opcional)
//   reposo()                    lleva el personaje a la postura de reposo sin transición (movimiento reducido)
//   manoDer                     Object3D de la mano derecha (para acercar la cámara en las pruebas)
// Estados: los de la app (idle | thinking | searching | talking | walking) más dos de prueba (saludo | escucha).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { plastico, PALETA } from './materiales.js';

const fabricas = new Map();
export const registrarModelo = (nombre, fabrica) => fabricas.set(nombre, fabrica);
export function crearModelo(nombre, opciones = {}) {
  const f = fabricas.get(nombre);
  if (!f) throw new Error(`No hay modelo registrado con el nombre "${nombre}"`);
  return f(opciones);
}

/** Duración (segundos) de las animaciones que se reproducen una sola vez. */
export const DURACION = { saludo: 4.4 };

const caja = (w, h, d, r = 0.05) => new RoundedBoxGeometry(w, h, d, 3, r);
const malla = (geo, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const grupo = (x = 0, y = 0, z = 0) => {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  return g;
};
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const suave = (x) => x * x * (3 - 2 * x);

// Generador pseudoaleatorio con semilla: cada personaje tiene su propio ritmo, pero siempre el mismo (nada de azar real).
function semilla(n) {
  let a = (n * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Mano LEGO en forma de C ----------
// Un anillo (radio exterior .36, interior .2, alto .44) con una abertura de ~75° que mira hacia adelante y un poco hacia afuera.
// El eje de la C es vertical cuando el brazo cuelga; los bordes llevan bisel y las normales son suaves en las curvas.
const manos = new Map();
function geometriaMano(lado) {
  if (manos.has(lado)) return manos.get(lado);
  const Ro = 0.36;
  const Ri = 0.2;
  const alto = 0.44;
  const centro = -Math.PI / 2 + lado * 0.6; // abertura al frente (+z), inclinada hacia afuera
  const medio = 0.65;
  const a0 = centro + medio;
  const a1 = centro - medio + Math.PI * 2;
  const forma = new THREE.Shape();
  forma.absarc(0, 0, Ro, a0, a1, false);
  forma.lineTo(Math.cos(a1) * Ri, Math.sin(a1) * Ri);
  forma.absarc(0, 0, Ri, a1, a0, true);
  forma.closePath();
  let g = new THREE.ExtrudeGeometry(forma, { depth: alto - 0.07, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 2, curveSegments: 16, steps: 1 });
  g.rotateX(-Math.PI / 2); // la extrusión pasa a ser el eje vertical y la abertura mira a +z
  g.translate(0, -(alto - 0.07) / 2, 0);
  g = toCreasedNormals(g, 0.7); // suave en las curvas, filo en las aristas
  manos.set(lado, g);
  return g;
}

// ---------- Cara (cuatro variantes: ojos abiertos/cerrados × boca cerrada/abierta) ----------
const caras = {};
function textura(ojosCerrados, bocaAbierta) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#1d2433';
  g.strokeStyle = '#1d2433';
  g.lineWidth = 6;
  g.lineCap = 'round';
  if (ojosCerrados) {
    g.beginPath();
    g.moveTo(76, 56);
    g.quadraticCurveTo(88, 64, 100, 56);
    g.moveTo(156, 56);
    g.quadraticCurveTo(168, 64, 180, 56);
    g.stroke();
  } else {
    g.beginPath();
    g.ellipse(88, 52, 9, 13, 0, 0, Math.PI * 2);
    g.ellipse(168, 52, 9, 13, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#6b3a2a';
  g.fillStyle = '#6b3a2a';
  g.lineWidth = 7;
  g.beginPath();
  if (bocaAbierta) {
    g.ellipse(128, 82, 17, 13, 0, 0, Math.PI);
    g.fill();
  } else {
    g.arc(128, 74, 30, 0.25 * Math.PI, 0.75 * Math.PI);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function texturaCara(ojosCerrados, bocaAbierta) {
  const k = `${+ojosCerrados}${+bocaAbierta}`;
  return (caras[k] ||= textura(ojosCerrados, bocaAbierta));
}

// Límites anatómicos (radianes) de cada articulación: nada se dobla más de lo que permite una minifigura real.
const LIM = {
  cabY: [-1.0, 1.0], cabX: [-0.35, 0.45], cabZ: [-0.3, 0.3],
  torY: [-0.35, 0.35], torX: [-0.15, 0.2],
  brazoX: [-2.6, 0.9], brazoAbd: [-0.05, 2.7],
  muneca: [-0.6, 0.6], giro: [-0.9, 0.9],
  pierna: [-0.6, 0.6],
};
const CAMPOS = ['cabY', 'cabX', 'cabZ', 'torY', 'torX', 'bIx', 'bIa', 'bDx', 'bDa', 'mI', 'mD', 'rD', 'pI', 'pD', 'alto'];

/** Minifigura provisional: cabeza cilíndrica con taquito, torso, caderas, piernas, brazos rígidos y manos en C. */
function minifigura({ camisa = PALETA.naranja, piel = '#f5cd30', pantalon = '#3b4252', gorra = null, semilla: sem = 1 } = {}) {
  const rnd = semilla(sem);
  const mPiel = plastico(piel);
  const mCamisa = plastico(camisa);
  const mPant = plastico(pantalon);

  // ----- esqueleto: cada articulación es un grupo que gira alrededor de su eje -----
  const raiz = grupo();
  const cuerpo = grupo(); // sube y baja al respirar o caminar
  raiz.add(cuerpo);

  const pierna = (lado) => {
    const g = grupo(lado * 0.5, 1.5, 0);
    g.add(malla(caja(0.98, 1.5, 1.0, 0.06), mPant, 0, -0.75, 0));
    return g;
  };
  const piernaI = pierna(-1);
  const piernaD = pierna(1);
  const cadera = malla(caja(2.0, 0.34, 1.05, 0.06), mPant, 0, 1.67, 0);

  const torso = grupo(0, 1.84, 0); // pivote en la cintura
  const pecho = malla(caja(2.0, 1.75, 1.05, 0.12), mCamisa, 0, 0.88, 0);
  torso.add(pecho);

  // brazo rígido (las minifiguras no doblan el codo): gira solo en el hombro. La muñeca es un pasador y la mano gira sobre él.
  const brazo = (lado) => {
    const hombro = grupo(lado * 1.28, 1.51, 0);
    hombro.add(malla(new THREE.SphereGeometry(0.29, 16, 12), mCamisa, 0, -0.04, 0)); // tapa la unión con el torso
    hombro.add(malla(caja(0.56, 1.5, 0.62, 0.1), mCamisa, 0, -0.72, 0));
    hombro.add(malla(new THREE.CylinderGeometry(0.13, 0.13, 0.2, 14), mPiel, 0, -1.5, 0)); // muñeca
    const muneca = grupo(0, -1.66, 0);
    const mano = malla(geometriaMano(lado), mPiel, 0, -0.08, 0);
    muneca.add(mano);
    hombro.add(muneca);
    return { hombro, muneca };
  };
  const bI = brazo(-1);
  const bD = brazo(1);

  // cabeza: cilindro con taquito, cara con textura intercambiable y gorra opcional
  const cabeza = grupo(0, 1.76, 0);
  cabeza.add(malla(new THREE.CylinderGeometry(0.72, 0.72, 0.95, 40), mPiel, 0, 0.48, 0));
  cabeza.add(malla(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 24), mPiel, 0, 1.05, 0));
  const matCara = new THREE.MeshBasicMaterial({ map: texturaCara(false, false), transparent: true });
  const cara = new THREE.Mesh(new THREE.CylinderGeometry(0.725, 0.725, 0.95, 40, 1, true, -Math.PI / 2 - 0.62, 1.24), matCara);
  cara.position.y = 0.48;
  cabeza.add(cara);
  if (gorra) {
    const mG = plastico(gorra);
    cabeza.add(malla(new THREE.SphereGeometry(0.78, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mG, 0, 0.72, 0));
    cabeza.add(malla(caja(1.0, 0.1, 0.8, 0.04), mG, 0, 0.78, 0.86));
  }

  torso.add(cabeza, bI.hombro, bD.hombro);
  cuerpo.add(piernaI, piernaD, cadera, torso);

  // ----- variación propia de este personaje -----
  const v = {
    ritmo: 0.9 + rnd() * 0.25, // velocidad general de sus gestos
    amp: 0.85 + rnd() * 0.3, // qué tan amplios son
    fase: rnd() * Math.PI * 2,
    respira: 0.2 + rnd() * 0.07, // respiraciones por segundo
    parpadeo: 4.2 + rnd() * 2.2, // segundos entre parpadeos
  };

  // ----- estado de la animación -----
  const P = Object.fromEntries(CAMPOS.map((c) => [c, 0])); // postura actual (ya suavizada)
  const VEL = Object.fromEntries(CAMPOS.map((c) => [c, 0])); // velocidad de cada articulación (para arrancar y frenar con suavidad)
  const mirada = { yaw: 0, pitch: 0, hasta: 1.2 + rnd() * 1.5 }; // mirada de reposo: cambia de punto cada pocos segundos
  const PUNTOS = [[-0.5, 0.04], [0.45, -0.02], [0.12, 0.1], [0.0, 0.0], [0.65, 0.06], [-0.28, -0.1]];
  let ultimoPunto = -1;
  let blanco = null; // punto del mundo al que mira (opcional)
  let estadoAnt = null;
  let t0 = 0;
  let terminado = false;
  const v3 = new THREE.Vector3();

  const mirarA = (p) => {
    blanco = p ? p.clone() : null;
  };

  /** Ángulos de cabeza (yaw, pitch) necesarios para mirar al punto del mundo, relativos al cuerpo. */
  function haciaBlanco() {
    cabeza.getWorldPosition(v3);
    const local = raiz.worldToLocal(blanco.clone());
    const d = local.sub(raiz.worldToLocal(v3));
    return [limitar(Math.atan2(d.x, d.z), -0.9, 0.9), limitar(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.3, 0.3)];
  }

  /** Postura deseada y movimientos finos (rápidos) que se suman después de suavizar. */
  function objetivo(estado, t, tt) {
    const T = Object.fromEntries(CAMPOS.map((c) => [c, 0]));
    T.bIa = 0.07;
    T.bDa = 0.07;
    const f = v.ritmo;
    const ph = v.fase;
    const rapido = { mI: 0, mD: 0 };
    let k = 7; // rapidez con la que la postura alcanza el objetivo
    let bocaAbierta = false;

    switch (estado) {
      case 'thinking': // teclea mirando la pantalla, con pequeños vistazos
        T.bIx = -1.12;
        T.bDx = -1.12;
        T.bIa = 0.12;
        T.bDa = 0.12;
        T.mI = -0.22;
        T.mD = -0.22;
        T.cabX = 0.16;
        T.cabY = 0.22 * Math.sin(t * 0.55 * f + ph);
        T.torX = 0.05;
        rapido.mI = 0.1 * Math.sin(t * 28 * f);
        rapido.mD = 0.1 * Math.sin(t * 28 * f + 2.1);
        break;
      case 'searching': // recorre varias pantallas con la mirada y señala con una mano
        T.bIx = -0.5;
        T.bDx = -1.2;
        T.bDa = 0.15;
        T.mD = -0.2;
        T.cabX = 0.1;
        T.cabY = 0.5 * Math.sin(t * 0.7 * f + ph);
        T.torY = 0.12 * Math.sin(t * 0.7 * f + ph);
        T.bDx += 0.1 * Math.sin(t * 1.4 * f);
        break;
      case 'talking': {
        // gestos en ciclos: levantar, abrir, enfatizar. Frecuencias bajas y distintas entre sí para que no se vea mecánico.
        const p = t * 1.7 * f + ph;
        T.bDx = -0.75 + 0.35 * Math.sin(p) + 0.12 * Math.sin(2.3 * p + 1);
        T.bDa = 0.35 + 0.22 * Math.sin(0.7 * p) * v.amp;
        T.mD = 0.3 * Math.sin(1.9 * p);
        T.bIx = -0.25 + 0.2 * Math.sin(p * 0.8 + 1.7);
        T.bIa = 0.18 + 0.1 * Math.sin(p * 0.6);
        T.mI = 0.15 * Math.sin(1.4 * p + 0.8);
        T.cabX = 0.05 * Math.sin(p * 2.2) - 0.02;
        T.cabY = 0.12 * Math.sin(p * 0.5);
        T.torY = 0.06 * Math.sin(p * 0.5 + 0.6);
        T.cabZ = 0.04 * Math.sin(p * 0.9);
        bocaAbierta = Math.sin(t * 5.3 * f + ph) * Math.sin(t * 1.3 + 0.7) > 0.12;
        break;
      }
      case 'walking': {
        const w = t * 7.2 * f;
        T.bIx = Math.sin(w) * 0.6;
        T.bDx = -Math.sin(w) * 0.6;
        T.pI = -Math.sin(w) * 0.45;
        T.pD = Math.sin(w) * 0.45;
        T.torY = Math.sin(w) * 0.07;
        T.cabY = -Math.sin(w) * 0.03;
        T.alto = Math.abs(Math.sin(w)) * 0.07;
        k = 9;
        break;
      }
      case 'saludo': {
        // 0–0.6 s sube el brazo, hasta 3.7 s saluda moviendo la mano, después baja
        let arriba = 0;
        if (tt < 0.6) arriba = suave(tt / 0.6);
        else if (tt < 3.7) arriba = 1;
        else arriba = 1 - suave(Math.min(1, (tt - 3.7) / 0.6));
        T.bDa = 0.07 + (2.35 - 0.07) * arriba;
        T.bDx = -0.15 * arriba;
        const onda = Math.sin((tt - 0.6) * Math.PI * 2 * 2.1);
        const m = tt > 0.6 && tt < 3.7 ? 1 : 0;
        T.rD = 0.5 * onda * m;
        T.bDa += 0.1 * onda * m;
        T.cabY = 0.25 * arriba;
        T.cabZ = 0.07 * arriba;
        T.cabX = -0.04 * arriba;
        bocaAbierta = arriba > 0.9 && onda > 0.6;
        k = 8;
        break;
      }
      case 'escucha': {
        // atento: gira la cabeza hacia quien habla, inclina un poco y asiente de vez en cuando
        const cadaCuanto = 3.4 / f;
        const asiente = Math.max(0, Math.sin((Math.PI * 2 * t) / cadaCuanto + ph)) ** 6 * 0.17;
        T.cabY = 0.3;
        T.cabZ = 0.08;
        T.cabX = 0.03 + asiente;
        T.torX = 0.05;
        T.torY = 0.1;
        T.bDx = -0.12;
        T.bDa = 0.1;
        k = 5;
        break;
      }
      default: {
        // reposo: respira y de vez en cuando mira a otro lado. Si hay un punto de interés, lo mantiene en la mirada.
        if (!blanco && t >= mirada.hasta) {
          let i;
          do i = Math.floor(rnd() * PUNTOS.length);
          while (i === ultimoPunto);
          ultimoPunto = i;
          mirada.yaw = PUNTOS[i][0];
          mirada.pitch = PUNTOS[i][1];
          mirada.hasta = t + 2 + rnd() * 3;
        }
        T.cabY = mirada.yaw;
        T.cabX = mirada.pitch;
        T.torY = mirada.yaw * 0.2;
        T.bIx = 0.04 * Math.sin(t * v.respira * 6.28 + ph);
        T.bDx = -0.04 * Math.sin(t * v.respira * 6.28 + ph);
        k = 4.5;
      }
    }
    return { T, rapido, k, bocaAbierta };
  }

  function aplicar(P2, rapido, t, bocaAbierta) {
    // respiración: el pecho se ensancha un poco y la cabeza sube unos milímetros
    const r = Math.sin(t * v.respira * 6.2832 + v.fase);
    pecho.scale.set(1 + r * 0.008, 1 + r * 0.014, 1 + r * 0.008);
    cabeza.position.y = 1.76 + r * 0.02;
    cuerpo.position.y = P2.alto;
    torso.rotation.set(limitar(P2.torX, ...LIM.torX), limitar(P2.torY, ...LIM.torY), 0);
    cabeza.rotation.set(limitar(P2.cabX, ...LIM.cabX), limitar(P2.cabY, ...LIM.cabY), limitar(P2.cabZ, ...LIM.cabZ));
    // hombro izquierdo: abducir = alejar del cuerpo (x negativo)
    bI.hombro.rotation.set(limitar(P2.bIx, ...LIM.brazoX), 0, -limitar(P2.bIa, ...LIM.brazoAbd));
    bD.hombro.rotation.set(limitar(P2.bDx, ...LIM.brazoX), 0, limitar(P2.bDa, ...LIM.brazoAbd));
    bI.muneca.rotation.set(limitar(P2.mI + rapido.mI, ...LIM.muneca), 0, 0);
    bD.muneca.rotation.set(limitar(P2.mD + rapido.mD, ...LIM.muneca), limitar(P2.rD, ...LIM.giro), 0);
    piernaI.rotation.x = limitar(P2.pI, ...LIM.pierna);
    piernaD.rotation.x = limitar(P2.pD, ...LIM.pierna);
    // cara: parpadeo regular y boca abierta al hablar
    const ciclo = t % v.parpadeo;
    const cerrados = ciclo > v.parpadeo - 0.14;
    const mapa = texturaCara(cerrados, bocaAbierta);
    if (matCara.map !== mapa) matCara.map = mapa;
  }

  function animar(estado, t, dt) {
    if (estado !== estadoAnt) {
      estadoAnt = estado;
      t0 = t;
      terminado = false;
      if (estado === 'idle') mirada.hasta = t + 0.8;
    }
    const tt = t - t0;
    const { T, rapido, k, bocaAbierta } = objetivo(estado, t, tt);
    // mirada dirigida a un punto del mundo (hablar, escuchar o reposo con interés)
    if (blanco && (estado === 'talking' || estado === 'escucha' || estado === 'idle')) {
      const [yaw, pitch] = haciaBlanco();
      T.cabY = estado === 'idle' ? yaw * 0.7 : yaw;
      T.cabX += pitch;
      T.torY += yaw * 0.15;
    }
    // transición suave hacia la postura deseada (la cabeza responde un poco más rápido que el resto)
    for (const c of CAMPOS) {
      const kk = c.startsWith('cab') ? k * 1.2 : c === 'alto' ? k * 2 : k;
      // amortiguación crítica: arranca despacio, acelera y frena sin pasarse (sin rebotes ni saltos de velocidad)
      const om = kk * 0.6;
      const x = om * dt;
      const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
      const cambio = P[c] - T[c];
      const tmp = (VEL[c] + om * cambio) * dt;
      VEL[c] = (VEL[c] - om * tmp) * e;
      P[c] = T[c] + (cambio + tmp) * e;
    }
    aplicar(P, rapido, t, bocaAbierta);
    if (estado === 'saludo' && tt >= DURACION.saludo && !terminado) {
      terminado = true;
      return true;
    }
    return false;
  }

  function reposo() {
    for (const c of CAMPOS) P[c] = VEL[c] = 0;
    P.bIa = P.bDa = 0.07;
    aplicar(P, { mI: 0, mD: 0 }, 0, false);
  }
  reposo();

  return { objeto: raiz, animar, reposo, mirarA, manoDer: bD.muneca };
}

registrarModelo('minifigura', minifigura);
