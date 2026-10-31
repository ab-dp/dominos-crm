/* העדפות תצוגה לכל משתמש (אפיון 2: "המערכת זוכרת לכל משתמש"). בשלב 2 עוברות למסמך המשתמש ב-Firestore;
   עד אז נשמרות בדפדפן, וכל גישה עטופה כי האחסון יכול להיות חסום. */
import { useCallback, useState } from 'react';

const KEY = 'dominos-crm:prefs';

function readAll(): Record<string, unknown> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

export function usePref<T>(name: string, initial: T) {
  const [value, setValue] = useState<T>(() => (readAll()[name] as T) ?? initial);
  const set = useCallback((v: T) => {
    setValue(v);
    try { localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [name]: v })); } catch { /* אחסון חסום – ההעדפה נשמרת רק עד הרענון */ }
  }, [name]);
  return [value, set] as const;
}
