// Persistencia local (localStorage). Todo vive solo en este navegador.

const PREFIX = 'vaof:';

export const AGENT_IDS = ['copy', 'analista', 'guion'];

export const DEFAULT_SOURCES = [
  'newsroom.tiktok.com',
  'ads.tiktok.com',
  'tiktok.com',
  'creators.instagram.com',
  'about.instagram.com',
  'business.instagram.com',
  'about.fb.com',
  'threads.com',
  'socialmediatoday.com',
  'later.com',
  'hootsuite.com',
  'sproutsocial.com',
  'buffer.com',
  'metricool.com',
  'blog.hubspot.com',
  'skift.com',
  'phocuswire.com',
  'reddit.com',
];

export const DEFAULTS = {
  settings: {
    geminiKey: '',
    model: 'gemini-flash-latest',
    fastModel: 'gemini-flash-lite-latest',
    knownModels: [],
    tavilyKey: '',
    tavilyProxy: '',
    searchProvider: 'tavily', // 'tavily' | 'google'
    webSearch: true,
    sources: DEFAULT_SOURCES,
    groqKey: '',
    groqAuto: true,
    groqModel: 'openai/gpt-oss-120b',
    groqFastModel: 'llama-3.1-8b-instant',
    groqKnownModels: [],
    groqMeetings: true, // turnos de los agentes en la sala de juntas
    groqFallback: true, // respaldo cuando Gemini llega al límite
    routerOn: true, // elegir el modelo según la tarea
    heavyModel: '', // modelo para tareas pesadas ('' = el principal)
    lightGroq: true, // usar Groq para mensajes simples
    skillsOff: [], // ids de skills desactivadas
    skillsPinned: [], // ids de skills que siempre se cargan
    customSkills: [], // skills creadas por Kike
    ambientLife: true, // gestos y paseos decorativos de los agentes cuando están libres
  },
  boss: {
    name: 'Kike',
    look: { shirt: '#324966', skin: '#c68642', hair: '#2b1b12', hairStyle: 'short' },
  },
  brief: {
    marca: 'Vacilando Ando Tours',
    queHacemos:
      'Agencia de viajes y excursiones de Venezuela. Hacemos viajes nacionales terrestres y marítimos (full days, fines de semana y paquetes) hacia varios destinos del país.',
    destinos: '',
    publico: '',
    tono: 'Cercano, alegre y venezolano: que se sienta la vacilada, pero con confianza y seriedad a la hora de vender.',
    cierre: 'Las ventas se cierran por WhatsApp. Todo el contenido debe invitar a escribir por WhatsApp o por DM.',
    whatsapp: '',
    diferenciadores: '',
    evitar: '',
    extras: '',
  },
  agents: {
    copy: {
      name: 'Nico',
      personality:
        'Chispa creativa con olfato vendedor. Habla con sabor venezolano sin exagerar y siempre piensa en cómo llevar a la gente al WhatsApp.',
      extra: '',
      look: { shirt: '#ff8a3d', skin: '#e0ac69', hair: '#2b1b12', hairStyle: 'short', kit: 'copy' },
    },
    analista: {
      name: 'Alex',
      personality:
        'Mente de datos que explica todo fácil. Va al grano, sin relleno, y desconfía de las modas que no tienen pruebas.',
      extra: '',
      look: { shirt: '#008ec7', skin: '#c68642', hair: '#1b1b1b', hairStyle: 'short', kit: 'analista' },
    },
    guion: {
      name: 'Sam',
      personality:
        'Storyteller de pura cepa: piensa en escenas, en ritmo y en cómo enganchar a la gente desde el primer segundo hasta el final.',
      extra: '',
      look: { shirt: '#7a5af8', skin: '#8d5524', hair: '#0f0f0f', hairStyle: 'curly', kit: 'guion' },
    },
  },
  // Gato asistente: nombre y memoria de la marca (datos que Kike le cuenta)
  cat: { name: '', named: false },
  memory: [],
  meetings: [],
  metrics: [],
  favs: [], // biblioteca de favoritos: copys, guiones, hooks guardados
  fechas: [], // fechas propias de Kike para el calendario
  'chat:copy': [],
  'chat:analista': [],
  'chat:guion': [],
  'chat:gato': [],
};

const cache = {};

function clone(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

function read(key) {
  const fallback = clone(DEFAULTS[key]);
  let stored;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    stored = raw ? JSON.parse(raw) : undefined;
  } catch {
    stored = undefined;
  }
  if (stored === undefined) return fallback;
  // Mezcla con los valores por defecto para que campos nuevos siempre existan.
  if (key === 'settings' || key === 'brief') return { ...fallback, ...stored };
  if (key === 'cat') return { ...fallback, ...stored };
  if (key === 'boss') return { ...fallback, ...stored, look: { ...fallback.look, ...(stored.look || {}) } };
  if (key === 'agents') {
    const out = {};
    for (const id of AGENT_IDS) {
      const s = stored[id] || {};
      out[id] = { ...fallback[id], ...s, look: { ...fallback[id].look, ...(s.look || {}) } };
    }
    return out;
  }
  return stored;
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn('No se pudo guardar', key, e);
    window.dispatchEvent(new CustomEvent('vaof:storage-full'));
    return false;
  }
}

export function get(key) {
  if (!(key in cache)) cache[key] = read(key);
  return cache[key];
}

export function set(key, value) {
  cache[key] = value;
  return write(key, value);
}

/** Guarda el objeto en caché después de mutarlo. */
export function save(key) {
  return write(key, get(key));
}

export const settings = () => get('settings');
export const brief = () => get('brief');
export const agents = () => get('agents');
export const boss = () => get('boss');
export const cat = () => get('cat');
export const memory = () => get('memory');
export const chat = (id) => get('chat:' + id);

// ---------- Respaldo ----------

export function exportAll({ includeKeys = false } = {}) {
  const data = {};
  for (const key of Object.keys(DEFAULTS)) data[key] = clone(get(key));
  if (!includeKeys) {
    data.settings.geminiKey = '';
    data.settings.tavilyKey = '';
    data.settings.groqKey = '';
  }
  return { app: 'la-oficina-vacilando', version: 1, exportedAt: new Date().toISOString(), data };
}

export function importAll(payload) {
  if (!payload || payload.app !== 'la-oficina-vacilando' || !payload.data) {
    throw new Error('Ese archivo no es un respaldo de La Oficina.');
  }
  const current = get('settings');
  for (const key of Object.keys(DEFAULTS)) {
    if (!(key in payload.data)) continue;
    let value = payload.data[key];
    if (key === 'settings') {
      // Conserva las claves actuales si el respaldo no las trae.
      value = {
        ...value,
        geminiKey: value.geminiKey || current.geminiKey,
        tavilyKey: value.tavilyKey || current.tavilyKey,
        groqKey: value.groqKey || current.groqKey,
      };
    }
    set(key, value);
    delete cache[key];
  }
}

export function clearKeys(keys) {
  for (const key of keys) {
    localStorage.removeItem(PREFIX + key);
    delete cache[key];
  }
}

export function usageKB() {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) total += (localStorage.getItem(k) || '').length;
  }
  return Math.round((total * 2) / 1024);
}
