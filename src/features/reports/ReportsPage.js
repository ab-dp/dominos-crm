import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/* דוחות (אפיון 10): מרכז דוחות, ודף דוח אחיד – מסננים בשורה אחת, מדדים, גרף עם "הצג כטבלה",
   טבלה עם שורת סיכום, לחיצה על שורה מציגה את ההזמנות שמרכיבות אותה, וייצוא לאקסל שנרשם ביומן. */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, ChartColumn, Download, RefreshCw, X } from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { logReportExport, useOrdersRange } from '../../data/orders';
import { useStore } from '../../data/store';
import { Button, EmptyState, Skeleton } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, fmtDate, fmtMoney, toISODate } from '../../lib/format';
import { REPORTS, qVal } from './defs';
import { BarChart } from './BarChart';
import '../pages.css';
import './ReportsPage.css';
/* ---------- מרכז הדוחות ---------- */
export function ReportsHub() {
    return (_jsxs("div", { className: "page", children: [_jsx("header", { className: "page__head", children: _jsxs("div", { children: [_jsx("h1", { className: "page__title", children: "\u05D3\u05D5\u05D7\u05D5\u05EA" }), _jsx("p", { className: "page__sub", children: "\u05DB\u05DC \u05D4\u05D3\u05D5\u05D7\u05D5\u05EA \u05DC\u05E4\u05D9 \u05EA\u05D0\u05E8\u05D9\u05DA \u05D0\u05E1\u05E4\u05E7\u05D4 \u05D5\u05E1\u05DB\u05D5\u05DD Q, \u05D1\u05DC\u05D9 \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05E9\u05D1\u05D5\u05D8\u05DC\u05D5 (\u05D7\u05D5\u05E5 \u05DE\u05D3\u05D5\u05D7 \u05D4\u05D1\u05D9\u05D8\u05D5\u05DC\u05D9\u05DD)." })] }) }), _jsx("div", { className: "rhub", children: REPORTS.map((r) => (_jsxs(Link, { to: r.link ?? `/reports/${r.id}`, className: "rhub__card", children: [_jsx("span", { className: "rhub__icon", "aria-hidden": "true", children: _jsx(ChartColumn, { size: 18 }) }), _jsxs("span", { className: "rhub__text", children: [_jsx("b", { children: r.title }), _jsx("span", { children: r.desc })] })] }, r.id))) })] }));
}
const PRESETS = [['month', 'החודש'], ['prev', 'החודש הקודם'], ['d7', '7 ימים'], ['d30', '30 ימים'], ['m3', '3 חודשים'], ['custom', 'מותאם']];
function rangeOf(p, now) {
    const y = now.getFullYear();
    const m = now.getMonth();
    const day = (d) => toISODate(d);
    if (p === 'prev')
        return [day(new Date(y, m - 1, 1)), day(new Date(y, m, 0))];
    if (p === 'd7')
        return [day(new Date(now.getTime() - 6 * 86400000)), day(now)];
    if (p === 'd30')
        return [day(new Date(now.getTime() - 29 * 86400000)), day(now)];
    if (p === 'm3')
        return [day(new Date(y, m - 2, 1)), day(new Date(y, m + 1, 0))];
    return [day(new Date(y, m, 1)), day(new Date(y, m + 1, 0))];
}
const fmtCell = (c, v) => {
    if (v === undefined || v === '')
        return '';
    if (c.kind === 'money')
        return fmtMoney(Number(v));
    if (c.kind === 'pct')
        return `${v}%`;
    if (c.kind === 'date' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v))
        return fmtDate(v);
    return String(v);
};
/* ---------- דף דוח ---------- */
export function ReportView() {
    const { id } = useParams();
    const def = REPORTS.find((r) => r.id === id);
    if (!def || def.link)
        return _jsx("div", { className: "page", children: _jsx("div", { className: "card", children: _jsx(EmptyState, { icon: _jsx(ChartColumn, { size: 24 }), title: "\u05D4\u05D3\u05D5\u05D7 \u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0", action: _jsx(Link, { className: "btn btn--primary btn--md", to: "/reports", children: _jsx("span", { className: "btn__label", children: "\u05DC\u05DB\u05DC \u05D4\u05D3\u05D5\u05D7\u05D5\u05EA" }) }) }) }) });
    return _jsx(Report, { def: def }, def.id);
}
function Report({ def }) {
    const { now } = useStore();
    const nav = useNavigate();
    const toast = useToast();
    const [params, setParams] = useSearchParams();
    const preset = params.get('range') || 'month';
    const [pf, pt] = rangeOf(preset, now);
    const from = preset === 'custom' ? params.get('from') ?? pf : pf;
    const to = preset === 'custom' ? params.get('to') ?? pt : pt;
    const cluster = params.get('cluster') ?? '';
    const branch = params.get('branch') ?? '';
    const [cust, setCust] = useState('');
    const set = (patch) => {
        const p = new URLSearchParams(params);
        Object.entries(patch).forEach(([k, v]) => (v === null || v === '' ? p.delete(k) : p.set(k, v)));
        setParams(p, { replace: true });
    };
    const { orders: raw, loading, error, reload } = useOrdersRange(from, to);
    const clusters = useMemo(() => [...new Set(raw.map((o) => o.cluster).filter(Boolean))].sort(), [raw]);
    const branches = useMemo(() => [...new Set(raw.filter((o) => !cluster || o.cluster === cluster).map((o) => o.branchName))].sort(), [raw, cluster]);
    const orders = useMemo(() => raw.filter((o) => (!cluster || o.cluster === cluster) && (!branch || o.branchName === branch) && (!cust.trim() || o.customerName.includes(cust.trim()))), [raw, cluster, branch, cust]);
    const res = useMemo(() => def.compute(orders), [def, orders]);
    const [picked, setPicked] = useState(null);
    const [view, setView] = useState('chart');
    const filtered = !!(cluster || branch || cust.trim());
    const exportCsv = async () => {
        const esc = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
        const lines = [
            [def.title, `${fmtDate(from)} – ${fmtDate(to)}`, filtered ? `מסונן: ${[cluster, branch, cust].filter(Boolean).join(' · ')}` : ''].map(esc).join(','),
            res.cols.map((c) => esc(c.label)).join(','),
            ...res.rows.map((r) => res.cols.map((c) => esc(c.kind === 'money' || c.kind === 'num' ? String(r.cells[c.key] ?? '') : fmtCell(c, r.cells[c.key]))).join(',')),
            ...(res.totals ? [res.cols.map((c) => esc(c.kind === 'money' || c.kind === 'num' ? String(res.totals[c.key] ?? '') : fmtCell(c, res.totals[c.key]))).join(',')] : []),
        ];
        // BOM כדי שאקסל יקרא עברית נכון
        const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `דוח ${def.title} ${from} עד ${to}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        logReportExport(def.id, { from, to, rows: res.rows.length, filters: { cluster, branch, customer: cust.trim() } }).catch(() => undefined);
        toast({ message: _jsxs(_Fragment, { children: ["\u05D4\u05D3\u05D5\u05D7 \u05D9\u05D5\u05E6\u05D0 \u05DC\u05D0\u05E7\u05E1\u05DC \u00B7 ", _jsx(Ltr, { children: res.rows.length }), " \u05E9\u05D5\u05E8\u05D5\u05EA"] }) });
    };
    return (_jsxs("div", { className: "page report", children: [_jsxs("button", { className: "auth__back", onClick: () => nav('/reports'), children: [_jsx(ArrowRight, { size: 16, "aria-hidden": "true" }), " \u05D3\u05D5\u05D7\u05D5\u05EA"] }), _jsxs("header", { className: "page__head", children: [_jsxs("div", { children: [_jsx("h1", { className: "page__title", children: def.title }), _jsxs("p", { className: "page__sub", children: [def.desc, " \u00B7 ", _jsx(Ltr, { children: fmtDate(from) }), " \u05E2\u05D3 ", _jsx(Ltr, { children: fmtDate(to) })] })] }), _jsxs("div", { className: "page__head-end", children: [_jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(RefreshCw, { size: 15 }), onClick: reload, disabled: loading, children: "\u05E8\u05E2\u05E0\u05DF" }), _jsx(Button, { variant: "secondary", icon: _jsx(Download, { size: 16 }), onClick: exportCsv, disabled: loading || !res.rows.length, children: "\u05D9\u05D9\u05E6\u05D5\u05D0 \u05DC\u05D0\u05E7\u05E1\u05DC" })] })] }), _jsxs("div", { className: "tablebar report__filters", children: [_jsx("div", { className: "seg", role: "group", "aria-label": "\u05D8\u05D5\u05D5\u05D7", children: PRESETS.map(([p, l]) => _jsx("button", { className: preset === p ? 'is-on' : '', "aria-pressed": preset === p, onClick: () => set(p === 'custom' ? { range: p, from, to } : { range: p, from: null, to: null }), children: l }, p)) }), preset === 'custom' && (_jsxs("span", { className: "report__dates", children: [_jsx("input", { type: "date", className: "input input--sm", value: from, max: to, onChange: (e) => e.target.value && set({ from: e.target.value }), "aria-label": "\u05DE\u05EA\u05D0\u05E8\u05D9\u05DA" }), _jsx("span", { "aria-hidden": "true", children: "\u2013" }), _jsx("input", { type: "date", className: "input input--sm", value: to, min: from, onChange: (e) => e.target.value && set({ to: e.target.value }), "aria-label": "\u05E2\u05D3 \u05EA\u05D0\u05E8\u05D9\u05DA" })] })), _jsxs("select", { className: "input input--sm report__sel", value: cluster, onChange: (e) => set({ cluster: e.target.value, branch: null }), "aria-label": "\u05D0\u05E9\u05DB\u05D5\u05DC", children: [_jsx("option", { value: "", children: "\u05DB\u05DC \u05D4\u05D0\u05E9\u05DB\u05D5\u05DC\u05D5\u05EA" }), clusters.map((c) => _jsx("option", { value: c, children: c }, c))] }), _jsxs("select", { className: "input input--sm report__sel", value: branch, onChange: (e) => set({ branch: e.target.value }), "aria-label": "\u05E1\u05E0\u05D9\u05E3", children: [_jsx("option", { value: "", children: "\u05DB\u05DC \u05D4\u05E1\u05E0\u05D9\u05E4\u05D9\u05DD" }), branches.map((b) => _jsx("option", { value: b, children: b }, b))] }), _jsx("input", { className: "input input--sm report__cust", value: cust, onChange: (e) => setCust(e.target.value), placeholder: "\u05DC\u05E7\u05D5\u05D7", "aria-label": "\u05E1\u05D9\u05E0\u05D5\u05DF \u05DC\u05E4\u05D9 \u05DC\u05E7\u05D5\u05D7" }), filtered && _jsxs("button", { className: "chip is-on", onClick: () => { setCust(''); set({ cluster: null, branch: null }); }, children: ["\u05E0\u05E7\u05D4 \u05E1\u05D9\u05E0\u05D5\u05DF ", _jsx(X, { size: 13, "aria-hidden": "true" })] })] }), error && _jsxs("p", { className: "cform__formerr", role: "alert", children: [error, " \u2013 \u05D4\u05D3\u05D5\u05D7 \u05DC\u05D0 \u05E0\u05D8\u05E2\u05DF."] }), loading ? (_jsx("div", { className: "card loading-rows", "aria-busy": "true", "aria-label": "\u05D8\u05D5\u05E2\u05DF \u05D3\u05D5\u05D7", children: [0, 1, 2, 3, 4].map((i) => _jsx(Skeleton, { h: 28 }, i)) })) : (_jsxs(_Fragment, { children: [res.kpis && (_jsx("dl", { className: "report__kpis", children: res.kpis.map((k) => _jsxs("div", { className: k.alert ? 'is-alert' : '', children: [_jsx("dt", { children: k.label }), _jsx("dd", { children: _jsx(Ltr, { children: k.money ? fmtMoney(Number(k.value)) : k.value }) })] }, k.label)) })), res.chart && res.rows.length > 0 && (_jsxs("section", { className: "card report__chart", "aria-label": res.chart.title, children: [_jsxs("div", { className: "card__head", children: [_jsx("h2", { className: "card__title", children: res.chart.title }), _jsxs("div", { className: "seg seg--sm-text", role: "group", "aria-label": "\u05EA\u05E6\u05D5\u05D2\u05D4", children: [_jsx("button", { className: view === 'chart' ? 'is-on' : '', "aria-pressed": view === 'chart', onClick: () => setView('chart'), children: "\u05D2\u05E8\u05E3" }), _jsx("button", { className: view === 'table' ? 'is-on' : '', "aria-pressed": view === 'table', onClick: () => setView('table'), children: "\u05D4\u05E6\u05D2 \u05DB\u05D8\u05D1\u05DC\u05D4" })] })] }), view === 'chart' ? (_jsx(BarChart, { kind: res.chart.kind, money: res.chart.money, data: res.rows.map((r) => ({ id: r.id, label: String(fmtCell({ key: '', label: '', kind: res.chart.kind === 'time' && /^\d{4}-\d{2}-\d{2}$/.test(String(r.cells[res.chart.labelKey])) ? 'date' : 'text' }, r.cells[res.chart.labelKey])), value: Number(r.cells[res.chart.valueKey]) || 0 })), onPick: (rid) => setPicked(res.rows.find((r) => r.id === rid) ?? null) })) : (_jsxs("table", { className: "report__mini", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: res.cols.find((c) => c.key === res.chart.labelKey)?.label }), _jsx("th", { children: res.cols.find((c) => c.key === res.chart.valueKey)?.label })] }) }), _jsx("tbody", { children: res.rows.map((r) => _jsxs("tr", { children: [_jsx("td", { children: fmtCell(res.cols.find((c) => c.key === res.chart.labelKey), r.cells[res.chart.labelKey]) }), _jsx("td", { children: _jsx(Ltr, { children: res.chart.money ? fmtMoney(Number(r.cells[res.chart.valueKey])) : r.cells[res.chart.valueKey] }) })] }, r.id)) })] }))] })), _jsx("section", { className: "card report__table-card", children: res.rows.length === 0 ? (_jsx(EmptyState, { icon: _jsx(ChartColumn, { size: 24 }), title: "\u05D0\u05D9\u05DF \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05D1\u05D8\u05D5\u05D5\u05D7 \u05D4\u05D6\u05D4", children: "\u05E0\u05E1\u05D4 \u05D8\u05D5\u05D5\u05D7 \u05EA\u05D0\u05E8\u05D9\u05DB\u05D9\u05DD \u05D0\u05D7\u05E8 \u05D0\u05D5 \u05E0\u05E7\u05D4 \u05D0\u05EA \u05D4\u05E1\u05D9\u05E0\u05D5\u05DF." })) : (_jsx("div", { className: "report__scroll", children: _jsxs("table", { className: "rtable", children: [_jsx("caption", { className: "sr-only", children: def.title }), _jsx("thead", { children: _jsx("tr", { children: res.cols.map((c) => _jsx("th", { className: c.kind === 'money' || c.kind === 'num' || c.kind === 'pct' ? 'num' : '', children: c.label }, c.key)) }) }), _jsx("tbody", { children: res.rows.map((r) => (_jsx("tr", { className: picked?.id === r.id ? 'is-picked' : '', tabIndex: 0, onClick: () => setPicked(picked?.id === r.id ? null : r), onKeyDown: (e) => { if (e.key === 'Enter')
                                                setPicked(picked?.id === r.id ? null : r); }, "aria-label": `${r.cells[res.cols[0].key]} – הצג את ההזמנות`, children: res.cols.map((c) => _jsx("td", { className: c.kind === 'money' || c.kind === 'num' || c.kind === 'pct' ? 'num' : '', children: c.kind && c.kind !== 'text' ? _jsx(Ltr, { children: fmtCell(c, r.cells[c.key]) }) : fmtCell(c, r.cells[c.key]) }, c.key)) }, r.id))) }), res.totals && (_jsx("tfoot", { children: _jsx("tr", { children: res.cols.map((c) => _jsx("td", { className: c.kind === 'money' || c.kind === 'num' || c.kind === 'pct' ? 'num' : '', children: c.kind && c.kind !== 'text' ? _jsx(Ltr, { children: fmtCell(c, res.totals[c.key]) }) : fmtCell(c, res.totals[c.key]) }, c.key)) }) }))] }) })) }), picked && _jsx(DrillDown, { row: picked, title: String(picked.cells[res.cols[0].key]), onClose: () => setPicked(null) })] }))] }));
}
/* ההזמנות שמרכיבות שורה בדוח */
function DrillDown({ row, title, onClose }) {
    const panel = usePanel();
    const list = [...row.orders].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return (_jsxs("section", { className: "card report__drill", "aria-label": `ההזמנות של ${title}`, children: [_jsxs("div", { className: "card__head", children: [_jsxs("h2", { className: "card__title", children: ["\u05D4\u05D4\u05D6\u05DE\u05E0\u05D5\u05EA: ", title, " ", _jsx("span", { className: "muted", children: _jsx(Ltr, { children: list.length }) })] }), _jsx("button", { className: "icon-btn icon-btn--sm", "aria-label": "\u05E1\u05D2\u05D5\u05E8", onClick: onClose, children: _jsx(X, { size: 16 }) })] }), _jsx("ul", { className: "report__orders", children: list.map((o) => (_jsx("li", { children: _jsxs("button", { onClick: (e) => panel.open(o.id, e.currentTarget), children: [_jsx("span", { className: "report__oid", children: _jsx(Ltr, { children: o.id }) }), _jsxs("span", { className: "report__odate", children: [_jsx(Ltr, { children: fmtDate(o.date) }), " ", _jsx(Ltr, { children: o.time })] }), _jsxs("span", { className: "report__ocust", children: [o.customerName, " ", _jsxs("span", { className: "muted", children: ["\u00B7 ", o.branchName] })] }), _jsxs("span", { className: "report__osum", children: [_jsx(Ltr, { children: fmtMoney(qVal(o)) }), o.status === 'cancelled' && _jsx("span", { className: "muted", children: " \u00B7 \u05D1\u05D5\u05D8\u05DC\u05D4" })] })] }) }, o.id))) })] }));
}
