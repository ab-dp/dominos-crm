/* שינוי אחרי הקלדה ל-Q (אפיון 4.5, 8): שינוי בשדה רגיש בהזמנה שכבר הוקלדה ל-Q או נסגרה (isLocked ב-store).
   לפני השמירה: מה משתנה, והאם לעדכן גם ב-Q. ההזמנה מקבלת תג "שונתה אחרי הקלדה ל-Q" (changedAfterQ) עם הערכים לפני השינוי.
   הסימון הישן changedAfterApproval לא נכתב יותר – נשאר מוצג בהזמנות ישנות. */
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CircleAlert, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { SENSITIVE, useStore } from '../../data/store';
import type { Order } from '../../data/types';
import { Button } from '../../design/components';
import { Ltr } from '../../lib/format';
import { keepOpenOnToast } from '../../app/ErrorBoundary';
import { FIELD, showVal } from './OrderPanel';
import './StatusDialogs.css';

export function ChangeDialog() {
  const { changeReq, endChange } = useStore();
  if (!changeReq) return null;
  return <ChangeForm key={changeReq.order.id} onClose={endChange} />;
}

function ChangeForm({ onClose }: { onClose: () => void }) {
  const { changeReq, update } = useStore();
  const { profile } = useAuth();
  const { order: o, patch, what, base } = changeReq!;
  const keys = (Object.keys(patch) as (keyof Order)[]).filter((k) => JSON.stringify(o[k]) !== JSON.stringify(patch[k]));
  const sensitive = keys.filter((k) => SENSITIVE.includes(k));
  const [flagQ, setFlagQ] = useState(!!o.qNumber);

  const save = () => {
    // התוצאה עוברת לשמירה עצמה; סגירת החלון אחרי זה לא תדווח "בוטל"
    const done = changeReq!.done;
    changeReq!.done = undefined;
    const prevBefore = o.changedAfterQ?.before ?? {};
    const before = { ...Object.fromEntries(sensitive.map((k) => [k, o[k] ?? null])), ...prevBefore }; // נשמרים הערכים כפי שהיו לפני השינוי הראשון
    const fields = [...new Set([...(o.changedAfterQ?.fields ?? []), ...sensitive.map(String)])];
    update(o.id, {
      ...patch,
      changedAfterQ: { at: new Date().toISOString(), by: profile?.name ?? '', fields, before },
      ...(flagQ ? { qNeedsUpdate: true } : {}),
    }, <>שינוי אחרי הקלדה ל-Q נשמר: {what} · הזמנה <Ltr>{o.id}</Ltr></>, base, done);
    onClose();
  };

  return (
    <Dialog.Root open onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="cmd-overlay" />
        <Dialog.Content className="udialog sdialog chdialog" dir="rtl" aria-describedby="chdialog-sub" onPointerDownOutside={keepOpenOnToast} onInteractOutside={keepOpenOnToast}>
          <div className="sdialog__head">
            <Dialog.Title className="udialog__title">{o.qNumber ? 'ההזמנה כבר הוקלדה ל-Q – מה צריך לעדכן?' : 'ההזמנה כבר נסגרה – לשמור את השינוי?'}</Dialog.Title>
            <Dialog.Close asChild><button className="icon-btn" aria-label="סגור בלי לשמור"><X size={16} /></button></Dialog.Close>
          </div>
          <p id="chdialog-sub" className="sdialog__sub">הזמנה <Ltr>{o.id}</Ltr> · {o.customerName}</p>

          <ul className="chdialog__diff">
            {sensitive.map((k) => (
              <li key={String(k)}>
                <span>{FIELD[String(k)] ?? String(k)}</span>
                <span className="chdialog__from">{showVal(String(k), o[k])}</span>
                <span aria-hidden="true">←</span>
                <b>{showVal(String(k), patch[k])}</b>
              </li>
            ))}
          </ul>

          {o.qNumber && (
            <fieldset className="chdialog__opts">
              <legend className="field__label">בעקבות השינוי</legend>
              <label className="chdialog__opt">
                <input type="checkbox" checked={flagQ} onChange={(e) => setFlagQ(e.target.checked)} />
                <span>
                  <b>לעדכן את השינוי גם ב-Q</b>
                  <small>הזמנה <Ltr>{o.qNumber}</Ltr> בקופה. עד שמסמנים "עודכן ב-Q" תופיע משימה במסך החריגים.</small>
                </span>
              </label>
            </fieldset>
          )}

          <p className="sdialog__warn"><CircleAlert size={16} aria-hidden="true" /> ההזמנה תסומן "שונתה אחרי הקלדה ל-Q", עם הערכים לפני השינוי. השינוי נרשם ביומן.</p>
          <div className="udialog__actions">
            <Button variant="primary" onClick={save}>שמור את השינוי</Button>
            <Button variant="ghost" onClick={onClose}>ביטול</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
