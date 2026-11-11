/* מנוע החריגים (אפיון סעיפים 5 ו-9). פונקציות טהורות: הזמנה + עכשיו + ספים → רשימת בעיות.
   הסטטוס לא משתנה כאן לעולם; המערכת רק מתריעה. מסך "היום", מסך החריגים, הפעמון והתפריט נשענים על אותה פונקציה. */
import { sameMoney, toISODate } from '../lib/format';
import { CLOSED, type Order } from '../data/types';
import { DEFAULT_THRESHOLDS, type Thresholds } from '../data/thresholds';

export type Severity = 'red' | 'orange' | 'yellow' | 'info';
export type FixAction = 'q' | 'branch' | 'pay' | 'status' | 'close' | 'po' | 'open' | 'ackGap' | 'ackCancel' | 'ackQUpdate' | 'ops';

export type Issue = { rule: number; severity: Severity; label: string; action: FixAction; actionLabel: string };

export type Health = 'ok' | 'missing' | 'urgent' | 'critical';

/* מיפוי אחד מחומרה לצבע – כל רכיב (תג, שורה, מספר, קבוצה) קורא מכאן.
   אדום (red → critical) רק לקריטי: מועד שעבר, חיוב שנכשל, ביטול שלא בוצע בקופה,
   והזמנה של היום שלא ירדה ל-Q אחרי השעה שנקבעה. דחוף – כתום. חסר – צהוב. מעקב (info) – בלי צבע. */
export const SEVERITY_TONE: Record<Severity, Health> = { red: 'critical', orange: 'urgent', yellow: 'missing', info: 'ok' };
export const SEVERITY_LABEL: Record<Severity, string> = { red: 'חריגות', orange: 'דחוף', yellow: 'חסר', info: 'מעקב' };

const RANK: Record<Severity, number> = { red: 3, orange: 2, yellow: 1, info: 0 };

/* כללי החריגים בשמם – למסננים במסך החריגים */
export const RULE_LABEL: Record<number, string> = {
  1: 'לא הועברה ל-Q', 2: 'פער מול Q', 3: 'מועד עבר', 4: 'לא עודכן בתפעול', 5: 'אשראי לא חויב', 6: 'אין אישור לקוח',
  7: 'חיוב אשראי נכשל', 11: 'לעדכן שינוי ב-Q', 8: 'חסרים פרטים', 9: 'תעודת רכש חסרה', 10: 'בוטלה אחרי Q', 0: 'לעדכן בתפעול', 12: 'לשלוח בקבוצת תפעול',
};

export function orderDateTime(o: Order): Date {
  return new Date(`${o.date}T${o.time || '23:59'}:00`); // בלי שעה – נחשב כסוף היום
}

/* פרטי חובה שחסרים בהזמנה. ההזמנה נשמרת גם בלעדיהם (עדיף מאשר לא לרשום אותה), ומסומנת באדום עד שמשלימים. */
export function missingOf(o: Order): string[] {
  const m: string[] = [];
  if (!o.time) m.push('שעה');
  if (!o.branchId) m.push('סניף');
  if (!o.channel?.trim()) m.push('ערוץ');
  if (!(o.amount > 0)) m.push('סכום');
  if (!o.contactPhone) m.push('טלפון');
  if (o.delivery === 'delivery' && !o.address) m.push('כתובת');
  if (o.method === 'account' && !o.accountPhone) m.push('טלפון הקפה');
  if (!o.items?.length && !o.contents?.trim()) m.push('תכולה');
  if (o.poRequired && !o.poNumber) m.push('תעודת רכש'); // רק ללקוח שמסומן "עובד עם תעודת רכש"
  return m;
}

function dayDiff(iso: string, now: Date): number {
  const a = new Date(iso + 'T12:00:00').getTime();
  const b = new Date(toISODate(now) + 'T12:00:00').getTime();
  return Math.round((a - b) / 86400000);
}
const minutesOfDay = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
const nowMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes();

export function issuesFor(o: Order, now: Date, th: Thresholds = DEFAULT_THRESHOLDS): Issue[] {
  const out: Issue[] = [];
  const closed = CLOSED.includes(o.status);
  const diff = dayDiff(o.date, now);
  const soon = diff >= 0 && diff <= th.soonDays;
  const minutesLeft = (orderDateTime(o).getTime() - now.getTime()) / 60000;

  // פער מול Q – אלא אם אושר שהפער מוסבר, ומאז הסכומים לא השתנו
  const gapAcked = o.qGapAck && sameMoney(o.qGapAck.amount, o.amount) && o.qAmount !== undefined && sameMoney(o.qGapAck.qAmount, o.qAmount);
  if (o.qAmount !== undefined && o.status !== 'cancelled' && !sameMoney(o.qAmount, o.amount) && !gapAcked) {
    out.push({ rule: 2, severity: 'orange', label: 'פער מול Q', action: 'ackGap', actionLabel: 'בדוק פער' });
  }
  // חיוב אשראי שנכשל – אדום עד שמסמנים שטופל (שולם או בוטל)
  if (o.payment === 'failed' && o.status !== 'cancelled') {
    out.push({ rule: 7, severity: 'red', label: 'חיוב אשראי נכשל', action: 'pay', actionLabel: 'עדכן תשלום' });
  }
  // שונתה אחרי שהועברה לקופה – עד שמסמנים שעודכן גם ב-Q
  if (o.qNeedsUpdate && o.status !== 'cancelled') {
    out.push({ rule: 11, severity: 'orange', label: 'שונתה – לעדכן ב-Q', action: 'ackQUpdate', actionLabel: 'עודכן ב-Q' });
  }
  if (closed) {
    // ביטול שלא בוצע בקופה – קריטי
    if (o.status === 'cancelled' && o.qNumber && !o.qCancelAck) out.push({ rule: 10, severity: 'red', label: 'בוטלה אחרי Q', action: 'ackCancel', actionLabel: 'אשר שבוטלה ב-Q' })
    // בוטלה אחרי שסומנה "שולם" בלי Q (למשל אשראי שסומן ידנית) – לבדוק החזר ולעדכן את מצב התשלום
    else if (o.status === 'cancelled' && !o.qNumber && o.payment === 'paid') out.push({ rule: 10, severity: 'orange', label: 'בוטלה אחרי חיוב – לבדוק החזר', action: 'pay', actionLabel: 'עדכן תשלום' });
    return out.sort(bySeverity);
  }

  // תזכורת שלא חוסמת: אחרי ההקלדה ל-Q – לשלוח בקבוצת התפעול
  if (o.qNumber && o.opsNotified === false) {
    out.push({ rule: 12, severity: 'orange', label: 'לשלוח בקבוצת תפעול', action: 'ops', actionLabel: 'נשלח בקבוצה' });
  }
  if (minutesLeft < 0) {
    out.push({ rule: 3, severity: diff < 0 ? 'red' : 'orange', label: diff < 0 ? 'מועד עבר, לא נסגרה' : 'שעת האספקה עברה', action: 'close', actionLabel: 'סמן סופקה' });
  }
  // העברה ל-Q: רק ביום האספקה, החל מהשעה שנקבעה (12:00) או X דקות לפני האספקה – המוקדם מביניהם
  if (diff === 0 && !o.qNumber && (nowMinutes(now) >= minutesOfDay(th.qFromTime) || minutesLeft < th.qLeadMinutes)) {
    out.push({ rule: 1, severity: 'red', label: 'לא הועברה ל-Q', action: 'q', actionLabel: 'סמן הועברה ל-Q' });
  }
  if (soon && !o.branchApproval) {
    out.push({ rule: 4, severity: 'orange', label: 'לא עודכן בתפעול', action: 'branch', actionLabel: 'סמן עודכן' });
  }
  if (diff === 0 && o.method === 'credit' && o.payment === 'pending' && !o.qNumber) {
    const late = minutesOfDay(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`) >= minutesOfDay(th.creditDeadline);
    out.push({ rule: 5, severity: 'orange', label: late ? 'אשראי לא חויב – עבר המועד' : 'אשראי לא חויב', action: 'pay', actionLabel: 'סמן שולם' });
  }
  if (soon && (o.status === 'new' || o.status === 'pending_customer')) {
    out.push({ rule: 6, severity: 'orange', label: 'אין אישור לקוח', action: 'status', actionLabel: 'הלקוח אישר' });
  }
  const miss = missingOf(o);
  if (miss.length) {
    // צהוב; כשההזמנה כבר בחלון "בקרוב" (היום/מחר לפי הספים) או שמועדה עבר – דחוף (כתום)
    out.push({ rule: 8, severity: soon || diff < 0 ? 'orange' : 'yellow', label: `חסר: ${miss.join(', ')}`, action: 'open', actionLabel: 'השלם פרטים' });
  }
  if (diff > th.soonDays && !o.branchApproval) {
    out.push({ rule: 0, severity: 'info', label: 'לעדכן בתפעול', action: 'branch', actionLabel: 'סמן עודכן' });
  }
  return out.sort(bySeverity);
}

function bySeverity(a: Issue, b: Issue) { return RANK[b.severity] - RANK[a.severity]; }

export function healthOf(issues: Issue[]): Health {
  const top = issues.reduce<Severity>((m, i) => (RANK[i.severity] > RANK[m] ? i.severity : m), 'info');
  return SEVERITY_TONE[top];
}

export const HEALTH_RANK: Record<Health, number> = { critical: 3, urgent: 2, missing: 1, ok: 0 };
