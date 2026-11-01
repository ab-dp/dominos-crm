/* שמירה שהתנגשה (אפיון 8): מישהו אחר שינה את אותו שדה בזמן שערכת. מוצגת השוואה – מה היה, מה הוא שמר, מה אתה רצית –
   ובוחרים מה להשאיר. שום דבר לא נדרס בלי החלטה. */
import * as Dialog from '@radix-ui/react-dialog';
import { GitCompareArrows, X } from 'lucide-react';
import { useStore } from '../../data/store';
import { Button } from '../../design/components';
import { Ltr } from '../../lib/format';
import { keepOpenOnToast } from '../../app/ErrorBoundary';
import { FIELD, showVal } from './OrderPanel';
import './StatusDialogs.css';

export function ConflictDialog() {
  const { conflict, resolveConflict } = useStore();
  if (!conflict) return null;
  const { error } = conflict;
  const who = error.byName || 'משתמש אחר';
  return (
    <Dialog.Root open onOpenChange={(v) => !v && resolveConflict(false)}>
      <Dialog.Portal>
        <Dialog.Overlay className="cmd-overlay" />
        <Dialog.Content className="udialog sdialog cdialog" dir="rtl" aria-describedby="cdialog-sub" onPointerDownOutside={keepOpenOnToast} onInteractOutside={keepOpenOnToast}>
          <div className="sdialog__head">
            <Dialog.Title className="udialog__title"><GitCompareArrows size={18} aria-hidden="true" style={{ verticalAlign: -3 }} /> {who} שינה את ההזמנה בינתיים</Dialog.Title>
            <Dialog.Close asChild><button className="icon-btn" aria-label="סגור"><X size={18} /></button></Dialog.Close>
          </div>
          <p id="cdialog-sub" className="sdialog__sub">הזמנה <Ltr>{error.current.id}</Ltr> · השינוי שלך עוד לא נשמר. בחר מה להשאיר:</p>
          <table className="cdialog__table">
            <thead><tr><th>שדה</th><th>היה</th><th>{who} שמר</th><th>אתה רצית</th></tr></thead>
            <tbody>
              {error.fields.map((f) => (
                <tr key={String(f.key)}>
                  <th scope="row">{FIELD[String(f.key)] ?? String(f.key)}</th>
                  <td className="cdialog__base">{showVal(String(f.key), f.base)}</td>
                  <td className="cdialog__theirs">{showVal(String(f.key), f.theirs)}</td>
                  <td className="cdialog__mine">{showVal(String(f.key), f.mine)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="udialog__actions">
            <Button variant="primary" autoFocus onClick={() => resolveConflict(false)}>השאר את השינוי של {who}</Button>
            <Button variant="secondary" onClick={() => resolveConflict(true)}>שמור את שלי במקום</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
