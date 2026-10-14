// Escena de prueba: una pequeña plataforma LEGO con ladrillos visibles, un escritorio, una pared, una planta y una minifigura.
import * as THREE from 'three';
import { Constructor } from './ladrillos.js';
import { PALETA, plastico } from './materiales.js';
import { crearModelo } from './modelos.js';

export function construirEscena() {
  const k = new Constructor();
  const N = 16;

  // Plataforma (baseplate) con borde de placas
  k.placa({ x: 0, y: 0, z: 0, w: N, d: N, color: PALETA.base });
  // pared trasera de ladrillos (aparejo trabado: las juntas se desfasan en cada hilera)
  const colores = [PALETA.blanco, PALETA.arena];
  for (let hilera = 0; hilera < 4; hilera++) {
    const y = 0.4 + hilera * 1.2;
    const desfase = hilera % 2 ? 1 : 0;
    // pared izquierda (a lo largo de z)
    for (let zz = desfase; zz < N; zz += 4) {
      const w = Math.min(4, N - zz);
      if (hilera < 2 && zz >= 6 && zz < 10) continue; // hueco de puerta
      k.ladrillo({ x: 0, y, z: zz, w: 1, d: w, color: colores[(hilera + zz) % 2] });
    }
    // pared del fondo (a lo largo de x)
    for (let xx = 1 + desfase; xx < N; xx += 4) {
      const w = Math.min(4, N - xx);
      k.ladrillo({ x: xx, y, z: 0, w, d: 1, color: colores[(hilera + xx) % 2] });
    }
  }
  // ventana: marco azul y vidrio
  for (let i = 0; i < 4; i++) k.azulejo({ x: 5 + i, y: 2.8, z: 0, w: 1, d: 1, color: PALETA.azul });

  // escritorio naranja con patas de 1x1 y tapa blanca
  const dx = 4;
  const dz = 6;
  for (const [px, pz] of [[dx, dz], [dx + 5, dz], [dx, dz + 2], [dx + 5, dz + 2]]) k.ladrillo({ x: px, y: 0.4, z: pz, w: 1, d: 1, color: PALETA.naranja });
  k.placa({ x: dx, y: 1.6, z: dz, w: 6, d: 3, color: PALETA.blanco });
  // monitor
  k.ladrillo({ x: dx + 2, y: 2.0, z: dz + 1, w: 2, d: 1, color: PALETA.oscuro, taquitos: false });
  k.ladrillo({ x: dx + 1, y: 3.2, z: dz + 1, w: 4, d: 1, alto: 1.2, color: PALETA.oscuro, taquitos: false });
  k.azulejo({ x: dx + 1, y: 4.4, z: dz + 1, w: 4, d: 1, color: PALETA.azul });
  // silla roja
  k.ladrillo({ x: dx + 2, y: 0.4, z: dz + 4, w: 2, d: 2, color: PALETA.rojo });
  k.placa({ x: dx + 1, y: 1.6, z: dz + 4, w: 4, d: 3, color: PALETA.rojo });
  k.ladrillo({ x: dx + 1, y: 2.0, z: dz + 6, w: 4, d: 1, color: PALETA.rojo });

  // escalera de colores clásicos
  [PALETA.rojo, PALETA.amarillo, PALETA.azul, PALETA.verde].forEach((c, i) => k.ladrillo({ x: 12, y: 0.4 + 1.2 * i - 1.2 * 0, z: 11 + 0, w: 2 + 0, d: 4 - i, color: c }));
  // planta: maceta marrón y hojas
  k.ladrillo({ x: 13, y: 0.4, z: 3, w: 2, d: 2, color: PALETA.marron });

  const mundo = new THREE.Group();
  mundo.add(k.terminar());

  // hojas de la planta (piezas redondeadas)
  const hoja = plastico('#2a9a55');
  const hojas = new THREE.Group();
  hojas.position.set(14, 1.6, 4);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.75, 18, 14), hoja);
    const a = (i / 6) * Math.PI * 2;
    m.scale.set(0.8, 1.5, 0.45);
    m.position.set(Math.cos(a) * 0.55, 0.9 + (i % 2) * 0.25, Math.sin(a) * 0.55);
    m.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5);
    m.castShadow = true;
    hojas.add(m);
  }
  mundo.add(hojas);

  // minifiguras: se piden al registro de modelos (hoy son provisionales hechas por código; mañana pueden ser modelos detallados)
  const nico = crearModelo('minifigura', { camisa: PALETA.naranja, gorra: PALETA.naranja, semilla: 3 });
  nico.objeto.position.set(dx - 1.6, 0.4, dz + 1.5);
  nico.objeto.scale.setScalar(0.85);
  nico.objeto.rotation.y = Math.PI / 2; // mira al escritorio
  mundo.add(nico.objeto);
  const alex = crearModelo('minifigura', { camisa: PALETA.azul, pantalon: '#2b2f3a', semilla: 11 });
  alex.objeto.position.set(9.5, 0.4, 12.5);
  alex.objeto.scale.setScalar(0.85);
  alex.objeto.rotation.y = -0.7;
  mundo.add(alex.objeto);

  mundo.position.set(-N / 2, 0, -N / 2); // centrado en el origen
  return { mundo, modelos: [{ ...nico, nombre: 'Nico', estado: 'idle' }, { ...alex, nombre: 'Alex', estado: 'idle' }], tamano: N, cajas: k.cajas };
}
