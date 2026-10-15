// Peinados y accesorios de cada agente en 3D, a partir de la MISMA apariencia que la oficina SVG:
//   look.hairStyle  → hair() de js/office.js: 'short' | 'bun' | 'curly' | 'long' | 'gorra'
//   look.kit        → kitParts() de js/office.js:
//     'copy'      (Nico): sudadera con capucha (cuello oscuro, bolsillo y cordones), gorra del color de la camisa con
//                         visera, audífonos sobre la gorra y libreta naranja en la mano derecha. Señal: bombillo al pensar.
//     'analista'  (Alex): saco con solapas oscuras y camisa blanca, lentes redondos y tableta con barras en la mano
//                         izquierda. Señal: lupa al buscar.
//     'guion'     (Sam):  sudadera con capucha, audífonos al cuello y tres tarjetas en abanico en la mano derecha.
//                         Señal: visto bueno (✓) al terminar.
// Las señales (bombillo, lupa, ✓) solo se muestran cuando el estado real lo indica (lo decide agentes.js).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { plastico, mate } from '../materiales.js';

const TINTA = '#2b2f3a';

/** Aclara (amt > 0) u oscurece (amt < 0) un color hex. Copia de shade() de js/lego.js. */
export function tono(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  return '#' + ((1 << 24) | (f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1);
}

function pieza(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** Geometrías según el detalle: 'fina' (calidad Alta) o 'liviana' (Media y Baja). Mismas formas, menos segmentos. */
export function detalle(liviana) {
  return liviana ? { cil: 14, esf: [10, 7], caja: 1, toro: [6, 12] } : { cil: 32, esf: [20, 12], caja: 3, toro: [8, 24] };
}

const caja = (Q, w, h, d, r = 0.05) => new RoundedBoxGeometry(w, h, d, Q.caja, r);

// ─── Peinados (cabeza: cilindro de radio .72, de y = 0 a .95 en el grupo de la cabeza; frente = +z) ───────────────
export function peinado(look, Q) {
  const g = new THREE.Group();
  g.name = 'peinado';
  const m = plastico(look.hair || '#1b1b1b');
  const casquete = () => pieza(new THREE.SphereGeometry(0.79, Q.esf[0], Q.esf[1], 0, Math.PI * 2, 0, Math.PI * 0.45), m, 0, 0.62, 0);
  const nuca = (alto = 0.62) => {
    // la parte de atrás del pelo: medio cilindro abierto que cubre la nuca (hacia -z)
    return pieza(new THREE.CylinderGeometry(0.77, 0.77, alto, Q.cil, 1, true, Math.PI * 0.5, Math.PI), m, 0, 0.95 - alto / 2, 0);
  };
  switch (look.hairStyle) {
    case 'curly': {
      // rizos: bolitas alrededor de la parte de arriba y de atrás (como los círculos del SVG)
      const esf = new THREE.SphereGeometry(0.3, Q.esf[0], Q.esf[1]);
      const puntos = [[-0.55, 0.85, 0.15], [-0.35, 1.05, 0.25], [0, 1.12, 0.2], [0.35, 1.05, 0.25], [0.55, 0.85, 0.15], [-0.62, 0.55, -0.2], [0.62, 0.55, -0.2], [-0.3, 1.0, -0.35], [0.3, 1.0, -0.35], [0, 0.85, -0.6], [-0.5, 0.75, -0.5], [0.5, 0.75, -0.5]];
      for (const [x, y, z] of puntos) g.add(pieza(esf, m, x, y, z));
      g.add(casquete());
      break;
    }
    case 'bun':
      g.add(casquete(), nuca(0.45), pieza(new THREE.SphereGeometry(0.34, Q.esf[0], Q.esf[1]), m, 0, 1.2, -0.35));
      break;
    case 'long':
      g.add(casquete(), nuca(1.25));
      break;
    case 'gorra': {
      g.add(pieza(new THREE.SphereGeometry(0.8, Q.esf[0], Q.esf[1], 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0.82, 0));
      g.add(pieza(caja(Q, 1.0, 0.1, 0.8, 0.04), plastico(tono(look.hair || '#1b1b1b', -0.25)), 0, 0.86, 0.82));
      break;
    }
    default: {
      // corto: casquete, nuca corta y flequillo de lado
      g.add(casquete(), nuca(0.42));
      const fleco = pieza(caja(Q, 0.7, 0.18, 0.3, 0.06), m, -0.2, 0.93, 0.55);
      fleco.rotation.z = 0.25;
      g.add(fleco);
    }
  }
  return g;
}

// ─── Ropa y accesorios por kit ──────────────────────────────────────────────────────────────────────────────────
/**
 * Devuelve { torso: Object3D[], cabeza: Object3D[], manoDer: Object3D[], manoIzq: Object3D[], senal: Object3D|null,
 *            ocultarPelo: bool } para colgar de cada parte del esqueleto.
 * Torso: grupo con origen en la cintura (el pecho va de y = 0 a 1.75, frente en z = .525).
 * Manos: grupo de la muñeca (la mano queda en y ≈ -0.19; el objeto se sostiene debajo y al frente).
 */
export function kit(look, Q) {
  const out = { torso: [], cabeza: [], manoDer: [], manoIzq: [], senal: null, ocultarPelo: false };
  const camisa = look.shirt || '#008ec7';
  const capucha = () => {
    // cuello de la capucha (anillo oscuro), bolsillo canguro y cordones blancos
    const cuello = pieza(new THREE.TorusGeometry(0.62, 0.13, Q.toro[0], Q.toro[1]), plastico(tono(camisa, -0.22)), 0, 1.72, 0);
    cuello.rotation.x = Math.PI / 2;
    cuello.scale.set(1.05, 0.75, 1);
    const bolsillo = pieza(caja(Q, 1.1, 0.5, 0.06, 0.03), plastico(tono(camisa, -0.14)), 0, 0.42, 0.535);
    const cordon = new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6);
    out.torso.push(cuello, bolsillo, pieza(cordon, mate('#ffffff'), -0.17, 1.38, 0.54), pieza(cordon, mate('#ffffff'), 0.17, 1.38, 0.54));
  };
  const audifonos = (y, radio) => {
    const negro = plastico(TINTA);
    const diadema = pieza(new THREE.TorusGeometry(radio, 0.06, Q.toro[0], Q.toro[1], Math.PI), negro, 0, y, 0);
    const copa = new THREE.CylinderGeometry(0.22, 0.22, 0.2, Q.cil);
    const izq = pieza(copa, negro, -radio, y, 0);
    const der = pieza(copa, negro, radio, y, 0);
    izq.rotation.z = der.rotation.z = Math.PI / 2;
    return [diadema, izq, der];
  };

  if (look.kit === 'copy') {
    capucha();
    // gorra del color de la camisa (más oscura) con visera, y audífonos encima
    out.cabeza.push(pieza(new THREE.SphereGeometry(0.81, Q.esf[0], Q.esf[1], 0, Math.PI * 2, 0, Math.PI / 2), plastico(tono(camisa, -0.12)), 0, 0.8, 0));
    out.cabeza.push(pieza(caja(Q, 1.05, 0.1, 0.85, 0.04), plastico(tono(camisa, -0.32)), 0, 0.84, 0.85));
    out.cabeza.push(...audifonos(0.62, 0.84));
    out.ocultarPelo = true;
    // libreta naranja en la mano derecha
    const libreta = new THREE.Group();
    libreta.add(pieza(caja(Q, 0.55, 0.78, 0.07, 0.03), plastico('#ffb36b'), 0, 0, 0));
    libreta.add(pieza(new THREE.BoxGeometry(0.42, 0.62, 0.02), mate('#fffdf5'), 0, 0, 0.045));
    libreta.position.set(0, -0.45, 0.22);
    libreta.rotation.x = -0.35;
    out.manoDer.push(libreta);
    out.senal = senalBombillo(Q);
  } else if (look.kit === 'analista') {
    // saco: solapas oscuras a los lados, camisa blanca al centro
    const solapa = caja(Q, 0.7, 1.7, 0.05, 0.03);
    out.torso.push(pieza(solapa, plastico(tono(camisa, -0.38)), -0.62, 0.86, 0.54), pieza(solapa, plastico(tono(camisa, -0.38)), 0.62, 0.86, 0.54));
    out.torso.push(pieza(caja(Q, 0.5, 1.7, 0.04, 0.02), mate('#f2f5f8'), 0, 0.86, 0.535));
    // lentes redondos (a la altura de los ojos de la cara estampada)
    const negro = plastico(TINTA);
    const aro = new THREE.TorusGeometry(0.17, 0.03, Q.toro[0], Q.toro[1]);
    out.cabeza.push(pieza(aro, negro, -0.22, 0.56, 0.76), pieza(aro, negro, 0.22, 0.56, 0.76));
    out.cabeza.push(pieza(new THREE.BoxGeometry(0.14, 0.03, 0.03), negro, 0, 0.58, 0.79));
    // tableta en la mano izquierda, con barras de colores
    const tableta = new THREE.Group();
    tableta.add(pieza(caja(Q, 0.75, 1.0, 0.07, 0.04), negro, 0, 0, 0));
    tableta.add(pieza(new THREE.BoxGeometry(0.6, 0.82, 0.02), mate('#d6edf8'), 0, 0, 0.045));
    [['#ff8a3d', -0.18, 0.3], ['#0078ab', 0, 0.5], ['#30bb4f', 0.18, 0.4]].forEach(([c, x, h]) => tableta.add(pieza(new THREE.BoxGeometry(0.12, h, 0.02), mate(c), x, -0.38 + h / 2, 0.06)));
    tableta.position.set(0, -0.5, 0.22);
    tableta.rotation.x = -0.4;
    out.manoIzq.push(tableta);
    out.senal = senalLupa(Q);
  } else if (look.kit === 'guion') {
    capucha();
    // audífonos al cuello
    out.torso.push(...audifonos(1.72, 0.66).map((p) => {
      if (p.geometry.type === 'TorusGeometry') {
        p.rotation.x = -Math.PI / 2 + 0.35;
        p.position.z = 0.1;
      } else p.position.y = 1.6;
      return p;
    }));
    // tres tarjetas en abanico en la mano derecha
    const tarjetas = new THREE.Group();
    [-0.25, 0, 0.25].forEach((giro, i) => {
      const t = pieza(caja(Q, 0.55, 0.78, 0.03, 0.03), mate('#fffdf5'), (i - 1) * 0.05, 0, i * 0.02);
      t.rotation.z = giro;
      tarjetas.add(t);
    });
    tarjetas.position.set(0, -0.45, 0.22);
    tarjetas.rotation.x = -0.35;
    out.manoDer.push(tarjetas);
    out.senal = senalCheck(Q);
  }
  return out;
}

// ─── Señales flotantes (las mismas del SVG: bombillo, lupa y visto bueno) ───────────────────────────────────────
function senalBombillo(Q) {
  const g = new THREE.Group();
  g.add(pieza(new THREE.SphereGeometry(0.32, Q.esf[0], Q.esf[1]), new THREE.MeshStandardMaterial({ color: '#ffd54a', emissive: '#ffb300', emissiveIntensity: 0.6 }), 0, 0.15, 0));
  g.add(pieza(new THREE.CylinderGeometry(0.14, 0.14, 0.18, Q.cil), plastico('#8a8f9c'), 0, -0.2, 0));
  return g;
}
function senalLupa(Q) {
  const g = new THREE.Group();
  const aro = pieza(new THREE.TorusGeometry(0.26, 0.06, Q.toro[0], Q.toro[1]), plastico(TINTA), 0, 0.1, 0);
  const vidrio = pieza(new THREE.CircleGeometry(0.24, Q.cil), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 }), 0, 0.1, 0);
  const mango = pieza(new THREE.BoxGeometry(0.08, 0.36, 0.08), plastico(TINTA), 0.26, -0.22, 0);
  mango.rotation.z = 0.7;
  g.add(aro, vidrio, mango);
  return g;
}
function senalCheck(Q) {
  const g = new THREE.Group();
  const disco = pieza(new THREE.CylinderGeometry(0.34, 0.34, 0.06, Q.cil), new THREE.MeshStandardMaterial({ color: '#2fb361', roughness: 0.4 }), 0, 0, 0);
  disco.rotation.x = Math.PI / 2;
  const blanco = mate('#ffffff');
  const a = pieza(new THREE.BoxGeometry(0.08, 0.2, 0.04), blanco, -0.08, -0.03, 0.05);
  a.rotation.z = 0.8;
  const b = pieza(new THREE.BoxGeometry(0.08, 0.36, 0.04), blanco, 0.07, 0.03, 0.05);
  b.rotation.z = -0.6;
  g.add(disco, a, b);
  return g;
}
