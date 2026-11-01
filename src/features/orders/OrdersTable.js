import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/* הטבלה המרכזית (אפיון 6.2). היום · מחר · עתידיות · ארכיון הם אותה טבלה עם מסנן שונה.
   חיצים מעבר בין שורות, Enter פתיחה. כל פעולה נפוצה – ישירות בשורה. */
import { useEffect, useRef, useState } from 'react';
import { ClipboardList, Phone as PhoneIcon } from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { useStore } from '../../data/store';
import { EmptyState, HealthBadge, Missing, StatusMenu } from '../../design/components';
import { Ltr, Money, fmtDate } from '../../lib/format';
import { METHOD_LABEL } from '../../data/types';
import { FixButton, OrderMarks } from './OrderActions';
import './OrdersTable.css';
export function OrdersTable({ rows, showDate = true, emptyText, caption, density = 'dense' }) {
    const panel = usePanel();
    const { requestStatus, updateMany } = useStore();
    const [selected, setSelected] = useState([]);
    const [flash, setFlash] = useState(null);
    const body = useRef(null);
    // "כאן היית": השורה שממנה נפתח התיק מהבהבת פעם אחת בסגירה
    useEffect(() => {
        if (panel.lastClosed == null)
            return;
        setFlash(panel.lastClosed);
        const t = setTimeout(() => setFlash(null), 1200);
        return () => clearTimeout(t);
    }, [panel.lastClosed]);
    useEffect(() => setSelected((s) => s.filter((id) => rows.some((r) => r.id === id))), [rows]);
    if (rows.length === 0) {
        return _jsxs(EmptyState, { icon: _jsx(ClipboardList, { size: 24 }), title: emptyText, children: ["\u05D0\u05E4\u05E9\u05E8 \u05DC\u05D9\u05E6\u05D5\u05E8 \u05D4\u05D6\u05DE\u05E0\u05D4 \u05D7\u05D3\u05E9\u05D4 \u05DE\u05D4\u05DB\u05E4\u05EA\u05D5\u05E8 \u05DC\u05DE\u05E2\u05DC\u05D4 \u05D0\u05D5 \u05D1\u05DC\u05D7\u05D9\u05E6\u05D4 \u05E2\u05DC ", _jsx("kbd", { className: "kbd", children: "N" })] });
    }
    const onRowKey = (e, o) => {
        if (e.target !== e.currentTarget)
            return;
        const tr = e.currentTarget;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            tr.nextElementSibling?.focus();
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            tr.previousElementSibling?.focus();
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            panel.open(o.id, tr);
        }
    };
    const allOn = selected.length === rows.length;
    return (_jsxs("div", { className: "otable-wrap", children: [selected.length > 0 && (_jsxs("div", { className: "bulkbar", role: "toolbar", "aria-label": "\u05E4\u05E2\u05D5\u05DC\u05D5\u05EA \u05E2\u05DC \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05DE\u05E1\u05D5\u05DE\u05E0\u05D5\u05EA", children: [_jsxs("span", { children: [_jsx(Ltr, { children: selected.length }), " \u05E0\u05D1\u05D7\u05E8\u05D5"] }), _jsx("button", { onClick: () => { updateMany(selected, { status: 'delivered' }, _jsxs(_Fragment, { children: [_jsx(Ltr, { children: selected.length }), " \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05E1\u05D5\u05DE\u05E0\u05D5 \u05DB\u05E1\u05D5\u05E4\u05E7\u05D5"] })); setSelected([]); }, children: "\u05E1\u05DE\u05DF \u05DB\u05E1\u05D5\u05E4\u05E7\u05D5" }), _jsx("button", { onClick: () => { updateMany(selected, { payment: 'paid' }, _jsxs(_Fragment, { children: [_jsx(Ltr, { children: selected.length }), " \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05E1\u05D5\u05DE\u05E0\u05D5 \u05DB\u05E9\u05D5\u05DC\u05DE\u05D5"] })); setSelected([]); }, children: "\u05E1\u05DE\u05DF \u05E9\u05D5\u05DC\u05DD" }), _jsx("button", { disabled: true, title: "\u05E9\u05DC\u05D1 8", children: "\u05D9\u05D9\u05E6\u05D5\u05D0 \u05DC\u05D0\u05E7\u05E1\u05DC" }), _jsx("button", { className: "bulkbar__clear", onClick: () => setSelected([]), children: "\u05E0\u05D9\u05E7\u05D5\u05D9 \u05D1\u05D7\u05D9\u05E8\u05D4" })] })), _jsxs("table", { className: `otable otable--orders otable--${density}`, children: [_jsx("caption", { className: "sr-only", children: caption }), _jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { className: "col-check", children: _jsx("input", { type: "checkbox", "aria-label": "\u05D1\u05D7\u05E8 \u05D4\u05DB\u05DC", checked: allOn, onChange: () => setSelected(allOn ? [] : rows.map((r) => r.id)) }) }), _jsx("th", { children: "\u05EA\u05E7\u05D9\u05E0\u05D5\u05EA" }), _jsx("th", { "aria-sort": "ascending", children: "\u05E9\u05E2\u05D4" }), showDate && _jsx("th", { children: "\u05EA\u05D0\u05E8\u05D9\u05DA" }), _jsx("th", { children: "\u05DC\u05E7\u05D5\u05D7" }), _jsx("th", { children: "\u05E1\u05E0\u05D9\u05E3" }), _jsx("th", { className: "num", children: "\u05E1\u05DB\u05D5\u05DD" }), _jsx("th", { children: "\u05E1\u05D8\u05D8\u05D5\u05E1" }), _jsx("th", { children: "\u05E1\u05E0\u05D9\u05E3 \u00B7 Q \u00B7 \u05EA\u05E9\u05DC\u05D5\u05DD" }), _jsx("th", { children: "\u05D0\u05DE\u05E6\u05E2\u05D9" }), _jsx("th", { children: "\u05DE\u05D8\u05E4\u05DC" }), _jsx("th", { children: _jsx("span", { className: "sr-only", children: "\u05E4\u05E2\u05D5\u05DC\u05D4" }) })] }) }), _jsx("tbody", { ref: body, children: rows.map((o) => {
                            const top = o.issues[0];
                            return (_jsxs("tr", { tabIndex: 0, className: `orow orow--${o.health} ${flash === o.id ? 'is-flash' : ''} ${selected.includes(o.id) ? 'is-selected' : ''}`, onClick: (e) => panel.open(o.id, e.currentTarget), onKeyDown: (e) => onRowKey(e, o), "aria-label": `הזמנה ${o.id}, ${o.customerName}, ${o.time}${top ? `, ${top.label}` : ''}`, children: [_jsx("td", { className: "col-check", onClick: (e) => e.stopPropagation(), children: _jsx("input", { type: "checkbox", "aria-label": `בחר הזמנה ${o.id}`, checked: selected.includes(o.id), onChange: () => setSelected((s) => s.includes(o.id) ? s.filter((x) => x !== o.id) : [...s, o.id]) }) }), _jsx("td", { className: "c-health", children: _jsx(HealthBadge, { health: o.health, issues: o.issues }) }), _jsx("td", { className: "num strong c-time", children: o.time ? _jsx(Ltr, { children: o.time }) : _jsx(Missing, { children: "\u05E9\u05E2\u05D4?" }) }), showDate && _jsx("td", { className: "num", children: _jsx(Ltr, { children: fmtDate(o.date) }) }), _jsxs("td", { className: "c-cust", children: [_jsxs("span", { className: "orow__cust", children: [o.customerName, o.changedAfterApproval && _jsx("span", { className: "changed-tag changed-tag--sm", title: "\u05E9\u05D5\u05E0\u05EA\u05D4 \u05DC\u05D0\u05D7\u05E8 \u05D0\u05D9\u05E9\u05D5\u05E8", children: "\u05E9\u05D5\u05E0\u05EA\u05D4" })] }), top && o.health !== 'ok' && _jsx("span", { className: `orow__why orow__why--${o.health}`, children: top.label })] }), _jsxs("td", { children: [_jsx("span", { className: "orow__branch", children: o.branchName || _jsx(Missing, { children: "\u05DC\u05DC\u05D0 \u05E1\u05E0\u05D9\u05E3" }) }), o.branchPhone && _jsxs("span", { className: "orow__sub", children: [_jsx(PhoneIcon, { size: 12, "aria-hidden": "true" }), " ", _jsx(Ltr, { children: o.branchPhone.replace(/(\d{3})(\d+)/, '$1-$2') })] })] }), _jsx("td", { className: "num", children: o.amount > 0 ? _jsx(Money, { value: o.amount }) : _jsx(Missing, { children: "\u05D7\u05E1\u05E8 \u05E1\u05DB\u05D5\u05DD" }) }), _jsx("td", { onClick: (e) => e.stopPropagation(), children: _jsx(StatusMenu, { status: o.status, onChange: (s) => requestStatus(o, s) }) }), _jsx("td", { className: "orow__marks c-marks", onClick: (e) => e.stopPropagation(), children: _jsx(OrderMarks, { o: o }) }), _jsx("td", { children: o.methodLabel ?? METHOD_LABEL[o.method] ?? o.method }), _jsx("td", { children: o.handler }), _jsx("td", { className: "c-act", onClick: (e) => e.stopPropagation(), children: top && (o.health === 'critical' || o.health === 'urgent' || top.action === 'po') && _jsx(FixButton, { o: o, issue: top, onOpen: () => panel.open(o.id) }, top.rule) })] }, o.id));
                        }) })] })] }));
}
