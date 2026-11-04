/* תנאים קבועים בסוף כל הצעת מחיר (מנהל בלבד). התוקף ו"המחירים כוללים מע"מ" מופיעים תמיד, לפני התנאים האלה. נשמר ביומן. */
import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { DEFAULT_TERMS, saveQuoteTerms, useQuoteTerms } from '../../data/quotes';
import { Button } from '../../design/components';
import { useToast } from '../../design/Toast';
import '../pages.css';
import './ThresholdsPage.css';

export function QuoteTermsPage() {
  const terms = useQuoteTerms();
  const toast = useToast();
  const [text, setText] = useState(terms.join('\n'));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => setText(terms.join('\n')), [terms]);
  const next = text.split('\n').map((t) => t.trim()).filter(Boolean);
  const dirty = JSON.stringify(next) !== JSON.stringify(terms);
  const save = async () => {
    if (next.some((t) => /\d{13,}/.test(t))) return setErr('אסור לרשום מספר כרטיס אשראי');
    if (next.length > 12) return setErr('עד 12 תנאים');
    setBusy(true);
    try { await saveQuoteTerms(next, terms); toast({ message: 'התנאים נשמרו – יופיעו בכל הצעה מעכשיו' }); } catch { setErr('השמירה נכשלה – בדקו חיבור'); }
    setBusy(false);
  };
  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">הצעות מחיר – תנאים קבועים</h1>
          <p className="page__sub">מופיעים בסוף כל הצעה, תחת "תנאים". תמיד מופיעים לפניהם: "הצעה זו בתוקף עד…" ו"כל המחירים בהצעה כוללים מע"מ". תנאי בכל שורה.</p>
        </div>
      </header>
      <div className="card thr">
        <label className="thr__row thr__row--block">
          <span className="thr__text"><b>התנאים</b><span>שורה = תנאי אחד. שורה ריקה לא נשמרת.</span></span>
          <textarea className="input qterms" rows={6} value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} />
        </label>
        <div className="thr__foot">
          {err && <span className="cform__err" role="alert">{err}</span>}
          <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} disabled={JSON.stringify(next) === JSON.stringify(DEFAULT_TERMS)} onClick={() => setText(DEFAULT_TERMS.join('\n'))}>חזרה לברירת המחדל</Button>
          <Button variant="primary" loading={busy} disabled={!dirty} onClick={save}>שמור</Button>
        </div>
      </div>
    </div>
  );
}
