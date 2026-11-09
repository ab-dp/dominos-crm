/* טבלה ארוכה נבנית בהדרגה: 200 שורות ראשונות, והשאר נוספות כשמגיעים לתחתית (או בלחיצה על "הצג עוד").
   כך דוח של שנה (אלפי שורות) לא תוקע את הדפדפן. הסה"כים והייצוא לאקסל תמיד על כל השורות. */
import { useEffect, useRef, useState } from 'react';

export const PROGRESSIVE_PAGE = 200;

export function useProgressive(total: number, resetKey: unknown) {
  const [limit, setLimit] = useState(PROGRESSIVE_PAGE);
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => setLimit(PROGRESSIVE_PAGE), [resetKey]);
  useEffect(() => {
    const el = moreRef.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) setLimit((l) => l + PROGRESSIVE_PAGE); }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [limit, total]);
  return { limit, moreRef, hasMore: total > limit, rest: Math.max(0, total - limit), showMore: () => setLimit((l) => l + PROGRESSIVE_PAGE) };
}
