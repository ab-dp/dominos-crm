export type OrderStatus = 'new' | 'pending_customer' | 'approved' | 'delivered' | 'partial' | 'cancelled';
export type PaymentState = 'pending' | 'paid' | 'failed' | 'cancelled';
// אמצעי התשלום הבסיסיים נעולים ברשימות המערכת; אפשר להוסיף אחרים, לכן המזהה הוא מחרוזת
export type PaymentMethod = 'credit' | 'account' | 'cash' | (string & {});

/* status שומר רק פתוחה / נסגרה. השלב בציר נגזר מהנתונים – ראו stageOf.
   כל הזמנה שנכנסת למערכת כבר אושרה על ידי הלקוח: הזמנה חדשה נשמרת 'approved'.
   'new' ו-'pending_customer' הם ערכים ישנים – מתפרשים כ-'approved' בקריאה (fromDoc ב-orders.ts), ומוצגים "פתוחה" */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'פתוחה',
  pending_customer: 'פתוחה',
  approved: 'פתוחה',
  delivered: 'סופקה',
  partial: 'סופקה חלקית',
  cancelled: 'בוטלה',
};
export const CLOSED: OrderStatus[] = ['delivered', 'partial', 'cancelled'];

/* ציר ההזמנה: פתוחה ← הוקלד ל-Q ← נסגרה (סופקה / חלקית, אפשר באיחור). בוטלה – מכל שלב */
export type Stage = 'open' | 'in_q' | 'delivered' | 'partial' | 'cancelled';
export const STAGE_LABEL: Record<Stage, string> = {
  open: 'פתוחה',
  in_q: 'הוקלד ל-Q',
  delivered: 'סופקה',
  partial: 'סופקה חלקית',
  cancelled: 'בוטלה',
};
export const OPEN_STAGES: Stage[] = ['open', 'in_q'];
export function stageOf(o: Pick<Order, 'status' | 'qNumber'>): Stage {
  if (o.status === 'delivered' || o.status === 'partial' || o.status === 'cancelled') return o.status;
  if (o.qNumber) return 'in_q';
  return 'open';
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
/* menuId / toppingKind – שורה שנבחרה בבוחר המדורג (שלב 7ג): הסוג בתפריט וסוג התוספת. רשות; השם נשמר כטקסט, אז שינוי בתפריט לא משנה הזמנות עבר */
export type OrderItem = { itemId?: string; group?: string; name: string; toppings?: string[]; parts?: string[]; detail?: string; qty: number; unitPrice: number; manualPrice?: boolean; menuId?: string; toppingKind?: string };
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
  /* ישן, לקריאה בלבד: "עודכן בתפעול" בוטל (נובמבר 2026). מוצג רק בהיסטוריית ההזמנה */
  branchApproval?: { manager: string; at: string };
  payment: PaymentState;
  method: PaymentMethod;
  methodLabel?: string;
  methodNote?: string; // באמצעי תשלום "אחר": מה האמצעי בפועל (קופון, פיצוי…)
  accountPhone?: string;
  handler: string;
  handlerUid?: string;
  /* ערוץ: channelId – פריט ברשימה הסגורה (settings/lists.channels); channel – השם בזמן השמירה (לגרסאות ישנות ולייצוא).
     להצגה, לסינון ולקיבוץ – רק channelLabel (data/channels.ts), אף פעם לא channel ישירות */
  channel: string;
  channelId?: string;
  /* הטקסט החופשי הישן של הזמנה מלפני הרשימה הסגורה – נשמר כאן כשנבחר לה ערוץ בפעם הראשונה (לרוב מספר פנייה) */
  channelLegacy?: string;
  /* מספר קריאה – טקסט חופשי, לא חובה */
  callRef?: string;
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
  createdTime?: string; // HH:MM – נגזר מחותמת היצירה בקריאה, לא נשמר
  updatedBy?: string; // uid של מי ששינה אחרון – לזיהוי שינוי של משתמש אחר בזמן שהתיק פתוח
  updatedByName?: string;
  updatedAt?: { seconds: number };
  billingNote?: string;
  partialNote?: string; // מה סופק בפועל, בסגירה "סופקה חלקית"
  cancelReason?: string;
  /* אישורים שמנקים חריג (אפיון 9): פער מול Q שהוסבר, וביטול שבוצע גם בקופה */
  qGapAck?: { amount: number; qAmount: number; by: string; at: string; note?: string };
  qCancelAck?: { by: string; at: string };
  /* ישן, לקריאה בלבד: "שונתה לאחר אישור" – נשאר מוצג בהזמנות ישנות. שינויים חדשים נכתבים ל-changedAfterQ */
  changedAfterApproval?: { at: string; by: string; fields: string[]; before: Record<string, unknown> };
  /* שינוי אחרי הקלדה ל-Q (או אחרי סגירה): מה שונה, הערכים לפני השינוי, ומה צריך לעדכן */
  changedAfterQ?: { at: string; by: string; fields: string[]; before: Record<string, unknown> };
  /* מתי ההזמנה נוצרה או שונתה בפרט שהסניף צריך לדעת (מועד, שעה, סניף, משלוח/איסוף, כתובת, פריטים) – ISO.
     נכתב רק בשכבת הנתונים (orders.ts: createOrder, updateOrdersBatch, updateOrderSafe). לתזכורת "לעדכן בתפעול" */
  opsChangeAt?: string;
  qNeedsUpdate?: boolean; // השינוי עוד לא עודכן בקופה
  /* תיקון בחודש נעול (אפיון 7): הסיבה של התיקון האחרון; מסומן בדוח החודש "תיקון לאחר סגירה" */
  postCloseFix?: { reason: string; by: string; at?: unknown };
  cancelNote?: string;
  /* אספקה באיחור – נרשם בסגירה (סופקה / חלקית), minutes לא חובה */
  late?: { minutes: number };
  /* ישן, לקריאה בלבד: "נשלח בקבוצת תפעול" בוטל (נובמבר 2026). מוצג רק בהיסטוריית ההזמנה */
  opsNotified?: boolean;
  /* הוזנה בדיעבד – תאריך שעבר, לתיעוד בלבד */
  backfill?: boolean;
  /* "בהמתנה": ההזמנה ממתינה לטיפול (למשל הלקוח לא עונה לחיוב) – עוברים להזמנה הבאה וחוזרים אליה.
     אחת פעילה לכל היותר; משתחררת ידנית או כשרושמים Q. ההיסטוריה ביומן ההזמנה */
  hold?: OrderHold;
  /* תיעוד טיפול (אחרי שההזמנה נסגרה): התיעוד עצמו נשמר בתיק הלקוח (customers/{id}/activity, kind 'care');
     כאן רק כמה תיעודים יש ומתי האחרון – לתג "תועד" ולסינון בארכיון */
  careCount?: number;
  careAt?: string;
};

export type OrderHold = {
  reason: string;
  note?: string;
  by: string; // uid
  byName: string;
  at: string; // ISO – מתי סומנה (או מתי נוסף הניסיון האחרון)
  remindAt?: string; // ISO – מתי לחזור
  attempts: number; // כמה ניסיונות נרשמו (הסימון הראשון = 1)
};
export const HOLD_REASONS = ['הלקוח לא עונה', 'ממתין לפרטי אשראי', 'אחר'];
/* הזמנה שהושהתה "בלי תזכורת" לא נתקעת בהמתנה: אחרי שעה היא חוזרת ל"להקליד ל-Q" (בלי הודעה קופצת) */
export const HOLD_NO_REMIND_MIN = 60;
/* הגיע הזמן לחזור להזמנה שבהמתנה – לפי זמן החזרה שנקבע, או שעה אחרי הסימון כשלא נקבע זמן */
export const holdDue = (h: OrderHold | undefined, now: Date) => !!h
  && (h.remindAt ? new Date(h.remindAt).getTime() : new Date(h.at).getTime() + HOLD_NO_REMIND_MIN * 60000) <= now.getTime();

/* ---------- תזכורת "לעדכן בתפעול" ----------
   בערב שולחים לתפעול את הזמנות מחר. הזמנה של היום או מחר שנוצרה או שונתה בפרט שהסניף צריך לדעת
   אחרי שעת הסף (ברירת מחדל 18:00) ביום שלפני המועד – לא הייתה בסיכום, וצריך לעדכן את התפעול. רק תזכורת: נעלמת לבד. */
export const OPS_FIELDS: (keyof Order)[] = ['date', 'time', 'branchId', 'delivery', 'address', 'items'];
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/* מתי לכתוב opsChangeAt בשמירה: כשהשינוי נוגע באחד מ-OPS_FIELDS (בהשוואה לערך הנוכחי). אחרת undefined – לא נוגעים בשדה.
   opsChangeAt מפורש בשינוי (למשל "בטל" שמחזיר את הערך הקודם) גובר – אז לא מחשבים, והערך שבשינוי נכתב כמו שהוא */
export function opsChangeFor(before: Partial<Order>, patch: Partial<Order>, nowIso: string): string | undefined {
  if ('opsChangeAt' in patch) return undefined;
  return OPS_FIELDS.some((k) => k in patch && JSON.stringify(before[k] ?? null) !== JSON.stringify(patch[k] ?? null)) ? nowIso : undefined;
}
/* ההזמנה כמו שתישמר: השינוי, ו-opsChangeAt כמו ששכבת הנתונים תכתוב אותו */
export function orderAfterSave<T extends Order>(before: T, patch: Partial<Order>, nowIso: string): T {
  const at = opsChangeFor(before, patch, nowIso);
  return { ...before, ...patch, ...(at ? { opsChangeAt: at } : {}) };
}
const dayBeforeAt = (date: string, cutoff: string) => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = (cutoff || '18:00').split(':').map(Number);
  return new Date(y, m - 1, d - 1, h || 0, min || 0, 0);
};
const soonDay = (date: string, now: Date) => date === isoDay(now) || date === isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
/* cutoff – "HH:MM" מהספים (opsCutoff) */
export function needsOpsUpdate(o: Pick<Order, 'status' | 'date' | 'opsChangeAt'>, now: Date, cutoff: string): boolean {
  if (CLOSED.includes(o.status) || !o.opsChangeAt || !o.date || !soonDay(o.date, now)) return false;
  return new Date(o.opsChangeAt).getTime() >= dayBeforeAt(o.date, cutoff).getTime();
}
/* להציג בהודעת השמירה "לעדכן את התפעול"? כן כש:
   1. השמירה הזו כתבה opsChangeAt וההזמנה צריכה עדכון (needsOpsUpdate), או
   2. ההזמנה יוצאת מהסיכום שכבר נשלח: מועדה הקודם היום/מחר, כבר עברה שעת הסף ביום שלפניו, והיא הוזזה לתאריך אחר או בוטלה.
   (במקרה 2 אין תגית קבועה – רק ההודעה) */
export function opsReminderOnSave(before: Pick<Order, 'status' | 'date' | 'opsChangeAt'>, after: Pick<Order, 'status' | 'date' | 'opsChangeAt'>, now: Date, cutoff: string): boolean {
  if (after.opsChangeAt !== before.opsChangeAt && needsOpsUpdate(after, now, cutoff)) return true;
  const wasSent = !CLOSED.includes(before.status) && !!before.date && soonDay(before.date, now) && now.getTime() >= dayBeforeAt(before.date, cutoff).getTime();
  if (wasSent && (after.status === 'cancelled' || after.date !== before.date)) return true;
  /* הזמנה מבוטלת שחזרה לחיים אחרי הסיכום – הסניף לא קיבל אותה */
  return before.status === 'cancelled' && after.status !== 'cancelled' && !!after.date && soonDay(after.date, now) && now.getTime() >= dayBeforeAt(after.date, cutoff).getTime();
}
/* התאריך שההודעה מדברת עליו: המועד החדש כשצריך לעדכן עליו, אחרת המועד שממנו ההזמנה יצאה */
export const opsReminderDate = (before: Pick<Order, 'date'>, after: Pick<Order, 'status' | 'date' | 'opsChangeAt'>, now: Date, cutoff: string) =>
  (needsOpsUpdate(after, now, cutoff) ? after.date : before.date);
/* "ההזמנה למחר" / "ההזמנה להיום" – להודעת השמירה */
export const opsDayWord = (date: string, now: Date) => (date === isoDay(now) ? 'להיום' : 'למחר');
/* "שונתה אחרי הקלדה ל-Q" – שני שינויים במקביל לא דורסים זה את זה: איחוד השדות, והערכים "לפני" המוקדמים ביותר גוברים */
export function mergeChangedAfterQ(cur: Order['changedAfterQ'], mine: NonNullable<Order['changedAfterQ']>): NonNullable<Order['changedAfterQ']> {
  if (!cur) return mine;
  return { ...mine, fields: [...new Set([...cur.fields, ...mine.fields])], before: { ...mine.before, ...cur.before } };
}
