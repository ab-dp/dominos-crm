/* פיצות לפי סוג: כרטיס לכל סוג פיצה (משפחתית, משפחתית עבה…), ובתוכו שורה לכל תוספת – תוספות, חלוקה, מחיר וכמות.
   המחיר נקבע פעם אחת בראש הכרטיס וחל על כל השורות; שורה שהמחיר שלה שונה – כותבים בה מחיר משלה.
   הנתונים נשארים כמו תמיד: שורה רגילה לכל תוספת עם שם הסוג – הסיכום לתפעול, התיק והדוחות לא משתנים. */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react';
import { PIZZA, splitPart } from '../../data/types';
import { Ltr, fmtMoney, roundMoney } from '../../lib/format';
import { newId } from '../../data/customers';
import { catalogFor, isBlank, lineProblem, type CatalogItem, type Line } from './ItemsBuilder';

type Split = 1 | 2 | 4;
const SPLITS: { n: Split; label: string; aria: string }[] = [{ n: 1, label: 'שלמה', aria: 'שלמה' }, { n: 2, label: '½', aria: 'חצי-חצי' }, { n: 4, label: '¼', aria: 'רבעים' }];
const PART_PH: Record<number, string[]> = { 2: ['חצי 1', 'חצי 2'], 4: ['רבע 1', 'רבע 2', 'רבע 3', 'רבע 4'] };
const money = (s: string) => roundMoney(Number(s.replace(/[^\d.]/g, '')) || 0);

type Group = { id: string; name: string; raw: string; lines: Line[]; price: number };
/* מחיר הסוג = המחיר הנפוץ בשורות שלו (שורה במחיר אחר – מחיר ידני של השורה) */
function groupPrice(ls: Line[]) {
  const m = new Map<number, number>();
  ls.forEach((l) => { if (l.unitPrice > 0) m.set(l.unitPrice, (m.get(l.unitPrice) ?? 0) + Math.max(1, l.qty)); });
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}
/* קיבוץ: שורה ששייכת לכרטיס (gid) נשארת בו גם כששם הסוג משתנה בזמן ההקלדה; שורות שנטענו מהזמנה – לפי שם הסוג.
   שורה בלי שם ובלי כרטיס – כרטיס משלה */
export function pizzaGroups(lines: Line[]): Group[] {
  const out: Group[] = [];
  lines.forEach((l) => {
    const n = l.name.trim();
    const id = l.gid ?? (n ? `n:${n}` : `k:${l.key}`);
    const g = out.find((x) => x.id === id);
    if (g) g.lines.push(l); else out.push({ id, name: n, raw: l.name, lines: [l], price: 0 });
  });
  out.forEach((g) => { g.price = groupPrice(g.lines); });
  return out;
}

export function PizzaGroups({ lines, setLines, catalog, topHints, typeHints, lastPrice, onTouched }: {
  lines: Line[]; setLines: (f: (ls: Line[]) => Line[]) => void; catalog: CatalogItem[];
  topHints: string[]; typeHints: string[]; lastPrice: (name: string) => number | undefined; onTouched?: () => void;
}) {
  const groups = useMemo(() => pizzaGroups(lines), [lines]);
  // כרטיסים מקופלים: בהזמנה עם הרבה סוגים – כולם מקופלים חוץ מהאחרון
  const [closed, setClosed] = useState<Set<string>>(() => new Set(groups.length > 2 ? groups.slice(0, -1).map((g) => g.id) : []));
  const [focus, setFocus] = useState<{ key: string; field: string } | null>(null);
  /* יציאה מכרטיס בלחיצת עכבר: שורת "מחיר מוצע" נעלמת רק אחרי שהלחיצה הסתיימה – אחרת כל מה שמתחתיה קופץ למעלה,
     הכפתור זז מתחת לעכבר והלחיצה הולכת לאיבוד (למשל "+ סוג פיצה" אחרי עריכת שם הסוג) */
  const pointerDown = useRef(false);
  useEffect(() => {
    const down = () => { pointerDown.current = true; };
    const up = () => { pointerDown.current = false; };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
    };
  }, []);
  const leaveCard = () => {
    if (!pointerDown.current) { setFocus(null); return; }
    document.addEventListener('pointerup', () => setTimeout(() => setFocus((f) => (f && document.activeElement?.closest('.pg') ? f : null))), { once: true });
  };
  // מפתח השורה הריקה בכל כרטיס: חדש בכל פעם שהיא נכתבת – נגזר מהשורות, כך שלא חוזר גם אחרי מעבר לשונית
  const draftKey = (g: Group) => `d:${g.id}:${lines.filter((l) => l.key.startsWith(`d:${g.id}:`)).reduce((m, l) => Math.max(m, Number(l.key.split(':').pop()) + 1), 0)}`;
  const touch = () => onTouched?.();

  const patchLine = (key: string, patch: Partial<Line>, base?: Partial<Line>) => {
    setLines((ls) => (ls.some((l) => l.key === key)
      ? ls.map((l) => (l.key === key ? { ...l, ...patch } : l))
      : [...ls, { key, group: PIZZA, name: '', qty: 0, unitPrice: 0, autoName: true, ...base, ...patch }]));
    touch();
  };
  const remove = (key: string) => { setLines((ls) => ls.filter((l) => l.key !== key)); touch(); };
  const removeGroup = (g: Group) => { const keys = new Set(g.lines.map((l) => l.key)); setLines((ls) => ls.filter((l) => !keys.has(l.key))); touch(); };
  // שם הסוג: משנה את כל השורות של הכרטיס
  const rename = (g: Group, name: string) => {
    const keys = new Set(g.lines.map((l) => l.key));
    setLines((ls) => ls.map((l) => (keys.has(l.key) ? { ...l, name, gid: g.id } : l)));
    touch();
  };
  // מחיר הסוג: חל על כל השורות שבמחיר הקודם של הסוג (שורה עם מחיר משלה – לא משתנה)
  const setGroupPrice = (g: Group, unitPrice: number, itemId?: string) => {
    const keys = new Set(g.lines.filter((l) => !l.unitPrice || l.unitPrice === g.price).map((l) => l.key));
    setLines((ls) => ls.map((l) => (keys.has(l.key) ? { ...l, unitPrice, itemId, manualPrice: itemId ? undefined : unitPrice > 0 || undefined, pText: undefined } : l)));
    touch();
  };
  // פוקוס לכרטיס חדש – אחרי שהוא מצויר
  const pending = useRef<string | null>(null);
  useEffect(() => {
    if (!pending.current) return;
    const el = document.querySelector<HTMLInputElement>(pending.current);
    if (el) { el.focus(); pending.current = null; }
  });
  const focusSel = (sel: string) => { pending.current = sel; };
  const addGroup = (name = '') => {
    const key = newId();
    const gid = `g:${key}`;
    setLines((ls) => [...ls, { key, gid, group: PIZZA, name, qty: 0, unitPrice: 0, autoName: true }]);
    setClosed(new Set(groups.map((g) => g.id)));
    focusSel(name ? `[data-line="${key}"] input[data-col="tops"]` : `[data-gname="${gid}"]`);
    touch();
  };

  // Enter: לשורת התוספת הבאה באותו כרטיס; בשורה הריקה בסוף – לסוג פיצה חדש
  const onKey = (e: KeyboardEvent<HTMLInputElement>, g: Group, l: Line | null) => {
    if (e.key !== 'Enter' || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    const card = (e.target as HTMLElement).closest('.pg');
    const row = (e.target as HTMLElement).closest('[data-line]');
    if (!l || isBlank(l)) { if (g.lines.some((x) => !isBlank(x))) addGroup(); return; }
    const next = row?.nextElementSibling?.matches('[data-line]') ? row.nextElementSibling : card?.querySelector('[data-line].is-draft');
    (next?.querySelector('input[data-col="tops"]') as HTMLInputElement | null)?.focus();
  };

  const used = new Set(groups.map((g) => g.name));
  const quick = typeHints.filter((t) => !used.has(t)).slice(0, 5);
  const total = lines.filter((l) => !isBlank(l)).reduce((t, l) => t + l.qty, 0);

  return (
    <div className="pgs">
      {groups.map((g) => {
        const count = g.lines.filter((l) => !isBlank(l)).reduce((t, l) => t + l.qty, 0);
        const isOpen = !closed.has(g.id) || g.lines.some((l) => focus?.key === l.key);
        const nameBad = !g.name && g.lines.some((l) => l.qty > 0 || !!l.toppings?.length || !!l.parts?.some((p) => p.trim()));
        const toggle = () => setClosed((s) => { const n = new Set(s); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; });
        if (!isOpen) {
          const summary = g.lines.filter((l) => !isBlank(l)).map((l) => `${l.parts?.length ? l.parts.map((p) => p.trim() || 'רגילה').join(' | ') : l.toppings?.join(', ') || 'ללא תוספת'} ${l.qty}`).join(' · ');
          const bad = g.lines.some(lineProblem);
          return (
            <button type="button" key={g.id} className={`pg pg--closed ${bad ? 'is-bad' : ''}`} onClick={toggle} aria-expanded={false} aria-label={`${g.name || 'סוג פיצה'}: ${count} פיצות. פתח לעריכה`}>
              <b>{g.name || 'סוג פיצה'}</b>
              <span className="pg__sum">{summary || 'ריק'}</span>
              {g.price > 0 && <span className="pg__price"><Ltr>{fmtMoney(g.price)}</Ltr></span>}
              <span className="pg__count"><Ltr>{count}</Ltr></span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          );
        }
        const levels = focus?.field === `gprice:${g.id}` || focus?.field === `gname:${g.id}` ? catalogFor(catalog, PIZZA, g.name) : [];
        const last = g.name && (focus?.field === `gprice:${g.id}`) ? lastPrice(g.name) : undefined;
        const hasBlank = g.lines.some((l) => isBlank(l));
        const rows: (Line | null)[] = hasBlank ? g.lines : [...g.lines, null];
        return (
          <section key={g.id} className="pg" aria-label={`סוג פיצה: ${g.name || 'חדש'}`}
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) leaveCard(); }}>
            <div className="pg__head">
              <input className={`input input--sm pg__name ${nameBad ? 'is-invalid' : ''}`} list="ib-names-0" value={g.raw} placeholder="סוג פיצה, למשל: משפחתית" data-gname={g.id}
                aria-label="סוג פיצה" aria-invalid={nameBad || undefined}
                onFocus={() => setFocus({ key: g.lines[0].key, field: `gname:${g.id}` })}
                onChange={(e) => rename(g, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); (e.currentTarget.closest('.pg')?.querySelector('[data-line] input[data-col="tops"]') as HTMLInputElement | null)?.focus(); } }} />
              <label className="pg__gprice">
                <span>מחיר ליח׳</span>
                <input className="input input--sm input--ltr" inputMode="decimal" placeholder="—" aria-label={`מחיר ליחידה – ${g.name || 'סוג פיצה'}`}
                  defaultValue={g.price || ''} key={`${g.id}:${g.price}`}
                  onFocus={() => setFocus({ key: g.lines[0].key, field: `gprice:${g.id}` })}
                  onBlur={(e) => { const v = money(e.target.value); if (v !== g.price) setGroupPrice(g, v); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} />
              </label>
              <span className="pg__count" aria-label={`${count} פיצות`}><Ltr>{count}</Ltr> פיצות</span>
              {groups.length > 1 && <button type="button" className="icon-btn icon-btn--sm" aria-label={`קפל – ${g.name || 'סוג פיצה'}`} onClick={toggle}><ChevronUp size={16} /></button>}
              <button type="button" className="icon-btn icon-btn--sm" aria-label={`הסר את הסוג ${g.name || ''} וכל השורות שלו`} onClick={() => removeGroup(g)}><Trash2 size={15} /></button>
            </div>
            {(levels.length > 0 || (last !== undefined && last !== g.price)) && (
              <p className="ib-sug ib-sug--price pg__sug">
                <span>מחיר מוצע:</span>
                {levels.map((it) => (
                  <button type="button" key={it.id} className={`ib-sug__chip ${g.lines.some((l) => l.itemId === it.id) ? 'is-on' : ''}`} onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setGroupPrice(g, it.unit!, it.id)}>{it.name} <Ltr>{fmtMoney(it.unit!)}</Ltr>{it.custom && ' (ללקוח)'}</button>
                ))}
                {last !== undefined && last !== g.price && (
                  <button type="button" className="ib-sug__chip" onMouseDown={(e) => e.preventDefault()} onClick={() => setGroupPrice(g, last)}>בפעם האחרונה <Ltr>{fmtMoney(last)}</Ltr></button>
                )}
              </p>
            )}
            <div className="pg__cols" aria-hidden="true"><span>תוספות</span><span>חלוקה</span><span>מחיר <small>אם שונה</small></span><span>כמות</span><span /></div>
            {rows.map((l) => {
              const key = l?.key ?? draftKey(g);
              const line: Line = l ?? { key, group: PIZZA, name: g.name, qty: 0, unitPrice: g.price, autoName: true };
              const isDraft = !l || isBlank(line);
              const base = { name: g.raw, gid: g.id, unitPrice: g.price, autoName: true };
              const set = (patch: Partial<Line>) => patchLine(key, patch, base);
              const active = focus?.key === key;
              const bad = !active && lineProblem({ ...line, name: line.name || g.name });
              const split = (line.parts?.length ?? 1) as Split;
              const tText = line.tText ?? (line.toppings ?? []).join(', ');
              const own = line.unitPrice > 0 && line.unitPrice !== g.price;
              const priceText = line.pText ?? (own ? String(line.unitPrice) : '');
              const label = `${g.name || 'פיצה'} – ${tText || 'ללא תוספת'}`;
              const topField = active && (focus!.field === 'tops' || focus!.field.startsWith('part')) ? focus!.field : null;
              const topValue = topField === 'tops' ? tText : topField ? line.parts?.[Number(topField.slice(4))] ?? '' : '';
              const token = topValue.split(',').pop()!.trim();
              const taken = splitPart(topValue);
              const topSug = topField ? topHints.filter((h) => !taken.includes(h) && h !== token && (!token || h.includes(token))).slice(0, 6) : [];
              const pickTop = (h: string) => {
                const parts = topValue.split(',');
                parts[parts.length - 1] = ` ${h}`;
                const v = `${parts.join(',').trim()}, `;
                if (topField === 'tops') set({ tText: v, toppings: splitPart(v) });
                else set({ parts: (line.parts ?? []).map((p, i) => (i === Number(topField!.slice(4)) ? v : p)) });
              };
              const setSplit = (n: Split) => {
                const cur = line.parts?.length ? line.parts : [line.tText ?? (line.toppings ?? []).join(', ')];
                if (n === 1) set({ parts: undefined, toppings: splitPart(cur.filter((p) => p.trim()).join(', ')), tText: undefined });
                else set({ parts: Array.from({ length: n }, (_, i) => cur[i] ?? ''), toppings: undefined, tText: undefined });
              };
              const on = (field: string) => ({ onFocus: () => setFocus({ key, field }), onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => onKey(e, g, l), 'data-col': field });
              return (
                <div key={key} className={`pg__row ${isDraft ? 'is-draft' : ''}`} data-line={key}>
                  <div className="pg__r">
                    {split === 1 ? (
                      <input className="input input--sm" value={tText} placeholder="ללא תוספת" aria-label={`תוספות – ${label}`}
                        onChange={(e) => set({ tText: e.target.value, toppings: splitPart(e.target.value) })}
                        onBlur={() => { if (l && line.tText !== undefined) patchLine(key, { tText: undefined }); }} {...on('tops')} />
                    ) : (
                      <span className={`ib-r__parts ib-r__parts--${split}`}>
                        {line.parts!.map((p, i) => (
                          <input key={i} className="input input--sm" value={p} placeholder={PART_PH[split][i]} aria-label={`${PART_PH[split][i]} – ${label}`}
                            onChange={(e) => set({ parts: line.parts!.map((x, j) => (j === i ? e.target.value : x)) })} {...on(`part${i}`)} />
                        ))}
                      </span>
                    )}
                    <span className="ib-split" role="radiogroup" aria-label={`חלוקה – ${label}`}>
                      {SPLITS.map((s) => <button type="button" key={s.n} role="radio" aria-checked={split === s.n} aria-label={s.aria} title={s.aria} className={split === s.n ? 'is-on' : ''} onClick={() => setSplit(s.n)}>{s.label}</button>)}
                    </span>
                    <span className="pg__rprice">
                      <input className={`input input--sm input--ltr ${own ? 'is-own' : ''}`} inputMode="decimal" value={priceText} placeholder={g.price ? fmtMoney(g.price) : '—'} aria-label={`מחיר לשורה (אם שונה ממחיר הסוג) – ${label}`}
                        onChange={(e) => { const v = money(e.target.value); set({ pText: e.target.value, unitPrice: v || g.price, manualPrice: v > 0 || undefined, itemId: v ? undefined : line.itemId }); }}
                        onBlur={() => { if (l && line.pText !== undefined) patchLine(key, { pText: undefined }); }} {...on('price')} />
                      {own && <button type="button" className="pg__reset" aria-label="חזרה למחיר הסוג" title="חזרה למחיר הסוג" onClick={() => set({ unitPrice: g.price, manualPrice: undefined, pText: undefined })}><X size={12} /></button>}
                    </span>
                    <input className={`input input--sm input--ltr ${bad && line.qty <= 0 ? 'is-invalid' : ''}`} inputMode="numeric" value={line.qty || ''} aria-label={`כמות – ${label}`}
                      aria-invalid={bad && line.qty <= 0 ? true : undefined}
                      onChange={(e) => set({ qty: Number(e.target.value.replace(/\D/g, '')) || 0 })} {...on('qty')} />
                    {l && !(isDraft && g.lines.length === 1) ? <button type="button" className="icon-btn icon-btn--sm" aria-label={`הסר שורה – ${label}`} onClick={() => remove(key)}><Trash2 size={15} /></button> : <span />}
                  </div>
                  {line.detail && <p className="ib-r__note">הערה: {line.detail}</p>}
                  {topSug.length > 0 && (
                    <p className="ib-sug" aria-label="הצעות לתוספות">
                      {topSug.map((h) => <button type="button" key={h} className="ib-sug__chip" onMouseDown={(e) => e.preventDefault()} onClick={() => pickTop(h)}>{h}</button>)}
                    </p>
                  )}
                </div>
              );
            })}
            <button type="button" className="ib-addrow pg__addtop" onClick={(e) => (e.currentTarget.closest('.pg')?.querySelector('[data-line].is-draft input[data-col="tops"]') as HTMLInputElement | null)?.focus()}>
              <Plus size={14} aria-hidden="true" /> תוספת
            </button>
          </section>
        );
      })}
      <div className="pgs__foot">
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => addGroup()}><Plus size={15} aria-hidden="true" /><span className="btn__label">סוג פיצה</span></button>
        {quick.length > 0 && (
          <span className="pgs__quick">
            <span>או בחירה מהירה:</span>
            {quick.map((t) => <button type="button" key={t} className="ib-sug__chip" onClick={() => addGroup(t)}>{t}</button>)}
          </span>
        )}
        {total > 0 && <b className="pgs__total">סה״כ פיצות: <Ltr>{total}</Ltr></b>}
      </div>
    </div>
  );
}
