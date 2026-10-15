// Pruebas de la Etapa 3 (personajes) en un navegador sin pantalla. Mismo uso que navegador.mjs:
//   python3 -m http.server 8123   y   node oficina-3d/pruebas/personajes.mjs
// Las métricas de aquí son del navegador de pruebas (WebGL por software): NO son FPS de un dispositivo real.
import { mkdirSync } from 'node:fs';

const PW = process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const BASE = process.env.BASE || 'http://localhost:8123/';
const URL3D = BASE + 'oficina-3d/';
const CAPTURAS = process.env.CAPTURAS || './capturas-oficina-3d/';
mkdirSync(CAPTURAS, { recursive: true });
const FASES = (process.env.FASES || '1,2,3,4,5,nico').split(',').map((x) => (isNaN(+x) ? x : +x));

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });
let fallos = 0;
let total = 0;
const paso = async (nombre, fn) => {
  total++;
  try {
    const nota = await fn();
    console.log('OK  ', nombre, nota ? `— ${nota}` : '');
  } catch (e) {
    fallos++;
    console.log('FAIL', nombre, '—', e.message.split('\n')[0]);
  }
};
async function abrir(query = '', { w = 1280, h = 800, movil = false, init, reducido = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: movil, hasTouch: movil, reducedMotion: reducido ? 'reduce' : 'no-preference' });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errores = [];
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto(URL3D + query);
  await page.waitForFunction(() => document.body.dataset.listo || window.oficina3d?.error, null, { timeout: 90000 });
  await page.waitForTimeout(600);
  return { page, ctx, errores };
}
const plano = await import(new URL('../plano.js', import.meta.url).href);

// ─────────────────────────────── FASE 1: personajes en escena ───────────────────────────────
if (FASES.includes(1)) {
  const { page, ctx, errores } = await abrir('?calidad=alta');

  await paso('F1 · tres agentes sentados en su asiento, mirando al escritorio', async () => {
    const r = await page.evaluate(() =>
      Object.fromEntries(Object.entries(window.oficina3d.agentes.agentes).map(([id, a]) => [id, { x: a.contenedor.position.x, z: a.contenedor.position.z, giro: a.contenedor.rotation.y, sentado: a.fig.sentado() }]))
    );
    for (const id of plano.AGENT_IDS) {
      const [x, y] = plano.SEATS[id];
      const a = r[id];
      if (!a) throw new Error('falta ' + id);
      if (Math.abs(a.x - x * 2) > 1e-6 || Math.abs(a.z - y * 2) > 1e-6) throw new Error(`${id} fuera de su asiento`);
      if (a.sentado < 0.99) throw new Error(`${id} no está sentado`);
      if (Math.abs(a.giro) > 1e-6) throw new Error(`${id} no mira al escritorio`);
    }
    if (errores.length) throw new Error(errores.join(' | '));
    return 'Nico, Alex y Sam en SEATS (escala ×2), sentados y de frente al escritorio';
  });

  await paso('F1 · apariencia y accesorios según la app (kitParts y apariencia por defecto)', async () => {
    const r = await page.evaluate(() => Object.fromEntries(Object.entries(window.oficina3d.agentes.agentes).map(([id, a]) => [id, { look: a.look, nombre: a.nombre, acc: a.fig.accesorios }])));
    const esperado = {
      copy: { modelo: 'nico', cabeza: 2, manoDer: 1, manoIzq: 1, peinado: 'pelo LEGO' }, // modelo propio: pelo y cara; bolígrafo; libreta
      analista: { cabeza: 3, manoDer: 0, manoIzq: 1, peinado: 'short' }, // 2 aros y puente de lentes; tableta
      guion: { cabeza: 0, manoDer: 1, manoIzq: 0, peinado: 'curly' }, // tarjetas; audífonos al cuello van en el torso
    };
    for (const id of plano.AGENT_IDS) {
      const a = r[id];
      if (JSON.stringify(a.look) !== JSON.stringify(plano.AGENTES[id].look)) throw new Error(`${id}: apariencia ${JSON.stringify(a.look)}`);
      if (a.nombre !== plano.AGENTES[id].name) throw new Error(`${id}: nombre ${a.nombre}`);
      for (const [k, v] of Object.entries(esperado[id])) if (a.acc[k] !== v) throw new Error(`${id}: ${k} = ${a.acc[k]} (esperado ${v})`);
      if (!a.acc.senal || a.acc.torso < 3) throw new Error(`${id}: faltan prendas o señal`);
    }
    return 'Nico (modelo propio): sudadera con capucha, pelo LEGO, libreta y bolígrafo · Alex: saco, lentes, tableta · Sam: sudadera, audífonos al cuello, tarjetas';
  });

  await paso('F1 · sentados (en reposo animado) sin atravesar escritorio, asiento ni respaldo', async () => {
    const r = await page.evaluate(() => {
      const O = window.oficina3d;
      const { THREE } = O;
      const salida = {};
      for (const [id, a] of Object.entries(O.agentes.agentes)) {
        // 3 s de reposo sentado (la postura real, no la neutra)
        for (let t = 0; t < 3; t += 1 / 30) a.fig.animar('idle', t, 1 / 30);
        a.contenedor.updateMatrixWorld(true);
        const fichas = O.salas[id].userData.modelos;
        const desk = fichas.find((m) => m.item.modelo === 'escritorio').cajaMundo;
        const sc = fichas.find((m) => m.item.modelo === 'silla').objeto.position;
        // medidas de la silla (muebles.js): asiento x ±1.2, z -0.7..1.3, y 1.2..1.7; respaldo z -1.3..-0.7, y 1.7..4.7
        const asiento = new THREE.Box3(new THREE.Vector3(sc.x - 1.15, 1.2, sc.z - 0.65), new THREE.Vector3(sc.x + 1.15, 1.66, sc.z + 1.25));
        const respaldo = new THREE.Box3(new THREE.Vector3(sc.x - 1.2, 1.7, sc.z - 1.3), new THREE.Vector3(sc.x + 1.2, 4.7, sc.z - 0.72));
        const choques = { escritorio: 0, asiento: 0, respaldo: 0 };
        let apoyo = Infinity;
        const caja = new THREE.Box3();
        a.fig.objeto.traverse((o) => {
          if (!o.isMesh || o.parent?.name === 'senal') return;
          caja.setFromObject(o);
          if (caja.min.y < desk.max.y - 0.1 && caja.intersectsBox(desk)) choques.escritorio++;
          if (caja.intersectsBox(asiento)) choques.asiento++;
          if (caja.intersectsBox(respaldo)) choques.respaldo++;
          // lo más bajo de lo que está encima del asiento (piernas y cadera)
          if (caja.max.x > sc.x - 1.2 && caja.min.x < sc.x + 1.2 && caja.max.z > sc.z - 0.7 && caja.min.z < sc.z + 1.3) apoyo = Math.min(apoyo, caja.min.y);
        });
        salida[id] = { ...choques, apoyo };
      }
      return salida;
    });
    for (const [id, x] of Object.entries(r)) {
      for (const k of ['escritorio', 'asiento', 'respaldo']) if (x[k]) throw new Error(`${id}: ${x[k]} piezas dentro del ${k}`);
      if (Math.abs(x.apoyo - 1.7) > 0.12) throw new Error(`${id}: se apoya a ${x.apoyo.toFixed(2)} (asiento a 1.7)`);
    }
    return Object.entries(r).map(([id, x]) => `${id} apoya a ${x.apoyo.toFixed(2)}`).join(' · ');
  });

  await paso('F1 · sombras de contacto por defecto (los personajes no usan el mapa de sombras)', async () => {
    const r = await page.evaluate(() =>
      Object.values(window.oficina3d.agentes.agentes).map((a) => {
        let proyectan = 0;
        a.fig.objeto.traverse((o) => o.isMesh && o.castShadow && proyectan++);
        return { sombra: !!a.contenedor.getObjectByName('sombra-contacto'), proyectan };
      })
    );
    if (r.some((x) => !x.sombra)) throw new Error('falta sombra de contacto');
    if (r.some((x) => x.proyectan)) throw new Error('hay piezas proyectando sombra real');
    return '3 discos de sombra; ninguna pieza en el mapa de sombras';
  });

  const presupuesto = {};
  await paso('F1 · versión liviana en Media y Baja: misma identidad, menos triángulos; límites por calidad', async () => {
    for (const nivel of ['alta', 'media', 'baja']) {
      presupuesto[nivel] = await page.evaluate(async (nivel) => {
        const O = window.oficina3d;
        O.aplicarCalidad(nivel);
        O.vistaGeneral(0);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const tri = Object.values(O.agentes.agentes).map((a) => {
          let n = 0;
          a.fig.objeto.traverse((o) => {
            if (o.isMesh) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
          });
          return n;
        });
        const acc = Object.values(O.agentes.agentes).map((a) => JSON.stringify(a.fig.accesorios));
        return { m: O.medir(), tri, acc, liviana: O.agentes.detalle().liviana };
      }, nivel);
    }
    const { alta, media, baja } = presupuesto;
    if (alta.liviana || !media.liviana || !baja.liviana) throw new Error('detalle incorrecto por calidad');
    if (JSON.stringify(alta.acc) !== JSON.stringify(media.acc)) throw new Error('la versión liviana perdió accesorios');
    if (media.tri.some((t, i) => t >= alta.tri[i])) throw new Error('la liviana no tiene menos triángulos');
    if (alta.m.calls >= 150 || media.m.calls >= 150) throw new Error(`llamadas: alta ${alta.m.calls}, media ${media.m.calls}`);
    if (alta.m.triangulos >= 300000) throw new Error('alta: ' + alta.m.triangulos);
    if (media.m.triangulos >= 120000) throw new Error('media: ' + media.m.triangulos);
    return `por personaje ${Math.round(alta.tri[0])} (fina) → ${Math.round(media.tri[0])} (liviana) triángulos · escena: alta ${alta.m.calls} llamadas / ${(alta.m.triangulos / 1000).toFixed(0)} mil · media ${media.m.calls} / ${(media.m.triangulos / 1000).toFixed(0)} mil`;
  });

  await paso('F1 · capturas de cada agente (Alta y Media)', async () => {
    for (const nivel of ['alta', 'media']) {
      await page.evaluate((n) => {
        window.oficina3d.aplicarCalidad(n);
        document.getElementById('panel').open = false;
      }, nivel);
      for (const id of plano.AGENT_IDS) {
        await page.evaluate((id) => {
          const O = window.oficina3d;
          const p = O.agentes.agentes[id].contenedor.position;
          O.controles.target.set(p.x, 3, p.z);
          O.camara.position.set(p.x + 10, 12, p.z + 10);
          O.controles.update();
        }, id);
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${CAPTURAS}f1-${nivel}-${id}.png` });
      }
    }
    return 'guardadas';
  });
  await ctx.close();

  await paso('F1 · apariencia personalizada de la app: se lee y no se modifica', async () => {
    const guardado = JSON.stringify({ copy: { name: 'Pepe', look: { shirt: '#e05297', hairStyle: 'long' } } });
    const m = await abrir('?calidad=media', { init: `localStorage.setItem('vaof:agents', ${JSON.stringify(guardado)})`, w: 900, h: 600 });
    await m.page.evaluate((g) => localStorage.setItem('vaof:agents', g), guardado); // (initScript corre antes de cada carga)
    const r = await m.page.evaluate(() => {
      const a = window.oficina3d.agentes.agentes.copy;
      return { nombre: a.nombre, look: a.look, despues: localStorage.getItem('vaof:agents') };
    });
    await m.ctx.close();
    if (r.nombre !== 'Pepe' || r.look.shirt !== '#e05297' || r.look.hairStyle !== 'long' || r.look.kit !== 'copy') throw new Error(JSON.stringify(r));
    if (r.despues !== guardado) throw new Error('se modificó lo guardado');
    return 'usa el nombre y colores guardados por la app; lo guardado queda igual';
  });
}

// Muestrea, dentro de la página, cómo se ve cada agente mientras corre una acción del simulador.
async function grabar(page, codigo, { extraMs = 2600, velocidad = 2 } = {}) {
  return page.evaluate(
    async ({ codigo, extraMs, velocidad }) => {
      const O = window.oficina3d;
      O.simulador.velocidad = velocidad;
      O.despertar();
      O.pasoManual(true); // la prueba avanza la animación con el reloj real (el navegador sin GPU dibuja muy lento)
      const muestras = [];
      let previo = performance.now();
      const tomar = () => {
        const ahora = performance.now();
        O.avanzar(Math.min(1, (ahora - previo) / 1000));
        previo = ahora;
        const fila = { t: Math.round(performance.now()) };
        for (const [id, a] of Object.entries(O.agentes.agentes)) {
          fila[id] = {
            st: O.fuente.runtime.status[id],
            loc: O.fuente.runtime.location[id],
            anim: a.anim,
            globo: O.etiquetas.items.get(id).texto,
            senal: a.fig.senal.visible,
            caminando: !!a.camino,
            sentado: +a.fig.sentado().toFixed(2),
            x: +a.contenedor.position.x.toFixed(2),
            z: +a.contenedor.position.z.toFixed(2),
          };
        }
        fila.pantallaAlex = +O.pantallaAlex.emissiveIntensity.toFixed(3);
        muestras.push(fila);
      };
      const reloj = setInterval(tomar, 40);
      const resultado = await new Function('O', `return (${codigo})(O)`)(O);
      await new Promise((r) => setTimeout(r, extraMs));
      clearInterval(reloj);
      tomar();
      O.pasoManual(false);
      return { resultado, muestras };
    },
    { codigo, extraMs, velocidad }
  );
}
const vio = (m, id, fn) => m.some((f) => fn(f[id], f));
const indice = (m, id, fn) => m.findIndex((f) => fn(f[id], f));

// ─────────────────────────────── FASE 2: estados ───────────────────────────────
if (FASES.includes(2)) {
  const { page, ctx, errores } = await abrir('?calidad=media');

  await paso('F2 · respuesta normal: Pensando… → Escribiendo… (solo con texto real) → gesto de terminado → reposo', async () => {
    const { muestras: m } = await grabar(page, `(O) => O.simulador.responder('copy', { pensar: 1600, trozos: 6 })`);
    const iPens = indice(m, 'copy', (a) => a.anim === 'thinking' && a.globo === 'Pensando…');
    const iEscr = indice(m, 'copy', (a) => a.globo === 'Escribiendo…');
    const iFin = indice(m, 'copy', (a) => a.st === 'idle' && a.anim === 'terminado');
    if (iPens < 0) throw new Error('no se vio "Pensando…"');
    if (iEscr < 0 || iEscr < iPens) throw new Error('no se vio "Escribiendo…" después de pensar');
    if (m.slice(0, iEscr).some((f) => f.copy.globo === 'Escribiendo…')) throw new Error('"Escribiendo…" antes de que llegara texto');
    if (iFin < 0) throw new Error('no hubo gesto de terminado');
    if (!vio(m, 'copy', (a) => a.st === 'thinking' && a.senal)) throw new Error('el bombillo de Nico no apareció al pensar');
    if (vio(m, 'copy', (a) => a.st === 'idle' && a.senal)) throw new Error('el bombillo siguió en reposo');
    const fin = m.at(-1).copy;
    if (fin.anim !== 'idle' || fin.globo !== '') throw new Error('no volvió al reposo: ' + JSON.stringify(fin));
    if (errores.length) throw new Error(errores.join(' | '));
    return 'secuencia y señal (bombillo) correctas';
  });

  await paso('F2 · buscar en la web: Buscando en la web… con la lupa de Alex y su pantalla encendida', async () => {
    const { muestras: m } = await grabar(page, `(O) => O.simulador.responder('analista', { buscar: true, pensar: 600 })`);
    if (!vio(m, 'analista', (a) => a.st === 'searching' && a.anim === 'searching' && a.globo === 'Buscando en la web…' && a.senal)) throw new Error('no se vio la búsqueda con su globo y su lupa');
    if (vio(m, 'analista', (a) => a.st !== 'searching' && a.senal)) throw new Error('la lupa apareció fuera de la búsqueda');
    const iBusca = indice(m, 'analista', (a) => a.st === 'searching');
    const iVuelve = m.findIndex((f, i) => i > iBusca && f.analista.st === 'thinking');
    if (iVuelve < 0) throw new Error('después de buscar no volvió a "thinking" (como runAgent)');
    if (!m.some((f) => f.analista.st !== 'idle' && f.pantallaAlex > 0.1)) throw new Error('la pantalla de Alex no se encendió');
    if (m.at(-1).pantallaAlex !== 0) throw new Error('la pantalla de Alex quedó encendida');
    if (!vio(m, 'analista', (a) => a.anim === 'terminado')) throw new Error('no hubo gesto de terminado');
    return 'thinking → searching → thinking → idle, como runAgent()';
  });

  await paso('F2 · error: sin gesto de terminado ni ✓; vuelve al reposo', async () => {
    const { resultado, muestras: m } = await grabar(page, `(O) => O.simulador.responder('guion', { final: 'error', pensar: 800 })`);
    if (resultado !== 'error') throw new Error('el simulador no terminó en error');
    if (vio(m, 'guion', (a) => a.anim === 'terminado' || a.senal)) throw new Error('mostró terminado o ✓ con error');
    if (m.at(-1).guion.st !== 'idle' || m.at(-1).guion.anim !== 'idle') throw new Error('no volvió al reposo');
    return 'como en el SVG: un error no muestra el gesto';
  });

  await paso('F2 · respuesta vacía: se trata como error (sin gesto)', async () => {
    const { muestras: m } = await grabar(page, `(O) => O.simulador.responder('guion', { final: 'vacia', pensar: 600 })`);
    if (vio(m, 'guion', (a) => a.anim === 'terminado')) throw new Error('mostró el gesto con respuesta vacía');
    return '"No llegó respuesta" → sin gesto';
  });

  await paso('F2 · detener antes de que llegue texto: "Detuviste la respuesta", sin gesto', async () => {
    const { muestras: m } = await grabar(page, `(O) => O.simulador.responder('copy', { final: 'detener', detenerEn: 'pensando', pensar: 800 })`);
    const ultimo = await page.evaluate(() => window.oficina3d.fuente.chat('copy').at(-1));
    if (ultimo.error !== 'Detuviste la respuesta.') throw new Error('error: ' + ultimo.error);
    if (vio(m, 'copy', (a) => a.anim === 'terminado')) throw new Error('mostró el gesto');
    return 'igual que sendToAgent()';
  });

  await paso('F2 · detener con texto a medias: la app no lo marca como error, así que sí hay gesto (comportamiento real)', async () => {
    const { muestras: m } = await grabar(page, `(O) => O.simulador.responder('copy', { final: 'detener', detenerEn: 'escribiendo', pensar: 500, trozos: 8 })`);
    const ultimo = await page.evaluate(() => window.oficina3d.fuente.chat('copy').at(-1));
    if (ultimo.error || !ultimo.text) throw new Error('mensaje: ' + JSON.stringify(ultimo));
    if (!vio(m, 'copy', (a) => a.anim === 'terminado')) throw new Error('no hubo gesto (la app sí lo muestra en este caso)');
    return 'texto parcial sin error → gesto, como office.js';
  });

  await paso('F2 · "Escribiendo…" dura 700 ms después del último trozo de texto real', async () => {
    const r = await page.evaluate(async () => {
      const O = window.oficina3d;
      const { fuente } = O;
      O.despertar();
      O.pasoManual(true);
      const pasos = (ms) => new Promise((r) => {
        const fin = performance.now() + ms;
        const f = () => {
          O.avanzar(0.04);
          if (performance.now() < fin) setTimeout(f, 40);
          else r();
        };
        f();
      });
      // secuencia manual: thinking, un trozo de texto, y silencio
      fuente.chat('copy').push({ role: 'user', text: 'x' }, { role: 'model', text: '', pending: true });
      fuente.setStatus('copy', 'thinking');
      await pasos(300);
      const antes = O.etiquetas.items.get('copy').texto;
      fuente.chat('copy').at(-1).text = 'Hola';
      fuente.emit('chat', { agentId: 'copy', type: 'update' });
      await pasos(200);
      const durante = O.etiquetas.items.get('copy').texto;
      await pasos(900);
      const despues = O.etiquetas.items.get('copy').texto;
      fuente.chat('copy').at(-1).pending = false;
      fuente.setStatus('copy', 'idle');
      await pasos(2200);
      O.pasoManual(false);
      return { antes, durante, despues };
    });
    if (r.antes !== 'Pensando…' || r.durante !== 'Escribiendo…' || r.despues !== 'Pensando…') throw new Error(JSON.stringify(r));
    return 'Pensando… → Escribiendo… → Pensando… (sin texto nuevo)';
  });

  await paso('F2 · los tres trabajando a la vez: cada uno con su estado', async () => {
    const { muestras: m } = await grabar(page, `(O) => Promise.all([O.simulador.responder('copy', { pensar: 900 }), O.simulador.responder('analista', { buscar: true, pensar: 500 }), O.simulador.responder('guion', { pensar: 1300 })])`);
    const juntos = m.find((f) => f.copy.st !== 'idle' && f.analista.st === 'searching' && f.guion.st !== 'idle');
    if (!juntos) throw new Error('no coincidieron los tres trabajando');
    if (juntos.analista.anim !== 'searching' || !['thinking', 'terminado'].includes(juntos.copy.anim) || !['thinking', 'terminado'].includes(juntos.guion.anim)) throw new Error(JSON.stringify(juntos));
    if (['copy', 'analista', 'guion'].some((id) => m.at(-1)[id].anim !== 'idle')) throw new Error('no todos volvieron al reposo');
    return 'Nico y Sam teclean mientras Alex busca';
  });

  await paso('F2 · tocar un personaje lo selecciona (anillo y nombre resaltado)', async () => {
    const pos = await page.evaluate(() => {
      const O = window.oficina3d;
      O.enfocar('analista', 0);
      O.controles.update();
      const v = new O.THREE.Vector3();
      O.agentes.cabezaDe('analista', v);
      v.y -= 0.8;
      v.project(O.camara);
      const r = O.renderer.domElement.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    });
    await page.evaluate(() => (document.getElementById('panel').open = false));
    await page.waitForTimeout(400);
    await page.mouse.click(pos.x, pos.y);
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ sel: window.oficina3d.agentes.seleccionado(), anillo: window.oficina3d.agentes.agentes.analista.anillo.visible, clase: document.querySelector('.etiqueta[data-agente="analista"]').classList.contains('es-activo') }));
    if (r.sel !== 'analista' || !r.anillo || !r.clase) throw new Error(JSON.stringify(r));
    return 'Alex seleccionado';
  });

  await paso('F2 · captura con los tres trabajando', async () => {
    await page.evaluate(() => {
      const O = window.oficina3d;
      O.vistaGeneral(0);
      O.simulador.velocidad = 0.5;
      O.simulador.responder('copy', { pensar: 2500 });
      O.simulador.responder('analista', { buscar: true, pensar: 300 });
      O.simulador.responder('guion', { pensar: 300, trozos: 30 });
    });
    await page.waitForTimeout(1600);
    await page.screenshot({ path: CAPTURAS + 'f2-trabajando.png' });
    await page.evaluate(() => window.oficina3d.enfocar('copy', 0));
    await page.waitForTimeout(500);
    await page.screenshot({ path: CAPTURAS + 'f2-nico-pensando.png' });
    await page.waitForTimeout(9000);
    return 'guardada';
  });
  await ctx.close();

  await paso('F2 · movimiento reducido: posturas quietas, el estado se ve igual (globo y señal)', async () => {
    const m = await abrir('?calidad=media', { reducido: true, w: 900, h: 600 });
    const r = await m.page.evaluate(async () => {
      const O = window.oficina3d;
      O.simulador.velocidad = 2;
      O.pasoManual(true);
      const p = O.simulador.responder('copy', { pensar: 1500 });
      await new Promise((res) => setTimeout(res, 300));
      const a = O.agentes.agentes.copy;
      O.avanzar(0.04);
      O.avanzar(0.04);
      const rot1 = a.fig.manoDer.rotation.x;
      O.avanzar(0.2);
      const rot2 = a.fig.manoDer.rotation.x;
      const globo = O.etiquetas.items.get('copy').texto;
      await p;
      O.pasoManual(false);
      return { rot1, rot2, globo, senal: a.fig.senal.visible };
    });
    await m.ctx.close();
    if (r.globo !== 'Pensando…') throw new Error('globo: ' + r.globo);
    if (Math.abs(r.rot1 - r.rot2) > 1e-6) throw new Error('las manos siguen moviéndose');
    return 'sin tecleo en movimiento; globo "Pensando…" visible';
  });
}

// ─────────────────────────────── FASE 3: movimiento ───────────────────────────────
if (FASES.includes(3)) {
  await paso('F3 · recorridos 3D: no cruzan tabiques ni muebles ajenos; pasan por las puertas', async () => {
    const cruzaTabique = ([ax, ay], [bx, by]) => {
      for (const [eje, en, desde, hasta] of plano.PARTITIONS) {
        const [p, q, r, s2] = eje === 'x' ? [ax, bx, ay, by] : [ay, by, ax, bx];
        if ((p - en) * (q - en) >= 0) continue;
        const c = r + (s2 - r) * ((en - p) / (q - p));
        if (c > desde - 0.35 && c < hasta + 0.35) return true; // margen: medio cuerpo de la minifigura
      }
      return false;
    };
    const dentro = ([x, y], [a, b, c, d], m = 0) => x > a - m && x < c + m && y > b - m && y < d + m;
    const malos = [];
    for (const id of plano.AGENT_IDS) {
      for (const hacia of ['meeting', 'office']) {
        const r = plano.recorrido3D(id, hacia);
        // obstáculos permitidos: el de su propio asiento (escritorio + silla) y la fila de sillas de la sala de juntas
        const propios = plano.MUEBLES_OBSTACULOS.filter((o) => dentro(plano.SEATS[id], o) || dentro(plano.MEET[id], o));
        for (let i = 1; i < r.length; i++) {
          if (cruzaTabique(r[i - 1], r[i])) malos.push(`${id}→${hacia}: tramo ${i} cruza un tabique`);
          for (let k = 0; k <= 40; k++) {
            const p = [r[i - 1][0] + ((r[i][0] - r[i - 1][0]) * k) / 40, r[i - 1][1] + ((r[i][1] - r[i - 1][1]) * k) / 40];
            const choca = plano.MUEBLES_OBSTACULOS.find((o) => !propios.includes(o) && dentro(p, o, 0.3));
            if (choca) {
              malos.push(`${id}→${hacia}: tramo ${i} pisa el mueble ${choca}`);
              break;
            }
          }
        }
      }
    }
    if (malos.length) throw new Error([...new Set(malos)].join(' | '));
    return '6 recorridos revisados (ida y vuelta de cada agente)';
  });

  const { page, ctx } = await abrir('?calidad=media', { w: 900, h: 600 });
  await paso('F3 · ir a la sala: se levanta, camina, llega a su puesto, se sienta; dura lo mismo que en el SVG', async () => {
    const r = await page.evaluate(async () => {
      const O = window.oficina3d;
      O.pasoManual(true);
      const out = {};
      for (const id of ['copy', 'analista', 'guion']) {
        const a = O.agentes.agentes[id];
        O.fuente.runtime.location[id] = 'meeting'; // lo que hace moveAgent() al empezar
        const dt = 0.02;
        let tiempo = 0;
        let mitad = null;
        let globoCaminando = null;
        let animCaminando = null;
        O.avanzar(dt); // detecta el cambio de ubicación
        while (a.camino && tiempo < 30) {
          O.avanzar(dt);
          tiempo += dt;
          if (mitad === null && a.camino && a.camino.t > a.camino.ms / 2) {
            mitad = a.fig.sentado();
            globoCaminando = O.etiquetas.items.get(id).texto;
            animCaminando = a.anim;
          }
        }
        for (let i = 0; i < 40; i++) O.avanzar(dt);
        out[id] = { ms: Math.round(tiempo * 1000), x: a.contenedor.position.x, z: a.contenedor.position.z, giro: a.contenedor.rotation.y, sentado: a.fig.sentado(), mitad, globoCaminando, animCaminando };
      }
      return out;
    });
    const { duracionCaminata } = plano;
    for (const [id, x] of Object.entries(r)) {
      const [mx, my] = plano.MEET[id];
      const esperado = duracionCaminata(id, 'meeting');
      if (Math.abs(x.x - mx * 2) > 0.05 || Math.abs(x.z - my * 2) > 0.05) throw new Error(`${id} terminó en ${x.x},${x.z}`);
      if (Math.abs(x.ms - esperado) > esperado * 0.1) throw new Error(`${id}: ${x.ms} ms (SVG ${Math.round(esperado)} ms)`);
      if (x.mitad > 0.1) throw new Error(`${id} caminó sentado (${x.mitad})`);
      if (x.sentado < 0.99 || Math.abs(x.giro) > 1e-3) throw new Error(`${id} no quedó sentado mirando la mesa`);
      if (x.globoCaminando !== '' || x.animCaminando !== 'walking') throw new Error(`${id}: al caminar anim ${x.animCaminando}, globo "${x.globoCaminando}"`);
    }
    return Object.entries(r).map(([id, x]) => `${id} ${x.ms} ms (SVG ${Math.round(plano.duracionCaminata(id, 'meeting'))})`).join(' · ');
  });

  await paso('F3 · volver a la oficina por el mismo camino al revés y sentarse en su asiento', async () => {
    const r = await page.evaluate(() => {
      const O = window.oficina3d;
      const out = {};
      for (const id of ['copy', 'analista', 'guion']) {
        const a = O.agentes.agentes[id];
        O.fuente.runtime.location[id] = 'office';
        let n = 0;
        O.avanzar(0.02);
        while (a.camino && n++ < 2000) O.avanzar(0.02);
        for (let i = 0; i < 40; i++) O.avanzar(0.02);
        out[id] = { x: a.contenedor.position.x, z: a.contenedor.position.z, sentado: a.fig.sentado(), ms: n * 20 };
      }
      return out;
    });
    for (const [id, x] of Object.entries(r)) {
      const [sx, sy] = plano.SEATS[id];
      if (Math.abs(x.x - sx * 2) > 0.05 || Math.abs(x.z - sy * 2) > 0.05 || x.sentado < 0.99) throw new Error(`${id}: ${JSON.stringify(x)}`);
      const esperado = plano.duracionCaminata(id, 'office');
      if (Math.abs(x.ms - esperado) > esperado * 0.1) throw new Error(`${id}: ${x.ms} ms (SVG ${Math.round(esperado)})`);
    }
    return 'los tres vuelven a SEATS sentados';
  });

  await paso('F3 · órdenes seguidas se encolan (como moveAgent): ida y vuelta completas', async () => {
    const r = await page.evaluate(() => {
      const O = window.oficina3d;
      const a = O.agentes.agentes.guion;
      O.fuente.runtime.location.guion = 'meeting';
      O.avanzar(0.02);
      O.avanzar(0.3);
      O.fuente.runtime.location.guion = 'office'; // vuelve antes de llegar
      const visto = [];
      for (let i = 0; i < 2000; i++) {
        O.avanzar(0.02);
        const k = a.camino?.hacia || 'quieto';
        if (visto.at(-1) !== k) visto.push(k);
      }
      return { visto, x: a.contenedor.position.x, z: a.contenedor.position.z };
    });
    if (JSON.stringify(r.visto) !== JSON.stringify(['meeting', 'office', 'quieto'])) throw new Error(JSON.stringify(r.visto));
    if (Math.abs(r.x - plano.SEATS.guion[0] * 2) > 0.05) throw new Error('no terminó en su asiento');
    return 'termina la ida y luego hace la vuelta';
  });

  await paso('F3 · captura a mitad de camino', async () => {
    await page.evaluate(() => {
      const O = window.oficina3d;
      O.vistaGeneral(0);
      document.getElementById('panel').open = false;
      for (const id of ['copy', 'analista', 'guion']) O.fuente.runtime.location[id] = 'meeting';
      O.avanzar(0.02);
      for (let i = 0; i < 90; i++) O.avanzar(0.02);
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: CAPTURAS + 'f3-caminando.png' });
    await page.evaluate(() => {
      const O = window.oficina3d;
      for (let i = 0; i < 1000; i++) O.avanzar(0.02);
      for (const id of ['copy', 'analista', 'guion']) O.fuente.runtime.location[id] = 'office';
      O.avanzar(0.02);
      for (let i = 0; i < 1000; i++) O.avanzar(0.02);
      O.pasoManual(false);
    });
    return 'guardada';
  });
  await ctx.close();

  await paso('F3 · movimiento reducido: sin caminata, aparece sentado en su puesto', async () => {
    const m = await abrir('?calidad=media', { reducido: true, w: 800, h: 500 });
    const r = await m.page.evaluate(() => {
      const O = window.oficina3d;
      O.pasoManual(true);
      const a = O.agentes.agentes.copy;
      O.fuente.runtime.location.copy = 'meeting';
      O.avanzar(0.02);
      const res = { camino: !!a.camino, x: a.contenedor.position.x, z: a.contenedor.position.z, sentado: a.fig.sentado() };
      O.pasoManual(false);
      return res;
    });
    await m.ctx.close();
    if (r.camino || Math.abs(r.x - plano.MEET.copy[0] * 2) > 0.05 || r.sentado < 0.99) throw new Error(JSON.stringify(r));
    return 'como el SVG con movimiento reducido';
  });
}

// ─────────────────────────────── FASE 4: reuniones ───────────────────────────────
if (FASES.includes(4)) {
  const { page, ctx, errores } = await abrir('?calidad=media', { w: 900, h: 600 });
  const ids = ['copy', 'analista', 'guion'];
  const hablando = (m) => m.map((f) => ids.find((id) => f[id].st === 'talking') || null).filter((x, i, arr) => x && x !== arr[i - 1]);

  await paso('F4 · reunión: llegan caminando, se sientan y hablan en el orden real (analista, guion, copy)', async () => {
    const { resultado, muestras: m } = await grabar(page, `(O) => O.simulador.reunion()`, { velocidad: 2, extraMs: 800 });
    if (resultado !== 'ok') throw new Error('resultado ' + resultado);
    for (const id of ids) {
      if (!vio(m, id, (a) => a.caminando && a.st === 'meeting' && a.globo === '')) throw new Error(`${id} no caminó a la sala con el globo oculto`);
      const [mx, my] = plano.MEET[id];
      const fin = m.at(-1)[id];
      if (Math.abs(fin.x - mx * 2) > 0.05 || Math.abs(fin.z - my * 2) > 0.05 || fin.sentado < 0.99) throw new Error(`${id} no quedó sentado en su puesto`);
    }
    const orden = hablando(m);
    if (JSON.stringify(orden) !== JSON.stringify(plano.ORDEN_REUNION)) throw new Error('orden: ' + orden);
    // nadie habla mientras camina (la reunión espera la llegada, como runSession)
    if (m.some((f) => ids.some((id) => f[id].st === 'talking' && f[id].caminando))) throw new Error('alguien habló caminando');
    if (!m.some((f) => f.analista.st === 'talking' && f.analista.globo === 'Hablando…' && f.copy.anim === 'escucha' && f.guion.anim === 'escucha')) throw new Error('los demás no escucharon a quien hablaba');
    if (m.some((f) => ids.some((id) => f[id].st === 'meeting' && f[id].globo !== ''))) throw new Error('globo visible en reunión sin hablar');
    if (errores.length) throw new Error(errores.join(' | '));
    return 'orden ' + orden.join(' → ');
  });

  await paso('F4 · quien escucha mira a quien habla', async () => {
    const r = await page.evaluate(async () => {
      const O = window.oficina3d;
      const { THREE } = O;
      O.pasoManual(true);
      O.fuente.setStatus('analista', 'talking');
      for (let i = 0; i < 60; i++) O.avanzar(0.03);
      const salida = {};
      for (const id of ['copy', 'guion']) {
        const yo = O.agentes.agentes[id].fig.cabeza;
        const frente = new THREE.Vector3(0, 0, 1).transformDirection(yo.matrixWorld).setY(0).normalize();
        const otro = O.agentes.cabezaDe('analista', new THREE.Vector3()).sub(yo.getWorldPosition(new THREE.Vector3())).setY(0).normalize();
        salida[id] = Math.round((Math.acos(Math.min(1, frente.dot(otro))) * 180) / Math.PI);
      }
      O.fuente.setStatus('analista', 'meeting');
      for (let i = 0; i < 30; i++) O.avanzar(0.03);
      O.pasoManual(false);
      return salida;
    });
    // la cabeza de una minifigura gira como máximo ~52° (límite anatómico): se acepta mirar "hacia" (no clavado)
    for (const [id, grados] of Object.entries(r)) if (grados > 40) throw new Error(`${id} mira a ${grados}° de Alex`);
    return Object.entries(r).map(([id, g]) => `${id} a ${g}°`).join(' · ') + ' de quien habla';
  });

  await paso('F4 · investigación: Alex busca (lupa y globo) y luego vuelve a "meeting"', async () => {
    const { muestras: m } = await grabar(page, `(O) => O.simulador.reunion({ investigar: true })`, { velocidad: 2, extraMs: 600 });
    if (!vio(m, 'analista', (a) => a.st === 'searching' && a.senal)) throw new Error('sin lupa al investigar');
    if (!vio(m, 'analista', (a) => a.st === 'searching' && !a.caminando && a.anim === 'searching' && a.globo === 'Buscando en la web…')) throw new Error('no se vio a Alex buscando sentado');
    if (m.at(-1).analista.st !== 'meeting') throw new Error('no volvió a meeting');
    return 'mientras camina se ve caminando; al llegar, buscando';
  });

  await paso('F4 · armar el plan: Sam (moderador) habla y los demás escuchan', async () => {
    const { muestras: m } = await grabar(page, `(O) => O.simulador.reunion({ plan: true })`, { velocidad: 2, extraMs: 600 });
    if (JSON.stringify(hablando(m)) !== JSON.stringify(['guion'])) throw new Error('hablaron: ' + hablando(m));
    if (!vio(m, 'copy', (a, f) => f.guion.st === 'talking' && a.anim === 'escucha')) throw new Error('Nico no escuchó a Sam');
    return 'solo habla el moderador';
  });

  await paso('F4 · pausa (cancelada en un turno): el turno vuelve a "meeting" y siguen en la sala', async () => {
    const { resultado, muestras: m } = await grabar(page, `(O) => O.simulador.reunion({ cancelarEnTurno: 'guion' })`, { velocidad: 2, extraMs: 600 });
    if (resultado !== 'pausa') throw new Error('resultado ' + resultado);
    if (hablando(m).includes('copy')) throw new Error('siguió hablando después de la pausa');
    const fin = m.at(-1);
    if (ids.some((id) => fin[id].st !== 'meeting' || fin[id].loc !== 'meeting')) throw new Error(JSON.stringify(fin));
    return 'quedan sentados en la sala, como runSession() al abortar';
  });

  await paso('F4 · agente ocupado al convocar: conserva su estado real y llega a la sala trabajando', async () => {
    await page.evaluate(() => window.oficina3d.simulador.terminarReunion());
    await page.waitForTimeout(100);
    const { muestras: m } = await grabar(
      page,
      `async (O) => { const r = O.simulador.responder('copy', { pensar: 6500, trozos: 4 }); await new Promise((x) => setTimeout(x, 200)); const reu = O.simulador.reunion({ participantes: ['copy', 'guion'], plan: true }); await r; await reu; }`,
      { velocidad: 1, extraMs: 2500 }
    );
    if (!vio(m, 'copy', (a) => a.caminando && a.st === 'thinking')) throw new Error('Nico debió caminar a la sala sin dejar de pensar');
    if (!vio(m, 'copy', (a) => !a.caminando && a.loc === 'meeting' && a.anim === 'thinking')) throw new Error('Nico no siguió pensando en la sala');
    if (!vio(m, 'copy', (a) => a.st === 'meeting' && a.anim === 'terminado')) throw new Error('al terminar en la sala no hubo gesto (idleStatus → meeting)');
    return 'setStatus conserva el estado ocupado; al terminar pasa a "meeting" (idleStatus)';
  });

  await paso('F4 · terminar la reunión: vuelven a su oficina y quedan en reposo', async () => {
    const { muestras: m } = await grabar(page, `(O) => O.simulador.terminarReunion()`, { velocidad: 1, extraMs: 1500 });
    const fin = m.at(-1);
    for (const id of ['copy', 'guion']) {
      const [sx, sy] = plano.SEATS[id];
      if (fin[id].st !== 'idle' || fin[id].loc !== 'office' || Math.abs(fin[id].x - sx * 2) > 0.05 || Math.abs(fin[id].z - sy * 2) > 0.05) throw new Error(`${id}: ${JSON.stringify(fin[id])}`);
      if (!vio(m, id, (a) => a.caminando && a.st === 'meeting')) throw new Error(`${id} no caminó de vuelta en "meeting"`);
    }
    return 'endMeeting(): caminan en "meeting" y al llegar pasan a "idle"';
  });

  await paso('F4 · captura de la reunión con Alex hablando', async () => {
    await page.evaluate(async () => {
      const O = window.oficina3d;
      O.simulador.terminarReunion();
      document.getElementById('panel').open = false;
      O.pasoManual(true);
      for (const id of ['copy', 'analista', 'guion']) {
        O.fuente.runtime.location[id] = 'meeting';
        O.fuente.setStatus(id, 'meeting');
      }
      for (let i = 0; i < 400; i++) O.avanzar(0.03);
      O.fuente.setStatus('analista', 'talking');
      for (let i = 0; i < 60; i++) O.avanzar(0.03);
      O.enfocar('juntas', 0);
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: CAPTURAS + 'f4-reunion.png' });
    await page.evaluate(() => {
      const O = window.oficina3d;
      O.fuente.setStatus('analista', 'meeting');
      O.pasoManual(false);
    });
    return 'guardada';
  });
  await ctx.close();
}

// ─────────────────────────────── FASE 5: rendimiento ───────────────────────────────
if (FASES.includes(5)) {
  const metricas = {};
  const escenarios = {
    'S1 · los tres escribiendo': `(O) => { for (const id of ['copy','analista','guion']) { O.fuente.chat(id).push({ role: 'model', text: '' }); O.fuente.setStatus(id, 'thinking'); } return (i) => { for (const id of ['copy','analista','guion']) { O.fuente.chat(id).at(-1).text += 'x'; O.fuente.emit('chat', { agentId: id, type: 'update' }); } }; }`,
    'S2 · uno busca, uno habla, uno camina': `(O) => { O.fuente.runtime.location.guion = 'meeting'; for (let i = 0; i < 300; i++) O.avanzar(0.03); O.fuente.setStatus('guion', 'talking'); O.fuente.setStatus('analista', 'searching'); O.fuente.runtime.location.copy = 'meeting'; return () => {}; }`,
    'S3 · los tres caminando a la vez': `(O) => { for (const id of ['copy','analista','guion']) O.fuente.runtime.location[id] = 'meeting'; return () => {}; }`,
  };
  for (const nivel of ['alta', 'media']) {
    const { page, ctx, errores } = await abrir('?calidad=' + nivel, { w: 1280, h: 800 });
    for (const [nombre, preparar] of Object.entries(escenarios)) {
      await paso(`F5 · ${nivel} · ${nombre}: llamadas, triángulos y tiempo de CPU por cuadro`, async () => {
        const r = await page.evaluate(async (preparar) => {
          const O = window.oficina3d;
          O.pasoManual(true);
          O.vistaGeneral(0);
          // estado limpio
          for (const id of ['copy', 'analista', 'guion']) {
            O.fuente.setStatus(id, 'idle');
            O.fuente.runtime.location[id] = 'office';
          }
          for (let i = 0; i < 400; i++) O.avanzar(0.03);
          const cada = new Function('O', `return (${preparar})(O)`)(O);
          let js = 0;
          let rend = 0;
          let calls = 0;
          let tri = 0;
          let animando = 0;
          const N = 60;
          for (let i = 0; i < N; i++) {
            cada(i);
            const t0 = performance.now();
            O.avanzar(1 / 30);
            const t1 = performance.now();
            const m = O.medir({ conSombras: O.agentes.detalle().sombrasReales });
            const t2 = performance.now();
            js += t1 - t0;
            rend += t2 - t1;
            calls = Math.max(calls, m.calls);
            tri = Math.max(tri, m.triangulos);
            animando += Object.values(O.agentes.agentes).filter((a) => a.anim !== 'idle').length;
          }
          for (const id of ['copy', 'analista', 'guion']) {
            O.fuente.setStatus(id, 'idle');
            O.fuente.runtime.location[id] = 'office';
          }
          for (let i = 0; i < 600; i++) O.avanzar(0.03);
          O.pasoManual(false);
          return { calls, tri, jsMs: +(js / N).toFixed(3), renderCpuMs: +(rend / N).toFixed(2), animadosPromedio: +(animando / N).toFixed(1) };
        }, preparar);
        metricas[`${nivel} · ${nombre}`] = r;
        if (r.animadosPromedio < 2.5) throw new Error('no estaban los tres animados: ' + r.animadosPromedio);
        if (r.calls >= 150) throw new Error(`${r.calls} llamadas`);
        if (r.tri >= (nivel === 'alta' ? 300000 : 120000)) throw new Error(`${r.tri} triángulos`);
        return `${r.calls} llamadas · ${(r.tri / 1000).toFixed(0)} mil triángulos · lógica ${r.jsMs} ms · envío al GPU ${r.renderCpuMs} ms`;
      });
    }
    await paso(`F5 · ${nivel} · reunión completa de 3 turnos (S4)`, async () => {
      const r = await page.evaluate(async () => {
        const O = window.oficina3d;
        O.pasoManual(true);
        O.simulador.velocidad = 2;
        let max = { calls: 0, tri: 0 };
        let previo = performance.now();
        let cuadros = 0;
        let js = 0;
        const reloj = setInterval(() => {
          const ahora = performance.now();
          const t0 = performance.now();
          O.avanzar(Math.min(1, (ahora - previo) / 1000));
          js += performance.now() - t0;
          previo = ahora;
          const m = O.medir();
          cuadros++;
          max = { calls: Math.max(max.calls, m.calls), tri: Math.max(max.tri, m.triangulos) };
        }, 50);
        await O.simulador.reunion();
        await O.simulador.terminarReunion();
        clearInterval(reloj);
        O.pasoManual(false);
        return { ...max, cuadros, jsMs: +(js / cuadros).toFixed(3) };
      });
      metricas[`${nivel} · S4 reunión completa`] = r;
      if (r.calls >= 150 || r.tri >= (nivel === 'alta' ? 300000 : 120000)) throw new Error(JSON.stringify(r));
      return `${r.calls} llamadas · ${(r.tri / 1000).toFixed(0)} mil triángulos · lógica ${r.jsMs} ms/cuadro (${r.cuadros} cuadros)`;
    });
    if (errores.length) console.log('    errores de la página:', errores.join(' | '));
    await ctx.close();
  }

  await paso('F5 · sombras reales opcionales: solo en Alta; se recalculan al moverse los personajes', async () => {
    const { page, ctx } = await abrir('?calidad=alta', { w: 1000, h: 650 });
    const r = await page.evaluate(async () => {
      const O = window.oficina3d;
      O.pasoManual(true);
      O.sombrasReales(true);
      const proyecta = () => {
        let n = 0;
        O.agentes.grupo.traverse((o) => o.isMesh && o.castShadow && n++);
        return n;
      };
      const enAlta = { proyecta: proyecta(), disco: Object.values(O.agentes.agentes).some((a) => a.sombra.visible) };
      for (const id of ['copy', 'analista', 'guion']) O.fuente.setStatus(id, 'thinking');
      O.avanzar(1 / 30);
      const conSombras = O.medir({ conSombras: true });
      O.aplicarCalidad('media');
      const enMedia = { proyecta: proyecta(), disco: Object.values(O.agentes.agentes).every((a) => a.sombra.visible), deshabilitado: document.getElementById('sombras-reales').disabled };
      for (const id of ['copy', 'analista', 'guion']) O.fuente.setStatus(id, 'idle');
      O.pasoManual(false);
      return { enAlta, conSombras, enMedia };
    });
    await page.screenshot({ path: CAPTURAS + 'f5-sombras.png' });
    await ctx.close();
    if (!(r.enAlta.proyecta > 0) || r.enAlta.disco) throw new Error('en Alta no se activaron: ' + JSON.stringify(r.enAlta));
    if (r.enMedia.proyecta !== 0 || !r.enMedia.disco || !r.enMedia.deshabilitado) throw new Error('en Media no se desactivaron: ' + JSON.stringify(r.enMedia));
    metricas['alta · sombras reales (cuadro con sombras)'] = { calls: r.conSombras.calls, tri: r.conSombras.triangulos };
    return `Alta con sombras reales: ${r.conSombras.calls} llamadas · ${(r.conSombras.triangulos / 1000).toFixed(0)} mil triángulos por cuadro mientras se mueven`;
  });

  await paso('F5 · sin actividad 20 s: los personajes y el dibujo se detienen; un toque los despierta', async () => {
    const { page, ctx } = await abrir('?calidad=baja', { w: 800, h: 500 });
    const r = await page.evaluate(async () => {
      const O = window.oficina3d;
      await new Promise((res) => setTimeout(res, 21500));
      const pausado = O.pausado();
      const f0 = O.renderer.info.render.frame;
      await new Promise((res) => setTimeout(res, 3000));
      const f1 = O.renderer.info.render.frame;
      dispatchEvent(new Event('pointerdown'));
      await new Promise((res) => setTimeout(res, 2500));
      const f2 = O.renderer.info.render.frame;
      // un estado real también despierta (aunque nadie toque)
      await new Promise((res) => setTimeout(res, 21500));
      const pausado2 = O.pausado();
      O.fuente.setStatus('copy', 'thinking');
      await new Promise((res) => setTimeout(res, 2000));
      const despierto = !O.pausado();
      O.fuente.setStatus('copy', 'idle');
      return { pausado, cuadrosEnPausa: f1 - f0, cuadrosDespierto: f2 - f1, pausado2, despierto };
    });
    await ctx.close();
    if (!r.pausado || r.cuadrosEnPausa !== 0) throw new Error('no se detuvo: ' + JSON.stringify(r));
    if (r.cuadrosDespierto < 1) throw new Error('no se despertó al tocar');
    if (!r.pausado2 || !r.despierto) throw new Error('un cambio de estado real no lo despertó: ' + JSON.stringify(r));
    return '0 cuadros en pausa; se reanuda con un toque o con un cambio de estado real';
  });
  console.log('MÉTRICAS-PERSONAJES ' + JSON.stringify(metricas));
}

// ─────────────────────────────── NICO: modelo propio, acciones y utilería ───────────────────────────────
if (FASES.includes('nico')) {
  const { page, ctx, errores } = await abrir('?calidad=alta', { w: 1000, h: 700 });
  // utilidades en la página: avanzar con paso fijo y registrar lo que hace Nico
  await page.evaluate(() => {
    const O = window.oficina3d;
    O.pasoManual(true);
    window.__nico = {
      a: () => O.agentes.agentes.copy,
      grabar(segundos, cada = 1 / 30, extra) {
        const a = O.agentes.agentes.copy;
        const out = [];
        for (let t = 0; t < segundos; t += cada) {
          extra?.(t);
          O.avanzar(cada);
          const u = a.fig.utileria();
          out.push({ t, acc: a.fig.accion(), anim: a.anim, lib: u.libreta, boli: u.boligrafo, senal: a.fig.senal.visible, E: a.fig.expresion(), vel: a.fig.velocidad, globo: O.etiquetas.items.get('copy').texto });
        }
        return out;
      },
    };
  });

  await paso('NICO · modelo propio por piezas: pelo, cara, utilería escondida en reposo', async () => {
    const r = await page.evaluate(() => {
      const a = window.__nico.a();
      const nombres = [];
      a.fig.objeto.traverse((o) => o.isMesh && nombres.push(o.name));
      return { modelo: a.modelo.objeto.userData.modelo, nombres, util: a.fig.utileria(), libreta: a.fig.libreta.visible, boli: a.fig.boligrafo.visible, acc: a.fig.accesorios };
    });
    if (r.modelo !== 'nico') throw new Error('modelo ' + r.modelo);
    for (const n of ['cara', 'pelo:plastico', 'torso:impreso', 'piernaI:impreso', 'cadera:impreso', 'tapa:plastico', 'cuerpo-boli:plastico']) if (!r.nombres.includes(n)) throw new Error('falta ' + n);
    if (r.libreta || r.boli || r.util.libreta || r.util.boligrafo) throw new Error('la utilería se ve en reposo');
    if (errores.length) throw new Error(errores.join(' | '));
    return `${r.nombres.length} mallas (unidas por articulación y por tipo de material)`;
  });

  await paso('NICO · LEGO estricto: solo giran las articulaciones reales, y solo en su eje', async () => {
    const r = await page.evaluate(() => {
      const fig = window.__nico.a().fig;
      const art = fig.articulaciones;
      const fijos = ['torso', 'cadera', 'pelo'].map((n) => fig.objeto.getObjectByName(n));
      const ejes = { x: 0, y: 1, z: 2 };
      let peor = null;
      let max = 0;
      const base = {};
      for (const [n, [o]] of Object.entries(art)) base[n] = [o.rotation.x, o.rotation.y, o.rotation.z];
      const revisar = (accion) => {
        for (const [n, [o, eje]] of Object.entries(art)) {
          const rot = [o.rotation.x, o.rotation.y, o.rotation.z];
          rot.forEach((v, i) => {
            if (i === ejes[eje]) return;
            const d = Math.abs(v - base[n][i]);
            if (d > 1e-6 && d > max) {
              max = d;
              peor = `${n}.${'xyz'[i]} en ${accion}`;
            }
          });
        }
        for (const o of fijos) if (Math.abs(o.rotation.x) + Math.abs(o.rotation.y) + Math.abs(o.rotation.z) > 1e-6) peor = `${o.name} giró en ${accion}`;
      };
      const casos = [['thinking', 'teclear'], ['thinking', 'pensar'], ['thinking', 'idea'], ['thinking', 'anotar'], ['talking', 'hablar'], ['talking', 'consultar'], ['escucha', 'asentir'], ['escucha', 'notas'], ['searching', 'escanear'], ['terminado', 'festejo'], ['idle', 'pelo'], ['idle', 'saludar'], ['idle', 'estirarse'], ['idle', 'tamborilear'], ['idle', 'repasar'], ['idle', 'reposo']];
      for (const [estado, accion] of casos) {
        fig.fijarAccion(accion);
        for (let i = 0; i < 90; i++) {
          fig.animar(estado, 3000 + i / 30, 1 / 30);
          revisar(accion);
        }
      }
      fig.velocidad = 8;
      fig.fijarAccion(null);
      for (let i = 0; i < 90; i++) {
        fig.animar('walking', 3100 + i / 30, 1 / 30);
        revisar('caminar');
      }
      fig.velocidad = 0;
      fig.animar('idle', 3200, 1);
      return { peor, max };
    });
    if (r.peor) throw new Error(`gira fuera de su eje: ${r.peor} (${r.max.toFixed(3)} rad)`);
    return 'cabeza solo gira a los lados · brazos y piernas solo adelante/atrás · manos solo en su muñeca · torso y cadera fijos (17 acciones)';
  });

  await paso('NICO · la capucha no atraviesa la cabeza, el pelo ni los brazos en ninguna acción', async () => {
    const r = await page.evaluate(() => {
      const THREE = window.oficina3d.THREE;
      const fig = window.__nico.a().fig;
      const cap = fig.capucha;
      const art = fig.articulaciones;
      const v = new THREE.Vector3();
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const dSeg = (p, p0, p1) => {
        const ab = b.subVectors(p1, p0);
        const t = Math.max(0, Math.min(1, a.subVectors(p, p0).dot(ab) / ab.lengthSq()));
        return p.distanceTo(a.copy(p0).addScaledVector(ab, t));
      };
      const codo = Math.cos(0.62);
      const errores = new Set();
      const revisar = (accion) => {
        fig.objeto.updateMatrixWorld(true);
        const cab = art.cabeza[0];
        const brazos = [[art.hombroI[0], -1], [art.hombroD[0], 1]];
        for (let i = 0; i < cap.length; i += 9) {
          v.set(cap[i], cap[i + 1], cap[i + 2]).applyMatrix4(fig.torso.matrixWorld);
          // cabeza (cilindro de radio .6 y alto 1.1) y pelo (que empieza a .26 de la base de la cabeza en la nuca)
          const h = cab.worldToLocal(v.clone());
          const rad = Math.hypot(h.x, h.z);
          if (h.y > 0 && h.y < 1.1 && rad < 0.6) errores.add(`cabeza en ${accion}`);
          if (h.y > 0.26 && rad < 0.76) errores.add(`pelo en ${accion}`);
          // brazos: cápsulas del hombro al codo y del codo a la muñeca
          for (const [hombro, lado] of brazos) {
            const q = hombro.worldToLocal(v.clone());
            const p0 = new THREE.Vector3(0, 0, 0);
            const p1 = new THREE.Vector3(lado * 0.11, -0.62, 0);
            const p2 = new THREE.Vector3(lado * 0.11, -0.62 - 0.5 * codo, 0.5 * Math.sin(0.62));
            if (dSeg(q, p0, p1) < 0.26 || dSeg(q, p1, p2) < 0.235) errores.add(`brazo en ${accion}`);
          }
        }
      };
      const casos = [['thinking', 'teclear'], ['thinking', 'pensar'], ['thinking', 'idea'], ['thinking', 'anotar'], ['talking', 'hablar'], ['escucha', 'notas'], ['searching', 'escanear'], ['terminado', 'festejo'], ['idle', 'pelo'], ['idle', 'saludar'], ['idle', 'estirarse'], ['idle', 'tamborilear'], ['idle', 'repasar'], ['idle', 'reposo']];
      let t = 5000;
      for (const sentado of [true, false]) {
        fig.sentar(sentado, true);
        for (const [estado, accion] of casos) {
          fig.fijarAccion(accion);
          for (let i = 0; i < 75; i++) {
            fig.animar(estado, (t += 1 / 30), 1 / 30);
            if (i % 3 === 0) revisar(accion);
          }
        }
        fig.fijarAccion(null);
        fig.velocidad = 8;
        for (let i = 0; i < 60; i++) {
          fig.animar('walking', (t += 1 / 30), 1 / 30);
          if (i % 3 === 0) revisar('caminar');
        }
        fig.velocidad = 0;
      }
      fig.sentar(true, true);
      fig.animar('idle', (t += 1), 1);
      return [...errores];
    });
    if (r.length) throw new Error('atraviesa: ' + r.join(', '));
    return '14 acciones + caminar, sentado y parado: libre de cabeza, pelo y brazos';
  });

  await paso('NICO · presupuesto: triángulos y llamadas de dibujo por calidad', async () => {
    const r = await page.evaluate(async () => {
      const O = window.oficina3d;
      const medir = () => {
        let tri = 0;
        let mallas = 0;
        O.agentes.agentes.copy.fig.objeto.traverse((o) => {
          if (!o.isMesh || !o.visible) return;
          let vis = true;
          for (let p = o.parent; p; p = p.parent) if (!p.visible) vis = false;
          if (!vis) return;
          mallas++;
          tri += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
        });
        return { tri, mallas, escena: O.medir() };
      };
      O.aplicarCalidad('alta');
      const alta = medir();
      O.aplicarCalidad('media');
      const media = medir();
      O.aplicarCalidad('alta');
      return { alta, media };
    });
    if (r.alta.tri > 25000) throw new Error('Alta: ' + r.alta.tri);
    if (r.media.tri > 8000) throw new Error('Media: ' + r.media.tri);
    if (r.alta.mallas > 22) throw new Error('llamadas de Nico: ' + r.alta.mallas);
    if (r.alta.escena.calls >= 150 || r.alta.escena.triangulos >= 300000 || r.media.escena.triangulos >= 120000) throw new Error(JSON.stringify(r));
    return `Nico: Alta ${r.alta.tri} triángulos / ${r.alta.mallas} llamadas · Media ${r.media.tri} · escena Alta ${r.alta.escena.calls} llamadas / ${(r.alta.escena.triangulos / 1000).toFixed(0)} mil · Media ${(r.media.escena.triangulos / 1000).toFixed(0)} mil`;
  });

  await paso('NICO · "Pensando…": teclea → piensa → idea → anota en la libreta → teclea; la utilería solo al anotar', async () => {
    const m = await page.evaluate(() => {
      const O = window.oficina3d;
      O.fuente.chat('copy').push({ role: 'user', text: 'x' }, { role: 'model', text: '', pending: true });
      O.fuente.setStatus('copy', 'thinking');
      const g = window.__nico.grabar(16);
      return g;
    });
    const orden = m.map((f) => f.acc).filter((x, i, arr) => x !== arr[i - 1]);
    const esperado = ['teclear', 'pensar', 'idea', 'anotar', 'teclear'];
    if (JSON.stringify(orden.slice(0, 5)) !== JSON.stringify(esperado)) throw new Error('orden: ' + orden.join(' → '));
    if (m.some((f) => f.acc !== 'anotar' && f.lib > 0.5)) throw new Error('libreta fuera de "anotar"');
    if (!m.some((f) => f.acc === 'anotar' && f.lib > 0.99 && f.boli > 0.99)) throw new Error('no aparecieron libreta y bolígrafo');
    if (m.some((f) => !f.senal)) throw new Error('el bombillo no se vio todo el tiempo al pensar');
    if (m.some((f) => f.globo !== 'Pensando…')) throw new Error('globo distinto a "Pensando…"');
    const idea = m.find((f) => f.acc === 'idea' && f.E.redondo > 0.6 && f.E.ojo > 1.15);
    if (!idea) throw new Error('la cara de idea no apareció');
    const anota = m.filter((f) => f.acc === 'anotar' && f.lib > 0.99);
    if (!anota.some((f) => f.E.lengua > 0.6)) throw new Error('sin cara de concentración al anotar');
    return orden.slice(0, 5).join(' → ');
  });

  await paso('NICO · si llega texto real ("Escribiendo…") deja la libreta y teclea rápido', async () => {
    const r = await page.evaluate(() => {
      const O = window.oficina3d;
      const a = window.__nico.a();
      // espera a que esté anotando
      let n = 0;
      while (a.fig.accion() !== 'anotar' && n++ < 1200) O.avanzar(1 / 30);
      window.__nico.grabar(0.8);
      const chat = O.fuente.chat('copy');
      chat.at(-1).text = 'Hola, aquí va el copy';
      O.fuente.emit('chat', { agentId: 'copy', type: 'update' });
      const g = window.__nico.grabar(0.5);
      chat.at(-1).pending = false;
      O.fuente.setStatus('copy', 'idle');
      const fin = window.__nico.grabar(2.5);
      return { antes: n, g, fin: fin.map((f) => ({ anim: f.anim, lib: f.lib })) };
    });
    if (r.g[0].acc !== 'teclear') throw new Error('siguió en ' + r.g[0].acc);
    if (r.g[0].globo !== 'Escribiendo…') throw new Error('globo ' + r.g[0].globo);
    if (r.g.at(-1).lib > 0.01 || r.g.at(-1).boli > 0.01) throw new Error('la libreta no se guardó');
    if (!r.fin.some((f) => f.anim === 'terminado')) throw new Error('no hizo el gesto de terminado');
    if (r.fin.at(-1).anim !== 'idle') throw new Error('no volvió al reposo');
    return `teclea en el primer cuadro; libreta guardada en ${(r.g.findIndex((f) => f.lib < 0.01) + 1) / 30} s; festejo y reposo`;
  });

  await paso('NICO · festejo: dura 1,7 s, cara feliz y alterna dos variantes', async () => {
    const r = await page.evaluate(() => {
      const fig = window.__nico.a().fig;
      const vuelta = () => {
        let fin = null;
        let feliz = 0;
        let brazos = 0;
        fig.animar('idle', 100, 1 / 30);
        for (let i = 0; i < 90; i++) {
          if (fig.animar('terminado', 100 + i / 30, 1 / 30) && fin === null) fin = i / 30;
          feliz = Math.max(feliz, fig.expresion().feliz);
          brazos = Math.max(brazos, -fig.objeto.getObjectByName('hombroI').rotation.x);
        }
        fig.animar('idle', 104, 1 / 30);
        return { fin, feliz, brazos };
      };
      return [vuelta(), vuelta()];
    });
    for (const v of r) {
      if (v.fin === null || Math.abs(v.fin - 1.7) > 0.05) throw new Error('duración ' + v.fin);
      if (v.feliz < 0.8) throw new Error('sin cara feliz');
    }
    if (!(r[0].brazos > 1.5) === !(r[1].brazos > 1.5)) throw new Error('no alterna variantes: ' + JSON.stringify(r));
    return 'puño arriba y estirón con los dos brazos, alternados';
  });

  await paso('NICO · reunión: al escuchar a veces toma notas; al hablar mueve la boca por sílabas y a veces en "O"', async () => {
    const r = await page.evaluate(() => {
      const fig = window.__nico.a().fig;
      const acciones = new Set();
      let lib = 0;
      for (let i = 0; i < 30 * 40; i++) {
        fig.animar('escucha', 200 + i / 30, 1 / 30);
        acciones.add(fig.accion());
        if (fig.accion() === 'notas') lib = Math.max(lib, fig.utileria().libreta);
      }
      let bmin = 1;
      let bmax = 0;
      let redondo = 0;
      for (let i = 0; i < 30 * 12; i++) {
        fig.animar('talking', 300 + i / 30, 1 / 30);
        const E = fig.expresion();
        if (fig.accion() === 'hablar') {
          bmin = Math.min(bmin, E.boca);
          bmax = Math.max(bmax, E.boca);
          redondo = Math.max(redondo, E.redondo);
        }
      }
      fig.animar('idle', 400, 1 / 30);
      return { acciones: [...acciones], lib, bmin, bmax, redondo };
    });
    if (!r.acciones.includes('notas') || r.lib < 0.99) throw new Error('no tomó notas: ' + JSON.stringify(r));
    if (!(r.bmax - r.bmin > 0.45)) throw new Error('boca casi quieta: ' + JSON.stringify(r));
    if (!(r.redondo > 0.35)) throw new Error('nunca en "O"');
    return `escucha: ${r.acciones.join(', ')} · boca ${r.bmin.toFixed(2)}–${r.bmax.toFixed(2)}`;
  });

  await paso('NICO · reposo: acciones de vida (pelo, saludar, estirarse, tamborilear, repasar) sin libreta fuera de "repasar"', async () => {
    const r = await page.evaluate(() => {
      const fig = window.__nico.a().fig;
      const vistas = new Set();
      let malo = null;
      for (let i = 0; i < 30 * 90; i++) {
        fig.animar('idle', 500 + i / 30, 1 / 30);
        const acc = fig.accion();
        vistas.add(acc);
        if (fig.utileria().libreta > 0.5 && acc !== 'repasar') malo = acc;
        if (fig.utileria().boligrafo > 0.5) malo = acc + ' (bolígrafo)';
      }
      return { vistas: [...vistas], malo };
    });
    const extras = r.vistas.filter((x) => x !== 'reposo');
    if (extras.length < 3) throw new Error('pocas acciones: ' + r.vistas.join(', '));
    if (r.malo) throw new Error('utilería fuera de lugar en ' + r.malo);
    return r.vistas.join(', ');
  });

  await paso('NICO · sentado: ninguna acción atraviesa el escritorio ni la silla', async () => {
    const r = await page.evaluate(() => {
      const O = window.oficina3d;
      const THREE = O.THREE;
      const a = window.__nico.a();
      const fichas = O.salas.copy.userData.modelos;
      const desk = fichas.find((m) => m.item.modelo === 'escritorio').cajaMundo;
      const sc = fichas.find((m) => m.item.modelo === 'silla').objeto.position;
      const respaldo = new THREE.Box3(new THREE.Vector3(sc.x - 1.2, 1.7, sc.z - 1.3), new THREE.Vector3(sc.x + 1.2, 4.7, sc.z - 0.72));
      const choques = [];
      const v = new THREE.Vector3();
      for (const [estado, accion] of [['thinking', 'teclear'], ['thinking', 'pensar'], ['thinking', 'idea'], ['thinking', 'anotar'], ['idle', 'pelo'], ['idle', 'saludar'], ['idle', 'estirarse'], ['idle', 'tamborilear'], ['idle', 'repasar'], ['searching', 'escanear'], ['terminado', 'festejo']]) {
        a.fig.fijarAccion(accion);
        let peor = 0;
        for (let i = 0; i < 75; i++) {
          a.fig.animar(estado, 600 + i / 30, 1 / 30);
          if (i % 5) continue;
          a.contenedor.updateMatrixWorld(true);
          a.fig.objeto.traverse((o) => {
            if (!o.isMesh || o.parent?.name === 'senal' || o.parent?.parent?.name === 'senal') return;
            for (let p = o; p; p = p.parent) if (!p.visible) return;
            // vértices reales (no la caja de la malla entera): una mano sobre el teclado no es un choque
            const pos = o.geometry.attributes.position;
            for (let k = 0; k < pos.count; k += 3) {
              v.fromBufferAttribute(pos, k).applyMatrix4(o.matrixWorld);
              if (v.y < desk.max.y - 0.12 && desk.containsPoint(v)) peor = Math.max(peor, desk.max.y - v.y);
              if (respaldo.containsPoint(v)) peor = Math.max(peor, 9);
            }
          });
        }
        if (peor) choques.push(`${accion} (${peor.toFixed(2)})`);
      }
      a.fig.fijarAccion(null);
      a.fig.animar('idle', 700, 1);
      return choques;
    });
    if (r.length) throw new Error('atraviesa: ' + r.join(', '));
    return '11 acciones revisadas vértice a vértice';
  });

  await paso('NICO · caminata: arranca y frena con rampa, misma duración del SVG, pasos según la velocidad', async () => {
    const r = await page.evaluate(async () => {
      const O = window.oficina3d;
      const a = window.__nico.a();
      O.fuente.runtime.location.copy = 'meeting';
      const g = [];
      let t = 0;
      while (t < 8) {
        O.avanzar(1 / 30);
        t += 1 / 30;
        g.push({ t, anim: a.anim, vel: a.fig.velocidad, pierna: a.fig.objeto.getObjectByName('piernaI').rotation.x });
        if (t > 0.5 && a.anim !== 'walking' && g.at(-2)?.anim === 'walking') break;
      }
      O.fuente.runtime.location.copy = 'office';
      for (let i = 0; i < 300; i++) O.avanzar(1 / 30);
      return g;
    });
    const caminando = r.filter((f) => f.anim === 'walking');
    const dur = caminando.length / 30;
    const esperado = plano.duracionCaminata('copy', 'meeting') / 1000;
    if (Math.abs(dur - esperado) > 0.1) throw new Error(`duró ${dur.toFixed(2)} s (SVG ${esperado.toFixed(2)} s)`);
    const v = caminando.map((f) => f.vel);
    const pico = Math.max(...v);
    if (!(v[1] < pico * 0.5 && v.at(-2) < pico * 0.5)) throw new Error('sin rampa: ' + v.slice(0, 4).map((x) => x.toFixed(1)).join(','));
    const medio = caminando.slice(Math.floor(caminando.length * 0.2), Math.floor(caminando.length * 0.8));
    const amp = Math.max(...medio.map((f) => Math.abs(f.pierna)));
    if (amp < 0.3) throw new Error('piernas casi quietas: ' + amp);
    return `${dur.toFixed(2)} s (SVG ${esperado.toFixed(2)} s) · velocidad pico ${pico.toFixed(1)} · zancada ±${amp.toFixed(2)} rad`;
  });

  await paso('NICO · movimiento reducido: postura fija, sin utilería ni oscilaciones', async () => {
    const m = await abrir('?calidad=media', { reducido: true, w: 900, h: 600 });
    const r = await m.page.evaluate(() => {
      const O = window.oficina3d;
      O.pasoManual(true);
      O.fuente.setStatus('copy', 'thinking');
      const a = O.agentes.agentes.copy;
      const muestras = [];
      for (let i = 0; i < 300; i++) {
        O.avanzar(1 / 30);
        muestras.push([a.fig.accion(), a.fig.utileria().libreta, a.fig.manoDer.rotation.x, a.fig.cabeza.rotation.x]);
      }
      O.fuente.setStatus('copy', 'idle');
      return muestras;
    });
    await m.ctx.close();
    if (r.some((x) => x[0] !== 'teclear' || x[1] > 0)) throw new Error('cambió de acción o mostró la libreta');
    if (r.some((x) => Math.abs(x[2] - r[0][2]) > 1e-6 || Math.abs(x[3] - r[0][3]) > 1e-6)) throw new Error('se mueve');
    return '10 s de "Pensando…": teclea quieto, sin libreta';
  });

  await paso('NICO · capturas (anotar, idea, festejo, caminar, reunión)', async () => {
    for (const [nombre, estado, accion, pasos] of [['anotar', 'thinking', 'anotar', 40], ['idea', 'thinking', 'idea', 12], ['festejo', 'terminado', 'festejo', 20], ['pensar', 'thinking', 'pensar', 30]]) {
      await page.evaluate(([estado, accion, pasos]) => {
        const O = window.oficina3d;
        const a = window.__nico.a();
        O.enfocar('copy', 0);
        a.fig.fijarAccion(accion);
        for (let i = 0; i < pasos; i++) a.fig.animar(estado, 800 + i / 30, 1 / 30);
        O.medir();
      }, [estado, accion, pasos]);
      await page.screenshot({ path: `${CAPTURAS}nico-${nombre}.png` });
    }
    await page.evaluate(() => {
      const a = window.__nico.a();
      a.fig.fijarAccion(null);
      a.fig.animar('idle', 900, 1);
    });
    return 'guardadas';
  });

  await paso('NICO · costo de la lógica por cuadro (navegador de pruebas; no son FPS reales)', async () => {
    const r = await page.evaluate(() => {
      const fig = window.__nico.a().fig;
      const medir = (estado) => {
        const t0 = performance.now();
        for (let i = 0; i < 300; i++) fig.animar(estado, 1000 + i / 30, 1 / 30);
        return (performance.now() - t0) / 300;
      };
      const out = { hablar: medir('talking'), pensar: medir('thinking'), caminar: medir('walking'), reposo: medir('idle') };
      fig.animar('idle', 2000, 1);
      return out;
    });
    const peor = Math.max(...Object.values(r));
    if (peor > 2) throw new Error(JSON.stringify(r));
    return Object.entries(r).map(([k, v]) => `${k} ${v.toFixed(2)} ms`).join(' · ') + ' (incluye redibujar la cara)';
  });
  await ctx.close();
}

await browser.close();
console.log(`\n${total - fallos} de ${total} pruebas pasaron.`);
process.exit(fallos ? 1 : 0);
