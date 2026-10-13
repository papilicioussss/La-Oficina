// Cálculos de métricas (sin interfaz) para el registro manual de publicaciones.

export const NETWORKS = { instagram: 'Instagram', tiktok: 'TikTok' };

export const FORMATS = {
  instagram: ['Reel', 'Carrusel', 'Post', 'Stories'],
  tiktok: ['Video', 'Carrusel de fotos', 'Live'],
};

export const NUMERIC_FIELDS = [
  { key: 'vistas', label: 'Vistas / reproducciones' },
  { key: 'alcance', label: 'Alcance (cuentas alcanzadas)' },
  { key: 'likes', label: 'Me gusta' },
  { key: 'comentarios', label: 'Comentarios' },
  { key: 'compartidos', label: 'Compartidos / envíos' },
  { key: 'guardados', label: 'Guardados' },
  { key: 'seguidores', label: 'Seguidores ganados' },
  { key: 'visitasPerfil', label: 'Visitas al perfil' },
  { key: 'tiempoPromedio', label: 'Tiempo promedio de visualización (seg)' },
  { key: 'retencion', label: '% que vio completo / retención' },
  { key: 'consultas', label: 'Consultas por WhatsApp/DM que trajo' },
];

const num = (v) => (Number.isFinite(+v) && v !== '' && v !== null ? +v : null);

/** Base para tasas: alcance si existe, si no, vistas. */
export function base(p) {
  return num(p.alcance) || num(p.vistas) || null;
}

export function rates(p) {
  const b = base(p);
  const inter = (num(p.likes) || 0) + (num(p.comentarios) || 0) + (num(p.compartidos) || 0) + (num(p.guardados) || 0);
  return {
    interaccion: b ? inter / b : null,
    guardados: b && num(p.guardados) != null ? num(p.guardados) / b : null,
    compartidos: b && num(p.compartidos) != null ? num(p.compartidos) / b : null,
    consultas: b && num(p.consultas) != null ? num(p.consultas) / b : null,
  };
}

const avg = (arr) => {
  const v = arr.filter((x) => Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export function filterPosts(posts, { red = 'todas', dias = 0 } = {}) {
  const since = dias ? Date.now() - dias * 86400000 : 0;
  return posts
    .filter((p) => red === 'todas' || p.red === red)
    .filter((p) => !since || new Date(p.fecha + 'T12:00:00').getTime() >= since)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

export function summary(posts) {
  const r = posts.map(rates);
  const consultas = posts.map((p) => num(p.consultas)).filter((x) => x != null);
  return {
    count: posts.length,
    vistas: avg(posts.map((p) => num(p.vistas))),
    interaccion: avg(r.map((x) => x.interaccion)),
    guardados: avg(r.map((x) => x.guardados)),
    compartidos: avg(r.map((x) => x.compartidos)),
    consultasTotal: consultas.length ? consultas.reduce((a, b) => a + b, 0) : null,
  };
}

const pct = (x) => (Number.isFinite(x) ? (x * 100).toFixed(1) + '%' : 's/d');
const n = (x) => (Number.isFinite(x) ? Math.round(x) : 's/d');

/** Resumen en texto para dárselo al agente Analista. */
export function digest(posts, { limit = 25 } = {}) {
  if (!posts.length) return '';
  const s = summary(posts);
  const sorted = [...posts].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const top = [...posts]
    .filter((p) => rates(p).interaccion != null)
    .sort((a, b) => rates(b).interaccion - rates(a).interaccion)
    .slice(0, 3);
  const lines = [
    `Publicaciones registradas: ${s.count} (del ${posts[0].fecha} al ${posts[posts.length - 1].fecha}).`,
    `Promedios → vistas: ${n(s.vistas)} · interacción: ${pct(s.interaccion)} · guardados: ${pct(s.guardados)} · compartidos: ${pct(s.compartidos)} · consultas WhatsApp/DM (total): ${s.consultasTotal ?? 's/d'}.`,
  ];
  if (top.length) {
    lines.push(
      'Top por interacción: ' +
        top.map((p) => `${p.fecha} ${p.red}/${p.formato} "${p.tema || 'sin tema'}" (${pct(rates(p).interaccion)})`).join('; ') +
        '.'
    );
  }
  lines.push('', `Detalle (más recientes primero, máx. ${limit}) — tasas calculadas sobre alcance o vistas:`);
  lines.push('fecha,red,formato,tema,vistas,alcance,likes,coment,compart,guard,seguid,visitas_perfil,tiempo_prom_s,retencion_%,consultas,interaccion,notas');
  for (const p of sorted.slice(0, limit)) {
    const r = rates(p);
    lines.push(
      [
        p.fecha,
        p.red,
        p.formato,
        JSON.stringify(p.tema || ''),
        p.vistas ?? '',
        p.alcance ?? '',
        p.likes ?? '',
        p.comentarios ?? '',
        p.compartidos ?? '',
        p.guardados ?? '',
        p.seguidores ?? '',
        p.visitasPerfil ?? '',
        p.tiempoPromedio ?? '',
        p.retencion ?? '',
        p.consultas ?? '',
        pct(r.interaccion),
        JSON.stringify(p.notas || ''),
      ].join(',')
    );
  }
  return lines.join('\n');
}
