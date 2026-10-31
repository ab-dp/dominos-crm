/* נתוני דמה לאב-טיפוס. השעות נבנות יחסית לשעה הנוכחית, כדי שכל מצבי התקינות יופיעו בכל רגע שפותחים. */
import { toISODate } from '../lib/format';
import type { Branch, Order, OrderItem } from './types';

export const ME = 'אלון';

export const BRANCHES: Branch[] = [
  { id: 'b1', name: 'רמת גן – ביאליק', cluster: 'מרכז', phone: '0535001101' },
  { id: 'b2', name: 'תל אביב – אבן גבירול', cluster: 'מרכז', phone: '0535001102' },
  { id: 'b3', name: 'פתח תקווה – סגולה', cluster: 'מרכז', phone: '0535001103' },
  { id: 'b4', name: 'חיפה – חורב', cluster: 'צפון', phone: '0535001104' },
  { id: 'b5', name: 'ירושלים – תלפיות', cluster: 'ירושלים', phone: '0535001105' },
  { id: 'b6', name: 'באר שבע – רגר', cluster: 'דרום', phone: '0535001106' },
];

type Cust = { id: string; name: string; method: Order['method']; accountPhone?: string; poRequired?: boolean; contact: string; phone: string; address: string; billing?: string };
export const CUSTOMERS: Cust[] = [
  { id: 'c1', name: 'אלפא מערכות בע"מ', method: 'account', accountPhone: '0546101010', poRequired: true, contact: 'מיכל אברהם', phone: '0546101011', address: 'הברזל 30, תל אביב', billing: 'חשבונית למחלקת כספים, לציין מס\' תעודת רכש' },
  { id: 'c2', name: 'קבוצת רימון הייטק', method: 'account', accountPhone: '0546202020', contact: 'יואב שגיא', phone: '0546202021', address: 'ז\'בוטינסקי 7, רמת גן', billing: 'חשבון מרוכז בסוף חודש' },
  { id: 'c3', name: 'בית ספר נווה עוז', method: 'account', accountPhone: '0546303030', poRequired: true, contact: 'רונית דהן', phone: '0546303031', address: 'הרצל 112, פתח תקווה' },
  { id: 'c4', name: 'סטודיו קו ישר', method: 'credit', contact: 'עדי ברק', phone: '0546404041', address: 'החשמונאים 90, תל אביב' },
  { id: 'c5', name: 'מרכז רפואי שקד', method: 'account', accountPhone: '0546505050', contact: 'ד"ר נועם פרץ', phone: '0546505051', address: 'דרך חברון 101, ירושלים' },
  { id: 'c6', name: 'לוי-כהן משרד עורכי דין', method: 'credit', contact: 'שירן לוי', phone: '0546606061', address: 'מוריה 40, חיפה' },
  { id: 'c7', name: 'אורט מכללה טכנולוגית', method: 'account', accountPhone: '0546101010', contact: 'אבי מזרחי', phone: '0546707071', address: 'רגר 15, באר שבע' },
  { id: 'c8', name: 'יום הולדת – משפחת גולן', method: 'cash', contact: 'תמר גולן', phone: '0546808081', address: 'ביאליק 55, רמת גן' },
];

const ITEMS: OrderItem[][] = [
  [{ name: 'פיצה משפחתית', qty: 12, unitPrice: 62 }, { name: 'שתייה 1.5 ל\'', qty: 6, unitPrice: 12 }],
  [{ name: 'פיצה משפחתית', qty: 25, unitPrice: 58 }, { name: 'לחם שום', qty: 10, unitPrice: 19 }],
  [{ name: 'פיצה אישית', qty: 40, unitPrice: 29 }],
  [{ name: 'פיצה משפחתית', qty: 6, unitPrice: 62 }],
  [{ name: 'פיצה משפחתית', qty: 18, unitPrice: 60 }, { name: 'סלט', qty: 4, unitPrice: 32 }],
];

const pad = (n: number) => String(n).padStart(2, '0');
function slot(base: Date, minutesFromNow: number) {
  const d = new Date(base.getTime() + minutesFromNow * 60000);
  d.setMinutes(Math.round(d.getMinutes() / 15) * 15, 0, 0);
  return { date: toISODate(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
function dayAt(base: Date, dayOffset: number, time: string) {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  return { date: toISODate(d), time };
}

type Seed = Partial<Order> & { c: number; b: number; when: { date: string; time: string }; menu?: number };

export function buildMockOrders(now = new Date()): Order[] {
  const seeds: Seed[] = [
    // אתמול – לא נסגרו (לסגור מאתמול)
    { c: 1, b: 0, when: dayAt(now, -1, '12:30'), menu: 1, status: 'approved', branchApproval: { manager: 'דני', at: '' }, qNumber: 'cs412', qAmount: 1640, payment: 'pending' },
    { c: 4, b: 4, when: dayAt(now, -1, '19:00'), menu: 3, status: 'approved', branchApproval: { manager: 'רחל', at: '' }, qNumber: 'cs587', qAmount: 372, payment: 'paid' },
    // היום – חריגה: לא הועברה ל-Q ופחות משעתיים
    { c: 0, b: 1, when: slot(now, 75), menu: 0, status: 'approved', branchApproval: { manager: 'מאיה', at: '' }, payment: 'pending', poNumber: '4500123' },
    // היום – פער מול Q
    { c: 2, b: 2, when: slot(now, 180), menu: 2, status: 'approved', branchApproval: { manager: 'עומר', at: '' }, qNumber: 'cs669', qAmount: 1120, payment: 'pending' },
    // היום – אשראי לא חויב, חסר אישור סניף
    { c: 3, b: 1, when: slot(now, 240), menu: 3, status: 'approved', payment: 'pending' },
    // היום – תקינה לגמרי
    { c: 4, b: 4, when: slot(now, 300), menu: 4, status: 'approved', branchApproval: { manager: 'אלי', at: '' }, qNumber: 'cs701', payment: 'pending' },
    // היום – מועד עבר ולא נסגרה
    { c: 5, b: 3, when: slot(now, -90), menu: 3, status: 'approved', branchApproval: { manager: 'שי', at: '' }, qNumber: 'cs455', payment: 'paid' },
    // היום – ממתינה לאישור לקוח
    { c: 7, b: 0, when: slot(now, 360), menu: 3, status: 'pending_customer', payment: 'pending', delivery: 'pickup' },
    // מחר
    { c: 1, b: 0, when: dayAt(now, 1, '12:00'), menu: 1, status: 'approved', payment: 'pending' },
    { c: 2, b: 2, when: dayAt(now, 1, '10:30'), menu: 2, status: 'approved', branchApproval: { manager: 'עומר', at: '' }, payment: 'pending' },
    { c: 6, b: 5, when: dayAt(now, 1, '13:00'), menu: 4, status: 'new', payment: 'pending', address: '' },
    // עתידיות
    { c: 0, b: 1, when: dayAt(now, 3, '12:00'), menu: 1, status: 'approved', payment: 'pending' },
    { c: 4, b: 4, when: dayAt(now, 6, '18:30'), menu: 0, status: 'pending_customer', payment: 'pending' },
    { c: 1, b: 0, when: dayAt(now, 12, '11:00'), menu: 2, status: 'new', payment: 'pending' },
    // ארכיון
    { c: 1, b: 0, when: dayAt(now, -3, '12:00'), menu: 1, status: 'delivered', branchApproval: { manager: 'דני', at: '' }, qNumber: 'cs301', payment: 'pending' },
    { c: 0, b: 1, when: dayAt(now, -5, '13:00'), menu: 0, status: 'delivered', branchApproval: { manager: 'מאיה', at: '' }, qNumber: 'cs288', payment: 'pending', poNumber: '4500100' },
    { c: 6, b: 0, when: dayAt(now, -6, '11:30'), menu: 1, status: 'delivered', branchApproval: { manager: 'דני', at: '' }, qNumber: 'cs250', payment: 'pending' },
    { c: 2, b: 2, when: dayAt(now, -8, '12:00'), menu: 2, status: 'cancelled', payment: 'cancelled' },
  ];
  const handlers = [ME, 'דניאל', 'מאיה', ME, 'רוני'];

  return seeds.map((s, i): Order => {
    const c = CUSTOMERS[s.c];
    const b = BRANCHES[s.b];
    const items = ITEMS[s.menu ?? 0];
    const amount = items.reduce((t, it) => t + it.qty * it.unitPrice, 0);
    const qAmount = s.qNumber ? (s.qAmount ?? amount) : undefined;
    return {
      id: 1040 + i,
      customerId: c.id,
      customerName: c.name,
      date: s.when.date,
      time: s.when.time,
      branchId: b.id,
      branchName: b.name,
      cluster: b.cluster,
      branchPhone: b.phone,
      amount,
      qNumber: s.qNumber,
      qAmount,
      status: s.status ?? 'new',
      branchApproval: s.branchApproval ? { manager: s.branchApproval.manager, at: s.when.date } : undefined,
      payment: s.payment ?? 'pending',
      method: c.method,
      accountPhone: c.accountPhone,
      handler: handlers[i % handlers.length],
      channel: (['טלפון', 'WhatsApp', 'מייל'] as const)[i % 3],
      delivery: s.delivery ?? 'delivery',
      address: s.address ?? c.address,
      contactName: c.contact,
      contactPhone: c.phone,
      poRequired: !!c.poRequired,
      poNumber: s.poNumber,
      items,
      instructions: i % 4 === 0 ? 'להגיע לשער האחורי, להתקשר 10 דקות לפני' : undefined,
      notes: i % 3 === 0 ? [{ by: 'דניאל', at: s.when.date, text: 'הלקוח ביקש חשבונית על שם החברה' }] : [],
      createdBy: handlers[(i + 1) % handlers.length],
      createdAt: s.when.date,
      billingNote: c.billing,
    };
  });
}
