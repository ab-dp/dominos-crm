import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/* צירוף מסמכים: גרירה או "בחר קובץ", עם סוג מסמך מתוך הרשימות (תעודת רכש, הצעת מחיר, חשבונית…).
   בטופס ההזמנה הקובץ נשמר יחד עם ההזמנה; בתיק ההזמנה ובתיק הלקוח – מיד. */
import { useRef, useState } from 'react';
import { Download, ExternalLink, FileText, Paperclip, X } from 'lucide-react';
import { Button } from '../../design/components';
import { useToast } from '../../design/Toast';
import { useLists } from '../../data/lists';
import { ACCEPT, MAX_FILE, fileError, isOlderVersion, openOrderDoc, uploadDoc, useCustomerDocs, useOrderDocs } from '../../data/orderDocs';
import { Ltr, fmtDate, toISODate } from '../../lib/format';
import './OrderDocs.css';
const kb = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);
export function FileDrop({ file, onFile, label = 'צרף תעודת רכש', busy }) {
    const input = useRef(null);
    const [over, setOver] = useState(false);
    const [err, setErr] = useState('');
    const take = (f) => {
        if (!f)
            return;
        const e = fileError(f) || (f.size > MAX_FILE * 4 ? 'הקובץ גדול מדי' : '');
        setErr(e);
        if (!e)
            onFile(f);
    };
    const drop = (e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); };
    if (file) {
        return (_jsxs("div", { className: "fdrop fdrop--file", children: [_jsx(FileText, { size: 18, "aria-hidden": "true" }), _jsx("span", { className: "fdrop__name", children: file.name }), _jsx("span", { className: "muted", children: _jsx(Ltr, { children: kb(file.size) }) }), busy ? _jsx("span", { className: "muted", children: "\u05DE\u05E2\u05DC\u05D4\u2026" }) : _jsx("button", { type: "button", className: "icon-btn icon-btn--sm", "aria-label": `הסר את ${file.name}`, onClick: () => onFile(null), children: _jsx(X, { size: 16 }) })] }));
    }
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: `fdrop ${over ? 'is-over' : ''}`, onDragOver: (e) => { e.preventDefault(); setOver(true); }, onDragLeave: () => setOver(false), onDrop: drop, children: [_jsx(Paperclip, { size: 18, "aria-hidden": "true" }), _jsx("span", { children: "\u05D2\u05E8\u05D5\u05E8 \u05DC\u05DB\u05D0\u05DF \u05E7\u05D5\u05D1\u05E5, \u05D0\u05D5" }), _jsx(Button, { size: "sm", type: "button", onClick: () => input.current?.click(), children: label }), _jsx("span", { className: "muted fdrop__hint", children: "PDF \u05D0\u05D5 \u05EA\u05DE\u05D5\u05E0\u05D4, \u05E2\u05D3 2MB" }), _jsx("input", { ref: input, type: "file", accept: ACCEPT, hidden: true, onChange: (e) => { take(e.target.files?.[0]); e.target.value = ''; } })] }), err && _jsx("span", { className: "cform__err", role: "alert", children: err })] }));
}
/* רשימת מסמכים: חדש קודם, וגרסה קודמת מאותו סוג מסומנת */
function DocList({ docs, showOrder }) {
    const toast = useToast();
    const open = async (d, download) => {
        try {
            const url = await openOrderDoc(d);
            if (download) {
                const a = document.createElement('a');
                a.href = url;
                a.download = d.name;
                a.click();
            }
            else
                window.open(url, '_blank', 'noopener');
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        }
        catch {
            toast({ message: 'פתיחת הקובץ נכשלה' });
        }
    };
    if (!docs.length)
        return null;
    return (_jsx("ul", { className: "odocs__list", children: docs.map((d) => {
            const old = isOlderVersion(d, docs);
            return (_jsxs("li", { className: old ? 'is-old' : '', children: [_jsx(FileText, { size: 18, "aria-hidden": "true" }), _jsxs("span", { className: "odocs__main", children: [_jsx("b", { children: d.name }), _jsxs("span", { className: "muted", children: [_jsx("span", { className: "odocs__kind", children: d.kindLabel ?? (d.kind === 'po' ? 'תעודת רכש' : d.kind) }), showOrder && (d.orderId ? _jsxs(_Fragment, { children: [" \u00B7 \u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: d.orderId })] }) : _jsx(_Fragment, { children: " \u00B7 \u05DE\u05E1\u05DE\u05DA \u05DC\u05E7\u05D5\u05D7" })), ' · ', _jsx(Ltr, { children: kb(d.size) }), " \u00B7 ", d.byName, d.at && _jsxs(_Fragment, { children: [" \u00B7 ", _jsx(Ltr, { children: fmtDate(toISODate(d.at.toDate())) })] }), old && ' · גרסה קודמת'] })] }), _jsx("button", { className: "icon-btn icon-btn--sm", "aria-label": `פתח את ${d.name}`, onClick: () => open(d, false), children: _jsx(ExternalLink, { size: 16 }) }), _jsx("button", { className: "icon-btn icon-btn--sm", "aria-label": `הורד את ${d.name}`, onClick: () => open(d, true), children: _jsx(Download, { size: 16 }) })] }, d.id));
        }) }));
}
/* העלאה עם בחירת סוג מסמך */
function Uploader({ target, defaultKind }) {
    const toast = useToast();
    const { lists } = useLists();
    const kinds = (lists?.docTypes ?? []).filter((k) => k.active);
    const [kind, setKind] = useState(defaultKind);
    // סוג ברירת המחדל לא קיים ברשימה (למשל נמחק בהגדרות) – בוחרים את הראשון
    const effKind = kinds.some((k) => k.id === kind) || !kinds.length ? kind : kinds[0].id;
    const [busy, setBusy] = useState(false);
    const [pending, setPending] = useState(null);
    const label = kinds.find((k) => k.id === effKind)?.label ?? 'מסמך';
    const upload = async (f) => {
        if (!f)
            return;
        setPending(f);
        setBusy(true);
        try {
            await uploadDoc({ ...target, kind: effKind, kindLabel: label }, f);
            toast({ message: _jsxs(_Fragment, { children: [label, " \u05E6\u05D5\u05E8\u05E3", target.orderId != null ? _jsxs(_Fragment, { children: [" \u05DC\u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: target.orderId })] }) : ' לתיק הלקוח'] }) });
        }
        catch (e) {
            toast({ message: e instanceof Error && e.message ? e.message : 'הצירוף נכשל – בדוק חיבור' });
        }
        setBusy(false);
        setPending(null);
    };
    return (_jsxs("div", { className: "odocs__up", children: [kinds.length > 0 && (_jsxs("label", { className: "odocs__kindsel", children: [_jsx("span", { className: "field__label", children: "\u05E1\u05D5\u05D2 \u05DE\u05E1\u05DE\u05DA" }), _jsx("select", { className: "input input--sm", value: effKind, onChange: (e) => setKind(e.target.value), children: kinds.map((k) => _jsx("option", { value: k.id, children: k.label }, k.id)) })] })), _jsx(FileDrop, { file: pending, busy: busy, onFile: upload, label: `צרף ${label}` })] }));
}
/* בתיק ההזמנה */
export function OrderDocsSection({ orderId, customerId }) {
    const docs = useOrderDocs(orderId);
    return (_jsxs("div", { className: "odocs", children: [docs === null ? _jsx("p", { className: "muted", children: "\u05D8\u05D5\u05E2\u05DF\u2026" }) : _jsx(DocList, { docs: docs }), _jsx(Uploader, { target: { orderId, customerId }, defaultKind: "po" })] }));
}
/* בתיק הלקוח: מסמכים קבועים של הלקוח וכל מסמכי ההזמנות שלו */
export function CustomerDocsSection({ customerId }) {
    const docs = useCustomerDocs(customerId);
    const [view, setView] = useState('all');
    const list = (docs ?? []).filter((d) => view === 'all' || (view === 'customer' ? !d.orderId : !!d.orderId));
    return (_jsxs("div", { className: "card odocs odocs--card", children: [_jsxs("div", { className: "card__head", children: [_jsx("h2", { className: "card__title", children: "\u05DE\u05E1\u05DE\u05DB\u05D9\u05DD" }), _jsx("div", { className: "seg seg--sm-text", role: "group", "aria-label": "\u05E1\u05D9\u05E0\u05D5\u05DF \u05DE\u05E1\u05DE\u05DB\u05D9\u05DD", children: [['all', 'הכל'], ['customer', 'של הלקוח'], ['orders', 'של הזמנות']].map(([k, l]) => (_jsx("button", { className: view === k ? 'is-on' : '', "aria-pressed": view === k, onClick: () => setView(k), children: l }, k))) })] }), _jsxs("div", { className: "odocs__body", children: [docs === null ? _jsx("p", { className: "muted", children: "\u05D8\u05D5\u05E2\u05DF\u2026" }) : list.length ? _jsx(DocList, { docs: list, showOrder: true }) : _jsxs("p", { className: "muted odocs__empty", children: ["\u05D0\u05D9\u05DF \u05E2\u05D3\u05D9\u05D9\u05DF \u05DE\u05E1\u05DE\u05DB\u05D9\u05DD", view === 'orders' ? ' בהזמנות' : view === 'customer' ? ' קבועים' : '', "."] }), _jsx("p", { className: "odocs__hint", children: "\u05DE\u05E1\u05DE\u05DA \u05E7\u05D1\u05D5\u05E2 \u05E9\u05DC \u05D4\u05DC\u05E7\u05D5\u05D7 \u2013 \u05DC\u05DE\u05E9\u05DC \u05D4\u05E1\u05DB\u05DD \u05DE\u05D7\u05D9\u05E8 \u05D0\u05D5 \u05D8\u05D5\u05E4\u05E1 \u05E4\u05EA\u05D9\u05D7\u05EA \u05D4\u05E7\u05E4\u05D4:" }), _jsx(Uploader, { target: { customerId }, defaultKind: "agreement" })] })] }));
}
