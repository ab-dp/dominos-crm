/* תזכורות "בהמתנה": כשמגיע הזמן לחזור להזמנה, מי שסימן אותה מקבל הודעה עם "פתח" (ואם החלון ברקע ויש רשות – גם התראת דפדפן).
   רץ בתוך המערכת בלבד – בתוכנית החינמית אין שרת, ולכן התזכורת מגיעה רק כשהמערכת פתוחה. כל תזכורת מוצגת פעם אחת לכל מועד. */
import { useEffect, useRef } from 'react';
import { usePanel } from '../../app/PanelContext';
import { useAuth } from '../../auth/AuthContext';
import { useStore } from '../../data/store';
import { holdDue } from '../../data/types';
import { useToast } from '../../design/Toast';
import { Ltr } from '../../lib/format';

export function HoldReminders() {
  const { orders, now } = useStore();
  const { profile } = useAuth();
  const panel = usePanel();
  const toast = useToast();
  const shown = useRef(new Set<string>());
  // מה שכבר עבר מועדו כשהמערכת נפתחה – לא מקפיצים הכל בבת אחת; זה מופיע ממילא בראש "להקליד ל-Q"
  const ready = useRef(false);

  useEffect(() => {
    if (!profile?.uid || !orders.length) return;
    const due = orders.filter((o) => o.hold && o.hold.by === profile.uid && !o.qNumber && o.status !== 'cancelled' && !!o.hold.remindAt && holdDue(o.hold, now));
    const fresh = due.filter((o) => !shown.current.has(`${o.id}:${o.hold!.remindAt}`));
    fresh.forEach((o) => shown.current.add(`${o.id}:${o.hold!.remindAt}`));
    if (!ready.current) { ready.current = true; return; }
    fresh.forEach((o) => {
      toast({
        message: <>הגיע הזמן לחזור להזמנה <Ltr>{o.id}</Ltr> · {o.customerName} · {o.hold!.reason}</>,
        action: { label: 'פתח', run: () => panel.open(o.id) },
      });
      try {
        if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
          const n = new Notification(`לחזור להזמנה ${o.id} · ${o.customerName}`, { body: [o.hold!.reason, o.hold!.note].filter(Boolean).join(' · '), tag: `hold-${o.id}`, dir: 'rtl', lang: 'he' });
          n.onclick = () => { window.focus(); panel.open(o.id); n.close(); };
        }
      } catch { /* דפדפן בלי התראות */ }
    });
  }, [orders, now, profile?.uid, toast, panel]);

  return null;
}
