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
import { Placeholder, ReportsHub } from './features/Placeholder';

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
              <Route path="/styleguide" element={<StyleGuidePage />} />
              <Route path="/settings/*" element={<SettingsPage />} />
              <Route path="/customers" element={<Placeholder title="לקוחות" stage={4} />} />
              <Route path="/pricelists" element={<Placeholder title="מחירונים" stage={4} />} />
              <Route path="/exceptions" element={<Placeholder title="חריגים ומשימות" stage={6} />} />
              <Route path="/branches" element={<Placeholder title="סניפים ואשכולות" stage={3} />} />
              <Route path="*" element={<Navigate to="/today" replace />} />
            </Routes>
          </AppShell>
        </HashRouter>
      </PanelProvider>
    </StoreProvider>
  );
}
