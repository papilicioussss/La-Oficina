// Biblioteca de favoritos: copys, hooks, guiones y análisis que Kike guarda desde el chat, con etiquetas y búsqueda.

import { h, toast, copyText, openModal, confirmDialog, uid } from './ui.js';
import * as store from './store.js';
import { AGENT_IDS } from './store.js';
import { runtime, go } from './state.js';
import { norm } from './skills.js';

export const FAV_TYPES = {
  copy: { icon: '✍️', label: 'Copy' },
  hook: { icon: '🎣', label: 'Hook' },
  guion: { icon: '🎬', label: 'Guion' },
  analisis: { icon: '📊', label: 'Análisis' },
  otro: { icon: '📌', label: 'Otro' },
};

const TYPE_OF_AGENT = { copy: 'copy', guion: 'guion', analista: 'analisis' };

export const favs = () => store.get('favs');

function persist() {
  store.save('favs');
}

export function cleanTags(raw) {
  const list = Array.isArray(raw) ? raw : String(raw || '').split(/[,\n]/);
  const seen = new Set();
  return list
    .map((t) => t.trim().replace(/^#+/, '').trim().toLowerCase())
    .filter((t) => t && !seen.has(t) && seen.add(t))
    .slice(0, 8);
}

/** Primera línea útil del texto, sin símbolos de Markdown, como título sugerido. */
export function guessTitle(text) {
  const line = String(text || '')
    .split('\n')
    .map((l) => l.replace(/^[#>*\-\s\d.)|]+/, '').replace(/[*_`|]/g, '').trim())
    .find((l) => l.length > 3);
  return (line || 'Sin título').slice(0, 70);
}

export function addFav({ title, text, type, tags, agentId }) {
  const fav = { id: uid(), title: title.trim() || guessTitle(text), text: text.trim(), type: FAV_TYPES[type] ? type : 'otro', tags: cleanTags(tags), agentId: agentId || null, createdAt: new Date().toISOString() };
  favs().unshift(fav);
  persist();
  return fav;
}

export function updateFav(id, patch) {
  const f = favs().find((x) => x.id === id);
  if (!f) return;
  Object.assign(f, patch, patch.tags ? { tags: cleanTags(patch.tags) } : {});
  persist();
}

export function removeFav(id) {
  const i = favs().findIndex((x) => x.id === id);
  if (i >= 0) favs().splice(i, 1);
  persist();
}

/** Ventana para guardar/editar un favorito. Con `fav` edita; si no, crea uno nuevo con los datos de partida. */
export function favModal({ fav, text = '', agentId = null, onSaved }) {
  const type = h('select', null, Object.entries(FAV_TYPES).map(([k, v]) => h('option', { value: k, selected: k === (fav?.type || TYPE_OF_AGENT[agentId] || 'otro') }, `${v.icon} ${v.label}`)));
  const title = h('input', { type: 'text', maxlength: 80, value: fav?.title || guessTitle(text), 'aria-label': 'Título' });
  const body = h('textarea', { rows: 8, 'aria-label': 'Texto' });
  body.value = fav?.text || text;
  const tags = h('input', { type: 'text', value: (fav?.tags || []).join(', '), placeholder: 'ej: morrocoy, reel, urgencia', 'aria-label': 'Etiquetas' });
  const existing = [...new Set(favs().flatMap((f) => f.tags))].slice(0, 12);
  const suggest = existing.length
    ? h(
        'div',
        { class: 'chips mt-2' },
        existing.map((t) =>
          h(
            'button',
            {
              class: 'chip',
              type: 'button',
              onClick: () => {
                const cur = cleanTags(tags.value);
                if (!cur.includes(t)) tags.value = [...cur, t].join(', ');
              },
            },
            `#${t}`
          )
        )
      )
    : null;
  openModal({
    title: fav ? '✏️ Editar favorito' : '⭐ Guardar en favoritos',
    wide: true,
    body: h(
      'div',
      null,
      h('div', { class: 'field' }, h('label', null, 'Título'), title),
      h('div', { class: 'field' }, h('label', null, 'Tipo'), type),
      h('div', { class: 'field' }, h('label', null, 'Texto (recorta lo que no quieras guardar)'), body),
      h('div', { class: 'field m-0' }, h('label', null, 'Etiquetas (separadas por coma)'), tags, suggest)
    ),
    actions: [
      {
        label: fav ? 'Guardar cambios' : '⭐ Guardar',
        kind: 'primary',
        onClick: (close) => {
          if (!body.value.trim()) {
            toast('El texto no puede quedar vacío.', 'warn', 2500);
            return;
          }
          if (fav) updateFav(fav.id, { title: title.value.trim() || guessTitle(body.value), text: body.value.trim(), type: type.value, tags: tags.value });
          else addFav({ title: title.value, text: body.value, type: type.value, tags: tags.value, agentId });
          close();
          toast(fav ? 'Cambios guardados.' : 'Guardado en ⭐ Favoritos.', 'info', 2500);
          onSaved?.();
        },
      },
    ],
  });
}

function favCard(f, refresh) {
  const t = FAV_TYPES[f.type] || FAV_TYPES.otro;
  const agents = store.agents();
  const body = h('div', { class: 'fav-text' }, f.text);
  const long = f.text.length > 260;
  let open = !long;
  const toggle = long
    ? h('button', { class: 'link-btn', type: 'button', onClick: () => {
        open = !open;
        body.classList.toggle('is-clamped', !open);
        toggle.textContent = open ? 'Ver menos' : 'Ver todo';
      } }, 'Ver todo')
    : null;
  if (long) body.classList.add('is-clamped');
  return h(
    'article',
    { class: 'fav-card', 'data-fav': f.id },
    h(
      'header',
      { class: 'fav-head' },
      h('strong', null, `${t.icon} ${f.title}`),
      h('small', null, `${t.label}${f.agentId && agents[f.agentId] ? ` · de ${agents[f.agentId].name}` : ''}`)
    ),
    body,
    toggle,
    f.tags.length ? h('div', { class: 'chips' }, f.tags.map((tg) => h('span', { class: 'tag' }, `#${tg}`))) : null,
    h(
      'div',
      { class: 'msg-actions' },
      h('button', { class: 'chip', type: 'button', onClick: () => copyText(f.text) }, '📋 Copiar'),
      AGENT_IDS.map((id) =>
        h(
          'button',
          {
            class: 'chip',
            type: 'button',
            title: `Mandárselo a ${agents[id].name} para trabajarlo`,
            onClick: () => {
              runtime.drafts[id] = `Trabajemos sobre este material mío:\n\n${f.text}\n\n`;
              go(`#/agente/${id}`);
            },
          },
          `➡️ ${agents[id].name}`
        )
      ),
      h('button', { class: 'chip', type: 'button', onClick: () => favModal({ fav: f, onSaved: refresh }) }, '✏️ Editar'),
      h(
        'button',
        {
          class: 'chip',
          type: 'button',
          onClick: async () => {
            if (await confirmDialog(`¿Borrar "${f.title}" de favoritos?`, { okLabel: 'Borrar', danger: true })) {
              removeFav(f.id);
              refresh();
            }
          },
        },
        '🗑'
      )
    )
  );
}

export function renderFavs(panel) {
  let q = '';
  let type = 'todos';
  let tag = '';
  const list = h('div', { class: 'fav-list' });
  const filters = h('div', { class: 'chips' });
  const search = h('input', { type: 'search', placeholder: 'Buscar por texto, título o etiqueta…', 'aria-label': 'Buscar en favoritos', onInput: (e) => { q = e.target.value; renderList(); } });

  const match = (f) => {
    if (type !== 'todos' && f.type !== type) return false;
    if (tag && !f.tags.includes(tag)) return false;
    if (!q.trim()) return true;
    const hay = norm(`${f.title} ${f.text} ${f.tags.join(' ')}`);
    return norm(q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
  };

  function renderFilters() {
    const all = favs();
    const types = Object.entries(FAV_TYPES).filter(([k]) => all.some((f) => f.type === k));
    const tags = [...new Set(all.flatMap((f) => f.tags))].sort();
    const chip = (label, on, fn) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(on), onClick: fn }, label);
    const act = (fn) => () => {
      fn();
      renderAll();
    };
    filters.replaceChildren(
      chip(`Todos (${all.length})`, type === 'todos' && !tag, act(() => { type = 'todos'; tag = ''; })),
      ...types.map(([k, v]) => chip(`${v.icon} ${v.label}`, type === k, act(() => { type = type === k ? 'todos' : k; }))),
      ...tags.map((tg) => chip(`#${tg}`, tag === tg, act(() => { tag = tag === tg ? '' : tg; })))
    );
  }

  function renderList() {
    const shown = favs().filter(match);
    list.replaceChildren(
      ...(shown.length
        ? shown.map((f) => favCard(f, renderAll))
        : [
            h(
              'p',
              { class: 'note' },
              favs().length
                ? 'No hay favoritos con ese filtro.'
                : '⭐ Aquí vivirán tus mejores copys, hooks y guiones. Cuando una respuesta te guste, toca "⭐ Guardar" debajo del mensaje y le pones etiquetas para encontrarla rápido.'
            ),
          ])
    );
  }

  function renderAll() {
    renderFilters();
    renderList();
  }
  renderAll();

  panel.replaceChildren(
    h(
      'header',
      { class: 'panel-head' },
      h('button', { class: 'icon-btn back-btn only-sheet', type: 'button', 'aria-label': 'Volver a la oficina', onClick: () => go('#/') }, '←'),
      h('span', { class: 'avatar avatar-icon' }, '⭐'),
      h('div', { class: 'panel-title' }, h('strong', null, 'Favoritos'), h('span', null, 'Tus mejores copys, hooks y guiones'))
    ),
    h(
      'div',
      { class: 'panel-body' },
      h('div', { class: 'field' }, search),
      filters,
      h('div', { class: 'mt-4' }, list),
      h('p', { class: 'hint mt-5' }, 'Se guardan solo en este navegador y van en el respaldo de Configuración → Datos.')
    )
  );
  return () => {};
}
