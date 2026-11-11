import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useMatch } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import { motion, useReducedMotion } from 'motion/react';
import {
  FileText, Target, ChartColumn, Ellipsis, ClipboardList, House, LogOut, PanelRightClose, PanelRightOpen, Palette, Plus, Search, Settings, Store, Tags, TriangleAlert, Users,
  Truck,
  LayoutDashboard,
} from 'lucide-react';
import { Button, Tip, useHotkey } from '../design/components';
import { useStore } from '../data/store';
import { useAuth } from '../auth/AuthContext';
import { openTaskCount, todayTaskCounts } from '../features/today/todayTasks';
import { usePendingRequests } from '../auth/usePendingRequests';
import { ROLE_LABEL } from '../auth/types';
import { Ltr } from '../lib/format';
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

/* בטלפון: לצפייה ולמעקב – היום, הזמנות, בורד, חריגים. כל השאר תחת "עוד" */
const MOBILE_MAIN = ['/today', '/orders', '/board', '/exceptions'];

type NavDef = { to: string; label: string; short?: string; icon: ReactNode; count?: number; alert?: boolean };

export function AppShell({ children }: { children: ReactNode }) {
  const { orders, now, openNewOrder, closeNewOrder, dueTasks, quoteFollowups } = useStore();
  const panel = usePanel();
  const location = useLocation();
  const reduce = useReducedMotion();
  const [collapsed, setCollapsed] = usePref('sidebarCollapsed', false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { profile, isAdmin, logout } = useAuth();
  const pendingUsers = usePendingRequests();
  const firstName = (profile?.name ?? '').split(' ')[0];

  useHotkey('/', () => setSearchOpen(true));
  useHotkey('n', () => newOrder());

  /* אין פעמון: מסך "היום" הוא המקום שמראה מה לעשות. המספרים בתפריט = המספר הראשי של המסך.
     אדום בתפריט רק לקטגוריה שיש בה משהו קריטי שלא טופל: חריגות (אדום) והצעות מחיר שלא חזרו אליהן */
  const dueLeadSteps = dueTasks.filter((t) => t.leadId).length;
  const todayCount = openTaskCount(todayTaskCounts(orders, now, { dueTasks: dueTasks.length, quoteFollowups: quoteFollowups.length, pendingUsers: isAdmin ? pendingUsers : 0 }));
  const redCount = orders.reduce((n, o) => n + o.issues.filter((i) => i.severity === 'red').length, 0);

  function newOrder() {
    openNewOrder();
  }

  const groups: { title: string; items: NavDef[] }[] = [
    {
      title: 'עבודה יומית',
      items: [
        { to: '/today', label: 'היום', icon: <House size={20} />, count: todayCount },
        { to: '/orders', label: 'הזמנות', icon: <ClipboardList size={20} /> },
        { to: '/board', label: 'בורד', icon: <LayoutDashboard size={20} /> },
        { to: '/quotes', label: 'הצעות מחיר', icon: <FileText size={20} />, count: quoteFollowups.length, alert: quoteFollowups.length > 0 },
        { to: '/ops', label: 'סיכום לתפעול', icon: <Truck size={20} /> },
        { to: '/exceptions', label: 'חריגים ומשימות', short: 'חריגים', icon: <TriangleAlert size={20} />, count: redCount, alert: redCount > 0 },
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
        ...(isAdmin ? [{ to: '/settings', label: 'הגדרות', icon: <Settings size={20} />, count: pendingUsers }] : []),
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
          <Search size={16} aria-hidden="true" />
          <span className="search-trigger__full">חיפוש: הזמנה, לקוח, מס' Q, ח.פ, טלפון…</span>
          <span className="search-trigger__short" aria-hidden="true">חיפוש הזמנה או לקוח</span>
          <kbd className="kbd">/</kbd>
        </button>

        <div className="topbar__actions">
          <Button variant="primary" icon={<Plus size={16} />} kbd="N" onClick={newOrder}>הזמנה חדשה</Button>

          <div className="user">
            <span className="user__avatar" aria-hidden="true">{firstName[0] ?? '?'}</span>
            <span className="user__id">
              <span className="user__name">{profile?.name}</span>
              <span className="user__role">{profile ? ROLE_LABEL[profile.role] : ''}</span>
            </span>
            <Button variant="ghost" size="sm" icon={<LogOut size={16} />} onClick={() => logout()}>התנתק</Button>
          </div>

          {/* טלפון: האות הראשונה של השם פותחת תפריט משתמש – ההתנתקות בפנים, לא ליד הפעמון */}
          <Popover.Root>
            <Popover.Trigger asChild>
              <button className="user-m" aria-label={`${profile?.name ?? 'משתמש'} – תפריט משתמש`}>{firstName[0] ?? '?'}</button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content className="menu user-m__menu" align="end" sideOffset={8} dir="rtl" aria-label="תפריט משתמש">
                <div className="user-m__id">
                  <b>{profile?.name}</b>
                  <span>{profile ? ROLE_LABEL[profile.role] : ''}</span>
                </div>
                <button className="menu__item" onClick={() => logout()}><LogOut size={16} aria-hidden="true" /> התנתק</button>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
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
                    <NavItem to={it.to} label={it.count ? `${it.label} · ${it.count}` : it.label} collapsed={collapsed}>
                      <span className="nav__icon" aria-hidden="true">{it.icon}</span>
                      {/* בתפריט התחתון של הטלפון מוצג שם קצר; השם המלא נשאר לקורא מסך */}
                      <span className="nav__label"><span className={it.short ? "nav__full" : undefined}>{it.label}</span>{it.short && <span className="nav__short" aria-hidden="true">{it.short}</span>}</span>
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
          {import.meta.env.DEV && (
            <NavItem to="/styleguide" label="מדריך סגנון" collapsed={collapsed} quiet>
              <span className="nav__icon" aria-hidden="true"><Palette size={20} /></span>
              <span className="nav__label">מדריך סגנון</span>
            </NavItem>
          )}
          <button className="nav nav--quiet" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed} aria-label={collapsed ? 'הרחב תפריט' : 'קפל תפריט'}>
            <span className="nav__icon" aria-hidden="true">{collapsed ? <PanelRightOpen size={20} /> : <PanelRightClose size={20} />}</span>
            <span className="nav__label">קפל תפריט</span>
          </button>
        </div>
      </nav>

      <main id="main" className="content" tabIndex={-1}>
        {/* מעבר מסך בלי המתנה: המסך החדש מופיע מיד, בדהייה קצרה (בלי יציאה של הישן) */}
        <motion.div
          key={location.pathname}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
        >
          <ScreenBoundary resetKey={location.pathname}>{children}</ScreenBoundary>
        </motion.div>
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

