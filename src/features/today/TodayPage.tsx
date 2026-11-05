/* מסך "היום" (אפיון 6.1): רק מה שעוד דורש טיפול – משימות פתוחות, ולידן ציר הזמנות היום. משימה שהושלמה יורדת מהמסך. */
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { UserPlus, UserCheck, BellRing, ChevronLeft, CircleCheckBig, TriangleAlert, PackageCheck, Send, Store, ListChecks, ClipboardX, Download, FileText } from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { useAuth } from '../../auth/AuthContext';
import { usePendingRequests } from '../../auth/usePendingRequests';
import { useStore, type OrderView } from '../../data/store';
import { CLOSED, itemsText } from '../../data/types';
import { Button, HealthBadge, Missing, Skeleton } from '../../design/components';
import { missingOf, orderDateTime } from '../../rules-engine/health';
import { Ltr, Money, fmtDate, toISODate, weekday } from '../../lib/format';
import { NextStep, StageTrack } from '../orders/OrderTimeline';
import { downloadCsv } from '../../lib/csv';
import { PAYMENT_LABEL, STATUS_LABEL } from '../../data/types';
import { fmtPhone } from '../../lib/format';
import '../pages.css';
import './TodayPage.css';

// כללים שיש להם משימה משלה ברשימה
const COVERED = [6, 4, 0, 1, 12, 8];

export function TodayPage() {
  const { orders, now, dueTasks, loading, quoteFollowups } = useStore();
  const panel = usePanel();
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const [mine, setMine] = useState(false);
  const { profile, isAdmin } = useAuth();
  const pendingUsers = usePendingRequests();
  const firstName = (profile?.name ?? '').split(' ')[0];

  const today = toISODate(now);
  const tomorrow = toISODate(new Date(now.getTime() + 86400000));
  const scope = mine ? orders.filter((o) => (o.handlerUid ? o.handlerUid === profile?.uid : o.handler === profile?.name)) : orders;
  const open = scope.filter((o) => !CLOSED.includes(o.status));

  /* משימות לפי ציר ההזמנה: לקוח ← תפעול ← Q ← קבוצת תפעול ← סגירה. מופיעה רק משימה שיש בה מה לעשות */
  const tasks: { key: string; title: string; sub?: string; icon: ReactNode; count: number; to: string; red?: boolean }[] = [
    { key: 'customer', title: 'לאשר מול הלקוח', sub: 'הזמנות של היום ומחר', icon: <UserCheck size={20} />, count: open.filter((o) => (o.date === today || o.date === tomorrow) && (o.status === 'new' || o.status === 'pending_customer')).length, to: '/exceptions?rule=6', red: true },
    { key: 'branch', title: 'לעדכן בתפעול', sub: 'הזמנות של היום ומחר', icon: <Store size={20} />, count: open.filter((o) => (o.date === today || o.date === tomorrow) && !o.branchApproval).length, to: '/orders?tab=today&filter=branch' },
    { key: 'q', title: 'להקליד ל-Q', sub: 'הזמנות של היום', icon: <Send size={20} />, count: open.filter((o) => o.date === today && !o.qNumber).length, to: '/orders?tab=today&filter=q' },
    { key: 'ops', title: 'לשלוח בקבוצת תפעול', sub: 'הוקלדו ל-Q ועוד לא נשלחו', icon: <BellRing size={20} />, count: open.filter((o) => !!o.qNumber && o.opsNotified === false).length, to: '/exceptions?rule=12' },
    { key: 'yesterday', title: 'לסגור הזמנות שעברו', sub: 'סופקה / חלקית / באיחור', icon: <PackageCheck size={20} />, count: open.filter((o) => o.date < today).length, to: '/orders?tab=overdue', red: true },
    // חריגים אדומים שאין להם משימה משלה למעלה (אשראי שלא חויב, פער מול Q, שעה שעברה היום, שינוי לעדכן ב-Q)
    { key: 'urgent', title: 'חריגים דחופים', sub: 'במסך חריגים ומשימות', icon: <TriangleAlert size={20} />, count: open.filter((o) => o.health === 'critical' && !COVERED.includes(o.issues[0]?.rule)).length, to: '/exceptions', red: true },
    { key: 'missing', title: 'להשלים פרטים חסרים', icon: <ClipboardX size={20} />, count: open.filter((o) => missingOf(o).length > 0).length, to: '/exceptions?rule=8' },
    { key: 'quotes', title: 'לחזור על הצעות מחיר', sub: 'אין עדכון מהלקוח', icon: <FileText size={20} />, count: quoteFollowups.length, to: '/quotes?tab=waiting' },
    { key: 'followups', title: 'משימות מעקב להיום', icon: <ListChecks size={20} />, count: dueTasks.length, to: '/exceptions' },
    { key: 'users', title: 'בקשות הצטרפות לאישור', icon: <UserPlus size={20} />, count: isAdmin ? pendingUsers : 0, to: '/settings/users' },
  ];
  const openTasks = tasks.filter((t) => t.count > 0);

  const todays = scope.filter((o) => o.date === today && o.status !== 'cancelled').sort((a, b) => a.time.localeCompare(b.time));
  const nowIdx = todays.findIndex((o) => orderDateTime(o) > now);
  const nextUp = todays.find((o) => orderDateTime(o) > now && !CLOSED.includes(o.status));
  const hour = now.getHours();
  const greeting = hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : 'ערב טוב';

  /* "הורד היום ומחר" (אפיון 16): כל הזמנות היום ומחר לאקסל – לעבודה גם אם המערכת לא זמינה. תמיד של כולם, לא רק "שלי". */
  const downloadTodayTomorrow = () => {
    const list = orders.filter((o) => (o.date === today || o.date === tomorrow) && o.status !== 'cancelled')
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    downloadCsv(`הזמנות היום ומחר ${fmtDate(today)}.csv`, [
      ['תאריך', 'שעה', 'הזמנה', 'לקוח', 'סניף', 'טלפון סניף', 'סטטוס', 'עודכן בתפעול', "מס' Q", 'סכום', 'אמצעי תשלום', 'טלפון הקפה', 'מצב תשלום', 'משלוח/איסוף', 'כתובת', 'איש קשר', 'טלפון', 'תכולה', 'הנחיות'],
      ...list.map((o) => [fmtDate(o.date), o.time, o.id, o.customerName, o.branchName, o.branchPhone ? fmtPhone(o.branchPhone) : '', STATUS_LABEL[o.status],
        o.branchApproval ? o.branchApproval.manager || 'כן' : '', o.qNumber ?? '', o.qAmount ?? o.amount, o.methodLabel ?? o.method, o.accountPhone ? fmtPhone(o.accountPhone) : '', PAYMENT_LABEL[o.payment],
        o.delivery === 'delivery' ? 'משלוח' : 'איסוף', o.address ?? '', o.contactName ?? '', o.contactPhone ? fmtPhone(o.contactPhone) : '',
        o.items.length ? itemsText(o.items) + (o.contents ? ` · ${o.contents}` : '') : o.contents ?? '', o.instructions ?? '']),
    ]);
  };

  return (
    <div className="page today">
      <header className="page__head today__hero">
        <div>
          <p className="today__date">יום {weekday(today)} · <Ltr>{fmtDate(today)}</Ltr></p>
          <h1 className="page__title">{greeting}{firstName && <>, {firstName}</>}</h1>
          <p className="today__summary" aria-live="polite">
            {loading ? '…' : openTasks.length
              ? <><b><Ltr>{openTasks.length}</Ltr> {openTasks.length === 1 ? 'משימה פתוחה' : 'משימות פתוחות'}</b> <span aria-hidden="true">·</span> <Ltr>{todays.length}</Ltr> הזמנות היום</>
              : <>אין משימות פתוחות <span aria-hidden="true">·</span> <Ltr>{todays.length}</Ltr> הזמנות היום</>}
          </p>
        </div>
        <div className="page__head-end">
          <div className="seg" role="group" aria-label="הזמנות של">
            <button className={!mine ? 'is-on' : ''} aria-pressed={!mine} onClick={() => setMine(false)}>כולם</button>
            <button className={mine ? 'is-on' : ''} aria-pressed={mine} onClick={() => setMine(true)}>שלי</button>
          </div>
          <Button variant="secondary" icon={<Download size={16} />} onClick={downloadTodayTomorrow} title="קובץ אקסל לגיבוי – לעבודה גם אם המערכת לא זמינה">הורד היום ומחר</Button>
        </div>
      </header>

      <div className="today__grid">
        {/* ---------- משימות פתוחות: רק מה שעוד דורש טיפול. משימה שהושלמה יורדת מהרשימה ---------- */}
        <section className="card" aria-labelledby="h-tasks">
          <div className="card__head">
            <h2 id="h-tasks" className="card__title">משימות פתוחות</h2>
            {openTasks.length > 0 && <span className="pill pill--alert"><Ltr>{openTasks.length}</Ltr></span>}
          </div>
          {loading ? <div className="loading-rows" aria-busy="true" aria-label="טוען">{[0, 1, 2].map((i) => <Skeleton key={i} h={44} />)}</div> : openTasks.length === 0 ? (
            <p className="calm"><CircleCheckBig size={18} aria-hidden="true" /> אין משימות פתוחות</p>
          ) : (
            <ul className="otasks">
              <AnimatePresence initial={false}>
                {openTasks.map((t) => (
                  <motion.li key={t.key} layout={!reduce} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.2 } }}>
                    <button className={`task ${t.red ? 'task--red' : ''}`} onClick={() => nav(t.to)}>
                      <span className="task__icon" aria-hidden="true">{t.icon}</span>
                      <span className="task__text">
                        <span className="task__title">{t.title}</span>
                        {t.sub && <span className="task__sub">{t.sub}</span>}
                      </span>
                      <span className="task__count"><Ltr>{t.count}</Ltr></span>
                      <ChevronLeft className="task__go" size={18} aria-hidden="true" />
                    </button>
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
          {loading ? <div className="loading-rows" aria-busy="true" aria-label="טוען">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={34} />)}</div> : todays.length === 0 ? <p className="calm calm--quiet">אין הזמנות להיום</p> : (
            <ol className="tl">
              {todays.map((o, i) => (
                <TimelineRow key={o.id} o={o} isNowBefore={i === nowIdx} isNext={o.id === nextUp?.id} now={now} onOpen={(el) => panel.open(o.id, el)}
                  status={<StageTrack o={o} />} />
              ))}
              {nowIdx === -1 && <NowLine now={now} />}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

function NowLine({ now }: { now: Date }) {
  return <li className="tl__now" aria-label="עכשיו"><span>עכשיו <Ltr>{`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`}</Ltr></span></li>;
}

function TimelineRow({ o, isNowBefore, isNext, now, onOpen, status }: { o: OrderView; isNowBefore: boolean; isNext: boolean; now: Date; onOpen: (el: HTMLElement) => void; status: ReactNode }) {
  const past = orderDateTime(o) <= now;
  const minutes = Math.round((orderDateTime(o).getTime() - now.getTime()) / 60000);
  return (
    <>
      {isNowBefore && <NowLine now={now} />}
      <li className={`tl__row ${past ? 'is-past' : ''} ${isNext ? 'is-next' : ''} ${CLOSED.includes(o.status) ? 'is-closed' : ''}`}>
        <span className="tl__time">{o.time ? <Ltr>{o.time}</Ltr> : <Missing>שעה?</Missing>}</span>
        <button className="tl__main" onClick={(e) => onOpen(e.currentTarget)}>
          <span className="tl__cust" title={o.customerName}>
            {o.customerName}
            {isNext && <span className="tl__next">הבאה בתור · בעוד <Ltr>{minutes >= 60 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}` : `${minutes}`}</Ltr> {minutes >= 60 ? 'שעות' : 'דק\''}</span>}
          </span>
          <span className="tl__meta">{o.branchName || <Missing>ללא סניף</Missing>} · <Money value={o.amount} /></span>
        </button>
        <HealthBadge health={o.health} issues={o.issues} compact />
        {status}
        <span className="tl__marks"><NextStep o={o} /></span>
      </li>
    </>
  );
}
