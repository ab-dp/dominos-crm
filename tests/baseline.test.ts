/* בדיקות "תמונת מצב": שומרות את מה שהמערכת מציגה ומחשבת היום להזמנות קיימות, בכל הצורות הישנות.
   כל שלב בשדרוג מריץ אותן. הבדל שלא תוכנן = עצירה. הבדל מתוכנן (למשל ביטול שלב בציר) מתעדכן במודע
   עם `npx vitest run -u`, ונבדק שורה-שורה לפני שמאשרים. */
import { describe, expect, it } from 'vitest';
import { LEGACY, NOW, QUOTES, SPARSE, TODAY, VIEWS } from './fixtures/orders';
import { QUOTE_STATUS_LABEL, isExpired, linesTotal, needsFollowup, sortLines, staleHours } from '../src/data/quotes';
import {
  STATUS_LABEL, closeLabel, groupItems, itemsText, methodText, outcomeOf, stageOf, typeText, categoryOf, holdDue, needsOpsUpdate, opsChangeFor, opsReminderOnSave, orderAfterSave, mergeChangedAfterQ,
} from '../src/data/types';
import { fromDoc } from '../src/data/orders';
import { callRefMatch, channelLabel, channelLegacyText } from '../src/data/channels';
import { missingOf, healthOf } from '../src/rules-engine/health';
import { laneOf, nextToType, qProgress, todayLanes } from '../src/features/today/qQueue';
import { todayTaskCounts } from '../src/features/today/todayTasks';
import { amountIn, groupByCluster, inSummary, pizzasIn, tomorrowRange, weekendRange } from '../src/data/opsSummary';
import { summarize } from '../src/data/months';
import { REPORTS } from '../src/features/reports/defs';
import { ordersTable, summary as periodSummary, statusText } from '../src/features/reports/periodData';
import { byDay, collections, horizon, rankings, sales, service } from '../src/features/board/boardData';
import { cleanAmount, fmtMoney } from '../src/lib/format';
import { registerText } from '../src/features/orders/OrderRegister';
import type { Order } from '../src/data/types';

const ALL: Order[] = [...LEGACY, ...SPARSE];

/* בתוצאות של דוחות ובורד יש רשימות הזמנות – בתמונת המצב מספיק מספר ההזמנה */
function slim(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(slim);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.id === 'number' && 'customerName' in o && 'items' in o) return `#${o.id}`;
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, slim(x)]));
  }
  return v;
}

describe('כל הזמנה לחוד', () => {
  for (const o of VIEWS) {
    it(`הזמנה ${o.id}`, () => {
      expect({
        stage: stageOf(o),
        status: STATUS_LABEL[o.status],
        outcome: outcomeOf(o),
        close: closeLabel(o),
        method: methodText(o),
        categories: o.items.map(categoryOf),
        itemsText: itemsText(o.items),
        groups: groupItems(o.items).map((c) => ({ category: c.category, qty: c.qty, types: c.types.map(typeText) })),
        register: registerText(o),
        missing: missingOf(o),
        issues: o.issues.map((i) => ({ rule: i.rule, severity: i.severity, label: i.label, action: i.action, actionLabel: i.actionLabel })),
        health: healthOf(o.issues),
        lane: laneOf(o, NOW),
        holdDue: holdDue(o.hold, NOW),
        inSummary: inSummary(o),
        statusText: statusText(o),
      }).toMatchSnapshot();
    });
  }
});

describe('מסך היום', () => {
  it('תור Q', () => {
    const lanes = todayLanes(VIEWS, TODAY, NOW);
    expect(Object.fromEntries(Object.entries(lanes).map(([k, v]) => [k, v.map((o) => o.id)]))).toMatchSnapshot();
    expect(qProgress(lanes)).toMatchSnapshot();
    expect(nextToType(VIEWS, TODAY, NOW)?.id ?? null).toMatchSnapshot();
  });
  it('מונים של משימות', () => {
    expect(todayTaskCounts(VIEWS, NOW, { dueTasks: 2, quoteFollowups: 1, pendingUsers: 1 })).toMatchSnapshot();
  });
});

describe('סיכום לתפעול', () => {
  it('לפי אשכול וסניף, מחר וסופ"ש', () => {
    const t = tomorrowRange(NOW);
    const w = weekendRange(NOW);
    const pick = (from: string, to: string) => ALL.filter((o) => o.date >= from && o.date <= to);
    const view = (list: Order[]) => ({
      groups: slim(groupByCluster(list.filter(inSummary))),
      pizzas: pizzasIn(list.filter(inSummary)),
      amount: amountIn(list.filter(inSummary)),
    });
    expect({ tomorrow: t, weekend: w, tomorrowView: view(pick(t.from, t.to)), weekendView: view(pick(w.from, w.to)), allOpenView: view(ALL) }).toMatchSnapshot();
  });
});

/* "לעדכן בתפעול": הזמנה של היום/מחר שנוצרה או שונתה בפרט לתפעול אחרי 18:00 ביום שלפני */
describe('תזכורת לעדכן בתפעול', () => {
  const base = { status: 'approved' as const, date: '2026-11-26' };
  it('needsOpsUpdate – לפי שעת הסף ביום שלפני המועד', () => {
    expect(needsOpsUpdate({ ...base, opsChangeAt: new Date(2026, 10, 25, 17, 59).toISOString() }, NOW, '18:00')).toBe(false);
    expect(needsOpsUpdate({ ...base, opsChangeAt: new Date(2026, 10, 25, 18, 0).toISOString() }, NOW, '18:00')).toBe(true);
    // סף אחר מהספים
    expect(needsOpsUpdate({ ...base, opsChangeAt: new Date(2026, 10, 25, 17, 0).toISOString() }, NOW, '16:30')).toBe(true);
    // הזמנה להיום: הסף הוא אתמול בערב
    expect(needsOpsUpdate({ ...base, date: '2026-11-25', opsChangeAt: new Date(2026, 10, 24, 19, 0).toISOString() }, NOW, '18:00')).toBe(true);
    expect(needsOpsUpdate({ ...base, date: '2026-11-25', opsChangeAt: new Date(2026, 10, 24, 12, 0).toISOString() }, NOW, '18:00')).toBe(false);
    // רק היום ומחר
    expect(needsOpsUpdate({ ...base, date: '2026-11-27', opsChangeAt: new Date(2026, 10, 26, 19, 0).toISOString() }, NOW, '18:00')).toBe(false);
    expect(needsOpsUpdate({ ...base, date: '2026-11-24', opsChangeAt: new Date(2026, 10, 24, 9, 0).toISOString() }, NOW, '18:00')).toBe(false);
    // סגורה / מבוטלת / בלי שדה (הזמנה ישנה) – אף פעם
    expect(needsOpsUpdate({ ...base, status: 'cancelled', opsChangeAt: new Date(2026, 10, 25, 19, 0).toISOString() }, NOW, '18:00')).toBe(false);
    expect(needsOpsUpdate({ ...base, status: 'delivered', opsChangeAt: new Date(2026, 10, 25, 19, 0).toISOString() }, NOW, '18:00')).toBe(false);
    expect(needsOpsUpdate(base, NOW, '18:00')).toBe(false);
    // ערך ישן שמתפרש כפתוחה
    expect(needsOpsUpdate({ ...base, status: 'pending_customer', opsChangeAt: new Date(2026, 10, 25, 19, 0).toISOString() }, NOW, '18:00')).toBe(true);
  });
  it('opsChangeFor – רק שינוי בפרט שהסניף צריך לדעת', () => {
    const o = LEGACY[0];
    const at = '2026-11-25T08:00:00.000Z';
    expect(opsChangeFor(o, { time: '13:00' }, at)).toBe(at);
    expect(opsChangeFor(o, { date: '2026-11-27' }, at)).toBe(at);
    expect(opsChangeFor(o, { branchId: 'b2' }, at)).toBe(at);
    expect(opsChangeFor(o, { delivery: 'pickup' }, at)).toBe(at);
    expect(opsChangeFor(o, { address: 'אחרת 2' }, at)).toBe(at);
    expect(opsChangeFor(o, { items: [...o.items, { name: 'שתייה', qty: 1, unitPrice: 10 }] }, at)).toBe(at);
    // אותו ערך – לא שינוי
    expect(opsChangeFor(o, { time: o.time, items: o.items }, at)).toBeUndefined();
    // שדות שלא נוגעים לסניף: השהיה, Q, תשלום, הערות, סכום
    expect(opsChangeFor(o, { qNumber: 'cs1', qAmount: 100, payment: 'paid', instructions: 'x', amount: 1, hold: undefined }, at)).toBeUndefined();
    // מחיקת כתובת היא שינוי
    expect(opsChangeFor(o, { address: undefined }, at)).toBe(at);
    // opsChangeAt מפורש (ביטול פעולה) גובר – לא מחשבים
    expect(opsChangeFor(o, { time: '13:00', opsChangeAt: undefined }, at)).toBeUndefined();
  });
  it('ביטול פעולה מחזיר את opsChangeAt הקודם – בלי תגית שנשארת', () => {
    const before = { ...LEGACY[0], date: '2026-11-26', opsChangeAt: '2026-11-20T08:00:00.000Z' };
    const late = new Date(2026, 10, 25, 19, 0);
    const changed = orderAfterSave(before, { time: '14:00' }, late.toISOString());
    expect(needsOpsUpdate(changed, late, '18:00')).toBe(true);
    // ה"בטל" שולח את השעה הקודמת ואת opsChangeAt הקודם
    const undone = orderAfterSave(changed, { time: before.time, opsChangeAt: before.opsChangeAt }, late.toISOString());
    expect(undone.opsChangeAt).toBe(before.opsChangeAt);
    expect(needsOpsUpdate(undone, late, '18:00')).toBe(false);
  });
  it('opsReminderOnSave – גם כשהזמנה יוצאת מסיכום שכבר נשלח', () => {
    const late = new Date(2026, 10, 25, 19, 0); // אחרי 18:00, ההזמנה למחר
    const early = new Date(2026, 10, 25, 10, 0);
    const before = { ...LEGACY[0], date: '2026-11-26', opsChangeAt: '2026-11-20T08:00:00.000Z' };
    const save = (patch: Partial<Order>, now: Date) => opsReminderOnSave(before, orderAfterSave(before, patch, now.toISOString()), now, '18:00');
    expect(save({ time: '14:00' }, late)).toBe(true);           // שינוי שעה אחרי הסף
    expect(save({ time: '14:00' }, early)).toBe(false);         // לפני הסף – עוד ייכנס לסיכום
    expect(save({ date: '2026-12-10' }, late)).toBe(true);      // הוזזה הלאה – יוצאת מהסיכום
    expect(save({ date: '2026-12-10' }, early)).toBe(false);
    expect(save({ status: 'cancelled' }, late)).toBe(true);     // בוטלה אחרי הסף
    expect(save({ status: 'cancelled' }, early)).toBe(false);
    expect(save({ instructions: 'x' }, late)).toBe(false);      // שינוי שלא נוגע לסניף
    expect(save({ status: 'delivered' }, late)).toBe(false);
    // הזמנה רחוקה שבוטלה – לא הייתה בסיכום
    const far = { ...before, date: '2026-12-10' };
    expect(opsReminderOnSave(far, { ...far, status: 'cancelled' }, late, '18:00')).toBe(false);
  });
  it('mergeChangedAfterQ – איחוד שדות, הערכים "לפני" המוקדמים גוברים', () => {
    const mine = { at: 'b', by: 'נציג ב', fields: ['time'], before: { time: '12:00' } };
    expect(mergeChangedAfterQ(undefined, mine)).toEqual(mine);
    const merged = mergeChangedAfterQ({ at: 'a', by: 'נציג א', fields: ['date', 'time'], before: { date: '2026-11-25', time: '11:00' } }, mine);
    expect(merged.fields).toEqual(['date', 'time']);
    expect(merged.before).toEqual({ time: '11:00', date: '2026-11-25' });
    expect(merged.by).toBe('נציג ב');
  });
});

describe('ערוץ ומספר קריאה', () => {
  const ch = [{ id: 'a', label: 'מכירות', active: true }, { id: 'b', label: 'well-b', active: false }];
  it('channelLabel – פעיל, מושבת, טקסט ישן, ריק', () => {
    expect(channelLabel({ channelId: 'a', channel: 'שם ישן' }, ch)).toBe('מכירות'); // השם הנוכחי ברשימה, לא מה שנשמר
    expect(channelLabel({ channelId: 'b', channel: 'well-b' }, ch)).toBe('well-b'); // מושבת – עדיין מוצג
    expect(channelLabel({ channelId: 'gone', channel: 'מוקד' }, ch)).toBe('מוקד'); // פריט שלא ברשימה – השם שנשמר
    expect(channelLabel({ channel: 'וואטסאפ 4512' }, ch)).toBe('לא מסווג');
    expect(channelLabel({ channel: '  ' }, ch)).toBe('');
    expect(channelLabel({ channel: '' }, ch)).toBe('');
  });
  it('missingOf – טקסט ערוץ ישן לא חסר; בלי ערוץ בכלל – חסר', () => {
    const o = LEGACY[0];
    expect(missingOf({ ...o, channelId: undefined, channel: 'וואטסאפ 4512' })).not.toContain('ערוץ');
    expect(missingOf({ ...o, channelId: 'sales', channel: '' })).not.toContain('ערוץ');
    expect(missingOf({ ...o, channelId: undefined, channel: '' })).toContain('ערוץ');
  });
  it('channelLegacyText – הטקסט הישן לייצוא לא הולך לאיבוד', () => {
    expect(channelLegacyText({ channel: 'וואטסאפ 4512' })).toBe('וואטסאפ 4512');
    expect(channelLegacyText({ channelId: 'a', channel: 'מכירות', channelLegacy: 'וואטסאפ 4512' })).toBe('וואטסאפ 4512');
    expect(channelLegacyText({ channelId: 'a', channel: 'מכירות' })).toBe('');
    expect(channelLegacyText({ channel: '' })).toBe('');
  });
  it('callRefMatch – חיפוש לפי מספר קריאה', () => {
    expect(callRefMatch({ callRef: 'A-77120' }, '7712')).toBe(true);
    expect(callRefMatch({ callRef: 'A-77120' }, 'a-77')).toBe(true);
    expect(callRefMatch({}, '77')).toBe(false);
    expect(callRefMatch({ callRef: '77' }, '')).toBe(false);
  });
});

describe('ערכי סטטוס ישנים', () => {
  it('fromDoc מפרש new / pending_customer / חסר כפתוחה (approved), ושאר הערכים כמו שהם', () => {
    const d = { customerId: 'c', customerName: 'x', date: '2026-11-26', time: '12:00', amount: 1 };
    expect(fromDoc('1', { ...d, status: 'new' }).status).toBe('approved');
    expect(fromDoc('1', { ...d, status: 'pending_customer' }).status).toBe('approved');
    expect(fromDoc('1', d).status).toBe('approved');
    expect(fromDoc('1', { ...d, status: 'approved' }).status).toBe('approved');
    expect(fromDoc('1', { ...d, status: 'delivered' }).status).toBe('delivered');
    expect(fromDoc('1', { ...d, status: 'partial' }).status).toBe('partial');
    expect(fromDoc('1', { ...d, status: 'cancelled' }).status).toBe('cancelled');
    expect(STATUS_LABEL.new).toBe('פתוחה');
    expect(STATUS_LABEL.pending_customer).toBe('פתוחה');
    expect(STATUS_LABEL.approved).toBe('פתוחה');
  });
});

describe('הצעות מחיר', () => {
  for (const q of QUOTES) {
    it(`הצעה ${q.id}`, () => {
      expect({ status: QUOTE_STATUS_LABEL[q.status], expired: isExpired(q, TODAY), stale: staleHours(q, NOW), followup: needsFollowup(q, NOW, 24), total: linesTotal(q.lines), sorted: sortLines(q.lines).map((l) => l.name) }).toMatchSnapshot();
    });
  }
});

describe('דוחות', () => {
  for (const def of REPORTS) {
    it(`דוח ${def.id}`, () => {
      expect(slim(def.compute(ALL))).toMatchSnapshot();
    });
  }
  it('סיכום תקופה', () => {
    expect(slim(ordersTable(ALL))).toMatchSnapshot();
    expect(slim(periodSummary(ALL, '2026-11-01', '2026-11-30'))).toMatchSnapshot();
  });
  it('סגירת חודש', () => {
    expect(slim(summarize(ALL.filter((o) => o.date.startsWith('2026-11'))))).toMatchSnapshot();
    expect(slim(summarize(ALL.filter((o) => o.date.startsWith('2026-10'))))).toMatchSnapshot();
  });
});

describe('בורד', () => {
  const cur = { from: '2026-11-01', to: '2026-11-30' };
  const prev = { from: '2026-10-01', to: '2026-10-31' };
  it('מדדים', () => {
    expect(slim({
      horizon: horizon(VIEWS, NOW),
      sales: sales(VIEWS, cur),
      byDay: byDay(VIEWS, cur, prev),
      service: service(VIEWS, cur, NOW),
      collections: collections(VIEWS, NOW),
      rankings: rankings(VIEWS, cur),
    })).toMatchSnapshot();
  });
});

describe('סכומים', () => {
  it('fmtMoney ו-cleanAmount', () => {
    expect([55, 54.9, 1250, 0, 1234.5].map(fmtMoney)).toMatchSnapshot();
    expect(['54,90', '1,250', '₪ 99', '12.5', ''].map(cleanAmount)).toMatchSnapshot();
  });
});
