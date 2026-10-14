// Pruebas automáticas de la oficina 3D en un navegador sin pantalla (Chromium con WebGL por software, SwiftShader).
// No modifican la aplicación. Necesitan un servidor local sirviendo la raíz del repositorio, por ejemplo:
//   python3 -m http.server 8123
//   node oficina-3d/pruebas/navegador.mjs            (variables opcionales: BASE, CAPTURAS, PLAYWRIGHT)
// Playwright no se instala en el proyecto: se usa el que ya tenga el equipo (ruta en la variable PLAYWRIGHT).
import { mkdirSync } from 'node:fs';

const PW = process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const BASE = process.env.BASE || 'http://localhost:8123/';
const URL3D = BASE + 'oficina-3d/';
const CAPTURAS = process.env.CAPTURAS || './capturas-oficina-3d/';
mkdirSync(CAPTURAS, { recursive: true });

const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'];
const browser = await chromium.launch({ args: ARGS });
let fallos = 0;
const resultados = [];
const paso = async (nombre, fn) => {
  try {
    const nota = await fn();
    resultados.push(['OK', nombre, nota]);
    console.log('OK  ', nombre, nota ? `— ${nota}` : '');
  } catch (e) {
    fallos++;
    resultados.push(['FAIL', nombre, e.message]);
    console.log('FAIL', nombre, '—', e.message.split('\n')[0]);
  }
};

async function abrir(query = '', { w = 1280, h = 800, movil = false, init } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: movil ? 2 : 1, isMobile: movil, hasTouch: movil });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errores = [];
  const externos = [];
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) externos.push(u);
  });
  await page.goto(URL3D + query);
  await page.waitForFunction(() => document.body.dataset.listo || window.oficina3d?.error || !document.getElementById('aviso').hidden, null, { timeout: 90000 });
  await page.waitForTimeout(800);
  return { page, ctx, errores, externos };
}

const plano = await import(new URL('../plano.js', import.meta.url).href);

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const { page, ctx, errores, externos } = await abrir('?calidad=alta');

await paso('carga sin errores de JavaScript', async () => {
  const ok = await page.evaluate(() => !!document.body.dataset.listo && !window.oficina3d.error);
  if (!ok) throw new Error('no terminó de cargar');
  if (errores.length) throw new Error(errores.join(' | '));
  return `construcción en ${await page.evaluate(() => Math.round(window.oficina3d.msConstruir))} ms (navegador de pruebas, WebGL por software)`;
});

await paso('solo se cargan recursos locales', async () => {
  if (externos.length) throw new Error('externos: ' + externos.join(', '));
  const n = await page.evaluate(() => performance.getEntriesByType('resource').length);
  return `${n} recursos, todos del mismo sitio`;
});

await paso('existen las cinco salas con las medidas del plano', async () => {
  const r = await page.evaluate(() => Object.fromEntries(Object.entries(window.oficina3d.salas).map(([id, s]) => [id, { rect: s.userData.rect, modelos: s.userData.modelos.length }])));
  const ids = Object.keys(r);
  if (ids.length !== 5) throw new Error('salas: ' + ids.join(','));
  for (const [id, [x, y, w, d]] of Object.entries(plano.ROOM_AREA)) {
    const e = r[id]?.rect;
    if (!e || e.x !== x * 2 || e.z !== y * 2 || e.w !== w * 2 || e.d !== d * 2) throw new Error(`${id}: ${JSON.stringify(e)}`);
    const esperados = plano.MUEBLES.filter((m) => m.sala === id).length;
    if (r[id].modelos !== esperados) throw new Error(`${id}: ${r[id].modelos} modelos de ${esperados}`);
  }
  return ids.map((id) => `${id} ${r[id].modelos}`).join(' · ');
});

await paso('muebles en las coordenadas del plano (escala 1:2)', async () => {
  const fichas = await page.evaluate(() =>
    Object.values(window.oficina3d.salas).flatMap((s) =>
      s.userData.modelos.map((m) => ({ item: m.item, pos: [m.objeto.position.x, m.objeto.position.z], caja: [m.cajaMundo.min.x, m.cajaMundo.min.z, m.cajaMundo.max.x, m.cajaMundo.max.z] }))
    )
  );
  const malos = [];
  for (const f of fichas) {
    if (f.item.huella) {
      const [x1, y1, x2, y2] = f.item.huella.map((v) => v * 2);
      const [a, b, c, d] = f.caja;
      const tol = 0.45; // bisel, asas y respaldos pueden salir apenas
      if (a < x1 - tol || b < y1 - tol || c > x2 + tol || d > y2 + tol) malos.push(`${f.item.modelo} se sale de su huella`);
      const cubre = ((Math.min(c, x2) - Math.max(a, x1)) * (Math.min(d, y2) - Math.max(b, y1))) / ((x2 - x1) * (y2 - y1));
      if (cubre < 0.8) malos.push(`${f.item.modelo} cubre ${(cubre * 100).toFixed(0)}% de su huella`);
    } else {
      const [px, pz] = f.item.en.map((v) => v * 2);
      if (Math.abs(f.pos[0] - px) > 1e-6 || Math.abs(f.pos[1] - pz) > 1e-6) malos.push(`${f.item.modelo} fuera de ${f.item.en}`);
    }
  }
  if (malos.length) throw new Error(malos.join(' | '));
  return `${fichas.length} modelos revisados`;
});

await paso('a ras de piso, ningún mueble atraviesa un tabique', async () => {
  const cajas = await page.evaluate(() =>
    Object.values(window.oficina3d.salas).flatMap((s) => s.userData.modelos.filter((m) => !m.item.sobre).map((m) => ({ modelo: m.item.modelo, sala: m.item.sala, c: [m.cajaBase.min.x, m.cajaBase.min.z, m.cajaBase.max.x, m.cajaBase.max.z] })))
  );
  const tabiques = plano.OBSTACLES.slice(plano.MUEBLES_OBSTACULOS.length).map((h) => h.map((v) => v * 2));
  const choques = [];
  for (const m of cajas) for (const t of tabiques) if (m.c[0] < t[2] - 0.05 && m.c[2] > t[0] + 0.05 && m.c[1] < t[3] - 0.05 && m.c[3] > t[1] + 0.05) choques.push(`${m.modelo} (${m.sala}) toca un tabique`);
  if (choques.length) throw new Error(choques.join(' | '));
  return 'ningún mueble atraviesa un tabique';
});

await paso('puertas libres: un rayo atraviesa cada puerta sin chocar', async () => {
  const r = await page.evaluate((puertas) => {
    const { THREE, escena } = window.oficina3d;
    const ray = new THREE.Raycaster();
    const objetivos = [];
    escena.getObjectByName('paredes').traverse((o) => o.isMesh && o.visible && objetivos.push(o));
    escena.getObjectByName('salas').traverse((o) => o.isMesh && objetivos.push(o));
    const salida = [];
    for (const p of puertas) {
      const medio = ((p.desde + p.hasta) / 2) * 2;
      const en = p.en * 2;
      for (const alto of [0.6, 1.8]) {
        const origen = p.eje === 'x' ? new THREE.Vector3(en - 3, alto, medio) : new THREE.Vector3(medio, alto, en - 3);
        const dir = p.eje === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
        ray.set(origen, dir);
        ray.far = 6;
        const hits = ray.intersectObjects(objetivos, false);
        salida.push({ id: p.id, alto, choques: hits.length });
      }
      // control: justo al lado de la puerta, sobre el tabique, el rayo SÍ debe chocar
      const fuera = (p.desde - 0.6) * 2;
      const o2 = p.eje === 'x' ? new THREE.Vector3(en - 3, 1.2, fuera) : new THREE.Vector3(fuera, 1.2, en - 3);
      ray.set(o2, p.eje === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1));
      salida.push({ id: p.id + ' (tabique)', alto: 1.2, choques: ray.intersectObjects(objetivos, false).length, control: true });
    }
    return salida;
  }, plano.PUERTAS);
  const tapadas = r.filter((x) => !x.control && x.choques);
  const sinTabique = r.filter((x) => x.control && !x.choques);
  if (tapadas.length) throw new Error('puertas tapadas: ' + tapadas.map((x) => x.id).join(', '));
  if (sinTabique.length) throw new Error('control falló (no hay tabique junto a): ' + sinTabique.map((x) => x.id).join(', '));
  return `${plano.PUERTAS.length} puertas libres; el tabique de al lado sí bloquea`;
});

const MAX = { calls: 150, alta: 300000, media: 120000, baja: 120000 };
const metricas = {};
await paso('niveles de calidad: cambian materiales y detalle, y respetan los límites', async () => {
  const salida = [];
  for (const nivel of ['alta', 'media', 'baja']) {
    const m = await page.evaluate(async (nivel) => {
      const O = window.oficina3d;
      O.aplicarCalidad(nivel);
      O.vistaGeneral(0);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const sin = O.medir();
      const con = O.medir({ conSombras: true });
      let barniz = null;
      let taquitoTris = null;
      O.escena.traverse((o) => {
        if (o.isInstancedMesh && taquitoTris === null) taquitoTris = o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3;
        if (o.isMesh && o.material?.userData?.porVertice === 'plastico' && barniz === null) barniz = o.material.clearcoat;
      });
      return { nivel: O.nivel(), sin, con, barniz, taquitoTris, pixeles: O.renderer.getPixelRatio(), sombra: O.renderer.shadowMap.enabled };
    }, nivel);
    metricas[nivel] = m;
    if (m.nivel !== nivel) throw new Error(`pidió ${nivel}, quedó ${m.nivel}`);
    if (nivel === 'alta' && !(m.barniz > 0)) throw new Error('alta sin barniz');
    if (nivel !== 'alta' && m.barniz !== 0) throw new Error(`${nivel} con barniz`);
    if (m.sin.calls >= MAX.calls) throw new Error(`${nivel}: ${m.sin.calls} llamadas`);
    if (m.sin.triangulos >= MAX[nivel]) throw new Error(`${nivel}: ${m.sin.triangulos} triángulos`);
    salida.push(`${nivel}: ${m.sin.calls} llamadas, ${(m.sin.triangulos / 1000).toFixed(0)} mil triángulos (con recálculo de sombras: ${m.con.calls} / ${(m.con.triangulos / 1000).toFixed(0)} mil)`);
  }
  return salida.join(' · ');
});

await paso('calidad automática: baja un nivel solo tras lentitud sostenida y no oscila', async () => {
  const r = await page.evaluate(() => {
    const O = window.oficina3d;
    O.aplicarCalidad('alta');
    const auto = O.auto;
    const cambios = [];
    const original = auto.alBajar;
    auto.alBajar = (c) => cambios.push(c);
    auto.activa = true;
    auto.reinicia();
    auto.pausaHasta = 0;
    // 1 s lento suelto: no debe bajar
    for (let i = 0; i < 20; i++) auto.cuadro(60, 'alta');
    for (let i = 0; i < 120; i++) auto.cuadro(16, 'alta');
    const trasPico = cambios.length;
    // 8 s seguidos a ~16 fps: debe bajar UNA vez
    for (let i = 0; i < 130; i++) auto.cuadro(62, 'alta');
    const trasLento = cambios.slice();
    auto.alBajar = original;
    auto.activa = false;
    return { trasPico, trasLento };
  });
  if (r.trasPico !== 0) throw new Error('bajó por un pico aislado');
  if (r.trasLento.length !== 1 || r.trasLento[0] !== 'media') throw new Error('cambios: ' + JSON.stringify(r.trasLento));
  return 'un pico no la cambia; 6 s lentos bajan de Alta a Media una sola vez';
});

await paso('cámara: límites de zoom, de inclinación y de desplazamiento', async () => {
  const r = await page.evaluate(async () => {
    const O = window.oficina3d;
    const { camara, controles } = O;
    O.vistaGeneral(0);
    const frame = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    // demasiado lejos
    camara.position.sub(controles.target).multiplyScalar(5).add(controles.target);
    controles.update();
    await frame();
    const lejos = camara.position.distanceTo(controles.target);
    // demasiado cerca
    camara.position.sub(controles.target).normalize().multiplyScalar(2).add(controles.target);
    controles.update();
    await frame();
    const cerca = camara.position.distanceTo(controles.target);
    // desde abajo del piso
    O.vistaGeneral(0);
    camara.position.y = -30;
    controles.update();
    await frame();
    const polar = controles.getPolarAngle();
    // desplazamiento fuera de la oficina
    O.vistaGeneral(0);
    controles.target.set(500, 0, 500);
    camara.position.set(560, 60, 560);
    await frame();
    const t = controles.target.clone();
    O.vistaGeneral(0);
    return { lejos, cerca, polar, max: controles.maxDistance, min: controles.minDistance, maxPolar: controles.maxPolarAngle, t: [t.x, t.z], lim: O.limites };
  });
  if (r.lejos > r.max + 0.01) throw new Error('zoom lejano sin límite: ' + r.lejos);
  if (r.cerca < r.min - 0.01) throw new Error('zoom cercano sin límite: ' + r.cerca);
  if (r.polar > r.maxPolar + 0.01) throw new Error('puede mirar desde debajo del piso');
  if (r.t[0] > r.lim.x1 + 4.01 || r.t[1] > r.lim.z1 + 4.01) throw new Error('el desplazamiento sale de la oficina: ' + r.t);
  return `distancia ${r.min}–${Math.round(r.max)}, inclinación máx. ${((r.maxPolar * 180) / Math.PI).toFixed(0)}°, objetivo dentro del contorno`;
});

await paso('paredes: se ocultan las que tapan y reaparecen al girar (con histéresis)', async () => {
  const r = await page.evaluate(() => {
    const O = window.oficina3d;
    const estado = () => Object.fromEntries(O.paredes.paredes.map((p) => [p.id, p.meta]));
    O.vistaGeneral(0);
    O.girar(Math.PI / 4, 0.6);
    const inicial = estado();
    O.girar(Math.PI + Math.PI / 4, 0.6);
    const vuelta = estado();
    // histéresis: justo en la zona intermedia una pared no cambia de estado
    O.girar(Math.PI / 4, 0.6);
    const pFrente = O.paredes.porId['frente-der'];
    const ang = Math.acos(0.22); // dot = 0.22: entre MOSTRAR (0.12) y OCULTAR (0.32)
    O.girar(Math.PI / 2 - ang, 0.6); // dirección de la cámara con dot ≈ 0.22 respecto a +x
    const intermedio = pFrente.meta;
    O.girar(Math.PI / 4, 0.6);
    return { inicial, vuelta, intermedio, escala: O.paredes.porId['frente-der'].cuerpo.scale.y };
  });
  const esperadoIni = { 'fondo-izq': 1, 'fondo-der': 1, 'frente-der': 0, 'frente-kike': 0, 'frente-guion': 0, 'lado-kike': 1 };
  const esperadoVuelta = { 'fondo-izq': 0, 'fondo-der': 0, 'frente-der': 1, 'frente-kike': 1, 'frente-guion': 1, 'lado-kike': 0 };
  if (JSON.stringify(r.inicial) !== JSON.stringify(esperadoIni)) throw new Error('vista inicial: ' + JSON.stringify(r.inicial));
  if (JSON.stringify(r.vuelta) !== JSON.stringify(esperadoVuelta)) throw new Error('vista opuesta: ' + JSON.stringify(r.vuelta));
  if (r.intermedio !== 0) throw new Error('la histéresis no mantuvo oculta la pared en la zona intermedia');
  return 'vista isométrica: se ocultan las 3 paredes delanteras; girando 180° se ocultan las del fondo';
});

await paso('animación de paredes suave (sin saltos)', async () => {
  const r = await page.evaluate(async () => {
    const O = window.oficina3d;
    O.girar(Math.PI / 4, 0.6);
    const p = O.paredes.porId['fondo-der'];
    const valores = [];
    // gira a la vista opuesta con un vuelo y registra la altura de la pared en varios cuadros
    const d = O.camara.position.distanceTo(O.controles.target);
    O.camara.position.set(O.controles.target.x - d * 0.5, O.camara.position.y, O.controles.target.z - d * 0.5);
    for (let i = 0; i < 40; i++) {
      await new Promise((res) => requestAnimationFrame(res));
      valores.push(+p.cuerpo.scale.y.toFixed(3));
    }
    O.vistaGeneral(0);
    O.girar(Math.PI / 4, 0.6);
    return valores;
  });
  const saltos = r.slice(1).map((v, i) => Math.abs(v - r[i]));
  if (r.at(-1) > 0.01) throw new Error('no terminó de ocultarse: ' + r.join(','));
  const intermedios = r.filter((v) => v > 0.02 && v < 0.98).length;
  if (intermedios < 2) throw new Error('no hubo transición: ' + r.join(','));
  if (Math.max(...saltos) > 0.6) throw new Error('salto brusco: ' + r.join(','));
  return `${intermedios} cuadros intermedios en la transición`;
});

// Capturas de escritorio: vista general y cada sala
await page.evaluate(() => {
  document.getElementById('panel').open = false;
  window.oficina3d.aplicarCalidad('alta');
});
const capturar = async (p, nombre, fn) => {
  await p.evaluate(fn);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: CAPTURAS + nombre });
};
await paso('capturas de escritorio: vista general y cada sala', async () => {
  await capturar(page, 'escritorio-general.png', () => window.oficina3d.vistaGeneral(0));
  for (const id of Object.keys(plano.ROOM_AREA)) await capturar(page, `sala-${id}.png`, new Function(`window.oficina3d.enfocar('${id}', 0)`));
  await capturar(page, 'escritorio-girada.png', () => {
    window.oficina3d.vistaGeneral(0);
    window.oficina3d.girar(Math.PI + Math.PI / 4, 0.62);
  });
  await capturar(page, 'escritorio-media.png', () => {
    window.oficina3d.aplicarCalidad('media');
    window.oficina3d.vistaGeneral(0);
  });
  return 'guardadas en ' + CAPTURAS;
});
await ctx.close();

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────
await paso('celular (393 × 851): calidad automática prudente, oficina completa en pantalla', async () => {
  const m = await abrir('', { w: 393, h: 851, movil: true });
  const r = await m.page.evaluate(() => {
    const O = window.oficina3d;
    const { THREE, camara, limites } = O;
    let fuera = 0;
    for (const x of [limites.x0, limites.x1]) for (const z of [limites.z0, limites.z1]) {
      const p = new THREE.Vector3(x, 0, z).project(camara);
      if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1) fuera++;
    }
    return { nivel: O.nivel(), fuera, medida: O.medir() };
  });
  await m.page.screenshot({ path: CAPTURAS + 'celular-general.png' });
  await m.page.evaluate(() => window.oficina3d.enfocar('juntas', 0));
  await m.page.waitForTimeout(1000);
  await m.page.screenshot({ path: CAPTURAS + 'celular-juntas.png' });
  if (m.errores.length) throw new Error(m.errores.join(' | '));
  await m.ctx.close();
  if (r.nivel === 'alta') throw new Error('en celular empezó en Alta');
  if (r.fuera) throw new Error(`${r.fuera} esquinas fuera de pantalla`);
  return `nivel ${r.nivel}, ${r.medida.calls} llamadas, ${(r.medida.triangulos / 1000).toFixed(0)} mil triángulos`;
});

await paso('celular horizontal (851 × 393): oficina completa', async () => {
  const m = await abrir('', { w: 851, h: 393, movil: true });
  const fuera = await m.page.evaluate(() => {
    const { THREE, camara, limites } = window.oficina3d;
    let n = 0;
    for (const x of [limites.x0, limites.x1]) for (const z of [limites.z0, limites.z1]) {
      const p = new THREE.Vector3(x, 0, z).project(camara);
      if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1) n++;
    }
    return n;
  });
  await m.page.screenshot({ path: CAPTURAS + 'celular-horizontal.png' });
  await m.ctx.close();
  if (fuera) throw new Error(`${fuera} esquinas fuera de pantalla`);
});

await paso('modo depuración (?depurar=1): guías, figura de referencia de 5.0 de alto', async () => {
  const m = await abrir('?depurar=1&calidad=alta');
  const r = await m.page.evaluate(() => {
    const O = window.oficina3d;
    const dep = O.escena.getObjectByName('depuracion');
    const fig = O.escena.getObjectByName('figura-referencia');
    const caja = new O.THREE.Box3().setFromObject(fig);
    return { hay: !!dep, hijos: dep?.children.length, alto: +(caja.max.y - caja.min.y).toFixed(2) };
  });
  await m.page.screenshot({ path: CAPTURAS + 'depuracion.png' });
  await m.page.evaluate(() => window.oficina3d.enfocar('copy', 0));
  await m.page.waitForTimeout(1000);
  await m.page.screenshot({ path: CAPTURAS + 'depuracion-copy.png' });
  const sinDep = await abrir('?calidad=alta');
  const oculto = await sinDep.page.evaluate(() => !window.oficina3d.escena.getObjectByName('depuracion') && !window.oficina3d.escena.getObjectByName('figura-referencia'));
  await sinDep.ctx.close();
  await m.ctx.close();
  if (!r.hay) throw new Error('no hay grupo de depuración');
  if (Math.abs(r.alto - 5) > 0.05) throw new Error('la figura mide ' + r.alto);
  if (!oculto) throw new Error('la depuración aparece sin ?depurar=1');
  return `${r.hijos} guías; figura de ${r.alto} de alto; sin el parámetro no aparece nada`;
});

await paso('movimiento reducido: paredes y cámara sin animación', async () => {
  const ctx3 = await browser.newContext({ viewport: { width: 1000, height: 700 }, reducedMotion: 'reduce' });
  const p = await ctx3.newPage();
  await p.goto(URL3D + '?calidad=media');
  await p.waitForFunction(() => document.body.dataset.listo, null, { timeout: 90000 });
  const r = await p.evaluate(async () => {
    const O = window.oficina3d;
    const pared = O.paredes.porId['fondo-der'];
    const d = O.camara.position.distanceTo(O.controles.target);
    O.camara.position.set(O.controles.target.x - d * 0.5, O.camara.position.y, O.controles.target.z - d * 0.5);
    const valores = [];
    for (let i = 0; i < 6; i++) {
      await new Promise((res) => requestAnimationFrame(res));
      valores.push(pared.cuerpo.scale.y);
    }
    return { valores, damping: O.controles.enableDamping };
  });
  await ctx3.close();
  if (r.valores.some((v) => v > 0.02 && v < 0.98)) throw new Error('hubo transición: ' + r.valores.join(','));
  if (r.damping) throw new Error('la cámara sigue con inercia');
  return 'las paredes cambian de golpe y la cámara no tiene inercia';
});

await paso('sin WebGL: mensaje claro con enlace a la oficina original', async () => {
  const m = await abrir('', {
    init: () => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (tipo, ...resto) {
        if (/webgl/i.test(tipo)) return null;
        return original.call(this, tipo, ...resto);
      };
    },
  });
  const r = await m.page.evaluate(() => ({ visible: !document.getElementById('aviso').hidden, texto: document.getElementById('aviso').innerText, enlace: document.querySelector('#aviso a')?.getAttribute('href') }));
  await m.page.screenshot({ path: CAPTURAS + 'sin-webgl.png' });
  await m.ctx.close();
  if (!r.visible) throw new Error('no se mostró el aviso');
  if (r.enlace !== '../') throw new Error('enlace: ' + r.enlace);
  return r.texto.replace(/\s+/g, ' ').trim();
});

await paso('si el motor 3D no carga (archivo faltante): aviso en vez de página vacía', async () => {
  const ctx2 = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const p = await ctx2.newPage();
  await p.route('**/oficina-3d/vendor/three/three.module.js', (r) => r.fulfill({ status: 404, body: '' }));
  await p.goto(URL3D);
  await p.waitForFunction(() => !document.getElementById('aviso').hidden, null, { timeout: 40000 });
  await ctx2.close();
  return 'se muestra el aviso';
});

await paso('pérdida del contexto gráfico: aviso con enlace', async () => {
  const m = await abrir('?calidad=media');
  const visible = await m.page.evaluate(async () => {
    window.oficina3d.renderer.getContext().getExtension('WEBGL_lose_context').loseContext();
    await new Promise((r) => setTimeout(r, 300));
    return !document.getElementById('aviso').hidden;
  });
  await m.ctx.close();
  if (!visible) throw new Error('no avisó');
  return 'se muestra el aviso';
});

await browser.close();
console.log(`\n${resultados.length - fallos} de ${resultados.length} pruebas pasaron.`);
console.log('MÉTRICAS ' + JSON.stringify(metricas));
process.exit(fallos ? 1 : 0);
