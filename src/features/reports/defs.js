/* הגדרות הדוחות (אפיון 10). כל דוח: פונקציה טהורה מהזמנות לשורות וסיכום – קל לבדוק מול חישוב ידני.
   כלל אחיד: לפי תאריך אספקה וסכום Q (ואם לא הועברה – סכום לחיוב), בלי הזמנות שבוטלו – חוץ מדוח הביטולים. */
import { METHOD_LABEL, PAYMENT_LABEL, STATUS_LABEL } from '../../data/types';
export const qVal = (o) => o.qAmount ?? o.amount;
export const live = (list) => list.filter((o) => o.status !== 'cancelled');
function groupBy(list, key) {
    const m = new Map();
    list.forEach((o) => { const k = key(o) || '—'; m.set(k, [...(m.get(k) ?? []), o]); });
    return m;
}
const sum = (list) => list.reduce((t, o) => t + qVal(o), 0);
const avg = (list) => (list.length ? Math.round(sum(list) / list.length) : 0);
const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
const lastDate = (list) => list.reduce((m, o) => (o.date > m ? o.date : m), '');
const monthKey = (iso) => iso.slice(0, 7);
const WEEKDAY = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const REPORTS = [
    {
        id: 'summary', title: 'סיכום תקופה', desc: 'מספר הזמנות, סך, ממוצע וביטולים – לפי חודש',
        compute: (all) => {
            const l = live(all);
            const months = [...groupBy(all, (o) => monthKey(o.date)).entries()].sort((a, b) => a[0].localeCompare(b[0]));
            return {
                kpis: [
                    { label: 'הזמנות', value: l.length }, { label: 'סך (לפי Q)', value: sum(l), money: true },
                    { label: 'ממוצע הזמנה', value: avg(l), money: true }, { label: 'בוטלו', value: all.length - l.length, alert: all.length - l.length > 0 },
                ],
                cols: [{ key: 'month', label: 'חודש', kind: 'date' }, { key: 'count', label: 'הזמנות', kind: 'num' }, { key: 'sum', label: 'סך', kind: 'money' }, { key: 'avg', label: 'ממוצע', kind: 'money' }, { key: 'cancelled', label: 'בוטלו', kind: 'num' }],
                rows: months.map(([m, list]) => { const lv = live(list); return { id: m, orders: list, cells: { month: m.split('-').reverse().join('.'), count: lv.length, sum: sum(lv), avg: avg(lv), cancelled: list.length - lv.length } }; }),
                totals: { month: 'סה"כ', count: l.length, sum: sum(l), avg: avg(l), cancelled: all.length - l.length },
                chart: { valueKey: 'sum', labelKey: 'month', title: 'סך לפי חודש', kind: 'time', money: true },
            };
        },
    },
    {
        id: 'customers', title: 'לפי לקוח', desc: 'מי מזמין הכי הרבה – הזמנות, סך, ממוצע וחלק מהסך',
        compute: (all) => {
            const l = live(all);
            const total = sum(l);
            const rows = [...groupBy(l, (o) => o.customerName).entries()].map(([name, list]) => ({
                id: name, orders: list, cells: { name, count: list.length, sum: sum(list), avg: avg(list), share: pct(sum(list), total), last: lastDate(list) },
            })).sort((a, b) => b.cells.sum - a.cells.sum);
            return {
                cols: [{ key: 'name', label: 'לקוח' }, { key: 'count', label: 'הזמנות', kind: 'num' }, { key: 'sum', label: 'סך', kind: 'money' }, { key: 'avg', label: 'ממוצע', kind: 'money' }, { key: 'share', label: 'חלק מהסך', kind: 'pct' }, { key: 'last', label: 'הזמנה אחרונה', kind: 'date' }],
                rows, totals: { name: 'סה"כ', count: l.length, sum: total, avg: avg(l), share: 100, last: '' },
                chart: { valueKey: 'sum', labelKey: 'name', title: 'סך לפי לקוח', kind: 'category', money: true },
            };
        },
    },
    {
        id: 'branches', title: 'לפי סניף', desc: 'עומס והכנסה לכל סניף',
        compute: (all) => {
            const l = live(all);
            const rows = [...groupBy(l, (o) => o.branchName).entries()].map(([name, list]) => ({
                id: name, orders: list, cells: { name, cluster: list[0]?.cluster ?? '', count: list.length, sum: sum(list), avg: avg(list) },
            })).sort((a, b) => b.cells.sum - a.cells.sum);
            return {
                cols: [{ key: 'name', label: 'סניף' }, { key: 'cluster', label: 'אשכול' }, { key: 'count', label: 'הזמנות', kind: 'num' }, { key: 'sum', label: 'סך', kind: 'money' }, { key: 'avg', label: 'ממוצע', kind: 'money' }],
                rows, totals: { name: 'סה"כ', cluster: '', count: l.length, sum: sum(l), avg: avg(l) },
                chart: { valueKey: 'count', labelKey: 'name', title: 'הזמנות לפי סניף', kind: 'category' },
            };
        },
    },
    {
        id: 'clusters', title: 'לפי אשכול', desc: 'הזמנות וסך לכל אשכול סניפים',
        compute: (all) => {
            const l = live(all);
            const total = sum(l);
            const rows = [...groupBy(l, (o) => o.cluster).entries()].map(([name, list]) => ({
                id: name, orders: list, cells: { name, branches: new Set(list.map((o) => o.branchId)).size, count: list.length, sum: sum(list), share: pct(sum(list), total) },
            })).sort((a, b) => b.cells.sum - a.cells.sum);
            return {
                cols: [{ key: 'name', label: 'אשכול' }, { key: 'branches', label: 'סניפים פעילים', kind: 'num' }, { key: 'count', label: 'הזמנות', kind: 'num' }, { key: 'sum', label: 'סך', kind: 'money' }, { key: 'share', label: 'חלק מהסך', kind: 'pct' }],
                rows, totals: { name: 'סה"כ', branches: new Set(l.map((o) => o.branchId)).size, count: l.length, sum: total, share: 100 },
                chart: { valueKey: 'sum', labelKey: 'name', title: 'סך לפי אשכול', kind: 'category', money: true },
            };
        },
    },
    {
        id: 'days', title: 'לפי יום', desc: 'הזמנות וסך לכל יום אספקה – לזהות ימי עומס',
        compute: (all) => {
            const l = live(all);
            const rows = [...groupBy(l, (o) => o.date).entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, list]) => ({
                id: d, orders: list, cells: { date: d, weekday: WEEKDAY[new Date(d + 'T12:00').getDay()], count: list.length, sum: sum(list) },
            }));
            return {
                cols: [{ key: 'date', label: 'תאריך', kind: 'date' }, { key: 'weekday', label: 'יום' }, { key: 'count', label: 'הזמנות', kind: 'num' }, { key: 'sum', label: 'סך', kind: 'money' }],
                rows, totals: { date: 'סה"כ', weekday: '', count: l.length, sum: sum(l) },
                chart: { valueKey: 'count', labelKey: 'date', title: 'הזמנות לפי יום', kind: 'time' },
            };
        },
    },
    { id: 'credit', title: 'דוח הקפות', desc: 'הקפות לפי לקוח וטלפון הקפה, סימון מול דוח הקופה', compute: () => ({ cols: [], rows: [] }), link: '/reports/credit' },
    {
        id: 'qgaps', title: 'פערי Q', desc: 'הזמנות שבהן הסכום בקופה שונה מהסכום לחיוב',
        compute: (all) => {
            const gaps = live(all).filter((o) => o.qAmount !== undefined && o.qAmount !== o.amount).sort((a, b) => a.date.localeCompare(b.date));
            const total = gaps.reduce((t, o) => t + ((o.qAmount ?? 0) - o.amount), 0);
            return {
                kpis: [{ label: 'הזמנות עם פער', value: gaps.length, alert: gaps.length > 0 }, { label: 'סך הפערים (Q פחות לחיוב)', value: total, money: true }],
                cols: [{ key: 'id', label: 'הזמנה', kind: 'num' }, { key: 'date', label: 'תאריך', kind: 'date' }, { key: 'customer', label: 'לקוח' }, { key: 'amount', label: 'לחיוב', kind: 'money' }, { key: 'q', label: 'ב-Q', kind: 'money' }, { key: 'diff', label: 'פער', kind: 'money' }, { key: 'ack', label: 'מצב' }],
                rows: gaps.map((o) => ({ id: String(o.id), orders: [o], cells: { id: o.id, date: o.date, customer: o.customerName, amount: o.amount, q: o.qAmount ?? 0, diff: (o.qAmount ?? 0) - o.amount, ack: o.qGapAck && o.qGapAck.amount === o.amount && o.qGapAck.qAmount === o.qAmount ? `אושר: ${o.qGapAck.note ?? ''}` : 'לבדיקה' } })),
                totals: { id: 'סה"כ', date: '', customer: '', amount: gaps.reduce((t, o) => t + o.amount, 0), q: gaps.reduce((t, o) => t + (o.qAmount ?? 0), 0), diff: total, ack: '' },
            };
        },
    },
    {
        id: 'cancels', title: 'ביטולים וסיבות', desc: 'כמה בוטלו, למה, ומה הסכום שירד',
        compute: (all) => {
            const c = all.filter((o) => o.status === 'cancelled');
            const rows = [...groupBy(c, (o) => o.cancelReason ?? 'לא צוינה סיבה').entries()].map(([reason, list]) => ({
                id: reason, orders: list, cells: { reason, count: list.length, sum: list.reduce((t, o) => t + o.amount, 0), share: pct(list.length, c.length) },
            })).sort((a, b) => b.cells.count - a.cells.count);
            return {
                kpis: [{ label: 'בוטלו', value: c.length, alert: c.length > 0 }, { label: 'אחוז מכלל ההזמנות', value: `${pct(c.length, all.length)}%` }, { label: 'סכום שירד', value: c.reduce((t, o) => t + o.amount, 0), money: true }],
                cols: [{ key: 'reason', label: 'סיבה' }, { key: 'count', label: 'ביטולים', kind: 'num' }, { key: 'sum', label: 'סכום', kind: 'money' }, { key: 'share', label: 'חלק מהביטולים', kind: 'pct' }],
                rows, totals: { reason: 'סה"כ', count: c.length, sum: c.reduce((t, o) => t + o.amount, 0), share: 100 },
                chart: { valueKey: 'count', labelKey: 'reason', title: 'ביטולים לפי סיבה', kind: 'category' },
            };
        },
    },
    {
        id: 'channels', title: 'ערוצי הזמנה', desc: 'מאיפה מגיעות ההזמנות – וואטסאפ, מכירות, מוקד ועוד',
        compute: (all) => {
            const l = live(all);
            const total = sum(l);
            const rows = [...groupBy(l, (o) => o.channel).entries()].map(([name, list]) => ({
                id: name, orders: list, cells: { name, count: list.length, sum: sum(list), share: pct(sum(list), total) },
            })).sort((a, b) => b.cells.count - a.cells.count);
            return {
                cols: [{ key: 'name', label: 'ערוץ' }, { key: 'count', label: 'הזמנות', kind: 'num' }, { key: 'sum', label: 'סך', kind: 'money' }, { key: 'share', label: 'חלק מהסך', kind: 'pct' }],
                rows, totals: { name: 'סה"כ', count: l.length, sum: total, share: 100 },
                chart: { valueKey: 'count', labelKey: 'name', title: 'הזמנות לפי ערוץ', kind: 'category' },
            };
        },
    },
    {
        id: 'payments', title: 'תשלומים', desc: 'לפי אמצעי תשלום: שולם, ממתין, נכשל',
        compute: (all) => {
            const l = live(all);
            const by = (list, p) => list.filter((o) => o.payment === p).reduce((t, o) => t + qVal(o), 0);
            const rows = [...groupBy(l, (o) => o.methodLabel ?? METHOD_LABEL[o.method] ?? o.method).entries()].map(([name, list]) => ({
                id: name, orders: list, cells: { name, count: list.length, paid: by(list, 'paid'), pending: by(list, 'pending'), failed: by(list, 'failed'), sum: sum(list) },
            })).sort((a, b) => b.cells.sum - a.cells.sum);
            return {
                kpis: [{ label: PAYMENT_LABEL.paid, value: by(l, 'paid'), money: true }, { label: PAYMENT_LABEL.pending, value: by(l, 'pending'), money: true }, { label: PAYMENT_LABEL.failed, value: by(l, 'failed'), money: true, alert: by(l, 'failed') > 0 }],
                cols: [{ key: 'name', label: 'אמצעי תשלום' }, { key: 'count', label: 'הזמנות', kind: 'num' }, { key: 'paid', label: 'שולם', kind: 'money' }, { key: 'pending', label: 'ממתין', kind: 'money' }, { key: 'failed', label: 'נכשל', kind: 'money' }, { key: 'sum', label: 'סך', kind: 'money' }],
                rows, totals: { name: 'סה"כ', count: l.length, paid: by(l, 'paid'), pending: by(l, 'pending'), failed: by(l, 'failed'), sum: sum(l) },
            };
        },
    },
    {
        id: 'team', title: 'לפי עובד', desc: 'כמה הזמנות כל עובד הכניס ובאיזה סכום',
        compute: (all) => {
            const l = live(all);
            const rows = [...groupBy(l, (o) => o.createdBy).entries()].map(([name, list]) => ({
                id: name, orders: list, cells: { name, count: list.length, sum: sum(list), avg: avg(list), statuses: [...new Set(list.map((o) => STATUS_LABEL[o.status]))].join(', ') },
            })).sort((a, b) => b.cells.count - a.cells.count);
            return {
                cols: [{ key: 'name', label: 'עובד' }, { key: 'count', label: 'הזמנות', kind: 'num' }, { key: 'sum', label: 'סך', kind: 'money' }, { key: 'avg', label: 'ממוצע', kind: 'money' }],
                rows, totals: { name: 'סה"כ', count: l.length, sum: sum(l), avg: avg(l) },
                chart: { valueKey: 'count', labelKey: 'name', title: 'הזמנות לפי עובד', kind: 'category' },
            };
        },
    },
];
