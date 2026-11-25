/* סינון הזמנות – הגדרה אחת לכל המסכים (הזמנות, דוח מפורט, ובהמשך סיכום לתפעול).
   כל ממד: מה לוקחים מההזמנה, ואיך מציגים את הערך. הערכים נשמרים בכתובת הדף (אותם מפתחות בכל מסך). */
import { METHOD_LABEL, OUTCOME_LABEL, STAGE_LABEL, outcomeOf, stageOf, type Order, type Outcome, type Stage } from './types';

export type FilterKey = 'cluster' | 'branch' | 'method' | 'handler' | 'outcome' | 'stage';
export type FilterValues = Partial<Record<FilterKey, string>>;

const OUTCOME_ORDER: Outcome[] = ['open', 'ontime', 'late', 'partial', 'cancelled'];
const STAGE_ORDER: Stage[] = ['open', 'in_q', 'delivered', 'partial', 'cancelled'];

export const FILTER_DEFS: Record<FilterKey, { label: string; all: string; get: (o: Order) => string; text: (v: string) => string }> = {
  cluster: { label: 'אשכול', all: 'כל האשכולות', get: (o) => o.cluster, text: (v) => v },
  branch: { label: 'סניף', all: 'כל הסניפים', get: (o) => o.branchName, text: (v) => v },
  method: { label: 'אמצעי תשלום', all: 'כל אמצעי התשלום', get: (o) => o.method, text: (v) => METHOD_LABEL[v] ?? v },
  handler: { label: 'מטפל', all: 'כל המטפלים', get: (o) => o.handler || o.createdBy, text: (v) => v },
  outcome: { label: 'סטטוס אספקה', all: 'כל הסטטוסים', get: (o) => outcomeOf(o), text: (v) => OUTCOME_LABEL[v as Outcome] ?? v },
  stage: { label: 'שלב', all: 'כל השלבים', get: (o) => stageOf(o), text: (v) => STAGE_LABEL[v as Stage] ?? v },
};

/* הזמנה עוברת את הסינון – כל ממד שנבחר חייב להתאים */
export function matchesFilters(o: Order, f: FilterValues): boolean {
  return (Object.keys(f) as FilterKey[]).every((k) => !f[k] || FILTER_DEFS[k].get(o) === f[k]);
}

/* האפשרויות לכל ממד – מתוך ההזמנות שבתצוגה. סניפים מצטמצמים לפי האשכול שנבחר */
export function filterOptions(orders: Order[], keys: FilterKey[], f: FilterValues) {
  return keys.map((key) => {
    const def = FILTER_DEFS[key];
    const pool = key === 'branch' && f.cluster ? orders.filter((o) => o.cluster === f.cluster) : orders;
    let values = [...new Set(pool.map(def.get).filter(Boolean))];
    values = key === 'outcome' ? OUTCOME_ORDER.filter((v) => values.includes(v))
      : key === 'stage' ? STAGE_ORDER.filter((v) => values.includes(v))
      : values.sort((a, b) => def.text(a).localeCompare(def.text(b), 'he'));
    // ערך שנבחר נשאר ברשימה גם אם אין לו הזמנות בתצוגה – כדי שאפשר יהיה לראות ולבטל אותו
    const chosen = f[key];
    if (chosen && !values.includes(chosen)) values.unshift(chosen);
    return { key, label: def.label, all: def.all, options: values.map((v) => ({ value: v, label: def.text(v) })) };
  });
}

/* תיאור קצר של הסינון הפעיל – לכותרת, לאקסל ולהודעות "אין הזמנות" */
export const filtersText = (f: FilterValues) =>
  (Object.keys(FILTER_DEFS) as FilterKey[]).filter((k) => f[k]).map((k) => FILTER_DEFS[k].text(f[k]!)).join(' · ');
