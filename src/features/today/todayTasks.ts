/* ספירת המשימות הפתוחות של מסך "היום" – במקום אחד, כדי שהמספר בתפריט יהיה בדיוק "N משימות פתוחות" שבמסך.
   (קודם התפריט ספר הזמנות דחופות, המסך ספר משימות, והפעמון ספר התראות – שלושה מספרים שונים לאותו דבר) */
import type { OrderView } from '../../data/store';
import { CLOSED } from '../../data/types';
import { missingOf } from '../../rules-engine/health';
import { addDays, toISODate } from '../../lib/format';

// כללים שיש להם משימה משלה ברשימה (3 – מועד עבר: "לסגור הזמנות שעברו")
export const COVERED = [6, 4, 0, 1, 3, 12, 8];

export type TaskKey = 'customer' | 'branch' | 'q' | 'ops' | 'yesterday' | 'urgent' | 'missing' | 'quotes' | 'followups' | 'users';

/* קטגוריה שיש בה משהו קריטי שלא טופל – מסומנת באדום במסך "היום" (כדי שאחמ"ש יראה מיד מה דחוף):
   הזמנות של היום שלא ירדו ל-Q אחרי השעה שנקבעה, הזמנות שמועדן עבר, חריגות קריטיות, והצעות מחיר שלא חזרו אליהן */
export function redTasks(orders: OrderView[], c: Record<TaskKey, number>): Set<TaskKey> {
  const s = new Set<TaskKey>();
  if (orders.some((o) => o.issues.some((i) => i.rule === 1 && i.severity === 'red'))) s.add('q');
  if (c.yesterday > 0) s.add('yesterday');
  if (c.urgent > 0) s.add('urgent');
  if (c.quotes > 0) s.add('quotes');
  return s;
}

export function todayTaskCounts(orders: OrderView[], now: Date, x: { dueTasks: number; quoteFollowups: number; pendingUsers: number }): Record<TaskKey, number> {
  const today = toISODate(now);
  const tomorrow = toISODate(addDays(now, 1));
  const open = orders.filter((o) => !CLOSED.includes(o.status));
  const soon = (o: OrderView) => o.date === today || o.date === tomorrow;
  return {
    customer: open.filter((o) => soon(o) && (o.status === 'new' || o.status === 'pending_customer')).length,
    branch: open.filter((o) => soon(o) && !o.branchApproval).length,
    q: open.filter((o) => o.date === today && !o.qNumber).length,
    ops: open.filter((o) => !!o.qNumber && o.opsNotified === false).length,
    yesterday: open.filter((o) => o.date < today).length,
    // קריטי שאין לו משימה משלה: חיוב שנכשל, ביטול שלא בוצע בקופה (גם בהזמנה שכבר נסגרה)
    urgent: orders.filter((o) => o.issues.some((i) => i.severity === 'red' && !COVERED.includes(i.rule))).length,
    missing: open.filter((o) => missingOf(o).length > 0).length,
    quotes: x.quoteFollowups,
    followups: x.dueTasks,
    users: x.pendingUsers,
  };
}

/* כמה משימות פתוחות (משימה = שורה במסך "היום" שיש בה מה לעשות) */
export const openTaskCount = (c: Record<TaskKey, number>) => Object.values(c).filter((n) => n > 0).length;
