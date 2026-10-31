/* מסך "היום" (אפיון 6.1): תוך עשר שניות לדעת מה דחוף, ותוך דקות לסגור את משימות הבוקר. */
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CalendarClock, CalendarDays, Check, CircleCheckBig, CreditCard, PackageCheck, Send, Store, Wallet } from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { useStore, type OrderView } from '../../data/store';
import { ME } from '../../data/mock';
import { CLOSED } from '../../data/types';
import { HealthBadge, RollingNumber, StatusMenu } from '../../design/components';
import { HEALTH_RANK, orderDateTime } from '../../rules-engine/health';
import { Ltr, Money, fmtDate, fmtMoney, toISODate, weekday } from '../../lib/format';
import { FixButton, OrderMarks } from '../orders/OrderActions';
import { STATUS_LABEL } from '../../data/types';
import '../pages.css';
import './TodayPage.css';

export function TodayPage() {
  const { orders, now, update } = useStore();
  const panel = usePanel();
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const [mine, setMine] = useState(false);

  const today = toISODate(now);
  const tomorrow = toISODate(new Date(now.getTime() + 86400000));
  const week = toISODate(new Date(now.getTime() + 7 * 86400000));
  const scope = mine ? orders.filter((o) => o.handler === ME) : orders;
  const open = scope.filter((o) => !CLOSED.includes(o.status));

  const tasks = [
    { key: 'yesterday', title: 'לסגור מאתמול', icon: <PackageCheck size={20} />, list: open.filter((o) => o.date < today), to: '/orders?tab=overdue', doneText: 'הכל נסגר' },
    { key: 'branch', title: 'אישורי סניף חסרים', sub: 'היום ומחר', icon: <Store size={20} />, list: open.filter((o) => (o.date === today || o.date === tomorrow) && !o.branchApproval), to: '/orders?tab=today&filter=branch', doneText: 'כל הסניפים אישרו' },
    { key: 'q', title: 'להעביר ל-Q', icon: <Send size={20} />, list: open.filter((o) => o.date === today && !o.qNumber), to: '/orders?tab=today&filter=q', doneText: 'הכל הועבר' },
    { key: 'credit', title: 'אשראי לחייב', icon: <CreditCard size={20} />, list: open.filter((o) => o.date === today && o.method === 'credit' && o.payment === 'pending'), to: '/orders?tab=today&filter=credit', doneText: 'הכל חויב' },
  ];
  const allDone = tasks.every((t) => t.list.length === 0);

  const urgent = open
    .filter((o) => o.health === 'critical' || o.health === 'urgent')
    .sort((a, b) => HEALTH_RANK[b.health] - HEALTH_RANK[a.health] || (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 10);

  const todays = scope.filter((o) => o.date === today && o.status !== 'cancelled').sort((a, b) => a.time.localeCompare(b.time));
  const nowIdx = todays.findIndex((o) => orderDateTime(o) > now);
  const month = today.slice(0, 7);
  const monthTotal = scope.filter((o) => o.date.startsWith(month) && o.status !== 'cancelled').reduce((t, o) => t + (o.qAmount ?? o.amount), 0);

  return (
    <div className="page today">
      <header className="page__head">
        <div>
          <h1 className="page__title">היום</h1>
          <p className="page__sub">יום {weekday(today)} · <Ltr>{fmtDate(today)}</Ltr></p>
        </div>
        <div className="page__head-end">
          <div className="seg" role="group" aria-label="הזמנות של">
            <button className={!mine ? 'is-on' : ''} aria-pressed={!mine} onClick={() => setMine(false)}>כולם</button>
            <button className={mine ? 'is-on' : ''} aria-pressed={mine} onClick={() => setMine(true)}>שלי</button>
          </div>
        </div>
      </header>

      {/* ---------- משימות הבוקר ---------- */}
      <section aria-labelledby="h-morning" className="morning">
        <h2 id="h-morning" className="sr-only">משימות הבוקר</h2>
        <AnimatePresence mode="wait" initial={false}>
          {allDone ? (
            <motion.div key="done" className="morning__done"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scaleY: 0.6 }} animate={{ opacity: 1, scaleY: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}>
              <CircleCheckBig size={20} aria-hidden="true" /> משימות הבוקר הושלמו
            </motion.div>
          ) : (
            <motion.ol key="cards" className="morning__cards" exit={reduce ? { opacity: 0 } : { opacity: 0, scaleY: 0.8 }} transition={{ duration: 0.2 }}>
              {tasks.map((t, i) => {
                const n = t.list.length;
                return (
                  <li key={t.key}>
                    <button className={`task ${n === 0 ? 'task--done' : ''}`} onClick={() => nav(t.to)} aria-label={`${i + 1}. ${t.title}: ${n === 0 ? t.doneText : `${n} פתוחות`}`}>
                      <span className="task__step" aria-hidden="true">{i + 1}</span>
                      <span className="task__icon" aria-hidden="true">{t.icon}</span>
                      <span className="task__text">
                        <span className="task__title">{t.title}</span>
                        {t.sub && <span className="task__sub">{t.sub}</span>}
                      </span>
                      <span className="task__count" aria-hidden="true">
                        <AnimatePresence mode="wait" initial={false}>
                          {n === 0 ? (
                            <motion.span key="ok" className="task__ok" initial={reduce ? false : { rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.24 }}>
                              <Check size={20} strokeWidth={3} />
                            </motion.span>
                          ) : (
                            <motion.span key="n" exit={reduce ? { opacity: 0 } : { rotateY: -90, opacity: 0 }} transition={{ duration: 0.16 }}>
                              <RollingNumber value={n} />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>
                    </button>
                  </li>
                );
              })}
            </motion.ol>
          )}
        </AnimatePresence>
      </section>

      <div className="today__grid">
        {/* ---------- דחוף עכשיו ---------- */}
        <section className="card" aria-labelledby="h-urgent">
          <div className="card__head">
            <h2 id="h-urgent" className="card__title">דחוף עכשיו</h2>
            {urgent.length > 0 && <span className="pill pill--alert"><Ltr>{urgent.length}</Ltr></span>}
          </div>
          {urgent.length === 0 ? (
            <p className="calm"><CircleCheckBig size={18} aria-hidden="true" /> אין כרגע שום דבר דחוף</p>
          ) : (
            <ul className="urgent">
              <AnimatePresence initial={false}>
                {urgent.map((o) => (
                  <motion.li key={o.id} layout={!reduce}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.24 } }}
                    className={`urgent__row urgent__row--${o.health}`}>
                    <button className="urgent__main" onClick={(e) => panel.open(o.id, e.currentTarget)}>
                      <span className="urgent__issue">{o.issues[0].label}</span>
                      <span className="urgent__meta">{o.customerName} · {o.date === today ? 'היום' : o.date === tomorrow ? 'מחר' : <Ltr>{fmtDate(o.date)}</Ltr>} <Ltr>{o.time}</Ltr> · {o.branchName}</span>
                    </button>
                    <FixButton key={o.issues[0].rule} o={o} issue={o.issues[0]} onOpen={() => panel.open(o.id)} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>

        {/* ---------- ציר הזמנות היום ---------- */}
        <section className="card" aria-labelledby="h-timeline">
          <div className="card__head">
            <h2 id="h-timeline" className="card__title">ציר הזמנות היום</h2>
            <span className="muted"><Ltr>{todays.length}</Ltr> הזמנות</span>
          </div>
          {todays.length === 0 ? <p className="calm">אין הזמנות להיום</p> : (
            <ol className="tl">
              {todays.map((o, i) => (
                <TimelineRow key={o.id} o={o} isNowBefore={i === nowIdx} now={now} onOpen={(el) => panel.open(o.id, el)}
                  status={<StatusMenu status={o.status} onChange={(s) => update(o.id, { status: s }, <>סטטוס: {STATUS_LABEL[s]} · הזמנה <Ltr>{o.id}</Ltr></>)} />} />
              ))}
              {nowIdx === -1 && <NowLine now={now} />}
            </ol>
          )}
        </section>
      </div>

      {/* ---------- שורת מידע ---------- */}
      <section className="info" aria-label="סיכום">
        <button className="info__item" onClick={() => nav('/orders?tab=tomorrow')}><CalendarClock size={18} aria-hidden="true" /> מחר <b><Ltr>{open.filter((o) => o.date === tomorrow).length}</Ltr></b> הזמנות</button>
        <button className="info__item" onClick={() => nav('/orders?tab=future&range=7')}><CalendarDays size={18} aria-hidden="true" /> <Ltr>7</Ltr> ימים קרובים <b><Ltr>{open.filter((o) => o.date > today && o.date <= week).length}</Ltr></b></button>
        <span className="info__item"><Wallet size={18} aria-hidden="true" /> סך החודש <b><Ltr>{fmtMoney(monthTotal)}</Ltr></b></span>
      </section>
    </div>
  );
}

function NowLine({ now }: { now: Date }) {
  return <li className="tl__now" aria-label="עכשיו"><span>עכשיו <Ltr>{`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`}</Ltr></span></li>;
}

function TimelineRow({ o, isNowBefore, now, onOpen, status }: { o: OrderView; isNowBefore: boolean; now: Date; onOpen: (el: HTMLElement) => void; status: ReactNode }) {
  const past = orderDateTime(o) <= now;
  return (
    <>
      {isNowBefore && <NowLine now={now} />}
      <li className={`tl__row ${past ? 'is-past' : ''} ${CLOSED.includes(o.status) ? 'is-closed' : ''}`}>
        <span className="tl__time"><Ltr>{o.time}</Ltr></span>
        <button className="tl__main" onClick={(e) => onOpen(e.currentTarget)}>
          <span className="tl__cust">{o.customerName}</span>
          <span className="tl__meta">{o.branchName} · <Money value={o.amount} /></span>
        </button>
        <HealthBadge health={o.health} issues={o.issues} compact />
        {status}
        <span className="tl__marks"><OrderMarks o={o} /></span>
      </li>
    </>
  );
}
