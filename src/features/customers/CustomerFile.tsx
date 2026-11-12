/* תיק לקוח במסך מלא (אפיון 6.6) – המקום לראות את כל התמונה על הלקוח. */
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight, Check, ClipboardList, FileCheck2, GitMerge, Mail, MessageSquarePlus, MoreHorizontal, Pencil, Phone as PhoneIcon,
  Plus, Star, Trash2, UserCheck, UserRound, UserX, Wallet,
} from 'lucide-react';
import {
  addActivity, customerGaps, newId, primaryContact, updateCustomer, useActivity, useCustomerHistory, useCustomers, withMerged,
  type Address, type Contact, type Customer,
} from '../../data/customers';
import { useBranches, useClusters } from '../../data/branches';
import { useLists } from '../../data/lists';
import { usePriceLists } from '../../data/priceLists';
import { useCustomerOrders } from '../../data/orders';
import { SHORT_STATUS, isExpired, useQuotes, type Quote } from '../../data/quotes';
import '../quotes/quotes.css';
import { useStore, type OrderView } from '../../data/store';
import { CATEGORIES, CLOSED } from '../../data/types';
import { healthOf, issuesFor } from '../../rules-engine/health';
import { usePanel } from '../../app/PanelContext';
import { OrdersTable } from '../orders/OrdersTable';
import { CustomerDocsSection } from '../orders/OrderDocs';
import { BarChart } from '../reports/BarChart';
import '../reports/ReportsPage.css';
import { Button, EmptyState, Field, Skeleton } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, fmtDate, fmtMoney, fmtPhone, toISODate } from '../../lib/format';
import { isLive, onTime, revenue, revenueOf } from '../../data/metrics';
import { cleanPhone, phoneError } from '../../lib/names';
import { CustomerForm } from './CustomerForm';
import { MergeDialog } from './MergeDialog';
import '../pages.css';
import './CustomerFile.css';

type Tab = 'overview' | 'orders' | 'quotes' | 'monthly' | 'prices' | 'payment' | 'contacts' | 'docs' | 'activity' | 'history';
/* עשר הלשוניות בארבע קבוצות. לכל לשונית כתובת משלה (?tab=), כך ש"אחורה" וקישור לעמית מגיעים לאותו מקום */
type Group = { key: string; label: string; tabs: [Tab, string][] };
const GROUPS: Group[] = [
  { key: 'overview', label: 'סקירה', tabs: [['overview', 'סקירה']] },
  { key: 'orders', label: 'הזמנות והצעות', tabs: [['orders', 'הזמנות'], ['quotes', 'הצעות מחיר'], ['monthly', 'סיכום חודשי']] },
  { key: 'details', label: 'פרטים ומחירון', tabs: [['contacts', 'אנשי קשר וכתובות'], ['prices', 'מחירון'], ['payment', 'תשלום והקפה']] },
  { key: 'activity', label: 'פעילות', tabs: [['activity', 'הערות ומשימות'], ['docs', 'מסמכים'], ['history', 'היסטוריית שינויים']] },
];
const ALL_TABS = GROUPS.flatMap((g) => g.tabs.map(([t]) => t));
const groupOf = (t: Tab) => GROUPS.find((g) => g.tabs.some(([x]) => x === t))!;

/* חיצים, Home ו-End בין לשוניות (RTL: חץ שמאלה = הבאה). הפוקוס זז עם הבחירה */
function tabKeys<T>(e: KeyboardEvent<HTMLElement>, keys: T[], cur: T, pick: (t: T) => void) {
  const i = keys.indexOf(cur);
  const to = e.key === 'ArrowLeft' ? (i + 1) % keys.length : e.key === 'ArrowRight' ? (i - 1 + keys.length) % keys.length
    : e.key === 'Home' ? 0 : e.key === 'End' ? keys.length - 1 : -1;
  if (to < 0) return;
  e.preventDefault();
  pick(keys[to]);
  const list = e.currentTarget;
  requestAnimationFrame(() => (list.querySelectorAll<HTMLElement>('[role="tab"]')[to])?.focus());
}

export function CustomerFile() {
  const { id = '' } = useParams();
  const { items, loading } = useCustomers();
  const c = items.find((x) => x.id === id);
  if (loading) return <div className="page"><Skeleton h={28} w="40%" /><div style={{ height: 16 }} /><Skeleton h={160} /></div>;
  if (!c) return <div className="page"><div className="card"><EmptyState icon={<UserRound size={20} />} title="הלקוח לא נמצא" action={<Link className="btn btn--secondary btn--md" to="/customers"><span className="btn__label">חזרה ללקוחות</span></Link>} /></div></div>;
  if (c.status === 'merged') {
    const target = items.find((x) => x.id === c.mergedInto);
    return <div className="page"><div className="card"><EmptyState icon={<GitMerge size={20} />} title={`"${c.name}" מוזג`} action={target && <Link className="btn btn--primary btn--md" to={`/customers/${target.id}`}><span className="btn__label">פתח את {target.name}</span></Link>}>ההזמנות, הצעות המחיר, המשימות, אנשי הקשר והכתובות עברו ללקוח "{target?.name ?? '—'}". הפעילות, ההיסטוריה והמסמכים מוצגים בתיק שלו.</EmptyState></div></div>;
  }
  return <FileBody c={c} all={items} />;
}

function FileBody({ c, all }: { c: Customer; all: Customer[] }) {
  const nav = useNavigate();
  const toast = useToast();
  const reduce = useReducedMotion();
  const { lists } = useLists();
  const { items: priceLists } = usePriceLists();
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab') as Tab | null;
  const tab: Tab = raw && ALL_TABS.includes(raw) ? raw : 'overview';
  const setTab = (t: Tab) => { const p = new URLSearchParams(params); if (t === 'overview') p.delete('tab'); else p.set('tab', t); setParams(p, { replace: true }); };
  const group = groupOf(tab);
  const [editing, setEditing] = useState(false);
  const [merging, setMerging] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const pc = primaryContact(c);
  const method = lists?.paymentMethods.find((m) => m.id === c.paymentMethod)?.label ?? c.paymentMethod;
  const pl = priceLists.find((p) => p.id === c.priceListId);
  const sharing = c.accountPhone ? all.filter((x) => x.id !== c.id && x.status !== 'merged' && x.accountPhone === c.accountPhone) : [];

  const { now, openNewOrder, thresholds } = useStore();
  const { orders: rawOrders, loading: ordersLoading } = useCustomerOrders(c.id);
  const quotes = useQuotes({ customerId: c.id });
  const corders = useMemo<OrderView[]>(() => rawOrders.map((o) => { const issues = issuesFor(o, now, thresholds); return { ...o, issues, health: healthOf(issues) }; }), [rawOrders, now, thresholds]);
  const openCount = corders.filter((o) => !CLOSED.includes(o.status)).length;
  const countOf = (t: Tab) => (t === 'orders' && !ordersLoading ? openCount : t === 'quotes' && !quotes.loading ? quotes.items.length : null);

  const openNote = () => { setTab('activity'); setTimeout(() => noteRef.current?.focus(), 50); };

  return (
    <div className="page cfile">
      <button className="auth__back" onClick={() => nav('/customers')}><ArrowRight size={16} aria-hidden="true" /> לקוחות</button>

      {/* ---------- כותרת ---------- */}
      <header className="cfile__head card">
        <div className="cfile__title-row">
          <span className="cfile__avatar" aria-hidden="true">{c.name[0]}</span>
          <div className="cfile__ident">
            <h1 className="page__title">{c.name}</h1>
            <p className="cfile__sub">
              <span className={`ctype ctype--${c.type}`}>{c.type === 'regular' ? 'קבוע' : 'מזדמן'}</span>
              {c.taxId && <span>ח.פ <Ltr>{c.taxId}</Ltr></span>}
              {c.status === 'inactive' && <span className="tag-inactive">לא פעיל</span>}
              {c.leadId && <Link to={`/leads/${c.leadId}`}>הגיע מליד</Link>}
            </p>
          </div>
          <div className="cfile__actions">
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => openNewOrder({ mode: 'full', customerId: c.id })} disabled={c.status !== 'active'}>הזמנה</Button>
            <Button icon={<MessageSquarePlus size={16} />} onClick={openNote}>הערה</Button>
            <Button icon={<Pencil size={16} />} onClick={() => setEditing(true)}>עריכה</Button>
            <Dropdown.Root dir="rtl">
              <Dropdown.Trigger asChild><button className="icon-btn" aria-label="פעולות נוספות"><MoreHorizontal size={20} /></button></Dropdown.Trigger>
              <Dropdown.Portal>
                <Dropdown.Content className="menu" align="end" sideOffset={4}>
                  {c.type === 'occasional' && (
                    <Dropdown.Item className="menu__item" onSelect={async () => { await updateCustomer(c, { type: 'regular' }); toast({ message: `${c.name} הוא עכשיו לקוח קבוע – כדאי להשלים מחירון, כתובות והנחיות חיוב` }); }}>
                      <Star size={16} aria-hidden="true" /> הפוך ללקוח קבוע
                    </Dropdown.Item>
                  )}
                  <Dropdown.Item className="menu__item" onSelect={() => setMerging(true)}><GitMerge size={16} aria-hidden="true" /> מיזוג עם לקוח אחר</Dropdown.Item>
                  <Dropdown.Separator className="menu__sep" />
                  {c.status === 'active'
                    ? <Dropdown.Item className="menu__item" onSelect={async () => { await updateCustomer(c, { status: 'inactive' }); toast({ message: `${c.name} סומן כלא פעיל`, onUndo: () => updateCustomer({ ...c, status: 'inactive' }, { status: 'active' }) }); }}><UserX size={16} aria-hidden="true" /> סמן כלא פעיל</Dropdown.Item>
                    : <Dropdown.Item className="menu__item" onSelect={async () => { await updateCustomer(c, { status: 'active' }); toast({ message: `${c.name} הופעל` }); }}><UserCheck size={16} aria-hidden="true" /> הפעל מחדש</Dropdown.Item>}
                </Dropdown.Content>
              </Dropdown.Portal>
            </Dropdown.Root>
          </div>
        </div>

        <div className="cfile__facts">
          {pc && (
            <span className="fact">
              <UserRound size={16} aria-hidden="true" /> {pc.name}{pc.role && <span className="muted"> · {pc.role}</span>}
              {pc.phone && <a className="fact__link" href={`tel:${pc.phone}`}><PhoneIcon size={14} aria-hidden="true" /> <Ltr>{fmtPhone(pc.phone)}</Ltr></a>}
              {pc.email && <a className="fact__link" href={`mailto:${pc.email}`}><Mail size={14} aria-hidden="true" /> <bdi dir="ltr">{pc.email}</bdi></a>}
            </span>
          )}
          <span className="tag"><Wallet size={14} aria-hidden="true" /> {method}</span>
          {c.accountPhone && <span className="tag">טלפון הקפה <Ltr>{fmtPhone(c.accountPhone)}</Ltr> · {sharing.length ? 'כללי' : 'ייעודי'}</span>}
          {pl && <span className="tag">מחירון: {pl.name}</span>}
          {c.poRequired && <span className="tag tag--brand"><FileCheck2 size={14} aria-hidden="true" /> תעודת רכש נדרשת</span>}
        </div>

        {c.instructions && (
          <div className="cfile__note" role="note"><b>הנחיות קבועות</b><span>{c.instructions}</span></div>
        )}
      </header>

      {/* ---------- טאבים ---------- */}
      <div className="tabs cfile__tabs" role="tablist" aria-label="תיק לקוח" onKeyDown={(e) => tabKeys(e, GROUPS, group, (g) => setTab(g.tabs[0][0]))}>
        {GROUPS.map((g) => {
          const on = g === group;
          const n = g.key === 'orders' ? countOf('orders') : null;
          return (
            <button key={g.key} id={`cf-g-${g.key}`} role="tab" aria-selected={on} aria-controls="cf-panel" tabIndex={on ? 0 : -1} className={`tab ${on ? 'is-on' : ''}`} onClick={() => !on && setTab(g.tabs[0][0])}>
              {g.label}
              {n ? <span className="tab__count" aria-label={`${n} פתוחות`}><Ltr>{n}</Ltr></span> : null}
            </button>
          );
        })}
      </div>

      {group.tabs.length > 1 && (
        <div className="subtabs" role="tablist" aria-label={group.label} onKeyDown={(e) => tabKeys(e, group.tabs.map(([t]) => t), tab, setTab)}>
          {group.tabs.map(([k, label]) => {
            const n = countOf(k);
            return (
              <button key={k} id={`cf-t-${k}`} role="tab" aria-selected={tab === k} aria-controls="cf-panel" tabIndex={tab === k ? 0 : -1} className={`subtab ${tab === k ? 'is-on' : ''}`} onClick={() => setTab(k)}>
                {label}{n !== null && <span className="subtab__n"><Ltr>{n}</Ltr></span>}
              </button>
            );
          })}
        </div>
      )}

      {/* החלפת טאב: הופעה רכה בלבד – התוכן לא תלוי בסיום אנימציית יציאה */}
      <motion.div key={tab} id="cf-panel" role="tabpanel" aria-labelledby={group.tabs.length > 1 ? `cf-t-${tab}` : `cf-g-${group.key}`} className="cfile__panel" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }}>
          {tab === 'overview' && <Overview c={c} onTab={setTab} orders={corders} loading={ordersLoading} />}
          {tab === 'orders' && <OrdersTab c={c} orders={corders} loading={ordersLoading} />}
          {tab === 'quotes' && <QuotesTab c={c} items={quotes.items} loading={quotes.loading} />}
          {tab === 'monthly' && <MonthlyTab orders={corders} loading={ordersLoading} />}
          {tab === 'prices' && <PricesTab c={c} />}
          {tab === 'payment' && <PaymentTab c={c} sharing={sharing} method={method} onEdit={() => setEditing(true)} />}
          {tab === 'contacts' && <ContactsTab c={c} />}
          {tab === 'docs' && <CustomerDocsSection customerId={c.id} mergedFrom={c.mergedFrom} />}
          {tab === 'activity' && <ActivityTab c={c} noteRef={noteRef} />}
          {tab === 'history' && <HistoryTab c={c} />}
      </motion.div>

      {editing && <CustomerForm open onClose={() => setEditing(false)} customers={all} editing={c} />}
      {merging && <MergeDialog source={c} all={all} onClose={() => setMerging(false)} onMerged={(t) => nav(`/customers/${t.id}`)} />}
    </div>
  );
}

/* ---------- סקירה ---------- */
const PERIODS: [number, string][] = [[1, 'החודש'], [3, '3 חודשים'], [12, '12 חודשים']];
/* הכנסות – מ-data/metrics.ts, כמו בבורד ובדוחות. "החודש" = מה-1 ועד היום, גם בסקירה וגם בסיכומים החודשיים */
const qSum = (list: OrderView[]) => revenue(list);

function Overview({ c, onTab, orders, loading }: { c: Customer; onTab: (t: Tab) => void; orders: OrderView[]; loading: boolean }) {
  const { now } = useStore();
  const panel = usePanel();
  const [months, setMonths] = useState(1);
  const today = toISODate(now);
  const since = toISODate(new Date(now.getFullYear(), now.getMonth() - (months - 1), 1));
  const live = orders.filter((o) => o.status !== 'cancelled');
  const inPeriod = live.filter((o) => o.date >= since && o.date <= today);
  const total = qSum(inPeriod);
  const nowKey = `${today}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const key = (o: OrderView) => `${o.date}T${o.time}`;
  const last = live.filter((o) => key(o) <= nowKey).sort((x, y) => key(y).localeCompare(key(x)))[0];
  const next = orders.filter((o) => !CLOSED.includes(o.status) && key(o) > nowKey).sort((x, y) => key(x).localeCompare(key(y)))[0];
  const days = last ? Math.round((new Date(today + 'T12:00').getTime() - new Date(last.date + 'T12:00').getTime()) / 86400000) : null;
  const unpaid = qSum(live.filter((o) => (o.payment === 'pending' || o.payment === 'failed') && o.date <= today));
  const kpis: [string, ReactNode][] = [
    ['הזמנות בתקופה', <Ltr key="a">{inPeriod.length}</Ltr>],
    ['סך (לפי סכום Q)', <Ltr key="b">{fmtMoney(total)}</Ltr>],
    ['ממוצע הזמנה', inPeriod.length ? <Ltr key="c">{fmtMoney(Math.round(total / inPeriod.length))}</Ltr> : '—'],
    ['ימים מאז הזמנה אחרונה', days === null ? '—' : <Ltr key="d">{days}</Ltr>],
    ['פתוח לתשלום', <Ltr key="e">{fmtMoney(unpaid)}</Ltr>],
  ];
  const card = (title: string, o: OrderView | undefined, empty: string) => (
    <div className="card ov__card">
      <span className="kpi__label">{title}</span>
      {o ? (
        <button className="ov__order" onClick={(e) => panel.open(o.id, e.currentTarget)}>
          <b>הזמנה <Ltr>{o.id}</Ltr></b>
          <span><Ltr>{fmtDate(o.date)}</Ltr> · <Ltr>{o.time}</Ltr> · {o.branchName}</span>
          <span><Ltr>{fmtMoney(revenueOf(o))}</Ltr></span>
        </button>
      ) : <span className="muted">{empty}</span>}
    </div>
  );
  return (
    <div className="ov">
      <div className="ov__period seg" role="group" aria-label="תקופה">
        {PERIODS.map(([m, label]) => <button key={m} className={months === m ? 'is-on' : ''} aria-pressed={months === m} onClick={() => setMonths(m)}>{label}</button>)}
      </div>
      <div className="ov__kpis">
        {kpis.map(([k, v]) => (
          <div key={k} className="kpi card"><span className="kpi__label">{k}</span><span className={`kpi__value ${loading ? '' : 'is-live'}`}>{loading ? <Skeleton w={60} h={22} /> : v}</span></div>
        ))}
      </div>
      <p className="ov__note muted">לפי תאריך אספקה וסכום Q, עד היום, בלי הזמנות שבוטלו. "פתוח לתשלום" – מכל החודשים.</p>
      {!loading && orders.length > 0 && (
        <section className="card ov__chart" aria-label="סך לפי חודש – 12 חודשים">
          <div className="card__head"><h2 className="card__title">12 חודשים אחרונים</h2><button className="link" onClick={() => onTab('monthly')}>לסיכום החודשי</button></div>
          <BarChart kind="time" money data={lastMonths(orders, now).reverse().map((m) => ({ id: m.key, label: m.label, value: m.sum }))} onPick={() => onTab('monthly')} />
        </section>
      )}
      <div className="ov__cards">
        {card('הזמנה אחרונה', last, 'אין עדיין הזמנות')}
        {card('הזמנה הבאה', next, 'אין הזמנה פתוחה')}
        <div className="card ov__card">
          <span className="kpi__label">פרטים חסרים</span>
          {missingOf(c).length === 0 ? <span className="ok-text"><Check size={14} aria-hidden="true" /> התיק מלא</span> : (
            <ul className="ov__missing">{missingOf(c).map(([label, t]) => <li key={label}><button className="link" onClick={() => onTab(t)}>{label}</button></li>)}</ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- הזמנות הלקוח: אותה טבלה של מרכז ההזמנות, מסוננת ללקוח ---------- */
/* ---------- 12 חודשים אחרונים: שורה לכל חודש (אפיון 6.6, 10) ---------- */
type MonthRow = { key: string; label: string; count: number; sum: number; avg: number; cancelled: number; gaps: number; unpaid: number; orders: OrderView[] };
function lastMonths(orders: OrderView[], now: Date): MonthRow[] {
  const today = toISODate(now);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    // החודש הנוכחי – עד היום, בלי הזמנות עתידיות (כמו "החודש" בסקירה, בבורד ובדוחות)
    const all = orders.filter((o) => o.date.startsWith(key) && o.date <= today);
    const lv = all.filter(isLive);
    const sum = revenue(lv);
    return {
      key, label: `${key.slice(5)}.${key.slice(0, 4)}`, count: lv.length, sum, avg: lv.length ? Math.round(sum / lv.length) : 0,
      cancelled: all.length - lv.length, gaps: lv.filter((o) => o.qAmount !== undefined && o.qAmount !== o.amount).length,
      unpaid: revenue(lv.filter((o) => o.payment === 'pending' || o.payment === 'failed')), orders: all,
    };
  });
}

// הזמנות שסופקו (או סופקו חלקית) באיחור
const lateOf = (list: OrderView[]) => onTime(list).late;

function MonthlyTab({ orders, loading }: { orders: OrderView[]; loading: boolean }) {
  const { now } = useStore();
  const panel = usePanel();
  const [open, setOpen] = useState<string | null>(null);
  if (loading) return <div className="card cfile__loading"><Skeleton h={18} /><Skeleton h={18} /></div>;
  const rows = lastMonths(orders, now);
  const total = rows.reduce((t, r) => ({ count: t.count + r.count, sum: t.sum + r.sum, cancelled: t.cancelled + r.cancelled, gaps: t.gaps + r.gaps, unpaid: t.unpaid + r.unpaid }), { count: 0, sum: 0, cancelled: 0, gaps: 0, unpaid: 0 });
  const picked = rows.find((r) => r.key === open);
  // חודשים רצופים בלי אף הזמנה (גם לא מבוטלת) מקופלים לשורה אחת
  const runs = rows.reduce<{ empty: boolean; rows: MonthRow[] }[]>((acc, r) => {
    const empty = r.orders.length === 0;
    const last = acc[acc.length - 1];
    if (last && last.empty && empty) last.rows.push(r); else acc.push({ empty, rows: [r] });
    return acc;
  }, []);
  return (
    <div className="card monthly">
      <div className="card__head"><h2 className="card__title">סיכום חודשי</h2><span className="muted monthly__hint">12 חודשים · לפי תאריך אספקה וסכום Q · החודש הנוכחי עד היום</span></div>
      <div className="report__scroll">
        <table className="rtable">
          <caption className="sr-only">סיכום חודשי ל-12 החודשים האחרונים</caption>
          <thead><tr><th>חודש</th><th className="num">הזמנות</th><th className="num">סך</th><th className="num">ממוצע</th><th className="num">ביטולים</th><th className="num">באיחור</th><th className="num">חלקית</th><th className="num">פערי Q</th><th className="num">פתוח לתשלום</th></tr></thead>
          <tbody>
            {runs.map((run) => run.empty ? (
              <tr key={run.rows[0].key} className="monthly__empty">
                <td colSpan={9}>{run.rows.length === 1 ? <>אין הזמנות ב-<Ltr>{run.rows[0].label}</Ltr></> : <>אין הזמנות מ-<Ltr>{run.rows[run.rows.length - 1].label}</Ltr> עד <Ltr>{run.rows[0].label}</Ltr></>}</td>
              </tr>
            ) : run.rows.map((r) => (
              <tr key={r.key} className={open === r.key ? 'is-picked' : ''} tabIndex={0} aria-expanded={open === r.key} aria-label={`${r.label}: ${r.count} הזמנות. Enter להצגת ההזמנות`}
                onClick={() => setOpen(open === r.key ? null : r.key)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(open === r.key ? null : r.key); } }}>
                <td><Ltr>{r.label}</Ltr></td>
                <td className="num"><Ltr>{r.count}</Ltr></td>
                <td className="num"><Ltr>{fmtMoney(r.sum)}</Ltr></td>
                <td className="num"><Ltr>{r.count ? fmtMoney(r.avg) : '—'}</Ltr></td>
                <td className="num"><Ltr>{r.cancelled}</Ltr></td>
                <td className={`num ${lateOf(r.orders) ? 'monthly__warn' : ''}`}><Ltr>{lateOf(r.orders)}</Ltr></td>
                <td className="num"><Ltr>{r.orders.filter((o) => o.status === 'partial').length}</Ltr></td>
                <td className={`num ${r.gaps ? 'monthly__warn' : ''}`}><Ltr>{r.gaps}</Ltr></td>
                <td className={`num ${r.unpaid ? 'monthly__warn' : ''}`}><Ltr>{fmtMoney(r.unpaid)}</Ltr></td>
              </tr>
            )))}
          </tbody>
          <tfoot><tr><td>סה"כ</td><td className="num"><Ltr>{total.count}</Ltr></td><td className="num"><Ltr>{fmtMoney(total.sum)}</Ltr></td><td className="num"><Ltr>{total.count ? fmtMoney(Math.round(total.sum / total.count)) : '—'}</Ltr></td><td className="num"><Ltr>{total.cancelled}</Ltr></td><td className="num"><Ltr>{lateOf(rows.flatMap((r) => r.orders))}</Ltr></td><td className="num"><Ltr>{rows.flatMap((r) => r.orders).filter((o) => o.status === 'partial').length}</Ltr></td><td className="num"><Ltr>{total.gaps}</Ltr></td><td className="num"><Ltr>{fmtMoney(total.unpaid)}</Ltr></td></tr></tfoot>
        </table>
      </div>
      {picked && (
        <ul className="report__orders monthly__orders" aria-label={`ההזמנות של ${picked.label}`}>
          {picked.orders.length === 0 && <li className="muted monthly__none">אין הזמנות בחודש הזה</li>}
          {[...picked.orders].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map((o) => (
            <li key={o.id}>
              <button onClick={(e) => panel.open(o.id, e.currentTarget)}>
                <span className="report__oid"><Ltr>{o.id}</Ltr></span>
                <span className="report__odate"><Ltr>{fmtDate(o.date)}</Ltr> <Ltr>{o.time}</Ltr></span>
                <span className="report__ocust">{o.branchName}</span>
                <span className="report__osum"><Ltr>{fmtMoney(o.qAmount ?? o.amount)}</Ltr>{o.status === 'cancelled' && <span className="muted"> · בוטלה</span>}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OrdersTab({ c, orders, loading }: { c: Customer; orders: OrderView[]; loading: boolean }) {
  const { now, openNewOrder } = useStore();
  const [view, setView] = useState<'open' | 'past' | 'cancelled'>('open');
  const today = toISODate(now);
  const byTime = (a: OrderView, b: OrderView) => (a.date + a.time).localeCompare(b.date + b.time);
  const lists = {
    open: orders.filter((o) => !CLOSED.includes(o.status)).sort(byTime),
    past: orders.filter((o) => o.status === 'delivered' || o.status === 'partial').sort((a, b) => byTime(b, a)),
    cancelled: orders.filter((o) => o.status === 'cancelled').sort((a, b) => byTime(b, a)),
  };
  const V: [typeof view, string][] = [['open', 'פתוחות'], ['past', 'סופקו'], ['cancelled', 'בוטלו']];
  if (loading) return <div className="card cfile__loading"><Skeleton h={18} /><Skeleton h={18} /></div>;
  if (!orders.length) {
    return (
      <div className="card">
        <EmptyState icon={<ClipboardList size={20} />} title="אין עדיין הזמנות ללקוח"
          action={c.status === 'active' && <Button variant="primary" icon={<Plus size={16} />} onClick={() => openNewOrder({ mode: 'full', customerId: c.id })}>הזמנה ראשונה</Button>}>
          הפרטים הקבועים של {c.name} ימולאו בהזמנה אוטומטית.
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="cfile__orders">
      <div className="seg" role="group" aria-label="סינון הזמנות הלקוח">
        {V.map(([k, label]) => <button key={k} className={view === k ? 'is-on' : ''} aria-pressed={view === k} onClick={() => setView(k)}>{label} <Ltr>{lists[k].length}</Ltr></button>)}
      </div>
      <OrdersTable rows={lists[view]} showDate caption={`הזמנות ${c.name}`}
        emptyText={view === 'open' ? 'אין הזמנות פתוחות' : view === 'past' ? 'אין הזמנות שסופקו' : 'אין הזמנות שבוטלו'} />
      {view === 'open' && lists.open.some((o) => o.date < today) && <p className="muted ov__note">יש הזמנות שמועדן עבר ועדיין פתוחות – כדאי לסגור אותן.</p>}
    </div>
  );
}

function missingOf(c: Customer): [string, Tab][] {
  return customerGaps(c).map((g) => [g.label, g.tab]);
}

/* ---------- הצעות מחיר של הלקוח ---------- */
function QuotesTab({ c, items, loading }: { c: Customer; items: Quote[]; loading: boolean }) {
  const nav = useNavigate();
  const { now } = useStore();
  const today = toISODate(now);
  return (
    <div className="card">
      <div className="card__head">
        <h2 className="card__title">הצעות מחיר</h2>
        <Button size="sm" className="card__head-end" icon={<Plus size={16} />} onClick={() => nav(`/quotes/new?customer=${c.id}`)}>הצעה חדשה</Button>
      </div>
      {loading ? <div className="loading-rows"><Skeleton h={30} /></div> : items.length === 0 ? <p className="muted cfile__plhint">עוד אין הצעות מחיר ללקוח. הצעה חדשה מכאן כבר מקושרת ללקוח ולמחירון שלו.</p> : (
        <table className="items">
          <thead><tr><th>הצעה</th><th>תאריך</th><th>סכום</th><th>סטטוס</th><th>עדכון אחרון</th></tr></thead>
          <tbody>
            {items.map((q) => {
              const exp = isExpired(q, today);
              return (
                <tr key={q.id} className="cfile__qrow" onClick={() => nav(`/quotes/${q.id}`)}>
                  <td><Link to={`/quotes/${q.id}`}><Ltr>{q.id}</Ltr></Link></td>
                  <td><Ltr>{fmtDate(q.issueDate)}</Ltr></td>
                  <td><Ltr>{fmtMoney(q.total)}</Ltr></td>
                  <td><span className={`qstat qstat--${exp ? 'expired' : q.status}`}>{exp ? 'פג תוקף' : SHORT_STATUS[q.status]}{q.orderId ? <> · הזמנה <Ltr>{q.orderId}</Ltr></> : null}</span></td>
                  <td className="muted">{q.lastNote || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ---------- מחירון + מחירים ייחודיים ללקוח ---------- */
function PricesTab({ c }: { c: Customer }) {
  const { items: priceLists } = usePriceLists();
  const toast = useToast();
  const pl = priceLists.find((p) => p.id === c.priceListId);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  if (!pl) {
    return (
      <div className="card">
        <PriceNote c={c} />
        <EmptyState icon={<Wallet size={20} />} title="אין מחירון משויך" action={
          <select className="input cfile__plsel" value="" onChange={async (e) => { await updateCustomer(c, { priceListId: e.target.value }); toast({ message: 'המחירון שויך ללקוח' }); }} aria-label="שייך מחירון">
            <option value="">בחר מחירון…</option>
            {priceLists.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        }>מחירונים נבנים במסך "מחירונים".</EmptyState>
      </div>
    );
  }

  const custom = (itemId: string) => c.customPrices.find((x) => x.itemId === itemId);
  // editing = "<itemId>:d" (משלוח) או "<itemId>:p" (איסוף עצמי)
  const save = async (key: string) => {
    const [itemId, mode] = key.split(':');
    const v = Number(draft.replace(/[^\d.]/g, ''));
    setEditing(null);
    const item = pl.items.find((i) => i.id === itemId);
    if (!item) return;
    const base = mode === 'p' ? item.pickupPrice ?? item.price : item.price;
    const cur = custom(itemId);
    const d = mode === 'd' ? (!draft.trim() || !(v > 0) || v === base ? undefined : v) : cur && cur.price !== item.price ? cur.price : undefined;
    const pk = mode === 'p' ? (!draft.trim() || !(v > 0) || v === base ? undefined : v) : cur?.pickupPrice;
    const rest = c.customPrices.filter((x) => x.itemId !== itemId);
    // שורה נשמרת רק אם יש בה מחיר מיוחד למשלוח או לאיסוף. מוצר בלי מחיר במחירון – המחיר המיוחד הוא המחיר היחיד
    const next = d === undefined && pk === undefined ? rest : [...rest, { itemId, price: d ?? item.price ?? 0, ...(pk !== undefined ? { pickupPrice: pk } : {}) }];
    await updateCustomer(c, { customPrices: next });
    toast({ message: !draft.trim() || v === base ? 'המחיר חזר למחיר המחירון' : `מחיר ייחודי ל${c.name} (${mode === 'p' ? 'איסוף עצמי' : 'משלוח'}): ${fmtMoney(v)}` });
  };
  const cell = (it: (typeof pl.items)[number], mode: 'd' | 'p') => {
    const cp = custom(it.id);
    const base = mode === 'p' ? it.pickupPrice ?? it.price : it.price;
    const special = mode === 'p' ? cp?.pickupPrice : cp && cp.price && cp.price !== it.price ? cp.price : undefined;
    const key = `${it.id}:${mode}`;
    const label = mode === 'p' ? 'איסוף עצמי' : 'משלוח';
    return editing === key ? (
      <input className="input input--sm input--ltr cfile__priceinput" autoFocus inputMode="decimal" value={draft} aria-label={`מחיר ללקוח ב${label}: ${it.name}`}
        onChange={(e) => setDraft(e.target.value)} onBlur={() => save(key)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(key); } if (e.key === 'Escape') { e.preventDefault(); setEditing(null); } }} />
    ) : (
      <button className={`pricecell ${special !== undefined ? 'is-custom' : ''}`} onClick={() => { setEditing(key); setDraft(special !== undefined ? String(special) : ''); }} aria-label={`${it.name}, ${label}: ${special !== undefined ? `מחיר ייחודי ${fmtMoney(special)}` : base ? `מחיר מחירון ${fmtMoney(base)}` : 'אין מחיר במחירון'}. לחץ לשינוי`}>
        {special !== undefined ? <><Ltr>{fmtMoney(special)}</Ltr><span className="pricecell__tag">ייחודי</span></> : <span className="muted">{base ? <Ltr>{fmtMoney(base)}</Ltr> : 'אין מחיר'}</span>}
        <Pencil size={14} aria-hidden="true" />
      </button>
    );
  };

  return (
    <div className="card">
      <div className="card__head">
        <h2 className="card__title">{pl.name}</h2>
        <span className="muted">כל המחירים כוללים מע"מ</span>
        <span className="card__head-end cfile__placts">
          <select className="input input--sm cfile__plsel" value={pl.id} aria-label="החלף מחירון" onChange={async (e) => { await updateCustomer(c, { priceListId: e.target.value }); toast({ message: e.target.value ? 'המחירון של הלקוח הוחלף' : 'המחירון הוסר מהלקוח' }); }}>
            {priceLists.filter((p) => p.active || p.id === pl.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="">בלי מחירון</option>
          </select>
          <Link className="link" to={`/pricelists?id=${pl.id}`}>פתח מחירון</Link>
        </span>
      </div>
      <PriceNote c={c} />
      {pl.note && <p className="cfile__plhint cfile__plcond">תנאי המחירון: {pl.note}</p>}
      <p className="muted cfile__plhint">מחיר ייחודי ללקוח לא משנה את המחירון עצמו. לחיצה על מחיר – שינוי; Enter שומר, שדה ריק מחזיר למחיר המחירון.</p>
      <table className="items cfile__prices">
        <thead><tr><th>מוצר</th><th>ללקוח – משלוח</th><th>ללקוח – איסוף עצמי</th></tr></thead>
        <tbody>
          {CATEGORIES.map((cat) => {
            const its = pl.items.filter((i) => i.active && i.category === cat);
            return its.length > 0 && [
              <tr key={cat} className="cfile__plcat"><th colSpan={3}>{cat}</th></tr>,
              ...its.map((it) => (
                <tr key={it.id}>
                  <td>{it.name}</td>
                  <td>{cell(it, 'd')}</td>
                  <td>{cell(it, 'p')}</td>
                </tr>
              )),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- תשלום והקפה ---------- */
function PaymentTab({ c, sharing, method, onEdit }: { c: Customer; sharing: Customer[]; method: string; onEdit: () => void }) {
  return (
    <div className="card cfile__kv">
      <div className="card__head"><h2 className="card__title">תשלום והקפה</h2><Button size="sm" className="card__head-end" icon={<Pencil size={16} />} onClick={onEdit}>עריכה</Button></div>
      <div className="card__body">
        <div className="kv"><span className="kv__k">אמצעי תשלום</span><span className="kv__v">{method}</span></div>
        <div className="kv"><span className="kv__k">טלפון הקפה</span><span className="kv__v">{c.accountPhone ? <><Ltr>{fmtPhone(c.accountPhone)}</Ltr> · {sharing.length ? <>כללי – משמש גם את {sharing.map((s, i) => <span key={s.id}>{i > 0 && ', '}<Link to={`/customers/${s.id}`}>{s.name}</Link></span>)}</> : 'ייעודי ללקוח הזה'}</> : '—'}</span></div>
        <div className="kv"><span className="kv__k">תעודת רכש</span><span className="kv__v">{c.poRequired ? 'נדרשת לכל הזמנה' : 'לא נדרשת'}</span></div>
        <div className="kv"><span className="kv__k">הנחיות חיוב קבועות</span><span className="kv__v">{c.billingInstructions || <span className="warn-text">לא הוגדרו</span>}</span></div>
        <p className="muted cfile__plhint">ההנחיות נטענות אוטומטית ל"הערות לחיוב" בדוח ההקפות בסוף החודש.</p>
      </div>
    </div>
  );
}

/* ---------- אנשי קשר וכתובות ---------- */
function ContactsTab({ c }: { c: Customer }) {
  const toast = useToast();
  const { items: branches } = useBranches();
  const { items: clusters } = useClusters();
  const [contactEdit, setContactEdit] = useState<Contact | null>(null);
  const [addrEdit, setAddrEdit] = useState<Address | null>(null);

  const saveContacts = async (next: Contact[], msg: string) => { await updateCustomer(c, { contacts: next }); toast({ message: msg }); };
  const saveAddresses = async (next: Address[], msg: string) => { await updateCustomer(c, { addresses: next }); toast({ message: msg }); };
  const branchLabel = (id: string) => { const b = branches.find((x) => x.id === id); return b ? `${b.name} · ${clusters.find((x) => x.id === b.clusterId)?.name ?? ''}` : ''; };

  return (
    <div className="cgrid">
      <section className="card">
        <div className="card__head"><h2 className="card__title">אנשי קשר</h2><Button size="sm" className="card__head-end" icon={<Plus size={16} />} onClick={() => setContactEdit({ id: newId(), name: '', role: '', phone: '', email: '', primary: c.contacts.length === 0 })}>איש קשר</Button></div>
        <ul className="plist">
          {c.contacts.length === 0 && <li className="muted plist__empty">אין עדיין אנשי קשר</li>}
          {c.contacts.map((x) => (
            <li key={x.id} className="pitem">
              <div className="pitem__main">
                <b>{x.name}</b>{x.primary && <span className="tag tag--brand pitem__primary">ראשי</span>}{x.role && <span className="muted"> · {x.role}</span>}
                <span className="pitem__meta">
                  {x.phone && <a href={`tel:${x.phone}`}><Ltr>{fmtPhone(x.phone)}</Ltr></a>}
                  {x.email && <a href={`mailto:${x.email}`}><bdi dir="ltr">{x.email}</bdi></a>}
                  {x.emails?.map((m) => <a key={m} href={`mailto:${m}`}><bdi dir="ltr">{m}</bdi></a>)}
                </span>
              </div>
              {!x.primary && <Button size="sm" variant="ghost" onClick={() => saveContacts(c.contacts.map((y) => ({ ...y, primary: y.id === x.id })), `${x.name} הוא עכשיו איש הקשר הראשי`)}>הפוך לראשי</Button>}
              <button className="icon-btn icon-btn--sm" aria-label={`ערוך את ${x.name}`} onClick={() => setContactEdit(x)}><Pencil size={16} /></button>
              <button className="icon-btn icon-btn--sm" aria-label={`הסר את ${x.name}`} onClick={() => saveContacts(c.contacts.filter((y) => y.id !== x.id).map((y, i, arr) => ({ ...y, primary: x.primary ? i === 0 : y.primary || arr.length === 1 })), `${x.name} הוסר`)}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
        {contactEdit && <ContactEditor value={contactEdit} onCancel={() => setContactEdit(null)} onSave={async (v) => {
          const exists = c.contacts.some((y) => y.id === v.id);
          await saveContacts(exists ? c.contacts.map((y) => (y.id === v.id ? v : y)) : [...c.contacts, v], exists ? 'איש הקשר עודכן' : 'איש קשר נוסף');
          setContactEdit(null);
        }} />}
      </section>

      <section className="card">
        <div className="card__head"><h2 className="card__title">כתובות אספקה קבועות</h2><Button size="sm" className="card__head-end" icon={<Plus size={16} />} onClick={() => setAddrEdit({ id: newId(), label: '', address: '', directions: '', preferredBranchId: '' })}>כתובת</Button></div>
        <ul className="plist">
          {c.addresses.length === 0 && <li className="muted plist__empty">אין עדיין כתובות קבועות</li>}
          {c.addresses.map((a) => (
            <li key={a.id} className="pitem">
              <div className="pitem__main">
                <b>{a.label || 'כתובת'}</b> <span>· {a.address}</span>
                <span className="pitem__meta">
                  {a.directions && <span>{a.directions}</span>}
                  {a.preferredBranchId && <span className="muted"><Star size={14} aria-hidden="true" /> סניף מועדף: {branchLabel(a.preferredBranchId)}</span>}
                </span>
              </div>
              <button className="icon-btn icon-btn--sm" aria-label={`ערוך כתובת ${a.label}`} onClick={() => setAddrEdit(a)}><Pencil size={16} /></button>
              <button className="icon-btn icon-btn--sm" aria-label={`הסר כתובת ${a.label}`} onClick={() => saveAddresses(c.addresses.filter((y) => y.id !== a.id), 'הכתובת הוסרה')}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
        {addrEdit && <AddressEditor value={addrEdit} branches={branches.filter((b) => b.active || b.id === addrEdit.preferredBranchId)} branchLabel={branchLabel} onCancel={() => setAddrEdit(null)} onSave={async (v) => {
          const exists = c.addresses.some((y) => y.id === v.id);
          await saveAddresses(exists ? c.addresses.map((y) => (y.id === v.id ? v : y)) : [...c.addresses, v], exists ? 'הכתובת עודכנה' : 'כתובת נוספה');
          setAddrEdit(null);
        }} />}
      </section>
    </div>
  );
}

function ContactEditor({ value, onSave, onCancel }: { value: Contact; onSave: (v: Contact) => Promise<void>; onCancel: () => void }) {
  const [v, setV] = useState({ ...value, phone: value.phone ? fmtPhone(value.phone) : '' });
  const [err, setErr] = useState('');
  const submit = async () => {
    if (!v.name.trim()) return setErr('חובה: שם');
    const pe = phoneError(v.phone); if (pe) return setErr(pe);
    if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) return setErr('כתובת מייל לא תקינה');
    await onSave({ ...v, name: v.name.trim(), phone: cleanPhone(v.phone), email: v.email.trim(), role: v.role.trim() });
  };
  return (
    <form className="pedit" onSubmit={(e) => { e.preventDefault(); submit(); }} onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <div className="pedit__grid">
        <Field label="שם (חובה)"><input className="input input--sm" autoFocus value={v.name} onChange={(e) => { setV({ ...v, name: e.target.value }); setErr(''); }} /></Field>
        <Field label="תפקיד"><input className="input input--sm" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })} /></Field>
        <Field label="טלפון"><input className="input input--sm input--ltr" inputMode="tel" value={v.phone} onChange={(e) => { setV({ ...v, phone: e.target.value }); setErr(''); }} /></Field>
        <Field label="מייל"><input className="input input--sm input--ltr" value={v.email} onChange={(e) => { setV({ ...v, email: e.target.value }); setErr(''); }} /></Field>
      </div>
      {err && <p className="pop__err" role="alert">{err}</p>}
      <div className="pedit__actions"><Button size="sm" variant="primary" type="submit" icon={<Check size={16} />}>שמור</Button><Button size="sm" variant="ghost" type="button" onClick={onCancel}>ביטול</Button></div>
    </form>
  );
}

function AddressEditor({ value, branches, branchLabel, onSave, onCancel }: { value: Address; branches: { id: string; name: string }[]; branchLabel: (id: string) => string; onSave: (v: Address) => Promise<void>; onCancel: () => void }) {
  const [v, setV] = useState(value);
  const [err, setErr] = useState('');
  return (
    <form className="pedit" onSubmit={async (e) => { e.preventDefault(); if (!v.address.trim()) return setErr('חובה: כתובת מלאה'); await onSave({ ...v, label: v.label.trim(), address: v.address.trim(), directions: v.directions.trim() }); }} onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <div className="pedit__grid">
        <Field label="כינוי"><input className="input input--sm" autoFocus value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} placeholder="משרד ראשי" /></Field>
        <Field label="כתובת מלאה (חובה)"><input className="input input--sm" value={v.address} onChange={(e) => { setV({ ...v, address: e.target.value }); setErr(''); }} /></Field>
        <Field label="הוראות הגעה"><input className="input input--sm" value={v.directions} onChange={(e) => setV({ ...v, directions: e.target.value })} placeholder="קומה 3, להתקשר מהלובי" /></Field>
        <Field label="סניף מועדף">
          <select className="input input--sm" value={v.preferredBranchId} onChange={(e) => setV({ ...v, preferredBranchId: e.target.value })}>
            <option value="">ללא</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{branchLabel(b.id)}</option>)}
          </select>
        </Field>
      </div>
      {err && <p className="pop__err" role="alert">{err}</p>}
      <div className="pedit__actions"><Button size="sm" variant="primary" type="submit" icon={<Check size={16} />}>שמור</Button><Button size="sm" variant="ghost" type="button" onClick={onCancel}>ביטול</Button></div>
    </form>
  );
}

/* ---------- פעילות: הערות, שיחות, משימות חזרה ---------- */
function ActivityTab({ c, noteRef }: { c: Customer; noteRef: RefObject<HTMLTextAreaElement> }) {
  const items = useActivity(withMerged(c));
  const toast = useToast();
  const [kind, setKind] = useState<'note' | 'call' | 'followup'>('note');
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const [err, setErr] = useState('');
  const KIND = { note: 'הערה', call: 'שיחה', followup: 'משימת חזרה' } as const;
  const submit = async () => {
    if (!text.trim()) return setErr('כתוב משהו לפני השמירה');
    if (/\d{13,}/.test(text)) return setErr('אסור לרשום כאן מספר כרטיס אשראי');
    if (kind === 'followup' && !due) return setErr('למשימת חזרה צריך תאריך');
    try { await addActivity(c.id, { kind, text, due: kind === 'followup' ? due : undefined }, c.name); setText(''); setDue(''); setErr(''); toast({ message: `${KIND[kind]} נשמרה` }); }
    catch { setErr('השמירה נכשלה'); }
  };
  return (
    <div className="card">
      <form className="composer" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="seg seg--sm" role="radiogroup" aria-label="סוג">
          {(Object.keys(KIND) as (keyof typeof KIND)[]).map((k) => <button type="button" key={k} role="radio" aria-checked={kind === k} className={kind === k ? 'is-on' : ''} onClick={() => setKind(k)}>{KIND[k]}</button>)}
        </div>
        <textarea ref={noteRef} className="input composer__ta" rows={2} value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} placeholder={kind === 'call' ? 'מה סוכם בשיחה?' : kind === 'followup' ? 'למה לחזור ללקוח?' : 'הערה פנימית על הלקוח'} aria-label="תוכן"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }} />
        <div className="composer__row">
          {kind === 'followup' && <label className="check-inline">תאריך <input className="input input--sm" type="date" value={due} onChange={(e) => { setDue(e.target.value); setErr(''); }} /></label>}
          {err && <span className="pop__err" role="alert">{err}</span>}
          <Button size="sm" variant="primary" type="submit" className="composer__send" kbd="Ctrl+Enter">שמור</Button>
        </div>
      </form>
      <ol className="timeline cfile__timeline">
        {items.length === 0 && <li className="muted">אין עדיין פעילות. הערות, שיחות ומשימות חזרה יופיעו כאן.</li>}
        {items.map((a) => (
          <li key={a.id}>
            <span className="timeline__at"><Ltr>{a.at ? fmtTs(a.at.toDate()) : '…'}</Ltr></span>
            <span><span className={`akind akind--${a.kind}`}>{KIND[a.kind]}</span> <b>{a.byName}</b>{a.due && <span className="muted"> · לחזור ב-<Ltr>{a.due.split('-').reverse().join('.')}</Ltr></span>}<br />{a.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* הערת מחיר ידנית – למשל "מחיר לפי ממשק WellBe". מוצגת בטופס ההזמנה מעל הפריטים */
function PriceNote({ c }: { c: Customer }) {
  const toast = useToast();
  const [v, setV] = useState(c.priceNote ?? '');
  const [err, setErr] = useState('');
  const save = async () => {
    if (v.trim() === (c.priceNote ?? '')) return;
    if (/\d{13,}/.test(v)) return setErr('אסור לרשום כאן מספר כרטיס אשראי');
    setErr('');
    await updateCustomer(c, { priceNote: v.trim() });
    toast({ message: v.trim() ? 'הערת המחיר נשמרה' : 'הערת המחיר הוסרה' });
  };
  return (
    <div className="cfile__pricenote">
      <label className="field"><span className="field__label">הערת מחיר</span>
        <input className="input" value={v} onChange={(e) => setV(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
          placeholder="למשל: מחיר לפי המחיר בממשק WellBe" aria-invalid={!!err || undefined} />
      </label>
      {err && <span className="cform__err" role="alert">{err}</span>}
    </div>
  );
}

/* ---------- היסטוריה: שינויים בפרטי הלקוח, מהיומן שאי אפשר לערוך ---------- */
const FIELD_LABEL: Record<string, string> = {
  name: 'שם', type: 'סוג', taxId: 'ח.פ', businessAddress: 'כתובת עסק', paymentMethod: 'אמצעי תשלום', accountPhone: 'טלפון הקפה', poRequired: 'תעודת רכש',
  instructions: 'הנחיות קבועות', priceNote: 'הערת מחיר', billingInstructions: 'הנחיות חיוב', priceListId: 'מחירון', status: 'מצב', contacts: 'אנשי קשר', addresses: 'כתובות', customPrices: 'מחירים ייחודיים',
};
function HistoryTab({ c }: { c: Customer }) {
  const rows = useCustomerHistory(withMerged(c));
  const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : Array.isArray(v) ? `${v.length} פריטים` : typeof v === 'boolean' ? (v ? 'כן' : 'לא') : String(v));
  const ACTION: Record<string, string> = { create: 'הלקוח נוצר', update: 'עדכון', status: 'שינוי מצב', merge: 'מיזוג' };
  return (
    <div className="card">
      <ol className="timeline cfile__timeline">
        {rows.length === 0 && <li className="muted">אין עדיין שינויים.</li>}
        {rows.map((r) => (
          <li key={r.id}>
            <span className="timeline__at"><Ltr>{r.at ? fmtTs(r.at.toDate()) : '…'}</Ltr></span>
            <span>
              <b>{r.byName}</b> · {ACTION[r.action] ?? r.action}
              {r.action !== 'create' && r.after && Object.keys(r.after).filter((k) => FIELD_LABEL[k]).map((k) => (
                <span key={k} className="hist__change">{FIELD_LABEL[k]}: <span className="muted">{show(r.before?.[k])}</span> ← {show(r.after?.[k])}</span>
              ))}
              {r.after && 'targetName' in r.after && <span className="hist__change">מוזג לתוך {String(r.after.targetName)}</span>}
              {r.after && 'sourceName' in r.after && <span className="hist__change">"{String(r.after.sourceName)}" מוזג לכאן</span>}
              {r.note && <span className="hist__change muted">הערה: {r.note}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function fmtTs(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

