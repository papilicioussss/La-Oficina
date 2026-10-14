// Prueba de concepto 3D de La Oficina (Etapa 1). Página independiente: no usa ni modifica nada de la app.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ajustarMateriales } from './materiales.js';
import { construirEscena } from './escena.js';

const $ = (id) => document.getElementById(id);
const lienzo = $('lienzo');

// ---------- Niveles de calidad ----------
const NIVELES = {
  alta: { nombre: 'Alta', pixeles: 2, sombra: 2048, barniz: true, entorno: true, sombras: true },
  media: { nombre: 'Media', pixeles: 1.5, sombra: 1024, barniz: false, entorno: true, sombras: true },
  baja: { nombre: 'Baja', pixeles: 1, sombra: 512, barniz: false, entorno: false, sombras: true },
};
const params = new URLSearchParams(location.search);
const esCelular = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;
const memoria = navigator.deviceMemory || 4;
const nucleos = navigator.hardwareConcurrency || 4;
let pedido = params.get('calidad') || 'auto';
let nivelActual = pedido !== 'auto' && NIVELES[pedido] ? pedido : esCelular || memoria <= 3 || nucleos <= 4 ? 'media' : 'alta';

// ---------- Renderizador ----------
function soportaWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
if (!soportaWebGL()) {
  $('sin-3d').hidden = false;
  throw new Error('WebGL no disponible');
}

const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: nivelActual !== 'baja', alpha: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; // conserva los colores saturados del plástico (ACES los apaga)
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const escena = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
const entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// ---------- Cámara y controles ----------
const camara = new THREE.PerspectiveCamera(32, 1, 0.5, 200);
const controles = new OrbitControls(camara, lienzo);
controles.enableDamping = true;
controles.dampingFactor = 0.08;
controles.minDistance = 7;
controles.maxDistance = 95;
controles.maxPolarAngle = Math.PI * 0.47; // no baja por debajo del piso
controles.target.set(0, 1.5, 0);
controles.autoRotateSpeed = 1.2;
function vistaIsometrica() {
  // en pantallas altas (celular vertical) se aleja más para que la plataforma quepa completa
  const aspecto = lienzo.clientWidth / Math.max(1, lienzo.clientHeight);
  const d = 34 * Math.max(1, 1.2 / aspecto);
  const az = Math.PI / 4;
  const el = Math.atan(1 / Math.SQRT2); // ángulo isométrico clásico (≈35°)
  camara.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
  controles.target.set(0, 1.5, 0);
  controles.update();
}
vistaIsometrica();
// el panel de controles empieza abierto en pantallas anchas y cerrado en celulares
$('panel').open = matchMedia('(min-width: 700px)').matches;

// ---------- Luces ----------
const sol = new THREE.DirectionalLight('#fff3dc', 1.9);
sol.position.set(-14, 22, 12);
sol.castShadow = true;
sol.shadow.camera.left = -16;
sol.shadow.camera.right = 16;
sol.shadow.camera.top = 16;
sol.shadow.camera.bottom = -16;
sol.shadow.camera.near = 5;
sol.shadow.camera.far = 70;
sol.shadow.bias = -0.0004;
sol.shadow.normalBias = 0.03;
sol.shadow.radius = 3;
escena.add(sol);
const cielo = new THREE.HemisphereLight('#dbe9ff', '#8a7a62', 0.35);
escena.add(cielo);

// ---------- Contenido ----------
const { mundo, modelos, cajas } = construirEscena();
escena.add(mundo);
// suelo que solo recibe sombra (la mesa sobre la que está la plataforma)
const suelo = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: 0.22 }));
suelo.rotation.x = -Math.PI / 2;
suelo.position.y = -0.001;
suelo.receiveShadow = true;
escena.add(suelo);

// ---------- Calidad adaptable ----------
function aplicarCalidad(clave) {
  nivelActual = clave;
  const n = NIVELES[clave];
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, n.pixeles));
  redimensionar();
  sol.shadow.mapSize.set(n.sombra, n.sombra);
  sol.shadow.map?.dispose();
  sol.shadow.map = null;
  escena.environment = n.entorno ? entorno : null;
  cielo.intensity = n.entorno ? 0.35 : 1.25; // sin reflejos de entorno se compensa con más luz ambiente
  ajustarMateriales(n);
  $('calidad').value = pedido === 'auto' ? 'auto' : clave;
  $('estado-calidad').textContent = `Calidad en uso: ${n.nombre}${pedido === 'auto' ? ' (automática)' : ''}`;
}
function redimensionar() {
  const w = lienzo.clientWidth;
  const h = lienzo.clientHeight;
  renderer.setSize(w, h, false);
  camara.aspect = w / h;
  camara.updateProjectionMatrix();
}
addEventListener('resize', redimensionar);
aplicarCalidad(nivelActual);

$('calidad').addEventListener('change', (e) => {
  pedido = e.target.value;
  aplicarCalidad(pedido === 'auto' ? (esCelular ? 'media' : 'alta') : pedido);
  medida.reinicia();
});
$('vista').addEventListener('click', vistaIsometrica);
$('girar').addEventListener('click', (e) => {
  controles.autoRotate = !controles.autoRotate;
  e.currentTarget.setAttribute('aria-pressed', controles.autoRotate);
});
// ---------- Animaciones de prueba ----------
// Nico recibe la animación elegida y Alex reacciona de forma coherente (escucha cuando Nico habla, devuelve el saludo...).
const NOMBRES = { idle: 'reposo', saludo: 'saludo', escucha: 'escucha atenta', talking: 'hablando', thinking: 'pensando', searching: 'buscando', walking: 'caminando' };
const ORDEN = Object.keys(NOMBRES);
const [nico, alex] = modelos;
const posCabeza = (m) => m.objeto.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 3.3, 0));
mundo.updateMatrixWorld(true);
let temporizadores = [];
function aplicarAnimacion(clave) {
  temporizadores.forEach(clearTimeout);
  temporizadores = [];
  const reaccion = { talking: 'escucha', escucha: 'talking', saludo: 'saludo' }[clave] || 'idle';
  nico.estado = clave;
  // Alex responde un instante después (si no, los dos se moverían exactamente a la vez)
  temporizadores.push(setTimeout(() => (alex.estado = reaccion), reaccion === 'idle' ? 0 : clave === 'saludo' ? 1100 : 500));
  const mira = ['talking', 'escucha', 'saludo'].includes(clave);
  nico.mirarA(mira ? posCabeza(alex) : null);
  alex.mirarA(mira && reaccion !== 'idle' ? posCabeza(nico) : null);
  $('animacion').value = clave;
  $('estado').textContent = `Animación de prueba: ${NOMBRES[clave]}`;
}
$('animacion').addEventListener('change', (e) => aplicarAnimacion(e.target.value));
$('estado').addEventListener('click', () => aplicarAnimacion(ORDEN[(ORDEN.indexOf($('animacion').value) + 1) % ORDEN.length]));
$('reposo').addEventListener('click', () => aplicarAnimacion('idle'));

// ---------- Cámara hacia las manos ----------
let tween = null;
function volarA(posicion, objetivo, ms = 900) {
  tween = { desde: camara.position.clone(), hasta: posicion, tDesde: controles.target.clone(), tHasta: objetivo, ini: performance.now(), ms };
}
$('manos').addEventListener('click', () => {
  // la mano derecha de Nico, vista un poco desde arriba y de frente
  const m = nico.manoDer.getWorldPosition(new THREE.Vector3());
  aplicarAnimacion('talking'); // la mano se mueve al hablar, así se ve su forma desde varios ángulos
  const dir = new THREE.Vector3(0.6, 0.35, 1).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  volarA(m.clone().addScaledVector(dir, 5.2), m, 900);
});
function pasoTween(ahora) {
  if (!tween) return;
  const k = Math.min(1, (ahora - tween.ini) / tween.ms);
  const e = k * k * (3 - 2 * k);
  camara.position.lerpVectors(tween.desde, tween.hasta, e);
  controles.target.lerpVectors(tween.tDesde, tween.tHasta, e);
  if (k >= 1) tween = null;
}
// cualquier gesto del usuario sobre la cámara cancela el vuelo automático
lienzo.addEventListener('pointerdown', () => (tween = null));
lienzo.addEventListener('wheel', () => (tween = null), { passive: true });

// ---------- Medidor de rendimiento y bajada automática de calidad ----------
const medida = {
  cuadros: 0,
  desde: performance.now(),
  fps: 0,
  malos: 0,
  reinicia() {
    this.cuadros = 0;
    this.desde = performance.now();
    this.malos = 0;
  },
  tick(ahora) {
    this.cuadros++;
    const dt = ahora - this.desde;
    if (dt < 1000) return;
    this.fps = (this.cuadros * 1000) / dt;
    this.cuadros = 0;
    this.desde = ahora;
    $('fps').textContent = `${this.fps.toFixed(0)} fps · ${renderer.info.render.calls} dibujos · ${(renderer.info.render.triangles / 1000).toFixed(0)}k triángulos`;
    // en automático: si va lento varios segundos seguidos, baja un nivel
    if (pedido === 'auto' && !document.hidden) {
      this.malos = this.fps < 26 ? this.malos + 1 : 0;
      if (this.malos >= 3 && nivelActual !== 'baja') {
        aplicarCalidad(nivelActual === 'alta' ? 'media' : 'baja');
        this.malos = 0;
      }
    }
  },
};

// ---------- Bucle ----------
const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reducido) modelos.forEach((m) => m.reposo());
const pruebas = { pausa: false }; // solo para pruebas automáticas
let ultimo = performance.now();
let tiempo = 0;
function bucle(ahora) {
  const dt = Math.min(0.1, (ahora - ultimo) / 1000);
  ultimo = ahora;
  tiempo += dt;
  const t = tiempo;
  if (!reducido && !pruebas.pausa) {
    for (const m of modelos) {
      // una animación de una sola vez (saludo) avisa cuando termina y el personaje vuelve al reposo
      if (m.animar(m.estado, t, dt) && m.estado === 'saludo') {
        m.estado = 'idle';
        m.mirarA(null);
        if (m === nico) aplicarAnimacion('idle');
      }
    }
  }
  pasoTween(ahora);
  controles.update();
  renderer.render(escena, camara);
  medida.tick(ahora);
  requestAnimationFrame(bucle);
}
requestAnimationFrame(bucle);
$('resumen').textContent = `${cajas} ladrillos en la escena`;
document.body.dataset.listo = '1';

// gancho solo para pruebas automáticas
window.__prueba3d = {
  renderer, escena, camara, controles, modelos, aplicarAnimacion,
  // avanza la animación 'seg' segundos de golpe (el navegador de pruebas dibuja muy lento por software)
  avanzar(seg) {
    pruebas.pausa = true;
    for (let s = 0; s < seg; s += 0.04) {
      tiempo += 0.04;
      for (const m of modelos) if (m.animar(m.estado, tiempo, 0.04) && m.estado === 'saludo') m.estado = 'idle';
    }
  },
};
