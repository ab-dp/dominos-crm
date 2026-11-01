import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useMatch, useNavigate } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Bell, CalendarClock, ChartColumn, Ellipsis, UserPlus, ClipboardList, House, LogOut, PanelRightClose, PanelRightOpen, Palette, Plus, Search, Settings, Store, Tags, TriangleAlert, Users, } from 'lucide-react';
import { Button, Tip, useHotkey } from '../design/components';
import { useStore } from '../data/store';
import { useAuth } from '../auth/AuthContext';
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
import './AppShell.css';
const BASE = import.meta.env.BASE_URL;
const MOBILE_MAIN = ['/today', '/orders', '/exceptions', '/customers'];
export function AppShell({ children }) {
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
    const critical = orders.filter((o) => o.health === 'critical');
    const urgentCount = orders.filter((o) => o.health === 'critical' || o.health === 'urgent').length;
    function newOrder() {
        openNewOrder();
    }
    const groups = [
        {
            title: 'עבודה יומית',
            items: [
                { to: '/today', label: 'היום', icon: _jsx(House, { size: 20 }), count: urgentCount, alert: critical.length > 0 },
                { to: '/orders', label: 'הזמנות', icon: _jsx(ClipboardList, { size: 20 }) },
                { to: '/exceptions', label: 'חריגים ומשימות', icon: _jsx(TriangleAlert, { size: 20 }), count: urgentCount + dueTasks.length, alert: critical.length > 0 },
            ],
        },
        {
            title: 'מאגרים',
            items: [
                { to: '/customers', label: 'לקוחות', icon: _jsx(Users, { size: 20 }) },
                { to: '/pricelists', label: 'מחירונים', icon: _jsx(Tags, { size: 20 }) },
                { to: '/branches', label: 'סניפים ואשכולות', icon: _jsx(Store, { size: 20 }) },
            ],
        },
        {
            title: 'ניהול',
            items: [
                { to: '/reports', label: 'דוחות', icon: _jsx(ChartColumn, { size: 20 }) },
                ...(isAdmin ? [{ to: '/settings', label: 'הגדרות', icon: _jsx(Settings, { size: 20 }), count: pendingUsers, alert: pendingUsers > 0 }] : []),
            ],
        },
    ];
    // מעבר מסך (גם בכפתור "חזרה" של הדפדפן) סוגר תיק הזמנה, טופס הזמנה ותפריט "עוד" פתוחים
    const firstPath = useRef(true);
    useEffect(() => {
        if (firstPath.current) {
            firstPath.current = false;
            return;
        }
        if (panel.openId != null)
            panel.close();
        closeNewOrder();
        setMoreOpen(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);
    const moreItems = groups.flatMap((g) => g.items).filter((it) => !MOBILE_MAIN.includes(it.to));
    return (_jsxs("div", { className: `shell ${collapsed ? 'shell--collapsed' : ''}`, children: [_jsx("a", { href: "#main", className: "skip", children: "\u05D3\u05DC\u05D2 \u05DC\u05EA\u05D5\u05DB\u05DF" }), _jsxs("header", { className: "topbar", children: [_jsx(Link, { to: "/today", className: "topbar__logo", "aria-label": "Domino's CRM \u2013 \u05D7\u05D6\u05E8\u05D4 \u05DC\u05DE\u05E1\u05DA \u05D4\u05D9\u05D5\u05DD", children: _jsx("img", { src: `${BASE}logo-tile.svg`, alt: "" }) }), _jsxs("button", { className: "search-trigger", onClick: () => setSearchOpen(true), "aria-label": "\u05D7\u05D9\u05E4\u05D5\u05E9: \u05D4\u05D6\u05DE\u05E0\u05D4, \u05DC\u05E7\u05D5\u05D7, \u05DE\u05E1' Q, \u05D7.\u05E4, \u05D8\u05DC\u05E4\u05D5\u05DF (/)", children: [_jsx(Search, { size: 18, "aria-hidden": "true" }), _jsx("span", { children: "\u05D7\u05D9\u05E4\u05D5\u05E9: \u05D4\u05D6\u05DE\u05E0\u05D4, \u05DC\u05E7\u05D5\u05D7, \u05DE\u05E1' Q, \u05D7.\u05E4, \u05D8\u05DC\u05E4\u05D5\u05DF\u2026" }), _jsx("kbd", { className: "kbd", children: "/" })] }), _jsxs("div", { className: "topbar__actions", children: [_jsx(Button, { variant: "primary", icon: _jsx(Plus, { size: 18 }), kbd: "N", onClick: newOrder, children: "\u05D4\u05D6\u05DE\u05E0\u05D4 \u05D7\u05D3\u05E9\u05D4" }), _jsxs(Popover.Root, { children: [_jsx(Popover.Trigger, { asChild: true, children: _jsxs("button", { className: "icon-btn bell", "aria-label": `התראות: ${critical.length + pendingUsers + dueTasks.length} חדשות`, children: [_jsx(Bell, { size: 20 }), critical.length + pendingUsers + dueTasks.length > 0 && _jsx("span", { className: "bell__count", children: _jsx(Ltr, { children: critical.length + pendingUsers + dueTasks.length }) })] }) }), _jsx(Popover.Portal, { children: _jsxs(Popover.Content, { className: "pop bell-pop", align: "end", sideOffset: 8, dir: "rtl", children: [pendingUsers > 0 && (_jsxs("button", { className: "bell-join", onClick: () => nav('/settings/users'), children: [_jsx(UserPlus, { size: 18, "aria-hidden": "true" }), " ", _jsxs("span", { children: [_jsx("b", { children: _jsx(Ltr, { children: pendingUsers }) }), " \u05D1\u05E7\u05E9\u05D5\u05EA \u05D4\u05E6\u05D8\u05E8\u05E4\u05D5\u05EA \u05DE\u05DE\u05EA\u05D9\u05E0\u05D5\u05EA"] })] })), dueTasks.length > 0 && (_jsxs("button", { className: "bell-join", onClick: () => nav('/exceptions'), children: [_jsx(CalendarClock, { size: 18, "aria-hidden": "true" }), " ", _jsxs("span", { children: [_jsx("b", { children: _jsx(Ltr, { children: dueTasks.length }) }), " \u05DE\u05E9\u05D9\u05DE\u05D5\u05EA \u05DE\u05E2\u05E7\u05D1 \u05DC\u05D4\u05D9\u05D5\u05DD"] })] })), _jsx("p", { className: "pop__title", children: "\u05D7\u05E8\u05D9\u05D2\u05D5\u05EA \u05E9\u05D3\u05D5\u05E8\u05E9\u05D5\u05EA \u05D8\u05D9\u05E4\u05D5\u05DC" }), critical.length === 0 ? _jsx("p", { className: "pop__text", children: "\u05D0\u05D9\u05DF \u05D7\u05E8\u05D9\u05D2\u05D5\u05EA \u05DB\u05E8\u05D2\u05E2 \u2713" }) : (_jsx("ul", { className: "bell-list", children: critical.map((o) => (_jsx("li", { children: _jsxs("button", { onClick: (e) => panel.open(o.id, e.currentTarget), children: [_jsx("span", { className: "bell-list__issue", children: o.issues[0].label }), _jsxs("span", { className: "bell-list__meta", children: [o.customerName, " \u00B7 ", _jsx(Ltr, { children: o.time })] })] }) }, o.id))) }))] }) })] }), _jsxs("div", { className: "user", children: [_jsx("span", { className: "user__avatar", "aria-hidden": "true", children: firstName[0] ?? '?' }), _jsxs("span", { className: "user__id", children: [_jsx("span", { className: "user__name", children: profile?.name }), _jsx("span", { className: "user__role", children: profile ? ROLE_LABEL[profile.role] : '' })] }), _jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(LogOut, { size: 16 }), onClick: () => logout(), children: "\u05D4\u05EA\u05E0\u05EA\u05E7" })] })] })] }), _jsxs("nav", { className: "sidebar", "aria-label": "\u05E0\u05D9\u05D5\u05D5\u05D8 \u05E8\u05D0\u05E9\u05D9", children: [_jsxs(Link, { to: "/today", className: "sidebar__logo", "aria-label": "Domino's CRM \u2013 \u05D7\u05D6\u05E8\u05D4 \u05DC\u05DE\u05E1\u05DA \u05D4\u05D9\u05D5\u05DD", children: [_jsx("img", { className: "sidebar__logo-full", src: `${BASE}logo-horizontal-white.svg`, alt: "" }), _jsx("img", { className: "sidebar__logo-tile", src: `${BASE}logo-tile.svg`, alt: "" })] }), _jsxs("div", { className: "sidebar__groups", children: [groups.map((g) => (_jsxs("div", { className: "navgroup", children: [_jsx("p", { className: "navgroup__title", "aria-hidden": collapsed, children: g.title }), _jsx("ul", { children: g.items.map((it) => (_jsx("li", { className: MOBILE_MAIN.includes(it.to) ? '' : 'nav-li--more', children: _jsxs(NavItem, { to: it.to, label: it.label, collapsed: collapsed, children: [_jsx("span", { className: "nav__icon", "aria-hidden": "true", children: it.icon }), _jsx("span", { className: "nav__label", children: it.label }), !!it.count && _jsx("span", { className: `nav__count ${it.alert ? 'nav__count--alert' : ''}`, children: _jsx(Ltr, { children: it.count }) })] }) }, it.to))) })] }, g.title))), _jsxs(Popover.Root, { open: moreOpen, onOpenChange: setMoreOpen, children: [_jsx(Popover.Trigger, { asChild: true, children: _jsxs("button", { className: `nav nav-more ${moreItems.some((it) => location.pathname.startsWith(it.to)) ? 'is-active' : ''}`, "aria-label": "\u05E2\u05D5\u05D3", children: [_jsx("span", { className: "nav__icon", "aria-hidden": "true", children: _jsx(Ellipsis, { size: 20 }) }), _jsx("span", { className: "nav__label", children: "\u05E2\u05D5\u05D3" }), moreItems.some((it) => it.alert) && _jsx("span", { className: "nav__count nav__count--alert nav__count--dot", "aria-hidden": "true" })] }) }), _jsx(Popover.Portal, { children: _jsx(Popover.Content, { className: "menu more-menu", side: "top", align: "end", sideOffset: 10, dir: "rtl", children: moreItems.map((it) => (_jsxs(Link, { to: it.to, className: "menu__item", onClick: () => setMoreOpen(false), children: [_jsx("span", { className: "nav__icon", "aria-hidden": "true", children: it.icon }), _jsx("span", { className: "more-menu__label", children: it.label }), !!it.count && _jsx("span", { className: `nav__count ${it.alert ? 'nav__count--alert' : ''}`, children: _jsx(Ltr, { children: it.count }) })] }, it.to))) }) })] })] }), _jsxs("div", { className: "sidebar__foot", children: [_jsxs(NavItem, { to: "/styleguide", label: "\u05DE\u05D3\u05E8\u05D9\u05DA \u05E1\u05D2\u05E0\u05D5\u05DF", collapsed: collapsed, quiet: true, children: [_jsx("span", { className: "nav__icon", "aria-hidden": "true", children: _jsx(Palette, { size: 20 }) }), _jsx("span", { className: "nav__label", children: "\u05DE\u05D3\u05E8\u05D9\u05DA \u05E1\u05D2\u05E0\u05D5\u05DF" })] }), _jsxs("button", { className: "nav nav--quiet", onClick: () => setCollapsed(!collapsed), "aria-expanded": !collapsed, "aria-label": collapsed ? 'הרחב תפריט' : 'קפל תפריט', children: [_jsx("span", { className: "nav__icon", "aria-hidden": "true", children: collapsed ? _jsx(PanelRightOpen, { size: 20 }) : _jsx(PanelRightClose, { size: 20 }) }), _jsx("span", { className: "nav__label", children: "\u05E7\u05E4\u05DC \u05EA\u05E4\u05E8\u05D9\u05D8" })] })] })] }), _jsx("main", { id: "main", className: "content", tabIndex: -1, children: _jsx(AnimatePresence, { mode: "wait", initial: false, children: _jsx(motion.div, { initial: reduce ? { opacity: 0 } : { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, transition: { duration: 0.08 } }, transition: { duration: 0.18, ease: [0.2, 0, 0, 1] }, children: _jsx(ScreenBoundary, { resetKey: location.pathname, children: children }) }, location.pathname) }) }), _jsx(CommandSearch, { open: searchOpen, onOpenChange: setSearchOpen, onPick: (id) => { setSearchOpen(false); panel.open(id, null); } }), _jsx(OrderPanel, {}), _jsx(NewOrderDialog, {}), _jsx(StatusDialogs, {}), _jsx(ConflictDialog, {}), _jsx(ChangeDialog, {})] }));
}
/* פריט תפריט: כשהתפריט מקופל, התווית מוצגת כ-tooltip */
function NavItem({ to, label, collapsed, quiet, children }) {
    const active = !!useMatch({ path: to, end: false });
    const link = (_jsx(Link, { to: to, className: `nav ${quiet ? 'nav--quiet' : ''} ${active ? 'is-active' : ''}`, "aria-current": active ? 'page' : undefined, "aria-label": collapsed ? label : undefined, children: children }));
    return collapsed ? _jsx(Tip, { label: label, side: "left", children: link }) : link;
}
