/* "תיעוד טיפול" בתחתית כרטיס ההזמנה: שורה אחת – "N תיעודים ›" שנפתחת לרשימה, ו"הוסף תיעוד".
   כשההזמנה באיחור או חלקית ועוד לא תועדה – השורה בולטת. מוסיפים רק אחרי סימון סטטוס אספקה (סופקה / חלקית).
   "הוסף תיעוד" פותח חלון נפרד "תיעוד שיחה על הזמנה": פרטי ההזמנה נעולים, נושא, תאריך השיחה, מה נעשה, ופיצוי.
   רשומה אחת בתיק הלקוח (data/care.ts) שמוצגת בשני המקומות – כאן ובציר הזמן של הלקוח. */
import { useState, type FormEvent } from 'react';
import { ChevronLeft, ClipboardPen, Plus } from 'lucide-react';
import type { OrderView } from '../../data/store';
import { addCare, canAddCare, compHasAmount, needsCare, noComp, suggestTopicId, useOrderCare } from '../../data/care';
import { DEFAULT_LISTS, useLists } from '../../data/lists';
import { closeLabel } from '../../data/types';
import { Button } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, cleanAmount, fmtDate, fmtMoney, toISODate } from '../../lib/format';
import { saveError } from '../../lib/saveError';
import { CARD_RE } from '../../lib/names';
import { Shell } from '../leads/LeadDialogs';
import './Care.css';

const fmtAt = (d: Date) => `${fmtDate(toISODate(d))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function CareSection({ o }: { o: OrderView }) {
  const items = useOrderCare(o.customerId, o.id);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const hint = needsCare(o) && items?.length === 0;
  const n = items?.length ?? o.careCount ?? 0;
  const canAdd = canAddCare(o);
  return (
    <section className={`care ${hint ? 'is-hint' : ''}`} aria-labelledby="h-care">
      <div className="care__head">
        <h3 id="h-care" className="care__title"><ClipboardPen size={16} aria-hidden="true" /> תיעוד טיפול</h3>
        {n > 0 ? (
          <button type="button" className="care__toggle" aria-expanded={open} aria-controls={`care-list-${o.id}`} onClick={() => setOpen(!open)}>
            <Ltr>{n}</Ltr> {n === 1 ? 'תיעוד שיחה' : 'תיעודי שיחה'} על ההזמנה <ChevronLeft size={16} aria-hidden="true" className="care__chev" />
          </button>
        ) : hint ? (
          <span className="care__hint">{o.status === 'partial' ? 'סופקה חלקית' : 'סופקה באיחור'} – עוד לא תועד</span>
        ) : <span className="care__none">אין עדיין</span>}
        {canAdd && <Button size="sm" variant={hint ? 'primary' : 'secondary'} icon={<Plus size={16} />} onClick={() => setAdding(true)}>הוסף תיעוד</Button>}
      </div>
      {open && !!items?.length && (
        <ol className="care__list" id={`care-list-${o.id}`}>
          {items.map((a) => (
            <li key={a.id} className="care__item">
              <span className="care__tags">
                {a.topic && <span className="care__topic">{a.topic}</span>}
                {!noComp(a) && <span className="care__comp">פיצוי: {a.comp}{a.compAmount ? <> · <Ltr>{fmtMoney(a.compAmount)}</Ltr></> : null}</span>}
              </span>
              <span className="care__text">{a.text}</span>
              <span className="care__meta">{a.byName}{a.callAt && <> · שיחה ב-<Ltr>{fmtDate(a.callAt)}</Ltr></>} · נרשם <Ltr>{a.at ? fmtAt(a.at.toDate()) : '…'}</Ltr></span>
            </li>
          ))}
        </ol>
      )}
      {adding && <CareDialog o={o} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); setOpen(true); }} />}
    </section>
  );
}

function CareDialog({ o, onClose, onSaved }: { o: OrderView; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { lists } = useLists();
  const topics = (lists?.careTopics ?? DEFAULT_LISTS.careTopics).filter((t) => t.active);
  const comps = (lists?.careComps ?? DEFAULT_LISTS.careComps).filter((c) => c.active);
  const today = toISODate(new Date());
  const [topicId, setTopicId] = useState(() => suggestTopicId(o, topics));
  const [callAt, setCallAt] = useState(today);
  const [text, setText] = useState('');
  const [compId, setCompId] = useState('none'); // "ללא" נעול ותמיד קיים
  const [amount, setAmount] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const topic = topics.find((t) => t.id === topicId);
  const comp = comps.find((c) => c.id === compId);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!topic) { setErr('בחרו נושא'); return; }
    if (!callAt || callAt > today) { setErr('תאריך השיחה – היום או קודם'); return; }
    if (!text.trim()) { setErr('חובה: מה נאמר ואיך טיפלנו'); return; }
    if (CARD_RE.test(text)) { setErr('אסור לרשום כאן מספר כרטיס אשראי'); return; }
    const compAmount = comp && compHasAmount(comp.id) && amount.trim() ? Number(cleanAmount(amount)) || undefined : undefined;
    setBusy(true);
    try {
      await addCare(o, { topic: topic.label, text, comp: comp?.label ?? 'ללא', compId: comp?.id ?? 'none', compAmount, callAt });
      toast({ message: <>התיעוד נשמר בתיק הלקוח · הזמנה <Ltr>{o.id}</Ltr></> });
      onSaved();
    } catch (x) { setErr(`${saveError(x)} – התיעוד לא נשמר`); setBusy(false); }
  };
  return (
    <Shell title="תיעוד שיחה על הזמנה" sub="תיעוד שיחה עם הלקוח על ההזמנה הזו. נשמר גם בתיק הלקוח." onClose={onClose}>
      <form className="sdialog__form care-form" onSubmit={submit} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit(e); } }}>
        <dl className="care-form__order" aria-label="פרטי ההזמנה">
          <div><dt>הזמנה</dt><dd><Ltr>{o.id}</Ltr></dd></div>
          <div><dt>תאריך</dt><dd><Ltr>{fmtDate(o.date)}</Ltr></dd></div>
          <div><dt>סניף</dt><dd>{o.branchName || '—'}</dd></div>
          <div><dt>אספקה</dt><dd>{closeLabel(o)}</dd></div>
          <div><dt>סכום</dt><dd><Ltr>{fmtMoney(o.qAmount ?? o.amount)}</Ltr></dd></div>
        </dl>
        <div className="care-form__f">
          <span className="care-form__k" id={`ct-${o.id}`}>נושא</span>
          <div className="chips" role="radiogroup" aria-labelledby={`ct-${o.id}`}>
            {topics.map((t) => <button type="button" key={t.id} role="radio" aria-checked={topicId === t.id} className={`chip ${topicId === t.id ? 'is-on' : ''}`} onClick={() => { setTopicId(t.id); setErr(''); }}>{t.label}</button>)}
          </div>
        </div>
        <label className="care-form__f care-form__date">
          <span className="care-form__k">תאריך השיחה</span>
          <input type="date" className="input input--sm" max={today} value={callAt} aria-invalid={!callAt || callAt > today || undefined} onChange={(e) => { setCallAt(e.target.value); setErr(''); }} />
        </label>
        <label className="care-form__f">
          <span className="care-form__k">מה נאמר ואיך טיפלנו</span>
          <textarea className="input care-form__ta" rows={3} value={text} data-autofocus onChange={(e) => { setText(e.target.value); setErr(''); }}
            placeholder="למשל: הלקוח התלונן על איחור של 40 דק', התנצלתי וסיכמנו 10% הנחה בהזמנה הבאה" aria-invalid={!!err || undefined} />
        </label>
        <div className="care-form__f">
          <span className="care-form__k" id={`cc-${o.id}`}>פיצוי</span>
          <div className="care-form__comp">
            <div className="chips" role="radiogroup" aria-labelledby={`cc-${o.id}`}>
              {comps.map((c) => <button type="button" key={c.id} role="radio" aria-checked={compId === c.id} className={`chip ${compId === c.id ? 'is-on' : ''}`} onClick={() => setCompId(c.id)}>{c.label}</button>)}
            </div>
            {comp && compHasAmount(comp.id) && (
              <label className="care-form__amt">סכום (₪, לא חובה) <input className="input input--sm input--ltr" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            )}
          </div>
        </div>
        {err && <p className="cform__err" role="alert">{err}</p>}
        <div className="udialog__actions">
          <Button variant="primary" type="submit" loading={busy} kbd="Ctrl+Enter">שמור בתיק הלקוח</Button>
          <Button variant="ghost" type="button" onClick={onClose}>ביטול</Button>
        </div>
      </form>
    </Shell>
  );
}
