/* בורד הנהלה: כל חלק נפתח במשפט שעונה על השאלה (כמה מכרנו, האם עמדנו בזמנים, כמה מחכה לגבייה),
   ומתחתיו הנתונים שתומכים בו והקישור לרשימה עצמה. כולם רואים. יעד מוצג רק כשהוגדר (הגדרות ← יעדים).
   מכסת קריאות: בלי האזנה חדשה. תקופה שמתחילה לפני החודש הקודם נטענת פעם אחת, עם "רענן". */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { ChevronDown, ChevronUp, Filter, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useStore, type OrderView } from '../../data/store';
import { fromDoc } from '../../data/orders';
import { METHOD_LABEL } from '../../data/types';
import { useGoals, type Goals } from '../../data/goals';
import { usePref } from '../../lib/prefs';
import { Button, Skeleton } from '../../design/components';
import { Ltr, addDays, fmtDate, fmtMoney, toISODate } from '../../lib/format';
import {
  NO_FILTERS, PERIOD_LABEL, applyFilters, byDay, collections, delta, goalPace, horizon, periodRanges, quotesSummary, rankings, sales, service,
  type DayPoint, type Filters, type Period, type Range, type Ranked,
} from './boardData';
import '../pages.css';
import './Board.css';

type SectionKey = 'upcoming' | 'sales' | 'service' | 'collections' | 'customers' | 'branches' | 'team' | 'quotes';
const SECTIONS: Record<SectionKey, string> = {
  upcoming: 'הזמנות קרובות', sales: 'מכירות', service: 'עמידה בזמנים', collections: 'גבייה ובקרת קופה',
  customers: 'לקוחות', branches: 'סניפים ואשכולות', team: 'צוות', quotes: 'הצעות מחיר',
};
const DEFAULT_ORDER: SectionKey[] = ['upcoming', 'sales', 'service', 'collections', 'customers', 'branches', 'team', 'quotes'];
const WIDE: SectionKey[] = ['upcoming', 'sales', 'team', 'quotes'];
type Layout = { order: SectionKey[]; hidden: SectionKey[] };

/* ---------- ניסוחים ---------- */
const num = (v: number) => v.toLocaleString('he-IL');
const count = (v: number, one: string, many: string) => (v === 1 ? one : <><Ltr>{num(v)}</Ltr> {many}</>);
const orders$ = (v: number) => count(v, 'הזמנה אחת', 'הזמנות');
const pizzas$ = (v: number) => count(v, 'פיצה אחת', 'פיצות');
const WEEKDAY = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const short = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
/* "עלייה של 18% לעומת אותם ימים בחודש שעבר" */
function Change({ d, vs }: { d: number | null; vs: string }) {
  if (d === null) return <span className="bchg">אין נתונים להשוואה מול {vs}</span>;
  if (d === 0) return <span className="bchg">ללא שינוי לעומת {vs}</span>;
  return <span className={`bchg ${d > 0 ? 'is-up' : 'is-down'}`}>{d > 0 ? 'עלייה' : 'ירידה'} של <Ltr>{Math.abs(d)}%</Ltr> לעומת {vs}</span>;
}
/* "+18%" קצר לשורות משנה */
function Delta({ d }: { d: number | null }) {
  if (d === null || d === 0) return <span className="bdelta">{d === 0 ? 'ללא שינוי' : '—'}</span>;
  return <span className={`bdelta ${d > 0 ? 'is-up' : 'is-down'}`}><Ltr>{d > 0 ? `+${d}%` : `−${Math.abs(d)}%`}</Ltr></span>;
}

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
      .catch(() => { if (alive) setState({ orders: [], loading: false, error: 'אין הרשאה או אין חיבור – נסה "רענן"' }); });
    return () => { alive = false; };
  }, [enabled, r.from, r.to, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

/* חלק בבורד: כותרת, משפט מסכם, ותוכן */
function Section({ id, title, meta, tool, lead, children }: { id: string; title: string; meta?: ReactNode; tool?: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <section className="bsec" aria-labelledby={`b-${id}`}>
      <header className="bsec__head">
        <h2 id={`b-${id}`} className="bsec__title">{title}</h2>
        {meta && <span className="bsec__meta">{meta}</span>}
        {tool && <span className="bsec__tool">{tool}</span>}
      </header>
      {lead && <div className="bsec__lead">{lead}</div>}
      {children}
    </section>
  );
}

export function BoardPage() {
  const { orders, now, quotes, loading, quoteFollowups } = useStore();
  const goals = useGoals();
  const nav = useNavigate();
  const [period, setPeriod] = usePref<Period>('board:period', 'month');
  const [custom, setCustom] = useState<Range>(() => ({ from: toISODate(addDays(now, -13)), to: toISODate(now) }));
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [layout, setLayout] = usePref<Layout>('board:layout2', { order: DEFAULT_ORDER, hidden: [] });
  const order = [...layout.order.filter((k) => k in SECTIONS), ...DEFAULT_ORDER.filter((k) => !layout.order.includes(k))];
  const hidden = layout.hidden.filter((k) => k in SECTIONS);

  const { cur, prev, prevName } = periodRanges(period, now, custom);
  const storeSince = toISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const need: Range = { from: prev.from < cur.from ? prev.from : cur.from, to: cur.to };
  const usingRemote = need.from < storeSince;
  const remote = useRemote(usingRemote, need);
  const source = usingRemote ? remote.orders : orders;

  const options = useMemo(() => {
    const uniq = (f: (o: OrderView) => string) => [...new Set(orders.concat(source).map(f).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he'));
    return { clusters: uniq((o) => o.cluster), branches: uniq((o) => o.branchName), handlers: uniq((o) => o.handler), methods: uniq((o) => o.method) };
  }, [orders, source]);
  const scoped = useMemo(() => applyFilters(source, filters), [source, filters]);
  const scopedLive = useMemo(() => applyFilters(orders, filters), [orders, filters]);

  const h = useMemo(() => horizon(scopedLive, now), [scopedLive, now]);
  const s = useMemo(() => sales(scoped, cur), [scoped, cur.from, cur.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const sp = useMemo(() => sales(scoped, prev), [scoped, prev.from, prev.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const daily = useMemo(() => byDay(scoped, cur, prev), [scoped, cur.from, cur.to, prev.from, prev.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const sv = useMemo(() => service(scoped, cur, now), [scoped, cur.from, cur.to, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const col = useMemo(() => collections(scopedLive, now), [scopedLive, now]);
  const rk = useMemo(() => rankings(scoped, cur), [scoped, cur.from, cur.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const qs = useMemo(() => quotesSummary(quotes, cur, now, quoteFollowups.length), [quotes, cur.from, cur.to, now, quoteFollowups.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const busy = loading || (usingRemote && remote.loading);
  const rangeText = <><Ltr>{fmtDate(cur.from)}</Ltr>–<Ltr>{fmtDate(cur.to)}</Ltr></>;
  const nowText = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const render: Record<SectionKey, () => JSX.Element> = {
    upcoming: () => <Upcoming h={h} now={now} go={nav} />,
    sales: () => <SalesSection s={s} sp={sp} prevName={prevName} daily={daily} goals={goals} period={period} cur={cur} now={now} rangeText={rangeText} />,
    service: () => <ServiceSection sv={sv} goal={goals.onTimePct} rangeText={rangeText} go={nav} />,
    collections: () => <CollectionsSection c={col} go={nav} />,
    customers: () => <CustomersSection rows={rk.customers} customers={s.customers} rangeText={rangeText} />,
    branches: () => <BranchesSection clusters={rk.clusters} branches={rk.branches} rangeText={rangeText} />,
    team: () => <TeamSection rows={rk.team} rangeText={rangeText} />,
    quotes: () => <QuotesSection q={qs} rangeText={rangeText} go={nav} />,
  };

  const active = (Object.entries(filters) as [keyof Filters, string][]).filter(([, v]) => v);
  const FILTER_NAME: Record<keyof Filters, string> = { cluster: 'אשכול', branch: 'סניף', handler: 'נציג', method: 'אמצעי תשלום' };

  return (
    <div className="page board">
      <header className="page__head board__head">
        <div>
          <h1 className="page__title">בורד</h1>
          <p className="page__sub">נכון ל-<Ltr>{nowText}</Ltr> · סכומים לפי תאריך אספקה, בלי ביטולים.</p>
        </div>
        <div className="page__head-end">
          <LayoutMenu order={order} hidden={hidden} onChange={(o, hd) => setLayout({ order: o, hidden: hd })} />
        </div>
      </header>

      <div className="board__bar">
        <div className="seg board__period" role="group" aria-label="תקופה">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => <button key={p} className={period === p ? 'is-on' : ''} aria-pressed={period === p} onClick={() => setPeriod(p)}>{PERIOD_LABEL[p]}</button>)}
        </div>
        {period === 'custom' && (
          <span className="report__dates">
            <input type="date" className="input input--sm" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} aria-label="מתאריך" />
            <span aria-hidden="true">–</span>
            <input type="date" className="input input--sm" value={custom.to} min={custom.from} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} aria-label="עד תאריך" />
          </span>
        )}
        <span className="board__vs">לעומת {prevName}</span>
        <Popover.Root>
          <Popover.Trigger asChild>
            <Button variant="secondary" size="sm" icon={<Filter size={15} />}>סינון{active.length > 0 && <span className="board__fcount"><Ltr>{active.length}</Ltr></span>}</Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content className="pop bfilter" align="end" sideOffset={6} dir="rtl">
              <p className="pop__title">סינון הבורד</p>
              <label className="field"><span className="field__label">אשכול</span>
                <select className="input" value={filters.cluster} onChange={(e) => setFilters({ ...filters, cluster: e.target.value, branch: '' })}>
                  <option value="">כל האשכולות</option>{options.clusters.map((c) => <option key={c} value={c}>{c}</option>)}
                </select></label>
              <label className="field"><span className="field__label">סניף</span>
                <select className="input" value={filters.branch} onChange={(e) => setFilters({ ...filters, branch: e.target.value })}>
                  <option value="">כל הסניפים</option>{options.branches.filter((b) => !filters.cluster || orders.concat(source).some((o) => o.branchName === b && o.cluster === filters.cluster)).map((b) => <option key={b} value={b}>{b}</option>)}
                </select></label>
              <label className="field"><span className="field__label">נציג</span>
                <select className="input" value={filters.handler} onChange={(e) => setFilters({ ...filters, handler: e.target.value })}>
                  <option value="">כל הנציגים</option>{options.handlers.map((x) => <option key={x} value={x}>{x}</option>)}
                </select></label>
              <label className="field"><span className="field__label">אמצעי תשלום</span>
                <select className="input" value={filters.method} onChange={(e) => setFilters({ ...filters, method: e.target.value })}>
                  <option value="">כל אמצעי התשלום</option>{options.methods.map((x) => <option key={x} value={x}>{METHOD_LABEL[x] ?? x}</option>)}
                </select></label>
              {active.length > 0 && <button type="button" className="link bfilter__clear" onClick={() => setFilters(NO_FILTERS)}>נקה את כל הסינון</button>}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        {usingRemote && <Button variant="ghost" size="sm" icon={<RefreshCw size={15} />} loading={remote.loading} onClick={remote.reload}>רענן</Button>}
      </div>
      {active.length > 0 && (
        <div className="board__chips" aria-label="סינון פעיל">
          {active.map(([k, v]) => (
            <button key={k} type="button" className="chip is-on" onClick={() => setFilters({ ...filters, [k]: '', ...(k === 'cluster' ? { branch: '' } : {}) })} aria-label={`הסר סינון ${FILTER_NAME[k]}: ${v}`}>
              {FILTER_NAME[k]}: {k === 'method' ? METHOD_LABEL[v] ?? v : v} <X size={13} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {remote.error && usingRemote && <p className="cform__formerr" role="alert">{remote.error}</p>}

      {busy ? (
        <div className="bsec board__loading" aria-busy="true" aria-label="טוען את הבורד">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={22} />)}</div>
      ) : (
        <div className="board__grid">
          {order.filter((k) => !hidden.includes(k)).map((k) => <div key={k} className={`board__slot ${WIDE.includes(k) ? 'is-wide' : ''}`}>{render[k]()}</div>)}
        </div>
      )}
    </div>
  );
}

/* ---------- הזמנות קרובות: 7 ימים, ולכל יום – כמה מוכנות ---------- */
function Upcoming({ h, now, go }: { h: ReturnType<typeof horizon>; now: Date; go: (to: string) => void }) {
  const today = toISODate(now);
  const tomorrow = toISODate(addDays(now, 1));
  const pending = h.week.customer + h.week.ops;
  const dayName = (iso: string) => (iso === today ? 'היום' : iso === tomorrow ? 'מחר' : WEEKDAY[new Date(iso + 'T12:00').getDay()]);
  const linkFor = (iso: string) => (iso === today ? '/orders?tab=today' : iso === tomorrow ? '/orders?tab=tomorrow' : '/orders?tab=future');
  return (
    <Section id="up" title="הזמנות קרובות" meta="7 הימים הקרובים"
      lead={h.week.count === 0 ? <p>אין הזמנות פתוחות בשבוע הקרוב.</p> : (
        <>
          <p>בשבוע הקרוב {orders$(h.week.count)} בסך <Ltr>{fmtMoney(h.week.sum)}</Ltr>{h.week.pizzas > 0 && <>, {pizzas$(h.week.pizzas)}</>}.</p>
          {pending > 0
            ? <p className="is-warn">עוד לא מוכנות: {h.week.customer > 0 && <>{h.week.customer === 1 ? 'אחת ממתינה' : <><Ltr>{h.week.customer}</Ltr> ממתינות</>} לאישור הלקוח</>}{h.week.customer > 0 && h.week.ops > 0 && ', '}{h.week.ops > 0 && <>{h.week.ops === 1 ? 'אחת לא עודכנה' : <><Ltr>{h.week.ops}</Ltr> לא עודכנו</>} בתפעול</>}.</p>
            : <p className="is-ok">כל ההזמנות אושרו מול הלקוח ועודכנו בתפעול.</p>}
        </>
      )}>
      <div className="bdays" role="list">
        {h.days.map((d) => (
          <button key={d.date} type="button" role="listitem" className={`bday ${d.weekend ? 'is-weekend' : ''} ${d.count ? '' : 'is-empty'}`} onClick={() => go(linkFor(d.date))}
            aria-label={`${dayName(d.date)} ${short(d.date)}: ${d.count} הזמנות`}>
            <span className="bday__name">{dayName(d.date)}{d.weekend && <small>סופ"ש</small>}</span>
            <span className="bday__date"><Ltr>{short(d.date)}</Ltr></span>
            <span className="bday__count"><Ltr>{d.count ? num(d.count) : '—'}</Ltr></span>
            {d.count > 0 && <>
              <span className="bday__sum"><Ltr>{fmtMoney(d.sum)}</Ltr></span>
              <span className="bday__piz">{d.pizzas ? pizzas$(d.pizzas) : ' '}</span>
              <span className="bready" aria-hidden="true">
                {d.ready > 0 && <span className="is-ready" style={{ flexGrow: d.ready }} />}
                {d.customer > 0 && <span className="is-customer" style={{ flexGrow: d.customer }} />}
                {d.ops > 0 && <span className="is-ops" style={{ flexGrow: d.ops }} />}
              </span>
            </>}
          </button>
        ))}
        <button type="button" role="listitem" className="bday bday--later" onClick={() => go('/orders?tab=future')}>
          <span className="bday__name">אחר כך</span>
          <span className="bday__date">מעבר לשבוע</span>
          <span className="bday__count"><Ltr>{h.later.count ? num(h.later.count) : '—'}</Ltr></span>
          {h.later.count > 0 && <span className="bday__sum"><Ltr>{fmtMoney(h.later.sum)}</Ltr></span>}
        </button>
      </div>
      <ul className="blegend" aria-label="מקרא מוכנות">
        <li><i className="is-ready" />מוכנה</li><li><i className="is-customer" />ממתינה לאישור הלקוח</li><li><i className="is-ops" />לא עודכנה בתפעול</li>
      </ul>
    </Section>
  );
}

/* ---------- מכירות: המשפט, שלוש שורות משנה, יעדים, וגרף מול התקופה הקודמת ---------- */
function SalesSection({ s, sp, prevName, daily, goals, period, cur, now, rangeText }: {
  s: ReturnType<typeof sales>; sp: ReturnType<typeof sales>; prevName: string; daily: DayPoint[]; goals: Goals; period: Period; cur: Range; now: Date; rangeText: ReactNode;
}) {
  const monthly = period === 'month' || period === 'prevMonth';
  const goalRows = monthly ? ([['revenue', 'הכנסות', s.sum], ['orders', 'הזמנות', s.count]] as const).filter(([k]) => goals[k]) : [];
  return (
    <Section id="sales" title="מכירות" meta={rangeText}>
      <div className="bsales">
        <div className="bsales__sum">
          <p className="bsales__big"><Ltr>{fmtMoney(s.sum)}</Ltr></p>
          <p className="bsales__of">מ{s.count === 1 ? 'הזמנה אחת' : <>-<Ltr>{num(s.count)}</Ltr> הזמנות</>}</p>
          <p className="bsales__chg"><Change d={delta(s.sum, sp.sum)} vs={prevName} /></p>
          <dl className="bkv">
            <div><dt>ממוצע להזמנה</dt><dd><Ltr>{fmtMoney(s.avg)}</Ltr><Delta d={delta(s.avg, sp.avg)} /></dd></div>
            <div><dt>הזמנות</dt><dd><Ltr>{num(s.count)}</Ltr><Delta d={delta(s.count, sp.count)} /></dd></div>
            <div><dt>פיצות</dt><dd><Ltr>{num(s.pizzas)}</Ltr><Delta d={delta(s.pizzas, sp.pizzas)} /></dd></div>
            <div><dt>לקוחות שהזמינו</dt><dd><Ltr>{num(s.customers)}</Ltr><Delta d={delta(s.customers, sp.customers)} /></dd></div>
          </dl>
          {goalRows.length > 0 && (
            <div className="bgoals">
              <p className="bgoals__title">יעדי החודש</p>
              {goalRows.map(([k, label, value]) => {
                const goal = goals[k]!;
                const pace = goalPace(value, goal, cur, now, period === 'month');
                const money = k === 'revenue';
                return (
                  <div key={k} className="bgoal">
                    <div className="bgoal__row"><span>{label}</span><b><Ltr>{pace.pct}%</Ltr></b></div>
                    <span className="bgoal__track" aria-hidden="true"><span className="bgoal__fill" style={{ width: `${Math.min(100, pace.pct)}%` }} /></span>
                    <span className="bgoal__note">
                      <Ltr>{money ? fmtMoney(value) : num(value)}</Ltr> מתוך <Ltr>{money ? fmtMoney(goal) : num(goal)}</Ltr>
                      {pace.projected !== null && <> · בקצב הזה: <Ltr>{money ? fmtMoney(pace.projected) : num(Math.round(pace.projected))}</Ltr></>}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DailyChart points={daily} prevName={prevName} />
      </div>
    </Section>
  );
}

/* גרף: עמודה לכל יום, ולצידה בגוון אפור – היום המקביל בתקופה הקודמת. הכנסות או הזמנות */
function DailyChart({ points, prevName }: { points: DayPoint[]; prevName: string }) {
  const [metric, setMetric] = usePref<'sum' | 'count'>('board:metric', 'sum');
  const [hover, setHover] = useState<number | null>(null);
  const val = (p: DayPoint) => (metric === 'sum' ? p.sum : p.count);
  const pv = (p: DayPoint) => (metric === 'sum' ? p.prevSum : p.prevCount);
  const max = Math.max(1, ...points.map((p) => Math.max(val(p), pv(p))));
  const mag = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => max / x <= 4) ?? mag * 10;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const tick = (v: number) => (metric === 'sum' ? (v >= 10000 ? `₪${num(v / 1000)}K` : `₪${num(v)}`) : num(v));
  const every = points.length <= 10 ? 1 : points.length <= 21 ? 3 : 7;
  const h = hover !== null ? points[hover] : null;
  const empty = points.every((p) => !val(p) && !pv(p));
  return (
    <div className="bdaily">
      <div className="bdaily__head">
        <div className="seg seg--sm" role="group" aria-label="מה להציג בגרף">
          <button className={metric === 'sum' ? 'is-on' : ''} aria-pressed={metric === 'sum'} onClick={() => setMetric('sum')}>הכנסות</button>
          <button className={metric === 'count' ? 'is-on' : ''} aria-pressed={metric === 'count'} onClick={() => setMetric('count')}>הזמנות</button>
        </div>
        <ul className="blegend">
          <li><i className="is-cur" />התקופה</li><li><i className="is-prev" />{prevName}</li>
        </ul>
      </div>
      {empty ? <p className="bsec__empty bdaily__empty">אין הזמנות בתקופה הזו.</p> : (
        <div className="bchart" onMouseLeave={() => setHover(null)}>
          <div className="bchart__grid" aria-hidden="true">
            {ticks.map((v) => <span key={v} style={{ bottom: `${(v / top) * 100}%` }}><bdi dir="ltr">{tick(v)}</bdi></span>)}
          </div>
          <div className="bchart__plot" role="img" aria-label={`${metric === 'sum' ? 'הכנסות' : 'הזמנות'} לפי יום, מול ${prevName}`}>
            {points.map((p, i) => (
              <div key={p.date} className={`bchart__col ${hover === i ? 'is-hover' : ''}`} onMouseEnter={() => setHover(i)}>
                <span className="bchart__pair">
                  <span className="bchart__bar is-cur" style={{ height: `${(val(p) / top) * 100}%` }} />
                  <span className="bchart__bar is-prev" style={{ height: `${(pv(p) / top) * 100}%` }} />
                </span>
                {i % every === 0 && <span className="bchart__x"><Ltr>{short(p.date)}</Ltr></span>}
              </div>
            ))}
            {h && hover !== null && (
              <div className="bchart__tip" style={{ insetInlineStart: `${((hover + 0.5) / points.length) * 100}%` }}>
                <b><Ltr>{fmtDate(h.date)}</Ltr></b>
                <span>{metric === 'sum' ? <Ltr>{fmtMoney(h.sum)}</Ltr> : orders$(h.count)}</span>
                <span className="bchart__tip-prev">{prevName}: {metric === 'sum' ? <Ltr>{fmtMoney(h.prevSum)}</Ltr> : orders$(h.prevCount)}</span>
              </div>
            )}
          </div>
        </div>
      )}
      {!empty && <details className="bchart__table">
        <summary>הצג כטבלה</summary>
        <div className="report__scroll">
          <table className="rtable">
            <thead><tr><th>תאריך</th><th className="num">הזמנות</th><th className="num">הכנסות</th><th className="num">הזמנות – {prevName}</th><th className="num">הכנסות – {prevName}</th></tr></thead>
            <tbody>{points.map((p) => <tr key={p.date}><td><Ltr>{fmtDate(p.date)}</Ltr></td><td className="num"><Ltr>{p.count}</Ltr></td><td className="num"><Ltr>{fmtMoney(p.sum)}</Ltr></td><td className="num"><Ltr>{p.prevCount}</Ltr></td><td className="num"><Ltr>{fmtMoney(p.prevSum)}</Ltr></td></tr>)}</tbody>
          </table>
        </div>
      </details>}
    </div>
  );
}

/* ---------- עמידה בזמנים ---------- */
function ServiceSection({ sv, goal, rangeText, go }: { sv: ReturnType<typeof service>; goal?: number; rangeText: ReactNode; go: (to: string) => void }) {
  const segs = [
    { k: 'is-ready', label: 'בזמן', v: sv.onTime }, { k: 'is-customer', label: 'באיחור', v: sv.late },
    { k: 'is-ops', label: 'חלקית', v: sv.partial }, { k: 'is-cancel', label: 'בוטלו', v: sv.cancelled },
  ];
  return (
    <Section id="svc" title="עמידה בזמנים" meta={rangeText}
      lead={sv.delivered === 0 ? <p>עוד לא סופקו הזמנות בתקופה הזו.</p> : (
        <>
          <p className="bsec__stmt"><b><Ltr>{sv.onTimePct}%</Ltr></b> מההזמנות סופקו בזמן</p>
          <p className="muted">מתוך {orders$(sv.delivered)} שסופקו{goal ? <> · היעד: <span className={(sv.onTimePct ?? 0) >= goal ? 'is-ok' : 'is-warn'}><Ltr>{goal}%</Ltr></span></> : null}</p>
        </>
      )}>
      {sv.closed > 0 && (
        <>
          <div className="bstack" role="img" aria-label={segs.map((x) => `${x.label} ${x.v}`).join(', ')}>
            {segs.filter((x) => x.v > 0).map((x) => <span key={x.k} className={x.k} style={{ flexGrow: x.v }} />)}
          </div>
          <ul className="bstats">
            {segs.map((x) => <li key={x.k}><i className={x.k} aria-hidden="true" />{x.label}<b><Ltr>{num(x.v)}</Ltr></b><span><Ltr>{Math.round((x.v / sv.closed) * 100)}%</Ltr></span></li>)}
          </ul>
        </>
      )}
      {sv.lateBranches.length > 0 && (
        <div className="bsub">
          <p className="bsub__title">איפה היו איחורים</p>
          <ul className="blist">
            {sv.lateBranches.map((b) => <li key={b.name}><span>{b.name}</span><span className="muted">{b.late === 1 ? 'איחור אחד' : <><Ltr>{b.late}</Ltr> איחורים</>} מתוך <Ltr>{b.delivered}</Ltr></span></li>)}
          </ul>
        </div>
      )}
      {sv.overdue > 0 && <button type="button" className="link bsec__alert" onClick={() => go('/orders?tab=overdue')}>{sv.overdue === 1 ? 'הזמנה אחת שעבר מועדה עוד לא נסגרה' : <><Ltr>{sv.overdue}</Ltr> הזמנות שעבר מועדן עוד לא נסגרו</>}</button>}
    </Section>
  );
}

/* ---------- גבייה ובקרת קופה ---------- */
function CollectionsSection({ c, go }: { c: ReturnType<typeof collections>; go: (to: string) => void }) {
  const tones = ['is-a1', 'is-a2', 'is-a3'];
  return (
    <Section id="col" title="גבייה ובקרת קופה" meta="מצב נוכחי"
      lead={c.open.count === 0 ? <p>אין הקפות שממתינות לגבייה.</p> : (
        <>
          <p className="bsec__stmt"><b><Ltr>{fmtMoney(c.open.sum)}</Ltr></b> בהקפה ממתינים לגבייה</p>
          <p className="muted">מ{c.open.count === 1 ? 'הזמנה אחת' : <>-<Ltr>{num(c.open.count)}</Ltr> הזמנות</>}, לפי ותק:</p>
        </>
      )}>
      {c.open.count > 0 && (
        <>
          <div className="bstack" role="img" aria-label={c.aging.map((a) => `${a.label} ${fmtMoney(a.sum)}`).join(', ')}>
            {c.aging.map((a, i) => (a.sum > 0 ? <span key={a.label} className={tones[i]} style={{ flexGrow: a.sum }} /> : null))}
          </div>
          <ul className="bstats">
            {c.aging.map((a, i) => <li key={a.label}><i className={tones[i]} aria-hidden="true" />{a.label}<b><Ltr>{fmtMoney(a.sum)}</Ltr></b><span>{orders$(a.count)}</span></li>)}
          </ul>
        </>
      )}
      <ul className="bchecks">
        <li><button type="button" onClick={() => go('/exceptions?rule=2')} className={c.gaps.count ? 'is-alert' : ''}>
          <span>פערים בין ההזמנה לקופה (Q)</span>
          <b>{c.gaps.count ? <>{orders$(c.gaps.count)} · <Ltr>{fmtMoney(c.gaps.sum)}</Ltr></> : 'אין'}</b>
        </button></li>
        <li><button type="button" onClick={() => go('/exceptions?rule=7')} className={c.failed.count ? 'is-alert' : ''}>
          <span>חיובי אשראי שנכשלו</span>
          <b>{c.failed.count ? <>{orders$(c.failed.count)} · <Ltr>{fmtMoney(c.failed.sum)}</Ltr></> : 'אין'}</b>
        </button></li>
        <li><button type="button" onClick={() => go('/reports/credit')}><span>דוח הקפות מלא</span><b className="muted">לדוח</b></button></li>
      </ul>
    </Section>
  );
}

/* ---------- לקוחות / סניפים / צוות ---------- */
function Share({ rows, limit, extra }: { rows: Ranked[]; limit: number; extra?: (r: Ranked) => ReactNode }) {
  const max = Math.max(1, ...rows.map((r) => r.sum));
  return (
    <ol className="bshare">
      {rows.slice(0, limit).map((r) => (
        <li key={r.name}>
          <span className="bshare__name" title={r.name}>{r.name}</span>
          <span className="bshare__val"><Ltr>{fmtMoney(r.sum)}</Ltr></span>
          <span className="bshare__track" aria-hidden="true"><span style={{ width: `${(r.sum / max) * 100}%` }} /></span>
          <span className="bshare__meta"><Ltr>{r.share}%</Ltr> מההכנסות · {orders$(r.count)}{extra?.(r)}</span>
        </li>
      ))}
    </ol>
  );
}
function CustomersSection({ rows, customers, rangeText }: { rows: Ranked[]; customers: number; rangeText: ReactNode }) {
  const top = rows[0];
  return (
    <Section id="cust" title="לקוחות" meta={rangeText}
      lead={!top ? <p>אין הזמנות בתקופה הזו.</p> : (
        <>
          <p><b>{top.name}</b> הוא הלקוח הגדול בתקופה, עם <Ltr>{top.share}%</Ltr> מההכנסות.</p>
          <p className="muted">{count(customers, 'לקוח אחד הזמין', 'לקוחות הזמינו')} בתקופה.</p>
        </>
      )}>
      {top && <Share rows={rows} limit={6} />}
    </Section>
  );
}
function BranchesSection({ clusters, branches, rangeText }: { clusters: Ranked[]; branches: Ranked[]; rangeText: ReactNode }) {
  const [by, setBy] = useState<'clusters' | 'branches'>('clusters');
  const rows = by === 'clusters' ? clusters : branches;
  const top = rows[0];
  return (
    <Section id="br" title="סניפים ואשכולות" meta={rangeText}
      tool={<div className="seg seg--sm" role="group" aria-label="פילוח"><button className={by === 'clusters' ? 'is-on' : ''} aria-pressed={by === 'clusters'} onClick={() => setBy('clusters')}>אשכולות</button><button className={by === 'branches' ? 'is-on' : ''} aria-pressed={by === 'branches'} onClick={() => setBy('branches')}>סניפים</button></div>}
      lead={!top ? <p>אין הזמנות בתקופה הזו.</p> : <p>{by === 'clusters' ? 'אשכול' : 'סניף'} <b>{top.name}</b> מוביל, עם <Ltr>{top.share}%</Ltr> מההכנסות.</p>}>
      {top && <Share rows={rows} limit={6} extra={(r) => (r.onTimePct === null ? null : <> · <Ltr>{r.onTimePct}%</Ltr> בזמן</>)} />}
    </Section>
  );
}
function TeamSection({ rows, rangeText }: { rows: Ranked[]; rangeText: ReactNode }) {
  const top = rows[0];
  return (
    <Section id="team" title="צוות" meta={rangeText}
      lead={!top ? <p>אין הזמנות בתקופה הזו.</p> : <p>הכי הרבה הכנסות בתקופה: <b>{top.name}</b> – {orders$(top.count)}, <Ltr>{fmtMoney(top.sum)}</Ltr>.</p>}>
      {top && (
        <div className="report__scroll">
          <table className="rtable bteam">
            <thead><tr><th>נציג</th><th className="num">הזמנות</th><th className="num">הכנסות</th><th className="num">חלק מההכנסות</th><th className="num">סופקו בזמן</th><th className="num">עם פרטים חסרים</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className="num"><Ltr>{num(r.count)}</Ltr></td>
                  <td className="num"><Ltr>{fmtMoney(r.sum)}</Ltr></td>
                  <td className="num"><Ltr>{r.share}%</Ltr></td>
                  <td className="num">{r.onTimePct === null ? <span className="muted">—</span> : <Ltr>{r.onTimePct}%</Ltr>}</td>
                  <td className="num">{r.missing ? <span className="is-warn"><Ltr>{num(r.missing)}</Ltr></span> : <span className="muted">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/* ---------- הצעות מחיר ---------- */
function QuotesSection({ q, rangeText, go }: { q: ReturnType<typeof quotesSummary>; rangeText: ReactNode; go: (to: string) => void }) {
  return (
    <Section id="qs" title="הצעות מחיר" meta={rangeText}
      lead={(
        <>
          <p>{q.open === 0 ? 'אין הצעות פתוחות.' : <>{count(q.open, 'הצעה אחת פתוחה', 'הצעות פתוחות')} בשווי <Ltr>{fmtMoney(q.openSum)}</Ltr>.</>}</p>
          <p className="muted">{q.sent === 0 ? 'לא נשלחו הצעות בתקופה הזו.' : <><Ltr>{q.conversion}%</Ltr> מההצעות שנשלחו בתקופה הפכו להזמנה (<Ltr>{q.ordered}</Ltr> מתוך <Ltr>{q.sent}</Ltr>).</>}</p>
        </>
      )}>
      <ul className="bchecks bchecks--row">
        <li><button type="button" onClick={() => go('/quotes?tab=approved')}><span>אושרו וממתינות להזמנה</span><b><Ltr>{num(q.approved)}</Ltr></b></button></li>
        <li><button type="button" onClick={() => go('/quotes?tab=waiting')} className={q.followups ? 'is-alert' : ''}><span>לחזור ללקוח – אין מענה</span><b><Ltr>{num(q.followups)}</Ltr></b></button></li>
        <li><button type="button" onClick={() => go('/quotes?tab=waiting')}><span>תוקפן נגמר בשלושה ימים</span><b><Ltr>{num(q.expiring)}</Ltr></b></button></li>
      </ul>
    </Section>
  );
}

/* ---------- התאמה אישית: אילו חלקים ובאיזה סדר – נשמר אצל כל משתמש ---------- */
function LayoutMenu({ order, hidden, onChange }: { order: SectionKey[]; hidden: SectionKey[]; onChange: (o: SectionKey[], h: SectionKey[]) => void }) {
  const move = (i: number, d: -1 | 1) => { const o = [...order]; const j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; onChange(o, hidden); };
  const toggle = (k: SectionKey) => onChange(order, hidden.includes(k) ? hidden.filter((x) => x !== k) : [...hidden, k]);
  return (
    <Popover.Root>
      <Popover.Trigger asChild><Button variant="secondary" size="sm" icon={<SlidersHorizontal size={15} />}>התאם תצוגה</Button></Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="pop blayout" align="end" sideOffset={6} dir="rtl">
          <p className="pop__title">מה מוצג בבורד, ובאיזה סדר</p>
          <ul className="blayout__list">
            {order.map((k, i) => (
              <li key={k}>
                <label className="blayout__check"><input type="checkbox" checked={!hidden.includes(k)} onChange={() => toggle(k)} /> {SECTIONS[k]}</label>
                <span className="blayout__move">
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`הזז למעלה: ${SECTIONS[k]}`}><ChevronUp size={15} /></button>
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`הזז למטה: ${SECTIONS[k]}`}><ChevronDown size={15} /></button>
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className="link" onClick={() => onChange(DEFAULT_ORDER, [])}>חזרה לסדר המקורי</button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
