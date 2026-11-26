/* עריכה מרכזית: מה נשלח מטופס ההזמנה כשעורכים הזמנה קיימת.
   1. רק שדות מרשימה מותרת – לא מטפל, סטטוס, תשלום, יוצר, ולא "הערות להנהלת חשבונות" (נטענות מהלקוח ונערכות בכרטיס).
   2. רק מה ששונה לעומת תמונת המצב שנלקחה כשנפתח הטופס – כך לא מתבקשת סיבה בחודש נעול על כל שמירה,
      ולא נוצר "שונתה אחרי Q" על שדות שלא נגעו בהם.
   3. פריטים, דמי משלוח וסכום – רק אם נגעו בהם (pricingTouched). הזמנה ישנה עם "תכולה" בטקסט בלי פריטים לא מקבלת סכום 0 בשקט.
   4. סניף – רק כשהוחלף (שם/טלפון/אשכול של סניף שלא הוחלף לא נכתבים מחדש); לקוח – רק כשהוחלף. */
import type { NewOrderInput } from '../../data/orders';
import type { Order } from '../../data/types';

const BASE_KEYS = ['date', 'time', 'delivery', 'address', 'contactName', 'contactPhone', 'callRef', 'poNumber', 'instructions', 'method'] as const;
const PRICE_KEYS = ['items', 'deliveryFee', 'amount', 'calcAmount'] as const;
const BRANCH_KEYS = ['branchId', 'branchName', 'branchPhone', 'cluster'] as const;

/* ריק = לא קיים: undefined, null ו-'' נחשבים אותו ערך, כדי ששדה ריק לא ייחשב "שונה" */
const norm = (v: unknown) => (v === undefined || v === null || v === '' ? null : v);
const same = (a: unknown, b: unknown) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));

export function editPatch(eo: Order, input: NewOrderInput, opts: { pricingTouched: boolean }): Partial<Order> {
  const out: Record<string, unknown> = {};
  const take = (k: keyof Order & keyof NewOrderInput) => { if (!same(eo[k], input[k])) out[k] = norm(input[k]) ?? undefined; };
  BASE_KEYS.forEach(take);
  // מעבר לאיסוף עצמי לא מוחק את הכתובת השמורה (כמו בעריכה בכרטיס) – אם יחזרו למשלוח היא שם
  if (input.delivery === 'pickup' && 'address' in out) delete out.address;
  /* אמצעי תשלום: טלפון הקפה נשמר רק בהקפה, ופירוט רק ב"אחר". שדה שלא שייך לאמצעי הנוכחי לא נמחק בשקט
     (בעריכה בכרטיס החלפת אמצעי לא ניקתה אותו); כשמחליפים אמצעי – הפירוט הישן מתנקה, כמו בכרטיס */
  const methodChanged = !same(eo.method, input.method);
  if (methodChanged) out.methodLabel = input.methodLabel;
  if (input.method === 'account') take('accountPhone');
  if (input.method === 'other' || methodChanged) take('methodNote');
  if (opts.pricingTouched) PRICE_KEYS.forEach(take);
  if (!same(eo.branchId, input.branchId)) BRANCH_KEYS.forEach((k) => { out[k] = norm(input[k]) ?? undefined; });
  if (!same(eo.customerId, input.customerId)) {
    out.customerId = input.customerId; out.customerName = input.customerName; out.poRequired = input.poRequired;
    out.billingNote = input.billingNote; // הערות להנה"ח של הלקוח החדש (נטענות מ"הנחיות חיוב" שלו)
  }
  // ערוץ: רק כשנבחר ערוץ מהרשימה ושונה. הזמנה ישנה עם טקסט חופשי – הטקסט עובר ל-channelLegacy (אם עוד ריק), לא הולך לאיבוד
  if (input.channelId && input.channelId !== eo.channelId) {
    out.channelId = input.channelId;
    out.channel = input.channel;
    const legacy = !eo.channelId ? eo.channel?.trim() ?? '' : '';
    if (legacy && !eo.channelLegacy) out.channelLegacy = legacy;
  }
  return out as Partial<Order>;
}
