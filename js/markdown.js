// Renderizador de Markdown pequeño y seguro (todo se escapa antes de dar formato).

import { escapeHtml } from './ui.js';

const SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const LIST_RE = /^(\s*)([-*+•]|\d+[.)])\s+(.*)$/;

function shortUrl(url) {
  try {
    const u = new URL(url.replace(/&amp;/g, '&'));
    const path = u.pathname.length > 24 ? u.pathname.slice(0, 22) + '…' : u.pathname;
    return u.hostname.replace(/^www\./, '') + (path === '/' ? '' : path);
  } catch {
    return url;
  }
}

export function inline(src) {
  let t = escapeHtml(src);
  const stash = [];
  const keep = (html) => `\u0000${stash.push(html) - 1}\u0000`;

  t = t.replace(/`([^`]+)`/g, (_, c) => keep(`<code>${c}</code>`));
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, txt, url) =>
    keep(`<a href="${url}" target="_blank" rel="noopener noreferrer">${txt}</a>`)
  );
  t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g, (_, pre, url) =>
    pre + keep(`<a href="${url}" target="_blank" rel="noopener noreferrer">${shortUrl(url)}</a>`)
  );
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/__(.+?)__/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  t = t.replace(/(^|[^\w])_(?!\s)([^_\n]+?)_(?!\w)/g, '$1<em>$2</em>');
  t = t.replace(/~~(.+?)~~/g, '<del>$1</del>');
  return t.replace(/\u0000(\d+)\u0000/g, (_, n) => stash[+n]);
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function renderList(items) {
  let html = '';
  const stack = [];
  for (const it of items) {
    while (stack.length && it.indent < stack[stack.length - 1].indent) {
      html += `</li></${stack.pop().tag}>`;
    }
    const top = stack[stack.length - 1];
    if (!top || it.indent > top.indent) {
      const tag = it.ordered ? 'ol' : 'ul';
      stack.push({ indent: it.indent, tag });
      html += `<${tag}><li>`;
    } else {
      html += '</li><li>';
    }
    html += it.text.split('\n').map(inline).join('<br>');
  }
  while (stack.length) html += `</li></${stack.pop().tag}>`;
  return html;
}

function isBlockStart(line, next) {
  return (
    /^\s*```/.test(line) ||
    /^#{1,6}\s/.test(line) ||
    /^\s*>/.test(line) ||
    LIST_RE.test(line) ||
    /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
    (line.includes('|') && next !== undefined && SEP_RE.test(next))
  );
}

export function md(src) {
  const lines = String(src ?? '').replace(/\r\n?/g, '\n').split('\n');
  let html = '';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      html += `<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`;
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && SEP_RE.test(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(splitRow(lines[i++]));
      html +=
        '<div class="table-wrap"><table><thead><tr>' +
        head.map((c) => `<th>${inline(c)}</th>`).join('') +
        '</tr></thead><tbody>' +
        rows.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table></div>';
      continue;
    }

    const hm = line.match(/^(#{1,6})\s+(.*)$/);
    if (hm) {
      const lvl = Math.min(hm[1].length + 2, 6);
      html += `<h${lvl}>${inline(hm[2].replace(/#+\s*$/, ''))}</h${lvl}>`;
      i++;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      html += '<hr>';
      i++;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      html += `<blockquote>${md(buf.join('\n'))}</blockquote>`;
      continue;
    }

    if (LIST_RE.test(line)) {
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(LIST_RE);
        if (m) {
          items.push({ indent: m[1].replace(/\t/g, '  ').length, ordered: /\d/.test(m[2]), text: m[3] });
          i++;
        } else if (items.length && /^\s{2,}\S/.test(lines[i])) {
          items[items.length - 1].text += '\n' + lines[i++].trim();
        } else if (!lines[i].trim() && i + 1 < lines.length && LIST_RE.test(lines[i + 1])) {
          i++; // línea en blanco entre viñetas
        } else break;
      }
      html += renderList(items);
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    const buf = [];
    while (i < lines.length && lines[i].trim() && !(buf.length && isBlockStart(lines[i], lines[i + 1]))) {
      buf.push(lines[i++]);
    }
    html += `<p>${buf.map(inline).join('<br>')}</p>`;
  }
  return html;
}

/** Versión en texto plano para copiar y pegar en Instagram/TikTok. */
export function toPlain(src) {
  return String(src ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/^\s*```.*$/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 ($2)')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
