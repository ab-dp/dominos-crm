import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/* חיפוש גלובלי כפלטת פקודות: מס' הזמנה, מס' Q, שם לקוח, טלפון, טלפון הקפה. חיצים + Enter. */
import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CornerDownLeft, FileText, Search, UserPlus } from 'lucide-react';
import { useStore } from '../data/store';
import { Ltr, fmtDate } from '../lib/format';
import { STATUS_LABEL } from '../data/types';
export function CommandSearch({ open, onOpenChange, onPick }) {
    const { orders, openNewOrder } = useStore();
    const [q, setQ] = useState('');
    const [active, setActive] = useState(0);
    const results = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s)
            return orders.filter((o) => o.health === 'critical' || o.health === 'urgent').slice(0, 6);
        const digits = s.replace(/\D/g, '');
        return orders.filter((o) => String(o.id).includes(s) ||
            o.customerName.toLowerCase().includes(s) ||
            (o.qNumber ?? '').toLowerCase().includes(s) ||
            (digits.length >= 3 && ((o.contactPhone ?? '').includes(digits) || (o.accountPhone ?? '').includes(digits)))).slice(0, 8);
    }, [q, orders]);
    const total = results.length + 1; // + "הזמנה ללקוח חדש"
    const pick = (i) => {
        if (i < results.length)
            onPick(results[i].id);
        else {
            onOpenChange(false);
            openNewOrder({ mode: 'newCustomer', customerName: /d{3}/.test(q) ? '' : q.trim() });
        }
    };
    return (_jsx(Dialog.Root, { open: open, onOpenChange: (o) => { onOpenChange(o); if (!o) {
            setQ('');
            setActive(0);
        } }, children: _jsxs(Dialog.Portal, { children: [_jsx(Dialog.Overlay, { className: "cmd-overlay" }), _jsxs(Dialog.Content, { className: "cmd", dir: "rtl", "aria-describedby": undefined, children: [_jsx(Dialog.Title, { className: "sr-only", children: "\u05D7\u05D9\u05E4\u05D5\u05E9" }), _jsxs("div", { className: "cmd__input", children: [_jsx(Search, { size: 20, "aria-hidden": "true" }), _jsx("input", { autoFocus: true, value: q, onChange: (e) => { setQ(e.target.value); setActive(0); }, placeholder: "\u05D4\u05E7\u05DC\u05D3 \u05DE\u05E1' \u05D4\u05D6\u05DE\u05E0\u05D4, \u05DE\u05E1' Q, \u05E9\u05DD \u05DC\u05E7\u05D5\u05D7 \u05D0\u05D5 \u05D8\u05DC\u05E4\u05D5\u05DF", "aria-label": "\u05D7\u05D9\u05E4\u05D5\u05E9", role: "combobox", "aria-expanded": "true", "aria-controls": "cmd-list", "aria-activedescendant": `cmd-${active}`, onKeyDown: (e) => {
                                        if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            setActive((a) => (a + 1) % total);
                                        }
                                        if (e.key === 'ArrowUp') {
                                            e.preventDefault();
                                            setActive((a) => (a - 1 + total) % total);
                                        }
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            pick(active);
                                        }
                                    } })] }), _jsx("p", { className: "cmd__group", children: q ? 'הזמנות' : 'דורש טיפול עכשיו' }), _jsxs("ul", { className: "cmd__list", id: "cmd-list", role: "listbox", children: [results.map((o, i) => (_jsxs("li", { id: `cmd-${i}`, role: "option", "aria-selected": active === i, className: `cmd__item ${active === i ? 'is-active' : ''}`, onMouseEnter: () => setActive(i), onClick: () => pick(i), children: [_jsx(FileText, { size: 18, "aria-hidden": "true" }), _jsxs("span", { className: "cmd__main", children: [_jsx("span", { children: o.customerName }), _jsxs("span", { className: "cmd__meta", children: ["\u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: o.id }), " \u00B7 ", _jsx(Ltr, { children: fmtDate(o.date) }), " ", _jsx(Ltr, { children: o.time }), " \u00B7 ", o.branchName, o.qNumber && _jsxs(_Fragment, { children: [" \u00B7 ", _jsx(Ltr, { children: o.qNumber })] })] })] }), _jsx("span", { className: "cmd__status", children: STATUS_LABEL[o.status] }), active === i && _jsx(CornerDownLeft, { size: 16, className: "cmd__enter", "aria-hidden": "true" })] }, o.id))), q && results.length === 0 && _jsx("li", { className: "cmd__none", children: "\u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0\u05D4 \u05D4\u05D6\u05DE\u05E0\u05D4 \u05DE\u05EA\u05D0\u05D9\u05DE\u05D4" }), _jsxs("li", { id: `cmd-${results.length}`, role: "option", "aria-selected": active === results.length, className: `cmd__item cmd__item--new ${active === results.length ? 'is-active' : ''}`, onMouseEnter: () => setActive(results.length), onClick: () => pick(results.length), children: [_jsx(UserPlus, { size: 18, "aria-hidden": "true" }), _jsx("span", { className: "cmd__main", children: _jsxs("span", { children: ["\u05D4\u05D6\u05DE\u05E0\u05D4 \u05DC\u05DC\u05E7\u05D5\u05D7 \u05D7\u05D3\u05E9", q && _jsxs(_Fragment, { children: [" \u00B7 \"", q, "\""] })] }) })] })] }), _jsxs("div", { className: "cmd__foot", children: [_jsx("kbd", { className: "kbd", children: "\u2191" }), _jsx("kbd", { className: "kbd", children: "\u2193" }), " \u05DE\u05E2\u05D1\u05E8 \u00B7 ", _jsx("kbd", { className: "kbd", children: "Enter" }), " \u05E4\u05EA\u05D9\u05D7\u05D4 \u00B7 ", _jsx("kbd", { className: "kbd", children: "Esc" }), " \u05E1\u05D2\u05D9\u05E8\u05D4"] })] })] }) }));
}
