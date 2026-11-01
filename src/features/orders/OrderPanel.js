import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/* תיק הזמנה בפאנל צדדי (אפיון 6.3): כותרת קבועה, "מה חסר" לחיץ, גלילה אחת עם עוגנים, טאב היסטוריה. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Maximize2, Minimize2, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { usePanel } from '../../app/PanelContext';
import { useStore } from '../../data/store';
import { HealthBadge, Missing, StatusMenu, Tip } from '../../design/components';
import { Ltr, Money, fmtDate, fmtMoney, fmtPhone, toISODate, weekday } from '../../lib/format';
import { METHOD_LABEL, PAYMENT_LABEL, STATUS_LABEL } from '../../data/types';
import { useOrderDoc, useOrderHistory, useOrderViewers } from '../../data/orders';
import { healthOf, issuesFor } from '../../rules-engine/health';
import { FixButton, OrderMarks, PoEdit } from './OrderActions';
import { OrderDocsSection } from './OrderDocs';
import { BranchEdit, DeliveryTypeEdit, EditKv, ItemsEditor, MethodEdit, NotesSection, showDate, showPhone, useOrderSave, validDate, validPhone, validTime } from './OrderEdit';
import { phoneError } from '../../lib/names';
import { keepOpenOnToast } from '../../app/ErrorBoundary';
import './OrderPanel.css';
const ANCHORS = [
    ['details', 'פרטים'], ['delivery', 'אספקה'], ['items', 'פריטים ומחיר'], ['approvals', 'אישורים'],
    ['payment', 'תשלום'], ['docs', 'מסמכים'], ['notes', 'הערות'],
];
export function OrderPanel() {
    const panel = usePanel();
    const { orders, now, thresholds } = useStore();
    const reduce = useReducedMotion();
    const [full, setFull] = useState(false);
    const listed = orders.find((x) => x.id === panel.openId);
    // הזמנה ישנה שלא ברשימה החיה – נטענת ישירות
    const single = useOrderDoc(listed || panel.openId == null ? null : panel.openId);
    const o = useMemo(() => {
        if (listed)
            return listed;
        if (!single)
            return undefined;
        const issues = issuesFor(single, now, thresholds);
        return { ...single, issues, health: healthOf(issues) };
    }, [listed, single, now, thresholds]);
    return (_jsx(Dialog.Root, { open: !!o, onOpenChange: (v) => !v && panel.close(), children: _jsx(AnimatePresence, { children: o && (_jsxs(Dialog.Portal, { forceMount: true, children: [_jsx(Dialog.Overlay, { asChild: true, forceMount: true, children: _jsx(motion.div, { className: "panel-overlay", initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } }) }), _jsx(Dialog.Content, { asChild: true, forceMount: true, dir: "rtl", "aria-describedby": undefined, onPointerDownOutside: keepOpenOnToast, onInteractOutside: keepOpenOnToast, onOpenAutoFocus: (e) => { e.preventDefault(); document.getElementById('panel-title')?.focus(); }, onCloseAutoFocus: (e) => e.preventDefault(), children: _jsx(motion.aside, { className: `panel ${full ? 'panel--full' : ''}`, initial: reduce ? { opacity: 0 } : { x: '-100%' }, animate: reduce ? { opacity: 1 } : { x: 0 }, exit: reduce ? { opacity: 0 } : { x: '-100%' }, transition: { type: 'tween', duration: 0.24, ease: [0.2, 0, 0, 1] }, children: _jsx(PanelBody, { o: o, full: full, setFull: setFull }) }) })] })) }) }));
}
function PanelBody({ o, full, setFull }) {
    const { requestStatus } = useStore();
    const save = useOrderSave(o);
    const [editItems, setEditItems] = useState(false);
    /* שינוי של משתמש אחר בזמן שהתיק פתוח: הודעה מה השתנה ועל ידי מי */
    const { profile } = useAuth();
    const prev = useRef(o);
    const viewers = useOrderViewers(o.id);
    const [remoteNote, setRemoteNote] = useState(null);
    useEffect(() => {
        const p = prev.current;
        prev.current = o;
        if (p.id !== o.id) {
            setRemoteNote(null);
            return;
        }
        if (o.updatedAt?.seconds === p.updatedAt?.seconds || !o.updatedBy || o.updatedBy === profile?.uid)
            return;
        const fields = [...new Set(Object.keys(FIELD).filter((k) => JSON.stringify(p[k]) !== JSON.stringify(o[k])).map((k) => FIELD[k]))];
        if (fields.length)
            setRemoteNote({ by: o.updatedByName || 'משתמש אחר', fields });
    }, [o, profile?.uid]);
    useEffect(() => setEditItems(false), [o.id]);
    const panel = usePanel();
    const nav = useNavigate();
    const [tab, setTab] = useState('file');
    const [activeSec, setActiveSec] = useState('details');
    const [scrolled, setScrolled] = useState(false);
    const bodyRef = useRef(null);
    const gap = o.qAmount !== undefined && o.qAmount !== o.amount;
    // הדגשת העוגן של החלק שקוראים כרגע
    useEffect(() => {
        const root = bodyRef.current;
        if (!root || tab !== 'file')
            return;
        const io = new IntersectionObserver((entries) => {
            const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
            if (top)
                setActiveSec(top.target.id.replace('sec-', ''));
        }, { root, rootMargin: '0px 0px -65% 0px' });
        root.querySelectorAll('.sec').forEach((s) => io.observe(s));
        return () => io.disconnect();
    }, [tab, o.id]);
    return (_jsxs(_Fragment, { children: [_jsxs("header", { className: `panel__head ${scrolled ? 'is-scrolled' : ''}`, children: [_jsxs("div", { className: "panel__row", children: [_jsxs(Dialog.Title, { id: "panel-title", className: "panel__title", tabIndex: -1, children: ["\u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: o.id })] }), _jsx(HealthBadge, { health: o.health, issues: o.issues }), viewers.length > 0 && (_jsxs("span", { className: "viewers", role: "status", children: [_jsx("span", { className: "viewers__dot", "aria-hidden": "true" }), viewers.map((v) => v.name.split(' ')[0]).join(', '), " ", viewers.length === 1 ? 'פותח' : 'פותחים', " \u05D0\u05EA \u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05DB\u05E8\u05D2\u05E2"] })), _jsx("span", { className: "panel__spacer" }), _jsx(Tip, { label: full ? 'חזרה לפאנל' : 'מסך מלא', children: _jsx("button", { className: "icon-btn", onClick: () => setFull(!full), "aria-label": full ? 'חזרה לפאנל' : 'מסך מלא', children: full ? _jsx(Minimize2, { size: 18 }) : _jsx(Maximize2, { size: 18 }) }) }), _jsx(Dialog.Close, { asChild: true, children: _jsx("button", { className: "icon-btn", "aria-label": "\u05E1\u05D2\u05D5\u05E8 \u05EA\u05D9\u05E7 \u05D4\u05D6\u05DE\u05E0\u05D4 (Esc)", children: _jsx(X, { size: 20 }) }) })] }), _jsx(AnimatePresence, { initial: false, children: remoteNote && (_jsxs(motion.div, { className: "remote-note", role: "status", initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.18 }, children: [_jsx(RefreshCw, { size: 15, "aria-hidden": "true" }), _jsxs("span", { children: [_jsx("b", { children: remoteNote.by }), " \u05E2\u05D3\u05DB\u05DF \u05E2\u05DB\u05E9\u05D9\u05D5: ", remoteNote.fields.join(', '), ". \u05D4\u05E2\u05E8\u05DB\u05D9\u05DD \u05D1\u05EA\u05D9\u05E7 \u05DE\u05E2\u05D5\u05D3\u05DB\u05E0\u05D9\u05DD."] }), _jsx("button", { className: "icon-btn icon-btn--sm", "aria-label": "\u05E1\u05D2\u05D5\u05E8 \u05D4\u05D5\u05D3\u05E2\u05D4", onClick: () => setRemoteNote(null), children: _jsx(X, { size: 14 }) })] })) }), _jsxs("div", { className: "panel__row panel__meta", children: [_jsx("button", { className: "link", onClick: () => { panel.close(); nav(`/customers/${o.customerId}`); }, children: o.customerName }), _jsx("span", { children: "\u00B7" }), _jsxs("span", { children: ["\u05D9\u05D5\u05DD ", weekday(o.date), " ", _jsx(Ltr, { children: fmtDate(o.date) }), " \u00B7 ", o.time ? _jsx(Ltr, { children: o.time }) : _jsx(Missing, { children: "\u05DC\u05DC\u05D0 \u05E9\u05E2\u05D4" })] }), _jsx("span", { children: "\u00B7" }), _jsx("span", { children: o.branchName || _jsx(Missing, { children: "\u05DC\u05DC\u05D0 \u05E1\u05E0\u05D9\u05E3" }) })] }), o.changedAfterApproval && (_jsxs("div", { className: "changed-note", children: [_jsx("span", { className: "changed-tag", children: "\u05E9\u05D5\u05E0\u05EA\u05D4 \u05DC\u05D0\u05D7\u05E8 \u05D0\u05D9\u05E9\u05D5\u05E8" }), o.changedAfterApproval.fields.map((k) => (_jsxs("span", { className: "changed-note__item", children: [FIELD[k] ?? k, ": \u05D0\u05D5\u05E9\u05E8 ", _jsx("s", { children: showVal(k, o.changedAfterApproval.before[k]) }), " \u00B7 \u05DB\u05E2\u05EA ", _jsx("b", { children: showVal(k, o[k]) })] }, k))), _jsxs("span", { className: "muted", children: ["\u00B7 ", o.changedAfterApproval.by] })] })), _jsxs("div", { className: "panel__row", children: [_jsx(StatusMenu, { status: o.status, onChange: (s) => requestStatus(o, s) }), _jsx("span", { className: "panel__marks", children: _jsx(OrderMarks, { o: o }) })] }), o.issues.length > 0 && (_jsx("div", { className: "missing", "aria-label": "\u05DE\u05D4 \u05D7\u05E1\u05E8", children: o.issues.map((i) => (_jsxs("div", { className: `missing__item missing__item--${i.severity}`, children: [_jsx("span", { children: i.label }), _jsx(FixButton, { o: o, issue: i, onOpen: () => document.getElementById(i.rule === 2 ? 'sec-items' : 'sec-delivery')?.scrollIntoView({ behavior: 'smooth' }) })] }, i.rule))) })), _jsxs("nav", { className: "panel__tabs", "aria-label": "\u05E0\u05D9\u05D5\u05D5\u05D8 \u05D1\u05EA\u05D9\u05E7", children: [_jsx("button", { className: tab === 'file' ? 'is-on' : '', onClick: () => setTab('file'), children: "\u05EA\u05D9\u05E7" }), tab === 'file' && ANCHORS.map(([id, label]) => (_jsx("a", { href: `#sec-${id}`, className: activeSec === id ? 'is-on' : '', "aria-current": activeSec === id ? 'location' : undefined, onClick: (e) => { e.preventDefault(); document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, children: label }, id))), _jsx("button", { className: `panel__tab-history ${tab === 'history' ? 'is-on' : ''}`, onClick: () => setTab('history'), children: "\u05D4\u05D9\u05E1\u05D8\u05D5\u05E8\u05D9\u05D4" })] })] }), _jsx("div", { className: "panel__body", ref: bodyRef, onScroll: (e) => setScrolled(e.currentTarget.scrollTop > 4), tabIndex: 0, role: "region", "aria-label": "\u05EA\u05D5\u05DB\u05DF \u05EA\u05D9\u05E7 \u05D4\u05D4\u05D6\u05DE\u05E0\u05D4", children: tab === 'history' ? _jsx(History, { o: o }) : (_jsxs(_Fragment, { children: [(o.status === 'partial' || o.status === 'cancelled') && (_jsxs("div", { className: `closed-note closed-note--${o.status}`, children: [_jsx("b", { children: o.status === 'partial' ? 'סופקה חלקית' : `בוטלה${o.cancelReason ? ` · ${o.cancelReason}` : ''}` }), (o.partialNote || o.cancelNote) && _jsx("span", { children: o.partialNote ?? o.cancelNote })] })), _jsxs(Section, { id: "details", title: "\u05E4\u05E8\u05D8\u05D9\u05DD", children: [_jsx(Kv, { k: "\u05DC\u05E7\u05D5\u05D7", v: o.customerName }), _jsx(EditKv, { k: "\u05E2\u05E8\u05D5\u05E5 \u05E7\u05D1\u05DC\u05D4", value: o.channel, display: o.channel || _jsx(Missing, {}), placeholder: "\u05DC\u05D0 \u05E0\u05E8\u05E9\u05DD", validate: (v) => (v ? '' : 'חובה: ערוץ ההזמנה'), onSave: (v) => save({ channel: v }, 'ערוץ הקבלה') }), _jsx(Kv, { k: "\u05DE\u05D8\u05E4\u05DC", v: o.handler }), _jsx(Kv, { k: "\u05E0\u05D5\u05E6\u05E8 \u05E2\u05F4\u05D9", v: _jsxs(_Fragment, { children: [o.createdBy, " \u00B7 ", _jsx(Ltr, { children: fmtDate(o.createdAt) })] }) })] }), _jsxs(Section, { id: "delivery", title: "\u05D0\u05E1\u05E4\u05E7\u05D4", children: [_jsx(EditKv, { k: "\u05EA\u05D0\u05E8\u05D9\u05DA", kind: "date", value: o.date, display: _jsxs(_Fragment, { children: ["\u05D9\u05D5\u05DD ", weekday(o.date), " \u00B7 ", showDate(o.date)] }), validate: validDate, onSave: (v) => save({ date: v }, 'תאריך האספקה') }), _jsx(EditKv, { k: "\u05E9\u05E2\u05D4", kind: "time", value: o.time, display: o.time ? _jsx(Ltr, { children: o.time }) : _jsx(Missing, {}), validate: validTime, onSave: (v) => save({ time: v }, 'שעת האספקה') }), _jsx(DeliveryTypeEdit, { o: o }), _jsx(BranchEdit, { o: o }), o.delivery === 'delivery' && _jsx(EditKv, { k: "\u05DB\u05EA\u05D5\u05D1\u05EA", value: o.address ?? '', display: o.address || _jsx(Missing, { children: "\u05D7\u05E1\u05E8\u05D4" }), placeholder: "\u05E8\u05D7\u05D5\u05D1, \u05DE\u05E1\u05E4\u05E8, \u05E2\u05D9\u05E8", onSave: (v) => save({ address: v || undefined }, 'הכתובת') }), _jsx(EditKv, { k: "\u05D0\u05D9\u05E9 \u05E7\u05E9\u05E8 \u05DC\u05E7\u05D1\u05DC\u05D4", value: o.contactName ?? '', display: o.contactName || _jsx(Missing, {}), placeholder: "\u05DE\u05D9 \u05DE\u05E7\u05D1\u05DC \u05D0\u05EA \u05D4\u05D4\u05D6\u05DE\u05E0\u05D4", onSave: (v) => save({ contactName: v || undefined }, 'איש הקשר') }), _jsx(EditKv, { k: "\u05D8\u05DC\u05E4\u05D5\u05DF", kind: "phone", value: o.contactPhone ? fmtPhone(o.contactPhone) : '', display: showPhone(o.contactPhone) ?? _jsx(Missing, {}), placeholder: "05X-XXXXXXX", validate: validPhone, onSave: (v) => save({ contactPhone: v || undefined }, 'הטלפון') }), _jsx(EditKv, { k: "\u05D4\u05E0\u05D7\u05D9\u05D5\u05EA", kind: "textarea", value: o.instructions ?? '', placeholder: "\u05D0\u05D9\u05DF", onSave: (v) => save({ instructions: v || undefined }, 'ההנחיות') })] }), _jsxs(Section, { id: "items", title: "\u05E4\u05E8\u05D9\u05D8\u05D9\u05DD \u05D5\u05DE\u05D7\u05D9\u05E8", action: !editItems && _jsx("button", { className: "link", onClick: () => setEditItems(true), children: "\u05E2\u05E8\u05D9\u05DB\u05D4" }), children: [editItems ? _jsx(ItemsEditor, { o: o, onDone: () => setEditItems(false) }) : (_jsxs(_Fragment, { children: [o.contents && _jsx("p", { className: "order-contents", children: o.contents }), o.items.length > 0 && _jsxs("table", { className: "items", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u05E4\u05E8\u05D9\u05D8" }), _jsx("th", { children: "\u05DB\u05DE\u05D5\u05EA" }), _jsx("th", { children: "\u05DE\u05D7\u05D9\u05E8 \u05DC\u05D9\u05D7\u05D9\u05D3\u05D4" }), _jsx("th", { children: "\u05E1\u05D4\u05F4\u05DB" })] }) }), _jsx("tbody", { children: o.items.map((it, i) => (_jsxs("tr", { children: [_jsx("td", { children: it.name }), _jsx("td", { children: _jsx(Ltr, { children: it.qty }) }), _jsx("td", { children: _jsx(Money, { value: it.unitPrice }) }), _jsx("td", { children: _jsx(Money, { value: it.qty * it.unitPrice }) })] }, i))) })] }), !o.contents && o.items.length === 0 && _jsxs("p", { className: "muted", children: ["\u05DC\u05D0 \u05E0\u05E8\u05E9\u05DE\u05D4 \u05EA\u05DB\u05D5\u05DC\u05D4 \u2013 \u05E8\u05E7 \u05E1\u05DB\u05D5\u05DD. ", _jsx("button", { className: "link", onClick: () => setEditItems(true), children: "\u05D4\u05D5\u05E1\u05E3 \u05E4\u05D9\u05E8\u05D5\u05D8" })] })] })), _jsxs("div", { className: "sums", children: [!!o.deliveryFee && _jsxs("div", { children: [_jsx("span", { children: "\u05DE\u05EA\u05D5\u05DB\u05D5 \u05D3\u05DE\u05D9 \u05DE\u05E9\u05DC\u05D5\u05D7" }), _jsx("b", { children: _jsx(Money, { value: o.deliveryFee }) })] }), o.calcAmount !== undefined && _jsxs("div", { children: [_jsx("span", { children: "\u05DE\u05D7\u05D5\u05E9\u05D1 \u05DE\u05D4\u05E4\u05E8\u05D9\u05D8\u05D9\u05DD" }), _jsx("b", { className: "muted", children: _jsx(Money, { value: o.calcAmount }) })] }), _jsxs("div", { children: [_jsxs("span", { children: ["\u05E1\u05DB\u05D5\u05DD \u05DC\u05D7\u05D9\u05D5\u05D1", o.calcAmount !== undefined && _jsx("span", { className: "no-final__tag", children: " \u05E9\u05D5\u05E0\u05D4 \u05D9\u05D3\u05E0\u05D9\u05EA" })] }), _jsx("b", { children: o.amount > 0 ? _jsx(Money, { value: o.amount }) : _jsx(Missing, { children: "\u05D7\u05E1\u05E8 \u05E1\u05DB\u05D5\u05DD" }) })] }), _jsxs("div", { className: gap ? 'is-gap' : '', children: [_jsx("span", { children: "\u05E1\u05DB\u05D5\u05DD Q" }), _jsx("b", { children: o.qAmount !== undefined ? _jsx(Money, { value: o.qAmount }) : '—' }), gap && _jsxs("em", { children: ["\u05E4\u05E2\u05E8 ", _jsx(Ltr, { children: fmtMoney(Math.abs((o.qAmount ?? 0) - o.amount)) })] })] })] })] }), _jsxs(Section, { id: "approvals", title: "\u05D0\u05D9\u05E9\u05D5\u05E8\u05D9\u05DD \u05D5\u05E1\u05D9\u05DE\u05D5\u05E0\u05D9\u05DD", children: [_jsx(Kv, { k: "\u05D0\u05D9\u05E9\u05D5\u05E8 \u05DC\u05E7\u05D5\u05D7", v: o.status === 'approved' || o.status === 'delivered' || o.status === 'partial' ? 'אושר' : _jsx("span", { className: "warn-text", children: "\u05D8\u05E8\u05DD \u05D0\u05D5\u05E9\u05E8" }) }), _jsx(Kv, { k: "\u05D0\u05D9\u05E9\u05D5\u05E8 \u05E1\u05E0\u05D9\u05E3", v: o.branchApproval ? _jsxs(_Fragment, { children: ["\u05D0\u05D5\u05E9\u05E8 \u05E2\u05F4\u05D9 ", o.branchApproval.manager] }) : _jsx("span", { className: "warn-text", children: "\u05D7\u05E1\u05E8" }) }), _jsx(Kv, { k: "\u05D4\u05D5\u05E2\u05D1\u05E8\u05D4 \u05DC-Q", v: o.qNumber ? _jsxs(_Fragment, { children: [_jsx(Ltr, { children: o.qNumber }), " \u00B7 ", _jsx(Money, { value: o.qAmount ?? o.amount })] }) : _jsx("span", { className: "warn-text", children: "\u05DC\u05D0 \u05D4\u05D5\u05E2\u05D1\u05E8\u05D4" }) })] }), _jsxs(Section, { id: "payment", title: "\u05EA\u05E9\u05DC\u05D5\u05DD", children: [_jsx(MethodEdit, { o: o }), o.method === 'account' && _jsx(EditKv, { k: "\u05D8\u05DC\u05E4\u05D5\u05DF \u05D4\u05E7\u05E4\u05D4", kind: "phone", value: o.accountPhone ? fmtPhone(o.accountPhone) : '', display: showPhone(o.accountPhone) ?? _jsx(Missing, {}), placeholder: "05X-XXXXXXX", validate: (v) => (v ? phoneError(v) : 'חובה בהקפה: טלפון ההקפה'), onSave: (v) => save({ accountPhone: v }, 'טלפון ההקפה') }), _jsx(Kv, { k: "\u05DE\u05E6\u05D1 \u05EA\u05E9\u05DC\u05D5\u05DD", v: PAYMENT_LABEL[o.payment] }), _jsx(Kv, { k: "\u05EA\u05E2\u05D5\u05D3\u05EA \u05E8\u05DB\u05E9", v: _jsxs("span", { className: "kv__edit", children: [o.poNumber ? _jsx(Ltr, { children: o.poNumber }) : _jsx("span", { className: "muted", children: "\u05DC\u05D0 \u05E0\u05E8\u05E9\u05DD" }), " ", _jsx(PoEdit, { o: o })] }) }), o.billingNote && _jsx(Kv, { k: "\u05D4\u05E2\u05E8\u05D5\u05EA \u05DC\u05D7\u05D9\u05D5\u05D1", v: o.billingNote })] }), _jsx(Section, { id: "docs", title: "\u05DE\u05E1\u05DE\u05DB\u05D9\u05DD", children: _jsx(OrderDocsSection, { orderId: o.id, customerId: o.customerId }) }), _jsx(Section, { id: "notes", title: "\u05D4\u05E2\u05E8\u05D5\u05EA \u05E4\u05E0\u05D9\u05DE\u05D9\u05D5\u05EA", children: _jsx(NotesSection, { o: o }) })] })) }), _jsxs("footer", { className: "panel__foot", children: [_jsxs("span", { className: "muted", children: ["\u05DC\u05D7\u05D9\u05E6\u05D4 \u05E2\u05DC \u05E2\u05E8\u05DA \u05E4\u05D5\u05EA\u05D7\u05EA \u05E2\u05E8\u05D9\u05DB\u05D4 \u00B7 \u05E0\u05E9\u05DE\u05E8 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA \u00B7 ", _jsx("kbd", { className: "kbd", children: "Esc" }), " \u05DC\u05E1\u05D2\u05D9\u05E8\u05D4"] }), _jsx("button", { className: "link", onClick: panel.close, children: "\u05D7\u05D6\u05E8\u05D4 \u05DC\u05E8\u05E9\u05D9\u05DE\u05D4" })] })] }));
}
function Section({ id, title, children, action }) {
    return (_jsxs("section", { id: `sec-${id}`, className: "sec", "aria-labelledby": `h-${id}`, children: [_jsxs("div", { className: "sec__head", children: [_jsx("h3", { id: `h-${id}`, className: "sec__title", children: title }), action] }), _jsx("div", { className: "sec__body", children: children })] }));
}
function Kv({ k, v }) {
    return _jsxs("div", { className: "kv", children: [_jsx("span", { className: "kv__k", children: k }), _jsx("span", { className: "kv__v", children: v })] });
}
/* יומן ההזמנה – נקרא מ-auditLog, שאי אפשר לערוך או למחוק (נאכף בשרת) */
export const FIELD = {
    status: 'סטטוס', payment: 'תשלום', qNumber: "מס' Q", qAmount: 'סכום Q', branchApproval: 'אישור סניף', poNumber: 'תעודת רכש',
    date: 'תאריך', time: 'שעה', amount: 'סכום לחיוב', docName: 'מסמך שצורף', contactName: 'איש קשר', contactPhone: 'טלפון', channel: 'ערוץ',
    delivery: 'סוג אספקה', instructions: 'הנחיות', contents: 'פירוט', deliveryFee: 'דמי משלוח', method: 'אמצעי תשלום', accountPhone: 'טלפון הקפה',
    qGapAck: 'פער מול Q', qCancelAck: 'ביטול ב-Q', items: 'פריטים', partialNote: 'מה סופק', cancelReason: 'סיבת ביטול', cancelNote: 'פירוט ביטול', note: 'הערה', branchName: 'סניף', address: 'כתובת', customerName: 'לקוח', customerId: 'לקוח',
};
export function showVal(k, v) {
    if (v === null || v === undefined || v === '')
        return '—';
    if (k === 'status')
        return STATUS_LABEL[v] ?? String(v);
    if (k === 'payment')
        return PAYMENT_LABEL[v] ?? String(v);
    if (k === 'amount' || k === 'qAmount')
        return fmtMoney(Number(v));
    if (k === 'branchApproval')
        return `אושר ע"י ${v.manager ?? ''}`;
    if (k === 'date')
        return fmtDate(String(v));
    if (k === 'qGapAck')
        return v ? `אושר שהפער מוסבר: ${v.note ?? ''}` : '—';
    if (k === 'qCancelAck')
        return v ? 'אושר שבוטלה גם בקופה' : '—';
    if (k === 'items')
        return Array.isArray(v) ? `${v.length} פריטים` : '—';
    if (k === 'delivery')
        return v === 'pickup' ? 'איסוף עצמי' : 'משלוח';
    if (k === 'deliveryFee')
        return fmtMoney(Number(v));
    if (k === 'method')
        return METHOD_LABEL[String(v)] ?? String(v);
    return String(v);
}
const fmtAt = (d) => `${fmtDate(toISODate(d))} | ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
function History({ o }) {
    const rows = useOrderHistory(o.id);
    if (rows === null)
        return _jsx("p", { className: "muted", children: "\u05D8\u05D5\u05E2\u05DF\u2026" });
    return (_jsxs("ol", { className: "timeline", children: [rows.length === 0 && _jsx("li", { className: "muted", children: "\u05D0\u05D9\u05DF \u05E2\u05D3\u05D9\u05D9\u05DF \u05E8\u05E9\u05D5\u05DE\u05D5\u05EA \u05D1\u05D9\u05D5\u05DE\u05DF." }), rows.map((r) => (_jsxs("li", { children: [_jsx("span", { className: "timeline__at", children: _jsx(Ltr, { children: r.at ? fmtAt(r.at.toDate()) : '…' }) }), _jsxs("span", { children: [_jsx("b", { children: r.byName }), " \u00B7 ", r.action === 'create' ? 'ההזמנה נוצרה' : r.action === 'doc' ? 'צירוף תעודת רכש' : r.action === 'note' ? 'הערה פנימית' : r.note === 'ביטול פעולה' ? 'ביטול פעולה' : r.action === 'status' ? 'שינוי סטטוס' : r.source === 'bulk' ? 'עדכון מרובה' : 'עדכון', r.action !== 'create' && r.action !== 'doc' && r.after && Object.keys(r.after).filter((k) => FIELD[k]).map((k) => (_jsxs("span", { className: "hist__change", children: [FIELD[k], ": ", _jsx("span", { className: "muted", children: showVal(k, r.before?.[k]) }), " \u2190 ", showVal(k, r.after?.[k])] }, k))), r.action === 'doc' && r.after && _jsx("span", { className: "hist__change", children: String(r.after.docName ?? '') }), r.note && r.note !== 'ביטול פעולה' && _jsxs("span", { className: "hist__change muted", children: ["\u05D4\u05E2\u05E8\u05D4: ", r.note] })] })] }, r.id)))] }));
}
