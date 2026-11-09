/* סיכום תקופה – דוח להנהלה: בוחרים תקופה, ושתי לשוניות – כל ההזמנות (שורה לכל הזמנה) וסיכום בטבלאות.
   הייצוא לאקסל בונה קובץ מעוצב משתי הלשוניות (periodExcel), ונרשם ביומן. */
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ChartColumn, Download, RefreshCw } from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { logReportExport, useOrdersRange } from '../../data/orders';
import { useStore } from '../../data/store';
import { Button, EmptyState, Skeleton } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, fmtDate, fmtMoney } from '../../lib/format';
import { PERIOD_PRESETS, missingQ, ordersTable, periodRange, summary, type Cell, type Kind, type PeriodPreset, type STable } from './periodData';
import '../pages.css';
import './ReportsPage.css';
import './PeriodReport.css';

const NUMERIC: Kind[] = ['num', 'money', 'pct'];
function show(v: Cell, kind: Kind) {
  if (v === null || v === '') return '';
  if (typeof v === 'string') return kind === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? <Ltr>{fmtDate(v)}</Ltr> : kind === 'text' ? v : <Ltr>{v}</Ltr>;
  if (kind === 'money') return <Ltr>{fmtMoney(v)}</Ltr>;
  if (kind === 'pct') return <Ltr>{Math.round(v * 100)}%</Ltr>;
  return <Ltr>{kind === 'id' ? v : v.toLocaleString('en-US')}</Ltr>;
}

/* טבלה אחת – משמשת גם לרשימת ההזמנות וגם לטבלאות הסיכום */
function Table({ t, onRow }: { t: STable; onRow?: (i: number, el: HTMLElement) => void }) {
  const cls = (k: Kind) => (NUMERIC.includes(k) ? 'num' : '');
  return (
    <div className="report__scroll">
      <table className={`rtable ${onRow ? '' : 'rtable--static'}`}>
        <caption className="sr-only">{t.title}</caption>
        <thead><tr>{t.cols.map((c) => <th key={c.label} className={cls(c.kind)}>{c.label}</th>)}</tr></thead>
        <tbody>
          {t.rows.map((r, i) => (
            <tr key={t.ids?.[i] ?? i} className={r.includes('בוטלה') ? 'is-cancelled' : ''}
              {...(onRow ? { tabIndex: 0, onClick: (e) => onRow(i, e.currentTarget), onKeyDown: (e) => { if (e.key === 'Enter') onRow(i, e.currentTarget); }, 'aria-label': `הזמנה ${t.ids?.[i]} – פתח את תיק ההזמנה` } : {})}>
              {r.map((v, j) => <td key={j} className={cls(t.cols[j].kind)}>{show(v, t.cols[j].kind)}</td>)}
            </tr>
          ))}
        </tbody>
        {t.total && <tfoot><tr>{t.total.map((v, j) => <td key={j} className={cls(t.cols[j].kind)}>{show(v, j === 0 || typeof v === 'string' ? 'text' : t.cols[j].kind)}</td>)}</tr></tfoot>}
      </table>
    </div>
  );
}

export function PeriodReport() {
  const { now } = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const panel = usePanel();
  const [params, setParams] = useSearchParams();
  const preset = (PERIOD_PRESETS.some(([p]) => p === params.get('range')) ? params.get('range') : 'lastWeek') as PeriodPreset;
  const [pf, pt] = periodRange(preset, now);
  const from = preset === 'custom' ? params.get('from') ?? pf : pf;
  const to = preset === 'custom' ? params.get('to') ?? pt : pt;
  const tab = params.get('tab') === 'summary' ? 'summary' : 'orders';
  const set = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === null || v === '' ? p.delete(k) : p.set(k, v)));
    setParams(p, { replace: true });
  };

  const { orders, loading, error, reload } = useOrdersRange(from, to);
  const ot = useMemo(() => ordersTable(orders), [orders]);
  const sum = useMemo(() => summary(orders, from, to), [orders, from, to]);
  const noQ = useMemo(() => missingQ(orders).length, [orders]);
  const [busy, setBusy] = useState(false);

  const exportXlsx = async () => {
    setBusy(true);
    try {
      const { exportPeriodExcel } = await import('./periodExcel');
      await exportPeriodExcel({ from, to, orders: ot, summary: sum, missingQ: noQ, fileName: `סיכום תקופה ${fmtDate(from)}-${fmtDate(to)}.xlsx` });
      logReportExport('period', { from, to, rows: ot.rows.length }).catch(() => undefined);
      toast({ message: <>הדוח יוצא לאקסל · <Ltr>{ot.rows.length}</Ltr> הזמנות</> });
    } catch {
      toast({ message: 'הייצוא נכשל – נסה שוב', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const notes = [ot.note, noQ ? `${noQ} הזמנות בלי סכום Q – בסה"כ נלקח במקומן הסכום לחיוב` : ''].filter(Boolean);

  return (
    <div className="page report">
      <button className="auth__back" onClick={() => nav('/reports')}><ArrowRight size={16} aria-hidden="true" /> דוחות</button>
      <header className="page__head">
        <div>
          <h1 className="page__title">סיכום תקופה</h1>
          <p className="page__sub">לפי תאריך אספקה וסכום Q · <Ltr>{fmtDate(from)}</Ltr> עד <Ltr>{fmtDate(to)}</Ltr></p>
        </div>
        <div className="page__head-end">
          <Button variant="ghost" size="sm" icon={<RefreshCw size={15} />} onClick={reload} disabled={loading}>רענן</Button>
          <Button variant="primary" icon={<Download size={16} />} onClick={exportXlsx} loading={busy} disabled={loading || !orders.length}>ייצוא לאקסל</Button>
        </div>
      </header>

      <div className="tablebar report__filters">
        <div className="seg" role="group" aria-label="תקופה">
          {PERIOD_PRESETS.map(([p, l]) => <button key={p} className={preset === p ? 'is-on' : ''} aria-pressed={preset === p} onClick={() => set(p === 'custom' ? { range: p, from, to } : { range: p, from: null, to: null })}>{l}</button>)}
        </div>
        {preset === 'custom' && (
          <span className="report__dates">
            <input type="date" className="input input--sm" value={from} max={to} onChange={(e) => e.target.value && set({ from: e.target.value })} aria-label="מתאריך" />
            <span aria-hidden="true">–</span>
            <input type="date" className="input input--sm" value={to} min={from} onChange={(e) => e.target.value && set({ to: e.target.value })} aria-label="עד תאריך" />
          </span>
        )}
      </div>

      <nav className="tabs preport__tabs" role="tablist" aria-label="סיכום תקופה">
        <button role="tab" id="pt-orders" aria-controls="pp-orders" aria-selected={tab === 'orders'} className={`tab ${tab === 'orders' ? 'is-on' : ''}`} onClick={() => set({ tab: null })}>
          הזמנות {!loading && <span className="tab__count"><Ltr>{ot.rows.length}</Ltr></span>}
        </button>
        <button role="tab" id="pt-summary" aria-controls="pp-summary" aria-selected={tab === 'summary'} className={`tab ${tab === 'summary' ? 'is-on' : ''}`} onClick={() => set({ tab: 'summary' })}>סיכום</button>
      </nav>

      {error && <p className="cform__formerr" role="alert">{error} – הדוח לא נטען.</p>}
      {loading ? (
        <div className="card loading-rows" aria-busy="true" aria-label="טוען דוח">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={28} />)}</div>
      ) : !orders.length ? (
        <section className="card"><EmptyState icon={<ChartColumn size={24} />} title="אין הזמנות בתקופה הזו">בחר תקופה אחרת.</EmptyState></section>
      ) : tab === 'orders' ? (
        <section className="card report__table-card" role="tabpanel" id="pp-orders" aria-labelledby="pt-orders">
          {notes.length > 0 && <p className="preport__note">{notes.join(' · ')}</p>}
          <Table t={ot} onRow={(i, el) => panel.open(ot.ids![i], el)} />
        </section>
      ) : (
        <div className="preport__sum" role="tabpanel" id="pp-summary" aria-labelledby="pt-summary">
          <dl className="report__kpis">
            {sum.kpis.map((k) => <div key={k.label}><dt>{k.label}</dt><dd>{show(k.value, k.kind)}{k.sub && <small> {k.sub}</small>}</dd></div>)}
          </dl>
          {sum.tables.map((t) => (
            <section key={t.id} className="card preport__block" aria-labelledby={`ps-${t.id}`}>
              <div className="card__head">
                <h2 id={`ps-${t.id}`} className="card__title">{t.title}</h2>
              </div>
              {t.note && <p className="preport__note">{t.note}</p>}
              {t.rows.length > 0 && <Table t={t} />}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
