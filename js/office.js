// Oficina isométrica animada (SVG): 3 oficinas + sala de juntas, con personajes que caminan.

import { s } from './ui.js';
import * as store from './store.js';
import { AGENT_IDS } from './store.js';
import { runtime, on, STATUS_LABEL, go } from './state.js';
import { ROLES } from './prompts.js';

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

function box(x, y, z, w, d, h, color, extra = {}) {
  const [top, left, right] = Array.isArray(color) ? color : [shade(color, 0.12), color, shade(color, -0.14)];
  return s(
    'g',
    extra,
    s('polygon', { points: P([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]), fill: left, ...EDGE }),
    s('polygon', { points: P([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]), fill: right, ...EDGE }),
    s('polygon', { points: P([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]), fill: top, ...EDGE })
  );
}

const quadY = (x1, x2, z1, z2, y = 0) => P([[x1, y, z1], [x2, y, z1], [x2, y, z2], [x1, y, z2]]);
const quadX = (y1, y2, z1, z2, x = 0) => P([[x, y1, z1], [x, y2, z1], [x, y2, z2], [x, y1, z2]]);

// ---------- Escena ----------
const WOOD = ['#f0cd98', '#d9ac6c', '#c39457'];
const DARK_WOOD = ['#c48d5c', '#a87545', '#8f6239'];
const CHAIR = ['#8a98b4', '#717f9c', '#5f6c88'];

const ROOM_TINT = { copy: '#ffe3d8', analista: '#d5f0ee', guion: '#e8e1fb', juntas: '#f1dab2' };
const ROOM_AREA = {
  copy: [0, 0],
  analista: [12, 0],
  guion: [0, 12],
  juntas: [12, 12],
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
  // Pisos de cada sala (clicables)
  for (const [room, [ox, oy]] of Object.entries(ROOM_AREA)) {
    const label = room === 'juntas' ? 'Sala de juntas' : `${ROLES[room].room}`;
    const poly = s('polygon', {
      class: 'room-floor',
      'data-room': room,
      points: P([[ox + 0.25, oy + 0.25, 0], [ox + 11.75, oy + 0.25, 0], [ox + 11.75, oy + 11.75, 0], [ox + 0.25, oy + 11.75, 0]]),
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
  g.append(lines);
  // Alfombras
  g.append(
    s('polygon', { points: P([[3.4, 3.0, 0.01], [9.4, 3.0, 0.01], [9.4, 8.6, 0.01], [3.4, 8.6, 0.01]]), fill: '#ffc9b8', opacity: 0.8, 'pointer-events': 'none' }),
    s('polygon', { points: P([[15.3, 3.0, 0.01], [21.3, 3.0, 0.01], [21.3, 8.6, 0.01], [15.3, 8.6, 0.01]]), fill: '#b2e4e0', opacity: 0.8, 'pointer-events': 'none' }),
    s('polygon', { points: P([[3.4, 15.0, 0.01], [9.4, 15.0, 0.01], [9.4, 20.6, 0.01], [3.4, 20.6, 0.01]]), fill: '#d6cbfa', opacity: 0.8, 'pointer-events': 'none' })
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
  walls.append(s('polygon', { points: quadX(2, 9.5, 3.0, 5.2, 0.02), fill: '#0e9aa7', ...EDGE }));
  walls.append(wallText('x', 5.75, 4.3, 'VACILANDO ANDO', 12.5, { fill: '#ffffff', 'letter-spacing': 0.5 }));
  walls.append(wallText('x', 5.75, 3.45, 'T O U R S  ✈', 7.5, { fill: '#ffe08a' }));
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

/** Elementos de cada sala con su profundidad (para dibujar de atrás hacia adelante). */
function roomItems(room) {
  const items = [];
  const add = (depth, node) => items.push({ depth, node });
  if (room === 'copy') {
    add(1.0, box(0.1, 9.9, 0, 0.9, 1.8, 2.8, WOOD));
    ['#ff6b5b', '#0e9aa7', '#ffb627', '#7a5af8'].forEach((c, i) =>
      add(1.1, s('polygon', { points: quadX(10.05 + i * 0.4, 10.35 + i * 0.4, 1.6, 2.5, 1.01), fill: c }))
    );
    add(12.1, plant(10.8, 1.3));
    add(9.3, box(5.7, 3.6, 0, 1.2, 0.3, 2.3, CHAIR));
    add(12.3, box(4.6, 5.6, 0, 3.4, 1.5, 1.25, WOOD));
    add(12.4, box(5.0, 5.9, 1.25, 1.3, 0.8, 0.08, '#9aa3b2'));
    add(12.5, s('polygon', { points: P([[5.0, 5.95, 1.33], [6.3, 5.95, 1.33], [6.3, 5.8, 2.25], [5.0, 5.8, 2.25]]), fill: '#3b4252', ...EDGE }));
    add(12.6, s('circle', { cx: iso(5.65, 5.9, 1.8)[0], cy: iso(5.65, 5.9, 1.8)[1], r: 2.2, fill: '#ff6b5b' }));
    add(12.7, box(7.3, 6.3, 1.25, 0.35, 0.35, 0.4, ['#ffffff', '#ececec', '#d9d9d9']));
  }
  if (room === 'analista') {
    add(14.5, plant(13.2, 1.3));
    add(21.3, box(17.6, 3.6, 0, 1.2, 0.3, 2.3, CHAIR));
    add(24.3, box(16.4, 5.6, 0, 3.6, 1.5, 1.25, WOOD));
    add(24.4, box(16.95, 6.2, 1.25, 0.25, 0.25, 0.35, '#3b4252'));
    add(24.5, s('polygon', { points: P([[16.5, 6.25, 1.6], [17.8, 6.25, 1.6], [17.8, 6.1, 2.6], [16.5, 6.1, 2.6]]), fill: '#2d3440', ...EDGE }));
    add(24.6, box(19.3, 6.2, 1.25, 0.5, 0.5, 0.12, '#22b8c4'));
    add(31.0, box(22.4, 8.6, 0, 1.2, 1.6, 2.2, ['#d7dde4', '#b9c3cf', '#a3aebb']));
  }
  if (room === 'guion') {
    add(14.0, plant(1.4, 22.6));
    add(21.3, box(5.7, 15.6, 0, 1.2, 0.3, 2.3, CHAIR));
    add(24.3, box(4.6, 17.6, 0, 3.4, 1.5, 1.25, WOOD));
    add(24.4, box(5.0, 18.0, 1.25, 1.0, 0.7, 0.12, '#1d2433'));
    add(24.5, box(5.0, 18.0, 1.37, 1.0, 0.18, 0.12, ['#ffffff', '#1d2433', '#1d2433']));
    add(24.6, box(6.8, 18.1, 1.25, 0.9, 0.6, 0.05, ['#fffdf5', '#eee5d2', '#e0d6c0']));
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
      )
    );
  }
  if (room === 'juntas') {
    [15.9, 18.0, 20.1].forEach((cx, i) => add(30.5 + i * 0.01, box(cx - 0.6, 15.25, 0, 1.2, 0.3, 2.3, CHAIR)));
    add(40, box(14.6, 17.2, 0, 6.8, 2.6, 1.25, DARK_WOOD));
    add(40.1, box(16.0, 17.9, 1.25, 0.8, 0.6, 0.04, ['#fffdf5', '#eee5d2', '#e0d6c0']));
    add(40.2, box(19.2, 18.2, 1.25, 0.3, 0.3, 0.35, ['#ffffff', '#ececec', '#d9d9d9']));
    add(41, box(17.4, 20.3, 0, 1.2, 1.1, 0.75, CHAIR));
    add(41.1, box(17.4, 21.3, 0, 1.2, 0.25, 2.0, CHAIR));
    add(43, box(22.3, 19.4, 0, 1.3, 2.4, 1.2, WOOD));
    add(43.1, box(22.6, 19.8, 1.2, 0.7, 0.7, 0.9, '#3b4252'));
    add(43.2, box(22.7, 20.9, 1.2, 0.35, 0.35, 0.35, ['#ffffff', '#ececec', '#d9d9d9']));
    add(25.6, plant(23.0, 13.2));
    add(35.9, plant(13.2, 23.0));
  }
  return items;
}

function partitions(segments) {
  const g = s('g', { class: 'partitions', 'pointer-events': 'none' });
  for (const [axis, a, b] of segments) {
    const node = axis === 'x' ? box(11.85, a, 0, 0.3, b - a, 1.1, ['#d8c29c', '#f6ecd9', '#e6d4b2']) : box(a, 11.85, 0, b - a, 0.3, 1.1, ['#d8c29c', '#f6ecd9', '#e6d4b2']);
    g.append(node);
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

export function spriteParts(look, { withLegs = true } = {}) {
  const shirt = look.shirt || '#0e9aa7';
  const skin = look.skin || '#c68642';
  const dark = shade(shirt, -0.2);
  const parts = [];
  if (withLegs) {
    parts.push(
      s(
        'g',
        { class: 'legs' },
        s('g', { class: 'leg leg-l' }, s('rect', { x: -5.6, y: -11, width: 4.6, height: 11, rx: 2, fill: PANTS }), s('ellipse', { cx: -3.3, cy: -0.6, rx: 3, ry: 1.6, fill: '#1d2433' })),
        s('g', { class: 'leg leg-r' }, s('rect', { x: 1, y: -11, width: 4.6, height: 11, rx: 2, fill: PANTS }), s('ellipse', { cx: 3.3, cy: -0.6, rx: 3, ry: 1.6, fill: '#1d2433' }))
      )
    );
  }
  parts.push(
    s(
      'g',
      { class: 'body-bob' },
      hairBack(look),
      s('g', { class: 'arm arm-l' }, s('rect', { x: -12, y: -25, width: 4.6, height: 12, rx: 2.3, fill: dark }), s('circle', { cx: -9.7, cy: -12.6, r: 2.3, fill: skin })),
      s('g', { class: 'arm arm-r' }, s('rect', { x: 7.4, y: -25, width: 4.6, height: 12, rx: 2.3, fill: dark }), s('circle', { cx: 9.7, cy: -12.6, r: 2.3, fill: skin })),
      s('rect', { x: -8.6, y: -26.5, width: 17.2, height: 17, rx: 6, fill: shirt }),
      s('path', { d: 'M-3.2 -26.4 L0 -22.6 L3.2 -26.4 Z', fill: shade(shirt, 0.35) }),
      s('rect', { x: -2.4, y: -29.5, width: 4.8, height: 4, fill: shade(skin, -0.1) }),
      s('circle', { cx: -9.2, cy: -35, r: 2.3, fill: skin }),
      s('circle', { cx: 9.2, cy: -35, r: 2.3, fill: skin }),
      s('circle', { cx: 0, cy: -36, r: 9.5, fill: skin }),
      hair(look),
      s(
        'g',
        { class: 'eyes' },
        s('ellipse', { cx: -3.3, cy: -35.2, rx: 1.25, ry: 1.6, fill: '#1d2433' }),
        s('ellipse', { cx: 3.3, cy: -35.2, rx: 1.25, ry: 1.6, fill: '#1d2433' })
      ),
      s('circle', { cx: -5.6, cy: -32.2, r: 1.8, fill: '#ff8a80', opacity: 0.45 }),
      s('circle', { cx: 5.6, cy: -32.2, r: 1.8, fill: '#ff8a80', opacity: 0.45 }),
      s('path', { class: 'mouth', d: 'M-2.6 -31 Q0 -28.8 2.6 -31', stroke: '#6b3a2a', 'stroke-width': 1.3, fill: 'none', 'stroke-linecap': 'round' })
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

export function renderOffice(container) {
  const host = container || svgRoot?.parentElement;
  if (!host) return;
  const svg = s('svg', {
    class: 'office-svg',
    viewBox: '-395 -128 790 552',
    role: 'img',
    'aria-label': 'Oficina isométrica de Vacilando Ando con tres agentes y una sala de juntas',
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

  layers = {};
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
    items.sort((a, b) => a.depth - b.depth).forEach((it) => g.append(it.node));
    return g;
  };

  root.append(roomLayer('copy'));
  root.append(
    partitions([
      ['x', 0.2, 8],
      ['x', 10.5, 11.85],
      ['y', 0.2, 8],
      ['y', 10.5, 11.85],
    ])
  );
  root.append(roomLayer('analista'), roomLayer('guion'));
  root.append(
    partitions([
      ['x', 12.15, 13.5],
      ['x', 16, 23.8],
      ['y', 12.15, 13.5],
      ['y', 16, 23.8],
    ])
  );
  root.append(roomLayer('juntas'));
  layers.overlay = s('g', { class: 'overlay' });
  root.append(layers.overlay);

  // Etiquetas de las salas
  const labels = s('g', { class: 'room-labels' });
  const agents = store.agents();
  const spots = { copy: iso(0, 0, 8.4), analista: iso(17.5, 0, 7.6), guion: iso(0, 17.5, 7.6), juntas: iso(24, 24, -2.6) };
  for (const room of ['copy', 'analista', 'guion', 'juntas']) {
    const text = room === 'juntas' ? '🤝 Sala de juntas' : `${ROLES[room].icon} ${agents[room].name}`;
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

  // Interacción
  svg.addEventListener('click', (e) => {
    const target = e.target.closest('[data-agent], [data-room]');
    if (!target) return;
    navigateTo(target.dataset.agent || target.dataset.room);
  });
  svg.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = e.target.closest('[data-agent], [data-room]');
    if (!target) return;
    e.preventDefault();
    navigateTo(target.dataset.agent || target.dataset.room);
  });

  host.replaceChildren(svg);
  svgRoot = svg;
  setActiveRoom(activeRoom);
}

function navigateTo(key) {
  if (key === 'juntas') go('#/juntas');
  else if (AGENT_IDS.includes(key)) go(`#/agente/${key}`);
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

export function mountOffice(container) {
  renderOffice(container);
  on('status', ({ id }) => charEls[id] && updateBubble(charEls[id], id));
  on('agents-changed', () => renderOffice());
}
