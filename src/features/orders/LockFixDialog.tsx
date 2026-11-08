/* תיקון בחודש נעול (אפיון 7): סכום, תאריך, סטטוס או תשלום של הזמנה מחודש סגור משתנים רק עם סיבה.
   התיקון נשמר, מסומן "תיקון לאחר סגירה" בתיק ובמסך סגירת החודש, ונרשם ביומן עם הסיבה. */
import { useState, type FormEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Lock, X } from 'lucide-react';
import { useStore } from '../../data/store';
import { LOCKED_FIELDS, monthLabel } from '../../data/months';
import { Button } from '../../design/components';
import { Ltr } from '../../lib/format';
import { keepOpenOnToast } from '../../app/ErrorBoundary';
import { FIELD } from './OrderPanel';
import './StatusDialogs.css';

export function LockFixDialog() {
  const { lockFix, confirmLockFix, endLockFix } = useStore();
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  if (!lockFix) return null;
  const fields = [...new Set(Object.keys(lockFix.patch).filter((k) => (LOCKED_FIELDS as string[]).includes(k)).map((k) => FIELD[k] ?? k))].join(', ');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 3) { setErr('חובה: סיבת התיקון (לפחות 3 תווים)'); return; }
    if (/\d{13,}/.test(reason)) { setErr('אסור לרשום כאן מספר כרטיס אשראי'); return; }
    confirmLockFix(reason.trim());
    setReason(''); setErr('');
  };
  const close = () => { endLockFix(); setReason(''); setErr(''); };
  return (
    <Dialog.Root open onOpenChange={(v) => !v && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="cmd-overlay" />
        <Dialog.Content className="udialog sdialog" dir="rtl" aria-describedby="lfix-sub" onPointerDownOutside={keepOpenOnToast} onInteractOutside={keepOpenOnToast}>
          <form onSubmit={submit}>
            <div className="sdialog__head">
              <Dialog.Title className="udialog__title"><Lock size={17} aria-hidden="true" style={{ verticalAlign: -2 }} /> תיקון בחודש סגור</Dialog.Title>
              <Dialog.Close asChild><button type="button" className="icon-btn" aria-label="סגור"><X size={18} /></button></Dialog.Close>
            </div>
            <p id="lfix-sub" className="sdialog__sub">
              {lockFix.ids.length === 1 ? <>הזמנה <Ltr>{lockFix.ids[0]}</Ltr></> : <><Ltr>{lockFix.ids.length}</Ltr> הזמנות</>} שייכת לחודש <Ltr>{lockFix.months.map(monthLabel).join(', ')}</Ltr>, שכבר נסגר.
              {' '}השינוי ({fields}) יסומן "תיקון לאחר סגירה" בדוח החודש.
            </p>
            <label className="cform__field">
              <span className="field__label">סיבת התיקון<span className="req">חובה</span></span>
              <textarea className="input cform__ta" rows={2} autoFocus value={reason} onChange={(e) => { setReason(e.target.value); setErr(''); }} placeholder="למשל: זיכוי שאושר מול הלקוח אחרי הסגירה" aria-invalid={!!err} aria-describedby={err ? 'lfix-err' : undefined} />
              {err && <span className="cform__err" id="lfix-err" role="alert">{err}</span>}
            </label>
            <div className="udialog__actions">
              <Button variant="primary" type="submit">שמור תיקון</Button>
              <Button variant="ghost" type="button" onClick={close}>ביטול</Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
