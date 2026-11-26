/* מצב סינון בכתובת הדף – אותו דפוס בכל מסכי הרשימות (קישור ששולחים לחבר פותח את אותה תצוגה, ו"חזרה" בדפדפן שומרת אותה).
   הרשימה גם זוכרת את הסינון האחרון שלה (ללשונית הזו), כדי שכפתור "← לקוחות" בתוך תיק יחזיר לאותה תצוגה ולא לרשימה נקייה */
import { useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

const key = (path: string) => `list:${path}`;

export function useUrlParams() {
  const [params, setParams] = useSearchParams();
  const { pathname, search } = useLocation();
  useEffect(() => { try { sessionStorage.setItem(key(pathname), search); } catch { /* מצב פרטי */ } }, [pathname, search]);
  const get = (k: string) => params.get(k) ?? '';
  const setMany = (kv: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    Object.entries(kv).forEach(([k, v]) => { if (v === null || v === '') p.delete(k); else p.set(k, v); });
    setParams(p, { replace: true });
  };
  return { params, get, setMany };
}

/* הכתובת לחזרה לרשימה – עם הסינון האחרון שהיה בה */
export function listHref(path: string) {
  try { return path + (sessionStorage.getItem(key(path)) ?? ''); } catch { return path; }
}
