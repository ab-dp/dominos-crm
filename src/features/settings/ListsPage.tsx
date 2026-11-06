/* הגדרות ← רשימות: הוספה, שינוי שם בתוך השורה, הפעלה/השבתה. אין מחיקה – פריט לא פעיל נשאר בהזמנות הישנות. */
import { useState } from 'react';
import { Check, Lock, Pencil, Plus, X } from 'lucide-react';
import { LIST_META, saveList, useLists, type ListItem, type ListKey, type Lists } from '../../data/lists';
import { Button, EmptyState, Skeleton, Tip } from '../../design/components';
import { useToast } from '../../design/Toast';
import { findSimilar } from '../../lib/names';
import '../pages.css';
import './ListsPage.css';

export function ListsPage() {
  const { lists, error } = useLists();
  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">רשימות</h1>
          <p className="page__sub">פריט שהושבת לא יופיע בבחירה חדשה.</p>
        </div>
      </header>
      {error ? <div className="card"><EmptyState icon={<Lock size={24} />} title="לא ניתן לטעון">{error}</EmptyState></div>
        : !lists ? <div className="lists-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="card lcard"><Skeleton h={120} /></div>)}</div>
        : (
          <div className="lists-grid">
            {(Object.keys(LIST_META) as ListKey[]).map((k) => <ListCard key={k} k={k} lists={lists} />)}
          </div>
        )}
    </div>
  );
}

function ListCard({ k, lists }: { k: ListKey; lists: Lists }) {
  const toast = useToast();
  const items = lists[k];
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [err, setErr] = useState('');

  const commit = async (next: ListItem[], msg: string) => {
    try { await saveList(k, next, items, lists); toast({ message: msg, onUndo: () => saveList(k, items, next, { ...lists, [k]: next }) }); }
    catch { toast({ tone: 'error', message: 'השמירה נכשלה – רק מנהל מערכת יכול לשנות רשימות' }); }
  };

  const add = async () => {
    const label = newLabel.trim();
    if (!label) return;
    const similar = findSimilar(label, items.map((i) => ({ id: i.id, name: i.label })));
    if (similar) { setErr(`כבר קיים פריט דומה: "${similar.name}"`); return; }
    await commit([...items, { id: `i${Date.now().toString(36)}`, label, active: true }], `"${label}" נוסף ל${LIST_META[k].title}`);
    setNewLabel(''); setErr('');
  };

  const rename = async (it: ListItem) => {
    const label = draft.trim();
    setEditing(null);
    if (!label || label === it.label) return;
    await commit(items.map((x) => (x.id === it.id ? { ...x, label } : x)), 'השם עודכן');
  };

  return (
    <section className="card lcard" aria-labelledby={`h-${k}`}>
      <div className="lcard__head">
        <h2 id={`h-${k}`} className="card__title">{LIST_META[k].title}</h2>
        <p className="muted lcard__hint">{LIST_META[k].hint}</p>
      </div>
      <ul className="litems">
        {items.map((it) => (
          <li key={it.id} className={`litem ${it.active ? '' : 'is-inactive'}`}>
            {editing === it.id ? (
              <span className="litem__edit">
                <input className="input input--sm" autoFocus value={draft} aria-label="שם הפריט"
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); rename(it); } if (e.key === 'Escape') { e.preventDefault(); setEditing(null); } }} />
                <button className="icon-btn icon-btn--sm icon-btn--ok" aria-label="שמור" onClick={() => rename(it)}><Check size={16} /></button>
                <button className="icon-btn icon-btn--sm" aria-label="ביטול" onClick={() => setEditing(null)}><X size={16} /></button>
              </span>
            ) : (
              <>
                <span className="litem__label">{it.label}</span>
                {it.locked && <Tip label="פריט מערכת – לא ניתן להשבית"><span className="litem__lock" role="img" tabIndex={0} aria-label="פריט מערכת"><Lock size={13} /></span></Tip>}
                {!it.active && <span className="tag-inactive">לא פעיל</span>}
                <span className="litem__actions">
                  <button className="icon-btn icon-btn--sm" aria-label={`שנה שם: ${it.label}`} onClick={() => { setEditing(it.id); setDraft(it.label); }}><Pencil size={14} /></button>
                  {!it.locked && (
                    <button className="litem__toggle" onClick={() => commit(items.map((x) => (x.id === it.id ? { ...x, active: !x.active } : x)), `"${it.label}" ${it.active ? 'הושבת' : 'הופעל'}`)}>
                      {it.active ? 'השבת' : 'הפעל'}
                    </button>
                  )}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      <form className="ladd" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input className="input input--sm" value={newLabel} onChange={(e) => { setNewLabel(e.target.value); setErr(''); }} placeholder="פריט חדש" aria-label={`פריט חדש ב${LIST_META[k].title}`} />
        <Button size="sm" type="submit" icon={<Plus size={15} />} disabled={!newLabel.trim()}>הוסף</Button>
      </form>
      {err && <p className="pop__err ladd__err" role="alert">{err}</p>}
    </section>
  );
}
