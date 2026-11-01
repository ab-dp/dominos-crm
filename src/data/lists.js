/* רשימות מערכת (אפיון 6.9): ערוצי קבלה, סיבות ביטול, אמצעי תשלום, סוגי מסמכים.
   מסמך אחד: settings/lists. כולם קוראים, רק מנהל משנה (נאכף בכללים). */
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
export const LIST_META = {
    channels: { title: 'ערוצי קבלה', hint: 'איך ההזמנה הגיעה למוקד' },
    cancelReasons: { title: 'סיבות ביטול', hint: 'נבחרות בחלון "בוטלה"' },
    paymentMethods: { title: 'אמצעי תשלום', hint: 'שלושת הבסיסיים נעולים – הדוחות נשענים עליהם' },
    docTypes: { title: 'סוגי מסמכים', hint: 'לסיווג קבצים בתיק הזמנה ובתיק לקוח' },
};
const item = (id, label, locked = false) => ({ id, label, active: true, ...(locked ? { locked } : {}) });
export const DEFAULT_LISTS = {
    channels: [item('phone', 'טלפון'), item('whatsapp', 'WhatsApp'), item('email', 'מייל')],
    cancelReasons: [item('customer', 'הלקוח ביטל'), item('branch', 'הסניף לא יכול לבצע'), item('date', 'שינוי מועד'), item('dup', 'הזמנה כפולה'), item('other', 'אחר')],
    paymentMethods: [item('credit', 'אשראי', true), item('account', 'הקפה', true), item('cash', 'מזומן', true)],
    docTypes: [item('po', 'תעודת רכש'), item('quote', 'הצעת מחיר'), item('invoice', 'חשבונית'), item('agreement', 'הסכם / טופס הקפה'), item('other', 'אחר')],
};
export function useLists() {
    const [lists, setLists] = useState(null);
    const [missing, setMissing] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => onSnapshot(doc(db, 'settings', 'lists'), (s) => { setMissing(!s.exists()); setLists(s.exists() ? { ...DEFAULT_LISTS, ...s.data() } : DEFAULT_LISTS); }, () => setError('אין הרשאה או אין חיבור')), []);
    return { lists, missing, error };
}
export async function saveList(key, next, before, current) {
    const u = auth.currentUser;
    const batch = writeBatch(db);
    batch.set(doc(db, 'settings', 'lists'), { ...current, [key]: next, updatedAt: serverTimestamp(), updatedBy: u.uid });
    batch.set(doc(collection(db, 'auditLog')), {
        entity: 'settings', entityId: `lists.${key}`, action: 'update', before, after: next, source: 'form',
        by: u.uid, byName: u.displayName ?? u.email ?? '', at: serverTimestamp(), ok: true,
    });
    await batch.commit();
}
