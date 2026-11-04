/* בונה הפריטים של ההזמנה – משותף לקליטת הזמנה ולעריכה בתיק ההזמנה.
   לשונית לכל קטגוריה קבועה (פיצות / ליד הפיצה / כריכים / קינוחים / משקאות) וטבלת שורות ישירה:
   בפיצות – כמות, סוג, תוספות, חלוקה ומחיר; בשאר – כמות, מוצר ומחיר. הכול מלל חופשי עם הצעות מהזמנות קודמות.
   המחיר רשות: מחירון או מחיר אחרון מוצעים בלחיצה ולא נכנסים לבד. שורה ריקה בסוף תמיד מוכנה להקלדה. */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Customer } from '../../data/customers';
import { DELIVERY_CAT, priceOf, type PriceItem, type PriceList } from '../../data/priceLists';
import { useStore } from '../../data/store';
import { CATEGORIES, OTHER, PIZZA, categoryOf, groupItems, splitPart, type OrderItem } from '../../data/types';
import { Ltr, fmtMoney } from '../../lib/format';
import { newId } from '../../data/customers';
import './ItemsBuilder.css';

/* tText / pText – הטקסט כפי שמוקלד (פסיק בסוף, "12."), עד שיוצאים מהשדה. autoName – סוג הפיצה הועתק מהשורה הקודמת ולא נכתב. לא נשמרים */
export type Line = OrderItem & { key: string; tText?: string; pText?: string; autoName?: boolean };
export type CatalogItem = PriceItem & { unit?: number; custom: boolean };
type Delivery = 'delivery' | 'pickup';
const NO_LIST = '__none';
const money = (s: string) => Number(s.replace(/[^\d.]/g, '')) || 0;

/* שורה שלא הוקלד בה כלום (גם אם סוג הפיצה הועתק מהשורה הקודמת) – לא נשמרת ולא נבדקת.
   מוצר שנכתב בלי כמות אינו ריק – הוא מסומן כחסר, ולא נעלם בשקט */
export const isBlank = (l: OrderItem & { autoName?: boolean }) => !l.qty && !l.toppings?.length && !l.parts?.some((p) => p.trim()) && !l.unitPrice && (!l.name.trim() || !!l.autoName);
/* שורה שהתחילו למלא בלי כמות או בלי סוג / מוצר */
export const lineProblem = (l: OrderItem) => !isBlank(l) && (!l.name.trim() || l.qty <= 0);
export const lineText = (l: OrderItem) => `${l.name} ${l.detail ?? ''} ${(l.toppings ?? []).join(' ')} ${(l.parts ?? []).join(' ')}`;

/* המוצרים של המחירון שנבחר (בלי מדרגות המשלוח), במחיר המתאים: משלוח/איסוף, ומחיר מיוחד ללקוח – רק במחירון של הלקוח.
   מוצר בלי מחיר במחירון – unit ריק */
export function useCatalog(priceList: PriceList | undefined, customer: Customer | undefined, delivery: Delivery): CatalogItem[] {
  return useMemo(() => buildCatalog(priceList, customer, delivery), [priceList, customer, delivery]);
}
export function buildCatalog(priceList: PriceList | undefined, customer: Customer | undefined, delivery: Delivery): CatalogItem[] {
  return (priceList?.items ?? []).filter((i) => i.active && i.category !== DELIVERY_CAT).map((i) => {
    const cp = customer && customer.priceListId === priceList?.id ? customer.customPrices.find((p) => p.itemId === i.id) : undefined;
    const own = !!cp && !!cp.price && cp.price !== i.price; // מחיר מיוחד למשלוח (0 = אין)
    const unit = delivery === 'pickup' ? cp?.pickupPrice ?? priceOf(i, 'pickup') : own ? cp!.price : i.price;
    return { ...i, unit, custom: delivery === 'pickup' ? cp?.pickupPrice !== undefined : own };
  });
}

/* הצעות – רק ממה שכבר נכתב בהזמנות: סוגים / מוצרים לפי קטגוריה, תוספות, והמחיר האחרון של כל מוצר */
const NOT_PIZZA = /נלוו|שתי|משק|קינוח|כריך/;
function useHints() {
  const { orders } = useStore();
  return useMemo(() => {
    const names = new Map<string, Map<string, number>>();
    const tops = new Map<string, number>();
    const lastPrice = new Map<string, { price: number; date: string }>();
    const bump = (m: Map<string, number>, v?: string) => { const t = v?.trim(); if (t) m.set(t, (m.get(t) ?? 0) + 1); };
    orders.forEach((o) => o.items.forEach((i) => {
      const cat = categoryOf(i);
      if (cat !== OTHER) {
        const m = names.get(cat) ?? new Map<string, number>();
        names.set(cat, m);
        bump(m, i.name);
        const k = `${cat}|${i.name.trim()}`;
        const prev = lastPrice.get(k);
        if (i.unitPrice > 0 && (!prev || o.date >= prev.date)) lastPrice.set(k, { price: i.unitPrice, date: o.date });
      }
      // תוספות: מהפיצות, וגם מהזמנות ישנות שאינן נלווים / שתייה
      if (cat === PIZZA || (cat === OTHER && !NOT_PIZZA.test(i.group ?? ''))) [...(i.toppings ?? []), ...(i.parts ?? []).flatMap(splitPart)].forEach((t) => bump(tops, t));
    }));
    const sorted = (m?: Map<string, number>) => [...(m ?? new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 200).map(([v]) => v as string);
    const topList = sorted(tops);
    return { names: (cat: string) => sorted(names.get(cat)), tops: topList, lastPrice: (cat: string, name: string) => lastPrice.get(`${cat}|${name.trim()}`)?.price };
  }, [orders]);
}

/* מחירון: מוצרים עם מחיר באותה קטגוריה ששמם דומה למה שהוקלד ("משפחתית" ↔ "פיצה משפחתית עם תוספת").
   אין התאמה – כל המוצרים של הקטגוריה (עד 6) */
export const normName = (s: string) => s.replace(/["'׳״\s\-–]/g, '').replace(/(ות|ים|ה|ת)$/, '');
export function catalogFor<T extends Pick<CatalogItem, 'category' | 'name' | 'unit'>>(catalog: T[], category: string, name: string): T[] {
  const inCat = catalog.filter((i) => i.category === category && i.unit);
  const n = normName(name);
  const near = n.length >= 2 ? inCat.filter((i) => { const g = normName(i.name); return g.includes(n) || n.includes(g); }) : [];
  return (near.length ? near : inCat).slice(0, 6);
}

/* מעבר משלוח ⇄ איסוף: שורות שהמחיר שלהן נלקח מהמחירון מתעדכנות (חוץ ממחיר ששונה ידנית). מחזיר כמה שורות השתנו */
export function useRepriceOnDelivery(delivery: Delivery, catalog: CatalogItem[], setLines: (f: (ls: Line[]) => Line[]) => void, onChanged: (n: number) => void) {
  const prev = useRef(delivery);
  useEffect(() => {
    if (prev.current === delivery) return;
    prev.current = delivery;
    let n = 0;
    setLines((ls) => ls.map((l) => {
      const it = l.itemId && !l.manualPrice ? catalog.find((x) => x.id === l.itemId) : undefined;
      if (!it?.unit || it.unit === l.unitPrice) return l;
      n++;
      return { ...l, unitPrice: it.unit, pText: undefined };
    }));
    setTimeout(() => onChanged(n), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery, catalog]);
}

/* שמירה: בלי שורות ריקות ובלי שדות ריקים */
export const toSaved = (lines: Line[]): OrderItem[] => lines.filter((l) => !isBlank(l)).map(({ key: _k, tText: _t, pText: _p, autoName: _a, itemId, group, toppings, parts, detail, manualPrice, ...l }) => ({
  ...(itemId ? { itemId } : {}), ...(group ? { group } : {}), ...l, name: l.name.trim(),
  ...(parts?.length ? { parts: parts.map((p) => p.trim()) } : toppings?.length ? { toppings } : {}), ...(detail?.trim() ? { detail: detail.trim() } : {}), ...(manualPrice ? { manualPrice: true } : {}),
}));

/* ---------- שורת מקור המחיר: מחירון להצעות מחיר (משלוח/איסוף נבחר בחלק "אספקה" – כאן רק מוצג) ---------- */
export function PriceSource({ lists, customer, value, onChange, delivery }: {
  lists: PriceList[]; customer?: Customer; value: string; onChange: (id: string) => void; delivery: Delivery;
}) {
  const own = customer?.priceListId;
  const options = lists.filter((p) => p.active || p.id === value || p.id === own);
  const note = lists.find((p) => p.id === value)?.note?.trim();
  return (
    <div className="ib-source">
      <label className="ib-source__pick">
        <span className="ib-source__label">מחירון</span>
        <select className="input input--sm" value={value || NO_LIST} onChange={(e) => onChange(e.target.value === NO_LIST ? '' : e.target.value)} aria-label="מחירון">
          {options.map((p) => <option key={p.id} value={p.id}>{p.name}{p.id === own ? ' – של הלקוח' : ''}</option>)}
          <option value={NO_LIST}>ללא מחירון</option>
        </select>
      </label>
      {value && <span className="ib-source__mode">מחירי <b>{delivery === 'pickup' ? 'איסוף עצמי' : 'משלוח'}</b></span>}
      {customer && own && value !== own && <span className="ib-source__note">לא המחירון של הלקוח – מחירים מיוחדים שלו לא חלים</span>}
      {note && <span className="ib-source__cond">תנאי המחירון: {note}</span>}
    </div>
  );
}

/* ---------- הטבלה ---------- */
type Split = 1 | 2 | 4;
const SPLITS: { n: Split; label: string; aria: string }[] = [{ n: 1, label: 'שלמה', aria: 'שלמה' }, { n: 2, label: '½', aria: 'חצי-חצי' }, { n: 4, label: '¼', aria: 'רבעים' }];
const PART_PH: Record<number, string[]> = { 2: ['חצי 1', 'חצי 2'], 4: ['רבע 1', 'רבע 2', 'רבע 3', 'רבע 4'] };
type Field = 'qty' | 'name' | 'tops' | 'price' | `part${number}`;

export function ItemsBuilder({ lines, setLines, catalog, onTouched }: { lines: Line[]; setLines: (f: (ls: Line[]) => Line[]) => void; catalog: CatalogItem[]; onTouched?: () => void }) {
  const hints = useHints();
  const rootRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState(() => (lines.length ? categoryOf(lines[0]) : PIZZA));
  const [draftKey, setDraftKey] = useState(newId);
  const [focus, setFocus] = useState<{ key: string; field: Field } | null>(null);

  const showOther = lines.some((l) => categoryOf(l) === OTHER);
  const tabs = [...CATEGORIES, ...(showOther ? [OTHER] : [])];
  const catLines = lines.filter((l) => categoryOf(l) === tab);
  const pizza = tab === PIZZA || tab === OTHER;
  // שורה חדשה בפיצות ממשיכה את סוג הפיצה של השורה האחרונה
  const prevName = tab === PIZZA ? [...catLines].reverse().find((l) => l.name.trim())?.name.trim() ?? '' : '';
  const draft: Line = { key: draftKey, group: tab, name: '', qty: 0, unitPrice: 0 };
  const rows = tab === OTHER ? catLines : [...catLines, draft];
  // תוספות שכבר נכתבו בהזמנה הזו קודם, ואז מההזמנות הקודמות
  const topHints = useMemo(() => [...new Set([...lines.flatMap((l) => [...(l.toppings ?? []), ...(l.parts ?? []).flatMap(splitPart)]), ...hints.tops])], [lines, hints.tops]);
  const count = (cat: string) => lines.filter((l) => categoryOf(l) === cat && !isBlank(l)).reduce((t, l) => t + l.qty, 0);

  const change = (key: string, patch: Partial<Line>) => {
    setLines((ls) => (ls.some((l) => l.key === key)
      ? ls.map((l) => (l.key === key ? { ...l, ...patch } : l))
      : [...ls, { key, group: tab, name: prevName, autoName: !!prevName, qty: 0, unitPrice: 0, ...patch }]));
    if (key === draftKey) setDraftKey(newId());
    onTouched?.();
  };
  const remove = (key: string) => { setLines((ls) => ls.filter((l) => l.key !== key)); onTouched?.(); };
  const setSplit = (l: Line, n: Split) => {
    const cur = l.parts?.length ? l.parts : [l.tText ?? (l.toppings ?? []).join(', ')];
    if (n === 1) change(l.key, { parts: undefined, toppings: splitPart(cur.filter((p) => p.trim()).join(', ')), tText: undefined });
    else change(l.key, { parts: Array.from({ length: n }, (_, i) => cur[i] ?? ''), toppings: undefined, tText: undefined });
  };

  // Enter (או "+ שורה"): לשורה הבאה (בסוף – לשורה הריקה). Ctrl+Enter ממשיך לשמירת ההזמנה
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    const row = (e.target as HTMLElement).closest('[data-row]');
    const next = row?.nextElementSibling?.matches('[data-row]') ? row.nextElementSibling : row?.parentElement?.querySelector('[data-draft]');
    if (next && next !== row) (next.querySelector('input[data-col="name"]') as HTMLInputElement | null)?.focus();
  };
  const bad = (ls: Line[]) => ls.some((l) => l.key !== focus?.key && lineProblem(l));
  const on = (key: string, field: Field) => ({ onFocus: () => setFocus({ key, field }), onKeyDown: onKey, 'data-col': field });

  return (
    <div className="ib" ref={rootRef}>
      <div className="ib-tabs" role="tablist" aria-label="קטגוריה">
        {tabs.map((c) => {
          const n = count(c);
          const bad = lines.some((l) => categoryOf(l) === c && lineProblem(l));
          return (
            <button type="button" role="tab" key={c} aria-selected={tab === c} className={`ib-tab ${tab === c ? 'is-on' : ''} ${bad ? 'is-bad' : ''}`}
              onClick={() => { setTab(c); setFocus(null); }}>
              {c}{n > 0 && <span className="ib-tab__n"><Ltr>{n}</Ltr></span>}{bad && <span className="sr-only"> – יש שורה חסרה</span>}
            </button>
          );
        })}
      </div>

      <div className={`ib-table ${pizza ? 'ib-table--pizza' : ''}`} role="table" aria-label={`פריטים – ${tab}`}>
        <div className="ib-r ib-r--head" role="row">
          <span role="columnheader">{tab === PIZZA ? 'סוג פיצה' : tab === OTHER ? 'פריט' : 'מוצר'}</span>
          {pizza && <span role="columnheader">תוספות</span>}
          {pizza && <span role="columnheader">חלוקה</span>}
          <span role="columnheader">מחיר ליח׳ <small>רשות</small></span>
          <span role="columnheader">כמות</span>
          <span />
        </div>
        {rows.map((l) => {
          const isDraft = l.key === draftKey;
          const active = focus?.key === l.key;
          const bad = !active && lineProblem(l);
          const split = (l.parts?.length ?? 1) as Split;
          const tText = l.tText ?? (l.toppings ?? []).join(', ');
          const priceText = l.pText ?? (l.unitPrice ? String(l.unitPrice) : '');
          const label = l.name.trim() || (isDraft ? 'שורה חדשה' : 'שורה');
          // הצעות לתוספות לפי מה שמוקלד אחרי הפסיק האחרון
          const topField = active && (focus!.field === 'tops' || focus!.field.startsWith('part')) ? focus!.field : null;
          const topValue = topField === 'tops' ? tText : topField ? l.parts?.[Number(topField.slice(4))] ?? '' : '';
          const token = topValue.split(',').pop()!.trim();
          const used = splitPart(topValue);
          const topSug = topField ? topHints.filter((h) => !used.includes(h) && h !== token && (!token || h.includes(token))).slice(0, 6) : [];
          const pickTop = (h: string) => {
            const parts = topValue.split(',');
            parts[parts.length - 1] = ` ${h}`;
            const v = `${parts.join(',').trim()}, `;
            if (topField === 'tops') change(l.key, { tText: v, toppings: splitPart(v) });
            else change(l.key, { parts: (l.parts ?? []).map((p, i) => (i === Number(topField!.slice(4)) ? v : p)) });
          };
          // מחיר מוצע – כשעומדים על הסוג / המוצר או על המחיר
          const priceFocus = active && !isDraft && l.name.trim() && (focus!.field === 'name' || focus!.field === 'price');
          const levels = priceFocus && tab !== OTHER ? catalogFor(catalog, tab, l.name) : [];
          const last = priceFocus && tab !== OTHER ? hints.lastPrice(tab, l.name) : undefined;
          return (
            <div key={l.key} className="ib-rgroup" data-row={isDraft ? undefined : true} data-draft={isDraft || undefined}
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus((f) => (f?.key === l.key ? null : f)); }}>
              <div className={`ib-r ${isDraft ? 'is-draft' : ''}`} role="row">
                <span className="ib-r__name">
                  {tab === OTHER && l.group && l.group !== 'כללי' && <span className="ib-r__old">{l.group}</span>}
                  <input className={`input input--sm ${bad && !l.name.trim() ? 'is-invalid' : ''}`} list={tab === OTHER ? undefined : `ib-names-${CATEGORIES.indexOf(tab)}`} value={l.name}
                    placeholder={isDraft && prevName ? prevName : pizza ? 'למשל: משפחתית' : 'מוצר'}
                    onChange={(e) => change(l.key, { name: e.target.value, autoName: undefined })} aria-label={`${tab === PIZZA ? 'סוג פיצה' : 'מוצר'} – ${label}`} aria-invalid={bad && !l.name.trim() ? true : undefined} {...on(l.key, 'name')} />
                </span>
                {pizza && (split === 1 ? (
                  <input className="input input--sm" value={tText} placeholder="ללא תוספת" aria-label={`תוספות – ${label}`}
                    onChange={(e) => change(l.key, { tText: e.target.value, toppings: splitPart(e.target.value) })}
                    onBlur={() => { if (!isDraft && l.tText !== undefined) change(l.key, { tText: undefined }); }} {...on(l.key, 'tops')} />
                ) : (
                  <span className={`ib-r__parts ib-r__parts--${split}`}>
                    {l.parts!.map((p, i) => (
                      <input key={i} className="input input--sm" value={p} placeholder={PART_PH[split][i]} aria-label={`${PART_PH[split][i]} – ${label}`}
                        onChange={(e) => change(l.key, { parts: l.parts!.map((x, j) => (j === i ? e.target.value : x)) })} {...on(l.key, `part${i}`)} />
                    ))}
                  </span>
                ))}
                {pizza && (
                  <span className="ib-split" role="radiogroup" aria-label={`חלוקה – ${label}`}>
                    {SPLITS.map((s) => (
                      <button type="button" key={s.n} role="radio" aria-checked={split === s.n} aria-label={s.aria} title={s.aria} className={split === s.n ? 'is-on' : ''} onClick={() => setSplit(l, s.n)}>{s.label}</button>
                    ))}
                  </span>
                )}
                <input className="input input--sm input--ltr" inputMode="decimal" value={priceText} placeholder="—" aria-label={`מחיר ליחידה – ${label}`}
                  onChange={(e) => { const v = money(e.target.value); change(l.key, { pText: e.target.value, unitPrice: v, manualPrice: v > 0 || undefined, ...(v ? {} : { itemId: undefined }) }); }}
                  onBlur={() => { if (!isDraft && l.pText !== undefined) change(l.key, { pText: undefined }); }} {...on(l.key, 'price')} />
                <input className={`input input--sm input--ltr ${bad && l.qty <= 0 ? 'is-invalid' : ''}`} inputMode="numeric" value={l.qty || ''} placeholder=""
                  onChange={(e) => change(l.key, { qty: Number(e.target.value.replace(/\D/g, '')) || 0 })} aria-label={`כמות – ${label}`} aria-invalid={bad && l.qty <= 0 ? true : undefined} {...on(l.key, 'qty')} />
                {isDraft ? <span /> : <button type="button" className="icon-btn icon-btn--sm" aria-label={`הסר שורה – ${label}`} onClick={() => remove(l.key)}><Trash2 size={15} /></button>}
              </div>
              {l.detail && <p className="ib-r__note">הערה: {l.detail}</p>}
              {topSug.length > 0 && (
                <p className="ib-sug" aria-label="הצעות לתוספות">
                  {topSug.map((h) => <button type="button" key={h} className="ib-sug__chip" onMouseDown={(e) => e.preventDefault()} onClick={() => pickTop(h)}>{h}</button>)}
                </p>
              )}
              {(levels.length > 0 || (last !== undefined && last !== l.unitPrice)) && (
                <p className="ib-sug ib-sug--price">
                  <span>מחיר מוצע:</span>
                  {levels.map((it) => (
                    <button type="button" key={it.id} className={`ib-sug__chip ${l.itemId === it.id ? 'is-on' : ''}`} onMouseDown={(e) => e.preventDefault()}
                      onClick={() => change(l.key, { itemId: it.id, unitPrice: it.unit, manualPrice: undefined, pText: undefined })}>
                      {it.name} <Ltr>{fmtMoney(it.unit!)}</Ltr>{it.custom && ' (ללקוח)'}
                    </button>
                  ))}
                  {last !== undefined && last !== l.unitPrice && (
                    <button type="button" className="ib-sug__chip" onMouseDown={(e) => e.preventDefault()} onClick={() => change(l.key, { unitPrice: last, manualPrice: true, itemId: undefined, pText: undefined })}>
                      בפעם האחרונה <Ltr>{fmtMoney(last)}</Ltr>
                    </button>
                  )}
                </p>
              )}
            </div>
          );
        })}
        {tab !== OTHER && (
          <button type="button" className="ib-addrow" onClick={() => rootRef.current?.querySelector<HTMLInputElement>('[data-draft] input[data-col="name"]')?.focus()}>
            <Plus size={14} aria-hidden="true" /> שורה
          </button>
        )}
        {bad(catLines) && <p className="ib-err" role="alert">בשורה המסומנת באדום חסרים {tab === PIZZA ? 'כמות או סוג פיצה' : 'כמות או מוצר'}</p>}
      </div>
      <p className="ib-foot">
        <span>Enter – לשורה הבאה{tab === PIZZA ? ' · שורה חדשה ממשיכה את סוג הפיצה הקודם' : ''}{pizza ? ' · כמה תוספות – עם פסיק' : ''}</span>
        {count(tab) > 0 && <b>סה״כ {tab}: <Ltr>{count(tab)}</Ltr></b>}
      </p>
      {CATEGORIES.map((c, i) => <datalist key={c} id={`ib-names-${i}`}>{[...new Set([...catalog.filter((x) => x.category === c).map((x) => x.name), ...hints.names(c)])].map((h) => <option key={h} value={h} />)}</datalist>)}
    </div>
  );
}

const rowLabel = (it: OrderItem) => { const t = groupItems([it])[0].types[0]; return t.rows[0].text ? `${t.name} — ${t.rows[0].text}` : t.name; };

/* ---------- תצוגת הפריטים בתיק ההזמנה: קטגוריה ← סוג ← פירוט, ומחירים רק אם הוזנו ---------- */
export function ItemsView({ items }: { items: OrderItem[] }) {
  const groups = groupItems(items);
  const priced = items.some((i) => i.unitPrice > 0);
  return (
    <div className="iview">
      {groups.map((c) => (
        <section key={c.category} className="iview__cat" aria-label={`${c.category} – ${c.qty}`}>
          <h4 className="iview__head">{c.category} <span className="iview__n"><Ltr>{c.qty}</Ltr></span></h4>
          <ul className="iview__list">
            {c.types.map((t) => (
              <li key={t.name}>
                <b><Ltr>{t.qty}</Ltr> × {t.name}</b>
                {(t.rows.length > 1 || t.rows[0].text) && (
                  <ul className="iview__rows">
                    {t.rows.map((r, i) => <li key={i}>{t.rows.length > 1 && <><Ltr>{r.qty}</Ltr> · </>}{r.text || 'רגיל'}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {priced && (
        <details className="iview__prices">
          <summary>מחירים לפי שורה</summary>
          <table className="items">
            <thead><tr><th>שורה</th><th>כמות</th><th>מחיר ליחידה</th><th>סה״כ</th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}><td>{rowLabel(it)}</td><td><Ltr>{it.qty}</Ltr></td><td>{it.unitPrice ? <Ltr>{fmtMoney(it.unitPrice)}</Ltr> : '—'}</td><td>{it.unitPrice ? <Ltr>{fmtMoney(it.qty * it.unitPrice)}</Ltr> : '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
