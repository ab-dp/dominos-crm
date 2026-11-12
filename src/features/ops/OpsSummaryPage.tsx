/* סיכום לתפעול: בוחרים תאריכים (מחר / סופ"ש / טווח) ומקבלים דף מסודר לכל אשכול – סניף ← יום ושעה, פירוט מלא של כל הזמנה.
   הדף בנוי לצילום מסך או ל-PDF – כתב גדול ושורות צפופות, עמוד אחד לאשכול. נכנסות רק הזמנות שהלקוח אישר; מה שעוד ממתין לאישור הלקוח מוצג באדום למעלה. */
import { forwardRef, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, Download, Send } from 'lucide-react';
import { useStore } from '../../data/store';
import { usePanel } from '../../app/PanelContext';
import { Button, EmptyState } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, fmtDate, fmtMoney, fmtPhone, toISODate, weekday } from '../../lib/format';
import { OTHER, PIZZA, categoryOf, groupItems, itemsText, typeText, type Order } from '../../data/types';
import {
  amountIn, awaitingCustomer, diffSince, groupByCluster, inRange, inSummary, markOpsSent, pizzasIn, tomorrowRange, useOpsSends, weekendRange,
  type ClusterGroup, type OpsSend,
} from '../../data/opsSummary';
import { saveError } from '../../lib/saveError';
import { logError } from '../../lib/errorLog';
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
    } catch (e) {
      logError('ops-pdf', e); // נרשם בהגדרות ← תקלות, כדי שנדע מה נכשל
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
          <p className="ops-waiting__title"><AlertTriangle size={16} aria-hidden="true" />
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
        <EmptyState icon={<Send size={20} />} title="אין הזמנות מאושרות בתאריכים האלה">
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
                <Button size="sm" icon={<Download size={16} />} loading={busy === `pdf:${c.name}`} onClick={() => pdf([c], c.name)}>PDF</Button>
                <Button size="sm" variant={send && !dirty ? 'secondary' : 'primary'} icon={<Check size={16} />} loading={busy === `sent:${c.name}`} onClick={() => markSent(c)}>
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

/* הדף עצמו – רוחב קבוע, כדי שצילום מסך ו-PDF ייראו אותו דבר */
const OpsSheet = forwardRef<HTMLElement, { c: ClusterGroup; from: string; to: string; now: Date; mark: Map<number, 'new' | 'changed'>; removed: string[] }>(
  function OpsSheet({ c, from, to, now, mark, removed }, ref) {
    const multiDay = from !== to;
    // יום ← סניף: כל יום בפני עצמו, ובתוכו הסניפים באותו סדר כמו בכל הסיכום
    const days = multiDay
      ? [...new Set(c.orders.map((o) => o.date))].sort().map((date) => ({ date, branches: c.branches.map((b) => ({ name: b.name, orders: b.orders.filter((o) => o.date === date) })).filter((b) => b.orders.length) }))
      : [{ date: from, branches: c.branches }];
    return (
      <article className="os" ref={ref} dir="rtl">
        <header className="os-head">
          <div className="os-cluster"><span>קבוצת תפעול</span><h1>{c.name}</h1></div>
          <div className="os-title">
            <p>סיכום הזמנות לתפעול</p>
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
          <colgroup><col className="c-when" /><col className="c-pz" /><col className="c-cust" /><col className="c-items" /><col className="c-dlv" /><col className="c-sum" /></colgroup>
          <thead><tr><th scope="col">שעה</th><th scope="col" className="c">פיצות</th><th scope="col">לקוח ואיש קשר</th><th scope="col">פירוט ההזמנה והערות לסניף</th><th scope="col">אספקה</th><th scope="col" className="m">סכום</th></tr></thead>
          {days.map((d) => (
            <tbody key={d.date} className={`os-day os-day--${new Date(`${d.date}T12:00`).getDay()}`}>
              {multiDay && (
                <tr className="os-dayband"><td colSpan={6}><div>
                  <b>יום {weekday(d.date)} · <Ltr>{dm(d.date)}</Ltr></b>
                  <span>{totals(d.branches.flatMap((b) => b.orders))}</span>
                </div></td></tr>
              )}
              {d.branches.flatMap((b, bi) => [
                <tr key={b.name} className={`os-br${bi % 2 ? ' is-wash' : ''}`}><td colSpan={6}><div><p><b>{b.name}</b><span>{totals(b.orders)}</span></p></div></td></tr>,
                ...b.orders.map((o) => <OrderRow key={o.id} o={o} wash={bi % 2 === 1} mark={mark.get(o.id)} />),
              ])}
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

const totals = (os: Order[]) => `${os.length === 1 ? 'הזמנה אחת' : `${os.length} הזמנות`} · ${pizzasIn(os)} פיצות · ${fmtMoney(amountIn(os))}`;

function OrderRow({ o, wash, mark }: { o: Order; wash: boolean; mark?: 'new' | 'changed' }) {
  const pz = pizzasIn([o]);
  const name = o.contactName?.trim(), phone = o.contactPhone?.trim(), note = o.instructions?.trim();
  return (
    <tr className={[wash && 'is-wash', mark && `is-${mark}`].filter(Boolean).join(' ') || undefined}>
      <td className="os-when"><b><Ltr>{o.time}</Ltr></b></td>
      <td className="os-pz">{pz > 0 && <span><Ltr>{pz}</Ltr></span>}</td>
      <td className="os-cust">
        {mark && <span className={`os-tag os-tag--${mark}`}>{mark === 'new' ? 'חדש' : 'עודכן'}</span>}
        <b>{o.customerName}</b>
        {(name || phone) && <span className="os-sub">{name}{name && phone && ' · '}{phone && <Ltr>{fmtPhone(phone)}</Ltr>}</span>}
      </td>
      <td className="os-items"><Items o={o} />{note && <p className="os-note"><b>הערה לסניף:</b> {note}</p>}</td>
      <td className="os-dlv">{o.delivery === 'pickup' ? <b>איסוף עצמי</b> : (o.address?.trim() || <b>משלוח</b>)}</td>
      <td className="m"><Ltr>{fmtMoney(o.amount)}</Ltr></td>
    </tr>
  );
}

/* פירוט מלא, צפוף: שורה לכל סוג פיצה (עם התוספות והחלוקה), וכל שאר הקטגוריות יחד בשורה אחת */
function Items({ o }: { o: Order }) {
  if (!o.items.length) return <>{o.contents?.trim() || '—'}</>;
  if (!o.items.some((i) => categoryOf(i) !== OTHER)) return <>{itemsText(o.items)}</>;
  const groups = groupItems(o.items);
  const rest = groups.filter((g) => g.category !== PIZZA);
  return (
    <>
      {groups.find((g) => g.category === PIZZA)?.types.map((t, i) => (
        <div key={i} className="os-type">
          <b>{t.qty} {t.name}</b>
          {t.rows.length === 1
            ? t.rows[0].text && <> — {t.rows[0].text}</>
            : <> — {t.rows.map((r, j) => <span key={j}>{j > 0 && ' · '}<b>{r.qty}</b> {r.text || 'רגיל'}</span>)}</>}
        </div>
      ))}
      {rest.length > 0 && (
        <div className="os-extra">
          {rest.map((g) => <span key={g.category}><b>{g.category}:</b> {g.types.map(typeText).join(' · ')} </span>)}
        </div>
      )}
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
