/* "להעברה לקופה": הבלוק הראשון בתיק ההזמנה – כל מה שהאחמ"ש צריך כדי להקליד את ההזמנה ל-Q ביום ההזמנה,
   ובתחתיתו השורה שבה רושמים שהועברה ל-Q (מספר, סכום, נשלח בקבוצת תפעול). כל ערך נערך בלחיצה, כמו בשאר התיק. */
import { useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, TriangleAlert } from 'lucide-react';
import { useStore, type OrderView } from '../../data/store';
import { METHOD_LABEL, groupItems, itemsText, typeText, OTHER, categoryOf } from '../../data/types';
import { Button, Missing } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, Money, fmtDate, fmtMoney, fmtPhone, weekday } from '../../lib/format';
import { phoneError } from '../../lib/names';
import { PriceRows } from './ItemsBuilder';
import { BranchEdit, DeliveryTypeEdit, EditKv, ItemsEditor, MethodEdit, showDate, showPhone, useOrderSave, validDate, validPhone, validTime } from './OrderEdit';

/* טקסט מסודר להעתקה (להקלדה בקופה או לשליחה לסניף) */
export function registerText(o: OrderView) {
  const items = !o.items.length ? o.contents ?? ''
    : !o.items.some((i) => categoryOf(i) !== OTHER) ? itemsText(o.items)
      : groupItems(o.items).map((c) => `${c.category} ${c.qty}: ${c.types.map(typeText).join(' ; ')}`).join('\n');
  const method = o.methodLabel ?? METHOD_LABEL[o.method] ?? o.method;
  return [
    `הזמנה ${o.id} · ${o.customerName}`,
    `${weekday(o.date)} ${fmtDate(o.date)} · ${o.time} · ${o.branchName}`,
    `תשלום: ${method}${o.method === 'account' && o.accountPhone ? ` · טלפון הקפה ${fmtPhone(o.accountPhone)}` : ''}`,
    (o.contactName || o.contactPhone) && `איש קשר: ${[o.contactName, o.contactPhone && fmtPhone(o.contactPhone)].filter(Boolean).join(' · ')}`,
    o.delivery === 'pickup' ? 'איסוף עצמי' : `משלוח: ${o.address ?? ''}`,
    items,
    o.instructions && `הערות לסניף: ${o.instructions}`,
    `סכום: ${fmtMoney(o.amount)}`,
  ].filter(Boolean).join('\n');
}

export function RegisterBlock({ o }: { o: OrderView }) {
  const save = useOrderSave(o);
  const toast = useToast();
  const [editItems, setEditItems] = useState(false);
  useEffect(() => setEditItems(false), [o.id]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(registerText(o)); toast({ message: 'פרטי ההזמנה הועתקו' }); }
    catch { toast({ tone: 'error', message: 'ההעתקה לא הצליחה – אפשר לסמן ולהעתיק ידנית' }); }
  };
  return (
    <section className="reg" aria-labelledby="h-reg">
      <div className="reg__head">
        <h3 id="h-reg" className="reg__title">להעברה לקופה</h3>
        <button type="button" className="link reg__copy" onClick={copy}><Copy size={14} aria-hidden="true" /> העתק הכל</button>
      </div>
      <div className="reg__grid">
        <EditKv k="תאריך" kind="date" value={o.date} display={<>{weekday(o.date)} {showDate(o.date)}</>} validate={validDate} onSave={(v) => save({ date: v }, 'תאריך האספקה')} />
        <EditKv k="שעה" kind="time" value={o.time} display={o.time ? <Ltr>{o.time}</Ltr> : <Missing />} validate={validTime} onSave={(v) => save({ time: v }, 'שעת האספקה')} />
        <BranchEdit o={o} />
        <div className="kv"><span className="kv__k">לקוח</span><span className="kv__v">{o.customerName}</span></div>
        <MethodEdit o={o} />
        {o.method === 'account'
          ? <EditKv k="טלפון הקפה" kind="phone" value={o.accountPhone ? fmtPhone(o.accountPhone) : ''} display={showPhone(o.accountPhone) ?? <Missing />} placeholder="05X-XXXXXXX" validate={(v) => (v ? phoneError(v) : 'חובה בהקפה: טלפון ההקפה')} onSave={(v) => save({ accountPhone: v }, 'טלפון ההקפה')} />
          : <span aria-hidden="true" />}
        <EditKv k="איש קשר לקבלה" value={o.contactName ?? ''} display={o.contactName || <Missing />} placeholder="מי מקבל את ההזמנה" onSave={(v) => save({ contactName: v || undefined }, 'איש הקשר')} />
        <EditKv k="טלפון איש הקשר" kind="phone" value={o.contactPhone ? fmtPhone(o.contactPhone) : ''} display={showPhone(o.contactPhone) ?? <Missing />} placeholder="05X-XXXXXXX" validate={validPhone} onSave={(v) => save({ contactPhone: v || undefined }, 'הטלפון')} />
        <DeliveryTypeEdit o={o} />
        {o.delivery === 'delivery' && (
          <div className="reg__wide">
            <EditKv k="כתובת" value={o.address ?? ''} display={o.address || <Missing>חסרה</Missing>} placeholder="רחוב, מספר, עיר" onSave={(v) => save({ address: v || undefined }, 'הכתובת')} />
          </div>
        )}
      </div>

      <div className="reg__items">
        <div className="reg__items-head"><span className="kv__k">תכולת ההזמנה</span>{!editItems && <button className="link" onClick={() => setEditItems(true)}>עריכה</button>}</div>
        {editItems ? <ItemsEditor o={o} onDone={() => setEditItems(false)} /> : (
          <>
            {o.contents && <p className="order-contents">{o.contents}</p>}
            {o.items.length > 0 && <><ItemsCompact o={o} />{o.items.some((i) => i.unitPrice > 0) && <PriceRows items={o.items} />}</>}
            {!o.contents && o.items.length === 0 && <p><Missing>חסרה תכולת ההזמנה</Missing> · <button className="link" onClick={() => setEditItems(true)}>הוסף פירוט</button></p>}
          </>
        )}
      </div>
      <div className="reg__wide reg__note">
        <EditKv k="הערות לסניף" kind="textarea" value={o.instructions ?? ''} placeholder="אין" onSave={(v) => save({ instructions: v || undefined }, 'ההערות')} />
      </div>

      <div className="reg__sum">
        <span className="kv__k">סכום לחיוב</span>
        <b>{o.amount > 0 ? <Money value={o.amount} /> : <Missing>חסר סכום</Missing>}</b>
        {!!o.deliveryFee && <span className="muted">כולל משלוח <Money value={o.deliveryFee} /></span>}
        {o.calcAmount !== undefined && <span className="reg__tag">שונה ידנית · מחושב <Money value={o.calcAmount} /></span>}
      </div>
      {!(o.status === 'cancelled' && !o.qNumber) && <QRow o={o} />}
    </section>
  );
}

/* השורה של Q: לפני ההקלדה – טופס קצר; אחרי – מה נרשם, וסימון "נשלח בקבוצת תפעול" */
function QRow({ o }: { o: OrderView }) {
  const { update } = useStore();
  const [editing, setEditing] = useState(!o.qNumber);
  const [num, setNum] = useState(o.qNumber ?? '');
  const [amt, setAmt] = useState(String(o.qAmount ?? o.amount));
  const [ops, setOps] = useState(o.opsNotified !== false && !!o.qNumber);
  const [err, setErr] = useState('');
  useEffect(() => { setEditing(!o.qNumber); setNum(o.qNumber ?? ''); setAmt(String(o.qAmount ?? o.amount)); setOps(o.opsNotified !== false && !!o.qNumber); setErr(''); }, [o.id, o.qNumber, o.qAmount, o.amount, o.opsNotified]);
  const custPending = o.status === 'new' || o.status === 'pending_customer';
  const early = !o.qNumber && (custPending || !o.branchApproval);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!num.trim()) { setErr("חובה: מס' ההזמנה ב-Q, למשל cs669"); return; }
    const qAmount = Number(amt.replace(/[^\d.]/g, '')) || o.amount;
    // מספר הזמנה ב-Q = ההזמנה חויבה, ולכן היא מסומנת "שולם" לבד. ביטול שכבר נרשם לא נדרס
    const paid = o.payment === 'cancelled' ? {} : { payment: 'paid' as const };
    update(o.id, { qNumber: num.trim(), qAmount, opsNotified: ops, ...paid, ...(custPending ? { status: 'approved' as const } : {}) }, qAmount !== o.amount
      ? <>הועברה ל-Q · <b>פער מול Q</b>: <Ltr>{fmtMoney(qAmount)}</Ltr> מול <Ltr>{fmtMoney(o.amount)}</Ltr></>
      : <>הועברה ל-Q · <Ltr>{num.trim()}</Ltr> · סומנה שולם</>);
    setEditing(false);
  };

  if (!editing && o.qNumber) {
    const gap = o.qAmount !== undefined && o.qAmount !== o.amount;
    return (
      <div className="reg-q reg-q--done">
        <span className="reg-q__done"><Check size={16} aria-hidden="true" /> הוקלד ל-Q · <Ltr>{o.qNumber}</Ltr> · <Money value={o.qAmount ?? o.amount} /></span>
        {gap && <span className="reg-q__gap">פער <Ltr>{fmtMoney(Math.abs((o.qAmount ?? 0) - o.amount))}</Ltr></span>}
        <label className="check-inline reg-q__ops">
          <input type="checkbox" checked={o.opsNotified !== false}
            onChange={(e) => update(o.id, { opsNotified: e.target.checked }, e.target.checked ? <>נשלח בקבוצת תפעול · הזמנה <Ltr>{o.id}</Ltr></> : <>בוטל הסימון "נשלח בקבוצת תפעול"</>)} /> נשלח בקבוצת תפעול
        </label>
        <button type="button" className="link reg-q__edit" onClick={() => setEditing(true)}>תיקון</button>
      </div>
    );
  }
  return (
    <form className="reg-q" onSubmit={submit} aria-label="העברה ל-Q">
      {early && <p className="reg-q__warn"><TriangleAlert size={14} aria-hidden="true" /> {custPending ? 'הלקוח עוד לא אישר' : 'התפעול עוד לא עודכן'}. אפשר להמשיך.</p>}
      <label className="reg-q__f">
        <span className="kv__k">מס' הזמנה ב-Q</span>
        <input className="input input--ltr" value={num} onChange={(e) => { setNum(e.target.value); setErr(''); }} placeholder="cs000" aria-invalid={!!err || undefined} />
      </label>
      <label className="reg-q__f reg-q__f--amt">
        <span className="kv__k">סכום Q (₪)</span>
        <input className="input input--ltr" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} />
      </label>
      <label className="check-inline reg-q__ops"><input type="checkbox" checked={ops} onChange={(e) => setOps(e.target.checked)} /> נשלח בקבוצת תפעול</label>
      <div className="reg-q__btns">
        <Button variant="primary" size="sm" type="submit">הועבר ל-Q</Button>
        {o.qNumber && <button type="button" className="link" onClick={() => setEditing(false)}>ביטול</button>}
      </div>
      {err && <p className="pop__err reg-q__err" role="alert">{err}</p>}
    </form>
  );
}

/* פירוט מלא וצפוף: שורה לכל קטגוריה; סוג עם תוספות / חלוקה – בשורה משלו, מוצרים פשוטים באותה שורה */
function ItemsCompact({ o }: { o: OrderView }) {
  if (!o.items.some((i) => categoryOf(i) !== OTHER)) return <p className="regi__plain">{itemsText(o.items)}</p>;
  return (
    <div className="regi">
      {groupItems(o.items).map((g) => (
        <div key={g.category} className="regi__cat">
          <b className="regi__name">{g.category} <Ltr>{g.qty}</Ltr></b>
          {g.types.some((t) => t.rows.some((r) => r.text))
            ? (
              <span className="regi__types">
                {/* סוג בשורה משלו: "12 משפחתית", ומתחת תגית לכל פירוט – "4 פטריות", "3 זיתים, בצל" */}
                {g.types.map((t, i) => (
                  <span key={i} className="regi__type">
                    <b><Ltr>{t.qty}</Ltr> {t.name}</b>
                    {t.rows.some((r) => r.text) && (
                      <span className="regi__rows">{t.rows.map((r, j) => <span key={j} className="regi__tag"><Ltr>{r.qty}</Ltr> {r.text || 'רגיל'}</span>)}</span>
                    )}
                  </span>
                ))}
              </span>
            )
            : <span>{g.types.map(typeText).join(' · ')}</span>}
        </div>
      ))}
    </div>
  );
}
