/* הצעות מחיר: כל ההצעות במקום אחד. ברירת המחדל – "ממתינות למענה", ומה שלא עודכן מעבר לסף (ספי התראות) – למעלה ומסומן.
   בכל שורה: הערה אחרונה ביומן, והפעולה הבאה (אישור / אין מענה / נדחתה / הפוך להזמנה). */
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BellRing, FileText, Plus, Search, X } from 'lucide-react';
import { SHORT_STATUS, WAITING, isExpired, needsFollowup, staleHours, useQuotes, type Quote } from '../../data/quotes';
import { useStore } from '../../data/store';
import { Button, EmptyState, Skeleton } from '../../design/components';
import { Ltr, fmtDate, fmtMoney, toISODate } from '../../lib/format';
import { QuoteActions, ago } from './QuoteTrack';
import '../pages.css';
import './quotes.css';

type Tab = 'waiting' | 'draft' | 'approved' | 'closed' | 'all';
const TABS: [Tab, string][] = [['waiting', 'ממתינות למענה'], ['draft', 'טיוטות'], ['approved', 'אושרו'], ['closed', 'נדחו ופג תוקף'], ['all', 'הכל']];

export function QuotesPage() {
  const { items, loading, error } = useQuotes('all');
  const { now, thresholds } = useStore();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'waiting';
  const [query, setQuery] = useState('');
  const today = toISODate(now);
  const hours = thresholds.quoteFollowupHours;

  const lists = useMemo(() => {
    const live = (q: Quote) => !isExpired(q, today);
    const byFollow = (a: Quote, b: Quote) => Number(needsFollowup(b, now, hours)) - Number(needsFollowup(a, now, hours)) || (staleHours(b, now) ?? 0) - (staleHours(a, now) ?? 0);
    return {
      waiting: items.filter((q) => WAITING.includes(q.status) && live(q)).sort(byFollow),
      draft: items.filter((q) => q.status === 'draft' && live(q)),
      approved: items.filter((q) => q.status === 'approved' || q.status === 'ordered'),
      closed: items.filter((q) => q.status === 'rejected' || isExpired(q, today)),
      all: items,
    } satisfies Record<Tab, Quote[]>;
  }, [items, now, today, hours]);
  const s = query.trim();
  const rows = lists[tab].filter((q) => !s || q.customer.name.includes(s) || q.customer.contact.includes(s) || String(q.id).includes(s));
  const follow = lists.waiting.filter((q) => needsFollowup(q, now, hours)).length;
  const waitingSum = lists.waiting.reduce((t, q) => t + q.total, 0);
  const month = today.slice(0, 7);
  const won = items.filter((q) => (q.status === 'approved' || q.status === 'ordered') && q.issueDate.startsWith(month)).length;

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">הצעות מחיר</h1>
          <p className="page__sub">יצירה, שליחה ומעקב – עד הפיכה להזמנה.</p>
        </div>
        <dl className="head-stats" aria-live="polite">
          <div className={follow ? 'is-alert' : ''}><dt>לחזור ללקוח</dt><dd><Ltr>{follow}</Ltr></dd></div>
          <div><dt>ממתינות · סכום</dt><dd><Ltr>{fmtMoney(waitingSum)}</Ltr></dd></div>
          <div><dt>אושרו החודש</dt><dd><Ltr>{won}</Ltr></dd></div>
        </dl>
        <div className="page__head-end"><Button variant="primary" icon={<Plus size={18} />} onClick={() => nav('/quotes/new')}>הצעה חדשה</Button></div>
      </header>
      {error && <p className="cform__formerr" role="alert">{error} – ההצעות לא נטענו. רענן את הדף.</p>}

      <div className="tabs" role="tablist" aria-label="הצעות מחיר">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'is-on' : ''} ${k === 'waiting' && follow ? 'tab--alert' : ''}`}
            onClick={() => { const p = new URLSearchParams(params); p.set('tab', k); setParams(p, { replace: true }); }}>
            {label}<span className="tab__count"><Ltr>{lists[k].length}</Ltr></span>
          </button>
        ))}
      </div>
      <div className="tablebar">
        <label className="tablebar__search">
          <Search size={16} aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="סינון: לקוח, איש קשר, מס' הצעה" aria-label="סינון הצעות" />
          {query && <button onClick={() => setQuery('')} aria-label="נקה סינון"><X size={14} /></button>}
        </label>
      </div>

      {loading ? <div className="card orders-loading" aria-busy="true" aria-label="טוען הצעות">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={20} />)}</div> : rows.length === 0 ? (
        <div className="card">
          <EmptyState icon={<FileText size={24} />} title={items.length ? 'אין הצעות בתצוגה הזו' : 'עוד אין הצעות מחיר'}
            action={!items.length && <Button variant="primary" icon={<Plus size={16} />} onClick={() => nav('/quotes/new')}>הצעה חדשה</Button>}>
            {items.length ? (tab === 'waiting' ? 'כל ההצעות שנשלחו קיבלו תשובה ✓' : '') : 'הצעה שמורה נשארת כאן עם כל היסטוריית המעקב שלה.'}
          </EmptyState>
        </div>
      ) : (
        <div className="otable-wrap card qlist">
          <table className="otable otable--dense">
            <caption className="sr-only">הצעות מחיר – {TABS.find((t) => t[0] === tab)![1]}</caption>
            <thead><tr><th>הצעה</th><th>לקוח</th><th>תאריך</th><th className="num">סכום</th><th>סטטוס</th><th>עדכון אחרון</th><th><span className="sr-only">פעולה</span></th></tr></thead>
            <tbody>
              {rows.map((q) => {
                const late = needsFollowup(q, now, hours);
                const exp = isExpired(q, today);
                const h = staleHours(q, now);
                return (
                  <tr key={q.id} className={`qrow ${late ? 'is-late' : ''}`} onClick={(e) => { if (!(e.target as HTMLElement).closest('button, a')) nav(`/quotes/${q.id}`); }}>
                    <td><button className="link qrow__num" onClick={() => nav(`/quotes/${q.id}`)} aria-label={`פתח הצעה ${q.id}`}><Ltr>{q.id}</Ltr></button></td>
                    <td className="strong">{q.customer.name || <span className="muted">ללא שם</span>}{q.customer.contact && <span className="muted"> · {q.customer.contact}</span>}</td>
                    <td><Ltr>{fmtDate(q.issueDate)}</Ltr>{q.date && <span className="muted qrow__sub">אספקה <Ltr>{fmtDate(q.date)}</Ltr></span>}</td>
                    <td className="num"><Ltr>{fmtMoney(q.total)}</Ltr></td>
                    <td><span className={`qstat qstat--${exp ? 'expired' : q.status}`}>{exp ? 'פג תוקף' : SHORT_STATUS[q.status]}</span></td>
                    <td className="qrow__last">
                      {late && <span className="qrow__late"><BellRing size={13} aria-hidden="true" /> אין עדכון {ago(h!)}</span>}
                      <span className="qrow__note" title={q.lastNote}>{q.lastNote || <span className="muted">—</span>}</span>
                    </td>
                    <td className="qrow__act"><QuoteActions q={q} compact /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
