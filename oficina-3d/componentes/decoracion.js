// Decoración de las paredes del fondo, en las mismas posiciones que la oficina SVG:
//   pared y = 0 ("fondo-der"): ventana con playa (Copy), tablero de inspiración (Copy) y pantalla con gráfico (Analista)
//   pared x = 0 ("fondo-izq"): letrero de la marca con el logo (Copy) y corcho con notas (Guion)
// La altura del SVG (0 a 6) se lleva a la pared 3D (0 a 9.6) multiplicando por 1.6.
// Todo se cuelga del "contenido" de su pared, así se oculta junto con ella.
import * as THREE from 'three';
import { geoCaja, fusionar } from '../ladrillos.js';
import { plastico, estampado, translucido } from '../materiales.js';
import { playa, letrero, grafico, logo } from '../texturas.js';
import { ESCALA } from '../plano.js';

const ALTO = 1.6; // altura del SVG → altura de la pared 3D
const SEP = 0.04; // separación de la pared para evitar parpadeos de profundidad

/** Lámina con textura pegada a una pared. `pared`: 'x' (x = 0, mira a +x) o 'y' (y = 0, mira a +z). */
function lamina(destino, pared, a1, a2, z1, z2, material, sep = SEP) {
  const w = (a2 - a1) * ESCALA;
  const h = (z2 - z1) * ALTO;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  const centro = ((a1 + a2) / 2) * ESCALA;
  const y = ((z1 + z2) / 2) * ALTO;
  if (pared === 'y') m.position.set(centro, y, sep);
  else {
    m.position.set(sep, y, centro);
    m.rotation.y = Math.PI / 2;
  }
  m.receiveShadow = true;
  destino.add(m);
  return m;
}

/** Pieza de plástico (caja) pegada a la pared. */
function pieza(destino, pared, a1, a2, z1, z2, color, grosor = 0.2) {
  const w = (a2 - a1) * ESCALA;
  const h = (z2 - z1) * ALTO;
  const m = new THREE.Mesh(geoCaja(pared === 'y' ? w : grosor, h, pared === 'y' ? grosor : w, 1, 0.04), plastico(color));
  const c = ((a1 + a2) / 2) * ESCALA;
  const y = ((z1 + z2) / 2) * ALTO;
  if (pared === 'y') m.position.set(c, y, grosor / 2);
  else m.position.set(grosor / 2, y, c);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.fija = true;
  destino.add(m);
  return m;
}

export function decorar(paredes) {
  const der = paredes.porId['fondo-der'].contenido;
  const izq = paredes.porId['fondo-izq'].contenido;

  // Ventana con playa: el paisaje queda detrás del hueco y un vidrio translúcido en el hueco
  const v = paredes.porId['fondo-der'];
  const [h0, h1] = v.hueco;
  const ancho = h1 - h0;
  const paisaje = new THREE.Mesh(new THREE.PlaneGeometry(ancho + 2, 6), estampado('playa', playa()));
  paisaje.position.set(v.rect.x + (h0 + h1) / 2, 6.0, -1.6);
  der.add(paisaje);
  const vidrio = new THREE.Mesh(new THREE.PlaneGeometry(ancho, 4.8), translucido('#cfefff', 0.18));
  vidrio.position.set(v.rect.x + (h0 + h1) / 2, 6.0, -0.5);
  der.add(vidrio);

  // Tablero de inspiración con fotos (x 9.9–11.7, alto 2.2–4.6)
  pieza(der, 'y', 9.9, 11.7, 2.2, 4.6, '#324966', 0.16);
  [[10.05, 3.5, '#ff8a3d'], [10.65, 3.5, '#00b9ec'], [11.25, 3.5, '#f5cd30'], [10.05, 2.5, '#2a9a55'], [10.65, 2.5, '#d4382c'], [11.25, 2.5, '#ffffff']].forEach(([x1, z1, c]) => {
    pieza(der, 'y', x1, x1 + 0.45, z1, z1 + 0.7, '#fffdf5', 0.22);
    pieza(der, 'y', x1 + 0.05, x1 + 0.4, z1 + 0.16, z1 + 0.64, c, 0.26);
  });

  // Pantalla del analista con marco blanco (x 13.65–21.35, alto 2.05–5.35)
  pieza(der, 'y', 13.65, 21.35, 2.05, 5.35, '#f4f4f2', 0.2);
  lamina(der, 'y', 13.8, 21.2, 2.2, 5.2, estampado('grafico', grafico(), { brillo: true }), 0.22);

  // Letrero de la marca en la pared x = 0 (y 1.2–10.8, alto 2.8–5.4) con el logo original
  pieza(izq, 'x', 1.2, 10.8, 2.8, 5.4, '#324966', 0.16);
  lamina(izq, 'x', 1.4, 8.6, 2.9, 5.3, estampado('letrero', letrero()), 0.18);
  const marcaLogo = new THREE.MeshStandardMaterial({ map: logo(), transparent: true, roughness: 0.5 });
  lamina(izq, 'x', 8.9, 10.6, 2.95, 5.25, marcaLogo, 0.19);

  // Corcho del guionista con notas (y 13.85–21.15, alto 2.1–5.1)
  pieza(izq, 'x', 13.85, 21.15, 2.1, 5.1, '#8f6239', 0.16);
  pieza(izq, 'x', 14, 21, 2.2, 5.0, '#c99a5b', 0.2);
  [[14.6, 4.0, '#ffd166'], [16.2, 4.2, '#ff9fb2'], [17.8, 3.9, '#9be7ff'], [19.4, 4.1, '#b9f6ca'], [15.3, 2.7, '#9be7ff'], [17.0, 2.6, '#ffd166'], [18.7, 2.8, '#ff9fb2']].forEach(([y1, z1, c]) =>
    pieza(izq, 'x', y1, y1 + 1.1, z1, z1 + 0.8, c, 0.24)
  );

  // las piezas de plástico de la decoración se juntan por material (menos llamadas de dibujo)
  fusionar(der);
  fusionar(izq);
}
