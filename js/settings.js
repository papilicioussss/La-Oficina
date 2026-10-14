// Configuración: claves de API, equipo (bautizo y apariencia), brief de marca, fuentes y datos.

import { h, toast, debounce, confirmDialog } from './ui.js';
import * as store from './store.js';
import { AGENT_IDS, DEFAULT_SOURCES } from './store.js';
import { runtime, emit, go } from './state.js';
import { listModels } from './gemini.js';
import { tavilySearch, SearchUnavailable } from './search.js';
import { listGroqModels, autoPick } from './groq.js';
import { ROLES } from './prompts.js';
import { avatarSvg } from './office.js';
import { catHeadSvg } from './cat-sprite.js';
import { MEM_CATS, facts, addFact, updateFact, removeFact, clearMemory } from './memory.js';
import { allSkills, isEnabled, isPinned, norm } from './skills.js';
import { SKILL_GROUPS } from './skills-data.js';
import { uid } from './ui.js';

const TABS = [
  ['claves', '🔑 Claves'],
  ['equipo', '👥 Equipo'],
  ['memoria', '🧠 Memoria'],
  ['habilidades', '🛠️ Habilidades'],
  ['marca', '🏝️ Marca'],
  ['fuentes', '📚 Fuentes'],
  ['datos', '💾 Datos'],
];

const SHIRTS = ['#ff8a3d', '#008ec7', '#00a100', '#fde07e', '#324966', '#00b9ec', '#30bb4f', '#e05297', '#7a5af8'];
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
const saveCat = debounce(() => {
  store.save('cat');
  emit('agents-changed');
}, 450);
const saveBoss = debounce(() => {
  store.save('boss');
  emit('agents-changed');
}, 450);

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

  // Router: elegir el modelo según la tarea
  const known = s.knownModels?.length ? s.knownModels : DEFAULT_MODELS;
  const heavySel = h(
    'select',
    {
      onChange: (e) => {
        s.heavyModel = e.target.value;
        saveSettings();
      },
    },
    h('option', { value: '' }, 'Igual al principal'),
    ...known.map((m) => h('option', { value: m.id }, m.id))
  );
  if (s.heavyModel && !known.some((m) => m.id === s.heavyModel)) heavySel.append(h('option', { value: s.heavyModel }, s.heavyModel));
  heavySel.value = s.heavyModel || '';
  const check = (key, label, hint) =>
    h(
      'div',
      { class: 'field' },
      h(
        'label',
        { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: s[key] !== false,
          onChange: (e) => {
            s[key] = e.target.checked;
            saveSettings();
          },
        }),
        label
      ),
      hint ? h('span', { class: 'hint' }, hint) : null
    );
  const routerBox = h(
    'div',
    null,
    h('div', { class: 'section-title' }, 'Modelo automático según la tarea'),
    h(
      'p',
      { class: 'note' },
      '🚦 Los agentes y el gato eligen solos el modelo para gastar lo justo: un saludo o un "gracias" usa el modelo rápido (con un prompt mínimo y sin buscar en la web); lo normal usa el modelo principal; las tareas grandes (planes, análisis, guiones completos, fotos o textos largos) usan el modelo potente que elijas aquí. Verás una etiqueta ⚡ rápido o 🧠 potente en la respuesta.'
    ),
    check('routerOn', 'Elegir el modelo automáticamente'),
    field(
      'Modelo para tareas pesadas',
      heavySel,
      'Si eliges un modelo "Pro" ten en cuenta que su límite gratis es mucho más corto. Déjalo en "Igual al principal" para no gastarlo.'
    ),
    check('lightGroq', 'Usar Groq para mensajes simples', 'Si tienes la key de Groq funcionando, los saludos los responde Groq (rapidísimo) y ahorras cuota de Gemini.')
  );
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
    routerBox,
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
    h('div', { class: 'gap-4' }),
    field(
      'API key de Tavily',
      h('div', { class: 'key-row' }, t.input, t.eye, tTest),
      h('span', null, 'Sácala gratis en ', h('a', { href: 'https://app.tavily.com', target: '_blank', rel: 'noopener noreferrer' }, 'app.tavily.com'), '. ', tStatus)
    ),
    h(
      'details',
      null,
      h('summary', { class: 'fw-semibold' }, 'Avanzado: proxy de Tavily'),
      h(
        'div',
        { class: 'mt-3' },
        field(
          'URL del proxy (opcional)',
          proxy,
          'Solo si Tavily no conecta directo desde el navegador. En el README está el paso a paso para crear uno gratis en Cloudflare.'
        )
      )
    ),
    groqSection(s)
  );
  return wrap;
}

function groqModelSelect(current, onChange) {
  const s = store.settings();
  const known = s.groqKnownModels?.length
    ? s.groqKnownModels
    : [
        { id: 'openai/gpt-oss-120b', label: 'openai/gpt-oss-120b' },
        { id: 'llama-3.1-8b-instant', label: 'llama-3.1-8b-instant' },
      ];
  const list = [...known];
  if (current && !list.some((m) => m.id === current)) list.unshift({ id: current, label: current });
  const sel = h('select', { onChange: (e) => onChange(e.target.value) }, list.map((m) => h('option', { value: m.id }, m.id)));
  sel.value = current;
  return sel;
}

function groqSection(s) {
  const box = h('div');
  const status = h('span', { class: 'hint' });
  const k = secretInput(s.groqKey, (v) => {
    s.groqKey = v;
    runtime.groqBlocked = false;
    runtime.groqWarned = false;
    saveSettings();
  }, 'gsk_…');
  const test = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Probar');
  const models = h('div');
  const renderModels = () => {
    const pick = autoPick(s.groqKnownModels);
    const auto = h(
      'div',
      { class: 'field' },
      h(
        'label',
        { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: s.groqAuto !== false,
          onChange: (e) => {
            s.groqAuto = e.target.checked;
            saveSettings();
            renderModels();
          },
        }),
        'Elegir el modelo de Groq automáticamente (recomendado)'
      ),
      h('div', { class: 'hint' }, `Ahora usa: ${pick.main} para lo normal y ${pick.fast} para lo rápido. Si Groq retira un modelo, la app cambia sola. Toca "Probar" para que mire tu lista.`)
    );
    models.replaceChildren(
      auto,
      ...(s.groqAuto === false
        ? [
            field(
              'Modelo de Groq',
              groqModelSelect(s.groqModel, (v) => {
                s.groqModel = v;
                saveSettings();
              }),
              'Para las reuniones y el respaldo. Recomendado: openai/gpt-oss-120b. Evita allam-2-7b (está pensado para árabe).'
            ),
            field(
              'Modelo rápido de Groq',
              groqModelSelect(s.groqFastModel, (v) => {
                s.groqFastModel = v;
                saveSettings();
              }),
              'Para saludos y tareas pequeñas. Recomendado: llama-3.1-8b-instant.'
            ),
          ]
        : [])
    );
  };
  renderModels();
  test.addEventListener('click', async () => {
    store.save('settings');
    if (!s.groqKey) {
      status.className = 'err-text';
      status.textContent = 'Pega tu key primero.';
      return;
    }
    test.disabled = true;
    status.className = 'hint';
    status.textContent = 'Probando…';
    try {
      const list = await listGroqModels(s.groqKey);
      s.groqKnownModels = list;
      runtime.groqBlocked = false;
      store.save('settings');
      renderModels();
      status.className = 'ok-text';
      status.textContent = `✔ Conectado. ${list.length} modelos disponibles.`;
      if (s.groqAuto === false && list.length && !list.some((m) => m.id === s.groqModel)) toast(`Ojo: "${s.groqModel}" ya no está en Groq. Activa el modo automático o elige otro.`, 'warn', 7000);
    } catch (e) {
      status.className = 'err-text';
      status.textContent = '✖ ' + e.message;
    } finally {
      test.disabled = false;
    }
  });
  const check = (key, label) =>
    h(
      'div',
      { class: 'field' },
      h(
        'label',
        { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: s[key],
          onChange: (e) => {
            s[key] = e.target.checked;
            saveSettings();
          },
        }),
        label
      )
    );
  box.append(
    h('div', { class: 'section-title' }, 'Groq · opcional (velocidad y respaldo)'),
    h(
      'p',
      { class: 'note' },
      '⚡ Groq responde rapidísimo y tiene plan gratis aparte. Lo uso donde más rinde: en los turnos de la sala de juntas (muchas llamadas seguidas, así ahorras cuota de Gemini) y como respaldo automático cuando Gemini llega a su límite. Gemini sigue a cargo de lo que Groq no hace igual de bien: leer capturas y buscar con Google.'
    ),
    field(
      'API key de Groq',
      h('div', { class: 'key-row' }, k.input, k.eye, test),
      h('span', null, 'Sácala gratis en ', h('a', { href: 'https://console.groq.com/keys', target: '_blank', rel: 'noopener noreferrer' }, 'console.groq.com/keys'), '. ', status)
    ),
    models,
    check('groqMeetings', 'Usar Groq en los turnos de la sala de juntas'),
    check('groqFallback', 'Usar Groq como respaldo cuando Gemini llegue al límite')
  );
  return box;
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

function bossCard() {
  const b = store.boss();
  const preview = h('div', { class: 'avatar-lg' }, avatarSvg(b.look, 'avatar-lg'));
  const refresh = () => {
    preview.replaceChildren(avatarSvg(b.look, 'avatar-lg'));
    saveBoss();
  };
  const hairStyle = h(
    'select',
    {
      onChange: (e) => {
        b.look.hairStyle = e.target.value;
        refresh();
      },
    },
    HAIR_STYLES.map(([v, l]) => h('option', { value: v }, l))
  );
  hairStyle.value = b.look.hairStyle;
  return h(
    'section',
    { class: 'team-card team-card-boss' },
    h(
      'div',
      { class: 'team-card-head' },
      preview,
      h('div', null, h('strong', null, '👑 Tú, el jefe'), h('div', { class: 'hint' }, 'Tu avatar en la oficina: camina hasta los agentes y dirige las reuniones.'))
    ),
    field(
      'Tu nombre',
      h('input', {
        type: 'text',
        value: b.name,
        maxlength: 20,
        onInput: (e) => {
          b.name = e.target.value.trim() || 'Kike';
          saveBoss();
        },
      })
    ),
    h(
      'div',
      { class: 'form-grid' },
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Camisa'), swatches([...SHIRTS, '#1a1e1c'], b.look.shirt, (c) => ((b.look.shirt = c), refresh()))),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Tono de piel'), swatches(SKINS, b.look.skin, (c) => ((b.look.skin = c), refresh()))),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Peinado'), hairStyle),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Color de pelo / gorra'), swatches(HAIRS, b.look.hair, (c) => ((b.look.hair = c), refresh())))
    )
  );
}

function catCard() {
  const c = store.cat();
  return h(
    'section',
    { class: 'team-card team-card-cat' },
    h(
      'div',
      { class: 'team-card-head' },
      h('div', { class: 'avatar-lg avatar-cat' }, catHeadSvg('avatar-lg')),
      h('div', null, h('strong', null, '🐱 Tu gato asistente'), h('div', { class: 'hint' }, 'Mascota de la oficina y memoria de la marca. Toca al gato en la oficina para hablar con él.'))
    ),
    field(
      'Nombre del gato',
      h('input', {
        type: 'text',
        value: c.name,
        maxlength: 18,
        placeholder: 'Ej.: Mango',
        onInput: (e) => {
          c.name = e.target.value.trim().slice(0, 18);
          c.named = !!c.name || c.named;
          saveCat();
        },
      }),
      c.named ? null : 'Si lo dejas vacío, te lo pedirá la primera vez que lo toques.'
    )
  );
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
  wrap.append(bossCard(), catCard());
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

// ---------------- Memoria ----------------
function memoryTab() {
  const wrap = h('div');
  const render = () => {
    const list = facts();
    const nodes = [
      h(
        'p',
        { class: 'note' },
        '🧠 Esto es lo que tu gato sabe de la marca. Los tres agentes lo leen en cada respuesta. Puedes corregirlo aquí o contándoselo al gato en el chat.'
      ),
    ];
    for (const c of MEM_CATS) {
      const rows = list.filter((f) => f.cat === c.id);
      const box = h('section', { class: 'mem-cat' }, h('div', { class: 'section-title' }, `${c.icon} ${c.label} · ${rows.length}`));
      if (!rows.length) box.append(h('p', { class: 'hint' }, `Aún sin datos. Cuéntale al gato ${c.ask}.`));
      for (const f of rows) {
        const ta = h('textarea', {
          rows: 2,
          value: f.text,
          'aria-label': `Dato de ${c.label}`,
          onChange: (e) => {
            const v = e.target.value.trim();
            if (v) updateFact(f.id, { text: v });
            else render();
          },
        });
        box.append(
          h(
            'div',
            { class: 'mem-row' },
            ta,
            h(
              'button',
              {
                class: 'icon-btn',
                type: 'button',
                'aria-label': 'Borrar dato',
                onClick: () => {
                  removeFact(f.id);
                  render();
                },
              },
              '🗑️'
            )
          )
        );
      }
      nodes.push(box);
    }
    // Agregar a mano
    const catSel = h('select', null, MEM_CATS.map((c) => h('option', { value: c.id }, `${c.icon} ${c.label}`)));
    const text = h('textarea', { rows: 2, placeholder: 'Ej.: Full day a Morrocoy: $45 por persona, incluye lancha, almuerzo y transporte desde Valencia.' });
    nodes.push(
      h(
        'div',
        { class: 'team-card' },
        h('strong', null, '➕ Agregar un dato'),
        h('div', { class: 'gap-2' }),
        catSel,
        h('div', { class: 'gap-2' }),
        text,
        h('div', { class: 'gap-2' }),
        h(
          'button',
          {
            class: 'btn btn-primary btn-sm',
            type: 'button',
            onClick: () => {
              if (!text.value.trim()) return toast('Escribe el dato.', 'warn');
              addFact({ cat: catSel.value, text: text.value });
              render();
              toast('Dato guardado ✔', 'ok', 1800);
            },
          },
          'Guardar dato'
        )
      ),
      list.length
        ? h(
            'button',
            {
              class: 'btn btn-ghost btn-sm',
              type: 'button',
              onClick: async () => {
                if (!(await confirmDialog('¿Borrar TODA la memoria del gato? Los agentes dejarán de conocer estos datos.', { okLabel: 'Sí, borrar todo', danger: true }))) return;
                clearMemory();
                render();
              },
            },
            '🧹 Borrar toda la memoria'
          )
        : null
    );
    wrap.replaceChildren(...nodes);
  };
  render();
  return wrap;
}

// ---------------- Habilidades ----------------
function toggleIn(list, id, on) {
  const set = new Set(list);
  if (on) set.add(id);
  else set.delete(id);
  return [...set];
}

function skillsTab() {
  const s = store.settings();
  const wrap = h('div');
  const render = () => {
    const nodes = [
      h(
        'p',
        { class: 'note' },
        '🛠 Cada agente tiene una biblioteca de habilidades de marketing. Las básicas van siempre; las demás se activan solas cuando lo que pides las necesita (así no gastas tokens de más). En el chat también puedes elegirlas a mano con el botón "🛠 Skills". "Siempre" las deja activas en todas las consultas de ese agente.'
      ),
    ];
    for (const [agentId, label] of Object.entries(SKILL_GROUPS)) {
      const a = store.agents()[agentId];
      const list = allSkills().filter((x) => x.agents.includes(agentId));
      nodes.push(h('div', { class: 'section-title' }, `${ROLES[agentId].icon} ${a.name} · ${label} (${list.length})`));
      for (const sk of list) {
        const on = isEnabled(sk.id);
        const card = h(
          'div',
          { class: `skill-card${on ? '' : ' is-off'}` },
          h(
            'div',
            { class: 'skill-head' },
            h('span', { class: 'skill-icon' }, sk.icon),
            h('div', { class: 'grow' }, h('strong', null, sk.name, sk.core ? h('small', null, ' · básica, siempre activa') : null), h('small', null, sk.desc)),
            sk.custom
              ? h(
                  'button',
                  {
                    class: 'icon-btn',
                    type: 'button',
                    'aria-label': 'Borrar skill',
                    onClick: async () => {
                      if (!(await confirmDialog(`¿Borrar la skill "${sk.name}"?`, { okLabel: 'Borrar', danger: true }))) return;
                      s.customSkills = s.customSkills.filter((c) => c.id !== sk.id);
                      store.save('settings');
                      render();
                    },
                  },
                  '🗑️'
                )
              : null
          ),
          sk.core
            ? null
            : h(
                'div',
                { class: 'switches' },
                h(
                  'label',
                  null,
                  h('input', {
                    type: 'checkbox',
                    checked: on,
                    onChange: (e) => {
                      s.skillsOff = toggleIn(s.skillsOff || [], sk.id, !e.target.checked);
                      store.save('settings');
                      render();
                    },
                  }),
                  'Activa'
                ),
                h(
                  'label',
                  null,
                  h('input', {
                    type: 'checkbox',
                    checked: isPinned(sk.id),
                    disabled: !on,
                    onChange: (e) => {
                      s.skillsPinned = toggleIn(s.skillsPinned || [], sk.id, e.target.checked);
                      store.save('settings');
                    },
                  }),
                  'Siempre (gasta más tokens)'
                )
              ),
          h('details', null, h('summary', { class: 'fw-semibold' }, 'Ver instrucciones'), h('pre', null, sk.text))
        );
        nodes.push(card);
      }
    }
    nodes.push(customSkillForm(render));
    wrap.replaceChildren(...nodes);
  };
  render();
  return wrap;
}

function customSkillForm(onSaved) {
  const s = store.settings();
  const name = h('input', { type: 'text', maxlength: 60, placeholder: 'Ej.: Fotos para Instagram de playa' });
  const kw = h('input', { type: 'text', placeholder: 'Palabras que la activan, separadas por coma. Ej.: foto, fotografia, playa' });
  const text = h('textarea', { rows: 5, placeholder: 'Escribe las instrucciones como se las darías a un experto: qué debe hacer, reglas, ejemplos, qué evitar.' });
  const agentsSel = h(
    'div',
    { class: 'chips' },
    Object.entries(SKILL_GROUPS).map(([id]) =>
      h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: true, 'data-agent': id }), store.agents()[id].name)
    )
  );
  return h(
    'div',
    { class: 'team-card' },
    h('strong', null, '➕ Crear tu propia skill'),
    h('p', { class: 'hint' }, 'Para enseñarles algo específico de tu negocio. Se suma a la biblioteca y funciona igual que las demás.'),
    field('Nombre', name),
    field('Para qué agentes', agentsSel),
    field('Palabras que la activan', kw, 'Si lo dejas vacío, solo se usa cuando la eliges a mano o la marcas "Siempre".'),
    field('Instrucciones', text),
    h(
      'button',
      {
        class: 'btn btn-primary btn-sm',
        type: 'button',
        onClick: () => {
          const agents = [...agentsSel.querySelectorAll('input:checked')].map((i) => i.dataset.agent);
          if (!name.value.trim() || !text.value.trim()) return toast('Ponle nombre y escribe las instrucciones.', 'warn');
          if (!agents.length) return toast('Elige al menos un agente.', 'warn');
          s.customSkills = [
            ...(s.customSkills || []),
            { id: 'custom-' + uid(), name: name.value.trim(), agents, kw: kw.value.split(',').map((k) => norm(k).trim()).filter(Boolean), text: text.value.trim().slice(0, 4000), icon: '⭐' },
          ];
          store.save('settings');
          toast('Skill creada ✔', 'ok', 2000);
          onSaved();
        },
      },
      'Guardar skill'
    )
  );
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
      danger('🧹 Borrar conversaciones', '¿Borrar las conversaciones de las tres oficinas y del gato? (La memoria del gato se queda.)', [...AGENT_IDS.map((id) => 'chat:' + id), 'chat:gato'], () => emit('chat', { agentId: '*', type: 'append' })),
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
    h('span', { class: 'avatar avatar-icon' }, '⚙️'),
    h('div', { class: 'panel-title' }, h('strong', null, 'Configuración'), h('span', null, 'Claves, equipo, marca y datos'))
  );
  const tabs = h(
    'div',
    { class: 'tabs', role: 'tablist' },
    TABS.map(([k, label]) => h('button', { class: 'tab', role: 'tab', type: 'button', 'aria-selected': String(k === tab), onClick: () => go(`#/config/${k}`) }, label))
  );
  const content = { claves: keysTab, equipo: teamTab, memoria: memoryTab, habilidades: skillsTab, marca: brandTab, fuentes: sourcesTab, datos: dataTab }[tab]();
  panel.replaceChildren(head, tabs, h('div', { class: 'panel-body' }, content));
  return () => {
    store.save('settings');
    store.save('brief');
    store.save('agents');
    store.save('boss');
  };
}
