// Proxy mínimo para usar Tavily desde el navegador (Cloudflare Workers, plan gratis).
// Solo hace falta si la app dice que no puede conectar con Tavily directo.
// Paso a paso en el README → "Proxy de Tavily".

// Orígenes que pueden usar este proxy (tu GitHub Pages y, si quieres, tu compu local).
const ALLOWED_ORIGINS = ['https://papilicioussss.github.io', 'http://localhost:8123'];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const { pathname } = new URL(request.url);
    if (request.method !== 'POST' || !['/search', '/extract'].includes(pathname)) {
      return new Response('No encontrado', { status: 404, headers: cors });
    }
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response('Origen no permitido', { status: 403, headers: cors });
    }

    // Si guardaste la key como secreto TAVILY_API_KEY en Cloudflare, se usa esa;
    // si no, se reenvía la que manda la app.
    const auth = env.TAVILY_API_KEY ? `Bearer ${env.TAVILY_API_KEY}` : request.headers.get('Authorization');
    const upstream = await fetch('https://api.tavily.com' + pathname, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
      body: await request.text(),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' },
    });
  },
};
