/* מחירונים (אפיון 6.7): משותף לכמה לקוחות או ייחודי ללקוח. כל המחירים כוללים מע"מ.
   המחיר נשמר בתוך כל הזמנה – שינוי מחירון לא משנה הזמנות קיימות. כל עריכה נרשמת ביומן. */
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, writeBatch, type Timestamp, type WriteBatch } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

/* בסיס מחיר: מחיר למשלוח (price) ומחיר לאיסוף עצמי (pickupPrice). בלי מחיר איסוף – כמו המשלוח */
export type PriceItem = { id: string; name: string; price: number; pickupPrice?: number; active: boolean };
export const priceOf = (i: Pick<PriceItem, 'price' | 'pickupPrice'>, delivery: 'delivery' | 'pickup') => (delivery === 'pickup' ? i.pickupPrice ?? i.price : i.price);
export type PriceList = { id: string; name: string; kind: 'shared' | 'unique'; active: boolean; items: PriceItem[]; createdAt?: Timestamp };

export function usePriceLists() {
  const [state, setState] = useState<{ items: PriceList[]; loading: boolean; error: string }>({ items: [], loading: true, error: '' });
  useEffect(() => onSnapshot(collection(db, 'priceLists'),
    (s) => setState({ items: s.docs.map((d) => ({ items: [], ...d.data(), id: d.id }) as unknown as PriceList).sort((a, b) => a.name.localeCompare(b.name, 'he')), loading: false, error: '' }),
    () => setState({ items: [], loading: false, error: 'אין הרשאה או אין חיבור' })), []);
  return state;
}

function audit(batch: WriteBatch, entityId: string, action: string, before: unknown, after: unknown) {
  const u = auth.currentUser!;
  batch.set(doc(collection(db, 'auditLog')), {
    entity: 'priceList', entityId, action, before: before ?? null, after: after ?? null, source: 'inline',
    by: u.uid, byName: u.displayName ?? u.email ?? '', at: serverTimestamp(), ok: true,
  });
}

export async function createPriceList(name: string, kind: PriceList['kind'], items: PriceItem[] = []): Promise<string> {
  const u = auth.currentUser!;
  const batch = writeBatch(db);
  const ref = doc(collection(db, 'priceLists'));
  batch.set(ref, { name: name.trim(), kind, active: true, items, createdAt: serverTimestamp(), createdBy: u.uid, updatedAt: serverTimestamp(), updatedBy: u.uid });
  audit(batch, ref.id, 'create', null, { name: name.trim(), kind, items: items.length });
  await batch.commit();
  return ref.id;
}

export async function updatePriceList(pl: PriceList, patch: Partial<Pick<PriceList, 'name' | 'kind' | 'active' | 'items'>>, detail?: unknown) {
  const u = auth.currentUser!;
  const batch = writeBatch(db);
  batch.update(doc(db, 'priceLists', pl.id), { ...patch, updatedAt: serverTimestamp(), updatedBy: u.uid });
  const before = Object.fromEntries(Object.keys(patch).filter((k) => k !== 'items').map((k) => [k, pl[k as keyof PriceList] ?? null]));
  audit(batch, pl.id, 'update', detail ? (detail as { before?: unknown }).before ?? before : before, detail ? (detail as { after?: unknown }).after ?? patch : patch);
  await batch.commit();
}
