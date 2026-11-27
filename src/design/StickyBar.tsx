import { useEffect, useRef, useState, type ReactNode } from 'react';

/* שורת הלשוניות והסינון של מסך רשימה – נשארת צמודה מתחת לסרגל העליון כשגוללים,
   כך שהתצוגה והסינון הפעילים תמיד גלויים. כשהיא "תקועה" – קו וצל דק מתחתיה.
   הגובה שלה נחשף כ-‎--stickybar-h (לכותרות יום דביקות בטבלה שמתחת). */
export function StickyBar({ children, className = '' }: { children: ReactNode; className?: string }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar')) || 56;
    // בטלפון השורה מתכווצת כשהיא נתקעת (החיפוש מוסתר) והדפדפן מזיז את הגלילה בהתאם –
    // ולכן משתחררת רק כשחוזרים 80px מעל נקודת ההיתקעות (בלי ריצוד סביב הסף)
    let on = false, raf = 0;
    const check = () => {
      raf = 0;
      const y = el.getBoundingClientRect().top;
      const next = on ? y < top + 80 : y < top;
      if (next !== on) { on = next; setStuck(next); }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(check); };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => {
    const el = bar.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => root.style.setProperty('--stickybar-h', `${Math.round(el.getBoundingClientRect().height)}px`));
    ro.observe(el);
    return () => { ro.disconnect(); root.style.removeProperty('--stickybar-h'); };
  }, []);

  return (
    <>
      <div ref={sentinel} className="stickybar__sentinel" aria-hidden="true" />
      <div ref={bar} className={`stickybar ${stuck ? 'is-stuck' : ''} ${className}`}>{children}</div>
    </>
  );
}
