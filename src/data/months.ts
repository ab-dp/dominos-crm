/* סגירת חודש (אפיון 4.8, 7): מסמך אחד לכל חודש – months/{YYYY-MM}.
   ההתקדמות נגזרת מהנתונים עצמם (הזמנות + המסמך), כך שמשתמש אחר ממשיך בדיוק מאותו שלב.
   חודש נעול: שינוי סכום, תאריך, סטטוס או תשלום בהזמנה שלו מחייב סיבה (נאכף גם בכללי השרת). */
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { fromDoc } from './orders';
import type { Order } from './types';

export type MonthSummary = {
  count: number; sum: number; cancelled: number;
  byMethod: Record<string, { count: number; sum: number }>;
  byCustomer: { name: string; count: number; sum: number }[];
};
export type MonthDoc = {
  status: 'open' | 'locked';
  checked?: Record<string, boolean>;      // ✓ ליד הזמנות הקפה שנמצאו בדוח הקופה
  exportedAt?: { seconds: number }; exportedByName?: string;
  lockedAt?: { seconds: number }; lockedByName?: string;
  summary?: MonthSummary;                 // עותק קפוא של הסיכומים ברגע הנעילה
  reopenedAt?: { seconds: number }; reopenedByName?: string; reopenReason?: string;
};

/* שדות שננעלים בחודש סגור – תיקון שלהם דורש סיבה */
export const LOCKED_FIELDS: (keyof Order)[] = ['amount', 'qAmount', 'calcAmount', 'deliveryFee', 'date', 'status', 'payment'];

export const monthOf = (date: string) => date.slice(0, 7);
export const monthLabel = (ym: string) => `${ym.slice(5)}.${ym.slice(0, 4)}`;
export function monthRange(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
}

export function useMonth(ym: string) {
  const [state, setState] = useState<{ month: MonthDoc | null; loading: boolean }>({ month: null, loading: true });
  useEffect(() => {
    setState({ month: null, loading: true });
    return onSnapshot(doc(db, 'months', ym), (s) => setState({ month: s.exists() ? (s.data() as MonthDoc) : null, loading: false }), () => setState({ month: null, loading: false }));
  }, [ym]);
  return state;
}

/* הזמנות החודש בזמן אמת – כולל חודשים ישנים שלא נמצאים ברשימה החיה של המסכים הרגילים */
export function useMonthOrders(ym: string) {
  const [state, setState] = useState<{ orders: Order[]; loading: boolean }>({ orders: [], loading: true });
  useEffect(() => {
    setState({ orders: [], loading: true });
    const { from, to } = monthRange(ym);
    return onSnapshot(query(collection(db, 'orders'), where('date', '>=', from), where('date', '<=', to)),
      (s) => setState({ orders: s.docs.map((d) => fromDoc(d.id, d.data())), loading: false }),
      () => setState({ orders: [], loading: false }));
  }, [ym]);
  return state;
}

/* החודשים הנעולים – לכל המערכת, כדי לבקש סיבה לפני תיקון */
export function useLockedMonths() {
  const [locked, setLocked] = useState<string[]>([]);
  useEffect(() => onSnapshot(query(collection(db, 'months'), where('status', '==', 'locked')),
    (s) => setLocked(s.docs.map((d) => d.id)), () => setLocked([])), []);
  return locked;
}

function who() {
  const u = auth.currentUser!;
  return { uid: u.uid, name: u.displayName ?? u.email ?? '' };
}
function auditMonth(ym: string, action: string, after: Record<string, unknown>, note?: string) {
  const u = who();
  return { entity: 'month', entityId: ym, action, before: null, after, source: 'form', ...(note ? { note } : {}), by: u.uid, byName: u.name, at: serverTimestamp(), ok: true };
}

async function write(ym: string, base: MonthDoc | null, patch: Partial<MonthDoc> & Record<string, unknown>, audit?: ReturnType<typeof auditMonth>) {
  const u = who();
  const batch = writeBatch(db);
  batch.set(doc(db, 'months', ym), { status: base?.status ?? 'open', ...patch, updatedBy: u.uid, updatedAt: serverTimestamp() }, { merge: true });
  if (audit) batch.set(doc(collection(db, 'auditLog')), audit);
  await batch.commit();
}

export const setChecked = (ym: string, base: MonthDoc | null, orderId: number, on: boolean) =>
  write(ym, base, { checked: { [orderId]: on } }); // מיזוג: לא דורס ✓ שמשתמש אחר סימן באותו רגע

export const markExported = (ym: string, base: MonthDoc | null, rows: number) =>
  write(ym, base, { exportedAt: serverTimestamp() as never, exportedByName: who().name }, auditMonth(ym, 'export', { rows }));

export const lockMonth = (ym: string, base: MonthDoc | null, summary: MonthSummary) =>
  write(ym, base, { status: 'locked', lockedAt: serverTimestamp() as never, lockedByName: who().name, summary }, auditMonth(ym, 'lock', { count: summary.count, sum: summary.sum }));

export const reopenMonth = (ym: string, base: MonthDoc | null, reason: string) =>
  write(ym, base, { status: 'open', reopenedAt: serverTimestamp() as never, reopenedByName: who().name, reopenReason: reason }, auditMonth(ym, 'reopen', {}, reason));

export function summarize(orders: Order[]): MonthSummary {
  const live = orders.filter((o) => o.status !== 'cancelled');
  const val = (o: Order) => o.qAmount ?? o.amount;
  const byMethod: MonthSummary['byMethod'] = {};
  const byCust = new Map<string, { name: string; count: number; sum: number }>();
  live.forEach((o) => {
    const m = (byMethod[o.method] ??= { count: 0, sum: 0 });
    m.count += 1; m.sum += val(o);
    const c = byCust.get(o.customerId) ?? { name: o.customerName, count: 0, sum: 0 };
    c.count += 1; c.sum += val(o);
    byCust.set(o.customerId, c);
  });
  return {
    count: live.length, sum: live.reduce((t, o) => t + val(o), 0), cancelled: orders.length - live.length,
    byMethod, byCustomer: [...byCust.values()].sort((a, b) => b.sum - a.sum),
  };
}
