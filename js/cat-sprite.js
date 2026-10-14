// Dibujo del gato amarillo (SVG). Mira a la derecha; para mirar a la izquierda se voltea desde fuera.
// Poses: walk (caminando), sit (sentado), sleep (enroscado durmiendo). Se cambia con data-pose.

import { s } from './ui.js';

const MAIN = '#ffc93c';
const DARK = '#e39b12';
const LIGHT = '#fff0b8';
const PINK = '#ff9fb5';
const INK = '#1a1e1c';

const anim = (attr, type, values, dur, extra = {}) =>
  s('animateTransform', { attributeName: attr, type, values, dur, repeatCount: 'indefinite', ...extra });

function leg(x, y, phase, front) {
  const g = s(
    'g',
    null,
    s('rect', { x: x - 1.6, y, width: 3.2, height: 8.4, rx: 1.6, fill: front ? MAIN : DARK }),
    s('ellipse', { cx: x, cy: y + 8.2, rx: 2.5, ry: 1.5, fill: LIGHT })
  );
  g.append(anim('transform', 'rotate', `-28 ${x} ${y}; 28 ${x} ${y}; -28 ${x} ${y}`, '0.56s', { begin: phase }));
  return g;
}

function ears(cx, cy, k = 1) {
  const p = (pts, fill) => s('polygon', { points: pts.map(([x, y]) => `${cx + x * k},${cy + y * k}`).join(' '), fill });
  return [
    p([[-4.6, -3.4], [-4.0, -10.2], [0.2, -5.4]], MAIN),
    p([[-3.7, -4.6], [-3.5, -8.0], [-1.2, -5.6]], PINK),
    p([[0.2, -5.4], [4.0, -10.4], [5.2, -3.2]], MAIN),
    p([[1.4, -5.6], [3.5, -8.2], [4.1, -4.6]], PINK),
  ];
}

function stripes(pts) {
  return s('g', { stroke: DARK, 'stroke-width': 1.5, 'stroke-linecap': 'round', fill: 'none' }, ...pts.map((d) => s('path', { d })));
}

function walkPose() {
  const tail = s('path', { d: 'M-10 -12 C-18 -13 -19 -23 -13 -26', stroke: MAIN, 'stroke-width': 3.4, fill: 'none', 'stroke-linecap': 'round' });
  tail.append(anim('transform', 'rotate', '-10 -10 -12; 12 -10 -12; -10 -10 -12', '1.3s'));
  return s(
    'g',
    { class: 'pose pose-walk' },
    s('g', { class: 'tail-wrap' }, tail),
    leg(-6.5, -9, '-0.28s', false),
    leg(4.5, -9, '0s', false),
    s('ellipse', { cx: -1, cy: -12, rx: 11, ry: 5.6, fill: MAIN }),
    stripes(['M-7 -16.4 l1.4 3.6', 'M-3 -17 l1.2 3.8', 'M1 -16.8 l1 3.6']),
    s('ellipse', { cx: 1, cy: -9.2, rx: 7, ry: 2.4, fill: LIGHT, opacity: 0.8 }),
    leg(-3.5, -9, '-0.56s', true),
    leg(7.5, -9, '-0.28s', true),
    s('circle', { cx: 11.5, cy: -16, r: 6, fill: MAIN }),
    ...ears(11.5, -16),
    stripes(['M9.4 -20.2 l0.4 2.2', 'M12 -20.6 l0 2.2', 'M14.4 -20.2 l-0.4 2.2']),
    s('ellipse', { cx: 9.6, cy: -16.4, rx: 0.95, ry: 1.5, fill: INK }),
    s('ellipse', { cx: 14.2, cy: -16.4, rx: 0.95, ry: 1.5, fill: INK }),
    s('polygon', { points: '11.1,-14.2 13.1,-14.2 12.1,-12.9', fill: PINK }),
    s('path', { d: 'M12.1 -12.9 q-1.2 1.6 -2.4 0.6 M12.1 -12.9 q1.2 1.6 2.4 0.6', stroke: INK, 'stroke-width': 0.6, fill: 'none' }),
    s('path', { d: 'M15.5 -14 l5.5 -1.2 M15.5 -13.2 l5.5 0.8 M8 -14 l-5.2 -1.2 M8 -13.2 l-5.2 0.8', stroke: '#fff7da', 'stroke-width': 0.6, opacity: 0.9 })
  );
}

function sitPose() {
  const tail = s('path', { d: 'M-6 -2 C-15 -1 -15 -11 -9.5 -13', stroke: MAIN, 'stroke-width': 3.4, fill: 'none', 'stroke-linecap': 'round' });
  tail.append(anim('transform', 'rotate', '-6 -6 -2; 9 -6 -2; -6 -6 -2', '2.2s'));
  const earGroup = s('g', { class: 'ear-twitch' }, ...ears(2.6, -22));
  return s(
    'g',
    { class: 'pose pose-sit' },
    tail,
    s('ellipse', { cx: -0.5, cy: -9, rx: 7, ry: 9.4, fill: MAIN }),
    stripes(['M-5.6 -13 l1.8 1.2', 'M-5.8 -8.6 l2 0.6', 'M-5 -4.6 l1.8 -0.2']),
    s('ellipse', { cx: -2, cy: -4.2, rx: 7, ry: 4.6, fill: MAIN }),
    s('ellipse', { cx: 3, cy: -8, rx: 3, ry: 7, fill: LIGHT, opacity: 0.85 }),
    s('rect', { x: 2.2, y: -9, width: 3.2, height: 9, rx: 1.6, fill: MAIN }),
    s('ellipse', { cx: 3.8, cy: -0.6, rx: 3, ry: 1.5, fill: LIGHT }),
    s('circle', { cx: 2.6, cy: -22, r: 6.4, fill: MAIN }),
    earGroup,
    stripes(['M0.4 -26.6 l0.4 2.2', 'M2.8 -27 l0 2.2', 'M5.2 -26.6 l-0.4 2.2']),
    s(
      'g',
      { class: 'eyes' },
      s('ellipse', { cx: 0.2, cy: -22.4, rx: 1, ry: 1.6, fill: INK }),
      s('ellipse', { cx: 5.4, cy: -22.4, rx: 1, ry: 1.6, fill: INK })
    ),
    s('polygon', { points: '1.7,-20.2 3.7,-20.2 2.7,-18.9', fill: PINK }),
    s('path', { d: 'M2.7 -18.9 q-1.2 1.6 -2.4 0.6 M2.7 -18.9 q1.2 1.6 2.4 0.6', stroke: INK, 'stroke-width': 0.6, fill: 'none' }),
    s('path', { d: 'M6.6 -20 l5 -1 M6.6 -19.2 l5 0.8 M-1.2 -20 l-5 -1 M-1.2 -19.2 l-5 0.8', stroke: '#fff7da', 'stroke-width': 0.6, opacity: 0.9 })
  );
}

function sleepPose() {
  const body = s('ellipse', { cx: 0, cy: -5.5, rx: 11.5, ry: 6, fill: MAIN });
  body.append(s('animate', { attributeName: 'ry', values: '6;6.7;6', dur: '3.2s', repeatCount: 'indefinite' }));
  const z = (cls, x, y, size) => s('text', { class: `zzz ${cls}`, x, y, 'font-size': size, 'font-weight': 900, fill: '#324966' }, 'z');
  return s(
    'g',
    { class: 'pose pose-sleep' },
    body,
    stripes(['M-8 -10 l1.6 3', 'M-3.6 -11 l1.4 3.4', 'M1 -10.6 l1.2 3.2']),
    s('path', { d: 'M-11 -3.6 C-13 3 7 4 11 -1.4', stroke: MAIN, 'stroke-width': 3.4, fill: 'none', 'stroke-linecap': 'round' }),
    s('path', { d: 'M-4 1.2 C0 2.6 5 2.2 8.4 0.4', stroke: DARK, 'stroke-width': 1.1, fill: 'none', 'stroke-linecap': 'round', opacity: 0.7 }),
    s('circle', { cx: 8.4, cy: -5.2, r: 5.2, fill: MAIN }),
    ...ears(8.4, -5.2, 0.9),
    s('path', { d: 'M6.3 -5.6 q1.2 1.3 2.4 0 M9.8 -5.6 q1.2 1.3 2.4 0', stroke: INK, 'stroke-width': 0.9, fill: 'none', 'stroke-linecap': 'round' }),
    s('polygon', { points: '8.2,-3.4 10.2,-3.4 9.2,-2.2', fill: PINK }),
    z('z1', 14, -16, 7),
    z('z2', 18, -22, 9),
    z('z3', 23, -29, 11)
  );
}

/** Gato completo. Devuelve { el, setPose, setFlip }. */
export function buildCatSprite() {
  const flip = s('g', { class: 'cat-flip' });
  flip.append(walkPose(), sitPose(), sleepPose());
  const root = s('g', { class: 'cat', 'data-pose': 'sit', transform: 'scale(1.35)' }, s('ellipse', { class: 'shadow', cx: 0, cy: 0.4, rx: 13, ry: 4.4, fill: 'rgba(60,35,10,.22)' }), flip);
  return {
    el: root,
    setPose: (p) => root.setAttribute('data-pose', p),
    setFlip: (left) => flip.setAttribute('transform', left ? 'scale(-1 1)' : ''),
  };
}

/** Cabecita del gato para avatares de la interfaz. */
export function catHeadSvg(cls = 'avatar') {
  return s(
    'svg',
    { class: cls, viewBox: '-12 -34 24 24', 'aria-hidden': 'true' },
    s('circle', { cx: 0, cy: -22, r: 8.6, fill: MAIN }),
    ...ears(0, -22, 1.25),
    s('path', { d: 'M-3.6 -29.4 l0.5 2.6 M0 -30 l0 2.6 M3.6 -29.4 l-0.5 2.6', stroke: DARK, 'stroke-width': 1.5, 'stroke-linecap': 'round', fill: 'none' }),
    s('ellipse', { cx: -3.4, cy: -22.4, rx: 1.2, ry: 1.9, fill: INK }),
    s('ellipse', { cx: 3.4, cy: -22.4, rx: 1.2, ry: 1.9, fill: INK }),
    s('polygon', { points: '-1.5,-19.6 1.5,-19.6 0,-17.8', fill: PINK }),
    s('path', { d: 'M0 -17.8 q-1.6 2.2 -3.2 0.8 M0 -17.8 q1.6 2.2 3.2 0.8', stroke: INK, 'stroke-width': 0.8, fill: 'none' }),
    s('path', { d: 'M5 -19.6 l7 -1.4 M5 -18.4 l7 1.2 M-5 -19.6 l-7 -1.4 M-5 -18.4 l-7 1.2', stroke: '#fff7da', 'stroke-width': 0.7, opacity: 0.9 })
  );
}
