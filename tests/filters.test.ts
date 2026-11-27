/* הסינון המשותף (data/orderFilters.ts) – הזמנות, דוח מפורט ובהמשך סיכום לתפעול */
import { describe, expect, it } from 'vitest';
import { LEGACY, SPARSE } from './fixtures/orders';
import { filterOptions, filtersText, matchesFilters } from '../src/data/orderFilters';

const ALL = [...LEGACY, ...SPARSE];
const ids = (f: Parameters<typeof matchesFilters>[1]) => ALL.filter((o) => matchesFilters(o, f)).map((o) => o.id);

describe('סינון הזמנות', () => {
  it('בלי סינון – הכל עובר', () => {
    expect(ids({})).toHaveLength(ALL.length);
    expect(ids({ cluster: '', branch: '' })).toHaveLength(ALL.length);
  });
  it('כל ממד לבד, ושילוב – כל התנאים', () => {
    expect(ids({ cluster: 'צפון' })).toMatchSnapshot();
    expect(ids({ method: 'credit' })).toMatchSnapshot();
    expect(ids({ outcome: 'late' })).toMatchSnapshot();
    expect(ids({ handler: 'נציג א', cluster: 'מרכז', method: 'account' })).toMatchSnapshot();
  });
  it('שלב – לפי stageOf, בסדר הציר', () => {
    const inq = ids({ stage: 'in_q' });
    expect(inq.length).toBeGreaterThan(0);
    expect(ALL.filter((o) => inq.includes(o.id)).every((o) => !!o.qNumber && !['delivered', 'partial', 'cancelled'].includes(o.status))).toBe(true);
    expect(ids({ stage: 'open' }).every((id) => !ALL.find((o) => o.id === id)!.qNumber)).toBe(true);
    const opts = filterOptions(ALL, ['stage'], {})[0].options.map((o) => o.value);
    expect(opts).toEqual(['open', 'in_q', 'delivered', 'partial', 'cancelled'].filter((v) => opts.includes(v)));
    expect(filterOptions(ALL, ['stage'], {})[0].options.find((o) => o.value === 'in_q')?.label).toBe('הוקלד ל-Q');
  });
  it('ערוץ – לפי channelLabel, כולל "לא מסווג" לטקסט ישן', () => {
    expect(ids({ channel: 'מכירות' })).toEqual([1001]);
    expect(ids({ channel: 'מוקד' })).toEqual([1005]);
    expect(ids({ channel: 'טלפון' })).toEqual([1006]); // ערוץ מושבת – עדיין מוצג ומסונן
    const legacy = ids({ channel: 'לא מסווג' });
    expect(legacy).toContain(1002);
    expect(legacy).not.toContain(1017); // בלי ערוץ בכלל – לא "לא מסווג"
    const opts = filterOptions(ALL, ['channel'], {})[0].options;
    expect(opts.map((o) => o.value)).toEqual(['מכירות', 'מוקד', 'טלפון', 'לא מסווג']);
    expect(opts.find((o) => o.value === 'לא מסווג')?.label).toBe('לא מסווג (טקסט ישן)');
  });
  it('מטפל ריק – לפי מי שיצר', () => {
    const o = { ...LEGACY[0], handler: '', createdBy: 'נציג ב' };
    expect(matchesFilters(o, { handler: 'נציג ב' })).toBe(true);
  });
  it('אפשרויות: סניפים לפי האשכול, סטטוסים בסדר קבוע, ערך שנבחר נשאר גם בלי הזמנות', () => {
    const opts = filterOptions(ALL, ['cluster', 'branch', 'method', 'outcome'], { cluster: 'צפון', method: 'bit' });
    expect(opts).toMatchSnapshot();
  });
  it('תיאור הסינון לאקסל ולכותרת', () => {
    expect(filtersText({ cluster: 'מרכז', method: 'account', outcome: 'late' })).toBe('מרכז · הקפה · סופקה באיחור');
    expect(filtersText({})).toBe('');
  });
});

/* שלב 5: "בטיפול", תאריך חזרה ו"אשר והפוך להזמנה" */
import { OPEN_QUOTE, WAITING as Q_WAITING, callDue, canConvert, isExpired as qExpired, needsFollowup as qFollow } from '../src/data/quotes';
import { QUOTES as Q_FIX } from './fixtures/orders';
describe('הצעות – בטיפול ותאריך חזרה', () => {
  const stale = { ...Q_FIX[1], status: 'handling' as const }; // לא עודכנה יומיים
  const now = new Date(2026, 10, 25, 10, 0, 0);
  it('"בטיפול" נחשבת פתוחה, ממתינה ויכולה לפוג', () => {
    expect(OPEN_QUOTE).toContain('handling');
    expect(Q_WAITING).toContain('handling');
    expect(qExpired({ status: 'handling', validUntil: '2026-11-20' }, '2026-11-25')).toBe(true);
  });
  it('כשנקבע תאריך חזרה – בלי "אין עדכון" (המשימה היא התזכורת)', () => {
    expect(qFollow(stale, now, 24)).toBe(true);
    expect(qFollow({ ...stale, callAt: '2026-11-25' }, now, 24)).toBe(false);
    expect(qFollow({ ...stale, callAt: '2026-11-27' }, now, 24)).toBe(false);
    expect(qFollow({ ...stale, callAt: '2026-11-24' }, now, 24)).toBe(false);
  });
  it('לחזור היום / שעבר – רק בהצעה שממתינה לתשובה', () => {
    expect(callDue({ status: 'handling', callAt: '2026-11-25' }, '2026-11-25')).toBe(true);
    expect(callDue({ status: 'noanswer', callAt: '2026-11-20' }, '2026-11-25')).toBe(true);
    expect(callDue({ status: 'sent', callAt: '2026-11-26' }, '2026-11-25')).toBe(false);
    expect(callDue({ status: 'approved', callAt: '2026-11-20' }, '2026-11-25')).toBe(false);
    expect(callDue({ status: 'sent', callAt: '' }, '2026-11-25')).toBe(false);
  });
  it('"אשר והפוך להזמנה" – בכל סטטוס חוץ מנדחתה והוזמנה', () => {
    expect(['draft', 'sent', 'handling', 'noanswer', 'approved'].every((s) => canConvert({ status: s as never }))).toBe(true);
    expect(canConvert({ status: 'rejected' })).toBe(false);
    expect(canConvert({ status: 'ordered' })).toBe(false);
  });
});

/* שלב 6ד: עריכה מרכזית – נשלחים רק שדות מותרים ששונו */
import { editPatch } from '../src/features/orders/editPatch';
import { LEGACY as L6 } from './fixtures/orders';
import type { NewOrderInput } from '../src/data/orders';
describe('עריכה מרכזית – editPatch', () => {
  const eo = L6.find((o) => o.items.length > 0 && o.address && o.channel) ?? L6[0];
  const same = (o: typeof eo): NewOrderInput => ({ ...o, handler: 'מישהו אחר', status: 'cancelled', billingNote: 'אחר' } as unknown as NewOrderInput);
  it('בלי שינוי – כלום (גם לא מטפל, סטטוס והערות להנה"ח)', () => {
    expect(editPatch(eo, same(eo), { pricingTouched: false })).toEqual({});
  });
  it('שינוי שעה – רק השעה', () => {
    expect(editPatch(eo, { ...same(eo), time: '19:45' }, { pricingTouched: false })).toEqual({ time: '19:45' });
  });
  it('ריק מול חסר – לא נחשב שינוי; מחיקת ערך – undefined', () => {
    expect(editPatch({ ...eo, callRef: undefined }, { ...same(eo), callRef: '' } as NewOrderInput, { pricingTouched: false })).toEqual({});
    expect(editPatch({ ...eo, callRef: 'A1' }, { ...same(eo), callRef: undefined } as NewOrderInput, { pricingTouched: false })).toEqual({ callRef: undefined });
  });
  it('סכום ופריטים – רק כשנגעו בהם', () => {
    const changed = { ...same(eo), amount: 1, items: [] } as NewOrderInput;
    expect(editPatch(eo, changed, { pricingTouched: false })).toEqual({});
    expect(editPatch(eo, changed, { pricingTouched: true })).toMatchObject({ amount: 1 });
  });
  it('מעבר לאיסוף עצמי לא מוחק את הכתובת', () => {
    expect(editPatch(eo, { ...same(eo), delivery: 'pickup', address: undefined } as NewOrderInput, { pricingTouched: false })).toEqual(eo.delivery === 'pickup' ? {} : { delivery: 'pickup' });
  });
  it('ערוץ מהרשימה בהזמנה עם טקסט ישן – הטקסט עובר ל-channelLegacy', () => {
    const old = { ...eo, channelId: undefined, channel: 'וואטסאפ', channelLegacy: undefined };
    expect(editPatch(old, { ...same(old), channelId: 'sales', channel: 'מכירות' } as NewOrderInput, { pricingTouched: false })).toEqual({ channelId: 'sales', channel: 'מכירות', channelLegacy: 'וואטסאפ' });
  });
  it('סניף שלא הוחלף – לא נכתב מחדש; הוחלף – כל פרטי הסניף', () => {
    expect(editPatch(eo, { ...same(eo), branchPhone: '000' } as NewOrderInput, { pricingTouched: false })).toEqual({});
    expect(Object.keys(editPatch(eo, { ...same(eo), branchId: 'zz', branchName: 'חדש', branchPhone: '1', cluster: 'דרום' } as NewOrderInput, { pricingTouched: false })).sort()).toEqual(['branchId', 'branchName', 'branchPhone', 'cluster']);
  });
});

/* שלב 5ב: יום עסקים = ראשון עד חמישי */
import { addBusinessDays } from '../src/data/quotes';
describe('ימי עסקים להצעות', () => {
  it('יום העסקים הבא', () => {
    expect(addBusinessDays('2026-11-25')).toBe('2026-11-26'); // ד׳ ← ה׳
    expect(addBusinessDays('2026-11-26')).toBe('2026-11-29'); // ה׳ ← א׳
    expect(addBusinessDays('2026-11-27')).toBe('2026-11-29'); // ו׳ ← א׳
    expect(addBusinessDays('2026-11-28')).toBe('2026-11-29'); // ש׳ ← א׳
  });
  it('כמה ימי עסקים קדימה', () => {
    expect(addBusinessDays('2026-11-26', 2)).toBe('2026-11-30'); // ה׳ + 2 ← ב׳
    expect(addBusinessDays('2026-11-25', 5)).toBe('2026-12-02'); // שבוע עבודה
  });
});

/* שלב 7א: התפריט – בדיקת תקינות לפני שמירה */
import { DEFAULT_MENU, menuProblem } from '../src/data/menu';
describe('תפריט', () => {
  it('ברירת המחדל תקינה, ופיצות עם כל השלבים', () => {
    expect(menuProblem(DEFAULT_MENU)).toBe('');
    expect(DEFAULT_MENU.categories[0].steps).toEqual({ variation: true, toppingKind: true, toppingText: true, split: true });
  });
  it('שם ריק או כפול – לא נשמר', () => {
    const m = structuredClone(DEFAULT_MENU);
    m.categories[0].items[0].name = '';
    expect(menuProblem(m)).toMatch('בלי שם');
    const d = structuredClone(DEFAULT_MENU);
    d.categories[0].items[1].name = d.categories[0].items[0].name;
    expect(menuProblem(d)).toMatch('פעמיים');
  });
});

/* שלב 7ב: מחיר לפי סוג תוספת, וקישור לתפריט לפי שם */
import { priceOf, suggestMenuLink } from '../src/data/priceLists';
describe('מחירון – סוגי תוספת', () => {
  const pizza = { price: 60, pickupPrice: 50, kindPrices: { without: { price: 48 }, meat: { price: 70, pickupPrice: 62 } } };
  it('בלי סוג / עם תוספת – מחיר השורה', () => {
    expect(priceOf(pizza, 'delivery')).toBe(60);
    expect(priceOf(pizza, 'pickup', 'with')).toBe(50);
  });
  it('סוג עם מחיר; איסוף בלי מחיר – כמו המשלוח של הסוג', () => {
    expect(priceOf(pizza, 'delivery', 'without')).toBe(48);
    expect(priceOf(pizza, 'pickup', 'without')).toBe(48);
    expect(priceOf(pizza, 'pickup', 'meat')).toBe(62);
  });
  it('סוג בלי מחיר – כמו "עם תוספת"', () => {
    expect(priceOf(pizza, 'delivery', 'mix')).toBe(60);
    expect(priceOf(pizza, 'pickup', 'mix')).toBe(50);
  });
  it('הצעת קישור: הסוג הארוך ביותר שמופיע בשם', () => {
    const opts = [{ id: 'family', name: 'משפחתית' }, { id: 'thick', name: 'משפחתית עבה' }, { id: 'personal', name: 'אישית' }];
    expect(suggestMenuLink('פיצה משפחתית עבה עם תוספת', opts)).toBe('thick');
    expect(suggestMenuLink('פיצה משפחתית ללא', opts)).toBe('family');
    expect(suggestMenuLink('שתייה גדולה', opts)).toBe('');
  });
});
describe('קישור לתפריט – יחיד ורבים', () => {
  const opts = [{ id: 'family', name: 'משפחתית' }, { id: 'thick', name: 'משפחתית עבה' }, { id: 'personal', name: 'אישית' }];
  it('משפחתיות / אישיות', () => {
    expect(suggestMenuLink('משפחתיות – רגילה', opts)).toBe('family');
    expect(suggestMenuLink('אישיות – רגילה', opts)).toBe('personal');
    expect(suggestMenuLink('משפחתיות – עבה', opts)).toBe('thick');
  });
});

/* שלב 7ג: הבוחר המדורג – מחיר לפי סוג תוספת, וטקסט התוספות שנשמר */
import { priceFor, pickedToppings } from '../src/features/orders/MenuPicker';
import type { CatalogItem } from '../src/features/orders/ItemsBuilder';
describe('בוחר מדורג', () => {
  const cat = structuredClone(DEFAULT_MENU.categories[0]); // פיצות
  const family = cat.items.find((i) => i.id === 'family')!;
  const ci = (o: Partial<CatalogItem>): CatalogItem => ({ id: 'x', category: 'פיצות', name: '', active: true, custom: false, ...o });
  it('מחירון מקושר עם מחירים לפי סוג', () => {
    const cat2 = [ci({ id: 'a', name: 'משפחתית', menuId: 'family', unit: 60, kindUnits: { without: 48, meat: 70 } })];
    expect(priceFor(cat2, cat, family, 'with').unit).toBe(60);
    expect(priceFor(cat2, cat, family, 'without').unit).toBe(48);
    expect(priceFor(cat2, cat, family, 'mix').unit).toBe(60); // בלי מחיר לסוג – כמו "עם תוספת"
  });
  it('מחירון ישן לפי שם, שורה לכל סוג תוספת', () => {
    const old = [ci({ id: 'w', name: 'משפחתיות – עם תוספת', unit: 62 }), ci({ id: 'n', name: 'משפחתיות – ללא', unit: 50 })];
    expect(priceFor(old, cat, family, 'without')).toMatchObject({ unit: 50, line: { id: 'n' } });
    expect(priceFor(old, cat, family, 'with')).toMatchObject({ unit: 62, line: { id: 'w' } });
  });
  it('בלי שורה במחירון – בלי מחיר', () => {
    expect(priceFor([], cat, family, 'with')).toEqual({});
  });
  it('טקסט התוספות', () => {
    expect(pickedToppings('ללא', 'without', 'זיתים')).toEqual([]);
    expect(pickedToppings('עם תוספת', 'with', 'זיתים, בצל')).toEqual(['זיתים', 'בצל']);
    expect(pickedToppings('בשרית', 'meat', 'פפרוני')).toEqual(['בשרית', 'פפרוני']);
  });
});
describe('בוחר מדורג – מקרי קצה', () => {
  const cat = structuredClone(DEFAULT_MENU.categories[0]);
  const family = cat.items.find((i) => i.id === 'family')!;
  const ci = (o: Partial<CatalogItem>): CatalogItem => ({ id: 'x', category: 'פיצות', name: '', active: true, custom: false, ...o });
  it('מחירון ישן רק עם "עם תוספת" ו"ללא": בשרית לוקחת את "עם תוספת"', () => {
    const old = [ci({ id: 'n', name: 'משפחתיות – ללא', unit: 50 }), ci({ id: 'w', name: 'משפחתיות – עם תוספת', unit: 62 })];
    expect(priceFor(old, cat, family, 'meat')).toMatchObject({ unit: 62, line: { id: 'w' } });
  });
  it('לקוח עם מחיר ייחודי ל"עם תוספת" ובלי מחיר לסוג – מחיר המחירון (החלטה 27.11)', () => {
    const c = [ci({ id: 'a', name: 'משפחתית', menuId: 'family', unit: 55, listUnit: 60 })];
    expect(priceFor(c, cat, family, 'with').unit).toBe(55);
    expect(priceFor(c, cat, family, 'mix').unit).toBe(60);
  });
});
import { quoteName, fixedCategory } from '../src/features/orders/MenuPicker';
describe('בוחר בהצעות ובמחירונים (7ד)', () => {
  it('שם השורה בהצעה כולל את סוג התוספת', () => {
    expect(quoteName('משפחתית', 'ללא')).toBe('משפחתית ללא');
    expect(quoteName('שתייה גדולה')).toBe('שתייה גדולה');
    expect(quoteName('משפחתית', '  ')).toBe('משפחתית');
  });
  it('קטגוריה לפי מזהה גם כשהשם בתפריט שונה', () => {
    expect(fixedCategory({ id: 'pizza', name: 'פיצות משפחתיות' })).toBe('פיצות');
    expect(fixedCategory({ id: 'zz', name: 'משקאות' })).toBe('משקאות');
    expect(fixedCategory({ id: 'zz', name: 'מבצעים' })).toBe('אחר');
  });
});
describe('בוחר – וריאציות במחירון (7ד)', () => {
  const cat = structuredClone(DEFAULT_MENU.categories[0]);
  const cc = { id: 'cc', name: "צ'יזי קראסט", active: true, variations: [{ id: 'v1', name: 'דקה', active: true }, { id: 'v2', name: 'עבה', active: true }] };
  cat.items.push(cc);
  const ci = (o: Partial<CatalogItem>): CatalogItem => ({ id: 'x', category: 'פיצות', name: '', active: true, custom: false, ...o });
  const rows = [ci({ id: 'a', name: "צ'יזי קראסט דקה", menuId: 'cc', unit: 70 }), ci({ id: 'b', name: "צ'יזי קראסט עבה", menuId: 'cc', unit: 80 })];
  it('כל וריאציה מקבלת את השורה שלה', () => {
    expect(priceFor(rows, cat, cc, 'with', 'v2')).toMatchObject({ unit: 80, line: { id: 'b' } });
    expect(priceFor(rows, cat, cc, 'with', 'v1')).toMatchObject({ unit: 70, line: { id: 'a' } });
  });
  it('שורה כללית לסוג – כשאין שורה לווריאציה', () => {
    const r2 = [ci({ id: 'g', name: "צ'יזי קראסט", menuId: 'cc', unit: 75 }), rows[1]];
    expect(priceFor(r2, cat, cc, 'with', 'v1').unit).toBe(75);
    expect(priceFor(r2, cat, cc, 'with', 'v2').unit).toBe(80);
  });
});

import { buildTimeline, dayLabel, filterTimeline } from '../src/features/customers/CustomerTimeline';
import type { Activity } from '../src/data/customers';
import type { OrderView } from '../src/data/store';
import { LEGACY as L8, QUOTES as Q8 } from './fixtures/orders';
describe('ציר זמן בתיק לקוח (שלב 8)', () => {
  const now = new Date(2026, 10, 25, 10, 0);
  const ts = (d: Date) => ({ toDate: () => d, seconds: d.getTime() / 1000 }) as unknown as Activity['at'];
  const orders = L8.slice(0, 2).map((o) => ({ ...o, issues: [], health: 'ok' }) as unknown as OrderView);
  const quotes = Q8.slice(0, 1);
  const acts: Activity[] = [
    { id: 'n1', kind: 'call', text: 'שיחה', by: 'u', byName: 'דנה', at: ts(new Date(2026, 10, 24, 9, 30)) },
    { id: 'n2', kind: 'note', text: 'נשמרת עכשיו', by: 'u', byName: 'דנה' },
  ];
  const ev = buildTimeline(orders, quotes, acts, now);
  it('כל המקורות בציר אחד, מהחדש לישן, בלי כפילויות', () => {
    expect(ev).toHaveLength(orders.length + quotes.length + acts.length);
    expect(new Set(ev.map((e) => e.id)).size).toBe(ev.length);
    for (let i = 1; i < ev.length; i++) expect(ev[i - 1].at >= ev[i].at).toBe(true);
  });
  it('רשומה שעוד לא קיבלה חותמת – בראש, היום', () => {
    expect(ev[0].id).toBe('an2');
    expect(ev[0].day).toBe('2026-11-25');
  });
  it('שעה מקומית מהחותמת', () => {
    expect(ev.find((e) => e.id === 'an1')!.at).toBe('2026-11-24T09:30');
  });
  it('מסנן: שיחות והערות / הזמנות / משימות', () => {
    expect(filterTimeline(ev, 'notes').map((e) => e.id).sort()).toEqual(['an1', 'an2']);
    expect(filterTimeline(ev, 'orders').every((e) => e.kind === 'order')).toBe(true);
    expect(filterTimeline(ev, 'tasks')).toHaveLength(0);
    expect(filterTimeline(ev, 'all')).toHaveLength(ev.length);
  });
  it('כותרות יום', () => {
    expect(dayLabel('2026-11-25', '2026-11-25')).toBe('היום');
    expect(dayLabel('2026-11-24', '2026-11-25')).toBe('אתמול');
    expect(dayLabel('2026-11-22', '2026-11-25')).toBe('יום ראשון 22.11.2026');
  });
});
import { sortLines } from '../src/data/quotes';
describe('הצעות – אחר בסוף (7ה)', () => {
  it('שורת "אחר" אחרי הקטגוריות הקבועות', () => {
    const l = (category: string, name: string) => ({ category, name, qty: 1, unitPrice: 1 });
    expect(sortLines([l('אחר', 'מפיות'), l('משקאות', 'קולה'), l('פיצות', 'משפחתית')]).map((x) => x.name)).toEqual(['משפחתית', 'קולה', 'מפיות']);
  });
});
