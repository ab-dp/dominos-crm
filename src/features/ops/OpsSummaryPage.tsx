/* סיכום לתפעול: בוחרים תאריכים (מחר / סופ"ש / טווח) ומקבלים דף מסודר לכל אשכול – סניף ← יום ושעה, פירוט מלא של כל הזמנה.
   הדף בנוי לצילום מסך או ל-PDF (עמוד אחד לאשכול). נכנסות רק הזמנות שהלקוח אישר; מה שעוד ממתין לאישור הלקוח מוצג באדום למעלה. */
import { forwardRef, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, Download, Send } from 'lucide-react';
import { useStore } from '../../data/store';
import { usePanel } from '../../app/PanelContext';
import { Button, EmptyState } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, fmtDate, fmtMoney, fmtPhone, toISODate, weekday } from '../../lib/format';
import { OTHER, categoryOf, groupItems, itemsText, typeText, type Order } from '../../data/types';
import {
  amountIn, awaitingCustomer, diffSince, groupByCluster, inRange, inSummary, markOpsSent, pizzasIn, tomorrowRange, useOpsSends, weekendRange,
  type ClusterGroup, type OpsSend,
} from '../../data/opsSummary';
import { saveError } from '../../lib/saveError';
import '../pages.css';
import './ops.css';

type Mode = 'tomorrow' | 'weekend' | 'custom';
const LOGO = `${import.meta.env.BASE_URL}logo-horizontal.svg`;
const dm = (iso: string) => fmtDate(iso).slice(0, 5);
export const rangeText = (from: string, to: string) => (from === to
  ? `יום ${weekday(from)} ${fmtDate(from)}`
  : `${weekday(from)} ${dm(from)} – ${weekday(to)} ${fmtDate(to)}`);
const sentAt = (s: OpsSend) => { const d = s.at?.toDate?.(); return d ? `${dm(toISODate(d))} ${d.toTimeString().slice(0, 5)}` : 'עכשיו'; };

export function OpsSummaryPage() {
  const { orders, now, updateMany } = useStore();
  const panel = usePanel();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>(() => (now.getDay() === 4 ? 'weekend' : 'tomorrow'));
  const [custom, setCustom] = useState(() => tomorrowRange(now));
  const range = mode === 'tomorrow' ? tomorrowRange(now) : mode === 'weekend' ? weekendRange(now) : custom;
  const { from, to } = range;
  const bad = from > to;
  const sends = useOpsSends(from).filter((s) => s.to === to);
  const [busy, setBusy] = useState('');
  const sheets = useRef(new Map<string, HTMLElement>());

  const inDates = useMemo(() => (bad ? [] : orders.filter((o) => inRange(o, from, to))), [orders, from, to, bad]);
  const clusters = useMemo(() => groupByCluster(inDates.filter(inSummary)), [inDates]);
  const waiting = useMemo(() => inDates.filter(awaitingCustomer).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)), [inDates]);
  const byId = useMemo(() => new Map(orders.map((o) => [String(o.id), o])), [orders]);

  const pdf = async (list: ClusterGroup[], name: string) => {
    const els = list.map((c) => sheets.current.get(c.name)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    setBusy(`pdf:${name}`);
    try {
      const { downloadOpsPdf } = await import('./opsPdf');
      await downloadOpsPdf(els, `סיכום לתפעול ${name} ${fmtDate(from)}${from !== to ? ` עד ${fmtDate(to)}` : ''}.pdf`);
    } catch {
      toast({ tone: 'error', message: 'הורדת ה-PDF נכשלה. נסו שוב.' });
    } finally { setBusy(''); }
  };

  const markSent = async (c: ClusterGroup) => {
    setBusy(`sent:${c.name}`);
    try {
      await markOpsSent(c.name, from, to, c.orders);
      // הסיכום הוא העדכון בתפעול: הזמנות שעוד לא סומנו "עודכן בתפעול" מסומנות עכשיו (בלי שם מאשר)
      const ids = c.orders.filter((o) => !o.branchApproval).map((o) => o.id);
      if (ids.length) updateMany(ids, { branchApproval: { manager: '', at: new Date().toISOString() } }, <>עודכן בתפעול · {ids.length} הזמנות</>);
      toast({ message: <>סומן שהסיכום של {c.name} נשלח</> });
    } catch (e) {
      toast({ tone: 'error', message: saveError(e) });
    } finally { setBusy(''); }
  };

  return (
    <div className="page ops">
      <header className="page__head">
        <div>
          <h1 className="page__title">סיכום לתפעול</h1>
          <p className="page__sub">דף לכל אשכול – לצילום מסך או PDF.</p>
        </div>
        {clusters.length > 1 && (
          <div className="page__head-end">
            <Button icon={<Download size={16} />} loading={busy === 'pdf:all'} onClick={() => pdf(clusters, 'כל האשכולות')}>PDF לכל האשכולות</Button>
          </div>
        )}
      </header>

      <div className="ops-range">
        <div className="seg" role="group" aria-label="תאריכים">
          {([['tomorrow', 'מחר'], ['weekend', 'סופ"ש · שישי ושבת'], ['custom', 'טווח תאריכים']] as [Mode, string][]).map(([k, l]) => (
            <button key={k} className={mode === k ? 'is-on' : ''} aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>
          ))}
        </div>
        {mode === 'custom' ? (
          <div className="ops-range__custom">
            <label>מתאריך <input type="date" className="input input--ltr" value={custom.from} onChange={(e) => e.target.value && setCustom((c) => ({ from: e.target.value, to: c.to < e.target.value ? e.target.value : c.to }))} /></label>
            <label>עד <input type="date" className="input input--ltr" value={custom.to} min={custom.from} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))} /></label>
          </div>
        ) : <b className="ops-range__text">{rangeText(from, to)}</b>}
      </div>

      {waiting.length > 0 && (
        <div className="ops-waiting" role="alert">
          <p className="ops-waiting__title"><AlertTriangle size={18} aria-hidden="true" />
            שים לב: {waiting.length === 1 ? 'יש הזמנה אחת' : `יש ${waiting.length} הזמנות`} בתאריכים שנבחרו שעוד לא אושרו על ידי הלקוח. הן לא נכנסות לסיכום – יש לבדוק אותן קודם.
          </p>
          <ul>
            {waiting.map((o) => (
              <li key={o.id}>
                <button onClick={(e) => panel.open(o.id, e.currentTarget)}>
                  <b>{o.customerName}</b> · {weekday(o.date)} <Ltr>{dm(o.date)} {o.time}</Ltr> · {o.branchName || 'ללא סניף'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {bad ? <p className="ops-err">תאריך הסיום לפני תאריך ההתחלה.</p> : !clusters.length ? (
        <EmptyState icon={<Send size={28} />} title="אין הזמנות מאושרות בתאריכים האלה">
          {waiting.length ? 'יש הזמנות שממתינות לאישור הלקוח – הן מופיעות למעלה.' : 'בחרו תאריכים אחרים.'}
        </EmptyState>
      ) : clusters.map((c) => {
        const send = sends.find((s) => s.cluster === c.name);
        const { mark, removed } = diffSince(send, c.orders);
        const dirty = !!send && (mark.size > 0 || removed.length > 0);
        return (
          <section key={c.name} className="ops-card" aria-label={`אשכול ${c.name}`}>
            <div className="ops-card__bar">
              <h2>{c.name}</h2>
              <span className={`ops-sent ${send ? (dirty ? 'is-dirty' : 'is-sent') : ''}`}>
                {!send ? 'עוד לא נשלח' : dirty ? <>נשלח {sentAt(send)} · יש שינויים מאז – לשלוח שוב</> : <><Check size={14} aria-hidden="true" /> נשלח {sentAt(send)}{send.byName && ` · ${send.byName}`}</>}
              </span>
              <div className="ops-card__actions">
                <Button size="sm" icon={<Download size={15} />} loading={busy === `pdf:${c.name}`} onClick={() => pdf([c], c.name)}>PDF</Button>
                <Button size="sm" variant={send && !dirty ? 'secondary' : 'primary'} icon={<Check size={15} />} loading={busy === `sent:${c.name}`} onClick={() => markSent(c)}>
                  {send ? 'סמן שנשלח שוב' : 'סמן שנשלח'}
                </Button>
              </div>
            </div>
            <p className="ops-phone">בטלפון הדף מוקטן – לשליחה עדיף להוריד PDF.</p>
            <FitWidth>
              <OpsSheet ref={(el) => { if (el) sheets.current.set(c.name, el); else sheets.current.delete(c.name); }}
                c={c} from={from} to={to} now={now} mark={mark}
                removed={removed.map((id) => byId.get(id)).map((o, i) => (o ? `${o.customerName} (${weekday(o.date)} ${dm(o.date)})` : `הזמנה ${removed[i]}`))} />
            </FitWidth>
          </section>
        );
      })}
    </div>
  );
}

/* הדף עצמו – רוחב קבוע (כמו A4 לרוחב), כדי שצילום מסך ו-PDF ייראו אותו דבר */
const OpsSheet = forwardRef<HTMLElement, { c: ClusterGroup; from: string; to: string; now: Date; mark: Map<number, 'new' | 'changed'>; removed: string[] }>(
  function OpsSheet({ c, from, to, now, mark, removed }, ref) {
    const multiDay = from !== to;
    return (
      <article className="os" ref={ref} dir="rtl">
        <header className="os-head">
          <div>
            <h1>סיכום הזמנות · {c.name}</h1>
            <p className="os-range">{rangeText(from, to)}</p>
          </div>
          <div className="os-stats">
            <Stat n={c.branches.length} l={c.branches.length === 1 ? 'סניף' : 'סניפים'} />
            <Stat n={c.orders.length} l={c.orders.length === 1 ? 'הזמנה' : 'הזמנות'} />
            <Stat n={pizzasIn(c.orders)} l="פיצות" />
            <Stat n={<Ltr>{fmtMoney(amountIn(c.orders))}</Ltr>} l='סה"כ' />
          </div>
          <img src={LOGO} alt="Domino's Pizza" />
        </header>
        {removed.length > 0 && <p className="os-removed">ירדו מהסיכום מאז השליחה הקודמת (בוטלו, נסגרו או הוזזו): {removed.join(' · ')}</p>}
        <table className="os-table">
          <colgroup><col className="c-when" /><col className="c-cust" /><col className="c-items" /><col className="c-dlv" /><col className="c-sum" /><col className="c-note" /></colgroup>
          <thead><tr><th>{multiDay ? 'יום ושעה' : 'שעה'}</th><th>לקוח ואיש קשר</th><th>פירוט ההזמנה</th><th>אספקה</th><th className="m">סכום</th><th>הערות לסניף</th></tr></thead>
          {c.branches.map((b) => (
            <tbody key={b.name}>
              <tr className="os-br"><td colSpan={6}><b>{b.name}</b><span>{b.orders.length} {b.orders.length === 1 ? 'הזמנה' : 'הזמנות'} · {pizzasIn(b.orders)} פיצות · <Ltr>{fmtMoney(amountIn(b.orders))}</Ltr></span></td></tr>
              {b.orders.map((o) => <OrderRow key={o.id} o={o} multiDay={multiDay} mark={mark.get(o.id)} />)}
            </tbody>
          ))}
        </table>
        <p className="os-foot">הופק <Ltr>{fmtDate(toISODate(now))} {now.toTimeString().slice(0, 5)}</Ltr> · רק הזמנות שאושרו על ידי הלקוח · הסכומים כוללים מע"מ ומשלוח</p>
      </article>
    );
  });

function Stat({ n, l }: { n: ReactNode; l: string }) {
  return <div><b>{n}</b><span>{l}</span></div>;
}

function OrderRow({ o, multiDay, mark }: { o: Order; multiDay: boolean; mark?: 'new' | 'changed' }) {
  const contact = [o.contactName?.trim(), o.contactPhone?.trim() && fmtPhone(o.contactPhone.trim())].filter(Boolean);
  return (
    <tr className={mark ? `is-${mark}` : ''}>
      <td className="os-when">{multiDay && <span>{weekday(o.date)} <Ltr>{dm(o.date)}</Ltr></span>}<b><Ltr>{o.time}</Ltr></b>{pizzasIn([o]) > 0 && <em className="os-pz"><Ltr>{pizzasIn([o])}</Ltr> פיצות</em>}</td>
      <td>
        {mark && <span className={`os-tag os-tag--${mark}`}>{mark === 'new' ? 'חדש' : 'עודכן'}</span>}
        <b>{o.customerName}</b>
        {contact.length > 0 && <span className="os-sub">{o.contactName?.trim()}{contact.length > 1 && ' · '}{o.contactPhone?.trim() && <Ltr>{fmtPhone(o.contactPhone.trim())}</Ltr>}</span>}
      </td>
      <td className="os-items"><Items o={o} /></td>
      <td>{o.delivery === 'pickup' ? <b>איסוף עצמי</b> : <><b>משלוח</b>{o.address?.trim() && <span className="os-sub">{o.address.trim()}</span>}</>}</td>
      <td className="m"><Ltr>{fmtMoney(o.amount)}</Ltr></td>
      <td className="os-note">{o.instructions?.trim() || ''}</td>
    </tr>
  );
}

/* פירוט מלא: שורה לכל קטגוריה, ובה כל סוג עם התוספות והחלוקה – כמו בקובץ ההזמנה */
function Items({ o }: { o: Order }) {
  if (!o.items.length) return <>{o.contents?.trim() || '—'}</>;
  if (!o.items.some((i) => categoryOf(i) !== OTHER)) return <>{itemsText(o.items)}</>;
  return (
    <>
      {groupItems(o.items).map((g) => (
        <div key={g.category} className="os-cat">
          <b>{g.category} <Ltr>{g.qty}</Ltr></b>
          {/* מוצרים בלי פירוט ("6 סופלה · 4 לחם שום") – באותה שורה; עם תוספות / חלוקה – שורה לכל סוג */}
          {g.types.some((t) => t.rows.some((r) => r.text))
            ? <span>{g.types.map((t, i) => <span key={i} className="os-type">{typeText(t)}</span>)}</span>
            : <span>{g.types.map(typeText).join(' · ')}</span>}
        </div>
      ))}
    </>
  );
}

/* מקטין את הדף לרוחב המסך (בטלפון / חלון צר) בלי לשנות את הפריסה שלו */
function FitWidth({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [s, setS] = useState({ scale: 1, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const inner = el.firstElementChild as HTMLElement | null;
      if (!inner) return;
      const scale = Math.min(1, el.clientWidth / inner.offsetWidth);
      setS({ scale, h: inner.offsetHeight * scale });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="ops-fit" ref={ref} style={{ height: s.h || undefined }}>
      <div style={{ transform: `scale(${s.scale})`, transformOrigin: 'top right', width: 'max-content' }}>{children}</div>
    </div>
  );
}
