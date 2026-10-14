// Niveles de calidad y calidad automática.
//
// Automática: empieza con un nivel prudente según el equipo (celular o poca memoria → Media; muy modesto → Baja;
// computadora → Alta). Mientras la cámara se mueve se mide el ritmo de cuadros en ventanas de 2 segundos; si va
// lento 3 ventanas seguidas (≈ 6 s sostenidos), baja UN nivel y espera 10 s antes de volver a evaluar. Nunca sube
// sola: así no hay cambios bruscos constantes. La escena es estática, por eso solo se mide cuando se dibuja.

export const NIVELES = {
  alta: { clave: 'alta', nombre: 'Alta', pixeles: 2, sombra: 2048, sombraSuave: 3, barniz: true, entorno: true, taquitosFinos: true, antialias: true },
  media: { clave: 'media', nombre: 'Media', pixeles: 1.5, sombra: 1024, sombraSuave: 2, barniz: false, entorno: true, taquitosFinos: false, antialias: true },
  baja: { clave: 'baja', nombre: 'Baja', pixeles: 1, sombra: 512, sombraSuave: 1, barniz: false, entorno: false, taquitosFinos: false, antialias: false },
};
export const ORDEN = ['alta', 'media', 'baja'];

/** Nivel inicial prudente según el equipo. */
export function nivelInicial() {
  const celular = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;
  const memoria = navigator.deviceMemory || 4;
  const nucleos = navigator.hardwareConcurrency || 4;
  if (memoria <= 2 || nucleos <= 2) return 'baja';
  if (celular || memoria <= 4 || nucleos <= 4) return 'media';
  return 'alta';
}

export class CalidadAutomatica {
  constructor({ minimo = 26, ventana = 2000, seguidas = 3, espera = 10000, alBajar }) {
    Object.assign(this, { minimo, ventana, seguidas, espera, alBajar });
    this.activa = true;
    this.reinicia();
  }

  reinicia() {
    this.cuadros = 0;
    this.tiempo = 0;
    this.malas = 0;
    this.pausaHasta = performance.now() + 1500;
    this.fps = 0;
  }

  /** Registra un cuadro dibujado durante una interacción. `dt` en ms desde el cuadro anterior. */
  cuadro(dt, nivel) {
    if (dt > 250) return; // pausas (pestaña en segundo plano, fin de un gesto): no cuentan
    const ahora = performance.now();
    this.cuadros++;
    this.tiempo += dt;
    if (this.tiempo < this.ventana) return;
    this.fps = (this.cuadros * 1000) / this.tiempo;
    this.cuadros = 0;
    this.tiempo = 0;
    if (!this.activa || ahora < this.pausaHasta) return;
    this.malas = this.fps < this.minimo ? this.malas + 1 : 0;
    if (this.malas >= this.seguidas && nivel !== 'baja') {
      this.malas = 0;
      this.pausaHasta = ahora + this.espera;
      this.alBajar(ORDEN[ORDEN.indexOf(nivel) + 1]);
    }
  }
}
