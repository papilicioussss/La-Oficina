// Muebles y objetos provisionales hechos con piezas LEGO por código. Cada uno se registra por nombre en registro.js.
// Origen de cada modelo: centro de su huella, apoyado en el piso. Frente = +z. Medidas en taquitos (plano × 2).
import * as THREE from 'three';
import { Constructor, geoCaja, ALTO_LADRILLO as L, ALTO_PLACA as P } from '../ladrillos.js';
import { plastico, mate, estampado } from '../materiales.js';
import { registrarModelo } from '../registro.js';
import { placaTexto, pantalla, logo } from '../texturas.js';
import { COLORES } from '../plano.js';

// Alturas de las superficies donde se apoyan otros objetos (las usa salas.js con `sobre`)
export const SUPERFICIE = { escritorio: 2 * L + P, mesaJuntas: 2 * L + P, credenza: 2 * L + P };

const OSCURO = COLORES.oscuro;
const BLANCO = COLORES.blanco;

/** Caja con su base en y, centrada en (cx, cz). */
function bloque(g, cx, y, cz, w, alto, d, material, seg = 2) {
  const m = new THREE.Mesh(geoCaja(w, alto, d, seg), material);
  m.position.set(cx, y + alto / 2, cz);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.fija = true;
  g.add(m);
  return m;
}

/** Pieza con textura (no se fusiona). */
function lamina(g, w, h, textura, clave, { brillo = false } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), estampado(clave, textura, { brillo }));
  m.receiveShadow = true;
  g.add(m);
  return m;
}

function cilindro(g, r, alto, material, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, alto, seg), material);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.fija = true;
  g.add(m);
  return m;
}

function nuevo(medida, anclas = {}) {
  const g = new THREE.Group();
  g.userData.medida = medida;
  g.userData.anclas = anclas;
  return g;
}

// ─── Escritorio: dos pedestales del color del agente, panel de fondo y tapa blanca con taquitos ───────────────
function escritorio({ w = 6.8, d = 3, color = COLORES.copy, placa } = {}) {
  const alto = SUPERFICIE.escritorio;
  const g = nuevo({ w, d, alto }, { superficie: new THREE.Vector3(0, alto, 0) });
  const k = new Constructor(g);
  const c = plastico(color);
  const ped = 1.6;
  k.ladrillo({ x: -w / 2, y: 0, z: -d / 2, w: ped, d, alto: 2 * L, material: c, taquitos: false });
  k.ladrillo({ x: w / 2 - ped, y: 0, z: -d / 2, w: ped, d, alto: 2 * L, material: c, taquitos: false });
  // panel de fondo (del lado de la silla, hacia -z)
  k.ladrillo({ x: -w / 2 + ped, y: 0.6, z: -d / 2, w: w - 2 * ped, d: 0.6, alto: 2 * L - 0.6, material: c, taquitos: false });
  k.placa({ x: -w / 2, y: 2 * L, z: -d / 2, w, d, color: BLANCO, taquitos: false });
  // taquitos solo en las orillas libres (los objetos van encima del resto, sobre azulejos)
  for (let i = 0; i < Math.round(w); i++) k.taquito(-w / 2 + (w - Math.round(w)) / 2 + i + 0.5, alto, -d / 2 + 0.5, BLANCO);
  k.terminar();
  if (placa) {
    const t = placaTexto(placa, new THREE.Color(color).multiplyScalar(0.65).getStyle());
    const pl = lamina(g, 2.8, 0.7, t, `placa:${placa}`);
    pl.position.set(0, 1.25, d / 2 + 0.02);
  }
  return g;
}
registrarModelo('escritorio', escritorio, { medida: { w: 6.8, d: 3, alto: SUPERFICIE.escritorio } });

// ─── Silla: asiento, respaldo hacia -z, columna y base oscuras ──────────────────────────────────────────────────
function silla({ color = COLORES.copy } = {}) {
  const g = nuevo({ w: 2.4, d: 2.6, alto: 4.2 }, { asiento: new THREE.Vector3(0, 1.7, 0.2) });
  const c = plastico(color);
  const base = plastico(OSCURO);
  bloque(g, 0, 0, 0.25, 1.8, P, 1.8, base);
  bloque(g, 0, P, 0.25, 0.6, 0.9, 0.6, base);
  bloque(g, 0, 1.2, 0.3, 2.4, 0.5, 2.0, c);
  bloque(g, 0, 1.2, -1.0, 2.4, 3.0, 0.6, c);
  const k = new Constructor(g);
  k.taquitosEn(-1.2, 4.2, -1.3, 2.4, 0.6, color);
  k.terminar();
  return g;
}
registrarModelo('silla', silla);

// ─── Monitor: pantalla al frente (+z), logo de color atrás ─────────────────────────────────────────────────────
function monitor({ logo: colorLogo = COLORES.copy } = {}) {
  const g = nuevo({ w: 2.6, d: 0.6, alto: 2.6 }, { pantalla: new THREE.Vector3(0, 1.6, 0.15) });
  const negro = plastico('#2b2f3a');
  bloque(g, 0, 0, 0, 1.0, 0.15, 0.6, plastico(OSCURO));
  bloque(g, 0, 0.15, -0.05, 0.3, 0.6, 0.25, plastico(OSCURO));
  bloque(g, 0, 0.7, 0, 2.6, 1.9, 0.28, negro);
  const p = lamina(g, 2.3, 1.6, pantalla('#5ec8f2'), 'pantalla:monitor', { brillo: true });
  p.position.set(0, 1.65, 0.15);
  const disco = cilindro(g, 0.38, 0.06, plastico(colorLogo), 20);
  disco.rotation.x = Math.PI / 2;
  disco.position.set(0, 1.65, -0.17);
  return g;
}
registrarModelo('monitor', monitor);

// ─── Portátil: base oscura y tapa abierta con pantalla ──────────────────────────────────────────────────────────
function portatil() {
  const g = nuevo({ w: 2, d: 1.4, alto: 1.3 });
  bloque(g, 0, 0, 0.2, 2, 0.12, 1.4, plastico('#1d2433'));
  const tapa = new THREE.Group();
  tapa.position.set(0, 0.12, -0.45);
  tapa.rotation.x = -0.32;
  g.add(tapa);
  bloque(tapa, 0, 0, 0, 2, 1.3, 0.1, plastico('#1d2433'));
  const p = lamina(tapa, 1.8, 1.1, pantalla('#9be7ff'), 'pantalla:portatil', { brillo: true });
  p.position.set(0, 0.65, 0.06);
  return g;
}
registrarModelo('portatil', portatil);

function tableta() {
  const g = nuevo({ w: 1, d: 1, alto: 0.24 });
  bloque(g, 0, 0, 0, 1, 0.12, 1, plastico('#22b8c4'));
  const p = lamina(g, 0.8, 0.8, pantalla('#22b8c4'), 'pantalla:tableta', { brillo: true });
  p.rotation.x = -Math.PI / 2;
  p.position.y = 0.125;
  return g;
}
registrarModelo('tableta', tableta);

function taza({ color = BLANCO } = {}) {
  const g = nuevo({ w: 0.7, d: 0.7, alto: 0.8 });
  const c = cilindro(g, 0.32, 0.75, plastico(color), 16);
  c.position.y = 0.375;
  const cafe = cilindro(g, 0.27, 0.02, mate('#6b3a2a'), 16);
  cafe.position.y = 0.7;
  const asa = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 6, 12, Math.PI), plastico(color));
  asa.rotation.z = -Math.PI / 2;
  asa.position.set(0.32, 0.38, 0);
  asa.castShadow = true;
  asa.userData.fija = true;
  g.add(asa);
  return g;
}
registrarModelo('taza', taza);

function notas({ color = COLORES.amarillo } = {}) {
  const g = nuevo({ w: 0.9, d: 0.9, alto: 0.2 });
  bloque(g, 0, 0, 0, 0.9, 0.2, 0.9, plastico(color), 1);
  return g;
}
registrarModelo('notas', notas);

function papel() {
  const g = nuevo({ w: 1.8, d: 1.2, alto: 0.1 });
  bloque(g, 0, 0, 0, 1.8, 0.08, 1.2, mate('#fffdf5'), 1);
  bloque(g, 0.2, 0.08, 0.1, 1.6, 0.04, 1.0, mate('#eee5d2'), 1);
  return g;
}
registrarModelo('papel', papel);

function camaraInstantanea() {
  const g = nuevo({ w: 1.2, d: 0.84, alto: 0.7 });
  bloque(g, 0, 0, 0, 1.2, 0.68, 0.84, plastico(COLORES.rojo));
  const lente = cilindro(g, 0.24, 0.16, plastico(OSCURO), 16);
  lente.rotation.x = Math.PI / 2;
  lente.position.set(0, 0.34, 0.45);
  bloque(g, -0.35, 0.68, -0.1, 0.3, 0.1, 0.3, plastico(BLANCO), 1);
  return g;
}
registrarModelo('camaraInstantanea', camaraInstantanea);

// ─── Librero: marco blanco con repisas, libros de colores, maleta y cámara encima ────────────────────────────────
function librero() {
  const w = 3.6;
  const d = 1.8;
  const alto = 5.6;
  const g = nuevo({ w, d, alto }, { superficie: new THREE.Vector3(0, alto + P, 0) });
  const k = new Constructor(g);
  const blanco = plastico(BLANCO);
  k.ladrillo({ x: -w / 2, y: 0, z: -d / 2, w: 0.4, d, alto, material: blanco, taquitos: false });
  k.ladrillo({ x: w / 2 - 0.4, y: 0, z: -d / 2, w: 0.4, d, alto, material: blanco, taquitos: false });
  k.ladrillo({ x: -w / 2 + 0.4, y: 0, z: -d / 2, w: w - 0.8, d: 0.3, alto, material: blanco, taquitos: false });
  for (const y of [0, 1.9, 3.8]) k.placa({ x: -w / 2 + 0.4, y, z: -d / 2, w: w - 0.8, d, material: blanco, taquitos: false });
  k.placa({ x: -w / 2, y: alto, z: -d / 2, w, d, color: BLANCO, taquitos: false });
  const libros = ['#d4382c', '#1f6fc9', '#f5cd30', '#2a9a55', '#ff8a3d', '#8a6ee0'];
  for (const [fila, y] of [[0, P], [1, 1.9 + P]]) {
    let x = -w / 2 + 0.5;
    libros.forEach((c, i) => {
      const ancho = 0.36 + ((i + fila) % 3) * 0.06;
      const altoL = 1.05 + ((i + fila) % 2) * 0.25;
      if (x + ancho > w / 2 - 0.45) return;
      bloque(g, x + ancho / 2, y, 0.05, ancho, altoL, 1.2, plastico(libros[(i + fila * 2) % libros.length]), 1);
      x += ancho + 0.02;
    });
  }
  // maleta roja y cámara encima
  const maletaG = maleta({ color: COLORES.rojo });
  maletaG.position.set(-0.6, alto + P, 0);
  maletaG.rotation.y = Math.PI / 2;
  g.add(maletaG);
  bloque(g, 0.9, alto + P, 0.1, 0.9, 0.7, 1.0, plastico(OSCURO));
  k.terminar();
  return g;
}
registrarModelo('librero', librero);

// ─── Maleta: cuerpo, asa y correa amarilla ─────────────────────────────────────────────────────────────────────
function maleta({ color = COLORES.azul } = {}) {
  const g = nuevo({ w: 1.2, d: 1.6, alto: 1.4 });
  bloque(g, 0, 0, 0, 1.2, 1.1, 1.6, plastico(color));
  bloque(g, 0, 1.1, 0, 0.4, 0.2, 0.6, plastico(OSCURO), 1);
  bloque(g, 0, 0.36, 0, 1.24, 0.16, 1.64, plastico(COLORES.amarillo), 1);
  return g;
}
registrarModelo('maleta', maleta);

// ─── Plantas ──────────────────────────────────────────────────────────────────────────────────────────────────
const geoHoja = new THREE.SphereGeometry(0.7, 12, 10);
geoHoja.userData.compartida = true;
function maceta(g) {
  const k = new Constructor(g);
  k.ladrillo({ x: -0.8, y: 0, z: -0.8, w: 1.6, d: 1.6, alto: L, material: plastico('#d0693d'), taquitos: false });
  bloque(g, 0, L - 0.05, 0, 1.3, 0.1, 1.3, mate('#5a3a22'), 1);
}
function planta() {
  const g = nuevo({ w: 1.6, d: 1.6, alto: 3.6 });
  maceta(g);
  const hojas = [plastico('#2e9d5b'), plastico('#3fae6a')];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(geoHoja, hojas[i % 2]);
    const a = (i / 6) * Math.PI * 2;
    m.scale.set(0.75, 1.45, 0.42);
    m.position.set(Math.cos(a) * 0.45, L + 0.8 + (i % 2) * 0.3, Math.sin(a) * 0.45);
    m.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5);
    m.castShadow = true;
    m.userData.fija = true;
    g.add(m);
  }
  const top = new THREE.Mesh(geoHoja, hojas[0]);
  top.scale.set(0.6, 1.2, 0.6);
  top.position.y = L + 1.5;
  top.castShadow = true;
  top.userData.fija = true;
  g.add(top);
  return g;
}
registrarModelo('planta', planta);

function palmera() {
  const g = nuevo({ w: 1.6, d: 1.6, alto: 7 });
  maceta(g);
  const troncos = [mate('#8f6239'), mate('#a87545')];
  for (let i = 0; i < 7; i++) bloque(g, (i % 2) * 0.08 - 0.04, L + i * 0.62, 0, 0.62, 0.6, 0.62, troncos[i % 2], 1);
  const copa = L + 7 * 0.62;
  const hoja = [plastico('#2a9a55'), plastico('#3fae6a')];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const f = new THREE.Group();
    f.position.set(0, copa, 0);
    f.rotation.y = -a;
    g.add(f);
    const pala = bloque(f, 1.25, 0, 0, 2.6, 0.12, 0.55, hoja[i % 2], 1);
    pala.rotation.z = -0.38;
    pala.position.y = -0.3;
  }
  for (const [x, z] of [[0.25, 0.15], [-0.2, 0.2], [0, -0.25]]) {
    const coco = new THREE.Mesh(geoHoja, mate('#6b4a2a'));
    coco.scale.setScalar(0.32);
    coco.position.set(x, copa - 0.25, z);
    coco.userData.fija = true;
    g.add(coco);
  }
  return g;
}
registrarModelo('palmera', palmera);

// ─── Rack de servidores: frente (+z) con bahías y luces ─────────────────────────────────────────────────────────
function rack() {
  const w = 2.4;
  const d = 3.2;
  const alto = 4.8;
  const g = nuevo({ w, d, alto });
  bloque(g, 0, 0, 0, w, alto, d, plastico('#c9d0d8'));
  bloque(g, 0, alto, 0, w, P, d, plastico('#b9c3cf'));
  [0.6, 1.6, 2.6, 3.6].forEach((y, i) => {
    bloque(g, -0.1, y, d / 2, 1.8, 0.62, 0.08, plastico('#8791a0'), 1);
    bloque(g, 0.75, y + 0.2, d / 2 + 0.04, 0.22, 0.22, 0.06, plastico(i % 2 ? '#30bb4f' : '#ffab41'), 1);
  });
  const k = new Constructor(g);
  k.taquitosEn(-w / 2, alto + P, -d / 2, w, d, '#b9c3cf');
  k.terminar();
  return g;
}
registrarModelo('rack', rack);

// ─── Trípode con cámara ─────────────────────────────────────────────────────────────────────────────────────────
function tripode() {
  const g = nuevo({ w: 2.4, d: 2.4, alto: 5.6 });
  const metal = plastico('#3b4252');
  const cima = new THREE.Vector3(0, 4.6, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    const pie = new THREE.Vector3(Math.cos(a) * 1.1, 0, Math.sin(a) * 1.1);
    const largo = pie.distanceTo(cima);
    const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, largo, 6), metal);
    pata.position.copy(pie).add(cima).multiplyScalar(0.5);
    pata.lookAt(cima);
    pata.rotateX(Math.PI / 2);
    pata.castShadow = true;
    pata.userData.fija = true;
    g.add(pata);
  }
  bloque(g, 0, 4.6, 0, 1.4, 1.1, 1.2, plastico(COLORES.rojo));
  const lente = cilindro(g, 0.3, 0.5, plastico(COLORES.amarillo), 16);
  lente.rotation.x = Math.PI / 2;
  lente.position.set(0, 5.15, 0.8);
  return g;
}
registrarModelo('tripode', tripode);

// ─── Sala de juntas: mesa, credenza, pantalla con logo, globo ──────────────────────────────────────────────────
function mesaJuntas({ w = 13.6, d = 5.2 } = {}) {
  const alto = SUPERFICIE.mesaJuntas;
  const g = nuevo({ w, d, alto }, { superficie: new THREE.Vector3(0, alto, 0) });
  const k = new Constructor(g);
  const azul = plastico(COLORES.azul);
  k.ladrillo({ x: -w / 2 + 0.8, y: 0, z: -d / 2 + 0.8, w: w - 1.6, d: d - 1.6, alto: 2 * L, material: azul, taquitos: false });
  k.placa({ x: -w / 2, y: 2 * L, z: -d / 2, w, d, color: BLANCO, taquitos: false });
  // taquitos espaciados en las orillas, como en la mesa del SVG
  for (let i = 0; i < 8; i++) {
    const x = -w / 2 + 0.9 + i * ((w - 1.8) / 7);
    k.taquito(x, alto, -d / 2 + 0.5, BLANCO);
    k.taquito(x, alto, d / 2 - 0.5, BLANCO);
  }
  k.terminar();
  return g;
}
registrarModelo('mesaJuntas', mesaJuntas);

function credenza({ w = 4.8, d = 2.6 } = {}) {
  const alto = SUPERFICIE.credenza;
  const g = nuevo({ w, d, alto }, { superficie: new THREE.Vector3(0, alto, 0) });
  const k = new Constructor(g);
  k.ladrillo({ x: -w / 2, y: 0, z: -d / 2, w, d, alto: 2 * L, color: COLORES.tostado, taquitos: false });
  k.placa({ x: -w / 2, y: 2 * L, z: -d / 2, w, d, color: COLORES.tostado, taquitos: false });
  bloque(g, -w / 4, 0.5, d / 2, w / 2 - 0.2, 1.4, 0.06, plastico('#c9a86a'), 1);
  bloque(g, w / 4, 0.5, d / 2, w / 2 - 0.2, 1.4, 0.06, plastico('#c9a86a'), 1);
  return g;
}
registrarModelo('credenza', credenza);

function pantallaLogo() {
  const g = nuevo({ w: 2.4, d: 0.6, alto: 2.6 });
  bloque(g, 0, 0, 0, 0.4, 0.5, 0.4, plastico(OSCURO), 1);
  bloque(g, 0, 0.45, 0, 2.4, 1.9, 0.28, plastico('#2b2f3a'));
  const fondo = lamina(g, 2.0, 1.6, pantalla('#fffdf5'), 'pantalla:blanca');
  fondo.position.set(0, 1.4, 0.15);
  const img = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshStandardMaterial({ map: logo(), transparent: true, roughness: 0.5 }));
  img.position.set(0, 1.4, 0.16);
  g.add(img);
  return g;
}
registrarModelo('pantallaLogo', pantallaLogo);

function globo() {
  const g = nuevo({ w: 1.2, d: 1.2, alto: 2.0 });
  bloque(g, 0, 0, 0, 1.0, 0.25, 1.0, plastico(OSCURO), 1);
  const eje = cilindro(g, 0.06, 0.4, plastico(OSCURO), 6);
  eje.position.y = 0.45;
  const esfera = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 14), plastico('#2a86d0'));
  esfera.position.y = 1.3;
  esfera.castShadow = true;
  esfera.userData.fija = true;
  g.add(esfera);
  for (const [a, b, s] of [[0.4, 0.5, 0.32], [-0.6, 0.2, 0.28], [2.2, -0.3, 0.3], [3.4, 0.4, 0.22]]) {
    const tierra = new THREE.Mesh(geoHoja, plastico('#5bc27a'));
    tierra.scale.set(s, s * 0.6, s);
    tierra.position.set(Math.cos(a) * Math.cos(b) * 0.62, 1.3 + Math.sin(b) * 0.62, Math.sin(a) * Math.cos(b) * 0.62);
    tierra.lookAt(0, 1.3, 0);
    tierra.userData.fija = true;
    g.add(tierra);
  }
  const anillo = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.04, 6, 24, Math.PI), plastico(COLORES.amarillo));
  anillo.position.y = 1.3;
  anillo.rotation.z = Math.PI / 2;
  anillo.userData.fija = true;
  g.add(anillo);
  return g;
}
registrarModelo('globo', globo);

// ─── Tu oficina: trofeo, sofá y cama del gato ───────────────────────────────────────────────────────────────────
function trofeo() {
  const g = nuevo({ w: 0.8, d: 0.6, alto: 1.4 });
  bloque(g, 0, 0, 0, 0.8, 0.24, 0.6, plastico(OSCURO), 1);
  const copa = new THREE.Mesh(
    new THREE.LatheGeometry([new THREE.Vector2(0.08, 0), new THREE.Vector2(0.1, 0.4), new THREE.Vector2(0.38, 0.6), new THREE.Vector2(0.36, 1.0), new THREE.Vector2(0.3, 1.0)], 16),
    new THREE.MeshPhysicalMaterial({ color: '#f5cd30', metalness: 0.6, roughness: 0.25, clearcoat: 0.5 })
  );
  copa.position.y = 0.24;
  copa.castShadow = true;
  g.add(copa);
  return g;
}
registrarModelo('trofeo', trofeo);

function sofa({ w = 6.8, d = 2.4 } = {}) {
  const g = nuevo({ w, d, alto: 3.4 }, { asiento: new THREE.Vector3(0, 1.6, 0.3) });
  const t = plastico(COLORES.turquesa);
  const k = new Constructor(g);
  k.ladrillo({ x: -w / 2, y: 0, z: -d / 2, w, d, alto: L, material: t, taquitos: false });
  k.ladrillo({ x: -w / 2, y: 0, z: -d / 2, w, d: 0.7, alto: 3.2, material: t, taquitos: false });
  k.ladrillo({ x: -w / 2, y: L, z: -d / 2 + 0.7, w: 0.6, d: d - 0.7, alto: 1.0, material: t, taquitos: false });
  k.ladrillo({ x: w / 2 - 0.6, y: L, z: -d / 2 + 0.7, w: 0.6, d: d - 0.7, alto: 1.0, material: t, taquitos: false });
  const cojin = plastico('#3fb7c7');
  bloque(g, -1.55, L, 0.35, 2.8, 0.4, 1.6, cojin);
  bloque(g, 1.55, L, 0.35, 2.8, 0.4, 1.6, cojin);
  k.taquitosEn(-w / 2, 3.2, -d / 2, w, 0.7, COLORES.turquesa);
  k.terminar();
  return g;
}
registrarModelo('sofa', sofa);

function camaGato() {
  const g = nuevo({ w: 4.8, d: 4.4, alto: 0.8 });
  const base = cilindro(g, 2.3, 0.5, plastico('#ff8a3d'), 28);
  base.scale.z = 0.92;
  base.position.y = 0.25;
  const borde = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.32, 10, 28), plastico('#b8531f'));
  borde.rotation.x = Math.PI / 2;
  borde.scale.y = 0.92;
  borde.position.y = 0.55;
  borde.castShadow = true;
  borde.userData.fija = true;
  g.add(borde);
  const cojin = cilindro(g, 1.7, 0.2, plastico('#fde07e'), 24);
  cojin.scale.z = 0.92;
  cojin.position.y = 0.6;
  return g;
}
registrarModelo('camaGato', camaGato);

