// Nico (copywriter) como una MINIFIGURA LEGO real: piezas, proporciones y articulaciones auténticas, con la ropa
// impresa (como las minifiguras de verdad) y sus accesorios como piezas aparte. Base: su hoja de referencia y fotos de
// minifiguras reales (anatomía); el .glb de Meshy que mandó el equipo no se usa directamente (una sola pieza fundida,
// sin esqueleto, ~141 mil triángulos y la cara pintada).
//
// Piezas (1 = un taquito = 8 mm; alto total 4,8 como una minifigura real, sin contar el pelo):
//   cabeza   cilindro de 1,2 × 1,1 con bordes redondeados y cuello; cara impresa intercambiable
//   torso    trapecio (2,0 abajo → 1,5 en los hombros, 1,6 de alto, frente y espalda planos) con la sudadera impresa
//   brazos   pieza rígida: hombro redondeado al costado del torso, manga que baja un poco abierta y codo doblado fijo
//   manos    en C con el eje atravesado y la abertura hacia abajo, con su muñeca
//   cadera   pieza con el eje de las piernas y la entrepierna; pretina impresa
//   piernas  perfil real: muslo, pie que sobresale adelante, tope redondeado y dos huecos redondos atrás; pantalón cargo,
//            camuflaje y zapatillas impresos
//   pelo     pieza de pelo LEGO: casco hueco con mechones, flequillo barrido, lados y nuca
//   accesorios  capucha caída (rollo alrededor del cuello y capucha sobre la espalda), libreta y bolígrafo
//
// Articulaciones (SOLO las reales): cabeza gira a los lados · cada brazo gira en el hombro (adelante/atrás) · cada mano
// gira en su muñeca · cada pierna gira en la cadera. La figura completa puede saltar, rebotar, girar e inclinarse
// entera, como en stop-motion. Nada se dobla ni se abre hacia los lados. Mirar arriba o abajo lo hacen los ojos.
//
// Contrato (el mismo de minifigura.js, que usa agentes.js):
//   objeto · animar(estado, t, dt) · sentar(si, inmediato) · sentado() · mirarA(p) · reposo() · senal · cabeza ·
//   manoDer · ritmoTecleo · liberar() · accesorios · expresion()
// y además, solo para Nico: velocidad · suavizarCaminata · accion() · utileria() · fijarAccion() (pruebas) · articulaciones
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { plastico, porVertice, trama } from '../materiales.js';
import { registrarModelo } from '../registro.js';
import { lienzo } from '../texturas.js';
import { crearCaraNico, expresionNico, CARA } from './cara-nico.js';
import { semilla, DURACION, ASIENTO } from './minifigura.js';

export const COLORES = {
  piel: '#f7c51e',
  sudadera: '#1d1e22',
  pantalon: '#48522c',
  pantalonOscuro: '#3f4828',
  hueco: '#343a20',
  pelo: '#5b3220',
  kraft: '#c99558',
  hoja: '#fbf8ee',
  linea: '#9db4cc',
  tinta: '#3b4a66',
  espiral: '#2b2d33',
  boli: '#1f4fd6',
  metal: '#c3c7cf',
};

// Medidas (en la escala de la oficina: el asiento a 1.7 y el eje de la cadera a 1.5, como la minifigura general)
const M = {
  cadera: 1.5, // eje de las piernas
  cinturaY: 1.84, // base del torso
  torsoAlto: 1.6,
  torsoAbajo: 2.0,
  torsoArriba: 1.5,
  torsoFondo: 1.0,
  hombroY: 1.3, // eje del hombro, medido desde la base del torso
  hombroX: 0.86,
  cabezaR: 0.6,
  cabezaAlto: 1.1,
  cuello: 0.14,
  codo: 0.62, // ángulo fijo del antebrazo hacia adelante
};
const SUBIR_SENTADO = ASIENTO - (M.cadera - 0.5);
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const suave = (x) => {
  const k = limitar(x, 0, 1);
  return k * k * (3 - 2 * k);
};
const rebote = (x) => {
  const c = 1.9;
  const k = limitar(x, 0, 1) - 1;
  return 1 + (c + 1) * k * k * k + c * k * k;
};
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ─── Impresión: una sola imagen con todas las caras impresas (torso, cadera y piernas) ─────────────────────────────
// Zonas de la imagen (u0, v0, u1, v1 en 0..1, medidas desde ARRIBA de la imagen):
const ZONA = {
  torsoF: [0, 0, 0.5, 0.42],
  torsoB: [0.5, 0, 1, 0.42],
  torsoL: [0, 0.42, 0.18, 0.8],
  piernaF: [0.18, 0.42, 0.56, 0.8],
  piernaL: [0.56, 0.42, 1, 0.8],
  piernaB: [0, 0.8, 0.5, 1],
  cadera: [0.5, 0.8, 1, 1],
};

function atlas(fina) {
  const lado = fina ? 1024 : 512;
  return lienzo(`nico:atlas:${lado}`, lado, lado, (ctx, W, H) => {
    const r = semilla(23);
    const k = W / 1024;
    const zona = (z, dibujar) => {
      const [u0, v0, u1, v1] = ZONA[z];
      ctx.save();
      ctx.translate(u0 * W, v0 * H);
      const w = (u1 - u0) * W;
      const h = (v1 - v0) * H;
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.clip();
      dibujar(w, h);
      ctx.restore();
    };
    const grano = (w, h, n, a) => {
      for (let i = 0; i < n; i++) {
        const v = r() < 0.5 ? 255 : 0;
        ctx.fillStyle = `rgba(${v},${v},${v},${a * (0.5 + r())})`;
        ctx.fillRect(r() * w, r() * h, (1 + r() * 2) * k, (1 + r() * 2) * k);
      }
    };
    const linea = (pts, color, ancho) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = ancho;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    };
    const sudadera = (w, h) => {
      ctx.fillStyle = COLORES.sudadera;
      ctx.fillRect(0, 0, w, h);
      grano(w, h, 900 * k, 0.05);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.025 + r() * 0.03})`;
        ctx.beginPath();
        ctx.ellipse(r() * w, r() * h, w * (0.05 + r() * 0.08), h * (0.02 + r() * 0.04), r() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#1f2125'; // ruedo
      ctx.fillRect(0, h * 0.93, w, h * 0.07);
      linea([[0, h * 0.93], [w, h * 0.93]], 'rgba(255,255,255,0.07)', 3 * k);
    };
    const camuflaje = (w, h) => {
      ctx.fillStyle = COLORES.pantalon;
      ctx.fillRect(0, 0, w, h);
      const mancha = (x, y, s, tono) => {
        ctx.fillStyle = tono;
        ctx.beginPath();
        for (let j = 0; j < 9; j++) {
          const a = (j / 9) * Math.PI * 2;
          const rr = s * (0.7 + 0.5 * Math.sin(a * 3 + x));
          const px = x + Math.cos(a) * rr * 1.5;
          const py = y + Math.sin(a) * rr;
          if (j) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      };
      for (let i = 0; i < 14; i++) mancha(r() * w, r() * h, (10 + r() * 16) * k, `rgba(45,50,25,${0.35 + r() * 0.2})`);
      for (let i = 0; i < 9; i++) mancha(r() * w, r() * h, (7 + r() * 10) * k, `rgba(135,140,95,${0.14 + r() * 0.1})`);
      grano(w, h, 700 * k, 0.05);
    };
    // zapatilla impresa en el pie (el cuarto de abajo de la pierna)
    const zapatilla = (w, h, vista) => {
      const alto = h * 0.24;
      const y0 = h - alto;
      ctx.fillStyle = '#25272c';
      ctx.fillRect(0, y0, w, alto);
      ctx.fillStyle = '#f3f3ef';
      ctx.fillRect(0, h - alto * 0.3, w, alto * 0.3);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, h - alto * 0.3, w, alto * 0.04);
      if (vista === 'frente') {
        ctx.fillStyle = '#9aa0a9';
        ctx.beginPath();
        ctx.ellipse(w / 2, h - alto * 0.3, w * 0.36, alto * 0.32, 0, Math.PI, 0);
        ctx.fill();
        for (let i = 0; i < 3; i++) linea([[w * 0.36, y0 + alto * (0.12 + i * 0.13)], [w * 0.64, y0 + alto * (0.12 + i * 0.13)]], '#f4f4f0', alto * 0.07);
      } else if (vista === 'lado') {
        linea([[w * 0.12, h - alto * 0.42], [w * 0.88, h - alto * 0.42]], '#d9dce1', alto * 0.08);
        ctx.fillStyle = '#9aa0a9';
        ctx.fillRect(w * 0.8, y0 + alto * 0.2, w * 0.2, alto * 0.45);
      } else {
        ctx.fillStyle = '#9aa0a9';
        ctx.fillRect(w * 0.35, y0 + alto * 0.15, w * 0.3, alto * 0.4);
      }
      ctx.fillStyle = COLORES.pantalonOscuro; // ruedo del pantalón sobre la zapatilla
      ctx.fillRect(0, y0 - h * 0.035, w, h * 0.035);
    };
    const bolsillo = (w, h, x0, x1, y0, y1) => {
      ctx.fillStyle = 'rgba(40,44,20,0.25)';
      ctx.fillRect(w * x0, h * y0, w * (x1 - x0), h * (y1 - y0));
      linea([[w * x0, h * y0], [w * x0, h * y1], [w * x1, h * y1], [w * x1, h * y0]], '#3f4425', 5 * k);
      ctx.fillStyle = COLORES.pantalon;
      ctx.fillRect(w * (x0 - 0.03), h * (y0 - 0.04), w * (x1 - x0 + 0.06), h * 0.07);
      linea([[w * (x0 - 0.03), h * (y0 + 0.03)], [w * (x1 + 0.03), h * (y0 + 0.03)]], '#3f4425', 5 * k);
      ctx.fillStyle = '#3f4425';
      ctx.beginPath();
      ctx.arc(w * (x0 + x1) * 0.5, h * y0, 7 * k, 0, Math.PI * 2);
      ctx.fill();
    };

    zona('torsoF', (w, h) => {
      sudadera(w, h);
      // el frente es un trapecio: lo impreso va dentro del 75 % central de arriba
      ctx.fillStyle = '#f1f1ec'; // franela blanca en el cuello
      ctx.beginPath();
      ctx.moveTo(w * 0.42, 0);
      ctx.quadraticCurveTo(w * 0.5, h * 0.13, w * 0.58, 0);
      ctx.fill();
      const borde = [[w * 0.3, 0], [w * 0.4, h * 0.1], [w * 0.5, h * 0.16], [w * 0.6, h * 0.1], [w * 0.7, 0]];
      linea(borde, '#1b1c20', 9 * k);
      linea(borde, 'rgba(255,255,255,0.08)', 3 * k);
      for (const x of [0.455, 0.545]) {
        const x2 = x + (x < 0.5 ? -0.01 : 0.01);
        linea([[w * x, h * 0.14], [w * x2, h * 0.42]], '#f4f4f0', 7 * k);
        ctx.fillStyle = '#b9bec7';
        ctx.fillRect(w * x2 - 5 * k, h * 0.42, 10 * k, h * 0.05);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; // bolsillo canguro
      ctx.beginPath();
      ctx.moveTo(w * 0.27, h * 0.9);
      ctx.lineTo(w * 0.73, h * 0.9);
      ctx.lineTo(w * 0.64, h * 0.6);
      ctx.lineTo(w * 0.36, h * 0.6);
      ctx.closePath();
      ctx.fill();
      linea([[w * 0.27, h * 0.9], [w * 0.36, h * 0.6], [w * 0.64, h * 0.6], [w * 0.73, h * 0.9]], '#17181b', 7 * k);
      linea([[w * 0.36, h * 0.6], [w * 0.64, h * 0.6]], 'rgba(255,255,255,0.1)', 3 * k);
      linea([[w * 0.14, h * 0.02], [w * 0.2, h * 0.3]], 'rgba(0,0,0,0.35)', 4 * k);
      linea([[w * 0.86, h * 0.02], [w * 0.8, h * 0.3]], 'rgba(0,0,0,0.35)', 4 * k);
    });
    zona('torsoB', (w, h) => {
      sudadera(w, h);
      ctx.fillStyle = '#25272c'; // capucha caída en la espalda
      ctx.beginPath();
      ctx.moveTo(w * 0.24, 0);
      ctx.quadraticCurveTo(w * 0.28, h * 0.45, w * 0.5, h * 0.5);
      ctx.quadraticCurveTo(w * 0.72, h * 0.45, w * 0.76, 0);
      ctx.fill();
      linea([[w * 0.24, 0], [w * 0.28, h * 0.3], [w * 0.5, h * 0.5], [w * 0.72, h * 0.3], [w * 0.76, 0]], '#141518', 7 * k);
      linea([[w * 0.5, h * 0.08], [w * 0.5, h * 0.48]], 'rgba(0,0,0,0.4)', 4 * k);
    });
    zona('torsoL', (w, h) => {
      sudadera(w, h);
      linea([[w * 0.5, 0], [w * 0.5, h * 0.93]], 'rgba(0,0,0,0.35)', 4 * k);
    });
    zona('piernaF', (w, h) => {
      camuflaje(w, h);
      bolsillo(w, h, 0.18, 0.82, 0.3, 0.56);
      linea([[w * 0.1, h * 0.64], [w * 0.9, h * 0.64]], 'rgba(40,44,20,0.5)', 3 * k);
      zapatilla(w, h, 'frente');
    });
    zona('piernaL', (w, h) => {
      camuflaje(w, h);
      bolsillo(w, h, 0.3, 0.7, 0.36, 0.58);
      linea([[w * 0.5, 0], [w * 0.5, h * 0.3]], 'rgba(40,44,20,0.5)', 3 * k);
      zapatilla(w, h, 'lado');
    });
    zona('piernaB', (w, h) => {
      camuflaje(w, h);
      zapatilla(w, h, 'atras');
    });
    zona('cadera', (w, h) => {
      camuflaje(w, h);
      ctx.fillStyle = COLORES.pantalonOscuro; // pretina con presillas y botón
      ctx.fillRect(0, 0, w, h * 0.45);
      for (const x of [0.12, 0.3, 0.7, 0.88]) {
        ctx.fillStyle = COLORES.pantalon;
        ctx.fillRect(w * x - 6 * k, 0, 12 * k, h * 0.5);
      }
      ctx.fillStyle = '#c3c7cf';
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.22, 6 * k, 0, Math.PI * 2);
      ctx.fill();
      linea([[w * 0.5, h * 0.45], [w * 0.5, h]], '#3f4425', 4 * k);
    });
  });
}

/**
 * Coordenadas de impresión: cada triángulo toma la zona de la imagen según hacia dónde mira (frente, espalda,
 * costado) y se proyecta en ella con las medidas de la pieza (`caja`), como una calcomanía.
 */
function imprimir(geo, caja, zonas) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const n = new THREE.Vector3();
  const tam = caja.getSize(new THREE.Vector3());
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(c, b).cross(ab.subVectors(a, b)).normalize();
    let z;
    let eje = 'x';
    let espejo = false;
    if (Math.abs(n.z) >= Math.abs(n.x) && Math.abs(n.z) >= Math.abs(n.y)) {
      z = n.z > 0 ? zonas.frente : zonas.espalda;
      espejo = n.z < 0;
    } else if (Math.abs(n.x) >= Math.abs(n.y)) {
      z = zonas.lado;
      eje = 'z';
      espejo = n.x < 0;
    } else {
      z = zonas.arriba || zonas.lado;
    }
    const [u0, v0, u1, v1] = ZONA[z];
    for (let j = 0; j < 3; j++) {
      const p = j === 0 ? a : j === 1 ? b : c;
      let fu = eje === 'x' ? (p.x - caja.min.x) / tam.x : 1 - (p.z - caja.min.z) / tam.z;
      if (espejo) fu = 1 - fu;
      const fv = (p.y - caja.min.y) / tam.y; // 0 abajo, 1 arriba
      uv[(i + j) * 2] = u0 + limitar(fu, 0, 1) * (u1 - u0);
      uv[(i + j) * 2 + 1] = 1 - (v0 + (1 - limitar(fv, 0, 1)) * (v1 - v0));
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/**
 * Junta las piezas que cuelgan DIRECTAMENTE de `grupo` (se mueven juntas) por capa: plástico liso (color por vértice)
 * o plástico impreso (la imagen compartida). Una articulación cuesta 1 o 2 llamadas de dibujo.
 */
function unirPiezas(grupo, propias, fina) {
  grupo.updateMatrix();
  const capas = new Map();
  const quitar = [];
  for (const o of grupo.children) {
    if (!o.isMesh || !o.userData.capa) continue;
    o.updateMatrix();
    const capa = o.userData.capa;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const nombre of Object.keys(g.attributes)) if (nombre !== 'position' && nombre !== 'normal' && !(nombre === 'uv' && capa === 'impreso')) g.deleteAttribute(nombre);
    g.applyMatrix4(o.matrix);
    const cnt = g.attributes.position.count;
    const col = new Float32Array(cnt * 3);
    const c = o.material.color;
    for (let i = 0; i < cnt; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!capas.has(capa)) capas.set(capa, []);
    capas.get(capa).push(g);
    quitar.push(o);
  }
  for (const o of quitar) o.removeFromParent();
  for (const [capa, geos] of capas) {
    const unida = mergeGeometries(geos, false);
    geos.forEach((x) => x.dispose());
    const material = capa === 'impreso' ? trama(`nico-impreso-${fina ? 'fina' : 'liviana'}`, atlas(fina)) : porVertice('plastico');
    const m = new THREE.Mesh(unida, material);
    m.receiveShadow = true;
    m.userData.personaje = true;
    m.userData.capa = capa;
    m.name = `${grupo.name || 'pieza'}:${capa}`;
    propias.push(unida);
    grupo.add(m);
  }
}

/** Crea a Nico. opciones: { liviana = false, semilla = 3 } */
export function crearNico({ liviana = false, semilla: sem = 3 } = {}) {
  const fina = !liviana;
  const Q = fina ? { cil: 28, esf: [20, 12], caja: 2, toro: [8, 20], lat: 32 } : { cil: 12, esf: [10, 7], caja: 1, toro: [5, 12], lat: 14 };
  const rnd = semilla(sem);
  const propias = [];
  const geo = (g) => (propias.push(g), g);
  const caja = (w, h, d, r = 0.05) => {
    const chica = Math.min(w, h, d) < 0.15 || Math.max(w, h, d) < 0.6;
    if (chica && !fina) return geo(new THREE.BoxGeometry(w, h, d));
    return geo(new RoundedBoxGeometry(w, h, d, chica ? 1 : Q.caja, r));
  };
  const pieza = (padre, g, color, capa, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(g, plastico(color));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.userData.capa = capa;
    padre.add(m);
    return m;
  };
  const grupo = (nombre, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.name = nombre;
    g.position.set(x, y, z);
    return g;
  };
  const P = 'plastico';
  const I = 'impreso';

  // ─── esqueleto: raiz → cuerpo (sube al sentarse, rebota) → figura (TODA la minifigura; se inclina o gira entera,
  //     con el pivote en la cadera) → piernas, cadera y torso → cabeza y brazos ────────────────────────────────────
  const raiz = grupo('nico');
  const cuerpo = grupo('cuerpo');
  raiz.add(cuerpo);
  const figura = grupo('figura', 0, M.cadera, 0);
  cuerpo.add(figura);
  const cadera = grupo('cadera', 0, -M.cadera, 0);
  figura.add(cadera);

  // cadera: bloque con la pretina impresa, entrepierna y eje de las piernas
  {
    const g = new RoundedBoxGeometry(2.0, 0.34, 0.98, Q.caja, 0.06);
    g.translate(0, 1.67, 0);
    g.computeBoundingBox();
    pieza(cadera, geo(imprimir(g, g.boundingBox, { frente: 'cadera', espalda: 'cadera', lado: 'cadera', arriba: 'cadera' })), '#ffffff', I);
    g.dispose();
    pieza(cadera, caja(0.24, 0.5, 0.86, 0.04), COLORES.pantalonOscuro, P, 0, 1.36, -0.02);
    pieza(cadera, geo(new THREE.CylinderGeometry(0.14, 0.14, 1.9, 12)), COLORES.pantalonOscuro, P, 0, 1.5, -0.12, 0, 0, Math.PI / 2);
  }

  // piernas: perfil lateral real (muslo, pie adelantado, tope redondeado alrededor del eje) extruido a lo ancho
  const geoPierna = (() => {
    const s = new THREE.Shape();
    // coordenadas (z, y) desde el eje de la cadera; frente = +z
    s.moveTo(-0.48, -0.12);
    s.lineTo(-0.48, -1.5);
    s.lineTo(0.6, -1.5);
    s.lineTo(0.6, -1.14);
    s.quadraticCurveTo(0.6, -1.05, 0.48, -1.03);
    s.lineTo(0.4, -1.01);
    s.lineTo(0.4, -0.18);
    s.quadraticCurveTo(0.4, 0.12, 0.05, 0.14);
    s.quadraticCurveTo(-0.44, 0.12, -0.48, -0.12);
    const b = fina ? 0.045 : 0.03;
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.94 - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: fina ? 2 : 1, curveSegments: fina ? 8 : 3 });
    g.rotateY(-Math.PI / 2); // forma: x → z (frente), extrusión → -x
    g.translate((0.94 - 2 * b) / 2, 0, 0);
    g.computeBoundingBox();
    const imp = imprimir(g, g.boundingBox, { frente: 'piernaF', espalda: 'piernaB', lado: 'piernaL', arriba: 'piernaL' });
    g.dispose();
    return geo(imp);
  })();
  const hueco = geo(new THREE.CircleGeometry(0.24, fina ? 24 : 12));
  const borde = geo(new THREE.RingGeometry(0.24, 0.29, fina ? 24 : 12));
  const pierna = (lado) => {
    const g = grupo(lado < 0 ? 'piernaI' : 'piernaD', lado * 0.5, 0, 0);
    pieza(g, geoPierna, '#ffffff', I);
    // dos huecos redondos atrás (como las piernas reales)
    for (const y of [-0.42, -1.08]) {
      pieza(g, hueco, COLORES.hueco, P, 0, y, -0.532, 0, Math.PI);
      pieza(g, borde, COLORES.pantalonOscuro, P, 0, y, -0.531, 0, Math.PI);
    }
    return g;
  };
  const piernaI = pierna(-1);
  const piernaD = pierna(1);
  figura.add(piernaI, piernaD); // cuelgan del pivote de la figura, que está a la altura del eje de la cadera

  // ─── torso: trapecio real (más angosto en los hombros), frente y espalda planos, bordes redondeados ───────────────
  const torso = grupo('torso', 0, M.cinturaY - M.cadera, 0);
  figura.add(torso);
  {
    const g = new RoundedBoxGeometry(M.torsoAbajo, M.torsoAlto, M.torsoFondo, fina ? 3 : 1, 0.12);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = (y + M.torsoAlto / 2) / M.torsoAlto; // 0 abajo, 1 arriba
      pos.setX(i, pos.getX(i) * (1 - (1 - M.torsoArriba / M.torsoAbajo) * t));
      pos.setZ(i, pos.getZ(i) * (1 - 0.08 * t));
      pos.setY(i, y + M.torsoAlto / 2);
    }
    g.computeVertexNormals();
    g.computeBoundingBox();
    const imp = imprimir(g, g.boundingBox, { frente: 'torsoF', espalda: 'torsoB', lado: 'torsoL', arriba: 'torsoL' });
    g.dispose();
    pieza(torso, geo(imp), '#ffffff', I);
    pieza(torso, geo(new THREE.CylinderGeometry(0.27, 0.29, M.cuello, 18)), COLORES.piel, P, 0, M.torsoAlto + M.cuello / 2 - 0.01, 0);
  }
  // capucha caída (pieza accesorio de LEGO, como en la hoja de referencia): un rollo grueso que rodea el cuello por los
  // lados y por detrás (abierto adelante, donde se ve la franela), que sube detrás de la nuca, y la capucha que cae
  // sobre la espalda terminando en punta. Va POR FUERA de todo: deja libre la cabeza (que gira), el pelo y los brazos.
  const capucha = { rollo: null, espalda: null };
  {
    const suaveC = (x) => {
      const k = Math.min(1, Math.max(0, x));
      return k * k * (3 - 2 * k);
    };
    const abertura = 0.62; // media abertura adelante (rad)
    const NT = fina ? 56 : 24; // a lo largo
    const NS = fina ? 14 : 7; // alrededor del rollo
    const forma = (th) => {
      // th: 0 = frente, π = espalda
      const a = Math.abs(Math.atan2(Math.sin(th), Math.cos(th)));
      const sube = suaveC((a - 2.12) / 0.62); // solo detrás de la nuca, lejos de los brazos
      // adelante y a los lados es un borde que llega justo debajo de la cabeza; detrás de la nuca se hace grueso y
      // redondo, separado de la cabeza (que gira) y por debajo del pelo
      const r = 0.5 + 0.25 * Math.min(1, sube / 0.25); // detrás, el rollo se aleja de la cabeza antes de crecer
      const alto = 0.062 + 0.085 * sube; // media altura del rollo
      const ancho = 0.1 + 0.035 * sube; // medio grosor del rollo
      const baja = 0;
      const punta = 0.3 + 0.7 * suaveC((a - abertura) / 0.4); // las puntas de adelante terminan redondeadas
      return { r, alto: alto * punta, ancho: ancho * punta, baja };
    };
    const pos = [];
    const idx = [];
    for (let i = 0; i <= NT; i++) {
      const th = abertura + (i / NT) * (Math.PI * 2 - 2 * abertura);
      const { r, alto, ancho, baja } = forma(th);
      const nx = Math.sin(th);
      const nz = Math.cos(th);
      const cy = M.torsoAlto + alto * 0.92 - baja; // apoyado sobre los hombros
      for (let j = 0; j <= NS; j++) {
        const fi = (j / NS) * Math.PI * 2;
        const rr = r + Math.cos(fi) * ancho;
        pos.push(nx * rr, cy + Math.sin(fi) * alto, nz * rr - 0.02);
      }
    }
    for (let i = 0; i < NT; i++) {
      for (let j = 0; j < NS; j++) {
        const a = i * (NS + 1) + j;
        const b = a + NS + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    // tapas de los extremos (adelante)
    for (const [i, sentido] of [[0, -1], [NT, 1]]) {
      const c = pos.length / 3;
      const th = abertura + (i / NT) * (Math.PI * 2 - 2 * abertura);
      const { r, alto, baja } = forma(th);
      pos.push(Math.sin(th) * r, M.torsoAlto + alto * 0.92 - baja, Math.cos(th) * r - 0.02);
      for (let j = 0; j < NS; j++) {
        const a = i * (NS + 1) + j;
        if (sentido > 0) idx.push(c, a, a + 1);
        else idx.push(c, a + 1, a);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    capucha.rollo = pieza(torso, geo(g), COLORES.sudadera, P);
    capucha.rollo.name = 'capucha-rollo';

    // la capucha sobre la espalda: tela con forma de escudo (ancha arriba, en punta abajo), apenas separada de la
    // espalda del torso y siguiendo su inclinación; con borde redondeado
    const s = new THREE.Shape();
    s.moveTo(-0.56, 0);
    s.quadraticCurveTo(-0.58, -0.44, -0.13, -0.76);
    s.quadraticCurveTo(0, -0.85, 0.13, -0.76);
    s.quadraticCurveTo(0.58, -0.44, 0.56, 0);
    s.quadraticCurveTo(0, 0.06, -0.56, 0);
    const ge = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: fina ? 3 : 1, curveSegments: fina ? 12 : 5 });
    ge.rotateY(Math.PI); // de cara hacia atrás
    // volumen de tela: gruesa arriba (donde se une con el rollo de la nuca) y delgada hacia la punta; la cara de
    // atrás se abomba un poco hacia los lados
    const pe = ge.attributes.position;
    for (let i = 0; i < pe.count; i++) {
      const x = pe.getX(i);
      const y = pe.getY(i);
      const z = pe.getZ(i);
      if (z < -0.03) {
        const arriba = suaveC((y + 0.8) / 0.8) ** 1.4;
        pe.setZ(i, z - (0.15 * arriba + 0.025) * (1 - 0.45 * (x / 0.58) ** 2));
      }
    }
    ge.computeVertexNormals();
    const espaldaZ = -(M.torsoFondo / 2) * (1 - 0.08 * ((M.torsoAlto - 0.3) / M.torsoAlto)) - 0.012;
    capucha.espalda = pieza(torso, geo(ge), COLORES.sudadera, P, 0, M.torsoAlto + 0.02, espaldaZ, -0.025);
    capucha.espalda.name = 'capucha-espalda';
    // puntos de la capucha en coordenadas del torso (para la prueba de que no atraviesa cabeza, pelo ni brazos)
    const v3 = new THREE.Vector3();
    const puntos = [];
    for (const m of [capucha.rollo, capucha.espalda]) {
      m.updateMatrix();
      const pa = m.geometry.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        v3.fromBufferAttribute(pa, i).applyMatrix4(m.matrix);
        puntos.push(v3.x, v3.y, v3.z);
      }
    }
    capucha.puntos = new Float32Array(puntos);
    // costura del centro
      }

  // ─── brazos: pieza rígida (hombro redondeado al costado, manga que baja un poco abierta, codo doblado fijo) ──────
  // mano LEGO: una C con el eje atravesado (de adelante hacia atrás) y la abertura hacia ABAJO, lejos de la muñeca
  const geoMano = (() => {
    const R = 0.2;
    const w = 0.065;
    const medio = 0.62; // media abertura (rad)
    const a0 = -Math.PI / 2 + medio;
    const a1 = -Math.PI / 2 - medio + Math.PI * 2;
    const pto = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
    const s = new THREE.Shape();
    s.moveTo(...pto(a0, R + w));
    s.absarc(0, 0, R + w, a0, a1, false);
    const [c1x, c1y] = pto(a1, R);
    s.absarc(c1x, c1y, w, a1, a1 + Math.PI, false);
    s.absarc(0, 0, R - w, a1, a0, true);
    const [c0x, c0y] = pto(a0, R);
    s.absarc(c0x, c0y, w, a0 + Math.PI, a0 + Math.PI * 2, false);
    const b = fina ? 0.025 : 0;
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.3 - 2 * b, bevelEnabled: fina, bevelThickness: b, bevelSize: b * 0.8, bevelSegments: 2, curveSegments: fina ? 14 : 6 });
    g.translate(0, 0, -(0.3 - 2 * b) / 2);
    return geo(g);
  })();
  const CENTRO_MANO = new THREE.Vector3(0, -0.36, 0); // centro de la C, justo debajo de la muñeca
  const brazo = (lado) => {
    const hombro = grupo(lado < 0 ? 'hombroI' : 'hombroD', lado * M.hombroX, M.hombroY, 0);
    const c = COLORES.sudadera;
    const tapa = pieza(hombro, geo(new THREE.SphereGeometry(0.27, Q.esf[0], Q.esf[1])), c, P, lado * 0.04, 0, 0);
    tapa.scale.set(0.95, 1, 1);
    pieza(hombro, geo(new THREE.CylinderGeometry(0.255, 0.235, 0.62, Q.cil)), c, P, lado * 0.075, -0.31, 0, 0, 0, lado * 0.1);
    const codo = new THREE.Vector3(lado * 0.11, -0.62, 0);
    pieza(hombro, geo(new THREE.SphereGeometry(0.235, Q.esf[0], Q.esf[1])), c, P, codo.x, codo.y, codo.z);
    const dir = new THREE.Vector3(0, -Math.cos(M.codo), Math.sin(M.codo));
    const ante = codo.clone().addScaledVector(dir, 0.24);
    pieza(hombro, geo(new THREE.CylinderGeometry(0.235, 0.205, 0.48, Q.cil)), c, P, ante.x, ante.y, ante.z, -M.codo);
    const muneca = grupo(lado < 0 ? 'munecaI' : 'munecaD');
    muneca.position.copy(codo.clone().addScaledVector(dir, 0.5));
    muneca.rotation.x = -M.codo; // el eje de la muñeca sigue el antebrazo; la mano GIRA sobre ese eje (rotation.y)
    const pin = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 12)), plastico(COLORES.piel));
    pin.position.y = -0.04;
    const mano = new THREE.Mesh(geoMano, plastico(COLORES.piel));
    mano.position.copy(CENTRO_MANO);
    mano.name = 'mano';
    muneca.add(pin, mano);
    hombro.add(muneca);
    return { hombro, muneca };
  };
  const bI = brazo(-1);
  const bD = brazo(1);
  torso.add(bI.hombro, bD.hombro);

  // ─── cabeza: cilindro con bordes redondeados y taquito arriba; cara impresa ─────────────────────────────────────
  const cabeza = grupo('cabeza', 0, M.torsoAlto + M.cuello - 0.02, 0);
  torso.add(cabeza);
  {
    const r = M.cabezaR;
    const h = M.cabezaAlto;
    const e = 0.12;
    const perfil = [new THREE.Vector2(0, 0), new THREE.Vector2(r - e, 0)];
    const arco = (cx, cy, a0, a1, n) => {
      for (let i = 1; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        perfil.push(new THREE.Vector2(cx + Math.cos(a) * e, cy + Math.sin(a) * e));
      }
    };
    arco(r - e, e, -Math.PI / 2, 0, fina ? 4 : 2);
    perfil.push(new THREE.Vector2(r, h - e));
    arco(r - e, h - e, 0, Math.PI / 2, fina ? 4 : 2);
    perfil.push(new THREE.Vector2(0, h));
    pieza(cabeza, geo(new THREE.LatheGeometry(perfil, Q.lat)), COLORES.piel, P);
  }
  const rostro = crearCaraNico({ fina });
  rostro.malla.position.y = 0.12 + CARA.alto / 2;
  cabeza.add(rostro.malla);

  // ─── pelo: una pieza de pelo LEGO (como las de referencia): casco hueco con mechones en relieve, flequillo barrido
  //     que termina arriba de las cejas, lados que bajan hasta media cara y nuca hasta el cuello. Es más grande que la
  //     cabeza en todo su contorno (por dentro también), así que nunca la atraviesa.
  const pelo = grupo('pelo');
  cabeza.add(pelo);
  {
    // Una sola pieza moldeada (como el pelo LEGO real): casco hueco cuya superficie está ESCULPIDA en mechones gruesos y
    // redondeados que nacen en la coronilla y bajan con un barrido; entre mechón y mechón hay un surco, y en el borde
    // cada mechón termina en punta. Por dentro es liso y más grande que la cabeza: nunca la atraviesa.
    const N = fina ? 112 : 44; // divisiones alrededor
    const V = fina ? 24 : 10; // divisiones de arriba al borde
    const R0 = 0.662;
    const grosor = 0.045;
    const topY = M.cabezaAlto + 0.17;
    const hombro = M.cabezaAlto - 0.12;
    const MECHONES = 11; // mechones alrededor de la cabeza
    // flujo de los mechones: giran un poco al bajar y el flequillo se barre hacia un lado
    const flujo = (th, v) => th + 0.55 * v + 0.45 * v * Math.max(0, Math.cos(th)) ** 2;
    const cresta = (th, v) => Math.abs(Math.sin((MECHONES * flujo(th, v)) / 2)) ** 0.55; // 0 en el surco, 1 al centro
    const borde = (th) => {
      const f = Math.pow((1 + Math.cos(th)) / 2, 1.3);
      // cada mechón baja en punta: el borde es más bajo al centro del mechón
      return Math.min(hombro - 0.04, 0.3 + 0.68 * f - 0.09 * cresta(th, 1) ** 2);
    };
    const Ld = (Math.PI / 2) * 0.5 * (R0 + (topY - hombro));
    const superficie = (th, v, dentro) => {
      const b = borde(th);
      const Lw = hombro - b;
      const sL = v * (Ld + Lw);
      let x;
      let y;
      if (sL < Ld) {
        const fi = (sL / Ld) * (Math.PI / 2);
        x = Math.sin(fi);
        y = hombro + (topY - hombro) * Math.cos(fi);
      } else {
        x = 1;
        y = hombro - (sL - Ld);
      }
      let r = R0 * x;
      if (dentro) {
        r = Math.max(0, r - grosor * x);
        y -= grosor * (1 - x);
      } else {
        // relieve: mechones (y vetas finas en Alta); se suaviza en la coronilla, de donde salen todos
        const nace = Math.min(1, v / 0.22);
        const d = (0.045 * cresta(th, v) + (fina ? 0.008 * Math.abs(Math.sin((3 * MECHONES * flujo(th, v)) / 2)) : 0)) * nace * nace;
        r += d * x;
        y += d * (1 - x);
        r += 0.015 * v * v * x; // el borde se abre un poco, como el pelo de verdad
      }
      return [Math.sin(th) * r, y, Math.cos(th) * r];
    };
    const pos = [];
    const idx = [];
    for (const dentro of [false, true]) for (let i = 0; i < N; i++) for (let j = 0; j <= V; j++) pos.push(...superficie((i / N) * Math.PI * 2, j / V, dentro));
    const id = (dentro, i, j) => (dentro ? N * (V + 1) : 0) + (i % N) * (V + 1) + j;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < V; j++) {
        const [a, b, c, d] = [id(false, i, j), id(false, i + 1, j), id(false, i + 1, j + 1), id(false, i, j + 1)];
        idx.push(a, d, b, b, d, c);
        const [e, f, g2, h2] = [id(true, i, j), id(true, i + 1, j), id(true, i + 1, j + 1), id(true, i, j + 1)];
        idx.push(e, f, h2, f, g2, h2);
      }
      const [a, b, c, d] = [id(false, i, V), id(false, i + 1, V), id(true, i + 1, V), id(true, i, V)];
      idx.push(a, d, b, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    pieza(pelo, geo(g), COLORES.pelo, P);
  }

  // ─── utilería: libreta abierta (mano izquierda, la sostiene por el borde) y bolígrafo (mano derecha) ────────────
  const libreta = grupo('libreta');
  {
    const g = new THREE.Group();
    g.name = 'tapa';
    // abierta: dos hojas con la espiral al centro, en el plano XZ (cara de las hojas hacia +y)
    pieza(g, caja(1.5, 0.05, 1.0, 0.02), COLORES.kraft, P, 0, -0.03, 0);
    pieza(g, caja(0.7, 0.04, 0.92, 0.012), COLORES.hoja, P, -0.37, 0.01, 0);
    pieza(g, caja(0.7, 0.04, 0.92, 0.012), COLORES.hoja, P, 0.37, 0.01, 0);
    const renglon = geo(new THREE.BoxGeometry(0.56, 0.008, 0.012));
    for (let i = 0; i < 5; i++) {
      pieza(g, renglon, COLORES.linea, P, -0.37, 0.034, -0.3 + i * 0.15);
      pieza(g, renglon, COLORES.linea, P, 0.37, 0.034, -0.3 + i * 0.15);
    }
    for (let i = 0; i < 3; i++) pieza(g, geo(new THREE.BoxGeometry(0.42 - i * 0.08, 0.01, 0.022)), COLORES.tinta, P, -0.4, 0.038, -0.3 + i * 0.15);
    const anillo = fina ? geo(new THREE.TorusGeometry(0.045, 0.012, 5, 10)) : geo(new THREE.BoxGeometry(0.08, 0.03, 0.03));
    for (let i = 0; i < 7; i++) pieza(g, anillo, COLORES.espiral, P, 0, 0.03, -0.39 + i * 0.13, 0, fina ? Math.PI / 2 : 0);
    unirPiezas(g, propias, fina);
    // en la mano: el borde largo (cerca del cuerpo) pasa por la C, a lo largo de su eje; con la mano girada 90° en la
    // muñeca, la libreta queda horizontal, abierta hacia arriba y extendida hacia el centro del cuerpo
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -1, 0)));
    g.position.set(0, -0.45, 1.0);
    libreta.add(g);
  }
  libreta.position.copy(CENTRO_MANO);
  bI.muneca.add(libreta);

  const boli = grupo('boligrafo');
  {
    const g = new THREE.Group();
    g.name = 'cuerpo-boli';
    // bolígrafo LEGO: barra del grosor del agarre de la mano, punta metálica y clip
    pieza(g, geo(new THREE.CylinderGeometry(0.11, 0.11, 0.7, 14)), COLORES.boli, P, 0, 0.02, 0);
    pieza(g, geo(new THREE.CylinderGeometry(0.11, 0.06, 0.12, 14)), COLORES.metal, P, 0, -0.39, 0);
    pieza(g, geo(new THREE.ConeGeometry(0.06, 0.12, 12)), '#1d1f25', P, 0, -0.51, 0, Math.PI);
    pieza(g, geo(new THREE.CylinderGeometry(0.115, 0.115, 0.08, 14)), COLORES.metal, P, 0, 0.4, 0);
    pieza(g, caja(0.04, 0.26, 0.05, 0.01), COLORES.metal, P, 0, 0.26, 0.13);
    unirPiezas(g, propias, fina);
    boli.add(g);
  }
  // el bolígrafo pasa por la C a lo largo de su eje (como toda herramienta LEGO); con el brazo al frente queda
  // vertical, con la punta hacia abajo y un poco hacia el centro del cuerpo
  boli.children[0].rotation.x = Math.PI / 2;
  boli.position.copy(CENTRO_MANO);
  boli.rotation.set(0, 0.8, 0);
  bD.muneca.add(boli);

  // ─── señal: bombillo de idea (la del kit de Nico en la oficina SVG) ────────────────────────────────────────────
  const senal = new THREE.Group();
  senal.name = 'senal';
  {
    const vidrio = new THREE.MeshStandardMaterial({ color: '#ffe066', emissive: '#ffb300', emissiveIntensity: 0.75, roughness: 0.25 });
    const bulbo = new THREE.Mesh(geo(new THREE.SphereGeometry(0.32, Q.esf[0], Q.esf[1])), vidrio);
    bulbo.position.y = 0.15;
    const rosca = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.15, 0.13, 0.22, 16)), plastico('#8a8f9c'));
    rosca.position.y = -0.2;
    senal.add(bulbo, rosca);
    const rayos = new THREE.Group();
    rayos.name = 'rayos';
    for (let i = 0; i < 5; i++) {
      const a = -1.0 + i * 0.5;
      const r = new THREE.Mesh(geo(new THREE.BoxGeometry(0.06, 0.2, 0.06)), vidrio);
      r.position.set(Math.sin(a) * 0.6, 0.15 + Math.cos(a) * 0.6, 0);
      r.rotation.z = -a;
      rayos.add(r);
    }
    senal.add(rayos);
    senal.userData.liberarMaterial = vidrio;
  }
  senal.position.set(1.3, 6.4, 0);
  senal.visible = false;
  raiz.add(senal);

  // ─── juntar piezas por articulación ─────────────────────────────────────────────────────────────────────────────
  for (const g of [cadera, piernaI, piernaD, torso, bI.hombro, bD.hombro, cabeza, pelo]) unirPiezas(g, propias, fina);
  const usadas = new Set();
  raiz.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      usadas.add(o.geometry);
    }
  });
  for (const g of new Set(propias)) if (!usadas.has(g) && !g.userData.compartida) g.dispose();
  propias.length = 0;
  for (const g of usadas) if (!g.userData.compartida && g !== rostro.malla.geometry) propias.push(g);

  // ─── animación: SOLO articulaciones reales + la figura entera ──────────────────────────────────────────────────
  // cabY: cabeza (gira) · bI, bD: hombros (adelante/atrás; negativo = hacia adelante y arriba) · mI, mD: giro de cada mano
  // en su muñeca · pI, pD: piernas · figX, figY, figZ: inclinación y giro de TODA la figura · alto: salto/rebote
  const CAMPOS = ['cabY', 'bI', 'bD', 'mI', 'mD', 'pI', 'pD', 'figX', 'figY', 'figZ', 'alto'];
  const RAPIDEZ = { cabY: 1.3, bI: 1, bD: 1, mI: 1.5, mD: 1.5, pI: 1, pD: 1, figX: 0.8, figY: 0.8, figZ: 0.8, alto: 2 };
  const LIM = { cabY: [-1.2, 1.2], brazo: [-3.14, 1.2], mano: [-1.6, 1.6], pierna: [-1.0, 1.0], fig: [-0.18, 0.18], figY: [-0.5, 0.5] };
  const v = { ritmo: 0.95 + rnd() * 0.15, fase: rnd() * Math.PI * 2, parpadeo: 3.6 + rnd() * 1.6 };
  const Pq = {};
  const VEL = {};
  const T = {};
  const O = {};
  const Oprev = {};
  for (const c of CAMPOS) Pq[c] = VEL[c] = T[c] = O[c] = Oprev[c] = 0;
  const BASE = expresionNico();
  const X = expresionNico();
  const E = expresionNico();
  const sent = { valor: 0, meta: 0, vel: 0 };
  const yo = { ritmoTecleo: 0, velocidad: 0 };
  const util = { libreta: 0, boli: 0, metaL: 0, metaB: 0, senalPop: 0, miraHablante: 0 };
  const acc = { estado: null, nombre: 'reposo', desde: 0, dur: 1, n: 0, festejo: 0, tEstado: 0, fija: null, listo: false };
  const parp = { proximo: 2 + rnd() * 2, doble: false, inicio: -10, objetivo: 0 };
  const mirada = { yaw: 0, pitch: 0, hasta: 1.5, lado: false };
  let mezcla = 1;
  let faseCaminar = 0;
  let blanco = null;
  let ultimoT = 0;
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const ang = [0, 0];

  const mirarA = (p) => {
    blanco = p ? (blanco || new THREE.Vector3()).copy(p) : null;
  };
  const haciaBlanco = (out) => {
    cabeza.getWorldPosition(va);
    va.y += 0.6;
    raiz.worldToLocal(va);
    vb.copy(blanco);
    raiz.worldToLocal(vb).sub(va);
    out[0] = limitar(Math.atan2(vb.x, vb.z), -1.1, 1.1);
    out[1] = limitar(-Math.atan2(vb.y, Math.hypot(vb.x, vb.z)), -0.5, 0.5);
  };

  // ─── acciones dentro de cada estado (no inventan estados de la app) ────────────────────────────────────────────
  const DUR = {
    teclear: [2.4, 3.6], pensar: [1.9, 2.6], idea: [1.05, 1.05], anotar: [2.9, 3.6],
    reposo: [4.5, 8], pelo: [1.8, 1.8], saludar: [1.9, 1.9], estirarse: [2.7, 2.7], tamborilear: [2.2, 2.6], repasar: [3.0, 3.6],
    asentir: [3.0, 5.0], notas: [2.6, 3.4], hablar: [3.0, 5.0], consultar: [1.9, 1.9],
    escanear: [999, 999], caminar: [999, 999], festejo: [DURACION.terminado, DURACION.terminado],
  };
  const LIBRETA = new Set(['anotar', 'repasar', 'notas', 'consultar']);
  const BOLI = new Set(['anotar', 'notas']);
  function iniciar(nombre, t) {
    const [a, b] = DUR[nombre];
    if (nombre !== acc.nombre) for (const c of CAMPOS) Oprev[c] += O[c] * mezcla;
    acc.nombre = nombre;
    acc.desde = t;
    acc.dur = a + (b - a) * rnd();
    acc.n++;
    mezcla = 0;
  }
  const primera = (estado) => ({ thinking: 'teclear', searching: 'escanear', talking: 'hablar', walking: 'caminar', escucha: 'asentir', terminado: 'festejo' })[estado] || 'reposo';
  function siguiente(estado, actual) {
    switch (estado) {
      case 'thinking':
        return { teclear: 'pensar', pensar: 'idea', idea: 'anotar', anotar: 'teclear' }[actual] || 'teclear';
      case 'escucha':
        return actual === 'asentir' && rnd() < 0.5 ? 'notas' : 'asentir';
      case 'talking':
        return actual === 'hablar' && rnd() < 0.35 ? 'consultar' : 'hablar';
      case 'idle':
      case undefined:
      case null:
        if (actual !== 'reposo') return 'reposo';
        return ['pelo', 'saludar', 'estirarse', 'tamborilear', 'repasar'][Math.floor(rnd() * 5)];
      default:
        return primera(estado);
    }
  }
  function planificar(estado, t) {
    if (acc.fija) {
      // solo pruebas y capturas: mantiene una acción fija (la repite al terminar)
      if (acc.nombre !== acc.fija || acc.estado !== estado || t >= acc.desde + acc.dur) {
        if (acc.estado !== estado) acc.tEstado = t;
        acc.estado = estado;
        iniciar(acc.fija, t);
      }
      return;
    }
    if (acc.estado !== estado) {
      acc.estado = estado;
      acc.tEstado = t;
      if (estado === 'terminado') acc.festejo = (acc.festejo + 1) % 2;
      iniciar(primera(estado), t);
      mirada.lado = false;
      mirada.hasta = t + 1.2;
      return;
    }
    // si llega texto de verdad ("Escribiendo…"), deja lo que esté haciendo y teclea
    if (estado === 'thinking' && yo.ritmoTecleo > 0.5 && acc.nombre !== 'teclear') iniciar('teclear', t);
    if (t >= acc.desde + acc.dur) iniciar(estado === 'thinking' && yo.ritmoTecleo > 0.5 ? 'teclear' : siguiente(estado, acc.nombre), t);
  }

  const GESTOS = [
    // [hombro derecho, hombro izquierdo, giro mano derecha, giro mano izquierda]
    [-1.0, -0.55, 0.5, -0.3], // "fíjense"
    [-1.6, -0.25, 0.2, 0], // señala al frente
    [-0.65, -1.1, 0, -0.5], // con la izquierda
    [-1.25, -1.25, 0.6, -0.6], // explica con las dos
    [-2.1, -0.4, 0.9, 0], // "tengo una idea" (mano arriba)
    [-0.4, -0.4, 0, 0], // manos abajo, pausa
  ];

  function poses(estado, t) {
    for (const c of CAMPOS) {
      T[c] = 0;
      O[c] = 0;
    }
    Object.assign(X, BASE);
    const f = v.ritmo;
    const ph = v.fase;
    const tt = t - acc.desde;
    const u = acc.dur ? limitar(tt / acc.dur, 0, 1) : 0;
    const ent = suave(tt / 0.3) * suave((acc.dur - tt) / 0.3);
    const sentado = sent.valor > 0.5;
    let k = 7;
    switch (acc.nombre) {
      case 'teclear': {
        // brazos al frente; golpecitos alternados en el hombro y giros de muñeca (como en stop-motion)
        const rapido = yo.ritmoTecleo;
        T.bI = T.bD = -0.95;
        T.mI = -0.35;
        T.mD = 0.35;
        T.figX = 0.04 + 0.03 * rapido;
        T.cabY = 0.1 * Math.sin(t * 0.5 * f + ph);
        const vel = 16 + 10 * rapido;
        const rafaga = 0.55 + 0.45 * Math.sin(t * 1.7 + ph) ** 2;
        O.bI = 0.07 * Math.sin(t * vel * f) * rafaga;
        O.bD = 0.07 * Math.sin(t * vel * f + 2.1) * rafaga;
        O.mI = 0.12 * Math.sin(t * vel * 0.5) * rafaga;
        O.mD = -0.12 * Math.sin(t * vel * 0.5 + 1) * rafaga;
        X.sonrisa = 0.55 - 0.25 * rapido;
        X.boca = 0.1;
        X.dientes = 0.6;
        X.cejaIt = X.cejaDt = 0.25 + 0.25 * rapido;
        X.miraY = 0.75;
        X.miraX = 0.25 * Math.sin(t * 1.3);
        X.ojo = 0.92;
        X.lengua = 0.5 * rapido;
        X.ladeo = 0.35 * rapido;
        k = 8;
        break;
      }
      case 'pensar': {
        // mano levantada frente a la cara, cabeza de lado y mirada arriba ("mmm…")
        T.bD = -2.35;
        T.mD = 0.7;
        T.bI = -0.6;
        T.cabY = -0.4;
        T.figZ = 0.05;
        T.figX = -0.04;
        O.mD = 0.25 * Math.sin(t * 7) * ent; // golpecitos con la mano
        O.cabY = 0.05 * Math.sin(t * 1.4);
        X.miraY = -0.95;
        X.miraX = -0.6;
        X.cejaIh = 0.55;
        X.cejaDh = -0.05;
        X.cejaDt = 0.35;
        X.sonrisa = 0.15;
        X.boca = 0;
        X.ladeo = -0.75;
        X.dientes = 0;
        k = 6;
        break;
      }
      case 'idea': {
        // ¡eureka!: brazo arriba y salto de toda la figura
        const pico = tt < 0.18 ? suave(tt / 0.18) : 1;
        T.bD = -3.0 * pico;
        T.mD = -0.4;
        T.bI = -0.5;
        T.figX = -0.06;
        O.alto = 0.32 * Math.max(0, Math.sin(Math.min(1, tt / 0.45) * Math.PI));
        O.bD = 0.1 * Math.sin(tt * 18) * Math.exp(-tt * 3);
        X.ojo = 1.35;
        X.cejaIh = X.cejaDh = 0.9;
        X.cejaIt = X.cejaDt = -0.3;
        X.redondo = 0.95;
        X.boca = 0.65;
        X.sonrisa = 0.3;
        X.dientes = 0;
        X.miraY = -0.5;
        k = 14;
        break;
      }
      case 'anotar':
      case 'notas': {
        // libreta abierta frente al pecho (mano izquierda), escribe con la derecha: la muñeca gira en trazos cortos
        T.bI = -1.22;
        T.mI = Math.PI / 2; // la mano izquierda gira en la muñeca para que la libreta quede horizontal
        T.bD = -1.42;
        T.mD = 0;
        T.figX = 0.07;
        T.cabY = -0.1;
        const linea = Math.floor(tt / 0.85);
        const enLinea = (tt % 0.85) / 0.85;
        O.mD = (0.28 * Math.sin(t * 15) + 0.2 * (enLinea - 0.5)) * ent;
        O.bD = (0.035 * Math.sin(t * 9) - 0.03 * (linea % 3)) * ent;
        X.miraY = 1;
        X.miraX = -0.3 + 0.4 * enLinea;
        X.cejaIt = X.cejaDt = 0.45;
        X.cejaIh = X.cejaDh = -0.1;
        X.boca = 0;
        X.sonrisa = 0.45;
        X.lengua = 0.85;
        X.ladeo = 0.45;
        X.dientes = 0;
        X.ojo = 0.9;
        if (acc.nombre === 'notas' && blanco) {
          // en reunión: anota y levanta la vista hacia quien habla cada tanto
          const sube = suave((Math.sin(t * 1.3 + ph) - 0.35) * 2.5);
          X.miraY -= 1.6 * sube;
          X.lengua *= 1 - sube;
          util.miraHablante = sube;
        }
        if (u > 0.82 && acc.nombre === 'anotar') {
          // termina satisfecho: rebotito y sonrisa
          O.alto = 0.06 * Math.max(0, Math.sin((u - 0.82) * 35));
          X.lengua = 0;
          X.sonrisa = 0.85;
          X.boca = 0.25;
          X.dientes = 1;
          X.miraY = 0.2;
        }
        k = 8;
        break;
      }
      case 'repasar':
      case 'consultar': {
        T.bI = -1.22;
        T.mI = Math.PI / 2;
        T.bD = sentado ? -0.6 : -0.15;
        T.cabY = -0.15;
        T.figX = 0.05;
        O.cabY = 0.06 * Math.sin(t * 2.4);
        X.miraY = 0.95;
        X.miraX = -0.5 + ((t * 0.8) % 1);
        X.cejaIh = 0.15;
        X.cejaDh = 0.25;
        X.sonrisa = 0.5;
        X.boca = 0.05;
        X.dientes = 0.3;
        if (acc.nombre === 'consultar') {
          X.sonrisa = 0.7;
          X.boca = 0.25 * Math.max(0, Math.sin(t * 6));
        }
        k = 7;
        break;
      }
      case 'hablar': {
        const periodo = 1.15 / f;
        const p = t / periodo + ph / 6.2832;
        const idx = Math.floor(p);
        const w = p - idx;
        const acento = Math.exp(-(((w - 0.38) / 0.2) ** 2));
        const g = GESTOS[Math.floor(hash(Math.floor(idx / 2) + sem) * GESTOS.length)];
        T.bD = g[0];
        T.bI = g[1];
        T.mD = g[2];
        T.mI = g[3];
        O.bD = -0.25 * acento;
        O.bI = -0.12 * acento;
        O.mD = 0.3 * acento;
        O.alto = 0.05 * acento;
        O.figX = 0.04 * acento;
        T.cabY = 0.14 * Math.sin(p * 0.37);
        T.figY = 0.06 * Math.sin(p * 0.23 + 1);
        const silabas = t * 5.6 * f;
        const s = Math.floor(silabas);
        const ws = silabas - s;
        const frase = (t * 0.42 + ph) % 1;
        const pausa = frase > 0.86 ? 0 : 1;
        const abre = Math.sin(Math.PI * ws) ** 0.8 * (0.45 + 0.55 * hash(s)) * pausa;
        X.boca = 0.08 + 0.75 * abre;
        X.redondo = hash(s + 0.5) > 0.72 ? 0.7 * abre : 0;
        X.dientes = 0.9;
        X.sonrisa = 0.7 - 0.3 * X.redondo;
        X.cejaIh = X.cejaDh = 0.1 + 0.45 * acento;
        X.ojo = 1 + 0.1 * acento;
        k = 7;
        break;
      }
      case 'asentir': {
        // escucha: "asiente" con toda la figura (la cabeza de una minifigura no se inclina)
        const cadaCuanto = 3.2 / f;
        const asiente = Math.max(0, Math.sin((Math.PI * 2 * t) / cadaCuanto + ph)) ** 6;
        T.cabY = 0.25;
        T.bD = sentado ? -0.75 : -0.15;
        T.bI = sentado ? -0.6 : -0.1;
        O.figX = 0.07 * asiente;
        O.alto = 0.03 * asiente;
        X.miraY = 0.25 * asiente;
        X.ojo = 1.05;
        X.cejaIh = 0.4;
        X.cejaDh = 0.55;
        X.cejaIt = -0.15;
        X.cejaDt = -0.2;
        X.sonrisa = 0.6;
        X.boca = 0.08;
        X.dientes = 0.5;
        X.rubor = 0.15;
        k = 5;
        break;
      }
      case 'escanear': {
        T.bI = -1.05;
        T.bD = -1.12;
        T.mI = -0.3;
        T.figX = 0.06;
        T.cabY = 0.5 * Math.sin(t * 0.8 * f + ph);
        T.figY = 0.08 * Math.sin(t * 0.8 * f + ph);
        O.mD = 0.25 * Math.sin(t * 6) + (Math.sin(t * 2.6) > 0.94 ? -0.3 : 0);
        O.bD = Math.sin(t * 2.6) > 0.94 ? -0.06 : 0;
        X.ojo = 0.78;
        X.cejaIt = X.cejaDt = 0.35;
        X.cejaIh = X.cejaDh = -0.15;
        X.sonrisa = 0.35;
        X.boca = 0;
        X.miraX = 0.6 * Math.sin(t * 0.8 * f + ph + 0.4);
        X.miraY = 0.45;
        k = 7;
        break;
      }
      case 'caminar': {
        // marcha de minifigura: piernas y brazos alternados, rebote y balanceo de toda la figura
        const vel = yo.velocidad;
        const a = limitar(0.32 + vel * 0.045, 0.32, 0.65);
        const s = Math.sin(faseCaminar);
        const c2 = Math.cos(2 * faseCaminar);
        const arranque = limitar(vel / 3, 0, 1);
        O.pI = -a * s * arranque;
        O.pD = a * s * arranque;
        O.bI = 0.85 * a * s * arranque;
        O.bD = -0.85 * a * s * arranque;
        O.figZ = 0.05 * s * arranque;
        O.figY = 0.06 * s * arranque;
        O.cabY = -0.08 * s * arranque;
        O.alto = 0.09 * (1 - c2) * 0.5 * arranque;
        T.figX = 0.04 * arranque;
        X.sonrisa = 0.85;
        X.boca = 0.22;
        X.miraY = -0.1;
        k = 9;
        break;
      }
      case 'festejo': {
        const d = DURACION.terminado;
        const arriba = tt < 0.3 ? suave(tt / 0.3) : tt < d - 0.45 ? 1 : 1 - suave((tt - (d - 0.45)) / 0.45);
        if (acc.festejo === 0) {
          // puño arriba con salto: "¡listo!"
          T.bD = -3.0 * arriba;
          T.mD = -0.6 * arriba;
          O.bD = 0.25 * Math.sin(tt * 14) * arriba * (tt > 0.3 ? 1 : 0);
          O.alto = 0.22 * Math.max(0, Math.sin(Math.min(1, tt / 0.5) * Math.PI));
          T.figZ = -0.06 * arriba;
        } else {
          // los dos brazos arriba y se echa para atrás entero
          T.bD = T.bI = -3.0 * arriba;
          T.figX = -0.12 * arriba;
          O.figZ = 0.05 * Math.sin(tt * 5) * arriba;
          O.alto = 0.12 * Math.max(0, Math.sin(Math.min(1, tt / 0.5) * Math.PI));
        }
        X.feliz = arriba;
        X.sonrisa = 1.0;
        X.boca = 0.55 * arriba;
        X.dientes = 1;
        X.rubor = 0.7 * arriba;
        X.cejaIh = X.cejaDh = 0.4 * arriba;
        k = 16;
        break;
      }
      case 'pelo': {
        // se pasa la mano por el pelo: mano derecha arriba, junto a la cabeza, con un par de pasadas
        const e = suave(u / 0.25) * suave((1 - u) / 0.25);
        T.bD = -2.8 * e;
        T.mD = 0.9 * e;
        O.bD = 0.09 * Math.sin(tt * 8) * e;
        O.mD = 0.3 * Math.sin(tt * 8) * e;
        T.cabY = 0.25 * e;
        T.bI = sentado ? -0.6 : 0;
        X.sonrisa = 0.9;
        X.boca = 0.15;
        X.ladeo = 0.5 * e;
        X.ojo = 1 - 0.45 * e;
        k = 7;
        break;
      }
      case 'saludar': {
        // saluda a alguien con la mano izquierda (la muñeca gira de lado a lado) y sonríe
        const e = suave(u / 0.2) * suave((1 - u) / 0.25);
        T.bI = -2.6 * e - (sentado ? 0.5 * (1 - e) : 0);
        O.mI = 0.7 * Math.sin(tt * 11) * e;
        O.bI = 0.05 * Math.sin(tt * 11 + 1) * e;
        T.cabY = -0.45 * e;
        T.figY = -0.08 * e;
        T.bD = sentado ? -0.6 : 0;
        X.miraX = -0.5 * e;
        X.sonrisa = 0.95;
        X.boca = 0.35 + 0.2 * e;
        X.dientes = 1;
        X.cejaIh = X.cejaDh = 0.35 * e;
        X.rubor = 0.25 * e;
        k = 7;
        break;
      }
      case 'estirarse': {
        const e = suave(u / 0.3) * suave((1 - u) / 0.25);
        T.bI = T.bD = -3.0 * e;
        T.mI = 0.4 * e;
        T.mD = -0.4 * e;
        T.figX = -0.12 * e;
        O.figZ = 0.05 * Math.sin(tt * 3) * e;
        const bostezo = suave((u - 0.15) / 0.2) * suave((0.8 - u) / 0.2);
        X.ojo = 1 - 0.95 * bostezo;
        X.redondo = 0.75 * bostezo;
        X.boca = 0.95 * bostezo;
        X.dientes = 0.4;
        X.cejaIh = X.cejaDh = 0.4 * bostezo;
        X.miraY = -0.4 * e;
        k = 6;
        break;
      }
      case 'tamborilear': {
        T.bI = T.bD = sentado ? -0.95 : -0.3;
        O.bI = 0.05 * Math.max(0, Math.sin(t * 15)) ** 3;
        O.bD = 0.05 * Math.max(0, Math.sin(t * 15 + 1.6)) ** 3;
        O.mI = 0.3 * Math.sin(t * 15);
        O.mD = 0.3 * Math.sin(t * 15 + 1.6);
        T.cabY = 0.4;
        X.miraX = 0.8;
        X.sonrisa = 0.75;
        X.boca = 0.05;
        X.ladeo = 0.3;
        k = 6;
        break;
      }
      default: {
        // reposo: quieto como un LEGO; vida en los ojos, la cabeza y pequeños gestos
        if (t >= mirada.hasta) {
          mirada.lado = !mirada.lado;
          if (mirada.lado) {
            mirada.yaw = (rnd() < 0.5 ? -1 : 1) * (0.3 + rnd() * 0.5);
            mirada.pitch = -0.3 + rnd() * 0.6;
            mirada.hasta = t + 1.0 + rnd() * 1.4;
          } else {
            mirada.yaw = mirada.pitch = 0;
            mirada.hasta = t + 2.4 + rnd() * 3;
          }
        }
        T.cabY = mirada.yaw;
        X.miraY = mirada.pitch;
        T.bI = T.bD = sentado ? -0.5 : 0;
        // la cara cambia sola de vez en cuando: sonrisa abierta, media sonrisa de lado o boca cerrada tranquila
        const gesto = Math.floor(t / 4.3 + ph);
        const tipo = hash(gesto + sem * 7);
        X.sonrisa = 0.8 + 0.15 * Math.sin(t * 0.21 + ph);
        X.boca = tipo < 0.45 ? 0.36 + 0.1 * Math.sin(t * 0.17) : tipo < 0.75 ? 0 : 0.2;
        X.ladeo = tipo >= 0.45 && tipo < 0.75 ? (hash(gesto) < 0.5 ? -0.6 : 0.6) : 0;
        if (X.ladeo) X.cejaDh = X.ladeo > 0 ? 0.35 : 0;
        if (X.ladeo) X.cejaIh = X.ladeo < 0 ? 0.35 : 0;
        k = 4.5;
      }
    }
    // al pararse o sentarse, la figura entera se inclina un poco hacia adelante
    const s = sent.valor;
    T.figX += 0.12 * 4 * s * (1 - s);
    util.metaL = LIBRETA.has(acc.nombre) && tt > 0.28 && acc.dur - tt > 0.22 ? 1 : 0;
    util.metaB = BOLI.has(acc.nombre) && tt > 0.36 && acc.dur - tt > 0.3 ? 1 : 0;
    if (acc.nombre === 'teclear' || estado === 'walking') util.metaL = util.metaB = 0;
    return k;
  }

  const val = (c) => Pq[c] + O[c] * mezcla + Oprev[c];
  function aplicar(t) {
    const s = suave(sent.valor);
    cuerpo.position.y = Math.max(0, val('alto')) + s * SUBIR_SENTADO;
    figura.rotation.set(limitar(val('figX'), ...LIM.fig), limitar(val('figY'), ...LIM.figY), limitar(val('figZ'), ...LIM.fig));
    // solo los ejes reales: cabeza en Y; hombros en X; manos en su eje (Y local de la muñeca); piernas en X
    cabeza.rotation.set(0, limitar(val('cabY'), ...LIM.cabY), 0);
    bI.hombro.rotation.set(limitar(val('bI'), ...LIM.brazo), 0, 0);
    bD.hombro.rotation.set(limitar(val('bD'), ...LIM.brazo), 0, 0);
    bI.muneca.rotation.set(-M.codo, limitar(val('mI'), ...LIM.mano), 0);
    bD.muneca.rotation.set(-M.codo, limitar(val('mD'), ...LIM.mano), 0);
    piernaI.rotation.set(limitar(val('pI'), ...LIM.pierna) * (1 - s) - (Math.PI / 2) * s, 0, 0);
    piernaD.rotation.set(limitar(val('pD'), ...LIM.pierna) * (1 - s) - (Math.PI / 2) * s, 0, 0);
    // utilería: aparece con rebote, se va encogiendo
    libreta.visible = util.libreta > 0.001;
    libreta.scale.setScalar(util.metaL ? rebote(util.libreta) : util.libreta ** 2);
    boli.visible = util.boli > 0.001;
    boli.scale.setScalar(util.metaB ? rebote(util.boli) : util.boli ** 2);
    // bombillo: late, y en la idea da un salto
    const pop = util.senalPop;
    senal.scale.setScalar(1 + 0.45 * pop + 0.04 * Math.sin(t * 6));
    senal.children[2].rotation.z = 0.1 * Math.sin(t * 4);
    senal.children[2].visible = pop > 0.05 || acc.nombre === 'idea' || acc.nombre === 'anotar';
    let cierre = 0;
    const dp = t - parp.inicio;
    if (dp >= 0 && dp < 0.16) cierre = Math.sin((dp / 0.16) * Math.PI);
    else if (parp.doble && dp >= 0.22 && dp < 0.38) cierre = Math.sin(((dp - 0.22) / 0.16) * Math.PI);
    rostro.actualizar(E, X.feliz > 0.5 ? 0 : cierre);
  }

  function animar(estado, t, dt) {
    const salto = dt >= 0.5; // movimiento reducido: postura fija del estado, sin oscilar
    if (t < ultimoT - 0.5) {
      // el reloj volvió atrás (otra escena, pruebas): se reinician los relojes internos en vez de quedar trabado
      acc.desde = Math.min(acc.desde, t);
      acc.tEstado = Math.min(acc.tEstado, t);
      parp.inicio = -10;
      parp.proximo = t + 2;
      mirada.hasta = t + 1;
    }
    planificar(estado, t);
    if (estado === 'walking' && !salto) faseCaminar += dt * Math.PI * 2 * limitar(yo.velocidad / 3.4, 1.1, 3.8);
    const k = poses(estado, t);
    if (blanco && (estado === 'talking' || estado === 'escucha')) {
      haciaBlanco(ang);
      const peso = acc.nombre === 'notas' ? util.miraHablante : acc.nombre === 'consultar' ? 0.4 : 1;
      T.cabY = T.cabY * (1 - peso) + ang[0] * peso;
      X.miraY += ang[1] * 2 * peso; // arriba/abajo: con los ojos
    }
    util.miraHablante = 0;
    if (salto) {
      for (const c of CAMPOS) {
        Pq[c] = T[c];
        VEL[c] = Oprev[c] = O[c] = 0;
      }
      mezcla = 1;
      sent.valor = sent.meta;
      sent.vel = 0;
      util.libreta = util.metaL;
      util.boli = util.metaB;
      util.senalPop = 0;
      Object.assign(E, X);
      aplicar(0);
      ultimoT = t;
      return false;
    }
    for (const c of CAMPOS) {
      const om = k * RAPIDEZ[c] * 0.6;
      const x = om * dt;
      const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
      const cambio = Pq[c] - T[c];
      const tmp = (VEL[c] + om * cambio) * dt;
      VEL[c] = (VEL[c] - om * tmp) * e;
      Pq[c] = T[c] + (cambio + tmp) * e;
      Oprev[c] *= Math.exp(-dt * 7);
    }
    mezcla = Math.min(1, mezcla + dt / 0.35);
    {
      const om = 7;
      const x = om * dt;
      const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
      const cambio = sent.valor - sent.meta;
      const tmp = (sent.vel + om * cambio) * dt;
      sent.vel = (sent.vel - om * tmp) * e;
      sent.valor = limitar(sent.meta + (cambio + tmp) * e, 0, 1);
    }
    const hacia = (x, meta, vel) => (x < meta ? Math.min(meta, x + dt * vel) : Math.max(meta, x - dt * vel));
    util.libreta = hacia(util.libreta, util.metaL, 1 / 0.24);
    util.boli = hacia(util.boli, util.metaB, 1 / 0.2);
    util.senalPop = acc.nombre === 'idea' ? Math.max(util.senalPop, Math.exp(-(t - acc.desde) * 3.2)) : util.senalPop * Math.exp(-dt * 5);
    X.miraX = limitar(X.miraX + (T.cabY - Pq.cabY) * 1.1, -1, 1);
    X.miraY = limitar(X.miraY, -1, 1);
    for (const c in X) {
      const r = c === 'boca' || c === 'redondo' ? 26 : c.startsWith('mira') ? 14 : c === 'feliz' ? 12 : 8;
      E[c] += (X[c] - E[c]) * (1 - Math.exp(-dt * r));
    }
    // parpadeo natural; además, parpadea al girar la cabeza de golpe (como hacen las personas)
    if (Math.abs(T.cabY - parp.objetivo) > 0.3 && t - parp.inicio > 0.8) parp.proximo = t; // solo cuando decide girar
    parp.objetivo = T.cabY;
    if (t >= parp.proximo) {
      parp.inicio = t;
      parp.doble = rnd() < 0.22;
      parp.proximo = t + (estado === 'talking' ? 2.2 : v.parpadeo) * (0.7 + rnd() * 0.6);
    }
    aplicar(t);
    ultimoT = t;
    if (estado === 'terminado' && t - acc.tEstado >= DURACION.terminado && !acc.listo) {
      acc.listo = true;
      return true;
    }
    if (estado !== 'terminado') acc.listo = false;
    return false;
  }

  function reposo() {
    for (const c of CAMPOS) Pq[c] = VEL[c] = T[c] = O[c] = Oprev[c] = 0;
    Object.assign(X, BASE);
    Object.assign(E, BASE);
    util.libreta = util.boli = util.metaL = util.metaB = 0;
    aplicar(0);
  }
  function sentar(si, inmediato = false) {
    sent.meta = si ? 1 : 0;
    if (inmediato) {
      sent.valor = sent.meta;
      sent.vel = 0;
      aplicar(ultimoT);
    }
  }
  reposo();

  function liberar() {
    for (const g of propias) if (!g.userData.compartida) g.dispose();
    rostro.liberar();
    senal.userData.liberarMaterial?.dispose();
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
    manoIzq: bI.muneca,
    libreta,
    boligrafo: boli,
    torso,
    capucha: capucha.puntos, // solo pruebas: vértices de la capucha (coordenadas del torso)
    // articulaciones reales (para pruebas): solo estas giran, y solo en su eje
    articulaciones: { cabeza: [cabeza, 'y'], hombroI: [bI.hombro, 'x'], hombroD: [bD.hombro, 'x'], manoI: [bI.muneca, 'y'], manoD: [bD.muneca, 'y'], piernaI: [piernaI, 'x'], piernaD: [piernaD, 'x'] },
    accesorios: { kit: 'copy', modelo: 'nico', cabeza: 2, torso: 3, manoDer: 1, manoIzq: 1, senal: true, peinado: 'pelo LEGO' }, // pelo y cara · capucha e impresión de la sudadera · bolígrafo · libreta
    set ritmoTecleo(x) {
      yo.ritmoTecleo = x;
    },
    get ritmoTecleo() {
      return yo.ritmoTecleo;
    },
    set velocidad(x) {
      yo.velocidad = x;
    },
    get velocidad() {
      return yo.velocidad;
    },
    suavizarCaminata: true,
    accion: () => acc.nombre,
    /** Solo pruebas y capturas: fija una acción (o `null` para volver a la secuencia normal). */
    fijarAccion(nombre) {
      acc.fija = nombre;
      if (!nombre) acc.estado = null;
    },
    utileria: () => ({ libreta: util.libreta, boligrafo: util.boli }),
    expresion: () => ({ ...E }),
    liberar,
  };
}

registrarModelo(
  'nico',
  (op) => {
    const f = crearNico(op);
    f.objeto.userData.personaje = f;
    return f.objeto;
  },
  { fija: false, medida: { w: 2.2, d: 1.1, alto: 5.0 } }
);
