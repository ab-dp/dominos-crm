/* האזנה משותפת לאוסף שלם (לקוחות, סניפים, אשכולות, מחירונים).
   קודם כל רכיב פתח האזנה משלו – פתיחת "הזמנה חדשה" לבד פתחה כמה האזנות לאותו אוסף, וכל פתיחה קראה מחדש
   את כל המסמכים. עכשיו יש האזנה אחת לכל אוסף לאורך כל הכניסה: היא נפתחת בשימוש הראשון ונשארת פתוחה,
   וכל הרכיבים מקבלים ממנה את אותם נתונים. כך כל מסמך נקרא פעם אחת, ואחר כך רק מה שהשתנה. */
import { useSyncExternalStore } from 'react';
import { collection, onSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type Live<T> = { items: T[]; loading: boolean; error: string };

type Store = { state: Live<unknown>; subs: Set<() => void>; unsub?: () => void };
const stores = new Map<string, Store>();
const LOADING: Live<never> = { items: [], loading: true, error: '' };

function start<T>(name: string, s: Store, map: (id: string, data: DocumentData) => T, sort: (a: T, b: T) => number) {
  s.unsub = onSnapshot(collection(db, name),
    (snap) => {
      s.state = { items: snap.docs.map((d) => map(d.id, d.data())).sort(sort), loading: false, error: '' };
      s.subs.forEach((f) => f());
    },
    () => {
      // אין הרשאה או אין חיבור: מציגים שגיאה, והשימוש הבא ינסה להאזין שוב
      s.unsub = undefined;
      s.state = { items: [], loading: false, error: 'אין הרשאה או אין חיבור' };
      s.subs.forEach((f) => f());
    });
}

export function useLiveCollection<T>(name: string, map: (id: string, data: DocumentData) => T, sort: (a: T, b: T) => number): Live<T> {
  let s = stores.get(name);
  if (!s) { s = { state: LOADING, subs: new Set() }; stores.set(name, s); }
  const store = s;
  return useSyncExternalStore(
    (onChange) => {
      store.subs.add(onChange);
      if (!store.unsub) start(name, store, map, sort);
      return () => { store.subs.delete(onChange); }; // ההאזנה נשארת פתוחה – הפתיחה הבאה של המסך לא קוראת שוב
    },
    () => store.state as Live<T>,
  );
}

export const byName = <T extends { name: string }>(a: T, b: T) => String(a.name).localeCompare(String(b.name), 'he');
