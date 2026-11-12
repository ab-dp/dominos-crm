/* ספירת המשימות הפתוחות של מסך "היום" – במקום אחד, כדי שהמספר בתפריט יהיה בדיוק "N משימות פתוחות" שבמסך.
   כל חריגה דחופה או קריטית שייכת למשימה אחת, כך ש"אין משימות פתוחות" אומר באמת שאין מה לעשות. */
import type { OrderView } from '../../data/store';
import { CLOSED } from '../../data/types';
import { missingOf, orderDateTime } from '../../rules-engine/health';
import { addDays, toISODate } from '../../lib/format';

export type TaskKey = 'urgent' | 'yesterday' | 'customer' | 'branch' | 'q' | 'ops' | 'other' | 'missing' | 'quotes' | 'followups' | 'users';

/* חריגות דחופות שאין להן משימה משלה: פער מול Q, אשראי שלא חויב, שינוי שלא עודכן ב-Q, ביטול אחרי חיוב */
const OTHER_RULES = [2, 5, 11];
const isOther = (o: OrderView) => o.issues.some((i) => OTHER_RULES.includes(i.rule) || (i.rule === 10 && i.severity === 'orange'));
// קריטי שאין לו משימה משלה: חיוב שנכשל, ביטול שלא בוצע בקופה (גם בהזמנה שכבר נסגרה)
const URGENT_RULES = [7, 10];

/* "עכשיו": קטגוריה שיש בה משהו קריטי שלא טופל – באדום ובראש המסך, כדי שאחמ"ש יראה מיד מה דחוף:
   חריגות קריטיות, הזמנות שמועדן עבר, הזמנות של היום שלא ירדו ל-Q אחרי השעה שנקבעה, והצעות מחיר שלא חזרו אליהן.
   הסדר כאן הוא סדר ההצגה בקבוצה. */
export const NOW_ORDER: TaskKey[] = ['urgent', 'yesterday', 'q', 'quotes'];

export function redTasks(orders: OrderView[], c: Record<TaskKey, number>): Set<TaskKey> {
  const s = new Set<TaskKey>();
  if (c.urgent > 0) s.add('urgent');
  if (orders.some((o) => o.issues.some((i) => i.rule === 3 && i.severity === 'red'))) s.add('yesterday');
  if (orders.some((o) => o.issues.some((i) => i.rule === 1 && i.severity === 'red'))) s.add('q');
  if (c.quotes > 0) s.add('quotes');
  return s;
}

export function todayTaskCounts(orders: OrderView[], now: Date, x: { dueTasks: number; quoteFollowups: number; pendingUsers: number }): Record<TaskKey, number> {
  const today = toISODate(now);
  const tomorrow = toISODate(addDays(now, 1));
  const open = orders.filter((o) => !CLOSED.includes(o.status));
  const soon = (o: OrderView) => o.date === today || o.date === tomorrow;
  return {
    urgent: orders.filter((o) => o.issues.some((i) => i.severity === 'red' && URGENT_RULES.includes(i.rule))).length,
    // מועד האספקה עבר (גם היום, אחרי השעה) – לסגור: סופקה / חלקית / באיחור
    yesterday: open.filter((o) => orderDateTime(o) < now).length,
    customer: open.filter((o) => soon(o) && (o.status === 'new' || o.status === 'pending_customer')).length,
    branch: open.filter((o) => soon(o) && !o.branchApproval).length,
    q: open.filter((o) => o.date === today && !o.qNumber).length,
    ops: open.filter((o) => !!o.qNumber && o.opsNotified === false).length,
    other: orders.filter(isOther).length,
    missing: open.filter((o) => missingOf(o).length > 0).length,
    quotes: x.quoteFollowups,
    followups: x.dueTasks,
    users: x.pendingUsers,
  };
}

/* כמה משימות פתוחות (משימה = שורה במסך "היום" שיש בה מה לעשות) */
export const openTaskCount = (c: Record<TaskKey, number>) => Object.values(c).filter((n) => n > 0).length;
