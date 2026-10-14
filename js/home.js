// Panel de inicio: saludo, pasos de configuración, equipo y reuniones recientes.

import { h, fmtDate } from './ui.js';
import * as store from './store.js';
import { AGENT_IDS } from './store.js';
import { runtime, on, go, STATUS_LABEL } from './state.js';
import { ROLES } from './prompts.js';
import { avatarSvg } from './office.js';

function checklist() {
  const s = store.settings();
  const b = store.brief();
  const a = store.agents();
  const named = AGENT_IDS.some((id) => a[id].name !== store.DEFAULTS.agents[id].name);
  const steps = [
    { done: !!s.geminiKey, label: 'Pega tu API key de Google AI Studio', to: '#/config/claves' },
    { done: !!(s.tavilyKey || s.tavilyProxy) || s.searchProvider === 'google', label: 'Pega tu API key de Tavily (búsqueda web)', to: '#/config/claves' },
    { done: named, label: 'Bautiza a tu equipo', to: '#/config/equipo' },
    { done: store.cat().named, label: 'Ponle nombre a tu gato (toca al gato en tu oficina)', to: '#/gato' },
    { done: !!(b.destinos.trim() && b.publico.trim()) || store.memory().length >= 3, label: 'Cuéntale al gato tus precios, destinos y público', to: '#/gato' },
  ];
  if (steps.every((x) => x.done)) return null;
  return h(
    'div',
    { class: 'checklist' },
    h('strong', null, '🚀 Para arrancar'),
    h(
      'ol',
      null,
      steps.map((st) =>
        h('li', { class: st.done ? 'done' : '' }, st.done ? st.label : h('button', { class: 'link-btn', type: 'button', onClick: () => go(st.to) }, st.label))
      )
    )
  );
}

function agentCard(id) {
  const a = store.agents()[id];
  const role = ROLES[id];
  const st = runtime.status[id];
  const busy = st !== 'idle' && st !== 'meeting';
  return h(
    'button',
    { class: 'agent-card', type: 'button', onClick: () => go(`#/agente/${id}`), 'data-agent-card': id },
    avatarSvg(a.look, 'avatar-lg'),
    h(
      'span',
      { class: 'meta' },
      h('strong', null, `${role.icon} ${a.name}`),
      h('span', null, role.title),
      h('span', null, busy ? STATUS_LABEL[st] : st === 'meeting' ? 'En la sala de juntas' : role.short)
    ),
    h('span', { class: `status-dot${busy ? ' is-busy' : ''}`, 'aria-hidden': 'true' })
  );
}

export function renderHome(panel) {
  const meetings = store.get('meetings').slice(0, 3);
  const cards = h('div', { class: 'agent-cards' });
  const renderCards = () => cards.replaceChildren(...AGENT_IDS.map(agentCard));
  renderCards();

  const hour = new Date().getHours();
  const name = store.boss().name || 'Kike';
  const saludo = hour < 12 ? `¡Buenos días, ${name}!` : hour < 19 ? `¡Epa, ${name}!` : `¡Buenas noches, ${name}!`;

  panel.replaceChildren(
    h(
      'div',
      { class: 'panel-body' },
      h('div', { class: 'hello' }, h('h1', null, `${saludo} 👋`), h('p', null, '¿Con quién trabajamos hoy? Toca una oficina o un agente.')),
      checklist(),
      h('div', { class: 'section-title' }, 'Tu equipo'),
      cards,
      h(
        'button',
        { class: 'meeting-cta', type: 'button', onClick: () => go('#/juntas') },
        h('span', { class: 'big' }, '🤝'),
        h(
          'span',
          null,
          h('strong', null, runtime.meetingBusy ? 'Reunión en curso' : 'Convocar a la sala de juntas'),
          h('span', null, 'Lluvia de ideas con los tres, con investigación web de lo último en contenido.')
        )
      ),
      meetings.length
        ? h(
            'div',
            null,
            h('div', { class: 'section-title' }, 'Reuniones recientes'),
            h(
              'ul',
              { class: 'list-plain' },
              meetings.map((m) =>
                h(
                  'li',
                  null,
                  h(
                    'button',
                    { class: 'list-row', type: 'button', onClick: () => go(`#/juntas/${m.id}`) },
                    h('span', null, m.plan ? '📋' : '💬'),
                    h('span', { class: 'grow' }, h('strong', null, m.topic), h('small', null, fmtDate(m.createdAt.slice(0, 10), { day: '2-digit', month: 'short' })))
                  )
                )
              )
            )
          )
        : null,
      h(
        'p',
        { class: 'hint mt-5' },
        '💾 Todo se guarda solo en este navegador. Descarga un respaldo de vez en cuando en Configuración → Datos.'
      )
    )
  );
  return on('status', renderCards);
}
