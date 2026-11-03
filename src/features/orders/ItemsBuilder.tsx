/* בונה הפריטים של ההזמנה – משותף לקליטת הזמנה ולעריכה בתיק ההזמנה.
   מקור המחיר (מחירון + משלוח/איסוף) גלוי בשורה אחת; כפתור לכל קבוצת מוצרים פותח חלון הרכבה:
   רמת מחיר, כמות, תוספות (הצעות נלמדות מהזמנות קודמות) והערה. השורות נקראות כמו קבלה. */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Minus, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Customer } from '../../data/customers';
import { GENERAL_GROUP, groupOf, priceOf, type PriceItem, type PriceList } from '../../data/priceLists';
import { useStore } from '../../data/store';
import { itemLabel, type OrderItem } from '../../data/types';
import { Button } from '../../design/components';
import { Ltr, fmtMoney } from '../../lib/format';
import { newId } from '../../data/customers';
import './ItemsBuilder.css';

export type Line = OrderItem & { key: string };
export type CatalogItem = PriceItem & { unit: number; custom: boolean };
type Delivery = 'delivery' | 'pickup';
const NO_LIST = '__none';
const money = (s: string) => Number(s.replace(/[^\d.]/g, '')) || 0;

/* רמות המחיר של המחירון שנבחר, במחיר המתאים: משלוח/איסוף, ומחיר מיוחד ללקוח – רק במחירון של הלקוח */
export function useCatalog(priceList: PriceList | undefined, customer: Customer | undefined, delivery: Delivery): CatalogItem[] {
  return useMemo(() => (priceList?.items ?? []).filter((i) => i.active).map((i) => {
    const cp = customer && customer.priceListId === priceList?.id ? customer.customPrices.find((p) => p.itemId === i.id) : undefined;
    const unit = delivery === 'pickup' ? cp?.pickupPrice ?? priceOf(i, 'pickup') : cp && cp.price !== i.price ? cp.price : i.price;
    return { ...i, unit, custom: !!cp && (delivery === 'pickup' ? cp.pickupPrice !== undefined : cp.price !== i.price) };
  }), [priceList, customer, delivery]);
}

/* הצעות לתוספות ולשמות פריטים ידניים – רק ממה שכבר נכתב בהזמנות, הנפוצים קודם */
function useHints() {
  const { orders } = useStore();
  return useMemo(() => {
    const tops = new Map<string, number>();
    const names = new Map<string, number>();
    const bump = (m: Map<string, number>, v?: string) => { const t = v?.trim(); if (t) m.set(t, (m.get(t) ?? 0) + 1); };
    orders.forEach((o) => o.items.forEach((i) => { i.toppings?.forEach((t) => bump(tops, t)); if (!i.itemId) bump(names, i.name); }));
    const sorted = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 200).map(([v]) => v);
    return { toppings: sorted(tops), names: sorted(names) };
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
export const toSaved = (lines: Line[]): OrderItem[] => lines.map(({ key: _k, itemId, group, toppings, detail, manualPrice, ...l }) => ({
  ...(itemId ? { itemId } : {}), ...(group ? { group } : {}), ...l, name: l.name.trim(),
  ...(toppings?.length ? { toppings } : {}), ...(detail?.trim() ? { detail: detail.trim() } : {}), ...(manualPrice ? { manualPrice: true } : {}),
}));

/* ---------- שורת מקור המחיר: מחירון + משלוח/איסוף ---------- */
export function PriceSource({ lists, customer, value, onChange, delivery, onDelivery }: {
  lists: PriceList[]; customer?: Customer; value: string; onChange: (id: string) => void; delivery: Delivery; onDelivery?: (d: Delivery) => void;
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
      {onDelivery && (
        <div className="seg" role="radiogroup" aria-label="מחירי משלוח או איסוף">
          {(['delivery', 'pickup'] as const).map((d) => (
            <button type="button" key={d} role="radio" aria-checked={delivery === d} className={delivery === d ? 'is-on' : ''} onClick={() => onDelivery(d)}>{d === 'delivery' ? 'משלוח' : 'איסוף עצמי'}</button>
          ))}
        </div>
      )}
      {customer && own && value !== own && <span className="ib-source__note">לא המחירון של הלקוח – מחירים מיוחדים שלו לא חלים</span>}
    </div>
  );
}

/* ---------- בונה הפריטים ---------- */
type Draft = { key?: string; manual: boolean; group: string; itemId: string; name: string; price: string; qty: number; toppings: string[]; top: string; note: string };

export function ItemsBuilder({ lines, setLines, catalog, onTouched }: { lines: Line[]; setLines: (f: (ls: Line[]) => Line[]) => void; catalog: CatalogItem[]; onTouched?: () => void }) {
  const hints = useHints();
  const [d, setD] = useState<Draft | null>(null);
  const [err, setErr] = useState('');
  const [priceEdit, setPriceEdit] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => [...new Set(catalog.map(groupOf))], [catalog]);
  const levels = (g: string) => catalog.filter((i) => groupOf(i) === g);

  const openGroup = (g: string) => { const first = levels(g)[0]; setErr(''); setD({ manual: false, group: g, itemId: first?.id ?? '', name: '', price: '', qty: 1, toppings: [], top: '', note: '' }); };
  const openManual = () => { setErr(''); setD({ manual: true, group: '', itemId: '', name: '', price: '', qty: 1, toppings: [], top: '', note: '' }); };
  const openEdit = (l: Line) => {
    setErr('');
    const inCatalog = !!l.itemId && catalog.some((x) => x.id === l.itemId);
    setD({ key: l.key, manual: !inCatalog, group: l.group ?? GENERAL_GROUP, itemId: inCatalog ? l.itemId! : '', name: inCatalog ? '' : itemTitle(l), price: String(l.unitPrice), qty: l.qty, toppings: l.toppings ?? [], top: '', note: l.detail ?? '' });
  };
  useEffect(() => { if (d) setTimeout(() => (boxRef.current?.querySelector('[data-first]') as HTMLElement | null)?.focus(), 20); }, [d?.group, d?.manual, d?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const level = d && !d.manual ? catalog.find((x) => x.id === d.itemId) : undefined;
  const unit = d ? (d.manual ? money(d.price) : level?.unit ?? 0) : 0;
  // יש תוספות ברמה "רגילה" – להציע רמה עם תוספת באותה קבוצה
  const withTopping = d && !d.manual && d.toppings.length > 0 && level && !/תוספת/.test(level.name) ? levels(d.group).find((x) => /תוספת/.test(x.name)) : undefined;

  const addTopping = (v: string) => {
    const t = v.trim().replace(/,$/, '');
    if (!d || !t) return;
    if (!d.toppings.includes(t)) setD({ ...d, toppings: [...d.toppings, t], top: '' }); else setD({ ...d, top: '' });
  };
  const onTopKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!d) return;
    if ((e.key === 'Enter' || e.key === ',') && d.top.trim()) { e.preventDefault(); addTopping(d.top); }
    else if (e.key === 'Backspace' && !d.top && d.toppings.length) setD({ ...d, toppings: d.toppings.slice(0, -1) });
  };

  const commit = (again: boolean) => {
    if (!d) return;
    const top = d.top.trim() ? [...d.toppings, d.top.trim()].filter((x, i, a) => a.indexOf(x) === i) : d.toppings;
    if (d.manual && !d.name.trim()) return setErr('חובה: מה הפריט');
    if (!d.manual && !level) return setErr('בחרו רמת מחיר');
    if (d.qty <= 0) return setErr('חובה: כמות');
    if (d.manual && !(money(d.price) >= 0)) return setErr('מחיר לא תקין');
    if (/\d{13,}/.test(`${d.name} ${d.note} ${top.join(' ')}`)) return setErr('אסור לרשום כאן מספר כרטיס אשראי');
    const old = d.key ? lines.find((x) => x.key === d.key) : undefined;
    const keepManualPrice = old && !d.manual && old.itemId === level?.id && old.manualPrice;
    const line: Line = d.manual
      ? { key: d.key ?? newId(), name: d.name.trim(), qty: d.qty, unitPrice: money(d.price), toppings: top, detail: d.note.trim(), manualPrice: true }
      : { key: d.key ?? newId(), itemId: level!.id, group: groupOf(level!), name: level!.name, qty: d.qty, unitPrice: keepManualPrice ? old!.unitPrice : level!.unit, toppings: top, detail: d.note.trim(), ...(keepManualPrice ? { manualPrice: true } : {}) };
    setLines((ls) => (d.key ? ls.map((x) => (x.key === d.key ? line : x)) : [...ls, line]));
    onTouched?.();
    setErr('');
    // "הוסף ועוד אחד מאותו סוג": החלון נשאר פתוח עם אותה רמה, בלי התוספות וההערה
    if (again) setD({ ...d, key: undefined, toppings: [], top: '', note: '', name: d.manual ? '' : d.name });
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
            <div className="ib-grid">
              <label className="field"><span className="field__label">מה הפריט <span className="req">חובה</span></span>
                <input className="input" data-first list="ib-names" value={d.name} onChange={(e) => { setD({ ...d, name: e.target.value }); setErr(''); }} placeholder="למשל: מגש פירות" />
              </label>
              <label className="field"><span className="field__label">מחיר ליחידה (₪)</span>
                <input className="input input--ltr" inputMode="decimal" value={d.price} onChange={(e) => setD({ ...d, price: e.target.value })} placeholder="0" />
              </label>
            </div>
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
            <span className="ib-row__label">תוספות</span>
            <div className="ib-tokens" onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}>
              {d.toppings.map((t) => (
                <span key={t} className="ib-token">{t}<button type="button" aria-label={`הסר ${t}`} onClick={() => setD({ ...d, toppings: d.toppings.filter((x) => x !== t) })}><X size={12} /></button></span>
              ))}
              <input className="ib-tokens__input" list="ib-tops" value={d.top} onChange={(e) => { const v = e.target.value; if (hints.toppings.includes(v)) addTopping(v); else setD({ ...d, top: v }); }}
                onKeyDown={onTopKey} placeholder={d.toppings.length ? '' : 'הקלידו תוספת ו-Enter'} aria-label="הוספת תוספת" />
            </div>
          </div>
          {withTopping && (
            <p className="ib-hint">יש תוספות – לעבור ל"{withTopping.name}" (<Ltr>{fmtMoney(withTopping.unit)}</Ltr>)? <button type="button" className="link" onClick={() => setD({ ...d, itemId: withTopping.id })}>כן, לעבור</button></p>
          )}

          <label className="ib-row">
            <span className="ib-row__label">הערה</span>
            <input className="input" value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} placeholder="למשל: חצי-חצי, בלי בצל"
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
                {l.toppings && l.toppings.length > 0 && <> — {l.toppings.join(', ')}</>}
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
      <datalist id="ib-tops">{hints.toppings.map((h) => <option key={h} value={h} />)}</datalist>
      <datalist id="ib-names">{hints.names.map((h) => <option key={h} value={h} />)}</datalist>
    </div>
  );
}

/* כותרת השורה: קבוצה · רמה, או שם הפריט הידני */
function itemTitle(l: Pick<OrderItem, 'group' | 'name'>) {
  return itemLabel({ group: l.group, name: l.name });
}
