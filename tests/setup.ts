/* הבדיקות לא מתחברות ל-Firebase: חיבור מזויף במקום src/lib/firebase.
   פונקציות החישוב והתצוגה לא קוראות ממנו – הוא נטען רק כי קבצים שמכילים אותן מייבאים גם פונקציות שמירה. */
import { vi } from 'vitest';
import { setLateSplit } from '../src/data/metrics';
import { setChannels } from '../src/data/channels';
import { CHANNELS } from './fixtures/orders';

/* שעון קבוע – אותו "עכשיו" כמו ב-fixtures/orders.ts (25.11.2026, 10:00), גם לקוד שקורא new Date() בעצמו */
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date(2026, 10, 25, 10, 0, 0));
/* פיצול האיחורים נקבע מהספים בזמן ריצה – בבדיקות תמיד ברירת המחדל, 15 דק' */
setLateSplit(15);
/* רשימת הערוצים נקבעת מה-store בזמן ריצה – בבדיקות רשימת הדמה */
setChannels(CHANNELS);

vi.mock('../src/lib/firebase', () => ({
  app: {},
  auth: { currentUser: null },
  db: {},
  clearLocalData: async () => {},
}));

/* AuthContext קובע בטעינה שההתחברות נשמרת רק ללשונית – בבדיקות אין התחברות */
vi.mock('firebase/auth', async (orig) => ({
  ...(await orig<typeof import('firebase/auth')>()),
  setPersistence: () => Promise.resolve(),
  onAuthStateChanged: () => () => {},
}));
