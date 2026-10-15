// Minifigura de los agentes. Base: la minifigura de prueba-3d/modelos.js (Etapa 1), copiada y ampliada con:
//   - apariencia de la app (camisa, piel, pelo, peinado y kit, como la oficina SVG);
//   - POSTURA SENTADA (las piernas giran 90° en la cadera y el cuerpo se apoya en el asiento), con transición suave;
//   - versión liviana para calidad Media y Baja (mismas formas, colores y accesorios; menos segmentos);
//   - una señal flotante por kit (bombillo, lupa o ✓) que agentes.js muestra solo cuando el estado real lo indica.
//
// Contrato (el mismo de la prueba, más lo nuevo):
//   objeto                       Object3D. Origen en el piso entre los pies; frente = +z.
//   animar(estado, t, dt)        estados: idle | thinking | searching | talking | walking | escucha | terminado
//                                (los de la app y dos de presentación). Devuelve true al acabar una de una sola vez.
//   sentar(si, inmediato)        sienta o levanta al personaje.
//   mirarA(Vector3 | null)       punto del mundo al que dirige la mirada (al hablar y escuchar).
//   reposo()                     postura neutra sin transición.
//   senal                        Object3D de la señal flotante (oculta por defecto).
//   ritmoTecleo                  0..1: 0 = piensa (teclea pausado), 1 = escribe (tecleo rápido, texto llegando).
//   liberar()                    libera geometrías y texturas propias.
//
// Nada se crea en cada cuadro: todos los vectores y objetos de la animación se reutilizan.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { plastico } from '../materiales.js';
import { crearCara, expresionBase } from './cara.js';
import { detalle, peinado, kit } from './accesorios.js';
import { PANTALON } from '../plano.js';
import { registrarModelo } from '../registro.js';
import { fusionar } from '../ladrillos.js';

export const DURACION = { terminado: 1.7 }; // como el gesto "done" del SVG (1,7 s)

// Medidas de la postura sentada: la parte de abajo de las piernas queda sobre el asiento (asiento a 1.7 del piso).
export const ASIENTO = 1.7;
const SUBIR_SENTADO = ASIENTO - (1.5 - 0.5); // el pivote de las piernas está a 1.5; las piernas miden 1.0 de grueso

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const suave = (x) => x * x * (3 - 2 * x);

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

// Mano LEGO en C (copiada de la prueba), con caché por lado y detalle
const manos = new Map();
export { semilla };
function geometriaMano(lado, liviana) {
  const k = `${lado}:${liviana}`;
  if (manos.has(k)) return manos.get(k);
  const Rm = 0.235;
  const w = 0.07;
  const alto = 0.4;
  const bisel = liviana ? 0 : 0.025;
  const centro = -Math.PI / 2 + lado * 0.38;
  const medio = 0.88;
  const a0 = centro + medio;
  const a1 = centro - medio + Math.PI * 2;
  const punto = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
  const forma = new THREE.Shape();
  const [sx, sy] = punto(a0, Rm + w);
  forma.moveTo(sx, sy);
  forma.absarc(0, 0, Rm + w, a0, a1, false);
  const [c1x, c1y] = punto(a1, Rm);
  forma.absarc(c1x, c1y, w, a1, a1 + Math.PI, false);
  forma.absarc(0, 0, Rm - w, a1, a0, true);
  const [c0x, c0y] = punto(a0, Rm);
  forma.absarc(c0x, c0y, w, a0 + Math.PI, a0 + Math.PI * 2, false);
  let g = new THREE.ExtrudeGeometry(forma, { depth: alto - bisel * 2, bevelEnabled: !liviana, bevelThickness: bisel, bevelSize: bisel * 0.8, bevelSegments: 2, curveSegments: liviana ? 6 : 14, steps: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -(alto - bisel * 2) / 2, 0);
  g = toCreasedNormals(g, 0.75);
  g.userData.compartida = true;
  manos.set(k, g);
  return g;
}

const LIM = {
  cabY: [-0.9, 0.9], cabX: [-0.35, 0.45], cabZ: [-0.3, 0.3],
  torY: [-0.35, 0.35], torX: [-0.15, 0.2], torZ: [-0.12, 0.12],
  brazoX: [-2.6, 0.9], brazoAbd: [-0.05, 2.7],
  muneca: [-0.6, 0.6], giro: [-0.9, 0.9],
  pierna: [-0.6, 0.6],
};
const BASE_X = expresionBase();
const CAMPOS = ['cabY', 'cabX', 'cabZ', 'torY', 'torX', 'torZ', 'bIx', 'bIa', 'bDx', 'bDa', 'mI', 'mD', 'rD', 'pI', 'pD', 'alto'];
const RAPIDEZ = { cabY: 1.3, cabX: 1.3, cabZ: 1.1, torY: 0.8, torX: 0.8, torZ: 0.7, bIx: 0.9, bIa: 0.9, bDx: 0.9, bDa: 0.9, mI: 1.5, mD: 1.5, rD: 1.6, pI: 1.0, pD: 1.0, alto: 2 };
const GESTOS = [
  { bDx: -0.7, bDa: 0.6, bIx: -0.6, bIa: 0.55 },
  { bDx: -1.1, bDa: 0.2, bIx: -0.15, bIa: 0.1 },
  { bDx: -0.9, bDa: 0.3, bIx: -0.5, bIa: 0.3 },
  { bDx: -0.8, bDa: 0.45, bIx: 0.0, bIa: 0.07 },
  { bDx: -0.3, bDa: 0.15, bIx: -0.85, bIa: 0.4 },
];
const VISTAZOS = [[-0.5, 0.05], [0.5, -0.02], [0.32, 0.1], [-0.32, -0.1], [0.62, 0.04]];

/**
 * Crea una minifigura.
 * opciones: { look, liviana = false, semilla = 1 }
 */
export function crearMinifigura({ look, liviana = false, semilla: sem = 1 } = {}) {
  const Q = detalle(liviana);
  const rnd = semilla(sem);
  const mPiel = plastico(look.skin || '#f5cd30');
  const mCamisa = plastico(look.shirt || '#008ec7');
  const mPant = plastico(PANTALON);
  const propias = []; // geometrías propias (se liberan con liberar())
  const g = (geo) => (propias.push(geo), geo);
  const caja = (w, h, d, r = 0.05) => g(new RoundedBoxGeometry(w, h, d, Q.caja, r));
  const malla = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const grupo = (x = 0, y = 0, z = 0) => {
    const gr = new THREE.Group();
    gr.position.set(x, y, z);
    return gr;
  };

  // ----- esqueleto (igual que la prueba) -----
  const raiz = grupo();
  raiz.name = 'minifigura';
  const cuerpo = grupo();
  raiz.add(cuerpo);
  const pierna = (lado) => {
    const p = grupo(lado * 0.5, 1.5, 0);
    p.add(malla(caja(0.98, 1.5, 1.0, 0.06), mPant, 0, -0.75, 0));
    return p;
  };
  const piernaI = pierna(-1);
  const piernaD = pierna(1);
  const cadera = malla(caja(2.0, 0.34, 1.05, 0.06), mPant, 0, 1.67, 0);
  const torso = grupo(0, 1.84, 0);
  const pecho = malla(caja(2.0, 1.75, 1.05, 0.12), mCamisa, 0, 0.88, 0);
  torso.add(pecho);
  const esferaHombro = g(new THREE.SphereGeometry(0.29, Q.esf[0], Q.esf[1]));
  const manga = caja(0.56, 1.5, 0.62, 0.1);
  const pasador = g(new THREE.CylinderGeometry(0.115, 0.115, 0.2, Math.max(8, Q.cil / 2)));
  const brazo = (lado) => {
    const hombro = grupo(lado * 1.28, 1.51, 0);
    hombro.add(malla(esferaHombro, mCamisa, 0, -0.04, 0));
    hombro.add(malla(manga, mCamisa, 0, -0.72, 0));
    hombro.add(malla(pasador, mPiel, 0, -1.52, 0));
    const muneca = grupo(0, -1.6, 0);
    muneca.add(malla(geometriaMano(lado, liviana), mPiel, 0, -0.19, 0));
    hombro.add(muneca);
    return { hombro, muneca };
  };
  const bI = brazo(-1);
  const bD = brazo(1);
  const cabeza = grupo(0, 1.76, 0);
  cabeza.add(malla(g(new THREE.CylinderGeometry(0.72, 0.72, 0.95, Q.cil)), mPiel, 0, 0.48, 0));
  cabeza.add(malla(g(new THREE.CylinderGeometry(0.3, 0.3, 0.2, Math.max(10, Q.cil / 2))), mPiel, 0, 1.05, 0));
  const rostro = crearCara(0.72, 0.95);
  const cara = rostro.malla;
  cara.position.y = 0.48;
  cabeza.add(cara);
  torso.add(cabeza, bI.hombro, bD.hombro);
  cuerpo.add(piernaI, piernaD, cadera, torso);

  // ----- apariencia: peinado y kit (accesorios.js) -----
  const k = kit(look, Q);
  if (!k.ocultarPelo) cabeza.add(peinado(look, Q));
  k.cabeza.forEach((p) => cabeza.add(p));
  k.torso.forEach((p) => torso.add(p));
  k.manoDer.forEach((p) => bD.muneca.add(p));
  k.manoIzq.forEach((p) => bI.muneca.add(p));
  const senal = k.senal || new THREE.Group();
  senal.position.set(1.3, 6.4, 0);
  senal.visible = false;
  senal.name = 'senal';
  raiz.add(senal);
  // Rendimiento: las piezas de una misma articulación (que se mueven juntas) se juntan por tipo de plástico, con el
  // color en cada vértice: de ~32 a ~14 llamadas de dibujo por personaje. La cara (textura) y la señal no se juntan.
  const grupos = [];
  raiz.traverse((o) => {
    if (o.isMesh && !o.material.transparent && !o.material.map && o.material.userData?.tipo) o.userData.fija = true;
    if (!o.isMesh && o !== senal && !senal.children.includes(o)) grupos.push(o);
  });
  for (const gr of grupos.reverse()) fusionar(gr, { directos: true });
  raiz.traverse((o) => {
    if (o.isMesh && o.geometry && !o.geometry.userData.compartida && !propias.includes(o.geometry)) propias.push(o.geometry);
  });

  // ----- variación propia -----
  const v = {
    ritmo: 0.9 + rnd() * 0.25,
    amp: 0.85 + rnd() * 0.3,
    fase: rnd() * Math.PI * 2,
    respira: 0.2 + rnd() * 0.07,
    parpadeo: 4.2 + rnd() * 2.2,
    pausaMirada: 3.2 + rnd() * 2.2,
    orden: GESTOS.map((_, i) => [rnd(), i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]),
  };

  // ----- estado de la animación -----
  const P = {};
  const VEL = {};
  const T = {};
  const rap = { mI: 0, mD: 0 };
  const salida = { k: 7 };
  const X = expresionBase();
  const E = expresionBase();
  for (const c of CAMPOS) P[c] = VEL[c] = T[c] = 0;
  const mirada = { fase: 'frente', yaw: 0, pitch: 0, hasta: 1.5 };
  let ultimoVistazo = -1;
  let blanco = null;
  let estadoAnt = null;
  let t0 = 0;
  let terminado = false;
  const sent = { valor: 0, meta: 0, vel: 0 };
  const yo = { ritmoTecleo: 0 };
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const angulos = [0, 0];

  const mirarA = (p) => {
    blanco = p ? (blanco || new THREE.Vector3()).copy(p) : null;
  };
  const haciaBlanco = (out) => {
    cabeza.getWorldPosition(va);
    va.y += 0.48;
    raiz.worldToLocal(va);
    vb.copy(blanco);
    raiz.worldToLocal(vb).sub(va);
    out[0] = limitar(Math.atan2(vb.x, vb.z), -0.9, 0.9);
    out[1] = limitar(-Math.atan2(vb.y, Math.hypot(vb.x, vb.z)), -0.3, 0.3);
  };

  function objetivo(estado, t, tt) {
    for (const c of CAMPOS) T[c] = 0;
    T.bIa = 0.07;
    T.bDa = 0.07;
    rap.mI = rap.mD = 0;
    Object.assign(X, BASE_X);
    const f = v.ritmo;
    const ph = v.fase;
    let kk = 7;
    switch (estado) {
      case 'thinking': {
        // Teclea mirando la pantalla. Con texto llegando ("Escribiendo…") el tecleo es continuo y más rápido;
        // sin texto ("Pensando…") cada tanto levanta la vista un momento.
        const escribe = yo.ritmoTecleo;
        const ciclo = (t * 0.13 * f + ph / 6.2832) % 1;
        const pausa = (1 - escribe) * (ciclo > 0.8 ? suave(Math.min(1, (ciclo - 0.8) / 0.05)) * (1 - suave(Math.max(0, (ciclo - 0.95) / 0.05))) : 0);
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
        X.sonrisa = 0.15;
        X.cejaIh = -0.2 + 0.5 * pausa;
        X.cejaIt = 0.5 * (1 - pausa);
        X.cejaDh = 0.1 + 0.6 * pausa;
        X.cejaDt = 0.2 * (1 - pausa);
        X.ojo = 0.9;
        X.miraY = 0.6 - 1.4 * pausa;
        X.miraX = 0.4 * pausa;
        const teclea = 1 - pausa;
        const vel = 28 + 14 * escribe;
        rap.mI = 0.1 * Math.sin(t * vel * f) * teclea;
        rap.mD = 0.1 * Math.sin(t * vel * f + 2.1) * teclea;
        break;
      }
      case 'searching':
        T.bIx = -0.5;
        T.bDx = -1.2 + 0.1 * Math.sin(t * 1.4 * f);
        T.bDa = 0.15;
        T.mD = -0.2;
        T.cabX = 0.1;
        T.cabY = 0.5 * Math.sin(t * 0.7 * f + ph);
        T.torY = T.cabY * 0.35;
        T.torZ = 0.03 * Math.sin(t * 0.7 * f + ph);
        X.ojo = 0.85;
        X.cejaIh = -0.1;
        X.cejaDh = -0.1;
        X.cejaIt = 0.25;
        X.cejaDt = 0.25;
        X.sonrisa = 0.2;
        break;
      case 'talking': {
        const periodo = 1.2 / f;
        const p = t / periodo + ph / 6.2832;
        const idx = Math.floor(p);
        const u = p - idx;
        const cabeceo = Math.exp(-(((u - 0.2) / 0.16) ** 2));
        const acento = Math.exp(-(((u - 0.38) / 0.2) ** 2));
        const ge = GESTOS[v.orden[Math.floor(idx / 2) % GESTOS.length]];
        T.bDx = ge.bDx - 0.22 * acento * v.amp;
        T.bDa = ge.bDa + 0.08 * acento * v.amp;
        T.bIx = ge.bIx - 0.12 * acento * v.amp;
        T.bIa = ge.bIa;
        T.mD = 0.28 * acento - 0.05;
        T.mI = 0.12 * acento;
        T.cabX = -0.02 + 0.1 * cabeceo;
        T.cabY = 0.1 * Math.sin(p * 0.37);
        T.cabZ = 0.05 * Math.sin(p * 0.23 + 1);
        T.torX = 0.03 + 0.04 * cabeceo;
        T.torY = T.cabY * 0.45;
        T.torZ = 0.025 * Math.sin(p * 0.37);
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
        T.torY = s * 0.08;
        T.cabY = -s * 0.04;
        T.torZ = 0.035 * Math.sin(w * 0.5);
        T.alto = (1 - Math.cos(2 * w)) * 0.035;
        kk = 9;
        break;
      }
      case 'terminado': {
        // gesto corto al terminar bien (equivale a la clase .done del SVG): levanta un brazo, asiente y sonríe
        const arriba = tt < 0.35 ? suave(tt / 0.35) : tt < 1.1 ? 1 : 1 - suave(Math.min(1, (tt - 1.1) / 0.5));
        T.bDx = -0.5 * arriba;
        T.bDa = 0.07 + 1.6 * arriba;
        T.cabX = 0.12 * Math.sin(Math.min(1, tt / 0.9) * Math.PI * 2) * arriba;
        T.torZ = -0.04 * arriba;
        X.sonrisa = 0.7 + 0.4 * arriba;
        X.cejaIh = 0.35 * arriba;
        X.cejaDh = 0.35 * arriba;
        X.ojo = 1 - 0.12 * arriba;
        kk = 9;
        break;
      }
      case 'escucha': {
        const cadaCuanto = 3.4 / f;
        const asiente = Math.max(0, Math.sin((Math.PI * 2 * t) / cadaCuanto + ph)) ** 6 * 0.17;
        T.cabY = 0.3;
        T.cabZ = 0.08;
        T.cabX = 0.03 + asiente;
        T.torX = 0.05;
        T.torY = 0.1;
        X.ojo = 1.08;
        X.cejaIh = 0.4;
        X.cejaDh = 0.55;
        X.cejaIt = -0.15;
        X.cejaDt = -0.2;
        X.sonrisa = 0.35;
        T.torZ = 0.02;
        T.bDx = -0.12;
        T.bDa = 0.1;
        kk = 5;
        break;
      }
      default: {
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
        const desc = Math.sin(t * 0.13 * f + ph);
        T.cabY = mirada.yaw;
        T.cabX = mirada.pitch;
        T.torY = mirada.yaw * 0.25;
        T.torZ = 0.03 * desc;
        T.cabZ = -0.02 * desc;
        T.bIx = 0.04 * Math.sin(t * v.respira * 6.2832 + ph);
        T.bDx = -0.04 * Math.sin(t * v.respira * 6.2832 + ph);
        T.bIa = 0.07 + 0.015 * desc;
        T.bDa = 0.07 - 0.015 * desc;
        kk = 4.5;
      }
    }
    // sentado: los brazos descansan un poco hacia adelante (sobre el escritorio o la mesa) en reposo y al escuchar
    if (sent.valor > 0.5 && (estado === 'idle' || estado === 'escucha' || !estado)) {
      T.bIx += -0.45;
      T.bDx += -0.45;
    }
    salida.k = kk;
  }

  function aplicar(t) {
    const r = Math.sin(t * v.respira * 6.2832 + v.fase);
    pecho.scale.set(1 + r * 0.008, 1 + r * 0.014, 1 + r * 0.008);
    cabeza.position.y = 1.76 + r * 0.02;
    const s = suave(sent.valor);
    cuerpo.position.y = P.alto + s * SUBIR_SENTADO;
    torso.rotation.set(limitar(P.torX, ...LIM.torX), limitar(P.torY, ...LIM.torY), limitar(P.torZ, ...LIM.torZ));
    cabeza.rotation.set(limitar(P.cabX, ...LIM.cabX), limitar(P.cabY, ...LIM.cabY), limitar(P.cabZ, ...LIM.cabZ));
    bI.hombro.rotation.set(limitar(P.bIx, ...LIM.brazoX), 0, -limitar(P.bIa, ...LIM.brazoAbd));
    bD.hombro.rotation.set(limitar(P.bDx, ...LIM.brazoX), 0, limitar(P.bDa, ...LIM.brazoAbd));
    const arrI = limitar(-VEL.bIx * 0.06, -0.15, 0.15);
    const arrD = limitar(-VEL.bDx * 0.06, -0.15, 0.15);
    const compI = -P.bIx * 0.45;
    const compD = -P.bDx * 0.45;
    bI.muneca.rotation.set(limitar(P.mI + rap.mI + arrI + compI, ...LIM.muneca), 0, 0);
    bD.muneca.rotation.set(limitar(P.mD + rap.mD + arrD + compD, ...LIM.muneca), limitar(P.rD, ...LIM.giro), 0);
    // sentado: las piernas giran 90° hacia adelante en la cadera (fuera de los límites de la caminata)
    piernaI.rotation.x = limitar(P.pI, ...LIM.pierna) * (1 - s) - (Math.PI / 2) * s;
    piernaD.rotation.x = limitar(P.pD, ...LIM.pierna) * (1 - s) - (Math.PI / 2) * s;
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
      mirada.fase = 'frente';
      mirada.yaw = mirada.pitch = 0;
      mirada.hasta = t + 1.2;
    }
    const tt = t - t0;
    objetivo(estado, t, tt);
    if (blanco && (estado === 'talking' || estado === 'escucha')) {
      haciaBlanco(angulos);
      T.cabY = angulos[0];
      T.cabX += angulos[1];
      T.torY += angulos[0] * 0.15;
    }
    const kk = salida.k;
    // paso grande (movimiento reducido): la postura salta a la del estado, sin oscilar ni rebotar
    const salto = dt >= 0.5;
    for (const c of CAMPOS) {
      if (salto) {
        P[c] = T[c];
        VEL[c] = 0;
        continue;
      }
      const om = kk * RAPIDEZ[c] * 0.6;
      const x = om * dt;
      const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
      const cambio = P[c] - T[c];
      const tmp = (VEL[c] + om * cambio) * dt;
      VEL[c] = (VEL[c] - om * tmp) * e;
      P[c] = T[c] + (cambio + tmp) * e;
    }
    // sentarse / levantarse: amortiguación crítica (~0.5 s)
    if (salto) {
      sent.valor = sent.meta;
      sent.vel = 0;
    } else {
      const om = 7;
      const x = om * dt;
      const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
      const cambio = sent.valor - sent.meta;
      const tmp = (sent.vel + om * cambio) * dt;
      sent.vel = (sent.vel - om * tmp) * e;
      sent.valor = limitar(sent.meta + (cambio + tmp) * e, 0, 1);
    }
    X.miraX += limitar((T.cabY - P.cabY) * 1.1, -0.9, 0.9);
    X.miraY += limitar((T.cabX - P.cabX) * 1.1, -0.6, 0.6);
    X.miraX = limitar(X.miraX, -1, 1);
    X.miraY = limitar(X.miraY, -1, 1);
    for (const c in X) {
      const r = c === 'boca' ? 24 : c.startsWith('mira') ? 14 : 8;
      E[c] = salto ? X[c] : E[c] + (X[c] - E[c]) * (1 - Math.exp(-dt * r));
    }
    aplicar(t);
    if (estado === 'terminado' && tt >= DURACION.terminado && !terminado) {
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

  /** Sienta (true) o levanta (false). `inmediato` salta la transición (al cargar o con movimiento reducido). */
  function sentar(si, inmediato = false) {
    sent.meta = si ? 1 : 0;
    if (inmediato) {
      sent.valor = sent.meta;
      sent.vel = 0;
      aplicar(0);
    }
  }
  reposo();

  function liberar() {
    for (const geo of propias) if (!geo.userData.compartida) geo.dispose();
    raiz.traverse((o) => {
      if (o.isMesh && !o.material.userData?.compartido) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
    raiz.removeFromParent();
  }

  return {
    objeto: raiz,
    animar,
    reposo,
    mirarA,
    sentar,
    sentado: () => sent.valor,
    senal,
    cabeza,
    manoDer: bD.muneca,
    // qué lleva puesto (para pruebas): kit y cantidad de piezas de cada accesorio
    accesorios: { kit: look.kit || null, cabeza: k.cabeza.length, torso: k.torso.length, manoDer: k.manoDer.length, manoIzq: k.manoIzq.length, senal: !!k.senal, peinado: k.ocultarPelo ? 'bajo la gorra' : look.hairStyle || 'short' },
    set ritmoTecleo(x) {
      yo.ritmoTecleo = x;
    },
    get ritmoTecleo() {
      return yo.ritmoTecleo;
    },
    expresion: () => ({ ...E }),
    liberar,
  };
}

// Registro: la escena pide la minifigura por nombre (como los muebles). El objeto lleva su interfaz de animación en
// userData.personaje. Un .glb futuro debe entregar la misma interfaz (ver LEEME.md).
registrarModelo(
  'minifigura',
  (op) => {
    const f = crearMinifigura(op);
    f.objeto.userData.personaje = f;
    return f.objeto;
  },
  { fija: false, medida: { w: 2.6, d: 1.1, alto: 4.85 } }
);
