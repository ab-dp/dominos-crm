import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/* מחירונים (אפיון 6.7): משותף או ייחודי, פריטים ומחירים (כולל מע"מ), לקוחות משויכים, "שכפל מחירון".
   כל מחיר ניתן לעריכה ידנית בכל רגע וכל עריכה נרשמת ביומן. שינוי מחירון לא משנה הזמנות קיימות. */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Copy, Pencil, Plus, Tags, Users, X } from 'lucide-react';
import { createPriceList, updatePriceList, usePriceLists } from '../../data/priceLists';
import { newId, useCustomers } from '../../data/customers';
import { Button, EmptyState, Skeleton } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, fmtMoney } from '../../lib/format';
import { findSimilar } from '../../lib/names';
import '../pages.css';
import '../branches/BranchesPage.css';
import './PriceListsPage.css';
export function PriceListsPage() {
    const { items, loading, error } = usePriceLists();
    const { items: customers } = useCustomers();
    const toast = useToast();
    const [params, setParams] = useSearchParams();
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newKind, setNewKind] = useState('shared');
    const [err, setErr] = useState('');
    const selectedId = params.get('id') ?? items[0]?.id;
    const selected = items.find((p) => p.id === selectedId);
    const assigned = (id) => customers.filter((c) => c.priceListId === id && c.status !== 'merged');
    const create = async (name, kind, from) => {
        if (!name.trim())
            return setErr('חובה: שם המחירון');
        const similar = findSimilar(name, items);
        if (similar && !from)
            return setErr(`כבר קיים מחירון בשם דומה: "${similar.name}"`);
        const id = await createPriceList(name, kind, from ? from.items.map((i) => ({ ...i, id: newId() })) : []);
        setCreating(false);
        setNewName('');
        setErr('');
        setParams({ id }, { replace: true });
        toast({ message: from ? _jsxs(_Fragment, { children: ["\u05E0\u05D5\u05E6\u05E8 \u05E2\u05D5\u05EA\u05E7: \"", name, "\" \u05E2\u05DD ", _jsx(Ltr, { children: from.items.length }), " \u05E4\u05E8\u05D9\u05D8\u05D9\u05DD"] }) : _jsxs(_Fragment, { children: ["\u05D4\u05DE\u05D7\u05D9\u05E8\u05D5\u05DF \"", name, "\" \u05E0\u05D5\u05E6\u05E8"] }) });
    };
    return (_jsxs("div", { className: "page", children: [_jsxs("header", { className: "page__head", children: [_jsxs("div", { children: [_jsx("h1", { className: "page__title", children: "\u05DE\u05D7\u05D9\u05E8\u05D5\u05E0\u05D9\u05DD" }), _jsx("p", { className: "page__sub", children: "\u05DB\u05DC \u05D4\u05DE\u05D7\u05D9\u05E8\u05D9\u05DD \u05DB\u05D5\u05DC\u05DC\u05D9\u05DD \u05DE\u05E2\"\u05DE. \u05D4\u05DE\u05D7\u05D9\u05E8 \u05E0\u05E9\u05DE\u05E8 \u05D1\u05EA\u05D5\u05DA \u05DB\u05DC \u05D4\u05D6\u05DE\u05E0\u05D4, \u05DB\u05DA \u05E9\u05E9\u05D9\u05E0\u05D5\u05D9 \u05DE\u05D7\u05D9\u05E8\u05D5\u05DF \u05DC\u05D0 \u05DE\u05E9\u05E0\u05D4 \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05E7\u05D9\u05D9\u05DE\u05D5\u05EA." })] }), _jsx("div", { className: "page__head-end", children: _jsx(Button, { variant: "primary", icon: _jsx(Plus, { size: 18 }), onClick: () => setCreating(true), disabled: creating, children: "\u05DE\u05D7\u05D9\u05E8\u05D5\u05DF \u05D7\u05D3\u05E9" }) })] }), error ? _jsx("div", { className: "card", children: _jsx(EmptyState, { icon: _jsx(Tags, { size: 24 }), title: "\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05D8\u05E2\u05D5\u05DF", children: error }) }) : (_jsxs("div", { className: "br-grid", children: [_jsxs("section", { className: "card", "aria-labelledby": "h-pl", children: [_jsxs("div", { className: "card__head", children: [_jsx("h2", { id: "h-pl", className: "card__title", children: "\u05DE\u05D7\u05D9\u05E8\u05D5\u05E0\u05D9\u05DD" }), _jsx("span", { className: "muted", children: _jsx(Ltr, { children: items.length }) })] }), _jsxs("ul", { className: "clist", children: [creating && (_jsxs("li", { className: "name-editor pl-new", children: [_jsx("input", { className: "input input--sm", autoFocus: true, value: newName, placeholder: "\u05E9\u05DD \u05D4\u05DE\u05D7\u05D9\u05E8\u05D5\u05DF", "aria-label": "\u05E9\u05DD \u05D4\u05DE\u05D7\u05D9\u05E8\u05D5\u05DF", onChange: (e) => { setNewName(e.target.value); setErr(''); }, onKeyDown: (e) => { if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    create(newName, newKind);
                                                } if (e.key === 'Escape')
                                                    setCreating(false); } }), _jsxs("div", { className: "seg seg--sm", role: "radiogroup", "aria-label": "\u05E1\u05D5\u05D2 \u05DE\u05D7\u05D9\u05E8\u05D5\u05DF", children: [_jsx("button", { type: "button", role: "radio", "aria-checked": newKind === 'shared', className: newKind === 'shared' ? 'is-on' : '', onClick: () => setNewKind('shared'), children: "\u05DE\u05E9\u05D5\u05EA\u05E3" }), _jsx("button", { type: "button", role: "radio", "aria-checked": newKind === 'unique', className: newKind === 'unique' ? 'is-on' : '', onClick: () => setNewKind('unique'), children: "\u05D9\u05D9\u05D7\u05D5\u05D3\u05D9 \u05DC\u05DC\u05E7\u05D5\u05D7" })] }), _jsxs("div", { className: "pl-new__actions", children: [_jsx(Button, { size: "sm", variant: "primary", onClick: () => create(newName, newKind), children: "\u05E6\u05D5\u05E8" }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => { setCreating(false); setErr(''); }, children: "\u05D1\u05D9\u05D8\u05D5\u05DC" })] }), err && _jsx("p", { className: "pop__err", role: "alert", children: err })] })), loading ? [0, 1].map((i) => _jsx("li", { className: "citem-skel", children: _jsx(Skeleton, { h: 18 }) }, i)) : items.map((p) => (_jsx("li", { className: p.active ? '' : 'is-inactive', children: _jsxs("button", { className: `citem pl-item ${p.id === selectedId ? 'is-on' : ''}`, "aria-pressed": p.id === selectedId, onClick: () => setParams({ id: p.id }, { replace: true }), children: [_jsx("span", { className: "citem__name", children: p.name }), p.kind === 'unique' && _jsx("span", { className: "tag-inactive", children: "\u05D9\u05D9\u05D7\u05D5\u05D3\u05D9" }), !p.active && _jsx("span", { className: "tag-inactive", children: "\u05DC\u05D0 \u05E4\u05E2\u05D9\u05DC" }), _jsxs("span", { className: "citem__count", children: [_jsx(Ltr, { children: p.items.filter((i) => i.active).length }), " \u05E4\u05E8\u05D9\u05D8\u05D9\u05DD \u00B7 ", _jsx(Ltr, { children: assigned(p.id).length }), " \u05DC\u05E7\u05D5\u05D7\u05D5\u05EA"] })] }) }, p.id))), !loading && items.length === 0 && !creating && _jsxs("li", { className: "clist__empty", children: ["\u05E2\u05D5\u05D3 \u05D0\u05D9\u05DF \u05DE\u05D7\u05D9\u05E8\u05D5\u05E0\u05D9\u05DD. ", _jsx("button", { className: "link", onClick: () => setCreating(true), children: "\u05E6\u05D5\u05E8 \u05D0\u05EA \u05D4\u05E8\u05D0\u05E9\u05D5\u05DF" })] })] })] }), selected ? _jsx(Editor, { pl: selected, all: items, customersCount: assigned(selected.id), onDuplicate: () => create(`עותק של ${selected.name}`, selected.kind, selected) }, selected.id) : !loading && (_jsx("div", { className: "card", children: _jsx(EmptyState, { icon: _jsx(Tags, { size: 24 }), title: "\u05D1\u05D7\u05E8 \u05DE\u05D7\u05D9\u05E8\u05D5\u05DF \u05D0\u05D5 \u05E6\u05D5\u05E8 \u05D7\u05D3\u05E9", children: "\u05DE\u05D7\u05D9\u05E8\u05D5\u05DF \u05DE\u05E9\u05D5\u05EA\u05E3 \u05DE\u05E9\u05DE\u05E9 \u05DB\u05DE\u05D4 \u05DC\u05E7\u05D5\u05D7\u05D5\u05EA; \u05D9\u05D9\u05D7\u05D5\u05D3\u05D9 \u2013 \u05DC\u05E7\u05D5\u05D7 \u05D0\u05D7\u05D3." }) }))] }))] }));
}
function Editor({ pl, all, customersCount, onDuplicate }) {
    const toast = useToast();
    const [renaming, setRenaming] = useState(false);
    const [name, setName] = useState(pl.name);
    const [editing, setEditing] = useState(null);
    const [draft, setDraft] = useState({ name: '', price: '' });
    const [adding, setAdding] = useState(false);
    const [err, setErr] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const saveItems = async (items, msg, before, after) => {
        try {
            await updatePriceList(pl, { items }, { before, after });
            toast({ message: msg });
        }
        catch {
            toast({ message: 'השמירה נכשלה' });
        }
    };
    const commitItem = async (id) => {
        const n = draft.name.trim();
        const price = Number(draft.price.replace(/[^\d.]/g, ''));
        if (!n)
            return setErr('חובה: שם הפריט');
        if (!draft.price.trim() || !(price > 0))
            return setErr('חובה: מחיר חיובי (כולל מע"מ)');
        const dupe = findSimilar(n, pl.items.map((i) => ({ id: i.id, name: i.name })), id ?? undefined);
        if (dupe)
            return setErr(`כבר יש פריט בשם דומה: "${dupe.name}"`);
        if (id) {
            const old = pl.items.find((i) => i.id === id);
            await saveItems(pl.items.map((i) => (i.id === id ? { ...i, name: n, price } : i)), old.price !== price ? `${n}: ${fmtMoney(old.price)} ← ${fmtMoney(price)}` : 'הפריט עודכן', { item: old.name, price: old.price }, { item: n, price });
            setEditing(null);
        }
        else {
            await saveItems([...pl.items, { id: newId(), name: n, price, active: true }], `${n} נוסף · ${fmtMoney(price)}`, null, { item: n, price });
            setAdding(false);
        }
        setDraft({ name: '', price: '' });
        setErr('');
    };
    const rows = pl.items.filter((i) => showInactive || i.active);
    const row = (id) => (_jsxs("tr", { className: "brow brow--edit", onKeyDown: (e) => { if (e.key === 'Enter') {
            e.preventDefault();
            commitItem(id);
        } if (e.key === 'Escape') {
            e.preventDefault();
            setEditing(null);
            setAdding(false);
            setErr('');
        } }, children: [_jsx("td", { children: _jsx("input", { className: "input input--sm", autoFocus: true, value: draft.name, onChange: (e) => { setDraft({ ...draft, name: e.target.value }); setErr(''); }, "aria-label": "\u05E9\u05DD \u05D4\u05E4\u05E8\u05D9\u05D8", placeholder: "\u05E4\u05D9\u05E6\u05D4 \u05DE\u05E9\u05E4\u05D7\u05EA\u05D9\u05EA" }) }), _jsx("td", { children: _jsx("input", { className: "input input--sm input--ltr pl-price", inputMode: "decimal", value: draft.price, onChange: (e) => { setDraft({ ...draft, price: e.target.value }); setErr(''); }, "aria-label": "\u05DE\u05D7\u05D9\u05E8 \u05DB\u05D5\u05DC\u05DC \u05DE\u05E2\u05F4\u05DE", placeholder: "\u20AA" }) }), _jsxs("td", { colSpan: 2, className: "br-actions", children: [_jsx(Button, { size: "sm", variant: "primary", icon: _jsx(Check, { size: 15 }), onClick: () => commitItem(id), children: "\u05E9\u05DE\u05D5\u05E8" }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => { setEditing(null); setAdding(false); setErr(''); }, children: "\u05D1\u05D9\u05D8\u05D5\u05DC" })] })] }, id ?? 'new'));
    return (_jsxs("section", { className: "card", "aria-labelledby": "h-pled", children: [_jsxs("div", { className: "card__head br-branches__head", children: [renaming ? (_jsxs("span", { className: "name-editor__row pl-rename", children: [_jsx("input", { className: "input input--sm", autoFocus: true, value: name, onChange: (e) => setName(e.target.value), "aria-label": "\u05E9\u05DD \u05D4\u05DE\u05D7\u05D9\u05E8\u05D5\u05DF", onKeyDown: async (e) => {
                                    if (e.key === 'Escape') {
                                        setRenaming(false);
                                        setName(pl.name);
                                    }
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const d = findSimilar(name, all, pl.id);
                                        if (!name.trim() || d) {
                                            setErr(d ? `כבר קיים מחירון בשם "${d.name}"` : 'חובה: שם');
                                            return;
                                        }
                                        await updatePriceList(pl, { name: name.trim() });
                                        setRenaming(false);
                                        toast({ message: 'שם המחירון עודכן' });
                                    }
                                } }), _jsx("button", { className: "icon-btn icon-btn--sm", "aria-label": "\u05D1\u05D9\u05D8\u05D5\u05DC", onClick: () => { setRenaming(false); setName(pl.name); }, children: _jsx(X, { size: 16 }) })] })) : (_jsxs(_Fragment, { children: [_jsx("h2", { id: "h-pled", className: "card__title", children: pl.name }), _jsx("button", { className: "icon-btn icon-btn--sm", "aria-label": "\u05E9\u05E0\u05D4 \u05E9\u05DD \u05DE\u05D7\u05D9\u05E8\u05D5\u05DF", onClick: () => setRenaming(true), children: _jsx(Pencil, { size: 15 }) })] })), _jsx("span", { className: "tag", children: pl.kind === 'shared' ? 'משותף' : 'ייחודי ללקוח' }), _jsxs("span", { className: "card__head-end pl-head-actions", children: [_jsxs("label", { className: "check-inline", children: [_jsx("input", { type: "checkbox", checked: showInactive, onChange: (e) => setShowInactive(e.target.checked) }), " \u05D4\u05E6\u05D2 \u05E4\u05E8\u05D9\u05D8\u05D9\u05DD \u05DC\u05D0 \u05E4\u05E2\u05D9\u05DC\u05D9\u05DD"] }), _jsx(Button, { size: "sm", icon: _jsx(Copy, { size: 15 }), onClick: onDuplicate, children: "\u05E9\u05DB\u05E4\u05DC \u05DE\u05D7\u05D9\u05E8\u05D5\u05DF" }), _jsx(Button, { size: "sm", variant: pl.active ? 'ghost' : 'secondary', onClick: async () => { await updatePriceList(pl, { active: !pl.active }); toast({ message: pl.active ? 'המחירון סומן כלא פעיל – לא יוצע ללקוחות חדשים' : 'המחירון הופעל' }); }, children: pl.active ? 'סמן כלא פעיל' : 'הפעל' })] })] }), _jsxs("div", { className: "otable-wrap br-table-wrap", children: [_jsxs("table", { className: "otable otable--dense br-table pl-table", children: [_jsxs("caption", { className: "sr-only", children: ["\u05E4\u05E8\u05D9\u05D8\u05D9\u05DD \u05D1\u05DE\u05D7\u05D9\u05E8\u05D5\u05DF ", pl.name] }), _jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u05E4\u05E8\u05D9\u05D8" }), _jsx("th", { children: "\u05DE\u05D7\u05D9\u05E8 (\u05DB\u05D5\u05DC\u05DC \u05DE\u05E2\"\u05DE)" }), _jsx("th", { children: "\u05DE\u05E6\u05D1" }), _jsx("th", { children: _jsx("span", { className: "sr-only", children: "\u05E4\u05E2\u05D5\u05DC\u05D5\u05EA" }) })] }) }), _jsxs("tbody", { children: [adding && row(null), rows.map((it) => editing === it.id ? row(it.id) : (_jsxs("tr", { className: `brow ${it.active ? '' : 'is-inactive'}`, tabIndex: 0, onKeyDown: (e) => { if (e.target === e.currentTarget && e.key === 'Enter') {
                                            e.preventDefault();
                                            setEditing(it.id);
                                            setDraft({ name: it.name, price: String(it.price) });
                                        } }, children: [_jsx("td", { className: "strong", children: it.name }), _jsx("td", { className: "num", children: _jsx(Ltr, { children: fmtMoney(it.price) }) }), _jsx("td", { children: _jsxs("button", { className: `switch ${it.active ? 'is-on' : ''}`, role: "switch", "aria-checked": it.active, "aria-label": `${it.name}: ${it.active ? 'פעיל' : 'לא פעיל'}`, onClick: () => saveItems(pl.items.map((i) => (i.id === it.id ? { ...i, active: !i.active } : i)), `${it.name} ${it.active ? 'הושבת' : 'הופעל'}`, { item: it.name, active: it.active }, { item: it.name, active: !it.active }), children: [_jsx("span", { className: "switch__track", children: _jsx("span", { className: "switch__thumb" }) }), _jsx("span", { className: "switch__label", children: it.active ? 'פעיל' : 'לא פעיל' })] }) }), _jsx("td", { className: "br-actions", children: _jsx(Button, { size: "sm", variant: "ghost", icon: _jsx(Pencil, { size: 15 }), onClick: () => { setEditing(it.id); setAdding(false); setDraft({ name: it.name, price: String(it.price) }); setErr(''); }, children: "\u05E2\u05E8\u05D5\u05DA" }) })] }, it.id))), err && _jsx("tr", { className: "brow-msg", children: _jsx("td", { colSpan: 4, children: _jsx("p", { className: "pop__err", role: "alert", children: err }) }) })] })] }), !adding && (_jsxs("button", { className: "pl-add", onClick: () => { setAdding(true); setEditing(null); setDraft({ name: '', price: '' }); setErr(''); }, children: [_jsx(Plus, { size: 16, "aria-hidden": "true" }), " \u05D4\u05D5\u05E1\u05E3 \u05E4\u05E8\u05D9\u05D8"] }))] }), _jsxs("div", { className: "pl-customers", children: [_jsxs("h3", { className: "pl-customers__title", children: [_jsx(Users, { size: 16, "aria-hidden": "true" }), " \u05DC\u05E7\u05D5\u05D7\u05D5\u05EA \u05DE\u05E9\u05D5\u05D9\u05DB\u05D9\u05DD \u00B7 ", _jsx(Ltr, { children: customersCount.length })] }), customersCount.length === 0 ? _jsx("p", { className: "muted", children: "\u05D0\u05E3 \u05DC\u05E7\u05D5\u05D7 \u05DC\u05D0 \u05DE\u05E9\u05D5\u05D9\u05DA. \u05DE\u05E9\u05D9\u05D9\u05DB\u05D9\u05DD \u05DE\u05EA\u05D5\u05DA \u05D8\u05D5\u05E4\u05E1 \u05D4\u05DC\u05E7\u05D5\u05D7 \u05D0\u05D5 \u05DE\u05D4\u05D8\u05D0\u05D1 \"\u05DE\u05D7\u05D9\u05E8\u05D5\u05DF\" \u05D1\u05EA\u05D9\u05E7 \u05D4\u05DC\u05E7\u05D5\u05D7." }) : (_jsx("ul", { className: "pl-customers__list", children: customersCount.map((c) => _jsx("li", { children: _jsx(Link, { to: `/customers/${c.id}`, children: c.name }) }, c.id)) }))] })] }));
}
