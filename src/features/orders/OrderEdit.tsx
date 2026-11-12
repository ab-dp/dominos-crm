/* עריכה בתוך תיק ההזמנה (אפיון 6.3): לוחצים על ערך, משנים, Enter או יציאה מהשדה – נשמר.
   Esc מבטל. כל שמירה נרשמת ביומן עם הערך הקודם, ומוצגת הודעה עם "בטל". */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Pencil } from 'lucide-react';
import { useBranches, useClusters } from '../../data/branches';
import { newId, useCustomers } from '../../data/customers';
import { useLists } from '../../data/lists';
import { useOrderNotes } from '../../data/orders';
import { usePriceLists } from '../../data/priceLists';
import { ItemsBuilder, PriceSource, isBlank, lineProblem, lineText, toSaved, useCatalog, type Line } from './ItemsBuilder';
import { useStore, type OrderView } from '../../data/store';
import { METHOD_LABEL, type Order } from '../../data/types';
import { Button, Missing } from '../../design/components';
import { Ltr, fmtDate, fmtMoney, fmtPhone, roundMoney, sameMoney, toISODate } from '../../lib/format';
import { cleanPhone, phoneError } from '../../lib/names';
import { BranchPicker } from '../branches/BranchPicker';

const CARD_RE = /\d{13,}/;
const money = (s: string) => roundMoney(Number(s.replace(/[^\d.]/g, '')) || 0);

/* ---------- שדה אחד שנערך במקום ---------- */
type Kind = 'text' | 'textarea' | 'date' | 'time' | 'phone' | 'money';

export function EditKv({ k, value, display, kind = 'text', placeholder, validate, onSave, readOnly, picks, autoEdit }: {
  k: string; value: string; display?: ReactNode; kind?: Kind; placeholder?: string;
  validate?: (v: string) => string; onSave: (v: string) => void; readOnly?: boolean;
  /* בחירה מהירה מתחת לשדה בזמן עריכה (למשל ערוצים מההגדרות); הבחירה נשמרת מיד */
  picks?: (draft: string, pick: (v: string) => void) => ReactNode;
  autoEdit?: boolean; // נפתח מיד לעריכה (למשל אחרי בחירה ב"אחר" באמצעי התשלום)
}) {
  const [editing, setEditing] = useState(!!autoEdit && !readOnly);
  const [draft, setDraft] = useState(value);
  const [err, setErr] = useState('');
  const [remote, setRemote] = useState<string | null>(null); // ערך שמשתמש אחר שמר בזמן שערכתי
  const start = useRef(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  useEffect(() => { if (editing) { start.current = value; setRemote(null); ref.current?.focus(); ref.current?.select?.(); } }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (next?: string) => {
    const v = kind === 'phone' ? cleanPhone(next ?? draft) : (next ?? draft).trim();
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
              onChange={(e) => { setDraft(e.target.value); setErr(''); }} onBlur={() => commit()}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); cancel(); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commit(); } }} />
          ) : (
            <input ref={ref} className={`input kv__input ${kind === 'text' ? '' : 'input--ltr'}`} value={draft} placeholder={placeholder} aria-labelledby={`kv-${k}`} aria-invalid={!!err || undefined}
              type={kind === 'date' ? 'date' : kind === 'time' ? 'time' : 'text'} step={kind === 'time' ? 900 : undefined}
              inputMode={kind === 'phone' ? 'tel' : kind === 'money' ? 'decimal' : undefined}
              onChange={(e) => { setDraft(e.target.value); setErr(''); }} onBlur={() => commit()}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); cancel(); } if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
          )}
          {picks?.(draft, (v) => { setDraft(v); commit(v); })}
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
          <Pencil size={14} className="kv__pen" aria-hidden="true" />
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
        <button type="button" className="kv__v kv__btn" onClick={() => setOpen(true)} aria-label={`סניף: ${o.branchName || "חסר"}. לחץ לשינוי`}>
          <span className="kv__val">{o.branchId ? <>{o.branchName} <span className="muted">· אשכול {o.cluster}</span></> : <Missing />}</span>
          <Pencil size={14} className="kv__pen" aria-hidden="true" />
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
              onClick={() => o.method !== m.id && save({ method: m.id, methodLabel: m.label, ...(o.methodNote !== undefined ? { methodNote: undefined } : {}) }, 'אמצעי התשלום')}>{m.label}</button>
          ))}
          {methods.length === 0 && (o.methodLabel ?? METHOD_LABEL[o.method] ?? o.method)}
        </span>
      </span>
    </div>
  );
}

/* "אחר": מה אמצעי התשלום בפועל. נפתח לעריכה מיד כשבוחרים "אחר" בכרטיס; בלי פירוט – מסומן "חסר" */
export function MethodNoteEdit({ o, justPicked }: { o: OrderView; justPicked?: boolean }) {
  const save = useOrderSave(o);
  return (
    <EditKv k="פירוט אמצעי התשלום" value={o.methodNote ?? ''} display={o.methodNote || <Missing />} placeholder="למשל: קופון, פיצוי" autoEdit={justPicked}
      onSave={(v) => save({ methodNote: v || undefined }, 'פירוט אמצעי התשלום')} />
  );
}

export const validTime = (v: string) => (/^\d{2}:\d{2}$/.test(v) ? '' : 'שעה בפורמט 14:30');
export const validDate = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? '' : 'תאריך לא תקין');
export const validPhone = (v: string) => (v ? phoneError(v) : '');
export const showDate = (iso: string) => <Ltr>{fmtDate(iso)}</Ltr>;
export const showPhone = (p?: string) => (p ? <Ltr>{fmtPhone(p)}</Ltr> : undefined);

/* ---------- פריטים, תכולה וסכום לחיוב – אותו בונה פריטים של קליטת ההזמנה ---------- */
export function ItemsEditor({ o, onDone }: { o: OrderView; onDone: () => void }) {
  const save = useOrderSave(o);
  const { items: customers } = useCustomers();
  const { items: priceLists } = usePriceLists();
  const c = customers.find((x) => x.id === o.customerId);
  const [plSel, setPlSel] = useState<string | null>(null);
  const plId = plSel ?? c?.priceListId ?? '';
  const catalog = useCatalog(priceLists.find((p) => p.id === plId), c, o.delivery);

  const [lines, setLines] = useState<Line[]>(() => o.items.map((it) => ({ ...it, key: newId() })));
  const [contents, setContents] = useState(o.contents ?? '');
  const [fee, setFee] = useState(o.deliveryFee ? String(o.deliveryFee) : '');
  const real = lines.filter((l) => !isBlank(l));
  const linesTotal = roundMoney(real.reduce((t, l) => t + l.qty * l.unitPrice, 0));
  const calc = roundMoney(linesTotal + (o.delivery === 'delivery' ? money(fee) : 0));
  const hasLines = real.length > 0;
  // פריטים בלי מחיר – הסכום הכולל נכתב ידנית, בלי "שונה ידנית / מחושב"
  const totalOnly = hasLines && linesTotal === 0;
  const [amount, setAmount] = useState(String(o.amount));
  // סכום קיים ששונה מסכום הפריטים נשמר כמו שהוא (שונה ידנית) – פתיחת העריכה לא משנה אותו בשקט
  const [manual, setManual] = useState(() => !hasLines || o.calcAmount !== undefined
    || !sameMoney(o.amount, o.items.reduce((t, l) => t + l.qty * l.unitPrice, 0) + (o.delivery === 'delivery' ? o.deliveryFee ?? 0 : 0)));
  const final = manual || totalOnly ? money(amount) : calc;
  const [err, setErr] = useState('');

  // בלי מחירים בשורות – הסכום שנכתב נשאר כמו שהוא
  useEffect(() => { if (!manual && !totalOnly) setAmount(String(calc)); }, [calc, manual, totalOnly]);

  const submit = () => {
    if (real.some(lineProblem)) return setErr('בשורה המסומנת באדום חסרים כמות או סוג / מוצר');
    if (real.some((l) => CARD_RE.test(lineText(l)))) return setErr('אסור לרשום כאן מספר כרטיס אשראי');
    if (final <= 0) return setErr(totalOnly ? 'אין מחיר בשורות – כתבו סכום כולל להזמנה' : 'הסכום לחיוב חייב להיות גדול מ-0');
    if (CARD_RE.test(contents)) return setErr('אסור לרשום כאן מספר כרטיס אשראי');
    const feeV = o.delivery === 'delivery' ? money(fee) : 0;
    save({
      items: toSaved(lines), contents: contents.trim() || undefined, deliveryFee: feeV || undefined,
      amount: final, calcAmount: hasLines && !totalOnly && final !== calc ? calc : undefined,
    }, 'פירוט ההזמנה והסכום');
    onDone();
  };

  return (
    <div className="iedit">
      <PriceSource lists={priceLists} customer={c} value={plId} onChange={setPlSel} delivery={o.delivery} />
      <ItemsBuilder lines={lines} setLines={setLines} catalog={catalog} onTouched={() => { setErr(''); if (!hasLines && !o.calcAmount) setManual(false); }} />
      <div className="iedit__grid">
        {/* פירוט במילים – רק בהזמנות ישנות שנרשם בהן; הזמנות חדשות נרשמות לפי פריטים */}
        {o.contents && (
          <label className="field">
            <span className="field__label">פירוט במילים (מהזמנה ישנה)</span>
            <textarea className="input cform__ta" rows={2} value={contents} onChange={(e) => setContents(e.target.value)} />
          </label>
        )}
        {o.delivery === 'delivery' && (
          <label className="field">
            <span className="field__label">דמי משלוח (₪)</span>
            <input className="input input--ltr" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" />
          </label>
        )}
      </div>
      <div className={`no-final ${hasLines && !totalOnly && final !== calc ? 'is-manual' : ''}`}>
        <label className="field">
          <span className="field__label">{totalOnly ? 'סכום כולל להזמנה' : 'סכום לחיוב (לפי הסגירה מול הלקוח)'}</span>
          <input className="input input--ltr" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setManual(true); setErr(''); }} />
        </label>
        {hasLines && !totalOnly && (final !== calc
          ? <p className="no-final__note"><span className="no-final__tag">שונה ידנית</span> מחושב: <Ltr>{fmtMoney(calc)}</Ltr> <button type="button" className="link" onClick={() => setManual(false)}>חזור לחישוב</button></p>
          : <p className="muted no-hint">מתעדכן לבד מהפריטים. אפשר להקליד סכום אחר.</p>)}
      </div>
      {err && <p className="cform__err" role="alert">{err}</p>}
      <div className="iedit__actions">
        <Button variant="primary" size="sm" icon={<Check size={16} />} onClick={submit}>שמור</Button>
        <Button variant="ghost" size="sm" onClick={onDone}>ביטול</Button>
      </div>
    </div>
  );
}

/* ---------- הערות פנימיות מהעבר ----------
   להזמנה יש מקום אחד להערות: "הערות להזמנה" בבלוק הקופה. הערות פנימיות שנרשמו לפני האיחוד
   (בשדה note, במערך notes הישן ובתת-האוסף notes) לא נמחקות – הן מוצגות כאן לקריאה בלבד, ורק כשיש כאלה. */
export function EarlierNotes({ o }: { o: OrderView }) {
  const notes = useOrderNotes(o.id);
  const fmtAt = (d: Date) => `${fmtDate(toISODate(d))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const all = [
    ...(o.note ? [{ id: 'first', byName: o.createdBy, when: fmtDate(o.createdAt), text: o.note }] : []),
    ...o.notes.map((n, i) => ({ id: `old-${i}`, byName: n.by, when: fmtDate(n.at), text: n.text })),
    ...(notes ?? []).map((n) => ({ id: n.id, byName: n.byName, when: typeof n.at?.toDate === 'function' ? fmtAt(n.at.toDate()) : '', text: n.text })),
  ].filter((n) => n.text.trim() && n.text.trim() !== (o.instructions ?? '').trim());
  if (!all.length) return null;
  return (
    <div className="earlier-notes">
      <span className="kv__k">הערות פנימיות קודמות</span>
      <ol className="notes__list">
        {all.map((n) => (
          <li key={n.id}>
            <span className="notes__meta"><b>{n.byName}</b>{n.when && <> · <Ltr>{n.when}</Ltr></>}</span>
            <p>{n.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
