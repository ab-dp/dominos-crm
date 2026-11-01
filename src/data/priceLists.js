/* מחירונים (אפיון 6.7): משותף לכמה לקוחות או ייחודי ללקוח. כל המחירים כוללים מע"מ.
   המחיר נשמר בתוך כל הזמנה – שינוי מחירון לא משנה הזמנות קיימות. כל עריכה נרשמת ביומן. */
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
export function usePriceLists() {
    const [state, setState] = useState({ items: [], loading: true, error: '' });
    useEffect(() => onSnapshot(collection(db, 'priceLists'), (s) => setState({ items: s.docs.map((d) => ({ items: [], ...d.data(), id: d.id })).sort((a, b) => a.name.localeCompare(b.name, 'he')), loading: false, error: '' }), () => setState({ items: [], loading: false, error: 'אין הרשאה או אין חיבור' })), []);
    return state;
}
function audit(batch, entityId, action, before, after) {
    const u = auth.currentUser;
    batch.set(doc(collection(db, 'auditLog')), {
        entity: 'priceList', entityId, action, before: before ?? null, after: after ?? null, source: 'inline',
        by: u.uid, byName: u.displayName ?? u.email ?? '', at: serverTimestamp(), ok: true,
    });
}
export async function createPriceList(name, kind, items = []) {
    const u = auth.currentUser;
    const batch = writeBatch(db);
    const ref = doc(collection(db, 'priceLists'));
    batch.set(ref, { name: name.trim(), kind, active: true, items, createdAt: serverTimestamp(), createdBy: u.uid, updatedAt: serverTimestamp(), updatedBy: u.uid });
    audit(batch, ref.id, 'create', null, { name: name.trim(), kind, items: items.length });
    await batch.commit();
    return ref.id;
}
export async function updatePriceList(pl, patch, detail) {
    const u = auth.currentUser;
    const batch = writeBatch(db);
    batch.update(doc(db, 'priceLists', pl.id), { ...patch, updatedAt: serverTimestamp(), updatedBy: u.uid });
    const before = Object.fromEntries(Object.keys(patch).filter((k) => k !== 'items').map((k) => [k, pl[k]]));
    audit(batch, pl.id, 'update', detail ? detail.before ?? before : before, detail ? detail.after ?? patch : patch);
    await batch.commit();
}
