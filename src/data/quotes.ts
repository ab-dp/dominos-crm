/* הצעות מחיר: מסמך לכל הצעה – quotes/{מספר}, מספר רץ נפרד מההזמנות (counters/quotes, החל מ-1001), בתוך טרנזקציה.
   שורה = קבוצת מוצר וכמות במחיר סופי ליחידה (בלי תוספות). כל המחירים כוללים מע"מ.
   מעקב: סטטוס + יומן הערות (quotes/{מספר}/notes) – כל שינוי סטטוס נרשם שם לבד. lastActivityAt מתעדכן בכל עדכון,
   וממנו התזכורת "אין עדכון כבר יום". אין מחיקה; הצעה שאושרה הופכת להזמנה ומקושרת אליה. */
import { useEffect, useState } from 'react';
import {
  collection, doc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, where, writeBatch, type DocumentData, type Timestamp, type Transaction,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { roundMoney, toISODate } from '../lib/format';
import { CATEGORIES } from './types';
import { addTaskTo } from './tasks';

export const FIRST_QUOTE_NUMBER = 1001;

/* handling = "בטיפול": נשלחה, ומאז היה קשר עם הלקוח (שיחה, אין מענה, נשלחה שוב).
   noanswer – סטטוס ישן: הצעות שסומנו כך ממשיכות להיראות ולעבוד; היום "אין מענה" הוא פעולה עם מונה ניסיונות */
export type QuoteStatus = 'draft' | 'sent' | 'handling' | 'noanswer' | 'approved' | 'rejected' | 'ordered';
export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: 'טיוטה', sent: 'נשלחה – ממתינה לתשובה', handling: 'בטיפול', noanswer: 'אין מענה', approved: 'אושרה', rejected: 'נדחתה', ordered: 'הפכה להזמנה',
};
export const SHORT_STATUS: Record<QuoteStatus, string> = { draft: 'טיוטה', sent: 'נשלחה', handling: 'בטיפול', noanswer: 'אין מענה', approved: 'אושרה', rejected: 'נדחתה', ordered: 'הפכה להזמנה' };
export const WAITING: QuoteStatus[] = ['sent', 'handling', 'noanswer'];
export const OPEN_QUOTE: QuoteStatus[] = ['draft', 'sent', 'handling', 'noanswer', 'approved'];
/* "אשר והפוך להזמנה" – בכל הצעה, חוץ מנדחתה או כזו שכבר הפכה להזמנה */
export const canConvert = (q: Pick<Quote, 'status'>) => q.status !== 'rejected' && q.status !== 'ordered';
/* תאריך חזרה שהגיע (היום או שעבר) – בהצעה שעוד ממתינה לתשובה */
export const callDue = (q: Pick<Quote, 'status' | 'callAt'>, today: string) => WAITING.includes(q.status) && !!q.callAt && q.callAt <= today;
export const REJECT_REASONS = ['מחיר', 'הזמינו ממקום אחר', 'האירוע בוטל', 'אחר'];

export type QuoteLine = { category: string; name: string; qty: number; unitPrice: number; itemId?: string; manual?: boolean };
export type QuoteCustomer = { name: string; contact: string; phone: string; email: string; taxId: string };
export type QuoteFee = { name: string; price: number; itemId?: string };

export type Quote = {
  id: number;
  status: QuoteStatus;
  customerId?: string; // לקוח מה-CRM; ריק = הוקלד חופשי
  customer: QuoteCustomer;
  delivery: 'delivery' | 'pickup';
  fee?: QuoteFee; // דמי משלוח
  date?: string; time?: string; address?: string; // אספקה – לא חובה
  priceListId?: string; priceListName?: string;
  lines: QuoteLine[];
  notes?: string; // הערות שמופיעות בהצעה
  issueDate: string; // תאריך ההצעה
  validDays: number;
  validUntil: string;
  itemsTotal: number;
  total: number;
  rejectReason?: string;
  orderId?: number;
  noAnswerCount?: number; // כמה פעמים התקשרו ולא ענו
  callAt?: string; // לחזור ללקוח בתאריך (YYYY-MM-DD); יש לו משימה פתוחה במסך היום. ריק = לא נקבע
  lastNote?: string; // ההערה האחרונה ביומן – לרשימה
  lastActivityAt?: Timestamp;
  statusAt?: Timestamp;
  sentAt?: Timestamp;
  handler: string; handlerUid: string;
  createdAt?: Timestamp; createdBy?: string; updatedBy?: string; updatedByName?: string;
};
export type QuoteNoteKind = 'note' | 'status' | 'call' | 'noanswer' | 'resent' | 'callback' | 'handler';
export type QuoteNote = { id: string; text: string; kind: QuoteNoteKind; status?: QuoteStatus; by: string; byName: string; at?: Timestamp };

export const EMPTY_QUOTE_CUSTOMER: QuoteCustomer = { name: '', contact: '', phone: '', email: '', taxId: '' };
export const linesTotal = (lines: QuoteLine[]) => roundMoney(lines.reduce((t, l) => t + l.qty * l.unitPrice, 0));
export const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return toISODate(d); };
/* שורות לפי סדר הקטגוריות (כך גם בדף ההצעה) */
export const sortLines = (lines: QuoteLine[]) => [...lines].sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category));

/* פג תוקף: הצעה שעוד לא נסגרה ותאריך התוקף עבר */
export const isExpired = (q: Pick<Quote, 'status' | 'validUntil'>, today: string) => ['draft', 'sent', 'handling', 'noanswer'].includes(q.status) && !!q.validUntil && q.validUntil < today;
/* כמה שעות עברו מהעדכון האחרון – רק בהצעה שממתינה לתשובה ובתוקף */
export function staleHours(q: Quote, now: Date): number | null {
  if (!WAITING.includes(q.status) || isExpired(q, toISODate(now))) return null;
  const s = q.lastActivityAt?.seconds ?? q.statusAt?.seconds;
  if (!s) return null;
  return Math.floor((now.getTime() / 1000 - s) / 3600);
}
/* "אין עדכון כבר X שעות" – רק להצעה בלי תאריך חזרה. כשנקבע תאריך יש משימה פתוחה במסך היום, והיא התזכורת
   (callAt מתאפס כשהמשימה מסומנת בוצעה), כדי שההצעה לא תיספר פעמיים */
export const needsFollowup = (q: Quote, now: Date, hours: number) => {
  if (q.callAt) return false;
  const h = staleHours(q, now);
  return h !== null && h >= hours;
};

export const fromDoc = (id: string, d: DocumentData): Quote => ({
  status: 'draft', customer: EMPTY_QUOTE_CUSTOMER, delivery: 'delivery', lines: [], validDays: 14, validUntil: '', issueDate: '', itemsTotal: 0, total: 0, handler: '', handlerUid: '',
  ...d, id: Number(id),
}) as Quote;

/* ---------- קריאה חיה ----------
   הצעות פתוחות – לכל המערכת (תפריט, מסך היום). כל ההצעות – רק במסך הצעות המחיר */
export function useQuotes(scope: 'open' | 'all' | { customerId: string }) {
  const [state, setState] = useState<{ items: Quote[]; loading: boolean; error: string }>({ items: [], loading: true, error: '' });
  const key = typeof scope === 'string' ? scope : scope.customerId;
  useEffect(() => {
    const base = collection(db, 'quotes');
    const q = scope === 'open' ? query(base, where('status', 'in', OPEN_QUOTE)) : scope === 'all' ? base : query(base, where('customerId', '==', scope.customerId));
    return onSnapshot(q,
      (s) => setState({ items: s.docs.map((d) => fromDoc(d.id, d.data())).sort((a, b) => b.id - a.id), loading: false, error: '' }),
      () => setState({ items: [], loading: false, error: 'אין הרשאה או אין חיבור' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export function useQuote(id: number | null) {
  const [state, setState] = useState<{ q: Quote | null; loading: boolean }>({ q: null, loading: id != null });
  useEffect(() => {
    if (id == null) { setState({ q: null, loading: false }); return; }
    setState({ q: null, loading: true });
    return onSnapshot(doc(db, 'quotes', String(id)), (s) => setState({ q: s.exists() ? fromDoc(s.id, s.data()!) : null, loading: false }), () => setState({ q: null, loading: false }));
  }, [id]);
  return state;
}

export function useQuoteNotes(id: number | null) {
  const [items, setItems] = useState<QuoteNote[]>([]);
  useEffect(() => {
    if (id == null) { setItems([]); return; }
    return onSnapshot(collection(db, 'quotes', String(id), 'notes'),
      (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }) as QuoteNote).sort((a, b) => (b.at?.seconds ?? 9e9) - (a.at?.seconds ?? 9e9))),
      () => setItems([]));
  }, [id]);
  return items;
}

/* ---------- כתיבה – תמיד יחד עם רשומת יומן ---------- */
const me = () => { const u = auth.currentUser!; return { uid: u.uid, name: u.displayName ?? u.email ?? '' }; };
const auditDoc = (entityId: string, action: string, before: unknown, after: unknown, note?: string) => {
  const u = me();
  return { entity: 'quote', entityId, action, before: before ?? null, after: after ?? null, source: 'form', ...(note ? { note } : {}), by: u.uid, byName: u.name, at: serverTimestamp(), ok: true };
};
/* Firestore לא מקבל undefined – שדות ריקים לא נשלחים */
const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
const cleanLine = (l: QuoteLine): QuoteLine => clean({ ...l, name: l.name.trim() }) as QuoteLine;

export type QuoteInput = Omit<Quote, 'id' | 'status' | 'noAnswerCount' | 'callAt' | 'lastNote' | 'lastActivityAt' | 'statusAt' | 'sentAt' | 'createdAt' | 'createdBy' | 'updatedBy' | 'updatedByName' | 'rejectReason' | 'orderId' | 'handler' | 'handlerUid'>;

const summary = (i: QuoteInput) => ({ customer: i.customer.name || '—', lines: i.lines.length, total: i.total });

export async function createQuote(input: QuoteInput): Promise<number> {
  const u = me();
  return runTransaction(db, async (tx) => {
    const counterRef = doc(db, 'counters', 'quotes');
    const counter = await tx.get(counterRef);
    const n: number = counter.exists() ? counter.data().next : FIRST_QUOTE_NUMBER;
    tx.set(counterRef, { next: n + 1 });
    tx.set(doc(db, 'quotes', String(n)), clean({
      ...input, lines: input.lines.map(cleanLine), fee: input.fee ? clean(input.fee) : undefined,
      number: n, status: 'draft', handler: u.name, handlerUid: u.uid, lastNote: '',
      lastActivityAt: serverTimestamp(), statusAt: serverTimestamp(), createdAt: serverTimestamp(), createdBy: u.uid, updatedAt: serverTimestamp(), updatedBy: u.uid, updatedByName: u.name,
    }));
    tx.set(doc(collection(db, 'auditLog')), auditDoc(String(n), 'create', null, summary(input)));
    return n;
  });
}

/* שמירת שינויים בהצעה קיימת. שדה שהתרוקן נשמר ריק (לא undefined) */
export async function saveQuote(q: Quote, input: QuoteInput) {
  const u = me();
  const batch = writeBatch(db);
  const data: Record<string, unknown> = {
    ...input, lines: input.lines.map(cleanLine), fee: input.fee ? clean(input.fee) : null,
    customerId: input.customerId ?? '', priceListId: input.priceListId ?? '', priceListName: input.priceListName ?? '',
    date: input.date ?? '', time: input.time ?? '', address: input.address ?? '', notes: input.notes ?? '',
    updatedAt: serverTimestamp(), updatedBy: u.uid, updatedByName: u.name,
  };
  // הצעה שכבר נשלחה ועודכנה – נרשם ביומן המעקב ומאפס את התזכורת
  const sent = q.status !== 'draft';
  if (sent) {
    data.lastActivityAt = serverTimestamp();
    data.lastNote = 'ההצעה עודכנה';
    batch.set(doc(collection(db, 'quotes', String(q.id), 'notes')), { text: 'ההצעה עודכנה', kind: 'status', status: q.status, by: u.uid, byName: u.name, at: serverTimestamp() });
  }
  batch.update(doc(db, 'quotes', String(q.id)), Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)));
  batch.set(doc(collection(db, 'auditLog')), auditDoc(String(q.id), 'update', { total: q.total, lines: q.lines.length }, summary(input)));
  await batch.commit();
}

const STATUS_TEXT: Record<QuoteStatus, string> = {
  draft: 'הוחזרה לטיוטה', sent: 'סומנה: נשלחה ללקוח', handling: 'הוחזרה לטיפול', noanswer: 'סומנה: אין מענה מהלקוח', approved: 'סומנה: הלקוח אישר', rejected: 'סומנה: נדחתה', ordered: 'הפכה להזמנה',
};
/* שינוי סטטוס – תמיד עם רשומה ביומן המעקב. note – הערה שנכתבה יחד עם השינוי */
/* הצעה שכבר הפכה להזמנה – לא נוגעים בה שוב (שני נציגים / שתי לשוניות שהפכו אותה יחד) */
export class QuoteOrderedError extends Error { constructor(public orderId?: number) { super('quote-ordered'); } }

/* כל שינוי בהצעה נעשה בטרנזקציה מול הגרסה העדכנית בשרת: לחיצה כפולה או שני נציגים לא כותבים פעמיים,
   והמונה / הטקסט מחושבים מהמצב האמיתי ולא מהעותק שעל המסך */
async function onFresh(q: Quote, fn: (cur: Quote, tx: Transaction) => void) {
  const ref = doc(db, 'quotes', String(q.id));
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error('not-found');
    const cur = fromDoc(s.id, s.data());
    if (cur.status === 'ordered') throw new QuoteOrderedError(cur.orderId);
    fn(cur, tx);
  });
}

/* שינוי סטטוס – תמיד עם רשומה ביומן המעקב. note – הערה שנכתבה יחד עם השינוי */
export async function setQuoteStatus(q: Quote, status: QuoteStatus, note = '', extra: { rejectReason?: string; orderId?: number } = {}) {
  const u = me();
  // אושרה / נדחתה / הפכה להזמנה – אין יותר למי לחזור: המשימה הפתוחה נסגרת ותאריך החזרה מתאפס
  const closes = status === 'approved' || status === 'rejected' || status === 'ordered';
  const open = closes ? await openQuoteTasks(q.id) : [];
  await onFresh(q, (cur, tx) => {
    if (cur.status === status) return; // כבר במצב הזה (לחיצה כפולה)
    const ordered = status === 'ordered' && extra.orderId ? (cur.status === 'approved' ? `הפכה להזמנה ${extra.orderId}` : `הלקוח אישר והפכה להזמנה ${extra.orderId}`) : '';
    const text = [ordered || STATUS_TEXT[status], status === 'rejected' && extra.rejectReason ? `סיבה: ${extra.rejectReason}` : '', note.trim()].filter(Boolean).join(' · ');
    open.forEach((r) => tx.update(r, { done: true, doneBy: u.uid, doneByName: u.name, doneAt: serverTimestamp() }));
    tx.update(doc(db, 'quotes', String(q.id)), {
      status, statusAt: serverTimestamp(), lastActivityAt: serverTimestamp(), lastNote: text,
      // הצעה שהפכה להזמנה בלי שסומנה "נשלחה" – נחשבת שנשלחה (לבורד: הצעות שנשלחו והמרה)
      ...((status === 'sent' || status === 'ordered') && !cur.sentAt ? { sentAt: serverTimestamp() } : {}),
      ...(status === 'rejected' ? { rejectReason: extra.rejectReason ?? '' } : {}),
      ...(extra.orderId ? { orderId: extra.orderId } : {}),
      ...(closes && cur.callAt ? { callAt: '' } : {}),
      updatedAt: serverTimestamp(), updatedBy: u.uid, updatedByName: u.name,
    });
    tx.set(doc(collection(db, 'quotes', String(q.id), 'notes')), { text, kind: 'status', status, by: u.uid, byName: u.name, at: serverTimestamp() });
    tx.set(doc(collection(db, 'auditLog')), auditDoc(String(q.id), 'status', { status: cur.status }, { status, ...extra }, note.trim() || undefined));
  });
}

/* הערת מעקב – מאפסת את התזכורת */
export async function addQuoteNote(q: Quote, text: string) {
  const u = me();
  const batch = writeBatch(db);
  batch.set(doc(collection(db, 'quotes', String(q.id), 'notes')), { text: text.trim(), kind: 'note', by: u.uid, byName: u.name, at: serverTimestamp() });
  batch.update(doc(db, 'quotes', String(q.id)), { lastNote: text.trim().slice(0, 300), lastActivityAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: u.uid, updatedByName: u.name });
  batch.set(doc(collection(db, 'auditLog')), auditDoc(String(q.id), 'note', null, { note: text.trim().slice(0, 200) }));
  await batch.commit();
}

/* ---------- פעולות טיפול: כל לחיצה נרשמת ביומן המעקב עם שעה ושם ----------
   שיחה / אין מענה / נשלחה שוב מעבירות הצעה שממתינה לתשובה ל"בטיפול". כל פעולה כזו סוגרת את משימת החזרה הקודמת,
   ואפשר לקבוע איתה תאריך חזרה חדש – הוא נשמר על ההצעה (callAt) והופך למשימה במסך היום ביום שנקבע. */
export type QuoteActionKind = 'call' | 'noanswer' | 'resent' | 'callback';
const ACTION_TEXT: Record<QuoteActionKind, string> = { call: 'שיחה – ממתין להחלטה', noanswer: 'שיחה – אין מענה', resent: 'ההצעה נשלחה שוב', callback: 'נקבע מתי לחזור' };
export const dayMonth = (iso: string) => iso.split('-').reverse().slice(0, 2).join('.');
export const callbackTaskText = (q: Pick<Quote, 'id' | 'customer'>, note = '') =>
  [`לחזור ללקוח – הצעה ${q.id}`, note.trim()].filter(Boolean).join(' · ');

/* משימות החזרה הפתוחות של ההצעה – נסגרות בכל פעולה חדשה (גם אם תאריך החזרה כבר התאפס) */
async function openQuoteTasks(id: number) {
  const s = await getDocs(query(collection(db, 'tasks'), where('quoteId', '==', id), where('done', '==', false)));
  return s.docs.map((d) => d.ref);
}

export async function quoteAction(q: Quote, kind: QuoteActionKind, note = '', callAt = '') {
  if (kind === 'callback' && !callAt) throw new Error('callAt');
  const u = me();
  const open = await openQuoteTasks(q.id);
  await onFresh(q, (cur, tx) => {
    // הצעה שסומנה "אין מענה" בגרסה הישנה – כבר היה ניסיון אחד
    const prev = cur.noAnswerCount ?? (cur.status === 'noanswer' ? 1 : 0);
    const count = prev + 1;
    const head = kind === 'noanswer' ? `${ACTION_TEXT.noanswer} (ניסיון ${count})` : kind === 'callback' ? '' : ACTION_TEXT[kind];
    const text = [head, callAt ? `לחזור ב-${dayMonth(callAt)}` : '', note.trim()].filter(Boolean).join(' · ');
    const toHandling = kind !== 'callback' && WAITING.includes(cur.status) && cur.status !== 'handling';
    open.forEach((r) => tx.update(r, { done: true, doneBy: u.uid, doneByName: u.name, doneAt: serverTimestamp() }));
    if (callAt) addTaskTo(tx, { customerId: cur.customerId ?? '', quoteId: cur.id, customerName: cur.customer.name.trim() || `הצעה ${cur.id}`, text: callbackTaskText(cur, kind === 'callback' ? note : ''), due: callAt });
    tx.update(doc(db, 'quotes', String(q.id)), {
      ...(toHandling ? { status: 'handling', statusAt: serverTimestamp() } : {}),
      ...(kind === 'noanswer' ? { noAnswerCount: count } : {}),
      callAt, lastNote: text.slice(0, 300), lastActivityAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: u.uid, updatedByName: u.name,
    });
    tx.set(doc(collection(db, 'quotes', String(q.id), 'notes')), { text, kind, ...(toHandling ? { status: 'handling' } : {}), by: u.uid, byName: u.name, at: serverTimestamp() });
    tx.set(doc(collection(db, 'auditLog')), auditDoc(String(q.id), kind, { status: cur.status, callAt: cur.callAt ?? '', noAnswerCount: prev },
      { status: toHandling ? 'handling' : cur.status, callAt, noAnswerCount: kind === 'noanswer' ? count : prev }, note.trim().slice(0, 200) || undefined));
  });
}

/* משוך לטיפולך / העבר לטיפול… – ההעברה נרשמת ביומן המעקב */
export async function setQuoteHandler(q: Quote, to: { uid: string; name: string }) {
  const u = me();
  await onFresh(q, (cur, tx) => {
    if (to.uid === cur.handlerUid) return;
    const was = cur.handler ? ` (במקום ${cur.handler})` : '';
    const text = to.uid === u.uid ? `הטיפול נמשך ל${to.name}${was}` : `הטיפול הועבר ל${to.name}${was}`;
    tx.update(doc(db, 'quotes', String(q.id)), { handler: to.name, handlerUid: to.uid, lastNote: text, lastActivityAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: u.uid, updatedByName: u.name });
    tx.set(doc(collection(db, 'quotes', String(q.id), 'notes')), { text, kind: 'handler', by: u.uid, byName: u.name, at: serverTimestamp() });
    tx.set(doc(collection(db, 'auditLog')), auditDoc(String(q.id), 'handler', { handler: cur.handler, handlerUid: cur.handlerUid }, { handler: to.name, handlerUid: to.uid }));
  });
}

/* ---------- תנאים קבועים להצעה: settings/quotes. כולם קוראים, רק מנהל משנה ----------
   בדף ההצעה תמיד מופיעים קודם התוקף ו"המחירים כוללים מע"מ", ואחריהם התנאים האלה */
export const DEFAULT_TERMS = ['ההזמנה תבוצע לאחר אישור ההצעה ותיאום מועד האספקה.', 'שינוי בכמויות או בהרכב המוצרים עשוי לשנות את המחיר.'];
export function useQuoteTerms() {
  const [terms, setTerms] = useState<string[]>(DEFAULT_TERMS);
  useEffect(() => onSnapshot(doc(db, 'settings', 'quotes'),
    (s) => setTerms(Array.isArray(s.data()?.terms) ? (s.data()!.terms as string[]) : DEFAULT_TERMS), () => undefined), []);
  return terms;
}
export async function saveQuoteTerms(terms: string[], before: string[]) {
  const u = me();
  const batch = writeBatch(db);
  batch.set(doc(db, 'settings', 'quotes'), { terms, updatedAt: serverTimestamp(), updatedBy: u.uid });
  batch.set(doc(collection(db, 'auditLog')), { entity: 'settings', entityId: 'quotes', action: 'update', before: { terms: before }, after: { terms }, source: 'form', by: u.uid, byName: u.name, at: serverTimestamp(), ok: true });
  await batch.commit();
}
