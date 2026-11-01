import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/* שינוי אחרי אישור (אפיון 4.5, 8): שינוי בשדה רגיש בהזמנה שכבר אושרה, הועברה ל-Q או אושרה בסניף.
   לפני השמירה: מה משתנה, ומה צריך לעדכן בעקבותיו. אישורים שכבר לא תקפים מסומנים לבדיקה מחדש – לא נמחקים בשקט.
   ההזמנה מקבלת תג "שונתה לאחר אישור" עם הערכים כפי שאושרו. */
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CircleAlert, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { SENSITIVE, useStore } from '../../data/store';
import { Button } from '../../design/components';
import { Ltr, fmtPhone } from '../../lib/format';
import { keepOpenOnToast } from '../../app/ErrorBoundary';
import { FIELD, showVal } from './OrderPanel';
import './StatusDialogs.css';
export function ChangeDialog() {
    const { changeReq, endChange } = useStore();
    if (!changeReq)
        return null;
    return _jsx(ChangeForm, { onClose: endChange }, changeReq.order.id);
}
function ChangeForm({ onClose }) {
    const { changeReq, update } = useStore();
    const { profile } = useAuth();
    const { order: o, patch, what } = changeReq;
    const keys = Object.keys(patch).filter((k) => JSON.stringify(o[k]) !== JSON.stringify(patch[k]));
    const sensitive = keys.filter((k) => SENSITIVE.includes(k));
    // הסניף צריך לדעת על כל שינוי במועד, במקום, באספקה או בפריטים; שינוי סכום בלבד הוא עניין של חיוב
    const affectsBranch = !!o.branchApproval && sensitive.some((k) => k !== 'amount');
    const affectsQ = !!o.qNumber;
    const [resetBranch, setResetBranch] = useState(affectsBranch);
    const [flagQ, setFlagQ] = useState(affectsQ);
    const [askCustomer, setAskCustomer] = useState(false);
    const branchChanged = keys.includes('branchId');
    const save = () => {
        const prevBefore = o.changedAfterApproval?.before ?? {};
        const before = { ...Object.fromEntries(sensitive.map((k) => [k, o[k] ?? null])), ...prevBefore }; // נשמרים הערכים כפי שאושרו לראשונה
        const fields = [...new Set([...(o.changedAfterApproval?.fields ?? []), ...sensitive.map(String)])];
        update(o.id, {
            ...patch,
            changedAfterApproval: { at: new Date().toISOString(), by: profile?.name ?? '', fields, before },
            ...(resetBranch ? { branchApproval: undefined } : {}),
            ...(flagQ ? { qNeedsUpdate: true } : {}),
            ...(askCustomer && o.status === 'approved' ? { status: 'pending_customer' } : {}),
        }, _jsxs(_Fragment, { children: ["\u05E9\u05D9\u05E0\u05D5\u05D9 \u05D0\u05D7\u05E8\u05D9 \u05D0\u05D9\u05E9\u05D5\u05E8 \u05E0\u05E9\u05DE\u05E8: ", what, " \u00B7 \u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: o.id })] }));
        onClose();
    };
    return (_jsx(Dialog.Root, { open: true, onOpenChange: (v) => !v && onClose(), children: _jsxs(Dialog.Portal, { children: [_jsx(Dialog.Overlay, { className: "cmd-overlay" }), _jsxs(Dialog.Content, { className: "udialog sdialog chdialog", dir: "rtl", "aria-describedby": "chdialog-sub", onPointerDownOutside: keepOpenOnToast, onInteractOutside: keepOpenOnToast, children: [_jsxs("div", { className: "sdialog__head", children: [_jsx(Dialog.Title, { className: "udialog__title", children: "\u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05DB\u05D1\u05E8 \u05D0\u05D5\u05E9\u05E8\u05D4 \u2013 \u05DE\u05D4 \u05E6\u05E8\u05D9\u05DA \u05DC\u05E2\u05D3\u05DB\u05DF?" }), _jsx(Dialog.Close, { asChild: true, children: _jsx("button", { className: "icon-btn", "aria-label": "\u05E1\u05D2\u05D5\u05E8 \u05D1\u05DC\u05D9 \u05DC\u05E9\u05DE\u05D5\u05E8", children: _jsx(X, { size: 18 }) }) })] }), _jsxs("p", { id: "chdialog-sub", className: "sdialog__sub", children: ["\u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: o.id }), " \u00B7 ", o.customerName] }), _jsx("ul", { className: "chdialog__diff", children: sensitive.map((k) => (_jsxs("li", { children: [_jsx("span", { children: FIELD[String(k)] ?? String(k) }), _jsx("span", { className: "chdialog__from", children: showVal(String(k), o[k]) }), _jsx("span", { "aria-hidden": "true", children: "\u2190" }), _jsx("b", { children: showVal(String(k), patch[k]) })] }, String(k)))) }), _jsxs("fieldset", { className: "chdialog__opts", children: [_jsx("legend", { className: "field__label", children: "\u05D1\u05E2\u05E7\u05D1\u05D5\u05EA \u05D4\u05E9\u05D9\u05E0\u05D5\u05D9" }), o.branchApproval && (_jsxs("label", { className: "chdialog__opt", children: [_jsx("input", { type: "checkbox", checked: resetBranch, onChange: (e) => setResetBranch(e.target.checked) }), _jsxs("span", { children: [_jsx("b", { children: "\u05D0\u05D9\u05E9\u05D5\u05E8 \u05D4\u05E1\u05E0\u05D9\u05E3 \u05DC\u05D0 \u05EA\u05E7\u05E3 \u2013 \u05DC\u05D1\u05E7\u05E9 \u05D0\u05D9\u05E9\u05D5\u05E8 \u05DE\u05D7\u05D3\u05E9" }), _jsxs("small", { children: ["\u05D0\u05D5\u05E9\u05E8 \u05E2\"\u05D9 ", o.branchApproval.manager, branchChanged ? ` בסניף ${o.branchName}` : '', ". ", !branchChanged && _jsxs(_Fragment, { children: ["\u05DC\u05D4\u05EA\u05E7\u05E9\u05E8 \u05DC", o.branchName, " \u00B7 ", _jsx(Ltr, { children: fmtPhone(o.branchPhone) })] })] })] })] })), o.qNumber && (_jsxs("label", { className: "chdialog__opt", children: [_jsx("input", { type: "checkbox", checked: flagQ, onChange: (e) => setFlagQ(e.target.checked) }), _jsxs("span", { children: [_jsx("b", { children: "\u05DC\u05E2\u05D3\u05DB\u05DF \u05D0\u05EA \u05D4\u05E9\u05D9\u05E0\u05D5\u05D9 \u05D2\u05DD \u05D1-Q" }), _jsxs("small", { children: ["\u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: o.qNumber }), " \u05D1\u05E7\u05D5\u05E4\u05D4. \u05E2\u05D3 \u05E9\u05DE\u05E1\u05DE\u05E0\u05D9\u05DD \"\u05E2\u05D5\u05D3\u05DB\u05DF \u05D1-Q\" \u05EA\u05D5\u05E4\u05D9\u05E2 \u05DE\u05E9\u05D9\u05DE\u05D4 \u05D1\u05DE\u05E1\u05DA \u05D4\u05D7\u05E8\u05D9\u05D2\u05D9\u05DD."] })] })] })), o.status === 'approved' && (_jsxs("label", { className: "chdialog__opt", children: [_jsx("input", { type: "checkbox", checked: askCustomer, onChange: (e) => setAskCustomer(e.target.checked) }), _jsxs("span", { children: [_jsx("b", { children: "\u05DC\u05D1\u05E7\u05E9 \u05DE\u05D4\u05DC\u05E7\u05D5\u05D7 \u05D0\u05D9\u05E9\u05D5\u05E8 \u05DE\u05D7\u05D3\u05E9" }), _jsx("small", { children: "\u05D4\u05E1\u05D8\u05D8\u05D5\u05E1 \u05D9\u05D7\u05D6\u05D5\u05E8 \u05DC\"\u05DE\u05DE\u05EA\u05D9\u05E0\u05D4 \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8 \u05DC\u05E7\u05D5\u05D7\"." })] })] }))] }), _jsxs("p", { className: "sdialog__warn", children: [_jsx(CircleAlert, { size: 16, "aria-hidden": "true" }), " \u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05EA\u05E1\u05D5\u05DE\u05DF \"\u05E9\u05D5\u05E0\u05EA\u05D4 \u05DC\u05D0\u05D7\u05E8 \u05D0\u05D9\u05E9\u05D5\u05E8\", \u05E2\u05DD \u05D4\u05E2\u05E8\u05DB\u05D9\u05DD \u05DB\u05E4\u05D9 \u05E9\u05D0\u05D5\u05E9\u05E8\u05D5. \u05D4\u05E9\u05D9\u05E0\u05D5\u05D9 \u05E0\u05E8\u05E9\u05DD \u05D1\u05D9\u05D5\u05DE\u05DF."] }), _jsxs("div", { className: "udialog__actions", children: [_jsx(Button, { variant: "primary", onClick: save, children: "\u05E9\u05DE\u05D5\u05E8 \u05D0\u05EA \u05D4\u05E9\u05D9\u05E0\u05D5\u05D9" }), _jsx(Button, { variant: "ghost", onClick: onClose, children: "\u05D1\u05D9\u05D8\u05D5\u05DC" })] })] })] }) }));
}
