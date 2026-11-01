/* הטבלה המרכזית (אפיון 6.2). היום · מחר · עתידיות · ארכיון הם אותה טבלה עם מסנן שונה.
   חיצים מעבר בין שורות, Enter פתיחה. כל פעולה נפוצה – ישירות בשורה. */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ClipboardList, Phone as PhoneIcon } from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { useStore, type OrderView } from '../../data/store';
import { EmptyState, HealthBadge, StatusMenu } from '../../design/components';
import { Ltr, Money, fmtDate } from '../../lib/format';
import { METHOD_LABEL } from '../../data/types';
import { FixButton, OrderMarks } from './OrderActions';
import './OrdersTable.css';

export function OrdersTable({ rows, showDate = true, emptyText, caption, density = 'dense' }: { rows: OrderView[]; showDate?: boolean; emptyText: string; caption: string; density?: 'dense' | 'comfy' }) {
  const panel = usePanel();
  const { requestStatus, updateMany } = useStore();
  const [selected, setSelected] = useState<number[]>([]);
  const [flash, setFlash] = useState<number | null>(null);
  const body = useRef<HTMLTableSectionElement>(null);

  // "כאן היית": השורה שממנה נפתח התיק מהבהבת פעם אחת בסגירה
  useEffect(() => {
    if (panel.lastClosed == null) return;
    setFlash(panel.lastClosed);
    const t = setTimeout(() => setFlash(null), 1200);
    return () => clearTimeout(t);
  }, [panel.lastClosed]);

  useEffect(() => setSelected((s) => s.filter((id) => rows.some((r) => r.id === id))), [rows]);

  if (rows.length === 0) {
    return <EmptyState icon={<ClipboardList size={24} />} title={emptyText}>אפשר ליצור הזמנה חדשה מהכפתור למעלה או בלחיצה על <kbd className="kbd">N</kbd></EmptyState>;
  }

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, o: OrderView) => {
    if (e.target !== e.currentTarget) return;
    const tr = e.currentTarget;
    if (e.key === 'ArrowDown') { e.preventDefault(); (tr.nextElementSibling as HTMLElement | null)?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (tr.previousElementSibling as HTMLElement | null)?.focus(); }
    if (e.key === 'Enter') { e.preventDefault(); panel.open(o.id, tr); }
  };

  const allOn = selected.length === rows.length;
  return (
    <div className="otable-wrap">
      {selected.length > 0 && (
        <div className="bulkbar" role="toolbar" aria-label="פעולות על הזמנות מסומנות">
          <span><Ltr>{selected.length}</Ltr> נבחרו</span>
          <button onClick={() => { updateMany(selected, { status: 'delivered' }, <><Ltr>{selected.length}</Ltr> הזמנות סומנו כסופקו</>); setSelected([]); }}>סמן כסופקו</button>
          <button onClick={() => { updateMany(selected, { payment: 'paid' }, <><Ltr>{selected.length}</Ltr> הזמנות סומנו כשולמו</>); setSelected([]); }}>סמן שולם</button>
          <button disabled title="שלב 8">ייצוא לאקסל</button>
          <button className="bulkbar__clear" onClick={() => setSelected([])}>ניקוי בחירה</button>
        </div>
      )}
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
            <th>סטטוס</th>
            <th>סניף · Q · תשלום</th>
            <th>אמצעי</th>
            <th>מטפל</th>
            <th><span className="sr-only">פעולה</span></th>
          </tr>
        </thead>
        <tbody ref={body}>
          {rows.map((o) => {
            const top = o.issues[0];
            return (
              <tr
                key={o.id}
                tabIndex={0}
                className={`orow orow--${o.health} ${flash === o.id ? 'is-flash' : ''} ${selected.includes(o.id) ? 'is-selected' : ''}`}
                onClick={(e) => panel.open(o.id, e.currentTarget)}
                onKeyDown={(e) => onRowKey(e, o)}
                aria-label={`הזמנה ${o.id}, ${o.customerName}, ${o.time}${top ? `, ${top.label}` : ''}`}
              >
                <td className="col-check" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label={`בחר הזמנה ${o.id}`} checked={selected.includes(o.id)} onChange={() => setSelected((s) => s.includes(o.id) ? s.filter((x) => x !== o.id) : [...s, o.id])} />
                </td>
                <td className="c-health"><HealthBadge health={o.health} issues={o.issues} /></td>
                <td className="num strong c-time"><Ltr>{o.time}</Ltr></td>
                {showDate && <td className="num"><Ltr>{fmtDate(o.date)}</Ltr></td>}
                <td className="c-cust">
                  <span className="orow__cust">{o.customerName}{o.changedAfterApproval && <span className="changed-tag changed-tag--sm" title="שונתה לאחר אישור">שונתה</span>}</span>
                  {top && o.health !== 'ok' && <span className={`orow__why orow__why--${o.health}`}>{top.label}</span>}
                </td>
                <td>
                  <span className="orow__branch">{o.branchName}</span>
                  <span className="orow__sub"><PhoneIcon size={12} aria-hidden="true" /> <Ltr>{o.branchPhone.replace(/(\d{3})(\d+)/, '$1-$2')}</Ltr></span>
                </td>
                <td className="num"><Money value={o.amount} /></td>
                <td onClick={(e) => e.stopPropagation()}>
                  <StatusMenu status={o.status} onChange={(s) => requestStatus(o, s)} />
                </td>
                <td className="orow__marks c-marks" onClick={(e) => e.stopPropagation()}><OrderMarks o={o} /></td>
                <td>{o.methodLabel ?? METHOD_LABEL[o.method] ?? o.method}</td>
                <td>{o.handler}</td>
                <td className="c-act" onClick={(e) => e.stopPropagation()}>
                  {top && (o.health === 'critical' || o.health === 'urgent' || top.action === 'po') && <FixButton key={top.rule} o={o} issue={top} onOpen={() => panel.open(o.id)} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
