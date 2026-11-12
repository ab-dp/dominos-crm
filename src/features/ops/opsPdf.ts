/* PDF לסיכום לתפעול: עמוד אחד לכל אשכול, לאורך – ברוחב A4 לרוחב (297 מ"מ), והגובה לפי האשכול. הכתב לא מוקטן.
   כדי שכל קורא PDF יפתח אותו: התמונה נשמרת כרצועות JPEG זו מתחת לזו (לא תמונה ענקית אחת),
   והעמוד לא עולה על 5,000 מ"מ (מעל ~5,080 קוראי PDF מסרבים) – אשכול ארוך מזה מוקטן כדי להיכנס. */
const PAGE_W = 297, M = 8, MIN_H = 210, MAX_H = 5000;
const MAX_CANVAS_PX = 16000; // צלע מקסימלית של קנבס שכל דפדפן מצייר בבטחה
const MAX_CANVAS_AREA = 40e6;
const STRIP_PX = 3000;       // גובה רצועה בקנבס

export async function downloadOpsPdf(sheets: HTMLElement[], fileName: string) {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  const fullW = PAGE_W - 2 * M;
  let pdf: InstanceType<typeof jsPDF> | undefined;
  for (const el of sheets) {
    const W = el.offsetWidth, H = el.offsetHeight;
    if (!W || !H) continue;
    const ratio = Math.min(2, MAX_CANVAS_PX / H, Math.sqrt(MAX_CANVAS_AREA / (W * H)));
    const canvas = await toCanvas(el, { pixelRatio: ratio, backgroundColor: '#ffffff', cacheBust: true, width: W, height: H });
    const hMm = H * (fullW / W);
    const s = Math.min(1, (MAX_H - 2 * M) / hMm); // רק אשכול ענק מוקטן
    const pageH = Math.max(MIN_H, hMm * s + 2 * M);
    const format = [PAGE_W, pageH];
    const orientation = pageH > PAGE_W ? 'portrait' : 'landscape';
    if (!pdf) pdf = new jsPDF({ unit: 'mm', format, orientation, compress: true });
    else pdf.addPage(format, orientation);
    const w = fullW * s, x = (PAGE_W - w) / 2, mmPerCanvasPx = w / canvas.width;
    for (let y = 0; y < canvas.height; y += STRIP_PX) {
      const h = Math.min(STRIP_PX, canvas.height - y);
      const strip = document.createElement('canvas');
      strip.width = canvas.width;
      strip.height = h;
      const ctx = strip.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, strip.width, h);
      ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      // חפיפה זעירה בין רצועות – בלי קו לבן דק ביניהן בחלק מהקוראים
      const overlap = y + h < canvas.height ? 0.15 : 0;
      pdf.addImage(strip.toDataURL('image/jpeg', 0.92), 'JPEG', x, M + y * mmPerCanvasPx, w, h * mmPerCanvasPx + overlap);
    }
  }
  pdf?.save(fileName);
}
