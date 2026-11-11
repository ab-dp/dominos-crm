/* לקוחות (אפיון 6.5, 6.6, 12). הלקוח הוא הישות המרכזית. אין מחיקה – רק "לא פעיל" או "מוזג".
   ח.פ ייחודי נאכף בשרת דרך אוסף taxIds/{ח.פ} שנוצר יחד עם הלקוח (batch). */
import { useEffect, useState } from 'react';
import {
  collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch, type DocumentData, type Timestamp, type WriteBatch,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { cleanTaxId } from '../lib/taxid';
import { addTaskTo } from './tasks';
import { byName, useLiveCollection } from './live';

export type Contact = { id: string; name: string; role: string; phone: string; email: string; emails?: string[]; primary: boolean }; // emails – מיילים נוספים
export type Address = { id: string; label: string; address: string; directions: string; preferredBranchId: string };
/* מחיר מיוחד ללקוח לבסיס מחיר: למשלוח (price), ולאיסוף (pickupPrice – אם חסר, כמו המשלוח) */
export type CustomPrice = { itemId: string; price: number; pickupPrice?: number };

export type Customer = {
  id: string;
  name: string;
  type: 'regular' | 'occasional';
  taxId: string;
  businessAddress: string;
  paymentMethod: string; // מזהה מרשימת אמצעי התשלום: credit / account / cash
  accountPhone: string;
  poRequired: boolean;
  instructions: string;
  billingInstructions: string;
  priceListId: string;
  priceNote?: string; // הערת מחיר ידנית, למשל "מחיר לפי ממשק WellBe"
  status: 'active' | 'inactive' | 'merged';
  mergedInto?: string;
  mergedFrom?: string[]; // לקוחות שמוזגו לתוך הלקוח הזה – הפעילות, ההיסטוריה והמסמכים שלהם מוצגים בתיק שלו
  leadId?: string; // נוצר מליד (אפיון 19.1) – למדידת המרה
  contacts: Contact[];
  addresses: Address[];
  customPrices: CustomPrice[];
  createdAt?: Timestamp;
  createdBy?: string;
  updatedAt?: Timestamp;
};

export type CustomerInput = Omit<Customer, 'id' | 'status' | 'createdAt' | 'createdBy' | 'updatedAt' | 'mergedInto' | 'mergedFrom'>;

export type Activity = { id: string; kind: 'note' | 'call' | 'followup'; text: string; due?: string; by: string; byName: string; at?: Timestamp };

export const EMPTY_CUSTOMER: CustomerInput = {
  name: '', type: 'regular', taxId: '', businessAddress: '', paymentMethod: 'account', accountPhone: '', poRequired: false,
  instructions: '', billingInstructions: '', priceListId: '', contacts: [], addresses: [], customPrices: [],
};

export const newId = () => Math.random().toString(36).slice(2, 10);

export function primaryContact(c: Pick<Customer, 'contacts'>): Contact | undefined {
  return c.contacts.find((x) => x.primary) ?? c.contacts[0];
}

/* ---------- קריאה חיה ---------- */
/* האזנה משותפת אחת לכל המערכת (live.ts) – פתיחה חוזרת של מסך לא קוראת שוב את כל הלקוחות */
const toCustomer = (id: string, d: DocumentData) => ({ ...EMPTY_CUSTOMER, id, ...d }) as Customer;
export function useCustomers() {
  return useLiveCollection<Customer>('customers', toCustomer, byName);
}

/* הלקוח עצמו, ואחריו הלקוחות שמוזגו לתוכו (הפעילות, ההיסטוריה והמסמכים שלהם נשארים אצלם, ומוצגים יחד) */
export const withMerged = (c: Pick<Customer, 'id' | 'mergedFrom'>) => [c.id, ...(c.mergedFrom ?? [])].slice(0, 30);
export function useActivity(ids: string[]) {
  const [byId, setById] = useState<Record<string, Activity[]>>({});
  const key = ids.join(',');
  useEffect(() => {
    setById({});
    const subs = key.split(',').map((id) => onSnapshot(query(collection(db, 'customers', id, 'activity'), orderBy('at', 'desc')),
      (s) => setById((m) => ({ ...m, [id]: s.docs.map((d) => ({ id: d.id, ...d.data() }) as Activity) })), () => undefined));
    return () => subs.forEach((u) => u());
  }, [key]);
  return Object.values(byId).flat().sort((x, y) => (y.at?.seconds ?? 9e9) - (x.at?.seconds ?? 9e9));
}

export type AuditRow = { id: string; action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; byName: string; at?: Timestamp; note?: string };
export function useCustomerHistory(ids: string[]) {
  const [items, setItems] = useState<AuditRow[]>([]);
  const key = ids.join(',');
  useEffect(() => onSnapshot(query(collection(db, 'auditLog'), where('entity', '==', 'customer'), where('entityId', 'in', key.split(','))),
    (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditRow).sort((a, b) => (b.at?.seconds ?? 0) - (a.at?.seconds ?? 0))),
    () => setItems([])), [key]);
  return items;
}

/* ---------- כתיבה – תמיד יחד עם רשומת יומן ---------- */
function audit(batch: WriteBatch, entityId: string, action: string, before: unknown, after: unknown, note?: string) {
  const u = auth.currentUser!;
  batch.set(doc(collection(db, 'auditLog')), {
    entity: 'customer', entityId, action, before: before ?? null, after: after ?? null, source: 'form', ...(note ? { note } : {}),
    by: u.uid, byName: u.displayName ?? u.email ?? '', at: serverTimestamp(), ok: true,
  });
}

function normalize(input: CustomerInput): CustomerInput {
  return { ...input, name: input.name.trim(), taxId: cleanTaxId(input.taxId), accountPhone: input.accountPhone.replace(/\D/g, '') };
}

export async function createCustomer(raw: CustomerInput): Promise<string> {
  const input = normalize(raw);
  const u = auth.currentUser!;
  const batch = writeBatch(db);
  const ref = doc(collection(db, 'customers'));
  batch.set(ref, { ...input, status: 'active', createdAt: serverTimestamp(), createdBy: u.uid, updatedAt: serverTimestamp(), updatedBy: u.uid });
  if (input.taxId) batch.set(doc(db, 'taxIds', input.taxId), { customerId: ref.id });
  audit(batch, ref.id, 'create', null, { name: input.name, taxId: input.taxId, type: input.type });
  await batch.commit();
  return ref.id;
}

/* שומר רק את השדות ששונו, ורושם ביומן ערך קודם ← ערך חדש */
export async function updateCustomer(c: Customer, raw: Partial<CustomerInput> & { status?: Customer['status'] }, note?: string) {
  const next = raw.taxId !== undefined || raw.name !== undefined || raw.accountPhone !== undefined
    ? { ...raw, ...(raw.name !== undefined ? { name: raw.name.trim() } : {}), ...(raw.taxId !== undefined ? { taxId: cleanTaxId(raw.taxId) } : {}), ...(raw.accountPhone !== undefined ? { accountPhone: raw.accountPhone.replace(/\D/g, '') } : {}) }
    : raw;
  const changed = Object.fromEntries(Object.entries(next).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(c[k as keyof Customer])));
  if (!Object.keys(changed).length) return;
  const u = auth.currentUser!;
  const batch = writeBatch(db);
  batch.update(doc(db, 'customers', c.id), { ...changed, updatedAt: serverTimestamp(), updatedBy: u.uid });
  if ('taxId' in changed) {
    if (c.taxId) batch.delete(doc(db, 'taxIds', c.taxId));
    if (changed.taxId) batch.set(doc(db, 'taxIds', changed.taxId as string), { customerId: c.id });
  }
  const before = Object.fromEntries(Object.keys(changed).map((k) => [k, c[k as keyof Customer] ?? null]));
  audit(batch, c.id, 'status' in changed ? 'status' : 'update', before, changed, note);
  await batch.commit();
}

export async function addActivity(customerId: string, a: Pick<Activity, 'kind' | 'text' | 'due'>, customerName = '') {
  const u = auth.currentUser!;
  const batch = writeBatch(db);
  batch.set(doc(collection(db, 'customers', customerId, 'activity')), {
    kind: a.kind, text: a.text.trim(), ...(a.due ? { due: a.due } : {}), by: u.uid, byName: u.displayName ?? u.email ?? '', at: serverTimestamp(),
  });
  // משימת חזרה עם תאריך מופיעה גם במסך החריגים ביום שלה
  if (a.kind === 'followup' && a.due) addTaskTo(batch, { customerId, customerName, text: a.text, due: a.due });
  await batch.commit();
}

/* ---------- מיזוג לקוח כפול (אפיון 6.5) ----------
   הלקוח הכפול (source) מסומן "מוזג" ומצביע על הלקוח שנשאר (target). עוברים: אנשי קשר וכתובות חסרים, כל ההזמנות,
   הצעות המחיר והמשימות הפתוחות, ופרטי הלקוח – ח.פ, סוג, תשלום, טלפון הקפה, תעודת רכש, מחירון ומחירים ייחודיים, הנחיות.
   שדה ששני הלקוחות מילאו אחרת הוא "סתירה": המשתמש בוחר איזה ערך נשאר (mergeDiffs). שדה שרק הכפול מילא עובר לבד.
   הפעילות, ההיסטוריה והמסמכים נשארים רשומים על הכפול (אי אפשר לערוך אותם), ומוצגים בתיק של הלקוח שנשאר דרך mergedFrom. */
export type MergeField = 'type' | 'taxId' | 'businessAddress' | 'paymentMethod' | 'accountPhone' | 'poRequired' | 'priceListId' | 'priceNote' | 'instructions' | 'billingInstructions';
export const MERGE_FIELDS: MergeField[] = ['type', 'taxId', 'businessAddress', 'paymentMethod', 'accountPhone', 'poRequired', 'priceListId', 'priceNote', 'instructions', 'billingInstructions'];
export type MergeSide = 'source' | 'target';
export type MergeChoice = Partial<Record<MergeField, MergeSide>>;
export type MergeDiff = { field: MergeField; source: string | boolean; target: string | boolean; kind: 'conflict' | 'fill'; def: MergeSide };

const val = (c: Customer, k: MergeField): string | boolean => (k === 'poRequired' ? !!c.poRequired : String(c[k] ?? '').trim());
/* מה שונה בין שני הלקוחות: fill – רק הכפול מילא (עובר לבד); conflict – שניהם מילאו אחרת (צריך לבחור) */
export function mergeDiffs(source: Customer, target: Customer): MergeDiff[] {
  const out: MergeDiff[] = [];
  MERGE_FIELDS.forEach((field) => {
    const s = val(source, field); const t = val(target, field);
    if (s === t || s === '') return;
    // תעודת רכש: כן/לא – אין "ריק". ברירת המחדל היא "נדרשת", כדי שלא תיעלם דרישה
    if (field === 'poRequired') out.push({ field, source: s, target: t, kind: 'conflict', def: s === true ? 'source' : 'target' });
    else out.push({ field, source: s, target: t, kind: t === '' ? 'fill' : 'conflict', def: t === '' ? 'source' : 'target' });
  });
  return out;
}

/* פרטי הלקוח שנשאר אחרי המיזוג, לפי הבחירות */
export function mergedFields(source: Customer, target: Customer, choice: MergeChoice) {
  const side = (d: MergeDiff) => (d.kind === 'fill' ? 'source' : choice[d.field] ?? d.def);
  const fromSource = mergeDiffs(source, target).filter((d) => side(d) === 'source').map((d) => d.field);
  const patch: Partial<CustomerInput> = Object.fromEntries(fromSource.map((k) => [k, source[k]]));
  // מחירים ייחודיים שייכים למחירון: הולכים עם המחירון שנבחר. באותו מחירון – מתאחדים, ושל הלקוח שנשאר גוברים
  const listFromSource = fromSource.includes('priceListId');
  const sameList = (source.priceListId || '') === (target.priceListId || '');
  const customPrices = listFromSource ? source.customPrices
    : sameList ? [...target.customPrices, ...source.customPrices.filter((p) => !target.customPrices.some((t) => t.itemId === p.itemId))]
      : target.customPrices;
  const contacts = [...target.contacts, ...source.contacts.filter((c) => !target.contacts.some((t) => t.phone && t.phone === c.phone)).map((c) => ({ ...c, primary: target.contacts.length ? false : c.primary }))];
  const addresses = [...target.addresses, ...source.addresses.filter((a) => !target.addresses.some((t) => t.address === a.address))];
  return { patch, fromSource, customPrices, contacts, addresses, addedContacts: contacts.length - target.contacts.length, addedAddresses: addresses.length - target.addresses.length };
}

/* מה יעבור – לתצוגה לפני האישור */
export type MergeCounts = { orders: number; quotes: number; tasks: number; docs: number };
async function mergeItems(sourceId: string) {
  const [orders, quotes, tasks, docs] = await Promise.all([
    getDocs(query(collection(db, 'orders'), where('customerId', '==', sourceId))),
    getDocs(query(collection(db, 'quotes'), where('customerId', '==', sourceId))),
    getDocs(query(collection(db, 'tasks'), where('customerId', '==', sourceId))),
    getDocs(query(collection(db, 'orderDocs'), where('customerId', '==', sourceId))),
  ]);
  return { orders: orders.docs, quotes: quotes.docs, tasks: tasks.docs.filter((d) => d.data().done === false && !d.data().leadId), docs: docs.docs };
}
export async function mergeCounts(sourceId: string): Promise<MergeCounts> {
  const i = await mergeItems(sourceId);
  return { orders: i.orders.length, quotes: i.quotes.length, tasks: i.tasks.length, docs: i.docs.length };
}

export async function mergeCustomers(source: Customer, target: Customer, note: string, choice: MergeChoice = {}) {
  const u = auth.currentUser!;
  const byName = u.displayName ?? u.email ?? '';
  const stamp = { updatedAt: serverTimestamp(), updatedBy: u.uid };
  const m = mergedFields(source, target, choice);
  // מגבלות הכללים על לקוח: בודקים לפני שמשהו עובר, כדי לא לעצור באמצע
  if (m.contacts.length > 30 || m.addresses.length > 30 || m.customPrices.length > 500) throw new Error('merge-too-big');
  const items = await mergeItems(source.id);

  /* 1. הזמנות, הצעות ומשימות עוברות קודם, בקבוצות (עד 500 כתיבות בפעולה). אם משהו נכשל באמצע, הלקוח הכפול
        עדיין פעיל ואפשר למזג שוב – מה שכבר עבר פשוט לא יימצא אצלו. */
  type Op = (b: WriteBatch) => void;
  const groups: Op[][] = [];
  items.orders.forEach((d) => groups.push([
    (b) => b.update(d.ref, { customerId: target.id, customerName: target.name, ...stamp }),
    (b) => b.set(doc(collection(db, 'auditLog')), {
      entity: 'order', entityId: d.id, action: 'update', before: { customerName: source.name }, after: { customerName: target.name }, source: 'form', note: 'מיזוג לקוחות',
      by: u.uid, byName, at: serverTimestamp(), ok: true,
    }),
  ]));
  items.quotes.forEach((d) => groups.push([(b) => b.update(d.ref, { customerId: target.id, ...stamp, updatedByName: byName })]));
  // משימה לא ניתנת לעריכה (רק "בוצע"), ולכן נפתחת משימה זהה על הלקוח שנשאר והמקורית נסגרת
  items.tasks.forEach((d) => groups.push([
    (b) => { addTaskTo(b, { customerId: target.id, customerName: target.name, text: String(d.data().text), due: String(d.data().due) }); },
    (b) => b.update(d.ref, { done: true, doneBy: u.uid, doneByName: byName, doneAt: serverTimestamp() }),
  ]));
  let batch = writeBatch(db); let n = 0;
  for (const g of groups) {
    if (n + g.length > 400) { await batch.commit(); batch = writeBatch(db); n = 0; }
    g.forEach((op) => op(batch)); n += g.length;
  }
  if (n) await batch.commit();

  /* 2. ח.פ: מסמך הייחודיות taxIds/{ח.פ} מצביע על לקוח אחד, ואי אפשר להעביר אותו – רק לשחרר וליצור מחדש.
        כשה-ח.פ של הכפול עובר ללקוח שנשאר, קודם משחררים אותו מהכפול (פעולה נפרדת), ואז יוצרים אותו על הלקוח שנשאר. */
  const takeTax = m.fromSource.includes('taxId');
  const releaseTax = !!source.taxId && source.taxId !== target.taxId;
  if (takeTax) {
    const pre = writeBatch(db);
    pre.update(doc(db, 'customers', source.id), { taxId: '', ...stamp });
    pre.delete(doc(db, 'taxIds', source.taxId));
    await pre.commit();
  }

  /* 3. פרטי הלקוח שנשאר, סגירת הכפול, ויומן – בפעולה אחת */
  const last = writeBatch(db);
  const rest = Object.fromEntries(Object.entries(m.patch).filter(([k]) => k !== 'taxId'));
  const targetPatch = {
    ...rest, ...(takeTax ? { taxId: source.taxId } : {}), contacts: m.contacts, addresses: m.addresses, customPrices: m.customPrices,
    mergedFrom: [...new Set([...(target.mergedFrom ?? []), source.id, ...(source.mergedFrom ?? [])])],
  };
  last.update(doc(db, 'customers', target.id), { ...targetPatch, ...stamp });
  if (takeTax) {
    if (target.taxId) last.delete(doc(db, 'taxIds', target.taxId));
    last.set(doc(db, 'taxIds', source.taxId), { customerId: target.id });
  }
  last.update(doc(db, 'customers', source.id), { status: 'merged', mergedInto: target.id, ...(releaseTax ? { taxId: '' } : {}), ...stamp });
  if (releaseTax && !takeTax) last.delete(doc(db, 'taxIds', source.taxId));
  const moved = { orders: items.orders.length, quotes: items.quotes.length, tasks: items.tasks.length, addedContacts: m.addedContacts, addedAddresses: m.addedAddresses };
  audit(last, source.id, 'merge', { status: source.status, taxId: source.taxId }, { status: 'merged', mergedInto: target.id, targetName: target.name, ...moved }, note);
  audit(last, target.id, 'merge', Object.fromEntries(m.fromSource.map((k) => [k, target[k] ?? null])), { mergedFrom: source.id, sourceName: source.name, ...Object.fromEntries(m.fromSource.map((k) => [k, source[k] ?? null])), ...moved }, note);
  try { await last.commit(); } catch (e) {
    // הפעולה האחרונה נכשלה אחרי שה-ח.פ שוחרר: מחזירים אותו ללקוח הכפול, כדי שלא יישאר בלי בעלים
    if (takeTax) {
      const back = writeBatch(db);
      back.update(doc(db, 'customers', source.id), { taxId: source.taxId, ...stamp });
      back.set(doc(db, 'taxIds', source.taxId), { customerId: source.id });
      await back.commit().catch(() => undefined);
    }
    throw e;
  }
  return moved;
}

/* מה חסר בתיק הלקוח (אפיון 10: התחלה נקייה – משלימים בהדרגה). tab: איפה משלימים בתיק. */
export type CustomerGap = { label: string; tab: 'overview' | 'prices' | 'payment' | 'contacts' };
export function customerGaps(c: Customer): CustomerGap[] {
  const g: CustomerGap[] = [];
  if (!c.contacts.length) g.push({ label: 'איש קשר', tab: 'contacts' });
  else if (!c.contacts.some((x) => x.phone)) g.push({ label: 'טלפון איש קשר', tab: 'contacts' });
  if (!c.addresses.length) g.push({ label: 'כתובת אספקה', tab: 'contacts' });
  if (c.type === 'regular' && !c.taxId) g.push({ label: 'ח.פ', tab: 'overview' });
  if (c.type === 'regular' && !c.priceListId && !c.priceNote?.trim()) g.push({ label: 'מחירון', tab: 'prices' });
  if (c.paymentMethod === 'account' && !c.accountPhone) g.push({ label: 'טלפון הקפה', tab: 'payment' });
  if (c.paymentMethod === 'account' && !c.billingInstructions) g.push({ label: 'הנחיות חיוב', tab: 'payment' });
  return g;
}
