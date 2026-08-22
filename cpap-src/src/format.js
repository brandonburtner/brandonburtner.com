// Formatting + interval helpers shared by the UI.
const DAY = 86_400_000;

export function fmtDuration(ms) {
  const abs = Math.abs(ms);
  const days = Math.floor(abs / DAY);
  if (days >= 1) {
    const weeks = Math.floor(days / 7);
    if (days >= 14) return `${weeks} week${weeks === 1 ? '' : 's'}`;
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(abs / 3_600_000);
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const mins = Math.max(1, Math.floor(abs / 60_000));
  return `${mins} min`;
}

// Status text + tone for an item, given its computed dueAt.
export function statusFor(item, now = Date.now()) {
  const ms = item.dueAt - now;
  if (ms <= 0) return { tone: 'overdue', text: `Past due by ${fmtDuration(ms)}` };
  if (ms <= 2 * DAY) return { tone: 'soon', text: `Due in ${fmtDuration(ms)}` };
  return { tone: 'ok', text: `Due in ${fmtDuration(ms)}` };
}

export function fmtDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function fmtLastPerformed(ms, now = Date.now()) {
  if (!ms) return 'never';
  const ago = now - ms;
  if (ago < DAY) return 'today';
  return `${fmtDuration(ago)} ago`;
}

// Human-friendly interval <-> days conversion for the editor.
export const UNITS = [
  { key: 'days', label: 'days', factor: 1 },
  { key: 'weeks', label: 'weeks', factor: 7 },
  { key: 'months', label: 'months', factor: 30 },
];

export function daysToParts(days) {
  if (days % 30 === 0 && days >= 30) return { value: days / 30, unit: 'months' };
  if (days % 7 === 0 && days >= 7) return { value: days / 7, unit: 'weeks' };
  return { value: days, unit: 'days' };
}

export function partsToDays(value, unit) {
  const u = UNITS.find((x) => x.key === unit) || UNITS[0];
  return Math.max(1, Math.round(value * u.factor));
}

export function fmtEvery(days) {
  const p = daysToParts(days);
  const noun = p.unit.replace(/s$/, '');
  return `Every ${p.value} ${noun}${p.value === 1 ? '' : 's'}`;
}

// Describe a notification rule in plain language.
export function describeNotification(n) {
  const when =
    n.offsetHours === 0
      ? 'when an item becomes due'
      : n.offsetHours > 0
      ? `${fmtDuration(n.offsetHours * 3_600_000)} after it becomes due`
      : `${fmtDuration(n.offsetHours * 3_600_000)} before it becomes due`;
  const repeat = n.recurring
    ? `, then repeats every ${fmtDuration(n.everyHours * 3_600_000)} while overdue`
    : '';
  const scope =
    !n.scope || n.scope.type === 'all'
      ? 'For every item'
      : n.scope.type === 'category'
      ? `For ${n.scope.category} items`
      : 'For one item';
  return `${scope}: fires ${when}${repeat}.`;
}
