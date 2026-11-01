/* העדפות תצוגה לכל משתמש (אפיון 2: "המערכת זוכרת לכל משתמש"). בשלב 2 עוברות למסמך המשתמש ב-Firestore;
   עד אז נשמרות בדפדפן, וכל גישה עטופה כי האחסון יכול להיות חסום. */
import { useCallback, useState } from 'react';
const KEY = 'dominos-crm:prefs';
function readAll() {
    try {
        return JSON.parse(localStorage.getItem(KEY) || '{}');
    }
    catch {
        return {};
    }
}
export function usePref(name, initial) {
    const [value, setValue] = useState(() => readAll()[name] ?? initial);
    const set = useCallback((v) => {
        setValue(v);
        try {
            localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [name]: v }));
        }
        catch { /* אחסון חסום – ההעדפה נשמרת רק עד הרענון */ }
    }, [name]);
    return [value, set];
}
