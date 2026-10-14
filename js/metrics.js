// Registro manual de métricas (pestaña del Analista): KPIs, gráfico y tabla.

import { h, s, toast, uid, fmtInt, fmtCompact, fmtPct, fmtDate, openModal, confirmDialog, fileToImagePart } from './ui.js';
import * as store from './store.js';
import { go } from './state.js';
import { NETWORKS, FORMATS, NUMERIC_FIELDS, rates, filterPosts, summary } from './metrics-calc.js';
import { extractMetricsFromImage } from './brain.js';
import { sendToAgent } from './conversation.js';

const filters = { red: 'todas', dias: 30 };
const SERIES_VAR = { instagram: 'var(--series-ig)', tiktok: 'var(--series-tt)' };

const posts = () => store.get('metrics');

function niceStep(max, ticks = 4) {
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

function drawChart(host, data) {
  const width = Math.max(260, host.clientWidth || 400);
  const height = 190;
  const m = { t: 10, r: 6, b: 24, l: 40 };
  const plotW = width - m.l - m.r;
  const plotH = height - m.t - m.b;
  const values = data.map((p) => +p.vistas || +p.alcance || 0);
  const max = Math.max(...values, 1);
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const y = (v) => m.t + plotH - (v / top) * plotH;
  const band = plotW / data.length;
  const barW = Math.min(24, band * 0.62);

  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, height, role: 'img', 'aria-label': 'Vistas por publicación' });
  for (let v = 0; v <= top + 1e-9; v += step) {
    const yy = y(v);
    svg.append(
      s('line', { class: v === 0 ? 'baseline' : 'gridline', x1: m.l, x2: width - m.r, y1: yy, y2: yy }),
      s('text', { class: 'tick', x: m.l - 6, y: yy + 4, 'text-anchor': 'end' }, fmtCompact(v))
    );
  }
  const every = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotW / 54))));
  const tip = h('div', { class: 'tooltip', role: 'status' });

  data.forEach((p, i) => {
    const v = values[i];
    const x = m.l + band * i + (band - barW) / 2;
    const y0 = m.t + plotH;
    const hgt = Math.max(0, y0 - y(v));
    const r = Math.min(4, barW / 2, hgt);
    const d = hgt
      ? `M${x},${y0} V${y0 - hgt + r} Q${x},${y0 - hgt} ${x + r},${y0 - hgt} H${x + barW - r} Q${x + barW},${y0 - hgt} ${x + barW},${y0 - hgt + r} V${y0} Z`
      : '';
    const hit = s('rect', {
      class: 'bar-hit',
      x: m.l + band * i,
      y: m.t,
      width: band,
      height: plotH,
      tabindex: 0,
      'aria-label': `${fmtDate(p.fecha)} ${NETWORKS[p.red]}: ${fmtInt(v)} vistas`,
    });
    const bar = s('path', { class: 'bar', d, fill: SERIES_VAR[p.red] || 'var(--series-ig)' });
    const show = () => {
      const r2 = rates(p);
      tip.replaceChildren(
        h('b', null, `${fmtInt(v)} vistas`),
        h('div', { class: 'tip-row' }, h('span', { class: 'tip-key', style: { background: SERIES_VAR[p.red] } }), `${NETWORKS[p.red]} · ${p.formato || ''}`),
        h('div', null, `${fmtDate(p.fecha, { day: '2-digit', month: 'short', year: 'numeric' })}${p.tema ? ' · ' + p.tema.slice(0, 40) : ''}`),
        h('div', null, `Interacción: ${fmtPct(r2.interaccion)}`)
      );
      const left = ((x + barW / 2) / width) * 100;
      tip.style.left = `clamp(70px, ${left}%, calc(100% - 70px))`;
      tip.style.top = `${y0 - hgt}px`;
      tip.classList.add('show');
    };
    const hide = () => tip.classList.remove('show');
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('focus', show);
    hit.addEventListener('blur', hide);
    svg.append(hit, bar);
    if (i % every === 0) {
      svg.append(s('text', { class: 'tick', x: m.l + band * i + band / 2, y: height - 6, 'text-anchor': 'middle' }, fmtDate(p.fecha)));
    }
  });
  host.replaceChildren(svg, tip);
}

function kpi(label, value) {
  return h('div', { class: 'kpi' }, h('div', { class: 'kpi-label' }, label), h('div', { class: 'kpi-value' }, value));
}

function parseNum(v) {
  const t = String(v ?? '').trim().replace(/\s/g, '');
  if (!t) return null;
  // Acepta "1.234", "1,5", "1234.5"
  const norm = /,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

function postForm(existing, onSaved) {
  const p = existing ? { ...existing } : { id: uid(), fecha: new Date().toISOString().slice(0, 10), red: 'instagram', formato: 'Reel' };
  const inputs = {};
  const fecha = h('input', { type: 'date', value: p.fecha, required: true });
  const red = h('select', null, Object.entries(NETWORKS).map(([k, v]) => h('option', { value: k }, v)));
  red.value = p.red;
  const formato = h('select');
  const fillFormats = () => {
    const opts = FORMATS[red.value] || [];
    formato.replaceChildren(...opts.map((f) => h('option', { value: f }, f)));
    formato.value = opts.includes(p.formato) ? p.formato : opts[0];
  };
  red.addEventListener('change', fillFormats);
  fillFormats();
  const tema = h('input', { type: 'text', value: p.tema || '', placeholder: 'Ej.: Full day Cayo Sombrero – POV' });
  const enlace = h('input', { type: 'url', value: p.enlace || '', placeholder: 'https://… (opcional)' });
  const notas = h('textarea', { rows: 2, placeholder: 'Hook usado, audio, hora de publicación, algo que notaste…', value: p.notas || '' });

  const grid = h('div', { class: 'form-grid' });
  for (const f of NUMERIC_FIELDS) {
    inputs[f.key] = h('input', { type: 'text', inputmode: 'decimal', value: p[f.key] ?? '', placeholder: '—' });
    grid.append(h('div', { class: 'field' }, h('label', null, f.label), inputs[f.key]));
  }

  const shotBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, '📷 Rellenar desde captura');
  const shotInput = h('input', { type: 'file', accept: 'image/*', hidden: true });
  shotBtn.addEventListener('click', () => shotInput.click());
  shotInput.addEventListener('change', async () => {
    const file = shotInput.files[0];
    shotInput.value = '';
    if (!file) return;
    shotBtn.disabled = true;
    shotBtn.textContent = '⏳ Leyendo captura…';
    try {
      const img = await fileToImagePart(file, 2000);
      const data = await extractMetricsFromImage(img);
      let filled = 0;
      for (const f of NUMERIC_FIELDS) {
        if (data[f.key] != null && Number.isFinite(+data[f.key])) {
          inputs[f.key].value = data[f.key];
          filled++;
        }
      }
      if (data.red === 'instagram' || data.red === 'tiktok') {
        red.value = data.red;
        fillFormats();
      }
      if (data.formato) {
        const match = [...formato.options].find((o) => o.value.toLowerCase() === String(data.formato).toLowerCase());
        if (match) formato.value = match.value;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(data.fecha || '')) fecha.value = data.fecha;
      toast(filled ? `Leí ${filled} datos. Revísalos antes de guardar.` : 'No encontré números en esa captura.', filled ? 'ok' : 'warn', 6000);
    } catch (e) {
      toast(e.message, 'error', 7000);
    } finally {
      shotBtn.disabled = false;
      shotBtn.textContent = '📷 Rellenar desde captura';
    }
  });

  const body = h(
    'div',
    null,
    h(
      'div',
      { class: 'note mb-4' },
      'Copia los números de Instagram Insights o TikTok Analytics. También puedes subir una captura y la IA los lee por ti. ',
      shotBtn,
      shotInput
    ),
    h(
      'div',
      { class: 'form-grid' },
      h('div', { class: 'field' }, h('label', null, 'Fecha de publicación'), fecha),
      h('div', { class: 'field' }, h('label', null, 'Red'), red),
      h('div', { class: 'field' }, h('label', null, 'Formato'), formato),
      h('div', { class: 'field' }, h('label', null, 'Tema / destino'), tema),
      h('div', { class: 'field full' }, h('label', null, 'Enlace'), enlace)
    ),
    grid,
    h('div', { class: 'field' }, h('label', null, 'Notas'), notas)
  );

  openModal({
    title: existing ? 'Editar publicación' : 'Registrar publicación',
    body,
    wide: true,
    actions: [
      { label: 'Cancelar', kind: 'ghost', onClick: (close) => close() },
      {
        label: 'Guardar',
        kind: 'primary',
        onClick: (close) => {
          if (!fecha.value) {
            toast('Pon la fecha de publicación.', 'warn');
            return;
          }
          const record = {
            ...p,
            fecha: fecha.value,
            red: red.value,
            formato: formato.value,
            tema: tema.value.trim(),
            enlace: enlace.value.trim(),
            notas: notas.value.trim(),
          };
          for (const f of NUMERIC_FIELDS) record[f.key] = parseNum(inputs[f.key].value);
          const list = posts();
          const idx = list.findIndex((x) => x.id === record.id);
          if (idx >= 0) list[idx] = record;
          else list.push(record);
          store.save('metrics');
          close();
          toast('Publicación guardada ✔', 'ok', 2000);
          onSaved();
        },
      },
    ],
  });
}

export function renderMetrics(container) {
  const agents = store.agents();
  const chartHost = h('div', { class: 'chart' });
  let currentData = [];
  let ro = null;

  const render = () => {
    const all = posts();
    const data = filterPosts(all, filters);
    const sum = summary(data);
    currentData = data.slice(-30);

    const seg = h(
      'div',
      { class: 'seg', role: 'group', 'aria-label': 'Red social' },
      [
        ['todas', 'Todas'],
        ['instagram', 'Instagram'],
        ['tiktok', 'TikTok'],
      ].map(([k, label]) =>
        h(
          'button',
          {
            type: 'button',
            'aria-pressed': String(filters.red === k),
            onClick: () => {
              filters.red = k;
              render();
            },
          },
          label
        )
      )
    );
    const period = h(
      'select',
      {
        'aria-label': 'Período',
        onChange: (e) => {
          filters.dias = +e.target.value;
          render();
        },
      },
      [
        [7, 'Últimos 7 días'],
        [30, 'Últimos 30 días'],
        [90, 'Últimos 90 días'],
        [0, 'Todo'],
      ].map(([v, l]) => h('option', { value: v }, l))
    );
    period.value = String(filters.dias);

    const addBtn = h('button', { class: 'btn btn-primary btn-sm', type: 'button', onClick: () => postForm(null, render) }, '＋ Registrar');
    const analyzeBtn = h(
      'button',
      {
        class: 'btn btn-ghost btn-sm',
        type: 'button',
        disabled: !all.length,
        onClick: () => {
          const scope = `${filters.red === 'todas' ? 'Instagram y TikTok' : NETWORKS[filters.red]}, ${filters.dias ? `últimos ${filters.dias} días` : 'todo el registro'}`;
          go('#/agente/analista');
          sendToAgent(
            'analista',
            `Analiza mis métricas registradas (${scope}). Dime qué está funcionando, qué no y qué hago la próxima semana. Prioriza lo que trae consultas por WhatsApp/DM, no solo vistas.`
          );
        },
      },
      `🤖 Analizar con ${agents.analista.name}`
    );

    const nodes = [h('div', { class: 'filters' }, seg, period, h('span', { class: 'spacer' }), addBtn, analyzeBtn)];

    if (!all.length) {
      nodes.push(
        h(
          'div',
          { class: 'empty' },
          h('div', { class: 'big' }, '📈'),
          h('p', null, h('strong', null, 'Aún no hay publicaciones registradas.')),
          h('p', null, 'Agrega la primera a mano o desde una captura de Instagram Insights / TikTok Analytics. Con 5–10 publicaciones el Analista ya puede encontrar patrones.'),
          h('button', { class: 'btn btn-primary', type: 'button', onClick: () => postForm(null, render) }, '＋ Registrar publicación')
        )
      );
      container.replaceChildren(...nodes);
      return;
    }

    nodes.push(
      h(
        'div',
        { class: 'kpis' },
        kpi('Publicaciones', fmtInt(sum.count)),
        kpi('Vistas promedio', fmtCompact(sum.vistas)),
        kpi('Interacción promedio', fmtPct(sum.interaccion)),
        kpi('Compartidos / alcance', fmtPct(sum.compartidos)),
        kpi('Guardados / alcance', fmtPct(sum.guardados)),
        kpi('Consultas WhatsApp', sum.consultasTotal == null ? '—' : fmtInt(sum.consultasTotal))
      )
    );

    if (currentData.length) {
      const nets = [...new Set(currentData.map((p) => p.red))];
      nodes.push(
        h(
          'div',
          { class: 'chart-card' },
          h('h3', null, nets.length === 1 ? `Vistas por publicación · ${NETWORKS[nets[0]]}` : 'Vistas por publicación'),
          h('p', { class: 'sub' }, currentData.length < data.length ? `Últimas ${currentData.length} del período` : 'En orden de fecha'),
          nets.length > 1
            ? h(
                'div',
                { class: 'legend' },
                nets.map((n) => h('span', null, h('i', { style: { background: SERIES_VAR[n] } }), NETWORKS[n]))
              )
            : null,
          chartHost
        )
      );
    } else {
      nodes.push(h('p', { class: 'empty' }, 'No hay publicaciones en este período.'));
    }

    const rows = [...data].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    if (rows.length) {
      nodes.push(
        h(
          'div',
          { class: 'table-wrap' },
          h(
            'table',
            { class: 'posts-table' },
            h(
              'thead',
              null,
              h(
                'tr',
                null,
                ['Fecha', 'Red', 'Formato', 'Tema'].map((t) => h('th', null, t)),
                ['Vistas', 'Interacción', 'Guardados', 'Compartidos', 'Consultas'].map((t) => h('th', { class: 'num' }, t)),
                h('th', null, h('span', { class: 'sr-only' }, 'Acciones'))
              )
            ),
            h(
              'tbody',
              null,
              rows.map((p) => {
                const r = rates(p);
                return h(
                  'tr',
                  null,
                  h('td', null, fmtDate(p.fecha)),
                  h('td', null, h('span', { class: 'net-dot', style: { background: SERIES_VAR[p.red] } }), NETWORKS[p.red]),
                  h('td', null, p.formato || ''),
                  h('td', { class: 'tema' }, p.enlace ? h('a', { href: p.enlace, target: '_blank', rel: 'noopener noreferrer' }, p.tema || 'Ver') : p.tema || '—'),
                  h('td', { class: 'num' }, fmtInt(p.vistas)),
                  h('td', { class: 'num' }, fmtPct(r.interaccion)),
                  h('td', { class: 'num' }, fmtPct(r.guardados)),
                  h('td', { class: 'num' }, fmtPct(r.compartidos)),
                  h('td', { class: 'num' }, p.consultas == null ? '—' : fmtInt(p.consultas)),
                  h(
                    'td',
                    null,
                    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Editar', onClick: () => postForm(p, render) }, '✏️'),
                    h(
                      'button',
                      {
                        class: 'icon-btn',
                        type: 'button',
                        'aria-label': 'Borrar',
                        onClick: async () => {
                          if (!(await confirmDialog('¿Borrar esta publicación del registro?', { okLabel: 'Borrar', danger: true }))) return;
                          const list = posts();
                          list.splice(list.findIndex((x) => x.id === p.id), 1);
                          store.save('metrics');
                          render();
                        },
                      },
                      '🗑️'
                    )
                  )
                );
              })
            )
          )
        ),
        h('p', { class: 'hint' }, 'Las tasas se calculan sobre el alcance (o sobre las vistas si no pusiste alcance).')
      );
    }

    container.replaceChildren(...nodes);
    if (currentData.length) requestAnimationFrame(() => drawChart(chartHost, currentData));
  };

  render();
  if ('ResizeObserver' in window) {
    let w = 0;
    ro = new ResizeObserver(() => {
      const nw = chartHost.clientWidth;
      if (nw && Math.abs(nw - w) > 8 && currentData.length) {
        w = nw;
        drawChart(chartHost, currentData);
      }
    });
    ro.observe(chartHost);
  }
  return () => ro?.disconnect();
}
