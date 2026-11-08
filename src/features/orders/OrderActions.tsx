/* פעולות מהירות על הזמנה – בשורה, במסך "היום" ובתיק ההזמנה (אפיון 6.2). */
import { useState, type FormEvent, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { TriangleAlert } from 'lucide-react';
import { Button, Field, MarkAction } from '../../design/components';
import { useStore, type OrderView } from '../../data/store';
import { PAYMENT_LABEL, type PaymentState } from '../../data/types';
import { Ltr, fmtMoney, roundMoney } from '../../lib/format';
import type { Issue } from '../../rules-engine/health';
import { useAuth } from '../../auth/AuthContext';
import { CloseForm } from './OrderTimeline';

/* ---------- טפסים קטנים שנפתחים במקום ---------- */
export function BranchForm({ o, done }: { o: OrderView; done: () => void }) {
  const { update } = useStore();
  const [name, setName] = useState(o.branchApproval?.manager ?? '');
  if (!o.branchId) return <p className="pop__text">קודם צריך לשבץ סניף להזמנה – בתיק ההזמנה, באזור "אספקה".</p>;
  const custPending = o.status === 'new' || o.status === 'pending_customer';
  const submit = (e: FormEvent) => {
    e.preventDefault();
    update(o.id, { branchApproval: { manager: name.trim(), at: o.branchApproval?.at ?? new Date().toISOString() }, ...(custPending ? { status: 'approved' as const } : {}) },
      <>עודכן בתפעול · {o.branchName}{name.trim() && <> · {name.trim()}</>}</>);
    done();
  };
  return (
    <form onSubmit={submit}>
      <p className="pop__text">{o.branchName}{o.branchPhone && <> · <Ltr>{o.branchPhone.replace(/(\d{3})(\d+)/, '$1-$2')}</Ltr></>}</p>
      <Field label="שם המאשר (לא חובה)">
        <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="pop__row">
        <Button variant="primary" size="sm" type="submit" kbd="Enter">{o.branchApproval ? 'שמור' : 'סמן עודכן בתפעול'}</Button>
        {o.branchApproval && <Button size="sm" variant="ghost" type="button" onClick={() => { update(o.id, { branchApproval: undefined }, <>סימון "עודכן בתפעול" בוטל · הזמנה <Ltr>{o.id}</Ltr></>); done(); }}>בטל סימון</Button>}
      </div>
    </form>
  );
}

export function QForm({ o, done }: { o: OrderView; done: () => void }) {
  const { update } = useStore();
  const [num, setNum] = useState(o.qNumber ?? '');
  const [amt, setAmt] = useState(String(o.qAmount ?? o.amount));
  const [ops, setOps] = useState(o.opsNotified !== false && !!o.qNumber);
  const [err, setErr] = useState('');
  // כלל 15: העברה ל-Q לפני אישור – אזהרה, לא חסימה
  const early = !o.qNumber && (o.status !== 'approved' || !o.branchApproval);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!num.trim()) { setErr('חובה: מספר ההזמנה ב-Q, למשל cs669'); return; }
    const qAmount = roundMoney(Number(amt.replace(/[^\d.]/g, '')));
    // מספר הזמנה ב-Q = ההזמנה חויבה, ולכן היא מסומנת "שולם" לבד. ביטול שכבר נרשם לא נדרס
    const paid = o.payment === 'cancelled' ? {} : { payment: 'paid' as const };
    const cust = o.status === 'new' || o.status === 'pending_customer' ? { status: 'approved' as const } : {};
    update(o.id, { qNumber: num.trim(), qAmount, opsNotified: ops, ...paid, ...cust }, qAmount !== o.amount
      ? <>הועברה ל-Q · <b>פער מול Q</b>: <Ltr>{fmtMoney(qAmount)}</Ltr> מול <Ltr>{fmtMoney(o.amount)}</Ltr></>
      : <>הועברה ל-Q · <Ltr>{num.trim()}</Ltr> · סומנה שולם</>);
    done();
  };
  return (
    <form onSubmit={submit}>
      {early && (
        <p className="pop__warn"><TriangleAlert size={14} aria-hidden="true" /> {o.status !== 'approved' ? 'הלקוח עוד לא אישר' : 'התפעול עוד לא עודכן'}. אפשר להמשיך.</p>
      )}
      <Field label="מס' הזמנה ב-Q (חובה)">
        <input className="input input--ltr" autoFocus value={num} onChange={(e) => { setNum(e.target.value); setErr(''); }} placeholder="cs000" aria-invalid={!!err} />
      </Field>
      <Field label="סכום Q (₪)" hint={`סכום ההזמנה: ${fmtMoney(o.amount)}`}>
        <input className="input input--ltr" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} />
      </Field>
      <label className="check-inline q-ops">
        <input type="checkbox" checked={ops} onChange={(e) => setOps(e.target.checked)} /> נשלח בקבוצת תפעול
      </label>
      {!ops && <p className="pop__hint">תזכורת: לשלוח את ההזמנה בקבוצת התפעול. אפשר לסמן גם אחר כך.</p>}
      {err && <p className="pop__err">{err}</p>}
      <div className="pop__row"><Button variant="primary" size="sm" type="submit" kbd="Enter">{early ? 'שמור בכל זאת' : 'שמור'}</Button></div>
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
          <Popover.Arrow className="pop__arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ---------- שלושת הסימונים ---------- */
export function OrderMarks({ o, only }: { o: OrderView; only?: 'branch' | 'q' | 'pay' }) {
  const [open, setOpen] = useState<null | 'branch' | 'q' | 'pay'>(null);
  const set = (k: 'branch' | 'q' | 'pay') => (v: boolean) => setOpen(v ? k : null);
  const payDone = o.payment === 'paid' || o.payment === 'cancelled';
  const show = (k: string) => !only || only === k;
  return (
    <>
      {show('branch') && (
        <MarkAction open={open === 'branch'} onOpenChange={set('branch')} done={!!o.branchApproval} label="תפעול"
          srLabel={o.branchApproval ? `עודכן בתפעול${o.branchApproval.manager ? ` · ${o.branchApproval.manager}` : ''}` : 'עודכן בתפעול: עוד לא. לחץ לסימון'} title="עודכן בתפעול">
          <BranchForm o={o} done={() => setOpen(null)} />
        </MarkAction>
      )}
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
    if (/\d{13,}/.test(note)) { setErr('אסור לרשום כאן מספר כרטיס אשראי'); return; }
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
      <p className="pop__text">ההזמנה בוטלה במערכת אחרי שהועברה לקופה (<Ltr>{o.qNumber}</Ltr>). צריך לוודא שהיא בוטלה גם ב-Q.</p>
      <div className="pop__row">
        <Button variant="primary" size="sm" onClick={() => { update(o.id, { qCancelAck: { by: profile?.name ?? '', at: new Date().toISOString() } }, <>אושר שהזמנה <Ltr>{o.id}</Ltr> בוטלה גם ב-Q</>); done(); }}>בוטלה גם ב-Q</Button>
      </div>
    </>
  );
}

/* שינוי אחרי אישור שעוד לא עודכן בקופה: מסמנים שעודכן, ואם הסכום ב-Q השתנה – רושמים אותו */
function QUpdateForm({ o, done }: { o: OrderView; done: () => void }) {
  const { update } = useStore();
  const [amt, setAmt] = useState(String(o.qAmount ?? o.amount));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const qAmount = roundMoney(Number(amt.replace(/[^\d.]/g, '')) || o.amount);
    update(o.id, { qNeedsUpdate: undefined, qAmount }, <>השינוי עודכן ב-Q · הזמנה <Ltr>{o.id}</Ltr></>);
    done();
  };
  return (
    <form onSubmit={submit}>
      <p className="pop__text">ההזמנה שונתה אחרי שהועברה לקופה (<Ltr>{o.qNumber}</Ltr>).</p>
      <Field label="סכום ב-Q אחרי העדכון (₪)" hint={`לחיוב: ${fmtMoney(o.amount)}`}>
        <input className="input input--ltr" inputMode="decimal" autoFocus value={amt} onChange={(e) => setAmt(e.target.value)} />
      </Field>
      <div className="pop__row"><Button variant="primary" size="sm" type="submit">עודכן ב-Q</Button></div>
    </form>
  );
}

export function FixButton({ o, issue, onOpen }: { o: OrderView; issue: Issue; onOpen: () => void }) {
  const { update } = useStore();
  const [open, setOpen] = useState(false);
  const pop = (content: ReactNode, title: string) => (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button size="sm" variant="fix" onClick={(e) => e.stopPropagation()}>{issue.actionLabel}</Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="pop" aria-label={title} sideOffset={6} align="end" dir="rtl" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <p className="pop__title">{title}</p>
          {content}
          <Popover.Arrow className="pop__arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
  const done = () => setOpen(false);
  switch (issue.action) {
    case 'branch': return pop(<BranchForm o={o} done={done} />, 'עודכן בתפעול');
    case 'q': return pop(<QForm o={o} done={done} />, 'הועברה ל-Q');
    case 'pay': return pop(<PayForm o={o} done={done} />, 'מצב תשלום');
    case 'po': return pop(<PoForm o={o} done={done} />, 'תעודת רכש');
    case 'ackGap': return pop(<GapForm o={o} done={done} />, 'פער מול Q');
    case 'ackCancel': return pop(<CancelAckForm o={o} done={done} />, 'בוטלה אחרי Q');
    case 'ackQUpdate': return pop(<QUpdateForm o={o} done={done} />, 'עדכון ב-Q');
    case 'close': return pop(<CloseForm o={o} done={done} />, 'סגירת הזמנה');
    case 'ops':
      return <Button size="sm" variant="fix" onClick={(e) => { e.stopPropagation(); update(o.id, { opsNotified: true }, <>נשלח בקבוצת תפעול · הזמנה <Ltr>{o.id}</Ltr></>); }}>{issue.actionLabel}</Button>;
    case 'status':
      return <Button size="sm" variant="fix" onClick={(e) => { e.stopPropagation(); update(o.id, { status: 'approved' }, <>הלקוח אישר · הזמנה <Ltr>{o.id}</Ltr></>); }}>הלקוח אישר</Button>;
    default:
      return <Button size="sm" variant="fix" onClick={(e) => { e.stopPropagation(); onOpen(); }}>{issue.actionLabel}</Button>;
  }
}
