/* גרף עמודות של סדרה אחת: "זמן" – עמודות לאורך ציר; "קטגוריה" – פסים אופקיים ממוינים (עד 12 ועוד "אחרים").
   צבע אחד (כחול Domino's), תווית ערך בריחוף, ולחיצה פותחת את ההזמנות של אותה שורה. נבנה ב-HTML כדי לעבוד טבעי מימין לשמאל. */
import { useState } from 'react';
import { Ltr, fmtMoney } from '../../lib/format';

type Datum = { id: string; label: string; value: number };

export function BarChart({ data, kind, money, onPick }: { data: Datum[]; kind: 'time' | 'category'; money?: boolean; onPick: (id: string) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const fmt = (v: number) => (money ? fmtMoney(v) : String(v));

  if (kind === 'category') {
    const sorted = [...data].sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, 12);
    const rest = sorted.slice(12);
    const rows = rest.length ? [...top, { id: '__rest', label: `אחרים (${rest.length})`, value: rest.reduce((t, d) => t + d.value, 0) }] : top;
    const max = Math.max(1, ...rows.map((d) => d.value));
    return (
      <ol className="bars" aria-label="גרף פסים">
        {rows.map((d) => (
          <li key={d.id}>
            <button className="bars__row" disabled={d.id === '__rest'} onClick={() => onPick(d.id)} aria-label={`${d.label}: ${fmt(d.value)}`}>
              <span className="bars__label">{d.label}</span>
              <span className="bars__track"><span className="bars__fill" style={{ width: `${Math.max(1.5, (d.value / max) * 100)}%` }} /></span>
              <span className="bars__value"><Ltr>{fmt(d.value)}</Ltr></span>
            </button>
          </li>
        ))}
      </ol>
    );
  }

  const max = Math.max(1, ...data.map((d) => d.value));
  const step = Math.ceil(data.length / 10); // תוויות ציר לא צפופות
  const top = niceMax(max);
  return (
    <div className="cols" role="img" aria-label="גרף עמודות לפי זמן – הנתונים מופיעים גם בטבלה">
      <div className="cols__grid" aria-hidden="true">
        {[1, 0.5, 0].map((f) => <span key={f} style={{ bottom: `${f * 100}%` }}><Ltr>{fmt(Math.round(top * f))}</Ltr></span>)}
      </div>
      <div className="cols__plot">
        {data.map((d, i) => (
          <button key={d.id} className={`cols__col ${hover === d.id ? 'is-hover' : ''}`} onMouseEnter={() => setHover(d.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(d.id)} onBlur={() => setHover(null)}
            onClick={() => onPick(d.id)} aria-label={`${d.label}: ${fmt(d.value)}`}>
            <span className="cols__bar" style={{ height: `${Math.max(d.value ? 1.5 : 0, (d.value / top) * 100)}%` }} />
            {hover === d.id && <span className="cols__tip"><b><Ltr>{fmt(d.value)}</Ltr></b><Ltr>{d.label}</Ltr></span>}
            <span className="cols__x">{i % step === 0 ? <Ltr>{d.label}</Ltr> : ''}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* קצה ציר עגול: 1, 2, 2.5 או 5 כפול חזקת 10 */
function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
