const STORAGE = {
  anon: 'magicdust.telemetry.anon',
  studentId: 'magicdust.telemetry.studentId',
  studentName: 'magicdust.telemetry.studentName',
  classId: 'magicdust.telemetry.classId',
  queue: 'magicdust.telemetry.queue',
  deployVersion: 'magicdust.deploy.version',
};

const SESSION_KEY = 'magicdust.telemetry.session';
const MAX_QUEUE = 200;
const FLUSH_MS = 2500;

const canStore = () => typeof localStorage !== 'undefined' && typeof sessionStorage !== 'undefined';
const isBrowser = () => typeof window !== 'undefined' && typeof location !== 'undefined';
const isLocalHost = () => isBrowser() && /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(location.hostname);

function uid(prefix) {
  const cryptoApi = globalThis.crypto;
  const id = cryptoApi?.randomUUID ? cryptoApi.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

function param(names) {
  if (!isBrowser()) return '';
  const qs = new URLSearchParams(location.search);
  for (const name of names) {
    const value = (qs.get(name) || '').trim();
    if (value) return value;
  }
  return '';
}

function read(key) {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

function write(key, value) {
  try { if (value) localStorage.setItem(key, value); } catch { /* telemetry only */ }
}

export function cellKind(cfg = {}) {
  if (cfg.ritual) return 'ritual';
  if (cfg.forge) return 'forge';
  if (cfg.boss) return 'boss';
  if (cfg.quiz) return 'quiz';
  if (cfg.walkthrough) return 'walkthrough';
  if (cfg.programCounter) return 'program_counter';
  if (cfg.execution) return 'guided_execution';
  if (cfg.code !== undefined) return 'code';
  if (cfg.checkpoint) return 'checkpoint';
  if (cfg.gift) return 'gift';
  if (cfg.widget) return 'widget';
  if (cfg.cameo) return 'cameo';
  if (cfg.intro) return 'intro';
  if (cfg.remember) return 'remember';
  if (cfg.npc !== undefined) return 'npc';
  return 'unknown';
}

export function cellLabel(cfg = {}, index = 0) {
  return cfg.label || cfg.quiz?.title || cfg.forge?.title || cfg.boss?.name || cfg.gift?.name || cfg.checkpoint?.sign || cfg.intro?.title || `${cellKind(cfg)}-${index}`;
}

export function courseId(N = {}) {
  if (N.sideIslandId === 'tower') return 'tower:endless';
  if (N.sideIslandId) return `island:${N.sideIslandId}`;
  if (N.index === -1) return 'tower:endless';
  return `node:${N.index ?? 'unknown'}`;
}

function courseKind(N = {}) {
  if (N.sideIslandId === 'tower') return 'tower';
  if (N.sideIslandId) return 'island';
  if (N.index === -1) return 'tower';
  return 'node';
}

function identity() {
  if (!isBrowser() || !canStore()) return {};
  const fromUrl = {
    studentId: param(['sid', 'student', 'student_id']),
    studentName: param(['name', 'student_name']),
    classId: param(['class', 'class_id', 'cohort']),
  };
  if (fromUrl.studentId) write(STORAGE.studentId, fromUrl.studentId);
  if (fromUrl.studentName) write(STORAGE.studentName, fromUrl.studentName);
  if (fromUrl.classId) write(STORAGE.classId, fromUrl.classId);
  let anon = read(STORAGE.anon);
  if (!anon) { anon = uid('anon'); write(STORAGE.anon, anon); }
  let sessionId = '';
  try {
    sessionId = sessionStorage.getItem(SESSION_KEY) || '';
    if (!sessionId) { sessionId = uid('sess'); sessionStorage.setItem(SESSION_KEY, sessionId); }
  } catch { sessionId = uid('sess'); }
  return {
    studentId: read(STORAGE.studentId) || anon,
    studentName: read(STORAGE.studentName),
    classId: read(STORAGE.classId),
    anonId: anon,
    sessionId,
  };
}

function version() {
  if (!isBrowser()) return '';
  return new URLSearchParams(location.search).get('v') || read(STORAGE.deployVersion);
}

function endpoint() {
  if (!isBrowser()) return '';
  return `${location.origin}/api/magic-dust/telemetry`;
}

function loadQueue() {
  try { return JSON.parse(localStorage.getItem(STORAGE.queue) || '[]'); } catch { return []; }
}

function saveQueue(events) {
  try { localStorage.setItem(STORAGE.queue, JSON.stringify(events.slice(-MAX_QUEUE))); } catch { /* telemetry only */ }
}

let currentCourse = {};
let flushTimer = null;
const shownAt = new Map();

export const telemetry = {
  configureCourse(N) {
    currentCourse = {
      courseId: courseId(N),
      courseKind: courseKind(N),
      nodeIndex: Number.isInteger(N.index) ? N.index : null,
      nodeTitle: N.title || '',
      sideIslandId: N.sideIslandId || '',
      totalCells: Array.isArray(N.cells) ? N.cells.length : 0,
    };
  },

  track(eventType, data = {}) {
    if (!isBrowser() || !canStore()) return;
    const event = {
      id: uid('evt'),
      eventType,
      createdAt: new Date().toISOString(),
      href: location.href,
      path: location.pathname,
      version: version(),
      ...identity(),
      ...currentCourse,
      ...data,
    };
    saveQueue([...loadQueue(), event]);
    if (!isLocalHost()) {
      clearTimeout(flushTimer);
      flushTimer = setTimeout(() => this.flush(), FLUSH_MS);
    }
  },

  courseStart(N, data = {}) {
    this.configureCourse(N);
    this.track(data.resume ? 'course_resume' : 'course_start', data);
  },

  courseComplete(N, data = {}) {
    this.configureCourse(N);
    this.track('course_complete', data);
    this.flush({ keepalive: true });
  },

  cellShown(N, cfg, index, data = {}) {
    this.configureCourse(N);
    const key = `${courseId(N)}:${index}`;
    shownAt.set(key, performance.now());
    this.track('cell_show', {
      cellIndex: index,
      cellKind: cellKind(cfg),
      cellLabel: String(cellLabel(cfg, index)),
      ...data,
    });
  },

  cellComplete(N, cfg, index, data = {}) {
    this.configureCourse(N);
    const key = `${courseId(N)}:${index}`;
    const start = shownAt.get(key);
    if (start !== undefined) shownAt.delete(key);
    this.track('cell_complete', {
      cellIndex: index,
      cellKind: cellKind(cfg),
      cellLabel: String(cellLabel(cfg, index)),
      durationMs: start === undefined ? null : Math.max(0, Math.round(performance.now() - start)),
      ...data,
    });
  },

  flush({ keepalive = false } = {}) {
    if (!isBrowser() || !canStore() || isLocalHost()) return;
    const events = loadQueue();
    if (!events.length) return;
    const body = JSON.stringify({ events });
    const url = endpoint();
    if (keepalive && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      return;
    }
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive,
    }).then(r => {
      if (!r.ok) return;
      const sent = new Set(events.map(e => e.id));
      saveQueue(loadQueue().filter(e => !sent.has(e.id)));
    }).catch(() => {});
  },
};

if (isBrowser()) {
  addEventListener('pagehide', () => telemetry.flush({ keepalive: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') telemetry.flush({ keepalive: true });
  });
  window.MagicDustTelemetry = telemetry;
}
