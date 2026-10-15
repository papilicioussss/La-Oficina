// Etiquetas sobre los personajes, en HTML encima del lienzo (nítidas en cualquier pantalla y baratas de dibujar):
//   - nombre del agente en una pieza del color de su camisa (como la etiqueta del SVG);
//   - globo con el texto EXACTO de la app: STATUS_LABEL (Pensando…, Buscando en la web…, Hablando…) o "Escribiendo…"
//     cuando llega texto real. Igual que en el SVG, el globo no se muestra en reposo, al caminar ni en reunión
//     mientras el agente no habla.
import * as THREE from 'three';

/** Color de texto legible sobre un fondo (copia de inkFor() de js/office.js). */
function tinta(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return (L + 0.05) / (0.017 + 0.05) >= 1.05 / (L + 0.05) ? '#1d2433' : '#ffffff';
}

export function crearEtiquetas(contenedor) {
  const capa = document.createElement('div');
  capa.className = 'etiquetas';
  capa.setAttribute('aria-hidden', 'true'); // los estados se anuncian en la app con su aria-live (fase 6)
  contenedor.append(capa);
  const items = new Map();
  const v = new THREE.Vector3();

  function agregar(id, nombre, color) {
    const el = document.createElement('div');
    el.className = 'etiqueta';
    el.dataset.agente = id;
    const globo = document.createElement('span');
    globo.className = 'globo';
    globo.hidden = true;
    const placa = document.createElement('span');
    placa.className = 'placa';
    placa.textContent = nombre;
    placa.style.background = color;
    placa.style.color = tinta(color);
    el.append(globo, placa);
    capa.append(el);
    items.set(id, { el, globo, placa, texto: '' });
  }

  /** Texto del globo ('' = oculto). */
  function globo(id, texto) {
    const it = items.get(id);
    if (!it || it.texto === texto) return;
    it.texto = texto;
    it.globo.textContent = texto;
    it.globo.hidden = !texto;
  }

  function seleccionar(id) {
    for (const [k, it] of items) it.el.classList.toggle('es-activo', k === id);
  }

  /** Coloca cada etiqueta sobre la cabeza de su personaje (punto del mundo `cabeza(id, v)`). */
  function colocar(camara, ancho, alto, cabeza) {
    for (const [id, it] of items) {
      cabeza(id, v);
      v.project(camara);
      const fuera = v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2;
      it.el.style.display = fuera ? 'none' : '';
      if (!fuera) it.el.style.transform = `translate(${((v.x + 1) / 2) * ancho}px, ${((1 - v.y) / 2) * alto}px) translate(-50%, -100%)`;
    }
  }

  return { agregar, globo, seleccionar, colocar, capa, items };
}
