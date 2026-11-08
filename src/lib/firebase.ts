/* חיבור יחיד ל-Firebase לכל המערכת.
   הפרטים האלה ציבוריים מטבעם (הם נשלחים לכל דפדפן); מה שמגן על הנתונים הם כללי האבטחה ב-firestore.rules. */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { clearIndexedDbPersistence, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, terminate } from 'firebase/firestore';

export const app = initializeApp({
  apiKey: 'AIzaSyBzkqC_BXbWpLJGV70S4Y-s9d2Pfa3My0Q',
  authDomain: 'dominos-crm.firebaseapp.com',
  projectId: 'dominos-crm',
  storageBucket: 'dominos-crm.firebasestorage.app',
  messagingSenderId: '533113439316',
  appId: '1:533113439316:web:3e88fb3866f873832719c1',
});

export const auth = getAuth(app);
auth.languageCode = 'he';

/* שדה שערכו undefined (למשל ערך קודם של שדה שלא היה קיים) לא מכשיל את השמירה – פשוט לא נכתב.
   מטמון קבוע בדפדפן: רענון, כניסה חוזרת או פתיחה מחדש של מסך לא קוראים שוב את כל הנתונים מהשרת –
   חוסך מכסת קריאות של התוכנית החינמית (50 אלף ביום). כמה לשוניות פתוחות חולקות את אותו מטמון.
   דפדפן בלי IndexedDB (למשל גלישה פרטית) עובר לבד למטמון בזיכרון. */
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

/* מחשבים משותפים במוקד: ביציאה מוחקים את העותק המקומי של הנתונים. אחרי זה החיבור סגור – טוענים את הדף מחדש.
   אם לשונית אחרת של המערכת עוד פתוחה, הדפדפן לא מאפשר למחוק – המטמון יימחק ביציאה הבאה */
export async function clearLocalData() {
  try { await terminate(db); await clearIndexedDbPersistence(db); } catch { /* לשונית אחרת פתוחה או דפדפן בלי IndexedDB */ }
}
