/* בורד: מבט-על על ההזמנות, האספקה והכסף. כולם רואים. כל מספר מוביל לרשימה עצמה.
   "מה מגיע" – מהנתונים שכבר נטענים (בלי קריאות נוספות). תקופה שמתחילה לפני תחילת החודש הקודם נטענת פעם אחת לפי דרישה,
   עם "רענן" – בלי האזנה חיה, כדי לשמור על מכסת הקריאות. יעד מוצג רק כשהוגדר (הגדרות ← יעדים). */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useStore, type OrderView } from '../../data/store';
import { fromDoc } from '../../data/orders';
import { METHOD_LABEL } from '../../data/types';
import { useGoals } from '../../data/goals';
import { usePref } from '../../lib/prefs';
import { Button, Skeleton } from '../../design/components';
import { Ltr, addDays, fmtDate, fmtMoney, toISODate } from '../../lib/format';
import {
  NO_FILTERS, PERIOD_LABEL, applyFilters, byDay, delta, goalPace, money, periodRanges, quality, quotesSummary, rankings, totals, upcoming,
  type Filters, type Period, type Range, type Ranked,
} from './boardData';
import '../pages.css';
import './Board.css';

type SectionKey = 'upcoming' | 'period' | 'daily' | 'quality' | 'money' | 'ranks' | 'quotes';
const SECTIONS: Record<SectionKey, string> = {
  upcoming: 'מה מגיע', period: 'התקופה', daily: 'הזמנות לפי יום', quality: 'איכות אספקה', money: 'כסף', ranks: 'מי ומה', quotes: 'הצעות מחיר',
};
const DEFAULT_ORDER: SectionKey[] = ['upcoming', 'period', 'daily', 'quality', 'money', 'ranks', 'quotes'];
type Layout = { order: SectionKey[]; hidden: SectionKey[] };

const n = (v: number) => v.toLocaleString('he-IL');
/* "הזמנה אחת" / "5 הזמנות" */
const orders1 = (v: number) => (v === 1 ? 'הזמנה אחת' : <><Ltr>{n(v)}</Ltr> הזמנות</>);
const short = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

/* הזמנות של טווח ישן – קריאה אחת לפי דרישה */
function useRemote(enabled: boolean, r: Range) {
  const [state, setState] = useState<{ orders: OrderView[]; loading: boolean; error: string }>({ orders: [], loading: false, error: '' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    getDocs(query(collection(db, 'orders'), where('date', '>=', r.from), where('date', '<=', r.to)))
      .then((s) => { if (alive) setState({ orders: s.docs.map((d) => ({ ...fromDoc(d.id, d.data()), issues: [], health: 'ok' }) as unknown as OrderView), loading: false, error: '' }); })
      .catch(() => { if (alive) setState({ orders: [], loading: false, error: 'אין הרשאה או אין חיבור' }); });
    return () => { alive = false; };
  }, [enabled, r.from, r.to, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export function BoardPage() {
  const { orders, now, quotes, loading } = useStore();
  const goals = useGoals();
  const nav = useNavigate();
  const [period, setPeriod] = usePref<Period>('board:period', 'month');
  const [custom, setCustom] = useState<Range>(() => ({ from: toISODate(addDays(now, -13)), to: toISODate(now) }));
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [rankBy, setRankBy] = useState<'clusters' | 'branches'>('clusters');
  const [layout, setLayout] = usePref<Layout>('board:layout', { order: DEFAULT_ORDER, hidden: [] });
  const order = [...layout.order.filter((k) => k in SECTIONS), ...DEFAULT_ORDER.filter((k) => !layout.order.includes(k))];

  const { cur, prev, prevLabel } = periodRanges(period, now, custom);
  // ההזמנות שכבר נטענות: מתחילת החודש הקודם (ופתוחות). טווח שמתחיל לפני – נטען לפי דרישה
  const storeSince = toISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const need: Range = { from: prev.from < cur.from ? prev.from : cur.from, to: cur.to };
  const remote = useRemote(need.from < storeSince, need);
  const usingRemote = need.from < storeSince;
  const source = usingRemote ? remote.orders : orders;

  const options = useMemo(() => {
    const uniq = (f: (o: OrderView) => string) => [...new Set(source.map(f).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he'));
    return { clusters: uniq((o) => o.cluster), branches: uniq((o) => o.branchName), handlers: uniq((o) => o.handler), methods: uniq((o) => o.method) };
  }, [source]);
  const filtered = useMemo(() => applyFilters(source, filters), [source, filters]);
  const filteredLive = useMemo(() => applyFilters(orders, filters), [orders, filters]);
  const anyFilter = Object.values(filters).some(Boolean);

  const up = useMemo(() => upcoming(filteredLive, now), [filteredLive, now]);
  const t = useMemo(() => totals(filtered, cur), [filtered, cur.from, cur.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const tp = useMemo(() => totals(filtered, prev), [filtered, prev.from, prev.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const daily = useMemo(() => byDay(filtered, cur), [filtered, cur.from, cur.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = useMemo(() => quality(filtered, cur, now), [filtered, cur.from, cur.to, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = useMemo(() => money(filteredLive), [filteredLive]);
  const ranks = useMemo(() => rankings(filtered, cur), [filtered, cur.from, cur.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const qs = useMemo(() => quotesSummary(quotes, cur), [quotes, cur.from, cur.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const busy = loading || (usingRemote && remote.loading);
  const monthly = period === 'month' || period === 'prevMonth';

  const sections: Record<SectionKey, () => JSX.Element> = {
    upcoming: () => (
      <section className="bsec bup" aria-labelledby="b-up">
        <h2 id="b-up" className="bsec__title">מה מגיע</h2>
        <div className="bup__grid">
          {up.map((b) => (
            <div key={b.key} className="bup__col">
              <button type="button" className="bup__head" onClick={() => nav(b.to)}>
                <b>{b.label}</b>{b.sub && <span>{b.sub}</span>}
              </button>
              <div className="bup__main"><Ltr>{n(b.count)}</Ltr> <span>{b.count === 1 ? 'הזמנה' : 'הזמנות'}</span></div>
              <div className="bup__meta"><Ltr>{fmtMoney(b.sum)}</Ltr> · <Ltr>{n(b.pizzas)}</Ltr> פיצות</div>
              <div className="bup__risk">
                {b.unapproved > 0 && <button type="button" className="link bup__warn" onClick={() => nav('/exceptions?rule=6')}><Ltr>{b.unapproved}</Ltr> לא אושרו מול הלקוח</button>}
                {b.noOps > 0 && <button type="button" className="link bup__warn" onClick={() => nav('/orders?tab=today&filter=branch')}><Ltr>{b.noOps}</Ltr> לא עודכנו בתפעול</button>}
                {b.count > 0 && !b.unapproved && !b.noOps && <span className="bup__ok">הכל מאושר ומעודכן</span>}
              </div>
            </div>
          ))}
        </div>
      </section>
    ),
    period: () => {
      const figs: { key: 'orders' | 'revenue' | 'avg' | 'pizzas'; label: string; value: string; d: number | null; goal?: number }[] = [
        { key: 'orders', label: 'הזמנות', value: n(t.count), d: delta(t.count, tp.count), goal: monthly ? goals.orders : undefined },
        { key: 'revenue', label: 'הכנסות', value: fmtMoney(t.sum), d: delta(t.sum, tp.sum), goal: monthly ? goals.revenue : undefined },
        { key: 'avg', label: 'ממוצע להזמנה', value: fmtMoney(t.avg), d: delta(t.avg, tp.avg) },
        { key: 'pizzas', label: 'פיצות', value: n(t.pizzas), d: delta(t.pizzas, tp.pizzas) },
      ];
      return (
        <section className="bsec" aria-labelledby="b-period">
          <h2 id="b-period" className="bsec__title">התקופה <span className="bsec__sub"><Ltr>{fmtDate(cur.from)}</Ltr>–<Ltr>{fmtDate(cur.to)}</Ltr> · {prevLabel}</span></h2>
          <dl className="bfig">
            {figs.map((f) => {
              const raw = f.key === 'orders' ? t.count : t.sum;
              const pace = f.goal ? goalPace(raw, f.goal, cur, now, period === 'month') : null;
              return (
                <div key={f.key} className="bfig__item">
                  <dt>{f.label}</dt>
                  <dd className="bfig__val"><Ltr>{f.value}</Ltr></dd>
                  <dd className={`bfig__delta ${!f.d ? '' : f.d > 0 ? 'is-up' : 'is-down'}`}>
                    {f.d === null ? 'אין נתון להשוואה' : f.d === 0 ? 'ללא שינוי' : <>{f.d > 0 ? <ArrowUp size={13} aria-label="עלייה" /> : <ArrowDown size={13} aria-label="ירידה" />}<Ltr>{Math.abs(f.d)}%</Ltr></>}
                  </dd>
                  {pace && f.goal && (
                    <dd className="bgoal">
                      <span className="bgoal__track" aria-hidden="true"><span className="bgoal__fill" style={{ width: `${Math.min(100, pace.pct)}%` }} /></span>
                      <span className="bgoal__text"><Ltr>{pace.pct}%</Ltr> מהיעד (<Ltr>{f.key === 'revenue' ? fmtMoney(f.goal) : n(f.goal)}</Ltr>)
                        {pace.projected !== null && <> · בקצב הזה: <Ltr>{f.key === 'revenue' ? fmtMoney(pace.projected) : n(Math.round(pace.projected))}</Ltr></>}</span>
                    </dd>
                  )}
                </div>
              );
            })}
          </dl>
        </section>
      );
    },
    daily: () => <Daily points={daily} />,
    quality: () => {
      const segs = [
        { key: 'onTime', label: 'בזמן', v: q.onTime, cls: 'is-ok' },
        { key: 'late', label: 'באיחור', v: q.late, cls: 'is-late' },
        { key: 'partial', label: 'חלקית', v: q.partial, cls: 'is-partial' },
        { key: 'cancelled', label: 'בוטלו', v: q.cancelled, cls: 'is-cancel' },
      ];
      return (
        <section className="bsec bq" aria-labelledby="b-q">
          <h2 id="b-q" className="bsec__title">איכות אספקה</h2>
          {q.closed === 0 ? <p className="bsec__empty">אין עדיין הזמנות שנסגרו בתקופה.</p> : (
            <>
              <p className="bq__head"><b><Ltr>{q.onTimePct ?? 0}%</Ltr></b> סופקו בזמן
                {goals.onTimePct && <span className={`bq__goal ${(q.onTimePct ?? 0) >= goals.onTimePct ? 'is-up' : 'is-down'}`}> · יעד <Ltr>{goals.onTimePct}%</Ltr></span>}
              </p>
              <div className="bq__bar" role="img" aria-label={segs.map((s) => `${s.label} ${s.v}`).join(', ')}>
                {segs.filter((s) => s.v > 0).map((s) => <span key={s.key} className={`bq__seg ${s.cls}`} style={{ flexGrow: s.v }} title={`${s.label}: ${s.v}`} />)}
              </div>
              <ul className="bq__legend">
                {segs.map((s) => (
                  <li key={s.key}><span className={`bq__dot ${s.cls}`} aria-hidden="true" />{s.label} <b><Ltr>{n(s.v)}</Ltr></b>
                    <span className="muted"> · <Ltr>{Math.round((s.v / q.closed) * 100)}%</Ltr></span></li>
                ))}
              </ul>
              {q.stillOpen > 0 && <button type="button" className="link bq__open" onClick={() => nav('/orders?tab=overdue')}>{q.stillOpen === 1 ? 'הזמנה אחת שעבר מועדה ועוד לא נסגרה' : <><Ltr>{q.stillOpen}</Ltr> הזמנות שעבר מועדן ועוד לא נסגרו</>}</button>}
            </>
          )}
        </section>
      );
    },
    money: () => (
      <section className="bsec" aria-labelledby="b-m">
        <h2 id="b-m" className="bsec__title">כסף <span className="bsec__sub">מצב נוכחי</span></h2>
        <ul className="bmoney">
          <li><button type="button" onClick={() => nav('/reports/credit')}><span>הקפה פתוחה</span><b><Ltr>{fmtMoney(m.creditOpen.sum)}</Ltr></b><small>{orders1(m.creditOpen.count)} שעוד לא שולמו</small></button></li>
          <li><button type="button" onClick={() => nav('/exceptions?rule=2')} className={m.qGaps.count ? 'is-alert' : ''}><span>פערים מול Q</span><b><Ltr>{n(m.qGaps.count)}</Ltr></b><small>{m.qGaps.count ? <>סה"כ פער <Ltr>{fmtMoney(m.qGaps.sum)}</Ltr></> : 'אין פערים'}</small></button></li>
          <li><button type="button" onClick={() => nav('/exceptions?rule=7')} className={m.failed ? 'is-alert' : ''}><span>אשראי שנכשל</span><b><Ltr>{n(m.failed)}</Ltr></b><small>{m.failed ? 'לטפל בחיוב' : 'אין'}</small></button></li>
        </ul>
      </section>
    ),
    ranks: () => (
      <section className="bsec" aria-labelledby="b-r">
        <h2 id="b-r" className="bsec__title">מי ומה <span className="bsec__sub">לפי הכנסות בתקופה</span></h2>
        <div className="branks">
          <RankList title="לקוחות מובילים" rows={ranks.customers} />
          <RankList title={rankBy === 'clusters' ? 'אשכולות' : 'סניפים'} rows={ranks[rankBy]}
            tool={<div className="seg seg--sm" role="group" aria-label="פילוח"><button className={rankBy === 'clusters' ? 'is-on' : ''} aria-pressed={rankBy === 'clusters'} onClick={() => setRankBy('clusters')}>אשכול</button><button className={rankBy === 'branches' ? 'is-on' : ''} aria-pressed={rankBy === 'branches'} onClick={() => setRankBy('branches')}>סניף</button></div>} late />
          <RankList title="נציגים" rows={ranks.handlers} late />
        </div>
      </section>
    ),
    quotes: () => (
      <section className="bsec" aria-labelledby="b-qs">
        <h2 id="b-qs" className="bsec__title">הצעות מחיר</h2>
        <dl className="bfig bfig--small">
          <div className="bfig__item"><dt>פתוחות עכשיו</dt><dd className="bfig__val"><Ltr>{n(qs.open)}</Ltr></dd><dd className="bfig__delta"><Ltr>{fmtMoney(qs.openSum)}</Ltr></dd></div>
          <div className="bfig__item"><dt>נשלחו בתקופה</dt><dd className="bfig__val"><Ltr>{n(qs.issued)}</Ltr></dd></div>
          <div className="bfig__item"><dt>הפכו להזמנה</dt><dd className="bfig__val"><Ltr>{n(qs.ordered)}</Ltr></dd><dd className="bfig__delta">{qs.conversion === null ? '—' : <><Ltr>{qs.conversion}%</Ltr> מההצעות</>}</dd></div>
        </dl>
      </section>
    ),
  };

  return (
    <div className="page board">
      <header className="page__head">
        <div>
          <h1 className="page__title">בורד</h1>
          <p className="page__sub">מבט-על על ההזמנות, האספקה והכסף.</p>
        </div>
        <div className="page__head-end">
          <LayoutMenu order={order} hidden={layout.hidden} onChange={(o, h) => setLayout({ order: o, hidden: h })} />
        </div>
      </header>

      <div className="tablebar board__filters">
        <div className="seg" role="group" aria-label="תקופה">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => <button key={p} className={period === p ? 'is-on' : ''} aria-pressed={period === p} onClick={() => setPeriod(p)}>{PERIOD_LABEL[p]}</button>)}
        </div>
        {period === 'custom' && (
          <span className="report__dates">
            <input type="date" className="input input--sm" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} aria-label="מתאריך" />
            <span aria-hidden="true">–</span>
            <input type="date" className="input input--sm" value={custom.to} min={custom.from} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} aria-label="עד תאריך" />
          </span>
        )}
        <select className="input input--sm board__sel" value={filters.cluster} onChange={(e) => setFilters({ ...filters, cluster: e.target.value, branch: '' })} aria-label="אשכול">
          <option value="">כל האשכולות</option>{options.clusters.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input input--sm board__sel" value={filters.branch} onChange={(e) => setFilters({ ...filters, branch: e.target.value })} aria-label="סניף">
          <option value="">כל הסניפים</option>{options.branches.filter((b) => !filters.cluster || source.some((o) => o.branchName === b && o.cluster === filters.cluster)).map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className="input input--sm board__sel" value={filters.handler} onChange={(e) => setFilters({ ...filters, handler: e.target.value })} aria-label="נציג">
          <option value="">כל הנציגים</option>{options.handlers.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <select className="input input--sm board__sel" value={filters.method} onChange={(e) => setFilters({ ...filters, method: e.target.value })} aria-label="אמצעי תשלום">
          <option value="">כל אמצעי התשלום</option>{options.methods.map((x) => <option key={x} value={x}>{METHOD_LABEL[x] ?? x}</option>)}
        </select>
        {anyFilter && <button type="button" className="chip is-on" onClick={() => setFilters(NO_FILTERS)}>נקה סינון</button>}
        {usingRemote && <Button variant="ghost" size="sm" icon={<RefreshCw size={15} />} loading={remote.loading} onClick={remote.reload}>רענן</Button>}
      </div>
      {remote.error && usingRemote && <p className="cform__formerr" role="alert">{remote.error}</p>}

      {busy ? (
        <div className="bsec board__loading">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={22} />)}</div>
      ) : (
        <div className="board__grid">
          {order.filter((k) => !layout.hidden.includes(k)).map((k) => <div key={k} className={`board__slot board__slot--${k}`}>{sections[k]()}</div>)}
        </div>
      )}
    </div>
  );
}

/* עמודות: הזמנות לפי יום. סדרה אחת – בלי מקרא; ריחוף / פוקוס מציג את היום; טבלה לנגישות */
function Daily({ points }: { points: { date: string; count: number; sum: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.count));
  const step = max <= 4 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : Math.ceil(max / 5 / 10) * 10;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const every = points.length <= 10 ? 1 : points.length <= 21 ? 3 : 7;
  const h = hover !== null ? points[hover] : null;
  if (points.every((p) => p.count === 0)) {
    return (
      <section className="bsec" aria-labelledby="b-d">
        <h2 id="b-d" className="bsec__title">הזמנות לפי יום</h2>
        <p className="bsec__empty">אין הזמנות בתקופה הזו.</p>
      </section>
    );
  }
  return (
    <section className="bsec" aria-labelledby="b-d">
      <h2 id="b-d" className="bsec__title">הזמנות לפי יום</h2>
      <div className="bchart" onMouseLeave={() => setHover(null)}>
        <div className="bchart__grid" aria-hidden="true">
          {ticks.map((v) => <span key={v} style={{ bottom: `${(v / top) * 100}%` }}><Ltr>{v}</Ltr></span>)}
        </div>
        <div className="bchart__plot" role="img" aria-label={`הזמנות לפי יום, עד ${max} ביום`}>
          {points.map((p, i) => (
            <div key={p.date} className={`bchart__col ${hover === i ? 'is-hover' : ''}`} onMouseEnter={() => setHover(i)}>
              <span className="bchart__bar" style={{ height: `${(p.count / top) * 100}%` }} />
              {i % every === 0 && <span className="bchart__x"><Ltr>{short(p.date)}</Ltr></span>}
            </div>
          ))}
          {h && hover !== null && (
            <div className="bchart__tip" style={{ insetInlineStart: `${((hover + 0.5) / points.length) * 100}%` }}>
              <b><Ltr>{fmtDate(h.date)}</Ltr></b>
              <span>{h.count === 1 ? 'הזמנה אחת' : <><Ltr>{h.count}</Ltr> הזמנות</>} · <Ltr>{fmtMoney(h.sum)}</Ltr></span>
            </div>
          )}
        </div>
      </div>
      <details className="bchart__table">
        <summary>הצג כטבלה</summary>
        <table className="rtable">
          <thead><tr><th>תאריך</th><th className="num">הזמנות</th><th className="num">סכום</th></tr></thead>
          <tbody>{points.map((p) => <tr key={p.date}><td><Ltr>{fmtDate(p.date)}</Ltr></td><td className="num"><Ltr>{p.count}</Ltr></td><td className="num"><Ltr>{fmtMoney(p.sum)}</Ltr></td></tr>)}</tbody>
        </table>
      </details>
    </section>
  );
}

/* דירוג: פס אחד בצבע אחד, הערך בקצה */
function RankList({ title, rows, tool, late }: { title: string; rows: Ranked[]; tool?: JSX.Element; late?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.sum));
  return (
    <div className="brank">
      <div className="brank__head"><h3>{title}</h3>{tool}</div>
      {rows.length === 0 ? <p className="bsec__empty">אין הזמנות בתקופה.</p> : (
        <ol className="brank__list">
          {rows.map((r) => (
            <li key={r.name} className="brank__row">
              <span className="brank__name" title={r.name}>{r.name}</span>
              <span className="brank__track" aria-hidden="true"><span className="brank__bar" style={{ width: `${(r.sum / max) * 100}%` }} /></span>
              <span className="brank__val"><Ltr>{fmtMoney(r.sum)}</Ltr></span>
              <span className="brank__meta">{orders1(r.count)}{late && r.latePct !== null && r.latePct !== undefined && <> · <Ltr>{r.latePct}%</Ltr> באיחור</>}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* התאמה אישית: אילו חלקים להציג ובאיזה סדר – נשמר אצל כל משתמש */
function LayoutMenu({ order, hidden, onChange }: { order: SectionKey[]; hidden: SectionKey[]; onChange: (o: SectionKey[], h: SectionKey[]) => void }) {
  const move = (i: number, d: -1 | 1) => { const o = [...order]; const j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; onChange(o, hidden); };
  const toggle = (k: SectionKey) => onChange(order, hidden.includes(k) ? hidden.filter((x) => x !== k) : [...hidden, k]);
  return (
    <Popover.Root>
      <Popover.Trigger asChild><Button variant="secondary" icon={<SlidersHorizontal size={16} />}>התאם תצוגה</Button></Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="pop blayout" align="end" sideOffset={6} dir="rtl">
          <p className="pop__title">מה להציג בבורד</p>
          <ul className="blayout__list">
            {order.map((k, i) => (
              <li key={k}>
                <label className="check-inline"><input type="checkbox" checked={!hidden.includes(k)} onChange={() => toggle(k)} /> {SECTIONS[k]}</label>
                <span className="blayout__move">
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`הזז למעלה – ${SECTIONS[k]}`}><ChevronUp size={15} /></button>
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`הזז למטה – ${SECTIONS[k]}`}><ChevronDown size={15} /></button>
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className="link" onClick={() => onChange(DEFAULT_ORDER, [])}>חזרה לברירת המחדל</button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
