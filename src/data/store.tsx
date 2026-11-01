/* מצב ההזמנות החי: קריאה מ-Firestore, תקינות מחושבת מחדש כל דקה, וכל עדכון נכתב לשרת וליומן.
   אחרי כל שינוי מוצגת הודעה עם "בטל" – הביטול כותב בחזרה את הערך הקודם (וגם הוא נרשם ביומן). */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useToast } from '../design/Toast';
import { healthOf, issuesFor, type Health, type Issue } from '../rules-engine/health';
import { ConflictError, updateOrderSafe, updateOrders, useLiveOrders } from './orders';
import { STATUS_LABEL } from './types';
import { useThresholds, type Thresholds } from './thresholds';
import { useOpenTasks, type Task } from './tasks';
import { toISODate } from '../lib/format';
import type { Order, OrderStatus } from './types';

export type OrderView = Order & { issues: Issue[]; health: Health };

export type NewOrderMode = 'full' | 'newCustomer';
export type ChangeRequest = { order: Order; patch: Partial<Order>; what: string };
/* שדות שמשנים את מה שהסניף, הקופה או הלקוח אישרו */
export const SENSITIVE: (keyof Order)[] = ['date', 'time', 'branchId', 'delivery', 'address', 'amount', 'items'];
export const isLocked = (o: Order) => o.status === 'approved' || o.status === 'delivered' || o.status === 'partial' || !!o.qNumber || !!o.branchApproval;
export type ConflictState = { error: ConflictError; patch: Partial<Order>; message: ReactNode };
export type ClosingRequest = { order: Order; status: 'partial' | 'cancelled' };
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
  /* שינוי סטטוס מכל מקום: "סופקה חלקית" ו"בוטלה" פותחים חלון עם פרטים לפני השמירה */
  requestStatus: (o: Order, s: OrderStatus) => void;
  closing: ClosingRequest | null;
  endClosing: () => void;
  thresholds: Thresholds;
  /* שמירה שהתנגשה בשינוי של משתמש אחר – מוצגת השוואה ובוחרים מה להשאיר */
  conflict: ConflictState | null;
  /* עריכה מתיק ההזמנה: שדה רגיש בהזמנה שאושרה פותח קודם חלון "שינוי אחרי אישור" */
  requestChange: (o: Order, patch: Partial<Order>, what: string) => void;
  changeReq: ChangeRequest | null;
  endChange: () => void;
  resolveConflict: (keepMine: boolean) => void;
  /* משימות מעקב פתוחות, וכמה מהן להיום או באיחור – לתפריט, לפעמון ולמסך היום */
  tasks: Task[];
  dueTasks: Task[];
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
  const { th: thresholds } = useThresholds();
  const tasks = useOpenTasks();
  const [now, setNow] = useState(() => new Date());
  const [newOrder, setNewOrder] = useState<NewOrderRequest | null>(null);
  const [closing, setClosing] = useState<ClosingRequest | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [changeReq, setChangeReq] = useState<ChangeRequest | null>(null);
  const rawRef = useRef(raw);
  rawRef.current = raw;

  // תקינות מחושבת מחדש כל דקה (אפיון: "בכל שמירה וכל כמה דקות")
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const orders = useMemo(
    () => raw.map((o) => {
      const issues = issuesFor(o, now, thresholds);
      return { ...o, issues, health: healthOf(issues) };
    }),
    [raw, now, thresholds],
  );

  const updateMany = useCallback((ids: number[], patch: Partial<Order>, message: ReactNode) => {
    const before = rawRef.current.filter((o) => ids.includes(o.id));
    if (!before.length) return;
    const source = ids.length > 1 ? 'bulk' : 'inline';
    // הזמנה אחת: שמירה בטוחה שלא דורסת שינוי של משתמש אחר. כמה הזמנות (סימון מרובה): כתיבה רגילה.
    const write = ids.length === 1 ? updateOrderSafe(before[0], patch, 'inline') : updateOrders(before, patch, source);
    write
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
      .catch((e) => {
        if (e instanceof ConflictError) { setConflict({ error: e, patch, message }); return; }
        toast({ message: 'השמירה נכשלה – השינוי לא נשמר. בדוק חיבור ונסה שוב.' });
      });
  }, [toast]);

  const resolveConflict = useCallback((keepMine: boolean) => {
    setConflict((c) => {
      if (c && keepMine) {
        // נשמר על בסיס הערכים העדכניים, כך שרק השדות שבחרתי משתנים
        updateOrderSafe(c.error.current, c.patch, 'inline', 'נשמר אחרי התנגשות')
          .then(() => toast({ message: c.message }))
          .catch(() => toast({ message: 'השמירה נכשלה שוב – פתח את התיק מחדש ונסה' }));
      }
      return null;
    });
  }, [toast]);

  const update = useCallback((id: number, patch: Partial<Order>, message: ReactNode) => updateMany([id], patch, message), [updateMany]);
  const openNewOrder = useCallback((r: NewOrderRequest = {}) => setNewOrder(r), []);
  const closeNewOrder = useCallback(() => setNewOrder(null), []);
  const requestStatus = useCallback((o: Order, s: OrderStatus) => {
    if (s === o.status) return;
    if (s === 'partial' || s === 'cancelled') { setClosing({ order: o, status: s }); return; }
    // יציאה מ"בוטלה" או מ"סופקה חלקית" מנקה את פרטי הסגירה (הם נשארים ביומן), והתשלום חוזר ל"ממתין"
    updateMany([o.id], {
      status: s,
      ...(o.status === 'cancelled' ? { cancelReason: undefined, cancelNote: undefined, ...(o.payment === 'cancelled' ? { payment: 'pending' as const } : {}) } : {}),
      ...(o.status === 'partial' ? { partialNote: undefined } : {}),
    }, <>סטטוס: {STATUS_LABEL[s]} · הזמנה <bdi dir="ltr">{o.id}</bdi></>);
  }, [updateMany]);
  const endClosing = useCallback(() => setClosing(null), []);
  const requestChange = useCallback((o: Order, patch: Partial<Order>, what: string) => {
    const touches = (Object.keys(patch) as (keyof Order)[]).some((k) => SENSITIVE.includes(k) && JSON.stringify(o[k]) !== JSON.stringify(patch[k]));
    if (touches && isLocked(o)) { setChangeReq({ order: o, patch, what }); return; }
    updateMany([o.id], patch, <>שינוי נשמר: {what} · הזמנה <bdi dir="ltr">{o.id}</bdi></>);
  }, [updateMany]);
  const endChange = useCallback(() => setChangeReq(null), []);
  const today = toISODate(now);
  const dueTasks = useMemo(() => tasks.filter((t) => t.due <= today), [tasks, today]);

  return (
    <Ctx.Provider value={{ now, orders, loading, error, update, updateMany, newOrder, openNewOrder, closeNewOrder, requestStatus, closing, endClosing, thresholds, tasks, dueTasks, conflict, resolveConflict, requestChange, changeReq, endChange }}>
      {children}
    </Ctx.Provider>
  );
}
