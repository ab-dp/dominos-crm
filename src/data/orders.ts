/* הזמנות ב-Firestore (אפיון 6.1–6.4, 12). מסמך לכל הזמנה: orders/{מספר}.
   מספר רץ מ-counters/orders בתוך טרנזקציה – שני אחמ"שים ששומרים באותה שנייה לא יקבלו אותו מספר
   (נאכף גם בכללי האבטחה). כל שינוי נכתב יחד עם רשומת יומן; אין מחיקה. */
import { useEffect, useState } from 'react';
import {
  collection, deleteDoc, deleteField, doc, onSnapshot, query, runTransaction, serverTimestamp, setDoc, where, writeBatch, type DocumentData, type Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { toISODate } from '../lib/format';
import { CLOSED, type Order, type OrderStatus } from './types';
import { cleanTaxId } from '../lib/taxid';
import type { CustomerInput } from './customers';

export const FIRST_ORDER_NUMBER = 1001;
const OPEN: OrderStatus[] = ['new', 'pending_customer', 'approved'];

/* מסמך → הזמנה לתצוגה. createdAt נשמר כחותמת זמן של השרת ומוצג כתאריך. */
export function fromDoc(id: string, d: DocumentData): Order {
  const at = d.createdAt as Timestamp | null | undefined;
  return {
    items: [], notes: [], poRequired: false, payment: 'pending', status: 'new', delivery: 'delivery', channel: '', handler: '', createdBy: '',
    ...d,
    id: Number(id),
    createdAt: at?.toDate ? toISODate(at.toDate()) : toISODate(new Date()),
  } as unknown as Order;
}

/* Firestore לא מקבל undefined: בשמירה – משמיטים; בעדכון – undefined פירושו "מחק שדה" */
function clean<T extends object>(o: T) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}
function toPatch(patch: Partial<Order>) {
  return Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === undefined ? deleteField() : v]));
}

function me() {
  const u = auth.currentUser!;
  return { uid: u.uid, name: u.displayName ?? u.email ?? '' };
}
function auditDoc(entity: 'order' | 'customer', entityId: string, action: string, before: unknown, after: unknown, source: 'form' | 'inline' | 'bulk', note?: string) {
  const u = me();
  return {
    entity, entityId, action, before: before ?? null, after: after ?? null, source, ...(note ? { note } : {}),
    by: u.uid, byName: u.name, at: serverTimestamp(), ok: true,
  };
}

/* ---------- קריאה חיה ----------
   כדי לא לקרוא את כל ההיסטוריה בכל טעינה (מכסת קריאות חינמית): כל ההזמנות הפתוחות, מכל תאריך,
   ועוד כל ההזמנות מתחילת החודש הקודם. ארכיון ישן יותר ייפתח בדוחות (שלב 8). */
export function useLiveOrders() {
  const [state, setState] = useState<{ orders: Order[]; loading: boolean; error: string }>({ orders: [], loading: true, error: '' });
  useEffect(() => {
    const now = new Date();
    const since = toISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    let open: Order[] | null = null;
    let recent: Order[] | null = null;
    const emit = () => {
      if (!open || !recent) return;
      const map = new Map<number, Order>();
      [...recent, ...open].forEach((o) => map.set(o.id, o));
      setState({ orders: [...map.values()], loading: false, error: '' });
    };
    const fail = () => setState((s) => ({ ...s, loading: false, error: 'אין הרשאה או אין חיבור' }));
    const a = onSnapshot(query(collection(db, 'orders'), where('status', 'in', OPEN)), (s) => { open = s.docs.map((d) => fromDoc(d.id, d.data())); emit(); }, fail);
    const b = onSnapshot(query(collection(db, 'orders'), where('date', '>=', since)), (s) => { recent = s.docs.map((d) => fromDoc(d.id, d.data())); emit(); }, fail);
    return () => { a(); b(); };
  }, []);
  return state;
}

/* כל ההזמנות של לקוח אחד – לתיק הלקוח */
export function useCustomerOrders(customerId: string) {
  const [state, setState] = useState<{ orders: Order[]; loading: boolean }>({ orders: [], loading: true });
  useEffect(() => onSnapshot(query(collection(db, 'orders'), where('customerId', '==', customerId)),
    (s) => setState({ orders: s.docs.map((d) => fromDoc(d.id, d.data())), loading: false }),
    () => setState({ orders: [], loading: false })), [customerId]);
  return state;
}

export type OrderAuditRow = { id: string; action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; byName: string; at?: Timestamp; note?: string; source?: string };
export function useOrderHistory(orderId: number) {
  const [items, setItems] = useState<OrderAuditRow[] | null>(null);
  useEffect(() => onSnapshot(query(collection(db, 'auditLog'), where('entity', '==', 'order'), where('entityId', '==', String(orderId))),
    (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }) as OrderAuditRow).sort((a, b) => (b.at?.seconds ?? 0) - (a.at?.seconds ?? 0))),
    () => setItems([])), [orderId]);
  return items;
}

/* ---------- יצירה ---------- */
export type NewOrderInput = Omit<Order, 'id' | 'createdAt' | 'createdBy' | 'createdByUid' | 'notes'>;
export type NewCustomerDraft = CustomerInput;

/* יוצר הזמנה (ואם צריך – גם לקוח חדש) בפעולה אחת. מחזיר את מספר ההזמנה. */
export async function createOrder(input: NewOrderInput, newCustomer?: NewCustomerDraft): Promise<number> {
  const u = me();
  return runTransaction(db, async (tx) => {
    const counterRef = doc(db, 'counters', 'orders');
    const counter = await tx.get(counterRef);
    const n: number = counter.exists() ? counter.data().next : FIRST_ORDER_NUMBER;

    let customerId = input.customerId;
    if (newCustomer) {
      const cref = doc(collection(db, 'customers'));
      customerId = cref.id;
      const c = { ...newCustomer, name: newCustomer.name.trim(), taxId: cleanTaxId(newCustomer.taxId) };
      tx.set(cref, { ...c, status: 'active', createdAt: serverTimestamp(), createdBy: u.uid, updatedAt: serverTimestamp(), updatedBy: u.uid });
      if (c.taxId) tx.set(doc(db, 'taxIds', c.taxId), { customerId: cref.id });
      tx.set(doc(collection(db, 'auditLog')), auditDoc('customer', cref.id, 'create', null, { name: c.name, taxId: c.taxId, type: c.type, withOrder: n }, 'form'));
    }

    const data = clean({
      ...input, customerId, number: n, notes: [],
      createdAt: serverTimestamp(), createdBy: input.handler || u.name, createdByUid: u.uid, updatedAt: serverTimestamp(), updatedBy: u.uid, updatedByName: u.name,
    });
    tx.set(counterRef, { next: n + 1 });
    tx.set(doc(db, 'orders', String(n)), data);
    tx.set(doc(collection(db, 'auditLog')), auditDoc('order', String(n), 'create', null, {
      customerName: input.customerName, date: input.date, time: input.time, branchName: input.branchName, amount: input.amount, status: input.status,
    }, 'form'));
    return n;
  });
}

/* ---------- עדכון: אותו שינוי על הזמנה אחת או כמה, עם ערך קודם ← ערך חדש ביומן ---------- */
export async function updateOrders(orders: Order[], patch: Partial<Order>, source: 'form' | 'inline' | 'bulk' = 'inline', note?: string) {
  const u = me();
  const batch = writeBatch(db);
  const keys = Object.keys(patch) as (keyof Order)[];
  for (const o of orders) {
    const changed = keys.filter((k) => JSON.stringify(o[k]) !== JSON.stringify(patch[k]));
    if (!changed.length) continue;
    const sub = Object.fromEntries(changed.map((k) => [k, patch[k]])) as Partial<Order>;
    batch.update(doc(db, 'orders', String(o.id)), { ...toPatch(sub), updatedAt: serverTimestamp(), updatedBy: u.uid, updatedByName: u.name });
    const before = Object.fromEntries(changed.map((k) => [k, o[k] ?? null]));
    const after = Object.fromEntries(changed.map((k) => [k, sub[k] ?? null]));
    batch.set(doc(collection(db, 'auditLog')), auditDoc('order', String(o.id), 'status' in sub ? 'status' : 'update', before, after, source, note));
  }
  await batch.commit();
}

/* ---------- כפילות (אפיון 6.4): אותו לקוח, אותו תאריך, אותו סניף, בשעות סמוכות ---------- */
export const NEAR_MINUTES = 180; // ברירת מחדל; בפועל נלקח מספי ההתראות
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export function findDuplicate(all: Order[], c: { customerId: string; date: string; time: string; branchId: string }, near = NEAR_MINUTES) {
  if (!c.customerId || !c.date || !c.time || !c.branchId) return undefined;
  return all.find((o) => o.customerId === c.customerId && o.date === c.date && o.branchId === c.branchId
    && o.status !== 'cancelled' && Math.abs(toMin(o.time) - toMin(c.time)) <= near);
}

export const isClosed = (o: Pick<Order, 'status'>) => CLOSED.includes(o.status);

/* הזמנה בודדת שלא נטענה ברשימה החיה (למשל ארכיון ישן מתיק הלקוח) */
export function useOrderDoc(id: number | null) {
  const [o, setO] = useState<Order | null>(null);
  useEffect(() => {
    setO(null);
    if (id == null) return;
    return onSnapshot(doc(db, 'orders', String(id)), (s) => setO(s.exists() ? fromDoc(s.id, s.data()) : null), () => setO(null));
  }, [id]);
  return o;
}

/* ---------- הערות פנימיות: orders/{מספר}/notes. אפשר רק להוסיף – לא לערוך ולא למחוק (נאכף בשרת) ---------- */
export type OrderNote = { id: string; text: string; by: string; byName: string; at?: Timestamp };

export function useOrderNotes(orderId: number) {
  const [items, setItems] = useState<OrderNote[] | null>(null);
  useEffect(() => onSnapshot(collection(db, 'orders', String(orderId), 'notes'),
    (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }) as OrderNote).sort((a, b) => (a.at?.seconds ?? 9e9) - (b.at?.seconds ?? 9e9))),
    () => setItems([])), [orderId]);
  return items;
}

export async function addOrderNote(orderId: number, text: string) {
  const u = me();
  const batch = writeBatch(db);
  batch.set(doc(collection(db, 'orders', String(orderId), 'notes')), { text: text.trim(), by: u.uid, byName: u.name, at: serverTimestamp() });
  batch.set(doc(collection(db, 'auditLog')), auditDoc('order', String(orderId), 'note', null, { note: text.trim().slice(0, 200) }, 'form'));
  await batch.commit();
}

/* ---------- שמירה בטוחה לעבודה מקבילה (אפיון 8) ----------
   לפני כתיבה, בתוך טרנזקציה: בודקים שכל שדה שמשנים עדיין שווה למה שהמשתמש ראה.
   אם מישהו אחר שינה אותו בינתיים – לא דורסים, אלא מחזירים התנגשות עם הערכים של שני הצדדים. */
export type ConflictField = { key: keyof Order; base: unknown; mine: unknown; theirs: unknown };
export class ConflictError extends Error {
  constructor(public fields: ConflictField[], public byName: string, public current: Order) { super('conflict'); }
}

export async function updateOrderSafe(o: Order, patch: Partial<Order>, source: 'form' | 'inline' = 'inline', note?: string) {
  const u = me();
  const keys = (Object.keys(patch) as (keyof Order)[]).filter((k) => JSON.stringify(o[k]) !== JSON.stringify(patch[k]));
  if (!keys.length) return;
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'orders', String(o.id));
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('missing');
    const cur = fromDoc(snap.id, snap.data());
    const clash = keys.filter((k) => JSON.stringify(cur[k]) !== JSON.stringify(o[k]) && JSON.stringify(cur[k]) !== JSON.stringify(patch[k]));
    if (clash.length) {
      throw new ConflictError(clash.map((k) => ({ key: k, base: o[k], mine: patch[k], theirs: cur[k] })), (snap.data().updatedByName as string) ?? '', cur);
    }
    const sub = Object.fromEntries(keys.map((k) => [k, patch[k]])) as Partial<Order>;
    tx.update(ref, { ...toPatch(sub), updatedAt: serverTimestamp(), updatedBy: u.uid, updatedByName: u.name });
    tx.set(doc(collection(db, 'auditLog')), auditDoc('order', String(o.id), 'status' in sub ? 'status' : 'update',
      Object.fromEntries(keys.map((k) => [k, cur[k] ?? null])), Object.fromEntries(keys.map((k) => [k, sub[k] ?? null])), source, note));
  });
}

/* ---------- "פותח כרגע" (אפיון 8): מי עוד צופה בתיק ההזמנה ----------
   מסמך לכל צופה: orders/{מספר}/viewers/{uid}, מתעדכן כל 40 שניות ונמחק בסגירה. צופה שלא עדכן 90 שניות נחשב כמי שעזב. */
export function useOrderViewers(orderId: number) {
  const [others, setOthers] = useState<{ uid: string; name: string }[]>([]);
  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;
    const mine = doc(db, 'orders', String(orderId), 'viewers', u.uid);
    const beat = () => setDoc(mine, { name: u.displayName ?? u.email ?? '', at: serverTimestamp() }).catch(() => undefined);
    beat();
    const t = setInterval(beat, 40000);
    const unsub = onSnapshot(collection(db, 'orders', String(orderId), 'viewers'), (s) => {
      const now = Date.now() / 1000;
      setOthers(s.docs.filter((d) => d.id !== u.uid && (d.data().at?.seconds ?? now) > now - 90).map((d) => ({ uid: d.id, name: d.data().name as string })));
    }, () => setOthers([]));
    return () => { clearInterval(t); unsub(); deleteDoc(mine).catch(() => undefined); };
  }, [orderId]);
  return others;
}
