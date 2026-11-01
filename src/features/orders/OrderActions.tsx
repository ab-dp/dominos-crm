/* פעולות מהירות על הזמנה – בשורה, במסך "היום" ובתיק ההזמנה (אפיון 6.2). */
import { useState, type FormEvent, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { TriangleAlert } from 'lucide-react';
import { Button, Field, MarkAction } from '../../design/components';
import { useStore, type OrderView } from '../../data/store';
import { PAYMENT_LABEL, type PaymentState } from '../../data/types';
import { Ltr, fmtMoney } from '../../lib/format';
import type { Issue } from '../../rules-engine/health';

/* ---------- טפסים קטנים שנפתחים במקום ---------- */
function BranchForm({ o, done }: { o: OrderView; done: () => void }) {
  const { update } = useStore();
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  if (o.branchApproval) {
    return (
      <>
        <p className="pop__text">אושר ע"י <b>{o.branchApproval.manager}</b></p>
        <Button size="sm" variant="ghost" onClick={() => { update(o.id, { branchApproval: undefined }, <>אישור הסניף בוטל · הזמנה <Ltr>{o.id}</Ltr></>); done(); }}>בטל אישור</Button>
      </>
    );
  }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr('חובה: שם המנהל שאישר בסניף'); return; }
    update(o.id, { branchApproval: { manager: name.trim(), at: new Date().toISOString() } }, <>אישור סניף נשמר · {o.branchName}</>);
    done();
  };
  return (
    <form onSubmit={submit}>
      <p className="pop__text">{o.branchName} · <Ltr>{o.branchPhone.replace(/(\d{3})(\d+)/, '$1-$2')}</Ltr></p>
      <Field label="שם המנהל שאישר (חובה)">
        <input className="input" autoFocus value={name} onChange={(e) => { setName(e.target.value); setErr(''); }} aria-invalid={!!err} aria-describedby={err ? `err-b${o.id}` : undefined} />
      </Field>
      {err && <p className="pop__err" id={`err-b${o.id}`}>{err}</p>}
      <div className="pop__row"><Button variant="primary" size="sm" type="submit" kbd="Enter">סמן אישור</Button></div>
    </form>
  );
}

function QForm({ o, done }: { o: OrderView; done: () => void }) {
  const { update } = useStore();
  const [num, setNum] = useState(o.qNumber ?? '');
  const [amt, setAmt] = useState(String(o.qAmount ?? o.amount));
  const [err, setErr] = useState('');
  // כלל 15: העברה ל-Q לפני אישור – אזהרה, לא חסימה
  const early = o.status !== 'approved' || !o.branchApproval;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!num.trim()) { setErr('חובה: מספר ההזמנה ב-Q, למשל cs669'); return; }
    const qAmount = Number(amt.replace(/[^\d.]/g, ''));
    update(o.id, { qNumber: num.trim(), qAmount }, qAmount !== o.amount
      ? <>הועברה ל-Q · <b>פער מול Q</b>: <Ltr>{fmtMoney(qAmount)}</Ltr> מול <Ltr>{fmtMoney(o.amount)}</Ltr></>
      : <>הועברה ל-Q · <Ltr>{num.trim()}</Ltr></>);
    done();
  };
  return (
    <form onSubmit={submit}>
      {early && (
        <p className="pop__warn"><TriangleAlert size={14} aria-hidden="true" /> {o.status !== 'approved' ? 'ההזמנה עוד לא אושרה ע"י הלקוח' : 'אין אישור סניף'}. אפשר להמשיך.</p>
      )}
      <Field label="מס' הזמנה ב-Q (חובה)">
        <input className="input input--ltr" autoFocus value={num} onChange={(e) => { setNum(e.target.value); setErr(''); }} placeholder="cs000" aria-invalid={!!err} />
      </Field>
      <Field label="סכום Q (₪)" hint={`סכום ההזמנה: ${fmtMoney(o.amount)}`}>
        <input className="input input--ltr" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} />
      </Field>
      {err && <p className="pop__err">{err}</p>}
      <div className="pop__row"><Button variant="primary" size="sm" type="submit" kbd="Enter">{early ? 'סמן בכל זאת' : 'סמן הועברה'}</Button></div>
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
        <Popover.Content className="pop" sideOffset={6} align="start" dir="rtl">
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
  const payDone = o.payment !== 'pending';
  const show = (k: string) => !only || only === k;
  return (
    <>
      {show('branch') && (
        <MarkAction open={open === 'branch'} onOpenChange={set('branch')} done={!!o.branchApproval} label="סניף"
          srLabel={o.branchApproval ? `אישור סניף: אושר ע"י ${o.branchApproval.manager}` : 'אישור סניף: חסר. לחץ לסימון'} title="אישור סניף">
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
export function FixButton({ o, issue, onOpen }: { o: OrderView; issue: Issue; onOpen: () => void }) {
  const { update } = useStore();
  const [open, setOpen] = useState(false);
  const pop = (content: ReactNode, title: string) => (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button size="sm" variant="fix" onClick={(e) => e.stopPropagation()}>{issue.actionLabel}</Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="pop" sideOffset={6} align="end" dir="rtl" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <p className="pop__title">{title}</p>
          {content}
          <Popover.Arrow className="pop__arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
  const done = () => setOpen(false);
  switch (issue.action) {
    case 'branch': return pop(<BranchForm o={o} done={done} />, 'אישור סניף');
    case 'q': return pop(<QForm o={o} done={done} />, 'הועברה ל-Q');
    case 'pay': return pop(<PayForm o={o} done={done} />, 'מצב תשלום');
    case 'po': return pop(<PoForm o={o} done={done} />, 'תעודת רכש');
    case 'close':
      return <Button size="sm" variant="fix" onClick={(e) => { e.stopPropagation(); update(o.id, { status: 'delivered' }, <>הזמנה <Ltr>{o.id}</Ltr> סומנה כסופקה ועברה לארכיון</>); }}>{issue.actionLabel}</Button>;
    case 'status':
      return <Button size="sm" variant="fix" onClick={(e) => { e.stopPropagation(); update(o.id, { status: 'approved' }, <>הזמנה <Ltr>{o.id}</Ltr> · סטטוס: אושרה</>); }}>סמן אושרה</Button>;
    default:
      return <Button size="sm" variant="fix" onClick={(e) => { e.stopPropagation(); onOpen(); }}>{issue.actionLabel}</Button>;
  }
}
