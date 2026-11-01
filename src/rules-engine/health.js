/* מנוע החריגים (אפיון סעיפים 5 ו-9). פונקציות טהורות: הזמנה + עכשיו + ספים → רשימת בעיות.
   הסטטוס לא משתנה כאן לעולם; המערכת רק מתריעה. מסך "היום", מסך החריגים, הפעמון והתפריט נשענים על אותה פונקציה. */
import { toISODate } from '../lib/format';
import { CLOSED } from '../data/types';
import { DEFAULT_THRESHOLDS } from '../data/thresholds';
const RANK = { red: 3, orange: 2, yellow: 1, info: 0 };
/* כללי החריגים בשמם – למסננים במסך החריגים */
export const RULE_LABEL = {
    1: 'לא הועברה ל-Q', 2: 'פער מול Q', 3: 'מועד עבר', 4: 'אין אישור סניף', 5: 'אשראי לא חויב', 6: 'אין אישור לקוח',
    7: 'חיוב אשראי נכשל', 11: 'לעדכן שינוי ב-Q', 8: 'חסרים פרטים', 9: 'תעודת רכש חסרה', 10: 'בוטלה אחרי Q', 0: 'חסר אישור סניף',
};
export function orderDateTime(o) {
    return new Date(`${o.date}T${o.time || '23:59'}:00`); // בלי שעה – נחשב כסוף היום
}
/* פרטי חובה שחסרים בהזמנה. ההזמנה נשמרת גם בלעדיהם (עדיף מאשר לא לרשום אותה), ומסומנת באדום עד שמשלימים. */
export function missingOf(o) {
    const m = [];
    if (!o.time)
        m.push('שעה');
    if (!o.branchId)
        m.push('סניף');
    if (!o.channel?.trim())
        m.push('ערוץ');
    if (!(o.amount > 0))
        m.push('סכום');
    if (!o.contactName)
        m.push('איש קשר');
    if (!o.contactPhone)
        m.push('טלפון');
    if (o.delivery === 'delivery' && !o.address)
        m.push('כתובת');
    if (o.method === 'account' && !o.accountPhone)
        m.push('טלפון הקפה');
    return m;
}
function dayDiff(iso, now) {
    const a = new Date(iso + 'T12:00:00').getTime();
    const b = new Date(toISODate(now) + 'T12:00:00').getTime();
    return Math.round((a - b) / 86400000);
}
const minutesOfDay = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
export function issuesFor(o, now, th = DEFAULT_THRESHOLDS) {
    const out = [];
    const closed = CLOSED.includes(o.status);
    const diff = dayDiff(o.date, now);
    const soon = diff >= 0 && diff <= th.soonDays;
    const minutesLeft = (orderDateTime(o).getTime() - now.getTime()) / 60000;
    // פער מול Q – אלא אם אושר שהפער מוסבר, ומאז הסכומים לא השתנו
    const gapAcked = o.qGapAck && o.qGapAck.amount === o.amount && o.qGapAck.qAmount === o.qAmount;
    if (o.qAmount !== undefined && o.status !== 'cancelled' && o.qAmount !== o.amount && !gapAcked) {
        out.push({ rule: 2, severity: 'red', label: 'פער מול Q', action: 'ackGap', actionLabel: 'בדוק פער' });
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
        if (o.status === 'cancelled' && o.qNumber && !o.qCancelAck)
            out.push({ rule: 10, severity: 'orange', label: 'בוטלה אחרי Q', action: 'ackCancel', actionLabel: 'אשר שבוטלה ב-Q' });
        return out.sort(bySeverity);
    }
    if (minutesLeft < 0) {
        out.push({ rule: 3, severity: diff < 0 ? 'red' : 'orange', label: diff < 0 ? 'מועד עבר, לא נסגרה' : 'שעת האספקה עברה', action: 'close', actionLabel: 'סמן סופקה' });
    }
    if (diff === 0 && !o.qNumber && minutesLeft >= 0 && minutesLeft < th.qLeadMinutes) {
        out.push({ rule: 1, severity: 'red', label: 'לא הועברה ל-Q', action: 'q', actionLabel: 'סמן הועברה ל-Q' });
    }
    if (soon && !o.branchApproval) {
        out.push({ rule: 4, severity: 'orange', label: 'אין אישור סניף', action: 'branch', actionLabel: 'סמן אישור' });
    }
    if (diff === 0 && o.method === 'credit' && o.payment === 'pending') {
        const late = minutesOfDay(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`) >= minutesOfDay(th.creditDeadline);
        out.push({ rule: 5, severity: late ? 'red' : 'orange', label: late ? 'אשראי לא חויב – עבר המועד' : 'אשראי לא חויב', action: 'pay', actionLabel: 'סמן שולם' });
    }
    if (soon && (o.status === 'new' || o.status === 'pending_customer')) {
        out.push({ rule: 6, severity: 'orange', label: 'אין אישור לקוח', action: 'status', actionLabel: 'שנה סטטוס' });
    }
    const miss = missingOf(o);
    if (miss.length) {
        out.push({ rule: 8, severity: 'red', label: `חסר: ${miss.join(', ')}`, action: 'open', actionLabel: 'השלם פרטים' });
    }
    if (o.poRequired && o.status === 'approved' && !o.poNumber) {
        out.push({ rule: 9, severity: 'yellow', label: 'תעודת רכש חסרה', action: 'po', actionLabel: 'הוסף מס\'' });
    }
    if (diff > th.soonDays && !o.branchApproval) {
        out.push({ rule: 0, severity: 'yellow', label: 'חסר אישור סניף', action: 'branch', actionLabel: 'סמן אישור' });
    }
    return out.sort(bySeverity);
}
function bySeverity(a, b) { return RANK[b.severity] - RANK[a.severity]; }
export function healthOf(issues) {
    const top = issues.reduce((m, i) => Math.max(m, RANK[i.severity]), 0);
    return top === 3 ? 'critical' : top === 2 ? 'urgent' : top === 1 ? 'missing' : 'ok';
}
export const HEALTH_RANK = { critical: 3, urgent: 2, missing: 1, ok: 0 };
