// Cara de minifigura "impresa": una lámina curva sobre la cabeza con una textura que se redibuja según la expresión.
// Por qué así: una cara LEGO real es un estampado plano, y redibujarlo permite cambiar la expresión de forma continua
// (cejas, ojos, sonrisa, boca) sin deformar la geometría de la cabeza ni cambiar de textura a saltos.
//
// Medidas: la lámina cubre 1.5 rad (≈86°) de una cabeza de radio .725 y alto .95; el lienzo mantiene la MISMA proporción
// (256 × 224 px) para que un círculo dibujado salga redondo en la cabeza (antes el lienzo era 2:1 y las caras salían estiradas).
import * as THREE from 'three';

const ANCHO = 256;
const ALTO = 224;
const TINTA = '#1d2433';
const BOCA = '#5b2a22';
const LENGUA = '#e8737f';

/** Expresión neutra. Todos los valores son continuos y se mezclan suavemente entre estados. */
export function expresionBase() {
  return { ojo: 1, cejaIh: 0, cejaIt: 0, cejaDh: 0, cejaDt: 0, sonrisa: 0.7, boca: 0, miraX: 0, miraY: 0 };
}

export function crearCara(radio = 0.725, alto = 0.95) {
  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  const g = lienzo.getContext('2d');
  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  // en CylinderGeometry el ángulo 0 apunta al frente (+z): la lámina se centra en 0
  const malla = new THREE.Mesh(new THREE.CylinderGeometry(radio + 0.003, radio + 0.003, alto, 28, 1, true, -0.75, 1.5), mat);
  malla.renderOrder = 2;

  let previo = '';
  const ceja = (cx, y, h, t, lado) => {
    // h: sube/baja (px); t: inclinación (positivo = extremo interior hacia abajo, ceño; negativo = preocupada)
    const ancho = 26;
    const interior = cx - lado * ancho * 0.5;
    const exterior = cx + lado * ancho * 0.5;
    const yi = y - h + t * 7;
    const ye = y - h - t * 7;
    g.beginPath();
    g.moveTo(interior, yi);
    g.quadraticCurveTo(cx, Math.min(yi, ye) - 4, exterior, ye);
    g.stroke();
  };

  /** Redibuja la cara con la expresión E. `parpadeo` va de 0 (ojos abiertos) a 1 (cerrados). Solo redibuja si algo cambió. */
  function actualizar(E, parpadeo = 0) {
    const abierto = E.ojo * (1 - parpadeo);
    const clave = [abierto, E.cejaIh, E.cejaIt, E.cejaDh, E.cejaDt, E.sonrisa, E.boca, E.miraX, E.miraY].map((x) => Math.round(x * 60)).join(',');
    if (clave === previo) return;
    previo = clave;
    g.clearRect(0, 0, ANCHO, ALTO);
    const cx = ANCHO / 2;
    const yOjos = 92;
    const sep = 52; // separación de cada ojo respecto al centro
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // ojos: puntos ovalados y proporcionados (≈ 22 × 30 px); la mirada los desplaza unos píxeles sin salirse de la cara
    const ox = E.miraX * 14;
    const oy = E.miraY * 9;
    const rx = 10.5;
    const ry = 14.5 * Math.max(0, abierto);
    g.fillStyle = TINTA;
    g.strokeStyle = TINTA;
    for (const lado of [-1, 1]) {
      const x = cx + lado * sep + ox;
      const y = yOjos + oy;
      if (abierto < 0.14) {
        // cerrado: una línea curva corta y limpia (el ojo solo se aplasta, no se deforma el resto de la cara)
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(x - rx, y + 1);
        g.quadraticCurveTo(x, y + 6, x + rx, y + 1);
        g.stroke();
      } else {
        g.beginPath();
        g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        g.fill();
        // brillo pequeño: da vida sin complicar
        if (ry > 8) {
          g.fillStyle = '#ffffff';
          g.beginPath();
          g.arc(x - 3.2, y - ry * 0.35, 2.6, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = TINTA;
        }
      }
    }

    // cejas finas y discretas
    g.lineWidth = 4.2;
    ceja(cx - sep, 55, E.cejaIh * 14, E.cejaIt, 1);
    ceja(cx + sep, 55, E.cejaDh * 14, E.cejaDt, -1);

    // boca: la comisura se mantiene fija; la sonrisa curva la línea superior y, si se abre, la mandíbula baja desde esa misma línea
    const yb = 142;
    const mw = 34 + E.sonrisa * 8; // semiancho
    const curva = 4 + E.sonrisa * 20; // cuánto baja el centro respecto a las comisuras
    const izq = cx - mw;
    const der = cx + mw;
    const yc = yb - curva * 0.35; // altura de las comisuras
    if (E.boca > 0.06) {
      const prof = E.boca * 26; // cuánto baja el labio inferior
      g.fillStyle = BOCA;
      g.beginPath();
      g.moveTo(izq, yc);
      g.quadraticCurveTo(cx, yc + curva * 0.9, der, yc);
      g.quadraticCurveTo(cx, yc + curva * 0.55 + prof * 1.5, izq, yc);
      g.closePath();
      g.fill();
      if (E.boca > 0.4) {
        g.fillStyle = LENGUA;
        g.beginPath();
        g.ellipse(cx, yc + curva * 0.55 + prof * 0.95, mw * 0.42, prof * 0.32, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = '#7a3a2e';
      g.lineWidth = 3.5;
      g.beginPath();
      g.moveTo(izq, yc);
      g.quadraticCurveTo(cx, yc + curva * 0.9, der, yc);
      g.stroke();
    } else {
      g.strokeStyle = '#6b3a2a';
      g.lineWidth = 6.5;
      g.beginPath();
      g.moveTo(izq, yc);
      g.quadraticCurveTo(cx, yc + curva * 1.0, der, yc);
      g.stroke();
    }
    tex.needsUpdate = true;
  }
  actualizar(expresionBase(), 0);
  return { malla, actualizar };
}
