import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/* עריכה בתוך תיק ההזמנה (אפיון 6.3): לוחצים על ערך, משנים, Enter או יציאה מהשדה – נשמר.
   Esc מבטל. כל שמירה נרשמת ביומן עם הערך הקודם, ומוצגת הודעה עם "בטל". */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Minus, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { useBranches, useClusters } from '../../data/branches';
import { newId, useCustomers } from '../../data/customers';
import { useLists } from '../../data/lists';
import { addOrderNote, useOrderNotes } from '../../data/orders';
import { usePriceLists } from '../../data/priceLists';
import { useStore } from '../../data/store';
import { METHOD_LABEL } from '../../data/types';
import { Button, Missing } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, fmtDate, fmtMoney, fmtPhone, toISODate } from '../../lib/format';
import { cleanPhone, phoneError } from '../../lib/names';
import { BranchPicker } from '../branches/BranchPicker';
const CARD_RE = /\d{13,}/;
const money = (s) => Number(s.replace(/[^\d.]/g, '')) || 0;
export function EditKv({ k, value, display, kind = 'text', placeholder, validate, onSave, readOnly }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const [err, setErr] = useState('');
    const [remote, setRemote] = useState(null); // ערך שמשתמש אחר שמר בזמן שערכתי
    const start = useRef(value);
    const ref = useRef(null);
    const btn = useRef(null);
    useEffect(() => { if (!editing)
        setDraft(value); }, [value, editing]);
    useEffect(() => { if (editing) {
        start.current = value;
        setRemote(null);
        ref.current?.focus();
        ref.current?.select?.();
    } }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps
    const commit = () => {
        const v = kind === 'phone' ? cleanPhone(draft) : draft.trim();
        const before = kind === 'phone' ? cleanPhone(value) : value.trim();
        if (v === before) {
            setEditing(false);
            setErr('');
            return;
        }
        const e = (CARD_RE.test(v) && kind !== 'phone' ? 'אסור לרשום כאן מספר כרטיס אשראי' : '') || validate?.(v) || '';
        if (e) {
            setErr(e);
            ref.current?.focus();
            return;
        }
        // מישהו אחר שינה את השדה בזמן שערכתי – לא דורסים בלי לשאול
        if (value !== start.current && remote === null) {
            setRemote(value);
            return;
        }
        onSave(v);
        setEditing(false);
        setErr('');
        requestAnimationFrame(() => btn.current?.focus());
    };
    const cancel = () => { setDraft(value); setErr(''); setRemote(null); setEditing(false); requestAnimationFrame(() => btn.current?.focus()); };
    if (readOnly)
        return _jsxs("div", { className: "kv", children: [_jsx("span", { className: "kv__k", children: k }), _jsx("span", { className: "kv__v", children: display ?? (value || '—') })] });
    return (_jsxs("div", { className: `kv kv--edit ${editing ? 'is-editing' : ''}`, children: [_jsx("span", { className: "kv__k", id: `kv-${k}`, children: k }), editing ? (_jsxs("span", { className: "kv__field", children: [kind === 'textarea' ? (_jsx("textarea", { ref: ref, className: "input kv__input kv__ta", rows: 2, value: draft, placeholder: placeholder, "aria-labelledby": `kv-${k}`, "aria-invalid": !!err || undefined, onChange: (e) => { setDraft(e.target.value); setErr(''); }, onBlur: commit, onKeyDown: (e) => { if (e.key === 'Escape') {
                            e.stopPropagation();
                            cancel();
                        } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            commit();
                        } } })) : (_jsx("input", { ref: ref, className: `input kv__input ${kind === 'text' ? '' : 'input--ltr'}`, value: draft, placeholder: placeholder, "aria-labelledby": `kv-${k}`, "aria-invalid": !!err || undefined, type: kind === 'date' ? 'date' : kind === 'time' ? 'time' : 'text', step: kind === 'time' ? 900 : undefined, inputMode: kind === 'phone' ? 'tel' : kind === 'money' ? 'decimal' : undefined, onChange: (e) => { setDraft(e.target.value); setErr(''); }, onBlur: commit, onKeyDown: (e) => { if (e.key === 'Escape') {
                            e.stopPropagation();
                            cancel();
                        } if (e.key === 'Enter') {
                            e.preventDefault();
                            commit();
                        } } })), remote !== null && (_jsxs("span", { className: "kv__remote", role: "alert", children: ["\u05DE\u05E9\u05EA\u05DE\u05E9 \u05D0\u05D7\u05E8 \u05E9\u05D9\u05E0\u05D4 \u05D1\u05D9\u05E0\u05EA\u05D9\u05D9\u05DD \u05DC: ", _jsx("b", { children: remote || 'ריק' }), _jsxs("span", { className: "kv__remote-actions", children: [_jsx("button", { type: "button", className: "link", onMouseDown: (e) => e.preventDefault(), onClick: () => { onSave(kind === 'phone' ? cleanPhone(draft) : draft.trim()); setRemote(null); setEditing(false); }, children: "\u05E9\u05DE\u05D5\u05E8 \u05D0\u05EA \u05E9\u05DC\u05D9" }), _jsx("button", { type: "button", className: "link", onMouseDown: (e) => e.preventDefault(), onClick: cancel, children: "\u05D4\u05E9\u05D0\u05E8 \u05D0\u05EA \u05E9\u05DC\u05D5" })] })] })), err ? _jsx("span", { className: "cform__err", role: "alert", children: err }) : _jsxs("span", { className: "kv__hint", children: [kind === 'textarea' ? 'Ctrl+Enter לשמירה' : 'Enter לשמירה', " \u00B7 Esc \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC"] })] })) : (_jsxs("button", { ref: btn, type: "button", className: "kv__v kv__btn", onClick: () => setEditing(true), "aria-label": `${k}: ${value || 'ריק'}. לחץ לעריכה`, children: [_jsx("span", { className: "kv__val", children: display ?? (value || _jsx("span", { className: "muted", children: placeholder ?? '—' })) }), _jsx(Pencil, { size: 13, className: "kv__pen", "aria-hidden": "true" })] }))] }));
}
/* ---------- שדות של תיק ההזמנה ---------- */
export function useOrderSave(o) {
    const { requestChange } = useStore();
    return (patch, what) => requestChange(o, patch, what);
}
export function BranchEdit({ o }) {
    const save = useOrderSave(o);
    const { items: branches } = useBranches();
    const { items: clusters } = useClusters();
    const [open, setOpen] = useState(false);
    if (!open) {
        return (_jsxs("div", { className: "kv kv--edit", children: [_jsx("span", { className: "kv__k", children: "\u05E1\u05E0\u05D9\u05E3" }), _jsxs("button", { type: "button", className: "kv__v kv__btn", onClick: () => setOpen(true), "aria-label": `סניף: ${o.branchName || "חסר"}. לחץ לשינוי`, children: [_jsx("span", { className: "kv__val", children: o.branchId ? _jsxs(_Fragment, { children: [o.branchName, " ", _jsxs("span", { className: "muted", children: ["\u00B7 \u05D0\u05E9\u05DB\u05D5\u05DC ", o.cluster] })] }) : _jsx(Missing, {}) }), _jsx(Pencil, { size: 13, className: "kv__pen", "aria-hidden": "true" })] })] }));
    }
    return (_jsxs("div", { className: "kv kv--edit is-editing", children: [_jsx("span", { className: "kv__k", children: "\u05E1\u05E0\u05D9\u05E3" }), _jsxs("span", { className: "kv__field", children: [_jsx(BranchPicker, { label: "\u05D1\u05D7\u05E8 \u05E1\u05E0\u05D9\u05E3", value: { branchId: o.branchId, clusterId: '' }, onChange: (v) => {
                            const b = branches.find((x) => x.id === v.branchId);
                            if (b && b.id !== o.branchId) {
                                // סניף חדש: השם, הטלפון והאשכול נשמרים מחדש בהזמנה. אם הייתה מאושרת – חלון "שינוי אחרי אישור" שואל מה לבטל.
                                save({ branchId: b.id, branchName: b.name, branchPhone: b.phone, cluster: clusters.find((c) => c.id === b.clusterId)?.name ?? '' }, 'הסניף');
                            }
                            setOpen(false);
                        } }), _jsx("button", { type: "button", className: "link kv__cancel", onClick: () => setOpen(false), children: "\u05D1\u05D9\u05D8\u05D5\u05DC" })] })] }));
}
export function DeliveryTypeEdit({ o }) {
    const save = useOrderSave(o);
    return (_jsxs("div", { className: "kv", children: [_jsx("span", { className: "kv__k", children: "\u05E1\u05D5\u05D2" }), _jsx("span", { className: "kv__v", children: _jsx("span", { className: "seg seg--inline", role: "radiogroup", "aria-label": "\u05DE\u05E9\u05DC\u05D5\u05D7 \u05D0\u05D5 \u05D0\u05D9\u05E1\u05D5\u05E3", children: ['delivery', 'pickup'].map((d) => (_jsx("button", { type: "button", role: "radio", "aria-checked": o.delivery === d, className: o.delivery === d ? 'is-on' : '', onClick: () => o.delivery !== d && save({ delivery: d }, 'סוג האספקה'), children: d === 'delivery' ? 'משלוח' : 'איסוף עצמי' }, d))) }) })] }));
}
export function MethodEdit({ o }) {
    const save = useOrderSave(o);
    const { lists } = useLists();
    const methods = (lists?.paymentMethods ?? []).filter((m) => m.active || m.id === o.method);
    return (_jsxs("div", { className: "kv", children: [_jsx("span", { className: "kv__k", children: "\u05D0\u05DE\u05E6\u05E2\u05D9 \u05EA\u05E9\u05DC\u05D5\u05DD" }), _jsx("span", { className: "kv__v", children: _jsxs("span", { className: "seg seg--inline", role: "radiogroup", "aria-label": "\u05D0\u05DE\u05E6\u05E2\u05D9 \u05EA\u05E9\u05DC\u05D5\u05DD", children: [methods.map((m) => (_jsx("button", { type: "button", role: "radio", "aria-checked": o.method === m.id, className: o.method === m.id ? 'is-on' : '', onClick: () => o.method !== m.id && save({ method: m.id, methodLabel: m.label }, 'אמצעי התשלום'), children: m.label }, m.id))), methods.length === 0 && (o.methodLabel ?? METHOD_LABEL[o.method] ?? o.method)] }) })] }));
}
export const validTime = (v) => (/^\d{2}:\d{2}$/.test(v) ? '' : 'שעה בפורמט 14:30');
export const validDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? '' : 'תאריך לא תקין');
export const validPhone = (v) => (v ? phoneError(v) : '');
export const showDate = (iso) => _jsx(Ltr, { children: fmtDate(iso) });
export const showPhone = (p) => (p ? _jsx(Ltr, { children: fmtPhone(p) }) : undefined);
export function ItemsEditor({ o, onDone }) {
    const save = useOrderSave(o);
    const reduce = useReducedMotion();
    const { items: customers } = useCustomers();
    const { items: priceLists } = usePriceLists();
    const c = customers.find((x) => x.id === o.customerId);
    const pl = priceLists.find((p) => p.id === c?.priceListId);
    const catalog = useMemo(() => (pl?.items ?? []).filter((i) => i.active).map((i) => ({
        ...i, price: c?.customPrices.find((p) => p.itemId === i.id)?.price ?? i.price,
    })), [pl, c]);
    const [lines, setLines] = useState(() => o.items.map((it) => ({ ...it, key: newId() })));
    const [contents, setContents] = useState(o.contents ?? '');
    const [fee, setFee] = useState(o.deliveryFee ? String(o.deliveryFee) : '');
    const calc = lines.reduce((t, l) => t + l.qty * l.unitPrice, 0) + (o.delivery === 'delivery' ? money(fee) : 0);
    const hasLines = lines.length > 0;
    const [amount, setAmount] = useState(String(o.amount));
    // סכום קיים ששונה מסכום הפריטים נשמר כמו שהוא (שונה ידנית) – פתיחת העריכה לא משנה אותו בשקט
    const [manual, setManual] = useState(() => !hasLines || o.calcAmount !== undefined
        || o.amount !== o.items.reduce((t, l) => t + l.qty * l.unitPrice, 0) + (o.delivery === 'delivery' ? o.deliveryFee ?? 0 : 0));
    const final = manual ? money(amount) : calc;
    const [err, setErr] = useState('');
    useEffect(() => { if (!manual)
        setAmount(String(calc)); }, [calc, manual]);
    const add = (id) => {
        const it = catalog.find((x) => x.id === id);
        setLines((ls) => [...ls, { key: newId(), itemId: it?.id, name: it?.name ?? '', qty: 1, unitPrice: it?.price ?? 0 }]);
        if (!hasLines && !o.calcAmount)
            setManual(false);
    };
    const set = (key, p) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
    const submit = () => {
        if (lines.some((l) => !l.name.trim() || l.qty <= 0))
            return setErr('לכל פריט צריך שם וכמות');
        if (final <= 0)
            return setErr('הסכום לחיוב חייב להיות גדול מ-0');
        if (CARD_RE.test(contents))
            return setErr('אסור לרשום כאן מספר כרטיס אשראי');
        const items = lines.map(({ key: _k, itemId, ...l }) => ({ ...(itemId ? { itemId } : {}), ...l, name: l.name.trim() }));
        const feeV = o.delivery === 'delivery' ? money(fee) : 0;
        save({
            items, contents: contents.trim() || undefined, deliveryFee: feeV || undefined,
            amount: final, calcAmount: hasLines && final !== calc ? calc : undefined,
        }, 'פירוט ההזמנה והסכום');
        onDone();
    };
    return (_jsxs("div", { className: "iedit", children: [hasLines && (_jsxs("table", { className: "items iedit__table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u05E4\u05E8\u05D9\u05D8" }), _jsx("th", { children: "\u05DB\u05DE\u05D5\u05EA" }), _jsx("th", { children: "\u05DE\u05D7\u05D9\u05E8 \u05DC\u05D9\u05D7\u05F3" }), _jsx("th", { children: "\u05E1\u05D4\u05F4\u05DB" }), _jsx("th", { children: _jsx("span", { className: "sr-only", children: "\u05D4\u05E1\u05E8" }) })] }) }), _jsx("tbody", { children: _jsx(AnimatePresence, { initial: false, children: lines.map((l) => (_jsxs(motion.tr, { layout: !reduce, initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 }, children: [_jsx("td", { children: l.itemId ? l.name : _jsx("input", { className: "input input--sm", value: l.name, onChange: (e) => set(l.key, { name: e.target.value }), placeholder: "\u05E9\u05DD \u05D4\u05E4\u05E8\u05D9\u05D8", "aria-label": "\u05E9\u05DD \u05D4\u05E4\u05E8\u05D9\u05D8" }) }), _jsx("td", { children: _jsxs("div", { className: "stepper", children: [_jsx("button", { type: "button", "aria-label": "\u05D4\u05E4\u05D7\u05EA", onClick: () => set(l.key, { qty: Math.max(1, l.qty - 1) }), children: _jsx(Minus, { size: 14 }) }), _jsx("input", { className: "input input--sm input--ltr", inputMode: "numeric", value: l.qty, onChange: (e) => set(l.key, { qty: Number(e.target.value.replace(/\D/g, '')) || 0 }), "aria-label": `כמות ${l.name}` }), _jsx("button", { type: "button", "aria-label": "\u05D4\u05D5\u05E1\u05E3", onClick: () => set(l.key, { qty: l.qty + 1 }), children: _jsx(Plus, { size: 14 }) })] }) }), _jsx("td", { children: _jsx("input", { className: "input input--sm input--ltr iedit__price", inputMode: "decimal", value: l.unitPrice, onChange: (e) => set(l.key, { unitPrice: money(e.target.value) }), "aria-label": `מחיר ליחידה ${l.name}` }) }), _jsx("td", { children: _jsx(Ltr, { children: fmtMoney(l.qty * l.unitPrice) }) }), _jsx("td", { children: _jsx("button", { type: "button", className: "icon-btn icon-btn--sm", "aria-label": `הסר ${l.name || 'פריט'}`, onClick: () => setLines((ls) => ls.filter((x) => x.key !== l.key)), children: _jsx(Trash2, { size: 15 }) }) })] }, l.key))) }) })] })), _jsxs("div", { className: "no-add", children: [catalog.slice(0, 6).map((i) => _jsxs("button", { type: "button", className: "chip", onClick: () => add(i.id), children: [_jsx(Plus, { size: 13, "aria-hidden": "true" }), " ", i.name] }, i.id)), catalog.length > 6 && (_jsxs("select", { className: "input no-add__pick", value: "", onChange: (e) => e.target.value && add(e.target.value), "aria-label": "\u05E2\u05D5\u05D3 \u05E4\u05E8\u05D9\u05D8\u05D9\u05DD \u05DE\u05D4\u05DE\u05D7\u05D9\u05E8\u05D5\u05DF", children: [_jsx("option", { value: "", children: "+ \u05E2\u05D5\u05D3 \u05DE\u05D4\u05DE\u05D7\u05D9\u05E8\u05D5\u05DF" }), catalog.slice(6).map((i) => _jsxs("option", { value: i.id, children: [i.name, " \u00B7 ", fmtMoney(i.price)] }, i.id))] })), _jsx(Button, { size: "sm", variant: "ghost", type: "button", icon: _jsx(Plus, { size: 15 }), onClick: () => add(), children: "\u05E4\u05E8\u05D9\u05D8 \u05D7\u05D5\u05E4\u05E9\u05D9" })] }), _jsxs("div", { className: "iedit__grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { className: "field__label", children: "\u05E4\u05D9\u05E8\u05D5\u05D8 \u05D1\u05DE\u05D9\u05DC\u05D9\u05DD" }), _jsx("textarea", { className: "input cform__ta", rows: 2, value: contents, onChange: (e) => setContents(e.target.value), placeholder: "\u05DC\u05DE\u05E9\u05DC: 12 \u05DE\u05E9\u05E4\u05D7\u05EA\u05D9\u05D5\u05EA, 6 \u05E9\u05EA\u05D9\u05D9\u05D4" })] }), o.delivery === 'delivery' && (_jsxs("label", { className: "field", children: [_jsx("span", { className: "field__label", children: "\u05D3\u05DE\u05D9 \u05DE\u05E9\u05DC\u05D5\u05D7 (\u20AA)" }), _jsx("input", { className: "input input--ltr", inputMode: "decimal", value: fee, onChange: (e) => setFee(e.target.value), placeholder: "0" })] }))] }), _jsxs("div", { className: `no-final ${hasLines && final !== calc ? 'is-manual' : ''}`, children: [_jsxs("label", { className: "field", children: [_jsx("span", { className: "field__label", children: "\u05E1\u05DB\u05D5\u05DD \u05DC\u05D7\u05D9\u05D5\u05D1 (\u05DC\u05E4\u05D9 \u05D4\u05E1\u05D2\u05D9\u05E8\u05D4 \u05DE\u05D5\u05DC \u05D4\u05DC\u05E7\u05D5\u05D7)" }), _jsx("input", { className: "input input--ltr", inputMode: "decimal", value: amount, onChange: (e) => { setAmount(e.target.value); setManual(true); setErr(''); } })] }), hasLines && (final !== calc
                        ? _jsxs("p", { className: "no-final__note", children: [_jsx("span", { className: "no-final__tag", children: "\u05E9\u05D5\u05E0\u05D4 \u05D9\u05D3\u05E0\u05D9\u05EA" }), " \u05DE\u05D7\u05D5\u05E9\u05D1: ", _jsx(Ltr, { children: fmtMoney(calc) }), " ", _jsx("button", { type: "button", className: "link", onClick: () => setManual(false), children: "\u05D7\u05D6\u05D5\u05E8 \u05DC\u05D7\u05D9\u05E9\u05D5\u05D1" })] })
                        : _jsx("p", { className: "muted no-hint", children: "\u05DE\u05EA\u05E2\u05D3\u05DB\u05DF \u05DC\u05D1\u05D3 \u05DE\u05D4\u05E4\u05E8\u05D9\u05D8\u05D9\u05DD. \u05D0\u05E4\u05E9\u05E8 \u05DC\u05D4\u05E7\u05DC\u05D9\u05D3 \u05E1\u05DB\u05D5\u05DD \u05D0\u05D7\u05E8." }))] }), err && _jsx("p", { className: "cform__err", role: "alert", children: err }), _jsxs("div", { className: "iedit__actions", children: [_jsx(Button, { variant: "primary", size: "sm", icon: _jsx(Check, { size: 15 }), onClick: submit, children: "\u05E9\u05DE\u05D5\u05E8" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: onDone, children: "\u05D1\u05D9\u05D8\u05D5\u05DC" })] })] }));
}
/* ---------- הערות פנימיות ---------- */
export function NotesSection({ o }) {
    const notes = useOrderNotes(o.id);
    const toast = useToast();
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const send = async () => {
        if (!text.trim())
            return;
        if (CARD_RE.test(text))
            return setErr('אסור לרשום כאן מספר כרטיס אשראי');
        setBusy(true);
        try {
            await addOrderNote(o.id, text);
            setText('');
        }
        catch {
            toast({ message: 'ההערה לא נשמרה – בדוק חיבור' });
        }
        setBusy(false);
    };
    const legacy = [
        ...(o.note ? [{ id: 'first', byName: o.createdBy, when: fmtDate(o.createdAt), text: o.note }] : []),
        ...o.notes.map((n, i) => ({ id: `old-${i}`, byName: n.by, when: fmtDate(n.at), text: n.text })),
    ];
    const fmtAt = (d) => `${fmtDate(toISODate(d))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const all = [...legacy, ...(notes ?? []).map((n) => ({ id: n.id, byName: n.byName, when: n.at ? fmtAt(n.at.toDate()) : 'עכשיו', text: n.text }))];
    return (_jsxs("div", { className: "notes", children: [all.length === 0 ? _jsx("p", { className: "muted", children: "\u05D0\u05D9\u05DF \u05E2\u05D3\u05D9\u05D9\u05DF \u05D4\u05E2\u05E8\u05D5\u05EA" }) : (_jsx("ol", { className: "notes__list", children: all.map((n) => (_jsxs("li", { children: [_jsxs("span", { className: "notes__meta", children: [_jsx("b", { children: n.byName }), " \u00B7 ", _jsx(Ltr, { children: n.when })] }), _jsx("p", { children: n.text })] }, n.id))) })), _jsxs("div", { className: "notes__composer", children: [_jsx("textarea", { className: "input cform__ta", rows: 2, value: text, placeholder: "\u05D4\u05D5\u05E1\u05E3 \u05D4\u05E2\u05E8\u05D4 \u05E4\u05E0\u05D9\u05DE\u05D9\u05EA (\u05E0\u05E8\u05D0\u05D9\u05EA \u05E8\u05E7 \u05D1\u05DE\u05D5\u05E7\u05D3)", "aria-label": "\u05D4\u05E2\u05E8\u05D4 \u05E4\u05E0\u05D9\u05DE\u05D9\u05EA \u05D7\u05D3\u05E9\u05D4", "aria-invalid": !!err || undefined, onChange: (e) => { setText(e.target.value); setErr(''); }, onKeyDown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            send();
                        } } }), _jsxs("div", { className: "notes__row", children: [err ? _jsx("span", { className: "cform__err", role: "alert", children: err }) : _jsx("span", { className: "kv__hint", children: "\u05D0\u05D9 \u05D0\u05E4\u05E9\u05E8 \u05DC\u05E2\u05E8\u05D5\u05DA \u05D0\u05D5 \u05DC\u05DE\u05D7\u05D5\u05E7 \u05D4\u05E2\u05E8\u05D4 \u05D0\u05D7\u05E8\u05D9 \u05D4\u05E9\u05DE\u05D9\u05E8\u05D4 \u00B7 Ctrl+Enter" }), _jsx(Button, { size: "sm", variant: "secondary", icon: _jsx(Send, { size: 14 }), loading: busy, disabled: !text.trim(), onClick: send, children: "\u05D4\u05D5\u05E1\u05E3" })] })] })] }));
}
