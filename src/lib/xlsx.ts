/* ייצוא לאקסל מעוצב (xlsx) – משותף לכל הדוחות. גיליון = כותרת (שם, תקופה, מתי הופק, כללים) וטבלאות אחת מתחת לשנייה:
   כותרת לכל טבלה, שורת עמודות כחולה, שורות לסירוגין, שורת סה"כ מודגשת. מימין לשמאל, ₪, תאריכים אמיתיים, מוכן להדפסה.
   ExcelJS נטען רק כשמייצאים (צ'אנק xlsx נפרד), כדי לא להאט את המערכת. */
import type { Cell as XCell, Workbook, Worksheet } from 'exceljs';

export type XKind = 'text' | 'num' | 'money' | 'pct' | 'date' | 'code' | 'id';
export type XValue = string | number | null | undefined;
export type XCol = { label: string; kind: XKind; width: number; fmt?: string };
/* rowStyle: 'muted' – שורה אפורה (בוטלה); 'group' – שורת כותרת של קבוצה */
export type XTable = { title?: string; note?: string; cols: XCol[]; rows: XValue[][]; total?: XValue[]; rowStyle?: ('muted' | 'group' | undefined)[]; main?: boolean;
  /* סוג ערך לתא מסוים, כשהוא שונה מהעמודה (טבלת מדדים: ₪ / אחוז / מספר באותה עמודה) */
  cellKinds?: (XKind | undefined)[][] };
export type XSheet = { name: string; title: string; period?: string; notes?: string[]; tables: XTable[] };

const C = { navy: 'FF0B2340', brand: 'FF006491', brand50: 'FFE8F2F7', zebra: 'FFF5F7F9', group: 'FFE6EAEF', line: 'FFE6EAEF', gray: 'FF546272', ink: 'FF0F1B2A', white: 'FFFFFFFF' };
const FONT = 'Arial';
const FMT: Record<XKind, string | undefined> = { money: '"₪"#,##0', num: '#,##0', pct: '0%', date: 'dd.mm.yyyy', id: '0', text: undefined, code: undefined };
const thin = (argb: string) => ({ style: 'thin' as const, color: { argb } });
const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });

/* תאריך בלי שעון: Date.UTC, כי ExcelJS כותב תאריכים לפי UTC. מקבל YYYY-MM-DD או DD.MM.YYYY */
function asDate(v: string): Date | null {
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v);
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])) : null;
}

function put(cell: XCell, v: XValue, col: XCol) {
  if (v === null || v === undefined || v === '') { cell.value = null; return; }
  const d = col.kind === 'date' && typeof v === 'string' ? asDate(v) : null;
  if (d) { cell.value = d; cell.numFmt = col.fmt ?? FMT.date!; }
  else if (col.kind === 'code' || col.kind === 'text') cell.value = String(v);
  else if (typeof v === 'number') { cell.value = v; cell.numFmt = col.fmt ?? FMT[col.kind] ?? '#,##0'; }
  else cell.value = v;
  const center = col.kind !== 'text' && col.kind !== 'code';
  cell.alignment = { horizontal: center ? 'center' : 'right', vertical: 'middle', readingOrder: 'rtl', wrapText: col.width >= 30 };
}

function merged(ws: Worksheet, row: number, width: number, value: string, font: Partial<XCell['font']>, height?: number, bg?: string) {
  ws.mergeCells(row, 1, row, width);
  const c = ws.getCell(row, 1);
  c.value = value;
  c.font = { name: FONT, ...font };
  if (bg) c.fill = fill(bg);
  c.alignment = { horizontal: 'right', vertical: 'middle', indent: 1, readingOrder: 'rtl', wrapText: true };
  if (height) ws.getRow(row).height = height;
}

function headerRow(ws: Worksheet, row: number, cols: XCol[]) {
  const r = ws.getRow(row);
  cols.forEach((col, i) => {
    const c = r.getCell(i + 1);
    c.value = col.label;
    c.font = { name: FONT, size: 11, bold: true, color: { argb: C.white } };
    c.fill = fill(C.brand);
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, readingOrder: 'rtl' };
    c.border = { top: thin(C.brand), bottom: thin(C.brand), left: thin(C.brand), right: thin(C.brand) };
  });
  r.height = 26;
}

function bodyRow(ws: Worksheet, row: number, cells: XValue[], cols: XCol[], i: number, style?: 'muted' | 'group', kinds?: (XKind | undefined)[]) {
  const r = ws.getRow(row);
  cols.forEach((col, j) => {
    const c = r.getCell(j + 1);
    put(c, cells[j], kinds?.[j] ? { ...col, kind: kinds[j]! } : col);
    c.font = { name: FONT, size: 11, bold: style === 'group', italic: style === 'muted', color: { argb: style === 'muted' ? C.gray : C.ink } };
    if (style === 'group') c.fill = fill(C.group);
    else if (i % 2 === 1) c.fill = fill(C.zebra);
    c.border = { bottom: thin(C.line), left: thin(C.line), right: thin(C.line) };
  });
  r.height = 20;
}

function totalRow(ws: Worksheet, row: number, cells: XValue[], cols: XCol[]) {
  const r = ws.getRow(row);
  cols.forEach((col, j) => {
    const c = r.getCell(j + 1);
    const v = cells[j];
    // בשורת הסה"כ טקסט חופשי ("55 הזמנות") נשאר טקסט גם בעמודת תאריך
    put(c, v, typeof v === 'string' && !asDate(v) ? { ...col, kind: 'text' } : col);
    c.font = { name: FONT, size: 11, bold: true, color: { argb: C.ink } };
    c.fill = fill(C.brand50);
    c.border = { top: { style: 'medium', color: { argb: C.brand } }, bottom: thin(C.brand), left: thin(C.line), right: thin(C.line) };
  });
  r.height = 22;
}

function addSheet(wb: Workbook, s: XSheet, made: string) {
  const width = Math.max(1, ...s.tables.map((t) => t.cols.length));
  const ws = wb.addWorksheet(s.name.slice(0, 31), { views: [{ rightToLeft: true, showGridLines: false }] });
  ws.columns = Array.from({ length: width }, (_, i) => ({ width: Math.max(10, ...s.tables.map((t) => t.cols[i]?.width ?? 0)) }));

  merged(ws, 1, width, s.title, { size: 16, bold: true, color: { argb: C.white } }, 32, C.navy);
  merged(ws, 2, width, [s.period && `תקופה: ${s.period}`, `הופק: ${made}`].filter(Boolean).join('   ·   '), { size: 11, bold: true, color: { argb: C.ink } }, 22);
  let row = 3;
  (s.notes ?? []).filter(Boolean).forEach((n) => { merged(ws, row, width, n, { size: 10, italic: true, color: { argb: C.gray } }); row += 1; });
  row += 1;

  let main: { header: number; last: number; cols: number } | null = null;
  s.tables.forEach((t) => {
    if (t.title) { merged(ws, row, width, t.title, { size: 13, bold: true, color: { argb: C.brand } }, 24); row += 1; }
    if (t.note) { merged(ws, row, width, t.note, { size: 10, color: { argb: C.gray } }); row += 1; }
    if (!t.rows.length) { row += 1; return; }
    headerRow(ws, row, t.cols);
    const header = row; row += 1;
    let zebra = 0;
    t.rows.forEach((cells, i) => { const st = t.rowStyle?.[i]; bodyRow(ws, row, cells, t.cols, st === 'group' ? 0 : zebra++, st, t.cellKinds?.[i]); if (st === 'group') zebra = 0; row += 1; });
    if (t.main) main = { header, last: row - 1, cols: t.cols.length };
    if (t.total) { totalRow(ws, row, t.total, t.cols); row += 1; }
    row += 1;
  });

  /* הטבלה הראשית: שורת העמודות קבועה בגלילה ובהדפסה, וסינון בכל עמודה */
  const m = main as { header: number; last: number; cols: number } | null;
  if (m) {
    ws.views = [{ rightToLeft: true, showGridLines: false, state: 'frozen', ySplit: m.header }];
    ws.autoFilter = { from: { row: m.header, column: 1 }, to: { row: m.last, column: m.cols } };
  }
  ws.pageSetup = { paperSize: 9, orientation: width > 6 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }, ...(m ? { printTitlesRow: `${m.header}:${m.header}` } : {}) };
  ws.headerFooter = { oddFooter: '&Cעמוד &P מתוך &N' };
}

const two = (n: number) => String(n).padStart(2, '0');
export async function downloadXlsx(fileName: string, sheets: XSheet[]) {
  const mod = await import('exceljs');
  const ExcelJS = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
  const wb: Workbook = new ExcelJS.Workbook();
  wb.creator = "Domino's CRM";
  wb.created = new Date();
  const d = new Date();
  const made = `${two(d.getDate())}.${two(d.getMonth() + 1)}.${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;
  sheets.forEach((s) => addSheet(wb, s, made));
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
