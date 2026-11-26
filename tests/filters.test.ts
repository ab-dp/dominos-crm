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
