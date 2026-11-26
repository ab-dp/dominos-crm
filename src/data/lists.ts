/* רשימות מערכת (אפיון 6.9, 19.1): ערוצי קבלה, סיבות ביטול, אמצעי תשלום, סוגי מסמכים, ולידים – מקורות, תחומים וסיבות "לא רלוונטי".
   מסמך אחד: settings/lists. כולם קוראים, רק מנהל משנה (נאכף בכללים). */
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type ListItem = { id: string; label: string; active: boolean; locked?: boolean };
export type ListKey = 'channels' | 'cancelReasons' | 'paymentMethods' | 'docTypes' | 'leadSources' | 'leadFields' | 'lostReasons' | 'careTopics' | 'careComps';
export type Lists = Record<ListKey, ListItem[]>;

export const LIST_META: Record<ListKey, { title: string; hint: string }> = {
  channels: { title: 'ערוצי קבלה', hint: 'הבחירה בשדה "ערוץ" בהזמנה (חובה). השבתה מסתירה מהבחירה, וההזמנות שכבר שויכו ממשיכות להציג אותו' },
  cancelReasons: { title: 'סיבות ביטול', hint: 'נבחרות בחלון "בוטלה"' },
  paymentMethods: { title: 'אמצעי תשלום', hint: 'ארבעת הבסיסיים נעולים – הדוחות נשענים עליהם. "אחר" פותח בהזמנה שדה לפירוט' },
  docTypes: { title: 'סוגי מסמכים', hint: 'לסיווג קבצים בתיק הזמנה ובתיק לקוח' },
  leadSources: { title: 'מקורות לידים', hint: 'מאיפה הגיע הלקוח הפוטנציאלי' },
  leadFields: { title: 'תחומים', hint: 'תחום העיסוק של העסק – לסינון ולקמפיינים' },
  lostReasons: { title: 'סיבות "לא רלוונטי"', hint: 'נבחרות כשליד נסגר בלי עסקה' },
  careTopics: { title: 'נושאי תיעוד טיפול', hint: 'נבחרים בחלון "תיעוד שיחה על הזמנה". "איחור" ו"חוסר בהזמנה" נעולים – הם מוצעים לבד לפי איך ההזמנה נסגרה' },
  careComps: { title: 'פיצויים', hint: 'נבחרים בתיעוד טיפול. "ללא" ו"התנצלות" בלי סכום; לכל השאר אפשר לרשום סכום' },
};

const item = (id: string, label: string, locked = false): ListItem => ({ id, label, active: true, ...(locked ? { locked } : {}) });

export const DEFAULT_LISTS: Lists = {
  // הערכים הישנים (טלפון, WhatsApp) מושבתים ולא נמחקים – הזמנות שכבר שויכו אליהם ממשיכות להציג אותם
  channels: [item('sales', 'מכירות'), item('peltone', 'קובץ פעלטון'), item('email', 'מייל'), item('birthday', 'יום הולדת'), item('callcenter', 'מוקד'), item('wellb', 'well-b'),
    { id: 'phone', label: 'טלפון', active: false }, { id: 'whatsapp', label: 'WhatsApp', active: false }],
  cancelReasons: [item('customer', 'הלקוח ביטל'), item('branch', 'הסניף לא יכול לבצע'), item('date', 'שינוי מועד'), item('dup', 'הזמנה כפולה'), item('other', 'אחר')],
  paymentMethods: [item('credit', 'אשראי', true), item('account', 'הקפה', true), item('cash', 'מזומן', true), item('other', 'אחר', true)],
  leadSources: [item('referral', 'המלצה'), item('event', 'אירוע'), item('outbound', 'פנייה יזומה'), item('website', 'אתר'), item('inbound', 'פנה אלינו')],
  leadFields: [item('hitech', 'הייטק'), item('education', 'חינוך'), item('health', 'בריאות'), item('municipal', 'רשות מקומית'), item('security', 'ביטחון'), item('industry', 'תעשייה'), item('offices', 'משרדים'), item('events', 'אירועים'), item('other', 'אחר')],
  lostReasons: [item('price', 'מחיר'), item('competitor', 'עובדים עם ספק אחר'), item('noneed', 'אין צורך כרגע'), item('noanswer', 'לא עונים'), item('kosher', 'כשרות'), item('other', 'אחר')],
  careTopics: [item('late', 'איחור', true), item('missing', 'חוסר בהזמנה', true), item('items', 'טעות בפריטים'), item('quality', 'איכות'), item('billing', 'חיוב'), item('other', 'אחר')],
  careComps: [item('none', 'ללא', true), item('apology', 'התנצלות', true), item('credit', 'זיכוי'), item('discount', 'הנחה בהזמנה הבאה'), item('other', 'אחר')],
  docTypes: [item('po', 'תעודת רכש'), item('quote', 'הצעת מחיר'), item('invoice', 'חשבונית'), item('agreement', 'הסכם / טופס הקפה'), item('other', 'אחר')],
};

/* פריטי מערכת שנוספו אחרי שהרשימה כבר נשמרה בהגדרות (למשל אמצעי התשלום "אחר") – מתווספים לסוף הרשימה, בלי לגעת במה שנשמר */
function withSystemItems(l: Lists): Lists {
  const out = { ...l };
  (Object.keys(DEFAULT_LISTS) as ListKey[]).forEach((k) => {
    const have = new Set((out[k] ?? []).map((x) => x.id));
    const add = DEFAULT_LISTS[k].filter((x) => x.locked && !have.has(x.id));
    if (add.length) out[k] = [...(out[k] ?? []), ...add];
  });
  return out;
}

export function useLists() {
  const [lists, setLists] = useState<Lists | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => onSnapshot(doc(db, 'settings', 'lists'),
    (s) => { setMissing(!s.exists()); setLists(s.exists() ? withSystemItems({ ...DEFAULT_LISTS, ...(s.data() as Partial<Lists>) }) : DEFAULT_LISTS); },
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
