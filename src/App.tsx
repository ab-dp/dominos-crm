import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import { MotionConfig } from 'motion/react';
import { ToastProvider } from './design/Toast';
import { StoreProvider } from './data/store';
import { PanelProvider } from './app/PanelContext';
import { AppShell } from './app/AppShell';
import { TodayPage } from './features/today/TodayPage';
import { OrdersPage } from './features/orders/OrdersPage';
import { CreditReportPage } from './features/reports/CreditReportPage';
import { StyleGuidePage } from './features/styleguide/StyleGuidePage';
import { Placeholder, ReportsHub } from './features/Placeholder';

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Tooltip.Provider>
        <ToastProvider>
          <StoreProvider>
            <PanelProvider>
              <HashRouter>
                <AppShell>
                  <Routes>
                    <Route path="/" element={<Navigate to="/today" replace />} />
                    <Route path="/today" element={<TodayPage />} />
                    <Route path="/orders" element={<OrdersPage />} />
                    <Route path="/reports" element={<ReportsHub />} />
                    <Route path="/reports/credit" element={<CreditReportPage />} />
                    <Route path="/styleguide" element={<StyleGuidePage />} />
                    <Route path="/customers" element={<Placeholder title="לקוחות" stage={4} />} />
                    <Route path="/pricelists" element={<Placeholder title="מחירונים" stage={4} />} />
                    <Route path="/exceptions" element={<Placeholder title="חריגים ומשימות" stage={6} />} />
                    <Route path="/branches" element={<Placeholder title="סניפים ואשכולות" stage={3} />} />
                    <Route path="/settings" element={<Placeholder title="הגדרות" stage={2} />} />
                    <Route path="*" element={<Navigate to="/today" replace />} />
                  </Routes>
                </AppShell>
              </HashRouter>
            </PanelProvider>
          </StoreProvider>
        </ToastProvider>
      </Tooltip.Provider>
    </MotionConfig>
  );
}
