/* חלונות הליד (אפיון 19.1): כל עדכון מבקש צעד הבא עם תאריך – מעבר שלב, תיעוד פעילות ופתיחה מחדש.
   "לא רלוונטי" מבקש סיבה מהרשימה; "הפוך ללקוח" יוצר לקוח עם כל הפרטים וההיסטוריה ופותח הזמנה ראשונה. */
import { useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import { CircleAlert, OctagonAlert, X } from 'lucide-react';
import {
  ACTIVITY_LABEL, STAGE_LABEL, OPEN_STAGES, addLeadActivity, convertLead, markLost, moveLead, reopenLead, updateLead,
  type Lead, type LeadActivity, type LeadActivityKind, type LeadStage, type NextStep,
} from '../../data/leads';
import { useCustomers } from '../../data/customers';
import { useLists } from '../../data/lists';
import { useStore } from '../../data/store';
import { Button } from '../../design/components';
import { useToast } from '../../design/Toast';
import { keepOpenOnToast } from '../../app/ErrorBoundary';
import { fmtPhone, toISODate } from '../../lib/format';
import { cleanPhone, phoneError } from '../../lib/names';
import { cleanTaxId, taxIdError } from '../../lib/taxid';
import '../orders/StatusDialogs.css';
import '../customers/CustomerForm.css';
import './Leads.css';

const CARD_RE = /\d{13,}/;
const plusDays = (n: number) => toISODate(new Date(Date.now() + n * 86400000));

export function Shell({ title, sub, children, onClose, wide }: { title: string; sub?: ReactNode; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <Dialog.Root open onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="cmd-overlay" />
        <Dialog.Content className={`udialog sdialog ${wide ? 'ldialog--wide' : ''}`} dir="rtl" aria-describedby={sub ? 'ldialog-sub' : undefined} onPointerDownOutside={keepOpenOnToast} onInteractOutside={keepOpenOnToast}
          onOpenAutoFocus={(e) => { e.preventDefault(); ((e.currentTarget as HTMLElement).querySelector('[data-autofocus], textarea, input, select') as HTMLElement | null)?.focus(); }}>
          <div className="sdialog__head">
            <Dialog.Title className="udialog__title">{title}</Dialog.Title>
            <Dialog.Close asChild><button className="icon-btn" aria-label="סגור"><X size={18} /></button></Dialog.Close>
          </div>
          {sub && <p id="ldialog-sub" className="sdialog__sub">{sub}</p>}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* צעד הבא: מה עושים ומתי. קיצורי תאריך – מחר, בעוד 3 ימים, בעוד שבוע */
export function StepFields({ step, onChange, err }: { step: NextStep; onChange: (s: NextStep) => void; err?: string }) {
  const quick: [string, number][] = [['מחר', 1], ['בעוד 3 ימים', 3], ['בעוד שבוע', 7]];
  return (
    <fieldset className="lstep">
      <legend className="field__label">צעד הבא <span className="req">חובה</span></legend>
      <input className="input" value={step.text} onChange={(e) => onChange({ ...step, text: e.target.value })} placeholder="למשל: לשלוח הצעת מחיר, להתקשר לסגור טעימה" aria-label="מה הצעד הבא" aria-invalid={!!err && !step.text.trim() || undefined} />
      <div className="lstep__when">
        <input className="input input--sm" type="date" value={step.due} min={toISODate(new Date())} onChange={(e) => onChange({ ...step, due: e.target.value })} aria-label="תאריך הצעד הבא" aria-invalid={!!err && !step.due || undefined} />
        {quick.map(([label, n]) => (
          <button type="button" key={n} className={`chip ${step.due === plusDays(n) ? 'is-on' : ''}`} aria-pressed={step.due === plusDays(n)} onClick={() => onChange({ ...step, due: plusDays(n) })}>{label}</button>
        ))}
      </div>
      {err && <span className="cform__err" role="alert">{err}</span>}
    </fieldset>
  );
}

export function stepError(s: NextStep) {
  if (!s.text.trim()) return 'חובה: מה הצעד הבא';
  if (CARD_RE.test(s.text)) return 'אסור לרשום כאן מספר כרטיס אשראי';
  if (!s.due) return 'חובה: מתי – בחר תאריך';
  return '';
}

/* ---------- מעבר שלב ---------- */
export function MoveDialog({ lead, to, onClose }: { lead: Lead; to: LeadStage; onClose: () => void }) {
  const toast = useToast();
  const [step, setStep] = useState<NextStep>(lead.nextStep ?? { text: '', due: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const e = stepError(step); if (e) return setErr(e);
    setBusy(true);
    try { await moveLead(lead, to, step); toast({ message: <>{lead.name} עבר ל"{STAGE_LABEL[to]}"</> }); onClose(); }
    catch { setErr('השמירה נכשלה – בדוק חיבור'); setBusy(false); }
  };
  return (
    <Shell title={`העברה ל"${STAGE_LABEL[to]}"`} sub={<>{lead.name} · {STAGE_LABEL[lead.stage]} ← {STAGE_LABEL[to]}. מה הצעד הבא?</>} onClose={onClose}>
      <form className="sdialog__form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <StepFields step={step} onChange={(s) => { setStep(s); setErr(''); }} err={err} />
        <div className="udialog__actions"><Button variant="primary" type="submit" loading={busy}>העבר</Button><Button variant="ghost" type="button" onClick={onClose}>ביטול</Button></div>
      </form>
    </Shell>
  );
}

/* ---------- שינוי הצעד הבא בלבד ---------- */
export function StepDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const toast = useToast();
  const [step, setStep] = useState<NextStep>(lead.nextStep ?? { text: '', due: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const e = stepError(step); if (e) return setErr(e);
    setBusy(true);
    try { await updateLead(lead, { nextStep: step }); toast({ message: 'הצעד הבא עודכן' }); onClose(); }
    catch { setErr('השמירה נכשלה – בדוק חיבור'); setBusy(false); }
  };
  return (
    <Shell title="צעד הבא" sub={lead.name} onClose={onClose}>
      <form className="sdialog__form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <StepFields step={step} onChange={(s) => { setStep(s); setErr(''); }} err={err} />
        <div className="udialog__actions"><Button variant="primary" type="submit" loading={busy}>שמור</Button><Button variant="ghost" type="button" onClick={onClose}>ביטול</Button></div>
      </form>
    </Shell>
  );
}

/* ---------- לא רלוונטי ---------- */
export function LostDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const toast = useToast();
  const { lists } = useLists();
  const reasons = (lists?.lostReasons ?? []).filter((r) => r.active);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!reason) return setErr('בחר סיבה');
    if (CARD_RE.test(note)) return setErr('אסור לרשום כאן מספר כרטיס אשראי');
    setBusy(true);
    try { await markLost(lead, reasons.find((r) => r.id === reason)?.label ?? reason, note); toast({ message: <>{lead.name} סומן "לא רלוונטי"</> }); onClose(); }
    catch { setErr('השמירה נכשלה – בדוק חיבור'); setBusy(false); }
  };
  return (
    <Shell title="לא רלוונטי" sub={<>{lead.name} ייצא מהלוח ויישאר בטבלה, עם כל ההיסטוריה. אפשר לפתוח אותו מחדש בהמשך.</>} onClose={onClose}>
      <form className="sdialog__form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <fieldset className="sdialog__reasons">
          <legend className="field__label">סיבה <span className="req">חובה</span></legend>
          <div className="sdialog__grid">
            {reasons.map((r) => (
              <label key={r.id} className={`sdialog__reason ${reason === r.id ? 'is-on' : ''}`}>
                <input type="radio" name="lost" checked={reason === r.id} onChange={() => { setReason(r.id); setErr(''); }} /> {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field"><span className="field__label">פירוט</span>
          <textarea className="input cform__ta" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="למשל: חוזה עם ספק אחר עד יוני – לחזור אליהם במאי" />
        </label>
        {err && <span className="cform__err" role="alert">{err}</span>}
        <div className="udialog__actions"><Button variant="primary" type="submit" loading={busy}>סמן לא רלוונטי</Button><Button variant="ghost" type="button" onClick={onClose}>ביטול</Button></div>
      </form>
    </Shell>
  );
}

/* ---------- פתיחה מחדש ---------- */
export function ReopenDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const toast = useToast();
  const [step, setStep] = useState<NextStep>({ text: '', due: plusDays(1) });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const e = stepError(step); if (e) return setErr(e);
    setBusy(true);
    try { await reopenLead(lead, step); toast({ message: <>{lead.name} חזר לעבודה – שלב "נוצר קשר"</> }); onClose(); }
    catch { setErr('השמירה נכשלה – בדוק חיבור'); setBusy(false); }
  };
  return (
    <Shell title="פתיחה מחדש" sub={<>{lead.name} יחזור ללוח בשלב "נוצר קשר".</>} onClose={onClose}>
      <form className="sdialog__form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <StepFields step={step} onChange={(s) => { setStep(s); setErr(''); }} err={err} />
        <div className="udialog__actions"><Button variant="primary" type="submit" loading={busy}>פתח מחדש</Button><Button variant="ghost" type="button" onClick={onClose}>ביטול</Button></div>
      </form>
    </Shell>
  );
}

/* ---------- תיעוד פעילות ---------- */
const KINDS: LeadActivityKind[] = ['call', 'whatsapp', 'email', 'meeting', 'sample', 'note'];
export function ActivityDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const toast = useToast();
  const [kind, setKind] = useState<LeadActivityKind>('call');
  const [text, setText] = useState('');
  const [asked, setAsked] = useState('');
  const [objections, setObjections] = useState('');
  const [outcome, setOutcome] = useState('');
  const [stage, setStage] = useState<LeadStage>(lead.stage);
  const [step, setStep] = useState<NextStep>({ text: '', due: '' });
  const [errs, setErrs] = useState<{ text?: string; step?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const e: typeof errs = {};
    if (!text.trim()) e.text = 'חובה: מה היה';
    if ([text, asked, objections, outcome].some((s) => CARD_RE.test(s))) e.text = 'אסור לרשום כאן מספר כרטיס אשראי';
    const se = stepError(step); if (se) e.step = se;
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await addLeadActivity(lead, { kind, text, asked, objections, outcome }, step, stage);
      toast({ message: <>{ACTIVITY_LABEL[kind]} נשמרה · הצעד הבא נכנס למשימות</> });
      onClose();
    } catch { setErrs({ form: 'השמירה נכשלה – בדוק חיבור' }); setBusy(false); }
  };
  return (
    <Shell title="תיעוד פעילות" sub={lead.name} onClose={onClose} wide>
      <form className="sdialog__form" onSubmit={(e) => { e.preventDefault(); save(); }} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } }}>
        <div className="seg lact__kinds" role="radiogroup" aria-label="סוג הפעולה">
          {KINDS.map((k) => <button type="button" key={k} role="radio" aria-checked={kind === k} className={kind === k ? 'is-on' : ''} onClick={() => setKind(k)}>{ACTIVITY_LABEL[k]}</button>)}
        </div>
        <label className="field"><span className="field__label">מה היה <span className="req">חובה</span></span>
          <textarea data-autofocus className="input cform__ta" rows={2} value={text} onChange={(e) => { setText(e.target.value); setErrs((x) => ({ ...x, text: '' })); }} placeholder="למשל: שיחה עם מנהלת המשרד, מזמינים ארוחת צהריים פעם בשבועיים" aria-invalid={!!errs.text || undefined} />
          {errs.text && <span className="cform__err" role="alert">{errs.text}</span>}
        </label>
        <div className="lact__grid">
          <label className="field"><span className="field__label">מה ביקשו</span><input className="input" value={asked} onChange={(e) => setAsked(e.target.value)} placeholder="כמות, תאריכים, כשרות" /></label>
          <label className="field"><span className="field__label">התנגדויות</span><input className="input" value={objections} onChange={(e) => setObjections(e.target.value)} placeholder="מחיר, ספק קיים" /></label>
          <label className="field"><span className="field__label">תוצאה</span><input className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="מחכים להצעה, קבענו טעימה" /></label>
          <label className="field"><span className="field__label">שלב</span>
            <select className="input" value={stage} onChange={(e) => setStage(e.target.value as LeadStage)}>
              {OPEN_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}{s === lead.stage ? ' (נוכחי)' : ''}</option>)}
            </select>
          </label>
        </div>
        <StepFields step={step} onChange={(s) => { setStep(s); setErrs((x) => ({ ...x, step: '' })); }} err={errs.step} />
        {errs.form && <p className="cform__formerr" role="alert"><OctagonAlert size={16} aria-hidden="true" /> {errs.form}</p>}
        <div className="udialog__actions"><Button variant="primary" type="submit" loading={busy} kbd="Ctrl+Enter">שמור</Button><Button variant="ghost" type="button" onClick={onClose}>ביטול</Button></div>
      </form>
    </Shell>
  );
}

/* ---------- הפיכה ללקוח ---------- */
export function ConvertDialog({ lead, activity, onClose }: { lead: Lead; activity: LeadActivity[]; onClose: () => void }) {
  const toast = useToast();
  const nav = useNavigate();
  const { openNewOrder } = useStore();
  const { items: customers } = useCustomers();
  const { lists } = useLists();
  const methods = (lists?.paymentMethods ?? []).filter((m) => m.active);
  const [name, setName] = useState(lead.name);
  const [type, setType] = useState<'regular' | 'occasional'>('regular');
  const [taxId, setTaxId] = useState(lead.taxId);
  const address = '';
  const [method, setMethod] = useState('account');
  const [accountPhone, setAccountPhone] = useState(() => fmtPhone(lead.contacts.find((c) => c.decider)?.phone ?? lead.contacts[0]?.phone ?? ''));
  const [order, setOrder] = useState(true);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const tax = cleanTaxId(taxId);
  const taxTwin = tax ? customers.find((c) => c.status !== 'merged' && c.taxId === tax) : undefined;

  const save = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'חובה: שם הלקוח';
    const te = taxIdError(taxId); if (te) e.taxId = te;
    if (taxTwin) e.taxId = `ח.פ הזה כבר שייך ללקוח "${taxTwin.name}"`;
    if (method === 'account') {
      if (!cleanPhone(accountPhone)) e.accountPhone = 'חובה ללקוח הקפה: טלפון ההקפה';
      else { const pe = phoneError(accountPhone); if (pe) e.accountPhone = pe; }
    }
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const id = await convertLead(lead, { name, type, taxId, paymentMethod: method, accountPhone, businessAddress: address }, activity);
      toast({ message: <>{name.trim()} הוא עכשיו לקוח – כל הפעילות עברה לתיק שלו</> });
      onClose();
      nav(`/customers/${id}`);
      if (order) setTimeout(() => openNewOrder({ mode: 'full', customerId: id }), 300);
    } catch { setErrs({ form: 'השמירה נכשלה. ייתכן שה-ח.פ כבר קיים אצל לקוח אחר, או שאין חיבור.' }); setBusy(false); }
  };
  const err = (k: string) => errs[k] ? <span className="cform__err" role="alert">{errs[k]}</span> : null;
  return (
    <Shell title="הפיכה ללקוח" sub={<>נוצר לקוח חדש עם אנשי הקשר ({lead.contacts.length}) וכל הפעילות ({activity.length}). הליד נשאר מקושר אליו.</>} onClose={onClose} wide>
      <form className="sdialog__form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="lact__grid">
          <label className="field"><span className="field__label">שם הלקוח <span className="req">חובה</span></span><input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errs.name || undefined} />{err('name')}</label>
          <div className="field"><span className="field__label">סוג לקוח</span>
            <div className="seg" role="radiogroup" aria-label="סוג לקוח">
              {(['regular', 'occasional'] as const).map((t) => <button type="button" key={t} role="radio" aria-checked={type === t} className={type === t ? 'is-on' : ''} onClick={() => setType(t)}>{t === 'regular' ? 'קבוע' : 'מזדמן'}</button>)}
            </div>
          </div>
          <label className="field"><span className="field__label">ח.פ / ע.מ</span><input className="input input--ltr" inputMode="numeric" value={taxId} onChange={(e) => setTaxId(e.target.value)} aria-invalid={!!errs.taxId || undefined} />{err('taxId')}</label>
          <div className="field"><span className="field__label">אמצעי תשלום</span>
            <div className="seg" role="radiogroup" aria-label="אמצעי תשלום">
              {methods.map((m) => <button type="button" key={m.id} role="radio" aria-checked={method === m.id} className={method === m.id ? 'is-on' : ''} onClick={() => setMethod(m.id)}>{m.label}</button>)}
            </div>
          </div>
          {method === 'account' && <label className="field"><span className="field__label">טלפון הקפה <span className="req">חובה</span></span><input className="input input--ltr" inputMode="tel" value={accountPhone} onChange={(e) => setAccountPhone(e.target.value)} placeholder="05X-XXXXXXX" aria-invalid={!!errs.accountPhone || undefined} />{err('accountPhone')}</label>}
        </div>
        <label className="check-inline"><input type="checkbox" checked={order} onChange={(e) => setOrder(e.target.checked)} /> לפתוח מיד את ההזמנה הראשונה</label>
        {taxTwin && <p className="sdialog__warn"><CircleAlert size={16} aria-hidden="true" /> <span>ייתכן שהליד כבר לקוח: <button type="button" className="link" onClick={() => { onClose(); nav(`/customers/${taxTwin.id}`); }}>פתח את {taxTwin.name}</button></span></p>}
        {errs.form && <p className="cform__formerr" role="alert"><OctagonAlert size={16} aria-hidden="true" /> {errs.form}</p>}
        <div className="udialog__actions"><Button variant="primary" type="submit" loading={busy}>צור לקוח</Button><Button variant="ghost" type="button" onClick={onClose}>ביטול</Button></div>
      </form>
    </Shell>
  );
}
