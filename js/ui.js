// Utilidades de interfaz: creación de nodos, toasts, modales y formato de números.

const SVGNS = 'http://www.w3.org/2000/svg';

function applyProps(el, props, isSvg) {
  if (!props) return;
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') isSvg ? el.setAttribute('class', v) : (el.className = v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v; // solo con HTML ya sanitizado (markdown.js)
    else if (k === 'value' && !isSvg) el.value = v;
    else if (k === 'checked' && !isSvg) el.checked = !!v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
}

function append(el, kids) {
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false || kid === true) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
}

/** Crea un elemento HTML: h('div', {class:'x'}, 'texto', otroNodo) */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  applyProps(el, props, false);
  append(el, kids);
  return el;
}

/** Crea un elemento SVG. */
export function s(tag, props, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  applyProps(el, props, true);
  append(el, kids);
  return el;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function debounce(fn, ms = 400) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ---------- Números ----------

const nf1 = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 });

export function fmtInt(n) {
  return Number.isFinite(n) ? nf0.format(n) : '—';
}

export function fmtCompact(n) {
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e6) return nf1.format(n / 1e6) + 'M';
  if (a >= 1e3) return nf1.format(n / 1e3) + 'K';
  return nf0.format(n);
}

export function fmtPct(ratio) {
  return Number.isFinite(ratio) ? nf1.format(ratio * 100) + '%' : '—';
}

export function fmtDate(iso, opts = { day: '2-digit', month: 'short' }) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-VE', opts);
}

export function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ---------- Toasts ----------

export function toast(message, type = 'info', ms = 4500) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = h('div', { class: `toast toast-${type}`, role: type === 'error' ? 'alert' : 'status' }, message);
  root.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

// ---------- Modal ----------

/**
 * Abre un <dialog> modal. Devuelve { close, dialog }.
 * actions: [{ label, kind: 'primary'|'ghost'|'danger', onClick(close) }]
 */
export function openModal({ title, body, actions = [], wide = false, onClose }) {
  const dialog = h('dialog', { class: `modal${wide ? ' modal-wide' : ''}` });
  const close = () => {
    if (dialog.open) dialog.close();
  };
  dialog.addEventListener('close', () => {
    onClose?.();
    dialog.remove();
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });
  dialog.append(
    h(
      'div',
      { class: 'modal-card' },
      h(
        'header',
        { class: 'modal-head' },
        h('h2', null, title),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar', onClick: close }, '✕')
      ),
      h('div', { class: 'modal-body' }, body),
      actions.length
        ? h(
            'footer',
            { class: 'modal-foot' },
            actions.map((a) =>
              h('button', { class: `btn btn-${a.kind || 'ghost'}`, type: 'button', onClick: () => a.onClick?.(close) }, a.label)
            )
          )
        : null
    )
  );
  document.getElementById('modal-root').append(dialog);
  dialog.showModal();
  return { close, dialog };
}

export function confirmDialog(message, { okLabel = 'Sí, dale', danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    openModal({
      title: 'Confirma',
      body: h('p', null, message),
      onClose: () => !answered && resolve(false),
      actions: [
        { label: 'Cancelar', kind: 'ghost', onClick: (close) => close() },
        {
          label: okLabel,
          kind: danger ? 'danger' : 'primary',
          onClick: (close) => {
            answered = true;
            resolve(true);
            close();
          },
        },
      ],
    });
  });
}

// ---------- Portapapeles ----------

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('Copiado ✔', 'ok', 1800);
}

// ---------- Imágenes ----------

/** Reduce una imagen y la devuelve en base64 (JPEG) lista para Gemini. */
export async function fileToImagePart(file, maxDim = 1600) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('No pude leer la imagen.'));
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const hgt = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = hgt;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, hgt);
    ctx.drawImage(img, 0, 0, w, hgt);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return { mimeType: 'image/jpeg', data: dataUrl.split(',')[1], preview: dataUrl, name: file.name };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const isTouch = () => window.matchMedia('(pointer: coarse)').matches;
