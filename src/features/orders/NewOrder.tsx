/* יצירת הזמנה (אפיון 4.3, 4.4, 4.6, 6.4) – חלון אחד, שתי דרכים:
   הזמנה – ללקוח קיים: כל הפרטים בעמוד אחד. בחירת לקוח טוענת את הקבוע אצלו (תשלום, הקפה, כתובת, איש קשר).
   לקוח חדש – מקים לקוח והזמנה באותה שמירה.
   פרט חובה שחסר לא חוסם: אחרי אישור ההזמנה נשמרת ומסומנת באדום עד שמשלימים. Ctrl+Enter שומר. */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { saveError } from '../../lib/saveError';
import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';
import { motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown, CircleAlert, ClipboardList, UserPlus, X } from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { useAuth } from '../../auth/AuthContext';
import { useBranches, useClusters } from '../../data/branches';
import { EMPTY_CUSTOMER, newId, primaryContact, updateCustomer, useCustomers, type Customer } from '../../data/customers';
import { useLists } from '../../data/lists';
import { createOrder, findDuplicate, type NewOrderInput } from '../../data/orders';
import { usePriceLists } from '../../data/priceLists';
import { useStore, type NewOrderMode, type NewOrderRequest } from '../../data/store';
import { setQuoteStatus } from '../../data/quotes';
import { METHOD_LABEL, type OrderStatus } from '../../data/types';
import { Button } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, addDays, fmtDate, fmtMoney, fmtPhone, roundMoney, toISODate, weekday } from '../../lib/format';
import { cleanPhone, isSimilar, phoneError } from '../../lib/names';
import { cleanTaxId, taxIdError } from '../../lib/taxid';
import { BranchPicker, type BranchChoice } from '../branches/BranchPicker';
import { ItemsBuilder, PriceSource, isBlank, lineProblem, lineText, toSaved, useCatalog, useRepriceOnDelivery, type Line } from './ItemsBuilder';
import { uploadOrderDoc } from '../../data/orderDocs';
import { FileDrop } from './OrderDocs';
import { keepOpenOnToast } from '../../app/ErrorBoundary';
import '../customers/CustomerForm.css';
import './NewOrder.css';

const CARD_RE = /\d{13,}/;
const MODES: [NewOrderMode, string, ReactNode][] = [
  ['full', 'הזמנה', <ClipboardList size={16} key="f" />],
  ['newCustomer', 'לקוח חדש', <UserPlus size={16} key="n" />],
];
const START_STATUS: [OrderStatus, string][] = [['pending_customer', 'ממתין לאישור לקוח'], ['approved', 'הלקוח כבר אישר']];
const MISS = 'חסר – אפשר להשלים אחר כך';
const MISS_LABEL: Record<string, string> = {
  ncContact: 'איש קשר', contactName: 'איש קשר', ncPhone: 'טלפון', contactPhone: 'טלפון', time: 'שעה', branch: 'סניף',
  channel: 'ערוץ / מספר פניה', address: 'כתובת', final: 'סכום', amount: 'סכום', account: 'טלפון הקפה', ncAccount: 'טלפון הקפה', contents: 'פריטים', detail: 'תיאור פריט', po: 'תעודת רכש',
};

const money = (s: string) => roundMoney(Number(s.replace(/[^\d.]/g, '')) || 0);

export function NewOrderDialog() {
  const { newOrder, closeNewOrder } = useStore();
  if (!newOrder) return null;
  return <NewOrderForm key={JSON.stringify(newOrder)} initial={newOrder} onClose={closeNewOrder} />;
}

function NewOrderForm({ initial, onClose }: { initial: NewOrderRequest; onClose: () => void }) {
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

  // בסגירה הפוקוס חוזר לכפתור שפתח את הטופס (אלא אם נפתח חלון אחר, למשל תיק ההזמנה שנשמרה)
  const opener = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => () => {
    const el = opener.current;
    setTimeout(() => { if (el?.isConnected && !document.querySelector('[role="dialog"]')) el.focus(); }, 30);
  }, []);

  const today = toISODate(now);
  const tomorrow = toISODate(addDays(now, 1));
  /* מהצעת מחיר: הלקוח, המועד, המשלוח והשורות (כמות ומחיר) עוברים לטופס. נשאר לפרט סוגים ותוספות */
  const fq = initial.fromQuote;
  const prefill = useRef(!!fq);

  const [mode, setMode] = useState<NewOrderMode>(initial.customerName || initial.mode === 'newCustomer' || (fq && !fq.customerId) ? 'newCustomer' : 'full');
  const [customerId, setCustomerId] = useState(initial.customerId ?? fq?.customerId ?? '');
  const [nc, setNc] = useState({ name: initial.customerName ?? fq?.customer.name ?? '', type: 'occasional' as Customer['type'], taxId: fq?.customer.taxId ?? '', contactName: fq?.customer.contact ?? '', contactPhone: fq?.customer.phone ? fmtPhone(fq.customer.phone) : '', paymentMethod: 'credit', accountPhone: '' });
  const [date, setDate] = useState(initial.date ?? (fq?.date && fq.date >= today ? fq.date : today));
  const [time, setTime] = useState(fq?.time ?? '');
  const [branch, setBranch] = useState<BranchChoice | null>(null);
  const [delivery, setDelivery] = useState<'delivery' | 'pickup'>(fq?.delivery ?? 'delivery');
  const [addressId, setAddressId] = useState('');
  const [address, setAddress] = useState(fq?.address ?? '');
  const [contactId, setContactId] = useState('');
  const [contact, setContact] = useState({ name: fq?.customerId ? fq.customer.contact : '', phone: fq?.customerId && fq.customer.phone ? fmtPhone(fq.customer.phone) : '' });
  const [fee, setFee] = useState(fq?.fee?.price ? String(fq.fee.price) : '');
  const [override, setOverride] = useState<string | null>(null); // סכום לחיוב שהוקלד ידנית
  const [poFile, setPoFile] = useState<File | null>(null);
  const [lines, setLines] = useState<Line[]>(() => (fq?.lines ?? []).map((l) => ({ key: newId(), group: l.category, name: l.name, qty: l.qty, unitPrice: l.unitPrice, ...(l.unitPrice ? { manualPrice: true } : {}) })));
  const [status, setStatus] = useState<OrderStatus>('pending_customer');
  // הזמנה בתאריך שעבר – לתיעוד בלבד: נשמרת ישר כסגורה, לפי התוצאה
  const [outcome, setOutcome] = useState<'' | 'delivered' | 'late' | 'partial' | 'cancelled'>('');
  const [lateMin, setLateMin] = useState('');
  const [pastQ, setPastQ] = useState('');
  const [pastReason, setPastReason] = useState('');
  const [channel, setChannel] = useState('');
  const [method, setMethod] = useState('');
  const [accountPhone, setAccountPhone] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [instructions, setInstructions] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveContact, setSaveContact] = useState(false); // לשמור איש קשר חדש גם בתיק הלקוח
  const [saveAddress, setSaveAddress] = useState(false);
  const [busy, setBusy] = useState(false);
  /* הגנה מאובדן: ברגע שהוקלד משהו, סגירה (לחיצה בחוץ, Escape, X, ביטול) שואלת קודם. חלון שלא נגעו בו נסגר מיד */
  const dirty = useRef(false);
  const markDirty = () => { dirty.current = true; };
  const [askClose, setAskClose] = useState(false);
  const stayRef = useRef<HTMLButtonElement>(null);
  const requestClose = () => { if (dirty.current && !busy) setAskClose(true); else onClose(); };
  useEffect(() => { if (askClose) stayRef.current?.focus(); }, [askClose]);
  const formRef = useRef<HTMLFormElement>(null);

  const isNew = mode === 'newCustomer';
  const c = isNew ? undefined : customers.find((x) => x.id === customerId);
  const [plSel, setPlSel] = useState<string | null>(fq ? fq.priceListId ?? '' : null); // מחירון שנבחר בהזמנה; ברירת מחדל – של הלקוח
  const plId = plSel ?? c?.priceListId ?? '';
  const priceList = priceLists.find((p) => p.id === plId);
  const branchObj = branches.find((b) => b.id === branch?.branchId);
  const clearErr = (...k: string[]) => setErrors((e) => { const n = { ...e }; k.forEach((x) => delete n[x]); return n; });

  /* בחירת לקוח טוענת את מה שקבוע אצלו: תשלום, טלפון הקפה, כתובת, הנחיות, סניף מועדף.
     איש הקשר לא נטען לבד – הוא משתנה מהזמנה להזמנה, ולכן מוצע לבחירה ("האם זה איש הקשר?") כדי שלא תצא הזמנה עם איש קשר ישן. */
  useEffect(() => {
    if (!c) return;
    const addr = c.addresses[0];
    const fromQuote = prefill.current;
    prefill.current = false;
    setMethod(c.paymentMethod);
    setAccountPhone(c.accountPhone ? fmtPhone(c.accountPhone) : '');
    setAddressId(fromQuote && address ? c.addresses.find((a) => a.address.trim() === address.trim())?.id ?? '' : addr?.id ?? '');
    if (!fromQuote || !address) setAddress(addr?.address ?? c.businessAddress ?? '');
    setSaveContact(false);
    setSaveAddress(false);
    if (addr?.preferredBranchId && branches.some((b) => b.id === addr.preferredBranchId)) {
      const b = branches.find((x) => x.id === addr.preferredBranchId)!;
      setBranch((cur) => cur ?? { branchId: b.id, clusterId: b.clusterId });
    }
    if (fromQuote) return;
    setContactId('');
    setContact({ name: '', phone: '' });
    setLines([]);
    setPlSel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id]);

  /* ערוץ ההזמנה נכתב ידנית (וואטסאפ, מכירות, מוקד, WellBe…). ההצעות רק משלימות הקלדה. */
  const channelHints = useMemo(() => [...new Set([...(lists?.channels ?? []).filter((x) => x.active).map((x) => x.label), ...orders.map((o) => o.channel).filter(Boolean)])].slice(0, 30), [lists, orders]);

  /* ---------- פריטים ומחיר ---------- */
  const catalog = useCatalog(priceList, c, delivery);
  useRepriceOnDelivery(delivery, catalog, setLines, (n) => { if (n) toast({ message: <>המחירים עודכנו ל{delivery === 'pickup' ? 'איסוף עצמי' : 'משלוח'}</> }); });
  const past = !!date && date < today; // תאריך שעבר – הזמנה לתיעוד בלבד
  const real = lines.filter((l) => !isBlank(l)); // השורה הריקה שבסוף הטבלה לא נחשבת
  const linesTotal = roundMoney(real.reduce((t, l) => t + l.qty * l.unitPrice, 0));
  const useLines = real.length > 0;
  // דמי המשלוח נוספים לסכום הפריטים
  const feeValue = delivery === 'delivery' ? money(fee) : 0;
  const total = roundMoney(linesTotal + feeValue);
  const canOverride = real.length > 0 || feeValue > 0;
  // פריטים בלי מחיר: הסכום הכולל להזמנה נכתב ישירות (כמו היום), בלי "שונה ידנית"
  const totalOnly = real.length > 0 && linesTotal === 0;
  const finalAmount = canOverride && override !== null ? money(override) : total;
  const isManual = canOverride && override !== null && finalAmount !== total;

  /* ---------- כפילויות ---------- */
  const dup = isNew ? undefined : findDuplicate(orders, { customerId, date, time, branchId: branch?.branchId ?? '' }, thresholds.nearMinutes);
  const ncPhone = cleanPhone(nc.contactPhone);
  const ncTax = cleanTaxId(nc.taxId);
  const taxTwin = isNew && ncTax ? customers.find((x) => x.taxId === ncTax && x.status !== 'merged') : undefined;
  const similar = useMemo(() => {
    if (!isNew) return [];
    const out: { c: Customer; why: string }[] = [];
    customers.filter((x) => x.status !== 'merged').forEach((x) => {
      if (nc.name.trim().length >= 3 && isSimilar(x.name, nc.name)) out.push({ c: x, why: 'שם דומה' });
      else if (ncPhone.length >= 9 && (x.contacts.some((p) => p.phone === ncPhone) || x.accountPhone === ncPhone)) out.push({ c: x, why: 'אותו טלפון' });
    });
    return out.slice(0, 3);
  }, [isNew, customers, nc.name, ncPhone]);

  const pickExisting = (x: Customer) => { setCustomerId(x.id); setMode('full'); setErrors({}); };

  /* איש קשר או כתובת שהוקלדו ואינם בתיק הלקוח – מציעים לשמור גם שם */
  const contactPhoneClean = cleanPhone(contact.phone);
  const newContact = !!c && !contactId && !!(contact.name.trim() || contactPhoneClean) && !c.contacts.some((p) => (contactPhoneClean && p.phone === contactPhoneClean) || (!contactPhoneClean && p.name === contact.name.trim()));
  const newAddress = !!c && delivery === 'delivery' && !!address.trim() && !c.addresses.some((a) => a.address.trim() === address.trim());

  const methods = (lists?.paymentMethods ?? []).filter((m) => m.active || m.id === method || m.id === nc.paymentMethod);
  const effMethod = isNew ? nc.paymentMethod : method;
  const effAccountPhone = isNew ? nc.accountPhone : accountPhone;
  const methodLabel = methods.find((m) => m.id === effMethod)?.label ?? METHOD_LABEL[effMethod] ?? effMethod;

  /* ---------- בדיקה ושמירה ---------- */
  /* שני סוגי בעיות: שגיאה (חוסמת – למשל ח.פ שגוי או מספר כרטיס) ופרט חסר (לא חוסם – אחרי אישור נשמר ומסומן באדום). */
  const check = () => {
    const e: Record<string, string> = {};
    const m: Record<string, string> = {};
    if (isNew) {
      if (!nc.name.trim()) e.ncName = 'חובה: שם הלקוח';
      const te = taxIdError(nc.taxId); if (te) e.ncTax = te;
      if (taxTwin) e.ncTax = `ח.פ הזה כבר שייך ל"${taxTwin.name}"`;
      if (!ncPhone) m.ncPhone = MISS;
      else { const pe = phoneError(nc.contactPhone); if (pe) e.ncPhone = pe; }
    } else {
      if (!c) e.customer = 'חובה: בחר לקוח';
      if (!contact.phone.trim()) m.contactPhone = MISS;
      else { const pe = phoneError(contact.phone); if (pe) e.contactPhone = pe; }
    }
    if (!date) e.date = 'חובה: תאריך אספקה';
    if (!time) m.time = MISS;
    else if (!/^\d{2}:\d{2}$/.test(time)) e.time = 'שעה לא תקינה';
    if (!branch) m.branch = MISS;
    if (!channel.trim()) m.channel = MISS;
    else if (CARD_RE.test(channel)) e.channel = 'אסור לרשום כאן מספר כרטיס אשראי';
    if (delivery === 'delivery' && !address.trim()) m.address = MISS;
    if (isManual && finalAmount <= 0) m.final = MISS;
    if (totalOnly && !isManual) m.amount = 'אין מחיר: מלאו מחיר בשורות או סכום כולל'; // בלי פריטים – חסר "פריטים" בלבד
    if (real.some(lineProblem)) e.amount = 'בשורה המסומנת באדום חסרים כמות או סוג / מוצר';
    if (real.some((l) => CARD_RE.test(lineText(l)))) e.amount = 'אסור לרשום כאן מספר כרטיס אשראי';
    if (!real.length) m.contents = MISS;
    if (past && !outcome) e.outcome = 'בהזמנה בתאריך שעבר – בחרו מה קרה בה';
    if (past && outcome === 'cancelled' && !pastReason.trim()) e.outcome = 'חובה: סיבת הביטול';
    if (past && outcome === 'partial' && !pastReason.trim()) e.outcome = 'חובה: מה סופק בפועל';
    if (CARD_RE.test(pastReason)) e.outcome = 'אסור לרשום כאן מספר כרטיס אשראי';
    if (c?.poRequired && !poNumber.trim()) m.po = MISS;
    if (effMethod === 'account') {
      if (!cleanPhone(effAccountPhone)) m[isNew ? 'ncAccount' : 'account'] = MISS;
      else { const pe = phoneError(effAccountPhone); if (pe) e[isNew ? 'ncAccount' : 'account'] = pe; }
    }
    if (CARD_RE.test(poNumber)) e.po = 'אסור לרשום כאן מספר כרטיס אשראי';
    if (CARD_RE.test(instructions)) e.instructions = 'אסור לרשום כאן מספר כרטיס אשראי';
    if (CARD_RE.test(address)) e.address = 'אסור לרשום כאן מספר כרטיס אשראי';
    return { e, m };
  };
  const live = check();
  // פרטים חסרים לא חוסמים: מוצגים מראש מעל כפתור השמירה, וההזמנה נשמרת בלחיצה אחת ומסומנת באדום
  const missKeys = past ? [] : Object.keys(live.m).filter((k, i, a) => MISS_LABEL[k] && a.findIndex((x) => MISS_LABEL[x] === MISS_LABEL[k]) === i);
  const missLive = missKeys.map((k) => MISS_LABEL[k]);
  /* קפיצה לשדה החסר */
  const goTo = (k: string) => {
    const root = formRef.current; if (!root) return;
    const el = k === 'branch' ? root.querySelector<HTMLElement>('.bpick__trigger')
      : k === 'amount' && totalOnly ? root.querySelector<HTMLElement>('[data-field="final"]')
      /* פריטים: שורת הטיוטה בטבלה הפתוחה; בלשונית הפיצות – שורת התוספת הריקה בסוג הפתוח, ואם אין סוג עדיין – "+ סוג פיצה" */
      : k === 'contents' || k === 'amount' ? root.querySelector<HTMLElement>('.ib [data-draft] input, .pgs section.pg [data-line].is-draft input[data-col="tops"], .pgs__foot .btn')
      : root.querySelector<HTMLElement>(`[data-field="${k}"]`);
    el?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    el?.focus({ preventScroll: true });
  };
  const validate = () => {
    const { e, m } = check();
    setErrors({ ...m, ...e });
    if (Object.keys(e).length) { requestAnimationFrame(() => (formRef.current?.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus()); return false; }
    return true;
  };

  const submit = async () => {
    if (busy || !validate()) return;
    const b = branchObj; // אפשר לשמור בלי סניף – ההזמנה תסומן באדום עד שישובץ
    const customerName = isNew ? nc.name.trim() : c!.name;
    const input: NewOrderInput = {
      customerId: c?.id ?? '',
      customerName,
      date, time,
      branchId: b?.id ?? '', branchName: b?.name ?? '', branchPhone: b?.phone ?? '',
      cluster: b ? clusters.find((x) => x.id === b.clusterId)?.name ?? '' : '',
      amount: finalAmount,
      calcAmount: isManual && !totalOnly ? total : undefined,
      status: past ? (outcome === 'cancelled' ? 'cancelled' : outcome === 'partial' ? 'partial' : 'delivered') : status,
      payment: past ? (outcome === 'cancelled' ? 'cancelled' : pastQ.trim() ? 'paid' : 'pending') : 'pending',
      ...(past ? {
        backfill: true,
        ...(outcome === 'late' ? { late: { minutes: Number(lateMin.replace(/\D/g, '')) || 0 } } : {}),
        ...(outcome === 'cancelled' ? { cancelReason: pastReason.trim() } : {}),
        ...(outcome === 'partial' ? { partialNote: pastReason.trim() } : {}),
        ...(pastQ.trim() ? { qNumber: pastQ.trim(), qAmount: finalAmount } : {}),
      } : {}),
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
      items: useLines ? toSaved(lines) : [],
      deliveryFee: feeValue || undefined,
      instructions: instructions.trim() || undefined,
      billingNote: c?.billingInstructions || undefined,
    };
    const draft = isNew ? {
      ...EMPTY_CUSTOMER,
      name: nc.name.trim(), type: nc.type, taxId: ncTax, paymentMethod: nc.paymentMethod,
      accountPhone: nc.paymentMethod === 'account' ? cleanPhone(nc.accountPhone) : '',
      contacts: nc.contactName.trim() || ncPhone ? [{ id: newId(), name: nc.contactName.trim(), role: '', phone: ncPhone, email: '', primary: true }] : [],
      addresses: delivery === 'delivery' && address.trim() ? [{ id: newId(), label: 'כתובת אספקה', address: address.trim(), directions: '', preferredBranchId: b?.id ?? '' }] : [],
      instructions: '',
    } : undefined;
    setBusy(true);
    try {
      const n = await createOrder(input, draft);
      if (c && ((saveContact && newContact) || (saveAddress && newAddress))) {
        // ההזמנה כבר נשמרה; אם עדכון התיק נכשל – רק מודיעים
        await updateCustomer(c, {
          ...(saveContact && newContact ? { contacts: [...c.contacts, { id: newId(), name: contact.name.trim(), role: '', phone: contactPhoneClean, email: '', primary: c.contacts.length === 0 }] } : {}),
          ...(saveAddress && newAddress ? { addresses: [...c.addresses, { id: newId(), label: '', address: address.trim(), directions: '', preferredBranchId: branchObj?.id ?? '' }] } : {}),
        }, `נוסף מתוך הזמנה ${n}`).catch(() => toast({ tone: 'error', message: 'ההזמנה נשמרה, אבל השמירה בתיק הלקוח נכשלה – אפשר להוסיף שם ידנית' }));
      }
      if (poFile) {
        // הקובץ נשמר אחרי ההזמנה; אם נכשל – ההזמנה כבר שמורה ואפשר לצרף שוב מהתיק
        await uploadOrderDoc(n, poFile, input.customerId || '').catch(() => toast({ tone: 'error', message: <>ההזמנה נשמרה, אבל צירוף תעודת הרכש נכשל – אפשר לצרף אותה מתיק ההזמנה <Ltr>{n}</Ltr></> }));
      }
      if (fq) {
        // ההזמנה כבר נשמרה; אם סימון ההצעה נכשל – רק מודיעים
        await setQuoteStatus(fq, 'ordered', '', { orderId: n }).catch(() => toast({ tone: 'error', message: <>ההזמנה נשמרה, אבל סימון הצעה <Ltr>{fq.id}</Ltr> נכשל – סמנו אותה ידנית</> }));
      }
      toast({
        message: <>הזמנה <Ltr>{n}</Ltr> נשמרה{fq && <> מהצעה <Ltr>{fq.id}</Ltr></>} · {customerName} · {date === today ? 'היום' : date === tomorrow ? 'מחר' : <Ltr>{fmtDate(date)}</Ltr>} <Ltr>{time}</Ltr>{missLive.length > 0 && <> · <b>חסרים פרטים – מסומנת באדום</b></>}</>,
        action: { label: 'פתח תיק', run: () => panel.open(n) },
      });
      onClose();
    } catch (e) {
      setErrors({ form: `${saveError(e)}. שום דבר לא נשמר.` });
      setBusy(false);
    }
  };

  const err = (k: string) => errors[k] ? <span className="cform__err" id={`no-${k}`} role="alert">{errors[k]}</span> : null;
  const inv = (k: string) => ({ 'data-field': k, 'aria-invalid': !!errors[k] || undefined, 'aria-describedby': errors[k] ? `no-${k}` : undefined });
  const customerChosen = isNew ? nc.name.trim().length > 0 : !!c;
  const saveLabel = `${dup ? 'שמור כהזמנה נוספת' : isNew ? (similar.length ? 'שמור כלקוח חדש והזמנה' : 'שמור לקוח והזמנה') : 'שמור הזמנה'}${
    missLive.length && customerChosen ? ` עם ${missLive.length === 1 ? 'פרט חסר' : `${missLive.length} פרטים חסרים`}` : ''}`;
  const fade = reduce ? { initial: { opacity: 0 }, animate: { opacity: 1 } } : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 } };

  /* ---------- חלקי הטופס ---------- */
  const whenSection = (
    <Row>
      <L label="תאריך אספקה" req>
        <div className="no-date">
          <input type="date" className="input input--ltr" value={date} onChange={(e) => { setDate(e.target.value); clearErr('date'); }} {...inv('date')} />
          <div className="seg" role="group" aria-label="קיצור תאריך">
            <button type="button" className={date === today ? 'is-on' : ''} aria-pressed={date === today} onClick={() => { setDate(today); clearErr('date'); }}>היום</button>
            <button type="button" className={date === tomorrow ? 'is-on' : ''} aria-pressed={date === tomorrow} onClick={() => { setDate(tomorrow); clearErr('date'); }}>מחר</button>
          </div>
        </div>
        {date && !errors.date && <span className="cform__hint muted">יום {weekday(date)}</span>}
        {err('date')}
      </L>
      <L label="שעה" req>
        <input type="time" step={900} className="input input--ltr no-time" value={time} onChange={(e) => { setTime(e.target.value); clearErr('time'); }} {...inv('time')} />
        {err('time')}
      </L>
    </Row>
  );

  const branchField = (
    <div className="cform__field" {...(errors.branch ? { 'data-invalid': true } : {})}>
      <BranchPicker label="סניף (חובה)" value={branch} onChange={(v) => { setBranch(v); clearErr('branch'); }} preferredId={c?.addresses.find((a) => a.id === addressId)?.preferredBranchId} />
      {err('branch')}
    </div>
  );

  const statusField = (
    <L label="שלב התחלה" group>
      <div className="seg" role="radiogroup" aria-label="סטטוס התחלתי">
        {START_STATUS.map(([s, label]) => <button type="button" key={s} role="radio" aria-checked={status === s} className={status === s ? 'is-on' : ''} onClick={() => setStatus(s)}>{label}</button>)}
      </div>
    </L>
  );

  const deliveryFields = (
    <>
      <Row>
        <L label="סוג" group>
          <div className="seg" role="radiogroup" aria-label="משלוח או איסוף">
            <button type="button" role="radio" aria-checked={delivery === 'delivery'} className={delivery === 'delivery' ? 'is-on' : ''} onClick={() => setDelivery('delivery')}>משלוח</button>
            <button type="button" role="radio" aria-checked={delivery === 'pickup'} className={delivery === 'pickup' ? 'is-on' : ''} onClick={() => setDelivery('pickup')}>איסוף עצמי</button>
          </div>
        </L>
      </Row>
      {!isNew && c && c.contacts.length > 0 && (
        contactId ? (
          <p className="no-suggest no-suggest--on"><Check size={14} aria-hidden="true" /> מאנשי הקשר השמורים של הלקוח
            <button type="button" className="link" onClick={() => { setContactId(''); setContact({ name: '', phone: '' }); }}>מישהו אחר</button></p>
        ) : (
          <div className="no-suggest" role="group" aria-label="אנשי הקשר השמורים של הלקוח">
            <span className="no-suggest__q">האם זה איש הקשר?</span>
            {[...c.contacts].sort((a, b) => Number(b.primary) - Number(a.primary)).map((p) => (
              <button type="button" key={p.id} className="chip" onClick={() => { setContactId(p.id); setContact({ name: p.name, phone: p.phone ? fmtPhone(p.phone) : '' }); setSaveContact(false); clearErr('contactName', 'contactPhone'); }}>
                {p.name}{p.phone && <> · <Ltr>{fmtPhone(p.phone)}</Ltr></>}{p.role && <span className="muted"> · {p.role}</span>}
              </button>
            ))}
          </div>
        )
      )}
      {!isNew && (
        <Row>
          <L label="איש קשר לקבלת ההזמנה">
            <input className="input" value={contact.name} onChange={(e) => { setContact({ ...contact, name: e.target.value }); setContactId(''); clearErr('contactName'); }} placeholder="מי מקבל את ההזמנה" {...inv('contactName')} />
            {err('contactName')}
          </L>
          <L label="טלפון" req>
            <input className="input input--ltr" inputMode="tel" value={contact.phone} onChange={(e) => { setContact({ ...contact, phone: e.target.value }); setContactId(''); clearErr('contactPhone'); }} placeholder="05X-XXXXXXX" {...inv('contactPhone')} />
            {err('contactPhone')}
          </L>
        </Row>
      )}
      {newContact && (
        <label className="no-keep"><input type="checkbox" checked={saveContact} onChange={(e) => setSaveContact(e.target.checked)} /> לשמור את איש הקשר הזה גם בתיק הלקוח</label>
      )}
      {delivery === 'delivery' && (
        <Row>
          {!isNew && c && c.addresses.length > 1 && (
            <L label="כתובת שמורה">
              <select className="input" value={addressId} onChange={(e) => { const a = c.addresses.find((x) => x.id === e.target.value); setAddressId(e.target.value); setAddress(a?.address ?? ''); }}>
                {c.addresses.map((a) => <option key={a.id} value={a.id}>{a.label || a.address}</option>)}
              </select>
            </L>
          )}
          <L label="כתובת אספקה" wide={!(c && c.addresses.length > 1)}>
            <input className="input" value={address} onChange={(e) => { setAddress(e.target.value); clearErr('address'); }} placeholder="רחוב, מספר, עיר" {...inv('address')} />
            {err('address')}
          </L>
        </Row>
      )}
      {newAddress && (
        <label className="no-keep"><input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} /> לשמור את הכתובת הזו גם בתיק הלקוח</label>
      )}
    </>
  );

  const itemsSection = (
    <Section title="פריטים ומחיר">
      {c?.priceNote && <p className="no-pricenote" role="note"><b>הערת מחיר:</b> {c.priceNote}</p>}
      {/* מקור המחיר: מחירון (של הלקוח, כללי, או בלי); משלוח/איסוף נקבע בחלק "אספקה" */}
      <PriceSource lists={priceLists} customer={c} value={plId} onChange={setPlSel} delivery={delivery} />
      <ItemsBuilder lines={lines} setLines={setLines} catalog={catalog} onTouched={() => clearErr('amount', 'contents')} />
      {real.length === 0 && (
        <p className={`no-items-empty ${errors.contents ? 'is-err' : ''}`}>
          בחרו קטגוריה ומלאו שורה: כמות, סוג או מוצר{' '}ותוספות. מחיר לשורה – רשות; אפשר לכתוב רק סכום כולל להזמנה.
        </p>
      )}
      {err('amount')}
      {/* סיכום בשורה אחת: פריטים · דמי משלוח · סה"כ. שינוי הסכום הסופי – רק כשצריך */}
      <div className={`ib-sum ${isManual && !totalOnly ? 'is-manual' : ''}`}>
        <span>פריטים {totalOnly ? <span className="muted">ללא מחיר לשורה</span> : <b><Ltr>{fmtMoney(linesTotal)}</Ltr></b>}</span>
        {delivery === 'delivery' && (
          <label className="ib-sum__fee">דמי משלוח
            <input className="input input--sm input--ltr" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" aria-label="דמי משלוח (₪)" />
          </label>
        )}
        <span className="ib-sum__total">סה"כ לחיוב <b><Ltr>{fmtMoney(finalAmount)}</Ltr></b></span>
        {totalOnly && (
          <label className="ib-sum__override ib-sum__only">סכום כולל להזמנה
            <input className="input input--sm input--ltr" inputMode="decimal" value={override ?? ''} placeholder="₪" onChange={(e) => { setOverride(e.target.value); clearErr('final', 'amount'); }} aria-label="סכום כולל להזמנה (₪)" {...inv('final')} />
          </label>
        )}
        {canOverride && !totalOnly && (override === null
          ? <button type="button" className="link" onClick={() => setOverride(String(total))}>שנה סכום</button>
          : (
            <span className="ib-sum__override">
              <input className="input input--sm input--ltr" inputMode="decimal" autoFocus value={override} onChange={(e) => { setOverride(e.target.value); clearErr('final'); }} aria-label="סכום לחיוב (לפי הסגירה מול הלקוח)" {...inv('final')} />
              {isManual && <span className="no-final__tag">שונה ידנית · מחושב <Ltr>{fmtMoney(total)}</Ltr></span>}
              <button type="button" className="link" onClick={() => setOverride(null)}>חזור לחישוב</button>
            </span>
          ))}
      </div>
      {err('final')}
      <p className="muted no-hint">המחיר נשמר בתוך ההזמנה. שינוי מחירון בעתיד לא ישנה אותה.</p>
    </Section>
  );

  const paymentFields = (
    <Row>
      <L label="אמצעי תשלום" group>
        <div className="seg" role="radiogroup" aria-label="אמצעי תשלום">
          {methods.map((m) => (
            <button type="button" key={m.id} role="radio" aria-checked={effMethod === m.id} className={effMethod === m.id ? 'is-on' : ''}
              onClick={() => { if (isNew) setNc({ ...nc, paymentMethod: m.id }); else setMethod(m.id); clearErr('account', 'ncAccount'); }}>{m.label}</button>
          ))}
        </div>
        {c && (method === c.paymentMethod
          ? <span className="cform__hint muted"><Check size={12} aria-hidden="true" /> אמצעי התשלום הקבוע של הלקוח</span>
          : <span className="cform__hint">שונה בהזמנה הזו בלבד · הקבוע של הלקוח: {methods.find((m) => m.id === c.paymentMethod)?.label ?? METHOD_LABEL[c.paymentMethod] ?? c.paymentMethod} <button type="button" className="link" onClick={() => { setMethod(c.paymentMethod); setAccountPhone(c.accountPhone ? fmtPhone(c.accountPhone) : ''); }}>חזור לקבוע</button></span>)}
        {isNew && <span className="cform__hint muted">יישמר כאמצעי התשלום הקבוע של הלקוח</span>}
      </L>
      {effMethod === 'account' && (
        <L label="טלפון הקפה" req>
          <input className="input input--ltr" inputMode="tel" value={isNew ? nc.accountPhone : accountPhone} placeholder="05X-XXXXXXX"
            onChange={(e) => { if (isNew) setNc({ ...nc, accountPhone: e.target.value }); else setAccountPhone(e.target.value); clearErr('account', 'ncAccount'); }} {...inv(isNew ? 'ncAccount' : 'account')} />
          {err(isNew ? 'ncAccount' : 'account')}
        </L>
      )}
    </Row>
  );

  const poFields = (
    <>
      <Row>
        <L label={c?.poRequired ? "מס' תעודת רכש" : "מס' תעודת רכש (לא חובה)"} req={!!c?.poRequired}>
          <input className="input input--ltr" value={poNumber} onChange={(e) => { setPoNumber(e.target.value); clearErr('po'); }} placeholder="אפשר גם אחר כך" {...inv('po')} />
          {err('po')}
          {c?.poRequired && <span className="cform__hint">הלקוח בדרך כלל עובד עם תעודת רכש</span>}
        </L>
      </Row>
      <FileDrop file={poFile} onFile={setPoFile} busy={busy} />
    </>
  );

  const notesFields = (
    <>
      {c?.instructions && <p className="no-pricenote" role="note"><b>הנחיות קבועות של הלקוח:</b> {c.instructions}</p>}
      <L label="הערות להזמנה" wide>
        <textarea className="input cform__ta" rows={2} value={instructions} onChange={(e) => { setInstructions(e.target.value); clearErr('instructions'); }} placeholder="למשל: להגיע לשער האחורי, להתקשר 10 דקות לפני" {...inv('instructions')} />
        {err('instructions')}
      </L>
    </>
  );

  return (
    <Dialog.Root open onOpenChange={(o) => !o && requestClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="cmd-overlay" />
        <Dialog.Content className={`cform norder norder--${mode}`} dir="rtl" aria-describedby={undefined} onPointerDownOutside={keepOpenOnToast} onInteractOutside={keepOpenOnToast} onEscapeKeyDown={(e) => {
            if (askClose) { e.preventDefault(); setAskClose(false); return; } // Escape בשאלה – חוזרים לעריכה
            if ((document.activeElement as HTMLElement | null)?.closest('.ib-table, .pgs')) e.preventDefault();
          }}
          onChangeCapture={markDirty} onInputCapture={markDirty}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}>
          <div className="cform__head norder__head">
            <Dialog.Title className="udialog__title">{fq ? <>הזמנה מהצעה <Ltr>{fq.id}</Ltr></> : 'הזמנה חדשה'}</Dialog.Title>
            <div className="seg norder__modes" role="tablist" aria-label="סוג ההזמנה">
              {MODES.map(([m, label, icon]) => (
                <button type="button" key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'is-on' : ''} onClick={() => { setMode(m); setErrors({}); }}>
                  {icon}{label}
                </button>
              ))}
            </div>
            <Dialog.Close asChild><button className="icon-btn" aria-label="סגור"><X size={18} /></button></Dialog.Close>
          </div>

          <form ref={formRef} className="cform__body" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
            {fq && (
              <p className="no-fromquote" role="note">
                <b>מתוך הצעת מחיר <Ltr>{fq.id}</Ltr>:</b> הלקוח, המועד, המשלוח והפריטים עם המחירים הועתקו.
                {fq.lines.some((l) => l.category === 'פיצות') && ' נשאר לפרט בפיצות סוגים ותוספות (אפשר לפצל שורה לכמה שורות).'} אחרי השמירה ההצעה תסומן "הפכה להזמנה".
                {!fq.customerId && ' הלקוח לא קיים במערכת – ייפתח לו תיק עם הפרטים מההצעה.'}
              </p>
            )}
            {/* החלפת לקוח קיים / לקוח חדש: הופעה רכה בלבד – התוכן לא תלוי בסיום אנימציית יציאה */}
            <motion.div key={mode === 'newCustomer' ? 'n' : 'e'} {...fade} transition={{ duration: 0.18 }}>
                {isNew ? (
                  <Section title="לקוח חדש">
                    <Row>
                      <L label="שם הלקוח" req wide>
                        <input className="input" autoFocus value={nc.name} onChange={(e) => { setNc({ ...nc, name: e.target.value }); clearErr('ncName'); }} placeholder="חברה או אדם פרטי" {...inv('ncName')} />
                        {err('ncName')}
                      </L>
                      <L label="סוג לקוח" group>
                        <div className="seg" role="radiogroup" aria-label="סוג לקוח">
                          {(['occasional', 'regular'] as const).map((t) => <button type="button" key={t} role="radio" aria-checked={nc.type === t} className={nc.type === t ? 'is-on' : ''} onClick={() => setNc({ ...nc, type: t })}>{t === 'regular' ? 'קבוע' : 'מזדמן'}</button>)}
                        </div>
                      </L>
                    </Row>
                    <Row>
                      <L label="איש קשר"><input className="input" value={nc.contactName} onChange={(e) => { setNc({ ...nc, contactName: e.target.value }); clearErr('ncContact'); }} {...inv('ncContact')} />{err('ncContact')}</L>
                      <L label="טלפון" req><input className="input input--ltr" inputMode="tel" value={nc.contactPhone} onChange={(e) => { setNc({ ...nc, contactPhone: e.target.value }); clearErr('ncPhone'); }} placeholder="05X-XXXXXXX" {...inv('ncPhone')} />{err('ncPhone')}</L>
                    </Row>
                    <Row>
                      <L label="ח.פ / ע.מ (לא חובה)"><input className="input input--ltr" inputMode="numeric" value={nc.taxId} onChange={(e) => { setNc({ ...nc, taxId: e.target.value }); clearErr('ncTax'); }} {...inv('ncTax')} />{err('ncTax')}
                        {taxTwin && <button type="button" className="link cform__twin" onClick={() => pickExisting(taxTwin)}>הזמנה ל"{taxTwin.name}" במקום</button>}
                      </L>
                    </Row>
                    {similar.length > 0 && (
                      <div className="cform__warn no-similar">
                        <CircleAlert size={18} aria-hidden="true" />
                        <div>
                          <b>אולי הלקוח כבר קיים?</b>
                          <ul>{similar.map(({ c: x, why }) => <li key={x.id}>{x.name} <span className="muted">({why})</span> · <button type="button" className="link" onClick={() => pickExisting(x)}>הזמנה ללקוח הזה</button></li>)}</ul>
                        </div>
                      </div>
                    )}
                  </Section>
                ) : (
                  <Section title="לקוח">
                    <CustomerPicker customers={customers} value={customerId} invalid={!!errors.customer}
                      onChange={(id) => { setCustomerId(id); clearErr('customer'); markDirty(); }}
                      onNew={(name) => { setNc((x) => ({ ...x, name })); setMode('newCustomer'); setErrors({}); }} />
                    {err('customer')}
                    {c && c.type === 'occasional' && orders.some((o) => o.customerId === c.id && o.status !== 'cancelled') && (
                      <p className="no-suggest no-regular">
                        <span>לקוח מזדמן שכבר הזמין בעבר – להפוך אותו ל"קבוע"?</span>
                        <button type="button" className="link" onClick={() => updateCustomer(c, { type: 'regular' }, 'הוצע בהזמנה חוזרת')
                          .then(() => toast({ message: <>{c.name} סומן כלקוח קבוע · כדאי להשלים בתיק: מחירון, כתובות והנחיות חיוב</>, action: { label: 'לתיק', run: () => { onClose(); window.location.hash = `#/customers/${c.id}`; } } }))
                          .catch(() => toast({ tone: 'error', message: 'העדכון נכשל – בדוק חיבור' }))}>הפוך לקבוע</button>
                      </p>
                    )}
                  </Section>
                )}
              </motion.div>

            <Section title="מועד וסניף">
              {whenSection}
              {past && (
                <div className="no-past" role="alert">
                  <b><CircleAlert size={16} aria-hidden="true" /> תאריך שעבר – ההזמנה תיכנס לתיעוד בלבד</b>
                  <span>היא תישמר כסגורה, בארכיון ובתיק הלקוח, ולא תקפיץ התראות. בחרו מה קרה בה:</span>
                  <div className="seg" role="radiogroup" aria-label="מה קרה בהזמנה">
                    {([['delivered', 'סופקה'], ['late', 'סופקה באיחור'], ['partial', 'סופקה חלקית'], ['cancelled', 'בוטלה']] as const).map(([k, label]) => (
                      <button type="button" key={k} role="radio" aria-checked={outcome === k} className={outcome === k ? 'is-on' : ''} onClick={() => { setOutcome(k); clearErr('outcome'); }}>{label}</button>
                    ))}
                  </div>
                  {outcome === 'late' && <L label="זמן האיחור (דקות)"><input className="input input--ltr no-past__mins" inputMode="numeric" value={lateMin} onChange={(e) => setLateMin(e.target.value)} placeholder="למשל 20" /></L>}
                  {(outcome === 'cancelled' || outcome === 'partial') && (
                    <L label={outcome === 'cancelled' ? 'סיבת הביטול' : 'מה סופק בפועל'} req>
                      <input className="input" value={pastReason} onChange={(e) => { setPastReason(e.target.value); clearErr('outcome'); }} />
                    </L>
                  )}
                  {outcome && outcome !== 'cancelled' && <L label="מס' הזמנה ב-Q (לא חובה)"><input className="input input--ltr no-past__mins" value={pastQ} onChange={(e) => setPastQ(e.target.value)} placeholder="cs000" /></L>}
                  {err('outcome')}
                </div>
              )}
              <Row>{branchField}{!past && statusField}</Row>
              <Row>
                <L label="ערוץ / מספר פניה" req>
                  <input className="input" list="no-channels" value={channel} onChange={(e) => { setChannel(e.target.value); clearErr('channel'); }} placeholder="למשל: וואטסאפ, מוקד, WellBe או מספר פניה" {...inv('channel')} />
                  <datalist id="no-channels">{channelHints.map((h) => <option key={h} value={h} />)}</datalist>
                  {err('channel')}
                </L>
              </Row>
            </Section>

            {dup && (
              <div className="cform__warn no-dup" role="status">
                <CircleAlert size={18} aria-hidden="true" />
                <div>
                  <b>יש כבר הזמנה דומה:</b> הזמנה <Ltr>{dup.id}</Ltr> · {dup.customerName} · <Ltr>{fmtDate(dup.date)}</Ltr> <Ltr>{dup.time}</Ltr> · {dup.branchName} · <Ltr>{fmtMoney(dup.amount)}</Ltr>
                  <div className="no-dup__actions">
                    <button type="button" className="link" onClick={() => { onClose(); panel.open(dup.id); }}>פתח אותה</button>
                  </div>
                </div>
              </div>
            )}

            <Section title="אספקה">{deliveryFields}</Section>
            {itemsSection}
            <Section title="תשלום">{paymentFields}</Section>
            <Section title="תעודת רכש">{poFields}</Section>
            <Section title="הערות">{notesFields}</Section>

            {errors.form && <p className="cform__formerr" role="alert"><CircleAlert size={16} aria-hidden="true" /> {errors.form}</p>}
          </form>

          {errors.form && <p className="cform__formerr no-formerr" role="alert"><CircleAlert size={16} aria-hidden="true" /> {errors.form}</p>}
          {(missLive.length > 0 || dup || similar.length > 0) && (customerChosen || dup) && (
            <ul className="no-missing" aria-live="polite" aria-label="לפני השמירה">
              {missLive.length > 0 && <li><CircleAlert size={16} aria-hidden="true" /><span><b>חסרים:</b> {missKeys.map((k, i) => <span key={k}>{i > 0 && ', '}<button type="button" className="link no-missing__go" onClick={() => goTo(k)}>{MISS_LABEL[k]}</button></span>)} – אפשר לשמור עכשיו, וההזמנה תסומן באדום עד שישלימו.</span></li>}
              {dup && <li><CircleAlert size={16} aria-hidden="true" /><span><b>יש הזמנה דומה</b> (<Ltr>{dup.id}</Ltr> · <Ltr>{dup.time}</Ltr>) – השמירה תיצור הזמנה נוספת.</span></li>}
              {similar.length > 0 && <li><CircleAlert size={16} aria-hidden="true" /><span><b>לקוח דומה כבר קיים</b> ({similar[0].c.name}) – השמירה תפתח לקוח חדש.</span></li>}
            </ul>
          )}
          {askClose ? (
            <div className="cform__foot no-confirm" role="alertdialog" aria-labelledby="no-confirm-q">
              <span id="no-confirm-q" className="no-confirm__q"><CircleAlert size={16} aria-hidden="true" /> ההזמנה עוד לא נשמרה. לסגור בלי לשמור?</span>
              <Button ref={stayRef} variant="secondary" onClick={() => setAskClose(false)}>המשך לערוך</Button>
              <Button variant="danger" onClick={onClose}>סגור בלי לשמור</Button>
            </div>
          ) : (
          <div className="cform__foot">
            <Button variant="primary" loading={busy} onClick={submit} kbd="Ctrl+Enter">{saveLabel}</Button>
            <Button variant="ghost" onClick={requestClose}>ביטול</Button>
            <span className="norder__sum" aria-live="polite">
              {finalAmount > 0 && <><Ltr>{fmtMoney(finalAmount)}</Ltr>{time && <> · <Ltr>{time}</Ltr></>}{branchObj && <> · {branchObj.name}</>}</>}
            </span>
          </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ---------- בחירת לקוח: חיפוש לפי שם, ח.פ או טלפון; בתחתית "+ לקוח חדש" ---------- */
function CustomerPicker({ customers, value, onChange, onNew, invalid }: {
  customers: Customer[]; value: string; onChange: (id: string) => void; onNew: (name: string) => void; invalid: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (value) return;
    const t = setTimeout(() => setOpen(true), 160);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = customers.find((c) => c.id === value);

  const options = useMemo(() => {
    const s = q.trim();
    const digits = s.replace(/\D/g, '');
    return customers.filter((c) => c.status === 'active' && (!s || c.name.includes(s)
      || (digits.length >= 3 && (c.taxId.includes(digits) || c.accountPhone.includes(digits) || c.contacts.some((p) => p.phone.includes(digits)))))).slice(0, 30);
  }, [customers, q]);
  const total = options.length + 1;
  const pick = (i: number) => {
    setOpen(false);
    if (i < options.length) { onChange(options[i].id); setQ(''); requestAnimationFrame(() => triggerRef.current?.focus()); }
    else onNew(q.trim());
  };

  return (
    <div className="bpick no-cpick">
      <span className="field__label" id={`${listId}-label`}>בחר לקוח<span className="req">חובה</span></span>
      <Popover.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(''); }}>
        <Popover.Trigger asChild>
          <button ref={triggerRef} type="button" onKeyDown={(e) => { if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setQ(e.key); setOpen(true); } }} className="bpick__trigger" aria-labelledby={`${listId}-label`} aria-haspopup="listbox" aria-expanded={open} aria-invalid={invalid || undefined}>
            {selected ? (
              <span className="bpick__value"><b>{selected.name}</b>{selected.type === 'regular' && <span className="bpick__cluster">קבוע</span>}</span>
            ) : <span className="bpick__placeholder">חפש לקוח לפי שם, ח.פ או טלפון…</span>}
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="pop bpick__pop" aria-labelledby={`${listId}-label`} align="start" sideOffset={4} dir="rtl" onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}>
            <input
              ref={inputRef}
              className="input input--sm"
              value={q}
              onChange={(e) => { setQ(e.target.value); setActive(0); }}
              placeholder="שם, ח.פ או טלפון"
              role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={`${listId}-${active}`} aria-label="חיפוש לקוח"
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % total); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + total) % total); }
                if (e.key === 'Enter') { e.preventDefault(); pick(active); }
              }}
            />
            <ul className="bpick__list" id={listId} role="listbox" aria-label="לקוחות">
              {options.map((c, i) => {
                const pc = primaryContact(c);
                return (
                  <li key={c.id} id={`${listId}-${i}`} role="option" aria-selected={value === c.id}
                    className={`bpick__opt ${active === i ? 'is-active' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => pick(i)}>
                    <span className="bpick__check">{value === c.id && <Check size={14} />}</span>
                    <span className="bpick__name">{c.name}</span>
                    <span className="bpick__cluster">{pc?.phone ? <Ltr>{fmtPhone(pc.phone)}</Ltr> : METHOD_LABEL[c.paymentMethod] ?? ''}</span>
                  </li>
                );
              })}
              {options.length === 0 && <li className="bpick__none">{q ? `לא נמצא לקוח "${q}"` : 'אין עדיין לקוחות'}</li>}
              <li id={`${listId}-${options.length}`} role="option" aria-selected={false}
                className={`bpick__opt bpick__add ${active === options.length ? 'is-active' : ''}`} onMouseEnter={() => setActive(options.length)} onClick={() => pick(options.length)}>
                <UserPlus size={16} aria-hidden="true" /> הזמנה ללקוח חדש{q && <> · "{q}"</>}
              </li>
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <fieldset className="cform__sec">
      <legend>{title}{aside}</legend>
      {children}
    </fieldset>
  );
}
function Row({ children }: { children: ReactNode }) { return <div className="cform__row">{children}</div>; }
/* group: שדה שמכיל קבוצת כפתורים – div במקום label, כדי שלחיצה על הכותרת לא תלחץ על הכפתור הראשון */
function L({ label, req, wide, group, children }: { label: string; req?: boolean; wide?: boolean; group?: boolean; children: ReactNode }) {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className={`cform__field ${wide ? 'is-wide' : ''}`}>
      <span className="field__label">{label}{req && <span className="req">חובה</span>}</span>
      {children}
    </Tag>
  );
}
