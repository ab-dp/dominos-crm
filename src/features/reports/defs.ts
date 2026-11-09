/* הגדרות הדוחות (אפיון 10). כל דוח: פונקציה טהורה מהזמנות לשורות וסיכום – קל לבדוק מול חישוב ידני.
   כלל אחיד: לפי תאריך אספקה וסכום Q (ואם לא הועברה – סכום לחיוב). סכומים בלי הזמנות שבוטלו; הביטולים נספרים בנפרד. */
import { METHOD_LABEL, OUTCOME_LABEL, PAYMENT_LABEL, itemsText, outcomeOf, type Order, type Outcome } from '../../data/types';

export const qVal = (o: Order) => o.qAmount ?? o.amount;
export const live = (list: Order[]) => list.filter((o) => o.status !== 'cancelled');

export type Col = { key: string; label: string; kind?: 'text' | 'num' | 'money' | 'pct' | 'date' };
export type Row = { id: string; cells: Record<string, string | number>; orders: Order[] };
export type ReportResult = {
  cols: Col[];
  rows: Row[];
  totals?: Record<string, string | number>;
  /* גרף: עמודה אחת לפי שורות – זמן (עמודות) או קטגוריה (פסים) */
  chart?: { valueKey: string; labelKey: string; title: string; kind: 'time' | 'category'; money?: boolean };
  kpis?: { label: string; value: string | number; money?: boolean; alert?: boolean; sub?: string }[];
};
/* perOrder: שורה לכל הזמנה – לחיצה פותחת את תיק ההזמנה */
export type ReportDef = { id: string; title: string; desc: string; compute: (orders: Order[]) => ReportResult; link?: string; perOrder?: boolean };

function groupBy(list: Order[], key: (o: Order) => string) {
  const m = new Map<string, Order[]>();
  list.forEach((o) => { const k = key(o) || '—'; m.set(k, [...(m.get(k) ?? []), o]); });
  return m;
}
const sum = (list: Order[]) => list.reduce((t, o) => t + qVal(o), 0);
const avg = (list: Order[]) => (list.length ? Math.round(sum(list) / list.length) : 0);
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
const lastDate = (list: Order[]) => list.reduce((m, o) => (o.date > m ? o.date : m), '');

const fmtD = (iso: string) => iso.split('-').reverse().join('.');
const outcomeCount = (list: Order[], k: Outcome) => list.filter((o) => outcomeOf(o) === k);
const orderItemsText = (o: Order) => (o.items.length ? itemsText(o.items) : o.contents ?? '');
const avgLate = (list: Order[]) => { const l = list.filter((o) => o.late?.minutes); return l.length ? Math.round(l.reduce((t, o) => t + (o.late?.minutes ?? 0), 0) / l.length) : 0; };

export const REPORTS: ReportDef[] = [
  { id: 'period', title: 'סיכום תקופה', desc: 'כל ההזמנות בתקופה וסיכום לפי יום, עמידה בזמנים, לקוח וסניף – עם ייצוא לאקסל מוכן להנהלה', compute: () => ({ cols: [], rows: [] }), link: '/reports/period' },
  {
    id: 'summary', perOrder: true, title: 'דוח מפורט', desc: 'כל ההזמנות בתקופה – שורה לכל הזמנה עם כל הפרטים, ולמעלה כמה סופקו, באיחור, חלקית ובוטלו',
    compute: (all) => {
      const l = live(all);
      const on = outcomeCount(all, 'ontime'); const late = outcomeCount(all, 'late'); const part = outcomeCount(all, 'partial');
      const canc = outcomeCount(all, 'cancelled'); const open = outcomeCount(all, 'open');
      const closed = on.length + late.length + part.length;
      const rows = [...all].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map((o) => ({
        id: String(o.id), orders: [o],
        cells: {
          date: fmtD(o.date), time: o.time, id: o.id, customer: o.customerName, branch: o.branchName, cluster: o.cluster, channel: o.channel,
          handler: o.handler || o.createdBy, items: orderItemsText(o), amount: o.amount, q: o.qNumber ?? '', qAmount: o.qAmount ?? '',
          method: o.methodLabel ?? METHOD_LABEL[o.method] ?? o.method, payment: PAYMENT_LABEL[o.payment], outcome: OUTCOME_LABEL[outcomeOf(o)],
          lateMin: o.late?.minutes || '', reason: o.status === 'cancelled' ? [o.cancelReason, o.cancelNote].filter(Boolean).join(' · ') : o.status === 'partial' ? o.partialNote ?? '' : '',
          po: o.poNumber ?? '', notes: [o.instructions, o.note].filter(Boolean).join(' · '),
        },
      }));
      return {
        kpis: [
          { label: 'הזמנות', value: l.length, sub: canc.length ? `+ ${canc.length} בוטלו` : undefined },
          { label: 'סך (לפי Q)', value: sum(l), money: true },
          { label: 'סופקו בזמן', value: on.length, sub: closed ? `${pct(on.length, closed)}%` : undefined },
          { label: 'סופקו באיחור', value: late.length, alert: late.length > 0, sub: late.length ? `ממוצע ${avgLate(late)} דק'` : undefined },
          { label: 'סופקו חלקית', value: part.length, alert: part.length > 0 },
          { label: 'בוטלו', value: canc.length, alert: canc.length > 0 },
          { label: 'עדיין פתוחות', value: open.length },
        ],
        cols: [
          { key: 'date', label: 'תאריך', kind: 'date' }, { key: 'time', label: 'שעה', kind: 'date' }, { key: 'id', label: "מס' הזמנה", kind: 'num' }, { key: 'customer', label: 'לקוח' },
          { key: 'branch', label: 'סניף' }, { key: 'cluster', label: 'אשכול' }, { key: 'channel', label: 'ערוץ' }, { key: 'handler', label: 'מטפל' }, { key: 'items', label: 'פריטים' },
          { key: 'amount', label: 'לחיוב', kind: 'money' }, { key: 'q', label: "מס' Q", kind: 'date' }, { key: 'qAmount', label: 'סכום Q', kind: 'money' },
          { key: 'method', label: 'אמצעי תשלום' }, { key: 'payment', label: 'תשלום' }, { key: 'outcome', label: 'סטטוס אספקה' }, { key: 'lateMin', label: 'דקות איחור', kind: 'num' },
          { key: 'reason', label: 'סיבה / מה סופק' }, { key: 'po', label: 'תעודת רכש', kind: 'date' }, { key: 'notes', label: 'הערות' },
        ],
        rows,
        totals: { date: 'סה"כ', id: '', customer: `${l.length} הזמנות${canc.length ? ` · ${canc.length} בוטלו` : ''}`, amount: l.reduce((t, o) => t + o.amount, 0), qAmount: l.reduce((t, o) => t + (o.qAmount ?? 0), 0), outcome: `${on.length} בזמן · ${late.length} באיחור · ${part.length} חלקית`, lateMin: '' },
      };
    },
  },
  {
    id: 'customers', title: 'לפי לקוח', desc: 'מי מזמין הכי הרבה – הזמנות, סך, ממוצע וחלק מהסך',
    compute: (all) => {
      const l = live(all); const total = sum(l);
      const rows = [...groupBy(l, (o) => o.customerName).entries()].map(([name, list]) => ({
        id: name, orders: list, cells: { name, count: list.length, sum: sum(list), avg: avg(list), share: pct(sum(list), total), last: lastDate(list) },
      })).sort((a, b) => (b.cells.sum as number) - (a.cells.sum as number));
      return {
        cols: [{ key: 'name', label: 'לקוח' }, { key: 'count', label: 'הזמנות', kind: 'num' }, { key: 'sum', label: 'סך', kind: 'money' }, { key: 'avg', label: 'ממוצע', kind: 'money' }, { key: 'share', label: 'חלק מהסך', kind: 'pct' }, { key: 'last', label: 'הזמנה אחרונה', kind: 'date' }],
        rows, totals: { name: 'סה"כ', count: l.length, sum: total, avg: avg(l), share: 100, last: '' },
        chart: { valueKey: 'sum', labelKey: 'name', title: 'סך לפי לקוח', kind: 'category', money: true },
      };
    },
  },
  {
    id: 'branches', title: 'לפי סניף ואשכול', desc: 'הזמנות וסך לכל סניף, ואיכות האספקה: בזמן, באיחור, חלקית ובוטלו',
    compute: (all) => {
      const rows = [...groupBy(all, (o) => o.branchName).entries()].map(([name, list]) => {
        const l = live(list); const on = outcomeCount(list, 'ontime').length; const late = outcomeCount(list, 'late').length; const part = outcomeCount(list, 'partial').length;
        return { id: name, orders: list, cells: { cluster: list[0].cluster || '—', name, count: l.length, sum: sum(l), avg: avg(l), ontime: pct(on, on + late + part), late, partial: part, cancelled: list.length - l.length } };
      }).sort((a, b) => String(a.cells.cluster).localeCompare(String(b.cells.cluster), 'he') || (b.cells.sum as number) - (a.cells.sum as number));
      const l = live(all); const on = outcomeCount(all, 'ontime').length; const late = outcomeCount(all, 'late').length; const part = outcomeCount(all, 'partial').length;
      return {
        cols: [{ key: 'cluster', label: 'אשכול' }, { key: 'name', label: 'סניף' }, { key: 'count', label: 'הזמנות', kind: 'num' }, { key: 'sum', label: 'סך', kind: 'money' }, { key: 'avg', label: 'ממוצע', kind: 'money' },
          { key: 'ontime', label: 'בזמן', kind: 'pct' }, { key: 'late', label: 'באיחור', kind: 'num' }, { key: 'partial', label: 'חלקית', kind: 'num' }, { key: 'cancelled', label: 'בוטלו', kind: 'num' }],
        rows, totals: { cluster: 'סה"כ', name: '', count: l.length, sum: sum(l), avg: avg(l), ontime: pct(on, on + late + part), late, partial: part, cancelled: all.length - l.length },
        chart: { valueKey: 'sum', labelKey: 'name', title: 'סך לפי סניף', kind: 'category', money: true },
      };
    },
  },
  { id: 'credit', title: 'הקפות', desc: 'הקפות לפי לקוח וטלפון הקפה, לבדיקה מול דוח הקופה', compute: () => ({ cols: [], rows: [] }), link: '/reports/credit' },
  {
    id: 'team', title: 'לפי עובד', desc: 'כמה הזמנות כל עובד טיפל בהן, באיזה סכום, ואיך הן נסגרו',
    compute: (all) => {
      const l = live(all);
      const rows = [...groupBy(all, (o) => o.handler || o.createdBy).entries()].map(([name, list]) => {
        const lv = live(list);
        return { id: name, orders: list, cells: { name, count: lv.length, sum: sum(lv), avg: avg(lv), late: outcomeCount(list, 'late').length, partial: outcomeCount(list, 'partial').length, cancelled: list.length - lv.length } };
      }).sort((a, b) => (b.cells.count as number) - (a.cells.count as number));
      return {
        cols: [{ key: 'name', label: 'עובד' }, { key: 'count', label: 'הזמנות', kind: 'num' }, { key: 'sum', label: 'סך', kind: 'money' }, { key: 'avg', label: 'ממוצע', kind: 'money' },
          { key: 'late', label: 'באיחור', kind: 'num' }, { key: 'partial', label: 'חלקית', kind: 'num' }, { key: 'cancelled', label: 'בוטלו', kind: 'num' }],
        rows, totals: { name: 'סה"כ', count: l.length, sum: sum(l), avg: avg(l), late: outcomeCount(all, 'late').length, partial: outcomeCount(all, 'partial').length, cancelled: all.length - l.length },
        chart: { valueKey: 'count', labelKey: 'name', title: 'הזמנות לפי עובד', kind: 'category' },
      };
    },
  },
];
