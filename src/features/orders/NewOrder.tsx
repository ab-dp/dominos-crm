/* יצירת הזמנה (אפיון 4.3, 4.4, 4.6, 6.4) – חלון אחד, שתי דרכים:
   הזמנה – ללקוח קיים: כל הפרטים בעמוד אחד. בחירת לקוח טוענת את הקבוע אצלו (תשלום, הקפה, כתובת, איש קשר).
   לקוח חדש – מקים לקוח והזמנה באותה שמירה.
   פרט חובה שחסר לא חוסם: אחרי אישור ההזמנה נשמרת ומסומנת באדום עד שמשלימים. Ctrl+Enter שומר. */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown, CircleAlert, ClipboardList, Minus, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { useAuth } from '../../auth/AuthContext';
import { useBranches, useClusters } from '../../data/branches';
import { EMPTY_CUSTOMER, newId, primaryContact, updateCustomer, useCustomers, type Customer } from '../../data/customers';
import { useLists } from '../../data/lists';
import { createOrder, findDuplicate, type NewOrderInput } from '../../data/orders';
import { usePriceLists } from '../../data/priceLists';
import { useStore, type NewOrderMode } from '../../data/store';
import { METHOD_LABEL, type OrderItem, type OrderStatus } from '../../data/types';
import { Button } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, fmtDate, fmtMoney, fmtPhone, toISODate, weekday } from '../../lib/format';
import { cleanPhone, isSimilar, phoneError } from '../../lib/names';
import { cleanTaxId, taxIdError } from '../../lib/taxid';
import { BranchPicker, type BranchChoice } from '../branches/BranchPicker';
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
  channel: 'ערוץ', address: 'כתובת', final: 'סכום', amount: 'סכום', account: 'טלפון הקפה', ncAccount: 'טלפון הקפה', contents: 'פריטים', po: 'תעודת רכש',
};

type Line = OrderItem & { key: string };
const money = (s: string) => Number(s.replace(/[^\d.]/g, '')) || 0;

export function NewOrderDialog() {
  const { newOrder, closeNewOrder } = useStore();
  if (!newOrder) return null;
  return <NewOrderForm key={JSON.stringify(newOrder)} initial={newOrder} onClose={closeNewOrder} />;
}

function NewOrderForm({ initial, onClose }: { initial: { mode?: NewOrderMode; customerId?: string; date?: string; customerName?: string }; onClose: () => void }) {
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
  const tomorrow = toISODate(new Date(now.getTime() + 86400000));

  const [mode, setMode] = useState<NewOrderMode>(initial.customerName || initial.mode === 'newCustomer' ? 'newCustomer' : 'full');
  const [customerId, setCustomerId] = useState(initial.customerId ?? '');
  const [nc, setNc] = useState({ name: initial.customerName ?? '', type: 'occasional' as Customer['type'], taxId: '', contactName: '', contactPhone: '', paymentMethod: 'credit', accountPhone: '' });
  const [date, setDate] = useState(initial.date ?? today);
  const [time, setTime] = useState('');
  const [branch, setBranch] = useState<BranchChoice | null>(null);
  const [delivery, setDelivery] = useState<'delivery' | 'pickup'>('delivery');
  const [addressId, setAddressId] = useState('');
  const [address, setAddress] = useState('');
  const [contactId, setContactId] = useState('');
  const [contact, setContact] = useState({ name: '', phone: '' });
  const [fee, setFee] = useState('');
  const [override, setOverride] = useState<string | null>(null); // סכום לחיוב שהוקלד ידנית
  const [poFile, setPoFile] = useState<File | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
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
  const [ackDup, setAckDup] = useState(false);
  const [ackSimilar, setAckSimilar] = useState(false);
  const [ackMissing, setAckMissing] = useState(false);
  const [saveContact, setSaveContact] = useState(false); // לשמור איש קשר חדש גם בתיק הלקוח
  const [saveAddress, setSaveAddress] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const isNew = mode === 'newCustomer';
  const c = isNew ? undefined : customers.find((x) => x.id === customerId);
  const priceList = c ? priceLists.find((p) => p.id === c.priceListId) : undefined;
  const branchObj = branches.find((b) => b.id === branch?.branchId);
  const clearErr = (...k: string[]) => setErrors((e) => { const n = { ...e }; k.forEach((x) => delete n[x]); return n; });

  /* בחירת לקוח טוענת את מה שקבוע אצלו: תשלום, טלפון הקפה, כתובת, הנחיות, סניף מועדף.
     איש הקשר לא נטען לבד – הוא משתנה מהזמנה להזמנה, ולכן מוצע לבחירה ("האם זה איש הקשר?") כדי שלא תצא הזמנה עם איש קשר ישן. */
  useEffect(() => {
    if (!c) return;
    const addr = c.addresses[0];
    setMethod(c.paymentMethod);
    setAccountPhone(c.accountPhone ? fmtPhone(c.accountPhone) : '');
    setAddressId(addr?.id ?? '');
    setAddress(addr?.address ?? c.businessAddress ?? '');
    setContactId('');
    setContact({ name: '', phone: '' });
    setSaveContact(false);
    setSaveAddress(false);
    if (addr?.preferredBranchId && branches.some((b) => b.id === addr.preferredBranchId)) {
      const b = branches.find((x) => x.id === addr.preferredBranchId)!;
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
  const past = !!date && date < today; // תאריך שעבר – הזמנה לתיעוד בלבד
  const linesTotal = lines.reduce((t, l) => t + l.qty * l.unitPrice, 0);
  const useLines = lines.length > 0;
  // דמי המשלוח נוספים לסכום הפריטים
  const feeValue = delivery === 'delivery' ? money(fee) : 0;
  const total = linesTotal + feeValue;
  const canOverride = lines.length > 0 || feeValue > 0;
  const finalAmount = canOverride && override !== null ? money(override) : total;
  const isManual = canOverride && override !== null && finalAmount !== total;
  const addLine = (itemId?: string) => {
    const it = catalog.find((x) => x.id === itemId);
    setLines((ls) => [...ls, { key: newId(), itemId: it?.id, name: it?.name ?? '', qty: 1, unitPrice: it?.price ?? 0 }]);
    clearErr('amount');
  };
  const setLine = (key: string, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));

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

  const pickExisting = (x: Customer) => { setCustomerId(x.id); setMode('full'); setErrors({}); setAckSimilar(false); };

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
  const validate = () => {
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
    if (total - feeValue <= 0) m.amount = lines.length ? 'סכום הפריטים הוא 0' : MISS;
    if (useLines && lines.some((l) => !l.name.trim() || l.qty <= 0)) e.amount = 'לכל פריט צריך שם וכמות';
    if (!lines.length) m.contents = MISS;
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
    setErrors({ ...m, ...e });
    const focusFirst = () => requestAnimationFrame(() => (formRef.current?.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus());
    if (Object.keys(e).length) { focusFirst(); return false; }
    const missList = Object.keys(m).map((k) => MISS_LABEL[k]).filter((x, i, a) => x && a.indexOf(x) === i);
    if (missList.length && !ackMissing && !past) { setAckMissing(true); focusFirst(); return false; }
    return true;
  };

  const submit = async () => {
    if (busy || !validate()) return;
    if (dup && !ackDup) { setAckDup(true); return; }
    if (similar.length && !ackSimilar) { setAckSimilar(true); return; }
    const b = branchObj; // אפשר לשמור בלי סניף – ההזמנה תסומן באדום עד שישובץ
    const customerName = isNew ? nc.name.trim() : c!.name;
    const input: NewOrderInput = {
      customerId: c?.id ?? '',
      customerName,
      date, time,
      branchId: b?.id ?? '', branchName: b?.name ?? '', branchPhone: b?.phone ?? '',
      cluster: b ? clusters.find((x) => x.id === b.clusterId)?.name ?? '' : '',
      amount: finalAmount,
      calcAmount: isManual ? total : undefined,
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
      items: useLines ? lines.map(({ key: _k, itemId, ...l }) => ({ ...(itemId ? { itemId } : {}), ...l, name: l.name.trim() })) : [],
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
        }, `נוסף מתוך הזמנה ${n}`).catch(() => toast({ message: 'ההזמנה נשמרה, אבל השמירה בתיק הלקוח נכשלה – אפשר להוסיף שם ידנית' }));
      }
      if (poFile) {
        // הקובץ נשמר אחרי ההזמנה; אם נכשל – ההזמנה כבר שמורה ואפשר לצרף שוב מהתיק
        await uploadOrderDoc(n, poFile, input.customerId || '').catch(() => toast({ message: <>ההזמנה נשמרה, אבל צירוף תעודת הרכש נכשל – אפשר לצרף אותה מתיק ההזמנה <Ltr>{n}</Ltr></> }));
      }
      toast({
        message: <>הזמנה <Ltr>{n}</Ltr> נשמרה · {customerName} · {date === today ? 'היום' : date === tomorrow ? 'מחר' : <Ltr>{fmtDate(date)}</Ltr>} <Ltr>{time}</Ltr>{ackMissing && missNow.length > 0 && <> · <b>חסרים פרטים – מסומנת באדום</b></>}</>,
        action: { label: 'פתח תיק', run: () => panel.open(n) },
      });
      onClose();
    } catch {
      setErrors({ form: 'השמירה נכשלה – בדוק חיבור ונסה שוב. שום דבר לא נשמר.' });
      setBusy(false);
    }
  };

  const err = (k: string) => errors[k] ? <span className="cform__err" id={`no-${k}`} role="alert">{errors[k]}</span> : null;
  const inv = (k: string) => ({ 'aria-invalid': !!errors[k] || undefined, 'aria-describedby': errors[k] ? `no-${k}` : undefined });
  const missNow = [...new Set(Object.entries(errors).filter(([k, v]) => v === MISS || (k === 'amount' && v === 'סכום הפריטים הוא 0')).map(([k]) => MISS_LABEL[k]))];
  const fade = reduce ? { initial: { opacity: 0 }, animate: { opacity: 1 } } : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 } };

  /* ---------- חלקי הטופס ---------- */
  const whenSection = (
    <Row>
      <L label="תאריך אספקה" req>
        <div className="no-date">
          <input type="date" className="input input--ltr" value={date} onChange={(e) => { setDate(e.target.value); clearErr('date'); setAckDup(false); }} {...inv('date')} />
          <div className="seg" role="group" aria-label="קיצור תאריך">
            <button type="button" className={date === today ? 'is-on' : ''} aria-pressed={date === today} onClick={() => { setDate(today); clearErr('date'); }}>היום</button>
            <button type="button" className={date === tomorrow ? 'is-on' : ''} aria-pressed={date === tomorrow} onClick={() => { setDate(tomorrow); clearErr('date'); }}>מחר</button>
          </div>
        </div>
        {date && !errors.date && <span className="cform__hint muted">יום {weekday(date)}</span>}
        {err('date')}
      </L>
      <L label="שעה" req>
        <input type="time" step={900} className="input input--ltr no-time" value={time} onChange={(e) => { setTime(e.target.value); clearErr('time'); setAckDup(false); }} {...inv('time')} />
        {err('time')}
      </L>
    </Row>
  );

  const branchField = (
    <div className="cform__field" {...(errors.branch ? { 'data-invalid': true } : {})}>
      <BranchPicker label="סניף (חובה)" value={branch} onChange={(v) => { setBranch(v); clearErr('branch'); setAckDup(false); }} preferredId={c?.addresses.find((a) => a.id === addressId)?.preferredBranchId} />
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
    <Section title="פריטים ומחיר" aside={<span className="no-total">{isManual ? 'לחיוב' : 'סה״כ'} <b><Ltr>{fmtMoney(finalAmount)}</Ltr></b></span>}>
      {c?.priceNote && <p className="no-pricenote" role="note"><b>הערת מחיר:</b> {c.priceNote}</p>}
      {lines.length > 0 && (
        <table className="no-items">
          <thead><tr><th>פריט</th><th>כמות</th><th>מחיר ליח׳</th><th className="num">סה״כ</th><th><span className="sr-only">הסר</span></th></tr></thead>
          <tbody>
            <AnimatePresence initial={false}>
              {lines.map((l) => {
                const it = catalog.find((x) => x.id === l.itemId);
                return (
                  <motion.tr key={l.key} layout={!reduce} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
                    <td>
                      {l.itemId ? <span className="no-items__name">{l.name}{it?.custom && <span className="pricecell__tag">מחיר ללקוח</span>}</span>
                        : <input className="input input--sm" value={l.name} onChange={(e) => setLine(l.key, { name: e.target.value })} placeholder="שם הפריט" aria-label="שם הפריט" />}
                    </td>
                    <td>
                      <div className="stepper">
                        <button type="button" aria-label="הפחת" onClick={() => setLine(l.key, { qty: Math.max(1, l.qty - 1) })}><Minus size={14} /></button>
                        <input className="input input--sm input--ltr" inputMode="numeric" value={l.qty} onChange={(e) => setLine(l.key, { qty: Number(e.target.value.replace(/\D/g, '')) || 0 })} aria-label={`כמות ${l.name}`} />
                        <button type="button" aria-label="הוסף" onClick={() => setLine(l.key, { qty: l.qty + 1 })}><Plus size={14} /></button>
                      </div>
                    </td>
                    <td><input className="input input--sm input--ltr no-items__price" inputMode="decimal" value={l.unitPrice} onChange={(e) => setLine(l.key, { unitPrice: money(e.target.value) })} aria-label={`מחיר ליחידה ${l.name}`} /></td>
                    <td className="num"><Ltr>{fmtMoney(l.qty * l.unitPrice)}</Ltr></td>
                    <td><button type="button" className="icon-btn" aria-label={`הסר ${l.name || 'פריט'}`} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}><Trash2 size={16} /></button></td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      )}
      {catalog.length > 0 && (
        <div className="no-quick" role="group" aria-label="הוספה מהירה מהמחירון">
          {catalog.slice(0, 8).map((i) => (
            <button type="button" key={i.id} className="chip" onClick={() => addLine(i.id)}>
              <Plus size={14} aria-hidden="true" /> {i.name} <span className="muted"><Ltr>{fmtMoney(i.price)}</Ltr></span>
            </button>
          ))}
        </div>
      )}
      <div className="no-add">
        {catalog.length > 8 && (
          <select className="input no-add__pick" value="" onChange={(e) => e.target.value && addLine(e.target.value)} aria-label={`הוסף פריט מהמחירון ${priceList?.name ?? ''}`}>
            <option value="">+ עוד פריטים מהמחירון "{priceList?.name}"</option>
            {catalog.map((i) => <option key={i.id} value={i.id}>{i.name} · {fmtMoney(i.price)}{i.custom ? ' (מחיר ללקוח)' : ''}</option>)}
          </select>
        )}
        <Button size="sm" variant="ghost" type="button" icon={<Plus size={16} />} onClick={() => addLine()}>{catalog.length ? 'פריט שלא במחירון' : 'הוסף פריט'}</Button>
      </div>
      {lines.length === 0 && (
        <p className={`no-items-empty ${errors.contents ? 'is-err' : ''}`}>
          התכולה נרשמת לפי פריטים: כל פריט עם כמות ומחיר{catalog.length ? ' – מהמחירון, או "פריט שלא במחירון"' : ' – "הוסף פריט"'}. למשל: משפחתית פטריות · 6 · ₪62.
          {!isNew && !priceList && c && <> ללקוח אין מחירון – אפשר לשייך בתיק הלקוח.</>}
        </p>
      )}
      {err('amount')}
      {delivery === 'delivery' && (
        <Row>
          <L label="דמי משלוח (₪)">
            <input className="input input--ltr" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" />
          </L>
        </Row>
      )}
      {canOverride && (
        <div className={`no-final ${isManual ? 'is-manual' : ''}`}>
          <L label="סכום לחיוב (לפי הסגירה מול הלקוח)">
            <input className="input input--ltr" inputMode="decimal" value={override ?? String(total)} onChange={(e) => { setOverride(e.target.value); clearErr('final'); }} {...inv('final')} />
            {err('final')}
          </L>
          {isManual ? (
            <p className="no-final__note">
              <span className="no-final__tag">שונה ידנית</span> מחושב: <Ltr>{fmtMoney(total)}</Ltr>
              <button type="button" className="link" onClick={() => setOverride(null)}>חזור לחישוב</button>
            </p>
          ) : <p className="muted no-hint">מתעדכן לבד מהפריטים{feeValue ? ' ודמי המשלוח' : ''}. אפשר להקליד סכום אחר.</p>}
        </div>
      )}
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
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="cmd-overlay" />
        <Dialog.Content className={`cform norder norder--${mode}`} dir="rtl" aria-describedby={undefined} onPointerDownOutside={keepOpenOnToast} onInteractOutside={keepOpenOnToast}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}>
          <div className="cform__head norder__head">
            <Dialog.Title className="udialog__title">הזמנה חדשה</Dialog.Title>
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
            {/* החלפת לקוח קיים / לקוח חדש: הופעה רכה בלבד – התוכן לא תלוי בסיום אנימציית יציאה */}
            <motion.div key={mode === 'newCustomer' ? 'n' : 'e'} {...fade} transition={{ duration: 0.18 }}>
                {isNew ? (
                  <Section title="לקוח חדש">
                    <Row>
                      <L label="שם הלקוח" req wide>
                        <input className="input" autoFocus value={nc.name} onChange={(e) => { setNc({ ...nc, name: e.target.value }); clearErr('ncName'); setAckSimilar(false); }} placeholder="חברה או אדם פרטי" {...inv('ncName')} />
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
                      <L label="טלפון" req><input className="input input--ltr" inputMode="tel" value={nc.contactPhone} onChange={(e) => { setNc({ ...nc, contactPhone: e.target.value }); clearErr('ncPhone'); setAckSimilar(false); }} placeholder="05X-XXXXXXX" {...inv('ncPhone')} />{err('ncPhone')}</L>
                    </Row>
                    <Row>
                      <L label="ח.פ / ע.מ (לא חובה)"><input className="input input--ltr" inputMode="numeric" value={nc.taxId} onChange={(e) => { setNc({ ...nc, taxId: e.target.value }); clearErr('ncTax'); }} {...inv('ncTax')} />{err('ncTax')}
                        {taxTwin && <button type="button" className="link cform__twin" onClick={() => pickExisting(taxTwin)}>הזמנה ל"{taxTwin.name}" במקום</button>}
                      </L>
                    </Row>
                    {similar.length > 0 && (
                      <div className={`cform__warn no-similar ${ackSimilar ? 'is-ack' : ''}`} role={ackSimilar ? 'alert' : undefined}>
                        <CircleAlert size={18} aria-hidden="true" />
                        <div>
                          <b>אולי הלקוח כבר קיים?</b>
                          <ul>{similar.map(({ c: x, why }) => <li key={x.id}>{x.name} <span className="muted">({why})</span> · <button type="button" className="link" onClick={() => pickExisting(x)}>הזמנה ללקוח הזה</button></li>)}</ul>
                          {ackSimilar && <span>אם זה לקוח אחר – לחץ שוב "שמור הזמנה".</span>}
                        </div>
                      </div>
                    )}
                  </Section>
                ) : (
                  <Section title="לקוח">
                    <CustomerPicker customers={customers} value={customerId} invalid={!!errors.customer}
                      onChange={(id) => { setCustomerId(id); clearErr('customer'); setAckDup(false); }}
                      onNew={(name) => { setNc((x) => ({ ...x, name })); setMode('newCustomer'); setErrors({}); }} />
                    {err('customer')}
                    {c && c.type === 'occasional' && orders.some((o) => o.customerId === c.id && o.status !== 'cancelled') && (
                      <p className="no-suggest no-regular">
                        <span>לקוח מזדמן שכבר הזמין בעבר – להפוך אותו ל"קבוע"?</span>
                        <button type="button" className="link" onClick={() => updateCustomer(c, { type: 'regular' }, 'הוצע בהזמנה חוזרת')
                          .then(() => toast({ message: <>{c.name} סומן כלקוח קבוע · כדאי להשלים בתיק: מחירון, כתובות והנחיות חיוב</>, action: { label: 'לתיק', run: () => { onClose(); window.location.hash = `#/customers/${c.id}`; } } }))
                          .catch(() => toast({ message: 'העדכון נכשל – בדוק חיבור' }))}>הפוך לקבוע</button>
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
                <L label="ערוץ ההזמנה" req>
                  <input className="input" list="no-channels" value={channel} onChange={(e) => { setChannel(e.target.value); clearErr('channel'); }} placeholder="למשל: וואטסאפ, מכירות, מוקד, WellBe" {...inv('channel')} />
                  <datalist id="no-channels">{channelHints.map((h) => <option key={h} value={h} />)}</datalist>
                  {err('channel')}
                </L>
              </Row>
            </Section>

            {dup && (
              <div className={`cform__warn no-dup ${ackDup ? 'is-ack' : ''}`} role={ackDup ? 'alert' : 'status'}>
                <CircleAlert size={18} aria-hidden="true" />
                <div>
                  <b>יש כבר הזמנה דומה:</b> הזמנה <Ltr>{dup.id}</Ltr> · {dup.customerName} · <Ltr>{fmtDate(dup.date)}</Ltr> <Ltr>{dup.time}</Ltr> · {dup.branchName} · <Ltr>{fmtMoney(dup.amount)}</Ltr>
                  <div className="no-dup__actions">
                    <button type="button" className="link" onClick={() => { onClose(); panel.open(dup.id); }}>פתח אותה</button>
                    {ackDup && <span>אם זו הזמנה נוספת – לחץ "צור בכל זאת".</span>}
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

          {ackMissing && missNow.length > 0 && (
            <div className="no-missing" role="alert">
              <CircleAlert size={18} aria-hidden="true" />
              <div>
                <b>חסרים פרטים: {missNow.join(', ')}</b>
                <span>מומלץ להשלים עכשיו. אם אין ברירה – אפשר לשמור, וההזמנה תסומן באדום עד שישלימו אותם.</span>
              </div>
            </div>
          )}
          <div className="cform__foot">
            <Button variant="primary" loading={busy} onClick={submit} kbd="Ctrl+Enter">{dup && ackDup ? 'צור בכל זאת' : ackMissing && missNow.length ? 'שמור עם פרטים חסרים' : isNew ? 'שמור לקוח והזמנה' : 'שמור הזמנה'}</Button>
            <Button variant="ghost" onClick={onClose}>ביטול</Button>
            <span className="norder__sum" aria-live="polite">
              {finalAmount > 0 && <><Ltr>{fmtMoney(finalAmount)}</Ltr>{time && <> · <Ltr>{time}</Ltr></>}{branchObj && <> · {branchObj.name}</>}</>}
            </span>
          </div>
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
