import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import { MotionConfig } from 'motion/react';
import { ToastProvider } from './design/Toast';
import { StoreProvider } from './data/store';
import { PanelProvider } from './app/PanelContext';
import { AppShell } from './app/AppShell';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AuthScreens } from './auth/AuthScreens';
import { InactivityGuard } from './auth/Inactivity';
import { DominoTile } from './components/DominoTile';
import { TodayPage } from './features/today/TodayPage';
import { OrdersPage } from './features/orders/OrdersPage';
import { CreditReportPage } from './features/reports/CreditReportPage';
import { StyleGuidePage } from './features/styleguide/StyleGuidePage';
import { SettingsPage } from './features/settings/SettingsPage';
import { BranchesPage } from './features/branches/BranchesPage';
import { CustomersPage } from './features/customers/CustomersPage';
import { CustomerFile } from './features/customers/CustomerFile';
import { PriceListsPage } from './features/pricelists/PriceListsPage';
import { ExceptionsPage } from './features/exceptions/ExceptionsPage';
import { ReportsHub, ReportView } from './features/reports/ReportsPage';
export function App() {
    return (_jsx(MotionConfig, { reducedMotion: "user", children: _jsx(Tooltip.Provider, { children: _jsx(ToastProvider, { children: _jsx(AuthProvider, { children: _jsx(Gate, {}) }) }) }) }));
}
/* אף אחד לא נכנס למערכת בלי אישור של מנהל המערכת */
function Gate() {
    const { phase } = useAuth();
    if (phase === 'loading') {
        return (_jsx("div", { className: "boot", role: "status", "aria-label": "\u05D8\u05D5\u05E2\u05DF", children: _jsx(DominoTile, { size: 72 }) }));
    }
    if (phase !== 'active')
        return _jsx(AuthScreens, {});
    return (_jsx(StoreProvider, { children: _jsx(PanelProvider, { children: _jsxs(HashRouter, { children: [_jsx(InactivityGuard, {}), _jsx(AppShell, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/today", replace: true }) }), _jsx(Route, { path: "/today", element: _jsx(TodayPage, {}) }), _jsx(Route, { path: "/orders", element: _jsx(OrdersPage, {}) }), _jsx(Route, { path: "/reports", element: _jsx(ReportsHub, {}) }), _jsx(Route, { path: "/reports/credit", element: _jsx(CreditReportPage, {}) }), _jsx(Route, { path: "/reports/:id", element: _jsx(ReportView, {}) }), _jsx(Route, { path: "/styleguide", element: _jsx(StyleGuidePage, {}) }), _jsx(Route, { path: "/settings/*", element: _jsx(SettingsPage, {}) }), _jsx(Route, { path: "/customers", element: _jsx(CustomersPage, {}) }), _jsx(Route, { path: "/customers/:id", element: _jsx(CustomerFile, {}) }), _jsx(Route, { path: "/pricelists", element: _jsx(PriceListsPage, {}) }), _jsx(Route, { path: "/exceptions", element: _jsx(ExceptionsPage, {}) }), _jsx(Route, { path: "/branches", element: _jsx(BranchesPage, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/today", replace: true }) })] }) })] }) }) }));
}
