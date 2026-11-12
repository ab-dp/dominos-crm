/* הטבלה המרכזית (אפיון 6.2). היום · מחר · עתידיות · ארכיון הם אותה טבלה עם מסנן שונה.
   חיצים מעבר בין שורות, Enter פתיחה. כל פעולה נפוצה – ישירות בשורה. */
import { Fragment, memo, useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { ClipboardList, Ellipsis, Phone as PhoneIcon } from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { useStore, type OrderView } from '../../data/store';
import { EmptyState, HealthBadge, Missing } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, Money, fmtDate, fmtMoney, toISODate, weekday } from '../../lib/format';
import type { XSheet } from '../../lib/xlsx';
import { METHOD_LABEL, STAGE_LABEL, closeLabel, stageOf, type Order } from '../../data/types';
import { FixButton } from './OrderActions';
import { NextStep, StageTrack, nextStepLabel, opsPending } from './OrderTimeline';
import './OrdersTable.css';

const PAGE = 150;
// פעולות שהן חלק מהציר – מופיעות ככפתור "הצעד הבא", לא ככפתור תיקון נוסף
const STEP_ACTIONS = ['q', 'branch', 'status', 'close', 'ops'];

export function OrdersTable({ rows, showDate = true, emptyText, caption, density = 'dense' }: { rows: OrderView[]; showDate?: boolean; emptyText: string; caption: string; density?: 'dense' | 'comfy' }) {
  const panel = usePanel();
  const { updateMany } = useStore();
  const [selected, setSelected] = useState<number[]>([]);
  const [flash, setFlash] = useState<number | null>(null);
  const body = useRef<HTMLTableSectionElement>(null);
  // טבלה ארוכה נבנית בהדרגה: 150 שורות ראשונות, והשאר נוספות בגלילה למטה
  const [limit, setLimit] = useState(PAGE);
  const more = useRef<HTMLDivElement>(null);
  useEffect(() => setLimit(PAGE), [caption]);
  useEffect(() => {
    const el = more.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) setLimit((l) => l + PAGE); }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [limit, rows.length]);

  // "כאן היית": השורה שממנה נפתח התיק מהבהבת פעם אחת בסגירה
  useEffect(() => {
    if (panel.lastClosed == null) return;
    setFlash(panel.lastClosed);
    const t = setTimeout(() => setFlash(null), 1200);
    return () => clearTimeout(t);
  }, [panel.lastClosed]);

  useEffect(() => setSelected((s) => {
    if (!s.length) return s;
    const ids = new Set(rows.map((r) => r.id));
    const kept = s.filter((id) => ids.has(id));
    return kept.length === s.length ? s : kept;
  }), [rows]);
  const toggle = useCallback((id: number) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]), []);

  if (rows.length === 0) {
    return <EmptyState icon={<ClipboardList size={20} />} title={emptyText}>אפשר ליצור הזמנה חדשה מהכפתור למעלה או בלחיצה על <kbd className="kbd">N</kbd></EmptyState>;
  }

  const allOn = selected.length === rows.length;
  return (
    <div className="otable-wrap">
      {selected.length > 0 && <BulkBar rows={rows.filter((r) => selected.includes(r.id))} clear={() => setSelected([])} updateMany={updateMany} />}
      <table className={`otable otable--orders otable--${density}`}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th className="col-check"><input type="checkbox" aria-label="בחר הכל" checked={allOn} onChange={() => setSelected(allOn ? [] : rows.map((r) => r.id))} /></th>
            <th>תקינות</th>
            <th aria-sort="ascending">שעה</th>
            {showDate && <th>תאריך</th>}
            <th>לקוח</th>
            <th>סניף</th>
            <th className="num">סכום</th>
            <th>שלב</th>
            <th>אמצעי</th>
            <th>מטפל</th>
            <th><span className="sr-only">פעולה</span></th>
          </tr>
        </thead>
        <tbody ref={body}>
          {rows.slice(0, limit).map((o, i, shown) => (
            <Fragment key={o.id}>
              {/* בטלפון: כותרת יום בכל פעם שהתאריך מתחלף (עתידיות, ארכיון) – נשארת למעלה בגלילה */}
              {showDate && (i === 0 || shown[i - 1].date !== o.date) && <DayRow date={o.date} rows={rows} />}
              <OrderRow o={o} showDate={showDate} flash={flash === o.id} selected={selected.includes(o.id)} toggle={toggle} />
            </Fragment>
          ))}
        </tbody>
      </table>
      {rows.length > limit && (
        <div ref={more} className="otable-more">
          <button className="link" onClick={() => setLimit((l) => l + PAGE)}>הצג עוד (<Ltr>{rows.length - limit}</Ltr> נוספות)</button>
        </div>
      )}
    </div>
  );
}

/* פעולה מרובה לא עוקפת את מסלול ההזמנה:
   "סמן כסופקו" – רק הזמנות שהוקלדו ל-Q ונשלחו בקבוצת תפעול; "סמן שולם" – בלי מבוטלות ובלי מה שכבר שולם.
   השאר מדולגות, וההודעה אומרת כמה ולמה. */
// מספר + פועל מותאם: 'הזמנה אחת סומנה' / '3 הזמנות סומנו'
const count = (n: number, one: string, many: string) => (n === 1 ? <>הזמנה אחת {one}</> : <><Ltr>{n}</Ltr> הזמנות {many}</>);
function BulkBar({ rows, clear, updateMany }: { rows: OrderView[]; clear: () => void; updateMany: (ids: number[], patch: Partial<Order>, message: ReactNode) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const closable = rows.filter((o) => stageOf(o) === 'in_q' && !opsPending(o));
  const payable = rows.filter((o) => o.status !== 'cancelled' && o.payment !== 'cancelled' && o.payment !== 'paid');
  const skipped = (n: number, why: string) => (n > 0 ? <> · {count(n, 'דולגה', 'דולגו')} ({why})</> : null);
  const deliver = () => {
    updateMany(closable.map((o) => o.id), { status: 'delivered' }, <>{count(closable.length, 'סומנה כסופקה', 'סומנו כסופקו')}{skipped(rows.length - closable.length, 'לא הוקלדו ל-Q או לא נשלחו לתפעול')}</>);
    clear();
  };
  const pay = () => {
    updateMany(payable.map((o) => o.id), { payment: 'paid' }, <>{count(payable.length, 'סומנה כשולמה', 'סומנו כשולמו')}{skipped(rows.length - payable.length, 'בוטלו או כבר שולמו')}</>);
    clear();
  };
  const exportXlsx = async () => {
    setBusy(true);
    try {
      const { downloadXlsx } = await import('../../lib/xlsx');
      await downloadXlsx(`הזמנות-${toISODate(new Date())}`, [ordersSheet(rows)]);
      toast({ message: <>{count(rows.length, 'יוצאה', 'יוצאו')} לאקסל</> });
    } catch { toast({ tone: 'error', message: 'הייצוא נכשל – נסה שוב' }); }
    setBusy(false);
  };
  return (
    <div className="bulkbar" role="toolbar" aria-label="פעולות על הזמנות מסומנות">
      <span><Ltr>{rows.length}</Ltr> נבחרו</span>
      <button onClick={deliver} disabled={!closable.length}>סמן כסופקו{closable.length > 0 && closable.length < rows.length && <> (<Ltr>{closable.length}</Ltr>)</>}</button>
      <button onClick={pay} disabled={!payable.length}>סמן שולם{payable.length > 0 && payable.length < rows.length && <> (<Ltr>{payable.length}</Ltr>)</>}</button>
      <button onClick={exportXlsx} disabled={busy}>{busy ? 'מייצא…' : 'ייצוא לאקסל'}</button>
      {!closable.length && <span className="bulkbar__note">לסגירה: רק הזמנות שהוקלדו ל-Q ונשלחו לתפעול</span>}
      <button className="bulkbar__clear" onClick={clear}>ניקוי בחירה</button>
    </div>
  );
}

function ordersSheet(rows: OrderView[]): XSheet {
  const stage = (o: OrderView) => { const s = stageOf(o); return s === 'delivered' || s === 'partial' ? closeLabel(o) : STAGE_LABEL[s]; };
  return {
    name: 'הזמנות', title: 'הזמנות שנבחרו',
    tables: [{
      main: true,
      cols: [
        { label: "מס' הזמנה", kind: 'id', width: 11 }, { label: 'תאריך', kind: 'date', width: 12 }, { label: 'שעה', kind: 'code', width: 8 },
        { label: 'לקוח', kind: 'text', width: 28 }, { label: 'סניף', kind: 'text', width: 20 }, { label: 'סכום', kind: 'money', width: 12 },
        { label: 'שלב', kind: 'text', width: 20 }, { label: 'אמצעי', kind: 'text', width: 12 }, { label: 'מטפל', kind: 'text', width: 16 },
        { label: "מס' Q", kind: 'code', width: 12 }, { label: 'סכום Q', kind: 'money', width: 12 },
      ],
      rows: rows.map((o) => [o.id, o.date, o.time, o.customerName, o.branchName, o.amount || null, stage(o), o.methodLabel ?? METHOD_LABEL[o.method] ?? o.method, o.handler, o.qNumber, o.qAmount ?? null]),
      rowStyle: rows.map((o) => (o.status === 'cancelled' ? 'muted' : undefined)),
      total: ['סה"כ', null, null, null, null, rows.filter((o) => o.status !== 'cancelled').reduce((t, o) => t + o.amount, 0), null, null, null, null, null],
    }],
  };
}

/* כותרת יום – רק בתצוגת הכרטיסים של הטלפון */
function DayRow({ date, rows }: { date: string; rows: OrderView[] }) {
  const day = rows.filter((r) => r.date === date && r.status !== 'cancelled');
  const sum = day.reduce((t, r) => t + r.amount, 0);
  return (
    <tr className="oday" aria-hidden="true">
      <th colSpan={11}>
        <span className="oday__name">{weekday(date)} <Ltr>{fmtDate(date)}</Ltr></span>
        <span className="oday__meta">{day.length === 1 ? 'הזמנה אחת' : <><Ltr>{day.length}</Ltr> הזמנות</>}{sum > 0 && <> · <Ltr>{fmtMoney(sum)}</Ltr></>}</span>
      </th>
    </tr>
  );
}

/* תפריט "⋯" בשורה: הצעד הבא (כשהכפתור בשורה תפוס בתיקון), פתיחת ההזמנה, וביטול – רחוק מהפעולה הראשית */
function RowMenu({ o, next, onOpen, onCancel }: { o: OrderView; next: string | null; onOpen: () => void; onCancel: () => void }) {
  const open = o.status !== 'cancelled' && o.status !== 'delivered' && o.status !== 'partial';
  return (
    <Dropdown.Root dir="rtl">
      <Dropdown.Trigger asChild>
        <button className="row-more" aria-label={`פעולות נוספות – הזמנה ${o.id}`}><Ellipsis size={16} aria-hidden="true" /></button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className="menu" align="end" sideOffset={4} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          {next && <Dropdown.Item className="menu__item" onSelect={onOpen}>{next} – בכרטיס ההזמנה</Dropdown.Item>}
          <Dropdown.Item className="menu__item" onSelect={onOpen}>פתח את ההזמנה</Dropdown.Item>
          {open && <Dropdown.Separator className="menu__sep" />}
          {open && <Dropdown.Item className="menu__item menu__item--danger" onSelect={onCancel}>ביטול הזמנה</Dropdown.Item>}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

/* שורה ממוזכרת: מתרנדרת מחדש רק כשההזמנה שלה, הסימון או ההבהוב משתנים */
const OrderRow = memo(function OrderRow({ o, showDate, flash, selected, toggle }: { o: OrderView; showDate: boolean; flash: boolean; selected: boolean; toggle: (id: number) => void }) {
  const panel = usePanel();
  const { requestStatus } = useStore();
  const top = o.issues[0];
  const fix = !!top && !STEP_ACTIONS.includes(top.action) && (o.health === 'critical' || o.health === 'urgent' || top.action === 'po');
  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.target !== e.currentTarget) return;
    const tr = e.currentTarget;
    const step = (dir: 'nextElementSibling' | 'previousElementSibling') => { let el = tr[dir] as HTMLElement | null; while (el && !el.classList.contains('orow')) el = el[dir] as HTMLElement | null; el?.focus(); };
    if (e.key === 'ArrowDown') { e.preventDefault(); step('nextElementSibling'); }
    if (e.key === 'ArrowUp') { e.preventDefault(); step('previousElementSibling'); }
    if (e.key === 'Enter') { e.preventDefault(); panel.open(o.id, tr); }
  };
  return (
    <tr
      tabIndex={0}
      className={`orow orow--${o.health} ${flash ? 'is-flash' : ''} ${selected ? 'is-selected' : ''}`}
      onClick={(e) => panel.open(o.id, e.currentTarget)}
      onKeyDown={onRowKey}
      aria-label={`הזמנה ${o.id}, ${o.customerName}, ${showDate ? `${fmtDate(o.date)} ` : ''}${o.time}${o.issues.length ? `, ${o.issues.map((i) => i.label).join(', ')}` : ''}`}
    >
      <td className="col-check" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" aria-label={`בחר הזמנה ${o.id}`} checked={selected} onChange={() => toggle(o.id)} />
      </td>
      <td className="c-health"><HealthBadge health={o.health} issues={o.issues} /></td>
      <td className="num strong c-time">{o.time ? <Ltr>{o.time}</Ltr> : <Missing>שעה?</Missing>}</td>
      {showDate && <td className="num"><Ltr>{fmtDate(o.date)}</Ltr></td>}
      <td className="c-cust">
        <span className="orow__cust">{o.customerName}{o.changedAfterApproval && <span className="changed-tag changed-tag--sm" title="שונתה לאחר אישור">שונתה</span>}</span>
        {/* הסיבות גלויות בשורה, לא רק בריחוף: שתיים ראשונות, ומספר הנוספות */}
        {top && o.health !== 'ok' && (
          <span className={`orow__why orow__why--${o.health}`} title={o.issues.map((i) => i.label).join(' · ')}>
            {o.issues.slice(0, 2).map((i) => i.label).join(' · ')}{o.issues.length > 2 && <span className="orow__more"> +<Ltr>{o.issues.length - 2}</Ltr></span>}
          </span>
        )}
        {/* בטלפון העמודות מוסתרות – סניף וסכום בשורה אחת מתחת לשם */}
        <span className="orow__m">
          <span>{o.branchName || <Missing>ללא סניף</Missing>}</span>
          <span className="orow__m-sum">{o.amount > 0 ? <Money value={o.amount} /> : <Missing>חסר סכום</Missing>}</span>
        </span>
      </td>
      <td>
        <span className="orow__branch">{o.branchName || <Missing>ללא סניף</Missing>}</span>
        {o.branchPhone && <span className="orow__sub"><PhoneIcon size={14} aria-hidden="true" /> <Ltr>{o.branchPhone.replace(/(\d{3})(\d+)/, '$1-$2')}</Ltr></span>}
      </td>
      <td className="num">{o.amount > 0 ? <Money value={o.amount} /> : <Missing>חסר סכום</Missing>}</td>
      <td className="orow__marks c-marks"><StageTrack o={o} /></td>
      <td>{o.methodLabel ?? METHOD_LABEL[o.method] ?? o.method}</td>
      <td>{o.handler}</td>
      <td className="c-act" onClick={(e) => e.stopPropagation()}>
        <span className="c-act__in">
          {/* פעולה ראשית אחת בשורה: תיקון הבעיה (כשהפתרון שלה הוא לא הצעד הבא בציר), אחרת הצעד הבא. השאר בתפריט "⋯" */}
          {fix ? <FixButton key={top.rule} o={o} issue={top} onOpen={() => panel.open(o.id)} /> : <NextStep o={o} />}
          <RowMenu o={o} next={fix ? nextStepLabel(o) : null} onOpen={() => panel.open(o.id)} onCancel={() => requestStatus(o, 'cancelled')} />
        </span>
      </td>
    </tr>
  );
});
