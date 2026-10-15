// Plano de la oficina para la vista 3D. COPIA EXPLÍCITA de los datos de js/office.js (no se importa la app).
// Si cambias el plano de la oficina SVG, actualiza aquí también: `pruebas/coherencia.mjs` compara los dos y avisa.
//
// ─── Coordenadas ───────────────────────────────────────────────────────────────────────────────────────────────
// El plano usa unidades de piso (x, y) como la oficina SVG: x crece hacia la derecha-abajo de la pantalla isométrica,
// y crece hacia la izquierda-abajo. Las paredes del fondo están en x = 0 y en y = 0.
//
// En 3D (Three.js) el piso es el plano XZ y la altura es Y. La conversión vive SOLO aquí:
//     mundo.x = plano.x × ESCALA        mundo.z = plano.y × ESCALA        mundo.y = altura (en unidades LEGO)
// ESCALA = 2: una unidad del plano equivale a 2 taquitos (studs). La unidad del mundo 3D es 1 taquito (8 mm reales);
// un ladrillo mide 1.2 de alto y una placa 0.4. Las alturas NO salen del SVG (allí son estilizadas): se definen
// en medidas LEGO reales (ver ALTURAS).
//
// Ejemplo: el asiento de Nico (6.3, 4.6) queda en el mundo en x = 12.6, z = 9.2.

export const ESCALA = 2;

/** Convierte un punto del plano [x, y] a coordenadas del mundo { x, z }. */
export function aMundo([x, y]) {
  return { x: x * ESCALA, z: y * ESCALA };
}

/** Convierte una huella del plano [x1, y1, x2, y2] a un rectángulo del mundo. */
export function rectMundo([x1, y1, x2, y2]) {
  return { x: x1 * ESCALA, z: y1 * ESCALA, w: (x2 - x1) * ESCALA, d: (y2 - y1) * ESCALA };
}

/** Medidas de altura del mundo 3D (taquitos; ladrillo = 1.2, placa = 0.4). */
export const ALTURAS = {
  ladrillo: 1.2,
  placa: 0.4,
  losa: 1.2, // grosor de la losa bajo los pisos (el piso queda en y = 0)
  pared: 9.6, // 8 hileras de ladrillos
  paredCorte: 1.2, // altura que queda cuando una pared se oculta para no tapar la vista
  tabique: 2.4, // tabiques bajos entre salas (2 hileras), como en el SVG
  minifigura: 5.0, // referencia de una minifigura de pie (40 mm reales)
};

// ─── Salas (copia de ROOM_AREA y ROOM_TINT de js/office.js) ───────────────────────────────────────────────────
// [x, y, ancho, fondo]
export const ROOM_AREA = {
  copy: [0, 0, 12, 12],
  analista: [12, 0, 12, 12],
  guion: [0, 12, 12, 12],
  juntas: [12, 12, 12, 12],
  kike: [12, 24, 12, 10],
};
export const ROOM_TINT = { copy: '#ffe5cc', analista: '#d2effb', guion: '#d6f1da', juntas: '#fdf0bd', kike: '#dde5f0' };
export const SALAS = {
  copy: { nombre: 'Copy · Nico', funcion: 'Copys, hooks y captions' },
  analista: { nombre: 'Analista · Alex', funcion: 'Tendencias y métricas' },
  guion: { nombre: 'Guion · Sam', funcion: 'Guiones' },
  juntas: { nombre: 'Sala de juntas', funcion: 'Reuniones de los tres agentes' },
  kike: { nombre: 'Tu oficina', funcion: 'Base del jefe y zona del gato' },
};

// ─── Personajes y rutas (copia; no se usan todavía, sirven para la depuración y la futura integración) ────────
export const SEATS = { copy: [6.3, 4.6], analista: [18.2, 4.6], guion: [6.3, 16.6] };
export const MEET = { analista: [15.9, 16.35], guion: [18.0, 16.35], copy: [20.1, 16.35] };
export const ROUTES = {
  copy: [[9.25, 9.2], [9.25, 13.4], [11, 14.75], [13.4, 14.75]],
  analista: [[14.75, 9.2], [14.75, 13.6]],
  guion: [[10.8, 14.75], [13.4, 14.75]],
};
export const BOSS_SPOTS = {
  home: { at: [18.2, 27.4], face: 'front' },
  meeting: { at: [13.75, 18.5], face: 'front' },
  copy: { at: [6.3, 8.3], face: 'away' },
  analista: { at: [18.2, 8.3], face: 'away' },
  guion: { at: [6.3, 20.3], face: 'away' },
};
export const CAT_PERCH = {
  bed: { floor: [15.9, 31.6], on: [14.2, 31.6, 0.34], left: true },
  desk: { floor: [18.9, 30.7], on: [18.9, 29.4, 1.32], left: false },
};
export const AMB_EXIT = { copy: [8.7, 4.5], analista: [20.5, 4.5], guion: [8.7, 16.5] };
export const AMB_SPOTS = {
  copy: { librero: { at: [2.0, 10.8], face: 'away' }, planta: { at: [10.0, 2.7], face: 'away' }, estirar: { at: [9.4, 8.6], face: 'front' } },
  analista: { servidor: { at: [21.4, 9.4], face: 'front' }, planta: { at: [14.3, 2.7], face: 'away' }, estirar: { at: [15.2, 9.2], face: 'front' } },
  guion: { camara: { at: [8.6, 21.9], face: 'away' }, planta: { at: [2.7, 21.4], face: 'away' }, estirar: { at: [9.8, 14.6], face: 'front' } },
};
// Zoom de cámara por sala en el SVG (referencia; la cámara 3D calcula el suyo con el centro de cada sala)
export const FOCUS = { copy: [0, 96, 1.28], analista: [192, 192, 1.28], guion: [-192, 192, 1.28], juntas: [0, 288, 1.12] };

// ─── Tabiques y obstáculos (copia de PARTITIONS y OBSTACLES) ───────────────────────────────────────────────
// Tabiques bajos: [eje, coordenada, desde, hasta]
export const PARTITIONS = [
  ['x', 12, 0.2, 8],
  ['x', 12, 10.5, 11.85],
  ['y', 12, 0.2, 8],
  ['y', 12, 10.5, 11.85],
  ['x', 12, 12.15, 13.5],
  ['x', 12, 16, 23.8],
  ['y', 12, 12.15, 13.5],
  ['y', 12, 16, 23.8],
  ['y', 24, 12.15, 19],
  ['y', 24, 21.5, 23.8],
];
// Huellas de muebles en el piso [x1, y1, x2, y2] (sin los tabiques, que se agregan abajo como en office.js)
export const MUEBLES_OBSTACULOS = [
  [0.1, 9.9, 1.0, 11.7],
  [10.4, 0.9, 11.2, 1.7],
  [4.6, 3.6, 8.0, 7.1],
  [12.8, 0.9, 13.6, 1.7],
  [16.4, 3.6, 20.0, 7.1],
  [22.4, 8.6, 23.6, 10.2],
  [1.0, 22.2, 1.8, 23.0],
  [4.6, 15.6, 8.0, 19.1],
  [9.0, 20.1, 10.2, 21.1],
  [15.3, 15.25, 20.7, 16.9],
  [14.6, 17.2, 21.4, 19.8],
  [12.75, 17.9, 13.1, 19.1],
  [22.3, 19.4, 23.6, 21.8],
  [22.6, 12.8, 23.4, 13.6],
  [12.8, 22.6, 13.6, 23.4],
  [12.8, 24.6, 13.6, 25.4],
  [22.6, 24.6, 23.4, 25.4],
  [17.6, 26.4, 18.8, 26.7],
  [16.4, 28.4, 20.0, 29.9],
  [22.4, 29.4, 23.6, 32.8],
  [13.0, 30.5, 15.4, 32.7],
];
export const OBSTACLES = [
  ...MUEBLES_OBSTACULOS,
  ...PARTITIONS.map(([axis, at, a, b]) => (axis === 'x' ? [at - 0.15, a, at + 0.15, b] : [a, at - 0.15, b, at + 0.15])),
];

// ─── Puertas (huecos entre tabiques, derivados de PARTITIONS) ───────────────────────────────────────────────
// [eje, coordenada, desde, hasta]: un tabique en x = 12 con hueco de y = 8 a y = 10.5 es la puerta Copy ↔ Analista.
export const PUERTAS = [
  { id: 'copy-analista', salas: ['copy', 'analista'], eje: 'x', en: 12, desde: 8, hasta: 10.5 },
  { id: 'copy-guion', salas: ['copy', 'guion'], eje: 'y', en: 12, desde: 8, hasta: 10.5 },
  { id: 'guion-juntas', salas: ['guion', 'juntas'], eje: 'x', en: 12, desde: 13.5, hasta: 16 },
  { id: 'analista-juntas', salas: ['analista', 'juntas'], eje: 'y', en: 12, desde: 13.5, hasta: 16 },
  { id: 'juntas-kike', salas: ['juntas', 'kike'], eje: 'y', en: 24, desde: 19, hasta: 21.5 },
];

// ─── Paredes exteriores (cuatro lados del contorno) ─────────────────────────────────────────────────────────
// Las dos del fondo (x = 0 y y = 0) existen en el SVG y llevan la decoración. Las demás cierran el contorno y se
// ocultan solas cuando quedan entre la cámara y la oficina. `normal` apunta hacia afuera de la oficina.
export const PAREDES = [
  { id: 'fondo-izq', eje: 'x', en: 0, desde: 0, hasta: 24, normal: [-1, 0] },
  { id: 'fondo-der', eje: 'y', en: 0, desde: 0, hasta: 24, normal: [0, -1] },
  { id: 'frente-der', eje: 'x', en: 24, desde: 0, hasta: 34, normal: [1, 0] },
  { id: 'frente-kike', eje: 'y', en: 34, desde: 12, hasta: 24, normal: [0, 1] },
  { id: 'frente-guion', eje: 'y', en: 24, desde: 0, hasta: 12, normal: [0, 1] },
  { id: 'lado-kike', eje: 'x', en: 12, desde: 24, hasta: 34, normal: [-1, 0] },
];
// Ventana con playa en la pared y = 0 (Copy): de x 2.5 a 9.5, a media altura
export const VENTANA = { pared: 'fondo-der', desde: 2.5, hasta: 9.5 };

// ─── Alfombras (copia de staticScene) ───────────────────────────────────────────────────────────────────────
export const ALFOMBRAS = [
  { sala: 'copy', rect: [3.4, 3.0, 9.4, 8.6], color: '#ff8a3d' },
  { sala: 'analista', rect: [15.3, 3.0, 21.3, 8.6], color: '#008ec7' },
  { sala: 'guion', rect: [3.4, 15.0, 9.4, 20.6], color: '#7a5af8' },
  { sala: 'kike', rect: [15.0, 25.8, 21.4, 31.6], color: '#f5cd30' },
];

// ─── Colores del diseño actual (copia de js/lego.js y de la apariencia por defecto de los agentes) ─────────
export const COLORES = {
  copy: '#ff8a3d',
  analista: '#008ec7',
  guion: '#7a5af8',
  jefe: '#f5cd30', // LEGO.yellow
  blanco: '#f4f4f2',
  rojo: '#d4382c',
  azul: '#1f6fc9',
  amarillo: '#f5cd30',
  verde: '#2a9a55',
  tostado: '#d9b77a', // LEGO.tan
  oscuro: '#3b4252',
  marino: '#324966',
  turquesa: '#2f9fb0',
  tabique: '#efe9dc',
  losa: '#ead3a6',
  paredA: '#efe3c8',
  paredB: '#e6d5b0',
};

// ─── Muebles y objetos de cada sala ─────────────────────────────────────────────────────────────────────────
// Cada entrada pide un modelo al registro por nombre. `en` es el punto del plano donde se apoya el modelo,
// `rot` el giro en grados (0 = el frente del modelo mira hacia +y del plano, hacia la cámara), `huella` la del SVG.
export const MUEBLES = [
  // Copy (Nico)
  { sala: 'copy', modelo: 'librero', huella: [0.1, 9.9, 1.0, 11.7], rot: 90 },
  { sala: 'copy', modelo: 'planta', en: [10.8, 1.3] },
  { sala: 'copy', modelo: 'silla', en: [6.3, 4.25], color: '#d9742e' },
  { sala: 'copy', modelo: 'escritorio', huella: [4.6, 5.6, 8.0, 7.1], color: '#ff8a3d', placa: 'Nico' },
  { sala: 'copy', modelo: 'monitor', en: [5.65, 5.92], rot: 180, logo: '#ff8a3d', sobre: 'escritorio' },
  { sala: 'copy', modelo: 'camaraInstantanea', en: [7.3, 6.21], sobre: 'escritorio' },
  { sala: 'copy', modelo: 'notas', en: [6.68, 6.78], sobre: 'escritorio' },
  { sala: 'copy', modelo: 'taza', en: [7.58, 6.63], sobre: 'escritorio' },
  // Analista (Alex)
  { sala: 'analista', modelo: 'planta', en: [13.2, 1.3] },
  { sala: 'analista', modelo: 'silla', en: [18.2, 4.25], color: '#0079ad' },
  { sala: 'analista', modelo: 'escritorio', huella: [16.4, 5.6, 20.0, 7.1], color: '#008ec7', placa: 'Alex' },
  { sala: 'analista', modelo: 'monitor', en: [17.15, 5.92], rot: 180, logo: '#22b8c4', sobre: 'escritorio' },
  { sala: 'analista', modelo: 'monitor', en: [18.6, 5.92], rot: 180, logo: '#ffcc4d', sobre: 'escritorio' },
  { sala: 'analista', modelo: 'tableta', en: [19.55, 6.45], sobre: 'escritorio' },
  { sala: 'analista', modelo: 'taza', en: [19.35, 5.95], sobre: 'escritorio' },
  { sala: 'analista', modelo: 'rack', huella: [22.4, 8.6, 23.6, 10.2] },
  // Guion (Sam)
  { sala: 'guion', modelo: 'planta', en: [1.4, 22.6] },
  { sala: 'guion', modelo: 'silla', en: [6.3, 16.25], color: '#674bd6' },
  { sala: 'guion', modelo: 'escritorio', huella: [4.6, 17.6, 8.0, 19.1], color: '#7a5af8', placa: 'Sam' },
  { sala: 'guion', modelo: 'portatil', en: [5.5, 18.35], rot: 180, sobre: 'escritorio' },
  { sala: 'guion', modelo: 'papel', en: [7.25, 18.4], sobre: 'escritorio' },
  { sala: 'guion', modelo: 'notas', en: [7.1, 19.05], sobre: 'escritorio' },
  { sala: 'guion', modelo: 'tripode', en: [9.6, 20.6], rot: -45 },
  // Sala de juntas
  { sala: 'juntas', modelo: 'silla', en: [15.9, 15.9], color: '#0080b3' },
  { sala: 'juntas', modelo: 'silla', en: [18.0, 15.9], color: '#6e51df' },
  { sala: 'juntas', modelo: 'silla', en: [20.1, 15.9], color: '#e57c37' },
  { sala: 'juntas', modelo: 'silla', en: [13.4, 18.5], rot: 90, color: '#f5cd30' },
  { sala: 'juntas', modelo: 'mesaJuntas', huella: [14.6, 17.2, 21.4, 19.8] },
  { sala: 'juntas', modelo: 'papel', en: [16.3, 18.4], sobre: 'mesaJuntas' },
  { sala: 'juntas', modelo: 'notas', en: [17.5, 18.4], sobre: 'mesaJuntas' },
  { sala: 'juntas', modelo: 'taza', en: [19.45, 18.45], sobre: 'mesaJuntas' },
  { sala: 'juntas', modelo: 'globo', en: [18.6, 18.6], sobre: 'mesaJuntas' },
  { sala: 'juntas', modelo: 'credenza', huella: [22.3, 19.4, 23.6, 21.8], rot: -90 },
  { sala: 'juntas', modelo: 'maleta', en: [22.85, 20.0], sobre: 'credenza', color: '#1f6fc9' },
  { sala: 'juntas', modelo: 'pantallaLogo', en: [22.93, 20.69], sobre: 'credenza' },
  { sala: 'juntas', modelo: 'planta', en: [23.0, 13.2] },
  { sala: 'juntas', modelo: 'planta', en: [13.2, 23.0] },
  // Tu oficina (jefe y gato)
  { sala: 'kike', modelo: 'palmera', en: [13.2, 25.0] },
  { sala: 'kike', modelo: 'palmera', en: [23.0, 25.0] },
  { sala: 'kike', modelo: 'silla', en: [18.2, 27.05], color: '#f5cd30' },
  { sala: 'kike', modelo: 'escritorio', huella: [16.4, 28.4, 20.0, 29.9], color: '#f5cd30', placa: '👑 JEFE' },
  { sala: 'kike', modelo: 'monitor', en: [17.35, 28.82], rot: 180, logo: '#324966', sobre: 'escritorio' },
  { sala: 'kike', modelo: 'taza', en: [19.28, 28.98], sobre: 'escritorio' },
  { sala: 'kike', modelo: 'globo', en: [18.95, 29.45], sobre: 'escritorio' },
  { sala: 'kike', modelo: 'trofeo', en: [18.1, 29.55], sobre: 'escritorio' },
  { sala: 'kike', modelo: 'sofa', huella: [22.4, 29.4, 23.6, 32.8], rot: -90 },
  { sala: 'kike', modelo: 'camaGato', en: [14.2, 31.6] },
];

// ─── Agentes (Etapa 3) ─────────────────────────────────────────────────────────────────────────────────────
// Apariencia por defecto: COPIA de DEFAULTS.agents[id].look de js/store.js (prueba de coherencia incluida).
// En la fase 1–5 se usa esta apariencia; si el navegador tiene una apariencia personalizada guardada por la app,
// personajes/apariencia.js la LEE (solo lectura) para que los personajes se vean como en la oficina SVG.
export const AGENTES = {
  copy: { name: 'Nico', look: { shirt: '#ff8a3d', skin: '#e0ac69', hair: '#2b1b12', hairStyle: 'short', kit: 'copy' } },
  analista: { name: 'Alex', look: { shirt: '#008ec7', skin: '#c68642', hair: '#1b1b1b', hairStyle: 'short', kit: 'analista' } },
  guion: { name: 'Sam', look: { shirt: '#7a5af8', skin: '#8d5524', hair: '#0f0f0f', hairStyle: 'curly', kit: 'guion' } },
};
export const AGENT_IDS = ['copy', 'analista', 'guion'];
export const PANTALON = '#34405a'; // PANTS de js/office.js
// Orden de los turnos en la sala de juntas: copia de ORDER de js/meeting.js
export const ORDEN_REUNION = ['analista', 'guion', 'copy'];
// Caminata de los agentes en la oficina SVG (walk de js/office.js): cada tramo dura max(250 ms, distancia / 5 s).
export const CAMINAR = { velocidad: 5, minimoMs: 250 };
// Textos de estado: copia de STATUS_LABEL de js/state.js (el "Escribiendo…" lo deduce office.js, ver agentes.js)
export const STATUS_LABEL = { idle: '', thinking: 'Pensando…', searching: 'Buscando en la web…', meeting: 'En reunión', talking: 'Hablando…' };

// Puntos de paso SOLO de la vista 3D (no existen en el SVG, donde el personaje se desliza por encima de los muebles):
//   salida: del asiento al primer punto de la ruta sin atravesar el escritorio (levantarse hacia un lado).
//   mesa:   del último punto de la ruta al puesto de reunión entrando por el hueco junto a su silla (sin cruzar las
//           sillas de los demás). La duración TOTAL de cada caminata sigue siendo la del SVG (ver agentes.js).
export const ACCESO_3D = {
  salida: { copy: [[8.7, 4.5]], analista: [[20.9, 4.5], [20.9, 7.7]], guion: [[8.7, 16.5]] },
  mesa: { analista: [[14.9, 14.75], [14.9, 16.35]], guion: [[17.0, 14.75], [17.0, 16.35]], copy: [[21.0, 14.75], [21.0, 16.35]] },
};

/** Duración (ms) de la caminata de un agente en el SVG (walk() de js/office.js): suma de max(250 ms, distancia / 5 s). */
export function duracionCaminata(id, hacia) {
  const ruta = hacia === 'meeting' ? [...ROUTES[id], MEET[id]] : [...ROUTES[id]].reverse().concat([SEATS[id]]);
  let desde = hacia === 'meeting' ? SEATS[id] : MEET[id];
  let total = 0;
  for (const p of ruta) {
    total += Math.max(CAMINAR.minimoMs, (Math.hypot(p[0] - desde[0], p[1] - desde[1]) / CAMINAR.velocidad) * 1000);
    desde = p;
  }
  return total;
}

/** Recorrido 3D (puntos del plano) de un agente hacia la sala ('meeting') o a su oficina ('office'). */
export function recorrido3D(id, hacia) {
  const ida = [SEATS[id], ...ACCESO_3D.salida[id], ...ROUTES[id], ...ACCESO_3D.mesa[id], MEET[id]];
  return hacia === 'meeting' ? ida : ida.slice().reverse();
}
