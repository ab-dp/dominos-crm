/* "בהמתנה": סימון הזמנה שממתינה לטיפול (למשל הלקוח לא עונה לחיוב), עם סיבה, הערה ומתי לחזור.
   עוברים להזמנה הבאה, וכשמגיע הזמן ההזמנה חוזרת לראש "להקליד ל-Q" במסך היום (ומי שסימן מקבל תזכורת).
   כל נציג יכול לסמן, לרשום ניסיון נוסף ולשחרר. רישום Q משחרר אוטומטית. הכל נרשם ביומן ההזמנה. */
import { useState, type FormEvent, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { PauseCircle } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useStore, type OrderView } from '../../data/store';
import { HOLD_REASONS, holdDue, type OrderHold } from '../../data/types';
import { Button, Field } from '../../design/components';
import { Ltr } from '../../lib/format';
import './Hold.css';

const REMIND: [number, string][] = [[10, "10 דק'"], [20, "20 דק'"], [30, "30 דק'"], [60, 'שעה'], [0, 'בלי תזכורת']];

/* "לפני 7 דק'" / "לפני שעה" – מתי סומנה */
export function agoText(iso: string, now: Date): ReactNode {
  const m = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'עכשיו';
  if (m < 60) return <>לפני <Ltr>{m}</Ltr>&nbsp;דק'</>;
  const h = Math.floor(m / 60);
  return h === 1 ? 'לפני שעה' : <>לפני <Ltr>{h}</Ltr>&nbsp;שעות</>;
}
/* "חזרה בעוד 3 דק'" / "הגיע הזמן לחזור" */
export function remindText(h: OrderHold, now: Date): ReactNode {
  if (holdDue(h, now)) return 'הגיע הזמן לחזור';
  if (!h.remindAt) return null;
  const m = Math.max(1, Math.round((new Date(h.remindAt).getTime() - now.getTime()) / 60000));
  const at = new Date(h.remindAt);
  return <>חזרה בעוד <Ltr>{m}</Ltr>&nbsp;דק' · <Ltr>{`${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`}</Ltr></>;
}

/* התראת דפדפן לתזכורת – מבקשים רשות פעם אחת, כשקובעים תזכורת בפעם הראשונה */
function askNotify() {
  try { if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission(); } catch { /* דפדפן בלי התראות */ }
}

/* הטופס: סימון חדש, או "ניסיתי שוב" (retry) – אותה סיבה, הערה מעודכנת, תזכורת חדשה, ניסיון נוסף */
export function HoldForm({ o, done, retry }: { o: OrderView; done: () => void; retry?: boolean }) {
  const { update } = useStore();
  const { profile } = useAuth();
  const [reason, setReason] = useState(o.hold?.reason ?? HOLD_REASONS[0]);
  const [note, setNote] = useState(retry ? '' : o.hold?.note ?? '');
  const [remind, setRemind] = useState(10);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const now = new Date();
    // בניסיון נוסף ההערה החדשה מתווספת לקודמת, כדי שיהיה ברור מה כבר נוסה
    const fullNote = (retry ? [o.hold?.note?.trim(), note.trim()].filter(Boolean).join(' · ') : note.trim()).slice(-500);
    const hold: OrderHold = {
      reason,
      ...(fullNote ? { note: fullNote } : {}),
      by: profile?.uid ?? '', byName: profile?.name ?? '',
      at: now.toISOString(),
      ...(remind ? { remindAt: new Date(now.getTime() + remind * 60000).toISOString() } : {}),
      attempts: retry ? (o.hold?.attempts ?? 1) + 1 : 1,
    };
    if (remind) askNotify();
    update(o.id, { hold }, retry
      ? <>נרשם ניסיון <Ltr>{hold.attempts}</Ltr> · הזמנה <Ltr>{o.id}</Ltr>{remind ? <> · תזכורת בעוד <Ltr>{remind}</Ltr> דק'</> : null}</>
      : <>הזמנה <Ltr>{o.id}</Ltr> בהמתנה · {reason}{remind ? <> · תזכורת בעוד <Ltr>{remind}</Ltr> דק'</> : null}</>);
    done();
  };
  return (
    <form onSubmit={submit} className="hold-form">
      {!retry && (
        <div className="hold-form__f">
          <span className="hold-form__k" id={`hr-${o.id}`}>סיבה</span>
          <div className="chips" role="radiogroup" aria-labelledby={`hr-${o.id}`}>
            {HOLD_REASONS.map((r) => <button type="button" key={r} role="radio" aria-checked={reason === r} className={`chip ${reason === r ? 'is-on' : ''}`} onClick={() => setReason(r)}>{r}</button>)}
          </div>
        </div>
      )}
      <Field label={retry ? 'מה קרה בניסיון הזה (לא חובה)' : 'הערה (לא חובה)'}>
        <textarea className="input hold-form__ta" rows={2} value={note} onChange={(e) => setNote(e.target.value)} autoFocus={retry}
          placeholder={retry ? 'למשל: שוב לא ענה, השארתי הודעה' : 'למשל: צריך לחייב באשראי, לא עונה בטלפון'} />
      </Field>
      <div className="hold-form__f">
        <span className="hold-form__k" id={`hm-${o.id}`}>לחזור אליה בעוד</span>
        <div className="seg seg--sm" role="radiogroup" aria-labelledby={`hm-${o.id}`}>
          {REMIND.map(([m, l]) => <button type="button" key={m} role="radio" aria-checked={remind === m} className={remind === m ? 'is-on' : ''} onClick={() => setRemind(m)}>{l}</button>)}
        </div>
      </div>
      <div className="pop__row"><Button variant="primary" size="sm" type="submit">{retry ? 'רשום ניסיון' : 'העבר להמתנה'}</Button></div>
    </form>
  );
}

function Pop({ trigger, title, children, open, setOpen }: { trigger: ReactNode; title: string; children: ReactNode; open: boolean; setOpen: (v: boolean) => void }) {
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="pop hold-pop" aria-label={title} sideOffset={6} align="end" dir="rtl" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <p className="pop__title">{title}</p>
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* כפתור "השהה" – להזמנה פתוחה שעוד לא ירדה ל-Q ואינה בהמתנה */
export function HoldButton({ o, size = 'sm' }: { o: OrderView; size?: 'sm' | 'md' }) {
  const [open, setOpen] = useState(false);
  if (o.hold || o.qNumber || o.status === 'cancelled' || o.status === 'delivered' || o.status === 'partial') return null;
  return (
    <Pop open={open} setOpen={setOpen} title="העבר להמתנה"
      trigger={<Button size={size} variant="secondary" icon={<PauseCircle size={16} />} onClick={(e) => e.stopPropagation()}>השהה</Button>}>
      <HoldForm o={o} done={() => setOpen(false)} />
    </Pop>
  );
}

/* פעולות על הזמנה שבהמתנה: ניסיון נוסף ושחרור */
export function HoldActions({ o, size = 'sm' }: { o: OrderView; size?: 'sm' | 'md' }) {
  const { update } = useStore();
  const [open, setOpen] = useState(false);
  if (!o.hold) return null;
  const release = () => update(o.id, { hold: undefined }, <>הזמנה <Ltr>{o.id}</Ltr> שוחררה מהמתנה</>);
  return (
    <span className="hold-acts">
      <Pop open={open} setOpen={setOpen} title={`ניסיון ${(o.hold.attempts ?? 1) + 1}`}
        trigger={<Button size={size} variant="secondary" onClick={(e) => e.stopPropagation()}>ניסיתי שוב</Button>}>
        <HoldForm o={o} retry done={() => setOpen(false)} />
      </Pop>
      <Button size={size} variant="ghost" onClick={(e) => { e.stopPropagation(); release(); }}>שחרר</Button>
    </span>
  );
}

/* הפס בראש כרטיס ההזמנה: למה בהמתנה, מי סימן ומתי, מתי לחזור – ופעולות */
export function HoldBanner({ o }: { o: OrderView }) {
  const { now } = useStore();
  const h = o.hold;
  if (!h) return null;
  const due = holdDue(h, now);
  return (
    <div className={`hold-banner ${due ? 'is-due' : ''}`} role="status">
      <div className="hold-banner__main">
        <b className="hold-banner__title"><PauseCircle size={16} aria-hidden="true" /> בהמתנה · {h.reason}{h.attempts > 1 && <> · ניסיון <Ltr>{h.attempts}</Ltr></>}</b>
        {h.note && <span className="hold-banner__note">{h.note}</span>}
        <span className="hold-banner__meta">{h.byName} · {agoText(h.at, now)}{(h.remindAt || due) && <> · <span className={due ? 'hold-due' : ''}>{remindText(h, now)}</span></>}</span>
      </div>
      <HoldActions o={o} />
    </div>
  );
}
