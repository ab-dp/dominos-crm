import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/* סגירה ידנית של הזמנה (אפיון 4.7, 6.2): "סופקה חלקית" ו"בוטלה" נפתחים בחלון קטן עם הפרטים שצריך לדעת,
   מכל מקום שמשנים ממנו סטטוס – טבלה, מסך היום או תיק ההזמנה. ההזמנה עוברת לארכיון רק אחרי הסגירה. */
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CircleAlert, X } from 'lucide-react';
import { useLists } from '../../data/lists';
import { useStore } from '../../data/store';
import { Button } from '../../design/components';
import { Ltr, fmtMoney } from '../../lib/format';
import { keepOpenOnToast } from '../../app/ErrorBoundary';
import './StatusDialogs.css';
const CARD_RE = /\d{13,}/;
const money = (s) => Number(s.replace(/[^\d.]/g, '')) || 0;
export function StatusDialogs() {
    const { closing, endClosing } = useStore();
    if (!closing)
        return null;
    return closing.status === 'partial'
        ? _jsx(PartialDialog, { onClose: endClosing }, closing.order.id)
        : _jsx(CancelDialog, { onClose: endClosing }, closing.order.id);
}
function Shell({ title, sub, children, onClose }) {
    return (_jsx(Dialog.Root, { open: true, onOpenChange: (v) => !v && onClose(), children: _jsxs(Dialog.Portal, { children: [_jsx(Dialog.Overlay, { className: "cmd-overlay" }), _jsxs(Dialog.Content, { className: "udialog sdialog", dir: "rtl", "aria-describedby": "sdialog-sub", onPointerDownOutside: keepOpenOnToast, onInteractOutside: keepOpenOnToast, onOpenAutoFocus: (e) => { e.preventDefault(); e.currentTarget.querySelector('textarea, input')?.focus(); }, children: [_jsxs("div", { className: "sdialog__head", children: [_jsx(Dialog.Title, { className: "udialog__title", children: title }), _jsx(Dialog.Close, { asChild: true, children: _jsx("button", { className: "icon-btn", "aria-label": "\u05E1\u05D2\u05D5\u05E8", children: _jsx(X, { size: 18 }) }) })] }), _jsx("p", { id: "sdialog-sub", className: "sdialog__sub", children: sub }), children] })] }) }));
}
function PartialDialog({ onClose }) {
    const { closing, update } = useStore();
    const o = closing.order;
    const [what, setWhat] = useState('');
    const [amount, setAmount] = useState(String(o.amount));
    const [err, setErr] = useState('');
    const next = money(amount);
    const save = () => {
        if (!what.trim())
            return setErr('חובה: מה סופק בפועל, או מה חסר');
        if (CARD_RE.test(what))
            return setErr('אסור לרשום כאן מספר כרטיס אשראי');
        if (next <= 0)
            return setErr('הסכום לחיוב חייב להיות גדול מ-0');
        update(o.id, {
            status: 'partial', partialNote: what.trim(),
            ...(next !== o.amount ? { amount: next } : {}),
        }, _jsxs(_Fragment, { children: ["\u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: o.id }), " \u05E1\u05D5\u05DE\u05E0\u05D4 \"\u05E1\u05D5\u05E4\u05E7\u05D4 \u05D7\u05DC\u05E7\u05D9\u05EA\" \u05D5\u05E2\u05D1\u05E8\u05D4 \u05DC\u05D0\u05E8\u05DB\u05D9\u05D5\u05DF", next !== o.amount && _jsxs(_Fragment, { children: [" \u00B7 \u05DC\u05D7\u05D9\u05D5\u05D1 ", _jsx(Ltr, { children: fmtMoney(next) })] })] }));
        onClose();
    };
    return (_jsx(Shell, { title: "\u05E1\u05D5\u05E4\u05E7\u05D4 \u05D7\u05DC\u05E7\u05D9\u05EA", sub: _jsxs(_Fragment, { children: ["\u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: o.id }), " \u00B7 ", o.customerName] }), onClose: onClose, children: _jsxs("form", { onSubmit: (e) => { e.preventDefault(); save(); }, className: "sdialog__form", children: [_jsxs("label", { className: "field", children: [_jsxs("span", { className: "field__label", children: ["\u05DE\u05D4 \u05E1\u05D5\u05E4\u05E7 \u05D1\u05E4\u05D5\u05E2\u05DC, \u05D0\u05D5 \u05DE\u05D4 \u05D7\u05E1\u05E8 ", _jsx("span", { className: "req", children: "\u05D7\u05D5\u05D1\u05D4" })] }), _jsx("textarea", { className: "input cform__ta", rows: 3, autoFocus: true, value: what, onChange: (e) => { setWhat(e.target.value); setErr(''); }, placeholder: "\u05DC\u05DE\u05E9\u05DC: \u05E1\u05D5\u05E4\u05E7\u05D5 10 \u05DE\u05E9\u05E4\u05D7\u05EA\u05D9\u05D5\u05EA \u05DE\u05EA\u05D5\u05DA 12, \u05D1\u05DC\u05D9 \u05D4\u05E9\u05EA\u05D9\u05D9\u05D4", "aria-invalid": !!err && !what.trim() })] }), _jsxs("label", { className: "field", children: [_jsx("span", { className: "field__label", children: "\u05E1\u05DB\u05D5\u05DD \u05DC\u05D7\u05D9\u05D5\u05D1 \u05D0\u05D7\u05E8\u05D9 \u05D4\u05E2\u05D3\u05DB\u05D5\u05DF (\u20AA)" }), _jsx("input", { className: "input input--ltr sdialog__money", inputMode: "decimal", value: amount, onChange: (e) => { setAmount(e.target.value); setErr(''); } }), _jsxs("span", { className: "field__hint", children: ["\u05D4\u05D9\u05D4 ", _jsx(Ltr, { children: fmtMoney(o.amount) }), o.qNumber && _jsxs(_Fragment, { children: [" \u00B7 \u05D1-Q: ", _jsx(Ltr, { children: fmtMoney(o.qAmount ?? o.amount) })] })] })] }), o.qNumber && next !== (o.qAmount ?? o.amount) && (_jsxs("p", { className: "sdialog__warn", children: [_jsx(CircleAlert, { size: 16, "aria-hidden": "true" }), " \u05D4\u05E1\u05DB\u05D5\u05DD \u05E9\u05D5\u05E0\u05D4 \u05DE\u05DE\u05D4 \u05E9\u05E8\u05E9\u05D5\u05DD \u05D1-Q (", _jsx(Ltr, { children: o.qNumber }), "). \u05D6\u05DB\u05D5\u05E8 \u05DC\u05E2\u05D3\u05DB\u05DF \u05D2\u05DD \u05D1\u05E7\u05D5\u05E4\u05D4."] })), err && _jsx("p", { className: "cform__err", role: "alert", children: err }), _jsxs("div", { className: "udialog__actions", children: [_jsx(Button, { variant: "primary", type: "submit", children: "\u05E1\u05DE\u05DF \u05E1\u05D5\u05E4\u05E7\u05D4 \u05D7\u05DC\u05E7\u05D9\u05EA" }), _jsx(Button, { variant: "ghost", type: "button", onClick: onClose, children: "\u05D1\u05D9\u05D8\u05D5\u05DC" })] })] }) }));
}
function CancelDialog({ onClose }) {
    const { closing, update } = useStore();
    const { lists } = useLists();
    const o = closing.order;
    const reasons = (lists?.cancelReasons ?? []).filter((r) => r.active);
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [err, setErr] = useState('');
    const isOther = reason === 'other' || reasons.find((r) => r.id === reason)?.label === 'אחר';
    const save = () => {
        if (!reason)
            return setErr('חובה: סיבת הביטול');
        if (isOther && !note.trim())
            return setErr('בסיבה "אחר" צריך לפרט');
        if (CARD_RE.test(note))
            return setErr('אסור לרשום כאן מספר כרטיס אשראי');
        const label = reasons.find((r) => r.id === reason)?.label ?? reason;
        update(o.id, { status: 'cancelled', payment: 'cancelled', cancelReason: label, ...(note.trim() ? { cancelNote: note.trim() } : {}) }, _jsxs(_Fragment, { children: ["\u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: o.id }), " \u05D1\u05D5\u05D8\u05DC\u05D4 \u00B7 ", label] }));
        onClose();
    };
    return (_jsx(Shell, { title: "\u05D1\u05D9\u05D8\u05D5\u05DC \u05D4\u05D6\u05DE\u05E0\u05D4", sub: _jsxs(_Fragment, { children: ["\u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: o.id }), " \u00B7 ", o.customerName] }), onClose: onClose, children: _jsxs("form", { onSubmit: (e) => { e.preventDefault(); save(); }, className: "sdialog__form", children: [o.qNumber && (_jsxs("p", { className: "sdialog__warn sdialog__warn--strong", children: [_jsx(CircleAlert, { size: 16, "aria-hidden": "true" }), " \u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05DB\u05D1\u05E8 \u05D4\u05D5\u05E2\u05D1\u05E8\u05D4 \u05DC-Q (", _jsx(Ltr, { children: o.qNumber }), "). \u05E6\u05E8\u05D9\u05DA \u05DC\u05D1\u05D8\u05DC \u05D0\u05D5\u05EA\u05D4 \u05D2\u05DD \u05D1\u05E7\u05D5\u05E4\u05D4."] })), _jsxs("fieldset", { className: "sdialog__reasons", children: [_jsxs("legend", { className: "field__label", children: ["\u05E1\u05D9\u05D1\u05EA \u05D4\u05D1\u05D9\u05D8\u05D5\u05DC ", _jsx("span", { className: "req", children: "\u05D7\u05D5\u05D1\u05D4" })] }), _jsx("div", { className: "sdialog__grid", children: reasons.map((r, i) => (_jsxs("label", { className: `sdialog__reason ${reason === r.id ? 'is-on' : ''}`, children: [_jsx("input", { type: "radio", name: "cancel-reason", value: r.id, checked: reason === r.id, autoFocus: i === 0, onChange: () => { setReason(r.id); setErr(''); } }), r.label] }, r.id))) })] }), _jsxs("label", { className: "field", children: [_jsxs("span", { className: "field__label", children: ["\u05E4\u05D9\u05E8\u05D5\u05D8 ", isOther ? _jsx("span", { className: "req", children: "\u05D7\u05D5\u05D1\u05D4" }) : _jsx("span", { className: "req", children: "\u05DC\u05D0 \u05D7\u05D5\u05D1\u05D4" })] }), _jsx("input", { className: "input", value: note, onChange: (e) => { setNote(e.target.value); setErr(''); }, placeholder: "\u05DC\u05DE\u05E9\u05DC: \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E0\u05D3\u05D7\u05D4 \u05DC\u05E9\u05D1\u05D5\u05E2 \u05D4\u05D1\u05D0" })] }), err && _jsx("p", { className: "cform__err", role: "alert", children: err }), _jsxs("div", { className: "udialog__actions", children: [_jsx(Button, { variant: "danger", type: "submit", children: "\u05D1\u05D8\u05DC \u05D0\u05EA \u05D4\u05D4\u05D6\u05DE\u05E0\u05D4" }), _jsx(Button, { variant: "ghost", type: "button", onClick: onClose, children: "\u05D7\u05D6\u05E8\u05D4" })] })] }) }));
}
