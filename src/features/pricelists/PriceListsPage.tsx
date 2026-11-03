/* מחירונים (אפיון 6.7): משותף או ייחודי, פריטים ומחירים (כולל מע"מ), לקוחות משויכים, "שכפל מחירון".
   כל מחיר ניתן לעריכה ידנית בכל רגע וכל עריכה נרשמת ביומן. שינוי מחירון לא משנה הזמנות קיימות. */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Copy, Pencil, Plus, Tags, Users, X } from 'lucide-react';
import { createPriceList, updatePriceList, usePriceLists, type PriceItem, type PriceList } from '../../data/priceLists';
import { newId, useCustomers } from '../../data/customers';
import { Button, EmptyState, Skeleton } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, fmtMoney } from '../../lib/format';
import { findSimilar } from '../../lib/names';
import '../pages.css';
import '../branches/BranchesPage.css';
import './PriceListsPage.css';

export function PriceListsPage() {
  const { items, loading, error } = usePriceLists();
  const { items: customers } = useCustomers();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<PriceList['kind']>('shared');
  const [err, setErr] = useState('');
  const selectedId = params.get('id') ?? items[0]?.id;
  const selected = items.find((p) => p.id === selectedId);
  const assigned = (id: string) => customers.filter((c) => c.priceListId === id && c.status !== 'merged');

  const create = async (name: string, kind: PriceList['kind'], from?: PriceList) => {
    if (!name.trim()) return setErr('חובה: שם המחירון');
    const similar = findSimilar(name, items);
    if (similar && !from) return setErr(`כבר קיים מחירון בשם דומה: "${similar.name}"`);
    const id = await createPriceList(name, kind, from ? from.items.map((i) => ({ ...i, id: newId() })) : []);
    setCreating(false); setNewName(''); setErr('');
    setParams({ id }, { replace: true });
    toast({ message: from ? <>נוצר עותק: "{name}" עם <Ltr>{from.items.length}</Ltr> פריטים</> : <>המחירון "{name}" נוצר</> });
  };

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">מחירונים</h1>
          <p className="page__sub">מחירון הוא בסיסי מחיר, לא תפריט: לכל בסיס מחיר למשלוח ולאיסוף עצמי. בהזמנה בוחרים בסיס ומוסיפים תיאור מדויק. המחירים כוללים מע"מ, ושינוי מחירון לא משנה הזמנות קיימות.</p>
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
                  <input className="input input--sm" autoFocus value={newName} placeholder="שם המחירון" aria-label="שם המחירון"
                    onChange={(e) => { setNewName(e.target.value); setErr(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(newName, newKind); } if (e.key === 'Escape') setCreating(false); }} />
                  <div className="seg seg--sm" role="radiogroup" aria-label="סוג מחירון">
                    <button type="button" role="radio" aria-checked={newKind === 'shared'} className={newKind === 'shared' ? 'is-on' : ''} onClick={() => setNewKind('shared')}>משותף</button>
                    <button type="button" role="radio" aria-checked={newKind === 'unique'} className={newKind === 'unique' ? 'is-on' : ''} onClick={() => setNewKind('unique')}>ייחודי ללקוח</button>
                  </div>
                  <div className="pl-new__actions">
                    <Button size="sm" variant="primary" onClick={() => create(newName, newKind)}>צור</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setErr(''); }}>ביטול</Button>
                  </div>
                  {err && <p className="pop__err" role="alert">{err}</p>}
                </li>
              )}
              {loading ? [0, 1].map((i) => <li key={i} className="citem-skel"><Skeleton h={18} /></li>) : items.map((p) => (
                <li key={p.id} className={p.active ? '' : 'is-inactive'}>
                  <button className={`citem pl-item ${p.id === selectedId ? 'is-on' : ''}`} aria-pressed={p.id === selectedId} onClick={() => setParams({ id: p.id }, { replace: true })}>
                    <span className="citem__name">{p.name}</span>
                    {p.kind === 'unique' && <span className="tag-inactive">ייחודי</span>}
                    {!p.active && <span className="tag-inactive">לא פעיל</span>}
                    <span className="citem__count"><Ltr>{p.items.filter((i) => i.active).length}</Ltr> פריטים · <Ltr>{assigned(p.id).length}</Ltr> לקוחות</span>
                  </button>
                </li>
              ))}
              {!loading && items.length === 0 && !creating && <li className="clist__empty">עוד אין מחירונים. <button className="link" onClick={() => setCreating(true)}>צור את הראשון</button></li>}
            </ul>
          </section>

          {selected ? <Editor key={selected.id} pl={selected} all={items} customersCount={assigned(selected.id)} onDuplicate={() => create(`עותק של ${selected.name}`, selected.kind, selected)} /> : !loading && (
            <div className="card"><EmptyState icon={<Tags size={24} />} title="בחר מחירון או צור חדש">מחירון משותף משמש כמה לקוחות; ייחודי – לקוח אחד.</EmptyState></div>
          )}
        </div>
      )}
    </div>
  );
}

function Editor({ pl, all, customersCount, onDuplicate }: { pl: PriceList; all: PriceList[]; customersCount: { id: string; name: string }[]; onDuplicate: () => void }) {
  const toast = useToast();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(pl.name);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', price: '', pickup: '' });
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const saveItems = async (items: PriceItem[], msg: string, before?: unknown, after?: unknown) => {
    try { await updatePriceList(pl, { items }, { before, after }); toast({ message: msg }); }
    catch { toast({ message: 'השמירה נכשלה' }); }
  };

  const commitItem = async (id: string | null) => {
    const n = draft.name.trim();
    const price = Number(draft.price.replace(/[^\d.]/g, ''));
    const pickupPrice = draft.pickup.trim() ? Number(draft.pickup.replace(/[^\d.]/g, '')) : price;
    if (!n) return setErr('חובה: שם בסיס המחיר');
    if (!draft.price.trim() || !(price > 0)) return setErr('חובה: מחיר למשלוח (כולל מע"מ)');
    if (!(pickupPrice > 0)) return setErr('מחיר לאיסוף עצמי לא תקין');
    const dupe = findSimilar(n, pl.items.map((i) => ({ id: i.id, name: i.name })), id ?? undefined);
    if (dupe) return setErr(`כבר יש פריט בשם דומה: "${dupe.name}"`);
    if (id) {
      const old = pl.items.find((i) => i.id === id)!;
      await saveItems(pl.items.map((i) => (i.id === id ? { ...i, name: n, price, pickupPrice } : i)), old.price !== price || (old.pickupPrice ?? old.price) !== pickupPrice ? `${n}: משלוח ${fmtMoney(price)} · איסוף ${fmtMoney(pickupPrice)}` : 'בסיס המחיר עודכן', { item: old.name, price: old.price, pickupPrice: old.pickupPrice ?? old.price }, { item: n, price, pickupPrice });
      setEditing(null);
    } else {
      await saveItems([...pl.items, { id: newId(), name: n, price, pickupPrice, active: true }], `${n} נוסף · משלוח ${fmtMoney(price)} · איסוף ${fmtMoney(pickupPrice)}`, null, { item: n, price, pickupPrice });
      setAdding(false);
    }
    setDraft({ name: '', price: '', pickup: '' }); setErr('');
  };

  const rows = pl.items.filter((i) => showInactive || i.active);
  const row = (id: string | null) => (
    <tr className="brow brow--edit" key={id ?? 'new'} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitItem(id); } if (e.key === 'Escape') { e.preventDefault(); setEditing(null); setAdding(false); setErr(''); } }}>
      <td><input className="input input--sm" autoFocus value={draft.name} onChange={(e) => { setDraft({ ...draft, name: e.target.value }); setErr(''); }} aria-label="שם בסיס המחיר" placeholder="למשל: משפחתית רגילה" /></td>
      <td><input className="input input--sm input--ltr pl-price" inputMode="decimal" value={draft.price} onChange={(e) => { setDraft({ ...draft, price: e.target.value }); setErr(''); }} aria-label="מחיר למשלוח כולל מע״מ" placeholder="₪" /></td>
      <td><input className="input input--sm input--ltr pl-price" inputMode="decimal" value={draft.pickup} onChange={(e) => { setDraft({ ...draft, pickup: e.target.value }); setErr(''); }} aria-label="מחיר לאיסוף עצמי כולל מע״מ" placeholder={draft.price ? `כמו משלוח` : '₪'} /></td>
      <td colSpan={2} className="br-actions">
        <Button size="sm" variant="primary" icon={<Check size={15} />} onClick={() => commitItem(id)}>שמור</Button>
        <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setAdding(false); setErr(''); }}>ביטול</Button>
      </td>
    </tr>
  );

  return (
    <section className="card" aria-labelledby="h-pled">
      <div className="card__head br-branches__head">
        {renaming ? (
          <span className="name-editor__row pl-rename">
            <input className="input input--sm" autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="שם המחירון"
              onKeyDown={async (e) => {
                if (e.key === 'Escape') { setRenaming(false); setName(pl.name); }
                if (e.key === 'Enter') { e.preventDefault(); const d = findSimilar(name, all, pl.id); if (!name.trim() || d) { setErr(d ? `כבר קיים מחירון בשם "${d.name}"` : 'חובה: שם'); return; } await updatePriceList(pl, { name: name.trim() }); setRenaming(false); toast({ message: 'שם המחירון עודכן' }); }
              }} />
            <button className="icon-btn icon-btn--sm" aria-label="ביטול" onClick={() => { setRenaming(false); setName(pl.name); }}><X size={16} /></button>
          </span>
        ) : (
          <>
            <h2 id="h-pled" className="card__title">{pl.name}</h2>
            <button className="icon-btn icon-btn--sm" aria-label="שנה שם מחירון" onClick={() => setRenaming(true)}><Pencil size={15} /></button>
          </>
        )}
        <span className="tag">{pl.kind === 'shared' ? 'משותף' : 'ייחודי ללקוח'}</span>
        <span className="card__head-end pl-head-actions">
          <label className="check-inline"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> הצג פריטים לא פעילים</label>
          <Button size="sm" icon={<Copy size={15} />} onClick={onDuplicate}>שכפל מחירון</Button>
          <Button size="sm" variant={pl.active ? 'ghost' : 'secondary'} onClick={async () => { await updatePriceList(pl, { active: !pl.active }); toast({ message: pl.active ? 'המחירון סומן כלא פעיל – לא יוצע ללקוחות חדשים' : 'המחירון הופעל' }); }}>{pl.active ? 'סמן כלא פעיל' : 'הפעל'}</Button>
        </span>
      </div>

      <div className="otable-wrap br-table-wrap">
        <table className="otable otable--dense br-table pl-table">
          <caption className="sr-only">בסיסי מחיר במחירון {pl.name}</caption>
          <thead><tr><th>בסיס מחיר</th><th>משלוח</th><th>איסוף עצמי</th><th>מצב</th><th><span className="sr-only">פעולות</span></th></tr></thead>
          <tbody>
            {adding && row(null)}
            {rows.map((it) => editing === it.id ? row(it.id) : (
              <tr key={it.id} className={`brow ${it.active ? '' : 'is-inactive'}`} tabIndex={0}
                onKeyDown={(e) => { if (e.target === e.currentTarget && e.key === 'Enter') { e.preventDefault(); setEditing(it.id); setDraft({ name: it.name, price: String(it.price), pickup: String(it.pickupPrice ?? it.price) }); } }}>
                <td className="strong">{it.name}</td>
                <td className="num"><Ltr>{fmtMoney(it.price)}</Ltr></td>
                <td className="num"><Ltr>{fmtMoney(it.pickupPrice ?? it.price)}</Ltr></td>
                <td>
                  <button className={`switch ${it.active ? 'is-on' : ''}`} role="switch" aria-checked={it.active} aria-label={`${it.name}: ${it.active ? 'פעיל' : 'לא פעיל'}`}
                    onClick={() => saveItems(pl.items.map((i) => (i.id === it.id ? { ...i, active: !i.active } : i)), `${it.name} ${it.active ? 'הושבת' : 'הופעל'}`, { item: it.name, active: it.active }, { item: it.name, active: !it.active })}>
                    <span className="switch__track"><span className="switch__thumb" /></span><span className="switch__label">{it.active ? 'פעיל' : 'לא פעיל'}</span>
                  </button>
                </td>
                <td className="br-actions"><Button size="sm" variant="ghost" icon={<Pencil size={15} />} onClick={() => { setEditing(it.id); setAdding(false); setDraft({ name: it.name, price: String(it.price), pickup: String(it.pickupPrice ?? it.price) }); setErr(''); }}>ערוך</Button></td>
              </tr>
            ))}
            {err && <tr className="brow-msg"><td colSpan={5}><p className="pop__err" role="alert">{err}</p></td></tr>}
          </tbody>
        </table>
        {!adding && (
          <button className="pl-add" onClick={() => { setAdding(true); setEditing(null); setDraft({ name: '', price: '', pickup: '' }); setErr(''); }}><Plus size={16} aria-hidden="true" /> הוסף בסיס מחיר</button>
        )}
      </div>

      <div className="pl-customers">
        <h3 className="pl-customers__title"><Users size={16} aria-hidden="true" /> לקוחות משויכים · <Ltr>{customersCount.length}</Ltr></h3>
        {customersCount.length === 0 ? <p className="muted">אף לקוח לא משויך. משייכים מתוך טופס הלקוח או מהטאב "מחירון" בתיק הלקוח.</p> : (
          <ul className="pl-customers__list">{customersCount.map((c) => <li key={c.id}><Link to={`/customers/${c.id}`}>{c.name}</Link></li>)}</ul>
        )}
      </div>
    </section>
  );
}
