import { Fragment as _Fragment, jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
/* טופס לקוח – הוספה ועריכה (אפיון 6.5). מניעת כפילות תוך כדי הקלדה:
   ח.פ זהה – לא ניתן ליצור, עם קישור ללקוח הקיים. שם דומה או טלפון זהה – אזהרה, והמשתמש מחליט. */
import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import { CircleAlert, OctagonAlert, X } from 'lucide-react';
import { createCustomer, newId, primaryContact, updateCustomer, EMPTY_CUSTOMER } from '../../data/customers';
import { useLists } from '../../data/lists';
import { usePriceLists } from '../../data/priceLists';
import { Button } from '../../design/components';
import { useToast } from '../../design/Toast';
import { fmtPhone } from '../../lib/format';
import { cleanPhone, isSimilar, phoneError } from '../../lib/names';
import { cleanTaxId, taxIdError } from '../../lib/taxid';
import './CustomerForm.css';
const CARD_RE = /\d{13,}/;
export function CustomerForm({ open, onClose, customers, editing, initialName = '' }) {
    const toast = useToast();
    const nav = useNavigate();
    const { lists } = useLists();
    const { items: priceLists } = usePriceLists();
    const pc = editing ? primaryContact(editing) : undefined;
    const [f, setF] = useState(() => editing ? { ...EMPTY_CUSTOMER, ...editing } : { ...EMPTY_CUSTOMER, name: initialName });
    const [contact, setContact] = useState({ name: pc?.name ?? '', phone: pc ? fmtPhone(pc.phone) : '', email: pc?.email ?? '', role: pc?.role ?? '' });
    const [errors, setErrors] = useState({});
    const [ackWarn, setAckWarn] = useState(false);
    const [busy, setBusy] = useState(false);
    const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })); setAckWarn(false); };
    const others = customers.filter((c) => c.id !== editing?.id && c.status !== 'merged');
    const tax = cleanTaxId(f.taxId);
    const taxTwin = tax ? others.find((c) => c.taxId === tax) : undefined;
    const nameTwin = f.name.trim().length >= 3 ? others.find((c) => isSimilar(c.name, f.name)) : undefined;
    const phone = cleanPhone(contact.phone);
    const phoneTwin = phone.length >= 9 ? others.find((c) => c.contacts.some((x) => x.phone === phone) || c.accountPhone === phone) : undefined;
    const warnings = useMemo(() => {
        const w = [];
        if (nameTwin)
            w.push({ c: nameTwin, why: 'שם דומה' });
        if (phoneTwin && phoneTwin.id !== nameTwin?.id)
            w.push({ c: phoneTwin, why: 'אותו טלפון' });
        return w;
    }, [nameTwin, phoneTwin]);
    const activeMethods = (lists?.paymentMethods ?? []).filter((m) => m.active || m.id === f.paymentMethod);
    const validate = () => {
        const e = {};
        if (!f.name.trim())
            e.name = 'חובה: שם הלקוח (חברה או אדם פרטי)';
        const te = taxIdError(f.taxId);
        if (te)
            e.taxId = te;
        if (taxTwin)
            e.taxId = `ח.פ הזה כבר שייך ללקוח "${taxTwin.name}"`;
        if (!editing && !contact.name.trim())
            e.contactName = 'חובה: איש קשר';
        if (!editing && !phone)
            e.contactPhone = 'חובה: טלפון של איש הקשר';
        const pe = phoneError(contact.phone);
        if (pe)
            e.contactPhone = pe;
        if (f.paymentMethod === 'account') {
            if (!cleanPhone(f.accountPhone))
                e.accountPhone = 'חובה ללקוח הקפה: טלפון ההקפה';
            else {
                const ae = phoneError(f.accountPhone);
                if (ae)
                    e.accountPhone = ae;
            }
        }
        if (contact.email && !/^\S+@\S+\.\S+$/.test(contact.email))
            e.contactEmail = 'כתובת מייל לא תקינה';
        if (CARD_RE.test(f.instructions))
            e.instructions = 'אסור לרשום כאן מספר כרטיס אשראי';
        if (CARD_RE.test(f.billingInstructions))
            e.billingInstructions = 'אסור לרשום כאן מספר כרטיס אשראי';
        setErrors(e);
        if (Object.keys(e).length) {
            // הפוקוס עובר לשדה הראשון השגוי (אפיון 2.2)
            requestAnimationFrame(() => document.querySelector('.cform [aria-invalid="true"]')?.focus());
            return false;
        }
        return true;
    };
    const submit = async () => {
        if (!validate())
            return;
        if (warnings.length && !ackWarn) {
            setAckWarn(true);
            return;
        }
        const contacts = editing ? editing.contacts.map((c) => (c.id === pc?.id ? { ...c, name: contact.name.trim(), phone, email: contact.email.trim(), role: contact.role.trim() } : c)) : [];
        if (!editing || !pc) {
            if (contact.name.trim() || phone)
                contacts.push({ id: newId(), name: contact.name.trim(), phone, email: contact.email.trim(), role: contact.role.trim(), primary: true });
        }
        const data = { ...f, accountPhone: f.paymentMethod === 'account' ? f.accountPhone : '', contacts };
        setBusy(true);
        try {
            if (editing) {
                await updateCustomer(editing, data);
                toast({ message: 'פרטי הלקוח עודכנו' });
                onClose();
            }
            else {
                const id = await createCustomer(data);
                toast({ message: _jsxs(_Fragment, { children: ["\u05D4\u05DC\u05E7\u05D5\u05D7 \"", data.name.trim(), "\" \u05E0\u05D5\u05E1\u05E3"] }) });
                onClose();
                nav(`/customers/${id}`);
            }
        }
        catch {
            setErrors({ form: 'השמירה נכשלה. ייתכן שה-ח.פ כבר קיים אצל לקוח אחר, או שאין חיבור.' });
            setBusy(false);
        }
    };
    const err = (k) => errors[k] ? _jsx("span", { className: "cform__err", id: `ce-${k}`, role: "alert", children: errors[k] }) : null;
    const inv = (k) => ({ 'aria-invalid': !!errors[k] || undefined, 'aria-describedby': errors[k] ? `ce-${k}` : undefined });
    return (_jsx(Dialog.Root, { open: open, onOpenChange: (o) => !o && onClose(), children: _jsxs(Dialog.Portal, { children: [_jsx(Dialog.Overlay, { className: "cmd-overlay" }), _jsxs(Dialog.Content, { className: "cform", dir: "rtl", "aria-describedby": undefined, children: [_jsxs("header", { className: "cform__head", children: [_jsx(Dialog.Title, { className: "udialog__title", children: editing ? `עריכת ${editing.name}` : 'לקוח חדש' }), _jsx(Dialog.Close, { asChild: true, children: _jsx("button", { className: "icon-btn", "aria-label": "\u05E1\u05D2\u05D5\u05E8", children: _jsx(X, { size: 18 }) }) })] }), _jsxs("form", { className: "cform__body", onSubmit: (e) => { e.preventDefault(); submit(); }, noValidate: true, children: [_jsxs(Section, { title: "\u05E4\u05E8\u05D8\u05D9 \u05D4\u05DC\u05E7\u05D5\u05D7", children: [_jsxs(Row, { children: [_jsxs(L, { label: "\u05E9\u05DD", req: true, wide: true, children: [_jsx("input", { className: "input", autoFocus: true, value: f.name, onChange: (e) => set('name', e.target.value), ...inv('name') }), err('name')] }), _jsx(L, { label: "\u05E1\u05D5\u05D2 \u05DC\u05E7\u05D5\u05D7", children: _jsx("div", { className: "seg", role: "radiogroup", "aria-label": "\u05E1\u05D5\u05D2 \u05DC\u05E7\u05D5\u05D7", children: ['regular', 'occasional'].map((t) => (_jsx("button", { type: "button", role: "radio", "aria-checked": f.type === t, className: f.type === t ? 'is-on' : '', onClick: () => set('type', t), children: t === 'regular' ? 'קבוע' : 'מזדמן' }, t))) }) })] }), _jsxs(Row, { children: [_jsxs(L, { label: "\u05D7.\u05E4 / \u05E2.\u05DE", children: [_jsx("input", { className: "input input--ltr", inputMode: "numeric", value: f.taxId, onChange: (e) => set('taxId', e.target.value), ...inv('taxId') }), err('taxId'), taxTwin && _jsxs("button", { type: "button", className: "link cform__twin", onClick: () => { onClose(); nav(`/customers/${taxTwin.id}`); }, children: ["\u05E4\u05EA\u05D7 \u05D0\u05EA \"", taxTwin.name, "\""] })] }), _jsx(L, { label: "\u05DB\u05EA\u05D5\u05D1\u05EA \u05E2\u05E1\u05E7", wide: true, children: _jsx("input", { className: "input", value: f.businessAddress, onChange: (e) => set('businessAddress', e.target.value) }) })] })] }), _jsxs(Section, { title: "\u05D0\u05D9\u05E9 \u05E7\u05E9\u05E8 \u05E8\u05D0\u05E9\u05D9", children: [_jsxs(Row, { children: [_jsxs(L, { label: "\u05E9\u05DD", req: !editing, children: [_jsx("input", { className: "input", value: contact.name, onChange: (e) => { setContact({ ...contact, name: e.target.value }); setErrors((x) => ({ ...x, contactName: '' })); }, ...inv('contactName') }), err('contactName')] }), _jsx(L, { label: "\u05EA\u05E4\u05E7\u05D9\u05D3", children: _jsx("input", { className: "input", value: contact.role, onChange: (e) => setContact({ ...contact, role: e.target.value }), placeholder: "\u05DE\u05E0\u05D4\u05DC\u05EA \u05DE\u05E9\u05E8\u05D3" }) })] }), _jsxs(Row, { children: [_jsxs(L, { label: "\u05D8\u05DC\u05E4\u05D5\u05DF", req: !editing, children: [_jsx("input", { className: "input input--ltr", inputMode: "tel", value: contact.phone, onChange: (e) => { setContact({ ...contact, phone: e.target.value }); setErrors((x) => ({ ...x, contactPhone: '' })); setAckWarn(false); }, placeholder: "05X-XXXXXXX", ...inv('contactPhone') }), err('contactPhone')] }), _jsxs(L, { label: "\u05DE\u05D9\u05D9\u05DC", children: [_jsx("input", { className: "input input--ltr", type: "email", value: contact.email, onChange: (e) => setContact({ ...contact, email: e.target.value }), ...inv('contactEmail') }), err('contactEmail')] })] })] }), _jsxs(Section, { title: "\u05EA\u05E9\u05DC\u05D5\u05DD \u05D5\u05DE\u05D7\u05D9\u05E8\u05D5\u05DF", children: [_jsxs(Row, { children: [_jsx(L, { label: "\u05D0\u05DE\u05E6\u05E2\u05D9 \u05EA\u05E9\u05DC\u05D5\u05DD \u05D1\u05E8\u05D9\u05E8\u05EA \u05DE\u05D7\u05D3\u05DC", children: _jsx("div", { className: "seg", role: "radiogroup", "aria-label": "\u05D0\u05DE\u05E6\u05E2\u05D9 \u05EA\u05E9\u05DC\u05D5\u05DD", children: activeMethods.map((m) => (_jsx("button", { type: "button", role: "radio", "aria-checked": f.paymentMethod === m.id, className: f.paymentMethod === m.id ? 'is-on' : '', onClick: () => set('paymentMethod', m.id), children: m.label }, m.id))) }) }), f.paymentMethod === 'account' && (_jsxs(L, { label: "\u05D8\u05DC\u05E4\u05D5\u05DF \u05D4\u05E7\u05E4\u05D4", req: true, children: [_jsx("input", { className: "input input--ltr", inputMode: "tel", value: f.accountPhone, onChange: (e) => set('accountPhone', e.target.value), placeholder: "05X-XXXXXXX", ...inv('accountPhone') }), err('accountPhone'), cleanPhone(f.accountPhone).length >= 9 && others.some((c) => c.accountPhone === cleanPhone(f.accountPhone)) && (_jsxs("span", { className: "cform__hint", children: ["\u05D8\u05DC\u05E4\u05D5\u05DF \u05D4\u05E7\u05E4\u05D4 \u05DB\u05DC\u05DC\u05D9 \u2013 \u05DE\u05E9\u05DE\u05E9 \u05D2\u05DD \u05D0\u05EA ", others.filter((c) => c.accountPhone === cleanPhone(f.accountPhone)).map((c) => c.name).join(', ')] }))] }))] }), _jsxs(Row, { children: [_jsx(L, { label: "\u05DE\u05D7\u05D9\u05E8\u05D5\u05DF", children: _jsxs("select", { className: "input", value: f.priceListId, onChange: (e) => set('priceListId', e.target.value), children: [_jsx("option", { value: "", children: "\u05DC\u05DC\u05D0 \u05DE\u05D7\u05D9\u05E8\u05D5\u05DF" }), priceLists.filter((p) => p.active || p.id === f.priceListId).map((p) => _jsxs("option", { value: p.id, children: [p.name, p.kind === 'unique' ? ' (ייחודי)' : ''] }, p.id))] }) }), _jsx(L, { label: " ", children: _jsxs("label", { className: "check-inline cform__check", children: [_jsx("input", { type: "checkbox", checked: f.poRequired, onChange: (e) => set('poRequired', e.target.checked) }), " \u05E0\u05D3\u05E8\u05E9\u05EA \u05EA\u05E2\u05D5\u05D3\u05EA \u05E8\u05DB\u05E9 \u05DC\u05DB\u05DC \u05D4\u05D6\u05DE\u05E0\u05D4"] }) })] }), _jsxs(L, { label: "\u05D4\u05E0\u05D7\u05D9\u05D5\u05EA \u05D7\u05D9\u05D5\u05D1 \u05E7\u05D1\u05D5\u05E2\u05D5\u05EA", wide: true, children: [_jsx("textarea", { className: "input cform__ta", rows: 2, value: f.billingInstructions, onChange: (e) => set('billingInstructions', e.target.value), placeholder: "\u05DC\u05DE\u05E9\u05DC: \u05D7\u05E9\u05D1\u05D5\u05E0\u05D9\u05EA \u05DC\u05DE\u05D7\u05DC\u05E7\u05EA \u05DB\u05E1\u05E4\u05D9\u05DD, \u05DC\u05E6\u05D9\u05D9\u05DF \u05DE\u05E1' \u05EA\u05E2\u05D5\u05D3\u05EA \u05E8\u05DB\u05E9", ...inv('billingInstructions') }), err('billingInstructions')] })] }), _jsx(Section, { title: "\u05D4\u05E0\u05D7\u05D9\u05D5\u05EA \u05E7\u05D1\u05D5\u05E2\u05D5\u05EA", children: _jsxs(L, { label: "\u05DE\u05D5\u05E6\u05D2\u05D5\u05EA \u05D1\u05E8\u05D0\u05E9 \u05DB\u05DC \u05D4\u05D6\u05DE\u05E0\u05D4 \u05E9\u05DC \u05D4\u05DC\u05E7\u05D5\u05D7", wide: true, children: [_jsx("textarea", { className: "input cform__ta", rows: 2, value: f.instructions, onChange: (e) => set('instructions', e.target.value), placeholder: "\u05DC\u05DE\u05E9\u05DC: \u05DC\u05D4\u05D2\u05D9\u05E2 \u05DC\u05E9\u05E2\u05E8 \u05D4\u05D0\u05D7\u05D5\u05E8\u05D9, \u05DC\u05D4\u05EA\u05E7\u05E9\u05E8 10 \u05D3\u05E7\u05D5\u05EA \u05DC\u05E4\u05E0\u05D9", ...inv('instructions') }), err('instructions')] }) }), ackWarn && warnings.length > 0 && (_jsxs("div", { className: "cform__warn", role: "alert", children: [_jsx(CircleAlert, { size: 18, "aria-hidden": "true" }), _jsxs("div", { children: [_jsx("b", { children: "\u05D9\u05DB\u05D5\u05DC \u05DC\u05D4\u05D9\u05D5\u05EA \u05E9\u05D4\u05DC\u05E7\u05D5\u05D7 \u05DB\u05D1\u05E8 \u05E7\u05D9\u05D9\u05DD:" }), _jsx("ul", { children: warnings.map((w) => (_jsxs("li", { children: [w.why, ": ", _jsx("button", { type: "button", className: "link", onClick: () => { onClose(); nav(`/customers/${w.c.id}`); }, children: w.c.name })] }, w.c.id))) }), _jsxs("span", { children: ["\u05D0\u05DD \u05D6\u05D4 \u05DC\u05E7\u05D5\u05D7 \u05D0\u05D7\u05E8 \u2013 \u05DC\u05D7\u05E5 \u05E9\u05D5\u05D1 \u05E2\u05DC \"", editing ? 'שמור' : 'הוסף לקוח', "\"."] })] })] })), errors.form && _jsxs("p", { className: "cform__formerr", role: "alert", children: [_jsx(OctagonAlert, { size: 16, "aria-hidden": "true" }), " ", errors.form] })] }), _jsxs("footer", { className: "cform__foot", children: [_jsx(Button, { variant: "primary", loading: busy, onClick: submit, children: editing ? 'שמור' : ackWarn && warnings.length ? 'זה לקוח אחר – הוסף' : 'הוסף לקוח' }), _jsx(Dialog.Close, { asChild: true, children: _jsx(Button, { variant: "ghost", children: "\u05D1\u05D9\u05D8\u05D5\u05DC" }) }), !editing && warnings.length > 0 && !ackWarn && _jsxs("span", { className: "cform__live", children: [_jsx(CircleAlert, { size: 14, "aria-hidden": "true" }), " \u05E0\u05DE\u05E6\u05D0 \u05DC\u05E7\u05D5\u05D7 \u05D3\u05D5\u05DE\u05D4 \u2013 \u05E0\u05D1\u05D3\u05D5\u05E7 \u05DC\u05E4\u05E0\u05D9 \u05D4\u05E9\u05DE\u05D9\u05E8\u05D4"] })] })] })] }) }));
}
function Section({ title, children }) {
    return _jsxs("fieldset", { className: "cform__sec", children: [_jsx("legend", { children: title }), children] });
}
function Row({ children }) {
    return _jsx("div", { className: "cform__row", children: children });
}
function L({ label, req, wide, children }) {
    return (_jsxs("label", { className: `cform__field ${wide ? 'is-wide' : ''}`, children: [_jsxs("span", { className: "field__label", children: [label, req && _jsx("span", { className: "req", children: "\u05D7\u05D5\u05D1\u05D4" })] }), children] }));
}
