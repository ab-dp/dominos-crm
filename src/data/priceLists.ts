/* מחירונים (אפיון 6.7): מוצרים לפי הקטגוריות של ההזמנה (פיצות / ליד הפיצה / כריכים / קינוחים / משקאות) ועוד מדרגות משלוח.
   המחירים מוקלדים ידנית וכולם כוללים מע"מ. מוצר בלי מחיר מותר – את המחיר ממלאים בהצעה או בהזמנה.
   המחיר נשמר בתוך כל הזמנה והצעה – שינוי מחירון לא משנה אותן. כל עריכה נרשמת ביומן. */
import { collection, doc, serverTimestamp, writeBatch, type Timestamp, type WriteBatch } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { CATEGORIES } from './types';
import { byName, useLiveCollection } from './live';

/* category – אחת הקטגוריות של ההזמנה, או "משלוח". price – משלוח, pickupPrice – איסוף עצמי (חסר = כמו משלוח).
   במשלוח: price = דמי המשלוח, upTo = עד כמה פריטים המדרגה מתאימה (להצעה אוטומטית).
   group – שדה ישן (מחירון לפי קבוצות ורמות). מחירון ישן מומר בקריאה – ראו normalizeItem */
export type PriceItem = { id: string; category: string; name: string; price?: number; pickupPrice?: number; upTo?: number; active: boolean; group?: string };
export const DELIVERY_CAT = 'משלוח';
export const PL_TABS = [...CATEGORIES, DELIVERY_CAT];
export type PriceList = {
  id: string; name: string; active: boolean; items: PriceItem[];
  note?: string;       // תנאי שמוצג כאזהרה בהצעה ובהזמנה, למשל "תקף מ-10 פיצות משפחתיות"
  minPizzas?: number;  // מינימום פיצות – מתחת לזה מופיעה אזהרה
  createdAt?: Timestamp;
};

export const priceOf = (i: Pick<PriceItem, 'price' | 'pickupPrice'>, delivery: 'delivery' | 'pickup') => (delivery === 'pickup' ? i.pickupPrice ?? i.price : i.price);

/* מחירון ישן: קבוצה + רמה ("משפחתיות" · "עם תוספת") – הקטגוריה מנוחשת מהשם, והשם הוא "קבוצה – רמה" */
// הסדר חשוב: "משפחתיות – עם תוספת" היא פיצה, לא "ליד הפיצה"
const GUESS: [RegExp, string][] = [[/משלוח/, DELIVERY_CAT], [/שתי|משק|בקבוק|פחית/, 'משקאות'], [/פיצ|משפחת|אישי/, 'פיצות'], [/קינוח|גליד|עוג/, 'קינוחים'], [/כריך|רול|טוסט/, 'כריכים'], [/נלוו|תוספ|לחם|סל|מקלות|כנפ|צ'יק|פופ/, 'ליד הפיצה']];
export function normalizeItem(i: PriceItem & { group?: string }): PriceItem {
  if (i.category && PL_TABS.includes(i.category)) return i;
  const g = i.group?.trim() && i.group.trim() !== 'כללי' ? i.group.trim() : '';
  const text = `${g} ${i.name}`;
  const category = GUESS.find(([re]) => re.test(text))?.[1] ?? 'פיצות';
  return { ...i, category, name: g ? `${g} – ${i.name}` : i.name };
}

/* מסמך → מחירון: שדות ישנים נשארים במסמך עד העריכה הבאה, ובתצוגה הכל לפי המבנה החדש */
const fromDoc = (id: string, d: Record<string, unknown>): PriceList => {
  const items = ((d.items as PriceItem[] | undefined) ?? []).map(normalizeItem);
  return { active: true, ...d, items, id, name: String(d.name ?? '') } as PriceList;
};

/* האזנה משותפת אחת לכל המערכת (live.ts) */
export function usePriceLists() {
  return useLiveCollection<PriceList>('priceLists', fromDoc, byName);
}

/* Firestore לא מקבל undefined – מוצר נשמר בלי שדות ריקים, ובלי השדה הישן group */
const cleanItem = ({ group: _g, ...i }: PriceItem): PriceItem => Object.fromEntries(Object.entries({ ...i, name: i.name.trim() }).filter(([, v]) => v !== undefined && v !== '')) as PriceItem;

const me = () => { const u = auth.currentUser!; return { uid: u.uid, name: u.displayName ?? u.email ?? '' }; };
function audit(batch: WriteBatch, entityId: string, action: string, before: unknown, after: unknown, note?: string) {
  const u = me();
  batch.set(doc(collection(db, 'auditLog')), {
    entity: 'priceList', entityId, action, before: before ?? null, after: after ?? null, source: 'inline', ...(note ? { note } : {}),
    by: u.uid, byName: u.name, at: serverTimestamp(), ok: true,
  });
}

export async function createPriceList(name: string, items: PriceItem[] = [], extra: Pick<PriceList, 'note' | 'minPizzas'> = {}): Promise<string> {
  const u = me();
  const batch = writeBatch(db);
  const ref = doc(collection(db, 'priceLists'));
  const clean = Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined && v !== ''));
  batch.set(ref, { name: name.trim(), active: true, items: items.map(cleanItem), ...clean, createdAt: serverTimestamp(), createdBy: u.uid, updatedAt: serverTimestamp(), updatedBy: u.uid });
  audit(batch, ref.id, 'create', null, { name: name.trim(), items: items.length });
  await batch.commit();
  return ref.id;
}

/* עדכון: undefined במחיר / בתנאי פירושו "ריק" – לכן נשמר כמחרוזת ריקה או 0 ולא נשלח undefined */
export async function updatePriceList(pl: PriceList, patch: Partial<Pick<PriceList, 'name' | 'active' | 'items' | 'note' | 'minPizzas'>>, detail?: { before?: unknown; after?: unknown }) {
  const u = me();
  const batch = writeBatch(db);
  const data: Record<string, unknown> = { ...patch };
  if (patch.items) data.items = patch.items.map(cleanItem);
  if ('note' in patch) data.note = patch.note?.trim() ?? '';
  if ('minPizzas' in patch) data.minPizzas = patch.minPizzas ?? 0;
  batch.update(doc(db, 'priceLists', pl.id), { ...data, updatedAt: serverTimestamp(), updatedBy: u.uid });
  const before = Object.fromEntries(Object.keys(patch).filter((k) => k !== 'items').map((k) => [k, pl[k as keyof PriceList] ?? null]));
  audit(batch, pl.id, 'update', detail?.before ?? before, detail?.after ?? Object.fromEntries(Object.entries(patch).filter(([k]) => k !== 'items')));
  await batch.commit();
}

/* שיוך לקוחות למחירון ממסך המחירונים – כמה לקוחות בפעולה אחת. priceListId ריק = הסרת השיוך */
export async function assignPriceList(customers: { id: string; name: string; priceListId: string }[], priceListId: string, plName: string) {
  const u = me();
  for (let i = 0; i < customers.length; i += 200) {
    const batch = writeBatch(db);
    customers.slice(i, i + 200).forEach((c) => {
      batch.update(doc(db, 'customers', c.id), { priceListId, updatedAt: serverTimestamp(), updatedBy: u.uid });
      batch.set(doc(collection(db, 'auditLog')), {
        entity: 'customer', entityId: c.id, action: 'update', before: { priceListId: c.priceListId || null }, after: { priceListId: priceListId || null }, source: 'bulk',
        note: priceListId ? `שויך למחירון "${plName}"` : `הוסר מהמחירון "${plName}"`, by: u.uid, byName: u.name, at: serverTimestamp(), ok: true,
      });
    });
    await batch.commit();
  }
}

/* מחיקת מחירון – מנהל מערכת בלבד (נאכף בכללי האבטחה). לקוחות שמשויכים אליו נשארים בלי מחירון, באותה פעולה,
   ומחירים מיוחדים שלהם למוצרים של המחירון יורדים. הזמנות והצעות קיימות לא משתנות (המחיר שמור בתוכן). ביומן – תמונת מצב והסיבה. */
export async function deletePriceList(pl: PriceList, assigned: { id: string; customPrices: { itemId: string }[] }[], reason: string) {
  const u = me();
  const batch = writeBatch(db);
  const ids = new Set(pl.items.map((i) => i.id));
  assigned.forEach((c) => batch.update(doc(db, 'customers', c.id), {
    priceListId: '', customPrices: c.customPrices.filter((x) => !ids.has(x.itemId)), updatedAt: serverTimestamp(), updatedBy: u.uid,
  }));
  batch.set(doc(collection(db, 'auditLog')), {
    entity: 'priceList', entityId: pl.id, action: 'delete', before: { name: pl.name, items: pl.items.map(cleanItem) }, after: { customers: assigned.length }, source: 'form', note: reason.trim(),
    by: u.uid, byName: u.name, at: serverTimestamp(), ok: true,
  });
  batch.delete(doc(db, 'priceLists', pl.id));
  await batch.commit();
}

/* כמה פיצות יש בשורות (להשוואה מול מינימום המחירון) */
export const pizzaCount = (lines: { group?: string; category?: string; qty: number }[]) => lines.filter((l) => (l.category ?? l.group) === 'פיצות').reduce((t, l) => t + (l.qty || 0), 0);
