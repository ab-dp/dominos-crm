export type OrderStatus = 'new' | 'pending_customer' | 'approved' | 'delivered' | 'partial' | 'cancelled';
export type PaymentState = 'pending' | 'paid' | 'failed' | 'cancelled';
// אמצעי התשלום הבסיסיים נעולים ברשימות המערכת; אפשר להוסיף אחרים, לכן המזהה הוא מחרוזת
export type PaymentMethod = 'credit' | 'account' | 'cash' | (string & {});

/* status שומר רק את אישור הלקוח ואת הסגירה. השלב בציר נגזר מהנתונים – ראו stageOf */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'ממתין לאישור לקוח', // ערך ישן – מוצג כמו "ממתין לאישור לקוח"
  pending_customer: 'ממתין לאישור לקוח',
  approved: 'הלקוח אישר',
  delivered: 'סופקה',
  partial: 'סופקה חלקית',
  cancelled: 'בוטלה',
};
export const CLOSED: OrderStatus[] = ['delivered', 'partial', 'cancelled'];

/* ציר ההזמנה: ממתין לאישור לקוח ← ממתין לעדכון בתפעול ← מאושר ← הוקלד ל-Q ← נסגרה (סופקה / חלקית, אפשר באיחור). בוטלה – מכל שלב */
export type Stage = 'pending_customer' | 'pending_branch' | 'approved' | 'in_q' | 'delivered' | 'partial' | 'cancelled';
export const STAGE_LABEL: Record<Stage, string> = {
  pending_customer: 'ממתין לאישור לקוח',
  pending_branch: 'ממתין לעדכון בתפעול',
  approved: 'מאושר',
  in_q: 'הוקלד ל-Q',
  delivered: 'סופקה',
  partial: 'סופקה חלקית',
  cancelled: 'בוטלה',
};
export const OPEN_STAGES: Stage[] = ['pending_customer', 'pending_branch', 'approved', 'in_q'];
export function stageOf(o: Pick<Order, 'status' | 'branchApproval' | 'qNumber'>): Stage {
  if (o.status === 'delivered' || o.status === 'partial' || o.status === 'cancelled') return o.status;
  if (o.qNumber) return 'in_q';
  if (o.branchApproval) return 'approved';
  if (o.status === 'approved') return 'pending_branch';
  return 'pending_customer';
}
/* סטטוס אספקה לדוחות: סופקה / סופקה באיחור / חלקית / בוטלה / פתוחה */
export type Outcome = 'ontime' | 'late' | 'partial' | 'cancelled' | 'open';
export const OUTCOME_LABEL: Record<Outcome, string> = { ontime: 'סופקה', late: 'סופקה באיחור', partial: 'סופקה חלקית', cancelled: 'בוטלה', open: 'פתוחה' };
export function outcomeOf(o: Pick<Order, 'status' | 'late'>): Outcome {
  if (o.status === 'cancelled') return 'cancelled';
  if (o.status === 'partial') return 'partial';
  if (o.status === 'delivered') return o.late ? 'late' : 'ontime';
  return 'open';
}
export const closeLabel = (o: Pick<Order, 'status' | 'late'>) =>
  (o.status === 'delivered' || o.status === 'partial') && o.late ? `${STATUS_LABEL[o.status]} · באיחור ${o.late.minutes ? `${o.late.minutes} דק'` : ''}`.trim() : STATUS_LABEL[o.status];

export const PAYMENT_LABEL: Record<PaymentState, string> = {
  pending: 'ממתין לתשלום',
  paid: 'שולם',
  failed: 'חיוב נכשל',
  cancelled: 'בוטל',
};
export const METHOD_LABEL: Record<string, string> = {
  credit: 'אשראי',
  account: 'הקפה',
  cash: 'מזומן',
  other: 'אחר',
};
/* אמצעי התשלום כפי שמוצג בכל מקום (כרטיס, טבלאות, דוחות, ייצוא): "אחר – העברה בנקאית" כשנבחר "אחר" */
export function methodText(o: { method: string; methodLabel?: string; methodNote?: string }) {
  const label = o.methodLabel || METHOD_LABEL[o.method] || o.method;
  return o.method === 'other' && o.methodNote?.trim() ? `${label} – ${o.methodNote.trim()}` : label;
}

export type Branch = { id: string; name: string; cluster: string; phone: string };

/* שורה בהזמנה: מוצר מהמחירון (itemId, group = קבוצה, name = רמת המחיר) או פריט ידני (בלי itemId, name = שם המוצר).
   toppings – הפירוט (בפיצה: תוספות; בנלווים: שם המוצר). parts – חלוקה לחצי-חצי או רבעים: טקסט פירוט לכל חלק, מופרד בפסיקים (אז toppings ריק).
   רשימה של טקסטים ולא רשימה של רשימות – Firestore לא שומר רשימה בתוך רשימה.
   detail – הערה לשורה. manualPrice – המחיר שונה ידנית ולא מתעדכן במעבר משלוח/איסוף */
export type OrderItem = { itemId?: string; group?: string; name: string; toppings?: string[]; parts?: string[]; detail?: string; qty: number; unitPrice: number; manualPrice?: boolean };
const FRACTION: Record<number, string> = { 2: '½', 4: '¼' };
export const partsText = (parts: string[]) => parts.map((p) => `${FRACTION[parts.length] ?? ''} ${p || 'רגילה'}`.trim()).join(' | ');
export const splitPart = (p: string) => p.split(',').map((x) => x.trim()).filter(Boolean);
export const itemLabel = (i: Pick<OrderItem, 'group' | 'name' | 'toppings' | 'parts' | 'detail'>) => {
  const head = i.group && i.group !== 'כללי' ? `${i.group} · ${i.name}` : i.name;
  const tops = i.parts?.length ? ` — ${partsText(i.parts)}` : i.toppings?.length ? ` — ${i.toppings.join(', ')}` : '';
  return `${head}${tops}${i.detail ? ` · ${i.detail}` : ''}`;
};
/* קטגוריות קבועות לקליטת פריטים. בשורה חדשה: group = הקטגוריה, name = סוג הפיצה / המוצר (מלל חופשי).
   שורות מהזמנות ישנות (קבוצת מחירון או פריט ידני) נכנסות ל"אחר" ומוצגות כמו שנרשמו. */
export const CATEGORIES = ['פיצות', 'ליד הפיצה', 'כריכים', 'קינוחים', 'משקאות'];
export const PIZZA = 'פיצות';
export const OTHER = 'אחר';
export const categoryOf = (i: Pick<OrderItem, 'group'>) => (i.group && CATEGORIES.includes(i.group) ? i.group : OTHER);
const SPLIT_NAME: Record<number, string> = { 2: 'חצי-חצי', 4: 'רבעים' };
// "חצי-חצי: פטריות | רגילה" – בלי ½ ליד מספר, שלא ייקרא "1½"
export const toppingText = (i: Pick<OrderItem, 'toppings' | 'parts'>) => (i.parts?.length
  ? `${SPLIT_NAME[i.parts.length] ?? 'חלוקה'}: ${i.parts.map((p) => p.trim() || 'רגילה').join(' | ')}`
  : i.toppings?.length ? i.toppings.join(', ') : '');

type ItemsPick = Pick<OrderItem, 'group' | 'name' | 'toppings' | 'parts' | 'detail' | 'qty'>;
export type ItemType = { name: string; qty: number; rows: { qty: number; text: string }[] };
export type ItemCategory = { category: string; qty: number; types: ItemType[] };
/* תצוגה מקובצת: קטגוריה ← סוג / מוצר ← פירוט. שורות זהות מתאחדות ("4 פטריות" ולא 4+…) */
export function groupItems(items: ItemsPick[]): ItemCategory[] {
  const cats = new Map<string, ItemCategory>();
  items.forEach((i) => {
    const cat = categoryOf(i);
    const c = cats.get(cat) ?? { category: cat, qty: 0, types: [] };
    cats.set(cat, c);
    c.qty += i.qty;
    const name = cat === OTHER ? (i.group && i.group !== 'כללי' ? `${i.group} · ${i.name}` : i.name).trim() : i.name.trim();
    let t = c.types.find((x) => x.name === name);
    if (!t) { t = { name, qty: 0, rows: [] }; c.types.push(t); }
    t.qty += i.qty;
    const text = [toppingText(i) || (cat === PIZZA ? 'ללא תוספת' : ''), i.detail?.trim()].filter(Boolean).join(' · ');
    const same = t.rows.find((r) => r.text === text);
    if (same) same.qty += i.qty; else t.rows.push({ qty: i.qty, text });
  });
  return [...CATEGORIES, OTHER].flatMap((k) => cats.get(k) ?? []);
}
/* "13 משפחתית — 4 פטריות · 4 זיתים · 5 ללא תוספת" / "6 קולה 1.5 ליטר" */
export const typeText = (t: ItemType) => {
  if (t.rows.length === 1) return t.rows[0].text ? `${t.qty} ${t.name} — ${t.rows[0].text}` : `${t.qty} ${t.name}`;
  return `${t.qty} ${t.name} — ${t.rows.map((r) => `${r.qty} ${r.text || 'רגיל'}`).join(' · ')}`;
};
export const itemsText = (items: ItemsPick[]) => {
  // הזמנה ישנה בלבד – אותו טקסט כמו תמיד
  if (!items.some((i) => categoryOf(i) !== OTHER)) return items.map((i) => `${i.qty}× ${itemLabel(i)}`).join(', ');
  return groupItems(items).map((c) => `${c.category} (${c.qty}): ${c.types.map(typeText).join(' ; ')}`).join(' | ');
};

export type Order = {
  id: number;
  customerId: string;
  customerName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  branchId: string;
  branchName: string;
  cluster: string; // שם האשכול, קפוא ביום ההזמנה
  branchPhone: string;
  amount: number; // הסכום לחיוב, לפי הסגירה מול הלקוח
  calcAmount?: number; // הסכום המחושב מהפריטים – נשמר רק כשהסכום לחיוב שונה ידנית
  qNumber?: string;
  qAmount?: number;
  status: OrderStatus;
  branchApproval?: { manager: string; at: string };
  payment: PaymentState;
  method: PaymentMethod;
  methodLabel?: string;
  methodNote?: string; // באמצעי תשלום "אחר": מה האמצעי בפועל (העברה בנקאית, צ'ק…)
  accountPhone?: string;
  handler: string;
  handlerUid?: string;
  channel: string;
  delivery: 'delivery' | 'pickup';
  address?: string;
  contactName?: string;
  contactPhone?: string;
  poRequired: boolean;
  poNumber?: string;
  items: OrderItem[];
  contents?: string; // תכולה במילים: "12 משפחתיות, 6 שתייה" – בעיקר בהזמנה מהירה
  deliveryFee?: number; // דמי משלוח, כלולים בסכום ההזמנה
  instructions?: string;
  note?: string; // הערה פנימית שנרשמה ביצירה
  notes: { by: string; at: string; text: string }[];
  createdBy: string;
  createdByUid?: string;
  createdAt: string; // YYYY-MM-DD
  updatedBy?: string; // uid של מי ששינה אחרון – לזיהוי שינוי של משתמש אחר בזמן שהתיק פתוח
  updatedByName?: string;
  updatedAt?: { seconds: number };
  billingNote?: string;
  partialNote?: string; // מה סופק בפועל, בסגירה "סופקה חלקית"
  cancelReason?: string;
  /* אישורים שמנקים חריג (אפיון 9): פער מול Q שהוסבר, וביטול שבוצע גם בקופה */
  qGapAck?: { amount: number; qAmount: number; by: string; at: string; note?: string };
  qCancelAck?: { by: string; at: string };
  /* שינוי אחרי אישור (אפיון 8): מה שונה, הערכים כפי שאושרו, ומה צריך לעדכן */
  changedAfterApproval?: { at: string; by: string; fields: string[]; before: Record<string, unknown> };
  qNeedsUpdate?: boolean; // השינוי עוד לא עודכן בקופה
  /* תיקון בחודש נעול (אפיון 7): הסיבה של התיקון האחרון; מסומן בדוח החודש "תיקון לאחר סגירה" */
  postCloseFix?: { reason: string; by: string; at?: unknown };
  cancelNote?: string;
  /* אספקה באיחור – נרשם בסגירה (סופקה / חלקית), minutes לא חובה */
  late?: { minutes: number };
  /* תזכורת בשלב Q: לשלוח בקבוצת התפעול. false = עוד לא נשלח; חסר = הזמנה מלפני התזכורת */
  opsNotified?: boolean;
  /* הוזנה בדיעבד – תאריך שעבר, לתיעוד בלבד */
  backfill?: boolean;
};
