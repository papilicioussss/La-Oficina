// Búsqueda web con Tavily (directo o a través de un proxy opcional).

export class SearchUnavailable extends Error {
  constructor(message) {
    super(message);
    this.name = 'SearchUnavailable';
  }
}

export class SearchError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'SearchError';
    this.status = status;
  }
}

const PERIODS = { semana: 'week', mes: 'month', 'año': 'year', anio: 'year', dia: 'day', 'día': 'day' };

export function toTimeRange(periodo) {
  return PERIODS[String(periodo || '').toLowerCase()] || undefined;
}

export async function tavilySearch({ key, proxy, query, timeRange, domains, maxResults = 5, depth = 'basic', signal }) {
  const base = (proxy || 'https://api.tavily.com').replace(/\/+$/, '');
  const body = {
    query,
    search_depth: depth,
    max_results: maxResults,
    include_answer: false,
  };
  if (timeRange) body.time_range = timeRange;
  if (domains?.length) body.include_domains = domains;

  let res;
  try {
    res = await fetch(`${base}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new SearchUnavailable(
      proxy
        ? 'No pude conectar con tu proxy de Tavily. Revisa la URL en Configuración.'
        : 'No pude conectar con Tavily desde el navegador (puede ser bloqueo CORS o falta de internet).'
    );
  }
  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.detail?.error || j?.error || '';
    } catch {
      /* sin cuerpo */
    }
    if (res.status === 401) throw new SearchError('Tu API key de Tavily no es válida. Revísala en Configuración.', 401);
    if (res.status === 429) throw new SearchError('Tavily dice que vas muy rápido. Espera un momento.', 429);
    if (res.status === 432 || res.status === 433) {
      throw new SearchError('Se acabaron tus créditos gratis de Tavily de este mes.', res.status);
    }
    throw new SearchError(`Tavily respondió con error ${res.status}. ${detail}`.trim(), res.status);
  }
  const j = await res.json();
  return (j.results || []).map((r) => ({
    title: r.title || r.url,
    url: r.url,
    content: (r.content || '').replace(/\s+/g, ' ').slice(0, 600),
    date: r.published_date || '',
  }));
}
