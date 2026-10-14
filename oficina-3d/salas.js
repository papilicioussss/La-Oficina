// Arma las cinco salas con los datos de plano.js y los modelos del registro.
// Cada sala es un grupo con nombre (`sala:copy`, …) que guarda su rectángulo, su centro y la lista de modelos con
// sus anclas en coordenadas del mundo (para la futura integración de personajes y para las pruebas).
import * as THREE from 'three';
import { crearModelo } from './registro.js';
import { SUPERFICIE } from './componentes/muebles.js';
import { fusionar, unirTaquitos } from './ladrillos.js';
import { ROOM_AREA, SALAS, MUEBLES, ESCALA, ALTURAS, aMundo, rectMundo } from './plano.js';

const RAD = Math.PI / 180;

/** Coloca un modelo del plano. Devuelve la ficha del modelo colocado. */
function colocar(item) {
  const rot = item.rot || 0;
  const giro90 = Math.abs(rot) % 180 === 90;
  const opciones = { ...item };
  let centro;
  if (item.huella) {
    const r = rectMundo(item.huella);
    centro = { x: r.x + r.w / 2, z: r.z + r.d / 2 };
    // la medida del modelo va en sus ejes propios: si está girado 90°, ancho y fondo se intercambian
    opciones.w = giro90 ? r.d : r.w;
    opciones.d = giro90 ? r.w : r.d;
  } else centro = aMundo(item.en);
  const m = crearModelo(item.modelo, opciones);
  const y = item.sobre ? SUPERFICIE[item.sobre] : 0;
  m.objeto.position.set(centro.x, y, centro.z);
  m.objeto.rotation.y = rot * RAD;
  return { ...m, item, huellaMundo: item.huella ? rectMundo(item.huella) : null };
}

export function construirSalas() {
  const salas = {};
  const grupo = new THREE.Group();
  grupo.name = 'salas';
  for (const [id, area] of Object.entries(ROOM_AREA)) {
    const g = new THREE.Group();
    g.name = `sala:${id}`;
    const [x, y, w, d] = area.map((v) => v * ESCALA);
    g.userData = { id, ...SALAS[id], rect: { x, z: y, w, d }, centro: new THREE.Vector3(x + w / 2, 0, y + d / 2), modelos: [] };
    grupo.add(g);
    salas[id] = g;
  }
  for (const item of MUEBLES) {
    const sala = salas[item.sala];
    const m = colocar(item);
    sala.add(m.objeto);
    sala.userData.modelos.push(m);
  }
  grupo.updateMatrixWorld(true);
  let piezas = 0;
  for (const sala of Object.values(salas)) {
    // anclas en coordenadas del mundo (se calculan antes de fusionar)
    for (const m of sala.userData.modelos) {
      m.anclasMundo = Object.fromEntries(Object.entries(m.anclas).map(([k, v]) => [k, m.objeto.localToWorld(v.clone())]));
      m.cajaMundo = new THREE.Box3().setFromObject(m.objeto);
      // huella a ras de piso: solo las piezas que empiezan por debajo de la altura de los tabiques
      // (las hojas de una palmera pueden pasar por encima de un tabique sin chocar con él)
      m.cajaBase = new THREE.Box3();
      m.objeto.traverse((o) => {
        if (!o.isMesh) return;
        const c = new THREE.Box3().setFromObject(o);
        if (c.min.y < ALTURAS.tabique) m.cajaBase.union(c);
      });
    }
    unirTaquitos(sala);
    piezas += fusionar(sala);
  }
  return { grupo, salas, piezas };
}
