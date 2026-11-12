/* טופס לקוח – הוספה ועריכה (אפיון 6.5). מניעת כפילות תוך כדי הקלדה:
   ח.פ זהה – שגיאה בשדה מיד, והכפתור הראשי פותח את הלקוח הקיים במקום ליצור כפול. שם דומה או טלפון זהה – אזהרה, והמשתמש מחליט. */
import { useMemo, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import { CircleAlert, OctagonAlert, Plus, X } from 'lucide-react';
import { createCustomer, newId, primaryContact, updateCustomer, type Contact, type Customer, type CustomerInput, EMPTY_CUSTOMER } from '../../data/customers';
import { useLists } from '../../data/lists';
import { usePriceLists } from '../../data/priceLists';
import { Button, RadioSeg } from '../../design/components';
import { useToast } from '../../design/Toast';
import { fmtPhone } from '../../lib/format';
import { cleanPhone, isSimilar, phoneError } from '../../lib/names';
import { cleanTaxId, taxIdError } from '../../lib/taxid';
import './CustomerForm.css';

const CARD_RE = /\d{13,}/;

export function CustomerForm({ open, onClose, customers, editing, initialName = '' }: {
  open: boolean; onClose: () => void; customers: Customer[]; editing?: Customer; initialName?: string;
}) {
  const toast = useToast();
  const nav = useNavigate();
  const { lists } = useLists();
  const { items: priceLists } = usePriceLists();
  const pc = editing ? primaryContact(editing) : undefined;

  const [f, setF] = useState<CustomerInput>(() => editing ? { ...EMPTY_CUSTOMER, ...editing } : { ...EMPTY_CUSTOMER, name: initialName });
  const [contact, setContact] = useState({ name: pc?.name ?? '', phone: pc ? fmtPhone(pc.phone) : '', email: pc?.email ?? '', role: pc?.role ?? '' });
  const [emails, setEmails] = useState<string[]>(pc?.emails ?? []); // מיילים נוספים של איש הקשר הראשי
  const [more, setMore] = useState<Contact[]>([]); // אנשי קשר נוספים שנוספים כאן
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ackWarn, setAckWarn] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof CustomerInput>(k: K, v: CustomerInput[K]) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })); setAckWarn(false); };

  const others = customers.filter((c) => c.id !== editing?.id && c.status !== 'merged');
  const tax = cleanTaxId(f.taxId);
  const taxTwin = tax ? others.find((c) => c.taxId === tax) : undefined;
  const nameTwin = f.name.trim().length >= 3 ? others.find((c) => isSimilar(c.name, f.name)) : undefined;
  const phone = cleanPhone(contact.phone);
  const phoneTwin = phone.length >= 9 ? others.find((c) => c.contacts.some((x) => x.phone === phone) || c.accountPhone === phone) : undefined;
  const warnings = useMemo(() => {
    const w: { c: Customer; why: string }[] = [];
    if (nameTwin) w.push({ c: nameTwin, why: 'שם דומה' });
    if (phoneTwin && phoneTwin.id !== nameTwin?.id) w.push({ c: phoneTwin, why: 'אותו טלפון' });
    return w;
  }, [nameTwin, phoneTwin]);

  const activeMethods = (lists?.paymentMethods ?? []).filter((m) => m.active || m.id === f.paymentMethod);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'חובה: שם הלקוח (חברה או אדם פרטי)';
    const te = taxIdError(f.taxId); if (te) e.taxId = te;
    const pe = phoneError(contact.phone); if (pe) e.contactPhone = pe;
    // טלפון הקפה לא חוסם שמירה – לקוח בלי טלפון הקפה נשמר ומסומן "חסר" ברשימה ובתיק
    if (f.paymentMethod === 'account' && cleanPhone(f.accountPhone)) { const ae = phoneError(f.accountPhone); if (ae) e.accountPhone = ae; }
    if (contact.email && !/^\S+@\S+\.\S+$/.test(contact.email)) e.contactEmail = 'כתובת מייל לא תקינה';
    emails.forEach((m, i) => { if (m.trim() && !/^\S+@\S+\.\S+$/.test(m.trim())) e[`email${i}`] = 'כתובת מייל לא תקינה'; });
    more.forEach((m, i) => { const me = phoneError(m.phone); if (me) e[`morePhone${i}`] = me; if (m.email && !/^\S+@\S+\.\S+$/.test(m.email)) e[`moreEmail${i}`] = 'כתובת מייל לא תקינה'; });
    if (CARD_RE.test(f.priceNote ?? '')) e.priceNote = 'אסור לרשום כאן מספר כרטיס אשראי';
    if (CARD_RE.test(f.instructions)) e.instructions = 'אסור לרשום כאן מספר כרטיס אשראי';
    if (CARD_RE.test(f.billingInstructions)) e.billingInstructions = 'אסור לרשום כאן מספר כרטיס אשראי';
    setErrors(e);
    if (Object.keys(e).length || taxTwin) {
      // הפוקוס עובר לשדה הראשון השגוי (אפיון 2.2)
      requestAnimationFrame(() => (document.querySelector('.cform [aria-invalid="true"]') as HTMLElement | null)?.focus());
      return false;
    }
    return true;
  };

  const openTwin = (c: Customer) => { onClose(); nav(`/customers/${c.id}`); };
  const submit = async () => {
    if (taxTwin && !editing) { openTwin(taxTwin); return; }
    if (!validate()) return;
    if (warnings.length && !ackWarn) { setAckWarn(true); return; }
    const extra = emails.map((m) => m.trim()).filter(Boolean);
    const contacts = editing ? editing.contacts.map((c) => (c.id === pc?.id ? { ...c, name: contact.name.trim(), phone, email: contact.email.trim(), emails: extra, role: contact.role.trim() } : c)) : [];
    if (!editing || !pc) {
      if (contact.name.trim() || phone || contact.email.trim()) contacts.push({ id: newId(), name: contact.name.trim(), phone, email: contact.email.trim(), emails: extra, role: contact.role.trim(), primary: true });
    }
    more.filter((m) => m.name.trim() || cleanPhone(m.phone) || m.email.trim())
      .forEach((m) => contacts.push({ ...m, name: m.name.trim(), phone: cleanPhone(m.phone), email: m.email.trim(), role: m.role.trim(), primary: contacts.length === 0 }));
    const data: CustomerInput = { ...f, priceNote: (f.priceNote ?? '').trim(), accountPhone: f.paymentMethod === 'account' ? f.accountPhone : '', contacts };
    setBusy(true);
    try {
      if (editing) {
        await updateCustomer(editing, data);
        toast({ message: 'פרטי הלקוח עודכנו' });
        onClose();
      } else {
        const id = await createCustomer(data);
        toast({ message: <>הלקוח "{data.name.trim()}" נוסף</> });
        onClose();
        nav(`/customers/${id}`);
      }
    } catch {
      setErrors({ form: 'השמירה נכשלה. ייתכן שה-ח.פ כבר קיים אצל לקוח אחר, או שאין חיבור.' });
      setBusy(false);
    }
  };

  const err = (k: string) => errors[k] ? <span className="cform__err" id={`ce-${k}`} role="alert">{errors[k]}</span> : null;
  const inv = (k: string) => ({ 'aria-invalid': !!errors[k] || undefined, 'aria-describedby': errors[k] ? `ce-${k}` : undefined });
  const taxDup = !errors.taxId && taxTwin;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="cmd-overlay" />
        <Dialog.Content className="cform" dir="rtl" aria-describedby={undefined}>
          <div className="cform__head">
            <Dialog.Title className="udialog__title">{editing ? `עריכת ${editing.name}` : 'לקוח חדש'}</Dialog.Title>
            <Dialog.Close asChild><button className="icon-btn" aria-label="סגור"><X size={16} /></button></Dialog.Close>
          </div>

          <form className="cform__body" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
            <Section title="פרטי הלקוח">
              <Row>
                <L label="שם" req wide>
                  <input className="input" autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} {...inv('name')} />
                  {err('name')}
                </L>
                <L label="סוג לקוח">
                  <RadioSeg label="סוג לקוח" value={f.type} onChange={(v) => set('type', v)} options={[{ value: 'regular', label: 'קבוע' }, { value: 'occasional', label: 'מזדמן' }]} />
                </L>
              </Row>
              <Row>
                <L label="ח.פ / ע.מ">
                  <input className="input input--ltr" inputMode="numeric" value={f.taxId} onChange={(e) => set('taxId', e.target.value)} {...inv('taxId')}
                    {...(taxDup ? { 'aria-invalid': true, 'aria-describedby': 'ce-taxdup' } : {})} />
                  {err('taxId')}
                  {/* ח.פ כפול נבדק בזמן ההקלדה – שגיאה בשדה מיד, לא רק אחרי הלחיצה */}
                  {taxDup && (
                    <span className="cform__err" id="ce-taxdup" aria-live="polite">
                      ח.פ הזה כבר שייך ל"{taxTwin.name}" ·{' '}
                      <button type="button" className="link cform__twin" onClick={() => openTwin(taxTwin)}>פתח את התיק</button>
                    </span>
                  )}
                </L>
              </Row>
            </Section>

            <Section title="איש קשר ראשי">
              <Row>
                <L label="שם"><input className="input" value={contact.name} onChange={(e) => { setContact({ ...contact, name: e.target.value }); setErrors((x) => ({ ...x, contactName: '' })); }} {...inv('contactName')} />{err('contactName')}</L>
                <L label="תפקיד"><input className="input" value={contact.role} onChange={(e) => setContact({ ...contact, role: e.target.value })} placeholder="מנהלת משרד" /></L>
              </Row>
              <Row>
                <L label="טלפון"><input className="input input--ltr" inputMode="tel" value={contact.phone} onChange={(e) => { setContact({ ...contact, phone: e.target.value }); setErrors((x) => ({ ...x, contactPhone: '' })); setAckWarn(false); }} placeholder="05X-XXXXXXX" {...inv('contactPhone')} />{err('contactPhone')}</L>
                <L label="מייל"><input className="input input--ltr" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} {...inv('contactEmail')} />{err('contactEmail')}</L>
              </Row>
              {emails.map((m, i) => (
                <div key={i} className="cform__extra">
                  <L label={`מייל נוסף ${emails.length > 1 ? i + 1 : ''}`}>
                    <input className="input input--ltr" type="email" value={m} onChange={(e) => { setEmails((xs) => xs.map((x, j) => (j === i ? e.target.value : x))); setErrors((x) => ({ ...x, [`email${i}`]: '' })); }} {...inv(`email${i}`)} />
                    {err(`email${i}`)}
                  </L>
                  <button type="button" className="icon-btn icon-btn--sm" aria-label="הסר מייל נוסף" onClick={() => setEmails((xs) => xs.filter((_, j) => j !== i))}><X size={16} /></button>
                </div>
              ))}
              {more.map((m, i) => (
                <div key={m.id} className="cform__more">
                  <div className="cform__more-head"><span className="field__label">איש קשר נוסף</span>
                    <button type="button" className="icon-btn icon-btn--sm" aria-label="הסר איש קשר נוסף" onClick={() => setMore((xs) => xs.filter((x) => x.id !== m.id))}><X size={16} /></button></div>
                  <Row>
                    <L label="שם"><input className="input" value={m.name} onChange={(e) => setMore((xs) => xs.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)))} /></L>
                    <L label="תפקיד"><input className="input" value={m.role} onChange={(e) => setMore((xs) => xs.map((x) => (x.id === m.id ? { ...x, role: e.target.value } : x)))} /></L>
                  </Row>
                  <Row>
                    <L label="טלפון"><input className="input input--ltr" inputMode="tel" value={m.phone} placeholder="05X-XXXXXXX" onChange={(e) => { setMore((xs) => xs.map((x) => (x.id === m.id ? { ...x, phone: e.target.value } : x))); setErrors((x) => ({ ...x, [`morePhone${i}`]: '' })); }} {...inv(`morePhone${i}`)} />{err(`morePhone${i}`)}</L>
                    <L label="מייל"><input className="input input--ltr" type="email" value={m.email} onChange={(e) => { setMore((xs) => xs.map((x) => (x.id === m.id ? { ...x, email: e.target.value } : x))); setErrors((x) => ({ ...x, [`moreEmail${i}`]: '' })); }} {...inv(`moreEmail${i}`)} />{err(`moreEmail${i}`)}</L>
                  </Row>
                </div>
              ))}
              <div className="cform__adds">
                <button type="button" className="link" onClick={() => setMore((xs) => [...xs, { id: newId(), name: '', role: '', phone: '', email: '', primary: false }])}><Plus size={14} aria-hidden="true" /> איש קשר נוסף</button>
                <button type="button" className="link" onClick={() => setEmails((xs) => [...xs, ''])}><Plus size={14} aria-hidden="true" /> מייל נוסף</button>
              </div>
            </Section>

            <Section title="תשלום ומחירון">
              <Row>
                <L label="אמצעי תשלום ברירת מחדל">
                  {/* בקר מפולח עד 4 אפשרויות, מעבר לזה רשימה נפתחת – כמו בהזמנה חדשה */}
                  {activeMethods.length <= 4
                    ? <RadioSeg label="אמצעי תשלום" value={f.paymentMethod} onChange={(v) => set('paymentMethod', v)} options={activeMethods.map((m) => ({ value: m.id, label: m.label }))} />
                    : <select className="input" value={f.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)}>{activeMethods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>}
                </L>
                {f.paymentMethod === 'account' && (
                  <L label="טלפון הקפה">
                    <input className="input input--ltr" inputMode="tel" value={f.accountPhone} onChange={(e) => set('accountPhone', e.target.value)} placeholder="05X-XXXXXXX" {...inv('accountPhone')} />
                    {err('accountPhone')}
                    {cleanPhone(f.accountPhone).length >= 9 && others.some((c) => c.accountPhone === cleanPhone(f.accountPhone)) && (
                      <span className="cform__hint">טלפון הקפה כללי – משמש גם את {others.filter((c) => c.accountPhone === cleanPhone(f.accountPhone)).map((c) => c.name).join(', ')}</span>
                    )}
                  </L>
                )}
              </Row>
              <Row>
                <L label="מחירון">
                  <select className="input" value={f.priceListId} onChange={(e) => set('priceListId', e.target.value)}>
                    <option value="">ללא מחירון</option>
                    {priceLists.filter((p) => p.active || p.id === f.priceListId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </L>
                <L label=" ">
                  <label className="check-inline cform__check">
                    <input type="checkbox" checked={f.poRequired} onChange={(e) => set('poRequired', e.target.checked)} /> נדרשת תעודת רכש לכל הזמנה
                  </label>
                </L>
              </Row>
              <L label="הערת מחיר" wide>
                <input className="input" value={f.priceNote ?? ''} onChange={(e) => set('priceNote', e.target.value)} placeholder='למשל: מחיר לפי המחיר בממשק WellBe' {...inv('priceNote')} />
                {err('priceNote')}
              </L>
              <L label="הנחיות חיוב קבועות" wide>
                <textarea className="input cform__ta" rows={2} value={f.billingInstructions} onChange={(e) => set('billingInstructions', e.target.value)} placeholder="למשל: חשבונית למחלקת כספים, לציין מס' תעודת רכש" {...inv('billingInstructions')} />
                {err('billingInstructions')}
              </L>
            </Section>

            <Section title="הנחיות קבועות">
              <L label="מוצגות בראש כל הזמנה של הלקוח" wide>
                <textarea className="input cform__ta" rows={2} value={f.instructions} onChange={(e) => set('instructions', e.target.value)} placeholder="למשל: להגיע לשער האחורי, להתקשר 10 דקות לפני" {...inv('instructions')} />
                {err('instructions')}
              </L>
            </Section>

            {ackWarn && warnings.length > 0 && (
              <div className="cform__warn" role="alert">
                <CircleAlert size={16} aria-hidden="true" />
                <div>
                  <b>יכול להיות שהלקוח כבר קיים:</b>
                  <ul>
                    {warnings.map((w) => (
                      <li key={w.c.id}>{w.why}: <button type="button" className="link" onClick={() => openTwin(w.c)}>{w.c.name}</button></li>
                    ))}
                  </ul>
                  <span>אם זה לקוח אחר – לחץ שוב על "{editing ? 'שמור' : 'הוסף לקוח'}".</span>
                </div>
              </div>
            )}
            {errors.form && <p className="cform__formerr" role="alert"><OctagonAlert size={16} aria-hidden="true" /> {errors.form}</p>}
          </form>

          <div className="cform__foot">
            <Button variant="primary" loading={busy} onClick={submit}>{editing ? 'שמור' : taxTwin ? 'ח.פ קיים – פתח את הלקוח' : ackWarn && warnings.length ? 'זה לקוח אחר – הוסף' : 'הוסף לקוח'}</Button>
            <Dialog.Close asChild><Button variant="ghost">ביטול</Button></Dialog.Close>
            {!editing && !taxTwin && warnings.length > 0 && !ackWarn && <span className="cform__live"><CircleAlert size={14} aria-hidden="true" /> נמצא לקוח דומה – נבדוק לפני השמירה</span>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className="cform__sec"><legend>{title}</legend>{children}</fieldset>;
}
function Row({ children }: { children: ReactNode }) {
  return <div className="cform__row">{children}</div>;
}
function L({ label, req, wide, children }: { label: string; req?: boolean; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`cform__field ${wide ? 'is-wide' : ''}`}>
      <span className="field__label">{label}{req && <span className="req">חובה</span>}</span>
      {children}
    </label>
  );
}
