// Sala de juntas: investigación web + ronda de ideas de los agentes + plan final.

import { h, toast, copyText, uid, fmtDate, confirmDialog } from './ui.js';
import * as store from './store.js';
import { AGENT_IDS } from './store.js';
import { runtime, on, emit, go, setStatus } from './state.js';
import { research, meetingTurn, meetingPlan, searchProvider } from './brain.js';
import { md, toPlain } from './markdown.js';
import { ROLES, agentName, bossName } from './prompts.js';
import { avatarSvg, moveAgent, bossGoTo } from './office.js';
import { sourcesEl } from './chat.js';

const ORDER = ['analista', 'guion', 'copy'];
const FORMATS = ['Reel', 'TikTok', 'Reel + TikTok', 'Carrusel', 'Stories', 'Serie de contenido', 'Libre'];
const GOALS = ['Alcance (que nos descubran)', 'Confianza', 'Venta (consultas por WhatsApp)'];

const meetings = () => store.get('meetings');
const getMeeting = (id) => meetings().find((m) => m.id === id);

function persist() {
  const list = meetings();
  if (list.length > 30) list.length = 30;
  store.save('meetings');
}

export function recoverMeetings() {
  let changed = false;
  for (const m of meetings()) {
    for (const t of m.turns) {
      if (t.pending) {
        t.pending = false;
        if (!t.text && !t.digest) t.error = 'Se interrumpió (se recargó la página).';
        changed = true;
      }
    }
    if (m.planPending) {
      m.planPending = false;
      changed = true;
    }
  }
  if (changed) persist();
}

const changed = (m, extra = {}) => emit('meeting', { id: m.id, ...extra });

// ---------------- Motor de la reunión ----------------

async function runSession(m, { doResearch = false, focus = '', kikeText = '', plan = false } = {}) {
  if (runtime.meetingBusy) return;
  runtime.meetingBusy = true;
  runtime.activeMeetingId = m.id;
  m.status = 'open';
  const ctrl = new AbortController();
  runtime.aborters.meeting = ctrl;
  const signal = ctrl.signal;
  m.progress = 'Llegando a la sala…';
  changed(m, { type: 'append' });

  try {
    // Los agentes caminan a la sala mientras arranca la investigación.
    const arrival = Promise.all([
      bossGoTo('meeting'),
      ...m.participants.map((id) => {
        setStatus(id, runtime.aborters[id] ? runtime.status[id] : 'meeting');
        return moveAgent(id, 'meeting');
      }),
    ]);

    if (kikeText) {
      m.turns.push({ id: uid(), speaker: 'kike', text: kikeText });
      persist();
      changed(m, { type: 'append' });
    }

    if (doResearch) {
      const t = { id: uid(), speaker: 'research', pending: true, focus, digest: '', sources: [], queries: [] };
      m.turns.push(t);
      const researcher = m.participants.includes('analista') ? 'analista' : m.participants[0];
      setStatus(researcher, 'searching');
      m.progress = `${agentName(researcher)} está investigando en la web…`;
      changed(m, { type: 'append' });
      try {
        const r = await research({
          meeting: m,
          focus,
          signal,
          onStatus: (txt) => {
            m.progress = txt;
            changed(m, { type: 'progress' });
          },
        });
        Object.assign(t, r);
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        t.error = `No se pudo investigar: ${e.message}`;
      } finally {
        t.pending = false;
        setStatus(researcher, 'meeting');
        persist();
        changed(m, { type: 'append' });
      }
    }

    await arrival;

    if (plan) {
      const mod = m.participants.includes('guion') ? 'guion' : m.participants[0];
      setStatus(mod, 'talking');
      m.progress = `${agentName(mod)} está armando el plan…`;
      m.plan = '';
      m.planPending = true;
      changed(m, { type: 'append' });
      try {
        const res = await meetingPlan({
          meeting: m,
          signal,
          onText: (txt) => {
            m.plan = txt;
            changed(m, { type: 'plan' });
          },
        });
        m.plan = res.text;
        m.planVia = res.via;
      } finally {
        m.planPending = false;
        setStatus(mod, 'meeting');
      }
    } else {
      for (const id of ORDER.filter((x) => m.participants.includes(x))) {
        const t = { id: uid(), speaker: id, text: '', pending: true };
        m.turns.push(t);
        m.progress = `${agentName(id)} está hablando…`;
        setStatus(id, 'talking');
        changed(m, { type: 'append' });
        try {
          const res = await meetingTurn({
            meeting: m,
            agentId: id,
            signal,
            onText: (txt) => {
              t.text = txt;
              changed(m, { type: 'turn', turn: t.id });
            },
          });
          t.text = res.text;
          t.via = res.via;
          if (!t.text.trim()) t.error = 'No respondió. Intenta otra ronda.';
        } catch (e) {
          if (e.name !== 'AbortError') t.error = e.message;
          throw e;
        } finally {
          t.pending = false;
          setStatus(id, 'meeting');
          persist();
          changed(m, { type: 'append' });
        }
      }
    }
  } catch (e) {
    if (e.name === 'AbortError') toast('Reunión en pausa. Puedes seguir cuando quieras.', 'info');
    else toast(e.message || 'Algo falló en la reunión.', 'error', 8000);
  } finally {
    runtime.meetingBusy = false;
    delete runtime.aborters.meeting;
    m.progress = '';
    persist();
    changed(m, { type: 'append' });
  }
}

function endMeeting(m) {
  runtime.aborters.meeting?.abort();
  m.status = 'closed';
  persist();
  if (runtime.activeMeetingId === m.id) runtime.activeMeetingId = null;
  for (const id of AGENT_IDS) {
    if (runtime.location[id] === 'meeting') {
      moveAgent(id, 'office').then(() => setStatus(id, runtime.aborters[id] ? runtime.status[id] : 'idle'));
    }
  }
  bossGoTo('home');
  changed(m, { type: 'append' });
}

// ---------------- Vistas ----------------

function header(title, subtitle) {
  return h(
    'header',
    { class: 'panel-head' },
    h('button', { class: 'icon-btn back-btn only-sheet', type: 'button', 'aria-label': 'Volver a la oficina', onClick: () => go('#/') }, '←'),
    h('span', { class: 'avatar', style: { display: 'grid', placeItems: 'center', fontSize: '20px' } }, '🤝'),
    h('div', { class: 'panel-title' }, h('strong', null, title), h('span', null, subtitle))
  );
}

function chipGroup(options, selected, onPick) {
  const group = h('div', { class: 'chips', role: 'group' });
  const render = (value) => {
    group.replaceChildren(
      ...options.map((o) =>
        h(
          'button',
          {
            class: 'chip',
            type: 'button',
            'aria-pressed': String(o === value),
            onClick: () => {
              const v = o === value ? '' : o;
              onPick(v);
              render(v);
            },
          },
          o
        )
      )
    );
  };
  render(selected);
  return group;
}

function recentList(limit = 6) {
  const list = meetings().slice(0, limit);
  if (!list.length) return null;
  return h(
    'div',
    null,
    h('div', { class: 'section-title' }, 'Actas anteriores'),
    h(
      'ul',
      { class: 'list-plain' },
      list.map((m) =>
        h(
          'li',
          null,
          h(
            'button',
            { class: 'list-row', type: 'button', onClick: () => go(`#/juntas/${m.id}`) },
            h('span', null, m.plan ? '📋' : '💬'),
            h('span', { class: 'grow' }, h('strong', null, m.topic), h('small', null, `${fmtDate(m.createdAt.slice(0, 10), { day: '2-digit', month: 'short', year: 'numeric' })} · ${m.format || 'Libre'}${m.plan ? ' · con plan' : ''}`))
          )
        )
      )
    )
  );
}

function renderSetup(panel) {
  const draft = runtime.meetingDraft || {};
  runtime.meetingDraft = null;
  const form = { topic: draft.topic || '', destination: '', format: 'Reel + TikTok', goal: 'Venta (consultas por WhatsApp)', participants: [...AGENT_IDS] };
  const s = store.settings();
  const provider = searchProvider();
  const agents = store.agents();

  const topic = h('textarea', {
    rows: 4,
    placeholder: 'Ej.: Necesito un reel para vender el full day a Cayo Sombrero del próximo sábado; quedan 8 cupos.',
    value: form.topic,
    onInput: (e) => (form.topic = e.target.value),
  });
  const destination = h('input', { type: 'text', placeholder: 'Ej.: Morrocoy · full day', onInput: (e) => (form.destination = e.target.value) });
  const researchCheck = h('input', { type: 'checkbox', checked: !!provider });
  if (!provider) researchCheck.disabled = true;

  const participants = h(
    'div',
    { class: 'chips' },
    AGENT_IDS.map((id) => {
      const cb = h('input', {
        type: 'checkbox',
        checked: true,
        onChange: (e) => {
          form.participants = e.target.checked ? [...new Set([...form.participants, id])] : form.participants.filter((x) => x !== id);
        },
      });
      return h('label', { class: 'chip' }, cb, avatarSvg(agents[id].look, 'avatar'), agents[id].name);
    })
  );
  participants.querySelectorAll('.avatar').forEach((a) => Object.assign(a.style, { width: '22px', height: '22px' }));

  const start = () => {
    if (!form.topic.trim()) {
      toast('Cuéntale al equipo qué necesitas crear.', 'warn');
      topic.focus();
      return;
    }
    if (!form.participants.length) {
      toast('Invita al menos a un agente.', 'warn');
      return;
    }
    if (!s.geminiKey) {
      toast('Primero agrega tu API key de Google AI Studio en Configuración.', 'warn');
      go('#/config/claves');
      return;
    }
    if (runtime.meetingBusy) {
      toast('Ya hay una reunión en curso.', 'warn');
      return;
    }
    // Si otra reunión quedó abierta, los agentes se quedan en la sala para la nueva.
    for (const old of meetings()) if (old.status === 'open') old.status = 'closed';
    const m = {
      id: uid(),
      createdAt: new Date().toISOString(),
      topic: form.topic.trim(),
      destination: form.destination.trim(),
      format: form.format,
      goal: form.goal,
      participants: ORDER.filter((x) => form.participants.includes(x)),
      turns: [],
      plan: '',
      status: 'open',
    };
    meetings().unshift(m);
    persist();
    runtime.activeMeetingId = m.id;
    go(`#/juntas/${m.id}`);
    runSession(m, { doResearch: researchCheck.checked });
  };

  const body = h(
    'div',
    { class: 'panel-body' },
    h('p', { style: { marginTop: 0, color: 'var(--ink-2)' } }, 'Cuéntale al equipo qué necesitas. Primero se investiga en la web, luego cada quien aporta desde su área y al final arman el plan de contenido.'),
    h('div', { class: 'field' }, h('label', null, '¿Qué necesitamos crear?'), topic),
    h('div', { class: 'field' }, h('label', null, 'Destino o producto (opcional)'), destination),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Formato'), chipGroup(FORMATS, form.format, (v) => (form.format = v))),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Objetivo'), chipGroup(GOALS, form.goal, (v) => (form.goal = v))),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Invitados'), participants),
    h(
      'div',
      { class: 'field' },
      h('label', { class: 'check' }, researchCheck, '🔎 Investigar en la web antes de la lluvia de ideas'),
      h(
        'span',
        { class: 'hint' },
        provider
          ? `Con ${provider === 'tavily' ? 'Tavily (≈3 búsquedas)' : 'Google vía Gemini'}. La reunión completa usa unas 5–6 consultas a Gemini.`
          : 'La búsqueda web está desactivada en Configuración.'
      )
    ),
    h('button', { class: 'btn btn-primary btn-block', type: 'button', onClick: start }, '🤝 Convocar reunión'),
    recentList()
  );

  panel.replaceChildren(header('Sala de juntas', 'Lluvia de ideas con todo el equipo'), body);
  if (!draft.topic) setTimeout(() => topic.focus(), 50);
  return null;
}

function turnEl(m, t) {
  const agents = store.agents();
  if (t.speaker === 'kike') {
    return h(
      'div',
      { class: 'turn turn-kike', 'data-turn': t.id },
      h('div', { class: 'turn-head' }, avatarSvg(store.boss().look), `👑 ${bossName()}`, h('small', null, 'Jefe')),
      t.text
    );
  }
  if (t.speaker === 'research') {
    const el = h('div', { class: 'turn turn-research', 'data-turn': t.id });
    el.append(h('div', { class: 'turn-head' }, '📚 Investigación web', t.focus ? h('small', null, `· ${t.focus.slice(0, 60)}`) : null));
    if (t.pending) el.append(h('div', { class: 'progress-line' }, h('span', { class: 'spinner' }), m.progress || 'Investigando…'));
    else if (t.error) el.append(h('p', null, '⚠️ ', t.error));
    else {
      if (t.queries?.length) el.append(h('div', { class: 'chips', style: { marginBottom: '6px' } }, t.queries.map((q) => h('span', { class: 'chip' }, '🔎 ', q))));
      if (t.provider === 'google' && t.digest) el.append(h('div', { class: 'md', html: md(t.digest) }));
      el.append(sourcesEl(t.sources) || h('p', { class: 'hint' }, 'Sin fuentes encontradas.'));
    }
    return el;
  }
  const a = agents[t.speaker];
  const el = h('div', { class: `turn${t.error ? ' msg-error' : ''}`, 'data-turn': t.id });
  el.append(h('div', { class: 'turn-head' }, avatarSvg(a.look), a.name, h('small', null, ROLES[t.speaker].title), viaBadge(t.via)));
  if (t.text) el.append(h('div', { class: 'md', html: md(t.text) }));
  else if (t.pending) el.append(h('div', { class: 'typing' }, h('i'), h('i'), h('i')));
  if (t.error) el.append(h('p', null, '⚠️ ', t.error));
  return el;
}

function viaBadge(via) {
  return via === 'groq' ? h('span', { class: 'via-badge', title: 'Esta respuesta la generó Groq' }, '⚡ Groq') : null;
}

function planEl(m) {
  if (!m.plan && !m.planPending) return null;
  return h(
    'div',
    { class: 'turn turn-plan', 'data-plan': '1' },
    h('div', { class: 'turn-head' }, '📋 Plan de contenido', viaBadge(m.planVia)),
    m.plan ? h('div', { class: 'md', html: md(m.plan) }) : h('div', { class: 'typing' }, h('i'), h('i'), h('i')),
    !m.planPending && m.plan
      ? h(
          'div',
          { class: 'msg-actions' },
          h('button', { class: 'chip', type: 'button', onClick: () => copyText(toPlain(m.plan)) }, '📋 Copiar plan'),
          h(
            'button',
            {
              class: 'chip',
              type: 'button',
              onClick: () => {
                runtime.drafts.copy = `Del plan de la reunión "${m.topic}":\n\n${toPlain(m.plan)}\n\nAyúdame a pulir los copys finales.`;
                go('#/agente/copy');
              },
            },
            `➡️ ${store.agents().copy.name}`
          ),
          h(
            'button',
            {
              class: 'chip',
              type: 'button',
              onClick: () => {
                runtime.drafts.guion = `Del plan de la reunión "${m.topic}":\n\n${toPlain(m.plan)}\n\nAyúdame a afinar el guion para grabar.`;
                go('#/agente/guion');
              },
            },
            `➡️ ${store.agents().guion.name}`
          )
        )
      : null
  );
}

function renderMeeting(panel, m) {
  const agents = store.agents();
  const body = h('div', { class: 'panel-body' });
  const log = h('div', { class: 'meeting-log', role: 'log' });
  const controls = h('div', { class: 'meet-controls' });
  let kikeDraft = '';

  const summary = () =>
    h(
      'div',
      { class: 'turn', style: { background: 'var(--surface)' } },
      h('div', { class: 'turn-head' }, '🎯 Tema'),
      h('p', { style: { margin: '0 0 8px', whiteSpace: 'pre-wrap' } }, m.topic),
      h(
        'div',
        { class: 'chips' },
        m.format ? h('span', { class: 'chip' }, '🎞️ ', m.format) : null,
        m.goal ? h('span', { class: 'chip' }, '🎯 ', m.goal) : null,
        m.destination ? h('span', { class: 'chip' }, '📍 ', m.destination) : null,
        m.participants.map((id) => h('span', { class: 'chip' }, agents[id].name))
      )
    );

  const nearBottom = () => body.scrollHeight - body.scrollTop - body.clientHeight < 140;

  const renderLog = () => {
    const stick = nearBottom();
    log.replaceChildren(summary(), ...m.turns.map((t) => turnEl(m, t)), planEl(m) || '');
    if (stick) body.scrollTop = body.scrollHeight;
  };

  const renderControls = () => {
    const busy = runtime.meetingBusy && runtime.activeMeetingId === m.id;
    if (busy) {
      controls.replaceChildren(
        h('div', { class: 'progress-line' }, h('span', { class: 'spinner' }), m.progress || 'Trabajando…'),
        h('div', { class: 'row' }, h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: () => runtime.aborters.meeting?.abort() }, '⏸ Pausar'))
      );
      return;
    }
    if (runtime.meetingBusy) {
      controls.replaceChildren(h('p', { class: 'hint', style: { margin: 0 } }, 'Hay otra reunión en curso. Espera a que termine.'));
      return;
    }
    if (m.status === 'closed') {
      controls.replaceChildren(
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: () => runSession(m, {}) }, '🔁 Reabrir con otra ronda'),
          h(
            'button',
            {
              class: 'btn btn-primary btn-sm',
              type: 'button',
              onClick: () => {
                runtime.activeMeetingId = null;
                go('#/juntas');
              },
            },
            '➕ Nueva reunión'
          )
        )
      );
      return;
    }
    const provider = searchProvider();
    const ta = h('textarea', {
      rows: 2,
      placeholder: `Tu aporte o instrucción como jefe, ${bossName()} (opcional)…`,
      value: kikeDraft,
      onInput: (e) => (kikeDraft = e.target.value),
    });
    const researchCb = h('input', { type: 'checkbox' });
    if (!provider) researchCb.disabled = true;
    const round = () => {
      const text = kikeDraft.trim();
      kikeDraft = '';
      runSession(m, { kikeText: text, doResearch: researchCb.checked && !!text, focus: text });
    };
    controls.replaceChildren(
      ta,
      h(
        'div',
        { class: 'row' },
        h('label', { class: 'check', style: { fontSize: '13px', marginRight: 'auto' } }, researchCb, '🔎 Investigar sobre mi aporte'),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: round }, '💬 Otra ronda'),
        h(
          'button',
          {
            class: 'btn btn-primary btn-sm',
            type: 'button',
            onClick: () => {
              const text = kikeDraft.trim();
              kikeDraft = '';
              runSession(m, { plan: true, kikeText: text });
            },
          },
          m.plan ? '📋 Rehacer plan' : '✅ Armar el plan'
        ),
        h(
          'button',
          {
            class: 'btn btn-ghost btn-sm',
            type: 'button',
            onClick: async () => {
              if (!m.plan && m.turns.length && !(await confirmDialog('¿Terminar la reunión sin armar el plan?', { okLabel: 'Sí, terminar' }))) return;
              endMeeting(m);
            },
          },
          '🚪 Terminar'
        )
      )
    );
  };

  body.append(log);
  panel.replaceChildren(header('Sala de juntas', m.status === 'closed' ? 'Acta de la reunión' : 'Reunión en curso'), body, controls);
  renderLog();
  renderControls();
  body.scrollTop = body.scrollHeight;

  return on('meeting', (d) => {
    if (d.id !== m.id) return;
    if (d.type === 'turn') {
      const t = m.turns.find((x) => x.id === d.turn);
      const old = log.querySelector(`[data-turn="${CSS.escape(d.turn)}"]`);
      const stick = nearBottom();
      if (t && old) old.replaceWith(turnEl(m, t));
      if (stick) body.scrollTop = body.scrollHeight;
    } else if (d.type === 'plan') {
      const old = log.querySelector('[data-plan]');
      const stick = nearBottom();
      const el = planEl(m);
      if (old && el) old.replaceWith(el);
      else if (el) log.append(el);
      if (stick) body.scrollTop = body.scrollHeight;
    } else if (d.type === 'progress') {
      const line = log.querySelector('.turn-research .progress-line');
      if (line) line.lastChild.textContent = m.progress;
      renderControls();
    } else {
      renderLog();
      renderControls();
    }
  });
}

export function renderMeetingPanel(panel, meetingId) {
  if (meetingId) {
    const m = getMeeting(meetingId);
    if (m) return renderMeeting(panel, m);
    toast('No encontré esa reunión.', 'warn');
  } else if (runtime.activeMeetingId && getMeeting(runtime.activeMeetingId)) {
    return renderMeeting(panel, getMeeting(runtime.activeMeetingId));
  }
  return renderSetup(panel);
}

export { meetings as listMeetings };
