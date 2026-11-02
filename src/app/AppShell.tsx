import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useMatch, useNavigate } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Bell, CalendarClock, Target, ChartColumn, Ellipsis, UserPlus, ClipboardList, House, LogOut, PanelRightClose, PanelRightOpen, Palette, Plus, Search, Settings, Store, Tags, TriangleAlert, Users,
} from 'lucide-react';
import { Button, Tip, useHotkey } from '../design/components';
import { useStore } from '../data/store';
import { useAuth } from '../auth/AuthContext';
import { usePendingRequests } from '../auth/usePendingRequests';
import { ROLE_LABEL } from '../auth/types';
import { Ltr, fmtDate } from '../lib/format';
import { isAlert } from '../rules-engine/health';
import { useToast } from '../design/Toast';
import type { OrderView } from '../data/store';
import { usePref } from '../lib/prefs';
import { CommandSearch } from './CommandSearch';
import { usePanel } from './PanelContext';
import { ScreenBoundary } from './ErrorBoundary';
import { OrderPanel } from '../features/orders/OrderPanel';
import { NewOrderDialog } from '../features/orders/NewOrder';
import { StatusDialogs } from '../features/orders/StatusDialogs';
import { ConflictDialog } from '../features/orders/ConflictDialog';
import { ChangeDialog } from '../features/orders/ChangeDialog';
import { LockFixDialog } from '../features/orders/LockFixDialog';
import './AppShell.css';

const BASE = import.meta.env.BASE_URL;

const MOBILE_MAIN = ['/today', '/orders', '/exceptions', '/customers'];

type NavDef = { to: string; label: string; icon: ReactNode; count?: number; alert?: boolean };

export function AppShell({ children }: { children: ReactNode }) {
  const { orders, openNewOrder, closeNewOrder, dueTasks } = useStore();
  const panel = usePanel();
  const location = useLocation();
  const reduce = useReducedMotion();
  const [collapsed, setCollapsed] = usePref('sidebarCollapsed', false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { profile, isAdmin, logout } = useAuth();
  const pendingUsers = usePendingRequests();
  const nav = useNavigate();
  const firstName = (profile?.name ?? '').split(' ')[0];

  useHotkey('/', () => setSearchOpen(true));
  useHotkey('n', () => newOrder());

  // בפעמון: רק חריגות שדורשות טיפול עכשיו (פרט חסר בהזמנה רחוקה אדום, אבל לא קופץ עד שמתקרב)
  const critical = orders.filter((o) => o.issues.some(isAlert));
  useApproachingAlert(orders);
  const dueLeadSteps = dueTasks.filter((t) => t.leadId).length;
  const urgentCount = orders.filter((o) => o.health === 'critical' || o.health === 'urgent').length;

  function newOrder() {
    openNewOrder();
  }

  const groups: { title: string; items: NavDef[] }[] = [
    {
      title: 'עבודה יומית',
      items: [
        { to: '/today', label: 'היום', icon: <House size={20} />, count: urgentCount, alert: critical.length > 0 },
        { to: '/orders', label: 'הזמנות', icon: <ClipboardList size={20} /> },
        { to: '/exceptions', label: 'חריגים ומשימות', icon: <TriangleAlert size={20} />, count: urgentCount + dueTasks.length, alert: critical.length > 0 },
      ],
    },
    {
      title: 'מאגרים',
      items: [
        { to: '/customers', label: 'לקוחות', icon: <Users size={20} /> },
        { to: '/leads', label: 'לקוחות פוטנציאליים', icon: <Target size={20} />, count: dueLeadSteps },
        { to: '/pricelists', label: 'מחירונים', icon: <Tags size={20} /> },
        { to: '/branches', label: 'סניפים ואשכולות', icon: <Store size={20} /> },
      ],
    },
    {
      title: 'ניהול',
      items: [
        { to: '/reports', label: 'דוחות', icon: <ChartColumn size={20} /> },
        ...(isAdmin ? [{ to: '/settings', label: 'הגדרות', icon: <Settings size={20} />, count: pendingUsers, alert: pendingUsers > 0 }] : []),
      ],
    },
  ];

  // מעבר מסך (גם בכפתור "חזרה" של הדפדפן) סוגר תיק הזמנה, טופס הזמנה ותפריט "עוד" פתוחים
  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) { firstPath.current = false; return; }
    if (panel.openId != null) panel.close();
    closeNewOrder();
    setMoreOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const moreItems = groups.flatMap((g) => g.items).filter((it) => !MOBILE_MAIN.includes(it.to));

  return (
    <div className={`shell ${collapsed ? 'shell--collapsed' : ''}`}>
      <a href="#main" className="skip">דלג לתוכן</a>

      <header className="topbar">
        <Link to="/today" className="topbar__logo" aria-label="Domino's CRM – חזרה למסך היום">
          <img src={`${BASE}logo-tile.svg`} alt="" />
        </Link>
        <button className="search-trigger" onClick={() => setSearchOpen(true)} aria-label="חיפוש: הזמנה, לקוח, מס' Q, ח.פ, טלפון (/)">
          <Search size={18} aria-hidden="true" />
          <span>חיפוש: הזמנה, לקוח, מס' Q, ח.פ, טלפון…</span>
          <kbd className="kbd">/</kbd>
        </button>

        <div className="topbar__actions">
          <Button variant="primary" icon={<Plus size={18} />} kbd="N" onClick={newOrder}>הזמנה חדשה</Button>

          <Popover.Root>
            <Popover.Trigger asChild>
              <button className="icon-btn bell" aria-label={`התראות: ${critical.length + pendingUsers + dueTasks.length} חדשות`}>
                <Bell size={20} />
                {critical.length + pendingUsers + dueTasks.length > 0 && <span className="bell__count"><Ltr>{critical.length + pendingUsers + dueTasks.length}</Ltr></span>}
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content className="pop bell-pop" aria-label="התראות" align="end" sideOffset={8} dir="rtl">
                {pendingUsers > 0 && (
                  <button className="bell-join" onClick={() => nav('/settings/users')}>
                    <UserPlus size={18} aria-hidden="true" /> <span><b><Ltr>{pendingUsers}</Ltr></b> בקשות הצטרפות ממתינות</span>
                  </button>
                )}
                {dueTasks.length > 0 && (
                  <button className="bell-join" onClick={() => nav('/exceptions')}>
                    <CalendarClock size={18} aria-hidden="true" /> <span><b><Ltr>{dueTasks.length}</Ltr></b> משימות מעקב להיום</span>
                  </button>
                )}
                <p className="pop__title">חריגות שדורשות טיפול</p>
                {critical.length === 0 ? <p className="pop__text">אין חריגות כרגע ✓</p> : (
                  <ul className="bell-list">
                    {critical.map((o) => (
                      <li key={o.id}>
                        <button onClick={(e) => panel.open(o.id, e.currentTarget)}>
                          <span className="bell-list__issue">{(o.issues.find(isAlert) ?? o.issues[0]).label}</span>
                          <span className="bell-list__meta">{o.customerName} · <Ltr>{fmtDate(o.date)}</Ltr> {o.time && <Ltr>{o.time}</Ltr>}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          <div className="user">
            <span className="user__avatar" aria-hidden="true">{firstName[0] ?? '?'}</span>
            <span className="user__id">
              <span className="user__name">{profile?.name}</span>
              <span className="user__role">{profile ? ROLE_LABEL[profile.role] : ''}</span>
            </span>
            <Button variant="ghost" size="sm" icon={<LogOut size={16} />} onClick={() => logout()}>התנתק</Button>
          </div>
        </div>
      </header>

      <nav className="sidebar" aria-label="ניווט ראשי">
        <Link to="/today" className="sidebar__logo" aria-label="Domino's CRM – חזרה למסך היום">
          <img className="sidebar__logo-full" src={`${BASE}logo-horizontal-white.svg`} alt="" />
          <img className="sidebar__logo-tile" src={`${BASE}logo-tile.svg`} alt="" />
        </Link>
        <div className="sidebar__groups">
          {groups.map((g) => (
            <div key={g.title} className="navgroup">
              <p className="navgroup__title" aria-hidden={collapsed}>{g.title}</p>
              <ul>
                {g.items.map((it) => (
                  <li key={it.to} className={MOBILE_MAIN.includes(it.to) ? '' : 'nav-li--more'}>
                    <NavItem to={it.to} label={it.label} collapsed={collapsed}>
                      <span className="nav__icon" aria-hidden="true">{it.icon}</span>
                      <span className="nav__label">{it.label}</span>
                      {!!it.count && <span className={`nav__count ${it.alert ? 'nav__count--alert' : ''}`}><Ltr>{it.count}</Ltr></span>}
                    </NavItem>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {/* בטלפון: ארבעה יעדים עיקריים בתפריט התחתון, וכל השאר תחת "עוד" – בלי גלילה הצידה */}
          <Popover.Root open={moreOpen} onOpenChange={setMoreOpen}>
            <Popover.Trigger asChild>
              <button className={`nav nav-more ${moreItems.some((it) => location.pathname.startsWith(it.to)) ? 'is-active' : ''}`} aria-label="עוד">
                <span className="nav__icon" aria-hidden="true"><Ellipsis size={20} /></span>
                <span className="nav__label">עוד</span>
                {moreItems.some((it) => it.alert) && <span className="nav__count nav__count--alert nav__count--dot" aria-hidden="true" />}
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content className="menu more-menu" aria-label="עוד" side="top" align="end" sideOffset={10} dir="rtl">
                {moreItems.map((it) => (
                  <Link key={it.to} to={it.to} className="menu__item" onClick={() => setMoreOpen(false)}>
                    <span className="nav__icon" aria-hidden="true">{it.icon}</span>
                    <span className="more-menu__label">{it.label}</span>
                    {!!it.count && <span className={`nav__count ${it.alert ? 'nav__count--alert' : ''}`}><Ltr>{it.count}</Ltr></span>}
                  </Link>
                ))}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
        <div className="sidebar__foot">
          <NavItem to="/styleguide" label="מדריך סגנון" collapsed={collapsed} quiet>
            <span className="nav__icon" aria-hidden="true"><Palette size={20} /></span>
            <span className="nav__label">מדריך סגנון</span>
          </NavItem>
          <button className="nav nav--quiet" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed} aria-label={collapsed ? 'הרחב תפריט' : 'קפל תפריט'}>
            <span className="nav__icon" aria-hidden="true">{collapsed ? <PanelRightOpen size={20} /> : <PanelRightClose size={20} />}</span>
            <span className="nav__label">קפל תפריט</span>
          </button>
        </div>
      </nav>

      <main id="main" className="content" tabIndex={-1}>
        {/* מעבר רך בין מסכים: הופעה הדרגתית ותזוזה קטנה, בלי לעכב את העבודה */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
          >
            <ScreenBoundary resetKey={location.pathname}>{children}</ScreenBoundary>
          </motion.div>
        </AnimatePresence>
      </main>

      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} onPick={(id) => { setSearchOpen(false); panel.open(id, null); }} />
      <OrderPanel />
      <NewOrderDialog />
      <StatusDialogs />
      <ConflictDialog />
      <ChangeDialog />
      <LockFixDialog />
    </div>
  );
}

/* פריט תפריט: כשהתפריט מקופל, התווית מוצגת כ-tooltip */
function NavItem({ to, label, collapsed, quiet, children }: { to: string; label: string; collapsed: boolean; quiet?: boolean; children: ReactNode }) {
  const active = !!useMatch({ path: to, end: false });
  const link = (
    <Link to={to} className={`nav ${quiet ? 'nav--quiet' : ''} ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined} aria-label={collapsed ? label : undefined}>
      {children}
    </Link>
  );
  return collapsed ? <Tip label={label} side="left">{link}</Tip> : link;
}

/* התראה לכל המשתמשים: הזמנה שנכנסה לחלון "בקרוב" בלי פרט חובה או בלי אישור סניף/לקוח.
   כל דפדפן מחושב מאותם נתונים, כך שכולם רואים אותה; הודעה אחת לכל הזמנה בכל כניסה (sessionStorage). */
const ALERT_RULES = [8, 4, 6];
function useApproachingAlert(orders: OrderView[]) {
  const toast = useToast();
  const nav = useNavigate();
  const ids = orders.filter((o) => o.issues.some((i) => ALERT_RULES.includes(i.rule) && isAlert(i))).map((o) => String(o.id));
  const key = ids.join(',');
  useEffect(() => {
    if (!ids.length) return;
    let seen: string[] = [];
    try { seen = JSON.parse(sessionStorage.getItem('alerted') ?? '[]'); } catch { /* מצב פרטי */ }
    const fresh = ids.filter((id) => !seen.includes(id));
    if (!fresh.length) return;
    try { sessionStorage.setItem('alerted', JSON.stringify([...seen, ...fresh])); } catch { /* מצב פרטי */ }
    toast({
      message: fresh.length === 1
        ? <>הזמנה <Ltr>{fresh[0]}</Ltr> מתקרבת וחסרים בה פרטים קריטיים</>
        : <><Ltr>{fresh.length}</Ltr> הזמנות קרובות חסרות פרטים קריטיים</>,
      action: { label: 'לטיפול', run: () => nav('/exceptions') },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
