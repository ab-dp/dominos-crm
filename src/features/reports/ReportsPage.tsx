/* דוחות (אפיון 10): מרכז דוחות, ודף דוח אחיד – מסננים בשורה אחת, מדדים, גרף עם "הצג כטבלה",
   טבלה עם שורת סיכום, לחיצה על שורה מציגה את ההזמנות שמרכיבות אותה, וייצוא לאקסל שנרשם ביומן. */
import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarCheck, ChartColumn, Download, RefreshCw, X } from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { logReportExport, useOrdersRange } from '../../data/orders';
import { useStore } from '../../data/store';
import { METHOD_LABEL, OUTCOME_LABEL, outcomeOf, type Order, type Outcome } from '../../data/types';
import { Button, EmptyState, Skeleton } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, addDays, fmtDate, fmtMoney, toISODate } from '../../lib/format';
import { REPORTS, qVal, type Col, type ReportDef, type ReportResult, type Row } from './defs';
import { BarChart } from './BarChart';
import '../pages.css';
import './ReportsPage.css';

/* ---------- מרכז הדוחות ---------- */
export function ReportsHub() {
  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">דוחות</h1>
          <p className="page__sub">לפי תאריך אספקה וסכום Q, בלי הזמנות שבוטלו.</p>
        </div>
      </header>
      <Link to="/reports/close" className="rhub__card rhub__card--feature">
        <span className="rhub__icon" aria-hidden="true"><CalendarCheck size={20} /></span>
        <span className="rhub__text"><b>סגירת חודש</b><span>השלמת חוסרים · בדיקת הקפות · העברה להנהלת חשבונות · נעילה עם סיכומים קפואים</span></span>
      </Link>
      <div className="rhub">
        {REPORTS.map((r) => (
          <Link key={r.id} to={r.link ?? `/reports/${r.id}`} className="rhub__card">
            <span className="rhub__icon" aria-hidden="true"><ChartColumn size={18} /></span>
            <span className="rhub__text"><b>{r.title}</b><span>{r.desc}</span></span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---------- טווחי תאריכים ---------- */
type Preset = 'week' | 'month' | 'prev' | 'd30' | 'm3' | 'custom';
const PRESETS: [Preset, string][] = [['week', 'השבוע'], ['month', 'החודש'], ['prev', 'החודש הקודם'], ['d30', '30 ימים'], ['m3', '3 חודשים'], ['custom', 'מותאם']];
function rangeOf(p: Preset, now: Date): [string, string] {
  const y = now.getFullYear(); const m = now.getMonth();
  const day = (d: Date) => toISODate(d);
  if (p === 'prev') return [day(new Date(y, m - 1, 1)), day(new Date(y, m, 0))];
  // שבוע: ראשון עד שבת של השבוע הנוכחי
  if (p === 'week') { const s = new Date(y, m, now.getDate() - now.getDay()); return [day(s), day(new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6))]; }
  if (p === 'd30') return [day(addDays(now, -29)), day(now)];
  if (p === 'm3') return [day(new Date(y, m - 2, 1)), day(new Date(y, m + 1, 0))];
  return [day(new Date(y, m, 1)), day(new Date(y, m + 1, 0))];
}

const fmtCell = (c: Col, v: string | number | undefined) => {
  if (v === undefined || v === '') return '';
  if (c.kind === 'money') return fmtMoney(Number(v));
  if (c.kind === 'pct') return `${v}%`;
  if (c.kind === 'date' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return fmtDate(v);
  return String(v);
};

/* ---------- דף דוח ---------- */
export function ReportView() {
  const { id } = useParams();
  const def = REPORTS.find((r) => r.id === id);
  // דוח שהוסר (קישור ישן) – חוזרים למרכז הדוחות
  if (!def) return <Navigate to="/reports" replace />;
  if (!def || def.link) return <div className="page"><div className="card"><EmptyState icon={<ChartColumn size={24} />} title="הדוח לא נמצא" action={<Link className="btn btn--primary btn--md" to="/reports"><span className="btn__label">לכל הדוחות</span></Link>} /></div></div>;
  return <Report key={def.id} def={def} />;
}

function Report({ def }: { def: ReportDef }) {
  const { now } = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const preset = (params.get('range') as Preset) || 'month';
  const [pf, pt] = rangeOf(preset, now);
  const from = preset === 'custom' ? params.get('from') ?? pf : pf;
  const to = preset === 'custom' ? params.get('to') ?? pt : pt;
  const cluster = params.get('cluster') ?? '';
  const branch = params.get('branch') ?? '';
  const method = params.get('method') ?? '';
  const outcome = (params.get('outcome') ?? '') as Outcome | '';
  const handler = params.get('handler') ?? '';
  const [cust, setCust] = useState('');
  const set = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === null || v === '' ? p.delete(k) : p.set(k, v)));
    setParams(p, { replace: true });
  };

  const { orders: raw, loading, error, reload } = useOrdersRange(from, to);
  const clusters = useMemo(() => [...new Set(raw.map((o) => o.cluster).filter(Boolean))].sort(), [raw]);
  const branches = useMemo(() => [...new Set(raw.filter((o) => !cluster || o.cluster === cluster).map((o) => o.branchName))].sort(), [raw, cluster]);
  const methods = useMemo(() => [...new Set(raw.map((o) => o.method))], [raw]);
  const handlers = useMemo(() => [...new Set(raw.map((o) => o.handler || o.createdBy).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he')), [raw]);
  const orders = useMemo(() => raw.filter((o) => (!cluster || o.cluster === cluster) && (!branch || o.branchName === branch) && (!cust.trim() || o.customerName.includes(cust.trim()))
    && (!method || o.method === method) && (!outcome || outcomeOf(o) === outcome) && (!handler || (o.handler || o.createdBy) === handler)), [raw, cluster, branch, cust, method, outcome, handler]);
  const res: ReportResult = useMemo(() => def.compute(orders), [def, orders]);
  const [picked, setPicked] = useState<Row | null>(null);
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const filtered = !!(cluster || branch || cust.trim() || method || outcome || handler);
  const panel = usePanel();

  const exportCsv = async () => {
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const lines = [
      [def.title, `${fmtDate(from)} – ${fmtDate(to)}`, filtered ? `מסונן: ${[cluster, branch, cust, method && (METHOD_LABEL[method] ?? method), outcome && OUTCOME_LABEL[outcome], handler].filter(Boolean).join(' · ')}` : ''].map(esc).join(','),
      res.cols.map((c) => esc(c.label)).join(','),
      ...res.rows.map((r) => res.cols.map((c) => esc(c.kind === 'money' || c.kind === 'num' ? String(r.cells[c.key] ?? '') : fmtCell(c, r.cells[c.key]))).join(',')),
      ...(res.totals ? [res.cols.map((c) => esc(c.kind === 'money' || c.kind === 'num' ? String(res.totals![c.key] ?? '') : fmtCell(c, res.totals![c.key]))).join(',')] : []),
    ];
    // BOM כדי שאקסל יקרא עברית נכון
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `דוח ${def.title} ${from} עד ${to}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    logReportExport(def.id, { from, to, rows: res.rows.length, filters: { cluster, branch, customer: cust.trim(), method, outcome, handler } }).catch(() => undefined);
    toast({ message: <>הדוח יוצא לאקסל · <Ltr>{res.rows.length}</Ltr> שורות</> });
  };

  return (
    <div className="page report">
      <button className="auth__back" onClick={() => nav('/reports')}><ArrowRight size={16} aria-hidden="true" /> דוחות</button>
      <header className="page__head">
        <div>
          <h1 className="page__title">{def.title}</h1>
          <p className="page__sub">{def.desc} · <Ltr>{fmtDate(from)}</Ltr> עד <Ltr>{fmtDate(to)}</Ltr></p>
        </div>
        <div className="page__head-end">
          <Button variant="ghost" size="sm" icon={<RefreshCw size={15} />} onClick={reload} disabled={loading}>רענן</Button>
          <Button variant="secondary" icon={<Download size={16} />} onClick={exportCsv} disabled={loading || !res.rows.length}>ייצוא לאקסל</Button>
        </div>
      </header>

      {/* מסננים בשורה אחת */}
      <div className="tablebar report__filters">
        <div className="seg" role="group" aria-label="טווח">
          {PRESETS.map(([p, l]) => <button key={p} className={preset === p ? 'is-on' : ''} aria-pressed={preset === p} onClick={() => set(p === 'custom' ? { range: p, from, to } : { range: p, from: null, to: null })}>{l}</button>)}
        </div>
        {preset === 'custom' && (
          <span className="report__dates">
            <input type="date" className="input input--sm" value={from} max={to} onChange={(e) => e.target.value && set({ from: e.target.value })} aria-label="מתאריך" />
            <span aria-hidden="true">–</span>
            <input type="date" className="input input--sm" value={to} min={from} onChange={(e) => e.target.value && set({ to: e.target.value })} aria-label="עד תאריך" />
          </span>
        )}
        <select className="input input--sm report__sel" value={cluster} onChange={(e) => set({ cluster: e.target.value, branch: null })} aria-label="אשכול">
          <option value="">כל האשכולות</option>
          {clusters.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input input--sm report__sel" value={branch} onChange={(e) => set({ branch: e.target.value })} aria-label="סניף">
          <option value="">כל הסניפים</option>
          {branches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className="input input--sm report__sel" value={method} onChange={(e) => set({ method: e.target.value })} aria-label="אמצעי תשלום">
          <option value="">כל אמצעי התשלום</option>
          {methods.map((m) => <option key={m} value={m}>{METHOD_LABEL[m] ?? m}</option>)}
        </select>
        <select className="input input--sm report__sel" value={outcome} onChange={(e) => set({ outcome: e.target.value })} aria-label="סטטוס אספקה">
          <option value="">כל הסטטוסים</option>
          {(Object.keys(OUTCOME_LABEL) as Outcome[]).map((k) => <option key={k} value={k}>{OUTCOME_LABEL[k]}</option>)}
        </select>
        <select className="input input--sm report__sel" value={handler} onChange={(e) => set({ handler: e.target.value })} aria-label="מטפל">
          <option value="">כל המטפלים</option>
          {handlers.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <input className="input input--sm report__cust" value={cust} onChange={(e) => setCust(e.target.value)} placeholder="לקוח" aria-label="סינון לפי לקוח" />
        {filtered && <button className="chip is-on" onClick={() => { setCust(''); set({ cluster: null, branch: null, method: null, outcome: null, handler: null }); }}>נקה סינון <X size={13} aria-hidden="true" /></button>}
      </div>

      {error && <p className="cform__formerr" role="alert">{error} – הדוח לא נטען.</p>}
      {loading ? (
        <div className="card loading-rows" aria-busy="true" aria-label="טוען דוח">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={28} />)}</div>
      ) : (
        <>
          {res.kpis && (
            <dl className="report__kpis">
              {res.kpis.map((k) => <div key={k.label} className={k.alert ? 'is-alert' : ''}><dt>{k.label}</dt><dd><Ltr>{k.money ? fmtMoney(Number(k.value)) : k.value}</Ltr>{k.sub && <small> {k.sub}</small>}</dd></div>)}
            </dl>
          )}

          {res.chart && res.rows.length > 0 && (
            <section className="card report__chart" aria-label={res.chart.title}>
              <div className="card__head">
                <h2 className="card__title">{res.chart.title}</h2>
                <div className="seg seg--sm-text" role="group" aria-label="תצוגה">
                  <button className={view === 'chart' ? 'is-on' : ''} aria-pressed={view === 'chart'} onClick={() => setView('chart')}>גרף</button>
                  <button className={view === 'table' ? 'is-on' : ''} aria-pressed={view === 'table'} onClick={() => setView('table')}>הצג כטבלה</button>
                </div>
              </div>
              {view === 'chart' ? (
                <BarChart kind={res.chart.kind} money={res.chart.money}
                  data={res.rows.map((r) => ({ id: r.id, label: String(fmtCell({ key: '', label: '', kind: res.chart!.kind === 'time' && /^\d{4}-\d{2}-\d{2}$/.test(String(r.cells[res.chart!.labelKey])) ? 'date' : 'text' }, r.cells[res.chart!.labelKey])), value: Number(r.cells[res.chart!.valueKey]) || 0 }))}
                  onPick={(rid) => setPicked(res.rows.find((r) => r.id === rid) ?? null)} />
              ) : (
                <table className="report__mini">
                  <thead><tr><th>{res.cols.find((c) => c.key === res.chart!.labelKey)?.label}</th><th>{res.cols.find((c) => c.key === res.chart!.valueKey)?.label}</th></tr></thead>
                  <tbody>{res.rows.map((r) => <tr key={r.id}><td>{fmtCell(res.cols.find((c) => c.key === res.chart!.labelKey)!, r.cells[res.chart!.labelKey])}</td><td><Ltr>{res.chart!.money ? fmtMoney(Number(r.cells[res.chart!.valueKey])) : r.cells[res.chart!.valueKey]}</Ltr></td></tr>)}</tbody>
                </table>
              )}
            </section>
          )}

          <section className="card report__table-card">
            {res.rows.length === 0 ? (
              <EmptyState icon={<ChartColumn size={24} />} title="אין נתונים בטווח הזה">נסה טווח תאריכים אחר או נקה את הסינון.</EmptyState>
            ) : (
              <div className="report__scroll">
                <table className="rtable">
                  <caption className="sr-only">{def.title}</caption>
                  <thead><tr>{res.cols.map((c) => <th key={c.key} className={c.kind === 'money' || c.kind === 'num' || c.kind === 'pct' ? 'num' : ''}>{c.label}</th>)}</tr></thead>
                  <tbody>
                    {res.rows.map((r) => (
                      <tr key={r.id} className={picked?.id === r.id ? 'is-picked' : ''} tabIndex={0} onClick={(e) => (def.perOrder ? panel.open(r.orders[0].id, e.currentTarget) : setPicked(picked?.id === r.id ? null : r))}
                        onKeyDown={(e) => { if (e.key === 'Enter') { if (def.perOrder) panel.open(r.orders[0].id, e.currentTarget); else setPicked(picked?.id === r.id ? null : r); } }} aria-label={def.perOrder ? `הזמנה ${r.id} – פתח את תיק ההזמנה` : `${r.cells[res.cols[0].key]} – הצג את ההזמנות`}>
                        {res.cols.map((c) => <td key={c.key} className={c.kind === 'money' || c.kind === 'num' || c.kind === 'pct' ? 'num' : c.key === 'items' ? 'rtable__wrap' : ''}>{c.kind && c.kind !== 'text' ? <Ltr>{fmtCell(c, r.cells[c.key])}</Ltr> : fmtCell(c, r.cells[c.key])}</td>)}
                      </tr>
                    ))}
                  </tbody>
                  {res.totals && (
                    <tfoot><tr>{res.cols.map((c) => <td key={c.key} className={c.kind === 'money' || c.kind === 'num' || c.kind === 'pct' ? 'num' : ''}>{c.kind && c.kind !== 'text' ? <Ltr>{fmtCell(c, res.totals![c.key])}</Ltr> : fmtCell(c, res.totals![c.key])}</td>)}</tr></tfoot>
                  )}
                </table>
              </div>
            )}
          </section>

          {picked && <DrillDown row={picked} title={String(picked.cells[res.cols[0].key])} onClose={() => setPicked(null)} />}
        </>
      )}
    </div>
  );
}

/* ההזמנות שמרכיבות שורה בדוח */
function DrillDown({ row, title, onClose }: { row: Row; title: string; onClose: () => void }) {
  const panel = usePanel();
  const list = [...row.orders].sort((a: Order, b: Order) => (a.date + a.time).localeCompare(b.date + b.time));
  return (
    <section className="card report__drill" aria-label={`ההזמנות של ${title}`}>
      <div className="card__head">
        <h2 className="card__title">ההזמנות: {title} <span className="muted"><Ltr>{list.length}</Ltr></span></h2>
        <button className="icon-btn icon-btn--sm" aria-label="סגור" onClick={onClose}><X size={16} /></button>
      </div>
      <ul className="report__orders">
        {list.map((o) => (
          <li key={o.id}>
            <button onClick={(e) => panel.open(o.id, e.currentTarget)}>
              <span className="report__oid"><Ltr>{o.id}</Ltr></span>
              <span className="report__odate"><Ltr>{fmtDate(o.date)}</Ltr> <Ltr>{o.time}</Ltr></span>
              <span className="report__ocust">{o.customerName} <span className="muted">· {o.branchName}</span></span>
              <span className="report__osum"><Ltr>{fmtMoney(qVal(o))}</Ltr>{o.status === 'cancelled' && <span className="muted"> · בוטלה</span>}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
