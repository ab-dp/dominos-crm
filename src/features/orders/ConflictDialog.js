import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/* שמירה שהתנגשה (אפיון 8): מישהו אחר שינה את אותו שדה בזמן שערכת. מוצגת השוואה – מה היה, מה הוא שמר, מה אתה רצית –
   ובוחרים מה להשאיר. שום דבר לא נדרס בלי החלטה. */
import * as Dialog from '@radix-ui/react-dialog';
import { GitCompareArrows, X } from 'lucide-react';
import { useStore } from '../../data/store';
import { Button } from '../../design/components';
import { Ltr } from '../../lib/format';
import { keepOpenOnToast } from '../../app/ErrorBoundary';
import { FIELD, showVal } from './OrderPanel';
import './StatusDialogs.css';
export function ConflictDialog() {
    const { conflict, resolveConflict } = useStore();
    if (!conflict)
        return null;
    const { error } = conflict;
    const who = error.byName || 'משתמש אחר';
    return (_jsx(Dialog.Root, { open: true, onOpenChange: (v) => !v && resolveConflict(false), children: _jsxs(Dialog.Portal, { children: [_jsx(Dialog.Overlay, { className: "cmd-overlay" }), _jsxs(Dialog.Content, { className: "udialog sdialog cdialog", dir: "rtl", "aria-describedby": "cdialog-sub", onPointerDownOutside: keepOpenOnToast, onInteractOutside: keepOpenOnToast, children: [_jsxs("div", { className: "sdialog__head", children: [_jsxs(Dialog.Title, { className: "udialog__title", children: [_jsx(GitCompareArrows, { size: 18, "aria-hidden": "true", style: { verticalAlign: -3 } }), " ", who, " \u05E9\u05D9\u05E0\u05D4 \u05D0\u05EA \u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05D1\u05D9\u05E0\u05EA\u05D9\u05D9\u05DD"] }), _jsx(Dialog.Close, { asChild: true, children: _jsx("button", { className: "icon-btn", "aria-label": "\u05E1\u05D2\u05D5\u05E8", children: _jsx(X, { size: 18 }) }) })] }), _jsxs("p", { id: "cdialog-sub", className: "sdialog__sub", children: ["\u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: error.current.id }), " \u00B7 \u05D4\u05E9\u05D9\u05E0\u05D5\u05D9 \u05E9\u05DC\u05DA \u05E2\u05D5\u05D3 \u05DC\u05D0 \u05E0\u05E9\u05DE\u05E8. \u05D1\u05D7\u05E8 \u05DE\u05D4 \u05DC\u05D4\u05E9\u05D0\u05D9\u05E8:"] }), _jsxs("table", { className: "cdialog__table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u05E9\u05D3\u05D4" }), _jsx("th", { children: "\u05D4\u05D9\u05D4" }), _jsxs("th", { children: [who, " \u05E9\u05DE\u05E8"] }), _jsx("th", { children: "\u05D0\u05EA\u05D4 \u05E8\u05E6\u05D9\u05EA" })] }) }), _jsx("tbody", { children: error.fields.map((f) => (_jsxs("tr", { children: [_jsx("th", { scope: "row", children: FIELD[String(f.key)] ?? String(f.key) }), _jsx("td", { className: "cdialog__base", children: showVal(String(f.key), f.base) }), _jsx("td", { className: "cdialog__theirs", children: showVal(String(f.key), f.theirs) }), _jsx("td", { className: "cdialog__mine", children: showVal(String(f.key), f.mine) })] }, String(f.key)))) })] }), _jsxs("div", { className: "udialog__actions", children: [_jsxs(Button, { variant: "primary", autoFocus: true, onClick: () => resolveConflict(false), children: ["\u05D4\u05E9\u05D0\u05E8 \u05D0\u05EA \u05D4\u05E9\u05D9\u05E0\u05D5\u05D9 \u05E9\u05DC ", who] }), _jsx(Button, { variant: "secondary", onClick: () => resolveConflict(true), children: "\u05E9\u05DE\u05D5\u05E8 \u05D0\u05EA \u05E9\u05DC\u05D9 \u05D1\u05DE\u05E7\u05D5\u05DD" })] })] })] }) }));
}
