/* חישובי הבורד – פונקציות טהורות, בלי תצוגה. כל המספרים מתוך ההזמנות שכבר נטענו (או טווח שנטען לפי דרישה). */
import type { OrderView } from '../../data/store';
import type { Quote } from '../../data/quotes';
import { CLOSED, PIZZA, categoryOf } from '../../data/types';
import { weekendRange } from '../../data/opsSummary';
import { addDays, roundMoney, sameMoney, toISODate } from '../../lib/format';

export type Period = 'week' | 'month' | 'prevMonth' | 'd30' | 'custom';
export const PERIOD_LABEL: Record<Period, string> = { week: 'השבוע', month: 'החודש', prevMonth: 'החודש הקודם', d30: '30 יום', custom: 'טווח' };

export type Range = { from: string; to: string };
const iso = toISODate;
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const monthEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const days = (r: Range) => Math.round((new Date(r.to + 'T12:00').getTime() - new Date(r.from + 'T12:00').getTime()) / 86400000) + 1;

/* הטווח של התקופה, והטווח להשוואה – אותו אורך ממש לפני (בחודש הנוכחי: אותם ימים בחודש הקודם) */
export function periodRanges(p: Period, now: Date, custom: Range): { cur: Range; prev: Range; prevLabel: string } {
  if (p === 'month') {
    const from = monthStart(now);
    const prevFrom = monthStart(addDays(from, -1));
    const sameDay = Math.min(now.getDate(), monthEnd(prevFrom).getDate());
    return { cur: { from: iso(from), to: iso(now) }, prev: { from: iso(prevFrom), to: iso(new Date(prevFrom.getFullYear(), prevFrom.getMonth(), sameDay)) }, prevLabel: `מול אותם ימים בחודש שעבר` };
  }
  if (p === 'prevMonth') {
    const from = monthStart(addDays(monthStart(now), -1));
    const prevFrom = monthStart(addDays(from, -1));
    return { cur: { from: iso(from), to: iso(monthEnd(from)) }, prev: { from: iso(prevFrom), to: iso(monthEnd(prevFrom)) }, prevLabel: 'מול החודש שלפניו' };
  }
  if (p === 'week') {
    const from = addDays(now, -now.getDay()); // ראשון
    return { cur: { from: iso(from), to: iso(now) }, prev: { from: iso(addDays(from, -7)), to: iso(addDays(now, -7)) }, prevLabel: 'מול אותם ימים בשבוע שעבר' };
  }
  const cur = p === 'd30' ? { from: iso(addDays(now, -29)), to: iso(now) } : custom;
  const n = days(cur);
  const prevTo = addDays(new Date(cur.from + 'T12:00'), -1);
  return { cur, prev: { from: iso(addDays(prevTo, -(n - 1))), to: iso(prevTo) }, prevLabel: `מול ${n} הימים שלפני` };
}

export type Filters = { cluster: string; branch: string; handler: string; method: string };
export const NO_FILTERS: Filters = { cluster: '', branch: '', handler: '', method: '' };
export const applyFilters = (orders: OrderView[], f: Filters) => orders.filter((o) =>
  (!f.cluster || o.cluster === f.cluster) && (!f.branch || o.branchName === f.branch) && (!f.handler || o.handler === f.handler) && (!f.method || o.method === f.method));

const inRange = (o: { date: string }, r: Range) => o.date >= r.from && o.date <= r.to;
const pizzasOf = (o: OrderView) => o.items.filter((i) => categoryOf(i) === PIZZA).reduce((t, i) => t + i.qty, 0);

/* ---------- מה מגיע: היום, מחר, סופ"ש, כל העתידיות (לא תלוי בתקופה) ---------- */
export type Bucket = { key: string; label: string; sub: string; count: number; sum: number; pizzas: number; unapproved: number; noOps: number; to: string };
export function upcoming(orders: OrderView[], now: Date): Bucket[] {
  const today = iso(now);
  const tomorrow = iso(addDays(now, 1));
  const wk = weekendRange(now);
  const live = orders.filter((o) => o.status !== 'cancelled' && o.date >= today);
  const make = (key: string, label: string, sub: string, pick: (o: OrderView) => boolean, to: string): Bucket => {
    const list = live.filter(pick);
    return {
      key, label, sub, to,
      count: list.length,
      sum: roundMoney(list.reduce((t, o) => t + o.amount, 0)),
      pizzas: list.reduce((t, o) => t + pizzasOf(o), 0),
      unapproved: list.filter((o) => o.status === 'new' || o.status === 'pending_customer').length,
      noOps: list.filter((o) => !o.branchApproval && !CLOSED.includes(o.status)).length,
    };
  };
  return [
    make('today', 'היום', '', (o) => o.date === today, '/orders?tab=today'),
    make('tomorrow', 'מחר', '', (o) => o.date === tomorrow, '/orders?tab=tomorrow'),
    make('weekend', 'סופ"ש', 'שישי–שבת', (o) => o.date >= wk.from && o.date <= wk.to, '/ops'),
    make('future', 'כל העתידיות', 'מהיום והלאה', () => true, '/orders?tab=future'),
  ];
}

/* ---------- התקופה: הזמנות, הכנסות, ממוצע, פיצות + השוואה ---------- */
export type Totals = { count: number; sum: number; avg: number; pizzas: number };
export function totals(orders: OrderView[], r: Range): Totals {
  const list = orders.filter((o) => inRange(o, r) && o.status !== 'cancelled');
  const sum = roundMoney(list.reduce((t, o) => t + o.amount, 0));
  return { count: list.length, sum, avg: list.length ? roundMoney(sum / list.length) : 0, pizzas: list.reduce((t, o) => t + pizzasOf(o), 0) };
}
/* שינוי באחוזים; null כשאין בסיס להשוואה */
export const delta = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

/* הזמנות לפי יום (עמודות) */
export type DayPoint = { date: string; count: number; sum: number };
export function byDay(orders: OrderView[], r: Range): DayPoint[] {
  const out: DayPoint[] = [];
  for (let d = new Date(r.from + 'T12:00'); iso(d) <= r.to; d = addDays(d, 1)) out.push({ date: iso(d), count: 0, sum: 0 });
  const at = new Map(out.map((p, i) => [p.date, i]));
  orders.forEach((o) => {
    const i = at.get(o.date);
    if (i === undefined || o.status === 'cancelled') return;
    out[i].count += 1; out[i].sum = roundMoney(out[i].sum + o.amount);
  });
  return out;
}

/* ---------- איכות אספקה: מתוך ההזמנות שנסגרו בתקופה. "באיחור" = כל הזמנה שסומנה סופקה באיחור ---------- */
export type Quality = { onTime: number; late: number; partial: number; cancelled: number; closed: number; delivered: number; onTimePct: number | null; stillOpen: number };
export function quality(orders: OrderView[], r: Range, now: Date): Quality {
  const list = orders.filter((o) => inRange(o, r));
  const late = list.filter((o) => (o.status === 'delivered' || o.status === 'partial') && !!o.late).length;
  const onTime = list.filter((o) => o.status === 'delivered' && !o.late).length;
  const partial = list.filter((o) => o.status === 'partial' && !o.late).length;
  const cancelled = list.filter((o) => o.status === 'cancelled').length;
  const delivered = onTime + late + partial;
  const today = iso(now);
  return {
    onTime, late, partial, cancelled, delivered, closed: delivered + cancelled,
    onTimePct: delivered ? Math.round((onTime / delivered) * 100) : null,
    stillOpen: list.filter((o) => !CLOSED.includes(o.status) && o.date < today).length,
  };
}

/* ---------- כסף ---------- */
export type Money = { creditOpen: { count: number; sum: number }; qGaps: { count: number; sum: number }; failed: number };
export function money(orders: OrderView[]): Money {
  const credit = orders.filter((o) => o.method === 'account' && o.payment === 'pending' && o.status !== 'cancelled');
  const gaps = orders.filter((o) => o.issues.some((i) => i.rule === 2));
  return {
    creditOpen: { count: credit.length, sum: roundMoney(credit.reduce((t, o) => t + o.amount, 0)) },
    qGaps: { count: gaps.length, sum: roundMoney(gaps.reduce((t, o) => t + Math.abs((o.qAmount ?? o.amount) - o.amount), 0)) },
    failed: orders.filter((o) => o.payment === 'failed' && o.status !== 'cancelled').length,
  };
}

/* ---------- דירוגים: לקוחות, סניפים / אשכולות, נציגים ---------- */
export type Ranked = { name: string; count: number; sum: number; latePct?: number | null };
function rank(list: OrderView[], key: (o: OrderView) => string, n: number): Ranked[] {
  const m = new Map<string, Ranked & { lateN: number; deliveredN: number }>();
  list.forEach((o) => {
    const k = key(o) || '—';
    const e = m.get(k) ?? { name: k, count: 0, sum: 0, lateN: 0, deliveredN: 0 };
    e.count += 1; e.sum = roundMoney(e.sum + o.amount);
    if (o.status === 'delivered' || o.status === 'partial') { e.deliveredN += 1; if (o.late) e.lateN += 1; }
    m.set(k, e);
  });
  return [...m.values()].sort((a, b) => b.sum - a.sum || b.count - a.count).slice(0, n)
    .map(({ lateN, deliveredN, ...e }) => ({ ...e, latePct: deliveredN ? Math.round((lateN / deliveredN) * 100) : null }));
}
export function rankings(orders: OrderView[], r: Range) {
  const list = orders.filter((o) => inRange(o, r) && o.status !== 'cancelled');
  return {
    customers: rank(list, (o) => o.customerName, 6),
    clusters: rank(list, (o) => o.cluster, 6),
    branches: rank(list, (o) => o.branchName, 6),
    handlers: rank(list, (o) => o.handler, 8),
  };
}

/* ---------- הצעות מחיר ---------- */
export function quotesSummary(quotes: Quote[], r: Range) {
  const open = quotes.filter((q) => q.status === 'sent' || q.status === 'noanswer' || q.status === 'approved');
  const issued = quotes.filter((q) => q.issueDate >= r.from && q.issueDate <= r.to && q.status !== 'draft');
  const ordered = issued.filter((q) => q.status === 'ordered').length;
  return {
    open: open.length, openSum: roundMoney(open.reduce((t, q) => t + q.total, 0)),
    issued: issued.length, ordered,
    conversion: issued.length ? Math.round((ordered / issued.length) * 100) : null,
  };
}

/* יעד: כמה הושג, ובקצב הנוכחי – לאן מגיעים בסוף החודש (רק בחודש הנוכחי) */
export function goalPace(value: number, goal: number, r: Range, now: Date, current: boolean) {
  const pct = Math.round((value / goal) * 100);
  if (!current) return { pct, projected: null as number | null };
  const total = monthEnd(new Date(r.from + 'T12:00')).getDate();
  const elapsed = now.getDate();
  return { pct, projected: elapsed ? roundMoney((value / elapsed) * total) : null };
}

export const near = sameMoney;
