/* פעולות מהירות על הזמנה – בשורה, במסך "היום" ובתיק ההזמנה (אפיון 6.2). */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Button, Field, MarkAction, keepOpenOnOutside } from '../../design/components';
import { useStore, type OrderView } from '../../data/store';
import { PAYMENT_LABEL, type PaymentState } from '../../data/types';
import { cleanAmount, Ltr, fmtMoney, roundMoney, sameMoney } from '../../lib/format';
import type { Issue } from '../../rules-engine/health';
import { useAuth } from '../../auth/AuthContext';
import { CloseForm } from './OrderTimeline';
import { CARD_RE } from '../../lib/names';

/* ---------- טפסים קטנים שנפתחים במקום ---------- */
/* טופס Q אחד לכל המערכת: בחלון קופץ (שורה, "היום", תיקון מהציר) ומוטמע בבלוק "להעברה לקופה" (inline).
   סכום Q הוא בקרה: ריק עד שמקלידים את הסכום שירד בקופה, ונבדק מול סכום ההזמנה (פער = חריגה). */
export function QForm({ o, done, inline, primary = true, onCancel }: { o: OrderView; done: () => void; inline?: boolean; primary?: boolean; onCancel?: () => void }) {
  const { update } = useStore();
  const [num, setNum] = useState(o.qNumber ?? '');
  const [amt, setAmt] = useState(o.qAmount !== undefined ? String(o.qAmount) : '');
  const [err, setErr] = useState('');
  const numRef = useRef<HTMLInputElement>(null);
  const amtRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setNum(o.qNumber ?? ''); setAmt(o.qAmount !== undefined ? String(o.qAmount) : ''); setErr(''); }, [o.id, o.qNumber, o.qAmount]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!num.trim()) { setErr("חובה: מס' ההזמנה ב-Q, למשל cs669"); numRef.current?.focus(); return; }
    const qAmount = roundMoney(Number(cleanAmount(amt)));
    if (!(qAmount > 0)) { setErr('חובה: הסכום שירד בקופה'); amtRef.current?.focus(); return; }
    // מספר הזמנה ב-Q = ההזמנה חויבה, ולכן היא מסומנת "שולם" לבד. ביטול שכבר נרשם לא נדרס
    const paid = o.payment === 'cancelled' ? {} : { payment: 'paid' as const };
    // רישום Q משחרר את ההזמנה מהמתנה (אם הייתה) – הטיפול הסתיים
    update(o.id, { qNumber: num.trim(), qAmount, ...paid, ...(o.hold ? { hold: undefined } : {}) }, !sameMoney(qAmount, o.amount)
      ? <>הועברה ל-Q · <b>פער מול Q</b>: <Ltr>{fmtMoney(qAmount)}</Ltr> מול <Ltr>{fmtMoney(o.amount)}</Ltr></>
      : <>הועברה ל-Q · <Ltr>{num.trim()}</Ltr> · סומנה שולם</>);
    done();
  };
  const numInput = <input ref={numRef} id={inline ? 'reg-q-num' : undefined} className="input input--ltr" autoFocus={!inline} value={num} onChange={(e) => { setNum(e.target.value); setErr(''); }} aria-invalid={(!!err && !num.trim()) || undefined} />;
  const amtInput = <input ref={amtRef} className="input input--ltr" inputMode="decimal" value={amt} onChange={(e) => { setAmt(e.target.value); setErr(''); }} aria-invalid={(!!err && !!num.trim()) || undefined} />;
  const error = err && <p className={`pop__err ${inline ? 'reg-q__err' : ''}`} role="alert">{err}</p>;
  if (inline) {
    return (
      <form className="reg-q" onSubmit={submit} aria-label="העברה ל-Q">
        <label className="reg-q__f"><span className="kv__k">מס' הזמנה ב-Q</span>{numInput}</label>
        <label className="reg-q__f reg-q__f--amt"><span className="kv__k">הסכום שירד ב-Q (₪)</span>{amtInput}</label>
        <div className="reg-q__btns">
          <Button variant={primary ? 'primary' : 'secondary'} size="sm" type="submit">הועבר ל-Q</Button>
          {onCancel && <button type="button" className="link" onClick={onCancel}>ביטול</button>}
        </div>
        {error}
      </form>
    );
  }
  return (
    <form onSubmit={submit}>
      <Field label="מס' הזמנה ב-Q (חובה)">{numInput}</Field>
      <Field label="הסכום שירד ב-Q (₪, חובה)">{amtInput}</Field>
      {error}
      <div className="pop__row"><Button variant="primary" size="sm" type="submit" kbd="Enter">שמור</Button></div>
    </form>
  );
}

function PayForm({ o, done }: { o: OrderView; done: () => void }) {
  const { update } = useStore();
  const choose = (p: PaymentState) => {
    if (p !== o.payment) update(o.id, { payment: p }, <>מצב תשלום: {PAYMENT_LABEL[p]} · הזמנה <Ltr>{o.id}</Ltr></>);
    done();
  };
  return (
    <div className="pay-options" role="radiogroup" aria-label="מצב תשלום">
      {(Object.keys(PAYMENT_LABEL) as PaymentState[]).map((p) => (
        <button key={p} role="radio" aria-checked={o.payment === p} className={`pay-opt ${o.payment === p ? 'is-on' : ''}`} onClick={() => choose(p)}>
          {PAYMENT_LABEL[p]}
        </button>
      ))}
    </div>
  );
}

function PoForm({ o, done }: { o: OrderView; done: () => void }) {
  const { update } = useStore();
  const [v, setV] = useState(o.poNumber ?? '');
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!v.trim()) return; update(o.id, { poNumber: v.trim() }, <>מס' תעודת רכש נשמר · <Ltr>{v.trim()}</Ltr></>); done(); }}>
      <Field label="מס' תעודת רכש">
        <input className="input input--ltr" autoFocus value={v} onChange={(e) => setV(e.target.value)} />
      </Field>
      <div className="pop__row"><Button variant="primary" size="sm" type="submit" kbd="Enter">שמור</Button></div>
    </form>
  );
}

/* מס' תעודת רכש – לא חובה; אפשר להוסיף או לתקן בכל הזמנה */
export function PoEdit({ o }: { o: OrderView }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="link">{o.poNumber ? 'שנה' : 'הוסף'}</button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="pop" aria-label="תעודת רכש" sideOffset={6} align="start" dir="rtl">
          <p className="pop__title">תעודת רכש</p>
          <PoForm o={o} done={() => setOpen(false)} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ---------- הסימונים: Q ותשלום ---------- */
export function OrderMarks({ o, only }: { o: OrderView; only?: 'q' | 'pay' }) {
  const [open, setOpen] = useState<null | 'q' | 'pay'>(null);
  const set = (k: 'q' | 'pay') => (v: boolean) => setOpen(v ? k : null);
  const payDone = o.payment === 'paid' || o.payment === 'cancelled';
  const show = (k: string) => !only || only === k;
  return (
    <>
      {show('q') && (
        <MarkAction open={open === 'q'} onOpenChange={set('q')} done={!!o.qNumber} label={o.qNumber ? o.qNumber : 'Q'}
          srLabel={o.qNumber ? `הועברה ל-Q, מספר ${o.qNumber}` : 'הועברה ל-Q: חסר. לחץ לסימון'} title="הועברה ל-Q">
          <QForm o={o} done={() => setOpen(null)} />
        </MarkAction>
      )}
      {show('pay') && (
        <MarkAction open={open === 'pay'} onOpenChange={set('pay')} done={payDone} label={payDone ? PAYMENT_LABEL[o.payment] : 'תשלום'}
          srLabel={`מצב תשלום: ${PAYMENT_LABEL[o.payment]}. לחץ לשינוי`} title="מצב תשלום">
          <PayForm o={o} done={() => setOpen(null)} />
        </MarkAction>
      )}
    </>
  );
}

/* ---------- כפתור הפתרון: כל בעיה עם הכפתור שפותר אותה ---------- */
/* פער מול Q (כלל 2): או שמעדכנים את הסכום לחיוב לסכום שבקופה, או מאשרים שהפער מוסבר – עם סיבה */
function GapForm({ o, done }: { o: OrderView; done: () => void }) {
  const { update } = useStore();
  const { profile } = useAuth();
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const q = o.qAmount ?? o.amount;
  const diff = q - o.amount;
  const ack = (e: FormEvent) => {
    e.preventDefault();
    if (!note.trim()) { setErr('חובה: למה הפער בסדר (למשל: הנחה שסוכמה בטלפון)'); return; }
    if (CARD_RE.test(note)) { setErr('אסור לרשום כאן מספר כרטיס אשראי'); return; }
    update(o.id, { qGapAck: { amount: o.amount, qAmount: q, by: profile?.name ?? '', at: new Date().toISOString(), note: note.trim() } }, <>הפער מול Q אושר · הזמנה <Ltr>{o.id}</Ltr></>);
    done();
  };
  return (
    <form onSubmit={ack}>
      <div className="gap-sum">
        <span>לחיוב <b><Ltr>{fmtMoney(o.amount)}</Ltr></b></span>
        <span>ב-Q <b><Ltr>{fmtMoney(q)}</Ltr></b></span>
        <span className="gap-sum__diff">פער <b><Ltr>{`${diff > 0 ? '+' : '−'}${fmtMoney(Math.abs(diff))}`}</Ltr></b></span>
      </div>
      <Button size="sm" variant="secondary" type="button" className="gap-fix" onClick={() => { update(o.id, { amount: q }, <>הסכום לחיוב עודכן לסכום Q · <Ltr>{fmtMoney(q)}</Ltr></>); done(); }}>
        עדכן את הסכום לחיוב ל-<Ltr>{fmtMoney(q)}</Ltr>
      </Button>
      <p className="pop__text gap-or">או, אם הפער נכון:</p>
      <Field label="למה הפער בסדר (חובה)">
        <input className="input" value={note} onChange={(e) => { setNote(e.target.value); setErr(''); }} placeholder="למשל: הנחה שסוכמה מול הלקוח" aria-invalid={!!err} />
      </Field>
      {err && <p className="pop__err">{err}</p>}
      <div className="pop__row"><Button variant="primary" size="sm" type="submit">אשר שהפער מוסבר</Button></div>
    </form>
  );
}

/* בוטלה אחרי Q (כלל 10): אישור שההזמנה בוטלה גם בקופה */
function CancelAckForm({ o, done }: { o: OrderView; done: () => void }) {
  const { update } = useStore();
  const { profile } = useAuth();
  return (
    <>
      <p className="pop__text">ההזמנה בוטלה במערכת אחרי שהועברה לקופה (<Ltr>{o.qNumber}</Ltr>). צריך לוודא שהיא בוטלה גם ב-Q{o.payment === 'paid' ? ' ושהחיוב הוחזר' : ''}.</p>
      <div className="pop__row">
        <Button variant="primary" size="sm" onClick={() => { update(o.id, { qCancelAck: { by: profile?.name ?? '', at: new Date().toISOString() }, ...(o.payment === 'paid' ? { payment: 'cancelled' as const } : {}) }, <>אושר שהזמנה <Ltr>{o.id}</Ltr> בוטלה גם ב-Q</>); done(); }}>בוטלה גם ב-Q</Button>
      </div>
    </>
  );
}

/* שינוי אחרי הקלדה ל-Q שעוד לא עודכן בקופה: מסמנים שעודכן, ואם הסכום ב-Q השתנה – רושמים אותו */
function QUpdateForm({ o, done }: { o: OrderView; done: () => void }) {
  const { update } = useStore();
  const [amt, setAmt] = useState('');
  const [err, setErr] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const qAmount = roundMoney(Number(cleanAmount(amt)));
    if (!(qAmount > 0)) { setErr('חובה: הסכום שירד בקופה'); return; }
    update(o.id, { qNeedsUpdate: undefined, qAmount }, <>השינוי עודכן ב-Q · הזמנה <Ltr>{o.id}</Ltr></>);
    done();
  };
  return (
    <form onSubmit={submit}>
      <p className="pop__text">ההזמנה שונתה אחרי שהועברה לקופה (<Ltr>{o.qNumber}</Ltr>).</p>
      <Field label="הסכום ב-Q אחרי העדכון (₪, חובה)">
        <input className="input input--ltr" inputMode="decimal" autoFocus value={amt} onChange={(e) => { setAmt(e.target.value); setErr(''); }} aria-invalid={!!err} />
      </Field>
      {err && <p className="pop__err" role="alert">{err}</p>}
      <div className="pop__row"><Button variant="primary" size="sm" type="submit">עודכן ב-Q</Button></div>
    </form>
  );
}

export function FixButton({ o, issue, onOpen }: { o: OrderView; issue: Issue; onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const pop = (content: ReactNode, title: string) => (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button size="sm" variant="fix" onClick={(e) => e.stopPropagation()}>{issue.actionLabel}</Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="pop" aria-label={title} sideOffset={6} align="end" dir="rtl" onInteractOutside={keepOpenOnOutside} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <p className="pop__title">{title}</p>
          {content}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
  const done = () => setOpen(false);
  switch (issue.action) {
    case 'q': return pop(<QForm o={o} done={done} />, 'הועברה ל-Q');
    case 'pay': return pop(<PayForm o={o} done={done} />, 'מצב תשלום');
    case 'po': return pop(<PoForm o={o} done={done} />, 'תעודת רכש');
    case 'ackGap': return pop(<GapForm o={o} done={done} />, 'פער מול Q');
    case 'ackCancel': return pop(<CancelAckForm o={o} done={done} />, 'בוטלה אחרי Q');
    case 'ackQUpdate': return pop(<QUpdateForm o={o} done={done} />, 'עדכון ב-Q');
    case 'close': return pop(<CloseForm o={o} done={done} />, 'סגירת הזמנה');
    default:
      return <Button size="sm" variant="fix" onClick={(e) => { e.stopPropagation(); onOpen(); }}>{issue.actionLabel}</Button>;
  }
}
