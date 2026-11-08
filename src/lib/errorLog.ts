/* יומן תקלות: תקלה אצל משתמש (מסך שנפל, שגיאה שלא נתפסה) נרשמת ב-Firestore, ומנהל המערכת רואה אותה בהגדרות ← תקלות.
   בלי שירות חיצוני ובלי עלות: עד 5 רישומים לכל כניסה, רק למשתמש מחובר ופעיל (הכללים בודקים), וטקסט מקוצר. */
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

const MAX_PER_SESSION = 5;
let sent = 0;
const seen = new Set<string>();

export function logError(where: string, e: unknown) {
  try {
    const u = auth.currentUser;
    if (!u || sent >= MAX_PER_SESSION) return;
    const err = e instanceof Error ? e : new Error(typeof e === 'string' ? e : JSON.stringify(e) ?? 'unknown');
    const message = `${err.name}: ${err.message}`.slice(0, 500);
    if (seen.has(message)) return; // אותה תקלה פעם אחת בכל כניסה
    seen.add(message);
    sent += 1;
    addDoc(collection(db, 'clientErrors'), {
      where: where.slice(0, 40),
      message,
      stack: (err.stack ?? '').slice(0, 2000),
      page: location.hash.slice(0, 200),
      ua: navigator.userAgent.slice(0, 200),
      by: u.uid,
      byName: (u.displayName ?? u.email ?? '').slice(0, 80),
      at: serverTimestamp(),
    }).catch(() => undefined); // אם גם הרישום נכשל – לא מפריעים למשתמש
  } catch { /* היומן לעולם לא מפיל את המערכת */ }
}

/* שגיאות שלא נתפסו בשום מקום (למשל בתוך setTimeout או Promise) */
export function installGlobalErrorLog() {
  window.addEventListener('error', (ev) => logError('window', ev.error ?? ev.message));
  window.addEventListener('unhandledrejection', (ev) => logError('promise', ev.reason));
}
