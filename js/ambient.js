// Vida ambiental: gestos y paseos decorativos de los agentes cuando están libres (tomar café, llamar por teléfono,
// estirarse, mirar alrededor, teclear un rato o pasear por su oficina).
//
// Regla de oro: NO son trabajo. Solo ocurren con el agente en reposo (estado "idle") y en su oficina; en cuanto
// pasa algo real (pensar, buscar, reunión, hablar) se cortan al instante y el agente muestra su estado verdadero.
// Se pueden apagar en Configuración → Equipo ("Vida ambiental"), y se desactivan con "reducir movimiento".

import * as store from './store.js';
import { AGENT_IDS } from './store.js';
import { runtime, on } from './state.js';
import { ambientApi } from './office.js';

const ARM = { r: [9.8, -25.5], l: [-9.8, -25.5] };
const HAND = [9.8, -12.4];

// Qué le gusta hacer a cada uno (peso relativo)
const WEIGHTS = {
  copy: { typing: 3, coffee: 3, phone: 2, stretch: 1, look: 1, stroll: 3 },
  analista: { typing: 4, coffee: 2, phone: 1, stretch: 1, look: 2, stroll: 2 },
  guion: { typing: 2, coffee: 2, phone: 2, stretch: 2, look: 2, stroll: 3 },
};
// Mientras Kike tiene abierta la oficina de ese agente no hace como que trabaja ni pasea.
const NOT_WHEN_OPEN = new Set(['typing', 'phone', 'stroll']);

const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const ambientEnabled = () => store.settings().ambientLife !== false && !reduce();

const acts = new Map(); // id -> { kind, cancelled }
const lastEnd = {};
let timer = 0;

// ---------- Piezas del personaje ----------

function rig(el) {
  if (!el) return null;
  const q = (sel) => el.querySelector(sel);
  return { el, wl: q('.amb-wrap-l'), wr: q('.amb-wrap-r'), face: q('.face'), bob: q('.body-bob'), mug: q('.amb-mug'), phone: q('.amb-phone'), fx: q('.amb-fx'), home: {} };
}

function setArm(p, side, deg) {
  const w = p['w' + side];
  if (!w) return;
  w.setAttribute('transform', deg ? `rotate(${deg.toFixed(1)} ${ARM[side][0]} ${ARM[side][1]})` : '');
  if (side === 'r') for (const prop of [p.mug, p.phone]) prop?.querySelector('.amb-prop-in')?.setAttribute('transform', deg ? `rotate(${(-deg).toFixed(1)} ${HAND[0]} ${HAND[1]})` : '');
}

/** Pasa los brazos por delante del cuerpo (por defecto van detrás) mientras están levantados. */
function armsFront(p, on_) {
  for (const side of ['wl', 'wr']) {
    const w = p[side];
    if (!w || !p.bob) continue;
    if (on_ && !p.home[side]) {
      p.home[side] = w.nextSibling;
      p.bob.append(w);
    } else if (!on_ && p.home[side] !== undefined) {
      p.bob.insertBefore(w, p.home[side]);
      delete p.home[side];
    }
  }
}

const show = (node, on_) => node && (on_ ? node.removeAttribute('display') : node.setAttribute('display', 'none'));
const setLook = (p, dx) => p.face?.setAttribute('transform', dx ? `translate(${dx.toFixed(2)} 0)` : '');
const setLift = (p, px) => {
  if (p.bob) p.bob.style.transform = px ? `translateY(${px.toFixed(2)}px)` : '';
};

/** Deja al personaje exactamente como estaba (sin gestos, sin props). */
function resetRig(p) {
  if (!p) return;
  setArm(p, 'l', 0);
  setArm(p, 'r', 0);
  armsFront(p, false);
  setLook(p, 0);
  setLift(p, 0);
  show(p.mug, false);
  show(p.phone, false);
  show(p.fx, false);
  p.el.classList.remove('amb-talk');
}

// ---------- Motor de animación (cada gesto es una secuencia cancelable) ----------

const frame = () => new Promise((r) => requestAnimationFrame(r));

async function anim(act, ms, fn) {
  const t0 = performance.now();
  for (;;) {
    if (act.cancelled) return false;
    const t = Math.min(1, (performance.now() - t0) / ms);
    fn(ease(t));
    if (t >= 1) return true;
    await frame();
  }
}
const pause = (act, ms) => anim(act, ms, () => {});

const GESTURES = {
  // Teclear un rato: brazos alternando suave, con pausas (más lento y espaciado que el trabajo real)
  async typing(act, p) {
    const end = performance.now() + rand(4200, 7500);
    let l = 0;
    let r = 0;
    while (performance.now() < end && !act.cancelled) {
      const nl = rand(-12, 7);
      const nr = rand(-12, 7);
      const [l0, r0] = [l, r];
      if (!(await anim(act, rand(180, 260), (t) => (setArm(p, 'l', lerp(l0, nl, t)), setArm(p, 'r', lerp(r0, nr, t)))))) return;
      [l, r] = [nl, nr];
      if (Math.random() < 0.18) await pause(act, rand(500, 1100));
    }
  },
  // Tomar café: sube la taza a la boca, dos sorbos y la baja
  async coffee(act, p) {
    show(p.mug, true);
    armsFront(p, true);
    if (!(await anim(act, 650, (t) => setArm(p, 'r', lerp(0, 108, t))))) return;
    for (let i = 0; i < 2; i++) {
      await pause(act, rand(500, 800));
      if (!(await anim(act, 220, (t) => setArm(p, 'r', lerp(108, 96, t))))) return;
      if (!(await anim(act, 260, (t) => setArm(p, 'r', lerp(96, 108, t))))) return;
    }
    await pause(act, 500);
    await anim(act, 600, (t) => setArm(p, 'r', lerp(108, 0, t)));
  },
  // Llamada: suena el teléfono, lo contesta y habla un rato
  async phone(act, p) {
    show(p.fx, true);
    for (let i = 0; i < 3; i++) {
      if (!(await anim(act, 160, (t) => p.fx.setAttribute('transform', `translate(0,-82) rotate(${(Math.sin(t * Math.PI * 4) * 14).toFixed(1)})`)))) return;
      await pause(act, 140);
    }
    show(p.phone, true);
    armsFront(p, true);
    if (!(await anim(act, 520, (t) => setArm(p, 'r', lerp(0, -176, t))))) return;
    p.el.classList.add('amb-talk');
    const end = performance.now() + rand(4500, 7500);
    while (performance.now() < end && !act.cancelled) {
      await anim(act, rand(500, 900), (t) => (setArm(p, 'r', -176 + Math.sin(t * Math.PI) * 4), setLook(p, Math.sin(t * Math.PI) * -1.2)));
    }
    p.el.classList.remove('amb-talk');
    show(p.fx, false);
    await anim(act, 520, (t) => setArm(p, 'r', lerp(-176, 0, t)));
  },
  // Estirarse: brazos arriba y un pequeño empujón hacia arriba
  async stretch(act, p) {
    armsFront(p, true);
    if (!(await anim(act, 750, (t) => (setArm(p, 'l', lerp(0, 172, t)), setArm(p, 'r', lerp(0, -172, t)), setLift(p, -2.4 * t))))) return;
    await pause(act, 1000);
    await anim(act, 650, (t) => (setArm(p, 'l', lerp(172, 0, t)), setArm(p, 'r', lerp(-172, 0, t)), setLift(p, -2.4 * (1 - t))));
  },
  // Mirar alrededor
  async look(act, p) {
    for (const dx of [-1.9, 1.9, -1, 0]) {
      const from = Number(/translate\(([-\d.]+)/.exec(p.face?.getAttribute('transform') || '')?.[1] || 0);
      if (!(await anim(act, 380, (t) => setLook(p, lerp(from, dx, t))))) return;
      await pause(act, rand(500, 900));
    }
  },
};

async function runGesture(id, kind) {
  const p = rig(ambientApi.el(id));
  if (!p) return false;
  const act = { kind, cancelled: false };
  acts.set(id, act);
  try {
    if (kind === 'stroll') {
      const spots = ambientApi.spots(id);
      const spot = spots[Math.floor(Math.random() * spots.length)];
      act.stroll = true;
      const r = await ambientApi.stroll(id, spot, { hold: rand(3200, 5500), onArrive: () => !act.cancelled && GESTURES.look(act, p) });
      return r !== 'skipped';
    }
    await GESTURES[kind](act, p);
    return true;
  } finally {
    act.cancelled = true;
    resetRig(p);
    if (acts.get(id) === act) acts.delete(id);
    lastEnd[id] = performance.now();
  }
}

/** Corta lo que esté haciendo ese agente (o todos). */
export function stopAmbient(id, mode = 'cut') {
  for (const key of id ? [id] : AGENT_IDS) {
    const act = acts.get(key);
    if (act) {
      if (mode === 'cut') act.cancelled = true;
      if (act.stroll) ambientApi.stop(key, mode);
      if (mode === 'cut') {
        resetRig(rig(ambientApi.el(key)));
      }
    } else if (ambientApi.strolling(key)) ambientApi.stop(key, mode);
  }
}

// ---------- Quién hace qué y cuándo ----------

function eligible(id) {
  return runtime.status[id] === 'idle' && runtime.location[id] === 'office' && !acts.has(id) && performance.now() - (lastEnd[id] ?? -1e9) > 7000;
}

function pickKind(id) {
  const open = ambientApi.activeRoom() === id;
  const strolling = AGENT_IDS.some((k) => acts.get(k)?.stroll);
  const w = Object.entries(WEIGHTS[id]).filter(([k]) => !(open && NOT_WHEN_OPEN.has(k)) && !(k === 'stroll' && strolling));
  let n = Math.random() * w.reduce((a, [, v]) => a + v, 0);
  for (const [k, v] of w) if ((n -= v) < 0) return k;
  return w[0]?.[0] || 'look';
}

function tick() {
  if (document.hidden || !ambientEnabled() || acts.size >= 2) return;
  const ids = AGENT_IDS.filter(eligible);
  if (!ids.length) return;
  const id = ids[Math.floor(Math.random() * ids.length)];
  runGesture(id, pickKind(id));
}

function loop(first = false) {
  clearTimeout(timer);
  timer = setTimeout(
    () => {
      try {
        tick();
      } finally {
        loop();
      }
    },
    first ? rand(1500, 3000) : rand(2500, 5500)
  );
}

export function startAmbient() {
  // Cualquier trabajo real corta los gestos al instante: el agente muestra su estado verdadero.
  on('status', ({ id, status }) => {
    lastEnd[id] = performance.now(); // tras un trabajo real, un rato de calma antes de cualquier gesto
    if (status !== 'idle') stopAmbient(id, 'cut');
  });
  // Al abrir la oficina de un agente, si estaba paseando vuelve rápido a su silla.
  on('room', (room) => {
    if (AGENT_IDS.includes(room)) {
      const act = acts.get(room);
      if (act?.stroll) stopAmbient(room, 'hurry');
      else if (act && NOT_WHEN_OPEN.has(act.kind)) stopAmbient(room, 'cut');
    }
  });
  // Cambios de apariencia o nombres reconstruyen la escena: se empieza de cero.
  on('agents-changed', () => stopAmbient(null, 'cut'));
  on('ambient-changed', () => {
    if (!ambientEnabled()) stopAmbient(null, 'cut');
  });
  document.addEventListener('visibilitychange', () => document.hidden && stopAmbient(null, 'cut'));
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => !ambientEnabled() && stopAmbient(null, 'cut'));
  loop(true);
}

/** Solo para pruebas automáticas. */
export const ambientTest = {
  run: (id, kind) => runGesture(id, kind),
  stop: (id, mode) => stopAmbient(id, mode),
  active: () => [...acts].map(([id, a]) => ({ id, kind: a.kind })),
  pause: () => clearTimeout(timer),
  tick,
};
