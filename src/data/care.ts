/* תיעוד טיפול: איך טיפלנו בלקוח אחרי שההזמנה נסגרה (איחור, חוסר, טעות…).
   לא נשמר בתוך ההזמנה, אלא כרשומה בתיק הלקוח – customers/{id}/activity עם kind 'care', מספר ההזמנה ותמונת מצב שלה.
   על ההזמנה נשמר רק מונה (careCount) ומתי האחרון (careAt) – לתג "תועד" ולסינון בארכיון. אין עריכה ואין מחיקה (כמו כל הפעילות). */
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { closeLabel, type Order } from './types';
import type { Activity } from './customers';
import type { ListItem } from './lists';

/* נושאים ופיצויים – רשימות בהגדרות (careTopics / careComps). ברשומה נשמר השם בזמן התיעוד, כך שתיעודים ישנים לא משתנים */
/* פיצוי שיש לו סכום: הכל חוץ מ"ללא" ו"התנצלות" (לפי המזהה, כדי ששינוי שם לא ישבור) */
export const compHasAmount = (id: string) => id !== 'none' && id !== 'apology';
/* נושא מוצע לפי איך ההזמנה נסגרה – מזהה ברשימה */
export const suggestTopicId = (o: Pick<Order, 'status' | 'late'>, topics: ListItem[]) =>
  (o.late ? 'late' : o.status === 'partial' ? 'missing' : topics.find((t) => t.active)?.id ?? '');
/* מוסיפים תיעוד רק אחרי שסומן סטטוס אספקה. הזמנה מבוטלת לא מתועדת מכאן (שיחה עליה – הערה בתיק הלקוח),
   אבל תיעודים קיימים עליה ממשיכים להופיע */
export const canAddCare = (o: Pick<Order, 'status'>) => o.status === 'delivered' || o.status === 'partial';
export const canCare = (o: Pick<Order, 'status' | 'careCount'>) => canAddCare(o) || !!o.careCount;
/* איחור או חלקית בלי תיעוד – מומלץ לתעד (סינון בארכיון, לא חריג) */
export const needsCare = (o: Pick<Order, 'status' | 'late' | 'careCount'>) => (o.status === 'delivered' || o.status === 'partial') && (!!o.late || o.status === 'partial') && !o.careCount;

/* callAt – תאריך השיחה עם הלקוח (YYYY-MM-DD); ברירת מחדל היום */
export type CareInput = { topic: string; text: string; comp: string; compId?: string; compAmount?: number; callAt?: string };
/* "בלי פיצוי" – לפי המזהה (גם אם שם הפריט שונה בהגדרות), ובתיעודים ישנים לפי השם */
export const noComp = (a: { comp?: string; compId?: string }) => !a.comp || a.compId === 'none' || a.comp === 'ללא';

export async function addCare(o: Order, c: CareInput) {
  const u = auth.currentUser!;
  const byName = u.displayName ?? u.email ?? '';
  const batch = writeBatch(db);
  batch.set(doc(collection(db, 'customers', o.customerId, 'activity')), {
    kind: 'care', text: c.text.trim(), topic: c.topic, comp: c.comp, ...(c.compId ? { compId: c.compId } : {}), ...(c.compAmount ? { compAmount: c.compAmount } : {}), ...(c.callAt ? { callAt: c.callAt } : {}),
    orderId: String(o.id),
    order: { id: o.id, date: o.date, time: o.time, branchName: o.branchName, amount: o.qAmount ?? o.amount, outcome: closeLabel(o) },
    by: u.uid, byName, at: serverTimestamp(),
  });
  batch.update(doc(db, 'orders', String(o.id)), {
    careCount: (o.careCount ?? 0) + 1, careAt: new Date().toISOString(), updatedAt: serverTimestamp(), updatedBy: u.uid, updatedByName: byName,
  });
  batch.set(doc(collection(db, 'auditLog')), {
    entity: 'order', entityId: String(o.id), action: 'care', before: null,
    after: { topic: c.topic, comp: c.comp, ...(c.compId ? { compId: c.compId } : {}), ...(c.compAmount ? { compAmount: c.compAmount } : {}), text: c.text.trim().slice(0, 200) },
    source: 'form', by: u.uid, byName, at: serverTimestamp(), ok: true,
  });
  await batch.commit();
}

/* תיעודי הטיפול של הזמנה אחת – מתיק הלקוח שלה */
export function useOrderCare(customerId: string, orderId: number) {
  const [items, setItems] = useState<Activity[] | null>(null);
  useEffect(() => {
    if (!customerId) { setItems([]); return; }
    return onSnapshot(query(collection(db, 'customers', customerId, 'activity'), where('orderId', '==', String(orderId))),
      (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Activity).filter((a) => a.kind === 'care').sort((a, b) => (b.at?.seconds ?? 9e9) - (a.at?.seconds ?? 9e9))),
      () => setItems([]));
  }, [customerId, orderId]);
  return items;
}
