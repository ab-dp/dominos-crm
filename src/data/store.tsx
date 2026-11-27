/* מצב ההזמנות החי: קריאה מ-Firestore, תקינות מחושבת מחדש כל דקה, וכל עדכון נכתב לשרת וליומן.
   אחרי כל שינוי מוצגת הודעה עם "בטל" – הביטול כותב בחזרה את הערך הקודם (וגם הוא נרשם ביומן). */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { saveError } from '../lib/saveError';
import { useToast } from '../design/Toast';
import { healthOf, issuesFor, type Health, type Issue } from '../rules-engine/health';
import { getDoc, doc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { ConflictError, fromDoc, updateOrderSafe, updateOrders, useLiveOrders } from './orders';
import { LOCKED_FIELDS, monthOf, useLockedMonths } from './months';
import { STATUS_LABEL, opsChangeFor } from './types';
import { useThresholds, type Thresholds } from './thresholds';
import { setLateSplit } from './metrics';
import { DEFAULT_LISTS, useLists, type ListItem } from './lists';
import { setChannels } from './channels';
import { useOpenTasks, type Task } from './tasks';
import { callDue, needsFollowup, useQuotes, type Quote } from './quotes';
import { toISODate } from '../lib/format';
import type { Order, OrderStatus } from './types';

export type OrderView = Order & { issues: Issue[]; health: Health };

export type NewOrderMode = 'full' | 'newCustomer';
/* base – תמונת המצב של ההזמנה כשנפתח טופס העריכה: השמירה נבדקת מולה (התנגשות), ולא מול העותק החי */
export type ChangeRequest = { order: Order; patch: Partial<Order>; what: string; base?: Order; done?: Done };
/* שדות שמשנים את מה שהוקלד בקופה (Q) */
/* customerName – החלפת לקוח (בטופס העריכה) בהזמנה שכבר הוקלדה ל-Q היא שינוי שהקופה צריכה לדעת */
export const SENSITIVE: (keyof Order)[] = ['date', 'time', 'branchId', 'delivery', 'address', 'amount', 'items', 'customerName'];
/* תוצאת שמירה – לטופס העריכה, שנשאר פתוח עד שיודעים: נשמר · בוטל באחד החלונות · הושאר השינוי של משתמש אחר · נכשל */
export type SaveResult = 'saved' | 'cancelled' | 'theirs' | 'failed';
type Done = (r: SaveResult) => void;
/* "שונתה אחרי הקלדה ל-Q": רק הזמנה שהוקלדה ל-Q או שנסגרה. שינוי בהזמנה פתוחה נשמר רגיל */
export const isLocked = (o: Order) => !!o.qNumber || o.status === 'delivered' || o.status === 'partial' || o.status === 'cancelled';
export type ConflictState = { error: ConflictError; patch: Partial<Order>; message: ReactNode; done?: Done };
export type ClosingRequest = { order: Order; status: 'partial' | 'cancelled' };
/* fromQuote – הזמנה מהצעת מחיר שאושרה: הלקוח, המועד והשורות עוברים לטופס, ואחרי השמירה ההצעה מסומנת "הפכה להזמנה" */
/* editOf – עריכת הזמנה קיימת באותו טופס (תמונת מצב ברגע הפתיחה) */
export type NewOrderRequest = { mode?: NewOrderMode; customerId?: string; date?: string; customerName?: string; fromQuote?: Quote; editOf?: Order };
/* שינוי בהזמנה של חודש נעול – ממתין לסיבה לפני השמירה */
export type LockFixRequest = { ids: number[]; patch: Partial<Order>; message: ReactNode; months: string[]; base?: Order; done?: Done };

type Store = {
  now: Date;
  orders: OrderView[];
  loading: boolean;
  error: string;
  update: (id: number, patch: Partial<Order>, message: ReactNode, base?: Order, done?: Done) => void;
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
  requestChange: (o: Order, patch: Partial<Order>, what: string, base?: Order) => Promise<SaveResult>;
  changeReq: ChangeRequest | null;
  endChange: () => void;
  resolveConflict: (keepMine: boolean) => void;
  /* משימות מעקב פתוחות, וכמה מהן להיום או באיחור – לתפריט, לפעמון ולמסך היום */
  tasks: Task[];
  dueTasks: Task[];
  /* הצעות מחיר פתוחות, ואלה שממתינות לתשובה ולא עודכנו מעבר לסף – לתפריט ולמסך היום */
  quotes: Quote[];
  quoteFollowups: Quote[];
  lockedMonths: string[];
  /* רשימת הערוצים הנוכחית – זהות המערך משתנה כשהרשימה משתנה; להוסיף ל-useMemo שמחשב שמות ערוצים (channelLabel) */
  channels: ListItem[];
  lockFix: LockFixRequest | null;
  confirmLockFix: (reason: string) => void;
  endLockFix: () => void;
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
  // גבול פיצול האיחורים לכל המסכים (data/metrics.ts) – נקבע כבר ברינדור, לפני שהמסכים מחשבים
  setLateSplit(thresholds.lateSplitMinutes);
  // רשימת הערוצים לשם הערוץ בכל המסכים (data/channels.ts) – גם היא נקבעת ברינדור
  const { lists } = useLists();
  const channels = (lists ?? DEFAULT_LISTS).channels;
  setChannels(channels);
  // משימות חזרה של הצעות (נוצרו בשלב 5) לא מוצגות במסך היום ובמשימות – ההצעות מסומנות בכרטיסיית הצעות המחיר
  const allTasks = useOpenTasks();
  const tasks = useMemo(() => allTasks.filter((t) => !t.quoteId), [allTasks]);
  const { items: quotes } = useQuotes('open');
  const [now, setNow] = useState(() => new Date());
  const [newOrder, setNewOrder] = useState<NewOrderRequest | null>(null);
  const [closing, setClosing] = useState<ClosingRequest | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [changeReq, setChangeReq] = useState<ChangeRequest | null>(null);
  const [lockFix, setLockFix] = useState<LockFixRequest | null>(null);
  const lockedMonths = useLockedMonths();
  const lockedRef = useRef(lockedMonths);
  lockedRef.current = lockedMonths;
  const rawRef = useRef(raw);
  rawRef.current = raw;
  const thresholdsRef = useRef(thresholds);
  thresholdsRef.current = thresholds;

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

  const updateMany = useCallback(async (ids: number[], patch: Partial<Order>, message: ReactNode, fixReason?: string, base?: Order, done: Done = () => undefined) => {
    // הזמנות ישנות (מחודשים קודמים, מדוח או מתיק לקוח) לא נמצאות ברשימה החיה – נטענות מהשרת לפני השמירה.
    // טופס עריכה: הבסיס הוא תמונת המצב מרגע הפתיחה – כך שינוי של משתמש אחר בזמן העריכה מזוהה כהתנגשות ולא נדרס
    let before = base && ids.length === 1 && base.id === ids[0] ? [base] : rawRef.current.filter((o) => ids.includes(o.id));
    const missing = ids.filter((id) => !before.some((o) => o.id === id));
    if (missing.length) {
      try {
        const snaps = await Promise.all(missing.map((id) => getDoc(doc(db, 'orders', String(id)))));
        before = [...before, ...snaps.filter((s) => s.exists()).map((s) => fromDoc(s.id, s.data()!))];
      } catch { toast({ tone: 'error', message: 'השמירה נכשלה – בדוק חיבור ונסה שוב.' }); done('failed'); return; }
    }
    if (!before.length) { done('failed'); return; }
    // חודש נעול: שינוי סכום/תאריך/סטטוס/תשלום מחייב סיבה – קודם שואלים, ואז שומרים עם הסיבה
    const touchesLocked = (Object.keys(patch) as (keyof Order)[]).some((k) => LOCKED_FIELDS.includes(k));
    const months = touchesLocked ? [...new Set(before.flatMap((o) => [monthOf(o.date), ...(patch.date ? [monthOf(patch.date)] : [])]))].filter((m) => lockedRef.current.includes(m)) : [];
    if (months.length && !fixReason) { setLockFix({ ids, patch, message, months, base, done }); return; }
    if (fixReason) patch = { ...patch, postCloseFix: { reason: fixReason, by: auth.currentUser?.displayName ?? '', at: serverTimestamp() } };
    const source = ids.length > 1 ? 'bulk' : 'inline';
    // הזמנה אחת: שמירה בטוחה שלא דורסת שינוי של משתמש אחר. כמה הזמנות (סימון מרובה): כתיבה רגילה.
    const write = ids.length === 1 ? updateOrderSafe(before[0], patch, 'inline', fixReason ? `תיקון לאחר סגירה: ${fixReason}` : undefined) : updateOrders(before, patch, source, fixReason ? `תיקון לאחר סגירה: ${fixReason}` : undefined);
    const shown = message;
    write
      .then(() => { done('saved'); toast({
        message: shown,
        onUndo: () => {
          // מחזירים לכל הזמנה את הערכים שהיו לה לפני השינוי
          const current = rawRef.current.filter((o) => ids.includes(o.id));
          Promise.all(before.map((b) => {
            const cur = current.find((c) => c.id === b.id);
            if (!cur) return undefined;
            const back = Object.fromEntries(Object.keys(patch).map((k) => [k, b[k as keyof Order]])) as Partial<Order>;
            // הביטול מחזיר גם את opsChangeAt הקודם
            if (opsChangeFor(b, patch, 'x')) back.opsChangeAt = b.opsChangeAt;
            // ביטול של תיקון בחודש נעול הוא גם תיקון – עם סיבה, אחרת השרת חוסם
            if (fixReason) {
              back.postCloseFix = { reason: `ביטול תיקון: ${fixReason}`, by: auth.currentUser?.displayName ?? '', at: serverTimestamp() };
              return updateOrders([cur], back, source, 'ביטול פעולה');
            }
            /* שמירה בטוחה: הבסיס הוא מה שאני כתבתי. אם מישהו אחר שינה את אותו שדה מאז – לא דורסים אותו */
            return updateOrderSafe({ ...b, ...patch } as Order, back, 'inline', 'ביטול פעולה');
          })).catch((e) => toast({ tone: 'error', message: e instanceof ConflictError
            ? <>הביטול לא בוצע – {e.byName || 'משתמש אחר'} שינה את ההזמנה בינתיים</>
            : 'הביטול נכשל – בדוק חיבור' }));
        },
      }); })
      .catch((e) => {
        if (e instanceof ConflictError) { setConflict({ error: e, patch, message, done }); return; }
        done('failed');
        toast({ tone: 'error', message: `${saveError(e)} – השינוי לא נשמר` });
      });
  }, [toast]);

  // השמירה מחוץ ל-setState: פונקציית עדכון של state חייבת להיות טהורה (ב-StrictMode היא רצה פעמיים)
  const resolveConflict = useCallback((keepMine: boolean) => {
    const c = conflict;
    setConflict(null);
    if (c && !keepMine) c.done?.('theirs');
    if (c && keepMine) {
      // נשמר על בסיס הערכים העדכניים, כך שרק השדות שבחרתי משתנים
      const shown = c.message;
      updateOrderSafe(c.error.current, c.patch, 'inline', 'נשמר אחרי התנגשות')
        .then(() => { c.done?.('saved'); toast({ message: shown }); })
        .catch(() => { c.done?.('failed'); toast({ tone: 'error', message: 'השמירה נכשלה שוב – פתח את התיק מחדש ונסה' }); });
    }
  }, [conflict, toast]);

  const update = useCallback((id: number, patch: Partial<Order>, message: ReactNode, base?: Order, done?: Done) => updateMany([id], patch, message, undefined, base, done), [updateMany]);
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
  const requestChange = useCallback((o: Order, patch: Partial<Order>, what: string, base?: Order) => new Promise<SaveResult>((done) => {
    // "הוקלד ל-Q / נסגרה" נבדק מול ההזמנה החיה – בטופס עריכה תמונת המצב ישנה, ומישהו אולי הקליד ל-Q בינתיים
    const live = rawRef.current.find((x) => x.id === o.id) ?? o;
    const touches = (Object.keys(patch) as (keyof Order)[]).some((k) => SENSITIVE.includes(k) && JSON.stringify(live[k]) !== JSON.stringify(patch[k]));
    if (touches && isLocked(live)) { setChangeReq({ order: live, patch, what, base, done }); return; }
    updateMany([o.id], patch, <>שינוי נשמר: {what} · הזמנה <bdi dir="ltr">{o.id}</bdi></>, undefined, base, done);
  }), [updateMany]);
  // סגירת חלון "שינוי אחרי Q" בלי שמירה
  const endChange = useCallback(() => setChangeReq((r) => { r?.done?.('cancelled'); return null; }), []);
  const confirmLockFix = useCallback((reason: string) => {
    const r = lockFix;
    setLockFix(null);
    if (r) updateMany(r.ids, r.patch, r.message, reason, r.base, r.done);
  }, [lockFix, updateMany]);
  const endLockFix = useCallback(() => setLockFix((r) => { r?.done?.('cancelled'); return null; }), []);
  const today = toISODate(now);
  const dueTasks = useMemo(() => tasks.filter((t) => t.due <= today), [tasks, today]);
  /* הצעות שצריך לחזור אליהן עכשיו: הגיע תאריך החזרה, או (הצעה ישנה בלי תאריך) אין עדכון מעבר לסף. למונה בתפריט ולבורד – לא למסך היום */
  const quoteFollowups = useMemo(() => quotes.filter((q) => callDue(q, today) || needsFollowup(q, now, thresholds.quoteFollowupHours)), [quotes, now, today, thresholds.quoteFollowupHours]);

  // ערך קבוע בין רינדורים כשדבר לא השתנה – כדי שכל מי שקורא מה-store לא יתרנדר סתם
  const value = useMemo(() => ({ channels, now, orders, loading, error, update, updateMany, newOrder, openNewOrder, closeNewOrder, requestStatus, closing, endClosing, thresholds, tasks, dueTasks, quotes, quoteFollowups, conflict, resolveConflict, requestChange, changeReq, endChange, lockedMonths, lockFix, confirmLockFix, endLockFix }), [channels, now, orders, loading, error, update, updateMany, newOrder, openNewOrder, closeNewOrder, requestStatus, closing, endClosing, thresholds, tasks, dueTasks, quotes, quoteFollowups, conflict, resolveConflict, requestChange, changeReq, endChange, lockedMonths, lockFix, confirmLockFix, endLockFix]);

  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  );
}
