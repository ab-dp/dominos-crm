/* מצב ההזמנות החי: קריאה מ-Firestore, תקינות מחושבת מחדש כל דקה, וכל עדכון נכתב לשרת וליומן.
   אחרי כל שינוי מוצגת הודעה עם "בטל" – הביטול כותב בחזרה את הערך הקודם (וגם הוא נרשם ביומן). */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useToast } from '../design/Toast';
import { healthOf, issuesFor, type Health, type Issue } from '../rules-engine/health';
import { updateOrders, useLiveOrders } from './orders';
import type { Order } from './types';

export type OrderView = Order & { issues: Issue[]; health: Health };

export type NewOrderMode = 'quick' | 'full' | 'newCustomer';
export type NewOrderRequest = { mode?: NewOrderMode; customerId?: string; date?: string; customerName?: string };

type Store = {
  now: Date;
  orders: OrderView[];
  loading: boolean;
  error: string;
  update: (id: number, patch: Partial<Order>, message: ReactNode) => void;
  updateMany: (ids: number[], patch: Partial<Order>, message: ReactNode) => void;
  newOrder: NewOrderRequest | null;
  openNewOrder: (r?: NewOrderRequest) => void;
  closeNewOrder: () => void;
};

const Ctx = createContext<Store | null>(null);
export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const { orders: raw, loading, error } = useLiveOrders();
  const [now, setNow] = useState(() => new Date());
  const [newOrder, setNewOrder] = useState<NewOrderRequest | null>(null);
  const rawRef = useRef(raw);
  rawRef.current = raw;

  // תקינות מחושבת מחדש כל דקה (אפיון: "בכל שמירה וכל כמה דקות")
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
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
    const before = rawRef.current.filter((o) => ids.includes(o.id));
    if (!before.length) return;
    const source = ids.length > 1 ? 'bulk' : 'inline';
    updateOrders(before, patch, source)
      .then(() => toast({
        message,
        onUndo: () => {
          // מחזירים לכל הזמנה את הערכים שהיו לה לפני השינוי
          const current = rawRef.current.filter((o) => ids.includes(o.id));
          Promise.all(before.map((b) => {
            const cur = current.find((c) => c.id === b.id);
            if (!cur) return undefined;
            const back = Object.fromEntries(Object.keys(patch).map((k) => [k, b[k as keyof Order]])) as Partial<Order>;
            return updateOrders([cur], back, source, 'ביטול פעולה');
          })).catch(() => toast({ message: 'הביטול נכשל – בדוק חיבור' }));
        },
      }))
      .catch(() => toast({ message: 'השמירה נכשלה – השינוי לא נשמר. בדוק חיבור ונסה שוב.' }));
  }, [toast]);

  const update = useCallback((id: number, patch: Partial<Order>, message: ReactNode) => updateMany([id], patch, message), [updateMany]);
  const openNewOrder = useCallback((r: NewOrderRequest = {}) => setNewOrder(r), []);
  const closeNewOrder = useCallback(() => setNewOrder(null), []);

  return (
    <Ctx.Provider value={{ now, orders, loading, error, update, updateMany, newOrder, openNewOrder, closeNewOrder }}>
      {children}
    </Ctx.Provider>
  );
}
