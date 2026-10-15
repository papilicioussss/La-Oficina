// Agentes 3D: minifiguras que REFLEJAN los estados reales de la app (a través de fuente-estados.js).
// No inventan estados ni los cambian: solo leen runtime.status, runtime.location, los eventos 'status' y 'chat', y el
// último mensaje del chat, y repiten las reglas visuales de la oficina SVG (js/office.js):
//
//   Estado real                         Animación 3D                        Globo
//   idle (en su oficina)                sentado, respira y mira             —
//   thinking sin texto llegando          teclea pausado                      Pensando…
//   thinking con texto llegando          teclea rápido (700 ms tras cada     Escribiendo…
//                                        trozo de texto real, como office.js)
//   searching                            mira pantallas y señala             Buscando en la web…
//   pasa de thinking/searching a idle/   gesto "terminado" 1,7 s (la clase    —
//   meeting y la respuesta salió bien    .done del SVG). Con error, nada.
//   location cambia                      se levanta, camina, se sienta        oculto (como .walking)
//   meeting                              sentado, escucha a quien habla       oculto (como en el SVG)
//   talking                              habla mirando a los demás            Hablando…
//
// Señales del kit (como en el SVG): bombillo de Nico al pensar, lupa de Alex al buscar, ✓ de Sam al terminar.
import * as THREE from 'three';
import './personajes/minifigura.js'; // registra el modelo 'minifigura'
import './personajes/nico.js'; // registra el modelo 'nico' (Nico en alta calidad, con su utilería)
import { crearModelo } from './registro.js';
import { aparienciaAgentes } from './personajes/apariencia.js';
import { lienzo } from './texturas.js';
import { AGENT_IDS, SEATS, MEET, STATUS_LABEL, aMundo, duracionCaminata, recorrido3D } from './plano.js';

const SEMILLAS = { copy: 3, analista: 11, guion: 7 };
// Modelo de cada agente: Nico tiene su modelo propio; los demás, la minifigura general.
const MODELOS = { copy: 'nico' };
const ESCRIBIENDO_MS = 700; // igual que office.js
const SENTARSE_S = 0.4; // se levanta al empezar a caminar y se sienta al llegar, dentro del tiempo del SVG

/** Sombra de contacto: disco suave bajo el personaje (no usa el mapa de sombras: no hay que recalcularlo). */
function sombraContacto() {
  const tex = lienzo('sombra-contacto', 128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(40,28,10,0.42)');
    g.addColorStop(0.55, 'rgba(40,28,10,0.2)');
    g.addColorStop(1, 'rgba(40,28,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.03;
  m.scale.set(3.2, 2.6, 1);
  m.renderOrder = 1;
  m.name = 'sombra-contacto';
  return m;
}

/** Anillo de selección bajo el agente de la sala abierta (como .is-selected del SVG). */
function anillo() {
  const m = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.05, 40), new THREE.MeshBasicMaterial({ color: '#00b9ec', transparent: true, opacity: 0.85, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.05;
  m.visible = false;
  m.name = 'anillo';
  return m;
}

const angulo = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Perfil de velocidad trapezoidal: acelera en el primer 18 % del tiempo y frena en el último 18 %.
const RAMPA = 0.18;
const VMAX = 1 / (1 - RAMPA);
function rampa(k) {
  if (k < RAMPA) return (VMAX * k * k) / (2 * RAMPA);
  if (k > 1 - RAMPA) return 1 - (VMAX * (1 - k) ** 2) / (2 * RAMPA);
  return VMAX * (k - RAMPA / 2);
}
const rampaVel = (k) => VMAX * Math.min(1, k / RAMPA, (1 - k) / RAMPA);

export function crearAgentes(escena, { fuente, liviana = false, sombrasReales = false, reducido = false, alCambiarAnalista, etiquetas } = {}) {
  const grupo = new THREE.Group();
  grupo.name = 'agentes';
  escena.add(grupo);
  const apariencia = aparienciaAgentes();
  const agentes = {};
  let seleccionado = null;

  function construir(id, a) {
    const modelo = crearModelo(MODELOS[id] || 'minifigura', { look: apariencia[id].look, liviana, semilla: SEMILLAS[id] });
    const fig = modelo.objeto.children[0].userData.personaje;
    modelo.objeto.traverse((o) => {
      if (o.isMesh) o.castShadow = sombrasReales;
    });
    a.fig = fig;
    a.modelo = modelo;
    a.contenedor.add(modelo.objeto);
  }

  for (const id of AGENT_IDS) {
    const contenedor = new THREE.Group();
    contenedor.name = `agente:${id}`;
    const p = aMundo(fuente.runtime.location[id] === 'meeting' ? MEET[id] : SEATS[id]);
    contenedor.position.set(p.x, 0, p.z);
    const a = {
      id,
      nombre: apariencia[id].name,
      look: apariencia[id].look,
      contenedor,
      sombra: sombraContacto(),
      anillo: anillo(),
      fig: null,
      anim: 'idle',
      ubicacion: fuente.runtime.location[id], // dónde está dibujado (o hacia dónde camina)
      cola: [], // caminatas pendientes (como la cola de moveAgent)
      camino: null,
      escribiendo: false,
      escribiendoHasta: 0,
      largoTexto: 0,
      terminando: false,
      estadoPrevio: fuente.runtime.status[id],
      giro: 0,
    };
    contenedor.add(a.sombra, a.anillo);
    grupo.add(contenedor);
    construir(id, a);
    a.fig.sentar(true, true);
    agentes[id] = a;
    etiquetas?.agregar(id, a.nombre, a.look.shirt);
  }

  // ─── Reglas de estado (copiadas de los manejadores de 'status' y 'chat' de js/office.js) ──────────────────
  const ultimo = (id) => fuente.chat(id).at(-1);
  const desuscribir = [
    fuente.on('status', ({ id, status }) => {
      const a = agentes[id];
      if (!a) return;
      if (status === 'thinking') {
        const l = ultimo(id);
        a.largoTexto = l?.role === 'model' ? l.text?.length || 0 : 0;
      }
      if (status !== 'thinking') a.escribiendo = false;
      // si empieza un trabajo real mientras se ve el gesto de terminado, manda el trabajo (no se tapa un estado real)
      if (status === 'thinking' || status === 'searching' || status === 'talking') a.terminando = false;
      const antes = a.estadoPrevio;
      a.estadoPrevio = status;
      if ((antes === 'thinking' || antes === 'searching') && (status === 'idle' || status === 'meeting')) {
        const l = ultimo(id);
        const fallo = status === 'idle' && (!l || l.role !== 'model' || l.error || !l.text);
        if (!fallo) a.terminando = true;
      }
      if (id === 'analista') alCambiarAnalista?.(status === 'thinking' || status === 'searching');
    }),
    fuente.on('chat', ({ agentId, type }) => {
      const a = agentes[agentId];
      if (!a || type !== 'update') return;
      const len = ultimo(agentId)?.text?.length || 0;
      if (len > a.largoTexto) {
        a.escribiendo = true;
        a.escribiendoHasta = performance.now() + ESCRIBIENDO_MS;
      }
      a.largoTexto = len;
    }),
  ];

  // ─── Caminatas ────────────────────────────────────────────────────────────────────────────────────────────
  function empezarCaminata(a, hacia) {
    const puntos = recorrido3D(a.id, hacia).map((p) => {
      const w = aMundo(p);
      return new THREE.Vector3(w.x, 0, w.z);
    });
    const largos = puntos.slice(1).map((p, i) => p.distanceTo(puntos[i]));
    const total = largos.reduce((s, x) => s + x, 0);
    a.ubicacion = hacia;
    if (reducido) {
      // movimiento reducido: sin caminata, aparece en su lugar (como el SVG)
      a.contenedor.position.copy(puntos.at(-1));
      a.giro = 0;
      a.contenedor.rotation.y = 0;
      a.fig.sentar(true, true);
      return;
    }
    // la duración TOTAL es la del SVG: el recorrido 3D (con sus puntos de paso) se reparte en ese mismo tiempo
    a.camino = { puntos, largos, total, ms: duracionCaminata(a.id, hacia), t: 0, hacia };
    a.fig.sentar(false);
  }

  function siguienteCaminata(a) {
    while (!a.camino && a.cola.length) {
      const hacia = a.cola.shift();
      if (hacia !== a.ubicacion) empezarCaminata(a, hacia);
    }
  }

  function avanzarCaminata(a, dt) {
    const c = a.camino;
    c.t += dt * 1000;
    const k = Math.min(1, c.t / c.ms);
    // con suavizarCaminata (Nico) arranca y frena con rampa; la duración total es la misma del SVG
    const pk = a.fig.suavizarCaminata ? rampa(k) : k;
    if ('velocidad' in a.fig) a.fig.velocidad = (c.total / (c.ms / 1000)) * (a.fig.suavizarCaminata ? rampaVel(k) : 1) * (k < 1 ? 1 : 0);
    let d = pk * c.total;
    let i = 0;
    while (i < c.largos.length - 1 && d > c.largos[i]) d -= c.largos[i++];
    const p0 = c.puntos[i];
    const p1 = c.puntos[i + 1];
    const f = c.largos[i] ? Math.min(1, d / c.largos[i]) : 1;
    a.contenedor.position.lerpVectors(p0, p1, f);
    // mira hacia donde camina; al final, al escritorio o a la mesa (+z)
    const restante = (1 - k) * (c.ms / 1000);
    const meta = restante < SENTARSE_S ? 0 : Math.atan2(p1.x - p0.x, p1.z - p0.z);
    a.giro += angulo(meta - a.giro) * (1 - Math.exp(-dt * 10));
    a.contenedor.rotation.y = a.giro;
    if (restante < SENTARSE_S) a.fig.sentar(true);
    if (k >= 1) {
      a.contenedor.position.copy(c.puntos.at(-1));
      a.giro = 0;
      a.contenedor.rotation.y = 0;
      a.camino = null;
    }
  }

  // ─── Cuadro a cuadro ─────────────────────────────────────────────────────────────────────────────────────
  let t = 0;
  const cabezaTmp = new THREE.Vector3();
  const centroTmp = new THREE.Vector3();

  function animacionDe(a) {
    const st = fuente.runtime.status[a.id];
    if (a.camino) return 'walking';
    if (a.terminando) return 'terminado';
    if (st === 'thinking') return 'thinking';
    if (st === 'searching') return 'searching';
    if (st === 'talking') return 'talking';
    if (st === 'meeting') return AGENT_IDS.some((k) => k !== a.id && fuente.runtime.status[k] === 'talking' && agentes[k].ubicacion === 'meeting' && !agentes[k].camino) ? 'escucha' : 'idle';
    return 'idle';
  }

  function cabezaDe(id, v) {
    return agentes[id].fig.cabeza.getWorldPosition(v);
  }

  /**
   * Avanza todo (el ritmo lo decide main.js). `dtReal` en segundos, tal cual pasó (hasta 1 s): las caminatas lo usan
   * completo para durar lo mismo que en el SVG aunque haya cuadros lentos; las posturas usan un paso recortado.
   */
  function actualizar(dtReal) {
    const ahora = performance.now();
    const dt = Math.min(0.1, dtReal);
    t += dt;
    for (const a of Object.values(agentes)) {
      // ubicación real: si cambió, se encola la caminata (moveAgent la cambia al empezar a caminar)
      const real = fuente.runtime.location[a.id];
      const destino = a.cola.length ? a.cola.at(-1) : a.ubicacion;
      if (real !== destino) a.cola.push(real);
      siguienteCaminata(a);
      if (a.camino) {
        avanzarCaminata(a, Math.min(1, dtReal));
        siguienteCaminata(a); // la caminata encolada empieza apenas termina la anterior (como la cadena de moveAgent)
      }
      if (a.escribiendo && ahora > a.escribiendoHasta) a.escribiendo = false;
      a.anim = animacionDe(a);
      a.fig.ritmoTecleo = a.escribiendo ? 1 : 0;
      // mirada: quien habla mira al centro de los demás; quien escucha mira a quien habla
      if (a.anim === 'talking' && a.ubicacion === 'meeting') {
        centroTmp.set(0, 0, 0);
        let n = 0;
        for (const k of AGENT_IDS) {
          if (k !== a.id && agentes[k].ubicacion === 'meeting') {
            centroTmp.add(cabezaDe(k, cabezaTmp));
            n++;
          }
        }
        a.fig.mirarA(n ? centroTmp.divideScalar(n) : null);
      } else if (a.anim === 'escucha') {
        const habla = AGENT_IDS.find((k) => k !== a.id && fuente.runtime.status[k] === 'talking');
        a.fig.mirarA(habla ? cabezaDe(habla, cabezaTmp) : null);
      } else a.fig.mirarA(null);
      const tt = reducido ? 0 : t; // movimiento reducido: posturas quietas (sin oscilar); el estado se ve igual
      if (a.fig.animar(a.anim, tt, reducido ? 1 : dt) && a.anim === 'terminado') a.terminando = false;
      if (reducido && a.anim === 'terminado') a.terminando = false;
      // señal del kit
      const st = fuente.runtime.status[a.id];
      const kit = a.look.kit;
      const senal = (kit === 'copy' && st === 'thinking') || (kit === 'analista' && st === 'searching') || (kit === 'guion' && a.anim === 'terminado');
      a.fig.senal.visible = senal;
      if (senal) a.fig.senal.position.y = 6.4 + (reducido ? 0 : Math.sin(t * 3) * 0.12);
      // globo (texto exacto de la app); oculto al caminar y en reunión sin hablar, como en el SVG
      let texto = st === 'thinking' && a.escribiendo ? 'Escribiendo…' : STATUS_LABEL[st] || '';
      if (a.camino || st === 'meeting') texto = '';
      etiquetas?.globo(a.id, texto);
    }
  }

  /** ¿Alguno hace algo más que respirar? Entonces se anima cada cuadro (main.js). */
  function ocupados() {
    for (const a of Object.values(agentes)) {
      if (a.camino || a.cola.length || a.terminando || a.escribiendo || a.anim !== 'idle') return true;
      const st = fuente.runtime.status[a.id];
      if (st !== 'idle' && st !== 'meeting') return true;
      if (fuente.runtime.location[a.id] !== a.ubicacion) return true;
      if (Math.abs(a.fig.sentado() - 1) > 0.01) return true;
    }
    return false;
  }

  function seleccionar(id) {
    seleccionado = id;
    for (const a of Object.values(agentes)) a.anillo.visible = a.id === id;
    etiquetas?.seleccionar(id);
  }

  /** Cambia el detalle (fina en Alta, liviana en Media y Baja) reconstruyendo solo las minifiguras. */
  function cambiarDetalle(nuevaLiviana, nuevasSombras = sombrasReales) {
    if (nuevaLiviana === liviana && nuevasSombras === sombrasReales) return;
    liviana = nuevaLiviana;
    sombrasReales = nuevasSombras;
    for (const [id, a] of Object.entries(agentes)) {
      const sentado = a.fig.sentado() > 0.5;
      a.fig.liberar();
      a.modelo.objeto.removeFromParent();
      construir(id, a);
      a.fig.sentar(sentado, true);
      a.sombra.visible = !sombrasReales; // con sombra real no hace falta el disco de contacto
    }
  }

  function liberar() {
    desuscribir.forEach((f) => f());
    for (const a of Object.values(agentes)) a.fig.liberar();
    grupo.removeFromParent();
  }

  return {
    grupo,
    agentes,
    actualizar,
    ocupados,
    seleccionar,
    seleccionado: () => seleccionado,
    cabezaDe,
    cambiarDetalle,
    liberar,
    detalle: () => ({ liviana, sombrasReales }),
  };
}
