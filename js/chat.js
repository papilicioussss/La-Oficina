// Panel de cada oficina: chat con el agente (y pestaña de métricas para el Analista).

import { h, toast, copyText, fileToImagePart, isTouch, confirmDialog, domainOf, openModal } from './ui.js';
import { skillsFor, isEnabled, explainPick, skillById } from './skills.js';
import { suggestSkillsAI } from './skills-ai.js';
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

/** Etiqueta del modelo usado cuando no fue el principal (rápido o potente). */
export function tierBadge(m) {
  if (m.tier === 'light' && m.via !== 'groq') return h('span', { class: 'via-badge', title: `Mensaje simple: respondió el modelo rápido (${m.model}). Gasta muy pocos tokens.` }, '⚡ rápido');
  if (m.tier === 'heavy' && m.modelLabel === 'potente') return h('span', { class: 'via-badge', title: `Tarea grande: respondió el modelo potente (${m.model}).` }, '🧠 potente');
  return null;
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
      m.via === 'groq' ? h('span', { class: 'via-badge', title: m.tier === 'light' ? 'Mensaje simple: respondió Groq (rápido)' : 'Gemini llegó al límite: respondió Groq (sin búsqueda web)' }, '⚡ Groq') : null,
      tierBadge(m)
    )
  );
  if (m.skills?.length) el.append(h('div', { class: 'skills-line', title: 'Habilidades de marketing que usó para esta respuesta' }, '🛠 ', m.skills.join(' · ')));
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
    h('p', { class: 'm-0' }, `¡Epa, Kike! Soy ${a.name}, tu ${role.title.toLowerCase()}. ${role.short} ¿Qué hacemos hoy?`),
    hasKey
      ? null
      : h(
          'p',
          { class: 'mt-2 mb-0' },
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

  // Habilidades: se eligen solas según lo que pides; aquí puedes forzar alguna para el próximo mensaje.
  const skillsChip = h('button', { class: 'chip', type: 'button' });
  const renderSkillsChip = () => {
    const n = (runtime.forcedSkills[agentId] || []).length;
    skillsChip.textContent = n ? `🛠 Skills (${n})` : '🛠 Manual';
    skillsChip.setAttribute('aria-pressed', String(!!n));
    skillsChip.title = 'Elige habilidades de marketing para tu próximo mensaje (si no eliges, se activan solas según lo que pidas)';
  };
  skillsChip.addEventListener('click', () => {
    const chosen = new Set(runtime.forcedSkills[agentId] || []);
    const list = skillsFor(agentId).filter((x) => !x.core && isEnabled(x.id));
    const body = h(
      'div',
      null,
      h('p', { class: 'hint mt-0' }, 'Se activan solas según lo que escribas. Marca las que quieras que use sí o sí en tu próximo mensaje (máximo 4).'),
      h(
        'div',
        { class: 'radio-cards' },
        list.map((x) =>
          h(
            'label',
            { class: 'radio-card' },
            h('input', {
              type: 'checkbox',
              checked: chosen.has(x.id),
              onChange: (e) => {
                if (e.target.checked) {
                  if (chosen.size >= 4) {
                    e.target.checked = false;
                    toast('Máximo 4 skills a la vez.', 'warn', 2000);
                    return;
                  }
                  chosen.add(x.id);
                } else chosen.delete(x.id);
              },
            }),
            h('span', null, h('strong', null, `${x.icon} ${x.name}`), h('small', null, x.desc))
          )
        )
      )
    );
    openModal({
      title: `🛠 Skills de ${store.agents()[agentId].name}`,
      body,
      actions: [
        {
          label: 'Quitar selección',
          kind: 'ghost',
          onClick: (close) => {
            runtime.forcedSkills[agentId] = [];
            renderSkillsChip();
            close();
          },
        },
        {
          label: 'Listo',
          kind: 'primary',
          onClick: (close) => {
            runtime.forcedSkills[agentId] = [...chosen];
            renderSkillsChip();
            close();
          },
        },
      ],
    });
  });

  // "Elegir skills por mí": propone las skills según lo que escribiste (simple, gratis) y se puede afinar con IA.
  const autoChip = h('button', { class: 'chip', type: 'button', title: 'Escribe lo que necesitas y toca aquí: te propongo las skills que mejor encajan' }, '✨ Elegir skills por mí');
  autoChip.addEventListener('click', () => {
    const text = textarea.value.trim();
    if (!text) {
      toast('Escribe primero lo que necesitas y luego toca ✨ para que elija las skills.', 'info', 3500);
      textarea.focus();
      return;
    }
    const simple = explainPick(agentId, text);
    const chosen = new Set(simple.map((x) => x.skill.id));
    const body = h('div');
    let nota = simple.length ? 'Estas encajan con lo que escribiste (por las palabras que usaste):' : 'No encontré skills claras por palabras clave. Puedes afinar con IA o elegirlas a mano.';
    const reasons = new Map(simple.map((x) => [x.skill.id, x.matched.slice(0, 3).join(', ')]));
    const render = () => {
      const all = skillsFor(agentId).filter((x) => !x.core && isEnabled(x.id));
      const shown = all.filter((x) => reasons.has(x.id) || chosen.has(x.id));
      body.replaceChildren(
        h('p', { class: 'hint mt-0' }, nota),
        shown.length
          ? h(
              'div',
              { class: 'radio-cards' },
              shown.map((x) =>
                h(
                  'label',
                  { class: 'radio-card' },
                  h('input', {
                    type: 'checkbox',
                    checked: chosen.has(x.id),
                    onChange: (e) => {
                      if (e.target.checked) {
                        if (chosen.size >= 4) {
                          e.target.checked = false;
                          toast('Máximo 4 skills a la vez.', 'warn', 2000);
                          return;
                        }
                        chosen.add(x.id);
                      } else chosen.delete(x.id);
                    },
                  }),
                  h('span', null, h('strong', null, `${x.icon} ${x.name}`), h('small', null, reasons.get(x.id) ? `${x.desc} · por: ${reasons.get(x.id)}` : x.desc))
                )
              )
            )
          : null
      );
    };
    render();
    openModal({
      title: '✨ Skills sugeridas',
      body,
      actions: [
        {
          label: '🤖 Afinar con IA',
          kind: 'ghost',
          onClick: async (close, btn) => {
            btn.disabled = true;
            btn.textContent = 'Pensando…';
            try {
              const r = await suggestSkillsAI(agentId, text);
              chosen.clear();
              reasons.clear();
              r.ids.forEach((id) => {
                chosen.add(id);
                reasons.set(id, '');
              });
              nota = `La IA eligió estas: ${r.motivo}`;
              render();
            } catch (e) {
              toast(e.message || 'No pude consultar a la IA.', 'error');
            } finally {
              btn.disabled = false;
              btn.textContent = '🤖 Afinar con IA';
            }
            return false;
          },
        },
        {
          label: 'Usar estas',
          kind: 'primary',
          onClick: (close) => {
            runtime.forcedSkills[agentId] = [...chosen].filter((id) => skillById(id));
            renderSkillsChip();
            close();
            toast(chosen.size ? 'Listo: las usaré en tu próximo mensaje.' : 'Sin skills extra: se activarán solas según lo que pidas.', 'info', 2500);
          },
        },
      ],
    });
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
    const skills = runtime.forcedSkills[agentId] || [];
    runtime.forcedSkills[agentId] = [];
    renderSkillsChip();
    sendToAgent(agentId, text, imgs, { skills });
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
      autoChip,
      skillsChip,
      webChip,
      h('span', { class: 'spacer' }),
      sendBtn
    )
  );

  wrap.append(list, quick, form);
  renderAll();
  renderAttachments();
  renderWebChip();
  renderSkillsChip();
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
