/* "להעברה לקופה": הבלוק הראשון בתיק ההזמנה – כל מה שהאחמ"ש צריך כדי להקליד את ההזמנה ל-Q ביום ההזמנה,
   ובתחתיתו השורה שבה רושמים שהועברה ל-Q (מספר, סכום, נשלח בקבוצת תפעול). כל ערך נערך בלחיצה, כמו בשאר התיק. */
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, Copy } from 'lucide-react';
import { type OrderView } from '../../data/store';
import { groupItems, itemsText, methodText, typeText, OTHER, categoryOf, stageOf } from '../../data/types';
import { Missing } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, Money, fmtDate, fmtMoney, fmtPhone, sameMoney, weekday } from '../../lib/format';
import { QForm } from './OrderActions';
import { phoneError } from '../../lib/names';
import { PriceRows } from './ItemsBuilder';
import { BranchEdit, DeliveryTypeEdit, EarlierNotes, EditKv, ItemsEditor, MethodEdit, MethodNoteEdit, showDate, showPhone, useOrderSave, validDate, validPhone, validTime } from './OrderEdit';

/* טקסט מסודר להעתקה (להקלדה בקופה או לשליחה לסניף) */
export function registerText(o: OrderView) {
  const items = !o.items.length ? o.contents ?? ''
    : !o.items.some((i) => categoryOf(i) !== OTHER) ? itemsText(o.items)
      : groupItems(o.items).map((c) => `${c.category} ${c.qty}: ${c.types.map(typeText).join(' ; ')}`).join('\n');
  const method = methodText(o);
  return [
    `הזמנה ${o.id} · ${o.customerName}`,
    `${weekday(o.date)} ${fmtDate(o.date)} · ${o.time} · ${o.branchName}`,
    `תשלום: ${method}${o.method === 'account' && o.accountPhone ? ` · טלפון הקפה ${fmtPhone(o.accountPhone)}` : ''}`,
    (o.contactName || o.contactPhone) && `איש קשר: ${[o.contactName, o.contactPhone && fmtPhone(o.contactPhone)].filter(Boolean).join(' · ')}`,
    o.delivery === 'pickup' ? 'איסוף עצמי' : `משלוח: ${o.address ?? ''}`,
    items,
    o.instructions && `הערות: ${o.instructions}`,
    `סכום: ${fmtMoney(o.amount)}`,
  ].filter(Boolean).join('\n');
}

export function RegisterBlock({ o }: { o: OrderView }) {
  const save = useOrderSave(o);
  const toast = useToast();
  const [editItems, setEditItems] = useState(false);
  useEffect(() => setEditItems(false), [o.id]);
  // אמצעי התשלום של ההזמנה הזו שונה עכשיו ל"אחר" (ולא כך נפתח הכרטיס) – שדה הפירוט נפתח מיד לכתיבה
  const lastMethod = useRef(`${o.id}:${o.method}`);
  const justPickedOther = o.method === 'other' && !o.methodNote && lastMethod.current !== `${o.id}:other` && lastMethod.current.startsWith(`${o.id}:`);
  useEffect(() => { lastMethod.current = `${o.id}:${o.method}`; });
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
          : o.method === 'other' ? <MethodNoteEdit o={o} justPicked={justPickedOther} />
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
        {/* המקום היחיד להערות בהזמנה – אותו שדה של "הערות להזמנה" בהזמנה חדשה, ומופיע גם בסיכום לתפעול */}
        <EditKv k="הערות להזמנה" kind="textarea" value={o.instructions ?? ''} placeholder="אין" onSave={(v) => save({ instructions: v || undefined }, 'ההערות')} />
        <EarlierNotes o={o} />
      </div>

      <div className="reg__sum">
        <span className="kv__k">סכום לחיוב</span>
        <b>{o.amount > 0 ? <Money value={o.amount} /> : <Missing>חסר סכום</Missing>}</b>
        {!!o.deliveryFee && <span className="muted">כולל משלוח <Money value={o.deliveryFee} /></span>}
        {o.calcAmount !== undefined && <span className="reg__tag">שונה ידנית · מחושב <Money value={o.calcAmount} /></span>}
      </div>
      <QRow o={o} />
    </section>
  );
}

/* השורה של Q: לפני ההקלדה – הטופס המשותף (QForm), מוטמע; אחרי – מה נרשם, ו"תיקון".
   השליחה בקבוצת התפעול מסומנת בציר (הצעד הבא), לא כאן – מקום אחד לכל פעולה */
function QRow({ o }: { o: OrderView }) {
  const [editing, setEditing] = useState(!o.qNumber);
  useEffect(() => setEditing(!o.qNumber), [o.id, o.qNumber]);
  if (!editing && o.qNumber) {
    const gap = o.qAmount !== undefined && !sameMoney(o.qAmount, o.amount);
    return (
      <div className="reg-q reg-q--done">
        <span className="reg-q__done"><Check size={16} aria-hidden="true" /> הוקלד ל-Q · <Ltr>{o.qNumber}</Ltr> · <Money value={o.qAmount ?? o.amount} /></span>
        {gap && <span className="reg-q__gap">פער <Ltr>{fmtMoney(Math.abs((o.qAmount ?? 0) - o.amount))}</Ltr></span>}
        {o.opsNotified === true && <span className="reg-q__ops-state">נשלח בקבוצת תפעול</span>}
        <button type="button" className="link reg-q__edit" onClick={() => setEditing(true)}>תיקון</button>
      </div>
    );
  }
  // הכפתור "הועבר ל-Q" ראשי רק כשהקלדה ל-Q היא באמת הצעד הבא; בשלבים קודמים הצעד הבא הוא בציר
  return <QForm o={o} inline primary={stageOf(o) === 'approved'} done={() => setEditing(false)} onCancel={o.qNumber ? () => setEditing(false) : undefined} />;
}

/* הזמנה מבוטלת: הפרטים לקריאה בלבד ומקופלים – בלי "העתק הכל" ובלי עריכה, כדי שלא יוקלדו לקופה בטעות */
export function RegisterLocked({ o }: { o: OrderView }) {
  const lines = registerText(o).split('\n').slice(1);
  return (
    <details className="reg reg--locked">
      <summary className="reg__head reg__summary">
        <ChevronLeft size={16} aria-hidden="true" className="reg__chev" />
        <span className="reg__title">פרטי ההזמנה</span>
        <span className="muted">לקריאה בלבד</span>
      </summary>
      <div className="reg__lines">
        {lines.map((l, i) => <p key={i}>{l}</p>)}
        {o.qNumber && <p>הוקלד ל-Q · <Ltr>{o.qNumber}</Ltr> · <Ltr>{fmtMoney(o.qAmount ?? o.amount)}</Ltr></p>}
      </div>
    </details>
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
