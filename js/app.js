// Punto de entrada: monta la oficina, el dock y enruta el panel lateral según la URL (#/...).

import { h, toast } from './ui.js';
import * as store from './store.js';
import { AGENT_IDS } from './store.js';
import { runtime, on, go, STATUS_LABEL } from './state.js';
import { mountOffice, setActiveRoom, avatarSvg, bossGoTo, bossPlace, visit, catRelease } from './office.js';
import { catHeadSvg } from './cat-sprite.js';
import { renderCatPanel, recoverCatChat } from './cat-chat.js';
import { renderHome } from './home.js';
import { renderAgentPanel } from './chat.js';
import { renderMeetingPanel, recoverMeetings } from './meeting.js';
import { renderSettings } from './settings.js';
import { renderFavs } from './favs.js';
import { renderCalendar } from './calendar-view.js';
import { recoverChats } from './conversation.js';

const panel = document.getElementById('panel');
const dock = document.getElementById('dock');
let cleanup = null;
let currentKey = '';
let firstRoute = true;
let prevType = 'home';

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'agente' && AGENT_IDS.includes(parts[1])) return { type: 'agent', id: parts[1], tab: parts[2] === 'metricas' ? 'metricas' : 'chat' };
  if (parts[0] === 'juntas') return { type: 'meeting', id: parts[1] };
  if (parts[0] === 'gato') return { type: 'cat' };
  if (parts[0] === 'favoritos') return { type: 'favs' };
  if (parts[0] === 'fechas') return { type: 'fechas' };
  if (parts[0] === 'config') return { type: 'settings', tab: parts[1] || 'claves' };
  return { type: 'home' };
}

// Palabra de estado para lectores de pantalla ("pensando", "buscando en la web"), solo si hay trabajo en curso.
const busyWord = (st) => (STATUS_LABEL[st] || '').replace(/…$/, '').toLowerCase();

/** Describe cada botón del dock según la vista y el estado real (agentes, gato, sala de juntas). */
function dockItems(view) {
  const agents = store.agents();
  const active = view.type === 'agent' ? view.id : view.type === 'meeting' ? 'juntas' : null;
  const items = AGENT_IDS.map((id) => {
    const st = runtime.status[id];
    const busy = st !== 'idle' && st !== 'meeting';
    return { active: active === id, busy, label: `Ir a la oficina de ${agents[id].name}${busy ? `, ${busyWord(st)}` : ''}` };
  });
  const catBusy = runtime.catStatus === 'thinking';
  items.push({ active: view.type === 'cat', busy: catBusy, label: `Hablar con tu gato asistente${catBusy ? ', pensando' : ''}` });
  items.push({ active: active === 'juntas', busy: runtime.meetingBusy, label: runtime.meetingBusy ? 'Sala de juntas, reunión en curso' : null });
  return items;
}

function renderDock(view, { force = false } = {}) {
  const agents = store.agents();
  const items = dockItems(view);
  const focusIdx = dock.contains(document.activeElement) ? [...dock.children].indexOf(document.activeElement) : -1;

  // Con el teclado dentro del dock no se reconstruye: se actualizan los mismos botones y se conserva el foco.
  if (focusIdx >= 0 && !force && dock.children.length === items.length) {
    items.forEach((it, i) => {
      const btn = dock.children[i];
      btn.classList.toggle('is-active', it.active);
      btn.querySelector('.status-dot')?.classList.toggle('is-busy', it.busy);
      if (it.label) btn.setAttribute('aria-label', it.label);
      else btn.removeAttribute('aria-label');
    });
    return;
  }

  const ariaOf = (it) => (it.label ? { 'aria-label': it.label } : null);
  dock.replaceChildren(
    ...AGENT_IDS.map((id, i) => {
      const it = items[i];
      return h(
        'button',
        { class: `dock-btn${it.active ? ' is-active' : ''}`, type: 'button', onClick: () => visit(id), ...ariaOf(it) },
        avatarSvg(agents[id].look),
        agents[id].name,
        h('span', { class: `status-dot${it.busy ? ' is-busy' : ''}`, 'aria-hidden': 'true' })
      );
    }),
    h(
      'button',
      { class: `dock-btn${items[AGENT_IDS.length].active ? ' is-active' : ''}`, type: 'button', onClick: () => visit('cat'), ...ariaOf(items[AGENT_IDS.length]) },
      catHeadSvg(),
      store.cat().name || 'Tu gato',
      h('span', { class: `status-dot${items[AGENT_IDS.length].busy ? ' is-busy' : ''}`, 'aria-hidden': 'true' })
    ),
    h(
      'button',
      { class: `dock-btn${items[AGENT_IDS.length + 1].active ? ' is-active' : ''}`, type: 'button', onClick: () => visit('juntas'), ...ariaOf(items[AGENT_IDS.length + 1]) },
      h('span', { class: 'dock-icon', 'aria-hidden': 'true' }, '🤝'),
      'Sala de juntas',
      h('span', { class: `status-dot${items[AGENT_IDS.length + 1].busy ? ' is-busy' : ''}`, 'aria-hidden': 'true' })
    )
  );
  if (focusIdx >= 0) dock.children[focusIdx]?.focus({ preventScroll: true });
}

// Región oculta para lectores de pantalla: anuncia solo transiciones reales de estado de los agentes.
const live = h('div', { class: 'sr-only', id: 'sr-live', role: 'status', 'aria-live': 'polite' });
const prevStatus = Object.fromEntries(AGENT_IDS.map((id) => [id, runtime.status[id]]));

function announce(text) {
  const line = h('p', null, text);
  live.append(line);
  while (live.children.length > 4) live.firstChild.remove();
  setTimeout(() => line.remove(), 8000);
}

function announceStatus({ id, status }) {
  const before = prevStatus[id];
  prevStatus[id] = status;
  const name = store.agents()[id]?.name;
  if (!name || before === status) return;
  if (status === 'thinking') {
    if (before !== 'searching') announce(`${name} está pensando…`);
  } else if (status === 'searching') announce(`${name} está buscando en la web…`);
  else if ((before === 'thinking' || before === 'searching') && (status === 'idle' || status === 'meeting')) {
    const last = store.chat(id).at(-1);
    const failed = status === 'idle' && (!last || last.role !== 'model' || last.error || !last.text);
    announce(failed ? `${name} no pudo responder.` : `${name} terminó.`);
  }
}

function route() {
  const view = parseRoute();
  const key = JSON.stringify(view);
  renderDock(view);
  setActiveRoom(view.type === 'agent' ? view.id : view.type === 'meeting' ? 'juntas' : null);
  if (key === currentKey) return;
  currentKey = key;

  // El avatar del jefe va hasta el agente o la sala (al abrir la app, aparece directo ahí).
  const where = view.type === 'agent' ? view.id : view.type === 'meeting' ? 'meeting' : view.type === 'cat' ? 'cat' : null;
  if (where) firstRoute ? bossPlace(where) : bossGoTo(where);
  firstRoute = false;
  if (prevType === 'cat' && view.type !== 'cat') catRelease();
  prevType = view.type;
  cleanup?.();
  cleanup = null;

  const sheet = view.type !== 'home';
  panel.classList.toggle('is-sheet', sheet);
  document.body.classList.toggle('sheet-open', sheet && window.matchMedia('(max-width: 900px)').matches);

  if (view.type === 'agent') cleanup = renderAgentPanel(panel, view.id, view.tab);
  else if (view.type === 'meeting') cleanup = renderMeetingPanel(panel, view.id);
  else if (view.type === 'cat') cleanup = renderCatPanel(panel);
  else if (view.type === 'settings') cleanup = renderSettings(panel, view.tab);
  else if (view.type === 'favs') cleanup = renderFavs(panel);
  else if (view.type === 'fechas') cleanup = renderCalendar(panel);
  else cleanup = renderHome(panel);

  if (!sheet && window.matchMedia('(max-width: 900px)').matches) window.scrollTo({ top: 0 });
}

function start() {
  recoverChats();
  recoverCatChat();
  recoverMeetings();
  mountOffice(document.getElementById('office'));
  window.addEventListener('hashchange', route);
  on('route', () => {
    currentKey = '';
    route();
  });
  document.body.append(live);
  on('status', (d) => {
    renderDock(parseRoute());
    announceStatus(d);
  });
  on('meeting', () => renderDock(parseRoute()));
  on('cat-status', () => renderDock(parseRoute()));
  on('agents-changed', () => {
    renderDock(parseRoute(), { force: true });
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
