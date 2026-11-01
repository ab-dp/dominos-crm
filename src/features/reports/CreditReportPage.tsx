/* דוח הקפות (אפיון 10 ו-7): מקובץ לפי לקוח, סינון לפי לקוח או טלפון הקפה, ✓ ליד שורה שנמצאה בדוח הקופה. */
import { useMemo, useState } from 'react';
import { CheckCheck, Download } from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { useStore, type OrderView } from '../../data/store';
import { Button } from '../../design/components';
import { Ltr, Money, Phone, fmtDate, fmtMoney, fmtPhone } from '../../lib/format';
import { PAYMENT_LABEL, STATUS_LABEL } from '../../data/types';
import '../pages.css';
import './CreditReportPage.css';

export function CreditReportPage() {
  const { orders, now, updateMany } = useStore();
  const panel = usePanel();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [found, setFound] = useState<number[]>([]);

  const base = orders.filter((o) => o.method === 'account' && o.status !== 'cancelled' && o.date.startsWith(month));
  const customers = [...new Set(base.map((o) => o.customerName))];
  const phones = [...new Set(base.map((o) => o.accountPhone!).filter(Boolean))];
  const rows = base.filter((o) => (!customer || o.customerName === customer) && (!phone || o.accountPhone === phone));

  const groups = useMemo(() => {
    const m = new Map<string, OrderView[]>();
    rows.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).forEach((o) => m.set(o.customerName, [...(m.get(o.customerName) ?? []), o]));
    return [...m.entries()];
  }, [rows]);

  const sum = (list: OrderView[]) => list.reduce((t, o) => t + (o.qAmount ?? o.amount), 0);
  const unpaid = rows.filter((o) => o.payment === 'pending' || o.payment === 'failed');
  const [y, mo] = month.split('-');

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">דוח הקפות</h1>
          <p className="page__sub">חודש <Ltr>{`${mo}.${y}`}</Ltr> · לפי תאריך אספקה וסכום Q · בלי הזמנות שבוטלו</p>
        </div>
        <div className="page__head-end">
          <Button icon={<Download size={16} />} disabled title="ייצוא לאקסל – שלב 8">ייצוא לאקסל</Button>
          <Button variant="primary" icon={<CheckCheck size={18} />} disabled={unpaid.length === 0}
            onClick={() => updateMany(unpaid.map((o) => o.id), { payment: 'paid' }, <><Ltr>{unpaid.length}</Ltr> הזמנות הקפה סומנו כשולמו</>)}>
            סמן כשולם (<Ltr>{unpaid.length}</Ltr>)
          </Button>
        </div>
      </header>

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
          <span className="muted">נמצאו בדוח הקופה: <Ltr>{`${found.filter((id) => rows.some((r) => r.id === id)).length}/${rows.length}`}</Ltr></span>
        </div>
      </div>

      <div className="otable-wrap">
        <table className="otable creport">
          <caption className="sr-only">דוח הקפות מקובץ לפי לקוח</caption>
          <thead>
            <tr>
              <th className="col-check"><span className="sr-only">נמצא בדוח הקופה</span>✓</th>
              <th>תאריך ושעה</th><th>סניף</th><th>מס' Q</th><th className="num">סכום</th><th>סטטוס</th><th>תשלום</th><th>תעודת רכש</th><th>הערות לחיוב</th>
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
                <tr key={o.id} className={`orow ${found.includes(o.id) ? 'is-found' : ''}`} tabIndex={0} onClick={(e) => panel.open(o.id, e.currentTarget)} onKeyDown={(e) => e.key === 'Enter' && panel.open(o.id, e.currentTarget)}>
                  <td className="col-check" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={`הזמנה ${o.id} נמצאה בדוח הקופה`} checked={found.includes(o.id)} onChange={() => setFound((f) => f.includes(o.id) ? f.filter((x) => x !== o.id) : [...f, o.id])} />
                  </td>
                  <td className="num"><Ltr>{fmtDate(o.date)}</Ltr> <Ltr>{o.time}</Ltr></td>
                  <td>{o.branchName}</td>
                  <td>{o.qNumber ? <Ltr>{o.qNumber}</Ltr> : <span className="warn-text">לא הועברה</span>}</td>
                  <td className="num"><Money value={o.qAmount ?? o.amount} />{o.qAmount !== undefined && o.qAmount !== o.amount && <span className="gap-tag">פער</span>}</td>
                  <td>{STATUS_LABEL[o.status]}</td>
                  <td><span className={`paytag paytag--${o.payment}`}>{PAYMENT_LABEL[o.payment]}</span></td>
                  <td>{o.poNumber ? <Ltr>{o.poNumber}</Ltr> : o.poRequired ? <span className="warn-text">חסרה</span> : '—'}</td>
                  <td className="creport__note">{o.billingNote ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          ))}
          <tfoot>
            <tr><th colSpan={4}>סה"כ</th><th className="num"><Ltr>{fmtMoney(sum(rows))}</Ltr></th><th colSpan={4}><Ltr>{rows.length}</Ltr> הזמנות</th></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
