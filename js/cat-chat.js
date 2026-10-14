// Panel del gato: nombrarlo la primera vez, conversar y ver/deshacer lo que guarda en la memoria.

import { h, toast, uid, fileToImagePart, isTouch, confirmDialog, copyText } from './ui.js';
import * as store from './store.js';
import { runtime, on, emit, go } from './state.js';
import { runCat, undoSaved } from './cat-brain.js';
import { md, toPlain } from './markdown.js';
import { catHeadSvg } from './cat-sprite.js';
import { bossName, agentName } from './prompts.js';
import { facts, catLabel, gaps } from './memory.js';
import { SetupError } from './brain.js';
import { tierBadge } from './chat.js';

const NAME_IDEAS = ['Mango', 'Arepa', 'Michi', 'Canelo', 'Miel', 'Limón', 'Papelón', 'Naranjo'];
const MAX_IMAGES = 3;
const chat = () => store.get('chat:gato');
const catName = () => store.cat().name || 'tu gato';

function setCatStatus(status) {
  runtime.catStatus = status;
  emit('cat-status', { status });
}

/** Al abrir la app: respuestas que quedaron a medias pasan a error. */
export function recoverCatChat() {
  let changed = false;
  for (const m of chat()) {
    if (m.pending) {
      m.pending = false;
      if (!m.text) m.error = 'Se interrumpió (se recargó la página). Intenta de nuevo.';
      changed = true;
    }
  }
  if (changed) store.save('chat:gato');
}

// ---------- Mensajes ----------

function welcomeText(name) {
  const g = gaps()[0];
  const first = g
    ? `Para empezar: cuéntame ${g.ask}. Puedes escribírmelo todo de una vez, como te salga, y yo lo ordeno. 🐾`
    : 'Ya tengo bastante anotado. Cuéntame qué hay de nuevo.';
  return `*ronronea* ¡${name}! Me gusta, me queda perfecto. 😺\n\nSoy tu gato asistente, ${bossName()}: me encargo de la memoria de la marca. Lo que me cuentes (precios, destinos, cómo se ve la marca en redes, quién te compra) lo guardo, y ${agentName('copy')}, ${agentName('analista')} y ${agentName('guion')} lo usan para trabajar con datos reales y no inventar.\n\n${first}`;
}

function savedChips(m) {
  if (!m.saved?.length) return null;
  const wrap = h('div', { class: 'saved-list' });
  for (const item of m.saved) {
    const c = catLabel(item.cat);
    const label = item.op === 'remove' ? 'Olvidé' : item.op === 'update' ? 'Actualicé' : 'Guardé';
    wrap.append(
      h(
        'div',
        { class: `saved-chip${item.undone ? ' is-undone' : ''}` },
        h('span', { class: 'saved-icon' }, '🧠'),
        h('span', { class: 'saved-text' }, h('strong', null, `${label} en ${c.label}: `), item.text),
        item.undone
          ? h('small', null, 'deshecho')
          : h(
              'button',
              {
                class: 'link-btn',
                type: 'button',
                onClick: () => {
                  undoSaved(item);
                  item.undone = true;
                  store.save('chat:gato');
                  emit('cat-chat', { type: 'update', id: m.id });
                },
              },
              'Deshacer'
            )
      )
    );
  }
  return wrap;
}

function msgEl(m) {
  if (m.role === 'user') {
    return h(
      'div',
      { class: 'msg msg-user', 'data-id': m.id },
      m.text,
      m.images ? h('div', { class: 'msg-images' }, `📷 ${m.images} imagen${m.images > 1 ? 'es' : ''}`) : null
    );
  }
  const el = h('div', { class: `msg msg-model msg-cat${m.error ? ' msg-error' : ''}`, 'data-id': m.id });
  el.append(
    h(
      'div',
      { class: 'msg-head' },
      catHeadSvg(),
      catName(),
      m.via === 'groq' ? h('span', { class: 'via-badge', title: m.tier === 'light' ? 'Mensaje simple: respondió Groq (rápido)' : 'Gemini llegó al límite: respondió Groq' }, '⚡ Groq') : null,
      tierBadge(m)
    )
  );
  if (m.text) el.append(h('div', { class: 'md', html: md(m.text) }));
  else if (m.pending) el.append(h('div', { class: 'typing' }, h('i'), h('i'), h('i')));
  if (m.error) {
    el.append(
      h('p', null, '⚠️ ', m.error),
      h(
        'div',
        { class: 'msg-actions' },
        m.setup
          ? h('button', { class: 'chip', type: 'button', onClick: () => go('#/config/claves') }, '⚙️ Ir a Configuración')
          : h('button', { class: 'chip', type: 'button', onClick: () => retryCat(m.id) }, '🔄 Reintentar')
      )
    );
  }
  if (!m.pending) {
    const chips = savedChips(m);
    if (chips) el.append(chips);
    if (m.text && !m.error) el.append(h('div', { class: 'msg-actions' }, h('button', { class: 'chip', type: 'button', onClick: () => copyText(toPlain(m.text)) }, '📋 Copiar')));
  }
  return el;
}

// ---------- Envío ----------

export const isCatBusy = () => !!runtime.aborters.gato;

export async function sendToCat(text, images = []) {
  if (isCatBusy()) {
    toast('Espera que termine de responder (o detén la respuesta).', 'warn');
    return;
  }
  const list = chat();
  const history = list.slice();
  const reply = { id: uid(), role: 'model', text: '', pending: true, ts: Date.now(), saved: [] };
  list.push({ id: uid(), role: 'user', text, images: images.length, ts: Date.now() }, reply);
  if (list.length > 100) list.splice(0, list.length - 100);
  store.save('chat:gato');
  emit('cat-chat', { type: 'append' });

  const ctrl = new AbortController();
  runtime.aborters.gato = ctrl;
  setCatStatus('thinking');
  const update = () => emit('cat-chat', { type: 'update', id: reply.id });
  try {
    const res = await runCat({
      history,
      text,
      images,
      signal: ctrl.signal,
      onText: (t) => {
        reply.text = t;
        update();
      },
    });
    reply.text = res.text;
    reply.saved = res.saved;
    reply.via = res.via;
    reply.tier = res.tier;
    reply.model = res.model;
    reply.modelLabel = res.modelLabel;
    if (!reply.text.trim()) {
      if (res.saved.length) reply.text = '¡Anotado! 🐾';
      else reply.error = 'No me salió respuesta. Intenta de nuevo.';
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      if (!reply.text) reply.error = 'Me detuviste a mitad de maullido.';
    } else {
      reply.error = e.message || 'Algo falló.';
      if (e instanceof SetupError) reply.setup = true;
    }
  } finally {
    reply.pending = false;
    delete runtime.aborters.gato;
    setCatStatus('idle');
    store.save('chat:gato');
    emit('cat-chat', { type: 'done', id: reply.id });
  }
}

/** Reintenta el mensaje que falló. */
export function retryCat(replyId) {
  const list = chat();
  const i = list.findIndex((m) => m.id === replyId);
  if (i < 1 || list[i - 1].role !== 'user') return;
  const userMsg = list[i - 1];
  if (userMsg.images) toast('Las fotos no se guardan: si hacían falta, adjúntalas de nuevo.', 'info');
  list.splice(i - 1, 2);
  store.save('chat:gato');
  sendToCat(userMsg.text);
}

// ---------- Vistas ----------

function nameCard(panel) {
  const input = h('input', { type: 'text', maxlength: 18, placeholder: 'Ej.: Mango', 'aria-label': 'Nombre del gato' });
  const save = () => {
    const name = input.value.trim();
    if (!name) {
      toast('Ponle un nombre a tu gato.', 'warn');
      input.focus();
      return;
    }
    const c = store.cat();
    c.name = name.slice(0, 18);
    c.named = true;
    store.save('cat');
    chat().push({ id: uid(), role: 'model', text: welcomeText(c.name), ts: Date.now(), local: true, saved: [] });
    store.save('chat:gato');
    emit('agents-changed');
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && save());
  panel.replaceChildren(
    h(
      'header',
      { class: 'panel-head' },
      h('button', { class: 'icon-btn back-btn only-sheet', type: 'button', 'aria-label': 'Volver a la oficina', onClick: () => go('#/') }, '←'),
      catHeadSvg(),
      h('div', { class: 'panel-title' }, h('strong', null, 'Tu gato asistente'), h('span', null, 'Mascota y memoria de la marca'))
    ),
    h(
      'div',
      { class: 'panel-body cat-name-card' },
      h('div', { class: 'cat-name-art' }, catHeadSvg('avatar-xl')),
      h('h2', null, '¡Miau! 😺'),
      h(
        'p',
        null,
        `Soy tu gato asistente y la mascota de la oficina. Voy a guardar todo lo que me cuentes de la marca (precios, destinos, tu público…) para que ${agentName('copy')}, ${agentName('analista')} y ${agentName('guion')} trabajen con datos reales. Pero primero… ¿cómo quieres llamarme?`
      ),
      h('div', { class: 'field' }, h('label', null, 'Nombre de tu gato'), h('div', { class: 'key-row' }, input, h('button', { class: 'btn btn-primary', type: 'button', onClick: save }, 'Listo'))),
      h(
        'div',
        { class: 'chips', style: { justifyContent: 'center' } },
        NAME_IDEAS.map((n) =>
          h(
            'button',
            {
              class: 'chip',
              type: 'button',
              onClick: () => {
                input.value = n;
                input.focus();
              },
            },
            n
          )
        )
      ),
      h('p', { class: 'hint' }, 'Lo puedes cambiar cuando quieras en Configuración → Equipo.')
    )
  );
  setTimeout(() => !isTouch() && input.focus(), 60);
  return null;
}

function quickChips() {
  const g = gaps()[0];
  const chips = [];
  if (g) chips.push(`Pregúntame lo que te falte`);
  else chips.push('¿Qué más te falta saber?');
  chips.push('¿Qué sabes de mi marca?', 'Te voy a pasar mis precios', 'Hoy cambió algo, anótalo', 'Te cuento cómo es mi público');
  return chips;
}

function chatView(panel) {
  const name = catName();
  const total = facts().length;
  const sub = h('span', null, `🧠 ${total} dato${total === 1 ? '' : 's'} en memoria`);
  const list = h('div', { class: 'messages', role: 'log', 'aria-label': `Conversación con ${name}` });
  let images = [];
  const nearBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 120;
  const toBottom = () => (list.scrollTop = list.scrollHeight);
  const renderAll = () => {
    const msgs = chat();
    list.replaceChildren(...msgs.map(msgEl));
    if (!msgs.length) list.append(msgEl({ id: 'hi', role: 'model', text: welcomeText(name) }));
    toBottom();
  };

  const pending = new Set();
  let raf = 0;
  const flush = () => {
    raf = 0;
    const stick = nearBottom();
    for (const id of pending) {
      const m = chat().find((x) => x.id === id);
      const old = list.querySelector(`[data-id="${CSS.escape(id)}"]`);
      if (m && old) old.replaceWith(msgEl(m));
    }
    pending.clear();
    if (stick) toBottom();
  };

  const textarea = h('textarea', { rows: 1, placeholder: `Cuéntale algo a ${name}…`, 'aria-label': `Mensaje para ${name}` });
  const autoGrow = () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight + 2, 180) + 'px';
  };
  textarea.addEventListener('input', () => {
    runtime.drafts.gato = textarea.value;
    autoGrow();
  });
  textarea.value = runtime.drafts.gato || '';
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isTouch()) {
      e.preventDefault();
      submit();
    }
  });

  const attachments = h('div', { class: 'attachments' });
  const renderAttachments = () => {
    attachments.replaceChildren(
      ...images.map((img, i) =>
        h(
          'div',
          { class: 'thumb' },
          h('img', { src: img.preview, alt: img.name || 'Imagen adjunta' }),
          h('button', { type: 'button', 'aria-label': 'Quitar imagen', onClick: () => (images.splice(i, 1), renderAttachments()) }, '✕')
        )
      )
    );
    attachments.hidden = !images.length;
  };
  const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
  fileInput.addEventListener('change', async () => {
    for (const f of [...fileInput.files].slice(0, MAX_IMAGES - images.length)) {
      try {
        images.push(await fileToImagePart(f));
      } catch (e) {
        toast(e.message, 'error');
      }
    }
    fileInput.value = '';
    renderAttachments();
  });

  const sendBtn = h('button', { class: 'btn btn-primary btn-sm', type: 'submit' });
  const renderSend = () => {
    const busy = isCatBusy();
    sendBtn.textContent = busy ? '■ Detener' : 'Enviar ➤';
    sendBtn.classList.toggle('btn-danger', busy);
    sendBtn.classList.toggle('btn-primary', !busy);
  };
  const submit = () => {
    if (isCatBusy()) {
      runtime.aborters.gato?.abort();
      return;
    }
    const text = textarea.value.trim();
    if (!text && !images.length) {
      textarea.focus();
      return;
    }
    const imgs = images;
    images = [];
    renderAttachments();
    textarea.value = '';
    runtime.drafts.gato = '';
    autoGrow();
    sendToCat(text, imgs);
  };

  const quick = h(
    'div',
    { class: 'quick', role: 'list' },
    quickChips().map((q) =>
      h(
        'button',
        {
          class: 'chip',
          type: 'button',
          role: 'listitem',
          onClick: () => {
            // Los que ya son una petición completa se envían; los que piden completar se llenan.
            if (/^(Pregúntame|¿Qué )/.test(q)) sendToCat(q);
            else {
              textarea.value = q + ': ';
              runtime.drafts.gato = textarea.value;
              autoGrow();
              textarea.focus();
            }
          },
        },
        q
      )
    )
  );

  const form = h(
    'form',
    {
      class: 'composer',
      onSubmit: (e) => {
        e.preventDefault();
        submit();
      },
    },
    attachments,
    textarea,
    h(
      'div',
      { class: 'composer-row' },
      h('button', { class: 'chip', type: 'button', title: 'Mándale la foto de una lista de precios, un afiche o una captura', onClick: () => fileInput.click() }, '📎 Foto'),
      fileInput,
      h('span', { class: 'spacer' }),
      sendBtn
    )
  );

  panel.replaceChildren(
    h(
      'header',
      { class: 'panel-head' },
      h('button', { class: 'icon-btn back-btn only-sheet', type: 'button', 'aria-label': 'Volver a la oficina', onClick: () => go('#/') }, '←'),
      catHeadSvg(),
      h('div', { class: 'panel-title' }, h('strong', null, `🐱 ${name}`), sub),
      h('button', { class: 'icon-btn', type: 'button', title: 'Ver y editar lo que sé de la marca', 'aria-label': 'Ver memoria', onClick: () => go('#/config/memoria') }, '🧠'),
      h(
        'button',
        {
          class: 'icon-btn',
          type: 'button',
          title: 'Empezar la conversación de nuevo (la memoria no se borra)',
          'aria-label': 'Limpiar conversación',
          onClick: async () => {
            if (!chat().length) return;
            if (await confirmDialog(`¿Borrar la conversación con ${name}? Lo que ya guardó en la memoria se queda.`, { okLabel: 'Sí, borrar', danger: true })) {
              runtime.aborters.gato?.abort();
              store.set('chat:gato', []);
              renderAll();
            }
          },
        },
        '🧹'
      )
    ),
    h('div', { class: 'chat' }, list, quick, form)
  );
  renderAll();
  renderAttachments();
  renderSend();
  requestAnimationFrame(autoGrow);
  setTimeout(() => !isTouch() && textarea.focus(), 60);

  const offs = [
    on('cat-chat', (d) => {
      if (d.type === 'append') renderAll();
      else {
        pending.add(d.id);
        if (!raf) raf = requestAnimationFrame(flush);
      }
      renderSend();
      const n = facts().length;
      sub.textContent = `🧠 ${n} dato${n === 1 ? '' : 's'} en memoria`;
    }),
    on('memory', () => {
      const n = facts().length;
      sub.textContent = `🧠 ${n} dato${n === 1 ? '' : 's'} en memoria`;
    }),
  ];
  return () => offs.forEach((f) => f());
}

export function renderCatPanel(panel) {
  if (!store.cat().named) return nameCard(panel);
  return chatView(panel);
}

