/* ייצוא "סיכום תקופה" לקובץ אקסל מעוצב (xlsx), מוכן לשליחה להנהלה.
   ExcelJS נטען רק בלחיצה על "ייצוא" (צ'אנק נפרד), כדי לא להאט את המערכת. אותן טבלאות כמו במסך – מ-periodData. */
import type { Cell as XCell, Workbook, Worksheet } from 'exceljs';
import { fmtDate } from '../../lib/format';
import type { Cell, Kind, Kpi, STable, Summary } from './periodData';

const C = { navy: 'FF0B2340', brand: 'FF006491', brand50: 'FFE8F2F7', zebra: 'FFF5F7F9', line: 'FFE6EAEF', gray: 'FF546272', ink: 'FF0F1B2A', white: 'FFFFFFFF' };
const FONT = 'Arial';
const FMT: Partial<Record<Kind, string>> = { money: '"₪"#,##0', num: '#,##0', pct: '0%', date: 'dd.mm.yyyy', id: '0' };
const thin = (argb: string) => ({ style: 'thin' as const, color: { argb } });

/* תאריך בלי שעון: Date.UTC, כי ExcelJS כותב תאריכים לפי UTC */
const toDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
function put(cell: XCell, v: Cell, kind: Kind) {
  if (v === null || v === '') { cell.value = null; return; }
  if (kind === 'date' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) cell.value = toDate(v);
  else if (kind === 'code') cell.value = String(v);
  else cell.value = v;
  if (typeof v === 'number' || kind === 'date') cell.numFmt = FMT[kind] ?? '#,##0';
  cell.alignment = { horizontal: kind === 'text' || kind === 'code' ? 'right' : 'center', vertical: 'middle', readingOrder: 'rtl' };
}

/* כותרת הגיליון: שם הדוח, התקופה ומתי הופק, והכלל של הסכומים */
function head(ws: Worksheet, width: number, title: string, period: string, made: string) {
  ws.mergeCells(1, 1, 1, width);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { name: FONT, size: 16, bold: true, color: { argb: C.white } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } };
  t.alignment = { horizontal: 'right', vertical: 'middle', indent: 1, readingOrder: 'rtl' };
  ws.getRow(1).height = 32;
  ws.mergeCells(2, 1, 2, width);
  const s = ws.getCell(2, 1);
  s.value = `תקופה: ${period}   ·   הופק: ${made}`;
  s.font = { name: FONT, size: 11, bold: true, color: { argb: C.ink } };
  s.alignment = { horizontal: 'right', vertical: 'middle', indent: 1, readingOrder: 'rtl' };
  ws.getRow(2).height = 22;
  ws.mergeCells(3, 1, 3, width);
  const r = ws.getCell(3, 1);
  r.value = 'לפי תאריך אספקה. סכומים לפי סכום Q (ואם לא הוקלד – הסכום לחיוב), בלי הזמנות שבוטלו.';
  r.font = { name: FONT, size: 10, italic: true, color: { argb: C.gray } };
  r.alignment = { horizontal: 'right', indent: 1, readingOrder: 'rtl' };
  return 5;
}

function headerRow(ws: Worksheet, row: number, labels: string[]) {
  const r = ws.getRow(row);
  labels.forEach((l, i) => {
    const c = r.getCell(i + 1);
    c.value = l;
    c.font = { name: FONT, size: 11, bold: true, color: { argb: C.white } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.brand } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, readingOrder: 'rtl' };
    c.border = { top: thin(C.brand), bottom: thin(C.brand), left: thin(C.brand), right: thin(C.brand) };
  });
  r.height = 24;
}

function dataRow(ws: Worksheet, row: number, cells: Cell[], kinds: Kind[], zebra: boolean, muted = false) {
  const r = ws.getRow(row);
  cells.forEach((v, i) => {
    const c = r.getCell(i + 1);
    put(c, v, kinds[i]);
    c.font = { name: FONT, size: 11, italic: muted, color: { argb: muted ? C.gray : C.ink } };
    if (zebra) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.zebra } };
    c.border = { bottom: thin(C.line), left: thin(C.line), right: thin(C.line) };
  });
  r.height = 20;
}

function totalRow(ws: Worksheet, row: number, cells: Cell[], kinds: Kind[]) {
  const r = ws.getRow(row);
  cells.forEach((v, i) => {
    const c = r.getCell(i + 1);
    put(c, v, i === 0 ? 'text' : kinds[i]);
    // בשורת הסה"כ טקסט חופשי ("55 הזמנות") ולא תאריך
    if (typeof v === 'string' && kinds[i] === 'date') c.value = v;
    c.font = { name: FONT, size: 11, bold: true, color: { argb: C.ink } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.brand50 } };
    c.border = { top: { style: 'medium', color: { argb: C.brand } }, bottom: thin(C.brand), left: thin(C.line), right: thin(C.line) };
  });
  r.height = 22;
}

function sectionTitle(ws: Worksheet, row: number, width: number, title: string, note?: string) {
  ws.mergeCells(row, 1, row, width);
  const c = ws.getCell(row, 1);
  c.value = title;
  c.font = { name: FONT, size: 13, bold: true, color: { argb: C.brand } };
  c.alignment = { horizontal: 'right', vertical: 'bottom', readingOrder: 'rtl' };
  ws.getRow(row).height = 24;
  if (!note) return row + 1;
  ws.mergeCells(row + 1, 1, row + 1, width);
  const n = ws.getCell(row + 1, 1);
  n.value = note;
  n.font = { name: FONT, size: 10, color: { argb: C.gray } };
  n.alignment = { horizontal: 'right', readingOrder: 'rtl' };
  return row + 2;
}

/* טבלה אחת בגיליון הסיכום: כותרת, הערה, שורת עמודות, נתונים וסה"כ. מחזיר את השורה הפנויה הבאה */
function block(ws: Worksheet, row: number, width: number, t: STable) {
  let r = sectionTitle(ws, row, width, t.title, t.note);
  if (!t.rows.length) return r + 1;
  const kinds = t.cols.map((c) => c.kind);
  headerRow(ws, r, t.cols.map((c) => c.label)); r += 1;
  t.rows.forEach((cells, i) => { dataRow(ws, r, cells, kinds, i % 2 === 1); r += 1; });
  if (t.total) { totalRow(ws, r, t.total, kinds); r += 1; }
  return r + 1;
}

function kpiTable(kpis: Kpi[]): STable {
  return {
    id: 'kpis', title: 'מכירות',
    cols: [{ label: 'מדד', kind: 'text', width: 30 }, { label: 'ערך', kind: 'num', width: 14 }, { label: 'הערה', kind: 'text', width: 14 }],
    rows: kpis.map((k) => [k.label, k.value, k.sub ?? null]),
  };
}

function print(ws: Worksheet, titleRow?: number) {
  ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }, ...(titleRow ? { printTitlesRow: `${titleRow}:${titleRow}` } : {}) };
  ws.headerFooter = { oddFooter: '&Cעמוד &P מתוך &N' };
}

export async function exportPeriodExcel(opts: { from: string; to: string; orders: STable; summary: Summary; missingQ: number; fileName: string }) {
  const mod = await import('exceljs');
  const ExcelJS = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
  const wb: Workbook = new ExcelJS.Workbook();
  wb.creator = "Domino's CRM";
  wb.created = new Date();
  const now = new Date();
  const made = `${fmtDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const period = `${fmtDate(opts.from)} – ${fmtDate(opts.to)}`;

  /* גיליון 1: סיכום – הטבלאות אחת מתחת לשנייה */
  const tables = [kpiTable(opts.summary.kpis), ...opts.summary.tables];
  const width = Math.max(...tables.map((t) => t.cols.length));
  const ws = wb.addWorksheet('סיכום', { views: [{ rightToLeft: true, showGridLines: false }], properties: { defaultRowHeight: 18 } });
  ws.columns = Array.from({ length: width }, (_, i) => ({ width: Math.max(...tables.map((t) => t.cols[i]?.width ?? 0), 12) }));
  let row = head(ws, width, 'סיכום תקופה', period, made);
  // המדדים: עיצוב לפי סוג הערך של כל שורה
  const kt = tables[0];
  row = sectionTitle(ws, row, width, kt.title);
  headerRow(ws, row, kt.cols.map((c) => c.label)); row += 1;
  opts.summary.kpis.forEach((k, i) => { dataRow(ws, row, [k.label, k.value, k.sub ?? null], ['text', k.kind, 'text'], i % 2 === 1); ws.getCell(row, 2).font = { name: FONT, size: 12, bold: true, color: { argb: C.ink } }; row += 1; });
  row += 1;
  opts.summary.tables.forEach((t) => { row = block(ws, row, width, t); });
  print(ws);

  /* גיליון 2: כל ההזמנות, עם שורת כותרת קבועה וסינון */
  const o = opts.orders;
  const ow = wb.addWorksheet('הזמנות', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 5, showGridLines: false }] });
  ow.columns = o.cols.map((c) => ({ width: c.width }));
  head(ow, o.cols.length, 'סיכום תקופה – הזמנות', period, made);
  const notes = [o.note, opts.missingQ ? `${opts.missingQ} הזמנות בלי סכום Q – בסה"כ נלקח במקומן הסכום לחיוב` : ''].filter(Boolean).join(' · ');
  if (notes) {
    ow.mergeCells(4, 1, 4, o.cols.length);
    const n = ow.getCell(4, 1);
    n.value = notes;
    n.font = { name: FONT, size: 10, color: { argb: C.gray } };
    n.alignment = { horizontal: 'right', indent: 1, readingOrder: 'rtl' };
  }
  const kinds = o.cols.map((c) => c.kind);
  headerRow(ow, 5, o.cols.map((c) => c.label));
  const statusCol = o.cols.findIndex((c) => c.label === 'סטטוס');
  o.rows.forEach((cells, i) => dataRow(ow, 6 + i, cells, kinds, i % 2 === 1, cells[statusCol] === 'בוטלה'));
  if (o.total) totalRow(ow, 6 + o.rows.length, o.total, kinds);
  ow.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + o.rows.length, column: o.cols.length } };
  print(ow, 5);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = opts.fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
