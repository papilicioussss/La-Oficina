// Materiales LEGO para la escena isométrica (solo dibujo; no contiene lógica de agentes).
// Piezas: proyección isométrica, plásticos con brillo, taquitos (studs), ladrillos con juntas,
// placas base, paredes de ladrillo y sombras de contacto suaves.

import { s } from './ui.js';

// ---------- Proyección isométrica ----------
export const TW = 16; // px por unidad (horizontal)
export const TH = 8; // px por unidad (vertical)
export const ZH = 14; // px por unidad de altura
export const iso = (x, y, z = 0) => [(x - y) * TW, (x + y) * TH - z * ZH];
export const P = (pts) => pts.map(([x, y, z]) => iso(x, y, z).map((n) => n.toFixed(1)).join(',')).join(' ');
export const EDGE = { stroke: 'rgba(40,28,18,.30)', 'stroke-width': 0.6, 'stroke-linejoin': 'round' };

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/** Tres tonos (tapa, cara izquierda, cara derecha) de un plástico. */
export const plastic = (hex) => [shade(hex, 0.14), hex, shade(hex, -0.16)];

// Colores LEGO clásicos (rojo, amarillo, azul, verde, blanco) más naranja y grises.
export const LEGO = {
  red: '#d4382c',
  yellow: '#f5cd30',
  blue: '#1f6fc9',
  green: '#2a9a55',
  white: '#f4f4f2',
  orange: '#ff8a3d',
  grey: '#a9aeb4',
  dark: '#4a5060',
  tan: '#e4cd9e',
  brown: '#a87545',
};

// ---------- Registro de definiciones (gradientes y patrones reutilizados) ----------
const defsEl = s('defs');
const made = new Set();
const once = (id, build) => {
  if (made.has(id)) return;
  made.add(id);
  defsEl.append(build());
};

/** Se añade una vez al <svg> de la escena (el elemento se reutiliza entre renders). */
export function mountDefs(svg) {
  initStaticDefs();
  svg.prepend(defsEl);
}

/** Gradiente suave para una cara de plástico. kind: 'top' (diagonal) | 'side' (vertical). */
function grad(kind, hex) {
  const id = `lg-${kind}-${hex.slice(1)}`;
  once(id, () =>
    kind === 'top'
      ? s('linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 1 }, s('stop', { offset: 0, 'stop-color': shade(hex, 0.18) }), s('stop', { offset: 1, 'stop-color': hex }))
      : s('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, 'stop-color': shade(hex, 0.09) }), s('stop', { offset: 1, 'stop-color': shade(hex, -0.1) }))
  );
  return `url(#${id})`;
}

function initStaticDefs() {
  // Taquito: cilindro corto con brillo. Toma el color de `color` del <use>.
  once('lg-stud', () =>
    s(
      'g',
      { id: 'lg-stud' },
      s('rect', { x: -2.5, y: 0, width: 5, height: 1.6, fill: 'currentColor' }),
      s('rect', { x: -2.5, y: 0, width: 5, height: 1.6, fill: '#000', opacity: 0.2 }),
      s('ellipse', { cx: 0, cy: 1.6, rx: 2.5, ry: 1.25, fill: 'currentColor' }),
      s('ellipse', { cx: 0, cy: 1.6, rx: 2.5, ry: 1.25, fill: '#000', opacity: 0.2 }),
      s('ellipse', { cx: 0, cy: 0, rx: 2.5, ry: 1.25, fill: 'currentColor' }),
      s('ellipse', { cx: -0.8, cy: -0.35, rx: 0.9, ry: 0.4, fill: '#fff', opacity: 0.45 })
    )
  );
  // Baseplate: taquitos en el piso (en coordenadas del piso; la matriz proyecta a isométrico).
  once('lg-floor', () =>
    s(
      'pattern',
      { id: 'lg-floor', width: 1, height: 1, patternUnits: 'userSpaceOnUse', patternTransform: `matrix(${TW} ${TH} ${-TW} ${TH} 0 0)` },
      s('circle', { cx: 0.5, cy: 0.5, r: 0.23, fill: '#000', opacity: 0.1 }),
      s('circle', { cx: 0.46, cy: 0.46, r: 0.23, fill: '#000', opacity: 0.08 }),
      s('circle', { cx: 0.4125, cy: 0.4125, r: 0.23, fill: '#fff', opacity: 0.4 }),
      s('circle', { cx: 0.36, cy: 0.36, r: 0.075, fill: '#fff', opacity: 0.55 })
    )
  );
  // Paredes de ladrillo (juntas desfasadas cada 1,2 de alto). L = pared x=0 (plano y-z), R = pared y=0 (plano x-z).
  const wall = (id, matrix, base) =>
    once(id, () =>
      s(
        'pattern',
        { id, width: 4.8, height: 2.4, patternUnits: 'userSpaceOnUse', patternTransform: `matrix(${matrix})` },
        s('rect', { width: 4.8, height: 2.4, fill: base }),
        s('path', { d: 'M0 1.2H4.8M0 2.4H4.8M2.4 0V1.2M0 1.2V2.4M4.8 1.2V2.4', stroke: 'rgba(110,80,40,.22)', 'stroke-width': 0.05, fill: 'none' }),
        s('path', { d: 'M0 0.03H4.8M0 1.23H4.8', stroke: 'rgba(255,255,255,.45)', 'stroke-width': 0.05, fill: 'none' })
      )
    );
  wall('lg-wallL', `${-TW} ${TH} 0 ${-ZH} 0 0`, '#fbf4e8');
  wall('lg-wallR', `${TW} ${TH} 0 ${-ZH} 0 0`, '#f1e4cd');
  // Luz de ventana sobre el piso: se desvanece al alejarse.
  once('lg-light', () =>
    s('linearGradient', { id: 'lg-light', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, 'stop-color': '#fff6d6', 'stop-opacity': 0.5 }), s('stop', { offset: 1, 'stop-color': '#fff6d6', 'stop-opacity': 0 }))
  );
}

// ---------- Cajas (ladrillos) ----------

/** Taquitos sobre la tapa de una caja, uno por <use>. */
export function studs(x, y, z, w, d, h, top, pitch = 0.6, max = 5) {
  pitch = pitch || 0.6;
  max = max || 5;
  const nx = Math.max(1, Math.min(max, Math.floor(w / pitch)));
  const ny = Math.max(1, Math.min(max, Math.floor(d / pitch)));
  const g = s('g', { class: 'studs', 'pointer-events': 'none' });
  initStaticDefs();
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const [px, py] = iso(x + ((i + 0.5) * w) / nx, y + ((j + 0.5) * d) / ny, z + h);
      g.append(s('use', { href: '#lg-stud', x: px.toFixed(1), y: (py - 1.5).toFixed(1), color: top }));
    }
  }
  return g;
}

/**
 * Caja de plástico con degradados, brillo en las aristas, taquitos y juntas opcionales.
 * opt: { studs: false, seam: 0.4 (altura entre juntas), gloss: false }
 */
export function box(x, y, z, w, d, h, color, extra = {}, opt = {}) {
  const [top, left, right] = Array.isArray(color) ? color : plastic(color);
  const g = s(
    'g',
    extra,
    s('polygon', { points: P([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]), fill: grad('side', left), ...EDGE }),
    s('polygon', { points: P([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]), fill: grad('side', right), ...EDGE }),
    s('polygon', { points: P([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]), fill: grad('top', top), ...EDGE })
  );
  const e = opt.seam;
  if (e && h > e * 1.4) {
    let dd = '';
    for (let zz = z + e; zz < z + h - 0.05; zz += e) {
      const a = iso(x, y + d, zz);
      const b = iso(x + w, y + d, zz);
      const c = iso(x + w, y, zz);
      dd += `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}L${c[0].toFixed(1)} ${c[1].toFixed(1)}`;
    }
    g.append(s('path', { d: dd, stroke: 'rgba(0,0,0,.16)', 'stroke-width': 0.5, fill: 'none', 'pointer-events': 'none' }));
  }
  if (opt.gloss !== false && (w > 0.5 || d > 0.5) && h >= 0.15) {
    const a = iso(x, y + d, z + h);
    const b = iso(x + w, y + d, z + h);
    const c = iso(x + w, y, z + h);
    const v = iso(x + w, y + d, z);
    g.append(
      s('path', {
        d: `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}L${c[0].toFixed(1)} ${c[1].toFixed(1)}M${b[0].toFixed(1)} ${b[1].toFixed(1)}L${v[0].toFixed(1)} ${v[1].toFixed(1)}`,
        stroke: '#fff',
        'stroke-opacity': 0.42,
        'stroke-width': 0.8,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        fill: 'none',
        'pointer-events': 'none',
      })
    );
  }
  if (opt.studs !== false && w >= 1.2 && d >= 1.2 && h >= 0.05 && z + h > 0.04) g.append(studs(x, y, z, w, d, h, top, opt.pitch, opt.studMax));
  return g;
}

export const quadY = (x1, x2, z1, z2, y = 0) => P([[x1, y, z1], [x2, y, z1], [x2, y, z2], [x1, y, z2]]);
export const quadX = (y1, y2, z1, z2, x = 0) => P([[x, y1, z1], [x, y2, z1], [x, y2, z2], [x, y1, z2]]);

/** Plano vertical y=cte (cara que mira a +y). Dibuja en coordenadas locales: x = unidades, y = altura hacia arriba. */
export const planeY = (x, y, z) => {
  const [ox, oy] = iso(x, y, z);
  return `matrix(${TW} ${TH} 0 ${-ZH} ${ox.toFixed(2)} ${oy.toFixed(2)})`;
};
/** Plano vertical x=cte (cara que mira a +x). Local: x = unidades a lo largo de y, y = altura. */
export const planeX = (x, y, z) => {
  const [ox, oy] = iso(x, y, z);
  return `matrix(${-TW} ${TH} 0 ${-ZH} ${ox.toFixed(2)} ${oy.toFixed(2)})`;
};

// ---------- Sombras y luz ----------

/** Sombra de contacto suave: tres capas desvanecidas, desplazadas hacia el frente (+x, +y). */
export function softShadow([x1, y1, x2, y2], strength = 1) {
  const g = s('g', { 'pointer-events': 'none' });
  [[0.5, 0.05], [0.3, 0.07], [0.12, 0.09]].forEach(([grow, op]) => {
    const a = x1 - grow * 0.4 + 0.12;
    const b = y1 - grow * 0.4 + 0.12;
    const c = x2 + grow + 0.12;
    const d = y2 + grow + 0.12;
    g.append(s('polygon', { points: P([[a, b, 0.005], [c, b, 0.005], [c, d, 0.005], [a, d, 0.005]]), fill: '#2b1a0a', opacity: op * strength }));
  });
  return g;
}

/** Charco de luz sobre el piso (ventana). */
export function lightPatch(pts) {
  initStaticDefs();
  return s('polygon', { points: P(pts.map(([x, y]) => [x, y, 0.012])), fill: 'url(#lg-light)', 'pointer-events': 'none' });
}

/** Piso de taquitos sobre un rectángulo [x, y, w, d]. */
export function baseplate([ox, oy, w, d], inset = 0.25) {
  initStaticDefs();
  const x1 = ox + inset;
  const y1 = oy + inset;
  const x2 = ox + w - inset;
  const y2 = oy + d - inset;
  return s('polygon', { points: P([[x1, y1, 0.012], [x2, y1, 0.012], [x2, y2, 0.012], [x1, y2, 0.012]]), fill: 'url(#lg-floor)', 'pointer-events': 'none' });
}
