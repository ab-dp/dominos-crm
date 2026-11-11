/* הגדרות ← תקלות: מה נפל אצל המשתמשים (מסך שהוחלף ב"משהו השתבש", שגיאה שלא נתפסה). נטען בפתיחה ובלחיצה על "רענן" –
   בלי האזנה חיה, כדי לא לבזבז קריאות. 50 האחרונות. */
import { useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, type Timestamp } from 'firebase/firestore';
import { RefreshCw, CircleCheckBig } from 'lucide-react';
import { db } from '../../lib/firebase';
import { Button, EmptyState, Skeleton } from '../../design/components';
import { Ltr } from '../../lib/format';
import './ErrorsPage.css';

type Row = { id: string; where: string; message: string; stack: string; page: string; ua: string; byName: string; at?: Timestamp };

const fmtAt = (t?: Timestamp) => {
  if (!t) return '—';
  const d = t.toDate();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const device = (ua: string) => (/iPhone|Android.+Mobile/.test(ua) ? 'טלפון' : /iPad|Android/.test(ua) ? 'טאבלט' : 'מחשב');

export function ErrorsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setRows(null); setErr('');
    getDocs(query(collection(db, 'clientErrors'), orderBy('at', 'desc'), limit(50)))
      .then((s) => { if (live) setRows(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Row, 'id'>) }))); })
      .catch(() => { if (live) { setRows([]); setErr('אין הרשאה או אין חיבור – נסה לרענן'); } });
    return () => { live = false; };
  }, [tick]);

  return (
    <div className="page errlog">
      <header className="page__head">
        <div>
          <h1 className="page__title">תקלות</h1>
          <p className="page__sub">מה נפל אצל המשתמשים – 50 האחרונות.</p>
        </div>
        <div className="page__head-end">
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={() => setTick((n) => n + 1)}>רענן</Button>
        </div>
      </header>
      {err && <p className="cform__formerr" role="alert">{err}</p>}
      <div className="card">
        {rows === null ? (
          <div className="loading-rows">{[0, 1, 2].map((i) => <Skeleton key={i} h={18} />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<CircleCheckBig size={20} />} title="אין תקלות">תקלה שתקרה אצל משתמש תופיע כאן, עם המסך והשעה.</EmptyState>
        ) : (
          <ul className="errlog__list">
            {rows.map((r) => (
              <li key={r.id} className="errlog__row">
                <div className="errlog__meta">
                  <Ltr>{fmtAt(r.at)}</Ltr> · {r.byName || 'משתמש'} · {device(r.ua)} · <Ltr>{r.page || '/'}</Ltr>
                </div>
                <div className="errlog__msg"><Ltr>{r.message}</Ltr></div>
                {r.stack && (
                  <details className="errlog__stack">
                    <summary>פרטים טכניים</summary>
                    <pre dir="ltr">{r.stack}</pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
