import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/* בחירת סניף בתוך הזמנה (אפיון 6.10): רשימה עם חיפוש תוך כדי הקלדה, כל סניף עם האשכול שלו,
   הסניף המועדף ראשון, ובתחתית "+ הוסף סניף / אשכול חדש" – בלי לצאת מהטופס. */
import { useId, useMemo, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, ChevronDown, Plus, Star } from 'lucide-react';
import { addBranch, addCluster, useBranches, useClusters } from '../../data/branches';
import { Button, Field } from '../../design/components';
import { useToast } from '../../design/Toast';
import { cleanPhone, findSimilar, phoneError } from '../../lib/names';
import { DupePrompt } from './BranchesPage';
import './BranchPicker.css';
export function BranchPicker({ value, onChange, preferredId, label = 'סניף' }) {
    const { items: branches } = useBranches();
    const { items: clusters } = useClusters();
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const [active, setActive] = useState(0);
    const [adding, setAdding] = useState(null);
    const listId = useId();
    const inputRef = useRef(null);
    const clusterName = (id) => clusters.find((c) => c.id === id)?.name ?? '';
    const selected = branches.find((b) => b.id === value?.branchId);
    const options = useMemo(() => {
        const s = q.trim();
        const list = branches.filter((b) => b.active && (!s || b.name.includes(s) || clusterName(b.clusterId).includes(s)));
        return list.sort((a, b) => (a.id === preferredId ? -1 : b.id === preferredId ? 1 : a.name.localeCompare(b.name, 'he')));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branches, clusters, q, preferredId]);
    const total = options.length + 1;
    const pick = (i) => {
        if (i < options.length) {
            const b = options[i];
            onChange({ branchId: b.id, clusterId: b.clusterId });
            setOpen(false);
            setQ('');
        }
        else {
            setOpen(false);
            setAdding(q.trim());
        }
    };
    return (_jsxs("div", { className: "bpick", children: [_jsx("span", { className: "field__label", id: `${listId}-label`, children: label }), _jsxs(Popover.Root, { open: open, onOpenChange: (o) => { setOpen(o); if (!o)
                    setQ(''); }, children: [_jsx(Popover.Trigger, { asChild: true, children: _jsxs("button", { type: "button", className: "bpick__trigger", "aria-labelledby": `${listId}-label`, "aria-haspopup": "listbox", "aria-expanded": open, children: [selected ? (_jsxs("span", { className: "bpick__value", children: [_jsx("b", { children: selected.name }), _jsx("span", { className: "bpick__cluster", children: clusterName(selected.clusterId) })] })) : _jsx("span", { className: "bpick__placeholder", children: "\u05D1\u05D7\u05E8 \u05E1\u05E0\u05D9\u05E3\u2026" }), _jsx(ChevronDown, { size: 16, "aria-hidden": "true" })] }) }), _jsx(Popover.Portal, { children: _jsxs(Popover.Content, { className: "pop bpick__pop", align: "start", sideOffset: 4, dir: "rtl", onOpenAutoFocus: (e) => { e.preventDefault(); inputRef.current?.focus(); }, children: [_jsx("input", { ref: inputRef, className: "input input--sm", value: q, onChange: (e) => { setQ(e.target.value); setActive(0); }, placeholder: "\u05D4\u05E7\u05DC\u05D3 \u05E9\u05DD \u05E1\u05E0\u05D9\u05E3 \u05D0\u05D5 \u05D0\u05E9\u05DB\u05D5\u05DC", role: "combobox", "aria-expanded": "true", "aria-controls": listId, "aria-activedescendant": `${listId}-${active}`, "aria-label": "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05E1\u05E0\u05D9\u05E3", onKeyDown: (e) => {
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
                                    } }), _jsxs("ul", { className: "bpick__list", id: listId, role: "listbox", "aria-label": "\u05E1\u05E0\u05D9\u05E4\u05D9\u05DD", children: [options.map((b, i) => (_jsxs("li", { id: `${listId}-${i}`, role: "option", "aria-selected": value?.branchId === b.id, className: `bpick__opt ${active === i ? 'is-active' : ''}`, onMouseEnter: () => setActive(i), onClick: () => pick(i), children: [_jsx("span", { className: "bpick__check", children: value?.branchId === b.id && _jsx(Check, { size: 14 }) }), _jsx("span", { className: "bpick__name", children: b.name }), b.id === preferredId && _jsxs("span", { className: "bpick__pref", children: [_jsx(Star, { size: 12, "aria-hidden": "true" }), " \u05DE\u05D5\u05E2\u05D3\u05E3"] }), _jsx("span", { className: "bpick__cluster", children: clusterName(b.clusterId) })] }, b.id))), options.length === 0 && _jsx("li", { className: "bpick__none", children: q ? `לא נמצא סניף בשם "${q}"` : 'אין עדיין סניפים פעילים' }), _jsxs("li", { id: `${listId}-${options.length}`, role: "option", "aria-selected": false, className: `bpick__opt bpick__add ${active === options.length ? 'is-active' : ''}`, onMouseEnter: () => setActive(options.length), onClick: () => pick(options.length), children: [_jsx(Plus, { size: 16, "aria-hidden": "true" }), " \u05D4\u05D5\u05E1\u05E3 \u05E1\u05E0\u05D9\u05E3 / \u05D0\u05E9\u05DB\u05D5\u05DC \u05D7\u05D3\u05E9", q && _jsxs(_Fragment, { children: [" \u00B7 \"", q, "\""] })] })] })] }) })] }), adding !== null && (_jsx(QuickAddBranch, { initialName: adding, branches: branches, onClose: () => setAdding(null), onAdded: (b) => { onChange(b); setAdding(null); } }))] }));
}
/* חלון קטן: שם הסניף (מולא ממה שהוקלד) · אשכול מהרשימה או "+ אשכול חדש" באותו חלון */
function QuickAddBranch({ initialName, branches, onClose, onAdded }) {
    const { items: clusters } = useClusters();
    const toast = useToast();
    const active = clusters.filter((c) => c.active);
    const [name, setName] = useState(initialName);
    const [clusterId, setClusterId] = useState(active[0]?.id ?? '__new');
    const [newCluster, setNewCluster] = useState('');
    const [phone, setPhone] = useState('');
    const [err, setErr] = useState('');
    const [dupe, setDupe] = useState(null);
    const [clusterDupe, setClusterDupe] = useState(null);
    const [busy, setBusy] = useState(false);
    const isNewCluster = clusterId === '__new' || active.length === 0;
    const save = async (force = false) => {
        if (!name.trim())
            return setErr('חובה: שם הסניף');
        if (isNewCluster && !newCluster.trim())
            return setErr('חובה: שם האשכול החדש');
        const pErr = phoneError(phone);
        if (pErr)
            return setErr(pErr);
        if (!force) {
            const sb = findSimilar(name, branches);
            if (sb)
                return setDupe(sb);
            if (isNewCluster) {
                const sc = findSimilar(newCluster, clusters);
                if (sc)
                    return setClusterDupe(sc);
            }
        }
        setBusy(true);
        try {
            const cid = isNewCluster ? await addCluster(newCluster) : clusterId;
            const id = await addBranch({ name, clusterId: cid, phone: cleanPhone(phone) }, 'form');
            toast({ message: _jsxs(_Fragment, { children: ["\u05E1\u05E0\u05D9\u05E3 \"", name.trim(), "\" \u05E0\u05D5\u05E1\u05E3 \u05D5\u05E0\u05D1\u05D7\u05E8 \u05D1\u05D4\u05D6\u05DE\u05E0\u05D4"] }) });
            onAdded({ branchId: id, clusterId: cid });
        }
        catch {
            setErr('השמירה נכשלה – אין הרשאה או אין חיבור');
            setBusy(false);
        }
    };
    return (_jsx(Dialog.Root, { open: true, onOpenChange: (o) => !o && onClose(), children: _jsxs(Dialog.Portal, { children: [_jsx(Dialog.Overlay, { className: "cmd-overlay" }), _jsxs(Dialog.Content, { className: "udialog", dir: "rtl", "aria-describedby": "qab-desc", children: [_jsx(Dialog.Title, { className: "udialog__title", children: "\u05E1\u05E0\u05D9\u05E3 \u05D7\u05D3\u05E9" }), _jsx("p", { id: "qab-desc", className: "muted", children: "\u05D4\u05E1\u05E0\u05D9\u05E3 \u05E0\u05D5\u05E1\u05E3 \u05DC\u05E8\u05E9\u05D9\u05DE\u05D4 \u05D4\u05E7\u05D1\u05D5\u05E2\u05D4 \u05D5\u05E0\u05D1\u05D7\u05E8 \u05D1\u05D4\u05D6\u05DE\u05E0\u05D4 \u05DE\u05D9\u05D3." }), _jsxs("form", { onSubmit: (e) => { e.preventDefault(); e.stopPropagation(); save(); }, children: [_jsx(Field, { label: "\u05E9\u05DD \u05D4\u05E1\u05E0\u05D9\u05E3 (\u05D7\u05D5\u05D1\u05D4)", children: _jsx("input", { className: "input", autoFocus: true, value: name, onChange: (e) => { setName(e.target.value); setErr(''); setDupe(null); }, placeholder: "\u05E2\u05D9\u05E8 \u2013 \u05E8\u05D7\u05D5\u05D1" }) }), dupe && (_jsx(DupePrompt, { existing: dupe.name, kind: "\u05E1\u05E0\u05D9\u05E3", onUseExisting: () => onAdded({ branchId: dupe.id, clusterId: dupe.clusterId }), onCreateAnyway: () => { setDupe(null); save(true); } })), _jsx(Field, { label: "\u05D0\u05E9\u05DB\u05D5\u05DC (\u05D7\u05D5\u05D1\u05D4)", children: _jsxs("select", { className: "input", value: isNewCluster ? '__new' : clusterId, onChange: (e) => { setClusterId(e.target.value); setErr(''); }, children: [active.map((c) => _jsx("option", { value: c.id, children: c.name }, c.id)), _jsx("option", { value: "__new", children: "+ \u05D0\u05E9\u05DB\u05D5\u05DC \u05D7\u05D3\u05E9" })] }) }), isNewCluster && (_jsx(Field, { label: "\u05E9\u05DD \u05D4\u05D0\u05E9\u05DB\u05D5\u05DC \u05D4\u05D7\u05D3\u05E9", children: _jsx("input", { className: "input", value: newCluster, onChange: (e) => { setNewCluster(e.target.value); setClusterDupe(null); setErr(''); }, placeholder: "\u05DC\u05DE\u05E9\u05DC \u05E9\u05E8\u05D5\u05DF" }) })), clusterDupe && (_jsx(DupePrompt, { existing: clusterDupe.name, kind: "\u05D0\u05E9\u05DB\u05D5\u05DC", onUseExisting: () => { setClusterId(clusterDupe.id); setClusterDupe(null); setNewCluster(''); }, onCreateAnyway: () => { setClusterDupe(null); save(true); } })), _jsx(Field, { label: "\u05D8\u05DC\u05E4\u05D5\u05DF (\u05DC\u05D0 \u05D7\u05D5\u05D1\u05D4)", children: _jsx("input", { className: "input input--ltr", inputMode: "tel", value: phone, onChange: (e) => { setPhone(e.target.value); setErr(''); }, placeholder: "03-1234567" }) }), err && _jsx("p", { className: "pop__err", role: "alert", children: err }), _jsxs("div", { className: "udialog__actions", children: [_jsx(Button, { type: "submit", variant: "primary", loading: busy, children: "\u05D4\u05D5\u05E1\u05E3 \u05D5\u05D1\u05D7\u05E8" }), _jsx(Dialog.Close, { asChild: true, children: _jsx(Button, { type: "button", variant: "ghost", children: "\u05D1\u05D9\u05D8\u05D5\u05DC" }) })] })] })] })] }) }));
}
