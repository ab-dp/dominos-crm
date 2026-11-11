/* מיזוג לקוח כפול (אפיון 6.5), בשני צעדים: בוחרים לאיזה לקוח למזג, ואז רואים בדיוק מה יעבור.
   שדה ששני הלקוחות מילאו אחרת מוצג כבחירה – שום פרט לא נעלם בשקט. הפעולה נרשמת ביומן. */
import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, GitMerge } from 'lucide-react';
import {
  mergeCounts, mergeCustomers, mergeDiffs, mergedFields, primaryContact,
  type Customer, type MergeChoice, type MergeCounts, type MergeDiff, type MergeField,
} from '../../data/customers';
import { useLists } from '../../data/lists';
import { usePriceLists } from '../../data/priceLists';
import { METHOD_LABEL } from '../../data/types';
import { Button, Field } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, fmtPhone } from '../../lib/format';
import { isSimilar } from '../../lib/names';

const LABEL: Record<MergeField, string> = {
  type: 'סוג לקוח', taxId: 'ח.פ', businessAddress: 'כתובת עסק', paymentMethod: 'אמצעי תשלום', accountPhone: 'טלפון הקפה', poRequired: 'תעודת רכש',
  priceListId: 'מחירון', priceNote: 'הערת מחיר', instructions: 'הנחיות קבועות', billingInstructions: 'הנחיות חיוב',
};
const one = (n: number, single: string, many: string) => (n === 1 ? single : `${n} ${many}`);

export function MergeDialog({ source, all, onClose, onMerged }: { source: Customer; all: Customer[]; onClose: () => void; onMerged: (target: Customer) => void }) {
  const toast = useToast();
  const { lists } = useLists();
  const { items: priceLists } = usePriceLists();
  const [q, setQ] = useState('');
  const [target, setTarget] = useState<Customer | null>(null);
  const [choice, setChoice] = useState<MergeChoice>({});
  const [counts, setCounts] = useState<MergeCounts | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const candidates = all.filter((c) => c.id !== source.id && c.status !== 'merged');
  const suggested = candidates.filter((c) => isSimilar(c.name, source.name) || (source.taxId && c.taxId === source.taxId));
  const list = (q.trim() ? candidates.filter((c) => c.name.includes(q.trim()) || c.taxId.includes(q.replace(/\D/g, '') || '~')) : suggested).slice(0, 8);

  // כמה הזמנות, הצעות, משימות ומסמכים רשומים על הלקוח הכפול
  useEffect(() => {
    let alive = true;
    mergeCounts(source.id).then((c) => { if (alive) setCounts(c); }).catch(() => { if (alive) setCounts({ orders: 0, quotes: 0, tasks: 0, docs: 0 }); });
    return () => { alive = false; };
  }, [source.id]);

  const show = (field: MergeField, v: string | boolean) => {
    if (field === 'poRequired') return v ? 'נדרשת' : 'לא נדרשת';
    if (field === 'type') return v === 'regular' ? 'קבוע' : 'מזדמן';
    if (field === 'paymentMethod') return lists?.paymentMethods.find((m) => m.id === v)?.label ?? METHOD_LABEL[String(v)] ?? String(v);
    if (field === 'priceListId') return priceLists.find((p) => p.id === v)?.name ?? 'מחירון שנמחק';
    if (field === 'accountPhone') return <Ltr>{fmtPhone(String(v))}</Ltr>;
    if (field === 'taxId') return <Ltr>{String(v)}</Ltr>;
    return String(v);
  };

  const diffs: MergeDiff[] = target ? mergeDiffs(source, target) : [];
  const conflicts = diffs.filter((d) => d.kind === 'conflict');
  const fills = diffs.filter((d) => d.kind === 'fill');
  const m = target ? mergedFields(source, target, choice) : null;
  const moving = counts && m ? [
    counts.orders && one(counts.orders, 'הזמנה אחת', 'הזמנות'), counts.quotes && one(counts.quotes, 'הצעת מחיר אחת', 'הצעות מחיר'),
    counts.tasks && one(counts.tasks, 'משימה פתוחה אחת', 'משימות פתוחות'), m.addedContacts && one(m.addedContacts, 'איש קשר אחד', 'אנשי קשר'),
    m.addedAddresses && one(m.addedAddresses, 'כתובת אחת', 'כתובות'), counts.docs && one(counts.docs, 'מסמך אחד', 'מסמכים'),
  ].filter(Boolean) as string[] : [];

  const run = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await mergeCustomers(source, target, note.trim(), choice);
      toast({ message: <>"{source.name}" מוזג לתוך "{target.name}"</> });
      onMerged(target);
    } catch (e) {
      const big = e instanceof Error && e.message === 'merge-too-big';
      toast({ tone: 'error', message: big ? 'יחד יש יותר מ-30 אנשי קשר או כתובות. מחק כפולים באחד הלקוחות ונסה שוב – שום דבר לא עבר.' : 'המיזוג לא הושלם – בדוק חיבור ונסה שוב. מה שכבר עבר נשאר אצל הלקוח שנבחר.' });
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="cmd-overlay" />
        <Dialog.Content className={`udialog merge ${target ? 'merge--review' : ''}`} dir="rtl" aria-describedby="merge-desc">
          <Dialog.Title className="udialog__title"><GitMerge size={18} aria-hidden="true" style={{ verticalAlign: -3 }} /> מיזוג לקוח כפול</Dialog.Title>
          <p id="merge-desc" className="muted">"{source.name}" ייסגר, וכל מה שרשום עליו יעבור ללקוח שתבחר. אי אפשר לבטל מיזוג.</p>

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
                      <button onClick={() => { setTarget(c); setChoice({}); }}>
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
            <div className="merge__review">
              <div className="merge__preview">
                <span className="merge__from">{source.name}</span>
                <ArrowLeft size={18} aria-hidden="true" />
                <span className="merge__to">{target.name}</span>
              </div>

              <section aria-labelledby="merge-moving">
                <h3 id="merge-moving" className="merge__h">מה יעבור</h3>
                <p className="merge__line" aria-live="polite">{!counts ? 'בודק…' : moving.length ? moving.join(' · ') : 'אין הזמנות, הצעות, משימות או אנשי קשר להעביר.'}</p>
                {fills.length > 0 && (
                  <dl className="merge__fills">
                    {fills.map((d) => <div key={d.field}><dt>{LABEL[d.field]}</dt><dd>{show(d.field, d.source)}</dd></div>)}
                  </dl>
                )}
                <p className="merge__sub">הפעילות, ההיסטוריה והמסמכים של "{source.name}" יוצגו בתיק של "{target.name}".</p>
              </section>

              {conflicts.length > 0 && (
                <section aria-labelledby="merge-conf">
                  <h3 id="merge-conf" className="merge__h">פרטים שונים – בחר מה נשאר</h3>
                  <div className="merge__conflicts">
                    {conflicts.map((d) => {
                      const picked = choice[d.field] ?? d.def;
                      return (
                        <fieldset key={d.field} className="merge__conflict">
                          <legend>{LABEL[d.field]}</legend>
                          {(['target', 'source'] as const).map((side) => (
                            <label key={side} className={picked === side ? 'is-on' : ''}>
                              <input type="radio" name={`merge-${d.field}`} checked={picked === side} onChange={() => setChoice((c) => ({ ...c, [d.field]: side }))} />
                              <span className="merge__val">{show(d.field, d[side])}</span>
                              <span className="merge__who">{side === 'target' ? target.name : source.name}</span>
                            </label>
                          ))}
                        </fieldset>
                      );
                    })}
                  </div>
                  {conflicts.some((d) => d.field === 'priceListId') && <p className="merge__sub">המחירים הייחודיים נשארים יחד עם המחירון שנבחר.</p>}
                </section>
              )}

              <Field label="סיבה (לא חובה)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="נפתח פעמיים בטעות" /></Field>
              <div className="udialog__actions">
                <Button variant="primary" loading={busy} disabled={!counts} onClick={run}>מזג לתוך {target.name}</Button>
                <Button variant="ghost" autoFocus onClick={() => setTarget(null)}>בחר לקוח אחר</Button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
