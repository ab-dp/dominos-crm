/* דף ההצעה (A4) – מה שהלקוח מקבל. אותו דף מוצג חי בזמן העריכה ויוצא ל-PDF.
   המבנה לפי הדוגמה שאושרה: לוגו וכותרת, לכבוד / פרטי האספקה, טבלת פריטים, סיכום, הערות ותנאים. שדה ריק לא מופיע. */
import { forwardRef, type ReactNode } from 'react';
import { fmtDate, fmtMoney, fmtPhone, weekday } from '../../lib/format';
import { sortLines, type QuoteCustomer, type QuoteFee, type QuoteLine } from '../../data/quotes';

export type SheetData = {
  number?: number; issueDate: string; validUntil: string;
  customer: QuoteCustomer; delivery: 'delivery' | 'pickup'; date?: string; time?: string; address?: string;
  lines: QuoteLine[]; fee?: QuoteFee; notes?: string; terms: string[]; handler: string;
};

const LOGO = `${import.meta.env.BASE_URL}logo-horizontal.svg`;
const ils = (n: number) => fmtMoney(n);

export const QuoteSheet = forwardRef<HTMLElement, { d: SheetData }>(function QuoteSheet({ d }, ref) {
  const c = d.customer;
  const lines = sortLines(d.lines.filter((l) => l.name.trim() && l.qty > 0));
  const items = lines.reduce((t, l) => t + l.qty * l.unitPrice, 0);
  const fee = d.delivery === 'delivery' && d.fee && d.fee.price > 0 ? d.fee : undefined;
  const contactLine = [c.contact.trim(), c.phone.trim() ? fmtPhone(c.phone.trim()) : ''].filter(Boolean);
  const who: ReactNode[] = [
    c.name.trim() && <b>{c.name.trim()}</b>,
    contactLine.length > 0 && <>{c.contact.trim()}{contactLine.length > 1 && ' · '}{c.phone.trim() && <bdi dir="ltr">{fmtPhone(c.phone.trim())}</bdi>}</>,
    c.email.trim() && <bdi dir="ltr">{c.email.trim()}</bdi>,
    c.taxId.trim() && <>ח.פ / ע.מ <bdi dir="ltr">{c.taxId.trim()}</bdi></>,
  ].filter(Boolean);
  const where: ReactNode[] = [
    d.date && <>מועד: <b><bdi dir="ltr">{fmtDate(d.date)}</bdi> (יום {weekday(d.date)}){d.time && <> · <bdi dir="ltr">{d.time}</bdi></>}</b></>,
    d.delivery === 'pickup' ? 'איסוף עצמי מהסניף' : 'משלוח',
    d.delivery === 'delivery' && d.address?.trim(),
  ].filter(Boolean);
  const join = (parts: ReactNode[]) => parts.map((p, i) => <span key={i}>{i > 0 && <br />}{p}</span>);
  return (
    <article className="qs" ref={ref} dir="rtl" aria-label="דף הצעת המחיר">
      <div className="qs-head">
        <img src={LOGO} alt="Domino's Pizza" />
        <div className="qs-title">
          <h1>הצעת מחיר{d.number ? <> <bdi dir="ltr">{d.number}</bdi></> : null}</h1>
          <div className="qs-meta">
            <span>תאריך</span><b><bdi dir="ltr">{fmtDate(d.issueDate)}</bdi></b>
            <span>בתוקף עד</span><b><bdi dir="ltr">{fmtDate(d.validUntil)}</bdi></b>
          </div>
        </div>
      </div>
      <div className="qs-parties">
        <div className="qs-party"><p className="qs-h">לכבוד</p><p>{who.length ? join(who) : <span className="qs-faint">—</span>}</p></div>
        <div className="qs-party"><p className="qs-h">פרטי האספקה</p><p>{join(where)}</p></div>
      </div>
      <table className="qs-table">
        <thead><tr><th className="i">#</th><th>פריט</th><th className="n">כמות</th><th className="m">מחיר ליחידה</th><th className="m">סה"כ</th></tr></thead>
        <tbody>
          {lines.length ? lines.map((l, i) => (
            <tr key={i}>
              <td className="i">{i + 1}</td>
              <td>{l.name.trim()}</td>
              <td className="n">{l.qty}</td>
              <td className="m">{l.unitPrice ? <bdi dir="ltr">{ils(l.unitPrice)}</bdi> : '—'}</td>
              <td className="m">{l.unitPrice ? <bdi dir="ltr">{ils(l.qty * l.unitPrice)}</bdi> : '—'}</td>
            </tr>
          )) : <tr><td colSpan={5} className="qs-empty">לא נבחרו מוצרים</td></tr>}
        </tbody>
      </table>
      <div className="qs-totals">
        <div><span>סה"כ מוצרים</span><b><bdi dir="ltr">{ils(items)}</bdi></b></div>
        {fee && <div><span>{fee.name.trim() || 'משלוח'}</span><b><bdi dir="ltr">{ils(fee.price)}</bdi></b></div>}
        <div className="grand"><span>סה"כ לתשלום</span><b><bdi dir="ltr">{ils(items + (fee?.price ?? 0))}</bdi></b></div>
        <p className="qs-vat">המחירים כוללים מע"מ</p>
      </div>
      {d.notes?.trim() && <div className="qs-notes"><p className="qs-h">הערות</p><p>{d.notes.trim()}</p></div>}
      <div className="qs-notes">
        <p className="qs-h">תנאים</p>
        <ul>
          <li>הצעה זו בתוקף עד <bdi dir="ltr">{fmtDate(d.validUntil)}</bdi>.</li>
          <li>כל המחירים בהצעה כוללים מע"מ.</li>
          {d.terms.filter((t) => t.trim()).map((t, i) => <li key={i}>{t.trim()}</li>)}
        </ul>
      </div>
      <div className="qs-foot">
        {d.handler && <p>איש הקשר שלכם: <b>{d.handler}</b></p>}
        <p>תודה שבחרתם ב-Domino's Pizza · נשמח לעמוד לשירותכם</p>
      </div>
    </article>
  );
});

/* ---------- PDF: הדפדפן מצייר את הדף (עברית מדויקת), ונשמר כ-A4. דף ארוך נחתך בין שורות ולא באמצע שורה ----------
   הספריות נטענות רק בלחיצה – לא מכבידות על טעינת המערכת */
export async function downloadSheetPdf(el: HTMLElement, fileName: string) {
  const [{ toPng }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  const W = el.offsetWidth, H = el.offsetHeight;
  const ratio = 2.2;
  const png = await toPng(el, { pixelRatio: ratio, backgroundColor: '#ffffff', cacheBust: true, width: W, height: H });
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const mmPerPx = 210 / W;
  const pageH = 297 / mmPerPx; // גובה עמוד בפיקסלים של הדף
  const pad = 14 / mmPerPx;     // שוליים עליונים בעמוד המשך
  // נקודות חיתוך אפשריות: סוף כל שורה בטבלה וכל בלוק בדף
  const top = el.getBoundingClientRect().top;
  const scale = el.getBoundingClientRect().height / H || 1;
  const cuts = [...el.querySelectorAll('.qs-table tbody tr, .qs-table thead, .qs > *')].map((n) => (n.getBoundingClientRect().bottom - top) / scale).sort((a, b) => a - b);
  const pages: [number, number][] = [];
  let start = 0;
  while (H - start > (pages.length ? pageH - pad : pageH) + 1) {
    const room = pages.length ? pageH - pad : pageH;
    const limit = start + room - 30;
    const cut = [...cuts].reverse().find((y) => y <= limit && y > start + 40) ?? start + room;
    pages.push([start, cut]);
    start = cut;
  }
  pages.push([start, H]);
  pages.forEach(([from, to], i) => {
    if (i) pdf.addPage();
    const offset = i ? pad : 0;
    pdf.addImage(png, 'PNG', 0, (offset - from) * mmPerPx, 210, H * mmPerPx, undefined, 'FAST');
    pdf.setFillColor(255, 255, 255);
    if (i) pdf.rect(0, 0, 210, pad * mmPerPx, 'F');
    const end = (offset + to - from) * mmPerPx;
    if (end < 297) pdf.rect(0, end, 210, 297 - end, 'F');
  });
  pdf.save(fileName);
}
