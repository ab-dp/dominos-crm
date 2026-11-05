/* מחירונים (אפיון 6.7): מוצרים לפי הקטגוריות של ההזמנה, ומדרגות משלוח. המחירים מוקלדים ידנית וכוללים מע"מ.
   עריכה ישירה בטבלה – כמו בהזמנה: Enter לשורה הבאה, "+ שורה", והדבקה מאקסל. כל שורה נשמרת כשיוצאים ממנה, וכל עריכה נרשמת ביומן.
   לקוחות משויכים מכאן או מתיק הלקוח; מחירון של לקוח נבחר לבד בהצעת מחיר ובהזמנה. שינוי מחירון לא משנה הזמנות והצעות קיימות. */
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Copy, Pencil, Plus, Search, Tags, Trash2, Users, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Shell } from '../leads/LeadDialogs';
import {
  DELIVERY_CAT, PL_TABS, assignPriceList, createPriceList, deletePriceList, updatePriceList, usePriceLists, type PriceItem, type PriceList,
} from '../../data/priceLists';
import { newId, useCustomers, type Customer } from '../../data/customers';
import { Button, EmptyState, Skeleton } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, fmtMoney } from '../../lib/format';
import '../pages.css';
import '../branches/BranchesPage.css';
import '../orders/ItemsBuilder.css';
import './PriceListsPage.css';

const num = (s: string) => { const v = Number(s.replace(/[^\d.]/g, '')); return s.trim() && Number.isFinite(v) && v > 0 ? v : undefined; };
const txt = (v?: number) => (v === undefined ? '' : String(v));
// שם כפול בקטגוריה: אותו שם בדיוק (בלי רווחים וגרשיים). שמות שנבדלים במספר – "עד 8" ו"עד 24" – אינם כפולים
const sameName = (a: string, b: string) => { const k = (x: string) => x.replace(/["'׳״\s\-–]/g, ''); return !!k(a) && k(a) === k(b); };

export function PriceListsPage() {
  const { items, loading, error } = usePriceLists();
  const { items: customers } = useCustomers();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [err, setErr] = useState('');
  const [dup, setDup] = useState<PriceList | null>(null);
  const selectedId = params.get('id') ?? items[0]?.id;
  const selected = items.find((p) => p.id === selectedId);
  const assigned = (id: string) => customers.filter((c) => c.priceListId === id && c.status !== 'merged');

  const create = async () => {
    if (!newName.trim()) return setErr('חובה: שם המחירון');
    const similar = items.find((x) => sameName(x.name, newName));
    if (similar) return setErr(`כבר קיים מחירון בשם הזה: "${similar.name}"`);
    try {
      const id = await createPriceList(newName);
      setCreating(false); setNewName(''); setErr('');
      setParams({ id }, { replace: true });
      toast({ message: <>המחירון "{newName.trim()}" נוצר – הוסיפו מוצרים בטבלה</> });
    } catch { setErr('השמירה נכשלה – אין הרשאה או אין חיבור'); }
  };

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">מחירונים</h1>
          <p className="page__sub">מוצרים ומחירים לפי קטגוריה. המחירים כוללים מע"מ.</p>
        </div>
        <div className="page__head-end"><Button variant="primary" icon={<Plus size={18} />} onClick={() => setCreating(true)} disabled={creating}>מחירון חדש</Button></div>
      </header>

      {error ? <div className="card"><EmptyState icon={<Tags size={24} />} title="לא ניתן לטעון">{error}</EmptyState></div> : (
        <div className="br-grid">
          <section className="card" aria-labelledby="h-pl">
            <div className="card__head"><h2 id="h-pl" className="card__title">מחירונים</h2><span className="muted"><Ltr>{items.length}</Ltr></span></div>
            <ul className="clist">
              {creating && (
                <li className="name-editor pl-new">
                  <input className="input input--sm" autoFocus value={newName} placeholder="למשל: מחירון עסקים 2027" aria-label="שם המחירון"
                    onChange={(e) => { setNewName(e.target.value); setErr(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } if (e.key === 'Escape') { setCreating(false); setErr(''); } }} />
                  <div className="pl-new__actions">
                    <Button size="sm" variant="primary" onClick={create}>צור</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setErr(''); }}>ביטול</Button>
                  </div>
                  {err && <p className="pop__err" role="alert">{err}</p>}
                </li>
              )}
              {loading ? [0, 1].map((i) => <li key={i} className="citem-skel"><Skeleton h={18} /></li>) : items.map((p) => {
                const n = p.items.filter((i) => i.category !== DELIVERY_CAT).length;
                return (
                  <li key={p.id} className={p.active ? '' : 'is-inactive'}>
                    <button className={`citem pl-item ${p.id === selectedId ? 'is-on' : ''}`} aria-pressed={p.id === selectedId} onClick={() => setParams({ id: p.id }, { replace: true })}>
                      <span className="citem__name">{p.name}</span>
                      {!p.active && <span className="tag-inactive">לא פעיל</span>}
                      <span className="citem__count"><Ltr>{n}</Ltr> מוצרים · <Ltr>{assigned(p.id).length}</Ltr> לקוחות</span>
                    </button>
                  </li>
                );
              })}
              {!loading && items.length === 0 && !creating && <li className="clist__empty">עוד אין מחירונים. <button className="link" onClick={() => setCreating(true)}>צור את הראשון</button></li>}
            </ul>
          </section>

          {selected ? <Editor key={selected.id} pl={selected} all={items} customers={customers} assigned={assigned(selected.id)} onDuplicate={() => setDup(selected)} /> : !loading && (
            <div className="card"><EmptyState icon={<Tags size={24} />} title="בחר מחירון או צור חדש">מחירון אחד יכול לשמש לקוחות רבים, או לקוח אחד בלבד.</EmptyState></div>
          )}
        </div>
      )}
      {dup && <DuplicateDialog from={dup} all={items} onClose={() => setDup(null)} onDone={(id) => { setDup(null); setParams({ id }, { replace: true }); }} />}
    </div>
  );
}

/* ---------- עורך המחירון ---------- */
type Row = { id: string; category: string; name: string; price: string; pickup: string; upTo: string; active: boolean };
const toRow = (i: PriceItem): Row => ({ id: i.id, category: i.category, name: i.name, price: txt(i.price), pickup: txt(i.pickupPrice), upTo: txt(i.upTo), active: i.active });
const toItem = (r: Row): PriceItem => ({
  id: r.id, category: r.category, name: r.name.trim(), active: r.active, price: num(r.price),
  ...(r.category === DELIVERY_CAT ? { upTo: num(r.upTo) } : { pickupPrice: num(r.pickup) }),
});
const same = (a: Row, b?: Row) => !!b && JSON.stringify(toItem(a)) === JSON.stringify(toItem(b));
const blank = (r: Row) => !r.name.trim() && !r.price.trim() && !r.pickup.trim() && !r.upTo.trim();

function Editor({ pl, all, customers, assigned, onDuplicate }: { pl: PriceList; all: PriceList[]; customers: Customer[]; assigned: Customer[]; onDuplicate: () => void }) {
  const toast = useToast();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(pl.name);
  const [nameErr, setNameErr] = useState('');
  const [tab, setTab] = useState(PL_TABS[0]);
  const [rows, setRows] = useState<Row[]>(() => pl.items.map(toRow));
  const [draftKey, setDraftKey] = useState(newId);
  const [focusRow, setFocusRow] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState(pl.note ?? '');
  const [minP, setMinP] = useState(pl.minPizzas ? String(pl.minPizzas) : '');
  const tableRef = useRef<HTMLDivElement>(null);
  const server = useMemo(() => pl.items.map(toRow), [pl.items]);

  // שינוי מהשרת (משתמש אחר, או אחרי שמירה) – נטען כל עוד לא עורכים שורה
  useEffect(() => {
    if (focusRow) return;
    setRows(server);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server]);

  const save = async (next: Row[], msg?: string) => {
    const kept = next.filter((r) => !blank(r) && r.name.trim());
    setState('saving');
    try {
      await updatePriceList(pl, { items: kept.map(toItem) }, msg ? { after: { change: msg } } : undefined);
      setState('saved');
      return true;
    } catch { setState('error'); return false; }
  };

  const catRows = rows.filter((r) => r.category === tab);
  const draft: Row = { id: draftKey, category: tab, name: '', price: '', pickup: '', upTo: '', active: true };
  const shown = [...catRows, draft];
  const isDelivery = tab === DELIVERY_CAT;
  const dupOf = (r: Row) => r.name.trim() ? catRows.find((x) => x.id !== r.id && sameName(x.name, r.name)) : undefined;
  const problem = (r: Row) => {
    if (blank(r)) return '';
    if (!r.name.trim()) return isDelivery ? 'חסר שם למדרגה' : 'חסר שם מוצר';
    if (r.price.trim() && num(r.price) === undefined) return 'מחיר לא תקין';
    if (r.pickup.trim() && num(r.pickup) === undefined) return 'מחיר איסוף לא תקין';
    const d = dupOf(r);
    if (d) return `כבר יש בקטגוריה "${d.name}" – שם כפול`;
    return '';
  };

  const change = (id: string, patch: Partial<Row>) => {
    setRows((rs) => (rs.some((r) => r.id === id) ? rs.map((r) => (r.id === id ? { ...r, ...patch } : r)) : [...rs, { ...draft, id, ...patch }]));
    if (id === draftKey) setDraftKey(newId());
    setState('idle');
  };
  // יציאה משורה: שומרים אם השתנתה ואין בה בעיה
  const leaveRow = (id: string) => {
    setFocusRow(null);
    const r = rows.find((x) => x.id === id);
    if (!r) return;
    if (blank(r)) { if (server.some((s) => s.id === id)) save(rows.filter((x) => x.id !== id)); else setRows((rs) => rs.filter((x) => x.id !== id)); return; }
    if (problem(r) || same(r, server.find((s) => s.id === id))) return;
    save(rows, `${r.category} · ${r.name.trim()}${num(r.price) ? ` · ${fmtMoney(num(r.price)!)}` : ''}`);
  };
  const remove = async (r: Row) => {
    const before = rows;
    const next = rows.filter((x) => x.id !== r.id);
    setRows(next);
    if (await save(next, `הוסר: ${r.name}`)) {
      toast({ message: <>"{r.name || 'שורה'}" הוסר מהמחירון</>, onUndo: () => { setRows(before); save(before, `הוחזר: ${r.name}`); } });
    }
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const row = (e.target as HTMLElement).closest('[data-row], [data-draft]');
    const next = row?.nextElementSibling?.matches('[data-row], [data-draft]') ? row.nextElementSibling : tableRef.current?.querySelector('[data-draft]');
    if (next && next !== row) (next.querySelector('input[data-col="name"]') as HTMLInputElement | null)?.focus();
    else (e.target as HTMLInputElement).blur();
  };
  /* הדבקה מאקסל: כל שורה – שם, מחיר משלוח, מחיר איסוף (או עד כמה פריטים, במשלוח) */
  const onPaste = (e: ClipboardEvent<HTMLInputElement>, id: string) => {
    const text = e.clipboardData.getData('text');
    if (!/[\t\n]/.test(text.trim())) return;
    e.preventDefault();
    const lines = text.split(/\r?\n/).map((l) => l.split('\t').map((x) => x.trim())).filter((c) => c[0]);
    const added: Row[] = lines.map(([n, p = '', q = ''], i) => ({ ...draft, id: i === 0 ? id : newId(), name: n, price: p, ...(isDelivery ? { upTo: q } : { pickup: q }) }));
    const next = [...rows.filter((r) => r.id !== id), ...added.filter((a) => !catRows.some((r) => r.id !== id && sameName(r.name, a.name)))];
    setRows(next); setDraftKey(newId());
    save(next, `הודבקו ${added.length} שורות`).then((ok) => ok && toast({ message: <>נוספו <Ltr>{added.length}</Ltr> שורות מההדבקה</> }));
  };

  const saveNote = async () => {
    const m = minP.trim() ? Number(minP.replace(/\D/g, '')) || 0 : 0;
    if (note.trim() === (pl.note ?? '') && m === (pl.minPizzas ?? 0)) return;
    setState('saving');
    try { await updatePriceList(pl, { note: note.trim(), minPizzas: m }); setState('saved'); } catch { setState('error'); }
  };
  const rename = async () => {
    const d = all.find((x) => x.id !== pl.id && sameName(x.name, name));
    if (!name.trim() || d) { setNameErr(d ? `כבר קיים מחירון בשם "${d.name}"` : 'חובה: שם'); return; }
    await updatePriceList(pl, { name: name.trim() }); setRenaming(false); setNameErr(''); toast({ message: 'שם המחירון עודכן' });
  };
  const count = (c: string) => rows.filter((r) => r.category === c && r.name.trim()).length;
  const unpriced = catRows.filter((r) => r.name.trim() && !num(r.price)).length;

  return (
    <section className="card pled" aria-labelledby="h-pled">
      <div className="card__head br-branches__head">
        {renaming ? (
          <span className="name-editor__row pl-rename">
            <input className="input input--sm" autoFocus value={name} onChange={(e) => { setName(e.target.value); setNameErr(''); }} aria-label="שם המחירון"
              onKeyDown={(e) => { if (e.key === 'Escape') { setRenaming(false); setName(pl.name); setNameErr(''); } if (e.key === 'Enter') { e.preventDefault(); rename(); } }} />
            <button className="icon-btn icon-btn--sm" aria-label="שמור שם" onClick={rename}><Check size={16} /></button>
            <button className="icon-btn icon-btn--sm" aria-label="ביטול" onClick={() => { setRenaming(false); setName(pl.name); setNameErr(''); }}><X size={16} /></button>
          </span>
        ) : (
          <>
            <h2 id="h-pled" className="card__title">{pl.name}</h2>
            <button className="icon-btn icon-btn--sm" aria-label="שנה שם מחירון" onClick={() => setRenaming(true)}><Pencil size={15} /></button>
            {!pl.active && <span className="tag-inactive">לא פעיל</span>}
          </>
        )}
        <span className="card__head-end pl-head-actions">
          <span className={`pl-state pl-state--${state}`} aria-live="polite">{state === 'saving' ? 'שומר…' : state === 'saved' ? <><Check size={14} aria-hidden="true" /> נשמר</> : state === 'error' ? 'השמירה נכשלה – בדקו חיבור ונסו שוב' : ''}</span>
          <Button size="sm" icon={<Copy size={15} />} onClick={onDuplicate}>שכפל</Button>
          <Button size="sm" variant="ghost" onClick={async () => { await updatePriceList(pl, { active: !pl.active }); toast({ message: pl.active ? 'המחירון סומן כלא פעיל – לא יוצע בהצעות ובהזמנות חדשות' : 'המחירון הופעל' }); }}>{pl.active ? 'סמן כלא פעיל' : 'הפעל'}</Button>
          <DeletePriceList pl={pl} assigned={assigned} />
        </span>
        {nameErr && <p className="pop__err pl-nameerr" role="alert">{nameErr}</p>}
      </div>

      {/* תנאי המחירון: מוצג כאזהרה בהצעה ובהזמנה, לא בדף שיוצא ללקוח */}
      <div className="pl-terms">
        <label className="pl-terms__note">
          <span className="field__label">תנאי המחירון <span className="muted">(לא חובה)</span></span>
          <input className="input input--sm" value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            placeholder="למשל: המחירים תקפים מ-10 פיצות משפחתיות ומעלה" />
        </label>
        <label className="pl-terms__min">
          <span className="field__label">מינימום פיצות</span>
          <input className="input input--sm input--ltr" inputMode="numeric" value={minP} onChange={(e) => setMinP(e.target.value.replace(/\D/g, ''))} onBlur={saveNote} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            placeholder="—" aria-describedby="pl-min-hint" />
        </label>
        <p id="pl-min-hint" className="pl-terms__hint">כשבהצעה יש פחות פיצות מהמינימום – מופיעה אזהרה. התנאי לא מופיע בדף שהלקוח מקבל.</p>
      </div>

      <div className="pl-body">
        <div className="ib-tabs" role="tablist" aria-label="קטגוריה">
          {PL_TABS.map((c) => (
            <button type="button" role="tab" key={c} aria-selected={tab === c} className={`ib-tab ${tab === c ? 'is-on' : ''} ${c === DELIVERY_CAT ? 'pl-tab--dlv' : ''}`} onClick={() => { setTab(c); setFocusRow(null); }}>
              {c}{count(c) > 0 && <span className="ib-tab__n"><Ltr>{count(c)}</Ltr></span>}
            </button>
          ))}
        </div>

        <div className={`ib-table plt ${isDelivery ? 'plt--dlv' : ''}`} role="group" aria-label={`מחירון ${pl.name} – ${tab}`} ref={tableRef}>
          <div className="plt-r plt-r--head" aria-hidden="true">
            <span>{isDelivery ? 'מדרגת משלוח' : 'מוצר'} <small>כמו שיופיע בהצעה</small></span>
            <span>{isDelivery ? 'דמי משלוח' : 'מחיר משלוח'} <small>₪ כולל מע"מ</small></span>
            <span>{isDelivery ? 'עד כמה פריטים' : 'מחיר איסוף'} <small>{isDelivery ? 'להצעה אוטומטית' : 'ריק = כמו משלוח'}</small></span>
            <span />
          </div>
          {shown.map((r) => {
            const isDraft = r.id === draftKey;
            const p = focusRow === r.id ? '' : problem(r);
            const label = r.name.trim() || (isDraft ? 'שורה חדשה' : 'שורה');
            return (
              <div key={r.id} className="plt-g" data-row={isDraft ? undefined : true} data-draft={isDraft || undefined}
                onFocus={() => setFocusRow(r.id)}
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) leaveRow(r.id); }}>
                <div className={`plt-r ${isDraft ? 'is-draft' : ''}`}>
                  <input className={`input input--sm ${p && !r.name.trim() ? 'is-invalid' : ''}`} data-col="name" value={r.name} onKeyDown={onKey} onPaste={(e) => onPaste(e, r.id)}
                    placeholder={isDraft ? (isDelivery ? 'למשל: משלוח עד 8 פריטים' : tab === 'פיצות' ? 'למשל: פיצה משפחתית עם תוספת' : tab === 'משקאות' ? 'למשל: שתייה גדולה' : 'שם המוצר') : ''}
                    onChange={(e) => change(r.id, { name: e.target.value })} aria-label={`${isDelivery ? 'מדרגת משלוח' : 'מוצר'} – ${label}`} />
                  <input className={`input input--sm input--ltr ${r.price.trim() && num(r.price) === undefined ? 'is-invalid' : ''}`} inputMode="decimal" value={r.price} onKeyDown={onKey} placeholder="—"
                    onChange={(e) => change(r.id, { price: e.target.value })} aria-label={`${isDelivery ? 'דמי משלוח' : 'מחיר משלוח'} – ${label}`} />
                  {isDelivery
                    ? <input className="input input--sm input--ltr" inputMode="numeric" value={r.upTo} onKeyDown={onKey} placeholder="—" onChange={(e) => change(r.id, { upTo: e.target.value.replace(/\D/g, '') })} aria-label={`עד כמה פריטים – ${label}`} />
                    : <input className={`input input--sm input--ltr ${r.pickup.trim() && num(r.pickup) === undefined ? 'is-invalid' : ''}`} inputMode="decimal" value={r.pickup} onKeyDown={onKey} placeholder={num(r.price) ? fmtMoney(num(r.price)!) : '—'}
                        onChange={(e) => change(r.id, { pickup: e.target.value })} aria-label={`מחיר איסוף – ${label}`} />}
                  {isDraft ? <span /> : <button type="button" className="icon-btn icon-btn--sm" aria-label={`הסר – ${label}`} onClick={() => remove(r)}><Trash2 size={15} /></button>}
                </div>
                {p && <p className="ib-err plt-err" role="alert">{p}</p>}
              </div>
            );
          })}
          <button type="button" className="ib-addrow" onClick={() => tableRef.current?.querySelector<HTMLInputElement>('[data-draft] input[data-col="name"]')?.focus()}>
            <Plus size={14} aria-hidden="true" /> שורה
          </button>
        </div>
        <p className="ib-foot">
          <span className="ib-hint">Enter – לשורה הבאה · כל שורה נשמרת כשיוצאים ממנה · אפשר להדביק כמה שורות מאקסל (שם, מחיר{isDelivery ? ', עד כמה פריטים' : ', מחיר איסוף'})</span>
          {unpriced > 0 && <span className="muted"><Ltr>{unpriced}</Ltr> בלי מחיר – ימולאו בהצעה</span>}
        </p>
      </div>

      <div className="pl-customers">
        <h3 className="pl-customers__title"><Users size={16} aria-hidden="true" /> לקוחות משויכים · <Ltr>{assigned.length}</Ltr>
          <Button size="sm" className="pl-customers__add" icon={<Plus size={15} />} onClick={() => setPicking(true)}>שייך לקוחות</Button>
        </h3>
        {assigned.length === 0 ? <p className="muted">אף לקוח לא משויך. לקוח משויך מקבל את המחירון הזה אוטומטית בהצעות ובהזמנות.</p> : (
          <ul className="pl-customers__list">
            {assigned.map((c) => (
              <li key={c.id} className="pl-cchip">
                <Link to={`/customers/${c.id}`}>{c.name}</Link>
                <button type="button" aria-label={`הסר את ${c.name} מהמחירון`} onClick={async () => {
                  try { await assignPriceList([c], '', pl.name); toast({ message: <>{c.name} הוסר מהמחירון</>, onUndo: () => assignPriceList([{ ...c, priceListId: '' }], pl.id, pl.name) }); }
                  catch { toast({ message: 'השמירה נכשלה – בדקו חיבור' }); }
                }}><X size={13} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {picking && <AssignDialog pl={pl} customers={customers} all={all} onClose={() => setPicking(false)} />}
    </section>
  );
}

/* ---------- שיוך לקוחות: חיפוש וסימון ---------- */
function AssignDialog({ pl, customers, all, onClose }: { pl: PriceList; customers: Customer[]; all: PriceList[]; onClose: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pool = customers.filter((c) => c.status === 'active' && c.priceListId !== pl.id);
  const shown = pool.filter((c) => !q.trim() || c.name.includes(q.trim())).slice(0, 80);
  const plName = (id: string) => all.find((p) => p.id === id)?.name;
  const moving = pool.filter((c) => sel.includes(c.id) && c.priceListId && plName(c.priceListId)).length;
  const go = async () => {
    if (!sel.length) return setErr('סמנו לפחות לקוח אחד');
    setBusy(true);
    try {
      await assignPriceList(pool.filter((c) => sel.includes(c.id)), pl.id, pl.name);
      toast({ message: <><Ltr>{sel.length}</Ltr> לקוחות שויכו ל"{pl.name}"</> });
      onClose();
    } catch { setErr('השמירה נכשלה – אין הרשאה או אין חיבור'); setBusy(false); }
  };
  return (
    <Shell title={`שיוך לקוחות ל"${pl.name}"`} sub="לקוח משויך מקבל את המחירון אוטומטית בהצעות מחיר ובהזמנות. ללקוח יש מחירון אחד – שיוך כאן מחליף מחירון קודם." onClose={onClose}>
      <div className="sdialog__form">
        <label className="tablebar__search pl-assign__search">
          <Search size={16} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש לקוח" aria-label="חיפוש לקוח" data-autofocus />
        </label>
        <ul className="pl-assign">
          {shown.map((c) => (
            <li key={c.id}>
              <label className="check-inline pl-assign__row">
                <input type="checkbox" checked={sel.includes(c.id)} onChange={(e) => { setErr(''); setSel((s) => (e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id))); }} />
                <span className="pl-assign__name">{c.name}</span>
                {c.priceListId && plName(c.priceListId) && <span className="muted">כרגע: {plName(c.priceListId)}</span>}
              </label>
            </li>
          ))}
          {shown.length === 0 && <li className="muted">{q ? `לא נמצא לקוח "${q}"` : 'כל הלקוחות הפעילים כבר משויכים למחירון הזה'}</li>}
        </ul>
        {moving > 0 && <p className="sdialog__warn"><Users size={16} aria-hidden="true" /> <span><Ltr>{moving}</Ltr> מהלקוחות שסימנתם יעברו ממחירון אחר</span></p>}
        {err && <span className="cform__err" role="alert">{err}</span>}
        <div className="udialog__actions">
          <Button variant="primary" loading={busy} onClick={go}>{sel.length ? `שייך ${sel.length} לקוחות` : 'שייך'}</Button>
          <Button variant="ghost" onClick={onClose}>ביטול</Button>
        </div>
      </div>
    </Shell>
  );
}

/* ---------- שכפול: עותק של המחירון, ואפשר לשנות את כל המחירים באחוז ---------- */
function DuplicateDialog({ from, all, onClose, onDone }: { from: PriceList; all: PriceList[]; onClose: () => void; onDone: (id: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState(`עותק של ${from.name}`);
  const [pct, setPct] = useState('');
  const [round, setRound] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const p = pct.trim() ? Number(pct.replace(/[^\d.-]/g, '')) : 0;
  const adj = (v?: number) => (v === undefined ? undefined : round ? Math.round(v * (1 + p / 100)) : Math.round(v * (1 + p / 100) * 100) / 100);
  const go = async () => {
    if (!name.trim()) return setErr('חובה: שם המחירון');
    const similar = all.find((x) => sameName(x.name, name));
    if (similar) return setErr(`כבר קיים מחירון בשם הזה: "${similar.name}"`);
    if (!Number.isFinite(p) || p <= -100 || p > 300) return setErr('אחוז לא תקין – למשל 10 או ‎-5');
    setBusy(true);
    try {
      const id = await createPriceList(name, from.items.map((i) => ({ ...i, id: newId(), price: adj(i.price), pickupPrice: adj(i.pickupPrice) })), { note: from.note, minPizzas: from.minPizzas });
      toast({ message: <>נוצר "{name.trim()}"{p ? <> · המחירים שונו ב-<Ltr>{`${p}%`}</Ltr></> : null}</> });
      onDone(id);
    } catch { setErr('השמירה נכשלה – אין הרשאה או אין חיבור'); setBusy(false); }
  };
  const sample = from.items.find((i) => i.price);
  return (
    <Shell title={`שכפול "${from.name}"`} sub="כל המוצרים והמדרגות עוברים לעותק. לקוחות לא עוברים – משייכים אותם לעותק אחר כך." onClose={onClose}>
      <form className="sdialog__form" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <label className="field"><span className="field__label">שם המחירון החדש</span>
          <input className="input" value={name} onChange={(e) => { setName(e.target.value); setErr(''); }} data-autofocus />
        </label>
        <label className="field"><span className="field__label">שינוי כל המחירים באחוז <span className="muted">(לא חובה)</span></span>
          <input className="input input--ltr pl-dup__pct" inputMode="decimal" value={pct} onChange={(e) => { setPct(e.target.value); setErr(''); }} placeholder="למשל 10 או ‎-5" />
        </label>
        <label className="check-inline"><input type="checkbox" checked={round} onChange={(e) => setRound(e.target.checked)} /> לעגל לשקל שלם</label>
        {p !== 0 && sample && <p className="muted">לדוגמה: {sample.name} <Ltr>{fmtMoney(sample.price!)}</Ltr> ← <Ltr>{fmtMoney(adj(sample.price)!)}</Ltr></p>}
        {err && <span className="cform__err" role="alert">{err}</span>}
        <div className="udialog__actions"><Button variant="primary" type="submit" loading={busy}>צור עותק</Button><Button variant="ghost" type="button" onClick={onClose}>ביטול</Button></div>
      </form>
    </Shell>
  );
}

/* מחיקת מחירון – מנהל מערכת בלבד, עם סיבה. לקוחות משויכים נשארים בלי מחירון; הזמנות והצעות קיימות לא משתנות */
function DeletePriceList({ pl, assigned }: { pl: PriceList; assigned: Customer[] }) {
  const { isAdmin } = useAuth();
  const [, setParams] = useSearchParams();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!isAdmin) return null;
  const go = async () => {
    if (reason.trim().length < 3) return setErr('חובה: סיבת המחיקה');
    setBusy(true);
    try {
      await deletePriceList(pl, assigned, reason);
      setOpen(false);
      setParams((p) => { const n = new URLSearchParams(p); n.delete('id'); return n; }, { replace: true });
      toast({ message: <>המחירון "{pl.name}" נמחק{assigned.length ? <> · <Ltr>{assigned.length}</Ltr> לקוחות נשארו בלי מחירון</> : null}</> });
    } catch { setErr('המחיקה נכשלה – אין הרשאה או אין חיבור'); setBusy(false); }
  };
  return (
    <>
      <Button size="sm" variant="ghost" className="pl-delete" icon={<Trash2 size={15} />} onClick={() => setOpen(true)}>מחק</Button>
      {open && (
        <Shell title={`מחיקת המחירון "${pl.name}"`} sub={<>המחירון והמוצרים שלו יימחקו. הזמנות והצעות קיימות לא משתנות – המחיר שמור בתוכן. ביומן תישאר רשומה עם הסיבה.</>} onClose={() => setOpen(false)}>
          <form className="sdialog__form" onSubmit={(e) => { e.preventDefault(); go(); }}>
            {assigned.length > 0 && (
              <p className="sdialog__warn">
                <Users size={16} aria-hidden="true" />
                <span><Ltr>{assigned.length}</Ltr> לקוחות משויכים למחירון ויישארו בלי מחירון: {assigned.slice(0, 5).map((c) => c.name).join(', ')}{assigned.length > 5 ? '…' : ''}</span>
              </p>
            )}
            <label className="field"><span className="field__label">סיבת המחיקה <span className="req">חובה</span></span>
              <input className="input" autoFocus value={reason} onChange={(e) => { setReason(e.target.value); setErr(''); }} placeholder="למשל: מחירון ישן, הוחלף במחירון 2027" />
            </label>
            {err && <span className="cform__err" role="alert">{err}</span>}
            <div className="udialog__actions"><Button variant="danger" type="submit" loading={busy}>מחק מחירון</Button><Button variant="ghost" type="button" onClick={() => setOpen(false)}>ביטול</Button></div>
          </form>
        </Shell>
      )}
    </>
  );
}
