/* PDF לסיכום לתפעול: A4 לרוחב, כל אשכול מעמוד חדש. אשכול נכנס לעמוד אחד – אם צריך, מוקטן לגובה העמוד.
   רק כשההקטנה הייתה הופכת את הטקסט לקטן מדי, הוא ממשיך לעמוד הבא – נחתך בין הזמנות ולא באמצע הזמנה. */
const PAGE_W = 297, PAGE_H = 210, M = 8;
const MIN_SCALE = 0.72; // מתחת לזה הטקסט קטן מדי לקריאה – עדיף עמוד נוסף

export async function downloadOpsPdf(sheets: HTMLElement[], fileName: string) {
  const [{ toPng }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true });
  let first = true;
  for (const el of sheets) {
    const W = el.offsetWidth, H = el.offsetHeight;
    const png = await toPng(el, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true, width: W, height: H });
    const fullW = PAGE_W - 2 * M, room = PAGE_H - 2 * M;
    const mmPerPx = fullW / W;
    const fit = room / (H * mmPerPx);
    const addPage = () => { if (!first) pdf.addPage(); first = false; };
    if (fit >= MIN_SCALE) {
      // עמוד אחד: ברוחב מלא, או מוקטן לגובה וממורכז
      const s = Math.min(1, fit), w = fullW * s, h = H * mmPerPx * s;
      addPage();
      pdf.addImage(png, 'PNG', (PAGE_W - w) / 2, M, w, h, undefined, 'FAST');
      continue;
    }
    // כמה עמודים: בקנה מידה MIN_SCALE, חיתוך בסוף שורת הזמנה
    const s = MIN_SCALE, w = fullW * s, k = mmPerPx * s; // מ"מ לפיקסל
    const pageHpx = room / k;
    const top = el.getBoundingClientRect().top;
    const scale = el.getBoundingClientRect().height / H || 1;
    const cuts = [...el.querySelectorAll('.os-table tbody tr, .os-head, .os-table thead')].map((n) => (n.getBoundingClientRect().bottom - top) / scale).sort((a, b) => a - b);
    let start = 0;
    while (start < H - 1) {
      const limit = start + pageHpx;
      const end = limit >= H ? H : [...cuts].reverse().find((y) => y <= limit && y > start + 40) ?? limit;
      addPage();
      pdf.addImage(png, 'PNG', (PAGE_W - w) / 2, M - start * k, w, H * k, undefined, 'FAST');
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, PAGE_W, M, 'F');
      pdf.rect(0, M + (end - start) * k, PAGE_W, PAGE_H, 'F');
      start = end;
    }
  }
  pdf.save(fileName);
}
