/* עריכה בתוך תיק ההזמנה (אפיון 6.3): לוחצים על ערך, משנים, Enter או יציאה מהשדה – נשמר.
   Esc מבטל. כל שמירה נרשמת ביומן עם הערך הקודם, ומוצגת הודעה עם "בטל". */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Minus, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { useBranches, useClusters } from '../../data/branches';
import { newId, useCustomers } from '../../data/customers';
import { useLists } from '../../data/lists';
import { addOrderNote, useOrderNotes } from '../../data/orders';
import { usePriceLists } from '../../data/priceLists';
import { useStore, type OrderView } from '../../data/store';
import { METHOD_LABEL, type Order, type OrderItem } from '../../data/types';
import { Button } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, fmtDate, fmtMoney, fmtPhone, toISODate } from '../../lib/format';
import { cleanPhone, phoneError } from '../../lib/names';
import { BranchPicker } from '../branches/BranchPicker';

const CARD_RE = /\d{13,}/;
const money = (s: string) => Number(s.replace(/[^\d.]/g, '')) || 0;

/* ---------- שדה אחד שנערך במקום ---------- */
type Kind = 'text' | 'textarea' | 'date' | 'time' | 'phone' | 'money';

export function EditKv({ k, value, display, kind = 'text', placeholder, validate, onSave, readOnly }: {
  k: string; value: string; display?: ReactNode; kind?: Kind; placeholder?: string;
  validate?: (v: string) => string; onSave: (v: string) => void; readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [err, setErr] = useState('');
  const [remote, setRemote] = useState<string | null>(null); // ערך שמשתמש אחר שמר בזמן שערכתי
  const start = useRef(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  useEffect(() => { if (editing) { start.current = value; setRemote(null); ref.current?.focus(); ref.current?.select?.(); } }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => {
    const v = kind === 'phone' ? cleanPhone(draft) : draft.trim();
    const before = kind === 'phone' ? cleanPhone(value) : value.trim();
    if (v === before) { setEditing(false); setErr(''); return; }
    const e = (CARD_RE.test(v) && kind !== 'phone' ? 'אסור לרשום כאן מספר כרטיס אשראי' : '') || validate?.(v) || '';
    if (e) { setErr(e); ref.current?.focus(); return; }
    // מישהו אחר שינה את השדה בזמן שערכתי – לא דורסים בלי לשאול
    if (value !== start.current && remote === null) { setRemote(value); return; }
    onSave(v);
    setEditing(false); setErr('');
    requestAnimationFrame(() => btn.current?.focus());
  };
  const cancel = () => { setDraft(value); setErr(''); setRemote(null); setEditing(false); requestAnimationFrame(() => btn.current?.focus()); };

  if (readOnly) return <div className="kv"><span className="kv__k">{k}</span><span className="kv__v">{display ?? (value || '—')}</span></div>;

  return (
    <div className={`kv kv--edit ${editing ? 'is-editing' : ''}`}>
      <span className="kv__k" id={`kv-${k}`}>{k}</span>
      {editing ? (
        <span className="kv__field">
          {kind === 'textarea' ? (
            <textarea ref={ref} className="input kv__input kv__ta" rows={2} value={draft} placeholder={placeholder} aria-labelledby={`kv-${k}`} aria-invalid={!!err || undefined}
              onChange={(e) => { setDraft(e.target.value); setErr(''); }} onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); cancel(); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commit(); } }} />
          ) : (
            <input ref={ref} className={`input kv__input ${kind === 'text' ? '' : 'input--ltr'}`} value={draft} placeholder={placeholder} aria-labelledby={`kv-${k}`} aria-invalid={!!err || undefined}
              type={kind === 'date' ? 'date' : kind === 'time' ? 'time' : 'text'} step={kind === 'time' ? 900 : undefined}
              inputMode={kind === 'phone' ? 'tel' : kind === 'money' ? 'decimal' : undefined}
              onChange={(e) => { setDraft(e.target.value); setErr(''); }} onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); cancel(); } if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
          )}
          {remote !== null && (
            <span className="kv__remote" role="alert">
              משתמש אחר שינה בינתיים ל: <b>{remote || 'ריק'}</b>
              <span className="kv__remote-actions">
                <button type="button" className="link" onMouseDown={(e) => e.preventDefault()} onClick={() => { onSave(kind === 'phone' ? cleanPhone(draft) : draft.trim()); setRemote(null); setEditing(false); }}>שמור את שלי</button>
                <button type="button" className="link" onMouseDown={(e) => e.preventDefault()} onClick={cancel}>השאר את שלו</button>
              </span>
            </span>
          )}
          {err ? <span className="cform__err" role="alert">{err}</span> : <span className="kv__hint">{kind === 'textarea' ? 'Ctrl+Enter לשמירה' : 'Enter לשמירה'} · Esc לביטול</span>}
        </span>
      ) : (
        <button ref={btn} type="button" className="kv__v kv__btn" onClick={() => setEditing(true)} aria-label={`${k}: ${value || 'ריק'}. לחץ לעריכה`}>
          <span className="kv__val">{display ?? (value || <span className="muted">{placeholder ?? '—'}</span>)}</span>
          <Pencil size={13} className="kv__pen" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/* ---------- שדות של תיק ההזמנה ---------- */
export function useOrderSave(o: OrderView) {
  const { requestChange } = useStore();
  return (patch: Partial<Order>, what: string) => requestChange(o, patch, what);
}

export function BranchEdit({ o }: { o: OrderView }) {
  const save = useOrderSave(o);
  const { items: branches } = useBranches();
  const { items: clusters } = useClusters();
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div className="kv kv--edit">
        <span className="kv__k">סניף</span>
        <button type="button" className="kv__v kv__btn" onClick={() => setOpen(true)} aria-label={`סניף: ${o.branchName}. לחץ לשינוי`}>
          <span className="kv__val">{o.branchName} <span className="muted">· אשכול {o.cluster}</span></span>
          <Pencil size={13} className="kv__pen" aria-hidden="true" />
        </button>
      </div>
    );
  }
  return (
    <div className="kv kv--edit is-editing">
      <span className="kv__k">סניף</span>
      <span className="kv__field">
        <BranchPicker label="בחר סניף" value={{ branchId: o.branchId, clusterId: '' }} onChange={(v) => {
          const b = branches.find((x) => x.id === v.branchId);
          if (b && b.id !== o.branchId) {
            // סניף חדש: השם, הטלפון והאשכול נשמרים מחדש בהזמנה. אם הייתה מאושרת – חלון "שינוי אחרי אישור" שואל מה לבטל.
            save({ branchId: b.id, branchName: b.name, branchPhone: b.phone, cluster: clusters.find((c) => c.id === b.clusterId)?.name ?? '' }, 'הסניף');
          }
          setOpen(false);
        }} />
        <button type="button" className="link kv__cancel" onClick={() => setOpen(false)}>ביטול</button>
      </span>
    </div>
  );
}

export function DeliveryTypeEdit({ o }: { o: OrderView }) {
  const save = useOrderSave(o);
  return (
    <div className="kv">
      <span className="kv__k">סוג</span>
      <span className="kv__v">
        <span className="seg seg--inline" role="radiogroup" aria-label="משלוח או איסוף">
          {(['delivery', 'pickup'] as const).map((d) => (
            <button key={d} type="button" role="radio" aria-checked={o.delivery === d} className={o.delivery === d ? 'is-on' : ''}
              onClick={() => o.delivery !== d && save({ delivery: d }, 'סוג האספקה')}>{d === 'delivery' ? 'משלוח' : 'איסוף עצמי'}</button>
          ))}
        </span>
      </span>
    </div>
  );
}

export function MethodEdit({ o }: { o: OrderView }) {
  const save = useOrderSave(o);
  const { lists } = useLists();
  const methods = (lists?.paymentMethods ?? []).filter((m) => m.active || m.id === o.method);
  return (
    <div className="kv">
      <span className="kv__k">אמצעי תשלום</span>
      <span className="kv__v">
        <span className="seg seg--inline" role="radiogroup" aria-label="אמצעי תשלום">
          {methods.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={o.method === m.id} className={o.method === m.id ? 'is-on' : ''}
              onClick={() => o.method !== m.id && save({ method: m.id, methodLabel: m.label }, 'אמצעי התשלום')}>{m.label}</button>
          ))}
          {methods.length === 0 && (o.methodLabel ?? METHOD_LABEL[o.method] ?? o.method)}
        </span>
      </span>
    </div>
  );
}

export const validTime = (v: string) => (/^\d{2}:\d{2}$/.test(v) ? '' : 'שעה בפורמט 14:30');
export const validDate = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? '' : 'תאריך לא תקין');
export const validPhone = (v: string) => (v ? phoneError(v) : '');
export const showDate = (iso: string) => <Ltr>{fmtDate(iso)}</Ltr>;
export const showPhone = (p?: string) => (p ? <Ltr>{fmtPhone(p)}</Ltr> : undefined);

/* ---------- פריטים, תכולה וסכום לחיוב ---------- */
type Line = OrderItem & { key: string };

export function ItemsEditor({ o, onDone }: { o: OrderView; onDone: () => void }) {
  const save = useOrderSave(o);
  const reduce = useReducedMotion();
  const { items: customers } = useCustomers();
  const { items: priceLists } = usePriceLists();
  const c = customers.find((x) => x.id === o.customerId);
  const pl = priceLists.find((p) => p.id === c?.priceListId);
  const catalog = useMemo(() => (pl?.items ?? []).filter((i) => i.active).map((i) => ({
    ...i, price: c?.customPrices.find((p) => p.itemId === i.id)?.price ?? i.price,
  })), [pl, c]);

  const [lines, setLines] = useState<Line[]>(() => o.items.map((it) => ({ ...it, key: newId() })));
  const [contents, setContents] = useState(o.contents ?? '');
  const [fee, setFee] = useState(o.deliveryFee ? String(o.deliveryFee) : '');
  const calc = lines.reduce((t, l) => t + l.qty * l.unitPrice, 0) + (o.delivery === 'delivery' ? money(fee) : 0);
  const hasLines = lines.length > 0;
  const [amount, setAmount] = useState(String(o.amount));
  // סכום קיים ששונה מסכום הפריטים נשמר כמו שהוא (שונה ידנית) – פתיחת העריכה לא משנה אותו בשקט
  const [manual, setManual] = useState(() => !hasLines || o.calcAmount !== undefined
    || o.amount !== o.items.reduce((t, l) => t + l.qty * l.unitPrice, 0) + (o.delivery === 'delivery' ? o.deliveryFee ?? 0 : 0));
  const final = manual ? money(amount) : calc;
  const [err, setErr] = useState('');

  useEffect(() => { if (!manual) setAmount(String(calc)); }, [calc, manual]);

  const add = (id?: string) => {
    const it = catalog.find((x) => x.id === id);
    setLines((ls) => [...ls, { key: newId(), itemId: it?.id, name: it?.name ?? '', qty: 1, unitPrice: it?.price ?? 0 }]);
    if (!hasLines && !o.calcAmount) setManual(false);
  };
  const set = (key: string, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));

  const submit = () => {
    if (lines.some((l) => !l.name.trim() || l.qty <= 0)) return setErr('לכל פריט צריך שם וכמות');
    if (final <= 0) return setErr('הסכום לחיוב חייב להיות גדול מ-0');
    if (CARD_RE.test(contents)) return setErr('אסור לרשום כאן מספר כרטיס אשראי');
    const items = lines.map(({ key: _k, itemId, ...l }) => ({ ...(itemId ? { itemId } : {}), ...l, name: l.name.trim() }));
    const feeV = o.delivery === 'delivery' ? money(fee) : 0;
    save({
      items, contents: contents.trim() || undefined, deliveryFee: feeV || undefined,
      amount: final, calcAmount: hasLines && final !== calc ? calc : undefined,
    }, 'פירוט ההזמנה והסכום');
    onDone();
  };

  return (
    <div className="iedit">
      {hasLines && (
        <table className="items iedit__table">
          <thead><tr><th>פריט</th><th>כמות</th><th>מחיר ליח׳</th><th>סה״כ</th><th><span className="sr-only">הסר</span></th></tr></thead>
          <tbody>
            <AnimatePresence initial={false}>
              {lines.map((l) => (
                <motion.tr key={l.key} layout={!reduce} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  <td>{l.itemId ? l.name : <input className="input input--sm" value={l.name} onChange={(e) => set(l.key, { name: e.target.value })} placeholder="שם הפריט" aria-label="שם הפריט" />}</td>
                  <td>
                    <div className="stepper">
                      <button type="button" aria-label="הפחת" onClick={() => set(l.key, { qty: Math.max(1, l.qty - 1) })}><Minus size={14} /></button>
                      <input className="input input--sm input--ltr" inputMode="numeric" value={l.qty} onChange={(e) => set(l.key, { qty: Number(e.target.value.replace(/\D/g, '')) || 0 })} aria-label={`כמות ${l.name}`} />
                      <button type="button" aria-label="הוסף" onClick={() => set(l.key, { qty: l.qty + 1 })}><Plus size={14} /></button>
                    </div>
                  </td>
                  <td><input className="input input--sm input--ltr iedit__price" inputMode="decimal" value={l.unitPrice} onChange={(e) => set(l.key, { unitPrice: money(e.target.value) })} aria-label={`מחיר ליחידה ${l.name}`} /></td>
                  <td><Ltr>{fmtMoney(l.qty * l.unitPrice)}</Ltr></td>
                  <td><button type="button" className="icon-btn icon-btn--sm" aria-label={`הסר ${l.name || 'פריט'}`} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}><Trash2 size={15} /></button></td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      )}
      <div className="no-add">
        {catalog.slice(0, 6).map((i) => <button key={i.id} type="button" className="chip" onClick={() => add(i.id)}><Plus size={13} aria-hidden="true" /> {i.name}</button>)}
        {catalog.length > 6 && (
          <select className="input no-add__pick" value="" onChange={(e) => e.target.value && add(e.target.value)} aria-label="עוד פריטים מהמחירון">
            <option value="">+ עוד מהמחירון</option>
            {catalog.slice(6).map((i) => <option key={i.id} value={i.id}>{i.name} · {fmtMoney(i.price)}</option>)}
          </select>
        )}
        <Button size="sm" variant="ghost" type="button" icon={<Plus size={15} />} onClick={() => add()}>פריט חופשי</Button>
      </div>
      <div className="iedit__grid">
        <label className="field">
          <span className="field__label">פירוט במילים</span>
          <textarea className="input cform__ta" rows={2} value={contents} onChange={(e) => setContents(e.target.value)} placeholder="למשל: 12 משפחתיות, 6 שתייה" />
        </label>
        {o.delivery === 'delivery' && (
          <label className="field">
            <span className="field__label">דמי משלוח (₪)</span>
            <input className="input input--ltr" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" />
          </label>
        )}
      </div>
      <div className={`no-final ${hasLines && final !== calc ? 'is-manual' : ''}`}>
        <label className="field">
          <span className="field__label">סכום לחיוב (לפי הסגירה מול הלקוח)</span>
          <input className="input input--ltr" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setManual(true); setErr(''); }} />
        </label>
        {hasLines && (final !== calc
          ? <p className="no-final__note"><span className="no-final__tag">שונה ידנית</span> מחושב: <Ltr>{fmtMoney(calc)}</Ltr> <button type="button" className="link" onClick={() => setManual(false)}>חזור לחישוב</button></p>
          : <p className="muted no-hint">מתעדכן לבד מהפריטים. אפשר להקליד סכום אחר.</p>)}
      </div>
      {err && <p className="cform__err" role="alert">{err}</p>}
      <div className="iedit__actions">
        <Button variant="primary" size="sm" icon={<Check size={15} />} onClick={submit}>שמור</Button>
        <Button variant="ghost" size="sm" onClick={onDone}>ביטול</Button>
      </div>
    </div>
  );
}

/* ---------- הערות פנימיות ---------- */
export function NotesSection({ o }: { o: OrderView }) {
  const notes = useOrderNotes(o.id);
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const send = async () => {
    if (!text.trim()) return;
    if (CARD_RE.test(text)) return setErr('אסור לרשום כאן מספר כרטיס אשראי');
    setBusy(true);
    try { await addOrderNote(o.id, text); setText(''); }
    catch { toast({ message: 'ההערה לא נשמרה – בדוק חיבור' }); }
    setBusy(false);
  };
  const legacy = [
    ...(o.note ? [{ id: 'first', byName: o.createdBy, when: fmtDate(o.createdAt), text: o.note }] : []),
    ...o.notes.map((n, i) => ({ id: `old-${i}`, byName: n.by, when: fmtDate(n.at), text: n.text })),
  ];
  const fmtAt = (d: Date) => `${fmtDate(toISODate(d))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const all = [...legacy, ...(notes ?? []).map((n) => ({ id: n.id, byName: n.byName, when: n.at ? fmtAt(n.at.toDate()) : 'עכשיו', text: n.text }))];
  return (
    <div className="notes">
      {all.length === 0 ? <p className="muted">אין עדיין הערות</p> : (
        <ol className="notes__list">
          {all.map((n) => (
            <li key={n.id}>
              <span className="notes__meta"><b>{n.byName}</b> · <Ltr>{n.when}</Ltr></span>
              <p>{n.text}</p>
            </li>
          ))}
        </ol>
      )}
      <div className="notes__composer">
        <textarea className="input cform__ta" rows={2} value={text} placeholder="הוסף הערה פנימית (נראית רק במוקד)" aria-label="הערה פנימית חדשה" aria-invalid={!!err || undefined}
          onChange={(e) => { setText(e.target.value); setErr(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }} />
        <div className="notes__row">
          {err ? <span className="cform__err" role="alert">{err}</span> : <span className="kv__hint">אי אפשר לערוך או למחוק הערה אחרי השמירה · Ctrl+Enter</span>}
          <Button size="sm" variant="secondary" icon={<Send size={14} />} loading={busy} disabled={!text.trim()} onClick={send}>הוסף</Button>
        </div>
      </div>
    </div>
  );
}
