/* בורד הנהלה (שלב 9 – בנוי מחדש בהיררכיה): פס "תמונת מצב" בכחול-לילה עם ארבעה מספרים, ואז כרטיסים שכל אחד נפתח
   במספר-תשובה או במשפט, ומתחתיו הנתונים והקישור לרשימה. כולם רואים. יעד מוצג רק כשהוגדר (הגדרות ← יעדים).
   מכסת קריאות: בלי האזנה חדשה. תקופה שמתחילה לפני החודש הקודם נטענת פעם אחת, עם "רענן". */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { ChevronDown, ChevronLeft, ChevronUp, Clock, Filter, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useStore, type OrderView } from '../../data/store';
import { fromDoc } from '../../data/orders';
import { METHOD_LABEL } from '../../data/types';
import { UNCLASSIFIED } from '../../data/channels';
import { useGoals, type Goals } from '../../data/goals';
import { usePref } from '../../lib/prefs';
import { Button, Skeleton } from '../../design/components';
import { Ltr, addDays, fmtDate, fmtMoney, toISODate } from '../../lib/format';
import { lateLabel, lateSplit } from '../../data/metrics';
import {
  NO_FILTERS, PERIOD_LABEL, applyFilters, byDay, collections, delta, goalPace, horizon, periodRanges, quotesSummary, rankings, sales, service,
  type DayPoint, type Filters, type Period, type Range, type Ranked, type ChannelRanked,
} from './boardData';
import '../pages.css';
import '../reports/ReportsPage.css';
import './Board.css';

type SectionKey = 'goals' | 'upcoming' | 'sales' | 'service' | 'collections' | 'customers' | 'branches' | 'channels' | 'team' | 'quotes';
const SECTIONS: Record<SectionKey, string> = {
  goals: 'יעדים וקצב', upcoming: 'הזמנות קרובות', sales: 'מכירות', service: 'עמידה בזמנים', collections: 'גבייה ובקרת קופה',
  customers: 'לקוחות', branches: 'סניפים ואשכולות', channels: 'לפי ערוץ', team: 'צוות', quotes: 'הצעות מחיר',
};
/* הסדר: יעדים | עמידה בזמנים · הזמנות קרובות · מכירות · לקוחות | סניפים · גבייה | הצעות · ערוצים | צוות */
const DEFAULT_ORDER: SectionKey[] = ['goals', 'service', 'upcoming', 'sales', 'customers', 'branches', 'collections', 'quotes', 'channels', 'team'];
const WIDE: SectionKey[] = ['upcoming', 'sales'];
type Layout = { order: SectionKey[]; hidden: SectionKey[] };

/* ---------- ניסוחים ---------- */
const num = (v: number) => v.toLocaleString('he-IL');
const count = (v: number, one: string, many: string) => (v === 1 ? one : <><Ltr>{num(v)}</Ltr> {many}</>);
const orders$ = (v: number) => count(v, 'הזמנה אחת', 'הזמנות');
const pizzas$ = (v: number) => count(v, 'פיצה אחת', 'פיצות');
const WEEKDAY = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const short = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
/* סכום: ₪ קטן ושקט ליד הספרות (רגע אופי, DESIGN.md v3 "Money") */
function Money({ v, className = '' }: { v: number; className?: string }) {
  return <Ltr><span className={`money ${className}`}><span className="money__cur">₪</span>{fmtMoney(Math.round(v)).replace('₪', '')}</span></Ltr>;
}
/* "+18%" קצר לשורות משנה */
function Delta({ cur, prev }: { cur: number; prev: number }) {
  const d = delta(cur, prev);
  if (d === null || d === 0) return <span className="bdelta">{d === 0 ? 'ללא שינוי' : '—'}</span>;
  if (d > RATIO_FROM) return <span className="bdelta is-up"><span className="sr-only">עלייה </span>פי <Ltr>{(cur / prev).toFixed(1)}</Ltr></span>;
  return <span className={`bdelta ${d > 0 ? 'is-up' : 'is-down'}`}><span className="sr-only">{d > 0 ? 'עלייה' : 'ירידה'} </span><Ltr>{d > 0 ? `+${d}%` : `−${Math.abs(d)}%`}</Ltr></span>;
}
/* שינוי מול התקופה הקודמת. עד 200% – אחוז; מעל זה "פי X · מול <הערך הקודם>" (אחוז ענק על בסיס קטן מטעה) */
const RATIO_FROM = 200;
function Change({ cur, prev, prevText }: { cur: number; prev: number; prevText: ReactNode }) {
  const d = delta(cur, prev);
  if (d === null) return null;
  if (d === 0) return <span className="bchg">ללא שינוי · מול {prevText}</span>;
  const up = d > 0;
  const big = up && d > RATIO_FROM;
  return (
    <span className={`bchg ${up ? 'is-up' : 'is-down'}`}>
      <span aria-hidden="true">{up ? '▲' : '▼'} </span><span className="sr-only">{up ? 'עלייה' : 'ירידה'} </span>
      {big ? <>פי <Ltr>{(cur / prev).toFixed(1)}</Ltr></> : <Ltr>{Math.abs(d)}%</Ltr>}
      <span className="bchg__vs"> · מול {prevText}</span>
    </span>
  );
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

/* חלק בבורד: כותרת, מספר-תשובה / משפט, ותוכן */
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
/* מספר-תשובה בראש כרטיס: מספר גדול ומשפט קצר לידו */
function Answer({ value, children }: { value: ReactNode; children?: ReactNode }) {
  return <p className="bans"><b className="bans__v">{value}</b>{children && <span className="bans__t">{children}</span>}</p>;
}

export function BoardPage() {
  const { orders, now, quotes, loading, quoteFollowups, channels } = useStore();
  const goals = useGoals();
  const nav = useNavigate();
  const [period, setPeriod] = usePref<Period>('board:period', 'month');
  const [custom, setCustom] = useState<Range>(() => ({ from: toISODate(addDays(now, -13)), to: toISODate(now) }));
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  // מפתח חדש (שלב 9): הסדר והחלקים השתנו – כולם מתחילים מהסדר החדש
  const [layout, setLayout] = usePref<Layout>('board:layout3', { order: DEFAULT_ORDER, hidden: [] });
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
  const svp = useMemo(() => service(scoped, prev, now), [scoped, prev.from, prev.to, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const col = useMemo(() => collections(scopedLive, now), [scopedLive, now]);
  const rk = useMemo(() => rankings(scoped, cur), [scoped, cur.from, cur.to, channels]); // eslint-disable-line react-hooks/exhaustive-deps
  const qs = useMemo(() => quotesSummary(quotes, cur, now, quoteFollowups.length), [quotes, cur.from, cur.to, now, quoteFollowups.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const busy = loading || (usingRemote && remote.loading);
  /* התקופה כתובה פעם אחת – בשורת המשנה */
  const rangeText = <Ltr>{cur.from === cur.to ? short(cur.from) : `${short(cur.from)}–${short(cur.to)}`}</Ltr>;
  const nowText = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const render: Record<SectionKey, () => JSX.Element> = {
    goals: () => <GoalsSection s={s} sv={sv} goals={goals} period={period} cur={cur} now={now} go={nav} />,
    upcoming: () => <Upcoming h={h} now={now} go={nav} />,
    sales: () => <SalesSection s={s} sp={sp} prevName={prevName} daily={daily} />,
    service: () => <ServiceSection sv={sv} go={nav} />,
    collections: () => <CollectionsSection c={col} go={nav} />,
    customers: () => <CustomersSection rows={rk.customers} customers={s.customers} />,
    branches: () => <BranchesSection clusters={rk.clusters} branches={rk.branches} />,
    channels: () => <ChannelsSection rows={rk.channels} />,
    team: () => <TeamSection rows={rk.team} />,
    quotes: () => <QuotesSection q={qs} go={nav} />,
  };

  // בלי יעדים מוגדרים – בלי כרטיס יעדים (ההגדרה בהגדרות ← יעדים)
  const hasGoals = !!(goals.orders || goals.revenue || goals.onTimePct);
  // ערוץ אחד ונציג אחד – שורה אחת משותפת במקום שני כרטיסים כמעט ריקים
  const mergeCT = rk.channels.length < 2 && rk.team.length < 2;
  const wide = (k: SectionKey) => WIDE.includes(k);
  // הפס הכחול יצא מהמסך (גללו למטה) – פס הכלים המוקפא מציג את ארבעת המספרים בקטן
  const pulseRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = pulseRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < 0), { rootMargin: '-120px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [busy]);
  const active = (Object.entries(filters) as [keyof Filters, string][]).filter(([, v]) => v);
  const FILTER_NAME: Record<keyof Filters, string> = { cluster: 'אשכול', branch: 'סניף', handler: 'נציג', method: 'אמצעי תשלום' };

  return (
    <div className="page board">
      <header className="page__head board__head">
        <div>
          <h1 className="page__title">בורד</h1>
          <p className="page__sub">{PERIOD_LABEL[period]} · {rangeText} · מול {prevName} · נכון ל-<Ltr>{nowText}</Ltr></p>
        </div>
      </header>

      <div className={`board__bar ${stuck ? 'is-stuck' : ''}`}>
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
        {stuck && !busy && (
          <span className="board__mini" aria-label="תמונת מצב">
            <span>{rangeText}</span>
            <span><small>הכנסות</small> <Money v={s.sum} /></span>
            <span><small>הזמנות</small> <Ltr>{num(s.count)}</Ltr></span>
            {sv.onTimePct !== null && <span><small>בזמן</small> <Ltr>{sv.onTimePct}%</Ltr></span>}
            <span><small>בהקפה</small> <Money v={col.open.sum} /></span>
          </span>
        )}
        <span className="board__tools">
          {usingRemote && <Button variant="ghost" size="sm" icon={<RefreshCw size={16} />} loading={remote.loading} onClick={remote.reload}>רענן</Button>}
          <Popover.Root>
            <Popover.Trigger asChild>
              <Button variant="secondary" size="sm" icon={<Filter size={16} />}>סינון{active.length > 0 && <span className="board__fcount"><Ltr>{active.length}</Ltr></span>}</Button>
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
          <LayoutMenu order={order} hidden={hidden} onChange={(o, hd) => setLayout({ order: o, hidden: hd })} />
        </span>
      </div>
      {active.length > 0 && (
        <div className="board__chips" aria-label="סינון פעיל">
          {active.map(([k, v]) => (
            <button key={k} type="button" className="chip is-on" onClick={() => setFilters({ ...filters, [k]: '', ...(k === 'cluster' ? { branch: '' } : {}) })} aria-label={`הסר סינון ${FILTER_NAME[k]}: ${v}`}>
              {FILTER_NAME[k]}: {k === 'method' ? METHOD_LABEL[v] ?? v : v} <X size={14} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {remote.error && usingRemote && <p className="cform__formerr" role="alert">{remote.error}</p>}

      {busy ? <BoardSkeleton /> : (
        <>
          <div ref={pulseRef}><Pulse s={s} sp={sp} sv={sv} svp={svp} col={col} daily={daily} prevName={prevName} goal={goals.onTimePct} go={nav} /></div>
          {!hasGoals && <p className="board__nogoals">לא הוגדרו יעדים לחודש · <button type="button" className="link" onClick={() => nav('/settings/goals')}>להגדרת יעדים</button></p>}
          <div className="board__grid">
            {order.filter((k) => !hidden.includes(k) && (k !== 'goals' || hasGoals) && !(mergeCT && k === 'team')).map((k) => <div key={k} className={`board__slot ${wide(k) ? 'is-wide' : ''}`}>{mergeCT && k === 'channels' ? <ChannelTeamLine ch={rk.channels} team={rk.team} /> : render[k]()}</div>)}
          </div>
        </>
      )}
    </div>
  );
}

/* שלד טעינה בצורת הבורד – מופיע רק אחרי 300ms, כדי לא להבהב בטעינה מהירה */
function BoardSkeleton() {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 300); return () => clearTimeout(t); }, []);
  if (!show) return <div className="board__wait" aria-busy="true" aria-label="טוען את הבורד" />;
  return (
    <div aria-busy="true" aria-label="טוען את הבורד">
      <div className="bpulse bpulse--skel">{[0, 1, 2, 3].map((i) => <span key={i} className="bpulse__cell"><span className="bskel bskel--dark" style={{ width: '40%' }} /><span className="bskel bskel--dark bskel--big" /></span>)}</div>
      <div className="board__grid">{[0, 1].map((i) => <div key={i} className="bsec"><Skeleton h={18} w="30%" /><div style={{ height: 16 }} /><Skeleton h={32} w="45%" /><div style={{ height: 16 }} /><Skeleton h={12} /></div>)}</div>
    </div>
  );
}

/* ---------- תמונת מצב: פס כחול-לילה עם ארבעה מספרים ----------
   המספרים זהים לאלה שבכרטיסים (אותן פונקציות), והלחיצה מובילה לרשימה. הגרף הזעיר – מצטבר מול התקופה הקודמת (מקווקו). */
function Spark({ cur, prev }: { cur: number[]; prev: number[] }) {
  if (cur.length < 2 || cur.every((v) => !v)) return null;
  const cum = (a: number[]) => a.reduce<number[]>((o, v) => [...o, (o[o.length - 1] ?? 0) + v], []);
  const c = cum(cur), p = cum(prev);
  const max = Math.max(...c, ...p, 1);
  const w = 100, h = 28;
  const line = (a: number[]) => a.map((v, i) => `${(i / (a.length - 1)) * w},${h - 2 - (v / max) * (h - 4)}`).join(' ');
  /* ציר הזמן מימין לשמאל, כמו בגרף: היום הראשון בימין */
  return (
    <svg className="bpulse__spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" style={{ transform: 'scaleX(-1)' }}>
      {p.some(Boolean) && <polyline className="bpulse__prev" points={line(p)} />}
      <polyline className="bpulse__line" points={line(c)} />
    </svg>
  );
}
function Pulse({ s, sp, sv, svp, col, daily, prevName, goal, go }: {
  s: ReturnType<typeof sales>; sp: ReturnType<typeof sales>; sv: ReturnType<typeof service>; svp: ReturnType<typeof service>;
  col: ReturnType<typeof collections>; daily: DayPoint[]; prevName: string; goal?: number; go: (to: string) => void;
}) {
  /* הגרף הזעיר – עד אתמול: היום עוד לא נגמר ומושך את הקו למטה */
  const today = toISODate(new Date());
  const past = daily.filter((p) => p.date < today);
  const onTimeD = sv.onTimePct !== null && svp.onTimePct !== null ? sv.onTimePct - svp.onTimePct : null;
  const old = col.aging[2];
  return (
    <section className="bpulse" aria-label="תמונת מצב">
      <button type="button" className="bpulse__cell" onClick={() => go('/reports')}>
        <span className="bpulse__label">הכנסות</span>
        <span className="bpulse__value"><Money v={s.sum} /></span>
        <span className="bpulse__foot"><Change cur={s.sum} prev={sp.sum} prevText={sp.sum > 0 ? <Money v={sp.sum} /> : prevName} /></span>
        <Spark cur={past.map((p) => p.sum)} prev={past.map((p) => p.prevSum)} />
      </button>
      <button type="button" className="bpulse__cell" onClick={() => go('/orders')}>
        <span className="bpulse__label">הזמנות</span>
        <span className="bpulse__value"><Ltr>{num(s.count)}</Ltr></span>
        <span className="bpulse__foot"><Change cur={s.count} prev={sp.count} prevText={<Ltr>{num(sp.count)}</Ltr>} /></span>
        <Spark cur={past.map((p) => p.count)} prev={past.map((p) => p.prevCount)} />
      </button>
      <button type="button" className="bpulse__cell" onClick={() => go('/reports')}>
        <span className="bpulse__label">סופקו בזמן{goal ? <> · יעד <Ltr>{goal}%</Ltr></> : null}</span>
        <span className="bpulse__value">{sv.onTimePct === null ? <span className="bpulse__none">—</span> : <Ltr>{sv.onTimePct}%</Ltr>}</span>
        <span className="bpulse__foot">
          {onTimeD !== null && onTimeD !== 0 && <span className={`bchg ${onTimeD > 0 ? 'is-up' : 'is-down'}`}><span aria-hidden="true">{onTimeD > 0 ? '▲' : '▼'} </span><span className="sr-only">{onTimeD > 0 ? 'עלייה של' : 'ירידה של'} </span><Ltr>{Math.abs(onTimeD)}</Ltr> נק' <span className="bchg__vs">· מול {prevName}</span></span>}
          {sv.delivered > 0 && <span className="bpulse__vs">{sv.late ? <>באיחור <Ltr>{num(sv.late)}</Ltr> מתוך <Ltr>{num(sv.delivered)}</Ltr></> : 'בלי איחורים'}</span>}
        </span>
        {sv.onTimePct !== null && (
          <span className="bpulse__bar" aria-hidden="true">
            <span className="is-ok" style={{ width: `${sv.onTimePct}%` }} />
            {goal ? <i className="bpulse__goal" style={{ insetInlineStart: `${goal}%` }} /> : null}
          </span>
        )}
      </button>
      <button type="button" className="bpulse__cell" onClick={() => go('/reports/credit')}>
        <span className="bpulse__label">בהקפה לגבייה · עכשיו</span>
        <span className="bpulse__value"><Money v={col.open.sum} /></span>
        <span className="bpulse__foot">
          <span className="bpulse__vs">{col.open.count === 0 ? 'אין הקפות פתוחות' : col.open.count === 1 ? 'הזמנה אחת' : <><Ltr>{num(col.open.count)}</Ltr> הזמנות</>}</span>
          {old.count > 0 ? <span className="bpulse__warn"><Money v={old.sum} /> מעל 60 יום</span> : col.open.count > 0 && <span className="bpulse__vs">{col.aging[1].count ? 'הכל עד 60 יום' : 'הכל עד 30 יום'}</span>}
        </span>
        {col.open.sum > 0 && (
          <span className="bpulse__bar bpulse__bar--stack" aria-hidden="true">
            {col.aging.map((a, i) => (a.sum > 0 ? <span key={a.label} className={['is-n1', 'is-n2', 'is-n3'][i]} style={{ flexGrow: a.sum }} /> : null))}
          </span>
        )}
      </button>
    </section>
  );
}

/* ---------- יעדים וקצב: כרטיס משלו. לכל יעד – ערך מתוך יעד, פס עם "צפוי להיום" וסימון "בקצב / בפיגור" ---------- */
function GoalsSection({ s, sv, goals, period, cur, now, go }: {
  s: ReturnType<typeof sales>; sv: ReturnType<typeof service>; goals: Goals; period: Period; cur: Range; now: Date; go: (to: string) => void;
}) {
  const monthly = period === 'month' || period === 'prevMonth';
  const current = period === 'month';
  const any = !!(goals.orders || goals.revenue || goals.onTimePct);
  if (!any) {
    return (
      <Section id="goals" title="יעדים וקצב">
        <p className="bsec__empty">לא הוגדרו יעדים. <button type="button" className="link" onClick={() => go('/settings/goals')}>להגדרת יעדים</button></p>
      </Section>
    );
  }
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const frac = current ? Math.min(1, now.getDate() / days) : 1; // כמה מהחודש עבר – "צפוי להיום"
  const rows = monthly ? ([['orders', 'הזמנות', s.count, false], ['revenue', 'הכנסות', s.sum, true]] as const).filter(([k]) => goals[k]) : [];
  const first = rows[0];
  const pace = first ? goalPace(first[2], goals[first[0]]!, cur, now, current) : null;
  const fmt = (money: boolean, v: number) => (money ? <Money v={v} /> : <Ltr>{num(v)}</Ltr>);
  return (
    <Section id="goals" title="יעדים וקצב" meta={current ? <>עברו <Ltr>{now.getDate()}</Ltr> מתוך <Ltr>{days}</Ltr> ימים</> : undefined}>
      {first && pace && (
        <p className="bgoals__lead">
          {current && pace.projected !== null
            ? <>בקצב הנוכחי – {fmt(first[3], pace.projected)} {first[3] ? 'הכנסות' : 'הזמנות'} עד סוף החודש{pace.projected >= goals[first[0]]! ? <> · <span className="is-ok">מעל היעד</span></> : <> · חסרות {fmt(first[3], goals[first[0]]! - pace.projected)}</>}</>
            : <><Ltr>{pace.pct}%</Ltr> מיעד ה{first[1]}</>}
        </p>
      )}
      {!monthly && (goals.orders || goals.revenue) && <p className="bsec__empty">יעדי ההזמנות וההכנסות חודשיים – מוצגים בתצוגת חודש.</p>}
      <div className="bgoals">
        {rows.map(([k, label, value, money]) => {
          const goal = goals[k]!;
          const expected = goal * frac;
          const ok = current ? value >= expected * 0.98 : value >= goal;
          return (
            <div key={k} className="bgoal">
              <div className="bgoal__row">
                <span className="bgoal__label">{label}</span>
                <span className="bgoal__val">{fmt(money, value)} <span className="bgoal__of">מתוך {fmt(money, goal)}</span></span>
                <span className={`bgoal__tag ${ok ? 'is-ok' : 'is-behind'}`}>{current ? (ok ? 'בקצב' : 'בפיגור') : ok ? 'הושג' : 'לא הושג'}</span>
              </div>
              <span className="bgoal__track" aria-hidden="true">
                <span className="bgoal__fill" style={{ width: `${Math.min(100, (value / goal) * 100)}%` }} />
                {current && <i className="bgoal__mark" style={{ insetInlineStart: `${frac * 100}%` }} />}
              </span>
              {current && <span className="bgoal__note">צפוי להיום {fmt(money, Math.round(expected))}</span>}
            </div>
          );
        })}
        {goals.onTimePct && (
          <div className="bgoal">
            <div className="bgoal__row">
              <span className="bgoal__label">סופקו בזמן</span>
              <span className="bgoal__val">{sv.onTimePct === null ? '—' : <Ltr>{sv.onTimePct}%</Ltr>} <span className="bgoal__of">יעד <Ltr>{goals.onTimePct}%</Ltr></span></span>
              {sv.onTimePct !== null && <span className={`bgoal__tag ${sv.onTimePct >= goals.onTimePct ? 'is-ok' : 'is-behind'}`}>{sv.onTimePct >= goals.onTimePct ? 'עומד ביעד' : 'מתחת ליעד'}</span>}
            </div>
            <span className="bgoal__track" aria-hidden="true">
              <span className="bgoal__fill" style={{ width: `${sv.onTimePct ?? 0}%` }} />
              <i className="bgoal__mark bgoal__mark--goal" style={{ insetInlineStart: `${goals.onTimePct}%` }} />
            </span>
          </div>
        )}
      </div>
    </Section>
  );
}

/* ---------- הזמנות קרובות: 7 ימים בשורה אחת; ימים ריקים מצטמצמים. בטלפון – גלילה לרוחב, היום ראשון ---------- */
function Upcoming({ h, now, go }: { h: ReturnType<typeof horizon>; now: Date; go: (to: string) => void }) {
  const today = toISODate(now);
  const tomorrow = toISODate(addDays(now, 1));
  const dayName = (iso: string) => (iso === today ? 'היום' : iso === tomorrow ? 'מחר' : WEEKDAY[new Date(iso + 'T12:00').getDay()]);
  const linkFor = (iso: string) => (iso === today ? '/orders?tab=today' : iso === tomorrow ? '/orders?tab=tomorrow' : '/orders?tab=future');
  return (
    <Section id="up" title="הזמנות קרובות" meta="7 הימים הקרובים"
      lead={h.week.count === 0 ? <p className="bsec__empty">אין הזמנות פתוחות בשבוע הקרוב.</p> : (
        <Answer value={<Ltr>{num(h.week.count)}</Ltr>}>{h.week.count === 1 ? 'הזמנה' : 'הזמנות'} בשבוע הקרוב · <Money v={h.week.sum} />{h.week.pizzas > 0 && <> · {pizzas$(h.week.pizzas)}</>}</Answer>
      )}>
      <div className="bdays" role="group" aria-label="הזמנות לפי יום">
        {h.days.map((d) => (
          <button key={d.date} type="button" className={`bday ${d.weekend ? 'is-weekend' : ''} ${d.count ? '' : 'is-empty'} ${d.date === today ? 'is-today' : ''}`} onClick={() => go(linkFor(d.date))}
            aria-label={`${dayName(d.date)} ${short(d.date)}: ${d.count} הזמנות`}>
            <span className="bday__name">{dayName(d.date)}</span>
            <span className="bday__date"><Ltr>{short(d.date)}</Ltr>{d.weekend && <> · סופ"ש</>}</span>
            <span className="bday__count"><Ltr>{d.count ? num(d.count) : '—'}</Ltr></span>
            {d.count > 0 && <>
              <span className="bday__sum"><Money v={d.sum} /></span>
              {d.pizzas > 0 && <span className="bday__piz">{pizzas$(d.pizzas)}</span>}
            </>}
          </button>
        ))}
        <button type="button" className={`bday bday--later ${h.later.count ? '' : 'is-empty'}`} onClick={() => go('/orders?tab=future')}>
          <span className="bday__name">אחר כך</span>
          <span className="bday__date">מעבר לשבוע</span>
          <span className="bday__count"><Ltr>{h.later.count ? num(h.later.count) : '—'}</Ltr></span>
          {h.later.count > 0 && <span className="bday__sum"><Money v={h.later.sum} /></span>}
        </button>
      </div>
    </Section>
  );
}

/* ---------- מכירות: שלושה מדדים בצד, וגרף מול התקופה הקודמת (מצטבר כברירת מחדל, או יומי) ---------- */
function SalesSection({ s, sp, prevName, daily }: { s: ReturnType<typeof sales>; sp: ReturnType<typeof sales>; prevName: string; daily: DayPoint[] }) {
  const cmp = sp.count > 0; // יש תקופה קודמת להשוות אליה
  return (
    <Section id="sales" title="מכירות">
      <div className="bsales">
        <dl className="bkv">
          <div><dt>ממוצע להזמנה</dt><dd><Money v={s.avg} />{cmp && <Delta cur={s.avg} prev={sp.avg} />}</dd></div>
          {(s.pizzas > 0 || sp.pizzas > 0) && <div><dt>פיצות</dt><dd><Ltr>{num(s.pizzas)}</Ltr>{cmp && <Delta cur={s.pizzas} prev={sp.pizzas} />}</dd></div>}
          <div><dt>לקוחות שהזמינו</dt><dd><Ltr>{num(s.customers)}</Ltr>{cmp && <Delta cur={s.customers} prev={sp.customers} />}</dd></div>
        </dl>
        <DailyChart points={daily} prevName={prevName} />
      </div>
    </Section>
  );
}

/* הגרף: מצטבר – קו התקופה מול קו מקווקו של התקופה הקודמת (האם אנחנו לפני או אחרי); יומי – עמודה לכל יום ולצידה היום המקביל */
function DailyChart({ points, prevName }: { points: DayPoint[]; prevName: string }) {
  const [metric, setMetric] = usePref<'sum' | 'count'>('board:metric', 'sum');
  const [mode, setMode] = usePref<'cum' | 'day'>('board:chart', 'cum');
  const [hover, setHover] = useState<number | null>(null);
  const raw = (p: DayPoint) => (metric === 'sum' ? p.sum : p.count);
  const rawPrev = (p: DayPoint) => (metric === 'sum' ? p.prevSum : p.prevCount);
  const acc = (f: (p: DayPoint) => number) => points.reduce<number[]>((o, p) => [...o, (o[o.length - 1] ?? 0) + f(p)], []);
  const cumCur = useMemo(() => acc(raw), [points, metric]); // eslint-disable-line react-hooks/exhaustive-deps
  const cumPrev = useMemo(() => acc(rawPrev), [points, metric]); // eslint-disable-line react-hooks/exhaustive-deps
  const val = (i: number) => (mode === 'cum' ? cumCur[i] : raw(points[i]));
  const pv = (i: number) => (mode === 'cum' ? cumPrev[i] : rawPrev(points[i]));
  const max = Math.max(1, ...points.map((_, i) => Math.max(val(i), pv(i))));
  const mag = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => max / x <= 4) ?? mag * 10;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const tick = (v: number) => (metric === 'sum' ? (v >= 10000 ? `₪${num(v / 1000)}K` : `₪${num(v)}`) : num(v));
  const every = points.length <= 10 ? 1 : points.length <= 21 ? 3 : 7;
  const hp = hover !== null ? points[hover] : null;
  const empty = points.every((p) => !raw(p) && !rawPrev(p));
  const n = points.length;
  // קו מצטבר: הנקודה של כל יום במרכז העמודה שלו. RTL – היום הראשון בימין
  const xAt = (i: number) => 100 - ((i + 0.5) / n) * 100;
  const yAt = (v: number) => 100 - (v / top) * 100;
  const line = (a: number[]) => a.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ');
  const fmtV = (v: number) => (metric === 'sum' ? <Money v={v} /> : orders$(v));
  return (
    <div className="bdaily">
      <div className="bdaily__head">
        <div className="seg seg--sm" role="group" aria-label="מה להציג בגרף">
          <button className={metric === 'sum' ? 'is-on' : ''} aria-pressed={metric === 'sum'} onClick={() => setMetric('sum')}>הכנסות</button>
          <button className={metric === 'count' ? 'is-on' : ''} aria-pressed={metric === 'count'} onClick={() => setMetric('count')}>הזמנות</button>
        </div>
        <div className="seg seg--sm" role="group" aria-label="סוג הגרף">
          <button className={mode === 'cum' ? 'is-on' : ''} aria-pressed={mode === 'cum'} onClick={() => setMode('cum')}>מצטבר</button>
          <button className={mode === 'day' ? 'is-on' : ''} aria-pressed={mode === 'day'} onClick={() => setMode('day')}>יומי</button>
        </div>
        <ul className="blegend">
          <li><i className="is-cur" />התקופה</li><li><i className={mode === 'cum' ? 'is-prev-line' : 'is-prev'} />{prevName}</li>
        </ul>
      </div>
      {empty ? (
        <div className="bchart bchart--empty"><span className="bchart__zero" /><p className="bsec__empty">אין הזמנות בתקופה הזו.</p></div>
      ) : (
        <div className="bchart" onMouseLeave={() => setHover(null)}>
          <div className="bchart__grid" aria-hidden="true">
            {ticks.map((v) => <span key={v} style={{ bottom: `${(v / top) * 100}%` }}><bdi dir="ltr">{tick(v)}</bdi></span>)}
          </div>
          <div className="bchart__plot" role="img" aria-label={`${metric === 'sum' ? 'הכנסות' : 'הזמנות'} ${mode === 'cum' ? 'מצטברות' : 'לפי יום'}: בתקופה ${metric === 'sum' ? fmtMoney(cumCur[n - 1] ?? 0) : num(cumCur[n - 1] ?? 0)}, ב${prevName} ${metric === 'sum' ? fmtMoney(cumPrev[n - 1] ?? 0) : num(cumPrev[n - 1] ?? 0)}`}>
            {mode === 'cum' && (
              <svg className="bchart__lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline className="bchart__prevline" points={line(cumPrev)} />
                <polyline className="bchart__curline" points={line(cumCur)} />
              </svg>
            )}
            {points.map((p, i) => (
              <div key={p.date} className={`bchart__col ${hover === i ? 'is-hover' : ''}`} onMouseEnter={() => setHover(i)}>
                {mode === 'day' && (
                  <span className="bchart__pair">
                    <span className="bchart__bar is-cur" style={{ height: `${(val(i) / top) * 100}%` }} />
                    <span className="bchart__bar is-prev" style={{ height: `${(pv(i) / top) * 100}%` }} />
                  </span>
                )}
                {mode === 'cum' && hover === i && <span className="bchart__dot" style={{ bottom: `${(val(i) / top) * 100}%` }} />}
                {i % every === 0 && <span className="bchart__x"><Ltr>{short(p.date)}</Ltr></span>}
              </div>
            ))}
            {hp && hover !== null && (
              <div className="bchart__tip" style={{ insetInlineStart: `${((hover + 0.5) / n) * 100}%` }}>
                <b><Ltr>{fmtDate(hp.date)}</Ltr></b>
                <span>{mode === 'cum' ? 'עד היום הזה: ' : ''}{fmtV(val(hover))}</span>
                <span className="bchart__tip-prev">{prevName}: {fmtV(pv(hover))}</span>
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

/* ---------- עמידה בזמנים: המספר הראשי – כמה איחורים; פס של מה שקיים ושורות מיושרות ---------- */
function ServiceSection({ sv, go }: { sv: ReturnType<typeof service>; go: (to: string) => void }) {
  /* בזמן + באיחור = כל מה שסופק (כמו בדוחות). האחוזים – מתוך מה שסופק. חלקית ובוטלו – שורות משנה, בלי פס */
  const segs = [
    { k: 'is-ready', label: 'בזמן', v: sv.onTime },
    { k: 'is-late-minor', label: lateLabel('minor'), v: sv.lateMinor },
    { k: 'is-late-major', label: lateLabel('major'), v: sv.lateMajor },
    ...(sv.lateUnknown ? [{ k: 'is-late-unknown', label: lateLabel('unknown'), v: sv.lateUnknown }] : []),
  ];
  const pct = (v: number) => (sv.delivered ? Math.round((v / sv.delivered) * 100) : 0);
  return (
    <Section id="svc" title="עמידה בזמנים"
      lead={sv.delivered === 0 ? <p className="bsec__empty">עוד לא סופקו הזמנות בתקופה הזו.</p>
        : sv.late === 0 ? <Answer value={<Ltr>{sv.onTimePct}%</Ltr>}>בזמן · כל {orders$(sv.delivered)} שסופקו, בלי איחורים</Answer>
          : <Answer value={<Ltr>{num(sv.late)}</Ltr>}>{sv.late === 1 ? 'איחור' : 'איחורים'} מתוך <Ltr>{num(sv.delivered)}</Ltr> שסופקו · <Ltr>{pct(sv.late)}%</Ltr></Answer>}>
      {sv.delivered > 0 && (
        <>
          <div className="bstack" role="img" aria-label={segs.map((x) => `${x.label} ${x.v}`).join(', ')}>
            {segs.filter((x) => x.v > 0).map((x) => <span key={x.k} className={x.k} style={{ flexGrow: x.v }} />)}
          </div>
          <table className="btab">
            <tbody>
              {segs.map((x) => (
                <tr key={x.k} className={x.v ? '' : 'is-zero'}>
                  <th scope="row"><i className={x.k} aria-hidden="true" />{x.label}</th>
                  <td><Ltr>{num(x.v)}</Ltr></td>
                  <td className="btab__pct"><Ltr>{pct(x.v)}%</Ltr></td>
                </tr>
              ))}
              <tr className={`is-sub ${sv.partial ? '' : 'is-zero'}`}><th scope="row">מתוכן חלקית</th><td><Ltr>{num(sv.partial)}</Ltr></td><td /></tr>
              <tr className={`is-sub ${sv.cancelled ? '' : 'is-zero'}`}><th scope="row">בוטלו (לא נספרות)</th><td><Ltr>{num(sv.cancelled)}</Ltr></td><td /></tr>
            </tbody>
          </table>
        </>
      )}
      {sv.lateBranches.length > 0 && (
        <div className="bsub">
          <p className="bsub__title">איפה היו איחורים</p>
          <ul className="blist">
            {sv.lateBranches.map((b) => <li key={b.name}><span>{b.name}</span><span className="muted">{b.late === 1 ? 'איחור אחד' : <><Ltr>{b.late}</Ltr> איחורים</>}{b.major > 0 && <> (<Ltr>{b.major}</Ltr> מעל <Ltr>{lateSplit()}</Ltr> דק')</>} מתוך <Ltr>{b.delivered}</Ltr></span></li>)}
          </ul>
        </div>
      )}
      {sv.overdue > 0 && (
        <button type="button" className="balert" onClick={() => go('/orders?tab=overdue')}>
          <Clock size={16} aria-hidden="true" />
          <span>{sv.overdue === 1 ? 'הזמנה אחת שעבר מועדה עוד לא נסגרה' : <><Ltr>{sv.overdue}</Ltr> הזמנות שעבר מועדן עוד לא נסגרו</>}</span>
          <ChevronLeft size={16} aria-hidden="true" className="balert__go" />
        </button>
      )}
    </Section>
  );
}

/* ---------- גבייה ובקרת קופה: המספר הראשי – מה שמעל 60 יום (או כמה בהקפה, כשהכל חדש) ---------- */
function CollectionsSection({ c, go }: { c: ReturnType<typeof collections>; go: (to: string) => void }) {
  const tones = ['is-a1', 'is-a2', 'is-a3'];
  const old = c.aging[2];
  return (
    <Section id="col" title="גבייה ובקרת קופה" meta="מצב נוכחי"
      lead={c.open.count === 0 ? <p className="bsec__empty">אין הקפות שממתינות לגבייה.</p>
        : old.count > 0 ? <Answer value={<Money v={old.sum} />}><span className="is-warn">מעל 60 יום</span> · מתוך <Money v={c.open.sum} /> בהקפה ({orders$(c.open.count)})</Answer>
          : <Answer value={<Money v={c.open.sum} />}>בהקפה ממתינים לגבייה · {c.aging[1].count ? 'הכל עד 60 יום' : 'הכל עד 30 יום'}</Answer>}>
      {c.open.count > 0 && (
        <>
          <div className="bstack" role="img" aria-label={c.aging.map((a) => `${a.label} ${fmtMoney(a.sum)}`).join(', ')}>
            {c.aging.map((a, i) => (a.sum > 0 ? <span key={a.label} className={tones[i]} style={{ flexGrow: a.sum }} /> : null))}
          </div>
          <table className="btab">
            <tbody>
              {c.aging.map((a, i) => (
                <tr key={a.label} className={a.count ? '' : 'is-zero'}>
                  <th scope="row"><i className={tones[i]} aria-hidden="true" /><span className={i === 2 && a.count ? 'is-warn' : undefined}>{a.label}</span></th>
                  <td><Money v={a.sum} /></td>
                  <td className="btab__pct">{orders$(a.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <ul className="bchecks">
        <li><button type="button" onClick={() => go('/exceptions?rule=2')} className={c.gaps.count ? 'is-warn' : ''}>
          <span>פערים בין ההזמנה לקופה (Q)</span>
          <b>{c.gaps.count ? <>{orders$(c.gaps.count)} · <Money v={c.gaps.sum} /></> : 'אין'}</b>
        </button></li>
        <li><button type="button" onClick={() => go('/exceptions?rule=7')} className={c.failed.count ? 'is-alert' : ''}>
          <span>חיובי אשראי שנכשלו</span>
          <b>{c.failed.count ? <>{orders$(c.failed.count)} · <Money v={c.failed.sum} /></> : 'אין'}</b>
        </button></li>
        <li><button type="button" onClick={() => go('/reports/credit')}><span>דוח הקפות מלא</span><b className="muted">לדוח ‹</b></button></li>
      </ul>
    </Section>
  );
}

/* ---------- דירוג: מקום · שם (והזמנות) · פס · סכום · חלק ---------- */
function Rank({ rows, limit, extra }: { rows: Ranked[]; limit: number; extra?: (r: Ranked) => ReactNode }) {
  const max = Math.max(1, ...rows.map((r) => r.sum));
  return (
    <ol className="brank">
      {rows.slice(0, limit).map((r, i) => (
        <li key={r.name} className={i === 0 ? 'is-first' : ''}>
          <span className="brank__pos"><Ltr>{i + 1}</Ltr></span>
          <span className="brank__who">
            <span className="brank__name" title={r.name}>{r.name}</span>
            <span className="brank__meta">{orders$(r.count)}{extra?.(r)}</span>
          </span>
          <span className="brank__track" aria-hidden="true"><span style={{ width: `${(r.sum / max) * 100}%` }} /></span>
          <span className="brank__sum"><Money v={r.sum} /></span>
          <span className="brank__pct"><Ltr>{r.share}%</Ltr></span>
        </li>
      ))}
    </ol>
  );
}
function CustomersSection({ rows, customers }: { rows: Ranked[]; customers: number }) {
  const top = rows[0];
  return (
    <Section id="cust" title="לקוחות" meta={top ? count(customers, 'לקוח אחד הזמין', 'לקוחות הזמינו') : undefined}
      lead={!top ? <p className="bsec__empty">אין הזמנות בתקופה הזו.</p> : <p><b>{top.name}</b> הוא הלקוח הגדול בתקופה, עם <Ltr>{top.share}%</Ltr> מההכנסות.</p>}>
      {top && <Rank rows={rows} limit={6} />}
    </Section>
  );
}
function BranchesSection({ clusters, branches }: { clusters: Ranked[]; branches: Ranked[] }) {
  const [by, setBy] = useState<'clusters' | 'branches'>('clusters');
  const rows = by === 'clusters' ? clusters : branches;
  const top = rows[0];
  return (
    <Section id="br" title="סניפים ואשכולות"
      tool={<div className="seg seg--sm" role="group" aria-label="פילוח"><button className={by === 'clusters' ? 'is-on' : ''} aria-pressed={by === 'clusters'} onClick={() => setBy('clusters')}>אשכולות</button><button className={by === 'branches' ? 'is-on' : ''} aria-pressed={by === 'branches'} onClick={() => setBy('branches')}>סניפים</button></div>}
      lead={!top ? <p className="bsec__empty">אין הזמנות בתקופה הזו.</p> : <p>{by === 'clusters' ? 'אשכול' : 'סניף'} <b>{top.name}</b> מוביל, עם <Ltr>{top.share}%</Ltr> מההכנסות.</p>}>
      {top && <Rank rows={rows} limit={6} extra={(r) => (r.onTimePct === null ? null : <> · <Ltr>{r.onTimePct}%</Ltr> בזמן</>)} />}
    </Section>
  );
}
/* לפי ערוץ: פחות משני ערוצים – משפט; שניים ומעלה – טבלה. "לא מסווג" = הזמנות ישנות עם טקסט ערוץ חופשי */
function ChannelsSection({ rows }: { rows: ChannelRanked[] }) {
  const top = rows[0];
  const lead = rows.find((r) => r.name !== UNCLASSIFIED && r.name !== '—');
  return (
    <Section id="ch" title="לפי ערוץ"
      lead={!top ? <p className="bsec__empty">אין הזמנות בתקופה הזו.</p>
        : rows.length < 2 ? <p>כל ההזמנות בתקופה מערוץ אחד: <b>{top.name}</b> – {orders$(top.count)}, <Money v={top.sum} />.</p>
          : lead ? <p>הערוץ המוביל בתקופה: <b>{lead.name}</b>, עם <Ltr>{lead.share}%</Ltr> מההכנסות.</p> : undefined}>
      {rows.length >= 2 && (
        <div className="report__scroll">
          <table className="rtable rtable--stack bteam">
            <thead><tr><th>ערוץ</th><th className="num">הזמנות</th><th className="num">פיצות</th><th className="num">הכנסות</th><th className="num">חלק</th><th className="num">ממוצע</th><th className="num">בזמן</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td data-label="ערוץ">{r.name === UNCLASSIFIED ? <span title="הזמנות ישנות עם טקסט ערוץ חופשי">{UNCLASSIFIED}</span> : r.name}</td>
                  <td className="num" data-label="הזמנות"><Ltr>{num(r.count)}</Ltr></td>
                  <td className="num" data-label="פיצות"><Ltr>{num(r.pizzas)}</Ltr></td>
                  <td className="num" data-label="הכנסות"><Money v={r.sum} /></td>
                  <td className="num" data-label="חלק"><Ltr>{r.share}%</Ltr></td>
                  <td className="num" data-label="ממוצע"><Money v={r.avg} /></td>
                  <td className="num" data-label="בזמן">{r.onTimePct === null ? <span className="muted">—</span> : <Ltr>{r.onTimePct}%</Ltr>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
/* ערוץ אחד ונציג אחד: שני משפטים בכרטיס אחד */
function ChannelTeamLine({ ch, team }: { ch: ChannelRanked[]; team: Ranked[] }) {
  const c = ch[0], t = team[0];
  return (
    <Section id="ct" title="ערוץ וצוות">
      <div className="bct">
        <p><span className="bct__k">ערוץ</span>{c ? <><b>{c.name}</b> – כל ההזמנות בתקופה</> : <span className="muted">אין הזמנות</span>}</p>
        <p><span className="bct__k">צוות</span>{t ? <><b>{t.name}</b> – {orders$(t.count)}, <Money v={t.sum} />{t.onTimePct !== null && <>, <Ltr>{t.onTimePct}%</Ltr> בזמן</>}</> : <span className="muted">אין הזמנות</span>}</p>
      </div>
    </Section>
  );
}
function TeamSection({ rows }: { rows: Ranked[] }) {
  const top = rows[0];
  return (
    <Section id="team" title="צוות"
      lead={!top ? <p className="bsec__empty">אין הזמנות בתקופה הזו.</p>
        : rows.length < 2 ? <p>כל ההזמנות בתקופה של <b>{top.name}</b> – {orders$(top.count)}, <Money v={top.sum} />{top.onTimePct !== null && <>, <Ltr>{top.onTimePct}%</Ltr> בזמן</>}.</p>
          : <p>הכי הרבה הכנסות בתקופה: <b>{top.name}</b> – {orders$(top.count)}, <Money v={top.sum} />.</p>}>
      {rows.length >= 2 && (
        <div className="report__scroll">
          <table className="rtable rtable--stack bteam">
            <thead><tr><th>נציג</th><th className="num">הזמנות</th><th className="num">הכנסות</th><th className="num">חלק</th><th className="num">בזמן</th><th className="num">פרטים חסרים</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td data-label="נציג">{r.name}</td>
                  <td className="num" data-label="הזמנות"><Ltr>{num(r.count)}</Ltr></td>
                  <td className="num" data-label="הכנסות"><Money v={r.sum} /></td>
                  <td className="num" data-label="חלק"><Ltr>{r.share}%</Ltr></td>
                  <td className="num" data-label="בזמן">{r.onTimePct === null ? <span className="muted">—</span> : <Ltr>{r.onTimePct}%</Ltr>}</td>
                  <td className="num" data-label="פרטים חסרים">{r.missing ? <span className="is-warn"><Ltr>{num(r.missing)}</Ltr></span> : <span className="muted">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/* ---------- הצעות מחיר: "לחזור ללקוח" בצבע של חזרה (טורקיז), אפסים באפור ---------- */
function QuotesSection({ q, go }: { q: ReturnType<typeof quotesSummary>; go: (to: string) => void }) {
  return (
    <Section id="qs" title="הצעות מחיר"
      lead={q.open === 0 ? <p className="bsec__empty">אין הצעות פתוחות.</p> : (
        <Answer value={<Money v={q.openSum} />}>{count(q.open, 'בהצעה אחת פתוחה', 'הצעות פתוחות')}{q.sent > 0 && <> · <Ltr>{q.conversion}%</Ltr> מההצעות שנשלחו בתקופה הפכו להזמנה</>}</Answer>
      )}>
      <ul className="bchecks bchecks--row">
        <li><button type="button" onClick={() => go('/quotes?tab=approved')} className={q.approved ? '' : 'is-zero'}><span>אושרו וממתינות להזמנה</span><b><Ltr>{num(q.approved)}</Ltr></b></button></li>
        <li><button type="button" onClick={() => go('/quotes?tab=waiting')} className={q.followups ? 'is-due' : 'is-zero'}><span>לחזור ללקוח</span><b><Ltr>{num(q.followups)}</Ltr></b></button></li>
        <li><button type="button" onClick={() => go('/quotes?tab=waiting')} className={q.expiring ? '' : 'is-zero'}><span>תוקפן נגמר בשלושה ימים</span><b><Ltr>{num(q.expiring)}</Ltr></b></button></li>
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
      <Popover.Trigger asChild><Button variant="secondary" size="sm" icon={<SlidersHorizontal size={16} />}>התאם תצוגה</Button></Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="pop blayout" align="end" sideOffset={6} dir="rtl">
          <p className="pop__title">מה מוצג בבורד, ובאיזה סדר</p>
          <ul className="blayout__list">
            {order.map((k, i) => (
              <li key={k}>
                <label className="blayout__check"><input type="checkbox" checked={!hidden.includes(k)} onChange={() => toggle(k)} /> {SECTIONS[k]}</label>
                <span className="blayout__move">
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`הזז למעלה: ${SECTIONS[k]}`}><ChevronUp size={16} /></button>
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`הזז למטה: ${SECTIONS[k]}`}><ChevronDown size={16} /></button>
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
