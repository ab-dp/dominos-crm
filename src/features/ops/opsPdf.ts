/* PDF לסיכום לתפעול: עמוד אחד לכל אשכול, תמיד. אשכול שנכנס ל-A4 לרוחב (גם בהקטנה קלה) מקבל עמוד A4 רגיל;
   אשכול ארוך יותר מקבל עמוד אחד ארוך באותו רוחב – הכתב נשאר באותו גודל ושום הזמנה לא נחתכת בין עמודים. */
const PAGE_W = 297, PAGE_H = 210, M = 8;
const MIN_SCALE = 0.85; // הקטנה גדולה מזו כבר פוגעת בקריאה – עדיף עמוד ארוך
const MAX_PX = 15000;   // גובה תמונה מקסימלי שדפדפנים מציירים בבטחה

export async function downloadOpsPdf(sheets: HTMLElement[], fileName: string) {
  const [{ toPng }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  const fullW = PAGE_W - 2 * M, room = PAGE_H - 2 * M;
  let pdf: InstanceType<typeof jsPDF> | undefined;
  for (const el of sheets) {
    const W = el.offsetWidth, H = el.offsetHeight;
    const png = await toPng(el, { pixelRatio: Math.min(2, MAX_PX / H), backgroundColor: '#ffffff', cacheBust: true, width: W, height: H });
    const hMm = H * (fullW / W);
    const fit = room / hMm;
    const long = fit < MIN_SCALE;
    const pageH = long ? hMm + 2 * M : PAGE_H;
    const format = [PAGE_W, pageH], orientation = pageH > PAGE_W ? 'portrait' : 'landscape';
    if (!pdf) pdf = new jsPDF({ unit: 'mm', format, orientation, compress: true });
    else pdf.addPage(format, orientation);
    const s = long ? 1 : Math.min(1, fit), w = fullW * s;
    pdf.addImage(png, 'PNG', (PAGE_W - w) / 2, M, w, hMm * s, undefined, 'FAST');
  }
  pdf?.save(fileName);
}
