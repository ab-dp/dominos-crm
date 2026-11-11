/* ציר ההזמנה: תהליך אחד במקום סטטוס + שלושה סימונים.
   לקוח אישר ← עודכן בתפעול ← הוקלד ל-Q (ונשלח בקבוצת תפעול) ← נסגרה (סופקה / חלקית, אפשר באיחור). ביטול – מכל שלב.
   השלב נגזר מהנתונים (stageOf), כך שגם הזמנות ישנות יושבות במקום הנכון. */
import { useState, type FormEvent, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, CircleAlert, X } from 'lucide-react';
import { useStore, type OrderView } from '../../data/store';
import { STAGE_LABEL, closeLabel, stageOf, type Stage } from '../../data/types';
import { Button, Field } from '../../design/components';
import { Ltr, fmtMoney } from '../../lib/format';
import { BranchForm, QForm } from './OrderActions';
import './OrderTimeline.css';

const STEP_ORDER: Stage[] = ['pending_customer', 'pending_branch', 'approved', 'in_q'];
const rank = (s: Stage) => (s === 'delivered' || s === 'partial' ? 4 : s === 'cancelled' ? -1 : STEP_ORDER.indexOf(s));

/* סגירת הזמנה: סופקה או סופקה חלקית, ואם היה איחור – כמה דקות */
export function CloseForm({ o, done }: { o: OrderView; done: () => void }) {
  const { update, requestStatus } = useStore();
  const closed = o.status === 'delivered' || o.status === 'partial';
  const [late, setLate] = useState(!!o.late);
  const [mins, setMins] = useState(o.late?.minutes ? String(o.late.minutes) : '');
  const lateVal = late ? { minutes: Number(mins.replace(/\D/g, '')) || 0 } : undefined;
  const deliver = (e?: FormEvent) => {
    e?.preventDefault();
    update(o.id, { status: 'delivered', late: lateVal }, <>הזמנה <Ltr>{o.id}</Ltr> סומנה {late ? 'סופקה באיחור' : 'סופקה'} ועברה לארכיון</>);
    done();
  };
  return (
    <form onSubmit={deliver} className="close-form">
      <label className="check-inline close-form__late">
        <input type="checkbox" checked={late} onChange={(e) => setLate(e.target.checked)} /> סופקה באיחור
      </label>
      {late && (
        <Field label="זמן האיחור (דקות)">
          <input className="input input--ltr close-form__mins" inputMode="numeric" autoFocus value={mins} onChange={(e) => setMins(e.target.value)} placeholder="למשל 20" />
        </Field>
      )}
      <div className="close-form__btns">
        <Button variant="primary" size="sm" type="submit">{late ? 'סופקה באיחור' : 'סופקה'}</Button>
        <Button variant="secondary" size="sm" type="button" onClick={() => { done(); requestStatus({ ...o, late: lateVal }, 'partial'); }}>סופקה חלקית</Button>
      </div>
      {closed && (
        <button type="button" className="link close-form__reopen" onClick={() => { update(o.id, { status: 'approved', late: undefined }, <>הזמנה <Ltr>{o.id}</Ltr> חזרה להיות פתוחה</>); done(); }}>החזר להזמנה פתוחה</button>
      )}
    </form>
  );
}

function OpsForm({ o, done }: { o: OrderView; done: () => void }) {
  const { update } = useStore();
  return (
    <>
      <p className="pop__text">לשלוח את ההזמנה בקבוצת התפעול (<Ltr>{o.qNumber}</Ltr> · {o.branchName}).</p>
      <div className="pop__row"><Button variant="primary" size="sm" onClick={() => { update(o.id, { opsNotified: true }, <>נשלח בקבוצת תפעול · הזמנה <Ltr>{o.id}</Ltr></>); done(); }}>נשלח בקבוצת תפעול</Button></div>
    </>
  );
}

function Pop({ trigger, title, children, open, setOpen, align = 'start' }: { trigger: ReactNode; title: string; children: ReactNode; open: boolean; setOpen: (v: boolean) => void; align?: 'start' | 'end' | 'center' }) {
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="pop" aria-label={title} sideOffset={6} align={align} dir="rtl" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <p className="pop__title">{title}</p>
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* הצעד הבא – כפתור אחד שמתאים לשלב */
/* שם הצעד הבא בציר – לתפריט "⋯" בשורה, כשהכפתור בשורה תפוס בפעולת תיקון */
export function nextStepLabel(o: OrderView): string | null {
  const stage = stageOf(o);
  if (stage === 'pending_customer') return 'הלקוח אישר';
  if (stage === 'pending_branch') return 'סמן עודכן בתפעול';
  if (stage === 'approved') return 'הקלד ל-Q';
  if (stage === 'in_q') return 'סמן סופקה';
  return null;
}

export function NextStep({ o, size = 'sm' }: { o: OrderView; size?: 'sm' | 'md' }) {
  const { update } = useStore();
  const [open, setOpen] = useState(false);
  const stage = stageOf(o);
  const done = () => setOpen(false);
  const btn = (label: string, onClick?: () => void) => <Button size={size} variant="fix" onClick={(e) => { e.stopPropagation(); onClick?.(); }}>{label}</Button>;
  if (stage === 'pending_customer') return btn('הלקוח אישר', () => update(o.id, { status: 'approved' }, <>הלקוח אישר · הזמנה <Ltr>{o.id}</Ltr></>));
  if (stage === 'pending_branch') return <Pop open={open} setOpen={setOpen} title="עודכן בתפעול" align="end" trigger={btn('סמן עודכן בתפעול')}><BranchForm o={o} done={done} /></Pop>;
  if (stage === 'approved') return <Pop open={open} setOpen={setOpen} title="הקלדה ל-Q" align="end" trigger={btn('הקלד ל-Q')}><QForm o={o} done={done} /></Pop>;
  if (stage === 'in_q') return <Pop open={open} setOpen={setOpen} title="סגירת הזמנה" align="end" trigger={btn('סמן סופקה')}><CloseForm o={o} done={done} /></Pop>;
  return null;
}

/* ציר קטן לשורה בטבלה: ארבע נקודות ושם השלב */
export function StageTrack({ o }: { o: OrderView }) {
  const stage = stageOf(o);
  const r = rank(stage);
  const warn = (i: number) => (i === 1 && r > 1 && !o.branchApproval) || (i === 2 && o.qNumber && o.opsNotified === false);
  return (
    <span className={`stage stage--${stage}`} aria-label={`שלב: ${stage === 'delivered' || stage === 'partial' ? closeLabel(o) : STAGE_LABEL[stage]}`}>
      <span className="stage__dots" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => <span key={i} className={`stage__dot ${r > i ? 'is-done' : r === i ? 'is-now' : ''} ${warn(i) ? 'is-warn' : ''}`} />)}
      </span>
      <span className="stage__label">{stage === 'delivered' || stage === 'partial' ? closeLabel(o) : STAGE_LABEL[stage]}</span>
    </span>
  );
}

/* הציר המלא בתיק ההזמנה: ארבע תחנות (לחיצה על תחנה – תיקון שלה), ומתחת – הצעד הבא, תזכורת התפעול וביטול */
export function OrderTimeline({ o }: { o: OrderView }) {
  const { update, requestStatus } = useStore();
  const [open, setOpen] = useState<null | 'cust' | 'branch' | 'q' | 'close' | 'ops'>(null);
  const stage = stageOf(o);
  const r = rank(stage);
  const cancelled = stage === 'cancelled';
  const setFor = (k: 'cust' | 'branch' | 'q' | 'close' | 'ops') => (v: boolean) => setOpen(v ? k : null);
  const done = () => setOpen(null);

  const custDone = o.status !== 'new' && o.status !== 'pending_customer';
  const branchSkipped = r > 1 && !o.branchApproval;
  const closedDone = stage === 'delivered' || stage === 'partial';
  const st = (i: number): 'done' | 'now' | 'todo' => (cancelled ? (i < rankBeforeCancel(o) ? 'done' : 'todo') : r > i ? 'done' : r === i ? 'now' : 'todo');

  /* תחנה: נקודה, כותרת, פרט קצר. תחנה שהושלמה – כותרת לחיצה לתיקון */
  const step = (i: number, k: 'cust' | 'branch' | 'q' | 'close', title: string, detail: ReactNode, state: 'done' | 'now' | 'todo', warn: boolean, form: ReactNode) => (
    <li className={`otl-step is-${state} ${warn ? 'is-warn' : ''}`}>
      <span className="otl-step__dot" aria-hidden="true">{state === 'done' ? (warn ? <CircleAlert size={14} /> : <Check size={14} />) : i + 1}</span>
      <span className="otl-step__body">
        {state === 'done' && !cancelled && form
          ? <Pop open={open === k} setOpen={setFor(k)} title={title} trigger={<button className="otl-step__title otl-step__edit" aria-label={`${title} – לחץ לתיקון`}>{title}</button>}>{form}</Pop>
          : <span className="otl-step__title">{title}</span>}
        {detail && <span className="otl-step__detail">{detail}</span>}
      </span>
    </li>
  );

  return (
    <div className={`timeline-wrap ${cancelled ? 'is-cancelled' : ''}`}>
      <ol className="otl" aria-label="ציר ההזמנה">
        {step(0, 'cust', 'לקוח אישר', custDone ? null : 'ממתין ללקוח', st(0), false,
          <><p className="pop__text">הלקוח אישר את ההזמנה.</p><div className="pop__row"><Button size="sm" variant="ghost" onClick={() => { update(o.id, { status: 'pending_customer' }, <>הזמנה <Ltr>{o.id}</Ltr> חזרה ל"ממתין לאישור לקוח"</>); done(); }}>בטל אישור לקוח</Button></div></>)}
        {step(1, 'branch', 'עודכן בתפעול',
          o.branchApproval ? o.branchApproval.manager || null : branchSkipped ? <span className="otl-step__red">דולג</span> : null,
          o.branchApproval ? 'done' : st(1), branchSkipped, <BranchForm o={o} done={done} />)}
        {step(2, 'q', 'הוקלד ל-Q',
          o.qNumber ? <><Ltr>{o.qNumber}</Ltr> · <Ltr>{fmtMoney(o.qAmount ?? o.amount)}</Ltr></> : null,
          st(2), !!o.qNumber && o.opsNotified === false, <QForm o={o} done={done} />)}
        {step(3, 'close', closedDone ? closeLabel(o) : 'סופקה',
          closedDone && o.status === 'partial' ? o.partialNote : null,
          closedDone ? 'done' : st(3), false, <CloseForm o={o} done={done} />)}
      </ol>

      <div className="otl-next">
        {cancelled ? (
          <>
            <span className="otl-cancel__tag"><X size={14} aria-hidden="true" /> בוטלה{o.cancelReason && <> · {o.cancelReason}</>}</span>
            <button className="link" onClick={() => update(o.id, { status: 'approved' }, <>הביטול הוחזר · הזמנה <Ltr>{o.id}</Ltr></>)}>החזר מביטול</button>
          </>
        ) : (
          <>
            {!closedDone && <span className="otl-next__label">הצעד הבא:</span>}
            <NextStep o={o} />
            {o.qNumber && o.opsNotified === false && (
              <Pop open={open === 'ops'} setOpen={setFor('ops')} title="קבוצת תפעול" trigger={<button className="otl-ops"><CircleAlert size={14} aria-hidden="true" /> לשלוח בקבוצת תפעול</button>}><OpsForm o={o} done={done} /></Pop>
            )}
            {branchSkipped && !closedDone && <span className="otl-step__red otl-next__warn">לא סומן "עודכן בתפעול"</span>}
            <span className="otl-next__spacer" />
            {!closedDone && <Button size="sm" variant="danger" onClick={() => requestStatus(o, 'cancelled')}>ביטול הזמנה</Button>}
          </>
        )}
      </div>
    </div>
  );
}

/* בהזמנה שבוטלה: עד איפה הגיעה לפני הביטול */
function rankBeforeCancel(o: OrderView) {
  if (o.qNumber) return 3;
  if (o.branchApproval) return 2;
  return 1;
}
