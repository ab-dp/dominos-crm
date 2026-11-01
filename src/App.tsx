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
import { MonthClosePage } from './features/reports/MonthClosePage';
import { StyleGuidePage } from './features/styleguide/StyleGuidePage';
import { SettingsPage } from './features/settings/SettingsPage';
import { BranchesPage } from './features/branches/BranchesPage';
import { CustomersPage } from './features/customers/CustomersPage';
import { CustomerFile } from './features/customers/CustomerFile';
import { PriceListsPage } from './features/pricelists/PriceListsPage';
import { ExceptionsPage } from './features/exceptions/ExceptionsPage';
import { ReportsHub, ReportView } from './features/reports/ReportsPage';

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
          </AppShell>
        </HashRouter>
      </PanelProvider>
    </StoreProvider>
  );
}
