/* ציר הזמן בתיק הלקוח (שלב 8, PLAN סעיף 11): כל מה שקרה מול הלקוח במקום אחד – הזמנות, הצעות מחיר, הערות, שיחות,
   משימות חזרה ותיעודי טיפול. שום דבר לא נשמר פעמיים: הציר מורכב מהמקורות הקיימים (ההזמנות והצעות שכבר נטענו לתיק,
   ו-customers/{id}/activity). מקובץ לפי יום, עם מסנן סוג ו"הצג עוד". בראש – מחבר: הערה / שיחה / משימת חזרה, "קשור ל".
   לידו – "פתוח עכשיו" (הזמנות פתוחות, הצעות שממתינות, משימות), אנשי קשר, כתובות והנחיות חיוב. DESIGN.md "Timeline". */
import { useEffect, useMemo, useState, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Check, FileText, HeartHandshake, MapPin, Phone, ReceiptText, StickyNote } from 'lucide-react';
import { addActivity, type Activity, type Customer } from '../../data/customers';
import { OPEN_QUOTE, SHORT_STATUS, addBusinessDays, callDue, isExpired, type Quote } from '../../data/quotes';
import { setTaskDone, updateTask, type Task } from '../../data/tasks';
import { CLOSED, STAGE_LABEL, stageOf } from '../../data/types';
import type { OrderView } from '../../data/store';
import { noComp } from '../../data/care';
import { revenueOf } from '../../data/metrics';
import { usePanel } from '../../app/PanelContext';
import { Button, Skeleton } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, fmtDate, fmtMoney, fmtPhone, toISODate } from '../../lib/format';
import { CARD_RE } from '../../lib/names';

export type TlKind = 'order' | 'quote' | 'note' | 'call' | 'followup' | 'care';
export type TlFilter = 'all' | 'orders' | 'quotes' | 'notes' | 'care' | 'tasks';
export type TlEvent = { id: string; kind: TlKind; at: string; day: string; order?: OrderView; quote?: Quote; act?: Activity };

const pad = (n: number) => String(n).padStart(2, '0');
/* תאריך ושעה מקומיים במבנה שאפשר למיין: YYYY-MM-DDTHH:MM */
const stamp = (d: Date) => `${toISODate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/* בונה את הציר מהמקורות – בלי לשמור שום דבר. רשומה שעוד לא קיבלה חותמת מהשרת (נשמרת עכשיו) – בראש */
export function buildTimeline(orders: OrderView[], quotes: Quote[], acts: Activity[], now: Date): TlEvent[] {
  const ev: TlEvent[] = [];
  for (const o of orders) {
    const at = `${o.createdAt}T${o.createdTime ?? '00:00'}`;
    ev.push({ id: `o${o.id}`, kind: 'order', at, day: o.createdAt, order: o });
  }
  for (const q of quotes) {
    const d = q.createdAt?.toDate();
    const at = d ? stamp(d) : `${q.issueDate || toISODate(now)}T00:00`;
    ev.push({ id: `q${q.id}`, kind: 'quote', at, day: at.slice(0, 10), quote: q });
  }
  for (const a of acts) {
    const at = a.at ? stamp(a.at.toDate()) : stamp(now);
    ev.push({ id: `a${a.id}`, kind: a.kind, at, day: at.slice(0, 10), act: a });
  }
  return ev.sort((x, y) => y.at.localeCompare(x.at) || y.id.localeCompare(x.id));
}

const FILTER_KINDS: Record<TlFilter, TlKind[] | null> = { all: null, orders: ['order'], quotes: ['quote'], notes: ['note', 'call'], care: ['care'], tasks: ['followup'] };
export const filterTimeline = (ev: TlEvent[], f: TlFilter) => (FILTER_KINDS[f] ? ev.filter((e) => FILTER_KINDS[f]!.includes(e.kind)) : ev);

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
/* כותרת יום: היום / אתמול / יום שלישי 24.11.2026 */
export function dayLabel(day: string, today: string) {
  if (day === today) return 'היום';
  const y = new Date(today + 'T12:00'); y.setDate(y.getDate() - 1);
  if (day === toISODate(y)) return 'אתמול';
  return `יום ${DAYS[new Date(day + 'T12:00').getDay()]} ${fmtDate(day)}`;
}

/* משימת חזרה פתוחה שנוצרה מהרשומה הזו – לפי המזהה (taskId); רשומה ישנה, או משימה שעברה במיזוג לקוחות – לפי טקסט ותאריך.
   מוצגת כאזור עם "בוצע" ו"דחייה" */
const taskOf = (a: Activity, tasks: Task[]) => {
  if (a.kind !== 'followup' || !a.due) return undefined;
  const open = tasks.filter((t) => !t.done);
  return (a.taskId ? open.find((t) => t.id === a.taskId) : undefined) ?? open.find((t) => t.due === a.due && t.text.trim() === a.text.trim());
};

const KIND_LABEL: Record<TlKind, string> = { order: 'הזמנה', quote: 'הצעת מחיר', note: 'הערה', call: 'שיחה', followup: 'משימת חזרה', care: 'תיעוד טיפול' };
const ICON: Record<TlKind, ReactNode> = {
  order: <ReceiptText size={16} />, quote: <FileText size={16} />, note: <StickyNote size={16} />, call: <Phone size={16} />, followup: <CalendarClock size={16} />, care: <HeartHandshake size={16} />,
};
const FILTERS: [TlFilter, string][] = [['all', 'הכל'], ['orders', 'הזמנות'], ['quotes', 'הצעות'], ['notes', 'שיחות והערות'], ['care', 'תיעודי טיפול'], ['tasks', 'משימות']];
const PAGE = 40;
const OPEN_ROWS = 5; // "פתוח עכשיו" – עד 5 שורות, והשאר ב"עוד"

/* בוצע / דחייה למשימה: בזמן הכתיבה הכפתור נעול (לחיצה כפולה לא כותבת פעמיים), וכשל – הודעה */
function useTaskActions(today: string) {
  const toast = useToast();
  const [busy, setBusy] = useState<string[]>([]);
  const run = async (t: Task, f: () => Promise<void>) => {
    if (busy.includes(t.id)) return;
    setBusy((b) => [...b, t.id]);
    try { await f(); } catch { toast({ message: 'הפעולה נכשלה – בדקו חיבור ונסו שוב' }); }
    finally { setBusy((b) => b.filter((x) => x !== t.id)); }
  };
  return {
    busy: (t: Task) => busy.includes(t.id),
    done: (t: Task) => run(t, async () => { await setTaskDone(t, true); toast({ message: 'המשימה סומנה כבוצעה', onUndo: () => setTaskDone({ ...t, done: true }, false) }); }),
    postpone: (t: Task) => run(t, async () => { const d = addBusinessDays(t.due > today ? t.due : today, 1); await updateTask(t, { text: t.text, due: d }); toast({ message: <>נדחתה ל-<Ltr>{fmtDate(d)}</Ltr></> }); }),
  };
}
type ComposeKind = 'note' | 'call' | 'followup';
const COMPOSE: Record<ComposeKind, string> = { note: 'הערה', call: 'שיחה', followup: 'משימת חזרה' };

export function TimelineTab({ c, orders, quotes, acts, tasks, now, loading, composeReq, onComposed, taRef, startFilter = 'all' }: {
  c: Customer; orders: OrderView[]; quotes: Quote[]; acts: Activity[]; tasks: Task[]; now: Date; loading: boolean; startFilter?: TlFilter;
  composeReq: { kind: ComposeKind; n: number }; onComposed: () => void; taRef: RefObject<HTMLTextAreaElement>;
}) {
  const panel = usePanel();
  const toast = useToast();
  const today = toISODate(now);
  const [filter, setFilter] = useState<TlFilter>(startFilter);
  const [limit, setLimit] = useState(PAGE);
  const all = useMemo(() => buildTimeline(orders, quotes, acts, now), [orders, quotes, acts, now]);
  const shown = filterTimeline(all, filter);
  const page = shown.slice(0, limit);
  const days = useMemo(() => {
    const m: { day: string; ev: TlEvent[] }[] = [];
    for (const e of page) { const last = m[m.length - 1]; if (last?.day === e.day) last.ev.push(e); else m.push({ day: e.day, ev: [e] }); }
    return m;
  }, [page]);

  /* ---------- מחבר ---------- */
  const [kind, setKind] = useState<ComposeKind>('note');
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const [ref, setRef] = useState(''); // '' / o123 / q1001
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const ta = useTaskActions(today);
  // "תיעוד שיחה" / "הערה" מהכותרת – הסוג נבחר והסמן עובר לתיבה. הבקשה מתאפסת אחרי הטיפול, כך שחזרה ללשונית לא קופצת שוב לתיבה
  useEffect(() => {
    if (!composeReq.n) return;
    setKind(composeReq.kind);
    requestAnimationFrame(() => taRef.current?.focus());
    onComposed();
  }, [composeReq.n]); // eslint-disable-line react-hooks/exhaustive-deps
  // "קשור ל": הזמנות פתוחות ו-10 האחרונות, הצעות פתוחות ו-5 האחרונות
  const refOrders = useMemo(() => {
    const open = orders.filter((o) => !CLOSED.includes(o.status));
    const recent = [...orders].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 10);
    return [...new Map([...open, ...recent].map((o) => [o.id, o])).values()];
  }, [orders]);
  const refQuotes = useMemo(() => {
    const open = quotes.filter((q) => OPEN_QUOTE.includes(q.status));
    const recent = [...quotes].sort((a, b) => b.id - a.id).slice(0, 5);
    return [...new Map([...open, ...recent].map((q) => [q.id, q])).values()];
  }, [quotes]);
  const submit = async () => {
    if (!text.trim()) return setErr('כתבו משהו לפני השמירה');
    if (CARD_RE.test(text)) return setErr('אסור לרשום כאן מספר כרטיס אשראי');
    if (kind === 'followup' && !due) return setErr('למשימת חזרה צריך תאריך');
    setBusy(true);
    try {
      await addActivity(c.id, {
        kind, text, due: kind === 'followup' ? due : undefined,
        ...(ref.startsWith('o') ? { orderId: ref.slice(1) } : {}), ...(ref.startsWith('q') ? { quoteId: Number(ref.slice(1)) } : {}),
      }, c.name);
      setText(''); setDue(''); setRef(''); setErr('');
      toast({ message: `${COMPOSE[kind]} נשמרה` });
    } catch { setErr('השמירה נכשלה – בדקו חיבור ונסו שוב'); }
    finally { setBusy(false); }
  };

  const orderChip = (id: number | string, label?: ReactNode) => (
    <button type="button" className="tl__ref" onClick={(e) => panel.open(Number(id), e.currentTarget)}>{label ?? <>הזמנה <Ltr>{id}</Ltr></>}</button>
  );
  const quoteChip = (id: number) => <Link className="tl__ref" to={`/quotes/${id}`}>הצעה <Ltr>{id}</Ltr></Link>;

  const body = (e: TlEvent): { title: ReactNode; by?: string; facts?: ReactNode[]; text?: ReactNode; extra?: ReactNode } => {
    if (e.order) {
      const o = e.order;
      const st = stageOf(o);
      return {
        title: orderChip(o.id), by: o.createdBy,
        facts: [<>מועד <Ltr key="d">{fmtDate(o.date)} {o.time}</Ltr></>, o.branchName || null, <Ltr key="m">{fmtMoney(revenueOf(o))}</Ltr>,
          <span key="s" className={o.late ? 'tl__tag tl__tag--late' : st === 'cancelled' ? 'muted' : undefined}>{o.late ? 'איחור' : STAGE_LABEL[st]}</span>].filter(Boolean),
      };
    }
    if (e.quote) {
      const q = e.quote;
      const exp = isExpired(q, today);
      return {
        title: quoteChip(q.id), by: q.handler || undefined,
        facts: [<span key="s">{exp ? 'פג תוקף' : SHORT_STATUS[q.status]}</span>, q.total ? <Ltr key="t">{fmtMoney(q.total)}</Ltr> : null,
          q.status === 'ordered' && q.orderId ? orderChip(q.orderId, <>הפכה להזמנה <Ltr>{q.orderId}</Ltr></>) : null].filter(Boolean),
      };
    }
    const a = e.act!;
    const related = a.kind !== 'care' && a.orderId ? orderChip(a.orderId) : a.quoteId ? quoteChip(a.quoteId) : null;
    if (a.kind === 'care') {
      return {
        title: a.order ? orderChip(a.order.id) : null, by: a.byName,
        facts: [a.topic ? <span key="t">{a.topic}</span> : null, a.callAt ? <>שיחה ב-<Ltr>{fmtDate(a.callAt)}</Ltr></> : null,
          !noComp(a) ? <span key="c" className="tl__tag tl__tag--comp">פיצוי: {a.comp}{a.compAmount ? <> · <Ltr>{fmtMoney(a.compAmount)}</Ltr></> : null}</span> : null].filter(Boolean),
        text: a.text,
      };
    }
    const task = taskOf(a, tasks);
    return {
      title: related, by: a.byName,
      facts: a.due && !task ? [a.taskId ? <span key="x" className="muted">נסגרה</span> : <>לחזור ב-<Ltr>{fmtDate(a.due)}</Ltr></>] : undefined,
      text: a.text,
      extra: task ? (
        <div className="tl__task">
          <span>{task.due <= today ? 'לחזור היום' : <>לחזור ב-<Ltr>{fmtDate(task.due)}</Ltr></>}</span>
          <Button size="sm" variant="secondary" icon={<Check size={16} />} disabled={ta.busy(task)} onClick={() => ta.done(task)}>בוצע</Button>
          <Button size="sm" variant="ghost" disabled={ta.busy(task)} onClick={() => ta.postpone(task)}>דחייה ליום עסקים</Button>
        </div>
      ) : undefined,
    };
  };

  return (
    <div className="tl-wrap">
      <div className="tl-main card">
        <form className="tl-compose" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="seg seg--sm" role="group" aria-label="סוג">
            {(Object.keys(COMPOSE) as ComposeKind[]).map((k) => <button type="button" key={k} aria-pressed={kind === k} className={kind === k ? 'is-on' : ''} onClick={() => setKind(k)}>{COMPOSE[k]}</button>)}
          </div>
          <textarea ref={taRef} className="input tl-compose__ta" rows={2} value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} aria-label="תוכן"
            placeholder={kind === 'call' ? 'מה סוכם בשיחה?' : kind === 'followup' ? 'למה לחזור ללקוח?' : 'הערה פנימית על הלקוח'} />
          <div className="tl-compose__row">
            {kind === 'followup' && <label className="tl-compose__field"><span className="tl-compose__lbl">תאריך</span><input className="input input--sm" type="date" value={due} min={today} onChange={(e) => { setDue(e.target.value); setErr(''); }} /></label>}
            {(refOrders.length > 0 || refQuotes.length > 0) && (
              <label className="tl-compose__field"><span className="tl-compose__lbl">קשור ל</span>
                <select className="input input--sm tl-compose__ref" value={ref} onChange={(e) => setRef(e.target.value)}>
                  <option value="">—</option>
                  {refOrders.length > 0 && <optgroup label="הזמנות">{refOrders.map((o) => <option key={o.id} value={`o${o.id}`}>{`הזמנה ${o.id} · ${fmtDate(o.date)} · ${STAGE_LABEL[stageOf(o)]}`}</option>)}</optgroup>}
                  {refQuotes.length > 0 && <optgroup label="הצעות מחיר">{refQuotes.map((q) => <option key={q.id} value={`q${q.id}`}>{`הצעה ${q.id} · ${SHORT_STATUS[q.status]}`}</option>)}</optgroup>}
                </select>
              </label>
            )}
            {err && <span className="pop__err" role="alert">{err}</span>}
            <Button size="sm" variant={text.trim() ? 'primary' : 'secondary'} type="submit" className="tl-compose__send" disabled={busy}>שמירה</Button>
          </div>
        </form>

        <div className="tl-filter" role="group" aria-label="הצג">
          <span className="tl-filter__label" aria-hidden="true">הצג:</span>
          {FILTERS.map(([k, l]) => {
            const n = filterTimeline(all, k).length;
            if (k !== 'all' && !n && filter !== k) return null;
            return <button key={k} type="button" className={filter === k ? 'is-on' : ''} aria-pressed={filter === k} onClick={() => { setFilter(k); setLimit(PAGE); }}>{l}{k !== 'all' && <> <span className="tl-filter__n"><Ltr>{n}</Ltr></span></>}</button>;
          })}
        </div>

        <h2 className="sr-only">ציר זמן</h2>
        {loading && !acts.length ? <div className="tl-empty"><Skeleton h={18} w="60%" /><div style={{ height: 10 }} /><Skeleton h={18} w="40%" /></div>
          : days.length === 0 ? <p className="tl-empty muted">{filter === 'all' ? 'אין עדיין פעילות מול הלקוח.' : 'אין רשומות מהסוג הזה.'}</p> : (
          <ol className="tl">
            {days.map((d) => (
              <li key={d.day} className="tl-day">
                <h3 className="tl-day__h">{dayLabel(d.day, today)}</h3>
                <ol className="tl-day__list">
                  {d.ev.map((e) => {
                    const b = body(e);
                    return (
                      <li key={e.id} className={`tl-ev tl-ev--${e.kind}`}>
                        <span className="tl-ev__icon" aria-hidden="true">{ICON[e.kind]}</span>
                        <div className="tl-ev__main">
                          <div className="tl-ev__head">
                            {/* בהזמנה ובהצעה הקישור הוא הכותרת ("הזמנה 1040"); בשאר – סוג הרשומה ואחריו הקישור */}
                            {!(e.order || e.quote) && <span className="tl-ev__kind">{KIND_LABEL[e.kind]}</span>}
                            {b.title}
                            <span className="tl-ev__meta"><Ltr>{e.at.slice(11, 16)}</Ltr>{b.by && <> · {b.by}</>}</span>
                          </div>
                          {b.facts && b.facts.length > 0 && <div className="tl-ev__facts">{b.facts.map((f, i) => <span key={i}>{f}</span>)}</div>}
                          {b.text && <p className="tl-ev__text">{b.text}</p>}
                          {b.extra}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ol>
        )}
        {shown.length > limit && (
          <div className="tl-more"><Button size="sm" variant="secondary" onClick={() => setLimit((n) => n + PAGE)}>הצג עוד (<Ltr>{shown.length - limit}</Ltr>)</Button></div>
        )}
      </div>

      <OpenNow orders={orders} quotes={quotes} tasks={tasks} today={today} ta={ta} />
      <ContactSide c={c} />
    </div>
  );
}

/* ---------- עמודת צד: פתוח עכשיו · אנשי קשר · כתובות · הנחיות חיוב ---------- */
function OpenNow({ orders, quotes, tasks, today, ta }: { orders: OrderView[]; quotes: Quote[]; tasks: Task[]; today: string; ta: ReturnType<typeof useTaskActions> }) {
  const panel = usePanel();
  const [all, setAll] = useState(false);
  const open = orders.filter((o) => !CLOSED.includes(o.status)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const openQ = quotes.filter((q) => OPEN_QUOTE.includes(q.status) && !isExpired(q, today)).sort((a, b) => (a.callAt ?? '9').localeCompare(b.callAt ?? '9'));
  const openT = tasks.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due));
  const nothing = !open.length && !openQ.length && !openT.length;
  // קודם משימות והצעות שצריך לחזור עליהן, אחר כך הזמנות לפי מועד
  const rows: ReactNode[] = [
    ...openT.map((t) => (
      <li key={`t${t.id}`} className="tl-open__task">
        <span className="tl-open__main">{t.text}</span>
        <span className={`tl-open__state ${t.due <= today ? 'is-due' : ''}`}>{t.due <= today ? 'היום' : <Ltr>{fmtDate(t.due)}</Ltr>}</span>
        <button type="button" className="icon-btn icon-btn--sm" aria-label={`סמן כבוצע – ${t.text}`} disabled={ta.busy(t)} onClick={() => ta.done(t)}><Check size={16} /></button>
      </li>
    )),
    ...openQ.map((q) => (
      <li key={`q${q.id}`}>
        <Link className="tl-open__row" to={`/quotes/${q.id}`}>
          <span className="tl-open__main">הצעה <Ltr>{q.id}</Ltr>{q.total ? <> · <Ltr>{fmtMoney(q.total)}</Ltr></> : null}</span>
          <span className={`tl-open__state ${callDue(q, today) ? 'is-due' : ''}`}>{callDue(q, today) ? 'לחזור היום' : SHORT_STATUS[q.status]}</span>
        </Link>
      </li>
    )),
    ...open.map((o) => (
              <li key={`o${o.id}`}>
                <button type="button" className="tl-open__row" onClick={(e) => panel.open(o.id, e.currentTarget)}>
                  <span className="tl-open__main">הזמנה <Ltr>{o.id}</Ltr> · <Ltr>{fmtDate(o.date)}</Ltr> <Ltr>{o.time}</Ltr></span>
                  <span className={`tl-open__state ${o.hold ? 'is-hold' : ''}`}>{o.hold ? 'בהמתנה' : STAGE_LABEL[stageOf(o)]}</span>
                </button>
              </li>
    )),
  ];
  return (
    <section className="card tl-box tl-opennow" aria-labelledby="tl-open-h">
      <h2 id="tl-open-h" className="tl-box__h">פתוח עכשיו</h2>
      {nothing ? <p className="muted tl-box__empty">אין משהו פתוח מול הלקוח</p> : (
        <>
          <ul className="tl-open">{all ? rows : rows.slice(0, OPEN_ROWS)}</ul>
          {rows.length > OPEN_ROWS && <button type="button" className="link tl-open__more" aria-expanded={all} onClick={() => setAll((x) => !x)}>{all ? 'הצג פחות' : <>עוד <Ltr>{rows.length - OPEN_ROWS}</Ltr></>}</button>}
        </>
      )}
    </section>
  );
}

function ContactSide({ c }: { c: Customer }) {
  return (
    <aside className="tl-side" aria-label="פרטי קשר">
      <section className="card tl-box">
        <h2 className="tl-box__h">אנשי קשר</h2>
        {c.contacts.length === 0 ? <p className="muted tl-box__empty">אין</p> : (
          <ul className="tl-plain">
            {c.contacts.map((p) => (
              <li key={p.id}>
                <span>{p.name}{p.role && <span className="muted"> · {p.role}</span>}</span>
                {p.phone && <a className="tl-plain__link" href={`tel:${p.phone}`}><Ltr>{fmtPhone(p.phone)}</Ltr></a>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {c.addresses.length > 0 && (
        <section className="card tl-box">
          <h2 className="tl-box__h">כתובות</h2>
          <ul className="tl-plain">
            {c.addresses.map((a) => <li key={a.id}><MapPin size={14} aria-hidden="true" className="tl-plain__icon" /><span>{a.label ? <b>{a.label} · </b> : null}{a.address}</span></li>)}
          </ul>
        </section>
      )}

      {c.billingInstructions?.trim() && (
        <section className="card tl-box">
          <h2 className="tl-box__h">הנחיות חיוב</h2>
          <p className="tl-box__text">{c.billingInstructions}</p>
        </section>
      )}
    </aside>
  );
}
