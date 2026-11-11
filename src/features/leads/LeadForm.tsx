/* כרטיס ליד – הוספה ועריכה (אפיון 19.1). מניעת כפילות תוך כדי הקלדה, מול הלקוחות ומול הלידים הפתוחים:
   ח.פ זהה – לא ניתן לשמור, עם קישור לקיים. שם דומה או טלפון זהה – אזהרה, והמשתמש מחליט. ליד חדש נשמר רק עם צעד הבא. */
import { useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import { CircleAlert, OctagonAlert, Plus, Star, Trash2, X } from 'lucide-react';
import { useCustomers } from '../../data/customers';
import { useBranches } from '../../data/branches';
import { useLists } from '../../data/lists';
import { EMPTY_LEAD, createLead, emptyContact, findTwins, updateLead, type Lead, type LeadContact, type LeadInput, type NextStep } from '../../data/leads';
import { Button } from '../../design/components';
import { useToast } from '../../design/Toast';
import { fmtPhone } from '../../lib/format';
import { cleanPhone, phoneError } from '../../lib/names';
import { taxIdError } from '../../lib/taxid';
import { StepFields, stepError } from './LeadDialogs';
import '../customers/CustomerForm.css';
import './Leads.css';

const CARD_RE = /\d{13,}/;
const num = (s: string) => Math.max(0, Math.round(Number(s.replace(/[^\d.]/g, '')) || 0));

export function LeadForm({ onClose, leads, editing, initialName = '' }: { onClose: () => void; leads: Lead[]; editing?: Lead; initialName?: string }) {
  const toast = useToast();
  const nav = useNavigate();
  const { items: customers } = useCustomers();
  const { items: branches } = useBranches();
  const { lists } = useLists();
  const [f, setF] = useState<LeadInput>(() => editing ? { ...EMPTY_LEAD, ...editing } : { ...EMPTY_LEAD, name: initialName, contacts: [{ ...emptyContact(), decider: true }] });
  const [contacts, setContacts] = useState<LeadContact[]>(() => (f.contacts.length ? f.contacts : [{ ...emptyContact(), decider: true }]).map((c) => ({ ...c, phone: fmtPhone(c.phone) })));
  const [tags, setTags] = useState(f.tags.join(', '));
  const [step, setStep] = useState<NextStep>(f.nextStep ?? { text: '', due: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ackWarn, setAckWarn] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof LeadInput>(k: K, v: LeadInput[K]) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })); setAckWarn(false); };
  const setContact = (i: number, patch: Partial<LeadContact>) => { setContacts((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : patch.decider ? { ...c, decider: false } : c))); setAckWarn(false); };

  const { block, warns } = findTwins({ name: f.name, taxId: f.taxId, phones: contacts.map((c) => c.phone) }, customers, leads, editing?.id);
  const activeOf = (key: 'leadSources' | 'leadFields', cur: string) => (lists?.[key] ?? []).filter((x) => x.active || x.id === cur);
  const withStep = !editing || ['new', 'contacted', 'proposal', 'trial'].includes(editing.stage);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'חובה: שם העסק';
    const te = taxIdError(f.taxId); if (te) e.taxId = te;
    if (block) e.taxId = `${block.why}: "${block.name}"`;
    contacts.forEach((c, i) => { const pe = phoneError(c.phone); if (pe) e[`phone${i}`] = pe; if (c.email && !/^\S+@\S+\.\S+$/.test(c.email)) e[`email${i}`] = 'כתובת מייל לא תקינה'; });
    if (!contacts.some((c) => c.name.trim())) e.contacts = 'חובה: לפחות איש קשר אחד';
    if (CARD_RE.test(f.notes)) e.notes = 'אסור לרשום כאן מספר כרטיס אשראי';
    if (withStep && !editing) { const se = stepError(step); if (se) e.step = se; }
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => (document.querySelector('.lform [aria-invalid="true"]') as HTMLElement | null)?.focus());
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (!validate()) return;
    if (warns.length && !ackWarn) { setAckWarn(true); return; }
    const data: LeadInput = {
      ...f, contacts: contacts.map((c) => ({ ...c, phone: cleanPhone(c.phone) })),
      tags: tags.split(/[,،]/).map((t) => t.trim()).filter(Boolean),
      nextStep: editing ? f.nextStep : step,
    };
    setBusy(true);
    try {
      if (editing) {
        const { nextStep: _keep, ...rest } = data;
        await updateLead(editing, rest);
        toast({ message: 'פרטי הליד עודכנו' });
        onClose();
      } else {
        const id = await createLead(data);
        toast({ message: <>הליד "{data.name.trim()}" נוסף · הצעד הבא נכנס למשימות</> });
        onClose();
        nav(`/leads/${id}`);
      }
    } catch {
      setErrors({ form: 'השמירה נכשלה – בדוק חיבור' });
      setBusy(false);
    }
  };

  const err = (k: string) => errors[k] ? <span className="cform__err" id={`le-${k}`} role="alert">{errors[k]}</span> : null;
  const inv = (k: string) => ({ 'aria-invalid': !!errors[k] || undefined, 'aria-describedby': errors[k] ? `le-${k}` : undefined });
  const open = (t: { kind: 'customer' | 'lead'; id: string }) => { onClose(); nav(t.kind === 'customer' ? `/customers/${t.id}` : `/leads/${t.id}`); };

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="cmd-overlay" />
        <Dialog.Content className="cform lform" dir="rtl" aria-describedby={undefined}>
          <div className="cform__head">
            <Dialog.Title className="udialog__title">{editing ? `עריכת ${editing.name}` : 'ליד חדש'}</Dialog.Title>
            <Dialog.Close asChild><button className="icon-btn" aria-label="סגור"><X size={16} /></button></Dialog.Close>
          </div>

          <form className="cform__body" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
            <Section title="העסק">
              <Row>
                <L label="שם העסק" req wide>
                  <input className="input" autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} {...inv('name')} />
                  {err('name')}
                </L>
              </Row>
              <Row>
                <L label="תחום">
                  <select className="input" value={f.field} onChange={(e) => set('field', e.target.value)}>
                    <option value="">—</option>
                    {activeOf('leadFields', f.field).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                  </select>
                </L>
                <L label="מקור הליד">
                  <select className="input" value={f.source} onChange={(e) => set('source', e.target.value)}>
                    <option value="">—</option>
                    {activeOf('leadSources', f.source).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                  </select>
                </L>
              </Row>
              <Row>
                <L label="אזור / כתובת"><input className="input" value={f.area} onChange={(e) => set('area', e.target.value)} placeholder="למשל: רמת החייל, תל אביב" /></L>
                <L label="הסניף הקרוב">
                  <select className="input" value={f.branchId} onChange={(e) => set('branchId', e.target.value)}>
                    <option value="">—</option>
                    {branches.filter((b) => b.active || b.id === f.branchId).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </L>
              </Row>
              <Row>
                <L label="ח.פ / ע.מ">
                  <input className="input input--ltr" inputMode="numeric" value={f.taxId} onChange={(e) => set('taxId', e.target.value)} {...inv('taxId')} />
                  {err('taxId')}
                  {block && <button type="button" className="link cform__twin" onClick={() => open(block)}>פתח את "{block.name}"</button>}
                </L>
                <L label="מספר עובדים"><input className="input input--ltr" inputMode="numeric" value={f.size || ''} onChange={(e) => set('size', num(e.target.value))} placeholder="0" /></L>
              </Row>
            </Section>

            <Section title="אנשי קשר">
              {contacts.map((c, i) => (
                <div key={c.id} className="lform__contact">
                  <div className="cform__row">
                    <L label="שם"><input className="input" value={c.name} onChange={(e) => { setContact(i, { name: e.target.value }); setErrors((x) => ({ ...x, contacts: '' })); }} {...inv(i === 0 ? 'contacts' : `n${i}`)} /></L>
                    <L label="תפקיד"><input className="input" value={c.role} onChange={(e) => setContact(i, { role: e.target.value })} placeholder="מנהלת משרד, רכש" /></L>
                  </div>
                  <div className="cform__row">
                    <L label="טלפון"><input className="input input--ltr" inputMode="tel" value={c.phone} onChange={(e) => { setContact(i, { phone: e.target.value }); setErrors((x) => ({ ...x, [`phone${i}`]: '' })); }} placeholder="05X-XXXXXXX" {...inv(`phone${i}`)} />{err(`phone${i}`)}</L>
                    <L label="מייל"><input className="input input--ltr" type="email" value={c.email} onChange={(e) => setContact(i, { email: e.target.value })} {...inv(`email${i}`)} />{err(`email${i}`)}</L>
                  </div>
                  <div className="lform__contact-foot">
                    <button type="button" className={`chip ${c.decider ? 'is-on' : ''}`} aria-pressed={c.decider} onClick={() => setContact(i, { decider: !c.decider })}><Star size={14} aria-hidden="true" /> מקבל החלטות</button>
                    {contacts.length > 1 && <button type="button" className="link lform__remove" onClick={() => setContacts((cs) => cs.filter((_, j) => j !== i))}><Trash2 size={14} aria-hidden="true" /> הסר</button>}
                  </div>
                </div>
              ))}
              {err('contacts')}
              {contacts.length < 20 && <Button size="sm" variant="ghost" icon={<Plus size={16} />} onClick={() => setContacts((cs) => [...cs, emptyContact()])}>איש קשר נוסף</Button>}
            </Section>

            <Section title="פוטנציאל">
              <Row>
                <L label="הזמנות בחודש (הערכה)"><input className="input input--ltr" inputMode="numeric" value={f.potentialOrders || ''} onChange={(e) => set('potentialOrders', num(e.target.value))} placeholder="0" /></L>
                <L label="₪ בחודש (הערכה)"><input className="input input--ltr" inputMode="numeric" value={f.potentialAmount || ''} onChange={(e) => set('potentialAmount', num(e.target.value))} placeholder="0" /></L>
              </Row>
              <Row>
                <L label="תגיות" wide><input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="מופרדות בפסיק: כשר, ישיבות צוות, אירוע שנתי" /></L>
              </Row>
              <L label="הערות" wide>
                <textarea className="input cform__ta" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} {...inv('notes')} />
                {err('notes')}
              </L>
            </Section>

            {!editing && (
              <Section title="מה עושים עכשיו">
                <StepFields step={step} onChange={(s) => { setStep(s); setErrors((x) => ({ ...x, step: '' })); }} err={errors.step} />
              </Section>
            )}

            {ackWarn && warns.length > 0 && (
              <div className="cform__warn" role="alert">
                <CircleAlert size={16} aria-hidden="true" />
                <div>
                  <b>יכול להיות שהעסק כבר קיים:</b>
                  <ul>{warns.map((w) => <li key={w.id}>{w.why}: <button type="button" className="link" onClick={() => open(w)}>{w.name}</button></li>)}</ul>
                  <span>אם זה עסק אחר – לחץ שוב על "{editing ? 'שמור' : 'הוסף ליד'}".</span>
                </div>
              </div>
            )}
            {errors.form && <p className="cform__formerr" role="alert"><OctagonAlert size={16} aria-hidden="true" /> {errors.form}</p>}
          </form>

          <div className="cform__foot">
            <Button variant="primary" loading={busy} onClick={submit}>{editing ? 'שמור' : ackWarn && warns.length ? 'זה עסק אחר – הוסף' : 'הוסף ליד'}</Button>
            <Dialog.Close asChild><Button variant="ghost">ביטול</Button></Dialog.Close>
            {(block || warns.length > 0) && !ackWarn && <span className="cform__live"><CircleAlert size={14} aria-hidden="true" /> {block ? block.why : 'נמצא עסק דומה – נבדוק לפני השמירה'}</span>}
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
