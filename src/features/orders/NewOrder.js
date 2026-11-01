import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/* יצירת הזמנה (אפיון 4.3, 4.4, 4.6, 6.4) – חלון אחד, שתי דרכים:
   הזמנה – ללקוח קיים: כל הפרטים בעמוד אחד. בחירת לקוח טוענת את הקבוע אצלו (תשלום, הקפה, כתובת, איש קשר).
   לקוח חדש – מקים לקוח והזמנה באותה שמירה.
   פרט חובה שחסר לא חוסם: אחרי אישור ההזמנה נשמרת ומסומנת באדום עד שמשלימים. Ctrl+Enter שומר. */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown, CircleAlert, ClipboardList, Minus, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { useAuth } from '../../auth/AuthContext';
import { useBranches, useClusters } from '../../data/branches';
import { EMPTY_CUSTOMER, newId, primaryContact, useCustomers } from '../../data/customers';
import { useLists } from '../../data/lists';
import { createOrder, findDuplicate } from '../../data/orders';
import { usePriceLists } from '../../data/priceLists';
import { useStore } from '../../data/store';
import { METHOD_LABEL, STATUS_LABEL } from '../../data/types';
import { Button } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, fmtDate, fmtMoney, fmtPhone, toISODate, weekday } from '../../lib/format';
import { cleanPhone, isSimilar, phoneError } from '../../lib/names';
import { cleanTaxId, taxIdError } from '../../lib/taxid';
import { BranchPicker } from '../branches/BranchPicker';
import { uploadOrderDoc } from '../../data/orderDocs';
import { FileDrop } from './OrderDocs';
import { keepOpenOnToast } from '../../app/ErrorBoundary';
import '../customers/CustomerForm.css';
import './NewOrder.css';
const CARD_RE = /\d{13,}/;
const MODES = [
    ['full', 'הזמנה', _jsx(ClipboardList, { size: 16 }, "f")],
    ['newCustomer', 'לקוח חדש', _jsx(UserPlus, { size: 16 }, "n")],
];
const START_STATUS = ['new', 'pending_customer', 'approved'];
const MISS = 'חסר – אפשר להשלים אחר כך';
const MISS_LABEL = {
    ncContact: 'איש קשר', contactName: 'איש קשר', ncPhone: 'טלפון', contactPhone: 'טלפון', time: 'שעה', branch: 'סניף',
    channel: 'ערוץ', address: 'כתובת', final: 'סכום', amount: 'סכום', account: 'טלפון הקפה', ncAccount: 'טלפון הקפה',
};
const money = (s) => Number(s.replace(/[^\d.]/g, '')) || 0;
export function NewOrderDialog() {
    const { newOrder, closeNewOrder } = useStore();
    if (!newOrder)
        return null;
    return _jsx(NewOrderForm, { initial: newOrder, onClose: closeNewOrder }, JSON.stringify(newOrder));
}
function NewOrderForm({ initial, onClose }) {
    const toast = useToast();
    const panel = usePanel();
    const reduce = useReducedMotion();
    const { profile } = useAuth();
    const { orders, now, thresholds } = useStore();
    const { items: customers } = useCustomers();
    const { items: branches } = useBranches();
    const { items: clusters } = useClusters();
    const { items: priceLists } = usePriceLists();
    const { lists } = useLists();
    const today = toISODate(now);
    const tomorrow = toISODate(new Date(now.getTime() + 86400000));
    const [mode, setMode] = useState(initial.customerName || initial.mode === 'newCustomer' ? 'newCustomer' : 'full');
    const [customerId, setCustomerId] = useState(initial.customerId ?? '');
    const [nc, setNc] = useState({ name: initial.customerName ?? '', type: 'occasional', taxId: '', contactName: '', contactPhone: '', paymentMethod: 'credit', accountPhone: '' });
    const [date, setDate] = useState(initial.date ?? today);
    const [time, setTime] = useState('');
    const [branch, setBranch] = useState(null);
    const [delivery, setDelivery] = useState('delivery');
    const [addressId, setAddressId] = useState('');
    const [address, setAddress] = useState('');
    const [contactId, setContactId] = useState('');
    const [contact, setContact] = useState({ name: '', phone: '' });
    const [amount, setAmount] = useState('');
    const [contents, setContents] = useState('');
    const [fee, setFee] = useState('');
    const [override, setOverride] = useState(null); // סכום לחיוב שהוקלד ידנית
    const [poFile, setPoFile] = useState(null);
    const [lines, setLines] = useState([]);
    const [status, setStatus] = useState('new');
    const [channel, setChannel] = useState('');
    const [method, setMethod] = useState('');
    const [accountPhone, setAccountPhone] = useState('');
    const [poNumber, setPoNumber] = useState('');
    const [instructions, setInstructions] = useState('');
    const [note, setNote] = useState('');
    const [errors, setErrors] = useState({});
    const [ackDup, setAckDup] = useState(false);
    const [ackSimilar, setAckSimilar] = useState(false);
    const [ackMissing, setAckMissing] = useState(false);
    const [busy, setBusy] = useState(false);
    const formRef = useRef(null);
    const isNew = mode === 'newCustomer';
    const c = isNew ? undefined : customers.find((x) => x.id === customerId);
    const priceList = c ? priceLists.find((p) => p.id === c.priceListId) : undefined;
    const branchObj = branches.find((b) => b.id === branch?.branchId);
    const clearErr = (...k) => setErrors((e) => { const n = { ...e }; k.forEach((x) => delete n[x]); return n; });
    // בחירת לקוח טוענת את כל מה שקבוע אצלו: תשלום, טלפון הקפה, כתובת, איש קשר, הנחיות, סניף מועדף
    useEffect(() => {
        if (!c)
            return;
        const addr = c.addresses[0];
        const pc = primaryContact(c);
        setMethod(c.paymentMethod);
        setAccountPhone(c.accountPhone ? fmtPhone(c.accountPhone) : '');
        setAddressId(addr?.id ?? '');
        setAddress(addr?.address ?? c.businessAddress ?? '');
        setContactId(pc?.id ?? '');
        setContact({ name: pc?.name ?? '', phone: pc?.phone ? fmtPhone(pc.phone) : '' });
        setInstructions(c.instructions);
        if (addr?.preferredBranchId && branches.some((b) => b.id === addr.preferredBranchId)) {
            const b = branches.find((x) => x.id === addr.preferredBranchId);
            setBranch((cur) => cur ?? { branchId: b.id, clusterId: b.clusterId });
        }
        setLines([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [c?.id]);
    /* ערוץ ההזמנה נכתב ידנית (וואטסאפ, מכירות, מוקד, WellBe…). ההצעות רק משלימות הקלדה. */
    const channelHints = useMemo(() => [...new Set([...(lists?.channels ?? []).filter((x) => x.active).map((x) => x.label), ...orders.map((o) => o.channel).filter(Boolean)])].slice(0, 30), [lists, orders]);
    /* ---------- פריטים ומחיר ---------- */
    const catalog = useMemo(() => (priceList?.items ?? []).filter((i) => i.active).map((i) => ({
        ...i, price: c?.customPrices.find((p) => p.itemId === i.id)?.price ?? i.price, custom: c?.customPrices.some((p) => p.itemId === i.id),
    })), [priceList, c]);
    const linesTotal = lines.reduce((t, l) => t + l.qty * l.unitPrice, 0);
    const useLines = lines.length > 0;
    // דמי המשלוח נוספים לסכום הפריטים
    const feeValue = delivery === 'delivery' ? money(fee) : 0;
    const total = (useLines ? linesTotal : money(amount)) + feeValue;
    const canOverride = lines.length > 0 || feeValue > 0;
    const finalAmount = canOverride && override !== null ? money(override) : total;
    const isManual = canOverride && override !== null && finalAmount !== total;
    const addLine = (itemId) => {
        const it = catalog.find((x) => x.id === itemId);
        setLines((ls) => [...ls, { key: newId(), itemId: it?.id, name: it?.name ?? '', qty: 1, unitPrice: it?.price ?? 0 }]);
        clearErr('amount');
    };
    const setLine = (key, p) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
    /* ---------- כפילויות ---------- */
    const dup = isNew ? undefined : findDuplicate(orders, { customerId, date, time, branchId: branch?.branchId ?? '' }, thresholds.nearMinutes);
    const ncPhone = cleanPhone(nc.contactPhone);
    const ncTax = cleanTaxId(nc.taxId);
    const taxTwin = isNew && ncTax ? customers.find((x) => x.taxId === ncTax && x.status !== 'merged') : undefined;
    const similar = useMemo(() => {
        if (!isNew)
            return [];
        const out = [];
        customers.filter((x) => x.status !== 'merged').forEach((x) => {
            if (nc.name.trim().length >= 3 && isSimilar(x.name, nc.name))
                out.push({ c: x, why: 'שם דומה' });
            else if (ncPhone.length >= 9 && (x.contacts.some((p) => p.phone === ncPhone) || x.accountPhone === ncPhone))
                out.push({ c: x, why: 'אותו טלפון' });
        });
        return out.slice(0, 3);
    }, [isNew, customers, nc.name, ncPhone]);
    const pickExisting = (x) => { setCustomerId(x.id); setMode('full'); setErrors({}); setAckSimilar(false); };
    const methods = (lists?.paymentMethods ?? []).filter((m) => m.active || m.id === method || m.id === nc.paymentMethod);
    const effMethod = isNew ? nc.paymentMethod : method;
    const effAccountPhone = isNew ? nc.accountPhone : accountPhone;
    const methodLabel = methods.find((m) => m.id === effMethod)?.label ?? METHOD_LABEL[effMethod] ?? effMethod;
    /* ---------- בדיקה ושמירה ---------- */
    /* שני סוגי בעיות: שגיאה (חוסמת – למשל ח.פ שגוי או מספר כרטיס) ופרט חסר (לא חוסם – אחרי אישור נשמר ומסומן באדום). */
    const validate = () => {
        const e = {};
        const m = {};
        if (isNew) {
            if (!nc.name.trim())
                e.ncName = 'חובה: שם הלקוח';
            const te = taxIdError(nc.taxId);
            if (te)
                e.ncTax = te;
            if (taxTwin)
                e.ncTax = `ח.פ הזה כבר שייך ל"${taxTwin.name}"`;
            if (!nc.contactName.trim())
                m.ncContact = MISS;
            if (!ncPhone)
                m.ncPhone = MISS;
            else {
                const pe = phoneError(nc.contactPhone);
                if (pe)
                    e.ncPhone = pe;
            }
        }
        else {
            if (!c)
                e.customer = 'חובה: בחר לקוח';
            if (!contact.name.trim())
                m.contactName = MISS;
            if (!contact.phone.trim())
                m.contactPhone = MISS;
            else {
                const pe = phoneError(contact.phone);
                if (pe)
                    e.contactPhone = pe;
            }
        }
        if (!date)
            e.date = 'חובה: תאריך אספקה';
        else if (date < today)
            e.date = 'התאריך כבר עבר';
        if (!time)
            m.time = MISS;
        else if (!/^\d{2}:\d{2}$/.test(time))
            e.time = 'שעה לא תקינה';
        if (!branch)
            m.branch = MISS;
        if (!channel.trim())
            m.channel = MISS;
        else if (CARD_RE.test(channel))
            e.channel = 'אסור לרשום כאן מספר כרטיס אשראי';
        if (delivery === 'delivery' && !address.trim())
            m.address = MISS;
        if (isManual && finalAmount <= 0)
            m.final = MISS;
        if (total - feeValue <= 0)
            m.amount = lines.length ? 'סכום הפריטים הוא 0' : MISS;
        if (useLines && lines.some((l) => !l.name.trim() || l.qty <= 0))
            e.amount = 'לכל פריט צריך שם וכמות';
        if (effMethod === 'account') {
            if (!cleanPhone(effAccountPhone))
                m[isNew ? 'ncAccount' : 'account'] = MISS;
            else {
                const pe = phoneError(effAccountPhone);
                if (pe)
                    e[isNew ? 'ncAccount' : 'account'] = pe;
            }
        }
        if (CARD_RE.test(poNumber))
            e.po = 'אסור לרשום כאן מספר כרטיס אשראי';
        if (CARD_RE.test(contents))
            e.contents = 'אסור לרשום כאן מספר כרטיס אשראי';
        if (CARD_RE.test(note))
            e.note = 'אסור לרשום כאן מספר כרטיס אשראי';
        if (CARD_RE.test(instructions))
            e.instructions = 'אסור לרשום כאן מספר כרטיס אשראי';
        if (CARD_RE.test(address))
            e.address = 'אסור לרשום כאן מספר כרטיס אשראי';
        setErrors({ ...m, ...e });
        const focusFirst = () => requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
        if (Object.keys(e).length) {
            focusFirst();
            return false;
        }
        const missList = Object.keys(m).map((k) => MISS_LABEL[k]).filter((x, i, a) => x && a.indexOf(x) === i);
        if (missList.length && !ackMissing) {
            setAckMissing(true);
            focusFirst();
            return false;
        }
        return true;
    };
    const submit = async () => {
        if (busy || !validate())
            return;
        if (dup && !ackDup) {
            setAckDup(true);
            return;
        }
        if (similar.length && !ackSimilar) {
            setAckSimilar(true);
            return;
        }
        const b = branchObj; // אפשר לשמור בלי סניף – ההזמנה תסומן באדום עד שישובץ
        const customerName = isNew ? nc.name.trim() : c.name;
        const input = {
            customerId: c?.id ?? '',
            customerName,
            date, time,
            branchId: b?.id ?? '', branchName: b?.name ?? '', branchPhone: b?.phone ?? '',
            cluster: b ? clusters.find((x) => x.id === b.clusterId)?.name ?? '' : '',
            amount: finalAmount,
            calcAmount: isManual ? total : undefined,
            status,
            payment: 'pending',
            method: effMethod,
            methodLabel,
            accountPhone: effMethod === 'account' ? cleanPhone(effAccountPhone) : undefined,
            handler: profile?.name ?? '',
            handlerUid: profile?.uid,
            channel: channel.trim(),
            delivery,
            address: delivery === 'delivery' ? address.trim() || undefined : undefined,
            contactName: (isNew ? nc.contactName : contact.name).trim() || undefined,
            contactPhone: cleanPhone(isNew ? nc.contactPhone : contact.phone) || undefined,
            poRequired: !!c?.poRequired,
            poNumber: poNumber.trim() || undefined,
            items: useLines ? lines.map(({ key: _k, itemId, ...l }) => ({ ...(itemId ? { itemId } : {}), ...l, name: l.name.trim() })) : [],
            contents: contents.trim() || undefined,
            deliveryFee: feeValue || undefined,
            instructions: instructions.trim() || undefined,
            note: note.trim() || undefined,
            billingNote: c?.billingInstructions || undefined,
        };
        const draft = isNew ? {
            ...EMPTY_CUSTOMER,
            name: nc.name.trim(), type: nc.type, taxId: ncTax, paymentMethod: nc.paymentMethod,
            accountPhone: nc.paymentMethod === 'account' ? cleanPhone(nc.accountPhone) : '',
            contacts: nc.contactName.trim() || ncPhone ? [{ id: newId(), name: nc.contactName.trim(), role: '', phone: ncPhone, email: '', primary: true }] : [],
            addresses: delivery === 'delivery' && address.trim() ? [{ id: newId(), label: 'כתובת אספקה', address: address.trim(), directions: '', preferredBranchId: b?.id ?? '' }] : [],
            instructions: instructions.trim(),
        } : undefined;
        setBusy(true);
        try {
            const n = await createOrder(input, draft);
            if (poFile) {
                // הקובץ נשמר אחרי ההזמנה; אם נכשל – ההזמנה כבר שמורה ואפשר לצרף שוב מהתיק
                await uploadOrderDoc(n, poFile, input.customerId || '').catch(() => toast({ message: _jsxs(_Fragment, { children: ["\u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05E0\u05E9\u05DE\u05E8\u05D4, \u05D0\u05D1\u05DC \u05E6\u05D9\u05E8\u05D5\u05E3 \u05EA\u05E2\u05D5\u05D3\u05EA \u05D4\u05E8\u05DB\u05E9 \u05E0\u05DB\u05E9\u05DC \u2013 \u05D0\u05E4\u05E9\u05E8 \u05DC\u05E6\u05E8\u05E3 \u05D0\u05D5\u05EA\u05D4 \u05DE\u05EA\u05D9\u05E7 \u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: n })] }) }));
            }
            toast({
                message: _jsxs(_Fragment, { children: ["\u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: n }), " \u05E0\u05E9\u05DE\u05E8\u05D4 \u00B7 ", customerName, " \u00B7 ", date === today ? 'היום' : date === tomorrow ? 'מחר' : _jsx(Ltr, { children: fmtDate(date) }), " ", _jsx(Ltr, { children: time }), ackMissing && missNow.length > 0 && _jsxs(_Fragment, { children: [" \u00B7 ", _jsx("b", { children: "\u05D7\u05E1\u05E8\u05D9\u05DD \u05E4\u05E8\u05D8\u05D9\u05DD \u2013 \u05DE\u05E1\u05D5\u05DE\u05E0\u05EA \u05D1\u05D0\u05D3\u05D5\u05DD" })] })] }),
                action: { label: 'פתח תיק', run: () => panel.open(n) },
            });
            onClose();
        }
        catch {
            setErrors({ form: 'השמירה נכשלה – בדוק חיבור ונסה שוב. שום דבר לא נשמר.' });
            setBusy(false);
        }
    };
    const err = (k) => errors[k] ? _jsx("span", { className: "cform__err", id: `no-${k}`, role: "alert", children: errors[k] }) : null;
    const inv = (k) => ({ 'aria-invalid': !!errors[k] || undefined, 'aria-describedby': errors[k] ? `no-${k}` : undefined });
    const missNow = [...new Set(Object.entries(errors).filter(([k, v]) => v === MISS || (k === 'amount' && v === 'סכום הפריטים הוא 0')).map(([k]) => MISS_LABEL[k]))];
    const fade = reduce ? { initial: { opacity: 0 }, animate: { opacity: 1 } } : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 } };
    /* ---------- חלקי הטופס ---------- */
    const whenSection = (_jsxs(Row, { children: [_jsxs(L, { label: "\u05EA\u05D0\u05E8\u05D9\u05DA \u05D0\u05E1\u05E4\u05E7\u05D4", req: true, children: [_jsxs("div", { className: "no-date", children: [_jsx("input", { type: "date", className: "input input--ltr", value: date, min: today, onChange: (e) => { setDate(e.target.value); clearErr('date'); setAckDup(false); }, ...inv('date') }), _jsxs("div", { className: "seg", role: "group", "aria-label": "\u05E7\u05D9\u05E6\u05D5\u05E8 \u05EA\u05D0\u05E8\u05D9\u05DA", children: [_jsx("button", { type: "button", className: date === today ? 'is-on' : '', "aria-pressed": date === today, onClick: () => { setDate(today); clearErr('date'); }, children: "\u05D4\u05D9\u05D5\u05DD" }), _jsx("button", { type: "button", className: date === tomorrow ? 'is-on' : '', "aria-pressed": date === tomorrow, onClick: () => { setDate(tomorrow); clearErr('date'); }, children: "\u05DE\u05D7\u05E8" })] })] }), date && !errors.date && _jsxs("span", { className: "cform__hint muted", children: ["\u05D9\u05D5\u05DD ", weekday(date)] }), err('date')] }), _jsxs(L, { label: "\u05E9\u05E2\u05D4", req: true, children: [_jsx("input", { type: "time", step: 900, className: "input input--ltr no-time", value: time, onChange: (e) => { setTime(e.target.value); clearErr('time'); setAckDup(false); }, ...inv('time') }), err('time')] })] }));
    const branchField = (_jsxs("div", { className: "cform__field", ...(errors.branch ? { 'data-invalid': true } : {}), children: [_jsx(BranchPicker, { label: "\u05E1\u05E0\u05D9\u05E3 (\u05D7\u05D5\u05D1\u05D4)", value: branch, onChange: (v) => { setBranch(v); clearErr('branch'); setAckDup(false); }, preferredId: c?.addresses.find((a) => a.id === addressId)?.preferredBranchId }), err('branch')] }));
    const statusField = (_jsx(L, { label: "\u05E1\u05D8\u05D8\u05D5\u05E1", group: true, children: _jsx("div", { className: "seg", role: "radiogroup", "aria-label": "\u05E1\u05D8\u05D8\u05D5\u05E1 \u05D4\u05EA\u05D7\u05DC\u05EA\u05D9", children: START_STATUS.map((s) => _jsx("button", { type: "button", role: "radio", "aria-checked": status === s, className: status === s ? 'is-on' : '', onClick: () => setStatus(s), children: STATUS_LABEL[s] }, s)) }) }));
    const deliveryFields = (_jsxs(_Fragment, { children: [_jsxs(Row, { children: [_jsx(L, { label: "\u05E1\u05D5\u05D2", group: true, children: _jsxs("div", { className: "seg", role: "radiogroup", "aria-label": "\u05DE\u05E9\u05DC\u05D5\u05D7 \u05D0\u05D5 \u05D0\u05D9\u05E1\u05D5\u05E3", children: [_jsx("button", { type: "button", role: "radio", "aria-checked": delivery === 'delivery', className: delivery === 'delivery' ? 'is-on' : '', onClick: () => setDelivery('delivery'), children: "\u05DE\u05E9\u05DC\u05D5\u05D7" }), _jsx("button", { type: "button", role: "radio", "aria-checked": delivery === 'pickup', className: delivery === 'pickup' ? 'is-on' : '', onClick: () => setDelivery('pickup'), children: "\u05D0\u05D9\u05E1\u05D5\u05E3 \u05E2\u05E6\u05DE\u05D9" })] }) }), !isNew && c && c.contacts.length > 1 && (_jsx(L, { label: "\u05DE\u05D0\u05E0\u05E9\u05D9 \u05D4\u05E7\u05E9\u05E8 \u05E9\u05DC \u05D4\u05DC\u05E7\u05D5\u05D7", children: _jsx("select", { className: "input", value: contactId, onChange: (e) => { const p = c.contacts.find((x) => x.id === e.target.value); setContactId(e.target.value); setContact({ name: p?.name ?? '', phone: p?.phone ? fmtPhone(p.phone) : '' }); clearErr('contactPhone'); }, children: c.contacts.map((p) => _jsxs("option", { value: p.id, children: [p.name, p.phone ? ` · ${fmtPhone(p.phone)}` : ''] }, p.id)) }) }))] }), !isNew && (_jsxs(Row, { children: [_jsxs(L, { label: "\u05D0\u05D9\u05E9 \u05E7\u05E9\u05E8 \u05DC\u05E7\u05D1\u05DC\u05EA \u05D4\u05D4\u05D6\u05DE\u05E0\u05D4", req: true, children: [_jsx("input", { className: "input", value: contact.name, onChange: (e) => { setContact({ ...contact, name: e.target.value }); setContactId(''); clearErr('contactName'); }, placeholder: "\u05DE\u05D9 \u05DE\u05E7\u05D1\u05DC \u05D0\u05EA \u05D4\u05D4\u05D6\u05DE\u05E0\u05D4", ...inv('contactName') }), err('contactName')] }), _jsxs(L, { label: "\u05D8\u05DC\u05E4\u05D5\u05DF", req: true, children: [_jsx("input", { className: "input input--ltr", inputMode: "tel", value: contact.phone, onChange: (e) => { setContact({ ...contact, phone: e.target.value }); setContactId(''); clearErr('contactPhone'); }, placeholder: "05X-XXXXXXX", ...inv('contactPhone') }), err('contactPhone')] })] })), delivery === 'delivery' && (_jsxs(Row, { children: [!isNew && c && c.addresses.length > 1 && (_jsx(L, { label: "\u05DB\u05EA\u05D5\u05D1\u05EA \u05E9\u05DE\u05D5\u05E8\u05D4", children: _jsx("select", { className: "input", value: addressId, onChange: (e) => { const a = c.addresses.find((x) => x.id === e.target.value); setAddressId(e.target.value); setAddress(a?.address ?? ''); }, children: c.addresses.map((a) => _jsx("option", { value: a.id, children: a.label || a.address }, a.id)) }) })), _jsxs(L, { label: "\u05DB\u05EA\u05D5\u05D1\u05EA \u05D0\u05E1\u05E4\u05E7\u05D4", wide: !(c && c.addresses.length > 1), children: [_jsx("input", { className: "input", value: address, onChange: (e) => { setAddress(e.target.value); clearErr('address'); }, placeholder: "\u05E8\u05D7\u05D5\u05D1, \u05DE\u05E1\u05E4\u05E8, \u05E2\u05D9\u05E8", ...inv('address') }), err('address')] })] }))] }));
    const itemsSection = (_jsxs(Section, { title: "\u05E4\u05E8\u05D9\u05D8\u05D9\u05DD \u05D5\u05DE\u05D7\u05D9\u05E8", aside: _jsxs("span", { className: "no-total", children: [isManual ? 'לחיוב' : 'סה״כ', " ", _jsx("b", { children: _jsx(Ltr, { children: fmtMoney(finalAmount) }) })] }), children: [lines.length > 0 && (_jsxs("table", { className: "no-items", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u05E4\u05E8\u05D9\u05D8" }), _jsx("th", { children: "\u05DB\u05DE\u05D5\u05EA" }), _jsx("th", { children: "\u05DE\u05D7\u05D9\u05E8 \u05DC\u05D9\u05D7\u05F3" }), _jsx("th", { className: "num", children: "\u05E1\u05D4\u05F4\u05DB" }), _jsx("th", { children: _jsx("span", { className: "sr-only", children: "\u05D4\u05E1\u05E8" }) })] }) }), _jsx("tbody", { children: _jsx(AnimatePresence, { initial: false, children: lines.map((l) => {
                                const it = catalog.find((x) => x.id === l.itemId);
                                return (_jsxs(motion.tr, { layout: !reduce, initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.16 }, children: [_jsx("td", { children: l.itemId ? _jsxs("span", { className: "no-items__name", children: [l.name, it?.custom && _jsx("span", { className: "pricecell__tag", children: "\u05DE\u05D7\u05D9\u05E8 \u05DC\u05DC\u05E7\u05D5\u05D7" })] })
                                                : _jsx("input", { className: "input input--sm", value: l.name, onChange: (e) => setLine(l.key, { name: e.target.value }), placeholder: "\u05E9\u05DD \u05D4\u05E4\u05E8\u05D9\u05D8", "aria-label": "\u05E9\u05DD \u05D4\u05E4\u05E8\u05D9\u05D8" }) }), _jsx("td", { children: _jsxs("div", { className: "stepper", children: [_jsx("button", { type: "button", "aria-label": "\u05D4\u05E4\u05D7\u05EA", onClick: () => setLine(l.key, { qty: Math.max(1, l.qty - 1) }), children: _jsx(Minus, { size: 14 }) }), _jsx("input", { className: "input input--sm input--ltr", inputMode: "numeric", value: l.qty, onChange: (e) => setLine(l.key, { qty: Number(e.target.value.replace(/\D/g, '')) || 0 }), "aria-label": `כמות ${l.name}` }), _jsx("button", { type: "button", "aria-label": "\u05D4\u05D5\u05E1\u05E3", onClick: () => setLine(l.key, { qty: l.qty + 1 }), children: _jsx(Plus, { size: 14 }) })] }) }), _jsx("td", { children: _jsx("input", { className: "input input--sm input--ltr no-items__price", inputMode: "decimal", value: l.unitPrice, onChange: (e) => setLine(l.key, { unitPrice: money(e.target.value) }), "aria-label": `מחיר ליחידה ${l.name}` }) }), _jsx("td", { className: "num", children: _jsx(Ltr, { children: fmtMoney(l.qty * l.unitPrice) }) }), _jsx("td", { children: _jsx("button", { type: "button", className: "icon-btn", "aria-label": `הסר ${l.name || 'פריט'}`, onClick: () => setLines((ls) => ls.filter((x) => x.key !== l.key)), children: _jsx(Trash2, { size: 16 }) }) })] }, l.key));
                            }) }) })] })), catalog.length > 0 && (_jsx("div", { className: "no-quick", role: "group", "aria-label": "\u05D4\u05D5\u05E1\u05E4\u05D4 \u05DE\u05D4\u05D9\u05E8\u05D4 \u05DE\u05D4\u05DE\u05D7\u05D9\u05E8\u05D5\u05DF", children: catalog.slice(0, 8).map((i) => (_jsxs("button", { type: "button", className: "chip", onClick: () => addLine(i.id), children: [_jsx(Plus, { size: 14, "aria-hidden": "true" }), " ", i.name, " ", _jsx("span", { className: "muted", children: _jsx(Ltr, { children: fmtMoney(i.price) }) })] }, i.id))) })), _jsxs("div", { className: "no-add", children: [catalog.length > 8 && (_jsxs("select", { className: "input no-add__pick", value: "", onChange: (e) => e.target.value && addLine(e.target.value), "aria-label": `הוסף פריט מהמחירון ${priceList?.name ?? ''}`, children: [_jsxs("option", { value: "", children: ["+ \u05E2\u05D5\u05D3 \u05E4\u05E8\u05D9\u05D8\u05D9\u05DD \u05DE\u05D4\u05DE\u05D7\u05D9\u05E8\u05D5\u05DF \"", priceList?.name, "\""] }), catalog.map((i) => _jsxs("option", { value: i.id, children: [i.name, " \u00B7 ", fmtMoney(i.price), i.custom ? ' (מחיר ללקוח)' : ''] }, i.id))] })), _jsx(Button, { size: "sm", variant: "ghost", type: "button", icon: _jsx(Plus, { size: 16 }), onClick: () => addLine(), children: catalog.length ? 'פריט שלא במחירון' : 'הוסף פריט' })] }), lines.length === 0 && (_jsxs(Row, { children: [_jsxs(L, { label: catalog.length ? 'או סכום כולל (₪, כולל מע״מ)' : 'סכום הפריטים (₪, כולל מע״מ)', req: true, children: [_jsx("input", { className: "input input--ltr", inputMode: "decimal", value: amount, onChange: (e) => { setAmount(e.target.value); clearErr('amount'); }, placeholder: "0", ...inv('amount') }), err('amount')] }), !isNew && !priceList && c && _jsx("p", { className: "muted no-hint", children: "\u05DC\u05DC\u05E7\u05D5\u05D7 \u05D0\u05D9\u05DF \u05DE\u05D7\u05D9\u05E8\u05D5\u05DF \u2013 \u05D0\u05E4\u05E9\u05E8 \u05DC\u05E9\u05D9\u05D9\u05DA \u05DE\u05D7\u05D9\u05E8\u05D5\u05DF \u05D1\u05EA\u05D9\u05E7 \u05D4\u05DC\u05E7\u05D5\u05D7." })] })), lines.length > 0 && err('amount'), delivery === 'delivery' && (_jsx(Row, { children: _jsx(L, { label: "\u05D3\u05DE\u05D9 \u05DE\u05E9\u05DC\u05D5\u05D7 (\u20AA)", children: _jsx("input", { className: "input input--ltr", inputMode: "decimal", value: fee, onChange: (e) => setFee(e.target.value), placeholder: "0" }) }) })), canOverride && (_jsxs("div", { className: `no-final ${isManual ? 'is-manual' : ''}`, children: [_jsxs(L, { label: "\u05E1\u05DB\u05D5\u05DD \u05DC\u05D7\u05D9\u05D5\u05D1 (\u05DC\u05E4\u05D9 \u05D4\u05E1\u05D2\u05D9\u05E8\u05D4 \u05DE\u05D5\u05DC \u05D4\u05DC\u05E7\u05D5\u05D7)", children: [_jsx("input", { className: "input input--ltr", inputMode: "decimal", value: override ?? String(total), onChange: (e) => { setOverride(e.target.value); clearErr('final'); }, ...inv('final') }), err('final')] }), isManual ? (_jsxs("p", { className: "no-final__note", children: [_jsx("span", { className: "no-final__tag", children: "\u05E9\u05D5\u05E0\u05D4 \u05D9\u05D3\u05E0\u05D9\u05EA" }), " \u05DE\u05D7\u05D5\u05E9\u05D1: ", _jsx(Ltr, { children: fmtMoney(total) }), _jsx("button", { type: "button", className: "link", onClick: () => setOverride(null), children: "\u05D7\u05D6\u05D5\u05E8 \u05DC\u05D7\u05D9\u05E9\u05D5\u05D1" })] })) : _jsxs("p", { className: "muted no-hint", children: ["\u05DE\u05EA\u05E2\u05D3\u05DB\u05DF \u05DC\u05D1\u05D3 \u05DE\u05D4\u05E4\u05E8\u05D9\u05D8\u05D9\u05DD", feeValue ? ' ודמי המשלוח' : '', ". \u05D0\u05E4\u05E9\u05E8 \u05DC\u05D4\u05E7\u05DC\u05D9\u05D3 \u05E1\u05DB\u05D5\u05DD \u05D0\u05D7\u05E8."] })] })), _jsxs(L, { label: lines.length ? 'פירוט נוסף (לא חובה)' : 'תכולת ההזמנה', wide: true, children: [_jsx("textarea", { className: "input cform__ta", rows: 2, value: contents, onChange: (e) => { setContents(e.target.value); clearErr('contents'); }, placeholder: "\u05DC\u05DE\u05E9\u05DC: 12 \u05DE\u05E9\u05E4\u05D7\u05EA\u05D9\u05D5\u05EA (6 \u05D6\u05D9\u05EA\u05D9\u05DD, 6 \u05E4\u05D8\u05E8\u05D9\u05D5\u05EA), 10 \u05DC\u05D7\u05DD \u05E9\u05D5\u05DD, 6 \u05E9\u05EA\u05D9\u05D9\u05D4 1.5 \u05DC'", ...inv('contents') }), err('contents')] }), _jsx("p", { className: "muted no-hint", children: "\u05D4\u05DE\u05D7\u05D9\u05E8 \u05E0\u05E9\u05DE\u05E8 \u05D1\u05EA\u05D5\u05DA \u05D4\u05D4\u05D6\u05DE\u05E0\u05D4. \u05E9\u05D9\u05E0\u05D5\u05D9 \u05DE\u05D7\u05D9\u05E8\u05D5\u05DF \u05D1\u05E2\u05EA\u05D9\u05D3 \u05DC\u05D0 \u05D9\u05E9\u05E0\u05D4 \u05D0\u05D5\u05EA\u05D4." })] }));
    const paymentFields = (_jsxs(Row, { children: [_jsxs(L, { label: "\u05D0\u05DE\u05E6\u05E2\u05D9 \u05EA\u05E9\u05DC\u05D5\u05DD", group: true, children: [_jsx("div", { className: "seg", role: "radiogroup", "aria-label": "\u05D0\u05DE\u05E6\u05E2\u05D9 \u05EA\u05E9\u05DC\u05D5\u05DD", children: methods.map((m) => (_jsx("button", { type: "button", role: "radio", "aria-checked": effMethod === m.id, className: effMethod === m.id ? 'is-on' : '', onClick: () => { if (isNew)
                                setNc({ ...nc, paymentMethod: m.id });
                            else
                                setMethod(m.id); clearErr('account', 'ncAccount'); }, children: m.label }, m.id))) }), c && (method === c.paymentMethod
                        ? _jsxs("span", { className: "cform__hint muted", children: [_jsx(Check, { size: 12, "aria-hidden": "true" }), " \u05D0\u05DE\u05E6\u05E2\u05D9 \u05D4\u05EA\u05E9\u05DC\u05D5\u05DD \u05D4\u05E7\u05D1\u05D5\u05E2 \u05E9\u05DC \u05D4\u05DC\u05E7\u05D5\u05D7"] })
                        : _jsxs("span", { className: "cform__hint", children: ["\u05E9\u05D5\u05E0\u05D4 \u05D1\u05D4\u05D6\u05DE\u05E0\u05D4 \u05D4\u05D6\u05D5 \u05D1\u05DC\u05D1\u05D3 \u00B7 \u05D4\u05E7\u05D1\u05D5\u05E2 \u05E9\u05DC \u05D4\u05DC\u05E7\u05D5\u05D7: ", methods.find((m) => m.id === c.paymentMethod)?.label ?? METHOD_LABEL[c.paymentMethod] ?? c.paymentMethod, " ", _jsx("button", { type: "button", className: "link", onClick: () => { setMethod(c.paymentMethod); setAccountPhone(c.accountPhone ? fmtPhone(c.accountPhone) : ''); }, children: "\u05D7\u05D6\u05D5\u05E8 \u05DC\u05E7\u05D1\u05D5\u05E2" })] })), isNew && _jsx("span", { className: "cform__hint muted", children: "\u05D9\u05D9\u05E9\u05DE\u05E8 \u05DB\u05D0\u05DE\u05E6\u05E2\u05D9 \u05D4\u05EA\u05E9\u05DC\u05D5\u05DD \u05D4\u05E7\u05D1\u05D5\u05E2 \u05E9\u05DC \u05D4\u05DC\u05E7\u05D5\u05D7" })] }), effMethod === 'account' && (_jsxs(L, { label: "\u05D8\u05DC\u05E4\u05D5\u05DF \u05D4\u05E7\u05E4\u05D4", req: true, children: [_jsx("input", { className: "input input--ltr", inputMode: "tel", value: isNew ? nc.accountPhone : accountPhone, placeholder: "05X-XXXXXXX", onChange: (e) => { if (isNew)
                            setNc({ ...nc, accountPhone: e.target.value });
                        else
                            setAccountPhone(e.target.value); clearErr('account', 'ncAccount'); }, ...inv(isNew ? 'ncAccount' : 'account') }), err(isNew ? 'ncAccount' : 'account')] }))] }));
    const poFields = (_jsxs(_Fragment, { children: [_jsx(Row, { children: _jsxs(L, { label: "\u05DE\u05E1' \u05EA\u05E2\u05D5\u05D3\u05EA \u05E8\u05DB\u05E9 (\u05DC\u05D0 \u05D7\u05D5\u05D1\u05D4)", children: [_jsx("input", { className: "input input--ltr", value: poNumber, onChange: (e) => { setPoNumber(e.target.value); clearErr('po'); }, placeholder: "\u05D0\u05E4\u05E9\u05E8 \u05D2\u05DD \u05D0\u05D7\u05E8 \u05DB\u05DA", ...inv('po') }), err('po'), c?.poRequired && _jsx("span", { className: "cform__hint", children: "\u05D4\u05DC\u05E7\u05D5\u05D7 \u05D1\u05D3\u05E8\u05DA \u05DB\u05DC\u05DC \u05E2\u05D5\u05D1\u05D3 \u05E2\u05DD \u05EA\u05E2\u05D5\u05D3\u05EA \u05E8\u05DB\u05E9" })] }) }), _jsx(FileDrop, { file: poFile, onFile: setPoFile, busy: busy })] }));
    const notesFields = (_jsxs(_Fragment, { children: [_jsxs(L, { label: "\u05D4\u05E0\u05D7\u05D9\u05D5\u05EA \u05DC\u05D4\u05D6\u05DE\u05E0\u05D4", wide: true, children: [_jsx("textarea", { className: "input cform__ta", rows: 2, value: instructions, onChange: (e) => { setInstructions(e.target.value); clearErr('instructions'); }, placeholder: "\u05DC\u05DE\u05E9\u05DC: \u05DC\u05D4\u05D2\u05D9\u05E2 \u05DC\u05E9\u05E2\u05E8 \u05D4\u05D0\u05D7\u05D5\u05E8\u05D9", ...inv('instructions') }), err('instructions')] }), _jsx(Row, { children: _jsxs(L, { label: "\u05D4\u05E2\u05E8\u05D4 \u05E4\u05E0\u05D9\u05DE\u05D9\u05EA", wide: true, children: [_jsx("input", { className: "input", value: note, onChange: (e) => { setNote(e.target.value); clearErr('note'); }, placeholder: "\u05E0\u05E8\u05D0\u05D9\u05EA \u05E8\u05E7 \u05D1\u05DE\u05D5\u05E7\u05D3", ...inv('note') }), err('note')] }) })] }));
    return (_jsx(Dialog.Root, { open: true, onOpenChange: (o) => !o && onClose(), children: _jsxs(Dialog.Portal, { children: [_jsx(Dialog.Overlay, { className: "cmd-overlay" }), _jsxs(Dialog.Content, { className: `cform norder norder--${mode}`, dir: "rtl", "aria-describedby": undefined, onPointerDownOutside: keepOpenOnToast, onInteractOutside: keepOpenOnToast, onKeyDown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        submit();
                    } }, children: [_jsxs("header", { className: "cform__head norder__head", children: [_jsx(Dialog.Title, { className: "udialog__title", children: "\u05D4\u05D6\u05DE\u05E0\u05D4 \u05D7\u05D3\u05E9\u05D4" }), _jsx("div", { className: "seg norder__modes", role: "tablist", "aria-label": "\u05E1\u05D5\u05D2 \u05D4\u05D4\u05D6\u05DE\u05E0\u05D4", children: MODES.map(([m, label, icon]) => (_jsxs("button", { type: "button", role: "tab", "aria-selected": mode === m, className: mode === m ? 'is-on' : '', onClick: () => { setMode(m); setErrors({}); }, children: [icon, label] }, m))) }), _jsx(Dialog.Close, { asChild: true, children: _jsx("button", { className: "icon-btn", "aria-label": "\u05E1\u05D2\u05D5\u05E8", children: _jsx(X, { size: 18 }) }) })] }), _jsxs("form", { ref: formRef, className: "cform__body", onSubmit: (e) => { e.preventDefault(); submit(); }, noValidate: true, children: [_jsx(motion.div, { ...fade, transition: { duration: 0.18 }, children: isNew ? (_jsxs(Section, { title: "\u05DC\u05E7\u05D5\u05D7 \u05D7\u05D3\u05E9", children: [_jsxs(Row, { children: [_jsxs(L, { label: "\u05E9\u05DD \u05D4\u05DC\u05E7\u05D5\u05D7", req: true, wide: true, children: [_jsx("input", { className: "input", autoFocus: true, value: nc.name, onChange: (e) => { setNc({ ...nc, name: e.target.value }); clearErr('ncName'); setAckSimilar(false); }, placeholder: "\u05D7\u05D1\u05E8\u05D4 \u05D0\u05D5 \u05D0\u05D3\u05DD \u05E4\u05E8\u05D8\u05D9", ...inv('ncName') }), err('ncName')] }), _jsx(L, { label: "\u05E1\u05D5\u05D2 \u05DC\u05E7\u05D5\u05D7", group: true, children: _jsx("div", { className: "seg", role: "radiogroup", "aria-label": "\u05E1\u05D5\u05D2 \u05DC\u05E7\u05D5\u05D7", children: ['occasional', 'regular'].map((t) => _jsx("button", { type: "button", role: "radio", "aria-checked": nc.type === t, className: nc.type === t ? 'is-on' : '', onClick: () => setNc({ ...nc, type: t }), children: t === 'regular' ? 'קבוע' : 'מזדמן' }, t)) }) })] }), _jsxs(Row, { children: [_jsxs(L, { label: "\u05D0\u05D9\u05E9 \u05E7\u05E9\u05E8", req: true, children: [_jsx("input", { className: "input", value: nc.contactName, onChange: (e) => { setNc({ ...nc, contactName: e.target.value }); clearErr('ncContact'); }, ...inv('ncContact') }), err('ncContact')] }), _jsxs(L, { label: "\u05D8\u05DC\u05E4\u05D5\u05DF", req: true, children: [_jsx("input", { className: "input input--ltr", inputMode: "tel", value: nc.contactPhone, onChange: (e) => { setNc({ ...nc, contactPhone: e.target.value }); clearErr('ncPhone'); setAckSimilar(false); }, placeholder: "05X-XXXXXXX", ...inv('ncPhone') }), err('ncPhone')] })] }), _jsx(Row, { children: _jsxs(L, { label: "\u05D7.\u05E4 / \u05E2.\u05DE (\u05DC\u05D0 \u05D7\u05D5\u05D1\u05D4)", children: [_jsx("input", { className: "input input--ltr", inputMode: "numeric", value: nc.taxId, onChange: (e) => { setNc({ ...nc, taxId: e.target.value }); clearErr('ncTax'); }, ...inv('ncTax') }), err('ncTax'), taxTwin && _jsxs("button", { type: "button", className: "link cform__twin", onClick: () => pickExisting(taxTwin), children: ["\u05D4\u05D6\u05DE\u05E0\u05D4 \u05DC\"", taxTwin.name, "\" \u05D1\u05DE\u05E7\u05D5\u05DD"] })] }) }), similar.length > 0 && (_jsxs("div", { className: `cform__warn no-similar ${ackSimilar ? 'is-ack' : ''}`, role: ackSimilar ? 'alert' : undefined, children: [_jsx(CircleAlert, { size: 18, "aria-hidden": "true" }), _jsxs("div", { children: [_jsx("b", { children: "\u05D0\u05D5\u05DC\u05D9 \u05D4\u05DC\u05E7\u05D5\u05D7 \u05DB\u05D1\u05E8 \u05E7\u05D9\u05D9\u05DD?" }), _jsx("ul", { children: similar.map(({ c: x, why }) => _jsxs("li", { children: [x.name, " ", _jsxs("span", { className: "muted", children: ["(", why, ")"] }), " \u00B7 ", _jsx("button", { type: "button", className: "link", onClick: () => pickExisting(x), children: "\u05D4\u05D6\u05DE\u05E0\u05D4 \u05DC\u05DC\u05E7\u05D5\u05D7 \u05D4\u05D6\u05D4" })] }, x.id)) }), ackSimilar && _jsx("span", { children: "\u05D0\u05DD \u05D6\u05D4 \u05DC\u05E7\u05D5\u05D7 \u05D0\u05D7\u05E8 \u2013 \u05DC\u05D7\u05E5 \u05E9\u05D5\u05D1 \"\u05E9\u05DE\u05D5\u05E8 \u05D4\u05D6\u05DE\u05E0\u05D4\"." })] })] }))] })) : (_jsxs(Section, { title: "\u05DC\u05E7\u05D5\u05D7", children: [_jsx(CustomerPicker, { customers: customers, value: customerId, invalid: !!errors.customer, onChange: (id) => { setCustomerId(id); clearErr('customer'); setAckDup(false); }, onNew: (name) => { setNc((x) => ({ ...x, name })); setMode('newCustomer'); setErrors({}); } }), err('customer')] })) }, mode === 'newCustomer' ? 'n' : 'e'), _jsxs(Section, { title: "\u05DE\u05D5\u05E2\u05D3 \u05D5\u05E1\u05E0\u05D9\u05E3", children: [whenSection, _jsxs(Row, { children: [branchField, statusField] }), _jsx(Row, { children: _jsxs(L, { label: "\u05E2\u05E8\u05D5\u05E5 \u05D4\u05D4\u05D6\u05DE\u05E0\u05D4", req: true, children: [_jsx("input", { className: "input", list: "no-channels", value: channel, onChange: (e) => { setChannel(e.target.value); clearErr('channel'); }, placeholder: "\u05DC\u05DE\u05E9\u05DC: \u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4, \u05DE\u05DB\u05D9\u05E8\u05D5\u05EA, \u05DE\u05D5\u05E7\u05D3, WellBe", ...inv('channel') }), _jsx("datalist", { id: "no-channels", children: channelHints.map((h) => _jsx("option", { value: h }, h)) }), err('channel')] }) })] }), dup && (_jsxs("div", { className: `cform__warn no-dup ${ackDup ? 'is-ack' : ''}`, role: ackDup ? 'alert' : 'status', children: [_jsx(CircleAlert, { size: 18, "aria-hidden": "true" }), _jsxs("div", { children: [_jsx("b", { children: "\u05D9\u05E9 \u05DB\u05D1\u05E8 \u05D4\u05D6\u05DE\u05E0\u05D4 \u05D3\u05D5\u05DE\u05D4:" }), " \u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: dup.id }), " \u00B7 ", dup.customerName, " \u00B7 ", _jsx(Ltr, { children: fmtDate(dup.date) }), " ", _jsx(Ltr, { children: dup.time }), " \u00B7 ", dup.branchName, " \u00B7 ", _jsx(Ltr, { children: fmtMoney(dup.amount) }), _jsxs("div", { className: "no-dup__actions", children: [_jsx("button", { type: "button", className: "link", onClick: () => { onClose(); panel.open(dup.id); }, children: "\u05E4\u05EA\u05D7 \u05D0\u05D5\u05EA\u05D4" }), ackDup && _jsx("span", { children: "\u05D0\u05DD \u05D6\u05D5 \u05D4\u05D6\u05DE\u05E0\u05D4 \u05E0\u05D5\u05E1\u05E4\u05EA \u2013 \u05DC\u05D7\u05E5 \"\u05E6\u05D5\u05E8 \u05D1\u05DB\u05DC \u05D6\u05D0\u05EA\"." })] })] })] })), _jsx(Section, { title: "\u05D0\u05E1\u05E4\u05E7\u05D4", children: deliveryFields }), itemsSection, _jsx(Section, { title: "\u05EA\u05E9\u05DC\u05D5\u05DD", children: paymentFields }), _jsx(Section, { title: "\u05EA\u05E2\u05D5\u05D3\u05EA \u05E8\u05DB\u05E9", children: poFields }), _jsx(Section, { title: "\u05D4\u05E0\u05D7\u05D9\u05D5\u05EA \u05D5\u05D4\u05E2\u05E8\u05D5\u05EA", children: notesFields }), errors.form && _jsxs("p", { className: "cform__formerr", role: "alert", children: [_jsx(CircleAlert, { size: 16, "aria-hidden": "true" }), " ", errors.form] })] }), ackMissing && missNow.length > 0 && (_jsxs("div", { className: "no-missing", role: "alert", children: [_jsx(CircleAlert, { size: 18, "aria-hidden": "true" }), _jsxs("div", { children: [_jsxs("b", { children: ["\u05D7\u05E1\u05E8\u05D9\u05DD \u05E4\u05E8\u05D8\u05D9\u05DD: ", missNow.join(', ')] }), _jsx("span", { children: "\u05DE\u05D5\u05DE\u05DC\u05E5 \u05DC\u05D4\u05E9\u05DC\u05D9\u05DD \u05E2\u05DB\u05E9\u05D9\u05D5. \u05D0\u05DD \u05D0\u05D9\u05DF \u05D1\u05E8\u05D9\u05E8\u05D4 \u2013 \u05D0\u05E4\u05E9\u05E8 \u05DC\u05E9\u05DE\u05D5\u05E8, \u05D5\u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05EA\u05E1\u05D5\u05DE\u05DF \u05D1\u05D0\u05D3\u05D5\u05DD \u05E2\u05D3 \u05E9\u05D9\u05E9\u05DC\u05D9\u05DE\u05D5 \u05D0\u05D5\u05EA\u05DD." })] })] })), _jsxs("footer", { className: "cform__foot", children: [_jsx(Button, { variant: "primary", loading: busy, onClick: submit, kbd: "Ctrl+Enter", children: dup && ackDup ? 'צור בכל זאת' : ackMissing && missNow.length ? 'שמור עם פרטים חסרים' : isNew ? 'שמור לקוח והזמנה' : 'שמור הזמנה' }), _jsx(Button, { variant: "ghost", onClick: onClose, children: "\u05D1\u05D9\u05D8\u05D5\u05DC" }), _jsx("span", { className: "norder__sum", "aria-live": "polite", children: finalAmount > 0 && _jsxs(_Fragment, { children: [_jsx(Ltr, { children: fmtMoney(finalAmount) }), time && _jsxs(_Fragment, { children: [" \u00B7 ", _jsx(Ltr, { children: time })] }), branchObj && _jsxs(_Fragment, { children: [" \u00B7 ", branchObj.name] })] }) })] })] })] }) }));
}
/* ---------- בחירת לקוח: חיפוש לפי שם, ח.פ או טלפון; בתחתית "+ לקוח חדש" ---------- */
function CustomerPicker({ customers, value, onChange, onNew, invalid }) {
    const [open, setOpen] = useState(false);
    useEffect(() => {
        if (value)
            return;
        const t = setTimeout(() => setOpen(true), 160);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const [q, setQ] = useState('');
    const [active, setActive] = useState(0);
    const listId = useId();
    const inputRef = useRef(null);
    const triggerRef = useRef(null);
    const selected = customers.find((c) => c.id === value);
    const options = useMemo(() => {
        const s = q.trim();
        const digits = s.replace(/\D/g, '');
        return customers.filter((c) => c.status === 'active' && (!s || c.name.includes(s)
            || (digits.length >= 3 && (c.taxId.includes(digits) || c.accountPhone.includes(digits) || c.contacts.some((p) => p.phone.includes(digits)))))).slice(0, 30);
    }, [customers, q]);
    const total = options.length + 1;
    const pick = (i) => {
        setOpen(false);
        if (i < options.length) {
            onChange(options[i].id);
            setQ('');
            requestAnimationFrame(() => triggerRef.current?.focus());
        }
        else
            onNew(q.trim());
    };
    return (_jsxs("div", { className: "bpick no-cpick", children: [_jsxs("span", { className: "field__label", id: `${listId}-label`, children: ["\u05D1\u05D7\u05E8 \u05DC\u05E7\u05D5\u05D7", _jsx("span", { className: "req", children: "\u05D7\u05D5\u05D1\u05D4" })] }), _jsxs(Popover.Root, { open: open, onOpenChange: (o) => { setOpen(o); if (!o)
                    setQ(''); }, children: [_jsx(Popover.Trigger, { asChild: true, children: _jsxs("button", { ref: triggerRef, type: "button", onKeyDown: (e) => { if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                                e.preventDefault();
                                setQ(e.key);
                                setOpen(true);
                            } }, className: "bpick__trigger", "aria-labelledby": `${listId}-label`, "aria-haspopup": "listbox", "aria-expanded": open, "aria-invalid": invalid || undefined, children: [selected ? (_jsxs("span", { className: "bpick__value", children: [_jsx("b", { children: selected.name }), selected.type === 'regular' && _jsx("span", { className: "bpick__cluster", children: "\u05E7\u05D1\u05D5\u05E2" })] })) : _jsx("span", { className: "bpick__placeholder", children: "\u05D7\u05E4\u05E9 \u05DC\u05E7\u05D5\u05D7 \u05DC\u05E4\u05D9 \u05E9\u05DD, \u05D7.\u05E4 \u05D0\u05D5 \u05D8\u05DC\u05E4\u05D5\u05DF\u2026" }), _jsx(ChevronDown, { size: 16, "aria-hidden": "true" })] }) }), _jsx(Popover.Portal, { children: _jsxs(Popover.Content, { className: "pop bpick__pop", align: "start", sideOffset: 4, dir: "rtl", onOpenAutoFocus: (e) => { e.preventDefault(); inputRef.current?.focus(); }, children: [_jsx("input", { ref: inputRef, className: "input input--sm", value: q, onChange: (e) => { setQ(e.target.value); setActive(0); }, placeholder: "\u05E9\u05DD, \u05D7.\u05E4 \u05D0\u05D5 \u05D8\u05DC\u05E4\u05D5\u05DF", role: "combobox", "aria-expanded": "true", "aria-controls": listId, "aria-activedescendant": `${listId}-${active}`, "aria-label": "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05DC\u05E7\u05D5\u05D7", onKeyDown: (e) => {
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
                                    } }), _jsxs("ul", { className: "bpick__list", id: listId, role: "listbox", "aria-label": "\u05DC\u05E7\u05D5\u05D7\u05D5\u05EA", children: [options.map((c, i) => {
                                            const pc = primaryContact(c);
                                            return (_jsxs("li", { id: `${listId}-${i}`, role: "option", "aria-selected": value === c.id, className: `bpick__opt ${active === i ? 'is-active' : ''}`, onMouseEnter: () => setActive(i), onClick: () => pick(i), children: [_jsx("span", { className: "bpick__check", children: value === c.id && _jsx(Check, { size: 14 }) }), _jsx("span", { className: "bpick__name", children: c.name }), _jsx("span", { className: "bpick__cluster", children: pc?.phone ? _jsx(Ltr, { children: fmtPhone(pc.phone) }) : METHOD_LABEL[c.paymentMethod] ?? '' })] }, c.id));
                                        }), options.length === 0 && _jsx("li", { className: "bpick__none", children: q ? `לא נמצא לקוח "${q}"` : 'אין עדיין לקוחות' }), _jsxs("li", { id: `${listId}-${options.length}`, role: "option", "aria-selected": false, className: `bpick__opt bpick__add ${active === options.length ? 'is-active' : ''}`, onMouseEnter: () => setActive(options.length), onClick: () => pick(options.length), children: [_jsx(UserPlus, { size: 16, "aria-hidden": "true" }), " \u05D4\u05D6\u05DE\u05E0\u05D4 \u05DC\u05DC\u05E7\u05D5\u05D7 \u05D7\u05D3\u05E9", q && _jsxs(_Fragment, { children: [" \u00B7 \"", q, "\""] })] })] })] }) })] })] }));
}
function Section({ title, children, aside }) {
    return (_jsxs("fieldset", { className: "cform__sec", children: [_jsxs("legend", { children: [title, aside] }), children] }));
}
function Row({ children }) { return _jsx("div", { className: "cform__row", children: children }); }
/* group: שדה שמכיל קבוצת כפתורים – div במקום label, כדי שלחיצה על הכותרת לא תלחץ על הכפתור הראשון */
function L({ label, req, wide, group, children }) {
    const Tag = group ? 'div' : 'label';
    return (_jsxs(Tag, { className: `cform__field ${wide ? 'is-wide' : ''}`, children: [_jsxs("span", { className: "field__label", children: [label, req && _jsx("span", { className: "req", children: "\u05D7\u05D5\u05D1\u05D4" })] }), children] }));
}
