import { useState, type ReactNode } from 'react';
import { Link, useMatch } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import {
  Bell, ChartColumn, ClipboardList, House, LogOut, PanelRightClose, PanelRightOpen, Palette, Plus, Search, Settings, Store, Tags, TriangleAlert, Users,
} from 'lucide-react';
import { Button, Tip, useHotkey } from '../design/components';
import { useToast } from '../design/Toast';
import { useStore } from '../data/store';
import { ME } from '../data/mock';
import { Ltr } from '../lib/format';
import { CommandSearch } from './CommandSearch';
import { usePanel } from './PanelContext';
import { OrderPanel } from '../features/orders/OrderPanel';
import './AppShell.css';

const BASE = import.meta.env.BASE_URL;

export function AppShell({ children }: { children: ReactNode }) {
  const { orders } = useStore();
  const toast = useToast();
  const panel = usePanel();
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useHotkey('/', () => setSearchOpen(true));
  useHotkey('n', () => newOrder());

  const critical = orders.filter((o) => o.health === 'critical');
  const urgentCount = orders.filter((o) => o.health === 'critical' || o.health === 'urgent').length;

  function newOrder() {
    toast({ message: 'יצירת הזמנה (מהירה · מלאה · לקוח חדש) תיבנה בשלב 5' });
  }

  const items: { to: string; label: string; icon: ReactNode; count?: number }[] = [
    { to: '/today', label: 'היום', icon: <House size={20} />, count: urgentCount },
    { to: '/orders', label: 'הזמנות', icon: <ClipboardList size={20} /> },
    { to: '/customers', label: 'לקוחות', icon: <Users size={20} /> },
    { to: '/pricelists', label: 'מחירונים', icon: <Tags size={20} /> },
    { to: '/exceptions', label: 'חריגים ומשימות', icon: <TriangleAlert size={20} />, count: urgentCount },
    { to: '/reports', label: 'דוחות', icon: <ChartColumn size={20} /> },
    { to: '/branches', label: 'סניפים ואשכולות', icon: <Store size={20} /> },
    { to: '/settings', label: 'הגדרות', icon: <Settings size={20} /> },
  ];

  return (
    <div className={`shell ${collapsed ? 'shell--collapsed' : ''}`}>
      <a href="#main" className="skip">דלג לתוכן</a>

      <header className="topbar">
        <Link to="/today" className="topbar__logo" aria-label="Domino's CRM – חזרה למסך היום">
          <img src={`${BASE}logo-horizontal.svg`} alt="" height={30} />
        </Link>

        <button className="search-trigger" onClick={() => setSearchOpen(true)}>
          <Search size={18} aria-hidden="true" />
          <span>חיפוש: הזמנה, לקוח, מס' Q, ח.פ, טלפון…</span>
          <kbd className="kbd">/</kbd>
        </button>

        <div className="topbar__actions">
          <Button variant="primary" icon={<Plus size={18} />} kbd="N" onClick={newOrder}>הזמנה חדשה</Button>

          <Popover.Root>
            <Popover.Trigger asChild>
              <button className="icon-btn bell" aria-label={`התראות: ${critical.length} חריגות`}>
                <Bell size={20} />
                {critical.length > 0 && <span className="bell__count"><Ltr>{critical.length}</Ltr></span>}
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content className="pop bell-pop" align="end" sideOffset={8} dir="rtl">
                <p className="pop__title">חריגות שדורשות טיפול</p>
                {critical.length === 0 ? <p className="pop__text">אין חריגות כרגע ✓</p> : (
                  <ul className="bell-list">
                    {critical.map((o) => (
                      <li key={o.id}>
                        <button onClick={(e) => panel.open(o.id, e.currentTarget)}>
                          <span className="bell-list__issue">{o.issues[0].label}</span>
                          <span className="bell-list__meta">{o.customerName} · <Ltr>{o.time}</Ltr></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          <div className="user">
            <span className="user__avatar" aria-hidden="true">{ME[0]}</span>
            <span className="user__name">{ME}</span>
            <Button variant="ghost" size="sm" icon={<LogOut size={16} />} onClick={() => toast({ message: 'התחברות והתנתקות ייבנו בשלב 2' })}>התנתק</Button>
          </div>
        </div>
      </header>

      <nav className="sidebar" aria-label="ניווט ראשי">
        <ul>
          {items.map((it) => (
            <li key={it.to}>
              <NavItem to={it.to} label={it.label} collapsed={collapsed}>
                <span className="nav__icon" aria-hidden="true">{it.icon}</span>
                <span className="nav__label">{it.label}</span>
                {!!it.count && <span className="nav__count"><Ltr>{it.count}</Ltr></span>}
              </NavItem>
            </li>
          ))}
        </ul>
        <div className="sidebar__foot">
          <NavItem to="/styleguide" label="מדריך סגנון" collapsed={collapsed} quiet>
            <span className="nav__icon" aria-hidden="true"><Palette size={20} /></span>
            <span className="nav__label">מדריך סגנון</span>
          </NavItem>
          <button className="nav nav--quiet" onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed} aria-label={collapsed ? 'הרחב תפריט' : 'קפל תפריט'}>
            <span className="nav__icon" aria-hidden="true">{collapsed ? <PanelRightOpen size={20} /> : <PanelRightClose size={20} />}</span>
            <span className="nav__label">קפל תפריט</span>
          </button>
        </div>
      </nav>

      <main id="main" className="content" tabIndex={-1}>
        <div className="proto-banner" role="note">אב-טיפוס לחיץ · נתוני דמה · שעון הדגמה מתחיל ב-<Ltr>10:30</Ltr> · שינויים לא נשמרים ומתאפסים ברענון</div>
        {children}
      </main>

      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} onPick={(id) => { setSearchOpen(false); panel.open(id, null); }} />
      <OrderPanel />
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
