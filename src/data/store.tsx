/* מצב האב-טיפוס בזיכרון. כל עדכון שומר את הערך הקודם ומציג "בטל"; בשלב 5 השכבה הזו תכתוב ל-Firestore וליומן. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useToast } from '../design/Toast';
import { healthOf, issuesFor, type Health, type Issue } from '../rules-engine/health';
import { buildMockOrders } from './mock';
import type { Order } from './types';

export type OrderView = Order & { issues: Issue[]; health: Health };

type Store = {
  now: Date;
  orders: OrderView[];
  update: (id: number, patch: Partial<Order>, message: ReactNode) => void;
  updateMany: (ids: number[], patch: Partial<Order>, message: ReactNode) => void;
};

const Ctx = createContext<Store | null>(null);
export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}

/* שעון הדגמה: האב-טיפוס תמיד מתחיל ב-10:30 בבוקר של היום ומתקדם בזמן אמת,
   כדי שתרחיש הבוקר ייראה אמיתי בכל שעה שפותחים אותו. */
const LOADED_AT = Date.now();
const DEMO_START = (() => { const d = new Date(); d.setHours(10, 30, 0, 0); return d.getTime(); })();
const demoNow = () => new Date(DEMO_START + (Date.now() - LOADED_AT));

export function StoreProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [raw, setRaw] = useState<Order[]>(() => buildMockOrders(demoNow()));
  const [now, setNow] = useState(demoNow);

  // תקינות מחושבת מחדש כל דקה (אפיון: "בכל שמירה וכל כמה דקות")
  useEffect(() => {
    const t = setInterval(() => setNow(demoNow()), 60000);
    return () => clearInterval(t);
  }, []);

  const orders = useMemo(
    () => raw.map((o) => {
      const issues = issuesFor(o, now);
      return { ...o, issues, health: healthOf(issues) };
    }),
    [raw, now],
  );

  const updateMany = useCallback((ids: number[], patch: Partial<Order>, message: ReactNode) => {
    let before: Order[] = [];
    setRaw((cur) => {
      before = cur.filter((o) => ids.includes(o.id));
      return cur.map((o) => (ids.includes(o.id) ? { ...o, ...patch } : o));
    });
    toast({
      message,
      onUndo: () => setRaw((cur) => cur.map((o) => before.find((b) => b.id === o.id) ?? o)),
    });
  }, [toast]);

  const update = useCallback((id: number, patch: Partial<Order>, message: ReactNode) => updateMany([id], patch, message), [updateMany]);

  return <Ctx.Provider value={{ now, orders, update, updateMany }}>{children}</Ctx.Provider>;
}
