import { useMemo, useState } from 'react';
import { revenue } from '../../data/metrics';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Rows3, Rows4, Search, X } from 'lucide-react';
import { Button, Skeleton } from '../../design/components';
import { usePref } from '../../lib/prefs';
import { useStore, type OrderView } from '../../data/store';
import { liveSince, useOrdersRange } from '../../data/orders';
import { CLOSED } from '../../data/types';
import { needsCare } from '../../data/care';
import { HEALTH_RANK, healthOf, issuesFor } from '../../rules-engine/health';
import { Ltr, addDays, fmtDate, fmtMoney, toISODate, weekday } from '../../lib/format';
import { OrdersTable } from './OrdersTable';
import { FilterBar } from '../../design/FilterBar';
import { filterOptions, filtersText, matchesFilters, type FilterKey, type FilterValues } from '../../data/orderFilters';
import '../pages.css';

/* לשוניות: היום · מחר · עתידיות (כל מה שאחרי היום, כולל מחר) · פתוחות שעבר מועדן · לפי תאריכים (כל טווח, גם עתידי וגם ארכיון) · ארכיון.
   הרשימה החיה מכילה את כל הפתוחות ואת כל ההזמנות מתחילת החודש הקודם. טווח או ארכיון ישנים יותר נטענים פעם אחת לפי דרישה,
   כדי לשמור על מכסת הקריאות החינמית (כמו בדוחות), עם "רענן". */
type Tab = 'today' | 'tomorrow' | 'future' | 'overdue' | 'range' | 'archive';
const TABS: [Tab, string][] = [['today', 'היום'], ['tomorrow', 'מחר'], ['future', 'עתידיות'], ['overdue', 'פתוחות שעבר מועדן'], ['range', 'לפי תאריכים'], ['archive', 'ארכיון']];
const RANGES = [3, 7, 14, 30, 0] as const;
const MAX_DAYS = 366; // טווח ארוך יותר – לדוחות
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const CARE_FILTER = { label: 'איחור / חלקית בלי תיעוד', test: (o: OrderView) => needsCare(o) };
export const FILTERS: Record<string, { label: string; test: (o: OrderView) => boolean }> = {
  branch: { label: 'לא עודכן בתפעול', test: (o) => !o.branchApproval },
  q: { label: 'לא הועברו ל-Q', test: (o) => !o.qNumber },
  credit: { label: 'אשראי לחייב', test: (o) => o.method === 'credit' && (o.payment === 'pending' || o.payment === 'failed') },
  issues: { label: 'עם חריג', test: (o) => o.health === 'critical' || o.health === 'urgent' },
};

const byTime = (a: OrderView, b: OrderView) => (a.date + a.time).localeCompare(b.date + b.time);
const urgentFirst = (a: OrderView, b: OrderView) => HEALTH_RANK[b.health] - HEALTH_RANK[a.health] || byTime(a, b);
const dayDiff = (a: string, b: string) => Math.round((new Date(b + 'T12:00').getTime() - new Date(a + 'T12:00').getTime()) / 86400000);
const monthStart = (iso: string, back: number) => { const d = new Date(iso + 'T12:00'); return toISODate(new Date(d.getFullYear(), d.getMonth() - back, 1)); };

export function OrdersPage() {
  const { orders, now, loading, error, thresholds } = useStore();
  const [params, setParams] = useSearchParams();
  // ערך לא מוכר בכתובת (קישור ישן או שגוי) – "היום", ולא מסך שבור
  const raw = params.get('tab') as Tab | null;
  const tab: Tab = raw && TABS.some(([k]) => k === raw) ? raw : 'today';
  const range = Number(params.get('range') ?? 7);
  const filterKey = params.get('filter');
  // בארכיון ובטווח תאריכים – גם "בלי תיעוד": איחור או חלקית שעוד לא תועד איך טיפלנו בלקוח
  const filters = raw === 'archive' || raw === 'range' ? { ...FILTERS, care: CARE_FILTER } : FILTERS;
  const filter = filterKey ? filters[filterKey] : undefined;
  /* סינון לפי ממדים (אשכול, סניף, תשלום, מטפל, סטטוס אספקה) – אותו רכיב ואותם מפתחות כמו בדוחות */
  const dimKeys: FilterKey[] = raw === 'archive' || raw === 'range' ? ['cluster', 'branch', 'method', 'handler', 'outcome'] : ['cluster', 'branch', 'method', 'handler'];
  const dimSig = dimKeys.map((k) => params.get(k) ?? '').join('|');
  const dimValues = useMemo(() => Object.fromEntries(dimKeys.map((k) => [k, params.get(k) ?? ''])) as FilterValues,
    [dimSig, raw]);

  const today = toISODate(now);
  const tomorrow = toISODate(addDays(now, 1));
  const rangeEnd = range ? toISODate(addDays(now, range)) : '9999';
  const since = liveSince(now);

  /* לפי תאריכים: ברירת מחדל – מהיום לשבוע קדימה */
  const fromP = params.get('from'); const toP = params.get('to');
  const from = fromP && ISO.test(fromP) ? fromP : today;
  const to = toP && ISO.test(toP) ? toP : toISODate(addDays(now, 7));
  const rangeBad = from > to ? 'תאריך ההתחלה אחרי תאריך הסיום' : dayDiff(from, to) > MAX_DAYS ? 'עד שנה בכל פעם – לתקופה ארוכה יותר יש דוחות' : '';
  const rangeFetch = tab === 'range' && !rangeBad && from < since;

  /* ארכיון: כמה חודשים לפני הרשימה החיה נטענו (arch=0 – רק מה שכבר בזיכרון) */
  const arch = Math.max(0, Math.min(24, Number(params.get('arch') ?? 0) || 0));
  const archFrom = arch ? monthStart(since, arch) : since;
  const archFetch = tab === 'archive' && arch > 0;

  const remote = useOrdersRange(rangeFetch ? from : archFrom, rangeFetch ? to : toISODate(addDays(new Date(since + 'T12:00'), -1)), rangeFetch || archFetch);
  /* הזמנות שנטענו מהשרת – עם אותו חישוב חריגים כמו ברשימה החיה; אם ההזמנה גם ברשימה החיה – הגרסה החיה */
  const fetched = useMemo(() => {
    const liveById = new Map(orders.map((o) => [o.id, o]));
    return remote.orders.map((o): OrderView => liveById.get(o.id) ?? (() => { const issues = issuesFor(o, now, thresholds); return { ...o, issues, health: healthOf(issues) }; })());
  }, [remote.orders, orders, now, thresholds]);

  const lists = useMemo(() => {
    const open = orders.filter((o) => !CLOSED.includes(o.status));
    const merge = (a: OrderView[], b: OrderView[]) => { const m = new Map(a.map((o) => [o.id, o])); b.forEach((o) => m.set(o.id, o)); return [...m.values()]; };
    const inRange = (o: OrderView) => o.date >= from && o.date <= to;
    return {
      today: open.filter((o) => o.date === today).sort(urgentFirst),
      tomorrow: open.filter((o) => o.date === tomorrow).sort(urgentFirst),
      future: open.filter((o) => o.date > today && o.date <= rangeEnd).sort(byTime),
      overdue: open.filter((o) => o.date < today).sort(byTime),
      // כל ההזמנות בטווח – פתוחות, סגורות ומבוטלות
      range: rangeBad ? [] : (rangeFetch ? merge(fetched, orders.filter(inRange)) : orders.filter(inRange)).sort(byTime),
      archive: merge(archFetch ? fetched : [], orders).filter((o) => CLOSED.includes(o.status)).sort((a, b) => byTime(b, a)),
    } satisfies Record<Tab, OrderView[]>;
  }, [orders, fetched, today, tomorrow, rangeEnd, from, to, rangeBad, rangeFetch, archFetch]);

  const [query, setQuery] = useState('');
  const [density, setDensity] = usePref<'dense' | 'comfy'>('tableDensity', 'dense');
  const q = query.trim().toLowerCase();
  const rows = useMemo(() => lists[tab]
    .filter((o) => !filter || filter.test(o))
    .filter((o) => matchesFilters(o, dimValues))
    .filter((o) => !q || o.customerName.toLowerCase().includes(q) || String(o.id).includes(q) || (o.qNumber ?? '').toLowerCase().includes(q) || o.branchName.includes(q)),
  [lists, tab, filter, q, dimValues]);
  const dims = useMemo(() => filterOptions(lists[tab], dimKeys, dimValues).map((d) => (d.key === 'cluster' ? { ...d, clears: ['branch'] } : d)),
    [lists, tab, dimValues]);
  const dimText = filtersText(dimValues);
  const total = revenue(rows);
  const needs = rows.filter((o) => o.health === 'critical' || o.health === 'urgent').length;
  const critical = rows.some((o) => o.health === 'critical');
  const setMany = (kv: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    Object.entries(kv).forEach(([k, v]) => { if (v === null) p.delete(k); else p.set(k, v); });
    setParams(p, { replace: true });
  };
  const set = (k: string, v: string | null) => setMany({ [k]: v });
  const busy = loading || ((rangeFetch || archFetch) && remote.loading);
  // לשונית שהתוכן שלה תלוי בבחירה – בלי מספר עד שפותחים אותה
  const countOf = (k: Tab) => (k === 'range' ? (tab === 'range' && !busy ? lists.range.length : null) : lists[k].length);

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">הזמנות</h1>
          <p className="page__sub">יום {weekday(today)} · <Ltr>{fmtDate(today)}</Ltr></p>
        </div>
        {/* סיכום התצוגה הנוכחית – מתעדכן עם הטאב, הסינון והחיפוש */}
        <dl className="head-stats" aria-live="polite">
          <div><dt>הזמנות בתצוגה</dt><dd><Ltr>{rows.length}</Ltr></dd></div>
          <div><dt>סך הכל</dt><dd><Ltr>{fmtMoney(total)}</Ltr></dd></div>
          <div className={critical ? 'is-alert' : needs ? 'is-warn' : ''}><dt>דורשות טיפול</dt><dd><Ltr>{needs}</Ltr></dd></div>
        </dl>
      </header>
      {error && <p className="cform__formerr" role="alert">{error} – ההזמנות לא נטענו. רענן את הדף.</p>}

      <div className="tabs" role="tablist" aria-label="תצוגת הזמנות">
        {TABS.map(([k, label]) => {
          const n = countOf(k);
          return (
            <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'is-on' : ''} ${k === 'overdue' && lists.overdue.length ? 'tab--alert' : ''}`} onClick={() => setMany({ tab: k, ...(k === 'archive' || k === 'range' ? {} : { outcome: null }) })}>
              {label}
              {n !== null && <span className="tab__count"><Ltr>{n}</Ltr></span>}
            </button>
          );
        })}
      </div>

      {tab === 'range' && (
        <div className="orange" role="group" aria-label="טווח תאריכים">
          <label className="orange__f">מתאריך <input type="date" className="input input--sm" value={from} onChange={(e) => e.target.value && set('from', e.target.value)} /></label>
          <label className="orange__f">עד <input type="date" className="input input--sm" value={to} onChange={(e) => e.target.value && set('to', e.target.value)} /></label>
          <div className="seg seg--sm" role="group" aria-label="טווחים מוכנים">
            <button onClick={() => setMany({ from: today, to: toISODate(addDays(now, 7)) })}>שבוע קדימה</button>
            <button onClick={() => setMany({ from: toISODate(addDays(now, -7)), to: today })}>שבוע אחורה</button>
            <button onClick={() => setMany({ from: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), to: toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0)) })}>החודש</button>
            <button onClick={() => setMany({ from: monthStart(today, 1), to: toISODate(new Date(now.getFullYear(), now.getMonth(), 0)) })}>החודש הקודם</button>
          </div>
          {rangeFetch && <Button size="sm" variant="ghost" icon={<RefreshCw size={16} />} onClick={remote.reload} loading={remote.loading}>רענן</Button>}
          {rangeBad && <span className="orange__err" role="alert">{rangeBad}</span>}
          {!rangeBad && <span className="muted orange__note">כולל סגורות ומבוטלות{rangeFetch ? ' · נטען מהארכיון' : ''}</span>}
        </div>
      )}
      {tab === 'archive' && (
        <div className="orange" role="group" aria-label="היקף הארכיון">
          <span className="orange__note">מציג מ-<Ltr>{fmtDate(archFrom)}</Ltr></span>
          <Button size="sm" variant="secondary" disabled={arch >= 24} loading={archFetch && remote.loading} onClick={() => set('arch', String(arch + 1))}>טען חודש קודם</Button>
          {arch > 0 && <button type="button" className="link" onClick={() => set('arch', null)}>חזרה לחודשיים האחרונים</button>}
        </div>
      )}
      {(rangeFetch || archFetch) && remote.error && <p className="cform__formerr" role="alert">{remote.error} – הטעינה מהארכיון נכשלה. נסה "רענן".</p>}

      <div className="tablebar">
        {tab === 'future' && (
          <div className="seg" role="group" aria-label="טווח ימים">
            {RANGES.map((r) => (
              <button key={r} className={range === r ? 'is-on' : ''} aria-pressed={range === r} onClick={() => set('range', String(r))}>{r ? <><Ltr>{r}</Ltr> ימים</> : 'הכל'}</button>
            ))}
          </div>
        )}
        <FilterBar dims={dims} values={dimValues} onChange={setMany} extraActive={(query.trim() ? 1 : 0) + (filter ? 1 : 0)} alsoClear={['filter']} onClearAll={() => setQuery('')} />
        <div className="chips" role="group" aria-label="סינון מהיר">
          {Object.entries(filters).map(([k, f]) => (
            <button key={k} className={`chip ${filterKey === k ? 'is-on' : ''}`} aria-pressed={filterKey === k} onClick={() => set('filter', filterKey === k ? null : k)}>
              {f.label}
              {filterKey === k && <X size={14} aria-hidden="true" />}
            </button>
          ))}
        </div>
        <label className="tablebar__search">
          <Search size={16} aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="סינון בטבלה: לקוח, מס' הזמנה, Q, סניף" aria-label="סינון בטבלה" />
          {query && <button onClick={() => setQuery('')} aria-label="נקה סינון"><X size={14} /></button>}
        </label>
        <div className="seg seg--sm" role="group" aria-label="צפיפות הטבלה">
          <button className={density === 'dense' ? 'is-on' : ''} aria-pressed={density === 'dense'} onClick={() => setDensity('dense')} title="צפוף"><Rows4 size={16} aria-hidden="true" /><span className="sr-only">צפוף</span></button>
          <button className={density === 'comfy' ? 'is-on' : ''} aria-pressed={density === 'comfy'} onClick={() => setDensity('comfy')} title="מרווח"><Rows3 size={16} aria-hidden="true" /><span className="sr-only">מרווח</span></button>
        </div>
      </div>

      {busy ? (
        <div className="card orders-loading" aria-busy="true" aria-label="טוען הזמנות">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={20} />)}</div>
      ) : <OrdersTable
        density={density}
        rows={rows}
        showDate={tab !== 'today' && tab !== 'tomorrow'}
        qTint={tab === 'today'}
        caption={`הזמנות – ${TABS.find((t) => t[0] === tab)![1]}${filter ? ` – ${filter.label}` : ''}${dimText ? ` – ${dimText}` : ''}`}
        emptyText={filter || dimText ? `אין הזמנות: ${[filter?.label, dimText].filter(Boolean).join(' · ')}` : tab === 'tomorrow' ? 'אין הזמנות למחר' : tab === 'overdue' ? 'אין הזמנות פתוחות שעבר מועדן ✓' : tab === 'range' ? (rangeBad || 'אין הזמנות בטווח הזה') : 'אין הזמנות בתצוגה הזו'}
      />}
    </div>
  );
}
