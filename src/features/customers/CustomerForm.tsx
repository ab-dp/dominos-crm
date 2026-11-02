/* טופס לקוח – הוספה ועריכה (אפיון 6.5). מניעת כפילות תוך כדי הקלדה:
   ח.פ זהה – לא ניתן ליצור, עם קישור ללקוח הקיים. שם דומה או טלפון זהה – אזהרה, והמשתמש מחליט. */
import { useMemo, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import { CircleAlert, OctagonAlert, X } from 'lucide-react';
import { createCustomer, newId, primaryContact, updateCustomer, type Customer, type CustomerInput, EMPTY_CUSTOMER } from '../../data/customers';
import { useLists } from '../../data/lists';
import { usePriceLists } from '../../data/priceLists';
import { Button } from '../../design/components';
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
    if (taxTwin) e.taxId = `ח.פ הזה כבר שייך ללקוח "${taxTwin.name}"`;
    if (!editing && !contact.name.trim()) e.contactName = 'חובה: איש קשר';
    if (!editing && !phone) e.contactPhone = 'חובה: טלפון של איש הקשר';
    const pe = phoneError(contact.phone); if (pe) e.contactPhone = pe;
    if (f.paymentMethod === 'account') {
      if (!cleanPhone(f.accountPhone)) e.accountPhone = 'חובה ללקוח הקפה: טלפון ההקפה';
      else { const ae = phoneError(f.accountPhone); if (ae) e.accountPhone = ae; }
    }
    if (contact.email && !/^\S+@\S+\.\S+$/.test(contact.email)) e.contactEmail = 'כתובת מייל לא תקינה';
    if (CARD_RE.test(f.instructions)) e.instructions = 'אסור לרשום כאן מספר כרטיס אשראי';
    if (CARD_RE.test(f.billingInstructions)) e.billingInstructions = 'אסור לרשום כאן מספר כרטיס אשראי';
    setErrors(e);
    if (Object.keys(e).length) {
      // הפוקוס עובר לשדה הראשון השגוי (אפיון 2.2)
      requestAnimationFrame(() => (document.querySelector('.cform [aria-invalid="true"]') as HTMLElement | null)?.focus());
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (!validate()) return;
    if (warnings.length && !ackWarn) { setAckWarn(true); return; }
    const contacts = editing ? editing.contacts.map((c) => (c.id === pc?.id ? { ...c, name: contact.name.trim(), phone, email: contact.email.trim(), role: contact.role.trim() } : c)) : [];
    if (!editing || !pc) {
      if (contact.name.trim() || phone) contacts.push({ id: newId(), name: contact.name.trim(), phone, email: contact.email.trim(), role: contact.role.trim(), primary: true });
    }
    const data: CustomerInput = { ...f, accountPhone: f.paymentMethod === 'account' ? f.accountPhone : '', contacts };
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

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="cmd-overlay" />
        <Dialog.Content className="cform" dir="rtl" aria-describedby={undefined}>
          <div className="cform__head">
            <Dialog.Title className="udialog__title">{editing ? `עריכת ${editing.name}` : 'לקוח חדש'}</Dialog.Title>
            <Dialog.Close asChild><button className="icon-btn" aria-label="סגור"><X size={18} /></button></Dialog.Close>
          </div>

          <form className="cform__body" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
            <Section title="פרטי הלקוח">
              <Row>
                <L label="שם" req wide>
                  <input className="input" autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} {...inv('name')} />
                  {err('name')}
                </L>
                <L label="סוג לקוח">
                  <div className="seg" role="radiogroup" aria-label="סוג לקוח">
                    {(['regular', 'occasional'] as const).map((t) => (
                      <button type="button" key={t} role="radio" aria-checked={f.type === t} className={f.type === t ? 'is-on' : ''} onClick={() => set('type', t)}>{t === 'regular' ? 'קבוע' : 'מזדמן'}</button>
                    ))}
                  </div>
                </L>
              </Row>
              <Row>
                <L label="ח.פ / ע.מ">
                  <input className="input input--ltr" inputMode="numeric" value={f.taxId} onChange={(e) => set('taxId', e.target.value)} {...inv('taxId')} />
                  {err('taxId')}
                  {taxTwin && <button type="button" className="link cform__twin" onClick={() => { onClose(); nav(`/customers/${taxTwin.id}`); }}>פתח את "{taxTwin.name}"</button>}
                </L>
                <L label="כתובת עסק" wide>
                  <input className="input" value={f.businessAddress} onChange={(e) => set('businessAddress', e.target.value)} />
                </L>
              </Row>
            </Section>

            <Section title="איש קשר ראשי">
              <Row>
                <L label="שם" req={!editing}><input className="input" value={contact.name} onChange={(e) => { setContact({ ...contact, name: e.target.value }); setErrors((x) => ({ ...x, contactName: '' })); }} {...inv('contactName')} />{err('contactName')}</L>
                <L label="תפקיד"><input className="input" value={contact.role} onChange={(e) => setContact({ ...contact, role: e.target.value })} placeholder="מנהלת משרד" /></L>
              </Row>
              <Row>
                <L label="טלפון" req={!editing}><input className="input input--ltr" inputMode="tel" value={contact.phone} onChange={(e) => { setContact({ ...contact, phone: e.target.value }); setErrors((x) => ({ ...x, contactPhone: '' })); setAckWarn(false); }} placeholder="05X-XXXXXXX" {...inv('contactPhone')} />{err('contactPhone')}</L>
                <L label="מייל"><input className="input input--ltr" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} {...inv('contactEmail')} />{err('contactEmail')}</L>
              </Row>
            </Section>

            <Section title="תשלום ומחירון">
              <Row>
                <L label="אמצעי תשלום ברירת מחדל">
                  <div className="seg" role="radiogroup" aria-label="אמצעי תשלום">
                    {activeMethods.map((m) => (
                      <button type="button" key={m.id} role="radio" aria-checked={f.paymentMethod === m.id} className={f.paymentMethod === m.id ? 'is-on' : ''} onClick={() => set('paymentMethod', m.id)}>{m.label}</button>
                    ))}
                  </div>
                </L>
                {f.paymentMethod === 'account' && (
                  <L label="טלפון הקפה" req>
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
                    {priceLists.filter((p) => p.active || p.id === f.priceListId).map((p) => <option key={p.id} value={p.id}>{p.name}{p.kind === 'unique' ? ' (ייחודי)' : ''}</option>)}
                  </select>
                </L>
                <L label=" ">
                  <label className="check-inline cform__check">
                    <input type="checkbox" checked={f.poRequired} onChange={(e) => set('poRequired', e.target.checked)} /> נדרשת תעודת רכש לכל הזמנה
                  </label>
                </L>
              </Row>
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
                <CircleAlert size={18} aria-hidden="true" />
                <div>
                  <b>יכול להיות שהלקוח כבר קיים:</b>
                  <ul>
                    {warnings.map((w) => (
                      <li key={w.c.id}>{w.why}: <button type="button" className="link" onClick={() => { onClose(); nav(`/customers/${w.c.id}`); }}>{w.c.name}</button></li>
                    ))}
                  </ul>
                  <span>אם זה לקוח אחר – לחץ שוב על "{editing ? 'שמור' : 'הוסף לקוח'}".</span>
                </div>
              </div>
            )}
            {errors.form && <p className="cform__formerr" role="alert"><OctagonAlert size={16} aria-hidden="true" /> {errors.form}</p>}
          </form>

          <div className="cform__foot">
            <Button variant="primary" loading={busy} onClick={submit}>{editing ? 'שמור' : ackWarn && warnings.length ? 'זה לקוח אחר – הוסף' : 'הוסף לקוח'}</Button>
            <Dialog.Close asChild><Button variant="ghost">ביטול</Button></Dialog.Close>
            {!editing && warnings.length > 0 && !ackWarn && <span className="cform__live"><CircleAlert size={14} aria-hidden="true" /> נמצא לקוח דומה – נבדוק לפני השמירה</span>}
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
