/* פעולות של מנהל מערכת בלבד בתיק הזמנה: שינוי העובד המטפל, ומחיקת הזמנה לגמרי (לא בחודש נעול). */
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import type { UserDoc } from '../../auth/types';
import { usePanel } from '../../app/PanelContext';
import { deleteOrder } from '../../data/orders';
import { monthOf } from '../../data/months';
import { useStore, type OrderView } from '../../data/store';
import { Button } from '../../design/components';
import { useToast } from '../../design/Toast';
import { db } from '../../lib/firebase';
import { Ltr } from '../../lib/format';
import { Shell } from '../leads/LeadDialogs';

/* העובד המטפל: לכולם – טקסט; למנהל – בחירה מרשימת המשתמשים הפעילים */
export function HandlerEdit({ o }: { o: OrderView }) {
  const { isAdmin } = useAuth();
  const { update } = useStore();
  const [editing, setEditing] = useState(false);
  const [users, setUsers] = useState<UserDoc[]>([]);
  // רשימת המשתמשים נטענת רק כשפותחים את הבחירה – ורק מנהל רשאי לקרוא אותה
  useEffect(() => {
    if (!editing) return;
    return onSnapshot(collection(db, 'users'), (s) => setUsers(s.docs.map((d) => d.data() as UserDoc).filter((u) => u.status === 'active').sort((a, b) => a.name.localeCompare(b.name, 'he'))), () => setUsers([]));
  }, [editing]);
  if (!isAdmin) return <>{o.handler}</>;
  if (!editing) return <span className="kv__edit">{o.handler || '—'} <button className="link" onClick={() => setEditing(true)}>שנה מטפל</button></span>;
  return (
    <select className="input input--sm" autoFocus value={o.handlerUid ?? ''} aria-label="עובד מטפל"
      onChange={(e) => {
        const u = users.find((x) => x.uid === e.target.value);
        if (u && u.uid !== o.handlerUid) update(o.id, { handler: u.name, handlerUid: u.uid }, <>המטפל בהזמנה <Ltr>{o.id}</Ltr> הוא עכשיו {u.name}</>);
        setEditing(false);
      }}
      onBlur={() => setEditing(false)}>
      {!users.some((u) => u.uid === o.handlerUid) && <option value={o.handlerUid ?? ''}>{o.handler}</option>}
      {users.map((u) => <option key={u.uid} value={u.uid}>{u.name}</option>)}
    </select>
  );
}

/* מחיקה לגמרי – עם סיבה (נשמרת ביומן) */
export function DeleteOrder({ o }: { o: OrderView }) {
  const { isAdmin } = useAuth();
  const { lockedMonths } = useStore();
  const panel = usePanel();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!isAdmin) return null;
  const locked = lockedMonths.includes(monthOf(o.date));
  const go = async () => {
    if (reason.trim().length < 3) return setErr('חובה: סיבת המחיקה');
    if (/\d{13,}/.test(reason)) return setErr('אסור לרשום כאן מספר כרטיס אשראי');
    setBusy(true);
    try {
      await deleteOrder(o, reason);
      setOpen(false);
      panel.close();
      toast({ message: <>הזמנה <Ltr>{o.id}</Ltr> נמחקה מהמערכת · נשמרה ביומן עם הסיבה</> });
    } catch { setErr('המחיקה נכשלה – אין הרשאה או אין חיבור'); setBusy(false); }
  };
  return (
    <>
      <button className="link del-order" onClick={() => setOpen(true)}><Trash2 size={14} aria-hidden="true" /> מחק הזמנה</button>
      {open && (
        <Shell title={`מחיקת הזמנה ${o.id}`} sub={locked ? undefined : <>{o.customerName} · ההזמנה, ההערות והמסמכים שלה יימחקו לגמרי. ביומן תישאר רשומה עם הסיבה.</>} onClose={() => setOpen(false)}>
          {locked ? (
            <>
              <p className="udialog__danger"><span>החודש של ההזמנה נעול – אי אפשר למחוק ממנו. מנהל צריך לפתוח את החודש קודם (דוחות ← סגירת חודש).</span></p>
              <div className="udialog__actions"><Button variant="ghost" onClick={() => setOpen(false)}>סגור</Button></div>
            </>
          ) : (
            <form className="sdialog__form" onSubmit={(e) => { e.preventDefault(); go(); }}>
              <label className="field"><span className="field__label">סיבת המחיקה <span className="req">חובה</span></span>
                <input className="input" autoFocus value={reason} onChange={(e) => { setReason(e.target.value); setErr(''); }} placeholder="למשל: הוזנה בטעות פעמיים" />
              </label>
              {err && <span className="cform__err" role="alert">{err}</span>}
              <div className="udialog__actions"><Button variant="danger" type="submit" loading={busy}>מחק לצמיתות</Button><Button variant="ghost" type="button" onClick={() => setOpen(false)}>ביטול</Button></div>
            </form>
          )}
        </Shell>
      )}
    </>
  );
}
