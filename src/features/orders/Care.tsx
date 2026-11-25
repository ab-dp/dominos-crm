/* "תיעוד טיפול" בכרטיס של הזמנה שנסגרה: איך טיפלנו בלקוח (איחור, חוסר, טעות…) – נושא, מה עשינו, ופיצוי אם היה.
   נשמר בתיק הלקוח עם מספר ההזמנה ופרטיה (data/care.ts); כאן מוצגים התיעודים של ההזמנה הזו ואפשר להוסיף. */
import { useState, type FormEvent } from 'react';
import { ClipboardPen, Plus } from 'lucide-react';
import type { OrderView } from '../../data/store';
import { CARE_COMP, CARE_TOPICS, addCare, compHasAmount, needsCare, suggestTopic, useOrderCare } from '../../data/care';
import { Button } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, cleanAmount, fmtDate, fmtMoney, toISODate } from '../../lib/format';
import { saveError } from '../../lib/saveError';
import './Care.css';
import { CARD_RE } from '../../lib/names';

const fmtAt = (d: Date) => `${fmtDate(toISODate(d))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function CareSection({ o }: { o: OrderView }) {
  const items = useOrderCare(o.customerId, o.id);
  const [adding, setAdding] = useState(false);
  const hint = needsCare(o) && items?.length === 0;
  return (
    <section className={`care ${hint ? 'is-hint' : ''}`} aria-labelledby="h-care">
      <div className="care__head">
        <h3 id="h-care" className="care__title"><ClipboardPen size={16} aria-hidden="true" /> תיעוד טיפול{!!items?.length && <span className="care__n"><Ltr>{items.length}</Ltr></span>}</h3>
        {!adding && <Button size="sm" variant={hint ? 'primary' : 'secondary'} icon={<Plus size={16} />} onClick={() => setAdding(true)}>הוסף תיעוד</Button>}
      </div>
      {hint && !adding && <p className="care__hint">{o.status === 'partial' ? 'סופקה חלקית' : 'סופקה באיחור'} – כדאי לתעד איך טיפלנו בלקוח. התיעוד נשמר בתיק הלקוח.</p>}
      {adding && <CareForm o={o} done={() => setAdding(false)} />}
      {!!items?.length && (
        <ol className="care__list">
          {items.map((a) => (
            <li key={a.id} className="care__item">
              <span className="care__tags">
                {a.topic && <span className="care__topic">{a.topic}</span>}
                {a.comp && a.comp !== 'ללא' && <span className="care__comp">פיצוי: {a.comp}{a.compAmount ? <> · <Ltr>{fmtMoney(a.compAmount)}</Ltr></> : null}</span>}
              </span>
              <span className="care__text">{a.text}</span>
              <span className="care__meta">{a.byName} · <Ltr>{a.at ? fmtAt(a.at.toDate()) : '…'}</Ltr></span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function CareForm({ o, done }: { o: OrderView; done: () => void }) {
  const toast = useToast();
  const [topic, setTopic] = useState(suggestTopic(o));
  const [text, setText] = useState('');
  const [comp, setComp] = useState(CARE_COMP[0]);
  const [amount, setAmount] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) { setErr('חובה: איך טיפלנו בלקוח'); return; }
    if (CARD_RE.test(text)) { setErr('אסור לרשום כאן מספר כרטיס אשראי'); return; }
    const compAmount = compHasAmount(comp) && amount.trim() ? Number(cleanAmount(amount)) || undefined : undefined;
    setBusy(true);
    try {
      await addCare(o, { topic, text, comp, compAmount });
      toast({ message: <>תיעוד הטיפול נשמר בתיק הלקוח · הזמנה <Ltr>{o.id}</Ltr></> });
      done();
    } catch (x) { setErr(`${saveError(x)} – התיעוד לא נשמר`); setBusy(false); }
  };
  return (
    <form className="care-form" onSubmit={submit} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit(e); } }}>
      <div className="care-form__f">
        <span className="care-form__k" id={`ct-${o.id}`}>נושא</span>
        <div className="chips" role="radiogroup" aria-labelledby={`ct-${o.id}`}>
          {CARE_TOPICS.map((t) => <button type="button" key={t} role="radio" aria-checked={topic === t} className={`chip ${topic === t ? 'is-on' : ''}`} onClick={() => setTopic(t)}>{t}</button>)}
        </div>
      </div>
      <label className="care-form__f">
        <span className="care-form__k">איך טיפלנו</span>
        <textarea className="input care-form__ta" rows={3} value={text} autoFocus onChange={(e) => { setText(e.target.value); setErr(''); }}
          placeholder="למשל: התקשרתי ללקוח והתנצלתי, הסניף הסביר שהיה עומס, סיכמנו 10% הנחה בהזמנה הבאה" aria-invalid={!!err || undefined} />
      </label>
      <div className="care-form__f">
        <span className="care-form__k" id={`cc-${o.id}`}>פיצוי</span>
        <div className="care-form__comp">
          <div className="chips" role="radiogroup" aria-labelledby={`cc-${o.id}`}>
            {CARE_COMP.map((c) => <button type="button" key={c} role="radio" aria-checked={comp === c} className={`chip ${comp === c ? 'is-on' : ''}`} onClick={() => setComp(c)}>{c}</button>)}
          </div>
          {compHasAmount(comp) && (
            <label className="care-form__amt">סכום (₪, לא חובה) <input className="input input--sm input--ltr" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          )}
        </div>
      </div>
      {err && <p className="pop__err" role="alert">{err}</p>}
      <div className="care-form__btns">
        <Button size="sm" variant="primary" type="submit" loading={busy} kbd="Ctrl+Enter">שמור בתיק הלקוח</Button>
        <button type="button" className="link" onClick={done}>ביטול</button>
      </div>
    </form>
  );
}
