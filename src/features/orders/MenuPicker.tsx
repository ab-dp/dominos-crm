/* הבוחר המדורג (שלב 7ג, מאחורי מתג): קטגוריה ← סוג ← וריאציה ← סוג תוספת ← תוספות ← חלוקה ← כמות ומחיר ← "הוסף".
   הכל מהתפריט (settings/menu); שלב שכבוי בתפריט לא מופיע. המחיר – מהמחירון לפי הסוג וסוג התוספת (ומחיר ייחודי ללקוח),
   ואפשר לשנות ידנית. השורה נכנסת לרשימת הפריטים שמתחת (אותו מבנה כמו היום, ועוד menuId / toppingKind).
   מקלדת: חצים בתוך שלב, Enter בוחר ומתקדם לשלב הבא. בלי מקשי קיצור ובלי הצעות מהיסטוריה. */
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
export function priceFor(catalog: CatalogItem[], cat: MenuCategory, item: MenuItem, kindId: string): { line?: CatalogItem; unit?: number } {
  const inCat = catalog.filter((c) => c.category === fixedCategory(cat));
  const linked = inCat.filter((c) => c.menuId === item.id);
  const byName = linked.length ? linked : inCat.filter((c) => !c.menuId && suggestMenuLink(c.name, cat.items) === item.id);
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

export function MenuPicker({ catalog, onAdd, onCategory, counts }: { catalog: CatalogItem[]; onAdd: (l: Line) => void; onCategory?: (name: string) => void; counts?: (name: string) => number }) {
  const { menu } = useMenu();
  const cats = menu.categories.filter((c) => c.active);
  const [catId, setCatId] = useState(cats[0]?.id ?? '');
  const cat = cats.find((c) => c.id === catId) ?? cats[0];
  const [itemId, setItemId] = useState('');
  const [varId, setVarId] = useState('');
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
  const kinds = cat?.steps.toppingKind ? cat.toppingKinds.filter((k) => k.active) : [];
  const kind = kinds.find((k) => k.id === kindId);
  const wantsText = !!cat?.steps.toppingText && (!kinds.length || (!!kindId && kindId !== 'without'));
  const canSplit = !!cat?.steps.split && wantsText;
  const listed = useMemo(() => (cat && item ? priceFor(catalog, cat, item, kindId) : {}), [catalog, cat, item, kindId]);
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

  const add = () => {
    if (!cat || !item) { setErr('בחרו סוג'); return; }
    if (vars.length && !varId) { setErr('בחרו וריאציה'); return; }
    if (kinds.length && !kindId) { setErr('בחרו סוג תוספת'); return; }
    if (kindId === 'with' && wantsText && (split === 1 ? !splitPart(tops).length : !parts.slice(0, split).some((p) => p.trim()))) { setErr('כתבו את התוספות'); return; }
    const q = Number(qty.replace(/\D/g, '')) || 0;
    if (q <= 0) { setErr('כמות'); return; }
    const v = vars.find((x) => x.id === varId);
    const name = [item.name, v?.name].filter(Boolean).join(' ');
    const partList = canSplit && split > 1 ? parts.slice(0, split).map((p) => p.trim()) : undefined;
    const line: Line = {
      key: newId(), group: fixedCategory(cat), name, qty: q, unitPrice: unit || 0,
      ...(listed.line ? { itemId: listed.line.id } : {}),
      ...(price !== null && unit !== (listed.unit ?? 0) ? { manualPrice: true } : {}),
      ...(partList ? { parts: partList, ...(kindId && kindId !== 'with' && kindId !== 'without' && kind ? { detail: kind.name } : {}) } : { toppings: pickedToppings(kind?.name ?? '', kindId, wantsText ? tops : '') }),
      menuId: item.id, ...(kindId ? { toppingKind: kindId } : {}),
    };
    onAdd(line);
    setAdded(`נוסף: ${q} ${name}`);
    // מוכן לשורה הבאה באותה קטגוריה
    setItemId(''); setVarId(''); setKindId(''); setTops(''); setSplit(1); setParts(['', '', '', '']); setQty('1'); setPrice(null); setErr('');
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[data-step="type"] button')?.focus());
  };

  if (!cats.length) return null;
  return (
    <div className="mpk" ref={root} role="group" aria-label="בוחר פריטים">
      <div className="mpk__cats" role="group" aria-label="קטגוריה">
        {cats.map((c) => { const n = counts?.(fixedCategory(c)) ?? 0; return <button key={c.id} type="button" aria-pressed={c.id === cat?.id} className={c.id === cat?.id ? 'is-on' : ''} onClick={() => setCatId(c.id)}>{c.name}{n > 0 && <span className="mpk__n"><Ltr>{n}</Ltr></span>}</button>; })}
      </div>
      {cat && (
        <div className="mpk__tray">
          <Step id="type" label="סוג">
            {items.length ? items.map((i) => <Opt key={i.id} on={i.id === itemId} onKey={onOptKey} onPick={(el) => choose(setItemId, i.id, el)}>{i.name}</Opt>) : <span className="muted">אין סוגים בתפריט</span>}
          </Step>
          {vars.length > 0 && (
            <Step id="var" label="וריאציה">
              {vars.map((v) => <Opt key={v.id} on={v.id === varId} onKey={onOptKey} onPick={(el) => choose(setVarId, v.id, el)}>{v.name}</Opt>)}
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
          <Step id="qty" label="כמות ומחיר">
            <input className="input input--sm input--ltr mpk__qty" inputMode="numeric" value={qty} onChange={(e) => { setQty(e.target.value.replace(/\D/g, '')); setErr(''); }} aria-label="כמות"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); add(); } }} />
            <span className="mpk__x" aria-hidden="true">×</span>
            <input className={`input input--sm input--ltr mpk__price ${price !== null ? 'is-manual' : ''}`} inputMode="decimal" value={price ?? (listed.unit ? String(listed.unit) : '')} placeholder="₪"
              onChange={(e) => setPrice(e.target.value)} aria-label="מחיר ליחידה"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); add(); } }} />
            {(Number(qty) || 0) > 0 && unit > 0 && <span className="mpk__sum"><Ltr>{fmtMoney((Number(qty) || 0) * unit)}</Ltr></span>}
            <Button size="sm" variant="secondary" type="button" icon={<Plus size={16} />} onClick={add}>הוסף</Button>
          </Step>
          {err && <p className="mpk__err" role="alert">{err}</p>}
          <span className="sr-only" role="status">{added}</span>
        </div>
      )}
    </div>
  );
}

function Step({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="mpk__row" data-step={id} role="group" aria-label={label}>
      <span className="mpk__label">{label}</span>
      <span className="mpk__opts">{children}</span>
    </div>
  );
}
function Opt({ on, onPick, onKey, children }: { on: boolean; onPick: (el: HTMLElement) => void; onKey: (e: KeyboardEvent<HTMLElement>) => void; children: ReactNode }) {
  return <button type="button" className={`mpk__opt ${on ? 'is-on' : ''}`} aria-pressed={on} onKeyDown={onKey} onClick={(e) => onPick(e.currentTarget)}>{children}</button>;
}
