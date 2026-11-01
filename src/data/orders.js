/* הזמנות ב-Firestore (אפיון 6.1–6.4, 12). מסמך לכל הזמנה: orders/{מספר}.
   מספר רץ מ-counters/orders בתוך טרנזקציה – שני אחמ"שים ששומרים באותה שנייה לא יקבלו אותו מספר
   (נאכף גם בכללי האבטחה). כל שינוי נכתב יחד עם רשומת יומן; אין מחיקה. */
import { useEffect, useState } from 'react';
import { collection, deleteDoc, deleteField, doc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, setDoc, where, writeBatch, } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { toISODate } from '../lib/format';
import { CLOSED } from './types';
import { cleanTaxId } from '../lib/taxid';
export const FIRST_ORDER_NUMBER = 1001;
const OPEN = ['new', 'pending_customer', 'approved'];
/* מסמך → הזמנה לתצוגה. createdAt נשמר כחותמת זמן של השרת ומוצג כתאריך. */
export function fromDoc(id, d) {
    const at = d.createdAt;
    return {
        items: [], notes: [], poRequired: false, payment: 'pending', status: 'new', delivery: 'delivery', channel: '', handler: '', createdBy: '',
        ...d,
        id: Number(id),
        createdAt: at?.toDate ? toISODate(at.toDate()) : toISODate(new Date()),
    };
}
/* Firestore לא מקבל undefined: בשמירה – משמיטים; בעדכון – undefined פירושו "מחק שדה" */
function clean(o) {
    return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}
function toPatch(patch) {
    return Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === undefined ? deleteField() : v]));
}
function me() {
    const u = auth.currentUser;
    return { uid: u.uid, name: u.displayName ?? u.email ?? '' };
}
function auditDoc(entity, entityId, action, before, after, source, note) {
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
    const [state, setState] = useState({ orders: [], loading: true, error: '' });
    useEffect(() => {
        const now = new Date();
        const since = toISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
        let open = null;
        let recent = null;
        const emit = () => {
            if (!open || !recent)
                return;
            const map = new Map();
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
export function useCustomerOrders(customerId) {
    const [state, setState] = useState({ orders: [], loading: true });
    useEffect(() => onSnapshot(query(collection(db, 'orders'), where('customerId', '==', customerId)), (s) => setState({ orders: s.docs.map((d) => fromDoc(d.id, d.data())), loading: false }), () => setState({ orders: [], loading: false })), [customerId]);
    return state;
}
export function useOrderHistory(orderId) {
    const [items, setItems] = useState(null);
    useEffect(() => onSnapshot(query(collection(db, 'auditLog'), where('entity', '==', 'order'), where('entityId', '==', String(orderId))), (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.at?.seconds ?? 0) - (a.at?.seconds ?? 0))), () => setItems([])), [orderId]);
    return items;
}
/* יוצר הזמנה (ואם צריך – גם לקוח חדש) בפעולה אחת. מחזיר את מספר ההזמנה. */
export async function createOrder(input, newCustomer) {
    const u = me();
    return runTransaction(db, async (tx) => {
        const counterRef = doc(db, 'counters', 'orders');
        const counter = await tx.get(counterRef);
        const n = counter.exists() ? counter.data().next : FIRST_ORDER_NUMBER;
        let customerId = input.customerId;
        if (newCustomer) {
            const cref = doc(collection(db, 'customers'));
            customerId = cref.id;
            const c = { ...newCustomer, name: newCustomer.name.trim(), taxId: cleanTaxId(newCustomer.taxId) };
            tx.set(cref, { ...c, status: 'active', createdAt: serverTimestamp(), createdBy: u.uid, updatedAt: serverTimestamp(), updatedBy: u.uid });
            if (c.taxId)
                tx.set(doc(db, 'taxIds', c.taxId), { customerId: cref.id });
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
export async function updateOrders(orders, patch, source = 'inline', note) {
    const u = me();
    const batch = writeBatch(db);
    const keys = Object.keys(patch);
    for (const o of orders) {
        const changed = keys.filter((k) => JSON.stringify(o[k]) !== JSON.stringify(patch[k]));
        if (!changed.length)
            continue;
        const sub = Object.fromEntries(changed.map((k) => [k, patch[k]]));
        batch.update(doc(db, 'orders', String(o.id)), { ...toPatch(sub), updatedAt: serverTimestamp(), updatedBy: u.uid, updatedByName: u.name });
        const before = Object.fromEntries(changed.map((k) => [k, o[k] ?? null]));
        const after = Object.fromEntries(changed.map((k) => [k, sub[k] ?? null]));
        batch.set(doc(collection(db, 'auditLog')), auditDoc('order', String(o.id), 'status' in sub ? 'status' : 'update', before, after, source, note));
    }
    await batch.commit();
}
/* ---------- כפילות (אפיון 6.4): אותו לקוח, אותו תאריך, אותו סניף, בשעות סמוכות ---------- */
export const NEAR_MINUTES = 180; // ברירת מחדל; בפועל נלקח מספי ההתראות
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export function findDuplicate(all, c, near = NEAR_MINUTES) {
    if (!c.customerId || !c.date || !c.time || !c.branchId)
        return undefined;
    return all.find((o) => o.customerId === c.customerId && o.date === c.date && o.branchId === c.branchId
        && o.status !== 'cancelled' && Math.abs(toMin(o.time) - toMin(c.time)) <= near);
}
export const isClosed = (o) => CLOSED.includes(o.status);
/* הזמנה בודדת שלא נטענה ברשימה החיה (למשל ארכיון ישן מתיק הלקוח) */
export function useOrderDoc(id) {
    const [o, setO] = useState(null);
    useEffect(() => {
        setO(null);
        if (id == null)
            return;
        return onSnapshot(doc(db, 'orders', String(id)), (s) => setO(s.exists() ? fromDoc(s.id, s.data()) : null), () => setO(null));
    }, [id]);
    return o;
}
export function useOrderNotes(orderId) {
    const [items, setItems] = useState(null);
    useEffect(() => onSnapshot(collection(db, 'orders', String(orderId), 'notes'), (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.at?.seconds ?? 9e9) - (b.at?.seconds ?? 9e9))), () => setItems([])), [orderId]);
    return items;
}
export async function addOrderNote(orderId, text) {
    const u = me();
    const batch = writeBatch(db);
    batch.set(doc(collection(db, 'orders', String(orderId), 'notes')), { text: text.trim(), by: u.uid, byName: u.name, at: serverTimestamp() });
    batch.set(doc(collection(db, 'auditLog')), auditDoc('order', String(orderId), 'note', null, { note: text.trim().slice(0, 200) }, 'form'));
    await batch.commit();
}
export class ConflictError extends Error {
    constructor(fields, byName, current) {
        super('conflict');
        this.fields = fields;
        this.byName = byName;
        this.current = current;
    }
}
export async function updateOrderSafe(o, patch, source = 'inline', note) {
    const u = me();
    const keys = Object.keys(patch).filter((k) => JSON.stringify(o[k]) !== JSON.stringify(patch[k]));
    if (!keys.length)
        return;
    await runTransaction(db, async (tx) => {
        const ref = doc(db, 'orders', String(o.id));
        const snap = await tx.get(ref);
        if (!snap.exists())
            throw new Error('missing');
        const cur = fromDoc(snap.id, snap.data());
        const clash = keys.filter((k) => JSON.stringify(cur[k]) !== JSON.stringify(o[k]) && JSON.stringify(cur[k]) !== JSON.stringify(patch[k]));
        if (clash.length) {
            throw new ConflictError(clash.map((k) => ({ key: k, base: o[k], mine: patch[k], theirs: cur[k] })), snap.data().updatedByName ?? '', cur);
        }
        const sub = Object.fromEntries(keys.map((k) => [k, patch[k]]));
        tx.update(ref, { ...toPatch(sub), updatedAt: serverTimestamp(), updatedBy: u.uid, updatedByName: u.name });
        tx.set(doc(collection(db, 'auditLog')), auditDoc('order', String(o.id), 'status' in sub ? 'status' : 'update', Object.fromEntries(keys.map((k) => [k, cur[k] ?? null])), Object.fromEntries(keys.map((k) => [k, sub[k] ?? null])), source, note));
    });
}
/* ---------- "פותח כרגע" (אפיון 8): מי עוד צופה בתיק ההזמנה ----------
   מסמך לכל צופה: orders/{מספר}/viewers/{uid}, מתעדכן כל 40 שניות ונמחק בסגירה. צופה שלא עדכן 90 שניות נחשב כמי שעזב. */
export function useOrderViewers(orderId) {
    const [others, setOthers] = useState([]);
    useEffect(() => {
        const u = auth.currentUser;
        if (!u)
            return;
        const mine = doc(db, 'orders', String(orderId), 'viewers', u.uid);
        const beat = () => setDoc(mine, { name: u.displayName ?? u.email ?? '', at: serverTimestamp() }).catch(() => undefined);
        beat();
        const t = setInterval(beat, 40000);
        const unsub = onSnapshot(collection(db, 'orders', String(orderId), 'viewers'), (s) => {
            const now = Date.now() / 1000;
            setOthers(s.docs.filter((d) => d.id !== u.uid && (d.data().at?.seconds ?? now) > now - 90).map((d) => ({ uid: d.id, name: d.data().name })));
        }, () => setOthers([]));
        return () => { clearInterval(t); unsub(); deleteDoc(mine).catch(() => undefined); };
    }, [orderId]);
    return others;
}
/* ---------- דוחות (אפיון 10): כל ההזמנות בטווח תאריכי אספקה, בקריאה אחת לפי דרישה ----------
   לא מאזינים בזמן אמת – דוח נטען בפתיחה ובלחיצה על "רענן", כדי לשמור על מכסת הקריאות החינמית. */
export function useOrdersRange(from, to) {
    const [state, setState] = useState({ orders: [], loading: true, error: '' });
    const [tick, setTick] = useState(0);
    useEffect(() => {
        let alive = true;
        setState((s) => ({ ...s, loading: true }));
        getDocs(query(collection(db, 'orders'), where('date', '>=', from), where('date', '<=', to)))
            .then((s) => { if (alive)
            setState({ orders: s.docs.map((d) => fromDoc(d.id, d.data())), loading: false, error: '' }); })
            .catch(() => { if (alive)
            setState({ orders: [], loading: false, error: 'אין הרשאה או אין חיבור' }); });
        return () => { alive = false; };
    }, [from, to, tick]);
    return { ...state, reload: () => setTick((t) => t + 1) };
}
/* ייצוא דוח נרשם ביומן */
export async function logReportExport(reportId, after) {
    const batch = writeBatch(db);
    batch.set(doc(collection(db, 'auditLog')), { ...auditDoc('order', `report:${reportId}`, 'export', null, after, 'form'), entity: 'report', entityId: reportId });
    await batch.commit();
}
