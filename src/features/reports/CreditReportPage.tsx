/* דוח הקפות (אפיון 10 ו-7): בחירת חודש + בדיקת ההקפות המשותפת לסגירת החודש. */
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarCheck } from 'lucide-react';
import { useStore } from '../../data/store';
import { monthLabel, useMonth, useMonthOrders } from '../../data/months';
import { CreditCheck } from './CreditCheck';
import { MonthPicker, lastMonths } from './MonthClosePage';
import '../pages.css';

export function CreditReportPage() {
  const { now } = useStore();
  const [params, setParams] = useSearchParams();
  const months = lastMonths(now, 12);
  const ym = params.get('m') && months.includes(params.get('m')!) ? params.get('m')! : months[0];
  const { orders, loading } = useMonthOrders(ym);
  const { month } = useMonth(ym);
  const locked = month?.status === 'locked';

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">דוח הקפות</h1>
          <p className="page__sub">חודש <Ltr2 ym={ym} /> · לפי תאריך אספקה וסכום Q · בלי הזמנות שבוטלו{locked && ' · החודש נעול'}</p>
        </div>
        <div className="page__head-end">
          <MonthPicker months={months} value={ym} onChange={(m) => setParams({ m }, { replace: true })} />
          <Link className="btn btn--secondary btn--md" to={`/reports/close?m=${ym}`}><CalendarCheck size={16} aria-hidden="true" /> לסגירת החודש</Link>
        </div>
      </header>
      <CreditCheck ym={ym} orders={orders} month={month} loading={loading} locked={locked} />
    </div>
  );
}

function Ltr2({ ym }: { ym: string }) { return <bdi dir="ltr">{monthLabel(ym)}</bdi>; }
