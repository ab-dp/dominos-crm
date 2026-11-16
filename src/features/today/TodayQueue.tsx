/* תור היום (מסך "היום"): ההזמנות של היום בקבוצות לפי מה שנשאר לעשות, כדי שבבוקר יהיה ברור מה עוד לא ירד ל-Q.
   למעלה – כמה ירדו ל-Q מתוך כמה. "להקליד ל-Q" פתוחה תמיד; "ירדו ל-Q" ו"נסגרו" אפשר לקפל. לחיצה על שורה פותחת את ההזמנה. */
import { type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { useStore, type OrderView } from '../../data/store';
import { closeLabel } from '../../data/types';
import { HealthBadge, Missing, Skeleton } from '../../design/components';
import { Ltr, Money } from '../../lib/format';
import { usePref } from '../../lib/prefs';
import { orderDateTime } from '../../rules-engine/health';
import { NextStep } from '../orders/OrderTimeline';
import { qProgress, type Lane } from './qQueue';

const LANE_META: Record<Lane, { title: string; empty?: string; fold?: boolean }> = {
  todo: { title: 'להקליד ל-Q', empty: 'כל ההזמנות שהלקוח אישר ירדו ל-Q' },
  customer: { title: 'ממתינות לאישור לקוח' },
  inq: { title: 'ירדו ל-Q', fold: true },
  closed: { title: 'נסגרו', fold: true },
};

export function TodayQueue({ lanes, loading, now }: { lanes: Record<Lane, OrderView[]>; loading: boolean; now: Date }) {
  const { thresholds } = useStore();
  const [folded, setFolded] = usePref<Partial<Record<Lane, boolean>>>('today:folded', { closed: true });
  const p = qProgress(lanes);
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  const nextId = lanes.todo.find((o) => orderDateTime(o) > now)?.id;

  return (
    <section className="card tq" aria-labelledby="h-queue">
      <div className="card__head tq__head">
        <h2 id="h-queue" className="card__title">הזמנות היום</h2>
        {!loading && p.total > 0 && (
          <span className="tq__count" aria-live="polite">ירדו ל-Q <b><Ltr>{p.done}</Ltr></b> מתוך <Ltr>{p.total}</Ltr></span>
        )}
      </div>
      {!loading && p.total > 0 && (
        <div className="tq__progress">
          <div className="tq__bar" role="progressbar" aria-label="הזמנות היום שירדו ל-Q" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.done} aria-valuetext={`${p.done} מתוך ${p.total}`}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <span className="tq__left">{p.left ? <>נשארו <Ltr>{p.left}</Ltr> · חריגה מ-<Ltr>{thresholds.qFromTime}</Ltr></> : <><Check size={14} aria-hidden="true" /> הכל ירד ל-Q</>}</span>
        </div>
      )}

      {loading ? <div className="loading-rows" aria-busy="true" aria-label="טוען">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={40} />)}</div>
        : p.total === 0 ? <p className="calm calm--quiet">אין הזמנות להיום</p>
        : (['todo', 'customer', 'inq', 'closed'] as Lane[]).map((lane) => {
          const list = lanes[lane];
          const meta = LANE_META[lane];
          if (!list.length && lane !== 'todo') return null;
          const isFolded = !!meta.fold && !!folded[lane];
          return (
            <div key={lane} className={`tlane tlane--${lane}`} role="group" aria-labelledby={`tl-${lane}`}>
              <h3 id={`tl-${lane}`} className="tlane__head">
                {meta.fold ? (
                  <button type="button" className="tlane__toggle" aria-expanded={!isFolded} onClick={() => setFolded({ ...folded, [lane]: !isFolded })}>
                    <ChevronDown size={16} aria-hidden="true" className="tlane__chev" />
                    {meta.title} <span className="tlane__n"><Ltr>{list.length}</Ltr></span>
                  </button>
                ) : <span className="tlane__label">{meta.title} <span className="tlane__n"><Ltr>{list.length}</Ltr></span></span>}
              </h3>
              {!isFolded && (list.length === 0
                ? <p className="tlane__empty"><Check size={16} aria-hidden="true" /> {meta.empty}</p>
                : <ol className="tlane__list">{list.map((o) => <QueueRow key={o.id} o={o} lane={lane} isNext={o.id === nextId} now={now} />)}</ol>)}
            </div>
          );
        })}
    </section>
  );
}

/* "בעוד 45 דק'" / "בעוד שעה ו-18 דק'" */
function inTime(minutes: number): ReactNode {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const mins = (n: number) => <><Ltr>{n}</Ltr>&nbsp;דק'</>;
  if (h === 0) return mins(m);
  const hours = h === 1 ? 'שעה' : h === 2 ? 'שעתיים' : <><Ltr>{h}</Ltr>&nbsp;שעות</>;
  return m ? <>{hours} ו־{mins(m)}</> : hours;
}

function QueueRow({ o, lane, isNext, now }: { o: OrderView; lane: Lane; isNext: boolean; now: Date }) {
  const panel = usePanel();
  // הזמנה של היום שלא ירדה ל-Q אחרי השעה שנקבעה – החריגה האדומה (כלל 1)
  const late = lane === 'todo' && o.issues.some((i) => i.rule === 1 && i.severity === 'red');
  const credit = (lane === 'todo' || lane === 'customer') && o.method === 'credit' && o.payment !== 'paid' && o.payment !== 'cancelled';
  const minutes = Math.round((orderDateTime(o).getTime() - now.getTime()) / 60000);
  const label = `${o.time} ${o.customerName}${late ? ', לא הועברה ל-Q' : ''}${o.qNumber ? `, Q ${o.qNumber}` : ''}${o.health !== 'ok' && !late ? `, ${o.issues.map((i) => i.label).join(', ')}` : ''}`;
  return (
    <li className={`qrow qrow--${lane} ${late ? 'is-late' : ''}`}>
      <span className="qrow__time">{lane === 'inq' && <Check size={14} aria-hidden="true" className="qrow__ok" />}{o.time ? <Ltr>{o.time}</Ltr> : <Missing>שעה?</Missing>}</span>
      <button className="qrow__main" onClick={(e) => panel.open(o.id, e.currentTarget)} aria-label={label}>
        <span className="qrow__cust">
          {o.customerName}
          {isNext && minutes > 0 && <span className="qrow__next">הבאה בתור · בעוד {inTime(minutes)}</span>}
        </span>
        <span className="qrow__meta">
          {o.branchName || <Missing>ללא סניף</Missing>} · <Money value={o.amount} />
          {lane === 'inq' && o.qNumber && <> · Q <Ltr>{o.qNumber}</Ltr></>}
          {lane === 'closed' && <> · {closeLabel(o)}</>}
        </span>
      </button>
      <span className="qrow__tags">
        {late && <span className="qtag qtag--late">לא הועברה ל-Q</span>}
        {credit && <span className="qtag qtag--credit">אשראי לחיוב</span>}
        {!late && lane !== 'closed' && <HealthBadge health={o.health} issues={o.issues} compact focusable={false} />}
      </span>
      {lane !== 'closed' && <span className="qrow__act"><NextStep o={o} /></span>}
    </li>
  );
}
