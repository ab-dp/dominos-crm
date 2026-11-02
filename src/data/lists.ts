/* רשימות מערכת (אפיון 6.9, 19.1): ערוצי קבלה, סיבות ביטול, אמצעי תשלום, סוגי מסמכים, ולידים – מקורות, תחומים וסיבות "לא רלוונטי".
   מסמך אחד: settings/lists. כולם קוראים, רק מנהל משנה (נאכף בכללים). */
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type ListItem = { id: string; label: string; active: boolean; locked?: boolean };
export type ListKey = 'channels' | 'cancelReasons' | 'paymentMethods' | 'docTypes' | 'leadSources' | 'leadFields' | 'lostReasons';
export type Lists = Record<ListKey, ListItem[]>;

export const LIST_META: Record<ListKey, { title: string; hint: string }> = {
  channels: { title: 'ערוצי קבלה', hint: 'איך ההזמנה הגיעה למוקד' },
  cancelReasons: { title: 'סיבות ביטול', hint: 'נבחרות בחלון "בוטלה"' },
  paymentMethods: { title: 'אמצעי תשלום', hint: 'שלושת הבסיסיים נעולים – הדוחות נשענים עליהם' },
  docTypes: { title: 'סוגי מסמכים', hint: 'לסיווג קבצים בתיק הזמנה ובתיק לקוח' },
  leadSources: { title: 'מקורות לידים', hint: 'מאיפה הגיע הלקוח הפוטנציאלי' },
  leadFields: { title: 'תחומים', hint: 'תחום העיסוק של העסק – לסינון ולקמפיינים' },
  lostReasons: { title: 'סיבות "לא רלוונטי"', hint: 'נבחרות כשליד נסגר בלי עסקה' },
};

const item = (id: string, label: string, locked = false): ListItem => ({ id, label, active: true, ...(locked ? { locked } : {}) });

export const DEFAULT_LISTS: Lists = {
  channels: [item('phone', 'טלפון'), item('whatsapp', 'WhatsApp'), item('email', 'מייל')],
  cancelReasons: [item('customer', 'הלקוח ביטל'), item('branch', 'הסניף לא יכול לבצע'), item('date', 'שינוי מועד'), item('dup', 'הזמנה כפולה'), item('other', 'אחר')],
  paymentMethods: [item('credit', 'אשראי', true), item('account', 'הקפה', true), item('cash', 'מזומן', true)],
  leadSources: [item('referral', 'המלצה'), item('event', 'אירוע'), item('outbound', 'פנייה יזומה'), item('website', 'אתר'), item('inbound', 'פנה אלינו')],
  leadFields: [item('hitech', 'הייטק'), item('education', 'חינוך'), item('health', 'בריאות'), item('municipal', 'רשות מקומית'), item('security', 'ביטחון'), item('industry', 'תעשייה'), item('offices', 'משרדים'), item('events', 'אירועים'), item('other', 'אחר')],
  lostReasons: [item('price', 'מחיר'), item('competitor', 'עובדים עם ספק אחר'), item('noneed', 'אין צורך כרגע'), item('noanswer', 'לא עונים'), item('kosher', 'כשרות'), item('other', 'אחר')],
  docTypes: [item('po', 'תעודת רכש'), item('quote', 'הצעת מחיר'), item('invoice', 'חשבונית'), item('agreement', 'הסכם / טופס הקפה'), item('other', 'אחר')],
};

export function useLists() {
  const [lists, setLists] = useState<Lists | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => onSnapshot(doc(db, 'settings', 'lists'),
    (s) => { setMissing(!s.exists()); setLists(s.exists() ? { ...DEFAULT_LISTS, ...(s.data() as Partial<Lists>) } : DEFAULT_LISTS); },
    () => setError('אין הרשאה או אין חיבור')), []);
  return { lists, missing, error };
}

export async function saveList(key: ListKey, next: ListItem[], before: ListItem[], current: Lists) {
  const u = auth.currentUser!;
  const batch = writeBatch(db);
  batch.set(doc(db, 'settings', 'lists'), { ...current, [key]: next, updatedAt: serverTimestamp(), updatedBy: u.uid });
  batch.set(doc(collection(db, 'auditLog')), {
    entity: 'settings', entityId: `lists.${key}`, action: 'update', before, after: next, source: 'form',
    by: u.uid, byName: u.displayName ?? u.email ?? '', at: serverTimestamp(), ok: true,
  });
  await batch.commit();
}
