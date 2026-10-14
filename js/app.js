// Punto de entrada: monta la oficina, el dock y enruta el panel lateral según la URL (#/...).

import { h, toast } from './ui.js';
import * as store from './store.js';
import { AGENT_IDS } from './store.js';
import { runtime, on, go } from './state.js';
import { mountOffice, setActiveRoom, avatarSvg, bossGoTo, bossPlace, visit } from './office.js';
import { renderHome } from './home.js';
import { renderAgentPanel } from './chat.js';
import { renderMeetingPanel, recoverMeetings } from './meeting.js';
import { renderSettings } from './settings.js';
import { recoverChats } from './conversation.js';

const panel = document.getElementById('panel');
const dock = document.getElementById('dock');
let cleanup = null;
let currentKey = '';
let firstRoute = true;

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'agente' && AGENT_IDS.includes(parts[1])) return { type: 'agent', id: parts[1], tab: parts[2] === 'metricas' ? 'metricas' : 'chat' };
  if (parts[0] === 'juntas') return { type: 'meeting', id: parts[1] };
  if (parts[0] === 'config') return { type: 'settings', tab: parts[1] || 'claves' };
  return { type: 'home' };
}

function renderDock(view) {
  const agents = store.agents();
  const active = view.type === 'agent' ? view.id : view.type === 'meeting' ? 'juntas' : null;
  dock.replaceChildren(
    ...AGENT_IDS.map((id) => {
      const st = runtime.status[id];
      const busy = st !== 'idle' && st !== 'meeting';
      return h(
        'button',
        { class: `dock-btn${active === id ? ' is-active' : ''}`, type: 'button', onClick: () => visit(id), 'aria-label': `Ir a la oficina de ${agents[id].name}` },
        avatarSvg(agents[id].look),
        agents[id].name,
        h('span', { class: `status-dot${busy ? ' is-busy' : ''}`, 'aria-hidden': 'true' })
      );
    }),
    h(
      'button',
      { class: `dock-btn${active === 'juntas' ? ' is-active' : ''}`, type: 'button', onClick: () => visit('juntas') },
      h('span', { class: 'dock-icon', 'aria-hidden': 'true' }, '🤝'),
      'Sala de juntas',
      h('span', { class: `status-dot${runtime.meetingBusy ? ' is-busy' : ''}`, 'aria-hidden': 'true' })
    )
  );
}

function route() {
  const view = parseRoute();
  const key = JSON.stringify(view);
  renderDock(view);
  setActiveRoom(view.type === 'agent' ? view.id : view.type === 'meeting' ? 'juntas' : null);
  if (key === currentKey) return;
  currentKey = key;

  // El avatar del jefe va hasta el agente o la sala (al abrir la app, aparece directo ahí).
  const where = view.type === 'agent' ? view.id : view.type === 'meeting' ? 'meeting' : null;
  if (where) firstRoute ? bossPlace(where) : bossGoTo(where);
  firstRoute = false;
  cleanup?.();
  cleanup = null;

  const sheet = view.type !== 'home';
  panel.classList.toggle('is-sheet', sheet);
  document.body.classList.toggle('sheet-open', sheet && window.matchMedia('(max-width: 900px)').matches);

  if (view.type === 'agent') cleanup = renderAgentPanel(panel, view.id, view.tab);
  else if (view.type === 'meeting') cleanup = renderMeetingPanel(panel, view.id);
  else if (view.type === 'settings') cleanup = renderSettings(panel, view.tab);
  else cleanup = renderHome(panel);

  if (!sheet && window.matchMedia('(max-width: 900px)').matches) window.scrollTo({ top: 0 });
}

function start() {
  recoverChats();
  recoverMeetings();
  mountOffice(document.getElementById('office'));
  window.addEventListener('hashchange', route);
  on('route', () => {
    currentKey = '';
    route();
  });
  on('status', () => renderDock(parseRoute()));
  on('meeting', () => renderDock(parseRoute()));
  on('agents-changed', () => {
    renderDock(parseRoute());
    const view = parseRoute();
    if (view.type !== 'settings') {
      currentKey = '';
      route();
    }
  });
  window.addEventListener('vaof:storage-full', () =>
    toast('El navegador se quedó sin espacio. Descarga un respaldo y borra conversaciones viejas en Configuración → Datos.', 'error', 9000)
  );
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && parseRoute().type !== 'home' && !document.querySelector('dialog[open]')) go('#/');
  });
  route();

  if (!store.settings().geminiKey && !location.hash) {
    toast('¡Bienvenido! Empieza pegando tu API key de Gemini en Configuración.', 'info', 6000);
  }
}

start();
