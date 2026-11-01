import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/* מאגר הלקוחות (אפיון 6.5). הסינון הראשוני הוא "קבועים", כדי שלקוחות מזדמנים לא יעמיסו על הרשימה. */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileCheck2, Plus, Search, Users, X } from 'lucide-react';
import { primaryContact, useCustomers } from '../../data/customers';
import { useLists } from '../../data/lists';
import { usePriceLists } from '../../data/priceLists';
import { Button, EmptyState, Skeleton, Tip } from '../../design/components';
import { Ltr, fmtPhone } from '../../lib/format';
import { usePref } from '../../lib/prefs';
import { CustomerForm } from './CustomerForm';
import '../pages.css';
import './CustomersPage.css';
export function CustomersPage() {
    const { items, loading, error } = useCustomers();
    const { lists } = useLists();
    const { items: priceLists } = usePriceLists();
    const nav = useNavigate();
    const [type, setType] = usePref('customersType', 'regular');
    const [showInactive, setShowInactive] = useState(false);
    const [q, setQ] = useState('');
    const [adding, setAdding] = useState(false);
    const methodLabel = (id) => lists?.paymentMethods.find((m) => m.id === id)?.label ?? id;
    const plName = (id) => priceLists.find((p) => p.id === id)?.name ?? '';
    const sharedPhones = useMemo(() => {
        const m = {};
        items.forEach((c) => { if (c.accountPhone && c.status !== 'merged')
            m[c.accountPhone] = (m[c.accountPhone] ?? 0) + 1; });
        return m;
    }, [items]);
    const live = items.filter((c) => c.status !== 'merged');
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, '');
    const rows = live
        .filter((c) => type === 'all' || c.type === type)
        .filter((c) => showInactive || c.status === 'active')
        .filter((c) => !s || c.name.toLowerCase().includes(s)
        || (digits.length >= 3 && (c.taxId.includes(digits) || c.accountPhone.includes(digits) || c.contacts.some((x) => x.phone.includes(digits))))
        || c.contacts.some((x) => x.name.includes(q.trim())));
    const counts = { regular: live.filter((c) => c.type === 'regular' && (showInactive || c.status === 'active')).length, occasional: live.filter((c) => c.type === 'occasional' && (showInactive || c.status === 'active')).length };
    return (_jsxs("div", { className: "page", children: [_jsxs("header", { className: "page__head", children: [_jsxs("div", { children: [_jsx("h1", { className: "page__title", children: "\u05DC\u05E7\u05D5\u05D7\u05D5\u05EA" }), _jsx("p", { className: "page__sub", children: "\u05DB\u05DC \u05D4\u05DC\u05E7\u05D5\u05D7\u05D5\u05EA \u05D4\u05E2\u05E1\u05E7\u05D9\u05D9\u05DD, \u05DB\u05D5\u05DC\u05DC \u05D8\u05DC\u05E4\u05D5\u05DF \u05D4\u05D4\u05E7\u05E4\u05D4. \u05DC\u05D7\u05D9\u05E6\u05D4 \u05E2\u05DC \u05DC\u05E7\u05D5\u05D7 \u05E4\u05D5\u05EA\u05D7\u05EA \u05D0\u05EA \u05D4\u05EA\u05D9\u05E7 \u05E9\u05DC\u05D5." })] }), _jsx("div", { className: "page__head-end", children: _jsx(Button, { variant: "primary", icon: _jsx(Plus, { size: 18 }), onClick: () => setAdding(true), children: "\u05DC\u05E7\u05D5\u05D7 \u05D7\u05D3\u05E9" }) })] }), _jsxs("div", { className: "tablebar", children: [_jsxs("div", { className: "seg", role: "group", "aria-label": "\u05E1\u05D5\u05D2 \u05DC\u05E7\u05D5\u05D7", children: [_jsxs("button", { className: type === 'regular' ? 'is-on' : '', "aria-pressed": type === 'regular', onClick: () => setType('regular'), children: ["\u05E7\u05D1\u05D5\u05E2\u05D9\u05DD ", _jsx(Ltr, { children: counts.regular })] }), _jsxs("button", { className: type === 'occasional' ? 'is-on' : '', "aria-pressed": type === 'occasional', onClick: () => setType('occasional'), children: ["\u05DE\u05D6\u05D3\u05DE\u05E0\u05D9\u05DD ", _jsx(Ltr, { children: counts.occasional })] }), _jsx("button", { className: type === 'all' ? 'is-on' : '', "aria-pressed": type === 'all', onClick: () => setType('all'), children: "\u05D4\u05DB\u05DC" })] }), _jsxs("label", { className: "check-inline", children: [_jsx("input", { type: "checkbox", checked: showInactive, onChange: (e) => setShowInactive(e.target.checked) }), " \u05D4\u05E6\u05D2 \u05DC\u05D0 \u05E4\u05E2\u05D9\u05DC\u05D9\u05DD"] }), _jsxs("label", { className: "tablebar__search", children: [_jsx(Search, { size: 16, "aria-hidden": "true" }), _jsx("input", { value: q, onChange: (e) => setQ(e.target.value), placeholder: "\u05E9\u05DD, \u05D7.\u05E4, \u05D8\u05DC\u05E4\u05D5\u05DF, \u05D8\u05DC\u05E4\u05D5\u05DF \u05D4\u05E7\u05E4\u05D4 \u05D0\u05D5 \u05D0\u05D9\u05E9 \u05E7\u05E9\u05E8", "aria-label": "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05DC\u05E7\u05D5\u05D7" }), q && _jsx("button", { onClick: () => setQ(''), "aria-label": "\u05E0\u05E7\u05D4 \u05D7\u05D9\u05E4\u05D5\u05E9", children: _jsx(X, { size: 14 }) })] })] }), error ? _jsx("div", { className: "card", children: _jsxs(EmptyState, { icon: _jsx(Users, { size: 24 }), title: "\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05D8\u05E2\u05D5\u05DF \u05DC\u05E7\u05D5\u05D7\u05D5\u05EA", children: [error, ". \u05D5\u05D3\u05D0 \u05E9\u05DB\u05DC\u05DC\u05D9 \u05D4\u05D0\u05D1\u05D8\u05D7\u05D4 \u05E4\u05D5\u05E8\u05E1\u05DE\u05D5."] }) })
                : loading ? _jsx("div", { className: "card cust-skel", children: [0, 1, 2, 3].map((i) => _jsx(Skeleton, { h: 36 }, i)) })
                    : rows.length === 0 ? (_jsx("div", { className: "card", children: _jsx(EmptyState, { icon: _jsx(Users, { size: 24 }), title: q ? 'לא נמצא לקוח מתאים' : live.length === 0 ? 'עוד אין לקוחות' : 'אין לקוחות בתצוגה הזו', action: _jsx(Button, { variant: "primary", icon: _jsx(Plus, { size: 18 }), onClick: () => setAdding(true), children: q ? `לקוח חדש: "${q}"` : 'לקוח חדש' }), children: live.length === 0 ? 'מוסיפים את הלקוחות הקבועים כאן, או מייבאים מאקסל בשלב 10.' : undefined }) })) : (_jsx("div", { className: "otable-wrap", children: _jsxs("table", { className: "otable otable--dense cust-table", children: [_jsx("caption", { className: "sr-only", children: "\u05DC\u05E7\u05D5\u05D7\u05D5\u05EA" }), _jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u05E9\u05DD" }), _jsx("th", { children: "\u05E1\u05D5\u05D2" }), _jsx("th", { children: "\u05D7.\u05E4" }), _jsx("th", { children: "\u05D0\u05D9\u05E9 \u05E7\u05E9\u05E8" }), _jsx("th", { children: "\u05D8\u05DC\u05E4\u05D5\u05DF" }), _jsx("th", { children: "\u05D0\u05DE\u05E6\u05E2\u05D9 \u05EA\u05E9\u05DC\u05D5\u05DD" }), _jsx("th", { children: "\u05D8\u05DC\u05E4\u05D5\u05DF \u05D4\u05E7\u05E4\u05D4" }), _jsx("th", { children: "\u05DE\u05D7\u05D9\u05E8\u05D5\u05DF" }), _jsx("th", { children: _jsx("span", { className: "sr-only", children: "\u05EA\u05E2\u05D5\u05D3\u05EA \u05E8\u05DB\u05E9" }) })] }) }), _jsx("tbody", { children: rows.map((c) => _jsx(CustomerRow, { c: c, methodLabel: methodLabel, plName: plName, shared: (sharedPhones[c.accountPhone] ?? 0) > 1, onOpen: () => nav(`/customers/${c.id}`) }, c.id)) })] }) })), adding && _jsx(CustomerForm, { open: true, onClose: () => setAdding(false), customers: items, initialName: rows.length === 0 ? q : '' })] }));
}
function CustomerRow({ c, methodLabel, plName, shared, onOpen }) {
    const pc = primaryContact(c);
    return (_jsxs("tr", { className: `orow ${c.status === 'inactive' ? 'is-inactive-row' : ''}`, tabIndex: 0, onClick: onOpen, onKeyDown: (e) => {
            if (e.target !== e.currentTarget)
                return;
            if (e.key === 'Enter') {
                e.preventDefault();
                onOpen();
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                e.currentTarget.nextElementSibling?.focus();
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                e.currentTarget.previousElementSibling?.focus();
            }
        }, "aria-label": `${c.name}${c.status === 'inactive' ? ', לא פעיל' : ''}. Enter לפתיחת התיק`, children: [_jsxs("td", { className: "strong", children: [c.name, c.status === 'inactive' && _jsx("span", { className: "tag-inactive cust-inactive", children: "\u05DC\u05D0 \u05E4\u05E2\u05D9\u05DC" })] }), _jsx("td", { children: _jsx("span", { className: `ctype ctype--${c.type}`, children: c.type === 'regular' ? 'קבוע' : 'מזדמן' }) }), _jsx("td", { className: "num", children: c.taxId ? _jsx(Ltr, { children: c.taxId }) : _jsx("span", { className: "muted", children: "\u2014" }) }), _jsx("td", { children: pc?.name || _jsx("span", { className: "muted", children: "\u2014" }) }), _jsx("td", { className: "num", children: pc?.phone ? _jsx(Ltr, { children: fmtPhone(pc.phone) }) : _jsx("span", { className: "muted", children: "\u2014" }) }), _jsx("td", { children: methodLabel(c.paymentMethod) }), _jsx("td", { className: "num", children: c.accountPhone ? _jsxs(_Fragment, { children: [_jsx(Ltr, { children: fmtPhone(c.accountPhone) }), shared && _jsx("span", { className: "shared-tag", children: "\u05DB\u05DC\u05DC\u05D9" })] }) : _jsx("span", { className: "muted", children: "\u2014" }) }), _jsx("td", { children: plName(c.priceListId) || _jsx("span", { className: "muted", children: "\u2014" }) }), _jsx("td", { children: c.poRequired && _jsx(Tip, { label: "\u05E0\u05D3\u05E8\u05E9\u05EA \u05EA\u05E2\u05D5\u05D3\u05EA \u05E8\u05DB\u05E9", children: _jsx("span", { className: "po-tag", role: "img", tabIndex: 0, "aria-label": "\u05E0\u05D3\u05E8\u05E9\u05EA \u05EA\u05E2\u05D5\u05D3\u05EA \u05E8\u05DB\u05E9", children: _jsx(FileCheck2, { size: 15 }) }) }) })] }));
}
