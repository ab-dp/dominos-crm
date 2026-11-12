/* חישובי הבורד – פונקציות טהורות, בלי תצוגה. סכומים לפי תאריך אספקה ובלי ביטולים (אלא אם נאמר אחרת).
   הכנסות, "סופקו בזמן" והתקופות – מ-data/metrics.ts, כמו בדוחות, כדי שהבורד והדוח יציגו אותו מספר. */
import type { OrderView } from '../../data/store';
import { isExpired, type Quote } from '../../data/quotes';
import { CLOSED, PIZZA, categoryOf } from '../../data/types';
import { missingOf } from '../../rules-engine/health';
import { addDays, roundMoney, toISODate } from '../../lib/format';
import { PRESET_LABEL, isDelivered, onTime, pctOf, presetRange, revenue, revenueOf } from '../../data/metrics';

export type Period = 'week' | 'month' | 'prevMonth' | 'd30' | 'custom';
export const PERIOD_LABEL: Record<Period, string> = { week: PRESET_LABEL.week, month: PRESET_LABEL.month, prevMonth: PRESET_LABEL.prevMonth, d30: PRESET_LABEL.d30, custom: PRESET_LABEL.custom };

export type Range = { from: string; to: string };
const iso = toISODate;
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const monthEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const dayDiff = (a: string, b: string) => Math.round((new Date(b + 'T12:00').getTime() - new Date(a + 'T12:00').getTime()) / 86400000);
const daysIn = (r: Range) => dayDiff(r.from, r.to) + 1;

/* התקופה, והתקופה להשוואה – אותו אורך ממש לפני (בחודש הנוכחי: אותם ימים בחודש הקודם) */
export function periodRanges(p: Period, now: Date, custom: Range): { cur: Range; prev: Range; prevName: string } {
  if (p === 'month') {
    const from = monthStart(now);
    const prevFrom = monthStart(addDays(from, -1));
    const sameDay = Math.min(now.getDate(), monthEnd(prevFrom).getDate());
    return { cur: presetRange('month', now), prev: { from: iso(prevFrom), to: iso(new Date(prevFrom.getFullYear(), prevFrom.getMonth(), sameDay)) }, prevName: 'אותם ימים בחודש שעבר' };
  }
  if (p === 'prevMonth') {
    const from = monthStart(addDays(monthStart(now), -1));
    const prevFrom = monthStart(addDays(from, -1));
    return { cur: presetRange('prevMonth', now), prev: { from: iso(prevFrom), to: iso(monthEnd(prevFrom)) }, prevName: 'החודש שלפניו' };
  }
  if (p === 'week') {
    const from = addDays(now, -now.getDay()); // ראשון
    return { cur: presetRange('week', now), prev: { from: iso(addDays(from, -7)), to: iso(addDays(now, -7)) }, prevName: 'אותם ימים בשבוע שעבר' };
  }
  const cur = p === 'd30' ? presetRange('d30', now) : custom;
  const n = daysIn(cur);
  const prevTo = addDays(new Date(cur.from + 'T12:00'), -1);
  return { cur, prev: { from: iso(addDays(prevTo, -(n - 1))), to: iso(prevTo) }, prevName: `${n} הימים שלפני` };
}

export type Filters = { cluster: string; branch: string; handler: string; method: string };
export const NO_FILTERS: Filters = { cluster: '', branch: '', handler: '', method: '' };
export const applyFilters = (orders: OrderView[], f: Filters) => orders.filter((o) =>
  (!f.cluster || o.cluster === f.cluster) && (!f.branch || o.branchName === f.branch) && (!f.handler || o.handler === f.handler) && (!f.method || o.method === f.method));

const inRange = (o: { date: string }, r: Range) => o.date >= r.from && o.date <= r.to;
const live = (o: OrderView) => o.status !== 'cancelled';
/* הכנסות: סכום Q, ואם לא הוקלד – הסכום לחיוב (כמו בדוחות). הרשימות כאן כבר בלי ביטולים */
const sumOf = (list: OrderView[]) => revenue(list);
export const pizzasOf = (o: OrderView) => o.items.filter((i) => categoryOf(i) === PIZZA).reduce((t, i) => t + i.qty, 0);
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : null);
/* שינוי באחוזים; null כשאין בסיס להשוואה */
export const delta = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

/* ---------- הזמנות קרובות: 7 הימים הקרובים, ומה מעבר. מוכנות = הלקוח אישר והתפעול עודכן ---------- */
export type Readiness = 'ready' | 'customer' | 'ops';
export const readinessOf = (o: OrderView): Readiness =>
  (o.status === 'new' || o.status === 'pending_customer' ? 'customer' : !o.branchApproval ? 'ops' : 'ready');
export type Day = { date: string; count: number; sum: number; pizzas: number; ready: number; customer: number; ops: number; weekend: boolean };
export function horizon(orders: OrderView[], now: Date, days = 7) {
  const today = iso(now);
  const open = orders.filter((o) => live(o) && !CLOSED.includes(o.status) && o.date >= today);
  const list: Day[] = Array.from({ length: days }, (_, i) => {
    const d = addDays(now, i);
    const date = iso(d);
    const os = open.filter((o) => o.date === date);
    const r = os.map(readinessOf);
    return { date, weekend: d.getDay() === 5 || d.getDay() === 6, count: os.length, sum: sumOf(os), pizzas: os.reduce((t, o) => t + pizzasOf(o), 0),
      ready: r.filter((x) => x === 'ready').length, customer: r.filter((x) => x === 'customer').length, ops: r.filter((x) => x === 'ops').length };
  });
  const last = list[list.length - 1].date;
  const later = open.filter((o) => o.date > last);
  const week = open.filter((o) => o.date <= last);
  return {
    days: list,
    later: { count: later.length, sum: sumOf(later) },
    week: { count: week.length, sum: sumOf(week), pizzas: list.reduce((t, d) => t + d.pizzas, 0), customer: list.reduce((t, d) => t + d.customer, 0), ops: list.reduce((t, d) => t + d.ops, 0) },
  };
}

/* ---------- מכירות ---------- */
export type Sales = { count: number; sum: number; avg: number; pizzas: number; customers: number };
export function sales(orders: OrderView[], r: Range): Sales {
  const list = orders.filter((o) => inRange(o, r) && live(o));
  const sum = sumOf(list);
  return { count: list.length, sum, avg: list.length ? roundMoney(sum / list.length) : 0, pizzas: list.reduce((t, o) => t + pizzasOf(o), 0), customers: new Set(list.map((o) => o.customerId)).size };
}
/* לפי יום – התקופה, ולצידה היום המקביל בתקופה הקודמת */
export type DayPoint = { date: string; count: number; sum: number; prevCount: number; prevSum: number };
export function byDay(orders: OrderView[], cur: Range, prev: Range): DayPoint[] {
  const out: DayPoint[] = [];
  for (let i = 0, d = new Date(cur.from + 'T12:00'); iso(d) <= cur.to; i += 1, d = addDays(d, 1)) out.push({ date: iso(d), count: 0, sum: 0, prevCount: 0, prevSum: 0 });
  const curIdx = new Map(out.map((p, i) => [p.date, i]));
  orders.forEach((o) => {
    if (!live(o)) return;
    const i = curIdx.get(o.date);
    if (i !== undefined) { out[i].count += 1; out[i].sum = roundMoney(out[i].sum + revenueOf(o)); return; }
    if (inRange(o, prev)) {
      const j = dayDiff(prev.from, o.date);
      if (j >= 0 && j < out.length) { out[j].prevCount += 1; out[j].prevSum = roundMoney(out[j].prevSum + revenueOf(o)); }
    }
  });
  return out;
}

/* ---------- עמידה בזמנים: אותה הגדרה כמו בדוחות (data/metrics.ts) – "בזמן" = סופקה (מלא או חלקי) בלי איחור.
   onTime + late = delivered; partial הוא "מתוכן חלקית" ולא קטגוריה נפרדת ---------- */
export type Service = { onTime: number; late: number; partial: number; cancelled: number; delivered: number; closed: number; onTimePct: number | null; overdue: number; lateBranches: { name: string; late: number; delivered: number }[] };
export function service(orders: OrderView[], r: Range, now: Date): Service {
  const list = orders.filter((o) => inRange(o, r));
  const done = list.filter(isDelivered);
  const t = onTime(list);
  const cancelled = list.filter((o) => o.status === 'cancelled').length;
  const by = new Map<string, { name: string; late: number; delivered: number }>();
  done.forEach((o) => { const k = o.branchName || '—'; const e = by.get(k) ?? { name: k, late: 0, delivered: 0 }; e.delivered += 1; if (o.late) e.late += 1; by.set(k, e); });
  return {
    onTime: t.onTime, late: t.late, partial: t.partial, cancelled, delivered: t.delivered, closed: t.delivered + cancelled,
    onTimePct: pctOf(t.rate),
    overdue: list.filter((o) => !CLOSED.includes(o.status) && o.date < iso(now)).length,
    lateBranches: [...by.values()].filter((b) => b.late > 0).sort((a, b) => b.late - a.late || b.late / b.delivered - a.late / a.delivered).slice(0, 3),
  };
}

/* ---------- גבייה ובקרת קופה (מצב נוכחי, לא תלוי בתקופה) ---------- */
export type Aging = { label: string; count: number; sum: number };
export function collections(orders: OrderView[], now: Date) {
  const today = iso(now);
  const open = orders.filter((o) => o.method === 'account' && o.payment === 'pending' && live(o) && o.date <= today);
  const bucket = (min: number, max: number) => open.filter((o) => { const d = dayDiff(o.date, today); return d >= min && d <= max; });
  const aging: Aging[] = [
    { label: 'עד 30 יום', ...pack(bucket(0, 30)) },
    { label: '31–60 יום', ...pack(bucket(31, 60)) },
    { label: 'מעל 60 יום', ...pack(bucket(61, 100000)) },
  ];
  const gaps = orders.filter((o) => o.issues.some((i) => i.rule === 2));
  return {
    open: pack(open), aging,
    gaps: { count: gaps.length, sum: roundMoney(gaps.reduce((t, o) => t + Math.abs((o.qAmount ?? o.amount) - o.amount), 0)) },
    failed: pack(orders.filter((o) => o.payment === 'failed' && live(o))),
  };
}
function pack(list: OrderView[]) { return { count: list.length, sum: sumOf(list) }; }

/* ---------- דירוגים ---------- */
export type Ranked = { name: string; count: number; sum: number; share: number; onTimePct: number | null; missing: number };
function rank(list: OrderView[], key: (o: OrderView) => string): Ranked[] {
  const total = sumOf(list);
  const m = new Map<string, { name: string; count: number; sum: number; done: number; late: number; missing: number }>();
  list.forEach((o) => {
    const k = key(o) || '—';
    const e = m.get(k) ?? { name: k, count: 0, sum: 0, done: 0, late: 0, missing: 0 };
    e.count += 1; e.sum = roundMoney(e.sum + revenueOf(o));
    if (isDelivered(o)) { e.done += 1; if (o.late) e.late += 1; }
    if (missingOf(o).length) e.missing += 1;
    m.set(k, e);
  });
  return [...m.values()].sort((a, b) => b.sum - a.sum || b.count - a.count)
    .map((e) => ({ name: e.name, count: e.count, sum: e.sum, missing: e.missing, share: total ? Math.round((e.sum / total) * 100) : 0, onTimePct: pctOf(e.done ? (e.done - e.late) / e.done : null) }));
}
export function rankings(orders: OrderView[], r: Range) {
  const list = orders.filter((o) => inRange(o, r) && live(o));
  return { customers: rank(list, (o) => o.customerName), clusters: rank(list, (o) => o.cluster), branches: rank(list, (o) => o.branchName), team: rank(list, (o) => o.handler) };
}

/* ---------- הצעות מחיר ---------- */
export function quotesSummary(quotes: Quote[], r: Range, now: Date, followups: number) {
  const today = iso(now);
  const soon = iso(addDays(now, 3));
  const open = quotes.filter((q) => (q.status === 'sent' || q.status === 'noanswer' || q.status === 'approved') && !isExpired(q, today));
  const sent = quotes.filter((q) => q.issueDate >= r.from && q.issueDate <= r.to && q.status !== 'draft');
  const ordered = sent.filter((q) => q.status === 'ordered').length;
  return {
    open: open.length, openSum: roundMoney(open.reduce((t, q) => t + q.total, 0)),
    approved: open.filter((q) => q.status === 'approved').length,
    expiring: open.filter((q) => q.status !== 'approved' && q.validUntil && q.validUntil >= today && q.validUntil <= soon).length,
    followups,
    sent: sent.length, ordered, conversion: pct(ordered, sent.length),
  };
}

/* יעד: כמה הושג, ובקצב הנוכחי – לאן מגיעים בסוף החודש (רק בחודש הנוכחי) */
export function goalPace(value: number, goal: number, r: Range, now: Date, current: boolean) {
  const p = Math.round((value / goal) * 100);
  if (!current) return { pct: p, projected: null as number | null };
  const total = monthEnd(new Date(r.from + 'T12:00')).getDate();
  return { pct: p, projected: roundMoney((value / Math.max(1, now.getDate())) * total) };
}
