// Prueba de coherencia: compara oficina-3d/plano.js con los datos de js/office.js.
// Lee office.js como TEXTO (solo lectura): no lo importa ni ejecuta la app.
// Uso:  node oficina-3d/pruebas/coherencia.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const fuente = readFileSync(join(aqui, '../../js/office.js'), 'utf8');
const plano = await import(join(aqui, '../plano.js'));

/** Extrae el literal de `const NOMBRE = ...;` (objeto o arreglo) y lo evalúa como dato. */
function literal(nombre) {
  const ini = fuente.indexOf(`const ${nombre} = `);
  if (ini < 0) throw new Error(`No encontré ${nombre} en office.js`);
  let i = fuente.indexOf('=', ini) + 1;
  while (/\s/.test(fuente[i])) i++;
  const abre = fuente[i];
  const cierra = abre === '{' ? '}' : ']';
  let nivel = 0;
  let j = i;
  for (; j < fuente.length; j++) {
    if (fuente[j] === abre) nivel++;
    else if (fuente[j] === cierra && --nivel === 0) break;
  }
  let txt = fuente.slice(i, j + 1);
  // OBSTACLES termina con los tabiques calculados: se compara solo la parte literal
  txt = txt.replace(/\.\.\.PARTITIONS\.map\([\s\S]*?\)\),?/, '');
  return new Function(`return (${txt});`)();
}

const casos = [
  ['ROOM_AREA', plano.ROOM_AREA],
  ['ROOM_TINT', plano.ROOM_TINT],
  ['SEATS', plano.SEATS],
  ['MEET', plano.MEET],
  ['ROUTES', plano.ROUTES],
  ['BOSS_SPOTS', plano.BOSS_SPOTS],
  ['PARTITIONS', plano.PARTITIONS],
  ['OBSTACLES', plano.MUEBLES_OBSTACULOS],
  ['CAT_PERCH', plano.CAT_PERCH],
  ['AMB_EXIT', plano.AMB_EXIT],
  ['AMB_SPOTS', plano.AMB_SPOTS],
  ['FOCUS', plano.FOCUS],
];

let fallos = 0;
const ok = (msg) => console.log('OK  ', msg);
const mal = (msg) => {
  fallos++;
  console.log('FAIL', msg);
};

for (const [nombre, copia] of casos) {
  const original = literal(nombre);
  const a = JSON.stringify(original);
  const b = JSON.stringify(copia);
  if (a === b) ok(`${nombre} coincide con office.js`);
  else mal(`${nombre} difiere de office.js\n     office.js: ${a.slice(0, 300)}\n     plano.js:  ${b.slice(0, 300)}`);
}

// Las alfombras del SVG (staticScene) deben coincidir
const rugs = [...fuente.matchAll(/rug\(([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+),/g)].map((m) => m.slice(1, 5).map(Number));
const mias = plano.ALFOMBRAS.map((r) => r.rect);
if (JSON.stringify(rugs) === JSON.stringify(mias)) ok('ALFOMBRAS coinciden con office.js');
else mal(`ALFOMBRAS difieren: ${JSON.stringify(rugs)} vs ${JSON.stringify(mias)}`);

// Cada huella de mueble del plano 3D debe ser una huella del SVG (mismas coordenadas)
const huellasSvg = new Set(plano.MUEBLES_OBSTACULOS.map((h) => h.join(',')));
for (const m of plano.MUEBLES.filter((m) => m.huella)) {
  const dentro = [...huellasSvg].some((h) => {
    const [a, b, c, d] = h.split(',').map(Number);
    const [x1, y1, x2, y2] = m.huella;
    return x1 >= a - 1e-6 && y1 >= b - 1e-6 && x2 <= c + 1e-6 && y2 <= d + 1e-6;
  });
  if (!dentro) mal(`El mueble ${m.modelo} de ${m.sala} no está dentro de ninguna huella del SVG: ${m.huella}`);
}
ok('las huellas de los muebles están dentro de las huellas del SVG');

// Puertas: cada puerta es exactamente un hueco entre dos tabiques del mismo eje y coordenada
for (const p of plano.PUERTAS) {
  const tramos = plano.PARTITIONS.filter(([eje, en]) => eje === p.eje && en === p.en);
  const antes = tramos.some(([, , , hasta]) => hasta === p.desde);
  const despues = tramos.some(([, , desde]) => desde === p.hasta);
  const tapada = tramos.some(([, , desde, hasta]) => desde < p.hasta && hasta > p.desde);
  if (antes && despues && !tapada) ok(`puerta ${p.id}: hueco libre de ${p.desde} a ${p.hasta}`);
  else mal(`puerta ${p.id} no corresponde a un hueco de los tabiques`);
}

// Las rutas de los agentes pasan por las puertas (no atraviesan tabiques)
function cruzaTabique([ax, ay], [bx, by]) {
  for (const [eje, en, desde, hasta] of plano.PARTITIONS) {
    const [p, q, r, s] = eje === 'x' ? [ax, bx, ay, by] : [ay, by, ax, bx];
    if ((p - en) * (q - en) >= 0) continue;
    const t = (en - p) / (q - p);
    const cruce = r + (s - r) * t;
    if (cruce > desde && cruce < hasta) return true;
  }
  return false;
}
for (const [id, ruta] of Object.entries(plano.ROUTES)) {
  const puntos = [plano.SEATS[id], ...ruta, plano.MEET[id]];
  const malos = puntos.slice(1).filter((pt, i) => cruzaTabique(puntos[i], pt));
  if (malos.length) mal(`la ruta de ${id} atraviesa un tabique`);
  else ok(`la ruta de ${id} a la sala de juntas pasa por puertas`);
}

console.log(fallos ? `\n${fallos} diferencia(s)` : '\nTodo coincide.');
process.exit(fallos ? 1 : 0);
