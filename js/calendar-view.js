// Vista "Fechas": lo que viene en Venezuela para vender (feriados, fines de semana largos, vacaciones, fechas comerciales)
// y las fechas propias de Kike. Los agentes también leen las próximas fechas para proponer contenido con tiempo.

import { h, toast, confirmDialog, uid } from './ui.js';
import * as store from './store.js';
import { runtime, go } from './state.js';
import { eventsBetween, todayISO, daysUntil, rangeLabel, whenLabel, KIND_META, parse } from './calendar-ve.js';

const HORIZONS = [
  [60, '2 meses'],
  [180, '6 meses'],
  [365, '1 año'],
];

function ideaButton(ev) {
  return h(
    'button',
    {
      class: 'chip',
      type: 'button',
      title: 'Le paso esta fecha a Nico para que proponga copys',
      onClick: () => {
        const mi = ev.kind === 'mia' ? ` (${ev.title})` : '';
        runtime.drafts.copy = `Se acerca "${ev.title}" (${rangeLabel(ev)})${mi}. Dame 3 ideas de contenido para Instagram y TikTok que lleven a la gente a escribirnos por WhatsApp para reservar una salida esas fechas.`;
        go('#/agente/copy');
      },
    },
    '💡 Ideas con Nico'
  );
}

function eventRow(ev, refresh) {
  const meta = KIND_META[ev.kind] || KIND_META.feriado;
  const n = daysUntil(ev);
  return h(
    'li',
    { class: `cal-row kind-${ev.kind}${n <= 7 && n >= -1 ? ' is-soon' : ''}`, 'data-kind': ev.kind },
    h('span', { class: 'cal-icon', 'aria-hidden': 'true' }, meta.icon),
    h(
      'div',
      { class: 'grow' },
      h('strong', null, ev.title),
      h('small', null, `${rangeLabel(ev)} · ${whenLabel(ev)}`),
      ev.note ? h('p', { class: 'cal-note' }, ev.note) : null,
      h(
        'div',
        { class: 'msg-actions cal-actions' },
        ideaButton(ev),
        ev.kind === 'mia'
          ? h(
              'button',
              {
                class: 'chip',
                type: 'button',
                onClick: async () => {
                  if (await confirmDialog(`¿Quitar "${ev.title}" del calendario?`, { okLabel: 'Quitar', danger: true })) {
                    const list = store.get('fechas');
                    const i = list.findIndex((x) => x.id === ev.id);
                    if (i >= 0) list.splice(i, 1);
                    store.save('fechas');
                    refresh();
                  }
                },
              },
              '🗑 Quitar'
            )
          : null
      )
    )
  );
}

export function renderCalendar(panel) {
  let horizon = 180;
  let hideCommercial = false;
  const list = h('ul', { class: 'list-plain cal-list' });
  const horizons = h('div', { class: 'chips' });

  function renderList() {
    const evs = eventsBetween(todayISO(), horizon).filter((ev) => !(hideCommercial && ev.kind === 'comercial'));
    horizons.replaceChildren(
      ...HORIZONS.map(([d, label]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(d === horizon), onClick: () => { horizon = d; renderList(); } }, `Próximos ${label}`)),
      h('button', { class: 'chip', type: 'button', 'aria-pressed': String(hideCommercial), title: 'Oculta San Valentín, Día de la Madre, Black Friday…', onClick: () => { hideCommercial = !hideCommercial; renderList(); } }, '🛍️ Sin fechas comerciales')
    );
    const nodes = [];
    let month = '';
    for (const ev of evs) {
      const m = parse(ev.date).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
      const label = daysUntil(ev) < 0 ? 'En curso' : m;
      if (label !== month) {
        month = label;
        nodes.push(h('li', { class: 'cal-month' }, label.charAt(0).toUpperCase() + label.slice(1)));
      }
      nodes.push(eventRow(ev, renderList));
    }
    list.replaceChildren(...(nodes.length ? nodes : [h('li', { class: 'note' }, 'No hay fechas en ese período.')]));
  }

  const date = h('input', { type: 'date', 'aria-label': 'Fecha de inicio', value: todayISO() });
  const end = h('input', { type: 'date', 'aria-label': 'Fecha final (opcional)' });
  const title = h('input', { type: 'text', maxlength: 80, placeholder: 'Ej: Aniversario de la agencia', 'aria-label': 'Nombre de la fecha' });
  const note = h('input', { type: 'text', maxlength: 160, placeholder: 'Nota (opcional): oferta, cupos, destino…', 'aria-label': 'Nota' });
  const add = () => {
    if (!title.value.trim() || !date.value) {
      toast('Pon el nombre y la fecha.', 'warn', 2500);
      return;
    }
    if (end.value && end.value < date.value) {
      toast('La fecha final no puede ser antes que la de inicio.', 'warn', 3000);
      return;
    }
    store.get('fechas').push({ id: uid(), date: date.value, end: end.value || undefined, title: title.value.trim(), note: note.value.trim() });
    store.save('fechas');
    title.value = '';
    note.value = '';
    end.value = '';
    toast('Fecha agregada.', 'info', 2000);
    renderList();
  };

  renderList();
  panel.replaceChildren(
    h(
      'header',
      { class: 'panel-head' },
      h('button', { class: 'icon-btn back-btn only-sheet', type: 'button', 'aria-label': 'Volver a la oficina', onClick: () => go('#/') }, '←'),
      h('span', { class: 'avatar avatar-icon' }, '📅'),
      h('div', { class: 'panel-title' }, h('strong', null, 'Fechas para vender'), h('span', null, 'Feriados, puentes y temporadas de Venezuela'))
    ),
    h(
      'div',
      { class: 'panel-body' },
      h('p', { class: 'note' }, '📣 Tus agentes ven las fechas de las próximas semanas y las usan al proponer contenido. Los feriados son los de ley; el gobierno a veces mueve días o decreta extras, y las vacaciones escolares son aproximadas: confirma siempre con el anuncio oficial.'),
      h('div', { class: 'mt-4' }, horizons),
      h('div', { class: 'mt-4' }, list),
      h(
        'form',
        {
          class: 'team-card mt-5',
          onSubmit: (e) => {
            e.preventDefault();
            add();
          },
        },
        h('strong', null, '⭐ Agregar una fecha mía'),
        h('div', { class: 'field mt-3' }, h('label', null, 'Nombre'), title),
        h('div', { class: 'cal-dates' }, h('div', { class: 'field' }, h('label', null, 'Desde'), date), h('div', { class: 'field' }, h('label', null, 'Hasta (opcional)'), end)),
        h('div', { class: 'field' }, h('label', null, 'Nota'), note),
        h('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, 'Agregar al calendario')
      )
    )
  );
  return () => {};
}
