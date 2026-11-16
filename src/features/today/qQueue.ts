/* תור ההקלדה ל-Q של היום: כל הזמנה של היום (בלי ביטולים) נמצאת בקבוצה אחת, לפי מה שנשאר לעשות בה.
   להקליד ל-Q – הלקוח אישר ועוד אין מספר Q · ממתינות לאישור לקוח – עוד לא מוכנות להקלדה ·
   ירדו ל-Q – יש מספר Q והן עוד פתוחות · נסגרו – סופקו (מלא או חלקי).
   מסך "היום" וכפתור "הבאה להקלדה" בכרטיס ההזמנה קוראים מכאן, כדי שהתור יהיה זהה בשניהם. */
import type { OrderView } from '../../data/store';

export type Lane = 'todo' | 'customer' | 'inq' | 'closed';
export const LANES: Lane[] = ['todo', 'customer', 'inq', 'closed'];

export function laneOf(o: Pick<OrderView, 'status' | 'qNumber'>): Lane | null {
  if (o.status === 'cancelled') return null;
  if (o.status === 'delivered' || o.status === 'partial') return 'closed';
  if (o.qNumber) return 'inq';
  if (o.status === 'new' || o.status === 'pending_customer') return 'customer';
  return 'todo';
}

const byTime = (a: OrderView, b: OrderView) => a.time.localeCompare(b.time) || a.id - b.id;

export function todayLanes(orders: OrderView[], today: string): Record<Lane, OrderView[]> {
  const out: Record<Lane, OrderView[]> = { todo: [], customer: [], inq: [], closed: [] };
  orders.filter((o) => o.date === today).sort(byTime).forEach((o) => {
    const l = laneOf(o);
    if (l) out[l].push(o);
  });
  return out;
}

/* התקדמות היום: כמה מההזמנות של היום (בלי ביטולים) כבר ירדו ל-Q */
export function qProgress(l: Record<Lane, OrderView[]>) {
  const total = l.todo.length + l.customer.length + l.inq.length + l.closed.length;
  const done = l.inq.length + l.closed.filter((o) => !!o.qNumber).length;
  return { total, done, left: total - done };
}

/* ההזמנה הבאה להקלדה: הראשונה לפי שעה בקבוצת "להקליד ל-Q", חוץ מזו שפתוחה עכשיו */
export function nextToType(orders: OrderView[], today: string, exceptId?: number): OrderView | undefined {
  return todayLanes(orders, today).todo.find((o) => o.id !== exceptId);
}

/* "כולם / שלי" – אותו סינון כמו במסך היום */
export const mineOnly = (orders: OrderView[], me: { uid?: string; name?: string } | null | undefined) =>
  orders.filter((o) => (o.handlerUid ? o.handlerUid === me?.uid : o.handler === me?.name));
