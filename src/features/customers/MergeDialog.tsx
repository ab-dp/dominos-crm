/* מיזוג לקוחות (אפיון 6.5): כל ההזמנות עוברות ללקוח אחד, עם אישור ותיעוד ביומן. */
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, GitMerge } from 'lucide-react';
import { mergeCustomers, primaryContact, type Customer } from '../../data/customers';
import { Button, Field } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, fmtPhone } from '../../lib/format';
import { isSimilar } from '../../lib/names';

export function MergeDialog({ source, all, onClose, onMerged }: { source: Customer; all: Customer[]; onClose: () => void; onMerged: (target: Customer) => void }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [target, setTarget] = useState<Customer | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const candidates = all.filter((c) => c.id !== source.id && c.status !== 'merged');
  const suggested = candidates.filter((c) => isSimilar(c.name, source.name) || (source.taxId && c.taxId === source.taxId));
  const list = (q.trim() ? candidates.filter((c) => c.name.includes(q.trim()) || c.taxId.includes(q.replace(/\D/g, '') || '~')) : suggested).slice(0, 8);

  const run = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await mergeCustomers(source, target, note.trim());
      toast({ message: <>"{source.name}" מוזג לתוך "{target.name}"</> });
      onMerged(target);
    } catch { toast({ message: 'המיזוג נכשל' }); setBusy(false); }
  };

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="cmd-overlay" />
        <Dialog.Content className="udialog merge" dir="rtl" aria-describedby="merge-desc">
          <Dialog.Title className="udialog__title"><GitMerge size={18} aria-hidden="true" style={{ verticalAlign: -3 }} /> מיזוג לקוח כפול</Dialog.Title>
          <p id="merge-desc" className="muted">"{source.name}" ייסגר, ואנשי הקשר, הכתובות וההזמנות שלו יעברו ללקוח שתבחר. הפעולה נרשמת ביומן.</p>

          {!target ? (
            <>
              <Field label="לאיזה לקוח למזג?">
                <input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש לפי שם או ח.פ" />
              </Field>
              {!q && suggested.length > 0 && <p className="merge__hint">לקוחות דומים שמצאנו:</p>}
              <ul className="merge__list">
                {list.map((c) => {
                  const pc = primaryContact(c);
                  return (
                    <li key={c.id}>
                      <button onClick={() => setTarget(c)}>
                        <b>{c.name}</b>
                        <span className="muted">{c.taxId && <>ח.פ <Ltr>{c.taxId}</Ltr> · </>}{pc?.phone && <Ltr>{fmtPhone(pc.phone)}</Ltr>}</span>
                      </button>
                    </li>
                  );
                })}
                {list.length === 0 && <li className="muted merge__none">{q ? 'לא נמצא לקוח' : 'הקלד שם כדי לחפש'}</li>}
              </ul>
            </>
          ) : (
            <>
              <div className="merge__preview">
                <span className="merge__from">{source.name}</span>
                <ArrowLeft size={18} aria-hidden="true" />
                <span className="merge__to">{target.name}</span>
              </div>
              <Field label="סיבה (לא חובה)"><input className="input" autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="נפתח פעמיים בטעות" /></Field>
              <div className="udialog__actions">
                <Button variant="primary" loading={busy} onClick={run}>מזג</Button>
                <Button variant="ghost" onClick={() => setTarget(null)}>בחר לקוח אחר</Button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
