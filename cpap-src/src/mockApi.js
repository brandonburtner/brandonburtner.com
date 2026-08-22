// In-memory mock of the backend, used only in local dev preview (?mock=1).
// Mirrors the real API's response shapes so the UI behaves identically.
const DAY = 86_400_000;
const now = () => Date.now();
let seeded = false;
let items = [];
let notifications = [];
let pushEnabled = false;
const uid = () => Math.random().toString(36).slice(2, 10);

function seed() {
  const t = now();
  items = [
    ['Maintenance', 'Weekly Maintenance', 'Rinse tubing and wash humidifier chamber', 7, 9],
    ['Replacement', 'Nasal Cushion & Filter Replacement', 'Replace the nasal cushion and filter', 14, 12],
    ['Replacement', 'Mask Frame & Tubing Replacement', 'Replace the mask frame and tubing', 90, 20],
    ['Replacement', 'Humidifier Chamber & Headgear Replacement', 'Replace the humidifier chamber and headgear', 180, 30],
    ['Orders', '3 Month Order - Mask Frame, Heated Tubing, 6 Nasal Pillows, 6 Filters', 'Place the quarterly supply order', 90, 88],
    ['Orders', '6 Month Order - Humidifier Chamber, Headgear', 'Place the semi-annual supply order', 180, 30],
  ].map(([category, name, description, intervalDays, agoDays], i) => ({
    id: uid(), category, name, description, intervalDays,
    lastPerformedAt: t - agoDays * DAY, sortOrder: i,
  }));
  notifications = [
    { id: uid(), label: 'When an item becomes due', enabled: true, offsetHours: 0, recurring: false, everyHours: 0, scope: { type: 'all' } },
    { id: uid(), label: 'Daily reminder while overdue', enabled: true, offsetHours: 24, recurring: true, everyHours: 24, scope: { type: 'all' } },
  ];
  seeded = true;
}

function itemView(it) {
  const dueAt = it.lastPerformedAt + it.intervalDays * DAY;
  return { ...it, dueAt, pastDue: now() >= dueAt, msUntilDue: dueAt - now() };
}

function state() {
  return {
    items: items.map(itemView),
    notifications: [...notifications],
    pushEnabled,
    serverTime: now(),
    vapidPublicKey: 'mock',
  };
}

export async function handle(method, path, body) {
  if (!seeded) seed();
  await new Promise((r) => setTimeout(r, 120)); // simulate latency
  const p = path.split('/').filter(Boolean);

  if (method === 'GET' && p[0] === 'state') return state();

  if (p[0] === 'items') {
    if (method === 'POST' && p.length === 1) {
      items.push({ id: uid(), category: body.category || 'Maintenance', name: body.name || 'New item', description: body.description || '', intervalDays: Math.max(1, body.intervalDays || 30), lastPerformedAt: now(), sortOrder: 999 });
      return state();
    }
    const it = items.find((x) => x.id === p[1]);
    if (!it) throw new Error('not found');
    if (method === 'POST' && p[2] === 'perform') { it.lastPerformedAt = now(); return state(); }
    if (method === 'PATCH') {
      if ('intervalDays' in body) it.intervalDays = Math.max(1, body.intervalDays);
      if ('name' in body) it.name = body.name;
      if ('description' in body) it.description = body.description;
      return state();
    }
    if (method === 'DELETE') { items = items.filter((x) => x.id !== p[1]); return state(); }
  }

  if (p[0] === 'notifications') {
    if (method === 'POST' && p.length === 1) {
      notifications.push({ id: uid(), label: body.label || 'New notification', enabled: body.enabled !== false, offsetHours: body.offsetHours || 0, recurring: !!body.recurring, everyHours: body.everyHours || 24, scope: body.scope || { type: 'all' } });
      return state();
    }
    const n = notifications.find((x) => x.id === p[1]);
    if (method === 'PATCH' && n) { Object.assign(n, body); return state(); }
    if (method === 'DELETE') { notifications = notifications.filter((x) => x.id !== p[1]); return state(); }
  }

  if (p[0] === 'push') {
    if (p[1] === 'subscribe') { pushEnabled = true; return { ok: true, pushEnabled: true }; }
    if (p[1] === 'test') { return { ok: true, sent: 1 }; }
  }
  throw new Error('mock: unhandled ' + method + ' ' + path);
}
