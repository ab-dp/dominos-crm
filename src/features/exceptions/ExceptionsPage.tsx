/* חריגים ומשימות (אפיון 9): כל מה שדורש טיפול, במקום אחד. שורה לכל הזמנה עם כל הבעיות שלה והכפתור שפותר את העיקרית,
   מקובץ לפי החומרה; ובצד – משימות המעקב מתיקי הלקוחות. מבוסס על אותו מנוע של מסך "היום". */
import { useMemo } from 'react';
import { ordersWithSeverity, topSeverity } from '../../data/metrics';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CalendarClock, CircleCheckBig, X } from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { useAuth } from '../../auth/AuthContext';
import { useStore, type OrderView } from '../../data/store';
import { setTaskDone, type Task } from '../../data/tasks';
import { useToast } from '../../design/Toast';
import { Skeleton } from '../../design/components';
import { Ltr, addDays, fmtDate, toISODate } from '../../lib/format';
import { usePref } from '../../lib/prefs';
import { RULE_LABEL, SEVERITY_LABEL, type Issue, type Severity } from '../../rules-engine/health';
import { FixButton } from '../orders/OrderActions';
import '../pages.css';
import './ExceptionsPage.css';

/* צ'יפים בסדר קבוע לפי שלבי ההזמנה (לא לפי כמות – כדי שלא יזוזו אחרי כל תיקון).
   "עדכון בתפעול" מאחד את הדחוף (כלל 4) ואת המעקב להזמנה רחוקה (כלל 0) */
const CHIPS: { key: string; rules: number[]; label?: string }[] = [
  { key: '6', rules: [6] }, { key: '4', rules: [4, 0], label: 'עדכון בתפעול' }, { key: '1', rules: [1] }, { key: '12', rules: [12] },
  { key: '2', rules: [2] }, { key: '11', rules: [11] }, { key: '5', rules: [5] }, { key: '7', rules: [7] },
  { key: '3', rules: [3] }, { key: '10', rules: [10] }, { key: '8', rules: [8], label: 'פרטים חסרים' },
];
type Chip = (typeof CHIPS)[number];
const chipLabel = (c: Chip) => c.label ?? RULE_LABEL[c.rules[0]];
const GROUPS: Severity[] = ['red', 'orange', 'yellow', 'info'];
/* שורה לכל הזמנה: הבעיות שלה (כולן, או רק מהסוג שסונן), החמורה ראשונה */
type Row = { o: OrderView; issues: Issue[] };

export function ExceptionsPage() {
  const { orders, now, tasks, loading } = useStore();
  const { profile } = useAuth();
  const panel = usePanel();
  const reduce = useReducedMotion();
  const [params, setParams] = useSearchParams();
  // "כולם / שלי" נשמר לכל משתמש, ומשותף ל"היום" ול"חריגים ומשימות"
  const [mine, setMine] = usePref('scope:mine', false);
  const raw = params.get('rule');
  // קישורים ישנים (rule=0) מגיעים לצ'יפ המאוחד
  const chip = raw === null ? null : CHIPS.find((c) => c.key === raw || c.rules.includes(Number(raw))) ?? null;
  const today = toISODate(now);
  const tomorrow = toISODate(addDays(now, 1));

  const scoped = useMemo(() => orders.filter((o) => !mine || (o.handlerUid ? o.handlerUid === profile?.uid : o.handler === profile?.name)), [orders, mine, profile]);
  const all = useMemo<Row[]>(() => scoped
    .filter((o) => o.issues.length > 0)
    .map((o) => ({ o, issues: o.issues }))
    .sort((a, b) => (a.o.date + a.o.time).localeCompare(b.o.date + b.o.time)), [scoped]);
  const rows = useMemo<Row[]>(() => (chip
    ? all.map((r) => ({ o: r.o, issues: r.issues.filter((i) => chip.rules.includes(i.rule)) })).filter((r) => r.issues.length > 0)
    : all), [all, chip]);
  const counts = useMemo(() => new Map(CHIPS.map((c) => [c.key, all.filter((r) => r.issues.some((i) => c.rules.includes(i.rule))).length])), [all]);
  // הקבוצה נקבעת לפי הבעיה החמורה בשורה
  const by = (s: Severity) => rows.filter((r) => topSeverity(r.issues) === s);

  const overdue = tasks.filter((t) => t.due < today);
  const dueToday = tasks.filter((t) => t.due === today);
  const upcoming = tasks.filter((t) => t.due > today);
  const when = (iso: string) => (iso === today ? 'היום' : iso === tomorrow ? 'מחר' : <Ltr>{fmtDate(iso)}</Ltr>);
  const setChip = (k: string | null) => { const p = new URLSearchParams(params); if (k === null) p.delete('rule'); else p.set('rule', k); setParams(p, { replace: true }); };

  return (
    <div className="page exc">
      <header className="page__head">
        <div>
          <h1 className="page__title">חריגים ומשימות</h1>
          <p className="page__sub">שורה לכל הזמנה, לפי חומרה, עם הכפתור שפותר את הבעיה העיקרית</p>
        </div>
        <dl className="head-stats">
          {GROUPS.map((sev) => {
            // סופרים הזמנות ולא בעיות – "חריגות" כאן = המספר ליד "חריגים" בתפריט
            const n = ordersWithSeverity(scoped, sev);
            return <div key={sev} className={n && sev === 'red' ? 'is-alert' : ''}><dt>{SEVERITY_LABEL[sev]}</dt><dd><Ltr>{n}</Ltr></dd></div>;
          })}
          <div className={overdue.length ? 'is-warn' : ''}><dt>משימות להיום</dt><dd><Ltr>{overdue.length + dueToday.length}</Ltr></dd></div>
        </dl>
      </header>

      <div className="tablebar">
        <div className="seg" role="group" aria-label="של מי">
          <button className={!mine ? 'is-on' : ''} aria-pressed={!mine} onClick={() => setMine(false)}>כולם</button>
          <button className={mine ? 'is-on' : ''} aria-pressed={mine} onClick={() => setMine(true)}>שלי</button>
        </div>
        <div className="chips" role="group" aria-label="סינון לפי סוג">
          {/* צ'יפ פעיל נשאר גם כשהתרוקן – כדי שתמיד יהיה איך לבטל את הסינון */}
          {CHIPS.filter((c) => counts.get(c.key) || chip?.key === c.key).map((c) => {
            const on = chip?.key === c.key;
            return (
              <button key={c.key} className={`chip ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => setChip(on ? null : c.key)}>
                {chipLabel(c)} <span className="chip__n"><Ltr>{counts.get(c.key) ?? 0}</Ltr></span>
                {on && <X size={14} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="exc__grid">
        <section className="card" aria-labelledby="h-exc">
          <div className="card__head">
            <h2 id="h-exc" className="card__title">הזמנות שדורשות טיפול</h2>
            <span className="muted exc__n">{rows.length === 1 ? 'הזמנה אחת' : <><Ltr>{rows.length}</Ltr> הזמנות</>}</span>
          </div>
          {loading ? <div className="loading-rows" aria-busy="true" aria-label="טוען">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={40} />)}</div> : rows.length === 0 ? (
            chip ? (
              <div className="exc__calm exc__calm--filter">
                <p className="calm"><CircleCheckBig size={16} aria-hidden="true" /> אין הזמנות עם "{chipLabel(chip)}"</p>
                <button className="link" onClick={() => setChip(null)}>הצג את כל החריגים</button>
              </div>
            ) : <p className="calm exc__calm"><CircleCheckBig size={16} aria-hidden="true" /> אין חריגים. הכל מטופל</p>
          ) : GROUPS.map((sev) => {
            const list = by(sev);
            if (!list.length) return null;
            return (
              <div key={sev} className="exc__group" role="group" aria-labelledby={`exc-g-${sev}`}>
                <p id={`exc-g-${sev}`} className={`exc__label exc__label--${sev}`}>{SEVERITY_LABEL[sev]} <Ltr>{list.length}</Ltr></p>
                <ul className="exc__list">
                  <AnimatePresence initial={false}>
                    {list.map(({ o, issues }) => (
                      <motion.li key={o.id} layout={!reduce} className="exc__row"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }} transition={{ duration: 0.18 }}>
                        <button className="exc__main" onClick={(e) => panel.open(o.id, e.currentTarget)}
                          aria-label={`${issues.map((i) => i.label).join(', ')}. ${o.customerName}, הזמנה ${o.id}`}>
                          <span className="exc__issues" aria-hidden="true">
                            <span className="exc__issue">{issues[0].label}</span>
                            {issues.slice(1).map((i) => <span key={i.rule} className={`exc__more exc__more--${i.severity}`}>{i.label}</span>)}
                          </span>
                          <span className="exc__meta" aria-hidden="true">
                            <b>{o.customerName}</b> · {when(o.date)} <Ltr>{o.time}</Ltr> · {o.branchName} · הזמנה <Ltr>{o.id}</Ltr>
                          </span>
                        </button>
                        <FixButton key={issues[0].rule} o={o} issue={issues[0]} onOpen={() => panel.open(o.id)} />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            );
          })}
        </section>

        <section className="card" aria-labelledby="h-tasks">
          <div className="card__head"><h2 id="h-tasks" className="card__title">משימות מעקב</h2><span className="muted exc__n"><Ltr>{tasks.length}</Ltr> פתוחות</span></div>
          {tasks.length === 0 ? (
            <p className="exc__empty"><CalendarClock size={16} aria-hidden="true" /> אין משימות פתוחות. משימה נוצרת מ"משימת חזרה" בתיק לקוח, או מהצעד הבא של ליד.</p>
          ) : (
            <>
              <TaskGroup title="באיחור" tone="orange" list={overdue} when={when} />
              <TaskGroup title="היום" tone="brand" list={dueToday} when={when} />
              <TaskGroup title="בהמשך" tone="muted" list={upcoming} when={when} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function TaskGroup({ title, tone, list, when }: { title: string; tone: 'orange' | 'brand' | 'muted'; list: Task[]; when: (iso: string) => React.ReactNode }) {
  const toast = useToast();
  if (!list.length) return null;
  const done = (t: Task, box: HTMLInputElement) => setTaskDone(t, true)
    .then(() => toast({ message: <>משימה סומנה כבוצעה · {t.customerName}</>, onUndo: () => { setTaskDone({ ...t, done: true }, false).catch(() => undefined); } }))
    // סימון שנכשל – התיבה חוזרת לריקה, כדי שלא תיראה כמו משימה שבוצעה
    .catch(() => { box.checked = false; toast({ tone: 'error', message: 'הסימון נכשל – בדוק חיבור' }); });
  return (
    <div className="exc__group" role="group" aria-label={title}>
      <p className={`exc__label exc__label--${tone}`}>{title} <Ltr>{list.length}</Ltr></p>
      <ul className="tasks">
        {list.map((t) => (
          <li key={t.id} className="task-row">
            <label className="task-row__check">
              <input type="checkbox" onChange={(e) => done(t, e.currentTarget)} aria-label={`סמן כבוצע: ${t.text}`} />
            </label>
            <span className="task-row__main">
              <span className="task-row__text">{t.text}</span>
              <span className="task-row__meta"><Link to={t.leadId ? `/leads/${t.leadId}` : `/customers/${t.customerId}?tab=activity`}>{t.customerName || 'לקוח'}</Link>{t.leadId && <span className="muted"> (ליד)</span>} · {when(t.due)} · {t.byName}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
