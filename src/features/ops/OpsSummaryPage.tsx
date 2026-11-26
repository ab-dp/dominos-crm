/* סיכום לתפעול: בוחרים תאריכים (מחר / סופ"ש / טווח) ומקבלים דף מסודר לכל אשכול – סניף ← יום ושעה, פירוט מלא של כל הזמנה.
   הדף בנוי לצילום מסך או ל-PDF – כתב גדול ושורות צפופות, עמוד אחד לאשכול. נכנסות כל ההזמנות הפתוחות שלא בוטלו.
   סינון (אשכול, סניף, לקוח) אפשרי, וגם אז אפשר להוריד PDF – אבל בראש המסך ובראש כל דף מופיע "סיכום חלקי – מסונן לפי…". */
import { forwardRef, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Filter, Send } from 'lucide-react';
import { useStore } from '../../data/store';
import { Button, EmptyState } from '../../design/components';
import { FilterBar } from '../../design/FilterBar';
import { useToast } from '../../design/Toast';
import { Ltr, fmtDate, fmtMoney, fmtPhone, toISODate, weekday } from '../../lib/format';
import { OTHER, PIZZA, categoryOf, groupItems, itemsText, typeText, type Order } from '../../data/types';
import { amountIn, groupByCluster, inRange, inSummary, pizzasIn, tomorrowRange, weekendRange, type ClusterGroup } from '../../data/opsSummary';
import { filterOptions, filtersText, matchesFilters, type FilterValues } from '../../data/orderFilters';
import { logError } from '../../lib/errorLog';
import '../pages.css';
import './ops.css';

type Mode = 'tomorrow' | 'weekend' | 'custom';
const LOGO = `${import.meta.env.BASE_URL}logo-horizontal.svg`;
const dm = (iso: string) => fmtDate(iso).slice(0, 5);
export const rangeText = (from: string, to: string) => (from === to
  ? `יום ${weekday(from)} ${fmtDate(from)}`
  : `${weekday(from)} ${dm(from)} – ${weekday(to)} ${fmtDate(to)}`);

export function OpsSummaryPage() {
  const { orders, now, channels } = useStore();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>(() => (now.getDay() === 4 ? 'weekend' : 'tomorrow'));
  const [custom, setCustom] = useState(() => tomorrowRange(now));
  const range = mode === 'tomorrow' ? tomorrowRange(now) : mode === 'weekend' ? weekendRange(now) : custom;
  const { from, to } = range;
  const bad = from > to;
  const [busy, setBusy] = useState('');
  const sheets = useRef(new Map<string, HTMLElement>());

  // סינון: אשכול, סניף ולקוח – בכתובת הדף (אותם מפתחות כמו בהזמנות ובדוחות), כך שקישור או רענון שומרים אותו
  const [params, setParams] = useSearchParams();
  const cluster = params.get('cluster') ?? '';
  const branch = params.get('branch') ?? '';
  const channel = params.get('channel') ?? '';
  const cust = params.get('customer') ?? '';
  const fv: FilterValues = useMemo(() => ({ cluster, branch, channel }), [cluster, branch, channel]);
  const custRef = useRef<HTMLInputElement>(null);
  const setMany = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    setParams(p, { replace: true });
  };
  const setCust = (v: string) => setMany({ customer: v || null });
  // "הצג הכל": הבאנר נעלם, ולכן הפוקוס עובר לשדה הלקוח – לא הולך לאיבוד
  const showAll = () => { setMany({ cluster: null, branch: null, channel: null, customer: null }); requestAnimationFrame(() => custRef.current?.focus()); };

  const inDates = useMemo(() => (bad ? [] : orders.filter((o) => inRange(o, from, to) && inSummary(o))), [orders, from, to, bad]);
  const dims = useMemo(() => filterOptions(inDates, ['cluster', 'branch', 'channel'], fv).map((d) => (d.key === 'cluster' ? { ...d, clears: ['branch'] } : d)), [inDates, fv, channels]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = cust.trim();
  const clusters = useMemo(() => groupByCluster(inDates.filter((o) => matchesFilters(o, fv) && (!q || o.customerName.includes(q)))), [inDates, fv, q, channels]); // eslint-disable-line react-hooks/exhaustive-deps
  const filterText = [filtersText(fv), q && `לקוח "${q}"`].filter(Boolean).join(' · ');

  const pdf = async (list: ClusterGroup[], name: string) => {
    const els = list.map((c) => sheets.current.get(c.name)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    setBusy(`pdf:${name}`);
    try {
      const { downloadOpsPdf } = await import('./opsPdf');
      await downloadOpsPdf(els, `סיכום לתפעול ${name} ${fmtDate(from)}${from !== to ? ` עד ${fmtDate(to)}` : ''}${filterText ? ' (חלקי)' : ''}.pdf`);
    } catch (e) {
      logError('ops-pdf', e); // נרשם בהגדרות ← תקלות, כדי שנדע מה נכשל
      toast({ tone: 'error', message: 'הורדת ה-PDF נכשלה. נסו שוב.' });
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
        <FilterBar dims={dims} values={fv} onChange={setMany} extraActive={q ? 1 : 0} alsoClear={['customer']}>
          <input ref={custRef} className="input input--sm ops-range__cust" value={cust} onChange={(e) => setCust(e.target.value)} placeholder="לקוח" aria-label="סינון לפי לקוח" />
        </FilterBar>
      </div>

      {filterText && (
        <div className="ops-partial" role="status">
          <Filter size={16} aria-hidden="true" />
          <p><b>סיכום חלקי</b> – מסונן לפי: {filterText}. הזמנות אחרות בתאריכים האלה לא מופיעות בדף וב-PDF.</p>
          <Button size="sm" variant="secondary" onClick={showAll}>הצג הכל</Button>
        </div>
      )}

      {bad ? <p className="ops-err">תאריך הסיום לפני תאריך ההתחלה.</p> : !clusters.length ? (
        <EmptyState icon={<Send size={20} />} title={filterText && inDates.length ? 'אין הזמנות שמתאימות לסינון' : 'אין הזמנות בתאריכים האלה'}>
          {filterText && inDates.length ? <button type="button" className="link" onClick={showAll}>הצג הכל</button> : 'בחרו תאריכים אחרים.'}
        </EmptyState>
      ) : clusters.map((c) => (
        <section key={c.name} className="ops-card" aria-label={`אשכול ${c.name}`}>
          <div className="ops-card__bar">
            <h2>{c.name}</h2>
            <div className="ops-card__actions">
              <Button size="sm" icon={<Download size={16} />} loading={busy === `pdf:${c.name}`} onClick={() => pdf([c], c.name)}>PDF</Button>
            </div>
          </div>
          <p className="ops-phone">בטלפון הדף מוקטן – לשליחה עדיף להוריד PDF.</p>
          <FitWidth>
            <OpsSheet ref={(el) => { if (el) sheets.current.set(c.name, el); else sheets.current.delete(c.name); }}
              c={c} from={from} to={to} now={now} partial={filterText} />
          </FitWidth>
        </section>
      ))}
    </div>
  );
}

/* הדף עצמו – רוחב קבוע, כדי שצילום מסך ו-PDF ייראו אותו דבר */
const OpsSheet = forwardRef<HTMLElement, { c: ClusterGroup; from: string; to: string; now: Date; partial: string }>(
  function OpsSheet({ c, from, to, now, partial }, ref) {
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
        {partial && <p className="os-partial"><b>סיכום חלקי</b> – מסונן לפי: {partial}. לא כל ההזמנות בתאריכים האלה מופיעות כאן.</p>}
        <table className="os-table">
          <colgroup><col className="c-when" /><col className="c-pz" /><col className="c-cust" /><col className="c-items" /><col className="c-dlv" /><col className="c-sum" /></colgroup>
          <thead><tr><th scope="col">שעה</th><th scope="col" className="c">פיצות</th><th scope="col">לקוח ואיש קשר</th><th scope="col">פירוט ההזמנה</th><th scope="col">אספקה</th><th scope="col" className="m">סכום</th></tr></thead>
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
                ...b.orders.map((o) => <OrderRow key={o.id} o={o} wash={bi % 2 === 1} />),
              ])}
            </tbody>
          ))}
        </table>
        <p className="os-foot">הופק <Ltr>{fmtDate(toISODate(now))} {now.toTimeString().slice(0, 5)}</Ltr> · {partial ? 'סיכום חלקי (מסונן)' : 'כל ההזמנות הפתוחות'} · הסכומים כוללים מע"מ ומשלוח</p>
      </article>
    );
  });

function Stat({ n, l }: { n: ReactNode; l: string }) {
  return <div><b>{n}</b><span>{l}</span></div>;
}

const totals = (os: Order[]) => `${os.length === 1 ? 'הזמנה אחת' : `${os.length} הזמנות`} · ${pizzasIn(os)} פיצות · ${fmtMoney(amountIn(os))}`;

function OrderRow({ o, wash }: { o: Order; wash: boolean }) {
  const pz = pizzasIn([o]);
  // "הערות להזמנה" פנימיות (לנציג שמקליד ל-Q) – לא מופיעות בסיכום לתפעול
  const name = o.contactName?.trim(), phone = o.contactPhone?.trim();
  return (
    <tr className={wash ? 'is-wash' : undefined}>
      <td className="os-when"><b><Ltr>{o.time}</Ltr></b></td>
      <td className="os-pz">{pz > 0 && <span><Ltr>{pz}</Ltr></span>}</td>
      <td className="os-cust">
        <b>{o.customerName}</b>
        {(name || phone) && <span className="os-sub">{name}{name && phone && ' · '}{phone && <Ltr>{fmtPhone(phone)}</Ltr>}</span>}
      </td>
      <td className="os-items"><Items o={o} /></td>
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
