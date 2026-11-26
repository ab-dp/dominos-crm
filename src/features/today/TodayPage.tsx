/* מסך "היום" (אפיון 6.1): הזמנות היום כתור הקלדה ל-Q (TodayQueue), ולידן המשימות הפתוחות – רק מה שעוד דורש טיפול. משימה שהושלמה יורדת מהמסך. */
import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { UserPlus, ChevronLeft, CircleCheckBig, OctagonAlert, PackageCheck, Send, ListChecks, ClipboardX, Download, Scale } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { usePendingRequests } from '../../auth/usePendingRequests';
import { useStore } from '../../data/store';
import { itemsText, methodText } from '../../data/types';
import { Button, Skeleton } from '../../design/components';
import { NOW_ORDER, redTasks, todayTaskCounts, type TaskKey } from './todayTasks';
import { usePref } from '../../lib/prefs';
import { Ltr, addDays, fmtDate, toISODate, weekday } from '../../lib/format';
import { TodayQueue } from './TodayQueue';
import { mineOnly, todayLanes } from './qQueue';
import { downloadCsv } from '../../lib/csv';
import { PAYMENT_LABEL, STAGE_LABEL, STATUS_LABEL } from '../../data/types';
import { fmtPhone } from '../../lib/format';
import '../pages.css';
import './TodayPage.css';


export function TodayPage() {
  const { orders, now, dueTasks, loading, error } = useStore();
  const reduce = useReducedMotion();
  // 'כולם / שלי' נשמר לכל משתמש, ומשותף ל'היום' ול'משימות וחריגים'
  const [mine, setMine] = usePref('scope:mine', false);
  const { profile, isAdmin } = useAuth();
  const pendingUsers = usePendingRequests();

  const today = toISODate(now);
  const tomorrow = toISODate(addDays(now, 1));
  const scope = mine ? mineOnly(orders, profile) : orders;

  /* משימות לפי ציר ההזמנה: Q ← סגירה. מופיעה רק משימה שיש בה מה לעשות.
     הספירה משותפת לתפריט (todayTasks.ts) – המספר ליד "היום" הוא בדיוק מספר המשימות כאן */
  // הזמנות של היום שבהמתנה – נספרות ב'להקליד ל-Q' (הן עוד לא ירדו), ומצוינות בנפרד
  const held = scope.filter((o) => o.date === today && !o.qNumber && !!o.hold && o.status !== 'cancelled').length;
  // חזרות להצעות מחיר לא במסך היום (החלטה 26.11) – מסומנות בכרטיסיית הצעות המחיר
  const c = todayTaskCounts(scope, now, { dueTasks: dueTasks.length, quoteFollowups: 0, pendingUsers: isAdmin ? pendingUsers : 0 });
  const red = redTasks(scope, c);
  const tasks: { key: TaskKey; title: string; sub?: string; icon: ReactNode; count: number; to: string; unit: [string, string] }[] = [
    { key: 'urgent', title: 'חריגות', sub: 'חיוב שנכשל, ביטול שלא בוצע ב-Q', icon: <OctagonAlert size={20} />, count: c.urgent, to: '/exceptions', unit: ['הזמנה', 'הזמנות'] },
    { key: 'yesterday', title: 'לסגור הזמנות שמועדן עבר', sub: 'סופקה / חלקית / באיחור', icon: <PackageCheck size={20} />, count: c.yesterday, to: '/orders?tab=overdue', unit: ['הזמנה', 'הזמנות'] },
    { key: 'q', title: 'להקליד ל-Q', sub: held ? `הזמנות של היום · מתוכן ${held} בהמתנה` : 'הזמנות של היום', icon: <Send size={20} />, count: c.q, to: '/orders?tab=today&filter=q', unit: ['הזמנה', 'הזמנות'] },
    { key: 'other', title: 'לבדוק מול הקופה', sub: 'פער מול Q, אשראי שלא חויב, שינוי שלא עודכן', icon: <Scale size={20} />, count: c.other, to: '/exceptions', unit: ['הזמנה', 'הזמנות'] },
    { key: 'missing', title: 'להשלים פרטים חסרים', icon: <ClipboardX size={20} />, count: c.missing, to: '/exceptions?rule=8', unit: ['הזמנה', 'הזמנות'] },
    { key: 'followups', title: 'משימות מעקב להיום', icon: <ListChecks size={20} />, count: c.followups, to: '/exceptions', unit: ['משימה', 'משימות'] },
    { key: 'users', title: 'בקשות הצטרפות לאישור', icon: <UserPlus size={20} />, count: c.users, to: '/settings/users', unit: ['בקשה', 'בקשות'] },
  ];
  /* שתי קבוצות לפי דחיפות: 'עכשיו' – מה שקריטי (באדום, בסדר קבוע), ו'בהמשך היום' – לפי סדר הציר */
  const open = tasks.filter((t) => t.count > 0);
  const nowTasks = NOW_ORDER.map((k) => open.find((t) => t.key === k && red.has(k))).filter((t): t is (typeof tasks)[number] => !!t);
  const laterTasks = open.filter((t) => !red.has(t.key));
  const openCount = open.length;

  const lanes = todayLanes(scope, today, now);
  const todayCount = lanes.todo.length + lanes.hold.length + lanes.inq.length + lanes.closed.length;

  /* "הורד היום ומחר" (אפיון 16): כל הזמנות היום ומחר לאקסל – לעבודה גם אם המערכת לא זמינה. תמיד של כולם, לא רק "שלי". */
  const downloadTodayTomorrow = () => {
    const list = orders.filter((o) => (o.date === today || o.date === tomorrow) && o.status !== 'cancelled')
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    downloadCsv(`הזמנות היום ומחר ${fmtDate(today)}.csv`, [
      ['תאריך', 'שעה', 'הזמנה', 'לקוח', 'סניף', 'טלפון סניף', 'סטטוס', "מס' Q", 'סכום', 'אמצעי תשלום', 'טלפון הקפה', 'מצב תשלום', 'משלוח/איסוף', 'כתובת', 'איש קשר', 'טלפון', 'תכולה', 'הנחיות'],
      ...list.map((o) => [fmtDate(o.date), o.time, o.id, o.customerName, o.branchName, o.branchPhone ? fmtPhone(o.branchPhone) : '', o.qNumber ? STAGE_LABEL.in_q : STATUS_LABEL[o.status],
        o.qNumber ?? '', o.qAmount ?? o.amount, methodText(o), o.accountPhone ? fmtPhone(o.accountPhone) : '', PAYMENT_LABEL[o.payment],
        o.delivery === 'delivery' ? 'משלוח' : 'איסוף', o.address ?? '', o.contactName ?? '', o.contactPhone ? fmtPhone(o.contactPhone) : '',
        o.items.length ? itemsText(o.items) + (o.contents ? ` · ${o.contents}` : '') : o.contents ?? '', o.instructions ?? '']),
    ]);
  };

  return (
    <div className="page today">
      <header className="page__head">
        <div>
          <h1 className="page__title">היום</h1>
          <p className="page__sub" aria-live="polite">
            יום {weekday(today)} <Ltr>{fmtDate(today)}</Ltr> <span aria-hidden="true">·</span>{' '}
            {loading ? '…' : <>{openCount ? <><Ltr>{openCount}</Ltr> {openCount === 1 ? 'משימה פתוחה' : 'משימות פתוחות'}</> : 'אין משימות פתוחות'} <span aria-hidden="true">·</span> <Ltr>{todayCount}</Ltr> הזמנות היום</>}
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
        {/* ---------- הזמנות היום: תור ההקלדה ל-Q ---------- */}
        <TodayQueue lanes={lanes} loading={loading} now={now} />

        {/* ---------- משימות פתוחות: רק מה שעוד דורש טיפול. משימה שהושלמה יורדת מהרשימה ---------- */}
        <section className="card" aria-labelledby="h-tasks">
          <div className="card__head">
            <h2 id="h-tasks" className="card__title">משימות פתוחות</h2>
            {openCount > 0 && <span className="pill"><Ltr>{openCount}</Ltr></span>}
          </div>
          {loading ? <div className="loading-rows" aria-busy="true" aria-label="טוען">{[0, 1, 2].map((i) => <Skeleton key={i} h={44} />)}</div>
            : error ? <p className="calm calm--error" role="alert"><OctagonAlert size={16} aria-hidden="true" /> ההזמנות לא נטענו, ולכן המשימות לא ידועות. בדוק חיבור ורענן את הדף.</p>
            : openCount === 0 ? <p className="calm"><CircleCheckBig size={16} aria-hidden="true" /> אין משימות פתוחות</p>
            : (
              <>
                {/* 'עכשיו' מופיע תמיד, גם ריק – אחמ"ש רואה במבט אם יש משהו דחוף */}
                <TaskGroup id="now" title="עכשיו" tone="red" tasks={nowTasks} red={red} reduce={!!reduce}
                  empty={<p className="otasks__none"><CircleCheckBig size={16} aria-hidden="true" /> אין דבר דחוף</p>} />
                {laterTasks.length > 0 && <TaskGroup id="later" title="בהמשך היום" tone="muted" tasks={laterTasks} red={red} reduce={!!reduce} />}
              </>
            )}
        </section>

      </div>
    </div>
  );
}

type TaskItem = { key: TaskKey; title: string; sub?: string; icon: ReactNode; count: number; to: string; unit: [string, string] };

/* קבוצת משימות: כותרת עם נקודה בצבע הקבוצה, ושורה-קישור לכל משימה (אפשר לפתוח בלשונית חדשה) */
function TaskGroup({ id, title, tone, tasks, red, reduce, empty }: { id: string; title: string; tone: 'red' | 'muted'; tasks: TaskItem[]; red: Set<TaskKey>; reduce: boolean; empty?: ReactNode }) {
  return (
    <div className="otasks__group" role="group" aria-labelledby={`tg-${id}`}>
      <p id={`tg-${id}`} className={`otasks__label otasks__label--${tone}`}>{title}{tasks.length > 0 && <> <Ltr>{tasks.length}</Ltr></>}</p>
      {tasks.length === 0 ? empty : (
        <ul className="otasks">
          <AnimatePresence initial={false}>
            {tasks.map((t) => (
              <motion.li key={t.key} layout={!reduce} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.2 } }}>
                <Link to={t.to} className={`task ${red.has(t.key) ? 'task--red' : ''}`}
                  aria-label={`${t.title}: ${t.count === 1 ? `${t.unit[0]} אחת` : `${t.count} ${t.unit[1]}`}${t.sub ? `. ${t.sub}` : ''}`}>
                  <span className="task__icon" aria-hidden="true">{t.icon}</span>
                  <span className="task__text" aria-hidden="true">
                    <span className="task__title">{t.title}</span>
                    {t.sub && <span className="task__sub">{t.sub}</span>}
                  </span>
                  <span className="task__count" aria-hidden="true"><Ltr>{t.count}</Ltr></span>
                  <ChevronLeft className="task__go" size={16} aria-hidden="true" />
                </Link>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
