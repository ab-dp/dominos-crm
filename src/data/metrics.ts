/* מדדים משותפים – מספר אחד לכל מדד. כל מסך שמציג הכנסות, "סופקו בזמן", "החודש" או ספירת חריגים מחשב מכאן,
   כדי שהבורד, הדוחות, סגירת החודש, תיק הלקוח, היעדים והתפריט יציגו בדיוק אותו מספר לאותה תקופה. */
import type { Order } from './types';
import type { Severity } from '../rules-engine/health';
import { addDays, roundMoney, toISODate } from '../lib/format';

/* ---------- בסיס ---------- */
export const isLive = (o: Pick<Order, 'status'>) => o.status !== 'cancelled';
/* סופקה – מלא או חלקי */
export const isDelivered = (o: Pick<Order, 'status'>) => o.status === 'delivered' || o.status === 'partial';

/* ---------- הכנסות: סכום Q, ואם לא הוקלד – הסכום לחיוב. בלי ביטולים ---------- */
export const revenueOf = (o: Pick<Order, 'qAmount' | 'amount'>) => o.qAmount ?? o.amount;
export const revenue = <T extends Pick<Order, 'status' | 'qAmount' | 'amount'>>(list: T[]) =>
  roundMoney(list.filter(isLive).reduce((t, o) => t + revenueOf(o), 0));
export const REVENUE_HINT = 'סכום Q, ואם לא הוקלד – הסכום לחיוב. בלי ביטולים';

/* ---------- סופקו בזמן: הזמנות שסופקו (מלא או חלקי) בלי איחור, מתוך כל ההזמנות שסופקו ---------- */
export type OnTime = { delivered: number; onTime: number; late: number; partial: number; rate: number | null };
export function onTime(list: Pick<Order, 'status' | 'late'>[]): OnTime {
  const done = list.filter(isDelivered);
  const late = done.filter((o) => !!o.late).length;
  return { delivered: done.length, onTime: done.length - late, late, partial: done.filter((o) => o.status === 'partial').length, rate: done.length ? (done.length - late) / done.length : null };
}
/* אחוז שלם – אותו עיגול בכל מסך */
export const pctOf = (rate: number | null) => (rate === null ? null : Math.round(rate * 100));
export const ON_TIME_HINT = 'הזמנות שסופקו (מלא או חלקי) בלי איחור, מתוך כל ההזמנות שסופקו';

/* ---------- תקופות: אותם שמות ואותה משמעות בכל הדוחות ובבורד ---------- */
export type Preset = 'week' | 'lastWeek' | 'month' | 'prevMonth' | 'd30' | 'm3' | 'custom';
export const PRESET_LABEL: Record<Preset, string> = {
  week: 'השבוע', lastWeek: 'שבוע שעבר', month: 'החודש', prevMonth: 'החודש הקודם', d30: '30 ימים', m3: '3 חודשים', custom: 'תאריכים',
};
/* כל דוח והבורד נפתחים על אותה תקופה */
export const DEFAULT_PRESET: Preset = 'month';

/* טווח של תקופה. תקופה שוטפת (השבוע, החודש, 30 ימים, 3 חודשים) נגמרת היום – בלי הזמנות עתידיות.
   "תאריכים" מתחיל מ"החודש" עד שבוחרים. */
export function presetRange(p: Preset, now: Date): { from: string; to: string } {
  const y = now.getFullYear(); const m = now.getMonth();
  const today = toISODate(now);
  if (p === 'week') return { from: toISODate(addDays(now, -now.getDay())), to: today }; // מראשון
  if (p === 'lastWeek') { const sun = addDays(now, -now.getDay() - 7); return { from: toISODate(sun), to: toISODate(addDays(sun, 6)) }; } // ראשון–שבת
  if (p === 'prevMonth') return { from: toISODate(new Date(y, m - 1, 1)), to: toISODate(new Date(y, m, 0)) };
  if (p === 'd30') return { from: toISODate(addDays(now, -29)), to: today };
  if (p === 'm3') return { from: toISODate(new Date(y, m - 2, 1)), to: today };
  return { from: toISODate(new Date(y, m, 1)), to: today };
}
/* ערך מהכתובת (כולל שמות ישנים) לתקופה מתוך הרשימה של המסך */
const OLD: Record<string, Preset> = { prev: 'prevMonth' };
export function readPreset(raw: string | null, allowed: Preset[]): Preset {
  const p = (raw && (OLD[raw] ?? raw)) as Preset | null;
  return p && allowed.includes(p) ? p : DEFAULT_PRESET;
}

/* ---------- חריגים: סופרים הזמנות, לא בעיות. כל הזמנה נספרת פעם אחת – לפי הבעיה החמורה שלה,
   בדיוק כמו הקבוצות במסך החריגים (כך 'דחוף 7' בראש המסך = 7 שורות בקבוצת 'דחוף') ---------- */
const SEV_RANK: Record<Severity, number> = { red: 3, orange: 2, yellow: 1, info: 0 };
export const topSeverity = (issues: { severity: Severity }[]): Severity | null =>
  issues.reduce<Severity | null>((m, i) => (m === null || SEV_RANK[i.severity] > SEV_RANK[m] ? i.severity : m), null);
export const ordersWithSeverity = <T extends { issues: { severity: Severity }[] }>(list: T[], sev: Severity) =>
  list.filter((o) => topSeverity(o.issues) === sev).length;
