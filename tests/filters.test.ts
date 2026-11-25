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
