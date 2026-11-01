import { Fragment as _Fragment, jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
/* מיזוג לקוחות (אפיון 6.5): כל ההזמנות עוברות ללקוח אחד, עם אישור ותיעוד ביומן. */
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, GitMerge } from 'lucide-react';
import { mergeCustomers, primaryContact } from '../../data/customers';
import { Button, Field } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, fmtPhone } from '../../lib/format';
import { isSimilar } from '../../lib/names';
export function MergeDialog({ source, all, onClose, onMerged }) {
    const toast = useToast();
    const [q, setQ] = useState('');
    const [target, setTarget] = useState(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const candidates = all.filter((c) => c.id !== source.id && c.status !== 'merged');
    const suggested = candidates.filter((c) => isSimilar(c.name, source.name) || (source.taxId && c.taxId === source.taxId));
    const list = (q.trim() ? candidates.filter((c) => c.name.includes(q.trim()) || c.taxId.includes(q.replace(/\D/g, '') || '~')) : suggested).slice(0, 8);
    const run = async () => {
        if (!target)
            return;
        setBusy(true);
        try {
            await mergeCustomers(source, target, note.trim());
            toast({ message: _jsxs(_Fragment, { children: ["\"", source.name, "\" \u05DE\u05D5\u05D6\u05D2 \u05DC\u05EA\u05D5\u05DA \"", target.name, "\""] }) });
            onMerged(target);
        }
        catch {
            toast({ message: 'המיזוג נכשל' });
            setBusy(false);
        }
    };
    return (_jsx(Dialog.Root, { open: true, onOpenChange: (o) => !o && onClose(), children: _jsxs(Dialog.Portal, { children: [_jsx(Dialog.Overlay, { className: "cmd-overlay" }), _jsxs(Dialog.Content, { className: "udialog merge", dir: "rtl", "aria-describedby": "merge-desc", children: [_jsxs(Dialog.Title, { className: "udialog__title", children: [_jsx(GitMerge, { size: 18, "aria-hidden": "true", style: { verticalAlign: -3 } }), " \u05DE\u05D9\u05D6\u05D5\u05D2 \u05DC\u05E7\u05D5\u05D7 \u05DB\u05E4\u05D5\u05DC"] }), _jsxs("p", { id: "merge-desc", className: "muted", children: ["\"", source.name, "\" \u05D9\u05D9\u05E1\u05D2\u05E8, \u05D5\u05D0\u05E0\u05E9\u05D9 \u05D4\u05E7\u05E9\u05E8, \u05D4\u05DB\u05EA\u05D5\u05D1\u05D5\u05EA \u05D5\u05D4\u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05E9\u05DC\u05D5 \u05D9\u05E2\u05D1\u05E8\u05D5 \u05DC\u05DC\u05E7\u05D5\u05D7 \u05E9\u05EA\u05D1\u05D7\u05E8. \u05D4\u05E4\u05E2\u05D5\u05DC\u05D4 \u05E0\u05E8\u05E9\u05DE\u05EA \u05D1\u05D9\u05D5\u05DE\u05DF."] }), !target ? (_jsxs(_Fragment, { children: [_jsx(Field, { label: "\u05DC\u05D0\u05D9\u05D6\u05D4 \u05DC\u05E7\u05D5\u05D7 \u05DC\u05DE\u05D6\u05D2?", children: _jsx("input", { className: "input", autoFocus: true, value: q, onChange: (e) => setQ(e.target.value), placeholder: "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05DC\u05E4\u05D9 \u05E9\u05DD \u05D0\u05D5 \u05D7.\u05E4" }) }), !q && suggested.length > 0 && _jsx("p", { className: "merge__hint", children: "\u05DC\u05E7\u05D5\u05D7\u05D5\u05EA \u05D3\u05D5\u05DE\u05D9\u05DD \u05E9\u05DE\u05E6\u05D0\u05E0\u05D5:" }), _jsxs("ul", { className: "merge__list", children: [list.map((c) => {
                                            const pc = primaryContact(c);
                                            return (_jsx("li", { children: _jsxs("button", { onClick: () => setTarget(c), children: [_jsx("b", { children: c.name }), _jsxs("span", { className: "muted", children: [c.taxId && _jsxs(_Fragment, { children: ["\u05D7.\u05E4 ", _jsx(Ltr, { children: c.taxId }), " \u00B7 "] }), pc?.phone && _jsx(Ltr, { children: fmtPhone(pc.phone) })] })] }) }, c.id));
                                        }), list.length === 0 && _jsx("li", { className: "muted merge__none", children: q ? 'לא נמצא לקוח' : 'הקלד שם כדי לחפש' })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "merge__preview", children: [_jsx("span", { className: "merge__from", children: source.name }), _jsx(ArrowLeft, { size: 18, "aria-hidden": "true" }), _jsx("span", { className: "merge__to", children: target.name })] }), _jsx(Field, { label: "\u05E1\u05D9\u05D1\u05D4 (\u05DC\u05D0 \u05D7\u05D5\u05D1\u05D4)", children: _jsx("input", { className: "input", autoFocus: true, value: note, onChange: (e) => setNote(e.target.value), placeholder: "\u05E0\u05E4\u05EA\u05D7 \u05E4\u05E2\u05DE\u05D9\u05D9\u05DD \u05D1\u05D8\u05E2\u05D5\u05EA" }) }), _jsxs("div", { className: "udialog__actions", children: [_jsx(Button, { variant: "primary", loading: busy, onClick: run, children: "\u05DE\u05D6\u05D2" }), _jsx(Button, { variant: "ghost", onClick: () => setTarget(null), children: "\u05D1\u05D7\u05E8 \u05DC\u05E7\u05D5\u05D7 \u05D0\u05D7\u05E8" })] })] }))] })] }) }));
}
