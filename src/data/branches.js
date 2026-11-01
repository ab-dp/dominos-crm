/* סניפים ואשכולות (אפיון 6.10): נבנים ידנית, כל משתמש פעיל יכול להוסיף. אין מחיקה – רק "לא פעיל".
   כל כתיבה ורשומת היומן שלה נשמרות יחד (batch) – אין שינוי בלי יומן. */
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
function useCollection(name) {
    const [state, setState] = useState({ items: [], loading: true, error: '' });
    useEffect(() => onSnapshot(collection(db, name), (s) => setState({ items: s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.name).localeCompare(String(b.name), 'he')), loading: false, error: '' }), () => setState({ items: [], loading: false, error: 'אין הרשאה או אין חיבור' })), [name]);
    return state;
}
export const useClusters = () => useCollection('clusters');
export const useBranches = () => useCollection('branches');
function audit(batch, entity, entityId, action, before, after, source = 'inline') {
    const u = auth.currentUser;
    batch.set(doc(collection(db, 'auditLog')), {
        entity, entityId, action, before: before ?? null, after: after ?? null, source,
        by: u.uid, byName: u.displayName ?? u.email ?? '', at: serverTimestamp(), ok: true,
    });
}
export async function addCluster(name) {
    const batch = writeBatch(db);
    const ref = doc(collection(db, 'clusters'));
    const data = { name: name.trim(), active: true, createdAt: serverTimestamp(), createdBy: auth.currentUser.uid };
    batch.set(ref, data);
    audit(batch, 'cluster', ref.id, 'create', null, { name: data.name });
    await batch.commit();
    return ref.id;
}
export async function updateCluster(c, patch) {
    const batch = writeBatch(db);
    batch.update(doc(db, 'clusters', c.id), { ...patch, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid });
    audit(batch, 'cluster', c.id, 'update', { name: c.name, active: c.active }, patch);
    await batch.commit();
}
export async function addBranch(b, source = 'inline') {
    const batch = writeBatch(db);
    const ref = doc(collection(db, 'branches'));
    const data = { name: b.name.trim(), clusterId: b.clusterId, phone: b.phone, active: true, createdAt: serverTimestamp(), createdBy: auth.currentUser.uid };
    batch.set(ref, data);
    audit(batch, 'branch', ref.id, 'create', null, { name: data.name, clusterId: data.clusterId, phone: data.phone }, source);
    await batch.commit();
    return ref.id;
}
export async function updateBranch(b, patch) {
    const batch = writeBatch(db);
    batch.update(doc(db, 'branches', b.id), { ...patch, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid });
    const before = Object.fromEntries(Object.keys(patch).map((k) => [k, b[k]]));
    audit(batch, 'branch', b.id, 'update', before, patch);
    await batch.commit();
}
