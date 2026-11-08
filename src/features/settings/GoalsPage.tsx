/* יעדים (מנהל בלבד): יעד חודשי להזמנות, להכנסות ולאספקה בזמן. שדה ריק = אין יעד, והבורד לא מציג השוואה. נשמר ביומן. */
import { useEffect, useState } from 'react';
import { GOAL_META, saveGoals, useGoals, type Goals } from '../../data/goals';
import { Button } from '../../design/components';
import { useToast } from '../../design/Toast';
import '../pages.css';
import './ThresholdsPage.css';

const KEYS: (keyof Goals)[] = ['orders', 'revenue', 'onTimePct'];
const toText = (g: Goals) => Object.fromEntries(KEYS.map((k) => [k, g[k] ? String(g[k]) : ''])) as Record<keyof Goals, string>;

export function GoalsPage() {
  const goals = useGoals();
  const toast = useToast();
  const [draft, setDraft] = useState(() => toText(goals));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => setDraft(toText(goals)), [goals]);

  const parse = (k: keyof Goals) => { const v = Number(draft[k].replace(/[^\d.]/g, '')); return draft[k].trim() ? v : 0; };
  const dirty = KEYS.some((k) => parse(k) !== (goals[k] ?? 0));
  const save = async () => {
    for (const k of KEYS) {
      const v = parse(k);
      if (draft[k].trim() && (!Number.isFinite(v) || v <= 0 || v > GOAL_META[k].max)) return setErr(`${GOAL_META[k].title}: מספר בין 1 ל-${GOAL_META[k].max.toLocaleString('he-IL')}, או להשאיר ריק`);
    }
    setBusy(true);
    try { await saveGoals(Object.fromEntries(KEYS.map((k) => [k, parse(k)])) as Goals, goals); toast({ message: 'היעדים נשמרו – הבורד משווה אליהם מעכשיו' }); }
    catch { toast({ tone: 'error', message: 'השמירה נכשלה – בדוק חיבור' }); }
    setBusy(false);
  };

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">יעדים</h1>
          <p className="page__sub">יעד חודשי. שדה ריק – אין יעד, והבורד לא משווה אליו.</p>
        </div>
      </header>
      <div className="card thr">
        {KEYS.map((k) => {
          const m = GOAL_META[k];
          return (
            <label key={k} className="thr__row">
              <span className="thr__text"><b>{m.title}</b><span>{m.hint}</span></span>
              <span className="thr__input">
                <input className="input input--ltr" inputMode="decimal" value={draft[k]} placeholder="אין יעד"
                  onChange={(e) => { setErr(''); setDraft({ ...draft, [k]: e.target.value }); }} />
                <span className="thr__unit">{m.unit}</span>
              </span>
            </label>
          );
        })}
        <div className="thr__foot">
          {err ? <span className="cform__err" role="alert">{err}</span> : <span className="muted">רק מנהל מערכת יכול לשנות יעדים.</span>}
          <Button variant="primary" loading={busy} disabled={!dirty} onClick={save}>שמור יעדים</Button>
        </div>
      </div>
    </div>
  );
}
