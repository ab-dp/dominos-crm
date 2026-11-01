import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/* מצב ההזמנות החי: קריאה מ-Firestore, תקינות מחושבת מחדש כל דקה, וכל עדכון נכתב לשרת וליומן.
   אחרי כל שינוי מוצגת הודעה עם "בטל" – הביטול כותב בחזרה את הערך הקודם (וגם הוא נרשם ביומן). */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../design/Toast';
import { healthOf, issuesFor } from '../rules-engine/health';
import { ConflictError, updateOrderSafe, updateOrders, useLiveOrders } from './orders';
import { STATUS_LABEL } from './types';
import { useThresholds } from './thresholds';
import { useOpenTasks } from './tasks';
import { toISODate } from '../lib/format';
/* שדות שמשנים את מה שהסניף, הקופה או הלקוח אישרו */
export const SENSITIVE = ['date', 'time', 'branchId', 'delivery', 'address', 'amount', 'items'];
export const isLocked = (o) => o.status === 'approved' || o.status === 'delivered' || o.status === 'partial' || !!o.qNumber || !!o.branchApproval;
const Ctx = createContext(null);
export function useStore() {
    const s = useContext(Ctx);
    if (!s)
        throw new Error('useStore outside provider');
    return s;
}
export function StoreProvider({ children }) {
    const toast = useToast();
    const { orders: raw, loading, error } = useLiveOrders();
    const { th: thresholds } = useThresholds();
    const tasks = useOpenTasks();
    const [now, setNow] = useState(() => new Date());
    const [newOrder, setNewOrder] = useState(null);
    const [closing, setClosing] = useState(null);
    const [conflict, setConflict] = useState(null);
    const [changeReq, setChangeReq] = useState(null);
    const rawRef = useRef(raw);
    rawRef.current = raw;
    // תקינות מחושבת מחדש כל דקה (אפיון: "בכל שמירה וכל כמה דקות")
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(t);
    }, []);
    const orders = useMemo(() => raw.map((o) => {
        const issues = issuesFor(o, now, thresholds);
        return { ...o, issues, health: healthOf(issues) };
    }), [raw, now, thresholds]);
    const updateMany = useCallback((ids, patch, message) => {
        const before = rawRef.current.filter((o) => ids.includes(o.id));
        if (!before.length)
            return;
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
                    if (!cur)
                        return undefined;
                    const back = Object.fromEntries(Object.keys(patch).map((k) => [k, b[k]]));
                    return updateOrders([cur], back, source, 'ביטול פעולה');
                })).catch(() => toast({ message: 'הביטול נכשל – בדוק חיבור' }));
            },
        }))
            .catch((e) => {
            if (e instanceof ConflictError) {
                setConflict({ error: e, patch, message });
                return;
            }
            toast({ message: 'השמירה נכשלה – השינוי לא נשמר. בדוק חיבור ונסה שוב.' });
        });
    }, [toast]);
    const resolveConflict = useCallback((keepMine) => {
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
    const update = useCallback((id, patch, message) => updateMany([id], patch, message), [updateMany]);
    const openNewOrder = useCallback((r = {}) => setNewOrder(r), []);
    const closeNewOrder = useCallback(() => setNewOrder(null), []);
    const requestStatus = useCallback((o, s) => {
        if (s === o.status)
            return;
        if (s === 'partial' || s === 'cancelled') {
            setClosing({ order: o, status: s });
            return;
        }
        // יציאה מ"בוטלה" או מ"סופקה חלקית" מנקה את פרטי הסגירה (הם נשארים ביומן), והתשלום חוזר ל"ממתין"
        updateMany([o.id], {
            status: s,
            ...(o.status === 'cancelled' ? { cancelReason: undefined, cancelNote: undefined, ...(o.payment === 'cancelled' ? { payment: 'pending' } : {}) } : {}),
            ...(o.status === 'partial' ? { partialNote: undefined } : {}),
        }, _jsxs(_Fragment, { children: ["\u05E1\u05D8\u05D8\u05D5\u05E1: ", STATUS_LABEL[s], " \u00B7 \u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx("bdi", { dir: "ltr", children: o.id })] }));
    }, [updateMany]);
    const endClosing = useCallback(() => setClosing(null), []);
    const requestChange = useCallback((o, patch, what) => {
        const touches = Object.keys(patch).some((k) => SENSITIVE.includes(k) && JSON.stringify(o[k]) !== JSON.stringify(patch[k]));
        if (touches && isLocked(o)) {
            setChangeReq({ order: o, patch, what });
            return;
        }
        updateMany([o.id], patch, _jsxs(_Fragment, { children: ["\u05E9\u05D9\u05E0\u05D5\u05D9 \u05E0\u05E9\u05DE\u05E8: ", what, " \u00B7 \u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx("bdi", { dir: "ltr", children: o.id })] }));
    }, [updateMany]);
    const endChange = useCallback(() => setChangeReq(null), []);
    const today = toISODate(now);
    const dueTasks = useMemo(() => tasks.filter((t) => t.due <= today), [tasks, today]);
    return (_jsx(Ctx.Provider, { value: { now, orders, loading, error, update, updateMany, newOrder, openNewOrder, closeNewOrder, requestStatus, closing, endClosing, thresholds, tasks, dueTasks, conflict, resolveConflict, requestChange, changeReq, endChange }, children: children }));
}
