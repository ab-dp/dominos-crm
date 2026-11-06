/* סניפים ואשכולות (אפיון 6.10): שתי רשימות זו לצד זו. לחיצה על אשכול מסננת את הסניפים שלו.
   עריכה בתוך השורה: Enter שומר, Esc מבטל. אין מחיקה – רק "לא פעיל". */
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Layers, Pencil, Plus, Search, Store, X } from 'lucide-react';
import { addBranch, addCluster, updateBranch, updateCluster, useBranches, useClusters, type Branch, type Cluster } from '../../data/branches';
import { Button, EmptyState, Skeleton, Tip } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr } from '../../lib/format';
import { findSimilar } from '../../lib/names';
import '../pages.css';
import './BranchesPage.css';

export function BranchesPage() {
  const clusters = useClusters();
  const branches = useBranches();
  const [selected, setSelected] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [query, setQuery] = useState('');

  const countBy = useMemo(() => {
    const m: Record<string, number> = {};
    branches.items.forEach((b) => { if (b.active) m[b.clusterId] = (m[b.clusterId] ?? 0) + 1; });
    return m;
  }, [branches.items]);

  const visibleBranches = branches.items
    .filter((b) => showInactive || b.active)
    .filter((b) => !selected || b.clusterId === selected)
    .filter((b) => !query.trim() || b.name.includes(query.trim()) || (!!query.trim() && (b.number ?? '').includes(query.trim())));

  const error = clusters.error || branches.error;

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">סניפים ואשכולות</h1>
          <p className="page__sub">סניף לא פעיל לא מופיע בבחירה בהזמנות חדשות.</p>
        </div>
      </header>

      {error ? <div className="card"><EmptyState icon={<Store size={24} />} title="לא ניתן לטעון">{error}. ודא שכללי האבטחה פורסמו.</EmptyState></div> : (
        <div className="br-grid">
          <ClustersCard
            clusters={clusters.items}
            loading={clusters.loading}
            countBy={countBy}
            selected={selected}
            onSelect={setSelected}
          />
          <BranchesCard
            clusters={clusters.items}
            allBranches={branches.items}
            branches={visibleBranches}
            loading={branches.loading}
            selected={selected}
            onClearSelected={() => setSelected(null)}
            showInactive={showInactive}
            setShowInactive={setShowInactive}
            query={query}
            setQuery={setQuery}
          />
        </div>
      )}
    </div>
  );
}

/* ================= אשכולות ================= */
function ClustersCard({ clusters, loading, countBy, selected, onSelect }: {
  clusters: Cluster[]; loading: boolean; countBy: Record<string, number>; selected: string | null; onSelect: (id: string | null) => void;
}) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const total = Object.values(countBy).reduce((a, b) => a + b, 0);

  const saveNew = async (name: string) => {
    const id = await addCluster(name);
    setAdding(false);
    onSelect(id);
    toast({ message: <>אשכול "{name}" נוסף</> });
  };

  return (
    <section className="card br-clusters" aria-labelledby="h-clusters">
      <div className="card__head">
        <Layers size={18} aria-hidden="true" className="muted" />
        <h2 id="h-clusters" className="card__title">אשכולות</h2>
        <span className="muted"><Ltr>{clusters.filter((c) => c.active).length}</Ltr></span>
        <Button size="sm" variant="secondary" icon={<Plus size={16} />} className="card__head-end" onClick={() => setAdding(true)} disabled={adding}>אשכול</Button>
      </div>
      <ul className="clist" role="list">
        <AnimatePresence initial={false}>
          {adding && (
            <motion.li key="new" initial={reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <NameEditor
                placeholder="שם האשכול, למשל צפון"
                list={clusters}
                kind="אשכול"
                onSave={saveNew}
                onCancel={() => setAdding(false)}
                onPickExisting={(c) => { setAdding(false); onSelect(c.id); }}
              />
            </motion.li>
          )}
        </AnimatePresence>
        <li>
          <button className={`citem ${selected === null ? 'is-on' : ''}`} aria-pressed={selected === null} onClick={() => onSelect(null)}>
            <span className="citem__name">כל האשכולות</span>
            <span className="citem__count"><Ltr>{total}</Ltr> סניפים</span>
          </button>
        </li>
        {loading ? [0, 1, 2].map((i) => <li key={i} className="citem-skel"><Skeleton h={18} /></li>) : clusters.map((c) => (
          <li key={c.id} className={c.active ? '' : 'is-inactive'}>
            {editing === c.id ? (
              <NameEditor
                initial={c.name}
                list={clusters}
                excludeId={c.id}
                kind="אשכול"
                onSave={async (name) => { await updateCluster(c, { name }); setEditing(null); toast({ message: 'שם האשכול עודכן' }); }}
                onCancel={() => setEditing(null)}
                onPickExisting={() => setEditing(null)}
              />
            ) : (
              <div className="citem-row">
                <button className={`citem ${selected === c.id ? 'is-on' : ''}`} aria-pressed={selected === c.id} onClick={() => onSelect(selected === c.id ? null : c.id)}>
                  <span className="citem__name">{c.name}</span>
                  {!c.active && <span className="tag-inactive">לא פעיל</span>}
                  <span className="citem__count"><Ltr>{countBy[c.id] ?? 0}</Ltr> סניפים</span>
                </button>
                <Tip label="שנה שם">
                  <button className="icon-btn icon-btn--sm" aria-label={`שנה שם לאשכול ${c.name}`} onClick={() => setEditing(c.id)}><Pencil size={15} /></button>
                </Tip>
                <ActiveSwitch
                  active={c.active}
                  label={`אשכול ${c.name}`}
                  onChange={async (active) => {
                    await updateCluster(c, { active });
                    toast({ message: <>אשכול "{c.name}" {active ? 'הופעל' : 'סומן כלא פעיל'}</>, onUndo: () => updateCluster({ ...c, active }, { active: !active }) });
                  }}
                />
              </div>
            )}
          </li>
        ))}
        {!loading && clusters.length === 0 && !adding && (
          <li className="clist__empty">
            עוד אין אשכולות. <button className="link" onClick={() => setAdding(true)}>הוסף את הראשון</button>
          </li>
        )}
      </ul>
    </section>
  );
}

/* ================= סניפים ================= */
function BranchesCard({ clusters, allBranches, branches, loading, selected, onClearSelected, showInactive, setShowInactive, query, setQuery }: {
  clusters: Cluster[]; allBranches: Branch[]; branches: Branch[]; loading: boolean; selected: string | null; onClearSelected: () => void;
  showInactive: boolean; setShowInactive: (v: boolean) => void; query: string; setQuery: (v: string) => void;
}) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const clusterName = (id: string) => clusters.find((c) => c.id === id)?.name ?? '—';
  const selectedName = selected ? clusterName(selected) : '';
  const activeClusters = clusters.filter((c) => c.active);

  return (
    <section className="card br-branches" aria-labelledby="h-branches">
      <div className="card__head br-branches__head">
        <Store size={18} aria-hidden="true" className="muted" />
        <h2 id="h-branches" className="card__title">סניפים</h2>
        {selected && (
          <button className="chip is-on" onClick={onClearSelected} aria-label={`הסר סינון אשכול ${selectedName}`}>אשכול {selectedName} <X size={14} aria-hidden="true" /></button>
        )}
        <label className="tablebar__search br-search">
          <Search size={16} aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש לפי שם או מספר סניף" aria-label="חיפוש סניף" />
        </label>
        <label className="check-inline">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> הצג לא פעילים
        </label>
        <Tip label={activeClusters.length === 0 ? 'קודם צריך להוסיף אשכול' : 'סניף חדש'}>
          <span>
            <Button size="sm" variant="primary" icon={<Plus size={16} />} onClick={() => { setAdding(true); setEditing(null); }} disabled={adding || activeClusters.length === 0}>סניף</Button>
          </span>
        </Tip>
      </div>

      <div className="otable-wrap br-table-wrap">
        <table className="otable otable--dense br-table">
          <caption className="sr-only">סניפים{selected ? ` באשכול ${selectedName}` : ''}</caption>
          <thead>
            <tr><th>שם הסניף</th><th>מספר סניף</th><th>אשכול</th><th>מצב</th><th><span className="sr-only">פעולות</span></th></tr>
          </thead>
          <tbody>
            {adding && (
              <BranchEditRow
                key="new"
                clusters={activeClusters}
                allBranches={allBranches}
                initial={{ name: query.trim(), clusterId: selected ?? activeClusters[0]?.id ?? '', number: '' }}
                onSave={async (v) => { await addBranch(v); setAdding(false); toast({ message: <>סניף "{v.name}" נוסף לאשכול {clusterName(v.clusterId)}</> }); }}
                onCancel={() => setAdding(false)}
              />
            )}
            {loading ? [0, 1, 2, 3].map((i) => <tr key={i}><td colSpan={5}><Skeleton h={18} /></td></tr>) : branches.map((b) => (
              editing === b.id ? (
                <BranchEditRow
                  key={b.id}
                  clusters={clusters.filter((c) => c.active || c.id === b.clusterId)}
                  allBranches={allBranches}
                  excludeId={b.id}
                  initial={{ name: b.name, clusterId: b.clusterId, number: b.number ?? '' }}
                  onSave={async (v) => {
                    const patch: Partial<Branch> = {};
                    if (v.name !== b.name) patch.name = v.name;
                    if (v.clusterId !== b.clusterId) patch.clusterId = v.clusterId;
                    if (v.number !== (b.number ?? '')) patch.number = v.number;
                    if (Object.keys(patch).length) {
                      await updateBranch(b, patch);
                      toast({ message: patch.clusterId ? <>"{v.name}" הועבר לאשכול {clusterName(v.clusterId)} · משפיע רק על הזמנות חדשות</> : 'הסניף עודכן' });
                    }
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <tr key={b.id} className={`brow ${b.active ? '' : 'is-inactive'}`} tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter') { e.preventDefault(); setEditing(b.id); setAdding(false); }
                    if (e.key === 'ArrowDown') { e.preventDefault(); (e.currentTarget.nextElementSibling as HTMLElement | null)?.focus(); }
                    if (e.key === 'ArrowUp') { e.preventDefault(); (e.currentTarget.previousElementSibling as HTMLElement | null)?.focus(); }
                  }}
                  aria-label={`${b.name}, אשכול ${clusterName(b.clusterId)}${b.active ? '' : ', לא פעיל'}. Enter לעריכה`}>
                  <td className="strong">{b.name}</td>
                  <td className="num">{b.number ? <Ltr>{b.number}</Ltr> : <span className="muted">—</span>}</td>
                  <td><span className="cluster-tag">{clusterName(b.clusterId)}</span></td>
                  <td>
                    <ActiveSwitch active={b.active} label={`סניף ${b.name}`} onChange={async (active) => {
                      await updateBranch(b, { active });
                      toast({ message: <>"{b.name}" {active ? 'הופעל' : 'סומן כלא פעיל – לא יופיע בהזמנות חדשות'}</>, onUndo: () => updateBranch({ ...b, active }, { active: !active }) });
                    }} />
                  </td>
                  <td className="br-actions">
                    <Button size="sm" variant="ghost" icon={<Pencil size={15} />} onClick={() => { setEditing(b.id); setAdding(false); }} aria-label={`ערוך את ${b.name}`}>ערוך</Button>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
        {!loading && branches.length === 0 && !adding && (
          <EmptyState icon={<Store size={24} />} title={query ? 'לא נמצא סניף מתאים' : selected ? `אין עדיין סניפים באשכול ${selectedName}` : 'עוד אין סניפים'}
            action={activeClusters.length > 0 ? <Button variant="primary" icon={<Plus size={18} />} onClick={() => setAdding(true)}>הוסף סניף</Button> : undefined}>
            {activeClusters.length === 0 ? 'מתחילים מהוספת אשכול ברשימה מימין, ואז מוסיפים לו סניפים.' : 'סניף חדש דורש שם ואשכול; מספר סניף – לא חובה.'}
          </EmptyState>
        )}
      </div>
    </section>
  );
}

/* שורת עריכה של סניף: Enter שומר, Esc מבטל, בדיקת כפילות לפני שמירה */
function BranchEditRow({ clusters, allBranches, excludeId, initial, onSave, onCancel }: {
  clusters: Cluster[]; allBranches: Branch[]; excludeId?: string;
  initial: { name: string; clusterId: string; number: string };
  onSave: (v: { name: string; clusterId: string; number: string }) => Promise<void>; onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [clusterId, setClusterId] = useState(initial.clusterId);
  const [number, setNumber] = useState(initial.number);
  const [err, setErr] = useState('');
  const [dupe, setDupe] = useState<Branch | null>(null);
  const [busy, setBusy] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  const submit = async (force = false) => {
    if (!name.trim()) { setErr('חובה: שם הסניף'); firstRef.current?.focus(); return; }
    if (!clusterId) { setErr('חובה: אשכול'); return; }
    const num = number.trim();
    if (num && !/^\d{1,10}$/.test(num)) { setErr('מספר סניף – ספרות בלבד'); return; }
    const sameNum = num ? allBranches.find((b) => b.id !== excludeId && (b.number ?? '') === num) : undefined;
    if (sameNum) { setErr(`מספר סניף ${num} כבר שייך ל"${sameNum.name}"`); return; }
    const similar = findSimilar(name, allBranches, excludeId);
    if (similar && !force) { setDupe(similar); return; }
    setBusy(true);
    try { await onSave({ name: name.trim(), clusterId, number: num }); }
    catch { setErr('השמירה נכשלה – אין הרשאה או אין חיבור'); setBusy(false); }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
  };

  return (
    <>
      <tr className="brow brow--edit" onKeyDown={onKey}>
        <td><input ref={firstRef} autoFocus className="input input--sm" value={name} onChange={(e) => { setName(e.target.value); setErr(''); setDupe(null); }} aria-label="שם הסניף (חובה)" placeholder="עיר – רחוב" /></td>
        <td><input className="input input--sm input--ltr br-num" inputMode="numeric" value={number} onChange={(e) => { setNumber(e.target.value); setErr(''); }} aria-label="מספר סניף (לא חובה)" placeholder="123" /></td>
        <td>
          <select className="input input--sm" value={clusterId} onChange={(e) => { setClusterId(e.target.value); setErr(''); }} aria-label="אשכול (חובה)">
            {clusters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </td>
        <td colSpan={2} className="br-actions">
          <Button size="sm" variant="primary" icon={<Check size={15} />} loading={busy} onClick={() => submit()}>שמור</Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>ביטול</Button>
        </td>
      </tr>
      {(err || dupe) && (
        <tr className="brow-msg"><td colSpan={5}>
          {err && <p className="pop__err" role="alert">{err}</p>}
          {dupe && (
            <DupePrompt existing={dupe.name} kind="סניף" onUseExisting={onCancel} onCreateAnyway={() => { setDupe(null); submit(true); }} />
          )}
        </td></tr>
      )}
    </>
  );
}

/* עורך שם לאשכול (שורה ברשימה) */
function NameEditor({ initial = '', placeholder, list, excludeId, kind, onSave, onCancel, onPickExisting }: {
  initial?: string; placeholder?: string; list: Cluster[]; excludeId?: string; kind: string;
  onSave: (name: string) => Promise<void>; onCancel: () => void; onPickExisting: (c: Cluster) => void;
}) {
  const [v, setV] = useState(initial);
  const [dupe, setDupe] = useState<Cluster | null>(null);
  const [err, setErr] = useState('');
  const submit = async (force = false) => {
    if (!v.trim()) { setErr(`חובה: שם ה${kind}`); return; }
    const similar = findSimilar(v, list, excludeId);
    if (similar && !force) { setDupe(similar); return; }
    try { await onSave(v.trim()); } catch { setErr('השמירה נכשלה – אין הרשאה או אין חיבור'); }
  };
  return (
    <div className="name-editor">
      <div className="name-editor__row">
        <input autoFocus className="input input--sm" value={v} placeholder={placeholder} aria-label={`שם ה${kind}`}
          onChange={(e) => { setV(e.target.value); setDupe(null); setErr(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } if (e.key === 'Escape') { e.preventDefault(); onCancel(); } }} />
        <button className="icon-btn icon-btn--sm icon-btn--ok" aria-label="שמור" onClick={() => submit()}><Check size={16} /></button>
        <button className="icon-btn icon-btn--sm" aria-label="ביטול" onClick={onCancel}><X size={16} /></button>
      </div>
      {err && <p className="pop__err" role="alert">{err}</p>}
      {dupe && <DupePrompt existing={dupe.name} kind={kind} onUseExisting={() => onPickExisting(dupe)} onCreateAnyway={() => { setDupe(null); submit(true); }} />}
    </div>
  );
}

/* "האם התכוונת לזה?" – מניעת רישום כפול בכתיב שונה */
export function DupePrompt({ existing, kind, onUseExisting, onCreateAnyway }: { existing: string; kind: string; onUseExisting: () => void; onCreateAnyway: () => void }) {
  return (
    <div className="dupe" role="alert">
      <span>קיים כבר {kind} בשם דומה: <b>"{existing}"</b>. האם התכוונת אליו?</span>
      <span className="dupe__actions">
        <Button size="sm" variant="primary" onClick={onUseExisting}>כן, זה {existing}</Button>
        <Button size="sm" variant="ghost" onClick={onCreateAnyway}>לא, זה {kind} אחר</Button>
      </span>
    </div>
  );
}

/* מתג פעיל / לא פעיל */
function ActiveSwitch({ active, label, onChange }: { active: boolean; label: string; onChange: (v: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const click = async () => {
    setBusy(true);
    try { await onChange(!active); } catch { toast({ tone: 'error', message: 'הפעולה נכשלה' }); }
    setBusy(false);
  };
  return (
    <button role="switch" aria-checked={active} aria-label={`${label}: ${active ? 'פעיל' : 'לא פעיל'}`} className={`switch ${active ? 'is-on' : ''}`} onClick={(e) => { e.stopPropagation(); click(); }} disabled={busy}>
      <span className="switch__track"><span className="switch__thumb" /></span>
      <span className="switch__label">{active ? 'פעיל' : 'לא פעיל'}</span>
    </button>
  );
}

