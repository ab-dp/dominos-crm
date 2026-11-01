import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/* פעולות מהירות על הזמנה – בשורה, במסך "היום" ובתיק ההזמנה (אפיון 6.2). */
import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { TriangleAlert } from 'lucide-react';
import { Button, Field, MarkAction } from '../../design/components';
import { useStore } from '../../data/store';
import { PAYMENT_LABEL } from '../../data/types';
import { Ltr, fmtMoney } from '../../lib/format';
import { useAuth } from '../../auth/AuthContext';
/* ---------- טפסים קטנים שנפתחים במקום ---------- */
function BranchForm({ o, done }) {
    const { update } = useStore();
    const [name, setName] = useState('');
    const [err, setErr] = useState('');
    if (o.branchApproval) {
        return (_jsxs(_Fragment, { children: [_jsxs("p", { className: "pop__text", children: ["\u05D0\u05D5\u05E9\u05E8 \u05E2\"\u05D9 ", _jsx("b", { children: o.branchApproval.manager })] }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => { update(o.id, { branchApproval: undefined }, _jsxs(_Fragment, { children: ["\u05D0\u05D9\u05E9\u05D5\u05E8 \u05D4\u05E1\u05E0\u05D9\u05E3 \u05D1\u05D5\u05D8\u05DC \u00B7 \u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: o.id })] })); done(); }, children: "\u05D1\u05D8\u05DC \u05D0\u05D9\u05E9\u05D5\u05E8" })] }));
    }
    const submit = (e) => {
        e.preventDefault();
        if (!name.trim()) {
            setErr('חובה: שם המנהל שאישר בסניף');
            return;
        }
        update(o.id, { branchApproval: { manager: name.trim(), at: new Date().toISOString() } }, _jsxs(_Fragment, { children: ["\u05D0\u05D9\u05E9\u05D5\u05E8 \u05E1\u05E0\u05D9\u05E3 \u05E0\u05E9\u05DE\u05E8 \u00B7 ", o.branchName] }));
        done();
    };
    return (_jsxs("form", { onSubmit: submit, children: [_jsxs("p", { className: "pop__text", children: [o.branchName, " \u00B7 ", _jsx(Ltr, { children: o.branchPhone.replace(/(\d{3})(\d+)/, '$1-$2') })] }), _jsx(Field, { label: "\u05E9\u05DD \u05D4\u05DE\u05E0\u05D4\u05DC \u05E9\u05D0\u05D9\u05E9\u05E8 (\u05D7\u05D5\u05D1\u05D4)", children: _jsx("input", { className: "input", autoFocus: true, value: name, onChange: (e) => { setName(e.target.value); setErr(''); }, "aria-invalid": !!err, "aria-describedby": err ? `err-b${o.id}` : undefined }) }), err && _jsx("p", { className: "pop__err", id: `err-b${o.id}`, children: err }), _jsx("div", { className: "pop__row", children: _jsx(Button, { variant: "primary", size: "sm", type: "submit", kbd: "Enter", children: "\u05E1\u05DE\u05DF \u05D0\u05D9\u05E9\u05D5\u05E8" }) })] }));
}
function QForm({ o, done }) {
    const { update } = useStore();
    const [num, setNum] = useState(o.qNumber ?? '');
    const [amt, setAmt] = useState(String(o.qAmount ?? o.amount));
    const [err, setErr] = useState('');
    // כלל 15: העברה ל-Q לפני אישור – אזהרה, לא חסימה
    const early = o.status !== 'approved' || !o.branchApproval;
    const submit = (e) => {
        e.preventDefault();
        if (!num.trim()) {
            setErr('חובה: מספר ההזמנה ב-Q, למשל cs669');
            return;
        }
        const qAmount = Number(amt.replace(/[^\d.]/g, ''));
        update(o.id, { qNumber: num.trim(), qAmount }, qAmount !== o.amount
            ? _jsxs(_Fragment, { children: ["\u05D4\u05D5\u05E2\u05D1\u05E8\u05D4 \u05DC-Q \u00B7 ", _jsx("b", { children: "\u05E4\u05E2\u05E8 \u05DE\u05D5\u05DC Q" }), ": ", _jsx(Ltr, { children: fmtMoney(qAmount) }), " \u05DE\u05D5\u05DC ", _jsx(Ltr, { children: fmtMoney(o.amount) })] })
            : _jsxs(_Fragment, { children: ["\u05D4\u05D5\u05E2\u05D1\u05E8\u05D4 \u05DC-Q \u00B7 ", _jsx(Ltr, { children: num.trim() })] }));
        done();
    };
    return (_jsxs("form", { onSubmit: submit, children: [early && (_jsxs("p", { className: "pop__warn", children: [_jsx(TriangleAlert, { size: 14, "aria-hidden": "true" }), " ", o.status !== 'approved' ? 'ההזמנה עוד לא אושרה ע"י הלקוח' : 'אין אישור סניף', ". \u05D0\u05E4\u05E9\u05E8 \u05DC\u05D4\u05DE\u05E9\u05D9\u05DA."] })), _jsx(Field, { label: "\u05DE\u05E1' \u05D4\u05D6\u05DE\u05E0\u05D4 \u05D1-Q (\u05D7\u05D5\u05D1\u05D4)", children: _jsx("input", { className: "input input--ltr", autoFocus: true, value: num, onChange: (e) => { setNum(e.target.value); setErr(''); }, placeholder: "cs000", "aria-invalid": !!err }) }), _jsx(Field, { label: "\u05E1\u05DB\u05D5\u05DD Q (\u20AA)", hint: `סכום ההזמנה: ${fmtMoney(o.amount)}`, children: _jsx("input", { className: "input input--ltr", inputMode: "decimal", value: amt, onChange: (e) => setAmt(e.target.value) }) }), err && _jsx("p", { className: "pop__err", children: err }), _jsx("div", { className: "pop__row", children: _jsx(Button, { variant: "primary", size: "sm", type: "submit", kbd: "Enter", children: early ? 'סמן בכל זאת' : 'סמן הועברה' }) })] }));
}
function PayForm({ o, done }) {
    const { update } = useStore();
    const choose = (p) => {
        if (p !== o.payment)
            update(o.id, { payment: p }, _jsxs(_Fragment, { children: ["\u05DE\u05E6\u05D1 \u05EA\u05E9\u05DC\u05D5\u05DD: ", PAYMENT_LABEL[p], " \u00B7 \u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: o.id })] }));
        done();
    };
    return (_jsx("div", { className: "pay-options", role: "radiogroup", "aria-label": "\u05DE\u05E6\u05D1 \u05EA\u05E9\u05DC\u05D5\u05DD", children: Object.keys(PAYMENT_LABEL).map((p) => (_jsx("button", { role: "radio", "aria-checked": o.payment === p, className: `pay-opt ${o.payment === p ? 'is-on' : ''}`, onClick: () => choose(p), children: PAYMENT_LABEL[p] }, p))) }));
}
function PoForm({ o, done }) {
    const { update } = useStore();
    const [v, setV] = useState(o.poNumber ?? '');
    return (_jsxs("form", { onSubmit: (e) => { e.preventDefault(); if (!v.trim())
            return; update(o.id, { poNumber: v.trim() }, _jsxs(_Fragment, { children: ["\u05DE\u05E1' \u05EA\u05E2\u05D5\u05D3\u05EA \u05E8\u05DB\u05E9 \u05E0\u05E9\u05DE\u05E8 \u00B7 ", _jsx(Ltr, { children: v.trim() })] })); done(); }, children: [_jsx(Field, { label: "\u05DE\u05E1' \u05EA\u05E2\u05D5\u05D3\u05EA \u05E8\u05DB\u05E9", children: _jsx("input", { className: "input input--ltr", autoFocus: true, value: v, onChange: (e) => setV(e.target.value) }) }), _jsx("div", { className: "pop__row", children: _jsx(Button, { variant: "primary", size: "sm", type: "submit", kbd: "Enter", children: "\u05E9\u05DE\u05D5\u05E8" }) })] }));
}
/* מס' תעודת רכש – לא חובה; אפשר להוסיף או לתקן בכל הזמנה */
export function PoEdit({ o }) {
    const [open, setOpen] = useState(false);
    return (_jsxs(Popover.Root, { open: open, onOpenChange: setOpen, children: [_jsx(Popover.Trigger, { asChild: true, children: _jsx("button", { className: "link", children: o.poNumber ? 'שנה' : 'הוסף' }) }), _jsx(Popover.Portal, { children: _jsxs(Popover.Content, { className: "pop", sideOffset: 6, align: "start", dir: "rtl", children: [_jsx("p", { className: "pop__title", children: "\u05EA\u05E2\u05D5\u05D3\u05EA \u05E8\u05DB\u05E9" }), _jsx(PoForm, { o: o, done: () => setOpen(false) }), _jsx(Popover.Arrow, { className: "pop__arrow" })] }) })] }));
}
/* ---------- שלושת הסימונים ---------- */
export function OrderMarks({ o, only }) {
    const [open, setOpen] = useState(null);
    const set = (k) => (v) => setOpen(v ? k : null);
    const payDone = o.payment === 'paid' || o.payment === 'cancelled';
    const show = (k) => !only || only === k;
    return (_jsxs(_Fragment, { children: [show('branch') && (_jsx(MarkAction, { open: open === 'branch', onOpenChange: set('branch'), done: !!o.branchApproval, label: "\u05E1\u05E0\u05D9\u05E3", srLabel: o.branchApproval ? `אישור סניף: אושר ע"י ${o.branchApproval.manager}` : 'אישור סניף: חסר. לחץ לסימון', title: "\u05D0\u05D9\u05E9\u05D5\u05E8 \u05E1\u05E0\u05D9\u05E3", children: _jsx(BranchForm, { o: o, done: () => setOpen(null) }) })), show('q') && (_jsx(MarkAction, { open: open === 'q', onOpenChange: set('q'), done: !!o.qNumber, label: o.qNumber ? o.qNumber : 'Q', srLabel: o.qNumber ? `הועברה ל-Q, מספר ${o.qNumber}` : 'הועברה ל-Q: חסר. לחץ לסימון', title: "\u05D4\u05D5\u05E2\u05D1\u05E8\u05D4 \u05DC-Q", children: _jsx(QForm, { o: o, done: () => setOpen(null) }) })), show('pay') && (_jsx(MarkAction, { open: open === 'pay', onOpenChange: set('pay'), done: payDone, label: payDone ? PAYMENT_LABEL[o.payment] : 'תשלום', srLabel: `מצב תשלום: ${PAYMENT_LABEL[o.payment]}. לחץ לשינוי`, title: "\u05DE\u05E6\u05D1 \u05EA\u05E9\u05DC\u05D5\u05DD", children: _jsx(PayForm, { o: o, done: () => setOpen(null) }) }))] }));
}
/* ---------- כפתור הפתרון: כל בעיה עם הכפתור שפותר אותה ---------- */
/* פער מול Q (כלל 2): או שמעדכנים את הסכום לחיוב לסכום שבקופה, או מאשרים שהפער מוסבר – עם סיבה */
function GapForm({ o, done }) {
    const { update } = useStore();
    const { profile } = useAuth();
    const [note, setNote] = useState('');
    const [err, setErr] = useState('');
    const q = o.qAmount ?? o.amount;
    const diff = q - o.amount;
    const ack = (e) => {
        e.preventDefault();
        if (!note.trim()) {
            setErr('חובה: למה הפער בסדר (למשל: הנחה שסוכמה בטלפון)');
            return;
        }
        if (/\d{13,}/.test(note)) {
            setErr('אסור לרשום כאן מספר כרטיס אשראי');
            return;
        }
        update(o.id, { qGapAck: { amount: o.amount, qAmount: q, by: profile?.name ?? '', at: new Date().toISOString(), note: note.trim() } }, _jsxs(_Fragment, { children: ["\u05D4\u05E4\u05E2\u05E8 \u05DE\u05D5\u05DC Q \u05D0\u05D5\u05E9\u05E8 \u00B7 \u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: o.id })] }));
        done();
    };
    return (_jsxs("form", { onSubmit: ack, children: [_jsxs("div", { className: "gap-sum", children: [_jsxs("span", { children: ["\u05DC\u05D7\u05D9\u05D5\u05D1 ", _jsx("b", { children: _jsx(Ltr, { children: fmtMoney(o.amount) }) })] }), _jsxs("span", { children: ["\u05D1-Q ", _jsx("b", { children: _jsx(Ltr, { children: fmtMoney(q) }) })] }), _jsxs("span", { className: "gap-sum__diff", children: ["\u05E4\u05E2\u05E8 ", _jsx("b", { children: _jsx(Ltr, { children: `${diff > 0 ? '+' : '−'}${fmtMoney(Math.abs(diff))}` }) })] })] }), _jsxs(Button, { size: "sm", variant: "secondary", type: "button", className: "gap-fix", onClick: () => { update(o.id, { amount: q }, _jsxs(_Fragment, { children: ["\u05D4\u05E1\u05DB\u05D5\u05DD \u05DC\u05D7\u05D9\u05D5\u05D1 \u05E2\u05D5\u05D3\u05DB\u05DF \u05DC\u05E1\u05DB\u05D5\u05DD Q \u00B7 ", _jsx(Ltr, { children: fmtMoney(q) })] })); done(); }, children: ["\u05E2\u05D3\u05DB\u05DF \u05D0\u05EA \u05D4\u05E1\u05DB\u05D5\u05DD \u05DC\u05D7\u05D9\u05D5\u05D1 \u05DC-", _jsx(Ltr, { children: fmtMoney(q) })] }), _jsx("p", { className: "pop__text gap-or", children: "\u05D0\u05D5, \u05D0\u05DD \u05D4\u05E4\u05E2\u05E8 \u05E0\u05DB\u05D5\u05DF:" }), _jsx(Field, { label: "\u05DC\u05DE\u05D4 \u05D4\u05E4\u05E2\u05E8 \u05D1\u05E1\u05D3\u05E8 (\u05D7\u05D5\u05D1\u05D4)", children: _jsx("input", { className: "input", value: note, onChange: (e) => { setNote(e.target.value); setErr(''); }, placeholder: "\u05DC\u05DE\u05E9\u05DC: \u05D4\u05E0\u05D7\u05D4 \u05E9\u05E1\u05D5\u05DB\u05DE\u05D4 \u05DE\u05D5\u05DC \u05D4\u05DC\u05E7\u05D5\u05D7", "aria-invalid": !!err }) }), err && _jsx("p", { className: "pop__err", children: err }), _jsx("div", { className: "pop__row", children: _jsx(Button, { variant: "primary", size: "sm", type: "submit", children: "\u05D0\u05E9\u05E8 \u05E9\u05D4\u05E4\u05E2\u05E8 \u05DE\u05D5\u05E1\u05D1\u05E8" }) })] }));
}
/* בוטלה אחרי Q (כלל 10): אישור שההזמנה בוטלה גם בקופה */
function CancelAckForm({ o, done }) {
    const { update } = useStore();
    const { profile } = useAuth();
    return (_jsxs(_Fragment, { children: [_jsxs("p", { className: "pop__text", children: ["\u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05D1\u05D5\u05D8\u05DC\u05D4 \u05D1\u05DE\u05E2\u05E8\u05DB\u05EA \u05D0\u05D7\u05E8\u05D9 \u05E9\u05D4\u05D5\u05E2\u05D1\u05E8\u05D4 \u05DC\u05E7\u05D5\u05E4\u05D4 (", _jsx(Ltr, { children: o.qNumber }), "). \u05E6\u05E8\u05D9\u05DA \u05DC\u05D5\u05D5\u05D3\u05D0 \u05E9\u05D4\u05D9\u05D0 \u05D1\u05D5\u05D8\u05DC\u05D4 \u05D2\u05DD \u05D1-Q."] }), _jsx("div", { className: "pop__row", children: _jsx(Button, { variant: "primary", size: "sm", onClick: () => { update(o.id, { qCancelAck: { by: profile?.name ?? '', at: new Date().toISOString() } }, _jsxs(_Fragment, { children: ["\u05D0\u05D5\u05E9\u05E8 \u05E9\u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: o.id }), " \u05D1\u05D5\u05D8\u05DC\u05D4 \u05D2\u05DD \u05D1-Q"] })); done(); }, children: "\u05D1\u05D5\u05D8\u05DC\u05D4 \u05D2\u05DD \u05D1-Q" }) })] }));
}
/* שינוי אחרי אישור שעוד לא עודכן בקופה: מסמנים שעודכן, ואם הסכום ב-Q השתנה – רושמים אותו */
function QUpdateForm({ o, done }) {
    const { update } = useStore();
    const [amt, setAmt] = useState(String(o.qAmount ?? o.amount));
    const submit = (e) => {
        e.preventDefault();
        const qAmount = Number(amt.replace(/[^d.]/g, '')) || o.amount;
        update(o.id, { qNeedsUpdate: undefined, qAmount }, _jsxs(_Fragment, { children: ["\u05D4\u05E9\u05D9\u05E0\u05D5\u05D9 \u05E2\u05D5\u05D3\u05DB\u05DF \u05D1-Q \u00B7 \u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: o.id })] }));
        done();
    };
    return (_jsxs("form", { onSubmit: submit, children: [_jsxs("p", { className: "pop__text", children: ["\u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05E9\u05D5\u05E0\u05EA\u05D4 \u05D0\u05D7\u05E8\u05D9 \u05E9\u05D4\u05D5\u05E2\u05D1\u05E8\u05D4 \u05DC\u05E7\u05D5\u05E4\u05D4 (", _jsx(Ltr, { children: o.qNumber }), ")."] }), _jsx(Field, { label: "\u05E1\u05DB\u05D5\u05DD \u05D1-Q \u05D0\u05D7\u05E8\u05D9 \u05D4\u05E2\u05D3\u05DB\u05D5\u05DF (\u20AA)", hint: `לחיוב: ${fmtMoney(o.amount)}`, children: _jsx("input", { className: "input input--ltr", inputMode: "decimal", autoFocus: true, value: amt, onChange: (e) => setAmt(e.target.value) }) }), _jsx("div", { className: "pop__row", children: _jsx(Button, { variant: "primary", size: "sm", type: "submit", children: "\u05E2\u05D5\u05D3\u05DB\u05DF \u05D1-Q" }) })] }));
}
export function FixButton({ o, issue, onOpen }) {
    const { update } = useStore();
    const [open, setOpen] = useState(false);
    const pop = (content, title) => (_jsxs(Popover.Root, { open: open, onOpenChange: setOpen, children: [_jsx(Popover.Trigger, { asChild: true, children: _jsx(Button, { size: "sm", variant: "fix", onClick: (e) => e.stopPropagation(), children: issue.actionLabel }) }), _jsx(Popover.Portal, { children: _jsxs(Popover.Content, { className: "pop", sideOffset: 6, align: "end", dir: "rtl", onClick: (e) => e.stopPropagation(), onKeyDown: (e) => e.stopPropagation(), children: [_jsx("p", { className: "pop__title", children: title }), content, _jsx(Popover.Arrow, { className: "pop__arrow" })] }) })] }));
    const done = () => setOpen(false);
    switch (issue.action) {
        case 'branch': return pop(_jsx(BranchForm, { o: o, done: done }), 'אישור סניף');
        case 'q': return pop(_jsx(QForm, { o: o, done: done }), 'הועברה ל-Q');
        case 'pay': return pop(_jsx(PayForm, { o: o, done: done }), 'מצב תשלום');
        case 'po': return pop(_jsx(PoForm, { o: o, done: done }), 'תעודת רכש');
        case 'ackGap': return pop(_jsx(GapForm, { o: o, done: done }), 'פער מול Q');
        case 'ackCancel': return pop(_jsx(CancelAckForm, { o: o, done: done }), 'בוטלה אחרי Q');
        case 'ackQUpdate': return pop(_jsx(QUpdateForm, { o: o, done: done }), 'עדכון ב-Q');
        case 'close':
            return _jsx(Button, { size: "sm", variant: "fix", onClick: (e) => { e.stopPropagation(); update(o.id, { status: 'delivered' }, _jsxs(_Fragment, { children: ["\u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: o.id }), " \u05E1\u05D5\u05DE\u05E0\u05D4 \u05DB\u05E1\u05D5\u05E4\u05E7\u05D4 \u05D5\u05E2\u05D1\u05E8\u05D4 \u05DC\u05D0\u05E8\u05DB\u05D9\u05D5\u05DF"] })); }, children: issue.actionLabel });
        case 'status':
            return _jsx(Button, { size: "sm", variant: "fix", onClick: (e) => { e.stopPropagation(); update(o.id, { status: 'approved' }, _jsxs(_Fragment, { children: ["\u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: o.id }), " \u00B7 \u05E1\u05D8\u05D8\u05D5\u05E1: \u05D0\u05D5\u05E9\u05E8\u05D4"] })); }, children: "\u05E1\u05DE\u05DF \u05D0\u05D5\u05E9\u05E8\u05D4" });
        default:
            return _jsx(Button, { size: "sm", variant: "fix", onClick: (e) => { e.stopPropagation(); onOpen(); }, children: issue.actionLabel });
    }
}
