import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/* הגדרות ← רשימות: הוספה, שינוי שם בתוך השורה, הפעלה/השבתה. אין מחיקה – פריט לא פעיל נשאר בהזמנות הישנות. */
import { useState } from 'react';
import { Check, Lock, Pencil, Plus, X } from 'lucide-react';
import { LIST_META, saveList, useLists } from '../../data/lists';
import { Button, EmptyState, Skeleton, Tip } from '../../design/components';
import { useToast } from '../../design/Toast';
import { findSimilar } from '../../lib/names';
import '../pages.css';
import './ListsPage.css';
export function ListsPage() {
    const { lists, error } = useLists();
    return (_jsxs("div", { className: "page", children: [_jsx("header", { className: "page__head", children: _jsxs("div", { children: [_jsx("h1", { className: "page__title", children: "\u05E8\u05E9\u05D9\u05DE\u05D5\u05EA" }), _jsx("p", { className: "page__sub", children: "\u05D4\u05E2\u05E8\u05DB\u05D9\u05DD \u05E9\u05DE\u05D5\u05E4\u05D9\u05E2\u05D9\u05DD \u05DC\u05D1\u05D7\u05D9\u05E8\u05D4 \u05D1\u05D8\u05E4\u05E1\u05D9\u05DD. \u05E4\u05E8\u05D9\u05D8 \u05E9\u05D4\u05D5\u05E9\u05D1\u05EA \u05DC\u05D0 \u05D9\u05D5\u05E4\u05D9\u05E2 \u05D1\u05D1\u05D7\u05D9\u05E8\u05D4 \u05D7\u05D3\u05E9\u05D4, \u05D0\u05D1\u05DC \u05E0\u05E9\u05D0\u05E8 \u05D1\u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05E9\u05DB\u05D1\u05E8 \u05E0\u05E9\u05DE\u05E8\u05D5." })] }) }), error ? _jsx("div", { className: "card", children: _jsx(EmptyState, { icon: _jsx(Lock, { size: 24 }), title: "\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05D8\u05E2\u05D5\u05DF", children: error }) })
                : !lists ? _jsx("div", { className: "lists-grid", children: [0, 1, 2, 3].map((i) => _jsx("div", { className: "card lcard", children: _jsx(Skeleton, { h: 120 }) }, i)) })
                    : (_jsx("div", { className: "lists-grid", children: Object.keys(LIST_META).map((k) => _jsx(ListCard, { k: k, lists: lists }, k)) }))] }));
}
function ListCard({ k, lists }) {
    const toast = useToast();
    const items = lists[k];
    const [editing, setEditing] = useState(null);
    const [draft, setDraft] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [err, setErr] = useState('');
    const commit = async (next, msg) => {
        try {
            await saveList(k, next, items, lists);
            toast({ message: msg, onUndo: () => saveList(k, items, next, { ...lists, [k]: next }) });
        }
        catch {
            toast({ message: 'השמירה נכשלה – רק מנהל מערכת יכול לשנות רשימות' });
        }
    };
    const add = async () => {
        const label = newLabel.trim();
        if (!label)
            return;
        const similar = findSimilar(label, items.map((i) => ({ id: i.id, name: i.label })));
        if (similar) {
            setErr(`כבר קיים פריט דומה: "${similar.name}"`);
            return;
        }
        await commit([...items, { id: `i${Date.now().toString(36)}`, label, active: true }], `"${label}" נוסף ל${LIST_META[k].title}`);
        setNewLabel('');
        setErr('');
    };
    const rename = async (it) => {
        const label = draft.trim();
        setEditing(null);
        if (!label || label === it.label)
            return;
        await commit(items.map((x) => (x.id === it.id ? { ...x, label } : x)), 'השם עודכן');
    };
    return (_jsxs("section", { className: "card lcard", "aria-labelledby": `h-${k}`, children: [_jsxs("div", { className: "lcard__head", children: [_jsx("h2", { id: `h-${k}`, className: "card__title", children: LIST_META[k].title }), _jsx("p", { className: "muted lcard__hint", children: LIST_META[k].hint })] }), _jsx("ul", { className: "litems", children: items.map((it) => (_jsx("li", { className: `litem ${it.active ? '' : 'is-inactive'}`, children: editing === it.id ? (_jsxs("span", { className: "litem__edit", children: [_jsx("input", { className: "input input--sm", autoFocus: true, value: draft, "aria-label": "\u05E9\u05DD \u05D4\u05E4\u05E8\u05D9\u05D8", onChange: (e) => setDraft(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') {
                                    e.preventDefault();
                                    rename(it);
                                } if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setEditing(null);
                                } } }), _jsx("button", { className: "icon-btn icon-btn--sm icon-btn--ok", "aria-label": "\u05E9\u05DE\u05D5\u05E8", onClick: () => rename(it), children: _jsx(Check, { size: 16 }) }), _jsx("button", { className: "icon-btn icon-btn--sm", "aria-label": "\u05D1\u05D9\u05D8\u05D5\u05DC", onClick: () => setEditing(null), children: _jsx(X, { size: 16 }) })] })) : (_jsxs(_Fragment, { children: [_jsx("span", { className: "litem__label", children: it.label }), it.locked && _jsx(Tip, { label: "\u05E4\u05E8\u05D9\u05D8 \u05DE\u05E2\u05E8\u05DB\u05EA \u2013 \u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05D4\u05E9\u05D1\u05D9\u05EA", children: _jsx("span", { className: "litem__lock", role: "img", tabIndex: 0, "aria-label": "\u05E4\u05E8\u05D9\u05D8 \u05DE\u05E2\u05E8\u05DB\u05EA", children: _jsx(Lock, { size: 13 }) }) }), !it.active && _jsx("span", { className: "tag-inactive", children: "\u05DC\u05D0 \u05E4\u05E2\u05D9\u05DC" }), _jsxs("span", { className: "litem__actions", children: [_jsx("button", { className: "icon-btn icon-btn--sm", "aria-label": `שנה שם: ${it.label}`, onClick: () => { setEditing(it.id); setDraft(it.label); }, children: _jsx(Pencil, { size: 14 }) }), !it.locked && (_jsx("button", { className: "litem__toggle", onClick: () => commit(items.map((x) => (x.id === it.id ? { ...x, active: !x.active } : x)), `"${it.label}" ${it.active ? 'הושבת' : 'הופעל'}`), children: it.active ? 'השבת' : 'הפעל' }))] })] })) }, it.id))) }), _jsxs("form", { className: "ladd", onSubmit: (e) => { e.preventDefault(); add(); }, children: [_jsx("input", { className: "input input--sm", value: newLabel, onChange: (e) => { setNewLabel(e.target.value); setErr(''); }, placeholder: "\u05E4\u05E8\u05D9\u05D8 \u05D7\u05D3\u05E9", "aria-label": `פריט חדש ב${LIST_META[k].title}` }), _jsx(Button, { size: "sm", type: "submit", icon: _jsx(Plus, { size: 15 }), disabled: !newLabel.trim(), children: "\u05D4\u05D5\u05E1\u05E3" })] }), err && _jsx("p", { className: "pop__err ladd__err", role: "alert", children: err })] }));
}
