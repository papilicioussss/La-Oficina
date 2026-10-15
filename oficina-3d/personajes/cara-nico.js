// Cara estampada de Nico (copywriter) al estilo de las caras LEGO reales: cejas finas y cortas, ojos ovalados negros
// con un brillito blanco, boca de trazo fino y sonrisa abierta con contorno negro y dientes blancos. Es una "pegatina" (como en un LEGO real): una lámina curva sobre la
// cabeza con un dibujo que se redibuja según la expresión, sin deformar la geometría.
//
// Además de lo que ya tenía la cara de las demás minifiguras (ojos, cejas, sonrisa, boca, mirada), esta cara tiene:
//   feliz    0..1  ojos cerrados en arco (^ ^), para el festejo y la risa
//   redondo  0..1  boca en "O" (sorpresa, idea, vocales o/u al hablar)
//   dientes  0..1  dientes de arriba visibles al abrir la boca
//   lengua   0..1  lengüita afuera a un lado (concentrado escribiendo)
//   ladeo   -1..1  boca corrida hacia un lado (duda, media sonrisa)
//   rubor    0..1  cachetes rosados (contento)
//
// Medidas (cabeza de minifigura real: 1.2 de ancho y 1.1 de alto): la lámina cubre 1.6 rad de una cabeza de radio .605 y
// .85 de alto; el lienzo tiene la misma proporción (256 × 225 unidades de dibujo) para que un círculo salga redondo.
import * as THREE from 'three';

const ANCHO = 256;
const ALTO = 225;
export const CARA = { radio: 0.605, alto: 0.85, arco: 1.6 };
const TINTA = '#141317';
const CEJA = '#24170f'; // cejas café muy oscuro, finas (como las caras LEGO de referencia)
const BOCA = '#2b0f0f';
const LABIO = '#141317';
const LENGUA = '#c8444f';
const DIENTES = '#fbfbf6';

/** Expresión neutra de Nico: la sonrisa abierta de la referencia. */
export function expresionNico() {
  return { ojo: 1, feliz: 0, cejaIh: 0, cejaIt: 0, cejaDh: 0, cejaDt: 0, sonrisa: 0.85, boca: 0.42, redondo: 0, dientes: 1, lengua: 0, ladeo: 0, rubor: 0, miraX: 0, miraY: 0 };
}

const lerp = (a, b, k) => a + (b - a) * k;

/** `fina`: lienzo al doble de resolución (calidad Alta). */
export function crearCaraNico({ fina = true } = {}) {
  const escala = fina ? 2 : 1;
  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO * escala;
  lienzo.height = ALTO * escala;
  const g = lienzo.getContext('2d');
  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  // material con luz (no "básico"): la cara se sombrea igual que la cabeza y no brilla de más en la penumbra
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.42, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const geo = new THREE.CylinderGeometry(CARA.radio, CARA.radio, CARA.alto, fina ? 32 : 18, 1, true, -CARA.arco / 2, CARA.arco);
  const malla = new THREE.Mesh(geo, mat);
  malla.renderOrder = 2;
  malla.name = 'cara';

  // contorno de la boca: 2 × N puntos (borde de arriba de izquierda a derecha, borde de abajo de derecha a izquierda)
  const N = 14;
  const pts = new Float32Array(N * 4);
  const elip = new Float32Array(N * 4);
  let previo = '';
  const paso = fina ? 60 : 30; // cuantización: solo se redibuja si la expresión cambió de verdad

  function bocaContorno(E, cx, yb) {
    const mw = 24 + E.sonrisa * 8 - E.redondo * 5;
    const curva = 4 + E.sonrisa * 16;
    const lad = E.ladeo * 9;
    const izq = cx - mw + lad;
    const der = cx + mw + lad;
    const ycI = yb - curva * 0.35 + E.ladeo * 4;
    const ycD = yb - curva * 0.35 - E.ladeo * 4;
    const prof = E.boca * 30;
    const ctrlArriba = yb + curva * (0.55 - 0.3 * Math.min(1, E.boca * 2.5));
    const ctrlAbajo = yb + curva * 0.55 + prof * 1.6;
    const cxm = cx + lad;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      // cuadrática de izq a der (arriba)
      const x = (1 - u) * (1 - u) * izq + 2 * (1 - u) * u * cxm + u * u * der;
      const y = (1 - u) * (1 - u) * ycI + 2 * (1 - u) * u * ctrlArriba + u * u * ycD;
      pts[i * 2] = x;
      pts[i * 2 + 1] = y;
      // de der a izq (abajo)
      const x2 = (1 - u) * (1 - u) * der + 2 * (1 - u) * u * cxm + u * u * izq;
      const y2 = (1 - u) * (1 - u) * ycD + 2 * (1 - u) * u * ctrlAbajo + u * u * ycI;
      pts[(N + i) * 2] = x2;
      pts[(N + i) * 2 + 1] = y2;
      // la "O": elipse con los mismos índices (arriba de izq a der, abajo de der a izq)
      const rx = 10 + E.boca * 5;
      const ry = 7 + E.boca * 15;
      const ey = yb + 6 + E.boca * 6;
      const a1 = Math.PI - u * Math.PI;
      elip[i * 2] = cxm + Math.cos(a1) * rx;
      elip[i * 2 + 1] = ey - Math.sin(a1) * ry;
      const a2 = -u * Math.PI;
      elip[(N + i) * 2] = cxm + Math.cos(a2) * rx;
      elip[(N + i) * 2 + 1] = ey - Math.sin(a2) * ry;
    }
    const r = E.redondo;
    for (let i = 0; i < N * 4; i++) pts[i] = lerp(pts[i], elip[i], r);
    return { izq, der, ycI, ycD, cxm };
  }
  const trazar = () => {
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 1; i < N * 2; i++) g.lineTo(pts[i * 2], pts[i * 2 + 1]);
    g.closePath();
  };

  /** Redibuja con la expresión E; `parpadeo` 0 (abiertos) a 1 (cerrados). Solo si algo cambió. */
  function actualizar(E, parpadeo = 0) {
    const abierto = E.ojo * (1 - parpadeo);
    const clave = [abierto, E.feliz, E.cejaIh, E.cejaIt, E.cejaDh, E.cejaDt, E.sonrisa, E.boca, E.redondo, E.dientes, E.lengua, E.ladeo, E.rubor, E.miraX, E.miraY].map((x) => Math.round(x * paso)).join(',');
    if (clave === previo) return false;
    previo = clave;
    g.setTransform(escala, 0, 0, escala, 0, 0);
    g.clearRect(0, 0, ANCHO, ALTO);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const cx = ANCHO / 2;
    const yOjos = 100;
    const sep = 42;
    const ox = E.miraX * 11;
    const oy = E.miraY * 7;

    // cachetes
    if (E.rubor > 0.02) {
      g.fillStyle = `rgba(255, 120, 110, ${0.32 * E.rubor})`;
      for (const lado of [-1, 1]) {
        g.beginPath();
        g.ellipse(cx + lado * 68, 130, 15, 9, 0, 0, Math.PI * 2);
        g.fill();
      }
    }

    // ojos
    g.fillStyle = TINTA;
    g.strokeStyle = TINTA;
    const rx = 9.5;
    const ry = 12.5 * Math.max(0, abierto) * (1 - 0.7 * E.feliz);
    for (const lado of [-1, 1]) {
      const x = cx + lado * sep + ox;
      const y = yOjos + oy;
      if (E.feliz > 0.5) {
        // ojos felices: arcos (^ ^)
        g.lineWidth = 5.5;
        g.beginPath();
        g.moveTo(x - 11, y + 4);
        g.quadraticCurveTo(x, y - 10 * E.feliz, x + 11, y + 4);
        g.stroke();
      } else if (ry < 2.2) {
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(x - rx, y + 1);
        g.quadraticCurveTo(x, y + 6, x + rx, y + 1);
        g.stroke();
      } else {
        g.beginPath();
        g.ellipse(x, y, rx * (0.9 + 0.1 * abierto), ry, 0, 0, Math.PI * 2);
        g.fill();
        if (ry > 7) {
          g.fillStyle = '#ffffff';
          g.beginPath();
          g.arc(x - 3 + ox * 0.15, y - ry * 0.42, 2.4, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = TINTA;
        }
      }
    }

    // cejas: trazos finos y cortos, un poco curvos (como las caras LEGO), que suben, bajan e inclinan
    g.strokeStyle = CEJA;
    g.lineWidth = 4.4;
    const ceja = (cxx, y, h, t, lado) => {
      const ancho = 25;
      const interior = cxx - lado * ancho * 0.5;
      const exterior = cxx + lado * ancho * 0.5;
      const yi = y - h + t * 6;
      const ye = y - h - t * 6;
      g.beginPath();
      g.moveTo(interior, yi);
      g.quadraticCurveTo(cxx, Math.min(yi, ye) - 4, exterior, ye);
      g.stroke();
    };
    ceja(cx - sep + ox * 0.3, 71, E.cejaIh * 12, E.cejaIt, 1);
    ceja(cx + sep + ox * 0.3, 71, E.cejaDh * 12, E.cejaDt, -1);

    // boca
    const yb = 148;
    const abiertaBoca = E.boca > 0.05 || E.redondo > 0.2;
    const c = bocaContorno(E, cx, yb);
    if (abiertaBoca) {
      trazar();
      g.fillStyle = BOCA;
      g.fill();
      g.save();
      trazar();
      g.clip();
      // lengua al fondo
      if (E.boca > 0.5) {
        g.fillStyle = LENGUA;
        g.beginPath();
        const yl = Math.max(pts[(N + (N >> 1)) * 2 + 1] - 2, yb + 4);
        g.ellipse(c.cxm + 4, yl, 16 * (1 - 0.4 * E.redondo), 9 + E.boca * 3, 0, 0, Math.PI * 2);
        g.fill();
      }
      // dientes de arriba: banda blanca pegada al borde superior
      if (E.dientes > 0.05) {
        g.strokeStyle = DIENTES;
        g.lineWidth = 2 * (3 + 7 * E.dientes * (1 - 0.6 * E.redondo));
        g.beginPath();
        g.moveTo(pts[0], pts[1] - 2);
        for (let i = 1; i < N; i++) g.lineTo(pts[i * 2], pts[i * 2 + 1] - 2);
        g.stroke();
      }
      g.restore();
      g.strokeStyle = LABIO;
      g.lineWidth = 2.6;
      trazar();
      g.stroke();
    } else {
      g.strokeStyle = LABIO;
      g.lineWidth = 3.8;
      g.beginPath();
      g.moveTo(pts[0], pts[1]);
      for (let i = 1; i < N; i++) g.lineTo(pts[i * 2], pts[i * 2 + 1]);
      g.stroke();
    }
    // marquita de la mejilla en la comisura que sube (media sonrisa de las caras LEGO)
    if (Math.abs(E.ladeo) > 0.2 || E.sonrisa > 0.95) {
      const lado = E.ladeo >= 0 ? 1 : -1;
      const x = lado > 0 ? c.der : c.izq;
      const y = lado > 0 ? c.ycD : c.ycI;
      g.strokeStyle = LABIO;
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(x + lado * 2, y - 5);
      g.quadraticCurveTo(x + lado * 6, y - 1, x + lado * 3, y + 4);
      g.stroke();
    }
    // lengüita de concentración, asomada a un lado
    if (E.lengua > 0.05) {
      const lado = E.ladeo >= 0 ? 1 : -1;
      const x = c.cxm + lado * 14;
      const y = (lado > 0 ? c.ycD : c.ycI) + 6 + 4 * E.sonrisa;
      g.fillStyle = LENGUA;
      g.strokeStyle = LABIO;
      g.lineWidth = 2.2;
      g.beginPath();
      g.ellipse(x, y + 3 * E.lengua, 7, 7 * E.lengua + 1, 0, 0, Math.PI);
      g.fill();
      g.stroke();
    }
    tex.needsUpdate = true;
    return true;
  }
  actualizar(expresionNico(), 0);
  return {
    malla,
    actualizar,
    liberar() {
      geo.dispose();
      tex.dispose();
      mat.dispose();
    },
  };
}

