/* שינוי אחרי אישור (אפיון 4.5, 8): שינוי בשדה רגיש בהזמנה שכבר אושרה, הועברה ל-Q או אושרה בסניף.
   לפני השמירה: מה משתנה, ומה צריך לעדכן בעקבותיו. אישורים שכבר לא תקפים מסומנים לבדיקה מחדש – לא נמחקים בשקט.
   ההזמנה מקבלת תג "שונתה לאחר אישור" עם הערכים כפי שאושרו. */
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CircleAlert, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { SENSITIVE, useStore } from '../../data/store';
import type { Order } from '../../data/types';
import { Button } from '../../design/components';
import { Ltr, fmtPhone } from '../../lib/format';
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
  const { order: o, patch, what } = changeReq!;
  const keys = (Object.keys(patch) as (keyof Order)[]).filter((k) => JSON.stringify(o[k]) !== JSON.stringify(patch[k]));
  const sensitive = keys.filter((k) => SENSITIVE.includes(k));
  // הסניף צריך לדעת על כל שינוי במועד, במקום, באספקה או בפריטים; שינוי סכום בלבד הוא עניין של חיוב
  const affectsBranch = !!o.branchApproval && sensitive.some((k) => k !== 'amount');
  const affectsQ = !!o.qNumber;
  const [resetBranch, setResetBranch] = useState(affectsBranch);
  const [flagQ, setFlagQ] = useState(affectsQ);
  const [askCustomer, setAskCustomer] = useState(false);
  const branchChanged = keys.includes('branchId');

  const save = () => {
    const prevBefore = o.changedAfterApproval?.before ?? {};
    const before = { ...Object.fromEntries(sensitive.map((k) => [k, o[k] ?? null])), ...prevBefore }; // נשמרים הערכים כפי שאושרו לראשונה
    const fields = [...new Set([...(o.changedAfterApproval?.fields ?? []), ...sensitive.map(String)])];
    update(o.id, {
      ...patch,
      changedAfterApproval: { at: new Date().toISOString(), by: profile?.name ?? '', fields, before },
      ...(resetBranch ? { branchApproval: undefined } : {}),
      ...(flagQ ? { qNeedsUpdate: true } : {}),
      ...(askCustomer && o.status === 'approved' ? { status: 'pending_customer' as const } : {}),
    }, <>שינוי אחרי אישור נשמר: {what} · הזמנה <Ltr>{o.id}</Ltr></>);
    onClose();
  };

  return (
    <Dialog.Root open onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="cmd-overlay" />
        <Dialog.Content className="udialog sdialog chdialog" dir="rtl" aria-describedby="chdialog-sub" onPointerDownOutside={keepOpenOnToast} onInteractOutside={keepOpenOnToast}>
          <div className="sdialog__head">
            <Dialog.Title className="udialog__title">ההזמנה כבר אושרה – מה צריך לעדכן?</Dialog.Title>
            <Dialog.Close asChild><button className="icon-btn" aria-label="סגור בלי לשמור"><X size={18} /></button></Dialog.Close>
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

          <fieldset className="chdialog__opts">
            <legend className="field__label">בעקבות השינוי</legend>
            {o.branchApproval && (
              <label className="chdialog__opt">
                <input type="checkbox" checked={resetBranch} onChange={(e) => setResetBranch(e.target.checked)} />
                <span>
                  <b>אישור הסניף לא תקף – לבקש אישור מחדש</b>
                  <small>אושר ע"י {o.branchApproval.manager}{branchChanged ? ` בסניף ${o.branchName}` : ''}. {!branchChanged && <>להתקשר ל{o.branchName} · <Ltr>{fmtPhone(o.branchPhone)}</Ltr></>}</small>
                </span>
              </label>
            )}
            {o.qNumber && (
              <label className="chdialog__opt">
                <input type="checkbox" checked={flagQ} onChange={(e) => setFlagQ(e.target.checked)} />
                <span>
                  <b>לעדכן את השינוי גם ב-Q</b>
                  <small>הזמנה <Ltr>{o.qNumber}</Ltr> בקופה. עד שמסמנים "עודכן ב-Q" תופיע משימה במסך החריגים.</small>
                </span>
              </label>
            )}
            {o.status === 'approved' && (
              <label className="chdialog__opt">
                <input type="checkbox" checked={askCustomer} onChange={(e) => setAskCustomer(e.target.checked)} />
                <span>
                  <b>לבקש מהלקוח אישור מחדש</b>
                  <small>הסטטוס יחזור ל"ממתינה לאישור לקוח".</small>
                </span>
              </label>
            )}
          </fieldset>

          <p className="sdialog__warn"><CircleAlert size={16} aria-hidden="true" /> ההזמנה תסומן "שונתה לאחר אישור", עם הערכים כפי שאושרו. השינוי נרשם ביומן.</p>
          <div className="udialog__actions">
            <Button variant="primary" onClick={save}>שמור את השינוי</Button>
            <Button variant="ghost" onClick={onClose}>ביטול</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
