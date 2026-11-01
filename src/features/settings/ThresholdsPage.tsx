/* ספי התראות (מנהל בלבד): ארבעה ערכים שקובעים מתי הזמנה הופכת לדחופה או לחריגה. נשמר ביומן. */
import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { DEFAULT_THRESHOLDS, THRESHOLD_META, saveThresholds, useThresholds, type Thresholds } from '../../data/thresholds';
import { Button } from '../../design/components';
import { useToast } from '../../design/Toast';
import '../pages.css';
import './ThresholdsPage.css';

const KEYS: (keyof Thresholds)[] = ['qFromTime', 'qLeadMinutes', 'soonDays', 'creditDeadline', 'nearMinutes'];

export function ThresholdsPage() {
  const { th, saved } = useThresholds();
  const toast = useToast();
  const [draft, setDraft] = useState<Thresholds>(th);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => setDraft(th), [th]);

  const dirty = KEYS.some((k) => draft[k] !== th[k]);
  const validate = () => {
    for (const k of KEYS) {
      const m = THRESHOLD_META[k];
      if (k === 'creditDeadline' || k === 'qFromTime') { if (!/^\d{2}:\d{2}$/.test(draft[k])) return `${m.title}: שעה בפורמט 12:00`; continue; }
      const v = draft[k] as number;
      if (!Number.isFinite(v) || v < m.min || v > m.max) return `${m.title}: בין ${m.min} ל-${m.max} ${m.unit}`;
    }
    return '';
  };
  const save = async () => {
    const e = validate();
    if (e) return setErr(e);
    setBusy(true);
    try { await saveThresholds(draft, th); toast({ message: 'ספי ההתראות נשמרו – החריגים מחושבים מחדש לכולם' }); }
    catch { setErr('השמירה נכשלה – בדוק חיבור'); }
    setBusy(false);
  };

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">ספי התראות</h1>
          <p className="page__sub">מתי הזמנה נחשבת דחופה או חריגה. השינוי חל מיד על כל המשתמשים, ונרשם ביומן.</p>
        </div>
      </header>
      <div className="card thr">
        {KEYS.map((k) => {
          const m = THRESHOLD_META[k];
          const isTime = k === 'creditDeadline' || k === 'qFromTime';
          return (
            <label key={k} className="thr__row">
              <span className="thr__text">
                <b>{m.title}</b>
                <span>{m.hint}</span>
              </span>
              <span className="thr__input">
                <input className="input input--ltr" type={isTime ? 'time' : 'number'} min={isTime ? undefined : m.min} max={isTime ? undefined : m.max} step={isTime ? 900 : 1}
                  value={draft[k]} onChange={(e) => { setErr(''); setDraft({ ...draft, [k]: isTime ? e.target.value : Number(e.target.value) }); }} />
                {!isTime && <span className="thr__unit">{m.unit}</span>}
                {draft[k] !== DEFAULT_THRESHOLDS[k] && <span className="thr__def">ברירת מחדל: {DEFAULT_THRESHOLDS[k]}</span>}
              </span>
            </label>
          );
        })}
        <div className="thr__foot">
          {err && <span className="cform__err" role="alert">{err}</span>}
          {!saved && !dirty && <span className="muted">פועל לפי ברירות המחדל</span>}
          <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} disabled={KEYS.every((k) => draft[k] === DEFAULT_THRESHOLDS[k])} onClick={() => setDraft(DEFAULT_THRESHOLDS)}>חזרה לברירות המחדל</Button>
          <Button variant="primary" loading={busy} disabled={!dirty} onClick={save}>שמור</Button>
        </div>
      </div>
    </div>
  );
}
