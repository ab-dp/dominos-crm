/* PDF לסיכום לתפעול: עמודי A4 לרוחב רגילים בלבד, כל אשכול מעמוד חדש.
   אשכול שנכנס לעמוד אחד (גם בהקטנה קלה) – עמוד אחד. אשכול ארוך – כמה עמודים, נחתך בין הזמנות:
   לא באמצע הזמנה, ולא בין כותרת של יום / סניף לבין ההזמנה הראשונה שלה.
   כל עמוד מקבל תמונה משלו (JPEG) בגודל העמוד – בלי עמודים בגודל חריג ובלי תמונה ענקית אחת, שקוראי PDF מתקשים לפתוח. */
const PAGE_W = 297, PAGE_H = 210, M = 8;
const MIN_SCALE = 0.85; // הקטנה גדולה מזו כבר פוגעת בקריאה – עדיף עמוד נוסף
const MAX_CANVAS_PX = 16000; // צלע מקסימלית של קנבס שכל דפדפן מצייר בבטחה
const MAX_CANVAS_AREA = 40e6;

export async function downloadOpsPdf(sheets: HTMLElement[], fileName: string) {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true });
  const fullW = PAGE_W - 2 * M, room = PAGE_H - 2 * M;
  let first = true;
  for (const el of sheets) {
    const W = el.offsetWidth, H = el.offsetHeight;
    if (!W || !H) continue;
    const ratio = Math.min(2, MAX_CANVAS_PX / H, Math.sqrt(MAX_CANVAS_AREA / (W * H)));
    const canvas = await toCanvas(el, { pixelRatio: ratio, backgroundColor: '#ffffff', cacheBust: true, width: W, height: H });
    const k = canvas.height / H; // פיקסלים בקנבס לכל פיקסל בדף
    const mmPerPx = fullW / W;
    const fit = room / (H * mmPerPx);
    const s = fit >= MIN_SCALE ? Math.min(1, fit) : MIN_SCALE;
    const pageHpx = room / (mmPerPx * s);
    const cuts = fit >= MIN_SCALE ? [] : cutPoints(el, H);
    let start = 0;
    while (start < H - 1) {
      const limit = start + pageHpx;
      const end = limit >= H ? H : [...cuts].reverse().find((y) => y <= limit && y > start + 80) ?? Math.floor(limit);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = Math.max(1, Math.round((end - start) * k));
      const ctx = slice.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, Math.round(start * k), canvas.width, slice.height, 0, 0, slice.width, slice.height);
      if (!first) pdf.addPage('a4', 'landscape');
      first = false;
      const w = fullW * s;
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', (PAGE_W - w) / 2, M, w, (end - start) * mmPerPx * s);
      start = end;
    }
  }
  pdf.save(fileName);
}

/* נקודות חיתוך אפשריות (בפיקסלים של הדף): תחילת כל שורה בטבלה, חוץ משורה שבאה מיד אחרי כותרת יום או סניף */
function cutPoints(el: HTMLElement, H: number) {
  const box = el.getBoundingClientRect();
  const scale = box.height / H || 1; // הדף מוקטן על המסך בטלפון / חלון צר
  const rows = [...el.querySelectorAll<HTMLTableRowElement>('.os-table tbody tr')];
  return rows
    .filter((_, i) => i > 0 && !rows[i - 1].matches('.os-br, .os-dayband'))
    .map((r) => (r.getBoundingClientRect().top - box.top) / scale)
    .sort((a, b) => a - b);
}
