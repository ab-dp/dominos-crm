import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/* סניפים ואשכולות (אפיון 6.10): שתי רשימות זו לצד זו. לחיצה על אשכול מסננת את הסניפים שלו.
   עריכה בתוך השורה: Enter שומר, Esc מבטל. אין מחיקה – רק "לא פעיל". */
import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Layers, Pencil, Plus, Search, Store, X } from 'lucide-react';
import { addBranch, addCluster, updateBranch, updateCluster, useBranches, useClusters } from '../../data/branches';
import { Button, EmptyState, Skeleton, Tip } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, fmtPhone } from '../../lib/format';
import { cleanPhone, findSimilar, phoneError } from '../../lib/names';
import '../pages.css';
import './BranchesPage.css';
export function BranchesPage() {
    const clusters = useClusters();
    const branches = useBranches();
    const [selected, setSelected] = useState(null);
    const [showInactive, setShowInactive] = useState(false);
    const [query, setQuery] = useState('');
    const countBy = useMemo(() => {
        const m = {};
        branches.items.forEach((b) => { if (b.active)
            m[b.clusterId] = (m[b.clusterId] ?? 0) + 1; });
        return m;
    }, [branches.items]);
    const visibleBranches = branches.items
        .filter((b) => showInactive || b.active)
        .filter((b) => !selected || b.clusterId === selected)
        .filter((b) => !query.trim() || b.name.includes(query.trim()) || b.phone.includes(cleanPhone(query)));
    const error = clusters.error || branches.error;
    return (_jsxs("div", { className: "page", children: [_jsx("header", { className: "page__head", children: _jsxs("div", { children: [_jsx("h1", { className: "page__title", children: "\u05E1\u05E0\u05D9\u05E4\u05D9\u05DD \u05D5\u05D0\u05E9\u05DB\u05D5\u05DC\u05D5\u05EA" }), _jsx("p", { className: "page__sub", children: "\u05D4\u05E8\u05E9\u05D9\u05DE\u05D4 \u05E0\u05D1\u05E0\u05D9\u05EA \u05D9\u05D3\u05E0\u05D9\u05EA \u05D5\u05DB\u05DC \u05D4\u05DE\u05E9\u05EA\u05DE\u05E9\u05D9\u05DD \u05D9\u05DB\u05D5\u05DC\u05D9\u05DD \u05DC\u05D4\u05D5\u05E1\u05D9\u05E3. \u05E1\u05E0\u05D9\u05E3 \u05DC\u05D0 \u05E4\u05E2\u05D9\u05DC \u05E0\u05E2\u05DC\u05DD \u05DE\u05D1\u05D7\u05D9\u05E8\u05D4 \u05D1\u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05D7\u05D3\u05E9\u05D5\u05EA, \u05D0\u05D1\u05DC \u05E0\u05E9\u05D0\u05E8 \u05D1\u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05D4\u05D9\u05E9\u05E0\u05D5\u05EA \u05D5\u05D1\u05D3\u05D5\u05D7\u05D5\u05EA." })] }) }), error ? _jsx("div", { className: "card", children: _jsxs(EmptyState, { icon: _jsx(Store, { size: 24 }), title: "\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05D8\u05E2\u05D5\u05DF", children: [error, ". \u05D5\u05D3\u05D0 \u05E9\u05DB\u05DC\u05DC\u05D9 \u05D4\u05D0\u05D1\u05D8\u05D7\u05D4 \u05E4\u05D5\u05E8\u05E1\u05DE\u05D5."] }) }) : (_jsxs("div", { className: "br-grid", children: [_jsx(ClustersCard, { clusters: clusters.items, loading: clusters.loading, countBy: countBy, selected: selected, onSelect: setSelected }), _jsx(BranchesCard, { clusters: clusters.items, allBranches: branches.items, branches: visibleBranches, loading: branches.loading, selected: selected, onClearSelected: () => setSelected(null), showInactive: showInactive, setShowInactive: setShowInactive, query: query, setQuery: setQuery })] }))] }));
}
/* ================= אשכולות ================= */
function ClustersCard({ clusters, loading, countBy, selected, onSelect }) {
    const toast = useToast();
    const [adding, setAdding] = useState(false);
    const [editing, setEditing] = useState(null);
    const reduce = useReducedMotion();
    const total = Object.values(countBy).reduce((a, b) => a + b, 0);
    const saveNew = async (name) => {
        const id = await addCluster(name);
        setAdding(false);
        onSelect(id);
        toast({ message: _jsxs(_Fragment, { children: ["\u05D0\u05E9\u05DB\u05D5\u05DC \"", name, "\" \u05E0\u05D5\u05E1\u05E3"] }) });
    };
    return (_jsxs("section", { className: "card br-clusters", "aria-labelledby": "h-clusters", children: [_jsxs("div", { className: "card__head", children: [_jsx(Layers, { size: 18, "aria-hidden": "true", className: "muted" }), _jsx("h2", { id: "h-clusters", className: "card__title", children: "\u05D0\u05E9\u05DB\u05D5\u05DC\u05D5\u05EA" }), _jsx("span", { className: "muted", children: _jsx(Ltr, { children: clusters.filter((c) => c.active).length }) }), _jsx(Button, { size: "sm", variant: "secondary", icon: _jsx(Plus, { size: 16 }), className: "card__head-end", onClick: () => setAdding(true), disabled: adding, children: "\u05D0\u05E9\u05DB\u05D5\u05DC" })] }), _jsxs("ul", { className: "clist", role: "list", children: [_jsx(AnimatePresence, { initial: false, children: adding && (_jsx(motion.li, { initial: reduce ? false : { opacity: 0, height: 0 }, animate: { opacity: 1, height: 'auto' }, exit: { opacity: 0, height: 0 }, children: _jsx(NameEditor, { placeholder: "\u05E9\u05DD \u05D4\u05D0\u05E9\u05DB\u05D5\u05DC, \u05DC\u05DE\u05E9\u05DC \u05E6\u05E4\u05D5\u05DF", list: clusters, kind: "\u05D0\u05E9\u05DB\u05D5\u05DC", onSave: saveNew, onCancel: () => setAdding(false), onPickExisting: (c) => { setAdding(false); onSelect(c.id); } }) }, "new")) }), _jsx("li", { children: _jsxs("button", { className: `citem ${selected === null ? 'is-on' : ''}`, "aria-pressed": selected === null, onClick: () => onSelect(null), children: [_jsx("span", { className: "citem__name", children: "\u05DB\u05DC \u05D4\u05D0\u05E9\u05DB\u05D5\u05DC\u05D5\u05EA" }), _jsxs("span", { className: "citem__count", children: [_jsx(Ltr, { children: total }), " \u05E1\u05E0\u05D9\u05E4\u05D9\u05DD"] })] }) }), loading ? [0, 1, 2].map((i) => _jsx("li", { className: "citem-skel", children: _jsx(Skeleton, { h: 18 }) }, i)) : clusters.map((c) => (_jsx("li", { className: c.active ? '' : 'is-inactive', children: editing === c.id ? (_jsx(NameEditor, { initial: c.name, list: clusters, excludeId: c.id, kind: "\u05D0\u05E9\u05DB\u05D5\u05DC", onSave: async (name) => { await updateCluster(c, { name }); setEditing(null); toast({ message: 'שם האשכול עודכן' }); }, onCancel: () => setEditing(null), onPickExisting: () => setEditing(null) })) : (_jsxs("div", { className: "citem-row", children: [_jsxs("button", { className: `citem ${selected === c.id ? 'is-on' : ''}`, "aria-pressed": selected === c.id, onClick: () => onSelect(selected === c.id ? null : c.id), children: [_jsx("span", { className: "citem__name", children: c.name }), !c.active && _jsx("span", { className: "tag-inactive", children: "\u05DC\u05D0 \u05E4\u05E2\u05D9\u05DC" }), _jsxs("span", { className: "citem__count", children: [_jsx(Ltr, { children: countBy[c.id] ?? 0 }), " \u05E1\u05E0\u05D9\u05E4\u05D9\u05DD"] })] }), _jsx(Tip, { label: "\u05E9\u05E0\u05D4 \u05E9\u05DD", children: _jsx("button", { className: "icon-btn icon-btn--sm", "aria-label": `שנה שם לאשכול ${c.name}`, onClick: () => setEditing(c.id), children: _jsx(Pencil, { size: 15 }) }) }), _jsx(ActiveSwitch, { active: c.active, label: `אשכול ${c.name}`, onChange: async (active) => {
                                        await updateCluster(c, { active });
                                        toast({ message: _jsxs(_Fragment, { children: ["\u05D0\u05E9\u05DB\u05D5\u05DC \"", c.name, "\" ", active ? 'הופעל' : 'סומן כלא פעיל'] }), onUndo: () => updateCluster({ ...c, active }, { active: !active }) });
                                    } })] })) }, c.id))), !loading && clusters.length === 0 && !adding && (_jsxs("li", { className: "clist__empty", children: ["\u05E2\u05D5\u05D3 \u05D0\u05D9\u05DF \u05D0\u05E9\u05DB\u05D5\u05DC\u05D5\u05EA. ", _jsx("button", { className: "link", onClick: () => setAdding(true), children: "\u05D4\u05D5\u05E1\u05E3 \u05D0\u05EA \u05D4\u05E8\u05D0\u05E9\u05D5\u05DF" })] }))] })] }));
}
/* ================= סניפים ================= */
function BranchesCard({ clusters, allBranches, branches, loading, selected, onClearSelected, showInactive, setShowInactive, query, setQuery }) {
    const toast = useToast();
    const [adding, setAdding] = useState(false);
    const [editing, setEditing] = useState(null);
    const clusterName = (id) => clusters.find((c) => c.id === id)?.name ?? '—';
    const selectedName = selected ? clusterName(selected) : '';
    const activeClusters = clusters.filter((c) => c.active);
    return (_jsxs("section", { className: "card br-branches", "aria-labelledby": "h-branches", children: [_jsxs("div", { className: "card__head br-branches__head", children: [_jsx(Store, { size: 18, "aria-hidden": "true", className: "muted" }), _jsx("h2", { id: "h-branches", className: "card__title", children: "\u05E1\u05E0\u05D9\u05E4\u05D9\u05DD" }), selected && (_jsxs("button", { className: "chip is-on", onClick: onClearSelected, "aria-label": `הסר סינון אשכול ${selectedName}`, children: ["\u05D0\u05E9\u05DB\u05D5\u05DC ", selectedName, " ", _jsx(X, { size: 14, "aria-hidden": "true" })] })), _jsxs("label", { className: "tablebar__search br-search", children: [_jsx(Search, { size: 16, "aria-hidden": "true" }), _jsx("input", { value: query, onChange: (e) => setQuery(e.target.value), placeholder: "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05E1\u05E0\u05D9\u05E3 \u05D0\u05D5 \u05D8\u05DC\u05E4\u05D5\u05DF", "aria-label": "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05E1\u05E0\u05D9\u05E3" })] }), _jsxs("label", { className: "check-inline", children: [_jsx("input", { type: "checkbox", checked: showInactive, onChange: (e) => setShowInactive(e.target.checked) }), " \u05D4\u05E6\u05D2 \u05DC\u05D0 \u05E4\u05E2\u05D9\u05DC\u05D9\u05DD"] }), _jsx(Tip, { label: activeClusters.length === 0 ? 'קודם צריך להוסיף אשכול' : 'סניף חדש', children: _jsx("span", { children: _jsx(Button, { size: "sm", variant: "primary", icon: _jsx(Plus, { size: 16 }), onClick: () => { setAdding(true); setEditing(null); }, disabled: adding || activeClusters.length === 0, children: "\u05E1\u05E0\u05D9\u05E3" }) }) })] }), _jsxs("div", { className: "otable-wrap br-table-wrap", children: [_jsxs("table", { className: "otable otable--dense br-table", children: [_jsxs("caption", { className: "sr-only", children: ["\u05E1\u05E0\u05D9\u05E4\u05D9\u05DD", selected ? ` באשכול ${selectedName}` : ''] }), _jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u05E9\u05DD \u05D4\u05E1\u05E0\u05D9\u05E3" }), _jsx("th", { children: "\u05D0\u05E9\u05DB\u05D5\u05DC" }), _jsx("th", { children: "\u05D8\u05DC\u05E4\u05D5\u05DF" }), _jsx("th", { children: "\u05DE\u05E6\u05D1" }), _jsx("th", { children: _jsx("span", { className: "sr-only", children: "\u05E4\u05E2\u05D5\u05DC\u05D5\u05EA" }) })] }) }), _jsxs("tbody", { children: [adding && (_jsx(BranchEditRow, { clusters: activeClusters, allBranches: allBranches, initial: { name: query.trim(), clusterId: selected ?? activeClusters[0]?.id ?? '', phone: '' }, onSave: async (v) => { await addBranch(v); setAdding(false); toast({ message: _jsxs(_Fragment, { children: ["\u05E1\u05E0\u05D9\u05E3 \"", v.name, "\" \u05E0\u05D5\u05E1\u05E3 \u05DC\u05D0\u05E9\u05DB\u05D5\u05DC ", clusterName(v.clusterId)] }) }); }, onCancel: () => setAdding(false) }, "new")), loading ? [0, 1, 2, 3].map((i) => _jsx("tr", { children: _jsx("td", { colSpan: 5, children: _jsx(Skeleton, { h: 18 }) }) }, i)) : branches.map((b) => (editing === b.id ? (_jsx(BranchEditRow, { clusters: clusters.filter((c) => c.active || c.id === b.clusterId), allBranches: allBranches, excludeId: b.id, initial: { name: b.name, clusterId: b.clusterId, phone: b.phone }, onSave: async (v) => {
                                            const patch = {};
                                            if (v.name !== b.name)
                                                patch.name = v.name;
                                            if (v.clusterId !== b.clusterId)
                                                patch.clusterId = v.clusterId;
                                            if (v.phone !== b.phone)
                                                patch.phone = v.phone;
                                            if (Object.keys(patch).length) {
                                                await updateBranch(b, patch);
                                                toast({ message: patch.clusterId ? _jsxs(_Fragment, { children: ["\"", v.name, "\" \u05D4\u05D5\u05E2\u05D1\u05E8 \u05DC\u05D0\u05E9\u05DB\u05D5\u05DC ", clusterName(v.clusterId), " \u00B7 \u05DE\u05E9\u05E4\u05D9\u05E2 \u05E8\u05E7 \u05E2\u05DC \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05D7\u05D3\u05E9\u05D5\u05EA"] }) : 'הסניף עודכן' });
                                            }
                                            setEditing(null);
                                        }, onCancel: () => setEditing(null) }, b.id)) : (_jsxs("tr", { className: `brow ${b.active ? '' : 'is-inactive'}`, tabIndex: 0, onKeyDown: (e) => {
                                            if (e.target !== e.currentTarget)
                                                return;
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                setEditing(b.id);
                                                setAdding(false);
                                            }
                                            if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                e.currentTarget.nextElementSibling?.focus();
                                            }
                                            if (e.key === 'ArrowUp') {
                                                e.preventDefault();
                                                e.currentTarget.previousElementSibling?.focus();
                                            }
                                        }, "aria-label": `${b.name}, אשכול ${clusterName(b.clusterId)}${b.active ? '' : ', לא פעיל'}. Enter לעריכה`, children: [_jsx("td", { className: "strong", children: b.name }), _jsx("td", { children: _jsx("span", { className: "cluster-tag", children: clusterName(b.clusterId) }) }), _jsx("td", { className: "num", children: b.phone ? _jsx(Ltr, { children: fmtPhone(b.phone) }) : _jsx("span", { className: "muted", children: "\u2014" }) }), _jsx("td", { children: _jsx(ActiveSwitch, { active: b.active, label: `סניף ${b.name}`, onChange: async (active) => {
                                                        await updateBranch(b, { active });
                                                        toast({ message: _jsxs(_Fragment, { children: ["\"", b.name, "\" ", active ? 'הופעל' : 'סומן כלא פעיל – לא יופיע בהזמנות חדשות'] }), onUndo: () => updateBranch({ ...b, active }, { active: !active }) });
                                                    } }) }), _jsx("td", { className: "br-actions", children: _jsx(Button, { size: "sm", variant: "ghost", icon: _jsx(Pencil, { size: 15 }), onClick: () => { setEditing(b.id); setAdding(false); }, "aria-label": `ערוך את ${b.name}`, children: "\u05E2\u05E8\u05D5\u05DA" }) })] }, b.id))))] })] }), !loading && branches.length === 0 && !adding && (_jsx(EmptyState, { icon: _jsx(Store, { size: 24 }), title: query ? 'לא נמצא סניף מתאים' : selected ? `אין עדיין סניפים באשכול ${selectedName}` : 'עוד אין סניפים', action: activeClusters.length > 0 ? _jsx(Button, { variant: "primary", icon: _jsx(Plus, { size: 18 }), onClick: () => setAdding(true), children: "\u05D4\u05D5\u05E1\u05E3 \u05E1\u05E0\u05D9\u05E3" }) : undefined, children: activeClusters.length === 0 ? 'מתחילים מהוספת אשכול ברשימה מימין, ואז מוסיפים לו סניפים.' : 'סניף חדש דורש שם ואשכול; טלפון – לא חובה.' }))] })] }));
}
/* שורת עריכה של סניף: Enter שומר, Esc מבטל, בדיקת כפילות לפני שמירה */
function BranchEditRow({ clusters, allBranches, excludeId, initial, onSave, onCancel }) {
    const [name, setName] = useState(initial.name);
    const [clusterId, setClusterId] = useState(initial.clusterId);
    const [phone, setPhone] = useState(initial.phone ? fmtPhone(initial.phone) : '');
    const [err, setErr] = useState('');
    const [dupe, setDupe] = useState(null);
    const [busy, setBusy] = useState(false);
    const firstRef = useRef(null);
    const submit = async (force = false) => {
        if (!name.trim()) {
            setErr('חובה: שם הסניף');
            firstRef.current?.focus();
            return;
        }
        if (!clusterId) {
            setErr('חובה: אשכול');
            return;
        }
        const pErr = phoneError(phone);
        if (pErr) {
            setErr(pErr);
            return;
        }
        const similar = findSimilar(name, allBranches, excludeId);
        if (similar && !force) {
            setDupe(similar);
            return;
        }
        setBusy(true);
        try {
            await onSave({ name: name.trim(), clusterId, phone: cleanPhone(phone) });
        }
        catch {
            setErr('השמירה נכשלה – אין הרשאה או אין חיבור');
            setBusy(false);
        }
    };
    const onKey = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submit();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
        }
    };
    return (_jsxs(_Fragment, { children: [_jsxs("tr", { className: "brow brow--edit", onKeyDown: onKey, children: [_jsx("td", { children: _jsx("input", { ref: firstRef, autoFocus: true, className: "input input--sm", value: name, onChange: (e) => { setName(e.target.value); setErr(''); setDupe(null); }, "aria-label": "\u05E9\u05DD \u05D4\u05E1\u05E0\u05D9\u05E3 (\u05D7\u05D5\u05D1\u05D4)", placeholder: "\u05E2\u05D9\u05E8 \u2013 \u05E8\u05D7\u05D5\u05D1" }) }), _jsx("td", { children: _jsx("select", { className: "input input--sm", value: clusterId, onChange: (e) => { setClusterId(e.target.value); setErr(''); }, "aria-label": "\u05D0\u05E9\u05DB\u05D5\u05DC (\u05D7\u05D5\u05D1\u05D4)", children: clusters.map((c) => _jsx("option", { value: c.id, children: c.name }, c.id)) }) }), _jsx("td", { children: _jsx("input", { className: "input input--sm input--ltr", inputMode: "tel", value: phone, onChange: (e) => { setPhone(e.target.value); setErr(''); }, "aria-label": "\u05D8\u05DC\u05E4\u05D5\u05DF (\u05DC\u05D0 \u05D7\u05D5\u05D1\u05D4)", placeholder: "03-1234567" }) }), _jsxs("td", { colSpan: 2, className: "br-actions", children: [_jsx(Button, { size: "sm", variant: "primary", icon: _jsx(Check, { size: 15 }), loading: busy, onClick: () => submit(), children: "\u05E9\u05DE\u05D5\u05E8" }), _jsx(Button, { size: "sm", variant: "ghost", onClick: onCancel, children: "\u05D1\u05D9\u05D8\u05D5\u05DC" })] })] }), (err || dupe) && (_jsx("tr", { className: "brow-msg", children: _jsxs("td", { colSpan: 5, children: [err && _jsx("p", { className: "pop__err", role: "alert", children: err }), dupe && (_jsx(DupePrompt, { existing: dupe.name, kind: "\u05E1\u05E0\u05D9\u05E3", onUseExisting: onCancel, onCreateAnyway: () => { setDupe(null); submit(true); } }))] }) }))] }));
}
/* עורך שם לאשכול (שורה ברשימה) */
function NameEditor({ initial = '', placeholder, list, excludeId, kind, onSave, onCancel, onPickExisting }) {
    const [v, setV] = useState(initial);
    const [dupe, setDupe] = useState(null);
    const [err, setErr] = useState('');
    const submit = async (force = false) => {
        if (!v.trim()) {
            setErr(`חובה: שם ה${kind}`);
            return;
        }
        const similar = findSimilar(v, list, excludeId);
        if (similar && !force) {
            setDupe(similar);
            return;
        }
        try {
            await onSave(v.trim());
        }
        catch {
            setErr('השמירה נכשלה – אין הרשאה או אין חיבור');
        }
    };
    return (_jsxs("div", { className: "name-editor", children: [_jsxs("div", { className: "name-editor__row", children: [_jsx("input", { autoFocus: true, className: "input input--sm", value: v, placeholder: placeholder, "aria-label": `שם ה${kind}`, onChange: (e) => { setV(e.target.value); setDupe(null); setErr(''); }, onKeyDown: (e) => { if (e.key === 'Enter') {
                            e.preventDefault();
                            submit();
                        } if (e.key === 'Escape') {
                            e.preventDefault();
                            onCancel();
                        } } }), _jsx("button", { className: "icon-btn icon-btn--sm icon-btn--ok", "aria-label": "\u05E9\u05DE\u05D5\u05E8", onClick: () => submit(), children: _jsx(Check, { size: 16 }) }), _jsx("button", { className: "icon-btn icon-btn--sm", "aria-label": "\u05D1\u05D9\u05D8\u05D5\u05DC", onClick: onCancel, children: _jsx(X, { size: 16 }) })] }), err && _jsx("p", { className: "pop__err", role: "alert", children: err }), dupe && _jsx(DupePrompt, { existing: dupe.name, kind: kind, onUseExisting: () => onPickExisting(dupe), onCreateAnyway: () => { setDupe(null); submit(true); } })] }));
}
/* "האם התכוונת לזה?" – מניעת רישום כפול בכתיב שונה */
export function DupePrompt({ existing, kind, onUseExisting, onCreateAnyway }) {
    return (_jsxs("div", { className: "dupe", role: "alert", children: [_jsxs("span", { children: ["\u05E7\u05D9\u05D9\u05DD \u05DB\u05D1\u05E8 ", kind, " \u05D1\u05E9\u05DD \u05D3\u05D5\u05DE\u05D4: ", _jsxs("b", { children: ["\"", existing, "\""] }), ". \u05D4\u05D0\u05DD \u05D4\u05EA\u05DB\u05D5\u05D5\u05E0\u05EA \u05D0\u05DC\u05D9\u05D5?"] }), _jsxs("span", { className: "dupe__actions", children: [_jsxs(Button, { size: "sm", variant: "primary", onClick: onUseExisting, children: ["\u05DB\u05DF, \u05D6\u05D4 ", existing] }), _jsxs(Button, { size: "sm", variant: "ghost", onClick: onCreateAnyway, children: ["\u05DC\u05D0, \u05D6\u05D4 ", kind, " \u05D0\u05D7\u05E8"] })] })] }));
}
/* מתג פעיל / לא פעיל */
function ActiveSwitch({ active, label, onChange }) {
    const [busy, setBusy] = useState(false);
    const toast = useToast();
    const click = async () => {
        setBusy(true);
        try {
            await onChange(!active);
        }
        catch {
            toast({ message: 'הפעולה נכשלה' });
        }
        setBusy(false);
    };
    return (_jsxs("button", { role: "switch", "aria-checked": active, "aria-label": `${label}: ${active ? 'פעיל' : 'לא פעיל'}`, className: `switch ${active ? 'is-on' : ''}`, onClick: (e) => { e.stopPropagation(); click(); }, disabled: busy, children: [_jsx("span", { className: "switch__track", children: _jsx("span", { className: "switch__thumb" }) }), _jsx("span", { className: "switch__label", children: active ? 'פעיל' : 'לא פעיל' })] }));
}
