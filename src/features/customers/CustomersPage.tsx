/* מאגר הלקוחות (אפיון 6.5). הסינון הראשוני הוא "קבועים", כדי שלקוחות מזדמנים לא יעמיסו על הרשימה. */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileCheck2, Plus, Search, Users, X } from 'lucide-react';
import { customerGaps, primaryContact, useCustomers, type Customer } from '../../data/customers';
import { useLists } from '../../data/lists';
import { usePriceLists } from '../../data/priceLists';
import { Button, EmptyState, Skeleton, Tip } from '../../design/components';
import { Ltr, fmtPhone } from '../../lib/format';
import { usePref } from '../../lib/prefs';
import { CustomerForm } from './CustomerForm';
import '../pages.css';
import './CustomersPage.css';

type TypeFilter = 'regular' | 'occasional' | 'all';

export function CustomersPage() {
  const { items, loading, error } = useCustomers();
  const { lists } = useLists();
  const { items: priceLists } = usePriceLists();
  const nav = useNavigate();
  const [type, setType] = usePref<TypeFilter>('customersType', 'regular');
  const [showInactive, setShowInactive] = useState(false);
  const [gapsOnly, setGapsOnly] = useState(false); // "השלמת תיק לקוח": רק לקוחות שחסרים להם פרטים
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);

  const methodLabel = (id: string) => lists?.paymentMethods.find((m) => m.id === id)?.label ?? id;
  const plName = (id: string) => priceLists.find((p) => p.id === id)?.name ?? '';
  const sharedPhones = useMemo(() => {
    const m: Record<string, number> = {};
    items.forEach((c) => { if (c.accountPhone && c.status !== 'merged') m[c.accountPhone] = (m[c.accountPhone] ?? 0) + 1; });
    return m;
  }, [items]);

  const live = items.filter((c) => c.status !== 'merged');
  const s = q.trim().toLowerCase();
  const digits = s.replace(/\D/g, '');
  const rows = live
    .filter((c) => type === 'all' || c.type === type)
    .filter((c) => showInactive || c.status === 'active')
    .filter((c) => !gapsOnly || customerGaps(c).length > 0)
    .filter((c) => !s || c.name.toLowerCase().includes(s)
      || (digits.length >= 3 && (c.taxId.includes(digits) || c.accountPhone.includes(digits) || c.contacts.some((x) => x.phone.includes(digits))))
      || c.contacts.some((x) => x.name.includes(q.trim())));
  const gapCount = live.filter((c) => (type === 'all' || c.type === type) && c.status === 'active' && customerGaps(c).length > 0).length;
  const counts = { regular: live.filter((c) => c.type === 'regular' && (showInactive || c.status === 'active')).length, occasional: live.filter((c) => c.type === 'occasional' && (showInactive || c.status === 'active')).length };

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">לקוחות</h1>
          <p className="page__sub">לחיצה על לקוח פותחת את התיק שלו.</p>
        </div>
        <div className="page__head-end">
          <Button variant="primary" icon={<Plus size={18} />} onClick={() => setAdding(true)}>לקוח חדש</Button>
        </div>
      </header>

      <div className="tablebar">
        <div className="seg" role="group" aria-label="סוג לקוח">
          <button className={type === 'regular' ? 'is-on' : ''} aria-pressed={type === 'regular'} onClick={() => setType('regular')}>קבועים <Ltr>{counts.regular}</Ltr></button>
          <button className={type === 'occasional' ? 'is-on' : ''} aria-pressed={type === 'occasional'} onClick={() => setType('occasional')}>מזדמנים <Ltr>{counts.occasional}</Ltr></button>
          <button className={type === 'all' ? 'is-on' : ''} aria-pressed={type === 'all'} onClick={() => setType('all')}>הכל</button>
        </div>
        <button className={`chip ${gapsOnly ? 'is-on' : ''}`} aria-pressed={gapsOnly} onClick={() => setGapsOnly(!gapsOnly)}>חסרים פרטים <Ltr>{gapCount}</Ltr></button>
        <label className="check-inline"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> הצג לא פעילים</label>
        <label className="tablebar__search">
          <Search size={16} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="שם, ח.פ, טלפון, טלפון הקפה או איש קשר" aria-label="חיפוש לקוח" />
          {q && <button onClick={() => setQ('')} aria-label="נקה חיפוש"><X size={14} /></button>}
        </label>
      </div>

      {error ? <div className="card"><EmptyState icon={<Users size={24} />} title="לא ניתן לטעון לקוחות">{error}. ודא שכללי האבטחה פורסמו.</EmptyState></div>
        : loading ? <div className="card cust-skel">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={36} />)}</div>
        : rows.length === 0 ? (
          <div className="card">
            <EmptyState icon={<Users size={24} />} title={q ? 'לא נמצא לקוח מתאים' : live.length === 0 ? 'עוד אין לקוחות' : 'אין לקוחות בתצוגה הזו'}
              action={<Button variant="primary" icon={<Plus size={18} />} onClick={() => setAdding(true)}>{q ? `לקוח חדש: "${q}"` : 'לקוח חדש'}</Button>}>
              {live.length === 0 ? 'מוסיפים כאן את לקוחות ההקפה הקבועים. לקוח אחר נוצר בהזמנה הראשונה שלו (במסך ההזמנה ← "לקוח חדש").' : gapsOnly ? 'לכל הלקוחות בתצוגה הזו יש תיק מלא.' : undefined}
            </EmptyState>
          </div>
        ) : (
          <div className="otable-wrap">
            <table className="otable otable--dense cust-table">
              <caption className="sr-only">לקוחות</caption>
              <thead>
                <tr><th>שם</th><th>סוג</th><th>ח.פ</th><th>איש קשר</th><th>טלפון</th><th>אמצעי תשלום</th><th>טלפון הקפה</th><th>מחירון</th><th><span className="sr-only">תעודת רכש</span></th>{gapsOnly && <th>מה חסר</th>}</tr>
              </thead>
              <tbody>
                {rows.map((c) => <CustomerRow key={c.id} c={c} methodLabel={methodLabel} plName={plName} shared={(sharedPhones[c.accountPhone] ?? 0) > 1} gaps={gapsOnly} onOpen={() => nav(`/customers/${c.id}`)} />)}
              </tbody>
            </table>
          </div>
        )}

      {adding && <CustomerForm open onClose={() => setAdding(false)} customers={items} initialName={rows.length === 0 ? q : ''} />}
    </div>
  );
}

function CustomerRow({ c, methodLabel, plName, shared, gaps, onOpen }: { c: Customer; methodLabel: (id: string) => string; plName: (id: string) => string; shared: boolean; gaps: boolean; onOpen: () => void }) {
  const pc = primaryContact(c);
  return (
    <tr className={`orow ${c.status === 'inactive' ? 'is-inactive-row' : ''}`} tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter') { e.preventDefault(); onOpen(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); (e.currentTarget.nextElementSibling as HTMLElement | null)?.focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); (e.currentTarget.previousElementSibling as HTMLElement | null)?.focus(); }
      }}
      aria-label={`${c.name}${c.status === 'inactive' ? ', לא פעיל' : ''}. Enter לפתיחת התיק`}>
      <td className="strong">{c.name}{c.status === 'inactive' && <span className="tag-inactive cust-inactive">לא פעיל</span>}</td>
      <td><span className={`ctype ctype--${c.type}`}>{c.type === 'regular' ? 'קבוע' : 'מזדמן'}</span></td>
      <td className="num">{c.taxId ? <Ltr>{c.taxId}</Ltr> : <span className="muted">—</span>}</td>
      <td>{pc?.name || <span className="muted">—</span>}</td>
      <td className="num">{pc?.phone ? <Ltr>{fmtPhone(pc.phone)}</Ltr> : <span className="muted">—</span>}</td>
      <td>{methodLabel(c.paymentMethod)}</td>
      <td className="num">{c.accountPhone ? <><Ltr>{fmtPhone(c.accountPhone)}</Ltr>{shared && <span className="shared-tag">כללי</span>}</> : <span className="muted">—</span>}</td>
      <td>{plName(c.priceListId) || <span className="muted">—</span>}</td>
      <td>{c.poRequired && <Tip label="נדרשת תעודת רכש"><span className="po-tag" role="img" tabIndex={0} aria-label="נדרשת תעודת רכש"><FileCheck2 size={15} /></span></Tip>}</td>
      {gaps && <td className="cust-gaps">{customerGaps(c).map((g) => <span key={g.label} className="mgaps__tag">{g.label}</span>)}</td>}
    </tr>
  );
}
