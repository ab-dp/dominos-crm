/* נתוני דמה לבדיקות תמונת המצב – בכל הצורות שהזמנות קיימות יכולות להופיע בהן היום, כולל צורות ישנות.
   כל השמות והמספרים בדויים. המטרה: לוודא שכל שלב בשדרוג לא משנה את מה שהמערכת מציגה ומחשבת להזמנות קיימות. */
import type { Order, OrderItem } from '../../src/data/types';
import type { OrderView } from '../../src/data/store';
import { healthOf, issuesFor } from '../../src/rules-engine/health';
import { DEFAULT_THRESHOLDS } from '../../src/data/thresholds';
import { fromDoc } from '../../src/data/orders';
import type { Quote } from '../../src/data/quotes';

/* הצעות מחיר בכל הסטטוסים, כולל "אין מענה", פגת תוקף, ובלי לקוח במערכת */
const ts = (iso: string) => ({ seconds: Math.floor(new Date(iso).getTime() / 1000), nanoseconds: 0 }) as unknown as Quote['lastActivityAt'];
const quote = (id: number, q: Partial<Quote>): Quote => ({
  id, status: 'sent', customerId: `c${id}`, customer: { name: `לקוח הצעה ${id}`, contact: 'איש קשר', phone: '0500000002', email: '', taxId: '' },
  delivery: 'delivery', lines: [{ category: 'פיצות', name: 'משפחתית', qty: 20, unitPrice: 55 }, { category: 'משקאות', name: 'שתייה', qty: 10, unitPrice: 12 }],
  issueDate: '2026-11-20', validDays: 14, validUntil: '2026-12-04', itemsTotal: 1220, total: 1220, handler: 'נציג א', handlerUid: 'u1', ...q,
});
export const QUOTES: Quote[] = [
  quote(1031, { status: 'draft' }),
  quote(1032, { status: 'sent', sentAt: ts('2026-11-23T08:00:00.000Z'), lastActivityAt: ts('2026-11-23T08:00:00.000Z') }),
  quote(1033, { status: 'noanswer', lastActivityAt: ts('2026-11-25T06:00:00.000Z'), lastNote: 'לא ענה' }),
  quote(1034, { status: 'sent', validUntil: '2026-11-20', lastActivityAt: ts('2026-11-10T08:00:00.000Z') }),
  quote(1035, { status: 'approved', statusAt: ts('2026-11-24T10:00:00.000Z') }),
  quote(1036, { status: 'rejected', rejectReason: 'מחיר' }),
  quote(1037, { status: 'ordered', orderId: 1001 }),
  quote(1038, { status: 'sent', customerId: undefined, fee: { name: 'משלוח', price: 30 }, lines: [{ category: 'משקאות', name: 'שתייה', qty: 5, unitPrice: 12 }, { category: 'פיצות', name: 'אישית', qty: 3, unitPrice: 30.5 }], lastActivityAt: ts('2026-11-24T07:30:00.000Z') }),
];

/* "עכשיו" קבוע לכל הבדיקות: יום ד׳ 25.11.2026, 10:00 בבוקר */
export const NOW = new Date(2026, 10, 25, 10, 0, 0);
export const TODAY = '2026-11-25';
export const TOMORROW = '2026-11-26';
export const YESTERDAY = '2026-11-24';

const BR_A = { branchId: 'b1', branchName: 'רמת גן – ביאליק', cluster: 'מרכז', branchPhone: '03-0000001' };
const BR_B = { branchId: 'b2', branchName: 'חיפה – חורב', cluster: 'צפון', branchPhone: '04-0000002' };

const pizza = (name: string, qty: number, unitPrice: number, toppings?: string[]): OrderItem => ({ group: 'פיצות', name, qty, unitPrice, ...(toppings ? { toppings } : {}) });
const drink = (qty: number): OrderItem => ({ group: 'משקאות', name: 'שתייה 1.5 ל׳', qty, unitPrice: 12 });

function order(id: number, o: Partial<Order>): Order {
  return {
    id,
    customerId: `c${id}`,
    customerName: `לקוח דמה ${id}`,
    date: TODAY,
    time: '12:30',
    ...BR_A,
    amount: 0,
    status: 'approved',
    payment: 'pending',
    method: 'account',
    accountPhone: '0500000000',
    handler: 'נציג א',
    handlerUid: 'u1',
    channel: 'טלפון',
    delivery: 'delivery',
    address: 'הרצל 1, רמת גן',
    contactName: 'איש קשר',
    contactPhone: '0500000001',
    poRequired: false,
    items: [],
    notes: [],
    createdBy: 'נציג א',
    createdByUid: 'u1',
    createdAt: '2026-11-20',
    createdTime: '11:00',
    ...o,
  };
}

export const LEGACY: Order[] = [
  // 1. הזמנה רגילה של היום: עודכן בתפעול, עוד לא ב-Q
  order(1001, { amount: 670, branchApproval: { manager: 'מנהל', at: '2026-11-24T19:00:00.000Z' }, items: [pizza('משפחתית', 10, 55, ['זיתים', 'פטריות']), drink(10)], instructions: 'לחתוך ל-12 משולשים' }),
  // 2. ערך ישן 'new', ערוץ חופשי עם מספר פנייה, תכולה בטקסט בלבד
  order(1002, { status: 'new', channel: 'וואטסאפ 4512', contents: '12 משפחתיות, 6 שתייה', amount: 750, date: TOMORROW }),
  // 3. ממתין לאישור לקוח, מחר, משלוח בלי כתובת, אשראי
  order(1003, { status: 'pending_customer', date: TOMORROW, address: undefined, method: 'credit', accountPhone: undefined, items: [pizza('אישית', 20, 30)], amount: 600 }),
  // 4. מאושר ועודכן בתפעול, מחר, הוקלד ל-Q, לא נשלח בקבוצה
  order(1004, { date: TOMORROW, branchApproval: { manager: '', at: '2026-11-24T18:00:00.000Z' }, qNumber: 'cs401', qAmount: 500, opsNotified: false, items: [pizza('משפחתית דקה', 8, 62.5)], amount: 500, ...BR_B }),
  // 5. הוקלד ל-Q היום, נשלח בקבוצה, פער מול Q
  order(1005, { qNumber: 'cs402', qAmount: 480, opsNotified: true, items: [pizza('משפחתית', 9, 55)], amount: 495, branchApproval: { manager: 'מנהל', at: '2026-11-24T19:00:00.000Z' } }),
  // 6. סופקה באיחור של 25 דקות, עם תיעוד טיפול
  order(1006, { date: '2026-11-18', status: 'delivered', late: { minutes: 25 }, qNumber: 'cs350', qAmount: 990, amount: 990, payment: 'paid', careCount: 1, careAt: '2026-11-19', items: [pizza('משפחתית', 18, 55)] }),
  // 7. סופקה חלקית, איחור בלי דקות
  order(1007, { date: '2026-11-19', status: 'partial', partialNote: 'חסרו 2 פיצות', late: { minutes: 0 }, qNumber: 'cs351', qAmount: 550, amount: 660, items: [pizza('אקסטרה', 12, 55)], ...BR_B }),
  // 8. בוטלה אחרי שהוקלדה ל-Q – הביטול לא אושר בקופה
  order(1008, { date: '2026-11-21', status: 'cancelled', cancelReason: 'הלקוח ביטל', qNumber: 'cs360', qAmount: 300, amount: 300, items: [pizza('משפחתית', 5, 60)] }),
  // 9. פריטים בצורה ישנה: קבוצת מחירון ישנה, 'כללי', itemId, תוספות כשם מוצר, הערה לשורה
  order(1009, { date: '2026-11-10', status: 'delivered', qNumber: 'cs300', qAmount: 420, amount: 420, items: [
    { itemId: 'old-1', group: 'פיצה משפחתית L', name: 'רמה 2', qty: 4, unitPrice: 60, toppings: ['זיתים'] },
    { group: 'כללי', name: 'מגש פירות', qty: 1, unitPrice: 120, detail: 'בלי אננס' },
    { group: 'ליד הפיצה', name: 'לחם שום', toppings: ['לחם שום'], qty: 3, unitPrice: 20 },
  ] }),
  // 10. פיצות בחלוקה לחצאים ולרבעים
  order(1010, { date: TOMORROW, amount: 310, items: [
    { group: 'פיצות', name: 'משפחתית', qty: 2, unitPrice: 65, parts: ['פפרוני', 'ללא'] },
    { group: 'פיצות', name: 'משפחתית', qty: 2, unitPrice: 70, parts: ['זיתים', 'פטריות, בצל', 'טונה', 'ללא'] },
    { group: 'קינוחים', name: 'סופלה', qty: 2, unitPrice: 20 },
  ] }),
  // 11. בהמתנה – הגיע הזמן לחזור
  order(1011, { amount: 400, items: [pizza('משפחתית', 7, 57)], hold: { reason: 'הלקוח לא עונה', by: 'u1', byName: 'נציג א', at: '2026-11-25T06:30:00.000Z', remindAt: '2026-11-25T07:00:00.000Z', attempts: 2, note: 'ניסיתי פעמיים' } }),
  // 12. בהמתנה – עוד לא הגיע הזמן
  order(1012, { time: '18:00', amount: 220, items: [pizza('אישית', 7, 31.4)], hold: { reason: 'ממתין לפרטי אשראי', by: 'u2', byName: 'נציג ב', at: '2026-11-25T07:50:00.000Z', remindAt: '2026-11-25T09:00:00.000Z', attempts: 1 } }),
  // 13. שונתה לאחר אישור, צריך לעדכן ב-Q
  order(1013, { date: TOMORROW, qNumber: 'cs410', qAmount: 600, qNeedsUpdate: true, amount: 650, changedAfterApproval: { at: '2026-11-24T12:00:00.000Z', by: 'נציג ב', fields: ['time', 'items'], before: { time: '12:00' } }, items: [pizza('משפחתית', 10, 65)], time: '13:00' }),
  // 14. חודש נעול (אוקטובר), תיקון לאחר סגירה
  order(1014, { date: '2026-10-14', status: 'delivered', qNumber: 'cs200', qAmount: 800, amount: 800, payment: 'paid', postCloseFix: { reason: 'תיקון סכום', by: 'מנהל' }, items: [pizza('וולקנו', 10, 80)], ...BR_B }),
  // 15. איסוף עצמי, אמצעי "אחר" עם פירוט, סכום ששונה ידנית
  order(1015, { delivery: 'pickup', address: undefined, method: 'other', methodLabel: 'אחר', methodNote: 'העברה בנקאית', accountPhone: undefined, amount: 500, calcAmount: 540, date: TOMORROW, time: '09:30', items: [pizza('משפחתית', 9, 60)] }),
  // 16. הזמנה פתוחה שמועדה עבר ולא הוקלדה ל-Q
  order(1016, { date: YESTERDAY, time: '13:00', amount: 330, items: [pizza('משפחתית', 6, 55)] }),
  // 17. הוזנה בדיעבד, דמי משלוח, ערוץ ריק (חסר)
  order(1017, { date: '2026-11-05', status: 'delivered', backfill: true, channel: '', deliveryFee: 30, qNumber: 'cs250', qAmount: 360, amount: 360, items: [pizza('משפחתית', 6, 55)] }),
  // 18. אשראי של היום שעוד לא חויב, ממתין לאישור לקוח בשעה קרובה
  order(1018, { status: 'pending_customer', time: '11:30', method: 'credit', accountPhone: undefined, payment: 'pending', amount: 275, items: [pizza('משפחתית', 5, 55)], ...BR_B }),
  // 19. פער מול Q שאושר, וביטול שאושר בקופה
  order(1019, { date: '2026-11-17', status: 'delivered', qNumber: 'cs340', qAmount: 470, amount: 500, payment: 'paid', qGapAck: { amount: 500, qAmount: 470, by: 'מנהל', at: '2026-11-18T09:00:00.000Z', note: 'הנחה בקופה' }, items: [pizza('משפחתית', 9, 55)] }),
  order(1020, { date: '2026-11-16', status: 'cancelled', cancelReason: 'הלקוח ביטל', qNumber: 'cs338', qAmount: 200, amount: 200, qCancelAck: { by: 'מנהל', at: '2026-11-16T08:00:00.000Z' }, payment: 'cancelled' }),
  // 21. בוטלה בלי Q, תשלום אשראי שנכשל
  order(1021, { date: TOMORROW, status: 'cancelled', cancelReason: 'כפילות', cancelNote: 'נפתחה פעמיים', method: 'credit', accountPhone: undefined, payment: 'failed', amount: 300 }),
  // 22. בהמתנה בלי תזכורת (חוזרת אחרי שעה), נדרשת תעודת רכש שחסרה, הערה פנימית והערות להנה"ח
  order(1022, { time: '14:00', poRequired: true, amount: 440, note: 'לקוח חדש מהמחלקה', billingNote: 'לציין מספר הזמנה בחשבונית', items: [pizza('משפחתית', 8, 55)],
    hold: { reason: 'ממתין לאישור הלקוח', by: 'u1', byName: 'נציג א', at: '2026-11-25T06:45:00.000Z', attempts: 1 } }),
  // 23. הוקלד ל-Q לפני שהייתה תזכורת "נשלח בקבוצת תפעול" (השדה חסר), איחור של 15 דק' בדיוק
  order(1023, { date: '2026-11-12', status: 'delivered', qNumber: 'cs310', qAmount: 550, amount: 550, late: { minutes: 15 }, payment: 'paid', items: [pizza('משפחתית', 10, 55)] }),
  // 24. הוקלד ל-Q היום, בלי שדה opsNotified (הזמנה מלפני התזכורת)
  order(1024, { time: '15:00', qNumber: 'cs420', qAmount: 330, amount: 330, items: [pizza('משפחתית', 6, 55)], branchApproval: { manager: 'מנהל', at: '2026-11-24T19:00:00.000Z' } }),
];

/* מסמכים "דלילים" כמו שהם יושבים ב-Firestore – עוברים דרך fromDoc, שממלא ברירות מחדל (status 'new' וכו') */
export const SPARSE: Order[] = [
  fromDoc('1101', { customerId: 'c1101', customerName: 'לקוח ישן מאוד', date: TOMORROW, time: '12:00', amount: 400, contents: '8 משפחתיות' }),
  fromDoc('1102', { customerId: 'c1102', customerName: 'לקוח בלי סניף', date: TODAY, time: '13:00', amount: 250, status: 'approved', method: 'cash', items: [{ name: 'פיצה משפחתית', qty: 4, unitPrice: 62 }] }),
  fromDoc('1103', { customerId: 'c1103', customerName: 'לקוח מינימלי', date: '2026-11-03', status: 'delivered', amount: 0 }),
];

/* כמו בחנות (store.tsx): לכל הזמנה מצורפים החריגים והתקינות לפי "עכשיו" */
export const VIEWS: OrderView[] = [...LEGACY, ...SPARSE].map((o) => {
  const issues = issuesFor(o, NOW, DEFAULT_THRESHOLDS);
  return { ...o, issues, health: healthOf(issues) };
});
