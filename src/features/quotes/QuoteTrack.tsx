/* מעקב אחרי הצעה שנשמרה: סטטוס, מטפל, פעולות טיפול ויומן (מי ומתי).
   כל לחיצה נרשמת ביומן לבד. שיחה / אין מענה / נשלחה שוב מעבירות ל"בטיפול", ואפשר לקבוע איתן מתי לחזור –
   התאריך הופך למשימה במסך היום. "אשר והפוך להזמנה" גלוי תמיד (חוץ מנדחתה / הוזמנה), בכותרת ההצעה ובשורה ברשימה. */
import { useState } from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import {
  BellRing, CalendarClock, Check, ClipboardList, MessageSquarePlus, MoreHorizontal, Phone, PhoneOff, RotateCcw, Send, UserRound, Users, X,
} from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { useAuth } from '../../auth/AuthContext';
import {
  QUOTE_STATUS_LABEL, QuoteOrderedError, REJECT_REASONS, WAITING, addQuoteNote, callDue, canConvert, dayMonth, isExpired, quoteAction, setQuoteHandler, setQuoteStatus, staleHours,
  useQuoteNotes, type Quote, type QuoteActionKind, type QuoteNoteKind, type QuoteStatus,
} from '../../data/quotes';
import { useStaff } from '../../data/staff';
import { useStore } from '../../data/store';
import { Button } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, toISODate } from '../../lib/format';
import { CARD_RE } from '../../lib/names';
import { Shell } from '../leads/LeadDialogs';

/* ההצעה הפכה להזמנה בינתיים (נציג אחר / לשונית אחרת) – אומרים את זה, ולא "בדקו חיבור" */
const failText = (x: unknown) => (x instanceof QuoteOrderedError ? `ההצעה כבר הפכה להזמנה${x.orderId ? ` ${x.orderId}` : ''}` : 'העדכון נכשל – בדקו חיבור');

export const ago = (h: number) => (h < 1 ? 'פחות משעה' : h < 24 ? `${h} שעות` : h < 48 ? 'יום' : `${Math.floor(h / 24)} ימים`);
const when = (s?: number) => {
  if (!s) return '';
  const d = new Date(s * 1000);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
/* בעוד n ימים, בלי שבת */
const daysAhead = (now: Date, n: number) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + n, 12);
  if (d.getDay() === 6) d.setDate(d.getDate() + 1);
  return toISODate(d);
};

/* פתיחת הזמנה חדשה מההצעה. prepare – בעורך: שמירת שינויים שלא נשמרו לפני ההעתקה (מחזיר null אם השמירה נכשלה) */
export function ConvertButton({ q, size = 'md', quiet, prepare }: { q: Quote; size?: 'sm' | 'md'; quiet?: boolean; prepare?: () => Promise<Quote | null> }) {
  const { openNewOrder } = useStore();
  const [busy, setBusy] = useState(false);
  if (!canConvert(q)) return null;
  const go = async () => {
    if (!prepare) return openNewOrder({ fromQuote: q });
    setBusy(true);
    const ready = await prepare();
    setBusy(false);
    if (ready) openNewOrder({ fromQuote: ready });
  };
  return (
    <Button size={size} variant={quiet ? 'secondary' : 'primary'} icon={<ClipboardList size={16} />} loading={busy} onClick={go}>
      {q.status === 'approved' ? 'הפוך להזמנה' : 'אשר והפוך להזמנה'}
    </Button>
  );
}

/* הפעולה הבאה בשורה ברשימת ההצעות */
export function QuoteActions({ q }: { q: Quote }) {
  const toast = useToast();
  const panel = usePanel();
  const go = async (s: QuoteStatus, msg: string) => {
    try { await setQuoteStatus(q, s); toast({ message: msg }); } catch (x) { toast({ tone: 'error', message: failText(x) }); }
  };
  return (
    <span className="qact">
      {q.status === 'draft' && <Button size="sm" icon={<Send size={16} />} onClick={() => go('sent', `הצעה ${q.id} סומנה כנשלחה`)}>סמן שנשלחה</Button>}
      {(WAITING.includes(q.status) || q.status === 'approved') && <ConvertButton q={q} size="sm" quiet={q.status !== 'approved'} />}
      {q.status === 'rejected' && <Button size="sm" icon={<RotateCcw size={16} />} onClick={() => go('handling', `הצעה ${q.id} חזרה לטיפול`)}>החזר לטיפול</Button>}
      {q.status === 'ordered' && q.orderId && <Button size="sm" icon={<ClipboardList size={16} />} onClick={(e) => panel.open(q.orderId!, e.currentTarget)}>הזמנה <Ltr>{q.orderId}</Ltr></Button>}
    </span>
  );
}

const LOG_ICON: Partial<Record<QuoteNoteKind, React.ReactNode>> = {
  call: <Phone size={14} />, noanswer: <PhoneOff size={14} />, resent: <Send size={14} />, callback: <CalendarClock size={14} />, handler: <UserRound size={14} />,
};

export function QuoteTrack({ q }: { q: Quote }) {
  const toast = useToast();
  const panel = usePanel();
  const { profile } = useAuth();
  const { now, thresholds, openNewOrder } = useStore();
  const notes = useQuoteNotes(q.id);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState<QuoteActionKind | 'reject' | 'transfer' | null>(null);
  const today = toISODate(now);
  const stale = staleHours(q, now);
  const late = stale !== null && stale >= thresholds.quoteFollowupHours && !(q.callAt && q.callAt >= today);
  const expired = isExpired(q, today);
  const waiting = WAITING.includes(q.status);
  const due = callDue(q, today);
  const status = async (s: QuoteStatus, msg: string) => {
    try {
      await setQuoteStatus(q, s);
      toast({ message: msg, ...(s === 'approved' ? { action: { label: 'הפוך להזמנה', run: () => openNewOrder({ fromQuote: { ...q, status: 'approved' } }) } } : {}) });
    } catch (x) { toast({ tone: 'error', message: failText(x) }); }
  };
  const take = async () => {
    if (!profile) return;
    try { await setQuoteHandler(q, { uid: profile.uid, name: profile.name }); toast({ message: `הצעה ${q.id} עברה לטיפולך` }); }
    catch (x) { toast({ tone: 'error', message: failText(x) }); }
  };
  const add = async () => {
    if (!text.trim()) return setErr('כתבו הערה');
    if (CARD_RE.test(text)) return setErr('אסור לרשום מספר כרטיס אשראי');
    setBusy(true);
    try { await addQuoteNote(q, text); setText(''); toast({ message: 'ההערה נוספה' }); } catch { setErr('השמירה נכשלה – בדקו חיבור'); }
    setBusy(false);
  };
  const mine = !!profile && q.handlerUid === profile.uid;

  return (
    <section className={`card qtrack ${late ? 'is-late' : ''}`} aria-labelledby="qtrack-h">
      <div className="qtrack__head">
        <h2 id="qtrack-h" className="qe-sec__title">מעקב</h2>
        <span className={`qstat qstat--${expired ? 'expired' : q.status}`}>{expired ? 'פג תוקף' : QUOTE_STATUS_LABEL[q.status]}</span>
        {!!q.noAnswerCount && waiting && <span className="qtag"><PhoneOff size={12} aria-hidden="true" /> אין מענה ×<Ltr>{q.noAnswerCount}</Ltr></span>}
        {q.callAt && waiting && <span className={`qtag ${due ? 'qtag--due' : ''}`}><CalendarClock size={12} aria-hidden="true" /> {q.callAt === today ? 'לחזור היום' : <>לחזור ב-<Ltr>{dayMonth(q.callAt)}</Ltr></>}</span>}
        {q.status === 'rejected' && q.rejectReason && <span className="muted">סיבה: {q.rejectReason}</span>}
        {late && <span className="qtrack__late" role="status"><BellRing size={14} aria-hidden="true" /> אין עדכון כבר {ago(stale!)} – כדאי לחזור ללקוח</span>}
      </div>

      <div className="qtrack__owner">
        <span>מטפל: <b>{q.handler || '—'}</b></span>
        {!mine && <Button size="sm" variant="ghost" icon={<UserRound size={16} />} onClick={take}>משוך לטיפולך</Button>}
        <Button size="sm" variant="ghost" icon={<Users size={16} />} onClick={() => setDlg('transfer')}>העבר לטיפול…</Button>
      </div>

      <div className="qtrack__acts" role="group" aria-label="פעולות טיפול">
        {q.status === 'draft' && <Button size="sm" icon={<Send size={16} />} onClick={() => status('sent', `הצעה ${q.id} סומנה כנשלחה`)}>סמן שנשלחה</Button>}
        {waiting && (
          <>
            <Button size="sm" icon={<PhoneOff size={16} />} onClick={() => setDlg('noanswer')}>אין מענה</Button>
            <Button size="sm" icon={<Phone size={16} />} onClick={() => setDlg('call')}>דיברתי – ממתין</Button>
            <Button size="sm" icon={<Send size={16} />} onClick={() => setDlg('resent')}>נשלחה שוב</Button>
            <Button size="sm" icon={<CalendarClock size={16} />} onClick={() => setDlg('callback')}>לחזור בתאריך…</Button>
            <Dropdown.Root dir="rtl">
              <Dropdown.Trigger asChild><button className="icon-btn" aria-label="עוד פעולות להצעה"><MoreHorizontal size={18} /></button></Dropdown.Trigger>
              <Dropdown.Portal>
                <Dropdown.Content className="menu" align="end" sideOffset={4}>
                  <Dropdown.Item className="menu__item" onSelect={() => status('approved', `הצעה ${q.id}: הלקוח אישר`)}><Check size={16} aria-hidden="true" /> סמן שהלקוח אישר</Dropdown.Item>
                  <Dropdown.Item className="menu__item" onSelect={() => setDlg('reject')}><X size={16} aria-hidden="true" /> נדחתה</Dropdown.Item>
                </Dropdown.Content>
              </Dropdown.Portal>
            </Dropdown.Root>
          </>
        )}
        {q.status === 'approved' && <Button size="sm" variant="ghost" icon={<RotateCcw size={16} />} onClick={() => status('handling', `הצעה ${q.id} חזרה לטיפול`)}>בטל אישור</Button>}
        {q.status === 'rejected' && <Button size="sm" icon={<RotateCcw size={16} />} onClick={() => status('handling', `הצעה ${q.id} חזרה לטיפול`)}>החזר לטיפול</Button>}
        {q.status === 'ordered' && q.orderId && <Button size="sm" icon={<ClipboardList size={16} />} onClick={(e) => panel.open(q.orderId!, e.currentTarget)}>הזמנה <Ltr>{q.orderId}</Ltr></Button>}
      </div>

      <div className="qtrack__add">
        <textarea className="input" rows={1} value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} placeholder="הערת מעקב" aria-label="הערת מעקב"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); add(); } }} />
        <Button icon={<MessageSquarePlus size={16} />} loading={busy} onClick={add}>הוסף הערה</Button>
      </div>
      {err && <p className="cform__err" role="alert">{err}</p>}
      {notes.length > 0 && (
        <ol className="qtrack__log">
          {notes.map((n) => (
            <li key={n.id} className={`${n.kind === 'note' ? '' : 'is-status'} qtrack__k-${n.kind}`}>
              <span className="qtrack__when"><Ltr>{when(n.at?.seconds)}</Ltr> · {n.byName}</span>
              <span className="qtrack__text">{LOG_ICON[n.kind] && <span className="qtrack__ic" aria-hidden="true">{LOG_ICON[n.kind]}</span>}{n.text}</span>
            </li>
          ))}
        </ol>
      )}
      {dlg === 'reject' && <RejectDialog q={q} onClose={() => setDlg(null)} />}
      {dlg === 'transfer' && <TransferDialog q={q} onClose={() => setDlg(null)} />}
      {dlg && dlg !== 'reject' && dlg !== 'transfer' && <ActionDialog q={q} kind={dlg} onClose={() => setDlg(null)} />}
    </section>
  );
}

/* פעולת טיפול: הערה (לא חובה) ומתי לחזור. "אין מענה" מציע מחר כברירת מחדל */
const ACTION_COPY: Record<QuoteActionKind, { title: string; submit: string; note: string }> = {
  noanswer: { title: 'התקשרתי – אין מענה', submit: 'שמור', note: 'למשל: השארתי הודעה' },
  call: { title: 'דיברתי – ממתין להחלטה', submit: 'שמור', note: 'מה נאמר בשיחה' },
  resent: { title: 'ההצעה נשלחה שוב', submit: 'שמור', note: 'למשל: נשלחה למייל אחר' },
  callback: { title: 'מתי לחזור ללקוח?', submit: 'קבע', note: 'למשל: לשאול על הכמויות' },
};
function ActionDialog({ q, kind, onClose }: { q: Quote; kind: QuoteActionKind; onClose: () => void }) {
  const toast = useToast();
  const { now } = useStore();
  const presets: [string, string][] = [['מחר', daysAhead(now, 1)], ['בעוד יומיים', daysAhead(now, 2)], ['בעוד שבוע', daysAhead(now, 7)]];
  // תאריך חזרה שכבר נקבע ועוד לא עבר – נשאר מסומן, כדי שפעולה חדשה לא תמחק אותו בטעות
  const kept = q.callAt && q.callAt >= toISODate(now) ? q.callAt : '';
  const [callAt, setCallAt] = useState(kept || (kind === 'noanswer' || kind === 'callback' ? presets[0][1] : ''));
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const today = toISODate(now);
  const copy = ACTION_COPY[kind];
  const go = async () => {
    if (kind === 'callback' && !callAt) return setErr('בחרו תאריך');
    if (callAt && callAt < today) return setErr('התאריך כבר עבר');
    if (CARD_RE.test(note)) return setErr('אסור לרשום מספר כרטיס אשראי');
    setBusy(true);
    try {
      await quoteAction(q, kind, note, callAt);
      toast({ message: <>נרשם בהצעה <Ltr>{q.id}</Ltr>{callAt && <> · לחזור ב-<Ltr>{dayMonth(callAt)}</Ltr></>}</> });
      onClose();
    } catch (x) { setErr(failText(x)); setBusy(false); }
  };
  return (
    <Shell title={copy.title} sub={<>הצעה <Ltr>{q.id}</Ltr>{q.customer.name && <> · {q.customer.name}</>}</>} onClose={onClose}>
      <form className="sdialog__form" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <div className="field">
          <span className="field__label" id="qcb-l">לחזור ללקוח {kind !== 'callback' && <span className="muted">(לא חובה)</span>}</span>
          <div className="chips" role="radiogroup" aria-labelledby="qcb-l">
            {kind !== 'callback' && <button type="button" role="radio" aria-checked={!callAt} className={`chip ${!callAt ? 'is-on' : ''}`} onClick={() => { setCallAt(''); setErr(''); }}>בלי</button>}
            {presets.map(([l, v]) => <button type="button" role="radio" key={l} aria-checked={callAt === v} className={`chip ${callAt === v ? 'is-on' : ''}`} onClick={() => { setCallAt(v); setErr(''); }}>{l}</button>)}
          </div>
          <input type="date" className="input input--sm qcb-date" min={today} value={callAt} aria-label="או תאריך אחר" onChange={(e) => { setCallAt(e.target.value); setErr(''); }} />
          {callAt && <span className="field__hint">תופיע משימה במסך היום ב-<Ltr>{dayMonth(callAt)}</Ltr></span>}
        </div>
        <label className="field"><span className="field__label">הערה <span className="muted">(לא חובה)</span></span>
          <input className="input" value={note} maxLength={300} onChange={(e) => { setNote(e.target.value); setErr(''); }} placeholder={copy.note} data-autofocus />
        </label>
        {err && <span className="cform__err" role="alert">{err}</span>}
        <div className="udialog__actions"><Button variant="primary" type="submit" loading={busy}>{copy.submit}</Button><Button variant="ghost" type="button" onClick={onClose}>ביטול</Button></div>
      </form>
    </Shell>
  );
}

function TransferDialog({ q, onClose }: { q: Quote; onClose: () => void }) {
  const toast = useToast();
  const staff = useStaff().filter((s) => s.uid !== q.handlerUid);
  const [uid, setUid] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    const to = staff.find((s) => s.uid === uid);
    if (!to) return setErr('בחרו נציג');
    setBusy(true);
    try { await setQuoteHandler(q, to); toast({ message: <>הצעה <Ltr>{q.id}</Ltr> הועברה לטיפול {to.name}</> }); onClose(); }
    catch { setErr('השמירה נכשלה – בדקו חיבור'); setBusy(false); }
  };
  return (
    <Shell title="העבר לטיפול" sub={<>הצעה <Ltr>{q.id}</Ltr> · עכשיו אצל {q.handler || '—'}</>} onClose={onClose}>
      <form className="sdialog__form" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <label className="field"><span className="field__label">לנציג</span>
          <select className="input" value={uid} onChange={(e) => { setUid(e.target.value); setErr(''); }} data-autofocus>
            <option value="">בחרו…</option>
            {staff.map((s) => <option key={s.uid} value={s.uid}>{s.name}</option>)}
          </select>
        </label>
        {err && <span className="cform__err" role="alert">{err}</span>}
        <div className="udialog__actions"><Button variant="primary" type="submit" loading={busy}>העבר</Button><Button variant="ghost" type="button" onClick={onClose}>ביטול</Button></div>
      </form>
    </Shell>
  );
}

/* נדחתה: סיבה בלחיצה (לניתוח בהמשך למה מפסידים הצעות) והערה לא חובה */
function RejectDialog({ q, onClose }: { q: Quote; onClose: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!reason) return setErr('בחרו סיבה');
    if (reason === 'אחר' && !note.trim()) return setErr('כתבו מה הסיבה');
    if (CARD_RE.test(note)) return setErr('אסור לרשום מספר כרטיס אשראי');
    setBusy(true);
    try { await setQuoteStatus(q, 'rejected', note, { rejectReason: reason }); toast({ message: `הצעה ${q.id} סומנה כנדחתה` }); onClose(); }
    catch { setErr('השמירה נכשלה – בדקו חיבור'); setBusy(false); }
  };
  return (
    <Shell title={`הצעה ${q.id} נדחתה`} sub="הסיבה נשמרת ביומן המעקב, כדי לדעת בהמשך למה מפסידים הצעות." onClose={onClose}>
      <form className="sdialog__form" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <div className="chips" role="radiogroup" aria-label="סיבת הדחייה">
          {REJECT_REASONS.map((r) => <button type="button" role="radio" key={r} aria-checked={reason === r} className={`chip ${reason === r ? 'is-on' : ''}`} onClick={() => { setReason(r); setErr(''); }}>{r}</button>)}
        </div>
        <label className="field"><span className="field__label">הערה {reason === 'אחר' ? <span className="req">חובה</span> : <span className="muted">(לא חובה)</span>}</span>
          <input className="input" value={note} onChange={(e) => { setNote(e.target.value); setErr(''); }} placeholder="למשל: קיבלו הצעה זולה יותר" />
        </label>
        {err && <span className="cform__err" role="alert">{err}</span>}
        <div className="udialog__actions"><Button variant="danger" type="submit" loading={busy}>סמן שנדחתה</Button><Button variant="ghost" type="button" onClick={onClose}>ביטול</Button></div>
      </form>
    </Shell>
  );
}
