/* חריגים ומשימות (אפיון 9): כל מה שדורש טיפול, במקום אחד. שורה לכל בעיה, עם הכפתור שפותר אותה,
   מקובץ לפי חומרה; ובצד – משימות המעקב מתיקי הלקוחות. מבוסס על אותו מנוע של מסך "היום" והפעמון. */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CalendarClock, CircleCheckBig, X } from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { useAuth } from '../../auth/AuthContext';
import { useStore, type OrderView } from '../../data/store';
import { setTaskDone, type Task } from '../../data/tasks';
import { useToast } from '../../design/Toast';
import { Ltr, fmtDate, toISODate } from '../../lib/format';
import { RULE_LABEL, type Issue, type Severity } from '../../rules-engine/health';
import { FixButton } from '../orders/OrderActions';
import '../pages.css';
import './ExceptionsPage.css';

type Row = { o: OrderView; issue: Issue };
const GROUPS: [Severity, string][] = [['red', 'חריגות'], ['orange', 'דחוף'], ['yellow', 'חסר']];

export function ExceptionsPage() {
  const { orders, now, tasks } = useStore();
  const { profile } = useAuth();
  const panel = usePanel();
  const reduce = useReducedMotion();
  const [params, setParams] = useSearchParams();
  const [mine, setMine] = useState(false);
  const rule = params.get('rule');
  const today = toISODate(now);
  const tomorrow = toISODate(new Date(now.getTime() + 86400000));

  const all = useMemo<Row[]>(() => orders
    .filter((o) => !mine || (o.handlerUid ? o.handlerUid === profile?.uid : o.handler === profile?.name))
    .flatMap((o) => o.issues.map((issue) => ({ o, issue })))
    .sort((a, b) => (a.o.date + a.o.time).localeCompare(b.o.date + b.o.time)), [orders, mine, profile]);
  const rows = rule === null ? all : all.filter((r) => String(r.issue.rule) === rule);
  const counts = useMemo(() => {
    const m = new Map<number, number>();
    all.forEach((r) => m.set(r.issue.rule, (m.get(r.issue.rule) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [all]);
  const by = (s: Severity) => rows.filter((r) => r.issue.severity === s);

  const overdue = tasks.filter((t) => t.due < today);
  const dueToday = tasks.filter((t) => t.due === today);
  const upcoming = tasks.filter((t) => t.due > today);
  const when = (iso: string) => (iso === today ? 'היום' : iso === tomorrow ? 'מחר' : <Ltr>{fmtDate(iso)}</Ltr>);
  const setRule = (r: string | null) => { const p = new URLSearchParams(params); if (r === null) p.delete('rule'); else p.set('rule', r); setParams(p, { replace: true }); };

  return (
    <div className="page exc">
      <header className="page__head">
        <div>
          <h1 className="page__title">חריגים ומשימות</h1>
          <p className="page__sub">כל מה שדורש טיפול, לפי חומרה. כל שורה עם הכפתור שפותר אותה.</p>
        </div>
        <dl className="head-stats">
          <div className={by('red').length ? 'is-alert' : ''}><dt>חריגות</dt><dd><Ltr>{all.filter((r) => r.issue.severity === 'red').length}</Ltr></dd></div>
          <div><dt>דחוף</dt><dd><Ltr>{all.filter((r) => r.issue.severity === 'orange').length}</Ltr></dd></div>
          <div><dt>חסר</dt><dd><Ltr>{all.filter((r) => r.issue.severity === 'yellow').length}</Ltr></dd></div>
          <div className={overdue.length ? 'is-alert' : ''}><dt>משימות להיום</dt><dd><Ltr>{overdue.length + dueToday.length}</Ltr></dd></div>
        </dl>
      </header>

      <div className="tablebar">
        <div className="seg" role="group" aria-label="של מי">
          <button className={!mine ? 'is-on' : ''} aria-pressed={!mine} onClick={() => setMine(false)}>כולם</button>
          <button className={mine ? 'is-on' : ''} aria-pressed={mine} onClick={() => setMine(true)}>שלי</button>
        </div>
        <div className="chips" role="group" aria-label="סינון לפי סוג">
          {counts.map(([r, n]) => (
            <button key={r} className={`chip ${rule === String(r) ? 'is-on' : ''}`} aria-pressed={rule === String(r)} onClick={() => setRule(rule === String(r) ? null : String(r))}>
              {RULE_LABEL[r] ?? r} <span className="chip__n"><Ltr>{n}</Ltr></span>
              {rule === String(r) && <X size={13} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>

      <div className="exc__grid">
        <section className="card" aria-labelledby="h-exc">
          <div className="card__head"><h2 id="h-exc" className="card__title">הזמנות שדורשות טיפול</h2><span className="muted exc__n"><Ltr>{rows.length}</Ltr> שורות</span></div>
          {rows.length === 0 ? (
            <p className="calm exc__calm"><CircleCheckBig size={18} aria-hidden="true" /> {rule ? `אין "${RULE_LABEL[Number(rule)]}"` : 'אין חריגים. הכל מטופל'}</p>
          ) : GROUPS.map(([sev, title]) => {
            const list = by(sev);
            if (!list.length) return null;
            return (
              <div key={sev} className="exc__group">
                <p className={`exc__label exc__label--${sev}`}>{title} <Ltr>{list.length}</Ltr></p>
                <ul className="exc__list">
                  <AnimatePresence initial={false}>
                    {list.map(({ o, issue }) => (
                      <motion.li key={`${o.id}-${issue.rule}`} layout={!reduce} className={`exc__row exc__row--${sev}`}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }} transition={{ duration: 0.18 }}>
                        <button className="exc__main" onClick={(e) => panel.open(o.id, e.currentTarget)}>
                          <span className="exc__issue">{issue.label}</span>
                          <span className="exc__meta">
                            <b>{o.customerName}</b> · {when(o.date)} <Ltr>{o.time}</Ltr> · {o.branchName} · הזמנה <Ltr>{o.id}</Ltr>
                          </span>
                        </button>
                        <FixButton key={issue.rule} o={o} issue={issue} onOpen={() => panel.open(o.id)} />
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
            <p className="exc__empty"><CalendarClock size={18} aria-hidden="true" /> אין משימות פתוחות. משימה נוצרת מ"משימת חזרה" בתיק לקוח.</p>
          ) : (
            <>
              <TaskGroup title="באיחור" tone="red" list={overdue} when={when} />
              <TaskGroup title="היום" tone="brand" list={dueToday} when={when} />
              <TaskGroup title="בהמשך" tone="muted" list={upcoming} when={when} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function TaskGroup({ title, tone, list, when }: { title: string; tone: 'red' | 'brand' | 'muted'; list: Task[]; when: (iso: string) => React.ReactNode }) {
  const toast = useToast();
  if (!list.length) return null;
  const done = (t: Task) => setTaskDone(t, true)
    .then(() => toast({ message: <>משימה סומנה כבוצעה · {t.customerName}</>, onUndo: () => { setTaskDone({ ...t, done: true }, false).catch(() => undefined); } }))
    .catch(() => toast({ message: 'הסימון נכשל – בדוק חיבור' }));
  return (
    <div className="exc__group">
      <p className={`exc__label exc__label--${tone}`}>{title} <Ltr>{list.length}</Ltr></p>
      <ul className="tasks">
        {list.map((t) => (
          <li key={t.id} className="task-row">
            <label className="task-row__check">
              <input type="checkbox" onChange={() => done(t)} aria-label={`סמן כבוצע: ${t.text}`} />
            </label>
            <span className="task-row__main">
              <span className="task-row__text">{t.text}</span>
              <span className="task-row__meta"><Link to={`/customers/${t.customerId}`}>{t.customerName || 'לקוח'}</Link> · {when(t.due)} · {t.byName}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
