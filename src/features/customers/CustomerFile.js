import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/* תיק לקוח במסך מלא (אפיון 6.6) – המקום לראות את כל התמונה על הלקוח. */
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, ClipboardList, FileCheck2, GitMerge, Mail, MapPin, MessageSquarePlus, MoreHorizontal, Pencil, Phone as PhoneIcon, Plus, Star, Trash2, UserCheck, UserRound, UserX, Wallet, } from 'lucide-react';
import { addActivity, newId, primaryContact, updateCustomer, useActivity, useCustomerHistory, useCustomers, } from '../../data/customers';
import { useBranches, useClusters } from '../../data/branches';
import { useLists } from '../../data/lists';
import { usePriceLists } from '../../data/priceLists';
import { useCustomerOrders } from '../../data/orders';
import { useStore } from '../../data/store';
import { CLOSED } from '../../data/types';
import { healthOf, issuesFor } from '../../rules-engine/health';
import { usePanel } from '../../app/PanelContext';
import { OrdersTable } from '../orders/OrdersTable';
import { CustomerDocsSection } from '../orders/OrderDocs';
import { BarChart } from '../reports/BarChart';
import '../reports/ReportsPage.css';
import { Button, EmptyState, Field, Skeleton } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, fmtDate, fmtMoney, fmtPhone, toISODate } from '../../lib/format';
import { cleanPhone, phoneError } from '../../lib/names';
import { CustomerForm } from './CustomerForm';
import { MergeDialog } from './MergeDialog';
import '../pages.css';
import './CustomerFile.css';
const TABS = [
    ['overview', 'סקירה'], ['orders', 'הזמנות'], ['monthly', 'סיכומים חודשיים'], ['prices', 'מחירון'], ['payment', 'תשלום והקפה'],
    ['contacts', 'אנשי קשר וכתובות'], ['docs', 'מסמכים'], ['activity', 'פעילות'], ['history', 'היסטוריה'],
];
export function CustomerFile() {
    const { id = '' } = useParams();
    const { items, loading } = useCustomers();
    const c = items.find((x) => x.id === id);
    if (loading)
        return _jsxs("div", { className: "page", children: [_jsx(Skeleton, { h: 28, w: "40%" }), _jsx("div", { style: { height: 16 } }), _jsx(Skeleton, { h: 160 })] });
    if (!c)
        return _jsx("div", { className: "page", children: _jsx("div", { className: "card", children: _jsx(EmptyState, { icon: _jsx(UserRound, { size: 24 }), title: "\u05D4\u05DC\u05E7\u05D5\u05D7 \u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0", action: _jsx(Link, { className: "btn btn--secondary btn--md", to: "/customers", children: _jsx("span", { className: "btn__label", children: "\u05D7\u05D6\u05E8\u05D4 \u05DC\u05DC\u05E7\u05D5\u05D7\u05D5\u05EA" }) }) }) }) });
    if (c.status === 'merged') {
        const target = items.find((x) => x.id === c.mergedInto);
        return _jsx("div", { className: "page", children: _jsx("div", { className: "card", children: _jsxs(EmptyState, { icon: _jsx(GitMerge, { size: 24 }), title: `"${c.name}" מוזג`, action: target && _jsx(Link, { className: "btn btn--primary btn--md", to: `/customers/${target.id}`, children: _jsxs("span", { className: "btn__label", children: ["\u05E4\u05EA\u05D7 \u05D0\u05EA ", target.name] }) }), children: ["\u05DB\u05DC \u05D4\u05E4\u05E8\u05D8\u05D9\u05DD \u05E2\u05D1\u05E8\u05D5 \u05DC\u05DC\u05E7\u05D5\u05D7 \"", target?.name ?? '—', "\"."] }) }) });
    }
    return _jsx(FileBody, { c: c, all: items });
}
function FileBody({ c, all }) {
    const nav = useNavigate();
    const toast = useToast();
    const reduce = useReducedMotion();
    const { lists } = useLists();
    const { items: priceLists } = usePriceLists();
    const [tab, setTab] = useState('overview');
    const [editing, setEditing] = useState(false);
    const [merging, setMerging] = useState(false);
    const noteRef = useRef(null);
    const pc = primaryContact(c);
    const method = lists?.paymentMethods.find((m) => m.id === c.paymentMethod)?.label ?? c.paymentMethod;
    const pl = priceLists.find((p) => p.id === c.priceListId);
    const sharing = c.accountPhone ? all.filter((x) => x.id !== c.id && x.status !== 'merged' && x.accountPhone === c.accountPhone) : [];
    const { now, openNewOrder, thresholds } = useStore();
    const { orders: raw, loading: ordersLoading } = useCustomerOrders(c.id);
    const corders = useMemo(() => raw.map((o) => { const issues = issuesFor(o, now, thresholds); return { ...o, issues, health: healthOf(issues) }; }), [raw, now, thresholds]);
    const openNote = () => { setTab('activity'); setTimeout(() => noteRef.current?.focus(), 50); };
    return (_jsxs("div", { className: "page cfile", children: [_jsxs("button", { className: "auth__back", onClick: () => nav('/customers'), children: [_jsx(ArrowRight, { size: 16, "aria-hidden": "true" }), " \u05DC\u05E7\u05D5\u05D7\u05D5\u05EA"] }), _jsxs("header", { className: "cfile__head card", children: [_jsxs("div", { className: "cfile__title-row", children: [_jsx("span", { className: "cfile__avatar", "aria-hidden": "true", children: c.name[0] }), _jsxs("div", { className: "cfile__ident", children: [_jsx("h1", { className: "page__title", children: c.name }), _jsxs("p", { className: "cfile__sub", children: [_jsx("span", { className: `ctype ctype--${c.type}`, children: c.type === 'regular' ? 'קבוע' : 'מזדמן' }), c.taxId && _jsxs("span", { children: ["\u05D7.\u05E4 ", _jsx(Ltr, { children: c.taxId })] }), c.status === 'inactive' && _jsx("span", { className: "tag-inactive", children: "\u05DC\u05D0 \u05E4\u05E2\u05D9\u05DC" }), c.businessAddress && _jsxs("span", { children: [_jsx(MapPin, { size: 13, "aria-hidden": "true" }), " ", c.businessAddress] })] })] }), _jsxs("div", { className: "cfile__actions", children: [_jsx(Button, { variant: "primary", icon: _jsx(Plus, { size: 18 }), onClick: () => openNewOrder({ mode: 'full', customerId: c.id }), disabled: c.status !== 'active', children: "\u05D4\u05D6\u05DE\u05E0\u05D4" }), _jsx(Button, { icon: _jsx(MessageSquarePlus, { size: 16 }), onClick: openNote, children: "\u05D4\u05E2\u05E8\u05D4" }), _jsx(Button, { icon: _jsx(Pencil, { size: 16 }), onClick: () => setEditing(true), children: "\u05E2\u05E8\u05D9\u05DB\u05D4" }), _jsxs(Dropdown.Root, { dir: "rtl", children: [_jsx(Dropdown.Trigger, { asChild: true, children: _jsx("button", { className: "icon-btn", "aria-label": "\u05E4\u05E2\u05D5\u05DC\u05D5\u05EA \u05E0\u05D5\u05E1\u05E4\u05D5\u05EA", children: _jsx(MoreHorizontal, { size: 20 }) }) }), _jsx(Dropdown.Portal, { children: _jsxs(Dropdown.Content, { className: "menu", align: "end", sideOffset: 4, children: [c.type === 'occasional' && (_jsxs(Dropdown.Item, { className: "menu__item", onSelect: async () => { await updateCustomer(c, { type: 'regular' }); toast({ message: `${c.name} הוא עכשיו לקוח קבוע – כדאי להשלים מחירון, כתובות והנחיות חיוב` }); }, children: [_jsx(Star, { size: 16, "aria-hidden": "true" }), " \u05D4\u05E4\u05D5\u05DA \u05DC\u05DC\u05E7\u05D5\u05D7 \u05E7\u05D1\u05D5\u05E2"] })), _jsxs(Dropdown.Item, { className: "menu__item", onSelect: () => setMerging(true), children: [_jsx(GitMerge, { size: 16, "aria-hidden": "true" }), " \u05DE\u05D9\u05D6\u05D5\u05D2 \u05E2\u05DD \u05DC\u05E7\u05D5\u05D7 \u05D0\u05D7\u05E8"] }), _jsx(Dropdown.Separator, { className: "menu__sep" }), c.status === 'active'
                                                            ? _jsxs(Dropdown.Item, { className: "menu__item", onSelect: async () => { await updateCustomer(c, { status: 'inactive' }); toast({ message: `${c.name} סומן כלא פעיל`, onUndo: () => updateCustomer({ ...c, status: 'inactive' }, { status: 'active' }) }); }, children: [_jsx(UserX, { size: 16, "aria-hidden": "true" }), " \u05E1\u05DE\u05DF \u05DB\u05DC\u05D0 \u05E4\u05E2\u05D9\u05DC"] })
                                                            : _jsxs(Dropdown.Item, { className: "menu__item", onSelect: async () => { await updateCustomer(c, { status: 'active' }); toast({ message: `${c.name} הופעל` }); }, children: [_jsx(UserCheck, { size: 16, "aria-hidden": "true" }), " \u05D4\u05E4\u05E2\u05DC \u05DE\u05D7\u05D3\u05E9"] })] }) })] })] })] }), _jsxs("div", { className: "cfile__facts", children: [pc && (_jsxs("span", { className: "fact", children: [_jsx(UserRound, { size: 15, "aria-hidden": "true" }), " ", pc.name, pc.role && _jsxs("span", { className: "muted", children: [" \u00B7 ", pc.role] }), pc.phone && _jsxs("a", { className: "fact__link", href: `tel:${pc.phone}`, children: [_jsx(PhoneIcon, { size: 14, "aria-hidden": "true" }), " ", _jsx(Ltr, { children: fmtPhone(pc.phone) })] }), pc.email && _jsxs("a", { className: "fact__link", href: `mailto:${pc.email}`, children: [_jsx(Mail, { size: 14, "aria-hidden": "true" }), " ", _jsx("bdi", { dir: "ltr", children: pc.email })] })] })), _jsxs("span", { className: "tag", children: [_jsx(Wallet, { size: 14, "aria-hidden": "true" }), " ", method] }), c.accountPhone && _jsxs("span", { className: "tag", children: ["\u05D8\u05DC\u05E4\u05D5\u05DF \u05D4\u05E7\u05E4\u05D4 ", _jsx(Ltr, { children: fmtPhone(c.accountPhone) }), " \u00B7 ", sharing.length ? 'כללי' : 'ייעודי'] }), pl && _jsxs("span", { className: "tag", children: ["\u05DE\u05D7\u05D9\u05E8\u05D5\u05DF: ", pl.name] }), c.poRequired && _jsxs("span", { className: "tag tag--brand", children: [_jsx(FileCheck2, { size: 14, "aria-hidden": "true" }), " \u05EA\u05E2\u05D5\u05D3\u05EA \u05E8\u05DB\u05E9 \u05E0\u05D3\u05E8\u05E9\u05EA"] })] }), c.instructions && (_jsxs("div", { className: "cfile__banner", role: "note", children: [_jsx("b", { children: "\u05D4\u05E0\u05D7\u05D9\u05D5\u05EA \u05E7\u05D1\u05D5\u05E2\u05D5\u05EA:" }), " ", c.instructions] }))] }), _jsx("nav", { className: "tabs cfile__tabs", role: "tablist", "aria-label": "\u05EA\u05D9\u05E7 \u05DC\u05E7\u05D5\u05D7", children: TABS.map(([k, label]) => (_jsxs("button", { role: "tab", "aria-selected": tab === k, className: `tab ${tab === k ? 'is-on' : ''}`, onClick: () => setTab(k), children: [label, k === 'contacts' && _jsx("span", { className: "tab__count", children: _jsx(Ltr, { children: c.contacts.length + c.addresses.length }) })] }, k))) }), _jsxs(motion.div, { role: "tabpanel", initial: reduce ? { opacity: 0 } : { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.16 }, children: [tab === 'overview' && _jsx(Overview, { c: c, onTab: setTab, orders: corders, loading: ordersLoading }), tab === 'orders' && _jsx(OrdersTab, { c: c, orders: corders, loading: ordersLoading }), tab === 'monthly' && _jsx(MonthlyTab, { orders: corders, loading: ordersLoading }), tab === 'prices' && _jsx(PricesTab, { c: c }), tab === 'payment' && _jsx(PaymentTab, { c: c, sharing: sharing, method: method, onEdit: () => setEditing(true) }), tab === 'contacts' && _jsx(ContactsTab, { c: c }), tab === 'docs' && _jsx(CustomerDocsSection, { customerId: c.id }), tab === 'activity' && _jsx(ActivityTab, { c: c, noteRef: noteRef }), tab === 'history' && _jsx(HistoryTab, { c: c })] }, tab), editing && _jsx(CustomerForm, { open: true, onClose: () => setEditing(false), customers: all, editing: c }), merging && _jsx(MergeDialog, { source: c, all: all, onClose: () => setMerging(false), onMerged: (t) => nav(`/customers/${t.id}`) })] }));
}
/* ---------- סקירה ---------- */
const PERIODS = [[1, 'החודש'], [3, '3 חודשים'], [12, '12 חודשים']];
const qSum = (list) => list.reduce((t, o) => t + (o.qAmount ?? o.amount), 0);
function Overview({ c, onTab, orders, loading }) {
    const { now } = useStore();
    const panel = usePanel();
    const [months, setMonths] = useState(1);
    const today = toISODate(now);
    const since = toISODate(new Date(now.getFullYear(), now.getMonth() - (months - 1), 1));
    const live = orders.filter((o) => o.status !== 'cancelled');
    const inPeriod = live.filter((o) => o.date >= since && o.date <= today);
    const total = qSum(inPeriod);
    const nowKey = `${today}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const key = (o) => `${o.date}T${o.time}`;
    const last = live.filter((o) => key(o) <= nowKey).sort((x, y) => key(y).localeCompare(key(x)))[0];
    const next = orders.filter((o) => !CLOSED.includes(o.status) && key(o) > nowKey).sort((x, y) => key(x).localeCompare(key(y)))[0];
    const days = last ? Math.round((new Date(today + 'T12:00').getTime() - new Date(last.date + 'T12:00').getTime()) / 86400000) : null;
    const unpaid = qSum(live.filter((o) => (o.payment === 'pending' || o.payment === 'failed') && o.date <= today));
    const kpis = [
        ['הזמנות בתקופה', _jsx(Ltr, { children: inPeriod.length }, "a")],
        ['סך (לפי סכום Q)', _jsx(Ltr, { children: fmtMoney(total) }, "b")],
        ['ממוצע הזמנה', inPeriod.length ? _jsx(Ltr, { children: fmtMoney(Math.round(total / inPeriod.length)) }, "c") : '—'],
        ['ימים מאז הזמנה אחרונה', days === null ? '—' : _jsx(Ltr, { children: days }, "d")],
        ['פתוח לתשלום', _jsx(Ltr, { children: fmtMoney(unpaid) }, "e")],
    ];
    const card = (title, o, empty) => (_jsxs("div", { className: "card ov__card", children: [_jsx("span", { className: "kpi__label", children: title }), o ? (_jsxs("button", { className: "ov__order", onClick: (e) => panel.open(o.id, e.currentTarget), children: [_jsxs("b", { children: ["\u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: o.id })] }), _jsxs("span", { children: [_jsx(Ltr, { children: fmtDate(o.date) }), " \u00B7 ", _jsx(Ltr, { children: o.time }), " \u00B7 ", o.branchName] }), _jsx("span", { children: _jsx(Ltr, { children: fmtMoney(o.qAmount ?? o.amount) }) })] })) : _jsx("span", { className: "muted", children: empty })] }));
    return (_jsxs("div", { className: "ov", children: [_jsx("div", { className: "ov__period seg", role: "group", "aria-label": "\u05EA\u05E7\u05D5\u05E4\u05D4", children: PERIODS.map(([m, label]) => _jsx("button", { className: months === m ? 'is-on' : '', "aria-pressed": months === m, onClick: () => setMonths(m), children: label }, m)) }), _jsx("div", { className: "ov__kpis", children: kpis.map(([k, v]) => (_jsxs("div", { className: "kpi card", children: [_jsx("span", { className: "kpi__label", children: k }), _jsx("span", { className: `kpi__value ${loading ? '' : 'is-live'}`, children: loading ? _jsx(Skeleton, { w: 60, h: 22 }) : v })] }, k))) }), _jsx("p", { className: "ov__note muted", children: "\u05DC\u05E4\u05D9 \u05EA\u05D0\u05E8\u05D9\u05DA \u05D0\u05E1\u05E4\u05E7\u05D4, \u05D1\u05DC\u05D9 \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05E9\u05D1\u05D5\u05D8\u05DC\u05D5." }), !loading && orders.length > 0 && (_jsxs("section", { className: "card ov__chart", "aria-label": "\u05E1\u05DA \u05DC\u05E4\u05D9 \u05D7\u05D5\u05D3\u05E9 \u2013 12 \u05D7\u05D5\u05D3\u05E9\u05D9\u05DD", children: [_jsxs("div", { className: "card__head", children: [_jsx("h2", { className: "card__title", children: "12 \u05D7\u05D5\u05D3\u05E9\u05D9\u05DD \u05D0\u05D7\u05E8\u05D5\u05E0\u05D9\u05DD" }), _jsx("button", { className: "link", onClick: () => onTab('monthly'), children: "\u05DC\u05E1\u05D9\u05DB\u05D5\u05DE\u05D9\u05DD \u05D4\u05D7\u05D5\u05D3\u05E9\u05D9\u05D9\u05DD" })] }), _jsx(BarChart, { kind: "time", money: true, data: lastMonths(orders, now).reverse().map((m) => ({ id: m.key, label: m.label, value: m.sum })), onPick: () => onTab('monthly') })] })), _jsxs("div", { className: "ov__cards", children: [card('הזמנה אחרונה', last, 'אין עדיין הזמנות'), card('הזמנה הבאה', next, 'אין הזמנה פתוחה'), _jsxs("div", { className: "card ov__card", children: [_jsx("span", { className: "kpi__label", children: "\u05E4\u05E8\u05D8\u05D9\u05DD \u05D7\u05E1\u05E8\u05D9\u05DD" }), missingOf(c).length === 0 ? _jsxs("span", { className: "ok-text", children: [_jsx(Check, { size: 14, "aria-hidden": "true" }), " \u05D4\u05EA\u05D9\u05E7 \u05DE\u05DC\u05D0"] }) : (_jsx("ul", { className: "ov__missing", children: missingOf(c).map(([label, t]) => _jsx("li", { children: _jsx("button", { className: "link", onClick: () => onTab(t), children: label }) }, label)) }))] })] })] }));
}
function lastMonths(orders, now) {
    return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const all = orders.filter((o) => o.date.startsWith(key));
        const lv = all.filter((o) => o.status !== 'cancelled');
        const sum = lv.reduce((t, o) => t + (o.qAmount ?? o.amount), 0);
        return {
            key, label: `${key.slice(5)}.${key.slice(0, 4)}`, count: lv.length, sum, avg: lv.length ? Math.round(sum / lv.length) : 0,
            cancelled: all.length - lv.length, gaps: lv.filter((o) => o.qAmount !== undefined && o.qAmount !== o.amount).length,
            unpaid: lv.filter((o) => o.payment === 'pending' || o.payment === 'failed').reduce((t, o) => t + (o.qAmount ?? o.amount), 0), orders: all,
        };
    });
}
function MonthlyTab({ orders, loading }) {
    const { now } = useStore();
    const panel = usePanel();
    const [open, setOpen] = useState(null);
    if (loading)
        return _jsxs("div", { className: "card cfile__loading", children: [_jsx(Skeleton, { h: 18 }), _jsx(Skeleton, { h: 18 })] });
    const rows = lastMonths(orders, now);
    const total = rows.reduce((t, r) => ({ count: t.count + r.count, sum: t.sum + r.sum, cancelled: t.cancelled + r.cancelled, gaps: t.gaps + r.gaps, unpaid: t.unpaid + r.unpaid }), { count: 0, sum: 0, cancelled: 0, gaps: 0, unpaid: 0 });
    const picked = rows.find((r) => r.key === open);
    return (_jsxs("div", { className: "card monthly", children: [_jsxs("div", { className: "card__head", children: [_jsx("h2", { className: "card__title", children: "\u05E1\u05D9\u05DB\u05D5\u05DE\u05D9\u05DD \u05D7\u05D5\u05D3\u05E9\u05D9\u05D9\u05DD" }), _jsx("span", { className: "muted monthly__hint", children: "12 \u05D7\u05D5\u05D3\u05E9\u05D9\u05DD \u00B7 \u05DC\u05E4\u05D9 \u05EA\u05D0\u05E8\u05D9\u05DA \u05D0\u05E1\u05E4\u05E7\u05D4 \u05D5\u05E1\u05DB\u05D5\u05DD Q \u00B7 \u05DC\u05D7\u05D9\u05E6\u05D4 \u05E2\u05DC \u05D7\u05D5\u05D3\u05E9 \u05DE\u05E6\u05D9\u05D2\u05D4 \u05D0\u05EA \u05D4\u05D4\u05D6\u05DE\u05E0\u05D5\u05EA" })] }), _jsx("div", { className: "report__scroll", children: _jsxs("table", { className: "rtable", children: [_jsx("caption", { className: "sr-only", children: "\u05E1\u05D9\u05DB\u05D5\u05DD \u05D7\u05D5\u05D3\u05E9\u05D9 \u05DC-12 \u05D4\u05D7\u05D5\u05D3\u05E9\u05D9\u05DD \u05D4\u05D0\u05D7\u05E8\u05D5\u05E0\u05D9\u05DD" }), _jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u05D7\u05D5\u05D3\u05E9" }), _jsx("th", { className: "num", children: "\u05D4\u05D6\u05DE\u05E0\u05D5\u05EA" }), _jsx("th", { className: "num", children: "\u05E1\u05DA" }), _jsx("th", { className: "num", children: "\u05DE\u05DE\u05D5\u05E6\u05E2" }), _jsx("th", { className: "num", children: "\u05D1\u05D9\u05D8\u05D5\u05DC\u05D9\u05DD" }), _jsx("th", { className: "num", children: "\u05E4\u05E2\u05E8\u05D9 Q" }), _jsx("th", { className: "num", children: "\u05E4\u05EA\u05D5\u05D7 \u05DC\u05EA\u05E9\u05DC\u05D5\u05DD" }), _jsx("th", { children: "\u05DE\u05E6\u05D1 \u05D7\u05D5\u05D3\u05E9" })] }) }), _jsx("tbody", { children: rows.map((r) => (_jsxs("tr", { className: open === r.key ? 'is-picked' : '', tabIndex: 0, onClick: () => setOpen(open === r.key ? null : r.key), onKeyDown: (e) => { if (e.key === 'Enter')
                                    setOpen(open === r.key ? null : r.key); }, children: [_jsx("td", { children: _jsx(Ltr, { children: r.label }) }), _jsx("td", { className: "num", children: _jsx(Ltr, { children: r.count }) }), _jsx("td", { className: "num", children: _jsx(Ltr, { children: fmtMoney(r.sum) }) }), _jsx("td", { className: "num", children: _jsx(Ltr, { children: r.count ? fmtMoney(r.avg) : '—' }) }), _jsx("td", { className: "num", children: _jsx(Ltr, { children: r.cancelled }) }), _jsx("td", { className: `num ${r.gaps ? 'monthly__warn' : ''}`, children: _jsx(Ltr, { children: r.gaps }) }), _jsx("td", { className: `num ${r.unpaid ? 'monthly__warn' : ''}`, children: _jsx(Ltr, { children: fmtMoney(r.unpaid) }) }), _jsx("td", { children: _jsx("span", { className: "muted", title: "\u05E1\u05D2\u05D9\u05E8\u05EA \u05D7\u05D5\u05D3\u05E9 \u2013 \u05E9\u05DC\u05D1 9", children: "\u05E4\u05EA\u05D5\u05D7" }) })] }, r.key))) }), _jsx("tfoot", { children: _jsxs("tr", { children: [_jsx("td", { children: "\u05E1\u05D4\"\u05DB" }), _jsx("td", { className: "num", children: _jsx(Ltr, { children: total.count }) }), _jsx("td", { className: "num", children: _jsx(Ltr, { children: fmtMoney(total.sum) }) }), _jsx("td", { className: "num", children: _jsx(Ltr, { children: total.count ? fmtMoney(Math.round(total.sum / total.count)) : '—' }) }), _jsx("td", { className: "num", children: _jsx(Ltr, { children: total.cancelled }) }), _jsx("td", { className: "num", children: _jsx(Ltr, { children: total.gaps }) }), _jsx("td", { className: "num", children: _jsx(Ltr, { children: fmtMoney(total.unpaid) }) }), _jsx("td", {})] }) })] }) }), picked && (_jsxs("ul", { className: "report__orders monthly__orders", "aria-label": `ההזמנות של ${picked.label}`, children: [picked.orders.length === 0 && _jsx("li", { className: "muted monthly__none", children: "\u05D0\u05D9\u05DF \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05D1\u05D7\u05D5\u05D3\u05E9 \u05D4\u05D6\u05D4" }), [...picked.orders].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map((o) => (_jsx("li", { children: _jsxs("button", { onClick: (e) => panel.open(o.id, e.currentTarget), children: [_jsx("span", { className: "report__oid", children: _jsx(Ltr, { children: o.id }) }), _jsxs("span", { className: "report__odate", children: [_jsx(Ltr, { children: fmtDate(o.date) }), " ", _jsx(Ltr, { children: o.time })] }), _jsx("span", { className: "report__ocust", children: o.branchName }), _jsxs("span", { className: "report__osum", children: [_jsx(Ltr, { children: fmtMoney(o.qAmount ?? o.amount) }), o.status === 'cancelled' && _jsx("span", { className: "muted", children: " \u00B7 \u05D1\u05D5\u05D8\u05DC\u05D4" })] })] }) }, o.id)))] }))] }));
}
function OrdersTab({ c, orders, loading }) {
    const { now, openNewOrder } = useStore();
    const [view, setView] = useState('open');
    const today = toISODate(now);
    const byTime = (a, b) => (a.date + a.time).localeCompare(b.date + b.time);
    const lists = {
        open: orders.filter((o) => !CLOSED.includes(o.status)).sort(byTime),
        past: orders.filter((o) => o.status === 'delivered' || o.status === 'partial').sort((a, b) => byTime(b, a)),
        cancelled: orders.filter((o) => o.status === 'cancelled').sort((a, b) => byTime(b, a)),
    };
    const V = [['open', 'פתוחות'], ['past', 'סופקו'], ['cancelled', 'בוטלו']];
    if (loading)
        return _jsxs("div", { className: "card cfile__loading", children: [_jsx(Skeleton, { h: 18 }), _jsx(Skeleton, { h: 18 })] });
    if (!orders.length) {
        return (_jsx("div", { className: "card", children: _jsxs(EmptyState, { icon: _jsx(ClipboardList, { size: 24 }), title: "\u05D0\u05D9\u05DF \u05E2\u05D3\u05D9\u05D9\u05DF \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05DC\u05DC\u05E7\u05D5\u05D7", action: c.status === 'active' && _jsx(Button, { variant: "primary", icon: _jsx(Plus, { size: 18 }), onClick: () => openNewOrder({ mode: 'full', customerId: c.id }), children: "\u05D4\u05D6\u05DE\u05E0\u05D4 \u05E8\u05D0\u05E9\u05D5\u05E0\u05D4" }), children: ["\u05D4\u05E4\u05E8\u05D8\u05D9\u05DD \u05D4\u05E7\u05D1\u05D5\u05E2\u05D9\u05DD \u05E9\u05DC ", c.name, " \u05D9\u05DE\u05D5\u05DC\u05D0\u05D5 \u05D1\u05D4\u05D6\u05DE\u05E0\u05D4 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA."] }) }));
    }
    return (_jsxs("div", { className: "cfile__orders", children: [_jsx("div", { className: "seg", role: "group", "aria-label": "\u05E1\u05D9\u05E0\u05D5\u05DF \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05D4\u05DC\u05E7\u05D5\u05D7", children: V.map(([k, label]) => _jsxs("button", { className: view === k ? 'is-on' : '', "aria-pressed": view === k, onClick: () => setView(k), children: [label, " ", _jsx(Ltr, { children: lists[k].length })] }, k)) }), _jsx(OrdersTable, { rows: lists[view], showDate: true, caption: `הזמנות ${c.name}`, emptyText: view === 'open' ? 'אין הזמנות פתוחות' : view === 'past' ? 'אין הזמנות שסופקו' : 'אין הזמנות שבוטלו' }), view === 'open' && lists.open.some((o) => o.date < today) && _jsx("p", { className: "muted ov__note", children: "\u05D9\u05E9 \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05E9\u05DE\u05D5\u05E2\u05D3\u05DF \u05E2\u05D1\u05E8 \u05D5\u05E2\u05D3\u05D9\u05D9\u05DF \u05E4\u05EA\u05D5\u05D7\u05D5\u05EA \u2013 \u05DB\u05D3\u05D0\u05D9 \u05DC\u05E1\u05D2\u05D5\u05E8 \u05D0\u05D5\u05EA\u05DF." })] }));
}
function missingOf(c) {
    const m = [];
    if (!c.contacts.length)
        m.push(['איש קשר', 'contacts']);
    if (!c.addresses.length)
        m.push(['כתובת אספקה קבועה', 'contacts']);
    if (c.type === 'regular' && !c.priceListId)
        m.push(['מחירון', 'prices']);
    if (c.paymentMethod === 'account' && !c.billingInstructions)
        m.push(['הנחיות חיוב', 'payment']);
    return m;
}
/* ---------- מחירון + מחירים ייחודיים ללקוח ---------- */
function PricesTab({ c }) {
    const { items: priceLists } = usePriceLists();
    const toast = useToast();
    const pl = priceLists.find((p) => p.id === c.priceListId);
    const [editing, setEditing] = useState(null);
    const [draft, setDraft] = useState('');
    if (!pl) {
        return (_jsx("div", { className: "card", children: _jsx(EmptyState, { icon: _jsx(Wallet, { size: 24 }), title: "\u05D0\u05D9\u05DF \u05DE\u05D7\u05D9\u05E8\u05D5\u05DF \u05DE\u05E9\u05D5\u05D9\u05DA", action: _jsxs("select", { className: "input cfile__plsel", value: "", onChange: async (e) => { await updateCustomer(c, { priceListId: e.target.value }); toast({ message: 'המחירון שויך ללקוח' }); }, "aria-label": "\u05E9\u05D9\u05D9\u05DA \u05DE\u05D7\u05D9\u05E8\u05D5\u05DF", children: [_jsx("option", { value: "", children: "\u05D1\u05D7\u05E8 \u05DE\u05D7\u05D9\u05E8\u05D5\u05DF\u2026" }), priceLists.filter((p) => p.active).map((p) => _jsx("option", { value: p.id, children: p.name }, p.id))] }), children: "\u05DE\u05D7\u05D9\u05E8\u05D5\u05E0\u05D9\u05DD \u05E0\u05D1\u05E0\u05D9\u05DD \u05D1\u05DE\u05E1\u05DA \"\u05DE\u05D7\u05D9\u05E8\u05D5\u05E0\u05D9\u05DD\"." }) }));
    }
    const custom = (itemId) => c.customPrices.find((x) => x.itemId === itemId);
    const save = async (itemId) => {
        const v = Number(draft.replace(/[^\d.]/g, ''));
        setEditing(null);
        const rest = c.customPrices.filter((x) => x.itemId !== itemId);
        const item = pl.items.find((i) => i.id === itemId);
        const next = !draft.trim() || v === item?.price ? rest : [...rest, { itemId, price: v }];
        await updateCustomer(c, { customPrices: next });
        toast({ message: !draft.trim() || v === item?.price ? 'המחיר חזר למחיר המחירון' : `מחיר ייחודי ל${c.name}: ${fmtMoney(v)}` });
    };
    return (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "card__head", children: [_jsx("h2", { className: "card__title", children: pl.name }), _jsxs("span", { className: "muted", children: [pl.kind === 'shared' ? 'מחירון משותף' : 'מחירון ייחודי', " \u00B7 \u05DB\u05DC \u05D4\u05DE\u05D7\u05D9\u05E8\u05D9\u05DD \u05DB\u05D5\u05DC\u05DC\u05D9\u05DD \u05DE\u05E2\"\u05DE"] }), _jsx(Link, { className: "link card__head-end", to: `/pricelists?id=${pl.id}`, children: "\u05E4\u05EA\u05D7 \u05DE\u05D7\u05D9\u05E8\u05D5\u05DF" })] }), _jsx("p", { className: "muted cfile__plhint", children: "\u05DE\u05D7\u05D9\u05E8 \u05D9\u05D9\u05D7\u05D5\u05D3\u05D9 \u05DC\u05DC\u05E7\u05D5\u05D7 \u05DC\u05D0 \u05DE\u05E9\u05E0\u05D4 \u05D0\u05EA \u05D4\u05DE\u05D7\u05D9\u05E8\u05D5\u05DF \u05D4\u05DE\u05E9\u05D5\u05EA\u05E3. Enter \u05E9\u05D5\u05DE\u05E8, \u05E9\u05D3\u05D4 \u05E8\u05D9\u05E7 \u05DE\u05D7\u05D6\u05D9\u05E8 \u05DC\u05DE\u05D7\u05D9\u05E8 \u05D4\u05DE\u05D7\u05D9\u05E8\u05D5\u05DF." }), _jsxs("table", { className: "items cfile__prices", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u05E4\u05E8\u05D9\u05D8" }), _jsx("th", { children: "\u05DE\u05D7\u05D9\u05E8 \u05DE\u05D7\u05D9\u05E8\u05D5\u05DF" }), _jsx("th", { children: "\u05DE\u05D7\u05D9\u05E8 \u05DC\u05DC\u05E7\u05D5\u05D7" })] }) }), _jsx("tbody", { children: pl.items.filter((i) => i.active).map((it) => {
                            const cp = custom(it.id);
                            return (_jsxs("tr", { children: [_jsx("td", { children: it.name }), _jsx("td", { children: _jsx(Ltr, { children: fmtMoney(it.price) }) }), _jsx("td", { children: editing === it.id ? (_jsx("input", { className: "input input--sm input--ltr cfile__priceinput", autoFocus: true, inputMode: "decimal", value: draft, "aria-label": `מחיר ללקוח: ${it.name}`, onChange: (e) => setDraft(e.target.value), onBlur: () => save(it.id), onKeyDown: (e) => { if (e.key === 'Enter') {
                                                e.preventDefault();
                                                save(it.id);
                                            } if (e.key === 'Escape') {
                                                e.preventDefault();
                                                setEditing(null);
                                            } } })) : (_jsxs("button", { className: `pricecell ${cp ? 'is-custom' : ''}`, onClick: () => { setEditing(it.id); setDraft(cp ? String(cp.price) : ''); }, "aria-label": `${it.name}: ${cp ? `מחיר ייחודי ${fmtMoney(cp.price)}` : 'מחיר מחירון'}. לחץ לשינוי`, children: [cp ? _jsxs(_Fragment, { children: [_jsx(Ltr, { children: fmtMoney(cp.price) }), _jsx("span", { className: "pricecell__tag", children: "\u05D9\u05D9\u05D7\u05D5\u05D3\u05D9" })] }) : _jsx("span", { className: "muted", children: "\u05DB\u05DE\u05D5 \u05D4\u05DE\u05D7\u05D9\u05E8\u05D5\u05DF" }), _jsx(Pencil, { size: 13, "aria-hidden": "true" })] })) })] }, it.id));
                        }) })] })] }));
}
/* ---------- תשלום והקפה ---------- */
function PaymentTab({ c, sharing, method, onEdit }) {
    return (_jsxs("div", { className: "card cfile__kv", children: [_jsxs("div", { className: "card__head", children: [_jsx("h2", { className: "card__title", children: "\u05EA\u05E9\u05DC\u05D5\u05DD \u05D5\u05D4\u05E7\u05E4\u05D4" }), _jsx(Button, { size: "sm", className: "card__head-end", icon: _jsx(Pencil, { size: 15 }), onClick: onEdit, children: "\u05E2\u05E8\u05D9\u05DB\u05D4" })] }), _jsxs("div", { className: "card__body", children: [_jsxs("div", { className: "kv", children: [_jsx("span", { className: "kv__k", children: "\u05D0\u05DE\u05E6\u05E2\u05D9 \u05EA\u05E9\u05DC\u05D5\u05DD" }), _jsx("span", { className: "kv__v", children: method })] }), _jsxs("div", { className: "kv", children: [_jsx("span", { className: "kv__k", children: "\u05D8\u05DC\u05E4\u05D5\u05DF \u05D4\u05E7\u05E4\u05D4" }), _jsx("span", { className: "kv__v", children: c.accountPhone ? _jsxs(_Fragment, { children: [_jsx(Ltr, { children: fmtPhone(c.accountPhone) }), " \u00B7 ", sharing.length ? _jsxs(_Fragment, { children: ["\u05DB\u05DC\u05DC\u05D9 \u2013 \u05DE\u05E9\u05DE\u05E9 \u05D2\u05DD \u05D0\u05EA ", sharing.map((s, i) => _jsxs("span", { children: [i > 0 && ', ', _jsx(Link, { to: `/customers/${s.id}`, children: s.name })] }, s.id))] }) : 'ייעודי ללקוח הזה'] }) : '—' })] }), _jsxs("div", { className: "kv", children: [_jsx("span", { className: "kv__k", children: "\u05EA\u05E2\u05D5\u05D3\u05EA \u05E8\u05DB\u05E9" }), _jsx("span", { className: "kv__v", children: c.poRequired ? 'נדרשת לכל הזמנה' : 'לא נדרשת' })] }), _jsxs("div", { className: "kv", children: [_jsx("span", { className: "kv__k", children: "\u05D4\u05E0\u05D7\u05D9\u05D5\u05EA \u05D7\u05D9\u05D5\u05D1 \u05E7\u05D1\u05D5\u05E2\u05D5\u05EA" }), _jsx("span", { className: "kv__v", children: c.billingInstructions || _jsx("span", { className: "warn-text", children: "\u05DC\u05D0 \u05D4\u05D5\u05D2\u05D3\u05E8\u05D5" }) })] }), _jsx("p", { className: "muted cfile__plhint", children: "\u05D4\u05D4\u05E0\u05D7\u05D9\u05D5\u05EA \u05E0\u05D8\u05E2\u05E0\u05D5\u05EA \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA \u05DC\"\u05D4\u05E2\u05E8\u05D5\u05EA \u05DC\u05D7\u05D9\u05D5\u05D1\" \u05D1\u05D3\u05D5\u05D7 \u05D4\u05D4\u05E7\u05E4\u05D5\u05EA \u05D1\u05E1\u05D5\u05E3 \u05D4\u05D7\u05D5\u05D3\u05E9." })] })] }));
}
/* ---------- אנשי קשר וכתובות ---------- */
function ContactsTab({ c }) {
    const toast = useToast();
    const { items: branches } = useBranches();
    const { items: clusters } = useClusters();
    const [contactEdit, setContactEdit] = useState(null);
    const [addrEdit, setAddrEdit] = useState(null);
    const saveContacts = async (next, msg) => { await updateCustomer(c, { contacts: next }); toast({ message: msg }); };
    const saveAddresses = async (next, msg) => { await updateCustomer(c, { addresses: next }); toast({ message: msg }); };
    const branchLabel = (id) => { const b = branches.find((x) => x.id === id); return b ? `${b.name} · ${clusters.find((x) => x.id === b.clusterId)?.name ?? ''}` : ''; };
    return (_jsxs("div", { className: "cgrid", children: [_jsxs("section", { className: "card", children: [_jsxs("div", { className: "card__head", children: [_jsx("h2", { className: "card__title", children: "\u05D0\u05E0\u05E9\u05D9 \u05E7\u05E9\u05E8" }), _jsx(Button, { size: "sm", className: "card__head-end", icon: _jsx(Plus, { size: 15 }), onClick: () => setContactEdit({ id: newId(), name: '', role: '', phone: '', email: '', primary: c.contacts.length === 0 }), children: "\u05D0\u05D9\u05E9 \u05E7\u05E9\u05E8" })] }), _jsxs("ul", { className: "plist", children: [c.contacts.length === 0 && _jsx("li", { className: "muted plist__empty", children: "\u05D0\u05D9\u05DF \u05E2\u05D3\u05D9\u05D9\u05DF \u05D0\u05E0\u05E9\u05D9 \u05E7\u05E9\u05E8" }), c.contacts.map((x) => (_jsxs("li", { className: "pitem", children: [_jsxs("div", { className: "pitem__main", children: [_jsx("b", { children: x.name }), x.primary && _jsx("span", { className: "tag tag--brand pitem__primary", children: "\u05E8\u05D0\u05E9\u05D9" }), x.role && _jsxs("span", { className: "muted", children: [" \u00B7 ", x.role] }), _jsxs("span", { className: "pitem__meta", children: [x.phone && _jsx("a", { href: `tel:${x.phone}`, children: _jsx(Ltr, { children: fmtPhone(x.phone) }) }), x.email && _jsx("a", { href: `mailto:${x.email}`, children: _jsx("bdi", { dir: "ltr", children: x.email }) })] })] }), !x.primary && _jsx(Button, { size: "sm", variant: "ghost", onClick: () => saveContacts(c.contacts.map((y) => ({ ...y, primary: y.id === x.id })), `${x.name} הוא עכשיו איש הקשר הראשי`), children: "\u05D4\u05E4\u05D5\u05DA \u05DC\u05E8\u05D0\u05E9\u05D9" }), _jsx("button", { className: "icon-btn icon-btn--sm", "aria-label": `ערוך את ${x.name}`, onClick: () => setContactEdit(x), children: _jsx(Pencil, { size: 15 }) }), _jsx("button", { className: "icon-btn icon-btn--sm", "aria-label": `הסר את ${x.name}`, onClick: () => saveContacts(c.contacts.filter((y) => y.id !== x.id).map((y, i, arr) => ({ ...y, primary: x.primary ? i === 0 : y.primary || arr.length === 1 })), `${x.name} הוסר`), children: _jsx(Trash2, { size: 15 }) })] }, x.id)))] }), contactEdit && _jsx(ContactEditor, { value: contactEdit, onCancel: () => setContactEdit(null), onSave: async (v) => {
                            const exists = c.contacts.some((y) => y.id === v.id);
                            await saveContacts(exists ? c.contacts.map((y) => (y.id === v.id ? v : y)) : [...c.contacts, v], exists ? 'איש הקשר עודכן' : 'איש קשר נוסף');
                            setContactEdit(null);
                        } })] }), _jsxs("section", { className: "card", children: [_jsxs("div", { className: "card__head", children: [_jsx("h2", { className: "card__title", children: "\u05DB\u05EA\u05D5\u05D1\u05D5\u05EA \u05D0\u05E1\u05E4\u05E7\u05D4 \u05E7\u05D1\u05D5\u05E2\u05D5\u05EA" }), _jsx(Button, { size: "sm", className: "card__head-end", icon: _jsx(Plus, { size: 15 }), onClick: () => setAddrEdit({ id: newId(), label: '', address: '', directions: '', preferredBranchId: '' }), children: "\u05DB\u05EA\u05D5\u05D1\u05EA" })] }), _jsxs("ul", { className: "plist", children: [c.addresses.length === 0 && _jsx("li", { className: "muted plist__empty", children: "\u05D0\u05D9\u05DF \u05E2\u05D3\u05D9\u05D9\u05DF \u05DB\u05EA\u05D5\u05D1\u05D5\u05EA \u05E7\u05D1\u05D5\u05E2\u05D5\u05EA" }), c.addresses.map((a) => (_jsxs("li", { className: "pitem", children: [_jsxs("div", { className: "pitem__main", children: [_jsx("b", { children: a.label || 'כתובת' }), " ", _jsxs("span", { children: ["\u00B7 ", a.address] }), _jsxs("span", { className: "pitem__meta", children: [a.directions && _jsx("span", { children: a.directions }), a.preferredBranchId && _jsxs("span", { className: "muted", children: [_jsx(Star, { size: 12, "aria-hidden": "true" }), " \u05E1\u05E0\u05D9\u05E3 \u05DE\u05D5\u05E2\u05D3\u05E3: ", branchLabel(a.preferredBranchId)] })] })] }), _jsx("button", { className: "icon-btn icon-btn--sm", "aria-label": `ערוך כתובת ${a.label}`, onClick: () => setAddrEdit(a), children: _jsx(Pencil, { size: 15 }) }), _jsx("button", { className: "icon-btn icon-btn--sm", "aria-label": `הסר כתובת ${a.label}`, onClick: () => saveAddresses(c.addresses.filter((y) => y.id !== a.id), 'הכתובת הוסרה'), children: _jsx(Trash2, { size: 15 }) })] }, a.id)))] }), addrEdit && _jsx(AddressEditor, { value: addrEdit, branches: branches.filter((b) => b.active || b.id === addrEdit.preferredBranchId), branchLabel: branchLabel, onCancel: () => setAddrEdit(null), onSave: async (v) => {
                            const exists = c.addresses.some((y) => y.id === v.id);
                            await saveAddresses(exists ? c.addresses.map((y) => (y.id === v.id ? v : y)) : [...c.addresses, v], exists ? 'הכתובת עודכנה' : 'כתובת נוספה');
                            setAddrEdit(null);
                        } })] })] }));
}
function ContactEditor({ value, onSave, onCancel }) {
    const [v, setV] = useState({ ...value, phone: value.phone ? fmtPhone(value.phone) : '' });
    const [err, setErr] = useState('');
    const submit = async () => {
        if (!v.name.trim())
            return setErr('חובה: שם');
        const pe = phoneError(v.phone);
        if (pe)
            return setErr(pe);
        if (v.email && !/^\S+@\S+\.\S+$/.test(v.email))
            return setErr('כתובת מייל לא תקינה');
        await onSave({ ...v, name: v.name.trim(), phone: cleanPhone(v.phone), email: v.email.trim(), role: v.role.trim() });
    };
    return (_jsxs("form", { className: "pedit", onSubmit: (e) => { e.preventDefault(); submit(); }, onKeyDown: (e) => e.key === 'Escape' && onCancel(), children: [_jsxs("div", { className: "pedit__grid", children: [_jsx(Field, { label: "\u05E9\u05DD (\u05D7\u05D5\u05D1\u05D4)", children: _jsx("input", { className: "input input--sm", autoFocus: true, value: v.name, onChange: (e) => { setV({ ...v, name: e.target.value }); setErr(''); } }) }), _jsx(Field, { label: "\u05EA\u05E4\u05E7\u05D9\u05D3", children: _jsx("input", { className: "input input--sm", value: v.role, onChange: (e) => setV({ ...v, role: e.target.value }) }) }), _jsx(Field, { label: "\u05D8\u05DC\u05E4\u05D5\u05DF", children: _jsx("input", { className: "input input--sm input--ltr", inputMode: "tel", value: v.phone, onChange: (e) => { setV({ ...v, phone: e.target.value }); setErr(''); } }) }), _jsx(Field, { label: "\u05DE\u05D9\u05D9\u05DC", children: _jsx("input", { className: "input input--sm input--ltr", value: v.email, onChange: (e) => { setV({ ...v, email: e.target.value }); setErr(''); } }) })] }), err && _jsx("p", { className: "pop__err", role: "alert", children: err }), _jsxs("div", { className: "pedit__actions", children: [_jsx(Button, { size: "sm", variant: "primary", type: "submit", icon: _jsx(Check, { size: 15 }), children: "\u05E9\u05DE\u05D5\u05E8" }), _jsx(Button, { size: "sm", variant: "ghost", type: "button", onClick: onCancel, children: "\u05D1\u05D9\u05D8\u05D5\u05DC" })] })] }));
}
function AddressEditor({ value, branches, branchLabel, onSave, onCancel }) {
    const [v, setV] = useState(value);
    const [err, setErr] = useState('');
    return (_jsxs("form", { className: "pedit", onSubmit: async (e) => { e.preventDefault(); if (!v.address.trim())
            return setErr('חובה: כתובת מלאה'); await onSave({ ...v, label: v.label.trim(), address: v.address.trim(), directions: v.directions.trim() }); }, onKeyDown: (e) => e.key === 'Escape' && onCancel(), children: [_jsxs("div", { className: "pedit__grid", children: [_jsx(Field, { label: "\u05DB\u05D9\u05E0\u05D5\u05D9", children: _jsx("input", { className: "input input--sm", autoFocus: true, value: v.label, onChange: (e) => setV({ ...v, label: e.target.value }), placeholder: "\u05DE\u05E9\u05E8\u05D3 \u05E8\u05D0\u05E9\u05D9" }) }), _jsx(Field, { label: "\u05DB\u05EA\u05D5\u05D1\u05EA \u05DE\u05DC\u05D0\u05D4 (\u05D7\u05D5\u05D1\u05D4)", children: _jsx("input", { className: "input input--sm", value: v.address, onChange: (e) => { setV({ ...v, address: e.target.value }); setErr(''); } }) }), _jsx(Field, { label: "\u05D4\u05D5\u05E8\u05D0\u05D5\u05EA \u05D4\u05D2\u05E2\u05D4", children: _jsx("input", { className: "input input--sm", value: v.directions, onChange: (e) => setV({ ...v, directions: e.target.value }), placeholder: "\u05E7\u05D5\u05DE\u05D4 3, \u05DC\u05D4\u05EA\u05E7\u05E9\u05E8 \u05DE\u05D4\u05DC\u05D5\u05D1\u05D9" }) }), _jsx(Field, { label: "\u05E1\u05E0\u05D9\u05E3 \u05DE\u05D5\u05E2\u05D3\u05E3", children: _jsxs("select", { className: "input input--sm", value: v.preferredBranchId, onChange: (e) => setV({ ...v, preferredBranchId: e.target.value }), children: [_jsx("option", { value: "", children: "\u05DC\u05DC\u05D0" }), branches.map((b) => _jsx("option", { value: b.id, children: branchLabel(b.id) }, b.id))] }) })] }), err && _jsx("p", { className: "pop__err", role: "alert", children: err }), _jsxs("div", { className: "pedit__actions", children: [_jsx(Button, { size: "sm", variant: "primary", type: "submit", icon: _jsx(Check, { size: 15 }), children: "\u05E9\u05DE\u05D5\u05E8" }), _jsx(Button, { size: "sm", variant: "ghost", type: "button", onClick: onCancel, children: "\u05D1\u05D9\u05D8\u05D5\u05DC" })] })] }));
}
/* ---------- פעילות: הערות, שיחות, משימות חזרה ---------- */
function ActivityTab({ c, noteRef }) {
    const items = useActivity(c.id);
    const toast = useToast();
    const [kind, setKind] = useState('note');
    const [text, setText] = useState('');
    const [due, setDue] = useState('');
    const [err, setErr] = useState('');
    const KIND = { note: 'הערה', call: 'שיחה', followup: 'משימת חזרה' };
    const submit = async () => {
        if (!text.trim())
            return setErr('כתוב משהו לפני השמירה');
        if (/\d{13,}/.test(text))
            return setErr('אסור לרשום כאן מספר כרטיס אשראי');
        if (kind === 'followup' && !due)
            return setErr('למשימת חזרה צריך תאריך');
        try {
            await addActivity(c.id, { kind, text, due: kind === 'followup' ? due : undefined }, c.name);
            setText('');
            setDue('');
            setErr('');
            toast({ message: `${KIND[kind]} נשמרה` });
        }
        catch {
            setErr('השמירה נכשלה');
        }
    };
    return (_jsxs("div", { className: "card", children: [_jsxs("form", { className: "composer", onSubmit: (e) => { e.preventDefault(); submit(); }, children: [_jsx("div", { className: "seg seg--sm", role: "radiogroup", "aria-label": "\u05E1\u05D5\u05D2", children: Object.keys(KIND).map((k) => _jsx("button", { type: "button", role: "radio", "aria-checked": kind === k, className: kind === k ? 'is-on' : '', onClick: () => setKind(k), children: KIND[k] }, k)) }), _jsx("textarea", { ref: noteRef, className: "input composer__ta", rows: 2, value: text, onChange: (e) => { setText(e.target.value); setErr(''); }, placeholder: kind === 'call' ? 'מה סוכם בשיחה?' : kind === 'followup' ? 'למה לחזור ללקוח?' : 'הערה פנימית על הלקוח', "aria-label": "\u05EA\u05D5\u05DB\u05DF", onKeyDown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            submit();
                        } } }), _jsxs("div", { className: "composer__row", children: [kind === 'followup' && _jsxs("label", { className: "check-inline", children: ["\u05EA\u05D0\u05E8\u05D9\u05DA ", _jsx("input", { className: "input input--sm", type: "date", value: due, onChange: (e) => { setDue(e.target.value); setErr(''); } })] }), err && _jsx("span", { className: "pop__err", role: "alert", children: err }), _jsx(Button, { size: "sm", variant: "primary", type: "submit", className: "composer__send", kbd: "Ctrl+Enter", children: "\u05E9\u05DE\u05D5\u05E8" })] })] }), _jsxs("ol", { className: "timeline cfile__timeline", children: [items.length === 0 && _jsx("li", { className: "muted", children: "\u05D0\u05D9\u05DF \u05E2\u05D3\u05D9\u05D9\u05DF \u05E4\u05E2\u05D9\u05DC\u05D5\u05EA. \u05D4\u05E2\u05E8\u05D5\u05EA, \u05E9\u05D9\u05D7\u05D5\u05EA \u05D5\u05DE\u05E9\u05D9\u05DE\u05D5\u05EA \u05D7\u05D6\u05E8\u05D4 \u05D9\u05D5\u05E4\u05D9\u05E2\u05D5 \u05DB\u05D0\u05DF." }), items.map((a) => (_jsxs("li", { children: [_jsx("span", { className: "timeline__at", children: _jsx(Ltr, { children: a.at ? fmtTs(a.at.toDate()) : '…' }) }), _jsxs("span", { children: [_jsx("span", { className: `akind akind--${a.kind}`, children: KIND[a.kind] }), " ", _jsx("b", { children: a.byName }), a.due && _jsxs("span", { className: "muted", children: [" \u00B7 \u05DC\u05D7\u05D6\u05D5\u05E8 \u05D1-", _jsx(Ltr, { children: a.due.split('-').reverse().join('.') })] }), _jsx("br", {}), a.text] })] }, a.id)))] })] }));
}
/* ---------- היסטוריה: שינויים בפרטי הלקוח, מהיומן שאי אפשר לערוך ---------- */
const FIELD_LABEL = {
    name: 'שם', type: 'סוג', taxId: 'ח.פ', businessAddress: 'כתובת עסק', paymentMethod: 'אמצעי תשלום', accountPhone: 'טלפון הקפה', poRequired: 'תעודת רכש',
    instructions: 'הנחיות קבועות', billingInstructions: 'הנחיות חיוב', priceListId: 'מחירון', status: 'מצב', contacts: 'אנשי קשר', addresses: 'כתובות', customPrices: 'מחירים ייחודיים',
};
function HistoryTab({ c }) {
    const rows = useCustomerHistory(c.id);
    const show = (v) => (v === null || v === undefined || v === '' ? '—' : Array.isArray(v) ? `${v.length} פריטים` : typeof v === 'boolean' ? (v ? 'כן' : 'לא') : String(v));
    const ACTION = { create: 'הלקוח נוצר', update: 'עדכון', status: 'שינוי מצב', merge: 'מיזוג' };
    return (_jsx("div", { className: "card", children: _jsxs("ol", { className: "timeline cfile__timeline", children: [rows.length === 0 && _jsx("li", { className: "muted", children: "\u05D0\u05D9\u05DF \u05E2\u05D3\u05D9\u05D9\u05DF \u05E9\u05D9\u05E0\u05D5\u05D9\u05D9\u05DD." }), rows.map((r) => (_jsxs("li", { children: [_jsx("span", { className: "timeline__at", children: _jsx(Ltr, { children: r.at ? fmtTs(r.at.toDate()) : '…' }) }), _jsxs("span", { children: [_jsx("b", { children: r.byName }), " \u00B7 ", ACTION[r.action] ?? r.action, r.action !== 'create' && r.after && Object.keys(r.after).filter((k) => FIELD_LABEL[k]).map((k) => (_jsxs("span", { className: "hist__change", children: [FIELD_LABEL[k], ": ", _jsx("span", { className: "muted", children: show(r.before?.[k]) }), " \u2190 ", show(r.after?.[k])] }, k))), r.after && 'targetName' in r.after && _jsxs("span", { className: "hist__change", children: ["\u05DE\u05D5\u05D6\u05D2 \u05DC\u05EA\u05D5\u05DA ", String(r.after.targetName)] }), r.after && 'sourceName' in r.after && _jsxs("span", { className: "hist__change", children: ["\"", String(r.after.sourceName), "\" \u05DE\u05D5\u05D6\u05D2 \u05DC\u05DB\u05D0\u05DF"] }), r.note && _jsxs("span", { className: "hist__change muted", children: ["\u05D4\u05E2\u05E8\u05D4: ", r.note] })] })] }, r.id)))] }) }));
}
function fmtTs(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}
