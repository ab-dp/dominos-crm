/* יצירת הזמנה (אפיון 4.3, 4.4, 4.6, 6.4) – חלון אחד, שלוש דרכים:
   מהירה – ללקוח קבוע: לקוח, מועד, סניף, סכום. כל השאר נטען מהלקוח.
   מלאה – כל הפרטים בעמוד אחד, פריטים מהמחירון (כולל מחיר ייחודי ללקוח).
   לקוח חדש – מקים לקוח והזמנה באותה שמירה.
   מעבר בין הדרכים שומר את מה שכבר הוקלד. Ctrl+Enter שומר. */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown, CircleAlert, CopyCheck, Minus, Plus, Trash2, UserPlus, X, Zap } from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { useAuth } from '../../auth/AuthContext';
import { useBranches, useClusters } from '../../data/branches';
import { EMPTY_CUSTOMER, newId, primaryContact, useCustomers, type Customer } from '../../data/customers';
import { useLists } from '../../data/lists';
import { createOrder, findDuplicate, type NewOrderInput } from '../../data/orders';
import { usePriceLists } from '../../data/priceLists';
import { useStore, type NewOrderMode } from '../../data/store';
import { METHOD_LABEL, STATUS_LABEL, type OrderItem, type OrderStatus } from '../../data/types';
import { Button } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, fmtDate, fmtMoney, fmtPhone, toISODate, weekday } from '../../lib/format';
import { cleanPhone, isSimilar, phoneError } from '../../lib/names';
import { cleanTaxId, taxIdError } from '../../lib/taxid';
import { BranchPicker, type BranchChoice } from '../branches/BranchPicker';
import { uploadOrderDoc } from '../../data/orderDocs';
import { FileDrop } from './OrderDocs';
import '../customers/CustomerForm.css';
import './NewOrder.css';

const CARD_RE = /\d{13,}/;
const MODES: [NewOrderMode, string, ReactNode][] = [
  ['quick', 'הזמנה מהירה', <Zap size={16} key="q" />],
  ['full', 'הזמנה מלאה', <CopyCheck size={16} key="f" />],
  ['newCustomer', 'לקוח חדש', <UserPlus size={16} key="n" />],
];
const START_STATUS: OrderStatus[] = ['new', 'pending_customer', 'approved'];

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
  const { orders, now } = useStore();
  const { items: customers } = useCustomers();
  const { items: branches } = useBranches();
  const { items: clusters } = useClusters();
  const { items: priceLists } = usePriceLists();
  const { lists } = useLists();

  const today = toISODate(now);
  const tomorrow = toISODate(new Date(now.getTime() + 86400000));

  const [mode, setMode] = useState<NewOrderMode>(initial.mode ?? (initial.customerName ? 'newCustomer' : 'quick'));
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
  const [amount, setAmount] = useState('');
  const [contents, setContents] = useState('');
  const [fee, setFee] = useState('');
  const [override, setOverride] = useState<string | null>(null); // סכום לחיוב שהוקלד ידנית
  const [poFile, setPoFile] = useState<File | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [status, setStatus] = useState<OrderStatus>('new');
  const [channel, setChannel] = useState('');
  const [method, setMethod] = useState('');
  const [accountPhone, setAccountPhone] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [instructions, setInstructions] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ackDup, setAckDup] = useState(false);
  const [ackSimilar, setAckSimilar] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const isNew = mode === 'newCustomer';
  const c = isNew ? undefined : customers.find((x) => x.id === customerId);
  const priceList = c ? priceLists.find((p) => p.id === c.priceListId) : undefined;
  const branchObj = branches.find((b) => b.id === branch?.branchId);
  const clearErr = (...k: string[]) => setErrors((e) => { const n = { ...e }; k.forEach((x) => delete n[x]); return n; });

  // בחירת לקוח טוענת את כל מה שקבוע אצלו: תשלום, טלפון הקפה, כתובת, איש קשר, הנחיות, סניף מועדף
  useEffect(() => {
    if (!c) return;
    const addr = c.addresses[0];
    const pc = primaryContact(c);
    setMethod(c.paymentMethod);
    setAccountPhone(c.accountPhone);
    setAddressId(addr?.id ?? '');
    setAddress(addr?.address ?? c.businessAddress ?? '');
    setContactId(pc?.id ?? '');
    setContact({ name: pc?.name ?? '', phone: pc?.phone ?? '' });
    setInstructions(c.instructions);
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
  const linesTotal = lines.reduce((t, l) => t + l.qty * l.unitPrice, 0);
  const useLines = mode !== 'quick' && lines.length > 0;
  // בהזמנה מלאה דמי המשלוח נוספים לסכום; בהזמנה מהירה הסכום שנרשם הוא הסכום הכולל
  const feeValue = mode !== 'quick' && delivery === 'delivery' ? money(fee) : 0;
  const total = (useLines ? linesTotal : money(amount)) + feeValue;
  const canOverride = mode !== 'quick' && (lines.length > 0 || feeValue > 0);
  const finalAmount = canOverride && override !== null ? money(override) : total;
  const isManual = canOverride && override !== null && finalAmount !== total;
  const addLine = (itemId?: string) => {
    const it = catalog.find((x) => x.id === itemId);
    setLines((ls) => [...ls, { key: newId(), itemId: it?.id, name: it?.name ?? '', qty: 1, unitPrice: it?.price ?? 0 }]);
    clearErr('amount');
  };
  const setLine = (key: string, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));

  /* ---------- כפילויות ---------- */
  const dup = isNew ? undefined : findDuplicate(orders, { customerId, date, time, branchId: branch?.branchId ?? '' });
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

  const pickExisting = (x: Customer) => { setCustomerId(x.id); setMode('quick'); setErrors({}); setAckSimilar(false); };

  const methods = (lists?.paymentMethods ?? []).filter((m) => m.active || m.id === method || m.id === nc.paymentMethod);
  const effMethod = isNew ? nc.paymentMethod : method;
  const effAccountPhone = isNew ? nc.accountPhone : accountPhone;
  const methodLabel = methods.find((m) => m.id === effMethod)?.label ?? METHOD_LABEL[effMethod] ?? effMethod;

  /* ---------- בדיקה ושמירה ---------- */
  const validate = () => {
    const e: Record<string, string> = {};
    if (isNew) {
      if (!nc.name.trim()) e.ncName = 'חובה: שם הלקוח';
      const te = taxIdError(nc.taxId); if (te) e.ncTax = te;
      if (taxTwin) e.ncTax = `ח.פ הזה כבר שייך ל"${taxTwin.name}"`;
      if (!nc.contactName.trim()) e.ncContact = 'חובה: איש קשר';
      if (!ncPhone) e.ncPhone = 'חובה: טלפון';
      else { const pe = phoneError(nc.contactPhone); if (pe) e.ncPhone = pe; }
    } else if (!c) e.customer = 'חובה: בחר לקוח';
    if (!date) e.date = 'חובה: תאריך אספקה';
    else if (date < today) e.date = 'התאריך כבר עבר';
    if (!/^\d{2}:\d{2}$/.test(time)) e.time = 'חובה: שעת אספקה';
    if (!branch) e.branch = 'חובה: סניף';
    if (!channel.trim()) e.channel = 'חובה: ערוץ ההזמנה';
    else if (CARD_RE.test(channel)) e.channel = 'אסור לרשום כאן מספר כרטיס אשראי';
    if (isManual && finalAmount <= 0) e.final = 'חובה: סכום לחיוב';
    if (total - feeValue <= 0) e.amount = mode === 'quick' || !lines.length ? 'חובה: סכום ההזמנה' : 'סכום הפריטים הוא 0';
    if (useLines && lines.some((l) => !l.name.trim() || l.qty <= 0)) e.amount = 'לכל פריט צריך שם וכמות';
    if (effMethod === 'account') {
      if (!cleanPhone(effAccountPhone)) e[isNew ? 'ncAccount' : 'account'] = 'חובה בהקפה: טלפון ההקפה';
      else { const pe = phoneError(effAccountPhone); if (pe) e[isNew ? 'ncAccount' : 'account'] = pe; }
    }
    if (!isNew && contact.phone.trim()) { const pe = phoneError(contact.phone); if (pe) e.contactPhone = pe; }
    if (CARD_RE.test(poNumber)) e.po = 'אסור לרשום כאן מספר כרטיס אשראי';
    if (CARD_RE.test(contents)) e.contents = 'אסור לרשום כאן מספר כרטיס אשראי';
    if (CARD_RE.test(note)) e.note = 'אסור לרשום כאן מספר כרטיס אשראי';
    if (CARD_RE.test(instructions)) e.instructions = 'אסור לרשום כאן מספר כרטיס אשראי';
    if (CARD_RE.test(address)) e.address = 'אסור לרשום כאן מספר כרטיס אשראי';
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => (formRef.current?.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus());
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (busy || !validate()) return;
    if (dup && !ackDup) { setAckDup(true); return; }
    if (similar.length && !ackSimilar) { setAckSimilar(true); return; }
    const b = branchObj!;
    const customerName = isNew ? nc.name.trim() : c!.name;
    const input: NewOrderInput = {
      customerId: c?.id ?? '',
      customerName,
      date, time,
      branchId: b.id, branchName: b.name, branchPhone: b.phone,
      cluster: clusters.find((x) => x.id === b.clusterId)?.name ?? '',
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
      contacts: [{ id: newId(), name: nc.contactName.trim(), role: '', phone: ncPhone, email: '', primary: true }],
      addresses: delivery === 'delivery' && address.trim() ? [{ id: newId(), label: 'כתובת אספקה', address: address.trim(), directions: '', preferredBranchId: b.id }] : [],
      instructions: instructions.trim(),
    } : undefined;
    setBusy(true);
    try {
      const n = await createOrder(input, draft);
      if (poFile) {
        // הקובץ נשמר אחרי ההזמנה; אם נכשל – ההזמנה כבר שמורה ואפשר לצרף שוב מהתיק
        await uploadOrderDoc(n, poFile).catch(() => toast({ message: <>ההזמנה נשמרה, אבל צירוף תעודת הרכש נכשל – אפשר לצרף אותה מתיק ההזמנה <Ltr>{n}</Ltr></> }));
      }
      toast({
        message: <>הזמנה <Ltr>{n}</Ltr> נשמרה · {customerName} · {date === today ? 'היום' : date === tomorrow ? 'מחר' : <Ltr>{fmtDate(date)}</Ltr>} <Ltr>{time}</Ltr></>,
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
  const fade = reduce ? { initial: { opacity: 0 }, animate: { opacity: 1 } } : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 } };

  /* ---------- חלקי הטופס ---------- */
  const whenSection = (
    <Row>
      <L label="תאריך אספקה" req>
        <div className="no-date">
          <input type="date" className="input input--ltr" value={date} min={today} onChange={(e) => { setDate(e.target.value); clearErr('date'); setAckDup(false); }} {...inv('date')} />
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
    <L label="סטטוס" group>
      <div className="seg" role="radiogroup" aria-label="סטטוס התחלתי">
        {START_STATUS.map((s) => <button type="button" key={s} role="radio" aria-checked={status === s} className={status === s ? 'is-on' : ''} onClick={() => setStatus(s)}>{STATUS_LABEL[s]}</button>)}
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
        {!isNew && c && c.contacts.length > 1 && (
          <L label="מאנשי הקשר של הלקוח">
            <select className="input" value={contactId} onChange={(e) => { const p = c.contacts.find((x) => x.id === e.target.value); setContactId(e.target.value); setContact({ name: p?.name ?? '', phone: p?.phone ?? '' }); clearErr('contactPhone'); }}>
              {c.contacts.map((p) => <option key={p.id} value={p.id}>{p.name}{p.phone ? ` · ${fmtPhone(p.phone)}` : ''}</option>)}
            </select>
          </L>
        )}
      </Row>
      {!isNew && (
        <Row>
          <L label="איש קשר לקבלת ההזמנה">
            <input className="input" value={contact.name} onChange={(e) => { setContact({ ...contact, name: e.target.value }); setContactId(''); }} placeholder="מי מקבל את ההזמנה" />
          </L>
          <L label="טלפון">
            <input className="input input--ltr" inputMode="tel" value={contact.phone} onChange={(e) => { setContact({ ...contact, phone: e.target.value }); setContactId(''); clearErr('contactPhone'); }} placeholder="05X-XXXXXXX" {...inv('contactPhone')} />
            {err('contactPhone')}
          </L>
        </Row>
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
    </>
  );

  const itemsSection = (
    <Section title="פריטים ומחיר" aside={<span className="no-total">{isManual ? 'לחיוב' : 'סה״כ'} <b><Ltr>{fmtMoney(finalAmount)}</Ltr></b></span>}>
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
        <Row>
          <L label={catalog.length ? 'או סכום כולל (₪, כולל מע״מ)' : 'סכום הפריטים (₪, כולל מע״מ)'} req>
            <input className="input input--ltr" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); clearErr('amount'); }} placeholder="0" {...inv('amount')} />
            {err('amount')}
          </L>
          {!isNew && !priceList && c && <p className="muted no-hint">ללקוח אין מחירון – אפשר לשייך מחירון בתיק הלקוח.</p>}
        </Row>
      )}
      {lines.length > 0 && err('amount')}
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
      <L label={lines.length ? 'פירוט נוסף (לא חובה)' : 'תכולת ההזמנה'} wide>
        <textarea className="input cform__ta" rows={2} value={contents} onChange={(e) => { setContents(e.target.value); clearErr('contents'); }} placeholder="למשל: 12 משפחתיות (6 זיתים, 6 פטריות), 10 לחם שום, 6 שתייה 1.5 ל'" {...inv('contents')} />
        {err('contents')}
      </L>
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
        <L label="מס' תעודת רכש (לא חובה)">
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
      <L label="הנחיות להזמנה" wide>
        <textarea className="input cform__ta" rows={2} value={instructions} onChange={(e) => { setInstructions(e.target.value); clearErr('instructions'); }} placeholder="למשל: להגיע לשער האחורי" {...inv('instructions')} />
        {err('instructions')}
      </L>
      <Row>
        <L label="הערה פנימית" wide>
          <input className="input" value={note} onChange={(e) => { setNote(e.target.value); clearErr('note'); }} placeholder="נראית רק במוקד" {...inv('note')} />
          {err('note')}
        </L>
      </Row>
    </>
  );

  /* בהזמנה מהירה – תקציר של מה שנטען אוטומטית מהלקוח, עם מעבר לעריכה מלאה */
  const autoSummary = c && (
    <motion.div className="no-auto" {...fade} transition={{ duration: 0.2 }}>
      <span className="no-auto__title"><Check size={14} aria-hidden="true" /> נטען מהלקוח</span>
      <span><b>{methodLabel}</b>{effMethod === 'account' && accountPhone && <> · <Ltr>{fmtPhone(accountPhone)}</Ltr></>}</span>
      <span>{address ? <>משלוח ל{address}</> : <span className="warn-text">אין כתובת שמורה</span>}</span>
      {contact.name && <span>{contact.name}{contact.phone && <> · <Ltr>{fmtPhone(contact.phone)}</Ltr></>}</span>}
      {c.instructions && <span className="no-auto__instr">"{c.instructions}"</span>}
      {c.poRequired && <span>בדרך כלל עם תעודת רכש</span>}
      <button type="button" className="link" onClick={() => setMode('full')}>לשינוי – הזמנה מלאה</button>
    </motion.div>
  );

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="cmd-overlay" />
        <Dialog.Content className={`cform norder norder--${mode}`} dir="rtl" aria-describedby={undefined}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}>
          <header className="cform__head norder__head">
            <Dialog.Title className="udialog__title">הזמנה חדשה</Dialog.Title>
            <div className="seg norder__modes" role="tablist" aria-label="סוג ההזמנה">
              {MODES.map(([m, label, icon]) => (
                <button type="button" key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'is-on' : ''} onClick={() => { setMode(m); setErrors({}); }}>
                  {icon}{label}
                </button>
              ))}
            </div>
            <Dialog.Close asChild><button className="icon-btn" aria-label="סגור"><X size={18} /></button></Dialog.Close>
          </header>

          <form ref={formRef} className="cform__body" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={mode === 'newCustomer' ? 'n' : 'e'} {...fade} exit={{ opacity: 0, transition: { duration: 0.08 } }} transition={{ duration: 0.18 }}>
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
                      <L label="איש קשר" req><input className="input" value={nc.contactName} onChange={(e) => { setNc({ ...nc, contactName: e.target.value }); clearErr('ncContact'); }} {...inv('ncContact')} />{err('ncContact')}</L>
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
                    {mode === 'quick' && autoSummary}
                  </Section>
                )}
              </motion.div>
            </AnimatePresence>

            <Section title="מועד וסניף">
              {whenSection}
              <Row>{branchField}{statusField}</Row>
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

            {mode === 'quick' ? (
              <Section title="תכולה וסכום">
                <L label="מה מזמינים" wide>
                  <textarea className="input cform__ta" rows={2} value={contents} onChange={(e) => { setContents(e.target.value); clearErr('contents'); }} placeholder="למשל: 12 משפחתיות, 10 לחם שום, 6 שתייה, משלוח" {...inv('contents')} />
                  {err('contents')}
                </L>
                <Row>
                  <L label="סכום כולל (₪, כולל מע״מ ומשלוח)" req>
                    <input className="input input--ltr" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); clearErr('amount'); }} placeholder="0" {...inv('amount')} />
                    {err('amount')}
                  </L>
                  <L label="הערה פנימית">
                    <input className="input" value={note} onChange={(e) => { setNote(e.target.value); clearErr('note'); }} placeholder="נראית רק במוקד" {...inv('note')} />
                    {err('note')}
                  </L>
                </Row>
                {c?.poRequired && poFields}
                {effMethod === 'account' && !cleanPhone(accountPhone) && c && (
                  <Row>
                    <L label="טלפון הקפה" req>
                      <input className="input input--ltr" inputMode="tel" value={accountPhone} onChange={(e) => { setAccountPhone(e.target.value); clearErr('account'); }} placeholder="05X-XXXXXXX" {...inv('account')} />
                      {err('account')}
                    </L>
                  </Row>
                )}
              </Section>
            ) : (
              <>
                <Section title="אספקה">{deliveryFields}</Section>
                {itemsSection}
                <Section title="תשלום">{paymentFields}</Section>
                <Section title="תעודת רכש">{poFields}</Section>
                <Section title="הנחיות והערות">{notesFields}</Section>
              </>
            )}

            {errors.form && <p className="cform__formerr" role="alert"><CircleAlert size={16} aria-hidden="true" /> {errors.form}</p>}
          </form>

          <footer className="cform__foot">
            <Button variant="primary" loading={busy} onClick={submit} kbd="Ctrl+Enter">{dup && ackDup ? 'צור בכל זאת' : isNew ? 'שמור לקוח והזמנה' : 'שמור הזמנה'}</Button>
            <Button variant="ghost" onClick={onClose}>ביטול</Button>
            <span className="norder__sum" aria-live="polite">
              {finalAmount > 0 && <><Ltr>{fmtMoney(finalAmount)}</Ltr>{time && <> · <Ltr>{time}</Ltr></>}{branchObj && <> · {branchObj.name}</>}</>}
            </span>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ---------- בחירת לקוח: חיפוש לפי שם, ח.פ או טלפון; בתחתית "+ לקוח חדש" ---------- */
function CustomerPicker({ customers, value, onChange, onNew, invalid }: {
  customers: Customer[]; value: string; onChange: (id: string) => void; onNew: (name: string) => void; invalid: boolean;
}) {
  const [open, setOpen] = useState(!value);
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
          <button ref={triggerRef} type="button" className="bpick__trigger" aria-labelledby={`${listId}-label`} aria-haspopup="listbox" aria-expanded={open} aria-invalid={invalid || undefined}>
            {selected ? (
              <span className="bpick__value"><b>{selected.name}</b>{selected.type === 'regular' && <span className="bpick__cluster">קבוע</span>}</span>
            ) : <span className="bpick__placeholder">חפש לקוח לפי שם, ח.פ או טלפון…</span>}
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="pop bpick__pop" align="start" sideOffset={4} dir="rtl" onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}>
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
