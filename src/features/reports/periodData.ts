/* סיכום תקופה – דוח להנהלה. פונקציות טהורות: מהזמנות לטבלאות, שמשמשות גם את המסך וגם את קובץ האקסל.
   כלל אחיד כמו בשאר הדוחות: לפי תאריך אספקה וסכום Q (ואם לא הוקלד – הסכום לחיוב). סכומים בלי הזמנות שבוטלו. */
import { OUTCOME_LABEL, methodText, PIZZA, STAGE_LABEL, categoryOf, stageOf, type Order } from '../../data/types';
import { addDays, roundMoney, toISODate } from '../../lib/format';
import { ON_TIME_HINT, isDelivered, isLive, onTime, revenue, type Preset } from '../../data/metrics';

/* ---------- תקופות: מתוך הרשימה המשותפת (data/metrics.ts) – אותם שמות ואותה משמעות בכל הדוחות ---------- */
export const PERIOD_PRESETS: Preset[] = ['lastWeek', 'prevMonth', 'month', 'custom'];

/* ---------- מבנה טבלה משותף למסך ולאקסל ---------- */
/* id: מספר בלי פסיק אלפים (מס' הזמנה); code: טקסט קצר בכיוון שמאל-ימין (שעה, מס' Q) */
export type Kind = 'text' | 'num' | 'money' | 'pct' | 'date' | 'code' | 'id';
export type Cell = string | number | null;
export type TCol = { label: string; kind: Kind; width: number };
export type STable = { id: string; title: string; note?: string; cols: TCol[]; rows: Cell[][]; total?: Cell[]; ids?: number[] };
export type Kpi = { label: string; value: number; kind: Kind; sub?: string };

const live = isLive;
const done = isDelivered;
const sumQ = (list: Order[]) => revenue(list);
const frac = (part: number, whole: number) => (whole ? part / whole : null);
const WEEKDAY = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const byTime = (a: Order, b: Order) => (a.date + a.time).localeCompare(b.date + b.time) || a.id - b.id;

/* כמות פריטים: סכום הכמויות. בהזמנה מהירה (תכולה במילים בלבד) – סכום המספרים שבתחילת כל חלק: "12 משפחתיות, 6 שתייה" = 18 */
export function itemCount(o: Order): number | null {
  if (o.items.length) return o.items.reduce((t, i) => t + (i.qty || 0), 0);
  const parts = (o.contents ?? '').split(/[,،\n+]/).map((p) => /^\s*(\d+)/.exec(p)?.[1]).filter(Boolean);
  return parts.length ? parts.reduce((t, n) => t + Number(n), 0) : null;
}
export const pizzaCount = (o: Order) => o.items.filter((i) => categoryOf(i) === PIZZA).reduce((t, i) => t + i.qty, 0);

/* סטטוס: הזמנה שנסגרה – איך סופקה; הזמנה פתוחה – באיזה שלב היא */
export function statusText(o: Order): string {
  if (o.status === 'cancelled') return OUTCOME_LABEL.cancelled;
  if (done(o)) return o.late ? (o.status === 'partial' ? 'חלקית, באיחור' : OUTCOME_LABEL.late) : OUTCOME_LABEL[o.status === 'partial' ? 'partial' : 'ontime'];
  return STAGE_LABEL[stageOf(o)];
}

/* ---------- לשונית 1: כל ההזמנות ---------- */
export function ordersTable(all: Order[]): STable {
  const list = [...all].sort(byTime);
  const l = list.filter(live);
  const canc = list.length - l.length;
  return {
    id: 'orders', title: 'הזמנות',
    note: canc ? `הזמנות שבוטלו מופיעות ברשימה ולא נספרות בסה"כ (${canc})` : undefined,
    cols: [
      { label: 'תאריך', kind: 'date', width: 12 }, { label: 'שעה', kind: 'code', width: 8 }, { label: "מס' הזמנה", kind: 'id', width: 11 },
      { label: 'לקוח', kind: 'text', width: 28 }, { label: 'סניף', kind: 'text', width: 20 }, { label: 'אשכול', kind: 'text', width: 18 },
      { label: 'ערוץ', kind: 'text', width: 12 }, { label: 'פריטים', kind: 'num', width: 9 }, { label: "מס' Q", kind: 'code', width: 12 },
      { label: 'סכום Q', kind: 'money', width: 12 }, { label: 'אמצעי תשלום', kind: 'text', width: 13 }, { label: 'סטטוס', kind: 'text', width: 20 },
      { label: 'דקות איחור', kind: 'num', width: 11 },
    ],
    ids: list.map((o) => o.id),
    rows: list.map((o) => [
      o.date, o.time || null, o.id, o.customerName, o.branchName, o.cluster || null, o.channel || null, itemCount(o), o.qNumber || null,
      o.qAmount ?? null, methodText(o), statusText(o),
      o.late ? (o.late.minutes || 'לא צוין') : null,
    ]),
    total: ['סה"כ', null, null, `${l.length} הזמנות`, null, null, null, null, null, sumQ(l), null, null, null],
  };
}
/* הזמנה בלי סכום Q – הסה"כ לוקח במקומה את הסכום לחיוב */
export const missingQ = (all: Order[]) => all.filter((o) => live(o) && o.qAmount == null);

/* ---------- לשונית 2: סיכום ---------- */
export type Summary = { kpis: Kpi[]; tables: STable[] };

type Agg = { name: string; extra?: string; count: number; sum: number; done: number; late: number; lateMin: number; lateMinN: number };
function aggregate(list: Order[], key: (o: Order) => string, extra?: (o: Order) => string): Agg[] {
  const m = new Map<string, Agg>();
  list.forEach((o) => {
    const k = key(o) || '—';
    const e = m.get(k) ?? { name: k, extra: extra?.(o) || '—', count: 0, sum: 0, done: 0, late: 0, lateMin: 0, lateMinN: 0 };
    if (live(o)) { e.count += 1; e.sum = roundMoney(e.sum + revenue([o])); }
    if (done(o)) {
      e.done += 1;
      if (o.late) { e.late += 1; if (o.late.minutes) { e.lateMin += o.late.minutes; e.lateMinN += 1; } }
    }
    m.set(k, e);
  });
  return [...m.values()];
}
const avgMin = (a: { lateMin: number; lateMinN: number }) => (a.lateMinN ? Math.round(a.lateMin / a.lateMinN) : null);

export function summary(all: Order[], from: string, to: string): Summary {
  const l = all.filter(live);
  const total = sumQ(l);
  const closed = all.filter(done);
  const late = closed.filter((o) => !!o.late);
  const t = onTime(all);
  const cancelled = all.length - l.length;
  const open = all.filter((o) => live(o) && !done(o)).length;
  const allLate = aggregate(all, () => 'all')[0] ?? { lateMin: 0, lateMinN: 0 };

  const kpis: Kpi[] = [
    { label: 'הכנסות', value: total, kind: 'money' },
    { label: 'הזמנות', value: l.length, kind: 'num', sub: cancelled ? `ועוד ${cancelled} שבוטלו` : undefined },
    { label: 'ממוצע להזמנה', value: l.length ? roundMoney(total / l.length) : 0, kind: 'money' },
    { label: 'סופקו בזמן', value: t.rate ?? 0, kind: 'pct', sub: t.delivered ? `מתוך ${t.delivered} שסופקו` : 'אין הזמנות שסופקו' },
    { label: 'פיצות', value: l.reduce((t, o) => t + pizzaCount(o), 0), kind: 'num' },
    { label: 'לקוחות שהזמינו', value: new Set(l.map((o) => o.customerId || o.customerName)).size, kind: 'num' },
  ];

  /* לפי יום – כל יום בתקופה, גם ימים בלי הזמנות */
  const days: Cell[][] = [];
  for (let d = new Date(from + 'T12:00'); toISODate(d) <= to; d = addDays(d, 1)) {
    const iso = toISODate(d);
    const os = all.filter((o) => o.date === iso);
    const lv = os.filter(live);
    days.push([iso, WEEKDAY[d.getDay()], lv.length, sumQ(lv), os.filter((o) => done(o) && o.late).length, os.length - lv.length]);
  }
  const daily: STable = {
    id: 'daily', title: 'לפי יום',
    cols: [{ label: 'תאריך', kind: 'date', width: 30 }, { label: 'יום', kind: 'text', width: 14 }, { label: 'הזמנות', kind: 'num', width: 14 }, { label: 'הכנסות', kind: 'money', width: 16 }, { label: 'איחורים', kind: 'num', width: 14 }, { label: 'בוטלו', kind: 'num', width: 14 }],
    rows: days,
    total: ['סה"כ', null, l.length, total, late.length, cancelled],
  };

  /* אחוזים מתוך ההזמנות שסופקו (כמו בבורד): בזמן + באיחור = 100%. חלקיות, ביטולים ופתוחות – כמות בלבד */
  const service: STable = {
    id: 'service', title: 'עמידה בזמנים',
    note: t.delivered ? `"סופקו בזמן" – ${ON_TIME_HINT}` : 'אין עדיין הזמנות שסופקו בתקופה',
    cols: [{ label: 'סטטוס', kind: 'text', width: 30 }, { label: 'הזמנות', kind: 'num', width: 14 }, { label: 'מתוך שסופקו', kind: 'pct', width: 14 }, { label: "איחור ממוצע (דק')", kind: 'num', width: 16 }],
    rows: [
      ['סופקו בזמן', closed.length - late.length, frac(closed.length - late.length, closed.length), null],
      ['סופקו באיחור', late.length, frac(late.length, closed.length), avgMin(allLate)],
      ['מתוכן סופקו חלקית', closed.filter((o) => o.status === 'partial').length, null, null],
      ['בוטלו', cancelled, null, null],
      ...(open ? [['עדיין פתוחות', open, null, null] as Cell[]] : []),
    ],
    total: ['סה"כ הזמנות', all.length, null, null],
  };

  const branchAgg = aggregate(all, (o) => o.branchName, (o) => o.cluster);
  const lateBranches: STable = {
    id: 'late', title: 'איפה היו איחורים',
    note: late.length ? undefined : 'לא היו איחורים בתקופה',
    cols: [{ label: 'סניף', kind: 'text', width: 30 }, { label: 'אשכול', kind: 'text', width: 14 }, { label: 'איחורים', kind: 'num', width: 14 }, { label: 'מתוך שסופקו', kind: 'num', width: 16 }, { label: 'אחוז איחור', kind: 'pct', width: 14 }, { label: "איחור ממוצע (דק')", kind: 'num', width: 14 }],
    rows: branchAgg.filter((b) => b.late > 0).sort((a, b) => b.late - a.late || b.late / b.done - a.late / a.done)
      .map((b) => [b.name, b.extra ?? null, b.late, b.done, frac(b.late, b.done), avgMin(b)]),
    total: late.length ? ['סה"כ', null, late.length, closed.length, frac(late.length, closed.length), avgMin(allLate)] : undefined,
  };

  const shareRows = (list: Agg[], withExtra: boolean): Cell[][] => list.filter((a) => a.count > 0).sort((a, b) => b.sum - a.sum || b.count - a.count)
    .map((a) => [a.name, ...(withExtra ? [a.extra ?? null] : []), a.sum, frac(a.sum, total), a.count, frac(a.done - a.late, a.done)]);

  const custAgg = aggregate(all, (o) => o.customerName).filter((a) => a.count > 0).sort((a, b) => b.sum - a.sum);
  const customers: STable = {
    id: 'customers', title: 'לקוחות',
    note: custAgg[0] ? `${custAgg[0].name} הוא הלקוח הגדול בתקופה, עם ${Math.round((custAgg[0].sum / (total || 1)) * 100)}% מההכנסות` : undefined,
    cols: [{ label: 'לקוח', kind: 'text', width: 30 }, { label: 'הכנסות', kind: 'money', width: 14 }, { label: 'מההכנסות', kind: 'pct', width: 14 }, { label: 'הזמנות', kind: 'num', width: 16 }, { label: 'סופקו בזמן', kind: 'pct', width: 14 }],
    rows: shareRows(custAgg, false),
    total: ['סה"כ', total, total ? 1 : null, l.length, frac(closed.length - late.length, closed.length)],
  };

  const clAgg = aggregate(all, (o) => o.cluster);
  const clusters: STable = {
    id: 'clusters', title: 'אשכולות',
    cols: [{ label: 'אשכול', kind: 'text', width: 30 }, { label: 'הכנסות', kind: 'money', width: 14 }, { label: 'מההכנסות', kind: 'pct', width: 14 }, { label: 'הזמנות', kind: 'num', width: 16 }, { label: 'סופקו בזמן', kind: 'pct', width: 14 }],
    rows: shareRows(clAgg, false),
    total: ['סה"כ', total, total ? 1 : null, l.length, frac(closed.length - late.length, closed.length)],
  };
  const branches: STable = {
    id: 'branches', title: 'סניפים',
    cols: [{ label: 'סניף', kind: 'text', width: 30 }, { label: 'אשכול', kind: 'text', width: 14 }, { label: 'הכנסות', kind: 'money', width: 14 }, { label: 'מההכנסות', kind: 'pct', width: 16 }, { label: 'הזמנות', kind: 'num', width: 14 }, { label: 'סופקו בזמן', kind: 'pct', width: 14 }],
    rows: shareRows(branchAgg, true),
    total: ['סה"כ', null, total, total ? 1 : null, l.length, frac(closed.length - late.length, closed.length)],
  };

  return { kpis, tables: [daily, service, lateBranches, customers, clusters, branches] };
}
