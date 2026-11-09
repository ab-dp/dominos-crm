/* ייצוא דוח רגיל (דוח מפורט, לפי לקוח, לפי סניף ואשכול, לפי עובד) לאקסל מעוצב – אותו תוכן כמו במסך:
   המדדים (אם יש), הטבלה ושורת הסה"כ. העיצוב משותף לכל הדוחות (lib/xlsx). */
import type { XCol, XKind, XSheet, XValue } from '../../lib/xlsx';
import { OUTCOME_LABEL } from '../../data/types';
import type { Col, ReportDef, ReportResult } from './defs';

/* רוחב עמודה לפי סוג התוכן; טקסט ארוך (פריטים, הערות, סיבה) רחב וגולש */
const WIDE: Record<string, number> = { items: 44, notes: 34, reason: 28, customer: 26, name: 26, branch: 22, cluster: 16, handler: 16 };
function width(c: Col) {
  if (WIDE[c.key]) return WIDE[c.key];
  if (c.kind === 'money') return 13;
  if (c.kind === 'pct') return 11;
  if (c.kind === 'num') return c.label.length > 8 ? 13 : 10;
  return Math.max(11, c.label.length + 4);
}
const kindOf = (c: Col): XKind => (c.kind === 'money' ? 'money' : c.kind === 'num' ? 'num' : c.kind === 'pct' ? 'pct' : c.kind === 'date' ? 'date' : 'text');
/* אחוזים בדוח שמורים כ-30.6 – באקסל כשבר (0.306), עם ספרה אחרי הנקודה רק כשצריך */
const cell = (c: Col, v: string | number | undefined): XValue => (c.kind === 'pct' && typeof v === 'number' ? v / 100 : v);

/* "דוח לפי לקוח", אבל "דוח מפורט" ולא "דוח דוח מפורט" */
export const reportName = (def: ReportDef) => (def.title.startsWith('דוח') ? def.title : `דוח ${def.title}`);

export function reportSheet(def: ReportDef, res: ReportResult, period: string, filterText: string): XSheet {
  const cols: XCol[] = res.cols.map((c) => {
    const decimals = c.kind === 'pct' && [...res.rows.map((r) => r.cells[c.key]), res.totals?.[c.key]].some((v) => typeof v === 'number' && !Number.isInteger(v));
    return { label: c.label, kind: kindOf(c), width: width(c), ...(decimals ? { fmt: '0.0%' } : {}) };
  });
  const outcomeKey = res.cols.find((c) => c.key === 'outcome')?.key;
  return {
    name: def.title,
    title: reportName(def),
    period,
    notes: ['לפי תאריך אספקה וסכום Q, בלי הזמנות שבוטלו.', filterText],
    tables: [
      /* המדדים בשורה אחת, כמו במסך: שם המדד בכותרת, מתחתיו הערך ומתחתיו ההערה */
      ...(res.kpis?.length ? [{
        title: 'במבט',
        cols: res.kpis.map((k) => ({ label: k.label, kind: (k.money ? 'money' : 'num') as XKind, width: 0 })),
        rows: [res.kpis.map((k) => k.value), ...(res.kpis.some((k) => k.sub) ? [res.kpis.map((k) => k.sub ?? null)] : [])],
        cellKinds: [[], res.kpis.map(() => 'text' as XKind)],
      }] : []),
      {
        title: res.kpis?.length ? 'הזמנות' : undefined,
        cols,
        rows: res.rows.map((r) => res.cols.map((c) => cell(c, r.cells[c.key]))),
        total: res.totals ? res.cols.map((c) => cell(c, res.totals![c.key])) : undefined,
        rowStyle: outcomeKey ? res.rows.map((r) => (r.cells[outcomeKey] === OUTCOME_LABEL.cancelled ? 'muted' : undefined)) : undefined,
        main: true,
      },
    ],
  };
}
