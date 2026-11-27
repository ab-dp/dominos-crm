/* מאגר הלקוחות (אפיון 6.5). הסינון הראשוני הוא "קבועים", כדי שלקוחות מזדמנים לא יעמיסו על הרשימה. */
import { useMemo, useState } from 'react';
import { StickyBar } from '../../design/StickyBar';
import { useNavigate } from 'react-router-dom';
import { Download, FileCheck2, Plus, Search, Users, X } from 'lucide-react';
import { customerGaps, primaryContact, useCustomers, type Customer, type CustomerGap } from '../../data/customers';
import { useLists } from '../../data/lists';
import { usePriceLists } from '../../data/priceLists';
import { Button, EmptyState, Skeleton, Tip } from '../../design/components';
import { FilterBar, type FilterDim } from '../../design/FilterBar';
import { useUrlParams } from '../../lib/urlParams';
import { Ltr, fmtPhone, toISODate } from '../../lib/format';
import { useToast } from '../../design/Toast';
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
  const { get, setMany } = useUrlParams();
  const fMethod = get('method');
  const fPl = get('pl');
  const fStatus = get('cstatus') as '' | 'all' | 'inactive'; // ריק = פעילים בלבד
  /* סטטוס אחד לטבלה, למספרים בלשוניות ולמונה "פרטים חסרים" */
  const statusOk = (c: Customer) => (fStatus === 'all' ? true : fStatus === 'inactive' ? c.status !== 'active' : c.status === 'active');
  const [gapsOnly, setGapsOnly] = usePref('customersGapsOnly', false); // "השלמת תיק לקוח": רק לקוחות שחסרים להם פרטים. נשמר בין כניסות
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

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
    .filter(statusOk)
    .filter((c) => !fMethod || c.paymentMethod === fMethod)
    .filter((c) => !fPl || (fPl === '__none' ? !c.priceListId : c.priceListId === fPl))
    .filter((c) => !gapsOnly || customerGaps(c).length > 0)
    .filter((c) => !s || c.name.toLowerCase().includes(s)
      || (digits.length >= 3 && (c.taxId.includes(digits) || c.accountPhone.includes(digits) || c.contacts.some((x) => x.phone.includes(digits))))
      || c.contacts.some((x) => x.name.includes(q.trim())));
  const gapCount = live.filter((c) => (type === 'all' || c.type === type) && statusOk(c) && customerGaps(c).length > 0).length;
  const activeCount = live.filter((c) => c.status === 'active').length;
  const accountCount = live.filter((c) => c.status === 'active' && c.paymentMethod === 'account').length;
  const counts = { regular: live.filter((c) => c.type === 'regular' && statusOk(c)).length, occasional: live.filter((c) => c.type === 'occasional' && statusOk(c)).length };

  const dims: FilterDim[] = [
    { key: 'method', label: 'אמצעי תשלום', all: 'כל אמצעי התשלום', options: (lists?.paymentMethods ?? []).filter((m) => m.active !== false || m.id === fMethod).map((m) => ({ value: m.id, label: m.label })) },
    { key: 'pl', label: 'מחירון', all: 'כל המחירונים', options: [...priceLists.filter((p) => p.active || p.id === fPl).map((p) => ({ value: p.id, label: p.name })), { value: '__none', label: 'בלי מחירון' }] },
    { key: 'cstatus', label: 'סטטוס', all: 'פעילים', options: [{ value: 'inactive', label: 'לא פעילים' }, { value: 'all', label: 'פעילים ולא פעילים' }] },
  ];

  /* ייצוא לאקסל: הלקוחות שמוצגים עכשיו (לפי הסינון), וגיליון שני עם כל אנשי הקשר שלהם */
  const exportXlsx = async () => {
    setExporting(true);
    try {
      const { downloadXlsx } = await import('../../lib/xlsx');
      const list = rows;
      await downloadXlsx(`לקוחות-${toISODate(new Date())}.xlsx`, [
        { name: 'לקוחות', title: 'לקוחות', notes: [`${list.length} לקוחות לפי הסינון שבמסך`], tables: [{ main: true,
          cols: [
            { label: 'שם', kind: 'text', width: 30 }, { label: 'סוג', kind: 'text', width: 10 }, { label: 'ח.פ', kind: 'code', width: 13 },
            { label: 'סטטוס', kind: 'text', width: 10 }, { label: 'אמצעי תשלום', kind: 'text', width: 14 }, { label: 'טלפון הקפה', kind: 'code', width: 14 },
            { label: 'מחירון', kind: 'text', width: 18 }, { label: 'תעודת רכש', kind: 'text', width: 11 },
            { label: 'איש קשר ראשי', kind: 'text', width: 20 }, { label: 'טלפון', kind: 'code', width: 14 }, { label: 'מייל', kind: 'code', width: 26 },
            { label: 'כתובת ראשית', kind: 'text', width: 34 }, { label: 'הנחיות חיוב', kind: 'text', width: 34 },
          ],
          rows: list.map((c) => { const pc = primaryContact(c); return [
            c.name, c.type === 'regular' ? 'קבוע' : 'מזדמן', c.taxId, c.status === 'active' ? 'פעיל' : 'לא פעיל', methodLabel(c.paymentMethod),
            c.accountPhone ? fmtPhone(c.accountPhone) : '', plName(c.priceListId), c.poRequired ? 'נדרשת' : '',
            pc?.name ?? '', pc?.phone ? fmtPhone(pc.phone) : '', pc?.email ?? '', c.addresses[0]?.address ?? c.businessAddress ?? '', c.billingInstructions,
          ]; }),
        }] },
        { name: 'אנשי קשר', title: 'אנשי קשר', tables: [{ main: true,
          cols: [
            { label: 'לקוח', kind: 'text', width: 30 }, { label: 'שם', kind: 'text', width: 22 }, { label: 'תפקיד', kind: 'text', width: 18 },
            { label: 'טלפון', kind: 'code', width: 14 }, { label: 'מייל', kind: 'code', width: 28 }, { label: 'ראשי', kind: 'text', width: 8 },
          ],
          rows: list.flatMap((c) => c.contacts.map((x) => [c.name, x.name, x.role, x.phone ? fmtPhone(x.phone) : '', x.email, x.primary ? 'כן' : ''])),
        }] },
      ]);
    } catch { toast({ tone: 'error', message: 'הייצוא נכשל – נסה שוב' }); } finally { setExporting(false); }
  };

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">לקוחות</h1>
          <p className="page__sub">{loading ? ' ' : <><Ltr>{activeCount}</Ltr> פעילים · <Ltr>{accountCount}</Ltr> בהקפה</>}</p>
        </div>
        <div className="page__head-end">
          <Button variant="secondary" icon={<Download size={16} />} loading={exporting} disabled={loading || !rows.length} onClick={exportXlsx}>ייצוא לאקסל</Button>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>לקוח חדש</Button>
        </div>
      </header>

      <StickyBar>
      <div className="tabs" role="tablist" aria-label="סוג לקוח">
        {([['regular', 'קבועים', counts.regular], ['occasional', 'מזדמנים', counts.occasional], ['all', 'הכל', counts.regular + counts.occasional]] as [TypeFilter, string, number][]).map(([k, label, n]) => (
          <button key={k} role="tab" aria-selected={type === k} className={`tab ${type === k ? 'is-on' : ''}`} onClick={() => setType(k)}>{label}<span className="tab__count"><Ltr>{n}</Ltr></span></button>
        ))}
      </div>
      <div className="tablebar">
        <FilterBar dims={dims} values={{ method: fMethod, pl: fPl, cstatus: fStatus }} onChange={setMany} extraActive={(q.trim() ? 1 : 0) + (gapsOnly ? 1 : 0)} onClearAll={() => { setQ(''); setGapsOnly(false); }} />
        <button className={`chip ${gapsOnly ? 'is-on' : ''}`} aria-pressed={gapsOnly} onClick={() => setGapsOnly(!gapsOnly)}>פרטים חסרים <Ltr>{gapCount}</Ltr></button>
        <label className="tablebar__search">
          <Search size={16} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="שם, ח.פ, טלפון, טלפון הקפה או איש קשר" aria-label="חיפוש לקוח" />
          {q && <button onClick={() => setQ('')} aria-label="נקה חיפוש"><X size={14} /></button>}
        </label>
      </div>
      </StickyBar>

      {error ? <div className="card"><EmptyState icon={<Users size={20} />} title="לא ניתן לטעון לקוחות">{error}. ודא שכללי האבטחה פורסמו.</EmptyState></div>
        : loading ? <div className="card cust-skel">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={36} />)}</div>
        : rows.length === 0 ? (
          <div className="card">
            <EmptyState icon={<Users size={20} />} title={q ? 'לא נמצא לקוח מתאים' : live.length === 0 ? 'עוד אין לקוחות' : 'אין לקוחות בתצוגה הזו'}
              action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>{q ? `לקוח חדש: "${q}"` : 'לקוח חדש'}</Button>}>
              {live.length === 0 ? 'מוסיפים כאן את לקוחות ההקפה הקבועים. לקוח אחר נוצר בהזמנה הראשונה שלו (במסך ההזמנה ← "לקוח חדש").' : gapsOnly ? 'לכל הלקוחות בתצוגה הזו יש תיק מלא.' : undefined}
            </EmptyState>
          </div>
        ) : (
          <div className="otable-wrap">
            <table className="otable otable--dense cust-table">
              <caption className="sr-only">לקוחות</caption>
              <thead>
                <tr><th>שם</th><th>סוג</th><th>ח.פ</th><th>איש קשר</th><th>טלפון</th><th>אמצעי תשלום</th><th>טלפון הקפה</th><th>מחירון</th><th className="c-po"><abbr title="תעודת רכש">ת. רכש</abbr></th><th className="c-gaps">פרטים חסרים</th></tr>
              </thead>
              <tbody>
                {rows.map((c) => <CustomerRow key={c.id} c={c} methodLabel={methodLabel} plName={plName} shared={(sharedPhones[c.accountPhone] ?? 0) > 1} onOpen={() => nav(`/customers/${c.id}`)} />)}
              </tbody>
            </table>
          </div>
        )}

      {adding && <CustomerForm open onClose={() => setAdding(false)} customers={items} initialName={rows.length === 0 ? q : ''} />}
    </div>
  );
}

function CustomerRow({ c, methodLabel, plName, shared, onOpen }: { c: Customer; methodLabel: (id: string) => string; plName: (id: string) => string; shared: boolean; onOpen: () => void }) {
  const pc = primaryContact(c);
  const gaps = customerGaps(c);
  return (
    <tr className={`orow ${c.status === 'inactive' ? 'is-inactive-row' : ''}`} tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter') { e.preventDefault(); onOpen(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); (e.currentTarget.nextElementSibling as HTMLElement | null)?.focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); (e.currentTarget.previousElementSibling as HTMLElement | null)?.focus(); }
      }}
      aria-label={`${c.name}${c.status === 'inactive' ? ', לא פעיל' : ''}${c.poRequired ? ', נדרשת תעודת רכש' : ''}${gaps.length ? `. חסר: ${gaps.map((g) => g.label).join(', ')}` : ''}. Enter לפתיחת התיק`}>
      <td className="strong">{c.name}{c.status === 'inactive' && <span className="tag-inactive cust-inactive">לא פעיל</span>}</td>
      <td><span className={`ctype ctype--${c.type}`}>{c.type === 'regular' ? 'קבוע' : 'מזדמן'}</span></td>
      <td className="num">{c.taxId ? <Ltr>{c.taxId}</Ltr> : <span className="muted">—</span>}</td>
      <td>{pc?.name || <span className="muted">—</span>}</td>
      <td className="num">{pc?.phone ? <Ltr>{fmtPhone(pc.phone)}</Ltr> : <span className="muted">—</span>}</td>
      <td>{methodLabel(c.paymentMethod)}</td>
      <td className="num">{c.accountPhone ? <><Ltr>{fmtPhone(c.accountPhone)}</Ltr>{shared && <span className="shared-tag">כללי</span>}</> : <span className="muted">—</span>}</td>
      <td>{plName(c.priceListId) || <span className="muted">—</span>}</td>
      <td className="c-po">{c.poRequired && <span className="po-tag" title="נדרשת תעודת רכש"><FileCheck2 size={16} aria-hidden="true" /><span className="po-tag__m">נדרשת ת. רכש</span></span>}</td>
      <td className="c-gaps"><Gaps gaps={gaps} /></td>
    </tr>
  );
}

/* מה חסר בתיק: נקודה בצבע "חסר", הפרט הראשון ו"+N" – כל הרשימה בריחוף ובשם השורה */
function Gaps({ gaps }: { gaps: CustomerGap[] }) {
  if (!gaps.length) return null;
  const rest = gaps.length - 1;
  const inner = (
    <span className="cgaps" aria-hidden="true">
      <span><span className="cgaps__m">חסר: </span>{gaps[0].label}<span className="cgaps__all">{gaps.slice(1).map((g) => `, ${g.label}`).join('')}</span></span>
      {rest > 0 && <span className="cgaps__more"><Ltr>+{rest}</Ltr></span>}
    </span>
  );
  return rest > 0 ? <Tip label={<ul className="tip__list">{gaps.map((g) => <li key={g.label}>{g.label}</li>)}</ul>}>{inner}</Tip> : inner;
}
