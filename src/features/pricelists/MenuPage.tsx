/* עורך התפריט (מנהל בלבד): עץ עם שלבים קבועים, ולידו תצוגה חיה של הבוחר כפי שהנציג יראה אותו.
   בלי מחירים – אלה במחירונים. משנים בטיוטה ושומרים פעם אחת. בהזמנות עוד לא משתנה כלום (הבוחר – שלב 7ג). */
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, ChevronUp, Lock, Pencil, Plus, RotateCcw, Save, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import {
  DEFAULT_MENU, STEP_LABEL, SYSTEM_CATEGORIES, menuProblem, newMenuId, saveMenu, useMenu,
  type Menu, type MenuCategory, type MenuItem, type MenuOption, type MenuSteps,
} from '../../data/menu';
import { Button, Skeleton } from '../../design/components';
import { useToast } from '../../design/Toast';
import '../pages.css';
import '../settings/ListsPage.css';
import './MenuPage.css';

const sig = (m: Menu) => JSON.stringify(m);

export function MenuPage() {
  const { isAdmin } = useAuth();
  const { menu, saved, loading, error } = useMenu();
  const toast = useToast();
  const [draft, setDraft] = useState<Menu>(menu);
  const [base, setBase] = useState(sig(menu));
  const [catId, setCatId] = useState(menu.categories[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const dirty = sig(draft) !== base;
  const serverSig = sig(menu);
  const stale = dirty && serverSig !== base; // מנהל אחר שמר בזמן שערכתי
  // נטען / עודכן בשרת – מתעדכנים רק כשאין שינויים שלא נשמרו (אחרת לא דורסים את העבודה)
  useEffect(() => { if (!dirty) { setDraft(menu); setBase(serverSig); } }, [serverSig, dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!draft.categories.some((c) => c.id === catId)) setCatId(draft.categories[0]?.id ?? ''); }, [draft, catId]);
  // יציאה מהדף עם שינויים שלא נשמרו – הדפדפן שואל
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  if (!isAdmin) return <Navigate to="/pricelists" replace />;
  const cat = draft.categories.find((c) => c.id === catId);
  const setCat = (patch: Partial<MenuCategory>) => setDraft((d) => ({ categories: d.categories.map((c) => (c.id === catId ? { ...c, ...patch } : c)) }));
  const problem = menuProblem(draft);

  const save = async () => {
    if (problem) { setErr(problem); return; }
    if (stale) { setErr('מנהל אחר שמר את התפריט בזמן שערכת – טענו את הגרסה החדשה לפני שמירה'); return; }
    setBusy(true); setErr('');
    try { await saveMenu(draft, menu); setBase(sig(draft)); toast({ message: 'התפריט נשמר' }); }
    catch { setErr('השמירה נכשלה – רק מנהל מערכת יכול לשנות את התפריט'); }
    setBusy(false);
  };

  return (
    <div className="page menu-ed">
      <Link className="auth__back" to="/pricelists"><ArrowRight size={16} aria-hidden="true" /> מחירונים</Link>
      <header className="page__head">
        <div>
          <h1 className="page__title">תפריט</h1>
          <p className="page__sub">קטגוריות, סוגים ושלבי בחירה</p>
        </div>
        <div className="page__head-end">
          {dirty && <Button variant="ghost" icon={<RotateCcw size={16} />} onClick={() => { setDraft(menu); setBase(serverSig); setErr(''); }}>{stale ? 'טען את הגרסה החדשה' : 'בטל שינויים'}</Button>}
          <Button variant="primary" icon={<Save size={16} />} loading={busy} disabled={!dirty && saved} onClick={save}>{dirty || !saved ? 'שמור תפריט' : 'נשמר'}</Button>
        </div>
      </header>
      {error && <p className="cform__formerr" role="alert">{error}</p>}
      {err && <p className="cform__formerr" role="alert">{err}</p>}
      {stale && !err && <p className="cform__formerr" role="status">מנהל אחר שמר את התפריט בזמן שערכת</p>}

      {loading ? <div className="card"><Skeleton h={200} /></div> : (
        <div className="menu-ed__grid">
          {/* עץ הקטגוריות */}
          <div className="card menu-ed__tree" role="region" aria-label="עץ התפריט">
            <OptionList
              title="קטגוריות" items={draft.categories} selected={catId} onSelect={setCatId} addLabel="קטגוריה חדשה"
              onChange={(cats) => setDraft({ categories: cats as MenuCategory[] })}
              make={(name) => ({ id: newMenuId(), name, active: true, steps: { variation: false, toppingKind: false, toppingText: false, split: false }, items: [], toppingKinds: [] })}
              meta={(c) => `${(c as MenuCategory).items.length} סוגים`}
            />
            <ul className="menu-ed__sys" aria-label="קטגוריות מערכת">
              {SYSTEM_CATEGORIES.map((s) => <li key={s.id}><Lock size={14} aria-hidden="true" /> {s.name}</li>)}
            </ul>
          </div>

          {/* הקטגוריה שנבחרה */}
          {cat ? (
            <section className="card menu-ed__cat" aria-labelledby="menu-cat-h">
              <h2 id="menu-cat-h" className="menu-ed__h">{cat.name || 'קטגוריה בלי שם'}{!cat.active && <span className="tag-inactive">לא פעילה</span>}</h2>
              <fieldset className="menu-ed__steps">
                <legend className="menu-ed__k">שלבי הבחירה</legend>
                {(Object.keys(STEP_LABEL) as (keyof MenuSteps)[]).map((k) => (
                  <label key={k} className="menu-ed__step">
                    <input type="checkbox" checked={cat.steps[k]} onChange={(e) => setCat({ steps: { ...cat.steps, [k]: e.target.checked } })} />
                    <span><b>{STEP_LABEL[k].title}</b></span>
                  </label>
                ))}
              </fieldset>
              <OptionList key={`items-${cat.id}`} title="סוגים" items={cat.items} addLabel="סוג חדש"
                onChange={(items) => setCat({ items: items as MenuItem[] })}
                make={(name) => ({ id: newMenuId(), name, active: true, variations: [] })}
                expand={cat.steps.variation ? (it, update) => (
                  <OptionList compact title={`וריאציות של ${it.name}`} items={(it as MenuItem).variations} addLabel="וריאציה"
                    onChange={(vs) => update({ ...(it as MenuItem), variations: vs })} make={(name) => ({ id: newMenuId(), name, active: true })} />
                ) : undefined}
                meta={(it) => (cat.steps.variation && (it as MenuItem).variations.length ? `${(it as MenuItem).variations.length} וריאציות` : '')}
              />
              {cat.steps.toppingKind && (
                <OptionList key={`tk-${cat.id}`} title="סוגי תוספת" items={cat.toppingKinds} addLabel="סוג תוספת"
                  onChange={(tk) => setCat({ toppingKinds: tk })} make={(name) => ({ id: newMenuId(), name, active: true })} />
              )}
            </section>
          ) : <section className="card menu-ed__cat"><p className="muted">אין קטגוריות. הוסיפו קטגוריה ברשימה.</p></section>}

          {/* תצוגה חיה של הבוחר */}
          <PickerPreview menu={draft} catId={catId} onCat={setCatId} />
        </div>
      )}
      {!loading && !saved && <p className="menu-ed__foot"><button type="button" className="link" onClick={() => setDraft(DEFAULT_MENU)}>חזרה לברירת המחדל</button></p>}
    </div>
  );
}

/* רשימה עם שינוי שם, השבתה, הזזה בחצים והוספה – אותה התנהגות בקטגוריות, סוגים, וריאציות וסוגי תוספת */
function OptionList<T extends MenuOption>({ title, items, onChange, make, addLabel, selected, onSelect, meta, expand, compact }: {
  title: string; items: T[]; onChange: (next: T[]) => void; make: (name: string) => T; addLabel: string;
  selected?: string; onSelect?: (id: string) => void; meta?: (it: T) => string;
  expand?: (it: T, update: (next: T) => void) => React.ReactNode; compact?: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const update = (id: string, patch: Partial<T>) => onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const move = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= items.length) return; const n = [...items]; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  const add = () => { const v = adding.trim(); if (!v) return; const it = make(v); onChange([...items, it]); setAdding(''); onSelect?.(it.id); };
  return (
    <div className={`menu-ed__list ${compact ? 'is-compact' : ''}`}>
      <p className="menu-ed__k">{title}</p>
      <ul className="litems">
        {items.map((it, i) => (
          <li key={it.id} className={`litem ${it.active ? '' : 'is-inactive'} ${selected === it.id ? 'is-selected' : ''}`}>
            {editing === it.id ? (
              <span className="litem__edit">
                <input className="input input--sm" autoFocus value={name} maxLength={40} aria-label={`שם חדש ל${it.name}`}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (name.trim()) update(it.id, { name: name.trim() } as Partial<T>); setEditing(null); } }} />
                <button className="icon-btn icon-btn--sm icon-btn--ok" aria-label="שמור שם" onClick={() => { if (name.trim()) update(it.id, { name: name.trim() } as Partial<T>); setEditing(null); }}><Check size={16} /></button>
                <button className="icon-btn icon-btn--sm" aria-label="ביטול" onClick={() => setEditing(null)}><X size={16} /></button>
              </span>
            ) : (
              <>
                {onSelect
                  ? <button type="button" className="litem__label menu-ed__pick" aria-current={selected === it.id ? 'true' : undefined} onClick={() => onSelect(it.id)}>{it.name}</button>
                  : <span className="litem__label">{it.name}</span>}
                {meta?.(it) && <span className="muted menu-ed__meta">{meta(it)}</span>}
                {!it.active && <span className="tag-inactive">לא פעיל</span>}
                <span className="litem__actions">
                  {expand && <button type="button" className="link menu-ed__exp" aria-expanded={open === it.id} aria-label={`וריאציות של ${it.name}`} onClick={() => setOpen(open === it.id ? null : it.id)}>וריאציות</button>}
                  <button className="icon-btn icon-btn--sm" aria-label={`הזז למעלה: ${it.name}`} disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp size={14} /></button>
                  <button className="icon-btn icon-btn--sm" aria-label={`הזז למטה: ${it.name}`} disabled={i === items.length - 1} onClick={() => move(i, 1)}><ChevronDown size={14} /></button>
                  <button className="icon-btn icon-btn--sm" aria-label={`שנה שם: ${it.name}`} onClick={() => { setEditing(it.id); setName(it.name); }}><Pencil size={14} /></button>
                  <button className="litem__toggle" aria-label={`${it.active ? 'השבת' : 'הפעל'}: ${it.name}`} onClick={() => update(it.id, { active: !it.active } as Partial<T>)}>{it.active ? 'השבת' : 'הפעל'}</button>
                </span>
              </>
            )}
            {expand && open === it.id && <div className="menu-ed__sub">{expand(it, (next) => onChange(items.map((x) => (x.id === it.id ? next : x))))}</div>}
          </li>
        ))}
        {items.length === 0 && <li className="litem muted">עוד אין</li>}
      </ul>
      <form className="ladd" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input className="input input--sm" value={adding} maxLength={40} onChange={(e) => setAdding(e.target.value)} placeholder={addLabel} aria-label={addLabel} />
        <Button size="sm" type="submit" icon={<Plus size={16} />} disabled={!adding.trim()}>הוסף</Button>
      </form>
    </div>
  );
}

/* איך הנציג יראה את הבוחר – לפי הטיוטה, בלי לשמור כלום. שלב שכבוי לא מופיע; וריאציה – רק לסוג שהוגדרו לו */
function PickerPreview({ menu, catId, onCat }: { menu: Menu; catId: string; onCat: (id: string) => void }) {
  const cats = menu.categories.filter((c) => c.active);
  const cat = cats.find((c) => c.id === catId) ?? cats[0];
  const items = cat?.items.filter((i) => i.active) ?? [];
  const [itemId, setItemId] = useState('');
  const [varId, setVarId] = useState('');
  const [tk, setTk] = useState('');
  const [split, setSplit] = useState('שלם');
  const item = items.find((i) => i.id === itemId);
  useEffect(() => { setItemId(''); setVarId(''); setTk(''); }, [cat?.id]);
  const vars = useMemo(() => (cat?.steps.variation ? item?.variations.filter((v) => v.active) ?? [] : []), [cat, item]);
  const kinds = cat?.steps.toppingKind ? cat.toppingKinds.filter((t) => t.active) : [];
  const withText = cat?.steps.toppingText && (!cat.steps.toppingKind || (!!tk && tk !== 'without'));
  return (
    <aside className="card menu-ed__preview" aria-label="תצוגה חיה של הבוחר">
      <p className="menu-ed__k">תצוגה חיה</p>
      <div className="mpv">
        <div className="mpv__cats" role="group" aria-label="קטגוריות בתצוגה">
          {cats.map((c) => <button key={c.id} type="button" aria-pressed={c.id === cat?.id} className={c.id === cat?.id ? 'is-on' : ''} onClick={() => onCat(c.id)}>{c.name}</button>)}
          {SYSTEM_CATEGORIES.map((s) => <span key={s.id} className="mpv__sys">{s.name}</span>)}
        </div>
        {cat && (
          <div className="mpv__tray">
            <Row label="סוג">{items.length ? items.map((i) => <Opt key={i.id} on={i.id === itemId} onClick={() => { setItemId(i.id); setVarId(''); }}>{i.name}</Opt>) : <span className="muted">אין סוגים</span>}</Row>
            {vars.length > 0 && <Row label="וריאציה">{vars.map((v) => <Opt key={v.id} on={v.id === varId} onClick={() => setVarId(v.id)}>{v.name}</Opt>)}</Row>}
            {kinds.length > 0 && <Row label="סוג תוספת">{kinds.map((k) => <Opt key={k.id} on={k.id === tk} onClick={() => setTk(k.id)}>{k.name}</Opt>)}</Row>}
            {withText && <Row label="תוספות"><input className="input input--sm" placeholder="טקסט חופשי" aria-label="תוספות (תצוגה)" /></Row>}
            {cat.steps.split && <Row label="חלוקה">{['שלם', 'חצי', 'רבע'].map((s) => <Opt key={s} on={s === split} onClick={() => setSplit(s)}>{s}</Opt>)}</Row>}
            <Row label="כמות ומחיר"><span className="mpv__qty">1</span><span className="muted">₪—</span></Row>
          </div>
        )}
      </div>
    </aside>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mpv__row"><span className="mpv__label">{label}</span><span className="mpv__opts">{children}</span></div>;
}
function Opt({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={`mpv__opt ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={onClick}>{children}</button>;
}
