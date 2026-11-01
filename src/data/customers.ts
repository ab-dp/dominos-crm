/* לקוחות (אפיון 6.5, 6.6, 12). הלקוח הוא הישות המרכזית. אין מחיקה – רק "לא פעיל" או "מוזג".
   ח.פ ייחודי נאכף בשרת דרך אוסף taxIds/{ח.פ} שנוצר יחד עם הלקוח (batch). */
import { useEffect, useState } from 'react';
import {
  collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch, type Timestamp, type WriteBatch,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { cleanTaxId } from '../lib/taxid';

export type Contact = { id: string; name: string; role: string; phone: string; email: string; primary: boolean };
export type Address = { id: string; label: string; address: string; directions: string; preferredBranchId: string };
export type CustomPrice = { itemId: string; price: number };

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
  status: 'active' | 'inactive' | 'merged';
  mergedInto?: string;
  contacts: Contact[];
  addresses: Address[];
  customPrices: CustomPrice[];
  createdAt?: Timestamp;
  createdBy?: string;
  updatedAt?: Timestamp;
};

export type CustomerInput = Omit<Customer, 'id' | 'status' | 'createdAt' | 'createdBy' | 'updatedAt' | 'mergedInto'>;

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
export function useCustomers() {
  const [state, setState] = useState<{ items: Customer[]; loading: boolean; error: string }>({ items: [], loading: true, error: '' });
  useEffect(() => onSnapshot(collection(db, 'customers'),
    (s) => setState({ items: s.docs.map((d) => ({ ...EMPTY_CUSTOMER, id: d.id, ...d.data() }) as Customer).sort((a, b) => a.name.localeCompare(b.name, 'he')), loading: false, error: '' }),
    () => setState({ items: [], loading: false, error: 'אין הרשאה או אין חיבור' })), []);
  return state;
}

export function useActivity(customerId: string) {
  const [items, setItems] = useState<Activity[]>([]);
  useEffect(() => onSnapshot(query(collection(db, 'customers', customerId, 'activity'), orderBy('at', 'desc')),
    (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Activity)), () => setItems([])), [customerId]);
  return items;
}

export type AuditRow = { id: string; action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; byName: string; at?: Timestamp; note?: string };
export function useCustomerHistory(customerId: string) {
  const [items, setItems] = useState<AuditRow[]>([]);
  useEffect(() => onSnapshot(query(collection(db, 'auditLog'), where('entity', '==', 'customer'), where('entityId', '==', customerId)),
    (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditRow).sort((a, b) => (b.at?.seconds ?? 0) - (a.at?.seconds ?? 0))),
    () => setItems([])), [customerId]);
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

export async function addActivity(customerId: string, a: Pick<Activity, 'kind' | 'text' | 'due'>) {
  const u = auth.currentUser!;
  const batch = writeBatch(db);
  batch.set(doc(collection(db, 'customers', customerId, 'activity')), {
    kind: a.kind, text: a.text.trim(), ...(a.due ? { due: a.due } : {}), by: u.uid, byName: u.displayName ?? u.email ?? '', at: serverTimestamp(),
  });
  await batch.commit();
}

/* מיזוג (אפיון 6.5): הלקוח הכפול מסומן "מוזג" ומצביע על הלקוח שנשאר; אנשי קשר וכתובות חסרים עוברים אליו.
   כל ההזמנות של הכפול עוברות ללקוח שנשאר באותה פעולה, עם רשומת יומן לכל הזמנה. */
export async function mergeCustomers(source: Customer, target: Customer, note: string) {
  const u = auth.currentUser!;
  const batch = writeBatch(db);
  const contacts = [...target.contacts, ...source.contacts.filter((c) => !target.contacts.some((t) => t.phone && t.phone === c.phone)).map((c) => ({ ...c, primary: false }))];
  const addresses = [...target.addresses, ...source.addresses.filter((a) => !target.addresses.some((t) => t.address === a.address))];
  batch.update(doc(db, 'customers', target.id), { contacts, addresses, updatedAt: serverTimestamp(), updatedBy: u.uid });
  batch.update(doc(db, 'customers', source.id), { status: 'merged', mergedInto: target.id, updatedAt: serverTimestamp(), updatedBy: u.uid });
  const moved = await getDocs(query(collection(db, 'orders'), where('customerId', '==', source.id)));
  moved.docs.forEach((d) => {
    batch.update(d.ref, { customerId: target.id, customerName: target.name, updatedAt: serverTimestamp(), updatedBy: u.uid });
    batch.set(doc(collection(db, 'auditLog')), {
      entity: 'order', entityId: d.id, action: 'update', before: { customerName: source.name }, after: { customerName: target.name }, source: 'form', note: 'מיזוג לקוחות',
      by: u.uid, byName: u.displayName ?? u.email ?? '', at: serverTimestamp(), ok: true,
    });
  });
  audit(batch, source.id, 'merge', { status: source.status }, { status: 'merged', mergedInto: target.id, targetName: target.name, orders: moved.size }, note);
  audit(batch, target.id, 'merge', null, { mergedFrom: source.id, sourceName: source.name }, note);
  await batch.commit();
}
