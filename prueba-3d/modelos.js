// Registro de modelos. ARQUITECTURA PARA EL FUTURO: la escena nunca construye personajes u objetos directamente;
// los pide por nombre con `crearModelo(nombre, opciones)`. Hoy cada nombre apunta a una fábrica provisional hecha por código.
// Más adelante, `registrarModelo('minifigura', miFabricaQueCargaUnGLB)` sustituye al provisional sin tocar la escena.
//
// Contrato de un modelo:
//   objeto                      THREE.Object3D que se agrega a la escena
//   animar(estado, t, dt)       avanza la animación; devuelve true cuando termina una animación de una sola vez (saludo)
//   mirarA(Vector3 | null)      punto del mundo al que el personaje dirige la mirada (opcional)
//   reposo()                    lleva el personaje a la postura de reposo sin transición
//   manoDer                     Object3D de la mano derecha (para acercar la cámara en las pruebas)
//   diagnostico()               ángulos reales de cuerpo y cabeza (solo para pruebas)
// Estados: los de la app (idle | thinking | searching | talking | walking) más dos de prueba (saludo | escucha).
//
// CONVENCIÓN DE EJES (válida para todo el archivo): el FRENTE del personaje es +z, su derecha es +x y arriba es +y.
// El cuerpo se orienta girando `objeto.rotation.y`; la cabeza solo gira respecto al cuerpo (yaw 0 = mira al frente).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { plastico, PALETA } from './materiales.js';
import { crearCara, expresionBase } from './cara.js';

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
// Una sola pieza: perfil de "C" (anillo con pared delgada y los dos extremos redondeados) extruido en vertical.
// Medidas en unidades de taquito: radio medio .21, pared .12, alto .36 (más pequeña que la manga, que mide .56 de ancho).
// El eje de la C es vertical cuando el brazo cuelga; la abertura (~100°) mira al frente (+z) y un poco hacia afuera.
const manos = new Map();
function geometriaMano(lado) {
  if (manos.has(lado)) return manos.get(lado);
  const Rm = 0.215; // radio medio
  const w = 0.065; // medio grosor de la pared
  const alto = 0.36;
  const bisel = 0.025;
  const centro = -Math.PI / 2 + lado * 0.38; // dirección de la abertura en el plano de la forma: -y de la forma = +z del mundo tras acostarla, y un poco hacia afuera
  const medio = 0.88; // semi-apertura (~50°)
  const a0 = centro + medio; // extremo "inicial" de la C
  const a1 = centro - medio + Math.PI * 2; // extremo "final" (se recorre la C por el lado largo)
  const punto = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
  const forma = new THREE.Shape();
  const [sx, sy] = punto(a0, Rm + w);
  forma.moveTo(sx, sy);
  forma.absarc(0, 0, Rm + w, a0, a1, false); // borde exterior
  const [c1x, c1y] = punto(a1, Rm);
  forma.absarc(c1x, c1y, w, a1, a1 + Math.PI, false); // extremo redondeado
  forma.absarc(0, 0, Rm - w, a1, a0, true); // borde interior de vuelta
  const [c0x, c0y] = punto(a0, Rm);
  forma.absarc(c0x, c0y, w, a0 + Math.PI, a0 + Math.PI * 2, false); // otro extremo redondeado
  let g = new THREE.ExtrudeGeometry(forma, { depth: alto - bisel * 2, bevelEnabled: true, bevelThickness: bisel, bevelSize: bisel * 0.8, bevelSegments: 2, curveSegments: 14, steps: 1 });
  // la forma está en el plano XY y se extruye en z: se acuesta para que el eje de la C quede vertical (y) y la abertura mire a +z
  g.rotateX(-Math.PI / 2);
  g.translate(0, -(alto - bisel * 2) / 2, 0);
  g = toCreasedNormals(g, 0.75); // suave en las curvas, con filo en las aristas
  manos.set(lado, g);
  return g;
}

// Límites anatómicos (radianes) de cada articulación: nada se dobla más de lo que permite una minifigura real.
const LIM = {
  cabY: [-0.9, 0.9], cabX: [-0.35, 0.45], cabZ: [-0.3, 0.3],
  torY: [-0.35, 0.35], torX: [-0.15, 0.2], torZ: [-0.12, 0.12],
  brazoX: [-2.6, 0.9], brazoAbd: [-0.05, 2.7],
  muneca: [-0.6, 0.6], giro: [-0.9, 0.9],
  pierna: [-0.6, 0.6],
};
const BASE_X = expresionBase();
const CAMPOS = ['cabY', 'cabX', 'cabZ', 'torY', 'torX', 'torZ', 'bIx', 'bIa', 'bDx', 'bDa', 'mI', 'mD', 'rD', 'pI', 'pD', 'alto'];
// Rapidez relativa de cada grupo: la cabeza y las muñecas reaccionan primero, el torso y los hombros después.
// Ese desfase hace que un gesto "se propague" (cabeza → torso → brazos → manos) en vez de moverse todo a la vez.
const RAPIDEZ = { cabY: 1.3, cabX: 1.3, cabZ: 1.1, torY: 0.8, torX: 0.8, torZ: 0.7, bIx: 0.9, bIa: 0.9, bDx: 0.9, bDa: 0.9, mI: 1.5, mD: 1.5, rD: 1.6, pI: 1.0, pD: 1.0, alto: 2 };

// Gestos de las manos al hablar: cada uno es una postura de brazos con intención. Se encadenan en un orden propio de cada personaje.
const GESTOS = [
  { bDx: -0.7, bDa: 0.6, bIx: -0.6, bIa: 0.55 }, // abre las manos
  { bDx: -1.1, bDa: 0.2, bIx: -0.15, bIa: 0.1 }, // levanta una idea
  { bDx: -0.9, bDa: 0.3, bIx: -0.5, bIa: 0.3 }, // enfatiza con las dos
  { bDx: -0.8, bDa: 0.45, bIx: 0.0, bIa: 0.07 }, // solo la derecha
  { bDx: -0.3, bDa: 0.15, bIx: -0.85, bIa: 0.4 }, // solo la izquierda
];
// Puntos a los que echa un vistazo en reposo (yaw, pitch). Ninguno es 0: el "frente" es la postura base.
const VISTAZOS = [[-0.5, 0.05], [0.5, -0.02], [0.32, 0.1], [-0.32, -0.1], [0.62, 0.04]];

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
    hombro.add(malla(new THREE.CylinderGeometry(0.11, 0.11, 0.26, 14), mPiel, 0, -1.55, 0)); // muñeca (pasador)
    const muneca = grupo(0, -1.66, 0);
    muneca.add(malla(geometriaMano(lado), mPiel, 0, -0.17, 0)); // la mano cuelga justo debajo del pasador
    hombro.add(muneca);
    return { hombro, muneca };
  };
  const bI = brazo(-1);
  const bD = brazo(1);

  // cabeza: cilindro con taquito, cara con textura intercambiable y gorra opcional
  const cabeza = grupo(0, 1.76, 0);
  cabeza.add(malla(new THREE.CylinderGeometry(0.72, 0.72, 0.95, 40), mPiel, 0, 0.48, 0));
  cabeza.add(malla(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 24), mPiel, 0, 1.05, 0));
  // cara estampada (ver cara.js): lámina curva centrada en el FRENTE (+z) con la expresión redibujada de forma continua
  const rostro = crearCara(0.72, 0.95);
  const cara = rostro.malla;
  cara.position.y = 0.48;
  cabeza.add(cara);
  if (gorra) {
    const mG = plastico(gorra);
    cabeza.add(malla(new THREE.SphereGeometry(0.78, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mG, 0, 0.86, 0));
    cabeza.add(malla(caja(1.0, 0.1, 0.8, 0.04), mG, 0, 0.93, 0.86)); // visera al frente (+z), alta para dejar ver las cejas
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
    pausaMirada: 3.2 + rnd() * 2.2, // cada cuánto echa un vistazo en reposo
    orden: GESTOS.map((_, i) => [rnd(), i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]), // orden propio de gestos
  };

  // ----- estado de la animación (objetos reutilizados: nada se crea en cada cuadro) -----
  const P = {}; // postura actual (ya suavizada)
  const VEL = {}; // velocidad de cada articulación (para arrancar y frenar con suavidad)
  const T = {}; // postura deseada
  const rap = { mI: 0, mD: 0 }; // movimientos finos y rápidos (tecleo) que se suman después de suavizar
  const salida = { k: 7 };
  const X = expresionBase(); // expresión deseada
  const E = expresionBase(); // expresión actual (se acerca a X de forma continua)
  for (const c of CAMPOS) P[c] = VEL[c] = T[c] = 0;
  const mirada = { fase: 'frente', yaw: 0, pitch: 0, hasta: 1.5 };
  let ultimoVistazo = -1;
  let blanco = null; // punto del mundo al que mira (opcional)
  let estadoAnt = null;
  let t0 = 0;
  let terminado = false;
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();

  const mirarA = (p) => {
    blanco = p ? (blanco || new THREE.Vector3()).copy(p) : null;
  };

  /** Yaw y pitch de cabeza necesarios para mirar al punto del mundo, relativos al cuerpo (yaw 0 = al frente). */
  const haciaBlanco = (out) => {
    cabeza.getWorldPosition(va);
    va.y += 0.48;
    raiz.worldToLocal(va);
    vb.copy(blanco);
    raiz.worldToLocal(vb).sub(va);
    out[0] = limitar(Math.atan2(vb.x, vb.z), -0.9, 0.9);
    out[1] = limitar(-Math.atan2(vb.y, Math.hypot(vb.x, vb.z)), -0.3, 0.3);
  };
  const angulos = [0, 0];

  /** Postura deseada (T) y movimientos finos (rap) para el estado actual. */
  function objetivo(estado, t, tt) {
    for (const c of CAMPOS) T[c] = 0;
    T.bIa = 0.07;
    T.bDa = 0.07;
    rap.mI = rap.mD = 0;
    Object.assign(X, BASE_X);
    const f = v.ritmo;
    const ph = v.fase;
    let k = 7; // rapidez general con la que la postura alcanza el objetivo

    switch (estado) {
      case 'thinking': {
        // teclea mirando la pantalla; cada tanto levanta la vista un momento (piensa) y vuelve a teclear
        const ciclo = (t * 0.13 * f + ph / 6.2832) % 1;
        const pausa = ciclo > 0.8 ? suave(Math.min(1, (ciclo - 0.8) / 0.05)) * (1 - suave(Math.max(0, (ciclo - 0.95) / 0.05))) : 0;
        T.bIx = -1.12 + 0.12 * pausa;
        T.bDx = -1.12 + 0.12 * pausa;
        T.bIa = 0.12;
        T.bDa = 0.12;
        T.mI = -0.22;
        T.mD = -0.22;
        T.cabX = 0.16 - 0.32 * pausa;
        T.cabY = 0.12 * Math.sin(t * 0.55 * f + ph) + 0.3 * pausa;
        T.torX = 0.05 - 0.04 * pausa;
        T.torY = T.cabY * 0.3;
        // expresión: concentrado (cejas algo bajas y juntas, una un poco más alta), sonrisa mínima; al levantar la vista, ceja arriba
        X.sonrisa = 0.15;
        X.cejaIh = -0.2 + 0.5 * pausa;
        X.cejaIt = 0.5 * (1 - pausa);
        X.cejaDh = 0.1 + 0.6 * pausa;
        X.cejaDt = 0.2 * (1 - pausa);
        X.ojo = 0.9;
        X.miraY = 0.6 - 1.4 * pausa; // mira la pantalla (abajo) y, al pensar, hacia arriba
        X.miraX = 0.4 * pausa;
        const teclea = 1 - pausa;
        rap.mI = 0.1 * Math.sin(t * 28 * f) * teclea;
        rap.mD = 0.1 * Math.sin(t * 28 * f + 2.1) * teclea;
        break;
      }
      case 'searching': // recorre varias pantallas con la mirada y señala con una mano
        T.bIx = -0.5;
        T.bDx = -1.2 + 0.1 * Math.sin(t * 1.4 * f);
        T.bDa = 0.15;
        T.mD = -0.2;
        T.cabX = 0.1;
        T.cabY = 0.5 * Math.sin(t * 0.7 * f + ph);
        T.torY = T.cabY * 0.35; // el torso acompaña a la cabeza, con menos recorrido
        T.torZ = 0.03 * Math.sin(t * 0.7 * f + ph);
        X.ojo = 0.85; // entrecierra un poco los ojos para enfocar
        X.cejaIh = -0.1;
        X.cejaDh = -0.1;
        X.cejaIt = 0.25;
        X.cejaDt = 0.25;
        X.sonrisa = 0.2;
        break;
      case 'talking': {
        // Habla a "golpes" (beats): en cada uno la cabeza asiente, un instante después el brazo marca el acento.
        // Cada dos golpes cambia el gesto de las manos, en el orden propio del personaje.
        const periodo = 1.2 / f;
        const p = t / periodo + ph / 6.2832;
        const idx = Math.floor(p);
        const u = p - idx;
        const cabeceo = Math.exp(-(((u - 0.2) / 0.16) ** 2));
        const acento = Math.exp(-(((u - 0.38) / 0.2) ** 2));
        const g = GESTOS[v.orden[Math.floor(idx / 2) % GESTOS.length]];
        T.bDx = g.bDx - 0.22 * acento * v.amp;
        T.bDa = g.bDa + 0.08 * acento * v.amp;
        T.bIx = g.bIx - 0.12 * acento * v.amp;
        T.bIa = g.bIa;
        T.mD = 0.28 * acento - 0.05;
        T.mI = 0.12 * acento;
        T.cabX = -0.02 + 0.1 * cabeceo;
        T.cabY = 0.1 * Math.sin(p * 0.37);
        T.cabZ = 0.05 * Math.sin(p * 0.23 + 1);
        T.torX = 0.03 + 0.04 * cabeceo;
        T.torY = T.cabY * 0.45;
        T.torZ = 0.025 * Math.sin(p * 0.37);
        // la boca sigue un patrón de sílabas (rápido) modulado por frases (lento); nunca llega a abrirse del todo
        X.boca = Math.max(0, Math.sin(t * 5.3 * f + ph) * (0.5 + 0.5 * Math.sin(t * 1.3 + 0.7))) * 0.85;
        X.sonrisa = 0.5;
        X.cejaIh = 0.1 + 0.35 * acento;
        X.cejaDh = 0.1 + 0.35 * acento;
        break;
      }
      case 'walking': {
        const w = t * 7.2 * f;
        const s = Math.sin(w);
        T.bIx = s * 0.6;
        T.bDx = -s * 0.6;
        T.pI = -s * 0.45;
        T.pD = s * 0.45;
        T.torY = s * 0.08; // el torso gira contra las piernas
        T.cabY = -s * 0.04; // y la cabeza compensa para mirar al frente
        T.torZ = 0.035 * Math.sin(w * 0.5);
        T.alto = (1 - Math.cos(2 * w)) * 0.035;
        k = 9;
        break;
      }
      case 'saludo': {
        // 0–0.6 s sube el brazo, hasta 3.7 s saluda moviendo la mano, después baja
        let arriba;
        if (tt < 0.6) arriba = suave(tt / 0.6);
        else if (tt < 3.7) arriba = 1;
        else arriba = 1 - suave(Math.min(1, (tt - 3.7) / 0.6));
        T.bDa = 0.07 + (2.35 - 0.07) * arriba;
        T.bDx = -0.15 * arriba;
        const onda = Math.sin((tt - 0.6) * Math.PI * 2 * 2.1);
        const m = tt > 0.6 && tt < 3.7 ? 1 : 0;
        T.rD = 0.5 * onda * m;
        T.bDa += 0.1 * onda * m;
        T.cabY = 0.2 * arriba; // gira un poco hacia quien saluda y vuelve al frente al bajar el brazo
        T.cabZ = 0.07 * arriba;
        T.torZ = -0.05 * arriba; // se inclina levemente para compensar el peso del brazo
        T.torY = 0.06 * arriba;
        X.sonrisa = 0.7 + 0.35 * arriba; // sonrisa amplia
        X.cejaIh = 0.45 * arriba;
        X.cejaDh = 0.45 * arriba;
        X.ojo = 1 - 0.12 * arriba; // ojos levemente alegres
        X.boca = arriba > 0.9 && onda > 0.5 ? 0.35 : 0;
        X.miraX = 0;
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
        X.ojo = 1.08; // atento: ojos un poco más abiertos y cejas arriba
        X.cejaIh = 0.4;
        X.cejaDh = 0.55;
        X.cejaIt = -0.15;
        X.cejaDt = -0.2;
        X.sonrisa = 0.35;
        T.torZ = 0.02;
        T.bDx = -0.12;
        T.bDa = 0.1;
        k = 5;
        break;
      }
      default: {
        // Reposo: mira al FRENTE. De vez en cuando echa un vistazo corto a un lado y vuelve al frente.
        if (mirada.fase === 'frente' && t >= mirada.hasta) {
          let i;
          do i = Math.floor(rnd() * VISTAZOS.length);
          while (i === ultimoVistazo);
          ultimoVistazo = i;
          mirada.fase = 'lado';
          mirada.yaw = VISTAZOS[i][0];
          mirada.pitch = VISTAZOS[i][1];
          mirada.hasta = t + 1.1 + rnd() * 1.1;
        } else if (mirada.fase === 'lado' && t >= mirada.hasta) {
          mirada.fase = 'frente';
          mirada.yaw = mirada.pitch = 0;
          mirada.hasta = t + v.pausaMirada + rnd() * 3;
        }
        const desc = Math.sin(t * 0.13 * f + ph); // cambio de peso lento de una pierna a otra
        T.cabY = mirada.yaw;
        T.cabX = mirada.pitch;
        T.torY = mirada.yaw * 0.25;
        T.torZ = 0.03 * desc;
        T.cabZ = -0.02 * desc;
        T.bIx = 0.04 * Math.sin(t * v.respira * 6.2832 + ph);
        T.bDx = -0.04 * Math.sin(t * v.respira * 6.2832 + ph);
        T.bIa = 0.07 + 0.015 * desc;
        T.bDa = 0.07 - 0.015 * desc;
        k = 4.5;
      }
    }
    salida.k = k;
  }

  function aplicar(t) {
    // respiración: el pecho se ensancha un poco y la cabeza sube unos milímetros
    const r = Math.sin(t * v.respira * 6.2832 + v.fase);
    pecho.scale.set(1 + r * 0.008, 1 + r * 0.014, 1 + r * 0.008);
    cabeza.position.y = 1.76 + r * 0.02;
    cuerpo.position.y = P.alto;
    torso.rotation.set(limitar(P.torX, ...LIM.torX), limitar(P.torY, ...LIM.torY), limitar(P.torZ, ...LIM.torZ));
    cabeza.rotation.set(limitar(P.cabX, ...LIM.cabX), limitar(P.cabY, ...LIM.cabY), limitar(P.cabZ, ...LIM.cabZ));
    // hombro izquierdo: abducir = alejar del cuerpo (x negativo)
    bI.hombro.rotation.set(limitar(P.bIx, ...LIM.brazoX), 0, -limitar(P.bIa, ...LIM.brazoAbd));
    bD.hombro.rotation.set(limitar(P.bDx, ...LIM.brazoX), 0, limitar(P.bDa, ...LIM.brazoAbd));
    // las manos se "arrastran" un poco detrás del brazo (movimiento secundario): se doblan en contra de su velocidad
    const arrI = limitar(-VEL.bIx * 0.06, -0.15, 0.15);
    const arrD = limitar(-VEL.bDx * 0.06, -0.15, 0.15);
    bI.muneca.rotation.set(limitar(P.mI + rap.mI + arrI, ...LIM.muneca), 0, 0);
    bD.muneca.rotation.set(limitar(P.mD + rap.mD + arrD, ...LIM.muneca), limitar(P.rD, ...LIM.giro), 0);
    piernaI.rotation.x = limitar(P.pI, ...LIM.pierna);
    piernaD.rotation.x = limitar(P.pD, ...LIM.pierna);
    // cara: parpadeo discreto (cierra y abre en ~0.18 s, solo los ojos) y la expresión continua
    const ciclo = t % v.parpadeo;
    const ini = v.parpadeo - 0.18;
    const parpadeo = ciclo > ini ? Math.sin(((ciclo - ini) / 0.18) * Math.PI) : 0;
    rostro.actualizar(E, parpadeo);
  }

  function animar(estado, t, dt) {
    if (estado !== estadoAnt) {
      estadoAnt = estado;
      t0 = t;
      terminado = false;
      mirada.fase = 'frente'; // al volver al reposo siempre se arranca mirando al frente
      mirada.yaw = mirada.pitch = 0;
      mirada.hasta = t + 1.2;
    }
    const tt = t - t0;
    objetivo(estado, t, tt);
    // mirada dirigida a un punto del mundo (hablar y escuchar); en el saludo solo se suma un giro suave
    if (blanco && (estado === 'talking' || estado === 'escucha')) {
      haciaBlanco(angulos);
      T.cabY = angulos[0];
      T.cabX += angulos[1];
      T.torY += angulos[0] * 0.15;
    }
    // transición suave hacia la postura deseada: amortiguación crítica (arranca despacio, acelera y frena sin rebotes)
    const k = salida.k;
    for (const c of CAMPOS) {
      const om = k * RAPIDEZ[c] * 0.6;
      const x = om * dt;
      const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
      const cambio = P[c] - T[c];
      const tmp = (VEL[c] + om * cambio) * dt;
      VEL[c] = (VEL[c] - om * tmp) * e;
      P[c] = T[c] + (cambio + tmp) * e;
    }
    // la mirada se adelanta a la cabeza: los ojos van primero hacia el punto de interés y la cabeza los alcanza
    X.miraX += limitar((T.cabY - P.cabY) * 1.1, -0.9, 0.9);
    X.miraY += limitar((T.cabX - P.cabX) * 1.1, -0.6, 0.6);
    X.miraX = limitar(X.miraX, -1, 1);
    X.miraY = limitar(X.miraY, -1, 1);
    // expresión: mezcla continua hacia la deseada (la boca responde más rápido que las cejas)
    for (const c in X) {
      const r = c === 'boca' ? 24 : c.startsWith('mira') ? 14 : 8;
      E[c] += (X[c] - E[c]) * (1 - Math.exp(-dt * r));
    }
    aplicar(t);
    if (estado === 'saludo' && tt >= DURACION.saludo && !terminado) {
      terminado = true;
      return true;
    }
    return false;
  }

  function reposo() {
    for (const c of CAMPOS) P[c] = VEL[c] = T[c] = 0;
    P.bIa = P.bDa = 0.07;
    rap.mI = rap.mD = 0;
    Object.assign(X, BASE_X);
    Object.assign(E, BASE_X);
    aplicar(0);
  }
  reposo();

  /** Ángulos reales (grados) para comprobar la orientación: cuerpo, cabeza y dirección a la que apunta la cara. */
  function diagnostico() {
    raiz.updateMatrixWorld(true);
    cara.geometry.computeBoundingBox();
    const centro = cara.geometry.boundingBox.getCenter(new THREE.Vector3());
    const cw = cara.localToWorld(centro);
    const hw = cabeza.getWorldPosition(new THREE.Vector3());
    hw.y = cw.y;
    const dir = cw.sub(hw);
    const frente = new THREE.Vector3(0, 0, 1).transformDirection(raiz.matrixWorld);
    const deg = (a) => (a * 180) / Math.PI;
    return {
      cuerpo: deg(Math.atan2(frente.x, frente.z)),
      cara: deg(Math.atan2(dir.x, dir.z)),
      cabezaRelativa: deg(cabeza.rotation.y),
      caraRelativaAlCuerpo: deg(Math.atan2(dir.x, dir.z) - Math.atan2(frente.x, frente.z)),
    };
  }

  return { objeto: raiz, animar, reposo, mirarA, manoDer: bD.muneca, diagnostico, expresion: () => ({ ...E }) };
}

registrarModelo('minifigura', minifigura);
