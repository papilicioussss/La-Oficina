// Oficina 3D (Etapa 2): estructura de las cinco salas con piezas LEGO por código.
// Página independiente: no importa ni modifica nada de la aplicación principal (la oficina SVG sigue igual).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ajustarMateriales } from './materiales.js';
import { detalleTaquitos } from './ladrillos.js';
import './componentes/muebles.js'; // registra los modelos provisionales
import { construirSuelos } from './componentes/suelos.js';
import { construirParedes, actualizarParedes } from './componentes/paredes.js';
import { decorar } from './componentes/decoracion.js';
import { construirSalas } from './salas.js';
import { crearCamara, LIMITES, CENTRO } from './camara.js';
import { NIVELES, nivelInicial, CalidadAutomatica } from './calidad.js';
import { construirDepuracion } from './depuracion.js';
import { crearAgentes } from './agentes.js';
import { crearFuente } from './fuente-estados.js';
import { crearSimulador } from './simulador.js';
import { crearEtiquetas } from './etiquetas.js';
import { estampado } from './materiales.js';
import { grafico } from './texturas.js';
import { SALAS } from './plano.js';

const $ = (id) => document.getElementById(id);
const lienzo = $('lienzo');
const params = new URLSearchParams(location.search);
const depurar = params.get('depurar') === '1';
const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;

function soportaWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function fallar(titulo, detalle) {
  window.avisoOficina3d?.(titulo, detalle);
  window.oficina3d = { error: titulo };
}

try {
  if (!soportaWebGL()) throw Object.assign(new Error('sin WebGL'), { aviso: ['Este navegador no puede mostrar la oficina en 3D (WebGL no está disponible).', 'Puedes seguir usando la oficina de siempre.'] });
  iniciar();
} catch (e) {
  console.error(e);
  const [t, d] = e.aviso || ['No se pudo iniciar la oficina 3D.', 'Puedes seguir usando la oficina de siempre.'];
  fallar(t, d);
}

function iniciar() {
  // ---------- Calidad ----------
  let pedido = NIVELES[params.get('calidad')] ? params.get('calidad') : 'auto';
  let nivel = pedido === 'auto' ? nivelInicial() : pedido;

  // ---------- Renderizador ----------
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: NIVELES[nivel].antialias, alpha: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // con `radius` según la calidad (PCFSoft ya no existe en r186)
  renderer.shadowMap.autoUpdate = false; // la escena es fija: las sombras se recalculan solo cuando algo cambia
  renderer.toneMapping = THREE.NeutralToneMapping; // conserva los colores saturados del plástico
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  lienzo.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    fallar('La oficina 3D se detuvo (el navegador liberó la memoria gráfica).', 'Recarga la página para volver a intentarlo, o usa la oficina de siempre.');
  });

  const escena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  // ---------- Luces: sol cálido con sombras suaves y cielo ----------
  const sol = new THREE.DirectionalLight('#fff3dc', 2.0);
  sol.position.set(CENTRO.x - 34, 70, CENTRO.z - 10);
  sol.target.position.copy(CENTRO).setY(0);
  sol.castShadow = true;
  const s = sol.shadow.camera;
  s.left = -52;
  s.right = 52;
  s.top = 52;
  s.bottom = -52;
  s.near = 10;
  s.far = 160;
  sol.shadow.bias = -0.0005;
  sol.shadow.normalBias = 0.04;
  escena.add(sol, sol.target);
  const cielo = new THREE.HemisphereLight('#dbe9ff', '#8a7a62', 0.45);
  escena.add(cielo);

  // ---------- Contenido ----------
  const finos = NIVELES[nivel].taquitosFinos;
  const t0 = performance.now();
  const suelos = construirSuelos({ finos });
  const paredes = construirParedes({ finos });
  decorar(paredes);
  const { grupo: grupoSalas, salas } = construirSalas();
  escena.add(suelos, paredes.grupo, grupoSalas);
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.16 }));
  piso.rotation.x = -Math.PI / 2;
  piso.position.y = -1.62;
  piso.receiveShadow = true;
  escena.add(piso);
  // Personajes: leen los estados SOLO a través de la fuente. En esta etapa la alimenta el simulador (prueba);
  // en la fase 6 la alimentará la app real.
  const fuente = crearFuente();
  const simulador = crearSimulador(fuente);
  const etiquetas = crearEtiquetas(document.body);
  // pantalla del analista en la pared: brilla mientras Alex trabaja de verdad (como .analista-working del SVG)
  const pantallaAlex = estampado('grafico', grafico(), { brillo: true });
  pantallaAlex.emissive.set('#ffffff');
  pantallaAlex.emissiveMap = pantallaAlex.map;
  pantallaAlex.emissiveIntensity = 0;
  pantallaAlex.needsUpdate = true;
  let alexTrabaja = false;
  const agentes = crearAgentes(escena, {
    fuente,
    etiquetas,
    reducido,
    liviana: !NIVELES[nivel].taquitosFinos,
    alCambiarAnalista: (si) => (alexTrabaja = si),
  });
  const depuracion = depurar ? construirDepuracion() : null;
  if (depuracion) escena.add(depuracion);
  const msConstruir = performance.now() - t0;

  // ---------- Cámara ----------
  const cam = crearCamara(lienzo);
  const { camara, controles } = cam;
  if (reducido) controles.enableDamping = false;

  // ---------- Dibujo bajo demanda ----------
  let sucio = true;
  let sombras = true;
  const pedirDibujo = (conSombras = false) => {
    sucio = true;
    if (conSombras) sombras = true;
  };
  controles.addEventListener('change', () => pedirDibujo());
  addEventListener('oficina3d:textura', () => pedirDibujo());

  function redimensionar() {
    const w = lienzo.clientWidth;
    const h = lienzo.clientHeight;
    renderer.setSize(w, h, false);
    camara.aspect = w / Math.max(1, h);
    camara.updateProjectionMatrix();
    cam?.alRedimensionar();
    pedirDibujo();
  }

  function aplicarCalidad(clave) {
    nivel = clave;
    const n = NIVELES[clave];
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, n.pixeles));
    sol.shadow.mapSize.set(n.sombra, n.sombra);
    sol.shadow.radius = n.sombraSuave;
    sol.shadow.map?.dispose();
    sol.shadow.map = null;
    escena.environment = n.entorno ? entorno : null;
    cielo.intensity = n.entorno ? 0.45 : 1.3; // sin reflejos de entorno se compensa con luz de cielo
    ajustarMateriales(n);
    detalleTaquitos(n.taquitosFinos);
    // minifigura fina en Alta, liviana en Media y Baja; las sombras reales de los personajes solo en Alta y si se piden
    agentes.cambiarDetalle(!n.taquitosFinos, sombrasPersonajes && clave === 'alta');
    $('sombras-reales').disabled = clave !== 'alta';
    $('calidad').value = pedido === 'auto' ? 'auto' : clave;
    $('estado-calidad').textContent = `Calidad: ${n.nombre}${pedido === 'auto' ? ' (automática)' : ''}`;
    redimensionar();
    pedirDibujo(true);
  }

  // Sombras de los personajes: de contacto por defecto; reales (mapa de sombras recalculado al moverse) solo en Alta
  let sombrasPersonajes = params.get('sombras') === 'reales';
  $('sombras-reales').checked = sombrasPersonajes;
  $('sombras-reales').addEventListener('change', (e) => {
    sombrasPersonajes = e.target.checked;
    aplicarCalidad(nivel);
  });

  const auto = new CalidadAutomatica({ alBajar: (clave) => aplicarCalidad(clave) });
  auto.activa = pedido === 'auto';

  // ---------- Interfaz ----------
  $('panel').open = matchMedia('(min-width: 900px) and (min-height: 600px)').matches; // en celulares empieza cerrado
  for (const [id, info] of Object.entries(SALAS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = info.nombre;
    b.addEventListener('click', () => {
      cam.enfocar(salas[id], reducido ? 0 : 700);
      agentes.seleccionar(agentes.agentes[id] ? id : null);
    });
    $('salas').append(b);
  }
  $('general').addEventListener('click', () => {
    cam.vistaGeneral(reducido ? 0 : 700);
    agentes.seleccionar(null);
  });
  // Tocar un personaje: se selecciona y se enfoca su oficina (en la app, tocar un agente abre su oficina)
  const rayo = new THREE.Raycaster();
  const puntero = new THREE.Vector2();
  let inicioToque = null;
  lienzo.addEventListener('pointerdown', (e) => (inicioToque = [e.clientX, e.clientY]));
  lienzo.addEventListener('pointerup', (e) => {
    if (!inicioToque || Math.hypot(e.clientX - inicioToque[0], e.clientY - inicioToque[1]) > 8) return;
    const r = lienzo.getBoundingClientRect();
    puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(puntero, camara);
    const hit = rayo.intersectObject(agentes.grupo, true).find((h) => h.object.visible);
    let o = hit?.object;
    while (o && !o.name?.startsWith('agente:')) o = o.parent;
    if (o) {
      const id = o.name.slice(7);
      agentes.seleccionar(id);
      if (agentes.agentes[id].ubicacion === 'office') cam.enfocar(salas[id], reducido ? 0 : 700);
    }
  });
  // Panel del simulador (solo con ?simular=1): herramienta de prueba, reproduce las secuencias reales de la app
  if (params.get('simular') === '1') {
    $('simulador').hidden = false;
    const acciones = {
      'Nico responde': () => simulador.responder('copy'),
      'Alex busca y responde': () => simulador.responder('analista', { buscar: true }),
      'Sam responde con error': () => simulador.responder('guion', { final: 'error' }),
      'Nico: detener respuesta': () => simulador.responder('copy', { final: 'detener', pensar: 3000 }),
      'Los tres a la vez': () => (simulador.responder('copy'), simulador.responder('analista', { buscar: true }), simulador.responder('guion')),
      'Reunión': () => simulador.reunion(),
      'Reunión con investigación': () => simulador.reunion({ investigar: true }),
      'Armar el plan': () => simulador.reunion({ plan: true }),
      'Terminar reunión': () => simulador.terminarReunion(),
    };
    for (const [texto, fn] of Object.entries(acciones)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = texto;
      b.addEventListener('click', () => {
        despertar();
        fn();
      });
      $('simulador-botones').append(b);
    }
  }
  $('calidad').addEventListener('change', (e) => {
    pedido = e.target.value;
    auto.activa = pedido === 'auto';
    auto.reinicia();
    aplicarCalidad(pedido === 'auto' ? nivelInicial() : pedido);
  });
  const enlace = $('enlace-depurar');
  enlace.href = depurar ? '?' : '?depurar=1';
  enlace.textContent = depurar ? 'Ocultar herramientas de depuración' : 'Ver herramientas de depuración';
  addEventListener('resize', redimensionar);

  aplicarCalidad(nivel);
  cam.vistaGeneral(0);
  actualizarParedes(paredes.paredes, camara, controles.target, 0, { inmediato: true });

  // ---------- Bucle ----------
  let ultimo = performance.now();
  let interactuando = false;
  let actividad = performance.now(); // último momento con algo pasando (gesto, cámara o trabajo de un agente)
  let acumulado = 0;
  let ocupados = false;
  let pasoManual = false; // solo pruebas: la animación la avanza la prueba (navegador sin GPU con cuadros lentos)
  const PAUSA_MS = 20000;
  const despertar = () => (actividad = performance.now());
  for (const ev of ['pointerdown', 'wheel', 'keydown', 'touchstart']) addEventListener(ev, despertar, { passive: true });
  let cuadrosPared = 0;
  lienzo.addEventListener('pointerdown', () => (interactuando = true));
  addEventListener('pointerup', () => (interactuando = false));
  const fps = $('fps');
  function bucle(ahora) {
    const dt = ahora - ultimo;
    ultimo = ahora;
    if (cam.actualizar(ahora)) {
      sucio = true;
      actividad = ahora;
    }
    // Ritmo de los personajes (batería y calor del celular):
    //  - si alguno está haciendo algo real (trabaja, camina, habla, se sienta) o el usuario mueve la cámara: cada cuadro;
    //  - si solo respiran y parpadean: como máximo 30 cuadros por segundo;
    //  - tras 20 s sin actividad: se detienen hasta el próximo cambio de estado o gesto del usuario.
    acumulado += dt;
    ocupados = agentes.ocupados() || alexTrabaja || pantallaAlex.emissiveIntensity > 0;
    if (ocupados) actividad = ahora;
    const quieto = ahora - actividad > PAUSA_MS;
    if (pasoManual) acumulado = 0;
    else if (!quieto && (ocupados || interactuando || cam.tween.activo || acumulado >= 1000 / 30)) {
      const paso = Math.min(1, acumulado / 1000);
      agentes.actualizar(paso);
      if (agentes.detalle().sombrasReales) sombras = true; // la sombra real del personaje se recalcula al moverse
      // brillo de la pantalla de Alex: sube mientras trabaja y se apaga al terminar
      const meta = alexTrabaja ? 0.25 + (reducido ? 0 : 0.12 * Math.sin(ahora / 260)) : 0;
      pantallaAlex.emissiveIntensity += (meta - pantallaAlex.emissiveIntensity) * Math.min(1, Math.min(0.1, paso) * 8);
      if (!alexTrabaja && pantallaAlex.emissiveIntensity < 0.005) pantallaAlex.emissiveIntensity = 0;
      acumulado = 0;
      sucio = true;
    } else if (quieto) acumulado = 0;
    if (actualizarParedes(paredes.paredes, camara, controles.target, Math.min(0.05, dt / 1000), { inmediato: reducido })) {
      sucio = true;
      // mientras una pared sube o baja, sus sombras cambian: en Alta cada cuadro, en el resto uno de cada tres
      if (nivel === 'alta' || ++cuadrosPared % 3 === 0) sombras = true;
    } else if (cuadrosPared) {
      cuadrosPared = 0;
      sombras = true;
    }
    if (sucio && !document.hidden) {
      if (sombras) renderer.shadowMap.needsUpdate = true;
      renderer.render(escena, camara);
      etiquetas.colocar(camara, lienzo.clientWidth, lienzo.clientHeight, posEtiqueta);
      ultima.calls = renderer.info.render.calls;
      ultima.triangulos = renderer.info.render.triangles;
      ultima.conSombras = sombras;
      sucio = false;
      sombras = false;
      // la calidad automática mide mientras se mueve la cámara o algún personaje hace algo real
      if (interactuando || cam.tween.activo || ocupados) {
        auto.cuadro(dt, nivel);
        if (auto.fps) fps.textContent = `${auto.fps.toFixed(0)} fps`;
      }
      if (!ultima.conSombras) resumen();
    }
    requestAnimationFrame(bucle);
  }
  const ultima = { calls: 0, triangulos: 0, conSombras: false };
  function posEtiqueta(id, v) {
    agentes.cabezaDe(id, v);
    v.y += 2.2;
  }
  function resumen() {
    $('resumen').textContent = `${ultima.calls} dibujos · ${(ultima.triangulos / 1000).toFixed(0)} mil triángulos por cuadro`;
  }
  requestAnimationFrame(bucle);
  $('cargando').hidden = true;
  document.body.dataset.listo = '1';

  // ---------- Gancho para pruebas automáticas y depuración ----------
  window.oficina3d = {
    THREE,
    renderer,
    escena,
    camara,
    controles,
    salas,
    paredes,
    agentes,
    fuente,
    simulador,
    etiquetas,
    pantallaAlex,
    suelos,
    limites: LIMITES,
    msConstruir,
    nivel: () => nivel,
    pedido: () => pedido,
    sombrasReales(si) {
      sombrasPersonajes = si;
      aplicarCalidad(nivel);
    },
    aplicarCalidad: (clave) => {
      pedido = clave;
      auto.activa = false;
      aplicarCalidad(clave);
    },
    enfocar: (id, ms = 0) => cam.enfocar(salas[id], ms),
    vistaGeneral: (ms = 0) => cam.vistaGeneral(ms),
    /** Gira la cámara alrededor del objetivo (radianes) sin animación. */
    girar(azimut, elevacion) {
      const d = camara.position.distanceTo(controles.target);
      cam.volar(cam.posicionDesde(controles.target, d, azimut, elevacion), controles.target.clone(), 0);
      actualizarParedes(paredes.paredes, camara, controles.target, 0, { inmediato: true });
      pedirDibujo(true);
    },
    /** Dibuja ya y devuelve las métricas del cuadro (con o sin cálculo de sombras). */
    medir({ conSombras = false } = {}) {
      if (conSombras) renderer.shadowMap.needsUpdate = true;
      renderer.render(escena, camara);
      return { calls: renderer.info.render.calls, triangulos: renderer.info.render.triangles, geometrias: renderer.info.memory.geometries, texturas: renderer.info.memory.textures };
    },
    ultima,
    auto,
    despertar,
    /** Solo pruebas: detiene el avance automático de los personajes; la prueba llama a `avanzar(dt)`. */
    pasoManual: (si) => (pasoManual = si),
    avanzar(dt) {
      agentes.actualizar(dt);
      const meta = alexTrabaja ? 0.25 : 0;
      pantallaAlex.emissiveIntensity += (meta - pantallaAlex.emissiveIntensity) * Math.min(1, dt * 8);
      if (!alexTrabaja && pantallaAlex.emissiveIntensity < 0.005) pantallaAlex.emissiveIntensity = 0;
      sucio = true;
    },
    pausado: () => performance.now() - actividad > PAUSA_MS,
  };
}
