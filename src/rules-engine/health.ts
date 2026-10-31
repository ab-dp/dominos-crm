/* מצב תקינות וחריגים (אפיון סעיפים 5 ו-9). פונקציות טהורות: הזמנה + עכשיו → רשימת בעיות.
   הסטטוס לא משתנה כאן לעולם; המערכת רק מתריעה. */
import { toISODate } from '../lib/format';
import { CLOSED, type Order } from '../data/types';

export type Severity = 'red' | 'orange' | 'yellow' | 'info';
export type FixAction = 'q' | 'branch' | 'pay' | 'status' | 'close' | 'po' | 'open';

export type Issue = { rule: number; severity: Severity; label: string; action: FixAction; actionLabel: string };

export type Health = 'ok' | 'missing' | 'urgent' | 'critical';

const RANK: Record<Severity, number> = { red: 3, orange: 2, yellow: 1, info: 0 };

export function orderDateTime(o: Order): Date {
  return new Date(`${o.date}T${o.time}:00`);
}

function dayDiff(iso: string, now: Date): number {
  const a = new Date(iso + 'T12:00:00').getTime();
  const b = new Date(toISODate(now) + 'T12:00:00').getTime();
  return Math.round((a - b) / 86400000);
}

export function issuesFor(o: Order, now: Date): Issue[] {
  const out: Issue[] = [];
  const closed = CLOSED.includes(o.status);
  const diff = dayDiff(o.date, now);
  const todayOrTomorrow = diff === 0 || diff === 1;
  const minutesLeft = (orderDateTime(o).getTime() - now.getTime()) / 60000;

  if (o.qAmount !== undefined && o.status !== 'cancelled' && o.qAmount !== o.amount) {
    out.push({ rule: 2, severity: 'red', label: 'פער מול Q', action: 'open', actionLabel: 'פתח תיק' });
  }
  if (closed) {
    if (o.status === 'cancelled' && o.qNumber) out.push({ rule: 10, severity: 'orange', label: 'בוטלה אחרי Q', action: 'open', actionLabel: 'אשר שבוטלה ב-Q' });
    return out;
  }

  if (minutesLeft < 0) {
    out.push({ rule: 3, severity: diff < 0 ? 'red' : 'orange', label: diff < 0 ? 'מועד עבר, לא נסגרה' : 'שעת האספקה עברה', action: 'close', actionLabel: 'סמן סופקה' });
  }
  if (diff === 0 && !o.qNumber && minutesLeft >= 0 && minutesLeft < 120) {
    out.push({ rule: 1, severity: 'red', label: 'לא הועברה ל-Q', action: 'q', actionLabel: 'סמן הועברה ל-Q' });
  }
  if (todayOrTomorrow && !o.branchApproval) {
    out.push({ rule: 4, severity: 'orange', label: 'אין אישור סניף', action: 'branch', actionLabel: 'סמן אישור' });
  }
  if (diff === 0 && o.method === 'credit' && o.payment === 'pending') {
    out.push({ rule: 5, severity: 'orange', label: 'אשראי לא חויב', action: 'pay', actionLabel: 'סמן שולם' });
  }
  if (todayOrTomorrow && (o.status === 'new' || o.status === 'pending_customer')) {
    out.push({ rule: 6, severity: 'orange', label: 'אין אישור לקוח', action: 'status', actionLabel: 'שנה סטטוס' });
  }
  if (todayOrTomorrow && o.delivery === 'delivery' && (!o.address || !o.contactName || !o.contactPhone)) {
    out.push({ rule: 8, severity: 'orange', label: 'חסרים פרטי אספקה', action: 'open', actionLabel: 'פתח תיק' });
  }
  if (o.poRequired && o.status === 'approved' && !o.poNumber) {
    out.push({ rule: 9, severity: 'yellow', label: 'תעודת רכש חסרה', action: 'po', actionLabel: 'הוסף מס\'' });
  }
  if (diff > 1 && !o.branchApproval) {
    out.push({ rule: 0, severity: 'yellow', label: 'חסר אישור סניף', action: 'branch', actionLabel: 'סמן אישור' });
  }
  return out.sort((a, b) => RANK[b.severity] - RANK[a.severity]);
}

export function healthOf(issues: Issue[]): Health {
  const top = issues.reduce((m, i) => Math.max(m, RANK[i.severity]), 0);
  return top === 3 ? 'critical' : top === 2 ? 'urgent' : top === 1 ? 'missing' : 'ok';
}

export const HEALTH_RANK: Record<Health, number> = { critical: 3, urgent: 2, missing: 1, ok: 0 };
