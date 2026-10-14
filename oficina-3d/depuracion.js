// Herramientas de depuración (solo con ?depurar=1): rectángulos de las salas con sus coordenadas, huellas de los
// muebles, obstáculos, puertas, asientos, puestos de reunión, lugares del jefe, rutas y una figura gris de
// referencia del tamaño de una minifigura (no es un personaje: no tiene cara ni animaciones).
import * as THREE from 'three';
import { etiqueta } from './texturas.js';
import { ROOM_AREA, SALAS, OBSTACLES, MUEBLES_OBSTACULOS, PUERTAS, SEATS, MEET, ROUTES, BOSS_SPOTS, CAT_PERCH, ALTURAS, ESCALA, aMundo, rectMundo } from './plano.js';

const ALTURA = 0.18; // un poco sobre el piso para que se vea encima de los azulejos

function rectangulo(puntos, r, y = ALTURA) {
  const a = [r.x, y, r.z];
  const b = [r.x + r.w, y, r.z];
  const c = [r.x + r.w, y, r.z + r.d];
  const d = [r.x, y, r.z + r.d];
  puntos.push(...a, ...b, ...b, ...c, ...c, ...d, ...d, ...a);
}

function lineas(puntos, color) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(puntos, 3));
  const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 }));
  m.renderOrder = 10;
  return m;
}

/** Etiqueta flotante; `alto` es la altura del cartel en el mundo (el ancho sale del largo del texto). */
function cartel(texto, x, y, z, escala = 4, fondo) {
  const mapa = etiqueta(texto, fondo);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mapa, depthTest: false, transparent: true }));
  const alto = escala * (96 / 512) * 1.4;
  s.scale.set(alto * mapa.userData.aspecto, alto, 1);
  s.position.set(x, y, z);
  s.renderOrder = 11;
  return s;
}

function marcador(color, radio = 0.5) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, 0.12, 16), new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.85 }));
  m.renderOrder = 10;
  return m;
}

/** Figura gris de referencia: 5.0 de alto (40 mm), hombros de 2.0. Sin cara, sin animación. */
export function figuraReferencia() {
  const g = new THREE.Group();
  g.name = 'figura-referencia';
  const gris = new THREE.MeshStandardMaterial({ color: '#9aa0a8', roughness: 0.7 });
  const caja = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), gris);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    g.add(m);
  };
  caja(0.9, 1.6, 0.9, -0.48, 0, 0); // piernas
  caja(0.9, 1.6, 0.9, 0.48, 0, 0);
  caja(2.0, 0.35, 1.0, 0, 1.6, 0); // cadera
  caja(2.0, 1.55, 1.0, 0, 1.95, 0); // torso
  caja(0.55, 1.4, 0.55, -1.25, 2.0, 0); // brazos
  caja(0.55, 1.4, 0.55, 1.25, 2.0, 0);
  const cabeza = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.2, 16), gris);
  cabeza.position.y = 3.5 + 0.6;
  cabeza.castShadow = true;
  g.add(cabeza);
  const taquito = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 12), gris);
  taquito.position.y = 4.85;
  g.add(taquito);
  g.userData.alto = ALTURAS.minifigura;
  return g;
}

export function construirDepuracion() {
  const g = new THREE.Group();
  g.name = 'depuracion';

  // Salas con su nombre y coordenadas del plano
  const salas = [];
  for (const [id, [x, y, w, d]] of Object.entries(ROOM_AREA)) {
    const r = { x: x * ESCALA, z: y * ESCALA, w: w * ESCALA, d: d * ESCALA };
    rectangulo(salas, r, 0.25);
    g.add(cartel(`${SALAS[id].nombre} · (${x}, ${y}) ${w}×${d}`, r.x + r.w / 2, 12, r.z + r.d / 2, 9));
  }
  g.add(lineas(salas, '#0078ab'));

  // Huellas de muebles (naranja) y tabiques como obstáculos (rojo)
  const muebles = [];
  MUEBLES_OBSTACULOS.forEach((h) => rectangulo(muebles, rectMundo(h)));
  g.add(lineas(muebles, '#ff8a3d'));
  const tabiques = [];
  OBSTACLES.slice(MUEBLES_OBSTACULOS.length).forEach((h) => rectangulo(tabiques, rectMundo(h)));
  g.add(lineas(tabiques, '#d4382c'));

  // Puertas (verde)
  const puertas = [];
  for (const p of PUERTAS) {
    const r = p.eje === 'x' ? { x: p.en * ESCALA - 0.6, z: p.desde * ESCALA, w: 1.2, d: (p.hasta - p.desde) * ESCALA } : { x: p.desde * ESCALA, z: p.en * ESCALA - 0.6, w: (p.hasta - p.desde) * ESCALA, d: 1.2 };
    rectangulo(puertas, r, 0.3);
    g.add(cartel(`puerta ${p.id}`, r.x + r.w / 2, 3.4, r.z + r.d / 2, 5, 'rgba(0,125,0,.85)'));
  }
  g.add(lineas(puertas, '#00a100'));

  // Asientos (puntos del color de cada agente), puestos de reunión y lugares del jefe
  const colores = { copy: '#ff8a3d', analista: '#008ec7', guion: '#7a5af8' };
  for (const [id, p] of Object.entries(SEATS)) {
    const m = marcador(colores[id]);
    const w = aMundo(p);
    m.position.set(w.x, 2.0, w.z);
    g.add(m, cartel(`asiento ${id}`, w.x, 6.6, w.z, 4));
  }
  for (const [id, p] of Object.entries(MEET)) {
    const m = marcador(colores[id], 0.4);
    const w = aMundo(p);
    m.position.set(w.x, 2.0, w.z);
    g.add(m);
  }
  for (const [id, s] of Object.entries(BOSS_SPOTS)) {
    const m = marcador('#e7b84a', 0.45);
    const w = aMundo(s.at);
    m.position.set(w.x, ALTURA, w.z);
    g.add(m, cartel(`jefe: ${id}`, w.x, 1.6, w.z, 3.4, 'rgba(160,110,0,.85)'));
  }
  for (const [id, c] of Object.entries(CAT_PERCH)) {
    const m = marcador('#fde07e', 0.35);
    const w = aMundo(c.floor);
    m.position.set(w.x, ALTURA, w.z);
    g.add(m, cartel(`gato: ${id}`, w.x, 1.4, w.z, 3, 'rgba(160,110,0,.85)'));
  }

  // Rutas de cada agente a la sala de juntas
  for (const [id, ruta] of Object.entries(ROUTES)) {
    const pts = [SEATS[id], ...ruta, MEET[id]].map(aMundo);
    const lista = [];
    for (let i = 1; i < pts.length; i++) lista.push(pts[i - 1].x, 0.5, pts[i - 1].z, pts[i].x, 0.5, pts[i].z);
    g.add(lineas(lista, colores[id]));
  }

  // Figura gris de referencia de pie frente al escritorio de Nico (lugar del jefe en Copy)
  const fig = figuraReferencia();
  const p = aMundo(BOSS_SPOTS.copy.at);
  fig.position.set(p.x, 0, p.z);
  g.add(fig, cartel(`minifigura de referencia: ${ALTURAS.minifigura} de alto (40 mm) · 2.0 de hombros`, p.x, 7, p.z, 10));
  return g;
}
