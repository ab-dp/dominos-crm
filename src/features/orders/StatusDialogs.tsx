/* סגירה ידנית של הזמנה (אפיון 4.7, 6.2): "סופקה חלקית" ו"בוטלה" נפתחים בחלון קטן עם הפרטים שצריך לדעת,
   מכל מקום שמשנים ממנו סטטוס – טבלה, מסך היום או תיק ההזמנה. ההזמנה עוברת לארכיון רק אחרי הסגירה. */
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CircleAlert, X } from 'lucide-react';
import { useLists } from '../../data/lists';
import { useStore } from '../../data/store';
import { Button } from '../../design/components';
import { Ltr, fmtMoney } from '../../lib/format';
import { keepOpenOnToast } from '../../app/ErrorBoundary';
import './StatusDialogs.css';

const CARD_RE = /\d{13,}/;
const money = (s: string) => Number(s.replace(/[^\d.]/g, '')) || 0;

export function StatusDialogs() {
  const { closing, endClosing } = useStore();
  if (!closing) return null;
  return closing.status === 'partial'
    ? <PartialDialog key={closing.order.id} onClose={endClosing} />
    : <CancelDialog key={closing.order.id} onClose={endClosing} />;
}

function Shell({ title, sub, children, onClose }: { title: string; sub: React.ReactNode; children: React.ReactNode; onClose: () => void }) {
  return (
    <Dialog.Root open onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="cmd-overlay" />
        <Dialog.Content className="udialog sdialog" dir="rtl" aria-describedby="sdialog-sub" onPointerDownOutside={keepOpenOnToast} onInteractOutside={keepOpenOnToast}
          onOpenAutoFocus={(e) => { e.preventDefault(); ((e.currentTarget as HTMLElement).querySelector('textarea, input') as HTMLElement | null)?.focus(); }}>
          <div className="sdialog__head">
            <Dialog.Title className="udialog__title">{title}</Dialog.Title>
            <Dialog.Close asChild><button className="icon-btn" aria-label="סגור"><X size={18} /></button></Dialog.Close>
          </div>
          <p id="sdialog-sub" className="sdialog__sub">{sub}</p>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PartialDialog({ onClose }: { onClose: () => void }) {
  const { closing, update } = useStore();
  const o = closing!.order;
  const [what, setWhat] = useState('');
  const [amount, setAmount] = useState(String(o.amount));
  const [err, setErr] = useState('');
  const next = money(amount);
  const save = () => {
    if (!what.trim()) return setErr('חובה: מה סופק בפועל, או מה חסר');
    if (CARD_RE.test(what)) return setErr('אסור לרשום כאן מספר כרטיס אשראי');
    if (next <= 0) return setErr('הסכום לחיוב חייב להיות גדול מ-0');
    update(o.id, {
      status: 'partial', partialNote: what.trim(),
      ...(next !== o.amount ? { amount: next } : {}),
    }, <>הזמנה <Ltr>{o.id}</Ltr> סומנה "סופקה חלקית" ועברה לארכיון{next !== o.amount && <> · לחיוב <Ltr>{fmtMoney(next)}</Ltr></>}</>);
    onClose();
  };
  return (
    <Shell title="סופקה חלקית" sub={<>הזמנה <Ltr>{o.id}</Ltr> · {o.customerName}</>} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="sdialog__form">
        <label className="field">
          <span className="field__label">מה סופק בפועל, או מה חסר <span className="req">חובה</span></span>
          <textarea className="input cform__ta" rows={3} autoFocus value={what} onChange={(e) => { setWhat(e.target.value); setErr(''); }} placeholder="למשל: סופקו 10 משפחתיות מתוך 12, בלי השתייה" aria-invalid={!!err && !what.trim()} />
        </label>
        <label className="field">
          <span className="field__label">סכום לחיוב אחרי העדכון (₪)</span>
          <input className="input input--ltr sdialog__money" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setErr(''); }} />
          <span className="field__hint">היה <Ltr>{fmtMoney(o.amount)}</Ltr>{o.qNumber && <> · ב-Q: <Ltr>{fmtMoney(o.qAmount ?? o.amount)}</Ltr></>}</span>
        </label>
        {o.qNumber && next !== (o.qAmount ?? o.amount) && (
          <p className="sdialog__warn"><CircleAlert size={16} aria-hidden="true" /> הסכום שונה ממה שרשום ב-Q (<Ltr>{o.qNumber}</Ltr>). זכור לעדכן גם בקופה.</p>
        )}
        {err && <p className="cform__err" role="alert">{err}</p>}
        <div className="udialog__actions">
          <Button variant="primary" type="submit">סמן סופקה חלקית</Button>
          <Button variant="ghost" type="button" onClick={onClose}>ביטול</Button>
        </div>
      </form>
    </Shell>
  );
}

function CancelDialog({ onClose }: { onClose: () => void }) {
  const { closing, update } = useStore();
  const { lists } = useLists();
  const o = closing!.order;
  const reasons = (lists?.cancelReasons ?? []).filter((r) => r.active);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const isOther = reason === 'other' || reasons.find((r) => r.id === reason)?.label === 'אחר';
  const save = () => {
    if (!reason) return setErr('חובה: סיבת הביטול');
    if (isOther && !note.trim()) return setErr('בסיבה "אחר" צריך לפרט');
    if (CARD_RE.test(note)) return setErr('אסור לרשום כאן מספר כרטיס אשראי');
    const label = reasons.find((r) => r.id === reason)?.label ?? reason;
    update(o.id, { status: 'cancelled', payment: 'cancelled', cancelReason: label, ...(note.trim() ? { cancelNote: note.trim() } : {}) },
      <>הזמנה <Ltr>{o.id}</Ltr> בוטלה · {label}</>);
    onClose();
  };
  return (
    <Shell title="ביטול הזמנה" sub={<>הזמנה <Ltr>{o.id}</Ltr> · {o.customerName}</>} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="sdialog__form">
        {o.qNumber && (
          <p className="sdialog__warn sdialog__warn--strong"><CircleAlert size={16} aria-hidden="true" /> ההזמנה כבר הועברה ל-Q (<Ltr>{o.qNumber}</Ltr>). צריך לבטל אותה גם בקופה.</p>
        )}
        <fieldset className="sdialog__reasons">
          <legend className="field__label">סיבת הביטול <span className="req">חובה</span></legend>
          <div className="sdialog__grid">
          {reasons.map((r, i) => (
            <label key={r.id} className={`sdialog__reason ${reason === r.id ? 'is-on' : ''}`}>
              <input type="radio" name="cancel-reason" value={r.id} checked={reason === r.id} autoFocus={i === 0} onChange={() => { setReason(r.id); setErr(''); }} />
              {r.label}
            </label>
          ))}
          </div>
        </fieldset>
        <label className="field">
          <span className="field__label">פירוט {isOther ? <span className="req">חובה</span> : <span className="req">לא חובה</span>}</span>
          <input className="input" value={note} onChange={(e) => { setNote(e.target.value); setErr(''); }} placeholder="למשל: האירוע נדחה לשבוע הבא" />
        </label>
        {err && <p className="cform__err" role="alert">{err}</p>}
        <div className="udialog__actions">
          <Button variant="danger" type="submit">בטל את ההזמנה</Button>
          <Button variant="ghost" type="button" onClick={onClose}>חזרה</Button>
        </div>
      </form>
    </Shell>
  );
}
