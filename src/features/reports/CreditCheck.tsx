/* בדיקת הקפות (אפיון 7, 10): הזמנות הקפה של חודש, מקובצות לפי לקוח, סינון לפי לקוח או טלפון הקפה,
   ✓ ליד כל שורה שנמצאה בדוח הקופה (נשמר לחודש – משתמש אחר רואה וממשיך), "סמן כשולם" לשורות המסוננות וייצוא לאקסל.
   משמש גם בדוח ההקפות וגם בשלב 2 של סגירת החודש. */
import { useMemo, useState } from 'react';
import { CheckCheck, Download } from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { useStore } from '../../data/store';
import { setChecked, monthLabel, type MonthDoc } from '../../data/months';
import { logReportExport } from '../../data/orders';
import { PAYMENT_LABEL, STATUS_LABEL, type Order } from '../../data/types';
import { Button, Missing, Skeleton } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, Money, Phone, fmtDate, fmtMoney, fmtPhone } from '../../lib/format';
import './CreditReportPage.css';

export const creditOrders = (orders: Order[]) => orders.filter((o) => o.method === 'account' && o.status !== 'cancelled');

export function CreditCheck({ ym, orders, month, loading, locked }: { ym: string; orders: Order[]; month: MonthDoc | null; loading: boolean; locked?: boolean }) {
  const { updateMany } = useStore();
  const panel = usePanel();
  const toast = useToast();
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const checked = month?.checked ?? {};

  const base = creditOrders(orders);
  const customers = [...new Set(base.map((o) => o.customerName))].sort();
  const phones = [...new Set(base.map((o) => o.accountPhone!).filter(Boolean))];
  const rows = base.filter((o) => (!customer || o.customerName === customer) && (!phone || o.accountPhone === phone));

  const groups = useMemo(() => {
    const m = new Map<string, Order[]>();
    rows.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).forEach((o) => m.set(o.customerName, [...(m.get(o.customerName) ?? []), o]));
    return [...m.entries()];
  }, [rows]);

  const sum = (list: Order[]) => list.reduce((t, o) => t + (o.qAmount ?? o.amount), 0);
  const unpaid = rows.filter((o) => o.payment === 'pending' || o.payment === 'failed');
  const found = rows.filter((o) => checked[o.id]).length;
  const toggle = (o: Order) => setChecked(ym, month, o.id, !checked[o.id]).catch(() => toast({ tone: 'error', message: 'הסימון לא נשמר – בדוק חיבור' }));

  const [exporting, setExporting] = useState(false);
  const exportXlsx = async () => {
    setExporting(true);
    try {
      const { downloadXlsx } = await import('../../lib/xlsx');
      await downloadXlsx(`דוח הקפות ${monthLabel(ym)}${customer ? ` - ${customer}` : ''}`, [{
        name: 'הקפות', title: 'דוח הקפות', period: monthLabel(ym),
        notes: [customer || phone ? `מסונן: ${[customer, phone && fmtPhone(phone)].filter(Boolean).join(' · ')}` : ''],
        tables: [{
          main: true,
          cols: [
            { label: 'לקוח', kind: 'text', width: 26 }, { label: 'טלפון הקפה', kind: 'code', width: 14 }, { label: 'הזמנה', kind: 'id', width: 10 }, { label: 'תאריך', kind: 'date', width: 12 },
            { label: 'סניף', kind: 'text', width: 22 }, { label: "מס' Q", kind: 'code', width: 11 }, { label: 'סכום', kind: 'money', width: 12 }, { label: 'סטטוס', kind: 'text', width: 14 },
            { label: 'תשלום', kind: 'text', width: 14 }, { label: 'תעודת רכש', kind: 'code', width: 13 }, { label: 'הערות לחיוב', kind: 'text', width: 30 }, { label: 'נמצא בדוח הקופה', kind: 'text', width: 12 },
          ],
          rows: groups.flatMap(([, list]) => list.map((o) => [o.customerName, o.accountPhone ? fmtPhone(o.accountPhone) : '', o.id, o.date, o.branchName, o.qNumber ?? '', o.qAmount ?? o.amount, STATUS_LABEL[o.status], PAYMENT_LABEL[o.payment], o.poNumber ?? '', o.billingNote ?? '', checked[o.id] ? '✓' : ''])),
          total: ['סה"כ', '', rows.length, '', '', '', sum(rows)],
        }],
      }]);
      logReportExport('credit', { month: ym, rows: rows.length, customer, phone }).catch(() => undefined);
      toast({ message: <>דוח ההקפות יוצא לאקסל · <Ltr>{rows.length}</Ltr> שורות</> });
    } catch {
      toast({ tone: 'error', message: 'הייצוא נכשל – נסה שוב' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="toolbar">
        <label className="filter">
          <span>לקוח</span>
          <select className="input" value={customer} onChange={(e) => setCustomer(e.target.value)}>
            <option value="">כל הלקוחות</option>
            {customers.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="filter">
          <span>טלפון הקפה</span>
          <select className="input input--ltr" value={phone} onChange={(e) => setPhone(e.target.value)}>
            <option value="">הכל</option>
            {phones.map((p) => <option key={p} value={p}>{fmtPhone(p)}</option>)}
          </select>
        </label>
        <div className="report-sum" aria-live="polite">
          <span><Ltr>{rows.length}</Ltr> הזמנות</span>
          <b><Ltr>{fmtMoney(sum(rows))}</Ltr></b>
          <span className="muted">נמצאו בדוח הקופה: <Ltr>{`${found}/${rows.length}`}</Ltr></span>
        </div>
        <div className="ccheck__actions">
          <Button icon={<Download size={16} />} onClick={exportXlsx} loading={exporting} disabled={!rows.length}>ייצוא לאקסל</Button>
          {!locked && (
            <Button variant="primary" icon={<CheckCheck size={16} />} disabled={unpaid.length === 0}
              onClick={() => updateMany(unpaid.map((o) => o.id), { payment: 'paid' }, <><Ltr>{unpaid.length}</Ltr> הזמנות הקפה סומנו כשולמו</>)}>
              סמן כשולם (<Ltr>{unpaid.length}</Ltr>)
            </Button>
          )}
        </div>
      </div>

      {loading ? <div className="card loading-rows" aria-busy="true" aria-label="טוען">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={30} />)}</div>
        : rows.length === 0 ? <p className="card calm ccheck__empty">אין הזמנות הקפה בחודש הזה{customer || phone ? ' לפי הסינון' : ''}.</p>
        : <div className="otable-wrap">
          <table className="otable creport">
            <caption className="sr-only">הזמנות הקפה מקובצות לפי לקוח</caption>
            <thead>
              <tr>
                <th className="col-check"><span className="sr-only">נמצא בדוח הקופה</span>✓</th>
                <th>תאריך</th><th>סניף</th><th>מס' Q</th><th className="num">סכום</th><th>סטטוס</th><th>תשלום</th><th>תעודת רכש</th><th>הערות לחיוב</th>
              </tr>
            </thead>
            {groups.map(([name, list]) => (
              <tbody key={name}>
                <tr className="creport__group">
                  <th colSpan={4} scope="rowgroup">
                    {name} {list[0].accountPhone && <span className="muted">· טלפון הקפה <Phone value={list[0].accountPhone} /></span>}
                  </th>
                  <th className="num"><Money value={sum(list)} /></th>
                  <th colSpan={4} className="muted"><Ltr>{list.length}</Ltr> הזמנות</th>
                </tr>
                {list.map((o) => (
                  <tr key={o.id} className={`orow ${checked[o.id] ? 'is-found' : ''}`} tabIndex={0} onClick={(e) => panel.open(o.id, e.currentTarget)} onKeyDown={(e) => e.key === 'Enter' && panel.open(o.id, e.currentTarget)}>
                    <td className="col-check" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`הזמנה ${o.id} נמצאה בדוח הקופה`} checked={!!checked[o.id]} disabled={locked} onChange={() => toggle(o)} />
                    </td>
                    <td className="num"><Ltr>{fmtDate(o.date)}</Ltr> {o.time && <Ltr>{o.time}</Ltr>}</td>
                    <td>{o.branchName || <Missing>ללא סניף</Missing>}</td>
                    <td>{o.qNumber ? <Ltr>{o.qNumber}</Ltr> : <span className="warn-text">לא הועברה</span>}</td>
                    <td className="num"><Money value={o.qAmount ?? o.amount} />{o.qAmount !== undefined && o.qAmount !== o.amount && <span className="gap-tag">פער</span>}</td>
                    <td>{STATUS_LABEL[o.status]}</td>
                    <td><span className={`paytag paytag--${o.payment}`}>{PAYMENT_LABEL[o.payment]}</span></td>
                    <td>{o.poNumber ? <Ltr>{o.poNumber}</Ltr> : o.poRequired ? <Missing>חסרה</Missing> : '—'}</td>
                    <td className="creport__note">{o.billingNote ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            ))}
            <tfoot>
              <tr><th colSpan={4}>סה"כ</th><th className="num"><Ltr>{fmtMoney(sum(rows))}</Ltr></th><th colSpan={4}><Ltr>{rows.length}</Ltr> הזמנות</th></tr>
            </tfoot>
          </table>
        </div>}
    </>
  );
}
