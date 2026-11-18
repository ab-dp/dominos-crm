/* סיכום הזמנות לתפעול: כל ההזמנות שהלקוח אישר בטווח תאריכים, לפי אשכול ← סניף ← יום ושעה.
   "סומן שנשלח" שומר לכל אשכול וטווח איזו גרסה של כל הזמנה נשלחה – כך רואים מה נוסף או השתנה מאז ומה ירד מהסיכום. */
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where, type Timestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { toISODate } from '../lib/format';
import { OTHER, PIZZA, categoryOf, type Order, type OrderItem } from './types';

export const NO_CLUSTER = 'ללא אשכול';

/* בסיכום: רק מה שהלקוח אישר ועוד לא נסגר. "ממתין לאישור לקוח" לא נכנס – מוצג כאזהרה למעלה */
export const inSummary = (o: Pick<Order, 'status'>) => o.status === 'approved';
export const awaitingCustomer = (o: Pick<Order, 'status'>) => o.status === 'new' || o.status === 'pending_customer';
export const inRange = (o: Pick<Order, 'date'>, from: string, to: string) => o.date >= from && o.date <= to;

/* הלקוחות שיש להם הזמנות ברשימה – לבחירת לקוח אחד בסיכום. n = כמה הזמנות.
   השם נשמר בכל הזמנה כפי שהיה ביום ההזמנה – לוקחים את השם מההזמנה האחרונה (אם הלקוח שינה שם) */
export function customersIn(list: Pick<Order, 'customerId' | 'customerName' | 'date' | 'time'>[]) {
  const m = new Map<string, { id: string; name: string; n: number; at: string }>();
  list.forEach((o) => {
    if (!o.customerId) return;
    const c = m.get(o.customerId) ?? { id: o.customerId, name: '', n: 0, at: '' };
    const at = o.date + o.time, name = o.customerName?.trim();
    if (name && at >= c.at) { c.name = name; c.at = at; }
    c.n++;
    m.set(o.customerId, c);
  });
  m.forEach((c) => { c.name ||= 'ללא שם'; });
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'he'));
}

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

/* "חתימה" של מה שהתפעול רואה בהזמנה – שינוי בשדה שמופיע בסיכום משנה אותה.
   גרסה 2 (עם הקידומת "2:"): בלי "הערות להזמנה" – הן פנימיות ולא מופיעות בסיכום, ולכן שינוי בהן לא מסמן "עודכן".
   סיכום שסומן כנשלח לפני כן נשמר עם חתימה בגרסה 1 ומושווה אליה – כדי שלא כל ההזמנות שיש בהן הערה יסומנו "עודכן" */
function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function sigFields(o: Order, withNotes: boolean) {
  return [o.date, o.time, o.branchId, o.customerName, o.contactName ?? '', o.contactPhone ?? '', o.delivery, o.address ?? '', o.amount, ...(withNotes ? [o.instructions ?? ''] : []), o.contents ?? '',
    o.items.map((i) => [i.group ?? '', i.name, i.toppings ?? [], i.parts ?? [], i.detail ?? '', i.qty])];
}
export function orderSig(o: Order): string {
  return `2:${hash(JSON.stringify(sigFields(o, false)))}`;
}
/* הזמנה עדיין כמו שנשלחה – לפי גרסת החתימה ששמורה בסימון */
function sameAsSent(was: string, o: Order) {
  return was.startsWith('2:') ? was === orderSig(o) : was === hash(JSON.stringify(sigFields(o, true)));
}

export type OpsSend = { id: string; cluster: string; from: string; to: string; snap: Record<string, string>; by: string; byName: string; at?: Timestamp };
const sendId = (cluster: string, from: string, to: string) => `${from}_${to}_${cluster.replace(/[/\\.#$[\]]/g, '_')}`;

export function useOpsSends(from: string) {
  const [items, setItems] = useState<OpsSend[]>([]);
  useEffect(() => onSnapshot(query(collection(db, 'opsSends'), where('from', '==', from)),
    (s) => setItems(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OpsSend, 'id'>) }))), () => setItems([])), [from]);
  return items;
}

export async function markOpsSent(cluster: string, from: string, to: string, orders: Order[]) {
  const u = auth.currentUser!;
  await setDoc(doc(db, 'opsSends', sendId(cluster, from, to)), {
    cluster, from, to, snap: Object.fromEntries(orders.map((o) => [String(o.id), orderSig(o)])),
    by: u.uid, byName: u.displayName ?? u.email ?? '', at: serverTimestamp(),
  });
}

/* מה השתנה מאז השליחה: הזמנה חדשה, הזמנה ששונתה, והזמנות שירדו (בוטלו, הוזזו לתאריך אחר, נסגרו) */
export function diffSince(send: OpsSend | undefined, orders: Order[]) {
  const mark = new Map<number, 'new' | 'changed'>();
  if (!send) return { mark, removed: [] as string[] };
  orders.forEach((o) => {
    const was = send.snap[String(o.id)];
    if (!was) mark.set(o.id, 'new');
    else if (!sameAsSent(was, o)) mark.set(o.id, 'changed');
  });
  const now = new Set(orders.map((o) => String(o.id)));
  return { mark, removed: Object.keys(send.snap).filter((id) => !now.has(id)) };
}
