// Suelos: losa de la oficina, pisos lisos de cada sala (azulejos grandes con junta), alfombras de placas con
// taquitos (los únicos taquitos del piso) y umbrales en las puertas. Todo se fusiona por material al final.
import * as THREE from 'three';
import { Constructor, fusionar, registrarVariantes, ALTO_PLACA as P } from '../ladrillos.js';
import { plastico } from '../materiales.js';
import { ROOM_AREA, ROOM_TINT, ALFOMBRAS, PUERTAS, COLORES, ALTURAS, rectMundo, ESCALA } from '../plano.js';

const mezcla = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t).getStyle();

export function construirSuelos({ finos = true } = {}) {
  const grupo = new THREE.Group();
  grupo.name = 'suelos';
  const k = new Constructor(grupo);
  const losa = ALTURAS.losa;

  // Losa: bloque principal 24 × 24 y anexo de tu oficina 12 × 10 (en taquitos: 48 × 48 y 24 × 20)
  k.ladrillo({ x: -1, y: -losa - P, z: -1, w: 50, d: 50, alto: losa, color: COLORES.losa, taquitos: false, seg: 1 });
  k.ladrillo({ x: 23, y: -losa - P, z: 48, w: 26, d: 21, alto: losa, color: COLORES.losa, taquitos: false, seg: 1 });

  // Pisos de cada sala: azulejos de 4 × 4 (lisos) con una pequeña junta; el borde de la sala queda a 0.25 del plano.
  // Versión biselada (Alta) y versión simple (Media y Baja).
  const pisos = [new THREE.Group(), new THREE.Group()];
  grupo.add(...pisos);
  const [kf, ks] = pisos.map((g) => new Constructor(g));
  for (const [sala, area] of Object.entries(ROOM_AREA)) {
    const [ox, oy, w, d] = area.map((v) => v * ESCALA);
    const color = ROOM_TINT[sala];
    const material = plastico(color);
    const x0 = ox + 0.5;
    const z0 = oy + 0.5;
    const x1 = ox + w - 0.5;
    const z1 = oy + d - 0.5;
    for (let x = x0; x < x1 - 0.01; x += 4) {
      for (let z = z0; z < z1 - 0.01; z += 4) {
        const azulejo = { x, y: -P, z, w: Math.min(4, x1 - x), d: Math.min(4, z1 - z), alto: P, material, taquitos: false };
        kf.ladrillo({ ...azulejo, seg: 1 });
        ks.ladrillo({ ...azulejo, seg: 0 });
      }
    }
  }

  // Alfombras: placas delgadas con taquitos, en el color del agente mezclado con el piso (como la alfombra del SVG)
  for (const a of ALFOMBRAS) {
    const r = rectMundo(a.rect);
    const color = mezcla(ROOM_TINT[a.sala], a.color, 0.5);
    k.ladrillo({ x: r.x, y: 0, z: r.z, w: r.w, d: r.d, alto: 0.12, color, taquitos: false, seg: 1 });
    // taquitos de la alfombra (solo donde no hay muebles grandes encima: se dejan los bordes)
    const nx = Math.round(r.w);
    const nz = Math.round(r.d);
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        if (i > 1 && i < nx - 2 && j > 1 && j < nz - 2) continue;
        k.taquito(r.x + (r.w - nx) / 2 + i + 0.5, 0.12, r.z + (r.d - nz) / 2 + j + 0.5, color);
      }
    }
  }

  // Umbrales: una placa lisa más oscura en cada puerta (marca la circulación)
  for (const p of PUERTAS) {
    const largo = (p.hasta - p.desde) * ESCALA;
    const ini = p.desde * ESCALA;
    const en = p.en * ESCALA;
    const umbral = { alto: 0.06, color: '#d9c9a8', taquitos: false, seg: 1, y: 0 };
    if (p.eje === 'x') k.ladrillo({ ...umbral, x: en - 0.5, z: ini, w: 1, d: largo });
    else k.ladrillo({ ...umbral, x: ini, z: en - 0.5, w: largo, d: 1 });
  }

  k.terminar(finos);
  pisos.forEach((g) => fusionar(g));
  registrarVariantes(pisos[0], pisos[1]);
  fusionar(grupo);
  return grupo;
}
