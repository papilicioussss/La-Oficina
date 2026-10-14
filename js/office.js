// Oficina isométrica animada (SVG): 3 oficinas, la oficina del jefe y la sala de juntas,
// con personajes que caminan y el avatar del jefe que se mueve por la oficina.

import { s } from './ui.js';
import { buildCatSprite } from './cat-sprite.js';
import * as store from './store.js';
import { AGENT_IDS } from './store.js';
import { runtime, on, STATUS_LABEL, go } from './state.js';
import { ROLES, catName } from './prompts.js';

// ---------- Proyección isométrica ----------
const TW = 16; // px por unidad (horizontal)
const TH = 8; // px por unidad (vertical)
const ZH = 14; // px por unidad de altura
const iso = (x, y, z = 0) => [(x - y) * TW, (x + y) * TH - z * ZH];
const P = (pts) => pts.map(([x, y, z]) => iso(x, y, z).map((n) => n.toFixed(1)).join(',')).join(' ');
const EDGE = { stroke: 'rgba(70,45,15,.22)', 'stroke-width': 0.7, 'stroke-linejoin': 'round' };

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/** Taquitos tipo LEGO sobre la tapa de una caja (solo en piezas lo bastante grandes). */
function studs(x, y, z, w, d, h, top) {
  const nx = Math.min(5, Math.floor(w / 0.6));
  const ny = Math.min(5, Math.floor(d / 0.6));
  const g = s('g', { class: 'studs', 'pointer-events': 'none' });
  const side = shade(top, -0.22);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const [px, py] = iso(x + ((i + 0.5) * w) / nx, y + ((j + 0.5) * d) / ny, z + h);
      g.append(
        s('ellipse', { cx: px.toFixed(1), cy: (py + 1.3).toFixed(1), rx: 2.5, ry: 1.25, fill: side }),
        s('rect', { x: (px - 2.5).toFixed(1), y: (py - 0.1).toFixed(1), width: 5, height: 1.4, fill: side }),
        s('ellipse', { cx: px.toFixed(1), cy: py.toFixed(1), rx: 2.5, ry: 1.25, fill: top, stroke: side, 'stroke-width': 0.4 })
      );
    }
  }
  return g;
}

function box(x, y, z, w, d, h, color, extra = {}) {
  const [top, left, right] = Array.isArray(color) ? color : [shade(color, 0.12), color, shade(color, -0.14)];
  const g = s(
    'g',
    extra,
    s('polygon', { points: P([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]), fill: left, ...EDGE }),
    s('polygon', { points: P([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]), fill: right, ...EDGE }),
    s('polygon', { points: P([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]), fill: top, ...EDGE })
  );
  if (w >= 1.2 && d >= 1.2 && h >= 0.05 && z + h > 0.04) g.append(studs(x, y, z, w, d, h, top));
  return g;
}

const quadY = (x1, x2, z1, z2, y = 0) => P([[x1, y, z1], [x2, y, z1], [x2, y, z2], [x1, y, z2]]);
const quadX = (y1, y2, z1, z2, x = 0) => P([[x, y1, z1], [x, y2, z1], [x, y2, z2], [x, y1, z2]]);

// ---------- Escena ----------
const WOOD = ['#f0cd98', '#d9ac6c', '#c39457'];
const DARK_WOOD = ['#c48d5c', '#a87545', '#8f6239'];
const CHAIR = ['#8a98b4', '#717f9c', '#5f6c88'];

// Pisos con los colores de la marca: naranja (Copy), azul (Análisis), verde (Guiones), amarillo (juntas), azul marino claro (jefe)
const ROOM_TINT = { copy: '#ffe5cc', analista: '#d2effb', guion: '#d6f1da', juntas: '#fdf0bd', kike: '#dde5f0' };
// [x, y, ancho, fondo] de cada sala
const ROOM_AREA = {
  copy: [0, 0, 12, 12],
  analista: [12, 0, 12, 12],
  guion: [0, 12, 12, 12],
  juntas: [12, 12, 12, 12],
  kike: [12, 24, 12, 10],
};

const SEATS = { copy: [6.3, 4.6], analista: [18.2, 4.6], guion: [6.3, 16.6] };
const MEET = { analista: [15.9, 16.35], guion: [18.0, 16.35], copy: [20.1, 16.35] };
const ROUTES = {
  copy: [[9.25, 9.2], [9.25, 13.4], [11, 14.75], [13.4, 14.75]],
  analista: [[14.75, 9.2], [14.75, 13.6]],
  guion: [[10.8, 14.75], [13.4, 14.75]],
};

let svgRoot = null;
let layers = null;
const charEls = {};
const slots = {};
const walking = {};

function plant(x, y, scale = 1) {
  const [px, py] = iso(x, y, 0.7);
  const leaves = s('g', { class: 'plant-leaves' });
  const pts = [[-7, -10, 7], [7, -11, 7], [0, -17, 8], [-3, -6, 6], [5, -4, 6]];
  pts.forEach(([dx, dy, r], i) =>
    leaves.append(s('circle', { cx: px + dx * scale, cy: py + dy * scale, r: r * scale, fill: i % 2 ? '#3fae6a' : '#2e9d5b' }))
  );
  return s('g', null, box(x - 0.4, y - 0.4, 0, 0.8, 0.8, 0.7, ['#e9875b', '#d0693d', '#b85a33']), leaves);
}

function beachWindow(plane, a1, a2, z1, z2) {
  const q = plane === 'y' ? quadY : quadX;
  const off = 0.02;
  const zH = z2 - z1;
  const at = (t, z) => (plane === 'y' ? iso(a1 + (a2 - a1) * t, off, z) : iso(off, a2 - (a2 - a1) * t, z));
  const [sx, sy] = at(0.74, z1 + zH * 0.78);
  const [px, py] = at(0.22, z1 + zH * 0.2);
  const [m1x, m1y] = at(0.5, z1);
  const [m2x, m2y] = at(0.5, z2);
  return s(
    'g',
    { class: 'window' },
    s('polygon', { points: q(a1 - 0.18, a2 + 0.18, z1 - 0.18, z2 + 0.18, off), fill: '#fffaf0', stroke: '#cdb48c', 'stroke-width': 0.8 }),
    s('polygon', { points: q(a1, a2, z1 + zH * 0.45, z2, off), fill: 'url(#sky)' }),
    s('polygon', { points: q(a1, a2, z1 + zH * 0.2, z1 + zH * 0.45, off), fill: '#22a6c0' }),
    s('polygon', { points: q(a1, a2, z1, z1 + zH * 0.2, off), fill: '#f5d9a0' }),
    s('circle', { cx: sx, cy: sy, r: 5, fill: '#ffd166' }),
    s('path', {
      d: `M${px} ${py} q2 -9 -1 -19 M${px - 1} ${py - 19} q-7 -1 -10 4 M${px - 1} ${py - 19} q7 -2 10 3 M${px - 1} ${py - 19} q-3 -6 -9 -6 M${px - 1} ${py - 19} q4 -6 9 -5`,
      stroke: '#2e7d4f',
      'stroke-width': 2,
      fill: 'none',
      'stroke-linecap': 'round',
    }),
    s('line', { x1: m1x, y1: m1y, x2: m2x, y2: m2y, stroke: '#e6d5b5', 'stroke-width': 1.6 })
  );
}

function wallText(plane, a, z, text, size, extra = {}) {
  const [x0, y0] = plane === 'x' ? iso(0.03, a, z) : iso(a, 0.03, z);
  const m = plane === 'x' ? `matrix(0.8944,-0.4472,0,1,${x0},${y0})` : `matrix(0.8944,0.4472,0,1,${x0},${y0})`;
  return s('text', { transform: m, 'font-size': size, 'text-anchor': 'middle', 'font-weight': 800, ...extra }, text);
}

function staticScene() {
  const g = s('g', { class: 'scene-static' });
  // Losa del piso
  g.append(box(0, 0, -0.7, 24, 24, 0.7, ['#e3c79a', '#cfae7a', '#b9965f']));
  g.append(box(12, 24, -0.7, 12, 10, 0.7, ['#e3c79a', '#cfae7a', '#b9965f']));
  // Pisos de cada sala (clicables)
  for (const [room, [ox, oy, w, d]] of Object.entries(ROOM_AREA)) {
    const label = room === 'juntas' ? 'Sala de juntas' : room === 'kike' ? 'Tu oficina' : `${ROLES[room].room}`;
    const poly = s('polygon', {
      class: 'room-floor',
      'data-room': room,
      points: P([[ox + 0.25, oy + 0.25, 0], [ox + w - 0.25, oy + 0.25, 0], [ox + w - 0.25, oy + d - 0.25, 0], [ox + 0.25, oy + d - 0.25, 0]]),
      fill: ROOM_TINT[room],
      role: 'button',
      tabindex: 0,
      'aria-label': `Entrar a: ${label}`,
    });
    g.append(poly);
  }
  // Líneas del piso
  const lines = s('g', { class: 'floor-lines', 'pointer-events': 'none' });
  for (let k = 2; k < 24; k += 2) {
    const [a1, b1] = iso(k, 0);
    const [a2, b2] = iso(k, 24);
    const [c1, d1] = iso(0, k);
    const [c2, d2] = iso(24, k);
    lines.append(s('line', { x1: a1, y1: b1, x2: a2, y2: b2 }), s('line', { x1: c1, y1: d1, x2: c2, y2: d2 }));
  }
  for (let k = 14; k < 24; k += 2) {
    const [a1, b1] = iso(k, 24);
    const [a2, b2] = iso(k, 34);
    lines.append(s('line', { x1: a1, y1: b1, x2: a2, y2: b2 }));
  }
  for (let k = 26; k < 34; k += 2) {
    const [c1, d1] = iso(12, k);
    const [c2, d2] = iso(24, k);
    lines.append(s('line', { x1: c1, y1: d1, x2: c2, y2: d2 }));
  }
  g.append(lines);
  // Alfombras
  g.append(
    s('polygon', { points: P([[3.4, 3.0, 0.01], [9.4, 3.0, 0.01], [9.4, 8.6, 0.01], [3.4, 8.6, 0.01]]), fill: '#ffb67a', opacity: 0.8, 'pointer-events': 'none' }),
    s('polygon', { points: P([[15.3, 3.0, 0.01], [21.3, 3.0, 0.01], [21.3, 8.6, 0.01], [15.3, 8.6, 0.01]]), fill: '#8fd6f1', opacity: 0.8, 'pointer-events': 'none' }),
    s('polygon', { points: P([[3.4, 15.0, 0.01], [9.4, 15.0, 0.01], [9.4, 20.6, 0.01], [3.4, 20.6, 0.01]]), fill: '#9ddba6', opacity: 0.8, 'pointer-events': 'none' }),
    s('polygon', { points: P([[15.0, 25.8, 0.01], [21.4, 25.8, 0.01], [21.4, 31.6, 0.01], [15.0, 31.6, 0.01]]), fill: '#fde07e', opacity: 0.8, 'pointer-events': 'none' })
  );

  // Paredes del fondo
  const H = 6;
  const walls = s('g', { class: 'walls', 'pointer-events': 'none' });
  walls.append(
    s('polygon', { points: quadX(0, 24, 0, H), fill: '#fbf4e8', ...EDGE }),
    s('polygon', { points: quadY(0, 24, 0, H), fill: '#f1e4cd', ...EDGE }),
    s('polygon', { points: P([[-0.4, 0, H], [0, 0, H], [0, 24, H], [-0.4, 24, H]]), fill: '#d9c3a0', ...EDGE }),
    s('polygon', { points: P([[0, -0.4, H], [24, -0.4, H], [24, 0, H], [0, 0, H]]), fill: '#d9c3a0', ...EDGE }),
    s('polygon', { points: P([[-0.4, -0.4, H], [0, -0.4, H], [0, 0, H], [-0.4, 0, H]]), fill: '#d9c3a0' }),
    s('polygon', { points: P([[-0.4, 24, 0], [0, 24, 0], [0, 24, H], [-0.4, 24, H]]), fill: '#cdb48c' }),
    s('polygon', { points: P([[24, -0.4, 0], [24, 0, 0], [24, 0, H], [24, -0.4, H]]), fill: '#c4a97f' }),
    // zócalos
    s('polygon', { points: quadX(0, 24, 0, 0.35, 0.02), fill: '#e8d7b8' }),
    s('polygon', { points: quadY(0, 24, 0, 0.35, 0.02), fill: '#dcc7a2' })
  );
  // Copy: ventana con playa + letrero de la marca
  walls.append(beachWindow('y', 2.5, 9.5, 2.0, 5.0));
  walls.append(s('polygon', { points: quadX(1.2, 10.8, 2.8, 5.4, 0.02), fill: '#324966', ...EDGE }));
  const [lgx, lgy] = iso(0.03, 9.9, 2.95);
  walls.append(
    s('image', {
      href: 'assets/logo-256.png',
      x: 0,
      y: -40,
      width: 40,
      height: 40,
      transform: `matrix(0.8944,-0.4472,0,1,${lgx},${lgy + 0})`,
    })
  );
  walls.append(wallText('x', 4.5, 4.45, 'VACILANDO ANDO', 11, { fill: '#fcfcf7', 'letter-spacing': 0.4 }));
  walls.append(wallText('x', 4.5, 3.6, 'T O U R S  ✈', 7.5, { fill: '#fde07e' }));
  // Analista: pantalla con gráfico
  walls.append(s('polygon', { points: quadY(13.8, 21.2, 2.2, 5.2, 0.02), fill: '#13202b', stroke: '#0b141b', 'stroke-width': 1 }));
  const bars = [0.9, 1.4, 1.1, 1.9, 1.6, 2.4];
  const barColors = ['#22b8c4', '#ff8a6b', '#ffcc4d'];
  bars.forEach((hgt, i) => {
    const x1 = 14.5 + i * 1.08;
    walls.append(s('polygon', { points: quadY(x1, x1 + 0.6, 2.55, 2.55 + hgt, 0.03), fill: barColors[i % 3] }));
  });
  const trend = [0, 1, 2, 3, 4, 5].map((i) => iso(14.8 + i * 1.08, 0.03, 3.6 + bars[i] * 0.55));
  walls.append(
    s('polyline', { points: trend.map((p) => p.join(',')).join(' '), fill: 'none', stroke: '#ffffff', 'stroke-width': 1.3, opacity: 0.85 })
  );
  // Guiones: corcho con notas
  walls.append(s('polygon', { points: quadX(14, 21, 2.2, 5.0, 0.02), fill: '#c99a5b', stroke: '#a87b42', 'stroke-width': 1 }));
  const notes = [
    [14.6, 4.0, '#ffd166'],
    [16.2, 4.2, '#ff9fb2'],
    [17.8, 3.9, '#9be7ff'],
    [19.4, 4.1, '#b9f6ca'],
    [15.3, 2.7, '#9be7ff'],
    [17.0, 2.6, '#ffd166'],
    [18.7, 2.8, '#ff9fb2'],
  ];
  notes.forEach(([y1, z1, c]) => walls.append(s('polygon', { points: quadX(y1, y1 + 1.1, z1, z1 + 0.8, 0.03), fill: c })));
  g.append(walls);
  return g;
}

/**
 * Elementos de cada sala con su profundidad (para dibujar de atrás hacia adelante).
 * `b` = huella [x1, y1, x2, y2] en el piso: sirve para saber si el avatar del jefe queda delante o detrás.
 */
function roomItems(room) {
  const items = [];
  const add = (depth, node, b) => items.push({ depth, node, b });
  if (room === 'copy') {
    add(1.0, box(0.1, 9.9, 0, 0.9, 1.8, 2.8, WOOD), [0.1, 9.9, 1.0, 11.7]);
    ['#ff8a3d', '#008ec7', '#fde07e', '#00a100'].forEach((c, i) =>
      add(1.1, s('polygon', { points: quadX(10.05 + i * 0.4, 10.35 + i * 0.4, 1.6, 2.5, 1.01), fill: c }), [0.1, 9.9, 1.0, 11.7])
    );
    add(12.1, plant(10.8, 1.3), [10.4, 0.9, 11.2, 1.7]);
    add(9.3, box(5.7, 3.6, 0, 1.2, 0.3, 2.3, CHAIR), [5.7, 3.6, 6.9, 3.9]);
    add(12.3, box(4.6, 5.6, 0, 3.4, 1.5, 1.25, WOOD), [4.6, 5.6, 8.0, 7.1]);
    add(12.4, box(5.0, 5.9, 1.25, 1.3, 0.8, 0.08, '#9aa3b2'), [4.6, 5.6, 8.0, 7.1]);
    add(12.5, s('polygon', { points: P([[5.0, 5.95, 1.33], [6.3, 5.95, 1.33], [6.3, 5.8, 2.25], [5.0, 5.8, 2.25]]), fill: '#3b4252', ...EDGE }), [4.6, 5.6, 8.0, 7.1]);
    add(12.6, s('circle', { cx: iso(5.65, 5.9, 1.8)[0], cy: iso(5.65, 5.9, 1.8)[1], r: 2.2, fill: '#ff8a3d' }), [4.6, 5.6, 8.0, 7.1]);
    add(12.7, box(7.3, 6.3, 1.25, 0.35, 0.35, 0.4, ['#ffffff', '#ececec', '#d9d9d9']), [4.6, 5.6, 8.0, 7.1]);
  }
  if (room === 'analista') {
    add(14.5, plant(13.2, 1.3), [12.8, 0.9, 13.6, 1.7]);
    add(21.3, box(17.6, 3.6, 0, 1.2, 0.3, 2.3, CHAIR), [17.6, 3.6, 18.8, 3.9]);
    add(24.3, box(16.4, 5.6, 0, 3.6, 1.5, 1.25, WOOD), [16.4, 5.6, 20.0, 7.1]);
    add(24.4, box(16.95, 6.2, 1.25, 0.25, 0.25, 0.35, '#3b4252'), [16.4, 5.6, 20.0, 7.1]);
    add(24.5, s('polygon', { points: P([[16.5, 6.25, 1.6], [17.8, 6.25, 1.6], [17.8, 6.1, 2.6], [16.5, 6.1, 2.6]]), fill: '#2d3440', ...EDGE }), [16.4, 5.6, 20.0, 7.1]);
    add(24.6, box(19.3, 6.2, 1.25, 0.5, 0.5, 0.12, '#22b8c4'), [16.4, 5.6, 20.0, 7.1]);
    add(31.0, box(22.4, 8.6, 0, 1.2, 1.6, 2.2, ['#d7dde4', '#b9c3cf', '#a3aebb']), [22.4, 8.6, 23.6, 10.2]);
  }
  if (room === 'guion') {
    add(14.0, plant(1.4, 22.6), [1.0, 22.2, 1.8, 23.0]);
    add(21.3, box(5.7, 15.6, 0, 1.2, 0.3, 2.3, CHAIR), [5.7, 15.6, 6.9, 15.9]);
    add(24.3, box(4.6, 17.6, 0, 3.4, 1.5, 1.25, WOOD), [4.6, 17.6, 8.0, 19.1]);
    add(24.4, box(5.0, 18.0, 1.25, 1.0, 0.7, 0.12, '#1d2433'), [4.6, 17.6, 8.0, 19.1]);
    add(24.5, box(5.0, 18.0, 1.37, 1.0, 0.18, 0.12, ['#ffffff', '#1d2433', '#1d2433']), [4.6, 17.6, 8.0, 19.1]);
    add(24.6, box(6.8, 18.1, 1.25, 0.9, 0.6, 0.05, ['#fffdf5', '#eee5d2', '#e0d6c0']), [4.6, 17.6, 8.0, 19.1]);
    // cámara en trípode
    const [tx, ty] = iso(9.6, 20.6, 0);
    const [cx, cy] = iso(9.6, 20.6, 2.4);
    add(
      30.3,
      s(
        'g',
        null,
        s('path', { d: `M${tx - 7} ${ty + 2} L${cx} ${cy} L${tx + 7} ${ty + 2} M${cx} ${cy} L${tx} ${ty + 5}`, stroke: '#3b4252', 'stroke-width': 1.6, fill: 'none' }),
        box(9.3, 20.3, 2.4, 0.7, 0.6, 0.55, '#2d3440')
      ),
      [9.0, 20.1, 10.2, 21.1]
    );
  }
  if (room === 'juntas') {
    [15.9, 18.0, 20.1].forEach((cx, i) => add(30.5 + i * 0.01, box(cx - 0.6, 15.25, 0, 1.2, 0.3, 2.3, CHAIR), [cx - 0.6, 15.25, cx + 0.6, 15.55]));
    // silla del jefe en la cabecera
    add(31.2, box(12.75, 17.9, 0, 0.35, 1.2, 2.7, ['#e7b84a', '#c99a2e', '#b08424']), [12.75, 17.9, 13.1, 19.1]);
    add(40, box(14.6, 17.2, 0, 6.8, 2.6, 1.25, DARK_WOOD), [14.6, 17.2, 21.4, 19.8]);
    add(40.1, box(16.0, 17.9, 1.25, 0.8, 0.6, 0.04, ['#fffdf5', '#eee5d2', '#e0d6c0']), [14.6, 17.2, 21.4, 19.8]);
    add(40.2, box(19.2, 18.2, 1.25, 0.3, 0.3, 0.35, ['#ffffff', '#ececec', '#d9d9d9']), [14.6, 17.2, 21.4, 19.8]);
    add(43, box(22.3, 19.4, 0, 1.3, 2.4, 1.2, WOOD), [22.3, 19.4, 23.6, 21.8]);
    add(43.1, box(22.6, 19.8, 1.2, 0.7, 0.7, 0.9, '#3b4252'), [22.3, 19.4, 23.6, 21.8]);
    add(43.2, box(22.7, 20.9, 1.2, 0.35, 0.35, 0.35, ['#ffffff', '#ececec', '#d9d9d9']), [22.3, 19.4, 23.6, 21.8]);
    add(25.6, plant(23.0, 13.2), [22.6, 12.8, 23.4, 13.6]);
    add(35.9, plant(13.2, 23.0), [12.8, 22.6, 13.6, 23.4]);
  }
  if (room === 'kike') {
    add(37.6, plant(13.2, 25.0), [12.8, 24.6, 13.6, 25.4]);
    add(47.6, plant(23.0, 25.0), [22.6, 24.6, 23.4, 25.4]);
    add(44.9, box(17.6, 26.4, 0, 1.2, 0.3, 2.8, ['#e7b84a', '#c99a2e', '#b08424']), [17.6, 26.4, 18.8, 26.7]);
    add(46.0, box(16.4, 28.4, 0, 3.6, 1.5, 1.3, DARK_WOOD), [16.4, 28.4, 20.0, 29.9]);
    const [px, py] = iso(16.6, 29.92, 0.65);
    add(
      46.1,
      s(
        'text',
        { transform: `matrix(0.8944,0.4472,0,1,${px},${py})`, 'font-size': 7.5, 'font-weight': 900, fill: '#ffe08a', 'letter-spacing': 1 },
        '👑 JEFE'
      ),
      [16.4, 28.4, 20.0, 29.9]
    );
    add(46.2, s('polygon', { points: P([[16.7, 28.95, 1.38], [18.0, 28.95, 1.38], [18.0, 28.8, 2.3], [16.7, 28.8, 2.3]]), fill: '#3b4252', ...EDGE }), [16.4, 28.4, 20.0, 29.9]);
    add(46.3, box(19.1, 28.8, 1.3, 0.35, 0.35, 0.4, ['#ffffff', '#ececec', '#d9d9d9']), [16.4, 28.4, 20.0, 29.9]);
    const [gx, gy] = iso(18.9, 29.5, 1.75);
    add(46.4, s('circle', { cx: gx, cy: gy, r: 4.2, fill: '#22a6c0', stroke: '#2e7d4f', 'stroke-width': 1.4 }), [16.4, 28.4, 20.0, 29.9]);
    add(52.0, box(22.4, 29.4, 0, 1.2, 3.4, 0.8, ['#3f8f9a', '#2f7a85', '#256570']), [22.4, 29.4, 23.6, 32.8]);
    // camita del gato
    const ell = (cx, cy, z, r, fill) => {
      const [ex, ey] = iso(cx, cy, z);
      return s('ellipse', { cx: ex, cy: ey, rx: r * 22.6, ry: r * 11.3, fill });
    };
    add(
      45.8,
      s('g', null, ell(14.2, 31.6, 0, 1.2, '#b8531f'), ell(14.2, 31.6, 0.3, 1.2, '#ff8a3d'), ell(14.2, 31.6, 0.34, 0.86, '#fde07e'), ell(14.2, 31.7, 0.36, 0.5, '#ffd25c')),
      [13.0, 30.5, 15.4, 32.7]
    );
    add(52.1, box(23.25, 29.4, 0.8, 0.35, 3.4, 0.9, ['#3f8f9a', '#2f7a85', '#256570']), [22.4, 29.4, 23.6, 32.8]);
  }
  return items;
}

// Tabiques bajos: [eje, coordenada, desde, hasta]
const PARTITIONS = [
  ['x', 12, 0.2, 8],
  ['x', 12, 10.5, 11.85],
  ['y', 12, 0.2, 8],
  ['y', 12, 10.5, 11.85],
  ['x', 12, 12.15, 13.5],
  ['x', 12, 16, 23.8],
  ['y', 12, 12.15, 13.5],
  ['y', 12, 16, 23.8],
  ['y', 24, 12.15, 19],
  ['y', 24, 21.5, 23.8],
];

function partitions(segments) {
  const g = s('g', { class: 'partitions', 'pointer-events': 'none' });
  const colors = ['#d8c29c', '#f6ecd9', '#e6d4b2'];
  for (const [axis, at, a, b] of segments) {
    g.append(axis === 'x' ? box(at - 0.15, a, 0, 0.3, b - a, 1.1, colors) : box(a, at - 0.15, 0, b - a, 0.3, 1.1, colors));
  }
  return g;
}

// ---------- Personajes ----------

const PANTS = '#34405a';

function hair(look) {
  const c = look.hair || '#1b1b1b';
  const cap = s('path', { d: 'M-9.9 -35.5 C-10.5 -47.5 10.5 -47.5 9.9 -35.5 C7 -40 -4 -41.5 -9.9 -35.5 Z', fill: c });
  switch (look.hairStyle) {
    case 'bun':
      return [s('circle', { cx: 0, cy: -47.5, r: 4.6, fill: c }), cap];
    case 'curly': {
      const g = s('g', { fill: c });
      [[-8, -40], [-5, -45], [0, -47], [5, -45], [8, -40], [-9.5, -35], [9.5, -35], [-2.5, -43], [3, -42.5]].forEach(([x, y]) =>
        g.append(s('circle', { cx: x, cy: y, r: 4.4 }))
      );
      return [g];
    }
    case 'long':
      return [cap];
    case 'gorra':
      return [
        s('path', { d: 'M-9.9 -37 C-10 -48 10 -48 9.9 -37 Z', fill: c }),
        s('path', { d: 'M-10.5 -37.5 L13.5 -37.5 Q14 -35.6 11.5 -35.4 L-10.5 -35.6 Z', fill: shade(c, -0.25) }),
      ];
    default:
      return [cap, s('path', { d: 'M-9.6 -38 Q-6 -42 -1 -40.5 Q-5 -39.5 -9.6 -36 Z', fill: c })];
  }
}

function hairBack(look) {
  if (look.hairStyle !== 'long') return null;
  return s('rect', { x: -10.6, y: -40, width: 21.2, height: 17, rx: 6, fill: look.hair || '#1b1b1b' });
}

const INK = '#2b2f3a';

/** Accesorios y ropa por agente (se activan con look.kit: 'copy' | 'analista' | 'guion'). */
function kitParts(look) {
  const shirt = look.shirt || '#008ec7';
  const kit = look.kit;
  const out = { collar: [], front: [], head: [], armL: [], armR: [], fx: [] };
  const hoodie = () => {
    out.collar.push(
      s('path', { d: 'M-8.6 -26.5 Q0 -19.5 8.6 -26.5 L8.6 -24.2 Q0 -16.6 -8.6 -24.2 Z', fill: shade(shirt, -0.22) }),
      s('rect', { x: -5.2, y: -16.5, width: 10.4, height: 5.2, rx: 1.6, fill: shade(shirt, -0.14) }),
      s('path', { d: 'M-2 -21 L-2.4 -16.8 M2 -21 L2.4 -16.8', stroke: '#ffffff', 'stroke-width': 0.8, 'stroke-linecap': 'round' })
    );
  };
  if (kit === 'copy') {
    hoodie();
    out.head.push(
      s('path', { class: 'acc-cap', d: 'M-9.9 -39.5 C-10 -50 10 -50 9.9 -39.5 Z', fill: shade(shirt, -0.12) }),
      s('path', { d: 'M-10.2 -40 L14.2 -40 Q14.6 -37.8 11.8 -37.6 L-10.2 -38 Z', fill: shade(shirt, -0.32) }),
      s('path', { d: 'M-10.6 -38 C-11.6 -55 11.6 -55 10.6 -38', stroke: INK, 'stroke-width': 1.7, fill: 'none', 'stroke-linecap': 'round' }),
      s('rect', { x: -12.6, y: -41, width: 3.6, height: 8, rx: 1.6, fill: INK }),
      s('rect', { x: 9, y: -41, width: 3.6, height: 8, rx: 1.6, fill: INK })
    );
    out.armR.push(
      s(
        'g',
        { class: 'acc-note', transform: 'translate(13.5,-15)' },
        s('rect', { x: -3.6, y: -5.4, width: 7.2, height: 10.8, rx: 1, fill: '#ffb36b', stroke: 'rgba(0,0,0,.25)', 'stroke-width': 0.5 }),
        s('rect', { x: -2.6, y: -4.4, width: 5.4, height: 8.8, rx: 0.6, fill: '#fffdf5' }),
        s('path', { d: 'M-1.4 -2 H1.8 M-1.4 0.2 H1.8 M-1.4 2.4 H0.6', stroke: '#b9b09a', 'stroke-width': 0.6 })
      )
    );
    out.fx.push(
      s(
        'g',
        { class: 'fx fx-idea', transform: 'translate(13,-50)' },
        s('circle', { r: 3.4, fill: '#ffd54a', stroke: '#e0a800', 'stroke-width': 0.6 }),
        s('rect', { x: -1.5, y: 3, width: 3, height: 1.8, rx: 0.6, fill: '#8a8f9c' }),
        s('path', { d: 'M-5.5 -4 L-4 -3 M5.5 -4 L4 -3 M0 -6.6 V-5', stroke: '#e0a800', 'stroke-width': 0.8, 'stroke-linecap': 'round' })
      )
    );
  } else if (kit === 'analista') {
    out.collar.push(
      s('path', { d: 'M-8.6 -26.5 L-2.2 -26.5 L-2.2 -9.5 L-8.6 -9.5 Z', fill: shade(shirt, -0.38) }),
      s('path', { d: 'M8.6 -26.5 L2.2 -26.5 L2.2 -9.5 L8.6 -9.5 Z', fill: shade(shirt, -0.38) }),
      s('path', { d: 'M-2.2 -26.5 L2.2 -26.5 L2.2 -9.5 L-2.2 -9.5 Z', fill: '#f2f5f8' }),
      s('path', { d: 'M-3.4 -26.4 L0 -21.6 L3.4 -26.4', fill: 'none', stroke: shade(shirt, -0.5), 'stroke-width': 0.8 })
    );
    out.head.push(
      s(
        'g',
        { class: 'acc-glasses', fill: 'rgba(255,255,255,.18)', stroke: INK, 'stroke-width': 1 },
        s('circle', { cx: -3.7, cy: -35.4, r: 2.9 }),
        s('circle', { cx: 3.7, cy: -35.4, r: 2.9 }),
        s('path', { d: 'M-0.8 -35.6 H0.8 M-6.6 -35.8 L-9.4 -36.6 M6.6 -35.8 L9.4 -36.6', fill: 'none' })
      )
    );
    out.armL.push(
      s(
        'g',
        { class: 'acc-tablet', transform: 'translate(-14.5,-15)' },
        s('rect', { x: -4.4, y: -6.2, width: 8.8, height: 12, rx: 1.4, fill: INK }),
        s('rect', { x: -3.4, y: -5, width: 6.8, height: 9.6, rx: 0.6, fill: '#d6edf8' }),
        s('rect', { class: 'chart-bar', x: -2.6, y: -0.6, width: 1.5, height: 4, fill: '#ff8a3d' }),
        s('rect', { class: 'chart-bar', x: -0.7, y: -2.6, width: 1.5, height: 6, fill: '#0078ab' }),
        s('rect', { class: 'chart-bar', x: 1.2, y: -1.6, width: 1.5, height: 5, fill: '#30bb4f' })
      )
    );
    out.fx.push(
      s(
        'g',
        { class: 'fx fx-search', transform: 'translate(-13,-49)' },
        s('circle', { r: 3, fill: 'rgba(255,255,255,.7)', stroke: INK, 'stroke-width': 1 }),
        s('path', { d: 'M2.2 2.2 L5 5', stroke: INK, 'stroke-width': 1.4, 'stroke-linecap': 'round' })
      )
    );
  } else if (kit === 'guion') {
    hoodie();
    out.collar.push(
      s('path', { d: 'M-9.4 -31 C-9.6 -21 9.6 -21 9.4 -31', stroke: INK, 'stroke-width': 1.6, fill: 'none' }),
      s('rect', { x: -12, y: -32, width: 3.6, height: 7, rx: 1.5, fill: INK }),
      s('rect', { x: 8.4, y: -32, width: 3.6, height: 7, rx: 1.5, fill: INK })
    );
    const card = (cls, rot) =>
      s(
        'g',
        { class: `card ${cls}`, transform: `rotate(${rot})` },
        s('rect', { x: -3.4, y: -5, width: 6.8, height: 9.6, rx: 0.8, fill: '#fffdf5', stroke: 'rgba(0,0,0,.25)', 'stroke-width': 0.5 }),
        s('path', { d: 'M-2 -2.8 H2 M-2 -0.8 H1 M-2 1.2 H2', stroke: shade(shirt, -0.1), 'stroke-width': 0.7 })
      );
    out.armR.push(s('g', { class: 'acc-cards', transform: 'translate(13.5,-15)' }, card('c1', -14), card('c2', 0), card('c3', 14)));
    out.fx.push(
      s(
        'g',
        { class: 'fx fx-check', transform: 'translate(13,-49)' },
        s('circle', { r: 3.8, fill: '#2fb361' }),
        s('path', { d: 'M-2 0 L-0.5 1.6 L2.2 -1.6', stroke: '#fff', 'stroke-width': 1.3, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
      )
    );
  }
  return out;
}

export function spriteParts(look, { withLegs = true } = {}) {
  const shirt = look.shirt || '#008ec7';
  const skin = look.skin || '#c68642';
  const dark = shade(shirt, -0.2);
  const kit = kitParts(look);
  const hand = (x) => s('rect', { x: x - 2.4, y: -14.6, width: 4.8, height: 4.4, rx: 1.8, fill: skin });
  const parts = [];
  if (withLegs) {
    parts.push(
      s(
        'g',
        { class: 'legs' },
        s('g', { class: 'leg leg-l' }, s('rect', { x: -6.8, y: -9, width: 6.6, height: 9, rx: 1, fill: PANTS }), s('rect', { x: -7.2, y: -2, width: 7.4, height: 2, rx: 0.8, fill: '#1d2433' })),
        s('g', { class: 'leg leg-r' }, s('rect', { x: 0.2, y: -9, width: 6.6, height: 9, rx: 1, fill: PANTS }), s('rect', { x: -0.2, y: -2, width: 7.4, height: 2, rx: 0.8, fill: '#1d2433' }))
      )
    );
  }
  parts.push(
    s(
      'g',
      { class: 'body-bob' },
      hairBack(look),
      s('g', { class: 'arm arm-l' }, s('rect', { x: -12.2, y: -25.5, width: 4.8, height: 12, rx: 1.8, fill: dark }), hand(-9.8), ...kit.armL),
      s('g', { class: 'arm arm-r' }, s('rect', { x: 7.4, y: -25.5, width: 4.8, height: 12, rx: 1.8, fill: dark }), hand(9.8), ...kit.armR),
      // cadera
      s('rect', { x: -8.8, y: -12, width: 17.6, height: 4, rx: 1, fill: shade(PANTS, -0.08) }),
      // torso trapezoidal
      s('path', { d: 'M-8 -26.5 L8 -26.5 L8.9 -11.5 L-8.9 -11.5 Z', fill: shirt, stroke: shade(shirt, -0.25), 'stroke-width': 0.5, 'stroke-linejoin': 'round' }),
      s('path', { d: 'M-3.2 -26.4 L0 -22.6 L3.2 -26.4 Z', fill: shade(shirt, 0.35) }),
      ...kit.collar,
      s('rect', { x: -2.6, y: -29.5, width: 5.2, height: 4, fill: shade(skin, -0.1) }),
      // cabeza cilíndrica con taquito
      s('rect', { x: -3.4, y: -48.4, width: 6.8, height: 3.4, rx: 1.2, fill: shade(skin, -0.12) }),
      s('rect', { x: -9.6, y: -46, width: 19.2, height: 17.5, rx: 3.6, fill: skin }),
      hair(look),
      s(
        'g',
        { class: 'face' },
        s('g', { class: 'brows' }, s('path', { class: 'brow brow-l', d: 'M-5.6 -39.4 Q-3.6 -40.4 -1.4 -39.6', stroke: '#3a2a20', 'stroke-width': 1, fill: 'none', 'stroke-linecap': 'round' }), s('path', { class: 'brow brow-r', d: 'M1.4 -39.6 Q3.6 -40.4 5.6 -39.4', stroke: '#3a2a20', 'stroke-width': 1, fill: 'none', 'stroke-linecap': 'round' })),
        s(
          'g',
          { class: 'eyes' },
          s('ellipse', { cx: -3.3, cy: -35.4, rx: 1.25, ry: 1.6, fill: '#1d2433' }),
          s('ellipse', { cx: 3.3, cy: -35.4, rx: 1.25, ry: 1.6, fill: '#1d2433' })
        ),
        s('circle', { cx: -5.8, cy: -32.4, r: 1.7, fill: '#ff8a80', opacity: 0.4 }),
        s('circle', { cx: 5.8, cy: -32.4, r: 1.7, fill: '#ff8a80', opacity: 0.4 }),
        s('path', { class: 'mouth', d: 'M-2.6 -31.4 Q0 -29.2 2.6 -31.4', stroke: '#6b3a2a', 'stroke-width': 1.3, fill: 'none', 'stroke-linecap': 'round' })
      ),
      ...kit.head,
      // nuca: se ve cuando el personaje está de espaldas
      s('path', {
        class: 'back-hair',
        d: 'M-9.9 -36 C-10.5 -48 10.5 -48 9.9 -36 C9.6 -30 6 -27.2 0 -27.2 C-6 -27.2 -9.6 -30 -9.9 -36 Z',
        fill: look.hairStyle === 'gorra' ? shade(look.hair || '#1b1b1b', -0.1) : look.hair || '#1b1b1b',
      }),
      ...kit.fx
    )
  );
  return parts;
}

/** Avatar pequeño para la interfaz (cabeza y hombros). */
export function avatarSvg(look, cls = 'avatar') {
  return s('svg', { class: cls, viewBox: '-14 -50 28 30', 'aria-hidden': 'true' }, ...spriteParts(look, { withLegs: false }));
}

function nameWidth(text, size = 9) {
  return Math.max(30, text.length * size * 0.58 + 14);
}

function inkFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.62 ? '#1d2433' : '#ffffff';
}

function buildChar(id) {
  const a = store.agents()[id];
  const name = (a.name || ROLES[id].title).slice(0, 16);
  const w = nameWidth(name);
  const el = s(
    'g',
    { class: 'agent', 'data-agent': id, 'data-status': runtime.status[id], role: 'button', tabindex: 0, 'aria-label': `Hablar con ${name}` },
    s('ellipse', { class: 'shadow', cx: 0, cy: 0, rx: 10.5, ry: 4.2, fill: 'rgba(60,35,10,.2)' }),
    s('g', { class: 'sprite' }, ...spriteParts(a.look)),
    s(
      'g',
      { class: 'nametag', transform: 'translate(0,-58)' },
      s('rect', { x: -w / 2, y: -8, width: w, height: 15, rx: 7.5, fill: a.look.shirt }),
      s('text', { x: 0, y: 3, 'text-anchor': 'middle', 'font-size': 9, 'font-weight': 800, fill: inkFor(a.look.shirt) }, name)
    ),
    s(
      'g',
      { class: 'bubble', transform: 'translate(0,-78)' },
      s('rect', { class: 'bubble-bg', x: -40, y: -9, width: 80, height: 17, rx: 8.5 }),
      s('path', { class: 'bubble-tail', d: 'M-4 8 L0 13 L4 8 Z' }),
      s('text', { class: 'bubble-text', x: 0, y: 3, 'text-anchor': 'middle', 'font-size': 8.5, 'font-weight': 700 }, '')
    )
  );
  updateBubble(el, id);
  return el;
}

function updateBubble(el, id) {
  const status = runtime.status[id];
  el.setAttribute('data-status', status);
  el.classList.toggle('is-working', status === 'thinking' || status === 'searching');
  el.classList.toggle('is-talking', status === 'talking');
  const label = STATUS_LABEL[status] || '';
  const text = el.querySelector('.bubble-text');
  const bg = el.querySelector('.bubble-bg');
  if (!text) return;
  text.textContent = label;
  const w = nameWidth(label, 8.5);
  bg.setAttribute('x', -w / 2);
  bg.setAttribute('width', w);
}

const place = (el, [x, y]) => {
  const [px, py] = iso(x, y);
  el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
};

function homeOf(id) {
  return runtime.location[id] === 'meeting' ? MEET[id] : SEATS[id];
}

// ---------- Montaje ----------

const LAYER_ORDER = [
  ['room', 'copy'],
  ['parts', 0, 4],
  ['room', 'analista'],
  ['room', 'guion'],
  ['parts', 4, 8],
  ['room', 'juntas'],
  ['parts', 8, 10],
  ['room', 'kike'],
];

function bossChar() {
  const b = store.boss();
  const name = `👑 ${(b.name || 'Kike').slice(0, 14)}`;
  const w = nameWidth(name) + 4;
  return s(
    'g',
    { class: 'agent boss', 'data-boss': '1', 'data-status': 'idle', role: 'img', 'aria-label': `${b.name}, el jefe` },
    s('ellipse', { class: 'shadow', cx: 0, cy: 0, rx: 11, ry: 4.4, fill: 'rgba(60,35,10,.22)' }),
    s('g', { class: 'sprite' }, ...spriteParts(b.look)),
    s(
      'g',
      { class: 'nametag', transform: 'translate(0,-58)' },
      s('rect', { x: -w / 2, y: -8, width: w, height: 15, rx: 7.5, fill: '#e7b84a' }),
      s('text', { x: 0, y: 3, 'text-anchor': 'middle', 'font-size': 9, 'font-weight': 900, fill: '#1d2433' }, name)
    )
  );
}

export function renderOffice(container) {
  const host = container || svgRoot?.parentElement;
  if (!host) return;
  const svg = s('svg', {
    class: 'office-svg',
    viewBox: '-395 -128 790 650',
    role: 'img',
    'aria-label': 'Oficina isométrica de Vacilando Ando: tres agentes, tu oficina y la sala de juntas',
  });
  svg.append(
    s(
      'defs',
      null,
      s(
        'linearGradient',
        { id: 'sky', x1: 0, y1: 0, x2: 0, y2: 1 },
        s('stop', { offset: '0', 'stop-color': '#7cc8f0' }),
        s('stop', { offset: '1', 'stop-color': '#d9f3ff' })
      )
    )
  );
  const root = s('g', { class: 'scene' });
  svg.append(root);
  root.append(staticScene());

  layers = { rooms: {} };
  const roomLayer = (room) => {
    const g = s('g', { class: 'room-layer', 'data-room': room });
    const items = roomItems(room);
    for (const id of AGENT_IDS) {
      if (room === id) {
        const slot = s('g', { class: 'slot' });
        slots[id] = { ...(slots[id] || {}), office: slot };
        items.push({ depth: SEATS[id][0] + SEATS[id][1], node: slot });
      }
      if (room === 'juntas') {
        const slot = s('g', { class: 'slot' });
        slots[id] = { ...(slots[id] || {}), meeting: slot };
        items.push({ depth: MEET[id][0] + MEET[id][1], node: slot });
      }
    }
    items
      .sort((a, b) => a.depth - b.depth)
      .forEach((it) => {
        it.node.__depth = it.depth;
        it.node.__bounds = it.b;
        g.append(it.node);
      });
    layers.rooms[room] = g;
    return g;
  };
  for (const [kind, a, b] of LAYER_ORDER) {
    root.append(kind === 'room' ? roomLayer(a) : partitions(PARTITIONS.slice(a, b)));
  }
  layers.overlay = s('g', { class: 'overlay' });
  root.append(layers.overlay);

  // Etiquetas de las salas
  const labels = s('g', { class: 'room-labels' });
  const agents = store.agents();
  const [kx, ky] = iso(24, 34);
  const spots = {
    copy: iso(0, 0, 8.4),
    analista: iso(17.5, 0, 7.6),
    guion: iso(0, 17.5, 7.6),
    juntas: [175, 356],
    kike: [kx, ky + 30],
  };
  for (const room of ['copy', 'analista', 'guion', 'juntas', 'kike']) {
    const text =
      room === 'juntas' ? '🤝 Sala de juntas' : room === 'kike' ? `👑 Oficina de ${store.boss().name || 'Kike'}` : `${ROLES[room].icon} ${agents[room].name}`;
    const w = nameWidth(text, 11) + 6;
    const [lx, ly] = spots[room];
    labels.append(
      s(
        'g',
        { class: 'room-label', 'data-room': room, transform: `translate(${lx},${ly})`, role: 'button', tabindex: -1 },
        s('rect', { x: -w / 2, y: -11, width: w, height: 22, rx: 11 }),
        s('text', { x: 0, y: 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 800 }, text)
      )
    );
  }
  root.append(labels);

  // Personajes
  for (const id of AGENT_IDS) {
    const el = buildChar(id);
    charEls[id] = el;
    place(el, homeOf(id));
    slots[id][runtime.location[id] === 'meeting' ? 'meeting' : 'office'].append(el);
  }
  boss.el = bossChar();
  boss.el.classList.toggle('facing-away', boss.facing === 'away');
  boss.el.classList.toggle('walking', !!boss.path.length);
  setBossPos(boss.x, boss.y);
  buildCat();
  setCatPos(cat.x, cat.y, cat.z);

  // Interacción: tocar un agente o una etiqueta = ir a consultarle; tocar el piso = caminar hasta ahí.
  svg.addEventListener('click', (e) => {
    if (e.target.closest('[data-cat]')) {
      visit('cat');
      return;
    }
    const target = e.target.closest('[data-agent], .room-label');
    if (target) {
      visit(target.dataset.agent || target.dataset.room);
      return;
    }
    // Tocar cualquier otro punto de la oficina: el jefe camina hasta ahí.
    if (e.target.closest('.scene')) {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      const x = (p.x / TW + p.y / TH) / 2;
      const y = (p.y / TH - p.x / TW) / 2;
      bossWalkTo([x, y], { face: null, target: null });
    }
  });
  svg.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = e.target.closest('[data-cat], [data-agent], [data-room]');
    if (!target) return;
    e.preventDefault();
    visit(target.dataset.cat ? 'cat' : target.dataset.agent || target.dataset.room);
  });

  host.replaceChildren(svg);
  svgRoot = svg;
  setActiveRoom(activeRoom);
}

let activeRoom = null;
export function setActiveRoom(room) {
  activeRoom = room;
  if (!svgRoot) return;
  svgRoot.querySelectorAll('.room-floor').forEach((p) => p.classList.toggle('is-active', p.dataset.room === room));
  svgRoot.querySelectorAll('.room-label').forEach((p) => p.classList.toggle('is-active', p.dataset.room === room));
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmallScreen = () => window.matchMedia('(max-width: 900px)').matches;

async function walk(id, to) {
  const el = charEls[id];
  if (!el || runtime.location[id] === to) {
    runtime.location[id] = to;
    return;
  }
  const route = to === 'meeting' ? [...ROUTES[id], MEET[id]] : [...ROUTES[id]].reverse().concat([SEATS[id]]);
  runtime.location[id] = to;
  if (reduceMotion()) {
    place(el, route[route.length - 1]);
    slots[id][to].append(el);
    return;
  }
  layers.overlay.append(el);
  el.getBoundingClientRect();
  el.classList.add('walking');
  let from = to === 'meeting' ? SEATS[id] : MEET[id];
  for (const point of route) {
    const dist = Math.hypot(point[0] - from[0], point[1] - from[1]);
    const ms = Math.max(250, (dist / 5) * 1000);
    el.style.setProperty('--walk', `${ms}ms`);
    await new Promise((r) => requestAnimationFrame(() => r()));
    place(el, point);
    await wait(ms);
    from = point;
  }
  el.classList.remove('walking');
  if (charEls[id] === el) slots[id][to].append(el);
}

/** Mueve un agente a su oficina o a la sala de juntas, con animación. */
export function moveAgent(id, to) {
  walking[id] = (walking[id] || Promise.resolve()).then(() => walk(id, to));
  return walking[id];
}

// ---------- Avatar del jefe: caminar por la oficina ----------

const BOSS_SPOTS = {
  home: { at: [18.2, 27.4], face: 'front' },
  meeting: { at: [13.75, 18.5], face: 'front' },
  copy: { at: [6.3, 8.3], face: 'away' },
  analista: { at: [18.2, 8.3], face: 'away' },
  guion: { at: [6.3, 20.3], face: 'away' },
};
const SPEED = 6.5; // unidades por segundo
const PAD = 0.32; // "radio" del avatar para no atravesar muebles

// Obstáculos en el piso [x1, y1, x2, y2]: muebles (con los agentes sentados) y tabiques.
const OBSTACLES = [
  [0.1, 9.9, 1.0, 11.7],
  [10.4, 0.9, 11.2, 1.7],
  [4.6, 3.6, 8.0, 7.1],
  [12.8, 0.9, 13.6, 1.7],
  [16.4, 3.6, 20.0, 7.1],
  [22.4, 8.6, 23.6, 10.2],
  [1.0, 22.2, 1.8, 23.0],
  [4.6, 15.6, 8.0, 19.1],
  [9.0, 20.1, 10.2, 21.1],
  [15.3, 15.25, 20.7, 16.9],
  [14.6, 17.2, 21.4, 19.8],
  [12.75, 17.9, 13.1, 19.1],
  [22.3, 19.4, 23.6, 21.8],
  [22.6, 12.8, 23.4, 13.6],
  [12.8, 22.6, 13.6, 23.4],
  [12.8, 24.6, 13.6, 25.4],
  [22.6, 24.6, 23.4, 25.4],
  [17.6, 26.4, 18.8, 26.7],
  [16.4, 28.4, 20.0, 29.9],
  [22.4, 29.4, 23.6, 32.8],
  [13.0, 30.5, 15.4, 32.7],
  ...PARTITIONS.map(([axis, at, a, b]) => (axis === 'x' ? [at - 0.15, a, at + 0.15, b] : [a, at - 0.15, b, at + 0.15])),
];

const boss = { x: 18.2, y: 27.4, el: null, path: [], target: 'home', facing: 'front', keys: new Set(), raf: 0, last: 0, done: null };

function isFree(x, y) {
  if (x < 0.6 || x > 23.4 || y < 0.6 || y > 33.4) return false;
  if (x < 12.4 && y > 23.4) return false;
  for (const [a, b, c, d] of OBSTACLES) if (x > a - PAD && x < c + PAD && y > b - PAD && y < d + PAD) return false;
  return true;
}

function lineFree(a, b) {
  const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.15);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!isFree(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false;
  }
  return true;
}

const G = 0.5;
const GW = 49;
const GH = 69;
const cellFree = (i, j) => isFree(i * G, j * G);

function nearestFreeCell(x, y) {
  const ci = Math.round(x / G);
  const cj = Math.round(y / G);
  for (let r = 0; r < 12; r++) {
    let best = null;
    for (let i = ci - r; i <= ci + r; i++) {
      for (let j = cj - r; j <= cj + r; j++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r || !cellFree(i, j)) continue;
        const d = Math.hypot(i * G - x, j * G - y);
        if (!best || d < best.d) best = { i, j, d };
      }
    }
    if (best) return best;
  }
  return null;
}

/** Ruta más corta (A*) por la cuadrícula del piso, luego suavizada. */
function findPath(from, to) {
  const start = nearestFreeCell(from[0], from[1]);
  const goal = nearestFreeCell(to[0], to[1]);
  if (!start || !goal) return null;
  const key = (i, j) => j * GW + i;
  const gScore = new Map([[key(start.i, start.j), 0]]);
  const came = new Map();
  const h = (i, j) => {
    const dx = Math.abs(i - goal.i);
    const dy = Math.abs(j - goal.j);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const open = [[h(start.i, start.j), start.i, start.j]];
  const closed = new Set();
  const push = (n) => {
    open.push(n);
    let k = open.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (open[p][0] <= open[k][0]) break;
      [open[p], open[k]] = [open[k], open[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = open[0];
    const last = open.pop();
    if (open.length) {
      open[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < open.length && open[l][0] < open[m][0]) m = l;
        if (r < open.length && open[r][0] < open[m][0]) m = r;
        if (m === k) break;
        [open[m], open[k]] = [open[k], open[m]];
        k = m;
      }
    }
    return top;
  };
  let found = false;
  while (open.length) {
    const [, i, j] = pop();
    const k = key(i, j);
    if (closed.has(k)) continue;
    closed.add(k);
    if (i === goal.i && j === goal.j) {
      found = true;
      break;
    }
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= GW || nj >= GH || !cellFree(ni, nj)) continue;
        if (di && dj && (!cellFree(i + di, j) || !cellFree(i, j + dj))) continue;
        const nk = key(ni, nj);
        const g = gScore.get(k) + (di && dj ? Math.SQRT2 : 1);
        if (g < (gScore.get(nk) ?? Infinity)) {
          gScore.set(nk, g);
          came.set(nk, k);
          push([g + h(ni, nj), ni, nj]);
        }
      }
    }
  }
  if (!found) return null;
  const cells = [];
  for (let k = key(goal.i, goal.j); k !== undefined; k = came.get(k)) cells.unshift([(k % GW) * G, Math.floor(k / GW) * G]);
  const end = isFree(to[0], to[1]) ? to : cells[cells.length - 1];
  const raw = [from, ...cells.slice(1, -1), end];
  // Suavizado: saltar directo al punto visible más lejano.
  const out = [raw[0]];
  let i = 0;
  while (i < raw.length - 1) {
    let j = raw.length - 1;
    while (j > i + 1 && !lineFree(raw[i], raw[j])) j--;
    out.push(raw[j]);
    i = j;
  }
  return out;
}

function roomAt(x, y) {
  if (y >= 24) return 'kike';
  if (y < 12) return x < 12 ? 'copy' : 'analista';
  return x < 12 ? 'guion' : 'juntas';
}

function isBehind(node, x, y, onTop) {
  if (node.__mover) return node.__depth <= x + y;
  const b = node.__bounds;
  if (b) {
    // Algo que está encima de un mueble (el gato en el escritorio o en su cama) se dibuja después de él.
    if (onTop && x >= b[0] - 0.1 && x <= b[2] + 0.1 && y >= b[1] - 0.1 && y <= b[3] + 0.1) return true;
    return b[2] <= x + 0.05 || b[3] <= y + 0.05;
  }
  return node.__depth != null && node.__depth <= x + y;
}

/** Coloca a un personaje que se mueve en la capa de su sala, delante de lo que tiene detrás. */
function relayer(ent) {
  if (!layers?.rooms || !ent.el) return;
  const layer = layers.rooms[roomAt(ent.x, ent.y)];
  const kids = [...layer.children].filter((n) => n !== ent.el);
  let lastBehind = -1;
  kids.forEach((n, i) => {
    if (isBehind(n, ent.x, ent.y, (ent.z || 0) > 0)) lastBehind = i;
  });
  const ref = kids[lastBehind + 1] || null;
  if (ent.el.parentNode === layer && ent.el.nextSibling === ref) return;
  layer.insertBefore(ent.el, ref);
}

function setBossPos(x, y) {
  boss.x = x;
  boss.y = y;
  if (!boss.el) return;
  const [px, py] = iso(x, y);
  boss.el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
  boss.el.__mover = true;
  boss.el.__depth = x + y;
  relayer(boss);
}

function setFacing(face) {
  if (!face || face === boss.facing) return;
  boss.facing = face;
  boss.el?.classList.toggle('facing-away', face === 'away');
}

function finishPath(arrived) {
  boss.path = [];
  boss.el?.classList.remove('walking');
  const done = boss.done;
  boss.done = null;
  done?.(arrived);
}

function tick(ts) {
  const dt = boss.last ? Math.min(0.05, (ts - boss.last) / 1000) : 0;
  boss.last = ts;
  let moving = false;

  if (boss.keys.size) {
    let dx = 0;
    let dy = 0;
    for (const k of boss.keys) {
      if (k === 'up') (dx -= 1), (dy -= 1);
      if (k === 'down') (dx += 1), (dy += 1);
      if (k === 'left') (dx -= 1), (dy += 1);
      if (k === 'right') (dx += 1), (dy -= 1);
    }
    const len = Math.hypot(dx, dy);
    if (len) {
      const vx = (dx / len) * SPEED * dt;
      const vy = (dy / len) * SPEED * dt;
      const nx = boss.x + vx;
      const ny = boss.y + vy;
      if (isFree(nx, ny)) setBossPos(nx, ny);
      else if (isFree(nx, boss.y)) setBossPos(nx, boss.y);
      else if (isFree(boss.x, ny)) setBossPos(boss.x, ny);
      setFacing(dx + dy < 0 ? 'away' : dx + dy > 0 ? 'front' : null);
      boss.el?.classList.add('walking');
      moving = true;
    }
  } else if (boss.path.length) {
    let budget = SPEED * dt;
    while (budget > 0 && boss.path.length) {
      const [tx, ty] = boss.path[0];
      const dx = tx - boss.x;
      const dy = ty - boss.y;
      const d = Math.hypot(dx, dy);
      if (d <= budget) {
        setBossPos(tx, ty);
        boss.path.shift();
        budget -= d;
      } else {
        setBossPos(boss.x + (dx / d) * budget, boss.y + (dy / d) * budget);
        setFacing(dx + dy < -0.01 ? 'away' : dx + dy > 0.01 ? 'front' : null);
        budget = 0;
      }
    }
    moving = true;
    if (!boss.path.length) {
      setFacing(boss.arriveFace);
      finishPath(true);
    }
  } else {
    boss.el?.classList.remove('walking');
  }

  if (moving || boss.keys.size) boss.raf = requestAnimationFrame(tick);
  else {
    boss.raf = 0;
    boss.last = 0;
  }
}

function startLoop() {
  if (!boss.raf) {
    boss.last = 0;
    boss.raf = requestAnimationFrame(tick);
  }
}

/** Camina hasta un punto [x, y]. Devuelve una promesa: true si llegó, false si lo interrumpieron. */
function bossWalkTo(point, { face = null, target = null } = {}) {
  if (boss.done) finishPath(false);
  boss.target = target;
  const path = findPath([boss.x, boss.y], point);
  if (!path || path.length < 2) {
    setFacing(face);
    return Promise.resolve(!!path);
  }
  boss.arriveFace = face;
  if (reduceMotion()) {
    const end = path[path.length - 1];
    setBossPos(end[0], end[1]);
    setFacing(face);
    return Promise.resolve(true);
  }
  boss.path = path.slice(1);
  boss.el?.classList.add('walking');
  boss.promise = new Promise((resolve) => {
    boss.done = resolve;
    startLoop();
  });
  return boss.promise;
}

/** Lleva al jefe a un lugar conocido: 'home', 'meeting' o el id de un agente. */
export function bossGoTo(where) {
  if (where === 'cat') {
    catAttend();
    return bossWalkTo(catApproach(), { face: null, target: 'cat' });
  }
  const spot = BOSS_SPOTS[where];
  if (!spot) return Promise.resolve(false);
  const [x, y] = spot.at;
  if (boss.target === where && (boss.path.length || Math.hypot(boss.x - x, boss.y - y) < 0.3)) {
    return boss.done ? boss.promise : Promise.resolve(true);
  }
  return bossWalkTo(spot.at, { face: spot.face, target: where });
}

/** Coloca al jefe sin animación (al abrir la app directo en una sección). */
export function bossPlace(where) {
  if (where === 'cat') {
    catAttend();
    const [x, y] = catApproach();
    if (boss.done) finishPath(false);
    boss.target = 'cat';
    setBossPos(x, y);
    return;
  }
  const spot = BOSS_SPOTS[where];
  if (!spot) return;
  if (boss.done) finishPath(false);
  boss.target = where;
  setBossPos(spot.at[0], spot.at[1]);
  setFacing(spot.face);
}

/** Tocar un agente o una sala: el jefe camina hasta ahí y se abre la consulta. */
export async function visit(key) {
  if (key === 'kike') {
    bossGoTo('home');
    return;
  }
  const hash = key === 'juntas' ? '#/juntas' : key === 'cat' ? '#/gato' : AGENT_IDS.includes(key) ? `#/agente/${key}` : null;
  if (!hash) return;
  const where = key === 'juntas' ? 'meeting' : key;
  if (isSmallScreen()) {
    // En el teléfono el panel tapa la oficina: primero camina, luego abre.
    const arrived = await bossGoTo(where);
    if (arrived) go(hash);
  } else {
    bossGoTo(where);
    go(hash);
  }
}

const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };

function typingTarget(el) {
  return el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

function bindKeys() {
  window.addEventListener('keydown', (e) => {
    const dir = KEYMAP[e.code];
    if (!dir || e.altKey || e.ctrlKey || e.metaKey || typingTarget(e.target) || document.querySelector('dialog[open]')) return;
    // Solo cuando el foco no está dentro del panel (para no robarle el scroll).
    if (document.activeElement && document.activeElement !== document.body && !document.activeElement.closest('.stage')) return;
    if (!document.querySelector('.office-svg')?.getClientRects().length) return;
    e.preventDefault();
    if (boss.done) finishPath(false);
    boss.target = null;
    boss.keys.add(dir);
    startLoop();
  });
  window.addEventListener('keyup', (e) => {
    const dir = KEYMAP[e.code];
    if (dir) boss.keys.delete(dir);
  });
  window.addEventListener('blur', () => boss.keys.clear());
}


// ---------- El gato: se comporta como un gato ----------

const CAT_SPEED = 3.4;
const CAT_WANDER = [
  [2.6, 5.4], [9.4, 9.6], [21.4, 4.6], [14.0, 9.6], [3.0, 19.6], [10.6, 23.0],
  [17.8, 22.4], [21.6, 15.0], [14.6, 15.2], [21.2, 27.6], [15.4, 27.4], [16.2, 30.8],
];
// Lugares donde duerme: de pie en el piso, y encima del mueble.
const CAT_PERCH = {
  bed: { floor: [15.9, 31.6], on: [14.2, 31.6, 0.34], left: true },
  desk: { floor: [18.9, 30.7], on: [18.9, 29.4, 1.32], left: false },
};

const cat = { x: 14.2, y: 31.6, z: 0.34, el: null, sprite: null, pose: 'sleep', flipLeft: true, perch: 'bed', path: [], arrive: null, gen: 0, cancel: null, listening: false, bubbleTimer: 0 };

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function buildCat() {
  const name = (catNameRaw() || '').trim();
  const sprite = buildCatSprite();
  const w = nameWidth(name || '¡Ponme nombre!', 8.5) + 2;
  const el = s(
    'g',
    { class: 'cat-agent', 'data-cat': '1', role: 'button', tabindex: 0, 'aria-label': name ? `Hablar con ${name}, tu gato` : 'Tu gato: ponle nombre' },
    s('ellipse', { class: 'cat-hit', cx: 0, cy: -14, rx: 30, ry: 28, fill: 'transparent' }),
    sprite.el,
    s(
      'g',
      { class: 'nametag cat-tag', transform: 'translate(0,-46)' },
      s('rect', { x: -w / 2, y: -8, width: w, height: 14, rx: 7, fill: name ? '#fde07e' : '#ff8a3d' }),
      s('text', { x: 0, y: 2.6, 'text-anchor': 'middle', 'font-size': 8.5, 'font-weight': 900, fill: '#1a2433' }, name || '¡Ponme nombre!')
    ),
    s(
      'g',
      { class: 'cat-bubble', transform: 'translate(0,-66)', opacity: 0 },
      s('rect', { class: 'bubble-bg', x: -22, y: -9, width: 44, height: 17, rx: 8.5 }),
      s('path', { class: 'bubble-tail', d: 'M-4 8 L0 13 L4 8 Z' }),
      s('text', { class: 'bubble-text', x: 0, y: 3, 'text-anchor': 'middle', 'font-size': 8.5, 'font-weight': 700 }, '')
    )
  );
  cat.el = el;
  cat.sprite = sprite;
  sprite.setPose(cat.pose);
  sprite.setFlip(cat.flipLeft);
  el.__mover = true;
  if (runtime.catStatus === 'thinking') catSay('💭', 60000);
  return el;
}

function catNameRaw() {
  const n = catName();
  return n === 'el gato' ? '' : n;
}

function setCatPos(x, y, z = 0, lift = 0) {
  cat.x = x;
  cat.y = y;
  cat.z = z;
  if (!cat.el) return;
  const [px, py] = iso(x, y, z + lift);
  cat.el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
  cat.el.__depth = x + y;
  relayer(cat);
}

function setCatPose(pose) {
  cat.pose = pose;
  cat.sprite?.setPose(pose);
}

function catFace(dx, dy) {
  const sdx = dx - dy; // dirección en pantalla
  if (Math.abs(sdx) < 0.02) return;
  cat.flipLeft = sdx < 0;
  cat.sprite?.setFlip(cat.flipLeft);
}

function catSay(text, ms = 2200) {
  const g = cat.el?.querySelector('.cat-bubble');
  if (!g) return;
  g.querySelector('.bubble-text').textContent = text;
  const w = Math.max(30, text.length * 6 + 16);
  const bg = g.querySelector('.bubble-bg');
  bg.setAttribute('x', -w / 2);
  bg.setAttribute('width', w);
  g.setAttribute('opacity', 1);
  clearTimeout(cat.bubbleTimer);
  cat.bubbleTimer = setTimeout(() => g.setAttribute('opacity', 0), ms);
}

/** Espera `ms` o hasta que se cancele (cuando Kike lo llama). */
function catNap(ms) {
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      cat.cancel = null;
      resolve();
    }, ms);
    cat.cancel = () => {
      clearTimeout(t);
      cat.cancel = null;
      resolve();
    };
  });
}

function catAnimate(ms, draw) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      draw(k);
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

/** Salto (a un mueble o de vuelta al piso). */
async function catHop(x, y, z) {
  const [x0, y0, z0] = [cat.x, cat.y, cat.z];
  catFace(x - x0, y - y0);
  setCatPose('sit');
  if (reduceMotion()) return setCatPos(x, y, z);
  await catAnimate(480, (k) => setCatPos(x0 + (x - x0) * k, y0 + (y - y0) * k, z0 + (z - z0) * k, Math.sin(Math.PI * k) * 0.9));
}

/** Camina hasta un punto por la ruta libre. Devuelve true si llegó. */
function catWalk(to, gen) {
  if (reduceMotion()) {
    setCatPos(to[0], to[1], 0);
    return Promise.resolve(true);
  }
  const path = findPath([cat.x, cat.y], to);
  if (!path || path.length < 2) return Promise.resolve(false);
  cat.path = path.slice(1);
  setCatPose('walk');
  return new Promise((resolve) => {
    cat.arrive = (ok) => {
      cat.arrive = null;
      resolve(ok && gen === cat.gen);
    };
    let last = 0;
    const tickCat = (ts) => {
      if (gen !== cat.gen) return cat.arrive?.(false);
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
      last = ts;
      let budget = CAT_SPEED * dt;
      while (budget > 0 && cat.path.length) {
        const [tx, ty] = cat.path[0];
        const dx = tx - cat.x;
        const dy = ty - cat.y;
        const d = Math.hypot(dx, dy);
        catFace(dx, dy);
        if (d <= budget) {
          setCatPos(tx, ty, 0);
          cat.path.shift();
          budget -= d;
        } else {
          setCatPos(cat.x + (dx / d) * budget, cat.y + (dy / d) * budget, 0);
          budget = 0;
        }
      }
      if (cat.path.length) requestAnimationFrame(tickCat);
      else cat.arrive?.(true);
    };
    requestAnimationFrame(tickCat);
  });
}

/** Si está encima de un mueble, baja al piso. */
async function catDismount(gen) {
  if (!cat.perch) return;
  const p = CAT_PERCH[cat.perch];
  cat.perch = null;
  await catHop(p.floor[0], p.floor[1], 0);
  if (gen !== cat.gen) return;
  setCatPose('sit');
}

async function catSleepAt(name, gen) {
  const p = CAT_PERCH[name];
  if (cat.perch === name) {
    setCatPose('sleep');
  } else {
    await catDismount(gen);
    if (gen !== cat.gen || !(await catWalk(p.floor, gen))) return;
    setCatPose('sit');
    await catNap(rand(500, 1400));
    if (gen !== cat.gen) return;
    await catHop(p.on[0], p.on[1], p.on[2]);
    if (gen !== cat.gen) return;
    cat.perch = name;
    cat.flipLeft = p.left;
    cat.sprite.setFlip(p.left);
    setCatPose('sit');
    await catNap(rand(1200, 2600));
    if (gen !== cat.gen) return;
    setCatPose('sleep');
  }
  await catNap(rand(25000, 60000));
}

async function catRoam(gen) {
  await catDismount(gen);
  const spots = CAT_WANDER.filter(([x, y]) => isFree(x, y));
  const to = pick(spots);
  if (gen !== cat.gen || !to || !(await catWalk(to, gen))) return;
  setCatPose('sit');
  const mood = Math.random();
  if (mood < 0.3) {
    // se echa a descansar un rato donde llegó
    setCatPose('sleep');
    await catNap(rand(12000, 26000));
  } else {
    for (let i = 0; i < Math.floor(rand(2, 5)); i++) {
      if (gen !== cat.gen) return;
      await catNap(rand(2500, 6000));
      if (Math.random() < 0.5) {
        cat.flipLeft = !cat.flipLeft;
        cat.sprite.setFlip(cat.flipLeft);
      }
      if (Math.random() < 0.25) catSay(pick(['mrrr', 'miau', '🐾']), 1800);
    }
  }
}

async function catLife(gen) {
  await catNap(rand(8000, 18000));
  while (gen === cat.gen) {
    if (document.hidden || !svgRoot?.isConnected) {
      await catNap(4000);
      continue;
    }
    const r = Math.random();
    if (r < 0.3) await catSleepAt('bed', gen);
    else if (r < 0.55) await catSleepAt('desk', gen);
    else await catRoam(gen);
    if (gen === cat.gen) await catNap(rand(1500, 4500));
  }
}

function catStart() {
  const gen = ++cat.gen;
  catLife(gen).catch(() => {});
}

/** Kike lo llamó: deja lo que hacía, se sienta y lo espera. */
function catAttend() {
  cat.gen++;
  cat.listening = true;
  cat.cancel?.();
  cat.path = [];
  cat.arrive?.(false);
  if (cat.pose !== 'sit') setCatPose('sit');
  catFace(boss.x - cat.x, boss.y - cat.y);
  catSay('¡Miau!', 2000);
}

/** Terminó la conversación: vuelve a su vida de gato. */
export function catRelease() {
  if (!cat.listening) return;
  cat.listening = false;
  const gen = ++cat.gen;
  setTimeout(() => {
    if (gen === cat.gen && !cat.listening) catStart();
  }, 3500);
}

/** Dónde se para Kike para hablar con el gato. */
function catApproach() {
  const base = cat.perch ? CAT_PERCH[cat.perch].floor : [cat.x, cat.y];
  const offsets = cat.perch ? [[0, 0]] : [[1.1, 0], [0, 1.1], [-1.1, 0], [0, -1.1], [0.8, 0.8], [-0.8, 0.8]];
  const options = offsets.map(([dx, dy]) => [base[0] + dx, base[1] + dy]).filter(([x, y]) => isFree(x, y));
  if (!options.length) return base;
  options.sort((a, b) => Math.hypot(a[0] - boss.x, a[1] - boss.y) - Math.hypot(b[0] - boss.x, b[1] - boss.y));
  return options[0];
}

on('cat-status', ({ status }) => {
  if (status === 'thinking') catSay('💭', 60000);
  else cat.el?.querySelector('.cat-bubble')?.setAttribute('opacity', 0);
});

export function mountOffice(container) {
  renderOffice(container);
  bindKeys();
  const prevStatus = {};
  on('status', ({ id, status }) => {
    const el = charEls[id];
    if (!el) return;
    updateBubble(el, id);
    // gesto corto al terminar de trabajar (solo visual; no cambia ningún estado)
    const was = prevStatus[id];
    prevStatus[id] = status;
    if ((was === 'thinking' || was === 'searching') && (status === 'idle' || status === 'meeting')) {
      el.classList.add('done');
      setTimeout(() => el.classList.remove('done'), 1700);
    }
  });
  on('agents-changed', () => renderOffice());
  catStart();
}

/** Solo para pruebas automáticas: fuerza comportamientos del gato y lee su estado. */
export const catTest = {
  roam: () => catRoam(++cat.gen),
  sleep: (name) => catSleepAt(name, ++cat.gen),
  state: () => ({ x: cat.x, y: cat.y, z: cat.z, pose: cat.pose, perch: cat.perch, listening: cat.listening }),
};
