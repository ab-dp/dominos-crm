/* בדיקות "תמונת מצב": שומרות את מה שהמערכת מציגה ומחשבת היום להזמנות קיימות, בכל הצורות הישנות.
   כל שלב בשדרוג מריץ אותן. הבדל שלא תוכנן = עצירה. הבדל מתוכנן (למשל ביטול שלב בציר) מתעדכן במודע
   עם `npx vitest run -u`, ונבדק שורה-שורה לפני שמאשרים. */
import { describe, expect, it } from 'vitest';
import { LEGACY, NOW, QUOTES, SPARSE, TODAY, VIEWS } from './fixtures/orders';
import { QUOTE_STATUS_LABEL, isExpired, linesTotal, needsFollowup, sortLines, staleHours } from '../src/data/quotes';
import {
  STATUS_LABEL, closeLabel, groupItems, itemsText, methodText, outcomeOf, stageOf, typeText, categoryOf, holdDue,
} from '../src/data/types';
import { missingOf, healthOf } from '../src/rules-engine/health';
import { laneOf, nextToType, qProgress, todayLanes } from '../src/features/today/qQueue';
import { todayTaskCounts } from '../src/features/today/todayTasks';
import { amountIn, awaitingCustomer, diffSince, groupByCluster, inSummary, orderSig, pizzasIn, tomorrowRange, weekendRange, type OpsSend } from '../src/data/opsSummary';
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
        awaitingCustomer: awaitingCustomer(o),
        sig: orderSig(o),
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
      unapproved: list.filter(awaitingCustomer).map((o) => o.id),
      pizzas: pizzasIn(list.filter(inSummary)),
      amount: amountIn(list.filter(inSummary)),
    });
    expect({ tomorrow: t, weekend: w, tomorrowView: view(pick(t.from, t.to)), weekendView: view(pick(w.from, w.to)), allOpenView: view(ALL) }).toMatchSnapshot();
  });
});

/* העתק מדויק של החתימה בגרסה 1 (opsSummary.ts) – כמו שנשמרה בסימונים שנשלחו לפני גרסה 2 */
function v1Sig(o: Order) {
  const s = JSON.stringify([o.date, o.time, o.branchId, o.customerName, o.contactName ?? '', o.contactPhone ?? '', o.delivery, o.address ?? '', o.amount, o.instructions ?? '', o.contents ?? '',
    o.items.map((i) => [i.group ?? '', i.name, i.toppings ?? [], i.parts ?? [], i.detail ?? '', i.qty])]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

describe('סיכום לתפעול – מה השתנה מאז השליחה', () => {
  it('חתימה בגרסה 2, גרסה 1 ישנה, הזמנה שהשתנתה, חדשה ושירדה', () => {
    const [a, b, c, d, e] = LEGACY.filter(inSummary);
    const send: OpsSend = { id: 's1', cluster: 'מרכז', from: '2026-11-26', to: '2026-11-26', by: 'u1', byName: 'נציג א',
      snap: { [a.id]: orderSig(a), [b.id]: orderSig({ ...b, time: '09:00' }), [c.id]: 'legacyv1hash', [d.id]: v1Sig(d), '9999': orderSig(a) } };
    const r = diffSince(send, [a, b, c, d, e]);
    // סימון ישן בגרסה 1 של הזמנה שלא השתנתה – אסור שיסומן "עודכן"
    expect(r.mark.has(d.id)).toBe(false);
    expect({ mark: [...r.mark.entries()], removed: r.removed }).toMatchSnapshot();
    expect(diffSince(undefined, [a])).toMatchSnapshot();
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
