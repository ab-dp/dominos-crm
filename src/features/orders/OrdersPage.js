import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Rows3, Rows4, Search, X } from 'lucide-react';
import { Skeleton } from '../../design/components';
import { usePref } from '../../lib/prefs';
import { useStore } from '../../data/store';
import { CLOSED } from '../../data/types';
import { HEALTH_RANK } from '../../rules-engine/health';
import { Ltr, fmtDate, fmtMoney, toISODate, weekday } from '../../lib/format';
import { OrdersTable } from './OrdersTable';
import '../pages.css';
const TABS = [['today', 'היום'], ['tomorrow', 'מחר'], ['future', 'עתידיות'], ['overdue', 'פתוחות שעבר מועדן'], ['archive', 'ארכיון']];
const RANGES = [3, 7, 14, 30, 0];
export const FILTERS = {
    branch: { label: 'בלי אישור סניף', test: (o) => !o.branchApproval },
    q: { label: 'לא הועברו ל-Q', test: (o) => !o.qNumber },
    credit: { label: 'אשראי לחייב', test: (o) => o.method === 'credit' && (o.payment === 'pending' || o.payment === 'failed') },
    issues: { label: 'עם חריג', test: (o) => o.health === 'critical' || o.health === 'urgent' },
};
const byTime = (a, b) => (a.date + a.time).localeCompare(b.date + b.time);
const urgentFirst = (a, b) => HEALTH_RANK[b.health] - HEALTH_RANK[a.health] || byTime(a, b);
export function OrdersPage() {
    const { orders, now, loading, error } = useStore();
    const [params, setParams] = useSearchParams();
    const tab = params.get('tab') || 'today';
    const range = Number(params.get('range') ?? 7);
    const filterKey = params.get('filter');
    const filter = filterKey ? FILTERS[filterKey] : undefined;
    const today = toISODate(now);
    const tomorrow = toISODate(new Date(now.getTime() + 86400000));
    const rangeEnd = range ? toISODate(new Date(now.getTime() + range * 86400000)) : '9999';
    const lists = useMemo(() => {
        const open = orders.filter((o) => !CLOSED.includes(o.status));
        return {
            today: open.filter((o) => o.date === today).sort(urgentFirst),
            tomorrow: open.filter((o) => o.date === tomorrow).sort(urgentFirst),
            future: open.filter((o) => o.date > tomorrow && o.date <= rangeEnd).sort(byTime),
            overdue: open.filter((o) => o.date < today).sort(byTime),
            archive: orders.filter((o) => CLOSED.includes(o.status)).sort((a, b) => byTime(b, a)),
        };
    }, [orders, today, tomorrow, rangeEnd]);
    const [query, setQuery] = useState('');
    const [density, setDensity] = usePref('tableDensity', 'dense');
    const q = query.trim().toLowerCase();
    const rows = lists[tab]
        .filter((o) => !filter || filter.test(o))
        .filter((o) => !q || o.customerName.toLowerCase().includes(q) || String(o.id).includes(q) || (o.qNumber ?? '').toLowerCase().includes(q) || o.branchName.includes(q));
    const total = rows.filter((o) => o.status !== 'cancelled').reduce((t, o) => t + (o.qAmount ?? o.amount), 0);
    const needs = rows.filter((o) => o.health === 'critical' || o.health === 'urgent').length;
    const set = (k, v) => {
        const p = new URLSearchParams(params);
        if (v === null)
            p.delete(k);
        else
            p.set(k, v);
        setParams(p, { replace: true });
    };
    return (_jsxs("div", { className: "page", children: [_jsxs("header", { className: "page__head", children: [_jsxs("div", { children: [_jsx("h1", { className: "page__title", children: "\u05D4\u05D6\u05DE\u05E0\u05D5\u05EA" }), _jsxs("p", { className: "page__sub", children: ["\u05D9\u05D5\u05DD ", weekday(today), " \u00B7 ", _jsx(Ltr, { children: fmtDate(today) })] })] }), _jsxs("dl", { className: "head-stats", "aria-live": "polite", children: [_jsxs("div", { children: [_jsx("dt", { children: "\u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05D1\u05EA\u05E6\u05D5\u05D2\u05D4" }), _jsx("dd", { children: _jsx(Ltr, { children: rows.length }) })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u05E1\u05DA \u05D4\u05DB\u05DC" }), _jsx("dd", { children: _jsx(Ltr, { children: fmtMoney(total) }) })] }), _jsxs("div", { className: needs ? 'is-alert' : '', children: [_jsx("dt", { children: "\u05D3\u05D5\u05E8\u05E9\u05D5\u05EA \u05D8\u05D9\u05E4\u05D5\u05DC" }), _jsx("dd", { children: _jsx(Ltr, { children: needs }) })] })] })] }), error && _jsxs("p", { className: "cform__formerr", role: "alert", children: [error, " \u2013 \u05D4\u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05DC\u05D0 \u05E0\u05D8\u05E2\u05E0\u05D5. \u05E8\u05E2\u05E0\u05DF \u05D0\u05EA \u05D4\u05D3\u05E3."] }), _jsx("div", { className: "tabs", role: "tablist", "aria-label": "\u05EA\u05E6\u05D5\u05D2\u05EA \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA", children: TABS.map(([k, label]) => (_jsxs("button", { role: "tab", "aria-selected": tab === k, className: `tab ${tab === k ? 'is-on' : ''} ${k === 'overdue' && lists.overdue.length ? 'tab--alert' : ''}`, onClick: () => set('tab', k), children: [label, _jsx("span", { className: "tab__count", children: _jsx(Ltr, { children: lists[k].length }) })] }, k))) }), _jsxs("div", { className: "tablebar", children: [tab === 'future' && (_jsx("div", { className: "seg", role: "group", "aria-label": "\u05D8\u05D5\u05D5\u05D7 \u05D9\u05DE\u05D9\u05DD", children: RANGES.map((r) => (_jsx("button", { className: range === r ? 'is-on' : '', "aria-pressed": range === r, onClick: () => set('range', String(r)), children: r ? _jsxs(_Fragment, { children: [_jsx(Ltr, { children: r }), " \u05D9\u05DE\u05D9\u05DD"] }) : 'הכל' }, r))) })), _jsx("div", { className: "chips", role: "group", "aria-label": "\u05E1\u05D9\u05E0\u05D5\u05DF \u05DE\u05D4\u05D9\u05E8", children: Object.entries(FILTERS).map(([k, f]) => (_jsxs("button", { className: `chip ${filterKey === k ? 'is-on' : ''}`, "aria-pressed": filterKey === k, onClick: () => set('filter', filterKey === k ? null : k), children: [f.label, filterKey === k && _jsx(X, { size: 14, "aria-hidden": "true" })] }, k))) }), _jsxs("label", { className: "tablebar__search", children: [_jsx(Search, { size: 16, "aria-hidden": "true" }), _jsx("input", { value: query, onChange: (e) => setQuery(e.target.value), placeholder: "\u05E1\u05D9\u05E0\u05D5\u05DF \u05D1\u05D8\u05D1\u05DC\u05D4: \u05DC\u05E7\u05D5\u05D7, \u05DE\u05E1' \u05D4\u05D6\u05DE\u05E0\u05D4, Q, \u05E1\u05E0\u05D9\u05E3", "aria-label": "\u05E1\u05D9\u05E0\u05D5\u05DF \u05D1\u05D8\u05D1\u05DC\u05D4" }), query && _jsx("button", { onClick: () => setQuery(''), "aria-label": "\u05E0\u05E7\u05D4 \u05E1\u05D9\u05E0\u05D5\u05DF", children: _jsx(X, { size: 14 }) })] }), _jsxs("div", { className: "seg seg--sm", role: "group", "aria-label": "\u05E6\u05E4\u05D9\u05E4\u05D5\u05EA \u05D4\u05D8\u05D1\u05DC\u05D4", children: [_jsxs("button", { className: density === 'dense' ? 'is-on' : '', "aria-pressed": density === 'dense', onClick: () => setDensity('dense'), title: "\u05E6\u05E4\u05D5\u05E3", children: [_jsx(Rows4, { size: 16, "aria-hidden": "true" }), _jsx("span", { className: "sr-only", children: "\u05E6\u05E4\u05D5\u05E3" })] }), _jsxs("button", { className: density === 'comfy' ? 'is-on' : '', "aria-pressed": density === 'comfy', onClick: () => setDensity('comfy'), title: "\u05DE\u05E8\u05D5\u05D5\u05D7", children: [_jsx(Rows3, { size: 16, "aria-hidden": "true" }), _jsx("span", { className: "sr-only", children: "\u05DE\u05E8\u05D5\u05D5\u05D7" })] })] })] }), loading ? (_jsx("div", { className: "card orders-loading", "aria-busy": "true", "aria-label": "\u05D8\u05D5\u05E2\u05DF \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA", children: [0, 1, 2, 3, 4].map((i) => _jsx(Skeleton, { h: 20 }, i)) })) : _jsx(OrdersTable, { density: density, rows: rows, showDate: tab !== 'today' && tab !== 'tomorrow', caption: `הזמנות – ${TABS.find((t) => t[0] === tab)[1]}${filter ? ` – ${filter.label}` : ''}`, emptyText: filter ? `אין הזמנות: ${filter.label}` : tab === 'tomorrow' ? 'אין הזמנות למחר' : tab === 'overdue' ? 'אין הזמנות פתוחות שעבר מועדן ✓' : 'אין הזמנות בתצוגה הזו' })] }));
}
