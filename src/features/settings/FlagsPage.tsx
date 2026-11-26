/* תצוגה מוקדמת: מתגים לשלבים בסיכון גבוה – כבוי · מנהל בלבד · כולם */
import { useState } from 'react';
import { FLAG_META, saveFlag, useFlags, type FlagMode, type Flags } from '../../data/flags';
import { useToast } from '../../design/Toast';
import '../pages.css';

const MODES: [FlagMode, string][] = [['off', 'כבוי'], ['admin', 'מנהל בלבד'], ['all', 'כולם']];

export function FlagsPage() {
  const flags = useFlags();
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const set = async (k: keyof Flags, m: FlagMode) => {
    if (flags[k] === m) return;
    setBusy(k);
    try { await saveFlag(k, m, flags[k]); toast({ message: `${FLAG_META[k].title}: ${MODES.find(([x]) => x === m)![1]}` }); }
    catch { toast({ tone: 'error', message: 'השמירה נכשלה – בדוק חיבור' }); }
    setBusy('');
  };
  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">תצוגה מוקדמת</h1>
          <p className="page__sub">שינויים גדולים נפתחים קודם למנהל, ואחרי כמה ימי עבודה – לכולם.</p>
        </div>
      </header>
      {(Object.keys(FLAG_META) as (keyof Flags)[]).map((k) => (
        <section key={k} className="card flagcard" aria-labelledby={`flag-${k}`}>
          <div>
            <h2 id={`flag-${k}`} className="card__title">{FLAG_META[k].title}</h2>
            <p className="muted">{FLAG_META[k].hint}</p>
          </div>
          <div className="seg" role="radiogroup" aria-labelledby={`flag-${k}`} aria-busy={busy === k || undefined}>
            {MODES.map(([m, label]) => (
              <button key={m} type="button" role="radio" aria-checked={flags[k] === m} className={flags[k] === m ? 'is-on' : ''} disabled={busy === k} onClick={() => set(k, m)}>{label}</button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
