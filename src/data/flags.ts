/* מתגים לשלבים בסיכון גבוה (settings/flags): "תצוגה מוקדמת" – למנהל בלבד, ואחרי כמה ימי עבודה אמיתית – לכולם.
   כך גם חזרה אחורה היא לחיצה אחת, בלי פריסה. כולם קוראים, רק מנהל משנה (נאכף בכללים, settings/{key}). */
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { auth, db } from '../lib/firebase';

export type FlagMode = 'off' | 'admin' | 'all';
export type Flags = { editForm: FlagMode; picker: FlagMode };
export const DEFAULT_FLAGS: Flags = { editForm: 'off', picker: 'off' };
export const FLAG_META: Record<keyof Flags, { title: string; hint: string }> = {
  editForm: { title: 'עריכה מרכזית בכרטיס הזמנה', hint: 'כפתור "עריכה" שפותח את טופס ההזמנה עם כל הערכים ושמירה אחת, במקום עריכה בלחיצה על כל ערך' },
  picker: { title: 'בוחר פריטים מדורג', hint: 'בהזמנה: קטגוריה ← סוג ← וריאציה ← סוג תוספת ← תוספות ← חלוקה, עם מחיר מהמחירון לפי סוג התוספת; בלי הצעות מהיסטוריה' },
};
const valid = (v: unknown): v is FlagMode => v === 'off' || v === 'admin' || v === 'all';

let cached: Flags = DEFAULT_FLAGS;
export function useFlags(): Flags {
  const [flags, setFlags] = useState<Flags>(cached);
  useEffect(() => onSnapshot(doc(db, 'settings', 'flags'),
    (s) => { const d = s.data() ?? {}; cached = { editForm: valid(d.editForm) ? d.editForm : 'off', picker: valid(d.picker) ? d.picker : 'off' }; setFlags(cached); },
    () => setFlags(DEFAULT_FLAGS)), []);
  return flags;
}

/* האם המתג פעיל למשתמש הזה */
export function useFlag(key: keyof Flags): boolean {
  const flags = useFlags();
  const { isAdmin } = useAuth();
  return flags[key] === 'all' || (flags[key] === 'admin' && isAdmin);
}

export async function saveFlag(key: keyof Flags, mode: FlagMode, before: FlagMode) {
  const u = auth.currentUser!;
  const batch = writeBatch(db);
  batch.set(doc(db, 'settings', 'flags'), { [key]: mode, updatedAt: serverTimestamp(), updatedBy: u.uid }, { merge: true });
  batch.set(doc(collection(db, 'auditLog')), { entity: 'settings', entityId: 'flags', action: 'update', before: { [key]: before }, after: { [key]: mode }, source: 'form', by: u.uid, byName: u.displayName ?? u.email ?? '', at: serverTimestamp(), ok: true });
  await batch.commit();
}
