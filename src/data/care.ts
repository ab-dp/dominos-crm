/* תיעוד טיפול: איך טיפלנו בלקוח אחרי שההזמנה נסגרה (איחור, חוסר, טעות…).
   לא נשמר בתוך ההזמנה, אלא כרשומה בתיק הלקוח – customers/{id}/activity עם kind 'care', מספר ההזמנה ותמונת מצב שלה.
   על ההזמנה נשמר רק מונה (careCount) ומתי האחרון (careAt) – לתג "תועד" ולסינון בארכיון. אין עריכה ואין מחיקה (כמו כל הפעילות). */
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { closeLabel, type Order } from './types';
import type { Activity } from './customers';

export const CARE_TOPICS = ['איחור', 'חוסר בהזמנה', 'טעות בפריטים', 'איכות', 'חיוב', 'אחר'];
export const CARE_COMP = ['ללא', 'התנצלות', 'זיכוי', 'הנחה בהזמנה הבאה', 'אחר'];
/* פיצוי שיש לו סכום */
export const compHasAmount = (c: string) => c === 'זיכוי' || c === 'הנחה בהזמנה הבאה';
/* נושא מוצע לפי איך ההזמנה נסגרה */
export const suggestTopic = (o: Pick<Order, 'status' | 'late'>) => (o.late ? 'איחור' : o.status === 'partial' ? 'חוסר בהזמנה' : CARE_TOPICS[0]);
/* הזמנה סגורה – שם מתעדים */
export const canCare = (o: Pick<Order, 'status'>) => o.status === 'delivered' || o.status === 'partial' || o.status === 'cancelled';
/* איחור או חלקית בלי תיעוד – מומלץ לתעד (סינון בארכיון, לא חריג) */
export const needsCare = (o: Pick<Order, 'status' | 'late' | 'careCount'>) => (o.status === 'delivered' || o.status === 'partial') && (!!o.late || o.status === 'partial') && !o.careCount;

export type CareInput = { topic: string; text: string; comp: string; compAmount?: number };

export async function addCare(o: Order, c: CareInput) {
  const u = auth.currentUser!;
  const byName = u.displayName ?? u.email ?? '';
  const batch = writeBatch(db);
  batch.set(doc(collection(db, 'customers', o.customerId, 'activity')), {
    kind: 'care', text: c.text.trim(), topic: c.topic, comp: c.comp, ...(c.compAmount ? { compAmount: c.compAmount } : {}),
    orderId: String(o.id),
    order: { id: o.id, date: o.date, time: o.time, branchName: o.branchName, amount: o.qAmount ?? o.amount, outcome: closeLabel(o) },
    by: u.uid, byName, at: serverTimestamp(),
  });
  batch.update(doc(db, 'orders', String(o.id)), {
    careCount: (o.careCount ?? 0) + 1, careAt: new Date().toISOString(), updatedAt: serverTimestamp(), updatedBy: u.uid, updatedByName: byName,
  });
  batch.set(doc(collection(db, 'auditLog')), {
    entity: 'order', entityId: String(o.id), action: 'care', before: null,
    after: { topic: c.topic, comp: c.comp, ...(c.compAmount ? { compAmount: c.compAmount } : {}), text: c.text.trim().slice(0, 200) },
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
      (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Activity).sort((a, b) => (b.at?.seconds ?? 9e9) - (a.at?.seconds ?? 9e9))),
      () => setItems([]));
  }, [customerId, orderId]);
  return items;
}
