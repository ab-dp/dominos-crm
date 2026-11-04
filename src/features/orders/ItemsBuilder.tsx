/* בונה הפריטים של ההזמנה – משותף לקליטת הזמנה ולעריכה בתיק ההזמנה.
   מקור המחיר (מחירון + משלוח/איסוף) גלוי בשורה אחת; כפתור לכל קבוצת מוצרים פותח חלון הרכבה:
   רמת מחיר, כמות, פירוט (בפיצה – תוספות, אפשר חצי-חצי או רבעים; בנלווים – שם המוצר) והערה.
   הצעות לפירוט נלמדות מהזמנות קודמות באותה קבוצה. השורות נקראות כמו קבלה. */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Minus, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Customer } from '../../data/customers';
import { GENERAL_GROUP, groupOf, priceOf, type PriceItem, type PriceList } from '../../data/priceLists';
import { useStore } from '../../data/store';
import { itemLabel, partsText, type OrderItem } from '../../data/types';
import { Button } from '../../design/components';
import { Ltr, fmtMoney } from '../../lib/format';
import { newId } from '../../data/customers';
import './ItemsBuilder.css';

export type Line = OrderItem & { key: string };
export type CatalogItem = PriceItem & { unit: number; custom: boolean };
type Delivery = 'delivery' | 'pickup';
const NO_LIST = '__none';
const MANUAL = '__manual';
const money = (s: string) => Number(s.replace(/[^\d.]/g, '')) || 0;

/* רמות המחיר של המחירון שנבחר, במחיר המתאים: משלוח/איסוף, ומחיר מיוחד ללקוח – רק במחירון של הלקוח */
export function useCatalog(priceList: PriceList | undefined, customer: Customer | undefined, delivery: Delivery): CatalogItem[] {
  return useMemo(() => (priceList?.items ?? []).filter((i) => i.active).map((i) => {
    const cp = customer && customer.priceListId === priceList?.id ? customer.customPrices.find((p) => p.itemId === i.id) : undefined;
    const unit = delivery === 'pickup' ? cp?.pickupPrice ?? priceOf(i, 'pickup') : cp && cp.price !== i.price ? cp.price : i.price;
    return { ...i, unit, custom: !!cp && (delivery === 'pickup' ? cp.pickupPrice !== undefined : cp.price !== i.price) };
  }), [priceList, customer, delivery]);
}

/* הצעות – רק ממה שכבר נכתב בהזמנות: פירוט לפי קבוצה (הנפוצים קודם), שמות פריטים ידניים, והמחיר האחרון של כל פריט ידני */
function useHints() {
  const { orders } = useStore();
  return useMemo(() => {
    const byGroup = new Map<string, Map<string, number>>();
    const names = new Map<string, number>();
    const lastPrice = new Map<string, { price: number; date: string }>();
    const bump = (m: Map<string, number>, v?: string) => { const t = v?.trim(); if (t) m.set(t, (m.get(t) ?? 0) + 1); };
    orders.forEach((o) => o.items.forEach((i) => {
      const g = i.itemId ? i.group || GENERAL_GROUP : MANUAL;
      const m = byGroup.get(g) ?? new Map<string, number>();
      byGroup.set(g, m);
      [...(i.toppings ?? []), ...(i.parts ?? []).flat()].forEach((t) => bump(m, t));
      if (!i.itemId) {
        bump(names, i.name);
        const prev = lastPrice.get(i.name.trim());
        if (!prev || o.date >= prev.date) lastPrice.set(i.name.trim(), { price: i.unitPrice, date: o.date });
      }
    }));
    const sorted = (m?: Map<string, number>) => [...(m ?? new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 200).map(([v]) => v as string);
    return { forGroup: (g: string) => sorted(byGroup.get(g)), names: sorted(names), lastPrice: (n: string) => lastPrice.get(n.trim())?.price };
  }, [orders]);
}

/* מעבר משלוח ⇄ איסוף: שורות מהמחירון מתעדכנות (חוץ ממחיר ששונה ידנית). מחזיר כמה שורות השתנו */
export function useRepriceOnDelivery(delivery: Delivery, catalog: CatalogItem[], setLines: (f: (ls: Line[]) => Line[]) => void, onChanged: (n: number) => void) {
  const prev = useRef(delivery);
  useEffect(() => {
    if (prev.current === delivery) return;
    prev.current = delivery;
    let n = 0;
    setLines((ls) => ls.map((l) => {
      const it = l.itemId && !l.manualPrice ? catalog.find((x) => x.id === l.itemId) : undefined;
      if (!it || it.unit === l.unitPrice) return l;
      n++;
      return { ...l, unitPrice: it.unit };
    }));
    setTimeout(() => onChanged(n), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery, catalog]);
}

/* שמירה: בלי שדות ריקים */
export const toSaved = (lines: Line[]): OrderItem[] => lines.map(({ key: _k, itemId, group, toppings, parts, detail, manualPrice, ...l }) => ({
  ...(itemId ? { itemId } : {}), ...(group ? { group } : {}), ...l, name: l.name.trim(),
  ...(parts?.length ? { parts } : toppings?.length ? { toppings } : {}), ...(detail?.trim() ? { detail: detail.trim() } : {}), ...(manualPrice ? { manualPrice: true } : {}),
}));

/* ---------- שורת מקור המחיר: מחירון (משלוח/איסוף נבחר בחלק "אספקה" – כאן רק מוצג) ---------- */
export function PriceSource({ lists, customer, value, onChange, delivery }: {
  lists: PriceList[]; customer?: Customer; value: string; onChange: (id: string) => void; delivery: Delivery;
}) {
  const own = customer?.priceListId;
  const options = lists.filter((p) => p.active || p.id === value || p.id === own);
  return (
    <div className="ib-source">
      <label className="ib-source__pick">
        <span className="ib-source__label">מחירון</span>
        <select className="input input--sm" value={value || NO_LIST} onChange={(e) => onChange(e.target.value === NO_LIST ? '' : e.target.value)} aria-label="מחירון לתמחור">
          {options.map((p) => <option key={p.id} value={p.id}>{p.name}{p.id === own ? ' – של הלקוח' : ''}</option>)}
          <option value={NO_LIST}>ללא מחירון – תמחור ידני</option>
        </select>
      </label>
      {value && <span className="ib-source__mode">מחירי <b>{delivery === 'pickup' ? 'איסוף עצמי' : 'משלוח'}</b></span>}
      {customer && own && value !== own && <span className="ib-source__note">לא המחירון של הלקוח – מחירים מיוחדים שלו לא חלים</span>}
    </div>
  );
}

/* ---------- שדה פירוט: צ'יפים + הקלדה, הצעות מהזמנות קודמות ---------- */
function TokenField({ values, onChange, hints, label, first, onDone }: { values: string[]; onChange: (v: string[]) => void; hints: string[]; label: string; first?: boolean; onDone?: () => void }) {
  const [text, setText] = useState('');
  const listId = useMemo(() => `ib-h-${newId()}`, []);
  // צ'יפ שנוסף לבד מההצעות: ה-Enter שהמשתמש לוחץ מיד אחריו לא מוסיף עדיין את הפריט
  const autoAdded = useRef(false);
  const add = (v: string, auto = false) => { const t = v.trim().replace(/,$/, ''); if (t && !values.includes(t)) onChange([...values, t]); setText(''); autoAdded.current = auto; };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && text.trim()) { e.preventDefault(); add(text); }
    else if (e.key === 'Enter' && !text.trim()) { e.preventDefault(); if (autoAdded.current) autoAdded.current = false; else onDone?.(); }
    else if (e.key === 'Backspace' && !text && values.length) onChange(values.slice(0, -1));
    if (e.key !== 'Enter') autoAdded.current = false;
  };
  return (
    <div className="ib-tokens" onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}>
      {values.map((t) => (
        <span key={t} className="ib-token">{t}<button type="button" aria-label={`הסר ${t}`} onClick={() => onChange(values.filter((x) => x !== t))}><X size={12} /></button></span>
      ))}
      <input className="ib-tokens__input" list={listId} value={text} data-first={first || undefined} data-pending={text.trim() || undefined}
        onChange={(e) => { const v = e.target.value; if (hints.includes(v)) add(v, true); else setText(v); }}
        onBlur={() => { if (text.trim()) add(text); }} onKeyDown={onKey} placeholder={values.length ? 'Enter ריק – הוסף פריט' : 'הקלידו ו-Enter'} aria-label={label} />
      <datalist id={listId}>{hints.filter((h) => !values.includes(h)).map((h) => <option key={h} value={h} />)}</datalist>
    </div>
  );
}

/* ---------- בונה הפריטים ---------- */
type Split = 1 | 2 | 4;
type Draft = { key?: string; manual: boolean; group: string; itemId: string; name: string; price: string; qty: number; split: Split; parts: string[][]; note: string };
const SPLIT_LABEL: Record<Split, string> = { 1: 'שלמה', 2: 'חצי-חצי', 4: 'רבעים' };
const PART_LABEL: Record<Split, string[]> = { 1: ['פירוט'], 2: ['חצי 1', 'חצי 2'], 4: ['רבע 1', 'רבע 2', 'רבע 3', 'רבע 4'] };
const resize = (parts: string[][], n: Split) => (n === 1 ? [parts.flat().filter((x, i, a) => a.indexOf(x) === i)] : Array.from({ length: n }, (_, i) => parts[i] ?? []));

export function ItemsBuilder({ lines, setLines, catalog, onTouched }: { lines: Line[]; setLines: (f: (ls: Line[]) => Line[]) => void; catalog: CatalogItem[]; onTouched?: () => void }) {
  const hints = useHints();
  const [d, setD] = useState<Draft | null>(null);
  const [err, setErr] = useState('');
  const [priceEdit, setPriceEdit] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => [...new Set(catalog.map(groupOf))], [catalog]);
  const levels = (g: string) => catalog.filter((i) => groupOf(i) === g);

  const blank = { name: '', price: '', qty: 1, split: 1 as Split, parts: [[]] as string[][], note: '' };
  const openGroup = (g: string) => { const first = levels(g)[0]; setErr(''); setD({ ...blank, manual: false, group: g, itemId: first?.id ?? '' }); };
  const openManual = () => { setErr(''); setD({ ...blank, manual: true, group: '', itemId: '' }); };
  const openEdit = (l: Line) => {
    setErr('');
    const inCatalog = !!l.itemId && catalog.some((x) => x.id === l.itemId);
    const parts = l.parts?.length ? l.parts : [l.toppings ?? []];
    setD({ key: l.key, manual: !inCatalog, group: l.group ?? GENERAL_GROUP, itemId: inCatalog ? l.itemId! : '', name: inCatalog ? '' : itemTitle(l), price: String(l.unitPrice),
      qty: l.qty, split: (parts.length === 2 || parts.length === 4 ? parts.length : 1) as Split, parts, note: l.detail ?? '' });
  };
  useEffect(() => { if (d) setTimeout(() => (boxRef.current?.querySelector('[data-first]') as HTMLElement | null)?.focus(), 20); }, [d?.group, d?.manual, d?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const level = d && !d.manual ? catalog.find((x) => x.id === d.itemId) : undefined;
  const unit = d ? (d.manual ? money(d.price) : level?.unit ?? 0) : 0;
  const hasDetail = !!d && d.parts.some((p) => p.length > 0);
  // יש פירוט ברמה "רגילה" בקבוצה שיש בה רמה "עם תוספת" – להציע לעבור
  const withTopping = d && !d.manual && hasDetail && level && !/תוספת/.test(level.name) ? levels(d.group).find((x) => /תוספת/.test(x.name)) : undefined;
  const groupHints = d ? hints.forGroup(d.manual ? MANUAL : d.group) : [];
  const lastPrice = d?.manual && d.name.trim() ? hints.lastPrice(d.name) : undefined;

  const commit = (again: boolean) => {
    if (!d) return;
    // טקסט שהוקלד ועוד לא אושר ב-Enter נכנס לפירוט
    const pending = [...(boxRef.current?.querySelectorAll<HTMLInputElement>('.ib-tokens__input[data-pending]') ?? [])];
    const parts = d.parts.map((p, i) => { const t = pending.find((x) => x.closest('[data-part]')?.getAttribute('data-part') === String(i))?.value.trim(); return t && !p.includes(t) ? [...p, t] : p; });
    if (d.manual && !d.name.trim()) return setErr('חובה: מה הפריט');
    if (!d.manual && !level) return setErr('בחרו רמת מחיר');
    if (d.qty <= 0) return setErr('חובה: כמות');
    if (/\d{13,}/.test(`${d.name} ${d.note} ${parts.flat().join(' ')}`)) return setErr('אסור לרשום כאן מספר כרטיס אשראי');
    const split = d.split > 1 ? { parts, toppings: [] } : { toppings: parts[0] ?? [], parts: undefined };
    const old = d.key ? lines.find((x) => x.key === d.key) : undefined;
    const keepManualPrice = old && !d.manual && old.itemId === level?.id && old.manualPrice;
    const line: Line = d.manual
      ? { key: d.key ?? newId(), name: d.name.trim(), qty: d.qty, unitPrice: money(d.price), ...split, detail: d.note.trim(), manualPrice: true }
      : { key: d.key ?? newId(), itemId: level!.id, group: groupOf(level!), name: level!.name, qty: d.qty, unitPrice: keepManualPrice ? old!.unitPrice : level!.unit, ...split, detail: d.note.trim(), ...(keepManualPrice ? { manualPrice: true } : {}) };
    setLines((ls) => (d.key ? ls.map((x) => (x.key === d.key ? line : x)) : [...ls, line]));
    onTouched?.();
    setErr('');
    // "הוסף ועוד אחד מאותו סוג": החלון נשאר פתוח עם אותה רמה, כמות וחלוקה – בלי הפירוט וההערה
    if (again) setD({ ...d, key: undefined, parts: resize([], d.split), note: '', name: d.manual ? '' : d.name });
    else setD(null);
  };

  const setLine = (key: string, p: Partial<Line>) => { setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l))); onTouched?.(); };

  return (
    <div className="ib">
      <div className="ib-add" role="group" aria-label="הוספת פריט">
        {groups.map((g) => (
          <button type="button" key={g} className={`ib-add__btn ${d && !d.manual && !d.key && d.group === g ? 'is-on' : ''}`} onClick={() => openGroup(g)}>
            <Plus size={15} aria-hidden="true" /> {g}
          </button>
        ))}
        <button type="button" className={`ib-add__btn ib-add__btn--manual ${d?.manual && !d.key ? 'is-on' : ''}`} onClick={openManual}><Plus size={15} aria-hidden="true" /> פריט ידני</button>
      </div>

      {d && (
        <div ref={boxRef} className="ib-box" role="group" aria-label={d.key ? 'עריכת פריט' : d.manual ? 'פריט ידני' : `הוספת ${d.group}`}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setD(null); } }}>
          <div className="ib-box__head">
            <b>{d.key ? 'עריכת פריט' : d.manual ? 'פריט ידני' : `הוספת ${d.group}`}</b>
            <button type="button" className="icon-btn icon-btn--sm" aria-label="סגור" onClick={() => setD(null)}><X size={15} /></button>
          </div>

          {!d.manual ? (
            <div className="ib-row">
              <span className="ib-row__label">רמת מחיר</span>
              <div className="ib-levels" role="radiogroup" aria-label="רמת מחיר">
                {levels(d.group).map((i, n) => (
                  <button type="button" key={i.id} role="radio" aria-checked={d.itemId === i.id} data-first={n === 0 && !d.key ? true : undefined}
                    className={`ib-level ${d.itemId === i.id ? 'is-on' : ''}`} onClick={() => setD({ ...d, itemId: i.id })}>
                    {i.name} <span className="ib-level__price"><Ltr>{fmtMoney(i.unit)}</Ltr></span>{i.custom && <span className="pricecell__tag">ללקוח</span>}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="ib-grid">
                <label className="field"><span className="field__label">מה הפריט <span className="req">חובה</span></span>
                  <input className="input" data-first list="ib-names" value={d.name} onChange={(e) => { setD({ ...d, name: e.target.value }); setErr(''); }} placeholder="למשל: מגש פירות" />
                </label>
                <label className="field"><span className="field__label">מחיר ליחידה (₪)</span>
                  <input className="input input--ltr" inputMode="decimal" value={d.price} onChange={(e) => setD({ ...d, price: e.target.value })} placeholder="0" />
                </label>
              </div>
              {/* מחיר אחרון של פריט ידני באותו שם – הצעה בלבד, לא ממלא לבד */}
              {lastPrice !== undefined && money(d.price) !== lastPrice && (
                <p className="ib-hint ib-hint--plain">בפעם האחרונה: <Ltr>{fmtMoney(lastPrice)}</Ltr> <button type="button" className="link" onClick={() => { setD({ ...d, price: String(lastPrice) }); boxRef.current?.querySelector<HTMLInputElement>('input[inputmode="decimal"]')?.focus(); }}>השתמש במחיר הזה</button></p>
              )}
            </>
          )}

          <div className="ib-row">
            <span className="ib-row__label">כמות</span>
            <div className="stepper">
              <button type="button" aria-label="הפחת" onClick={() => setD({ ...d, qty: Math.max(1, d.qty - 1) })}><Minus size={14} /></button>
              <input className="input input--sm input--ltr" inputMode="numeric" value={d.qty} onChange={(e) => setD({ ...d, qty: Number(e.target.value.replace(/\D/g, '')) || 0 })} aria-label="כמות" data-first={d.key ? true : undefined} />
              <button type="button" aria-label="הוסף" onClick={() => setD({ ...d, qty: d.qty + 1 })}><Plus size={14} /></button>
            </div>
          </div>

          <div className="ib-row">
            <span className="ib-row__label">חלוקה</span>
            <div className="seg seg--inline" role="radiogroup" aria-label="חלוקה">
              {([1, 2, 4] as Split[]).map((n) => (
                <button type="button" key={n} role="radio" aria-checked={d.split === n} className={d.split === n ? 'is-on' : ''} onClick={() => setD({ ...d, split: n, parts: resize(d.parts, n) })}>{SPLIT_LABEL[n]}</button>
              ))}
            </div>
          </div>
          {d.parts.map((p, i) => (
            <div className="ib-row" key={`${d.split}-${i}`} data-part={i}>
              <span className="ib-row__label">{PART_LABEL[d.split][i]}</span>
              <TokenField values={p} onChange={(v) => setD({ ...d, parts: d.parts.map((x, j) => (j === i ? v : x)) })} hints={groupHints} label={PART_LABEL[d.split][i]} onDone={() => commit(false)} />
            </div>
          ))}
          {withTopping && (
            <p className="ib-hint">יש פירוט – לעבור ל"{withTopping.name}" (<Ltr>{fmtMoney(withTopping.unit)}</Ltr>)? <button type="button" className="link" onClick={() => setD({ ...d, itemId: withTopping.id })}>כן, לעבור</button></p>
          )}

          <label className="ib-row">
            <span className="ib-row__label">הערה</span>
            <input className="input" value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} placeholder="למשל: בלי בצל, חתוך ל-12"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(false); } }} />
          </label>

          {err && <p className="cform__err" role="alert">{err}</p>}
          <div className="ib-box__foot">
            <span className="ib-box__sum"><Ltr>{fmtMoney(unit)}</Ltr> × <Ltr>{d.qty}</Ltr> = <b><Ltr>{fmtMoney(unit * d.qty)}</Ltr></b></span>
            <Button size="sm" variant="primary" type="button" onClick={() => commit(false)}>{d.key ? 'שמור שינויים' : 'הוסף'}</Button>
            {!d.key && <Button size="sm" variant="secondary" type="button" onClick={() => commit(true)}>הוסף ועוד אחד מאותו סוג</Button>}
          </div>
        </div>
      )}

      {lines.length > 0 && (
        <ol className="ib-lines" aria-label="פריטי ההזמנה">
          {lines.map((l) => (
            <li key={l.key} className="ib-line">
              <div className="stepper stepper--sm">
                <button type="button" aria-label={`הפחת ${itemTitle(l)}`} onClick={() => setLine(l.key, { qty: Math.max(1, l.qty - 1) })}><Minus size={13} /></button>
                <input className="input input--sm input--ltr" inputMode="numeric" value={l.qty} onChange={(e) => setLine(l.key, { qty: Number(e.target.value.replace(/\D/g, '')) || 0 })} aria-label={`כמות ${itemTitle(l)}`} />
                <button type="button" aria-label={`הוסף ${itemTitle(l)}`} onClick={() => setLine(l.key, { qty: l.qty + 1 })}><Plus size={13} /></button>
              </div>
              <span className="ib-line__text">
                <b>{itemTitle(l)}</b>
                {l.parts?.length ? <> — {partsText(l.parts)}</> : l.toppings && l.toppings.length > 0 && <> — {l.toppings.join(', ')}</>}
                {l.detail && <span className="muted"> · {l.detail}</span>}
                {(!l.itemId || l.manualPrice) && <span className="ib-line__tag">מחיר ידני</span>}
              </span>
              <span className="ib-line__price">
                {priceEdit === l.key ? (
                  <input className="input input--sm input--ltr ib-line__priceinput" autoFocus inputMode="decimal" defaultValue={l.unitPrice} aria-label={`מחיר ליחידה ${itemTitle(l)}`}
                    onBlur={(e) => { const v = money(e.target.value); if (v !== l.unitPrice) setLine(l.key, { unitPrice: v, manualPrice: true }); setPriceEdit(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } if (e.key === 'Escape') { e.stopPropagation(); setPriceEdit(null); } }} />
                ) : (
                  <button type="button" className="ib-line__unit" onClick={() => setPriceEdit(l.key)} aria-label={`מחיר ליחידה ${fmtMoney(l.unitPrice)} – לחץ לשינוי`}><Ltr>{fmtMoney(l.unitPrice)}</Ltr> ליח'</button>
                )}
                {l.itemId && l.manualPrice && catalog.some((x) => x.id === l.itemId) && (
                  <button type="button" className="link ib-line__reset" onClick={() => setLine(l.key, { unitPrice: catalog.find((x) => x.id === l.itemId)!.unit, manualPrice: false })}>חזור למחירון</button>
                )}
              </span>
              <b className="ib-line__total"><Ltr>{fmtMoney(l.qty * l.unitPrice)}</Ltr></b>
              <button type="button" className="icon-btn icon-btn--sm" aria-label={`ערוך ${itemTitle(l)}`} onClick={() => openEdit(l)}><Pencil size={15} /></button>
              <button type="button" className="icon-btn icon-btn--sm" aria-label={`הסר ${itemTitle(l)}`} onClick={() => { setLines((ls) => ls.filter((x) => x.key !== l.key)); onTouched?.(); }}><Trash2 size={15} /></button>
            </li>
          ))}
        </ol>
      )}
      <datalist id="ib-names">{hints.names.map((h) => <option key={h} value={h} />)}</datalist>
    </div>
  );
}

/* כותרת השורה: קבוצה · רמה, או שם הפריט הידני */
function itemTitle(l: Pick<OrderItem, 'group' | 'name'>) {
  return itemLabel({ group: l.group, name: l.name });
}
