/* חיבור יחיד ל-Firebase לכל המערכת.
   הפרטים האלה ציבוריים מטבעם (הם נשלחים לכל דפדפן); מה שמגן על הנתונים הם כללי האבטחה ב-firestore.rules. */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

export const db = getFirestore(app);
