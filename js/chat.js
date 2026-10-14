// Panel de cada oficina: chat con el agente (y pestaña de métricas para el Analista).

import { h, toast, copyText, fileToImagePart, isTouch, confirmDialog, domainOf } from './ui.js';
import * as store from './store.js';
import { AGENT_IDS } from './store.js';
import { runtime, on, go, STATUS_LABEL } from './state.js';
import { sendToAgent, stopAgent, retry, clearChat, isBusy } from './conversation.js';
import { searchProvider } from './brain.js';
import { md, toPlain } from './markdown.js';
import { ROLES } from './prompts.js';
import { avatarSvg } from './office.js';
import { renderMetrics } from './metrics.js';

const MAX_IMAGES = 4;

function typing() {
  return h('div', { class: 'typing', 'aria-label': 'Escribiendo' }, h('i'), h('i'), h('i'));
}

export function sourcesEl(sources) {
  if (!sources?.length) return null;
  return h(
    'details',
    { class: 'sources' },
    h('summary', null, `📚 Fuentes (${sources.length})`),
    h(
      'ol',
      null,
      sources.map((src) =>
        h('li', null, h('a', { href: src.url, target: '_blank', rel: 'noopener noreferrer' }, src.title || domainOf(src.url)), ' ', h('small', null, domainOf(src.url)))
      )
    )
  );
}

function msgActions(agentId, m) {
  const others = AGENT_IDS.filter((id) => id !== agentId);
  const agents = store.agents();
  return h(
    'div',
    { class: 'msg-actions' },
    h('button', { class: 'chip', type: 'button', onClick: () => copyText(toPlain(m.text)) }, '📋 Copiar'),
    others.map((id) =>
      h(
        'button',
        {
          class: 'chip',
          type: 'button',
          title: `Pasarle esta respuesta a ${agents[id].name}`,
          onClick: () => {
            runtime.drafts[id] = `Te paso esto de ${agents[agentId].name}:\n\n${toPlain(m.text)}\n\n`;
            go(`#/agente/${id}`);
          },
        },
        `➡️ ${agents[id].name}`
      )
    ),
    h(
      'button',
      {
        class: 'chip',
        type: 'button',
        onClick: () => {
          runtime.meetingDraft = { topic: toPlain(m.text).slice(0, 1200) };
          runtime.activeMeetingId = runtime.meetingBusy ? runtime.activeMeetingId : null;
          go('#/juntas');
        },
      },
      '🤝 Llevar a la sala'
    )
  );
}

function msgEl(agentId, m) {
  if (m.role === 'user') {
    return h(
      'div',
      { class: 'msg msg-user', 'data-id': m.id },
      m.text,
      m.images ? h('div', { class: 'msg-images' }, `📷 ${m.images} imagen${m.images > 1 ? 'es' : ''} adjunta${m.images > 1 ? 's' : ''}`) : null
    );
  }
  const a = store.agents()[agentId];
  const el = h('div', { class: `msg msg-model${m.error ? ' msg-error' : ''}`, 'data-id': m.id });
  el.append(
    h(
      'div',
      { class: 'msg-head' },
      avatarSvg(a.look),
      a.name,
      m.via === 'groq' ? h('span', { class: 'via-badge', title: 'Gemini llegó al límite: respondió Groq (sin búsqueda web)' }, '⚡ Groq') : null
    )
  );
  if (m.pending && m.status) el.append(h('div', { class: 'msg-status' }, m.status));
  if (m.text) el.append(h('div', { class: 'md', html: md(m.text) }));
  else if (m.pending) el.append(typing());
  if (m.error) {
    el.append(
      h('p', null, '⚠️ ', m.error),
      h(
        'div',
        { class: 'msg-actions' },
        m.setup
          ? h('button', { class: 'chip', type: 'button', onClick: () => go('#/config/claves') }, '⚙️ Ir a Configuración')
          : h('button', { class: 'chip', type: 'button', onClick: () => retry(agentId, m.id) }, '🔄 Reintentar')
      )
    );
  }
  if (!m.pending) {
    if (m.sources?.length) el.append(sourcesEl(m.sources));
    if (m.text && !m.error) el.append(msgActions(agentId, m));
  }
  return el;
}

function introEl(agentId) {
  const a = store.agents()[agentId];
  const role = ROLES[agentId];
  const hasKey = !!store.settings().geminiKey;
  return h(
    'div',
    { class: 'msg msg-model msg-intro' },
    h('div', { class: 'msg-head' }, avatarSvg(a.look), a.name),
    h('p', { style: { margin: 0 } }, `¡Epa, Kike! Soy ${a.name}, tu ${role.title.toLowerCase()}. ${role.short} ¿Qué hacemos hoy?`),
    hasKey
      ? null
      : h(
          'p',
          { style: { margin: '8px 0 0' } },
          '⚠️ Primero necesito tu API key de Google AI Studio. ',
          h('button', { class: 'link-btn', type: 'button', onClick: () => go('#/config/claves') }, 'Agregarla aquí')
        )
  );
}

function chatView(agentId) {
  const a = store.agents()[agentId];
  const wrap = h('div', { class: 'chat' });
  const list = h('div', { class: 'messages', role: 'log', 'aria-label': `Conversación con ${a.name}` });
  let images = [];

  const nearBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 120;
  const toBottom = () => {
    list.scrollTop = list.scrollHeight;
  };

  const renderAll = () => {
    list.replaceChildren(introEl(agentId), ...store.chat(agentId).map((m) => msgEl(agentId, m)));
    toBottom();
  };

  const pending = new Set();
  let raf = 0;
  const flush = () => {
    raf = 0;
    const stick = nearBottom();
    for (const id of pending) {
      const m = store.chat(agentId).find((x) => x.id === id);
      const old = list.querySelector(`[data-id="${CSS.escape(id)}"]`);
      if (m && old) old.replaceWith(msgEl(agentId, m));
    }
    pending.clear();
    if (stick) toBottom();
  };

  // ---- Atajos ----
  const quick = h(
    'div',
    { class: 'quick', role: 'list', 'aria-label': 'Ideas rápidas' },
    ROLES[agentId].quick.map((q) =>
      h(
        'button',
        {
          class: 'chip',
          type: 'button',
          role: 'listitem',
          title: q,
          onClick: () => {
            textarea.value = q;
            runtime.drafts[agentId] = q;
            autoGrow();
            textarea.focus();
            const m = q.match(/\[[^\]]+\]/);
            if (m) textarea.setSelectionRange(m.index, m.index + m[0].length);
          },
        },
        q
      )
    )
  );

  // ---- Composer ----
  const textarea = h('textarea', {
    rows: 1,
    placeholder: `Escríbele a ${a.name}…`,
    'aria-label': `Mensaje para ${a.name}`,
    value: runtime.drafts[agentId] || '',
  });
  const autoGrow = () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight + 2, 180) + 'px';
  };
  textarea.addEventListener('input', () => {
    runtime.drafts[agentId] = textarea.value;
    autoGrow();
  });
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
          h(
            'button',
            {
              type: 'button',
              'aria-label': 'Quitar imagen',
              onClick: () => {
                images.splice(i, 1);
                renderAttachments();
              },
            },
            '✕'
          )
        )
      )
    );
    attachments.hidden = !images.length;
  };

  const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
  fileInput.addEventListener('change', async () => {
    const files = [...fileInput.files].slice(0, MAX_IMAGES - images.length);
    for (const f of files) {
      try {
        images.push(await fileToImagePart(f));
      } catch (e) {
        toast(e.message, 'error');
      }
    }
    fileInput.value = '';
    renderAttachments();
  });

  const webChip = h('button', { class: 'chip', type: 'button' });
  const renderWebChip = () => {
    const s = store.settings();
    const provider = searchProvider();
    webChip.setAttribute('aria-pressed', String(!!s.webSearch));
    webChip.textContent = s.webSearch ? `🔎 Web: sí` : '🔎 Web: no';
    webChip.title = s.webSearch
      ? `Puede buscar en internet (${provider === 'tavily' ? 'Tavily' : 'Google vía Gemini'}). Toca para desactivar y ahorrar créditos.`
      : 'Búsqueda web desactivada. Toca para activarla.';
  };
  webChip.addEventListener('click', () => {
    const s = store.settings();
    s.webSearch = !s.webSearch;
    store.save('settings');
    renderWebChip();
  });

  const sendBtn = h('button', { class: 'btn btn-primary btn-sm', type: 'submit' });
  const renderSend = () => {
    const busy = isBusy(agentId);
    sendBtn.textContent = busy ? '■ Detener' : 'Enviar ➤';
    sendBtn.classList.toggle('btn-danger', busy);
    sendBtn.classList.toggle('btn-primary', !busy);
  };

  const submit = () => {
    if (isBusy(agentId)) {
      stopAgent(agentId);
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
    runtime.drafts[agentId] = '';
    autoGrow();
    sendToAgent(agentId, text, imgs);
  };

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
      h(
        'button',
        { class: 'chip', type: 'button', title: 'Adjuntar captura o foto (Gemini puede leerla)', onClick: () => fileInput.click() },
        '📎 Imagen'
      ),
      fileInput,
      webChip,
      h('span', { class: 'spacer' }),
      sendBtn
    )
  );

  wrap.append(list, quick, form);
  renderAll();
  renderAttachments();
  renderWebChip();
  renderSend();
  requestAnimationFrame(autoGrow);

  const off = on('chat', (d) => {
    if (d.agentId !== agentId) return;
    if (d.type === 'append') renderAll();
    else {
      pending.add(d.id);
      if (!raf) raf = requestAnimationFrame(flush);
    }
    renderSend();
  });
  return { el: wrap, cleanup: off, focus: () => !isTouch() && textarea.focus() };
}

export function renderAgentPanel(panel, agentId, tab = 'chat') {
  const a = store.agents()[agentId];
  const role = ROLES[agentId];
  const sub = h('span');
  const renderSub = () => {
    const st = runtime.status[agentId];
    sub.textContent = st !== 'idle' && STATUS_LABEL[st] ? `${role.title} · ${STATUS_LABEL[st]}` : role.title;
  };
  renderSub();

  const head = h(
    'header',
    { class: 'panel-head' },
    h('button', { class: 'icon-btn back-btn only-sheet', type: 'button', 'aria-label': 'Volver a la oficina', onClick: () => go('#/') }, '←'),
    avatarSvg(a.look),
    h('div', { class: 'panel-title' }, h('strong', null, `${role.icon} ${a.name}`), sub),
    h(
      'button',
      {
        class: 'icon-btn',
        type: 'button',
        title: 'Nueva conversación',
        'aria-label': 'Nueva conversación',
        onClick: async () => {
          if (!store.chat(agentId).length) return;
          if (await confirmDialog(`¿Borrar la conversación con ${a.name} y empezar de cero?`, { okLabel: 'Sí, borrar', danger: true })) {
            clearChat(agentId);
          }
        },
      },
      '🧹'
    )
  );

  const nodes = [head];
  const cleanups = [on('status', (d) => d.id === agentId && renderSub())];

  if (agentId === 'analista') {
    const mk = (key, label) =>
      h('button', { class: 'tab', role: 'tab', type: 'button', 'aria-selected': String(tab === key), onClick: () => go(key === 'chat' ? '#/agente/analista' : '#/agente/analista/metricas') }, label);
    nodes.push(h('div', { class: 'tabs', role: 'tablist' }, mk('chat', '💬 Chat'), mk('metricas', '📈 Métricas')));
  }

  let focus = null;
  if (agentId === 'analista' && tab === 'metricas') {
    const body = h('div', { class: 'panel-body' });
    nodes.push(body);
    cleanups.push(renderMetrics(body));
  } else {
    const view = chatView(agentId);
    nodes.push(view.el);
    cleanups.push(view.cleanup);
    focus = view.focus;
  }
  panel.replaceChildren(...nodes);
  focus?.();
  return () => cleanups.forEach((fn) => fn?.());
}
