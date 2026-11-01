import { Suspense, lazy, type ComponentType } from 'react';
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

/* מסכים משניים נטענים רק כשנכנסים אליהם – הטעינה הראשונה (כניסה, היום, הזמנות) קלה ומהירה יותר */
/* אחרי עדכון גרסה, טאב פתוח עלול לבקש קובץ ישן שכבר לא קיים – טוענים מחדש פעם אחת ומקבלים את הגרסה החדשה */
const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, k: K) => lazy(() => load().then((m) => {
  try { sessionStorage.removeItem("chunkReload"); } catch { /* מצב פרטי */ }
  return { default: m[k] };
}, (e) => {
  let tried = false;
  try { tried = sessionStorage.getItem("chunkReload") === "1"; sessionStorage.setItem("chunkReload", "1"); } catch { /* מצב פרטי */ }
  if (!tried) { window.location.reload(); return new Promise<never>(() => undefined); }
  throw e;
}));
const CreditReportPage = named(() => import('./features/reports/CreditReportPage'), 'CreditReportPage');
const MonthClosePage = named(() => import('./features/reports/MonthClosePage'), 'MonthClosePage');
const StyleGuidePage = named(() => import('./features/styleguide/StyleGuidePage'), 'StyleGuidePage');
const SettingsPage = named(() => import('./features/settings/SettingsPage'), 'SettingsPage');
const BranchesPage = named(() => import('./features/branches/BranchesPage'), 'BranchesPage');
const CustomersPage = named(() => import('./features/customers/CustomersPage'), 'CustomersPage');
const CustomerFile = named(() => import('./features/customers/CustomerFile'), 'CustomerFile');
const PriceListsPage = named(() => import('./features/pricelists/PriceListsPage'), 'PriceListsPage');
const ExceptionsPage = named(() => import('./features/exceptions/ExceptionsPage'), 'ExceptionsPage');
const ReportsHub = named(() => import('./features/reports/ReportsPage'), 'ReportsHub');
const ReportView = named(() => import('./features/reports/ReportsPage'), 'ReportView');

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Tooltip.Provider>
        <ToastProvider>
          <AuthProvider>
            <Gate />
          </AuthProvider>
        </ToastProvider>
      </Tooltip.Provider>
    </MotionConfig>
  );
}

/* אף אחד לא נכנס למערכת בלי אישור של מנהל המערכת */
function Gate() {
  const { phase } = useAuth();
  if (phase === 'loading') {
    return (
      <div className="boot" role="status" aria-label="טוען">
        <DominoTile size={72} />
      </div>
    );
  }
  if (phase !== 'active') return <AuthScreens />;
  return (
    <StoreProvider>
      <PanelProvider>
        <HashRouter>
          <InactivityGuard />
          <AppShell>
            <Suspense fallback={<div className="page" aria-busy="true" aria-label="טוען מסך" />}>
            <Routes>
              <Route path="/" element={<Navigate to="/today" replace />} />
              <Route path="/today" element={<TodayPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/reports" element={<ReportsHub />} />
              <Route path="/reports/credit" element={<CreditReportPage />} />
              <Route path="/reports/close" element={<MonthClosePage />} />
              <Route path="/reports/:id" element={<ReportView />} />
              <Route path="/styleguide" element={<StyleGuidePage />} />
              <Route path="/settings/*" element={<SettingsPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/customers/:id" element={<CustomerFile />} />
              <Route path="/pricelists" element={<PriceListsPage />} />
              <Route path="/exceptions" element={<ExceptionsPage />} />
              <Route path="/branches" element={<BranchesPage />} />
              <Route path="*" element={<Navigate to="/today" replace />} />
            </Routes>
            </Suspense>
          </AppShell>
        </HashRouter>
      </PanelProvider>
    </StoreProvider>
  );
}
