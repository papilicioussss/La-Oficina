// Calendario de fechas para vender turismo en Venezuela: feriados, fines de semana largos, posibles puentes,
// vacaciones escolares (aproximadas), fechas comerciales y las fechas propias de Kike.
// Todo se calcula aquí, sin internet. Los feriados son los de ley; el gobierno a veces mueve días o decreta extras,
// por eso la app siempre pide confirmar con el anuncio oficial.

import * as store from './store.js';

const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const mk = (y, m, d) => new Date(y, m, d, 12); // mediodía local: evita saltos por zona horaria
export const iso = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
export const parse = (s) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return mk(y, m - 1, d);
};
const addDays = (dt, n) => mk(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / DAY);

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher). */
export function easter(y) {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const hh = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - hh - k) % 7;
  const m = Math.floor((a + 11 * hh + 22 * l) / 451);
  const month = Math.floor((hh + l - 7 * m + 114) / 31);
  const day = ((hh + l - 7 * m + 114) % 31) + 1;
  return mk(y, month - 1, day);
}

/** n-ésimo día de la semana (0=domingo) de un mes (month 0-11). */
function nthWeekday(y, month, weekday, n) {
  const first = mk(y, month, 1);
  const shift = (weekday - first.getDay() + 7) % 7;
  return mk(y, month, 1 + shift + (n - 1) * 7);
}

/** Feriados oficiales (días no laborables por ley) de un año: [{date, name}] */
function officialHolidays(y) {
  const e = easter(y);
  const list = [
    [mk(y, 0, 1), 'Año Nuevo'],
    [addDays(e, -48), 'Carnaval (lunes)'],
    [addDays(e, -47), 'Carnaval (martes)'],
    [addDays(e, -3), 'Jueves Santo'],
    [addDays(e, -2), 'Viernes Santo'],
    [mk(y, 3, 19), 'Declaración de la Independencia'],
    [mk(y, 4, 1), 'Día del Trabajador'],
    [mk(y, 5, 24), 'Batalla de Carabobo'],
    [mk(y, 6, 5), 'Día de la Independencia'],
    [mk(y, 6, 24), 'Natalicio del Libertador'],
    [mk(y, 9, 12), 'Día de la Resistencia Indígena'],
    [mk(y, 11, 24), 'Nochebuena'],
    [mk(y, 11, 25), 'Navidad'],
    [mk(y, 11, 31), 'Fin de Año'],
  ];
  return list.map(([dt, name]) => ({ date: iso(dt), name }));
}

const isWeekend = (dt) => dt.getDay() === 0 || dt.getDay() === 6;
const dow = (dt) => ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][dt.getDay()];

function groupName(names) {
  const has = (t) => names.some((n) => n.startsWith(t));
  if (has('Carnaval')) return 'Carnaval';
  if (has('Jueves Santo') || has('Viernes Santo')) return 'Semana Santa';
  if (names.length > 1 && has('Nochebuena')) return 'Navidad';
  if (names.length > 1 && has('Fin de Año') && has('Año Nuevo')) return 'Fin de Año y Año Nuevo';
  return names.join(' + ');
}

/** Agrupa los feriados seguidos y les suma los fines de semana pegados: fines de semana largos y posibles puentes. */
function holidayEvents(years) {
  const all = years.flatMap(officialHolidays).sort((a, b) => (a.date < b.date ? -1 : 1));
  const blocks = [];
  for (const hd of all) {
    const last = blocks.at(-1);
    if (last && diffDays(last.at(-1).date, hd.date) === 1) last.push(hd);
    else blocks.push([hd]);
  }
  const out = [];
  for (const b of blocks) {
    const names = b.map((x) => x.name);
    const name = groupName(names);
    let s = parse(b[0].date);
    let e = parse(b.at(-1).date);
    while (isWeekend(addDays(s, -1))) s = addDays(s, -1);
    while (isWeekend(addDays(e, 1))) e = addDays(e, 1);
    const total = diffDays(iso(s), iso(e)) + 1;
    const holidays = b.map((x) => parse(x.date)).map((dt) => `${dow(dt)} ${dt.getDate()}`).join(', ');
    if (total >= 3) {
      out.push({
        date: iso(s),
        end: iso(e),
        kind: 'finde',
        title: `Fin de semana largo: ${name}`,
        note: `${total} días seguidos (${dow(s)} a ${dow(e)}). Feriados: ${holidays}. Ideal para salidas de 2–3 días.`,
      });
    } else {
      const dt = parse(b[0].date);
      const puente = b.length === 1 && (dt.getDay() === 2 || dt.getDay() === 4);
      out.push({
        date: b[0].date,
        end: b.at(-1).date === b[0].date ? undefined : b.at(-1).date,
        kind: puente ? 'puente' : 'feriado',
        title: puente ? `Feriado con posible puente: ${name}` : `Feriado: ${name}`,
        note: puente
          ? `Cae en ${dow(dt)}: mucha gente se toma el ${dt.getDay() === 2 ? 'lunes' : 'viernes'} para hacer puente (no es oficial, confirma). Buen momento para un full day o salida larga.`
          : `Día no laborable (${holidays}).`,
      });
    }
  }
  return out;
}

function commercialEvents(y) {
  const thanks = nthWeekday(y, 10, 4, 4); // 4.º jueves de noviembre
  return [
    { date: iso(mk(y, 1, 14)), title: 'San Valentín', note: 'Escapadas en pareja, salidas románticas.' },
    { date: iso(mk(y, 2, 8)), title: 'Día Internacional de la Mujer', note: 'Viajes para ellas, grupos de amigas.' },
    { date: iso(nthWeekday(y, 4, 0, 2)), title: 'Día de la Madre', note: 'Regalo de experiencia: viaje o full day para mamá.' },
    { date: iso(nthWeekday(y, 5, 0, 3)), title: 'Día del Padre', note: 'Regalo de experiencia: salida para papá.' },
    { date: iso(nthWeekday(y, 6, 0, 3)), title: 'Día del Niño', note: 'Salidas familiares y con niños.' },
    { date: iso(mk(y, 8, 27)), title: 'Día Mundial del Turismo', note: 'Contenido de marca, destinos y equipo.' },
    { date: iso(addDays(thanks, 1)), title: 'Black Friday', note: 'Ofertas relámpago y cupos con descuento.' },
    { date: iso(addDays(thanks, 4)), title: 'Cyber Monday', note: 'Última ronda de ofertas antes de diciembre.' },
  ].map((x) => ({ ...x, kind: 'comercial' }));
}

function schoolEvents(y) {
  return [
    { date: iso(mk(y, 6, 15)), end: iso(mk(y, 8, 14)), kind: 'escolar', title: 'Vacaciones escolares (aprox.)', note: 'Fechas aproximadas: confirma el calendario escolar del año. Temporada alta para familias.' },
    { date: iso(mk(y, 11, 20)), end: iso(mk(y + 1, 0, 6)), kind: 'escolar', title: 'Vacaciones de Navidad (aprox.)', note: 'Fechas aproximadas: confirma el calendario escolar. Mucha gente viaja y visita familia.' },
  ];
}

const cache = new Map();
function builtIn(year) {
  if (!cache.has(year)) {
    const years = [year - 1, year, year + 1];
    cache.set(year, [...holidayEvents(years), ...years.flatMap(commercialEvents), ...years.flatMap(schoolEvents)]);
  }
  return cache.get(year);
}

export function customDates() {
  return store.get('fechas');
}

/** Todas las fechas que tocan la ventana [from, from+days]. from = 'YYYY-MM-DD'. */
export function eventsBetween(from, days = 90) {
  const y = parse(from).getFullYear();
  const to = iso(addDays(parse(from), days));
  const mine = customDates().map((x) => ({ ...x, kind: 'mia' }));
  const seen = new Set();
  return [...builtIn(y), ...builtIn(y + 1), ...mine]
    .filter((ev) => (ev.end || ev.date) >= from && ev.date <= to)
    .filter((ev) => {
      const k = `${ev.date}|${ev.title}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.end || '') < (b.end || '') ? -1 : 1));
}

export const todayISO = () => iso(new Date());

/** Cuántos días faltan para el inicio (0 = hoy; negativo = ya empezó). */
export const daysUntil = (ev, from = todayISO()) => diffDays(from, ev.date);

export function rangeLabel(ev) {
  const f = (s) => parse(s).toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
  return ev.end && ev.end !== ev.date ? `${f(ev.date)} → ${f(ev.end)}` : f(ev.date);
}

export function whenLabel(ev, from = todayISO()) {
  const n = daysUntil(ev, from);
  if (n < 0) return 'En curso';
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n < 14) return `En ${n} días`;
  if (n < 60) return `En ${Math.round(n / 7)} semanas`;
  return `En ${Math.round(n / 30)} meses`;
}

export const KIND_META = {
  finde: { icon: '🏖️', label: 'Fin de semana largo' },
  feriado: { icon: '🇻🇪', label: 'Feriado' },
  puente: { icon: '🌉', label: 'Posible puente' },
  escolar: { icon: '🎒', label: 'Vacaciones' },
  comercial: { icon: '🛍️', label: 'Fecha comercial' },
  mia: { icon: '⭐', label: 'Mía' },
};

/** Texto corto para el prompt de los agentes: lo que viene en las próximas semanas. */
export function calendarPrompt(days = 45, max = 6) {
  const from = todayISO();
  const evs = eventsBetween(from, days)
    .filter((ev) => ev.kind !== 'escolar' || daysUntil(ev, from) <= days)
    .slice(0, max);
  if (!evs.length) return '';
  const lines = evs.map((ev) => `- ${rangeLabel(ev)}: ${ev.title} (${whenLabel(ev, from).toLowerCase()})${ev.note && ev.kind === 'mia' ? ` — ${ev.note}` : ''}`);
  return `## Fechas cercanas (calendario de Venezuela)\nÚsalas para proponer salidas, ofertas y contenido con tiempo. Son fechas de referencia: si dependen de un anuncio oficial, dilo.\n${lines.join('\n')}`;
}
