// Texturas dibujadas en el navegador (canvas) y la imagen del logo. Todo es local: nada se descarga de internet.
// Cada textura se crea una sola vez y se reutiliza.
import * as THREE from 'three';

const cache = new Map();
const FUENTE = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

/** Crea (o reutiliza) una textura de `ancho × alto` píxeles dibujada con `dibujar(ctx, ancho, alto)`. */
export function lienzo(clave, ancho, alto, dibujar) {
  if (!cache.has(clave)) {
    const c = document.createElement('canvas');
    c.width = ancho;
    c.height = alto;
    dibujar(c.getContext('2d'), ancho, alto);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    cache.set(clave, t);
  }
  return cache.get(clave);
}

/** Logo de la marca (assets/logo-256.png de la app, leído en modo solo lectura). */
export function logo() {
  if (!cache.has('logo')) {
    const t = new THREE.TextureLoader().load(new URL('../assets/logo-256.png', import.meta.url).href, () => window.dispatchEvent(new Event('oficina3d:textura')));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    cache.set('logo', t);
  }
  return cache.get('logo');
}

function redondeado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Placa con texto (nombre en el frente de un escritorio). */
export function placaTexto(texto, fondo, tinta = '#ffffff') {
  return lienzo(`placa:${texto}:${fondo}`, 256, 64, (ctx, w, h) => {
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(0, 0, w, 10);
    ctx.fillStyle = tinta;
    ctx.font = `800 38px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, w / 2, h / 2 + 3);
  });
}

/** Paisaje de playa para la ventana (cielo, mar, arena, sol y palmera), como en la oficina SVG. */
export function playa() {
  return lienzo('playa', 512, 256, (ctx, w, h) => {
    const cielo = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    cielo.addColorStop(0, '#7cc8f0');
    cielo.addColorStop(1, '#d9f3ff');
    ctx.fillStyle = cielo;
    ctx.fillRect(0, 0, w, h * 0.55);
    ctx.fillStyle = '#22a6c0';
    ctx.fillRect(0, h * 0.55, w, h * 0.25);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    for (let i = 0; i < 6; i++) ctx.fillRect(40 + i * 80, h * 0.6 + (i % 2) * 14, 40, 3);
    ctx.fillStyle = '#f5d9a0';
    ctx.fillRect(0, h * 0.8, w, h * 0.2);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(w * 0.74, h * 0.22, 22, 0, Math.PI * 2);
    ctx.fill();
    // palmera
    ctx.strokeStyle = '#2e7d4f';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    const px = w * 0.22;
    const py = h * 0.86;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + 10, py - 70, px - 4, py - 130);
    ctx.stroke();
    for (const [dx, dy] of [[-60, 20], [60, 14], [-44, -26], [46, -24], [0, -40]]) {
      ctx.beginPath();
      ctx.moveTo(px - 4, py - 130);
      ctx.quadraticCurveTo(px - 4 + dx * 0.5, py - 130 + dy - 22, px - 4 + dx, py - 130 + dy);
      ctx.stroke();
    }
  });
}

/** Letrero de la marca (texto; el logo va como pieza aparte con la imagen original). */
export function letrero() {
  return lienzo('letrero', 1024, 256, (ctx, w, h) => {
    ctx.fillStyle = '#324966';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fcfcf7';
    ctx.font = `900 92px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VACILANDO ANDO', w * 0.58, h * 0.4);
    ctx.fillStyle = '#fde07e';
    ctx.font = `800 54px ${FUENTE}`;
    ctx.fillText('T O U R S  ✈', w * 0.58, h * 0.75);
  });
}

/** Pantalla del analista: barras y línea de tendencia (mismos valores que la oficina SVG). */
export function grafico() {
  return lienzo('grafico', 512, 224, (ctx, w, h) => {
    ctx.fillStyle = '#13202b';
    ctx.fillRect(0, 0, w, h);
    const barras = [0.9, 1.4, 1.1, 1.9, 1.6, 2.4];
    const colores = ['#22b8c4', '#ff8a6b', '#ffcc4d'];
    const base = h - 22;
    const paso = (w - 60) / barras.length;
    const puntos = [];
    barras.forEach((v, i) => {
      const alto = (v / 2.6) * (h - 80);
      const x = 36 + i * paso;
      ctx.fillStyle = colores[i % 3];
      ctx.fillRect(x, base - alto, paso * 0.55, alto);
      puntos.push([x + paso * 0.27, base - alto - 26]);
    });
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 5;
    ctx.beginPath();
    puntos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
}

/** Pantalla encendida genérica (monitor, portátil, tableta). */
export function pantalla(color = '#5ec8f2') {
  return lienzo(`pantalla:${color}`, 128, 96, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, color);
    g.addColorStop(1, '#1d2433');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i < 4; i++) {
      redondeado(ctx, 14, 16 + i * 18, 40 + ((i * 37) % 50), 7, 3);
      ctx.fill();
    }
  });
}

/** Texto genérico para depuración (etiquetas flotantes). El lienzo se ajusta al largo del texto. */
export function etiqueta(texto, fondo = 'rgba(29,36,51,.85)') {
  const medir = document.createElement('canvas').getContext('2d');
  medir.font = `700 40px ${FUENTE}`;
  const ancho = Math.ceil(medir.measureText(texto).width) + 48;
  const t = lienzo(`etq:${texto}:${fondo}`, ancho, 96, (ctx, w, h) => {
    ctx.fillStyle = fondo;
    redondeado(ctx, 0, 0, w, h, 20);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 40px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, w / 2, h / 2);
  });
  t.userData.aspecto = ancho / 96;
  return t;
}

export function liberarTexturas() {
  for (const t of cache.values()) t.dispose();
  cache.clear();
}
