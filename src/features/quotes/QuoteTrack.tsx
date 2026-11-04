/* מעקב אחרי הצעה שנשמרה: סטטוס, הפעולה הבאה, ויומן הערות (מי ומתי). כל שינוי סטטוס נרשם ביומן לבד,
   וכל עדכון – סטטוס או הערה – מאפס את התזכורת "אין עדכון". הצעה שאושרה – "הפוך להזמנה" בלחיצה. */
import { useState } from 'react';
import { BellRing, Check, ClipboardList, MessageSquarePlus, PhoneOff, RotateCcw, Send, X } from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { addQuoteNote, QUOTE_STATUS_LABEL, REJECT_REASONS, isExpired, setQuoteStatus, staleHours, useQuoteNotes, type Quote, type QuoteStatus } from '../../data/quotes';
import { useStore } from '../../data/store';
import { Button } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, toISODate } from '../../lib/format';
import { Shell } from '../leads/LeadDialogs';

const CARD_RE = /\d{13,}/;
export const ago = (h: number) => (h < 1 ? 'פחות משעה' : h < 24 ? `${h} שעות` : h < 48 ? 'יום' : `${Math.floor(h / 24)} ימים`);
const when = (s?: number) => {
  if (!s) return '';
  const d = new Date(s * 1000);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/* כפתורי הסטטוס לפי המצב הנוכחי – גם בתוך ההצעה וגם ברשימה */
export function QuoteActions({ q, compact }: { q: Quote; compact?: boolean }) {
  const toast = useToast();
  const panel = usePanel();
  const { openNewOrder } = useStore();
  const [reject, setReject] = useState(false);
  const go = async (s: QuoteStatus, msg: string) => {
    try {
      await setQuoteStatus(q, s);
      toast({ message: msg, ...(s === 'approved' ? { action: { label: 'הפוך להזמנה', run: () => openNewOrder({ fromQuote: { ...q, status: 'approved' } }) } } : {}) });
    } catch { toast({ message: 'העדכון נכשל – בדקו חיבור' }); }
  };
  const size = compact ? 'sm' : 'md';
  return (
    <span className="qact">
      {q.status === 'draft' && <Button size={size} icon={<Send size={15} />} onClick={() => go('sent', `הצעה ${q.id} סומנה כנשלחה`)}>סמן שנשלחה</Button>}
      {(q.status === 'sent' || q.status === 'noanswer') && (
        <>
          <Button size={size} variant="primary" icon={<Check size={15} />} onClick={() => go('approved', `הצעה ${q.id}: הלקוח אישר`)}>הלקוח אישר</Button>
          {q.status === 'sent' && <Button size={size} icon={<PhoneOff size={15} />} onClick={() => go('noanswer', `הצעה ${q.id}: אין מענה`)}>אין מענה</Button>}
          <Button size={size} variant="ghost" icon={<X size={15} />} onClick={() => setReject(true)}>נדחתה</Button>
        </>
      )}
      {q.status === 'approved' && (
        <>
          <Button size={size} variant="primary" icon={<ClipboardList size={15} />} onClick={() => openNewOrder({ fromQuote: q })}>הפוך להזמנה</Button>
          {!compact && <Button size={size} variant="ghost" icon={<RotateCcw size={15} />} onClick={() => go('sent', `הצעה ${q.id} חזרה לממתינה לתשובה`)}>בטל אישור</Button>}
        </>
      )}
      {q.status === 'rejected' && <Button size={size} icon={<RotateCcw size={15} />} onClick={() => go('sent', `הצעה ${q.id} חזרה לטיפול`)}>החזר לטיפול</Button>}
      {q.status === 'ordered' && q.orderId && <Button size={size} icon={<ClipboardList size={15} />} onClick={(e) => panel.open(q.orderId!, e.currentTarget)}>הזמנה <Ltr>{q.orderId}</Ltr></Button>}
      {reject && <RejectDialog q={q} onClose={() => setReject(false)} />}
    </span>
  );
}

export function QuoteTrack({ q }: { q: Quote }) {
  const toast = useToast();
  const { now, thresholds } = useStore();
  const notes = useQuoteNotes(q.id);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const stale = staleHours(q, now);
  const late = stale !== null && stale >= thresholds.quoteFollowupHours;
  const expired = isExpired(q, toISODate(now));
  const add = async () => {
    if (!text.trim()) return setErr('כתבו הערה');
    if (CARD_RE.test(text)) return setErr('אסור לרשום מספר כרטיס אשראי');
    setBusy(true);
    try { await addQuoteNote(q, text); setText(''); toast({ message: 'ההערה נוספה' }); } catch { setErr('השמירה נכשלה – בדקו חיבור'); }
    setBusy(false);
  };
  return (
    <section className={`card qtrack ${late ? 'is-late' : ''}`} aria-labelledby="qtrack-h">
      <div className="qtrack__head">
        <h2 id="qtrack-h" className="qe-sec__title">מעקב</h2>
        <span className={`qstat qstat--${expired ? 'expired' : q.status}`}>{expired ? 'פג תוקף' : QUOTE_STATUS_LABEL[q.status]}</span>
        {q.status === 'rejected' && q.rejectReason && <span className="muted">סיבה: {q.rejectReason}</span>}
        {late && <span className="qtrack__late" role="status"><BellRing size={14} aria-hidden="true" /> אין עדכון כבר {ago(stale!)} – כדאי לחזור ללקוח</span>}
        <span className="qtrack__acts"><QuoteActions q={q} /></span>
      </div>
      <div className="qtrack__add">
        <textarea className="input" rows={1} value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} placeholder="הערת מעקב: למשל &quot;דיברתי עם מיכל, תחזור מחר עם תשובה&quot;" aria-label="הערת מעקב"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); add(); } }} />
        <Button icon={<MessageSquarePlus size={15} />} loading={busy} onClick={add}>הוסף הערה</Button>
      </div>
      {err && <p className="cform__err" role="alert">{err}</p>}
      {notes.length > 0 && (
        <ol className="qtrack__log">
          {notes.map((n) => (
            <li key={n.id} className={n.kind === 'status' ? 'is-status' : ''}>
              <span className="qtrack__when"><Ltr>{when(n.at?.seconds)}</Ltr> · {n.byName}</span>
              <span>{n.text}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
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
