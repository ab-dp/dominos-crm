import { useMemo, useState } from 'react';
import { revenue } from '../../data/metrics';
import { useSearchParams } from 'react-router-dom';
import { Rows3, Rows4, Search, X } from 'lucide-react';
import { Skeleton } from '../../design/components';
import { usePref } from '../../lib/prefs';
import { useStore, type OrderView } from '../../data/store';
import { CLOSED } from '../../data/types';
import { HEALTH_RANK } from '../../rules-engine/health';
import { Ltr, addDays, fmtDate, fmtMoney, toISODate, weekday } from '../../lib/format';
import { OrdersTable } from './OrdersTable';
import '../pages.css';

type Tab = 'today' | 'tomorrow' | 'future' | 'overdue' | 'archive';
const TABS: [Tab, string][] = [['today', 'היום'], ['tomorrow', 'מחר'], ['future', 'עתידיות'], ['overdue', 'פתוחות שעבר מועדן'], ['archive', 'ארכיון']];
const RANGES = [3, 7, 14, 30, 0] as const;

export const FILTERS: Record<string, { label: string; test: (o: OrderView) => boolean }> = {
  branch: { label: 'לא עודכן בתפעול', test: (o) => !o.branchApproval },
  q: { label: 'לא הועברו ל-Q', test: (o) => !o.qNumber },
  credit: { label: 'אשראי לחייב', test: (o) => o.method === 'credit' && (o.payment === 'pending' || o.payment === 'failed') },
  issues: { label: 'עם חריג', test: (o) => o.health === 'critical' || o.health === 'urgent' },
};

const byTime = (a: OrderView, b: OrderView) => (a.date + a.time).localeCompare(b.date + b.time);
const urgentFirst = (a: OrderView, b: OrderView) => HEALTH_RANK[b.health] - HEALTH_RANK[a.health] || byTime(a, b);

export function OrdersPage() {
  const { orders, now, loading, error } = useStore();
  const [params, setParams] = useSearchParams();
  // ערך לא מוכר בכתובת (קישור ישן או שגוי) – "היום", ולא מסך שבור
  const raw = params.get('tab') as Tab | null;
  const tab: Tab = raw && TABS.some(([k]) => k === raw) ? raw : 'today';
  const range = Number(params.get('range') ?? 7);
  const filterKey = params.get('filter');
  const filter = filterKey ? FILTERS[filterKey] : undefined;

  const today = toISODate(now);
  const tomorrow = toISODate(addDays(now, 1));
  const rangeEnd = range ? toISODate(addDays(now, range)) : '9999';

  const lists = useMemo(() => {
    const open = orders.filter((o) => !CLOSED.includes(o.status));
    return {
      today: open.filter((o) => o.date === today).sort(urgentFirst),
      tomorrow: open.filter((o) => o.date === tomorrow).sort(urgentFirst),
      future: open.filter((o) => o.date > tomorrow && o.date <= rangeEnd).sort(byTime),
      overdue: open.filter((o) => o.date < today).sort(byTime),
      archive: orders.filter((o) => CLOSED.includes(o.status)).sort((a, b) => byTime(b, a)),
    } satisfies Record<Tab, OrderView[]>;
  }, [orders, today, tomorrow, rangeEnd]);

  const [query, setQuery] = useState('');
  const [density, setDensity] = usePref<'dense' | 'comfy'>('tableDensity', 'dense');
  const q = query.trim().toLowerCase();
  const rows = useMemo(() => lists[tab]
    .filter((o) => !filter || filter.test(o))
    .filter((o) => !q || o.customerName.toLowerCase().includes(q) || String(o.id).includes(q) || (o.qNumber ?? '').toLowerCase().includes(q) || o.branchName.includes(q)),
  [lists, tab, filter, q]);
  const total = revenue(rows);
  const needs = rows.filter((o) => o.health === 'critical' || o.health === 'urgent').length;
  const critical = rows.some((o) => o.health === 'critical');
  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v === null) p.delete(k); else p.set(k, v);
    setParams(p, { replace: true });
  };

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
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'is-on' : ''} ${k === 'overdue' && lists.overdue.length ? 'tab--alert' : ''}`} onClick={() => set('tab', k)}>
            {label}
            <span className="tab__count"><Ltr>{lists[k].length}</Ltr></span>
          </button>
        ))}
      </div>

      <div className="tablebar">
        {tab === 'future' && (
          <div className="seg" role="group" aria-label="טווח ימים">
            {RANGES.map((r) => (
              <button key={r} className={range === r ? 'is-on' : ''} aria-pressed={range === r} onClick={() => set('range', String(r))}>{r ? <><Ltr>{r}</Ltr> ימים</> : 'הכל'}</button>
            ))}
          </div>
        )}
        <div className="chips" role="group" aria-label="סינון מהיר">
          {Object.entries(FILTERS).map(([k, f]) => (
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

      {loading ? (
        <div className="card orders-loading" aria-busy="true" aria-label="טוען הזמנות">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={20} />)}</div>
      ) : <OrdersTable
        density={density}
        rows={rows}
        showDate={tab !== 'today' && tab !== 'tomorrow'}
        caption={`הזמנות – ${TABS.find((t) => t[0] === tab)![1]}${filter ? ` – ${filter.label}` : ''}`}
        emptyText={filter ? `אין הזמנות: ${filter.label}` : tab === 'tomorrow' ? 'אין הזמנות למחר' : tab === 'overdue' ? 'אין הזמנות פתוחות שעבר מועדן ✓' : 'אין הזמנות בתצוגה הזו'}
      />}
    </div>
  );
}
