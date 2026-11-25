/* סיכום הזמנות לתפעול: כל ההזמנות הפתוחות שלא בוטלו בטווח תאריכים, לפי אשכול ← סניף ← יום ושעה.
   ("סמן שנשלח" והסימונים "חדש / עודכן מאז השליחה" בוטלו בנובמבר 2026. האוסף opsSends נשאר בנתונים ולא נקרא יותר) */
import { toISODate } from '../lib/format';
import { CLOSED, OTHER, PIZZA, categoryOf, type Order, type OrderItem } from './types';

export const NO_CLUSTER = 'ללא אשכול';

/* בסיכום: כל הזמנה פתוחה (לא סופקה ולא בוטלה). כל הזמנה במערכת אושרה על ידי הלקוח – גם הערכים הישנים */
export const inSummary = (o: Pick<Order, 'status'>) => !CLOSED.includes(o.status);
export const inRange = (o: Pick<Order, 'date'>, from: string, to: string) => o.date >= from && o.date <= to;

export type BranchGroup = { name: string; orders: Order[] };
export type ClusterGroup = { name: string; branches: BranchGroup[]; orders: Order[] };
const byWhen = (a: Order, b: Order) => (a.date + a.time).localeCompare(b.date + b.time) || a.id - b.id;
export function groupByCluster(list: Order[]): ClusterGroup[] {
  const m = new Map<string, Map<string, Order[]>>();
  list.forEach((o) => {
    const c = o.cluster?.trim() || NO_CLUSTER;
    const bm = m.get(c) ?? new Map<string, Order[]>();
    m.set(c, bm);
    const b = o.branchName?.trim() || 'ללא סניף';
    bm.set(b, [...(bm.get(b) ?? []), o]);
  });
  return [...m.entries()]
    .sort(([a], [b]) => Number(a === NO_CLUSTER) - Number(b === NO_CLUSTER) || a.localeCompare(b, 'he'))
    .map(([name, bm]) => {
      const branches = [...bm.entries()].sort(([a], [b]) => a.localeCompare(b, 'he')).map(([n, os]) => ({ name: n, orders: [...os].sort(byWhen) }));
      return { name, branches, orders: branches.flatMap((b) => b.orders) };
    });
}

// הזמנה ישנה (שורה בלי קטגוריה) – לפי השם
const isPizza = (i: Pick<OrderItem, 'group' | 'name'>) => i.group === PIZZA || (categoryOf(i) === OTHER && /פיצ|משפחת|אישי/.test(`${i.group ?? ''} ${i.name}`));
export const pizzasIn = (orders: Pick<Order, 'items'>[]) => orders.reduce((t, o) => t + o.items.filter(isPizza).reduce((s, i) => s + i.qty, 0), 0);
export const amountIn = (orders: Pick<Order, 'amount'>[]) => orders.reduce((t, o) => t + o.amount, 0);

/* טווחים מוכנים: מחר, וסופ"ש = שישי ושבת הקרובים (ביום שישי ובשבת – של השבוע הבא) */
const plus = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export function tomorrowRange(now: Date) { const t = toISODate(plus(now, 1)); return { from: t, to: t }; }
export function weekendRange(now: Date) {
  const day = now.getDay(); // 0 ראשון … 5 שישי, 6 שבת
  const fri = plus(now, ((5 - day + 7) % 7) || 7);
  return { from: toISODate(fri), to: toISODate(plus(fri, 1)) };
}

