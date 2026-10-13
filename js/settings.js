// Configuración: claves de API, equipo (bautizo y apariencia), brief de marca, fuentes y datos.

import { h, toast, debounce, confirmDialog } from './ui.js';
import * as store from './store.js';
import { AGENT_IDS, DEFAULT_SOURCES } from './store.js';
import { runtime, emit, go } from './state.js';
import { listModels } from './gemini.js';
import { tavilySearch, SearchUnavailable } from './search.js';
import { ROLES } from './prompts.js';
import { avatarSvg } from './office.js';

const TABS = [
  ['claves', '🔑 Claves'],
  ['equipo', '👥 Equipo'],
  ['marca', '🏝️ Marca'],
  ['fuentes', '📚 Fuentes'],
  ['datos', '💾 Datos'],
];

const SHIRTS = ['#ff6b5b', '#0e9aa7', '#7a5af8', '#ffb627', '#2e9d5b', '#2f6fd1', '#e05297', '#3b4252'];
const SKINS = ['#f6d3b3', '#e0ac69', '#c68642', '#8d5524', '#5c3a1e'];
const HAIRS = ['#0f0f0f', '#2b1b12', '#6b3e1f', '#b5651d', '#e8c07d', '#9aa0a6', '#ff6b5b', '#2f6fd1'];
const HAIR_STYLES = [
  ['short', 'Corto'],
  ['bun', 'Moño'],
  ['curly', 'Rizado'],
  ['long', 'Largo'],
  ['gorra', 'Gorra'],
];

const DEFAULT_MODELS = [
  { id: 'gemini-flash-latest', label: 'Gemini Flash (último)' },
  { id: 'gemini-flash-lite-latest', label: 'Gemini Flash-Lite (último)' },
];

const saveSettings = debounce(() => store.save('settings'), 300);
const saveAgents = debounce(() => {
  store.save('agents');
  emit('agents-changed');
}, 450);
const saveBrief = debounce(() => store.save('brief'), 400);

function field(label, control, hint) {
  return h('div', { class: 'field' }, h('label', null, label), control, hint ? h('span', { class: 'hint' }, hint) : null);
}

function secretInput(value, onInput, placeholder) {
  const input = h('input', { type: 'password', value, placeholder, autocomplete: 'off', spellcheck: 'false', onInput: (e) => onInput(e.target.value.trim()) });
  const eye = h(
    'button',
    {
      class: 'icon-btn',
      type: 'button',
      'aria-label': 'Mostrar u ocultar',
      onClick: () => {
        input.type = input.type === 'password' ? 'text' : 'password';
      },
    },
    '👁'
  );
  return { input, eye };
}

function modelSelect(current, onChange) {
  const s = store.settings();
  const known = s.knownModels?.length ? s.knownModels : DEFAULT_MODELS;
  const list = [...known];
  if (current && !list.some((m) => m.id === current)) list.unshift({ id: current, label: current });
  const sel = h(
    'select',
    { onChange: (e) => onChange(e.target.value) },
    list.map((m) => h('option', { value: m.id }, m.id === m.label ? m.id : `${m.label} — ${m.id}`))
  );
  sel.value = current;
  return sel;
}

// ---------------- Claves ----------------
function keysTab() {
  const s = store.settings();
  const wrap = h('div');

  const gStatus = h('span', { class: 'hint' });
  const g = secretInput(s.geminiKey, (v) => {
    s.geminiKey = v;
    saveSettings();
  }, 'AIza…');
  const gTest = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Probar');
  const modelsBox = h('div');
  const renderModels = () =>
    modelsBox.replaceChildren(
      field(
        'Modelo principal',
        modelSelect(s.model, (v) => {
          s.model = v;
          saveSettings();
        }),
        '"gemini-flash-latest" siempre apunta al Flash más nuevo: rápido y con buen plan gratis. Si quieres más calidad y tu plan lo permite, prueba un modelo Pro.'
      ),
      field(
        'Modelo rápido (tareas pequeñas)',
        modelSelect(s.fastModel, (v) => {
          s.fastModel = v;
          saveSettings();
        }),
        'Se usa para preparar las búsquedas de la sala de juntas.'
      )
    );
  renderModels();
  gTest.addEventListener('click', async () => {
    store.save('settings');
    if (!s.geminiKey) {
      gStatus.className = 'err-text';
      gStatus.textContent = 'Pega tu key primero.';
      return;
    }
    gTest.disabled = true;
    gStatus.className = 'hint';
    gStatus.textContent = 'Probando…';
    try {
      const models = await listModels(s.geminiKey);
      s.knownModels = models;
      store.save('settings');
      renderModels();
      gStatus.className = 'ok-text';
      gStatus.textContent = `✔ Conectado. ${models.length} modelos disponibles.`;
      if (models.length && !models.some((m) => m.id === s.model)) {
        toast(`Ojo: "${s.model}" no aparece en tu lista. Elige otro modelo.`, 'warn', 7000);
      }
    } catch (e) {
      gStatus.className = 'err-text';
      gStatus.textContent = '✖ ' + e.message;
    } finally {
      gTest.disabled = false;
    }
  });

  const tStatus = h('span', { class: 'hint' });
  const t = secretInput(s.tavilyKey, (v) => {
    s.tavilyKey = v;
    runtime.tavilyBlocked = false;
    saveSettings();
  }, 'tvly-…');
  const tTest = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Probar');
  tTest.addEventListener('click', async () => {
    store.save('settings');
    if (!s.tavilyKey && !s.tavilyProxy) {
      tStatus.className = 'err-text';
      tStatus.textContent = 'Pega tu key primero.';
      return;
    }
    tTest.disabled = true;
    tStatus.className = 'hint';
    tStatus.textContent = 'Probando (gasta 1 crédito)…';
    try {
      const r = await tavilySearch({ key: s.tavilyKey, proxy: s.tavilyProxy, query: 'turismo Venezuela', maxResults: 1 });
      runtime.tavilyBlocked = false;
      tStatus.className = 'ok-text';
      tStatus.textContent = `✔ Tavily responde (${r.length} resultado).`;
    } catch (e) {
      tStatus.className = 'err-text';
      tStatus.textContent =
        '✖ ' + e.message + (e instanceof SearchUnavailable && !s.tavilyProxy ? ' Configura el proxy (abajo, en "Avanzado") o usa Google vía Gemini.' : '');
    } finally {
      tTest.disabled = false;
    }
  });

  const provider = h(
    'div',
    { class: 'radio-cards' },
    [
      ['tavily', 'Tavily (recomendado)', 'Buscador hecho para agentes de IA. Plan gratis de 1.000 créditos al mes. Permite limitar la búsqueda a fuentes oficiales.'],
      ['google', 'Google vía Gemini', 'Usa la búsqueda de Google que trae Gemini. No necesita otra key, pero gasta tu cuota de Gemini.'],
    ].map(([value, title, desc]) =>
      h(
        'label',
        { class: 'radio-card' },
        h('input', {
          type: 'radio',
          name: 'provider',
          value,
          checked: s.searchProvider === value,
          onChange: () => {
            s.searchProvider = value;
            saveSettings();
          },
        }),
        h('span', null, h('strong', null, title), h('small', null, desc))
      )
    )
  );

  const proxy = h('input', {
    type: 'url',
    value: s.tavilyProxy,
    placeholder: 'https://tu-proxy.workers.dev',
    onInput: (e) => {
      s.tavilyProxy = e.target.value.trim();
      runtime.tavilyBlocked = false;
      saveSettings();
    },
  });

  wrap.append(
    h(
      'p',
      { class: 'note' },
      '🔒 Tus claves se guardan solo en este navegador (no van al código ni a GitHub). Si abres la app en otro dispositivo, tendrás que pegarlas allí también.'
    ),
    h('div', { class: 'section-title' }, 'Google AI Studio (Gemini) · obligatorio'),
    field(
      'API key de Gemini',
      h('div', { class: 'key-row' }, g.input, g.eye, gTest),
      h('span', null, 'Sácala gratis en ', h('a', { href: 'https://aistudio.google.com/apikey', target: '_blank', rel: 'noopener noreferrer' }, 'aistudio.google.com/apikey'), '. ', gStatus)
    ),
    modelsBox,
    h('div', { class: 'section-title' }, 'Búsqueda web'),
    h(
      'div',
      { class: 'field' },
      h(
        'label',
        { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: s.webSearch,
          onChange: (e) => {
            s.webSearch = e.target.checked;
            saveSettings();
          },
        }),
        'Permitir que los agentes busquen en internet'
      )
    ),
    provider,
    h('div', { style: { height: '14px' } }),
    field(
      'API key de Tavily',
      h('div', { class: 'key-row' }, t.input, t.eye, tTest),
      h('span', null, 'Sácala gratis en ', h('a', { href: 'https://app.tavily.com', target: '_blank', rel: 'noopener noreferrer' }, 'app.tavily.com'), '. ', tStatus)
    ),
    h(
      'details',
      null,
      h('summary', { style: { cursor: 'pointer', fontWeight: 800 } }, 'Avanzado: proxy de Tavily'),
      h(
        'div',
        { style: { marginTop: '10px' } },
        field(
          'URL del proxy (opcional)',
          proxy,
          'Solo si Tavily no conecta directo desde el navegador. En el README está el paso a paso para crear uno gratis en Cloudflare.'
        )
      )
    )
  );
  return wrap;
}

// ---------------- Equipo ----------------
function swatches(colors, current, onPick) {
  const box = h('div', { class: 'swatches', role: 'group' });
  const render = (value) =>
    box.replaceChildren(
      ...colors.map((c) =>
        h('button', {
          class: 'swatch',
          type: 'button',
          style: { background: c },
          'aria-label': c,
          'aria-pressed': String(c === value),
          onClick: () => {
            onPick(c);
            render(c);
          },
        })
      )
    );
  render(current);
  return box;
}

function teamTab() {
  const agents = store.agents();
  const wrap = h('div');
  wrap.append(
    h(
      'p',
      { class: 'note' },
      '¡Bautiza a tu equipo! Ponles nombre, personalidad y estilo. La personalidad cambia cómo te hablan; las indicaciones extra son reglas fijas que siempre van a seguir.'
    )
  );
  for (const id of AGENT_IDS) {
    const a = agents[id];
    const role = ROLES[id];
    const preview = h('div', { class: 'avatar-lg' }, avatarSvg(a.look, 'avatar-lg'));
    const refresh = () => {
      preview.replaceChildren(avatarSvg(a.look, 'avatar-lg'));
      saveAgents();
    };
    const hairStyle = h(
      'select',
      {
        onChange: (e) => {
          a.look.hairStyle = e.target.value;
          refresh();
        },
      },
      HAIR_STYLES.map(([v, l]) => h('option', { value: v }, l))
    );
    hairStyle.value = a.look.hairStyle;
    wrap.append(
      h(
        'section',
        { class: 'team-card' },
        h('div', { class: 'team-card-head' }, preview, h('div', null, h('strong', null, `${role.icon} ${role.title}`), h('div', { class: 'hint' }, role.short))),
        field(
          'Nombre',
          h('input', {
            type: 'text',
            value: a.name,
            maxlength: 24,
            onInput: (e) => {
              a.name = e.target.value.trim() || role.title;
              saveAgents();
            },
          })
        ),
        field(
          'Personalidad',
          h('textarea', {
            rows: 3,
            value: a.personality,
            onInput: (e) => {
              a.personality = e.target.value;
              saveAgents();
            },
          })
        ),
        field(
          'Indicaciones extra (opcional)',
          h('textarea', {
            rows: 2,
            value: a.extra,
            placeholder: 'Ej.: Nunca uses la palabra "paraíso". Siempre cierra con una pregunta.',
            onInput: (e) => {
              a.extra = e.target.value;
              saveAgents();
            },
          })
        ),
        h(
          'div',
          { class: 'form-grid' },
          h('div', { class: 'field' }, h('span', { class: 'label' }, 'Camisa'), swatches(SHIRTS, a.look.shirt, (c) => ((a.look.shirt = c), refresh()))),
          h('div', { class: 'field' }, h('span', { class: 'label' }, 'Tono de piel'), swatches(SKINS, a.look.skin, (c) => ((a.look.skin = c), refresh()))),
          h('div', { class: 'field' }, h('span', { class: 'label' }, 'Peinado'), hairStyle),
          h('div', { class: 'field' }, h('span', { class: 'label' }, 'Color de pelo / gorra'), swatches(HAIRS, a.look.hair, (c) => ((a.look.hair = c), refresh())))
        )
      )
    );
  }
  return wrap;
}

// ---------------- Marca ----------------
const BRIEF_FIELDS = [
  ['marca', 'Nombre de la marca', 'Vacilando Ando Tours', 1],
  ['queHacemos', 'Qué hacemos', '', 3],
  ['destinos', 'Destinos y productos', 'Ej.: Los Roques, Morrocoy, Mochima, Choroní, Médanos de Coro, Mérida… (tipo de viaje y "precio desde", si quieres)', 4],
  ['publico', 'Público objetivo', 'Ej.: jóvenes y parejas de 22 a 40 años de Caracas y Valencia que buscan escapadas de fin de semana; grupos de amigos; familias…', 3],
  ['tono', 'Tono de voz', '', 2],
  ['cierre', 'Cómo se vende', '', 2],
  ['whatsapp', 'WhatsApp / enlace de contacto', 'Ej.: wa.me/58412XXXXXXX o "link en la bio"', 1],
  ['diferenciadores', 'Diferenciadores', 'Ej.: grupos pequeños, guías locales, transporte incluido, fotos del viaje…', 2],
  ['evitar', 'Cosas a evitar', 'Ej.: no prometer clima, no hablar de la competencia, no usar groserías…', 2],
  ['extras', 'Otros datos útiles', 'Ej.: métodos de pago, puntos de salida, temporadas fuertes, frases que usamos…', 3],
];

function brandTab() {
  const b = store.brief();
  return h(
    'div',
    null,
    h('p', { class: 'note' }, 'Esto es lo que los tres agentes saben de la marca. Mientras más completo, mejores copys, guiones y análisis.'),
    BRIEF_FIELDS.map(([key, label, placeholder, rows]) =>
      field(
        label,
        rows === 1
          ? h('input', {
              type: 'text',
              value: b[key] || '',
              placeholder,
              onInput: (e) => {
                b[key] = e.target.value;
                saveBrief();
              },
            })
          : h('textarea', {
              rows,
              value: b[key] || '',
              placeholder,
              onInput: (e) => {
                b[key] = e.target.value;
                saveBrief();
              },
            })
      )
    )
  );
}

// ---------------- Fuentes ----------------
function sourcesTab() {
  const s = store.settings();
  const ta = h('textarea', {
    rows: 14,
    value: s.sources.join('\n'),
    onInput: (e) => {
      s.sources = e.target.value
        .split(/\n|,/)
        .map((x) => x.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
        .filter(Boolean);
      saveSettings();
    },
  });
  return h(
    'div',
    null,
    h(
      'p',
      { class: 'note' },
      'Fuentes oficiales y de expertos (un dominio por línea). Se usan cuando un agente busca "solo en fuentes oficiales" y en una de las búsquedas de la sala de juntas. Funciona con Tavily.'
    ),
    field('Dominios', ta),
    h(
      'button',
      {
        class: 'btn btn-ghost btn-sm',
        type: 'button',
        onClick: () => {
          s.sources = [...DEFAULT_SOURCES];
          ta.value = s.sources.join('\n');
          store.save('settings');
          toast('Lista restaurada', 'ok', 1800);
        },
      },
      '↺ Restaurar lista original'
    )
  );
}

// ---------------- Datos ----------------
function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dataTab() {
  const includeKeys = h('input', { type: 'checkbox' });
  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (!(await confirmDialog('Esto reemplaza conversaciones, métricas, reuniones, equipo y brief con los del respaldo. ¿Seguimos?', { okLabel: 'Sí, importar' }))) return;
      store.importAll(payload);
      toast('Respaldo importado ✔', 'ok');
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      toast(e.message || 'No pude leer ese archivo.', 'error');
    }
  });

  const danger = (label, message, keys, after) =>
    h(
      'button',
      {
        class: 'btn btn-ghost btn-sm',
        type: 'button',
        onClick: async () => {
          if (!(await confirmDialog(message, { okLabel: 'Sí, borrar', danger: true }))) return;
          store.clearKeys(keys);
          toast('Listo, borrado.', 'ok');
          after?.();
        },
      },
      label
    );

  return h(
    'div',
    null,
    h(
      'p',
      { class: 'note' },
      `Todo se guarda en este navegador (${store.usageKB()} KB usados). Si borras los datos del navegador o cambias de dispositivo, se pierde: descarga un respaldo de vez en cuando.`
    ),
    h('div', { class: 'section-title' }, 'Respaldo'),
    h('div', { class: 'field' }, h('label', { class: 'check' }, includeKeys, 'Incluir mis API keys en el respaldo (no lo compartas con nadie)')),
    h(
      'div',
      { class: 'chips' },
      h(
        'button',
        {
          class: 'btn btn-primary btn-sm',
          type: 'button',
          onClick: () => {
            const data = store.exportAll({ includeKeys: includeKeys.checked });
            download(`la-oficina-respaldo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
          },
        },
        '⬇️ Descargar respaldo'
      ),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: () => fileInput.click() }, '⬆️ Importar respaldo'),
      fileInput
    ),
    h('div', { class: 'section-title' }, 'Limpiar'),
    h(
      'div',
      { class: 'chips' },
      danger('🧹 Borrar conversaciones', '¿Borrar las conversaciones de las tres oficinas?', AGENT_IDS.map((id) => 'chat:' + id), () => emit('chat', { agentId: '*', type: 'append' })),
      danger('🧹 Borrar reuniones', '¿Borrar todas las actas de la sala de juntas?', ['meetings']),
      danger('🧹 Borrar métricas', '¿Borrar todo el registro de métricas?', ['metrics']),
      danger('⚠️ Borrar todo', '¿Borrar TODO (claves, equipo, brief, conversaciones, métricas)? No se puede deshacer.', Object.keys(store.DEFAULTS), () =>
        setTimeout(() => location.reload(), 500)
      )
    )
  );
}

export function renderSettings(panel, tab = 'claves') {
  if (!TABS.some(([k]) => k === tab)) tab = 'claves';
  const head = h(
    'header',
    { class: 'panel-head' },
    h('button', { class: 'icon-btn back-btn only-sheet', type: 'button', 'aria-label': 'Volver a la oficina', onClick: () => go('#/') }, '←'),
    h('span', { class: 'avatar', style: { display: 'grid', placeItems: 'center', fontSize: '20px' } }, '⚙️'),
    h('div', { class: 'panel-title' }, h('strong', null, 'Configuración'), h('span', null, 'Claves, equipo, marca y datos'))
  );
  const tabs = h(
    'div',
    { class: 'tabs', role: 'tablist' },
    TABS.map(([k, label]) => h('button', { class: 'tab', role: 'tab', type: 'button', 'aria-selected': String(k === tab), onClick: () => go(`#/config/${k}`) }, label))
  );
  const content = { claves: keysTab, equipo: teamTab, marca: brandTab, fuentes: sourcesTab, datos: dataTab }[tab]();
  panel.replaceChildren(head, tabs, h('div', { class: 'panel-body' }, content));
  return () => {
    store.save('settings');
    store.save('brief');
    store.save('agents');
  };
}
