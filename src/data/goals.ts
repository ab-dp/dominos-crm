/* יעדים חודשיים (הגדרות ← יעדים): מסמך אחד settings/goals. כולם קוראים, רק מנהל משנה (נאכף בכללים, כמו שאר settings).
   יעד שלא הוגדר – לא מוצג בבורד בכלל. נשמר ביומן. */
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { REVENUE_HINT } from './metrics';

export type Goals = {
  orders?: number;    // מספר הזמנות בחודש
  revenue?: number;   // הכנסות בחודש (₪) – סכום Q, ואם לא הוקלד הסכום לחיוב (כמו בבורד ובדוחות)
  onTimePct?: number; // אחוז הזמנות שסופקו בזמן
};

export const GOAL_META: Record<keyof Goals, { title: string; hint: string; unit: string; max: number }> = {
  orders: { title: 'הזמנות בחודש', hint: 'כמה הזמנות (בלי ביטולים) בחודש קלנדרי', unit: 'הזמנות', max: 100000 },
  revenue: { title: 'הכנסות בחודש', hint: `${REVENUE_HINT}, בחודש קלנדרי`, unit: '₪', max: 100000000 },
  onTimePct: { title: 'סופקו בזמן', hint: 'אחוז ההזמנות שסופקו בלי איחור, מתוך כל ההזמנות שסופקו (מלא או חלקי)', unit: '%', max: 100 },
};

export function useGoals() {
  const [goals, setGoals] = useState<Goals>({});
  useEffect(() => onSnapshot(doc(db, 'settings', 'goals'),
    (s) => {
      const d = (s.data() ?? {}) as Goals;
      // רק מספר חיובי נחשב יעד; ריק / 0 – אין יעד
      setGoals(Object.fromEntries((Object.keys(GOAL_META) as (keyof Goals)[]).filter((k) => typeof d[k] === 'number' && d[k]! > 0).map((k) => [k, d[k]])) as Goals);
    },
    () => undefined), []);
  return goals;
}

export async function saveGoals(next: Goals, before: Goals) {
  const u = auth.currentUser!;
  const clean = Object.fromEntries((Object.keys(GOAL_META) as (keyof Goals)[]).map((k) => [k, next[k] && next[k]! > 0 ? next[k] : 0]));
  const batch = writeBatch(db);
  batch.set(doc(db, 'settings', 'goals'), { ...clean, updatedAt: serverTimestamp(), updatedBy: u.uid });
  batch.set(doc(collection(db, 'auditLog')), {
    entity: 'settings', entityId: 'goals', action: 'update', before, after: clean, source: 'form',
    by: u.uid, byName: u.displayName ?? u.email ?? '', at: serverTimestamp(), ok: true,
  });
  await batch.commit();
}
