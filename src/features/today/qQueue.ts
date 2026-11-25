/* תור ההקלדה ל-Q של היום: כל הזמנה של היום (בלי ביטולים) נמצאת בקבוצה אחת, לפי מה שנשאר לעשות בה.
   להקליד ל-Q – עוד אין מספר Q · בהמתנה – סומנה 'בהמתנה' ועוד לא הגיע הזמן לחזור אליה ·
   ירדו ל-Q – יש מספר Q והן עוד פתוחות · נסגרו – סופקו (מלא או חלקי).
   מסך "היום" וכפתור "הבאה להקלדה" בכרטיס ההזמנה קוראים מכאן, כדי שהתור יהיה זהה בשניהם. */
import type { OrderView } from '../../data/store';
import { holdDue } from '../../data/types';

export type Lane = 'todo' | 'hold' | 'inq' | 'closed';

export function laneOf(o: Pick<OrderView, 'status' | 'qNumber' | 'hold'>, now: Date): Lane | null {
  if (o.status === 'cancelled') return null;
  if (o.status === 'delivered' || o.status === 'partial') return 'closed';
  if (o.qNumber) return 'inq';
  // בהמתנה עד שמגיע הזמן לחזור; אז חוזרת לקבוצה הרגילה שלה (ובראש 'להקליד ל-Q')
  if (o.hold && !holdDue(o.hold, now)) return 'hold';
  return 'todo';
}

const byTime = (a: OrderView, b: OrderView) => a.time.localeCompare(b.time) || a.id - b.id;
// הזמנה שחזרה מהמתנה (הגיע הזמן) – בראש התור, לפני השאר
const backFirst = (now: Date) => (a: OrderView, b: OrderView) => Number(holdDue(b.hold, now)) - Number(holdDue(a.hold, now)) || byTime(a, b);

export function todayLanes(orders: OrderView[], today: string, now: Date): Record<Lane, OrderView[]> {
  const out: Record<Lane, OrderView[]> = { todo: [], hold: [], inq: [], closed: [] };
  orders.filter((o) => o.date === today).sort(byTime).forEach((o) => {
    const l = laneOf(o, now);
    if (l) out[l].push(o);
  });
  out.todo.sort(backFirst(now));
  return out;
}

/* התקדמות היום: כמה מההזמנות של היום (בלי ביטולים) כבר ירדו ל-Q */
export function qProgress(l: Record<Lane, OrderView[]>) {
  const total = l.todo.length + l.hold.length + l.inq.length + l.closed.length;
  const done = l.inq.length + l.closed.filter((o) => !!o.qNumber).length;
  return { total, done, left: total - done };
}

/* ההזמנה הבאה להקלדה: הראשונה בקבוצת "להקליד ל-Q" (מה שחזר מהמתנה, ואז לפי שעה), חוץ מזו שפתוחה עכשיו. מה שבהמתנה – מדלגים */
export function nextToType(orders: OrderView[], today: string, now: Date, exceptId?: number): OrderView | undefined {
  return todayLanes(orders, today, now).todo.find((o) => o.id !== exceptId);
}

/* "כולם / שלי" – אותו סינון כמו במסך היום */
export const mineOnly = (orders: OrderView[], me: { uid?: string; name?: string } | null | undefined) =>
  orders.filter((o) => (o.handlerUid ? o.handlerUid === me?.uid : o.handler === me?.name));
