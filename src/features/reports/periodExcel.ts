/* ייצוא "סיכום תקופה" לאקסל מעוצב, מוכן לשליחה להנהלה: גיליון סיכום (הטבלאות אחת מתחת לשנייה) וגיליון הזמנות.
   אותן טבלאות כמו במסך – מ-periodData; העיצוב משותף לכל הדוחות (lib/xlsx). */
import { fmtDate } from '../../lib/format';
import { downloadXlsx } from '../../lib/xlsx';
import type { STable, Summary } from './periodData';

const RULE = 'לפי תאריך אספקה. סכומים לפי סכום Q (ואם לא הוקלד – הסכום לחיוב), בלי הזמנות שבוטלו.';

export async function exportPeriodExcel(opts: { from: string; to: string; orders: STable; summary: Summary; missingQ: number; fileName: string }) {
  const period = `${fmtDate(opts.from)} – ${fmtDate(opts.to)}`;
  const { kpis, tables } = opts.summary;
  const o = opts.orders;
  const statusCol = o.cols.findIndex((c) => c.label === 'סטטוס');
  await downloadXlsx(opts.fileName, [
    {
      name: 'סיכום', title: 'סיכום תקופה', period, notes: [RULE],
      tables: [
        {
          title: 'מכירות',
          cols: [{ label: 'מדד', kind: 'text', width: 30 }, { label: 'ערך', kind: 'num', width: 14 }, { label: 'הערה', kind: 'text', width: 14 }],
          rows: kpis.map((k) => [k.label, k.value, k.sub ?? null]),
          cellKinds: kpis.map((k) => [undefined, k.kind, undefined]),
        },
        ...tables.map((t) => ({ title: t.title, note: t.note, cols: t.cols, rows: t.rows, total: t.total })),
      ],
    },
    {
      name: 'הזמנות', title: 'סיכום תקופה – הזמנות', period,
      notes: [RULE, [o.note, opts.missingQ ? `${opts.missingQ} הזמנות בלי סכום Q – בסה"כ נלקח במקומן הסכום לחיוב` : ''].filter(Boolean).join(' · ')],
      tables: [{ cols: o.cols, rows: o.rows, total: o.total, main: true, rowStyle: o.rows.map((r) => (r[statusCol] === 'בוטלה' ? 'muted' : undefined)) }],
    },
  ]);
}
