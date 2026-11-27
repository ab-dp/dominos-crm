/* הבוחר המדורג (שלב 7ג, מאחורי מתג): קטגוריה ← סוג ← וריאציה ← סוג תוספת ← תוספות ← חלוקה ← כמות ומחיר ← "הוסף".
   הכל מהתפריט (settings/menu); שלב שכבוי בתפריט לא מופיע. המחיר – מהמחירון לפי הסוג וסוג התוספת (ומחיר ייחודי ללקוח),
   ואפשר לשנות ידנית. השורה נכנסת לרשימת הפריטים שמתחת (אותו מבנה כמו היום, ועוד menuId / toppingKind).
   מקלדת: חצים בתוך שלב, Enter בוחר ומתקדם לשלב הבא. בלי מקשי קיצור ובלי הצעות מהיסטוריה.
   שלב 7ד – אותו בוחר בשלושה מקומות (mode):
   order – הזמנה (הכל). quote – הצעת מחיר: בלי טקסט תוספות וחלוקה; סוג התוספת נכנס לשם ("משפחתית ללא").
   list – מחירון: רק סוג ווריאציה, בלי כמות ומחיר; הקטגוריה נקבעת מבחוץ (category) לפי הלשונית של המחירון. */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { newId } from '../../data/customers';
import { useMenu, type MenuCategory, type MenuItem } from '../../data/menu';
import { suggestMenuLink } from '../../data/priceLists';
import { CATEGORIES, OTHER, splitPart } from '../../data/types';
import { Button } from '../../design/components';
import { Ltr, fmtMoney, parseMoney as money } from '../../lib/format';
import type { CatalogItem, Line } from './ItemsBuilder';
import './MenuPicker.css';

type Split = 1 | 2 | 4;
/* קטגוריית התפריט ← הקטגוריה הקבועה של ההזמנה (שם הקבוצה בשורה). כך גם שינוי שם בתפריט לא מוציא שורות ל"אחר" */
const FIXED: Record<string, string> = { pizza: 'פיצות', sides: 'ליד הפיצה', sandwiches: 'כריכים', desserts: 'קינוחים', drinks: 'משקאות' };
export const fixedCategory = (c: Pick<MenuCategory, 'id' | 'name'>) => FIXED[c.id] ?? (CATEGORIES.includes(c.name) ? c.name : OTHER);
const SPLIT: [Split, string][] = [[1, 'שלם'], [2, 'חצי'], [4, 'רבע']];

/* השורה במחירון שמתאימה לסוג (ולסוג התוספת): קודם לפי קישור לתפריט, אחר כך לפי שם.
   מחירון ישן עם שורה לכל סוג תוספת ("משפחתיות – ללא") – מעדיפים את השורה ששמה כולל את סוג התוספת */
export function priceFor(catalog: CatalogItem[], cat: MenuCategory, item: MenuItem, kindId: string, varId = ''): { line?: CatalogItem; unit?: number } {
  const inCat = catalog.filter((c) => c.category === fixedCategory(cat));
  const linked = inCat.filter((c) => c.menuId === item.id);
  let byName = linked.length ? linked : inCat.filter((c) => !c.menuId && suggestMenuLink(c.name, cat.items) === item.id);
  // וריאציות של אותו סוג (שורות שונות שמקושרות לאותו סוג): לפי שם הווריאציה בשורה
  const varNames = item.variations.map((v) => ({ id: v.id, name: v.name.trim() })).filter((v) => v.name);
  if (varNames.length) {
    const vn = varNames.find((v) => v.id === varId)?.name;
    const withV = vn ? byName.filter((c) => c.name.includes(vn)) : [];
    const plainRows = byName.filter((c) => !varNames.some((v) => c.name.includes(v.name)));
    byName = withV.length ? withV : plainRows.length ? plainRows : byName;
  }
  if (!byName.length) return {};
  const kind = cat.toppingKinds.find((k) => k.id === kindId);
  const kindNames = cat.toppingKinds.map((k) => k.name.trim()).filter(Boolean);
  const named = kind ? byName.find((c) => c.name.includes(kind.name.trim())) : undefined;
  // אין שורה "רגילה" בלי סוג – השורה של "עם תוספת", ורק אז הראשונה
  const withName = cat.toppingKinds.find((k) => k.id === 'with')?.name.trim();
  const plain = byName.find((c) => !kindNames.some((n) => c.name.includes(n))) ?? (withName ? byName.find((c) => c.name.includes(withName)) : undefined) ?? byName[0];
  if (named) return { line: named, unit: named.unit };
  // סוג בלי מחיר ייחודי ללקוח ובלי מחיר לסוג – מחיר המחירון (לא המחיר הייחודי של "עם תוספת"; החלטה 27.11)
  const unit = kindId && kindId !== 'with' ? plain.kindUnits?.[kindId] ?? plain.listUnit ?? plain.unit : plain.unit;
  return { line: plain, unit };
}

/* הטקסט שנשמר בשורה: סוג התוספת (חוץ מ"עם תוספת" ו"ללא") ואחריו התוספות שהוקלדו */
export function pickedToppings(kindName: string, kindId: string, text: string): string[] {
  const t = splitPart(text);
  if (!kindId || kindId === 'without') return [];
  if (kindId === 'with') return t;
  return [kindName, ...t];
}

export type PickerMode = 'order' | 'quote' | 'list';
/* שם השורה בהצעת מחיר: סוג, וריאציה וסוג התוספת */
export const quoteName = (name: string, kindName?: string) => [name, kindName?.trim()].filter(Boolean).join(' ');

/* משלוח בבוחר: סוגי המשלוח מהמחירון (לשונית "משלוח"). הבחירה קובעת את דמי המשלוח של ההזמנה / ההצעה – לא שורה, כדי שלא ייספר פעמיים */
export type FeeOption = { id: string; name: string; price?: number };
export type FeePick = { options: FeeOption[]; chosen?: string; amount: string; onPick: (o: FeeOption | null) => void; onAmount: (text: string) => void };

/* active – הקטגוריה שנבחרה מבחוץ (למשל קפיצה לשורה עם שגיאה); bad – קטגוריה עם שורה חסרה (מסומנת בלשונית).
   fee – לשונית "משלוח" (רק כשיש משלוח); other – לשונית "אחר": מוצר כללי בטקסט חופשי עם כמות ומחיר */
export function MenuPicker({ catalog, onAdd, onCategory, counts, mode = 'order', category, active, bad, only, fee, other = false }: {
  catalog: CatalogItem[]; onAdd: (l: Line) => void | false; onCategory?: (name: string) => void; counts?: (name: string) => number;
  mode?: PickerMode; category?: string; active?: string; bad?: (name: string) => boolean; only?: string[]; fee?: FeePick; other?: boolean;
}) {
  const { menu } = useMenu();
  const cats = menu.categories.filter((c) => c.active && (!only || only.includes(fixedCategory(c))));
  const byActive = () => (active ? cats.find((c) => fixedCategory(c) === active) : undefined);
  const [catId, setCatId] = useState(() => (byActive() ?? cats[0])?.id ?? '');
  const cat = category !== undefined ? cats.find((c) => fixedCategory(c) === category) : cats.find((c) => c.id === catId) ?? byActive() ?? cats[0];
  const isList = mode === 'list';
  const [extra, setExtra] = useState<'' | 'fee' | 'other'>(() => (other && active === OTHER ? 'other' : ''));
  const [oName, setOName] = useState('');
  useEffect(() => {
    if (!active) return;
    if (other && active === OTHER) { setExtra('other'); return; }
    const c = cats.find((x) => fixedCategory(x) === active);
    if (c && (c.id !== cat?.id || extra)) { setCatId(c.id); setExtra(''); }
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (extra === 'fee' && !fee) setExtra(''); }, [!fee]); // eslint-disable-line react-hooks/exhaustive-deps
  const [itemId, setItemId] = useState('');
  const [varIdState, setVarId] = useState('');
  const varId = varIdState;
  const [kindId, setKindId] = useState('');
  const [tops, setTops] = useState('');
  const [split, setSplit] = useState<Split>(1);
  const [parts, setParts] = useState<string[]>(['', '', '', '']);
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState<string | null>(null); // null = מהמחירון
  const [err, setErr] = useState('');
  const [added, setAdded] = useState('');
  const root = useRef<HTMLDivElement>(null);

  const items = cat?.items.filter((i) => i.active) ?? [];
  const item = items.find((i) => i.id === itemId);
  const vars = cat?.steps.variation ? item?.variations.filter((v) => v.active) ?? [] : [];
  const kinds = !isList && cat?.steps.toppingKind ? cat.toppingKinds.filter((k) => k.active) : [];
  const kind = kinds.find((k) => k.id === kindId);
  const wantsText = mode === 'order' && !!cat?.steps.toppingText && (!kinds.length || (!!kindId && kindId !== 'without'));
  const canSplit = !!cat?.steps.split && wantsText;
  const listed = useMemo(() => (cat && item ? priceFor(catalog, cat, item, kindId, varId) : {}), [catalog, cat, item, kindId, varId]);
  const unit = price === null ? listed.unit ?? 0 : money(price);

  // קטגוריה אחרת – מתחילים מחדש; סוג אחר – מאפסים וריאציה ומחיר ידני
  useEffect(() => { setItemId(''); setVarId(''); setKindId(''); setTops(''); setSplit(1); setPrice(null); setErr(''); if (cat) onCategory?.(fixedCategory(cat)); }, [cat?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setVarId(''); setPrice(null); }, [itemId]);
  useEffect(() => { setPrice(null); }, [kindId]);

  /* Enter / חצים: מעבר בין האפשרויות בשלב, ו-Enter בוחר ועובר לשלב הבא */
  const focusStep = (from: HTMLElement) => requestAnimationFrame(() => {
    const steps = [...(root.current?.querySelectorAll<HTMLElement>('[data-step]') ?? [])];
    const i = steps.findIndex((s) => s.contains(from));
    const next = steps[i + 1];
    (next?.querySelector<HTMLElement>('[aria-pressed="true"], button, input') ?? null)?.focus();
  });
  const onOptKey = (e: KeyboardEvent<HTMLElement>) => {
    const group = (e.currentTarget as HTMLElement).closest('[data-step]');
    const opts = [...(group?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const i = opts.indexOf(e.target as HTMLButtonElement);
    if (i < 0) return;
    // RTL: חץ שמאלה = הבא
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); opts[(i + 1) % opts.length]?.focus(); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); opts[(i - 1 + opts.length) % opts.length]?.focus(); }
  };
  const choose = (set: (v: string) => void, v: string, el: HTMLElement) => { set(v); setErr(''); focusStep(el); };
  /* לשוניות הקטגוריה: חצים עוברים ובוחרים (RTL: שמאלה = הבאה) */
  const onTabKey = (e: KeyboardEvent<HTMLElement>) => {
    const tabs = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const i = tabs.indexOf(e.target as HTMLButtonElement);
    if (i < 0) return;
    const d = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = tabs[(i + d + tabs.length) % tabs.length];
    n.focus(); n.click();
  };

  const add = (over?: { itemId?: string; varId?: string }) => {
    const item = items.find((i) => i.id === (over?.itemId ?? itemId));
    const vars = cat?.steps.variation ? item?.variations.filter((v) => v.active) ?? [] : [];
    const varId = over?.varId ?? (over?.itemId ? '' : varIdState);
    if (!cat || !item) { setErr('בחרו סוג'); return; }
    if (vars.length && !varId) { setErr('בחרו וריאציה'); return; }
    if (kinds.length && !kindId) { setErr('בחרו סוג תוספת'); return; }
    if (kindId === 'with' && wantsText && (split === 1 ? !splitPart(tops).length : !parts.slice(0, split).some((p) => p.trim()))) { setErr('כתבו את התוספות'); return; }
    const q = isList ? 1 : Number(qty.replace(/\D/g, '')) || 0;
    if (q <= 0) { setErr('כמות'); return; }
    const v = vars.find((x) => x.id === varId);
    const base = [item.name, v?.name].filter(Boolean).join(' ');
    const name = mode === 'quote' ? quoteName(base, kind?.name) : base;
    const partList = canSplit && split > 1 ? parts.slice(0, split).map((p) => p.trim()) : undefined;
    const line: Line = {
      key: newId(), group: fixedCategory(cat), name, qty: q, unitPrice: unit || 0,
      ...(listed.line ? { itemId: listed.line.id } : {}),
      ...(price !== null && unit !== (listed.unit ?? 0) ? { manualPrice: true } : {}),
      ...(partList ? { parts: partList, ...(kindId && kindId !== 'with' && kindId !== 'without' && kind ? { detail: kind.name } : {}) } : { toppings: pickedToppings(kind?.name ?? '', kindId, wantsText ? tops : '') }),
      menuId: item.id, ...(kindId ? { toppingKind: kindId } : {}),
    };
    const ok = onAdd(line) !== false; // false – לא נוסף (למשל כבר במחירון)
    // מנקים ומכריזים מחדש – גם הוספה חוזרת של אותו פריט נשמעת
    setAdded('');
    if (ok) { const msg = isList ? `נוסף: ${name}` : `נוסף: ${q} ${name}`; requestAnimationFrame(() => setAdded(msg)); }
    // מוכן לשורה הבאה באותה קטגוריה
    setItemId(''); setVarId(''); setKindId(''); setTops(''); setSplit(1); setParts(['', '', '', '']); setQty('1'); setPrice(null); setErr('');
    if (!isList) requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[data-step="type"] button')?.focus());
  };

  /* "אחר": מוצר כללי – שם בטקסט חופשי, כמות ומחיר (תמיד ידני) */
  const addOther = () => {
    const name = oName.trim();
    if (!name) { setErr('כתבו את שם המוצר'); return; }
    const q = Number(qty.replace(/\D/g, '')) || 0;
    if (q <= 0) { setErr('כמות'); return; }
    const u = price === null ? 0 : money(price);
    onAdd({ key: newId(), group: OTHER, name, qty: q, unitPrice: u || 0, ...(u ? { manualPrice: true } : {}) });
    setAdded(''); const msg = `נוסף: ${q} ${name}`; requestAnimationFrame(() => setAdded(msg));
    setOName(''); setQty('1'); setPrice(null); setErr('');
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[data-step="oname"] input')?.focus());
  };
  const pickCat = (id: string) => { setCatId(id); setExtra(''); setErr(''); const c = cats.find((x) => x.id === id); if (c && c.id === cat?.id) onCategory?.(fixedCategory(c)); };
  const pickExtra = (x: 'fee' | 'other') => { setExtra(x); setErr(''); setPrice(null); setQty('1'); if (x === 'other') onCategory?.(OTHER); };

  if ((!cats.length && !other && !fee) || (category !== undefined && !cat)) return null;
  return (
    <div className={`mpk ${category !== undefined ? 'mpk--inline' : ''}`} ref={root} role="group" aria-label="בוחר פריטים">
      {category === undefined && <div className="mpk__cats" role="tablist" aria-label="קטגוריה" onKeyDown={onTabKey}>
        {cats.map((c) => {
          const n = counts?.(fixedCategory(c)) ?? 0; const on = !extra && c.id === cat?.id; const isBad = bad?.(fixedCategory(c));
          return <button key={c.id} type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1} className={`${on ? 'is-on' : ''} ${isBad ? 'is-bad' : ''}`} onClick={() => pickCat(c.id)}>
            {c.name}{n > 0 && <span className="mpk__n"><Ltr>{n}</Ltr></span>}{isBad && <span className="sr-only"> – יש שורה חסרה</span>}
          </button>;
        })}
        {other && (() => { const n = counts?.(OTHER) ?? 0; const on = extra === 'other'; const isBad = bad?.(OTHER); return (
          <button type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1} className={`${on ? 'is-on' : ''} ${isBad ? 'is-bad' : ''}`} onClick={() => pickExtra('other')}>
            אחר{n > 0 && <span className="mpk__n"><Ltr>{n}</Ltr></span>}{isBad && <span className="sr-only"> – יש שורה חסרה</span>}
          </button>
        ); })()}
        {fee && (
          <button type="button" role="tab" aria-selected={extra === 'fee'} tabIndex={extra === 'fee' ? 0 : -1} className={extra === 'fee' ? 'is-on' : ''} onClick={() => pickExtra('fee')}>
            משלוח{money(fee.amount) > 0 && <span className="mpk__n"><Ltr>{fmtMoney(money(fee.amount))}</Ltr></span>}
          </button>
        )}
      </div>}
      {extra === 'other' && (
        <div className="mpk__tray">
          <Step id="oname" label="מוצר">
            <input className="input input--sm mpk__tops" value={oName} onChange={(e) => { setOName(e.target.value); setErr(''); }} aria-label="שם המוצר"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); focusStep(e.currentTarget); } }} />
          </Step>
          <Step id="qty" label="כמות ומחיר">
            <input className="input input--sm input--ltr mpk__qty" inputMode="numeric" value={qty} onChange={(e) => { setQty(e.target.value.replace(/\D/g, '')); setErr(''); }} aria-label="כמות"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); addOther(); } }} />
            <span className="mpk__x" aria-hidden="true">×</span>
            <input className="input input--sm input--ltr mpk__price" inputMode="decimal" value={price ?? ''} placeholder="₪" onChange={(e) => setPrice(e.target.value)} aria-label="מחיר ליחידה"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); addOther(); } }} />
            {(Number(qty) || 0) > 0 && money(price ?? '') > 0 && <span className="mpk__sum"><Ltr>{fmtMoney((Number(qty) || 0) * money(price ?? ''))}</Ltr></span>}
            <Button size="sm" variant="secondary" type="button" icon={<Plus size={16} />} onClick={addOther}>הוסף</Button>
          </Step>
          {err && <p className="mpk__err" role="alert">{err}</p>}
          <span className="sr-only" role="status">{added}</span>
        </div>
      )}
      {extra === 'fee' && fee && (
        <div className="mpk__tray">
          <Step id="fee" label="סוג משלוח">
            {fee.options.map((o) => (
              <Opt key={o.id} on={fee.chosen === o.id} onKey={onOptKey} onPick={() => fee.onPick(o)}>{o.name}{o.price ? <> · <Ltr>{fmtMoney(o.price)}</Ltr></> : null}</Opt>
            ))}
            <Opt on={!fee.chosen && !money(fee.amount)} onKey={onOptKey} onPick={() => fee.onPick(null)}>בלי דמי משלוח</Opt>
          </Step>
          <Step id="feeamt" label="דמי משלוח">
            <input className="input input--sm input--ltr mpk__price" inputMode="decimal" value={fee.amount} placeholder="₪" onChange={(e) => fee.onAmount(e.target.value)} aria-label="דמי משלוח (₪)" />
          </Step>
        </div>
      )}
      {cat && !extra && (
        <div className="mpk__tray">
          <Step id="type" label="סוג">
            {items.length ? items.map((i) => <Opt key={i.id} on={i.id === itemId} onKey={onOptKey} onPick={(el) => { if (isList && !(cat.steps.variation && i.variations.some((v) => v.active))) { setItemId(i.id); add({ itemId: i.id }); } else choose(setItemId, i.id, el); }}>{i.name}</Opt>) : <span className="muted">אין סוגים בתפריט</span>}
          </Step>
          {vars.length > 0 && (
            <Step id="var" label="וריאציה">
              {vars.map((v) => <Opt key={v.id} on={v.id === varId} onKey={onOptKey} onPick={(el) => { if (isList) add({ itemId, varId: v.id }); else choose(setVarId, v.id, el); }}>{v.name}</Opt>)}
            </Step>
          )}
          {kinds.length > 0 && (
            <Step id="kind" label="סוג תוספת">
              {kinds.map((k) => <Opt key={k.id} on={k.id === kindId} onKey={onOptKey} onPick={(el) => choose(setKindId, k.id, el)}>{k.name}</Opt>)}
            </Step>
          )}
          {canSplit && (
            <Step id="split" label="חלוקה">
              {SPLIT.map(([n, l]) => <Opt key={n} on={split === n} onKey={onOptKey} onPick={(el) => { setSplit(n); focusStep(el); }}>{l}</Opt>)}
            </Step>
          )}
          {wantsText && (
            <Step id="tops" label="תוספות">
              {split === 1
                ? <input className="input input--sm mpk__tops" value={tops} onChange={(e) => { setTops(e.target.value); setErr(''); }} aria-label="תוספות"
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); focusStep(e.currentTarget); } }} />
                : Array.from({ length: split }, (_, i) => (
                  <input key={i} className="input input--sm mpk__part" value={parts[i]} aria-label={`${split === 2 ? 'חצי' : 'רבע'} ${i + 1}`} placeholder={`${split === 2 ? 'חצי' : 'רבע'} ${i + 1}`}
                    onChange={(e) => setParts((ps) => ps.map((p, j) => (j === i ? e.target.value : p)))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); const n = e.currentTarget.nextElementSibling as HTMLInputElement | null; if (n?.tagName === 'INPUT') n.focus(); else focusStep(e.currentTarget); } }} />
                ))}
            </Step>
          )}
          {!isList && (
          <Step id="qty" label="כמות ומחיר">
            <input className="input input--sm input--ltr mpk__qty" inputMode="numeric" value={qty} onChange={(e) => { setQty(e.target.value.replace(/\D/g, '')); setErr(''); }} aria-label="כמות"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); add(); } }} />
            <span className="mpk__x" aria-hidden="true">×</span>
            <input className={`input input--sm input--ltr mpk__price ${price !== null ? 'is-manual' : ''}`} inputMode="decimal" value={price ?? (listed.unit ? String(listed.unit) : '')} placeholder="₪"
              onChange={(e) => setPrice(e.target.value)} aria-label="מחיר ליחידה"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); add(); } }} />
            {(Number(qty) || 0) > 0 && unit > 0 && <span className="mpk__sum"><Ltr>{fmtMoney((Number(qty) || 0) * unit)}</Ltr></span>}
            <Button size="sm" variant="secondary" type="button" icon={<Plus size={16} />} onClick={() => add()}>הוסף</Button>
          </Step>
          )}
          {err && <p className="mpk__err" role="alert">{err}</p>}
          <span className="sr-only" role="status">{added}</span>
        </div>
      )}
    </div>
  );
}

function Step({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="mpk__row" data-step={id} role={label ? 'group' : undefined} aria-label={label || undefined}>
      <span className="mpk__label">{label}</span>
      <span className="mpk__opts">{children}</span>
    </div>
  );
}
function Opt({ on, onPick, onKey, children }: { on: boolean; onPick: (el: HTMLElement) => void; onKey: (e: KeyboardEvent<HTMLElement>) => void; children: ReactNode }) {
  return <button type="button" className={`mpk__opt ${on ? 'is-on' : ''}`} aria-pressed={on} onKeyDown={onKey} onClick={(e) => onPick(e.currentTarget)}>{children}</button>;
}
