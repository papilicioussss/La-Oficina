// Niveles de calidad, resolución interna y calidad automática.
//
// Resolución interna: cada nivel tiene una escala de píxeles máxima (nitidez en pantallas densas) y un TOPE de píxeles
// totales, para que un monitor grande (1440p, 4K) no cueste el doble o el cuádruple que uno Full HD. Encima de eso hay
// una escala dinámica (100 % → 85 % → 72 % → 60 %) que la calidad automática usa ANTES de quitar efectos.
//
// Calidad automática: mide el ritmo real de cuadros en ventanas de 1 s, pero solo decide con ventanas en las que la
// escena se dibujó en continuo (personajes trabajando, cámara moviéndose). El objetivo se compara con el LÍMITE REAL
// de la pantalla (60 Hz, 120 Hz… o 30 si el navegador está en ahorro de energía), que se detecta en reposo; así un
// navegador limitado a 30 fps no baja la calidad sin motivo. Si va lento 3 s seguidos baja un paso (primero la
// resolución, después el nivel); si va holgado 8 s seguidos sube un paso, sin pasar del nivel inicial. Si una subida
// provoca una bajada al poco tiempo, deja de intentar subir por un minuto: no oscila.

export const NIVELES = {
  alta: { clave: 'alta', nombre: 'Alta', pixeles: 2, pixelesMax: 3_700_000, sombra: 2048, sombraSuave: 3, barniz: true, entorno: true, taquitosFinos: true, antialias: true },
  media: { clave: 'media', nombre: 'Media', pixeles: 1.5, pixelesMax: 2_200_000, sombra: 1024, sombraSuave: 2, barniz: false, entorno: true, taquitosFinos: false, antialias: true },
  baja: { clave: 'baja', nombre: 'Baja', pixeles: 1, pixelesMax: 1_300_000, sombra: 512, sombraSuave: 1, barniz: false, entorno: false, taquitosFinos: false, antialias: false },
};
export const ORDEN = ['alta', 'media', 'baja'];
export const ESCALAS = [1, 0.85, 0.72, 0.6];

/** Nivel inicial prudente según el equipo. Sin aceleración gráfica (dibujo por software) siempre empieza en Baja. */
export function nivelInicial(gpu = null) {
  if (gpu?.software) return 'baja';
  const celular = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;
  const memoria = navigator.deviceMemory || 4;
  const nucleos = navigator.hardwareConcurrency || 4;
  if (memoria <= 2 || nucleos <= 2) return 'baja';
  if (celular || memoria <= 4 || nucleos <= 4) return 'media';
  return 'alta';
}

/**
 * Escala de píxeles efectiva: la densidad de la pantalla, limitada por el nivel, por el tope de píxeles totales del
 * nivel y multiplicada por la escala dinámica. Nunca menos de 0,35 (solo se llega ahí en 4K sin escalado).
 */
export function proporcionPixeles({ dpr = 1, ancho, alto, nivel, escala = 1 }) {
  const n = NIVELES[nivel];
  const porTope = Math.sqrt(n.pixelesMax / Math.max(1, ancho * alto));
  return Math.max(0.35, Math.min(dpr || 1, n.pixeles, porTope) * escala);
}

const FRECUENCIAS = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240];
const redondearFrecuencia = (fps) => FRECUENCIAS.reduce((a, b) => (Math.abs(b - fps) < Math.abs(a - fps) ? b : a));

export class CalidadAutomatica {
  /**
   * alCambiar({ nivel, escala }) se llama al decidir un paso. `techo`: nivel más alto permitido (el inicial).
   * reloj: función de tiempo (ms) — performance.now por defecto; las pruebas pasan uno propio.
   */
  constructor({ alCambiar, nivel = 'alta', techo = nivel, reloj = () => performance.now() }) {
    Object.assign(this, { alCambiar, reloj });
    this.activa = true;
    this.nivel = nivel;
    this.techo = techo;
    this.escala = 0; // índice en ESCALAS
    this.refresco = 60; // límite de la pantalla (se detecta en reposo)
    this.refrescoMedido = false;
    this.bloqueoSubirHasta = 0;
    this.ultimaSubida = -1e9;
    this.inicio = reloj();
    this.reinicia();
  }

  reinicia() {
    this.v = { cuadros: 0, dibujados: 0, continuos: 0, suma: 0, peor: 0 };
    this.malas = 0;
    this.buenas = 0;
    this.pausaHasta = this.reloj() + 1500;
    this.fps = 0;
    this.ms = 0;
    this.peor = 0;
    this.modo = 'midiendo';
  }

  /** Fija nivel y escala desde afuera (cambio manual, inicio). */
  fijar(nivel, escala = 0) {
    this.nivel = nivel;
    this.escala = escala;
    this.pausaHasta = this.reloj() + 2000;
    this.malas = this.buenas = 0;
  }

  /**
   * Se llama en CADA cuadro del navegador. dt: ms desde el anterior; dibujo: si se dibujó la escena; continuo: si la
   * escena pide dibujarse en cada cuadro (personajes trabajando, cámara en movimiento). Devuelve true al cerrar una
   * ventana de 1 s (para refrescar el medidor).
   */
  registrar(dt, { dibujo = false, continuo = false } = {}) {
    if (!(dt > 0) || dt > 1000) {
      // pestaña oculta, pausa larga o primer cuadro: la ventana actual no es representativa (un cuadro lento de verdad,
      // como los de un navegador sin aceleración gráfica, tarda 250–450 ms y SÍ cuenta)
      this.v = { cuadros: 0, dibujados: 0, continuos: 0, suma: 0, peor: 0 };
      return false;
    }
    const v = this.v;
    v.cuadros++;
    v.suma += dt;
    if (dibujo) v.dibujados++;
    if (continuo) v.continuos++;
    if (dt > v.peor) v.peor = dt;
    if (v.suma < 1000) return false;
    const fps = (v.cuadros * 1000) / v.suma;
    const continua = v.continuos >= v.cuadros * 0.9;
    const reposo = v.dibujados <= v.cuadros * 0.6;
    this.v = { cuadros: 0, dibujados: 0, continuos: 0, suma: 0, peor: 0 };
    if (!continua) {
      // sin dibujo continuo (reposo a ≤30 fps o pausa) el trabajo es liviano: el ritmo del navegador es su límite real
      // (60, 120… o 30 en ahorro de energía, donde incluso el reposo dibuja en todos los cuadros)
      const f = redondearFrecuencia(fps);
      this.refresco = this.refrescoMedido ? Math.max(f, Math.round(this.refresco * 0.97)) : f;
      this.refrescoMedido = true;
    }
    if (reposo || (!continua && v.continuos === 0)) {
      this.modo = v.dibujados ? 'reposo' : 'pausa';
      return true;
    }
    this.fps = fps;
    this.ms = v.suma / v.cuadros;
    this.peor = v.peor;
    this.modo = continua ? 'continuo' : 'parcial';
    if (continua) this.decidir(fps);
    return true;
  }

  decidir(fps) {
    const ahora = this.reloj();
    // sin conocer todavía el límite de la pantalla no se decide nada (evita bajar por un límite de 30 no detectado); si
    // a los 6 s no se pudo medir (equipo tan lento que nunca hay un segundo liviano), se asume 60 Hz y se decide igual
    if (!this.refrescoMedido && ahora - this.inicio > 6000) this.refrescoMedido = true;
    if (!this.activa || ahora < this.pausaHasta || !this.refrescoMedido) return;
    const lento = fps < this.refresco * 0.78;
    const holgado = fps >= this.refresco * 0.95;
    this.malas = lento ? this.malas + 1 : 0;
    this.buenas = holgado ? this.buenas + 1 : 0;
    if (this.malas >= 3) {
      this.malas = this.buenas = 0;
      if (!this.bajar()) return;
      // si una subida reciente terminó en bajada, no se vuelve a intentar subir por un minuto
      if (ahora - this.ultimaSubida < 15000) this.bloqueoSubirHasta = ahora + 60000;
      this.pausaHasta = ahora + 3000;
      this.alCambiar({ nivel: this.nivel, escala: ESCALAS[this.escala] });
    } else if (this.buenas >= 8 && ahora >= this.bloqueoSubirHasta) {
      this.malas = this.buenas = 0;
      if (!this.subir()) return;
      this.ultimaSubida = ahora;
      this.pausaHasta = ahora + 3000;
      this.alCambiar({ nivel: this.nivel, escala: ESCALAS[this.escala] });
    }
  }

  /** Un paso hacia abajo: primero la resolución, después el nivel (que vuelve a resolución completa). */
  bajar() {
    if (this.escala < ESCALAS.length - 1) {
      this.escala++;
      return true;
    }
    const i = ORDEN.indexOf(this.nivel);
    if (i < ORDEN.length - 1) {
      this.nivel = ORDEN[i + 1];
      this.escala = 0;
      return true;
    }
    return false;
  }

  /** Un paso hacia arriba: primero la resolución; después el nivel (sin pasar del techo), que entra al 72 % y sube de a poco. */
  subir() {
    if (this.escala > 0) {
      this.escala--;
      return true;
    }
    const i = ORDEN.indexOf(this.nivel);
    if (i > ORDEN.indexOf(this.techo)) {
      this.nivel = ORDEN[i - 1];
      this.escala = ESCALAS.length - 2;
      return true;
    }
    return false;
  }

  /** Texto del medidor. */
  texto() {
    const hz = `pantalla ${this.refresco} Hz`;
    if (this.modo === 'pausa') return `en pausa · ${hz}`;
    if (this.modo === 'reposo') return `reposo (≤30 fps a propósito) · ${hz}`;
    if (!this.fps) return `midiendo… · ${hz}`;
    return `${this.fps.toFixed(0)} fps · ${this.ms.toFixed(0)} ms (peor ${this.peor.toFixed(0)}) · ${hz}`;
  }
}
